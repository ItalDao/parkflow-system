import Redis from 'ioredis';

export type RateLimitRule = {
  windowMs: number;
  maxAttempts: number;
  blockMs: number;
  blockOnEqual?: boolean;
};

type RateLimitEntry = {
  attempts: number;
  blockedUntil: number;
  lastSeen: number;
};

export type RateLimitResult =
  | { blocked: false }
  | { blocked: true; retryAfterSec: number };

export interface RateLimiterProvider {
  checkAndHit(subject: string, action: string): Promise<RateLimitResult>;
  clear(subject: string, action: string): Promise<void>;
}

type RateLimiterBackend = 'memory' | 'redis';

let warnedRedisFallback = false;
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  redisClient = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  return redisClient;
}

export class InMemoryRateLimiter implements RateLimiterProvider {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(
    private readonly rules: Record<string, RateLimitRule>,
    private readonly staleMs = 30 * 60_000
  ) {}

  async checkAndHit(subject: string, action: string): Promise<RateLimitResult> {
    const rule = this.rules[action];
    if (!rule) return { blocked: false };

    const now = Date.now();
    this.sweep(now);

    const key = this.key(subject, action);
    const current = this.store.get(key);

    if (current && current.blockedUntil > now) {
      return {
        blocked: true,
        retryAfterSec: Math.max(1, Math.ceil((current.blockedUntil - now) / 1000)),
      };
    }

    const resetByWindow = !current || now - current.lastSeen > rule.windowMs;
    const attempts = resetByWindow ? 1 : current.attempts + 1;
    const shouldBlock = rule.blockOnEqual ? attempts >= rule.maxAttempts : attempts > rule.maxAttempts;
    const blockedUntil = shouldBlock ? now + rule.blockMs : 0;

    this.store.set(key, { attempts, blockedUntil, lastSeen: now });

    if (blockedUntil > now) {
      return {
        blocked: true,
        retryAfterSec: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
      };
    }

    return { blocked: false };
  }

  async clear(subject: string, action: string): Promise<void> {
    this.store.delete(this.key(subject, action));
  }

  private key(subject: string, action: string) {
    return `${subject}:${action}`;
  }

  private sweep(now: number) {
    for (const [k, v] of this.store.entries()) {
      if (v.blockedUntil <= now && now - v.lastSeen > this.staleMs) {
        this.store.delete(k);
      }
    }
  }
}

export class RedisRateLimiter implements RateLimiterProvider {
  constructor(private readonly redis: Redis, private readonly rules: Record<string, RateLimitRule>) {}

  async checkAndHit(subject: string, action: string): Promise<RateLimitResult> {
    const rule = this.rules[action];
    if (!rule) return { blocked: false };

    const blockKey = this.blockKey(subject, action);
    const attemptsKey = this.attemptsKey(subject, action);

    const blockTtl = await this.redis.ttl(blockKey);
    if (blockTtl > 0) {
      return { blocked: true, retryAfterSec: blockTtl };
    }

    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, Math.max(1, Math.ceil(rule.windowMs / 1000)));
    }

    const shouldBlock = rule.blockOnEqual ? attempts >= rule.maxAttempts : attempts > rule.maxAttempts;
    if (shouldBlock) {
      const retryAfterSec = Math.max(1, Math.ceil(rule.blockMs / 1000));
      await this.redis.multi().set(blockKey, '1', 'EX', retryAfterSec).del(attemptsKey).exec();
      return { blocked: true, retryAfterSec };
    }

    return { blocked: false };
  }

  async clear(subject: string, action: string): Promise<void> {
    await this.redis.del(this.attemptsKey(subject, action), this.blockKey(subject, action));
  }

  private attemptsKey(subject: string, action: string) {
    return `rl:attempt:${action}:${subject}`;
  }

  private blockKey(subject: string, action: string) {
    return `rl:block:${action}:${subject}`;
  }
}

export function createRateLimiter(
  rules: Record<string, RateLimitRule>,
  options?: { staleMs?: number; backend?: RateLimiterBackend }
): RateLimiterProvider {
  const backend = options?.backend ?? ((process.env.RATE_LIMIT_BACKEND as RateLimiterBackend | undefined) || 'memory');

  if (backend === 'redis') {
    const redis = getRedisClient();
    if (redis) {
      return new RedisRateLimiter(redis, rules);
    }
    if (!warnedRedisFallback) {
      warnedRedisFallback = true;
      console.warn('[rate-limit] RATE_LIMIT_BACKEND=redis requested, but REDIS_URL is missing. Falling back to memory.');
    }
    return new InMemoryRateLimiter(rules, options?.staleMs);
  }

  return new InMemoryRateLimiter(rules, options?.staleMs);
}
