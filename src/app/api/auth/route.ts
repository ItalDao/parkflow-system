import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password, firstName, lastName, phone, role } = body;

    if (action === 'register') {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 });
      }

      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
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
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
      }

      if (user.isBlocked && user.blockedUntil && user.blockedUntil > new Date()) {
        return NextResponse.json({ error: 'Cuenta bloqueada temporalmente. Intenta de nuevo más tarde.' }, { status: 403 });
      }

      const valid = await comparePassword(password, user.password);
      if (!valid) {
        const attempts = user.failedAttempts + 1;
        const updateData: Record<string, unknown> = { failedAttempts: attempts };
        if (attempts >= 5) {
          updateData.isBlocked = true;
          updateData.blockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }
        await prisma.user.update({ where: { id: user.id }, data: updateData });
        return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, isBlocked: false, blockedUntil: null, lastLoginAt: new Date() },
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
