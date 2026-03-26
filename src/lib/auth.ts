import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'parkingos-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'parkingos-refresh';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: { userId: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

type NotificationStreamTokenPayload = {
  userId: string;
  purpose: 'notification-stream';
};

export function generateNotificationStreamToken(payload: { userId: string }): string {
  return jwt.sign({ userId: payload.userId, purpose: 'notification-stream' }, JWT_SECRET, { expiresIn: '90s' });
}

export function verifyNotificationStreamToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as NotificationStreamTokenPayload;
    if (decoded.purpose !== 'notification-stream') return null;
    return decoded;
  } catch {
    return null;
  }
}
