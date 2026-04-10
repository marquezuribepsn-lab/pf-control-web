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
  senderPhoneNumberId: string | null;
  providerMessageId: string | null;
  error: string | null;
};

type ProviderAttempt = {
  ok: boolean;
  status: number;
  payloadType: "text" | "template";
  providerMessageId: string | null;
  error: string | null;
  errorCode: string | null;
};

function isEnabled() {
  return process.env.WHATSAPP_ALERTS_ENABLED === "1";
}

function getConfig() {
  const token = String(process.env.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const to = String(process.env.WHATSAPP_TO || "").trim();
  const senderPhones = parsePhoneList(
    [
      process.env.WHATSAPP_SENDER_PHONE,
      process.env.WHATSAPP_SENDER_NUMBERS,
      process.env.WHATSAPP_BUSINESS_PHONE,
      process.env.WHATSAPP_SENDER_E164,
    ]
      .filter((value) => typeof value === "string" && String(value).trim().length > 0)
      .join(",")
  );

  if (!token || !phoneNumberId) {
    return null;
  }

  return { token, phoneNumberId, to, senderPhones };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parsePhoneList(raw: string | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((item) => normalizeWhatsAppPhone(item))
    .filter((value): value is string => Boolean(value));
}

function getFallbackTemplateName() {
  return String(
    process.env.WHATSAPP_FALLBACK_TEMPLATE_NAME ||
      process.env.WHATSAPP_TEMPLATE_NAME ||
      "pf_alerta_general"
  ).trim();
}

function getFallbackTemplateLanguageCode() {
  return (
    String(process.env.WHATSAPP_FALLBACK_TEMPLATE_LANG || process.env.WHATSAPP_TEMPLATE_LANG || "es_AR").trim() ||
    "es_AR"
  );
}

function resolveProviderError(body: any, status: number) {
  const message = String(body?.error?.message || "").trim();
  const codeRaw = body?.error?.code ?? body?.error?.error_subcode ?? null;
  const code = codeRaw === null || codeRaw === undefined || codeRaw === "" ? null : String(codeRaw);

  if (message && code) {
    return {
      error: `${message} (code ${code})`,
      errorCode: code,
    };
  }

  if (message) {
    return {
      error: message,
      errorCode: code,
    };
  }

  if (code) {
    return {
      error: `provider_code_${code}`,
      errorCode: code,
    };
  }

  return {
    error: `provider_status_${status}`,
    errorCode: null,
  };
}

function isOutside24hWindowError(errorCode: string | null, errorText: string | null) {
  if (String(errorCode || "").trim() === "131047") {
    return true;
  }

  const message = String(errorText || "").toLowerCase();
  return (
    message.includes("24-hour") ||
    message.includes("24 hour") ||
    message.includes("24h") ||
    message.includes("outside the allowed window") ||
    message.includes("outside of the customer care window") ||
    message.includes("re-engagement")
  );
}

function buildTextPayload(to: string, message: string) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: String(message || "") },
  };
}

function buildTemplatePayload(input: {
  to: string;
  templateName: string;
  languageCode: string;
  components?: unknown[];
}) {
  return {
    messaging_product: "whatsapp",
    to: input.to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.languageCode || "es_AR" },
      components: Array.isArray(input.components) && input.components.length > 0 ? input.components : undefined,
    },
  };
}

