import crypto from 'node:crypto';
import type { WebhookEndpoint } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function dispatchWebhook(parkingLotId: string, event: string, payload: unknown) {
  try {
    // 1. Encontrar webhooks activos de esta sede que escuchen este evento
    const endpoints: WebhookEndpoint[] = await prisma.webhookEndpoint.findMany({
      where: {
        parkingLotId,
        isActive: true,
      }
    });

    const matchingEndpoints = endpoints.filter((ep: WebhookEndpoint) => {
      const events = ep.events.split(',').map((e: string) => e.trim().toLowerCase());
      return events.includes('*') || events.includes(event.toLowerCase());
    });

    if (matchingEndpoints.length === 0) return; // Nada que hacer

    const jsonPayload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    // 2. Disparar hooks asincrónicamente
    const promises = matchingEndpoints.map(async (endpoint: WebhookEndpoint) => {
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(jsonPayload)
        .digest('hex');

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-parkingos-signature': signature,
            'x-parkingos-event': event,
          },
          body: jsonPayload,
          // Un timeout razonable para no dejar fetch colgado, en Node ~18+ fetch acepta AbortSignal
          signal: AbortSignal.timeout(5000), 
        });

        if (!response.ok) {
          console.warn(`[webhook] Error HTTP ${response.status} al enviar a ${endpoint.url} (Webhook ${endpoint.id})`);
        }
      } catch (err) {
        console.warn(`[webhook] Falla de red al enviar a ${endpoint.url} (Webhook ${endpoint.id}):`, err);
      }
    });

    // Fire and forget (podríamos usar await Promise.allSettled)
    void Promise.allSettled(promises);

  } catch (error) {
    console.error(`[webhook] Error general despachando evento ${event}:`, error);
  }
}
