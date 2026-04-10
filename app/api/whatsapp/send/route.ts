import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendWhatsAppHistory, dispatchWhatsAppBatch, type DispatchRecipient } from "@/lib/whatsappDispatch";

async function requireAdminSession() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      destinatarios?: DispatchRecipient[];
      mensaje?: string;
      tipo?: string;
      subcategoria?: string;
      categoryKey?: string;
      subcategoryKey?: string;
      mode?: string;
      forceText?: boolean;
      triggeredBy?: string;
      runId?: string;
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

    const batch = await dispatchWhatsAppBatch({
      recipients,
      message,
      mode: mode === "prod" ? "prod" : "test",
      forceText,
    });

    const firstFailure = batch.results.find((row) => !row.ok);

    const now = new Date().toISOString();
    const triggeredBy = String(body.triggeredBy || "admin_manual");
    await appendWhatsAppHistory({
      id: `wh-msg-${Date.now()}`,
      createdAt: now,
      tipo: String(body.tipo || "General"),
      subcategoria: String(body.subcategoria || "manual"),
      categoryKey: String(body.categoryKey || "manual"),
      subcategoryKey: String(body.subcategoryKey || body.subcategoria || "manual"),
      triggeredBy,
      triggeredByUserId: String((session.user as any)?.id || ""),
      triggeredByUserEmail: String(session.user?.email || ""),
      triggeredByUserName: String(session.user?.name || ""),
      runId: String(body.runId || ""),
      mode,
      mensaje: message,
      total: batch.total,
      ok: batch.okCount,
      failed: batch.failedCount,
      results: batch.results,
    });

    return NextResponse.json({
      ok: batch.ok,
      total: batch.total,
      okCount: batch.okCount,
      failedCount: batch.failedCount,
      firstFailureReason: firstFailure?.reason || null,
      results: batch.results,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error al enviar WhatsApp" },
      { status: 500 }
    );
  }
}