async function postWhatsAppPayload(input: {
  token: string;
  phoneNumberId: string;
  payloadType: "text" | "template";
  payload: Record<string, unknown>;
}): Promise<ProviderAttempt> {
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${input.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.payload),
    }
  );

  const body = (await response.json().catch(() => ({}))) as any;
  const providerMessageId = body?.messages?.[0]?.id || null;
  const providerError = response.ok ? { error: null, errorCode: null } : resolveProviderError(body, response.status);

  return {
    ok: response.ok,
    status: response.status,
    payloadType: input.payloadType,
    providerMessageId,
    error: providerError.error,
    errorCode: providerError.errorCode,
  };
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
      senderPhoneNumberId: null,
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
      senderPhoneNumberId: cfg.phoneNumberId,
      providerMessageId: null,
      error: "invalid_phone",
    };
  }

  if (cfg.senderPhones.includes(to)) {
    return {
      ok: false,
      status: 400,
      payloadType: "text",
      senderPhoneNumberId: cfg.phoneNumberId,
      providerMessageId: null,
      error: "recipient_is_sender_number",
    };
  }

  const requestedTemplateName = String(options.templateName || "").trim();
  const requestedTemplateLanguageCode = String(options.templateLanguageCode || "es_AR").trim() || "es_AR";
  const requestedTemplateComponents = Array.isArray(options.templateComponents)
    ? options.templateComponents
    : undefined;
  const shouldSendTemplateFirst = Boolean(requestedTemplateName) && options.forceText !== true;

  const toResult = (attempt: ProviderAttempt): SendWhatsAppResult => ({
    ok: attempt.ok,
    status: attempt.status,
    payloadType: attempt.payloadType,
    senderPhoneNumberId: cfg.phoneNumberId,
    providerMessageId: attempt.providerMessageId,
    error: attempt.error,
  });

  if (shouldSendTemplateFirst) {
    const templateAttempt = await postWhatsAppPayload({
      token: cfg.token,
      phoneNumberId: cfg.phoneNumberId,
      payloadType: "template",
      payload: buildTemplatePayload({
        to,
        templateName: requestedTemplateName,
        languageCode: requestedTemplateLanguageCode,
        components: requestedTemplateComponents,
      }),
    });
    return toResult(templateAttempt);
  }

  const textPayload = buildTextPayload(to, message);
  const textAttempt = await postWhatsAppPayload({
    token: cfg.token,
    phoneNumberId: cfg.phoneNumberId,
    payloadType: "text",
    payload: textPayload,
  });

  if (textAttempt.ok) {
    return toResult(textAttempt);
  }

  const fallbackTemplateName = getFallbackTemplateName();
  if (
    !options.toOverride ||
    !fallbackTemplateName ||
    !isOutside24hWindowError(textAttempt.errorCode, textAttempt.error)
  ) {
    return toResult(textAttempt);
  }

  const fallbackTemplateAttempt = await postWhatsAppPayload({
    token: cfg.token,
    phoneNumberId: cfg.phoneNumberId,
    payloadType: "template",
    payload: buildTemplatePayload({
      to,
      templateName: fallbackTemplateName,
      languageCode: getFallbackTemplateLanguageCode(),
      components: requestedTemplateComponents,
    }),
  });

  if (!fallbackTemplateAttempt.ok) {
    return {
      ...toResult(textAttempt),
      error: `${textAttempt.error || "send_failed"}; template_fallback_failed: ${fallbackTemplateAttempt.error || `provider_status_${fallbackTemplateAttempt.status}`}`,
    };
  }

  const retryTextAttempt = await postWhatsAppPayload({
    token: cfg.token,
    phoneNumberId: cfg.phoneNumberId,
    payloadType: "text",
    payload: textPayload,
  });

  if (retryTextAttempt.ok) {
    return toResult(retryTextAttempt);
  }

  // If the template fallback was delivered but text retry still failed, keep the send as delivered.
  return toResult(fallbackTemplateAttempt);
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

export async function sendWhatsAppInternalAlert(message: string, toList?: string[]) {
  const envTargets = parsePhoneList(process.env.WHATSAPP_INTERNAL_ALERT_TO);
  const fallbackTarget = normalizeWhatsAppPhone(String(process.env.WHATSAPP_TO || ""));
  const explicitTargets = Array.isArray(toList)
    ? toList
        .map((value) => normalizeWhatsAppPhone(String(value || "")))
        .filter((value): value is string => Boolean(value))
    : [];

  const targets = Array.from(
    new Set([
      ...explicitTargets,
      ...envTargets,
      ...(fallbackTarget ? [fallbackTarget] : []),
    ])
  );

  if (targets.length === 0) {
    return {
      ok: false,
      sent: 0,
      failed: 1,
      reasons: ["internal_alert_targets_missing"],
    };
  }

  const reasons: string[] = [];
  let sent = 0;

  for (const target of targets) {
    const result = await sendWhatsAppText(message, {
      toOverride: target,
      forceText: true,
    });
    if (result.ok) {
      sent += 1;
    } else {
      reasons.push(result.error || `status_${result.status}`);
    }
  }

  return {
    ok: sent > 0,
    sent,
    failed: targets.length - sent,
    reasons,
  };
}
