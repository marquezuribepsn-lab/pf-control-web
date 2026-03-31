type WhatsAppTextPayload = {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: {
    body: string;
  };
};

type WhatsAppTemplatePayload = {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: "body";
      parameters: Array<{
        type: "text";
        text: string;
      }>;
    }>;
  };
};

type WhatsAppPayload = WhatsAppTextPayload | WhatsAppTemplatePayload;

type SendWhatsAppOptions = {
  forceTemplate?: boolean;
  forceText?: boolean;
  preferPersonalizedFollowUpText?: boolean;
};

export type WhatsAppSendResult = {
  to: string;
  payloadType: "template" | "text";
  providerMessageId: string | null;
};

type WhatsAppApiError = Error & {
  whatsappCode?: string;
  httpStatus?: number;
};

function isEnabled() {
  return process.env.WHATSAPP_ALERTS_ENABLED === "1";
}

function getConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_TO;
  const useTemplate = process.env.WHATSAPP_USE_TEMPLATE === "1";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "hello_world";
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
  const templateIncludeBodyText = process.env.WHATSAPP_TEMPLATE_INCLUDE_BODY_TEXT !== "0";

  if (!token || !phoneNumberId) {
    return null;
  }

  return {
    token,
    phoneNumberId,
    to,
    useTemplate,
    templateName,
    templateLanguage,
    templateIncludeBodyText,
  };
}

function normalizePhone(raw: string | undefined | null): string {
  const value = String(raw || "").trim();
  if (!value) return "";

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  return digits.length >= 8 ? digits : "";
}

function getProviderMessageId(responseText: string): string | null {
  if (!responseText) return null;

  try {
    const responseJson = JSON.parse(responseText) as Record<string, unknown>;
    return Array.isArray(responseJson?.messages)
      ? String(
          (responseJson?.messages as Array<{ id?: unknown }>)[0]?.id || ""
        ).trim() || null
      : null;
  } catch {
    return null;
  }
}

function buildApiError(status: number, responseText: string): WhatsAppApiError {
  let whatsappCode = "";

  try {
    const parsed = JSON.parse(responseText) as {
      error?: {
        code?: unknown;
      };
    };
    whatsappCode = String(parsed?.error?.code || "");
  } catch {
    whatsappCode = "";
  }

  const error = new Error(`WhatsApp API error ${status}: ${responseText}`) as WhatsAppApiError;
  if (whatsappCode) {
    error.whatsappCode = whatsappCode;
  }
  error.httpStatus = status;
  return error;
}

