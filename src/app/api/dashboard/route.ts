import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { calculateHourlyFractionalPricing } from '@/lib/pricing';
import { getHashedClientIp } from '@/lib/security';
import { createRateLimiter, getRateLimitDiagnostics, RateLimitRule } from '@/lib/rate-limit';
import { sendTransactionalEmail } from '@/lib/email';
import { sendTransactionalSms } from '@/lib/sms';
import { runSubscriptionsMaintenance } from '@/lib/subscriptions-maintenance';
import { emitNotificationEvent } from '@/lib/notification-events';
import { finalizeTicketExit, quoteTicketExit } from '@/lib/ticket-exit';
import { tryHandleSubscriptionEntry } from '@/lib/subscription-access';
import { getStripeClient, isStripeEnabled, toStripeAmount } from '@/lib/stripe';
import { Prisma, Role, TicketStatus, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';

const ACTION_THROTTLE_RULES: Record<string, RateLimitRule> = {
  booking: { windowMs: 60_000, maxAttempts: 10, blockMs: 60_000 },
  entry: { windowMs: 60_000, maxAttempts: 20, blockMs: 60_000 },
  exit: { windowMs: 60_000, maxAttempts: 20, blockMs: 60_000 },
  'open-shift': { windowMs: 5 * 60_000, maxAttempts: 3, blockMs: 5 * 60_000 },
  'close-shift': { windowMs: 5 * 60_000, maxAttempts: 3, blockMs: 5 * 60_000 },
};
const actionRateLimiter = createRateLimiter(ACTION_THROTTLE_RULES);

function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyAccessToken(authHeader.substring(7));
}

function normalizePlate(input: string) {
  return String(input || '').trim().toUpperCase();
}

async function resolveParkingLotIdForUser(
  userId: string,
  role: string,
  requestedLotId?: string | null
): Promise<string | null> {
  // Optional override (used by SUPER_ADMIN and by ADMIN when it matches their assigned lot)
  if (requestedLotId) {
    if (role === 'SUPER_ADMIN') {
      const lot = await prisma.parkingLot.findUnique({ where: { id: requestedLotId }, select: { id: true } });
      return lot?.id ?? null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { assignedLotId: true, parkingLot: { select: { id: true } } },
    });
    const allowedLotId = user?.parkingLot?.id ?? user?.assignedLotId ?? null;
    if (allowedLotId && allowedLotId === requestedLotId) return requestedLotId;
    return null;
  }

  // Default behavior (backwards-compatible)
  if (role === 'SUPER_ADMIN') {
    const lot = await prisma.parkingLot.findFirst({ select: { id: true } });
    return lot?.id ?? null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { assignedLotId: true, parkingLot: { select: { id: true } } },
  });

  return user?.parkingLot?.id ?? user?.assignedLotId ?? null;
}

async function setSpaceStatusWithHistory(
  tx: Prisma.TransactionClient,
  params: { spaceId: string; toStatus: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'OUT_OF_SERVICE'; reason?: string }
) {
  const current = await tx.space.findUnique({ where: { id: params.spaceId }, select: { status: true } });
  if (!current) throw new Error('Espacio no encontrado');
  if (current.status === params.toStatus) return;

  await tx.space.update({ where: { id: params.spaceId }, data: { status: params.toStatus } });
  await tx.spaceStatusHistory.create({
    data: {
      spaceId: params.spaceId,
      fromStatus: current.status,
      toStatus: params.toStatus,
      reason: params.reason,
    },
  });
}

