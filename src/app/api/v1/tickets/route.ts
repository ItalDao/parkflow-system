import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasApiScope } from '@/lib/api-keys';

function readRawApiKey(request: NextRequest) {
  const xApiKey = request.headers.get('x-api-key');
  if (xApiKey) return xApiKey;

  const auth = request.headers.get('authorization');
  if (!auth) return null;
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = await authenticateApiKey(readRawApiKey(request));
    if (!apiKey) {
      return NextResponse.json({ error: 'API key inválida' }, { status: 401 });
    }

    if (!hasApiScope(apiKey.scopes, 'tickets:read')) {
      return NextResponse.json({ error: 'Scope insuficiente' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const q = String(searchParams.get('q') || '').trim();
    const parkingLotIdParam = searchParams.get('parkingLotId');
    const takeParam = Number(searchParams.get('take') || 50);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(Math.floor(takeParam), 1), 200) : 50;

    // If API key is scoped to a lot, ignore external parkingLotId and enforce scope.
    const parkingLotId = apiKey.parkingLotId || parkingLotIdParam || null;

    const tickets = await prisma.ticket.findMany({
      where: {
        ...(statusParam ? { status: statusParam as never } : {}),
        ...(parkingLotId ? { parkingLotId } : {}),
        ...(q
          ? {
              OR: [
                { ticketCode: { contains: q, mode: 'insensitive' } },
                { vehicle: { plate: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        vehicle: { select: { plate: true, type: true, brand: true, color: true } },
        space: { select: { number: true, zone: { select: { name: true } } } },
        payment: { select: { amount: true, method: true, status: true, invoiceNumber: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return NextResponse.json({
      meta: {
        count: tickets.length,
        scopeLotId: apiKey.parkingLotId,
      },
      data: tickets,
    });
  } catch (error) {
    console.error('API v1 tickets error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
