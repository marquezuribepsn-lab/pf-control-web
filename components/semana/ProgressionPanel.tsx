"use client";

/**
 * ProgressionPanel.tsx — v3
 *
 * Mejoras v3 (sobre v2):
 * - Vista previa antes de confirmar (preview → confirm, 2 pasos)
 * - Tabla comparativa ejercicios antes → después con factor de categoría
 * - Confirmación explícita para Auto-avanzar todos
 * - Rollback / deshacer última semana generada
 * - Cap de historial (MAX_HISTORY_PER_PERSON = 60)
 * - Label en sparkline ("Carga %")
 * - Override slider con descripción de rangos
 * - Empty state con guía
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";
import {
  runProgressionEngine,
  analyzeWeekPerformance,
  decideProgression,
  detectPlateau,
  DECISION_LABELS,
  PHASE_LABELS,
  type WorkoutLogEntry,
  type SessionFeedbackEntry,
  type TrainingCompletionEntry,
  type ProgressionSemanaPlan,
  type ProgressionExerciseDraft,
  type WeekPerformanceMetrics,
  type ProgressionDecisionType,
  type ProgressionPhase,
  type ProgressionHistoryRecord,
  type PlateauAnalysis,
  type ProgressionOutput,
} from "@/lib/trainingProgressionEngine";
import type { Ejercicio } from "@/data/mockData";

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

const WORKOUT_LOGS_KEY         = "pf-control-alumno-workout-logs-v1";
const SESSION_FEEDBACK_KEY     = "pf-control-session-feedback-v1";
const TRAINING_COMPLETIONS_KEY = "pf-control-alumno-entrenamiento-completados-v1";
const PROGRESSION_HISTORY_KEY  = "pf-control-progression-history-v1";
const STALE_DAYS               = 5;
const MAX_HISTORY_PER_PERSON   = 60;

const DECISION_DELTA_MAP: Record<ProgressionDecisionType, number> = {
  supercompensation:      7,
  "progressive-overload": 4,
  maintenance:            2,
  conservative:           1.5,
  same:                   0,
  deload:                -20,
  "plateau-break":        -8,
};

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

type PersonStatus = {
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
  plateau: PlateauAnalysis | null;
  isStale: boolean;
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
      const i = r as Record<string, unknown>;
      return {
        id: String(i.id || ""),
        alumnoNombre: String(i.alumnoNombre || i.alumno || "").trim(),
        alumnoEmail: String(i.alumnoEmail || "").trim() || undefined,
        sessionId: String(i.sessionId || "").trim(),
        weekId: String(i.weekId || "").trim() || undefined,
        dayId: String(i.dayId || "").trim() || undefined,
        blockId: String(i.blockId || "").trim() || undefined,
        exerciseId: String(i.exerciseId || "").trim() || undefined,
        exerciseName: String(i.exerciseName || i.ejercicio || "").trim() || undefined,
        exerciseKey: String(i.exerciseKey || "").trim() || undefined,
        fecha: String(i.fecha || "").slice(0, 10),
        series: Math.max(1, Math.round(Number(i.series || 1))),
        repeticiones: Math.max(0, Math.round(Number(i.repeticiones || 0))),
        pesoKg: Math.max(0, Number(i.pesoKg ?? i.peso ?? 0)),
        molestia: Boolean(i.molestia),
        comentario: String(i.comentario || i.comentarios || "").trim() || undefined,
        createdAt: String(i.createdAt || new Date().toISOString()),
      } satisfies WorkoutLogEntry;
    })
    .filter((l) => l.alumnoNombre);
}

function normalizeSessionFeedbacks(raw: unknown): SessionFeedbackEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const i = r as Record<string, unknown>;
      const m = i.measurements;
      return {
        id: String(i.id || ""),
        alumnoNombre: String(i.alumnoNombre || "").trim(),
        alumnoEmail: String(i.alumnoEmail || "").trim() || undefined,
        weekId: String(i.weekId || "").trim() || undefined,
        dayId: String(i.dayId || "").trim() || undefined,
        sessionId: String(i.sessionId || "").trim() || undefined,
        measurements: m && typeof m === "object" ? (m as Record<string, string>) : undefined,
        totalWorkoutLogs: Number(i.totalWorkoutLogs) || 0,
        logsWithPain: Number(i.logsWithPain) || 0,
        createdAt: String(i.createdAt || new Date().toISOString()),
      } satisfies SessionFeedbackEntry;
    })
    .filter((f) => f.alumnoNombre);
}

function normalizeCompletions(raw: unknown): TrainingCompletionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const i = r as Record<string, unknown>;
      return {
        weekId: String(i.weekId || "").trim(),
        dayId: String(i.dayId || "").trim(),
        sessionId: String(i.sessionId || "").trim() || undefined,
        fecha: String(i.fecha || "").slice(0, 10),
        completedAt: String(i.completedAt || "").trim() || undefined,
      } satisfies TrainingCompletionEntry;
    })
    .filter((c) => c.weekId && c.dayId);
}

function normalizeHistoryRecords(raw: unknown): ProgressionHistoryRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r) => r && typeof r === "object" && typeof (r as Record<string, unknown>).ownerKey === "string"
  ) as ProgressionHistoryRecord[];
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

const fmtLoad  = (kg: number) => (kg < 1000 ? `${Math.round(kg)} kg` : `${(kg / 1000).toFixed(1)} t`);
const fmtPct   = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const fmtScore = (v: number | null) => (v === null ? "—" : v.toFixed(1));
const fmtDate  = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }); }
  catch { return iso.slice(0, 10); }
};
const daysAgo  = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

function decisionColor(d: ProgressionDecisionType | null): string {
  if (!d) return "pf-v2-t-40";
  return ({ supercompensation: "pf-v2-t-ok", "progressive-overload": "pf-v2-t-accent", maintenance: "pf-v2-t-blue", conservative: "pf-v2-t-warn", same: "pf-v2-t-50", deload: "pf-v2-t-danger", "plateau-break": "pf-v2-t-warn" } as Record<string, string>)[d] ?? "pf-v2-t-50";
}

function decisionBadgeBg(d: ProgressionDecisionType | null): string {
  if (!d) return "pf-v2-s-hi pf-v2-b pf-v2-t-40";
  return ({ supercompensation: "pf-v2-s-ok pf-v2-b-ok pf-v2-t-ok", "progressive-overload": "pf-v2-s-accent pf-v2-b-accent pf-v2-t-accent", maintenance: "pf-v2-s-blue pf-v2-b-blue pf-v2-t-blue", conservative: "pf-v2-s-warn pf-v2-b-warn pf-v2-t-warn", same: "pf-v2-s-hi pf-v2-b-hi pf-v2-t-50", deload: "pf-v2-s-danger pf-v2-b-danger pf-v2-t-danger", "plateau-break": "pf-v2-s-warn pf-v2-b-warn pf-v2-t-warn" } as Record<string, string>)[d] ?? "pf-v2-s-hi pf-v2-b pf-v2-t-40";
}

function phaseBadge(p: ProgressionPhase | null): string {
  if (!p) return "pf-v2-s-hi pf-v2-b pf-v2-t-40";
  return ({ acumulacion: "pf-v2-s-violet pf-v2-b-violet pf-v2-t-violet", intensificacion: "pf-v2-s-warn pf-v2-b-warn pf-v2-t-warn", descarga: "pf-v2-s-ok pf-v2-b-ok pf-v2-t-ok", mantenimiento: "pf-v2-s pf-v2-b pf-v2-t-70" } as Record<string, string>)[p] ?? "pf-v2-s-hi pf-v2-b pf-v2-t-40";
}

// ──────────────────────────────────────────────
// EXERCISE HELPERS
// ──────────────────────────────────────────────

type FlatExercise = {
  ejercicioId: string;
  nombre: string;
  bloque: string;
  dia: string;
  series: string;
  repeticiones: string;
  carga: string;
};

function flattenWeekExercises(
  week: ProgressionSemanaPlan,
  ejercicioMap: Record<string, { nombre?: string }>
): FlatExercise[] {
  const result: FlatExercise[] = [];
  for (const dia of week.dias ?? []) {
    if (!dia.entrenamiento) continue;
    for (const bloque of dia.entrenamiento.bloques ?? []) {
      for (const ex of bloque.ejercicios ?? []) {
        result.push({
          ejercicioId: ex.ejercicioId,
          nombre: ejercicioMap[ex.ejercicioId]?.nombre || ex.ejercicioId,
          bloque: bloque.titulo,
          dia: dia.dia,
          series: String(ex.series ?? ""),
          repeticiones: String(ex.repeticiones ?? ""),
          carga: String((ex as ProgressionExerciseDraft).carga ?? "—"),
        });
      }
    }
  }
  return result;
}

type ExerciseDiff = {
  ejercicioId: string;
  nombre: string;
  bloque: string;
  dia: string;
  before: { series: string; repeticiones: string; carga: string } | null;
  after: { series: string; repeticiones: string; carga: string } | null;
  changed: boolean;
};

function diffWeeks(
  oldWeek: ProgressionSemanaPlan | null,
  newWeek: ProgressionSemanaPlan,
  ejercicioMap: Record<string, { nombre?: string }>
): ExerciseDiff[] {
  const oldFlat = oldWeek ? flattenWeekExercises(oldWeek, ejercicioMap) : [];
  const newFlat = flattenWeekExercises(newWeek, ejercicioMap);

  // Build old map by ejercicioId (last occurrence wins for duplicates)
  const oldMap = new Map<string, FlatExercise>();
  for (const ex of oldFlat) oldMap.set(ex.ejercicioId, ex);

  return newFlat.map((ex) => {
    const prev = oldMap.get(ex.ejercicioId) ?? null;
    const changed =
      prev === null ||
      prev.series !== ex.series ||
      prev.repeticiones !== ex.repeticiones ||
      prev.carga !== ex.carga;
    return {
      ejercicioId: ex.ejercicioId,
      nombre: ex.nombre,
      bloque: ex.bloque,
      dia: ex.dia,
      before: prev ? { series: prev.series, repeticiones: prev.repeticiones, carga: prev.carga } : null,
      after: { series: ex.series, repeticiones: ex.repeticiones, carga: ex.carga },
      changed,
    };
  });
}

// Append history with per-person cap
function appendHistory(
  prev: unknown,
  record: ProgressionHistoryRecord
): ProgressionHistoryRecord[] {
  const arr = Array.isArray(prev) ? (prev as ProgressionHistoryRecord[]) : [];
  const next = [...arr, record];
  const byOwner = new Map<string, ProgressionHistoryRecord[]>();
  for (const r of next) {
    const list = byOwner.get(r.ownerKey) ?? [];
    list.push(r);
    byOwner.set(r.ownerKey, list);
  }
  const capped: ProgressionHistoryRecord[] = [];
  for (const recs of byOwner.values()) {
    const sorted = [...recs].sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
    capped.push(...sorted.slice(0, MAX_HISTORY_PER_PERSON));
  }
  return capped;
}

// ──────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────

type AllPersonaItem = {
  ownerKey: string;
  nombre: string;
  tipo: PersonaTipo;
  categoria?: string;
};

type ProgressionPanelProps = {
  store: SemanaStoreLite | PlanPorPersonaLite[] | unknown;
  setStore: (updater: (prev: unknown) => unknown) => void;
  ejercicios: Ejercicio[];
  onNotify: NotifyFn;
  onStaleWeeksDetected?: (count: number) => void;
  /** Lista completa de personas del sistema (alumnos + jugadoras), para mostrar
   *  todas aunque no tengan plan en el store todavía. */
  allPersonas?: AllPersonaItem[];
};

