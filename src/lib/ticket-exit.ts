import { prisma } from '@/lib/prisma';
import { calculateHourlyFractionalPricing } from '@/lib/pricing';
import { PaymentMethod, Prisma } from '@prisma/client';

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

export async function quoteTicketExit(args: { ticketId: string; lostTicket?: boolean }) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: args.ticketId },
    include: { vehicle: true, space: { include: { zone: true } } },
  });

  if (!ticket || ticket.status !== 'ACTIVE') {
    throw new Error('Ticket no encontrado o ya procesado');
  }

  const parkingLot = await prisma.parkingLot.findUnique({ where: { id: ticket.parkingLotId } });
  if (!parkingLot) throw new Error('Sede no encontrada');

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

  const totalAmount = args.lostTicket ? parkingLot.lostTicketFee : pricing.amount;

  return {
    now,
    ticket,
    parkingLot,
    pricing,
    totalAmount,
    hourlyRate,
  };
}

export async function finalizeTicketExit(args: {
  ticketId: string;
  paymentMethod: PaymentMethod;
  operatorId?: string | null;
  cashReceived?: number | null;
  lostTicket?: boolean;
  reference?: string | null;
  shiftId?: string | null;
  invoiceNumber?: string | null;
}) {
  const quoted = await quoteTicketExit({ ticketId: args.ticketId, lostTicket: args.lostTicket });
  const { ticket, now, pricing, totalAmount } = quoted;

  const normalizedCash = typeof args.cashReceived === 'number' && Number.isFinite(args.cashReceived) ? args.cashReceived : null;
  if (args.paymentMethod === 'CASH' && normalizedCash != null && normalizedCash < totalAmount) {
    throw new Error('Efectivo insuficiente para cubrir el total');
  }

  const changeGiven = args.paymentMethod === 'CASH' && normalizedCash != null ? normalizedCash - totalAmount : 0;

  const shiftId = args.shiftId ?? (args.operatorId
    ? (await prisma.shift.findFirst({ where: { operatorId: args.operatorId, status: 'OPEN' }, select: { id: true } }))?.id ?? null
    : null);

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.upsert({
      where: { ticketId: ticket.id },
      update: {
        amount: totalAmount,
        method: args.paymentMethod,
        status: 'COMPLETED',
        reference: args.reference || undefined,
        cashReceived: args.paymentMethod === 'CASH' ? normalizedCash : null,
        changeGiven: changeGiven > 0 ? changeGiven : null,
        invoiceNumber: args.invoiceNumber || undefined,
        operatorId: args.operatorId || undefined,
        shiftId: shiftId || null,
      },
      create: {
        amount: totalAmount,
        method: args.paymentMethod,
        status: 'COMPLETED',
        reference: args.reference || undefined,
        cashReceived: args.paymentMethod === 'CASH' ? normalizedCash : null,
        changeGiven: changeGiven > 0 ? changeGiven : null,
        invoiceNumber: args.invoiceNumber || `INV-${Date.now()}`,
        ticketId: ticket.id,
        parkingLotId: ticket.parkingLotId,
        operatorId: args.operatorId || undefined,
        shiftId: shiftId || null,
      },
    });

    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: args.lostTicket ? 'LOST' : 'COMPLETED',
        exitTime: now,
        totalHours: Math.round(pricing.totalHours * 100) / 100,
        totalAmount,
      },
    });

    await setSpaceStatusWithHistory(tx, {
      spaceId: ticket.spaceId,
      toStatus: 'AVAILABLE',
      reason: args.lostTicket ? 'Salida por ticket perdido' : 'Salida completada',
    });

    if (shiftId) {
      const cashAdd = args.paymentMethod === 'CASH' ? totalAmount : 0;
      const cardAdd = args.paymentMethod === 'CARD' ? totalAmount : 0;
      const digitalAdd = args.paymentMethod === 'DIGITAL_WALLET' ? totalAmount : 0;
      await tx.shift.update({
        where: { id: shiftId },
        data: {
          totalCash: { increment: cashAdd },
          totalCard: { increment: cardAdd },
          totalDigital: { increment: digitalAdd },
          expectedTotal: { increment: totalAmount },
          vehiclesServed: { increment: 1 },
        },
      });
    }

    return payment;
  });

  const finalTicket = {
    ...ticket,
    exitTime: now,
    totalHours: pricing.totalHours,
    totalAmount,
    status: args.lostTicket ? 'LOST' : 'COMPLETED' as const,
  };

  const { dispatchWebhook } = await import('@/lib/webhooks');
  void dispatchWebhook(ticket.parkingLotId, 'payment.completed', {
    ticketId: ticket.id,
    ticketCode: ticket.ticketCode,
    amount: totalAmount,
    method: args.paymentMethod,
    invoiceNumber: result.invoiceNumber
  });

  return {
    ticket: finalTicket,
    payment: result,
    pricing,
  };
}
