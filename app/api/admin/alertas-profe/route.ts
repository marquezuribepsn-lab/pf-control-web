/**
 * GET /api/admin/alertas-profe
 * Returns all actionable alerts for the professor:
 *   - Subscription expirations (≤ 7 days)
 *   - Inactive students (> 14 days without activity)
 *   - Health alerts from check-ins (Claude nivel alto)
 *   - Students who haven't checked in this week
 *   - Unread chat messages
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue } from "@/lib/syncStore";

const CLIENTES_META_KEY  = "pf-control-clientes-meta-v1";
const WORKOUT_LOGS_KEY   = "pf-control-alumno-workout-logs-v1";
const COMPLETIONS_KEY    = "pf-control-alumno-entrenamiento-completados-v1";
const CHECKIN_KEY        = "pf-control-checkin-semanal-v1";
const MENSAJES_KEY       = "pf-control-mensajes-v1";

export type AlertNivel = "alta" | "media" | "baja";
export type AlertType  = "vencimiento" | "inactividad" | "salud" | "checkin-pendiente" | "mensaje";

export type AlertItem = {
  type:          AlertType;
  nivel:         AlertNivel;
  alumnoNombre:  string;
  detalle:       string;
  fecha?:        string;
  diasRestantes?: number;
  href?:         string;
};

export type AlertasResponse = {
  total:           number;
  urgente:         number;   // alta prioridad
  vencimientos:    AlertItem[];
  inactivos:       AlertItem[];
  salud:           AlertItem[];
  sinCheckin:      AlertItem[];
  mensajes:        AlertItem[];
  generadoEn:      string;
};

function isAdmin(session: any): boolean {
  const role = String(session?.user?.role || "").toUpperCase();
  return role === "ADMIN" || role === "SUPERADMIN";
}

function isByCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const bearer = (req as any).headers?.get("authorization") ?? "";
  if (bearer === `Bearer ${secret}`) return true;
  try { return new URL((req as any).url).searchParams.get("secret") === secret; } catch { return false; }
}

function parseDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(req: Request) {
  if (!isByCronSecret(req)) {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const [metaRaw, logsRaw, completionsRaw, checkinsRaw, mensajesRaw] = await Promise.all([
    getSyncValue(CLIENTES_META_KEY),
    getSyncValue(WORKOUT_LOGS_KEY),
    getSyncValue(COMPLETIONS_KEY),
    getSyncValue(CHECKIN_KEY),
    getSyncValue(MENSAJES_KEY),
  ]);

  const now       = new Date();
  const today     = new Date(now); today.setHours(0, 0, 0, 0);
  const thisMonday = getMondayOf(now);

  // ── Meta data ──────────────────────────────────────────────────
  type ClienteMeta = {
    telefono?: string;
    codigoPais?: string;
    email?: string;
    pagoEstado?: string;
    endDate?: string;
    estado?: string;
  };
  const meta = (metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw))
    ? metaRaw as Record<string, ClienteMeta>
    : {};

  // Active client names (pagado/confirmado or no estado set)
  const activeNames = new Set(
    Object.entries(meta)
      .filter(([, m]) => !m.pagoEstado || m.pagoEstado === "confirmado")
      .map(([name]) => name.trim().toLowerCase())
  );

  // ── 1. VENCIMIENTOS ────────────────────────────────────────────
  const vencimientos: AlertItem[] = [];
  for (const [nombre, m] of Object.entries(meta)) {
    if (m.pagoEstado && m.pagoEstado !== "confirmado") continue;
    const end = parseDate(m.endDate);
    if (!end) continue;
    const dias = daysBetween(today, end);
    if (dias < 0 || dias > 7) continue;
    vencimientos.push({
      type:  "vencimiento",
      nivel: dias <= 2 ? "alta" : dias <= 5 ? "media" : "baja",
      alumnoNombre: nombre,
      detalle: dias === 0 ? "Vence hoy" : `Vence en ${dias} día${dias === 1 ? "" : "s"}`,
      fecha:  end.toISOString().slice(0, 10),
      diasRestantes: dias,
      href: "/admin/pagos",
    });
  }
  vencimientos.sort((a, b) => (a.diasRestantes ?? 99) - (b.diasRestantes ?? 99));

  // ── 2. INACTIVIDAD ────────────────────────────────────────────
  type Log = { alumnoNombre?: string; fecha?: string };
  const logs: Log[]        = Array.isArray(logsRaw)        ? logsRaw as Log[]        : [];
  const completions: Log[] = Array.isArray(completionsRaw) ? completionsRaw as Log[] : [];

  // Last activity per alumno
  const lastActivity: Record<string, Date> = {};
  [...logs, ...completions].forEach((r) => {
    const n = (r.alumnoNombre || "").trim().toLowerCase();
    if (!n) return;
    const d = parseDate(r.fecha);
    if (!d) return;
    if (!lastActivity[n] || d > lastActivity[n]) lastActivity[n] = d;
  });

  const INACTIVITY_DAYS = 14;
  const inactivos: AlertItem[] = [];
  for (const nombreLower of activeNames) {
    const last = lastActivity[nombreLower];
    const diasSin = last ? daysBetween(last, today) : null;
    if (diasSin === null || diasSin > INACTIVITY_DAYS) {
      // Find original casing
      const originalName = Object.keys(meta).find(
        (k) => k.trim().toLowerCase() === nombreLower
      ) || nombreLower;
      inactivos.push({
        type:  "inactividad",
        nivel: diasSin === null || diasSin > 30 ? "alta" : "media",
        alumnoNombre: originalName,
        detalle: diasSin === null
          ? "Sin actividad registrada"
          : `Sin actividad hace ${diasSin} días`,
        fecha: last?.toISOString().slice(0, 10),
        href: "/adherencia",
      });
    }
  }
  inactivos.sort((a, b) => a.alumnoNombre.localeCompare(b.alumnoNombre));

  // ── 3. SALUD — check-ins con alerta ───────────────────────────
  type CheckIn = {
    alumnoNombre?: string;
    semanaOf?: string;
    claudeNivel?: string;
    claudeAlerta?: boolean;
    claudeResumen?: string;
    dolorDetalle?: string;
    cambios?: string;
    createdAt?: string;
    alertaVista?: boolean;
  };
  const checkins: CheckIn[] = Array.isArray(checkinsRaw) ? checkinsRaw as CheckIn[] : [];

  const salud: AlertItem[] = checkins
    .filter((c) => (c.claudeAlerta || c.claudeNivel === "alto") && !c.alertaVista)
    .map((c) => ({
      type:  "salud" as AlertType,
      nivel: "alta" as AlertNivel,
      alumnoNombre: c.alumnoNombre || "Alumno",
      detalle: c.claudeResumen || c.dolorDetalle || c.cambios || "Alerta en check-in",
      fecha:   c.createdAt,
      href: `/clientes`,
    }));

  // ── 4. SIN CHECK-IN ESTA SEMANA ───────────────────────────────
  const checkinThisWeek = new Set(
    checkins
      .filter((c) => c.semanaOf === thisMonday && c.alumnoNombre)
      .map((c) => (c.alumnoNombre || "").trim().toLowerCase())
  );

  const sinCheckin: AlertItem[] = [];
  for (const nombreLower of activeNames) {
    if (!checkinThisWeek.has(nombreLower)) {
      const originalName = Object.keys(meta).find(
        (k) => k.trim().toLowerCase() === nombreLower
      ) || nombreLower;
      sinCheckin.push({
        type:  "checkin-pendiente",
        nivel: "baja",
        alumnoNombre: originalName,
        detalle: "No envió check-in esta semana",
        href: "/clientes",
      });
    }
  }

  // ── 5. MENSAJES NO LEÍDOS ────────────────────────────────────
  type Mensaje = {
    from?: string;
    to?: string;
    role?: string;
    read?: boolean;
    alumnoNombre?: string;
    text?: string;
    createdAt?: string;
  };
  const mensajes: Mensaje[] = Array.isArray(mensajesRaw) ? mensajesRaw as Mensaje[] : [];

  // Unread messages sent by alumnos (role === "alumno") not yet read by profe
  const unreadByAlumno: Record<string, { count: number; last: string; fecha?: string }> = {};
  mensajes.forEach((m) => {
    if (m.role !== "alumno" || m.read) return;
    const nombre = (m.alumnoNombre || m.from || "").trim();
    if (!nombre) return;
    if (!unreadByAlumno[nombre]) unreadByAlumno[nombre] = { count: 0, last: "", fecha: undefined };
    unreadByAlumno[nombre].count++;
    unreadByAlumno[nombre].last  = m.text?.slice(0, 60) || "";
    unreadByAlumno[nombre].fecha = m.createdAt;
  });

  const mensajesAlerts: AlertItem[] = Object.entries(unreadByAlumno).map(
    ([nombre, data]) => ({
      type:  "mensaje" as AlertType,
      nivel: data.count >= 3 ? "alta" : "media" as AlertNivel,
      alumnoNombre: nombre,
      detalle: `${data.count} mensaje${data.count > 1 ? "s" : ""} sin leer — "${data.last}"`,
      fecha:   data.fecha,
      href: "/mensajes",
    })
  );

  // ── Totals ────────────────────────────────────────────────────
  const all = [...vencimientos, ...inactivos, ...salud, ...mensajesAlerts];
  const urgente = all.filter((a) => a.nivel === "alta").length;

  const response: AlertasResponse = {
    total:        all.length + sinCheckin.length,
    urgente,
    vencimientos,
    inactivos,
    salud,
    sinCheckin,
    mensajes:     mensajesAlerts,
    generadoEn:   now.toISOString(),
  };

  return NextResponse.json(response);
}
