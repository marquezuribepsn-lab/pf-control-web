export type CapabilityKey =
  | "fuerza"
  | "velocidad"
  | "resistencia"
  | "potencia"
  | "agilidad"
  | "movilidad"
  | "tecnica";

export type TrainingLevel = "iniciacion" | "desarrollo" | "rendimiento";
export type TrainingTargetType = "alumno" | "plantel";
export type CalendarEventKind = "partido" | "especial";

export type TrainingPlanEventInput = {
  date: string;
  label: string;
  kind: CalendarEventKind;
  importance?: number;
};

export type TrainingPlanRequest = {
  mode: "create" | "extend";
  targetType: TrainingTargetType;
  targetName: string;
  sport: string;
  category: string;
  ageMin: number;
  ageMax: number;
  level: TrainingLevel;
  objectives: string[];
  capabilities: CapabilityKey[];
  constraints: string[];
  sessionsPerWeek: number;
  sessionDurationMin: number;
  weeks: number;
  startDate: string;
  events: TrainingPlanEventInput[];
  notes?: string;
  existingPlan?: GeneratedTrainingPlan;
};

export type PlanExercise = {
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  intensityGuide: string;
  rationale: string;
  tempo?: string;
  rir?: string;
  notes?: string;
};

export type PlanBlock = {
  title: string;
  objective: string;
  rationale: string;
  exercises: PlanExercise[];
};

export type PlanSession = {
  id: string;
  dayLabel: string;
  focus: CapabilityKey;
  objective: string;
  rationale: string;
  durationMin: number;
  blocks: PlanBlock[];
};

export type PlanWeek = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  phase: "acumulacion" | "intensificacion" | "descarga" | "competitiva";
  loadIndex: number;
  hasMatch: boolean;
  events: TrainingPlanEventInput[];
  rationale: string;
  sessions: PlanSession[];
};

export type GeneratedTrainingPlan = {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  targetType: TrainingTargetType;
  targetName: string;
  sport: string;
  category: string;
  level: TrainingLevel;
  ageMin: number;
  ageMax: number;
  objectives: string[];
  capabilities: CapabilityKey[];
  constraints: string[];
  sessionDurationMin: number;
  sessionsPerWeek: number;
  startDate: string;
  totalWeeks: number;
  notes?: string;
  scientificBasis: string[];
  progressionSummary: string[];
  weeks: PlanWeek[];
};

function toDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function capabilityLabel(capability: CapabilityKey): string {
  if (capability === "fuerza") return "fuerza";
  if (capability === "velocidad") return "velocidad";
  if (capability === "resistencia") return "resistencia";
  if (capability === "potencia") return "potencia";
  if (capability === "agilidad") return "agilidad";
  if (capability === "movilidad") return "movilidad";
  return "tecnica";
}

function ageBand(ageMin: number, ageMax: number): "u14" | "u18" | "adult" {
  if (ageMax <= 14) return "u14";
  if (ageMax <= 18) return "u18";
  if (ageMin < 18 && ageMax > 18) return "u18";
  return "adult";
}

function baseLoad(level: TrainingLevel, band: "u14" | "u18" | "adult"): number {
  const byLevel = level === "iniciacion" ? 58 : level === "desarrollo" ? 68 : 76;
  const byAge = band === "u14" ? -8 : band === "u18" ? -3 : 0;
  return byLevel + byAge;
}

function stableHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickDays(sessionsPerWeek: number): string[] {
  const safe = clamp(Math.round(sessionsPerWeek), 1, 6);
  if (safe === 1) return ["Miercoles"];
  if (safe === 2) return ["Martes", "Jueves"];
  if (safe === 3) return ["Lunes", "Miercoles", "Viernes"];
  if (safe === 4) return ["Lunes", "Martes", "Jueves", "Viernes"];
  if (safe === 5) return ["Lunes", "Martes", "Miercoles", "Viernes", "Sabado"];
  return ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
}

function normalizeEvents(events: TrainingPlanEventInput[]): TrainingPlanEventInput[] {
  return events
    .map((event): TrainingPlanEventInput => {
      const kind: CalendarEventKind = event.kind === "especial" ? "especial" : "partido";
      return {
        ...event,
        importance: clamp(Number(event.importance || 3), 1, 5),
        kind,
      };
    })
    .filter((event) => Boolean(toDate(event.date)));
}

function isDateInWeek(date: Date, weekStart: Date, weekEnd: Date): boolean {
  return date.getTime() >= weekStart.getTime() && date.getTime() <= weekEnd.getTime();
}

function phaseForWeek(
  weekNumber: number,
  hasMatch: boolean
): "acumulacion" | "intensificacion" | "descarga" | "competitiva" {
  if (hasMatch) return "competitiva";
  const cyclePosition = weekNumber % 4;
  if (cyclePosition === 0) return "descarga";
  if (cyclePosition === 3) return "intensificacion";
  return "acumulacion";
}

