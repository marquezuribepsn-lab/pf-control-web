"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import PlantelPanel from "@/components/PlantelPanel";
import DateInput from "@/components/DateInput";
import RutinaPrintOverlay, { RutinaPrintMode } from "@/components/RutinaPrintOverlay";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAlumnos } from "../../components/AlumnosProvider";
import { useCategories } from "../../components/CategoriesProvider";
import { useDeportes } from "../../components/DeportesProvider";
import { useEjercicios } from "../../components/EjerciciosProvider";
import { usePlayers } from "../../components/PlayersProvider";
import { useSessions } from "../../components/SessionsProvider";
import { markManualSaveIntent, useSharedState } from "../../components/useSharedState";
import { argentineFoodsBase } from "../../data/argentineFoods";
import { EtiquetasChips, Etiqueta } from "../../components/EtiquetasChips";
import { calcNutritionTargets } from "../../lib/nutritionPlanAI";

type ClienteTipo = "jugadora" | "alumno";
type ClienteEstado = "activo" | "finalizado";
type ClienteTab =
  | "datos"
  | "cuestionario"
  | "plan-entrenamiento"
  | "plan-nutricional"
  | "recetas"
  | "notas"
  | "documentos"
  | "chequeos"
  | "progreso";

type PlanViewTab = "plan-entrenamiento" | "plan-nutricional";

type ClienteView = {
  id: string;
  tipo: ClienteTipo;
  nombre: string;
  estado: ClienteEstado;
  practicaDeporte: boolean;
  deporte?: string;
  categoria?: string;
  posicion?: string;
  fechaNacimiento?: string;
  altura?: string;
  peso?: string;
  club?: string;
  objetivo?: string;
  observaciones?: string;
  wellness?: number;
  carga?: number;
};

type ClientesSection = "clientes" | "plantel";

type ClienteForm = {
  nombre: string;
  practicaDeporte: "si" | "no";
  estado: ClienteEstado;
  fechaNacimiento: string;
  altura: string;
  peso: string;
  deporte: string;
  categoria: string;
  posicion: string;
  club: string;
  objetivo: string;
  observaciones: string;
};

type ClienteMeta = {
  apellido: string;
  segundoApellido: string;
  email: string;
  codigoPais: string;
  telefono: string;
  pais: string;
  provincia: string;
  calle: string;
  numero: string;
  piso: string;
  depto: string;
  sexo: "masculino" | "femenino";
  startDate: string;
  endDate: string;
  lastCheck: string;
  nextCheck: string;
  objNutricional: string;
  colaboradores: string;
  chats: string;
  tipoAsesoria: "entrenamiento" | "nutricion" | "completa";
  modalidad: "virtual" | "presencial";
  categoriaPlan: string;
  pagoEstado: "confirmado" | "pendiente";
  moneda: string;
  importe: string;
  saldo: string;
  emailPagador: string;
  autoRenewPlan: boolean;
  renewalDays: number;
  tabNotas: Partial<Record<ClienteTab, string>>;
};

type SignupAnamnesisLite = {
  compromisoObjetivo?: number | null;
  consentimientoSalud?: string;
};

type SignupProfileLite = {
  nombre?: string;
  apellido?: string;
  nombreCompleto?: string;
  telefono?: string;
  fechaNacimiento?: string;
  objetivo?: string;
  anamnesis?: SignupAnamnesisLite;
};

type PendingIngresante = {
  id: string;
  email: string;
  role: 'ADMIN' | 'COLABORADOR' | 'CLIENTE';
  estado?: string;
  emailVerified?: boolean;
  nombreCompleto?: string;
  telefono?: string;
  fechaNacimiento?: string;
  signupProfile?: SignupProfileLite | null;
};

type DatosDraft = {
  nombre: string;
  fechaNacimiento: string;
  altura: string;
  peso: string;
  club: string;
  objetivo: string;
  observaciones: string;
  deporte: string;
  categoria: string;
  posicion: string;
};

type PagoRegistro = {
  id: string;
  clientId: string;
  clientName: string;
  fecha: string;
  importe: number;
  moneda: string;
  createdAt: string;
};

type NutritionGoal = "mantenimiento" | "recomposicion" | "masa" | "deficit";

type NutritionTargets = {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
};

type NutritionPlan = {
  id: string;
  nombre: string;
  alumnoAsignado: string | null;
  objetivo: NutritionGoal;
  notas: string;
  targets: NutritionTargets;
  comidas: Array<{
    id: string;
    nombre: string;
    items: Array<{
      id: string;
      foodId: string;
      gramos: number;
    }>;
  }>;
  updatedAt: string;
  // Perfil completo para compatibilidad con módulo de Nutrición
  perfil?: {
    sexo: "masculino" | "femenino";
    pesoKg: number;
    alturaCm: number;
    edad: number;
    actividad: string;
    comidasDia: number;
    diasEntrenamiento: number;
    restricciones?: string;
    condicionesMedicas?: string;
  };
};

type NutritionWizardData = {
  step: 1 | 2 | 3;
  // Datos físicos del alumno (pre-cargados, editables)
  pesoKg: string;
  alturaCm: string;
  edad: string;
  sexo: "masculino" | "femenino";
  // Parámetros del plan
  objetivo: NutritionGoal;
  diasEntrenamiento: string;
  comidasDia: string;
  horarioEntrenamiento: string;
  restricciones: string;
  condicionesMedicas: string;
  // Para modo adapt (asignar plan existente)
  basePlanId?: string;
};

type NutritionPlanStatus = {
  hasPlan: boolean;
  planName: string;
  updatedAt: string;
};

type AlumnoNutritionAssignment = {
  alumnoNombre: string;
  alumnoEmail?: string;
  planId: string;
  assignedAt: string;
};

type NutritionFood = {
  id: string;
  nombre: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

type PersonaTipoPlan = "jugadoras" | "alumnos";

type WeekExerciseLite = {
  id: string;
  ejercicioId: string;
  series: string;
  repeticiones: string;
  descanso: string;
  carga: string;
  observaciones?: string;
  metricas?: Array<{
    nombre?: string;
    valor?: string;
  }>;
  superSerie: Array<{
    id: string;
    ejercicioId: string;
    series: string;
    repeticiones: string;
    descanso: string;
    carga: string;
  }>;
};

type WeekBlockLite = {
  id: string;
  titulo: string;
  objetivo: string;
  ejercicios: WeekExerciseLite[];
};

type WeekDayTrainingLite = {
  bloques: WeekBlockLite[];
};

type PostSessionFeedbackOptionLite = {
  id: string;
  label: string;
};

type PostSessionFeedbackQuestionLite = {
  id: string;
  prompt: string;
  options: PostSessionFeedbackOptionLite[];
};

type PostSessionMeasurementId =
  | "rpe"
  | "fatiga"
  | "sensacion"
  | "congestion"
  | "rendimiento"
  | "cumplimiento"
  | "observaciones"
  | "duracion";

type PostSessionMeasurementLite = {
  id: PostSessionMeasurementId;
  visible: boolean;
  obligatoria: boolean;
};

type PostSessionFeedbackConfigLite = {
  enabled: boolean;
  title?: string;
  questions: PostSessionFeedbackQuestionLite[];
  measurements?: PostSessionMeasurementLite[];
  maxPerDay?: number;
};

const POST_SESSION_MEASUREMENT_CATALOG: Array<{
  id: PostSessionMeasurementId;
  nombre: string;
  descripcion: string;
}> = [
  {
    id: "rpe",
    nombre: "RPE final",
    descripcion:
      "Esfuerzo percibido por el cliente al finalizar la sesión. Se mide en una escala del 1 al 10: 1 = Muy fácil, 10 = Máximo esfuerzo. Útil para ajustar cargas y detectar sobreesfuerzo.",
  },
  {
    id: "fatiga",
    nombre: "Fatiga percibida",
    descripcion:
      "Nivel de fatiga general al terminar la sesión, también en escala del 1 al 10. 1 = Sin fatiga, 10 = Totalmente agotado. Sirve para identificar acumulación de cansancio.",
  },
  {
    id: "sensacion",
    nombre: "Sensación general",
    descripcion:
      "Describe cómo se sintió el cliente emocional y físicamente al terminar. Opciones: Motivado, Satisfecho, Cansado, Frustrado, Desmotivado, Dolorido, etc. Ayuda a detectar desmotivación o signos de sobreentrenamiento.",
  },
  {
    id: "congestion",
    nombre: "Congestión muscular",
    descripcion:
      "Sensación de hinchazón muscular (\"pump\") post entrenamiento. Se mide del 0 al 10, siendo 0 nada de congestión y 10 congestión máxima. Comúnmente usado en planes de hipertrofia.",
  },
  {
    id: "rendimiento",
    nombre: "Rendimiento percibido",
    descripcion:
      "Comparación subjetiva con sesiones anteriores similares. Opciones: Mejor, Igual, Peor. Permite detectar estancamientos o mejoras de rendimiento.",
  },
  {
    id: "cumplimiento",
    nombre: "Cumplimiento de objetivo",
    descripcion:
      "Evalúa si el cliente siente que logró el objetivo del día. Opciones: Cumplido, Parcial, No cumplido. Puede usarse para ajustar la planificación.",
  },
  {
    id: "observaciones",
    nombre: "Observaciones",
    descripcion:
      "Espacio libre para que el cliente deje comentarios sobre la sesión. Ej: molestias, puntos destacados, ejercicios que no pudo hacer.",
  },
  {
    id: "duracion",
    nombre: "Duración (minutos)",
    descripcion:
      "Duración total de la sesión medida en minutos. Permite cruzar con la carga percibida y detectar sesiones muy cortas o extensas.",
  },
];

type WeekDayPlanLite = {
  id: string;
  dia: string;
  planificacion: string;
  objetivo: string;
  sesionId: string;
  oculto?: boolean;
  entrenamiento?: WeekDayTrainingLite;
  postSesionFeedback?: PostSessionFeedbackConfigLite;
};

type WeekPlanLite = {
  id: string;
  nombre: string;
  objetivo: string;
  oculto?: boolean;
  dias: WeekDayPlanLite[];
};

type WeekPersonPlanLite = {
  ownerKey: string;
  tipo: PersonaTipoPlan;
  nombre: string;
  categoria?: string;
  semanas: WeekPlanLite[];
};

type WeekPlanTemplate = {
  id: string;
  nombre: string;
  tipo: PersonaTipoPlan;
  categoria?: string;
  semanas: WeekPlanLite[];
};

type StoredAITrainingPlanLite = {
  id: string;
  nombre: string;
  createdAt: string;
  updatedAt: string;
  plan: {
    sport?: string;
    category?: string;
    level?: string;
    totalWeeks?: number;
    sessionsPerWeek?: number;
    sessionDurationMin?: number;
    weeks: Array<{
      weekNumber: number;
      focus?: string;
      rationale?: string;
      sessions: Array<{
        id: string;
        title: string;
        goal: string;
        date: string;
        sessionNumber: number;
        blocks: unknown[];
      }>;
    }>;
  };
};

type WeekStoreLite = {
  version: number;
  planes: WeekPersonPlanLite[];
  templates: WeekPlanTemplate[];
};

type WorkoutLogRecord = {
  id: string;
  alumnoNombre: string;
  alumnoEmail?: string;
  sessionId: string;
  sessionTitle: string;
  weekId?: string;
  weekName?: string;
  dayId?: string;
  dayName?: string;
  blockId?: string;
  blockTitle?: string;
  exerciseId?: string;
  exerciseName?: string;
  exerciseKey?: string;
  fecha: string;
  series: number;
  repeticiones: number;
  pesoKg: number;
  molestia: boolean;
  videoUrl?: string;
  videoDataUrl?: string;
  videoFileName?: string;
  comentarios?: string;
  createdAt: string;
};

type TrainingExercisePanelMode = "configuracion" | "ver-pesos" | "registrar-peso";

type TrainingExercisePanelTarget = {
  weekId: string;
  weekName: string;
  dayId: string;
  dayName: string;
  blockId: string;
  blockTitle: string;
  exerciseId: string;
  exerciseName: string;
  sessionId: string;
  sessionTitle: string;
  currentSeries: string;
  currentRepeticiones: string;
  currentCarga: string;
};

type TrainingRecordDraft = {
  fecha: string;
  series: string;
  repeticiones: string;
  pesoKg: string;
  molestia: boolean;
  comentarios: string;
};

type TrainingStructureMenuState =
  | {
      type: "week";
      weekId: string;
    }
  | {
      type: "day";
      weekId: string;
      dayId: string;
    }
  | null;

type TrainingBlockMenuState = {
  weekId: string;
  dayId: string;
  blockId: string;
} | null;

type PresenceSnapshot = {
  userId: string | null;
  email: string | null;
  name: string | null;
  state: "online" | "offline";
  isOnline: boolean;
  lastHeartbeatAt: string | null;
  lastSeenAt: string | null;
  lastOnlineAt: string | null;
  lastOfflineAt: string | null;
};

type VisibleClientColumn = "etiquetas" | "vencimiento" | "ultimo-pago";

type ClientTableColumnKey =
  | "cliente"
  | "tipo"
  | "categoria"
  | "plan"
  | "acciones"
  | VisibleClientColumn;

const INITIAL_FORM: ClienteForm = {
  nombre: "",
  practicaDeporte: "si",
  estado: "activo",
  fechaNacimiento: "",
  altura: "",
  peso: "",
  deporte: "Fútbol",
  categoria: "",
  posicion: "",
  club: "",
  objetivo: "",
  observaciones: "",
};

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const PAGOS_KEY = "pf-control-pagos-v1";
const CLIENT_TABLE_UI_KEY_PREFIX = "pf-control-clientes-table-ui-v1";
const NUTRITION_PLANS_KEY = "pf-control-nutricion-planes-v1";
const NUTRITION_ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
const NUTRITION_CUSTOM_FOODS_KEY = "pf-control-nutricion-alimentos-v1";
const WEEK_PLAN_KEY = "pf-control-semana-plan";
const AI_TRAINING_PLANS_KEY = "pf-control-ai-training-plans-v1";
const WORKOUT_LOGS_KEY = "pf-control-alumno-workout-logs-v1";
const PRESENCE_REFRESH_MS = 30_000;
const TRAINING_WEEK_DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];
const TRAINING_STRUCTURE_ACTION_COOLDOWN_MS = 320;

const createTrainingEntityId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;


function normalizePostSessionFeedbackConfig(rawValue: unknown): PostSessionFeedbackConfigLite | undefined {
  if (!rawValue || typeof rawValue !== "object") {
    return undefined;
  }

  const row = rawValue as Record<string, unknown>;
  const rawQuestions = Array.isArray(row.questions) ? row.questions : [];

  const questions: PostSessionFeedbackQuestionLite[] = rawQuestions
    .filter((question) => question && typeof question === "object")
    .map((question, questionIndex) => {
      const questionRow = question as Record<string, unknown>;
      const rawOptions = Array.isArray(questionRow.options) ? questionRow.options : [];

      const options: PostSessionFeedbackOptionLite[] = rawOptions
        .filter((option) => option && typeof option === "object")
        .map((option, optionIndex) => {
          const optionRow = option as Record<string, unknown>;

          return {
            id:
              String(optionRow.id || "").trim() ||
              createTrainingEntityId(`feedback-option-${questionIndex + 1}-${optionIndex + 1}`),
            label: String(optionRow.label || optionRow.opcion || "").trim(),
          };
        })
        .filter((option) => Boolean(option.label));

      if (options.length < 2) {
        return {
          id: String(questionRow.id || "").trim() || createTrainingEntityId("feedback-question"),
          prompt: String(questionRow.prompt || questionRow.pregunta || "").trim(),
          options: [
            { id: createTrainingEntityId("feedback-option"), label: "Excelente" },
            { id: createTrainingEntityId("feedback-option"), label: "Necesito ayuda" },
          ],
        };
      }

      return {
        id: String(questionRow.id || "").trim() || createTrainingEntityId("feedback-question"),
        prompt:
          String(questionRow.prompt || questionRow.pregunta || "").trim() ||
          `Pregunta ${questionIndex + 1}`,
        options,
      };
    })
    .filter((question) => question.options.length >= 2);

  const title = String(row.title || "").trim() || undefined;
  const enabled = row.enabled === true;

  const rawMeasurements = Array.isArray(row.measurements) ? row.measurements : [];
  const validIds = new Set(POST_SESSION_MEASUREMENT_CATALOG.map((entry) => entry.id));
  const measurements: PostSessionMeasurementLite[] = rawMeasurements
    .filter((measurement) => measurement && typeof measurement === "object")
    .map((measurement) => {
      const measurementRow = measurement as Record<string, unknown>;
      const id = String(measurementRow.id || "").trim() as PostSessionMeasurementId;
      return {
        id,
        visible: measurementRow.visible === true,
        obligatoria: measurementRow.obligatoria === true,
      };
    })
    .filter((measurement) => validIds.has(measurement.id));

  const rawMaxPerDay = Number(row.maxPerDay);
  const maxPerDay = Number.isFinite(rawMaxPerDay) && rawMaxPerDay > 0 ? Math.floor(rawMaxPerDay) : undefined;

  if (!enabled && questions.length === 0 && !title && measurements.length === 0 && !maxPerDay) {
    return undefined;
  }

  return {
    enabled,
    title,
    questions,
    measurements: measurements.length > 0 ? measurements : undefined,
    maxPerDay,
  };
}

function sanitizePostSessionFeedbackConfig(
  config: PostSessionFeedbackConfigLite | null | undefined
): PostSessionFeedbackConfigLite | undefined {
  if (!config) {
    return undefined;
  }

  return normalizePostSessionFeedbackConfig(config);
}

function createDefaultPostSessionFeedbackQuestion(questionIndex: number): PostSessionFeedbackQuestionLite {
  return {
    id: createTrainingEntityId("feedback-question"),
    prompt: `Pregunta ${questionIndex + 1}`,
    options: [
      { id: createTrainingEntityId("feedback-option"), label: "Excelente" },
      { id: createTrainingEntityId("feedback-option"), label: "Bien" },
      { id: createTrainingEntityId("feedback-option"), label: "Necesito ayuda" },
    ],
  };
}

function createDefaultPostSessionFeedbackConfig(): PostSessionFeedbackConfigLite {
  return {
    enabled: true,
    title: "Feedback post sesion",
    questions: [createDefaultPostSessionFeedbackQuestion(0)],
  };
}

const INITIAL_TRAINING_RECORD_DRAFT: TrainingRecordDraft = {
  fecha: new Date().toISOString().slice(0, 10),
  series: "1",
  repeticiones: "",
  pesoKg: "",
  molestia: false,
  comentarios: "",
};

const DEFAULT_COLUMN_WIDTHS: Record<ClientTableColumnKey, number> = {
  cliente: 300,
  tipo: 140,
  categoria: 190,
  plan: 180,
  etiquetas: 260,
  vencimiento: 170,
  "ultimo-pago": 190,
  acciones: 260,
};

type ClientTableUiPrefs = {
  visibleExtraColumns: VisibleClientColumn[];
  rowHeight: number;
  columnWidths: Record<ClientTableColumnKey, number>;
  planFilter: PlanFilterType;
};

type PlanFilterType =
  | "todos"
  | "con-plan"
  | "sin-plan"
  | "con-plan-entrenamiento"
  | "con-plan-nutricional"
  | "sin-plan-nutricional";

const DEFAULT_CLIENT_TABLE_UI_PREFS: ClientTableUiPrefs = {
  visibleExtraColumns: ["etiquetas"],
  rowHeight: 96,
  columnWidths: DEFAULT_COLUMN_WIDTHS,
  planFilter: "todos",
};

function sanitizeClientTableUiPrefs(raw: ClientTableUiPrefs): ClientTableUiPrefs {
  const allExtraColumns: VisibleClientColumn[] = ["etiquetas", "vencimiento", "ultimo-pago"];
  const allPlanFilters: PlanFilterType[] = [
    "todos",
    "con-plan",
    "sin-plan",
    "con-plan-entrenamiento",
    "con-plan-nutricional",
    "sin-plan-nutricional",
  ];
  const visibleExtraColumns = Array.isArray(raw.visibleExtraColumns)
    ? allExtraColumns.filter((column) => raw.visibleExtraColumns.includes(column))
    : DEFAULT_CLIENT_TABLE_UI_PREFS.visibleExtraColumns;

  const rowHeight = Number.isFinite(Number(raw.rowHeight))
    ? Math.max(72, Math.min(120, Number(raw.rowHeight)))
    : DEFAULT_CLIENT_TABLE_UI_PREFS.rowHeight;

  const columnWidths = (Object.keys(DEFAULT_COLUMN_WIDTHS) as ClientTableColumnKey[]).reduce(
    (acc, key) => {
      const value = Number(raw.columnWidths?.[key]);
      acc[key] = Number.isFinite(value) ? Math.max(90, Math.min(1100, value)) : DEFAULT_COLUMN_WIDTHS[key];
      return acc;
    },
    {} as Record<ClientTableColumnKey, number>
  );

  const planFilter = allPlanFilters.includes(raw.planFilter)
    ? raw.planFilter
    : DEFAULT_CLIENT_TABLE_UI_PREFS.planFilter;

  return {
    visibleExtraColumns,
    rowHeight,
    columnWidths,
    planFilter,
  };
}

function nutritionGoalLabel(goal: NutritionGoal): string {
  switch (goal) {
    case "mantenimiento":
      return "Mantenimiento";
    case "recomposicion":
      return "Recomposicion";
    case "masa":
      return "Masa muscular";
    case "deficit":
      return "Deficit";
    default:
      return goal;
  }
}

function normalizePersonKey(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyMatch(a: string, b: string): boolean {
  const left = normalizePersonKey(a);
  const right = normalizePersonKey(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  const shared = leftTokens.filter((token) => rightTokens.includes(token));

  // Considera match cuando comparte al menos 2 tokens, o 1 token largo.
  return shared.length >= 2 || shared.some((token) => token.length >= 5);
}

function toPlanPersonaTipo(tipo: ClienteTipo): PersonaTipoPlan {
  return tipo === "jugadora" ? "jugadoras" : "alumnos";
}

function buildTrainingOwnerKey(tipo: PersonaTipoPlan, nombre: string): string {
  return `${tipo}:${String(nombre || "").trim().toLowerCase()}`;
}

function normalizeWeekStore(rawValue: unknown): WeekStoreLite {
  const source = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
  const rawPlanes = Array.isArray(source.planes) ? source.planes : [];

  const planes: WeekPersonPlanLite[] = rawPlanes
    .filter((row) => row && typeof row === "object")
    .map((row, rowIndex) => {
      const item = row as Record<string, unknown>;
      const tipo: PersonaTipoPlan = item.tipo === "jugadoras" ? "jugadoras" : "alumnos";
      const nombre = String(item.nombre || `Plan ${rowIndex + 1}`).trim() || `Plan ${rowIndex + 1}`;
      const ownerKey =
        String(item.ownerKey || buildTrainingOwnerKey(tipo, nombre)).trim().toLowerCase() ||
        buildTrainingOwnerKey(tipo, nombre);
      const semanasRaw = Array.isArray(item.semanas) ? item.semanas : [];

      const semanas: WeekPlanLite[] = semanasRaw
        .filter((week) => week && typeof week === "object")
        .map((week, weekIndex) => {
          const weekRow = week as Record<string, unknown>;
          const diasRaw = Array.isArray(weekRow.dias) ? weekRow.dias : [];

          const dias: WeekDayPlanLite[] = diasRaw
            .filter((day) => day && typeof day === "object")
            .map((day, dayIndex) => {
              const dayRow = day as Record<string, unknown>;
              const entrenamientoRaw =
                dayRow.entrenamiento && typeof dayRow.entrenamiento === "object"
                  ? (dayRow.entrenamiento as Record<string, unknown>)
                  : null;
              const postSesionFeedback = normalizePostSessionFeedbackConfig(dayRow.postSesionFeedback);
              const bloquesRaw = Array.isArray(entrenamientoRaw?.bloques) ? entrenamientoRaw?.bloques : [];

              const bloques: WeekBlockLite[] = bloquesRaw
                .filter((block) => block && typeof block === "object")
                .map((block, blockIndex) => {
                  const blockRow = block as Record<string, unknown>;
                  const ejerciciosRaw = Array.isArray(blockRow.ejercicios) ? blockRow.ejercicios : [];

                  const ejercicios: WeekExerciseLite[] = ejerciciosRaw
                    .filter((exercise) => exercise && typeof exercise === "object")
                    .map((exercise, exerciseIndex) => {
                      const exerciseRow = exercise as Record<string, unknown>;
                      const superSerieRaw = Array.isArray(exerciseRow.superSerie) ? exerciseRow.superSerie : [];
                      const metricasRaw = Array.isArray(exerciseRow.metricas) ? exerciseRow.metricas : [];

                      return {
                        id: String(exerciseRow.id || `exercise-${exerciseIndex}`),
                        ejercicioId: String(exerciseRow.ejercicioId || ""),
                        series: String(exerciseRow.series || ""),
                        repeticiones: String(exerciseRow.repeticiones || ""),
                        descanso: String(exerciseRow.descanso || ""),
                        carga: String(exerciseRow.carga || ""),
                        observaciones: String(exerciseRow.observaciones || "").trim() || undefined,
                        metricas:
                          metricasRaw.length > 0
                            ? metricasRaw
                                .filter((metric) => metric && typeof metric === "object")
                                .map((metric) => {
                                  const metricRow = metric as Record<string, unknown>;
                                  return {
                                    nombre: String(metricRow.nombre || ""),
                                    valor: String(metricRow.valor || ""),
                                  };
                                })
                            : undefined,
                        superSerie: superSerieRaw
                          .filter((superItem) => superItem && typeof superItem === "object")
                          .map((superItem, superIndex) => {
                            const superRow = superItem as Record<string, unknown>;
                            return {
                              id: String(superRow.id || `super-${superIndex}`),
                              ejercicioId: String(superRow.ejercicioId || ""),
                              series: String(superRow.series || ""),
                              repeticiones: String(superRow.repeticiones || ""),
                              descanso: String(superRow.descanso || ""),
                              carga: String(superRow.carga || ""),
                            };
                          }),
                      };
                    });

                  // Empty strings are valid edit states; only fall back when the
                  // field is genuinely missing (undefined/null).
                  const blockTituloMissing =
                    blockRow.titulo === undefined || blockRow.titulo === null;
                  const blockObjetivoMissing =
                    blockRow.objetivo === undefined || blockRow.objetivo === null;

                  return {
                    id: String(blockRow.id || `block-${blockIndex}`),
                    titulo: blockTituloMissing ? `Bloque ${blockIndex + 1}` : String(blockRow.titulo),
                    objetivo: blockObjetivoMissing ? "" : String(blockRow.objetivo),
                    ejercicios,
                  };
                });

              const dayDiaMissing = dayRow.dia === undefined || dayRow.dia === null;
              const dayPlanificacionMissing =
                dayRow.planificacion === undefined || dayRow.planificacion === null;
              const dayObjetivoMissing =
                dayRow.objetivo === undefined || dayRow.objetivo === null;

              return {
                id: String(dayRow.id || `day-${dayIndex}`),
                dia: dayDiaMissing ? `Dia ${dayIndex + 1}` : String(dayRow.dia),
                planificacion: dayPlanificacionMissing ? "" : String(dayRow.planificacion),
                objetivo: dayObjetivoMissing ? "" : String(dayRow.objetivo),
                sesionId: String(dayRow.sesionId || ""),
                oculto: dayRow.oculto === true ? true : undefined,
                entrenamiento: entrenamientoRaw
                  ? {
                      bloques,
                    }
                  : undefined,
                postSesionFeedback,
              };
            });

          return {
            id: String(weekRow.id || `week-${weekIndex}`),
            nombre: String(weekRow.nombre || `Semana ${weekIndex + 1}`),
            objetivo: String(weekRow.objetivo || ""),
            oculto: weekRow.oculto === true ? true : undefined,
            dias,
          };
        });

      return {
        ownerKey,
        tipo,
        nombre,
        categoria: String(item.categoria || "").trim() || undefined,
        semanas,
      };
    });

  const rawTemplates = Array.isArray(source.templates) ? source.templates : [];
  const templates: WeekPlanTemplate[] = rawTemplates
    .filter((row) => row && typeof row === "object")
    .map((row, rowIndex) => {
      const item = row as Record<string, unknown>;
      const tipo: PersonaTipoPlan = item.tipo === "jugadoras" ? "jugadoras" : "alumnos";
      const nombre = String(item.nombre || `Template ${rowIndex + 1}`).trim() || `Template ${rowIndex + 1}`;
      const semanasRaw = Array.isArray(item.semanas) ? item.semanas : [];

      const semanas: WeekPlanLite[] = semanasRaw
        .filter((week) => week && typeof week === "object")
        .map((week, weekIndex) => {
          const weekRow = week as Record<string, unknown>;
          const diasRaw = Array.isArray(weekRow.dias) ? weekRow.dias : [];

          const dias: WeekDayPlanLite[] = diasRaw
            .filter((day) => day && typeof day === "object")
            .map((day, dayIndex) => {
              const dayRow = day as Record<string, unknown>;
              return {
                id: String(dayRow.id || createTrainingEntityId("dia")),
                dia: String(dayRow.dia || TRAINING_WEEK_DAY_NAMES[dayIndex] || `Dia ${dayIndex + 1}`),
                planificacion: String(dayRow.planificacion || "").trim(),
                objetivo: String(dayRow.objetivo || "").trim(),
                sesionId: String(dayRow.sesionId || "").trim(),
              };
            });

          return {
            id: String(weekRow.id || createTrainingEntityId("semana")),
            nombre: String(weekRow.nombre || `Semana ${weekIndex + 1}`),
            objetivo: String(weekRow.objetivo || "").trim(),
            dias: dias.length > 0 ? dias : [{
              id: createTrainingEntityId("dia"),
              dia: "Lunes",
              planificacion: "",
              objetivo: "",
              sesionId: "",
            }],
          };
        });

      return {
        id: String(item.id || createTrainingEntityId("template")),
        nombre,
        tipo,
        categoria: String(item.categoria || "").trim() || undefined,
        semanas: semanas.length > 0 ? semanas : [{
          id: createTrainingEntityId("semana"),
          nombre: "Semana 1",
          objetivo: "",
          dias: [{
            id: createTrainingEntityId("dia"),
            dia: "Lunes",
            planificacion: "",
            objetivo: "",
            sesionId: "",
          }],
        }],
      };
    });

  return {
    version: Number(source.version) || 3,
    planes,
    templates,
  };
}

function splitDisplayName(fullName: string) {
  const normalized = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { nombre: '', apellido: '' };
  }

  const parts = normalized.split(' ');
  if (parts.length <= 1) {
    return { nombre: normalized, apellido: '' };
  }

  return {
    nombre: parts[0],
    apellido: parts.slice(1).join(' '),
  };
}

function resolveIngresanteDisplayName(cliente: PendingIngresante) {
  const nombre = String(cliente.signupProfile?.nombre || '').trim();
  const apellido = String(cliente.signupProfile?.apellido || '').trim();
  const nombreCompleto = String(
    cliente.signupProfile?.nombreCompleto || cliente.nombreCompleto || `${nombre} ${apellido}`
  )
    .trim()
    .replace(/\s+/g, ' ');

  if (nombre || apellido) {
    return {
      nombre,
      apellido,
      nombreCompleto: `${nombre} ${apellido}`.trim(),
    };
  }

  const guessed = splitDisplayName(nombreCompleto);
  return {
    ...guessed,
    nombreCompleto,
  };
}

function sumarDias(dateValue: string, days: number): string {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function parseDateAtStart(dateValue: string): Date | null {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizePresenceEmail(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function formatPresenceLastSeen(value: string | null): string {
  if (!value) return "Sin actividad";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin actividad";

  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 45_000) return "Hace instantes";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  return parsed.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeWhatsAppNumber(meta: ClienteMeta): string {
  let phone = (meta.telefono || "").replace(/\D+/g, "");
  if (!phone) return "";

  if (phone.startsWith("00")) {
    phone = phone.slice(2);
  }

  if (phone.startsWith("549")) {
    return phone;
  }

  if (phone.startsWith("54")) {
    if (phone.length === 12) {
      return `549${phone.slice(2)}`;
    }
    return phone;
  }

  const countryHint = `${meta.codigoPais || ""} ${meta.pais || ""}`.toLowerCase();
  const isArgentina = /arg/.test(countryHint);

  if (isArgentina) {
    if (phone.length === 11 && phone.startsWith("0")) {
      return `549${phone.slice(1)}`;
    }

    if (phone.length === 10) {
      return `549${phone}`;
    }
  }

  return phone;
}

function resolveExercisePreviewImage(value?: string): string | null {
  const source = String(value || "").trim();
  if (!source) return null;

  if (/^https?:\/\/.+\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(source)) {
    return source;
  }

  // Handle data URLs that contain images
  if (source.startsWith("data:image/")) {
    return source;
  }

  // YouTube watch, embed, youtu.be, /shorts/, /live/
  const youtubeMatch = source.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (youtubeMatch?.[1]) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;
  }

  // Vimeo: https://vimeo.com/123456789 — there's no direct thumbnail API without auth.
  // Return null so the UI shows a generic preview placeholder for vimeo.

  return null;
}

function toSafeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").trim();
    if (!cleaned) {
      return null;
    }

    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeWorkoutLogs(rawValue: unknown): WorkoutLogRecord[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id || createTrainingEntityId("workout")),
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim(),
        alumnoEmail: String(item.alumnoEmail || item.email || "")
          .trim()
          .toLowerCase() || undefined,
        sessionId: String(item.sessionId || "").trim(),
        sessionTitle: String(item.sessionTitle || item.sesion || "Sesion").trim() || "Sesion",
        weekId: String(item.weekId || "").trim() || undefined,
        weekName: String(item.weekName || item.week || "").trim() || undefined,
        dayId: String(item.dayId || "").trim() || undefined,
        dayName: String(item.dayName || item.dia || "").trim() || undefined,
        blockId: String(item.blockId || "").trim() || undefined,
        blockTitle: String(item.blockTitle || item.block || "").trim() || undefined,
        exerciseId: String(item.exerciseId || "").trim() || undefined,
        exerciseName: String(item.exerciseName || item.ejercicio || "").trim() || undefined,
        exerciseKey: String(item.exerciseKey || "").trim() || undefined,
        fecha: String(item.fecha || "").slice(0, 10),
        series: Math.max(1, Math.round(Number(toSafeNumber(item.series) || 1))),
        repeticiones: Math.max(0, Math.round(Number(toSafeNumber(item.repeticiones) || 0))),
        pesoKg: Math.max(0, Number(toSafeNumber(item.pesoKg ?? item.peso) || 0)),
        molestia: Boolean(item.molestia),
        videoUrl: String(item.videoUrl || "").trim() || undefined,
        videoDataUrl: String(item.videoDataUrl || "").trim() || undefined,
        videoFileName: String(item.videoFileName || "").trim() || undefined,
        comentarios: String(item.comentarios || item.comentario || "").trim() || undefined,
        createdAt: String(item.createdAt || new Date().toISOString()),
      };
    })
    .filter((item) => (item.alumnoNombre || item.alumnoEmail) && item.sessionId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function cloneWeekExerciseForEditing(
  exercise: Partial<WeekExerciseLite> | null | undefined,
  exerciseIndex: number,
  blockFallbackId: string
): WeekExerciseLite {
  const source = exercise || {};
  const metricasRaw = Array.isArray(source.metricas) ? source.metricas : [];
  const superSerieRaw = Array.isArray(source.superSerie) ? source.superSerie : [];

  return {
    id: String(source.id || `${blockFallbackId}-exercise-${exerciseIndex + 1}`),
    ejercicioId: String(source.ejercicioId || ""),
    series: String(source.series || ""),
    repeticiones: String(source.repeticiones || ""),
    descanso: String(source.descanso || ""),
    carga: String(source.carga || ""),
    observaciones:
      typeof source.observaciones === "string"
        ? source.observaciones
        : String(source.observaciones || "").trim() || undefined,
    metricas:
      metricasRaw.length > 0
        ? metricasRaw
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              nombre: String(item?.nombre || "").trim(),
              valor: String(item?.valor || "").trim(),
            }))
        : undefined,
    superSerie: superSerieRaw
      .filter((item) => item && typeof item === "object")
      .map((item, superIndex) => ({
        id: String(item.id || `${blockFallbackId}-super-${exerciseIndex + 1}-${superIndex + 1}`),
        ejercicioId: String(item.ejercicioId || ""),
        series: String(item.series || ""),
        repeticiones: String(item.repeticiones || ""),
        descanso: String(item.descanso || ""),
        carga: String(item.carga || ""),
      })),
  };
}

function normalizeTrainingBlocksForEditing(rawBlocks: unknown): WeekBlockLite[] {
  const blocks = Array.isArray(rawBlocks) ? rawBlocks : [];

  return blocks
    .filter((block) => block && typeof block === "object")
    .map((block, blockIndex) => {
      const source = block as Record<string, unknown>;
      const fallbackBlockId = String(source.id || `block-${blockIndex + 1}`);
      const rawExercises = Array.isArray(source.ejercicios) ? source.ejercicios : [];

      // Only fall back to a default title when the field is genuinely missing.
      // An empty string is a valid value (the user is mid-edit) and must not be
      // overwritten — that's what was reverting deletions.
      const tituloIsMissing =
        source.titulo === undefined || source.titulo === null;
      const objetivoIsMissing =
        source.objetivo === undefined || source.objetivo === null;

      return {
        id: fallbackBlockId,
        titulo: tituloIsMissing ? `Bloque ${blockIndex + 1}` : String(source.titulo),
        objetivo: objetivoIsMissing ? "" : String(source.objetivo),
        ejercicios: rawExercises.map((exercise, exerciseIndex) =>
          cloneWeekExerciseForEditing(
            (exercise && typeof exercise === "object" ? exercise : null) as Partial<WeekExerciseLite> | null,
            exerciseIndex,
            fallbackBlockId
          )
        ),
      };
    });
}

function HiddenVisibilityIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2 12C3.8 8.3 7.4 6 12 6C16.6 6 20.2 8.3 22 12C20.2 15.7 16.6 18 12 18C7.4 18 3.8 15.7 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 3.5L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function orderWeeksByVisibility(weeks: WeekPlanLite[]): WeekPlanLite[] {
  const visibleWeeks = weeks.filter((week) => !week.oculto);
  const hiddenWeeks = weeks.filter((week) => Boolean(week.oculto));
  return [...visibleWeeks, ...hiddenWeeks];
}

function orderDaysByVisibility(days: WeekDayPlanLite[]): WeekDayPlanLite[] {
  const visibleDays = days.filter((day) => !day.oculto);
  const hiddenDays = days.filter((day) => Boolean(day.oculto));
  return [...visibleDays, ...hiddenDays];
}

function cloneTrainingExerciseForDuplicate(source: WeekExerciseLite): WeekExerciseLite {
  return {
    ...source,
    id: createTrainingEntityId("exercise"),
    metricas: Array.isArray(source.metricas)
      ? source.metricas.map((metric) => ({
          nombre: String(metric.nombre || ""),
          valor: String(metric.valor || ""),
        }))
      : undefined,
    superSerie: Array.isArray(source.superSerie)
      ? source.superSerie.map((superItem) => ({
          ...superItem,
          id: createTrainingEntityId("super"),
        }))
      : [],
  };
}

function cloneTrainingBlockForDuplicate(source: WeekBlockLite, blockIndex: number): WeekBlockLite {
  return {
    ...source,
    id: createTrainingEntityId("bloque"),
    titulo: String(source.titulo || `Bloque ${blockIndex + 1}`),
    objetivo: String(source.objetivo || ""),
    ejercicios: (source.ejercicios || []).map(cloneTrainingExerciseForDuplicate),
  };
}

function cloneTrainingDayForDuplicate(source: WeekDayPlanLite, dayIndex: number): WeekDayPlanLite {
  const baseBlocks = normalizeTrainingBlocksForEditing(source.entrenamiento?.bloques || []);

  return {
    id: createTrainingEntityId("dia"),
    dia: String(source.dia || `Dia ${dayIndex + 1}`),
    planificacion: String(source.planificacion || ""),
    objetivo: String(source.objetivo || ""),
    sesionId: String(source.sesionId || ""),
    oculto: false,
    postSesionFeedback: sanitizePostSessionFeedbackConfig(source.postSesionFeedback),
    entrenamiento: {
      bloques: baseBlocks.map((block, blockIndex) =>
        cloneTrainingBlockForDuplicate(block, blockIndex)
      ),
    },
  };
}

function cloneTrainingWeekForDuplicate(source: WeekPlanLite, weekIndex: number): WeekPlanLite {
  return {
    id: createTrainingEntityId("semana"),
    nombre: String(source.nombre || `Semana ${weekIndex + 1}`),
    objetivo: String(source.objetivo || ""),
    oculto: false,
    dias:
      Array.isArray(source.dias) && source.dias.length > 0
        ? source.dias.map((day, dayIndex) => cloneTrainingDayForDuplicate(day, dayIndex))
        : [createDefaultTrainingDay(0)],
  };
}

function createDefaultTrainingDay(index: number): WeekDayPlanLite {
  return {
    id: createTrainingEntityId("dia"),
    dia: TRAINING_WEEK_DAY_NAMES[index] || `Dia ${index + 1}`,
    planificacion: "",
    objetivo: "",
    sesionId: "",
    entrenamiento: {
      bloques: [],
    },
  };
}

function createDefaultTrainingWeek(index: number): WeekPlanLite {
  return {
    id: createTrainingEntityId("semana"),
    nombre: `Semana ${index + 1}`,
    objetivo: "",
    dias: [createDefaultTrainingDay(0)],
  };
}

function createDefaultClientTrainingPlan(cliente: ClienteView): WeekPersonPlanLite {
  const tipo = toPlanPersonaTipo(cliente.tipo);

  return {
    ownerKey: buildTrainingOwnerKey(tipo, cliente.nombre),
    tipo,
    nombre: cliente.nombre,
    categoria: cliente.categoria,
    semanas: [createDefaultTrainingWeek(0)],
  };
}

function buildPlanViewHref(clientId: string, tab: PlanViewTab): string {
  const params = new URLSearchParams();
  params.set("cliente", clientId);
  params.set("tab", tab);
  return `/clientes/plan?${params.toString()}`;
}

function buildClientDetailHref(clientId: string, tab: ClienteTab = "datos"): string {
  return `/clientes/ficha/${encodeURIComponent(clientId)}/${tab}`;
}

const TABS: { id: ClienteTab; label: string; icon: string }[] = [
  { id: "datos", label: "Datos generales", icon: "🧾" },
  { id: "cuestionario", label: "Cuestionario", icon: "🧠" },
  { id: "plan-entrenamiento", label: "Plan entrenamiento", icon: "🏋" },
  { id: "plan-nutricional", label: "Plan nutricional", icon: "🥗" },
  { id: "recetas", label: "Recetas", icon: "🍽" },
  { id: "notas", label: "Notas", icon: "📝" },
  { id: "documentos", label: "Documentos", icon: "📁" },
  { id: "chequeos", label: "Chequeos", icon: "✅" },
  { id: "progreso", label: "Progreso", icon: "📈" },
];

const tabPlaceholderCopy: Partial<Record<ClienteTab, string>> = {
  cuestionario: "Cuestionario inicial, antecedentes y habitos.",
  "plan-nutricional": "Lineamientos nutricionales y adherencia semanal.",
  recetas: "Recetas sugeridas y planificacion de comidas.",
  notas: "Notas del profesional y seguimiento del cliente.",
  documentos: "Links o referencias de documentos cargados.",
  chequeos: "Checklist de chequeos periodicos.",
};

const tabVisualConfig: Partial<
  Record<ClienteTab, { badge: string; title: string; hint: string; accent: string }>
> = {
  cuestionario: {
    badge: "Intake",
    title: "Mapa inicial del cliente",
    hint: "Sintetiza antecedentes, limitaciones y contexto para decisiones mas rapidas.",
    accent: "border-fuchsia-300/35 bg-fuchsia-500/10",
  },
  recetas: {
    badge: "Nutricion",
    title: "Biblioteca de recetas aplicables",
    hint: "Registra alternativas practicas y reemplazos por disponibilidad o preferencia.",
    accent: "border-amber-300/35 bg-amber-500/10",
  },
  notas: {
    badge: "Coaching",
    title: "Bitacora profesional",
    hint: "Documenta avances, fricciones y acuerdos para sostener adherencia.",
    accent: "border-cyan-300/35 bg-cyan-500/10",
  },
  documentos: {
    badge: "Recursos",
    title: "Repositorio de soporte",
    hint: "Centraliza links, archivos clave y evidencia compartida con el cliente.",
    accent: "border-indigo-300/35 bg-indigo-500/10",
  },
  chequeos: {
    badge: "Control",
    title: "Panel de chequeos periodicos",
    hint: "Anota mediciones y cumplimiento para detectar desvio temprano.",
    accent: "border-emerald-300/35 bg-emerald-500/10",
  },
};

function defaultMeta(cliente: ClienteView): ClienteMeta {
  const nowDate = new Date().toISOString().slice(0, 10);
  return {
    apellido: "",
    segundoApellido: "",
    email: "",
    codigoPais: "Argentina",
    telefono: "",
    pais: "Argentina",
    provincia: "",
    calle: "",
    numero: "",
    piso: "",
    depto: "",
    sexo: "femenino",
    startDate: nowDate,
    endDate: sumarDias(nowDate, 30),
    lastCheck: "SIN DATOS",
    nextCheck: "SIN DATOS",
    objNutricional: "SIN DATOS",
    colaboradores: "Solo la cuenta principal",
    chats: "Solo la cuenta principal",
    tipoAsesoria: "completa",
    modalidad: "presencial",
    categoriaPlan: cliente.categoria || "",
    pagoEstado: "confirmado",
    moneda: "ARS",
    importe: "30000",
    saldo: "0",
    emailPagador: "",
    autoRenewPlan: true,
    renewalDays: 30,
    tabNotas: {},
  };
}

// ============================================================================
// CANDADO TÉCNICO — Menú contextual de las planillas (semana / día / bloque).
//
// Por qué este componente existe y NO debe volverse inline:
//   Los menús ⋯ viven dentro de contenedores con overflow/transform que crean
//   un "containing block" y RECORTAN cualquier hijo con position:fixed. La única
//   forma robusta de evitar el recorte es renderizar el panel con createPortal a
//   document.body (fuera de todo ancestro). Este componente encapsula ese portal
//   + el posicionamiento fijo + el estado cerrado fuera de pantalla, de modo que
//   los tres menús comparten UNA sola fuente de verdad y nadie pueda reintroducir
//   el bug de recorte copiando/pegando un <div> suelto.
//
// INVARIANTE: el panel SIEMPRE se renderiza en un portal a document.body y su ref
// se pasa por panelRef para que el "click-afuera" reconozca los clicks internos.
// ============================================================================
type MenuAnchor = { top: number; left?: number; right?: number } | null;

function PortalMenu({
  open,
  anchor,
  panelRef,
  children,
}: {
  open: boolean;
  anchor: MenuAnchor;
  panelRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={open ? panelRef : undefined}
      aria-hidden={!open}
      style={
        open && anchor
          ? {
              position: "fixed",
              top: anchor.top,
              ...(anchor.left !== undefined
                ? { left: anchor.left }
                : { right: anchor.right }),
            }
          : { position: "fixed", top: -9999, left: -9999 }
      }
      className={`z-[200] flex min-w-[220px] origin-top flex-col gap-0.5 rounded-xl border border-white/15 bg-[#0e1012] p-2 shadow-2xl transition-[opacity,transform] duration-200 ease-out ${
        open
          ? "pointer-events-auto translate-y-0 scale-y-100 opacity-100"
          : "pointer-events-none -translate-y-1 scale-y-95 opacity-0"
      }`}
    >
      {children}
    </div>,
    document.body
  );
}

export default function ClientesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const [clientesSection, setClientesSection] = useState<ClientesSection>("clientes");
  const [isDetailMode, setIsDetailMode] = useState(false);
  const [userPhotos, setUserPhotos] = useState<{ byEmail: Record<string, string>; byName: Record<string, string> }>({ byEmail: {}, byName: {} });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/users/photos", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data && typeof data === "object") {
          setUserPhotos({
            byEmail: data.byEmail || {},
            byName: data.byName || {},
          });
        }
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveClientePhoto = (cliente: { nombre?: string; email?: string; signupProfile?: { email?: string; nombreCompleto?: string } | null }): string | null => {
    const emailCandidates = [
      cliente.email,
      cliente.signupProfile?.email,
    ];
    for (const candidate of emailCandidates) {
      const normalized = String(candidate || "").trim().toLowerCase();
      if (normalized && userPhotos.byEmail[normalized]) return userPhotos.byEmail[normalized];
    }
    const nameCandidates = [cliente.signupProfile?.nombreCompleto, cliente.nombre];
    for (const candidate of nameCandidates) {
      const normalized = String(candidate || "").trim().toLowerCase();
      if (normalized && userPhotos.byName[normalized]) return userPhotos.byName[normalized];
    }
    return null;
  };

  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [detailTabId, setDetailTabId] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasByUserId, setEtiquetasByUserId] = useState<Record<string, Etiqueta[]>>({});
  const [etiquetaSearch, setEtiquetaSearch] = useState("");
  const [etiquetaCrear, setEtiquetaCrear] = useState({ texto: "", color: "#2196f3" });
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnResize, setColumnResize] = useState<{
    column: ClientTableColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);
  const { jugadoras, agregarJugadora, editarJugadora, eliminarJugadora } = usePlayers();
  const { alumnos, alumnosLoaded, agregarAlumno, editarAlumno, eliminarAlumno } = useAlumnos();
  const { categorias } = useCategories();
  const { deportes } = useDeportes();
  const { ejercicios, agregarEjercicio } = useEjercicios();
  const [newExerciseModalOpen, setNewExerciseModalOpen] = useState(false);
  const [newExerciseTarget, setNewExerciseTarget] = useState<{
    weekId: string;
    dayId: string;
    blockId: string;
    exerciseRowId: string;
  } | null>(null);
  const [newExerciseNombre, setNewExerciseNombre] = useState("");
  const [newExerciseVideoUrl, setNewExerciseVideoUrl] = useState("");
  const [newExerciseDescripcion, setNewExerciseDescripcion] = useState("");
  const [newExerciseObjetivo, setNewExerciseObjetivo] = useState("");
  const [newExerciseCategoria, setNewExerciseCategoria] = useState("Fuerza");
  const [newExerciseSaving, setNewExerciseSaving] = useState(false);
  const [newExerciseError, setNewExerciseError] = useState<string | null>(null);

  const openNewExerciseModal = (target: { weekId: string; dayId: string; blockId: string; exerciseRowId: string }) => {
    setNewExerciseTarget(target);
    setNewExerciseNombre("");
    setNewExerciseVideoUrl("");
    setNewExerciseDescripcion("");
    setNewExerciseObjetivo("");
    setNewExerciseCategoria("Fuerza");
    setNewExerciseError(null);
    setNewExerciseModalOpen(true);
  };

  const closeNewExerciseModal = () => {
    setNewExerciseModalOpen(false);
    setNewExerciseTarget(null);
  };

  const saveNewExerciseFromModal = async () => {
    const nombre = newExerciseNombre.trim();
    if (!nombre) {
      setNewExerciseError("El nombre del ejercicio es obligatorio");
      return;
    }
    setNewExerciseSaving(true);
    setNewExerciseError(null);
    try {
      const newId = agregarEjercicio({
        nombre,
        categoria: newExerciseCategoria || "Fuerza",
        descripcion: newExerciseDescripcion.trim(),
        objetivo: newExerciseObjetivo.trim(),
        videoUrl: newExerciseVideoUrl.trim(),
      });

      if (newExerciseTarget) {
        const { weekId, dayId, blockId, exerciseRowId } = newExerciseTarget;
        if (exerciseRowId.includes("::")) {
          const [exId, superKey] = exerciseRowId.split("::");
          updateTrainingSuperSerieField(weekId, dayId, blockId, exId, superKey, "ejercicioId", newId);
        } else {
          updateTrainingExerciseField(weekId, dayId, blockId, exerciseRowId, "ejercicioId", newId);
        }
      }

      setNewExerciseModalOpen(false);
      setNewExerciseTarget(null);
      setNewExerciseNombre("");
      setNewExerciseVideoUrl("");
      setNewExerciseDescripcion("");
      setNewExerciseObjetivo("");
    } catch (saveError) {
      setNewExerciseError(saveError instanceof Error ? saveError.message : "No se pudo guardar el ejercicio");
    } finally {
      setNewExerciseSaving(false);
    }
  };
  const { sesiones, agregarSesion } = useSessions();

  const sessionScope = useMemo(() => {
    const raw = String(session?.user?.id || session?.user?.email || "anon");
    return raw.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  }, [session?.user?.email, session?.user?.id]);

  const clientTableUiKey = `${CLIENT_TABLE_UI_KEY_PREFIX}-${sessionScope}`;

  const [clientTableUiPrefs, setClientTableUiPrefs, clientTableUiLoaded] = useSharedState<ClientTableUiPrefs>(
    DEFAULT_CLIENT_TABLE_UI_PREFS,
    {
      key: clientTableUiKey,
    }
  );

  const normalizedTableUiPrefs = useMemo(
    () => sanitizeClientTableUiPrefs(clientTableUiPrefs || DEFAULT_CLIENT_TABLE_UI_PREFS),
    [clientTableUiPrefs]
  );

  const visibleExtraColumns = normalizedTableUiPrefs.visibleExtraColumns;
  const rowHeight = normalizedTableUiPrefs.rowHeight;
  const columnWidths = normalizedTableUiPrefs.columnWidths;
  const filtroPlan = normalizedTableUiPrefs.planFilter;
  const rowCellVerticalPadding = useMemo(() => {
    const value = Math.round((rowHeight - 24) / 2);
    return Math.max(2, Math.min(18, value));
  }, [rowHeight]);

  const [clientesMeta, setClientesMeta] = useSharedState<Record<string, ClienteMeta>>({}, {
    key: CLIENTE_META_KEY,
    legacyLocalStorageKey: CLIENTE_META_KEY,
  });
  const [pagos, setPagos] = useSharedState<PagoRegistro[]>([], {
    key: PAGOS_KEY,
    legacyLocalStorageKey: PAGOS_KEY,
  });
  const [nutritionPlans, setNutritionPlans] = useSharedState<NutritionPlan[]>([], {
    key: NUTRITION_PLANS_KEY,
    legacyLocalStorageKey: NUTRITION_PLANS_KEY,
  });
  const [nutritionAssignments, setNutritionAssignments] = useSharedState<AlumnoNutritionAssignment[]>([], {
    key: NUTRITION_ASSIGNMENTS_KEY,
    legacyLocalStorageKey: NUTRITION_ASSIGNMENTS_KEY,
  });
  const [nutritionCustomFoods] = useSharedState<NutritionFood[]>([], {
    key: NUTRITION_CUSTOM_FOODS_KEY,
    legacyLocalStorageKey: NUTRITION_CUSTOM_FOODS_KEY,
  });
  const [weekStoreRaw, setWeekStoreRaw] = useSharedState<WeekStoreLite>(
    {
      version: 3,
      planes: [],
      templates: [],
    },
    {
      key: WEEK_PLAN_KEY,
      legacyLocalStorageKey: WEEK_PLAN_KEY,
    }
  );
  const [aiTrainingPlansRaw] = useSharedState<StoredAITrainingPlanLite[]>([], {
    key: AI_TRAINING_PLANS_KEY,
    legacyLocalStorageKey: AI_TRAINING_PLANS_KEY,
  });
  const [workoutLogsRaw, setWorkoutLogsRaw] = useSharedState<unknown[]>([], {
    key: WORKOUT_LOGS_KEY,
    legacyLocalStorageKey: WORKOUT_LOGS_KEY,
  });

  const [vista, setVista] = useState<ClienteEstado>("activo");
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | ClienteTipo>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroDeporte, setFiltroDeporte] = useState("todos");
  const [filtroClub, setFiltroClub] = useState("");
  const [crearOpen, setCrearOpen] = useState(false);
  const [crearStep, setCrearStep] = useState(1);
  const [crearMeta, setCrearMeta] = useState({
    apellido: "",
    segundoApellido: "",
    email: "",
    sexo: "femenino" as "masculino" | "femenino",
    codigoPais: "",
    telefono: "",
    pais: "",
    provincia: "",
    calle: "",
    numero: "",
    piso: "",
    depto: "",
    categoriaPlan: "",
    startDate: "",
    endDate: "",
    tipoAsesoria: "entrenamiento" as ClienteMeta["tipoAsesoria"],
    modalidad: "presencial" as ClienteMeta["modalidad"],
  });
  const [form, setForm] = useState<ClienteForm>(INITIAL_FORM);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClienteTab>("datos");
  const [datosDraft, setDatosDraft] = useState<DatosDraft | null>(null);
  const [pagoForm, setPagoForm] = useState({
    clientId: "",
    fecha: new Date().toISOString().slice(0, 10),
    importe: "",
    moneda: "ARS",
  });
  const [planesDisponibles, setPlanesDisponibles] = useState<Array<{
    id: string; nombre: string; precio: number; moneda: string; duracionDias: number; activo: boolean;
  }>>([]);
  const [planSeleccionado, setPlanSeleccionado] = useState("");
  const [mpPlanSeleccionado, setMpPlanSeleccionado] = useState("");
  const [mpCheckoutLoading, setMpCheckoutLoading] = useState(false);
  const [mpCheckoutUrl, setMpCheckoutUrl] = useState<string | null>(null);
  const [mpCheckoutError, setMpCheckoutError] = useState("");
  const [presenceByEmail, setPresenceByEmail] = useState<Record<string, PresenceSnapshot>>({});
  const [ingresantesPendientes, setIngresantesPendientes] = useState<PendingIngresante[]>([]);
  const [ingresantesLoading, setIngresantesLoading] = useState(false);
  const [ingresantesActionId, setIngresantesActionId] = useState<string | null>(null);
  const [ingresantesMessage, setIngresantesMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [trainingPreviewWeekId, setTrainingPreviewWeekId] = useState("");
  const [trainingPreviewDayId, setTrainingPreviewDayId] = useState("");
  const [rutinaPrintMode, setRutinaPrintMode] = useState<RutinaPrintMode | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [trainingExercisePanelMode, setTrainingExercisePanelMode] =
    useState<TrainingExercisePanelMode | null>(null);
  const [trainingExercisePanelTarget, setTrainingExercisePanelTarget] =
    useState<TrainingExercisePanelTarget | null>(null);
  const [trainingRecordDraft, setTrainingRecordDraft] = useState<TrainingRecordDraft>(
    INITIAL_TRAINING_RECORD_DRAFT
  );
  const [trainingRecordStatus, setTrainingRecordStatus] = useState("");
  const [trainingPlanReloading, setTrainingPlanReloading] = useState(false);
  const [hasUnsavedTrainingChanges, setHasUnsavedTrainingChanges] = useState(false);
  const [showAssignPlanModal, setShowAssignPlanModal] = useState(false);
  const [assignPlanSearch, setAssignPlanSearch] = useState("");
  const [assignPlanFilter, setAssignPlanFilter] = useState<"todos" | "template" | "ia">("todos");

  // ── Wizard plan nutricional ────────────────────────────────────────────────
  const [nutritionWizard, setNutritionWizard] = useState<NutritionWizardData | null>(null);
  const [nutritionAssigning, setNutritionAssigning] = useState(false);
  const [nutritionAssignSearch, setNutritionAssignSearch] = useState("");
  // Inline editing del plan activo
  const [nutritionEditMode, setNutritionEditMode] = useState(false);
  const [nutritionGramEdit, setNutritionGramEdit] = useState<{ mealId: string; itemId: string; value: string } | null>(null);
  const [nutritionAddFoodMealId, setNutritionAddFoodMealId] = useState<string | null>(null);
  const [nutritionFoodSearch, setNutritionFoodSearch] = useState("");
  const [hasUnsavedNutritionChanges, setHasUnsavedNutritionChanges] = useState(false);
  const [nutritionSyncing, setNutritionSyncing] = useState(false);
  const [trainingWeekInlineEdit, setTrainingWeekInlineEdit] = useState<{
    weekId: string;
    value: string;
  } | null>(null);
  const [trainingDayInlineEdit, setTrainingDayInlineEdit] = useState<{
    weekId: string;
    dayId: string;
    value: string;
  } | null>(null);
  const [trainingStructureMenu, setTrainingStructureMenu] =
    useState<TrainingStructureMenuState>(null);
  const [trainingBlockMenu, setTrainingBlockMenu] = useState<TrainingBlockMenuState>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const [trainingBlockEditingId, setTrainingBlockEditingId] = useState<string | null>(null);
  const [feedbackModalTarget, setFeedbackModalTarget] = useState<{ weekId: string; dayId: string } | null>(null);
  const [feedbackModalMeasurements, setFeedbackModalMeasurements] = useState<PostSessionMeasurementLite[]>([]);
  const [feedbackModalMaxPerDay, setFeedbackModalMaxPerDay] = useState<string>("1");
  const [feedbackModalTitle, setFeedbackModalTitle] = useState<string>("");
  // ── Guardar plan como template ─────────────────────────────────────────────
  const [saveAsTemplateModal, setSaveAsTemplateModal] = useState<{ name: string } | null>(null);

  const openFeedbackModal = (
    weekId: string,
    dayId: string,
    existingConfig?: PostSessionFeedbackConfigLite | null
  ) => {
    const config = existingConfig;
    const baseMap = new Map<PostSessionMeasurementId, PostSessionMeasurementLite>();
    if (Array.isArray(config?.measurements)) {
      for (const measurement of config.measurements!) {
        baseMap.set(measurement.id, measurement);
      }
    }
    const measurements: PostSessionMeasurementLite[] = POST_SESSION_MEASUREMENT_CATALOG.map((entry) => {
      const existing = baseMap.get(entry.id);
      return existing
        ? { id: entry.id, visible: existing.visible, obligatoria: existing.obligatoria }
        : { id: entry.id, visible: false, obligatoria: false };
    });
    setFeedbackModalMeasurements(measurements);
    setFeedbackModalMaxPerDay(config?.maxPerDay !== undefined ? String(config.maxPerDay) : "1");
    setFeedbackModalTitle(config?.title || "");
    setFeedbackModalTarget({ weekId, dayId });
  };

  const closeFeedbackModal = () => {
    setFeedbackModalTarget(null);
  };

  const saveFeedbackModal = () => {
    if (!feedbackModalTarget) return;
    const parsedMax = parseInt(feedbackModalMaxPerDay, 10);
    const maxPerDay = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : undefined;
    applyTrainingDayPostSessionFeedbackMeasurements(
      feedbackModalTarget.weekId,
      feedbackModalTarget.dayId,
      feedbackModalMeasurements,
      maxPerDay,
      feedbackModalTitle
    );
    setFeedbackModalTarget(null);
  };

  const toggleFeedbackModalMeasurement = (
    id: PostSessionMeasurementId,
    field: "visible" | "obligatoria",
    value: boolean
  ) => {
    setFeedbackModalMeasurements((prev) =>
      prev.map((measurement) => {
        if (measurement.id !== id) return measurement;
        if (field === "obligatoria" && value && !measurement.visible) {
          // Forcing visible when obligatoria is enabled
          return { ...measurement, visible: true, obligatoria: true };
        }
        if (field === "visible" && !value && measurement.obligatoria) {
          return { ...measurement, visible: false, obligatoria: false };
        }
        return { ...measurement, [field]: value };
      })
    );
  };
  const [trainingBlockGridConfigOpenId, setTrainingBlockGridConfigOpenId] =
    useState<string | null>(null);
  const trainingActionCooldownRef = useRef<Record<string, number>>({});
  const trainingStructureMenuRef = useRef<HTMLDivElement | null>(null);
  const trainingBlockMenuRef = useRef<HTMLDivElement | null>(null);
  // Refs al PANEL portaleado (vive en document.body, fuera del wrapper). Sin esto,
  // el handler de "click afuera" trataría los clicks dentro del menú como externos
  // y cerraría el menú antes de que el botón ejecute su accion.
  const trainingStructureMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const trainingBlockMenuPanelRef = useRef<HTMLDivElement | null>(null);

  const userRole = String((session?.user as any)?.role || '').trim().toUpperCase();
  // While the session is still loading, assume admin so the editor view shows
  // immediately on refresh instead of flashing the read-only "Vista cliente".
  // Once the session resolves, the real role takes over.
  const isAdmin = userRole === 'ADMIN' || sessionStatus === 'loading';

  useEffect(() => {
    if (userRole !== 'ADMIN') return;
    fetch("/api/admin/payments/plan-precios")
      .then((r) => r.json())
      .then((data) => {
        if (data?.planes) setPlanesDisponibles(data.planes);
      })
      .catch(() => {});
  }, [userRole]);

  useEffect(() => {
    const safeDecodeParam = (value: string | null) => {
      if (!value) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    const syncFromLocation = () => {
      if (typeof window === "undefined") return;

      const normalizedPath = window.location.pathname.replace(/\/+$/, "");
      const detailPathMatch = normalizedPath.match(/^\/clientes\/ficha\/([^/]+)(?:\/([^/]+))?$/i);

      if (detailPathMatch) {
        setClientesSection("clientes");
        setIsDetailMode(true);
        setDetailClientId(safeDecodeParam(detailPathMatch[1]));
        setDetailTabId(safeDecodeParam(detailPathMatch[2] || "datos"));
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const isDetail = params.get("detalle") === "1";
      const section = String(params.get("seccion") || params.get("panel") || params.get("vista") || "")
        .trim()
        .toLowerCase();

      setClientesSection(!isDetail && section === "plantel" ? "plantel" : "clientes");
      setIsDetailMode(isDetail);
      setDetailClientId(safeDecodeParam(params.get("cliente")));
      setDetailTabId(safeDecodeParam(params.get("tab")));
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    if (clientesSection !== "plantel") return;
    setIsDetailMode(false);
    setDetailClientId(null);
    setDetailTabId(null);
  }, [clientesSection]);

  const loadIngresantesPendientes = async () => {
    if (!isAdmin) {
      setIngresantesPendientes([]);
      return;
    }

    try {
      setIngresantesLoading(true);
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await response.json().catch(() => []);
      const list = Array.isArray(data) ? (data as PendingIngresante[]) : [];
      setIngresantesPendientes(
        list.filter(
          (item) =>
            item.role === 'CLIENTE' &&
            item.emailVerified === true &&
            String(item.estado || 'activo').trim().toLowerCase() !== 'activo'
        )
      );
    } catch {
      setIngresantesPendientes([]);
    } finally {
      setIngresantesLoading(false);
    }
  };

  const darAltaIngresante = async (ingresante: PendingIngresante) => {
    if (!isAdmin) {
      return;
    }

    try {
      setIngresantesActionId(ingresante.id);
      setIngresantesMessage(null);

      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: ingresante.id,
          role: 'CLIENTE',
          estado: 'activo',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String((data as { message?: string }).message || 'No se pudo dar de alta al ingresante'));
      }

      setIngresantesMessage({
        type: 'success',
        text: `Alta aplicada: ${resolveIngresanteDisplayName(ingresante).nombreCompleto || ingresante.email}`,
      });
      await loadIngresantesPendientes();
    } catch (error) {
      setIngresantesMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error al dar de alta',
      });
    } finally {
      setIngresantesActionId(null);
    }
  };

  useEffect(() => {
    void loadIngresantesPendientes();
  }, [isAdmin]);

  const categoriasOptions = useMemo(
    () => categorias.filter((cat) => cat.habilitada).map((cat) => cat.nombre),
    [categorias]
  );

  useEffect(() => {
    if (!isDetailMode || !detailClientId) return;

    setSelectedClientId(detailClientId);

    if (detailTabId && TABS.some((tab) => tab.id === detailTabId)) {
      setActiveTab(detailTabId as ClienteTab);
    }
  }, [detailClientId, detailTabId, isDetailMode]);

  const deportesOptions = useMemo(
    () => deportes.filter((dep) => dep.habilitado).map((dep) => dep.nombre),
    [deportes]
  );

  const posicionesOptions = useMemo(() => {
    const dep = deportes.find((item) => item.nombre === form.deporte);
    return dep?.posiciones || [];
  }, [deportes, form.deporte]);

  const clientes = useMemo<ClienteView[]>(() => {
    const jugadorasMapped: ClienteView[] = jugadoras.map((j) => ({
      id: `jugadora:${j.nombre}`,
      tipo: "jugadora",
      nombre: j.nombre,
      estado: j.estado || "activo",
      practicaDeporte: true,
      deporte: j.deporte,
      categoria: j.categoria,
      posicion: j.posicion,
      fechaNacimiento: j.fechaNacimiento,
      altura: j.altura,
      peso: j.peso,
      club: j.club,
      objetivo: j.objetivo,
      observaciones: j.observaciones,
      wellness: j.wellness,
      carga: j.carga,
    }));

    const alumnosMapped: ClienteView[] = alumnos.map((a) => ({
      id: `alumno:${a.nombre}`,
      tipo: "alumno",
      nombre: a.nombre,
      estado: a.estado || "activo",
      practicaDeporte: false,
      fechaNacimiento: a.fechaNacimiento,
      altura: a.altura,
      peso: a.peso,
      club: a.club,
      objetivo: a.objetivo,
      observaciones: a.observaciones,
    }));

    return [...jugadorasMapped, ...alumnosMapped];
  }, [alumnos, jugadoras]);
  // Declarar selectedClient y useEffect después de clientes

  const selectedClient = useMemo(
    () => clientes.find((cliente) => cliente.id === selectedClientId) || null,
    [clientes, selectedClientId]
  );

  const nutritionFoodsById = useMemo(() => {
    const mergedFoods: NutritionFood[] = [
      ...(argentineFoodsBase as NutritionFood[]),
      ...nutritionCustomFoods,
    ];
    return new Map(mergedFoods.map((food) => [food.id, food]));
  }, [nutritionCustomFoods]);

  const selectedClientEmail = useMemo(() => {
    if (!selectedClient) return "";
    return String(clientesMeta[selectedClient.id]?.email || "")
      .trim()
      .toLowerCase();
  }, [clientesMeta, selectedClient]);

  const selectedNutritionAssignment = useMemo(() => {
    if (!selectedClient) return null;
    const clientName = selectedClient.nombre;
    const clientIdName = selectedClient.id.split(":")[1] || "";
    const matches = nutritionAssignments.filter(
      (assignment) => {
        const assignmentEmail = String(assignment.alumnoEmail || "")
          .trim()
          .toLowerCase();
        const byName =
          namesLikelyMatch(assignment.alumnoNombre, clientName) ||
          namesLikelyMatch(assignment.alumnoNombre, clientIdName);
        const byEmail = Boolean(selectedClientEmail && assignmentEmail && assignmentEmail === selectedClientEmail);
        return byName || byEmail;
      }
    );

    if (matches.length === 0) return null;

    return matches
      .slice()
      .sort(
        (a, b) =>
          new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()
      )[0];
  }, [nutritionAssignments, selectedClient, selectedClientEmail]);

  const selectedNutritionPlan = useMemo(() => {
    if (!selectedClient) return null;

    if (selectedNutritionAssignment) {
      const assigned =
        nutritionPlans.find((plan) => plan.id === selectedNutritionAssignment.planId) || null;
      if (assigned) {
        return assigned;
      }
    }

    const clientName = selectedClient.nombre;
    const clientIdName = selectedClient.id.split(":")[1] || "";
    const planMatchedByEmbeddedAlumno = nutritionPlans
      .filter(
        (plan) =>
          namesLikelyMatch(plan.alumnoAsignado || "", clientName) ||
          namesLikelyMatch(plan.alumnoAsignado || "", clientIdName)
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      )[0];

    return planMatchedByEmbeddedAlumno || null;
  }, [nutritionPlans, selectedClient, selectedNutritionAssignment]);

  const nutritionPlanStatusByClientId = useMemo(() => {
    const map = new Map<string, NutritionPlanStatus>();

    for (const client of clientes) {
      const clientName = client.nombre;
      const clientIdName = client.id.split(":")[1] || "";
      const clientEmail = String(clientesMeta[client.id]?.email || "")
        .trim()
        .toLowerCase();

      const assignment = nutritionAssignments
        .filter(
          (item) => {
            const assignmentEmail = String(item.alumnoEmail || "")
              .trim()
              .toLowerCase();
            const byName =
              namesLikelyMatch(item.alumnoNombre, clientName) ||
              namesLikelyMatch(item.alumnoNombre, clientIdName);
            const byEmail = Boolean(clientEmail && assignmentEmail && assignmentEmail === clientEmail);
            return byName || byEmail;
          }
        )
        .sort(
          (a, b) =>
            new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()
        )[0];

      let matchedPlan: NutritionPlan | null = null;

      if (assignment) {
        matchedPlan = nutritionPlans.find((plan) => plan.id === assignment.planId) || null;
      }

      if (!matchedPlan) {
        matchedPlan =
          nutritionPlans
            .filter(
              (plan) =>
                namesLikelyMatch(plan.alumnoAsignado || "", clientName) ||
                namesLikelyMatch(plan.alumnoAsignado || "", clientIdName)
            )
            .sort(
              (a, b) =>
                new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
            )[0] || null;
      }

      if (matchedPlan) {
        map.set(client.id, {
          hasPlan: true,
          planName: matchedPlan.nombre,
          updatedAt: matchedPlan.updatedAt,
        });
      } else {
        map.set(client.id, {
          hasPlan: false,
          planName: "",
          updatedAt: "",
        });
      }
    }

    return map;
  }, [clientes, clientesMeta, nutritionAssignments, nutritionPlans]);

  const selectedNutritionIntake = useMemo(() => {
    if (!selectedNutritionPlan) {
      return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
    }

    const totals = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };

    for (const meal of selectedNutritionPlan.comidas || []) {
      for (const item of meal.items || []) {
        const food = nutritionFoodsById.get(item.foodId);
        if (!food) continue;
        const ratio = Math.max(0, Number(item.gramos) || 0) / 100;
        totals.calorias += food.kcalPer100g * ratio;
        totals.proteinas += food.proteinPer100g * ratio;
        totals.carbohidratos += food.carbsPer100g * ratio;
        totals.grasas += food.fatPer100g * ratio;
      }
    }

    return {
      calorias: Math.round(totals.calorias * 10) / 10,
      proteinas: Math.round(totals.proteinas * 10) / 10,
      carbohidratos: Math.round(totals.carbohidratos * 10) / 10,
      grasas: Math.round(totals.grasas * 10) / 10,
    };
  }, [nutritionFoodsById, selectedNutritionPlan]);

  // ── Abre el wizard pre-cargando los datos del cliente ──────────────────────
  const openNutritionWizard = (basePlanId?: string) => {
    if (!selectedClient) return;

    // Calcular edad desde fechaNacimiento
    let edadCalc = 25;
    if (selectedClient.fechaNacimiento) {
      const dob = new Date(selectedClient.fechaNacimiento);
      if (!isNaN(dob.getTime())) {
        const today = new Date();
        edadCalc = today.getFullYear() - dob.getFullYear();
        if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) edadCalc--;
      }
    }

    // Inferir sexo
    const sexoInferido: "masculino" | "femenino" =
      selectedClient.tipo === "jugadora" ? "femenino" :
      (selectedMeta?.sexo === "femenino" ? "femenino" : "masculino");

    // Inferir objetivo nutricional
    const objRaw = String(selectedMeta?.objNutricional || selectedClient.objetivo || "").toLowerCase();
    const objetivoInferido: NutritionGoal =
      /deficit|bajo|bajar|perder|cut/.test(objRaw)  ? "deficit"       :
      /masa|subir|ganar|volumen|bulk/.test(objRaw)  ? "masa"          :
      /recomp|defin|tono|lean/.test(objRaw)         ? "recomposicion" :
                                                       "mantenimiento";

    setNutritionWizard({
      step: 1,
      pesoKg:    String(parseFloat(String(selectedClient.peso || "")) || ""),
      alturaCm:  String(parseFloat(String(selectedClient.altura || "")) || ""),
      edad:      edadCalc > 0 ? String(edadCalc) : "",
      sexo:      sexoInferido,
      objetivo:  objetivoInferido,
      diasEntrenamiento: "",
      comidasDia: "5",
      horarioEntrenamiento: "",
      restricciones: "",
      condicionesMedicas: "",
      basePlanId,
    });
  };

  // ── Función que llama al endpoint de adaptación y guarda el plan ────────────
  const applyNutritionPlan = async (wizard: NutritionWizardData) => {
    if (!selectedClient) return;
    setNutritionAssigning(true);
    setNutritionWizard(null);

    try {
      const pesoKg   = parseFloat(wizard.pesoKg)   || 70;
      const alturaCm = parseFloat(wizard.alturaCm)  || 170;
      const edad     = parseInt(wizard.edad, 10)    || 25;
      const comidasDia = parseInt(wizard.comidasDia, 10) || 5;
      const diasEntrenamiento = parseInt(wizard.diasEntrenamiento, 10) || 0;

      // Determinar nivel de actividad según días de entrenamiento
      const actividad =
        diasEntrenamiento >= 6 ? "muy-alto" :
        diasEntrenamiento >= 4 ? "alto"     :
        diasEntrenamiento >= 2 ? "moderado" :
        diasEntrenamiento === 1 ? "ligero"  : "sedentario";

      const profile = {
        nombre:            selectedClient.nombre,
        sexo:              wizard.sexo,
        pesoKg,
        alturaCm,
        edad,
        actividad,
        objetivo:          wizard.objetivo,
        comidasDia,
        diasEntrenamiento,
        restricciones:     wizard.restricciones || undefined,
        condicionesMedicas: wizard.condicionesMedicas || undefined,
      };

      const basePlan = wizard.basePlanId
        ? nutritionPlans.find((p) => p.id === wizard.basePlanId)
        : undefined;

      const mode = basePlan ? "adapt" : "create";

      const res = await fetch("/api/nutrition/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          profile,
          basePlan: basePlan
            ? { targets: basePlan.targets, comidas: basePlan.comidas }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error desconocido");

      // Crear nuevo plan en el store
      const newPlanId = `nplan-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      const baseName  = basePlan ? basePlan.nombre : "Plan nutricional";
      const newPlan: NutritionPlan = {
        id:             newPlanId,
        nombre:         `${baseName} — ${selectedClient.nombre}`,
        alumnoAsignado: selectedClient.nombre,
        objetivo:       wizard.objetivo,
        notas:          [
          wizard.restricciones     ? `Restricciones: ${wizard.restricciones}`      : "",
          wizard.condicionesMedicas ? `Condiciones: ${wizard.condicionesMedicas}`  : "",
          wizard.horarioEntrenamiento ? `Entrenamiento: ${wizard.horarioEntrenamiento}` : "",
        ].filter(Boolean).join(" · "),
        targets:   data.targets,
        comidas:   data.comidas,
        updatedAt: new Date().toISOString(),
        perfil: {
          sexo: wizard.sexo,
          pesoKg,
          alturaCm,
          edad,
          actividad,
          comidasDia,
          diasEntrenamiento,
          restricciones:      wizard.restricciones || undefined,
          condicionesMedicas: wizard.condicionesMedicas || undefined,
        },
      };

      setNutritionPlans((prev) => [...(prev || []), newPlan]);

      // Crear asignación
      const newAssignment: AlumnoNutritionAssignment = {
        alumnoNombre: selectedClient.nombre,
        planId:       newPlanId,
        assignedAt:   new Date().toISOString(),
      };
      setNutritionAssignments((prev) => [
        ...(prev || []).filter((a) => a.alumnoNombre !== selectedClient.nombre),
        newAssignment,
      ]);

      // Resetear edición inline
      setNutritionEditMode(false);
      setHasUnsavedNutritionChanges(false);
    } catch (err) {
      console.error("[applyNutritionPlan]", err);
    } finally {
      setNutritionAssigning(false);
    }
  };

  // ── Inline edit del plan de nutrición ─────────────────────────────────────
  const saveNutritionInlineEdit = () => {
    if (!selectedNutritionPlan || !nutritionGramEdit) return;
    const newGramos = Math.max(1, parseInt(nutritionGramEdit.value, 10) || 1);
    const updated: NutritionPlan = {
      ...selectedNutritionPlan,
      updatedAt: new Date().toISOString(),
      comidas: selectedNutritionPlan.comidas.map((meal) =>
        meal.id !== nutritionGramEdit.mealId ? meal : {
          ...meal,
          items: meal.items.map((item) =>
            item.id !== nutritionGramEdit.itemId ? item : { ...item, gramos: newGramos }
          ),
        }
      ),
    };
    setNutritionPlans((prev) =>
      (prev || []).map((p) => (p.id === updated.id ? updated : p))
    );
    setNutritionGramEdit(null);
    setHasUnsavedNutritionChanges(true);
  };

  const removeNutritionItem = (mealId: string, itemId: string) => {
    if (!selectedNutritionPlan) return;
    const updated: NutritionPlan = {
      ...selectedNutritionPlan,
      updatedAt: new Date().toISOString(),
      comidas: selectedNutritionPlan.comidas.map((meal) =>
        meal.id !== mealId ? meal : {
          ...meal,
          items: meal.items.filter((item) => item.id !== itemId),
        }
      ),
    };
    setNutritionPlans((prev) =>
      (prev || []).map((p) => (p.id === updated.id ? updated : p))
    );
    setHasUnsavedNutritionChanges(true);
  };

  const addNutritionItem = (mealId: string, foodId: string) => {
    if (!selectedNutritionPlan) return;
    const newItem = {
      id:     `ni-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      foodId,
      gramos: 100,
    };
    const updated: NutritionPlan = {
      ...selectedNutritionPlan,
      updatedAt: new Date().toISOString(),
      comidas: selectedNutritionPlan.comidas.map((meal) =>
        meal.id !== mealId ? meal : { ...meal, items: [...meal.items, newItem] }
      ),
    };
    setNutritionPlans((prev) =>
      (prev || []).map((p) => (p.id === updated.id ? updated : p))
    );
    setNutritionAddFoodMealId(null);
    setNutritionFoodSearch("");
    setHasUnsavedNutritionChanges(true);
  };

  // ── Fuerza sync del plan nutricional al servidor ───────────────────────────
  const syncNutritionPlan = async () => {
    if (!selectedNutritionPlan || nutritionSyncing) return;
    setNutritionSyncing(true);
    markManualSaveIntent(NUTRITION_PLANS_KEY);
    // Breve delay para que el flush de useSharedState dispare
    await new Promise((r) => setTimeout(r, 400));
    setHasUnsavedNutritionChanges(false);
    setNutritionSyncing(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pf-inline-toast", {
        detail: { type: "success", message: "Plan nutricional actualizado en el perfil del alumno." },
      }));
    }
  };

  // ── Generar link de pago Mercado Pago para el alumno seleccionado ──────────
  const generarLinkMP = async () => {
    if (!selectedClient || !selectedMeta) return;
    const email = String(selectedMeta.email || "").trim();
    if (!email) {
      setMpCheckoutError("Configurá el email del alumno en la pestaña Datos primero.");
      return;
    }
    if (!mpPlanSeleccionado) {
      setMpCheckoutError("Seleccioná un plan antes de generar el link.");
      return;
    }
    setMpCheckoutLoading(true);
    setMpCheckoutError("");
    setMpCheckoutUrl(null);
    try {
      const res = await fetch("/api/admin/payments/asignar-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: mpPlanSeleccionado,
          alumnoEmail: email,
          modo: "con_pago_mp",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; checkoutUrl?: string; message?: string };
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.message || "No se pudo generar el link de pago MP.");
      }
      setMpCheckoutUrl(data.checkoutUrl);
    } catch (err) {
      setMpCheckoutError(err instanceof Error ? err.message : "Error al generar link de pago MP.");
    } finally {
      setMpCheckoutLoading(false);
    }
  };

  // Resetear estado de edición de nutrición al cambiar de cliente
  useEffect(() => {
    setNutritionEditMode(false);
    setNutritionGramEdit(null);
    setNutritionAddFoodMealId(null);
    setHasUnsavedNutritionChanges(false);
    setNutritionWizard(null);
    setMpCheckoutUrl(null);
    setMpCheckoutError("");
    setMpPlanSeleccionado("");
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedClient) return;
    fetch(`/api/etiquetas?userId=${selectedClient.id.split(":")[1]}`)
      .then((res) => res.json())
      .then((data: Etiqueta[]) => {
        setEtiquetas(data || []);
        setEtiquetasByUserId((prev) => ({
          ...prev,
          [selectedClient.id.split(":")[1]]: data || [],
        }));
      });
  }, [selectedClient]);

  const sesionesPorCliente = useMemo(() => {
    const result: Record<string, number> = {};

    for (const cliente of clientes) {
      const count = sesiones.filter((sesion) => {
        if (cliente.tipo === "jugadora") {
          const porCategoria =
            sesion.asignacionTipo === "jugadoras" &&
            (sesion.categoriaAsignada || "") === (cliente.categoria || "");
          const porNombre =
            sesion.asignacionTipo === "jugadoras" &&
            (sesion.jugadoraAsignada || "") === cliente.nombre;
          return porCategoria || porNombre;
        }

        return (
          sesion.asignacionTipo === "alumnos" &&
          (sesion.alumnoAsignado || "") === cliente.nombre
        );
      }).length;

      result[cliente.id] = count;
    }

    return result;
  }, [clientes, sesiones]);

  const clientesFiltrados = useMemo(() => {
    const query = search.trim().toLowerCase();
    const clubQuery = filtroClub.trim().toLowerCase();
    const etiquetaQuery = normalizePersonKey(etiquetaSearch);

    const base = clientes
      .filter((cliente) => cliente.estado === vista)
      .filter((cliente) => (filtroTipo === "todos" ? true : cliente.tipo === filtroTipo))
      .filter((cliente) =>
        filtroCategoria === "todas" ? true : (cliente.categoria || "") === filtroCategoria
      )
      .filter((cliente) =>
        filtroDeporte === "todos" ? true : (cliente.deporte || "") === filtroDeporte
      )
      .filter((cliente) => (clubQuery ? (cliente.club || "").toLowerCase().includes(clubQuery) : true))
      .filter((cliente) => {
        const sesionesClienteCount = sesionesPorCliente[cliente.id] || 0;
        const hasTrainingPlan = sesionesClienteCount > 0;
        const hasNutritionPlan = Boolean(nutritionPlanStatusByClientId.get(cliente.id)?.hasPlan);

        if (filtroPlan === "con-plan") return hasTrainingPlan || hasNutritionPlan;
        if (filtroPlan === "sin-plan") return !hasTrainingPlan && !hasNutritionPlan;
        if (filtroPlan === "con-plan-entrenamiento") return hasTrainingPlan;
        if (filtroPlan === "con-plan-nutricional") return hasNutritionPlan;
        if (filtroPlan === "sin-plan-nutricional") return !hasNutritionPlan;
        return true;
      })
      .filter((cliente) => {
        if (!query) return true;
        return (
          cliente.nombre.toLowerCase().includes(query) ||
          (cliente.club || "").toLowerCase().includes(query) ||
          (cliente.categoria || "").toLowerCase().includes(query)
        );
      })
      .filter((cliente) => {
        if (!etiquetaQuery) return true;
        const userId = cliente.id.split(":")[1];
        const etiquetasCliente = etiquetasByUserId[userId] || [];
        return etiquetasCliente.some((tag) => normalizePersonKey(tag.texto).includes(etiquetaQuery));
      });

    return base
      .filter((cliente) => {
        const sesionesClienteCount = sesionesPorCliente[cliente.id] || 0;
        const hasTrainingPlan = sesionesClienteCount > 0;
        const hasNutritionPlan = Boolean(nutritionPlanStatusByClientId.get(cliente.id)?.hasPlan);

        if (filtroPlan === "con-plan") return hasTrainingPlan || hasNutritionPlan;
        if (filtroPlan === "sin-plan") return !hasTrainingPlan && !hasNutritionPlan;
        if (filtroPlan === "con-plan-entrenamiento") return hasTrainingPlan;
        if (filtroPlan === "con-plan-nutricional") return hasNutritionPlan;
        if (filtroPlan === "sin-plan-nutricional") return !hasNutritionPlan;
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [
    clientes,
    etiquetaSearch,
    etiquetasByUserId,
    filtroCategoria,
    filtroClub,
    filtroDeporte,
    filtroPlan,
    filtroTipo,
    search,
    nutritionPlanStatusByClientId,
    sesionesPorCliente,
    vista,
  ]);

  const presenceEmails = useMemo(() => {
    const source = isDetailMode
      ? selectedClient
        ? [selectedClient]
        : []
      : clientesFiltrados;

    return Array.from(
      new Set(
        source
          .map((cliente) => normalizePresenceEmail(clientesMeta[cliente.id]?.email))
          .filter(Boolean)
      )
    ).slice(0, 180);
  }, [clientesFiltrados, clientesMeta, isDetailMode, selectedClient]);

  const presenceEmailParam = useMemo(
    () => presenceEmails.map((email) => encodeURIComponent(email)).join(","),
    [presenceEmails]
  );

  const planStatusSummary = useMemo(() => {
    const query = search.trim().toLowerCase();
    const clubQuery = filtroClub.trim().toLowerCase();
    const etiquetaQuery = normalizePersonKey(etiquetaSearch);

    const base = clientes
      .filter((cliente) => cliente.estado === vista)
      .filter((cliente) => (filtroTipo === "todos" ? true : cliente.tipo === filtroTipo))
      .filter((cliente) =>
        filtroCategoria === "todas" ? true : (cliente.categoria || "") === filtroCategoria
      )
      .filter((cliente) =>
        filtroDeporte === "todos" ? true : (cliente.deporte || "") === filtroDeporte
      )
      .filter((cliente) =>
        clubQuery ? (cliente.club || "").toLowerCase().includes(clubQuery) : true
      )
      .filter((cliente) => {
        if (!query) return true;
        return (
          cliente.nombre.toLowerCase().includes(query) ||
          (cliente.club || "").toLowerCase().includes(query) ||
          (cliente.categoria || "").toLowerCase().includes(query)
        );
      })
      .filter((cliente) => {
        if (!etiquetaQuery) return true;
        const userId = cliente.id.split(":")[1];
        const etiquetasCliente = etiquetasByUserId[userId] || [];
        return etiquetasCliente.some((tag) => normalizePersonKey(tag.texto).includes(etiquetaQuery));
      });

    let conPlan = 0;
    let sinPlan = 0;
    let conEntrenamiento = 0;
    let conNutricional = 0;
    let sinNutricional = 0;

    for (const cliente of base) {
      const hasTrainingPlan = (sesionesPorCliente[cliente.id] || 0) > 0;
      const hasNutritionPlan = Boolean(nutritionPlanStatusByClientId.get(cliente.id)?.hasPlan);
      if (hasTrainingPlan || hasNutritionPlan) conPlan += 1;
      if (!hasTrainingPlan && !hasNutritionPlan) sinPlan += 1;
      if (hasTrainingPlan) conEntrenamiento += 1;
      if (hasNutritionPlan) conNutricional += 1;
      if (!hasNutritionPlan) sinNutricional += 1;
    }

    return {
      total: base.length,
      conPlan,
      sinPlan,
      conEntrenamiento,
      conNutricional,
      sinNutricional,
    };
  }, [
    clientes,
    etiquetaSearch,
    etiquetasByUserId,
    filtroCategoria,
    filtroClub,
    filtroDeporte,
    filtroTipo,
    nutritionPlanStatusByClientId,
    search,
    sesionesPorCliente,
    vista,
  ]);

  const presenceSummary = useMemo(() => {
    let online = 0;
    let withLastSeen = 0;

    for (const cliente of clientesFiltrados) {
      const email = normalizePresenceEmail(clientesMeta[cliente.id]?.email);
      if (!email) continue;

      const snapshot = presenceByEmail[email];
      if (snapshot?.isOnline) {
        online += 1;
      }
      if (snapshot?.lastSeenAt) {
        withLastSeen += 1;
      }
    }

    return { online, withLastSeen };
  }, [clientesFiltrados, clientesMeta, presenceByEmail]);

  useEffect(() => {
    const missingUserIds = clientesFiltrados
      .map((cliente) => cliente.id.split(":")[1])
      .filter((userId) => !etiquetasByUserId[userId]);

    if (missingUserIds.length === 0) return;

    Promise.all(
      missingUserIds.map(async (userId) => {
        const res = await fetch(`/api/etiquetas?userId=${userId}`);
        if (!res.ok) {
          return { userId, etiquetas: [] as Etiqueta[] };
        }
        const data = (await res.json()) as Etiqueta[];
        return { userId, etiquetas: data || [] };
      })
    ).then((rows) => {
      setEtiquetasByUserId((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          next[row.userId] = row.etiquetas;
        }
        return next;
      });
    });
  }, [clientesFiltrados, etiquetasByUserId]);

  useEffect(() => {
    if (!presenceEmailParam) {
      setPresenceByEmail({});
      return;
    }

    let cancelled = false;

    const syncPresence = async () => {
      try {
        const response = await fetch(
          `/api/presence?emails=${presenceEmailParam}&includeCurrent=0`,
          { cache: "no-store" }
        );

        if (!response.ok || cancelled) return;

        const data = (await response.json()) as {
          byEmail?: Record<string, PresenceSnapshot>;
        };

        const normalized: Record<string, PresenceSnapshot> = {};
        for (const [rawEmail, snapshot] of Object.entries(data.byEmail || {})) {
          const key = normalizePresenceEmail(rawEmail || snapshot?.email);
          if (key) {
            normalized[key] = snapshot;
          }
        }

        if (!cancelled) {
          setPresenceByEmail(normalized);
        }
      } catch {
        // Mantiene el ultimo snapshot valido cuando hay un error temporal de red.
      }
    };

    void syncPresence();
    const intervalId = window.setInterval(() => {
      void syncPresence();
    }, PRESENCE_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [presenceEmailParam]);

  const selectedMeta = useMemo(() => {
    if (!selectedClient) return null;
    return {
      ...defaultMeta(selectedClient),
      ...(clientesMeta[selectedClient.id] || {}),
    };
  }, [clientesMeta, selectedClient]);

  const weekStore = useMemo(() => normalizeWeekStore(weekStoreRaw), [weekStoreRaw]);

  const aiTrainingPlans = useMemo<StoredAITrainingPlanLite[]>(() => {
    const rows = Array.isArray(aiTrainingPlansRaw) ? aiTrainingPlansRaw : [];
    return rows
      .filter((item) => item && item.id && item.plan)
      .slice()
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [aiTrainingPlansRaw]);

  const templatesAlumnos = useMemo<WeekPlanTemplate[]>(
    () => (weekStore.templates || []).filter((t) => t.tipo === "alumnos"),
    [weekStore.templates]
  );

  const normalizeAssignText = (value: string) =>
    (value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const assignPlanItems = useMemo(() => {
    const q = normalizeAssignText(assignPlanSearch);

    type AssignItem = {
      optionId: string;
      source: "template" | "ia";
      nombre: string;
      categoria?: string;
      deporte?: string;
      totalSemanas: number;
      searchText: string;
    };

    const templateItems: AssignItem[] = templatesAlumnos.map((t) => ({
      optionId: `template:${t.id}`,
      source: "template" as const,
      nombre: t.nombre,
      categoria: t.categoria,
      totalSemanas: (t.semanas || []).length,
      searchText: normalizeAssignText(`${t.nombre} ${t.categoria || ""}`),
    }));

    const aiItems: AssignItem[] = aiTrainingPlans.map((p) => ({
      optionId: `ai:${p.id}`,
      source: "ia" as const,
      nombre: p.nombre,
      categoria: p.plan?.category,
      deporte: p.plan?.sport,
      totalSemanas: Array.isArray(p.plan?.weeks) ? p.plan.weeks.length : 0,
      searchText: normalizeAssignText(`${p.nombre} ${p.plan?.category || ""} ${p.plan?.sport || ""}`),
    }));

    return [...templateItems, ...aiItems].filter((item) => {
      if (assignPlanFilter !== "todos" && item.source !== assignPlanFilter) return false;
      if (q) return item.searchText.includes(q);
      return true;
    });
  }, [templatesAlumnos, aiTrainingPlans, assignPlanSearch, assignPlanFilter]);

  const selectedClientTrainingPlan = useMemo(() => {
    if (!selectedClient) return null;

    const tipo = toPlanPersonaTipo(selectedClient.tipo);
    const ownerKey = buildTrainingOwnerKey(tipo, selectedClient.nombre);
    const exact = weekStore.planes.find((plan) => plan.ownerKey === ownerKey) || null;
    if (exact) {
      return exact;
    }

    return (
      weekStore.planes.find(
        (plan) =>
          plan.tipo === tipo &&
          (namesLikelyMatch(plan.nombre, selectedClient.nombre) ||
            namesLikelyMatch(plan.ownerKey.split(":")[1] || "", selectedClient.nombre))
      ) || null
    );
  }, [selectedClient, weekStore.planes]);

  const syncTrainingPlanWithAlumnoProfile = () => {
    if (!selectedClient || !selectedClientTrainingPlan) return;

    const selectedTipo = toPlanPersonaTipo(selectedClient.tipo);
    const selectedOwnerKey = buildTrainingOwnerKey(selectedTipo, selectedClient.nombre);

    markManualSaveIntent(WEEK_PLAN_KEY);
    setHasUnsavedTrainingChanges(false);

    setWeekStoreRaw((prev) => {
      const base = normalizeWeekStore(prev);
      const planIndex = base.planes.findIndex(
        (plan) =>
          plan.ownerKey === selectedClientTrainingPlan.ownerKey ||
          plan.ownerKey === selectedOwnerKey ||
          (plan.tipo === selectedTipo && namesLikelyMatch(plan.nombre, selectedClient.nombre))
      );

      if (planIndex < 0) {
        return base;
      }

      const nextPlanes = [...base.planes];
      const currentPlan = nextPlanes[planIndex];

      nextPlanes[planIndex] = {
        ...currentPlan,
        ownerKey: selectedOwnerKey,
        tipo: selectedTipo,
        nombre: selectedClient.nombre,
        categoria: selectedClient.categoria,
      };

      return {
        ...base,
        version: 3,
        planes: nextPlanes,
      };
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pf-inline-toast", {
          detail: {
            type: "success",
            message: "Plan sincronizado con el perfil del alumno.",
          },
        })
      );
    }
  };

  // ── Guardar plan del alumno como template reutilizable ────────────────────
  const saveTrainingPlanAsTemplate = (templateName: string) => {
    if (!selectedClient || !selectedClientTrainingPlan) return;
    const trimmedName = templateName.trim();
    if (!trimmedName) return;

    const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

    const newTemplate: WeekPlanTemplate = {
      id:       `tmpl-${uid()}`,
      nombre:   trimmedName,
      tipo:     selectedClientTrainingPlan.tipo || "alumnos",
      categoria: selectedClientTrainingPlan.categoria,
      semanas:  selectedClientTrainingPlan.semanas.map((sem) => ({
        ...sem,
        id: `s-${uid()}`,
        dias: (sem.dias || []).map((dia) => ({
          ...dia,
          id: `d-${uid()}`,
        })),
      })),
    };

    setWeekStoreRaw((prev) => {
      const base = normalizeWeekStore(prev);
      return {
        ...base,
        version: 3,
        templates: [...(base.templates || []), newTemplate],
      };
    });

    setSaveAsTemplateModal(null);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pf-inline-toast", {
        detail: { type: "success", message: `Template "${trimmedName}" guardado en la categoría de templates.` },
      }));
    }
  };

  const reloadTrainingPlanOnly = async () => {
    if (trainingPlanReloading) return;

    try {
      setTrainingPlanReloading(true);

      const response = await fetch(`/api/sync/${encodeURIComponent(WEEK_PLAN_KEY)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("sync read failed");
      }

      const payload = (await response.json()) as { value?: unknown };
      setWeekStoreRaw(normalizeWeekStore(payload?.value));
      emitTrainingStructureToast(
        "success",
        "Plan recargado sin refrescar la pagina completa."
      );
    } catch {
      emitTrainingStructureToast(
        "error",
        "No se pudo recargar el plan ahora. Vuelve a intentarlo."
      );
    } finally {
      setTrainingPlanReloading(false);
    }
  };

  const allTrainingWeeks = useMemo(
    () => orderWeeksByVisibility(selectedClientTrainingPlan?.semanas || []),
    [selectedClientTrainingPlan?.semanas]
  );

  const visibleTrainingWeeks = useMemo(
    () => allTrainingWeeks.filter((week) => !week.oculto),
    [allTrainingWeeks]
  );

  const hiddenTrainingWeeks = useMemo(
    () => allTrainingWeeks.filter((week) => Boolean(week.oculto)),
    [allTrainingWeeks]
  );

  const selectedTrainingWeek = useMemo(
    () => visibleTrainingWeeks.find((week) => week.id === trainingPreviewWeekId) || null,
    [trainingPreviewWeekId, visibleTrainingWeeks]
  );

  const allTrainingDays = useMemo(
    () => orderDaysByVisibility(selectedTrainingWeek?.dias || []),
    [selectedTrainingWeek]
  );

  const visibleTrainingDays = useMemo(
    () => allTrainingDays.filter((day) => !day.oculto),
    [allTrainingDays]
  );

  const hiddenTrainingDays = useMemo(
    () => allTrainingDays.filter((day) => Boolean(day.oculto)),
    [allTrainingDays]
  );

  const selectedTrainingDay = useMemo(
    () => visibleTrainingDays.find((day) => day.id === trainingPreviewDayId) || null,
    [trainingPreviewDayId, visibleTrainingDays]
  );

  const selectedTrainingDayBlocks = useMemo(() => {
    if (!selectedTrainingDay) return [];

    return normalizeTrainingBlocksForEditing(selectedTrainingDay.entrenamiento?.bloques || []);
  }, [selectedTrainingDay]);

  const selectedTrainingDayFeedbackConfig = useMemo(
    () => sanitizePostSessionFeedbackConfig(selectedTrainingDay?.postSesionFeedback),
    [selectedTrainingDay?.postSesionFeedback]
  );

  const selectedTrainingDayFeedbackQuestions =
    selectedTrainingDayFeedbackConfig?.questions || [];

  const selectedTrainingDayBlockSummary = useMemo(
    () => selectedTrainingDayBlocks.reduce((acc, block) => acc + (block.ejercicios || []).length, 0),
    [selectedTrainingDayBlocks]
  );

  const workoutLogs = useMemo(() => normalizeWorkoutLogs(workoutLogsRaw), [workoutLogsRaw]);

  const selectedClientWorkoutLogs = useMemo(() => {
    if (!selectedClient) return [];

    const selectedClientEmail = String(clientesMeta[selectedClient.id]?.email || "")
      .trim()
      .toLowerCase();

    return workoutLogs.filter((item) => {
      const byName = namesLikelyMatch(item.alumnoNombre, selectedClient.nombre);
      const byEmail =
        Boolean(selectedClientEmail) &&
        Boolean(item.alumnoEmail) &&
        String(item.alumnoEmail).trim().toLowerCase() === selectedClientEmail;

      return byName || byEmail;
    });
  }, [clientesMeta, selectedClient, workoutLogs]);

  const selectedExerciseWorkoutLogs = useMemo(() => {
    if (!trainingExercisePanelTarget) return [];

    return selectedClientWorkoutLogs.filter((item) => {
      const matchesExerciseId =
        Boolean(trainingExercisePanelTarget.exerciseId) &&
        Boolean(item.exerciseId) &&
        item.exerciseId === trainingExercisePanelTarget.exerciseId;
      const matchesExerciseName = namesLikelyMatch(
        item.exerciseName || "",
        trainingExercisePanelTarget.exerciseName
      );
      const matchesDay =
        !trainingExercisePanelTarget.dayId || !item.dayId || item.dayId === trainingExercisePanelTarget.dayId;

      return (matchesExerciseId || matchesExerciseName) && matchesDay;
    });
  }, [selectedClientWorkoutLogs, trainingExercisePanelTarget]);

  const selectedExerciseTopWeight = useMemo(
    () => selectedExerciseWorkoutLogs.reduce((max, item) => Math.max(max, Number(item.pesoKg) || 0), 0),
    [selectedExerciseWorkoutLogs]
  );

  // Build a per-exercise latest-session summary so each row can show its load history
  // inline above the editor (with detailed tooltip on hover).
  type LatestSessionSet = { peso: number; reps: number; molestia: boolean };
  type LatestSessionSummary = {
    fecha: string;
    fechaDate: Date | null;
    seriesCount: number;
    totalReps: number;
    topWeight: number;
    volume: number;
    molestia: boolean;
    sets: LatestSessionSet[];
  };

  const latestSessionByExerciseKey = useMemo(() => {
    const map = new Map<string, LatestSessionSummary>();
    if (!selectedClientWorkoutLogs.length) return map;

    // Group logs by exerciseKey + fecha (so same-day sets cluster as one session)
    type Bucket = { records: WorkoutLogRecord[]; fechaTime: number };
    const grouped = new Map<string, Map<string, Bucket>>();

    for (const record of selectedClientWorkoutLogs) {
      const idKey = String(record.exerciseId || "").trim();
      const nameKey = String(record.exerciseName || "").trim().toLowerCase();
      const keys = [idKey, nameKey].filter(Boolean);
      const fecha = String(record.fecha || "").trim();
      if (!fecha) continue;
      const fechaTime = new Date(fecha).getTime() || 0;

      for (const key of keys) {
        if (!grouped.has(key)) grouped.set(key, new Map());
        const inner = grouped.get(key)!;
        const fechaStr = fecha.slice(0, 10);
        if (!inner.has(fechaStr)) inner.set(fechaStr, { records: [], fechaTime });
        inner.get(fechaStr)!.records.push(record);
        inner.get(fechaStr)!.fechaTime = Math.max(inner.get(fechaStr)!.fechaTime, fechaTime);
      }
    }

    for (const [key, dateMap] of grouped) {
      let latestKey = "";
      let latestTime = -1;
      for (const [dateStr, bucket] of dateMap) {
        if (bucket.fechaTime > latestTime) {
          latestTime = bucket.fechaTime;
          latestKey = dateStr;
        }
      }
      const bucket = dateMap.get(latestKey);
      if (!bucket) continue;

      const sets: LatestSessionSet[] = bucket.records.map((r) => ({
        peso: Number(r.pesoKg) || 0,
        reps: Number(r.repeticiones) || 0,
        molestia: Boolean(r.molestia),
      }));
      const seriesCount = sets.length;
      const totalReps = sets.reduce((acc, s) => acc + s.reps, 0);
      const topWeight = sets.reduce((acc, s) => Math.max(acc, s.peso), 0);
      const volume = sets.reduce((acc, s) => acc + s.peso * s.reps, 0);
      const molestia = sets.some((s) => s.molestia);
      const fechaDate = new Date(latestKey);

      map.set(key, {
        fecha: latestKey,
        fechaDate: isNaN(fechaDate.getTime()) ? null : fechaDate,
        seriesCount,
        totalReps,
        topWeight,
        volume,
        molestia,
        sets,
      });
    }

    return map;
  }, [selectedClientWorkoutLogs]);

  const formatLatestSessionRelative = useCallback((d: Date | null) => {
    if (!d) return "";
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "hoy";
    if (diffDays === 1) return "hace 1 día";
    if (diffDays < 30) return `hace ${diffDays} días`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return "hace 1 mes";
    return `hace ${diffMonths} meses`;
  }, []);

  const formatLatestSessionDate = useCallback((d: Date | null, fallback: string) => {
    if (!d) return fallback;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }, []);

  useEffect(() => {
    setTrainingExercisePanelMode(null);
    setTrainingExercisePanelTarget(null);
    setTrainingRecordStatus("");
    setTrainingWeekInlineEdit(null);
    setTrainingDayInlineEdit(null);
    setTrainingStructureMenu(null);
    setTrainingBlockMenu(null);
    setTrainingBlockGridConfigOpenId(null);
  }, [selectedClient?.id, trainingPreviewWeekId, trainingPreviewDayId]);

  useEffect(() => {
    if (!trainingStructureMenu) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      // "Dentro" = el wrapper con el boton ⋯ o el panel portaleado en body.
      if (trainingStructureMenuRef.current && trainingStructureMenuRef.current.contains(target)) {
        return;
      }
      if (trainingStructureMenuPanelRef.current && trainingStructureMenuPanelRef.current.contains(target)) {
        return;
      }

      setTrainingStructureMenu(null);
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [trainingStructureMenu]);

  useEffect(() => {
    if (!trainingBlockMenu) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (trainingBlockMenuRef.current && trainingBlockMenuRef.current.contains(target)) {
        return;
      }
      if (trainingBlockMenuPanelRef.current && trainingBlockMenuPanelRef.current.contains(target)) {
        return;
      }

      setTrainingBlockMenu(null);
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [trainingBlockMenu]);

  const canEditTrainingPlan = isAdmin && Boolean(selectedClient);

  const upsertSelectedClientTrainingPlan = (
    updater: (current: WeekPersonPlanLite) => WeekPersonPlanLite
  ) => {
    if (!selectedClient) return;

    const selectedTipo = toPlanPersonaTipo(selectedClient.tipo);
    const selectedOwnerKey = buildTrainingOwnerKey(selectedTipo, selectedClient.nombre);
    setHasUnsavedTrainingChanges(true);
    setWeekStoreRaw((prev) => {
      const base = normalizeWeekStore(prev);
      const planes = [...base.planes];
      const planIndex = planes.findIndex(
        (plan) =>
          plan.ownerKey === selectedOwnerKey ||
          plan.ownerKey === selectedClientTrainingPlan?.ownerKey ||
          (plan.tipo === selectedTipo && namesLikelyMatch(plan.nombre, selectedClient.nombre))
      );

      const currentPlan =
        planIndex >= 0 ? planes[planIndex] : createDefaultClientTrainingPlan(selectedClient);

      const nextPlanRaw = updater({
        ...currentPlan,
        ownerKey: selectedOwnerKey,
        tipo: selectedTipo,
        nombre: selectedClient.nombre,
        categoria: selectedClient.categoria,
        semanas:
          Array.isArray(currentPlan.semanas) && currentPlan.semanas.length > 0
            ? currentPlan.semanas
            : [createDefaultTrainingWeek(0)],
      });

      const nextPlan: WeekPersonPlanLite = {
        ...nextPlanRaw,
        ownerKey: selectedOwnerKey,
        tipo: selectedTipo,
        nombre: selectedClient.nombre,
        categoria: selectedClient.categoria,
        semanas:
          Array.isArray(nextPlanRaw.semanas) && nextPlanRaw.semanas.length > 0
            ? nextPlanRaw.semanas
            : [createDefaultTrainingWeek(0)],
      };

      if (planIndex >= 0) {
        planes[planIndex] = nextPlan;
      } else {
        planes.push(nextPlan);
      }

      return {
        ...base,
        version: 3,
        planes,
      };
    });
  };

  const updateTrainingWeekField = (
    weekId: string,
    field: "nombre" | "objetivo",
    value: string
  ) => {
    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) =>
        week.id === weekId
          ? {
              ...week,
              [field]: value,
            }
          : week
      ),
    }));
  };

  const isTrainingStructureActionBlocked = (actionKey: string) => {
    const now = Date.now();
    const lastActionAt = trainingActionCooldownRef.current[actionKey] || 0;
    if (now - lastActionAt < TRAINING_STRUCTURE_ACTION_COOLDOWN_MS) {
      return true;
    }

    trainingActionCooldownRef.current[actionKey] = now;
    return false;
  };

  const selectTrainingPreviewWeek = (weekId: string) => {
    const targetWeek = (selectedClientTrainingPlan?.semanas || []).find((week) => week.id === weekId);
    if (!targetWeek) return;

    const targetDays = (targetWeek.dias || []).filter((day) => !day.oculto);
    const fallbackDayId = targetDays[0]?.id || "";

    setTrainingPreviewWeekId(targetWeek.id);
    setTrainingPreviewDayId((currentDayId) =>
      targetDays.some((day) => day.id === currentDayId) ? currentDayId : fallbackDayId
    );
  };

  const selectTrainingPreviewDay = (dayId: string) => {
    setTrainingPreviewDayId(dayId);
  };

  const startTrainingWeekInlineEdit = (weekId: string, currentValue: string) => {
    setTrainingWeekInlineEdit({
      weekId,
      value: currentValue,
    });
  };

  const commitTrainingWeekInlineEdit = () => {
    if (!trainingWeekInlineEdit) return;

    const nextName = trainingWeekInlineEdit.value.trim() || "Semana";
    updateTrainingWeekField(trainingWeekInlineEdit.weekId, "nombre", nextName);
    setTrainingWeekInlineEdit(null);
  };

  const startTrainingDayInlineEdit = (weekId: string, dayId: string, currentValue: string) => {
    setTrainingDayInlineEdit({
      weekId,
      dayId,
      value: currentValue,
    });
  };

  const commitTrainingDayInlineEdit = () => {
    if (!trainingDayInlineEdit) return;

    const nextName = trainingDayInlineEdit.value.trim() || "Dia";
    updateTrainingDayField(trainingDayInlineEdit.weekId, trainingDayInlineEdit.dayId, "dia", nextName);
    setTrainingDayInlineEdit(null);
  };

  const emitTrainingStructureToast = (
    type: "success" | "warning" | "error",
    message: string
  ) => {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("pf-inline-toast", {
        detail: {
          type,
          message,
        },
      })
    );
  };

  // Calcula la posicion fija del menu contextual relativa al boton que lo abre.
  // Prefiere que el menu se abra hacia la derecha del boton (borde izq del menu =
  // borde izq del boton), porque los botones suelen estar pegados a la izquierda.
  // Si no cabe por la derecha, lo alinea por la derecha del boton (se abre hacia
  // la izquierda) clampeado dentro de la pantalla.
  const calcMenuAnchor = (el: HTMLElement): { top: number; left?: number; right?: number } => {
    const rect = el.getBoundingClientRect();
    const MENU_W = 232; // min-w-[220px] + bordes + padding
    const GAP    = 8;
    const PAD    = 6;
    const top    = rect.bottom + GAP;
    // ¿Cabe alineado a la izquierda (menu se extiende hacia la derecha)?
    if (rect.left + MENU_W <= window.innerWidth - PAD) {
      return { top, left: rect.left };
    }
    // Si no cabe, alinear por la derecha del boton clampeado
    return { top, right: Math.max(PAD, window.innerWidth - rect.right) };
  };

  const toggleTrainingWeekMenu = (weekId: string, e?: React.MouseEvent) => {
    if (e) setMenuAnchorRect(calcMenuAnchor(e.currentTarget as HTMLElement));
    setTrainingBlockMenu(null);
    setTrainingStructureMenu((prev) =>
      prev?.type === "week" && prev.weekId === weekId
        ? null
        : { type: "week", weekId }
    );
  };

  const toggleTrainingDayMenu = (weekId: string, dayId: string, e?: React.MouseEvent) => {
    if (e) setMenuAnchorRect(calcMenuAnchor(e.currentTarget as HTMLElement));
    setTrainingBlockMenu(null);
    setTrainingStructureMenu((prev) =>
      prev?.type === "day" && prev.weekId === weekId && prev.dayId === dayId
        ? null
        : { type: "day", weekId, dayId }
    );
  };

  const toggleTrainingBlockMenu = (weekId: string, dayId: string, blockId: string, e?: React.MouseEvent) => {
    if (e) setMenuAnchorRect(calcMenuAnchor(e.currentTarget as HTMLElement));
    setTrainingStructureMenu(null);
    setTrainingBlockMenu((prev) =>
      prev?.weekId === weekId && prev.dayId === dayId && prev.blockId === blockId
        ? null
        : { weekId, dayId, blockId }
    );
  };

  const focusTrainingBlockTitleInput = (weekId: string, dayId: string, blockId: string) => {
    setTrainingBlockEditingId(blockId);
    setTrainingBlockMenu(null);

    if (typeof window !== "undefined") {
      // Wait for the input to mount, then focus + select.
      setTimeout(() => {
        const targetId = `training-block-title-${weekId}-${dayId}-${blockId}`;
        const input = document.getElementById(targetId) as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
      }, 30);
    }
  };

  const addTrainingWeek = () => {
    if (isTrainingStructureActionBlocked("add-week")) {
      return;
    }

    const nextWeek = createDefaultTrainingWeek((selectedClientTrainingPlan?.semanas || []).length);

    upsertSelectedClientTrainingPlan((plan) => {
      return {
        ...plan,
        semanas: orderWeeksByVisibility([...plan.semanas, nextWeek]),
      };
    });

    setTrainingPreviewWeekId(nextWeek.id);
    setTrainingPreviewDayId(nextWeek.dias?.[0]?.id || "");
  };

  const removeTrainingWeek = (weekId: string) => {
    upsertSelectedClientTrainingPlan((plan) => {
      const remaining = plan.semanas.filter((week) => week.id !== weekId);
      return {
        ...plan,
        semanas: remaining.length > 0 ? remaining : [createDefaultTrainingWeek(0)],
      };
    });
  };

  const updateTrainingDayField = (
    weekId: string,
    dayId: string,
    field: "dia" | "planificacion" | "objetivo",
    value: string
  ) => {
    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;

        return {
          ...week,
          dias: week.dias.map((day) =>
            day.id === dayId
              ? {
                  ...day,
                  [field]: value,
                }
              : day
          ),
        };
      }),
    }));
  };

  const updateTrainingDayPostSessionFeedback = (
    weekId: string,
    dayId: string,
    updater: (feedback: PostSessionFeedbackConfigLite) => PostSessionFeedbackConfigLite
  ) => {
    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;

        return {
          ...week,
          dias: week.dias.map((day) => {
            if (day.id !== dayId) return day;

            const currentFeedback =
              sanitizePostSessionFeedbackConfig(day.postSesionFeedback) ||
              createDefaultPostSessionFeedbackConfig();
            const nextFeedback = sanitizePostSessionFeedbackConfig(updater(currentFeedback));

            return {
              ...day,
              postSesionFeedback: nextFeedback,
            };
          }),
        };
      }),
    }));
  };

  const toggleTrainingDayPostSessionFeedbackEnabled = (
    weekId: string,
    dayId: string,
    enabled: boolean
  ) => {
    updateTrainingDayPostSessionFeedback(weekId, dayId, (feedback) => ({
      ...feedback,
      enabled,
      title: feedback.title || "Feedback post sesion",
      questions:
        enabled && feedback.questions.length === 0
          ? [createDefaultPostSessionFeedbackQuestion(0)]
          : feedback.questions,
    }));
  };

  const updateTrainingDayPostSessionFeedbackTitle = (
    weekId: string,
    dayId: string,
    value: string
  ) => {
    updateTrainingDayPostSessionFeedback(weekId, dayId, (feedback) => ({
      ...feedback,
      title: value,
    }));
  };

  const applyTrainingDayPostSessionFeedbackMeasurements = (
    weekId: string,
    dayId: string,
    measurements: PostSessionMeasurementLite[],
    maxPerDay: number | undefined,
    title: string | undefined
  ) => {
    markManualSaveIntent(WEEK_PLAN_KEY);
    updateTrainingDayPostSessionFeedback(weekId, dayId, (feedback) => ({
      ...feedback,
      enabled: true,
      title: title?.trim() || feedback.title || "Feedback post sesion",
      measurements,
      maxPerDay,
    }));
  };

  const addTrainingDayPostSessionFeedbackQuestion = (weekId: string, dayId: string) => {
    updateTrainingDayPostSessionFeedback(weekId, dayId, (feedback) => ({
      ...feedback,
      enabled: true,
      questions: [...feedback.questions, createDefaultPostSessionFeedbackQuestion(feedback.questions.length)],
    }));
  };

  const removeTrainingDayPostSessionFeedbackQuestion = (
    weekId: string,
    dayId: string,
    questionId: string
  ) => {
    updateTrainingDayPostSessionFeedback(weekId, dayId, (feedback) => ({
      ...feedback,
      questions: feedback.questions.filter((question) => question.id !== questionId),
    }));
  };

  const updateTrainingDayPostSessionFeedbackQuestionPrompt = (
    weekId: string,
    dayId: string,
    questionId: string,
    value: string
  ) => {
    updateTrainingDayPostSessionFeedback(weekId, dayId, (feedback) => ({
      ...feedback,
      questions: feedback.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              prompt: value,
            }
          : question
      ),
    }));
  };

  const addTrainingDayPostSessionFeedbackOption = (
    weekId: string,
    dayId: string,
    questionId: string
  ) => {
    updateTrainingDayPostSessionFeedback(weekId, dayId, (feedback) => ({
      ...feedback,
      questions: feedback.questions.map((question) => {
        if (question.id !== questionId) return question;

        return {
          ...question,
          options: [
            ...question.options,
            {
              id: createTrainingEntityId("feedback-option"),
              label: `Opcion ${question.options.length + 1}`,
            },
          ],
        };
      }),
    }));
  };

  const updateTrainingDayPostSessionFeedbackOptionLabel = (
    weekId: string,
    dayId: string,
    questionId: string,
    optionId: string,
    value: string
  ) => {
    updateTrainingDayPostSessionFeedback(weekId, dayId, (feedback) => ({
      ...feedback,
      questions: feedback.questions.map((question) => {
        if (question.id !== questionId) return question;

        return {
          ...question,
          options: question.options.map((option) =>
            option.id === optionId
              ? {
                  ...option,
                  label: value,
                }
              : option
          ),
        };
      }),
    }));
  };

  const removeTrainingDayPostSessionFeedbackOption = (
    weekId: string,
    dayId: string,
    questionId: string,
    optionId: string
  ) => {
    updateTrainingDayPostSessionFeedback(weekId, dayId, (feedback) => ({
      ...feedback,
      questions: feedback.questions.map((question) => {
        if (question.id !== questionId) return question;
        if (question.options.length <= 2) return question;

        return {
          ...question,
          options: question.options.filter((option) => option.id !== optionId),
        };
      }),
    }));
  };

  const addTrainingDay = (weekId: string) => {
    if (isTrainingStructureActionBlocked(`add-day:${weekId}`)) {
      return;
    }

    const sourceWeek = (selectedClientTrainingPlan?.semanas || []).find((week) => week.id === weekId);
    const nextDay = createDefaultTrainingDay((sourceWeek?.dias || []).length);

    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          dias: orderDaysByVisibility([...week.dias, nextDay]),
        };
      }),
    }));

    setTrainingPreviewWeekId(weekId);
    setTrainingPreviewDayId(nextDay.id);
  };

  const removeTrainingDay = (weekId: string, dayId: string) => {
    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;
        const remainingDays = week.dias.filter((day) => day.id !== dayId);
        return {
          ...week,
          dias: remainingDays.length > 0 ? remainingDays : [createDefaultTrainingDay(0)],
        };
      }),
    }));
  };

  const moveTrainingWeek = (weekId: string, direction: -1 | 1) => {
    upsertSelectedClientTrainingPlan((plan) => {
      const orderedWeeks = orderWeeksByVisibility(plan.semanas);
      const targetWeek = orderedWeeks.find((week) => week.id === weekId);
      if (!targetWeek) {
        return plan;
      }

      const isHiddenTarget = Boolean(targetWeek.oculto);
      const visibleWeeks = orderedWeeks.filter((week) => !week.oculto);
      const hiddenWeeks = orderedWeeks.filter((week) => Boolean(week.oculto));
      const segment = isHiddenTarget ? hiddenWeeks : visibleWeeks;
      const fromIndex = segment.findIndex((week) => week.id === weekId);
      const toIndex = fromIndex + direction;

      if (fromIndex < 0 || toIndex < 0 || toIndex >= segment.length) {
        return {
          ...plan,
          semanas: orderedWeeks,
        };
      }

      const movedSegment = [...segment];
      const [movedWeek] = movedSegment.splice(fromIndex, 1);
      movedSegment.splice(toIndex, 0, movedWeek);

      const semanas = isHiddenTarget
        ? [...visibleWeeks, ...movedSegment]
        : [...movedSegment, ...hiddenWeeks];


      return {
        ...plan,
        semanas,
      };
    });

    setTrainingStructureMenu(null);
  };

  const duplicateTrainingWeek = (weekId: string) => {
    let duplicatedWeekId = "";
    let duplicatedDayId = "";

    upsertSelectedClientTrainingPlan((plan) => {
      const orderedWeeks = orderWeeksByVisibility(plan.semanas);
      const weekIndex = orderedWeeks.findIndex((week) => week.id === weekId);
      if (weekIndex < 0) return plan;

      const sourceWeek = orderedWeeks[weekIndex];
      const duplicatedWeek = cloneTrainingWeekForDuplicate(sourceWeek, weekIndex);
      duplicatedWeek.nombre = `${String(sourceWeek.nombre || `Semana ${weekIndex + 1}`).trim()} copia`;
      duplicatedWeekId = duplicatedWeek.id;
      duplicatedDayId = duplicatedWeek.dias[0]?.id || "";

      const semanas = [...orderedWeeks];
      semanas.splice(weekIndex + 1, 0, duplicatedWeek);

      return {
        ...plan,
        semanas: orderWeeksByVisibility(semanas),
      };
    });

    if (duplicatedWeekId) {
      setTrainingPreviewWeekId(duplicatedWeekId);
      setTrainingPreviewDayId(duplicatedDayId);
    }

    setTrainingStructureMenu(null);
  };

  const hideTrainingWeek = (weekId: string) => {
    const sourceWeeks = selectedClientTrainingPlan?.semanas || [];
    const visibleCount = sourceWeeks.filter((week) => !week.oculto).length;

    if (visibleCount <= 1) {
      emitTrainingStructureToast("warning", "Debe quedar al menos una semana visible.");
      return;
    }

    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: orderWeeksByVisibility(
        plan.semanas.map((week) =>
          week.id === weekId
            ? {
                ...week,
                oculto: true,
              }
            : week
        )
      ),
    }));

    if (trainingPreviewWeekId === weekId) {
      setTrainingPreviewWeekId("");
      setTrainingPreviewDayId("");
    }

    setTrainingStructureMenu(null);
  };

  const showTrainingWeek = (weekId: string) => {
    const sourceWeek = allTrainingWeeks.find((week) => week.id === weekId);
    const fallbackDayId =
      (sourceWeek?.dias || []).find((day) => !day.oculto)?.id || sourceWeek?.dias?.[0]?.id || "";

    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: orderWeeksByVisibility(
        plan.semanas.map((week) =>
          week.id === weekId
            ? {
                ...week,
                oculto: undefined,
              }
            : week
        )
      ),
    }));

    setTrainingPreviewWeekId(weekId);
    setTrainingPreviewDayId(fallbackDayId);
    setTrainingStructureMenu(null);
  };

  const moveTrainingDay = (weekId: string, dayId: string, direction: -1 | 1) => {
    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;

        const orderedDays = orderDaysByVisibility(week.dias);
        const targetDay = orderedDays.find((day) => day.id === dayId);
        if (!targetDay) {
          return {
            ...week,
            dias: orderedDays,
          };
        }

        const isHiddenTarget = Boolean(targetDay.oculto);
        const visibleDays = orderedDays.filter((day) => !day.oculto);
        const hiddenDays = orderedDays.filter((day) => Boolean(day.oculto));
        const segment = isHiddenTarget ? hiddenDays : visibleDays;
        const fromIndex = segment.findIndex((day) => day.id === dayId);
        const toIndex = fromIndex + direction;

        if (fromIndex < 0 || toIndex < 0 || toIndex >= segment.length) {
          return {
            ...week,
            dias: orderedDays,
          };
        }

        const movedSegment = [...segment];
        const [movedDay] = movedSegment.splice(fromIndex, 1);
        movedSegment.splice(toIndex, 0, movedDay);

        const dias = isHiddenTarget
          ? [...visibleDays, ...movedSegment]
          : [...movedSegment, ...hiddenDays];

        return {
          ...week,
          dias,
        };
      }),
    }));

    setTrainingStructureMenu(null);
  };

  const duplicateTrainingDay = (weekId: string, dayId: string) => {
    let duplicatedDayId = "";

    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;

        const orderedDays = orderDaysByVisibility(week.dias);
        const dayIndex = orderedDays.findIndex((day) => day.id === dayId);
        if (dayIndex < 0) return week;

        const sourceDay = orderedDays[dayIndex];
        const duplicatedDay = cloneTrainingDayForDuplicate(sourceDay, dayIndex);
        duplicatedDay.dia = `${String(sourceDay.dia || `Dia ${dayIndex + 1}`).trim()} copia`;
        duplicatedDayId = duplicatedDay.id;

        const dias = [...orderedDays];
        dias.splice(dayIndex + 1, 0, duplicatedDay);

        return {
          ...week,
          dias: orderDaysByVisibility(dias),
        };
      }),
    }));

    if (duplicatedDayId) {
      setTrainingPreviewWeekId(weekId);
      setTrainingPreviewDayId(duplicatedDayId);
    }

    setTrainingStructureMenu(null);
  };

  const hideTrainingDay = (weekId: string, dayId: string) => {
    const sourceWeek = (selectedClientTrainingPlan?.semanas || []).find((week) => week.id === weekId);
    const visibleCount = (sourceWeek?.dias || []).filter((day) => !day.oculto).length;

    if (visibleCount <= 1) {
      emitTrainingStructureToast("warning", "Debe quedar al menos un dia visible.");
      return;
    }

    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;

        return {
          ...week,
          dias: orderDaysByVisibility(
            week.dias.map((day) =>
              day.id === dayId
                ? {
                    ...day,
                    oculto: true,
                  }
                : day
            )
          ),
        };
      }),
    }));

    if (trainingPreviewDayId === dayId) {
      setTrainingPreviewDayId("");
    }

    setTrainingStructureMenu(null);
  };

  const showTrainingDay = (weekId: string, dayId: string) => {
    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;

        return {
          ...week,
          dias: orderDaysByVisibility(
            week.dias.map((day) =>
              day.id === dayId
                ? {
                    ...day,
                    oculto: undefined,
                  }
                : day
            )
          ),
        };
      }),
    }));

    setTrainingPreviewWeekId(weekId);
    setTrainingPreviewDayId(dayId);
    setTrainingStructureMenu(null);
  };

  const updateTrainingBlocks = (
    weekId: string,
    dayId: string,
    updater: (blocks: WeekBlockLite[]) => WeekBlockLite[]
  ) => {
    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;

        return {
          ...week,
          dias: week.dias.map((day) => {
            if (day.id !== dayId) return day;

            const sourceBlocks = normalizeTrainingBlocksForEditing(day.entrenamiento?.bloques || []);
            const nextBlocks = updater(sourceBlocks);

            return {
              ...day,
              entrenamiento: {
                bloques: nextBlocks,
              },
            };
          }),
        };
      }),
    }));
  };

  const addTrainingBlock = (weekId: string, dayId: string) => {
    updateTrainingBlocks(weekId, dayId, (blocks) => [
      ...blocks,
      {
        id: createTrainingEntityId("bloque"),
        titulo: `Bloque ${blocks.length + 1}`,
        objetivo: "",
        ejercicios: [],
      },
    ]);
  };

  const removeTrainingBlock = (weekId: string, dayId: string, blockId: string) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.filter((block) => block.id !== blockId)
    );

    setTrainingBlockGridConfigOpenId((current) => (current === blockId ? null : current));
  };

  const duplicateTrainingBlock = (weekId: string, dayId: string, blockId: string) => {
    updateTrainingBlocks(weekId, dayId, (blocks) => {
      const blockIndex = blocks.findIndex((block) => block.id === blockId);
      if (blockIndex < 0) {
        return blocks;
      }

      const sourceBlock = blocks[blockIndex];
      const duplicatedBlock = cloneTrainingBlockForDuplicate(sourceBlock, blockIndex);
      duplicatedBlock.titulo = `${String(sourceBlock.titulo || `Bloque ${blockIndex + 1}`).trim()} copia`;

      const nextBlocks = [...blocks];
      nextBlocks.splice(blockIndex + 1, 0, duplicatedBlock);
      return nextBlocks;
    });

    setTrainingBlockMenu(null);
  };

  const addTrainingBlockGridColumn = (weekId: string, dayId: string, blockId: string) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        const nextIndex = ((block.ejercicios || [])[0]?.metricas?.length || 0) + 1;
        const nextColumnName = `Campo ${nextIndex}`;

        if ((block.ejercicios || []).length === 0) {
          return {
            ...block,
            ejercicios: [
              {
                id: createTrainingEntityId("exercise"),
                ejercicioId: "",
                series: "",
                repeticiones: "",
                descanso: "",
                carga: "",
                observaciones: "",
                metricas: [
                  {
                    nombre: nextColumnName,
                    valor: "",
                  },
                ],
                superSerie: [],
              },
            ],
          };
        }

        return {
          ...block,
          ejercicios: (block.ejercicios || []).map((exercise) => ({
            ...exercise,
            metricas: [
              ...(Array.isArray(exercise.metricas) ? exercise.metricas : []),
              {
                nombre: nextColumnName,
                valor: "",
              },
            ],
          })),
        };
      })
    );
  };

  const updateTrainingBlockGridColumnName = (
    weekId: string,
    dayId: string,
    blockId: string,
    metricIndex: number,
    value: string
  ) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: (block.ejercicios || []).map((exercise) => {
            const nextMetricas = Array.isArray(exercise.metricas) ? [...exercise.metricas] : [];
            while (nextMetricas.length <= metricIndex) {
              nextMetricas.push({ nombre: "", valor: "" });
            }

            nextMetricas[metricIndex] = {
              ...nextMetricas[metricIndex],
              nombre: value,
            };

            return {
              ...exercise,
              metricas: nextMetricas,
            };
          }),
        };
      })
    );
  };

  const removeTrainingBlockGridColumn = (
    weekId: string,
    dayId: string,
    blockId: string,
    metricIndex: number
  ) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: (block.ejercicios || []).map((exercise) => ({
            ...exercise,
            metricas: (exercise.metricas || []).filter((_, idx) => idx !== metricIndex),
          })),
        };
      })
    );
  };

  const updateTrainingBlockField = (
    weekId: string,
    dayId: string,
    blockId: string,
    field: "titulo" | "objetivo",
    value: string
  ) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              [field]: value,
            }
          : block
      )
    );
  };

  const addTrainingExercise = (weekId: string, dayId: string, blockId: string) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        const baseMetricas =
          (block.ejercicios || [])[0]?.metricas?.map((metric) => ({
            nombre: String(metric.nombre || ""),
            valor: "",
          })) || [];

        return {
          ...block,
          ejercicios: [
            ...(block.ejercicios || []),
            {
              id: createTrainingEntityId("exercise"),
              ejercicioId: "",
              series: "",
              repeticiones: "",
              descanso: "",
              carga: "",
              observaciones: "",
              metricas: baseMetricas.length > 0 ? baseMetricas : undefined,
              superSerie: [],
            },
          ],
        };
      })
    );
  };

  const addTrainingSuperSerieExercise = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string
  ) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: (block.ejercicios || []).map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;

            const nextSuperItem = {
              id: createTrainingEntityId("super"),
              ejercicioId: "",
              series: String(exercise.series || ""),
              repeticiones: String(exercise.repeticiones || ""),
              descanso: String(exercise.descanso || ""),
              carga: String(exercise.carga || ""),
            };

            return {
              ...exercise,
              superSerie: [...(Array.isArray(exercise.superSerie) ? exercise.superSerie : []), nextSuperItem],
            };
          }),
        };
      })
    );
  };

  const updateTrainingSuperSerieField = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    superId: string,
    field: "ejercicioId" | "series" | "repeticiones" | "descanso" | "carga",
    value: string
  ) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: (block.ejercicios || []).map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;

            return {
              ...exercise,
              superSerie: (Array.isArray(exercise.superSerie) ? exercise.superSerie : []).map((superItem) =>
                superItem.id === superId
                  ? {
                      ...superItem,
                      [field]: value,
                    }
                  : superItem
              ),
            };
          }),
        };
      })
    );
  };

  const removeTrainingSuperSerieExercise = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    superId: string
  ) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: (block.ejercicios || []).map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;

            return {
              ...exercise,
              superSerie: (Array.isArray(exercise.superSerie) ? exercise.superSerie : []).filter(
                (superItem) => superItem.id !== superId
              ),
            };
          }),
        };
      })
    );
  };

  const removeTrainingExercise = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string
  ) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: (block.ejercicios || []).filter((exercise) => exercise.id !== exerciseId),
        };
      })
    );
  };

  const updateTrainingExerciseField = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    field:
      | "ejercicioId"
      | "series"
      | "repeticiones"
      | "descanso"
      | "carga"
      | "observaciones",
    value: string
  ) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: (block.ejercicios || []).map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  [field]: value,
                }
              : exercise
          ),
        };
      })
    );
  };

  const updateTrainingExerciseMetricValue = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    metricIndex: number,
    metricName: string,
    value: string
  ) => {
    updateTrainingBlocks(weekId, dayId, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: (block.ejercicios || []).map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;

            const nextMetricas = Array.isArray(exercise.metricas) ? [...exercise.metricas] : [];
            while (nextMetricas.length <= metricIndex) {
              nextMetricas.push({ nombre: "", valor: "" });
            }

            nextMetricas[metricIndex] = {
              ...nextMetricas[metricIndex],
              nombre: metricName,
              valor: value,
            };

            return {
              ...exercise,
              metricas: nextMetricas,
            };
          }),
        };
      })
    );
  };

  const openTrainingExercisePanel = (
    mode: TrainingExercisePanelMode,
    target: TrainingExercisePanelTarget
  ) => {
    setTrainingExercisePanelMode(mode);
    setTrainingExercisePanelTarget(target);
    setTrainingRecordStatus("");

    if (mode === "registrar-peso") {
      const seriesValue = Math.max(1, Math.round(Number(toSafeNumber(target.currentSeries) || 1)));
      const repsValue = Math.max(0, Math.round(Number(toSafeNumber(target.currentRepeticiones) || 0)));
      const cargaValue = Math.max(0, Number(toSafeNumber(target.currentCarga) || 0));

      setTrainingRecordDraft({
        ...INITIAL_TRAINING_RECORD_DRAFT,
        fecha: new Date().toISOString().slice(0, 10),
        series: String(seriesValue),
        repeticiones: repsValue > 0 ? String(repsValue) : "",
        pesoKg: cargaValue > 0 ? String(cargaValue) : "",
      });
    }
  };

  const closeTrainingExercisePanel = () => {
    setTrainingExercisePanelMode(null);
    setTrainingExercisePanelTarget(null);
    setTrainingRecordStatus("");
  };

  const saveTrainingWeightRecord = () => {
    if (!selectedClient || !trainingExercisePanelTarget) {
      setTrainingRecordStatus("Selecciona un ejercicio antes de registrar peso.");
      return;
    }

    const selectedClientEmail = String(clientesMeta[selectedClient.id]?.email || "")
      .trim()
      .toLowerCase();

    const series = Math.max(1, Math.round(Number(toSafeNumber(trainingRecordDraft.series) || 1)));
    const repeticiones = Math.max(0, Math.round(Number(toSafeNumber(trainingRecordDraft.repeticiones) || 0)));
    const pesoKg = Math.max(0, Number(toSafeNumber(trainingRecordDraft.pesoKg) || 0));

    const payload: WorkoutLogRecord = {
      id: createTrainingEntityId("log"),
      alumnoNombre: selectedClient.nombre,
      alumnoEmail: selectedClientEmail || undefined,
      sessionId: trainingExercisePanelTarget.sessionId || `plan-${selectedClient.id}`,
      sessionTitle: trainingExercisePanelTarget.sessionTitle || "Plan de entrenamiento",
      weekId: trainingExercisePanelTarget.weekId,
      weekName: trainingExercisePanelTarget.weekName,
      dayId: trainingExercisePanelTarget.dayId,
      dayName: trainingExercisePanelTarget.dayName,
      blockId: trainingExercisePanelTarget.blockId,
      blockTitle: trainingExercisePanelTarget.blockTitle,
      exerciseId: trainingExercisePanelTarget.exerciseId,
      exerciseName: trainingExercisePanelTarget.exerciseName,
      exerciseKey: `${trainingExercisePanelTarget.dayId}:${trainingExercisePanelTarget.exerciseId}`,
      fecha: trainingRecordDraft.fecha || new Date().toISOString().slice(0, 10),
      series,
      repeticiones,
      pesoKg,
      molestia: trainingRecordDraft.molestia,
      comentarios: trainingRecordDraft.comentarios.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    markManualSaveIntent(WORKOUT_LOGS_KEY);
    setWorkoutLogsRaw((prev) => [payload, ...normalizeWorkoutLogs(prev)]);
    setTrainingRecordStatus(`Registro guardado para ${trainingExercisePanelTarget.exerciseName}.`);
    setTrainingRecordDraft((prev) => ({
      ...prev,
      repeticiones: "",
      pesoKg: "",
      molestia: false,
      comentarios: "",
    }));
  };

  const createTrainingPlanForSelectedClient = () => {
    if (!selectedClient || selectedClientTrainingPlan) return;

    upsertSelectedClientTrainingPlan((plan) => ({
      ...plan,
    }));

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pf-inline-toast", {
          detail: {
            type: "success",
            message: "Se creo un plan editable para este cliente.",
          },
        })
      );
    }
  };

  const assignPlanFromModal = (optionId: string) => {
    if (!selectedClient) return;

    if (optionId.startsWith("template:")) {
      const templateId = optionId.slice("template:".length);
      const template = templatesAlumnos.find((t) => t.id === templateId);
      if (!template) return;

      const nextWeeks: WeekPlanLite[] = (template.semanas || []).map((week) => ({
        ...week,
        id: createTrainingEntityId("semana"),
        oculto: undefined,
        dias: (week.dias || []).map((day) => ({
          id: createTrainingEntityId("dia"),
          dia: day.dia,
          planificacion: day.planificacion,
          objetivo: day.objetivo,
          sesionId: day.sesionId,
        })),
      }));

      upsertSelectedClientTrainingPlan((plan) => ({
        ...plan,
        semanas: nextWeeks.length > 0 ? nextWeeks : plan.semanas,
      }));

    } else if (optionId.startsWith("ai:")) {
      const aiId = optionId.slice(3);
      const aiPlan = aiTrainingPlans.find((p) => p.id === aiId);
      if (!aiPlan) return;

      const DAYS = TRAINING_WEEK_DAY_NAMES;

      const nextWeeks: WeekPlanLite[] = (aiPlan.plan?.weeks || []).map((week) => {
        const orderedSessions = [...(week.sessions || [])].sort(
          (a, b) => a.sessionNumber - b.sessionNumber
        );

        const dias: WeekDayPlanLite[] = orderedSessions.map((session, idx) => ({
          id: createTrainingEntityId("dia"),
          dia: DAYS[idx % DAYS.length],
          planificacion: session.title,
          objetivo: session.goal,
          sesionId: "",
        }));

        return {
          id: createTrainingEntityId("semana"),
          nombre: `Semana ${week.weekNumber}`,
          objetivo: [week.focus, week.rationale].filter(Boolean).join(" · "),
          dias: dias.length > 0 ? dias : [{
            id: createTrainingEntityId("dia"),
            dia: "Lunes",
            planificacion: "",
            objetivo: "",
            sesionId: "",
          }],
        };
      });

      upsertSelectedClientTrainingPlan((plan) => ({
        ...plan,
        semanas: nextWeeks.length > 0 ? nextWeeks : plan.semanas,
      }));
    }

    setShowAssignPlanModal(false);
    setAssignPlanSearch("");
    setAssignPlanFilter("todos");

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pf-inline-toast", {
          detail: { type: "success", message: "Plan asignado correctamente. Podés editarlo desde aquí." },
        })
      );
    }
  };

  const handleCreateBlankPlanFromModal = () => {
    if (!selectedClient) return;

    upsertSelectedClientTrainingPlan((plan) => ({ ...plan }));

    setShowAssignPlanModal(false);
    setAssignPlanSearch("");
    setAssignPlanFilter("todos");

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pf-inline-toast", {
          detail: { type: "success", message: "Plan en blanco creado. Completalo desde aquí." },
        })
      );
    }
  };

  const trainingPreviewStats = useMemo(() => {
    const weeks = visibleTrainingWeeks;
    const totalDias = weeks.reduce(
      (acc, week) => acc + (week.dias || []).filter((day) => !day.oculto).length,
      0
    );
    let totalBloques = 0;

    weeks.forEach((week) => {
      (week.dias || [])
        .filter((day) => !day.oculto)
        .forEach((day) => {
          const dayBlocks = day.entrenamiento?.bloques || [];

          totalBloques += dayBlocks.length;
        });
    });

    return {
      totalSemanas: weeks.length,
      totalDias,
      totalBloques,
    };
  }, [visibleTrainingWeeks]);

  useEffect(() => {
    const weeks = visibleTrainingWeeks;

    if (weeks.length === 0) {
      if (trainingPreviewWeekId) {
        setTrainingPreviewWeekId("");
      }
      if (trainingPreviewDayId) {
        setTrainingPreviewDayId("");
      }
      return;
    }

    const currentWeek = weeks.find((week) => week.id === trainingPreviewWeekId) || weeks[0];
    if (currentWeek.id !== trainingPreviewWeekId) {
      setTrainingPreviewWeekId(currentWeek.id);
    }

    const days = (currentWeek.dias || []).filter((day) => !day.oculto);
    if (days.length === 0) {
      if (trainingPreviewDayId) {
        setTrainingPreviewDayId("");
      }
      return;
    }

    const currentDay = days.find((day) => day.id === trainingPreviewDayId) || days[0];
    if (currentDay.id !== trainingPreviewDayId) {
      setTrainingPreviewDayId(currentDay.id);
    }
  }, [trainingPreviewDayId, trainingPreviewWeekId, visibleTrainingWeeks]);

  const resumen = useMemo(() => {
    const activos = clientes.filter((item) => item.estado === "activo").length;
    const finalizados = clientes.filter((item) => item.estado === "finalizado").length;
    return { activos, finalizados, total: clientes.length };
  }, [clientes]);

  const latestPaymentByClientId = useMemo(() => {
    const map = new Map<string, PagoRegistro>();
    for (const pago of pagos) {
      const current = map.get(pago.clientId);
      if (!current || new Date(pago.createdAt).getTime() > new Date(current.createdAt).getTime()) {
        map.set(pago.clientId, pago);
      }
    }
    return map;
  }, [pagos]);

  const tableColumns = useMemo(() => {
    const orderedExtras: VisibleClientColumn[] = ["etiquetas", "vencimiento", "ultimo-pago"];
    return [
      "cliente",
      "tipo",
      "categoria",
      "plan",
      ...orderedExtras.filter((column) => visibleExtraColumns.includes(column)),
      "acciones",
    ] as ClientTableColumnKey[];
  }, [visibleExtraColumns]);

  const toggleExtraColumn = (column: VisibleClientColumn) => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      const nextColumns = safe.visibleExtraColumns.includes(column)
        ? safe.visibleExtraColumns.filter((item) => item !== column)
        : [...safe.visibleExtraColumns, column];

      return {
        ...safe,
        visibleExtraColumns: nextColumns,
      };
    });
  };

  const setColumnWidth = (column: ClientTableColumnKey, width: number) => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      return {
        ...safe,
        columnWidths: {
          ...safe.columnWidths,
          [column]: Math.max(60, Math.min(900, width)),
        },
      };
    });
  };

  const setRowHeightValue = (value: number) => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      return {
        ...safe,
        rowHeight: Math.max(42, Math.min(90, value)),
      };
    });
  };

  const setPlanFilter = (value: PlanFilterType) => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      return {
        ...safe,
        planFilter: value,
      };
    });
  };

  const columnLabels: Record<ClientTableColumnKey, string> = {
    cliente: "Cliente",
    tipo: "Tipo",
    categoria: "Categoria",
    plan: "Plan",
    etiquetas: "Etiquetas",
    vencimiento: "Vencimiento",
    "ultimo-pago": "Ultimo pago",
    acciones: "Acciones",
  };

  const startColumnResize = (
    event: React.MouseEvent<HTMLDivElement>,
    column: ClientTableColumnKey
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setColumnResize({
      column,
      startX: event.clientX,
      startWidth: columnWidths[column],
    });
  };

  const estimateColumnWidth = (column: ClientTableColumnKey) => {
    const minByColumn: Record<ClientTableColumnKey, number> = {
      cliente: 180,
      tipo: 100,
      categoria: 110,
      plan: 110,
      etiquetas: 150,
      vencimiento: 130,
      "ultimo-pago": 130,
      acciones: 210,
    };

    if (column === "acciones") {
      return minByColumn.acciones;
    }

    const samples = clientesFiltrados.map((cliente) => {
      const sesionesCount = sesionesPorCliente[cliente.id] || 0;
      const userId = cliente.id.split(":")[1];
      const etiquetasCliente = etiquetasByUserId[userId] || [];
      const meta = getMeta(cliente);
      const lastPayment = latestPaymentByClientId.get(cliente.id);

      switch (column) {
        case "cliente":
          return `${cliente.nombre} ${cliente.club || "Sin club"}`;
        case "tipo":
          return cliente.tipo === "jugadora" ? "Jugadora" : "Alumno/a";
        case "categoria":
          return cliente.categoria || cliente.deporte || "-";
        case "plan":
          return sesionesCount > 0 ? `Con plan (${sesionesCount})` : "Sin plan";
        case "etiquetas":
          return etiquetasCliente.length === 0
            ? "Sin etiquetas"
            : etiquetasCliente.map((tag) => tag.texto).join(", ");
        case "vencimiento":
          return `${meta.endDate || "Sin fecha"} ${meta.startDate || ""}`;
        case "ultimo-pago":
          return lastPayment
            ? `${lastPayment.moneda} ${lastPayment.importe.toLocaleString("es-AR")} ${new Date(lastPayment.fecha).toLocaleDateString("es-AR")}`
            : "Sin pagos";
        default:
          return "";
      }
    });

    const maxChars = Math.max(
      columnLabels[column].length,
      ...samples.map((value) => String(value || "").length)
    );

    const estimated = Math.round(maxChars * 7.4 + 32);
    return Math.max(minByColumn[column], Math.min(estimated, 600));
  };

  const autoSizeColumn = (column: ClientTableColumnKey) => {
    setColumnWidth(column, estimateColumnWidth(column));
  };

  const autoSizeVisibleColumns = () => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      const nextWidths = { ...safe.columnWidths };
      for (const column of tableColumns) {
        nextWidths[column] = estimateColumnWidth(column);
      }

      return {
        ...safe,
        columnWidths: nextWidths,
      };
    });
  };

  const resetTableView = () => {
    setClientTableUiPrefs(DEFAULT_CLIENT_TABLE_UI_PREFS);
    setShowColumnsMenu(true);
  };

  const applyMynterPreset = () => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      return {
        ...safe,
        rowHeight: 96,
        columnWidths: {
          ...safe.columnWidths,
          ...DEFAULT_COLUMN_WIDTHS,
        },
      };
    });
  };

  const saveTableView = () => {
    if (!clientTableUiLoaded) return;
    markManualSaveIntent(clientTableUiKey);
  };

  useEffect(() => {
    if (!columnResize) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - columnResize.startX;
      const nextWidth = Math.max(60, Math.min(900, columnResize.startWidth + delta));
      setColumnWidth(columnResize.column, nextWidth);
    };

    const handleMouseUp = () => {
      setColumnResize(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [columnResize]);

  useEffect(() => {
    if (!selectedClient) {
      setDatosDraft(null);
      return;
    }

    setDatosDraft({
      nombre: selectedClient.nombre,
      fechaNacimiento: selectedClient.fechaNacimiento || "",
      altura: selectedClient.altura || "",
      peso: selectedClient.peso || "",
      club: selectedClient.club || "",
      objetivo: selectedClient.objetivo || "",
      observaciones: selectedClient.observaciones || "",
      deporte: selectedClient.deporte || deportesOptions[0] || "",
      categoria: selectedClient.categoria || categoriasOptions[0] || "",
      posicion: selectedClient.posicion || "",
    });
  }, [categoriasOptions, deportesOptions, selectedClient]);

  useEffect(() => {
    if (pagoForm.clientId) return;
    if (clientes.length === 0) return;
    setPagoForm((prev) => ({ ...prev, clientId: clientes[0].id }));
  }, [clientes, pagoForm.clientId]);

  const getMeta = (cliente: ClienteView) => clientesMeta[cliente.id] || defaultMeta(cliente);

  const setMetaPatch = (clientId: string, patch: Partial<ClienteMeta>) => {
    const baseClient = clientes.find((item) => item.id === clientId);
    if (!baseClient) return;

    setClientesMeta((prev) => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || defaultMeta(baseClient)),
        ...patch,
      },
    }));
  };

  const migrateMeta = (oldId: string, nextId: string, nextMeta: ClienteMeta) => {
    setClientesMeta((prev) => {
      const clone = { ...prev };
      delete clone[oldId];
      clone[nextId] = nextMeta;
      return clone;
    });
  };

  const toggleEstado = (cliente: ClienteView) => {
    const proximoEstado: ClienteEstado =
      cliente.estado === "activo" ? "finalizado" : "activo";

    if (cliente.tipo === "jugadora") {
      editarJugadora(cliente.nombre, { estado: proximoEstado });
      return;
    }

    editarAlumno(cliente.nombre, { estado: proximoEstado });
  };

  const borrarCliente = (cliente: ClienteView) => {
    if (!confirm(`¿Eliminar cliente ${cliente.nombre}?`)) return;

    if (cliente.tipo === "jugadora") {
      eliminarJugadora(cliente.nombre);
    } else {
      eliminarAlumno(cliente.nombre);
    }

    setClientesMeta((prev) => {
      const clone = { ...prev };
      delete clone[cliente.id];
      return clone;
    });
  };

  const resetForm = () => {
    setForm({
      ...INITIAL_FORM,
      deporte: deportesOptions[0] || "Fútbol",
      categoria: categoriasOptions[0] || "",
    });
    setCrearStep(1);
    setCrearMeta({
      apellido: "",
      segundoApellido: "",
      email: "",
      sexo: "femenino",
      codigoPais: "",
      telefono: "",
      pais: "",
      provincia: "",
      calle: "",
      numero: "",
      piso: "",
      depto: "",
      categoriaPlan: "",
      startDate: "",
      endDate: "",
      tipoAsesoria: "entrenamiento",
      modalidad: "presencial",
    });
  };

  const submitCliente = () => {
    markManualSaveIntent("pf-control-alumnos");
    markManualSaveIntent("pf-control-jugadoras");
    const nombre = form.nombre.trim();
    if (!nombre) return;

    let newClientId: string;
    if (form.practicaDeporte === "si") {
      agregarJugadora({
        nombre,
        estado: form.estado,
        posicion: form.posicion.trim() || "Sin posicion",
        wellness: 0,
        carga: 0,
        fechaNacimiento: form.fechaNacimiento || undefined,
        altura: form.altura || undefined,
        peso: form.peso || undefined,
        deporte: form.deporte || undefined,
        categoria: form.categoria || undefined,
        club: form.club.trim() || undefined,
        objetivo: form.objetivo.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
      });
      newClientId = `jugadora:${nombre}`;
      setSelectedClientId(newClientId);
    } else {
      agregarAlumno({
        nombre,
        estado: form.estado,
        fechaNacimiento: form.fechaNacimiento || undefined,
        altura: form.altura || undefined,
        peso: form.peso || undefined,
        club: form.club.trim() || undefined,
        objetivo: form.objetivo.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
        practicaDeporte: false,
      });
      newClientId = `alumno:${nombre}`;
      setSelectedClientId(newClientId);
    }

    // Persist extended meta from wizard
    setMetaPatch(newClientId, {
      apellido: crearMeta.apellido,
      segundoApellido: crearMeta.segundoApellido,
      email: crearMeta.email,
      sexo: crearMeta.sexo,
      codigoPais: crearMeta.codigoPais,
      telefono: crearMeta.telefono,
      pais: crearMeta.pais,
      provincia: crearMeta.provincia,
      calle: crearMeta.calle,
      numero: crearMeta.numero,
      piso: crearMeta.piso,
      depto: crearMeta.depto,
      categoriaPlan: crearMeta.categoriaPlan,
      startDate: crearMeta.startDate,
      endDate: crearMeta.endDate,
      tipoAsesoria: crearMeta.tipoAsesoria,
      modalidad: crearMeta.modalidad,
    });

    setCrearOpen(false);
    setActiveTab("datos");
    resetForm();
  };

  const saveDatosGenerales = () => {
    if (!selectedClient || !selectedMeta || !datosDraft) return;
    markManualSaveIntent(CLIENTE_META_KEY);

    const nextNombre = datosDraft.nombre.trim();
    if (!nextNombre) return;

    if (selectedClient.tipo === "jugadora") {
      editarJugadora(selectedClient.nombre, {
        nombre: nextNombre,
        fechaNacimiento: datosDraft.fechaNacimiento || undefined,
        altura: datosDraft.altura || undefined,
        peso: datosDraft.peso || undefined,
        club: datosDraft.club || undefined,
        objetivo: datosDraft.objetivo || undefined,
        observaciones: datosDraft.observaciones || undefined,
        deporte: datosDraft.deporte || undefined,
        categoria: datosDraft.categoria || undefined,
        posicion: datosDraft.posicion || undefined,
      });
    } else {
      editarAlumno(selectedClient.nombre, {
        nombre: nextNombre,
        fechaNacimiento: datosDraft.fechaNacimiento || undefined,
        altura: datosDraft.altura || undefined,
        peso: datosDraft.peso || undefined,
        club: datosDraft.club || undefined,
        objetivo: datosDraft.objetivo || undefined,
        observaciones: datosDraft.observaciones || undefined,
      });
    }

    const nextId = `${selectedClient.tipo}:${nextNombre}`;
    migrateMeta(selectedClient.id, nextId, {
      ...selectedMeta,
      categoriaPlan: datosDraft.categoria || selectedMeta.categoriaPlan,
    });
    setSelectedClientId(nextId);
  };

  const updateTabNote = (tab: ClienteTab, value: string) => {
    if (!selectedClient || !selectedMeta) return;
    setMetaPatch(selectedClient.id, {
      tabNotas: {
        ...selectedMeta.tabNotas,
        [tab]: value,
      },
    });
  };

  const openWhatsapp = (cliente: ClienteView) => {
    const meta = getMeta(cliente);
    const telefono = normalizeWhatsAppNumber(meta);
    if (!telefono) {
      window.dispatchEvent(
        new CustomEvent("pf-inline-toast", {
          detail: {
            type: "warning",
            title: "WhatsApp",
            message: "Numero de telefono invalido para abrir chat",
          },
        })
      );
      return;
    }

    const presetText = encodeURIComponent(`Hola ${cliente.nombre}, te escribo desde PF Control.`);
    window.open(`https://wa.me/${telefono}?text=${presetText}`, "_blank", "noopener,noreferrer");
  };

  const pushUrlWithoutReload = (href: string) => {
    if (typeof window === "undefined") return;
    const nextUrl = new URL(href, window.location.origin);
    const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) return;
    window.history.pushState({}, "", next);
  };

  const setClientesSectionView = (nextSection: ClientesSection) => {
    setClientesSection(nextSection);

    if (typeof window === "undefined") return;

    const nextUrl = new URL(window.location.href);

    if (nextSection === "plantel") {
      nextUrl.searchParams.set("seccion", "plantel");
      nextUrl.searchParams.delete("detalle");
      nextUrl.searchParams.delete("cliente");
      nextUrl.searchParams.delete("tab");
    } else {
      nextUrl.searchParams.delete("seccion");
      nextUrl.searchParams.delete("panel");
      nextUrl.searchParams.delete("vista");
    }

    const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next !== current) {
      window.history.pushState({}, "", next);
    }
  };

  useEffect(() => {
    router.prefetch("/clientes/plan");
    router.prefetch("/registros");
  }, [router]);

  const openClientDetail = (clientId: string, tab: ClienteTab = "datos") => {
    setClientesSection("clientes");
    setIsDetailMode(true);
    setDetailClientId(clientId);
    setDetailTabId(tab);
    setSelectedClientId(clientId);
    setActiveTab(tab);
    pushUrlWithoutReload(buildClientDetailHref(clientId, tab));
  };

  const closeClientDetail = () => {
    setIsDetailMode(false);
    setDetailClientId(null);
    setDetailTabId(null);
    pushUrlWithoutReload("/clientes");
  };

  const registrarPago = (e: React.FormEvent) => {
    e.preventDefault();
    markManualSaveIntent(PAGOS_KEY);
    markManualSaveIntent(CLIENTE_META_KEY);
    const cliente = clientes.find((item) => item.id === pagoForm.clientId);
    const importe = parseFloat(pagoForm.importe.replace(",", "."));

    if (!cliente || !pagoForm.fecha || Number.isNaN(importe) || importe <= 0) {
      return;
    }

    const pago: PagoRegistro = {
      id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
      clientId: cliente.id,
      clientName: cliente.nombre,
      fecha: pagoForm.fecha,
      importe,
      moneda: pagoForm.moneda,
      createdAt: new Date().toISOString(),
    };

    const metaActual = getMeta(cliente);
    const renewalDays = Number.isFinite(Number(metaActual.renewalDays))
      ? Math.max(1, Math.min(365, Number(metaActual.renewalDays)))
      : 30;
    const shouldAutoRenew = metaActual.autoRenewPlan !== false;

    let startDatePatch = metaActual.startDate;
    let endDatePatch = metaActual.endDate;

    if (shouldAutoRenew) {
      const paymentDate = parseDateAtStart(pagoForm.fecha);
      const currentEndDate = parseDateAtStart(metaActual.endDate);

      if (paymentDate) {
        const renewalBase = currentEndDate && currentEndDate >= paymentDate ? currentEndDate : paymentDate;
        endDatePatch = sumarDias(renewalBase.toISOString().slice(0, 10), renewalDays);
        startDatePatch = metaActual.startDate || pagoForm.fecha;
      }
    }

    setPagos((prev) => [pago, ...prev]);
    setMetaPatch(cliente.id, {
      pagoEstado: "confirmado",
      moneda: pagoForm.moneda,
      importe: String(importe),
      saldo: "0",
      startDate: startDatePatch,
      endDate: endDatePatch,
    });

    setSelectedClientId(cliente.id);
    setPagoForm((prev) => ({ ...prev, importe: "" }));
  };

  return (
    <main className="relative mx-auto max-w-[1920px] space-y-6 p-6 text-slate-100">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 z-0"
        style={{ background: `radial-gradient(ellipse 80% 55% at 50% -10%, hsla(var(--hue,142),65%,55%,0.1) 0%, transparent 70%)` }}
        aria-hidden="true"
      />
      <section className="pf-card rounded-2xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-white/15 bg-white/[0.025] p-1">
            <ReliableActionButton
              type="button"
              onClick={() => setClientesSectionView("clientes")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                clientesSection === "clientes"
                  ? "bg-cyan-300 text-slate-950"
                  : "text-slate-200 hover:bg-white/10"
              }`}
            >
              Clientes
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              onClick={() => setClientesSectionView("plantel")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                clientesSection === "plantel"
                  ? "bg-emerald-300 text-slate-950"
                  : "text-slate-200 hover:bg-white/10"
              }`}
            >
              Plantel
            </ReliableActionButton>
          </div>
          <p className="text-xs text-slate-300">
            Plantel ahora vive dentro del modulo Clientes.
          </p>
        </div>
      </section>

      {clientesSection === "plantel" ? (
        <PlantelPanel embedded />
      ) : (
        <>
      {!isDetailMode ? (
      <section className="pf-clientes-hero">
        <div className="pointer-events-none absolute -left-12 -top-14 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/80" style={{ color: `hsl(var(--hue,142),65%,65%)` }}>
              Hub comercial y operativo
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Clientes</h1>
            <p className="mt-2 text-sm text-slate-200/90">
              Gestion integral de fichas, pagos y planes en una vista mas clara y moderna.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isDetailMode ? (
              <ReliableActionButton
                type="button"
                onClick={closeClientDetail}
                className="rounded-xl border border-cyan-100/40 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200"
              >
                Volver al listado
              </ReliableActionButton>
            ) : (
              <>
                <ReliableActionButton
                  type="button"
                  onClick={() => { setCrearOpen(true); resetForm(); }}
                  className="rounded-xl border border-cyan-100/40 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200"
                >
                  + Crear cliente
                </ReliableActionButton>
                <ReliableActionButton
                  type="button"
                  onClick={() => router.push("/registros")}
                  className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Ver registros
                </ReliableActionButton>
              </>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 md:grid-cols-3">
          <div className="pf-stat-card pf-stat-card--activos">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200/70">Activos</p>
            <p className="mt-1 text-3xl font-black text-white">{resumen.activos}</p>
          </div>
          <div className="pf-stat-card pf-stat-card--fin">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-200/70">Finalizados</p>
            <p className="mt-1 text-3xl font-black text-white">{resumen.finalizados}</p>
          </div>
          <div className="pf-stat-card pf-stat-card--total">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200/70">Total</p>
            <p className="mt-1 text-3xl font-black text-white">{resumen.total}</p>
          </div>
        </div>
      </section>
      ) : null}

      {/* ── Modal wizard: Nuevo cliente ─────────────────────────────────────── */}
      {crearOpen && (
      <div
        className="pf-modal-overlay fixed inset-0 z-[150] overflow-y-auto"
        data-open="true"
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo cliente"
      >
        {/* Backdrop click */}
        <div className="absolute inset-0" onClick={() => { setCrearOpen(false); resetForm(); }} />

        {/* Wizard panel — centrado, ancho generoso */}
        <div className="pf-modal-panel relative mx-auto w-full max-w-3xl min-h-screen flex flex-col justify-start px-6 pt-10 pb-16 sm:min-h-0 sm:my-12 sm:rounded-2xl sm:shadow-[0_40px_100px_rgba(0,0,0,0.7)]"
          style={{ background: "#0a0c14" }}
        >

          {/* ── Título ── */}
          {(crearStep === 1 || crearStep === 3) && (
            <h1 className="mb-8 text-3xl font-black uppercase tracking-widest text-white sm:text-4xl">
              NUEVO CLIENTE
            </h1>
          )}
          {crearStep === 2 && <div className="mb-8 h-px" />}
          {crearStep === 4 && (
            <h1 className="mb-8 text-3xl font-black uppercase tracking-widest text-white sm:text-4xl">
              NUEVO CLIENTE
            </h1>
          )}

          {/* ── Stepper ── */}
          {(() => {
            const STEPS = [
              { label: "Email",     desc: "Verificar email cliente" },
              { label: "Cliente",   desc: "Información del cliente" },
              { label: "Membresía", desc: "Información de la membresía adquirida" },
              { label: "Opcionales",desc: "Reservas de clases" },
            ];
            return (
              <div className="mb-8 flex items-start justify-between gap-0">
                {STEPS.map((s, i) => {
                  const num = i + 1;
                  const done = crearStep > num;
                  const active = crearStep === num;
                  const circleStyle: React.CSSProperties = done
                    ? { background: "hsl(142,60%,40%)", color: "#fff" }
                    : active
                    ? { background: "#06b6d4", color: "#fff" }
                    : { background: "#374151", color: "#9ca3af" };
                  return (
                    <div key={num} className="flex flex-1 flex-col items-center">
                      <div className="flex w-full items-center">
                        {/* Left connector */}
                        {i > 0 && (
                          <div className="h-px flex-1" style={{ background: crearStep > num ? "hsl(142,60%,40%)" : "#374151" }} />
                        )}
                        {/* Circle */}
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black transition-all duration-300"
                          style={circleStyle}
                        >
                          {done ? (
                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                              <path d="M13.5 3.5L6 11 2.5 7.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : num}
                        </div>
                        {/* Right connector */}
                        {i < STEPS.length - 1 && (
                          <div className="h-px flex-1" style={{ background: crearStep > num ? "hsl(142,60%,40%)" : "#374151" }} />
                        )}
                      </div>
                      {/* Label */}
                      <p className="mt-2 text-center text-xs font-bold text-white">{s.label}</p>
                      <p className="mt-0.5 hidden text-center text-[10px] text-slate-500 sm:block">{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Paso 1: Email ── */}
          {crearStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                  EMAIL <span className="text-cyan-400">(*)</span>
                </label>
                <input
                  type="email"
                  autoFocus
                  value={crearMeta.email}
                  onChange={(e) => setCrearMeta((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  placeholder="Ingrese el email"
                />
              </div>
            </div>
          )}

          {/* ── Paso 2: Cliente ── */}
          {crearStep === 2 && (
            <div className="space-y-8">
              {/* Datos personales */}
              <div>
                <h3 className="mb-4 text-base font-bold text-white">Datos personales</h3>
                <div className="space-y-4">
                  {/* Nombre / Primer apellido / Segundo apellido */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        NOMBRE <span className="text-cyan-400">(*)</span>
                      </label>
                      <input
                        autoFocus
                        required
                        value={form.nombre}
                        onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="Ingrese el nombre"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        PRIMER APELLIDO <span className="text-cyan-400">(*)</span>
                      </label>
                      <input
                        required
                        value={crearMeta.apellido}
                        onChange={(e) => setCrearMeta((p) => ({ ...p, apellido: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="Ingrese el apellido paterno"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">SEGUNDO APELLIDO</label>
                      <input
                        value={crearMeta.segundoApellido}
                        onChange={(e) => setCrearMeta((p) => ({ ...p, segundoApellido: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="Ingrese el apellido materno"
                      />
                    </div>
                  </div>

                  {/* Email (readonly) / Nacimiento / Sexo */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        EMAIL <span className="text-cyan-400">(*)</span>
                      </label>
                      <input
                        readOnly
                        value={crearMeta.email}
                        className="w-full rounded-lg border border-white/[0.06] bg-[#0e1012] px-3 py-2.5 text-sm text-slate-400 focus:outline-none cursor-default"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        FECHA NACIMIENTO <span className="text-cyan-400">(*)</span>
                      </label>
                      <DateInput
                        value={form.fechaNacimiento}
                        onChange={(v) => setForm((p) => ({ ...p, fechaNacimiento: v }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 pr-8 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        SEXO <span className="text-cyan-400">(*)</span>
                      </label>
                      <div className="flex rounded-lg border border-white/10 overflow-hidden text-sm font-bold">
                        <button
                          type="button"
                          onClick={() => setCrearMeta((p) => ({ ...p, sexo: "masculino" }))}
                          className="flex-1 py-2.5 transition"
                          style={crearMeta.sexo === "masculino" ? { background: "#06b6d4", color: "#0a0c14" } : { background: "#1a1f2e", color: "#6b7280" }}
                        >
                          MASCULINO
                        </button>
                        <button
                          type="button"
                          onClick={() => setCrearMeta((p) => ({ ...p, sexo: "femenino" }))}
                          className="flex-1 py-2.5 transition"
                          style={crearMeta.sexo === "femenino" ? { background: "#06b6d4", color: "#0a0c14" } : { background: "#1a1f2e", color: "#6b7280" }}
                        >
                          FEMENINO
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Altura / Cod. país / Teléfono */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">ALTURA</label>
                      <div className="flex items-center gap-1">
                        <input
                          value={form.altura}
                          onChange={(e) => setForm((p) => ({ ...p, altura: e.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                          placeholder="Ingrese la altura"
                        />
                        <span className="text-xs text-slate-500 shrink-0">cm</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">COD. TELÉFONO PAÍS</label>
                      <input
                        value={crearMeta.codigoPais}
                        onChange={(e) => setCrearMeta((p) => ({ ...p, codigoPais: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="+54"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">TELÉFONO</label>
                      <input
                        value={crearMeta.telefono}
                        onChange={(e) => setCrearMeta((p) => ({ ...p, telefono: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="Ingrese el Nro. de contacto"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Domicilio */}
              <div>
                <h3 className="mb-4 text-base font-bold text-white">Domicilio</h3>
                <div className="space-y-4">
                  {/* País / Provincia */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">PAÍS</label>
                      <input
                        value={crearMeta.pais}
                        onChange={(e) => setCrearMeta((p) => ({ ...p, pais: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="País"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">PROV. / ESTADO / DISTRITO</label>
                      <input
                        value={crearMeta.provincia}
                        onChange={(e) => setCrearMeta((p) => ({ ...p, provincia: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="Provincia / Estado"
                      />
                    </div>
                  </div>
                  {/* Calle / Número / Piso / Depto */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">CALLE</label>
                      <input
                        value={crearMeta.calle}
                        onChange={(e) => setCrearMeta((p) => ({ ...p, calle: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="Calle"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">NÚMERO</label>
                      <input
                        value={crearMeta.numero}
                        onChange={(e) => setCrearMeta((p) => ({ ...p, numero: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="Número"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">PISO</label>
                      <input
                        value={crearMeta.piso}
                        onChange={(e) => setCrearMeta((p) => ({ ...p, piso: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        placeholder="Piso"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 3: Membresía ── */}
          {crearStep === 3 && (
            <div className="space-y-6">
              {/* Tipo de cliente */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">TIPO DE CLIENTE</label>
                  <select
                    value={form.practicaDeporte}
                    onChange={(e) => setForm((p) => ({ ...p, practicaDeporte: e.target.value as "si" | "no" }))}
                    className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="si">Jugadora / deportista</option>
                    <option value="no">Alumno/a general</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">ESTADO</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value as ClienteEstado }))}
                    className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="activo">Activo</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                </div>
              </div>

              {/* Categoría / Plan */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  CATEGORÍA <span className="text-cyan-400">(*)</span>
                </label>
                {planesDisponibles.filter((p) => p.activo).length > 0 ? (
                  <select
                    value={crearMeta.categoriaPlan}
                    onChange={(e) => setCrearMeta((p) => ({ ...p, categoriaPlan: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="">Seleccione</option>
                    {planesDisponibles.filter((p) => p.activo).map((p) => (
                      <option key={p.id} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={crearMeta.categoriaPlan}
                    onChange={(e) => setCrearMeta((p) => ({ ...p, categoriaPlan: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                    placeholder="Ej: Plan mensual, Plan semanal..."
                  />
                )}
              </div>

              {/* Fechas inicio / fin */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">FECHA INICIO</label>
                  <input
                    type="date"
                    value={crearMeta.startDate}
                    onChange={(e) => setCrearMeta((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">FECHA FIN</label>
                  <input
                    type="date"
                    value={crearMeta.endDate}
                    onChange={(e) => setCrearMeta((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Tipo asesoría / Modalidad */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">TIPO ASESORÍA</label>
                  <select
                    value={crearMeta.tipoAsesoria}
                    onChange={(e) => setCrearMeta((p) => ({ ...p, tipoAsesoria: e.target.value as ClienteMeta["tipoAsesoria"] }))}
                    className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="entrenamiento">Entrenamiento</option>
                    <option value="nutricion">Nutrición</option>
                    <option value="completa">Completa</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">MODALIDAD</label>
                  <select
                    value={crearMeta.modalidad}
                    onChange={(e) => setCrearMeta((p) => ({ ...p, modalidad: e.target.value as ClienteMeta["modalidad"] }))}
                    className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 4: Opcionales ── */}
          {crearStep === 4 && (
            <div className="space-y-6">
              {/* Deporte (si aplica) */}
              {form.practicaDeporte === "si" && (
                <div>
                  <h3 className="mb-4 text-base font-bold text-white">Deporte y club</h3>
                  <div className="space-y-3">
                    <input
                      value={form.club}
                      onChange={(e) => setForm((p) => ({ ...p, club: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                      placeholder="Club o institución"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">DEPORTE</label>
                        <select
                          value={form.deporte}
                          onChange={(e) => setForm((p) => ({ ...p, deporte: e.target.value, posicion: "" }))}
                          className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:outline-none"
                        >
                          {deportesOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">CATEGORÍA</label>
                        <select
                          value={form.categoria}
                          onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:outline-none"
                        >
                          <option value="">Categoría</option>
                          {categoriasOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">POSICIÓN</label>
                        <select
                          value={form.posicion}
                          onChange={(e) => setForm((p) => ({ ...p, posicion: e.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white focus:outline-none"
                        >
                          <option value="">Posición</option>
                          {posicionesOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {form.practicaDeporte === "no" && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">LUGAR (gimnasio / institución)</label>
                  <input
                    value={form.club}
                    onChange={(e) => setForm((p) => ({ ...p, club: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                    placeholder="Club, gimnasio o institución (opcional)"
                  />
                </div>
              )}

              {/* Objetivo / Observaciones */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">OBJETIVO</label>
                <textarea
                  value={form.objetivo}
                  onChange={(e) => setForm((p) => ({ ...p, objetivo: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                  placeholder="Objetivo principal del cliente..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">OBSERVACIONES</label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#0e1012] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                  placeholder="Observaciones, notas internas..."
                />
              </div>
            </div>
          )}

          {/* ── Barra de acciones ── */}
          <div className="mt-10 flex flex-wrap items-center justify-end gap-3">
            {/* Cancelar */}
            <ReliableActionButton
              type="button"
              onClick={() => { setCrearOpen(false); resetForm(); }}
              className="rounded-lg border border-red-500/70 px-5 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
            >
              Cancelar
            </ReliableActionButton>

            {/* Atrás */}
            {crearStep > 1 && (
              <ReliableActionButton
                type="button"
                onClick={() => setCrearStep((s) => s - 1)}
                className="rounded-lg border border-cyan-500/60 px-5 py-2.5 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-500/10"
              >
                Atrás
              </ReliableActionButton>
            )}

            {/* Guardar desde paso 3 (saltear opcionales) */}
            {crearStep === 3 && (
              <ReliableActionButton
                type="button"
                onClick={() => { if (!form.nombre.trim()) { setCrearStep(2); return; } submitCliente(); }}
                className="rounded-lg px-5 py-2.5 text-sm font-black text-white transition hover:brightness-110"
                style={{ background: "hsl(142,60%,40%)" }}
              >
                Guardar
              </ReliableActionButton>
            )}

            {/* Siguiente / Guardar final */}
            {crearStep < 4 ? (
              <ReliableActionButton
                type="button"
                onClick={() => {
                  if (crearStep === 1 && !crearMeta.email.trim()) return;
                  if (crearStep === 2 && (!form.nombre.trim() || !crearMeta.apellido.trim())) return;
                  setCrearStep((s) => s + 1);
                }}
                className="rounded-lg border border-cyan-500/60 px-6 py-2.5 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-500/10"
              >
                Siguiente
              </ReliableActionButton>
            ) : (
              <ReliableActionButton
                type="button"
                onClick={() => { if (!form.nombre.trim()) { setCrearStep(2); return; } submitCliente(); }}
                className="rounded-lg px-6 py-2.5 text-sm font-black text-white transition hover:brightness-110"
                style={{ background: "hsl(142,60%,40%)" }}
              >
                Guardar
              </ReliableActionButton>
            )}
          </div>

        </div>
      </div>
      )}

      {!isDetailMode && isAdmin ? (
      <section className="mb-6 rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),rgba(15,23,42,0.94)_50%,rgba(2,6,23,0.96)_100%)] p-5 shadow-[0_20px_60px_rgba(2,10,26,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-100/85" style={{ color: `hsl(var(--hue,142),65%,65%)` }}>Admin</p>
            <h2 className="mt-1 text-xl font-black text-white">Nuevos ingresantes</h2>
            <p className="mt-1 text-sm text-slate-300">
              Esta vista replica el alta pendiente para que puedas activarlos tambien desde Clientes.
            </p>
          </div>
          <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-sm font-bold text-cyan-100">
            {ingresantesLoading ? 'Cargando...' : `Pendientes: ${ingresantesPendientes.length}`}
          </div>
        </div>

        {ingresantesMessage ? (
          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
              ingresantesMessage.type === 'success'
                ? 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100'
                : 'border-rose-300/35 bg-rose-500/15 text-rose-100'
            }`}
          >
            {ingresantesMessage.text}
          </div>
        ) : null}

        {ingresantesPendientes.length === 0 ? (
          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-sm text-slate-300">
            No hay ingresantes pendientes de alta en este momento.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {ingresantesPendientes.map((ingresante) => {
              const nombre = resolveIngresanteDisplayName(ingresante);
              return (
                <article key={`ingresante-${ingresante.id}`} className="pf-card rounded-2xl border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/80">Nuevo ingresante</p>
                  <p className="mt-1 text-sm font-black text-white">{nombre.nombreCompleto || 'Sin nombre'}</p>
                  <p className="text-xs text-slate-300">{ingresante.email}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Telefono: {String(ingresante.signupProfile?.telefono || ingresante.telefono || 'Sin dato')}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Nacimiento: {String(ingresante.signupProfile?.fechaNacimiento || ingresante.fechaNacimiento || 'Sin dato')}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ReliableActionButton
                      type="button"
                      onClick={() => void darAltaIngresante(ingresante)}
                      disabled={ingresantesActionId === ingresante.id}
                      className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {ingresantesActionId === ingresante.id ? 'Dando alta...' : 'Dar de Alta'}
                    </ReliableActionButton>

                    <Link
                      href="/admin/usuarios"
                      className="rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25"
                    >
                      Abrir panel de Admin
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      ) : null}

      {!isDetailMode ? (
      <section className="mb-6 pf-card rounded-2xl border p-5 ">
        <h2 className="text-xl font-bold">Registrar pago</h2>
        <p className="mt-1 text-sm text-slate-300">
          Al registrar un pago, se renueva automaticamente la asesoria por 30 dias (configurable por cliente).
        </p>

        <form onSubmit={registrarPago} className="mt-4 grid gap-3 md:grid-cols-5">
          <select
            required
            value={pagoForm.clientId}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, clientId: e.target.value }))}
            className="rounded-xl border border-white/20 bg-[#0e1012] px-3 py-2 text-sm"
          >
            <option value="">Cliente</option>
            {clientes
              .slice()
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre} ({cliente.tipo})
                </option>
              ))}
          </select>

          <input
            required
            type="date"
            value={pagoForm.fecha}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, fecha: e.target.value }))}
            className="rounded-xl border border-white/20 bg-[#0e1012] px-3 py-2 text-sm"
          />

          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={pagoForm.importe}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, importe: e.target.value }))}
            className="rounded-xl border border-white/20 bg-[#0e1012] px-3 py-2 text-sm"
            placeholder="Importe"
          />

          <select
            value={pagoForm.moneda}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, moneda: e.target.value }))}
            className="rounded-xl border border-white/20 bg-[#0e1012] px-3 py-2 text-sm"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>

          <ReliableActionButton
            type="submit"
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
          >
            Guardar pago
          </ReliableActionButton>
        </form>

        <div className="mt-4 grid gap-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Ultimos pagos ({pagos.length})
          </p>
          {pagos.slice(0, 5).map((pago) => (
            <div
              key={pago.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm"
            >
              <p className="font-semibold text-slate-100">{pago.clientName}</p>
              <p className="text-slate-300">{new Date(pago.fecha).toLocaleDateString("es-AR")}</p>
              <p className="font-bold text-emerald-200">
                {pago.moneda} {pago.importe.toLocaleString("es-AR")}
              </p>
            </div>
          ))}
          {pagos.length === 0 ? (
            <p className="text-sm text-slate-400">Todavia no hay pagos registrados.</p>
          ) : null}
        </div>
      </section>
      ) : null}

      <section
        className="grid gap-5"
        data-layout-lock="clientes-section"
        style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        {!isDetailMode ? (
        <div
          className="pf-clientes-list-panel"
          data-layout-lock="clientes-list-panel"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-white/15 bg-white/[0.025] p-1">
              <ReliableActionButton type="button" onClick={() => setVista("activo")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === "activo" ? "bg-emerald-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Activos</ReliableActionButton>
              <ReliableActionButton type="button" onClick={() => setVista("finalizado")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === "finalizado" ? "bg-rose-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Finalizados</ReliableActionButton>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, club o categoria" className="pf-filter-input max-w-sm text-sm" />
          </div>

          <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as "todos" | ClienteTipo)} className="pf-filter-input">
              <option value="todos">Tipo: Todos</option>
              <option value="jugadora">Tipo: Jugadoras</option>
              <option value="alumno">Tipo: Alumnos</option>
            </select>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="pf-filter-input">
              <option value="todas">Categoria: Todas</option>
              {categoriasOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={filtroDeporte} onChange={(e) => setFiltroDeporte(e.target.value)} className="pf-filter-input">
              <option value="todos">Deporte: Todos</option>
              {deportesOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input value={filtroClub} onChange={(e) => setFiltroClub(e.target.value)} placeholder="Club" className="pf-filter-input" />
            <select value={filtroPlan} onChange={(e) => setPlanFilter(e.target.value as PlanFilterType)} className="pf-filter-input">
              <option value="todos">Plan: Todos</option>
              <option value="con-plan">Con cualquier plan</option>
              <option value="sin-plan">Sin ningun plan</option>
              <option value="con-plan-entrenamiento">Con plan entrenamiento</option>
              <option value="con-plan-nutricional">Con plan nutricional</option>
              <option value="sin-plan-nutricional">Sin plan nutricional</option>
            </select>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px]">
            <ReliableActionButton
              type="button"
              onClick={() => setPlanFilter("todos")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "todos" ? "border-cyan-300/70 bg-cyan-500/20 text-cyan-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Todos ({planStatusSummary.total})
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              onClick={() => setPlanFilter("con-plan")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "con-plan" ? "border-emerald-300/70 bg-emerald-500/20 text-emerald-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Con plan ({planStatusSummary.conPlan})
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              onClick={() => setPlanFilter("sin-plan")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "sin-plan" ? "border-rose-300/70 bg-rose-500/20 text-rose-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Sin plan ({planStatusSummary.sinPlan})
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              onClick={() => setPlanFilter("con-plan-entrenamiento")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "con-plan-entrenamiento" ? "border-lime-300/70 bg-lime-500/20 text-lime-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Entrenamiento ({planStatusSummary.conEntrenamiento})
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              onClick={() => setPlanFilter("con-plan-nutricional")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "con-plan-nutricional" ? "border-sky-300/70 bg-sky-500/20 text-sky-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Nutricional ({planStatusSummary.conNutricional})
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              onClick={() => setPlanFilter("sin-plan-nutricional")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "sin-plan-nutricional" ? "border-slate-300/70 bg-slate-600/30 text-slate-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Sin nutricional ({planStatusSummary.sinNutricional})
            </ReliableActionButton>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total visibles</p>
              <p className="text-xl font-black text-white">{clientesFiltrados.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-emerald-200">Con plan</p>
              <p className="text-xl font-black text-emerald-100">{planStatusSummary.conPlan}</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Nutricional</p>
              <p className="text-xl font-black text-cyan-100">{planStatusSummary.conNutricional}</p>
            </div>
            <div className="rounded-2xl border border-lime-300/20 bg-lime-500/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-lime-200">En linea</p>
              <p className="text-xl font-black text-lime-100">{presenceSummary.online}</p>
            </div>
            <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-rose-200">Sin plan</p>
              <p className="text-xl font-black text-rose-100">{planStatusSummary.sinPlan}</p>
            </div>
            <div className="rounded-2xl border border-slate-300/20 bg-slate-500/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-200">Con actividad</p>
              <p className="text-xl font-black text-slate-100">{presenceSummary.withLastSeen}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-cyan-300/15 bg-white/[0.025] p-3 backdrop-blur-sm">
            {!alumnosLoaded ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-300">Cargando clientes...</p>
            ) : clientesFiltrados.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-300">No hay clientes en este apartado.</p>
            ) : (
              clientesFiltrados.map((cliente) => {
                const active = cliente.id === selectedClientId;
                const sesionesCount = sesionesPorCliente[cliente.id] || 0;
                const meta = getMeta(cliente);
                const presenceEmail = normalizePresenceEmail(meta.email);
                const presenceSnapshot = presenceEmail ? presenceByEmail[presenceEmail] : null;
                const presenceLabel = !presenceEmail
                  ? "Sin email"
                  : presenceSnapshot?.isOnline
                    ? "En linea"
                    : "Desconectado";
                const presenceTone = !presenceEmail
                  ? "bg-slate-700/60 text-slate-300"
                  : presenceSnapshot?.isOnline
                    ? "bg-emerald-500/20 text-emerald-100"
                    : "bg-slate-700/60 text-slate-200";
                const presenceLastSeenLabel = !presenceEmail
                  ? "Agrega email para monitorear"
                  : formatPresenceLastSeen(presenceSnapshot?.lastSeenAt || null);
                const userId = cliente.id.split(":")[1];
                const etiquetasCliente = etiquetasByUserId[userId] || [];
                const lastPayment = latestPaymentByClientId.get(cliente.id);
                const nutritionStatus = nutritionPlanStatusByClientId.get(cliente.id);

                return (
                  <article
                    key={cliente.id}
                    className={`pf-cliente-row${active ? " pf-cliente-row--active" : ""}`}
                    data-layout-lock="clientes-row-card"
                  >
                    <div className="flex flex-wrap items-center gap-2.5" data-layout-lock="clientes-row-content">
                      <div className="flex shrink-0 items-center justify-center">
                        {(() => {
                          const photo = resolveClientePhoto(cliente);
                          if (photo) {
                            return (
                              <img
                                src={photo}
                                alt={cliente.nombre}
                                className="h-10 w-10 rounded-full border border-cyan-300/35 object-cover"
                              />
                            );
                          }
                          return (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-500/15 text-xs font-black text-cyan-100">
                              {cliente.nombre
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase() || "")
                                .join("") || "CL"}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="min-w-[140px] flex-1">
                        <p className="truncate text-sm font-bold text-white">{cliente.nombre}</p>
                        <p className="truncate text-xs text-slate-300">{cliente.club || "Sin club"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${presenceTone}`}>
                            <span
                              className={`h-2 w-2 rounded-full ${presenceSnapshot?.isOnline ? "bg-emerald-300 shadow-[0_0_0_2px_rgba(16,185,129,0.26)]" : "bg-slate-400"}`}
                            />
                            {presenceLabel}
                          </span>
                          <span className="text-[10px] text-slate-400">{presenceLastSeenLabel}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cliente.tipo === "jugadora" ? "bg-cyan-500/20 text-cyan-100" : "bg-lime-500/20 text-lime-100"}`}>
                          {cliente.tipo === "jugadora" ? "Jugadora" : "Alumno/a"}
                        </span>
                      </div>

                      <div className="min-w-[110px] text-xs text-slate-200">
                        <p className="truncate">{cliente.categoria || cliente.deporte || "-"}</p>
                      </div>

                      <div className="flex min-w-[180px] flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sesionesCount > 0 ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/20 text-rose-100"}`}>
                          {sesionesCount > 0 ? `Con plan (${sesionesCount})` : "Sin plan"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${nutritionStatus?.hasPlan ? "bg-cyan-500/20 text-cyan-100" : "bg-slate-700/60 text-slate-300"}`}
                          title={nutritionStatus?.hasPlan ? nutritionStatus.planName : "Sin plan nutricional"}
                        >
                          {nutritionStatus?.hasPlan ? "Nutri: con plan" : "Nutri: sin plan"}
                        </span>
                      </div>

                      <div className="min-w-[120px] text-[11px]">
                        <p className="truncate text-slate-300">{meta.endDate || "Sin vencimiento"}</p>
                        <p className="truncate text-slate-400">{lastPayment ? `${lastPayment.moneda} ${lastPayment.importe.toLocaleString("es-AR")}` : "Sin pagos"}</p>
                      </div>

                      <div className="min-w-[220px] max-w-[320px]">
                        {etiquetasCliente.length === 0 ? (
                          <span className="inline-flex rounded-full border border-slate-500/50 bg-[#0e1012]/70 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                            Sin etiquetas
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {etiquetasCliente.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                className="max-w-[120px] truncate rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_2px_10px_rgba(15,23,42,0.35)]"
                                style={{ backgroundColor: tag.color || "#2196f3" }}
                                title={tag.texto}
                              >
                                {tag.texto}
                              </span>
                            ))}
                            {etiquetasCliente.length > 3 ? (
                              <span className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-2 py-1 text-[11px] font-bold text-cyan-100">
                                +{etiquetasCliente.length - 3}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <ReliableActionButton type="button" onClick={() => openClientDetail(cliente.id, "datos")} className="pf-row-btn" title="Ver ficha">👁</ReliableActionButton>
                        <ReliableActionButton type="button" onClick={() => openClientDetail(cliente.id, "notas")} className="pf-row-btn" title="Chat y notas">💬</ReliableActionButton>
                        <ReliableActionButton type="button" onClick={() => openWhatsapp(cliente)} disabled={!getMeta(cliente).telefono} className="pf-row-btn pf-row-btn--green" title="WhatsApp">🟢</ReliableActionButton>
                        <Link href={buildPlanViewHref(cliente.id, "plan-entrenamiento")} prefetch className="pf-row-btn pf-row-btn--cyan" title="Abrir plan en pantalla nueva">📌</Link>
                        <ReliableActionButton type="button" onClick={() => toggleEstado(cliente)} className="pf-row-btn" title="Activar/Finalizar">↔</ReliableActionButton>
                        <ReliableActionButton type="button" onClick={() => borrarCliente(cliente)} className="pf-row-btn pf-row-btn--red" title="Eliminar">🗑</ReliableActionButton>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
        ) : null}

        {isDetailMode ? (
        <div className="pf-card rounded-2xl border p-5  xl:p-6">
          {!selectedClient || !selectedMeta || !datosDraft ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm text-slate-300">Selecciona un cliente para abrir su ficha.</div>
          ) : (
            <>
              <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ficha del cliente</p>
                    <h2 className="text-lg font-bold text-white">{selectedClient.nombre}</h2>
                    <p className="text-xs text-slate-300">{selectedClient.tipo === "jugadora" ? "Perfil de jugadora" : "Perfil de alumno"}</p>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <ReliableActionButton
                      type="button"
                      onClick={() => openWhatsapp(selectedClient)}
                      disabled={!selectedMeta.telefono}
                      className="rounded-lg border border-emerald-300/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-40"
                    >
                      WhatsApp
                    </ReliableActionButton>
                    <ReliableActionButton
                      type="button"
                      onClick={closeClientDetail}
                      className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
                    >
                      Volver al listado
                    </ReliableActionButton>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-800/95 via-slate-800/75 to-slate-700/60 p-4">
                <div className="grid gap-3 md:grid-cols-6">
                  <div>
                    <p className="text-xs text-slate-300">Cliente:</p>
                    <p className="text-2xl font-black text-white">{selectedClient.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Ultimo Chequeo:</p>
                    <p className="font-bold text-white">{selectedMeta.lastCheck}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Proximo chequeo:</p>
                    <p className="font-bold text-white">{selectedMeta.nextCheck}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Altura:</p>
                    <p className="font-bold text-white">{selectedClient.altura || "SIN DATOS"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Obj. Nutricional:</p>
                    <p className="font-bold text-white">{selectedMeta.objNutricional || "SIN DATOS"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Plan nutricional:</p>
                    <p className="font-bold text-white">
                      {selectedNutritionPlan ? selectedNutritionPlan.nombre : "SIN PLAN"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {TABS.map((tab, index) => (
                    <ReliableActionButton
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setDetailTabId(tab.id);
                        pushUrlWithoutReload(buildClientDetailHref(selectedClient.id, tab.id));
                      }}
                      className={`pf-cliente-tab-card group relative overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition ${activeTab === tab.id ? "pf-cliente-tab-active border-[rgba(97,206,112,0.55)] bg-[rgba(97,206,112,0.10)] text-white shadow-[0_0_0_1px_rgba(97,206,112,0.15)]" : "border-white/[0.09] bg-[#0e1012] text-white/70 hover:border-white/[0.18] hover:bg-white/[0.03]"}`}
                      style={{ animationDelay: `${Math.min(index, 8) * 42}ms` }}
                    >
                      {activeTab === tab.id ? (
                        <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-cyan-100/90" />
                      ) : null}
                      <span className="relative flex items-start gap-2">
                        <span className="mt-0.5 text-base leading-none">{tab.icon}</span>
                        <span>
                          <span className="block text-sm font-bold leading-tight">{tab.label}</span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-300 group-hover:text-cyan-100">
                            Vista dedicada
                          </span>
                        </span>
                      </span>
                    </ReliableActionButton>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02]/35 p-2">
                  {/* Etiquetas chips visualización */}
                  <div className="w-full lg:w-auto">
                    <EtiquetasChips etiquetas={etiquetas} />
                  </div>
                  {/* Crear etiqueta */}
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await fetch("/api/etiquetas", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId: selectedClient.id.split(":")[1],
                          texto: etiquetaCrear.texto,
                          color: etiquetaCrear.color,
                        }),
                      });
                      if (res.ok) {
                        setEtiquetaCrear({ texto: "", color: "#2196f3" });
                        fetch(`/api/etiquetas?userId=${selectedClient.id.split(":")[1]}`)
                          .then((res) => res.json())
                          .then((data: Etiqueta[]) => {
                            setEtiquetas(data || []);
                            setEtiquetasByUserId((prev) => ({
                              ...prev,
                              [selectedClient.id.split(":")[1]]: data || [],
                            }));
                          });
                      }
                    }}
                  >
                    <input
                      value={etiquetaCrear.texto}
                      onChange={(e) => setEtiquetaCrear((prev) => ({ ...prev, texto: e.target.value }))}
                      placeholder="Nueva etiqueta"
                      className="rounded border border-white/20 bg-[#0e1012] px-2 py-1 text-xs"
                    />
                    <input
                      type="color"
                      value={etiquetaCrear.color}
                      onChange={(e) => setEtiquetaCrear((prev) => ({ ...prev, color: e.target.value }))}
                      className="w-8 h-8 border border-white/20"
                    />
                    <ReliableActionButton type="submit" className="pf-btn pf-btn--primary !rounded !px-2 !py-1 !text-xs">+</ReliableActionButton>
                  </form>
                  {/* Buscador por etiqueta */}
                  <input
                    value={etiquetaSearch}
                    onChange={(e) => setEtiquetaSearch(e.target.value)}
                    placeholder="Buscar por etiqueta"
                    className="rounded border border-white/20 bg-[#0e1012] px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div
                className={
                  activeTab === "plan-entrenamiento"
                    ? "mt-4"
                    : "mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 xl:p-6"
                }
              >
                {activeTab === "datos" ? (
                  <div className="space-y-4">
                  <div className="grid gap-5 xl:grid-cols-2">

                    {/* ── COLUMNA IZQUIERDA ── */}
                    <div className="space-y-3">

                      {/* PERFIL HEADER */}
                      <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0e1012] p-4 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(97,206,112,0.05),transparent_60%)]" />
                        <div className="relative flex items-center gap-3.5">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#61ce70] to-[#38a169] text-lg font-black text-white shadow-[0_0_16px_rgba(97,206,112,0.35)]">
                            {(datosDraft.nombre?.[0] || "?").toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/40">
                              {selectedClient.tipo === "jugadora" ? "Jugadora" : "Alumno"}
                            </p>
                            <h3 className="truncate text-base font-black leading-tight text-white">
                              {[datosDraft.nombre, selectedMeta.apellido].filter(Boolean).join(" ") || "Sin nombre"}
                            </h3>
                            <p className="truncate text-[11px] text-slate-500">{selectedMeta.email || "Sin email"}</p>
                          </div>
                          <span className={`ml-auto shrink-0 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest ${selectedClient.estado === "activo" ? "bg-emerald-500/15 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]" : "bg-rose-500/15 text-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.25)]"}`}>
                            {selectedClient.estado}
                          </span>
                        </div>
                      </div>

                      {/* IDENTIDAD Y CONTACTO */}
                      <div className="overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#0e1012] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
                          <span className="h-3 w-[3px] rounded-full bg-indigo-400 shadow-[0_0_7px_rgba(99,102,241,1)]" />
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-indigo-300/75">Identidad y contacto</p>
                        </div>
                        <div className="space-y-0 px-3 py-2">
                          {[
                            { label: "Nombre", node: <input value={datosDraft.nombre} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, nombre: e.target.value } : prev)} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm font-semibold text-white placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0_999px_#111827] [&:-webkit-autofill]:[color:white]" /> },
                            { label: "Apellido", node: <input value={selectedMeta.apellido} onChange={(e) => setMetaPatch(selectedClient.id, { apellido: e.target.value })} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm font-semibold text-white placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0_999px_#111827] [&:-webkit-autofill]:[color:white]" /> },
                            { label: "2do apellido", node: <input value={selectedMeta.segundoApellido} onChange={(e) => setMetaPatch(selectedClient.id, { segundoApellido: e.target.value })} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0_999px_#111827] [&:-webkit-autofill]:[color:white]" /> },
                            { label: "Email", node: <input value={selectedMeta.email} onChange={(e) => setMetaPatch(selectedClient.id, { email: e.target.value })} placeholder="email@ejemplo.com" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0_999px_#111827] [&:-webkit-autofill]:[color:white]" /> },
                            { label: "Nacimiento", node: <DateInput value={datosDraft?.fechaNacimiento || ""} onChange={(v) => setDatosDraft((prev) => prev ? { ...prev, fechaNacimiento: v } : prev)} className="w-full rounded-lg bg-[#111417] px-3 py-2 pr-8 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" /> },
                            { label: "Telefono", node: <input value={selectedMeta.telefono} onChange={(e) => setMetaPatch(selectedClient.id, { telefono: e.target.value })} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0_999px_#111827] [&:-webkit-autofill]:[color:white]" /> },
                            { label: "Cod. pais", node: <input value={selectedMeta.codigoPais} onChange={(e) => setMetaPatch(selectedClient.id, { codigoPais: e.target.value })} placeholder="+54" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0_999px_#111827] [&:-webkit-autofill]:[color:white]" /> },
                            { label: "Pais", node: <input value={selectedMeta.pais} onChange={(e) => setMetaPatch(selectedClient.id, { pais: e.target.value })} placeholder="Argentina" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0_999px_#111827] [&:-webkit-autofill]:[color:white]" /> },
                          ].map(({ label, node }) => (
                            <div key={label} className="py-1.5">
                              <p className="mb-1 text-[10px] font-medium text-slate-500">{label}</p>
                              {node}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* UBICACION Y PERFIL FISICO */}
                      <div className="overflow-hidden rounded-2xl border border-violet-500/30 bg-[#0e1012] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
                          <span className="h-3 w-[3px] rounded-full bg-violet-400 shadow-[0_0_7px_rgba(139,92,246,1)]" />
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-300/75">Ubicacion y perfil fisico</p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0 px-3 py-2">
                          {[
                            { label: "Provincia", node: <input value={selectedMeta.provincia} onChange={(e) => setMetaPatch(selectedClient.id, { provincia: e.target.value })} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" /> },
                            { label: "Calle", node: <input value={selectedMeta.calle} onChange={(e) => setMetaPatch(selectedClient.id, { calle: e.target.value })} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" /> },
                            { label: "Numero", node: <input value={selectedMeta.numero} onChange={(e) => setMetaPatch(selectedClient.id, { numero: e.target.value })} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" /> },
                            { label: "Piso", node: <input value={selectedMeta.piso} onChange={(e) => setMetaPatch(selectedClient.id, { piso: e.target.value })} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" /> },
                            { label: "Depto", node: <input value={selectedMeta.depto} onChange={(e) => setMetaPatch(selectedClient.id, { depto: e.target.value })} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" /> },
                            { label: "Sexo", node: <select value={selectedMeta.sexo} onChange={(e) => setMetaPatch(selectedClient.id, { sexo: e.target.value as "masculino" | "femenino" })} className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 focus:outline-none"><option value="masculino" className="bg-[#0e1012]">Masculino</option><option value="femenino" className="bg-[#0e1012]">Femenino</option></select> },
                            { label: "Altura (cm)", node: <input value={datosDraft.altura} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, altura: e.target.value } : prev)} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm font-semibold text-white placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" /> },
                            { label: "Peso (kg)", node: <input value={datosDraft.peso} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, peso: e.target.value } : prev)} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm font-semibold text-white placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" /> },
                          ].map(({ label, node }) => (
                            <div key={label} className="py-1.5">
                              <p className="mb-1 text-[10px] font-medium text-slate-500">{label}</p>
                              {node}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* ── COLUMNA DERECHA ── */}
                    <div className="space-y-3">

                      {/* VIGENCIA DEL PLAN */}
                      <div className="overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-[#0e1012] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
                          <span className="h-3 w-[3px] rounded-full bg-fuchsia-400 shadow-[0_0_7px_rgba(217,70,239,1)]" />
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-fuchsia-300/75">Vigencia del plan</p>
                          <p className="ml-auto text-[9px] text-slate-600">inicio → fin de asesoria</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-3">
                          <div>
                            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">Inicio</p>
                            <input type="date" value={selectedMeta.startDate} onChange={(e) => setMetaPatch(selectedClient.id, { startDate: e.target.value })} className="w-full rounded-lg bg-[#111417] px-2 py-2 text-xs font-bold text-fuchsia-200 focus:bg-white/[0.09] focus:outline-none [color-scheme:dark]" />
                          </div>
                          <div>
                            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">Fin</p>
                            <input type="date" value={selectedMeta.endDate} onChange={(e) => setMetaPatch(selectedClient.id, { endDate: e.target.value })} className="w-full rounded-lg bg-[#111417] px-2 py-2 text-xs font-bold text-fuchsia-200 focus:bg-white/[0.09] focus:outline-none [color-scheme:dark]" />
                          </div>
                          <div>
                            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">Categoria</p>
                            <input value={selectedMeta.categoriaPlan} onChange={(e) => setMetaPatch(selectedClient.id, { categoriaPlan: e.target.value })} placeholder="—" className="w-full rounded-lg bg-[#111417] px-2 py-2 text-xs font-bold text-fuchsia-200 placeholder:text-slate-700 focus:bg-white/[0.09] focus:outline-none" />
                          </div>
                        </div>
                      </div>

                      {/* RENOVACION AUTOMATICA */}
                      <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0e1012] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
                          <span className="h-3 w-[3px] rounded-full bg-amber-400 shadow-[0_0_7px_rgba(245,158,11,1)]" />
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300/75">Renovacion automatica</p>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <p className="text-[11px] text-slate-400">Extiende la fecha de fin al registrar pago.</p>
                          <label className="flex cursor-pointer items-center">
                            <input type="checkbox" checked={selectedMeta.autoRenewPlan} onChange={(e) => setMetaPatch(selectedClient.id, { autoRenewPlan: e.target.checked })} className="sr-only" />
                            <div className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${selectedMeta.autoRenewPlan ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.45)]" : "bg-[#0e1012]"}`}>
                              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${selectedMeta.autoRenewPlan ? "translate-x-5" : "translate-x-0.5"}`} />
                            </div>
                          </label>
                        </div>
                        <div className="px-3 pb-3">
                          <p className="mb-1 text-[10px] font-medium text-slate-500">Plazo (dias)</p>
                          <input type="number" min={1} max={365} value={selectedMeta.renewalDays} onChange={(e) => setMetaPatch(selectedClient.id, { renewalDays: Math.max(1, Math.min(365, Number(e.target.value || 30))) })} className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm font-bold text-white focus:bg-white/[0.09] focus:outline-none" />
                        </div>
                      </div>

                      {/* TIPO DE ASESORIA */}
                      <div className="overflow-hidden rounded-2xl border border-sky-500/30 bg-[#0e1012] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
                          <span className="h-3 w-[3px] rounded-full bg-sky-400 shadow-[0_0_7px_rgba(14,165,233,1)]" />
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-sky-300/75">Tipo de asesoria</p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0 px-3 py-2">
                          <div className="py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Tipo</p>
                            <select value={selectedMeta.tipoAsesoria} onChange={(e) => setMetaPatch(selectedClient.id, { tipoAsesoria: e.target.value as ClienteMeta["tipoAsesoria"] })} className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 focus:outline-none">
                              <option value="entrenamiento" className="bg-[#0e1012]">Entrenamiento</option>
                              <option value="nutricion" className="bg-[#0e1012]">Nutricion</option>
                              <option value="completa" className="bg-[#0e1012]">Completa</option>
                            </select>
                          </div>
                          <div className="py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Modalidad</p>
                            <select value={selectedMeta.modalidad} onChange={(e) => setMetaPatch(selectedClient.id, { modalidad: e.target.value as ClienteMeta["modalidad"] })} className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 focus:outline-none">
                              <option value="virtual" className="bg-[#0e1012]">Virtual</option>
                              <option value="presencial" className="bg-[#0e1012]">Presencial</option>
                            </select>
                          </div>
                          <div className="col-span-2 py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Colaboradores</p>
                            <div className="rounded-xl border border-sky-500/[0.12] bg-[#0e1012] px-3 py-2.5">
                              <textarea value={selectedMeta.colaboradores} onChange={(e) => setMetaPatch(selectedClient.id, { colaboradores: e.target.value })} placeholder="Colaboradores asignados..." rows={2} className="w-full resize-none bg-transparent text-sm leading-relaxed text-slate-300 placeholder:text-slate-600 focus:outline-none" />
                            </div>
                          </div>
                          <div className="col-span-2 py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Chats / Notas internas</p>
                            <div className="rounded-xl border border-sky-500/[0.12] bg-[#0e1012] px-3 py-2.5">
                              <textarea value={selectedMeta.chats} onChange={(e) => setMetaPatch(selectedClient.id, { chats: e.target.value })} placeholder="Notas de seguimiento..." rows={2} className="w-full resize-none bg-transparent text-sm leading-relaxed text-slate-300 placeholder:text-slate-600 focus:outline-none" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ASIGNAR PLAN */}
                      {isAdmin && planesDisponibles.filter((p) => p.activo).length > 0 && (
                        <div className="overflow-hidden rounded-2xl border border-rose-500/30 bg-[#0e1012] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                          <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
                            <span className="h-3 w-[3px] rounded-full bg-rose-400 shadow-[0_0_7px_rgba(239,68,68,1)]" />
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-rose-300/75">Asignar plan</p>
                          </div>
                          <div className="space-y-3 p-3">
                            <select value={planSeleccionado} onChange={(e) => setPlanSeleccionado(e.target.value)} className="w-full rounded-lg bg-[#111417] px-3 py-2.5 text-sm text-white focus:outline-none">
                              <option value="">Seleccionar plan...</option>
                              {planesDisponibles.filter((p) => p.activo).map((p) => (
                                <option key={p.id} value={p.id} className="bg-[#0e1012]">
                                  {p.nombre} — {p.moneda} {p.precio.toLocaleString("es-AR")} / {p.duracionDias} días
                                </option>
                              ))}
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={!planSeleccionado}
                                onClick={() => {
                                  const plan = planesDisponibles.find((p) => p.id === planSeleccionado);
                                  if (!plan) return;
                                  const today = new Date().toISOString().slice(0, 10);
                                  const end = new Date(Date.now() + plan.duracionDias * 86400000).toISOString().slice(0, 10);
                                  setMetaPatch(selectedClient.id, {
                                    importe: String(plan.precio),
                                    moneda: plan.moneda,
                                    renewalDays: plan.duracionDias,
                                    pagoEstado: "confirmado",
                                    startDate: today,
                                    endDate: end,
                                  });
                                  markManualSaveIntent(CLIENTE_META_KEY);
                                  setPlanSeleccionado("");
                                }}
                                className="rounded-xl bg-emerald-600/75 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500/90 disabled:opacity-40 active:scale-[0.97]"
                              >
                                Sin cobrar
                              </button>
                              <button
                                type="button"
                                disabled={!planSeleccionado}
                                onClick={() => {
                                  const plan = planesDisponibles.find((p) => p.id === planSeleccionado);
                                  if (!plan) return;
                                  setMetaPatch(selectedClient.id, {
                                    importe: String(plan.precio),
                                    moneda: plan.moneda,
                                    renewalDays: plan.duracionDias,
                                    pagoEstado: "pendiente",
                                  });
                                  markManualSaveIntent(CLIENTE_META_KEY);
                                  setPlanSeleccionado("");
                                }}
                                className="rounded-xl bg-rose-600/75 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500/90 disabled:opacity-40 active:scale-[0.97]"
                              >
                                Cobrar y registrar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── COBRO POR MERCADO PAGO ── */}
                      {isAdmin && (
                        <div className="overflow-hidden rounded-2xl border border-[#009ee3]/30 bg-[#0e1012] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                          <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
                            <span className="h-3 w-[3px] rounded-full bg-[#009ee3] shadow-[0_0_7px_rgba(0,158,227,0.9)]" />
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#009ee3]/80">Cobro Mercado Pago</p>
                          </div>
                          <div className="space-y-2.5 p-3">
                            {/* Email del alumno que se usará */}
                            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-xs">
                              <span className="text-slate-500">Email del alumno:</span>
                              {selectedMeta.email
                                ? <span className="font-semibold text-slate-200">{selectedMeta.email}</span>
                                : <span className="font-semibold text-amber-400">⚠ Sin email — configuralo en la pestaña Datos</span>
                              }
                            </div>

                            {planesDisponibles.filter((p) => p.activo).length === 0 ? (
                              <p className="text-xs text-amber-300/90">Sin planes activos. Creá uno en Admin › Pagos.</p>
                            ) : (
                              <>
                                <select
                                  value={mpPlanSeleccionado}
                                  onChange={(e) => { setMpPlanSeleccionado(e.target.value); setMpCheckoutUrl(null); setMpCheckoutError(""); }}
                                  className="w-full rounded-lg bg-[#111417] px-3 py-2.5 text-sm text-white focus:outline-none"
                                >
                                  <option value="" className="bg-[#0e1012]">Seleccioná un plan...</option>
                                  {planesDisponibles.filter((p) => p.activo).map((p) => (
                                    <option key={p.id} value={p.id} className="bg-[#0e1012]">
                                      {p.nombre} — {p.moneda} {p.precio.toLocaleString("es-AR")} / {p.duracionDias} días
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={mpCheckoutLoading || !mpPlanSeleccionado || !selectedMeta.email}
                                  onClick={() => void generarLinkMP()}
                                  className="w-full rounded-xl bg-[#009ee3] py-2.5 text-sm font-bold text-white shadow-[0_0_14px_rgba(0,158,227,0.35)] transition hover:bg-[#008dcc] disabled:opacity-40 active:scale-[0.97]"
                                >
                                  {mpCheckoutLoading ? "Generando..." : "🔗 Generar link de pago MP"}
                                </button>
                              </>
                            )}

                            {mpCheckoutError && (
                              <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{mpCheckoutError}</p>
                            )}

                            {mpCheckoutUrl && (
                              <div className="space-y-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300">✓ Link generado — compartilo con el alumno</p>
                                <p className="break-all rounded-lg bg-black/40 px-2 py-2 text-[11px] font-mono leading-relaxed text-emerald-200">{mpCheckoutUrl}</p>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => { void navigator.clipboard.writeText(mpCheckoutUrl); }}
                                    className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
                                  >
                                    Copiar link
                                  </button>
                                  <a
                                    href={mpCheckoutUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
                                  >
                                    Ir al checkout →
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* DETALLE DE PAGOS */}
                      <div className="overflow-hidden rounded-2xl border border-yellow-500/30 bg-[#0e1012] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="h-3 w-[3px] rounded-full bg-yellow-400 shadow-[0_0_7px_rgba(234,179,8,1)]" />
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-yellow-300/75">Detalle de pagos</p>
                          </div>
                          <span className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest ${selectedMeta.pagoEstado === "confirmado" ? "bg-emerald-500/15 text-emerald-400 shadow-[0_0_9px_rgba(16,185,129,0.25)]" : "bg-amber-500/15 text-amber-400 shadow-[0_0_9px_rgba(245,158,11,0.25)]"}`}>
                            {selectedMeta.pagoEstado === "confirmado" ? "✓ Confirmado" : "⏳ Pendiente"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0 px-3 py-2">
                          <div className="py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Moneda</p>
                            <select value={selectedMeta.moneda} onChange={(e) => setMetaPatch(selectedClient.id, { moneda: e.target.value })} className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 focus:outline-none">
                              <option value="ARS" className="bg-[#0e1012]">ARS</option>
                              <option value="USD" className="bg-[#0e1012]">USD</option>
                            </select>
                          </div>
                          <div className="py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Estado</p>
                            <select value={selectedMeta.pagoEstado} onChange={(e) => setMetaPatch(selectedClient.id, { pagoEstado: e.target.value as ClienteMeta["pagoEstado"] })} className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 focus:outline-none">
                              <option value="confirmado" className="bg-[#0e1012]">Pago confirmado</option>
                              <option value="pendiente" className="bg-[#0e1012]">Pago pendiente</option>
                            </select>
                          </div>
                          <div className="py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Importe</p>
                            <input value={selectedMeta.importe} onChange={(e) => setMetaPatch(selectedClient.id, { importe: e.target.value })} placeholder="0" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm font-bold text-white placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" />
                          </div>
                          <div className="py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Saldo</p>
                            <input value={selectedMeta.saldo} onChange={(e) => setMetaPatch(selectedClient.id, { saldo: e.target.value })} placeholder="0" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm font-bold text-white placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" />
                          </div>
                          <div className="col-span-2 py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Email pagador</p>
                            <input value={selectedMeta.emailPagador} onChange={(e) => setMetaPatch(selectedClient.id, { emailPagador: e.target.value })} placeholder="email@ejemplo.com" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0_999px_#111827] [&:-webkit-autofill]:[color:white]" />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>{/* fin grid 2 cols */}

                  {/* ── CONTEXTO DEPORTIVO — full width ── */}
                  <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#0e1012] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.8)]">
                    <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
                      <span className="h-3 w-[3px] rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(16,185,129,1)]" />
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300/75">Contexto deportivo</p>
                    </div>
                    <div className="grid gap-x-4 gap-y-0 px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="py-1.5">
                        <p className="mb-1 text-[10px] font-medium text-slate-500">Club</p>
                        <input value={datosDraft.club} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, club: e.target.value } : prev)} placeholder="—" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" />
                      </div>
                      <div className="py-1.5">
                        <p className="mb-1 text-[10px] font-medium text-slate-500">Objetivo</p>
                        <input value={datosDraft.objetivo} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, objetivo: e.target.value } : prev)} placeholder="Objetivo principal" className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:bg-white/[0.09] focus:outline-none" />
                      </div>
                      {selectedClient.tipo === "jugadora" ? (
                        <>
                          <div className="py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Deporte</p>
                            <select value={datosDraft.deporte} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, deporte: e.target.value, posicion: "" } : prev)} className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 focus:outline-none">
                              {deportesOptions.map((item) => <option key={item} value={item} className="bg-[#0e1012]">{item}</option>)}
                            </select>
                          </div>
                          <div className="py-1.5">
                            <p className="mb-1 text-[10px] font-medium text-slate-500">Posicion</p>
                            <select value={datosDraft.posicion} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, posicion: e.target.value } : prev)} className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 focus:outline-none">
                              <option value="" className="bg-[#0e1012]">Sin posicion</option>
                              {(deportes.find((dep) => dep.nombre === datosDraft.deporte)?.posiciones || []).map((item) => <option key={item} value={item} className="bg-[#0e1012]">{item}</option>)}
                            </select>
                          </div>
                        </>
                      ) : (
                        <div className="py-1.5 sm:col-span-2">
                          <p className="mb-1 text-[10px] font-medium text-slate-500">Observaciones</p>
                          <div className="rounded-xl border border-emerald-500/[0.12] bg-[#0e1012] px-3 py-2.5">
                            <textarea value={datosDraft.observaciones} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, observaciones: e.target.value } : prev)} placeholder="Notas adicionales sobre el contexto del cliente..." rows={2} className="w-full resize-none bg-transparent text-sm leading-relaxed text-slate-300 placeholder:text-slate-600 focus:outline-none" />
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedClient.tipo === "jugadora" && (
                      <div className="grid gap-x-4 gap-y-0 border-t border-white/[0.04] px-4 py-3 sm:grid-cols-2">
                        <div className="py-1.5">
                          <p className="mb-1 text-[10px] font-medium text-slate-500">Categoria</p>
                          <select value={datosDraft.categoria} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, categoria: e.target.value } : prev)} className="w-full rounded-lg bg-[#111417] px-3 py-2 text-sm text-slate-200 focus:outline-none">
                            {categoriasOptions.map((item) => <option key={item} value={item} className="bg-[#0e1012]">{item}</option>)}
                          </select>
                        </div>
                        <div className="py-1.5">
                          <p className="mb-1 text-[10px] font-medium text-slate-500">Observaciones</p>
                          <div className="rounded-xl border border-emerald-500/[0.12] bg-[#0e1012] px-3 py-2.5">
                            <textarea value={datosDraft.observaciones} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, observaciones: e.target.value } : prev)} placeholder="Notas adicionales..." rows={2} className="w-full resize-none bg-transparent text-sm leading-relaxed text-slate-300 placeholder:text-slate-600 focus:outline-none" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* GUARDAR — full width */}
                  <ReliableActionButton type="button" onClick={saveDatosGenerales} className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 py-3 text-sm font-black text-white shadow-[0_0_22px_rgba(139,92,246,0.4)] transition hover:opacity-90 active:scale-[0.98]">
                    Guardar cambios
                  </ReliableActionButton>

                  </div>
                ) : activeTab === "plan-entrenamiento" ? (
                  <div className="rounded-[30px] border border-cyan-300/32 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),rgba(15,23,42,0.88)_45%,rgba(2,6,23,0.96)_100%)] px-4 py-5 shadow-[0_28px_70px_-46px_rgba(34,211,238,0.55)] sm:px-5 lg:px-7 lg:py-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/85">
                          {canEditTrainingPlan ? "Vista admin" : "Vista cliente"}
                        </p>
                        <h3 className="mt-1 text-xl font-black text-white">Plan de entrenamiento</h3>
                        <p className="mt-1 text-sm text-slate-200/90">
                          {canEditTrainingPlan
                            ? "Edicion directa estilo templates: semanas, dias, bloques y ejercicios en la misma pantalla."
                            : "Lectura completa del plan semanal con estructura de template."}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <ReliableActionButton
                          type="button"
                          onClick={() => setShowAssignPlanModal(true)}
                          className="rounded-lg border border-cyan-300/35 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
                        >
                          📋 Asignar template
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={reloadTrainingPlanOnly}
                          disabled={trainingPlanReloading}
                          className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                        >
                          {trainingPlanReloading ? "Recargando plan..." : "Recargar plan"}
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={syncTrainingPlanWithAlumnoProfile}
                          disabled={!selectedClientTrainingPlan}
                          className={`relative rounded-lg border px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-60 ${hasUnsavedTrainingChanges ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.35)] hover:bg-emerald-500/30" : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"}`}
                        >
                          {hasUnsavedTrainingChanges && (
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,1)]" />
                          )}
                          Actualizar planilla
                        </ReliableActionButton>
                        {selectedClientTrainingPlan && (
                          <ReliableActionButton
                            type="button"
                            onClick={() => setSaveAsTemplateModal({ name: `Template — ${selectedClient?.nombre || ""}`.trim() })}
                            className="rounded-lg border border-fuchsia-300/30 bg-fuchsia-500/8 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/18"
                          >
                            💾 Guardar como template
                          </ReliableActionButton>
                        )}
                        {selectedClientTrainingPlan && (
                          <div className="relative">
                            <ReliableActionButton
                              type="button"
                              onClick={() => setPrintMenuOpen((v) => !v)}
                              className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                            >
                              🖨️ Imprimir ▾
                            </ReliableActionButton>
                            {printMenuOpen && (
                              <>
                                <button
                                  type="button"
                                  aria-hidden
                                  onClick={() => setPrintMenuOpen(false)}
                                  className="fixed inset-0 z-40 cursor-default"
                                />
                                <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-white/12 bg-[#1c2027] py-1 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                                  <button
                                    type="button"
                                    disabled={!selectedTrainingDay}
                                    onClick={() => { setPrintMenuOpen(false); setRutinaPrintMode("dia"); }}
                                    className="block w-full px-4 py-2.5 text-left text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Día actual
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!selectedTrainingWeek}
                                    onClick={() => { setPrintMenuOpen(false); setRutinaPrintMode("semana"); }}
                                    className="block w-full px-4 py-2.5 text-left text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Semana completa
                                  </button>
                                  <div className="my-1 h-px bg-white/10" />
                                  <button
                                    type="button"
                                    disabled={!selectedTrainingDay}
                                    onClick={() => { setPrintMenuOpen(false); setRutinaPrintMode("dia-blanco"); }}
                                    className="block w-full px-4 py-2.5 text-left text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Día (en blanco)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!selectedTrainingWeek}
                                    onClick={() => { setPrintMenuOpen(false); setRutinaPrintMode("semana-blanco"); }}
                                    className="block w-full px-4 py-2.5 text-left text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Semana (en blanco)
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <p className="w-full text-[11px] text-slate-300/85">
                        Recargar plan actualiza solo esta seccion. Recargar el navegador actualiza toda la pagina.
                      </p>
                    </div>

                    {rutinaPrintMode && (
                      <RutinaPrintOverlay
                        mode={rutinaPrintMode}
                        clientName={selectedClient?.nombre || ""}
                        week={selectedTrainingWeek}
                        day={selectedTrainingDay}
                        ejercicios={ejercicios}
                        onClose={() => setRutinaPrintMode(null)}
                      />
                    )}

                    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-white/15 bg-[#0e1012] px-3 py-1 text-slate-100">
                        Semanas: <span className="font-bold text-white">{trainingPreviewStats.totalSemanas}</span>
                      </span>
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-cyan-100">
                        Dias: <span className="font-bold">{trainingPreviewStats.totalDias}</span>
                      </span>
                      <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">
                        Bloques: <span className="font-bold">{trainingPreviewStats.totalBloques}</span>
                      </span>
                    </div>

                    {!selectedClientTrainingPlan ? (
                      <div className="pf-card rounded-2xl border p-6 text-center">
                        <p className="text-2xl mb-2">🏋</p>
                        <p className="text-sm font-medium text-slate-200">Sin plan de entrenamiento</p>
                        <p className="mt-1 text-xs text-slate-400">Asigná un template o creá uno desde cero.</p>
                        {canEditTrainingPlan ? (
                          <div className="mt-4 flex justify-center gap-2">
                            <ReliableActionButton
                              type="button"
                              onClick={() => setShowAssignPlanModal(true)}
                              className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                            >
                              📋 Asignar template
                            </ReliableActionButton>
                            <ReliableActionButton
                              type="button"
                              onClick={createTrainingPlanForSelectedClient}
                              className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
                            >
                              + Crear desde cero
                            </ReliableActionButton>
                          </div>
                        ) : null}
                      </div>
                    ) : canEditTrainingPlan ? (
                      <div className="space-y-4">
                        <div className="space-y-4 border-t border-cyan-300/18 pt-4">
                          <section className="space-y-2 border-l-2 border-cyan-300/45 pl-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">Semanas</p>
                            <div className="flex flex-wrap items-center gap-2.5 pb-1 pr-1">
                              {allTrainingWeeks.map((week, weekIndex) => {
                                const weekLabel = String(week.nombre || `Semana ${weekIndex + 1}`);
                                const isWeekHidden = Boolean(week.oculto);
                                const weekVisibilityIndex = isWeekHidden
                                  ? weekIndex - visibleTrainingWeeks.length
                                  : weekIndex;
                                const weekVisibilitySize = isWeekHidden
                                  ? hiddenTrainingWeeks.length
                                  : visibleTrainingWeeks.length;
                                const isEditingWeek = trainingWeekInlineEdit?.weekId === week.id;
                                const weekMenuOpen =
                                  trainingStructureMenu?.type === "week" &&
                                  trainingStructureMenu.weekId === week.id;

                                if (isEditingWeek && trainingWeekInlineEdit) {
                                  return (
                                    <input
                                      key={week.id}
                                      autoFocus
                                      value={trainingWeekInlineEdit.value}
                                      onChange={(event) =>
                                        setTrainingWeekInlineEdit((prev) =>
                                          prev && prev.weekId === week.id
                                            ? {
                                                ...prev,
                                                value: event.target.value,
                                              }
                                            : prev
                                        )
                                      }
                                      onBlur={commitTrainingWeekInlineEdit}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          commitTrainingWeekInlineEdit();
                                        }
                                        if (event.key === "Escape") {
                                          event.preventDefault();
                                          setTrainingWeekInlineEdit(null);
                                        }
                                      }}
                                      className="h-10 min-w-[138px] rounded-2xl border border-cyan-200/70 bg-[#0e1012]/85 px-3.5 py-1.5 text-sm font-bold text-cyan-100 outline-none focus:border-cyan-100"
                                    />
                                  );
                                }

                                return (
                                  <div
                                    key={week.id}
                                    ref={weekMenuOpen ? trainingStructureMenuRef : undefined}
                                    className="relative inline-flex items-center gap-1.5"
                                  >
                                    <ReliableActionButton
                                      type="button"
                                      onClick={() => {
                                        if (!isWeekHidden) {
                                          selectTrainingPreviewWeek(week.id);
                                        }
                                        setTrainingStructureMenu(null);
                                      }}
                                      onDoubleClick={() => startTrainingWeekInlineEdit(week.id, weekLabel)}
                                      title="Doble click para editar"
                                      className={`rounded-2xl border px-4 py-2 text-sm font-bold transition ${
                                        isWeekHidden
                                          ? "border-slate-600/55 bg-[#0e1012]/90 text-slate-300 hover:border-slate-500/70"
                                          : trainingPreviewWeekId === week.id
                                          ? "border-cyan-100/90 bg-cyan-300/95 text-slate-950 shadow-[0_14px_28px_-18px_rgba(34,211,238,0.95)]"
                                          : "border-slate-500/45 bg-[#0e1012] text-slate-100 hover:border-cyan-300/55 hover:bg-[#0e1012]/80"
                                      }`}
                                    >
                                      <span className="inline-flex items-center gap-1.5">
                                        {isWeekHidden ? <HiddenVisibilityIcon className="h-3.5 w-3.5" /> : null}
                                        <span>{weekLabel}</span>
                                      </span>
                                    </ReliableActionButton>
                                    <ReliableActionButton
                                      type="button"
                                      onClick={(e) => toggleTrainingWeekMenu(week.id, e)}
                                      className={`h-7 w-7 rounded-full border p-0 text-sm font-semibold transition ${
                                        weekMenuOpen
                                          ? "border-cyan-300/70 bg-slate-700/95 text-cyan-100"
                                          : "border-white/20 bg-[#0e1012] text-slate-100 hover:border-cyan-300/55 hover:text-cyan-100"
                                      }`}
                                      aria-label={`Opciones de ${weekLabel}`}
                                    >
                                      ⋯
                                    </ReliableActionButton>

                                    <PortalMenu
                                      open={weekMenuOpen}
                                      anchor={menuAnchorRect}
                                      panelRef={trainingStructureMenuPanelRef}
                                    >
                                        <ReliableActionButton
                                          type="button"
                                          onClick={() => {
                                            startTrainingWeekInlineEdit(week.id, weekLabel);
                                            setTrainingStructureMenu(null);
                                          }}
                                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
                                        >
                                          Editar nombre
                                        </ReliableActionButton>
                                        <ReliableActionButton
                                          type="button"
                                          onClick={() => moveTrainingWeek(week.id, -1)}
                                          disabled={weekVisibilityIndex <= 0}
                                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10 disabled:opacity-40"
                                        >
                                          Mover a la izquierda
                                        </ReliableActionButton>
                                        <ReliableActionButton
                                          type="button"
                                          onClick={() => moveTrainingWeek(week.id, 1)}
                                          disabled={weekVisibilityIndex >= weekVisibilitySize - 1}
                                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10 disabled:opacity-40"
                                        >
                                          Mover a la derecha
                                        </ReliableActionButton>
                                        <ReliableActionButton
                                          type="button"
                                          onClick={() => duplicateTrainingWeek(week.id)}
                                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
                                        >
                                          Duplicar
                                        </ReliableActionButton>
                                        {isWeekHidden ? (
                                          <ReliableActionButton
                                            type="button"
                                            onClick={() => showTrainingWeek(week.id)}
                                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-emerald-100 hover:bg-emerald-500/15"
                                          >
                                            Mostrar semana
                                          </ReliableActionButton>
                                        ) : (
                                          <ReliableActionButton
                                            type="button"
                                            onClick={() => hideTrainingWeek(week.id)}
                                            disabled={visibleTrainingWeeks.length <= 1}
                                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10 disabled:opacity-40"
                                          >
                                            Ocultar semana
                                          </ReliableActionButton>
                                        )}
                                        <ReliableActionButton
                                          type="button"
                                          onClick={() => {
                                            setTrainingStructureMenu(null);
                                            removeTrainingWeek(week.id);
                                          }}
                                          disabled={allTrainingWeeks.length <= 1}
                                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-200 hover:bg-rose-500/15 disabled:opacity-40"
                                        >
                                          Eliminar
                                        </ReliableActionButton>
                                    </PortalMenu>
                                  </div>
                                );
                              })}
                              <ReliableActionButton
                                type="button"
                                onClick={addTrainingWeek}
                                reliabilityMode="off"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-500/20 text-lg font-black text-cyan-100 hover:bg-cyan-500/32"
                                aria-label="Agregar semana"
                              >
                                +
                              </ReliableActionButton>
                            </div>
                          </section>

                          <section className="space-y-2 border-l-2 border-emerald-300/45 border-t border-white/10 pl-3 pt-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-100">Dias</p>
                            {selectedTrainingWeek ? (
                              <div className="flex flex-wrap items-center gap-2.5 pb-1 pr-1">
                                {allTrainingDays.map((day, dayIndex) => {
                                  const dayLabel = String(day.dia || `Dia ${dayIndex + 1}`);
                                  const isDayHidden = Boolean(day.oculto);
                                  const dayVisibilityIndex = isDayHidden
                                    ? dayIndex - visibleTrainingDays.length
                                    : dayIndex;
                                  const dayVisibilitySize = isDayHidden
                                    ? hiddenTrainingDays.length
                                    : visibleTrainingDays.length;
                                  const isEditingDay =
                                    trainingDayInlineEdit?.weekId === selectedTrainingWeek.id &&
                                    trainingDayInlineEdit?.dayId === day.id;
                                  const dayMenuOpen =
                                    trainingStructureMenu?.type === "day" &&
                                    trainingStructureMenu.weekId === selectedTrainingWeek.id &&
                                    trainingStructureMenu.dayId === day.id;

                                  if (isEditingDay && trainingDayInlineEdit) {
                                    return (
                                      <input
                                        key={day.id}
                                        autoFocus
                                        value={trainingDayInlineEdit.value}
                                        onChange={(event) =>
                                          setTrainingDayInlineEdit((prev) =>
                                            prev &&
                                            prev.weekId === selectedTrainingWeek.id &&
                                            prev.dayId === day.id
                                              ? {
                                                  ...prev,
                                                  value: event.target.value,
                                                }
                                              : prev
                                          )
                                        }
                                        onBlur={commitTrainingDayInlineEdit}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            event.preventDefault();
                                            commitTrainingDayInlineEdit();
                                          }
                                          if (event.key === "Escape") {
                                            event.preventDefault();
                                            setTrainingDayInlineEdit(null);
                                          }
                                        }}
                                        className="h-10 min-w-[128px] rounded-2xl border border-emerald-200/70 bg-[#0e1012]/85 px-3.5 py-1.5 text-sm font-bold text-emerald-100 outline-none focus:border-emerald-100"
                                      />
                                    );
                                  }

                                  return (
                                    <div
                                      key={day.id}
                                      ref={dayMenuOpen ? trainingStructureMenuRef : undefined}
                                      className="relative inline-flex items-center gap-1.5"
                                    >
                                      <ReliableActionButton
                                        type="button"
                                        onClick={() => {
                                          if (!isDayHidden) {
                                            selectTrainingPreviewDay(day.id);
                                          }
                                          setTrainingStructureMenu(null);
                                        }}
                                        onDoubleClick={() =>
                                          startTrainingDayInlineEdit(
                                            selectedTrainingWeek.id,
                                            day.id,
                                            dayLabel
                                          )
                                        }
                                        title="Doble click para editar"
                                        className={`rounded-2xl border px-4 py-2 text-sm font-bold transition ${
                                          isDayHidden
                                            ? "border-slate-600/55 bg-[#0e1012]/90 text-slate-300 hover:border-slate-500/70"
                                            : trainingPreviewDayId === day.id
                                            ? "border-emerald-100/90 bg-emerald-300/95 text-slate-950 shadow-[0_14px_28px_-18px_rgba(16,185,129,0.95)]"
                                            : "border-slate-500/45 bg-[#0e1012] text-slate-100 hover:border-emerald-300/55 hover:bg-[#0e1012]/80"
                                        }`}
                                      >
                                        <span className="inline-flex items-center gap-1.5">
                                          {isDayHidden ? <HiddenVisibilityIcon className="h-3.5 w-3.5" /> : null}
                                          <span>{dayLabel}</span>
                                        </span>
                                      </ReliableActionButton>
                                      <ReliableActionButton
                                        type="button"
                                        onClick={(e) => toggleTrainingDayMenu(selectedTrainingWeek.id, day.id, e)}
                                        className={`h-7 w-7 rounded-full border p-0 text-sm font-semibold transition ${
                                          dayMenuOpen
                                            ? "border-emerald-300/70 bg-slate-700/95 text-emerald-100"
                                            : "border-white/20 bg-[#0e1012] text-slate-100 hover:border-emerald-300/55 hover:text-emerald-100"
                                        }`}
                                        aria-label={`Opciones de ${dayLabel}`}
                                      >
                                        ⋯
                                      </ReliableActionButton>

                                      <PortalMenu
                                        open={dayMenuOpen}
                                        anchor={menuAnchorRect}
                                        panelRef={trainingStructureMenuPanelRef}
                                      >
                                          <ReliableActionButton
                                            type="button"
                                            onClick={() => {
                                              startTrainingDayInlineEdit(
                                                selectedTrainingWeek.id,
                                                day.id,
                                                dayLabel
                                              );
                                              setTrainingStructureMenu(null);
                                            }}
                                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
                                          >
                                            Editar nombre
                                          </ReliableActionButton>
                                          <ReliableActionButton
                                            type="button"
                                            onClick={() =>
                                              moveTrainingDay(selectedTrainingWeek.id, day.id, -1)
                                            }
                                            disabled={dayVisibilityIndex <= 0}
                                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10 disabled:opacity-40"
                                          >
                                            Mover a la izquierda
                                          </ReliableActionButton>
                                          <ReliableActionButton
                                            type="button"
                                            onClick={() =>
                                              moveTrainingDay(selectedTrainingWeek.id, day.id, 1)
                                            }
                                            disabled={dayVisibilityIndex >= dayVisibilitySize - 1}
                                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10 disabled:opacity-40"
                                          >
                                            Mover a la derecha
                                          </ReliableActionButton>
                                          <ReliableActionButton
                                            type="button"
                                            onClick={() =>
                                              duplicateTrainingDay(selectedTrainingWeek.id, day.id)
                                            }
                                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
                                          >
                                            Duplicar
                                          </ReliableActionButton>
                                          {isDayHidden ? (
                                            <ReliableActionButton
                                              type="button"
                                              onClick={() => showTrainingDay(selectedTrainingWeek.id, day.id)}
                                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-emerald-100 hover:bg-emerald-500/15"
                                            >
                                              Mostrar dia
                                            </ReliableActionButton>
                                          ) : (
                                            <ReliableActionButton
                                              type="button"
                                              onClick={() => hideTrainingDay(selectedTrainingWeek.id, day.id)}
                                              disabled={visibleTrainingDays.length <= 1}
                                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10 disabled:opacity-40"
                                            >
                                              Ocultar dia
                                            </ReliableActionButton>
                                          )}
                                          <ReliableActionButton
                                            type="button"
                                            onClick={() => {
                                              setTrainingStructureMenu(null);
                                              removeTrainingDay(selectedTrainingWeek.id, day.id);
                                            }}
                                            disabled={allTrainingDays.length <= 1}
                                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-200 hover:bg-rose-500/15 disabled:opacity-40"
                                          >
                                            Eliminar
                                          </ReliableActionButton>
                                      </PortalMenu>
                                    </div>
                                  );
                                })}
                                <ReliableActionButton
                                  type="button"
                                  onClick={() => addTrainingDay(selectedTrainingWeek.id)}
                                  reliabilityMode="off"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-500/20 text-lg font-black text-emerald-100 hover:bg-emerald-500/32"
                                  aria-label="Agregar dia"
                                >
                                  +
                                </ReliableActionButton>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-300">Selecciona una semana para ver los dias.</p>
                            )}
                          </section>
                        </div>

                        {selectedTrainingWeek ? (
                          <section className="space-y-4 border-t border-cyan-300/18 pt-4">
                            {selectedTrainingDay ? (
                                <div className="space-y-3 pt-2">
                                  <section className="rounded-2xl border border-emerald-300/25 bg-emerald-500/[0.07] p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-100">
                                          Feedback post sesion
                                        </p>
                                        <p className="mt-1 text-xs text-emerald-50/90">
                                          Este cuestionario se muestra al alumno al finalizar el dia.
                                          {selectedTrainingDayFeedbackConfig?.enabled
                                            ? " · Activo."
                                            : " · Inactivo."}
                                        </p>
                                      </div>

                                      <ReliableActionButton
                                        type="button"
                                        onClick={() =>
                                          openFeedbackModal(
                                            selectedTrainingWeek.id,
                                            selectedTrainingDay.id,
                                            selectedTrainingDayFeedbackConfig
                                          )
                                        }
                                        className="rounded-full border border-emerald-300/45 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-50 hover:bg-emerald-500/30"
                                      >
                                        {selectedTrainingDayFeedbackConfig?.enabled
                                          ? "Editar feedback"
                                          : "Activar feedback"}
                                      </ReliableActionButton>
                                    </div>

                                    {selectedTrainingDayFeedbackConfig?.enabled && Array.isArray(selectedTrainingDayFeedbackConfig?.measurements) && selectedTrainingDayFeedbackConfig.measurements.length > 0 ? (
                                      <div className="mt-3 flex flex-wrap gap-1.5">
                                        {selectedTrainingDayFeedbackConfig.measurements
                                          .filter((m) => m.visible)
                                          .map((m) => {
                                            const catalog = POST_SESSION_MEASUREMENT_CATALOG.find((entry) => entry.id === m.id);
                                            if (!catalog) return null;
                                            return (
                                              <span
                                                key={m.id}
                                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                                  m.obligatoria
                                                    ? "border-amber-300/60 bg-amber-500/15 text-amber-100"
                                                    : "border-emerald-300/40 bg-emerald-500/12 text-emerald-100"
                                                }`}
                                              >
                                                {catalog.nombre}
                                                {m.obligatoria ? " *" : ""}
                                              </span>
                                            );
                                          })}
                                        {selectedTrainingDayFeedbackConfig.maxPerDay ? (
                                          <span className="rounded-full border border-cyan-300/40 bg-cyan-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-100">
                                            Máx/día: {selectedTrainingDayFeedbackConfig.maxPerDay}
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </section>

                                  <div className="mt-1 border-t border-cyan-300/18 pt-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100/95">
                                          Entrenamiento
                                        </p>
                                        <p className="mt-1 text-sm text-slate-100">
                                          Bloques y ejercicios del plan completo del dia.
                                        </p>
                                      </div>

                                      {selectedTrainingDayBlocks.length > 0 ? (
                                        <ReliableActionButton
                                          type="button"
                                          onClick={() => addTrainingBlock(selectedTrainingWeek.id, selectedTrainingDay.id)}
                                          className="rounded-full border border-cyan-300/45 bg-cyan-500/15 px-3.5 py-2 text-sm font-semibold text-cyan-100"
                                        >
                                          Nuevo bloque
                                        </ReliableActionButton>
                                      ) : null}
                                    </div>

                                    {selectedTrainingDayBlocks.length === 0 ? (
                                      <ReliableActionButton
                                        type="button"
                                        onClick={() => addTrainingBlock(selectedTrainingWeek.id, selectedTrainingDay.id)}
                                        className="mt-3 rounded-full border border-cyan-300/45 bg-cyan-500/15 px-3.5 py-2 text-sm font-semibold text-cyan-100"
                                      >
                                        Crear estructura de entrenamiento para este dia
                                      </ReliableActionButton>
                                    ) : (
                                      <div className="mt-4 space-y-3">
                                        {selectedTrainingDayBlocks.map((block, blockIndex) => {
                                          const blockMenuOpen =
                                            trainingBlockMenu?.weekId === selectedTrainingWeek.id &&
                                            trainingBlockMenu.dayId === selectedTrainingDay.id &&
                                            trainingBlockMenu.blockId === block.id;
                                          const blockGridColumns = (block.ejercicios || [])[0]?.metricas || [];

                                          return (
                                            <article
                                              key={block.id || `${selectedTrainingDay.id}-block-${blockIndex}`}
                                              className={`relative px-0.5 ${blockIndex > 0 ? "mt-4 border-t border-white/12 pt-5" : "pt-2"}`}
                                            >
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                              {trainingBlockEditingId === block.id ? (
                                                <input
                                                  id={`training-block-title-${selectedTrainingWeek.id}-${selectedTrainingDay.id}-${block.id}`}
                                                  value={block.titulo || ""}
                                                  onChange={(event) =>
                                                    updateTrainingBlockField(
                                                      selectedTrainingWeek.id,
                                                      selectedTrainingDay.id,
                                                      block.id,
                                                      "titulo",
                                                      event.target.value
                                                    )
                                                  }
                                                  onBlur={() => setTrainingBlockEditingId(null)}
                                                  onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === "Escape") {
                                                      (event.target as HTMLInputElement).blur();
                                                    }
                                                  }}
                                                  className="min-w-[220px] flex-1 rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                                                  placeholder={`Bloque ${blockIndex + 1}`}
                                                  autoFocus
                                                />
                                              ) : (
                                                <h3
                                                  id={`training-block-title-${selectedTrainingWeek.id}-${selectedTrainingDay.id}-${block.id}`}
                                                  className="min-w-[220px] flex-1 px-1 py-2 text-base font-bold text-white"
                                                >
                                                  {block.titulo || `Bloque ${blockIndex + 1}`}
                                                </h3>
                                              )}

                                              <div className="flex items-center gap-2">
                                                <ReliableActionButton
                                                  type="button"
                                                  onClick={() =>
                                                    addTrainingExercise(
                                                      selectedTrainingWeek.id,
                                                      selectedTrainingDay.id,
                                                      block.id
                                                    )
                                                  }
                                                  className="rounded-full border border-cyan-300/45 bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-100"
                                                >
                                                  Agregar ejercicio
                                                </ReliableActionButton>
                                                <div
                                                  ref={blockMenuOpen ? trainingBlockMenuRef : undefined}
                                                  className="relative"
                                                >
                                                  <ReliableActionButton
                                                    type="button"
                                                    onClick={(e) => {
                                                      setTrainingBlockGridConfigOpenId((current) =>
                                                        current === block.id ? null : current
                                                      );
                                                      toggleTrainingBlockMenu(
                                                        selectedTrainingWeek.id,
                                                        selectedTrainingDay.id,
                                                        block.id,
                                                        e
                                                      );
                                                    }}
                                                    className={`h-7 w-7 rounded-full border p-0 text-sm font-semibold transition ${
                                                      blockMenuOpen
                                                        ? "border-cyan-300/70 bg-slate-700/95 text-cyan-100"
                                                        : "border-white/20 bg-[#0e1012] text-slate-100 hover:border-cyan-300/55 hover:text-cyan-100"
                                                    }`}
                                                    aria-label={`Opciones de ${block.titulo || `Bloque ${blockIndex + 1}`}`}
                                                  >
                                                    ⋯
                                                  </ReliableActionButton>

                                                  <PortalMenu
                                                    open={blockMenuOpen}
                                                    anchor={menuAnchorRect}
                                                    panelRef={trainingBlockMenuPanelRef}
                                                  >
                                                    <ReliableActionButton
                                                      type="button"
                                                      onClick={() =>
                                                        focusTrainingBlockTitleInput(
                                                          selectedTrainingWeek.id,
                                                          selectedTrainingDay.id,
                                                          block.id
                                                        )
                                                      }
                                                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
                                                    >
                                                      Editar nombre del bloque
                                                    </ReliableActionButton>
                                                    <ReliableActionButton
                                                      type="button"
                                                      onClick={() => {
                                                        setTrainingBlockGridConfigOpenId((current) =>
                                                          current === block.id ? null : block.id
                                                        );
                                                        setTrainingBlockMenu(null);
                                                      }}
                                                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
                                                    >
                                                      Configurar grilla plan
                                                    </ReliableActionButton>
                                                    <ReliableActionButton
                                                      type="button"
                                                      onClick={() =>
                                                        duplicateTrainingBlock(
                                                          selectedTrainingWeek.id,
                                                          selectedTrainingDay.id,
                                                          block.id
                                                        )
                                                      }
                                                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
                                                    >
                                                      Duplicar bloque
                                                    </ReliableActionButton>
                                                    <ReliableActionButton
                                                      type="button"
                                                      onClick={() => {
                                                        setTrainingBlockMenu(null);
                                                        removeTrainingBlock(
                                                          selectedTrainingWeek.id,
                                                          selectedTrainingDay.id,
                                                          block.id
                                                        );
                                                      }}
                                                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-200 hover:bg-rose-500/15"
                                                    >
                                                      Eliminar bloque
                                                    </ReliableActionButton>
                                                  </PortalMenu>
                                                </div>
                                              </div>
                                            </div>


                                            {trainingBlockGridConfigOpenId === block.id ? (
                                              <div className="mt-3 border-l-2 border-cyan-300/35 bg-cyan-500/[0.04] py-2 pl-3 pr-1.5">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                                                  Configuracion grilla plan:
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400">
                                                  Series, repeticiones, descanso y carga kg son columnas base. El resto es opcional.
                                                </p>

                                                <div className="mt-3 space-y-2">
                                                  <input
                                                    value="Series:"
                                                    readOnly
                                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                                  />
                                                  <input
                                                    value="Repeticiones:"
                                                    readOnly
                                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                                  />
                                                  <input
                                                    value="Descanso:"
                                                    readOnly
                                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                                  />
                                                  <input
                                                    value="Carga kg:"
                                                    readOnly
                                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                                  />

                                                  {blockGridColumns.map((metric, metricIndex) => (
                                                    <div
                                                      key={`${block.id}-metric-col-${metricIndex}`}
                                                      className="flex items-center gap-2"
                                                    >
                                                      <input
                                                        value={metric.nombre || ""}
                                                        onChange={(event) =>
                                                          updateTrainingBlockGridColumnName(
                                                            selectedTrainingWeek.id,
                                                            selectedTrainingDay.id,
                                                            block.id,
                                                            metricIndex,
                                                            event.target.value
                                                          )
                                                        }
                                                        className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                                      />
                                                      <ReliableActionButton
                                                        type="button"
                                                        onClick={() =>
                                                          removeTrainingBlockGridColumn(
                                                            selectedTrainingWeek.id,
                                                            selectedTrainingDay.id,
                                                            block.id,
                                                            metricIndex
                                                          )
                                                        }
                                                        className="rounded-full border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100"
                                                      >
                                                        x
                                                      </ReliableActionButton>
                                                    </div>
                                                  ))}
                                                </div>

                                                <div className="mt-3 flex flex-wrap justify-end gap-2">
                                                  <ReliableActionButton
                                                    type="button"
                                                    onClick={() =>
                                                      addTrainingBlockGridColumn(
                                                        selectedTrainingWeek.id,
                                                        selectedTrainingDay.id,
                                                        block.id
                                                      )
                                                    }
                                                    className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                                                  >
                                                    Nuevo
                                                  </ReliableActionButton>
                                                  <ReliableActionButton
                                                    type="button"
                                                    onClick={() => setTrainingBlockGridConfigOpenId(null)}
                                                    className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                                                  >
                                                    Aceptar
                                                  </ReliableActionButton>
                                                </div>
                                              </div>
                                            ) : null}

                                            <div className="mt-3 space-y-3">
                                              {(block.ejercicios || []).map((exercise) => {
                                                const exerciseMeta =
                                                  ejercicios.find((item) => item.id === exercise.ejercicioId) || null;
                                                const previewImage = resolveExercisePreviewImage(exerciseMeta?.videoUrl);
                                                const actionTarget: TrainingExercisePanelTarget = {
                                                  weekId: selectedTrainingWeek.id,
                                                  weekName: selectedTrainingWeek.nombre || "Semana",
                                                  dayId: selectedTrainingDay.id,
                                                  dayName: selectedTrainingDay.dia || "Dia",
                                                  blockId: block.id,
                                                  blockTitle: block.titulo || `Bloque ${blockIndex + 1}`,
                                                  exerciseId: exercise.id,
                                                  exerciseName: exerciseMeta?.nombre || "Ejercicio",
                                                  sessionId: `plan-${selectedClient?.id || "cliente"}`,
                                                  sessionTitle:
                                                    selectedTrainingDay.planificacion ||
                                                    selectedTrainingDay.dia ||
                                                    "Plan de entrenamiento",
                                                  currentSeries: exercise.series || "",
                                                  currentRepeticiones: exercise.repeticiones || "",
                                                  currentCarga: exercise.carga || "",
                                                };
                                                const panelOpenForExercise =
                                                  Boolean(trainingExercisePanelTarget) &&
                                                  trainingExercisePanelTarget?.weekId === actionTarget.weekId &&
                                                  trainingExercisePanelTarget?.dayId === actionTarget.dayId &&
                                                  trainingExercisePanelTarget?.blockId === actionTarget.blockId &&
                                                  trainingExercisePanelTarget?.exerciseId === actionTarget.exerciseId;
                                                const exerciseRowGridTemplateColumns = [
                                                  "76px",
                                                  "minmax(200px, 1.4fr)",
                                                  "108px",
                                                  "108px",
                                                  "108px",
                                                  "108px",
                                                  ...blockGridColumns.map(() => "108px"),
                                                ].join(" ");
                                                const exerciseRowMinWidth = 76 + 200 + 108 * (4 + blockGridColumns.length);
                                                const superSerieRows = Array.isArray(exercise.superSerie)
                                                  ? exercise.superSerie
                                                  : [];

                                                const exerciseLatestSummary =
                                                  (exercise.ejercicioId
                                                    ? latestSessionByExerciseKey.get(exercise.ejercicioId)
                                                    : undefined) ||
                                                  (exerciseMeta?.nombre
                                                    ? latestSessionByExerciseKey.get(
                                                        exerciseMeta.nombre.trim().toLowerCase()
                                                      )
                                                    : undefined) ||
                                                  null;

                                                const hasSuperSerieGroup = superSerieRows.length > 0;
                                                return (
                                                  <div
                                                    key={exercise.id}
                                                    className={`border-t border-white/12 pt-3 ${
                                                      hasSuperSerieGroup ? "pf-a3-routine-exercise-group pf-a3-routine-exercise-group-linked" : ""
                                                    }`}
                                                  >
                                                    <div className="group relative mb-2 inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-white/[0.025] px-2 py-1 text-[12px] font-semibold text-slate-200">
                                                      {exerciseLatestSummary ? (
                                                        <>
                                                          <span className="inline-flex items-center gap-1">
                                                            <span aria-hidden>📅</span>
                                                            {formatLatestSessionDate(exerciseLatestSummary.fechaDate, exerciseLatestSummary.fecha)}
                                                            {exerciseLatestSummary.fechaDate ? (
                                                              <span className="text-slate-400"> ({formatLatestSessionRelative(exerciseLatestSummary.fechaDate)})</span>
                                                            ) : null}
                                                          </span>
                                                          <span className="inline-flex items-center gap-1">
                                                            <span aria-hidden>📚</span>
                                                            {exerciseLatestSummary.seriesCount} series
                                                          </span>
                                                          <span className="inline-flex items-center gap-1">
                                                            <span aria-hidden>🔁</span>
                                                            {exerciseLatestSummary.totalReps} reps
                                                          </span>
                                                          <span className="inline-flex items-center gap-1">
                                                            <span aria-hidden>🏋️</span>
                                                            {exerciseLatestSummary.topWeight.toLocaleString("es-AR")} kg
                                                          </span>
                                                          <span className="inline-flex items-center gap-1">
                                                            <span aria-hidden>📈</span>
                                                            {exerciseLatestSummary.volume.toLocaleString("es-AR")} kg·rep
                                                          </span>
                                                        </>
                                                      ) : (
                                                        <span className="inline-flex items-center gap-1 text-slate-400">
                                                          <span aria-hidden>📅</span>
                                                          Sin registros aún
                                                        </span>
                                                      )}
                                                      <div className="invisible absolute left-0 top-full z-30 mt-1 w-[min(380px,90vw)] rounded-lg border border-slate-700/80 bg-[#0e1012]/98 p-3 text-[12px] font-normal text-slate-100 shadow-xl opacity-0 transition group-hover:visible group-hover:opacity-100">
                                                        {exerciseLatestSummary ? (
                                                          <>
                                                            <p className="font-bold">
                                                              Última sesión: {formatLatestSessionDate(exerciseLatestSummary.fechaDate, exerciseLatestSummary.fecha)}
                                                            </p>
                                                            <p className="mt-2 font-bold">Series</p>
                                                            <ul className="mt-1 list-disc pl-5">
                                                              {exerciseLatestSummary.sets.map((set, idx) => (
                                                                <li key={`${exercise.id}-set-${idx}`}>
                                                                  S{idx + 1}: <strong>{set.peso.toLocaleString("es-AR")} kg × {set.reps}</strong>
                                                                </li>
                                                              ))}
                                                            </ul>
                                                            <p className="mt-2">
                                                              Top: <strong>{exerciseLatestSummary.topWeight.toLocaleString("es-AR")} kg</strong>
                                                            </p>
                                                            <p>
                                                              Volumen: <strong>{exerciseLatestSummary.volume.toLocaleString("es-AR")} kg·rep</strong>
                                                            </p>
                                                            <p>
                                                              Molestia: <strong>{exerciseLatestSummary.molestia ? "Sí" : "No"}</strong>
                                                            </p>
                                                            <p className="mt-2 text-[11px] text-slate-300">
                                                              Volumen total (tonelaje): suma de (peso × reps) de todas las series de ese día. Ej: 20×10 + 25×8 = 400 kg·rep.
                                                            </p>
                                                          </>
                                                        ) : (
                                                          <p className="text-slate-300">
                                                            Este ejercicio todavía no tiene registros de carga. Cuando el alumno registre series desde la app, aparecerán acá.
                                                          </p>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                      <div
                                                        className="grid gap-2"
                                                        style={{ gridTemplateColumns: exerciseRowGridTemplateColumns, minWidth: `${exerciseRowMinWidth}px` }}
                                                      >
                                                      <div className="overflow-hidden rounded-xl border border-white/12 bg-[#0e1012]">
                                                        {exerciseMeta?.videoUrl ? (
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              window.open(
                                                                String(exerciseMeta.videoUrl || ""),
                                                                "_blank",
                                                                "noopener,noreferrer"
                                                              )
                                                            }
                                                            title="Abrir video"
                                                            className="group/prev relative block h-[66px] w-full overflow-hidden"
                                                          >
                                                            {previewImage ? (
                                                              <>
                                                                <img
                                                                  src={previewImage}
                                                                  alt={exerciseMeta.nombre || "Ejercicio"}
                                                                  className="h-[66px] w-full object-cover transition-transform group-hover/prev:scale-105"
                                                                  loading="lazy"
                                                                  onError={(e) => {
                                                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                                                                    if (fallback) fallback.style.display = "flex";
                                                                  }}
                                                                />
                                                                <span className="absolute inset-0 hidden items-center justify-center gap-1 bg-[#111] text-[10px] font-bold text-cyan-300">
                                                                  ▶ Ver video
                                                                </span>
                                                                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/prev:opacity-100 transition-opacity bg-black/40 text-white text-lg">
                                                                  ▶
                                                                </span>
                                                              </>
                                                            ) : (
                                                              <span className="flex h-[66px] w-full items-center justify-center gap-1.5 bg-gradient-to-br from-cyan-900/40 to-[#0e1012] text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300 transition group-hover/prev:from-cyan-800/50">
                                                                ▶ Ver video
                                                              </span>
                                                            )}
                                                          </button>
                                                        ) : (
                                                          <div className="flex h-[66px] w-full flex-col items-center justify-center gap-1 bg-white/3">
                                                            <span className="text-xl leading-none">
                                                              {exerciseMeta ? "🏋" : "❓"}
                                                            </span>
                                                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                                              {exerciseMeta ? "Sin video" : "Sin ejercicio"}
                                                            </span>
                                                          </div>
                                                        )}
                                                      </div>

                                                      <label className="space-y-1">
                                                        <span className="text-xs font-bold text-slate-100">Ejercicio</span>
                                                        <select
                                                          value={exercise.ejercicioId || ""}
                                                          onChange={(event) => {
                                                            if (event.target.value === "__create_new__") {
                                                              openNewExerciseModal({
                                                                weekId: selectedTrainingWeek.id,
                                                                dayId: selectedTrainingDay.id,
                                                                blockId: block.id,
                                                                exerciseRowId: exercise.id,
                                                              });
                                                              return;
                                                            }
                                                            updateTrainingExerciseField(
                                                              selectedTrainingWeek.id,
                                                              selectedTrainingDay.id,
                                                              block.id,
                                                              exercise.id,
                                                              "ejercicioId",
                                                              event.target.value
                                                            );
                                                          }}
                                                            className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                        >
                                                          <option value="">Seleccione ejercicio</option>
                                                          <option value="__create_new__" className="font-bold text-cyan-200">+ Nuevo ejercicio</option>
                                                          {ejercicios.map((exerciseOption) => (
                                                            <option key={exerciseOption.id} value={exerciseOption.id}>
                                                              {exerciseOption.nombre}
                                                            </option>
                                                          ))}
                                                        </select>
                                                      </label>

                                                      <label className="space-y-1">
                                                        <span className="text-xs font-bold text-slate-100">Series</span>
                                                        <input
                                                          value={exercise.series || ""}
                                                          onChange={(event) =>
                                                            updateTrainingExerciseField(
                                                              selectedTrainingWeek.id,
                                                              selectedTrainingDay.id,
                                                              block.id,
                                                              exercise.id,
                                                              "series",
                                                              event.target.value
                                                            )
                                                          }
                                                          className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                        />
                                                      </label>

                                                      <label className="space-y-1">
                                                        <span className="text-xs font-bold text-slate-100">Repeticiones</span>
                                                        <input
                                                          value={exercise.repeticiones || ""}
                                                          onChange={(event) =>
                                                            updateTrainingExerciseField(
                                                              selectedTrainingWeek.id,
                                                              selectedTrainingDay.id,
                                                              block.id,
                                                              exercise.id,
                                                              "repeticiones",
                                                              event.target.value
                                                            )
                                                          }
                                                          className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                        />
                                                      </label>

                                                      <label className="space-y-1">
                                                        <span className="text-xs font-bold text-slate-100">Descanso</span>
                                                        <input
                                                          value={exercise.descanso || ""}
                                                          onChange={(event) =>
                                                            updateTrainingExerciseField(
                                                              selectedTrainingWeek.id,
                                                              selectedTrainingDay.id,
                                                              block.id,
                                                              exercise.id,
                                                              "descanso",
                                                              event.target.value
                                                            )
                                                          }
                                                          className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                        />
                                                      </label>

                                                      <label className="space-y-1">
                                                        <span className="text-xs font-bold text-slate-100">Carga (kg)</span>
                                                        <input
                                                          value={exercise.carga || ""}
                                                          onChange={(event) =>
                                                            updateTrainingExerciseField(
                                                              selectedTrainingWeek.id,
                                                              selectedTrainingDay.id,
                                                              block.id,
                                                              exercise.id,
                                                              "carga",
                                                              event.target.value
                                                            )
                                                          }
                                                          className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                        />
                                                      </label>

                                                      {blockGridColumns.map((metric, metricIndex) => (
                                                        <label
                                                          key={`${exercise.id}-metric-${metricIndex}`}
                                                          className="space-y-1"
                                                        >
                                                          <span className="text-xs font-bold text-slate-100">
                                                            {metric.nombre || `Campo ${metricIndex + 1}`}
                                                          </span>
                                                          <input
                                                            value={
                                                              (exercise.metricas || [])[metricIndex]?.valor || ""
                                                            }
                                                            onChange={(event) =>
                                                              updateTrainingExerciseMetricValue(
                                                                selectedTrainingWeek.id,
                                                                selectedTrainingDay.id,
                                                                block.id,
                                                                exercise.id,
                                                                metricIndex,
                                                                metric.nombre || `Campo ${metricIndex + 1}`,
                                                                event.target.value
                                                              )
                                                            }
                                                            className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                          />
                                                        </label>
                                                      ))}
                                                    </div>
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                                                      <span className="text-cyan-200">Desglosar serie</span>
                                                      <ReliableActionButton
                                                        type="button"
                                                        onClick={() =>
                                                          addTrainingSuperSerieExercise(
                                                            selectedTrainingWeek.id,
                                                            selectedTrainingDay.id,
                                                            block.id,
                                                            exercise.id
                                                          )
                                                        }
                                                        className="text-cyan-200 hover:text-cyan-100"
                                                      >
                                                        Agregar ejercicio super-serie
                                                      </ReliableActionButton>
                                                      <ReliableActionButton
                                                        type="button"
                                                        onClick={() =>
                                                          openTrainingExercisePanel("configuracion", actionTarget)
                                                        }
                                                        className="text-cyan-200 hover:text-cyan-100"
                                                      >
                                                        Configuración
                                                      </ReliableActionButton>
                                                      <ReliableActionButton
                                                        type="button"
                                                        onClick={() => openTrainingExercisePanel("ver-pesos", actionTarget)}
                                                        className="text-cyan-200 hover:text-cyan-100"
                                                      >
                                                        Ver pesos
                                                      </ReliableActionButton>
                                                      <ReliableActionButton
                                                        type="button"
                                                        onClick={() => openTrainingExercisePanel("registrar-peso", actionTarget)}
                                                        className="text-cyan-200 hover:text-cyan-100"
                                                      >
                                                        Registrar peso
                                                      </ReliableActionButton>
                                                      <ReliableActionButton
                                                        type="button"
                                                        onClick={() =>
                                                          removeTrainingExercise(
                                                            selectedTrainingWeek.id,
                                                            selectedTrainingDay.id,
                                                            block.id,
                                                            exercise.id
                                                          )
                                                        }
                                                        className="text-rose-200 hover:text-rose-100"
                                                      >
                                                        Eliminar
                                                      </ReliableActionButton>
                                                    </div>

                                                    {superSerieRows.length > 0 ? (
                                                      <div className="mt-3 space-y-3">
                                                        {superSerieRows.map((superItem, superIndex) => {
                                                          const superKey =
                                                            String(superItem.id || "").trim() ||
                                                            `${exercise.id}-super-${superIndex + 1}`;
                                                          const superMeta =
                                                            ejercicios.find((item) => item.id === superItem.ejercicioId) || null;
                                                          const superPreviewImage = resolveExercisePreviewImage(superMeta?.videoUrl);
                                                          const superMetricas = (superItem as any)?.metricas || [];
                                                          const superLatestSummary =
                                                            (superItem.ejercicioId
                                                              ? latestSessionByExerciseKey.get(superItem.ejercicioId)
                                                              : undefined) ||
                                                            (superMeta?.nombre
                                                              ? latestSessionByExerciseKey.get(
                                                                  superMeta.nombre.trim().toLowerCase()
                                                                )
                                                              : undefined) ||
                                                            null;

                                                          return (
                                                            <div key={superKey} className="border-t border-cyan-300/20 pt-3">
                                                              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                                                                Super serie
                                                              </p>
                                                              <div className="group relative mb-2 inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-white/[0.025] px-2 py-1 text-[12px] font-semibold text-slate-200">
                                                                {superLatestSummary ? (
                                                                  <>
                                                                    <span className="inline-flex items-center gap-1">
                                                                      <span aria-hidden>📅</span>
                                                                      {formatLatestSessionDate(superLatestSummary.fechaDate, superLatestSummary.fecha)}
                                                                      {superLatestSummary.fechaDate ? (
                                                                        <span className="text-slate-400"> ({formatLatestSessionRelative(superLatestSummary.fechaDate)})</span>
                                                                      ) : null}
                                                                    </span>
                                                                    <span className="inline-flex items-center gap-1">
                                                                      <span aria-hidden>📚</span>
                                                                      {superLatestSummary.seriesCount} series
                                                                    </span>
                                                                    <span className="inline-flex items-center gap-1">
                                                                      <span aria-hidden>🔁</span>
                                                                      {superLatestSummary.totalReps} reps
                                                                    </span>
                                                                    <span className="inline-flex items-center gap-1">
                                                                      <span aria-hidden>🏋️</span>
                                                                      {superLatestSummary.topWeight.toLocaleString("es-AR")} kg
                                                                    </span>
                                                                    <span className="inline-flex items-center gap-1">
                                                                      <span aria-hidden>📈</span>
                                                                      {superLatestSummary.volume.toLocaleString("es-AR")} kg·rep
                                                                    </span>
                                                                  </>
                                                                ) : (
                                                                  <span className="inline-flex items-center gap-1 text-slate-400">
                                                                    <span aria-hidden>📅</span>
                                                                    Sin registros aún
                                                                  </span>
                                                                )}
                                                                <div className="invisible absolute left-0 top-full z-30 mt-1 w-[min(380px,90vw)] rounded-lg border border-slate-700/80 bg-[#0e1012]/98 p-3 text-[12px] font-normal text-slate-100 shadow-xl opacity-0 transition group-hover:visible group-hover:opacity-100">
                                                                  {superLatestSummary ? (
                                                                    <>
                                                                      <p className="font-bold">
                                                                        Última sesión: {formatLatestSessionDate(superLatestSummary.fechaDate, superLatestSummary.fecha)}
                                                                      </p>
                                                                      <p className="mt-2 font-bold">Series</p>
                                                                      <ul className="mt-1 list-disc pl-5">
                                                                        {superLatestSummary.sets.map((set, idx) => (
                                                                          <li key={`${superKey}-set-${idx}`}>
                                                                            S{idx + 1}: <strong>{set.peso.toLocaleString("es-AR")} kg × {set.reps}</strong>
                                                                          </li>
                                                                        ))}
                                                                      </ul>
                                                                      <p className="mt-2">
                                                                        Top: <strong>{superLatestSummary.topWeight.toLocaleString("es-AR")} kg</strong>
                                                                      </p>
                                                                      <p>
                                                                        Volumen: <strong>{superLatestSummary.volume.toLocaleString("es-AR")} kg·rep</strong>
                                                                      </p>
                                                                      <p>
                                                                        Molestia: <strong>{superLatestSummary.molestia ? "Sí" : "No"}</strong>
                                                                      </p>
                                                                      <p className="mt-2 text-[11px] text-slate-300">
                                                                        Volumen total (tonelaje): suma de (peso × reps) de todas las series de ese día. Ej: 20×10 + 25×8 = 400 kg·rep.
                                                                      </p>
                                                                    </>
                                                                  ) : (
                                                                    <p className="text-slate-300">
                                                                      Este ejercicio todavía no tiene registros de carga. Cuando el alumno registre series desde la app, aparecerán acá.
                                                                    </p>
                                                                  )}
                                                                </div>
                                                              </div>
                                                              <div className="overflow-x-auto">
                                                                <div
                                                                  className="grid gap-2"
                                                                  style={{ gridTemplateColumns: exerciseRowGridTemplateColumns, minWidth: `${exerciseRowMinWidth}px` }}
                                                                >
                                                                  <div className="overflow-hidden rounded-xl border border-white/12 bg-[#0e1012]">
                                                                    {superMeta?.videoUrl ? (
                                                                      <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                          window.open(
                                                                            String(superMeta.videoUrl || ""),
                                                                            "_blank",
                                                                            "noopener,noreferrer"
                                                                          )
                                                                        }
                                                                        title="Abrir video"
                                                                        className="group/prev relative block h-[66px] w-full overflow-hidden"
                                                                      >
                                                                        {superPreviewImage ? (
                                                                          <>
                                                                            <img
                                                                              src={superPreviewImage}
                                                                              alt={superMeta.nombre || "Ejercicio"}
                                                                              className="h-[66px] w-full object-cover transition-transform group-hover/prev:scale-105"
                                                                              loading="lazy"
                                                                              onError={(e) => {
                                                                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                                                                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                                                                                if (fallback) fallback.style.display = "flex";
                                                                              }}
                                                                            />
                                                                            <span className="absolute inset-0 hidden items-center justify-center gap-1 bg-[#111] text-[10px] font-bold text-cyan-300">
                                                                              ▶ Ver video
                                                                            </span>
                                                                            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/prev:opacity-100 transition-opacity bg-black/40 text-white text-lg">
                                                                              ▶
                                                                            </span>
                                                                          </>
                                                                        ) : (
                                                                          <span className="flex h-[66px] w-full items-center justify-center gap-1.5 bg-gradient-to-br from-cyan-900/40 to-[#0e1012] text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                                                                            ▶ Ver video
                                                                          </span>
                                                                        )}
                                                                      </button>
                                                                    ) : (
                                                                      <div className="flex h-[66px] w-full flex-col items-center justify-center gap-1 bg-white/3">
                                                                        <span className="text-xl leading-none">
                                                                          {superMeta ? "🏋" : "❓"}
                                                                        </span>
                                                                        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                                                          {superMeta ? "Sin video" : "Sin ejercicio"}
                                                                        </span>
                                                                      </div>
                                                                    )}
                                                                  </div>

                                                                  <label className="space-y-1">
                                                                    <span className="text-xs font-bold text-slate-100">Ejercicio</span>
                                                                    <select
                                                                      value={superItem.ejercicioId || ""}
                                                                      onChange={(event) => {
                                                                        if (event.target.value === "__create_new__") {
                                                                          openNewExerciseModal({
                                                                            weekId: selectedTrainingWeek.id,
                                                                            dayId: selectedTrainingDay.id,
                                                                            blockId: block.id,
                                                                            exerciseRowId: `${exercise.id}::${superKey}`,
                                                                          });
                                                                          return;
                                                                        }
                                                                        updateTrainingSuperSerieField(
                                                                          selectedTrainingWeek.id,
                                                                          selectedTrainingDay.id,
                                                                          block.id,
                                                                          exercise.id,
                                                                          superKey,
                                                                          "ejercicioId",
                                                                          event.target.value
                                                                        );
                                                                      }}
                                                                      className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                                    >
                                                                      <option value="">Seleccione ejercicio</option>
                                                                      <option value="__create_new__" className="font-bold text-cyan-200">+ Nuevo ejercicio</option>
                                                                      {ejercicios.map((exerciseOption) => (
                                                                        <option key={exerciseOption.id} value={exerciseOption.id}>
                                                                          {exerciseOption.nombre}
                                                                        </option>
                                                                      ))}
                                                                    </select>
                                                                  </label>

                                                                  <label className="space-y-1">
                                                                    <span className="text-xs font-bold text-slate-100">Series</span>
                                                                    <input
                                                                      value={superItem.series || ""}
                                                                      onChange={(event) =>
                                                                        updateTrainingSuperSerieField(
                                                                          selectedTrainingWeek.id,
                                                                          selectedTrainingDay.id,
                                                                          block.id,
                                                                          exercise.id,
                                                                          superKey,
                                                                          "series",
                                                                          event.target.value
                                                                        )
                                                                      }
                                                                      className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                                    />
                                                                  </label>

                                                                  <label className="space-y-1">
                                                                    <span className="text-xs font-bold text-slate-100">Repeticiones</span>
                                                                    <input
                                                                      value={superItem.repeticiones || ""}
                                                                      onChange={(event) =>
                                                                        updateTrainingSuperSerieField(
                                                                          selectedTrainingWeek.id,
                                                                          selectedTrainingDay.id,
                                                                          block.id,
                                                                          exercise.id,
                                                                          superKey,
                                                                          "repeticiones",
                                                                          event.target.value
                                                                        )
                                                                      }
                                                                      className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                                    />
                                                                  </label>

                                                                  <label className="space-y-1">
                                                                    <span className="text-xs font-bold text-slate-100">Descanso</span>
                                                                    <input
                                                                      value={superItem.descanso || ""}
                                                                      onChange={(event) =>
                                                                        updateTrainingSuperSerieField(
                                                                          selectedTrainingWeek.id,
                                                                          selectedTrainingDay.id,
                                                                          block.id,
                                                                          exercise.id,
                                                                          superKey,
                                                                          "descanso",
                                                                          event.target.value
                                                                        )
                                                                      }
                                                                      className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                                    />
                                                                  </label>

                                                                  <label className="space-y-1">
                                                                    <span className="text-xs font-bold text-slate-100">Carga</span>
                                                                    <input
                                                                      value={superItem.carga || ""}
                                                                      onChange={(event) =>
                                                                        updateTrainingSuperSerieField(
                                                                          selectedTrainingWeek.id,
                                                                          selectedTrainingDay.id,
                                                                          block.id,
                                                                          exercise.id,
                                                                          superKey,
                                                                          "carga",
                                                                          event.target.value
                                                                        )
                                                                      }
                                                                      className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                                    />
                                                                  </label>

                                                                  {blockGridColumns.map((metric, metricIndex) => (
                                                                    <label
                                                                      key={`${superKey}-metric-${metricIndex}`}
                                                                      className="space-y-1"
                                                                    >
                                                                      <span className="text-xs font-bold text-slate-100">
                                                                        {metric.nombre || `Campo ${metricIndex + 1}`}
                                                                      </span>
                                                                      <input
                                                                        value={(superMetricas[metricIndex] as any)?.valor || ""}
                                                                        readOnly
                                                                        className="w-full rounded-md border border-white/15 bg-[#0e1012] px-2.5 py-1.5 text-sm text-white opacity-70"
                                                                      />
                                                                    </label>
                                                                  ))}
                                                                </div>
                                                              </div>
                                                              {(() => {
                                                                const superActionTarget: TrainingExercisePanelTarget = {
                                                                  weekId: selectedTrainingWeek.id,
                                                                  weekName: selectedTrainingWeek.nombre || "Semana",
                                                                  dayId: selectedTrainingDay.id,
                                                                  dayName: selectedTrainingDay.dia || "Dia",
                                                                  blockId: block.id,
                                                                  blockTitle: block.titulo || `Bloque ${blockIndex + 1}`,
                                                                  exerciseId: `${exercise.id}::${superKey}`,
                                                                  exerciseName: superMeta?.nombre || "Ejercicio",
                                                                  sessionId: `plan-${selectedClient?.id || "cliente"}`,
                                                                  sessionTitle:
                                                                    selectedTrainingDay.planificacion ||
                                                                    selectedTrainingDay.dia ||
                                                                    "Plan de entrenamiento",
                                                                  currentSeries: superItem.series || "",
                                                                  currentRepeticiones: superItem.repeticiones || "",
                                                                  currentCarga: superItem.carga || "",
                                                                };
                                                                return (
                                                                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                                                                    <span className="text-cyan-200">Desglosar serie</span>
                                                                    <ReliableActionButton
                                                                      type="button"
                                                                      onClick={() =>
                                                                        openTrainingExercisePanel("configuracion", superActionTarget)
                                                                      }
                                                                      className="text-cyan-200 hover:text-cyan-100"
                                                                    >
                                                                      Configuración
                                                                    </ReliableActionButton>
                                                                    <ReliableActionButton
                                                                      type="button"
                                                                      onClick={() => openTrainingExercisePanel("ver-pesos", superActionTarget)}
                                                                      className="text-cyan-200 hover:text-cyan-100"
                                                                    >
                                                                      Ver pesos
                                                                    </ReliableActionButton>
                                                                    <ReliableActionButton
                                                                      type="button"
                                                                      onClick={() => openTrainingExercisePanel("registrar-peso", superActionTarget)}
                                                                      className="text-cyan-200 hover:text-cyan-100"
                                                                    >
                                                                      Registrar peso
                                                                    </ReliableActionButton>
                                                                    <ReliableActionButton
                                                                      type="button"
                                                                      onClick={() =>
                                                                        removeTrainingSuperSerieExercise(
                                                                          selectedTrainingWeek.id,
                                                                          selectedTrainingDay.id,
                                                                          block.id,
                                                                          exercise.id,
                                                                          superKey
                                                                        )
                                                                      }
                                                                      className="text-rose-200 hover:text-rose-100"
                                                                    >
                                                                      Eliminar
                                                                    </ReliableActionButton>
                                                                  </div>
                                                                );
                                                              })()}
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    ) : null}

                                                    {panelOpenForExercise ? (
                                                      <div className="mt-3 rounded-xl border border-cyan-300/25 bg-[#0e1012] p-3">
                                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                                                            {trainingExercisePanelMode === "configuracion"
                                                              ? "Configuracion"
                                                              : trainingExercisePanelMode === "ver-pesos"
                                                                ? "Historial de pesos"
                                                                : "Registrar peso"}
                                                          </p>
                                                          <ReliableActionButton
                                                            type="button"
                                                            onClick={closeTrainingExercisePanel}
                                                            className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/15"
                                                          >
                                                            Cerrar
                                                          </ReliableActionButton>
                                                        </div>

                                                        {trainingExercisePanelMode === "configuracion" ? (
                                                          <div className="space-y-2">
                                                            <div className="flex flex-wrap gap-2">
                                                              <ReliableActionButton
                                                                type="button"
                                                                onClick={() => {
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "series",
                                                                    "3"
                                                                  );
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "repeticiones",
                                                                    "10"
                                                                  );
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "descanso",
                                                                    "60"
                                                                  );
                                                                  setTrainingRecordStatus("Preset 3x10 aplicado.");
                                                                }}
                                                                className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-100"
                                                              >
                                                                Aplicar 3x10
                                                              </ReliableActionButton>
                                                              <ReliableActionButton
                                                                type="button"
                                                                onClick={() => {
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "series",
                                                                    "5"
                                                                  );
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "repeticiones",
                                                                    "5"
                                                                  );
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "descanso",
                                                                    "120"
                                                                  );
                                                                  setTrainingRecordStatus("Preset 5x5 aplicado.");
                                                                }}
                                                                className="rounded-lg border border-fuchsia-300/35 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-100"
                                                              >
                                                                Aplicar 5x5
                                                              </ReliableActionButton>
                                                              <ReliableActionButton
                                                                type="button"
                                                                onClick={() => {
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "series",
                                                                    ""
                                                                  );
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "repeticiones",
                                                                    ""
                                                                  );
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "descanso",
                                                                    ""
                                                                  );
                                                                  updateTrainingExerciseField(
                                                                    selectedTrainingWeek.id,
                                                                    selectedTrainingDay.id,
                                                                    block.id,
                                                                    exercise.id,
                                                                    "carga",
                                                                    ""
                                                                  );
                                                                  setTrainingRecordStatus("Configuracion limpiada.");
                                                                }}
                                                                className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-100"
                                                              >
                                                                Limpiar valores
                                                              </ReliableActionButton>
                                                            </div>
                                                            <p className="text-xs text-slate-300">
                                                              Usa presets rapidos para estandarizar la carga sin salir del formato template.
                                                            </p>
                                                          </div>
                                                        ) : null}

                                                        {trainingExercisePanelMode === "ver-pesos" ? (
                                                          selectedExerciseWorkoutLogs.length === 0 ? (
                                                            <p className="text-sm text-slate-300">
                                                              Todavia no hay registros de peso para este ejercicio.
                                                            </p>
                                                          ) : (
                                                            <div className="space-y-2">
                                                              <p className="text-xs text-cyan-100">
                                                                Maximo registrado: {selectedExerciseTopWeight.toLocaleString("es-AR")} kg · {selectedExerciseWorkoutLogs.length} registro/s
                                                              </p>
                                                              <ul className="space-y-1 text-xs text-slate-200">
                                                                {selectedExerciseWorkoutLogs.slice(0, 8).map((log) => (
                                                                  <li
                                                                    key={log.id}
                                                                    className="rounded-md border border-white/10 bg-white/[0.025] px-2 py-1"
                                                                  >
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                      <span>
                                                                        {log.fecha
                                                                          ? new Date(`${log.fecha}T00:00:00`).toLocaleDateString("es-AR")
                                                                          : "Sin fecha"}
                                                                      </span>
                                                                      <span className="font-semibold text-cyan-100">
                                                                        {Number(log.pesoKg || 0).toLocaleString("es-AR")} kg · {log.series} x {log.repeticiones || "-"}
                                                                      </span>
                                                                    </div>

                                                                    {log.molestia ? (
                                                                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-200">
                                                                        Molestia reportada
                                                                      </p>
                                                                    ) : null}

                                                                    {log.comentarios ? (
                                                                      <p className="mt-1 text-[11px] text-slate-300">{log.comentarios}</p>
                                                                    ) : null}

                                                                    {log.videoDataUrl || log.videoUrl ? (
                                                                      <div className="mt-2 space-y-1">
                                                                        {log.videoDataUrl ? (
                                                                          <video
                                                                            controls
                                                                            src={log.videoDataUrl}
                                                                            className="h-24 w-full rounded border border-white/10 bg-black/45"
                                                                          />
                                                                        ) : null}

                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                          <ReliableActionButton
                                                                            type="button"
                                                                            onClick={() =>
                                                                              window.open(
                                                                                String(log.videoUrl || log.videoDataUrl || ""),
                                                                                "_blank",
                                                                                "noopener,noreferrer"
                                                                              )
                                                                            }
                                                                            className="rounded border border-cyan-300/45 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100"
                                                                          >
                                                                            Abrir video
                                                                          </ReliableActionButton>
                                                                          {log.videoFileName ? (
                                                                            <span className="text-[10px] text-slate-400">{log.videoFileName}</span>
                                                                          ) : null}
                                                                        </div>
                                                                      </div>
                                                                    ) : null}
                                                                  </li>
                                                                ))}
                                                              </ul>
                                                            </div>
                                                          )
                                                        ) : null}

                                                        {trainingExercisePanelMode === "registrar-peso" ? (
                                                          <div className="space-y-2">
                                                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                                              <label className="space-y-1">
                                                                <span className="text-xs font-semibold text-slate-200">Fecha</span>
                                                                <input
                                                                  type="date"
                                                                  value={trainingRecordDraft.fecha}
                                                                  onChange={(event) =>
                                                                    setTrainingRecordDraft((prev) => ({
                                                                      ...prev,
                                                                      fecha: event.target.value,
                                                                    }))
                                                                  }
                                                                  className="w-full rounded-md border border-white/15 bg-[#0e1012] px-2 py-1.5 text-xs text-white"
                                                                />
                                                              </label>
                                                              <label className="space-y-1">
                                                                <span className="text-xs font-semibold text-slate-200">Series</span>
                                                                <input
                                                                  value={trainingRecordDraft.series}
                                                                  onChange={(event) =>
                                                                    setTrainingRecordDraft((prev) => ({
                                                                      ...prev,
                                                                      series: event.target.value,
                                                                    }))
                                                                  }
                                                                  className="w-full rounded-md border border-white/15 bg-[#0e1012] px-2 py-1.5 text-xs text-white"
                                                                />
                                                              </label>
                                                              <label className="space-y-1">
                                                                <span className="text-xs font-semibold text-slate-200">Repeticiones</span>
                                                                <input
                                                                  value={trainingRecordDraft.repeticiones}
                                                                  onChange={(event) =>
                                                                    setTrainingRecordDraft((prev) => ({
                                                                      ...prev,
                                                                      repeticiones: event.target.value,
                                                                    }))
                                                                  }
                                                                  className="w-full rounded-md border border-white/15 bg-[#0e1012] px-2 py-1.5 text-xs text-white"
                                                                />
                                                              </label>
                                                              <label className="space-y-1">
                                                                <span className="text-xs font-semibold text-slate-200">Peso (kg)</span>
                                                                <input
                                                                  value={trainingRecordDraft.pesoKg}
                                                                  onChange={(event) =>
                                                                    setTrainingRecordDraft((prev) => ({
                                                                      ...prev,
                                                                      pesoKg: event.target.value,
                                                                    }))
                                                                  }
                                                                  className="w-full rounded-md border border-white/15 bg-[#0e1012] px-2 py-1.5 text-xs text-white"
                                                                />
                                                              </label>
                                                            </div>

                                                            <label className="block space-y-1">
                                                              <span className="text-xs font-semibold text-slate-200">Comentario</span>
                                                              <input
                                                                value={trainingRecordDraft.comentarios}
                                                                onChange={(event) =>
                                                                  setTrainingRecordDraft((prev) => ({
                                                                    ...prev,
                                                                    comentarios: event.target.value,
                                                                  }))
                                                                }
                                                                className="w-full rounded-md border border-white/15 bg-[#0e1012] px-2 py-1.5 text-xs text-white"
                                                                placeholder="Sensaciones, tecnica, observaciones"
                                                              />
                                                            </label>

                                                            <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                                                              <input
                                                                type="checkbox"
                                                                checked={trainingRecordDraft.molestia}
                                                                onChange={(event) =>
                                                                  setTrainingRecordDraft((prev) => ({
                                                                    ...prev,
                                                                    molestia: event.target.checked,
                                                                  }))
                                                                }
                                                                className="h-3.5 w-3.5 accent-cyan-400"
                                                              />
                                                              Registrar con molestia
                                                            </label>

                                                            <ReliableActionButton
                                                              type="button"
                                                              onClick={saveTrainingWeightRecord}
                                                              className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                                                            >
                                                              Guardar registro
                                                            </ReliableActionButton>
                                                          </div>
                                                        ) : null}

                                                        {trainingRecordStatus ? (
                                                          <p className="mt-2 text-xs text-cyan-100">{trainingRecordStatus}</p>
                                                        ) : null}
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                );
                                              })}
                                            </div>

                                            <div className="mt-2 flex justify-end">
                                              <ReliableActionButton
                                                type="button"
                                                onClick={() =>
                                                  removeTrainingBlock(
                                                    selectedTrainingWeek.id,
                                                    selectedTrainingDay.id,
                                                    block.id
                                                  )
                                                }
                                                className="rounded-full border border-rose-300/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
                                              >
                                                Eliminar bloque
                                              </ReliableActionButton>
                                            </div>
                                            </article>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="border-l-2 border-white/20 pl-3 text-sm text-slate-300">
                                  Selecciona un dia para editarlo.
                                </p>
                              )}

                            <label className="block space-y-1 border-t border-cyan-300/15 pt-3">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">Objetivo semanal</span>
                              <textarea
                                value={selectedTrainingWeek.objetivo || ""}
                                onChange={(event) =>
                                  updateTrainingWeekField(
                                    selectedTrainingWeek.id,
                                    "objetivo",
                                    event.target.value
                                  )
                                }
                                className="min-h-[72px] w-full border-b border-white/20 bg-transparent px-0 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-200/60"
                                placeholder="Objetivo de la semana"
                              />
                            </label>
                            </section>
                          ) : (
                            <p className="border-l-2 border-white/20 pl-3 text-sm text-slate-300">
                              Selecciona una semana para comenzar a editar el plan.
                            </p>
                          )}
                        </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {visibleTrainingWeeks.map((week) => (
                            <ReliableActionButton
                              key={week.id}
                              type="button"
                              onClick={() => selectTrainingPreviewWeek(week.id)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                trainingPreviewWeekId === week.id
                                  ? "border-cyan-200/70 bg-cyan-300 text-slate-950"
                                  : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                              }`}
                            >
                              {week.nombre || "Semana"}
                            </ReliableActionButton>
                          ))}
                        </div>

                        {selectedTrainingWeek ? (
                          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02]/35 p-4">
                            <div>
                              <p className="text-sm font-black text-white">{selectedTrainingWeek.nombre}</p>
                              <p className="text-xs text-slate-300">
                                {selectedTrainingWeek.objetivo || "Sin objetivo semanal"}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {visibleTrainingDays.map((day) => (
                                <ReliableActionButton
                                  key={day.id}
                                  type="button"
                                  onClick={() => selectTrainingPreviewDay(day.id)}
                                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                                    trainingPreviewDayId === day.id
                                      ? "border-cyan-200/70 bg-cyan-300 text-slate-950"
                                      : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                                  }`}
                                >
                                  {day.dia || "Dia"}
                                </ReliableActionButton>
                              ))}
                            </div>

                            {selectedTrainingDay ? (
                              <div className="space-y-2 border-t border-white/10 pt-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-bold text-white">{selectedTrainingDay.dia}</p>
                                    <p className="text-sm text-slate-200">
                                      {selectedTrainingDay.planificacion || "Sin planificacion"}
                                    </p>
                                    {selectedTrainingDay.objetivo ? (
                                      <p className="text-xs text-fuchsia-100/90">
                                        Objetivo del dia: {selectedTrainingDay.objetivo}
                                      </p>
                                    ) : null}
                                  </div>
                                  <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                    {selectedTrainingDayBlockSummary} ejercicios
                                  </span>
                                </div>

                                {selectedTrainingDayFeedbackConfig?.enabled ? (
                                  <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/[0.07] p-2.5 text-xs text-emerald-100">
                                    {selectedTrainingDayFeedbackConfig.title || "Feedback post sesion"} · {selectedTrainingDayFeedbackQuestions.length} preguntas
                                  </div>
                                ) : null}

                                {selectedTrainingDayBlocks.length > 0 ? (
                                  <div className="space-y-2">
                                    {selectedTrainingDayBlocks.map((block, blockIndex) => (
                                      <article
                                        key={block.id || `${selectedTrainingDay.id}-block-${blockIndex}`}
                                        className="border-l-2 border-cyan-300/25 pl-3"
                                      >
                                        <p className="text-sm font-semibold text-white">
                                          {block.titulo || `Bloque ${blockIndex + 1}`}
                                        </p>
                                        {(block.ejercicios || []).length === 0 ? (
                                          <p className="text-xs text-slate-400">Sin ejercicios.</p>
                                        ) : (
                                          <ul className="mt-1 space-y-1 text-xs text-slate-200">
                                            {(block.ejercicios || []).map((exercise) => {
                                              const exerciseMeta =
                                                ejercicios.find((item) => item.id === exercise.ejercicioId) || null;
                                              return (
                                                <li key={exercise.id}>
                                                  {exerciseMeta?.nombre || "Ejercicio"} · {exercise.series || "-"} x {exercise.repeticiones || "-"} · Desc. {exercise.descanso || "-"} · Carga {exercise.carga || "-"}
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        )}
                                      </article>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-300">Este dia no tiene bloques cargados.</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : activeTab === "plan-nutricional" ? (
                  <div className="rounded-[30px] border border-emerald-300/28 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),rgba(15,23,42,0.88)_45%,rgba(2,6,23,0.96)_100%)] px-4 py-5 shadow-[0_28px_70px_-46px_rgba(16,185,129,0.45)] sm:px-5 lg:px-7 lg:py-6">
                    {/* Header */}
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-emerald-100/85">Plan nutricional</p>
                        <h3 className="mt-1 text-xl font-black text-white">Nutrición personalizada</h3>
                        <p className="mt-1 text-sm text-slate-200/90">
                          Plan calibrado a los parámetros físicos y objetivo del cliente.
                        </p>
                      </div>
                      {canEditTrainingPlan && (
                        <div className="flex flex-wrap gap-2">
                          {selectedNutritionPlan && (
                            <>
                              <ReliableActionButton
                                type="button"
                                onClick={() => setNutritionEditMode((v) => !v)}
                                disabled={nutritionAssigning}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                                  nutritionEditMode
                                    ? "border-amber-300/50 bg-amber-500/15 text-amber-200"
                                    : "border-white/20 text-slate-300 hover:bg-white/8"
                                }`}
                              >
                                {nutritionEditMode ? "✓ Editando" : "✏️ Editar plan"}
                              </ReliableActionButton>
                              <ReliableActionButton
                                type="button"
                                onClick={syncNutritionPlan}
                                disabled={nutritionSyncing || nutritionAssigning}
                                className={`relative rounded-lg border px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-60 ${
                                  hasUnsavedNutritionChanges
                                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.35)] hover:bg-emerald-500/30"
                                    : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                                }`}
                              >
                                {hasUnsavedNutritionChanges && !nutritionSyncing && (
                                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,1)]" />
                                )}
                                {nutritionSyncing ? "Actualizando..." : "Actualizar planilla"}
                              </ReliableActionButton>
                            </>
                          )}
                          <ReliableActionButton
                            type="button"
                            onClick={() => openNutritionWizard()}
                            disabled={nutritionAssigning}
                            className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                          >
                            ✨ {selectedNutritionPlan ? "Regenerar plan" : "Nuevo plan"}
                          </ReliableActionButton>
                          <ReliableActionButton
                            type="button"
                            onClick={() => openNutritionWizard("__pick__")}
                            disabled={nutritionAssigning}
                            className="rounded-lg border border-emerald-300/25 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/8 disabled:opacity-60"
                          >
                            📋 Asignar existente
                          </ReliableActionButton>
                        </div>
                      )}
                    </div>

                    {/* Estado de carga */}
                    {nutritionAssigning && (
                      <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                        <p className="text-sm font-medium text-emerald-200">Analizando perfil y personalizando el plan…</p>
                      </div>
                    )}

                    {selectedNutritionPlan ? (
                      <>
                        {/* Resumen del plan */}
                        <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/8 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/70">Plan activo</p>
                              <p className="mt-0.5 text-base font-black text-white">{selectedNutritionPlan.nombre}</p>
                              {selectedNutritionPlan.notas && (
                                <p className="mt-1 text-xs text-slate-400">{selectedNutritionPlan.notas}</p>
                              )}
                            </div>
                            <p className="shrink-0 text-xs text-slate-400">
                              {new Date(selectedNutritionAssignment?.assignedAt || selectedNutritionPlan.updatedAt).toLocaleDateString("es-AR")}
                            </p>
                          </div>

                          {/* Métricas clave */}
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                              { label: "Objetivo",      value: nutritionGoalLabel(selectedNutritionPlan.objetivo), color: "text-cyan-200"   },
                              { label: "Kcal / día",    value: `${selectedNutritionPlan.targets.calorias} kcal`,   color: "text-amber-200"  },
                              { label: "Proteínas",     value: `${selectedNutritionPlan.targets.proteinas} g`,     color: "text-violet-200" },
                              { label: "Carbohidratos", value: `${selectedNutritionPlan.targets.carbohidratos} g`, color: "text-emerald-200"},
                            ].map((s) => (
                              <div key={s.label} className="rounded-lg border border-white/8 bg-[#0e1012]/70 px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                                <p className={`mt-0.5 text-sm font-black ${s.color}`}>{s.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Perfil físico aplicado */}
                          {selectedNutritionPlan.perfil && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {[
                                `${selectedNutritionPlan.perfil.pesoKg} kg`,
                                `${selectedNutritionPlan.perfil.alturaCm} cm`,
                                `${selectedNutritionPlan.perfil.edad} años`,
                                `${selectedNutritionPlan.perfil.comidasDia} comidas/día`,
                                selectedNutritionPlan.perfil.diasEntrenamiento
                                  ? `${selectedNutritionPlan.perfil.diasEntrenamiento} días entren./sem.`
                                  : null,
                              ].filter(Boolean).map((tag) => (
                                <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Barra macro visual */}
                          {(() => {
                            const t = selectedNutritionPlan.targets;
                            const total = t.proteinas * 4 + t.carbohidratos * 4 + t.grasas * 9;
                            const pPct  = total > 0 ? Math.round((t.proteinas * 4    / total) * 100) : 0;
                            const cPct  = total > 0 ? Math.round((t.carbohidratos * 4 / total) * 100) : 0;
                            const gPct  = total > 0 ? Math.round((t.grasas * 9       / total) * 100) : 0;
                            return (
                              <div className="mt-3">
                                <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                                  <span>Prot {pPct}%</span><span>Carbs {cPct}%</span><span>Grasas {gPct}%</span>
                                </div>
                                <div className="flex h-2 overflow-hidden rounded-full">
                                  <div className="bg-violet-500" style={{ width: `${pPct}%` }} />
                                  <div className="bg-emerald-500" style={{ width: `${cPct}%` }} />
                                  <div className="bg-amber-500" style={{ width: `${gPct}%` }} />
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Banner modo edición */}
                        {nutritionEditMode && (
                          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-2.5">
                            <p className="text-xs font-semibold text-amber-200">✏️ Modo edición — modificá los gramos o eliminá alimentos. Los cambios se guardan al instante.</p>
                            <ReliableActionButton
                              type="button"
                              onClick={() => { setNutritionEditMode(false); setNutritionGramEdit(null); setNutritionAddFoodMealId(null); setHasUnsavedNutritionChanges(false); }}
                              className="shrink-0 rounded-lg border border-amber-300/30 px-3 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/15"
                            >
                              Cerrar edición
                            </ReliableActionButton>
                          </div>
                        )}

                        {/* Comidas */}
                        <div className="mt-4 space-y-2">
                          {selectedNutritionPlan.comidas.length === 0 ? (
                            <p className="rounded-xl border border-white/10 bg-[#0e1012] p-4 text-sm text-slate-400">
                              El plan no tiene comidas cargadas.
                            </p>
                          ) : (
                            selectedNutritionPlan.comidas.map((meal) => {
                              const mealKcal = meal.items.reduce((sum, itm) => {
                                const food = nutritionFoodsById.get(itm.foodId);
                                return sum + (food ? food.kcalPer100g * itm.gramos / 100 : 0);
                              }, 0);
                              const isAddingFood = nutritionAddFoodMealId === meal.id;
                              const foodResults = nutritionFoodSearch.trim().length >= 2
                                ? Array.from(nutritionFoodsById.values())
                                    .filter((f) => f.nombre.toLowerCase().includes(nutritionFoodSearch.toLowerCase()))
                                    .slice(0, 8)
                                : [];
                              return (
                                <article key={meal.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-white">{meal.nombre}</p>
                                    <div className="flex items-center gap-2">
                                      {mealKcal > 0 && (
                                        <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                                          {Math.round(mealKcal)} kcal
                                        </span>
                                      )}
                                      {nutritionEditMode && (
                                        <ReliableActionButton
                                          type="button"
                                          onClick={() => {
                                            setNutritionAddFoodMealId(isAddingFood ? null : meal.id);
                                            setNutritionFoodSearch("");
                                          }}
                                          className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                                        >
                                          {isAddingFood ? "— Cancelar" : "+ Agregar"}
                                        </ReliableActionButton>
                                      )}
                                    </div>
                                  </div>

                                  {/* Panel agregar alimento */}
                                  {isAddingFood && (
                                    <div className="mt-2 rounded-xl border border-emerald-300/20 bg-emerald-500/5 p-3">
                                      <input
                                        value={nutritionFoodSearch}
                                        onChange={(e) => setNutritionFoodSearch(e.target.value)}
                                        placeholder="Buscar alimento…"
                                        autoFocus
                                        className="w-full rounded-lg border border-white/15 bg-[#0e1012] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
                                      />
                                      {foodResults.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          {foodResults.map((f) => (
                                            <ReliableActionButton
                                              key={f.id}
                                              type="button"
                                              onClick={() => addNutritionItem(meal.id, f.id)}
                                              className="w-full rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.06]"
                                            >
                                              <span className="font-medium">{f.nombre}</span>
                                              <span className="ml-2 text-slate-500">{f.kcalPer100g} kcal/100g · P{f.proteinPer100g}g · C{f.carbsPer100g}g · G{f.fatPer100g}g</span>
                                            </ReliableActionButton>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {meal.items.length === 0 ? (
                                    <p className="mt-1 text-xs text-slate-500">Sin alimentos.</p>
                                  ) : (
                                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                                      {meal.items.map((itm) => {
                                        const food = nutritionFoodsById.get(itm.foodId);
                                        const itemKcal = food ? Math.round(food.kcalPer100g * itm.gramos / 100) : 0;
                                        const isEditingGrams = nutritionGramEdit?.mealId === meal.id && nutritionGramEdit?.itemId === itm.id;
                                        return (
                                          <div key={itm.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${nutritionEditMode ? "border-white/10 bg-[#0e1012]/60 hover:border-white/20" : "border-white/5 bg-[#0e1012]/50"}`}>
                                            <span className="min-w-0 flex-1 truncate text-slate-300">{food?.nombre || itm.foodId}</span>
                                            {isEditingGrams ? (
                                              <div className="flex shrink-0 items-center gap-1">
                                                <input
                                                  type="number"
                                                  value={nutritionGramEdit!.value}
                                                  onChange={(e) => setNutritionGramEdit({ ...nutritionGramEdit!, value: e.target.value })}
                                                  onBlur={saveNutritionInlineEdit}
                                                  onKeyDown={(e) => { if (e.key === "Enter") saveNutritionInlineEdit(); if (e.key === "Escape") setNutritionGramEdit(null); }}
                                                  autoFocus
                                                  className="w-14 rounded border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-right text-[11px] text-emerald-200 outline-none"
                                                />
                                                <span className="text-slate-500">g</span>
                                              </div>
                                            ) : (
                                              <div className="flex shrink-0 items-center gap-1.5">
                                                <span
                                                  onClick={nutritionEditMode ? () => setNutritionGramEdit({ mealId: meal.id, itemId: itm.id, value: String(itm.gramos) }) : undefined}
                                                  className={`font-semibold text-slate-400 ${nutritionEditMode ? "cursor-pointer rounded px-1 hover:bg-white/10 hover:text-white" : ""}`}
                                                >
                                                  {itm.gramos} g{itemKcal > 0 ? ` · ${itemKcal} kcal` : ""}
                                                </span>
                                                {nutritionEditMode && (
                                                  <ReliableActionButton
                                                    type="button"
                                                    onClick={() => removeNutritionItem(meal.id, itm.id)}
                                                    className="flex h-4 w-4 items-center justify-center rounded-full text-slate-600 hover:bg-red-500/20 hover:text-red-400"
                                                  >
                                                    ×
                                                  </ReliableActionButton>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </article>
                              );
                            })
                          )}
                        </div>
                      </>
                    ) : !nutritionAssigning ? (
                      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-6 text-center">
                        <p className="text-2xl">🥗</p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">Sin plan nutricional</p>
                        <p className="mt-1 text-xs text-slate-400">Generá un plan personalizado basado en el perfil de este cliente, o asigná uno existente.</p>
                        {canEditTrainingPlan && (
                          <div className="mt-4 flex justify-center gap-2">
                            <ReliableActionButton
                              type="button"
                              onClick={() => openNutritionWizard()}
                              className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
                            >
                              ✨ Crear plan personalizado
                            </ReliableActionButton>
                            <ReliableActionButton
                              type="button"
                              onClick={() => openNutritionWizard("__pick__")}
                              className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/8"
                            >
                              📋 Asignar plan existente
                            </ReliableActionButton>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : activeTab === "progreso" ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-[#0e1012] p-4">
                      <p className="text-xs text-slate-300">Wellness</p>
                      <p className="text-3xl font-black text-cyan-100">{selectedClient.wellness ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0e1012] p-4">
                      <p className="text-xs text-slate-300">Carga</p>
                      <p className="text-3xl font-black text-emerald-100">{selectedClient.carga ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0e1012] p-4">
                      <p className="text-xs text-slate-300">Peso actual</p>
                      <p className="text-3xl font-black text-violet-100">{selectedClient.peso || "-"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div
                      className={`rounded-2xl border p-4 ${
                        tabVisualConfig[activeTab]?.accent || "border-slate-300/25 bg-slate-700/20"
                      }`}
                    >
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-200/80">
                        {tabVisualConfig[activeTab]?.badge || "Detalle"}
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        {tabVisualConfig[activeTab]?.title || TABS.find((item) => item.id === activeTab)?.label}
                      </h3>
                      <p className="mt-1 text-sm text-slate-200/90">
                        {tabVisualConfig[activeTab]?.hint || tabPlaceholderCopy[activeTab] || "Apartado editable del cliente."}
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-white/15 bg-white/[0.025] p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Cliente</p>
                          <p className="truncate text-sm font-bold text-white">{selectedClient.nombre}</p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/[0.025] p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Vigencia plan</p>
                          <p className="truncate text-sm font-bold text-white">
                            {selectedMeta.startDate || "Sin inicio"} - {selectedMeta.endDate || "Sin fin"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/[0.025] p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Largo de nota</p>
                          <p className="text-sm font-bold text-white">
                            {(selectedMeta.tabNotas[activeTab] || "").trim().length} caracteres
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300">
                      Campo de trabajo para {TABS.find((item) => item.id === activeTab)?.label?.toLowerCase()}.
                    </p>
                    <textarea
                      value={selectedMeta.tabNotas[activeTab] || ""}
                      onChange={(e) => updateTabNote(activeTab, e.target.value)}
                      rows={10}
                      className="w-full rounded-2xl border border-white/20 bg-[#0e1012]/80 px-4 py-3 text-sm leading-relaxed shadow-inner shadow-cyan-500/5"
                      placeholder="Escribe aqui observaciones accionables, acuerdos y pendientes..."
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        ) : null}
      </section>
        </>
      )}

      {feedbackModalTarget ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/[0.02]/85 px-3 py-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl pf-card rounded-2xl border border-emerald-300/30 p-5 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Feedback post sesión</p>
                <h2 className="mt-1 text-xl font-black text-white">Mediciones para el cierre del día</h2>
                <p className="mt-1 text-xs text-slate-300">
                  Elegí qué mediciones le mostramos al alumno cuando finaliza la sesión. Las marcadas como obligatorias deben completarse antes de guardar.
                </p>
              </div>
              <ReliableActionButton
                type="button"
                onClick={closeFeedbackModal}
                aria-label="Cerrar"
                className="rounded-full border border-white/15 bg-[#0e1012] px-2 py-1 text-sm text-slate-200 hover:bg-slate-700"
              >
                ✕
              </ReliableActionButton>
            </div>

            <label className="mt-4 grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
              Título del cuestionario (opcional)
              <input
                value={feedbackModalTitle}
                onChange={(event) => setFeedbackModalTitle(event.target.value)}
                placeholder="Ej: ¿Cómo te sentiste al cerrar la sesión?"
                className="rounded-lg border border-white/15 bg-slate-700 px-3 py-2 text-sm text-white"
              />
            </label>

            <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02]/40">
              <div className="grid grid-cols-[1.2fr_2.2fr_0.6fr_0.6fr] gap-2 border-b border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                <span>Medición</span>
                <span>Descripción</span>
                <span className="text-center">Visible</span>
                <span className="text-center">Obligatoria</span>
              </div>
              {POST_SESSION_MEASUREMENT_CATALOG.map((entry, index) => {
                const state =
                  feedbackModalMeasurements.find((m) => m.id === entry.id) || {
                    id: entry.id,
                    visible: false,
                    obligatoria: false,
                  };
                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[1.2fr_2.2fr_0.6fr_0.6fr] items-center gap-2 px-3 py-3 text-xs ${
                      index % 2 === 1 ? "bg-[#0e1012]/40" : ""
                    } border-b border-white/5`}
                  >
                    <p className="font-bold text-slate-100">{entry.nombre}</p>
                    <p className="text-slate-300">{entry.descripcion}</p>
                    <div className="flex justify-center gap-1">
                      <ReliableActionButton
                        type="button"
                        onClick={() => toggleFeedbackModalMeasurement(entry.id, "visible", true)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                          state.visible
                            ? "border-cyan-300/70 bg-cyan-400/30 text-cyan-50"
                            : "border-white/15 bg-white/[0.025] text-slate-300"
                        }`}
                      >
                        SÍ
                      </ReliableActionButton>
                      <ReliableActionButton
                        type="button"
                        onClick={() => toggleFeedbackModalMeasurement(entry.id, "visible", false)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                          !state.visible
                            ? "border-cyan-300/70 bg-cyan-400/30 text-cyan-50"
                            : "border-white/15 bg-white/[0.025] text-slate-300"
                        }`}
                      >
                        NO
                      </ReliableActionButton>
                    </div>
                    <div className="flex justify-center gap-1">
                      <ReliableActionButton
                        type="button"
                        onClick={() => toggleFeedbackModalMeasurement(entry.id, "obligatoria", true)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                          state.obligatoria
                            ? "border-amber-300/70 bg-amber-400/25 text-amber-50"
                            : "border-white/15 bg-white/[0.025] text-slate-300"
                        }`}
                      >
                        SÍ
                      </ReliableActionButton>
                      <ReliableActionButton
                        type="button"
                        onClick={() => toggleFeedbackModalMeasurement(entry.id, "obligatoria", false)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                          !state.obligatoria
                            ? "border-amber-300/70 bg-amber-400/25 text-amber-50"
                            : "border-white/15 bg-white/[0.025] text-slate-300"
                        }`}
                      >
                        NO
                      </ReliableActionButton>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                <span className="inline-flex items-center gap-1">
                  Cantidad máxima por día
                  <span title="Cuántas veces puede el alumno enviar este feedback por día (mínimo 1)." className="cursor-help text-slate-400">
                    ⓘ
                  </span>
                </span>
                <input
                  type="number"
                  min={1}
                  value={feedbackModalMaxPerDay}
                  onChange={(event) => setFeedbackModalMaxPerDay(event.target.value)}
                  className="w-24 rounded-lg border border-white/15 bg-slate-700 px-3 py-1.5 text-sm text-white"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <ReliableActionButton
                  type="button"
                  onClick={closeFeedbackModal}
                  className="rounded-lg border border-white/20 bg-[#0e1012] px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
                >
                  Cancelar
                </ReliableActionButton>
                <ReliableActionButton
                  type="button"
                  onClick={saveFeedbackModal}
                  className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-300"
                >
                  Asignar / Guardar
                </ReliableActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {newExerciseModalOpen ? (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center bg-black/65 px-0 pb-0 sm:px-4 sm:py-6 backdrop-blur-sm">
          {/* Backdrop click */}
          <div className="absolute inset-0" onClick={closeNewExerciseModal} />

          <div className="relative w-full max-w-md sm:rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)] border-t sm:border border-white/10 bg-[#0b0e11]">

            {/* Accent bar — color según categoría */}
            <div className={`h-1 w-full ${
              newExerciseCategoria === "Velocidad" ? "bg-gradient-to-r from-amber-400 to-yellow-300" :
              newExerciseCategoria === "Potencia"  ? "bg-gradient-to-r from-orange-500 to-red-400" :
              newExerciseCategoria === "Condición" ? "bg-gradient-to-r from-emerald-400 to-green-300" :
              newExerciseCategoria === "Core"      ? "bg-gradient-to-r from-violet-500 to-purple-400" :
              newExerciseCategoria === "Movilidad" ? "bg-gradient-to-r from-teal-400 to-cyan-300" :
              newExerciseCategoria === "Técnica"   ? "bg-gradient-to-r from-indigo-400 to-blue-300" :
                                                    "bg-gradient-to-r from-cyan-400 to-blue-400"
            }`} />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-lg">
                  {newExerciseCategoria === "Velocidad" ? "⚡" :
                   newExerciseCategoria === "Potencia"  ? "🔥" :
                   newExerciseCategoria === "Condición" ? "🫀" :
                   newExerciseCategoria === "Core"      ? "🎯" :
                   newExerciseCategoria === "Movilidad" ? "🌀" :
                   newExerciseCategoria === "Técnica"   ? "🧠" : "💪"}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Biblioteca</p>
                  <h2 className="text-base font-black leading-tight text-white">Nuevo ejercicio</h2>
                </div>
              </div>
              <ReliableActionButton
                type="button"
                onClick={closeNewExerciseModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/6 text-slate-400 hover:bg-white/12 hover:text-white transition-colors"
              >
                ✕
              </ReliableActionButton>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Nombre — campo principal */}
              <div>
                <input
                  type="text"
                  value={newExerciseNombre}
                  onChange={(event) => setNewExerciseNombre(event.target.value)}
                  placeholder="Nombre del ejercicio…"
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-[#131720] px-4 py-3 text-base font-semibold text-white placeholder:text-slate-600 outline-none focus:border-cyan-400/50 focus:bg-[#141b24] transition"
                />
              </div>

              {/* Categoría como chips */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Categoría</p>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { value: "Fuerza",    icon: "💪", color: "border-cyan-400/40 bg-cyan-500/15 text-cyan-200"   },
                    { value: "Velocidad", icon: "⚡", color: "border-amber-400/40 bg-amber-500/15 text-amber-200"},
                    { value: "Potencia",  icon: "🔥", color: "border-orange-400/40 bg-orange-500/15 text-orange-200"},
                    { value: "Condición", icon: "🫀", color: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"},
                    { value: "Core",      icon: "🎯", color: "border-violet-400/40 bg-violet-500/15 text-violet-200"},
                    { value: "Movilidad", icon: "🌀", color: "border-teal-400/40 bg-teal-500/15 text-teal-200"},
                    { value: "Técnica",   icon: "🧠", color: "border-indigo-400/40 bg-indigo-500/15 text-indigo-200"},
                  ] as const).map((cat) => (
                    <ReliableActionButton
                      key={cat.value}
                      type="button"
                      onClick={() => setNewExerciseCategoria(cat.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                        newExerciseCategoria === cat.value
                          ? cat.color + " shadow-sm scale-[1.04]"
                          : "border-white/10 bg-white/4 text-slate-500 hover:bg-white/8 hover:text-slate-300"
                      }`}
                    >
                      {cat.icon} {cat.value}
                    </ReliableActionButton>
                  ))}
                </div>
              </div>

              {/* Objetivo + Video en fila */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">🎯 Objetivo</p>
                  <input
                    type="text"
                    value={newExerciseObjetivo}
                    onChange={(event) => setNewExerciseObjetivo(event.target.value)}
                    placeholder="Ej: Cuádriceps, glúteos"
                    className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-400/40 transition"
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">🎬 Video</p>
                  <input
                    type="url"
                    value={newExerciseVideoUrl}
                    onChange={(event) => setNewExerciseVideoUrl(event.target.value)}
                    placeholder="YouTube, Vimeo…"
                    className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-400/40 transition"
                  />
                </div>
              </div>

              {/* Descripción técnica */}
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">📝 Descripción técnica</p>
                <textarea
                  value={newExerciseDescripcion}
                  onChange={(event) => setNewExerciseDescripcion(event.target.value)}
                  placeholder="Posición de partida, puntos clave de ejecución…"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-400/40 transition"
                />
              </div>

              {newExerciseError ? (
                <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">
                  ⚠ {newExerciseError}
                </p>
              ) : null}

              {/* Botones */}
              <div className="flex gap-2 pt-1">
                <ReliableActionButton
                  type="button"
                  onClick={closeNewExerciseModal}
                  disabled={newExerciseSaving}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50 transition"
                >
                  Cancelar
                </ReliableActionButton>
                <ReliableActionButton
                  type="button"
                  onClick={saveNewExerciseFromModal}
                  disabled={newExerciseSaving || !newExerciseNombre.trim()}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                    newExerciseCategoria === "Velocidad" ? "bg-amber-500 hover:bg-amber-400 text-black" :
                    newExerciseCategoria === "Potencia"  ? "bg-orange-500 hover:bg-orange-400 text-white" :
                    newExerciseCategoria === "Condición" ? "bg-emerald-500 hover:bg-emerald-400 text-black" :
                    newExerciseCategoria === "Core"      ? "bg-violet-500 hover:bg-violet-400 text-white" :
                    newExerciseCategoria === "Movilidad" ? "bg-teal-500 hover:bg-teal-400 text-black" :
                    newExerciseCategoria === "Técnica"   ? "bg-indigo-500 hover:bg-indigo-400 text-white" :
                                                          "bg-cyan-500 hover:bg-cyan-400 text-black"
                  }`}
                >
                  {newExerciseSaving ? "Guardando…" : "Guardar ejercicio"}
                </ReliableActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Assign Training Plan Modal ── */}
      {showAssignPlanModal && selectedClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowAssignPlanModal(false)}
          />

          <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-300/20 bg-[#0b0e11] shadow-[0_40px_80px_-20px_rgba(34,211,238,0.25)] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0e1214] px-6 py-4 shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-400/80">
                  Plan de entrenamiento
                </p>
                <h2 className="mt-0.5 text-lg font-black text-white">
                  Asignar a {selectedClient.nombre}
                </h2>
              </div>
              <ReliableActionButton
                type="button"
                onClick={() => setShowAssignPlanModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white transition-colors"
              >
                ✕
              </ReliableActionButton>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-[#0c0f12] px-6 py-3 shrink-0">
              <input
                value={assignPlanSearch}
                onChange={(e) => setAssignPlanSearch(e.target.value)}
                placeholder="Buscar template o plan IA…"
                className="h-8 min-w-[180px] flex-1 rounded-lg border border-white/12 bg-white/6 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400/50"
              />
              {(["todos", "template", "ia"] as const).map((f) => (
                <ReliableActionButton
                  key={f}
                  type="button"
                  onClick={() => setAssignPlanFilter(f)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    assignPlanFilter === f
                      ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                      : "border-white/15 text-slate-400 hover:bg-white/8"
                  }`}
                >
                  {f === "todos" ? "Todos" : f === "template" ? "Templates" : "IA"}
                </ReliableActionButton>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {assignPlanItems.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-3xl">🔍</p>
                  <p className="mt-3 text-sm text-slate-400">
                    {assignPlanSearch
                      ? "Sin resultados para esa búsqueda."
                      : templatesAlumnos.length === 0 && aiTrainingPlans.length === 0
                        ? "Todavía no tenés templates ni planes IA creados."
                        : "Sin templates disponibles."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {assignPlanItems.map((item) => (
                    <div
                      key={item.optionId}
                      className="group relative rounded-xl border border-white/10 bg-white/4 p-4 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/8"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-400">
                              {item.source === "template" ? "Template" : "IA"}
                            </span>
                            {item.categoria && (
                              <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300/80">
                                {item.categoria}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-100 truncate" title={item.nombre}>
                            {item.nombre}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>📅 {item.totalSemanas} semana{item.totalSemanas !== 1 ? "s" : ""}</span>
                            {item.deporte && <span>⚽ {item.deporte}</span>}
                          </div>
                        </div>
                      </div>
                      <ReliableActionButton
                        type="button"
                        onClick={() => assignPlanFromModal(item.optionId)}
                        className="mt-3 w-full rounded-lg border border-cyan-300/30 bg-cyan-500/12 py-1.5 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-500/25 hover:border-cyan-300/50"
                      >
                        Asignar este plan
                      </ReliableActionButton>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer — crear desde cero */}
            <div className="shrink-0 border-t border-white/10 bg-[#0c0f12] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-300">Crear desde cero</p>
                  <p className="text-[11px] text-slate-500">Plan vacío para completar manualmente.</p>
                </div>
                <ReliableActionButton
                  type="button"
                  onClick={handleCreateBlankPlanFromModal}
                  className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 transition-colors"
                >
                  + Plan vacío
                </ReliableActionButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal asignación plan nutricional ─────────────────────────────────── */}
      {/* ── Wizard plan nutricional ─────────────────────────────────────────── */}
      {nutritionWizard && selectedClient && (
        <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
          <div className="absolute inset-0" onClick={() => setNutritionWizard(null)} />

          {/* ── PASO 0: picker de plan existente ── */}
          {nutritionWizard.basePlanId === "__pick__" ? (
            <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#0c0f12] shadow-2xl sm:rounded-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/70">Plan nutricional</p>
                  <h2 className="text-base font-black text-white">Asignar plan existente</h2>
                  <p className="text-xs text-slate-400">{selectedClient.nombre}</p>
                </div>
                <ReliableActionButton type="button" onClick={() => setNutritionWizard(null)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10">×</ReliableActionButton>
              </div>
              <div className="shrink-0 border-b border-white/8 px-5 py-3">
                <input
                  value={nutritionAssignSearch}
                  onChange={(e) => setNutritionAssignSearch(e.target.value)}
                  placeholder="Buscar plan…"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {(() => {
                  const q = nutritionAssignSearch.toLowerCase().trim();
                  const filtered = nutritionPlans.filter((p) =>
                    !q || p.nombre.toLowerCase().includes(q) || nutritionGoalLabel(p.objetivo).toLowerCase().includes(q)
                  );
                  if (filtered.length === 0) {
                    return <p className="py-8 text-center text-sm text-slate-500">{nutritionPlans.length === 0 ? "No hay planes nutricionales creados aún." : "Sin resultados."}</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {filtered.map((plan) => (
                        <div key={plan.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-emerald-400/30 hover:bg-emerald-500/5">
                          <p className="truncate font-semibold text-slate-100">{plan.nombre}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300/80">{nutritionGoalLabel(plan.objetivo)}</span>
                            <span>{plan.targets.calorias} kcal · P{plan.targets.proteinas}g · C{plan.targets.carbohidratos}g · G{plan.targets.grasas}g</span>
                          </div>
                          <ReliableActionButton
                            type="button"
                            onClick={() => setNutritionWizard((prev) => prev ? { ...prev, basePlanId: plan.id, step: 1 } : null)}
                            className="mt-3 w-full rounded-lg border border-emerald-300/30 bg-emerald-500/10 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20"
                          >
                            Seleccionar y personalizar →
                          </ReliableActionButton>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="shrink-0 border-t border-white/10 px-5 py-3">
                <ReliableActionButton
                  type="button"
                  onClick={() => setNutritionWizard((prev) => prev ? { ...prev, basePlanId: undefined, step: 1 } : null)}
                  className="w-full rounded-lg border border-violet-300/30 bg-violet-500/10 py-2 text-xs font-bold text-violet-200 hover:bg-violet-500/20"
                >
                  ✨ Crear plan desde cero en cambio
                </ReliableActionButton>
              </div>
            </div>

          ) : (
            /* ── PASOS 1, 2 y 3: wizard de configuración + análisis ── */
            <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#0c0f12] shadow-2xl sm:rounded-2xl">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/70">
                    Paso {nutritionWizard.step} de 3 —&nbsp;
                    {nutritionWizard.step === 1 ? "Datos físicos" : nutritionWizard.step === 2 ? "Objetivo y preferencias" : "Revisión del análisis"}
                  </p>
                  <h2 className="text-base font-black text-white">
                    {nutritionWizard.step === 1 ? "Perfil corporal" : nutritionWizard.step === 2 ? "Parámetros del plan" : "Análisis completo"}
                  </h2>
                  <p className="text-xs text-slate-400">{selectedClient.nombre}</p>
                </div>
                <ReliableActionButton type="button" onClick={() => setNutritionWizard(null)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10">×</ReliableActionButton>
              </div>

              {/* Progress bar — 3 segmentos */}
              <div className="h-1 shrink-0 bg-white/5">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: nutritionWizard.step === 1 ? "33%" : nutritionWizard.step === 2 ? "66%" : "100%" }}
                />
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">

                {/* ── Paso 1: Datos físicos ── */}
                {nutritionWizard.step === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">Verificá o corregí los datos físicos del cliente. Se usan para calcular el gasto energético (fórmula Mifflin-St Jeor).</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Peso (kg)</label>
                        <input type="number" value={nutritionWizard.pesoKg}
                          onChange={(e) => setNutritionWizard((prev) => prev ? { ...prev, pesoKg: e.target.value } : null)}
                          placeholder="70" className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Altura (cm)</label>
                        <input type="number" value={nutritionWizard.alturaCm}
                          onChange={(e) => setNutritionWizard((prev) => prev ? { ...prev, alturaCm: e.target.value } : null)}
                          placeholder="170" className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Edad</label>
                        <input type="number" value={nutritionWizard.edad}
                          onChange={(e) => setNutritionWizard((prev) => prev ? { ...prev, edad: e.target.value } : null)}
                          placeholder="25" className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Sexo biológico</label>
                        <div className="flex gap-2">
                          {(["masculino", "femenino"] as const).map((s) => (
                            <ReliableActionButton key={s} type="button"
                              onClick={() => setNutritionWizard((prev) => prev ? { ...prev, sexo: s } : null)}
                              className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${nutritionWizard.sexo === s ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-[#131720] text-slate-400 hover:bg-white/8"}`}>
                              {s === "masculino" ? "♂ Masculino" : "♀ Femenino"}
                            </ReliableActionButton>
                          ))}
                        </div>
                      </div>
                    </div>
                    {nutritionWizard.pesoKg && nutritionWizard.alturaCm && nutritionWizard.edad && (
                      <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Estimación rápida</p>
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                          {(() => {
                            const p = parseFloat(nutritionWizard.pesoKg) || 0;
                            const h = parseFloat(nutritionWizard.alturaCm) || 0;
                            const a = parseInt(nutritionWizard.edad) || 0;
                            if (!p || !h || !a) return null;
                            const bmr = Math.round((10*p + 6.25*h - 5*a) + (nutritionWizard.sexo === "masculino" ? 5 : -161));
                            const imc = (p / ((h/100)**2)).toFixed(1);
                            const imcLabel = +imc < 18.5 ? "bajo peso" : +imc < 25 ? "normal" : +imc < 30 ? "sobrepeso" : "obesidad";
                            return (
                              <>
                                <span className="text-slate-300">IMC <strong className="text-white">{imc}</strong> <span className="text-slate-500">({imcLabel})</span></span>
                                <span className="text-slate-300">TMB <strong className="text-white">{bmr} kcal/día</strong></span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Paso 2: Objetivo y preferencias ── */}
                {nutritionWizard.step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Objetivo nutricional</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { id: "mantenimiento", label: "Mantenimiento",     desc: "Sostener composición actual",  color: "emerald" },
                          { id: "recomposicion", label: "Recomposición",     desc: "Bajar grasa, ganar músculo",   color: "cyan"    },
                          { id: "deficit",       label: "Pérdida de peso",   desc: "Déficit calórico controlado",  color: "amber"   },
                          { id: "masa",          label: "Ganancia muscular", desc: "Superávit para volumen",       color: "violet"  },
                        ] as { id: NutritionGoal; label: string; desc: string; color: string }[]).map((opt) => (
                          <ReliableActionButton key={opt.id} type="button"
                            onClick={() => setNutritionWizard((prev) => prev ? { ...prev, objetivo: opt.id } : null)}
                            className={`rounded-xl border p-3 text-left transition-colors ${nutritionWizard.objetivo === opt.id ? `border-${opt.color}-400/50 bg-${opt.color}-500/15` : "border-white/10 bg-[#131720] hover:bg-white/5"}`}>
                            <p className={`text-xs font-bold ${nutritionWizard.objetivo === opt.id ? `text-${opt.color}-200` : "text-slate-200"}`}>{opt.label}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">{opt.desc}</p>
                          </ReliableActionButton>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Días entreno/semana</label>
                        <select value={nutritionWizard.diasEntrenamiento}
                          onChange={(e) => setNutritionWizard((prev) => prev ? { ...prev, diasEntrenamiento: e.target.value } : null)}
                          className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40">
                          <option value="">Seleccionar</option>
                          {[0,1,2,3,4,5,6,7].map((d) => (
                            <option key={d} value={String(d)}>{d === 0 ? "Ninguno (sedentario)" : `${d} ${d === 1 ? "día" : "días"}`}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Comidas por día</label>
                        <select value={nutritionWizard.comidasDia}
                          onChange={(e) => setNutritionWizard((prev) => prev ? { ...prev, comidasDia: e.target.value } : null)}
                          className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40">
                          {[3,4,5,6].map((n) => (<option key={n} value={String(n)}>{n} comidas</option>))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Horario de entrenamiento <span className="normal-case text-slate-600">(opcional)</span></label>
                      <input value={nutritionWizard.horarioEntrenamiento}
                        onChange={(e) => setNutritionWizard((prev) => prev ? { ...prev, horarioEntrenamiento: e.target.value } : null)}
                        placeholder="Ej: Mañana 7–9h, tarde 18–20h…"
                        className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Restricciones / alergias alimentarias</label>
                      <input value={nutritionWizard.restricciones}
                        onChange={(e) => setNutritionWizard((prev) => prev ? { ...prev, restricciones: e.target.value } : null)}
                        placeholder="Ej: Sin gluten, intolerante a la lactosa, vegetariano…"
                        className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Condiciones médicas relevantes</label>
                      <input value={nutritionWizard.condicionesMedicas}
                        onChange={(e) => setNutritionWizard((prev) => prev ? { ...prev, condicionesMedicas: e.target.value } : null)}
                        placeholder="Ej: Diabetes tipo 2, HTA, hipotiroidismo, SOP…"
                        className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
                    </div>
                  </div>
                )}

                {/* ── Paso 3: Análisis completo ── */}
                {nutritionWizard.step === 3 && (() => {
                  const pesoKg   = parseFloat(nutritionWizard.pesoKg)  || 70;
                  const alturaCm = parseFloat(nutritionWizard.alturaCm) || 170;
                  const edad     = parseInt(nutritionWizard.edad, 10)   || 25;
                  const diasEntr = parseInt(nutritionWizard.diasEntrenamiento, 10) || 0;
                  const comidas  = parseInt(nutritionWizard.comidasDia, 10) || 5;

                  const actividad =
                    diasEntr >= 6 ? "muy-alto" :
                    diasEntr >= 4 ? "alto"     :
                    diasEntr >= 2 ? "moderado" :
                    diasEntr === 1 ? "ligero"  : "sedentario";

                  const actividadLabel: Record<string, string> = {
                    sedentario: "Sedentario (sin ejercicio)", ligero: "Ligero (1 día/sem.)",
                    moderado: "Moderado (2–3 días/sem.)", alto: "Alto (4–5 días/sem.)", "muy-alto": "Muy alto (6–7 días/sem.)",
                  };
                  const actFactor: Record<string, number> = {
                    sedentario: 1.20, ligero: 1.375, moderado: 1.55, alto: 1.725, "muy-alto": 1.90,
                  };
                  const goalFactor: Record<string, number> = {
                    mantenimiento: 1.00, recomposicion: 0.97, deficit: 0.82, masa: 1.10,
                  };
                  const goalLabel: Record<string, string> = {
                    mantenimiento: "Mantenimiento (×1.00)", recomposicion: "Recomposición (−3%)",
                    deficit: "Déficit moderado (−18%)", masa: "Superávit (+10%)",
                  };
                  const macroProfiles: Record<string, { protPerKg: number; fatPct: number; rationale: string }> = {
                    mantenimiento: { protPerKg: 1.8, fatPct: 0.30, rationale: "Proteína moderada para preservar músculo. Grasas saludables al 30%." },
                    recomposicion: { protPerKg: 2.4, fatPct: 0.27, rationale: "Alta proteína para retener músculo en déficit. Grasas reducidas para dar espacio a carbs." },
                    deficit:       { protPerKg: 2.2, fatPct: 0.28, rationale: "Proteína elevada anti-catabolismo. Balance de grasas e hidratos para energía sostenida." },
                    masa:          { protPerKg: 2.0, fatPct: 0.25, rationale: "Proteína para síntesis muscular. Más carbs para sostener el volumen de trabajo." },
                  };

                  const baseCalc = 10 * pesoKg + 6.25 * alturaCm - 5 * edad;
                  const bmr      = Math.round(nutritionWizard.sexo === "masculino" ? baseCalc + 5 : baseCalc - 161);
                  const tdee     = Math.round(bmr * actFactor[actividad]);
                  const targets  = calcNutritionTargets({
                    nombre: selectedClient.nombre, sexo: nutritionWizard.sexo, pesoKg, alturaCm, edad,
                    actividad: actividad as "sedentario"|"ligero"|"moderado"|"alto"|"muy-alto",
                    objetivo: nutritionWizard.objetivo, comidasDia: comidas, diasEntrenamiento: diasEntr,
                  });
                  const mp = macroProfiles[nutritionWizard.objetivo];
                  const totalMacroKcal = targets.proteinas * 4 + targets.carbohidratos * 4 + targets.grasas * 9;
                  const pPct = Math.round((targets.proteinas * 4 / totalMacroKcal) * 100);
                  const cPct = Math.round((targets.carbohidratos * 4 / totalMacroKcal) * 100);
                  const gPct = Math.round((targets.grasas * 9 / totalMacroKcal) * 100);

                  const imc = (pesoKg / ((alturaCm/100)**2)).toFixed(1);
                  const pesoIdealMin = Math.round(18.5 * (alturaCm/100)**2);
                  const pesoIdealMax = Math.round(24.9 * (alturaCm/100)**2);

                  const mealNames: Record<number, string[]> = {
                    3: ["Desayuno","Almuerzo","Cena"],
                    4: ["Desayuno","Almuerzo","Merienda","Cena"],
                    5: ["Desayuno","Media mañana","Almuerzo","Merienda","Cena"],
                    6: ["Desayuno","Media mañana","Almuerzo","Merienda","Cena","Colación nocturna"],
                  };
                  const mealDist: Record<number, number[]> = {
                    3: [0.30, 0.42, 0.28],
                    4: [0.25, 0.38, 0.12, 0.25],
                    5: [0.25, 0.10, 0.35, 0.10, 0.20],
                    6: [0.20, 0.10, 0.30, 0.10, 0.20, 0.10],
                  };
                  const names  = mealNames[comidas]  || mealNames[5];
                  const dists  = mealDist[comidas]   || mealDist[5];

                  const alertas: string[] = [];
                  if (nutritionWizard.restricciones)     alertas.push(`⚠ Restricciones declaradas: "${nutritionWizard.restricciones}" — revisá manualmente los alimentos generados.`);
                  if (nutritionWizard.condicionesMedicas) alertas.push(`⚠ Condición médica registrada: "${nutritionWizard.condicionesMedicas}" — consultá con profesional de salud antes de aplicar.`);
                  if (+imc > 29.9) alertas.push("ℹ IMC indica obesidad — el déficit aplicado es conservador. Considerar ajustar calorías con supervisión médica.");
                  if (+imc < 18.5) alertas.push("ℹ IMC indica bajo peso — se aplicará superávit aunque el objetivo sea mantenimiento.");
                  if (diasEntr === 0 && nutritionWizard.objetivo === "masa") alertas.push("ℹ Objetivo masa sin días de entrenamiento — el superávit calórico puede acumularse como grasa. Revisá el plan de entrenamiento.");

                  return (
                    <div className="space-y-4 text-xs">
                      {/* Intro */}
                      <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/8 p-3">
                        <p className="font-semibold text-emerald-200">Análisis completado. Revisá el razonamiento antes de confirmar.</p>
                        <p className="mt-0.5 text-slate-400">El plan se generará exactamente con los valores calculados a continuación. Podés volver y modificar cualquier parámetro.</p>
                      </div>

                      {/* Bloque 1: Datos de entrada */}
                      <div className="rounded-xl border border-white/8 bg-[#0e1012]/60 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">1 — Datos de entrada</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {[
                            ["Cliente",   selectedClient.nombre],
                            ["Peso",      `${pesoKg} kg`],
                            ["Altura",    `${alturaCm} cm`],
                            ["Edad",      `${edad} años`],
                            ["Sexo",      nutritionWizard.sexo === "masculino" ? "Masculino" : "Femenino"],
                            ["IMC",       `${imc} (rango saludable ${pesoIdealMin}–${pesoIdealMax} kg)`],
                          ].map(([k,v]) => (
                            <div key={k} className="flex justify-between gap-2">
                              <span className="text-slate-500">{k}</span>
                              <span className="font-semibold text-slate-200">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bloque 2: Cálculo metabólico */}
                      <div className="rounded-xl border border-white/8 bg-[#0e1012]/60 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">2 — Cálculo metabólico</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Fórmula</span>
                            <span className="text-slate-300">Mifflin-St Jeor</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">TMB (metabolismo basal)</span>
                            <span className="font-semibold text-white">{bmr} kcal/día</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Nivel de actividad</span>
                            <span className="font-semibold text-cyan-200">{actividadLabel[actividad]}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Factor actividad</span>
                            <span className="text-slate-300">×{actFactor[actividad]}</span>
                          </div>
                          <div className="flex justify-between gap-2 border-t border-white/8 pt-1.5">
                            <span className="text-slate-500">TDEE (gasto total)</span>
                            <span className="font-semibold text-white">{tdee} kcal/día</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Ajuste por objetivo</span>
                            <span className="text-amber-200">{goalLabel[nutritionWizard.objetivo]}</span>
                          </div>
                          <div className="flex justify-between gap-2 border-t border-white/8 pt-1.5">
                            <span className="font-semibold text-slate-300">→ Calorías objetivo</span>
                            <span className="text-lg font-black text-emerald-300">{targets.calorias} kcal</span>
                          </div>
                        </div>
                      </div>

                      {/* Bloque 3: Distribución de macros */}
                      <div className="rounded-xl border border-white/8 bg-[#0e1012]/60 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">3 — Distribución de macros</p>
                        <p className="mb-2 text-slate-500">{mp.rationale}</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between gap-2">
                            <span className="text-violet-300">Proteínas</span>
                            <span className="font-semibold text-white">{targets.proteinas} g <span className="text-slate-500">({mp.protPerKg} g/kg × {pesoKg} kg) · {pPct}% kcal</span></span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-amber-300">Grasas</span>
                            <span className="font-semibold text-white">{targets.grasas} g <span className="text-slate-500">({mp.fatPct * 100}% de {targets.calorias} kcal) · {gPct}% kcal</span></span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-emerald-300">Carbohidratos</span>
                            <span className="font-semibold text-white">{targets.carbohidratos} g <span className="text-slate-500">(resto de calorías) · {cPct}% kcal</span></span>
                          </div>
                        </div>
                        <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                          <div className="bg-violet-500" style={{ width: `${pPct}%` }} />
                          <div className="bg-emerald-500" style={{ width: `${cPct}%` }} />
                          <div className="bg-amber-500"  style={{ width: `${gPct}%` }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                          <span>Prot {pPct}%</span><span>Carbs {cPct}%</span><span>Grasas {gPct}%</span>
                        </div>
                      </div>

                      {/* Bloque 4: Estructura del plan */}
                      <div className="rounded-xl border border-white/8 bg-[#0e1012]/60 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">4 — Estructura del plan ({comidas} comidas/día)</p>
                        <div className="space-y-1">
                          {names.map((name, i) => (
                            <div key={name} className="flex items-center justify-between gap-2">
                              <span className="text-slate-300">{name}</span>
                              <span className="text-slate-500">{Math.round(targets.calorias * dists[i])} kcal <span className="text-slate-600">({Math.round(dists[i]*100)}%)</span></span>
                            </div>
                          ))}
                        </div>
                        {nutritionWizard.horarioEntrenamiento && (
                          <p className="mt-2 text-slate-500">Horario registrado: <span className="text-slate-300">{nutritionWizard.horarioEntrenamiento}</span></p>
                        )}
                      </div>

                      {/* Alertas */}
                      {alertas.length > 0 && (
                        <div className="space-y-2">
                          {alertas.map((a, i) => (
                            <div key={i} className="rounded-xl border border-amber-300/25 bg-amber-500/8 px-3 py-2 text-amber-200">{a}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-white/10 px-5 py-4">
                <div className="flex gap-3">
                  {nutritionWizard.step > 1 && (
                    <ReliableActionButton type="button"
                      onClick={() => setNutritionWizard((prev) => prev ? { ...prev, step: (prev.step - 1) as 1|2|3 } : null)}
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10">
                      ← Atrás
                    </ReliableActionButton>
                  )}
                  {nutritionWizard.step < 3 ? (
                    <ReliableActionButton type="button"
                      onClick={() => setNutritionWizard((prev) => prev ? { ...prev, step: (prev.step + 1) as 1|2|3 } : null)}
                      disabled={nutritionWizard.step === 1 && (!nutritionWizard.pesoKg || !nutritionWizard.alturaCm || !nutritionWizard.edad)}
                      className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                      {nutritionWizard.step === 2 ? "Ver análisis →" : "Siguiente →"}
                    </ReliableActionButton>
                  ) : (
                    <ReliableActionButton type="button"
                      onClick={() => applyNutritionPlan(nutritionWizard)}
                      disabled={nutritionAssigning}
                      className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                      {nutritionAssigning ? "Generando…" : "✅ Confirmar y generar plan"}
                    </ReliableActionButton>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Guardar plan como template ─────────────────────────────── */}
      {saveAsTemplateModal && selectedClientTrainingPlan && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setSaveAsTemplateModal(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/12 bg-[#0c0f12] p-6 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-300/70">Templates</p>
            <h2 className="mt-0.5 text-base font-black text-white">Guardar como template</h2>
            <p className="mt-1 text-xs text-slate-400">
              El plan de <strong className="text-slate-200">{selectedClient?.nombre}</strong> se guardará como template reutilizable en la categoría de templates.
            </p>
            <div className="mt-4">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Nombre del template</label>
              <input
                value={saveAsTemplateModal.name}
                onChange={(e) => setSaveAsTemplateModal({ name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && saveAsTemplateModal.name.trim()) saveTrainingPlanAsTemplate(saveAsTemplateModal.name); }}
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-[#131720] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-fuchsia-400/40"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <ReliableActionButton
                type="button"
                onClick={() => setSaveAsTemplateModal(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancelar
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => saveTrainingPlanAsTemplate(saveAsTemplateModal.name)}
                disabled={!saveAsTemplateModal.name.trim()}
                className="flex-1 rounded-xl bg-fuchsia-600 py-2.5 text-sm font-bold text-white hover:bg-fuchsia-500 disabled:opacity-50 transition-colors"
              >
                💾 Guardar template
              </ReliableActionButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
