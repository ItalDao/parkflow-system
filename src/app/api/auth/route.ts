import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { getClientIp, hashIp } from '@/lib/security';

type LoginThrottle = {
  attempts: number;
  blockedUntil: number;
  lastSeen: number;
};

const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_BLOCK_MS = 10 * 60 * 1000; // 10 minutes
const loginThrottles = new Map<string, LoginThrottle>();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createAuthAuditLog(userId: string, action: string, ipHash?: string, details?: unknown) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: 'Auth',
        ipAddress: ipHash || null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (error) {
    console.error('Auth audit log error:', error);
  }
}

function getThrottleKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`;
}

function sweepOldThrottleEntries(now: number) {
  for (const [k, v] of loginThrottles.entries()) {
    if (now - v.lastSeen > LOGIN_WINDOW_MS * 3 && v.blockedUntil <= now) {
      loginThrottles.delete(k);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const now = Date.now();
    sweepOldThrottleEntries(now);

    const body = await request.json();
    const { action, email, password, firstName, lastName, phone, role } = body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (action === 'register') {
      if (!normalizedEmail || !password) {
        return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
      }
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return NextResponse.json({ error: 'Formato de email inválido' }, { status: 400 });
      }
      if (String(password).length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 });
      }

      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: role || 'CUSTOMER',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatar: true,
        },
      });

      const accessToken = generateAccessToken({ userId: user.id, role: user.role });
      const refreshToken = generateRefreshToken({ userId: user.id });

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return NextResponse.json({ user, accessToken, refreshToken });
    }

    if (action === 'login') {
      if (!normalizedEmail || !password) {
        return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
      }

      const clientIp = getClientIp(request);
      const clientIpHash = hashIp(clientIp);
      const throttleKey = getThrottleKey(clientIp, normalizedEmail);
      const currentThrottle = loginThrottles.get(throttleKey);
      if (currentThrottle?.blockedUntil && currentThrottle.blockedUntil > now) {
        const retryAfter = Math.max(1, Math.ceil((currentThrottle.blockedUntil - now) / 1000));
        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
        if (existingUser) {
          await createAuthAuditLog(existingUser.id, 'RATE_LIMITED_LOGIN', clientIpHash, {
            retryAfter,
          });
        }
        return NextResponse.json(
          { error: `Demasiados intentos. Intenta nuevamente en ${Math.ceil(retryAfter / 60)} min.` },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }

      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        const prev = loginThrottles.get(throttleKey);
        const resetByWindow = !prev || now - prev.lastSeen > LOGIN_WINDOW_MS;
        const attempts = resetByWindow ? 1 : prev.attempts + 1;
        const blockedUntil = attempts >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_BLOCK_MS : 0;
        loginThrottles.set(throttleKey, { attempts, blockedUntil, lastSeen: now });
        return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
      }

      if (user.isBlocked && user.blockedUntil && user.blockedUntil > new Date()) {
        await createAuthAuditLog(user.id, 'LOGIN_BLOCKED_ACCOUNT', clientIpHash, {
          blockedUntil: user.blockedUntil,
        });
        return NextResponse.json({ error: 'Cuenta bloqueada temporalmente. Intenta de nuevo más tarde.' }, { status: 403 });
      }

      const valid = await comparePassword(password, user.password);
      if (!valid) {
        const prev = loginThrottles.get(throttleKey);
        const resetByWindow = !prev || now - prev.lastSeen > LOGIN_WINDOW_MS;
        const throttleAttempts = resetByWindow ? 1 : prev.attempts + 1;
        const blockedUntil = throttleAttempts >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_BLOCK_MS : 0;
        loginThrottles.set(throttleKey, { attempts: throttleAttempts, blockedUntil, lastSeen: now });

        const failedAttempts = user.failedAttempts + 1;
        const updateData: Record<string, unknown> = { failedAttempts };
        if (failedAttempts >= 5) {
          updateData.isBlocked = true;
          updateData.blockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }
        await prisma.user.update({ where: { id: user.id }, data: updateData });
        await createAuthAuditLog(user.id, 'LOGIN_FAILED', clientIpHash, {
          failedAttempts,
          throttledAttempts: throttleAttempts,
        });
        return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, isBlocked: false, blockedUntil: null, lastLoginAt: new Date() },
      });

      loginThrottles.delete(throttleKey);

      const accessToken = generateAccessToken({ userId: user.id, role: user.role });
      const refreshToken = generateRefreshToken({ userId: user.id });

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await createAuthAuditLog(user.id, 'LOGIN_SUCCESS', clientIpHash);

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
        },
        accessToken,
        refreshToken,
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
