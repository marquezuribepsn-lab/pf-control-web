/**
 * GET /api/admin/vencimientos
 * Returns clients whose subscription is expiring in N days (default 7).
 *
 * POST /api/admin/vencimientos
 * Runs the expiry check and sends WhatsApp alerts for clients
 * expiring today or within `daysAhead` (default 7).
 * Safe to call multiple times — uses a "last run" timestamp stored
 * in sync to avoid sending duplicate alerts within the same day.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import { sendWhatsAppInternalAlert } from "@/lib/whatsappAlerts";

const CLIENTES_META_KEY   = "pf-control-clientes-meta-v1";
const LAST_VENC_RUN_KEY   = "pf-control-vencimientos-last-run-v1";

type ClienteMeta = {
  endDate?: string | null;
  startDate?: string | null;
  pagoEstado?: string;
  telefono?: string;
  email?: string;
  [key: string]: unknown;
};

function isAdmin(session: any): boolean {
  const role = String(session?.user?.role || "").toUpperCase();
  return role === "ADMIN" || role === "SUPERADMIN" || role === "COLABORADOR";
}

function isByCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const bearer = req.headers.get("authorization") ?? "";
  if (bearer === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function daysDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

type ExpiringClient = {
  nombre: string;
  endDate: string;
  daysLeft: number;
  pagoEstado: string;
  telefono?: string;
  email?: string;
};

async function getExpiringClients(daysAhead: number): Promise<ExpiringClient[]> {
  const raw = await getSyncValue(CLIENTES_META_KEY);
  if (!raw || typeof raw !== "object") return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result: ExpiringClient[] = [];

  for (const [nombre, meta] of Object.entries(raw as Record<string, ClienteMeta>)) {
    const endDate = parseDate(meta?.endDate);
    if (!endDate) continue;

    const daysLeft = daysDiff(today, endDate);
    // include: expiring today (0) or in the next daysAhead days, and not already expired (<0)
    if (daysLeft >= 0 && daysLeft <= daysAhead) {
      result.push({
        nombre,
        endDate: endDate.toISOString().slice(0, 10),
        daysLeft,
        pagoEstado: String(meta?.pagoEstado || "desconocido"),
        telefono:   meta?.telefono ? String(meta.telefono) : undefined,
        email:      meta?.email    ? String(meta.email)    : undefined,
      });
    }
  }

  return result.sort((a, b) => a.daysLeft - b.daysLeft);
}

// ── GET — list expiring clients ───────────────────────────────
export async function GET(req: NextRequest) {
  if (!isByCronSecret(req)) {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const days = Math.min(
    90,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "7") || 7)
  );

  const expiring = await getExpiringClients(days);
  return NextResponse.json({ expiring, total: expiring.length, daysAhead: days });
}

// ── POST — run alerts ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isByCronSecret(req)) {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let body: { daysAhead?: number; force?: boolean } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const daysAhead = Math.min(30, Math.max(1, Number(body.daysAhead) || 7));
  const force     = Boolean(body.force);

  // Throttle: only run once per day unless force=true
  if (!force) {
    const lastRun = await getSyncValue(LAST_VENC_RUN_KEY);
    if (lastRun && typeof lastRun === "string") {
      const lastRunDate = parseDate(lastRun);
      if (lastRunDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastRunDate.setHours(0, 0, 0, 0);
        if (lastRunDate.getTime() === today.getTime()) {
          return NextResponse.json({
            ok: true,
            skipped: true,
            reason: "Ya se ejecutó hoy. Usar force:true para forzar.",
          });
        }
      }
    }
  }

  const expiring = await getExpiringClients(daysAhead);

  if (expiring.length === 0) {
    await setSyncValue(LAST_VENC_RUN_KEY, new Date().toISOString());
    return NextResponse.json({ ok: true, sent: 0, expiring: [] });
  }

  // Build WhatsApp message for the admin
  const today7 = expiring.filter((c) => c.daysLeft === 0);
  const next7  = expiring.filter((c) => c.daysLeft > 0 && c.daysLeft <= 7);
  const later  = expiring.filter((c) => c.daysLeft > 7);

  const lines: string[] = [
    `📅 *Recordatorio de vencimientos — ${new Date().toLocaleDateString("es-AR")}*`,
    "",
  ];

  if (today7.length > 0) {
    lines.push("🔴 *Vencen HOY:*");
    today7.forEach((c) => lines.push(`• ${c.nombre} (${c.pagoEstado})`));
    lines.push("");
  }

  if (next7.length > 0) {
    lines.push(`🟡 *Vencen en los próximos 7 días:*`);
    next7.forEach((c) =>
      lines.push(`• ${c.nombre} — vence ${c.endDate} (en ${c.daysLeft}d)`)
    );
    lines.push("");
  }

  if (later.length > 0) {
    lines.push(`⚪ *Vencen en 8–${daysAhead} días:*`);
    later.forEach((c) =>
      lines.push(`• ${c.nombre} — vence ${c.endDate} (en ${c.daysLeft}d)`)
    );
  }

  const message = lines.join("\n");

  let waSent = false;
  try {
    const result = await sendWhatsAppInternalAlert(message);
    waSent = Array.isArray(result)
      ? result.some((r: any) => r?.ok)
      : Boolean((result as any)?.ok);
  } catch {
    waSent = false;
  }

  await setSyncValue(LAST_VENC_RUN_KEY, new Date().toISOString());

  return NextResponse.json({
    ok: true,
    sent: expiring.length,
    waSent,
    expiring,
    message,
  });
}
