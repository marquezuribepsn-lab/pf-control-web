/**
 * POST /api/admin/resumen-semanal
 * Generates a weekly summary of all platform activity.
 * - Reads workout logs, check-ins, session feedback, training completions for current week
 * - If ANTHROPIC_API_KEY is set: uses Claude to generate a narrative summary
 * - Sends the summary via WhatsApp to the admin
 * - Returns structured stats
 *
 * Throttled to once per day unless force=true.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import { sendWhatsAppInternalAlert } from "@/lib/whatsappAlerts";

const WORKOUT_LOGS_KEY    = "pf-control-alumno-workout-logs-v1";
const COMPLETIONS_KEY     = "pf-control-alumno-entrenamiento-completados-v1";
const CHECKIN_KEY         = "pf-control-checkin-semanal-v1";
const FEEDBACK_KEY        = "pf-control-session-feedback-v1";
const LAST_RESUMEN_RUN    = "pf-control-resumen-semanal-last-run-v1";

type WorkoutLog = {
  alumnoNombre?: string;
  fecha?: string;
  ejercicioId?: string;
  carga?: number | string;
};

type Completion = {
  alumnoNombre?: string;
  fecha?: string;
  diaLabel?: string;
};

type CheckIn = {
  alumnoNombre?: string;
  semanaOf?: string;
  sensacion?: number;
  tieneDolor?: boolean;
  dolorDetalle?: string;
  cambiosContexto?: string;
  claudeNivel?: string;
  claudeAlerta?: boolean;
};

type SessionFeedback = {
  alumnoNombre?: string;
  fecha?: string;
  rpe?: number;
  fatiga?: number;
  molestias?: string;
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

function parseDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function isThisWeek(dateStr?: string | null, monday?: string): boolean {
  if (!dateStr || !monday) return false;
  const d = parseDate(dateStr);
  if (!d) return false;
  const mondayDate = new Date(monday);
  const sundayDate = new Date(monday);
  sundayDate.setDate(sundayDate.getDate() + 6);
  sundayDate.setHours(23, 59, 59, 999);
  return d >= mondayDate && d <= sundayDate;
}

// ── Claude narrative generation ────────────────────────────────────
async function generateNarrative(stats: object): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const prompt = `Sos el asistente de un preparador físico. Generá un resumen ejecutivo semanal en español, profesional y conciso (máximo 200 palabras), basado en estos datos de la semana:

${JSON.stringify(stats, null, 2)}

El resumen debe:
- Empezar con una evaluación general del nivel de actividad
- Mencionar si hay alertas de salud que requieren atención
- Destacar tendencias positivas y negativas
- Terminar con una recomendación concreta para la próxima semana
- Usar emojis ocasionales para mejor lectura en WhatsApp
- NO incluir JSON ni datos técnicos, solo narrativa profesional`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json() as { content?: Array<{ type: string; text: string }> };
    return data.content?.find((c) => c.type === "text")?.text?.trim() || null;
  } catch {
    return null;
  }
}

// ── Build plain-text summary (no AI) ──────────────────────────────
function buildPlainSummary(stats: {
  weekLabel: string;
  totalLogs: number;
  totalCompletions: number;
  totalCheckins: number;
  avgSensacion: number | null;
  alumnosActivos: number;
  alertas: string[];
  topEjercicios: string[];
  avgRpe: number | null;
}): string {
  const lines: string[] = [
    `📊 *Resumen semanal — ${stats.weekLabel}*`,
    ``,
    `🏋️ *Actividad:*`,
    `• Registros de carga: ${stats.totalLogs}`,
    `• Entrenamientos completados: ${stats.totalCompletions}`,
    `• Check-ins recibidos: ${stats.totalCheckins}`,
    `• Alumnos activos: ${stats.alumnosActivos}`,
  ];

  if (stats.avgSensacion !== null) {
    const emoji = stats.avgSensacion >= 4 ? "😄" : stats.avgSensacion >= 3 ? "😐" : "😕";
    lines.push(`• Sensación promedio: ${stats.avgSensacion.toFixed(1)}/5 ${emoji}`);
  }

  if (stats.avgRpe !== null) {
    lines.push(`• RPE promedio: ${stats.avgRpe.toFixed(1)}/10`);
  }

  if (stats.topEjercicios.length > 0) {
    lines.push(``, `💪 *Ejercicios más registrados:*`);
    stats.topEjercicios.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  }

  if (stats.alertas.length > 0) {
    lines.push(``, `⚠️ *Alertas que requieren atención:*`);
    stats.alertas.forEach((a) => lines.push(`• ${a}`));
  } else {
    lines.push(``, `✅ Sin alertas de salud esta semana.`);
  }

  lines.push(``, `_pf-control.com_`);
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  if (!isByCronSecret(req)) {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let body: { force?: boolean; sendWhatsApp?: boolean } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const force        = Boolean(body.force);
  const sendWhatsApp = body.sendWhatsApp !== false; // default true

  // Throttle: once per day
  if (!force) {
    const lastRun = await getSyncValue(LAST_RESUMEN_RUN);
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

  // Load all data sources in parallel
  const [logsRaw, completionsRaw, checkinsRaw, feedbackRaw] = await Promise.all([
    getSyncValue(WORKOUT_LOGS_KEY),
    getSyncValue(COMPLETIONS_KEY),
    getSyncValue(CHECKIN_KEY),
    getSyncValue(FEEDBACK_KEY),
  ]);

  const thisMonday = getMondayOf(new Date());
  const weekLabel  = new Date(thisMonday).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  const logs: WorkoutLog[]          = Array.isArray(logsRaw)        ? logsRaw as WorkoutLog[]        : [];
  const completions: Completion[]   = Array.isArray(completionsRaw) ? completionsRaw as Completion[] : [];
  const checkins: CheckIn[]         = Array.isArray(checkinsRaw)    ? checkinsRaw as CheckIn[]       : [];
  const feedbacks: SessionFeedback[] = Array.isArray(feedbackRaw)   ? feedbackRaw as SessionFeedback[] : [];

  // Filter to current week
  const weekLogs        = logs.filter((l)  => isThisWeek(l.fecha, thisMonday));
  const weekCompletions = completions.filter((c) => isThisWeek(c.fecha, thisMonday));
  const weekCheckins    = checkins.filter((c) => c.semanaOf === thisMonday);
  const weekFeedbacks   = feedbacks.filter((f) => isThisWeek(f.fecha, thisMonday));

  // Active alumnos (unique names across all activity)
  const alumnosSet = new Set<string>();
  [...weekLogs, ...weekCompletions, ...weekCheckins, ...weekFeedbacks].forEach((r: any) => {
    if (r.alumnoNombre) alumnosSet.add(String(r.alumnoNombre).trim().toLowerCase());
  });

  // Average sensación
  const sensaciones = weekCheckins.map((c) => c.sensacion).filter((s) => typeof s === "number" && s > 0) as number[];
  const avgSensacion = sensaciones.length > 0
    ? sensaciones.reduce((a, b) => a + b, 0) / sensaciones.length
    : null;

  // Average RPE
  const rpes = weekFeedbacks.map((f) => f.rpe).filter((r) => typeof r === "number" && r > 0) as number[];
  const avgRpe = rpes.length > 0
    ? rpes.reduce((a, b) => a + b, 0) / rpes.length
    : null;

  // Top ejercicios
  const ejercicioCount: Record<string, number> = {};
  weekLogs.forEach((l) => {
    if (l.ejercicioId) {
      ejercicioCount[l.ejercicioId] = (ejercicioCount[l.ejercicioId] || 0) + 1;
    }
  });
  const topEjercicios = Object.entries(ejercicioCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name.replace(/[-_]/g, " ")} (${count}x)`);

  // Alerts: claude-flagged check-ins + high fatigue
  const alertas: string[] = [];

  weekCheckins.forEach((c) => {
    if (c.claudeAlerta || c.claudeNivel === "alto") {
      const nombre = c.alumnoNombre || "Alumno";
      const detalle = c.dolorDetalle || c.cambiosContexto || "";
      alertas.push(`${nombre}: ${detalle.slice(0, 80) || "Nivel alto en check-in"}`);
    }
  });

  weekFeedbacks.forEach((f) => {
    if ((f.fatiga ?? 0) >= 8 && f.alumnoNombre) {
      alertas.push(`${f.alumnoNombre}: fatiga alta (${f.fatiga}/10)`);
    }
    if (f.molestias && f.alumnoNombre) {
      alertas.push(`${f.alumnoNombre}: molestia reportada — ${f.molestias.slice(0, 60)}`);
    }
  });

  const stats = {
    weekLabel,
    thisMonday,
    totalLogs: weekLogs.length,
    totalCompletions: weekCompletions.length,
    totalCheckins: weekCheckins.length,
    alumnosActivos: alumnosSet.size,
    avgSensacion,
    avgRpe,
    topEjercicios,
    alertas: alertas.slice(0, 5), // cap at 5 alerts
  };

  // Generate message
  const aiNarrative = await generateNarrative(stats);
  const message = aiNarrative || buildPlainSummary(stats);

  // Send WhatsApp
  let waSent = false;
  if (sendWhatsApp) {
    try {
      const waResult = await sendWhatsAppInternalAlert(message);
      waSent = Boolean((waResult as any)?.ok);
    } catch {
      waSent = false;
    }
  }

  await setSyncValue(LAST_RESUMEN_RUN, new Date().toISOString());

  return NextResponse.json({
    ok: true,
    stats,
    message,
    aiGenerated: Boolean(aiNarrative),
    waSent,
    thisMonday,
  });
}

// GET — returns current week stats without sending
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [logsRaw, completionsRaw, checkinsRaw, feedbackRaw] = await Promise.all([
    getSyncValue(WORKOUT_LOGS_KEY),
    getSyncValue(COMPLETIONS_KEY),
    getSyncValue(CHECKIN_KEY),
    getSyncValue(FEEDBACK_KEY),
  ]);

  const thisMonday = getMondayOf(new Date());
  const weekLabel  = new Date(thisMonday).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  const logs: WorkoutLog[]           = Array.isArray(logsRaw)        ? logsRaw as WorkoutLog[]        : [];
  const completions: Completion[]    = Array.isArray(completionsRaw) ? completionsRaw as Completion[] : [];
  const checkins: CheckIn[]          = Array.isArray(checkinsRaw)    ? checkinsRaw as CheckIn[]       : [];
  const feedbacks: SessionFeedback[] = Array.isArray(feedbackRaw)    ? feedbackRaw as SessionFeedback[] : [];

  const weekLogs        = logs.filter((l) => isThisWeek(l.fecha, thisMonday));
  const weekCompletions = completions.filter((c) => isThisWeek(c.fecha, thisMonday));
  const weekCheckins    = checkins.filter((c) => c.semanaOf === thisMonday);
  const weekFeedbacks   = feedbacks.filter((f) => isThisWeek(f.fecha, thisMonday));

  const alumnosSet = new Set<string>();
  [...weekLogs, ...weekCompletions, ...weekCheckins, ...weekFeedbacks].forEach((r: any) => {
    if (r.alumnoNombre) alumnosSet.add(String(r.alumnoNombre).trim().toLowerCase());
  });

  const sensaciones = weekCheckins.map((c) => c.sensacion).filter((s): s is number => typeof s === "number" && s > 0);
  const avgSensacion = sensaciones.length > 0
    ? sensaciones.reduce((a, b) => a + b, 0) / sensaciones.length
    : null;

  return NextResponse.json({
    thisMonday,
    weekLabel,
    totalLogs: weekLogs.length,
    totalCompletions: weekCompletions.length,
    totalCheckins: weekCheckins.length,
    alumnosActivos: alumnosSet.size,
    avgSensacion,
    checkinsPending: checkins
      .filter((c) => c.semanaOf !== thisMonday && c.alumnoNombre)
      .map((c) => c.alumnoNombre),
    alertas: weekCheckins
      .filter((c) => c.claudeAlerta || c.claudeNivel === "alto")
      .map((c) => ({ nombre: c.alumnoNombre, nivel: c.claudeNivel })),
  });
}
