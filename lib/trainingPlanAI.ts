type TargetType = "jugadoras" | "alumnos";

type PlanLevel = "iniciacion" | "desarrollo" | "rendimiento" | "elite";

type WeekPhase = "acumulacion" | "intensificacion" | "competitiva" | "descarga";

type EventType = "partido" | "especial" | "control";

type CapacityKey = "fuerza" | "velocidad" | "resistencia" | "potencia" | "movilidad" | "tecnica";

export type TrainingPlanEvent = {
  date: string;
  type: EventType;
  description: string;
  importance: number;
};

export type ExercisePrescription = {
  exerciseName: string;
  series: number;
  reps: string;
  restSec: number;
  intensity: string;
  rationale: string;
};

export type TrainingPlanBlock = {
  id: string;
  title: string;
  purpose: string;
  durationMin: number;
  rationale: string;
  exercises: ExercisePrescription[];
};

export type TrainingPlanSession = {
  id: string;
  weekNumber: number;
  sessionNumber: number;
  date: string;
  title: string;
  goal: string;
  intensityTarget: number;
  estimatedLoad: number;
  rationale: string;
  blocks: TrainingPlanBlock[];
};

export type TrainingPlanWeek = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  phase: WeekPhase;
  focus: string;
  plannedLoad: number;
  adjustedLoad: number;
  rationale: string;
  events: TrainingPlanEvent[];
  sessions: TrainingPlanSession[];
};

export type TrainingPlan = {
  id: string;
  createdAt: string;
  updatedAt: string;
  targetType: TargetType;
  targetName: string;
  sport: string;
  category: string;
  ageMin: number;
  ageMax: number;
  level: PlanLevel;
  notes: string;
  objectives: string[];
  capabilities: CapacityKey[];
  constraints: string[];
  sessionsPerWeek: number;
  sessionDurationMin: number;
  totalWeeks: number;
  startDate: string;
  weeklyProgression: { week: number; load: number; phase: WeekPhase; rationale: string }[];
  scientificBasis: string[];
  events: TrainingPlanEvent[];
  weeks: TrainingPlanWeek[];
};

export type TrainingPlanCreateInput = {
  targetType?: TargetType;
  targetName?: string;
  sport?: string;
  category?: string;
  ageMin?: number;
  ageMax?: number;
  level?: PlanLevel | string;
  notes?: string;
  objectives?: string[] | string;
  capabilities?: string[] | string;
  constraints?: string[] | string;
  sessionsPerWeek?: number;
  sessionDurationMin?: number;
  weeks?: number;
  startDate?: string;
  events?: TrainingPlanEvent[];
};

export type TrainingPlanExtendInput = {
  existingPlan?: TrainingPlan;
  extraWeeks?: number;
  events?: TrainingPlanEvent[];
};

export type TrainingPlanRecalculateInput = {
  plan?: TrainingPlan;
  weekNumber?: number;
  wellnessScore?: number;
  externalLoadDelta?: number;
  note?: string;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const mkId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const parseIsoDate = (value: string | undefined, fallback: Date) => {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
};

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
};

const clampFloat = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
};

const normalizeList = (value: string[] | string | undefined, fallback: string[]) => {
  if (!value) return fallback;
  const raw = Array.isArray(value) ? value.join(",") : value;
  const normalized = raw
    .split(/[\n,;|]+/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (normalized.length === 0) return fallback;
  return Array.from(new Set(normalized));
};

const normalizeLevel = (value: string | undefined): PlanLevel => {
  const normalized = String(value || "desarrollo").trim().toLowerCase();
  if (normalized === "iniciacion") return "iniciacion";
  if (normalized === "rendimiento") return "rendimiento";
  if (normalized === "elite") return "elite";
  return "desarrollo";
};

const normalizeCapacity = (raw: string): CapacityKey | null => {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("fuer")) return "fuerza";
  if (value.startsWith("vel")) return "velocidad";
  if (value.startsWith("res")) return "resistencia";
  if (value.startsWith("pot")) return "potencia";
  if (value.startsWith("mov")) return "movilidad";
  if (value.startsWith("tec")) return "tecnica";
  return null;
};

const normalizeEventType = (value: string | undefined): EventType => {
  const normalized = String(value || "especial").trim().toLowerCase();
  if (normalized === "partido") return "partido";
  if (normalized === "control") return "control";
  return "especial";
};

