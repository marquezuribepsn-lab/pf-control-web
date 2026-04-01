import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import { normalizeWhatsAppPhone, sendWhatsAppText } from "@/lib/whatsappAlerts";

const HISTORY_KEY = "whatsapp-history-v1";

type Recipient = {
  id?: string;
  label?: string;
  telefono?: string;
  variables?: Record<string, string | number | boolean | null | undefined>;
};

type SendResult = {
  id: string;
  label: string;
  phone: string | null;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  providerMessageId?: string | null;
  renderedMessage?: string;
};

function interpolateMessage(
  message: string,
  variables: Record<string, string | number | boolean | null | undefined> | undefined
) {
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

async function requireAdmin() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return false;
  }
  return true;
}

async function appendHistory(entry: Record<string, unknown>) {
  const existing = await getSyncValue(HISTORY_KEY);
  const history = Array.isArray(existing) ? (existing as Record<string, unknown>[]) : [];
  const next = [entry, ...history].slice(0, 300);
  await setSyncValue(HISTORY_KEY, next);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      destinatarios?: Recipient[];
      mensaje?: string;
      tipo?: string;
      subcategoria?: string;
      mode?: string;
      forceText?: boolean;
    };

    const recipients = Array.isArray(body.destinatarios) ? body.destinatarios : [];
    const message = String(body.mensaje || "").trim();
    const mode = String(body.mode || "prod").trim().toLowerCase();

    if (!message || recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: "destinatarios y mensaje son requeridos" },
        { status: 400 }
      );
    }

    const forceText = body.forceText !== false;

    const results: SendResult[] = [];

    for (const recipient of recipients) {
      const id = String(recipient.id || `${Date.now()}-${Math.random()}`);
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

    const now = new Date().toISOString();
    await appendHistory({
      id: `wh-msg-${Date.now()}`,
      createdAt: now,
      tipo: String(body.tipo || "General"),
      subcategoria: String(body.subcategoria || "manual"),
      mode,
      mensaje: message,
      total: results.length,
      ok: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    });

    const ok = results.every((item) => item.ok);
    return NextResponse.json({ ok, results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error al enviar WhatsApp" },
      { status: 500 }
    );
  }
}
