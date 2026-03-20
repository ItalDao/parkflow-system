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

export class InMemoryRateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(
    private readonly rules: Record<string, RateLimitRule>,
    private readonly staleMs = 30 * 60_000
  ) {}

  checkAndHit(subject: string, action: string): RateLimitResult {
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

  clear(subject: string, action: string): void {
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
