import { NextRequest, NextResponse } from 'next/server';
import { runSubscriptionsMaintenance } from '@/lib/subscriptions-maintenance';

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
