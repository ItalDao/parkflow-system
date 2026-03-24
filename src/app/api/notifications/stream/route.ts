import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { createNotificationEventStream } from '@/lib/notification-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getTokenFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get('token');
}

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const user = verifyAccessToken(token);
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