function loadDeltaByPhase(phase: "acumulacion" | "intensificacion" | "descarga" | "competitiva"): number {
  if (phase === "acumulacion") return 3;
  if (phase === "intensificacion") return 6;
  if (phase === "competitiva") return -4;
  return -10;
}

function volumeFactor(phase: "acumulacion" | "intensificacion" | "descarga" | "competitiva"): number {
  if (phase === "acumulacion") return 1.05;
  if (phase === "intensificacion") return 0.92;
  if (phase === "competitiva") return 0.8;
  return 0.72;
}

function intensityHint(phase: "acumulacion" | "intensificacion" | "descarga" | "competitiva"): string {
  if (phase === "acumulacion") return "RPE 6-7 / 65-75%";
  if (phase === "intensificacion") return "RPE 7-8 / 75-85%";
  if (phase === "competitiva") return "RPE 6-8 con baja fatiga residual";
  return "RPE 5-6 / foco tecnico";
}

function templateForCapability(capability: CapabilityKey, phase: "acumulacion" | "intensificacion" | "descarga" | "competitiva", band: "u14" | "u18" | "adult", sport: string): PlanBlock[] {
  const factor = volumeFactor(phase);
  const youth = band !== "adult";
  const mainSets = clamp(Math.round((youth ? 3 : 4) * factor), 2, 5);
  const accessorySets = clamp(Math.round((youth ? 2 : 3) * factor), 2, 4);

  if (capability === "fuerza") {
    return [
      {
        title: "Bloque principal de fuerza",
        objective: "Mejorar produccion de fuerza util para el deporte.",
        rationale: "Se usan patrones multiarticulares y control del esfuerzo para estimular adaptaciones neuromusculares sin exceso de fatiga.",
        exercises: [
          {
            name: "Sentadilla con control de tempo",
            sets: mainSets,
            reps: youth ? "6-8" : "4-6",
            restSec: phase === "intensificacion" ? 150 : 120,
            intensityGuide: intensityHint(phase),
            rationale: "Patron dominante de rodilla para transferir a aceleracion, frenado y duelos.",
          },
          {
            name: "Peso muerto rumano",
            sets: mainSets,
            reps: youth ? "6-8" : "5-6",
            restSec: phase === "intensificacion" ? 150 : 120,
            intensityGuide: intensityHint(phase),
            rationale: "Fortalece cadena posterior y reduce riesgo de lesiones de isquios.",
          },
        ],
      },
      {
        title: "Transferencia y estabilidad",
        objective: `Trasladar la fuerza al gesto especifico de ${sport || "competicion"}.`,
        rationale: "Se complementa con estabilidad lumbopelvica y trabajo unilateral para mejorar control motor bajo fatiga.",
        exercises: [
          {
            name: "Zancada unilateral con pausa",
            sets: accessorySets,
            reps: "8-10 por pierna",
            restSec: 75,
            intensityGuide: "RPE 6-7",
            rationale: "Mejora control en apoyos y asimetrias funcionales.",
          },
          {
            name: "Core antirotacional (pallof)",
            sets: accessorySets,
            reps: "10-12 por lado",
            restSec: 45,
            intensityGuide: "Control tecnico",
            rationale: "Aumenta estabilidad para transferencia de fuerza en cambios de direccion.",
          },
        ],
      },
    ];
  }

  if (capability === "velocidad" || capability === "potencia" || capability === "agilidad") {
    return [
      {
        title: "Bloque neuromuscular",
        objective: "Mejorar aceleracion, cambios de ritmo y velocidad de ejecucion.",
        rationale: "Se prioriza calidad, pausas completas y baja densidad para sostener velocidad real.",
        exercises: [
          {
            name: "Sprints 10-30 m",
            sets: clamp(Math.round((youth ? 5 : 6) * factor), 4, 8),
            reps: "1 por serie",
            restSec: 120,
            intensityGuide: "95-100% velocidad maxima",
            rationale: "Desarrolla capacidad de aceleracion y mecanica de carrera.",
          },
          {
            name: "Saltos reactivos o lanzamientos",
            sets: accessorySets,
            reps: "3-5",
            restSec: 90,
            intensityGuide: "maxima intencion",
            rationale: "Potencia tasa de desarrollo de fuerza y reactividad tendinosa.",
          },
        ],
      },
      {
        title: "Transferencia tecnica",
        objective: `Aplicar velocidad a situaciones de ${sport || "juego"}.`,
        rationale: "El bloque contextualiza la capacidad condicional en tareas especificas del deporte.",
        exercises: [
          {
            name: "Drills de cambio de direccion y toma de decision",
            sets: accessorySets,
            reps: "4-6 repeticiones cortas",
            restSec: 75,
            intensityGuide: "alta precision",
            rationale: "Integra percepcion, decision y accion bajo demanda de velocidad.",
          },
        ],
      },
    ];
  }

  return [
    {
      title: "Bloque metabolico principal",
      objective: "Mejorar resistencia especifica sin perder calidad tecnica.",
      rationale: "Se usa trabajo intervalado para elevar capacidad aerobica y tolerancia a esfuerzos repetidos.",
      exercises: [
        {
          name: "Intervalos de alta intensidad",
          sets: clamp(Math.round((youth ? 5 : 6) * factor), 4, 7),
          reps: "2-3 min",
          restSec: 90,
          intensityGuide: phase === "descarga" ? "RPE 6" : "RPE 7-8",
          rationale: "Mejora VO2 y recuperacion entre esfuerzos de juego.",
        },
        {
          name: "Trabajo extensivo tecnico",
          sets: clamp(Math.round((youth ? 3 : 4) * factor), 2, 5),
          reps: "4-6 min",
          restSec: 60,
          intensityGuide: "RPE 6-7",
          rationale: "Sostiene volumen util con control de carga interna.",
        },
      ],
    },
  ];
}

