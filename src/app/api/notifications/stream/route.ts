import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, verifyNotificationStreamToken } from '@/lib/auth';
import { createNotificationEventStream } from '@/lib/notification-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isBearerFallbackAllowed() {
  return /^(1|true|yes)$/i.test(String(process.env.SSE_ALLOW_BEARER_FALLBACK || 'false'));
}

function getTokenFromRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const streamToken = searchParams.get('st');
  if (streamToken) {
    return { token: streamToken, source: 'stream-query' as const };
  }

  if (isBearerFallbackAllowed()) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return { token: authHeader.slice(7), source: 'access-header' as const };
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const auth = getTokenFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const user = auth.source === 'stream-query'
    ? verifyNotificationStreamToken(auth.token)
    : verifyAccessToken(auth.token);

  if (!user) {
    return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
  }

  const stream = createNotificationEventStream(user.userId);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
