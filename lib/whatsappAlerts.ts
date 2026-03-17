type WhatsAppPayload = {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: {
    body: string;
  };
};

function isEnabled() {
  return process.env.WHATSAPP_ALERTS_ENABLED === "1";
}

function getConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_TO;

  if (!token || !phoneNumberId || !to) {
    return null;
  }

  return { token, phoneNumberId, to };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toDateTimeString() {
  return new Date().toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMessage(key: string, previousValue: unknown, nextValue: unknown): string {
  const prevArr = asArray(previousValue);
  const nextArr = asArray(nextValue);

  if (key === "pf-control-alumnos" && nextArr.length > prevArr.length) {
    return `PF Control: se registro un alumno nuevo. Total alumnos: ${nextArr.length}. (${toDateTimeString()})`;
  }

  if (key === "pf-control-pagos-v1" && nextArr.length > prevArr.length) {
    return `PF Control: se registro un pago nuevo. Total pagos: ${nextArr.length}. (${toDateTimeString()})`;
  }

  if (key === "pf-control-jugadoras" && nextArr.length > prevArr.length) {
    return `PF Control: se registro una jugadora nueva. Total jugadoras: ${nextArr.length}. (${toDateTimeString()})`;
  }

  const watchedKeys = new Set([
    "pf-control-clientes-meta-v1",
    "pf-control-sesiones",
    "pf-control-categorias",
    "pf-control-wellness",
  ]);

  if (watchedKeys.has(key)) {
    return `PF Control: hubo cambios en ${key}. (${toDateTimeString()})`;
  }

  return "";
}

export async function sendWhatsAppAlertForSyncChange(
  key: string,
  previousValue: unknown,
  nextValue: unknown
) {
  if (!isEnabled()) {
    return;
  }

  const cfg = getConfig();
  if (!cfg) {
    return;
  }

  const bodyText = buildMessage(key, previousValue, nextValue);
  if (!bodyText) {
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${cfg.phoneNumberId}/messages`;
  const payload: WhatsAppPayload = {
    messaging_product: "whatsapp",
    to: cfg.to,
    type: "text",
    text: { body: bodyText },
  };

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