function buildSession(
  weekNumber: number,
  sessionIndex: number,
  dayLabel: string,
  request: TrainingPlanRequest,
  phase: "acumulacion" | "intensificacion" | "descarga" | "competitiva",
  band: "u14" | "u18" | "adult"
): PlanSession {
  const capabilities: CapabilityKey[] =
    request.capabilities.length > 0 ? request.capabilities : ["fuerza", "resistencia"];
  const focus = capabilities[(weekNumber + sessionIndex) % capabilities.length];
  const blocks = templateForCapability(focus, phase, band, request.sport);
  const warmUp: PlanBlock = {
    title: "Calentamiento integrado",
    objective: "Preparar sistema neuromuscular, movilidad y patron tecnico.",
    rationale: "Un calentamiento bien dosificado mejora rendimiento y reduce riesgo de lesion.",
    exercises: [
      {
        name: "Movilidad dinamica y activacion",
        sets: 2,
        reps: "5-6 min",
        restSec: 30,
        intensityGuide: "baja a moderada",
        rationale: "Aumenta temperatura muscular y calidad de movimiento.",
      },
    ],
  };

  const coolDown: PlanBlock = {
    title: "Vuelta a la calma",
    objective: "Acelerar recuperacion y consolidar aprendizaje tecnico.",
    rationale: "La transicion final disminuye carga simpatica y facilita la recuperacion para la siguiente sesion.",
    exercises: [
      {
        name: "Respiracion + movilidad final",
        sets: 1,
        reps: "6-8 min",
        restSec: 0,
        intensityGuide: "muy baja",
        rationale: "Reduce rigidez y mejora percepcion de recuperacion.",
      },
    ],
  };

  return {
    id: `w${weekNumber}-s${sessionIndex + 1}`,
    dayLabel,
    focus,
    objective: `Prioridad en ${capabilityLabel(focus)} con transferencia al objetivo principal.`,
    rationale: `Sesion orientada a ${capabilityLabel(focus)} con control de carga segun fase ${phase}.`,
    durationMin: clamp(Math.round(request.sessionDurationMin), 35, 150),
    blocks: [warmUp, ...blocks, coolDown],
  };
}

function buildWeekRationale(phase: "acumulacion" | "intensificacion" | "descarga" | "competitiva", hasMatch: boolean, objectives: string[]): string {
  const objectiveText = objectives.length > 0 ? objectives.join(", ") : "objetivos generales";
  if (phase === "competitiva") {
    return `Semana con partido: se reduce volumen para llegar con frescura y se mantiene intensidad para sostener rendimiento. Objetivos activos: ${objectiveText}.`;
  }
  if (phase === "descarga") {
    return `Semana de descarga para consolidar adaptaciones, bajar fatiga acumulada y sostener tecnica. Objetivos activos: ${objectiveText}.`;
  }
  if (phase === "intensificacion") {
    return `Semana de intensificacion: menor volumen relativo y mayor exigencia especifica para elevar rendimiento.`;
  }
  return `Semana de acumulacion: se construye base de trabajo y tolerancia para progresar sin saltos bruscos.`;
}

function buildProgressionSummary(plan: GeneratedTrainingPlan): string[] {
  const competitiveWeeks = plan.weeks.filter((week) => week.hasMatch).length;
  const avgLoad =
    plan.weeks.length > 0
      ? Math.round(plan.weeks.reduce((acc, week) => acc + week.loadIndex, 0) / plan.weeks.length)
      : 0;

  return [
    `Carga media del bloque: ${avgLoad}/100 con ajustes semanales por fase.`,
    `Semanas con partido detectadas: ${competitiveWeeks}.`,
    `Periodizacion en microciclos de 4 semanas (3 de trabajo + 1 de descarga, salvo competencia).`,
  ];
}

