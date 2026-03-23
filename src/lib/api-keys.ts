import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

export type ApiKeyAuthResult = {
  id: string;
  name: string;
  scopes: string[];
  createdByUserId: string;
  parkingLotId: string | null;
};

function apiKeyDelegate() {
  return (prisma as unknown as {
    apiKey: {
      findUnique: typeof prisma.$queryRaw;
      update: typeof prisma.$executeRaw;
    };
  }).apiKey as unknown as {
    findUnique: (args: {
      where: { keyHash: string };
      select: {
        id: true;
        name: true;
        scopes: true;
        isActive: true;
        expiresAt: true;
        createdByUserId: true;
        parkingLotId: true;
      };
    }) => Promise<{
      id: string;
      name: string;
      scopes: string;
      isActive: boolean;
      expiresAt: Date | null;
      createdByUserId: string;
      parkingLotId: string | null;
    } | null>;
    update: (args: { where: { id: string }; data: { lastUsedAt: Date } }) => Promise<unknown>;
  };
}

function getApiKeySalt() {
  return process.env.API_KEY_SALT || process.env.JWT_SECRET || 'parkingos-api-key-salt';
}

export function hashApiKey(rawKey: string) {
  return crypto.createHash('sha256').update(`${getApiKeySalt()}:${rawKey}`).digest('hex');
}

export function generateApiKey(prefix = 'pkos_live') {
  const random = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${random}`;
}

export function getApiKeyPrefix(rawKey: string) {
  const trimmed = String(rawKey || '').trim();
  return trimmed.slice(0, 12);
}

function parseScopes(scopesRaw: string | null | undefined) {
  return String(scopesRaw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function hasApiScope(scopes: string[], required: string) {
  const r = required.toLowerCase();
  if (scopes.includes('*')) return true;
  if (scopes.includes(r)) return true;

  const [resource] = r.split(':');
  return scopes.includes(`${resource}:*`);
}

export async function authenticateApiKey(rawKey: string | null | undefined): Promise<ApiKeyAuthResult | null> {
  const token = String(rawKey || '').trim();
  if (!token) return null;

  const keyHash = hashApiKey(token);
  const apiKey = await apiKeyDelegate().findUnique({
    where: { keyHash },
    select: {
      id: true,
      name: true,
      scopes: true,
      isActive: true,
      expiresAt: true,
      createdByUserId: true,
      parkingLotId: true,
    },
  });

  if (!apiKey || !apiKey.isActive) return null;
  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return null;

  await apiKeyDelegate().update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => undefined);

  return {
    id: apiKey.id,
    name: apiKey.name,
    scopes: parseScopes(apiKey.scopes),
    createdByUserId: apiKey.createdByUserId,
    parkingLotId: apiKey.parkingLotId,
  };
}
