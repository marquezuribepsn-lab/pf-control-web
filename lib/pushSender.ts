import {
  getPushTokensForUser,
  isValidExpoPushToken,
  removePushToken,
} from "@/lib/pushTokenStore";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export type ExpoPushMessage = {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

/**
 * Envía una notificación push a través de la API de Expo.
 * Funciona en cuanto la app tenga un projectId de EAS y las credenciales de
 * APNs (iOS) / FCM (Android) configuradas en EAS. No requiere SDK extra.
 *
 * Limpia automáticamente los tokens que Expo reporta como inválidos
 * (DeviceNotRegistered).
 */
export async function sendExpoPushMessages(
  messages: ExpoPushMessage[]
): Promise<{ sent: number; errors: string[] }> {
  const valid = messages.filter((message) => isValidExpoPushToken(message.to));
  if (valid.length === 0) {
    return { sent: 0, errors: [] };
  }

  const errors: string[] = [];

  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        valid.map((message) => ({
          to: message.to,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: message.sound === undefined ? "default" : message.sound,
          badge: message.badge,
        }))
      ),
    });

    const json = (await response.json().catch(() => ({}))) as {
      data?: ExpoPushTicket[];
      errors?: Array<{ message?: string }>;
    };

    if (Array.isArray(json.errors)) {
      for (const err of json.errors) {
        if (err?.message) errors.push(err.message);
      }
    }

    const tickets = Array.isArray(json.data) ? json.data : [];
    let sent = 0;

    for (let index = 0; index < tickets.length; index += 1) {
      const ticket = tickets[index];
      const message = valid[index];

      if (ticket?.status === "ok") {
        sent += 1;
        continue;
      }

      if (ticket?.message) {
        errors.push(ticket.message);
      }

      // Si el dispositivo ya no está registrado, descartar el token.
      if (ticket?.details?.error === "DeviceNotRegistered" && message?.to) {
        await removePushToken(message.to).catch(() => undefined);
      }
    }

    return { sent, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { sent: 0, errors };
  }
}

/** Envía una notificación a todos los dispositivos de un usuario. */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<{ sent: number; errors: string[] }> {
  const tokens = await getPushTokensForUser(userId);
  if (tokens.length === 0) {
    return { sent: 0, errors: [] };
  }

  return sendExpoPushMessages(
    tokens.map((record) => ({
      to: record.token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }))
  );
}
