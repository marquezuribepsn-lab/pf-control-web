"use client";

import { useAlumnos } from "@/components/AlumnosProvider";
import { useSharedState } from "@/components/useSharedState";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// ─── Sync keys ────────────────────────────────────────────────
const WORKOUT_LOGS_KEY      = "pf-control-alumno-workout-logs-v1";
const COMPLETIONS_KEY       = "pf-control-alumno-entrenamiento-completados-v1";
const SESSION_FEEDBACK_KEY  = "pf-control-session-feedback-v1";

// ─── Types ────────────────────────────────────────────────────
type WorkoutLog = {
  alumnoNombre?: string;
  fecha?: string;
  pesoKg?: number;
  series?: number;
  repeticiones?: number;
  molestia?: boolean;
  createdAt?: string;
};

type TrainingCompletion = {
  alumnoNombre?: string;
  fecha?: string;
  completado?: boolean;
  createdAt?: string;
};

type SessionFeedback = {
  alumnoNombre?: string;
  measurements?: Record<string, string>;
  createdAt?: string;
};

type AlumnoStats = {
  nombre: string;
  estado: "activo" | "finalizado";
  registros30d: number;
  sesiones30d: number;
  sesionesTotales: number;
  rpePromedio: number | null;
  fatigaPromedio: number | null;
  molestias30d: number;
  adherenciaPct: number | null;
  ultimaActividad: string | null;
  tendencia: "sube" | "baja" | "estable" | "sin-datos";
  semanas: number[]; // registros por semana (last 4 weeks, oldest→newest)
};

type SortKey = "adherencia" | "nombre" | "ultima" | "molestias" | "rpe";
type FilterKey = "todos" | "activos" | "atencion";

// ─── Helpers ──────────────────────────────────────────────────
function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function daysAgo(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function formatDate(raw: string | undefined): string {
  const d = parseDate(raw);
  if (!d) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function normalizeNombre(n: string | undefined): string {
  return String(n || "").trim().toLowerCase();
}

function AdherenciaBar({ pct }: { pct: number | null }) {
  const val = pct ?? 0;
  const color =
    val >= 75 ? "pf-v2-s-ok" :
    val >= 45 ? "pf-v2-s-warn"   :
                "pf-v2-s-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 rounded-full pf-v2-s-hi">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(val, 100)}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-bold tabular-nums pf-v2-t-70">
        {pct !== null ? `${Math.round(val)}%` : "—"}
      </span>
    </div>
  );
}

