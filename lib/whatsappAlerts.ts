type SendWhatsAppTextOptions = {
  toOverride?: string;
  forceText?: boolean;
  templateName?: string;
  templateLanguageCode?: string;
  templateComponents?: unknown[];
};

type SendWhatsAppResult = {
  ok: boolean;
  status: number;
  payloadType: "text" | "template";
  providerMessageId: string | null;
  error: string | null;
};

function isEnabled() {
  return process.env.WHATSAPP_ALERTS_ENABLED === "1";
}

function getConfig() {
  const token = String(process.env.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const to = String(process.env.WHATSAPP_TO || "").trim();

  if (!token || !phoneNumberId) {
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

export function normalizeWhatsAppPhone(input: string): string | null {
  const digits = String(input || "").replace(/\D+/g, "");
  if (!digits) return null;

  if (digits.startsWith("549") && digits.length >= 12) {
    return digits;
  }

  if (digits.startsWith("54") && digits.length >= 12) {
    return `549${digits.slice(2)}`;
  }

  if (digits.length === 10) {
    return `549${digits}`;
  }

  return null;
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

export async function sendWhatsAppText(
  message: string,
  options: SendWhatsAppTextOptions = {}
): Promise<SendWhatsAppResult> {
  const cfg = getConfig();
  if (!cfg) {
    return {
      ok: false,
      status: 500,
      payloadType: "text",
      providerMessageId: null,
      error: "config_missing",
    };
  }

  const to = normalizeWhatsAppPhone(options.toOverride || cfg.to);
  if (!to) {
    return {
      ok: false,
      status: 400,
      payloadType: "text",
      providerMessageId: null,
      error: "invalid_phone",
    };
  }

  const payloadType =
    options.templateName && !options.forceText ? ("template" as const) : ("text" as const);

  const payload =
    payloadType === "template"
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: options.templateName,
            language: { code: options.templateLanguageCode || "es_AR" },
            components: Array.isArray(options.templateComponents)
              ? options.templateComponents
              : undefined,
          },
        }
      : {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: String(message || "") },
        };

  const response = await fetch(`https://graph.facebook.com/v22.0/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as any;
  const providerMessageId = body?.messages?.[0]?.id || null;

  return {
    ok: response.ok,
    status: response.status,
    payloadType,
    providerMessageId,
    error: response.ok ? null : body?.error?.message || `provider_status_${response.status}`,
  };
}

export async function sendWhatsAppAlertForSyncChange(
  key: string,
  previousValue: unknown,
  nextValue: unknown
) {
  if (!isEnabled()) {
    return;
  }

  const bodyText = buildMessage(key, previousValue, nextValue);
  if (!bodyText) {
    return;
  }

  await sendWhatsAppText(bodyText, { forceText: true });
}
