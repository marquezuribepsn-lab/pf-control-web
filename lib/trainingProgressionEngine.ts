/**
 * trainingProgressionEngine.ts
 * Motor de progresion inteligente para el sistema de seguimiento de entrenamientos.
 *
 * Logica pura (sin React, sin side effects).
 * Lee datos de la semana actual y genera el plan para la proxima.
 *
 * Principios cientificos aplicados:
 * - Sobrecarga progresiva controlada (Zatsiorsky, 2006)
 * - Modelo de periodizacion ondulante (Rhea et al., 2002)
 * - Autorregulacion por RPE (Zourdos et al., 2016)
 * - Ciclo de 4 semanas: acumulacion x3 + descarga x1
 * - Ajuste por tipo de ejercicio (Bompa & Buzzichelli, 2015)
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
  | "conservative"          // +2% carga, sin intensidad — fatiga moderada-alta
  | "maintenance"           // +1% carga, +1% intensidad — datos insuficientes
  | "same"                  // Sin cambio — cumplimiento bajo
  | "deload";               // -20% carga, -15% intensidad, -1 serie

export type ExerciseCategoryFactor = {
  loadFactor: number;      // 0-1 (1 = full delta, 0.5 = half)
  volumeFactor: number;    // 0-1
  adjustReps: boolean;     // si ajusta repeticiones
  adjustLoad: boolean;     // si ajusta carga/peso
  adjustSeries: boolean;   // si ajusta series
  rationale: string;
};

export type WeekPerformanceMetrics = {
  ownerKey: string;
  weekId: string;
  weekName: string;
  sessionsPlanned: number;
  sessionsCompleted: number;
  completionRate: number;         // 0.0 - 1.0
  exercisesLogged: number;
  totalRealLoad: number;          // sum(pesoKg * series * reps)
  avgRpe: number | null;          // null si sin datos
  avgFatigue: number | null;
  fatigueIndex: number | null;    // weighted composite
  painReportCount: number;
  hasData: boolean;               // si hay logs o feedback
  feedbackCount: number;
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
  if (lower.includes("%")) return null; // porcentaje, no kg absoluto
  return num;
};

const formatLoadKg = (kg: number): string => {
  const rounded = roundStep(kg, 0.5);
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} kg`;
};

const parseSeconds = (value?: string): number | null => {
  if (!value) return null;
  const n = parseNum(value.replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return n;
};

const formatSeconds = (sec: number): string => `${Math.max(10, Math.round(sec))}s`;

const namesLikelyMatch = (a: string, b: string): boolean => {
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
    loadFactor: 0,
    volumeFactor: 0.8,
    adjustReps: true,
    adjustLoad: false,
    adjustSeries: false,
    rationale: "Ejercicio pliométrico: solo se ajusta volumen (repeticiones), nunca la carga externa.",
  },
  "Isométrico": {
    loadFactor: 0,
    volumeFactor: 0.6,
    adjustReps: true,   // duración de hold = repeticiones string
    adjustLoad: false,
    adjustSeries: false,
    rationale: "Ejercicio isométrico: se ajusta tiempo de tensión, no carga externa.",
  },
  "Balístico": {
    loadFactor: 0,
    volumeFactor: 0.7,
    adjustReps: false,
    adjustLoad: false,
    adjustSeries: true,
    rationale: "Ejercicio balístico: se ajustan series solamente. Prioridad es la calidad de ejecución.",
  },
  "Básico de Fuerza": {
    loadFactor: 1.0,
    volumeFactor: 1.0,
    adjustReps: true,
    adjustLoad: true,
    adjustSeries: true,
    rationale: "Ejercicio de fuerza base: ajuste completo de carga, repeticiones y series.",
  },
  "Específico": {
    loadFactor: 0.75,
    volumeFactor: 0.75,
    adjustReps: true,
    adjustLoad: true,
    adjustSeries: false,
    rationale: "Ejercicio específico: ajuste conservador (75%) para preservar patrón técnico.",
  },
  "Accesorio": {
    loadFactor: 0.5,
    volumeFactor: 0.5,
    adjustReps: true,
    adjustLoad: true,
    adjustSeries: false,
    rationale: "Ejercicio accesorio: ajuste reducido (50%) para mantener el foco en ejercicios principales.",
  },
  "Combinado": {
    loadFactor: 0.85,
    volumeFactor: 0.85,
    adjustReps: true,
    adjustLoad: true,
    adjustSeries: true,
    rationale: "Ejercicio combinado: ajuste moderado (85%) por complejidad multiarticular.",
  },
};

const DEFAULT_CATEGORY_FACTOR: ExerciseCategoryFactor = {
  loadFactor: 1.0,
  volumeFactor: 1.0,
  adjustReps: true,
  adjustLoad: true,
  adjustSeries: true,
  rationale: "Ejercicio general: ajuste completo.",
};

const getCategoryFactor = (categoria?: string): ExerciseCategoryFactor => {
  if (!categoria) return DEFAULT_CATEGORY_FACTOR;
  return CATEGORY_FACTORS[categoria] || DEFAULT_CATEGORY_FACTOR;
};

// ──────────────────────────────────────────────
// DECISION DELTAS
// ──────────────────────────────────────────────

const DECISION_DELTAS: Record<
  ProgressionDecisionType,
  { loadDeltaPct: number; intensityDeltaPct: number; seriesDelta: number }
> = {
  "supercompensation": { loadDeltaPct: 7, intensityDeltaPct: 5, seriesDelta: 1 },
  "progressive-overload": { loadDeltaPct: 4, intensityDeltaPct: 3, seriesDelta: 0 },
  "maintenance": { loadDeltaPct: 2, intensityDeltaPct: 1, seriesDelta: 0 },
  "conservative": { loadDeltaPct: 1.5, intensityDeltaPct: 0, seriesDelta: 0 },
  "same": { loadDeltaPct: 0, intensityDeltaPct: 0, seriesDelta: 0 },
  "deload": { loadDeltaPct: -20, intensityDeltaPct: -15, seriesDelta: -1 },
};

const DECISION_LABELS: Record<ProgressionDecisionType, string> = {
  "supercompensation": "Supercompensación",
  "progressive-overload": "Sobrecarga progresiva",
  "maintenance": "Mantenimiento",
  "conservative": "Conservador",
  "same": "Sin cambios",
  "deload": "Descarga activa",
};

const PHASE_LABELS: Record<ProgressionPhase, string> = {
  acumulacion: "Acumulación",
  intensificacion: "Intensificación",
  descarga: "Descarga",
  mantenimiento: "Mantenimiento",
};

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

  // ── Completions for this week ──
  const weekCompletions = trainingCompletions.filter(
    (c) => c.weekId === currentWeekPlan.id
  );
  const completedDayIds = new Set(weekCompletions.map((c) => c.dayId));

  // ── Planned training days (exclude rest/empty) ──
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

  // ── Workout logs for this person ──
  const personLogs = workoutLogs.filter((log) =>
    namesLikelyMatch(log.alumnoNombre || "", personaName)
  );
  const exercisesLogged = personLogs.length;
  const totalRealLoad = personLogs.reduce(
    (acc, log) => acc + log.pesoKg * log.series * log.repeticiones,
    0
  );
  const painReportCount = personLogs.filter((log) => log.molestia).length;

  // ── Session feedback for this person ──
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

  // Weighted fatigue index: RPE has more weight (reflects effort intensity)
  const fatigueIndex =
    avgRpe !== null && avgFatigue !== null
      ? avgRpe * 0.6 + avgFatigue * 0.4
      : avgRpe !== null
      ? avgRpe
      : avgFatigue !== null
      ? avgFatigue
      : null;

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
// 2. DECISION DE PROGRESION
// ──────────────────────────────────────────────

export function decideProgression(
  metrics: WeekPerformanceMetrics,
  weekNumber: number // 1-indexed position in the person's plan
): {
  decision: ProgressionDecisionType;
  phase: ProgressionPhase;
  rationaleEs: string;
} {
  // Week within 4-week mesocycle (1, 2, 3, 4)
  const mesocycleWeek = ((weekNumber - 1) % 4) + 1;

  // Phase determination based on mesocycle position
  const phase: ProgressionPhase =
    mesocycleWeek === 4
      ? "descarga"
      : mesocycleWeek === 3
      ? "intensificacion"
      : "acumulacion";

  // Forced deload on week 4 of every mesocycle
  if (mesocycleWeek === 4) {
    return {
      decision: "deload",
      phase,
      rationaleEs:
        `Semana ${weekNumber} corresponde a la descarga planificada del mesociclo (semana 4 de 4). ` +
        `Se reduce carga y volumen para consolidar adaptaciones y prevenir sobreentrenamiento.`,
    };
  }

  // No data → conservative default
  if (!metrics.hasData) {
    return {
      decision: "maintenance",
      phase,
      rationaleEs:
        `Sin registros de entrenamiento ni feedback para Semana ${weekNumber}. ` +
        `Se aplica mantenimiento conservador hasta contar con datos del alumno.`,
    };
  }

  const fi = metrics.fatigueIndex;
  const cr = metrics.completionRate;

  // Emergency deload: very high fatigue
  if (fi !== null && fi >= 8.5) {
    return {
      decision: "deload",
      phase,
      rationaleEs:
        `Índice de fatiga crítico (${fi.toFixed(1)}/10) detectado. ` +
        `Se prescribe descarga de emergencia para evitar sobreentrenamiento y riesgo lesional. ` +
        `Recomendación: verificar sueño, nutrición y estrés del alumno.`,
    };
  }

  // High fatigue or very low completion
  if ((fi !== null && fi >= 7.5) || cr < 0.5) {
    const reason =
      fi !== null && fi >= 7.5
        ? `fatiga elevada (${fi.toFixed(1)}/10)`
        : `cumplimiento bajo (${Math.round(cr * 100)}%)`;
    return {
      decision: "conservative",
      phase,
      rationaleEs:
        `Progresión conservadora por ${reason}. ` +
        `Se incrementa carga mínimamente para sostener adaptaciones sin agravar la fatiga acumulada.`,
    };
  }

  // Low completion (but fatigue acceptable)
  if (cr < 0.75) {
    return {
      decision: "same",
      phase,
      rationaleEs:
        `Cumplimiento semanal del ${Math.round(cr * 100)}% — por debajo del umbral mínimo para progresar. ` +
        `Se mantiene la misma prescripción hasta completar consistentemente el plan.`,
    };
  }

  // Low fatigue + high completion = supercompensation window
  if ((fi === null || fi <= 4.5) && cr >= 0.9) {
    const fiLabel = fi !== null ? ` (fatiga ${fi.toFixed(1)}/10)` : "";
    return {
      decision: "supercompensation",
      phase,
      rationaleEs:
        `Ventana de supercompensación detectada: cumplimiento ${Math.round(cr * 100)}%${fiLabel}. ` +
        `El sistema está adaptado y puede tolerar un salto de carga mayor para maximizar estímulo. ` +
        `Se aplica sobrecarga progresiva acelerada.`,
    };
  }

  // Good fatigue + good completion = standard progressive overload
  if ((fi === null || fi <= 6.5) && cr >= 0.75) {
    const fiLabel = fi !== null ? ` | Fatiga ${fi.toFixed(1)}/10` : "";
    return {
      decision: "progressive-overload",
      phase,
      rationaleEs:
        `Parámetros óptimos: cumplimiento ${Math.round(cr * 100)}%${fiLabel}. ` +
        `Se aplica sobrecarga progresiva estándar — el estímulo principal del mesociclo.`,
    };
  }

  // Default: maintenance
  return {
    decision: "maintenance",
    phase,
    rationaleEs:
      `Zona de mantenimiento: el alumno completó la semana pero los datos sugieren moderación. ` +
      `Se incrementa la carga levemente para sostener las adaptaciones conseguidas.`,
  };
}

// ──────────────────────────────────────────────
// 3. AJUSTE DE EJERCICIO INDIVIDUAL
// ──────────────────────────────────────────────

function adjustExercise(
  exercise: ProgressionExerciseDraft,
  decision: ProgressionDecisionType,
  categoryFactor: ExerciseCategoryFactor,
  actualWeight: number | null // real weight lifted by athlete this week, or null
): ProgressionExerciseDraft {
  const deltas = DECISION_DELTAS[decision];
  const effectiveLoadDelta = deltas.loadDeltaPct * categoryFactor.loadFactor;
  const effectiveVolumeDelta = deltas.intensityDeltaPct * categoryFactor.volumeFactor;
  const seriesAdjust = categoryFactor.adjustSeries ? deltas.seriesDelta : 0;

  // ── Adjust series ──
  const newSeries = (() => {
    const n = parseNum(exercise.series) ?? 3;
    const adjusted = Math.max(1, Math.min(8, Math.round(n + seriesAdjust)));
    return String(adjusted);
  })();

  // ── Adjust repetitions ──
  const newRepeticiones = (() => {
    if (!categoryFactor.adjustReps) return exercise.repeticiones;
    const { min, max } = parseRepRange(exercise.repeticiones);
    if (min === 0 && max === 0) return exercise.repeticiones;
    const factor = 1 + effectiveVolumeDelta / 100;
    const newMin = clamp(min * factor, 1, 40);
    const newMax = clamp(max * factor, newMin, 40);
    return formatRepRange(newMin, newMax);
  })();

  // ── Adjust load (carga) ──
  const newCarga = (() => {
    if (!categoryFactor.adjustLoad) return exercise.carga;
    const baseKg = actualWeight ?? parseLoadKg(exercise.carga);
    if (baseKg !== null && baseKg > 0) {
      const factor = 1 + effectiveLoadDelta / 100;
      return formatLoadKg(baseKg * factor);
    }
    // Percentage-based load (e.g., "75% 1RM")
    if (exercise.carga?.includes("%")) {
      const percentMatch = exercise.carga.match(/\d+(?:\.\d+)?/);
      if (percentMatch) {
        const currentPct = Number(percentMatch[0]);
        const newPct = clamp(currentPct + effectiveLoadDelta, 30, 100);
        return `${Math.round(newPct)}% 1RM`;
      }
    }
    return exercise.carga;
  })();

  // ── Adjust set breakdown ──
  const newSerieDesglose: ProgressionSetDraft[] = exercise.serieDesglose.map((set) => {
    const baseKgSet = actualWeight ?? (parseNum(set.cargaKg) ?? 0);
    const newCargaKg = (() => {
      if (!categoryFactor.adjustLoad) return set.cargaKg;
      if (baseKgSet > 0) {
        const factor = 1 + effectiveLoadDelta / 100;
        const adjusted = roundStep(baseKgSet * factor, 0.5);
        return adjusted % 1 === 0 ? adjusted.toFixed(0) : adjusted.toFixed(1);
      }
      return set.cargaKg;
    })();

    const newSetReps = (() => {
      if (!categoryFactor.adjustReps) return set.repeticiones;
      const { min, max } = parseRepRange(set.repeticiones);
      if (min === 0 && max === 0) return set.repeticiones;
      const factor = 1 + effectiveVolumeDelta / 100;
      return formatRepRange(min * factor, max * factor);
    })();

    // Adjust rest time
    const newDescanso = (() => {
      const sec = parseSeconds(set.descanso);
      if (sec === null) return set.descanso;
      // More intensity → more rest; deload → less rest
      const restFactor = 1 + effectiveLoadDelta / 200;
      return formatSeconds(clamp(sec * restFactor, 20, 300));
    })();

    return {
      ...set,
      id: mkId(),
      repeticiones: newSetReps,
      cargaKg: newCargaKg,
      descanso: newDescanso,
    };
  });

  // Adjust top-level descanso
  const newDescanso = (() => {
    const sec = parseSeconds(exercise.descanso);
    if (sec === null) return exercise.descanso;
    const restFactor = 1 + effectiveLoadDelta / 200;
    return formatSeconds(clamp(sec * restFactor, 20, 300));
  })();

  return {
    ...exercise,
    id: mkId(),
    series: newSeries,
    repeticiones: newRepeticiones,
    carga: newCarga,
    descanso: newDescanso,
    serieDesglose: newSerieDesglose,
    // Reset especificaciones IDs
    especificaciones: exercise.especificaciones.map((spec) => ({
      ...spec,
      id: mkId(),
    })),
    // Adjust super series
    superSerie: exercise.superSerie.map((ss) => {
      const ssKg = parseLoadKg(ss.carga);
      const newSsCarga =
        ssKg !== null && ssKg > 0 && categoryFactor.adjustLoad
          ? formatLoadKg(ssKg * (1 + effectiveLoadDelta / 100))
          : ss.carga;
      return { ...ss, id: mkId(), carga: newSsCarga };
    }),
  };
}

// ──────────────────────────────────────────────
// 4. OBTENER PESO REAL USADO POR EL ALUMNO
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

  // Use 90th percentile of weights (robust to warm-up sets)
  const sorted = relevant.map((l) => l.pesoKg).sort((a, b) => b - a);
  const p90Index = Math.max(0, Math.floor(sorted.length * 0.1));
  return sorted[p90Index];
}

// ──────────────────────────────────────────────
// 5. GENERACION DEL PLAN DE LA PROXIMA SEMANA
// ──────────────────────────────────────────────

export function generateNextWeekPlan(params: {
  currentWeekPlan: ProgressionSemanaPlan;
  decision: ProgressionDecisionType;
  phase: ProgressionPhase;
  weekNumber: number;  // next week number (currentWeek + 1)
  rationaleEs: string;
  personaWorkoutLogs: WorkoutLogEntry[];
  ejercicioMap: Record<string, { categoria?: string; nombre?: string }>; // ejercicioId → categoria/nombre
}): ProgressionSemanaPlan {
  const {
    currentWeekPlan,
    decision,
    phase,
    weekNumber,
    rationaleEs,
    personaWorkoutLogs,
    ejercicioMap,
  } = params;

  const weekLabel = `Semana ${weekNumber} · ${PHASE_LABELS[phase]}`;
  const objetivo = `[AUTO] ${DECISION_LABELS[decision]} · ${rationaleEs.slice(0, 120)}${rationaleEs.length > 120 ? "…" : ""}`;

  const newDias: ProgressionDiaPlan[] = (currentWeekPlan.dias || []).map((dia) => {
    if (!dia.entrenamiento) {
      return { ...dia, id: mkId() };
    }

    const newBloques: ProgressionBlockDraft[] = (dia.entrenamiento.bloques || []).map(
      (bloque) => {
        const newEjercicios: ProgressionExerciseDraft[] = (bloque.ejercicios || []).map(
          (ejercicio) => {
            const eInfo = ejercicioMap[ejercicio.ejercicioId] || {};
            const categoryFactor = getCategoryFactor(eInfo.categoria);
            const actualWeight = getActualWeightForExercise(
              ejercicio.ejercicioId,
              eInfo.nombre || "",
              personaWorkoutLogs
            );

            return adjustExercise(ejercicio, decision, categoryFactor, actualWeight);
          }
        );

        return {
          ...bloque,
          id: mkId(),
          ejercicios: newEjercicios,
        };
      }
    );

    return {
      ...dia,
      id: mkId(),
      entrenamiento: {
        ...dia.entrenamiento,
        bloques: newBloques,
      },
    };
  });

  return {
    ...currentWeekPlan,
    id: mkId(),
    nombre: weekLabel,
    objetivo,
    dias: newDias,
  };
}

// ──────────────────────────────────────────────
// 6. FUNCION PRINCIPAL (PIPELINE COMPLETO)
// ──────────────────────────────────────────────

export type ProgressionEngineInput = {
  ownerKey: string;
  personaName: string;
  currentWeekPlan: ProgressionSemanaPlan;
  weekNumberInPlan: number; // the index (1-based) of currentWeekPlan in the person's semanas[]
  workoutLogs: WorkoutLogEntry[];
  sessionFeedbacks: SessionFeedbackEntry[];
  trainingCompletions: TrainingCompletionEntry[];
  ejercicioMap: Record<string, { categoria?: string; nombre?: string }>;
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

  const { decision, phase, rationaleEs } = decideProgression(
    metrics,
    input.weekNumberInPlan
  );

  const deltas = DECISION_DELTAS[decision];

  // Filter to only this person's logs for weight lookup
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
    personaWorkoutLogs: personaLogs,
    ejercicioMap: input.ejercicioMap,
  });

  const weekLabel = `Semana ${nextWeekNumber} · ${PHASE_LABELS[phase]}`;

  return {
    decision,
    phase,
    metrics,
    loadDeltaPct: deltas.loadDeltaPct,
    intensityDeltaPct: deltas.intensityDeltaPct,
    seriesDelta: deltas.seriesDelta,
    rationaleEs,
    weekLabel,
    generatedAt: new Date().toISOString(),
    nextWeekPlan,
  };
}

// ──────────────────────────────────────────────
// EXPORTS DE UTILIDADES
// ──────────────────────────────────────────────

export { DECISION_LABELS, PHASE_LABELS, getCategoryFactor };