function buildScientificBasis(): string[] {
  return [
    "Principio de sobrecarga progresiva con control de fatiga por microciclos.",
    "Distribucion de volumen e intensidad segun fase para evitar estancamiento.",
    "Especificidad: bloques de transferencia ligados al deporte y contexto competitivo.",
    "Individualizacion por edad y nivel para ajustar dosis de trabajo realistas.",
  ];
}

export function generateTrainingPlan(request: TrainingPlanRequest): GeneratedTrainingPlan {
  const safeWeeks = clamp(Math.round(request.weeks), 1, 52);
  const safeSessionsPerWeek = clamp(Math.round(request.sessionsPerWeek), 1, 6);
  const safeDuration = clamp(Math.round(request.sessionDurationMin), 35, 150);
  const normalizedEvents = normalizeEvents(request.events || []);
  const band = ageBand(request.ageMin, request.ageMax);

  const startDate = toDate(request.startDate) || new Date();
  const alignedStart = startOfWeek(startDate);

  let previousWeeks: PlanWeek[] = [];
  let initialDate = alignedStart;
  let version = 1;

  if (request.mode === "extend" && request.existingPlan) {
    previousWeeks = Array.isArray(request.existingPlan.weeks) ? request.existingPlan.weeks : [];
    version = Math.max(1, Number(request.existingPlan.version || 1)) + 1;
    if (previousWeeks.length > 0) {
      const lastWeek = previousWeeks[previousWeeks.length - 1];
      const lastEnd = toDate(lastWeek.endDate);
      if (lastEnd) {
        initialDate = startOfWeek(addDays(lastEnd, 1));
      }
    }
  }

  const weekDaySelection = pickDays(safeSessionsPerWeek);
  const hashSeed = stableHash(
    `${request.targetName}|${request.sport}|${request.category}|${request.objectives.join("|")}`
  );

  const generatedWeeks: PlanWeek[] = [];
  for (let index = 0; index < safeWeeks; index += 1) {
    const absoluteWeekNumber = previousWeeks.length + index + 1;
    const weekStart = addDays(initialDate, index * 7);
    const weekEnd = addDays(weekStart, 6);

    const weekEvents = normalizedEvents.filter((event) => {
      const eventDate = toDate(event.date);
      return eventDate ? isDateInWeek(eventDate, weekStart, weekEnd) : false;
    });
    const hasMatch = weekEvents.some((event) => event.kind === "partido");
    const phase = phaseForWeek(absoluteWeekNumber, hasMatch);

    const progressive = Math.floor((absoluteWeekNumber - 1) / 4) * 2;
    const loadIndex = clamp(
      baseLoad(request.level, band) + loadDeltaByPhase(phase) + progressive + (hashSeed % 3),
      40,
      92
    );

    const sessions: PlanSession[] = weekDaySelection.map((dayLabel, sessionIndex) =>
      buildSession(
        absoluteWeekNumber,
        sessionIndex,
        dayLabel,
        {
          ...request,
          sessionsPerWeek: safeSessionsPerWeek,
          sessionDurationMin: safeDuration,
        },
        phase,
        band
      )
    );

    generatedWeeks.push({
      weekNumber: absoluteWeekNumber,
      startDate: toIsoDate(weekStart),
      endDate: toIsoDate(weekEnd),
      phase,
      loadIndex,
      hasMatch,
      events: weekEvents,
      rationale: buildWeekRationale(phase, hasMatch, request.objectives),
      sessions,
    });
  }

  const mergedWeeks = [...previousWeeks, ...generatedWeeks];
  const now = new Date().toISOString();

  const basePlan: GeneratedTrainingPlan = {
    id: request.existingPlan?.id || `plan-${Date.now()}`,
    version,
    createdAt: request.existingPlan?.createdAt || now,
    updatedAt: now,
    targetType: request.targetType,
    targetName: request.targetName,
    sport: request.sport,
    category: request.category,
    level: request.level,
    ageMin: request.ageMin,
    ageMax: request.ageMax,
    objectives: request.objectives,
    capabilities: request.capabilities,
    constraints: request.constraints,
    sessionDurationMin: safeDuration,
    sessionsPerWeek: safeSessionsPerWeek,
    startDate: request.existingPlan?.startDate || toIsoDate(alignedStart),
    totalWeeks: mergedWeeks.length,
    notes: request.notes || request.existingPlan?.notes,
    scientificBasis: buildScientificBasis(),
    progressionSummary: [],
    weeks: mergedWeeks,
  };

  return {
    ...basePlan,
    progressionSummary: buildProgressionSummary(basePlan),
  };
}
