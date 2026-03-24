type NotificationEventAction = 'created' | 'updated' | 'deleted';

export type NotificationEvent = {
  userId: string;
  action: NotificationEventAction;
  notificationId?: string;
  at: string;
};

type StreamClient = {
  id: string;
  controller: ReadableStreamDefaultController<string>;
};

const clientsByUser = new Map<string, Map<string, StreamClient>>();

function formatSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function removeClient(userId: string, clientId: string) {
  const userClients = clientsByUser.get(userId);
  if (!userClients) return;

  userClients.delete(clientId);
  if (userClients.size === 0) {
    clientsByUser.delete(userId);
  }
}

export function createNotificationEventStream(userId: string) {
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream<string>({
    start(controller) {
      let userClients = clientsByUser.get(userId);
      if (!userClients) {
        userClients = new Map<string, StreamClient>();
        clientsByUser.set(userId, userClients);
      }

      userClients.set(clientId, { id: clientId, controller });
      controller.enqueue(formatSse('connected', { ok: true, at: new Date().toISOString() }));

      keepAlive = setInterval(() => {
        try {
          controller.enqueue(': ping\n\n');
        } catch {
          if (keepAlive) clearInterval(keepAlive);
          removeClient(userId, clientId);
        }
      }, 15_000);
    },
    cancel() {
      if (keepAlive) clearInterval(keepAlive);
      removeClient(userId, clientId);
    },
  });
}

export function emitNotificationEvent(event: NotificationEvent) {
  const userClients = clientsByUser.get(event.userId);
  if (!userClients || userClients.size === 0) return;

  const payload = formatSse('notification', event);
  for (const [clientId, client] of userClients.entries()) {
    try {
      client.controller.enqueue(payload);
    } catch {
      removeClient(event.userId, clientId);
    }
  }
}
