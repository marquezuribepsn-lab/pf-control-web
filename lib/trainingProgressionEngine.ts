/**
 * trainingProgressionEngine.ts
 * Motor de progresion inteligente — v2
 *
 * Logica pura (sin React, sin side effects).
 * Lee datos de semanas pasadas y genera el plan para la proxima.
 *
 * Principios cientificos aplicados:
 * - Sobrecarga progresiva controlada (Zatsiorsky, 2006)
 * - Modelo de periodizacion ondulante (Rhea et al., 2002)
 * - Autorregulacion por RPE (Zourdos et al., 2016)
 * - Ciclo de 4 semanas: acumulacion x3 + descarga x1
 * - Ajuste por tipo de ejercicio (Bompa & Buzzichelli, 2015)
 * - Deteccion de plateau: Kraemer & Ratamess (2004)
 */

// ──────────────────────────────────────────────
// TYPES DE ENTRADA
// ──────────────────────────────────────────────

export type WorkoutLogEntry = {
  id?: string;
  alumnoNombre?: string;
  alumnoEmail?: string;
  sessionId?: string;
  weekId?: string;
  dayId?: string;
  blockId?: string;
  exerciseId?: string;
  exerciseName?: string;
  exerciseKey?: string;
  fecha: string;
  series: number;
  repeticiones: number;
  pesoKg: number;
  molestia?: boolean;
  comentario?: string;
  createdAt?: string;
};

export type SessionFeedbackEntry = {
  id?: string;
  alumnoNombre?: string;
  alumnoEmail?: string;
  weekId?: string;
  dayId?: string;
  sessionId?: string;
  measurements?: Record<string, string>; // { rpe: "7", fatiga: "6", ... }
  totalWorkoutLogs?: number;
  logsWithPain?: number;
  createdAt?: string;
};

export type TrainingCompletionEntry = {
  weekId: string;
  dayId: string;
  sessionId?: string;
  fecha: string;
  completedAt?: string;
};

// ──────────────────────────────────────────────
// TYPES DEL PLAN (compatibles con semana/page.tsx internals)
// ──────────────────────────────────────────────

export type ProgressionSetDraft = {
  id: string;
  serie: number;
  repeticiones: string;
  cargaKg: string;
  rir: string;
  descanso: string;
  observaciones: string;
};

export type ProgressionSuperSerieDraft = {
  id: string;
  ejercicioId: string;
  series: string;
  repeticiones: string;
  descanso: string;
  carga: string;
};

export type ProgressionExerciseDraft = {
  id: string;
  ejercicioId: string;
  series: string;
  repeticiones: string;
  descanso: string;
  carga: string;
  especificaciones: { id: string; nombre: string; valor: string }[];
  serieDesglose: ProgressionSetDraft[];
  superSerie: ProgressionSuperSerieDraft[];
};

export type ProgressionBlockDraft = {
  id: string;
  titulo: string;
  objetivo: string;
  ejercicios: ProgressionExerciseDraft[];
};

export type ProgressionDayTraining = {
  titulo: string;
  descripcion: string;
  duracion: string;
  bloques: ProgressionBlockDraft[];
};

export type ProgressionDiaPlan = {
  id: string;
  dia: string;
  planificacion: string;
  objetivo?: string;
  sesionId?: string;
  oculto?: boolean;
  entrenamiento?: ProgressionDayTraining;
  [key: string]: unknown;
};

export type ProgressionSemanaPlan = {
  id: string;
  nombre: string;
  objetivo: string;
  oculto?: boolean;
  dias: ProgressionDiaPlan[];
  [key: string]: unknown;
};

// ──────────────────────────────────────────────
// TIPOS DE SALIDA DEL MOTOR
// ──────────────────────────────────────────────

export type ProgressionPhase =
  | "acumulacion"
  | "intensificacion"
  | "descarga"
  | "mantenimiento";

export type ProgressionDecisionType =
  | "progressive-overload"  // +4% carga, +3% intensidad
  | "supercompensation"     // +7% carga, +5% intensidad — fatiga muy baja, cumplimiento alto
  | "conservative"          // +1.5% carga, sin intensidad — fatiga moderada-alta
  | "maintenance"           // +2% carga, +1% intensidad — datos insuficientes
  | "same"                  // Sin cambio — cumplimiento bajo
  | "deload"                // -20% carga, -15% intensidad, -1 serie
  | "plateau-break";        // Variacion de ejercicios + carga reducida para romper estancamiento

