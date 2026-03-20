import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

const AUDIT_IP_SALT = process.env.AUDIT_IP_SALT || 'parkingos-ip-salt';

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  const realIp = request.headers.get('x-real-ip');
  return realIp || 'unknown';
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(`${AUDIT_IP_SALT}:${ip}`).digest('hex').slice(0, 20);
}

export function getHashedClientIp(request: NextRequest): string {
  return hashIp(getClientIp(request));
}
