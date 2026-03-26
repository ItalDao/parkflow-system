import { NextRequest, NextResponse } from 'next/server';
import { generateNotificationStreamToken, verifyAccessToken } from '@/lib/auth';

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

  const streamToken = generateNotificationStreamToken({ userId: user.userId });
  return NextResponse.json({ streamToken, expiresInSec: 90 });
}
