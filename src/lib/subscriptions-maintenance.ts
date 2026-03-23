import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email';

type SubscriptionUser = { id: string; firstName: string; email: string };
type SubscriptionVehicle = { plate: string };

type SubscriptionWithRelations = {
  id: string;
  startDate: Date;
  endDate: Date;
  user: SubscriptionUser;
  vehicle: SubscriptionVehicle;
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

async function notifyPendingRenewal(sub: SubscriptionWithRelations) {
  const dueDate = sub.endDate.toLocaleDateString('es-CO');
  const message = `Tu suscripcion para ${sub.vehicle.plate} vence el ${dueDate}.`;

  await createDedupedNotification({
    userId: sub.user.id,
    title: 'Suscripcion por renovar',
    message,
    type: 'warning',
  }).catch(() => undefined);

  await sendTransactionalEmail({
    to: sub.user.email,
    subject: 'ParkingOS - Suscripcion por renovar',
    text: [
      `Hola ${sub.user.firstName},`,
      '',
      message,
      'Puedes renovar desde el panel de ParkingOS.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2 style="margin: 0 0 12px;">Suscripcion por renovar</h2>
        <p>Hola ${sub.user.firstName},</p>
        <p>${message}</p>
        <p>Puedes renovar desde el panel de ParkingOS.</p>
      </div>
    `,
  }).catch(() => undefined);
}

async function notifyAutoRenewed(sub: SubscriptionWithRelations, nextEnd: Date) {
  const nextEndLabel = nextEnd.toLocaleDateString('es-CO');
  const message = `Renovamos tu suscripcion de ${sub.vehicle.plate} hasta ${nextEndLabel}.`;

  await createDedupedNotification({
    userId: sub.user.id,
    title: 'Suscripcion renovada automaticamente',
    message,
    type: 'info',
  }).catch(() => undefined);

  await sendTransactionalEmail({
    to: sub.user.email,
    subject: 'ParkingOS - Suscripcion renovada',
    text: [
      `Hola ${sub.user.firstName},`,
      '',
      message,
      'No se requiere ninguna accion adicional.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2 style="margin: 0 0 12px;">Suscripcion renovada</h2>
        <p>Hola ${sub.user.firstName},</p>
        <p>${message}</p>
        <p>No se requiere ninguna accion adicional.</p>
      </div>
    `,
  }).catch(() => undefined);
}

export async function runSubscriptionsMaintenance() {
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
      user: { select: { id: true, firstName: true, email: true } },
      vehicle: { select: { plate: true } },
    },
    take: 500,
  });

  for (const sub of pendingCandidates) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PENDING_RENEWAL' } });
    await notifyPendingRenewal(sub as SubscriptionWithRelations);
  }

  const dueForAutoRenew = await prisma.subscription.findMany({
    where: {
      autoRenew: true,
      status: { in: ['ACTIVE', 'PENDING_RENEWAL'] },
      endDate: { lte: now },
    },
    include: {
      user: { select: { id: true, firstName: true, email: true } },
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

    await notifyAutoRenewed(sub as SubscriptionWithRelations, nextEnd);
  }

  return {
    processedAt: now.toISOString(),
    expired: expiredResult.count,
    pendingRenewal: pendingCandidates.length,
    autoRenewed: renewedCount,
  };
}
