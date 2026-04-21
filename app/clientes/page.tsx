"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import PlantelPanel from "@/components/PlantelPanel";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAlumnos } from "../../components/AlumnosProvider";
import { useCategories } from "../../components/CategoriesProvider";
import { useDeportes } from "../../components/DeportesProvider";
import { useEjercicios } from "../../components/EjerciciosProvider";
import { usePlayers } from "../../components/PlayersProvider";
import { useSessions } from "../../components/SessionsProvider";
import { markManualSaveIntent, useSharedState } from "../../components/useSharedState";
import { argentineFoodsBase } from "../../data/argentineFoods";
import { EtiquetasChips, Etiqueta } from "../../components/EtiquetasChips";

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
};

type NutritionPlanStatus = {
  hasPlan: boolean;
  planName: string;
  updatedAt: string;
};

type AlumnoNutritionAssignment = {
  alumnoNombre: string;
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

type WeekDayPlanLite = {
  id: string;
  dia: string;
  planificacion: string;
  objetivo: string;
  sesionId: string;
  oculto?: boolean;
  entrenamiento?: WeekDayTrainingLite;
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

type WeekStoreLite = {
  version: number;
  planes: WeekPersonPlanLite[];
};

type WorkoutLogRecord = {
  id: string;
  alumnoNombre: string;
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

                  return {
                    id: String(blockRow.id || `block-${blockIndex}`),
                    titulo: String(blockRow.titulo || `Bloque ${blockIndex + 1}`),
                    objetivo: String(blockRow.objetivo || ""),
                    ejercicios,
                  };
                });

              return {
                id: String(dayRow.id || `day-${dayIndex}`),
                dia: String(dayRow.dia || `Dia ${dayIndex + 1}`),
                planificacion: String(dayRow.planificacion || ""),
                objetivo: String(dayRow.objetivo || ""),
                sesionId: String(dayRow.sesionId || ""),
                oculto: dayRow.oculto === true ? true : undefined,
                entrenamiento: entrenamientoRaw
                  ? {
                      bloques,
                    }
                  : undefined,
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

  return {
    version: Number(source.version) || 3,
    planes,
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

  if (/^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(source)) {
    return source;
  }

  const youtubeMatch = source.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (youtubeMatch?.[1]) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;
  }

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
        comentarios: String(item.comentarios || item.comentario || "").trim() || undefined,
        createdAt: String(item.createdAt || new Date().toISOString()),
      };
    })
    .filter((item) => item.alumnoNombre && item.sessionId)
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

      return {
        id: fallbackBlockId,
        titulo: String(source.titulo || `Bloque ${blockIndex + 1}`),
        objetivo: String(source.objetivo || ""),
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

export default function ClientesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [clientesSection, setClientesSection] = useState<ClientesSection>("clientes");
  const [isDetailMode, setIsDetailMode] = useState(false);
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
  const { alumnos, agregarAlumno, editarAlumno, eliminarAlumno } = useAlumnos();
  const { categorias } = useCategories();
  const { deportes } = useDeportes();
  const { ejercicios } = useEjercicios();
  const { sesiones } = useSessions();

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
  const [nutritionPlans] = useSharedState<NutritionPlan[]>([], {
    key: NUTRITION_PLANS_KEY,
    legacyLocalStorageKey: NUTRITION_PLANS_KEY,
  });
  const [nutritionAssignments] = useSharedState<AlumnoNutritionAssignment[]>([], {
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
    },
    {
      key: WEEK_PLAN_KEY,
      legacyLocalStorageKey: WEEK_PLAN_KEY,
    }
  );
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
  const [trainingExercisePanelMode, setTrainingExercisePanelMode] =
    useState<TrainingExercisePanelMode | null>(null);
  const [trainingExercisePanelTarget, setTrainingExercisePanelTarget] =
    useState<TrainingExercisePanelTarget | null>(null);
  const [trainingRecordDraft, setTrainingRecordDraft] = useState<TrainingRecordDraft>(
    INITIAL_TRAINING_RECORD_DRAFT
  );
  const [trainingRecordStatus, setTrainingRecordStatus] = useState("");
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
  const [trainingBlockGridConfigOpenId, setTrainingBlockGridConfigOpenId] =
    useState<string | null>(null);
  const trainingActionCooldownRef = useRef<Record<string, number>>({});
  const trainingStructureMenuRef = useRef<HTMLDivElement | null>(null);
  const trainingBlockMenuRef = useRef<HTMLDivElement | null>(null);

  const userRole = String((session?.user as any)?.role || '').trim().toUpperCase();
  const isAdmin = userRole === 'ADMIN';

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

  const selectedNutritionAssignment = useMemo(() => {
    if (!selectedClient) return null;
    const clientName = selectedClient.nombre;
    const clientIdName = selectedClient.id.split(":")[1] || "";
    const matches = nutritionAssignments.filter(
      (assignment) =>
        namesLikelyMatch(assignment.alumnoNombre, clientName) ||
        namesLikelyMatch(assignment.alumnoNombre, clientIdName)
    );

    if (matches.length === 0) return null;

    return matches
      .slice()
      .sort(
        (a, b) =>
          new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()
      )[0];
  }, [nutritionAssignments, selectedClient]);

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

      const assignment = nutritionAssignments
        .filter(
          (item) =>
            namesLikelyMatch(item.alumnoNombre, clientName) ||
            namesLikelyMatch(item.alumnoNombre, clientIdName)
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
  }, [clientes, nutritionAssignments, nutritionPlans]);

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

  const selectedTrainingDayBlockSummary = useMemo(
    () => selectedTrainingDayBlocks.reduce((acc, block) => acc + (block.ejercicios || []).length, 0),
    [selectedTrainingDayBlocks]
  );

  const workoutLogs = useMemo(() => normalizeWorkoutLogs(workoutLogsRaw), [workoutLogsRaw]);

  const selectedClientWorkoutLogs = useMemo(() => {
    if (!selectedClient) return [];
    return workoutLogs.filter((item) => namesLikelyMatch(item.alumnoNombre, selectedClient.nombre));
  }, [selectedClient, workoutLogs]);

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
      if (trainingStructureMenuRef.current && target && trainingStructureMenuRef.current.contains(target)) {
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
      if (trainingBlockMenuRef.current && target && trainingBlockMenuRef.current.contains(target)) {
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

  const toggleTrainingWeekMenu = (weekId: string) => {
    setTrainingBlockMenu(null);
    setTrainingStructureMenu((prev) =>
      prev?.type === "week" && prev.weekId === weekId
        ? null
        : {
            type: "week",
            weekId,
          }
    );
  };

  const toggleTrainingDayMenu = (weekId: string, dayId: string) => {
    setTrainingBlockMenu(null);
    setTrainingStructureMenu((prev) =>
      prev?.type === "day" && prev.weekId === weekId && prev.dayId === dayId
        ? null
        : {
            type: "day",
            weekId,
            dayId,
          }
    );
  };

  const toggleTrainingBlockMenu = (weekId: string, dayId: string, blockId: string) => {
    setTrainingStructureMenu(null);
    setTrainingBlockMenu((prev) =>
      prev?.weekId === weekId && prev.dayId === dayId && prev.blockId === blockId
        ? null
        : {
            weekId,
            dayId,
            blockId,
          }
    );
  };

  const focusTrainingBlockTitleInput = (weekId: string, dayId: string, blockId: string) => {
    if (typeof document === "undefined") {
      setTrainingBlockMenu(null);
      return;
    }

    const targetId = `training-block-title-${weekId}-${dayId}-${blockId}`;
    const input = document.getElementById(targetId) as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }

    setTrainingBlockMenu(null);
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

    const series = Math.max(1, Math.round(Number(toSafeNumber(trainingRecordDraft.series) || 1)));
    const repeticiones = Math.max(0, Math.round(Number(toSafeNumber(trainingRecordDraft.repeticiones) || 0)));
    const pesoKg = Math.max(0, Number(toSafeNumber(trainingRecordDraft.pesoKg) || 0));

    const payload: WorkoutLogRecord = {
      id: createTrainingEntityId("log"),
      alumnoNombre: selectedClient.nombre,
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
  };

  const submitCliente = (e: React.FormEvent) => {
    e.preventDefault();
    markManualSaveIntent("pf-control-alumnos");
    markManualSaveIntent("pf-control-jugadoras");
    const nombre = form.nombre.trim();
    if (!nombre) return;

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
      setSelectedClientId(`jugadora:${nombre}`);
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
      setSelectedClientId(`alumno:${nombre}`);
    }

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
    <main className="mx-auto max-w-[1920px] space-y-6 p-6 text-slate-100">
      <section className="rounded-2xl border border-cyan-300/20 bg-slate-900/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-white/15 bg-slate-950/55 p-1">
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
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-900 via-cyan-950/50 to-slate-900 p-6 shadow-[0_20px_80px_rgba(6,182,212,0.12)]">
        <div className="pointer-events-none absolute -left-12 -top-14 h-44 w-44 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/80">
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
                  onClick={() => {
                    setCrearOpen((prev) => !prev);
                    if (!crearOpen) resetForm();
                  }}
                  className="rounded-xl border border-cyan-100/40 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200"
                >
                  Crear cliente
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
          <div className="rounded-2xl border border-emerald-300/35 bg-emerald-500/15 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-100">Activos</p>
            <p className="text-3xl font-black">{resumen.activos}</p>
          </div>
          <div className="rounded-2xl border border-rose-300/35 bg-rose-500/15 p-4">
            <p className="text-xs uppercase tracking-wide text-rose-100">Finalizados</p>
            <p className="text-3xl font-black">{resumen.finalizados}</p>
          </div>
          <div className="rounded-2xl border border-cyan-300/35 bg-cyan-500/15 p-4">
            <p className="text-xs uppercase tracking-wide text-cyan-100">Total</p>
            <p className="text-3xl font-black">{resumen.total}</p>
          </div>
        </div>
      </section>
      ) : null}

      {!isDetailMode && isAdmin ? (
      <section className="mb-6 rounded-3xl border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),rgba(15,23,42,0.94)_50%,rgba(2,6,23,0.96)_100%)] p-5 shadow-[0_20px_60px_rgba(2,10,26,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-100/85">Admin</p>
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
          <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-300">
            No hay ingresantes pendientes de alta en este momento.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {ingresantesPendientes.map((ingresante) => {
              const nombre = resolveIngresanteDisplayName(ingresante);
              return (
                <article key={`ingresante-${ingresante.id}`} className="rounded-2xl border border-cyan-200/20 bg-slate-900/70 p-3">
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
      <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Registrar pago</h2>
        <p className="mt-1 text-sm text-slate-300">
          Al registrar un pago, se renueva automaticamente la asesoria por 30 dias (configurable por cliente).
        </p>

        <form onSubmit={registrarPago} className="mt-4 grid gap-3 md:grid-cols-5">
          <select
            required
            value={pagoForm.clientId}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, clientId: e.target.value }))}
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
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
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />

          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={pagoForm.importe}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, importe: e.target.value }))}
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            placeholder="Importe"
          />

          <select
            value={pagoForm.moneda}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, moneda: e.target.value }))}
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
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
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm"
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

      {!isDetailMode && crearOpen ? (
        <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
          <h2 className="text-xl font-bold">Crear cliente</h2>
          <form onSubmit={submitCliente} className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Nombre"
              />
              <select
                value={form.practicaDeporte}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, practicaDeporte: e.target.value as "si" | "no" }))
                }
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="si">Practica deporte (jugadora)</option>
                <option value="no">No practica deporte (alumno/a)</option>
              </select>
              <select
                value={form.estado}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, estado: e.target.value as ClienteEstado }))
                }
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="activo">Activo</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <input type="date" value={form.fechaNacimiento} onChange={(e) => setForm((prev) => ({ ...prev, fechaNacimiento: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
              <input value={form.altura} onChange={(e) => setForm((prev) => ({ ...prev, altura: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Altura" />
              <input value={form.peso} onChange={(e) => setForm((prev) => ({ ...prev, peso: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Peso" />
              <input value={form.club} onChange={(e) => setForm((prev) => ({ ...prev, club: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Club" />
            </div>

            {form.practicaDeporte === "si" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <select value={form.deporte} onChange={(e) => setForm((prev) => ({ ...prev, deporte: e.target.value, posicion: "" }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                  {deportesOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select value={form.categoria} onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                  <option value="">Categoria</option>
                  {categoriasOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select value={form.posicion} onChange={(e) => setForm((prev) => ({ ...prev, posicion: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                  <option value="">Posicion</option>
                  {posicionesOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <input value={form.objetivo} onChange={(e) => setForm((prev) => ({ ...prev, objetivo: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Objetivo" />
              <input value={form.observaciones} onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Observaciones" />
            </div>

            <div className="flex justify-end gap-2">
              <ReliableActionButton type="button" onClick={() => setCrearOpen(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200">Cancelar</ReliableActionButton>
              <ReliableActionButton type="submit" className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">Guardar cliente</ReliableActionButton>
            </div>
          </form>
        </section>
      ) : null}

      <section
        className="grid gap-5"
        data-layout-lock="clientes-section"
        style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        {!isDetailMode ? (
        <div
          className="w-full rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),rgba(15,23,42,0.88)_38%,rgba(2,6,23,0.96)_100%)] p-5 shadow-[0_24px_60px_rgba(3,7,18,0.55)]"
          data-layout-lock="clientes-list-panel"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-white/15 bg-slate-950/55 p-1">
              <ReliableActionButton type="button" onClick={() => setVista("activo")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === "activo" ? "bg-emerald-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Activos</ReliableActionButton>
              <ReliableActionButton type="button" onClick={() => setVista("finalizado")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === "finalizado" ? "bg-rose-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Finalizados</ReliableActionButton>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, club o categoria" className="w-full max-w-sm rounded-xl border border-cyan-300/30 bg-slate-900/85 px-3 py-2 text-sm shadow-inner shadow-cyan-500/5" />
          </div>

          <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as "todos" | ClienteTipo)} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs">
              <option value="todos">Tipo: Todos</option>
              <option value="jugadora">Tipo: Jugadoras</option>
              <option value="alumno">Tipo: Alumnos</option>
            </select>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs">
              <option value="todas">Categoria: Todas</option>
              {categoriasOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={filtroDeporte} onChange={(e) => setFiltroDeporte(e.target.value)} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs">
              <option value="todos">Deporte: Todos</option>
              {deportesOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input value={filtroClub} onChange={(e) => setFiltroClub(e.target.value)} placeholder="Club" className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs" />
            <select value={filtroPlan} onChange={(e) => setPlanFilter(e.target.value as PlanFilterType)} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs">
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
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2.5">
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

          <div className="space-y-3 rounded-2xl border border-cyan-300/15 bg-slate-950/45 p-3 backdrop-blur-sm">
            {clientesFiltrados.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">No hay clientes en este apartado.</p>
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
                    className={`w-full overflow-hidden rounded-2xl border p-2.5 transition ${active ? "border-cyan-300/45 bg-cyan-500/10" : "border-white/10 bg-slate-900/65 hover:border-cyan-300/30 hover:bg-slate-900/80"}`}
                    data-layout-lock="clientes-row-card"
                  >
                    <div className="flex flex-wrap items-center gap-2.5" data-layout-lock="clientes-row-content">
                      <div className="flex shrink-0 items-center justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-500/15 text-xs font-black text-cyan-100">
                          {cliente.nombre
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase() || "")
                            .join("") || "CL"}
                        </div>
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
                          <span className="inline-flex rounded-full border border-slate-500/50 bg-slate-800/70 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
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
                        <ReliableActionButton type="button" onClick={() => openClientDetail(cliente.id, "datos")} className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10" title="Ver ficha">👁</ReliableActionButton>
                        <ReliableActionButton type="button" onClick={() => openClientDetail(cliente.id, "notas")} className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10" title="Chat y notas">💬</ReliableActionButton>
                        <ReliableActionButton type="button" onClick={() => openWhatsapp(cliente)} disabled={!getMeta(cliente).telefono} className="rounded-lg border border-emerald-300/40 bg-emerald-500/5 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-40" title="WhatsApp">🟢</ReliableActionButton>
                        <Link href={buildPlanViewHref(cliente.id, "plan-entrenamiento")} prefetch className="rounded-lg border border-cyan-300/40 bg-cyan-500/5 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10" title="Abrir plan en pantalla nueva">📌</Link>
                        <ReliableActionButton type="button" onClick={() => toggleEstado(cliente)} className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10" title="Activar/Finalizar">↔</ReliableActionButton>
                        <ReliableActionButton type="button" onClick={() => borrarCliente(cliente)} className="rounded-lg border border-rose-300/30 bg-rose-500/5 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/10" title="Eliminar">🗑</ReliableActionButton>
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
        <div className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg xl:p-6">
          {!selectedClient || !selectedMeta || !datosDraft ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">Selecciona un cliente para abrir su ficha.</div>
          ) : (
            <>
              <div className="mb-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
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
                      className={`pf-cliente-tab-card group relative overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition ${activeTab === tab.id ? "pf-cliente-tab-active border-cyan-300/70 bg-cyan-500/20 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.24)]" : "border-cyan-300/35 bg-slate-900/55 text-white hover:border-cyan-300/60 hover:bg-cyan-500/10"}`}
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

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-2">
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
                      className="rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs"
                    />
                    <input
                      type="color"
                      value={etiquetaCrear.color}
                      onChange={(e) => setEtiquetaCrear((prev) => ({ ...prev, color: e.target.value }))}
                      className="w-8 h-8 border border-white/20"
                    />
                    <ReliableActionButton type="submit" className="rounded bg-cyan-400 px-2 py-1 text-xs font-bold text-slate-950 hover:bg-cyan-300">+</ReliableActionButton>
                  </form>
                  {/* Buscador por etiqueta */}
                  <input
                    value={etiquetaSearch}
                    onChange={(e) => setEtiquetaSearch(e.target.value)}
                    placeholder="Buscar por etiqueta"
                    className="rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-5 xl:p-6">
                {activeTab === "datos" ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100/85">Datos generales</p>
                        <h3 className="mt-1 text-xl font-black text-white">Cliente</h3>
                        <p className="mt-1 text-xs text-slate-200/90">Ficha personal, contacto y perfil deportivo en un solo panel.</p>
                      </div>

                      <div className="rounded-2xl border border-white/12 bg-slate-900/65 p-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">Identidad y contacto</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input value={datosDraft.nombre} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, nombre: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Nombre" />
                          <input value={selectedMeta.apellido} onChange={(e) => setMetaPatch(selectedClient.id, { apellido: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Apellido" />
                          <input value={selectedMeta.segundoApellido} onChange={(e) => setMetaPatch(selectedClient.id, { segundoApellido: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Segundo apellido" />
                          <input value={selectedMeta.email} onChange={(e) => setMetaPatch(selectedClient.id, { email: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Email" />
                          <input type="date" value={datosDraft.fechaNacimiento} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, fechaNacimiento: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
                          <input value={selectedMeta.telefono} onChange={(e) => setMetaPatch(selectedClient.id, { telefono: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Telefono" />
                          <input value={selectedMeta.codigoPais} onChange={(e) => setMetaPatch(selectedClient.id, { codigoPais: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Cod. telefono pais" />
                          <input value={selectedMeta.pais} onChange={(e) => setMetaPatch(selectedClient.id, { pais: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Pais" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/12 bg-slate-900/65 p-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">Ubicacion y perfil fisico</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input value={selectedMeta.provincia} onChange={(e) => setMetaPatch(selectedClient.id, { provincia: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Provincia/Estado" />
                          <input value={selectedMeta.calle} onChange={(e) => setMetaPatch(selectedClient.id, { calle: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Calle" />
                          <input value={selectedMeta.numero} onChange={(e) => setMetaPatch(selectedClient.id, { numero: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Numero" />
                          <input value={selectedMeta.piso} onChange={(e) => setMetaPatch(selectedClient.id, { piso: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Piso" />
                          <input value={selectedMeta.depto} onChange={(e) => setMetaPatch(selectedClient.id, { depto: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Depto" />
                          <select value={selectedMeta.sexo} onChange={(e) => setMetaPatch(selectedClient.id, { sexo: e.target.value as "masculino" | "femenino" })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                            <option value="masculino">Masculino</option>
                            <option value="femenino">Femenino</option>
                          </select>
                          <input value={datosDraft.altura} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, altura: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Altura" />
                          <input value={datosDraft.peso} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, peso: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Peso" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/12 bg-slate-900/65 p-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">Contexto deportivo y objetivos</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input value={datosDraft.club} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, club: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Club" />
                          {selectedClient.tipo === "jugadora" ? (
                            <>
                              <select value={datosDraft.deporte} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, deporte: e.target.value, posicion: "" } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                                {deportesOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                              <select value={datosDraft.categoria} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, categoria: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                                {categoriasOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                              <select value={datosDraft.posicion} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, posicion: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                                <option value="">Sin posicion</option>
                                {(deportes.find((dep) => dep.nombre === datosDraft.deporte)?.posiciones || []).map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                            </>
                          ) : null}
                          <input value={datosDraft.objetivo} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, objetivo: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm md:col-span-2" placeholder="Objetivo" />
                          <textarea value={datosDraft.observaciones} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, observaciones: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm md:col-span-2" rows={2} placeholder="Observaciones" />
                        </div>

                        <div className="mt-4 flex justify-end">
                          <ReliableActionButton type="button" onClick={saveDatosGenerales} className="rounded-xl bg-cyan-400 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300">
                            Guardar cambios
                          </ReliableActionButton>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-white">Informacion de la asesoria</h3>
                      <p className="text-xs text-slate-300">
                        Estas fechas muestran la vigencia real del plan para el cliente: desde cuando inicia y hasta cuando finaliza la asesoria.
                      </p>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Fecha de inicio</p>
                          <input type="date" value={selectedMeta.startDate} onChange={(e) => setMetaPatch(selectedClient.id, { startDate: e.target.value })} className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Fecha de fin</p>
                          <input type="date" value={selectedMeta.endDate} onChange={(e) => setMetaPatch(selectedClient.id, { endDate: e.target.value })} className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Categoria del plan</p>
                          <input value={selectedMeta.categoriaPlan} onChange={(e) => setMetaPatch(selectedClient.id, { categoriaPlan: e.target.value })} className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Categoria" />
                        </div>
                      </div>

                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-cyan-100">Renovacion automatica del plan</p>
                            <p className="text-xs text-slate-300">
                              Si el cliente paga y se registra el pago, se actualiza automaticamente la fecha de fin.
                            </p>
                          </div>
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                            <input
                              type="checkbox"
                              checked={selectedMeta.autoRenewPlan}
                              onChange={(e) => setMetaPatch(selectedClient.id, { autoRenewPlan: e.target.checked })}
                              className="h-4 w-4 accent-cyan-400"
                            />
                            Activa
                          </label>
                        </div>
                        <div className="mt-3 max-w-[230px] space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Plazo de renovacion (dias)</p>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={selectedMeta.renewalDays}
                            onChange={(e) => {
                              const value = Math.max(1, Math.min(365, Number(e.target.value || 30)));
                              setMetaPatch(selectedClient.id, { renewalDays: value });
                            }}
                            className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <textarea value={selectedMeta.colaboradores} onChange={(e) => setMetaPatch(selectedClient.id, { colaboradores: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" rows={2} placeholder="Colaboradores" />
                      <textarea value={selectedMeta.chats} onChange={(e) => setMetaPatch(selectedClient.id, { chats: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" rows={2} placeholder="Chats" />

                      <div className="grid gap-3 md:grid-cols-2">
                        <select value={selectedMeta.tipoAsesoria} onChange={(e) => setMetaPatch(selectedClient.id, { tipoAsesoria: e.target.value as ClienteMeta["tipoAsesoria"] })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                          <option value="entrenamiento">Entrenamiento</option>
                          <option value="nutricion">Nutricion</option>
                          <option value="completa">Completa</option>
                        </select>
                        <select value={selectedMeta.modalidad} onChange={(e) => setMetaPatch(selectedClient.id, { modalidad: e.target.value as ClienteMeta["modalidad"] })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                          <option value="virtual">Virtual</option>
                          <option value="presencial">Presencial</option>
                        </select>
                      </div>

                      <h4 className="pt-2 text-lg font-bold">Detalle de pagos</h4>
                      <div className="grid gap-3 md:grid-cols-3">
                        <select value={selectedMeta.moneda} onChange={(e) => setMetaPatch(selectedClient.id, { moneda: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"><option value="ARS">ARS</option><option value="USD">USD</option></select>
                        <input value={selectedMeta.importe} onChange={(e) => setMetaPatch(selectedClient.id, { importe: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Importe" />
                        <input value={selectedMeta.saldo} onChange={(e) => setMetaPatch(selectedClient.id, { saldo: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Saldo" />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <select value={selectedMeta.pagoEstado} onChange={(e) => setMetaPatch(selectedClient.id, { pagoEstado: e.target.value as ClienteMeta["pagoEstado"] })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                          <option value="confirmado">Pago confirmado</option>
                          <option value="pendiente">Pago pendiente</option>
                        </select>
                        <input value={selectedMeta.emailPagador} onChange={(e) => setMetaPatch(selectedClient.id, { emailPagador: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Email del pagador" />
                      </div>
                    </div>
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
                        <Link
                          href={
                            selectedClient
                              ? `${buildPlanViewHref(selectedClient.id, "plan-entrenamiento")}#asignar-entrenamiento`
                              : "/clientes"
                          }
                          className="rounded-lg border border-cyan-300/35 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
                        >
                          Asignar entrenamiento
                        </Link>
                        <ReliableActionButton
                          type="button"
                          onClick={syncTrainingPlanWithAlumnoProfile}
                          disabled={!selectedClientTrainingPlan}
                          className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                        >
                          Actualizar planilla
                        </ReliableActionButton>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-white/15 bg-slate-900/50 px-3 py-1 text-slate-100">
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
                      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                        <p>No hay un plan semanal vinculado para este cliente todavia.</p>
                        {canEditTrainingPlan ? (
                          <ReliableActionButton
                            type="button"
                            onClick={createTrainingPlanForSelectedClient}
                            className="mt-3 rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
                          >
                            Crear plan editable
                          </ReliableActionButton>
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
                                      className="h-10 min-w-[138px] rounded-2xl border border-cyan-200/70 bg-slate-900/85 px-3.5 py-1.5 text-sm font-bold text-cyan-100 outline-none focus:border-cyan-100"
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
                                          ? "border-slate-600/55 bg-slate-900/90 text-slate-300 hover:border-slate-500/70"
                                          : trainingPreviewWeekId === week.id
                                          ? "border-cyan-100/90 bg-cyan-300/95 text-slate-950 shadow-[0_14px_28px_-18px_rgba(34,211,238,0.95)]"
                                          : "border-slate-500/45 bg-slate-900/70 text-slate-100 hover:border-cyan-300/55 hover:bg-slate-800/80"
                                      }`}
                                    >
                                      <span className="inline-flex items-center gap-1.5">
                                        {isWeekHidden ? <HiddenVisibilityIcon className="h-3.5 w-3.5" /> : null}
                                        <span>{weekLabel}</span>
                                      </span>
                                    </ReliableActionButton>
                                    <ReliableActionButton
                                      type="button"
                                      onClick={() => toggleTrainingWeekMenu(week.id)}
                                      className={`h-7 w-7 rounded-full border p-0 text-sm font-semibold transition ${
                                        weekMenuOpen
                                          ? "border-cyan-300/70 bg-slate-700/95 text-cyan-100"
                                          : "border-white/20 bg-slate-800 text-slate-100 hover:border-cyan-300/55 hover:text-cyan-100"
                                      }`}
                                      aria-label={`Opciones de ${weekLabel}`}
                                    >
                                      ⋯
                                    </ReliableActionButton>

                                    <div
                                      aria-hidden={!weekMenuOpen}
                                      className={`absolute right-0 top-[calc(100%+6px)] z-30 grid min-w-[220px] origin-top gap-1 rounded-xl border border-white/15 bg-slate-900/95 p-2 shadow-2xl transition-all duration-200 ease-out ${
                                        weekMenuOpen
                                          ? "translate-y-0 scale-y-100 opacity-100"
                                          : "pointer-events-none -translate-y-1 scale-y-95 opacity-0"
                                      }`}
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
                                      </div>
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
                                        className="h-10 min-w-[128px] rounded-2xl border border-emerald-200/70 bg-slate-900/85 px-3.5 py-1.5 text-sm font-bold text-emerald-100 outline-none focus:border-emerald-100"
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
                                            ? "border-slate-600/55 bg-slate-900/90 text-slate-300 hover:border-slate-500/70"
                                            : trainingPreviewDayId === day.id
                                            ? "border-emerald-100/90 bg-emerald-300/95 text-slate-950 shadow-[0_14px_28px_-18px_rgba(16,185,129,0.95)]"
                                            : "border-slate-500/45 bg-slate-900/70 text-slate-100 hover:border-emerald-300/55 hover:bg-slate-800/80"
                                        }`}
                                      >
                                        <span className="inline-flex items-center gap-1.5">
                                          {isDayHidden ? <HiddenVisibilityIcon className="h-3.5 w-3.5" /> : null}
                                          <span>{dayLabel}</span>
                                        </span>
                                      </ReliableActionButton>
                                      <ReliableActionButton
                                        type="button"
                                        onClick={() => toggleTrainingDayMenu(selectedTrainingWeek.id, day.id)}
                                        className={`h-7 w-7 rounded-full border p-0 text-sm font-semibold transition ${
                                          dayMenuOpen
                                            ? "border-emerald-300/70 bg-slate-700/95 text-emerald-100"
                                            : "border-white/20 bg-slate-800 text-slate-100 hover:border-emerald-300/55 hover:text-emerald-100"
                                        }`}
                                        aria-label={`Opciones de ${dayLabel}`}
                                      >
                                        ⋯
                                      </ReliableActionButton>

                                      <div
                                        aria-hidden={!dayMenuOpen}
                                        className={`absolute right-0 top-[calc(100%+6px)] z-30 grid min-w-[220px] origin-top gap-1 rounded-xl border border-white/15 bg-slate-900/95 p-2 shadow-2xl transition-all duration-200 ease-out ${
                                          dayMenuOpen
                                            ? "translate-y-0 scale-y-100 opacity-100"
                                            : "pointer-events-none -translate-y-1 scale-y-95 opacity-0"
                                        }`}
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
                                        </div>
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
                                                className="min-w-[220px] flex-1 rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                                                placeholder={`Bloque ${blockIndex + 1}`}
                                              />

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
                                                    onClick={() => {
                                                      setTrainingBlockGridConfigOpenId((current) =>
                                                        current === block.id ? null : current
                                                      );
                                                      toggleTrainingBlockMenu(
                                                        selectedTrainingWeek.id,
                                                        selectedTrainingDay.id,
                                                        block.id
                                                      );
                                                    }}
                                                    className={`h-7 w-7 rounded-full border p-0 text-sm font-semibold transition ${
                                                      blockMenuOpen
                                                        ? "border-cyan-300/70 bg-slate-700/95 text-cyan-100"
                                                        : "border-white/20 bg-slate-800 text-slate-100 hover:border-cyan-300/55 hover:text-cyan-100"
                                                    }`}
                                                    aria-label={`Opciones de ${block.titulo || `Bloque ${blockIndex + 1}`}`}
                                                  >
                                                    ⋯
                                                  </ReliableActionButton>

                                                  <div
                                                    aria-hidden={!blockMenuOpen}
                                                    className={`absolute right-0 top-[calc(100%+6px)] z-30 grid min-w-[220px] origin-top gap-1 rounded-xl border border-white/15 bg-slate-900/95 p-2 shadow-2xl transition-all duration-200 ease-out ${
                                                      blockMenuOpen
                                                        ? "translate-y-0 scale-y-100 opacity-100"
                                                        : "pointer-events-none -translate-y-1 scale-y-95 opacity-0"
                                                    }`}
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
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            <input
                                              value={block.objetivo || ""}
                                              onChange={(event) =>
                                                updateTrainingBlockField(
                                                  selectedTrainingWeek.id,
                                                  selectedTrainingDay.id,
                                                  block.id,
                                                  "objetivo",
                                                  event.target.value
                                                )
                                              }
                                              className="mt-2 w-full rounded-none border border-white/20 bg-slate-700 px-2 py-1.5 text-sm text-white"
                                              placeholder="Objetivo bloque"
                                            />

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
                                                        placeholder={`Campo ${metricIndex + 1}`}
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

                                                return (
                                                  <div
                                                    key={exercise.id}
                                                    className="border-t border-white/12 pt-3"
                                                  >
                                                    <div className="grid gap-2 lg:grid-cols-[76px_minmax(0,1.6fr)_160px_160px_160px_160px]">
                                                      <div className="overflow-hidden rounded-xl border border-white/20 bg-slate-900/70">
                                                        {previewImage ? (
                                                          <img
                                                            src={previewImage}
                                                            alt={exerciseMeta?.nombre || "Ejercicio"}
                                                            className="h-[66px] w-full object-cover"
                                                            loading="lazy"
                                                          />
                                                        ) : (
                                                          <span className="flex h-[66px] w-full items-center justify-center text-xs font-semibold text-slate-200">
                                                            Sin preview
                                                          </span>
                                                        )}
                                                      </div>

                                                      <label className="space-y-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                          <span className="text-xs font-bold text-slate-100">Ejercicio</span>
                                                          <ReliableActionButton
                                                            type="button"
                                                            onClick={() =>
                                                              openTrainingExercisePanel("configuracion", actionTarget)
                                                            }
                                                            className="rounded-full border border-white/20 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                                                          >
                                                            Configuracion
                                                          </ReliableActionButton>
                                                        </div>
                                                        <select
                                                          value={exercise.ejercicioId || ""}
                                                          onChange={(event) =>
                                                            updateTrainingExerciseField(
                                                              selectedTrainingWeek.id,
                                                              selectedTrainingDay.id,
                                                              block.id,
                                                              exercise.id,
                                                              "ejercicioId",
                                                              event.target.value
                                                            )
                                                          }
                                                            className="w-full rounded-md border border-white/15 bg-slate-700 px-2.5 py-1.5 text-sm text-white"
                                                        >
                                                          <option value="">Seleccione ejercicio</option>
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
                                                            placeholder={`Campo ${metricIndex + 1}`}
                                                          />
                                                        </label>
                                                      ))}
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                                                      <span className="text-cyan-200">Desglosar serie</span>
                                                      <span className="text-slate-400">Agregar ejercicio super-serie</span>
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

                                                    <label className="mt-2 block space-y-1">
                                                      <span className="text-xs font-semibold text-slate-300">Observaciones</span>
                                                      <input
                                                        value={exercise.observaciones || ""}
                                                        onChange={(event) =>
                                                          updateTrainingExerciseField(
                                                            selectedTrainingWeek.id,
                                                            selectedTrainingDay.id,
                                                            block.id,
                                                            exercise.id,
                                                            "observaciones",
                                                            event.target.value
                                                          )
                                                        }
                                                        className="w-full rounded-md border border-white/15 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100"
                                                        placeholder="Observaciones del ejercicio"
                                                      />
                                                    </label>

                                                    {panelOpenForExercise ? (
                                                      <div className="mt-3 rounded-xl border border-cyan-300/25 bg-slate-900/65 p-3">
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
                                                                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-950/55 px-2 py-1"
                                                                  >
                                                                    <span>
                                                                      {log.fecha
                                                                        ? new Date(`${log.fecha}T00:00:00`).toLocaleDateString("es-AR")
                                                                        : "Sin fecha"}
                                                                    </span>
                                                                    <span className="font-semibold text-cyan-100">
                                                                      {Number(log.pesoKg || 0).toLocaleString("es-AR")} kg · {log.series} x {log.repeticiones || "-"}
                                                                    </span>
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
                                                                  className="w-full rounded-md border border-white/15 bg-slate-800 px-2 py-1.5 text-xs text-white"
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
                                                                  className="w-full rounded-md border border-white/15 bg-slate-800 px-2 py-1.5 text-xs text-white"
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
                                                                  className="w-full rounded-md border border-white/15 bg-slate-800 px-2 py-1.5 text-xs text-white"
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
                                                                  className="w-full rounded-md border border-white/15 bg-slate-800 px-2 py-1.5 text-xs text-white"
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
                                                                className="w-full rounded-md border border-white/15 bg-slate-800 px-2 py-1.5 text-xs text-white"
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
                          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
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
                  <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
                    <h3 className="text-lg font-black text-white">Plan nutricional</h3>

                    {selectedNutritionPlan ? (
                      <>
                        <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-emerald-100">Plan asignado</p>
                              <p className="text-lg font-black text-white">{selectedNutritionPlan.nombre}</p>
                            </div>
                            <p className="text-xs text-slate-300">
                              Asignado: {new Date(selectedNutritionAssignment?.assignedAt || selectedNutritionPlan.updatedAt).toLocaleDateString("es-AR")}
                            </p>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-4">
                            <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-slate-300">Objetivo</p>
                              <p className="font-bold text-cyan-100">{nutritionGoalLabel(selectedNutritionPlan.objetivo)}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-slate-300">Kcal objetivo</p>
                              <p className="font-bold text-white">{selectedNutritionPlan.targets.calorias}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-slate-300">P/C/G objetivo</p>
                              <p className="font-bold text-white">
                                {selectedNutritionPlan.targets.proteinas} / {selectedNutritionPlan.targets.carbohidratos} / {selectedNutritionPlan.targets.grasas} g
                              </p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-slate-300">P/C/G del plan</p>
                              <p className="font-bold text-emerald-100">
                                {selectedNutritionIntake.proteinas} / {selectedNutritionIntake.carbohidratos} / {selectedNutritionIntake.grasas} g
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {selectedNutritionPlan.comidas.length === 0 ? (
                            <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                              El plan no tiene comidas cargadas todavia.
                            </p>
                          ) : (
                            selectedNutritionPlan.comidas.map((meal) => (
                              <article key={meal.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                                <p className="font-semibold text-white">{meal.nombre}</p>
                                {meal.items.length === 0 ? (
                                  <p className="mt-1 text-xs text-slate-400">Sin alimentos cargados.</p>
                                ) : (
                                  <div className="mt-2 space-y-1 text-sm">
                                    {meal.items.map((item) => {
                                      const food = nutritionFoodsById.get(item.foodId);
                                      return (
                                        <p key={item.id} className="text-slate-200">
                                          • {food?.nombre || "Alimento no encontrado"} - {item.gramos} g
                                        </p>
                                      );
                                    })}
                                  </div>
                                )}
                              </article>
                            ))
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                        <p className="font-semibold">Este cliente aun no tiene un plan nutricional asignado.</p>
                        <p className="mt-1 text-amber-50/90">
                          Puedes asignarlo desde el modulo de nutricion para verlo aqui.
                        </p>
                        <Link
                          href="/categorias/Nutricion"
                          className="mt-3 inline-flex rounded-lg border border-amber-200/40 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/10"
                        >
                          Ir a Nutricion
                        </Link>
                      </div>
                    )}
                  </div>
                ) : activeTab === "progreso" ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-300">Wellness</p>
                      <p className="text-3xl font-black text-cyan-100">{selectedClient.wellness ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-300">Carga</p>
                      <p className="text-3xl font-black text-emerald-100">{selectedClient.carga ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
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
                        <div className="rounded-xl border border-white/15 bg-slate-950/45 p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Cliente</p>
                          <p className="truncate text-sm font-bold text-white">{selectedClient.nombre}</p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-slate-950/45 p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Vigencia plan</p>
                          <p className="truncate text-sm font-bold text-white">
                            {selectedMeta.startDate || "Sin inicio"} - {selectedMeta.endDate || "Sin fin"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-slate-950/45 p-2.5">
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
                      className="w-full rounded-2xl border border-white/20 bg-slate-900/80 px-4 py-3 text-sm leading-relaxed shadow-inner shadow-cyan-500/5"
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
    </main>
  );
}
