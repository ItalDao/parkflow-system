import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type MaintenanceReport = {
  processedAt: string;
  expired: number;
  pendingRenewal: number;
  autoRenewed: number;
};

async function createDedupedNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: string;
  dedupeHours?: number;
}) {
  const dedupeHours = Number.isFinite(params.dedupeHours) ? Number(params.dedupeHours) : 24;
  const since = new Date(Date.now() - dedupeHours * 60 * 60 * 1000);

  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      createdAt: { gte: since },
    },
    select: { id: true },
  });

  if (existing) return null;

  return prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
    },
  });
}

async function runSubscriptionsMaintenance(): Promise<MaintenanceReport> {
  const now = new Date();
  const reminderLimit = new Date(now);
  reminderLimit.setDate(reminderLimit.getDate() + 7);

  const expiredResult = await prisma.subscription.updateMany({
    where: {
      endDate: { lt: now },
      status: { in: ['ACTIVE', 'PENDING_RENEWAL'] },
    },
    data: { status: 'EXPIRED' },
  });

  const pendingCandidates = await prisma.subscription.findMany({
    where: {
      autoRenew: false,
      status: 'ACTIVE',
      endDate: { gte: now, lte: reminderLimit },
    },
    include: {
      user: { select: { id: true } },
      vehicle: { select: { plate: true } },
    },
    take: 500,
  });

  for (const sub of pendingCandidates) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PENDING_RENEWAL' } });
    await createDedupedNotification({
      userId: sub.user.id,
      title: 'Suscripcion por renovar',
      message: `Tu suscripcion para ${sub.vehicle.plate} vence el ${sub.endDate.toLocaleDateString('es-CO')}.`,
      type: 'warning',
    }).catch(() => undefined);
  }

  const dueForAutoRenew = await prisma.subscription.findMany({
    where: {
      autoRenew: true,
      status: { in: ['ACTIVE', 'PENDING_RENEWAL'] },
      endDate: { lte: now },
    },
    include: {
      user: { select: { id: true } },
      vehicle: { select: { plate: true } },
    },
    take: 500,
  });

  let renewedCount = 0;
  for (const sub of dueForAutoRenew) {
    const durationMs = Math.max(24 * 60 * 60 * 1000, sub.endDate.getTime() - sub.startDate.getTime());
    const nextStart = new Date(sub.endDate);
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        startDate: nextStart,
        endDate: nextEnd,
        status: 'ACTIVE',
      },
    });
    renewedCount += 1;

    await createDedupedNotification({
      userId: sub.user.id,
      title: 'Suscripcion renovada automaticamente',
      message: `Renovamos tu suscripcion de ${sub.vehicle.plate} hasta ${nextEnd.toLocaleDateString('es-CO')}.`,
      type: 'info',
    }).catch(() => undefined);
  }

  return {
    processedAt: now.toISOString(),
    expired: expiredResult.count,
    pendingRenewal: pendingCandidates.length,
    autoRenewed: renewedCount,
  };
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
    }

    const provided = request.headers.get('x-cron-secret');
    if (!provided || provided !== expectedSecret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const report = await runSubscriptionsMaintenance();
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error('Cron subscriptions error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