export type ExerciseCategoryFactor = {
  loadFactor: number;      // 0-1 (1 = full delta, 0.5 = half)
  volumeFactor: number;    // 0-1
  adjustReps: boolean;
  adjustLoad: boolean;
  adjustSeries: boolean;
  rationale: string;
};

export type WeekPerformanceMetrics = {
  ownerKey: string;
  weekId: string;
  weekName: string;
  sessionsPlanned: number;
  sessionsCompleted: number;
  completionRate: number;
  exercisesLogged: number;
  totalRealLoad: number;
  avgRpe: number | null;
  avgFatigue: number | null;
  fatigueIndex: number | null;
  painReportCount: number;
  hasData: boolean;
  feedbackCount: number;
};

// ── NEW: Plateau detection result ──
export type PlateauAnalysis = {
  detected: boolean;
  consecutiveLowStimulus: number; // How many recent weeks had same/conservative/maintenance
  avgLoadDeltaRecent: number;     // Average load change in recent weeks
  avgFatigueRecent: number | null;
  recommendation: string;
};

// ── NEW: History record (persisted per generation) ──
export type ProgressionHistoryRecord = {
  id: string;
  ownerKey: string;
  personaNombre: string;
  generatedAt: string;           // ISO timestamp
  weekNumberInPlan: number;
  weekLabel: string;
  decision: ProgressionDecisionType;
  phase: ProgressionPhase;
  loadDeltaPct: number;
  intensityDeltaPct: number;
  seriesDelta: number;
  metrics: WeekPerformanceMetrics;
  rationaleEs: string;
  manualOverride: boolean;
  overrideLoadDeltaPct?: number; // If manually overridden, original delta before override
  plateauDetected: boolean;
};

export type ProgressionOutput = {
  decision: ProgressionDecisionType;
  phase: ProgressionPhase;
  metrics: WeekPerformanceMetrics;
  loadDeltaPct: number;
  intensityDeltaPct: number;
  seriesDelta: number;
  rationaleEs: string;
  weekLabel: string;
  generatedAt: string;
  nextWeekPlan: ProgressionSemanaPlan;
  plateau: PlateauAnalysis;
  historyRecord: ProgressionHistoryRecord;
};

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