async function createAuditLog(userId: string, action: string, entity: string, entityId?: string, details?: unknown) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details: details ? JSON.stringify(details) : null,
      }
    });
  } catch (err) { console.error('Audit log failed:', err); }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');

    // Security Hardening: Strict RBAC for sensitive resources
    if (user.role === 'OPERATOR' && ['audit', 'users', 'subscriptions', 'parking-lot', 'rates', 'telemetry', 'payments'].includes(resource || '')) {
      return NextResponse.json({ error: 'Acceso denegado: Se requieren permisos de Admin' }, { status: 403 });
    }

    if (resource === 'profile') {
      const profile = await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });
      if (!profile) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      return NextResponse.json(profile);
    }

    const requestedLotId = searchParams.get('parkingLotId');
    const parkingLotId = await resolveParkingLotIdForUser(user.userId, user.role, requestedLotId);
    if (requestedLotId && !parkingLotId) {
      return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
    }

    // Dashboard stats
    if (resource === 'stats') {
      const parkingLot = parkingLotId
        ? await prisma.parkingLot.findUnique({
            where: { id: parkingLotId },
            include: {
              zones: { include: { spaces: true } },
              tickets: { where: { status: 'ACTIVE' } },
            },
          })
        : await prisma.parkingLot.findFirst({
        include: {
          zones: {
            include: {
              spaces: {
                include: {
                  tickets: {
                    where: { status: 'ACTIVE' },
                    include: { vehicle: true },
                    take: 1,
                  },
                  assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
              },
              _count: { select: { spaces: true } },
            },
          },
          tickets: { where: { status: 'ACTIVE' } },
        },
      });

      if (!parkingLot) {
        return NextResponse.json({
          totalSpaces: 0,
          occupiedSpaces: 0,
          availableSpaces: 0,
          occupancyRate: 0,
          todayRevenue: 0,
          todayVehicles: 0,
          activeTickets: 0,
          monthRevenue: 0,
        });
      }

      const allSpaces = parkingLot.zones.flatMap(z => z.spaces);
      const totalSpaces = allSpaces.length;
      const occupiedSpaces = allSpaces.filter(s => s.status === 'OCCUPIED').length;
      const availableSpaces = allSpaces.filter(s => s.status === 'AVAILABLE').length;
      const reservedSpaces = allSpaces.filter(s => s.status === 'RESERVED').length;
      const maintenanceSpaces = allSpaces.filter(s => s.status === 'MAINTENANCE').length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const yesterdayStart = new Date(today);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(today);

      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonthEnd = new Date(monthStart);

      const todayPayments = await prisma.payment.aggregate({
        where: { createdAt: { gte: today }, status: 'COMPLETED', parkingLotId: parkingLot.id },
        _sum: { amount: true },
        _count: true,
      });

      const yesterdayPayments = await prisma.payment.aggregate({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd }, status: 'COMPLETED', parkingLotId: parkingLot.id },
        _sum: { amount: true },
        _count: true,
      });

      const monthPayments = await prisma.payment.aggregate({
        where: { createdAt: { gte: monthStart }, status: 'COMPLETED', parkingLotId: parkingLot.id },
        _sum: { amount: true },
        _count: true,
      });

      const prevMonthPayments = await prisma.payment.aggregate({
        where: { createdAt: { gte: prevMonthStart, lt: prevMonthEnd }, status: 'COMPLETED', parkingLotId: parkingLot.id },
        _sum: { amount: true },
        _count: true,
      });

      const todayTickets = await prisma.ticket.count({
        where: { createdAt: { gte: today }, parkingLotId: parkingLot.id },
      });

      const yesterdayTickets = await prisma.ticket.count({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd }, parkingLotId: parkingLot.id },
      });

      // OPERATOR puede ver ocupación, pero no cifras financieras.
      const finance = user.role === 'OPERATOR'
        ? {
            todayRevenue: 0,
            monthRevenue: 0,
            todayTransactions: 0,
            yesterdayRevenue: 0,
            yesterdayTransactions: 0,
            prevMonthRevenue: 0,
            prevMonthTransactions: 0,
          }
        : {
            todayRevenue: todayPayments._sum.amount || 0,
            monthRevenue: monthPayments._sum.amount || 0,
            todayTransactions: todayPayments._count || 0,
            yesterdayRevenue: yesterdayPayments._sum.amount || 0,
            yesterdayTransactions: yesterdayPayments._count || 0,
            prevMonthRevenue: prevMonthPayments._sum.amount || 0,
            prevMonthTransactions: prevMonthPayments._count || 0,
          };

      return NextResponse.json({
        totalSpaces,
        occupiedSpaces,
        availableSpaces,
        reservedSpaces,
        maintenanceSpaces,
        occupancyRate: totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0,
        todayVehicles: todayTickets,
        yesterdayVehicles: yesterdayTickets,
        activeTickets: parkingLot.tickets.length,
        ...finance,
        parkingLot: {
          id: parkingLot.id,
          name: parkingLot.name,
          address: parkingLot.address,
        },
      });
    }

    if (resource === 'parking-lot') {
      if (!parkingLotId) return NextResponse.json({ error: 'No hay sede asignada' }, { status: 400 });
      const lot = await prisma.parkingLot.findUnique({
        where: { id: parkingLotId },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          phone: true,
          totalSpaces: true,
          openTime: true,
          closeTime: true,
          is24Hours: true,
          isActive: true,
          gracePeriod: true,
          lostTicketFee: true,
          photo: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return NextResponse.json(lot);
    }

    if (resource === 'telemetry') {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
      }

      let dbVersion: string | null = null;
      try {
        const rows = await prisma.$queryRaw<{ version: string }[]>`SELECT version() as version`;
        dbVersion = rows?.[0]?.version ?? null;
      } catch {
        dbVersion = null;
      }

      const rateLimit = await getRateLimitDiagnostics();

      return NextResponse.json({
        env: process.env.NODE_ENV || 'unknown',
        node: process.version,
        prisma: Prisma?.prismaVersion?.client || null,
        db: dbVersion,
        uptimeSeconds: Math.floor(process.uptime()),
        rateLimit,
      });
    }

    // Zone and spaces for map
    if (resource === 'zones') {
      if (!parkingLotId) return NextResponse.json([]);
      const parkingLot = await prisma.parkingLot.findUnique({
        where: { id: parkingLotId },
        include: {
          zones: {
            include: {
              spaces: {
                include: {
                  tickets: {
                    where: { status: 'ACTIVE' },
                    include: { vehicle: true },
                    take: 1,
                  },
                      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
              },
              _count: { select: { spaces: true } },
            },
          },
        },
      });
      return NextResponse.json(parkingLot?.zones || []);
    }

    // Recent tickets
    if (resource === 'tickets') {
      const statusParam = searchParams.get('status');
      const q = searchParams.get('q');
      const takeParam = searchParams.get('take');

      const take = (() => {
        if (!takeParam) return 50;
        const parsed = Number.parseInt(takeParam, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) return 50;
        return Math.min(parsed, 200);
      })();

      const whereClause: Prisma.TicketWhereInput = {};
      if (statusParam && Object.values(TicketStatus).includes(statusParam as TicketStatus)) {
        whereClause.status = statusParam as TicketStatus;
      }
      if (parkingLotId) whereClause.parkingLotId = parkingLotId;

      if (q) {
        const normalized = q.trim();
        if (normalized) {
          whereClause.OR = [
            { ticketCode: { contains: normalized, mode: 'insensitive' } },
            { vehicle: { plate: { contains: normalized.replace(/\s+/g, ''), mode: 'insensitive' } } },
          ];
        }
      }

      const tickets = await prisma.ticket.findMany({
        where: whereClause,
        include: {
          vehicle: true,
          space: { include: { zone: true } },
          operator: { select: { firstName: true, lastName: true } },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
      });

      return NextResponse.json(tickets);
    }

    // Quote an ACTIVE ticket without closing it
    if (resource === 'ticket-quote') {
      const ticketId = searchParams.get('ticketId');
      const lostTicket = searchParams.get('lostTicket') === 'true';
      if (!ticketId) return NextResponse.json({ error: 'ticketId requerido' }, { status: 400 });

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { vehicle: true, space: { include: { zone: true } } },
      });

      if (!ticket || ticket.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Ticket no encontrado o no está activo' }, { status: 400 });
      }

      const parkingLot = await prisma.parkingLot.findUnique({ where: { id: ticket.parkingLotId } });
      if (!parkingLot) return NextResponse.json({ error: 'Sede no encontrada' }, { status: 400 });

      const now = new Date();
      const entryTime = new Date(ticket.entryTime);

      const zoneRate = await prisma.rate.findFirst({
        where: {
          parkingLotId: ticket.parkingLotId,
          vehicleType: ticket.vehicle.type,
          zoneId: ticket.space.zoneId,
          isActive: true,
        },
        orderBy: { price: 'desc' },
      });
      const lotRate = await prisma.rate.findFirst({
        where: {
          parkingLotId: ticket.parkingLotId,
          vehicleType: ticket.vehicle.type,
          zoneId: null,
          isActive: true,
        },
        orderBy: { price: 'desc' },
      });
      const rate = zoneRate ?? lotRate;
      const hourlyRate = rate?.price ?? 3000;

      const pricing = calculateHourlyFractionalPricing({
        entryTime,
        exitTime: now,
        gracePeriodMinutes: parkingLot.gracePeriod,
        hourlyRate,
      });

      const amount = lostTicket ? parkingLot.lostTicketFee : pricing.amount;

      return NextResponse.json({
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          entryTime: ticket.entryTime,
          vehicle: { plate: ticket.vehicle.plate, type: ticket.vehicle.type },
          space: { number: ticket.space.number, zone: { name: ticket.space.zone.name } },
        },
        pricing: {
          totalHours: Math.round(pricing.totalHours * 100) / 100,
          hourlyRate,
          gracePeriodMinutes: parkingLot.gracePeriod,
          amount,
          lostTicketFee: parkingLot.lostTicketFee,
          isLostTicket: lostTicket,
        },
        serverTime: now.toISOString(),
      });
    }

    // Vehicles
    if (resource === 'vehicles') {
      const vehicles = await prisma.vehicle.findMany({
        include: { _count: { select: { tickets: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return NextResponse.json(vehicles);
    }

    // Revenue chart data
    if (resource === 'revenue-chart') {
      const daysParam = Number(searchParams.get('days') || 7);
      const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.floor(daysParam), 1), 90) : 7;

      // OPERATOR puede ver ocupación, pero no cifras financieras.
      if (user.role === 'OPERATOR') {
        const data = [] as Array<{ date: string; day: string; revenue: number; transactions: number }>;
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          data.push({
            date: date.toISOString().split('T')[0],
            day: date.toLocaleDateString('es-CO', { weekday: 'short' }),
            revenue: 0,
            transactions: 0,
          });
        }
        return NextResponse.json(data);
      }

      const data = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const revenue = await prisma.payment.aggregate({
          where: {
            createdAt: { gte: date, lt: nextDate },
            status: 'COMPLETED',
            ...(parkingLotId ? { parkingLotId } : {}),
          },
          _sum: { amount: true },
          _count: true,
        });

        data.push({
          date: date.toISOString().split('T')[0],
          day: date.toLocaleDateString('es-CO', { weekday: 'short' }),
          revenue: revenue._sum.amount || 0,
          transactions: revenue._count || 0,
        });
      }
      return NextResponse.json(data);
    }

    // Payment method breakdown for reports (scoped to lot when available)
    if (resource === 'payment-method-breakdown') {
      const daysParam = Number(searchParams.get('days') || 7);
      const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.floor(daysParam), 1), 90) : 7;

      // OPERATOR no ve finanzas
      if (user.role === 'OPERATOR') {
        return NextResponse.json({
          days,
          total: 0,
          items: [],
        });
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1));

      const rows = await prisma.payment.groupBy({
        by: ['method'],
        where: {
          createdAt: { gte: start },
          status: 'COMPLETED',
          ...(parkingLotId ? { parkingLotId } : {}),
        },
        _sum: { amount: true },
        _count: { _all: true },
      });

      const items = rows
        .map((r) => ({
          method: r.method,
          total: r._sum.amount || 0,
          count: r._count._all || 0,
        }))
        .sort((a, b) => b.total - a.total);

      const total = items.reduce((acc, it) => acc + (it.total || 0), 0);

      return NextResponse.json({
        days,
        total,
        items,
      });
    }

    // Users list
    if (resource === 'users') {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      const requestedUsersLotId = searchParams.get('parkingLotId');
      const contextLotId = await resolveParkingLotIdForUser(user.userId, user.role, requestedUsersLotId);
      if (requestedUsersLotId && !contextLotId) {
        return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
      }

      // SUPER_ADMIN can see all (or filter by parkingLotId). ADMIN only sees their own lot.
      const effectiveLotId = user.role === 'SUPER_ADMIN' ? contextLotId : (await resolveParkingLotIdForUser(user.userId, user.role));
      const whereClause = effectiveLotId
        ? {
            OR: [
              { assignedLotId: effectiveLotId },
              { parkingLot: { is: { id: effectiveLotId } } },
            ],
          }
        : undefined;

      const users = await prisma.user.findMany({
        where: user.role === 'SUPER_ADMIN' ? whereClause : whereClause,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          assignedLotId: true,
          assignedLot: { select: { id: true, name: true } },
          parkingLot: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(users);
    }

    // Shifts
    if (resource === 'shifts') {
      const takeParam = searchParams.get('take');
      const take = (() => {
        if (!takeParam) return 20;
        const parsed = Number.parseInt(takeParam, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) return 20;
        return Math.min(parsed, 200);
      })();

      const shifts = await prisma.shift.findMany({
        where: parkingLotId ? { parkingLotId } : undefined,
        include: {
          operator: { select: { firstName: true, lastName: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      });
      return NextResponse.json(shifts);
    }

    if (resource === 'current-shift') {
      const shift = await prisma.shift.findFirst({
        where: { operatorId: user.userId, status: 'OPEN' },
        include: { operator: { select: { firstName: true, lastName: true } } },
      });
      return NextResponse.json(shift);
    }

    if (resource === 'shifts-history') {
      const takeParam = searchParams.get('take');
      const take = (() => {
        if (!takeParam) return 10;
        const parsed = Number.parseInt(takeParam, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) return 10;
        return Math.min(parsed, 200);
      })();

      const whereClause: Prisma.ShiftWhereInput = {};
      if (parkingLotId) whereClause.parkingLotId = parkingLotId;
      if (user.role === 'OPERATOR') whereClause.operatorId = user.userId;

      const shifts = await prisma.shift.findMany({
        where: whereClause,
        include: {
          operator: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      });
      return NextResponse.json(shifts);
    }

    // Shift report (details + payments breakdown)
    if (resource === 'shift-details') {
      const shiftId = searchParams.get('shiftId');
      if (!shiftId) return NextResponse.json({ error: 'shiftId requerido' }, { status: 400 });

      const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
          operator: { select: { firstName: true, lastName: true, email: true } },
          parkingLot: { select: { id: true, name: true, city: true, address: true } },
          payments: {
            include: {
              ticket: { include: { vehicle: true } },
              operator: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!shift) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
      if (user.role === 'OPERATOR' && shift.operatorId !== user.userId) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      if (parkingLotId && shift.parkingLotId !== parkingLotId) {
        return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
      }

      const byMethod: Record<string, { count: number; total: number }> = {};
      for (const m of Object.values(PaymentMethod)) byMethod[m] = { count: 0, total: 0 };
      for (const p of shift.payments) {
        const key = p.method;
        if (!byMethod[key]) byMethod[key] = { count: 0, total: 0 };
        byMethod[key].count += 1;
        byMethod[key].total += p.amount;
      }

      return NextResponse.json({
        shift: {
          id: shift.id,
          status: shift.status,
          startTime: shift.startTime,
          endTime: shift.endTime,
          initialCash: shift.initialCash,
          totalCash: shift.totalCash,
          totalCard: shift.totalCard,
          totalDigital: shift.totalDigital,
          expectedTotal: shift.expectedTotal,
          actualTotal: shift.actualTotal,
          difference: shift.difference,
          vehiclesServed: shift.vehiclesServed,
          notes: shift.notes,
          operatorId: shift.operatorId,
          operator: shift.operator,
          parkingLotId: shift.parkingLotId,
          parkingLot: shift.parkingLot,
          paymentsCount: shift.payments.length,
        },
        breakdown: byMethod,
        payments: shift.payments.map((p) => ({
          id: p.id,
          createdAt: p.createdAt,
          amount: p.amount,
          method: p.method,
          status: p.status,
          invoiceNumber: p.invoiceNumber,
          cashReceived: p.cashReceived,
          changeGiven: p.changeGiven,
          ticket: {
            id: p.ticketId,
            ticketCode: p.ticket.ticketCode,
            vehicle: { plate: p.ticket.vehicle.plate, type: p.ticket.vehicle.type },
          },
          operator: p.operator,
        })),
      });
    }

    // Payments
    if (resource === 'payments') {
      if (user.role === 'OPERATOR') {
        return NextResponse.json({ error: 'Acceso denegado: Se requieren permisos de Admin' }, { status: 403 });
      }

      const takeParam = Number(searchParams.get('take') || 50);
      const take = Number.isFinite(takeParam) ? Math.min(Math.max(Math.floor(takeParam), 1), 500) : 50;
      const daysParam = searchParams.get('days');
      const daysNum = daysParam ? Number(daysParam) : null;
      const days = daysNum && Number.isFinite(daysNum) ? Math.min(Math.max(Math.floor(daysNum), 1), 365) : null;

      const start = days
        ? (() => {
            const s = new Date();
            s.setHours(0, 0, 0, 0);
            s.setDate(s.getDate() - (days - 1));
            return s;
          })()
        : null;

      const payments = await prisma.payment.findMany({
        where: {
          ...(parkingLotId ? { parkingLotId } : {}),
          ...(start ? { createdAt: { gte: start } } : {}),
        },
        include: {
          ticket: { include: { vehicle: true } },
          operator: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      });
      return NextResponse.json(payments);
    }

    // Rates
    if (resource === 'rates') {
      const rates = await prisma.rate.findMany({
        where: parkingLotId ? { parkingLotId } : undefined,
        include: { zone: true },
        orderBy: { name: 'asc' },
      });
      return NextResponse.json(rates);
    }

    if (resource === 'lots') {
      if (user.role === 'SUPER_ADMIN') {
        const lots = await prisma.parkingLot.findMany({ include: { _count: { select: { zones: true } } } });
        return NextResponse.json(lots);
      }
      if (!parkingLotId) return NextResponse.json([]);
      const lot = await prisma.parkingLot.findUnique({
        where: { id: parkingLotId },
        include: { _count: { select: { zones: true } } },
      });
      return NextResponse.json(lot ? [lot] : []);
    }

    // Audit logs (SUPER_ADMIN full, ADMIN scoped to own lot)
    if (resource === 'audit') {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
      }

      if (user.role === 'SUPER_ADMIN') {
        const logs = await prisma.auditLog.findMany({
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        });
        return NextResponse.json(logs);
      }

      const adminLotId = await resolveParkingLotIdForUser(user.userId, user.role);
      if (!adminLotId) return NextResponse.json([]);

      const lotUsers = await prisma.user.findMany({
        where: {
          OR: [
            { assignedLotId: adminLotId },
            { parkingLot: { is: { id: adminLotId } } },
          ],
        },
        select: { id: true },
      });

      const userIds = Array.from(new Set([user.userId, ...lotUsers.map((u) => u.id)]));
      const logs = await prisma.auditLog.findMany({
        where: { userId: { in: userIds } },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return NextResponse.json(logs);
    }

    // Subscriptions
    if (resource === 'subscriptions') {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      await runSubscriptionsMaintenance();

      const subs = await prisma.subscription.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          vehicle: { select: { plate: true, type: true, brand: true } }
        },
        orderBy: { endDate: 'desc' }
      });
      return NextResponse.json(subs);
    }

    // Notifications
    if (resource === 'notifications') {
      const notes = await prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      return NextResponse.json(notes);
    }

    // People picker for messaging (all roles, scoped to current lot)
    if (resource === 'people') {
      if (!parkingLotId) return NextResponse.json([]);
      const people = await prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ['ADMIN', 'OPERATOR'] },
          OR: [
            { assignedLotId: parkingLotId },
            { parkingLot: { is: { id: parkingLotId } } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, role: true, email: true },
        orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
        take: 200,
      });
      return NextResponse.json(people);
    }

    // Conversations for current user
    if (resource === 'conversations') {
      if (!parkingLotId) return NextResponse.json([]);

      const conversations = await prisma.conversation.findMany({
        where: {
          parkingLotId,
          participants: { some: { userId: user.userId } },
        },
        include: {
          participants: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      });

      // compute unread count per conversation
      const enriched = await Promise.all(
        conversations.map(async (c) => {
          const me = c.participants.find((p) => p.userId === user.userId);
          const lastReadAt = me?.lastReadAt ?? new Date(0);
          const unread = await prisma.message.count({
            where: {
              conversationId: c.id,
              createdAt: { gt: lastReadAt },
              senderId: { not: user.userId },
            },
          });
          return {
            id: c.id,
            title: c.title,
            parkingLotId: c.parkingLotId,
            updatedAt: c.updatedAt,
            participants: c.participants.map((p) => ({
              userId: p.userId,
              lastReadAt: p.lastReadAt,
              user: p.user,
            })),
            lastMessage: c.messages[0]
              ? {
                  id: c.messages[0].id,
                  body: c.messages[0].body,
                  createdAt: c.messages[0].createdAt,
                  sender: c.messages[0].sender,
                }
              : null,
            unread,
          };
        })
      );

      return NextResponse.json(enriched);
    }

    // Messages in a conversation
    if (resource === 'messages') {
      const conversationId = searchParams.get('conversationId');
      if (!conversationId) return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 });

      const membership = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: user.userId } },
        include: { conversation: { select: { id: true, parkingLotId: true, title: true } } },
      });
      if (!membership) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      if (parkingLotId && membership.conversation.parkingLotId !== parkingLotId) {
        return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
      }

      const msgs = await prisma.message.findMany({
        where: { conversationId },
        include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
      return NextResponse.json({
        conversation: membership.conversation,
        messages: msgs,
      });
    }

    // Webhooks
    if (resource === 'webhook-endpoints') {
      if (!parkingLotId) return NextResponse.json({ error: 'Falta sede' }, { status: 400 });
      const hooks = await prisma.webhookEndpoint.findMany({
        where: { parkingLotId },
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json(hooks);
    }

    return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Create resources
export async function POST(request: NextRequest) {
  try {
    const tokenUser = getUserFromRequest(request);
    if (!tokenUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { resource } = body;

    if (typeof resource === 'string' && ACTION_THROTTLE_RULES[resource]) {
      const t = await actionRateLimiter.checkAndHit(tokenUser.userId, resource);
      if (t.blocked) {
        await createAuditLog(tokenUser.userId, 'RATE_LIMITED_ACTION', 'DashboardResource', resource, {
          resource,
          retryAfterSec: t.retryAfterSec,
          ipHash: getHashedClientIp(request),
        });
        return NextResponse.json(
          { error: `Demasiadas operaciones en poco tiempo para ${resource}. Intenta de nuevo en ${t.retryAfterSec}s.` },
          { status: 429, headers: { 'Retry-After': String(t.retryAfterSec) } }
        );
      }
    }

    const requestedLotId: string | null = body.parkingLotId ?? body.data?.parkingLotId ?? null;
    const contextLotId = await resolveParkingLotIdForUser(tokenUser.userId, tokenUser.role, requestedLotId);
    if (requestedLotId && !contextLotId) {
      return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
    }

    // Security Hardening
    if (tokenUser.role === 'OPERATOR' && ['user', 'rate', 'seed'].includes(resource)) {
      return NextResponse.json({ error: 'Operación restringida a Administradores' }, { status: 403 });
    }

    if (resource === 'assign-space' || resource === 'unassign-space') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Solo Administradores pueden asignar espacios' }, { status: 403 });
      }

      const { spaceId, userId } = body;
      if (!spaceId) return NextResponse.json({ error: 'spaceId requerido' }, { status: 400 });
      if (resource === 'assign-space' && !userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

      const space = await prisma.space.findUnique({
        where: { id: spaceId },
        select: {
          id: true,
          status: true,
          assignedUserId: true,
          zone: { select: { parkingLotId: true, name: true } },
        },
      });
      if (!space) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 });
      if (contextLotId && space.zone.parkingLotId !== contextLotId) {
        return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
      }

      if (resource === 'assign-space') {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true } });
        if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

        const newStatus = space.status === 'OCCUPIED' ? 'OCCUPIED' : 'RESERVED';

        const updated = await prisma.$transaction(async (tx) => {
          await tx.space.update({ where: { id: spaceId }, data: { assignedUserId: userId } });
          if (space.status !== newStatus) {
            await setSpaceStatusWithHistory(tx, { spaceId, toStatus: newStatus, reason: 'Asignación de espacio' });
          }
          return tx.space.findUnique({
            where: { id: spaceId },
            select: {
              id: true,
              number: true,
              status: true,
              assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          });
        });

        await createAuditLog(tokenUser.userId, 'ASSIGN_SPACE', 'Space', spaceId, {
          assignedUserId: userId,
          parkingLotId: space.zone.parkingLotId,
        });

        return NextResponse.json(updated);
      }

      const newStatus = space.status === 'OCCUPIED' ? 'OCCUPIED' : 'AVAILABLE';
      const updated = await prisma.$transaction(async (tx) => {
        await tx.space.update({ where: { id: spaceId }, data: { assignedUserId: null } });
        if (space.status !== newStatus) {
          await setSpaceStatusWithHistory(tx, { spaceId, toStatus: newStatus, reason: 'Liberación de espacio' });
        }
        return tx.space.findUnique({
          where: { id: spaceId },
          select: {
            id: true,
            number: true,
            status: true,
            assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        });
      });

      await createAuditLog(tokenUser.userId, 'UNASSIGN_SPACE', 'Space', spaceId, {
        parkingLotId: space.zone.parkingLotId,
        previousAssignedUserId: space.assignedUserId,
      });

      return NextResponse.json(updated);
    }

    // Booking Logic for Reservation Module
    if (resource === 'booking') {
      const { plate, vehicleType, arriveTime, exitTime, spaceId } = body;
      const parkingLotId = contextLotId;
      const parkingLot = parkingLotId ? await prisma.parkingLot.findUnique({ where: { id: parkingLotId } }) : null;
      if (!parkingLot) return NextResponse.json({ error: 'No hay parqueadero' }, { status: 400 });

      const normalizedPlate = normalizePlate(plate);
      let vehicle = await prisma.vehicle.findUnique({ where: { plate: normalizedPlate } });
      if (!vehicle) vehicle = await prisma.vehicle.create({ data: { plate: normalizedPlate, type: vehicleType || 'CAR' } });

      const ticketCode = `RES-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const ticket = await prisma.$transaction(async (tx) => {
        const created = await tx.ticket.create({
          data: {
            ticketCode,
            vehicleId: vehicle.id,
            spaceId,
            parkingLotId: parkingLot.id,
            operatorId: tokenUser.userId,
            status: 'ACTIVE',
          },
        });
        await setSpaceStatusWithHistory(tx, { spaceId, toStatus: 'RESERVED', reason: 'Reserva creada' });
        return created;
      });
      await createAuditLog(tokenUser.userId, 'CREATE_BOOKING', 'Ticket', ticket.id, { plate: normalizedPlate, arriveTime, exitTime });
      return NextResponse.json(ticket);
    }
    if (resource === 'entry') {
      const { plate, vehicleType, spaceId } = body;

      const normalizedPlate = normalizePlate(plate);
      let vehicle = await prisma.vehicle.findUnique({ where: { plate: normalizedPlate } });
      if (!vehicle) {
        vehicle = await prisma.vehicle.create({
          data: { plate: normalizedPlate, type: vehicleType || 'CAR' },
        });
      }

      if (vehicle.isBlacklisted) {
        return NextResponse.json({ error: 'Vehículo en lista negra: ' + vehicle.blacklistReason }, { status: 403 });
      }

      const parkingLotId = contextLotId;
      const parkingLot = parkingLotId ? await prisma.parkingLot.findUnique({ where: { id: parkingLotId } }) : null;
      if (!parkingLot) return NextResponse.json({ error: 'No hay parqueadero configurado' }, { status: 400 });

      const ownerId = vehicle.ownerId ?? null;

      const assignedSpaceForOwner = ownerId
        ? await prisma.space.findFirst({ where: { assignedUserId: ownerId, zone: { parkingLotId: parkingLot.id } }, select: { id: true, status: true } })
        : null;

      const effectiveSpaceId: string | null = assignedSpaceForOwner?.id ?? spaceId ?? null;
      if (!effectiveSpaceId) return NextResponse.json({ error: 'spaceId requerido' }, { status: 400 });

      const space = await prisma.space.findUnique({
        where: { id: effectiveSpaceId },
        select: {
          id: true,
          status: true,
          assignedUser: { select: { id: true, firstName: true, lastName: true } },
          zone: { select: { parkingLotId: true } },
        },
      });
      if (!space) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 });
      if (space.zone.parkingLotId !== parkingLot.id) {
        return NextResponse.json({ error: 'El espacio no pertenece a esta sede' }, { status: 403 });
      }

      if (space.assignedUser) {
        if (!ownerId || space.assignedUser.id !== ownerId) {
          return NextResponse.json({ error: 'Espacio asignado a otro usuario' }, { status: 403 });
        }
      }

      if (space.status === 'OCCUPIED') {
        return NextResponse.json({ error: 'El espacio está ocupado' }, { status: 400 });
      }
      if (space.status === 'OUT_OF_SERVICE' || space.status === 'MAINTENANCE') {
        return NextResponse.json({ error: 'El espacio no está disponible' }, { status: 400 });
      }

      const subscriptionEntry = await tryHandleSubscriptionEntry({
        vehicleId: vehicle.id,
        parkingLotId: parkingLot.id,
        requestedSpaceId: effectiveSpaceId,
        assignedSpaceId: assignedSpaceForOwner?.id ?? null,
        reason: `Entrada por suscripción (${normalizedPlate})`,
      }).catch((err) => {
        console.error('Subscription entry error:', err);
        return { handled: false } as const;
      });

      if (subscriptionEntry.handled) {
        await createAuditLog(tokenUser.userId, 'SUBSCRIPTION_ENTRY', 'Subscription', subscriptionEntry.subscriptionId, {
          vehicleId: vehicle.id,
          parkingLotId: parkingLot.id,
          spaceId: subscriptionEntry.spaceId,
        });

        return NextResponse.json({
          status: 'ok',
          mode: 'subscription',
          subscriptionId: subscriptionEntry.subscriptionId,
          logId: subscriptionEntry.logId,
          spaceId: subscriptionEntry.spaceId,
        });
      }

      const ticketCode = `PKG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const ticket = await prisma.$transaction(async (tx) => {
        const created = await tx.ticket.create({
          data: {
            ticketCode,
            vehicleId: vehicle.id,
            spaceId: effectiveSpaceId,
            parkingLotId: parkingLot.id,
            operatorId: tokenUser.userId,
          },
          include: { vehicle: true, space: { include: { zone: true } } },
        });

        await setSpaceStatusWithHistory(tx, { spaceId: effectiveSpaceId, toStatus: 'OCCUPIED', reason: `Entrada ${normalizedPlate}` });
        return created;
      });

      await createAuditLog(tokenUser.userId, 'CREATE_ENTRY', 'Ticket', ticket.id, { plate: normalizedPlate, spaceId });
      
      const { dispatchWebhook } = await import('@/lib/webhooks');
      void dispatchWebhook(ticket.parkingLotId, 'ticket.created', {
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        plate: ticket.vehicle.plate,
        space: ticket.space.number,
      });

      return NextResponse.json(ticket);
    }

    // Register vehicle exit
    if (resource === 'exit') {
      const { ticketId, paymentMethod, cashReceived, lostTicket } = body;

      const rawPaymentMethod = String(paymentMethod || 'CASH').trim().toUpperCase();
      const normalizedPaymentMethod: PaymentMethod = Object.values(PaymentMethod).includes(rawPaymentMethod as PaymentMethod)
        ? (rawPaymentMethod as PaymentMethod)
        : 'CASH';
      if (paymentMethod && normalizedPaymentMethod !== rawPaymentMethod) {
        return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
      }

      const normalizedCashReceived = typeof cashReceived === 'number' && Number.isFinite(cashReceived)
        ? cashReceived
        : null;
      if (normalizedPaymentMethod === 'CASH' && cashReceived != null && normalizedCashReceived == null) {
        return NextResponse.json({ error: 'cashReceived debe ser un número válido' }, { status: 400 });
      }

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { vehicle: true, space: { include: { zone: true } } } });

      if (!ticket || ticket.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Ticket no encontrado o ya procesado' }, { status: 400 });
      }

      if (tokenUser.role !== 'SUPER_ADMIN' && contextLotId && ticket.parkingLotId !== contextLotId) {
        return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
      }

      const quoted = await quoteTicketExit({ ticketId: ticket.id, lostTicket: Boolean(lostTicket) });

      if (normalizedPaymentMethod === 'CASH' && normalizedCashReceived != null && normalizedCashReceived < quoted.totalAmount) {
        return NextResponse.json({ error: 'Efectivo insuficiente para cubrir el total' }, { status: 400 });
      }

      // Digital methods can use Stripe checkout when configured.
      if ((normalizedPaymentMethod === 'CARD' || normalizedPaymentMethod === 'DIGITAL_WALLET') && isStripeEnabled()) {
        const stripe = getStripeClient();
        if (!stripe) {
          return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const shiftId = (await prisma.shift.findFirst({ where: { operatorId: tokenUser.userId, status: 'OPEN' }, select: { id: true } }))?.id || null;

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          success_url: `${appUrl}/dashboard/tickets?stripe=success&ticketId=${ticket.id}`,
          cancel_url: `${appUrl}/dashboard/tickets?stripe=cancel&ticketId=${ticket.id}`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'cop',
                product_data: {
                  name: `Salida ticket ${ticket.ticketCode}`,
                  description: `${ticket.vehicle.plate} · ${ticket.space.zone.name} · ${ticket.space.number}`,
                },
                unit_amount: toStripeAmount(quoted.totalAmount, 'cop'),
              },
            },
          ],
          metadata: {
            ticketId: ticket.id,
            operatorId: tokenUser.userId,
            paymentMethod: normalizedPaymentMethod,
            lostTicket: lostTicket ? 'true' : 'false',
            shiftId: shiftId || '',
          },
        });

        await prisma.payment.upsert({
          where: { ticketId: ticket.id },
          update: {
            amount: quoted.totalAmount,
            method: normalizedPaymentMethod,
            status: 'PENDING',
            reference: session.id,
            operatorId: tokenUser.userId,
            shiftId,
            parkingLotId: ticket.parkingLotId,
          },
          create: {
            amount: quoted.totalAmount,
            method: normalizedPaymentMethod,
            status: 'PENDING',
            reference: session.id,
            ticketId: ticket.id,
            parkingLotId: ticket.parkingLotId,
            operatorId: tokenUser.userId,
            shiftId,
            invoiceNumber: `PENDING-${Date.now()}`,
          },
        });

        await createAuditLog(tokenUser.userId, 'START_STRIPE_CHECKOUT', 'Ticket', ticket.id, {
          paymentMethod: normalizedPaymentMethod,
          amount: quoted.totalAmount,
          sessionId: session.id,
        });

        return NextResponse.json({
          requiresPayment: true,
          checkoutUrl: session.url,
          sessionId: session.id,
          amount: quoted.totalAmount,
        });
      }

      const result = await finalizeTicketExit({
        ticketId: ticket.id,
        paymentMethod: normalizedPaymentMethod,
        operatorId: tokenUser.userId,
        cashReceived: normalizedCashReceived,
        lostTicket: Boolean(lostTicket),
        invoiceNumber: `INV-${Date.now()}`,
      });

      await createAuditLog(tokenUser.userId, lostTicket ? 'EXIT_LOST_TICKET' : 'EXIT_TICKET', 'Ticket', ticket.id, {
        plate: ticket.vehicle.plate,
        paymentMethod: normalizedPaymentMethod,
        amount: result.payment.amount,
      });

      return NextResponse.json({
        ticket: result.ticket,
        payment: result.payment,
        pricing: result.pricing,
      });
    }

    // Open shift
    if (resource === 'open-shift') {
      const { initialCash } = body;
      const parkingLotId = contextLotId;
      const parkingLot = parkingLotId ? await prisma.parkingLot.findUnique({ where: { id: parkingLotId } }) : null;
      if (!parkingLot) return NextResponse.json({ error: 'No hay parqueadero configurado' }, { status: 400 });

      const existingShift = await prisma.shift.findFirst({
        where: { operatorId: tokenUser.userId, status: 'OPEN' },
      });
      if (existingShift) {
        return NextResponse.json({ error: 'Ya tienes un turno abierto' }, { status: 400 });
      }

      const shift = await prisma.shift.create({
        data: {
          operatorId: tokenUser.userId,
          parkingLotId: parkingLot.id,
          initialCash: initialCash || 0,
        },
        include: { operator: { select: { firstName: true, lastName: true } } },
      });

      await createAuditLog(tokenUser.userId, 'OPEN_SHIFT', 'Shift', shift.id, { initialCash: initialCash || 0 });

      return NextResponse.json(shift);
    }

    // Close shift
    if (resource === 'close-shift') {
      const { shiftId: rawShiftId, actualTotal, notes } = body;

      const shiftId = rawShiftId || (await prisma.shift.findFirst({ where: { operatorId: tokenUser.userId, status: 'OPEN' }, select: { id: true } }))?.id;
      if (!shiftId) return NextResponse.json({ error: 'No hay turno abierto para cerrar' }, { status: 400 });
      if (typeof actualTotal !== 'number' || !Number.isFinite(actualTotal)) {
        return NextResponse.json({ error: 'actualTotal es requerido (número)' }, { status: 400 });
      }

      const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!existing) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
      if (tokenUser.role !== 'SUPER_ADMIN' && contextLotId && existing.parkingLotId !== contextLotId) {
        return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
      }
      if (tokenUser.role === 'OPERATOR' && existing.operatorId !== tokenUser.userId) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      const diff = actualTotal - (existing.expectedTotal || 0);
      const shift = await prisma.shift.update({
        where: { id: shiftId },
        data: {
          status: 'CLOSED',
          endTime: new Date(),
          actualTotal,
          difference: diff,
          notes: notes || null,
        },
        include: {
          operator: { select: { firstName: true, lastName: true, email: true, phone: true } },
          parkingLot: { select: { name: true } },
        },
      });

      await createAuditLog(tokenUser.userId, 'CLOSE_SHIFT', 'Shift', shiftId, { actualTotal, difference: diff, notes });

      if (shift.operator?.email) {
        const expected = existing.expectedTotal || 0;
        const summaryText = [
          `Hola ${shift.operator.firstName},`,
          '',
          `Cerraste tu turno en ${shift.parkingLot?.name || 'ParkingOS'}.`,
          `Total esperado: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(expected)}.`,
          `Total reportado: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(actualTotal)}.`,
          `Diferencia: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(diff)}.`,
          notes ? `Notas: ${notes}` : '',
        ].filter(Boolean).join('\n');

        await sendTransactionalEmail({
          to: shift.operator.email,
          subject: `ParkingOS - Cierre de turno (${shift.parkingLot?.name || 'Sede'})`,
          text: summaryText,
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
              <h2 style="margin: 0 0 12px;">Cierre de turno registrado</h2>
              <p>Hola ${shift.operator.firstName},</p>
              <p>Cerraste tu turno en <strong>${shift.parkingLot?.name || 'ParkingOS'}</strong>.</p>
              <ul>
                <li>Total esperado: <strong>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(expected)}</strong></li>
                <li>Total reportado: <strong>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(actualTotal)}</strong></li>
                <li>Diferencia: <strong>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(diff)}</strong></li>
              </ul>
              ${notes ? `<p>Notas: ${String(notes)}</p>` : ''}
            </div>
          `,
        }).catch(() => undefined);
      }

      if (shift.operator?.phone) {
        const expected = existing.expectedTotal || 0;
        const summarySms = [
          `ParkingOS ${shift.parkingLot?.name || ''}`.trim(),
          `Turno cerrado. Esperado: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(expected)}.`,
          `Reportado: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(actualTotal)}.`,
          `Diferencia: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(diff)}.`,
        ].join(' ');

        await sendTransactionalSms({
          to: shift.operator.phone,
          body: summarySms,
        }).catch(() => undefined);
      }

      const { dispatchWebhook } = await import('@/lib/webhooks');
      void dispatchWebhook(shift.parkingLotId, 'shift.closed', {
        shiftId: shift.id,
        operator: shift.operator?.firstName,
        expectedTotal: existing.expectedTotal || 0,
        actualTotal,
        difference: diff,
      });

      return NextResponse.json(shift);
    }

    // Create user
    if (resource === 'users') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '123456');
      const firstName = String(body.firstName || '').trim();
      const lastName = String(body.lastName || '').trim();
      const roleParam = String(body.role || 'OPERATOR').trim();
      const requestedRole: Role = Object.values(Role).includes(roleParam as Role) ? (roleParam as Role) : 'OPERATOR';
      const requestedAssignedLotId = body.assignedLotId ? String(body.assignedLotId) : null;

      if (!email || !firstName || !lastName) {
        return NextResponse.json({ error: 'Email, nombre y apellido son requeridos' }, { status: 400 });
      }

      // RBAC: ADMIN can create only operators (within their lot)
      if (tokenUser.role === 'ADMIN' && requestedRole !== 'OPERATOR') {
        return NextResponse.json({ error: 'Admin solo puede crear Operadores' }, { status: 403 });
      }
      if (tokenUser.role !== 'SUPER_ADMIN' && requestedRole === 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      const adminContextLotId = await resolveParkingLotIdForUser(tokenUser.userId, tokenUser.role);
      const assignedLotId = tokenUser.role === 'ADMIN'
        ? adminContextLotId
        : (requestedAssignedLotId || adminContextLotId);

      if ((requestedRole === 'OPERATOR' || requestedRole === 'ADMIN') && !assignedLotId) {
        return NextResponse.json({ error: 'Debe asignar una sede' }, { status: 400 });
      }

      // If SUPER_ADMIN specifies a lot, verify it exists
      if (tokenUser.role === 'SUPER_ADMIN' && assignedLotId) {
        const lot = await prisma.parkingLot.findUnique({ where: { id: assignedLotId }, select: { id: true } });
        if (!lot) return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const created = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role: requestedRole,
            assignedLotId: requestedRole === 'OPERATOR' ? assignedLotId : null,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            assignedLotId: true,
          },
        });

        if (requestedRole === 'ADMIN' && assignedLotId) {
          // Ensure admin owns only one lot: clear any previous assignment
          await tx.parkingLot.updateMany({ where: { adminId: newUser.id }, data: { adminId: null } });
          await tx.parkingLot.update({ where: { id: assignedLotId }, data: { adminId: newUser.id } });
        }

        return newUser;
      });

      await createAuditLog(tokenUser.userId, 'CREATE_USER', 'User', created.id, { email, role: requestedRole, assignedLotId });
      return NextResponse.json(created);
    }

    if (resource === 'subscriptions-maintenance') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      const report = await runSubscriptionsMaintenance();
      await createAuditLog(tokenUser.userId, 'RUN_SUBSCRIPTION_MAINTENANCE', 'Subscription', undefined, report);
      return NextResponse.json({ success: true, ...report });
    }

    // Create rate
    if (resource === 'rates') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      const parkingLotId = contextLotId;
      if (!parkingLotId) return NextResponse.json({ error: 'No hay sede asignada' }, { status: 400 });
      const rate = await prisma.rate.create({
        data: { ...body.data, parkingLotId }
      });
      await createAuditLog(tokenUser.userId, 'CREATE_RATE', 'Rate', rate.id, body.data);
      return NextResponse.json(rate);
    }

    // Create zone (and optional spaces)
    if (resource === 'zones') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      const parkingLotId = contextLotId;
      if (!parkingLotId) return NextResponse.json({ error: 'No hay sede asignada' }, { status: 400 });

      const name = String(body.data?.name || '').trim();
      const type = body.data?.type;
      const spacesCountRaw = body.data?.spacesCount;
      const floorRaw = body.data?.floor;
      const spacePrefixRaw = body.data?.spacePrefix;
      const spacesCount = typeof spacesCountRaw === 'number' ? spacesCountRaw : Number(spacesCountRaw || 0);
      const floor = typeof floorRaw === 'number' ? floorRaw : Number(floorRaw || 1);
      const spacePrefix = String(spacePrefixRaw || 'S').trim().toUpperCase();

      if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
      if (!type) return NextResponse.json({ error: 'Tipo requerido' }, { status: 400 });

      const result = await prisma.$transaction(async (tx) => {
        const zone = await tx.zone.create({
          data: { name, type, parkingLotId },
        });

        const count = Number.isFinite(spacesCount) ? Math.max(0, Math.floor(spacesCount)) : 0;
        const normalizedFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;

        if (count > 0) {
          const spaces = Array.from({ length: count }).map((_, idx) => ({
            number: `${spacePrefix}-${String(idx + 1).padStart(3, '0')}`,
            floor: normalizedFloor,
            zoneId: zone.id,
          }));
          await tx.space.createMany({ data: spaces });
          await tx.parkingLot.update({ where: { id: parkingLotId }, data: { totalSpaces: { increment: count } } });
        }

        const zoneWithCount = await tx.zone.findUnique({
          where: { id: zone.id },
          include: { _count: { select: { spaces: true } } },
        });
        return zoneWithCount ?? zone;
      });

      await createAuditLog(tokenUser.userId, 'CREATE_ZONE', 'Zone', result.id, { name, type, spacesCount, floor, parkingLotId });
      return NextResponse.json(result);
    }

    // Create parking lot (SUPER_ADMIN only)
    if (resource === 'lots') {
      if (tokenUser.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      const data = body.data || {};
      const name = String(data.name || '').trim();
      const address = String(data.address || '').trim();
      const city = String(data.city || '').trim();
      const phone = data.phone ? String(data.phone).trim() : null;
      const totalSpacesRaw = data.totalSpaces;
      const totalSpaces = typeof totalSpacesRaw === 'number' ? totalSpacesRaw : Number(totalSpacesRaw || 0);

      if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
      if (!address) return NextResponse.json({ error: 'Dirección requerida' }, { status: 400 });
      if (!city) return NextResponse.json({ error: 'Ciudad requerida' }, { status: 400 });

      const lot = await prisma.parkingLot.create({
        data: {
          name,
          address,
          city,
          phone,
          totalSpaces: Number.isFinite(totalSpaces) ? Math.max(0, Math.floor(totalSpaces)) : 0,
          openTime: data.openTime || '06:00',
          closeTime: data.closeTime || '22:00',
          is24Hours: Boolean(data.is24Hours),
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
          gracePeriod: typeof data.gracePeriod === 'number' ? data.gracePeriod : undefined,
          lostTicketFee: typeof data.lostTicketFee === 'number' ? data.lostTicketFee : undefined,
        },
      });

      await createAuditLog(tokenUser.userId, 'CREATE_PARKING_LOT', 'ParkingLot', lot.id, { name, city, totalSpaces: lot.totalSpaces });
      return NextResponse.json(lot);
    }

    // Create vehicle
    if (resource === 'vehicles') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      const data = (body.data && typeof body.data === 'object') ? (body.data as Record<string, unknown>) : (body as Record<string, unknown>);
      const plate = String(data.plate || '').trim().toUpperCase();
      const type = String(data.type || 'CAR').trim();
      const brand = data.brand ? String(data.brand).trim() : undefined;
      const model = data.model ? String(data.model).trim() : undefined;
      const color = data.color ? String(data.color).trim() : undefined;
      const isBlacklisted = Boolean(data.isBlacklisted);
      const blacklistReason = data.blacklistReason ? String(data.blacklistReason).trim() : undefined;

      if (!plate) return NextResponse.json({ error: 'Placa requerida' }, { status: 400 });
      if (plate.length < 4 || plate.length > 12) return NextResponse.json({ error: 'Placa inválida' }, { status: 400 });

      const allowedTypes = new Set(['CAR', 'MOTORCYCLE', 'VAN']);
      if (!allowedTypes.has(type)) return NextResponse.json({ error: 'Tipo de vehículo inválido' }, { status: 400 });

      const existing = await prisma.vehicle.findUnique({ where: { plate } });
      if (existing) return NextResponse.json({ error: 'Ya existe un vehículo con esa placa' }, { status: 409 });

      const created = await prisma.vehicle.create({
        data: {
          plate,
          type: type as never,
          brand,
          model,
          color,
          isBlacklisted,
          blacklistReason: isBlacklisted ? (blacklistReason || 'Bloqueado') : null,
        },
        include: { _count: { select: { tickets: true } } },
      });

      await createAuditLog(tokenUser.userId, 'CREATE_VEHICLE', 'Vehicle', created.id, { plate, type, brand, model, color, isBlacklisted });
      return NextResponse.json(created);
    }

    // Create subscription (monthly pass)
    if (resource === 'subscriptions') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      const data = (body.data && typeof body.data === 'object') ? (body.data as Record<string, unknown>) : (body as Record<string, unknown>);
      const customer = (data.customer && typeof data.customer === 'object') ? (data.customer as Record<string, unknown>) : {};
      const vehicleData = (data.vehicle && typeof data.vehicle === 'object') ? (data.vehicle as Record<string, unknown>) : {};

      const email = String(customer.email || '').trim().toLowerCase();
      const firstName = String(customer.firstName || '').trim();
      const lastName = String(customer.lastName || '').trim();
      const phone = customer.phone ? String(customer.phone).trim() : null;

      const plate = String(vehicleData.plate || '').trim().toUpperCase();
      const vehicleType = String(vehicleData.type || 'CAR').trim();
      const brand = vehicleData.brand ? String(vehicleData.brand).trim() : null;
      const color = vehicleData.color ? String(vehicleData.color).trim() : null;

      const startDateRaw = String(data.startDate || '').trim();
      const endDateRaw = String(data.endDate || '').trim();
      const price = Number(data.price);
      const subType = String(data.type || 'FIXED').trim();
      const autoRenew = Boolean(data.autoRenew);

      if (!email || !email.includes('@')) return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
      if (!firstName || !lastName) return NextResponse.json({ error: 'Nombre y apellido requeridos' }, { status: 400 });
      if (!plate) return NextResponse.json({ error: 'Placa requerida' }, { status: 400 });
      if (!startDateRaw || !endDateRaw) return NextResponse.json({ error: 'Fechas requeridas' }, { status: 400 });
      if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });
      if (!contextLotId) return NextResponse.json({ error: 'parkingLotId requerido para suscripciones' }, { status: 400 });

      const startDate = new Date(startDateRaw);
      const endDate = new Date(endDateRaw);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 });
      }
      if (endDate <= startDate) {
        return NextResponse.json({ error: 'La fecha fin debe ser posterior a la fecha inicio' }, { status: 400 });
      }

      const created = await prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findUnique({ where: { email } });
        const userId = existingUser?.id
          ? existingUser.id
          : (
              await tx.user.create({
                data: {
                  email,
                  password: await bcrypt.hash(Math.random().toString(36).slice(2) + Date.now().toString(36), 10),
                  firstName,
                  lastName,
                  phone: phone || undefined,
                  role: 'CUSTOMER',
                  isActive: true,
                },
              })
            ).id;

        const existingVehicle = await tx.vehicle.findUnique({ where: { plate } });
        const vehicleId = existingVehicle?.id
          ? existingVehicle.id
          : (
              await tx.vehicle.create({
                data: {
                  plate,
                  type: vehicleType as never,
                  brand: brand || undefined,
                  color: color || undefined,
                  ownerId: userId,
                },
              })
            ).id;

        // if the vehicle existed but had no owner, attach it
        if (existingVehicle && !existingVehicle.ownerId) {
          await tx.vehicle.update({ where: { id: vehicleId }, data: { ownerId: userId } });
        }

        const sub = await tx.subscription.create({
          data: {
            userId,
            vehicleId,
            parkingLotId: contextLotId,
            startDate,
            endDate,
            price,
            type: subType as never,
            autoRenew,
            status: 'ACTIVE',
          },
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            vehicle: { select: { plate: true, type: true, brand: true } },
          },
        });

        const createdNotification = await tx.notification.create({
          data: {
            userId,
            title: 'Suscripción creada',
            message: `Tu suscripción para ${plate} está activa hasta ${endDate.toISOString().slice(0, 10)}.`,
            type: 'info',
          },
        }).catch(() => undefined);

        return { sub, createdNotification, userId };
      });

      if (created.createdNotification?.id) {
        emitNotificationEvent({
          userId: created.userId,
          action: 'created',
          notificationId: created.createdNotification.id,
          at: new Date().toISOString(),
        });
      }

      await createAuditLog(tokenUser.userId, 'CREATE_SUBSCRIPTION', 'Subscription', created.sub.id, { email, plate, startDate, endDate, price, type: subType, autoRenew });
      return NextResponse.json(created.sub);
    }

    // Create conversation
    if (resource === 'conversations') {
      if (!contextLotId) return NextResponse.json({ error: 'No hay sede asignada' }, { status: 400 });

      const title = String(body.data?.title || body.title || 'Conversación').trim();
      const rawParticipantIds: unknown = body.data?.participantIds ?? body.participantIds;
      const participantIds = Array.isArray(rawParticipantIds)
        ? rawParticipantIds.map((x) => String(x)).filter(Boolean)
        : [];

      const allParticipantIds = Array.from(new Set([tokenUser.userId, ...participantIds]));
      if (allParticipantIds.length < 2) {
        return NextResponse.json({ error: 'Debes seleccionar al menos un participante' }, { status: 400 });
      }

      // Ensure participants belong to same lot (unless SUPER_ADMIN)
      const users = await prisma.user.findMany({
        where: { id: { in: allParticipantIds } },
        select: { id: true, role: true, assignedLotId: true, parkingLot: { select: { id: true } } },
      });
      if (users.length !== allParticipantIds.length) {
        return NextResponse.json({ error: 'Participantes inválidos' }, { status: 400 });
      }

      if (tokenUser.role !== 'SUPER_ADMIN') {
        const bad = users.find((u) => {
          const lot = u.parkingLot?.id ?? u.assignedLotId ?? null;
          return lot !== contextLotId;
        });
        if (bad) return NextResponse.json({ error: 'Participantes fuera de la sede' }, { status: 403 });
      }

      const convo = await prisma.conversation.create({
        data: {
          title,
          parkingLotId: contextLotId,
          participants: {
            create: allParticipantIds.map((uid) => ({
              userId: uid,
              lastReadAt: uid === tokenUser.userId ? new Date() : null,
            })),
          },
        },
        include: {
          participants: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        },
      });

      await createAuditLog(tokenUser.userId, 'CREATE_CONVERSATION', 'Conversation', convo.id, { parkingLotId: contextLotId, participantIds: allParticipantIds });
      return NextResponse.json(convo);
    }

    // Send message
    if (resource === 'messages') {
      const conversationId = String(body.data?.conversationId || body.conversationId || '').trim();
      const messageBody = String(body.data?.body || body.body || '').trim();
      if (!conversationId) return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 });
      if (!messageBody) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
      if (!contextLotId) return NextResponse.json({ error: 'No hay sede asignada' }, { status: 400 });

      const membership = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: tokenUser.userId } },
        include: { conversation: { select: { id: true, parkingLotId: true } } },
      });
      if (!membership) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      if (membership.conversation.parkingLotId !== contextLotId) {
        return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
      }

      const msg = await prisma.message.create({
        data: {
          conversationId,
          senderId: tokenUser.userId,
          body: messageBody,
        },
        include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Mark sender as read up to now
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: tokenUser.userId } },
        data: { lastReadAt: new Date() },
      });

      await createAuditLog(tokenUser.userId, 'SEND_MESSAGE', 'Conversation', conversationId, { length: messageBody.length });
      return NextResponse.json(msg);
    }

    if (resource === 'webhook-endpoints') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      if (!contextLotId) return NextResponse.json({ error: 'Falta sede' }, { status: 400 });

      const { name, url, secret, events } = body;
      const created = await prisma.webhookEndpoint.create({
        data: {
          name,
          url,
          secret,
          events: events || '*',
          isActive: true,
          parkingLotId: contextLotId,
        }
      });
      await createAuditLog(tokenUser.userId, 'CREATE_WEBHOOK', 'WebhookEndpoint', created.id, { url });
      return NextResponse.json(created);
    }

    return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT - Update resources
export async function PUT(request: NextRequest) {
  try {
    const tokenUser = getUserFromRequest(request);
    if (!tokenUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const { resource, id, data } = body;

    const requestedLotId: string | null = body.parkingLotId ?? body.data?.parkingLotId ?? null;
    const contextLotId = await resolveParkingLotIdForUser(tokenUser.userId, tokenUser.role, requestedLotId);
    if (requestedLotId && !contextLotId) {
      return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
    }

    // Notifications: user-scoped updates (all roles)
    if (resource === 'notifications') {
      // Individual update
      if (id) {
        const note = await prisma.notification.update({
          where: { id, userId: tokenUser.userId },
          data: { isRead: data.isRead },
        });

        emitNotificationEvent({
          userId: tokenUser.userId,
          action: 'updated',
          notificationId: note.id,
          at: new Date().toISOString(),
        });

        return NextResponse.json(note);
      }

      // Bulk actions
      if (data?.action === 'markAllRead') {
        const result = await prisma.notification.updateMany({
          where: { userId: tokenUser.userId, isRead: false },
          data: { isRead: true },
        });

        if (result.count > 0) {
          emitNotificationEvent({
            userId: tokenUser.userId,
            action: 'updated',
            at: new Date().toISOString(),
          });
        }

        return NextResponse.json({ success: true, updated: result.count });
      }

      return NextResponse.json({ error: 'ID o acción requerida' }, { status: 400 });
    }

    if (resource === 'profile') {
      const firstName = String(data?.firstName || '').trim();
      const lastName = String(data?.lastName || '').trim();
      const phone = data?.phone ? String(data.phone).trim() : null;
      const currentPassword = data?.currentPassword ? String(data.currentPassword) : null;
      const newPassword = data?.newPassword ? String(data.newPassword) : null;

      if (!firstName || !lastName) {
        return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 });
      }

      const me = await prisma.user.findUnique({ where: { id: tokenUser.userId } });
      if (!me) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

      let nextPasswordHash: string | undefined;
      if (newPassword) {
        if (newPassword.length < 8) {
          return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 });
        }
        if (!currentPassword) {
          return NextResponse.json({ error: 'Debes confirmar tu contraseña actual' }, { status: 400 });
        }
        const matches = await bcrypt.compare(currentPassword, me.password);
        if (!matches) {
          return NextResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 400 });
        }
        nextPasswordHash = await bcrypt.hash(newPassword, 10);
      }

      const updated = await prisma.user.update({
        where: { id: tokenUser.userId },
        data: {
          firstName,
          lastName,
          phone,
          ...(nextPasswordHash ? { password: nextPasswordHash } : {}),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
        },
      });

      await createAuditLog(tokenUser.userId, 'UPDATE_PROFILE', 'User', tokenUser.userId, {
        firstName,
        lastName,
        phone,
        passwordChanged: Boolean(nextPasswordHash),
      });

      return NextResponse.json({ success: true, user: updated });
    }

    // Update subscription (cancel / renew / edit)
    if (resource === 'subscriptions') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

      const nextStatus = data.status ? String(data.status) : undefined;
      const nextType = data.type ? String(data.type) : undefined;
      const nextAutoRenew = typeof data.autoRenew === 'boolean' ? data.autoRenew : undefined;
      const nextPrice = typeof data.price === 'number' ? data.price : undefined;
      const nextStartDate = data.startDate ? new Date(String(data.startDate)) : undefined;
      const nextEndDate = data.endDate ? new Date(String(data.endDate)) : undefined;
      if (nextStartDate && Number.isNaN(nextStartDate.getTime())) return NextResponse.json({ error: 'startDate inválida' }, { status: 400 });
      if (nextEndDate && Number.isNaN(nextEndDate.getTime())) return NextResponse.json({ error: 'endDate inválida' }, { status: 400 });

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: nextStatus as never,
          type: nextType as never,
          autoRenew: nextAutoRenew,
          price: nextPrice,
          startDate: nextStartDate,
          endDate: nextEndDate,
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          vehicle: { select: { plate: true, type: true, brand: true } },
        },
      });

      await createAuditLog(tokenUser.userId, 'UPDATE_SUBSCRIPTION', 'Subscription', id, data);
      return NextResponse.json(updated);
    }

    // Mark conversation as read (all roles)
    if (resource === 'conversation-read') {
      const conversationId = String(body.data?.conversationId || body.conversationId || '').trim();
      if (!conversationId) return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 });

      const membership = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: tokenUser.userId } },
        include: { conversation: { select: { id: true, parkingLotId: true } } },
      });
      if (!membership) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

      const requestedLotId: string | null = body.parkingLotId ?? body.data?.parkingLotId ?? null;
      const contextLotId = await resolveParkingLotIdForUser(tokenUser.userId, tokenUser.role, requestedLotId);
      if (requestedLotId && !contextLotId) {
        return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
      }
      if (contextLotId && membership.conversation.parkingLotId !== contextLotId) {
        return NextResponse.json({ error: 'No autorizado para esta sede' }, { status: 403 });
      }

      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: tokenUser.userId } },
        data: { lastReadAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    // Extend Duration Logic (guarded; audit only)
    if (resource === 'extend') {
      const { ticketId, additionalHours } = body;
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

      await createAuditLog(tokenUser.userId, 'EXTEND_STAY', 'Ticket', ticketId, { additionalHours });
      return NextResponse.json({ success: true, message: 'Estancia extendida exitosamente' });
    }

    if (resource === 'users') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
      }
      if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

      const target = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          role: true,
          assignedLotId: true,
          parkingLot: { select: { id: true } },
        },
      });
      if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

      // ADMIN restrictions
      if (tokenUser.role === 'ADMIN') {
        if (target.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const adminLotId = await resolveParkingLotIdForUser(tokenUser.userId, tokenUser.role);
        const targetLotId = target.parkingLot?.id ?? target.assignedLotId ?? null;
        if (adminLotId && targetLotId && adminLotId !== targetLotId) {
          return NextResponse.json({ error: 'No autorizado para este usuario' }, { status: 403 });
        }

        // ADMIN can only update basic fields & active flag
        const updated = await prisma.user.update({
          where: { id },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            isActive: data.isActive,
          },
          select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, assignedLotId: true },
        });
        await createAuditLog(tokenUser.userId, 'UPDATE_USER', 'User', id, { adminLimited: true, data });
        return NextResponse.json(updated);
      }

      // SUPER_ADMIN full update (including assignedLotId)
      const nextRole = data.role;
      const requestedAssignedLotId = data.assignedLotId ? String(data.assignedLotId) : null;

      if (requestedAssignedLotId) {
        const lot = await prisma.parkingLot.findUnique({ where: { id: requestedAssignedLotId }, select: { id: true } });
        if (!lot) return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        // If demoting from ADMIN, clear admin assignment.
        if (target.role === 'ADMIN' && nextRole !== 'ADMIN') {
          await tx.parkingLot.updateMany({ where: { adminId: id }, data: { adminId: null } });
        }
        // If promoting to ADMIN, assign admin to requested lot.
        if (nextRole === 'ADMIN' && requestedAssignedLotId) {
          await tx.parkingLot.updateMany({ where: { adminId: id }, data: { adminId: null } });
          await tx.parkingLot.update({ where: { id: requestedAssignedLotId }, data: { adminId: id } });
        }

        const u = await tx.user.update({
          where: { id },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            role: nextRole,
            isActive: data.isActive,
            assignedLotId: nextRole === 'OPERATOR' ? requestedAssignedLotId : null,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            assignedLotId: true,
            assignedLot: { select: { id: true, name: true } },
            parkingLot: { select: { id: true, name: true } },
          },
        });
        return u;
      });

      await createAuditLog(tokenUser.userId, 'UPDATE_USER', 'User', id, data);
      return NextResponse.json(updated);
    }

    if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    if (resource === 'vehicles') {
      const vehicle = await prisma.vehicle.update({
        where: { id },
        data: {
          brand: data.brand,
          model: data.model,
          color: data.color,
          isBlacklisted: data.isBlacklisted,
          blacklistReason: data.blacklistReason,
        }
      });
      await createAuditLog(tokenUser.userId, 'UPDATE_VEHICLE', 'Vehicle', id, data);
      return NextResponse.json(vehicle);
    }

    if (resource === 'rates') {
      const rate = await prisma.rate.update({
        where: { id },
        data: {
          name: data.name,
          price: data.price,
          isActive: data.isActive,
        }
      });
      await createAuditLog(tokenUser.userId, 'UPDATE_RATE', 'Rate', id, data);
      return NextResponse.json(rate);
    }

    if (resource === 'parking-lot') {
      const parkingLotId = contextLotId;
      if (!parkingLotId) return NextResponse.json({ error: 'No hay sede asignada' }, { status: 400 });

      // ADMIN puede modificar su sede; SUPER_ADMIN puede modificar cualquier sede (por ahora: la del contexto)
      const updated = await prisma.parkingLot.update({
        where: { id: parkingLotId },
        data: {
          name: data.name,
          address: data.address,
          city: data.city,
          phone: data.phone,
          openTime: data.openTime,
          closeTime: data.closeTime,
          is24Hours: data.is24Hours,
          isActive: data.isActive,
          gracePeriod: typeof data.gracePeriod === 'number' ? data.gracePeriod : undefined,
          lostTicketFee: typeof data.lostTicketFee === 'number' ? data.lostTicketFee : undefined,
        },
      });
      await createAuditLog(tokenUser.userId, 'UPDATE_PARKING_LOT', 'ParkingLot', parkingLotId, data);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard PUT error:', error);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

// DELETE - Remove resources
export async function DELETE(request: NextRequest) {
  try {
    const tokenUser = getUserFromRequest(request);
    if (!tokenUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');
    const id = searchParams.get('id');

    // Notifications: allow per-user deletion for any role
    if (resource === 'notifications') {
      if (id) {
        const result = await prisma.notification.deleteMany({ where: { id, userId: tokenUser.userId } });

        if (result.count > 0) {
          emitNotificationEvent({
            userId: tokenUser.userId,
            action: 'deleted',
            notificationId: id,
            at: new Date().toISOString(),
          });
        }

        return NextResponse.json({ success: true, deleted: result.count });
      }
      const result = await prisma.notification.deleteMany({ where: { userId: tokenUser.userId } });

      if (result.count > 0) {
        emitNotificationEvent({
          userId: tokenUser.userId,
          action: 'deleted',
          at: new Date().toISOString(),
        });
      }

      return NextResponse.json({ success: true, deleted: result.count });
    }

    if (tokenUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Solo SuperAdmin puede eliminar registros físicos' }, { status: 403 });
    }

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if (resource === 'users') {
      await prisma.user.delete({ where: { id } });
      await createAuditLog(tokenUser.userId, 'DELETE_USER', 'User', id);
      return NextResponse.json({ success: true });
    }

    if (resource === 'vehicles') {
      await prisma.vehicle.delete({ where: { id } });
      await createAuditLog(tokenUser.userId, 'DELETE_VEHICLE', 'Vehicle', id);
      return NextResponse.json({ success: true });
    }
    
    if (resource === 'tickets') {
       await prisma.ticket.delete({ where: { id } });
       await createAuditLog(tokenUser.userId, 'DELETE_TICKET', 'Ticket', id);
       return NextResponse.json({ success: true });
    }

    if (resource === 'webhook-endpoints') {
       await prisma.webhookEndpoint.delete({ where: { id } });
       await createAuditLog(tokenUser.userId, 'DELETE_WEBHOOK', 'WebhookEndpoint', id);
       return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard DELETE error:', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
