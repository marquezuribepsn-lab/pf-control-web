"use client";

/**
 * ProgressionPanel.tsx
 * Panel de Motor de Progresión Inteligente — vista del entrenador.
 *
 * Lee datos de semana actual, workout logs, feedbacks y completions desde shared state.
 * Corre el engine de progresión por persona y permite auto-generar la próxima semana.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSharedState } from "@/components/useSharedState";
import {
  runProgressionEngine,
  analyzeWeekPerformance,
  decideProgression,
  DECISION_LABELS,
  PHASE_LABELS,
  type WorkoutLogEntry,
  type SessionFeedbackEntry,
  type TrainingCompletionEntry,
  type ProgressionSemanaPlan,
  type WeekPerformanceMetrics,
  type ProgressionDecisionType,
  type ProgressionPhase,
} from "@/lib/trainingProgressionEngine";
import type { Ejercicio } from "@/data/mockData";

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

const WORKOUT_LOGS_KEY = "pf-control-alumno-workout-logs-v1";
const SESSION_FEEDBACK_KEY = "pf-control-session-feedback-v1";
const TRAINING_COMPLETIONS_KEY = "pf-control-alumno-entrenamiento-completados-v1";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

type PersonaTipo = "jugadoras" | "alumnos";

type PlanPorPersonaLite = {
  ownerKey: string;
  tipo: PersonaTipo;
  nombre: string;
  categoria?: string;
  semanas: ProgressionSemanaPlan[];
};

type SemanaStoreLite = {
  version: 2 | 3;
  planes: PlanPorPersonaLite[];
  templates?: unknown[];
};

type PersonProgressionStatus = {
  ownerKey: string;
  nombre: string;
  tipo: PersonaTipo;
  categoria?: string;
  currentWeek: ProgressionSemanaPlan | null;
  weekNumberInPlan: number;
  metrics: WeekPerformanceMetrics | null;
  decision: ProgressionDecisionType | null;
  phase: ProgressionPhase | null;
  rationaleEs: string;
  readyToProgress: boolean;
  generating: boolean;
  generated: boolean;
};

type NotifyFn = (msg: string, kind?: "success" | "warning" | "error") => void;

// ──────────────────────────────────────────────
// NORMALIZERS
// ──────────────────────────────────────────────

function normalizeWorkoutLogs(raw: unknown): WorkoutLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const item = r as Record<string, unknown>;
      return {
        id: String(item.id || ""),
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim(),
        alumnoEmail: String(item.alumnoEmail || "").trim() || undefined,
        sessionId: String(item.sessionId || "").trim(),
        weekId: String(item.weekId || "").trim() || undefined,
        dayId: String(item.dayId || "").trim() || undefined,
        blockId: String(item.blockId || "").trim() || undefined,
        exerciseId: String(item.exerciseId || "").trim() || undefined,
        exerciseName: String(item.exerciseName || item.ejercicio || "").trim() || undefined,
        exerciseKey: String(item.exerciseKey || "").trim() || undefined,
        fecha: String(item.fecha || "").slice(0, 10),
        series: Math.max(1, Math.round(Number(item.series || 1))),
        repeticiones: Math.max(0, Math.round(Number(item.repeticiones || 0))),
        pesoKg: Math.max(0, Number(item.pesoKg ?? item.peso ?? 0)),
        molestia: Boolean(item.molestia),
        comentario: String(item.comentario || item.comentarios || "").trim() || undefined,
        createdAt: String(item.createdAt || new Date().toISOString()),
      } satisfies WorkoutLogEntry;
    })
    .filter((l) => l.alumnoNombre);
}

function normalizeSessionFeedbacks(raw: unknown): SessionFeedbackEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const item = r as Record<string, unknown>;
      const measurements = item.measurements;
      return {
        id: String(item.id || ""),
        alumnoNombre: String(item.alumnoNombre || "").trim(),
        alumnoEmail: String(item.alumnoEmail || "").trim() || undefined,
        weekId: String(item.weekId || "").trim() || undefined,
        dayId: String(item.dayId || "").trim() || undefined,
        sessionId: String(item.sessionId || "").trim() || undefined,
        measurements:
          measurements && typeof measurements === "object"
            ? (measurements as Record<string, string>)
            : undefined,
        totalWorkoutLogs: Number(item.totalWorkoutLogs) || 0,
        logsWithPain: Number(item.logsWithPain) || 0,
        createdAt: String(item.createdAt || new Date().toISOString()),
      } satisfies SessionFeedbackEntry;
    })
    .filter((f) => f.alumnoNombre);
}

function normalizeCompletions(raw: unknown): TrainingCompletionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const item = r as Record<string, unknown>;
      return {
        weekId: String(item.weekId || "").trim(),
        dayId: String(item.dayId || "").trim(),
        sessionId: String(item.sessionId || "").trim() || undefined,
        fecha: String(item.fecha || "").slice(0, 10),
        completedAt: String(item.completedAt || "").trim() || undefined,
      } satisfies TrainingCompletionEntry;
    })
    .filter((c) => c.weekId && c.dayId);
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function fmtLoad(kg: number): string {
  if (kg < 1000) return `${Math.round(kg)} kg`;
  return `${(kg / 1000).toFixed(1)} t`;
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v * 100)}%`;
}

function fmtScore(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(1);
}

function decisionColor(d: ProgressionDecisionType | null): string {
  if (!d) return "text-white/40";
  return {
    supercompensation: "text-emerald-300",
    "progressive-overload": "text-cyan-300",
    maintenance: "text-sky-300",
    conservative: "text-amber-300",
    same: "text-white/50",
    deload: "text-rose-300",
  }[d] || "text-white/50";
}

function decisionBadgeBg(d: ProgressionDecisionType | null): string {
  if (!d) return "bg-white/5 border-white/10 text-white/40";
  return {
    supercompensation: "bg-emerald-500/15 border-emerald-300/30 text-emerald-200",
    "progressive-overload": "bg-cyan-500/15 border-cyan-300/30 text-cyan-200",
    maintenance: "bg-sky-500/15 border-sky-300/30 text-sky-200",
    conservative: "bg-amber-500/15 border-amber-300/30 text-amber-200",
    same: "bg-white/5 border-white/15 text-white/55",
    deload: "bg-rose-500/15 border-rose-300/30 text-rose-200",
  }[d] || "bg-white/5 border-white/10 text-white/40";
}

function phaseBadge(p: ProgressionPhase | null): string {
  if (!p) return "bg-white/5 border-white/10 text-white/40";
  return {
    acumulacion: "bg-violet-500/15 border-violet-300/30 text-violet-200",
    intensificacion: "bg-orange-500/15 border-orange-300/30 text-orange-200",
    descarga: "bg-teal-500/15 border-teal-300/30 text-teal-200",
    mantenimiento: "bg-slate-500/15 border-slate-300/30 text-slate-300",
  }[p] || "bg-white/5 border-white/10 text-white/40";
}

function loadDeltaLabel(delta: number): string {
  if (delta === 0) return "Sin cambio";
  return `${delta > 0 ? "+" : ""}${delta}% carga`;
}

// ──────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────

type ProgressionPanelProps = {
  store: SemanaStoreLite | PlanPorPersonaLite[] | unknown;
  setStore: (updater: (prev: unknown) => unknown) => void;
  ejercicios: Ejercicio[];
  onNotify: NotifyFn;
};

export default function ProgressionPanel({
  store,
  setStore,
  ejercicios,
  onNotify,
}: ProgressionPanelProps) {
  // ── Shared state (read from the same keys as AlumnoVisionClient) ──
  const [workoutLogsRaw] = useSharedState<unknown[]>([], {
    key: WORKOUT_LOGS_KEY,
    legacyLocalStorageKey: WORKOUT_LOGS_KEY,
  });
  const [sessionFeedbacksRaw] = useSharedState<unknown[]>([], {
    key: SESSION_FEEDBACK_KEY,
    legacyLocalStorageKey: SESSION_FEEDBACK_KEY,
  });
  const [trainingCompletionsRaw] = useSharedState<unknown[]>([], {
    key: TRAINING_COMPLETIONS_KEY,
    legacyLocalStorageKey: TRAINING_COMPLETIONS_KEY,
  });

  // ── Normalize data ──
  const workoutLogs = useMemo(() => normalizeWorkoutLogs(workoutLogsRaw), [workoutLogsRaw]);
  const sessionFeedbacks = useMemo(() => normalizeSessionFeedbacks(sessionFeedbacksRaw), [sessionFeedbacksRaw]);
  const trainingCompletions = useMemo(() => normalizeCompletions(trainingCompletionsRaw), [trainingCompletionsRaw]);

  // ── Exercise map for category lookup ──
  const ejercicioMap = useMemo(() => {
    const map: Record<string, { categoria?: string; nombre?: string }> = {};
    for (const e of ejercicios) {
      map[e.id] = { categoria: e.categoria, nombre: e.nombre };
    }
    return map;
  }, [ejercicios]);

  // ── Extract planes from store ──
  const planes: PlanPorPersonaLite[] = useMemo(() => {
    if (!store) return [];
    if (Array.isArray(store)) return store as PlanPorPersonaLite[];
    const s = store as Record<string, unknown>;
    if (s.planes && Array.isArray(s.planes)) return s.planes as PlanPorPersonaLite[];
    return [];
  }, [store]);

  // ── Local generation state ──
  const [statusMap, setStatusMap] = useState<Record<string, { generating: boolean; generated: boolean }>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ready">("all");
  const generatingRef = useRef(false);

  // ── Compute progression status per person ──
  const personStatuses = useMemo<PersonProgressionStatus[]>(() => {
    return planes.map((plan) => {
      const semanas = plan.semanas || [];
      if (semanas.length === 0) {
        return {
          ownerKey: plan.ownerKey,
          nombre: plan.nombre,
          tipo: plan.tipo,
          categoria: plan.categoria,
          currentWeek: null,
          weekNumberInPlan: 0,
          metrics: null,
          decision: null,
          phase: null,
          rationaleEs: "Sin semanas en el plan.",
          readyToProgress: false,
          generating: statusMap[plan.ownerKey]?.generating ?? false,
          generated: statusMap[plan.ownerKey]?.generated ?? false,
        };
      }

      const weekNumberInPlan = semanas.length;
      const currentWeek = semanas[weekNumberInPlan - 1];

      const metrics = analyzeWeekPerformance({
        ownerKey: plan.ownerKey,
        personaName: plan.nombre,
        currentWeekPlan: currentWeek,
        workoutLogs,
        sessionFeedbacks,
        trainingCompletions,
      });

      const { decision, phase, rationaleEs } = decideProgression(metrics, weekNumberInPlan);

      // "Ready to progress" = has at least some data OR has completions this week
      const readyToProgress =
        metrics.hasData ||
        metrics.sessionsCompleted > 0 ||
        semanas.length > 0; // always show option if they have a plan

      return {
        ownerKey: plan.ownerKey,
        nombre: plan.nombre,
        tipo: plan.tipo,
        categoria: plan.categoria,
        currentWeek,
        weekNumberInPlan,
        metrics,
        decision,
        phase,
        rationaleEs,
        readyToProgress,
        generating: statusMap[plan.ownerKey]?.generating ?? false,
        generated: statusMap[plan.ownerKey]?.generated ?? false,
      };
    });
  }, [planes, workoutLogs, sessionFeedbacks, trainingCompletions, statusMap]);

  const filteredStatuses = useMemo(() => {
    if (filter === "ready") return personStatuses.filter((s) => s.readyToProgress && !s.generated);
    return personStatuses;
  }, [personStatuses, filter]);

  const readyCount = useMemo(
    () => personStatuses.filter((s) => s.readyToProgress && !s.generated).length,
    [personStatuses]
  );

  // ── Generate next week for a person ──
  const generateNextWeek = useCallback(
    async (ownerKey: string) => {
      if (generatingRef.current) return;

      const status = personStatuses.find((s) => s.ownerKey === ownerKey);
      if (!status || !status.currentWeek) {
        onNotify("No hay semana activa para este alumno.", "warning");
        return;
      }

      setStatusMap((prev) => ({
        ...prev,
        [ownerKey]: { generating: true, generated: false },
      }));
      generatingRef.current = true;

      // Minimum loading time for UX
      await new Promise((r) => setTimeout(r, 700));

      try {
        const result = runProgressionEngine({
          ownerKey,
          personaName: status.nombre,
          currentWeekPlan: status.currentWeek,
          weekNumberInPlan: status.weekNumberInPlan,
          workoutLogs,
          sessionFeedbacks,
          trainingCompletions,
          ejercicioMap,
        });

        // Update the store: append the new week to this person's plan
        setStore((prev: unknown) => {
          const raw = prev as Record<string, unknown> | null;
          if (!raw) return prev;

          const currentPlanes = Array.isArray(raw)
            ? (raw as PlanPorPersonaLite[])
            : Array.isArray(raw.planes)
            ? (raw.planes as PlanPorPersonaLite[])
            : [];

          const updatedPlanes = currentPlanes.map((plan) => {
            if (plan.ownerKey !== ownerKey) return plan;
            return {
              ...plan,
              semanas: [
                ...(plan.semanas || []),
                result.nextWeekPlan,
              ],
            };
          });

          if (Array.isArray(raw)) return updatedPlanes;
          return { ...raw, planes: updatedPlanes };
        });

        setStatusMap((prev) => ({
          ...prev,
          [ownerKey]: { generating: false, generated: true },
        }));

        const decLabel = DECISION_LABELS[result.decision];
        const loadSign = result.loadDeltaPct >= 0 ? "+" : "";
        onNotify(
          `${status.nombre} → ${result.weekLabel} generada (${decLabel}, ${loadSign}${result.loadDeltaPct}% carga)`,
          "success"
        );
      } catch (err) {
        setStatusMap((prev) => ({
          ...prev,
          [ownerKey]: { generating: false, generated: false },
        }));
        onNotify(
          err instanceof Error ? err.message : "Error al generar la semana.",
          "error"
        );
      } finally {
        generatingRef.current = false;
      }
    },
    [personStatuses, workoutLogs, sessionFeedbacks, trainingCompletions, ejercicioMap, setStore, onNotify]
  );

  // ── Batch generate all ready persons ──
  const generateAll = useCallback(async () => {
    const ready = personStatuses.filter((s) => s.readyToProgress && !s.generated && !s.generating && s.currentWeek);
    if (ready.length === 0) {
      onNotify("No hay alumnos listos para avanzar.", "warning");
      return;
    }

    for (const s of ready) {
      await generateNextWeek(s.ownerKey);
      // Small delay between generations
      await new Promise((r) => setTimeout(r, 200));
    }
  }, [personStatuses, generateNextWeek, onNotify]);

  // ── Stats summary ──
  const totalPersonas = personStatuses.length;
  const withData = personStatuses.filter((s) => s.metrics?.hasData).length;
  const generatedCount = personStatuses.filter((s) => s.generated).length;

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────

  return (
    <div className="mt-5 border-t border-white/[0.07] pt-5 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Motor de Progresión IA</h3>
          <p className="mt-1 text-xs text-white/65 max-w-xl">
            Analiza el rendimiento semanal de cada alumno (carga real, RPE, fatiga, cumplimiento)
            y genera automáticamente la próxima semana de entrenamiento con ajustes inteligentes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Filter */}
          <div className="inline-flex rounded-xl bg-white/[0.025] p-0.5 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === "all"
                  ? "bg-cyan-400/20 text-cyan-200"
                  : "text-white/50 hover:text-white/75"
              }`}
            >
              Todos ({totalPersonas})
            </button>
            <button
              type="button"
              onClick={() => setFilter("ready")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === "ready"
                  ? "bg-emerald-400/20 text-emerald-200"
                  : "text-white/50 hover:text-white/75"
              }`}
            >
              Listos ({readyCount})
            </button>
          </div>

          {/* Batch generate */}
          <button
            type="button"
            onClick={generateAll}
            disabled={readyCount === 0}
            className={`rounded-xl border px-4 py-1.5 text-xs font-bold transition ${
              readyCount > 0
                ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                : "border-white/10 bg-white/[0.03] text-white/30 cursor-not-allowed"
            }`}
          >
            ⚡ Auto-avanzar todos ({readyCount})
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Personas con plan", value: totalPersonas, color: "text-white/85" },
          { label: "Con registros esta semana", value: withData, color: "text-cyan-300" },
          { label: "Listos para avanzar", value: readyCount, color: "text-emerald-300" },
          { label: "Semanas generadas hoy", value: generatedCount, color: "text-violet-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wide text-white/45">{label}</p>
            <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filteredStatuses.length === 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-white/45">
            {filter === "ready"
              ? "Ningún alumno listo para avanzar aún."
              : "No hay alumnos con planes activos."}
          </p>
          {filter === "ready" && (
            <p className="mt-2 text-xs text-white/30">
              Asignale un template a tus alumnos desde la pestaña «Mis templates».
            </p>
          )}
        </div>
      )}

      {/* Person cards */}
      <div className="space-y-3">
        {filteredStatuses.map((status) => {
          const isExpanded = expandedKey === status.ownerKey;
          const m = status.metrics;
          const deltas = status.decision
            ? (() => {
                const d = status.decision;
                const map: Record<ProgressionDecisionType, number> = {
                  supercompensation: 7,
                  "progressive-overload": 4,
                  maintenance: 2,
                  conservative: 1.5,
                  same: 0,
                  deload: -20,
                };
                return map[d];
              })()
            : null;

          return (
            <div
              key={status.ownerKey}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden"
            >
              {/* Card header */}
              <div className="flex flex-wrap items-center gap-3 p-4">
                {/* Person info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{status.nombre}</span>
                    {status.categoria && (
                      <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                        {status.categoria}
                      </span>
                    )}
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                      {status.tipo === "alumnos" ? "Alumno" : "Jugadora"}
                    </span>
                    {status.currentWeek && (
                      <span className="text-[11px] text-white/40">
                        {status.currentWeek.nombre} (semana {status.weekNumberInPlan})
                      </span>
                    )}
                  </div>

                  {/* Metrics row */}
                  {m && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <MetricChip
                        label="Completadas"
                        value={`${m.sessionsCompleted}/${m.sessionsPlanned}`}
                        sub={fmtPct(m.completionRate)}
                        ok={m.completionRate >= 0.75}
                      />
                      <MetricChip
                        label="RPE prom."
                        value={fmtScore(m.avgRpe)}
                        ok={m.avgRpe !== null && m.avgRpe <= 7}
                        warn={m.avgRpe !== null && m.avgRpe >= 8}
                      />
                      <MetricChip
                        label="Fatiga prom."
                        value={fmtScore(m.avgFatigue)}
                        ok={m.avgFatigue !== null && m.avgFatigue <= 6}
                        warn={m.avgFatigue !== null && m.avgFatigue >= 8}
                      />
                      <MetricChip
                        label="Carga real"
                        value={m.totalRealLoad > 0 ? fmtLoad(m.totalRealLoad) : "—"}
                      />
                      <MetricChip
                        label="Ejercicios"
                        value={String(m.exercisesLogged)}
                      />
                      {m.painReportCount > 0 && (
                        <MetricChip
                          label="Molestias"
                          value={String(m.painReportCount)}
                          warn
                        />
                      )}
                    </div>
                  )}

                  {!m && (
                    <p className="mt-1 text-xs text-white/35">Sin plan de semanas activo.</p>
                  )}
                </div>

                {/* Decision badge + action */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {status.decision && (
                    <div className="text-right">
                      <span
                        className={`inline-block rounded-lg border px-2.5 py-1 text-[11px] font-bold ${decisionBadgeBg(status.decision)}`}
                      >
                        {DECISION_LABELS[status.decision]}
                      </span>
                      {deltas !== null && (
                        <p className={`mt-0.5 text-[10px] font-semibold ${decisionColor(status.decision)}`}>
                          {loadDeltaLabel(deltas)}
                        </p>
                      )}
                      {status.phase && (
                        <span
                          className={`mt-0.5 inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${phaseBadge(status.phase)}`}
                        >
                          {PHASE_LABELS[status.phase]}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Generate button */}
                  {status.currentWeek && !status.generated && (
                    <button
                      type="button"
                      onClick={() => generateNextWeek(status.ownerKey)}
                      disabled={status.generating}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        status.generating
                          ? "border-white/10 bg-white/5 text-white/30 cursor-wait"
                          : "border-cyan-300/35 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25 active:scale-95"
                      }`}
                    >
                      {status.generating ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
                          </svg>
                          Generando…
                        </span>
                      ) : (
                        "Generar semana →"
                      )}
                    </button>
                  )}

                  {status.generated && (
                    <span className="rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200">
                      ✓ Generada
                    </span>
                  )}

                  {/* Expand/collapse rationale */}
                  {status.rationaleEs && status.decision && (
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isExpanded ? null : status.ownerKey)}
                      className="rounded-lg p-1.5 text-white/35 hover:text-white/65 transition"
                      title="Ver análisis detallado"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded rationale */}
              {isExpanded && status.rationaleEs && (
                <div className="border-t border-white/[0.06] bg-white/[0.015] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-1.5">
                    Razonamiento del Motor
                  </p>
                  <p className="text-xs text-white/65 leading-relaxed">{status.rationaleEs}</p>

                  {m && m.feedbackCount > 0 && (
                    <p className="mt-2 text-[11px] text-white/40">
                      Basado en {m.feedbackCount} sesión(es) de feedback y {m.exercisesLogged} registros de ejercicio.
                    </p>
                  )}
                  {m && !m.hasData && (
                    <p className="mt-2 text-[11px] text-amber-300/70">
                      Sin datos de rendimiento esta semana — se usaron parámetros de posición en el mesociclo.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer explanation */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35 mb-2">
          ¿Cómo funciona el motor?
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Lee los datos",
              desc: "Analiza registros de ejercicio (peso, series, reps), feedback post-sesión (RPE, fatiga) y completitud de la semana.",
              icon: "📊",
            },
            {
              title: "Decide la progresión",
              desc: "Aplica un árbol de decisión basado en fatiga, cumplimiento y posición en el mesociclo de 4 semanas.",
              icon: "🧠",
            },
            {
              title: "Ajusta por categoría",
              desc: "Cada tipo de ejercicio recibe ajustes específicos: pliométrico solo volumen, fuerza carga+volumen, isométrico duración.",
              icon: "🎯",
            },
            {
              title: "Usa pesos reales",
              desc: "Si el alumno registró sus cargas esta semana, el motor usa esos datos como base, no el template original.",
              icon: "⚡",
            },
          ].map(({ title, desc, icon }) => (
            <div key={title} className="space-y-1">
              <p className="text-[11px] font-semibold text-white/55">
                {icon} {title}
              </p>
              <p className="text-[10px] text-white/35 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────

function MetricChip({
  label,
  value,
  sub,
  ok,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  ok?: boolean;
  warn?: boolean;
}) {
  const color = warn
    ? "text-rose-300"
    : ok
    ? "text-emerald-300"
    : "text-white/65";

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-white/35">{label}</span>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-white/30">{sub}</span>}
    </div>
  );
}
