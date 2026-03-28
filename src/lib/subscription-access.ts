import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type SpaceTransitionStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

type SubscriptionEntryResult =
  | { handled: true; subscriptionId: string; logId: string; spaceId: string | null }
  | { handled: false };

type SubscriptionEntryParams = {
  vehicleId: string;
  parkingLotId: string;
  requestedSpaceId?: string | null;
  reason?: string;
};

async function setSpaceStatusWithHistory(
  tx: Prisma.TransactionClient,
  params: { spaceId: string; toStatus: SpaceTransitionStatus; reason?: string }
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

export async function findActiveSubscriptionForVehicle(vehicleId: string, parkingLotId: string) {
  const now = new Date();
  return prisma.subscription.findFirst({
    where: {
      vehicleId,
      parkingLotId,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: { space: true },
  });
}

export async function tryHandleSubscriptionEntry(params: SubscriptionEntryParams): Promise<SubscriptionEntryResult> {
  const subscription = await findActiveSubscriptionForVehicle(params.vehicleId, params.parkingLotId);
  if (!subscription) return { handled: false };

  // Prefer fixed assigned space from subscription; otherwise use requested space (if any)
  const targetSpaceId = subscription.spaceId ?? params.requestedSpaceId ?? null;

  const { logId, resolvedSpaceId } = await prisma.$transaction(async (tx) => {
    let resolvedSpaceId = targetSpaceId;
    if (resolvedSpaceId) {
      const space = await tx.space.findUnique({
        where: { id: resolvedSpaceId },
        select: { id: true, zone: { select: { parkingLotId: true } } },
      });
      if (!space || space.zone.parkingLotId !== params.parkingLotId) {
        throw new Error('El espacio no pertenece a la sede de la suscripción');
      }

      const toStatus: SpaceTransitionStatus = subscription.spaceId ? 'RESERVED' : 'OCCUPIED';
      await setSpaceStatusWithHistory(tx, {
        spaceId: resolvedSpaceId,
        toStatus,
        reason: params.reason || `Entrada suscripción ${subscription.id}`,
      });
    }

    const log = await tx.subscriptionAccessLog.create({
      data: {
        subscriptionId: subscription.id,
        vehicleId: params.vehicleId,
        parkingLotId: params.parkingLotId,
        spaceId: resolvedSpaceId,
        note: params.reason || null,
      },
      select: { id: true },
    });

    return { logId: log.id, resolvedSpaceId };
  });

  return {
    handled: true,
    subscriptionId: subscription.id,
    logId,
    spaceId: resolvedSpaceId,
  };
}