function SparkLine({ weeks }: { weeks: number[] }) {
  const max = Math.max(...weeks, 1);
  const w = 56, h = 24, pad = 2;
  const pts = weeks.map((v, i) => {
    const x = pad + (i / (weeks.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const trend = weeks[weeks.length - 1] - weeks[0];
  const color = trend > 0 ? "#10b981" : trend < 0 ? "#f43f5e" : "#94a3b8";
  return (
    <svg width={w} height={h} className="overflow-visible opacity-80">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {weeks.map((v, i) => {
        const [x, y] = pts[i].split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r={2} fill={color} />;
      })}
    </svg>
  );
}

function TrendChip({ t }: { t: AlumnoStats["tendencia"] }) {
  if (t === "sube")     return <span className="pf-v2-t-ok text-xs font-bold">↑ sube</span>;
  if (t === "baja")     return <span className="pf-v2-t-danger text-xs font-bold">↓ baja</span>;
  if (t === "estable")  return <span className="pf-v2-t-50 text-xs">→ estable</span>;
  return <span className="pf-v2-t-40 text-xs">sin datos</span>;
}

function StatPill({
  label, value, tone = "slate",
}: { label: string; value: string | number; tone?: "emerald" | "rose" | "amber" | "cyan" | "slate" }) {
  const colors: Record<string, string> = {
    emerald: "pf-v2-t-ok",
    rose:    "pf-v2-t-danger",
    amber:   "pf-v2-t-warn",
    cyan:    "pf-v2-t-accent",
    slate:   "pf-v2-t-70",
  };
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-base font-black tabular-nums${colors[tone]}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide pf-v2-t-40">{label}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function AdherenciaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = String((session?.user as { role?: string } | undefined)?.role || "").toUpperCase();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  const { alumnos } = useAlumnos();

  const [workoutLogsRaw]   = useSharedState<unknown[]>([], { key: WORKOUT_LOGS_KEY,     legacyLocalStorageKey: WORKOUT_LOGS_KEY });
  const [completionsRaw]   = useSharedState<unknown[]>([], { key: COMPLETIONS_KEY,      legacyLocalStorageKey: COMPLETIONS_KEY });
  const [feedbacksRaw]     = useSharedState<unknown[]>([], { key: SESSION_FEEDBACK_KEY, legacyLocalStorageKey: SESSION_FEEDBACK_KEY });

  const [sortKey,  setSortKey]  = useState<SortKey>("adherencia");
  const [filter,   setFilter]   = useState<FilterKey>("activos");
  const [search,   setSearch]   = useState("");

  // ── parse raw ────────────────────────────────────────────────
  const workoutLogs = useMemo<WorkoutLog[]>(() => {
    if (!Array.isArray(workoutLogsRaw)) return [];
    return workoutLogsRaw.filter(Boolean).map((r: any) => ({
      alumnoNombre: String(r.alumnoNombre || r.nombre || ""),
      fecha:        String(r.fecha || r.createdAt || ""),
      pesoKg:       Number(r.pesoKg) || 0,
      series:       Number(r.series) || 0,
      repeticiones: Number(r.repeticiones) || 0,
      molestia:     Boolean(r.molestia),
      createdAt:    String(r.createdAt || r.fecha || ""),
    }));
  }, [workoutLogsRaw]);

  const completions = useMemo<TrainingCompletion[]>(() => {
    if (!Array.isArray(completionsRaw)) return [];
    return completionsRaw.filter(Boolean).map((r: any) => ({
      alumnoNombre: String(r.alumnoNombre || r.nombre || ""),
      fecha:        String(r.fecha || r.createdAt || ""),
      completado:   r.completado !== false,
      createdAt:    String(r.createdAt || r.fecha || ""),
    }));
  }, [completionsRaw]);

  const feedbacks = useMemo<SessionFeedback[]>(() => {
    if (!Array.isArray(feedbacksRaw)) return [];
    return feedbacksRaw.filter(Boolean).map((r: any) => ({
      alumnoNombre: String(r.alumnoNombre || r.nombre || ""),
      measurements: r.measurements && typeof r.measurements === "object" ? r.measurements : {},
      createdAt:    String(r.createdAt || ""),
    }));
  }, [feedbacksRaw]);

  // ── compute per-alumno stats ──────────────────────────────────
  const stats = useMemo<AlumnoStats[]>(() => {
    const now = Date.now();
    const cutoff30 = now - 30 * 86_400_000;
    const cutoffWeeks = [
      now - 28 * 86_400_000,
      now - 21 * 86_400_000,
      now - 14 * 86_400_000,
      now -  7 * 86_400_000,
      now,
    ];

    return alumnos.map((alumno) => {
      const nombre = alumno.nombre;
      const key    = normalizeNombre(nombre);

      // filter datasets to this alumno
      const myLogs = workoutLogs.filter(
        (l) => normalizeNombre(l.alumnoNombre) === key
      );
      const myComps = completions.filter(
        (c) => normalizeNombre(c.alumnoNombre) === key
      );
      const myFbs = feedbacks.filter(
        (f) => normalizeNombre(f.alumnoNombre) === key
      );

      // last 30 days
      const recent = myLogs.filter((l) => {
        const d = parseDate(l.fecha);
        return d && d.getTime() >= cutoff30;
      });

      const recentComps = myComps.filter((c) => {
        const d = parseDate(c.fecha);
        return d && d.getTime() >= cutoff30;
      });

      // registros this month
      const registros30d = recent.length;
      const sesiones30d  = recentComps.filter((c) => c.completado).length;
      const sesionesTotales = myComps.filter((c) => c.completado).length;
      const molestias30d = recent.filter((l) => l.molestia).length;

      // adherencia: completed / expected (assuming 4 sessions/week = ~17 per month)
      const expectedMonthly = 17;
      const adherenciaPct = registros30d > 0
        ? Math.min(Math.round((registros30d / expectedMonthly) * 100), 100)
        : null;

      // RPE & fatiga from feedback
      const rpeVals = myFbs
        .map((f) => parseFloat(f.measurements?.rpe || f.measurements?.RPE || ""))
        .filter((v) => !isNaN(v));
      const fatigaVals = myFbs
        .map((f) => parseFloat(f.measurements?.fatiga || f.measurements?.Fatiga || ""))
        .filter((v) => !isNaN(v));
      const rpePromedio    = rpeVals.length    ? parseFloat((rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length).toFixed(1)) : null;
      const fatigaPromedio = fatigaVals.length ? parseFloat((fatigaVals.reduce((a, b) => a + b, 0) / fatigaVals.length).toFixed(1)) : null;

      // última actividad
      const allDates = [...myLogs, ...myComps]
        .map((e) => parseDate(e.fecha || (e as any).createdAt))
        .filter(Boolean) as Date[];
      const ultimaActividad = allDates.length
        ? new Date(Math.max(...allDates.map((d) => d.getTime()))).toISOString()
        : null;

      // sparkline: registros por semana (last 4 weeks)
      const semanas = [0, 1, 2, 3].map((w) => {
        const from = cutoffWeeks[w];
        const to   = cutoffWeeks[w + 1];
        return myLogs.filter((l) => {
          const d = parseDate(l.fecha);
          return d && d.getTime() >= from && d.getTime() < to;
        }).length;
      });

      // tendencia: last 2 weeks vs first 2 weeks
      const first2 = semanas[0] + semanas[1];
      const last2  = semanas[2] + semanas[3];
      const tendencia: AlumnoStats["tendencia"] =
        first2 === 0 && last2 === 0 ? "sin-datos" :
        last2 > first2 + 1          ? "sube"      :
        last2 < first2 - 1          ? "baja"      :
                                      "estable";

      return {
        nombre,
        estado: (alumno.estado || "activo") as "activo" | "finalizado",
        registros30d,
        sesiones30d,
        sesionesTotales,
        rpePromedio,
        fatigaPromedio,
        molestias30d,
        adherenciaPct,
        ultimaActividad,
        tendencia,
        semanas,
      };
    });
  }, [alumnos, workoutLogs, completions, feedbacks]);

  // ── aggregates ────────────────────────────────────────────────
  const summary = useMemo(() => {
    const active = stats.filter((s) => s.estado === "activo");
    const withData = active.filter((s) => s.adherenciaPct !== null);
    const avgAdh = withData.length
      ? Math.round(withData.reduce((a, b) => a + (b.adherenciaPct ?? 0), 0) / withData.length)
      : null;
    const needsAttention = active.filter(
      (s) => s.adherenciaPct !== null && s.adherenciaPct < 40
    ).length;
    const conMolestias = active.filter((s) => s.molestias30d > 0).length;
    const enBaja = active.filter((s) => s.tendencia === "baja").length;
    return { total: active.length, avgAdh, needsAttention, conMolestias, enBaja };
  }, [stats]);

  // ── filtered & sorted ─────────────────────────────────────────
  const displayed = useMemo(() => {
    let rows = [...stats];

    // filter by role — CLIENTE only sees themselves
    if (role === "CLIENTE") {
      const myName = normalizeNombre(
        (session?.user as { name?: string } | undefined)?.name || ""
      );
      rows = rows.filter((s) => normalizeNombre(s.nombre) === myName);
    }

    if (filter === "activos")  rows = rows.filter((s) => s.estado === "activo");
    if (filter === "atencion") rows = rows.filter(
      (s) => s.estado === "activo" && (s.adherenciaPct ?? 100) < 50
    );
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((s) => s.nombre.toLowerCase().includes(q));
    }

    rows.sort((a, b) => {
      switch (sortKey) {
        case "nombre":
          return a.nombre.localeCompare(b.nombre, "es");
        case "ultima": {
          const da = parseDate(a.ultimaActividad ?? undefined)?.getTime() ?? 0;
          const db = parseDate(b.ultimaActividad ?? undefined)?.getTime() ?? 0;
          return db - da;
        }
        case "molestias":
          return b.molestias30d - a.molestias30d;
        case "rpe":
          return (b.rpePromedio ?? 0) - (a.rpePromedio ?? 0);
        default: // adherencia — lowest first (who needs attention)
          return (a.adherenciaPct ?? -1) - (b.adherenciaPct ?? -1);
      }
    });
    return rows;
  }, [stats, filter, search, sortKey, role, session]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 pf-v2-b-accent border-t-transparent" />
      </div>
    );
  }

  const isAdminOrCollaborator = role === "ADMIN" || role === "COLABORADOR" || role === "SUPERADMIN";

  return (
    <main className="min-h-screen pf-v2-s-deep pf-v2-t">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-black tracking-tight pf-v2-t">
            📊 Adherencia
          </h1>
          <p className="mt-1 text-sm pf-v2-t-50">
            Actividad y cumplimiento de los últimos 30 días
          </p>
        </header>

        {/* Summary cards — admin only */}
        {isAdminOrCollaborator && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Alumnos activos", value: summary.total, tone: "cyan" },
              { label: "Adherencia prom.", value: summary.avgAdh !== null ? `${summary.avgAdh}%` : "—", tone: "emerald" },
              { label: "Necesitan atención", value: summary.needsAttention, tone: "rose" },
              { label: "Con molestias", value: summary.conMolestias, tone: "amber" },
            ].map(({ label, value, tone }) => {
              const palette: Record<string, string> = {
                cyan:    "pf-v2-b-accent pf-v2-s-accent",
                emerald: "pf-v2-b-ok pf-v2-s-ok",
                rose:    "pf-v2-b-danger pf-v2-s-danger",
                amber:   "pf-v2-b-warn pf-v2-s-warn",
              };
              const valColor: Record<string, string> = {
                cyan:    "pf-v2-t-accent",
                emerald: "pf-v2-t-ok",
                rose:    "pf-v2-t-danger",
                amber:   "pf-v2-t-warn",
              };
              return (
                <article key={label} className={`rounded-2xl border p-4 ${palette[tone]}`}>
                  <p className="text-xs uppercase tracking-wide pf-v2-t-50">{label}</p>
                  <p className={`mt-2 text-3xl font-black${valColor[tone]}`}>{value}</p>
                </article>
              );
            })}
          </div>
        )}

        {/* Controls */}
        {isAdminOrCollaborator && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {/* search */}
            <input
              type="text"
              placeholder="Buscar alumno…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-xl border pf-v2-b pf-v2-s-hi px-3 text-sm pf-v2-t pf-v2-ph outline-none focus:ring-1"
            />

            {/* filter */}
            <div className="flex rounded-xl border pf-v2-b pf-v2-s-hi p-0.5">
              {(["todos", "activos", "atencion"] as FilterKey[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-[10px] px-3 py-1 text-xs font-semibold transition-all ${
                    filter === f
                      ? "pf-v2-s-accent pf-v2-t-accent shadow"
                      : "pf-v2-t-40"
                  }`}
                >
                  {f === "todos" ? "Todos" : f === "activos" ? "Activos" : "⚠ Atención"}
                </button>
              ))}
            </div>

            {/* sort */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-9 rounded-xl border pf-v2-b pf-v2-s-deep px-3 text-sm pf-v2-t-70 outline-none"
            >
              <option value="adherencia">Ordenar: Necesitan atención</option>
              <option value="ultima">Ordenar: Última actividad</option>
              <option value="nombre">Ordenar: Nombre</option>
              <option value="molestias">Ordenar: Molestias</option>
              <option value="rpe">Ordenar: RPE</option>
            </select>
          </div>
        )}

        {/* Table / Cards */}
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border pf-v2-b pf-v2-s-hi py-16">
            <span className="text-4xl">📭</span>
            <p className="pf-v2-t-40">No hay datos de adherencia todavía.</p>
            <p className="text-xs pf-v2-t-40">Los alumnos generan datos al registrar cargas y completar sesiones.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border pf-v2-b">
            {/* header row */}
            <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 border-b pf-v2-b pf-v2-s-hi px-5 py-2.5 text-xs uppercase tracking-wide pf-v2-t-40 sm:grid">
              <span>Alumno</span>
              <span>Adherencia</span>
              <span>Registros</span>
              <span>RPE prom.</span>
              <span>Molestias</span>
              <span>Tendencia</span>
              <span>Última actividad</span>
            </div>

            {displayed.map((s, idx) => {
              const needsAlert = s.estado === "activo" && (s.adherenciaPct ?? 100) < 40;
              const highRpe    = (s.rpePromedio ?? 0) >= 8;
              const hasPain    = s.molestias30d >= 3;
              return (
                <div
                  key={s.nombre}
                  className={`grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] sm:gap-4 sm:py-3 ${
                    idx % 2 === 0 ? "bg-transparent" : "pf-v2-s"
                  }${needsAlert ? "border-l-2 pf-v2-b-danger" : ""}`}
                >
                  {/* nombre */}
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      needsAlert ? "pf-v2-s-danger pf-v2-t-danger" :
                      s.tendencia === "sube" ? "pf-v2-s-ok pf-v2-t-ok" :
                      "pf-v2-s-hi pf-v2-t-70"
                    }`}>
                      {s.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold pf-v2-t leading-tight">{s.nombre}</p>
                      <p className={`text-[10px] ${s.estado === "activo" ? "pf-v2-t-ok" : "pf-v2-t-40"}`}>
                        {s.estado}
                      </p>
                    </div>
                  </div>

                  {/* adherencia */}
                  <div className="sm:flex sm:items-center">
                    <div className="w-full">
                      <div className="mb-0.5 flex items-center justify-between sm:justify-start sm:gap-2">
                        <span className="text-xs pf-v2-t-40 sm:hidden">Adherencia</span>
                      </div>
                      <AdherenciaBar pct={s.adherenciaPct} />
                    </div>
                  </div>

                  {/* registros */}
                  <div className="flex items-center justify-between sm:justify-start">
                    <span className="text-xs pf-v2-t-40 sm:hidden">Registros 30d</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold tabular-nums ${s.registros30d > 0 ? "pf-v2-t" : "pf-v2-t-40"}`}>
                        {s.registros30d}
                      </span>
                      <SparkLine weeks={s.semanas} />
                    </div>
                  </div>

                  {/* rpe */}
                  <div className="flex items-center justify-between sm:justify-start">
                    <span className="text-xs pf-v2-t-40 sm:hidden">RPE prom.</span>
                    <span className={`text-sm font-bold tabular-nums ${
                      highRpe ? "pf-v2-t-warn" : s.rpePromedio ? "pf-v2-t" : "pf-v2-t-40"
                    }`}>
                      {s.rpePromedio !== null ? `${s.rpePromedio}/10` : "—"}
                      {highRpe && " ⚠"}
                    </span>
                  </div>

                  {/* molestias */}
                  <div className="flex items-center justify-between sm:justify-start">
                    <span className="text-xs pf-v2-t-40 sm:hidden">Molestias</span>
                    <span className={`text-sm font-bold tabular-nums ${
                      hasPain ? "pf-v2-t-danger" : s.molestias30d > 0 ? "pf-v2-t-warn" : "pf-v2-t-40"
                    }`}>
                      {s.molestias30d > 0 ? `${s.molestias30d} 🚨` : "—"}
                    </span>
                  </div>

                  {/* tendencia */}
                  <div className="flex items-center justify-between sm:justify-start">
                    <span className="text-xs pf-v2-t-40 sm:hidden">Tendencia</span>
                    <TrendChip t={s.tendencia} />
                  </div>

                  {/* última actividad */}
                  <div className="flex items-center justify-between sm:justify-start">
                    <span className="text-xs pf-v2-t-40 sm:hidden">Última actividad</span>
                    <span className={`text-sm tabular-nums ${s.ultimaActividad ? "pf-v2-t-70" : "pf-v2-t-40"}`}>
                      {s.ultimaActividad
                        ? (() => {
                            const d = parseDate(s.ultimaActividad);
                            if (!d) return "—";
                            const days = daysAgo(d);
                            if (days === 0) return "Hoy";
                            if (days === 1) return "Ayer";
                            if (days < 7)  return `Hace ${days}d`;
                            return formatDate(s.ultimaActividad);
                          })()
                        : "Nunca"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs pf-v2-t-40">
          <span>Barra roja = adherencia &lt;40%</span>
          <span>⚠ RPE = promedio ≥ 8/10</span>
          <span>🚨 Molestias = reportadas al registrar carga</span>
          <span>Tendencia = últimas 4 semanas</span>
        </div>
      </div>
    </main>
  );
}
