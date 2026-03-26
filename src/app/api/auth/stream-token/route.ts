import { NextRequest, NextResponse } from 'next/server';
import { generateNotificationStreamToken, verifyAccessToken } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { getHashedClientIp } from '@/lib/security';

const STREAM_TOKEN_ACTION = 'stream-token';
const streamTokenRateLimiter = createRateLimiter({
  [STREAM_TOKEN_ACTION]: { windowMs: 60_000, maxAttempts: 40, blockMs: 60_000, blockOnEqual: true },
});

function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyAccessToken(authHeader.substring(7));
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const subject = `${user.userId}:${getHashedClientIp(request)}`;
  const throttle = await streamTokenRateLimiter.checkAndHit(subject, STREAM_TOKEN_ACTION);
  if (throttle.blocked) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes de token. Intenta en ${throttle.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSec) } }
    );
  }

  const streamToken = generateNotificationStreamToken({ userId: user.userId });
  return NextResponse.json({ streamToken, expiresInSec: 90 });
}
