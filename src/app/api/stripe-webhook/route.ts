import { NextRequest, NextResponse } from 'next/server';
import { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { finalizeTicketExit } from '@/lib/ticket-exit';
import { getStripeClient } from '@/lib/stripe';

function normalizePaymentMethod(raw: string | null | undefined): PaymentMethod {
  const candidate = String(raw || 'CARD').toUpperCase();
  if (candidate === 'DIGITAL_WALLET') return 'DIGITAL_WALLET';
  if (candidate === 'PREPAID') return 'PREPAID';
  if (candidate === 'MONTHLY') return 'MONTHLY';
  return 'CARD';
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook no configurado' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Firma faltante' }, { status: 400 });
  }

  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe signature validation failed:', err);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const ticketId = session.metadata?.ticketId;
      if (!ticketId) {
        return NextResponse.json({ received: true, skipped: 'missing-ticket-id' });
      }

      const existingPayment = await prisma.payment.findUnique({ where: { ticketId } });
      if (existingPayment?.status === 'COMPLETED') {
        return NextResponse.json({ received: true, skipped: 'already-completed' });
      }

      const method = normalizePaymentMethod(session.metadata?.paymentMethod || existingPayment?.method);
      const operatorId = session.metadata?.operatorId || existingPayment?.operatorId || null;
      const shiftId = session.metadata?.shiftId || existingPayment?.shiftId || null;
      const lostTicket = (session.metadata?.lostTicket || '').toLowerCase() === 'true';

      const result = await finalizeTicketExit({
        ticketId,
        paymentMethod: method,
        operatorId,
        shiftId,
        lostTicket,
        reference: session.id,
        invoiceNumber: existingPayment?.invoiceNumber?.startsWith('PENDING-')
          ? `INV-${Date.now()}`
          : existingPayment?.invoiceNumber || `INV-${Date.now()}`,
      });

      await prisma.auditLog.create({
        data: {
          userId: operatorId || result.payment.operatorId || 'system',
          action: 'STRIPE_CHECKOUT_COMPLETED',
          entity: 'Payment',
          entityId: result.payment.id,
          details: JSON.stringify({
            sessionId: session.id,
            ticketId,
            amount: result.payment.amount,
            paymentMethod: method,
          }),
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook processing error:', err);
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 });
  }
}
