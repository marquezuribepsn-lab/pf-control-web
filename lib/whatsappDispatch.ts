import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import { normalizeWhatsAppPhone, sendWhatsAppText } from "@/lib/whatsappAlerts";

const HISTORY_KEY = "whatsapp-history-v1";

type Primitive = string | number | boolean | null | undefined;

export type DispatchRecipient = {
  id?: string;
  label?: string;
  telefono?: string;
  variables?: Record<string, Primitive>;
};

export type DispatchResult = {
  id: string;
  label: string;
  phone: string | null;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  providerMessageId?: string | null;
  renderedMessage?: string;
};

export function interpolateMessage(message: string, variables?: Record<string, Primitive>) {
  const base = String(message || "");
  if (!variables || typeof variables !== "object") {
    return base;
  }

  return base.replace(/\{\{\s*([a-zA-Z0-9_\-.]+)\s*\}\}/g, (_full, key: string) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });
}

export async function dispatchWhatsAppBatch(input: {
  recipients: DispatchRecipient[];
  message: string;
  mode: "test" | "prod";
  forceText?: boolean;
}) {
  const recipients = Array.isArray(input.recipients) ? input.recipients : [];
  const message = String(input.message || "").trim();
  const mode = input.mode === "prod" ? "prod" : "test";
  const forceText = input.forceText !== false;

  const results: DispatchResult[] = [];

  for (const recipient of recipients) {
    const id = String(recipient.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const label = String(recipient.label || "destinatario");
    const phone = normalizeWhatsAppPhone(String(recipient.telefono || ""));
    const renderedMessage = interpolateMessage(message, recipient.variables);

    if (!phone) {
      results.push({ id, label, phone: null, ok: false, reason: "telefono_invalido" });
      continue;
    }

    try {
      if (mode === "test") {
        results.push({
          id,
          label,
          phone,
          ok: true,
          skipped: true,
          reason: "test_mode",
          renderedMessage,
        });
        continue;
      }

      const sent = await sendWhatsAppText(renderedMessage, {
        toOverride: phone,
        forceText,
      });

      if (!sent.ok) {
        results.push({
          id,
          label,
          phone,
          ok: false,
          reason: sent.error || `provider_status_${sent.status}`,
          providerMessageId: sent.providerMessageId,
          renderedMessage,
        });
        continue;
      }

      results.push({
        id,
        label,
        phone,
        ok: true,
        providerMessageId: sent.providerMessageId,
        renderedMessage,
      });
    } catch (error) {
      results.push({
        id,
        label,
        phone,
        ok: false,
        reason: error instanceof Error ? error.message : "send_failed",
        renderedMessage,
      });
    }
  }

  return {
    results,
    total: results.length,
    okCount: results.filter((row) => row.ok).length,
    failedCount: results.filter((row) => !row.ok).length,
    ok: results.every((row) => row.ok),
  };
}

export async function appendWhatsAppHistory(entry: Record<string, unknown>) {
  const existing = await getSyncValue(HISTORY_KEY);
  const history = Array.isArray(existing) ? (existing as Record<string, unknown>[]) : [];
  const next = [entry, ...history].slice(0, 500);
  await setSyncValue(HISTORY_KEY, next);
}
