/**
 * POST /api/admin/checkin-reminder
 * Sends WhatsApp reminders to alumnos who haven't submitted their weekly check-in.
 *
 * Reads:
 *   - pf-control-clientes-meta-v1  → alumno phone numbers
 *   - pf-control-checkin-semanal-v1 → check-ins already submitted this week
 *
 * Throttled to once per day unless force=true.
 * Designed to be called every Monday (e.g. via cron hitting this endpoint).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import { sendWhatsAppText, normalizeWhatsAppPhone } from "@/lib/whatsappAlerts";

const CLIENTES_META_KEY    = "pf-control-clientes-meta-v1";
const CHECKIN_KEY          = "pf-control-checkin-semanal-v1";
const LAST_REMINDER_RUN    = "pf-control-checkin-reminder-last-run-v1";

type CheckinRecord = {
  alumnoNombre?: string;
  semanaOf?: string;
};

type ClienteMeta = {
  telefono?: string;
  codigoPais?: string;
  email?: string;
  pagoEstado?: string;
  endDate?: string;
};

function isAdmin(session: any): boolean {
  const role = String(session?.user?.role || "").toUpperCase();
  return role === "ADMIN" || role === "SUPERADMIN";
}

function isByCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const bearer = req.headers.get("authorization") ?? "";
  if (bearer === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  if (!isByCronSecret(req)) {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let body: { force?: boolean; message?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const force = Boolean(body.force);

  // Throttle: once per day
  if (!force) {
    const lastRun = await getSyncValue(LAST_REMINDER_RUN);
    if (lastRun && typeof lastRun === "string") {
      const lastRunDate = parseDate(lastRun);
      if (lastRunDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastRunDate.setHours(0, 0, 0, 0);
        if (lastRunDate.getTime() === today.getTime()) {
          return NextResponse.json({ ok: true, skipped: true, reason: "Ya ejecutado hoy" });
        }
      }
    }
  }

  // Load data
  const [metaRaw, checkinsRaw] = await Promise.all([
    getSyncValue(CLIENTES_META_KEY),
    getSyncValue(CHECKIN_KEY),
  ]);

  const meta    = (metaRaw && typeof metaRaw === "object") ? metaRaw as Record<string, ClienteMeta> : {};
  const checkins: CheckinRecord[] = Array.isArray(checkinsRaw) ? checkinsRaw as CheckinRecord[] : [];

  const thisMonday = getMondayOf(new Date());

  // Who already checked in this week
  const alreadyIn = new Set(
    checkins
      .filter((c) => c.semanaOf === thisMonday && c.alumnoNombre)
      .map((c) => (c.alumnoNombre || "").trim().toLowerCase())
  );

  const whatsappMsg = body.message?.trim() ||
    `🏋️ *Check-in semanal*\n\nHola! Pasate por la app y completá tu check-in de esta semana. Solo son 3 preguntas rápidas 💪\n\npf-control.com`;

  const results: { nombre: string; status: string }[] = [];

  for (const [nombre, clientMeta] of Object.entries(meta)) {
    // Skip if already checked in
    if (alreadyIn.has(nombre.trim().toLowerCase())) {
      results.push({ nombre, status: "ya-completo" });
      continue;
    }

    // Skip inactive clients
    if (clientMeta.pagoEstado && clientMeta.pagoEstado !== "confirmado") {
      results.push({ nombre, status: "inactivo" });
      continue;
    }

    // Get phone
    const rawPhone = clientMeta.telefono;
    if (!rawPhone) {
      results.push({ nombre, status: "sin-telefono" });
      continue;
    }

    // normalizeWhatsAppPhone handles Argentina country-code prefixing;
    // do NOT prepend codigoPais manually — it would double-prefix if the
    // stored number already includes "54" or "549".
    const normalized  = normalizeWhatsAppPhone(rawPhone.replace(/\D/g, ""));

    if (!normalized) {
      results.push({ nombre, status: "telefono-invalido" });
      continue;
    }

    try {
      const waResult = await sendWhatsAppText(whatsappMsg, {
        toOverride: normalized,
        forceText: true,
      });
      results.push({
        nombre,
        status: (waResult as any)?.ok ? "enviado" : "error-wa",
      });
    } catch {
      results.push({ nombre, status: "error-excepcion" });
    }
  }

  await setSyncValue(LAST_REMINDER_RUN, new Date().toISOString());

  const sent   = results.filter((r) => r.status === "enviado").length;
  const done   = results.filter((r) => r.status === "ya-completo").length;
  const errors = results.filter((r) => r.status.startsWith("error")).length;

  return NextResponse.json({
    ok: true,
    sent,
    alreadyCompleted: done,
    errors,
    results,
    thisMonday,
  });
}

// GET — preview: who hasn't checked in yet
export async function GET(req: NextRequest) {
  if (!isByCronSecret(req)) {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const [metaRaw, checkinsRaw] = await Promise.all([
    getSyncValue(CLIENTES_META_KEY),
    getSyncValue(CHECKIN_KEY),
  ]);

  const meta    = (metaRaw && typeof metaRaw === "object") ? metaRaw as Record<string, ClienteMeta> : {};
  const checkins: CheckinRecord[] = Array.isArray(checkinsRaw) ? checkinsRaw as CheckinRecord[] : [];

  const thisMonday = getMondayOf(new Date());

  const alreadyIn = new Set(
    checkins
      .filter((c) => c.semanaOf === thisMonday && c.alumnoNombre)
      .map((c) => (c.alumnoNombre || "").trim().toLowerCase())
  );

  const pending = Object.keys(meta)
    .filter((nombre) => !alreadyIn.has(nombre.trim().toLowerCase()))
    .filter((nombre) => {
      const m = meta[nombre];
      return !m.pagoEstado || m.pagoEstado === "confirmado";
    });

  const done = Object.keys(meta).filter((nombre) =>
    alreadyIn.has(nombre.trim().toLowerCase())
  );

  return NextResponse.json({
    thisMonday,
    pending,
    done,
    totalClients: Object.keys(meta).length,
  });
}