const mkId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const mean = (arr: number[]): number | null => {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

const parseNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const roundStep = (v: number, step: number): number =>
  Math.round(v / step) * step;

const parseRepRange = (value: string): { min: number; max: number; avg: number } => {
  const nums = (value || "").replace(",", ".").match(/\d+(?:\.\d+)?/g) || [];
  const ns = nums.map(Number).filter(Number.isFinite);
  if (ns.length === 0) return { min: 0, max: 0, avg: 0 };
  if (ns.length === 1) return { min: ns[0], max: ns[0], avg: ns[0] };
  const min = Math.min(...ns);
  const max = Math.max(...ns);
  return { min, max, avg: (min + max) / 2 };
};

const formatRepRange = (min: number, max: number): string => {
  const a = Math.max(1, Math.round(min));
  const b = Math.max(a, Math.round(max));
  return a === b ? `${a}` : `${a}-${b}`;
};

const parseLoadKg = (value?: string): number | null => {
  if (!value?.trim()) return null;
  const num = parseNum(value.replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (num === null) return null;
  const lower = value.toLowerCase();
  if (lower.includes("%")) return null;
  return num;
};

const formatLoadKg = (kg: number): string => {
  const rounded = roundStep(kg, 0.5);
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} kg`;
};

const parseSeconds = (value?: string): number | null => {
  if (!value) return null;
  return parseNum(value.replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0]);
};

const formatSeconds = (sec: number): string =>
  `${Math.max(10, Math.round(sec))}s`;

export const namesLikelyMatch = (a: string, b: string): boolean => {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const la = norm(a);
  const lb = norm(b);
  if (!la || !lb) return false;
  if (la === lb) return true;
  if (la.includes(lb) || lb.includes(la)) return true;
  const ta = la.split(" ").filter(Boolean);
  const tb = lb.split(" ").filter(Boolean);
  const shared = ta.filter((t) => tb.includes(t));
  return shared.length >= 2 || shared.some((t) => t.length >= 5);
};

// ──────────────────────────────────────────────
// EXERCISE CATEGORY FACTORS
// ──────────────────────────────────────────────

const CATEGORY_FACTORS: Record<string, ExerciseCategoryFactor> = {
  "Pliométrico": {
    loadFactor: 0, volumeFactor: 0.8,
    adjustReps: true, adjustLoad: false, adjustSeries: false,
    rationale: "Pliométrico: solo se ajusta volumen (reps), nunca carga externa.",
  },
  "Isométrico": {
    loadFactor: 0, volumeFactor: 0.6,
    adjustReps: true, adjustLoad: false, adjustSeries: false,
    rationale: "Isométrico: se ajusta tiempo de tensión, no carga.",
  },
  "Balístico": {
    loadFactor: 0, volumeFactor: 0.7,
    adjustReps: false, adjustLoad: false, adjustSeries: true,
    rationale: "Balístico: solo series. Calidad de ejecución > volumen.",
  },
  "Básico de Fuerza": {
    loadFactor: 1.0, volumeFactor: 1.0,
    adjustReps: true, adjustLoad: true, adjustSeries: true,
    rationale: "Fuerza base: ajuste completo de carga, repeticiones y series.",
  },
  "Específico": {
    loadFactor: 0.75, volumeFactor: 0.75,
    adjustReps: true, adjustLoad: true, adjustSeries: false,
    rationale: "Específico: ajuste conservador (75%) para preservar patrón técnico.",
  },
  "Accesorio": {
    loadFactor: 0.5, volumeFactor: 0.5,
    adjustReps: true, adjustLoad: true, adjustSeries: false,
    rationale: "Accesorio: ajuste reducido (50%), foco en ejercicios principales.",
  },
  "Combinado": {
    loadFactor: 0.85, volumeFactor: 0.85,
    adjustReps: true, adjustLoad: true, adjustSeries: true,
    rationale: "Combinado: ajuste moderado (85%) por complejidad multiarticular.",
  },
};

const DEFAULT_CATEGORY_FACTOR: ExerciseCategoryFactor = {
  loadFactor: 1.0, volumeFactor: 1.0,
  adjustReps: true, adjustLoad: true, adjustSeries: true,
  rationale: "Ejercicio general: ajuste completo.",
};

const getCategoryFactor = (categoria?: string): ExerciseCategoryFactor =>
  (categoria && CATEGORY_FACTORS[categoria]) || DEFAULT_CATEGORY_FACTOR;

// ──────────────────────────────────────────────
// DECISION DELTAS
// ──────────────────────────────────────────────

export const DECISION_DELTAS: Record<
  ProgressionDecisionType,
  { loadDeltaPct: number; intensityDeltaPct: number; seriesDelta: number }
> = {
  supercompensation:       { loadDeltaPct: 7,   intensityDeltaPct: 5,  seriesDelta: 1  },
  "progressive-overload":  { loadDeltaPct: 4,   intensityDeltaPct: 3,  seriesDelta: 0  },
  maintenance:             { loadDeltaPct: 2,   intensityDeltaPct: 1,  seriesDelta: 0  },
  conservative:            { loadDeltaPct: 1.5, intensityDeltaPct: 0,  seriesDelta: 0  },
  same:                    { loadDeltaPct: 0,   intensityDeltaPct: 0,  seriesDelta: 0  },
  deload:                  { loadDeltaPct: -20, intensityDeltaPct: -15, seriesDelta: -1 },
  "plateau-break":         { loadDeltaPct: -8,  intensityDeltaPct: -5, seriesDelta: 0  },
};

export const DECISION_LABELS: Record<ProgressionDecisionType, string> = {
  supercompensation:       "Supercompensación",
  "progressive-overload":  "Sobrecarga progresiva",
  maintenance:             "Mantenimiento",
  conservative:            "Conservador",
  same:                    "Sin cambios",
  deload:                  "Descarga activa",
  "plateau-break":         "Romper plateau",
};

export const PHASE_LABELS: Record<ProgressionPhase, string> = {
  acumulacion:    "Acumulación",
  intensificacion: "Intensificación",
  descarga:       "Descarga",
  mantenimiento:  "Mantenimiento",
};

const LOW_STIMULUS_DECISIONS: ProgressionDecisionType[] = [
  "same", "conservative", "maintenance", "deload"
];

// ──────────────────────────────────────────────
// 1. ANÁLISIS DE PERFORMANCE SEMANAL
// ──────────────────────────────────────────────

export function analyzeWeekPerformance(params: {
  ownerKey: string;
  personaName: string;
  currentWeekPlan: ProgressionSemanaPlan;
  workoutLogs: WorkoutLogEntry[];
  sessionFeedbacks: SessionFeedbackEntry[];
  trainingCompletions: TrainingCompletionEntry[];
}): WeekPerformanceMetrics {
  const { ownerKey, personaName, currentWeekPlan, workoutLogs, sessionFeedbacks, trainingCompletions } = params;

  const weekCompletions = trainingCompletions.filter(
    (c) => c.weekId === currentWeekPlan.id
  );
  const completedDayIds = new Set(weekCompletions.map((c) => c.dayId));

  const plannedDays = (currentWeekPlan.dias || []).filter(
    (d) =>
      !d.oculto &&
      d.planificacion &&
      d.planificacion !== "" &&
      !d.planificacion.toLowerCase().includes("descans") &&
      !d.planificacion.toLowerCase().includes("libre")
  );
  const sessionsPlanned = plannedDays.length;
  const sessionsCompleted = plannedDays.filter((d) => completedDayIds.has(d.id)).length;
  const completionRate = sessionsPlanned > 0 ? sessionsCompleted / sessionsPlanned : 0;

  const personLogs = workoutLogs.filter((log) =>
    namesLikelyMatch(log.alumnoNombre || "", personaName)
  );
  const exercisesLogged = personLogs.length;
  const totalRealLoad = personLogs.reduce(
    (acc, log) => acc + log.pesoKg * log.series * log.repeticiones,
    0
  );
  const painReportCount = personLogs.filter((log) => log.molestia).length;

  const personFeedbacks = sessionFeedbacks.filter((fb) =>
    namesLikelyMatch(fb.alumnoNombre || "", personaName)
  );
  const rpeValues = personFeedbacks
    .map((fb) => parseNum(fb.measurements?.rpe))
    .filter((v): v is number => v !== null && v > 0);
  const fatigueValues = personFeedbacks
    .map((fb) => parseNum(fb.measurements?.fatiga))
    .filter((v): v is number => v !== null && v > 0);

  const avgRpe = mean(rpeValues);
  const avgFatigue = mean(fatigueValues);
  const fatigueIndex =
    avgRpe !== null && avgFatigue !== null
      ? avgRpe * 0.6 + avgFatigue * 0.4
      : avgRpe ?? avgFatigue ?? null;

  const hasData = exercisesLogged > 0 || personFeedbacks.length > 0;

  return {
    ownerKey,
    weekId: currentWeekPlan.id,
    weekName: currentWeekPlan.nombre,
    sessionsPlanned,
    sessionsCompleted,
    completionRate,
    exercisesLogged,
    totalRealLoad: Math.round(totalRealLoad),
    avgRpe,
    avgFatigue,
    fatigueIndex,
    painReportCount,
    hasData,
    feedbackCount: personFeedbacks.length,
  };
}

// ──────────────────────────────────────────────
// 2. PLATEAU DETECTION  (NEW)
// ──────────────────────────────────────────────

export function detectPlateau(
  historicalRecords: ProgressionHistoryRecord[]
): PlateauAnalysis {
  // Need at least 3 records to detect a plateau
  if (historicalRecords.length < 3) {
    return {
      detected: false,
      consecutiveLowStimulus: 0,
      avgLoadDeltaRecent: 0,
      avgFatigueRecent: null,
      recommendation: "Insuficientes semanas para detectar plateau.",
    };
  }

  // Look at last 4 records
  const recent = [...historicalRecords]
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    .slice(0, 4);

  let consecutiveLowStimulus = 0;
  for (const rec of recent) {
    if (LOW_STIMULUS_DECISIONS.includes(rec.decision)) {
      consecutiveLowStimulus++;
    } else {
      break;
    }
  }

  const avgLoadDeltaRecent =
    recent.reduce((acc, r) => acc + r.loadDeltaPct, 0) / recent.length;

  const fatigueValues = recent
    .map((r) => r.metrics.fatigueIndex)
    .filter((v): v is number => v !== null);
  const avgFatigueRecent = mean(fatigueValues);

  // Plateau: 3+ consecutive weeks of low stimulus AND low fatigue (not just tired)
  const lowFatigue = avgFatigueRecent === null || avgFatigueRecent <= 5.5;
  const detected = consecutiveLowStimulus >= 3 && lowFatigue && avgLoadDeltaRecent <= 2;

  const recommendation = detected
    ? "Se detectaron 3+ semanas de estimulo bajo con fatiga normal. " +
      "Considera cambiar ejercicios principales, variar rangos de repeticiones, " +
      "o incrementar la densidad de entrenamiento para romper el estancamiento."
    : consecutiveLowStimulus >= 2
    ? `Tendencia hacia plateau: ${consecutiveLowStimulus} semanas de bajo estimulo. Monitorear la próxima semana.`
    : "Sin señales de plateau. Progresión normal.";

  return {
    detected,
    consecutiveLowStimulus,
    avgLoadDeltaRecent,
    avgFatigueRecent,
    recommendation,
  };
}

// ──────────────────────────────────────────────
// 3. DECISION DE PROGRESION
// ──────────────────────────────────────────────

export function decideProgression(
  metrics: WeekPerformanceMetrics,
  weekNumber: number,
  plateau?: PlateauAnalysis,
  manualOverridePct?: number | null // If trainer sets a manual override
): {
  decision: ProgressionDecisionType;
  phase: ProgressionPhase;
  rationaleEs: string;
  effectiveLoadDeltaPct: number; // Final delta after any override
} {
  const mesocycleWeek = ((weekNumber - 1) % 4) + 1;

  const phase: ProgressionPhase =
    mesocycleWeek === 4 ? "descarga"
    : mesocycleWeek === 3 ? "intensificacion"
    : "acumulacion";

  // Forced deload on week 4 of every mesocycle (override can still adjust magnitude)
  if (mesocycleWeek === 4) {
    const deltas = DECISION_DELTAS.deload;
    const effectiveDelta = manualOverridePct ?? deltas.loadDeltaPct;
    return {
      decision: "deload",
      phase,
      rationaleEs:
        `Semana ${weekNumber} — descarga planificada del mesociclo (semana 4/4). ` +
        `Reducción de carga y volumen para consolidar adaptaciones y prevenir sobreentrenamiento.` +
        (manualOverridePct !== null && manualOverridePct !== undefined
          ? ` Ajuste manual aplicado: ${manualOverridePct > 0 ? "+" : ""}${manualOverridePct}% sobre la prescripción de descarga.`
          : ""),
      effectiveLoadDeltaPct: effectiveDelta,
    };
  }

  // Plateau override: si se detectó y el entrenador NO mandó un override manual
  if (plateau?.detected && (manualOverridePct === null || manualOverridePct === undefined)) {
    return {
      decision: "plateau-break",
      phase,
      rationaleEs:
        `Plateau detectado: ${plateau.consecutiveLowStimulus} semanas consecutivas de bajo estímulo ` +
        `con fatiga normal (${plateau.avgFatigueRecent?.toFixed(1) ?? "—"}/10). ` +
        `Se aplica variación de estímulo y reducción táctica de carga para forzar nueva adaptación. ` +
        `${plateau.recommendation}`,
      effectiveLoadDeltaPct: DECISION_DELTAS["plateau-break"].loadDeltaPct,
    };
  }

  // No data case
  if (!metrics.hasData) {
    const deltas = DECISION_DELTAS.maintenance;
    return {
      decision: "maintenance",
      phase,
      rationaleEs: `Sin registros en Semana ${weekNumber}. Mantenimiento conservador hasta contar con datos del alumno.`,
      effectiveLoadDeltaPct: manualOverridePct ?? deltas.loadDeltaPct,
    };
  }

  const fi = metrics.fatigueIndex;
  const cr = metrics.completionRate;

  let decision: ProgressionDecisionType;
  let rationaleEs: string;

  if (fi !== null && fi >= 8.5) {
    decision = "deload";
    rationaleEs = `Fatiga crítica (${fi.toFixed(1)}/10). Descarga de emergencia para prevenir sobreentrenamiento y lesiones.`;
  } else if ((fi !== null && fi >= 7.5) || cr < 0.5) {
    decision = "conservative";
    const reason = fi !== null && fi >= 7.5
      ? `fatiga elevada (${fi.toFixed(1)}/10)` : `cumplimiento bajo (${Math.round(cr * 100)}%)`;
    rationaleEs = `Progresión conservadora por ${reason}. Incremento mínimo para sostener adaptaciones.`;
  } else if (cr < 0.75) {
    decision = "same";
    rationaleEs = `Cumplimiento ${Math.round(cr * 100)}% — por debajo del umbral mínimo (75%). Sin cambio de carga hasta completar consistentemente el plan.`;
  } else if ((fi === null || fi <= 4.5) && cr >= 0.9) {
    decision = "supercompensation";
    const fiLabel = fi !== null ? ` · Fatiga ${fi.toFixed(1)}/10` : "";
    rationaleEs = `Ventana de supercompensación: cumplimiento ${Math.round(cr * 100)}%${fiLabel}. El sistema está adaptado — salto de carga mayor para maximizar estímulo.`;
  } else if ((fi === null || fi <= 6.5) && cr >= 0.75) {
    decision = "progressive-overload";
    const fiLabel = fi !== null ? ` · Fatiga ${fi.toFixed(1)}/10` : "";
    rationaleEs = `Parámetros óptimos: cumplimiento ${Math.round(cr * 100)}%${fiLabel}. Sobrecarga progresiva estándar — estímulo principal del mesociclo.`;
  } else {
    decision = "maintenance";
    rationaleEs = `Zona de mantenimiento. Incremento leve para sostener adaptaciones conseguidas.`;
  }

  // Apply manual override if set
  const baseDelta = DECISION_DELTAS[decision].loadDeltaPct;
  const effectiveLoadDeltaPct = manualOverridePct ?? baseDelta;

  if (manualOverridePct !== null && manualOverridePct !== undefined && manualOverridePct !== baseDelta) {
    rationaleEs += ` — Ajuste manual del entrenador: ${manualOverridePct > 0 ? "+" : ""}${manualOverridePct}% (base calculada: ${baseDelta > 0 ? "+" : ""}${baseDelta}%).`;
  }

  return { decision, phase, rationaleEs, effectiveLoadDeltaPct };
}

// ──────────────────────────────────────────────
// 4. AJUSTE DE EJERCICIO INDIVIDUAL
// ──────────────────────────────────────────────

function adjustExercise(
  exercise: ProgressionExerciseDraft,
  decision: ProgressionDecisionType,
  effectiveLoadDeltaPct: number, // already includes manual override
  categoryFactor: ExerciseCategoryFactor,
  actualWeight: number | null
): ProgressionExerciseDraft {
  const deltas = DECISION_DELTAS[decision];
  const effectiveLoad = effectiveLoadDeltaPct * categoryFactor.loadFactor;
  const effectiveVolume = deltas.intensityDeltaPct * categoryFactor.volumeFactor;
  const seriesAdjust = categoryFactor.adjustSeries ? deltas.seriesDelta : 0;

  const newSeries = (() => {
    const n = parseNum(exercise.series) ?? 3;
    return String(Math.max(1, Math.min(8, Math.round(n + seriesAdjust))));
  })();

  const newRepeticiones = (() => {
    if (!categoryFactor.adjustReps) return exercise.repeticiones;
    const { min, max } = parseRepRange(exercise.repeticiones);
    if (min === 0 && max === 0) return exercise.repeticiones;
    const factor = 1 + effectiveVolume / 100;
    return formatRepRange(clamp(min * factor, 1, 40), clamp(max * factor, min, 40));
  })();

  const newCarga = (() => {
    if (!categoryFactor.adjustLoad) return exercise.carga;
    const baseKg = actualWeight ?? parseLoadKg(exercise.carga);
    if (baseKg !== null && baseKg > 0) {
      return formatLoadKg(baseKg * (1 + effectiveLoad / 100));
    }
    if (exercise.carga?.includes("%")) {
      const m = exercise.carga.match(/\d+(?:\.\d+)?/);
      if (m) {
        return `${Math.round(clamp(Number(m[0]) + effectiveLoad, 30, 100))}% 1RM`;
      }
    }
    return exercise.carga;
  })();

  const newSerieDesglose: ProgressionSetDraft[] = (exercise.serieDesglose ?? []).map((set) => {
    const baseKgSet = actualWeight ?? (parseNum(set.cargaKg) ?? 0);
    const newCargaKg = (() => {
      if (!categoryFactor.adjustLoad || baseKgSet <= 0) return set.cargaKg;
      const adjusted = roundStep(baseKgSet * (1 + effectiveLoad / 100), 0.5);
      return adjusted % 1 === 0 ? adjusted.toFixed(0) : adjusted.toFixed(1);
    })();
    const newSetReps = (() => {
      if (!categoryFactor.adjustReps) return set.repeticiones;
      const { min, max } = parseRepRange(set.repeticiones);
      if (min === 0 && max === 0) return set.repeticiones;
      const factor = 1 + effectiveVolume / 100;
      return formatRepRange(min * factor, max * factor);
    })();
    const newDescanso = (() => {
      const sec = parseSeconds(set.descanso);
      if (sec === null) return set.descanso;
      return formatSeconds(clamp(sec * (1 + effectiveLoad / 200), 20, 300));
    })();
    return { ...set, id: mkId(), repeticiones: newSetReps, cargaKg: newCargaKg, descanso: newDescanso };
  });

  const newDescanso = (() => {
    const sec = parseSeconds(exercise.descanso);
    if (sec === null) return exercise.descanso;
    return formatSeconds(clamp(sec * (1 + effectiveLoad / 200), 20, 300));
  })();

  return {
    ...exercise,
    id: mkId(),
    series: newSeries,
    repeticiones: newRepeticiones,
    carga: newCarga,
    descanso: newDescanso,
    serieDesglose: newSerieDesglose,
    especificaciones: (exercise.especificaciones ?? []).map((s) => ({ ...s, id: mkId() })),
    superSerie: (exercise.superSerie ?? []).map((ss) => {
      const ssKg = parseLoadKg(ss.carga);
      const newSsCarga = ssKg !== null && ssKg > 0 && categoryFactor.adjustLoad
        ? formatLoadKg(ssKg * (1 + effectiveLoad / 100)) : ss.carga;
      return { ...ss, id: mkId(), carga: newSsCarga };
    }),
  };
}

// ──────────────────────────────────────────────
// 5. OBTENER PESO REAL USADO
// ──────────────────────────────────────────────

function getActualWeightForExercise(
  exerciseId: string,
  exerciseName: string,
  workoutLogs: WorkoutLogEntry[]
): number | null {
  const relevant = workoutLogs.filter(
    (log) =>
      (log.exerciseId === exerciseId ||
        (exerciseName &&
          log.exerciseName &&
          log.exerciseName.toLowerCase().trim() === exerciseName.toLowerCase().trim())) &&
      log.pesoKg > 0
  );
  if (relevant.length === 0) return null;
  const sorted = relevant.map((l) => l.pesoKg).sort((a, b) => b - a);
  const p90Index = Math.max(0, Math.floor(sorted.length * 0.1));
  return sorted[p90Index];
}

// ──────────────────────────────────────────────
// 6. GENERACION DEL PLAN DE LA PROXIMA SEMANA
// ──────────────────────────────────────────────

export function generateNextWeekPlan(params: {
  currentWeekPlan: ProgressionSemanaPlan;
  decision: ProgressionDecisionType;
  phase: ProgressionPhase;
  weekNumber: number;
  rationaleEs: string;
  effectiveLoadDeltaPct: number;
  personaWorkoutLogs: WorkoutLogEntry[];
  ejercicioMap: Record<string, { categoria?: string; nombre?: string }>;
}): ProgressionSemanaPlan {
  const { currentWeekPlan, decision, phase, weekNumber, rationaleEs, effectiveLoadDeltaPct, personaWorkoutLogs, ejercicioMap } = params;

  const weekLabel = `Semana ${weekNumber} · ${PHASE_LABELS[phase]}`;
  const objetivo = `[AUTO] ${DECISION_LABELS[decision]} · ${rationaleEs.slice(0, 120)}${rationaleEs.length > 120 ? "…" : ""}`;

  const newDias: ProgressionDiaPlan[] = (currentWeekPlan.dias || []).map((dia) => {
    if (!dia.entrenamiento) return { ...dia, id: mkId() };

    const newBloques: ProgressionBlockDraft[] = (dia.entrenamiento.bloques || []).map((bloque) => {
      const newEjercicios: ProgressionExerciseDraft[] = (bloque.ejercicios || []).map((ejercicio) => {
        const eInfo = ejercicioMap[ejercicio.ejercicioId] || {};
        const categoryFactor = getCategoryFactor(eInfo.categoria);
        const actualWeight = getActualWeightForExercise(
          ejercicio.ejercicioId,
          eInfo.nombre || "",
          personaWorkoutLogs
        );
        return adjustExercise(ejercicio, decision, effectiveLoadDeltaPct, categoryFactor, actualWeight);
      });
      return { ...bloque, id: mkId(), ejercicios: newEjercicios };
    });

    return { ...dia, id: mkId(), entrenamiento: { ...dia.entrenamiento, bloques: newBloques } };
  });

  return { ...currentWeekPlan, id: mkId(), nombre: weekLabel, objetivo, dias: newDias };
}

// ──────────────────────────────────────────────
// 7. FUNCION PRINCIPAL (PIPELINE COMPLETO)
// ──────────────────────────────────────────────

export type ProgressionEngineInput = {
  ownerKey: string;
  personaName: string;
  currentWeekPlan: ProgressionSemanaPlan;
  weekNumberInPlan: number;
  workoutLogs: WorkoutLogEntry[];
  sessionFeedbacks: SessionFeedbackEntry[];
  trainingCompletions: TrainingCompletionEntry[];
  ejercicioMap: Record<string, { categoria?: string; nombre?: string }>;
  historicalRecords?: ProgressionHistoryRecord[]; // For plateau detection + multi-week coherence
  manualOverridePct?: number | null;              // Trainer's manual load delta override
};

export function runProgressionEngine(input: ProgressionEngineInput): ProgressionOutput {
  const metrics = analyzeWeekPerformance({
    ownerKey: input.ownerKey,
    personaName: input.personaName,
    currentWeekPlan: input.currentWeekPlan,
    workoutLogs: input.workoutLogs,
    sessionFeedbacks: input.sessionFeedbacks,
    trainingCompletions: input.trainingCompletions,
  });

  // Plateau analysis from history
  const personHistory = (input.historicalRecords || []).filter(
    (r) => r.ownerKey === input.ownerKey
  );
  const plateau = detectPlateau(personHistory);

  const { decision, phase, rationaleEs, effectiveLoadDeltaPct } = decideProgression(
    metrics,
    input.weekNumberInPlan,
    plateau,
    input.manualOverridePct ?? null
  );

  const deltas = DECISION_DELTAS[decision];

  const personaLogs = input.workoutLogs.filter((log) =>
    namesLikelyMatch(log.alumnoNombre || "", input.personaName)
  );

  const nextWeekNumber = input.weekNumberInPlan + 1;
  const nextWeekPlan = generateNextWeekPlan({
    currentWeekPlan: input.currentWeekPlan,
    decision,
    phase,
    weekNumber: nextWeekNumber,
    rationaleEs,
    effectiveLoadDeltaPct,
    personaWorkoutLogs: personaLogs,
    ejercicioMap: input.ejercicioMap,
  });

  const weekLabel = `Semana ${nextWeekNumber} · ${PHASE_LABELS[phase]}`;
  const generatedAt = new Date().toISOString();

  // Build history record
  const historyRecord: ProgressionHistoryRecord = {
    id: mkId(),
    ownerKey: input.ownerKey,
    personaNombre: input.personaName,
    generatedAt,
    weekNumberInPlan: input.weekNumberInPlan,
    weekLabel,
    decision,
    phase,
    loadDeltaPct: effectiveLoadDeltaPct,
    intensityDeltaPct: deltas.intensityDeltaPct,
    seriesDelta: deltas.seriesDelta,
    metrics,
    rationaleEs,
    manualOverride: input.manualOverridePct !== null && input.manualOverridePct !== undefined,
    overrideLoadDeltaPct: input.manualOverridePct ?? undefined,
    plateauDetected: plateau.detected,
  };

  return {
    decision,
    phase,
    metrics,
    loadDeltaPct: effectiveLoadDeltaPct,
    intensityDeltaPct: deltas.intensityDeltaPct,
    seriesDelta: deltas.seriesDelta,
    rationaleEs,
    weekLabel,
    generatedAt,
    nextWeekPlan,
    plateau,
    historyRecord,
  };
}

// ──────────────────────────────────────────────
// EXPORTS DE UTILIDADES
// ──────────────────────────────────────────────

export { getCategoryFactor };