const normalizeEvents = (events: TrainingPlanEvent[] | undefined): TrainingPlanEvent[] => {
  if (!Array.isArray(events)) return [];

  return events
    .map((event) => ({
      date: toIsoDate(parseIsoDate(event.date, new Date())),
      type: normalizeEventType(event.type),
      description: String(event.description || "Evento sin descripcion").trim() || "Evento sin descripcion",
      importance: clampInt(event.importance, 1, 5, 3),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const resolveAgeBand = (ageMax: number) => {
  if (ageMax <= 13) return "formativo";
  if (ageMax <= 17) return "juvenil";
  return "adulto";
};

const levelFactorByLevel: Record<PlanLevel, number> = {
  iniciacion: 0.84,
  desarrollo: 1,
  rendimiento: 1.12,
  elite: 1.2,
};

const baseLoadByPhase: Record<WeekPhase, number> = {
  acumulacion: 62,
  intensificacion: 74,
  competitiva: 68,
  descarga: 48,
};

const sessionOffsetsByFrequency: Record<number, number[]> = {
  1: [2],
  2: [1, 4],
  3: [1, 3, 5],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 5, 6],
  6: [0, 1, 2, 3, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

const exerciseLibraryByCapacity: Record<CapacityKey, string[]> = {
  fuerza: [
    "Sentadilla goblet",
    "Peso muerto rumano",
    "Zancada posterior",
    "Empuje de trineo",
    "Press horizontal",
  ],
  velocidad: [
    "Sprint 10-20m",
    "Aceleraciones con salida reactiva",
    "Cambios de direccion 5-10-5",
    "Pliometria de baja altura",
    "Skips tecnicos",
  ],
  resistencia: [
    "Intermitentes 15-15",
    "Bloques aeróbicos extensivos",
    "Rondos con densidad",
    "Circuito locomotor continuo",
    "Repeticiones submaximas",
  ],
  potencia: [
    "Saltos con caida controlada",
    "Lanzamientos medball",
    "Sentadilla con salto",
    "Arranques cortos",
    "Pliometria horizontal",
  ],
  movilidad: [
    "Movilidad cadera y tobillo",
    "Movilidad toracica",
    "Patrones de control lumbopelvico",
    "Respiracion diafragmatica",
    "Secuencia de recuperacion",
  ],
  tecnica: [
    "Rondo orientado",
    "Toma de decision guiada",
    "Tecnica especifica por puesto",
    "Juego reducido condicionado",
    "Tareas tecnico-tacticas",
  ],
};

const scientificBasis = [
  "Principio de sobrecarga progresiva con control de monotonia semanal.",
  "Distribucion de cargas con semanas de descarga para consolidar adaptaciones.",
  "Ajuste de intensidad por edad biologica, experiencia y proximidad competitiva.",
  "Bloques con objetivo mecanico y metabolico explicito para cada capacidad.",
  "Microdosificacion de velocidad/fuerza para sostener transferencias al deporte.",
];

const phaseForWeek = (weekIndex: number, totalWeeks: number): WeekPhase => {
  if (totalWeeks <= 3) {
    if (weekIndex === totalWeeks - 1) return "descarga";
    return weekIndex === 0 ? "acumulacion" : "intensificacion";
  }

  if ((weekIndex + 1) % 4 === 0) {
    return "descarga";
  }

  const ratio = weekIndex / Math.max(1, totalWeeks - 1);
  if (ratio < 0.42) return "acumulacion";
  if (ratio < 0.78) return "intensificacion";
  return "competitiva";
};

const focusByPhase = (phase: WeekPhase, capacities: CapacityKey[], sport: string) => {
  const top = capacities.slice(0, 2).join(" + ");
  if (phase === "descarga") {
    return `Recuperacion activa, tecnica y movilidad aplicadas a ${sport} (${top})`;
  }
  if (phase === "competitiva") {
    return `Puesta a punto especifica para competir en ${sport} (${top})`;
  }
  if (phase === "intensificacion") {
    return `Consolidacion de intensidad en ${sport} con foco ${top}`;
  }
  return `Base estructural para ${sport} con foco ${top}`;
};

const getWeekEvents = (events: TrainingPlanEvent[], startDate: string, endDate: string) => {
  const startMs = parseIsoDate(startDate, new Date()).getTime();
  const endMs = parseIsoDate(endDate, new Date()).getTime();
  return events.filter((event) => {
    const ms = parseIsoDate(event.date, new Date()).getTime();
    return ms >= startMs && ms <= endMs;
  });
};

const computeAdjustedWeeklyLoad = (
  phase: WeekPhase,
  ageBand: string,
  level: PlanLevel,
  events: TrainingPlanEvent[]
) => {
  let load = baseLoadByPhase[phase] * levelFactorByLevel[level];

  if (ageBand === "formativo") load -= 9;
  if (ageBand === "juvenil") load -= 4;

  for (const event of events) {
    if (event.type === "partido") {
      load -= 2 + event.importance * 2.4;
    } else if (event.type === "especial") {
      load -= event.importance;
    } else {
      load -= Math.max(1, event.importance - 1);
    }
  }

  return Math.round(clampFloat(load, 35, 92, 60));
};

const intensityRangeForPhase = (phase: WeekPhase, ageBand: string) => {
  const byPhase: Record<WeekPhase, [number, number]> = {
    acumulacion: [58, 72],
    intensificacion: [70, 84],
    competitiva: [66, 82],
    descarga: [48, 64],
  };

  const [min, max] = byPhase[phase];
  if (ageBand === "formativo") return [min - 8, max - 10] as [number, number];
  if (ageBand === "juvenil") return [min - 4, max - 5] as [number, number];
  return [min, max] as [number, number];
};

const doseByCapacity = (
  capacity: CapacityKey,
  phase: WeekPhase,
  ageBand: string,
  load: number,
  sessionIndex: number
): ExercisePrescription[] => {
  const names = exerciseLibraryByCapacity[capacity];
  const nameA = names[(sessionIndex * 2) % names.length];
  const nameB = names[(sessionIndex * 2 + 1) % names.length];

  let baseSeries = 3;
  let repRange = "8-10";
  let restSec = 75;

  if (capacity === "velocidad" || capacity === "potencia") {
    baseSeries = phase === "descarga" ? 3 : 4;
    repRange = ageBand === "formativo" ? "4-6" : "3-5";
    restSec = phase === "competitiva" ? 120 : 105;
  } else if (capacity === "resistencia") {
    baseSeries = phase === "intensificacion" ? 4 : 3;
    repRange = ageBand === "formativo" ? "20-30s" : "30-45s";
    restSec = phase === "descarga" ? 50 : 65;
  } else if (capacity === "movilidad") {
    baseSeries = 2;
    repRange = "6-8 por lado";
    restSec = 35;
  }

  if (phase === "descarga") {
    baseSeries = Math.max(2, baseSeries - 1);
  }

  const intensityA = clampInt(load + (capacity === "fuerza" ? 4 : 0), 45, 92, 65);
  const intensityB = clampInt(load - (capacity === "movilidad" ? 12 : 3), 40, 90, 62);

  return [
    {
      exerciseName: nameA,
      series: baseSeries,
      reps: repRange,
      restSec,
      intensity: `${intensityA}% esfuerzo objetivo`,
      rationale: `Estimulo principal de ${capacity} para sostener transferencia al deporte.`,
    },
    {
      exerciseName: nameB,
      series: Math.max(2, baseSeries - (capacity === "movilidad" ? 0 : 1)),
      reps: repRange,
      restSec: Math.max(30, restSec - 10),
      intensity: `${intensityB}% esfuerzo objetivo`,
      rationale: `Complemento tecnico para controlar fatiga y mantener calidad de movimiento.`,
    },
  ];
};

const createSession = (input: {
  weekNumber: number;
  sessionNumber: number;
  date: string;
  phase: WeekPhase;
  load: number;
  focus: string;
  capacities: CapacityKey[];
  durationMin: number;
  ageBand: string;
  events: TrainingPlanEvent[];
}) => {
  const [intensityMin, intensityMax] = intensityRangeForPhase(input.phase, input.ageBand);
  const intensityTarget = clampInt(input.load, intensityMin, intensityMax, intensityMin);

  const coreCapacity = input.capacities[input.sessionNumber % input.capacities.length] || "fuerza";
  const secondaryCapacity =
    input.capacities[(input.sessionNumber + 1) % input.capacities.length] || "movilidad";

  const warmupDuration = Math.max(10, Math.round(input.durationMin * 0.18));
  const mainDuration = Math.max(20, Math.round(input.durationMin * 0.55));
  const supportDuration = Math.max(10, Math.round(input.durationMin * 0.2));

  const eventHint = input.events.length
    ? `Se detectan ${input.events.length} evento(s) en la semana y se regula densidad.`
    : "Sin eventos competitivos en la semana; se sostiene progresion prevista.";

  const blocks: TrainingPlanBlock[] = [
    {
      id: `${mkId()}-warmup`,
      title: "Activacion especifica",
      purpose: "Preparar sistema neuromuscular y patrones tecnicos antes de la carga central.",
      durationMin: warmupDuration,
      rationale:
        "La activacion reduce el costo mecanico inicial y mejora calidad tecnica en bloques posteriores.",
      exercises: [
        {
          exerciseName: "Movilidad dinamica guiada",
          series: 2,
          reps: "6-8 por patron",
          restSec: 25,
          intensity: "40-55% esfuerzo objetivo",
          rationale: "Elevar temperatura y rango util de movimiento sin fatiga residual.",
        },
      ],
    },
    {
      id: `${mkId()}-main`,
      title: `Bloque principal · ${coreCapacity}`,
      purpose: `Estimulo central para ${coreCapacity} con progresion controlada por fase ${input.phase}.`,
      durationMin: mainDuration,
      rationale: `Bloque orientado al objetivo semanal (${input.focus}). ${eventHint}`,
      exercises: doseByCapacity(coreCapacity, input.phase, input.ageBand, input.load, input.sessionNumber),
    },
    {
      id: `${mkId()}-support`,
      title: `Bloque soporte · ${secondaryCapacity}`,
      purpose: `Complementar la sesion y sostener adaptaciones en ${secondaryCapacity}.`,
      durationMin: supportDuration,
      rationale:
        "La combinacion principal + soporte evita monotonia y mejora la transferencia al contexto competitivo.",
      exercises: doseByCapacity(secondaryCapacity, input.phase, input.ageBand, input.load - 6, input.sessionNumber + 1),
    },
  ];

  return {
    id: mkId(),
    weekNumber: input.weekNumber,
    sessionNumber: input.sessionNumber + 1,
    date: input.date,
    title: `Sesion ${input.weekNumber}.${input.sessionNumber + 1}`,
    goal: input.focus,
    intensityTarget,
    estimatedLoad: input.load,
    rationale:
      `Sesion periodizada para fase ${input.phase}, con objetivo ${input.focus.toLowerCase()} y dosis ajustada al contexto.`,
    blocks,
  } satisfies TrainingPlanSession;
};

const createWeek = (input: {
  weekNumber: number;
  startDate: string;
  sessionsPerWeek: number;
  durationMin: number;
  phase: WeekPhase;
  sport: string;
  level: PlanLevel;
  ageBand: string;
  capabilities: CapacityKey[];
  events: TrainingPlanEvent[];
}) => {
  const endDate = addDays(input.startDate, 6);
  const weekEvents = getWeekEvents(input.events, input.startDate, endDate);
  const plannedLoad = Math.round(baseLoadByPhase[input.phase] * levelFactorByLevel[input.level]);
  const adjustedLoad = computeAdjustedWeeklyLoad(input.phase, input.ageBand, input.level, weekEvents);
  const focus = focusByPhase(input.phase, input.capabilities, input.sport);

  const offsets = sessionOffsetsByFrequency[input.sessionsPerWeek] || sessionOffsetsByFrequency[3];
  const sessions = offsets.map((offset, sessionIdx) =>
    createSession({
      weekNumber: input.weekNumber,
      sessionNumber: sessionIdx,
      date: addDays(input.startDate, offset),
      phase: input.phase,
      load: adjustedLoad,
      focus,
      capacities: input.capabilities,
      durationMin: input.durationMin,
      ageBand: input.ageBand,
      events: weekEvents,
    })
  );

  const rationale =
    weekEvents.length > 0
      ? `Semana ${input.weekNumber} ajustada por ${weekEvents.length} evento(s) competitivo(s)/especial(es), priorizando calidad de estimulo.`
      : `Semana ${input.weekNumber} sin eventos limitantes: progresion normal de ${input.phase}.`;

  return {
    weekNumber: input.weekNumber,
    startDate: input.startDate,
    endDate,
    phase: input.phase,
    focus,
    plannedLoad,
    adjustedLoad,
    rationale,
    events: weekEvents,
    sessions,
  } satisfies TrainingPlanWeek;
};

const getDefaultCapabilities = () => ["fuerza", "velocidad", "resistencia"] as CapacityKey[];

const toCapabilities = (value: string[] | string | undefined): CapacityKey[] => {
  const normalized = normalizeList(value, getDefaultCapabilities());
  const capabilities = normalized
    .map((item) => normalizeCapacity(item))
    .filter((item): item is CapacityKey => Boolean(item));

  if (capabilities.length === 0) return getDefaultCapabilities();
  return Array.from(new Set(capabilities));
};

const buildScientificBasis = (input: {
  ageBand: string;
  level: PlanLevel;
  sport: string;
  objectives: string[];
}) => {
  const objectiveSummary = input.objectives.length > 0 ? input.objectives.join(", ") : "objetivos generales";
  const ageLine =
    input.ageBand === "formativo"
      ? "Se prioriza alfabetizacion motriz y exposicion progresiva, evitando picos de fatiga."
      : input.ageBand === "juvenil"
      ? "Se combinan estimulos de desarrollo fisico con control tecnico para edades en crecimiento."
      : "Se utiliza periodizacion orientada a rendimiento con control de carga y recuperacion.";

  return [
    ...scientificBasis,
    `Objetivos declarados: ${objectiveSummary}.`,
    `Contexto: ${input.sport} en nivel ${input.level}.`,
    ageLine,
  ];
};

const nextWeekStart = (isoDate: string, weekOffset: number) =>
  toIsoDate(new Date(parseIsoDate(isoDate, new Date()).getTime() + weekOffset * 7 * ONE_DAY_MS));

export function buildTrainingPlan(input: TrainingPlanCreateInput): TrainingPlan {
  const now = new Date().toISOString();
  const startDate = toIsoDate(parseIsoDate(input.startDate, new Date()));
  const totalWeeks = clampInt(input.weeks, 1, 52, 8);
  const sessionsPerWeek = clampInt(input.sessionsPerWeek, 1, 7, 3);
  const sessionDurationMin = clampInt(input.sessionDurationMin, 35, 180, 75);
  const ageMin = clampInt(input.ageMin, 8, 60, 16);
  const ageMax = clampInt(input.ageMax, ageMin, 70, Math.max(ageMin, 22));
  const level = normalizeLevel(input.level);
  const capabilities = toCapabilities(input.capabilities);
  const objectives = normalizeList(input.objectives, ["mejora general del rendimiento"]);
  const constraints = normalizeList(input.constraints, []);
  const events = normalizeEvents(input.events);
  const ageBand = resolveAgeBand(ageMax);

  const weeks: TrainingPlanWeek[] = [];
  for (let weekIdx = 0; weekIdx < totalWeeks; weekIdx += 1) {
    const phase = phaseForWeek(weekIdx, totalWeeks);
    weeks.push(
      createWeek({
        weekNumber: weekIdx + 1,
        startDate: nextWeekStart(startDate, weekIdx),
        sessionsPerWeek,
        durationMin: sessionDurationMin,
        phase,
        sport: String(input.sport || "deporte"),
        level,
        ageBand,
        capabilities,
        events,
      })
    );
  }

  return {
    id: `plan-${mkId()}`,
    createdAt: now,
    updatedAt: now,
    targetType: input.targetType === "jugadoras" ? "jugadoras" : "alumnos",
    targetName: String(input.targetName || "Plan IA").trim() || "Plan IA",
    sport: String(input.sport || "Futbol").trim() || "Futbol",
    category: String(input.category || "General").trim() || "General",
    ageMin,
    ageMax,
    level,
    notes: String(input.notes || "").trim(),
    objectives,
    capabilities,
    constraints,
    sessionsPerWeek,
    sessionDurationMin,
    totalWeeks,
    startDate,
    weeklyProgression: weeks.map((week) => ({
      week: week.weekNumber,
      load: week.adjustedLoad,
      phase: week.phase,
      rationale: week.rationale,
    })),
    scientificBasis: buildScientificBasis({ ageBand, level, sport: String(input.sport || "deporte"), objectives }),
    events,
    weeks,
  };
}

export function extendTrainingPlan(input: TrainingPlanExtendInput): TrainingPlan {
  const existingPlan = input.existingPlan;
  if (!existingPlan || !Array.isArray(existingPlan.weeks) || existingPlan.weeks.length === 0) {
    return buildTrainingPlan({ weeks: clampInt(input.extraWeeks, 1, 16, 4) });
  }

  const extraWeeks = clampInt(input.extraWeeks, 1, 24, 4);
  const level = normalizeLevel(existingPlan.level);
  const ageBand = resolveAgeBand(existingPlan.ageMax);
  const mergedEvents = normalizeEvents([...(existingPlan.events || []), ...(input.events || [])]);

  const weeks = [...existingPlan.weeks];
  const startFrom = addDays(weeks[weeks.length - 1].endDate, 1);

  for (let i = 0; i < extraWeeks; i += 1) {
    const absoluteWeekIndex = weeks.length + i;
    const phase = phaseForWeek(absoluteWeekIndex, weeks.length + extraWeeks);
    weeks.push(
      createWeek({
        weekNumber: absoluteWeekIndex + 1,
        startDate: nextWeekStart(startFrom, i),
        sessionsPerWeek: clampInt(existingPlan.sessionsPerWeek, 1, 7, 3),
        durationMin: clampInt(existingPlan.sessionDurationMin, 35, 180, 75),
        phase,
        sport: existingPlan.sport,
        level,
        ageBand,
        capabilities: existingPlan.capabilities,
        events: mergedEvents,
      })
    );
  }

  return {
    ...existingPlan,
    updatedAt: new Date().toISOString(),
    events: mergedEvents,
    totalWeeks: weeks.length,
    weeklyProgression: weeks.map((week) => ({
      week: week.weekNumber,
      load: week.adjustedLoad,
      phase: week.phase,
      rationale: week.rationale,
    })),
    weeks,
  };
}

export function recalculateTrainingWeek(input: TrainingPlanRecalculateInput): TrainingPlan {
  const plan = input.plan;
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    return buildTrainingPlan({ weeks: 4 });
  }

  const weekNumber = clampInt(input.weekNumber, 1, plan.weeks.length, 1);
  const targetIndex = weekNumber - 1;
  const wellnessScore = clampFloat(input.wellnessScore, 1, 10, 7);
  const externalLoadDelta = clampFloat(input.externalLoadDelta, -30, 30, 0);

  const readinessAdjustment = (wellnessScore - 7) * 4;
  const weeks = plan.weeks.map((week, index) => {
    if (index !== targetIndex) return week;

    const adjustedLoad = Math.round(
      clampFloat(week.adjustedLoad + readinessAdjustment + externalLoadDelta, 35, 95, week.adjustedLoad)
    );
    const intensityFactor = adjustedLoad / Math.max(35, week.adjustedLoad);

    const sessions = week.sessions.map((session) => {
      const updatedIntensity = Math.round(clampFloat(session.intensityTarget * intensityFactor, 45, 95, session.intensityTarget));
      const updatedEstimatedLoad = Math.round(clampFloat(session.estimatedLoad * intensityFactor, 30, 100, session.estimatedLoad));

      const updatedBlocks = session.blocks.map((block) => ({
        ...block,
        exercises: block.exercises.map((exercise) => {
          const reducedSeries = intensityFactor < 0.92 ? Math.max(2, exercise.series - 1) : exercise.series;
          return {
            ...exercise,
            series: reducedSeries,
            intensity: `${Math.round(clampFloat(updatedIntensity - 4, 40, 95, updatedIntensity))}% esfuerzo objetivo`,
            rationale:
              intensityFactor < 1
                ? `${exercise.rationale} Ajustado por fatiga/readiness semanal para sostener calidad.`
                : `${exercise.rationale} Ajustado por readiness favorable para sostener progresion.`,
          };
        }),
      }));

      return {
        ...session,
        intensityTarget: updatedIntensity,
        estimatedLoad: updatedEstimatedLoad,
        rationale:
          intensityFactor < 1
            ? `${session.rationale} Recalculada por wellness ${wellnessScore.toFixed(1)} y ajuste de carga conservador.`
            : `${session.rationale} Recalculada por wellness ${wellnessScore.toFixed(1)} con progresion controlada.`,
        blocks: updatedBlocks,
      };
    });

    return {
      ...week,
      adjustedLoad,
      rationale: `${week.rationale} Recalculada con wellness ${wellnessScore.toFixed(1)} y delta externo ${externalLoadDelta}. ${String(
        input.note || ""
      ).trim()}`.trim(),
      sessions,
    };
  });

  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    weeklyProgression: weeks.map((week) => ({
      week: week.weekNumber,
      load: week.adjustedLoad,
      phase: week.phase,
      rationale: week.rationale,
    })),
    weeks,
  };
}
