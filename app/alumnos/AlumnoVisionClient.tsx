"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useAlumnos } from "@/components/AlumnosProvider";
import { useEjercicios } from "@/components/EjerciciosProvider";
import { useSessions } from "@/components/SessionsProvider";
import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";
import { signOut } from "next-auth/react";
import type {
  Alumno,
  BloqueEntrenamiento,
  PrescripcionSesionPersona,
  Sesion,
} from "@/data/mockData";
import { argentineFoodsBase } from "@/data/argentineFoods";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";

type MainCategory = "inicio" | "rutina" | "nutricion" | "progreso" | "musica" | "cuenta";

// Profile image helpers — kept inline so the cuenta tab can resize/optimize uploads
// without depending on the configuracion page module.
const PROFILE_IMG_MAX_DATA_URL_LENGTH = 850_000;
const PROFILE_IMG_MAX_DIMENSION = 720;
const PROFILE_IMG_MIN_DIMENSION = 220;

function readFileAsDataUrlForProfile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("No se pudo leer la imagen seleccionada"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrlForProfile(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la imagen seleccionada"));
    image.src = dataUrl;
  });
}

async function optimizeProfileImageForCuenta(file: File): Promise<string> {
  const originalDataUrl = await readFileAsDataUrlForProfile(file);
  if (originalDataUrl.length <= PROFILE_IMG_MAX_DATA_URL_LENGTH) {
    return originalDataUrl;
  }
  const image = await loadImageFromDataUrlForProfile(originalDataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo preparar la imagen para guardar");
  }
  let width = image.naturalWidth;
  let height = image.naturalHeight;
  const maxSide = Math.max(width, height);
  if (maxSide > PROFILE_IMG_MAX_DIMENSION) {
    const ratio = PROFILE_IMG_MAX_DIMENSION / maxSide;
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }
  let quality = 0.88;
  let attempts = 0;
  while (attempts < 12) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const optimized = canvas.toDataURL("image/jpeg", quality);
    if (optimized.length <= PROFILE_IMG_MAX_DATA_URL_LENGTH) {
      return optimized;
    }
    if (quality > 0.46) {
      quality = Math.max(0.42, Number((quality - 0.08).toFixed(2)));
    } else {
      const nextWidth = Math.max(PROFILE_IMG_MIN_DIMENSION, Math.round(width * 0.85));
      const nextHeight = Math.max(PROFILE_IMG_MIN_DIMENSION, Math.round(height * 0.85));
      if (nextWidth === width && nextHeight === height) break;
      width = nextWidth;
      height = nextHeight;
      quality = 0.78;
    }
    attempts += 1;
  }
  throw new Error("La imagen es demasiado pesada. Probá con una más liviana");
}

type AlumnoVisionClientProps = {
  currentName: string;
  currentEmail: string;
  initialCategory?: MainCategory;
};

type AlumnoRecord = Alumno & {
  email?: string;
  telefono?: string;
  edad?: number;
  altura?: number | null;
};

type ClienteMetaLite = {
  nombre?: string;
  email?: string;
  telefono?: string;
  alturaCm?: number | null;
  objNutricional?: string;
  startDate?: string;
  endDate?: string;
  pagoEstado?: string;
  tipoAsesoria?: string;
  modalidad?: string;
  categoriaPlan?: string;
  planNombre?: string;
  diasPlan?: number;
  membresia?: string;
};

type NutritionTargets = {
  calorias?: number;
  proteinas?: number;
  carbohidratos?: number;
  grasas?: number;
};

type NutritionMealItem = {
  id?: string;
  nombre?: string;
  foodId?: string;
  gramos?: number;
  imageUrl?: string;
  imagenUrl?: string;
  photoUrl?: string;
  fotoUrl?: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  artworkUrl?: string;
};

type NutritionMeal = {
  id?: string;
  nombre?: string;
  items?: NutritionMealItem[];
  imageUrl?: string;
  imagenUrl?: string;
  photoUrl?: string;
  fotoUrl?: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  artworkUrl?: string;
};

type NutritionPlanDayLite = {
  id?: string;
  nombre?: string;
  comidas?: NutritionMeal[];
};

type NutritionPlanWeekLite = {
  id?: string;
  nombre?: string;
  dias?: NutritionPlanDayLite[];
};

type NutritionPlanLite = {
  id: string;
  nombre?: string;
  alumnoAsignado?: string | null;
  objetivo?: string;
  notas?: string;
  targets?: NutritionTargets;
  comidas?: NutritionMeal[];
  semanas?: NutritionPlanWeekLite[];
  updatedAt?: string;
};

type NutritionAssignmentLite = {
  alumnoNombre?: string;
  alumnoEmail?: string;
  planId?: string;
  assignedAt?: string;
};

type NutritionFoodLite = {
  id?: string;
  nombre?: string;
  kcalPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  imageUrl?: string;
  imagenUrl?: string;
  photoUrl?: string;
  fotoUrl?: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  artworkUrl?: string;
};

type NutritionFoodFavoriteLite = {
  id: string;
  nombre: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  imageUrl?: string;
  barcode?: string;
  updatedAt?: string;
};

type NutritionSearchFoodResult = {
  id: string;
  nombre: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  imageUrl?: string;
  barcode?: string;
  sourceLabel?: string;
};

type NutritionDailyMealLogLite = {
  mealId: string;
  done?: boolean;
  consumedKcal?: number;
  updatedAt?: string;
};

type NutritionDailyCustomFoodLite = {
  id: string;
  nombre: string;
  foodId?: string;
  mealId?: string;
  gramos?: number;
  porcion?: string;
  calorias: number;
  proteinas?: number;
  carbohidratos?: number;
  grasas?: number;
  barcode?: string;
  source?: "manual" | "search" | "barcode" | "camera";
  imageUrl?: string;
  createdAt?: string;
};

type NutritionDailyLogLite = {
  id: string;
  ownerKey?: string;
  alumnoNombre?: string;
  alumnoEmail?: string;
  date: string;
  mealLogs: NutritionDailyMealLogLite[];
  customFoods?: NutritionDailyCustomFoodLite[];
  createdAt?: string;
  updatedAt?: string;
};

type NutritionVariationRequestLite = {
  id: string;
  alumnoNombre?: string;
  alumnoEmail?: string;
  planId?: string;
  mealId?: string;
  mealName?: string;
  message?: string;
  createdAt?: string;
};

type NutritionReplacementSuggestionLite = {
  key: string;
  mealId: string;
  mealName: string;
  sourceItemId: string;
  sourceItemLabel: string;
  sourceCalories: number;
  sourceProtein: number;
  sourceCarbs: number;
  sourceFat: number;
  replacementFoodId: string;
  replacementLabel: string;
  replacementCalories: number;
  replacementProtein: number;
  replacementCarbs: number;
  replacementFat: number;
  replacementGrams: number;
  generatedAt: string;
};

type NutritionCaptureMode = "none" | "barcode" | "cal-ia";

type NutritionBarcodeDetection = {
  rawValue?: string;
};

type NutritionBarcodeDetectorLike = {
  detect: (source: ImageBitmap) => Promise<NutritionBarcodeDetection[]>;
};

type NutritionBarcodeDetectorCtorLike = new (options?: {
  formats?: string[];
}) => NutritionBarcodeDetectorLike;

type WorkoutLogLite = {
  id?: string;
  alumnoNombre?: string;
  alumnoEmail?: string;
  sessionId?: string;
  sessionTitle?: string;
  weekId?: string;
  weekName?: string;
  dayId?: string;
  dayName?: string;
  blockId?: string;
  blockTitle?: string;
  exerciseId?: string;
  exerciseKey?: string;
  exerciseName?: string;
  fecha?: string;
  createdAt?: string;
  series?: number;
  repeticiones?: number;
  pesoKg?: number;
  molestia?: boolean;
  comentarios?: string;
  comentario?: string;
  dolorUbicacion?: string;
  dolorMomento?: string;
  dolorSensacion?: string;
  dolorRecomendacion?: string;
  videoUrl?: string;
  videoDataUrl?: string;
  videoFileName?: string;
  videoMimeType?: string;
};

type RoutineChangeRequestLite = {
  id: string;
  alumnoNombre?: string;
  alumnoEmail?: string;
  sessionId?: string;
  sessionTitle?: string;
  weekId?: string;
  weekName?: string;
  dayId?: string;
  dayName?: string;
  message?: string;
  createdAt?: string;
};

type SessionFeedbackAnswerLite = {
  questionId: string;
  questionPrompt: string;
  optionId: string;
  optionLabel: string;
};

type SessionFeedbackRecordLite = {
  id: string;
  alumnoNombre?: string;
  alumnoEmail?: string;
  sessionId?: string;
  sessionTitle?: string;
  weekId?: string;
  weekName?: string;
  dayId?: string;
  dayName?: string;
  feedbackTitle?: string;
  answers: SessionFeedbackAnswerLite[];
  measurements?: Record<string, string>;
  totalWorkoutLogs?: number;
  logsWithPain?: number;
  createdAt?: string;
};

type AnthropometryEntryLite = {
  id?: string;
  alumnoNombre?: string;
  createdAt?: string;
  alturaCm?: number | null;
  pesoKg?: number | null;
  aguaLitros?: number | null;
  suenoHoras?: number | null;
  actividadNivel?: number | null;
  cinturaCm?: number | null;
  caderaCm?: number | null;
  grasaPct?: number | null;
  musculoPct?: number | null;
};

type MusicAssignmentLite = {
  id?: string;
  platform?: string;
  alumnoNombre?: string;
  playlistName?: string;
  playlistUrl?: string;
  objetivo?: string;
  diaSemana?: string;
  recommendedSongTitle?: string;
  recommendedSongArtist?: string;
  coverUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  artworkUrl?: string;
  createdAt?: string;
};

type MusicPlatform =
  | "SPOTIFY"
  | "YOUTUBE"
  | "YOUTUBE_MUSIC"
  | "SOUNDCLOUD"
  | "APPLE_MUSIC"
  | "DEEZER"
  | "AMAZON_MUSIC"
  | "AUDIO_FILE"
  | "OTHER";

type MusicContentType = "SONG" | "PLAYLIST" | "OTHER";

type MusicPlayerSource = {
  kind: "iframe" | "audio" | "none";
  src: string | null;
};

type AccountProfileLite = {
  nombreCompleto?: string;
  sidebarImage?: string | null;
};

type CoachContactLite = {
  id?: string;
  nombre?: string;
  role?: string;
  telefono?: string;
  source?: string;
};

type HomeMusicCard = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  accentClass: string;
  playlistUrl: string | null;
  platform: MusicPlatform;
  contentType: MusicContentType;
};

type RoutineExercise = BloqueEntrenamiento["ejercicios"][number];

type RoutineBlock = Omit<BloqueEntrenamiento, "ejercicios"> & {
  ejercicios: RoutineExercise[];
};

type RoutineEntry = {
  sesion: Sesion;
  prescripcion: PrescripcionSesionPersona | null;
  blocks: RoutineBlock[];
  totalExercises: number;
  weekId?: string;
  weekName?: string;
  dayId?: string;
  dayName?: string;
  source: "session" | "week-plan";
};

type WeekPlanPersonType = "jugadoras" | "alumnos";

type WeekExerciseLite = {
  id?: string;
  ejercicioId?: string;
  series?: string | number;
  repeticiones?: string | number;
  descanso?: string;
  carga?: string;
  observaciones?: string;
  metricas?: Array<{
    nombre?: string;
    valor?: string;
  }>;
  superSerie?: Array<{
    id?: string;
    ejercicioId?: string;
    series?: string | number;
    repeticiones?: string | number;
    descanso?: string;
    carga?: string;
  }>;
};

type WeekBlockLite = {
  id: string;
  titulo: string;
  objetivo: string;
  ejercicios: WeekExerciseLite[];
};

type WeekDayTrainingLite = {
  titulo?: string;
  descripcion?: string;
  duracion?: string;
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
  tipo: "scale" | "select" | "text" | "number";
  min?: number;
  max?: number;
  opciones?: string[];
}> = [
  { id: "rpe", nombre: "RPE percibido", tipo: "scale", min: 1, max: 10 },
  { id: "fatiga", nombre: "Fatiga percibida", tipo: "scale", min: 1, max: 10 },
  { id: "sensacion", nombre: "Sensación general", tipo: "select", opciones: ["Motivado", "Satisfecho", "Cansado", "Frustrado", "Dolorido", "Otro"] },
  { id: "congestion", nombre: "Congestión muscular", tipo: "scale", min: 0, max: 10 },
  { id: "rendimiento", nombre: "Rendimiento percibido", tipo: "select", opciones: ["Mejor que siempre", "Normal", "Por debajo"] },
  { id: "cumplimiento", nombre: "Cumplimiento del objetivo", tipo: "select", opciones: ["Cumplido", "Parcial", "No cumplido"] },
  { id: "observaciones", nombre: "Observaciones", tipo: "text" },
  { id: "duracion", nombre: "Duración (min)", tipo: "number", min: 1, max: 300 },
];

const DEFAULT_VISIBLE_MEASUREMENTS: PostSessionMeasurementId[] = ["rpe", "fatiga", "sensacion", "observaciones"];

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
  tipo: WeekPlanPersonType;
  nombre: string;
  categoria?: string;
  semanas: WeekPlanLite[];
};

type RoutineExerciseLogTarget = {
  sessionId: string;
  sessionTitle: string;
  weekId?: string;
  weekName?: string;
  dayId?: string;
  dayName?: string;
  blockId: string;
  blockTitle: string;
  exerciseId: string;
  exerciseName: string;
  exerciseKey: string;
  prescribedSeries?: string;
  prescribedRepeticiones?: string;
  prescribedCarga?: string;
  prescribedDescanso?: string;
  prescribedRir?: string;
  suggestedVideoUrl?: string;
  exerciseDescription?: string;
  exerciseTags?: string[];
};

type RoutineExerciseLogView = "descripcion" | "registro" | "registros";

type RoutineActionScreen = "none" | "change" | "sessions" | "finalize" | "timer";

type RoutineExerciseLogDraft = {
  fecha: string;
  series: string;
  repeticiones: string;
  pesoKg: string;
  comentarios: string;
  molestia: boolean;
  dolorUbicacion: string;
  dolorMomento: string;
  dolorSensacion: string;
  videoUrl: string;
  videoDataUrl: string;
  videoFileName: string;
  videoMimeType: string;
};

type RoutineStopwatchFloatPosition = {
  x: number;
  y: number;
};

type IdentityRef = {
  names: string[];
  emails: string[];
};

type PreparedIdentityName = {
  value: string;
  tokenSet: Set<string>;
};

type PreparedIdentity = {
  names: PreparedIdentityName[];
  emails: Set<string>;
};

const CATEGORIES: MainCategory[] = ["inicio", "rutina", "nutricion", "progreso", "musica"];

function normalizeMainCategoryValue(value: string): MainCategory | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (CATEGORIES.includes(normalized as MainCategory)) {
    return normalized as MainCategory;
  }

  return null;
}

function resolveMainCategoryFromPath(pathname: string | null | undefined): MainCategory | null {
  const normalizedPath = String(pathname || "").split("?")[0].trim().toLowerCase();
  const match = normalizedPath.match(/^\/alumnos\/([^/?#]+)/i);
  if (!match) {
    return null;
  }

  return normalizeMainCategoryValue(match[1] || "");
}

function resolveInitialMainCategory(initialCategory: MainCategory): MainCategory {
  if (typeof window === "undefined") {
    return initialCategory;
  }

  return resolveMainCategoryFromPath(window.location.pathname) || initialCategory;
}

const CATEGORY_COPY: Record<
  MainCategory,
  {
    badge: string;
    title: string;
    subtitle: string;
    short: string;
  }
> = {
  inicio: {
    badge: "HOME",
    title: "Panel central",
    subtitle: "Resumen de hoy y atajos rapidos.",
    short: "Inicio",
  },
  rutina: {
    badge: "TRAIN",
    title: "Plan de entrenamiento",
    subtitle: "Bloques, ejercicios y foco de cada sesion asignada.",
    short: "Rutina",
  },
  nutricion: {
    badge: "NUTR",
    title: "Plan nutricional",
    subtitle: "Objetivo, macros y distribucion de comidas.",
    short: "Nutri",
  },
  progreso: {
    badge: "TRACK",
    title: "Evolucion",
    subtitle: "Registros de entreno y cambios antropometricos.",
    short: "Progreso",
  },
  musica: {
    badge: "FLOW",
    title: "Playlists",
    subtitle: "Musica asignada para entrenar con enfoque.",
    short: "Musica",
  },
  cuenta: {
    badge: "USER",
    title: "Mi cuenta",
    subtitle: "Datos personales, credenciales y cierre de sesion.",
    short: "Cuenta",
  },
};

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const MUSIC_PLAYLISTS_KEY = "pf-control-music-playlists-v1";
const NUTRITION_PLANS_KEY = "pf-control-nutricion-planes-v1";
const NUTRITION_ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
const NUTRITION_CUSTOM_FOODS_KEY = "pf-control-nutricion-alimentos-v1";
const NUTRITION_FAVORITES_KEY = "pf-control-nutricion-favoritos-v1";
const NUTRITION_DAILY_LOGS_KEY = "pf-control-nutricion-diario-v1";
const NUTRITION_VARIATION_REQUESTS_KEY = "pf-control-nutricion-variaciones-v1";
const WEEK_PLAN_KEY = "pf-control-semana-plan";
const WORKOUT_LOGS_KEY = "pf-control-alumno-workout-logs-v1";
const TRAINING_COMPLETIONS_KEY = "pf-control-alumno-entrenamiento-completados-v1";
const ROUTINE_CHANGE_REQUESTS_KEY = "pf-control-routine-change-requests-v1";
const SESSION_FEEDBACK_RECORDS_KEY = "pf-control-session-feedback-v1";
const ANTHROPOMETRY_KEY = "pf-control-alumno-antropometria-v1";
const ULTRA_MOBILE_INITIAL_BLOCKS = 1;
const ULTRA_MOBILE_ROUTINE_FALLBACK_SESSIONS = 2;
const ULTRA_MOBILE_STORAGE_REFRESH_MS = 6000;
const ROUTINE_DAY_WEEK_MIN_LOADING_MS = 2000;
const ROUTINE_ACTION_SCREEN_MIN_LOADING_MS = 2000;
const ROUTINE_PULL_THRESHOLD = 74;
const ROUTINE_PULL_MAX_DISTANCE = 120;
const ROUTINE_STOPWATCH_FLOAT_SIZE_DESKTOP = 126;
const ROUTINE_STOPWATCH_FLOAT_SIZE_MOBILE = 108;
const MAX_WORKOUT_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024;
const DIRECT_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"];
const WEEKDAY_SHORT_LABELS = ["DO", "LU", "MA", "MI", "JU", "VI", "SA"];
const DEFAULT_NUTRITION_MEAL_DISTRIBUTION = [
  { mealId: "meal-desayuno", mealName: "Desayuno", icon: "☕", goalRatio: 0.3 },
  { mealId: "meal-almuerzo", mealName: "Almuerzo", icon: "🍽️", goalRatio: 0.35 },
  { mealId: "meal-cena", mealName: "Cena", icon: "🥗", goalRatio: 0.25 },
  { mealId: "meal-snacks", mealName: "Snacks", icon: "🍎", goalRatio: 0.1 },
] as const;
const NUTRITION_KCAL_SEMI_GAUGE_ARC_LENGTH = 264;
const NUTRITION_CAL_IA_MEAL_HINTS: Record<string, string[]> = {
  desayuno: ["avena", "yogur", "fruta", "banana", "huevo", "tostada", "granola", "leche"],
  almuerzo: ["pollo", "carne", "arroz", "pasta", "papa", "ensalada", "sandwich", "lenteja"],
  cena: ["pescado", "pollo", "ensalada", "sopa", "huevo", "verdura", "arroz", "omelette"],
  snacks: ["barra", "fruta", "yogur", "galleta", "frutos", "licuado", "mani", "almendra"],
};

const HOME_MUSIC_FALLBACK: HomeMusicCard[] = [
  {
    id: "fallback-1",
    title: "Nena Sad",
    artist: "ORO600, Pablo C...",
    coverUrl: null,
    accentClass: "pf-a3-music-card-fallback-a",
    playlistUrl: null,
    platform: "OTHER",
    contentType: "SONG",
  },
  {
    id: "fallback-2",
    title: "Llueve",
    artist: "Wisin & Yandel",
    coverUrl: null,
    accentClass: "pf-a3-music-card-fallback-b",
    playlistUrl: null,
    platform: "OTHER",
    contentType: "SONG",
  },
  {
    id: "fallback-3",
    title: "Diabolica",
    artist: "Cris MJ, Dei V",
    coverUrl: null,
    accentClass: "pf-a3-music-card-fallback-c",
    playlistUrl: null,
    platform: "OTHER",
    contentType: "SONG",
  },
];

const LOCAL_SYNC_CACHE_PREFIX = "pf-control-sync-cache-v1:";
const STORAGE_ARRAY_CACHE = new Map<string, { raw: string | null; parsed: unknown[] }>();

function normalizePersonKey(value: string): string {
  return String(value || "")
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

  return shared.length >= 2 || shared.some((token) => token.length >= 5);
}

function parseDateValue(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: string | Date | null | undefined): string {
  const parsed = parseDateValue(value);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string | Date | null | undefined): string {
  const parsed = parseDateValue(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStopwatchDuration(totalMs: number): string {
  const safeMs = Math.max(0, Math.floor(Number(totalMs) || 0));
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTag(value: string | Date | null | undefined): string {
  const parsed = parseDateValue(value);
  if (!parsed) return "-";
  const base = parsed
    .toLocaleDateString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    })
    .replace(",", "")
    .replace(/\.$/, "")
    .trim();

  if (!base) return "-";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function getInitials(value: string): string {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return "PF";

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0] || ""}${tokens[1][0] || ""}`.toUpperCase();
}

function normalizeMusicUrl(rawUrl: string): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function looksLikeAudioFile(rawUrl: string): boolean {
  const normalized = String(rawUrl || "").toLowerCase();
  return DIRECT_AUDIO_EXTENSIONS.some((extension) => normalized.includes(extension));
}

function inferMusicPlatformFromUrl(rawUrl: string): MusicPlatform {
  const normalized = normalizeMusicUrl(rawUrl);
  if (!normalized) return "OTHER";

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return looksLikeAudioFile(normalized) ? "AUDIO_FILE" : "OTHER";
  }

  const host = parsed.hostname.toLowerCase();
  if (host.includes("open.spotify.com")) return "SPOTIFY";
  if (host.includes("music.youtube.com")) return "YOUTUBE_MUSIC";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "YOUTUBE";
  if (host.includes("soundcloud.com") || host.includes("snd.sc")) return "SOUNDCLOUD";
  if (host.includes("music.apple.com")) return "APPLE_MUSIC";
  if (host.includes("deezer.com")) return "DEEZER";
  if (host.includes("music.amazon.")) return "AMAZON_MUSIC";
  if (looksLikeAudioFile(normalized)) return "AUDIO_FILE";

  return "OTHER";
}

function resolveMusicPlatform(rawPlatform: string | null | undefined, rawUrl: string | null | undefined): MusicPlatform {
  const candidate = String(rawPlatform || "").trim().toUpperCase();
  const knownPlatforms: MusicPlatform[] = [
    "SPOTIFY",
    "YOUTUBE",
    "YOUTUBE_MUSIC",
    "SOUNDCLOUD",
    "APPLE_MUSIC",
    "DEEZER",
    "AMAZON_MUSIC",
    "AUDIO_FILE",
    "OTHER",
  ];

  if (knownPlatforms.includes(candidate as MusicPlatform)) {
    return candidate as MusicPlatform;
  }

  return inferMusicPlatformFromUrl(rawUrl || "");
}

function resolveMusicMetadataLookupUrl(platform: MusicPlatform, rawUrl: string): string {
  const normalized = normalizeMusicUrl(rawUrl);
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);

    if (platform === "SPOTIFY") {
      const match = parsed.pathname.match(/\/(?:embed\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/i);
      if (match?.[1] && match?.[2]) {
        const kind = String(match[1]).toLowerCase();
        const id = String(match[2]).trim();
        if (kind && id) {
          return `https://open.spotify.com/${kind}/${id}`;
        }
      }
    }

    if (platform === "YOUTUBE" || platform === "YOUTUBE_MUSIC") {
      const embedMatch = parsed.pathname.match(/\/embed\/([^/?#]+)/i);
      if (embedMatch?.[1]) {
        return `https://www.youtube.com/watch?v=${embedMatch[1]}`;
      }

      const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?#]+)/i);
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
      }

      if (parsed.hostname.toLowerCase().includes("youtu.be")) {
        const shortId = parsed.pathname.replace(/^\//, "").split("/")[0];
        if (shortId) {
          return `https://www.youtube.com/watch?v=${shortId}`;
        }
      }
    }

    return normalized;
  } catch {
    return normalized;
  }
}

function inferMusicContentTypeFromUrl(platform: MusicPlatform, rawUrl: string): MusicContentType {
  const normalized = normalizeMusicUrl(rawUrl);
  if (!normalized) return "OTHER";

  if (platform === "AUDIO_FILE") return "SONG";

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.toLowerCase();

    if (platform === "SPOTIFY") {
      if (/\/(track|episode)\//i.test(pathname)) return "SONG";
      if (/\/(playlist|album|artist|show)\//i.test(pathname)) return "PLAYLIST";
      return "OTHER";
    }

    if (platform === "YOUTUBE" || platform === "YOUTUBE_MUSIC") {
      if (parsed.searchParams.get("list")) return "PLAYLIST";
      if (parsed.searchParams.get("v")) return "SONG";
      if (/\/(embed|shorts)\//i.test(pathname)) return "SONG";
      if (parsed.hostname.toLowerCase().includes("youtu.be")) return "SONG";
      return "OTHER";
    }

    if (platform === "SOUNDCLOUD") {
      if (pathname.includes("/sets/")) return "PLAYLIST";
      return "SONG";
    }

    if (platform === "APPLE_MUSIC") {
      if (parsed.searchParams.get("i")) return "SONG";
      if (/\/(song)\//i.test(pathname)) return "SONG";
      if (/\/(playlist|album)\//i.test(pathname)) return "PLAYLIST";
      return "OTHER";
    }

    if (platform === "DEEZER") {
      if (/\/(track)\//i.test(pathname)) return "SONG";
      if (/\/(playlist|album)\//i.test(pathname)) return "PLAYLIST";
      return "OTHER";
    }

    return "OTHER";
  } catch {
    return "OTHER";
  }
}

function resolveMusicContentType(
  platform: MusicPlatform,
  rawUrl: string,
  suggestedSongTitle?: string | null,
  metadataContentType?: string | null
): MusicContentType {
  const metadataType = String(metadataContentType || "").trim().toUpperCase();
  if (metadataType === "SONG" || metadataType === "PLAYLIST" || metadataType === "OTHER") {
    return metadataType as MusicContentType;
  }

  if (String(suggestedSongTitle || "").trim()) {
    return "SONG";
  }

  return inferMusicContentTypeFromUrl(platform, rawUrl);
}

function resolveMusicContentTypeLabel(contentType: MusicContentType): string {
  if (contentType === "SONG") return "Cancion";
  if (contentType === "PLAYLIST") return "Playlist";
  return "Audio";
}

function looksLikeGenericMusicName(value: string): boolean {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return true;

  if (/^https?:\/\//.test(clean)) return true;

  return [
    "open.spotify.com",
    "youtube.com",
    "youtu.be",
    "soundcloud.com",
    "music.apple.com",
    "deezer.com",
    "music.amazon.",
  ].some((needle) => clean.includes(needle));
}

function resolveMusicFallbackTitle(platform: MusicPlatform, contentType: MusicContentType): string {
  const platformName = resolveMusicPlatformLabel(platform);
  if (contentType === "SONG") return `Cancion en ${platformName}`;
  if (contentType === "PLAYLIST") return `Playlist en ${platformName}`;
  return platformName;
}

function resolveSpotifyEmbed(rawUrl: string): string | null {
  try {
    const parsed = new URL(normalizeMusicUrl(rawUrl));
    const match = parsed.pathname.match(/\/(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/i);
    if (!match) return null;
    const kind = String(match[1] || "").toLowerCase();
    const id = String(match[2] || "").trim();
    if (!kind || !id) return null;
    return `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator`;
  } catch {
    return null;
  }
}

function resolveYouTubeEmbed(rawUrl: string): string | null {
  try {
    const parsed = new URL(normalizeMusicUrl(rawUrl));
    const host = parsed.hostname.toLowerCase();
    const listId = parsed.searchParams.get("list") || "";
    const videoParam = parsed.searchParams.get("v") || "";

    if (listId) {
      return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(listId)}`;
    }

    if (host.includes("youtu.be")) {
      const shortId = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (shortId) return `https://www.youtube.com/embed/${shortId}`;
    }

    if (videoParam) {
      return `https://www.youtube.com/embed/${videoParam}`;
    }

    const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?#]+)/i);
    if (shortsMatch?.[1]) {
      return `https://www.youtube.com/embed/${shortsMatch[1]}`;
    }

    const embedMatch = parsed.pathname.match(/\/embed\/([^/?#]+)/i);
    if (embedMatch?.[1]) {
      return `https://www.youtube.com/embed/${embedMatch[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

function resolveSoundCloudEmbed(rawUrl: string): string | null {
  const normalized = normalizeMusicUrl(rawUrl);
  if (!normalized) return null;
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(normalized)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false`;
}

function resolveAppleMusicEmbed(rawUrl: string): string | null {
  try {
    const parsed = new URL(normalizeMusicUrl(rawUrl));
    if (!parsed.hostname.toLowerCase().includes("music.apple.com")) return null;
    return `https://embed.music.apple.com${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function resolveDeezerEmbed(rawUrl: string): string | null {
  try {
    const parsed = new URL(normalizeMusicUrl(rawUrl));
    const segments = parsed.pathname.split("/").filter(Boolean);
    const foundTypeIndex = segments.findIndex((segment) =>
      ["track", "album", "playlist"].includes(segment.toLowerCase())
    );

    if (foundTypeIndex === -1) return null;
    const type = segments[foundTypeIndex]?.toLowerCase();
    const id = segments[foundTypeIndex + 1] || "";
    if (!type || !id) return null;

    return `https://widget.deezer.com/widget/dark/${type}/${id}`;
  } catch {
    return null;
  }
}

function resolveMusicPlayerSource(platform: MusicPlatform, rawUrl: string): MusicPlayerSource {
  const normalized = normalizeMusicUrl(rawUrl);
  if (!normalized) return { kind: "none", src: null };

  switch (platform) {
    case "SPOTIFY": {
      const src = resolveSpotifyEmbed(normalized);
      return src ? { kind: "iframe", src } : { kind: "none", src: null };
    }
    case "YOUTUBE":
    case "YOUTUBE_MUSIC": {
      const src = resolveYouTubeEmbed(normalized);
      return src ? { kind: "iframe", src } : { kind: "none", src: null };
    }
    case "SOUNDCLOUD": {
      const src = resolveSoundCloudEmbed(normalized);
      return src ? { kind: "iframe", src } : { kind: "none", src: null };
    }
    case "APPLE_MUSIC": {
      const src = resolveAppleMusicEmbed(normalized);
      return src ? { kind: "iframe", src } : { kind: "none", src: null };
    }
    case "DEEZER": {
      const src = resolveDeezerEmbed(normalized);
      return src ? { kind: "iframe", src } : { kind: "none", src: null };
    }
    case "AUDIO_FILE":
      return { kind: "audio", src: normalized };
    case "OTHER": {
      if (looksLikeAudioFile(normalized)) {
        return { kind: "audio", src: normalized };
      }
      return { kind: "none", src: null };
    }
    case "AMAZON_MUSIC":
      return { kind: "none", src: null };
    default:
      return { kind: "none", src: null };
  }
}

function resolveMusicPlatformLabel(platform: MusicPlatform): string {
  const labels: Record<MusicPlatform, string> = {
    SPOTIFY: "Spotify",
    YOUTUBE: "YouTube",
    YOUTUBE_MUSIC: "YouTube Music",
    SOUNDCLOUD: "SoundCloud",
    APPLE_MUSIC: "Apple Music",
    DEEZER: "Deezer",
    AMAZON_MUSIC: "Amazon Music",
    AUDIO_FILE: "Audio",
    OTHER: "Playlist",
  };

  return labels[platform] || "Playlist";
}

function resolveMusicOpenActionLabel(platform: MusicPlatform): string {
  if (platform === "SPOTIFY") return "Abrir en Spotify";
  return "Abrir playlist";
}

function resolveMusicAssignmentId(assignment: MusicAssignmentLite, index: number): string {
  return String(assignment.id || assignment.playlistUrl || `music-${index}`);
}

function resolveTrainingAnimalWord(displayName: string): "toro" | "tora" {
  const firstToken = String(displayName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0]
    ?.toLowerCase();

  if (!firstToken) return "toro";
  return firstToken.endsWith("a") ? "tora" : "toro";
}

function resolveRandomMusicCoachLine(displayName: string): string {
  const animalWord = resolveTrainingAnimalWord(displayName);
  const templates = [
    `Tu profe te asigno esta playlist para que entrenes como un ${animalWord}.`,
    `Hoy la consigna es clara: esta playlist te lleva a entrenar como un ${animalWord}.`,
    `Activa el modo bestia: tu profe eligio esta playlist para que rindas como un ${animalWord}.`,
    `Subi la intensidad: esta playlist esta pensada para entrenar como un ${animalWord}.`,
  ];

  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex] || templates[0];
}

async function fetchMusicMetadata(
  platform: MusicPlatform,
  rawUrl: string
): Promise<{ thumbnailUrl?: string; playlistName?: string; contentType?: MusicContentType } | null> {
  const normalized = normalizeMusicUrl(rawUrl);
  if (!normalized) return null;

  const lookupUrl = resolveMusicMetadataLookupUrl(platform, normalized) || normalized;

  try {
    const response = await fetch(`/api/musica/metadata?url=${encodeURIComponent(lookupUrl)}`, {
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      ok?: boolean;
      thumbnailUrl?: string | null;
      playlistName?: string | null;
      contentType?: string | null;
    };

    if (!payload?.ok) return null;

    const thumbnailUrl = String(payload.thumbnailUrl || "").trim() || undefined;
    const playlistName = String(payload.playlistName || "").trim() || undefined;
    const contentTypeRaw = String(payload.contentType || "").trim().toUpperCase();
    const contentType =
      contentTypeRaw === "SONG" || contentTypeRaw === "PLAYLIST" || contentTypeRaw === "OTHER"
        ? (contentTypeRaw as MusicContentType)
        : undefined;

    if (!thumbnailUrl && !playlistName && !contentType) return null;
    return { thumbnailUrl, playlistName, contentType };
  } catch {
    return null;
  }
}

function toTitleCaseWord(value: string): string {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1).toLowerCase()}`;
}

function sanitizeProfileDisplayName(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const localPart = raw.includes("@") ? raw.split("@")[0] || "" : raw;
  const normalized = localPart.trim();
  if (!normalized) return "";

  if (!/\s/.test(normalized) && /[._-]/.test(normalized)) {
    const tokens = normalized
      .split(/[._-]+/)
      .map((token) => toTitleCaseWord(token))
      .filter(Boolean);

    if (tokens.length > 0) return tokens.join(" ");
  }

  return normalized
    .split(/\s+/)
    .map((token) => toTitleCaseWord(token))
    .filter(Boolean)
    .join(" ");
}

function resolveBmiTone(bmi: number): { label: string; tone: "ok" | "warning" | "danger" } {
  if (bmi < 18.5) {
    return { label: "Bajo", tone: "warning" };
  }

  if (bmi < 25) {
    return { label: "Saludable", tone: "ok" };
  }

  if (bmi < 30) {
    return { label: "Alto", tone: "warning" };
  }

  return { label: "Muy alto", tone: "danger" };
}

function formatWeightValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

function formatMetricValue(value: number | null, unit: string, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(decimals)} ${unit}`;
}

function resolveGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Buenos dias";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (visited.has(key)) return;
    visited.add(key);
    result.push(normalized);
  });

  return result;
}

function toSafeNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateInputValue(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = parseDateValue(raw);
  if (!parsed) {
    return getTodayDateInputValue();
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateInputValue(value: string, deltaDays: number): string {
  const safeDate = normalizeDateInputValue(value);
  const base = new Date(`${safeDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return getTodayDateInputValue();
  }

  base.setDate(base.getDate() + deltaDays);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roundToOneDecimal(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

function formatCompactNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const safeDecimals = Math.max(0, Math.min(3, Math.floor(decimals)));
  const factor = Math.pow(10, safeDecimals);
  const rounded = Math.round(value * factor) / factor;

  if (Math.abs(rounded - Math.round(rounded)) < 0.0001) {
    return String(Math.round(rounded));
  }

  return rounded.toFixed(safeDecimals);
}

function normalizeMediaUrl(rawUrl: string | null | undefined): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\//i.test(value)) return value;
  return `https://${value}`;
}

function resolveNutritionImageUrls(values: Array<string | null | undefined>): string[] {
  return uniqueStrings(values)
    .map((value) => normalizeMediaUrl(value))
    .filter(Boolean);
}

function resolveNutritionImageUrl(values: Array<string | null | undefined>): string | null {
  const resolved = resolveNutritionImageUrls(values)[0] || "";

  return resolved || null;
}

function normalizeNutritionFoodRows(rawRows: unknown[]): NutritionFoodLite[] {
  return rawRows
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const candidate = row as Record<string, unknown>;
      return {
        id: String(candidate.id || "").trim(),
        nombre: String(candidate.nombre || "").trim(),
        kcalPer100g: toSafeNumeric(candidate.kcalPer100g) || 0,
        proteinPer100g: toSafeNumeric(candidate.proteinPer100g) || 0,
        carbsPer100g: toSafeNumeric(candidate.carbsPer100g) || 0,
        fatPer100g: toSafeNumeric(candidate.fatPer100g) || 0,
        imageUrl: String(candidate.imageUrl || "").trim(),
        imagenUrl: String(candidate.imagenUrl || "").trim(),
        photoUrl: String(candidate.photoUrl || "").trim(),
        fotoUrl: String(candidate.fotoUrl || "").trim(),
        thumbnailUrl: String(candidate.thumbnailUrl || "").trim(),
        coverUrl: String(candidate.coverUrl || "").trim(),
        artworkUrl: String(candidate.artworkUrl || "").trim(),
      };
    })
    .filter((row) => Boolean(row.id));
}

function normalizeNutritionAssignmentRows(rawRows: unknown[]): NutritionAssignmentLite[] {
  return rawRows
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const candidate = row as Record<string, unknown>;

      return {
        alumnoNombre: String(candidate.alumnoNombre || candidate.alumno || "").trim() || undefined,
        alumnoEmail:
          String(candidate.alumnoEmail || candidate.email || "")
            .trim()
            .toLowerCase() || undefined,
        planId: String(candidate.planId || "").trim() || undefined,
        assignedAt: String(candidate.assignedAt || "").trim() || undefined,
      };
    })
    .filter((row) => Boolean(row.alumnoNombre || row.alumnoEmail) && Boolean(row.planId));
}

function normalizeNutritionVariationRequestRows(rawValue: unknown): NutritionVariationRequestLite[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row, index) => {
      const item = row as Record<string, unknown>;

      return {
        id: String(item.id || `nutrition-variation-${index + 1}`).trim() || `nutrition-variation-${index + 1}`,
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim() || undefined,
        alumnoEmail:
          String(item.alumnoEmail || item.email || "")
            .trim()
            .toLowerCase() || undefined,
        planId: String(item.planId || "").trim() || undefined,
        mealId: String(item.mealId || "").trim() || undefined,
        mealName: String(item.mealName || item.comida || "").trim() || undefined,
        message: String(item.message || item.mensaje || "").trim() || undefined,
        createdAt: String(item.createdAt || "").trim() || new Date().toISOString(),
      };
    })
    .filter((item) => Boolean(item.message))
    .sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt));
}

function normalizeNutritionFavoriteRows(rawRows: unknown[]): NutritionFoodFavoriteLite[] {
  return rawRows
    .filter((row) => row && typeof row === "object")
    .map((row, index) => {
      const candidate = row as Record<string, unknown>;
      const id = String(candidate.id || "").trim() || `fav-food-${index + 1}`;

      return {
        id,
        nombre: String(candidate.nombre || "").trim() || "Alimento favorito",
        kcalPer100g: Math.max(0, roundToOneDecimal(toSafeNumeric(candidate.kcalPer100g) || 0)),
        proteinPer100g: Math.max(0, roundToOneDecimal(toSafeNumeric(candidate.proteinPer100g) || 0)),
        carbsPer100g: Math.max(0, roundToOneDecimal(toSafeNumeric(candidate.carbsPer100g) || 0)),
        fatPer100g: Math.max(0, roundToOneDecimal(toSafeNumeric(candidate.fatPer100g) || 0)),
        imageUrl: String(candidate.imageUrl || "").trim() || undefined,
        barcode: String(candidate.barcode || "").trim() || undefined,
        updatedAt: String(candidate.updatedAt || "").trim() || undefined,
      };
    })
    .filter((row) => Boolean(row.id) && Boolean(row.nombre));
}

function normalizeNutritionDailyLogs(rawRows: unknown[]): NutritionDailyLogLite[] {
  return rawRows
    .filter((row) => row && typeof row === "object")
    .map((row, index) => {
      const candidate = row as Record<string, unknown>;
      const date = normalizeDateInputValue(String(candidate.date || ""));
      const mealLogsRaw = Array.isArray(candidate.mealLogs) ? candidate.mealLogs : [];
      const mealLogs = mealLogsRaw
        .filter((meal) => meal && typeof meal === "object")
        .map((meal) => {
          const mealCandidate = meal as Record<string, unknown>;
          const mealId = String(mealCandidate.mealId || "").trim();

          return {
            mealId,
            done: Boolean(mealCandidate.done),
            consumedKcal: Math.max(0, roundToOneDecimal(toSafeNumeric(mealCandidate.consumedKcal) || 0)),
            updatedAt: String(mealCandidate.updatedAt || "").trim() || undefined,
          };
        })
        .filter((meal) => Boolean(meal.mealId));

      const customFoodsRaw = Array.isArray(candidate.customFoods) ? candidate.customFoods : [];
      const customFoods = customFoodsRaw
        .filter((entry) => entry && typeof entry === "object")
        .map((entry, entryIndex) => {
          const foodCandidate = entry as Record<string, unknown>;
          const id =
            String(foodCandidate.id || "").trim() ||
            `food-${date}-${index}-${entryIndex}`;
          const nombre = String(foodCandidate.nombre || "").trim() || "Alimento";
          const sourceRaw = String(foodCandidate.source || "").trim();
          const source: NutritionDailyCustomFoodLite["source"] =
            sourceRaw === "search" || sourceRaw === "barcode" || sourceRaw === "camera"
              ? sourceRaw
              : "manual";

          return {
            id,
            nombre,
            foodId: String(foodCandidate.foodId || "").trim() || undefined,
            mealId: String(foodCandidate.mealId || "").trim() || undefined,
            gramos: Math.max(0, roundToOneDecimal(toSafeNumeric(foodCandidate.gramos) || 0)) || undefined,
            porcion: String(foodCandidate.porcion || "").trim() || undefined,
            calorias: Math.max(0, roundToOneDecimal(toSafeNumeric(foodCandidate.calorias) || 0)),
            proteinas: Math.max(0, roundToOneDecimal(toSafeNumeric(foodCandidate.proteinas) || 0)),
            carbohidratos: Math.max(0, roundToOneDecimal(toSafeNumeric(foodCandidate.carbohidratos) || 0)),
            grasas: Math.max(0, roundToOneDecimal(toSafeNumeric(foodCandidate.grasas) || 0)),
            barcode: String(foodCandidate.barcode || "").trim() || undefined,
            source,
            imageUrl: String(foodCandidate.imageUrl || "").trim() || undefined,
            createdAt: String(foodCandidate.createdAt || "").trim() || undefined,
          };
        })
        .filter((entry) => Boolean(entry.id) && Boolean(entry.nombre));

      return {
        id: String(candidate.id || `nutri-log-${date}-${index}`).trim() || `nutri-log-${date}-${index}`,
        ownerKey: String(candidate.ownerKey || "").trim() || undefined,
        alumnoNombre: String(candidate.alumnoNombre || "").trim() || undefined,
        alumnoEmail: String(candidate.alumnoEmail || "").trim() || undefined,
        date,
        mealLogs,
        customFoods,
        createdAt: String(candidate.createdAt || "").trim() || undefined,
        updatedAt: String(candidate.updatedAt || "").trim() || undefined,
      };
    });
}

function createRoutineExerciseLogDraft(seed?: Partial<RoutineExerciseLogDraft>): RoutineExerciseLogDraft {
  return {
    fecha: seed?.fecha || getTodayDateInputValue(),
    series: seed?.series || "",
    repeticiones: seed?.repeticiones || "",
    pesoKg: seed?.pesoKg || "",
    comentarios: seed?.comentarios || "",
    molestia: Boolean(seed?.molestia),
    dolorUbicacion: seed?.dolorUbicacion || "",
    dolorMomento: seed?.dolorMomento || "",
    dolorSensacion: seed?.dolorSensacion || "",
    videoUrl: seed?.videoUrl || "",
    videoDataUrl: seed?.videoDataUrl || "",
    videoFileName: seed?.videoFileName || "",
    videoMimeType: seed?.videoMimeType || "",
  };
}

function resolveRoutinePainTrainingRecommendation(input: {
  dolorUbicacion?: string;
  dolorMomento?: string;
  dolorSensacion?: string;
}): string {
  const ubicacion = normalizePersonKey(input.dolorUbicacion || "");
  const momento = normalizePersonKey(input.dolorMomento || "");
  const sensacion = normalizePersonKey(input.dolorSensacion || "");

  const hasSharpPain =
    sensacion.includes("punz") ||
    sensacion.includes("agud") ||
    sensacion.includes("pinch") ||
    sensacion.includes("corriente") ||
    sensacion.includes("latigazo");
  const hasIrradiation =
    sensacion.includes("hormigue") ||
    sensacion.includes("adormec") ||
    sensacion.includes("entumec") ||
    sensacion.includes("irrad");
  const hasInflammation =
    sensacion.includes("inflam") ||
    sensacion.includes("hinch") ||
    sensacion.includes("calor") ||
    sensacion.includes("ardor");

  const appearsAtRest =
    momento.includes("reposo") ||
    momento.includes("todo el tiempo") ||
    momento.includes("siempre") ||
    momento.includes("noche");
  const appearsDuringSet =
    momento.includes("durante") || momento.includes("serie") || momento.includes("carga");
  const appearsOnWarmup = momento.includes("calent") || momento.includes("inicio");

  const lumbarZone = ubicacion.includes("lumbar") || ubicacion.includes("espalda");
  const kneeOrAnkle =
    ubicacion.includes("rodilla") || ubicacion.includes("tobillo") || ubicacion.includes("pie");
  const shoulderOrElbow =
    ubicacion.includes("hombro") || ubicacion.includes("codo") || ubicacion.includes("muneca");

  const composeRecommendation = (plan: string) => {
    const safetyRule = "Entrena solo en zona tolerable (dolor 0-3/10) y sin compensaciones tecnicas.";
    const coachRule =
      "Consulta al profesor para cambiar por otro ejercicio si la molestia persiste, aumenta o limita la tecnica.";
    return `${plan} ${safetyRule} ${coachRule}`;
  };

  if (hasIrradiation || appearsAtRest) {
    return composeRecommendation(
      "Baja hoy a intensidad suave (RPE 4-5), evita impacto y detene el ejercicio que dispara el dolor. Si no mejora en 24-48 h, no cargues."
    );
  }

  if (hasSharpPain || hasInflammation) {
    return composeRecommendation(
      "Mantene solo trabajo tecnico y controlado: reduce carga 30-40%, recorta rango en el tramo doloroso y descansa mas entre series. Si el dolor sube durante la sesion, corta ese ejercicio."
    );
  }

  if (lumbarZone) {
    return composeRecommendation(
      "Prioriza estabilidad de tronco: baja carga, tempo lento (3-1-2), respiracion y braceo activo. Evita esfuerzos explosivos hasta entrenar sin dolor."
    );
  }

  if (kneeOrAnkle) {
    return composeRecommendation(
      "Trabaja con rango tolerable y eje controlado: baja carga, evita rebotes y usa pausas cortas en la parte media del movimiento para mantener tecnica limpia."
    );
  }

  if (shoulderOrElbow) {
    return composeRecommendation(
      "Usa agarre comodo y recorrido sin pinzamiento: reduce carga, controla descenso y evita bloqueos fuertes al final del movimiento."
    );
  }

  if (appearsDuringSet) {
    return composeRecommendation(
      "Segui entrenando con carga moderada (10-20% menos), tempo controlado y sin llegar al fallo. La regla es dolor estable o menor durante toda la serie."
    );
  }

  if (appearsOnWarmup) {
    return composeRecommendation(
      "Extende la entrada en calor 8-10 min y agrega una serie de aproximacion extra con baja carga antes de las series efectivas."
    );
  }

  return composeRecommendation(
    "Mantene tecnica estricta, baja un punto de esfuerzo (RPE), monitorea en cada serie y usa una variante sin molestia cuando sea necesario."
  );
}

function buildRoutineExerciseKey(
  sessionId: string,
  weekId: string | undefined,
  dayId: string | undefined,
  blockId: string,
  exerciseId: string,
  exerciseIndex: number
) {
  return [
    sessionId || "no-session",
    weekId || "no-week",
    dayId || "no-day",
    blockId || "no-block",
    exerciseId || "no-exercise",
    String(exerciseIndex),
  ].join("::");
}

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
              `feedback-option-${questionIndex + 1}-${optionIndex + 1}`,
            label: String(optionRow.label || optionRow.opcion || "").trim(),
          };
        })
        .filter((option) => Boolean(option.label));

      const normalizedOptions =
        options.length >= 2
          ? options
          : [
              { id: `feedback-option-${questionIndex + 1}-1`, label: "Excelente" },
              { id: `feedback-option-${questionIndex + 1}-2`, label: "Necesito ayuda" },
            ];

      return {
        id: String(questionRow.id || "").trim() || `feedback-question-${questionIndex + 1}`,
        prompt:
          String(questionRow.prompt || questionRow.pregunta || "").trim() ||
          `Pregunta ${questionIndex + 1}`,
        options: normalizedOptions,
      };
    })
    .filter((question) => question.options.length >= 2);

  const title = String(row.title || "").trim() || undefined;
  const enabled = row.enabled === true;
  const maxPerDay = typeof row.maxPerDay === "number" ? row.maxPerDay : undefined;

  const rawMeasurements = Array.isArray(row.measurements) ? row.measurements : [];
  const validMeasurementIds = new Set(POST_SESSION_MEASUREMENT_CATALOG.map((m) => m.id));
  const measurements: PostSessionMeasurementLite[] = rawMeasurements
    .filter((m) => m && typeof m === "object")
    .map((m) => {
      const mr = m as Record<string, unknown>;
      const id = String(mr.id || "").trim() as PostSessionMeasurementId;
      if (!validMeasurementIds.has(id)) return null;
      return { id, visible: mr.visible !== false, obligatoria: mr.obligatoria === true };
    })
    .filter((m): m is PostSessionMeasurementLite => m !== null);

  if (!enabled && questions.length === 0 && !title && measurements.length === 0) {
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

function normalizeRoutineChangeRequestRows(rawValue: unknown): RoutineChangeRequestLite[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row, index) => {
      const item = row as Record<string, unknown>;

      return {
        id: String(item.id || `change-request-${index + 1}`).trim(),
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim() || undefined,
        alumnoEmail:
          String(item.alumnoEmail || item.email || "")
            .trim()
            .toLowerCase() || undefined,
        sessionId: String(item.sessionId || "").trim() || undefined,
        sessionTitle: String(item.sessionTitle || item.sesion || "").trim() || undefined,
        weekId: String(item.weekId || "").trim() || undefined,
        weekName: String(item.weekName || item.semana || "").trim() || undefined,
        dayId: String(item.dayId || "").trim() || undefined,
        dayName: String(item.dayName || item.dia || "").trim() || undefined,
        message: String(item.message || item.mensaje || "").trim() || undefined,
        createdAt: String(item.createdAt || "").trim() || new Date().toISOString(),
      };
    })
    .filter((item) => Boolean(item.message))
    .sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt));
}

function buildSessionFeedbackIdentityKey(value: {
  alumnoNombre?: string;
  alumnoEmail?: string;
  sessionId?: string;
  weekId?: string;
  dayId?: string;
}): string {
  const personaKey = String(value.alumnoEmail || value.alumnoNombre || "")
    .trim()
    .toLowerCase();

  return [
    personaKey,
    String(value.sessionId || "").trim(),
    String(value.weekId || "").trim(),
    String(value.dayId || "").trim(),
  ].join("::");
}

function normalizeSessionFeedbackRows(rawValue: unknown): SessionFeedbackRecordLite[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row, index) => {
      const item = row as Record<string, unknown>;
      const rawAnswers = Array.isArray(item.answers) ? item.answers : [];

      const answers: SessionFeedbackAnswerLite[] = rawAnswers
        .filter((answer) => answer && typeof answer === "object")
        .map((answer, answerIndex) => {
          const answerRow = answer as Record<string, unknown>;

          return {
            questionId:
              String(answerRow.questionId || "").trim() ||
              `feedback-question-${answerIndex + 1}`,
            questionPrompt:
              String(answerRow.questionPrompt || answerRow.prompt || "").trim() ||
              `Pregunta ${answerIndex + 1}`,
            optionId:
              String(answerRow.optionId || "").trim() ||
              `feedback-option-${answerIndex + 1}`,
            optionLabel: String(answerRow.optionLabel || answerRow.respuesta || "").trim(),
          };
        })
        .filter((answer) => Boolean(answer.optionLabel));

      return {
        id: String(item.id || `session-feedback-${index + 1}`).trim(),
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim() || undefined,
        alumnoEmail:
          String(item.alumnoEmail || item.email || "")
            .trim()
            .toLowerCase() || undefined,
        sessionId: String(item.sessionId || "").trim() || undefined,
        sessionTitle: String(item.sessionTitle || item.sesion || "").trim() || undefined,
        weekId: String(item.weekId || "").trim() || undefined,
        weekName: String(item.weekName || item.semana || "").trim() || undefined,
        dayId: String(item.dayId || "").trim() || undefined,
        dayName: String(item.dayName || item.dia || "").trim() || undefined,
        feedbackTitle: String(item.feedbackTitle || "").trim() || undefined,
        answers,
        measurements:
          item.measurements && typeof item.measurements === "object" && !Array.isArray(item.measurements)
            ? (item.measurements as Record<string, string>)
            : undefined,
        totalWorkoutLogs: Math.max(0, Math.round(Number(toSafeNumeric(item.totalWorkoutLogs) || 0))),
        logsWithPain: Math.max(0, Math.round(Number(toSafeNumeric(item.logsWithPain) || 0))),
        createdAt: String(item.createdAt || "").trim() || new Date().toISOString(),
      };
    })
    .filter((item) => Boolean(item.sessionId || item.dayId || item.answers.length > 0 || (item.measurements && Object.keys(item.measurements).length > 0)))
    .sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt));
}

function normalizeWorkoutLogsLiteRows(rawValue: unknown): WorkoutLogLite[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row, index) => {
      const item = row as Record<string, unknown>;
      const safeSeries = Math.max(1, Math.round(Number(toSafeNumeric(item.series) || 1)));
      const safeRepeticiones = Math.max(0, Math.round(Number(toSafeNumeric(item.repeticiones) || 0)));
      const safePeso = Math.max(0, Number(toSafeNumeric(item.pesoKg ?? item.peso) || 0));

      return {
        id: String(item.id || `workout-${index + 1}`),
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
        createdAt: String(item.createdAt || new Date().toISOString()),
        series: safeSeries,
        repeticiones: safeRepeticiones,
        pesoKg: safePeso,
        molestia: Boolean(item.molestia),
        comentarios: String(item.comentarios || item.comentario || "").trim() || undefined,
        dolorUbicacion: String(item.dolorUbicacion || "").trim() || undefined,
        dolorMomento: String(item.dolorMomento || "").trim() || undefined,
        dolorSensacion: String(item.dolorSensacion || "").trim() || undefined,
        dolorRecomendacion: String(item.dolorRecomendacion || "").trim() || undefined,
        videoUrl: String(item.videoUrl || "").trim() || undefined,
        videoDataUrl: String(item.videoDataUrl || "").trim() || undefined,
        videoFileName: String(item.videoFileName || "").trim() || undefined,
        videoMimeType: String(item.videoMimeType || "").trim() || undefined,
      };
    })
    .filter((item) => Boolean(item.alumnoNombre || item.alumnoEmail))
    .sort((left, right) => {
      const leftTs = getTimestamp(left.createdAt || left.fecha);
      const rightTs = getTimestamp(right.createdAt || right.fecha);
      return rightTs - leftTs;
    });
}

function normalizeWeekStorePlans(rawValue: unknown): WeekPersonPlanLite[] {
  if (!rawValue || typeof rawValue !== "object") {
    return [];
  }

  const root = rawValue as { planes?: unknown };
  if (!Array.isArray(root.planes)) {
    return [];
  }

  return root.planes
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, planIndex) => {
      const plan = entry as Record<string, unknown>;
      const tipoRaw = String(plan.tipo || "").trim().toLowerCase();
      const tipo: WeekPlanPersonType = tipoRaw === "jugadoras" ? "jugadoras" : "alumnos";
      const rawWeeks = Array.isArray(plan.semanas) ? plan.semanas : [];

      const semanas: WeekPlanLite[] = rawWeeks
        .filter((week) => week && typeof week === "object")
        .map((week, weekIndex) => {
          const weekItem = week as Record<string, unknown>;
          const rawDays = Array.isArray(weekItem.dias) ? weekItem.dias : [];

          const dias: WeekDayPlanLite[] = rawDays
            .filter((day) => day && typeof day === "object")
            .map((day, dayIndex) => {
              const dayItem = day as Record<string, unknown>;
              const rawTraining =
                dayItem.entrenamiento && typeof dayItem.entrenamiento === "object"
                  ? (dayItem.entrenamiento as Record<string, unknown>)
                  : null;
              const postSesionFeedback = normalizePostSessionFeedbackConfig(dayItem.postSesionFeedback);
              const rawBlocks = rawTraining && Array.isArray(rawTraining.bloques) ? rawTraining.bloques : [];

              const bloques: WeekBlockLite[] = rawBlocks
                .filter((block) => block && typeof block === "object")
                .map((block, blockIndex) => {
                  const blockItem = block as Record<string, unknown>;
                  const rawExercises = Array.isArray(blockItem.ejercicios)
                    ? blockItem.ejercicios
                    : [];

                  const ejercicios: WeekExerciseLite[] = rawExercises
                    .filter((exercise) => exercise && typeof exercise === "object")
                    .map((exercise) => {
                      const exerciseItem = exercise as Record<string, unknown>;
                      const rawMetrics = Array.isArray(exerciseItem.metricas)
                        ? exerciseItem.metricas
                        : [];
                      const rawSuperSerie = Array.isArray(exerciseItem.superSerie)
                        ? exerciseItem.superSerie
                        : [];

                      return {
                        id: String(exerciseItem.id || "").trim() || undefined,
                        ejercicioId: String(exerciseItem.ejercicioId || "").trim() || undefined,
                        series: exerciseItem.series as string | number | undefined,
                        repeticiones: exerciseItem.repeticiones as string | number | undefined,
                        descanso: String(exerciseItem.descanso || "").trim() || undefined,
                        carga: String(exerciseItem.carga || "").trim() || undefined,
                        observaciones: String(exerciseItem.observaciones || "").trim() || undefined,
                        metricas: rawMetrics
                          .filter((metric) => metric && typeof metric === "object")
                          .map((metric) => {
                            const metricItem = metric as Record<string, unknown>;
                            return {
                              nombre: String(metricItem.nombre || "").trim() || undefined,
                              valor: String(metricItem.valor || "").trim() || undefined,
                            };
                          }),
                        superSerie: rawSuperSerie
                          .filter((superItem) => superItem && typeof superItem === "object")
                          .map((superItem) => {
                            const superRow = superItem as Record<string, unknown>;
                            return {
                              id: String(superRow.id || "").trim() || undefined,
                              ejercicioId: String(superRow.ejercicioId || "").trim() || undefined,
                              series: superRow.series as string | number | undefined,
                              repeticiones: superRow.repeticiones as string | number | undefined,
                              descanso: String(superRow.descanso || "").trim() || undefined,
                              carga: String(superRow.carga || "").trim() || undefined,
                            };
                          }),
                      };
                    });

                  return {
                    id: String(blockItem.id || `week-${weekIndex + 1}-block-${blockIndex + 1}`).trim(),
                    titulo: String(blockItem.titulo || `Bloque ${blockIndex + 1}`).trim(),
                    objetivo: String(blockItem.objetivo || "").trim(),
                    ejercicios,
                  };
                });

              const entrenamiento = rawTraining
                ? {
                    titulo: String(rawTraining.titulo || "").trim() || undefined,
                    descripcion: String(rawTraining.descripcion || "").trim() || undefined,
                    duracion: String(rawTraining.duracion || "").trim() || undefined,
                    bloques,
                  }
                : undefined;

              return {
                id: String(dayItem.id || `week-${weekIndex + 1}-day-${dayIndex + 1}`).trim(),
                dia: String(dayItem.dia || `Dia ${dayIndex + 1}`).trim() || `Dia ${dayIndex + 1}`,
                planificacion: String(dayItem.planificacion || "").trim(),
                objetivo: String(dayItem.objetivo || "").trim(),
                sesionId: String(dayItem.sesionId || "").trim(),
                oculto: Boolean(dayItem.oculto),
                entrenamiento,
                postSesionFeedback,
              };
            });

          return {
            id: String(weekItem.id || `week-${weekIndex + 1}`).trim(),
            nombre: String(weekItem.nombre || `Semana ${weekIndex + 1}`).trim() || `Semana ${weekIndex + 1}`,
            objetivo: String(weekItem.objetivo || "").trim(),
            oculto: Boolean(weekItem.oculto),
            dias,
          };
        });

      return {
        ownerKey: String(plan.ownerKey || `${tipo}:plan-${planIndex + 1}`).trim(),
        tipo,
        nombre: String(plan.nombre || "").trim(),
        categoria: String(plan.categoria || "").trim() || undefined,
        semanas,
      };
    })
    .filter((plan) => plan.ownerKey && plan.semanas.length > 0);
}

function selectAlumnoWeekPlanFromStore(
  rawValue: unknown,
  profileName: string,
  matchIdentityName: (value: string | null | undefined) => boolean
): WeekPersonPlanLite | null {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const root = rawValue as { planes?: unknown };
  if (!Array.isArray(root.planes) || root.planes.length === 0) {
    return null;
  }

  const isAlumnoEntry = (entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const plan = entry as Record<string, unknown>;
    const tipoRaw = String(plan.tipo || "").trim().toLowerCase();
    return !tipoRaw || tipoRaw === "alumnos";
  };

  const directOwnerKey = `alumnos:${String(profileName || "").trim().toLowerCase()}`;

  const exactOwnerEntry = root.planes.find((entry) => {
    if (!isAlumnoEntry(entry)) return false;
    const plan = entry as Record<string, unknown>;
    return String(plan.ownerKey || "").trim().toLowerCase() === directOwnerKey;
  });

  if (exactOwnerEntry) {
    return normalizeWeekStorePlans({ planes: [exactOwnerEntry] })[0] || null;
  }

  const byNameEntry = root.planes.find((entry) => {
    if (!isAlumnoEntry(entry)) return false;
    const plan = entry as Record<string, unknown>;
    const planName = String(plan.nombre || "").trim();
    return matchIdentityName(planName) || namesLikelyMatch(planName, profileName);
  });

  if (byNameEntry) {
    return normalizeWeekStorePlans({ planes: [byNameEntry] })[0] || null;
  }

  const byOwnerNameEntry = root.planes.find((entry) => {
    if (!isAlumnoEntry(entry)) return false;
    const plan = entry as Record<string, unknown>;
    const ownerName = String(plan.ownerKey || "").replace(/^alumnos:/i, "").trim();
    return matchIdentityName(ownerName);
  });

  if (byOwnerNameEntry) {
    return normalizeWeekStorePlans({ planes: [byOwnerNameEntry] })[0] || null;
  }

  return null;
}

function resolveRoutineBlocksForSession(
  session: Sesion,
  matchIdentityName: (value: string | null | undefined) => boolean
): {
  prescripcion: PrescripcionSesionPersona | null;
  blocks: RoutineBlock[];
} {
  const prescripciones = Array.isArray(session.prescripciones) ? session.prescripciones : [];
  const matchedPrescripcion =
    prescripciones.find((item) => item.personaTipo === "alumnos" && matchIdentityName(item.personaNombre)) ||
    null;

  const sourceBlocks =
    matchedPrescripcion && Array.isArray(matchedPrescripcion.bloques) && matchedPrescripcion.bloques.length > 0
      ? matchedPrescripcion.bloques
      : Array.isArray(session.bloques)
      ? session.bloques
      : [];

  const blocks: RoutineBlock[] = sourceBlocks.map((block) => ({
    ...block,
    ejercicios: Array.isArray(block.ejercicios) ? block.ejercicios : [],
  }));

  return {
    prescripcion: matchedPrescripcion,
    blocks,
  };
}

function buildRoutineBlocksFromDayTraining(training?: WeekDayTrainingLite): RoutineBlock[] {
  const blocks = training && Array.isArray(training.bloques) ? training.bloques : [];

  return blocks.map((block, blockIndex) => ({
    id: String(block.id || `block-${blockIndex + 1}`),
    titulo: String(block.titulo || `Bloque ${blockIndex + 1}`),
    objetivo: String(block.objetivo || ""),
    ejercicios: (Array.isArray(block.ejercicios) ? block.ejercicios : []).map((exercise, exerciseIndex) => {
      const rawSeries = Math.round(Number(toSafeNumeric(exercise.series) || 0));
      const superSerieRows = Array.isArray(exercise.superSerie) ? exercise.superSerie : [];

      return {
        ejercicioId: String(exercise.ejercicioId || exercise.id || `exercise-${exerciseIndex + 1}`),
        series: Math.max(0, rawSeries),
        repeticiones: String(exercise.repeticiones || "").trim(),
        descanso: String(exercise.descanso || "").trim() || undefined,
        carga: String(exercise.carga || "").trim() || undefined,
        observaciones: String(exercise.observaciones || "").trim() || undefined,
        metricas: Array.isArray(exercise.metricas)
          ? exercise.metricas
              .map((metric) => ({
                nombre: String(metric?.nombre || "").trim(),
                valor: String(metric?.valor || "").trim(),
              }))
              .filter((metric) => metric.nombre || metric.valor)
          : undefined,
        superSerie:
          superSerieRows.length > 0
            ? superSerieRows.map((superItem, superIndex) => ({
                id: String(superItem.id || "").trim() || `super-${superIndex + 1}`,
                ejercicioId: String(superItem.ejercicioId || "").trim(),
                series: String(superItem.series || "").trim(),
                repeticiones: String(superItem.repeticiones || "").trim(),
                descanso: String(superItem.descanso || "").trim() || undefined,
                carga: String(superItem.carga || "").trim() || undefined,
              }))
            : undefined,
      };
    }),
  }));
}

function looksLikeDirectVideoUrl(rawUrl: string): boolean {
  const normalized = String(rawUrl || "").trim().toLowerCase();
  if (!normalized) return false;
  return /\.(mp4|webm|ogg|m4v|mov)(\?.*)?$/i.test(normalized) || normalized.startsWith("data:video/");
}

type RoutineExerciseVideoSource =
  | { kind: "iframe"; src: string }
  | { kind: "video"; src: string }
  | { kind: "external"; src: string }
  | { kind: "none"; src: null };

function resolveRoutineExerciseVideoSource(rawUrl: string): RoutineExerciseVideoSource {
  const normalized = normalizeMusicUrl(rawUrl);
  if (!normalized) {
    return { kind: "none", src: null };
  }

  const youtubeEmbed = resolveYouTubeEmbed(normalized);
  if (youtubeEmbed) {
    return { kind: "iframe", src: youtubeEmbed };
  }

  if (looksLikeDirectVideoUrl(normalized)) {
    return { kind: "video", src: normalized };
  }

  return { kind: "external", src: normalized };
}

function resolveYouTubeThumbnailFromEmbed(embedUrl: string): string | null {
  const match = String(embedUrl || "").match(/\/embed\/([^/?#]+)/i);
  const videoId = String(match?.[1] || "").trim();
  if (!videoId || videoId.toLowerCase() === "videoseries") {
    return null;
  }
  return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file-read-error"));
    reader.readAsDataURL(file);
  });
}

function coerceRowsFromUnknown<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>) as T[];
  }

  return [];
}

function readArrayFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];

  try {
    const syncCacheRaw = window.localStorage.getItem(`${LOCAL_SYNC_CACHE_PREFIX}${key}`);
    const legacyRaw = window.localStorage.getItem(key);
    const raw = syncCacheRaw ?? legacyRaw;
    const sourcePrefix = syncCacheRaw !== null ? "sync:" : "legacy:";
    const cacheRaw = raw === null ? null : `${sourcePrefix}${raw}`;

    const cached = STORAGE_ARRAY_CACHE.get(key);
    if (cached && cached.raw === cacheRaw) {
      return cached.parsed as T[];
    }

    if (!raw) {
      STORAGE_ARRAY_CACHE.set(key, { raw: null, parsed: [] });
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    const rows = coerceRowsFromUnknown<T>(parsed);

    STORAGE_ARRAY_CACHE.set(key, {
      raw: cacheRaw,
      parsed: rows as unknown[],
    });

    return rows;
  } catch {
    STORAGE_ARRAY_CACHE.delete(key);
    return [];
  }
}

function getTimestamp(value: string | Date | null | undefined): number {
  const parsed = parseDateValue(value);
  return parsed ? parsed.getTime() : 0;
}

function createPreparedIdentity(identity: IdentityRef): PreparedIdentity {
  const names = identity.names
    .map((name) => normalizePersonKey(name))
    .filter(Boolean)
    .map((value) => ({
      value,
      tokenSet: new Set(value.split(" ").filter(Boolean)),
    }));

  const emails = new Set(
    identity.emails
      .map((email) => String(email || "").trim().toLowerCase())
      .filter(Boolean)
  );

  return { names, emails };
}

function matchesPreparedIdentityName(value: string | null | undefined, identity: PreparedIdentity): boolean {
  const normalized = normalizePersonKey(value || "");
  if (!normalized) return false;

  const candidateTokens = normalized.split(" ").filter(Boolean);

  for (const target of identity.names) {
    if (target.value === normalized) return true;
    if (target.value.includes(normalized) || normalized.includes(target.value)) return true;

    let shared = 0;
    for (const token of candidateTokens) {
      if (!target.tokenSet.has(token)) continue;
      shared += 1;
      if (shared >= 2 || token.length >= 5) return true;
    }
  }

  return false;
}

function matchesPreparedIdentityEmail(value: string | null | undefined, identity: PreparedIdentity): boolean {
  const candidate = String(value || "").trim().toLowerCase();
  if (!candidate) return false;
  return identity.emails.has(candidate);
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
}

function analyzeNutritionImageBitmap(imageBitmap: ImageBitmap): {
  coverageRatio: number;
  edgeRatio: number;
  vibrancyRatio: number;
  warmRatio: number;
} {
  const sampleWidth = 220;
  const scale = Math.min(1, sampleWidth / Math.max(1, imageBitmap.width));
  const width = Math.max(56, Math.round(imageBitmap.width * scale));
  const height = Math.max(56, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {
      coverageRatio: 0.58,
      edgeRatio: 0.32,
      vibrancyRatio: 0.38,
      warmRatio: 0.34,
    };
  }

  context.drawImage(imageBitmap, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);

  let coverageCount = 0;
  let warmCount = 0;
  let saturationSum = 0;
  let edgeCount = 0;

  const totalPixels = width * height;
  const totalEdgeChecks = Math.max(1, (width - 1) * (height - 1));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index] || 0;
      const g = data[index + 1] || 0;
      const b = data[index + 2] || 0;

      const maxRgb = Math.max(r, g, b);
      const minRgb = Math.min(r, g, b);
      const delta = maxRgb - minRgb;
      const saturation = maxRgb === 0 ? 0 : delta / maxRgb;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      saturationSum += saturation;

      if (r > g && g > b) {
        warmCount += 1;
      }

      if (luma > 16 && luma < 244 && (saturation > 0.09 || luma < 212)) {
        coverageCount += 1;
      }

      if (x < width - 1 && y < height - 1) {
        const rightIndex = (y * width + (x + 1)) * 4;
        const downIndex = ((y + 1) * width + x) * 4;

        const rightLuma =
          0.2126 * (data[rightIndex] || 0) +
          0.7152 * (data[rightIndex + 1] || 0) +
          0.0722 * (data[rightIndex + 2] || 0);
        const downLuma =
          0.2126 * (data[downIndex] || 0) +
          0.7152 * (data[downIndex + 1] || 0) +
          0.0722 * (data[downIndex + 2] || 0);

        const gradient = Math.abs(luma - rightLuma) + Math.abs(luma - downLuma);
        if (gradient > 58) {
          edgeCount += 1;
        }
      }
    }
  }

  return {
    coverageRatio: Math.max(0.25, Math.min(0.92, coverageCount / Math.max(1, totalPixels))),
    edgeRatio: Math.max(0.08, Math.min(0.86, edgeCount / totalEdgeChecks)),
    vibrancyRatio: Math.max(0.12, Math.min(0.92, saturationSum / Math.max(1, totalPixels))),
    warmRatio: Math.max(0.08, Math.min(0.92, warmCount / Math.max(1, totalPixels))),
  };
}

export default function AlumnoVisionClient({
  currentName,
  currentEmail,
  initialCategory = "inicio",
}: AlumnoVisionClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const resolvedInitialCategory = resolveInitialMainCategory(initialCategory);
  const routeCategory = useMemo(() => resolveMainCategoryFromPath(pathname), [pathname]);
  const { alumnos } = useAlumnos();
  const { sesiones } = useSessions();
  const { ejercicios } = useEjercicios();

  const [activeCategory, setActiveCategory] = useState<MainCategory>(resolvedInitialCategory);
  const [clientMeta, setClientMeta] = useState<ClienteMetaLite | null>(null);
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlanLite | null>(null);
  const [nutritionAssignedAt, setNutritionAssignedAt] = useState<string | null>(null);
  const [selectedNutritionWeekId, setSelectedNutritionWeekId] = useState<string | null>(null);
  const [selectedNutritionDayId, setSelectedNutritionDayId] = useState<string | null>(null);
  const [nutritionVariationMealId, setNutritionVariationMealId] = useState<string>("");
  const [nutritionVariationDraft, setNutritionVariationDraft] = useState<string>("");
  const [nutritionVariationStatus, setNutritionVariationStatus] = useState<string>("");
  const [nutritionReplacementByItemKey, setNutritionReplacementByItemKey] = useState<
    Record<string, NutritionReplacementSuggestionLite>
  >({});
  const [nutritionPanelView] = useState<"plan" | "registro">("plan");
  const [nutritionShowTrackerDetails, setNutritionShowTrackerDetails] = useState(false);
  const [nutritionTrackerDate, setNutritionTrackerDate] = useState<string>(() => getTodayDateInputValue());
  const [nutritionTrackerStatus, setNutritionTrackerStatus] = useState<string>("");
  const [nutritionMealComposerMealId, setNutritionMealComposerMealId] = useState<string | null>(null);
  const [nutritionFoodSearchQuery, setNutritionFoodSearchQuery] = useState("");
  const [nutritionFoodGramsDraft, setNutritionFoodGramsDraft] = useState("100");
  const [nutritionRemoteSearchResults, setNutritionRemoteSearchResults] = useState<NutritionSearchFoodResult[]>([]);
  const [nutritionFoodSearchLoading, setNutritionFoodSearchLoading] = useState(false);
  const [nutritionFoodSearchStatus, setNutritionFoodSearchStatus] = useState("");
  const [nutritionBarcodeStatus, setNutritionBarcodeStatus] = useState("");
  const [nutritionCalIaStatus, setNutritionCalIaStatus] = useState("");
  const [nutritionCalIaEstimate, setNutritionCalIaEstimate] = useState<
    | {
        previewUrl: string;
        entry: NutritionDailyCustomFoodLite;
      }
    | null
  >(null);
  const [nutritionLiveCaptureMode, setNutritionLiveCaptureMode] = useState<NutritionCaptureMode>("none");
  const [nutritionLiveCaptureStatus, setNutritionLiveCaptureStatus] = useState("");
  const [nutritionLiveCaptureReady, setNutritionLiveCaptureReady] = useState(false);
  const [nutritionCalIaProcessing, setNutritionCalIaProcessing] = useState(false);
  const [nutritionCustomFoodDraft, setNutritionCustomFoodDraft] = useState<{
    nombre: string;
    porcion: string;
    calorias: string;
    proteinas: string;
    carbohidratos: string;
    grasas: string;
  }>({
    nombre: "",
    porcion: "",
    calorias: "",
    proteinas: "",
    carbohidratos: "",
    grasas: "",
  });
  const [nutritionCustomFoodStatus, setNutritionCustomFoodStatus] = useState<string>("");
  const [selectedMusicAssignmentId, setSelectedMusicAssignmentId] = useState<string | null>(null);
  const [musicArtworkByUrl, setMusicArtworkByUrl] = useState<Record<string, string>>({});
  const [musicNameByUrl, setMusicNameByUrl] = useState<Record<string, string>>({});
  const [musicContentTypeByUrl, setMusicContentTypeByUrl] = useState<Record<string, MusicContentType>>({});
  const [musicCoachLine, setMusicCoachLine] = useState<string>(resolveRandomMusicCoachLine(currentName || ""));
  const [anthropometryEntries, setAnthropometryEntries] = useState<AnthropometryEntryLite[]>([]);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [selectedRoutineSessionId, setSelectedRoutineSessionId] = useState<string | null>(null);
  const [selectedRoutineWeekId, setSelectedRoutineWeekId] = useState<string | null>(null);
  const [selectedRoutineDayId, setSelectedRoutineDayId] = useState<string | null>(null);
  const [expandedRoutineBlocks, setExpandedRoutineBlocks] = useState<Record<string, boolean>>({});
  const [visibleRoutineBlockCount, setVisibleRoutineBlockCount] = useState<number>(ULTRA_MOBILE_INITIAL_BLOCKS);
  const [routinePullDistance, setRoutinePullDistance] = useState(0);
  const [routinePullRefreshing, setRoutinePullRefreshing] = useState(false);
  const [routineDayWeekLoading, setRoutineDayWeekLoading] = useState(false);
  const [routineExerciseLogTarget, setRoutineExerciseLogTarget] = useState<RoutineExerciseLogTarget | null>(null);
  const [guidedTrainingMode, setGuidedTrainingMode] = useState(false);
  const [guidedTrainingIndex, setGuidedTrainingIndex] = useState(0);
  // Refs to panel handlers defined later in the file; used to break the
  // cyclic declaration order between guided-flow helpers and log/finalize panels.
  const openLogPanelRef = useRef<((target: RoutineExerciseLogTarget) => void) | null>(null);
  const closeLogPanelRef = useRef<(() => void) | null>(null);
  const openFinalizePanelRef = useRef<(() => void) | null>(null);
  const [routineExerciseLogDraft, setRoutineExerciseLogDraft] = useState<RoutineExerciseLogDraft>(
    createRoutineExerciseLogDraft()
  );
  const [routineExerciseLogEditingId, setRoutineExerciseLogEditingId] = useState<string | null>(null);
  const [routineExerciseLogStatus, setRoutineExerciseLogStatus] = useState<string>("");
  const [routineExerciseLogView, setRoutineExerciseLogView] = useState<RoutineExerciseLogView>("registro");
  const [routineExerciseLogSaving, setRoutineExerciseLogSaving] = useState(false);
  const [routineQuickPanel, setRoutineQuickPanel] = useState<"none" | "change" | "sessions" | "timer">("none");
  const [routineStopwatchElapsedMs, setRoutineStopwatchElapsedMs] = useState(0);
  const [routineStopwatchRunning, setRoutineStopwatchRunning] = useState(false);
  const [routineStopwatchFloatPosition, setRoutineStopwatchFloatPosition] =
    useState<RoutineStopwatchFloatPosition | null>(null);
  const [routineStopwatchDragging, setRoutineStopwatchDragging] = useState(false);
  const [routineChangeRequestDraft, setRoutineChangeRequestDraft] = useState("");
  const [routineChangeRequestStatus, setRoutineChangeRequestStatus] = useState("");
  const [routineFinalizePanelOpen, setRoutineFinalizePanelOpen] = useState(false);
  const [routineFinalizeStatus, setRoutineFinalizeStatus] = useState("");
  const [routineFinalizeAnswerByQuestionId, setRoutineFinalizeAnswerByQuestionId] = useState<
    Record<string, string>
  >({});
  const [routineFinalizeMeasurements, setRoutineFinalizeMeasurements] = useState<Record<string, string>>({});
  const [routineFinalizeSurveyStep, setRoutineFinalizeSurveyStep] = useState(0);
  type GuidedPausedState = { index: number; draft: RoutineExerciseLogDraft };
  const [guidedPausedState, setGuidedPausedState] = useState<GuidedPausedState | null>(null);
  const [guidedStepKey, setGuidedStepKey] = useState(0);
  const [routineActionScreenLoading, setRoutineActionScreenLoading] = useState(false);
  const [accountProfile, setAccountProfile] = useState<AccountProfileLite | null>(null);
  const [coachContact, setCoachContact] = useState<CoachContactLite | null>(null);
  // Cuenta panel (account tab in dock)
  type AccountPanelData = {
    id?: string;
    email?: string;
    role?: string;
    nombreCompleto?: string;
    edad?: number;
    fechaNacimiento?: string;
    altura?: number;
    telefono?: string | null;
    direccion?: string | null;
    emailVerified?: boolean;
  };
  const [accountPanelData, setAccountPanelData] = useState<AccountPanelData | null>(null);
  const [accountPanelLoading, setAccountPanelLoading] = useState(false);
  const [accountPanelSaving, setAccountPanelSaving] = useState(false);
  const [accountPanelSigningOut, setAccountPanelSigningOut] = useState(false);
  const [accountPanelMessage, setAccountPanelMessage] = useState<string | null>(null);
  const [accountPanelError, setAccountPanelError] = useState<string | null>(null);
  const [accountPanelNombre, setAccountPanelNombre] = useState("");
  const [accountPanelEdad, setAccountPanelEdad] = useState("");
  const [accountPanelAltura, setAccountPanelAltura] = useState("");
  const [accountPanelTelefono, setAccountPanelTelefono] = useState("");
  const [accountPanelDireccion, setAccountPanelDireccion] = useState("");
  const [accountPanelEmail, setAccountPanelEmail] = useState("");
  const [accountPanelCurrentPassword, setAccountPanelCurrentPassword] = useState("");
  const [accountPanelNewPassword, setAccountPanelNewPassword] = useState("");
  const [accountPanelLoaded, setAccountPanelLoaded] = useState(false);
  const [accountPanelSidebarImage, setAccountPanelSidebarImage] = useState<string | null>(null);
  const [accountPanelSidebarImageDraft, setAccountPanelSidebarImageDraft] = useState<string | null>(null);
  const [accountPanelPhotoSaving, setAccountPanelPhotoSaving] = useState(false);
  const [accountPanelPhotoError, setAccountPanelPhotoError] = useState<string | null>(null);
  const accountPanelFileInputRef = useRef<HTMLInputElement | null>(null);
  const [routineLastSyncAt, setRoutineLastSyncAt] = useState<number | null>(null);
  const nutritionBarcodeCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const nutritionCalIaCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const nutritionPlanActionsSectionRef = useRef<HTMLDivElement | null>(null);
  const nutritionLiveVideoRef = useRef<HTMLVideoElement | null>(null);
  const nutritionLiveStreamRef = useRef<MediaStream | null>(null);
  const nutritionBarcodeScanRafRef = useRef<number | null>(null);
  const nutritionBarcodeLastDetectedRef = useRef("");
  const storageRefreshRafRef = useRef<number | null>(null);
  const storageRefreshIdleRef = useRef<number | null>(null);
  const lastStorageRefreshTsRef = useRef<number>(0);
  const requestedMusicArtworkRef = useRef<Set<string>>(new Set());
  const homeNavGuardRef = useRef<number>(0);
  const activeCategoryRef = useRef<MainCategory>(resolvedInitialCategory);
  const categoryHistoryRef = useRef<MainCategory[]>(resolvedInitialCategory === "inicio" ? [] : ["inicio"]);
  const routinePullStartYRef = useRef<number | null>(null);
  const routinePullActiveRef = useRef(false);
  const routinePullDistanceRef = useRef(0);
  const routineDayWeekLoadingTimerRef = useRef<number | null>(null);
  const routineExerciseLogStatusTimerRef = useRef<number | null>(null);
  const routineActionScreenLoadingTimerRef = useRef<number | null>(null);
  const routineStopwatchStartedAtRef = useRef<number | null>(null);
  const routineStopwatchIntervalRef = useRef<number | null>(null);
  const previousRoutineQuickPanelRef = useRef<"none" | "change" | "sessions" | "timer">("none");
  const routineStopwatchFloatHostRef = useRef<HTMLElement | null>(null);
  const routineStopwatchDragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  }>(
    {
      active: false,
      pointerId: -1,
      startClientX: 0,
      startClientY: 0,
      originX: 0,
      originY: 0,
    }
  );
  const previousRoutineActionScreenRef = useRef<RoutineActionScreen>("none");

  const isUltraMobile = useMemo(() => {
    if (typeof window === "undefined") return false;

    const params = new URLSearchParams(window.location.search);
    const byQuery = params.get("pfperf") === "1";
    const byClass = document.documentElement.classList.contains("pf-mobile-fluid");

    return byQuery || byClass;
  }, []);

  const [sharedMusicAssignments, , musicSyncLoaded] = useSharedState<MusicAssignmentLite[]>([], {
    key: MUSIC_PLAYLISTS_KEY,
    legacyLocalStorageKey: MUSIC_PLAYLISTS_KEY,
    pollMs: isUltraMobile ? 9000 : 12000,
  });

  const [workoutLogsShared, setWorkoutLogsShared, workoutLogsSyncLoaded] = useSharedState<unknown[]>([], {
    key: WORKOUT_LOGS_KEY,
    legacyLocalStorageKey: WORKOUT_LOGS_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  type TrainingCompletionLite = {
    weekId: string;
    dayId: string;
    sessionId?: string;
    fecha: string;
    completedAt: string;
  };
  const [trainingCompletions, setTrainingCompletions] = useSharedState<TrainingCompletionLite[]>([], {
    key: TRAINING_COMPLETIONS_KEY,
    legacyLocalStorageKey: TRAINING_COMPLETIONS_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  const [weekPlanStoreRaw, , weekPlanSyncLoaded] = useSharedState<unknown>(null, {
    key: WEEK_PLAN_KEY,
    legacyLocalStorageKey: WEEK_PLAN_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  const [routineChangeRequestsRaw, setRoutineChangeRequestsRaw, routineChangeRequestsSyncLoaded] =
    useSharedState<unknown[]>([], {
      key: ROUTINE_CHANGE_REQUESTS_KEY,
      legacyLocalStorageKey: ROUTINE_CHANGE_REQUESTS_KEY,
      pollMs: isUltraMobile ? 15000 : 12000,
    });

  const [sessionFeedbackRecordsRaw, setSessionFeedbackRecordsRaw, sessionFeedbackSyncLoaded] =
    useSharedState<unknown[]>([], {
      key: SESSION_FEEDBACK_RECORDS_KEY,
      legacyLocalStorageKey: SESSION_FEEDBACK_RECORDS_KEY,
      pollMs: isUltraMobile ? 15000 : 12000,
    });

  const [clientesMetaSharedRaw, , clientesMetaSyncLoaded] = useSharedState<unknown>([], {
    key: CLIENTE_META_KEY,
    legacyLocalStorageKey: CLIENTE_META_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  const [nutritionPlansSharedRaw, , nutritionPlansSyncLoaded] = useSharedState<unknown[]>([], {
    key: NUTRITION_PLANS_KEY,
    legacyLocalStorageKey: NUTRITION_PLANS_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  const [nutritionAssignmentsSharedRaw, , nutritionAssignmentsSyncLoaded] = useSharedState<unknown[]>([], {
    key: NUTRITION_ASSIGNMENTS_KEY,
    legacyLocalStorageKey: NUTRITION_ASSIGNMENTS_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  const [nutritionFavoritesRaw, setNutritionFavoritesRaw, nutritionFavoritesSyncLoaded] = useSharedState<unknown[]>([], {
    key: NUTRITION_FAVORITES_KEY,
    legacyLocalStorageKey: NUTRITION_FAVORITES_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  const [nutritionCustomFoodsRaw, , nutritionCustomFoodsSyncLoaded] = useSharedState<unknown[]>([], {
    key: NUTRITION_CUSTOM_FOODS_KEY,
    legacyLocalStorageKey: NUTRITION_CUSTOM_FOODS_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  const [nutritionDailyLogsRaw, setNutritionDailyLogsRaw, nutritionDailyLogsSyncLoaded] = useSharedState<unknown[]>([], {
    key: NUTRITION_DAILY_LOGS_KEY,
    legacyLocalStorageKey: NUTRITION_DAILY_LOGS_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  const [nutritionVariationRequestsRaw, setNutritionVariationRequestsRaw, nutritionVariationRequestsSyncLoaded] =
    useSharedState<unknown[]>([], {
      key: NUTRITION_VARIATION_REQUESTS_KEY,
      legacyLocalStorageKey: NUTRITION_VARIATION_REQUESTS_KEY,
      pollMs: isUltraMobile ? 15000 : 12000,
    });

  const shouldLoadNutritionData = !isUltraMobile || activeCategory === "nutricion";
  const shouldLoadWorkoutData =
    !isUltraMobile || activeCategory === "progreso" || activeCategory === "rutina" || activeCategory === "inicio";
  const shouldLoadAnthropometryData = !isUltraMobile || activeCategory === "progreso" || activeCategory === "inicio";
  const shouldLoadMusicData = !isUltraMobile || activeCategory === "musica" || activeCategory === "inicio";

  useEffect(() => {
    if (
      !weekPlanSyncLoaded &&
      !workoutLogsSyncLoaded &&
      !routineChangeRequestsSyncLoaded &&
      !sessionFeedbackSyncLoaded &&
      !clientesMetaSyncLoaded &&
      !nutritionPlansSyncLoaded &&
      !nutritionAssignmentsSyncLoaded &&
      !nutritionFavoritesSyncLoaded &&
      !nutritionCustomFoodsSyncLoaded &&
      !nutritionDailyLogsSyncLoaded &&
      !nutritionVariationRequestsSyncLoaded
    ) {
      return;
    }

    setRoutineLastSyncAt(Date.now());
  }, [
    routineChangeRequestsRaw,
    routineChangeRequestsSyncLoaded,
    sessionFeedbackRecordsRaw,
    sessionFeedbackSyncLoaded,
    clientesMetaSharedRaw,
    clientesMetaSyncLoaded,
    nutritionPlansSharedRaw,
    nutritionPlansSyncLoaded,
    nutritionAssignmentsSharedRaw,
    nutritionAssignmentsSyncLoaded,
    nutritionFavoritesRaw,
    nutritionFavoritesSyncLoaded,
    nutritionCustomFoodsRaw,
    nutritionCustomFoodsSyncLoaded,
    nutritionDailyLogsRaw,
    nutritionDailyLogsSyncLoaded,
    nutritionVariationRequestsRaw,
    nutritionVariationRequestsSyncLoaded,
    weekPlanStoreRaw,
    weekPlanSyncLoaded,
    workoutLogsShared,
    workoutLogsSyncLoaded,
  ]);

  useLayoutEffect(() => {
    const nextCategory = routeCategory || resolveInitialMainCategory(initialCategory);
    categoryHistoryRef.current = nextCategory === "inicio" ? [] : ["inicio"];

    if (activeCategoryRef.current === nextCategory) {
      return;
    }

    activeCategoryRef.current = nextCategory;
    setActiveCategory(nextCategory);
  }, [initialCategory, routeCategory]);

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.setItem("pf-alumno-last-category-v1", activeCategory);
      window.sessionStorage.setItem("pf-alumno-last-category-ts-v1", String(Date.now()));
    } catch {
      // Ignore storage exceptions in restricted browser modes.
    }
  }, [activeCategory]);

  useEffect(() => {
    if (!isUltraMobile || typeof document === "undefined") return;

    const root = document.documentElement;
    root.classList.add("pf-mobile-webview");
    root.classList.add("pf-mobile-fluid");
  }, [isUltraMobile]);

  useEffect(() => {
    if (activeCategory !== "rutina") {
      if (routineDayWeekLoadingTimerRef.current !== null) {
        window.clearTimeout(routineDayWeekLoadingTimerRef.current);
        routineDayWeekLoadingTimerRef.current = null;
      }

      if (routineExerciseLogStatusTimerRef.current !== null) {
        window.clearTimeout(routineExerciseLogStatusTimerRef.current);
        routineExerciseLogStatusTimerRef.current = null;
      }

      if (routineStopwatchIntervalRef.current !== null) {
        window.clearInterval(routineStopwatchIntervalRef.current);
        routineStopwatchIntervalRef.current = null;
      }

      routineStopwatchStartedAtRef.current = null;
      setRoutineStopwatchRunning(false);
      setRoutineStopwatchElapsedMs(0);

      setSelectedRoutineSessionId(null);
      setSelectedRoutineWeekId(null);
      setSelectedRoutineDayId(null);
      setExpandedRoutineBlocks({});
      setVisibleRoutineBlockCount(ULTRA_MOBILE_INITIAL_BLOCKS);
      setRoutinePullDistance(0);
      setRoutineDayWeekLoading(false);
      setRoutineExerciseLogTarget(null);
      setRoutineExerciseLogStatus("");
      setRoutineExerciseLogDraft(createRoutineExerciseLogDraft());
      setRoutineQuickPanel("none");
      setRoutineChangeRequestDraft("");
      setRoutineChangeRequestStatus("");
      setRoutineFinalizePanelOpen(false);
      setRoutineFinalizeStatus("");
      setRoutineFinalizeAnswerByQuestionId({});
    }
  }, [activeCategory]);

  useEffect(() => {
    return () => {
      if (routineDayWeekLoadingTimerRef.current !== null) {
        window.clearTimeout(routineDayWeekLoadingTimerRef.current);
        routineDayWeekLoadingTimerRef.current = null;
      }

      if (routineStopwatchIntervalRef.current !== null) {
        window.clearInterval(routineStopwatchIntervalRef.current);
        routineStopwatchIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const expectedPath = `/alumnos/${activeCategory}`;
    if (window.location.pathname === expectedPath) {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const nextUrl = `${expectedPath}${currentUrl.search}`;
    window.history.replaceState(window.history.state ?? null, "", nextUrl);
  }, [activeCategory]);

  const alumnoProfile = useMemo(() => {
    const records = (alumnos as AlumnoRecord[]) || [];

    const normalizedCurrentEmail = String(currentEmail || "").trim().toLowerCase();

    const byEmail = normalizedCurrentEmail
      ? records.find((alumno) => String(alumno.email || "").trim().toLowerCase() === normalizedCurrentEmail)
      : null;

    if (byEmail) return byEmail;

    const byName = records.find((alumno) => namesLikelyMatch(alumno.nombre, currentName));
    if (byName) return byName;

    return null;
  }, [alumnos, currentEmail, currentName]);

  const profileName = useMemo(() => {
    const fromAlumno = String(alumnoProfile?.nombre || "").trim();
    if (fromAlumno) return fromAlumno;

    const fromCurrentName = String(currentName || "").trim();
    if (fromCurrentName) return fromCurrentName;

    const fromMail = String(currentEmail || "")
      .split("@")
      .shift()
      ?.trim();

    return fromMail || "Alumno";
  }, [alumnoProfile?.nombre, currentEmail, currentName]);

  const profileEmail = useMemo(() => {
    const fromAlumno = String(alumnoProfile?.email || "").trim().toLowerCase();
    if (fromAlumno) return fromAlumno;

    const fromCurrent = String(currentEmail || "").trim().toLowerCase();
    return fromCurrent || "";
  }, [alumnoProfile?.email, currentEmail]);

  const nutritionTrackerOwnerKey = useMemo(() => {
    return normalizePersonKey(profileEmail || profileName || currentEmail || currentName || "alumno");
  }, [currentEmail, currentName, profileEmail, profileName]);

  const profileDisplayName = useMemo(() => {
    const candidate = uniqueStrings([
      accountProfile?.nombreCompleto,
      alumnoProfile?.nombre,
      clientMeta?.nombre,
      currentName,
      profileName,
    ])
      .map((value) => sanitizeProfileDisplayName(value))
      .find(Boolean);

    return candidate || "Alumno";
  }, [accountProfile?.nombreCompleto, alumnoProfile?.nombre, clientMeta?.nombre, currentName, profileName]);

  useEffect(() => {
    const abortController = new AbortController();
    let mounted = true;

    const loadHomeHeaderContext = async () => {
      const [accountResult, coachResult] = await Promise.allSettled([
        fetch("/api/account", {
          cache: "no-store",
          signal: abortController.signal,
        }),
        fetch("/api/alumnos/profesor-contacto", {
          cache: "no-store",
          signal: abortController.signal,
        }),
      ]);

      if (!mounted) return;

      if (accountResult.status === "fulfilled") {
        try {
          if (accountResult.value.ok) {
            const payload = (await accountResult.value.json()) as AccountProfileLite;
            if (mounted) {
              setAccountProfile({
                nombreCompleto: String(payload.nombreCompleto || "").trim() || undefined,
                sidebarImage: typeof payload.sidebarImage === "string" ? payload.sidebarImage : null,
              });
            }
          }
        } catch {
          // Keep UI resilient; account visuals are optional.
        }
      }

      if (coachResult.status === "fulfilled") {
        try {
          if (coachResult.value.ok) {
            const payload = (await coachResult.value.json()) as {
              ok?: boolean;
              contacto?: CoachContactLite;
            };

            if (mounted && payload?.contacto) {
              setCoachContact(payload.contacto);
            }
          }
        } catch {
          // Keep UI resilient; coach contact is optional.
        }
      }
    };

    void loadHomeHeaderContext();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, []);

  const identity = useMemo<IdentityRef>(() => {
    return {
      names: uniqueStrings([profileName, currentName, alumnoProfile?.nombre]),
      emails: uniqueStrings([currentEmail, alumnoProfile?.email]),
    };
  }, [alumnoProfile?.email, alumnoProfile?.nombre, currentEmail, currentName, profileName]);

  const preparedIdentity = useMemo(() => createPreparedIdentity(identity), [identity]);

  const matchIdentityName = useCallback(
    (value: string | null | undefined) => matchesPreparedIdentityName(value, preparedIdentity),
    [preparedIdentity]
  );

  const matchIdentityEmail = useCallback(
    (value: string | null | undefined) => matchesPreparedIdentityEmail(value, preparedIdentity),
    [preparedIdentity]
  );

  const normalizedNutritionTrackerDate = useMemo(
    () => normalizeDateInputValue(nutritionTrackerDate),
    [nutritionTrackerDate]
  );

  const nutritionFoodsById = useMemo(() => {
    if (!shouldLoadNutritionData) {
      return new Map<string, NutritionFoodLite>();
    }

    const rows = [
      ...(argentineFoodsBase as NutritionFoodLite[]),
      ...normalizeNutritionFoodRows(nutritionCustomFoodsRaw),
    ];

    const map = new Map<string, NutritionFoodLite>();
    rows.forEach((row) => {
      const id = String(row.id || "").trim();
      if (!id) return;
      map.set(id, row);
    });

    return map;
  }, [nutritionCustomFoodsRaw, shouldLoadNutritionData]);

  const nutritionFavoriteFoods = useMemo(() => {
    if (!shouldLoadNutritionData) {
      return [] as NutritionFoodFavoriteLite[];
    }

    return normalizeNutritionFavoriteRows(nutritionFavoritesRaw);
  }, [nutritionFavoritesRaw, shouldLoadNutritionData]);

  const nutritionFavoriteFoodIds = useMemo(() => {
    return new Set(nutritionFavoriteFoods.map((item) => item.id));
  }, [nutritionFavoriteFoods]);

  const nutritionCatalogFoods = useMemo(() => {
    if (!shouldLoadNutritionData) {
      return [] as NutritionSearchFoodResult[];
    }

    const byId = new Map<string, NutritionSearchFoodResult>();

    nutritionFavoriteFoods.forEach((item) => {
      byId.set(item.id, {
        id: item.id,
        nombre: item.nombre,
        kcalPer100g: item.kcalPer100g,
        proteinPer100g: item.proteinPer100g,
        carbsPer100g: item.carbsPer100g,
        fatPer100g: item.fatPer100g,
        imageUrl: item.imageUrl,
        barcode: item.barcode,
        sourceLabel: "Favorito",
      });
    });

    nutritionFoodsById.forEach((item, id) => {
      const safeId = String(id || "").trim();
      if (!safeId) {
        return;
      }

      const previous = byId.get(safeId);
      byId.set(safeId, {
        id: safeId,
        nombre: String(item.nombre || previous?.nombre || safeId).trim() || safeId,
        kcalPer100g: Math.max(0, roundToOneDecimal(toNumber(item.kcalPer100g) || previous?.kcalPer100g || 0)),
        proteinPer100g: Math.max(0, roundToOneDecimal(toNumber(item.proteinPer100g) || previous?.proteinPer100g || 0)),
        carbsPer100g: Math.max(0, roundToOneDecimal(toNumber(item.carbsPer100g) || previous?.carbsPer100g || 0)),
        fatPer100g: Math.max(0, roundToOneDecimal(toNumber(item.fatPer100g) || previous?.fatPer100g || 0)),
        imageUrl: resolveNutritionImageUrl([
          item.imageUrl,
          item.imagenUrl,
          item.photoUrl,
          item.fotoUrl,
          item.thumbnailUrl,
          item.coverUrl,
          item.artworkUrl,
          previous?.imageUrl,
        ]) || undefined,
        barcode: previous?.barcode,
        sourceLabel: previous?.sourceLabel || "Base local",
      });
    });

    return Array.from(byId.values()).sort((left, right) => left.nombre.localeCompare(right.nombre));
  }, [nutritionFavoriteFoods, nutritionFoodsById, shouldLoadNutritionData]);

  const nutritionDailyLogs = useMemo<NutritionDailyLogLite[]>(() => {
    if (!shouldLoadNutritionData) {
      return [];
    }

    return normalizeNutritionDailyLogs(nutritionDailyLogsRaw).filter((row) => {
      const ownerKey = normalizePersonKey(row.ownerKey || "");
      if (ownerKey && ownerKey === nutritionTrackerOwnerKey) {
        return true;
      }

      return matchIdentityName(row.alumnoNombre) || matchIdentityEmail(row.alumnoEmail);
    });
  }, [
    matchIdentityEmail,
    matchIdentityName,
    nutritionDailyLogsRaw,
    nutritionTrackerOwnerKey,
    shouldLoadNutritionData,
  ]);

  const workoutLogs = useMemo<WorkoutLogLite[]>(() => {
    if (!shouldLoadWorkoutData) {
      return [];
    }

    return normalizeWorkoutLogsLiteRows(workoutLogsShared).filter((item) => {
      return matchIdentityName(item.alumnoNombre) || matchIdentityEmail(item.alumnoEmail);
    });
  }, [matchIdentityEmail, matchIdentityName, shouldLoadWorkoutData, workoutLogsShared]);

  const routineChangeRequests = useMemo<RoutineChangeRequestLite[]>(() => {
    if (!shouldLoadWorkoutData) {
      return [];
    }

    return normalizeRoutineChangeRequestRows(routineChangeRequestsRaw).filter((item) => {
      return matchIdentityName(item.alumnoNombre) || matchIdentityEmail(item.alumnoEmail);
    });
  }, [
    matchIdentityEmail,
    matchIdentityName,
    routineChangeRequestsRaw,
    shouldLoadWorkoutData,
  ]);

  const nutritionVariationRequests = useMemo<NutritionVariationRequestLite[]>(() => {
    if (!shouldLoadNutritionData) {
      return [];
    }

    return normalizeNutritionVariationRequestRows(nutritionVariationRequestsRaw).filter((item) => {
      return matchIdentityName(item.alumnoNombre) || matchIdentityEmail(item.alumnoEmail);
    });
  }, [
    matchIdentityEmail,
    matchIdentityName,
    nutritionVariationRequestsRaw,
    shouldLoadNutritionData,
  ]);

  const latestNutritionVariationRequest = nutritionVariationRequests[0] || null;

  const sessionFeedbackRecords = useMemo<SessionFeedbackRecordLite[]>(() => {
    if (!shouldLoadWorkoutData) {
      return [];
    }

    return normalizeSessionFeedbackRows(sessionFeedbackRecordsRaw).filter((item) => {
      return matchIdentityName(item.alumnoNombre) || matchIdentityEmail(item.alumnoEmail);
    });
  }, [
    matchIdentityEmail,
    matchIdentityName,
    sessionFeedbackRecordsRaw,
    shouldLoadWorkoutData,
  ]);

  const alumnoWeekPlan = useMemo<WeekPersonPlanLite | null>(() => {
    return selectAlumnoWeekPlanFromStore(weekPlanStoreRaw, profileName, matchIdentityName);
  }, [matchIdentityName, profileName, weekPlanStoreRaw]);

  const routineWeeks = useMemo<WeekPlanLite[]>(() => {
    if (!alumnoWeekPlan) {
      return [];
    }

    return (Array.isArray(alumnoWeekPlan.semanas) ? alumnoWeekPlan.semanas : []).filter((week) => !week.oculto);
  }, [alumnoWeekPlan]);

  const selectedRoutineWeek = useMemo<WeekPlanLite | null>(() => {
    if (routineWeeks.length === 0) {
      return null;
    }

    if (selectedRoutineWeekId) {
      const exact = routineWeeks.find((week) => week.id === selectedRoutineWeekId);
      if (exact) return exact;
    }

    return routineWeeks[0] || null;
  }, [routineWeeks, selectedRoutineWeekId]);

  const routineDaysForSelectedWeek = useMemo<WeekDayPlanLite[]>(() => {
    if (!selectedRoutineWeek) {
      return [];
    }

    return (Array.isArray(selectedRoutineWeek.dias) ? selectedRoutineWeek.dias : []).filter((day) => !day.oculto);
  }, [selectedRoutineWeek]);

  const selectedRoutineDay = useMemo<WeekDayPlanLite | null>(() => {
    if (routineDaysForSelectedWeek.length === 0) {
      return null;
    }

    if (selectedRoutineDayId) {
      const exact = routineDaysForSelectedWeek.find((day) => day.id === selectedRoutineDayId);
      if (exact) return exact;
    }

    return routineDaysForSelectedWeek[0] || null;
  }, [routineDaysForSelectedWeek, selectedRoutineDayId]);

  const selectedRoutineDayFeedbackConfig = useMemo(
    () => normalizePostSessionFeedbackConfig(selectedRoutineDay?.postSesionFeedback),
    [selectedRoutineDay?.postSesionFeedback]
  );

  const selectedRoutineDayFeedbackQuestions =
    selectedRoutineDayFeedbackConfig?.enabled
      ? selectedRoutineDayFeedbackConfig.questions
      : [];

  const hasWeekPlanRoutine = routineWeeks.length > 0;

  const activeRoutineActionScreen = useMemo<RoutineActionScreen>(() => {
    if (routineFinalizePanelOpen) {
      return "finalize";
    }

    return routineQuickPanel;
  }, [routineFinalizePanelOpen, routineQuickPanel]);

  useEffect(() => {
    if (activeCategory !== "rutina") {
      if (routineActionScreenLoadingTimerRef.current !== null) {
        window.clearTimeout(routineActionScreenLoadingTimerRef.current);
        routineActionScreenLoadingTimerRef.current = null;
      }

      previousRoutineActionScreenRef.current = "none";
      setRoutineActionScreenLoading(false);
      return;
    }

    if (activeRoutineActionScreen === "none") {
      if (routineActionScreenLoadingTimerRef.current !== null) {
        window.clearTimeout(routineActionScreenLoadingTimerRef.current);
        routineActionScreenLoadingTimerRef.current = null;
      }

      previousRoutineActionScreenRef.current = "none";
      setRoutineActionScreenLoading(false);
      return;
    }

    if (activeRoutineActionScreen === "timer") {
      if (routineActionScreenLoadingTimerRef.current !== null) {
        window.clearTimeout(routineActionScreenLoadingTimerRef.current);
        routineActionScreenLoadingTimerRef.current = null;
      }

      previousRoutineActionScreenRef.current = activeRoutineActionScreen;
      setRoutineActionScreenLoading(false);
      return;
    }

    if (previousRoutineActionScreenRef.current === activeRoutineActionScreen) {
      return;
    }

    previousRoutineActionScreenRef.current = activeRoutineActionScreen;
    setRoutineActionScreenLoading(true);

    if (routineActionScreenLoadingTimerRef.current !== null) {
      window.clearTimeout(routineActionScreenLoadingTimerRef.current);
      routineActionScreenLoadingTimerRef.current = null;
    }

    routineActionScreenLoadingTimerRef.current = window.setTimeout(() => {
      routineActionScreenLoadingTimerRef.current = null;
      setRoutineActionScreenLoading(false);
    }, ROUTINE_ACTION_SCREEN_MIN_LOADING_MS);
  }, [activeCategory, activeRoutineActionScreen]);

  useEffect(() => {
    return () => {
      if (routineActionScreenLoadingTimerRef.current !== null) {
        window.clearTimeout(routineActionScreenLoadingTimerRef.current);
        routineActionScreenLoadingTimerRef.current = null;
      }
    };
  }, []);

  const musicAssignments = useMemo<MusicAssignmentLite[]>(() => {
    if (!shouldLoadMusicData) {
      return [];
    }

    const rows = Array.isArray(sharedMusicAssignments) ? sharedMusicAssignments : [];

    return rows
      .filter((item) => {
        const targetAlumno = String(item.alumnoNombre || "").trim();
        if (!targetAlumno) return true;
        return matchIdentityName(targetAlumno);
      })
      .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
  }, [matchIdentityName, sharedMusicAssignments, shouldLoadMusicData]);

  useEffect(() => {
    if (musicAssignments.length === 0) {
      setSelectedMusicAssignmentId(null);
      return;
    }

    setSelectedMusicAssignmentId((previous) => {
      if (previous) {
        const stillExists = musicAssignments.some((assignment, index) => {
          return resolveMusicAssignmentId(assignment, index) === previous;
        });

        if (stillExists) {
          return previous;
        }
      }

      return resolveMusicAssignmentId(musicAssignments[0], 0);
    });
  }, [musicAssignments]);

  useEffect(() => {
    if (activeCategory !== "musica") return;
    setMusicCoachLine(resolveRandomMusicCoachLine(profileDisplayName));
  }, [activeCategory, profileDisplayName]);

  useEffect(() => {
    if (!shouldLoadMusicData || musicAssignments.length === 0) return;

    const pendingUrls = musicAssignments
      .map((assignment) => {
        const playlistUrl = normalizeMusicUrl(String(assignment.playlistUrl || ""));
        if (!playlistUrl) return null;

        const platform = resolveMusicPlatform(assignment.platform, assignment.playlistUrl);

        const hasArtwork = Boolean(
          uniqueStrings([
            assignment.coverUrl,
            assignment.imageUrl,
            assignment.thumbnailUrl,
            assignment.artworkUrl,
            musicArtworkByUrl[playlistUrl],
          ])[0]
        );

        const hasResolvedMetadata = Boolean(
          musicArtworkByUrl[playlistUrl] || musicNameByUrl[playlistUrl] || musicContentTypeByUrl[playlistUrl]
        );

        if (hasArtwork && hasResolvedMetadata) return null;

        if (requestedMusicArtworkRef.current.has(playlistUrl)) return null;

        return { playlistUrl, platform };
      })
      .filter((value): value is { playlistUrl: string; platform: MusicPlatform } => Boolean(value));

    if (pendingUrls.length === 0) return;

    let cancelled = false;

    const resolveArtwork = async () => {
      for (const { playlistUrl, platform } of pendingUrls.slice(0, 8)) {
        requestedMusicArtworkRef.current.add(playlistUrl);

        const metadata = await fetchMusicMetadata(platform, playlistUrl);
        if (cancelled) return;

        const thumbnailUrl = String(metadata?.thumbnailUrl || "").trim();
        const playlistName = String(metadata?.playlistName || "").trim();
        const contentType = resolveMusicContentType(platform, playlistUrl, "", metadata?.contentType);

        if (thumbnailUrl) {
          setMusicArtworkByUrl((previous) => {
            if (previous[playlistUrl]) return previous;
            return {
              ...previous,
              [playlistUrl]: thumbnailUrl,
            };
          });
        }

        if (playlistName) {
          setMusicNameByUrl((previous) => {
            if (previous[playlistUrl]) return previous;
            return {
              ...previous,
              [playlistUrl]: playlistName,
            };
          });
        }

        if (contentType !== "OTHER") {
          setMusicContentTypeByUrl((previous) => {
            if (previous[playlistUrl]) return previous;
            return {
              ...previous,
              [playlistUrl]: contentType,
            };
          });
        }
      }
    };

    void resolveArtwork();

    return () => {
      cancelled = true;
    };
  }, [musicAssignments, musicArtworkByUrl, musicContentTypeByUrl, musicNameByUrl, shouldLoadMusicData]);

  const selectedMusicAssignment = useMemo<MusicAssignmentLite | null>(() => {
    if (musicAssignments.length === 0) return null;

    if (selectedMusicAssignmentId) {
      const matched = musicAssignments.find((assignment, index) => {
        return resolveMusicAssignmentId(assignment, index) === selectedMusicAssignmentId;
      });

      if (matched) {
        return matched;
      }
    }

    return musicAssignments[0] || null;
  }, [musicAssignments, selectedMusicAssignmentId]);

  const selectedMusicPlatform = useMemo<MusicPlatform>(() => {
    if (!selectedMusicAssignment) return "OTHER";
    return resolveMusicPlatform(selectedMusicAssignment.platform, selectedMusicAssignment.playlistUrl);
  }, [selectedMusicAssignment]);

  const selectedMusicContentType = useMemo<MusicContentType>(() => {
    if (!selectedMusicAssignment) return "OTHER";

    const playlistUrl = normalizeMusicUrl(String(selectedMusicAssignment.playlistUrl || ""));
    const metadataType = playlistUrl ? musicContentTypeByUrl[playlistUrl] : undefined;

    return resolveMusicContentType(
      selectedMusicPlatform,
      playlistUrl,
      selectedMusicAssignment.recommendedSongTitle,
      metadataType
    );
  }, [musicContentTypeByUrl, selectedMusicAssignment, selectedMusicPlatform]);

  const selectedMusicPlayer = useMemo<MusicPlayerSource>(() => {
    if (!selectedMusicAssignment) {
      return { kind: "none", src: null };
    }

    return resolveMusicPlayerSource(selectedMusicPlatform, String(selectedMusicAssignment.playlistUrl || ""));
  }, [selectedMusicAssignment, selectedMusicPlatform]);

  const selectedMusicCoverUrl = useMemo<string | null>(() => {
    if (!selectedMusicAssignment) return null;

    const playlistUrl = normalizeMusicUrl(String(selectedMusicAssignment.playlistUrl || ""));
    return (
      uniqueStrings([
        selectedMusicAssignment.coverUrl,
        selectedMusicAssignment.imageUrl,
        selectedMusicAssignment.thumbnailUrl,
        selectedMusicAssignment.artworkUrl,
        playlistUrl ? musicArtworkByUrl[playlistUrl] : "",
      ])[0] || null
    );
  }, [musicArtworkByUrl, selectedMusicAssignment]);

  const selectedMusicDisplayName = useMemo<string>(() => {
    if (!selectedMusicAssignment) return "Playlist seleccionada";

    const playlistUrl = normalizeMusicUrl(String(selectedMusicAssignment.playlistUrl || ""));
    const metadataName = playlistUrl ? String(musicNameByUrl[playlistUrl] || "").trim() : "";
    const assignmentName = String(selectedMusicAssignment.playlistName || "").trim();
    const songTitle = String(selectedMusicAssignment.recommendedSongTitle || "").trim();

    if (songTitle) return songTitle;
    if (assignmentName && !looksLikeGenericMusicName(assignmentName)) return assignmentName;
    if (metadataName) return metadataName;

    return resolveMusicFallbackTitle(selectedMusicPlatform, selectedMusicContentType);
  }, [musicNameByUrl, selectedMusicAssignment, selectedMusicContentType, selectedMusicPlatform]);

  const ejerciciosById = useMemo(() => {
    return new Map(ejercicios.map((item) => [item.id, item]));
  }, [ejercicios]);

  const shouldResolveRoutine = activeCategory === "inicio" || activeCategory === "rutina";

  const sessionsById = useMemo(() => {
    return new Map(sesiones.map((session) => [session.id, session]));
  }, [sesiones]);

  const effectiveRoutineSessions = useMemo<Sesion[]>(() => {
    if (!shouldResolveRoutine) return [];

    const orderedSessions = isUltraMobile
      ? sesiones
      : [...sesiones].sort((a, b) =>
          String(a.titulo || "").localeCompare(String(b.titulo || ""), "es", {
            sensitivity: "base",
          })
        );

    const matchesSession = (sesion: Sesion): boolean => {
      const assignType = String(sesion.asignacionTipo || "").trim().toLowerCase();
      const assignedAlumno = String(sesion.alumnoAsignado || "").trim();

      if (assignedAlumno) {
        return matchIdentityName(assignedAlumno);
      }

      return assignType === "alumnos";
    };

    const selected = orderedSessions.filter(matchesSession);
    return selected.length > 0
      ? selected
      : orderedSessions.slice(0, isUltraMobile ? ULTRA_MOBILE_ROUTINE_FALLBACK_SESSIONS : 4);
  }, [isUltraMobile, matchIdentityName, sesiones, shouldResolveRoutine]);

  const routineSummary = useMemo(() => {
    if (isUltraMobile && activeCategory === "inicio") {
      return {
        sessions: hasWeekPlanRoutine
          ? routineWeeks.reduce((total, week) => total + (Array.isArray(week.dias) ? week.dias.filter((day) => !day.oculto).length : 0), 0)
          : effectiveRoutineSessions.length,
        blocks: 0,
        exercises: 0,
      };
    }

    if (hasWeekPlanRoutine) {
      const visibleDays = routineWeeks.flatMap((week) =>
        (Array.isArray(week.dias) ? week.dias : []).filter((day) => !day.oculto)
      );

      const totals = visibleDays.reduce(
        (acc, day) => {
          const directBlocks = buildRoutineBlocksFromDayTraining(day.entrenamiento);
          if (directBlocks.length > 0) {
            acc.blocks += directBlocks.length;
            acc.exercises += directBlocks.reduce((count, block) => count + block.ejercicios.length, 0);
            return acc;
          }

          if (day.sesionId) {
            const linkedSession = sessionsById.get(day.sesionId);
            if (linkedSession) {
              const linked = resolveRoutineBlocksForSession(linkedSession, matchIdentityName);
              acc.blocks += linked.blocks.length;
              acc.exercises += linked.blocks.reduce((count, block) => count + block.ejercicios.length, 0);
            }
          }

          return acc;
        },
        {
          sessions: visibleDays.length,
          blocks: 0,
          exercises: 0,
        }
      );

      return totals;
    }

    const totalBlocks = effectiveRoutineSessions.reduce((count, sesion) => {
      const { blocks } = resolveRoutineBlocksForSession(sesion, matchIdentityName);
      return count + blocks.length;
    }, 0);

    const totalExercises = effectiveRoutineSessions.reduce((count, sesion) => {
      const { blocks } = resolveRoutineBlocksForSession(sesion, matchIdentityName);
      return count + blocks.reduce((blockCount, block) => blockCount + (block.ejercicios?.length || 0), 0);
    }, 0);

    return {
      sessions: effectiveRoutineSessions.length,
      blocks: totalBlocks,
      exercises: totalExercises,
    };
  }, [
    activeCategory,
    effectiveRoutineSessions,
    hasWeekPlanRoutine,
    isUltraMobile,
    matchIdentityName,
    routineWeeks,
    sessionsById,
  ]);

  useEffect(() => {
    if (activeCategory !== "rutina" || !hasWeekPlanRoutine) return;

    setSelectedRoutineSessionId(null);
    setSelectedRoutineWeekId((previous) => {
      if (previous && routineWeeks.some((week) => week.id === previous)) {
        return previous;
      }
      return routineWeeks[0]?.id || null;
    });
  }, [activeCategory, hasWeekPlanRoutine, routineWeeks]);

  useEffect(() => {
    if (activeCategory !== "rutina" || !hasWeekPlanRoutine) return;

    if (!selectedRoutineWeek) {
      setSelectedRoutineDayId(null);
      return;
    }

    const visibleDays = (Array.isArray(selectedRoutineWeek.dias) ? selectedRoutineWeek.dias : []).filter(
      (day) => !day.oculto
    );

    setSelectedRoutineDayId((previous) => {
      if (previous && visibleDays.some((day) => day.id === previous)) {
        return previous;
      }
      return visibleDays[0]?.id || null;
    });
  }, [activeCategory, hasWeekPlanRoutine, selectedRoutineWeek]);

  useEffect(() => {
    if (activeCategory !== "rutina" || hasWeekPlanRoutine) return;

    if (effectiveRoutineSessions.length === 0) {
      setSelectedRoutineSessionId(null);
      return;
    }

    setSelectedRoutineSessionId((previous) => {
      if (previous && effectiveRoutineSessions.some((session) => session.id === previous)) {
        return previous;
      }

      return effectiveRoutineSessions[0]?.id || null;
    });
  }, [activeCategory, effectiveRoutineSessions, hasWeekPlanRoutine]);

  useEffect(() => {
    if (activeCategory !== "rutina") return;
    setVisibleRoutineBlockCount(ULTRA_MOBILE_INITIAL_BLOCKS);
    setExpandedRoutineBlocks({});
  }, [activeCategory, selectedRoutineDayId, selectedRoutineSessionId, selectedRoutineWeekId]);

  useEffect(() => {
    if (activeCategory !== "rutina") return;
    setRoutineFinalizePanelOpen(false);
    setRoutineFinalizeStatus("");
    setRoutineFinalizeAnswerByQuestionId({});
    setRoutineChangeRequestStatus("");
  }, [activeCategory, selectedRoutineDayId, selectedRoutineSessionId, selectedRoutineWeekId]);

  const routineSessionsForDetails = useMemo(() => {
    if (activeCategory !== "rutina") return [];

    if (!selectedRoutineSessionId) {
      return effectiveRoutineSessions.slice(0, 1);
    }

    const selectedSession = effectiveRoutineSessions.find((session) => session.id === selectedRoutineSessionId);
    return selectedSession ? [selectedSession] : effectiveRoutineSessions.slice(0, 1);
  }, [activeCategory, effectiveRoutineSessions, selectedRoutineSessionId]);

  const routineEntries = useMemo<RoutineEntry[]>(() => {
    if (activeCategory !== "rutina") return [];

    if (hasWeekPlanRoutine && selectedRoutineWeek && selectedRoutineDay) {
      const linkedSession = selectedRoutineDay.sesionId ? sessionsById.get(selectedRoutineDay.sesionId) || null : null;
      const linked = linkedSession
        ? resolveRoutineBlocksForSession(linkedSession, matchIdentityName)
        : { prescripcion: null, blocks: [] as RoutineBlock[] };
      const dayBlocks = buildRoutineBlocksFromDayTraining(selectedRoutineDay.entrenamiento);
      const blocks = dayBlocks.length > 0 ? dayBlocks : linked.blocks;

      const sessionId =
        String(linkedSession?.id || selectedRoutineDay.sesionId || "").trim() ||
        `${selectedRoutineWeek.id}-${selectedRoutineDay.id}`;
      const sessionTitle =
        String(
          linkedSession?.titulo ||
            selectedRoutineDay.planificacion ||
            selectedRoutineDay.dia ||
            selectedRoutineWeek.nombre ||
            "Sesion"
        ).trim() || "Sesion";

      const syntheticSession: Sesion = {
        id: sessionId,
        titulo: sessionTitle,
        objetivo:
          String(selectedRoutineDay.objetivo || linkedSession?.objetivo || selectedRoutineWeek.objetivo || "").trim() ||
          "Entrenamiento asignado",
        duracion: String(selectedRoutineDay.entrenamiento?.duracion || linkedSession?.duracion || "45 min").trim(),
        equipo: String(linkedSession?.equipo || "Entrenamiento").trim() || "Entrenamiento",
        asignacionTipo: "alumnos",
        alumnoAsignado: profileName,
        bloques: blocks,
        prescripciones: linkedSession?.prescripciones,
      };

      const totalExercises = blocks.reduce((count, block) => count + block.ejercicios.length, 0);

      return [
        {
          sesion: syntheticSession,
          prescripcion: linked.prescripcion,
          blocks,
          totalExercises,
          weekId: selectedRoutineWeek.id,
          weekName: selectedRoutineWeek.nombre,
          dayId: selectedRoutineDay.id,
          dayName: selectedRoutineDay.dia,
          source: "week-plan",
        },
      ];
    }

    return routineSessionsForDetails.map((sesion) => {
      const { prescripcion, blocks } = resolveRoutineBlocksForSession(sesion, matchIdentityName);

      const totalExercises = blocks.reduce((count, block) => count + block.ejercicios.length, 0);

      return {
        sesion,
        prescripcion,
        blocks,
        totalExercises,
        source: "session" as const,
      };
    });
  }, [
    activeCategory,
    hasWeekPlanRoutine,
    matchIdentityName,
    profileName,
    routineSessionsForDetails,
    selectedRoutineDay,
    selectedRoutineWeek,
    sessionsById,
  ]);

  useEffect(() => {
    if (activeCategory !== "rutina" || !isUltraMobile) return;

    const firstEntry = routineEntries[0];
    const firstBlock = firstEntry?.blocks?.[0];

    if (!firstEntry || !firstBlock) return;

    const firstBlockKey = `${firstEntry.sesion.id}-${firstBlock.id}`;

    setExpandedRoutineBlocks((previous) => {
      if (Object.keys(previous).length > 0) {
        return previous;
      }

      return {
        [firstBlockKey]: true,
      };
    });
  }, [activeCategory, isUltraMobile, routineEntries]);

  const loadStorageState = useCallback(() => {
    const clienteMetaRowsShared = coerceRowsFromUnknown<ClienteMetaLite>(clientesMetaSharedRaw);
    const clienteMetaRows =
      clienteMetaRowsShared.length > 0
        ? clienteMetaRowsShared
        : readArrayFromStorage<ClienteMetaLite>(CLIENTE_META_KEY);
    const matchedMeta =
      clienteMetaRows.find(
        (row) =>
          matchIdentityEmail(row.email) ||
          matchIdentityName(row.nombre)
      ) || null;
    setClientMeta(matchedMeta);

    if (shouldLoadNutritionData) {
      const plansShared = coerceRowsFromUnknown<NutritionPlanLite>(nutritionPlansSharedRaw);
      const plans =
        plansShared.length > 0
          ? plansShared
          : readArrayFromStorage<NutritionPlanLite>(NUTRITION_PLANS_KEY);
      const assignmentRowsShared = coerceRowsFromUnknown<unknown>(nutritionAssignmentsSharedRaw);
      const assignments = normalizeNutritionAssignmentRows(
        assignmentRowsShared.length > 0
          ? assignmentRowsShared
          : readArrayFromStorage<unknown>(NUTRITION_ASSIGNMENTS_KEY)
      ).sort((a, b) => getTimestamp(b.assignedAt) - getTimestamp(a.assignedAt));

      const matchedAssignment = assignments.find(
        (item) =>
          matchIdentityName(item.alumnoNombre) ||
          matchIdentityEmail(item.alumnoEmail)
      );

      let matchedPlan: NutritionPlanLite | null = null;
      let assignedAt: string | null = matchedAssignment?.assignedAt || null;

      if (matchedAssignment?.planId) {
        matchedPlan = plans.find((plan) => plan.id === matchedAssignment.planId) || null;
      }

      if (!matchedPlan) {
        matchedPlan =
          plans.find((plan) => matchIdentityName(plan.alumnoAsignado)) ||
          plans.find((plan) => String(plan.alumnoAsignado || "").trim() === "") ||
          null;

        if (!matchedAssignment) {
          assignedAt = matchedPlan?.updatedAt || null;
        }
      }

      setNutritionPlan(matchedPlan);
      setNutritionAssignedAt(assignedAt);
    }

    if (shouldLoadAnthropometryData) {
      const anthropometryRows = readArrayFromStorage<AnthropometryEntryLite>(ANTHROPOMETRY_KEY)
        .filter((item) => matchIdentityName(item.alumnoNombre))
        .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
      setAnthropometryEntries(anthropometryRows);
    }
  }, [
    clientesMetaSharedRaw,
    matchIdentityEmail,
    matchIdentityName,
    nutritionAssignmentsSharedRaw,
    nutritionPlansSharedRaw,
    shouldLoadAnthropometryData,
    shouldLoadNutritionData,
  ]);

  const scheduleStorageRefresh = useCallback(() => {
    if (typeof window === "undefined") return;

    if (isUltraMobile) {
      const now = Date.now();
      if (now - lastStorageRefreshTsRef.current < ULTRA_MOBILE_STORAGE_REFRESH_MS) return;
      lastStorageRefreshTsRef.current = now;
    }

    const idleApi = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (storageRefreshRafRef.current !== null) {
      window.cancelAnimationFrame(storageRefreshRafRef.current);
      storageRefreshRafRef.current = null;
    }

    if (storageRefreshIdleRef.current !== null && idleApi.cancelIdleCallback) {
      idleApi.cancelIdleCallback(storageRefreshIdleRef.current);
      storageRefreshIdleRef.current = null;
    }

    if (isUltraMobile && idleApi.requestIdleCallback) {
      storageRefreshIdleRef.current = idleApi.requestIdleCallback(
        () => {
          storageRefreshIdleRef.current = null;
          loadStorageState();
        },
        { timeout: 900 }
      );
      return;
    }

    storageRefreshRafRef.current = window.requestAnimationFrame(() => {
      storageRefreshRafRef.current = null;
      loadStorageState();
    });
  }, [isUltraMobile, loadStorageState]);

  useEffect(() => {
    loadStorageState();
  }, [loadStorageState]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isUltraMobile && activeCategory !== "progreso") {
      return;
    }

    const clockId = window.setInterval(() => {
      setNowTs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(clockId);
    };
  }, [activeCategory, isUltraMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const trackedKeys = new Set<string>([CLIENTE_META_KEY]);
    const trackKey = (storageKey: string) => {
      trackedKeys.add(storageKey);
      trackedKeys.add(`${LOCAL_SYNC_CACHE_PREFIX}${storageKey}`);
    };

    trackKey(CLIENTE_META_KEY);

    if (shouldLoadNutritionData) {
      trackKey(NUTRITION_PLANS_KEY);
      trackKey(NUTRITION_ASSIGNMENTS_KEY);
      trackKey(NUTRITION_FAVORITES_KEY);
      trackKey(NUTRITION_CUSTOM_FOODS_KEY);
      trackKey(NUTRITION_DAILY_LOGS_KEY);
      trackKey(NUTRITION_VARIATION_REQUESTS_KEY);
    }

    if (shouldLoadAnthropometryData) {
      trackKey(ANTHROPOMETRY_KEY);
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || trackedKeys.has(event.key)) {
        scheduleStorageRefresh();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleStorageRefresh();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", scheduleStorageRefresh);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", scheduleStorageRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);

      if (storageRefreshRafRef.current !== null) {
        window.cancelAnimationFrame(storageRefreshRafRef.current);
        storageRefreshRafRef.current = null;
      }

      const idleApi = window as unknown as {
        cancelIdleCallback?: (handle: number) => void;
      };

      if (storageRefreshIdleRef.current !== null && idleApi.cancelIdleCallback) {
        idleApi.cancelIdleCallback(storageRefreshIdleRef.current);
        storageRefreshIdleRef.current = null;
      }
    };
  }, [
    scheduleStorageRefresh,
    shouldLoadAnthropometryData,
    shouldLoadNutritionData,
  ]);

  const nutritionTargets = nutritionPlan?.targets || null;

  const macroRows = useMemo(() => {
    const proteins = toNumber(nutritionTargets?.proteinas) || 0;
    const carbs = toNumber(nutritionTargets?.carbohidratos) || 0;
    const fats = toNumber(nutritionTargets?.grasas) || 0;
    const kcal = proteins * 4 + carbs * 4 + fats * 9;
    const safeTotal = kcal > 0 ? kcal : 1;

    return [
      {
        key: "P",
        label: "Proteinas",
        grams: proteins,
        ratio: Math.round((proteins * 4 * 100) / safeTotal),
      },
      {
        key: "C",
        label: "Carbohidratos",
        grams: carbs,
        ratio: Math.round((carbs * 4 * 100) / safeTotal),
      },
      {
        key: "F",
        label: "Grasas",
        grams: fats,
        ratio: Math.round((fats * 9 * 100) / safeTotal),
      },
    ];
  }, [nutritionTargets?.carbohidratos, nutritionTargets?.grasas, nutritionTargets?.proteinas]);

  const nutritionWeeks = useMemo<NutritionPlanWeekLite[]>(() => {
    const rawWeeks = Array.isArray(nutritionPlan?.semanas) ? nutritionPlan?.semanas : [];
    const normalized = (rawWeeks || []).map((week, weekIndex) => {
      const weekId = String(week?.id || `week-${weekIndex + 1}`).trim() || `week-${weekIndex + 1}`;
      const weekName = String(week?.nombre || `Semana ${weekIndex + 1}`).trim() || `Semana ${weekIndex + 1}`;
      const rawDays = Array.isArray(week?.dias) ? week?.dias : [];
      const dias = (rawDays || []).map((day, dayIndex) => {
        const dayId = String(day?.id || `${weekId}-day-${dayIndex + 1}`).trim() || `${weekId}-day-${dayIndex + 1}`;
        const dayName = String(day?.nombre || `Día ${dayIndex + 1}`).trim() || `Día ${dayIndex + 1}`;
        const comidas = Array.isArray(day?.comidas) ? day?.comidas : [];
        return { id: dayId, nombre: dayName, comidas: comidas as NutritionMeal[] };
      });
      return { id: weekId, nombre: weekName, dias };
    });
    return normalized.filter((week) => Array.isArray(week.dias) && week.dias.length > 0);
  }, [nutritionPlan?.semanas]);

  const hasRealNutritionWeeks = nutritionWeeks.length > 0;

  // Always present at least one virtual "Semana 1 / Día 1" so the navigator
  // is visible like in training, even for legacy plans without semanas.
  const nutritionWeeksDisplay = useMemo<NutritionPlanWeekLite[]>(() => {
    if (hasRealNutritionWeeks) return nutritionWeeks;
    const legacyComidas = Array.isArray(nutritionPlan?.comidas)
      ? (nutritionPlan?.comidas as NutritionMeal[])
      : [];
    return [
      {
        id: "virtual-week-1",
        nombre: "Semana 1",
        dias: [{ id: "virtual-day-1", nombre: "Día 1", comidas: legacyComidas }],
      },
    ];
  }, [hasRealNutritionWeeks, nutritionWeeks, nutritionPlan?.comidas]);

  const activeNutritionWeek = useMemo(() => {
    if (nutritionWeeksDisplay.length === 0) return null;
    const targetId = selectedNutritionWeekId || nutritionWeeksDisplay[0]?.id || null;
    return nutritionWeeksDisplay.find((week) => week.id === targetId) || nutritionWeeksDisplay[0] || null;
  }, [nutritionWeeksDisplay, selectedNutritionWeekId]);

  const activeNutritionDay = useMemo(() => {
    if (!activeNutritionWeek) return null;
    const days = Array.isArray(activeNutritionWeek.dias) ? activeNutritionWeek.dias : [];
    if (days.length === 0) return null;
    const targetId = selectedNutritionDayId || days[0]?.id || null;
    return days.find((day) => day?.id === targetId) || days[0] || null;
  }, [activeNutritionWeek, selectedNutritionDayId]);

  useEffect(() => {
    if (nutritionWeeksDisplay.length === 0) return;
    const weekValid = nutritionWeeksDisplay.some((week) => week.id === selectedNutritionWeekId);
    if (!weekValid) {
      const fallback = nutritionWeeksDisplay[0];
      setSelectedNutritionWeekId(fallback?.id || null);
      setSelectedNutritionDayId(fallback?.dias?.[0]?.id || null);
      return;
    }
    const weekDays = nutritionWeeksDisplay.find((week) => week.id === selectedNutritionWeekId)?.dias || [];
    const dayValid = weekDays.some((day) => day?.id === selectedNutritionDayId);
    if (!dayValid) {
      setSelectedNutritionDayId(weekDays[0]?.id || null);
    }
  }, [nutritionWeeksDisplay, selectedNutritionDayId, selectedNutritionWeekId]);

  const nutritionActiveMeals = useMemo<NutritionMeal[]>(() => {
    if (activeNutritionDay) {
      return Array.isArray(activeNutritionDay.comidas) ? activeNutritionDay.comidas : [];
    }
    return Array.isArray(nutritionPlan?.comidas) ? (nutritionPlan?.comidas as NutritionMeal[]) : [];
  }, [activeNutritionDay, nutritionPlan?.comidas]);

  const nutritionMealsDetailed = useMemo(() => {
    const meals = nutritionActiveMeals;

    return meals.map((meal, index) => {
      const mealId = String(meal.id || `meal-${index + 1}`).trim() || `meal-${index + 1}`;
      const mealItems = Array.isArray(meal.items) ? meal.items : [];

      const items = mealItems.map((item, itemIndex) => {
        const foodId = String(item.foodId || "").trim();
        const food = foodId ? nutritionFoodsById.get(foodId) : undefined;
        const grams = toNumber(item.gramos);
        const safeGrams = Math.max(0, grams || 0);
        const kcalPer100g = Math.max(0, toNumber(food?.kcalPer100g) || 0);
        const proteinPer100g = Math.max(0, toNumber(food?.proteinPer100g) || 0);
        const carbsPer100g = Math.max(0, toNumber(food?.carbsPer100g) || 0);
        const fatPer100g = Math.max(0, toNumber(food?.fatPer100g) || 0);
        const calories = roundToOneDecimal((kcalPer100g * safeGrams) / 100);
        const protein = roundToOneDecimal((proteinPer100g * safeGrams) / 100);
        const carbs = roundToOneDecimal((carbsPer100g * safeGrams) / 100);
        const fat = roundToOneDecimal((fatPer100g * safeGrams) / 100);
        const imageUrls = resolveNutritionImageUrls([
          item.imageUrl,
          item.imagenUrl,
          item.photoUrl,
          item.fotoUrl,
          item.thumbnailUrl,
          item.coverUrl,
          item.artworkUrl,
          food?.imageUrl,
          food?.imagenUrl,
          food?.photoUrl,
          food?.fotoUrl,
          food?.thumbnailUrl,
          food?.coverUrl,
          food?.artworkUrl,
        ]);
        const imageUrl = imageUrls[0] || null;

        return {
          id: String(item.id || `${mealId}-item-${itemIndex + 1}`).trim() || `${mealId}-item-${itemIndex + 1}`,
          label: String(item.nombre || food?.nombre || foodId || `Item ${itemIndex + 1}`).trim() || `Item ${itemIndex + 1}`,
          foodId: foodId || undefined,
          grams,
          calories,
          protein,
          carbs,
          fat,
          imageUrl,
          imageUrls,
        };
      });

      const totalKcal = roundToOneDecimal(items.reduce((total, item) => total + item.calories, 0));
      const totalProtein = roundToOneDecimal(items.reduce((total, item) => total + item.protein, 0));
      const totalCarbs = roundToOneDecimal(items.reduce((total, item) => total + item.carbs, 0));
      const totalFat = roundToOneDecimal(items.reduce((total, item) => total + item.fat, 0));
      const galleryUrls = resolveNutritionImageUrls([
        meal.imageUrl,
        meal.imagenUrl,
        meal.photoUrl,
        meal.fotoUrl,
        meal.thumbnailUrl,
        meal.coverUrl,
        meal.artworkUrl,
        ...items.flatMap((item) => item.imageUrls),
      ]);
      const imageUrl = galleryUrls[0] || null;

      return {
        mealId,
        mealName: String(meal.nombre || `Comida ${index + 1}`).trim() || `Comida ${index + 1}`,
        totalKcal,
        totalProtein,
        totalCarbs,
        totalFat,
        imageUrl,
        galleryUrls,
        items,
      };
    });
  }, [nutritionActiveMeals, nutritionFoodsById]);

  const nutritionPlanCaloriesFromMeals = useMemo(
    () => roundToOneDecimal(nutritionMealsDetailed.reduce((total, meal) => total + meal.totalKcal, 0)),
    [nutritionMealsDetailed]
  );

  const nutritionQuickReplacementCandidate = useMemo(() => {
    for (const meal of nutritionMealsDetailed) {
      const itemIndex = meal.items.findIndex((item) => Math.max(0, toNumber(item.calories) || 0) > 0);
      if (itemIndex < 0) {
        continue;
      }

      const item = meal.items[itemIndex];
      if (!item) {
        continue;
      }

      return {
        mealId: meal.mealId,
        mealName: meal.mealName,
        itemId: String(item.id || `${meal.mealId}-${itemIndex}`),
        label: item.label,
        foodId: item.foodId,
        grams: item.grams,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      };
    }

    return null;
  }, [nutritionMealsDetailed]);

  const nutritionPlanMacrosFromMeals = useMemo(
    () => ({
      proteinas: roundToOneDecimal(nutritionMealsDetailed.reduce((total, meal) => total + meal.totalProtein, 0)),
      carbohidratos: roundToOneDecimal(nutritionMealsDetailed.reduce((total, meal) => total + meal.totalCarbs, 0)),
      grasas: roundToOneDecimal(nutritionMealsDetailed.reduce((total, meal) => total + meal.totalFat, 0)),
    }),
    [nutritionMealsDetailed]
  );

  const nutritionDailyGoalKcal = useMemo(() => {
    const targetKcal = toNumber(nutritionTargets?.calorias);
    if (targetKcal !== null && targetKcal > 0) {
      return targetKcal;
    }

    return nutritionPlanCaloriesFromMeals;
  }, [nutritionPlanCaloriesFromMeals, nutritionTargets?.calorias]);

  const nutritionDailyGoalMacros = useMemo(
    () => ({
      proteinas: Math.max(0, toNumber(nutritionTargets?.proteinas) || nutritionPlanMacrosFromMeals.proteinas),
      carbohidratos: Math.max(0, toNumber(nutritionTargets?.carbohidratos) || nutritionPlanMacrosFromMeals.carbohidratos),
      grasas: Math.max(0, toNumber(nutritionTargets?.grasas) || nutritionPlanMacrosFromMeals.grasas),
    }),
    [
      nutritionPlanMacrosFromMeals.carbohidratos,
      nutritionPlanMacrosFromMeals.grasas,
      nutritionPlanMacrosFromMeals.proteinas,
      nutritionTargets?.carbohidratos,
      nutritionTargets?.grasas,
      nutritionTargets?.proteinas,
    ]
  );

  const nutritionPlanMealSchedule = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ label: string; minutes: number }> = [];

    nutritionMealsDetailed.forEach((meal) => {
      const name = String(meal.mealName || "");
      const match = name.match(/(\d{1,2}:\d{2})/);
      const value = String(match?.[1] || "").trim();
      if (!value || seen.has(value)) {
        return;
      }

      const [hourRaw, minuteRaw] = value.split(":");
      const hour = Number.parseInt(hourRaw || "", 10);
      const minute = Number.parseInt(minuteRaw || "", 10);

      if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
        return;
      }

      seen.add(value);
      rows.push({
        label: value,
        minutes: hour * 60 + minute,
      });
    });

    return rows
      .sort((a, b) => a.minutes - b.minutes)
      .map((item) => item.label);
  }, [nutritionMealsDetailed]);

  const nutritionPlanTrainingSplit = useMemo(() => {
    const notes = String(nutritionPlan?.notas || "");
    if (!notes) {
      return null;
    }

    const match = notes.match(/(\d+)\s*dias?\s*con\s*entrenamiento.*?(\d+)\s*dias?\s*sin\s*entrenamiento/i);
    if (!match) {
      return null;
    }

    const trainingDays = Number.parseInt(match[1] || "", 10);
    const restDays = Number.parseInt(match[2] || "", 10);

    if (!Number.isFinite(trainingDays) || !Number.isFinite(restDays)) {
      return null;
    }

    return {
      trainingDays,
      restDays,
    };
  }, [nutritionPlan?.notas]);

  const nutritionPlanGuideRows = useMemo(() => {
    if (!nutritionPlan || nutritionMealsDetailed.length === 0) {
      return [];
    }

    const mealsByKcal = [...nutritionMealsDetailed].sort((a, b) => b.totalKcal - a.totalKcal);
    const mealsByProtein = [...nutritionMealsDetailed].sort((a, b) => b.totalProtein - a.totalProtein);
    const heaviestMeal = mealsByKcal[0] || null;
    const lightestMeal = mealsByKcal[mealsByKcal.length - 1] || null;
    const highestProteinMeal = mealsByProtein[0] || null;
    const kcalDelta = roundToOneDecimal(nutritionPlanCaloriesFromMeals - nutritionDailyGoalKcal);

    return [
      {
        label: "Comida más fuerte",
        value: heaviestMeal ? `${heaviestMeal.mealName} · ${heaviestMeal.totalKcal} kcal` : "-",
      },
      {
        label: "Comida más liviana",
        value: lightestMeal ? `${lightestMeal.mealName} · ${lightestMeal.totalKcal} kcal` : "-",
      },
      {
        label: "Mayor proteína",
        value: highestProteinMeal
          ? `${highestProteinMeal.mealName} · ${highestProteinMeal.totalProtein} g`
          : "-",
      },
      {
        label: "Balance del plan",
        value:
          Math.abs(kcalDelta) <= 80
            ? "Calorías bien alineadas"
            : kcalDelta > 0
              ? `Plan por encima (+${kcalDelta} kcal)`
              : `Plan por debajo (${kcalDelta} kcal)`,
      },
    ];
  }, [
    nutritionDailyGoalKcal,
    nutritionMealsDetailed,
    nutritionPlan,
    nutritionPlanCaloriesFromMeals,
  ]);

  const nutritionSelectedDayLog = useMemo(() => {
    return nutritionDailyLogs.find((row) => row.date === normalizedNutritionTrackerDate) || null;
  }, [nutritionDailyLogs, normalizedNutritionTrackerDate]);

  const nutritionDayMealLogById = useMemo(() => {
    const map = new Map<string, NutritionDailyMealLogLite>();
    (nutritionSelectedDayLog?.mealLogs || []).forEach((row) => {
      const mealId = String(row.mealId || "").trim();
      if (!mealId) return;
      map.set(mealId, row);
    });
    return map;
  }, [nutritionSelectedDayLog?.mealLogs]);

  const nutritionSelectedDayCustomFoods = useMemo(() => {
    const rows = Array.isArray(nutritionSelectedDayLog?.customFoods)
      ? nutritionSelectedDayLog.customFoods
      : [];

    return [...rows].sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
  }, [nutritionSelectedDayLog?.customFoods]);

  const nutritionCustomFoodsByMealId = useMemo(() => {
    const map = new Map<string, NutritionDailyCustomFoodLite[]>();

    nutritionSelectedDayCustomFoods.forEach((entry) => {
      const mealId = String(entry.mealId || "").trim();
      if (!mealId) {
        return;
      }

      const current = map.get(mealId) || [];
      current.push(entry);
      map.set(mealId, current);
    });

    return map;
  }, [nutritionSelectedDayCustomFoods]);

  const nutritionDiaryMealRows = useMemo(() => {
    const hasPlanMeals = nutritionMealsDetailed.length > 0;

    const baseRows = hasPlanMeals
      ? nutritionMealsDetailed.map((meal) => {
          const normalizedName = normalizePersonKey(meal.mealName);
          let fallbackIcon = "ME";
          if (normalizedName.includes("desay")) fallbackIcon = "DS";
          else if (normalizedName.includes("almuer") || normalizedName.includes("comida")) fallbackIcon = "AL";
          else if (normalizedName.includes("cena")) fallbackIcon = "CN";
          else if (normalizedName.includes("snack") || normalizedName.includes("colaci")) fallbackIcon = "SK";

          return {
            mealId: meal.mealId,
            mealName: meal.mealName,
            icon: fallbackIcon,
            goalKcal: meal.totalKcal,
          };
        })
      : DEFAULT_NUTRITION_MEAL_DISTRIBUTION.map((item) => ({
          mealId: item.mealId,
          mealName: item.mealName,
          icon: item.icon,
          goalKcal: roundToOneDecimal(Math.max(0, nutritionDailyGoalKcal * item.goalRatio)),
        }));

    return baseRows.map((row) => {
      const planMeal = nutritionMealsDetailed.find((meal) => meal.mealId === row.mealId);
      const mealLog = nutritionDayMealLogById.get(row.mealId);
      const consumedFromPlan = mealLog?.done
        ? Math.max(0, toNumber(mealLog.consumedKcal) || planMeal?.totalKcal || 0)
        : 0;

      const mealEntries = (nutritionCustomFoodsByMealId.get(row.mealId) || []).slice().sort((left, right) => {
        return getTimestamp(right.createdAt) - getTimestamp(left.createdAt);
      });

      const consumedFromEntries = mealEntries.reduce((sum, entry) => {
        return sum + Math.max(0, toNumber(entry.calorias) || 0);
      }, 0);

      const consumedKcal = roundToOneDecimal(consumedFromPlan + consumedFromEntries);
      const goalKcal = Math.max(0, roundToOneDecimal(row.goalKcal || 0));
      const previewText = mealEntries
        .slice(0, 3)
        .map((entry) => entry.nombre)
        .filter(Boolean)
        .join(", ");

      return {
        ...row,
        consumedKcal,
        goalKcal,
        mealEntries,
        previewText,
      };
    });
  }, [
    nutritionCustomFoodsByMealId,
    nutritionDailyGoalKcal,
    nutritionDayMealLogById,
    nutritionMealsDetailed,
  ]);

  const nutritionActiveMealComposer = useMemo(() => {
    if (!nutritionMealComposerMealId) {
      return null;
    }

    return nutritionDiaryMealRows.find((row) => row.mealId === nutritionMealComposerMealId) || null;
  }, [nutritionDiaryMealRows, nutritionMealComposerMealId]);

  useEffect(() => {
    if (nutritionMealsDetailed.length === 0) {
      setNutritionVariationMealId("");
      return;
    }

    setNutritionVariationMealId((previous) => {
      if (previous && nutritionMealsDetailed.some((meal) => meal.mealId === previous)) {
        return previous;
      }

      return nutritionMealsDetailed[0]?.mealId || "";
    });
  }, [nutritionMealsDetailed]);

  useEffect(() => {
    setNutritionReplacementByItemKey({});
  }, [nutritionPlan?.id, nutritionPlan?.updatedAt]);

  const submitNutritionVariationRequest = useCallback(() => {
    if (!nutritionPlan?.id) {
      setNutritionVariationStatus("No hay un plan activo para enviar solicitud.");
      return;
    }

    const cleanMessage = String(nutritionVariationDraft || "").trim();
    if (cleanMessage.length < 8) {
      setNutritionVariationStatus("Describe la variacion con al menos 8 caracteres.");
      return;
    }

    const selectedMeal = nutritionMealsDetailed.find((meal) => meal.mealId === nutritionVariationMealId) || null;
    const nowIso = new Date().toISOString();

    const payload: NutritionVariationRequestLite = {
      id: `nutrition-variation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      alumnoNombre: profileName || undefined,
      alumnoEmail: profileEmail || undefined,
      planId: nutritionPlan.id,
      mealId: selectedMeal?.mealId || undefined,
      mealName: selectedMeal?.mealName || "Plan general",
      message: cleanMessage.slice(0, 280),
      createdAt: nowIso,
    };

    markManualSaveIntent(NUTRITION_VARIATION_REQUESTS_KEY);
    setNutritionVariationRequestsRaw((previous) => [
      payload,
      ...normalizeNutritionVariationRequestRows(previous),
    ]);

    setNutritionVariationDraft("");
    setNutritionVariationStatus("Solicitud enviada al profesor.");
  }, [
    nutritionPlan?.id,
    nutritionVariationDraft,
    nutritionMealsDetailed,
    nutritionVariationMealId,
    profileEmail,
    profileName,
    setNutritionVariationRequestsRaw,
  ]);

  const generateNutritionReplacementForPlanItem = useCallback(
    (input: {
      mealId: string;
      mealName: string;
      itemId: string;
      label: string;
      foodId?: string;
      grams: number | null;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }) => {
      const sourceCalories = Math.max(0, roundToOneDecimal(toNumber(input.calories) || 0));
      if (!Number.isFinite(sourceCalories) || sourceCalories <= 0) {
        setNutritionVariationStatus("No se pudo calcular reemplazo para este alimento.");
        return;
      }

      const sourceProtein = Math.max(0, roundToOneDecimal(toNumber(input.protein) || 0));
      const sourceCarbs = Math.max(0, roundToOneDecimal(toNumber(input.carbs) || 0));
      const sourceFat = Math.max(0, roundToOneDecimal(toNumber(input.fat) || 0));
      const sourceGrams = Math.max(1, roundToOneDecimal(toNumber(input.grams) || 100));
      const sourceFoodId = String(input.foodId || "").trim();
      const normalizedSourceLabel = normalizePersonKey(input.label);

      const candidates = nutritionCatalogFoods
        .filter((food) => {
          const candidateFoodId = String(food.id || "").trim();
          if (!candidateFoodId) {
            return false;
          }

          if (sourceFoodId && candidateFoodId === sourceFoodId) {
            return false;
          }

          const candidateKcalPer100g = Math.max(0, toNumber(food.kcalPer100g) || 0);
          if (candidateKcalPer100g <= 0) {
            return false;
          }

          const normalizedFoodName = normalizePersonKey(food.nombre);
          if (!normalizedFoodName || !normalizedSourceLabel) {
            return true;
          }

          if (
            normalizedFoodName === normalizedSourceLabel ||
            normalizedFoodName.includes(normalizedSourceLabel) ||
            normalizedSourceLabel.includes(normalizedFoodName)
          ) {
            return false;
          }

          return true;
        })
        .map((food) => {
          const kcalPer100g = Math.max(1, toNumber(food.kcalPer100g) || 1);
          const replacementGrams = Math.max(10, roundToOneDecimal((sourceCalories * 100) / kcalPer100g));
          const replacementCalories = roundToOneDecimal((kcalPer100g * replacementGrams) / 100);
          const replacementProtein = roundToOneDecimal(
            (Math.max(0, toNumber(food.proteinPer100g) || 0) * replacementGrams) / 100
          );
          const replacementCarbs = roundToOneDecimal(
            (Math.max(0, toNumber(food.carbsPer100g) || 0) * replacementGrams) / 100
          );
          const replacementFat = roundToOneDecimal(
            (Math.max(0, toNumber(food.fatPer100g) || 0) * replacementGrams) / 100
          );
          const calorieGap = Math.abs(replacementCalories - sourceCalories);
          const macroGap =
            Math.abs(replacementProtein - sourceProtein) +
            Math.abs(replacementCarbs - sourceCarbs) +
            Math.abs(replacementFat - sourceFat);
          const gramsGapPenalty = Math.abs(replacementGrams - sourceGrams) * 0.04;
          const rangePenalty =
            replacementGrams > 450
              ? (replacementGrams - 450) * 0.4
              : replacementGrams < 20
                ? (20 - replacementGrams) * 0.6
                : 0;
          const score = calorieGap * 2.4 + macroGap * 0.55 + gramsGapPenalty + rangePenalty;

          return {
            replacementFoodId: String(food.id || "").trim(),
            replacementLabel: String(food.nombre || "").trim() || "Alimento alternativo",
            replacementCalories,
            replacementProtein,
            replacementCarbs,
            replacementFat,
            replacementGrams,
            score,
            calorieGap,
          };
        })
        .sort((left, right) => {
          if (left.score !== right.score) {
            return left.score - right.score;
          }

          if (left.calorieGap !== right.calorieGap) {
            return left.calorieGap - right.calorieGap;
          }

          return left.replacementLabel.localeCompare(right.replacementLabel);
        });

      const best = candidates[0];
      if (!best) {
        setNutritionVariationStatus("No encontramos alternativas equivalentes ahora.");
        return;
      }

      const key = `${input.mealId}::${input.itemId}`;

      setNutritionReplacementByItemKey((previous) => ({
        ...previous,
        [key]: {
          key,
          mealId: input.mealId,
          mealName: input.mealName,
          sourceItemId: input.itemId,
          sourceItemLabel: input.label,
          sourceCalories,
          sourceProtein,
          sourceCarbs,
          sourceFat,
          replacementFoodId: best.replacementFoodId,
          replacementLabel: best.replacementLabel,
          replacementCalories: best.replacementCalories,
          replacementProtein: best.replacementProtein,
          replacementCarbs: best.replacementCarbs,
          replacementFat: best.replacementFat,
          replacementGrams: best.replacementGrams,
          generatedAt: new Date().toISOString(),
        },
      }));

      setNutritionVariationStatus(`Reemplazo equivalente generado para ${input.label}.`);
    },
    [nutritionCatalogFoods]
  );

  const focusNutritionPlanActions = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      nutritionPlanActionsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }, []);

  const openNutritionVariationActions = useCallback(() => {
    if (!nutritionPlan?.id) {
      setNutritionVariationStatus("No hay un plan activo para enviar solicitud.");
      return;
    }

    setNutritionVariationStatus("Completa el motivo y envia la solicitud.");
    focusNutritionPlanActions();
  }, [focusNutritionPlanActions, nutritionPlan?.id]);

  const triggerQuickNutritionReplacement = useCallback(() => {
    if (!nutritionQuickReplacementCandidate) {
      setNutritionVariationStatus("No hay alimentos con calorias para sugerir reemplazo.");
      return;
    }

    generateNutritionReplacementForPlanItem(nutritionQuickReplacementCandidate);
    focusNutritionPlanActions();
  }, [
    focusNutritionPlanActions,
    generateNutritionReplacementForPlanItem,
    nutritionQuickReplacementCandidate,
  ]);

  const nutritionEstimatedBurnedKcal = useMemo(() => {
    const selectedDayLogs = workoutLogs.filter((row) => {
      const dateValue = normalizeDateInputValue(row.fecha || row.createdAt || "");
      return dateValue === normalizedNutritionTrackerDate;
    });

    if (selectedDayLogs.length === 0) {
      return 0;
    }

    return roundToOneDecimal(selectedDayLogs.length * 45);
  }, [normalizedNutritionTrackerDate, workoutLogs]);

  const nutritionNormalizedSearchQuery = useMemo(
    () => normalizePersonKey(nutritionFoodSearchQuery),
    [nutritionFoodSearchQuery]
  );

  const nutritionLocalSearchResults = useMemo(() => {
    const rawQuery = String(nutritionFoodSearchQuery || "").trim().toLowerCase();

    const filtered = nutritionCatalogFoods.filter((food) => {
      if (!nutritionNormalizedSearchQuery) {
        return nutritionFavoriteFoodIds.has(food.id);
      }

      const normalizedName = normalizePersonKey(food.nombre);
      const barcode = String(food.barcode || "").trim().toLowerCase();
      const normalizedId = normalizePersonKey(food.id);

      return (
        normalizedName.includes(nutritionNormalizedSearchQuery) ||
        normalizedId.includes(nutritionNormalizedSearchQuery) ||
        (barcode && barcode.includes(rawQuery))
      );
    });

    return filtered
      .sort((left, right) => {
        const leftFav = nutritionFavoriteFoodIds.has(left.id) ? 1 : 0;
        const rightFav = nutritionFavoriteFoodIds.has(right.id) ? 1 : 0;
        if (leftFav !== rightFav) {
          return rightFav - leftFav;
        }

        return left.nombre.localeCompare(right.nombre);
      })
      .slice(0, nutritionNormalizedSearchQuery ? 36 : 12);
  }, [nutritionCatalogFoods, nutritionFavoriteFoodIds, nutritionFoodSearchQuery, nutritionNormalizedSearchQuery]);

  const nutritionCombinedSearchResults = useMemo(() => {
    const map = new Map<string, NutritionSearchFoodResult>();

    nutritionLocalSearchResults.forEach((item) => {
      map.set(item.id, item);
    });

    nutritionRemoteSearchResults.forEach((item, index) => {
      const key = String(item.id || "").trim() || `remote-item-${index + 1}`;
      if (map.has(key)) {
        return;
      }

      map.set(key, item);
    });

    return Array.from(map.values()).slice(0, 36);
  }, [nutritionLocalSearchResults, nutritionRemoteSearchResults]);

  const nutritionSelectedDayCustomTotals = useMemo(() => {
    const totals = {
      calorias: 0,
      proteinas: 0,
      carbohidratos: 0,
      grasas: 0,
    };

    nutritionSelectedDayCustomFoods.forEach((entry) => {
      totals.calorias += Math.max(0, toNumber(entry.calorias) || 0);
      totals.proteinas += Math.max(0, toNumber(entry.proteinas) || 0);
      totals.carbohidratos += Math.max(0, toNumber(entry.carbohidratos) || 0);
      totals.grasas += Math.max(0, toNumber(entry.grasas) || 0);
    });

    return {
      calorias: roundToOneDecimal(totals.calorias),
      proteinas: roundToOneDecimal(totals.proteinas),
      carbohidratos: roundToOneDecimal(totals.carbohidratos),
      grasas: roundToOneDecimal(totals.grasas),
    };
  }, [nutritionSelectedDayCustomFoods]);

  const nutritionDailyConsumedKcal = useMemo(() => {
    const mealsKcal = nutritionMealsDetailed.reduce((total, meal) => {
      const mealLog = nutritionDayMealLogById.get(meal.mealId);
      if (!mealLog?.done) {
        return total;
      }

      const consumed = toNumber(mealLog.consumedKcal);
      if (consumed !== null && consumed > 0) {
        return total + consumed;
      }

      return total + meal.totalKcal;
    }, 0);

    return roundToOneDecimal(mealsKcal + nutritionSelectedDayCustomTotals.calorias);
  }, [nutritionDayMealLogById, nutritionMealsDetailed, nutritionSelectedDayCustomTotals.calorias]);

  const nutritionDailyConsumedMacros = useMemo(() => {
    const totals = {
      proteinas: 0,
      carbohidratos: 0,
      grasas: 0,
    };

    nutritionMealsDetailed.forEach((meal) => {
        const mealLog = nutritionDayMealLogById.get(meal.mealId);
        if (!mealLog?.done) {
          return;
        }

      const plannedKcal = Math.max(0, meal.totalKcal);
      const consumedKcal = Math.max(0, toNumber(mealLog.consumedKcal) || 0);
      const effectiveKcal = consumedKcal > 0 ? consumedKcal : plannedKcal;

      let ratio = 0;
      if (plannedKcal > 0) {
        ratio = effectiveKcal / plannedKcal;
      } else if (effectiveKcal > 0) {
        ratio = 1;
      }

      const safeRatio = Math.max(0, Math.min(2.5, ratio));

      totals.proteinas += meal.totalProtein * safeRatio;
      totals.carbohidratos += meal.totalCarbs * safeRatio;
      totals.grasas += meal.totalFat * safeRatio;
    });

    totals.proteinas += nutritionSelectedDayCustomTotals.proteinas;
    totals.carbohidratos += nutritionSelectedDayCustomTotals.carbohidratos;
    totals.grasas += nutritionSelectedDayCustomTotals.grasas;

    return {
      proteinas: roundToOneDecimal(totals.proteinas),
      carbohidratos: roundToOneDecimal(totals.carbohidratos),
      grasas: roundToOneDecimal(totals.grasas),
    };
  }, [
    nutritionDayMealLogById,
    nutritionMealsDetailed,
    nutritionSelectedDayCustomTotals.carbohidratos,
    nutritionSelectedDayCustomTotals.grasas,
    nutritionSelectedDayCustomTotals.proteinas,
  ]);

  const nutritionDailyRemainingKcal = useMemo(
    () => roundToOneDecimal(nutritionDailyGoalKcal - nutritionDailyConsumedKcal),
    [nutritionDailyConsumedKcal, nutritionDailyGoalKcal]
  );

  const nutritionDailyRemainingMacros = useMemo(
    () => ({
      proteinas: roundToOneDecimal(nutritionDailyGoalMacros.proteinas - nutritionDailyConsumedMacros.proteinas),
      carbohidratos: roundToOneDecimal(nutritionDailyGoalMacros.carbohidratos - nutritionDailyConsumedMacros.carbohidratos),
      grasas: roundToOneDecimal(nutritionDailyGoalMacros.grasas - nutritionDailyConsumedMacros.grasas),
    }),
    [
      nutritionDailyConsumedMacros.carbohidratos,
      nutritionDailyConsumedMacros.grasas,
      nutritionDailyConsumedMacros.proteinas,
      nutritionDailyGoalMacros.carbohidratos,
      nutritionDailyGoalMacros.grasas,
      nutritionDailyGoalMacros.proteinas,
    ]
  );

  const nutritionDailyDoneMeals = useMemo(() => {
    return nutritionMealsDetailed.reduce((total, meal) => {
      return total + (nutritionDayMealLogById.get(meal.mealId)?.done ? 1 : 0);
    }, 0);
  }, [nutritionDayMealLogById, nutritionMealsDetailed]);

  const nutritionDailyProgressPct = useMemo(() => {
    if (nutritionDailyGoalKcal <= 0) {
      return 0;
    }

    const raw = (nutritionDailyConsumedKcal * 100) / nutritionDailyGoalKcal;
    return Math.max(0, Math.min(160, Math.round(raw)));
  }, [nutritionDailyConsumedKcal, nutritionDailyGoalKcal]);

  const nutritionDailyProgressRatio = useMemo(() => {
    if (nutritionDailyGoalKcal <= 0) {
      return 0;
    }

    return Math.max(0, nutritionDailyConsumedKcal / nutritionDailyGoalKcal);
  }, [nutritionDailyConsumedKcal, nutritionDailyGoalKcal]);

  const nutritionDailySemiGaugeProgress = useMemo(
    () => Math.max(0, Math.min(1, nutritionDailyProgressRatio)),
    [nutritionDailyProgressRatio]
  );

  const nutritionDailySemiGaugeDashOffset = useMemo(() => {
    return roundToOneDecimal(NUTRITION_KCAL_SEMI_GAUGE_ARC_LENGTH * (1 - nutritionDailySemiGaugeProgress));
  }, [nutritionDailySemiGaugeProgress]);

  const nutritionDailyMacroProgress = useMemo(() => {
    const progressFor = (consumed: number, goal: number) => {
      if (goal <= 0) return 0;
      return Math.max(0, Math.min(180, Math.round((consumed * 100) / goal)));
    };

    return {
      proteinas: progressFor(nutritionDailyConsumedMacros.proteinas, nutritionDailyGoalMacros.proteinas),
      carbohidratos: progressFor(nutritionDailyConsumedMacros.carbohidratos, nutritionDailyGoalMacros.carbohidratos),
      grasas: progressFor(nutritionDailyConsumedMacros.grasas, nutritionDailyGoalMacros.grasas),
    };
  }, [
    nutritionDailyConsumedMacros.carbohidratos,
    nutritionDailyConsumedMacros.grasas,
    nutritionDailyConsumedMacros.proteinas,
    nutritionDailyGoalMacros.carbohidratos,
    nutritionDailyGoalMacros.grasas,
    nutritionDailyGoalMacros.proteinas,
  ]);

  const nutritionMealPlanById = useMemo(() => {
    const map = new Map<
      string,
      {
        kcal: number;
        proteinas: number;
        carbohidratos: number;
        grasas: number;
      }
    >();

    nutritionMealsDetailed.forEach((meal) => {
      map.set(meal.mealId, {
        kcal: meal.totalKcal,
        proteinas: meal.totalProtein,
        carbohidratos: meal.totalCarbs,
        grasas: meal.totalFat,
      });
    });

    return map;
  }, [nutritionMealsDetailed]);

  const getNutritionDaySummary = useCallback(
    (dateInput: string) => {
      const safeDate = normalizeDateInputValue(dateInput);
      const dayLog = nutritionDailyLogs.find((row) => row.date === safeDate) || null;
      const mealLogs = Array.isArray(dayLog?.mealLogs) ? dayLog.mealLogs : [];
      const customFoods = Array.isArray(dayLog?.customFoods) ? dayLog.customFoods : [];

      let doneMeals = 0;
      let customFoodsCount = 0;
      let consumedKcal = 0;
      let consumedProteins = 0;
      let consumedCarbs = 0;
      let consumedFats = 0;

      mealLogs.forEach((mealLog) => {
        if (!mealLog?.done) {
          return;
        }

        doneMeals += 1;

        const mealId = String(mealLog.mealId || "").trim();
        const mealPlan = mealId ? nutritionMealPlanById.get(mealId) : undefined;
        const plannedKcal = Math.max(0, mealPlan?.kcal || 0);
        const loggedKcal = Math.max(0, toNumber(mealLog.consumedKcal) || 0);
        const effectiveKcal = loggedKcal > 0 ? loggedKcal : plannedKcal;

        consumedKcal += effectiveKcal;

        if (!mealPlan) {
          return;
        }

        let ratio = 0;
        if (plannedKcal > 0) {
          ratio = effectiveKcal / plannedKcal;
        } else if (effectiveKcal > 0) {
          ratio = 1;
        }

        const safeRatio = Math.max(0, Math.min(2.5, ratio));
        consumedProteins += mealPlan.proteinas * safeRatio;
        consumedCarbs += mealPlan.carbohidratos * safeRatio;
        consumedFats += mealPlan.grasas * safeRatio;
      });

      customFoods.forEach((entry) => {
        customFoodsCount += 1;
        consumedKcal += Math.max(0, toNumber(entry.calorias) || 0);
        consumedProteins += Math.max(0, toNumber(entry.proteinas) || 0);
        consumedCarbs += Math.max(0, toNumber(entry.carbohidratos) || 0);
        consumedFats += Math.max(0, toNumber(entry.grasas) || 0);
      });

      const clampedDoneMeals = Math.min(doneMeals, nutritionMealsDetailed.length || doneMeals);
      const completionPct =
        nutritionMealsDetailed.length > 0
          ? Math.round((clampedDoneMeals * 100) / nutritionMealsDetailed.length)
          : doneMeals > 0 || customFoodsCount > 0
            ? 100
            : 0;
      const progressKcalPct =
        nutritionDailyGoalKcal > 0
          ? Math.max(0, Math.min(180, Math.round((consumedKcal * 100) / nutritionDailyGoalKcal)))
          : 0;

      let status: "empty" | "low" | "on-target" | "high" = "empty";
      if (doneMeals > 0 || customFoodsCount > 0) {
        if (nutritionDailyGoalKcal <= 0) {
          status = "on-target";
        } else if (progressKcalPct < 85) {
          status = "low";
        } else if (progressKcalPct > 115) {
          status = "high";
        } else {
          status = "on-target";
        }
      }

      return {
        date: safeDate,
        doneMeals: clampedDoneMeals,
        customFoodsCount,
        totalEntries: clampedDoneMeals + customFoodsCount,
        consumedKcal: roundToOneDecimal(consumedKcal),
        consumedMacros: {
          proteinas: roundToOneDecimal(consumedProteins),
          carbohidratos: roundToOneDecimal(consumedCarbs),
          grasas: roundToOneDecimal(consumedFats),
        },
        completionPct,
        progressKcalPct,
        goalKcal: nutritionDailyGoalKcal,
        status,
      };
    },
    [nutritionDailyGoalKcal, nutritionDailyLogs, nutritionMealPlanById, nutritionMealsDetailed.length]
  );

  const nutritionWeekStartDate = useMemo(() => {
    const safeDate = normalizeDateInputValue(normalizedNutritionTrackerDate);
    const parsed = new Date(`${safeDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return safeDate;
    }

    const dayIndex = parsed.getDay();
    const daysFromMonday = dayIndex === 0 ? 6 : dayIndex - 1;
    parsed.setDate(parsed.getDate() - daysFromMonday);

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [normalizedNutritionTrackerDate]);

  const nutritionWeekEndDate = useMemo(
    () => shiftDateInputValue(nutritionWeekStartDate, 6),
    [nutritionWeekStartDate]
  );

  const nutritionWeeklyHistory = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = shiftDateInputValue(nutritionWeekStartDate, index);
      const summary = getNutritionDaySummary(date);
      const parsed = new Date(`${date}T00:00:00`);
      const dayLabel = Number.isNaN(parsed.getTime()) ? "--" : WEEKDAY_SHORT_LABELS[parsed.getDay()] || "--";
      const dayNumber = Number.isNaN(parsed.getTime()) ? index + 1 : parsed.getDate();

      return {
        ...summary,
        date,
        dayLabel,
        dayNumber,
        isSelected: date === normalizedNutritionTrackerDate,
      };
    });
  }, [getNutritionDaySummary, normalizedNutritionTrackerDate, nutritionWeekStartDate]);

  const nutritionWeeklyCompletedDays = useMemo(
    () => nutritionWeeklyHistory.filter((day) => day.totalEntries > 0).length,
    [nutritionWeeklyHistory]
  );

  const nutritionWeeklyAverageKcal = useMemo(() => {
    const activeDays = nutritionWeeklyHistory.filter((day) => day.totalEntries > 0);
    if (activeDays.length === 0) {
      return 0;
    }

    const total = activeDays.reduce((sum, day) => sum + day.consumedKcal, 0);
    return roundToOneDecimal(total / activeDays.length);
  }, [nutritionWeeklyHistory]);

  const nutritionWeeklyAdherencePct = useMemo(() => {
    const activeDays = nutritionWeeklyHistory.filter((day) => day.totalEntries > 0 && day.goalKcal > 0);
    if (activeDays.length === 0) {
      return 0;
    }

    const totalPct = activeDays.reduce(
      (sum, day) => sum + Math.max(0, Math.min(160, day.progressKcalPct)),
      0
    );

    return Math.round(totalPct / activeDays.length);
  }, [nutritionWeeklyHistory]);

  const nutritionStreakStats = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;

    const completedDates = nutritionDailyLogs
      .map((row) => normalizeDateInputValue(row.date))
      .filter((date, index, allDates) => allDates.indexOf(date) === index)
      .filter((date) => getNutritionDaySummary(date).totalEntries > 0)
      .sort();

    if (completedDates.length === 0) {
      return { current: 0, best: 0, lastDate: "" };
    }

    let best = 1;
    let running = 1;

    for (let index = 1; index < completedDates.length; index += 1) {
      const previousTs = new Date(`${completedDates[index - 1]}T00:00:00`).getTime();
      const currentTs = new Date(`${completedDates[index]}T00:00:00`).getTime();

      if (currentTs - previousTs === dayMs) {
        running += 1;
        best = Math.max(best, running);
      } else {
        running = 1;
      }
    }

    let current = 1;
    for (let index = completedDates.length - 1; index > 0; index -= 1) {
      const currentTs = new Date(`${completedDates[index]}T00:00:00`).getTime();
      const previousTs = new Date(`${completedDates[index - 1]}T00:00:00`).getTime();

      if (currentTs - previousTs === dayMs) {
        current += 1;
      } else {
        break;
      }
    }

    return {
      current,
      best,
      lastDate: completedDates[completedDates.length - 1] || "",
    };
  }, [getNutritionDaySummary, nutritionDailyLogs]);

  const nutritionMealQuickChips = useMemo(
    () => [
      { id: "half", label: "50%", ratio: 0.5 },
      { id: "base", label: "100%", ratio: 1 },
      { id: "plus", label: "+20%", ratio: 1.2 },
      { id: "double-snack", label: "+Snack", ratio: 1.35 },
    ],
    []
  );

  const updateNutritionDailyMealLog = useCallback(
    (mealId: string, updater: (previous: NutritionDailyMealLogLite) => NutritionDailyMealLogLite) => {
      const cleanMealId = String(mealId || "").trim();
      if (!cleanMealId) {
        return;
      }

      const safeDate = normalizeDateInputValue(nutritionTrackerDate);
      const nowIso = new Date().toISOString();

      markManualSaveIntent(NUTRITION_DAILY_LOGS_KEY);
      setNutritionDailyLogsRaw((previous) => {
        const rows = normalizeNutritionDailyLogs(Array.isArray(previous) ? previous : []);

        const targetIndex = rows.findIndex((row) => {
          if (row.date !== safeDate) {
            return false;
          }

          const ownerKey = normalizePersonKey(row.ownerKey || "");
          if (ownerKey) {
            return ownerKey === nutritionTrackerOwnerKey;
          }

          return (
            matchesPreparedIdentityName(row.alumnoNombre, preparedIdentity) ||
            matchesPreparedIdentityEmail(row.alumnoEmail, preparedIdentity)
          );
        });

        const baseRow: NutritionDailyLogLite =
          targetIndex >= 0
            ? rows[targetIndex]
            : {
                id: `nutri-log-${nutritionTrackerOwnerKey || "alumno"}-${safeDate}`,
                ownerKey: nutritionTrackerOwnerKey || undefined,
                alumnoNombre: profileName || undefined,
                alumnoEmail: profileEmail || undefined,
                date: safeDate,
                mealLogs: [],
                createdAt: nowIso,
                updatedAt: nowIso,
              };

        const nextMealLogs = Array.isArray(baseRow.mealLogs) ? [...baseRow.mealLogs] : [];
        const targetMealIndex = nextMealLogs.findIndex((row) => String(row.mealId || "").trim() === cleanMealId);
        const previousMealLog: NutritionDailyMealLogLite =
          targetMealIndex >= 0
            ? nextMealLogs[targetMealIndex]
            : {
                mealId: cleanMealId,
                done: false,
                consumedKcal: 0,
                updatedAt: nowIso,
              };

        const nextMealLog = updater(previousMealLog);
        const normalizedMealLog: NutritionDailyMealLogLite = {
          mealId: cleanMealId,
          done: Boolean(nextMealLog.done),
          consumedKcal: Math.max(0, roundToOneDecimal(toNumber(nextMealLog.consumedKcal) || 0)),
          updatedAt: nowIso,
        };

        if (targetMealIndex >= 0) {
          nextMealLogs[targetMealIndex] = normalizedMealLog;
        } else {
          nextMealLogs.push(normalizedMealLog);
        }

        const nextRow: NutritionDailyLogLite = {
          ...baseRow,
          ownerKey: nutritionTrackerOwnerKey || baseRow.ownerKey,
          alumnoNombre: profileName || baseRow.alumnoNombre,
          alumnoEmail: profileEmail || baseRow.alumnoEmail,
          date: safeDate,
          mealLogs: nextMealLogs,
          createdAt: baseRow.createdAt || nowIso,
          updatedAt: nowIso,
        };

        if (targetIndex >= 0) {
          const nextRows = [...rows];
          nextRows[targetIndex] = nextRow;
          return nextRows;
        }

        return [nextRow, ...rows];
      });
    },
    [
      nutritionTrackerDate,
      nutritionTrackerOwnerKey,
      preparedIdentity,
      profileEmail,
      profileName,
      setNutritionDailyLogsRaw,
    ]
  );

  const handleNutritionTrackerDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setNutritionTrackerDate(normalizeDateInputValue(event.target.value));
    setNutritionTrackerStatus("");
  }, []);

  const handleNutritionTrackerDateShift = useCallback((deltaDays: number) => {
    setNutritionTrackerDate((current) => shiftDateInputValue(current, deltaDays));
    setNutritionTrackerStatus("");
  }, []);

  const handleNutritionTrackerDateSelect = useCallback((nextDate: string) => {
    setNutritionTrackerDate(normalizeDateInputValue(nextDate));
    setNutritionTrackerStatus("");
  }, []);

  const handleNutritionTrackerWeekShift = useCallback((deltaWeeks: number) => {
    setNutritionTrackerDate((current) => shiftDateInputValue(current, deltaWeeks * 7));
    setNutritionTrackerStatus("");
  }, []);

  const handleNutritionMealToggle = useCallback(
    (mealId: string, nextDone: boolean, fallbackKcal: number) => {
      updateNutritionDailyMealLog(mealId, (previous) => {
        const previousKcal = toNumber(previous.consumedKcal);
        const resolvedFallback = Math.max(0, roundToOneDecimal(fallbackKcal));

        return {
          ...previous,
          done: nextDone,
          consumedKcal: nextDone
            ? Math.max(0, roundToOneDecimal(previousKcal !== null && previousKcal > 0 ? previousKcal : resolvedFallback))
            : 0,
        };
      });

      setNutritionTrackerStatus(nextDone ? "Comida registrada." : "Comida desmarcada.");
    },
    [updateNutritionDailyMealLog]
  );

  const handleNutritionMealCaloriesBlur = useCallback(
    (mealId: string, fallbackKcal: number, event: FocusEvent<HTMLInputElement>) => {
      const parsedValue = toSafeNumeric(event.currentTarget.value);
      const nextKcal = Math.max(0, roundToOneDecimal(parsedValue === null ? fallbackKcal : parsedValue));

      updateNutritionDailyMealLog(mealId, (previous) => ({
        ...previous,
        done: true,
        consumedKcal: nextKcal,
      }));

      setNutritionTrackerStatus("Calorías diarias actualizadas.");
    },
    [updateNutritionDailyMealLog]
  );

  const handleNutritionMealQuickChip = useCallback(
    (mealId: string, baseMealKcal: number, ratio: number, label: string) => {
      const nextKcal = Math.max(0, roundToOneDecimal(baseMealKcal * ratio));
      updateNutritionDailyMealLog(mealId, (previous) => ({
        ...previous,
        done: true,
        consumedKcal: nextKcal,
      }));

      setNutritionTrackerStatus(`Carga rapida aplicada: ${label}.`);
    },
    [updateNutritionDailyMealLog]
  );

  const applyNutritionDayTemplate = useCallback(
    (templateId: "full" | "training" | "rest" | "clear") => {
      if (nutritionMealsDetailed.length === 0) {
        setNutritionTrackerStatus("No hay comidas para aplicar plantilla.");
        return;
      }

      const factorByTemplate: Record<"full" | "training" | "rest", number> = {
        full: 1,
        training: 1.15,
        rest: 0.85,
      };

      nutritionMealsDetailed.forEach((meal) => {
        updateNutritionDailyMealLog(meal.mealId, (previous) => {
          if (templateId === "clear") {
            return {
              ...previous,
              done: false,
              consumedKcal: 0,
            };
          }

          const factor = factorByTemplate[templateId];
          return {
            ...previous,
            done: true,
            consumedKcal: Math.max(0, roundToOneDecimal(meal.totalKcal * factor)),
          };
        });
      });

      const statusByTemplate: Record<"full" | "training" | "rest" | "clear", string> = {
        full: "Plantilla aplicada: Día completo.",
        training: "Plantilla aplicada: Día de entreno.",
        rest: "Plantilla aplicada: Día de descanso.",
        clear: "Plantilla aplicada: Reinicio diario.",
      };

      setNutritionTrackerStatus(statusByTemplate[templateId]);
    },
    [nutritionMealsDetailed, updateNutritionDailyMealLog]
  );

  const appendNutritionCustomFoodEntry = useCallback(
    (
      entry: {
        nombre: string;
        foodId?: string;
        mealId?: string;
        gramos?: number;
        porcion?: string;
        calorias: number;
        proteinas?: number;
        carbohidratos?: number;
        grasas?: number;
        barcode?: string;
        source?: "manual" | "search" | "barcode" | "camera";
        imageUrl?: string;
      },
      statusMessage?: string
    ) => {
      const nombre = String(entry.nombre || "").trim();
      if (nombre.length < 2) {
        setNutritionCustomFoodStatus("Escribe un alimento válido.");
        return;
      }

      const calorias = Math.max(0, roundToOneDecimal(toNumber(entry.calorias) || 0));
      if (calorias <= 0) {
        setNutritionCustomFoodStatus("Carga las calorías del alimento.");
        return;
      }

      const safeDate = normalizeDateInputValue(nutritionTrackerDate);
      const nowIso = new Date().toISOString();

      markManualSaveIntent(NUTRITION_DAILY_LOGS_KEY);
      setNutritionDailyLogsRaw((previous) => {
        const rows = normalizeNutritionDailyLogs(Array.isArray(previous) ? previous : []);

        const targetIndex = rows.findIndex((row) => {
          if (row.date !== safeDate) {
            return false;
          }

          const ownerKey = normalizePersonKey(row.ownerKey || "");
          if (ownerKey) {
            return ownerKey === nutritionTrackerOwnerKey;
          }

          return (
            matchesPreparedIdentityName(row.alumnoNombre, preparedIdentity) ||
            matchesPreparedIdentityEmail(row.alumnoEmail, preparedIdentity)
          );
        });

        const baseRow: NutritionDailyLogLite =
          targetIndex >= 0
            ? rows[targetIndex]
            : {
                id: `nutri-log-${nutritionTrackerOwnerKey || "alumno"}-${safeDate}`,
                ownerKey: nutritionTrackerOwnerKey || undefined,
                alumnoNombre: profileName || undefined,
                alumnoEmail: profileEmail || undefined,
                date: safeDate,
                mealLogs: [],
                customFoods: [],
                createdAt: nowIso,
                updatedAt: nowIso,
              };

        const nextCustomFoods = Array.isArray(baseRow.customFoods) ? [...baseRow.customFoods] : [];
        nextCustomFoods.unshift({
          id: `nf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          nombre,
          foodId: String(entry.foodId || "").trim() || undefined,
          mealId: String(entry.mealId || "").trim() || undefined,
          gramos: Math.max(0, roundToOneDecimal(toNumber(entry.gramos) || 0)) || undefined,
          porcion: String(entry.porcion || "").trim() || undefined,
          calorias,
          proteinas: Math.max(0, roundToOneDecimal(toNumber(entry.proteinas) || 0)),
          carbohidratos: Math.max(0, roundToOneDecimal(toNumber(entry.carbohidratos) || 0)),
          grasas: Math.max(0, roundToOneDecimal(toNumber(entry.grasas) || 0)),
          barcode: String(entry.barcode || "").trim() || undefined,
          source: entry.source || "manual",
          imageUrl: String(entry.imageUrl || "").trim() || undefined,
          createdAt: nowIso,
        });

        const nextRow: NutritionDailyLogLite = {
          ...baseRow,
          ownerKey: nutritionTrackerOwnerKey || baseRow.ownerKey,
          alumnoNombre: profileName || baseRow.alumnoNombre,
          alumnoEmail: profileEmail || baseRow.alumnoEmail,
          date: safeDate,
          customFoods: nextCustomFoods,
          createdAt: baseRow.createdAt || nowIso,
          updatedAt: nowIso,
        };

        if (targetIndex >= 0) {
          const nextRows = [...rows];
          nextRows[targetIndex] = nextRow;
          return nextRows;
        }

        return [nextRow, ...rows];
      });

      setNutritionCustomFoodStatus(statusMessage || "Alimento cargado en tu registro diario.");
    },
    [
      nutritionTrackerDate,
      nutritionTrackerOwnerKey,
      preparedIdentity,
      profileEmail,
      profileName,
      setNutritionDailyLogsRaw,
    ]
  );

  const addNutritionCustomFood = useCallback(() => {
    const nombre = String(nutritionCustomFoodDraft.nombre || "").trim();
    if (nombre.length < 2) {
      setNutritionCustomFoodStatus("Escribe un alimento válido.");
      return;
    }

    const calorias = Math.max(0, roundToOneDecimal(toSafeNumeric(nutritionCustomFoodDraft.calorias) || 0));
    if (calorias <= 0) {
      setNutritionCustomFoodStatus("Carga las calorías del alimento.");
      return;
    }

    appendNutritionCustomFoodEntry({
      nombre,
      porcion: String(nutritionCustomFoodDraft.porcion || "").trim() || undefined,
      calorias,
      proteinas: Math.max(0, roundToOneDecimal(toSafeNumeric(nutritionCustomFoodDraft.proteinas) || 0)),
      carbohidratos: Math.max(0, roundToOneDecimal(toSafeNumeric(nutritionCustomFoodDraft.carbohidratos) || 0)),
      grasas: Math.max(0, roundToOneDecimal(toSafeNumeric(nutritionCustomFoodDraft.grasas) || 0)),
      source: "manual",
    });

    setNutritionCustomFoodDraft({
      nombre: "",
      porcion: "",
      calorias: "",
      proteinas: "",
      carbohidratos: "",
      grasas: "",
    });
  }, [
    appendNutritionCustomFoodEntry,
    nutritionCustomFoodDraft.carbohidratos,
    nutritionCustomFoodDraft.calorias,
    nutritionCustomFoodDraft.grasas,
    nutritionCustomFoodDraft.nombre,
    nutritionCustomFoodDraft.porcion,
    nutritionCustomFoodDraft.proteinas,
  ]);

  const stopNutritionLiveCapture = useCallback(() => {
    if (nutritionBarcodeScanRafRef.current !== null) {
      window.cancelAnimationFrame(nutritionBarcodeScanRafRef.current);
      nutritionBarcodeScanRafRef.current = null;
    }

    const stream = nutritionLiveStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    nutritionLiveStreamRef.current = null;

    if (nutritionLiveVideoRef.current) {
      nutritionLiveVideoRef.current.pause();
      nutritionLiveVideoRef.current.srcObject = null;
    }

    nutritionBarcodeLastDetectedRef.current = "";
    setNutritionLiveCaptureMode("none");
    setNutritionLiveCaptureReady(false);
    setNutritionLiveCaptureStatus("");
  }, []);

  const openNutritionMealComposer = useCallback((mealId: string) => {
    const safeMealId = String(mealId || "").trim();
    if (!safeMealId) {
      return;
    }

    setNutritionMealComposerMealId(safeMealId);
    setNutritionFoodSearchStatus("");
    setNutritionBarcodeStatus("");
    setNutritionCalIaStatus("");
    setNutritionCalIaEstimate(null);
  }, []);

  const closeNutritionMealComposer = useCallback(() => {
    stopNutritionLiveCapture();
    setNutritionMealComposerMealId(null);
    setNutritionFoodSearchQuery("");
    setNutritionFoodGramsDraft("100");
    setNutritionRemoteSearchResults([]);
    setNutritionFoodSearchStatus("");
    setNutritionBarcodeStatus("");
    setNutritionCalIaStatus("");
    setNutritionCalIaEstimate(null);
    setNutritionCalIaProcessing(false);
  }, [stopNutritionLiveCapture]);

  useEffect(() => {
    if (!nutritionMealComposerMealId && nutritionLiveCaptureMode !== "none") {
      stopNutritionLiveCapture();
    }
  }, [nutritionLiveCaptureMode, nutritionMealComposerMealId, stopNutritionLiveCapture]);

  const toggleNutritionFavoriteFood = useCallback(
    (food: NutritionSearchFoodResult) => {
      const safeId = String(food.id || "").trim();
      if (!safeId) {
        return;
      }

      markManualSaveIntent(NUTRITION_FAVORITES_KEY);
      setNutritionFavoritesRaw((previous) => {
        const rows = normalizeNutritionFavoriteRows(Array.isArray(previous) ? previous : []);
        const existingIndex = rows.findIndex((entry) => entry.id === safeId);

        if (existingIndex >= 0) {
          return rows.filter((entry) => entry.id !== safeId);
        }

        const next: NutritionFoodFavoriteLite = {
          id: safeId,
          nombre: String(food.nombre || "").trim() || safeId,
          kcalPer100g: Math.max(0, roundToOneDecimal(toNumber(food.kcalPer100g) || 0)),
          proteinPer100g: Math.max(0, roundToOneDecimal(toNumber(food.proteinPer100g) || 0)),
          carbsPer100g: Math.max(0, roundToOneDecimal(toNumber(food.carbsPer100g) || 0)),
          fatPer100g: Math.max(0, roundToOneDecimal(toNumber(food.fatPer100g) || 0)),
          imageUrl: String(food.imageUrl || "").trim() || undefined,
          barcode: String(food.barcode || "").trim() || undefined,
          updatedAt: new Date().toISOString(),
        };

        return [next, ...rows];
      });

      setNutritionFoodSearchStatus(
        nutritionFavoriteFoodIds.has(safeId)
          ? "Alimento quitado de favoritos."
          : "Alimento guardado en favoritos."
      );
    },
    [nutritionFavoriteFoodIds, setNutritionFavoritesRaw]
  );

  const addNutritionFoodFromSearch = useCallback(
    (food: NutritionSearchFoodResult, source: "search" | "barcode" | "camera" = "search") => {
      if (!nutritionActiveMealComposer) {
        setNutritionFoodSearchStatus("Selecciona una comida para cargar el alimento.");
        return;
      }

      const grams = Math.max(1, roundToOneDecimal(toSafeNumeric(nutritionFoodGramsDraft) || 0));
      if (grams <= 0) {
        setNutritionFoodSearchStatus("Ingresa un gramaje válido.");
        return;
      }

      const kcalPer100g = Math.max(0, toNumber(food.kcalPer100g) || 0);
      const proteinPer100g = Math.max(0, toNumber(food.proteinPer100g) || 0);
      const carbsPer100g = Math.max(0, toNumber(food.carbsPer100g) || 0);
      const fatPer100g = Math.max(0, toNumber(food.fatPer100g) || 0);

      appendNutritionCustomFoodEntry(
        {
          nombre: food.nombre,
          foodId: food.id,
          mealId: nutritionActiveMealComposer.mealId,
          gramos: grams,
          porcion: `${grams} g`,
          calorias: roundToOneDecimal((kcalPer100g * grams) / 100),
          proteinas: roundToOneDecimal((proteinPer100g * grams) / 100),
          carbohidratos: roundToOneDecimal((carbsPer100g * grams) / 100),
          grasas: roundToOneDecimal((fatPer100g * grams) / 100),
          barcode: String(food.barcode || "").trim() || undefined,
          source,
          imageUrl: String(food.imageUrl || "").trim() || undefined,
        },
        `Agregado a ${nutritionActiveMealComposer.mealName}.`
      );

      setNutritionFoodSearchStatus(`Cargado: ${food.nombre}.`);
      setNutritionCalIaEstimate(null);
    },
    [appendNutritionCustomFoodEntry, nutritionActiveMealComposer, nutritionFoodGramsDraft]
  );

  const lookupNutritionBarcode = useCallback(async (
    rawCode: string,
    options?: { autoAdd?: boolean }
  ) => {
    const normalizedCode = String(rawCode || "").replace(/\s+/g, "").trim();
    if (normalizedCode.length < 6) {
      setNutritionBarcodeStatus("Código de barras inválido.");
      return;
    }

    setNutritionBarcodeStatus("Buscando producto...");
    setNutritionFoodSearchLoading(true);

    try {
      const response = await fetch(`/api/nutrition/catalog?barcode=${encodeURIComponent(normalizedCode)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudo consultar el catálogo por código de barras.");
      }

      const payload = (await response.json()) as {
        ok?: boolean;
        items?: NutritionSearchFoodResult[];
      };
      const item = Array.isArray(payload.items) ? payload.items[0] : null;

      if (!payload.ok || !item) {
        setNutritionBarcodeStatus("No se encontró un producto para ese código.");
        return;
      }

      setNutritionRemoteSearchResults((previous) => {
        const map = new Map<string, NutritionSearchFoodResult>();
        previous.forEach((row) => map.set(row.id, row));
        map.set(item.id, item);
        return Array.from(map.values());
      });

      setNutritionFoodSearchQuery(item.nombre);

      if (options?.autoAdd && nutritionActiveMealComposer) {
        addNutritionFoodFromSearch(item, "barcode");
        setNutritionBarcodeStatus(`Escaneo automático: ${item.nombre} agregado.`);
        setNutritionLiveCaptureStatus(`Código detectado y cargado: ${item.nombre}.`);
      } else {
        setNutritionBarcodeStatus(`Producto detectado: ${item.nombre}.`);
        setNutritionFoodSearchStatus("Revisa gramajes y pulsa Agregar.");
      }
    } catch (error) {
      setNutritionBarcodeStatus(error instanceof Error ? error.message : "Error al buscar por código de barras.");
    } finally {
      setNutritionFoodSearchLoading(false);
    }
  }, [addNutritionFoodFromSearch, nutritionActiveMealComposer]);

  const processNutritionCalIaFromBlob = useCallback(
    async (imageBlob: Blob) => {
      if (!nutritionActiveMealComposer) {
        setNutritionCalIaStatus("Selecciona una comida antes de estimar con cámara.");
        return;
      }

      setNutritionCalIaProcessing(true);
      setNutritionCalIaStatus("Procesando imagen con CAL IA...");

      let imageWidth = 960;
      let imageHeight = 720;
      let imageProfile = {
        coverageRatio: 0.58,
        edgeRatio: 0.32,
        vibrancyRatio: 0.38,
        warmRatio: 0.34,
      };

      try {
        const bitmap = await createImageBitmap(imageBlob);
        imageWidth = bitmap.width || imageWidth;
        imageHeight = bitmap.height || imageHeight;
        imageProfile = analyzeNutritionImageBitmap(bitmap);
        bitmap.close();
      } catch {
        // Fallback keeps CAL IA available even when bitmap decoding is not supported.
      }

      try {
        const queryHint = normalizePersonKey(nutritionFoodSearchQuery);
        const mealIdentity = normalizePersonKey(
          `${nutritionActiveMealComposer.mealName} ${nutritionActiveMealComposer.mealId}`
        );

        const mealHintKey = mealIdentity.includes("desay")
          ? "desayuno"
          : mealIdentity.includes("almuer")
            ? "almuerzo"
            : mealIdentity.includes("cena")
              ? "cena"
              : "snacks";

        const mealHints = NUTRITION_CAL_IA_MEAL_HINTS[mealHintKey] || NUTRITION_CAL_IA_MEAL_HINTS.snacks;
        const queryTokens = queryHint.split(" ").filter((token) => token.length > 1);

        const rankedFoods = nutritionCatalogFoods
          .map((food) => {
            const normalizedName = normalizePersonKey(food.nombre);

            let score = nutritionFavoriteFoodIds.has(food.id) ? 1.5 : 0;
            queryTokens.forEach((token) => {
              if (normalizedName.includes(token)) {
                score += 5;
              }
            });

            mealHints.forEach((token) => {
              if (normalizedName.includes(normalizePersonKey(token))) {
                score += 2;
              }
            });

            return { food, score };
          })
          .filter((row) => row.score > 0)
          .sort((left, right) => right.score - left.score || left.food.nombre.localeCompare(right.food.nombre));

        const fallbackFavorite = nutritionCatalogFoods.find((item) => nutritionFavoriteFoodIds.has(item.id));
        const fallbackFood = rankedFoods[0]?.food || fallbackFavorite || nutritionCatalogFoods[0] || null;

        const candidateFoods = rankedFoods.slice(0, 3).map((row) => row.food);
        if (candidateFoods.length === 0 && fallbackFood) {
          candidateFoods.push(fallbackFood);
        }

        const megapixels = Math.max(0.25, (imageWidth * imageHeight) / 1_000_000);
        const geometryFactor = Math.max(0.85, Math.min(1.55, megapixels * 0.46 + 0.62));
        const complexityFactor = Math.max(
          0.72,
          Math.min(2.35, imageProfile.coverageRatio * 1.7 + imageProfile.edgeRatio * 1.15 + geometryFactor)
        );
        const richnessFactor = Math.max(
          0.78,
          Math.min(1.85, 0.82 + imageProfile.vibrancyRatio * 0.95 + imageProfile.warmRatio * 0.42)
        );
        const estimatedGrams = roundToOneDecimal(
          Math.max(90, Math.min(760, 118 * complexityFactor * richnessFactor))
        );

        const weightedNutrition = candidateFoods.reduce(
          (accumulator, food, index) => {
            const weight = candidateFoods.length - index;
            return {
              kcal: accumulator.kcal + Math.max(60, toNumber(food.kcalPer100g) || 185) * weight,
              protein: accumulator.protein + Math.max(0.8, toNumber(food.proteinPer100g) || 7.2) * weight,
              carbs: accumulator.carbs + Math.max(0.8, toNumber(food.carbsPer100g) || 17.4) * weight,
              fat: accumulator.fat + Math.max(0.4, toNumber(food.fatPer100g) || 7.1) * weight,
              totalWeight: accumulator.totalWeight + weight,
            };
          },
          { kcal: 0, protein: 0, carbs: 0, fat: 0, totalWeight: 0 }
        );

        const safeWeight = Math.max(1, weightedNutrition.totalWeight);
        const baseKcal = weightedNutrition.kcal / safeWeight;
        const baseProtein = weightedNutrition.protein / safeWeight;
        const baseCarbs = weightedNutrition.carbs / safeWeight;
        const baseFat = weightedNutrition.fat / safeWeight;

        const detectedFoodLabels = candidateFoods.map((food) => food.nombre).slice(0, 2);
        const estimatedLabel = detectedFoodLabels.length > 0
          ? `CAL IA · ${detectedFoodLabels.join(" + ")}`
          : `CAL IA · ${nutritionActiveMealComposer.mealName}`;

        const previewUrl = await readBlobAsDataUrl(imageBlob);

        const estimatedEntry: NutritionDailyCustomFoodLite = {
          id: "cal-ia-draft",
          nombre: estimatedLabel,
          foodId: candidateFoods[0]?.id || undefined,
          mealId: nutritionActiveMealComposer.mealId,
          gramos: estimatedGrams,
          porcion: `${estimatedGrams} g (foto IA)`,
          calorias: roundToOneDecimal((baseKcal * estimatedGrams) / 100),
          proteinas: roundToOneDecimal((baseProtein * estimatedGrams) / 100),
          carbohidratos: roundToOneDecimal((baseCarbs * estimatedGrams) / 100),
          grasas: roundToOneDecimal((baseFat * estimatedGrams) / 100),
          source: "camera",
        };

        setNutritionCalIaEstimate({
          previewUrl,
          entry: estimatedEntry,
        });

        if (candidateFoods[0]) {
          setNutritionFoodSearchQuery(candidateFoods[0].nombre);
        }

        setNutritionCalIaStatus(
          `CAL IA estimó ${estimatedEntry.calorias} kcal en ${estimatedEntry.gramos || 0} g.`
        );
      } catch {
        setNutritionCalIaStatus("No se pudo procesar la imagen para estimar calorías.");
      } finally {
        setNutritionCalIaProcessing(false);
      }
    },
    [
      nutritionActiveMealComposer,
      nutritionCatalogFoods,
      nutritionFavoriteFoodIds,
      nutritionFoodSearchQuery,
    ]
  );

  const triggerNutritionLiveCapture = useCallback(
    async (mode: Exclude<NutritionCaptureMode, "none">) => {
      if (!nutritionActiveMealComposer) {
        setNutritionFoodSearchStatus("Selecciona una comida antes de abrir la cámara.");
        return;
      }

      const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
      const openFileFallback = () => {
        if (mode === "barcode") {
          nutritionBarcodeCaptureInputRef.current?.click();
          return;
        }

        nutritionCalIaCaptureInputRef.current?.click();
      };

      if (!mediaDevices?.getUserMedia) {
        if (mode === "barcode") {
          setNutritionBarcodeStatus("Tu dispositivo no soporta cámara en vivo. Usa foto de código.");
        } else {
          setNutritionCalIaStatus("Tu dispositivo no soporta cámara en vivo. Usa foto de plato.");
        }
        openFileFallback();
        return;
      }

      if (mode === "barcode") {
        const barcodeCtor = (
          window as unknown as {
            BarcodeDetector?: NutritionBarcodeDetectorCtorLike;
          }
        ).BarcodeDetector;

        if (!barcodeCtor) {
          setNutritionBarcodeStatus("Escaneo automático no disponible. Usa foto del código.");
          openFileFallback();
          return;
        }
      }

      try {
        stopNutritionLiveCapture();

        setNutritionLiveCaptureMode(mode);
        setNutritionLiveCaptureReady(false);
        setNutritionLiveCaptureStatus(
          mode === "barcode"
            ? "Escaneando automáticamente..."
            : "Enfoca el plato y toca \"Sacar foto\"."
        );

        const stream = await mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        nutritionLiveStreamRef.current = stream;

        const video = nutritionLiveVideoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }

        setNutritionLiveCaptureReady(true);
      } catch (error) {
        stopNutritionLiveCapture();
        if (mode === "barcode") {
          setNutritionBarcodeStatus(error instanceof Error ? error.message : "No se pudo abrir la cámara.");
        } else {
          setNutritionCalIaStatus(error instanceof Error ? error.message : "No se pudo abrir la cámara.");
        }
        openFileFallback();
      }
    },
    [nutritionActiveMealComposer, stopNutritionLiveCapture]
  );

  const triggerNutritionBarcodeCapture = useCallback(() => {
    void triggerNutritionLiveCapture("barcode");
  }, [triggerNutritionLiveCapture]);

  const triggerNutritionCalIaCapture = useCallback(() => {
    void triggerNutritionLiveCapture("cal-ia");
  }, [triggerNutritionLiveCapture]);

  const captureNutritionCalIaFromLiveCamera = useCallback(async () => {
    const video = nutritionLiveVideoRef.current;
    if (!video || video.readyState < 2) {
      setNutritionLiveCaptureStatus("Esperando cámara... intenta de nuevo.");
      return;
    }

    const width = Math.max(320, video.videoWidth || 960);
    const height = Math.max(320, video.videoHeight || 1280);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setNutritionCalIaStatus("No se pudo tomar la foto desde la cámara.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      setNutritionCalIaStatus("No se pudo generar la imagen de la cámara.");
      return;
    }

    stopNutritionLiveCapture();
    await processNutritionCalIaFromBlob(blob);
  }, [processNutritionCalIaFromBlob, stopNutritionLiveCapture]);

  useEffect(() => {
    if (nutritionLiveCaptureMode !== "barcode" || !nutritionLiveCaptureReady) {
      return;
    }

    const barcodeDetectorCtor = (
      window as unknown as {
        BarcodeDetector?: NutritionBarcodeDetectorCtorLike;
      }
    ).BarcodeDetector;

    if (!barcodeDetectorCtor) {
      return;
    }

    const detector = new barcodeDetectorCtor({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
    });

    let cancelled = false;

    const scanFrame = async () => {
      if (cancelled) {
        return;
      }

      const video = nutritionLiveVideoRef.current;
      if (!video || video.readyState < 2) {
        nutritionBarcodeScanRafRef.current = window.requestAnimationFrame(() => {
          void scanFrame();
        });
        return;
      }

      let bitmap: ImageBitmap | null = null;

      try {
        bitmap = await createImageBitmap(video);
        const detections = await detector.detect(bitmap);
        const detectedCode = String(detections?.[0]?.rawValue || "").trim();

        if (detectedCode && detectedCode !== nutritionBarcodeLastDetectedRef.current) {
          nutritionBarcodeLastDetectedRef.current = detectedCode;
          setNutritionLiveCaptureStatus(`Código detectado: ${detectedCode}`);
          await lookupNutritionBarcode(detectedCode, { autoAdd: true });
          stopNutritionLiveCapture();
          return;
        }
      } catch {
        // Keep scanning loop resilient to frame errors.
      } finally {
        bitmap?.close();
      }

      nutritionBarcodeScanRafRef.current = window.requestAnimationFrame(() => {
        void scanFrame();
      });
    };

    nutritionBarcodeScanRafRef.current = window.requestAnimationFrame(() => {
      void scanFrame();
    });

    return () => {
      cancelled = true;
      if (nutritionBarcodeScanRafRef.current !== null) {
        window.cancelAnimationFrame(nutritionBarcodeScanRafRef.current);
        nutritionBarcodeScanRafRef.current = null;
      }
    };
  }, [lookupNutritionBarcode, nutritionLiveCaptureMode, nutritionLiveCaptureReady, stopNutritionLiveCapture]);

  useEffect(() => {
    return () => {
      stopNutritionLiveCapture();
    };
  }, [stopNutritionLiveCapture]);

  const handleNutritionBarcodeCaptureChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      const barcodeDetectorCtor = (
        window as unknown as {
          BarcodeDetector?: new (options?: { formats?: string[] }) => {
            detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>>;
          };
        }
      ).BarcodeDetector;

      let detectedCode = "";
      if (barcodeDetectorCtor) {
        try {
          const detector = new barcodeDetectorCtor({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
          });
          const bitmap = await createImageBitmap(file);
          const results = await detector.detect(bitmap);
          bitmap.close();
          detectedCode = String(results?.[0]?.rawValue || "").trim();
        } catch {
          detectedCode = "";
        }
      }

      if (!detectedCode) {
        const manualCode = window.prompt(
          "No se detectó automáticamente. Ingresa el código de barras manualmente:"
        );
        detectedCode = String(manualCode || "").trim();
      }

      if (!detectedCode) {
        setNutritionBarcodeStatus("No se detectó ningún código.");
        return;
      }

      stopNutritionLiveCapture();
      await lookupNutritionBarcode(detectedCode, { autoAdd: true });
    },
    [lookupNutritionBarcode, stopNutritionLiveCapture]
  );

  const handleNutritionCalIaCaptureChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      stopNutritionLiveCapture();
      await processNutritionCalIaFromBlob(file);
    },
    [processNutritionCalIaFromBlob, stopNutritionLiveCapture]
  );

  const confirmNutritionCalIaEstimate = useCallback(() => {
    if (!nutritionCalIaEstimate?.entry) {
      setNutritionCalIaStatus("Primero toma una foto para obtener una estimación.");
      return;
    }

    addNutritionFoodFromSearch(
      {
        id: nutritionCalIaEstimate.entry.foodId || nutritionCalIaEstimate.entry.id,
        nombre: nutritionCalIaEstimate.entry.nombre,
        kcalPer100g: Math.max(
          0,
          roundToOneDecimal(
            (Math.max(0, toNumber(nutritionCalIaEstimate.entry.calorias) || 0) * 100) /
              Math.max(1, toNumber(nutritionCalIaEstimate.entry.gramos) || 100)
          )
        ),
        proteinPer100g: Math.max(
          0,
          roundToOneDecimal(
            (Math.max(0, toNumber(nutritionCalIaEstimate.entry.proteinas) || 0) * 100) /
              Math.max(1, toNumber(nutritionCalIaEstimate.entry.gramos) || 100)
          )
        ),
        carbsPer100g: Math.max(
          0,
          roundToOneDecimal(
            (Math.max(0, toNumber(nutritionCalIaEstimate.entry.carbohidratos) || 0) * 100) /
              Math.max(1, toNumber(nutritionCalIaEstimate.entry.gramos) || 100)
          )
        ),
        fatPer100g: Math.max(
          0,
          roundToOneDecimal(
            (Math.max(0, toNumber(nutritionCalIaEstimate.entry.grasas) || 0) * 100) /
              Math.max(1, toNumber(nutritionCalIaEstimate.entry.gramos) || 100)
          )
        ),
        sourceLabel: "CAL IA",
      },
      "camera"
    );
    setNutritionCalIaEstimate(null);
  }, [addNutritionFoodFromSearch, nutritionCalIaEstimate]);

  const removeNutritionCustomFood = useCallback(
    (entryId: string) => {
      const safeId = String(entryId || "").trim();
      if (!safeId) {
        return;
      }

      const safeDate = normalizeDateInputValue(nutritionTrackerDate);
      markManualSaveIntent(NUTRITION_DAILY_LOGS_KEY);

      setNutritionDailyLogsRaw((previous) => {
        const rows = normalizeNutritionDailyLogs(Array.isArray(previous) ? previous : []);
        const targetIndex = rows.findIndex((row) => {
          if (row.date !== safeDate) {
            return false;
          }

          const ownerKey = normalizePersonKey(row.ownerKey || "");
          if (ownerKey) {
            return ownerKey === nutritionTrackerOwnerKey;
          }

          return (
            matchesPreparedIdentityName(row.alumnoNombre, preparedIdentity) ||
            matchesPreparedIdentityEmail(row.alumnoEmail, preparedIdentity)
          );
        });

        if (targetIndex < 0) {
          return rows;
        }

        const targetRow = rows[targetIndex];
        const currentCustomFoods = Array.isArray(targetRow.customFoods) ? targetRow.customFoods : [];
        const nextCustomFoods = currentCustomFoods.filter((entry) => String(entry.id || "").trim() !== safeId);

        const nextRows = [...rows];
        nextRows[targetIndex] = {
          ...targetRow,
          customFoods: nextCustomFoods,
          updatedAt: new Date().toISOString(),
        };

        return nextRows;
      });

      setNutritionCustomFoodStatus("Alimento eliminado del día.");
    },
    [
      nutritionTrackerDate,
      nutritionTrackerOwnerKey,
      preparedIdentity,
      setNutritionDailyLogsRaw,
    ]
  );

  useEffect(() => {
    if (!nutritionTrackerStatus) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNutritionTrackerStatus("");
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [nutritionTrackerStatus]);

  useEffect(() => {
    if (!nutritionCustomFoodStatus) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNutritionCustomFoodStatus("");
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [nutritionCustomFoodStatus]);

  useEffect(() => {
    if (!nutritionMealComposerMealId) {
      setNutritionRemoteSearchResults([]);
      setNutritionFoodSearchLoading(false);
      return;
    }

    const query = String(nutritionFoodSearchQuery || "").trim();
    if (query.length < 3) {
      setNutritionRemoteSearchResults([]);
      setNutritionFoodSearchLoading(false);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setNutritionFoodSearchLoading(true);

      try {
        const response = await fetch(`/api/nutrition/catalog?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error("No se pudo consultar el buscador externo de alimentos.");
        }

        const payload = (await response.json()) as {
          ok?: boolean;
          items?: NutritionSearchFoodResult[];
        };

        if (!payload.ok) {
          setNutritionRemoteSearchResults([]);
          return;
        }

        const rows = Array.isArray(payload.items) ? payload.items : [];
        setNutritionRemoteSearchResults(rows);
      } catch (error) {
        if (!abortController.signal.aborted) {
          setNutritionFoodSearchStatus(
            error instanceof Error ? error.message : "No se pudo completar la búsqueda externa."
          );
        }
      } finally {
        if (!abortController.signal.aborted) {
          setNutritionFoodSearchLoading(false);
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [nutritionFoodSearchQuery, nutritionMealComposerMealId]);

  useEffect(() => {
    if (!nutritionFoodSearchStatus && !nutritionBarcodeStatus && !nutritionCalIaStatus) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNutritionFoodSearchStatus("");
      setNutritionBarcodeStatus("");
      setNutritionCalIaStatus("");
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [nutritionBarcodeStatus, nutritionCalIaStatus, nutritionFoodSearchStatus]);

  const latestAnthropometry = anthropometryEntries[0] || null;
  const previousAnthropometry = anthropometryEntries[1] || null;

  const weightDelta = useMemo(() => {
    const latest = toNumber(latestAnthropometry?.pesoKg);
    const previous = toNumber(previousAnthropometry?.pesoKg);
    if (latest === null || previous === null) return null;
    return Number((latest - previous).toFixed(1));
  }, [latestAnthropometry?.pesoKg, previousAnthropometry?.pesoKg]);

  const sevenDaysAgoTs = nowTs - 7 * 24 * 60 * 60 * 1000;
  const shouldComputeProgressStats = activeCategory === "progreso";

  const weeklyLogs = useMemo(() => {
    if (!shouldComputeProgressStats) return [];

    return workoutLogs.filter((row) => {
      const timestamp = getTimestamp(row.createdAt || row.fecha);
      return timestamp >= sevenDaysAgoTs;
    });
  }, [sevenDaysAgoTs, shouldComputeProgressStats, workoutLogs]);

  const consistencyScore = useMemo(() => {
    if (!shouldComputeProgressStats) return 0;

    const baseByLogs = Math.min(60, weeklyLogs.length * 12);
    const baseByAnthro = Math.min(20, anthropometryEntries.length * 5);
    const baseByRoutine = Math.min(20, routineSummary.sessions * 4);
    return Math.min(100, baseByLogs + baseByAnthro + baseByRoutine);
  }, [anthropometryEntries.length, routineSummary.sessions, shouldComputeProgressStats, weeklyLogs.length]);

  const profileShortName = useMemo(() => {
    const firstToken = String(profileDisplayName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0];
    return firstToken || profileDisplayName;
  }, [profileDisplayName]);

  const studentAvatarSrc = useMemo(() => {
    const source = String(accountProfile?.sidebarImage || "").trim();
    return source || null;
  }, [accountProfile?.sidebarImage]);

  const studentAvatarInitials = useMemo(() => getInitials(profileDisplayName), [profileDisplayName]);

  const coachRoleLabel = useMemo(() => {
    const role = String(coachContact?.role || "").trim().toUpperCase();
    if (role === "ADMIN") return "Administrador";
    if (role === "COLABORADOR") return "Profesor";
    return "Profesor";
  }, [coachContact?.role]);

  const coachDisplayName = useMemo(() => {
    const rawCoachName = String(coachContact?.nombre || "").trim();
    if (!rawCoachName) return "Profesor asignado";
    if (namesLikelyMatch(rawCoachName, profileDisplayName)) return "Profesor asignado";
    return rawCoachName;
  }, [coachContact?.nombre, profileDisplayName]);

  const coachAvatarInitials = useMemo(() => getInitials(coachDisplayName), [coachDisplayName]);

  const coachPlanLabel = useMemo(() => {
    const explicitPlan = uniqueStrings([
      clientMeta?.planNombre,
      clientMeta?.membresia,
      clientMeta?.categoriaPlan,
    ])[0];

    if (explicitPlan) return explicitPlan;

    const daysFromMeta = toNumber(clientMeta?.diasPlan);
    if (daysFromMeta !== null && daysFromMeta > 0) {
      return `Plan de ${Math.round(daysFromMeta)} dias`;
    }

    const fallbackDays = Math.max(routineSummary.sessions || 0, 5);
    return `Plan de ${fallbackDays} dias`;
  }, [clientMeta?.categoriaPlan, clientMeta?.diasPlan, clientMeta?.membresia, clientMeta?.planNombre, routineSummary.sessions]);

  const coachStartLabel = useMemo(() => formatDateTag(clientMeta?.startDate), [clientMeta?.startDate]);
  const coachEndLabel = useMemo(() => formatDateTag(clientMeta?.endDate), [clientMeta?.endDate]);

  const homeMusicCards = useMemo<HomeMusicCard[]>(() => {
    const accents = [
      "pf-a3-music-card-fallback-a",
      "pf-a3-music-card-fallback-b",
      "pf-a3-music-card-fallback-c",
      "pf-a3-music-card-fallback-d",
    ];

    const maxCards = isUltraMobile ? 3 : 8;

    const prepared = musicAssignments.slice(0, maxCards).map((assignment, index) => {
      const normalizedPlaylistUrl = normalizeMusicUrl(String(assignment.playlistUrl || ""));
      const platform = resolveMusicPlatform(assignment.platform, assignment.playlistUrl);
      const metadataName = normalizedPlaylistUrl ? String(musicNameByUrl[normalizedPlaylistUrl] || "").trim() : "";
      const assignmentName = String(assignment.playlistName || "").trim();
      const songTitle = String(assignment.recommendedSongTitle || "").trim();
      const contentType = resolveMusicContentType(
        platform,
        normalizedPlaylistUrl,
        assignment.recommendedSongTitle,
        normalizedPlaylistUrl ? musicContentTypeByUrl[normalizedPlaylistUrl] : undefined
      );

      const title =
        songTitle ||
        (assignmentName && !looksLikeGenericMusicName(assignmentName)
          ? assignmentName
          : metadataName || resolveMusicFallbackTitle(platform, contentType));

      const artist =
        String(assignment.recommendedSongArtist || "").trim() ||
        String(assignment.objetivo || "").trim() ||
        `${resolveMusicPlatformLabel(platform)} · ${resolveMusicContentTypeLabel(contentType)}`;

      const coverUrl = uniqueStrings([
        assignment.coverUrl,
        assignment.artworkUrl,
        assignment.imageUrl,
        assignment.thumbnailUrl,
        normalizedPlaylistUrl ? musicArtworkByUrl[normalizedPlaylistUrl] : "",
      ])[0] || null;

      return {
        id: resolveMusicAssignmentId(assignment, index),
        title,
        artist,
        coverUrl,
        accentClass: accents[index % accents.length],
        playlistUrl: normalizedPlaylistUrl || null,
        platform,
        contentType,
      } satisfies HomeMusicCard;
    });

    return prepared.length > 0 ? prepared : HOME_MUSIC_FALLBACK;
  }, [isUltraMobile, musicArtworkByUrl, musicAssignments, musicContentTypeByUrl, musicNameByUrl]);

  const weightSeries = useMemo(() => {
    const rows = anthropometryEntries
      .map((entry) => {
        const weight = toNumber(entry.pesoKg);
        const timestamp = getTimestamp(entry.createdAt);
        if (weight === null || timestamp <= 0) return null;
        return { weight, timestamp };
      })
      .filter((row): row is { weight: number; timestamp: number } => Boolean(row))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-8);

    return rows;
  }, [anthropometryEntries]);

  const weightSparkline = useMemo(() => {
    if (weightSeries.length === 0) return null;

    const values = weightSeries.map((row) => row.weight);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(0.5, max - min);

    const points = values
      .map((value, index) => {
        const x = values.length === 1 ? 12 : 12 + (index / (values.length - 1)) * 276;
        const y = 148 - ((value - min) / range) * 116;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return {
      points,
      firstWeight: values[0],
      lastWeight: values[values.length - 1],
      lastDateLabel: formatDate(new Date(weightSeries[weightSeries.length - 1]?.timestamp || 0)),
      lastPointX: values.length === 1 ? 12 : 288,
      lastPointY:
        values.length === 1
          ? 148 - ((values[0] - min) / range) * 116
          : 148 - ((values[values.length - 1] - min) / range) * 116,
    };
  }, [weightSeries]);

  const weightLast7 = useMemo(() => {
    const limit = nowTs - 7 * 24 * 60 * 60 * 1000;
    const rows = anthropometryEntries
      .filter((entry) => getTimestamp(entry.createdAt) >= limit)
      .map((entry) => toNumber(entry.pesoKg))
      .filter((value): value is number => value !== null);

    if (rows.length === 0) return null;
    return Number((rows.reduce((acc, value) => acc + value, 0) / rows.length).toFixed(2));
  }, [anthropometryEntries, nowTs]);

  const weightLast15 = useMemo(() => {
    const limit = nowTs - 15 * 24 * 60 * 60 * 1000;
    const rows = anthropometryEntries
      .filter((entry) => getTimestamp(entry.createdAt) >= limit)
      .map((entry) => toNumber(entry.pesoKg))
      .filter((value): value is number => value !== null);

    if (rows.length === 0) return null;
    return Number((rows.reduce((acc, value) => acc + value, 0) / rows.length).toFixed(2));
  }, [anthropometryEntries, nowTs]);

  const weightHistoric = useMemo(() => {
    const rows = anthropometryEntries
      .map((entry) => toNumber(entry.pesoKg))
      .filter((value): value is number => value !== null);

    if (rows.length === 0) return null;
    return Number((rows.reduce((acc, value) => acc + value, 0) / rows.length).toFixed(2));
  }, [anthropometryEntries]);

  const studentHeightCm = useMemo(() => {
    const fromAlumno = toNumber(alumnoProfile?.altura);
    if (fromAlumno !== null && fromAlumno >= 120 && fromAlumno <= 230) return fromAlumno;

    const fromAnthro = toNumber(latestAnthropometry?.alturaCm);
    if (fromAnthro !== null && fromAnthro >= 120 && fromAnthro <= 230) return fromAnthro;

    const fromMeta = toNumber(clientMeta?.alturaCm);
    if (fromMeta !== null && fromMeta >= 120 && fromMeta <= 230) return fromMeta;

    return null;
  }, [alumnoProfile?.altura, clientMeta?.alturaCm, latestAnthropometry?.alturaCm]);

  const bmiSnapshot = useMemo(() => {
    const latestWeight = toNumber(latestAnthropometry?.pesoKg) ?? weightLast7 ?? weightHistoric;
    if (latestWeight === null || studentHeightCm === null) return null;

    const heightM = studentHeightCm / 100;
    if (heightM <= 0) return null;

    const bmi = latestWeight / (heightM * heightM);
    const healthyMinWeight = Number((18.5 * heightM * heightM).toFixed(1));
    const healthyMaxWeight = Number((24.9 * heightM * heightM).toFixed(1));
    const tone = resolveBmiTone(bmi);

    return {
      bmi: Number(bmi.toFixed(1)),
      label: tone.label,
      tone: tone.tone,
      healthyRange: `${healthyMinWeight.toFixed(1)}-${healthyMaxWeight.toFixed(1)} kg`,
      heightLabel: `${Math.round(studentHeightCm)} cm`,
      currentWeightLabel: `${latestWeight.toFixed(1)} kg`,
    };
  }, [latestAnthropometry?.pesoKg, studentHeightCm, weightHistoric, weightLast7]);

  const bodyMetricsCards = useMemo<
    Array<{
      key: string;
      label: string;
      value: string;
      detail: string;
      tone?: "ok" | "warning" | "danger";
    }>
  >(() => {
    const latestWeight = toNumber(latestAnthropometry?.pesoKg) ?? weightLast7 ?? weightHistoric;
    const cinturaCm = toNumber(latestAnthropometry?.cinturaCm);
    const grasaPct = toNumber(latestAnthropometry?.grasaPct);
    const caderaCm = toNumber(latestAnthropometry?.caderaCm);

    return [
      {
        key: "imc",
        label: "IMC",
        value: bmiSnapshot ? String(bmiSnapshot.bmi) : "-",
        detail: bmiSnapshot
          ? `${bmiSnapshot.label} · Rango saludable ${bmiSnapshot.healthyRange}`
          : "Se calcula automatico con altura y peso.",
        tone: bmiSnapshot?.tone,
      },
      {
        key: "peso-actual",
        label: "Peso actual",
        value: formatMetricValue(latestWeight, "kg"),
        detail: weightSparkline ? `Ultimo registro ${weightSparkline.lastDateLabel}` : "Sin registros recientes.",
      },
      {
        key: "altura",
        label: "Altura",
        value: studentHeightCm !== null ? `${Math.round(studentHeightCm)} cm` : "-",
        detail:
          studentHeightCm !== null
            ? `Cadera: ${formatMetricValue(caderaCm, "cm")}`
            : "Carga tu altura para afinar el IMC.",
      },
      {
        key: "grasa",
        label: "Grasa corporal",
        value: formatMetricValue(grasaPct, "%"),
        detail:
          grasaPct !== null
            ? `Cintura: ${formatMetricValue(cinturaCm, "cm")}`
            : "Sin dato cargado.",
      },
    ];
  }, [
    bmiSnapshot,
    latestAnthropometry?.caderaCm,
    latestAnthropometry?.cinturaCm,
    latestAnthropometry?.grasaPct,
    latestAnthropometry?.pesoKg,
    studentHeightCm,
    weightHistoric,
    weightLast7,
    weightSparkline,
  ]);

  const categoryMeta = CATEGORY_COPY[activeCategory];
  const isRootCategory = activeCategory === "inicio";
  const heroTitle = categoryMeta.title;
  const heroSubtitle = `Vista ${categoryMeta.short.toLowerCase()}. Usa la flecha para volver a la pantalla anterior.`;

  const backTargetCategory = useMemo<MainCategory>(() => {
    const history = categoryHistoryRef.current;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const candidate = history[index];
      if (candidate !== activeCategory) {
        return candidate;
      }
    }
    return "inicio";
  }, [activeCategory]);

  const backTargetHref = `/alumnos/${backTargetCategory}`;
  const backLabel =
    backTargetCategory === "inicio"
      ? "Volver al inicio"
      : `Volver a ${CATEGORY_COPY[backTargetCategory].short.toLowerCase()}`;

  const goToCategory = useCallback(
    (nextCategory: MainCategory, options?: { trackHistory?: boolean }) => {
      const currentCategory = activeCategoryRef.current;
      if (nextCategory === currentCategory) return;

      if (options?.trackHistory !== false) {
        const history = categoryHistoryRef.current;
        if (history[history.length - 1] !== currentCategory) {
          history.push(currentCategory);
          if (history.length > 24) {
            history.splice(0, history.length - 24);
          }
        }
      }

      activeCategoryRef.current = nextCategory;
      setActiveCategory(nextCategory);

      const targetHref = `/alumnos/${nextCategory}`;

      if (typeof window !== "undefined") {
        const currentUrl = new URL(window.location.href);
        const nextUrl = `${targetHref}${currentUrl.search}`;
        window.history.replaceState(window.history.state ?? null, "", nextUrl);
        return;
      }

      router.replace(targetHref, { scroll: false });
    },
    [router]
  );

  const goToPreviousCategory = useCallback(() => {
    const currentCategory = activeCategoryRef.current;
    const history = categoryHistoryRef.current;

    let targetCategory: MainCategory = "inicio";
    while (history.length > 0) {
      const candidate = history.pop();
      if (candidate && candidate !== currentCategory) {
        targetCategory = candidate;
        break;
      }
    }

    const targetHref = `/alumnos/${targetCategory}`;

    if (typeof window === "undefined") {
      router.replace(targetHref, { scroll: false });
      return;
    }

    const now = Date.now();
    if (now - homeNavGuardRef.current < 260) {
      return;
    }
    homeNavGuardRef.current = now;

    goToCategory(targetCategory, { trackHistory: false });

    const fallbackDelay = isUltraMobile ? 60 : 180;
    window.setTimeout(() => {
      if (window.location.pathname !== targetHref) {
        window.location.assign(targetHref);
      }
    }, fallbackDelay);
  }, [goToCategory, isUltraMobile, router]);

  const openPayments = useCallback(() => {
    const targetHref = "/alumnos/pagos";

    if (typeof window === "undefined") {
      router.push(targetHref);
      return;
    }

    if (isUltraMobile) {
      window.location.assign(targetHref);
      return;
    }

    router.push(targetHref);

    window.setTimeout(() => {
      if (window.location.pathname !== targetHref) {
        window.location.assign(targetHref);
      }
    }, 180);
  }, [isUltraMobile, router]);

  const openMusicPlaylistExternal = useCallback((assignment: MusicAssignmentLite) => {
    const playlistUrl = normalizeMusicUrl(String(assignment.playlistUrl || ""));
    if (!playlistUrl || typeof window === "undefined") return;
    window.open(playlistUrl, "_blank", "noopener,noreferrer");
  }, []);

  const selectMusicAssignment = useCallback(
    (assignment: MusicAssignmentLite, index: number) => {
      const assignmentId = resolveMusicAssignmentId(assignment, index);
      const platform = resolveMusicPlatform(assignment.platform, assignment.playlistUrl);
      const player = resolveMusicPlayerSource(platform, String(assignment.playlistUrl || ""));

      setSelectedMusicAssignmentId(assignmentId);

      if (player.kind === "none") {
        openMusicPlaylistExternal(assignment);
      }
    },
    [openMusicPlaylistExternal]
  );

  const handleHomeMusicCardPress = useCallback(
    (track: HomeMusicCard) => {
      if (track.playlistUrl) {
        setSelectedMusicAssignmentId(track.id);
      }
      goToCategory("musica");
    },
    [goToCategory]
  );

  useEffect(() => {
    if (isUltraMobile) return;

    CATEGORIES.forEach((category) => {
      router.prefetch(`/alumnos/${category}`);
    });
  }, [isUltraMobile, router]);

  const toggleRoutineBlock = useCallback((blockKey: string) => {
    setExpandedRoutineBlocks((previous) => ({
      ...previous,
      [blockKey]: !previous[blockKey],
    }));
  }, []);

  const selectedRoutineEntry = routineEntries[0] || null;

  const currentRoutineFeedbackIdentityKey = useMemo(() => {
    if (!selectedRoutineEntry) {
      return "";
    }

    return buildSessionFeedbackIdentityKey({
      alumnoNombre: profileName,
      alumnoEmail: profileEmail,
      sessionId: selectedRoutineEntry.sesion.id,
      weekId: selectedRoutineEntry.weekId,
      dayId: selectedRoutineEntry.dayId,
    });
  }, [profileEmail, profileName, selectedRoutineEntry]);

  const existingRoutineSessionFeedback = useMemo<SessionFeedbackRecordLite | null>(() => {
    if (!currentRoutineFeedbackIdentityKey) {
      return null;
    }

    return (
      sessionFeedbackRecords.find(
        (item) => buildSessionFeedbackIdentityKey(item) === currentRoutineFeedbackIdentityKey
      ) || null
    );
  }, [currentRoutineFeedbackIdentityKey, sessionFeedbackRecords]);

  const selectedRoutineDayWorkoutLogs = useMemo(() => {
    if (!selectedRoutineEntry) {
      return [];
    }

    const sessionId = String(selectedRoutineEntry.sesion.id || "").trim();
    const dayId = String(selectedRoutineEntry.dayId || "").trim();

    return workoutLogs.filter((log) => {
      const logSessionId = String(log.sessionId || "").trim();
      const logDayId = String(log.dayId || "").trim();

      if (!sessionId || logSessionId !== sessionId) {
        return false;
      }

      if (dayId && logDayId && logDayId !== dayId) {
        return false;
      }

      return true;
    });
  }, [selectedRoutineEntry, workoutLogs]);

  const selectedRoutineDayLogSummary = useMemo(() => {
    return {
      total: selectedRoutineDayWorkoutLogs.length,
      withPain: selectedRoutineDayWorkoutLogs.filter((log) => Boolean(log.molestia)).length,
    };
  }, [selectedRoutineDayWorkoutLogs]);

  const routineSessionFeedbackHistory = useMemo(() => {
    return sessionFeedbackRecords.slice(0, 14);
  }, [sessionFeedbackRecords]);

  const routineVisibleBlocks = useMemo(() => {
    if (!selectedRoutineEntry) return [];
    if (!isUltraMobile) return selectedRoutineEntry.blocks;
    return selectedRoutineEntry.blocks.slice(0, Math.max(1, visibleRoutineBlockCount));
  }, [isUltraMobile, selectedRoutineEntry, visibleRoutineBlockCount]);

  const routineRemainingBlocks = useMemo(() => {
    if (!selectedRoutineEntry) return 0;
    return Math.max(0, selectedRoutineEntry.blocks.length - routineVisibleBlocks.length);
  }, [routineVisibleBlocks.length, selectedRoutineEntry]);

  const routineUpdatedAtLabel = useMemo(() => {
    const updatedAt = selectedRoutineEntry?.prescripcion?.createdAt;
    if (updatedAt) {
      return `${formatDateTime(updatedAt)} hs`;
    }
    return `${formatDateTime(new Date(nowTs))} hs`;
  }, [nowTs, selectedRoutineEntry]);

  // Flatten the visible blocks/exercises into a guided-flow sequence.
  type GuidedExerciseStep = {
    blockId: string;
    blockTitle: string;
    blockIndex: number;
    rowId: string;
    rowName: string;
    isSuperSerie: boolean;
    detail: ReturnType<typeof ejerciciosById.get> | null;
    series: string;
    repeticiones: string;
    descanso: string;
    carga: string;
    rir: string;
    videoUrl: string;
    description: string;
    tags: string[];
  };

  const guidedRoutineSteps = useMemo<GuidedExerciseStep[]>(() => {
    if (!selectedRoutineEntry) return [];
    const steps: GuidedExerciseStep[] = [];

    selectedRoutineEntry.blocks.forEach((block, blockIndex) => {
      block.ejercicios.forEach((exercise, exerciseIndex) => {
        const exerciseRow = exercise as Record<string, unknown>;
        const exerciseRowId = String(
          exerciseRow.id || exercise.ejercicioId || `${block.id}-ex-${exerciseIndex}`
        );
        const baseDetail = exercise.ejercicioId ? ejerciciosById.get(exercise.ejercicioId) || null : null;
        const baseTags = Array.from(
          new Set([
            ...(Array.isArray(baseDetail?.gruposMusculares) ? baseDetail.gruposMusculares : []),
            String(baseDetail?.categoria || "").trim(),
          ].filter(Boolean))
        ).slice(0, 6);
        const baseMetricas = Array.isArray(exercise.metricas) ? exercise.metricas : [];
        const baseRir = baseMetricas.find((metric: any) =>
          normalizePersonKey(String(metric?.nombre || "")).includes("rir")
        );
        steps.push({
          blockId: block.id,
          blockTitle: block.titulo || `Bloque ${blockIndex + 1}`,
          blockIndex,
          rowId: exerciseRowId,
          rowName: String(baseDetail?.nombre || `Ejercicio ${exerciseIndex + 1}`),
          isSuperSerie: false,
          detail: baseDetail,
          series: String(exercise.series || ""),
          repeticiones: String(exercise.repeticiones || ""),
          descanso: String(exercise.descanso || ""),
          carga: String(exercise.carga || ""),
          rir: String((baseRir as any)?.valor || ""),
          videoUrl: String(baseDetail?.videoUrl || ""),
          description: String(baseDetail?.objetivo || baseDetail?.descripcion || "").trim() || "Ejecuta con tecnica y control",
          tags: baseTags,
        });

        if (Array.isArray(exercise.superSerie)) {
          exercise.superSerie.forEach((superItem: any, superIndex: number) => {
            const superDetail = superItem?.ejercicioId
              ? ejerciciosById.get(superItem.ejercicioId) || null
              : null;
            const superTags = Array.from(
              new Set([
                ...(Array.isArray(superDetail?.gruposMusculares) ? superDetail.gruposMusculares : []),
                String(superDetail?.categoria || "").trim(),
                "Superserie",
              ].filter(Boolean))
            ).slice(0, 6);
            steps.push({
              blockId: block.id,
              blockTitle: block.titulo || `Bloque ${blockIndex + 1}`,
              blockIndex,
              rowId: `${exerciseRowId}::${superItem?.id || `super-${superIndex}`}`,
              rowName: String(superDetail?.nombre || `Superserie ${superIndex + 1}`),
              isSuperSerie: true,
              detail: superDetail,
              series: String(superItem?.series || ""),
              repeticiones: String(superItem?.repeticiones || ""),
              descanso: String(superItem?.descanso || ""),
              carga: String(superItem?.carga || ""),
              rir: "",
              videoUrl: String(superDetail?.videoUrl || ""),
              description:
                String(superDetail?.objetivo || superDetail?.descripcion || "").trim() ||
                `Superserie vinculada a ${baseDetail?.nombre || "ejercicio principal"}`,
              tags: superTags,
            });
          });
        }
      });
    });

    return steps;
  }, [ejerciciosById, selectedRoutineEntry]);

  const todayDateKey = useMemo(() => {
    const d = new Date(nowTs);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [nowTs]);

  const todayRoutineCompletion = useMemo<TrainingCompletionLite | null>(() => {
    if (!selectedRoutineEntry) return null;
    const weekId = String(selectedRoutineEntry.weekId || "");
    const dayId = String(selectedRoutineEntry.dayId || "");
    return (
      trainingCompletions.find(
        (entry) =>
          entry.weekId === weekId &&
          entry.dayId === dayId &&
          entry.fecha === todayDateKey
      ) || null
    );
  }, [selectedRoutineEntry, todayDateKey, trainingCompletions]);

  const markRoutineCompletedToday = useCallback(() => {
    if (!selectedRoutineEntry) return;
    const weekId = String(selectedRoutineEntry.weekId || "");
    const dayId = String(selectedRoutineEntry.dayId || "");
    markManualSaveIntent(TRAINING_COMPLETIONS_KEY);
    setTrainingCompletions((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const filtered = base.filter(
        (entry) =>
          !(
            entry.weekId === weekId &&
            entry.dayId === dayId &&
            entry.fecha === todayDateKey
          )
      );
      const next: TrainingCompletionLite = {
        weekId,
        dayId,
        sessionId: selectedRoutineEntry.sesion.id,
        fecha: todayDateKey,
        completedAt: new Date().toISOString(),
      };
      return [...filtered, next];
    });
  }, [selectedRoutineEntry, setTrainingCompletions, todayDateKey]);

  const clearRoutineCompletionToday = useCallback(() => {
    if (!selectedRoutineEntry) return;
    const weekId = String(selectedRoutineEntry.weekId || "");
    const dayId = String(selectedRoutineEntry.dayId || "");
    markManualSaveIntent(TRAINING_COMPLETIONS_KEY);
    setTrainingCompletions((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return base.filter(
        (entry) =>
          !(
            entry.weekId === weekId &&
            entry.dayId === dayId &&
            entry.fecha === todayDateKey
          )
      );
    });
  }, [selectedRoutineEntry, setTrainingCompletions, todayDateKey]);

  const buildGuidedExerciseTarget = useCallback(
    (step: GuidedExerciseStep): RoutineExerciseLogTarget | null => {
      if (!selectedRoutineEntry) return null;
      const exerciseKey = buildRoutineExerciseKey(
        selectedRoutineEntry.sesion.id,
        selectedRoutineEntry.weekId,
        selectedRoutineEntry.dayId,
        step.blockId,
        step.rowId,
        step.blockIndex * 100
      );
      return {
        sessionId: selectedRoutineEntry.sesion.id,
        sessionTitle: selectedRoutineEntry.sesion.titulo,
        weekId: selectedRoutineEntry.weekId,
        weekName: selectedRoutineEntry.weekName,
        dayId: selectedRoutineEntry.dayId,
        dayName: selectedRoutineEntry.dayName,
        blockId: step.blockId,
        blockTitle: step.blockTitle,
        exerciseId: step.rowId,
        exerciseName: step.rowName,
        exerciseKey,
        prescribedSeries: step.series,
        prescribedRepeticiones: step.repeticiones,
        prescribedCarga: step.carga,
        prescribedDescanso: step.descanso,
        prescribedRir: step.rir,
        suggestedVideoUrl: step.videoUrl,
        exerciseDescription: step.description,
        exerciseTags: step.tags,
      };
    },
    [selectedRoutineEntry]
  );

  const startGuidedTraining = useCallback(() => {
    if (guidedRoutineSteps.length === 0) return;
    if (guidedPausedState) {
      // Resume from paused position, restoring the saved draft
      const resumeIndex = Math.min(guidedPausedState.index, guidedRoutineSteps.length - 1);
      const resumeStep = guidedRoutineSteps[resumeIndex];
      const target = buildGuidedExerciseTarget(resumeStep);
      setGuidedTrainingIndex(resumeIndex);
      setGuidedTrainingMode(true);
      setGuidedStepKey((k) => k + 1);
      if (target) {
        // Open panel but preserve the saved draft
        if (routineExerciseLogStatusTimerRef.current !== null && typeof window !== "undefined") {
          window.clearTimeout(routineExerciseLogStatusTimerRef.current);
          routineExerciseLogStatusTimerRef.current = null;
        }
        setRoutineExerciseLogStatus("");
        setRoutineExerciseLogEditingId(null);
        setRoutineExerciseLogView("registro");
        setRoutineExerciseLogTarget(target);
        setRoutineExerciseLogDraft(guidedPausedState.draft);
      }
      setGuidedPausedState(null);
      return;
    }
    const firstStep = guidedRoutineSteps[0];
    const target = buildGuidedExerciseTarget(firstStep);
    setGuidedTrainingIndex(0);
    setGuidedTrainingMode(true);
    setGuidedStepKey((k) => k + 1);
    setGuidedPausedState(null);
    if (target) {
      openLogPanelRef.current?.(target);
    }
  }, [
    buildGuidedExerciseTarget,
    guidedPausedState,
    guidedRoutineSteps,
    routineExerciseLogStatusTimerRef,
    setRoutineExerciseLogDraft,
    setRoutineExerciseLogEditingId,
    setRoutineExerciseLogStatus,
    setRoutineExerciseLogTarget,
    setRoutineExerciseLogView,
  ]);

  const advanceGuidedTraining = useCallback(() => {
    if (!guidedTrainingMode) return;
    const nextIndex = guidedTrainingIndex + 1;
    if (nextIndex >= guidedRoutineSteps.length) {
      markRoutineCompletedToday();
      setGuidedTrainingMode(false);
      closeLogPanelRef.current?.();
      openFinalizePanelRef.current?.();
      return;
    }
    const nextStep = guidedRoutineSteps[nextIndex];
    const target = buildGuidedExerciseTarget(nextStep);
    setGuidedTrainingIndex(nextIndex);
    setGuidedStepKey((k) => k + 1);
    if (target) {
      openLogPanelRef.current?.(target);
    }
  }, [
    buildGuidedExerciseTarget,
    guidedRoutineSteps,
    guidedTrainingIndex,
    guidedTrainingMode,
    markRoutineCompletedToday,
  ]);

  const goBackGuidedTraining = useCallback(() => {
    if (!guidedTrainingMode || guidedTrainingIndex <= 0) return;
    const prevIndex = guidedTrainingIndex - 1;
    const prevStep = guidedRoutineSteps[prevIndex];
    const target = buildGuidedExerciseTarget(prevStep);
    setGuidedTrainingIndex(prevIndex);
    setGuidedStepKey((k) => k + 1);
    if (target) {
      openLogPanelRef.current?.(target);
    }
  }, [buildGuidedExerciseTarget, guidedRoutineSteps, guidedTrainingIndex, guidedTrainingMode]);

  const exitGuidedTraining = useCallback(() => {
    setGuidedPausedState({ index: guidedTrainingIndex, draft: routineExerciseLogDraft });
    setGuidedTrainingMode(false);
    closeLogPanelRef.current?.();
  }, [guidedTrainingIndex, routineExerciseLogDraft]);

  const routineLastSyncLabel = useMemo(() => {
    if (!routineLastSyncAt) {
      return "Ultima sincronizacion: pendiente";
    }

    return `Ultima sincronizacion: ${formatDateTime(new Date(routineLastSyncAt))} hs`;
  }, [routineLastSyncAt]);

  const routineStopwatchDisplay = useMemo(
    () => formatStopwatchDuration(routineStopwatchElapsedMs),
    [routineStopwatchElapsedMs]
  );

  const routineStopwatchStatusShortLabel = useMemo(() => {
    if (routineStopwatchRunning) {
      return "En marcha";
    }

    if (routineStopwatchElapsedMs > 0) {
      return "Pausado";
    }

    return "Listo";
  }, [routineStopwatchElapsedMs, routineStopwatchRunning]);

  const selectedRoutineWeekIndex = useMemo(() => {
    if (!selectedRoutineWeek || routineWeeks.length === 0) {
      return -1;
    }

    return routineWeeks.findIndex((week) => week.id === selectedRoutineWeek.id);
  }, [routineWeeks, selectedRoutineWeek]);

  const canGoPrevRoutineWeek = selectedRoutineWeekIndex > 0;
  const canGoNextRoutineWeek =
    selectedRoutineWeekIndex >= 0 && selectedRoutineWeekIndex < routineWeeks.length - 1;

  const routineWeekLabel = useMemo(() => {
    if (!selectedRoutineWeek) {
      return "Semana 1";
    }

    const rawName = String(selectedRoutineWeek.nombre || "").trim();
    if (rawName) return rawName;

    if (selectedRoutineWeekIndex >= 0) {
      return `Semana ${selectedRoutineWeekIndex + 1}`;
    }

    return "Semana 1";
  }, [selectedRoutineWeek, selectedRoutineWeekIndex]);

  const routineSyncStatusLabel = useMemo(() => {
    if (!weekPlanSyncLoaded) {
      return "Sincronizando plan semanal...";
    }

    if (!workoutLogsSyncLoaded) {
      return "Sincronizando registros...";
    }

    if (hasWeekPlanRoutine) {
      return routineLastSyncLabel;
    }

    return "Esperando plan semanal del profe";
  }, [hasWeekPlanRoutine, routineLastSyncLabel, weekPlanSyncLoaded, workoutLogsSyncLoaded]);

  const routineCoachLabel = useMemo(() => {
    const fallbackCoach = String(coachContact?.nombre || "PF Control").trim();
    if (fallbackCoach) return fallbackCoach;
    return "PF Control";
  }, [coachContact?.nombre]);

  const routineExerciseVideoCandidate = useMemo(() => {
    if (!routineExerciseLogTarget) {
      return "";
    }

    return (
      String(routineExerciseLogDraft.videoDataUrl || "").trim() ||
      String(routineExerciseLogDraft.videoUrl || "").trim() ||
      String(routineExerciseLogTarget.suggestedVideoUrl || "").trim()
    );
  }, [routineExerciseLogDraft.videoDataUrl, routineExerciseLogDraft.videoUrl, routineExerciseLogTarget]);

  const routineExerciseVideoSource = useMemo(() => {
    return resolveRoutineExerciseVideoSource(routineExerciseVideoCandidate);
  }, [routineExerciseVideoCandidate]);

  const routinePainRecommendation = useMemo(() => {
    if (!routineExerciseLogDraft.molestia) {
      return "";
    }

    return resolveRoutinePainTrainingRecommendation({
      dolorUbicacion: routineExerciseLogDraft.dolorUbicacion,
      dolorMomento: routineExerciseLogDraft.dolorMomento,
      dolorSensacion: routineExerciseLogDraft.dolorSensacion,
    });
  }, [
    routineExerciseLogDraft.dolorMomento,
    routineExerciseLogDraft.dolorSensacion,
    routineExerciseLogDraft.dolorUbicacion,
    routineExerciseLogDraft.molestia,
  ]);

  const routineExerciseRecentLogs = useMemo(() => {
    if (!routineExerciseLogTarget) {
      return [];
    }

    return workoutLogs
      .filter((log) => {
        if (log.exerciseKey && routineExerciseLogTarget.exerciseKey) {
          if (log.exerciseKey === routineExerciseLogTarget.exerciseKey) {
            return true;
          }
        }

        const bySession =
          !routineExerciseLogTarget.sessionId ||
          !log.sessionId ||
          String(log.sessionId).trim() === String(routineExerciseLogTarget.sessionId).trim();
        if (!bySession) {
          return false;
        }

        const byDay =
          !routineExerciseLogTarget.dayId || !log.dayId || String(log.dayId).trim() === String(routineExerciseLogTarget.dayId).trim();
        if (!byDay) {
          return false;
        }

        const byExerciseId =
          String(log.exerciseId || "").trim() &&
          String(log.exerciseId || "").trim() === routineExerciseLogTarget.exerciseId;
        const byExerciseName = namesLikelyMatch(log.exerciseName || "", routineExerciseLogTarget.exerciseName);

        if (byExerciseId || byExerciseName) {
          return true;
        }

        return false;
      })
      .slice(0, 6);
  }, [routineExerciseLogTarget, workoutLogs]);

  const clearRoutineExerciseLogStatusTimer = useCallback(() => {
    if (routineExerciseLogStatusTimerRef.current === null || typeof window === "undefined") {
      routineExerciseLogStatusTimerRef.current = null;
      return;
    }

    window.clearTimeout(routineExerciseLogStatusTimerRef.current);
    routineExerciseLogStatusTimerRef.current = null;
  }, []);

  const scheduleRoutineExerciseLogStatusReset = useCallback(
    (delayMs = 2200) => {
      clearRoutineExerciseLogStatusTimer();
      if (typeof window === "undefined") {
        return;
      }

      routineExerciseLogStatusTimerRef.current = window.setTimeout(() => {
        routineExerciseLogStatusTimerRef.current = null;
        setRoutineExerciseLogStatus("");
      }, delayMs);
    },
    [clearRoutineExerciseLogStatusTimer]
  );

  const openRoutineExerciseLogPanel = useCallback((target: RoutineExerciseLogTarget) => {
    clearRoutineExerciseLogStatusTimer();
    setRoutineExerciseLogStatus("");
    setRoutineExerciseLogEditingId(null);
    setRoutineExerciseLogView("registro");
    setRoutineExerciseLogTarget(target);
    setRoutineExerciseLogDraft(
      createRoutineExerciseLogDraft({
        series: String(target.prescribedSeries || "").trim(),
        repeticiones: String(target.prescribedRepeticiones || "").trim(),
        pesoKg: String(target.prescribedCarga || "").trim(),
        videoUrl: String(target.suggestedVideoUrl || "").trim(),
      })
    );
  }, [clearRoutineExerciseLogStatusTimer]);

  const closeRoutineExerciseLogPanel = useCallback(() => {
    clearRoutineExerciseLogStatusTimer();
    setRoutineExerciseLogTarget(null);
    setRoutineExerciseLogEditingId(null);
    setRoutineExerciseLogStatus("");
    setRoutineExerciseLogView("registro");
    setRoutineExerciseLogDraft(createRoutineExerciseLogDraft());
  }, [clearRoutineExerciseLogStatusTimer]);

  useEffect(() => {
    openLogPanelRef.current = openRoutineExerciseLogPanel;
    closeLogPanelRef.current = closeRoutineExerciseLogPanel;
  }, [openRoutineExerciseLogPanel, closeRoutineExerciseLogPanel]);

  const routineSelectionSnapshotRef = useRef<string | null>(null);

  const triggerRoutineDayWeekLoading = useCallback(() => {
    setRoutineDayWeekLoading(true);

    if (routineDayWeekLoadingTimerRef.current !== null) {
      window.clearTimeout(routineDayWeekLoadingTimerRef.current);
      routineDayWeekLoadingTimerRef.current = null;
    }

    routineDayWeekLoadingTimerRef.current = window.setTimeout(() => {
      routineDayWeekLoadingTimerRef.current = null;
      setRoutineDayWeekLoading(false);
    }, ROUTINE_DAY_WEEK_MIN_LOADING_MS);
  }, []);

  useLayoutEffect(() => {
    if (activeCategory !== "rutina") {
      routineSelectionSnapshotRef.current = null;
      return;
    }

    const nextSelectionKey = hasWeekPlanRoutine
      ? `${selectedRoutineWeek?.id || selectedRoutineWeekId || ""}:${selectedRoutineDay?.id || selectedRoutineDayId || ""}`
      : String(selectedRoutineSessionId || "").trim();

    if (!nextSelectionKey || nextSelectionKey === ":") {
      return;
    }

    if (routineSelectionSnapshotRef.current === null) {
      routineSelectionSnapshotRef.current = nextSelectionKey;
      return;
    }

    if (routineSelectionSnapshotRef.current !== nextSelectionKey) {
      routineSelectionSnapshotRef.current = nextSelectionKey;
      triggerRoutineDayWeekLoading();
    }
  }, [
    activeCategory,
    hasWeekPlanRoutine,
    selectedRoutineDay?.id,
    selectedRoutineDayId,
    selectedRoutineSessionId,
    selectedRoutineWeek?.id,
    selectedRoutineWeekId,
    triggerRoutineDayWeekLoading,
  ]);

  useEffect(() => {
    return () => {
      clearRoutineExerciseLogStatusTimer();
    };
  }, [clearRoutineExerciseLogStatusTimer]);

  const handleRoutineSessionSelect = useCallback(
    (sessionId: string) => {
      if (sessionId === selectedRoutineSessionId) return;

      triggerRoutineDayWeekLoading();
      setSelectedRoutineSessionId(sessionId);
      setRoutineExerciseLogTarget(null);
      clearRoutineExerciseLogStatusTimer();
      setRoutineExerciseLogStatus("");
      setExpandedRoutineBlocks({});
      setVisibleRoutineBlockCount(ULTRA_MOBILE_INITIAL_BLOCKS);
    },
    [clearRoutineExerciseLogStatusTimer, selectedRoutineSessionId, triggerRoutineDayWeekLoading]
  );

  const handleRoutineWeekStep = useCallback(
    (step: -1 | 1) => {
      if (!selectedRoutineWeek || routineWeeks.length === 0) return;

      const currentIndex = routineWeeks.findIndex((week) => week.id === selectedRoutineWeek.id);
      if (currentIndex < 0) return;

      const nextIndex = Math.max(0, Math.min(routineWeeks.length - 1, currentIndex + step));
      const nextWeek = routineWeeks[nextIndex];
      if (!nextWeek) return;

      const visibleDays = (Array.isArray(nextWeek.dias) ? nextWeek.dias : []).filter((day) => !day.oculto);

      triggerRoutineDayWeekLoading();
      setSelectedRoutineWeekId(nextWeek.id);
      setSelectedRoutineDayId(visibleDays[0]?.id || null);
      setRoutineExerciseLogTarget(null);
      clearRoutineExerciseLogStatusTimer();
      setRoutineExerciseLogStatus("");
      setExpandedRoutineBlocks({});
      setVisibleRoutineBlockCount(ULTRA_MOBILE_INITIAL_BLOCKS);
    },
    [clearRoutineExerciseLogStatusTimer, routineWeeks, selectedRoutineWeek, triggerRoutineDayWeekLoading]
  );

  const handleRoutineDaySelect = useCallback(
    (dayId: string) => {
      if (dayId === selectedRoutineDay?.id) return;

      triggerRoutineDayWeekLoading();
      setSelectedRoutineDayId(dayId);
      setRoutineExerciseLogTarget(null);
      clearRoutineExerciseLogStatusTimer();
      setRoutineExerciseLogStatus("");
      setExpandedRoutineBlocks({});
      setVisibleRoutineBlockCount(ULTRA_MOBILE_INITIAL_BLOCKS);
    },
    [clearRoutineExerciseLogStatusTimer, selectedRoutineDay?.id, triggerRoutineDayWeekLoading]
  );

  const triggerRoutineRefresh = useCallback(() => {
    setRoutinePullRefreshing(true);
    clearRoutineExerciseLogStatusTimer();
    setRoutineExerciseLogStatus("");
    setExpandedRoutineBlocks({});
    setVisibleRoutineBlockCount(ULTRA_MOBILE_INITIAL_BLOCKS);
    setNowTs(Date.now());
    scheduleStorageRefresh();

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setRoutinePullRefreshing(false);
      }, 720);
    } else {
      setRoutinePullRefreshing(false);
    }
  }, [clearRoutineExerciseLogStatusTimer, scheduleStorageRefresh]);

  const handleRoutineTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (activeCategory !== "rutina") return;
      if (typeof window === "undefined") return;
      if (window.scrollY > 2) {
        routinePullActiveRef.current = false;
        routinePullStartYRef.current = null;
        return;
      }

      const firstTouch = event.touches?.[0];
      if (!firstTouch) return;

      routinePullStartYRef.current = firstTouch.clientY;
      routinePullActiveRef.current = true;
    },
    [activeCategory]
  );

  const handleRoutineTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (!routinePullActiveRef.current || routinePullRefreshing) return;

    const firstTouch = event.touches?.[0];
    if (!firstTouch) return;

    const startY = routinePullStartYRef.current;
    if (startY === null) return;

    const delta = firstTouch.clientY - startY;
    if (delta <= 0) {
      routinePullDistanceRef.current = 0;
      setRoutinePullDistance(0);
      return;
    }

    const nextDistance = Math.min(ROUTINE_PULL_MAX_DISTANCE, delta * 0.55);
    routinePullDistanceRef.current = nextDistance;
    setRoutinePullDistance(nextDistance);

    if (nextDistance > 0) {
      event.preventDefault();
    }
  }, [routinePullRefreshing]);

  const handleRoutineTouchEnd = useCallback(() => {
    if (!routinePullActiveRef.current) return;

    routinePullActiveRef.current = false;
    routinePullStartYRef.current = null;

    const shouldRefresh = routinePullDistanceRef.current >= ROUTINE_PULL_THRESHOLD;
    routinePullDistanceRef.current = 0;
    setRoutinePullDistance(0);

    if (shouldRefresh) {
      triggerRoutineRefresh();
    }
  }, [triggerRoutineRefresh]);

  const handleRoutineVideoUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (file.size > MAX_WORKOUT_VIDEO_UPLOAD_BYTES) {
        clearRoutineExerciseLogStatusTimer();
        setRoutineExerciseLogStatus("El video supera 2 MB. Usa un clip mas corto o pega URL de YouTube.");
        setRoutineExerciseLogDraft((previous) => ({
          ...previous,
          videoDataUrl: "",
          videoFileName: "",
          videoMimeType: "",
        }));
        event.target.value = "";
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        setRoutineExerciseLogDraft((previous) => ({
          ...previous,
          videoDataUrl: dataUrl,
          videoFileName: file.name,
          videoMimeType: file.type || "video/mp4",
        }));
        clearRoutineExerciseLogStatusTimer();
        setRoutineExerciseLogStatus("Video adjuntado al registro.");
      } catch {
        clearRoutineExerciseLogStatusTimer();
        setRoutineExerciseLogStatus("No se pudo leer el archivo de video.");
      }
    },
    [clearRoutineExerciseLogStatusTimer]
  );

  const openRoutineVideoExternal = useCallback((rawUrl: string) => {
    const normalized = normalizeMusicUrl(String(rawUrl || ""));
    if (!normalized || typeof window === "undefined") return;
    window.open(normalized, "_blank", "noopener,noreferrer");
  }, []);

  const saveRoutineExerciseLog = useCallback(() => {
    if (!routineExerciseLogTarget || routineExerciseLogSaving) {
      return;
    }

    const editingLogId = routineExerciseLogEditingId;

    const parsedSeries =
      Math.max(
        1,
        Math.round(
          Number(
            toSafeNumeric(routineExerciseLogDraft.series) ??
              toSafeNumeric(routineExerciseLogTarget.prescribedSeries) ??
              1
          )
        )
      ) || 1;
    const parsedRepeticiones =
      Math.max(
        0,
        Math.round(
          Number(
            toSafeNumeric(routineExerciseLogDraft.repeticiones) ??
              toSafeNumeric(routineExerciseLogTarget.prescribedRepeticiones) ??
              0
          )
        )
      ) || 0;
    const parsedPeso = Math.max(
      0,
      Number(toSafeNumeric(routineExerciseLogDraft.pesoKg) ?? toSafeNumeric(routineExerciseLogTarget.prescribedCarga) ?? 0)
    );
    const cleanComentario = String(routineExerciseLogDraft.comentarios || "").trim();
    const dolorUbicacion = String(routineExerciseLogDraft.dolorUbicacion || "").trim();
    const dolorMomento = String(routineExerciseLogDraft.dolorMomento || "").trim();
    const dolorSensacion = String(routineExerciseLogDraft.dolorSensacion || "").trim();
    const dolorRecomendacion =
      routineExerciseLogDraft.molestia
        ? resolveRoutinePainTrainingRecommendation({
            dolorUbicacion,
            dolorMomento,
            dolorSensacion,
          })
        : "";

    const payload: WorkoutLogLite = {
      id: editingLogId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      alumnoNombre: profileName,
      alumnoEmail: profileEmail || undefined,
      sessionId: routineExerciseLogTarget.sessionId,
      sessionTitle: routineExerciseLogTarget.sessionTitle,
      weekId: routineExerciseLogTarget.weekId,
      weekName: routineExerciseLogTarget.weekName,
      dayId: routineExerciseLogTarget.dayId,
      dayName: routineExerciseLogTarget.dayName,
      blockId: routineExerciseLogTarget.blockId,
      blockTitle: routineExerciseLogTarget.blockTitle,
      exerciseId: routineExerciseLogTarget.exerciseId,
      exerciseName: routineExerciseLogTarget.exerciseName,
      exerciseKey: routineExerciseLogTarget.exerciseKey,
      fecha: String(routineExerciseLogDraft.fecha || "").trim() || getTodayDateInputValue(),
      series: parsedSeries,
      repeticiones: parsedRepeticiones,
      pesoKg: parsedPeso,
      molestia: Boolean(routineExerciseLogDraft.molestia),
      comentarios: cleanComentario || undefined,
      dolorUbicacion: dolorUbicacion || undefined,
      dolorMomento: dolorMomento || undefined,
      dolorSensacion: dolorSensacion || undefined,
      dolorRecomendacion: dolorRecomendacion || undefined,
      videoUrl: String(routineExerciseLogDraft.videoUrl || "").trim() || undefined,
      videoDataUrl: String(routineExerciseLogDraft.videoDataUrl || "").trim() || undefined,
      videoFileName: String(routineExerciseLogDraft.videoFileName || "").trim() || undefined,
      videoMimeType: String(routineExerciseLogDraft.videoMimeType || "").trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setRoutineExerciseLogSaving(true);
    markManualSaveIntent(WORKOUT_LOGS_KEY);
    setWorkoutLogsShared((previous) => {
      const normalized = normalizeWorkoutLogsLiteRows(previous);

      if (editingLogId) {
        let updatedExisting = false;
        const updatedRows = normalized.map((row) => {
          if (String(row.id || "").trim() !== editingLogId) {
            return row;
          }

          updatedExisting = true;
          return {
            ...payload,
            id: editingLogId,
            createdAt: row.createdAt || payload.createdAt,
          };
        });

        if (updatedExisting) {
          return updatedRows;
        }
      }

      return [payload, ...normalized];
    });
    setRoutineExerciseLogEditingId(null);
    clearRoutineExerciseLogStatusTimer();
    setRoutineExerciseLogStatus(editingLogId ? "Registro actualizado correctamente." : "Registro guardado correctamente.");
    scheduleRoutineExerciseLogStatusReset();
    setRoutineExerciseLogDraft((previous) =>
      createRoutineExerciseLogDraft({
        fecha: previous.fecha,
        series: previous.series,
        repeticiones: previous.repeticiones,
        pesoKg: "",
        comentarios: "",
        molestia: false,
        dolorUbicacion: "",
        dolorMomento: "",
        dolorSensacion: "",
        videoUrl: previous.videoUrl,
      })
    );

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setRoutineExerciseLogSaving(false);
      }, 220);
    } else {
      setRoutineExerciseLogSaving(false);
    }
  }, [
    profileEmail,
    profileName,
    clearRoutineExerciseLogStatusTimer,
    routineExerciseLogDraft,
    routineExerciseLogEditingId,
    routineExerciseLogSaving,
    routineExerciseLogTarget,
    scheduleRoutineExerciseLogStatusReset,
    setWorkoutLogsShared,
  ]);

  const editRoutineExerciseRecentLog = useCallback((log: WorkoutLogLite) => {
    const logId = String(log.id || "").trim();
    if (!logId) {
      return;
    }

    setRoutineExerciseLogEditingId(logId);
    clearRoutineExerciseLogStatusTimer();
    setRoutineExerciseLogStatus("Editando registro. Guarda para aplicar cambios.");
    setRoutineExerciseLogDraft(
      createRoutineExerciseLogDraft({
        fecha: String(log.fecha || "").trim() || getTodayDateInputValue(),
        series: String(log.series ?? "").trim(),
        repeticiones: String(log.repeticiones ?? "").trim(),
        pesoKg: String(log.pesoKg ?? "").trim(),
        comentarios: String(log.comentarios || log.comentario || ""),
        molestia: Boolean(log.molestia),
        dolorUbicacion: String(log.dolorUbicacion || ""),
        dolorMomento: String(log.dolorMomento || ""),
        dolorSensacion: String(log.dolorSensacion || ""),
        videoUrl: String(log.videoUrl || ""),
        videoDataUrl: String(log.videoDataUrl || ""),
        videoFileName: String(log.videoFileName || ""),
        videoMimeType: String(log.videoMimeType || ""),
      })
    );
  }, [clearRoutineExerciseLogStatusTimer]);

  const cancelRoutineExerciseLogEdit = useCallback(() => {
    setRoutineExerciseLogEditingId(null);
    clearRoutineExerciseLogStatusTimer();
    setRoutineExerciseLogStatus("Edicion cancelada.");
    scheduleRoutineExerciseLogStatusReset(1400);

    if (!routineExerciseLogTarget) {
      setRoutineExerciseLogDraft(createRoutineExerciseLogDraft());
      return;
    }

    setRoutineExerciseLogDraft(
      createRoutineExerciseLogDraft({
        series: String(routineExerciseLogTarget.prescribedSeries || "").trim(),
        repeticiones: String(routineExerciseLogTarget.prescribedRepeticiones || "").trim(),
        pesoKg: String(routineExerciseLogTarget.prescribedCarga || "").trim(),
        videoUrl: String(routineExerciseLogTarget.suggestedVideoUrl || "").trim(),
      })
    );
  }, [clearRoutineExerciseLogStatusTimer, routineExerciseLogTarget, scheduleRoutineExerciseLogStatusReset]);

  const deleteRoutineExerciseRecentLog = useCallback(
    (log: WorkoutLogLite) => {
      const logId = String(log.id || "").trim();
      if (!logId) {
        return;
      }

      if (typeof window !== "undefined") {
        const confirmed = window.confirm("Eliminar este registro? Podras volver a cargarlo cuando quieras.");
        if (!confirmed) {
          return;
        }
      }

      markManualSaveIntent(WORKOUT_LOGS_KEY);
      setWorkoutLogsShared((previous) =>
        normalizeWorkoutLogsLiteRows(previous).filter((row) => String(row.id || "").trim() !== logId)
      );

      if (routineExerciseLogEditingId === logId) {
        setRoutineExerciseLogEditingId(null);
      }

      clearRoutineExerciseLogStatusTimer();
      setRoutineExerciseLogStatus("Registro eliminado correctamente.");
      scheduleRoutineExerciseLogStatusReset();
    },
    [
      clearRoutineExerciseLogStatusTimer,
      routineExerciseLogEditingId,
      scheduleRoutineExerciseLogStatusReset,
      setWorkoutLogsShared,
    ]
  );

  const clampRoutineStopwatchFloatPosition = useCallback(
    (candidate: RoutineStopwatchFloatPosition): RoutineStopwatchFloatPosition => {
      if (typeof window === "undefined") {
        return candidate;
      }

      const fallbackSize = isUltraMobile
        ? ROUTINE_STOPWATCH_FLOAT_SIZE_MOBILE
        : ROUTINE_STOPWATCH_FLOAT_SIZE_DESKTOP;
      const hostWidth = Math.max(fallbackSize, routineStopwatchFloatHostRef.current?.offsetWidth || 0) || fallbackSize;
      const hostHeight = Math.max(fallbackSize, routineStopwatchFloatHostRef.current?.offsetHeight || 0) || fallbackSize;
      const margin = 8;

      const minX = margin;
      const maxX = Math.max(minX, window.innerWidth - hostWidth - margin);
      const minY = Math.max(56, margin);
      const maxY = Math.max(minY, window.innerHeight - hostHeight - margin);

      return {
        x: Math.min(maxX, Math.max(minX, candidate.x)),
        y: Math.min(maxY, Math.max(minY, candidate.y)),
      };
    },
    [isUltraMobile]
  );

  const getDefaultRoutineStopwatchFloatPosition = useCallback((): RoutineStopwatchFloatPosition => {
    if (typeof window === "undefined") {
      return { x: 12, y: 12 };
    }

    const baseSize = isUltraMobile
      ? ROUTINE_STOPWATCH_FLOAT_SIZE_MOBILE
      : ROUTINE_STOPWATCH_FLOAT_SIZE_DESKTOP;

    return clampRoutineStopwatchFloatPosition({
      x: window.innerWidth - baseSize - 12,
      y: window.innerHeight - baseSize - (isUltraMobile ? 88 : 82),
    });
  }, [clampRoutineStopwatchFloatPosition, isUltraMobile]);

  useEffect(() => {
    if (activeCategory !== "rutina" || activeRoutineActionScreen !== "timer") {
      setRoutineStopwatchDragging(false);
      return;
    }

    setRoutineStopwatchFloatPosition((previous) => {
      if (!previous) {
        return getDefaultRoutineStopwatchFloatPosition();
      }

      return clampRoutineStopwatchFloatPosition(previous);
    });
  }, [
    activeCategory,
    activeRoutineActionScreen,
    clampRoutineStopwatchFloatPosition,
    getDefaultRoutineStopwatchFloatPosition,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setRoutineStopwatchFloatPosition((previous) => {
        if (!previous) {
          return previous;
        }

        return clampRoutineStopwatchFloatPosition(previous);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [clampRoutineStopwatchFloatPosition]);

  const handleRoutineStopwatchPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const targetNode = event.target as HTMLElement | null;
      if (targetNode?.closest("button")) {
        return;
      }

      const basePosition = routineStopwatchFloatPosition || getDefaultRoutineStopwatchFloatPosition();
      const startPosition = clampRoutineStopwatchFloatPosition(basePosition);

      routineStopwatchDragStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: startPosition.x,
        originY: startPosition.y,
      };

      setRoutineStopwatchFloatPosition(startPosition);
      setRoutineStopwatchDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    },
    [
      clampRoutineStopwatchFloatPosition,
      getDefaultRoutineStopwatchFloatPosition,
      routineStopwatchFloatPosition,
    ]
  );

  const handleRoutineStopwatchPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = routineStopwatchDragStateRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - drag.startClientX;
      const deltaY = event.clientY - drag.startClientY;
      setRoutineStopwatchFloatPosition(
        clampRoutineStopwatchFloatPosition({
          x: drag.originX + deltaX,
          y: drag.originY + deltaY,
        })
      );
      event.preventDefault();
    },
    [clampRoutineStopwatchFloatPosition]
  );

  const finishRoutineStopwatchDrag = useCallback(() => {
    routineStopwatchDragStateRef.current.active = false;
    routineStopwatchDragStateRef.current.pointerId = -1;
    setRoutineStopwatchDragging(false);
  }, []);

  const handleRoutineStopwatchPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = routineStopwatchDragStateRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return;
      }

      event.currentTarget.releasePointerCapture?.(event.pointerId);
      finishRoutineStopwatchDrag();
    },
    [finishRoutineStopwatchDrag]
  );

  const handleRoutineStopwatchPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (routineStopwatchDragStateRef.current.pointerId === event.pointerId) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }

      finishRoutineStopwatchDrag();
    },
    [finishRoutineStopwatchDrag]
  );

  const clearRoutineStopwatchInterval = useCallback(() => {
    if (routineStopwatchIntervalRef.current === null) {
      return;
    }

    window.clearInterval(routineStopwatchIntervalRef.current);
    routineStopwatchIntervalRef.current = null;
  }, []);

  const startRoutineStopwatch = useCallback(() => {
    if (routineStopwatchRunning || typeof window === "undefined") {
      return;
    }

    const baseElapsed = Math.max(0, routineStopwatchElapsedMs);
    routineStopwatchStartedAtRef.current = Date.now() - baseElapsed;
    setRoutineStopwatchRunning(true);

    clearRoutineStopwatchInterval();
    routineStopwatchIntervalRef.current = window.setInterval(() => {
      if (routineStopwatchStartedAtRef.current === null) {
        return;
      }

      setRoutineStopwatchElapsedMs(Math.max(0, Date.now() - routineStopwatchStartedAtRef.current));
    }, 200);
  }, [clearRoutineStopwatchInterval, routineStopwatchElapsedMs, routineStopwatchRunning]);

  const pauseRoutineStopwatch = useCallback(() => {
    if (!routineStopwatchRunning) {
      return;
    }

    if (routineStopwatchStartedAtRef.current !== null) {
      setRoutineStopwatchElapsedMs(Math.max(0, Date.now() - routineStopwatchStartedAtRef.current));
    }

    routineStopwatchStartedAtRef.current = null;
    setRoutineStopwatchRunning(false);
    clearRoutineStopwatchInterval();
  }, [clearRoutineStopwatchInterval, routineStopwatchRunning]);

  const stopRoutineStopwatch = useCallback(() => {
    routineStopwatchStartedAtRef.current = null;
    setRoutineStopwatchRunning(false);
    setRoutineStopwatchElapsedMs(0);
    clearRoutineStopwatchInterval();
  }, [clearRoutineStopwatchInterval]);

  useEffect(() => {
    const previousPanel = previousRoutineQuickPanelRef.current;

    if (previousPanel === "timer" && routineQuickPanel !== "timer") {
      stopRoutineStopwatch();
      routineStopwatchDragStateRef.current.active = false;
      routineStopwatchDragStateRef.current.pointerId = -1;
      setRoutineStopwatchDragging(false);
      setRoutineStopwatchFloatPosition(null);
    }

    previousRoutineQuickPanelRef.current = routineQuickPanel;
  }, [routineQuickPanel, stopRoutineStopwatch]);

  const toggleRoutineQuickPanel = useCallback((panel: "change" | "sessions" | "timer") => {
    setRoutineFinalizePanelOpen(false);
    setRoutineQuickPanel((current) => (current === panel ? "none" : panel));
    setRoutineChangeRequestStatus("");
  }, []);

  const closeRoutineActionScreen = useCallback(() => {
    routineStopwatchDragStateRef.current.active = false;
    routineStopwatchDragStateRef.current.pointerId = -1;
    setRoutineStopwatchDragging(false);
    setRoutineQuickPanel("none");
    setRoutineFinalizePanelOpen(false);
  }, []);

  const submitRoutineChangeRequest = useCallback(() => {
    if (!selectedRoutineEntry) {
      setRoutineChangeRequestStatus("Selecciona una sesion para enviar la solicitud.");
      return;
    }

    const cleanMessage = String(routineChangeRequestDraft || "").trim();
    if (cleanMessage.length < 8) {
      setRoutineChangeRequestStatus("Describe el cambio con al menos 8 caracteres.");
      return;
    }

    const payload: RoutineChangeRequestLite = {
      id: `change-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      alumnoNombre: profileName,
      alumnoEmail: profileEmail || undefined,
      sessionId: selectedRoutineEntry.sesion.id,
      sessionTitle: selectedRoutineEntry.sesion.titulo,
      weekId: selectedRoutineEntry.weekId,
      weekName: selectedRoutineEntry.weekName,
      dayId: selectedRoutineEntry.dayId,
      dayName: selectedRoutineEntry.dayName,
      message: cleanMessage,
      createdAt: new Date().toISOString(),
    };

    markManualSaveIntent(ROUTINE_CHANGE_REQUESTS_KEY);
    setRoutineChangeRequestsRaw((previous) => [
      payload,
      ...normalizeRoutineChangeRequestRows(previous),
    ]);

    setRoutineChangeRequestDraft("");
    setRoutineChangeRequestStatus("Solicitud enviada al profesor.");
  }, [
    profileEmail,
    profileName,
    routineChangeRequestDraft,
    selectedRoutineEntry,
    setRoutineChangeRequestsRaw,
  ]);

  const openRoutineFinalizePanel = useCallback(() => {
    if (!selectedRoutineEntry) {
      setRoutineFinalizeStatus("Selecciona una sesión para finalizar.");
      return;
    }

    const previousFeedback = existingRoutineSessionFeedback;
    if (previousFeedback?.answers?.length) {
      const mappedAnswers: Record<string, string> = {};
      previousFeedback.answers.forEach((answer) => {
        if (answer.questionId && answer.optionId) {
          mappedAnswers[answer.questionId] = answer.optionId;
        }
      });
      setRoutineFinalizeAnswerByQuestionId(mappedAnswers);
    } else {
      setRoutineFinalizeAnswerByQuestionId({});
    }

    if (previousFeedback?.measurements) {
      setRoutineFinalizeMeasurements(previousFeedback.measurements);
    } else {
      setRoutineFinalizeMeasurements({});
    }

    setRoutineFinalizeStatus("");
    setRoutineFinalizeSurveyStep(0);
    setRoutineQuickPanel("none");
    setRoutineFinalizePanelOpen(true);
  }, [existingRoutineSessionFeedback, selectedRoutineEntry]);

  useEffect(() => {
    openFinalizePanelRef.current = openRoutineFinalizePanel;
  }, [openRoutineFinalizePanel]);

  const submitRoutineFinalize = useCallback(() => {
    if (!selectedRoutineEntry) {
      setRoutineFinalizeStatus("Selecciona una sesión para finalizar.");
      return;
    }

    // Determine which measurements to show/require
    const configMeasurements = selectedRoutineDayFeedbackConfig?.measurements;
    const activeMeasurementIds: PostSessionMeasurementId[] =
      configMeasurements && configMeasurements.length > 0
        ? configMeasurements.filter((m) => m.visible).map((m) => m.id)
        : DEFAULT_VISIBLE_MEASUREMENTS;
    const requiredMeasurementIds: PostSessionMeasurementId[] =
      configMeasurements && configMeasurements.length > 0
        ? configMeasurements.filter((m) => m.visible && m.obligatoria).map((m) => m.id)
        : (["rpe"] as PostSessionMeasurementId[]);

    const missingRequired = requiredMeasurementIds.find(
      (id) => !String(routineFinalizeMeasurements[id] || "").trim()
    );
    if (missingRequired) {
      const catalog = POST_SESSION_MEASUREMENT_CATALOG.find((m) => m.id === missingRequired);
      setRoutineFinalizeStatus(`Completá "${catalog?.nombre || missingRequired}" antes de finalizar.`);
      return;
    }

    if (selectedRoutineDayFeedbackQuestions.length > 0) {
      const missingQuestion = selectedRoutineDayFeedbackQuestions.find(
        (question) => !routineFinalizeAnswerByQuestionId[question.id]
      );

      if (missingQuestion) {
        setRoutineFinalizeStatus("Completa todo el feedback antes de finalizar.");
        return;
      }
    }

    const answers: SessionFeedbackAnswerLite[] = selectedRoutineDayFeedbackQuestions
      .map((question) => {
        const selectedOptionId = String(routineFinalizeAnswerByQuestionId[question.id] || "").trim();
        if (!selectedOptionId) {
          return null;
        }

        const selectedOption = question.options.find((option) => option.id === selectedOptionId) || null;
        if (!selectedOption) {
          return null;
        }

        return {
          questionId: question.id,
          questionPrompt: question.prompt,
          optionId: selectedOption.id,
          optionLabel: selectedOption.label,
        };
      })
      .filter((answer): answer is SessionFeedbackAnswerLite => Boolean(answer));

    // Only persist measurements that are active and have a value
    const measurementsToSave: Record<string, string> = {};
    activeMeasurementIds.forEach((id) => {
      const val = String(routineFinalizeMeasurements[id] || "").trim();
      if (val) measurementsToSave[id] = val;
    });

    const payload: SessionFeedbackRecordLite = {
      id: `feedback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      alumnoNombre: profileName,
      alumnoEmail: profileEmail || undefined,
      sessionId: selectedRoutineEntry.sesion.id,
      sessionTitle: selectedRoutineEntry.sesion.titulo,
      weekId: selectedRoutineEntry.weekId,
      weekName: selectedRoutineEntry.weekName,
      dayId: selectedRoutineEntry.dayId,
      dayName: selectedRoutineEntry.dayName,
      feedbackTitle: selectedRoutineDayFeedbackConfig?.title || "Feedback post sesión",
      answers,
      measurements: Object.keys(measurementsToSave).length > 0 ? measurementsToSave : undefined,
      totalWorkoutLogs: selectedRoutineDayLogSummary.total,
      logsWithPain: selectedRoutineDayLogSummary.withPain,
      createdAt: new Date().toISOString(),
    };

    const identityKey = buildSessionFeedbackIdentityKey(payload);

    markManualSaveIntent(SESSION_FEEDBACK_RECORDS_KEY);
    setSessionFeedbackRecordsRaw((previous) => {
      const normalized = normalizeSessionFeedbackRows(previous);
      const filtered = normalized.filter(
        (row) => buildSessionFeedbackIdentityKey(row) !== identityKey
      );

      return [payload, ...filtered];
    });

    setRoutineFinalizePanelOpen(false);
    setRoutineFinalizeStatus("Sesión finalizada correctamente.");
    setRoutineQuickPanel("sessions");
  }, [
    profileEmail,
    profileName,
    routineFinalizeAnswerByQuestionId,
    routineFinalizeMeasurements,
    selectedRoutineDayFeedbackConfig?.measurements,
    selectedRoutineDayFeedbackConfig?.title,
    selectedRoutineDayFeedbackQuestions,
    selectedRoutineDayLogSummary.total,
    selectedRoutineDayLogSummary.withPain,
    selectedRoutineEntry,
    setSessionFeedbackRecordsRaw,
  ]);

  const homeDockItems: Array<{ key: MainCategory; label: string; icon: ReactNode }> = [
    {
      key: "rutina",
      label: "Rutina",
      icon: (
        <svg viewBox="0 0 24 24" className="pf-a2-dock-icon" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M7 5.5h10M7 10h10M7 14.5h6" strokeLinecap="round" />
          <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: "inicio",
      label: "Inicio",
      icon: (
        <svg viewBox="0 0 24 24" className="pf-a2-dock-icon" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M4 11.5 12 5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7.5 10.5V19h9v-8.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: "cuenta",
      label: "Cuenta",
      icon: (
        <svg viewBox="0 0 24 24" className="pf-a2-dock-icon" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M5 17.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" strokeLinecap="round" />
          <path d="M8.5 10a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  const isRoutineLogPanelOpen = Boolean(routineExerciseLogTarget);

  const loadAccountPanel = useCallback(async () => {
    setAccountPanelLoading(true);
    setAccountPanelError(null);
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "No se pudo cargar la cuenta");
      }
      setAccountPanelData(data);
      setAccountPanelNombre(String(data.nombreCompleto || ""));
      setAccountPanelEdad(data.edad !== undefined && data.edad !== null ? String(data.edad) : "");
      setAccountPanelAltura(data.altura !== undefined && data.altura !== null ? String(data.altura) : "");
      setAccountPanelTelefono(String(data.telefono || ""));
      setAccountPanelDireccion(String(data.direccion || ""));
      setAccountPanelEmail(String(data.email || ""));
      const sidebarImg = typeof data.sidebarImage === "string" && data.sidebarImage.trim().length > 0 ? data.sidebarImage : null;
      setAccountPanelSidebarImage(sidebarImg);
      setAccountPanelSidebarImageDraft(sidebarImg);
      setAccountPanelLoaded(true);
    } catch (loadError) {
      setAccountPanelError(loadError instanceof Error ? loadError.message : "No se pudo cargar la cuenta");
    } finally {
      setAccountPanelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeCategory === "cuenta" && !accountPanelLoaded && !accountPanelLoading) {
      loadAccountPanel();
    }
  }, [activeCategory, accountPanelLoaded, accountPanelLoading, loadAccountPanel]);

  const saveAccountPanel = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountPanelSaving(true);
    setAccountPanelError(null);
    setAccountPanelMessage(null);
    try {
      const payload: Record<string, unknown> = {
        nombreCompleto: accountPanelNombre,
        edad: accountPanelEdad,
        altura: accountPanelAltura,
        telefono: accountPanelTelefono,
        direccion: accountPanelDireccion,
        email: accountPanelEmail,
      };
      if (accountPanelCurrentPassword) {
        payload.currentPassword = accountPanelCurrentPassword;
      }
      if (accountPanelNewPassword) {
        payload.newPassword = accountPanelNewPassword;
      }

      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "No se pudieron guardar los cambios");
      }
      setAccountPanelMessage("Cambios guardados.");
      setAccountPanelCurrentPassword("");
      setAccountPanelNewPassword("");
      setAccountPanelLoaded(false);
      loadAccountPanel();
    } catch (saveError) {
      setAccountPanelError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los cambios");
    } finally {
      setAccountPanelSaving(false);
    }
  }, [
    accountPanelAltura,
    accountPanelCurrentPassword,
    accountPanelDireccion,
    accountPanelEdad,
    accountPanelEmail,
    accountPanelNewPassword,
    accountPanelNombre,
    accountPanelTelefono,
    loadAccountPanel,
  ]);

  const handleAccountPanelPhotoChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAccountPanelPhotoError("Seleccioná un archivo de imagen válido");
      return;
    }
    setAccountPanelPhotoError(null);
    void (async () => {
      try {
        const optimized = await optimizeProfileImageForCuenta(file);
        setAccountPanelSidebarImageDraft(optimized);
      } catch (processError) {
        setAccountPanelPhotoError(
          processError instanceof Error ? processError.message : "No se pudo preparar la imagen"
        );
      }
    })();
  }, []);

  const handleAccountPanelPhotoRemove = useCallback(() => {
    setAccountPanelSidebarImageDraft(null);
    setAccountPanelPhotoError(null);
  }, []);

  const handleAccountPanelPhotoRevert = useCallback(() => {
    setAccountPanelSidebarImageDraft(accountPanelSidebarImage);
    setAccountPanelPhotoError(null);
  }, [accountPanelSidebarImage]);

  const handleAccountPanelPhotoSave = useCallback(async () => {
    setAccountPanelPhotoSaving(true);
    setAccountPanelPhotoError(null);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sidebarImage: accountPanelSidebarImageDraft }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "No se pudo guardar la foto de perfil");
      }
      const persisted =
        typeof data?.user?.sidebarImage === "string" && data.user.sidebarImage.trim().length > 0
          ? data.user.sidebarImage
          : null;
      setAccountPanelSidebarImage(persisted);
      setAccountPanelSidebarImageDraft(persisted);
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pf-sidebar-image-updated", { detail: { forceClear: !persisted } }));
        }
      } catch {
        // ignore
      }
    } catch (saveError) {
      setAccountPanelPhotoError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar la foto de perfil"
      );
    } finally {
      setAccountPanelPhotoSaving(false);
    }
  }, [accountPanelSidebarImageDraft]);

  const handleSignOutPanel = useCallback(async () => {
    setAccountPanelSigningOut(true);
    try {
      await signOut({ redirect: true, callbackUrl: "/auth/login" });
    } catch {
      setAccountPanelSigningOut(false);
    }
  }, []);

  return (
    <main className="pf-alumno-main pf-alumno-v2" data-pf-alumno-category={activeCategory}>
      <div className="pf-a2-shell">
        {isRootCategory ? (
          <header className="pf-a3-home-head">
            <div className="pf-a3-home-intro">
              <p className="pf-a3-home-greeting">{resolveGreeting()}</p>
              <h1 className="pf-a3-home-student">{profileShortName}</h1>
              <p className="pf-a3-home-subline">Preparado para comenzar a entrenar.</p>
            </div>

            <div className="pf-a3-avatar-wrap" aria-hidden="true">
              {studentAvatarSrc ? (
                <img src={studentAvatarSrc} alt="Perfil alumno" className="pf-a3-avatar-image" loading="eager" />
              ) : (
                <span className="pf-a3-avatar-fallback">{studentAvatarInitials}</span>
              )}
              <span className="pf-a3-avatar-online-dot" />
            </div>

            <div className="pf-a3-home-status-row">
              <span className="pf-a3-online-pill" aria-label="Estado en linea">
                <span className="pf-a3-online-pill-dot" aria-hidden="true" />
                En linea
              </span>
            </div>
          </header>
        ) : (
          <header className="pf-a2-hero pf-a2-hero-shell rounded-[1.4rem] border px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ReliableActionButton
                  type="button"
                  onClick={goToPreviousCategory}
                  onPointerUp={() => goToPreviousCategory()}
                  onTouchEnd={() => goToPreviousCategory()}
                  data-nav-href={backTargetHref}
                  className={`pf-a2-back-btn mt-0.5 ${isRoutineLogPanelOpen ? "pf-a2-back-btn-suspended" : ""}`}
                  aria-label={backLabel}
                  title={backLabel}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="sr-only">{backLabel}</span>
                </ReliableActionButton>

                <div className="min-w-0">
                  <p className="pf-a2-eyebrow break-words">{categoryMeta.badge}</p>
                  <h1 className="mt-1 break-words text-[clamp(1.35rem,4vw,2.35rem)] font-black leading-tight text-white">
                    {heroTitle}
                  </h1>
                  <p className="mt-2 max-w-2xl break-words text-sm text-slate-300">{heroSubtitle}</p>
                </div>
              </div>

            </div>

            <div className="pf-a2-tab-rail mt-4 hidden flex-nowrap gap-2 overflow-x-auto pb-1 md:flex">
              {CATEGORIES.map((category) => {
                const isActive = category === activeCategory;

                return (
                  <ReliableActionButton
                    key={category}
                    type="button"
                    onClick={() => goToCategory(category)}
                    className={`pf-a2-tab min-w-[124px] rounded-xl border px-3 py-2 text-left ${
                      isActive ? "pf-a2-tab-active" : ""
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {CATEGORY_COPY[category].badge}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">
                      {CATEGORY_COPY[category].title}
                    </p>
                  </ReliableActionButton>
                );
              })}
            </div>
          </header>
        )}

        <section className="pf-alumno-stage pb-2 md:pb-6">
          {activeCategory === "inicio" ? (
            <div className="pf-a3-home-stack">
              <article className="pf-a3-coach-card">
                <div className="pf-a3-coach-top">
                  <div className="pf-a3-coach-identity">
                    <span className="pf-a3-coach-avatar" aria-hidden="true">
                      {coachAvatarInitials}
                    </span>
                    <div className="min-w-0">
                      <p className="pf-a3-coach-name">{coachDisplayName}</p>
                      <p className="pf-a3-coach-role">{coachRoleLabel}</p>
                    </div>
                  </div>
                  <span className="pf-a3-coach-star" aria-hidden="true">
                    ★
                  </span>
                </div>

                <div className="pf-a3-coach-meta-row">
                  <div className="pf-a3-coach-meta-item">
                    <p>{coachPlanLabel}</p>
                    <span>Membresia</span>
                  </div>
                  <div className="pf-a3-coach-meta-item">
                    <p>{coachStartLabel}</p>
                    <span>Desde</span>
                  </div>
                  <div className="pf-a3-coach-meta-item">
                    <p>{coachEndLabel}</p>
                    <span>Hasta</span>
                  </div>
                </div>
              </article>

              <div className="pf-a3-main-actions">
                <ReliableActionButton
                  type="button"
                  onClick={() => goToCategory("progreso")}
                  className="pf-a3-main-action-btn"
                >
                  Cuestionarios
                </ReliableActionButton>
                <ReliableActionButton
                  type="button"
                  onClick={() => goToCategory("rutina")}
                  className="pf-a3-main-action-btn"
                >
                  Reservas
                </ReliableActionButton>
              </div>

              <section className="pf-a3-panel-block">
                <div className="pf-a3-section-head">
                  <div>
                    <h2 className="pf-a3-section-title">Musica</h2>
                    <p className="pf-a3-section-subtitle">
                      {musicAssignments.length > 0 ? "Tu musica de entrenamiento" : "Playlist sugerida para hoy"}
                    </p>
                  </div>
                  <ReliableActionButton
                    type="button"
                    onClick={() => goToCategory("musica")}
                    className="pf-a3-link-btn"
                  >
                    Ver
                  </ReliableActionButton>
                </div>

                {selectedMusicAssignment ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-500/35 bg-slate-950/55 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Vista previa</p>
                        <h3 className="mt-1 break-words text-base font-black text-white">{selectedMusicDisplayName}</h3>
                        <p className="mt-1 text-[11px] text-slate-300">
                          Objetivo: {selectedMusicAssignment.objetivo || "General"}
                          {selectedMusicAssignment.diaSemana ? ` · ${selectedMusicAssignment.diaSemana}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="pf-a2-pill">{resolveMusicPlatformLabel(selectedMusicPlatform)}</span>
                        <span className="pf-a2-pill">{resolveMusicContentTypeLabel(selectedMusicContentType)}</span>
                      </div>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/35 p-2">
                      {selectedMusicPlayer.kind === "audio" ? (
                        <audio
                          controls
                          preload="none"
                          className="h-12 w-full"
                          src={selectedMusicPlayer.src || undefined}
                        />
                      ) : selectedMusicPlayer.kind === "iframe" && selectedMusicPlayer.src ? (
                        <iframe
                          title={`music-player-home-${resolveMusicAssignmentId(selectedMusicAssignment, 0)}`}
                          src={selectedMusicPlayer.src}
                          className={`w-full rounded-lg border border-white/10 ${
                            selectedMusicPlatform === "SPOTIFY" ? "h-[360px] sm:h-[400px]" : "h-64 sm:h-72"
                          }`}
                          loading="lazy"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        />
                      ) : (
                        <div className="flex h-28 items-center justify-center rounded-lg border border-slate-500/35 bg-slate-900/55 px-4 text-center text-xs text-slate-300">
                          Esta plataforma no permite vista previa embebida. Usa &quot;Abrir playlist&quot; para escucharla.
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <ReliableActionButton
                        type="button"
                        onClick={() => goToCategory("musica")}
                        className="pf-a2-solid-btn inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold"
                      >
                        Ver en musica
                      </ReliableActionButton>
                      <ReliableActionButton
                        type="button"
                        onClick={() => openMusicPlaylistExternal(selectedMusicAssignment)}
                        className="pf-a2-ghost-btn inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      >
                        {resolveMusicOpenActionLabel(selectedMusicPlatform)}
                      </ReliableActionButton>
                    </div>
                  </div>
                ) : null}

                {!selectedMusicAssignment ? (
                  <div className="pf-a3-music-scroll" role="list" aria-label="Playlists recomendadas">
                    {homeMusicCards.map((track) => {
                      const coverInitials = getInitials(track.title);

                      return (
                        <ReliableActionButton
                          key={track.id}
                          type="button"
                          onClick={() => handleHomeMusicCardPress(track)}
                          className="pf-a3-music-card pf-a3-music-card-action"
                          role="listitem"
                          aria-label={`Abrir musica: ${track.title}`}
                        >
                          <div className={`pf-a3-music-cover ${track.accentClass}`}>
                            {track.coverUrl ? (
                              <img src={track.coverUrl} alt={track.title} className="pf-a3-music-image" loading="lazy" />
                            ) : (
                              <div className="pf-a3-music-fallback-shell">
                                <span className="pf-a3-music-fallback-platform">{resolveMusicPlatformLabel(track.platform)}</span>
                                <span className="pf-a3-music-fallback">{coverInitials}</span>
                                <span className="pf-a3-music-fallback-type">{resolveMusicContentTypeLabel(track.contentType)}</span>
                              </div>
                            )}
                          </div>
                          <p className="pf-a3-music-title">{track.title}</p>
                          <p className="pf-a3-music-artist">{track.artist}</p>
                          <p className="pf-a3-music-hint">
                            {resolveMusicPlatformLabel(track.platform)} · {resolveMusicContentTypeLabel(track.contentType)}
                          </p>
                          <p className="pf-a3-music-hint-secondary">
                            {track.playlistUrl ? "Tocar para escuchar" : "Tocar para abrir musica"}
                          </p>
                        </ReliableActionButton>
                      );
                    })}
                  </div>
                ) : null}
              </section>

              <section className="pf-a3-panel-block">
                <div className="pf-a3-section-head">
                  <h2 className="pf-a3-section-title">Carga rapida</h2>
                  <ReliableActionButton
                    type="button"
                    onClick={() => goToCategory("progreso")}
                    className="pf-a3-link-btn"
                  >
                    Ver
                  </ReliableActionButton>
                </div>

                <div className="pf-a3-quick-grid">
                  <ReliableActionButton
                    type="button"
                    onClick={() => goToCategory("progreso")}
                    className="pf-a3-quick-item"
                  >
                    <span className="pf-a3-quick-icon pf-a3-quick-icon-agua" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
                        <path d="M12 3.8c2.7 3.1 5.2 6.2 5.2 9.2a5.2 5.2 0 1 1-10.4 0c0-3 2.5-6.1 5.2-9.2Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>Agua</span>
                  </ReliableActionButton>

                  <ReliableActionButton
                    type="button"
                    onClick={() => goToCategory("progreso")}
                    className="pf-a3-quick-item"
                  >
                    <span className="pf-a3-quick-icon pf-a3-quick-icon-sueno" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
                        <path d="M4 14h16M6 10h6m8 0h-4" strokeLinecap="round" />
                        <path d="M5 14v3h2.5v-3M16.5 14v3H19v-3" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="3.5" y="7" width="17" height="7" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>Sueno</span>
                  </ReliableActionButton>

                  <ReliableActionButton
                    type="button"
                    onClick={() => goToCategory("progreso")}
                    className="pf-a3-quick-item"
                  >
                    <span className="pf-a3-quick-icon pf-a3-quick-icon-progreso" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
                        <path d="M5 17.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" strokeLinecap="round" />
                        <path d="M8.5 10a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>Progreso</span>
                  </ReliableActionButton>

                  <ReliableActionButton
                    type="button"
                    onClick={openPayments}
                    onPointerUp={() => openPayments()}
                    data-nav-href="/alumnos/pagos"
                    className="pf-a3-quick-item"
                  >
                    <span className="pf-a3-quick-icon pf-a3-quick-icon-pagos" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
                        <rect x="3.5" y="6" width="17" height="12" rx="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M6.5 10.5h11" strokeLinecap="round" />
                        <circle cx="8" cy="14.2" r="0.8" fill="currentColor" stroke="none" />
                      </svg>
                    </span>
                    <span>Pagos</span>
                  </ReliableActionButton>
                </div>
              </section>

              <section className="pf-a3-panel-block pf-a3-panel-block-flat">
                <div className="pf-a3-section-head">
                  <h2 className="pf-a3-section-title">Peso y medidas corporales</h2>
                  <div className="pf-a3-head-actions">
                    <ReliableActionButton
                      type="button"
                      onClick={loadStorageState}
                      className="pf-a3-icon-btn"
                      aria-label="Actualizar peso"
                      title="Actualizar"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4" aria-hidden="true">
                        <path d="M20 12a8 8 0 1 1-2.3-5.6" strokeLinecap="round" />
                        <path d="M20 5v4h-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ReliableActionButton>
                    <ReliableActionButton
                      type="button"
                      onClick={() => goToCategory("progreso")}
                      className="pf-a3-link-btn pf-a3-link-btn-strong"
                      aria-label="Ir a progreso"
                      title="Progreso"
                    >
                      Progreso
                    </ReliableActionButton>
                  </div>
                </div>

                <div className="pf-a3-weight-content">
                  <div className="pf-a3-weight-kpi-grid">
                    <div>
                      <p className="pf-a3-weight-value">{formatWeightValue(weightLast7)}</p>
                      <p className="pf-a3-weight-unit">kg</p>
                      <p className="pf-a3-weight-label">7 dias</p>
                    </div>
                    <div>
                      <p className="pf-a3-weight-value">{formatWeightValue(weightLast15)}</p>
                      <p className="pf-a3-weight-unit">kg</p>
                      <p className="pf-a3-weight-label">15 dias</p>
                    </div>
                    <div>
                      <p className="pf-a3-weight-value">{formatWeightValue(weightHistoric)}</p>
                      <p className="pf-a3-weight-unit">kg</p>
                      <p className="pf-a3-weight-label">Historico</p>
                    </div>
                  </div>

                  <div className="pf-a3-chart-wrap" aria-label="Evolucion de peso">
                    <svg viewBox="0 0 300 170" className="pf-a3-weight-chart" preserveAspectRatio="none" role="img">
                      <line x1="12" y1="148" x2="288" y2="148" className="pf-a3-chart-axis" />
                      <line x1="12" y1="20" x2="12" y2="148" className="pf-a3-chart-axis" />

                      {weightSparkline ? (
                        <>
                          <polyline points={weightSparkline.points} className="pf-a3-chart-line" />
                          <circle
                            cx={Number.isFinite(weightSparkline.lastPointX) ? weightSparkline.lastPointX : 12}
                            cy={Number.isFinite(weightSparkline.lastPointY) ? weightSparkline.lastPointY : 148}
                            r="4"
                            className="pf-a3-chart-dot"
                          />
                        </>
                      ) : (
                        <line x1="12" y1="120" x2="288" y2="120" className="pf-a3-chart-line pf-a3-chart-line-empty" />
                      )}
                    </svg>
                    <p className="pf-a3-chart-footnote">
                      {weightSparkline ? `Ultimo registro: ${weightSparkline.lastDateLabel}` : "Sin registros de peso"}
                    </p>
                  </div>

                  <div className="pf-a3-bmi-grid">
                    {bodyMetricsCards.map((metric) => (
                      <article
                        key={metric.key}
                        className={`pf-a3-bmi-item ${metric.tone ? `pf-a3-bmi-item-${metric.tone}` : ""}`}
                      >
                        <p className="pf-a3-bmi-kicker">{metric.label}</p>
                        <p className="pf-a3-bmi-value">{metric.value}</p>
                        <p className="pf-a3-bmi-detail">{metric.detail}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </section>

            </div>
          ) : null}

          {activeCategory === "rutina" ? (
            <div
              className="pf-a3-routine-shell"
              onTouchStart={handleRoutineTouchStart}
              onTouchMove={handleRoutineTouchMove}
              onTouchEnd={handleRoutineTouchEnd}
              onTouchCancel={handleRoutineTouchEnd}
            >
              <div
                className={`pf-a3-routine-pull-indicator ${
                  routinePullRefreshing
                    ? "pf-a3-routine-pull-indicator-refreshing"
                    : routinePullDistance >= ROUTINE_PULL_THRESHOLD
                    ? "pf-a3-routine-pull-indicator-ready"
                    : ""
                }`}
                style={{
                  transform: `translateY(${Math.min(routinePullDistance, ROUTINE_PULL_MAX_DISTANCE)}px)`,
                  opacity: routinePullRefreshing || routinePullDistance > 0 ? 1 : 0,
                }}
                aria-live="polite"
              >
                {routinePullRefreshing
                  ? "Actualizando..."
                  : routinePullDistance >= ROUTINE_PULL_THRESHOLD
                  ? "Solta para actualizar"
                  : "Desliza para refrescar"}
              </div>

              <section className="pf-a3-routine-overview">
                <div className="pf-a3-routine-nav" aria-label="Navegacion de entrenamiento">
                  <ReliableActionButton
                    type="button"
                    onClick={() => goToCategory("rutina")}
                    className="pf-a3-routine-nav-btn pf-a3-routine-nav-btn-active"
                  >
                    Entrenamiento
                  </ReliableActionButton>
                  <ReliableActionButton
                    type="button"
                    onClick={() => goToCategory("nutricion")}
                    data-nav-href="/alumnos/nutricion"
                    className="pf-a3-routine-nav-btn"
                  >
                    Nutricion
                  </ReliableActionButton>
                  <ReliableActionButton
                    type="button"
                    onClick={() => goToCategory("progreso")}
                    onPointerUp={() => goToCategory("progreso")}
                    data-nav-href="/alumnos/progreso"
                    className="pf-a3-routine-nav-btn"
                  >
                    Recuperacion
                  </ReliableActionButton>
                </div>

                <div className="pf-a3-routine-overview-head">
                  <div className="min-w-0">
                    <h2 className="pf-a3-routine-overview-title">
                      {String(selectedRoutineEntry?.sesion.titulo || "Plan de entrenamiento").toUpperCase()}
                    </h2>
                    <p className="pf-a3-routine-overview-subtitle">Actualizado el {routineUpdatedAtLabel}</p>
                    <div className="pf-a3-routine-coach-row">
                      <span className="pf-a3-routine-coach-avatar" aria-hidden="true">
                        {getInitials(routineCoachLabel)}
                      </span>
                      <p className="pf-a3-routine-overview-kicker">{routineCoachLabel}</p>
                    </div>
                    <p className="pf-a3-routine-sync-label">{routineSyncStatusLabel}</p>
                  </div>

                  <div className="pf-a3-routine-overview-actions">
                    <ReliableActionButton
                      type="button"
                      onClick={() => toggleRoutineQuickPanel("change")}
                      className={`pf-a3-routine-icon-btn !border !border-emerald-200/65 !bg-emerald-500/30 transition-colors ${
                        routineQuickPanel === "change"
                          ? "!border-emerald-100 !bg-emerald-400/48"
                          : ""
                      }`}
                      aria-label="Solicitar cambio de rutina"
                      title="Solicitar cambio de rutina"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden="true">
                        <path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5v-6Z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 8.5h8M8 11.5h5" strokeLinecap="round" />
                      </svg>
                    </ReliableActionButton>

                    <ReliableActionButton
                      type="button"
                      onClick={() => toggleRoutineQuickPanel("sessions")}
                      className={`pf-a3-routine-icon-btn !border !border-rose-200/65 !bg-rose-500/30 transition-colors ${
                        routineQuickPanel === "sessions"
                          ? "!border-rose-100 !bg-rose-400/48"
                          : ""
                      }`}
                      aria-label="Ver sesiones finalizadas"
                      title="Ver sesiones finalizadas"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden="true">
                        <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9A2.5 2.5 0 0 1 6.5 5Z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 9h8M8 12h8M8 15h5" strokeLinecap="round" />
                      </svg>
                    </ReliableActionButton>

                    <ReliableActionButton
                      type="button"
                      onClick={() => toggleRoutineQuickPanel("timer")}
                      className={`pf-a3-routine-icon-btn !border !border-sky-200/65 !bg-sky-500/28 transition-colors ${
                        activeRoutineActionScreen === "timer" || routineStopwatchRunning
                          ? "!border-sky-100 !bg-sky-400/45"
                          : ""
                      }`}
                      aria-label="Abrir cronómetro"
                      title={routineStopwatchRunning ? "Cronómetro en marcha" : "Abrir cronómetro"}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <circle cx="12" cy="12" r="8" />
                        <path d="M12 8v4l2.6 1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9.2 3.5h5.6" strokeLinecap="round" />
                      </svg>
                    </ReliableActionButton>
                  </div>
                </div>

                <div className="pf-a3-routine-kpi-grid">
                  <article className="pf-a3-routine-kpi">
                    <p className="pf-a3-routine-kpi-label">Sesiones asignadas</p>
                    <p className="pf-a3-routine-kpi-value">{routineSummary.sessions}</p>
                  </article>
                  <article className="pf-a3-routine-kpi">
                    <p className="pf-a3-routine-kpi-label">Total bloques</p>
                    <p className="pf-a3-routine-kpi-value">{routineSummary.blocks}</p>
                  </article>
                  <article className="pf-a3-routine-kpi">
                    <p className="pf-a3-routine-kpi-label">Total ejercicios</p>
                    <p className="pf-a3-routine-kpi-value">{routineSummary.exercises}</p>
                  </article>
                </div>
              </section>

              {hasWeekPlanRoutine ? (
                <section className="pf-a3-routine-session-strip pf-a3-routine-session-strip-week">
                  <div className="pf-a3-routine-week-nav" aria-label="Control de semanas">
                    <ReliableActionButton
                      type="button"
                      onClick={() => handleRoutineWeekStep(-1)}
                      disabled={!canGoPrevRoutineWeek || routineDayWeekLoading}
                      className="pf-a3-routine-week-arrow"
                      aria-label="Semana anterior"
                      title={canGoPrevRoutineWeek ? "Semana anterior" : "No hay semana anterior"}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="m14.5 6-5 6 5 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ReliableActionButton>
                    <p className="pf-a3-routine-week-label">{routineWeekLabel}</p>
                    <ReliableActionButton
                      type="button"
                      onClick={() => handleRoutineWeekStep(1)}
                      disabled={!canGoNextRoutineWeek || routineDayWeekLoading}
                      className="pf-a3-routine-week-arrow"
                      aria-label="Semana siguiente"
                      title={canGoNextRoutineWeek ? "Semana siguiente" : "No hay semana siguiente"}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="m9.5 6 5 6-5 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ReliableActionButton>
                  </div>

                  <div className="pf-a3-routine-session-scroll" aria-label="Dias de la semana">
                    {routineDaysForSelectedWeek.map((day, dayIndex) => {
                      const isSelected = day.id === selectedRoutineDay?.id;
                      const dayLabel = String(day.dia || "").trim() || `Dia ${dayIndex + 1}`;

                      return (
                        <ReliableActionButton
                          key={`week-day-${day.id}`}
                          type="button"
                          onClick={() => handleRoutineDaySelect(day.id)}
                          disabled={routineDayWeekLoading}
                          className={`pf-a3-routine-session-chip ${
                            isSelected ? "pf-a3-routine-session-chip-active" : ""
                          }`}
                          aria-label={`Abrir ${dayLabel}`}
                          title={dayLabel}
                        >
                          {dayLabel}
                        </ReliableActionButton>
                      );
                    })}
                  </div>
                </section>
              ) : effectiveRoutineSessions.length > 0 ? (
                <section className="pf-a3-routine-session-strip pf-a3-routine-session-strip-week">
                  <div className="pf-a3-routine-week-nav" aria-label="Control de semanas">
                    <ReliableActionButton
                      type="button"
                      disabled
                      className="pf-a3-routine-week-arrow"
                      aria-label="Semana anterior no disponible"
                      title="No hay semana anterior"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="m14.5 6-5 6 5 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ReliableActionButton>
                    <p className="pf-a3-routine-week-label">Semana 1</p>
                    <ReliableActionButton
                      type="button"
                      disabled
                      className="pf-a3-routine-week-arrow"
                      aria-label="Semana siguiente no disponible"
                      title="No hay semana siguiente"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="m9.5 6 5 6-5 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ReliableActionButton>
                  </div>

                  <div className="pf-a3-routine-session-scroll" aria-label="Dias de la semana">
                    {effectiveRoutineSessions.map((session, index) => {
                      const isSelected = session.id === selectedRoutineSessionId;

                      return (
                        <ReliableActionButton
                          key={`session-chip-${session.id}`}
                          type="button"
                          onClick={() => handleRoutineSessionSelect(session.id)}
                          disabled={routineDayWeekLoading}
                          className={`pf-a3-routine-session-chip ${
                            isSelected ? "pf-a3-routine-session-chip-active" : ""
                          }`}
                          aria-label={`Abrir ${session.titulo || `Sesion ${index + 1}`}`}
                          title={session.titulo || `Sesion ${index + 1}`}
                        >
                          Dia {index + 1}
                        </ReliableActionButton>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {routineDayWeekLoading ? (
                <section className="pf-a3-routine-empty pf-a3-routine-loading" aria-live="polite">
                  <div className="pf-a3-routine-loading-visual" aria-hidden="true">
                    <span className="pf-a3-routine-loading-ring" />
                    <span className="pf-a3-routine-loading-core">PF</span>
                  </div>
                  <p className="pf-a3-routine-loading-brand">PF Control</p>
                  <h2>Cargando ejercicios...</h2>
                  <p>Actualizando rutina del dia o semana seleccionada.</p>
                </section>
              ) : !selectedRoutineEntry ? (
                <section className="pf-a3-routine-empty">
                  <h2>{hasWeekPlanRoutine ? "Sin bloques para este día" : "No hay sesiones cargadas"}</h2>
                  <p>
                    {hasWeekPlanRoutine
                      ? "Tu profe aún no cargó ejercicios en este día. Cambia de día o actualiza para sincronizar."
                      : "Cuando tu profe asigne una sesión, la rutina aparecerá acá automáticamente."}
                  </p>
                </section>
              ) : (
                <article key={selectedRoutineEntry.sesion.id} className="pf-a3-routine-session-card">
                  {(() => {
                    if (todayRoutineCompletion) {
                      const completedDate = new Date(todayRoutineCompletion.completedAt);
                      const completedLabel = `${String(completedDate.getDate()).padStart(2, "0")}/${String(
                        completedDate.getMonth() + 1
                      ).padStart(2, "0")}/${completedDate.getFullYear()}`;
                      return (
                        <div className="pf-a3-routine-flow-card pf-a3-routine-exercise-group-linked">
                          <div className="pf-a3-routine-flow-icon-ok" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                              <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <p className="pf-a3-routine-flow-title">Entrenamiento del {completedLabel} completado</p>
                          <ReliableActionButton
                            type="button"
                            onClick={() => {
                              clearRoutineCompletionToday();
                              startGuidedTraining();
                            }}
                            className="pf-a3-routine-flow-cta"
                          >
                            Repetir entrenamiento
                          </ReliableActionButton>
                          <p className="pf-a3-routine-flow-subtitle">Ver registros de hoy</p>
                        </div>
                      );
                    }
                    return (
                      <div className="pf-a3-routine-flow-card pf-a3-routine-exercise-group-linked">
                        {guidedPausedState ? (
                          <>
                            <p className="pf-a3-routine-flow-title">Entrenamiento en pausa</p>
                            <p className="pf-a3-routine-flow-subtitle">
                              Ejercicio {guidedPausedState.index + 1} de {guidedRoutineSteps.length} — retomás desde donde lo dejaste
                            </p>
                            <ReliableActionButton
                              type="button"
                              onClick={startGuidedTraining}
                              disabled={guidedRoutineSteps.length === 0}
                              className="pf-a3-routine-flow-cta pf-a3-routine-flow-cta-resume"
                            >
                              Reanudar entrenamiento
                            </ReliableActionButton>
                            <button
                              type="button"
                              onClick={() => { setGuidedPausedState(null); }}
                              className="pf-a3-routine-flow-discard-btn"
                            >
                              Descartar y empezar de cero
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="pf-a3-routine-flow-title">Estás listo para entrenar</p>
                            <p className="pf-a3-routine-flow-subtitle">
                              {guidedRoutineSteps.length} ejercicio{guidedRoutineSteps.length === 1 ? "" : "s"} en esta sesión
                            </p>
                            <ReliableActionButton
                              type="button"
                              onClick={startGuidedTraining}
                              disabled={guidedRoutineSteps.length === 0}
                              className="pf-a3-routine-flow-cta"
                            >
                              Comenzar a entrenar
                            </ReliableActionButton>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {false ? (
                  <div className="pf-a3-routine-block-stack">
                    {routineVisibleBlocks.map((block, blockIndex) => {
                      const blockKey = `${selectedRoutineEntry.sesion.id}-${block.id}`;
                      const isExpanded = true;
                      const visibleExercises = block.ejercicios;
                      const hasSupersetFlag =
                        normalizePersonKey(`${block.titulo || ""} ${block.objetivo || ""}`).includes("superserie") ||
                        block.ejercicios.some(
                          (exercise) => Array.isArray(exercise.superSerie) && exercise.superSerie.length > 0
                        );

                      return (
                        <section key={blockKey} className="pf-a3-routine-block">
                          {block.objetivo ? <p className="pf-a3-routine-block-note">{block.objetivo}</p> : null}
                          {hasSupersetFlag ? <p className="pf-a3-routine-block-alert">Superserie</p> : null}

                          {visibleExercises.length > 0 ? (
                            <div className="pf-a3-routine-exercise-stack">
                              {visibleExercises.map((exercise, index) => {
                                const baseExerciseId = String(exercise.ejercicioId || `exercise-${index + 1}`);
                                const baseExerciseDetail = exercise.ejercicioId
                                  ? ejerciciosById.get(exercise.ejercicioId) || null
                                  : null;
                                const baseExerciseName = baseExerciseDetail?.nombre || `Ejercicio ${index + 1}`;
                                const superSerieRows = Array.isArray(exercise.superSerie)
                                  ? exercise.superSerie
                                  : [];
                                const hasSuperSerieGroup = superSerieRows.length > 0;

                                const rows = [
                                  {
                                    rowId: baseExerciseId,
                                    rowName: baseExerciseName,
                                    rowHeadline: baseExerciseName,
                                    rowParentName: "",
                                    detail: baseExerciseDetail,
                                    series: exercise.series,
                                    repeticiones: exercise.repeticiones,
                                    descanso: exercise.descanso,
                                    carga: exercise.carga,
                                    observaciones: exercise.observaciones,
                                    metricas: Array.isArray(exercise.metricas) ? exercise.metricas : [],
                                    isSuperSerie: false,
                                    rowKeySuffix: `base-${index}`,
                                    rowOrderIndex: index,
                                  },
                                  ...superSerieRows.map((superItem, superIndex) => {
                                    const superDetail = superItem.ejercicioId
                                      ? ejerciciosById.get(superItem.ejercicioId) || null
                                      : null;
                                    const superName =
                                      superDetail?.nombre || `Ejercicio combinado ${superIndex + 1}`;

                                    return {
                                      rowId: String(
                                        superItem.ejercicioId ||
                                          superItem.id ||
                                          `${baseExerciseId}-super-${superIndex + 1}`
                                      ),
                                      rowName: `[${baseExerciseName}] ${superName}`,
                                      rowHeadline: superName,
                                      rowParentName: baseExerciseName,
                                      detail: superDetail,
                                      series: superItem.series,
                                      repeticiones: superItem.repeticiones,
                                      descanso: superItem.descanso,
                                      carga: superItem.carga,
                                      observaciones: `Superserie vinculada a ${baseExerciseName}`,
                                      metricas: [],
                                      isSuperSerie: true,
                                      rowKeySuffix: `super-${index}-${superIndex}`,
                                      rowOrderIndex: index * 100 + superIndex + 1,
                                    };
                                  }),
                                ];

                                return (
                                  <div
                                    key={`${block.id}-group-${exercise.ejercicioId || index}`}
                                    className={`pf-a3-routine-exercise-group ${
                                      hasSuperSerieGroup ? "pf-a3-routine-exercise-group-linked" : ""
                                    }`}
                                  >
                                    {hasSuperSerieGroup ? (
                                      <p className="pf-a3-routine-exercise-group-badge">
                                        <span>Super serie</span>
                                        <strong>{superSerieRows.length + 1} ejercicios fusionados</strong>
                                      </p>
                                    ) : null}

                                    <div className="pf-a3-routine-exercise-group-stack">
                                      {rows.map((row) => {
                                        const rirMetric = row.metricas.find((metric) =>
                                          normalizePersonKey(metric.nombre).includes("rir")
                                        );
                                        const rowVideoUrl = String(row.detail?.videoUrl || "").trim();
                                        const rowVideoSource = resolveRoutineExerciseVideoSource(rowVideoUrl);
                                        const rowYouTubeThumbnail =
                                          rowVideoSource.kind === "iframe"
                                            ? resolveYouTubeThumbnailFromEmbed(rowVideoSource.src)
                                            : null;
                                        const hasVideoPreview =
                                          rowVideoSource.kind === "video" || Boolean(rowYouTubeThumbnail);
                                        const rowDescription =
                                          String(row.detail?.objetivo || "").trim() ||
                                          (row.isSuperSerie
                                            ? `Superserie asignada con ${baseExerciseName}`
                                            : "Ejecuta con tecnica y control");
                                        const rowTags = Array.from(
                                          new Set(
                                            [
                                              ...(Array.isArray(row.detail?.gruposMusculares)
                                                ? row.detail.gruposMusculares
                                                : []),
                                              String(row.detail?.categoria || "").trim(),
                                              row.isSuperSerie ? "Superserie" : "",
                                            ].filter(Boolean)
                                          )
                                        ).slice(0, 6);
                                        const exerciseKey = buildRoutineExerciseKey(
                                          selectedRoutineEntry.sesion.id,
                                          selectedRoutineEntry.weekId,
                                          selectedRoutineEntry.dayId,
                                          block.id,
                                          row.rowId,
                                          row.rowOrderIndex
                                        );

                                        const exerciseLogTarget: RoutineExerciseLogTarget = {
                                          sessionId: selectedRoutineEntry.sesion.id,
                                          sessionTitle: selectedRoutineEntry.sesion.titulo,
                                          weekId: selectedRoutineEntry.weekId,
                                          weekName: selectedRoutineEntry.weekName,
                                          dayId: selectedRoutineEntry.dayId,
                                          dayName: selectedRoutineEntry.dayName,
                                          blockId: block.id,
                                          blockTitle: block.titulo || `Bloque ${blockIndex + 1}`,
                                          exerciseId: row.rowId,
                                          exerciseName: row.rowName,
                                          exerciseKey,
                                          prescribedSeries: String(row.series || "").trim(),
                                          prescribedRepeticiones: String(row.repeticiones || "").trim(),
                                          prescribedCarga: String(row.carga || "").trim(),
                                          prescribedDescanso: String(row.descanso || "").trim(),
                                          prescribedRir: String(rirMetric?.valor || "").trim(),
                                          suggestedVideoUrl: rowVideoUrl,
                                          exerciseDescription: rowDescription,
                                          exerciseTags: rowTags,
                                        };

                                        return (
                                          <article
                                            key={`${block.id}-${row.rowKeySuffix}`}
                                            className={`pf-a3-routine-exercise-row ${
                                              row.isSuperSerie
                                                ? "pf-a3-routine-exercise-row-superset"
                                                : "pf-a3-routine-exercise-row-base"
                                            }`}
                                          >
                                            <div className="pf-a3-routine-exercise-main">
                                              <span
                                                className={`pf-a3-routine-exercise-index ${
                                                  row.isSuperSerie ? "pf-a3-routine-exercise-index-superset" : ""
                                                }`}
                                              >
                                                {row.isSuperSerie ? "SS" : index + 1}
                                              </span>
                                              <span
                                                className={`pf-a3-routine-exercise-thumb ${
                                                  hasVideoPreview
                                                    ? "pf-a3-routine-exercise-thumb-has-media"
                                                    : ""
                                                }`}
                                                aria-hidden="true"
                                              >
                                                {rowVideoSource.kind === "video" ? (
                                                  <video
                                                    className="pf-a3-routine-exercise-thumb-media"
                                                    src={rowVideoSource.src}
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                  />
                                                ) : rowYouTubeThumbnail ? (
                                                  <img
                                                    src={rowYouTubeThumbnail}
                                                    alt=""
                                                    className="pf-a3-routine-exercise-thumb-media"
                                                    loading="lazy"
                                                    decoding="async"
                                                  />
                                                ) : (
                                                  getInitials(row.rowName)
                                                )}

                                                {hasVideoPreview ? (
                                                  <span className="pf-a3-routine-exercise-thumb-play" aria-hidden="true">
                                                    ▶
                                                  </span>
                                                ) : null}
                                              </span>
                                              <div className="min-w-0">
                                                <ReliableActionButton
                                                  type="button"
                                                  onClick={() => openRoutineExerciseLogPanel(exerciseLogTarget)}
                                                  className="pf-a3-routine-exercise-name-btn"
                                                  aria-label={`Registrar cargas de ${row.rowName}`}
                                                >
                                                  <p className="pf-a3-routine-exercise-name">
                                                    {row.rowHeadline}
                                                  </p>
                                                </ReliableActionButton>
                                                <p className="pf-a3-routine-exercise-desc">{rowDescription}</p>
                                              </div>
                                            </div>

                                            <div className="pf-a3-routine-exercise-stats">
                                              <div className="pf-a3-routine-exercise-stat">
                                                <span>Series:</span>
                                                <strong>{row.series || "S/D"}</strong>
                                              </div>
                                              <div className="pf-a3-routine-exercise-stat">
                                                <span>Rep.:</span>
                                                <strong>{row.repeticiones || "S/D"}</strong>
                                              </div>
                                              <div className="pf-a3-routine-exercise-stat">
                                                <span>Desc.:</span>
                                                <strong>{row.descanso || "S/D"}</strong>
                                              </div>
                                              <div className="pf-a3-routine-exercise-stat">
                                                <span>RIR:</span>
                                                <strong>{rirMetric?.valor || "S/D"}</strong>
                                              </div>
                                              <div className="pf-a3-routine-exercise-stat">
                                                <span>Carga (Kg):</span>
                                                <strong>{row.carga || "S/D"}</strong>
                                              </div>
                                              <div className="pf-a3-routine-exercise-stat">
                                                <span>Obs.:</span>
                                                <strong>{row.observaciones || "S/D"}</strong>
                                              </div>
                                            </div>

                                            {rowTags.length > 0 ? (
                                              <div className="pf-a3-routine-exercise-tags">
                                                {rowTags.map((tag, tagIndex) => (
                                                  <span
                                                    key={`${block.id}-${row.rowKeySuffix}-${tagIndex}`}
                                                    className="pf-a3-routine-exercise-tag"
                                                  >
                                                    {tag}
                                                  </span>
                                                ))}
                                              </div>
                                            ) : null}
                                          </article>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}

                        </section>
                      );
                    })}
                  </div>
                  ) : null}

                  {false && isUltraMobile && routineRemainingBlocks > 0 ? (
                    <ReliableActionButton
                      type="button"
                      onClick={() =>
                        setVisibleRoutineBlockCount((previous) =>
                          Math.min(previous + 2, selectedRoutineEntry.blocks.length)
                        )
                      }
                      className="pf-a3-routine-more"
                    >
                      Cargar 2 bloques mas ({routineRemainingBlocks} restantes)
                    </ReliableActionButton>
                  ) : null}

                </article>
              )}

              {activeRoutineActionScreen !== "none" && activeRoutineActionScreen !== "timer" && typeof document !== "undefined"
                ? createPortal(
                <div
                  className={`pf-a3-routine-log-overlay ${
                    isUltraMobile ? "pf-a3-routine-log-overlay-mobile" : ""
                  } pf-a3-routine-action-overlay`}
                  role="dialog"
                  aria-modal="true"
                >
                  <article
                    className={`pf-a3-routine-log-panel ${
                      isUltraMobile ? "pf-a3-routine-log-panel-mobile" : ""
                    } pf-a3-routine-action-panel ${
                      activeRoutineActionScreen === "change"
                        ? "pf-a3-routine-action-panel-change"
                        : activeRoutineActionScreen === "sessions"
                          ? "pf-a3-routine-action-panel-sessions"
                          : "pf-a3-routine-action-panel-finalize"
                    }`}
                  >
                    {routineActionScreenLoading ? (
                      <>
                        <div className="pf-a3-routine-log-head">
                          <div className="min-w-0">
                            <p className="pf-a3-routine-log-kicker">Cargando</p>
                            <h3 className="pf-a3-routine-log-title">
                              {activeRoutineActionScreen === "change"
                                ? "Solicitud de cambio"
                                : activeRoutineActionScreen === "sessions"
                                  ? "Sesiones finalizadas"
                                  : "Finalizar sesión"}
                            </h3>
                            <p className="pf-a3-routine-log-meta">Preparando pantalla.</p>
                          </div>
                          <ReliableActionButton
                            type="button"
                            onClick={closeRoutineActionScreen}
                            className="pf-a3-routine-log-close"
                            aria-label="Cerrar panel"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                            </svg>
                          </ReliableActionButton>
                        </div>

                        <section className="pf-a3-routine-empty pf-a3-routine-loading pf-a3-routine-action-loading" aria-live="polite">
                          <div className="pf-a3-routine-loading-visual" aria-hidden="true">
                            <span className="pf-a3-routine-loading-ring" />
                            <span className="pf-a3-routine-loading-core">PF</span>
                          </div>
                          <p className="pf-a3-routine-loading-brand">PF Control</p>
                          <h2>Cargando panel...</h2>
                          <p>Actualizando vista de rutina.</p>
                        </section>
                      </>
                    ) : activeRoutineActionScreen === "change" ? (
                      <>
                        <div className="pf-a3-routine-log-head">
                          <div className="min-w-0">
                            <p className="pf-a3-routine-log-kicker">Solicitud</p>
                            <h3 className="pf-a3-routine-log-title">Solicitar cambio de rutina</h3>
                            <p className="pf-a3-routine-log-meta">
                              Envia al profesor el motivo para ajustar este día o sesión.
                            </p>
                          </div>

                          <ReliableActionButton
                            type="button"
                            onClick={closeRoutineActionScreen}
                            className="pf-a3-routine-log-close"
                            aria-label="Cerrar solicitud"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                            </svg>
                          </ReliableActionButton>
                        </div>

                        <textarea
                          value={routineChangeRequestDraft}
                          onChange={(event) => setRoutineChangeRequestDraft(event.target.value)}
                          rows={4}
                          className="pf-a3-routine-action-textarea"
                          placeholder="Ej: esta variante me genera dolor en rodilla y necesito otra opción de ejercicio."
                        />

                        <div className="pf-a3-routine-action-row">
                          <span className="pf-a3-routine-action-counter">
                            {routineChangeRequestDraft.trim().length} caracteres
                          </span>
                          <ReliableActionButton
                            type="button"
                            onClick={submitRoutineChangeRequest}
                            className="pf-a3-routine-action-primary pf-a3-routine-action-primary-change"
                          >
                            Enviar solicitud
                          </ReliableActionButton>
                        </div>

                        {routineChangeRequestStatus ? (
                          <p className="pf-a3-routine-action-status">{routineChangeRequestStatus}</p>
                        ) : null}

                        {routineChangeRequests[0] ? (
                          <p className="pf-a3-routine-action-meta">
                            Última solicitud: {formatDateTime(routineChangeRequests[0].createdAt)} hs
                          </p>
                        ) : null}
                      </>
                    ) : activeRoutineActionScreen === "sessions" ? (
                      <>
                        <div className="pf-a3-routine-log-head">
                          <div className="min-w-0">
                            <p className="pf-a3-routine-log-kicker">Historial</p>
                            <h3 className="pf-a3-routine-log-title">Sesiones finalizadas</h3>
                            <p className="pf-a3-routine-log-meta">
                              Historial de cierres diarios con feedback enviado.
                            </p>
                          </div>

                          <ReliableActionButton
                            type="button"
                            onClick={closeRoutineActionScreen}
                            className="pf-a3-routine-log-close"
                            aria-label="Cerrar historial"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                            </svg>
                          </ReliableActionButton>
                        </div>

                        {routineSessionFeedbackHistory.length === 0 ? (
                          <p className="pf-a3-routine-action-empty">Todavía no finalizaste sesiones con feedback.</p>
                        ) : (
                          <div className="pf-a3-routine-action-list">
                            {routineSessionFeedbackHistory.map((record) => (
                              <article
                                key={record.id}
                                className="pf-a3-routine-action-card"
                              >
                                <div className="pf-a3-routine-action-card-head">
                                  <p>
                                    {record.dayName || record.sessionTitle || "Sesión"}
                                  </p>
                                  <span>{formatDateTime(record.createdAt)} hs</span>
                                </div>

                                {record.answers.length > 0 ? (
                                  <ul className="pf-a3-routine-action-answer-list">
                                    {record.answers.map((answer) => (
                                      <li key={`${record.id}-${answer.questionId}-${answer.optionId}`}>
                                        {answer.questionPrompt}: <span>{answer.optionLabel}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="pf-a3-routine-action-meta">Sin respuestas cargadas.</p>
                                )}

                                <p className="pf-a3-routine-action-meta">
                                  Registros del día: {record.totalWorkoutLogs || 0} · Con molestia: {record.logsWithPain || 0}
                                </p>
                              </article>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="pf-a3-routine-log-head">
                          <div className="min-w-0">
                            <p className="pf-a3-routine-log-kicker">Feedback</p>
                            <h3 className="pf-a3-routine-log-title">Finalizar sesión</h3>
                            <p className="pf-a3-routine-log-meta">
                              Cierra el día y envía tu feedback al profesor.
                            </p>
                          </div>

                          <ReliableActionButton
                            type="button"
                            onClick={closeRoutineActionScreen}
                            className="pf-a3-routine-log-close"
                            aria-label="Cerrar finalización"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                            </svg>
                          </ReliableActionButton>
                        </div>

                        {(() => {
                          // Build ordered survey steps: measurements + legacy questions
                          const configMeasurements = selectedRoutineDayFeedbackConfig?.measurements;
                          const activeMeasurementIds: PostSessionMeasurementId[] =
                            configMeasurements && configMeasurements.length > 0
                              ? configMeasurements.filter((m) => m.visible).map((m) => m.id)
                              : DEFAULT_VISIBLE_MEASUREMENTS;
                          const activeCatalog = POST_SESSION_MEASUREMENT_CATALOG.filter((m) =>
                            activeMeasurementIds.includes(m.id)
                          );
                          type SurveyStep =
                            | { kind: "measurement"; catalog: (typeof POST_SESSION_MEASUREMENT_CATALOG)[number] }
                            | { kind: "question"; question: (typeof selectedRoutineDayFeedbackQuestions)[number] };
                          const allSteps: SurveyStep[] = [
                            ...activeCatalog.map((c) => ({ kind: "measurement" as const, catalog: c })),
                            ...selectedRoutineDayFeedbackQuestions.map((q) => ({ kind: "question" as const, question: q })),
                          ];
                          const totalSteps = allSteps.length;
                          const currentStep = Math.min(routineFinalizeSurveyStep, totalSteps - 1);
                          const isLastStep = currentStep >= totalSteps - 1;
                          const step = totalSteps > 0 ? allSteps[currentStep] : null;

                          const goNext = () => {
                            if (!isLastStep) setRoutineFinalizeSurveyStep((s) => s + 1);
                          };
                          const goPrev = () => {
                            if (currentStep > 0) setRoutineFinalizeSurveyStep((s) => s - 1);
                          };
                          const autoAdvance = (callback: () => void) => {
                            callback();
                            if (!isLastStep) {
                              setTimeout(() => setRoutineFinalizeSurveyStep((s) => Math.min(s + 1, totalSteps - 1)), 180);
                            }
                          };

                          if (totalSteps === 0 || !step) {
                            return (
                              <div className="pf-a3-survey-empty">
                                <p>Sesión lista para cerrar.</p>
                                <ReliableActionButton
                                  type="button"
                                  onClick={submitRoutineFinalize}
                                  className="pf-a3-survey-finish-btn"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16" aria-hidden="true">
                                    <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  Guardar cierre
                                </ReliableActionButton>
                              </div>
                            );
                          }

                          return (
                            <div key={currentStep} className="pf-a3-survey-step">
                              {/* progress pips */}
                              <div className="pf-a3-survey-progress">
                                {allSteps.map((_, i) => (
                                  <span
                                    key={i}
                                    className={`pf-a3-survey-pip ${
                                      i < currentStep
                                        ? "pf-a3-survey-pip-done"
                                        : i === currentStep
                                          ? "pf-a3-survey-pip-active"
                                          : "pf-a3-survey-pip-pending"
                                    }`}
                                  />
                                ))}
                              </div>

                              <p className="pf-a3-survey-counter">
                                {currentStep + 1} / {totalSteps}
                              </p>

                              {step.kind === "measurement" ? (
                                <>
                                  <p className="pf-a3-survey-label">{step.catalog.nombre}</p>
                                  {step.catalog.tipo === "scale" ? (
                                    <div className="pf-a3-survey-scale-row">
                                      {Array.from(
                                        { length: (step.catalog.max ?? 10) - (step.catalog.min ?? 1) + 1 },
                                        (_, i) => {
                                          const v = String((step.catalog.min ?? 1) + i);
                                          const isActive = String(routineFinalizeMeasurements[step.catalog.id] || "") === v;
                                          return (
                                            <button
                                              key={v}
                                              type="button"
                                              className={`pf-a3-survey-scale-btn ${isActive ? "pf-a3-survey-scale-btn-active" : ""}`}
                                              onClick={() =>
                                                autoAdvance(() =>
                                                  setRoutineFinalizeMeasurements((prev) => ({ ...prev, [step.catalog.id]: v }))
                                                )
                                              }
                                            >
                                              {v}
                                            </button>
                                          );
                                        }
                                      )}
                                    </div>
                                  ) : step.catalog.tipo === "select" ? (
                                    <div className="pf-a3-survey-options-row">
                                      {(step.catalog.opciones ?? []).map((opt) => {
                                        const isActive = String(routineFinalizeMeasurements[step.catalog.id] || "") === opt;
                                        return (
                                          <button
                                            key={opt}
                                            type="button"
                                            className={`pf-a3-survey-option-btn ${isActive ? "pf-a3-survey-option-btn-active" : ""}`}
                                            onClick={() =>
                                              autoAdvance(() =>
                                                setRoutineFinalizeMeasurements((prev) => ({ ...prev, [step.catalog.id]: opt }))
                                              )
                                            }
                                          >
                                            {opt}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : step.catalog.tipo === "text" ? (
                                    <textarea
                                      className="pf-a3-survey-textarea"
                                      rows={3}
                                      placeholder="Opcional..."
                                      value={String(routineFinalizeMeasurements[step.catalog.id] || "")}
                                      onChange={(e) =>
                                        setRoutineFinalizeMeasurements((prev) => ({
                                          ...prev,
                                          [step.catalog.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  ) : (
                                    <input
                                      type="number"
                                      className="pf-a3-survey-number"
                                      placeholder={`${step.catalog.min ?? 1}–${step.catalog.max ?? 999}`}
                                      min={step.catalog.min}
                                      max={step.catalog.max}
                                      value={String(routineFinalizeMeasurements[step.catalog.id] || "")}
                                      onChange={(e) =>
                                        setRoutineFinalizeMeasurements((prev) => ({
                                          ...prev,
                                          [step.catalog.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  )}
                                </>
                              ) : (
                                <>
                                  <p className="pf-a3-survey-label">{step.question.prompt}</p>
                                  <div className="pf-a3-survey-options-row">
                                    {step.question.options.map((option) => {
                                      const isActive = routineFinalizeAnswerByQuestionId[step.question.id] === option.id;
                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          className={`pf-a3-survey-option-btn ${isActive ? "pf-a3-survey-option-btn-active" : ""}`}
                                          onClick={() =>
                                            autoAdvance(() =>
                                              setRoutineFinalizeAnswerByQuestionId((prev) => ({
                                                ...prev,
                                                [step.question.id]: option.id,
                                              }))
                                            )
                                          }
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}

                              <div className="pf-a3-survey-nav">
                                <button
                                  type="button"
                                  onClick={goPrev}
                                  disabled={currentStep === 0}
                                  className="pf-a3-survey-nav-back"
                                  aria-label="Pregunta anterior"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
                                    <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                                {isLastStep ? (
                                  <ReliableActionButton
                                    type="button"
                                    onClick={submitRoutineFinalize}
                                    className="pf-a3-survey-finish-btn"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16" aria-hidden="true">
                                      <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Guardar cierre
                                  </ReliableActionButton>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={goNext}
                                    className="pf-a3-survey-nav-next"
                                  >
                                    Siguiente
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
                                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                )}
                              </div>

                              {routineFinalizeStatus ? (
                                <p className="pf-a3-routine-action-status">{routineFinalizeStatus}</p>
                              ) : null}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </article>
                </div>,
                document.body
                  )
                : null}

              {activeRoutineActionScreen === "timer" && typeof document !== "undefined"
                ? createPortal(
                <aside
                  ref={(node) => {
                    routineStopwatchFloatHostRef.current = node;
                  }}
                  className={`pf-a3-routine-stopwatch-float ${
                    routineStopwatchDragging ? "pf-a3-routine-stopwatch-float-dragging" : ""
                  }`}
                  style={
                    routineStopwatchFloatPosition
                      ? {
                          transform: `translate3d(${routineStopwatchFloatPosition.x}px, ${routineStopwatchFloatPosition.y}px, 0)`,
                        }
                      : {
                          visibility: "hidden",
                        }
                  }
                  onPointerDown={handleRoutineStopwatchPointerDown}
                  onPointerMove={handleRoutineStopwatchPointerMove}
                  onPointerUp={handleRoutineStopwatchPointerUp}
                  onPointerCancel={handleRoutineStopwatchPointerCancel}
                  aria-live="polite"
                >
                  <p className="pf-a3-routine-stopwatch-display">{routineStopwatchDisplay}</p>
                  <p
                    className={`pf-a3-routine-stopwatch-status ${
                      routineStopwatchRunning
                        ? "pf-a3-routine-stopwatch-status-running"
                        : ""
                    }`}
                  >
                    {routineStopwatchStatusShortLabel}
                  </p>

                  <div className="pf-a3-routine-stopwatch-mini-actions">
                    <ReliableActionButton
                      type="button"
                      onClick={routineStopwatchRunning ? pauseRoutineStopwatch : startRoutineStopwatch}
                      className="pf-a3-routine-stopwatch-mini-btn pf-a3-routine-stopwatch-mini-btn-play"
                      aria-label={
                        routineStopwatchRunning
                          ? "Pausar cronómetro"
                          : routineStopwatchElapsedMs > 0
                            ? "Reanudar cronómetro"
                            : "Iniciar cronómetro"
                      }
                      title={
                        routineStopwatchRunning
                          ? "Pausar"
                          : routineStopwatchElapsedMs > 0
                            ? "Reanudar"
                            : "Play"
                      }
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                        {routineStopwatchRunning ? (
                          <>
                            <path d="M9 7.5v9" strokeLinecap="round" />
                            <path d="M15 7.5v9" strokeLinecap="round" />
                          </>
                        ) : (
                          <path d="M9 7.5v9l7-4.5-7-4.5Z" fill="currentColor" stroke="none" />
                        )}
                      </svg>
                    </ReliableActionButton>

                    <ReliableActionButton
                      type="button"
                      onClick={stopRoutineStopwatch}
                      disabled={!routineStopwatchRunning && routineStopwatchElapsedMs <= 0}
                      className="pf-a3-routine-stopwatch-mini-btn pf-a3-routine-stopwatch-mini-btn-stop"
                      aria-label="Frenar cronómetro"
                      title="Frenar"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                        <rect x="8" y="8" width="8" height="8" rx="1.2" />
                      </svg>
                    </ReliableActionButton>

                    <ReliableActionButton
                      type="button"
                      onClick={() => setRoutineQuickPanel("none")}
                      className="pf-a3-routine-stopwatch-mini-btn pf-a3-routine-stopwatch-mini-btn-close"
                      aria-label="Ocultar cronómetro"
                      title="Ocultar"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M7.5 7.5 16.5 16.5" strokeLinecap="round" />
                        <path d="M16.5 7.5 7.5 16.5" strokeLinecap="round" />
                      </svg>
                    </ReliableActionButton>
                  </div>
                </aside>,
                document.body
                  )
                : null}

              {routineExerciseLogTarget && typeof document !== "undefined"
                ? createPortal(
                <div
                  className={`pf-a3-routine-log-overlay ${
                    isUltraMobile ? "pf-a3-routine-log-overlay-mobile" : ""
                  }`}
                  role="dialog"
                  aria-modal="true"
                >
                  <article
                    key={guidedTrainingMode ? guidedStepKey : undefined}
                    className={`pf-a3-routine-log-panel ${
                      isUltraMobile ? "pf-a3-routine-log-panel-mobile" : ""
                    } ${
                      routineExerciseVideoSource.kind !== "none" ? "pf-a3-routine-log-panel-has-video" : ""
                    } ${
                      guidedTrainingMode ? "pf-a3-guided-step-enter" : ""
                    }`}
                  >
                    <div className="pf-a3-routine-log-head">
                      <div className="min-w-0">
                        <p className="pf-a3-routine-log-kicker">
                          {guidedTrainingMode
                            ? `Ejercicio ${guidedTrainingIndex + 1} de ${guidedRoutineSteps.length}`
                            : "Registrar carga"}
                        </p>
                        <h3 className="pf-a3-routine-log-title">{routineExerciseLogTarget.exerciseName}</h3>
                        <p className="pf-a3-routine-log-meta">
                          {routineExerciseLogTarget.blockTitle
                            ? `${routineExerciseLogTarget.blockTitle} · `
                            : ""}
                          {routineExerciseLogTarget.weekName || routineWeekLabel}
                          {routineExerciseLogTarget.dayName ? ` · ${routineExerciseLogTarget.dayName}` : ""}
                        </p>
                      </div>

                      <ReliableActionButton
                        type="button"
                        onClick={closeRoutineExerciseLogPanel}
                        className="pf-a3-routine-log-close"
                        aria-label="Cerrar registro"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                        </svg>
                      </ReliableActionButton>
                    </div>

                    <div className="pf-a3-routine-log-presets">
                      <div className="pf-a3-routine-log-preset">
                        <span>Series</span>
                        <strong>{routineExerciseLogTarget.prescribedSeries || "S/D"}</strong>
                      </div>
                      <div className="pf-a3-routine-log-preset">
                        <span>Rep.</span>
                        <strong>{routineExerciseLogTarget.prescribedRepeticiones || "S/D"}</strong>
                      </div>
                      <div className="pf-a3-routine-log-preset">
                        <span>Desc.</span>
                        <strong>{routineExerciseLogTarget.prescribedDescanso || "S/D"}</strong>
                      </div>
                      <div className="pf-a3-routine-log-preset">
                        <span>RIR</span>
                        <strong>{routineExerciseLogTarget.prescribedRir || "S/D"}</strong>
                      </div>
                      <div className="pf-a3-routine-log-preset">
                        <span>Carga (kg)</span>
                        <strong>{routineExerciseLogTarget.prescribedCarga || "S/D"}</strong>
                      </div>
                    </div>

                    <div className="pf-a3-routine-log-tabs" role="tablist" aria-label="Secciones del ejercicio">
                      <ReliableActionButton
                        type="button"
                        role="tab"
                        aria-selected={routineExerciseLogView === "descripcion"}
                        onClick={() => setRoutineExerciseLogView("descripcion")}
                        className={`pf-a3-routine-log-tab ${
                          routineExerciseLogView === "descripcion" ? "pf-a3-routine-log-tab-active" : ""
                        }`}
                      >
                        Descripcion
                      </ReliableActionButton>
                      <ReliableActionButton
                        type="button"
                        role="tab"
                        aria-selected={routineExerciseLogView === "registro"}
                        onClick={() => setRoutineExerciseLogView("registro")}
                        className={`pf-a3-routine-log-tab ${
                          routineExerciseLogView === "registro" ? "pf-a3-routine-log-tab-active" : ""
                        }`}
                      >
                        Nuevo registro
                      </ReliableActionButton>
                      <ReliableActionButton
                        type="button"
                        role="tab"
                        aria-selected={routineExerciseLogView === "registros"}
                        onClick={() => setRoutineExerciseLogView("registros")}
                        className={`pf-a3-routine-log-tab ${
                          routineExerciseLogView === "registros" ? "pf-a3-routine-log-tab-active" : ""
                        }`}
                      >
                        Registros
                      </ReliableActionButton>
                    </div>

                    {routineExerciseVideoSource.kind !== "none" ? (
                      <div className="pf-a3-routine-log-video-wrap">
                        {routineExerciseVideoSource.kind === "iframe" ? (
                          <iframe
                            src={routineExerciseVideoSource.src}
                            title={`video-${routineExerciseLogTarget.exerciseKey}`}
                            className="pf-a3-routine-log-video-frame"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          />
                        ) : routineExerciseVideoSource.kind === "video" ? (
                          <video
                            controls
                            className="pf-a3-routine-log-video-frame"
                            src={routineExerciseVideoSource.src}
                          />
                        ) : (
                          <div className="pf-a3-routine-log-video-empty">
                            Vista previa no disponible para este link.
                          </div>
                        )}
                        <ReliableActionButton
                          type="button"
                          onClick={() => openRoutineVideoExternal(routineExerciseVideoCandidate)}
                          className="pf-a3-routine-log-link-btn"
                        >
                          {routineExerciseVideoCandidate.toLowerCase().includes("youtu")
                            ? "Abrir en YouTube"
                            : "Abrir video"}
                        </ReliableActionButton>
                      </div>
                    ) : null}

                    {routineExerciseLogView === "descripcion" ? (
                      <section className="pf-a3-routine-log-pane">
                        <p className="pf-a3-routine-log-description">
                          {routineExerciseLogTarget.exerciseDescription || "Sin descripcion para este ejercicio."}
                        </p>

                        {Array.isArray(routineExerciseLogTarget.exerciseTags) &&
                        routineExerciseLogTarget.exerciseTags.length > 0 ? (
                          <div className="pf-a3-routine-log-tag-row">
                            {routineExerciseLogTarget.exerciseTags.map((tag, index) => (
                              <span
                                key={`${routineExerciseLogTarget.exerciseKey}-tag-${index}`}
                                className="pf-a3-routine-exercise-tag"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {routineExerciseLogView === "registro" ? (
                      <section className="pf-a3-routine-log-pane pf-a3-routine-log-pane-registro">
                        <div className="pf-a3-routine-log-grid">
                          <label className="pf-a3-routine-log-field pf-a3-routine-log-field-fecha">
                            <span>Fecha</span>
                            <input
                              type="date"
                              value={routineExerciseLogDraft.fecha}
                              onChange={(event) =>
                                setRoutineExerciseLogDraft((previous) => ({
                                  ...previous,
                                  fecha: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="pf-a3-routine-log-field pf-a3-routine-log-field-series">
                            <span>Series</span>
                            <input
                              value={routineExerciseLogDraft.series}
                              onChange={(event) =>
                                setRoutineExerciseLogDraft((previous) => ({
                                  ...previous,
                                  series: event.target.value,
                                }))
                              }
                              placeholder={routineExerciseLogTarget.prescribedSeries || "0"}
                            />
                          </label>
                          <label className="pf-a3-routine-log-field pf-a3-routine-log-field-repeticiones">
                            <span>Repeticiones</span>
                            <input
                              value={routineExerciseLogDraft.repeticiones}
                              onChange={(event) =>
                                setRoutineExerciseLogDraft((previous) => ({
                                  ...previous,
                                  repeticiones: event.target.value,
                                }))
                              }
                              placeholder={routineExerciseLogTarget.prescribedRepeticiones || "0"}
                            />
                          </label>
                          <label className="pf-a3-routine-log-field pf-a3-routine-log-field-carga">
                            <span>Carga (kg)</span>
                            <input
                              value={routineExerciseLogDraft.pesoKg}
                              onChange={(event) =>
                                setRoutineExerciseLogDraft((previous) => ({
                                  ...previous,
                                  pesoKg: event.target.value,
                                }))
                              }
                              placeholder={routineExerciseLogTarget.prescribedCarga || "0"}
                            />
                          </label>
                        </div>

                        <label className="pf-a3-routine-log-field pf-a3-routine-log-field-full">
                          <span>Comentarios</span>
                          <textarea
                            rows={2}
                            value={routineExerciseLogDraft.comentarios}
                            onChange={(event) =>
                              setRoutineExerciseLogDraft((previous) => ({
                                ...previous,
                                comentarios: event.target.value,
                              }))
                            }
                            placeholder="Como te sentiste, tecnica, molestias o feedback para el profe"
                          />
                        </label>

                        <div className="pf-a3-routine-log-row">
                          <label className="pf-a3-routine-log-check">
                            <input
                              type="checkbox"
                              checked={routineExerciseLogDraft.molestia}
                              onChange={(event) =>
                                setRoutineExerciseLogDraft((previous) => ({
                                  ...previous,
                                  molestia: event.target.checked,
                                }))
                              }
                            />
                            Reportar molestia
                          </label>

                          <label className="pf-a3-routine-log-upload">
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/ogg,video/*"
                              onChange={handleRoutineVideoUpload}
                            />
                            Subir video
                          </label>
                        </div>

                        {routineExerciseLogDraft.molestia ? (
                          <div className="pf-a3-routine-log-pain-grid">
                            <label className="pf-a3-routine-log-field">
                              <span>Ubicacion del dolor</span>
                              <input
                                value={routineExerciseLogDraft.dolorUbicacion}
                                onChange={(event) =>
                                  setRoutineExerciseLogDraft((previous) => ({
                                    ...previous,
                                    dolorUbicacion: event.target.value,
                                  }))
                                }
                                placeholder="Ej: rodilla derecha, lumbar, hombro"
                              />
                            </label>

                            <label className="pf-a3-routine-log-field">
                              <span>En que momento aparece</span>
                              <select
                                value={routineExerciseLogDraft.dolorMomento}
                                onChange={(event) =>
                                  setRoutineExerciseLogDraft((previous) => ({
                                    ...previous,
                                    dolorMomento: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Seleccionar momento</option>
                                <option value="Al calentar">Al calentar</option>
                                <option value="Durante la serie">Durante la serie</option>
                                <option value="Al terminar la serie">Al terminar la serie</option>
                                <option value="En reposo">En reposo</option>
                                <option value="Todo el tiempo">Todo el tiempo</option>
                              </select>
                            </label>

                            <label className="pf-a3-routine-log-field pf-a3-routine-log-field-full">
                              <span>Que siente ahora</span>
                              <textarea
                                rows={2}
                                value={routineExerciseLogDraft.dolorSensacion}
                                onChange={(event) =>
                                  setRoutineExerciseLogDraft((previous) => ({
                                    ...previous,
                                    dolorSensacion: event.target.value,
                                  }))
                                }
                                placeholder="Ej: punzante, tirantez, ardor, hormigueo"
                              />
                            </label>

                            <article className="pf-a3-routine-log-pain-recommendation">
                              <p className="pf-a3-routine-log-pain-kicker">Recomendacion para seguir entrenando</p>
                              <p className="pf-a3-routine-log-pain-text">{routinePainRecommendation}</p>
                            </article>
                          </div>
                        ) : null}

                        {routineExerciseLogDraft.videoFileName ? (
                          <p className="pf-a3-routine-log-upload-note">
                            Archivo adjunto: {routineExerciseLogDraft.videoFileName}
                          </p>
                        ) : null}

                        {routineExerciseLogEditingId ? (
                          <p className="pf-a3-routine-log-editing-hint">Estas editando un registro guardado.</p>
                        ) : null}

                        <div className="pf-a3-routine-log-actions">
                          {routineExerciseLogEditingId ? (
                            <ReliableActionButton
                              type="button"
                              onClick={cancelRoutineExerciseLogEdit}
                              className="pf-a3-routine-log-secondary-btn"
                              disabled={routineExerciseLogSaving}
                            >
                              Cancelar edicion
                            </ReliableActionButton>
                          ) : null}

                          <ReliableActionButton
                            type="button"
                            onClick={saveRoutineExerciseLog}
                            className="pf-a3-routine-log-primary-btn"
                            disabled={routineExerciseLogSaving}
                          >
                            {routineExerciseLogSaving
                              ? routineExerciseLogEditingId
                                ? "Actualizando..."
                                : "Guardando..."
                              : routineExerciseLogEditingId
                                ? "Actualizar registro"
                                : "Guardar registro"}
                          </ReliableActionButton>
                        </div>

                        {routineExerciseLogStatus ? (
                          <p className="pf-a3-routine-log-status">{routineExerciseLogStatus}</p>
                        ) : null}
                      </section>
                    ) : null}

                    {routineExerciseLogView === "registros" ? (
                      <>
                        {routineExerciseRecentLogs.length > 0 ? (
                          <div className="pf-a3-routine-log-history">
                            <p className="pf-a3-routine-log-history-title">Ultimos registros</p>
                            <ul>
                              {routineExerciseRecentLogs.map((log) => {
                                const logRowId = String(log.id || "").trim();
                                const isEditingThisLog = Boolean(
                                  logRowId && routineExerciseLogEditingId && routineExerciseLogEditingId === logRowId
                                );

                                return (
                                  <li
                                    key={String(log.id || `${log.createdAt || "log"}-${log.fecha || ""}`)}
                                    className={`pf-a3-routine-log-history-item${
                                      isEditingThisLog ? " pf-a3-routine-log-history-item-editing" : ""
                                    }`}
                                  >
                                    <div className="pf-a3-routine-log-history-main">
                                      <span>
                                        {log.fecha
                                          ? new Date(`${log.fecha}T00:00:00`).toLocaleDateString("es-AR")
                                          : "Sin fecha"}
                                      </span>
                                      <strong>
                                        {Number(log.pesoKg || 0).toLocaleString("es-AR")} kg · {log.series || 0} x {log.repeticiones || 0}
                                      </strong>
                                    </div>

                                    {isEditingThisLog ? (
                                      <div className="pf-a3-routine-log-history-edit pf-a3-routine-log-pane-registro">
                                        <p className="pf-a3-routine-log-editing-hint">Modo edicion activo para este registro.</p>

                                        <div className="pf-a3-routine-log-grid pf-a3-routine-log-history-edit-grid">
                                          <label className="pf-a3-routine-log-field pf-a3-routine-log-field-fecha">
                                            <span>Fecha</span>
                                            <input
                                              type="date"
                                              value={routineExerciseLogDraft.fecha}
                                              onChange={(event) =>
                                                setRoutineExerciseLogDraft((previous) => ({
                                                  ...previous,
                                                  fecha: event.target.value,
                                                }))
                                              }
                                            />
                                          </label>

                                          <label className="pf-a3-routine-log-field pf-a3-routine-log-field-series">
                                            <span>Series</span>
                                            <input
                                              value={routineExerciseLogDraft.series}
                                              onChange={(event) =>
                                                setRoutineExerciseLogDraft((previous) => ({
                                                  ...previous,
                                                  series: event.target.value,
                                                }))
                                              }
                                            />
                                          </label>

                                          <label className="pf-a3-routine-log-field pf-a3-routine-log-field-repeticiones">
                                            <span>Repeticiones</span>
                                            <input
                                              value={routineExerciseLogDraft.repeticiones}
                                              onChange={(event) =>
                                                setRoutineExerciseLogDraft((previous) => ({
                                                  ...previous,
                                                  repeticiones: event.target.value,
                                                }))
                                              }
                                            />
                                          </label>

                                          <label className="pf-a3-routine-log-field pf-a3-routine-log-field-carga">
                                            <span>Carga (kg)</span>
                                            <input
                                              value={routineExerciseLogDraft.pesoKg}
                                              onChange={(event) =>
                                                setRoutineExerciseLogDraft((previous) => ({
                                                  ...previous,
                                                  pesoKg: event.target.value,
                                                }))
                                              }
                                            />
                                          </label>
                                        </div>

                                        <label className="pf-a3-routine-log-field pf-a3-routine-log-field-full">
                                          <span>Comentarios</span>
                                          <textarea
                                            rows={2}
                                            value={routineExerciseLogDraft.comentarios}
                                            onChange={(event) =>
                                              setRoutineExerciseLogDraft((previous) => ({
                                                ...previous,
                                                comentarios: event.target.value,
                                              }))
                                            }
                                            placeholder="Actualizar comentario si hace falta"
                                          />
                                        </label>

                                        <div className="pf-a3-routine-log-history-actions pf-a3-routine-log-history-edit-actions">
                                          <ReliableActionButton
                                            type="button"
                                            className="pf-a3-routine-log-secondary-btn"
                                            onClick={cancelRoutineExerciseLogEdit}
                                            disabled={routineExerciseLogSaving}
                                          >
                                            Cancelar
                                          </ReliableActionButton>

                                          <ReliableActionButton
                                            type="button"
                                            className="pf-a3-routine-log-primary-btn"
                                            onClick={saveRoutineExerciseLog}
                                            disabled={routineExerciseLogSaving}
                                          >
                                            {routineExerciseLogSaving ? "Actualizando..." : "Actualizar registro"}
                                          </ReliableActionButton>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="pf-a3-routine-log-history-actions">
                                        <ReliableActionButton
                                          type="button"
                                          className="pf-a3-routine-log-history-btn"
                                          onClick={() => editRoutineExerciseRecentLog(log)}
                                          disabled={routineExerciseLogSaving}
                                        >
                                          Editar
                                        </ReliableActionButton>

                                        <ReliableActionButton
                                          type="button"
                                          className="pf-a3-routine-log-history-btn pf-a3-routine-log-history-btn-danger"
                                          onClick={() => deleteRoutineExerciseRecentLog(log)}
                                          disabled={routineExerciseLogSaving}
                                        >
                                          Eliminar
                                        </ReliableActionButton>
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : (
                          <div className="pf-a3-routine-log-history pf-a3-routine-log-history-empty">
                            Todavia no hay registros cargados para este ejercicio.
                          </div>
                        )}

                        {routineExerciseLogStatus ? (
                          <p className="pf-a3-routine-log-status">{routineExerciseLogStatus}</p>
                        ) : null}
                      </>
                    ) : null}

                    {guidedTrainingMode ? (
                      <div className="pf-a3-guided-actions-bar">
                        <div className="pf-a3-guided-progress">
                          {guidedRoutineSteps.map((_, i) => (
                            <span
                              key={i}
                              className={`pf-a3-guided-pip ${i < guidedTrainingIndex ? "pf-a3-guided-pip-done" : i === guidedTrainingIndex ? "pf-a3-guided-pip-active" : "pf-a3-guided-pip-pending"}`}
                            />
                          ))}
                        </div>
                        <div className="pf-a3-guided-btns">
                          <ReliableActionButton
                            type="button"
                            onClick={exitGuidedTraining}
                            className="pf-a3-guided-btn-pause"
                            aria-label="Pausar entrenamiento"
                            title="Pausar"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" width="16" height="16">
                              <path d="M9 7v10M15 7v10" strokeLinecap="round" />
                            </svg>
                            Pausar
                          </ReliableActionButton>
                          {guidedTrainingIndex > 0 && (
                            <ReliableActionButton
                              type="button"
                              onClick={goBackGuidedTraining}
                              className="pf-a3-guided-btn-back"
                              aria-label="Ejercicio anterior"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" width="16" height="16">
                                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Atrás
                            </ReliableActionButton>
                          )}
                          <ReliableActionButton
                            type="button"
                            onClick={advanceGuidedTraining}
                            className={`pf-a3-guided-btn-next ${guidedTrainingIndex >= guidedRoutineSteps.length - 1 ? "pf-a3-guided-btn-finish" : ""}`}
                          >
                            {guidedTrainingIndex >= guidedRoutineSteps.length - 1 ? (
                              <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" width="16" height="16">
                                  <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Finalizar sesión
                              </>
                            ) : (
                              <>
                                Siguiente
                                <span className="pf-a3-guided-btn-counter">
                                  {guidedTrainingIndex + 1}/{guidedRoutineSteps.length}
                                </span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" width="14" height="14">
                                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </>
                            )}
                          </ReliableActionButton>
                        </div>
                      </div>
                    ) : null}
                  </article>
                </div>,
                document.body
              )
                : null}
            </div>
          ) : null}

          {activeCategory === "nutricion" ? (
            <div className="pf-a4-nutrition-screen space-y-4">
              <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                <p className="pf-a2-eyebrow">Plan nutricional</p>
                <h2 className="mt-1 text-xl font-black text-white">Nutrición del alumno</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Espacio centrado en el plan nutricional asignado por el profesor.
                </p>

                <div className="pf-a4-nutrition-plan-quick-row mt-3">
                  <ReliableActionButton
                    type="button"
                    onClick={openNutritionVariationActions}
                    className="pf-a4-nutrition-plan-action-btn pf-a4-nutrition-plan-action-btn-quick"
                    disabled={!nutritionPlan?.id}
                  >
                    Solicitar cambio de plan
                  </ReliableActionButton>

                  <ReliableActionButton
                    type="button"
                    onClick={triggerQuickNutritionReplacement}
                    className="pf-a4-nutrition-plan-action-btn pf-a4-nutrition-plan-action-btn-quick"
                    disabled={!nutritionQuickReplacementCandidate}
                  >
                    Sustituir alimento
                  </ReliableActionButton>
                </div>
              </article>

              {nutritionPanelView === "plan" ? (
                <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                    <p className="pf-a2-eyebrow">Plan pautado</p>
                    <h2 className="mt-1 text-xl font-black text-white">{nutritionPlan?.nombre || "Sin plan cargado"}</h2>
                    <p className="mt-2 text-sm text-slate-300">
                      Objetivo: {nutritionPlan?.objetivo || clientMeta?.objNutricional || "No definido"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Última asignación: {nutritionAssignedAt ? formatDateTime(nutritionAssignedAt) : "-"}
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="pf-a2-kpi rounded-xl border p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Calorías objetivo</p>
                        <p className="mt-1 text-lg font-black text-white">{nutritionDailyGoalKcal} kcal</p>
                      </div>
                      <div className="pf-a2-kpi rounded-xl border p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Calorías del plan</p>
                        <p className="mt-1 text-lg font-black text-white">{nutritionPlanCaloriesFromMeals} kcal</p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="pf-a2-kpi rounded-xl border p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Comidas pautadas</p>
                        <p className="mt-1 text-lg font-black text-white">{nutritionMealsDetailed.length}</p>
                      </div>
                      <div className="pf-a2-kpi rounded-xl border p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Macros objetivo</p>
                        <p className="mt-1 text-sm font-black text-white">
                          {nutritionDailyGoalMacros.proteinas}P / {nutritionDailyGoalMacros.carbohidratos}C / {nutritionDailyGoalMacros.grasas}G
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {macroRows.map((macro) => (
                        <div key={macro.key}>
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>{macro.label}</span>
                            <span>
                              {macro.grams} g · {macro.ratio}%
                            </span>
                          </div>
                          <div className="pf-a2-progress-track mt-1 h-2 overflow-hidden rounded-full bg-slate-700/70">
                            <div
                              className="pf-a2-progress-fill h-full rounded-full"
                              style={{ width: `${Math.max(4, macro.ratio)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {nutritionPlan ? (
                      <div className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-500/[0.08] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/90">
                          Guía útil del plan
                        </p>

                        {nutritionPlanTrainingSplit ? (
                          <p className="mt-2 text-xs text-cyan-50">
                            Ritmo semanal: {nutritionPlanTrainingSplit.trainingDays} con entrenamiento / {nutritionPlanTrainingSplit.restDays} de descanso
                          </p>
                        ) : null}

                        {nutritionPlanMealSchedule.length > 0 ? (
                          <p className="mt-1 text-xs text-cyan-50">
                            Horarios sugeridos: {nutritionPlanMealSchedule.join(" · ")}
                          </p>
                        ) : null}

                        {nutritionPlanGuideRows.length > 0 ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {nutritionPlanGuideRows.map((row) => (
                              <div
                                key={row.label}
                                className="rounded-lg border border-cyan-200/20 bg-slate-950/30 px-3 py-2"
                              >
                                <p className="text-[11px] uppercase tracking-[0.11em] text-cyan-100/75">{row.label}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-100">{row.value}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {nutritionPlan?.notas ? (
                          <details className="mt-3 rounded-lg border border-cyan-200/20 bg-slate-950/20 p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-cyan-100/90">
                              Ver detalle técnico
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">{nutritionPlan.notas}</p>
                          </details>
                        ) : null}
                      </div>
                    ) : null}

                    <div ref={nutritionPlanActionsSectionRef} className="pf-a4-nutrition-plan-actions-card mt-4">
                      <p className="pf-a4-nutrition-plan-actions-kicker">Variaciones del plan</p>
                      <h3 className="pf-a4-nutrition-plan-actions-title">Solicitar cambio de comida</h3>
                      <p className="pf-a4-nutrition-plan-actions-copy">
                        Envia una solicitud al profesor y pide un ajuste puntual del plan asignado.
                      </p>

                      <div className="pf-a4-nutrition-plan-actions-grid mt-3">
                        <label className="pf-a4-nutrition-plan-field">
                          <span>Comida</span>
                          <select
                            value={nutritionVariationMealId}
                            onChange={(event) => setNutritionVariationMealId(String(event.target.value || ""))}
                          >
                            <option value="">Plan general</option>
                            {nutritionMealsDetailed.map((meal, index) => (
                              <option key={`variation-meal-${meal.mealId}-${index}`} value={meal.mealId}>
                                {meal.mealName || `Comida ${index + 1}`}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="pf-a4-nutrition-plan-field">
                          <span>Que variacion necesitas</span>
                          <textarea
                            rows={3}
                            maxLength={280}
                            value={nutritionVariationDraft}
                            onChange={(event) => setNutritionVariationDraft(event.target.value)}
                            placeholder="Ej: necesito alternativa sin lactosa para la merienda."
                          />
                        </label>
                      </div>

                      <div className="pf-a4-nutrition-plan-actions-row mt-3">
                        <ReliableActionButton
                          type="button"
                          onClick={submitNutritionVariationRequest}
                          className="pf-a4-nutrition-plan-action-btn"
                          disabled={!nutritionPlan?.id}
                        >
                          Pedir variacion al profesor
                        </ReliableActionButton>

                        <span className="pf-a4-nutrition-plan-action-counter">
                          {String(nutritionVariationDraft || "").trim().length}/280
                        </span>
                      </div>

                      <div className="pf-a4-nutrition-plan-actions-feedback">
                        <p className="pf-a4-nutrition-plan-actions-status">
                          {nutritionVariationStatus || "Escribe el cambio y envia la solicitud."}
                        </p>
                        <p className="pf-a4-nutrition-plan-actions-meta">
                          {latestNutritionVariationRequest
                            ? `Ultima solicitud (${latestNutritionVariationRequest.mealName || "Plan general"}): ${formatDateTime(latestNutritionVariationRequest.createdAt)}`
                            : "Sin solicitudes enviadas todavia."}
                        </p>
                      </div>
                    </div>
                  </article>

                  {(() => {
                    const currentIdx = Math.max(
                      0,
                      nutritionWeeksDisplay.findIndex((week) => week.id === activeNutritionWeek?.id)
                    );
                    const canGoPrev = currentIdx > 0;
                    const canGoNext = currentIdx < nutritionWeeksDisplay.length - 1;
                    const stepWeek = (step: -1 | 1) => {
                      const nextIdx = Math.max(0, Math.min(nutritionWeeksDisplay.length - 1, currentIdx + step));
                      const nextWeek = nutritionWeeksDisplay[nextIdx];
                      if (!nextWeek) return;
                      setSelectedNutritionWeekId(nextWeek.id ?? null);
                      setSelectedNutritionDayId(nextWeek.dias?.[0]?.id || null);
                    };
                    const dayList = activeNutritionWeek?.dias || [];
                    return (
                      <section className="pf-a3-routine-session-strip pf-a3-routine-session-strip-week">
                        <div className="pf-a3-routine-week-nav" aria-label="Control de semanas de nutrición">
                          <ReliableActionButton
                            type="button"
                            onClick={() => stepWeek(-1)}
                            disabled={!canGoPrev}
                            className="pf-a3-routine-week-arrow"
                            aria-label="Semana anterior"
                            title={canGoPrev ? "Semana anterior" : "No hay semana anterior"}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                              <path d="m14.5 6-5 6 5 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </ReliableActionButton>
                          <p className="pf-a3-routine-week-label">{activeNutritionWeek?.nombre || "Semana 1"}</p>
                          <ReliableActionButton
                            type="button"
                            onClick={() => stepWeek(1)}
                            disabled={!canGoNext}
                            className="pf-a3-routine-week-arrow"
                            aria-label="Semana siguiente"
                            title={canGoNext ? "Semana siguiente" : "No hay semana siguiente"}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                              <path d="m9.5 6 5 6-5 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </ReliableActionButton>
                        </div>

                        <div className="pf-a3-routine-session-scroll" aria-label="Días de la semana">
                          {dayList.map((day, dayIndex) => {
                            if (!day) return null;
                            const isSelected = day.id === activeNutritionDay?.id;
                            const dayLabel = String(day.nombre || `Día ${dayIndex + 1}`).trim() || `Día ${dayIndex + 1}`;
                            return (
                              <ReliableActionButton
                                key={`nutrition-day-${day.id}`}
                                type="button"
                                onClick={() => setSelectedNutritionDayId(day.id ?? null)}
                                className={`pf-a3-routine-session-chip ${
                                  isSelected ? "pf-a3-routine-session-chip-active" : ""
                                }`}
                                aria-label={`Abrir ${dayLabel}`}
                                title={dayLabel}
                              >
                                {dayLabel}
                              </ReliableActionButton>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })()}

                  <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                    <p className="pf-a2-eyebrow">Distribucion</p>
                    <h2 className="mt-1 text-xl font-black text-white">Comidas del plan</h2>

                    {nutritionMealsDetailed.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {nutritionMealsDetailed.map((meal, index) => {
                          const mealName = meal.mealName || `Comida ${index + 1}`;
                          const mealTimeMatch = String(mealName).match(/(\d{1,2}:\d{2})/);
                          const mealTime = String(mealTimeMatch?.[1] || "").trim();

                          return (
                            <section key={meal.mealId || `${meal.mealName || "meal"}-${index}`} className="pf-a2-kpi rounded-xl border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-black text-slate-100">{mealName}</h3>
                                    {mealTime ? (
                                      <span className="rounded-full border border-cyan-200/35 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
                                        {mealTime}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-100">
                                      P {formatCompactNumber(meal.totalProtein)} g
                                    </span>
                                    <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-100">
                                      C {formatCompactNumber(meal.totalCarbs)} g
                                    </span>
                                    <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-100">
                                      G {formatCompactNumber(meal.totalFat)} g
                                    </span>
                                  </div>
                                </div>

                                <span className="pf-a2-pill shrink-0">{formatCompactNumber(meal.totalKcal)} kcal</span>
                              </div>

                              {meal.imageUrl ? (
                                <div className="mt-2 overflow-hidden rounded-xl border border-white/15 bg-slate-900/55">
                                  <img
                                    src={meal.imageUrl}
                                    alt={meal.mealName || `Plato ${index + 1}`}
                                    className="h-36 w-full object-cover"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ) : null}

                              <div className="mt-3 space-y-2">
                                {meal.items.map((item, itemIndex) => {
                                  const gramsLabel =
                                    item.grams !== null && Number.isFinite(item.grams)
                                      ? `${formatCompactNumber(item.grams)} g`
                                      : null;
                                  const replacementKey = `${meal.mealId}::${item.id || itemIndex}`;
                                  const replacement = nutritionReplacementByItemKey[replacementKey] || null;

                                  return (
                                    <article
                                      key={`${meal.mealId}-${item.id || itemIndex}`}
                                      className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2.5"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="min-w-0 text-sm font-semibold text-slate-100">{item.label}</p>

                                        <div className="flex shrink-0 items-center gap-1.5">
                                          {gramsLabel ? (
                                            <span className="rounded-full border border-slate-400/35 bg-slate-800/70 px-2 py-0.5 text-[11px] font-semibold text-slate-100">
                                              {gramsLabel}
                                            </span>
                                          ) : null}

                                          <span className="rounded-full border border-rose-300/35 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-100">
                                            {formatCompactNumber(item.calories)} kcal
                                          </span>
                                        </div>
                                      </div>

                                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                                        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-100">
                                          P {formatCompactNumber(item.protein)} g
                                        </span>
                                        <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-100">
                                          C {formatCompactNumber(item.carbs)} g
                                        </span>
                                        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-100">
                                          G {formatCompactNumber(item.fat)} g
                                        </span>
                                      </div>

                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <ReliableActionButton
                                          type="button"
                                          onClick={() =>
                                            generateNutritionReplacementForPlanItem({
                                              mealId: meal.mealId,
                                              mealName,
                                              itemId: String(item.id || `${meal.mealId}-${itemIndex}`),
                                              label: item.label,
                                              foodId: item.foodId,
                                              grams: item.grams,
                                              calories: item.calories,
                                              protein: item.protein,
                                              carbs: item.carbs,
                                              fat: item.fat,
                                            })
                                          }
                                          className="pf-a4-nutrition-plan-action-btn pf-a4-nutrition-plan-action-btn-inline"
                                        >
                                          Reemplazo equivalente
                                        </ReliableActionButton>

                                        {replacement ? (
                                          <span className="pf-a4-nutrition-replacement-badge">Sugerencia activa</span>
                                        ) : null}
                                      </div>

                                      {replacement ? (
                                        <div className="pf-a4-nutrition-replacement-card mt-2">
                                          <p className="pf-a4-nutrition-replacement-title">
                                            Alternativa: {replacement.replacementLabel}
                                          </p>
                                          <p className="pf-a4-nutrition-replacement-meta">
                                            {formatCompactNumber(replacement.replacementGrams)} g · {formatCompactNumber(replacement.replacementCalories)} kcal
                                          </p>
                                          <div className="pf-a4-nutrition-replacement-macros">
                                            <span>P {formatCompactNumber(replacement.replacementProtein)} g</span>
                                            <span>C {formatCompactNumber(replacement.replacementCarbs)} g</span>
                                            <span>G {formatCompactNumber(replacement.replacementFat)} g</span>
                                          </div>
                                          <p className="pf-a4-nutrition-replacement-source">
                                            Original: {formatCompactNumber(replacement.sourceCalories)} kcal · {replacement.sourceItemLabel}
                                          </p>
                                        </div>
                                      ) : null}
                                    </article>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="pf-a2-drawer mt-4 rounded-xl border border-slate-500/45 bg-slate-900/40 p-4 text-sm text-slate-300">
                        Aún no tienes comidas cargadas en tu plan. Pide a tu profesor que te asigne una versión actualizada.
                      </div>
                    )}
                  </article>
                </div>
              ) : null}

              {nutritionPanelView === "registro" ? (
                <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                  <input
                    ref={nutritionBarcodeCaptureInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleNutritionBarcodeCaptureChange}
                  />
                  <input
                    ref={nutritionCalIaCaptureInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleNutritionCalIaCaptureChange}
                  />

                  {nutritionLiveCaptureMode !== "none" ? (
                    <div className="pf-a4-nutrition-camera-layer">
                      <div className="pf-a4-nutrition-camera-sheet">
                        <div className="pf-a4-nutrition-camera-head">
                          <div>
                            <p className="pf-a4-nutrition-camera-kicker">
                              {nutritionLiveCaptureMode === "barcode" ? "Escáner automático" : "Cámara CAL IA"}
                            </p>
                            <h4 className="pf-a4-nutrition-camera-title">
                              {nutritionLiveCaptureMode === "barcode"
                                ? "Apunta al código para cargarlo automáticamente"
                                : "Saca una foto y CAL IA estimará calorías"}
                            </h4>
                          </div>

                          <ReliableActionButton
                            type="button"
                            onClick={stopNutritionLiveCapture}
                            className="pf-a3-nutrition-student-food-delete"
                          >
                            Cerrar
                          </ReliableActionButton>
                        </div>

                        <div className="pf-a4-nutrition-camera-preview">
                          <video
                            ref={nutritionLiveVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="pf-a4-nutrition-camera-video"
                          />

                          {nutritionLiveCaptureMode === "barcode" ? (
                            <div className="pf-a4-nutrition-camera-scan-frame">
                              <span className="pf-a4-nutrition-camera-scan-line" />
                            </div>
                          ) : null}
                        </div>

                        <p className="pf-a4-nutrition-camera-status">
                          {nutritionLiveCaptureStatus ||
                            (nutritionLiveCaptureMode === "barcode"
                              ? "Buscando código..."
                              : "Encuadra el plato completo para una mejor estimación.")}
                        </p>

                        <div className="pf-a4-nutrition-camera-actions">
                          {nutritionLiveCaptureMode === "cal-ia" ? (
                            <ReliableActionButton
                              type="button"
                              onClick={captureNutritionCalIaFromLiveCamera}
                              disabled={!nutritionLiveCaptureReady || nutritionCalIaProcessing}
                              className="pf-a2-solid-btn rounded-lg px-3 py-1.5 text-xs font-semibold"
                            >
                              {nutritionCalIaProcessing ? "Procesando..." : "Sacar foto y estimar"}
                            </ReliableActionButton>
                          ) : null}

                          <ReliableActionButton
                            type="button"
                            onClick={() => {
                              if (nutritionLiveCaptureMode === "barcode") {
                                nutritionBarcodeCaptureInputRef.current?.click();
                                return;
                              }

                              nutritionCalIaCaptureInputRef.current?.click();
                            }}
                            className="pf-a2-ghost-btn rounded-lg border px-3 py-1.5 text-xs font-semibold"
                          >
                            {nutritionLiveCaptureMode === "barcode"
                              ? "Subir foto del código"
                              : "Subir foto del plato"}
                          </ReliableActionButton>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="pf-a4-nutrition-diary-head">
                    <div>
                      <p className="pf-a2-eyebrow">Registro del alumno</p>
                      <h2 className="mt-1 text-2xl font-black text-white">Hoy</h2>
                      <p className="mt-1 text-sm text-slate-300">{formatDate(normalizedNutritionTrackerDate)}</p>
                    </div>

                    <div className="pf-a3-nutrition-tracker-date">
                      <ReliableActionButton
                        type="button"
                        onClick={() => handleNutritionTrackerDateShift(-1)}
                        className="pf-a2-ghost-btn rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      >
                        Ayer
                      </ReliableActionButton>

                      <label className="pf-a3-nutrition-tracker-date-input">
                        <span>Fecha</span>
                        <input
                          type="date"
                          value={normalizedNutritionTrackerDate}
                          onChange={handleNutritionTrackerDateChange}
                        />
                      </label>

                      <ReliableActionButton
                        type="button"
                        onClick={() => handleNutritionTrackerDateShift(1)}
                        className="pf-a2-ghost-btn rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      >
                        Mañana
                      </ReliableActionButton>
                    </div>
                  </div>

                  <div className="pf-a4-nutrition-diary-section-head mt-4">
                    <h3 className="pf-a4-nutrition-diary-title">Resumen</h3>
                    <ReliableActionButton
                      type="button"
                      onClick={() => setNutritionShowTrackerDetails((previous) => !previous)}
                      className="pf-a4-nutrition-diary-link"
                    >
                      {nutritionShowTrackerDetails ? "Ocultar" : "Detalles"}
                    </ReliableActionButton>
                  </div>

                  <article className="pf-a4-nutrition-summary-card mt-2">
                    <div className="pf-a4-nutrition-summary-gauge">
                      <svg
                        className="pf-a4-nutrition-summary-gauge-svg"
                        viewBox="0 0 204 112"
                        role="img"
                        aria-label="Contador calorico diario"
                      >
                        <path
                          className="pf-a4-nutrition-summary-gauge-track"
                          d="M 18 96 A 84 84 0 0 1 186 96"
                        />
                        <path
                          className={`pf-a4-nutrition-summary-gauge-progress ${
                            nutritionDailyProgressRatio > 1.06
                              ? "is-over"
                              : nutritionDailyProgressRatio < 0.55
                                ? "is-low"
                                : "is-on-target"
                          }`}
                          d="M 18 96 A 84 84 0 0 1 186 96"
                          style={{
                            strokeDasharray: `${NUTRITION_KCAL_SEMI_GAUGE_ARC_LENGTH} ${NUTRITION_KCAL_SEMI_GAUGE_ARC_LENGTH}`,
                            strokeDashoffset: `${nutritionDailySemiGaugeDashOffset}`,
                          }}
                        />
                      </svg>

                      <div className="pf-a4-nutrition-summary-gauge-center">
                        <p className="pf-a4-nutrition-summary-gauge-kcal">{nutritionDailyConsumedKcal} kcal</p>
                        <p className="pf-a4-nutrition-summary-gauge-goal">de {nutritionDailyGoalKcal} kcal</p>
                        <p className="pf-a4-nutrition-summary-gauge-pct">{nutritionDailyProgressPct}%</p>
                      </div>
                    </div>

                    <div className="pf-a4-nutrition-summary-metrics">
                      <div className="pf-a4-nutrition-summary-metric">
                        <p className="pf-a4-nutrition-summary-metric-value">{nutritionDailyRemainingKcal}</p>
                        <p className="pf-a4-nutrition-summary-metric-label">Restantes</p>
                      </div>
                      <div className="pf-a4-nutrition-summary-metric is-highlight">
                        <p className="pf-a4-nutrition-summary-metric-value">{nutritionEstimatedBurnedKcal}</p>
                        <p className="pf-a4-nutrition-summary-metric-label">Quemadas</p>
                      </div>
                      <div className="pf-a4-nutrition-summary-metric">
                        <p className="pf-a4-nutrition-summary-metric-value">
                          {nutritionDailyDoneMeals}/{nutritionMealsDetailed.length || 0}
                        </p>
                        <p className="pf-a4-nutrition-summary-metric-label">Comidas</p>
                      </div>
                    </div>

                    <div className="pf-a4-nutrition-summary-macros">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Carbohidratos</span>
                          <span>
                            {nutritionDailyConsumedMacros.carbohidratos} / {nutritionDailyGoalMacros.carbohidratos} g
                          </span>
                        </div>
                        <div className="pf-a2-progress-track mt-1 h-2 overflow-hidden rounded-full bg-slate-700/70">
                          <div
                            className="pf-a2-progress-fill h-full rounded-full"
                            style={{ width: `${Math.max(4, nutritionDailyMacroProgress.carbohidratos)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Proteínas</span>
                          <span>
                            {nutritionDailyConsumedMacros.proteinas} / {nutritionDailyGoalMacros.proteinas} g
                          </span>
                        </div>
                        <div className="pf-a2-progress-track mt-1 h-2 overflow-hidden rounded-full bg-slate-700/70">
                          <div
                            className="pf-a2-progress-fill h-full rounded-full"
                            style={{ width: `${Math.max(4, nutritionDailyMacroProgress.proteinas)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Grasas</span>
                          <span>
                            {nutritionDailyConsumedMacros.grasas} / {nutritionDailyGoalMacros.grasas} g
                          </span>
                        </div>
                        <div className="pf-a2-progress-track mt-1 h-2 overflow-hidden rounded-full bg-slate-700/70">
                          <div
                            className="pf-a2-progress-fill h-full rounded-full"
                            style={{ width: `${Math.max(4, nutritionDailyMacroProgress.grasas)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </article>

                  <div className="pf-a4-nutrition-diary-section-head mt-4">
                    <h3 className="pf-a4-nutrition-diary-title">Alimentación</h3>
                    <ReliableActionButton
                      type="button"
                      onClick={() =>
                        openNutritionMealComposer(
                          nutritionDiaryMealRows[0]?.mealId || DEFAULT_NUTRITION_MEAL_DISTRIBUTION[0].mealId
                        )
                      }
                      className="pf-a4-nutrition-diary-link"
                    >
                      Más
                    </ReliableActionButton>
                  </div>

                  <div className="pf-a4-nutrition-meal-list mt-2">
                    {nutritionDiaryMealRows.map((meal) => (
                      <article
                        key={`meal-row-${meal.mealId}`}
                        className="pf-a4-nutrition-meal-row is-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => openNutritionMealComposer(meal.mealId)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openNutritionMealComposer(meal.mealId);
                          }
                        }}
                      >
                        <div className="pf-a4-nutrition-meal-icon">{meal.icon}</div>

                        <div className="min-w-0">
                          <p className="pf-a4-nutrition-meal-name">{meal.mealName}</p>
                          <p className="pf-a4-nutrition-meal-kcal">
                            {meal.consumedKcal} / {meal.goalKcal} kcal
                          </p>
                          <p className="pf-a4-nutrition-meal-preview">
                            {meal.previewText || "Toca + para registrar alimentos."}
                          </p>
                        </div>

                        <ReliableActionButton
                          type="button"
                          onClick={() => openNutritionMealComposer(meal.mealId)}
                          className="pf-a4-nutrition-meal-plus"
                          aria-label={`Agregar alimento en ${meal.mealName}`}
                        >
                          +
                        </ReliableActionButton>
                      </article>
                    ))}
                  </div>

                  {nutritionActiveMealComposer ? (
                    <div className="pf-a4-nutrition-meal-screen-layer">
                      <article className="pf-a4-nutrition-composer pf-a4-nutrition-composer-screen">
                        <div className="pf-a4-nutrition-composer-head">
                          <div>
                            <p className="pf-a4-nutrition-composer-kicker">Pantalla de comida</p>
                            <h3 className="pf-a4-nutrition-composer-title">{nutritionActiveMealComposer.mealName}</h3>
                          </div>

                          <ReliableActionButton
                            type="button"
                            onClick={closeNutritionMealComposer}
                            className="pf-a3-nutrition-student-food-delete"
                          >
                            Volver
                          </ReliableActionButton>
                        </div>

                        <div className="pf-a4-nutrition-composer-grid">
                          <label className="pf-a3-nutrition-student-food-field">
                            <span>Buscar alimentos</span>
                            <input
                              value={nutritionFoodSearchQuery}
                              onChange={(event) => setNutritionFoodSearchQuery(event.target.value)}
                              placeholder="Ej: yogur, arroz, barrita, galletitas..."
                            />
                          </label>

                          <label className="pf-a3-nutrition-student-food-field">
                            <span>Gramaje</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={nutritionFoodGramsDraft}
                              onChange={(event) => setNutritionFoodGramsDraft(event.target.value)}
                              placeholder="100"
                            />
                          </label>
                        </div>

                        <div className="pf-a4-nutrition-composer-actions mt-2">
                          <ReliableActionButton
                            type="button"
                            onClick={triggerNutritionBarcodeCapture}
                            className="pf-a3-nutrition-template-chip"
                          >
                            Escáner automático
                          </ReliableActionButton>
                          <ReliableActionButton
                            type="button"
                            onClick={triggerNutritionCalIaCapture}
                            className="pf-a3-nutrition-template-chip"
                          >
                            Cámara CAL IA
                          </ReliableActionButton>
                        </div>

                        {nutritionCalIaEstimate ? (
                          <article className="pf-a4-nutrition-cal-ia-card mt-3">
                            <div className="pf-a4-nutrition-cal-ia-preview">
                              <img src={nutritionCalIaEstimate.previewUrl} alt="Estimación CAL IA" loading="lazy" />
                            </div>
                            <div>
                              <p className="pf-a4-nutrition-cal-ia-title">{nutritionCalIaEstimate.entry.nombre}</p>
                              <p className="pf-a4-nutrition-cal-ia-meta">
                                {nutritionCalIaEstimate.entry.gramos || 0} g · {nutritionCalIaEstimate.entry.calorias} kcal · {nutritionCalIaEstimate.entry.proteinas || 0}P / {nutritionCalIaEstimate.entry.carbohidratos || 0}C / {nutritionCalIaEstimate.entry.grasas || 0}G
                              </p>
                              <ReliableActionButton
                                type="button"
                                onClick={confirmNutritionCalIaEstimate}
                                className="pf-a2-solid-btn mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
                                disabled={nutritionCalIaProcessing}
                              >
                                {nutritionCalIaProcessing ? "Procesando..." : "Agregar estimación"}
                              </ReliableActionButton>
                            </div>
                          </article>
                        ) : null}

                        {nutritionFavoriteFoods.length > 0 ? (
                          <div className="pf-a4-nutrition-favorites-row mt-3">
                            {nutritionFavoriteFoods.slice(0, 8).map((favorite) => (
                              <ReliableActionButton
                                key={`nutrition-favorite-${favorite.id}`}
                                type="button"
                                onClick={() =>
                                  addNutritionFoodFromSearch(
                                    {
                                      id: favorite.id,
                                      nombre: favorite.nombre,
                                      kcalPer100g: favorite.kcalPer100g,
                                      proteinPer100g: favorite.proteinPer100g,
                                      carbsPer100g: favorite.carbsPer100g,
                                      fatPer100g: favorite.fatPer100g,
                                      imageUrl: favorite.imageUrl,
                                      barcode: favorite.barcode,
                                      sourceLabel: "Favorito",
                                    },
                                    "search"
                                  )
                                }
                                className="pf-a4-nutrition-favorite-chip"
                              >
                                ★ {favorite.nombre}
                              </ReliableActionButton>
                            ))}
                          </div>
                        ) : null}

                        <div className="pf-a4-nutrition-search-results mt-3">
                          {nutritionFoodSearchLoading ? (
                            <p className="pf-a4-nutrition-search-empty">Buscando alimentos...</p>
                          ) : nutritionCombinedSearchResults.length === 0 ? (
                            <p className="pf-a4-nutrition-search-empty">
                              No hay resultados para este filtro. Prueba otro término o usa el escáner.
                            </p>
                          ) : (
                            nutritionCombinedSearchResults.map((food) => {
                              const isFavorite = nutritionFavoriteFoodIds.has(food.id);

                              return (
                                <article key={`search-food-${food.id}`} className="pf-a4-nutrition-search-row">
                                  {food.imageUrl ? (
                                    <div className="pf-a4-nutrition-search-thumb">
                                      <img src={food.imageUrl} alt={food.nombre} loading="lazy" referrerPolicy="no-referrer" />
                                    </div>
                                  ) : (
                                    <div className="pf-a4-nutrition-search-thumb pf-a4-nutrition-search-thumb-empty">FOOD</div>
                                  )}

                                  <div className="min-w-0">
                                    <p className="pf-a4-nutrition-search-name">{food.nombre}</p>
                                    <p className="pf-a4-nutrition-search-meta">
                                      {food.kcalPer100g} kcal/100g · {food.proteinPer100g}P · {food.carbsPer100g}C · {food.fatPer100g}G
                                    </p>
                                    <p className="pf-a4-nutrition-search-source">{food.sourceLabel || "Catálogo"}</p>
                                  </div>

                                  <div className="pf-a4-nutrition-search-actions">
                                    <ReliableActionButton
                                      type="button"
                                      onClick={() => toggleNutritionFavoriteFood(food)}
                                      className={`pf-a4-nutrition-favorite-toggle ${isFavorite ? "is-active" : ""}`}
                                      aria-label={isFavorite ? `Quitar favorito ${food.nombre}` : `Guardar favorito ${food.nombre}`}
                                    >
                                      ★
                                    </ReliableActionButton>

                                    <ReliableActionButton
                                      type="button"
                                      onClick={() =>
                                        addNutritionFoodFromSearch(
                                          food,
                                          food.sourceLabel?.toLowerCase().includes("barcode") ? "barcode" : "search"
                                        )
                                      }
                                      className="pf-a4-nutrition-search-add"
                                    >
                                      Agregar
                                    </ReliableActionButton>
                                  </div>
                                </article>
                              );
                            })
                          )}
                        </div>

                        {nutritionActiveMealComposer.mealEntries.length > 0 ? (
                          <div className="pf-a4-nutrition-meal-entry-list mt-3">
                            {nutritionActiveMealComposer.mealEntries.map((entry) => (
                              <article key={`meal-entry-${entry.id}`} className="pf-a4-nutrition-meal-entry-row">
                                <div>
                                  <p className="pf-a4-nutrition-meal-entry-name">{entry.nombre}</p>
                                  <p className="pf-a4-nutrition-meal-entry-meta">
                                    {entry.porcion ? `${entry.porcion} · ` : ""}
                                    {entry.calorias} kcal · {entry.proteinas || 0}P / {entry.carbohidratos || 0}C / {entry.grasas || 0}G
                                  </p>
                                </div>
                                <ReliableActionButton
                                  type="button"
                                  onClick={() => removeNutritionCustomFood(entry.id)}
                                  className="pf-a3-nutrition-student-food-delete"
                                >
                                  Eliminar
                                </ReliableActionButton>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    </div>
                  ) : null}

                  {nutritionShowTrackerDetails ? (
                    <section className="mt-4 space-y-3">
                      <div className="pf-a3-nutrition-template-row">
                        <span className="pf-a3-nutrition-template-label">Plantillas del día</span>
                        <ReliableActionButton
                          type="button"
                          onClick={() => applyNutritionDayTemplate("full")}
                          className="pf-a3-nutrition-template-chip"
                        >
                          Día completo
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={() => applyNutritionDayTemplate("training")}
                          className="pf-a3-nutrition-template-chip"
                        >
                          Día de entreno
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={() => applyNutritionDayTemplate("rest")}
                          className="pf-a3-nutrition-template-chip"
                        >
                          Día de descanso
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={() => applyNutritionDayTemplate("clear")}
                          className="pf-a3-nutrition-template-chip is-muted"
                        >
                          Reiniciar día
                        </ReliableActionButton>
                      </div>

                      <div className="pf-a3-nutrition-week-head">
                        <ReliableActionButton
                          type="button"
                          onClick={() => handleNutritionTrackerWeekShift(-1)}
                          className="pf-a2-ghost-btn rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        >
                          Semana anterior
                        </ReliableActionButton>

                        <p className="pf-a3-nutrition-week-label">
                          Semana {formatDate(nutritionWeekStartDate)} - {formatDate(nutritionWeekEndDate)}
                        </p>

                        <ReliableActionButton
                          type="button"
                          onClick={() => handleNutritionTrackerWeekShift(1)}
                          className="pf-a2-ghost-btn rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        >
                          Semana siguiente
                        </ReliableActionButton>
                      </div>

                      <div className="pf-a3-nutrition-streak-grid">
                        <div className="pf-a3-nutrition-streak-card">
                          <p className="pf-a3-nutrition-streak-title">Racha actual</p>
                          <p className="pf-a3-nutrition-streak-value">{nutritionStreakStats.current} días</p>
                          <p className="pf-a3-nutrition-streak-note">
                            Último check: {nutritionStreakStats.lastDate ? formatDate(nutritionStreakStats.lastDate) : "-"}
                          </p>
                        </div>
                        <div className="pf-a3-nutrition-streak-card">
                          <p className="pf-a3-nutrition-streak-title">Mejor racha</p>
                          <p className="pf-a3-nutrition-streak-value">{nutritionStreakStats.best} días</p>
                          <p className="pf-a3-nutrition-streak-note">Histórico de adherencia</p>
                        </div>
                        <div className="pf-a3-nutrition-streak-card">
                          <p className="pf-a3-nutrition-streak-title">Días activos</p>
                          <p className="pf-a3-nutrition-streak-value">{nutritionWeeklyCompletedDays}/7</p>
                          <p className="pf-a3-nutrition-streak-note">Dentro de esta semana</p>
                        </div>
                        <div className="pf-a3-nutrition-streak-card">
                          <p className="pf-a3-nutrition-streak-title">Adherencia semanal</p>
                          <p className="pf-a3-nutrition-streak-value">{nutritionWeeklyAdherencePct}%</p>
                          <p className="pf-a3-nutrition-streak-note">Promedio {nutritionWeeklyAverageKcal} kcal</p>
                        </div>
                      </div>

                      <div className="pf-a3-nutrition-week-grid-wrap">
                        <p className="pf-a3-nutrition-week-grid-title">Calendario nutricional semanal</p>
                        <div className="pf-a3-nutrition-week-grid">
                          {nutritionWeeklyHistory.map((day) => (
                            <ReliableActionButton
                              key={`nutri-week-${day.date}`}
                              type="button"
                              onClick={() => handleNutritionTrackerDateSelect(day.date)}
                              className={`pf-a3-nutrition-weekday-card ${
                                day.isSelected ? "is-selected" : ""
                              } ${
                                day.status === "empty"
                                  ? "is-empty"
                                  : day.status === "low"
                                    ? "is-low"
                                    : day.status === "high"
                                      ? "is-high"
                                      : "is-on-target"
                              }`}
                            >
                              <span className="pf-a3-nutrition-weekday-name">{day.dayLabel}</span>
                              <strong className="pf-a3-nutrition-weekday-day">{day.dayNumber}</strong>
                              <span className="pf-a3-nutrition-weekday-meta">{day.totalEntries} registros</span>
                              <span className="pf-a3-nutrition-weekday-meta">{day.consumedKcal} kcal</span>
                            </ReliableActionButton>
                          ))}
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {nutritionTrackerStatus ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-200">
                      {nutritionTrackerStatus}
                    </p>
                  ) : null}

                  {nutritionCustomFoodStatus ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-200">
                      {nutritionCustomFoodStatus}
                    </p>
                  ) : null}

                  {nutritionFoodSearchStatus ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-200">
                      {nutritionFoodSearchStatus}
                    </p>
                  ) : null}

                  {nutritionBarcodeStatus ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-200">
                      {nutritionBarcodeStatus}
                    </p>
                  ) : null}

                  {nutritionCalIaStatus ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-200">
                      {nutritionCalIaStatus}
                    </p>
                  ) : null}
                </article>
              ) : null}
            </div>
          ) : null}

          {activeCategory === "progreso" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                  <p className="pf-a2-eyebrow">Ultima medicion</p>
                  <h2 className="mt-1 text-xl font-black text-white">Antropometria</h2>

                  {latestAnthropometry ? (
                    <>
                      <p className="mt-2 text-xs text-slate-400">
                        Registro del {formatDateTime(latestAnthropometry.createdAt)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="pf-a2-kpi rounded-xl border p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Peso</p>
                          <p className="mt-1 text-lg font-black text-white">
                            {toNumber(latestAnthropometry.pesoKg) ?? "-"}
                            {toNumber(latestAnthropometry.pesoKg) !== null ? " kg" : ""}
                          </p>
                        </div>
                        <div className="pf-a2-kpi rounded-xl border p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Agua</p>
                          <p className="mt-1 text-lg font-black text-white">
                            {toNumber(latestAnthropometry.aguaLitros) ?? "-"}
                            {toNumber(latestAnthropometry.aguaLitros) !== null ? " L" : ""}
                          </p>
                        </div>
                        <div className="pf-a2-kpi rounded-xl border p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Sueno</p>
                          <p className="mt-1 text-lg font-black text-white">
                            {toNumber(latestAnthropometry.suenoHoras) ?? "-"}
                            {toNumber(latestAnthropometry.suenoHoras) !== null ? " h" : ""}
                          </p>
                        </div>
                        <div className="pf-a2-kpi rounded-xl border p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Actividad</p>
                          <p className="mt-1 text-lg font-black text-white">
                            {toNumber(latestAnthropometry.actividadNivel) ?? "-"}
                            {toNumber(latestAnthropometry.actividadNivel) !== null ? "/10" : ""}
                          </p>
                        </div>
                      </div>

                      <div className="pf-a2-drawer mt-4 rounded-xl border border-slate-500/45 bg-slate-900/40 p-3 text-sm text-slate-200">
                        {weightDelta === null
                          ? "Aun no hay suficientes registros para calcular variacion de peso."
                          : `Variacion de peso vs registro anterior: ${weightDelta >= 0 ? "+" : ""}${weightDelta} kg.`}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-300">No hay registros antropometricos todavia.</p>
                  )}
                </article>

                <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                  <p className="pf-a2-eyebrow">Consistencia semanal</p>
                  <h2 className="mt-1 text-xl font-black text-white">Ritmo de entreno</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    En los ultimos 7 dias registraste {weeklyLogs.length} entradas de entrenamiento.
                  </p>

                  <div className="pf-a2-progress-track mt-3 h-2 overflow-hidden rounded-full bg-slate-700/70">
                    <div
                      className="pf-a2-progress-fill h-full rounded-full"
                      style={{ width: `${Math.max(5, consistencyScore)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                    Score {consistencyScore}/100
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="pf-a2-kpi rounded-xl border p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Registros totales</p>
                      <p className="mt-1 text-lg font-black text-white">{workoutLogs.length}</p>
                    </div>
                    <div className="pf-a2-kpi rounded-xl border p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Check-ins</p>
                      <p className="mt-1 text-lg font-black text-white">{anthropometryEntries.length}</p>
                    </div>
                  </div>
                </article>
              </div>

              <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                <p className="pf-a2-eyebrow">Ultimos registros</p>
                <h2 className="mt-1 text-xl font-black text-white">Historial de entreno</h2>

                {workoutLogs.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-300">Todavia no hay cargas registradas.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {workoutLogs.slice(0, 8).map((log, index) => (
                      <div
                        key={log.id || `${log.sessionTitle || "log"}-${index}`}
                        className="pf-a2-drawer rounded-xl border border-slate-600/45 bg-slate-900/45 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100">
                            {log.sessionTitle || "Sesion"}
                          </p>
                          <p className="text-xs text-slate-400">{formatDateTime(log.createdAt || log.fecha)}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-300">
                          {log.exerciseName || "Ejercicio"}
                          {log.series ? ` · ${log.series} series` : ""}
                          {log.repeticiones ? ` · ${log.repeticiones} reps` : ""}
                          {toNumber(log.pesoKg) !== null ? ` · ${log.pesoKg} kg` : ""}
                        </p>
                        {log.blockTitle ? (
                          <p className="mt-1 text-xs text-slate-400">Bloque: {log.blockTitle}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>
          ) : null}

          {activeCategory === "cuenta" ? (
            <div className="space-y-4">
              <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                <p className="pf-a2-eyebrow">Mi cuenta</p>
                <h2 className="mt-1 text-xl font-black text-white">{accountPanelData?.nombreCompleto || "Cuenta"}</h2>
                <p className="mt-2 text-sm text-slate-300">
                  {accountPanelData?.email || "Cargando..."}
                </p>
                {accountPanelData?.role ? (
                  <p className="mt-1 text-xs text-slate-400">Rol: {accountPanelData.role}</p>
                ) : null}
                {accountPanelData && accountPanelData.emailVerified === false ? (
                  <p className="mt-1 text-xs text-amber-300">Email no verificado.</p>
                ) : null}
              </article>

              {accountPanelError ? (
                <article className="rounded-[1rem] border border-rose-300/60 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">
                  {accountPanelError}
                </article>
              ) : null}

              {accountPanelMessage ? (
                <article className="rounded-[1rem] border border-emerald-300/60 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-200">
                  {accountPanelMessage}
                </article>
              ) : null}

              <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                <p className="pf-a2-eyebrow">Datos personales</p>
                <h3 className="mt-1 text-lg font-black text-white">Editar cuenta</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Para cambiar email o contraseña te pedimos la contraseña actual.
                </p>

                <form onSubmit={saveAccountPanel} className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                    Nombre completo
                    <input
                      type="text"
                      value={accountPanelNombre}
                      onChange={(event) => setAccountPanelNombre(event.target.value)}
                      placeholder="Nombre y apellido"
                      className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100"
                      required
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                      Edad
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={accountPanelEdad}
                        onChange={(event) => setAccountPanelEdad(event.target.value)}
                        className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                      Altura (cm)
                      <input
                        type="number"
                        min={0}
                        max={250}
                        step={0.1}
                        value={accountPanelAltura}
                        onChange={(event) => setAccountPanelAltura(event.target.value)}
                        className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100"
                      />
                    </label>
                  </div>

                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                    Teléfono
                    <input
                      type="tel"
                      value={accountPanelTelefono}
                      onChange={(event) => setAccountPanelTelefono(event.target.value)}
                      placeholder="+54 ..."
                      className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100"
                    />
                  </label>

                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                    Dirección
                    <input
                      type="text"
                      value={accountPanelDireccion}
                      onChange={(event) => setAccountPanelDireccion(event.target.value)}
                      placeholder="Calle y número"
                      className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100"
                    />
                  </label>

                  <div className="mt-2 border-t border-white/10 pt-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Credenciales</p>
                  </div>

                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                    Email
                    <input
                      type="email"
                      value={accountPanelEmail}
                      onChange={(event) => setAccountPanelEmail(event.target.value)}
                      placeholder="tuemail@dominio.com"
                      className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100"
                    />
                  </label>

                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                    Contraseña actual
                    <input
                      type="password"
                      value={accountPanelCurrentPassword}
                      onChange={(event) => setAccountPanelCurrentPassword(event.target.value)}
                      placeholder="Obligatoria para cambiar email o contraseña"
                      className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100"
                    />
                  </label>

                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                    Nueva contraseña
                    <input
                      type="password"
                      value={accountPanelNewPassword}
                      onChange={(event) => setAccountPanelNewPassword(event.target.value)}
                      placeholder="Opcional"
                      className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100"
                    />
                  </label>

                  <ReliableActionButton
                    type="submit"
                    disabled={accountPanelSaving || accountPanelLoading}
                    className="mt-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-70"
                  >
                    {accountPanelSaving ? "Guardando..." : "Guardar cambios"}
                  </ReliableActionButton>
                </form>
              </article>

              <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                <p className="pf-a2-eyebrow">Foto de perfil</p>
                <h3 className="mt-1 text-lg font-black text-white">Imagen de cuenta</h3>
                <p className="mt-2 text-xs text-slate-300">
                  Elegí una imagen desde tu dispositivo. Se sincroniza con tu ficha en admin.
                </p>

                <div className="mt-3 flex items-center gap-3">
                  {accountPanelSidebarImageDraft ? (
                    <img
                      src={accountPanelSidebarImageDraft}
                      alt="Foto de perfil"
                      className="h-16 w-16 rounded-full border border-cyan-300/40 object-cover"
                    />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-full border border-slate-600/60 bg-slate-900/60 text-xs font-bold text-slate-400">
                      Sin foto
                    </div>
                  )}
                  <div className="flex flex-1 flex-wrap gap-2">
                    <ReliableActionButton
                      type="button"
                      onClick={() => accountPanelFileInputRef.current?.click()}
                      className="rounded-lg border border-cyan-300/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-100"
                    >
                      Seleccionar imagen
                    </ReliableActionButton>
                    {accountPanelSidebarImageDraft ? (
                      <ReliableActionButton
                        type="button"
                        onClick={handleAccountPanelPhotoRemove}
                        className="rounded-lg border border-rose-300/60 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-100"
                      >
                        Quitar
                      </ReliableActionButton>
                    ) : null}
                  </div>
                </div>

                <input
                  ref={accountPanelFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAccountPanelPhotoChange}
                />

                {accountPanelSidebarImageDraft !== accountPanelSidebarImage ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ReliableActionButton
                      type="button"
                      onClick={handleAccountPanelPhotoSave}
                      disabled={accountPanelPhotoSaving}
                      className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-70"
                    >
                      {accountPanelPhotoSaving ? "Guardando..." : "Guardar foto"}
                    </ReliableActionButton>
                    <ReliableActionButton
                      type="button"
                      onClick={handleAccountPanelPhotoRevert}
                      disabled={accountPanelPhotoSaving}
                      className="rounded-lg border border-slate-500/60 bg-slate-800/60 px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-70"
                    >
                      Cancelar
                    </ReliableActionButton>
                  </div>
                ) : null}

                {accountPanelPhotoError ? (
                  <p className="mt-2 text-xs font-bold text-rose-300">{accountPanelPhotoError}</p>
                ) : null}
              </article>

              <article className="rounded-[1.2rem] border border-rose-300/40 bg-rose-500/10 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-200">Sesión</p>
                <h3 className="mt-1 text-lg font-black text-rose-100">Cerrar sesión</h3>
                <p className="mt-1 text-xs text-rose-100/80">
                  Si terminaste de usar la app, cerrá tu sesión desde acá.
                </p>
                <ReliableActionButton
                  type="button"
                  onClick={handleSignOutPanel}
                  disabled={accountPanelSigningOut}
                  className="mt-3 w-full rounded-xl border border-rose-200/60 bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-100 disabled:opacity-70"
                >
                  {accountPanelSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </ReliableActionButton>
              </article>
            </div>
          ) : null}

          {activeCategory === "musica" ? (
            <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="pf-a2-eyebrow">Playlists asignadas</p>
                  <h2 className="mt-1 text-xl font-black text-white">Musica para entrenar</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    {musicCoachLine}
                  </p>
                  <p className={`mt-1 text-xs ${musicSyncLoaded ? "text-emerald-300" : "text-slate-400"}`}>
                    {musicSyncLoaded
                      ? "Sincronizado con los cambios del profesor/admin."
                      : "Sincronizando playlists..."}
                  </p>
                </div>

                <ReliableActionButton
                  type="button"
                  onClick={loadStorageState}
                  className="pf-a2-ghost-btn rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  Actualizar
                </ReliableActionButton>
              </div>

              {selectedMusicAssignment ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-500/35 bg-slate-950/55 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Vista previa</p>
                      <h3 className="mt-1 break-words text-lg font-black text-white">
                        {selectedMusicDisplayName}
                      </h3>
                      <p className="mt-1 text-xs text-slate-300">
                        Objetivo: {selectedMusicAssignment.objetivo || "General"}
                        {selectedMusicAssignment.diaSemana ? ` · ${selectedMusicAssignment.diaSemana}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="pf-a2-pill">{resolveMusicPlatformLabel(selectedMusicPlatform)}</span>
                      <span className="pf-a2-pill">{resolveMusicContentTypeLabel(selectedMusicContentType)}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[190px,minmax(0,1fr)]">
                    <div className="relative h-44 overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 lg:h-full">
                      {selectedMusicCoverUrl ? (
                        <img
                          src={selectedMusicCoverUrl}
                          alt={selectedMusicDisplayName || "Portada de playlist"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-slate-700/45 to-slate-900/75 p-3 text-left">
                          <span className="inline-flex w-max rounded-full border border-white/20 bg-black/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/90">
                            {resolveMusicPlatformLabel(selectedMusicPlatform)}
                          </span>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                              {resolveMusicContentTypeLabel(selectedMusicContentType)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs font-semibold text-white/90">{selectedMusicDisplayName}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/35 p-2">
                      {selectedMusicPlayer.kind === "audio" ? (
                        <audio
                          controls
                          preload="none"
                          className="h-12 w-full"
                          src={selectedMusicPlayer.src || undefined}
                        />
                      ) : selectedMusicPlayer.kind === "iframe" && selectedMusicPlayer.src ? (
                        <iframe
                          title={`music-player-featured-${resolveMusicAssignmentId(selectedMusicAssignment, 0)}`}
                          src={selectedMusicPlayer.src}
                          className={`w-full rounded-lg border border-white/10 ${
                            selectedMusicPlatform === "SPOTIFY" ? "h-[380px] sm:h-[420px]" : "h-64 sm:h-72"
                          }`}
                          loading="lazy"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        />
                      ) : (
                        <div className="flex h-28 items-center justify-center rounded-lg border border-slate-500/35 bg-slate-900/55 px-4 text-center text-xs text-slate-300">
                          Esta plataforma no permite vista previa embebida. Usa &quot;Abrir playlist&quot; para escucharla.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ReliableActionButton
                      type="button"
                      onClick={() => openMusicPlaylistExternal(selectedMusicAssignment)}
                      className="pf-a2-solid-btn inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      {resolveMusicOpenActionLabel(selectedMusicPlatform)}
                    </ReliableActionButton>
                  </div>
                </div>
              ) : null}

              {musicAssignments.length === 0 ? (
                <div className="pf-a2-drawer mt-4 rounded-xl border border-slate-500/45 bg-slate-900/40 p-4 text-sm text-slate-300">
                  No hay playlists asignadas por ahora.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {musicAssignments.map((assignment, index) => {
                    const assignmentId = resolveMusicAssignmentId(assignment, index);
                    const platform = resolveMusicPlatform(assignment.platform, assignment.playlistUrl);
                    const normalizedPlaylistUrl = normalizeMusicUrl(String(assignment.playlistUrl || ""));
                    const coverUrl =
                      uniqueStrings([
                        assignment.coverUrl,
                        assignment.imageUrl,
                        assignment.thumbnailUrl,
                        assignment.artworkUrl,
                        normalizedPlaylistUrl ? musicArtworkByUrl[normalizedPlaylistUrl] : "",
                      ])[0] || null;
                    const isSelected = selectedMusicAssignmentId === assignmentId;
                    const openLabel = resolveMusicOpenActionLabel(platform);

                    return (
                      <section
                        key={assignmentId}
                        className={`rounded-xl border p-3 ${
                          isSelected
                            ? "border-emerald-400/50 bg-emerald-500/10"
                            : "pf-a2-kpi"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-slate-900/60">
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt={assignment.playlistName || "Portada"}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                Sin cover
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="break-words text-sm font-black text-slate-100">
                                {assignment.playlistName || "Playlist"}
                              </h3>
                              <span className="pf-a2-pill">{resolveMusicPlatformLabel(platform)}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-300">
                              Objetivo: {assignment.objetivo || "General"}
                              {assignment.diaSemana ? ` · ${assignment.diaSemana}` : ""}
                            </p>
                            {assignment.recommendedSongTitle ? (
                              <p className="mt-1 text-xs text-slate-400">
                                Recomendado: {assignment.recommendedSongTitle}
                                {assignment.recommendedSongArtist
                                  ? ` - ${assignment.recommendedSongArtist}`
                                  : ""}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-slate-500">
                              Asignado: {formatDateTime(assignment.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <ReliableActionButton
                            type="button"
                            onClick={() => selectMusicAssignment(assignment, index)}
                            className="pf-a2-solid-btn inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold"
                          >
                            {isSelected ? "Seleccionada" : "Usar esta"}
                          </ReliableActionButton>

                          {assignment.playlistUrl ? (
                            <ReliableActionButton
                              type="button"
                              onClick={() => openMusicPlaylistExternal(assignment)}
                              className="pf-a2-ghost-btn inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold"
                            >
                              {openLabel}
                            </ReliableActionButton>
                          ) : null}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </article>
          ) : null}
        </section>
      </div>

      {isRootCategory ? (
        <nav className="pf-a2-dock md:hidden" aria-label="Navegacion principal del alumno">
          {homeDockItems.map((item) => {
            const isActive = item.key === activeCategory;
            return (
              <ReliableActionButton
                key={`dock-${item.key}`}
                type="button"
                onClick={() => goToCategory(item.key)}
                className={`pf-a2-dock-btn ${isActive ? "pf-a2-dock-btn-active" : ""}`}
                aria-label={`Abrir ${item.label}`}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
              >
                <span className="pf-a2-dock-hit" aria-hidden="true">
                  <span className="pf-a2-dock-icon-wrap">{item.icon}</span>
                  <span className="pf-a2-dock-label">{item.label}</span>
                </span>
                <span className="sr-only">{item.label}</span>
              </ReliableActionButton>
            );
          })}
        </nav>
      ) : null}
    </main>
  );
}