export default function ProgressionPanel({
  store,
  setStore,
  ejercicios,
  onNotify,
  onStaleWeeksDetected,
  allPersonas,
}: ProgressionPanelProps) {

  // ── Shared state ──
  const [workoutLogsRaw] = useSharedState<unknown[]>([], { key: WORKOUT_LOGS_KEY, legacyLocalStorageKey: WORKOUT_LOGS_KEY });
  const [sessionFeedbacksRaw] = useSharedState<unknown[]>([], { key: SESSION_FEEDBACK_KEY, legacyLocalStorageKey: SESSION_FEEDBACK_KEY });
  const [trainingCompletionsRaw] = useSharedState<unknown[]>([], { key: TRAINING_COMPLETIONS_KEY, legacyLocalStorageKey: TRAINING_COMPLETIONS_KEY });
  const [historyRaw, setHistoryRaw] = useSharedState<unknown[]>([], { key: PROGRESSION_HISTORY_KEY, legacyLocalStorageKey: PROGRESSION_HISTORY_KEY });

  // ── Normalize ──
  const workoutLogs       = useMemo(() => normalizeWorkoutLogs(workoutLogsRaw),           [workoutLogsRaw]);
  const sessionFeedbacks  = useMemo(() => normalizeSessionFeedbacks(sessionFeedbacksRaw), [sessionFeedbacksRaw]);
  const trainingCompletions = useMemo(() => normalizeCompletions(trainingCompletionsRaw), [trainingCompletionsRaw]);
  const progressionHistory  = useMemo(() => normalizeHistoryRecords(historyRaw),          [historyRaw]);

  // ── Exercise map ──
  const ejercicioMap = useMemo(() => {
    const m: Record<string, { categoria?: string; nombre?: string }> = {};
    for (const e of ejercicios) m[e.id] = { categoria: e.categoria, nombre: e.nombre };
    return m;
  }, [ejercicios]);

  // ── Planes ──
  const planes: PlanPorPersonaLite[] = useMemo(() => {
    // Extraer planes del store
    let storePlanes: PlanPorPersonaLite[] = [];
    if (store) {
      if (Array.isArray(store)) storePlanes = store as PlanPorPersonaLite[];
      else {
        const s = store as Record<string, unknown>;
        if (Array.isArray(s.planes)) storePlanes = s.planes as PlanPorPersonaLite[];
      }
    }

    // Si no hay lista completa de personas, devolver solo los del store
    if (!allPersonas || allPersonas.length === 0) return storePlanes;

    // Merge: para cada persona del sistema, usar su plan del store o crear stub vacío
    const storeMap = new Map<string, PlanPorPersonaLite>();
    for (const p of storePlanes) storeMap.set(p.ownerKey, p);

    return allPersonas.map((persona) =>
      storeMap.get(persona.ownerKey) ?? {
        ownerKey: persona.ownerKey,
        nombre: persona.nombre,
        tipo: persona.tipo,
        categoria: persona.categoria,
        semanas: [],
      }
    );
  }, [store, allPersonas]);

  // ── UI state ──
  const [statusMap, setStatusMap]       = useState<Record<string, { generating: boolean; generated: boolean }>>({});
  const [previewData, setPreviewData]   = useState<Record<string, ProgressionOutput>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});
  const [thinkingStep, setThinkingStep] = useState<Record<string, { text: string; exercise?: string }>>({});
  const [overrides, setOverrides]       = useState<Record<string, { active: boolean; pct: number }>>({});
  const [overrideOpenKey, setOverrideOpenKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey]   = useState<string | null>(null);
  const [waState, setWaState]           = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});
  const [motorView, setMotorView]       = useState<"panel" | "historial">("panel");
  const [filter, setFilter]             = useState<"all" | "ready" | "stale">("all");
  const [tipoFilter, setTipoFilter]     = useState<string>("all");
  const [confirmBatch, setConfirmBatch] = useState(false);
  const generatingRef = useRef(false);

  const availableCategorias = useMemo(() => {
    const cats = new Set<string>();
    for (const p of planes) { if (p.tipo === "jugadoras" && p.categoria) cats.add(p.categoria); }
    return Array.from(cats).sort();
  }, [planes]);

  // ── Person statuses ──
  const personStatuses = useMemo<PersonStatus[]>(() => {
    return planes.map((plan) => {
      const semanas = plan.semanas ?? [];
      const personHistory = progressionHistory.filter((r) => r.ownerKey === plan.ownerKey);
      const lastRec = [...personHistory].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0];
      const isStale = semanas.length > 0 && lastRec != null && daysAgo(lastRec.generatedAt) >= STALE_DAYS;

      if (semanas.length === 0) {
        return {
          ownerKey: plan.ownerKey, nombre: plan.nombre, tipo: plan.tipo, categoria: plan.categoria,
          currentWeek: null, weekNumberInPlan: 0, metrics: null,
          decision: null, phase: null, rationaleEs: "Sin semanas en el plan.",
          readyToProgress: false,
          generating: statusMap[plan.ownerKey]?.generating ?? false,
          generated: statusMap[plan.ownerKey]?.generated ?? false,
          plateau: null, isStale,
        };
      }

      const weekNumberInPlan = semanas.length;
      const currentWeek      = semanas[weekNumberInPlan - 1];
      const metrics          = analyzeWeekPerformance({ ownerKey: plan.ownerKey, personaName: plan.nombre, currentWeekPlan: currentWeek, workoutLogs, sessionFeedbacks, trainingCompletions });
      const plateau          = detectPlateau(personHistory);
      const override         = overrides[plan.ownerKey];
      const manualOverridePct = override?.active ? override.pct : null;
      const { decision, phase, rationaleEs } = decideProgression(metrics, weekNumberInPlan, plateau, manualOverridePct);

      return {
        ownerKey: plan.ownerKey, nombre: plan.nombre, tipo: plan.tipo, categoria: plan.categoria,
        currentWeek, weekNumberInPlan, metrics, decision, phase, rationaleEs,
        readyToProgress: metrics.hasData || metrics.sessionsCompleted > 0 || semanas.length > 0,
        generating: statusMap[plan.ownerKey]?.generating ?? false,
        generated: statusMap[plan.ownerKey]?.generated ?? false,
        plateau, isStale,
      };
    });
  }, [planes, workoutLogs, sessionFeedbacks, trainingCompletions, progressionHistory, statusMap, overrides]);

  // ── Stale badge callback ──
  const staleCount = useMemo(() => personStatuses.filter((s) => s.isStale).length, [personStatuses]);
  const staleRef   = useRef(-1);
  useEffect(() => {
    if (staleCount !== staleRef.current) {
      staleRef.current = staleCount;
      onStaleWeeksDetected?.(staleCount);
    }
  }, [staleCount, onStaleWeeksDetected]);

  // ── Filtered statuses ──
  const tipoFiltered = useMemo(() => {
    if (tipoFilter === "all")       return personStatuses;
    if (tipoFilter === "jugadoras") return personStatuses.filter((s) => s.tipo === "jugadoras");
    if (tipoFilter === "alumnos")   return personStatuses.filter((s) => s.tipo === "alumnos");
    return personStatuses.filter((s) => s.categoria === tipoFilter);
  }, [personStatuses, tipoFilter]);

  const filtered = useMemo(() => {
    if (filter === "ready") return tipoFiltered.filter((s) => s.readyToProgress && !s.generated && !previewData[s.ownerKey]);
    if (filter === "stale") return tipoFiltered.filter((s) => s.isStale);
    return tipoFiltered;
  }, [tipoFiltered, filter, previewData]);

  const readyCount = useMemo(
    () => tipoFiltered.filter((s) => s.readyToProgress && !s.generated && !previewData[s.ownerKey]).length,
    [tipoFiltered, previewData]
  );

  // ── PREVIEW con streaming SSE ──────────────────────────────────────────────
  const previewNextWeek = useCallback(async (ownerKey: string) => {
    if (generatingRef.current) return;
    const status = personStatuses.find((s) => s.ownerKey === ownerKey);
    if (!status?.currentWeek) { onNotify("No hay semana activa.", "warning"); return; }

    setPreviewLoading((prev) => ({ ...prev, [ownerKey]: true }));
    setThinkingStep((prev) => ({ ...prev, [ownerKey]: { text: "Iniciando análisis…" } }));
    generatingRef.current = true;

    try {
      const override         = overrides[ownerKey];
      const manualOverridePct = override?.active ? override.pct : null;
      const personHistory    = progressionHistory.filter((r) => r.ownerKey === ownerKey);

      const res = await fetch("/api/progression/ia-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerKey,
          personaName: status.nombre,
          currentWeekPlan: status.currentWeek,
          weekNumberInPlan: status.weekNumberInPlan,
          workoutLogs,
          sessionFeedbacks,
          trainingCompletions,
          ejercicioMap,
          historicalRecords: personHistory,
          manualOverridePct,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Error del servidor: ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data: Record<string, unknown>;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          if (data.type === "step") {
            setThinkingStep((prev) => ({ ...prev, [ownerKey]: { text: String(data.text || "") } }));

          } else if (data.type === "metrics") {
            setThinkingStep((prev) => ({ ...prev, [ownerKey]: { text: String(data.text || "") } }));

          } else if (data.type === "decision") {
            setThinkingStep((prev) => ({ ...prev, [ownerKey]: { text: String(data.text || "") } }));

          } else if (data.type === "exercise") {
            setThinkingStep((prev) => ({
              ...prev,
              [ownerKey]: { text: "Calculando cargas…", exercise: String(data.name || "") },
            }));

          } else if (data.type === "complete") {
            const result = data.result as ProgressionOutput;
            if (result) {
              setPreviewData((prev) => ({ ...prev, [ownerKey]: result }));
            }

          } else if (data.type === "error") {
            throw new Error(String(data.message || "Error en el motor IA"));
          }
        }
      }

    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Error al calcular la vista previa.", "error");
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [ownerKey]: false }));
      setThinkingStep((prev) => { const n = { ...prev }; delete n[ownerKey]; return n; });
      generatingRef.current = false;
    }
  }, [personStatuses, workoutLogs, sessionFeedbacks, trainingCompletions, ejercicioMap, progressionHistory, overrides, onNotify]);

  // ── CONFIRM (commits preview to store + history) ──
  const confirmPreview = useCallback(async (ownerKey: string) => {
    const result = previewData[ownerKey];
    const status = personStatuses.find((s) => s.ownerKey === ownerKey);
    if (!result || !status) return;

    // Append week to store (markManualSaveIntent called by setStore wrapper in parent)
    setStore((prev: unknown) => {
      const raw = prev as Record<string, unknown> | null;
      if (!raw) return prev;
      const currentPlanes = Array.isArray(raw) ? raw as PlanPorPersonaLite[] : Array.isArray(raw.planes) ? raw.planes as PlanPorPersonaLite[] : [];
      const updated = currentPlanes.map((plan) =>
        plan.ownerKey !== ownerKey ? plan : { ...plan, semanas: [...(plan.semanas ?? []), result.nextWeekPlan] }
      );
      if (Array.isArray(raw)) return updated;
      return { ...raw, planes: updated };
    });

    // Append history record (capped) + sync
    setHistoryRaw((prev) => appendHistory(prev, result.historyRecord));
    markManualSaveIntent(PROGRESSION_HISTORY_KEY);

    // Update UI state
    setStatusMap((prev) => ({ ...prev, [ownerKey]: { generating: false, generated: true } }));
    setPreviewData((prev) => { const n = { ...prev }; delete n[ownerKey]; return n; });
    setOverrides((prev) => ({ ...prev, [ownerKey]: { active: false, pct: 0 } }));
    setOverrideOpenKey((prev) => (prev === ownerKey ? null : prev));

    const sign = result.loadDeltaPct >= 0 ? "+" : "";
    onNotify(`${status.nombre} → ${result.weekLabel} confirmada (${DECISION_LABELS[result.decision]}, ${sign}${result.loadDeltaPct}% carga)`, "success");
  }, [previewData, personStatuses, setStore, setHistoryRaw, onNotify]);

  // ── CANCEL PREVIEW ──
  const cancelPreview = useCallback((ownerKey: string) => {
    setPreviewData((prev) => { const n = { ...prev }; delete n[ownerKey]; return n; });
  }, []);

  // ── ROLLBACK last generated week ──
  const rollbackLastWeek = useCallback((ownerKey: string) => {
    const plan = planes.find((p) => p.ownerKey === ownerKey);
    if (!plan || plan.semanas.length === 0) return;

    // Remove last semana from store
    setStore((prev: unknown) => {
      const raw = prev as Record<string, unknown> | null;
      if (!raw) return prev;
      const currentPlanes = Array.isArray(raw) ? raw as PlanPorPersonaLite[] : Array.isArray(raw.planes) ? raw.planes as PlanPorPersonaLite[] : [];
      const updated = currentPlanes.map((p) =>
        p.ownerKey !== ownerKey ? p : { ...p, semanas: p.semanas.slice(0, -1) }
      );
      if (Array.isArray(raw)) return updated;
      return { ...raw, planes: updated };
    });

    // Remove most recent history record for this person
    setHistoryRaw((prev) => {
      if (!Array.isArray(prev)) return prev;
      const records = prev as ProgressionHistoryRecord[];
      let latestIdx = -1;
      let latestTime = -1;
      for (let i = 0; i < records.length; i++) {
        if (records[i].ownerKey === ownerKey) {
          const t = new Date(records[i].generatedAt).getTime();
          if (t > latestTime) { latestTime = t; latestIdx = i; }
        }
      }
      if (latestIdx === -1) return records;
      return [...records.slice(0, latestIdx), ...records.slice(latestIdx + 1)];
    });
    markManualSaveIntent(PROGRESSION_HISTORY_KEY);

    setStatusMap((prev) => ({ ...prev, [ownerKey]: { generating: false, generated: false } }));
    setWaState((prev) => ({ ...prev, [ownerKey]: "idle" }));
    onNotify(`Semana revertida para ${plan.nombre}.`, "warning");
  }, [planes, setStore, setHistoryRaw, onNotify]);

  // ── BATCH GENERATE (directo, sin preview) ──
  const generateAll = useCallback(async () => {
    const ready = tipoFiltered.filter((s) => s.readyToProgress && !s.generated && !s.generating && s.currentWeek && !previewData[s.ownerKey]);
    if (ready.length === 0) { onNotify("No hay alumnos listos para avanzar.", "warning"); return; }
    setConfirmBatch(false);

    for (const status of ready) {
      if (generatingRef.current) await new Promise((r) => setTimeout(r, 300));
      setStatusMap((prev) => ({ ...prev, [status.ownerKey]: { generating: true, generated: false } }));
      generatingRef.current = true;
      await new Promise((r) => setTimeout(r, 400));

      try {
        const personHistory     = progressionHistory.filter((r) => r.ownerKey === status.ownerKey);
        const override          = overrides[status.ownerKey];
        const manualOverridePct = override?.active ? override.pct : null;
        const result = runProgressionEngine({
          ownerKey: status.ownerKey, personaName: status.nombre,
          currentWeekPlan: status.currentWeek!,
          weekNumberInPlan: status.weekNumberInPlan,
          workoutLogs, sessionFeedbacks, trainingCompletions, ejercicioMap,
          historicalRecords: personHistory, manualOverridePct,
        });

        setStore((prev: unknown) => {
          const raw = prev as Record<string, unknown> | null;
          if (!raw) return prev;
          const cp = Array.isArray(raw) ? raw as PlanPorPersonaLite[] : Array.isArray(raw.planes) ? raw.planes as PlanPorPersonaLite[] : [];
          const updated = cp.map((p) => p.ownerKey !== status.ownerKey ? p : { ...p, semanas: [...(p.semanas ?? []), result.nextWeekPlan] });
          if (Array.isArray(raw)) return updated;
          return { ...raw, planes: updated };
        });

        setHistoryRaw((prev) => appendHistory(prev, result.historyRecord));
        setStatusMap((prev) => ({ ...prev, [status.ownerKey]: { generating: false, generated: true } }));
        setOverrides((prev) => ({ ...prev, [status.ownerKey]: { active: false, pct: 0 } }));
        onNotify(`${status.nombre} → ${result.weekLabel} generada`, "success");
      } catch {
        setStatusMap((prev) => ({ ...prev, [status.ownerKey]: { generating: false, generated: false } }));
      } finally {
        generatingRef.current = false;
      }
    }
    markManualSaveIntent(PROGRESSION_HISTORY_KEY);
    onNotify(`${ready.length} semanas generadas.`, "success");
  }, [tipoFiltered, previewData, progressionHistory, overrides, workoutLogs, sessionFeedbacks, trainingCompletions, ejercicioMap, setStore, setHistoryRaw, onNotify]);

  // ── WA notification ──
  const sendWaNotification = useCallback(async (ownerKey: string) => {
    const status = personStatuses.find((s) => s.ownerKey === ownerKey);
    if (!status) return;
    const latest = [...progressionHistory.filter((r) => r.ownerKey === ownerKey)].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0];
    if (!latest) { onNotify("No hay semana generada para notificar.", "warning"); return; }

    setWaState((prev) => ({ ...prev, [ownerKey]: "sending" }));
    try {
      const res = await fetch("/api/progression/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaNombre: status.nombre, weekLabel: latest.weekLabel, decision: DECISION_LABELS[latest.decision], loadDeltaPct: latest.loadDeltaPct, rationaleEs: latest.rationaleEs }),
      });
      const data = (await res.json()) as { ok?: boolean; skipped?: boolean; reason?: string };
      if (data.ok) { setWaState((prev) => ({ ...prev, [ownerKey]: "sent" })); onNotify(`WhatsApp enviado a ${status.nombre} ✓`, "success"); }
      else if (data.skipped) { setWaState((prev) => ({ ...prev, [ownerKey]: "idle" })); onNotify(data.reason || "Sin teléfono registrado.", "warning"); }
      else { setWaState((prev) => ({ ...prev, [ownerKey]: "error" })); onNotify("Error al enviar WhatsApp.", "error"); }
    } catch { setWaState((prev) => ({ ...prev, [ownerKey]: "error" })); onNotify("Error de conexión.", "error"); }
  }, [personStatuses, progressionHistory, onNotify]);

  // ── Computed stats ──
  const historyByPerson = useMemo(() => {
    const map = new Map<string, ProgressionHistoryRecord[]>();
    for (const r of progressionHistory) { const a = map.get(r.ownerKey) ?? []; a.push(r); map.set(r.ownerKey, a); }
    for (const [k, a] of map) map.set(k, [...a].sort((x, y) => new Date(y.generatedAt).getTime() - new Date(x.generatedAt).getTime()));
    return map;
  }, [progressionHistory]);

  const totalPersonas  = tipoFiltered.length;
  const withData       = tipoFiltered.filter((s) => s.metrics?.hasData).length;
  const generatedCount = tipoFiltered.filter((s) => s.generated).length;

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────

  return (
    <div className="mt-5 border-t pf-v2-b pt-5 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold pf-v2-t">Motor de Progresión IA</h3>
          <p className="mt-0.5 text-xs pf-v2-t-50 max-w-xl">
            Analiza rendimiento semanal, detecta plateaus y genera la próxima semana con vista previa y ajuste manual.
          </p>
        </div>
        <div className="inline-flex rounded-xl pf-v2-s p-0.5 ring-1 ">
          {(["panel", "historial"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setMotorView(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition capitalize ${motorView === v ? "pf-v2-s-violet pf-v2-t-violet" : "pf-v2-t-50 "}`}>
              {v === "historial" ? `Historial (${progressionHistory.length})` : "Panel"}
            </button>
          ))}
        </div>
      </div>

      {/* ── PANEL VIEW ── */}
      {motorView === "panel" && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl pf-v2-s p-0.5 ring-1 ">
              {(["all", "ready", ...(staleCount > 0 ? ["stale"] : [])] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f as typeof filter)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === f ? (f === "stale" ? "pf-v2-s-warn pf-v2-t-warn" : f === "ready" ? "pf-v2-s-ok pf-v2-t-ok" : "pf-v2-s-accent pf-v2-t-accent") : (f === "stale" ? "pf-v2-t-warn " : "pf-v2-t-50 ")}`}>
                  {f === "all" ? `Todos (${planes.length})` : f === "ready" ? `Listos (${readyCount})` : `⏰ Stale (${staleCount})`}
                </button>
              ))}
            </div>

            {/* Tipo / categoría */}
            {[{ key: "all", label: "Todos" }, { key: "jugadoras", label: "Jugadoras" }, { key: "alumnos", label: "Alumnos" }, ...availableCategorias.map((c) => ({ key: c, label: c }))].map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setTipoFilter(key)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${tipoFilter === key ? "pf-v2-b-hi pf-v2-s-hi pf-v2-t" : "pf-v2-b pf-v2-s pf-v2-t-40 "}`}>
                {label}
              </button>
            ))}

            {/* Batch button */}
            <button type="button" onClick={() => setConfirmBatch(true)} disabled={readyCount === 0}
              className={`ml-auto rounded-xl border px-4 py-1.5 text-xs font-bold transition ${readyCount > 0 ? "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok pf-v2-hover" : "pf-v2-b pf-v2-s pf-v2-t-40 cursor-not-allowed"}`}>
              ⚡ Auto-avanzar ({readyCount})
            </button>
          </div>

          {/* Confirm batch banner */}
          {confirmBatch && readyCount > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border pf-v2-b-ok pf-v2-s-ok px-4 py-3">
              <p className="flex-1 text-sm pf-v2-t-ok">
                ¿Generar la próxima semana para <strong>{readyCount} alumno{readyCount > 1 ? "s" : ""}</strong> sin revisión previa?
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={generateAll}
                  className="rounded-xl border pf-v2-b-ok pf-v2-s-ok px-4 py-1.5 text-xs font-bold pf-v2-t-ok pf-v2-hover transition">
                  ✓ Sí, generar todos
                </button>
                <button type="button" onClick={() => setConfirmBatch(false)}
                  className="rounded-xl border pf-v2-b-hi pf-v2-s-hi px-3 py-1.5 text-xs font-semibold pf-v2-t-70 transition">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Con plan",       value: totalPersonas,  color: "pf-v2-t" },
              { label: "Con registros",  value: withData,       color: "pf-v2-t-accent" },
              { label: "Listos",         value: readyCount,     color: "pf-v2-t-ok" },
              { label: "Generados hoy",  value: generatedCount, color: "pf-v2-t-violet" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border pf-v2-b pf-v2-s p-3">
                <p className="text-[10px] uppercase tracking-wide pf-v2-t-40">{label}</p>
                <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="rounded-2xl border pf-v2-b pf-v2-s p-8 text-center">
              <p className="text-sm pf-v2-t-50">
                {filter === "ready" ? "Ningún alumno listo para avanzar aún." : filter === "stale" ? "No hay semanas vencidas." : "No hay alumnos con planes activos."}
              </p>
              {filter === "all" && planes.length === 0 && (
                <p className="mt-2 text-xs pf-v2-t-40">
                  Asignale un template a un alumno o jugadora desde <span className="pf-v2-t-accent">Clientes → Plan</span> para que aparezca aquí.
                </p>
              )}
            </div>
          )}

          {/* Person cards */}
          <div className="space-y-3">
            {filtered.map((status) => {
              const isExpanded     = expandedKey === status.ownerKey;
              const isOverrideOpen = overrideOpenKey === status.ownerKey;
              const delta          = status.decision ? DECISION_DELTA_MAP[status.decision] : null;
              const override       = overrides[status.ownerKey];
              const preview        = previewData[status.ownerKey];
              const isPreviewing   = previewLoading[status.ownerKey] === true;
              const thinking       = thinkingStep[status.ownerKey];
              const currentWaState = waState[status.ownerKey] ?? "idle";
              const m              = status.metrics;
              const personHistory  = (historyByPerson.get(status.ownerKey) ?? []).slice(0, 8).reverse();

              return (
                <div key={status.ownerKey}
                  className={`rounded-2xl border pf-v2-s overflow-hidden transition ${status.isStale ? "pf-v2-b-warn" : status.plateau?.detected ? "pf-v2-b-warn" : preview ? "pf-v2-b-accent" : "pf-v2-b"}`}>

                  {/* Status banners */}
                  {status.isStale && (
                    <div className="flex items-center gap-2 pf-v2-s-warn border-b pf-v2-b-warn px-4 py-1.5">
                      <span className="text-[10px] font-bold pf-v2-t-warn">⏰ SEMANA VENCIDA</span>
                      <span className="text-[10px] pf-v2-t-warn">Última generación hace +{STALE_DAYS} días.</span>
                    </div>
                  )}
                  {status.plateau?.detected && !status.isStale && (
                    <div className="flex items-center gap-2 pf-v2-s-warn border-b pf-v2-b-warn px-4 py-1.5">
                      <span className="text-[10px] font-bold pf-v2-t-warn">🔄 PLATEAU</span>
                      <span className="text-[10px] pf-v2-t-warn">{status.plateau.consecutiveLowStimulus} semanas de bajo estímulo · se aplicará variación de carga.</span>
                    </div>
                  )}
                  {preview && (
                    <div className="flex items-center gap-2 pf-v2-s-accent border-b pf-v2-b-accent px-4 py-1.5">
                      <span className="text-[10px] font-bold pf-v2-t-accent">👁 VISTA PREVIA LISTA</span>
                      <span className="text-[10px] pf-v2-t-accent">Revisá los cambios antes de confirmar.</span>
                    </div>
                  )}

                  {/* Card header */}
                  <div className="flex flex-wrap items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      {/* Name + badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold pf-v2-t">{status.nombre}</span>
                        {status.categoria && <span className="rounded-md pf-v2-s-hi px-2 py-0.5 text-[10px] pf-v2-t-50">{status.categoria}</span>}
                        <span className="rounded-md pf-v2-s-hi px-2 py-0.5 text-[10px] pf-v2-t-40">{status.tipo === "alumnos" ? "Alumno" : "Jugadora"}</span>
                        {status.currentWeek && <span className="text-[11px] pf-v2-t-40">{status.currentWeek.nombre} · sem. {status.weekNumberInPlan}</span>}
                      </div>

                      {/* Metrics */}
                      {m && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          <MetricChip label="Sesiones" value={`${m.sessionsCompleted}/${m.sessionsPlanned}`} sub={fmtPct(m.completionRate)} ok={m.completionRate >= 0.75} />
                          <MetricChip label="RPE" value={fmtScore(m.avgRpe)} ok={m.avgRpe !== null && m.avgRpe <= 7} warn={m.avgRpe !== null && m.avgRpe >= 8} />
                          <MetricChip label="Fatiga" value={fmtScore(m.avgFatigue)} ok={m.avgFatigue !== null && m.avgFatigue <= 6} warn={m.avgFatigue !== null && m.avgFatigue >= 8} />
                          <MetricChip label="Carga" value={m.totalRealLoad > 0 ? fmtLoad(m.totalRealLoad) : "—"} />
                          {m.painReportCount > 0 && <MetricChip label="⚠ Molestias" value={String(m.painReportCount)} warn />}
                        </div>
                      )}

                      {/* Sparkline */}
                      {personHistory.length >= 2 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wide pf-v2-t-40">Carga %</span>
                          <Sparkline records={personHistory} />
                        </div>
                      )}
                    </div>

                    {/* Right: decision + actions */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {/* Decision badge */}
                      {(preview ? preview.decision : status.decision) && (
                        <div className="text-right">
                          <span className={`inline-block rounded-lg border px-2.5 py-1 text-[11px] font-bold ${decisionBadgeBg(preview?.decision ?? status.decision)}`}>
                            {DECISION_LABELS[preview?.decision ?? status.decision!]}
                          </span>
                          {(preview ? preview.loadDeltaPct : delta) !== null && (
                            <p className={`mt-0.5 text-[10px] font-semibold ${decisionColor(preview?.decision ?? status.decision)}`}>
                              {(preview ? preview.loadDeltaPct : delta)! > 0 ? "+" : ""}
                              {preview ? preview.loadDeltaPct : delta}% carga
                              {override?.active && !preview && <span className="ml-1 pf-v2-t-violet">✏ manual</span>}
                            </p>
                          )}
                          {(preview ? preview.phase : status.phase) && (
                            <span className={`mt-0.5 inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${phaseBadge(preview?.phase ?? status.phase)}`}>
                              {PHASE_LABELS[preview?.phase ?? status.phase!]}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* Override toggle */}
                        <button type="button" title="Ajuste manual de carga"
                          onClick={() => setOverrideOpenKey(isOverrideOpen ? null : status.ownerKey)}
                          className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${override?.active ? "pf-v2-b-violet pf-v2-s-violet pf-v2-t-violet" : isOverrideOpen ? "pf-v2-b-hi pf-v2-s-hi pf-v2-t" : "pf-v2-b pf-v2-s pf-v2-t-40 "}`}>
                          ✏ {override?.active ? `${override.pct > 0 ? "+" : ""}${override.pct}%` : "Ajustar"}
                        </button>

                        {/* Preview / Confirm / Cancel */}
                        {!status.generated && !preview && (
                          <button type="button" onClick={() => previewNextWeek(status.ownerKey)}
                            disabled={isPreviewing || !status.currentWeek}
                            className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${isPreviewing ? "pf-v2-b-violet pf-v2-s-violet pf-v2-t-violet cursor-wait" : "pf-v2-b-accent pf-v2-s-accent pf-v2-t-accent pf-v2-hover active:scale-95"}`}>
                            {isPreviewing ? (
                              <span className="flex items-center gap-1.5 max-w-[160px]">
                                <svg className="h-3 w-3 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round"/></svg>
                                <span className="truncate">{thinking?.text || "Analizando…"}</span>
                              </span>
                            ) : "Vista previa →"}
                          </button>
                        )}
                        {preview && !status.generated && (
                          <>
                            <button type="button" onClick={() => confirmPreview(status.ownerKey)}
                              className="rounded-xl border pf-v2-b-ok pf-v2-s-ok px-3 py-2 text-xs font-bold pf-v2-t-ok pf-v2-hover active:scale-95 transition">
                              ✓ Confirmar
                            </button>
                            <button type="button" onClick={() => cancelPreview(status.ownerKey)}
                              className="rounded-xl border pf-v2-b-hi pf-v2-s-hi px-2.5 py-2 text-xs font-semibold pf-v2-t-50 transition">
                              ✕
                            </button>
                          </>
                        )}

                        {/* Generated state */}
                        {status.generated && (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-xl border pf-v2-b-ok pf-v2-s-ok px-3 py-2 text-xs font-bold pf-v2-t-ok">✓ Generada</span>
                            <button type="button" onClick={() => sendWaNotification(status.ownerKey)}
                              disabled={currentWaState === "sending" || currentWaState === "sent"}
                              title="Notificar por WhatsApp"
                              className={`rounded-xl border px-2.5 py-2 text-xs font-bold transition ${currentWaState === "sent" ? "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok" : currentWaState === "sending" ? "pf-v2-b pf-v2-s-hi pf-v2-t-40 cursor-wait" : currentWaState === "error" ? "pf-v2-b-danger pf-v2-s-danger pf-v2-t-danger pf-v2-hover" : "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok pf-v2-hover"}`}>
                              {currentWaState === "sent" ? "✓ WA" : currentWaState === "sending" ? "…" : currentWaState === "error" ? "⚠ WA" : "📱"}
                            </button>
                            <button type="button" onClick={() => rollbackLastWeek(status.ownerKey)}
                              title="Deshacer última generación"
                              className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-2.5 py-2 text-xs font-bold pf-v2-t-danger pf-v2-hover transition">
                              ↩
                            </button>
                          </div>
                        )}

                        {/* Expand/collapse rationale */}
                        {(status.rationaleEs || preview?.rationaleEs) && (
                          <button type="button" onClick={() => setExpandedKey(isExpanded ? null : status.ownerKey)}
                            className="rounded-lg p-1.5 pf-v2-t-40 transition">
                            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── THINKING PANEL (visible mientras genera) ── */}
                  {isPreviewing && thinking && (
                    <div className="border-t pf-v2-b-violet pf-v2-s-violet px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {/* Bouncing dots */}
                        <div className="flex gap-0.5 shrink-0">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="h-1.5 w-1.5 rounded-full pf-v2-s-violet animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] font-medium pf-v2-t-violet leading-tight">
                          {thinking.text}
                        </p>
                      </div>
                      {thinking.exercise && (
                        <p className="mt-1 pl-6 text-[10px] pf-v2-t-violet truncate">
                          → {thinking.exercise}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Override slider */}
                  {isOverrideOpen && (
                    <div className="border-t pf-v2-b pf-v2-s px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide pf-v2-t-50">Ajuste manual de carga</p>
                        <button type="button"
                          onClick={() => setOverrides((prev) => ({ ...prev, [status.ownerKey]: { active: !override?.active, pct: override?.pct ?? 0 } }))}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${override?.active ? "pf-v2-b-violet pf-v2-s-violet pf-v2-t-violet" : "pf-v2-b pf-v2-s pf-v2-t-40"}`}>
                          {override?.active ? "ON" : "OFF"}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="range" min={-30} max={10} step={0.5} value={override?.pct ?? 0}
                          onChange={(e) => setOverrides((prev) => ({ ...prev, [status.ownerKey]: { active: prev[status.ownerKey]?.active ?? false, pct: Number(e.target.value) } }))}
                          className="flex-1 accent-violet-400 h-1.5"/>
                        <span className={`w-14 text-right text-xs font-bold tabular-nums ${(override?.pct ?? 0) > 0 ? "pf-v2-t-ok" : (override?.pct ?? 0) < 0 ? "pf-v2-t-danger" : "pf-v2-t-50"}`}>
                          {(override?.pct ?? 0) > 0 ? "+" : ""}{override?.pct ?? 0}%
                        </span>
                      </div>
                      <div className="mt-1.5 flex justify-between text-[10px] pf-v2-t-40">
                        <span>−30% (recuperación)</span>
                        <span className="pf-v2-t-40">Auto: {delta !== null ? `${delta > 0 ? "+" : ""}${delta}%` : "—"}</span>
                        <span>+10% (agresivo)</span>
                      </div>
                      {override?.active && (
                        <p className="mt-1.5 text-[10px] pf-v2-t-violet">
                          Override activo — se usará {override.pct > 0 ? "+" : ""}{override.pct}% en la próxima generación.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Preview exercise comparison */}
                  {preview && status.currentWeek && (
                    <div className="border-t pf-v2-b-accent pf-v2-s-accent px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide pf-v2-t-accent mb-2">
                        Comparación de ejercicios — {status.currentWeek.nombre} → {preview.nextWeekPlan.nombre}
                      </p>
                      <ExerciseComparisonTable
                        oldWeek={status.currentWeek}
                        newWeek={preview.nextWeekPlan}
                        ejercicioMap={ejercicioMap}
                      />
                      {preview.rationaleEs && (
                        <p className="mt-3 text-[11px] pf-v2-t-50 leading-relaxed border-t pf-v2-b pt-2">
                          <span className="pf-v2-t-40 font-semibold mr-1">Razonamiento:</span>
                          {preview.rationaleEs}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Expanded rationale (when no preview) */}
                  {isExpanded && !preview && status.rationaleEs && (
                    <div className="border-t pf-v2-b pf-v2-s px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide pf-v2-t-40 mb-1.5">Razonamiento del Motor</p>
                      <p className="text-xs pf-v2-t-70 leading-relaxed">{status.rationaleEs}</p>
                      {status.plateau && status.plateau.consecutiveLowStimulus > 0 && (
                        <div className="mt-2 rounded-lg border pf-v2-b-warn pf-v2-s-warn px-3 py-2">
                          <p className="text-[11px] pf-v2-t-warn">🔄 {status.plateau.recommendation}</p>
                        </div>
                      )}
                      {m && !m.hasData && (
                        <p className="mt-2 text-[11px] pf-v2-t-warn">Sin datos de rendimiento — ajuste por posición en el mesociclo.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* How it works */}
          <div className="rounded-2xl border pf-v2-b pf-v2-s p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide pf-v2-t-40 mb-2">¿Cómo funciona?</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: "📊", title: "1. Lee los datos",      desc: "Carga real, RPE, fatiga y completitud de la semana." },
                { icon: "🧠", title: "2. Calcula la previa",  desc: "Vista previa antes de confirmar — ves qué cambia cada ejercicio." },
                { icon: "✏",  title: "3. Ajustá si querés",  desc: "Override de -30% a +10% por persona antes de confirmar." },
                { icon: "🔄", title: "4. Detecta plateaus",  desc: "3+ semanas de bajo estímulo → variación de carga automática." },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="space-y-0.5">
                  <p className="text-[11px] font-semibold pf-v2-t-50">{icon} {title}</p>
                  <p className="text-[10px] pf-v2-t-40 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── HISTORY VIEW ── */}
      {motorView === "historial" && (
        <HistoryView
          planes={planes}
          historyByPerson={historyByPerson}
          tipoFilter={tipoFilter}
          availableCategorias={availableCategorias}
          onSetTipoFilter={setTipoFilter}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// EXERCISE COMPARISON TABLE
// ──────────────────────────────────────────────

function ExerciseComparisonTable({
  oldWeek, newWeek, ejercicioMap,
}: {
  oldWeek: ProgressionSemanaPlan;
  newWeek: ProgressionSemanaPlan;
  ejercicioMap: Record<string, { nombre?: string; categoria?: string }>;
}) {
  const diffs = useMemo(() => diffWeeks(oldWeek, newWeek, ejercicioMap), [oldWeek, newWeek, ejercicioMap]);
  if (diffs.length === 0) return <p className="text-xs pf-v2-t-40">Sin ejercicios para comparar.</p>;

  const changed = diffs.filter((d) => d.changed);
  const same    = diffs.filter((d) => !d.changed);

  return (
    <div className="space-y-1">
      {changed.length === 0 && (
        <p className="text-xs pf-v2-t-50 italic">Todos los parámetros se mantienen iguales.</p>
      )}
      {changed.map((d) => (
        <ExerciseRow key={d.ejercicioId} diff={d} highlight />
      ))}
      {same.length > 0 && changed.length > 0 && (
        <p className="text-[10px] uppercase tracking-wide pf-v2-t-40 pt-1">Sin cambios ({same.length})</p>
      )}
      {same.map((d) => (
        <ExerciseRow key={d.ejercicioId} diff={d} />
      ))}
    </div>
  );
}

function ExerciseRow({ diff, highlight = false }: { diff: ExerciseDiff; highlight?: boolean }) {
  const { nombre, before, after, dia, bloque } = diff;

  const fmt = (s: { series: string; repeticiones: string; carga: string } | null) =>
    s ? `${s.series}×${s.repeticiones}${s.carga && s.carga !== "—" ? ` @ ${s.carga}` : ""}` : "—";

  const beforeStr = fmt(before);
  const afterStr  = fmt(after);

  // Detect load change for delta badge
  const loadBefore = before?.carga ? Number(before.carga.replace(/[^0-9.]/g, "")) || null : null;
  const loadAfter  = after?.carga  ? Number(after.carga.replace(/[^0-9.]/g, "")) || null : null;
  let deltaBadge: string | null = null;
  if (loadBefore !== null && loadAfter !== null && loadBefore > 0) {
    const pct = ((loadAfter - loadBefore) / loadBefore) * 100;
    if (Math.abs(pct) >= 1) deltaBadge = `${pct > 0 ? "+" : ""}${Math.round(pct)}%`;
  }

  return (
    <div className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 ${highlight ? "pf-v2-s-accent" : "pf-v2-s"}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-semibold truncate ${highlight ? "pf-v2-t" : "pf-v2-t-50"}`}>{nombre}</p>
        <p className="text-[10px] pf-v2-t-40">{dia} · {bloque}</p>
      </div>
      {highlight ? (
        <div className="flex items-center gap-1.5 text-[11px] shrink-0">
          <span className="pf-v2-t-40 tabular-nums">{beforeStr}</span>
          <span className="pf-v2-t-40">→</span>
          <span className="font-semibold pf-v2-t-accent tabular-nums">{afterStr}</span>
          {deltaBadge && (
            <span className={`rounded px-1 py-0.5 text-[10px] font-bold ${deltaBadge.startsWith("+") ? "pf-v2-s-ok pf-v2-t-ok" : "pf-v2-s-danger pf-v2-t-danger"}`}>
              {deltaBadge}
            </span>
          )}
        </div>
      ) : (
        <span className="text-[11px] pf-v2-t-40 tabular-nums shrink-0">{afterStr}</span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// HISTORY VIEW
// ──────────────────────────────────────────────

function HistoryView({
  planes, historyByPerson, tipoFilter, availableCategorias, onSetTipoFilter,
}: {
  planes: PlanPorPersonaLite[];
  historyByPerson: Map<string, ProgressionHistoryRecord[]>;
  tipoFilter: string;
  availableCategorias: string[];
  onSetTipoFilter: (v: string) => void;
}) {
  const filteredPlanes = useMemo(() => {
    const base = tipoFilter === "all" ? planes : tipoFilter === "jugadoras" ? planes.filter((p) => p.tipo === "jugadoras") : tipoFilter === "alumnos" ? planes.filter((p) => p.tipo === "alumnos") : planes.filter((p) => p.categoria === tipoFilter);
    return base.filter((p) => historyByPerson.has(p.ownerKey));
  }, [planes, tipoFilter, historyByPerson]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {[{ key: "all", label: "Todos" }, { key: "jugadoras", label: "Jugadoras" }, { key: "alumnos", label: "Alumnos" }, ...availableCategorias.map((c) => ({ key: c, label: c }))].map(({ key, label }) => (
          <button key={key} type="button" onClick={() => onSetTipoFilter(key)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${tipoFilter === key ? "pf-v2-b-hi pf-v2-s-hi pf-v2-t" : "pf-v2-b pf-v2-s pf-v2-t-40 "}`}>
            {label}
          </button>
        ))}
      </div>

      {filteredPlanes.length === 0 && (
        <div className="rounded-2xl border pf-v2-b pf-v2-s p-8 text-center">
          <p className="text-sm pf-v2-t-40">No hay historial de progresiones aún.</p>
          <p className="mt-1 text-xs pf-v2-t-40">Generá semanas desde el Panel para ver el historial aquí.</p>
        </div>
      )}

      {filteredPlanes.map((plan) => {
        const records      = historyByPerson.get(plan.ownerKey) ?? [];
        const sparkRecords = [...records].reverse().slice(0, 10);

        return (
          <div key={plan.ownerKey} className="rounded-2xl border pf-v2-b pf-v2-s overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b pf-v2-b">
              <div className="flex-1">
                <span className="text-sm font-semibold pf-v2-t">{plan.nombre}</span>
                {plan.categoria && <span className="ml-2 rounded-md pf-v2-s-hi px-2 py-0.5 text-[10px] pf-v2-t-50">{plan.categoria}</span>}
              </div>
              <span className="text-[11px] pf-v2-t-40">{records.length} generación{records.length !== 1 ? "es" : ""}</span>
            </div>

            {sparkRecords.length >= 2 && (
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wide pf-v2-t-40">Tendencia de carga</span>
                </div>
                <Sparkline records={sparkRecords} width={200} height={36} />
              </div>
            )}

            <div className="divide-y ">
              {records.map((rec, i) => (
                <div key={rec.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? "pf-v2-s-accent-full" : "pf-v2-s-hi"}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs pf-v2-t-70">{rec.weekLabel}</span>
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${decisionBadgeBg(rec.decision)}`}>{DECISION_LABELS[rec.decision]}</span>
                      {rec.plateauDetected && <span className="rounded-md border pf-v2-b-warn pf-v2-s-warn px-2 py-0.5 text-[10px] pf-v2-t-warn">Plateau</span>}
                      {rec.manualOverride  && <span className="rounded-md border pf-v2-b-violet pf-v2-s-violet px-2 py-0.5 text-[10px] pf-v2-t-violet">✏ Manual</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] pf-v2-t-40 line-clamp-1">{rec.rationaleEs}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-bold tabular-nums ${rec.loadDeltaPct > 0 ? "pf-v2-t-ok" : rec.loadDeltaPct < 0 ? "pf-v2-t-danger" : "pf-v2-t-40"}`}>
                      {rec.loadDeltaPct > 0 ? "+" : ""}{rec.loadDeltaPct}%
                    </p>
                    <p className="text-[10px] pf-v2-t-40">{fmtDate(rec.generatedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────

function MetricChip({ label, value, sub, ok, warn }: { label: string; value: string; sub?: string; ok?: boolean; warn?: boolean }) {
  const color = warn ? "pf-v2-t-danger" : ok ? "pf-v2-t-ok" : "pf-v2-t-70";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wide pf-v2-t-40">{label}</span>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
      {sub && <span className="text-[10px] pf-v2-t-40">{sub}</span>}
    </div>
  );
}

function Sparkline({ records, width = 80, height = 24 }: { records: ProgressionHistoryRecord[]; width?: number; height?: number }) {
  if (records.length < 2) return null;
  const values = records.map((r) => r.loadDeltaPct);
  const min = Math.min(...values, -5);
  const max = Math.max(...values, 5);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const toX = (i: number) => pad + (i / (values.length - 1)) * w;
  const toY = (v: number) => pad + h - ((v - min) / range) * h;
  const zeroY = toY(0);
  const pts   = values.map((v, i) => `${toX(i)},${toY(v)}`);
  const line  = `M ${pts.join(" L ")}`;
  const fill  = `M ${toX(0)},${zeroY} L ${pts.join(" L ")} L ${toX(values.length - 1)},${zeroY} Z`;
  const last  = values[values.length - 1];
  const clr   = last >= 0 ? "#34d399" : "#f87171";
  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
        <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        <path d={fill} fill={last >= 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)"}/>
        <path d={line} fill="none" stroke={clr} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={toX(values.length - 1)} cy={toY(last)} r="2.5" fill={clr}/>
      </svg>
      <span className={`text-[10px] font-bold tabular-nums ${last >= 0 ? "pf-v2-t-ok" : "pf-v2-t-danger"}`}>
        {last > 0 ? "+" : ""}{last}%
      </span>
    </div>
  );
}