function isOutsideConversationWindowError(error: unknown): boolean {
  const source = error as WhatsAppApiError;
  const code = String(source?.whatsappCode || "").trim();
  const message = String(source?.message || "").toLowerCase();

  if (code === "131047") {
    return true;
  }

  return (
    message.includes("131047") ||
    message.includes("24 hours") ||
    (message.includes("outside") && message.includes("window"))
  );
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
    const nuevos = nextArr.filter((item) => {
      const nombre = typeof item === "object" && item && "nombre" in item ? String((item as any).nombre) : "";
      return !prevArr.some((prevItem) => {
        const prevNombre = typeof prevItem === "object" && prevItem && "nombre" in prevItem ? String((prevItem as any).nombre) : "";
        return prevNombre === nombre;
      });
    });

    const nombre = nuevos.length > 0 && typeof nuevos[0] === "object" && nuevos[0] && "nombre" in nuevos[0]
      ? String((nuevos[0] as any).nombre)
      : "";

    return nombre
      ? `PF Control: se registro un alumno nuevo (${nombre}). Total alumnos: ${nextArr.length}. (${toDateTimeString()})`
      : `PF Control: se registro un alumno nuevo. Total alumnos: ${nextArr.length}. (${toDateTimeString()})`;
  }

  if (key === "pf-control-pagos-v1" && nextArr.length > prevArr.length) {
    const nuevoPago = nextArr.find((item) => {
      const id = typeof item === "object" && item && "id" in item ? String((item as any).id) : "";
      return !prevArr.some((prevItem) => {
        const prevId = typeof prevItem === "object" && prevItem && "id" in prevItem ? String((prevItem as any).id) : "";
        return prevId === id;
      });
    }) as any;

    if (nuevoPago) {
      const nombre = String(nuevoPago.clientName || "cliente sin nombre");
      const moneda = String(nuevoPago.moneda || "ARS");
      const importe = Number(nuevoPago.importe || 0);
      const importeTxt = Number.isFinite(importe) ? importe.toLocaleString("es-AR") : String(nuevoPago.importe || "0");
      return `PF Control: pago registrado de ${nombre}. Monto: ${moneda} ${importeTxt}. (${toDateTimeString()})`;
    }

    return `PF Control: se registro un pago nuevo. Total pagos: ${nextArr.length}. (${toDateTimeString()})`;
  }

  if (key === "pf-control-jugadoras" && nextArr.length > prevArr.length) {
    return `PF Control: se registro una jugadora nueva. Total jugadoras: ${nextArr.length}. (${toDateTimeString()})`;
  }

  if (key === "pf-control-clientes-meta-v1") {
    const prevMap = (previousValue && typeof previousValue === "object" ? previousValue : {}) as Record<string, any>;
    const nextMap = (nextValue && typeof nextValue === "object" ? nextValue : {}) as Record<string, any>;

    for (const [clientId, nextMeta] of Object.entries(nextMap)) {
      const prevMeta = prevMap[clientId] || {};

      const prevColab = String(prevMeta.colaboradores || "").toLowerCase();
      const nextColab = String(nextMeta?.colaboradores || "").toLowerCase();
      if (nextColab && nextColab !== prevColab) {
        const isSolicitudColab = /(solicita|solicitud|cambio)/i.test(nextColab);
        if (isSolicitudColab) {
          return `PF Control: un colaborador solicito un cambio para ${clientId}. (${toDateTimeString()})`;
        }
      }

      const prevPlan = String(prevMeta?.tabNotas?.["plan-entrenamiento"] || "").toLowerCase();
      const nextPlan = String(nextMeta?.tabNotas?.["plan-entrenamiento"] || "").toLowerCase();
      if (nextPlan && nextPlan !== prevPlan) {
        const isRutinaChange = /(cambio de rutina|cambiar rutina|solicita rutina|solicito rutina|cambio rutina)/i.test(nextPlan);
        if (isRutinaChange) {
          return `PF Control: un alumno solicito cambio de rutina para ${clientId}. (${toDateTimeString()})`;
        }
      }
    }

    return "";
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
  bodyText: string,
  toOverride?: string,
  options?: SendWhatsAppOptions
): Promise<WhatsAppSendResult> {
  if (!isEnabled()) {
    throw new Error("WhatsApp alerts deshabilitadas");
  }

  const cfg = getConfig();
  if (!cfg || !bodyText) {
    throw new Error("Config de WhatsApp incompleta o mensaje vacio");
  }

  const targetPhone = normalizePhone(toOverride ?? cfg.to);
  if (!targetPhone) {
    if (toOverride !== undefined) {
      throw new Error("Numero de telefono destino invalido o ausente");
    }
    throw new Error("Numero de telefono destino no configurado");
  }

  if (options?.forceTemplate && options?.forceText) {
    throw new Error("No se puede forzar template y texto al mismo tiempo");
  }

  const useTemplate = options?.forceTemplate
    ? true
    : options?.forceText
      ? false
      : cfg.useTemplate;

  const url = `https://graph.facebook.com/v20.0/${cfg.phoneNumberId}/messages`;
  const templatePayload: WhatsAppTemplatePayload = {
    messaging_product: "whatsapp",
    to: targetPhone,
    type: "template",
    template: {
      name: cfg.templateName,
      language: { code: cfg.templateLanguage },
      components: cfg.templateIncludeBodyText
        ? [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: bodyText,
                },
              ],
            },
          ]
        : undefined,
    },
  };

  const textPayload: WhatsAppTextPayload = {
    messaging_product: "whatsapp",
    to: targetPhone,
    type: "text",
    text: { body: bodyText },
  };

  const sendPayload = async (
    payload: WhatsAppPayload,
    payloadType: "template" | "text"
  ): Promise<WhatsAppSendResult> => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    if (!res.ok) {
      throw buildApiError(res.status, responseText);
    }

    return {
      to: targetPhone,
      payloadType,
      providerMessageId: getProviderMessageId(responseText),
    };
  };

  // If the active template cannot carry dynamic body text, prioritize reliable template delivery.
  // Optionally try a personalized text follow-up when caller explicitly requests it.
  if (useTemplate && !cfg.templateIncludeBodyText) {
    const templateResult = await sendPayload(templatePayload, "template");

    if (!options?.preferPersonalizedFollowUpText) {
      return templateResult;
    }

    try {
      return await sendPayload(textPayload, "text");
    } catch (error) {
      // If free-form follow-up is outside the conversation window, keep template as successful result.
      if (isOutsideConversationWindowError(error)) {
        return templateResult;
      }

      return templateResult;
    }
  }

  return useTemplate
    ? sendPayload(templatePayload, "template")
    : sendPayload(textPayload, "text");
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

  await sendWhatsAppText(bodyText);
}

export async function sendWhatsAppEventAlert(eventText: string) {
  await sendWhatsAppText(`PF Control: ${eventText}. (${toDateTimeString()})`);
}
