"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useAlumnos } from "@/components/AlumnosProvider";
import { useEjercicios } from "@/components/EjerciciosProvider";
import { useSessions } from "@/components/SessionsProvider";
import { useSharedState } from "@/components/useSharedState";
import { argentineFoodsBase } from "@/data/argentineFoods";
import type {
  BloqueEntrenamiento,
  Ejercicio,
  PrescripcionSesionPersona,
  Sesion,
} from "@/data/mockData";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AlumnoVisionClientProps = {
  currentName: string;
  currentEmail: string;
  initialCategory?: MainCategory;
};

type MainCategory = "inicio" | "rutina" | "nutricion" | "progreso" | "musica";
type QuickMetricIcon = "agua" | "sueno" | "peso" | "actividad";
type TrainingView = "descripcion" | "registros";
type NutritionView = "plan" | "recetas";
type ProgressView = "semanal-rutina" | "antropometria";
type TrainingFocus =
  | "piernas"
  | "tren-superior"
  | "core"
  | "movilidad"
  | "cardio"
  | "potencia"
  | "descanso"
  | "full-body";

type ClienteMetaLite = {
  email?: string;
  telefono?: string;
  objNutricional?: string;
  startDate?: string;
  endDate?: string;
  pagoEstado?: string;
};

type AccountSnapshot = {
  email?: string | null;
  nombreCompleto?: string | null;
  edad?: number | null;
  fechaNacimiento?: string | Date | null;
  altura?: number | string | null;
  telefono?: string | null;
  direccion?: string | null;
  sidebarImage?: string | null;
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

type MusicAssignment = {
  id: string;
  platform: MusicPlatform;
  alumnoNombre: string;
  playlistName: string;
  playlistUrl: string;
  objetivo?: string;
  diaSemana?: string;
  recommendedSongTitle?: string;
  recommendedSongArtist?: string;
  createdAt: string;
};

type WeekDayPlan = {
  id?: string;
  dia?: string;
  planificacion?: string;
  objetivo?: string;
  sesionId?: string;
};

type WeekPlan = {
  id?: string;
  nombre?: string;
  objetivo?: string;
  dias?: WeekDayPlan[];
};

type WeekPersonPlan = {
  ownerKey?: string;
  tipo?: "jugadoras" | "alumnos";
  nombre?: string;
  semanas?: WeekPlan[];
};

type WeekStore = {
  version?: number;
  planes?: WeekPersonPlan[];
};

type NormalizedWeekDayPlan = {
  id: string;
  dia: string;
  planificacion: string;
  objetivo: string;
  sesionId: string;
};

type NormalizedWeekPlan = {
  id: string;
  nombre: string;
  objetivo: string;
  dias: NormalizedWeekDayPlan[];
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

type RoutineEntry = {
  sesion: Sesion;
  prescripcion: PrescripcionSesionPersona | null;
  bloques: BloqueEntrenamiento[];
  totalBloques: number;
  totalEjercicios: number;
};

type HydratedRoutineExercise = BloqueEntrenamiento["ejercicios"][number] & {
  detail: Ejercicio | null;
};

type HydratedRoutineBlock = Omit<BloqueEntrenamiento, "ejercicios"> & {
  ejercicios: HydratedRoutineExercise[];
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

type SessionFeedbackRecord = {
  id: string;
  alumnoNombre: string;
  sessionId: string;
  sessionTitle: string;
  createdAt: string;
  trainedAt: string;
  effort: number;
  fatigue: number;
  mood: string;
  goalResult: string;
  comment: string;
};

type AnthropometryEntry = {
  id: string;
  alumnoNombre: string;
  createdAt: string;
  pesoKg: number | null;
  aguaLitros: number | null;
  suenoHoras: number | null;
  actividadNivel: number | null;
  cinturaCm: number | null;
  caderaCm: number | null;
  grasaPct: number | null;
  musculoPct: number | null;
  notas?: string;
};

type ClientInteractionType =
  | "cambio-rutina"
  | "ajuste-nutricion"
  | "pregunta-profesor";

type ClientInteractionRequest = {
  id: string;
  alumnoNombre: string;
  alumnoEmail: string;
  telefono?: string;
  type: ClientInteractionType;
  title: string;
  detail: string;
  status: "pendiente" | "atendida";
  createdAt: string;
  sourceCategory: MainCategory;
};

type ProfesorContacto = {
  id: string;
  nombre: string;
  role: string;
  telefono: string;
  waPhone: string;
  source: "asignado" | "colaborador" | "admin";
};

type SessionQuestionId =
  | "trainedAt"
  | "effort"
  | "fatigue"
  | "mood"
  | "goalResult"
  | "comment";

type SessionAnswers = {
  trainedAt: string;
  effort: number | null;
  fatigue: number | null;
  mood: string;
  goalResult: string;
  comment: string;
};

type SessionQuestion = {
  id: SessionQuestionId;
  title: string;
  helper: string;
  kind: "datetime" | "scale" | "choice" | "text";
  options?: string[];
};

type EmbeddedPlayer = {
  kind: "iframe" | "audio" | "none";
  src: string | null;
};

const ALUMNO_CATEGORIES: MainCategory[] = ["inicio", "rutina", "nutricion", "progreso", "musica"];

function normalizeAlumnoCategory(value: string): MainCategory | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (ALUMNO_CATEGORIES.includes(normalized as MainCategory)) {
    return normalized as MainCategory;
  }
  return null;
}

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const MUSIC_PLAYLISTS_KEY = "pf-control-music-playlists-v1";
const WEEK_PLAN_KEY = "pf-control-semana-plan";
const NUTRITION_PLANS_KEY = "pf-control-nutricion-planes-v1";
const NUTRITION_ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
const NUTRITION_CUSTOM_FOODS_KEY = "pf-control-nutricion-alimentos-v1";
const WORKOUT_LOGS_KEY = "pf-control-alumno-workout-logs-v1";
const SESSION_FEEDBACK_KEY = "pf-control-alumno-session-feedback-v1";
const ANTHROPOMETRY_KEY = "pf-control-alumno-antropometria-v1";
const CLIENT_INTERACTIONS_KEY = "pf-control-alumno-interacciones-v1";
const ALUMNO_SHARED_POLL_MS = 30000;

const SESSION_MOOD_OPTIONS = [
  "Motivado",
  "Satisfecho",
  "Normal",
  "Cansado",
  "Frustrado",
  "Desmotivado",
  "Dolorido",
];

const SESSION_GOAL_OPTIONS = ["Cumplido", "Parcialmente", "No cumplido"];

const ROUTINE_INTERACTION_COPY: Record<
  ClientInteractionType,
  {
    title: string;
    prompt: string;
    defaultDetail: string;
    success: string;
  }
> = {
  "cambio-rutina": {
    title: "Solicitar cambio de rutina",
    prompt: "Explica por que quieres ajustar tu rutina.",
    defaultDetail: "Necesito ajustar la rutina por disponibilidad, sensaciones de carga o molestias.",
    success: "Solicitud de cambio de rutina enviada.",
  },
  "ajuste-nutricion": {
    title: "Solicitar ajuste de plan nutricional",
    prompt: "Describe que ajuste nutricional necesitas.",
    defaultDetail: "Quiero revisar porciones, horarios o alimentos del plan nutricional.",
    success: "Solicitud de ajuste nutricional enviada.",
  },
  "pregunta-profesor": {
    title: "Hacer una pregunta al profesor",
    prompt: "Escribe tu pregunta para el profesor.",
    defaultDetail: "Tengo una consulta sobre tecnica, progresion o recuperacion.",
    success: "Pregunta enviada al profesor.",
  },
};

const WEEK_DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];

const FALLBACK_WEEK_OBJECTIVES = [
  "Adaptacion tecnica y control de carga",
  "Aumento progresivo del volumen",
  "Consolidacion de intensidad y estabilidad",
  "Ajuste final con foco en calidad de movimiento",
];

const HOME_DAILY_QUOTES = [
  "La constancia de hoy construye tu mejor version de manana.",
  "No entrenas por obligacion, entrenas por evolucion.",
  "Cada repeticion bien hecha cuenta para tu objetivo.",
  "Disciplina primero, resultados despues.",
  "PF Control: foco, proceso y progreso real.",
  "Tu mejor sesion siempre puede ser la de hoy.",
  "Pequenos avances sostenidos ganan a cualquier atajo.",
  "Entrenar inteligente tambien es entrenar fuerte.",
];

const TODAY_WEEKDAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
];

const SESSION_QUESTIONS: SessionQuestion[] = [
  {
    id: "trainedAt",
    title: "Cuando entrenaste?",
    helper: "Indica la fecha y hora de entrenamiento que quieres registrar.",
    kind: "datetime",
  },
  {
    id: "effort",
    title: "Que tan exigente fue el entrenamiento?",
    helper: "Marca un numero del 1 al 10. 1 es muy facil y 10 es esfuerzo maximo.",
    kind: "scale",
  },
  {
    id: "fatigue",
    title: "Que tan cansado terminaste?",
    helper: "Marca un numero del 1 al 10. 1 es sin cansancio y 10 agotado.",
    kind: "scale",
  },
  {
    id: "mood",
    title: "Como te sentiste al terminar?",
    helper: "Elige la opcion que mejor describa tu estado general.",
    kind: "choice",
    options: SESSION_MOOD_OPTIONS,
  },
  {
    id: "goalResult",
    title: "Sientes que cumpliste el objetivo de hoy?",
    helper: "Pensa en la sesion y selecciona la opcion que mejor te represente.",
    kind: "choice",
    options: SESSION_GOAL_OPTIONS,
  },
  {
    id: "comment",
    title: "Quieres dejar algun comentario sobre la sesion?",
    helper: "Puedes escribir como te sentiste, que salio bien o mal.",
    kind: "text",
  },
];

const DIRECT_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"];

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

  return shared.length >= 2 || shared.some((token) => token.length >= 5);
}

function resolveGreetingLabel(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Buenos dias";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function resolvePhraseOfDay(date = new Date()): string {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const dayNumber = Math.floor((date.getTime() - yearStart.getTime()) / 86400000);
  return HOME_DAILY_QUOTES[Math.abs(dayNumber) % HOME_DAILY_QUOTES.length];
}

function resolveTrainingFocusFromText(raw: string): TrainingFocus | null {
  const text = normalizePersonKey(raw);
  if (!text) return null;

  if (/descanso|off|libre|recuperacion/.test(text)) return "descanso";
  if (/pierna|cuadricep|isquio|glute|sentadilla|zancada/.test(text)) return "piernas";
  if (/pecho|espalda|hombro|bicep|tricep|empuje|traccion|tren superior/.test(text)) {
    return "tren-superior";
  }
  if (/core|abdomen|oblicuo|plancha|plank/.test(text)) return "core";
  if (/movilidad|flexibilidad|estiramiento/.test(text)) return "movilidad";
  if (/cardio|resistencia|aerobico|hiit|metabolico/.test(text)) return "cardio";
  if (/potencia|salto|pliometria|sprint|aceleracion|velocidad/.test(text)) return "potencia";

  return null;
}

function resolveTrainingFocusFromExercises(exerciseNames: string[]): TrainingFocus {
  const combined = normalizePersonKey(exerciseNames.join(" "));
  const focus = resolveTrainingFocusFromText(combined);
  if (focus) return focus;
  return "full-body";
}

function buildTrainingReminderLine(focus: TrainingFocus): string {
  switch (focus) {
    case "piernas":
      return "Hoy toca piernas";
    case "tren-superior":
      return "Hoy toca tren superior";
    case "core":
      return "Hoy toca core y estabilidad";
    case "movilidad":
      return "Hoy toca movilidad y control";
    case "cardio":
      return "Hoy toca cardio y resistencia";
    case "potencia":
      return "Hoy toca potencia y velocidad";
    case "descanso":
      return "Hoy toca recuperacion";
    default:
      return "Hoy toca sesion completa";
  }
}

function countMembershipDays(startDate: string | undefined, endDate: string | undefined): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() < start.getTime()) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function isPassActive(meta: ClienteMetaLite | null | undefined, now = new Date()): boolean {
  if (!meta) return false;

  const paymentState = String(meta.pagoEstado || "").trim().toLowerCase();
  if (paymentState && paymentState !== "confirmado") {
    return false;
  }

  if (!meta.endDate) {
    return paymentState === "confirmado";
  }

  const endDate = new Date(`${String(meta.endDate).slice(0, 10)}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) {
    return false;
  }

  return endDate.getTime() >= now.getTime();
}

function normalizeEmail(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function inferNameFromEmail(value: string | null | undefined): string {
  const normalized = normalizeEmail(value);
  if (!normalized || !normalized.includes("@")) {
    return "";
  }

  const localPart = normalized.split("@")[0] || "";
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameFromClientKey(value: string): string {
  const raw = String(value || "");
  const parts = raw.split(":");
  return String(parts[1] || parts[0] || "").trim();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, ".").replace(/[^0-9.\-]/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNullableNumber(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed === null ? null : parsed;
}

function ageFromDate(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getTimeAgoLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "fecha invalida";

  const diff = Date.now() - parsed.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) {
    return `hace ${Math.max(1, minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `hace ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  return `hace ${days} dias`;
}

function toLocalDateInputValue(date = new Date()): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function getLocalDateKey(date = new Date()): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

function emptySessionAnswers(): SessionAnswers {
  return {
    trainedAt: toLocalDateInputValue(),
    effort: null,
    fatigue: null,
    mood: "",
    goalResult: "",
    comment: "",
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

function getPlatformLabel(platform: MusicPlatform): string {
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

function normalizeUrl(rawUrl: string): string {
  const value = rawUrl.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function looksLikeAudioFile(url: string): boolean {
  const lower = String(url || "").toLowerCase();
  return DIRECT_AUDIO_EXTENSIONS.some((ext) => lower.includes(ext));
}

function inferPlatformFromUrl(rawUrl: string): MusicPlatform {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return "OTHER";

  try {
    const parsed = new URL(normalized);
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
  } catch {
    return looksLikeAudioFile(normalized) ? "AUDIO_FILE" : "OTHER";
  }
}

function resolveSpotifyEmbed(rawUrl: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(rawUrl));
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
    const parsed = new URL(normalizeUrl(rawUrl));
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

function resolveVimeoEmbed(rawUrl: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(rawUrl));
    if (!parsed.hostname.toLowerCase().includes("vimeo.com")) return null;
    const id = parsed.pathname.split("/").filter(Boolean).pop() || "";
    return id ? `https://player.vimeo.com/video/${id}` : null;
  } catch {
    return null;
  }
}

function resolveSoundCloudEmbed(rawUrl: string): string | null {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return null;
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(normalized)}&color=%238a2be2&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false`;
}

function resolveAppleMusicEmbed(rawUrl: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(rawUrl));
    if (!parsed.hostname.toLowerCase().includes("music.apple.com")) return null;
    return `https://embed.music.apple.com${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function resolveDeezerEmbed(rawUrl: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(rawUrl));
    const segments = parsed.pathname.split("/").filter(Boolean);
    const foundTypeIndex = segments.findIndex((segment) =>
      ["track", "album", "playlist"].includes(segment.toLowerCase())
    );

    if (foundTypeIndex === -1) return null;
    const type = segments[foundTypeIndex].toLowerCase();
    const id = segments[foundTypeIndex + 1] || "";
    if (!id) return null;

    return `https://widget.deezer.com/widget/dark/${type}/${id}`;
  } catch {
    return null;
  }
}

function resolveEmbeddedPlayerSource(platform: MusicPlatform, rawUrl: string): EmbeddedPlayer {
  const normalized = normalizeUrl(rawUrl);
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
    case "AMAZON_MUSIC":
      return { kind: "none", src: null };
    case "OTHER":
      return looksLikeAudioFile(normalized)
        ? { kind: "audio", src: normalized }
        : { kind: "none", src: null };
    default:
      return { kind: "none", src: null };
  }
}

function resolveExerciseVideoEmbed(rawUrl: string): string | null {
  const youtube = resolveYouTubeEmbed(rawUrl);
  if (youtube) return youtube;

  const vimeo = resolveVimeoEmbed(rawUrl);
  if (vimeo) return vimeo;

  return null;
}

function resolveExercisePreviewImage(rawUrl: string): string | null {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return null;

  const youtubeEmbed = resolveYouTubeEmbed(normalized);
  if (youtubeEmbed) {
    const id = youtubeEmbed.split("/embed/")[1]?.split(/[?&#]/)[0] || "";
    if (id) {
      return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  }

  if (/\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(normalized)) {
    return normalized;
  }

  return null;
}

function normalizeMusicAssignments(rawValue: unknown): MusicAssignment[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const normalizedRows: MusicAssignment[] = [];

  for (const row of rawValue) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const item = row as Record<string, unknown>;
    const playlistUrl = normalizeUrl(String(item.playlistUrl || item.url || item.link || ""));
    if (!playlistUrl) continue;

    const rawPlatform = String(item.platform || "").trim().toUpperCase();
    const allowed = [
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

    const platform = allowed.includes(rawPlatform)
      ? (rawPlatform as MusicPlatform)
      : inferPlatformFromUrl(playlistUrl);

    normalizedRows.push({
      id: String(item.id || createId("music")),
      platform,
      alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim(),
      playlistName:
        String(item.playlistName || item.nombre || item.title || "").trim() ||
        getPlatformLabel(platform),
      playlistUrl,
      objetivo: String(item.objetivo || "").trim() || undefined,
      diaSemana: String(item.diaSemana || "").trim() || undefined,
      recommendedSongTitle: String(item.recommendedSongTitle || "").trim() || undefined,
      recommendedSongArtist: String(item.recommendedSongArtist || "").trim() || undefined,
      createdAt: String(item.createdAt || new Date().toISOString()),
    });
  }

  return normalizedRows;
}

function normalizeNutritionPlans(rawValue: unknown): NutritionPlan[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const normalizedRows: NutritionPlan[] = [];

  for (const row of rawValue) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;

    const targetsRow = (item.targets || {}) as Record<string, unknown>;
    const comidasRaw = Array.isArray(item.comidas) ? item.comidas : [];

    normalizedRows.push({
      id: String(item.id || createId("nut")),
      nombre: String(item.nombre || "Plan nutricional").trim() || "Plan nutricional",
      alumnoAsignado: String(item.alumnoAsignado || "").trim() || null,
      objetivo: (["mantenimiento", "recomposicion", "masa", "deficit"] as const).includes(
        String(item.objetivo || "").trim() as NutritionGoal
      )
        ? (String(item.objetivo || "").trim() as NutritionGoal)
        : "mantenimiento",
      notas: String(item.notas || "").trim(),
      targets: {
        calorias: Math.max(0, Number(toNumber(targetsRow.calorias) || 0)),
        proteinas: Math.max(0, Number(toNumber(targetsRow.proteinas) || 0)),
        carbohidratos: Math.max(0, Number(toNumber(targetsRow.carbohidratos) || 0)),
        grasas: Math.max(0, Number(toNumber(targetsRow.grasas) || 0)),
      },
      comidas: comidasRaw
        .filter((meal) => meal && typeof meal === "object")
        .map((meal, mealIndex) => {
          const mealRow = meal as Record<string, unknown>;
          const itemsRaw = Array.isArray(mealRow.items) ? mealRow.items : [];

          return {
            id: String(mealRow.id || createId(`meal-${mealIndex}`)),
            nombre: String(mealRow.nombre || `Comida ${mealIndex + 1}`).trim() || `Comida ${mealIndex + 1}`,
            items: itemsRaw
              .filter((foodItem) => foodItem && typeof foodItem === "object")
              .map((foodItem, itemIndex) => {
                const foodRow = foodItem as Record<string, unknown>;
                return {
                  id: String(foodRow.id || createId(`food-${itemIndex}`)),
                  foodId: String(foodRow.foodId || "").trim(),
                  gramos: Math.max(0, Number(toNumber(foodRow.gramos) || 0)),
                };
              }),
          };
        }),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    });
  }

  return normalizedRows;
}

function normalizeNutritionAssignments(rawValue: unknown): AlumnoNutritionAssignment[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim(),
        planId: String(item.planId || "").trim(),
        assignedAt: String(item.assignedAt || new Date().toISOString()),
      };
    })
    .filter((item) => item.alumnoNombre && item.planId);
}

function normalizeNutritionFoods(rawValue: unknown): NutritionFood[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id || createId("food")),
        nombre: String(item.nombre || "Alimento").trim() || "Alimento",
        kcalPer100g: Number(toNumber(item.kcalPer100g) || 0),
        proteinPer100g: Number(toNumber(item.proteinPer100g) || 0),
        carbsPer100g: Number(toNumber(item.carbsPer100g) || 0),
        fatPer100g: Number(toNumber(item.fatPer100g) || 0),
      };
    });
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
        id: String(item.id || createId("workout")),
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
        series: Math.max(1, Math.round(Number(toNumber(item.series) || 1))),
        repeticiones: Math.max(0, Math.round(Number(toNumber(item.repeticiones) || 0))),
        pesoKg: Math.max(0, Number(toNumber(item.pesoKg ?? item.peso) || 0)),
        molestia: Boolean(item.molestia),
        videoUrl: String(item.videoUrl || "").trim() || undefined,
        comentarios: String(item.comentarios || item.comentario || "").trim() || undefined,
        createdAt: String(item.createdAt || new Date().toISOString()),
      };
    })
    .filter((item) => item.alumnoNombre && item.sessionId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function normalizeSessionFeedback(rawValue: unknown): SessionFeedbackRecord[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id || createId("feedback")),
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim(),
        sessionId: String(item.sessionId || "").trim(),
        sessionTitle: String(item.sessionTitle || "Sesion").trim() || "Sesion",
        createdAt: String(item.createdAt || new Date().toISOString()),
        trainedAt: String(item.trainedAt || item.fecha || "").trim(),
        effort: Math.max(1, Math.min(10, Math.round(Number(toNumber(item.effort) || 1)))),
        fatigue: Math.max(1, Math.min(10, Math.round(Number(toNumber(item.fatigue) || 1)))),
        mood: String(item.mood || "").trim(),
        goalResult: String(item.goalResult || "").trim(),
        comment: String(item.comment || "").trim(),
      };
    })
    .filter((item) => item.alumnoNombre && item.sessionId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function normalizeAnthropometry(rawValue: unknown): AnthropometryEntry[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id || createId("anthro")),
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim(),
        createdAt: String(item.createdAt || new Date().toISOString()),
        pesoKg: toNullableNumber(item.pesoKg ?? item.peso),
        aguaLitros: toNullableNumber(item.aguaLitros ?? item.agua),
        suenoHoras: toNullableNumber(item.suenoHoras ?? item.sueno),
        actividadNivel: toNullableNumber(item.actividadNivel ?? item.actividad),
        cinturaCm: toNullableNumber(item.cinturaCm ?? item.cintura),
        caderaCm: toNullableNumber(item.caderaCm ?? item.cadera),
        grasaPct: toNullableNumber(item.grasaPct ?? item.grasa),
        musculoPct: toNullableNumber(item.musculoPct ?? item.musculo),
        notas: String(item.notas || "").trim() || undefined,
      };
    })
    .filter((item) => item.alumnoNombre)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function normalizeClientInteractionRequests(rawValue: unknown): ClientInteractionRequest[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const allowedTypes: ClientInteractionType[] = [
    "cambio-rutina",
    "ajuste-nutricion",
    "pregunta-profesor",
  ];
  const allowedCategories: MainCategory[] = ["inicio", "rutina", "nutricion", "progreso", "musica"];

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      const rawType = String(item.type || "").trim() as ClientInteractionType;
      const type = allowedTypes.includes(rawType) ? rawType : "pregunta-profesor";

      const rawStatus = String(item.status || "").trim().toLowerCase();
      const rawCategory = String(item.sourceCategory || "").trim() as MainCategory;
      const status: ClientInteractionRequest["status"] =
        rawStatus === "atendida" ? "atendida" : "pendiente";

      return {
        id: String(item.id || createId("interaction")),
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim(),
        alumnoEmail: String(item.alumnoEmail || item.email || "").trim(),
        telefono: String(item.telefono || "").trim() || undefined,
        type,
        title:
          String(item.title || ROUTINE_INTERACTION_COPY[type].title).trim() ||
          ROUTINE_INTERACTION_COPY[type].title,
        detail: String(item.detail || item.mensaje || "").trim(),
        status,
        createdAt: String(item.createdAt || new Date().toISOString()),
        sourceCategory: allowedCategories.includes(rawCategory) ? rawCategory : "rutina",
      };
    })
    .filter((item) => item.alumnoNombre && item.detail)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function formatWeight(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)} kg`;
}

function resolveExerciseById(map: Map<string, Ejercicio>, exerciseId: string): Ejercicio | null {
  if (!exerciseId) return null;

  if (map.has(exerciseId)) {
    return map.get(exerciseId) || null;
  }

  const numeric = Number(exerciseId);
  if (Number.isFinite(numeric) && map.has(String(numeric))) {
    return map.get(String(numeric)) || null;
  }

  return null;
}

function hydrateRoutineBlocks(
  blocks: BloqueEntrenamiento[] | undefined,
  exerciseById: Map<string, Ejercicio>
): HydratedRoutineBlock[] {
  return (blocks || []).map((bloque) => ({
    ...bloque,
    ejercicios: (bloque.ejercicios || []).map((item) => ({
      ...item,
      detail: resolveExerciseById(exerciseById, String(item.ejercicioId)),
    })),
  }));
}

function resolveRoutineEntryForDay(
  day: NormalizedWeekDayPlan | null | undefined,
  routineBySessionId: Map<string, RoutineEntry>,
  routineEntries: RoutineEntry[]
): RoutineEntry | null {
  if (!day) {
    return null;
  }

  const daySessionId = String(day.sesionId || "").trim();
  if (daySessionId && routineBySessionId.has(daySessionId)) {
    return routineBySessionId.get(daySessionId) || null;
  }

  const dayPlanning = String(day.planificacion || "").trim();
  if (dayPlanning) {
    const byTitle = routineEntries.find((entry) =>
      namesLikelyMatch(entry.sesion.titulo, dayPlanning)
    );
    if (byTitle) {
      return byTitle;
    }
  }

  return null;
}

function buildExerciseUiKey(blockId: string, exerciseId: string, index: number): string {
  return `${String(blockId || "bloque")}:${String(exerciseId || "ejercicio")}:${index}`;
}

function createFourWeekFallbackPlan(routineEntries: RoutineEntry[]): NormalizedWeekPlan[] {
  if (routineEntries.length === 0) {
    return [];
  }

  return Array.from({ length: 4 }, (_, weekIndex) => {
    const weekNumber = weekIndex + 1;
    return {
      id: `fallback-week-${weekNumber}`,
      nombre: `Semana ${weekNumber}`,
      objetivo:
        FALLBACK_WEEK_OBJECTIVES[weekIndex] || "Plan de progresion semanal personalizado",
      dias: WEEK_DAY_NAMES.map((dayLabel, dayIndex) => {
        const sourceEntry = routineEntries[(weekIndex * WEEK_DAY_NAMES.length + dayIndex) % routineEntries.length];
        return {
          id: `fallback-week-${weekNumber}-day-${dayIndex + 1}`,
          dia: dayLabel,
          planificacion: sourceEntry?.sesion.titulo || `Sesion ${dayIndex + 1}`,
          objetivo: sourceEntry?.sesion.objetivo || "",
          sesionId: sourceEntry?.sesion.id || "",
        };
      }),
    };
  });
}

function computeRecentWeight(entries: AnthropometryEntry[], days: number): number | null {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = entries.find((entry) => {
    if (entry.pesoKg === null) return false;
    const created = new Date(entry.createdAt).getTime();
    return Number.isFinite(created) && created >= cutoff;
  });

  return recent?.pesoKg ?? null;
}

function computeBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  const value = weightKg / (meters * meters);
  return Number.isFinite(value) ? value : null;
}

function getCompletionCopy(effort: number, mood: string): string {
  if (effort >= 8 && /motivado|satisfecho/i.test(mood)) {
    return "Buen nivel de esfuerzo. Segui asi.";
  }

  if (effort <= 4) {
    return "Sesion suave registrada. Puedes pedir ajustes en tu plan si lo necesitas.";
  }

  return "Sesion finalizada y registrada correctamente.";
}

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "cyan" | "emerald" | "fuchsia";
}) {
  const palette: Record<string, string> = {
    slate: "border-white/15 bg-white/[0.03] text-white",
    cyan: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
    fuchsia: "border-fuchsia-300/35 bg-fuchsia-500/10 text-fuchsia-100",
  };

  return (
    <article className={`rounded-2xl border p-4 ${palette[tone] || palette.slate}`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </article>
  );
}

function MusicPlayer({ item }: { item: MusicAssignment }) {
  const player = resolveEmbeddedPlayerSource(item.platform, item.playlistUrl);

  if (player.kind === "audio" && player.src) {
    return <audio controls preload="none" className="mt-3 w-full" src={player.src} />;
  }

  if (player.kind === "iframe" && player.src) {
    return (
      <iframe
        title={`player-${item.id}`}
        src={player.src}
        className="mt-3 h-44 w-full rounded-xl border border-white/10"
        loading="eager"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      />
    );
  }

  return (
    <p className="mt-3 text-xs text-slate-400">
      Esta plataforma no permite reproductor embebido directo. Puedes abrir la playlist en la app externa.
    </p>
  );
}

export default function AlumnoVisionClient({
  currentName,
  currentEmail,
  initialCategory = "inicio",
}: AlumnoVisionClientProps) {
  const router = useRouter();
  const { alumnos } = useAlumnos();
  const { sesiones } = useSessions();
  const { ejercicios } = useEjercicios();

  const [mainCategory, setMainCategory] = useState<MainCategory>(initialCategory);
  // Precargamos TODAS las categorias desde el primer render para que cambiar de tab o
  // desplazarse entre pantallas encuentre el contenido ya montado, hidratado y pintado,
  // sin flashes ni recargas visuales.
  const [mountedCategories] = useState<Record<MainCategory, boolean>>(() => ({
    inicio: true,
    rutina: true,
    nutricion: true,
    progreso: true,
    musica: true,
  }));
  const [trainingView, setTrainingView] = useState<TrainingView>("descripcion");
  const [nutritionView, setNutritionView] = useState<NutritionView>("plan");
  const [progressView, setProgressView] = useState<ProgressView>("semanal-rutina");

  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");

  const [recordStatus, setRecordStatus] = useState("");
  const [anthroStatus, setAnthroStatus] = useState("");
  const [interactionStatus, setInteractionStatus] = useState("");
  const [showInteractionPanel, setShowInteractionPanel] = useState(false);
  const [isWeekSliding, setIsWeekSliding] = useState(false);
  const [weekSlideDirection, setWeekSlideDirection] = useState<1 | -1>(1);

  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionError, setQuestionError] = useState("");
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswers>(() => emptySessionAnswers());
  const [completionMessage, setCompletionMessage] = useState("");

  const [showAnthroForm, setShowAnthroForm] = useState(false);
  const [selectedExerciseKey, setSelectedExerciseKey] = useState("");
  const [exerciseDetailScreenOpen, setExerciseDetailScreenOpen] = useState(false);
  const [selectedExerciseSubView, setSelectedExerciseSubView] = useState<"nuevo-registro" | "registros">(
    "nuevo-registro"
  );
  const [selectedExerciseMeta, setSelectedExerciseMeta] = useState<{
    blockId: string;
    blockTitle: string;
    exerciseId: string;
    exerciseName: string;
  } | null>(null);

  const [recordForm, setRecordForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    series: "1",
    repeticiones: "",
    pesoKg: "",
    molestia: false,
    videoUrl: "",
    comentarios: "",
  });

  const [anthroForm, setAnthroForm] = useState({
    pesoKg: "",
    aguaLitros: "",
    suenoHoras: "",
    actividadNivel: "",
    cinturaCm: "",
    caderaCm: "",
    grasaPct: "",
    musculoPct: "",
    notas: "",
  });

  const [accountData, setAccountData] = useState<AccountSnapshot | null>(null);
  const [profesorContacto, setProfesorContacto] = useState<ProfesorContacto | null>(null);

  const [clientesMeta] = useSharedState<Record<string, ClienteMetaLite>>({}, {
    key: CLIENTE_META_KEY,
    legacyLocalStorageKey: CLIENTE_META_KEY,
    pollMs: ALUMNO_SHARED_POLL_MS,
  });

  const [musicRaw] = useSharedState<unknown[]>([], {
    key: MUSIC_PLAYLISTS_KEY,
    legacyLocalStorageKey: MUSIC_PLAYLISTS_KEY,
    pollMs: ALUMNO_SHARED_POLL_MS,
  });

  const [weekStoreRaw] = useSharedState<WeekStore>(
    {
      version: 3,
      planes: [],
    },
    {
      key: WEEK_PLAN_KEY,
      legacyLocalStorageKey: WEEK_PLAN_KEY,
      pollMs: ALUMNO_SHARED_POLL_MS,
    }
  );

  const [nutritionPlansRaw] = useSharedState<unknown[]>([], {
    key: NUTRITION_PLANS_KEY,
    legacyLocalStorageKey: NUTRITION_PLANS_KEY,
    pollMs: ALUMNO_SHARED_POLL_MS,
  });

  const [nutritionAssignmentsRaw] = useSharedState<unknown[]>([], {
    key: NUTRITION_ASSIGNMENTS_KEY,
    legacyLocalStorageKey: NUTRITION_ASSIGNMENTS_KEY,
    pollMs: ALUMNO_SHARED_POLL_MS,
  });

  const [nutritionCustomFoodsRaw] = useSharedState<unknown[]>([], {
    key: NUTRITION_CUSTOM_FOODS_KEY,
    legacyLocalStorageKey: NUTRITION_CUSTOM_FOODS_KEY,
    pollMs: ALUMNO_SHARED_POLL_MS,
  });

  const [workoutLogsRaw, setWorkoutLogsRaw] = useSharedState<unknown[]>([], {
    key: WORKOUT_LOGS_KEY,
    legacyLocalStorageKey: WORKOUT_LOGS_KEY,
    pollMs: ALUMNO_SHARED_POLL_MS,
  });

  const [feedbackRaw, setFeedbackRaw] = useSharedState<unknown[]>([], {
    key: SESSION_FEEDBACK_KEY,
    legacyLocalStorageKey: SESSION_FEEDBACK_KEY,
    pollMs: ALUMNO_SHARED_POLL_MS,
  });

  const [anthropometryRaw, setAnthropometryRaw] = useSharedState<unknown[]>([], {
    key: ANTHROPOMETRY_KEY,
    legacyLocalStorageKey: ANTHROPOMETRY_KEY,
    pollMs: ALUMNO_SHARED_POLL_MS,
  });

  const [interactionRaw, setInteractionRaw] = useSharedState<unknown[]>([], {
    key: CLIENT_INTERACTIONS_KEY,
    legacyLocalStorageKey: CLIENT_INTERACTIONS_KEY,
    pollMs: ALUMNO_SHARED_POLL_MS,
  });

  useEffect(() => {
    setMainCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromLocation = () => {
      const [, alumnosSegment, categorySegment] = window.location.pathname.split("/");
      if (alumnosSegment !== "alumnos") return;

      const nextCategory = normalizeAlumnoCategory(categorySegment || "");
      if (!nextCategory || nextCategory === mainCategory) return;

      setMainCategory(nextCategory);
    };

    window.addEventListener("popstate", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, [mainCategory]);

  useEffect(() => {
    let cancelled = false;

    const loadAccount = async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as AccountSnapshot;
        if (!cancelled) {
          setAccountData(data);
        }
      } catch {
        // Keep panel stable if account endpoint is temporarily unavailable.
      }
    };

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProfesorContacto = async () => {
      try {
        const response = await fetch("/api/alumnos/profesor-contacto", { cache: "no-store" });
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as { contacto?: ProfesorContacto };
        if (!cancelled && data?.contacto?.waPhone) {
          setProfesorContacto(data.contacto);
        }
      } catch {
        // Keep rutina panel usable even if contact lookup fails.
      }
    };

    void loadProfesorContacto();

    return () => {
      cancelled = true;
    };
  }, []);

  const nutritionPlans = useMemo(() => normalizeNutritionPlans(nutritionPlansRaw), [nutritionPlansRaw]);
  const nutritionAssignments = useMemo(
    () => normalizeNutritionAssignments(nutritionAssignmentsRaw),
    [nutritionAssignmentsRaw]
  );
  const nutritionCustomFoods = useMemo(
    () => normalizeNutritionFoods(nutritionCustomFoodsRaw),
    [nutritionCustomFoodsRaw]
  );
  const musicAssignmentsRaw = useMemo(() => normalizeMusicAssignments(musicRaw), [musicRaw]);
  const workoutLogs = useMemo(() => normalizeWorkoutLogs(workoutLogsRaw), [workoutLogsRaw]);
  const feedbackRecords = useMemo(() => normalizeSessionFeedback(feedbackRaw), [feedbackRaw]);
  const anthropometryEntries = useMemo(
    () => normalizeAnthropometry(anthropometryRaw),
    [anthropometryRaw]
  );
  const interactionRequests = useMemo(
    () => normalizeClientInteractionRequests(interactionRaw),
    [interactionRaw]
  );

  const normalizedSessionEmail = normalizeEmail(currentEmail);

  const alumnoMetaMatch = useMemo(() => {
    if (!normalizedSessionEmail) return null;

    for (const [clientKey, meta] of Object.entries(clientesMeta || {})) {
      if (!String(clientKey || "").startsWith("alumno:")) continue;
      if (normalizeEmail(meta?.email) === normalizedSessionEmail) {
        return {
          clientKey,
          meta: meta || {},
        };
      }
    }

    return null;
  }, [clientesMeta, normalizedSessionEmail]);

  const alumnoNameFromMeta = alumnoMetaMatch ? nameFromClientKey(alumnoMetaMatch.clientKey) : "";
  const alumnoNameFromSession = String(currentName || "").trim();
  const alumnoNameFromEmail = useMemo(() => inferNameFromEmail(currentEmail), [currentEmail]);

  const alumnoRecord = useMemo(() => {
    if (!Array.isArray(alumnos) || alumnos.length === 0) return null;

    if (alumnoNameFromMeta) {
      const exactMetaMatch = alumnos.find((alumno) =>
        namesLikelyMatch(alumno.nombre, alumnoNameFromMeta)
      );
      if (exactMetaMatch) return exactMetaMatch;
    }

    if (alumnoNameFromSession) {
      const bySessionName = alumnos.find((alumno) =>
        namesLikelyMatch(alumno.nombre, alumnoNameFromSession)
      );
      if (bySessionName) return bySessionName;
    }

    if (alumnoNameFromEmail) {
      const byEmailHint = alumnos.find((alumno) =>
        namesLikelyMatch(alumno.nombre, alumnoNameFromEmail)
      );
      if (byEmailHint) return byEmailHint;
    }

    return null;
  }, [alumnoNameFromEmail, alumnoNameFromMeta, alumnoNameFromSession, alumnos]);

  const alumnoName = useMemo(() => {
    if (alumnoRecord?.nombre) return alumnoRecord.nombre;
    if (alumnoNameFromMeta) return alumnoNameFromMeta;
    if (alumnoNameFromSession) return alumnoNameFromSession;
    if (alumnoNameFromEmail) return alumnoNameFromEmail;
    return "";
  }, [alumnoNameFromEmail, alumnoNameFromMeta, alumnoNameFromSession, alumnoRecord?.nombre]);

  const alumnoInteractionRequests = useMemo(() => {
    if (!alumnoName && !normalizedSessionEmail) return [];

    return interactionRequests.filter((item) => {
      const byName = alumnoName ? namesLikelyMatch(item.alumnoNombre, alumnoName) : false;
      const byEmail =
        normalizedSessionEmail && item.alumnoEmail
          ? normalizeEmail(item.alumnoEmail) === normalizedSessionEmail
          : false;

      return byName || byEmail;
    });
  }, [alumnoName, interactionRequests, normalizedSessionEmail]);

  const pendingInteractionCount = useMemo(
    () => alumnoInteractionRequests.filter((item) => item.status === "pendiente").length,
    [alumnoInteractionRequests]
  );

  const latestInteractionRequest = alumnoInteractionRequests[0] || null;

  const exerciseById = useMemo(
    () => new Map(ejercicios.map((item) => [String(item.id), item])),
    [ejercicios]
  );

  const routineEntries = useMemo<RoutineEntry[]>(() => {
    if (!alumnoName) return [];

    const rows: RoutineEntry[] = [];

    for (const sesion of sesiones || []) {
      const matchingPrescriptions = (sesion.prescripciones || [])
        .filter(
          (item) =>
            item.personaTipo === "alumnos" &&
            namesLikelyMatch(item.personaNombre || "", alumnoName)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );

      const latestPrescription = matchingPrescriptions[0] || null;

      const isDirectSession =
        sesion.asignacionTipo === "alumnos" &&
        (!sesion.alumnoAsignado || namesLikelyMatch(sesion.alumnoAsignado, alumnoName));

      if (!isDirectSession && !latestPrescription) {
        continue;
      }

      const effectiveBlocks = latestPrescription?.bloques || sesion.bloques || [];
      const totalBloques = effectiveBlocks.length;
      const totalEjercicios = effectiveBlocks.reduce(
        (total, bloque) => total + (bloque.ejercicios || []).length,
        0
      );

      rows.push({
        sesion,
        prescripcion: latestPrescription,
        bloques: effectiveBlocks,
        totalBloques,
        totalEjercicios,
      });
    }

    return rows.sort((a, b) => a.sesion.titulo.localeCompare(b.sesion.titulo));
  }, [alumnoName, sesiones]);

  const routineBySessionId = useMemo(
    () => new Map(routineEntries.map((entry) => [entry.sesion.id, entry])),
    [routineEntries]
  );

  const weekPlanForAlumno = useMemo(() => {
    const planes = Array.isArray(weekStoreRaw?.planes) ? weekStoreRaw.planes : [];
    const candidateNames = [alumnoName, alumnoNameFromMeta, alumnoNameFromSession, alumnoNameFromEmail]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const ownerKeys = candidateNames.map((value) => `alumnos:${value.toLowerCase()}`);

    const byOwnerKey = planes.find((plan) => {
      if (plan?.tipo !== "alumnos") return false;
      const planOwnerKey = String(plan?.ownerKey || "").trim().toLowerCase();
      if (!planOwnerKey) return false;
      return ownerKeys.includes(planOwnerKey);
    });

    const matchedPlan =
      byOwnerKey ||
      planes.find((plan) => {
        if (plan?.tipo !== "alumnos") return false;
        if (candidateNames.length === 0) return false;
        const planName = String(plan.nombre || "").trim();
        return candidateNames.some((candidate) => namesLikelyMatch(planName, candidate));
      });

    const normalizedWeeks: NormalizedWeekPlan[] = (Array.isArray(matchedPlan?.semanas)
      ? matchedPlan?.semanas
      : []
    ).map((semana, weekIndex) => {
      const weekId = String(semana?.id || `semana-${weekIndex + 1}`);
      const rawDays = Array.isArray(semana?.dias) ? semana?.dias : [];
      return {
        id: weekId,
        nombre: String(semana?.nombre || `Semana ${weekIndex + 1}`),
        objetivo: String(semana?.objetivo || "").trim(),
        dias: rawDays.map((dia, dayIndex) => ({
          id: String(dia?.id || `${weekId}-dia-${dayIndex + 1}`),
          dia: String(dia?.dia || `Dia ${dayIndex + 1}`),
          planificacion: String(dia?.planificacion || "").trim(),
          objetivo: String(dia?.objetivo || "").trim(),
          sesionId: String(dia?.sesionId || "").trim(),
        })),
      };
    });

    if (normalizedWeeks.length > 0) {
      const totalDias = normalizedWeeks.reduce((acc, week) => acc + week.dias.length, 0);
      return {
        nombre: matchedPlan?.nombre || alumnoName || "Plan semanal",
        semanas: normalizedWeeks,
        totalSemanas: normalizedWeeks.length,
        totalDias,
      };
    }

    return {
      nombre: "Sin plan",
      semanas: [],
      totalSemanas: 0,
      totalDias: 0,
    };
  }, [
    alumnoName,
    alumnoNameFromEmail,
    alumnoNameFromMeta,
    alumnoNameFromSession,
    weekStoreRaw?.planes,
  ]);

  useEffect(() => {
    if (weekPlanForAlumno.semanas.length === 0) {
      setSelectedWeekId("");
      setSelectedDayId("");
      return;
    }

    const hasSelected = weekPlanForAlumno.semanas.some((week) => week.id === selectedWeekId);
    if (!hasSelected) {
      setSelectedWeekId(weekPlanForAlumno.semanas[0].id);
    }
  }, [selectedWeekId, weekPlanForAlumno.semanas]);

  const selectedWeek = useMemo(
    () => weekPlanForAlumno.semanas.find((week) => week.id === selectedWeekId) || null,
    [selectedWeekId, weekPlanForAlumno.semanas]
  );

  const selectedWeekIndex = useMemo(
    () => weekPlanForAlumno.semanas.findIndex((week) => week.id === selectedWeekId),
    [selectedWeekId, weekPlanForAlumno.semanas]
  );

  const canGoPreviousWeek = selectedWeekIndex > 0;
  const canGoNextWeek =
    selectedWeekIndex >= 0 && selectedWeekIndex < weekPlanForAlumno.semanas.length - 1;

  const handleShiftWeek = (direction: -1 | 1) => {
    if (weekPlanForAlumno.semanas.length === 0) return;

    const currentIndex = selectedWeekIndex >= 0 ? selectedWeekIndex : 0;
    const nextIndex = Math.max(
      0,
      Math.min(weekPlanForAlumno.semanas.length - 1, currentIndex + direction)
    );

    const nextWeek = weekPlanForAlumno.semanas[nextIndex];
    if (!nextWeek || nextWeek.id === selectedWeekId) return;

    setWeekSlideDirection(direction);
    setIsWeekSliding(true);
    setSelectedWeekId(nextWeek.id);
    const keepDay = nextWeek.dias.find((day) => day.id === selectedDayId);
    setSelectedDayId(keepDay ? keepDay.id : nextWeek.dias[0]?.id || "");
  };

  useEffect(() => {
    if (!isWeekSliding) return;

    const timer = window.setTimeout(() => {
      setIsWeekSliding(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [isWeekSliding, selectedWeekId]);

  useEffect(() => {
    if (!selectedWeek || selectedWeek.dias.length === 0) {
      setSelectedDayId("");
      return;
    }

    const hasSelected = selectedWeek.dias.some((day) => day.id === selectedDayId);
    if (!hasSelected) {
      setSelectedDayId(selectedWeek.dias[0].id);
    }
  }, [selectedDayId, selectedWeek]);

  const selectedDay = useMemo(
    () => selectedWeek?.dias.find((day) => day.id === selectedDayId) || null,
    [selectedDayId, selectedWeek]
  );

  const selectedDayRoutineEntry = useMemo(
    () => resolveRoutineEntryForDay(selectedDay, routineBySessionId, routineEntries),
    [routineBySessionId, routineEntries, selectedDay]
  );

  const sessionIdFromDay = selectedDayRoutineEntry?.sesion.id || "";

  useEffect(() => {
    if (sessionIdFromDay && sessionIdFromDay !== selectedSessionId) {
      setSelectedSessionId(sessionIdFromDay);
    }
  }, [selectedSessionId, sessionIdFromDay]);

  const activeSessionExerciseDetails = useMemo(() => {
    if (selectedDayRoutineEntry) {
      return hydrateRoutineBlocks(selectedDayRoutineEntry.bloques, exerciseById);
    }

    return [];
  }, [exerciseById, selectedDayRoutineEntry]);

  useEffect(() => {
    setSelectedExerciseKey("");
    setExerciseDetailScreenOpen(false);
    setSelectedExerciseSubView("nuevo-registro");
    setSelectedExerciseMeta(null);
    setRecordStatus("");
  }, [selectedDayId, selectedSessionId, selectedWeekId]);

  const latestPrescriptionCount = useMemo(
    () => routineEntries.filter((entry) => Boolean(entry.prescripcion)).length,
    [routineEntries]
  );

  const selectedNutritionAssignment = useMemo(() => {
    if (!alumnoName) return null;

    const matches = nutritionAssignments.filter((assignment) =>
      namesLikelyMatch(assignment.alumnoNombre || "", alumnoName)
    );

    if (matches.length === 0) return null;

    return matches
      .slice()
      .sort(
        (a, b) =>
          new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()
      )[0];
  }, [alumnoName, nutritionAssignments]);

  const selectedNutritionPlan = useMemo(() => {
    if (!alumnoName) return null;

    if (selectedNutritionAssignment) {
      const assignedPlan =
        nutritionPlans.find((plan) => plan.id === selectedNutritionAssignment.planId) || null;
      if (assignedPlan) {
        return assignedPlan;
      }
    }

    return (
      nutritionPlans
        .filter((plan) => namesLikelyMatch(String(plan.alumnoAsignado || ""), alumnoName))
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        )[0] || null
    );
  }, [alumnoName, nutritionPlans, selectedNutritionAssignment]);

  const nutritionFoodsById = useMemo(() => {
    const mergedFoods: NutritionFood[] = [
      ...(argentineFoodsBase as NutritionFood[]),
      ...nutritionCustomFoods,
    ];

    return new Map(mergedFoods.map((food) => [String(food.id), food]));
  }, [nutritionCustomFoods]);

  const selectedNutritionIntake = useMemo(() => {
    if (!selectedNutritionPlan) {
      return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
    }

    const totals = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };

    for (const meal of selectedNutritionPlan.comidas || []) {
      for (const item of meal.items || []) {
        const food = nutritionFoodsById.get(String(item.foodId));
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

  const musicAssignments = useMemo(() => {
    return musicAssignmentsRaw
      .filter((item) => {
        if (!item.alumnoNombre) return true;
        if (!alumnoName) return false;
        return namesLikelyMatch(item.alumnoNombre, alumnoName);
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
  }, [alumnoName, musicAssignmentsRaw]);

  const alumnoWorkoutLogs = useMemo(() => {
    if (!alumnoName) return [];
    return workoutLogs.filter((item) => namesLikelyMatch(item.alumnoNombre, alumnoName));
  }, [alumnoName, workoutLogs]);

  const alumnoFeedbackHistory = useMemo(() => {
    if (!alumnoName) return [];
    return feedbackRecords.filter((item) => namesLikelyMatch(item.alumnoNombre, alumnoName));
  }, [alumnoName, feedbackRecords]);

  const weeklyRoutineProgress = useMemo(() => {
    return weekPlanForAlumno.semanas.map((week) => {
      const dayProgress = (week.dias || []).map((day) => {
        const hasLog = alumnoWorkoutLogs.some((log) => {
          if (log.weekId && log.dayId) {
            return log.weekId === week.id && log.dayId === day.id;
          }

          if (log.dayId) {
            return log.dayId === day.id;
          }

          if (day.sesionId && log.sessionId !== day.sesionId) {
            return false;
          }

          if (log.dayName) {
            return namesLikelyMatch(log.dayName, day.dia);
          }

          return Boolean(day.sesionId) && log.sessionId === day.sesionId;
        });

        return {
          ...day,
          hasLog,
        };
      });

      const totalDays = dayProgress.length;
      const completedDays = dayProgress.filter((day) => day.hasLog).length;
      const completionPct = totalDays === 0 ? 0 : Math.round((completedDays / totalDays) * 100);

      return {
        ...week,
        dayProgress,
        totalDays,
        completedDays,
        completionPct,
      };
    });
  }, [alumnoWorkoutLogs, weekPlanForAlumno.semanas]);

  const weeklyProgressTotals = useMemo(() => {
    const totalWeeks = weeklyRoutineProgress.length;
    const totalDays = weeklyRoutineProgress.reduce((acc, week) => acc + week.totalDays, 0);
    const completedDays = weeklyRoutineProgress.reduce((acc, week) => acc + week.completedDays, 0);
    const completionPct = totalDays === 0 ? 0 : Math.round((completedDays / totalDays) * 100);

    return {
      totalWeeks,
      totalDays,
      completedDays,
      completionPct,
      lastWorkoutAt: alumnoWorkoutLogs[0]?.createdAt || null,
      lastFeedbackAt: alumnoFeedbackHistory[0]?.createdAt || null,
    };
  }, [alumnoFeedbackHistory, alumnoWorkoutLogs, weeklyRoutineProgress]);

  const routineEntryForLogs = selectedDayRoutineEntry;

  const sessionWorkoutLogs = useMemo(() => {
    if (!routineEntryForLogs || !alumnoName) return [];

    return workoutLogs.filter(
      (item) => {
        if (!namesLikelyMatch(item.alumnoNombre, alumnoName)) return false;
        if (item.sessionId !== routineEntryForLogs.sesion.id) return false;
        if (selectedWeek?.id && item.weekId && item.weekId !== selectedWeek.id) return false;
        if (selectedDay?.id && item.dayId && item.dayId !== selectedDay.id) return false;
        return true;
      }
    );
  }, [alumnoName, routineEntryForLogs, selectedDay?.id, selectedWeek?.id, workoutLogs]);

  const selectedExerciseWorkoutLogs = useMemo(() => {
    if (!selectedExerciseMeta) return [];

    return sessionWorkoutLogs.filter((item) => {
      if (item.exerciseKey && selectedExerciseKey) {
        return item.exerciseKey === selectedExerciseKey;
      }

      if (item.exerciseId && selectedExerciseMeta.exerciseId) {
        return item.exerciseId === selectedExerciseMeta.exerciseId;
      }

      return (
        Boolean(item.exerciseName) &&
        namesLikelyMatch(String(item.exerciseName || ""), selectedExerciseMeta.exerciseName)
      );
    });
  }, [selectedExerciseKey, selectedExerciseMeta, sessionWorkoutLogs]);

  const selectedExercisePanelData = useMemo(() => {
    if (!selectedExerciseKey) return null;

    for (const block of activeSessionExerciseDetails) {
      for (let index = 0; index < (block.ejercicios || []).length; index += 1) {
        const item = block.ejercicios[index];
        const key = buildExerciseUiKey(String(block.id || "bloque"), String(item.ejercicioId || ""), index);

        if (key === selectedExerciseKey) {
          return {
            block,
            item,
            index,
            exerciseKey: key,
          };
        }
      }
    }

    return null;
  }, [activeSessionExerciseDetails, selectedExerciseKey]);

  const latestSelectedExerciseLog = useMemo(
    () => selectedExerciseWorkoutLogs[0] || null,
    [selectedExerciseWorkoutLogs]
  );

  const groupedWorkoutLogs = useMemo(() => {
    const grouped = new Map<string, { fecha: string; totalSeries: number; totalReps: number; maxPeso: number }>();

    for (const item of sessionWorkoutLogs) {
      const key = item.fecha;
      const prev = grouped.get(key) || {
        fecha: key,
        totalSeries: 0,
        totalReps: 0,
        maxPeso: 0,
      };

      grouped.set(key, {
        fecha: key,
        totalSeries: prev.totalSeries + 1,
        totalReps: prev.totalReps + item.repeticiones,
        maxPeso: Math.max(prev.maxPeso, item.pesoKg),
      });
    }

    return Array.from(grouped.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [sessionWorkoutLogs]);

  const maxWorkoutWeight = useMemo(() => {
    return groupedWorkoutLogs.reduce((max, item) => Math.max(max, item.maxPeso), 0);
  }, [groupedWorkoutLogs]);

  const latestFeedback = useMemo(() => {
    if (!routineEntryForLogs || !alumnoName) return null;

    return (
      feedbackRecords.find(
        (item) =>
          namesLikelyMatch(item.alumnoNombre, alumnoName) &&
          item.sessionId === routineEntryForLogs.sesion.id
      ) || null
    );
  }, [alumnoName, feedbackRecords, routineEntryForLogs]);

  const alumnoAnthropometry = useMemo(() => {
    if (!alumnoName) return [];
    return anthropometryEntries.filter((item) => namesLikelyMatch(item.alumnoNombre, alumnoName));
  }, [alumnoName, anthropometryEntries]);

  const latestAnthro = alumnoAnthropometry[0] || null;

  const accountHeight = toNumber(accountData?.altura);
  const alumnoHeight = toNumber(alumnoRecord?.altura);
  const heightCm = accountHeight || alumnoHeight;

  const weightKg = latestAnthro?.pesoKg ?? toNumber(alumnoRecord?.peso);

  const bmi = useMemo(() => computeBmi(weightKg ?? null, heightCm), [heightCm, weightKg]);

  const weight7Days = useMemo(() => {
    return computeRecentWeight(alumnoAnthropometry, 7) ?? weightKg ?? null;
  }, [alumnoAnthropometry, weightKg]);

  const weight15Days = useMemo(() => {
    return computeRecentWeight(alumnoAnthropometry, 15) ?? weightKg ?? null;
  }, [alumnoAnthropometry, weightKg]);

  const weightHistoric = useMemo(() => {
    const historical = alumnoAnthropometry.find((item) => item.pesoKg !== null);
    return historical?.pesoKg ?? weightKg ?? null;
  }, [alumnoAnthropometry, weightKg]);

  const weightDelta = useMemo(() => {
    if (alumnoAnthropometry.length < 2) return null;
    const [latest, previous] = alumnoAnthropometry;
    if (latest.pesoKg === null || previous.pesoKg === null) return null;
    return Number((latest.pesoKg - previous.pesoKg).toFixed(2));
  }, [alumnoAnthropometry]);

  const birthDateValue =
    (accountData?.fechaNacimiento as string | Date | null | undefined) ||
    alumnoRecord?.fechaNacimiento ||
    null;

  const age =
    (typeof accountData?.edad === "number" && Number.isFinite(accountData.edad)
      ? accountData.edad
      : null) ?? ageFromDate(birthDateValue);

  const objetivo =
    (alumnoRecord?.objetivo || "").trim() ||
    (alumnoMetaMatch?.meta?.objNutricional || "").trim() ||
    "Sin objetivo cargado";

  const telefono =
    String(accountData?.telefono || "").trim() ||
    String(alumnoMetaMatch?.meta?.telefono || "").trim() ||
    "Sin telefono";

  const nutritionTargets = selectedNutritionPlan?.targets || {
    calorias: 0,
    proteinas: 0,
    carbohidratos: 0,
    grasas: 0,
  };

  const greetingLabel = useMemo(() => resolveGreetingLabel(), []);
  const phraseOfDay = useMemo(() => resolvePhraseOfDay(), []);
  const todayWeekdayLabel = useMemo(
    () => TODAY_WEEKDAY_NAMES[new Date().getDay()] || "Hoy",
    []
  );

  const todayPlanContext = useMemo(() => {
    const todayKey = normalizePersonKey(todayWeekdayLabel);

    let matchedWeek: NormalizedWeekPlan | null = null;
    let matchedDay: NormalizedWeekDayPlan | null = null;

    for (const week of weekPlanForAlumno.semanas) {
      const foundDay = (week.dias || []).find((day) => normalizePersonKey(day.dia) === todayKey) || null;
      if (foundDay) {
        matchedWeek = week;
        matchedDay = foundDay;
        break;
      }
    }

    if (!matchedWeek) {
      matchedWeek = selectedWeek || weekPlanForAlumno.semanas[0] || null;
    }

    if (!matchedDay) {
      if (selectedDay && matchedWeek?.dias.some((day) => day.id === selectedDay.id)) {
        matchedDay = selectedDay;
      } else {
        matchedDay = matchedWeek?.dias[0] || null;
      }
    }

    const routine = resolveRoutineEntryForDay(matchedDay, routineBySessionId, routineEntries);

    return {
      week: matchedWeek,
      day: matchedDay,
      routine,
    };
  }, [
    routineBySessionId,
    routineEntries,
    selectedDay,
    selectedWeek,
    todayWeekdayLabel,
    weekPlanForAlumno.semanas,
  ]);

  const todayExerciseNames = useMemo(() => {
    if (!todayPlanContext.routine) return [] as string[];

    return (todayPlanContext.routine.bloques || []).flatMap((block) =>
      (block.ejercicios || []).map((exercise) => {
        const detail = resolveExerciseById(exerciseById, String(exercise.ejercicioId || ""));
        return detail?.nombre || "";
      })
    );
  }, [exerciseById, todayPlanContext.routine]);

  const todayTrainingFocus = useMemo(() => {
    const textSignal = [
      todayPlanContext.week?.nombre || "",
      todayPlanContext.week?.objetivo || "",
      todayPlanContext.day?.planificacion || "",
      todayPlanContext.day?.objetivo || "",
      todayPlanContext.routine?.sesion?.titulo || "",
      todayPlanContext.routine?.sesion?.objetivo || "",
    ].join(" ");

    const focusFromText = resolveTrainingFocusFromText(textSignal);
    if (focusFromText) return focusFromText;

    if (todayExerciseNames.length > 0) {
      return resolveTrainingFocusFromExercises(todayExerciseNames);
    }

    return todayPlanContext.day ? "full-body" : "descanso";
  }, [todayExerciseNames, todayPlanContext.day, todayPlanContext.routine, todayPlanContext.week]);

  const todayTrainingReminder = useMemo(
    () => buildTrainingReminderLine(todayTrainingFocus),
    [todayTrainingFocus]
  );

  const todayTrainingCaption = useMemo(() => {
    if (!todayPlanContext.day) {
      return "No hay rutina cargada para hoy. Te recomendamos movilidad y recuperacion activa.";
    }

    if (!todayPlanContext.routine) {
      return `${todayPlanContext.day.dia}: plan del dia sin ejercicios cargados.`;
    }

    return `${todayPlanContext.day.dia} · ${todayPlanContext.routine.sesion.titulo}`;
  }, [todayPlanContext.day, todayPlanContext.routine]);

  const membershipDays = useMemo(
    () => countMembershipDays(alumnoMetaMatch?.meta?.startDate, alumnoMetaMatch?.meta?.endDate),
    [alumnoMetaMatch?.meta?.endDate, alumnoMetaMatch?.meta?.startDate]
  );

  const passPlanLabel =
    membershipDays && membershipDays > 0
      ? `Plan de ${membershipDays} dias`
      : weekPlanForAlumno.totalDias > 0
        ? `Plan de ${weekPlanForAlumno.totalDias} sesiones`
        : "Plan activo";

  const isPassCurrentlyActive = useMemo(
    () => isPassActive(alumnoMetaMatch?.meta),
    [alumnoMetaMatch?.meta]
  );

  const alumnoInitials = useMemo(() => {
    const base = String(alumnoName || currentName || "Alumno").trim();
    const parts = base.split(" ").filter(Boolean);
    if (parts.length === 0) return "AL";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }, [alumnoName, currentName]);

  const quickWater = latestAnthro?.aguaLitros ?? null;
  const quickSleep = latestAnthro?.suenoHoras ?? null;
  const quickWeight = latestAnthro?.pesoKg ?? null;
  const quickActivity = latestAnthro?.actividadNivel ?? null;

  const todayExerciseCount = todayExerciseNames.filter(Boolean).length;
  const todayDateKey = useMemo(() => getLocalDateKey(), []);

  const todayWorkoutLogs = useMemo(
    () => alumnoWorkoutLogs.filter((item) => item.fecha === todayDateKey),
    [alumnoWorkoutLogs, todayDateKey]
  );

  const todayExercisesDoneCount = useMemo(() => {
    const unique = new Set(
      todayWorkoutLogs.map((item) =>
        String(item.exerciseKey || item.exerciseId || item.exerciseName || item.id || "")
      )
    );
    return unique.size;
  }, [todayWorkoutLogs]);

  const todaySeriesDone = useMemo(
    () => todayWorkoutLogs.reduce((acc, item) => acc + Math.max(0, Number(item.series) || 0), 0),
    [todayWorkoutLogs]
  );

  const todayProgressText = useMemo(() => {
    if (!todayPlanContext.day) {
      return "Hoy no hay sesion planificada. Usa el dia para recuperar o moverte suave.";
    }

    if (todayWorkoutLogs.length === 0) {
      return "Aun no registraste entreno hoy.";
    }

    return `Llevas ${todayExercisesDoneCount} ejercicio(s) y ${todaySeriesDone} serie(s) registradas hoy.`;
  }, [todayExercisesDoneCount, todayPlanContext.day, todaySeriesDone, todayWorkoutLogs.length]);

  const comfortSuggestions = useMemo(() => {
    const tips: string[] = [];

    if (quickWater !== null && quickWater < 2) {
      tips.push("Sube tu hidratacion: intenta llegar al menos a 2L hoy.");
    }

    if (quickSleep !== null && quickSleep < 7) {
      tips.push("Dormiste menos de 7h: baja un punto la intensidad si te sientes cargado.");
    }

    if (todayPlanContext.day && todayWorkoutLogs.length === 0) {
      tips.push("Activa la rutina de hoy y registra al menos el primer bloque para mantener constancia.");
    }

    if (tips.length === 0) {
      tips.push("Muy buen ritmo: mantiene tu proceso y cierra el dia con movilidad ligera.");
    }

    return tips.slice(0, 2);
  }, [quickSleep, quickWater, todayPlanContext.day, todayWorkoutLogs.length]);

  const activeQuestion = SESSION_QUESTIONS[questionIndex];

  const openQuestionnaire = () => {
    setQuestionnaireOpen(true);
    setQuestionIndex(0);
    setQuestionError("");
    setSessionAnswers({
      ...emptySessionAnswers(),
      trainedAt: toLocalDateInputValue(),
    });
  };

  const closeQuestionnaire = () => {
    setQuestionnaireOpen(false);
    setQuestionIndex(0);
    setQuestionError("");
  };

  const validateQuestion = (question: SessionQuestion): string | null => {
    if (question.id === "trainedAt" && !sessionAnswers.trainedAt) {
      return "Completa la fecha y hora de entrenamiento.";
    }

    if (question.id === "effort" && (sessionAnswers.effort === null || sessionAnswers.effort < 1)) {
      return "Selecciona el nivel de exigencia (1 a 10).";
    }

    if (question.id === "fatigue" && (sessionAnswers.fatigue === null || sessionAnswers.fatigue < 1)) {
      return "Selecciona el nivel de cansancio (1 a 10).";
    }

    if (question.id === "mood" && !sessionAnswers.mood) {
      return "Selecciona como te sentiste al terminar.";
    }

    if (question.id === "goalResult" && !sessionAnswers.goalResult) {
      return "Indica si cumpliste el objetivo de la sesion.";
    }

    return null;
  };

  const submitQuestionnaire = () => {
    if (!routineEntryForLogs || !alumnoName) {
      setQuestionError("No hay una sesion activa para registrar.");
      return;
    }

    const payload: SessionFeedbackRecord = {
      id: createId("feedback"),
      alumnoNombre: alumnoName,
      sessionId: routineEntryForLogs.sesion.id,
      sessionTitle: routineEntryForLogs.sesion.titulo,
      createdAt: new Date().toISOString(),
      trainedAt: sessionAnswers.trainedAt,
      effort: sessionAnswers.effort || 1,
      fatigue: sessionAnswers.fatigue || 1,
      mood: sessionAnswers.mood,
      goalResult: sessionAnswers.goalResult,
      comment: sessionAnswers.comment.trim(),
    };

    setFeedbackRaw((prev) => [payload, ...normalizeSessionFeedback(prev)]);

    const completionText = getCompletionCopy(payload.effort, payload.mood);
    setCompletionMessage(
      `${completionText} Gracias por entrenar, ${alumnoName}. Sigue construyendo constancia.`
    );

    setQuestionnaireOpen(false);
    setQuestionIndex(0);
    setQuestionError("");
    setTrainingView("registros");
  };

  const handleNextQuestion = () => {
    if (!activeQuestion) return;

    const validationError = validateQuestion(activeQuestion);
    if (validationError) {
      setQuestionError(validationError);
      return;
    }

    setQuestionError("");

    if (questionIndex >= SESSION_QUESTIONS.length - 1) {
      submitQuestionnaire();
      return;
    }

    setQuestionIndex((prev) => Math.min(SESSION_QUESTIONS.length - 1, prev + 1));
  };

  const handleSelectExerciseForRecord = (
    block: HydratedRoutineBlock,
    item: HydratedRoutineExercise,
    index: number
  ) => {
    const exerciseName = item.detail?.nombre || `Ejercicio ${index + 1}`;
    const exerciseId = String(item.ejercicioId || "");
    const exerciseKey = buildExerciseUiKey(String(block.id || "bloque"), exerciseId, index);

    setSelectedExerciseKey(exerciseKey);
    setExerciseDetailScreenOpen(true);
    setSelectedExerciseSubView("nuevo-registro");
    setSelectedExerciseMeta({
      blockId: String(block.id || ""),
      blockTitle: String(block.titulo || "Bloque"),
      exerciseId,
      exerciseName,
    });

    setRecordStatus("");
    setRecordForm((prev) => ({
      ...prev,
      fecha: prev.fecha || new Date().toISOString().slice(0, 10),
      series: String(Math.max(1, Number(item.series) || 1)),
      repeticiones: "",
      pesoKg: "",
      molestia: false,
      videoUrl: "",
      comentarios: "",
    }));
  };

  const handleSaveWorkoutRecord = () => {
    setRecordStatus("");

    if (!routineEntryForLogs || !selectedExerciseMeta || !selectedWeek || !selectedDay || !alumnoName) {
      setRecordStatus("Selecciona semana, dia y ejercicio para registrar la metrica.");
      return;
    }

    const series = Math.max(1, Math.round(Number(toNumber(recordForm.series) || 1)));
    const repeticiones = Math.max(0, Math.round(Number(toNumber(recordForm.repeticiones) || 0)));
    const pesoKgValue = Math.max(0, Number(toNumber(recordForm.pesoKg) || 0));

    const payload: WorkoutLogRecord = {
      id: createId("log"),
      alumnoNombre: alumnoName,
      sessionId: routineEntryForLogs.sesion.id,
      sessionTitle: routineEntryForLogs.sesion.titulo,
      weekId: selectedWeek.id,
      weekName: selectedWeek.nombre,
      dayId: selectedDay.id,
      dayName: selectedDay.dia,
      blockId: selectedExerciseMeta.blockId,
      blockTitle: selectedExerciseMeta.blockTitle,
      exerciseId: selectedExerciseMeta.exerciseId,
      exerciseName: selectedExerciseMeta.exerciseName,
      exerciseKey: selectedExerciseKey || undefined,
      fecha: recordForm.fecha || new Date().toISOString().slice(0, 10),
      series,
      repeticiones,
      pesoKg: pesoKgValue,
      molestia: recordForm.molestia,
      videoUrl: recordForm.videoUrl.trim() || undefined,
      comentarios: recordForm.comentarios.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setWorkoutLogsRaw((prev) => [payload, ...normalizeWorkoutLogs(prev)]);

    setRecordForm((prev) => ({
      ...prev,
      repeticiones: "",
      pesoKg: "",
      molestia: false,
      videoUrl: "",
      comentarios: "",
    }));

    setRecordStatus(`Registro guardado en ${selectedExerciseMeta.exerciseName}.`);
  };

  const handleDeleteWorkoutRecord = (recordId: string) => {
    if (!recordId) return;

    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Quieres eliminar este registro?");
      if (!confirmed) return;
    }

    setWorkoutLogsRaw((prev) => normalizeWorkoutLogs(prev).filter((item) => item.id !== recordId));
    setRecordStatus("Registro eliminado.");
  };

  const goToAlumnoCategory = (category: MainCategory) => {
    if (category === mainCategory) {
      return;
    }

    // Prevent cross-screen overlays when switching tabs quickly from the main dock.
    setQuestionnaireOpen(false);
    setQuestionError("");
    setCompletionMessage("");
    setExerciseDetailScreenOpen(false);
    setShowInteractionPanel(false);
    if (category !== "progreso") {
      setShowAnthroForm(false);
    }

    setMainCategory(category);

    if (typeof window !== "undefined") {
      // Reset scroll so the incoming tab starts clean and not on the leftover
      // position of the previous screen (prevents visual "overlap" glitches).
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {
        window.scrollTo(0, 0);
      }

      const nextPath = `/alumnos/${category}`;
      if (window.location.pathname !== nextPath) {
        window.history.replaceState(window.history.state, "", nextPath);
      }
    }
  };

  const jumpToTodayRoutine = () => {
    if (todayPlanContext.week?.id) {
      setSelectedWeekId(todayPlanContext.week.id);
    }
    if (todayPlanContext.day?.id) {
      setSelectedDayId(todayPlanContext.day.id);
    }
    if (todayPlanContext.routine?.sesion?.id) {
      setSelectedSessionId(todayPlanContext.routine.sesion.id);
    }

    goToAlumnoCategory("rutina");
    setTrainingView("descripcion");
  };

  const handleSendRoutineInteraction = (type: ClientInteractionType) => {
    setInteractionStatus("");

    if (!alumnoName) {
      setInteractionStatus("No pudimos identificar al alumno para enviar la solicitud.");
      return;
    }

    const copy = ROUTINE_INTERACTION_COPY[type];
    let detail = copy.defaultDetail;

    if (typeof window !== "undefined") {
      const response = window.prompt(copy.prompt, copy.defaultDetail);
      if (response === null) {
        setInteractionStatus("Solicitud cancelada.");
        return;
      }

      detail = response.trim() || copy.defaultDetail;
    }

    if (type === "pregunta-profesor") {
      if (!profesorContacto?.waPhone) {
        setInteractionStatus("No hay numero de WhatsApp del profesor/admin configurado.");
        return;
      }

      const profesorNombre = profesorContacto.nombre || "profe";
      const intro = `Hola ${profesorNombre}, soy ${alumnoName}.`;
      const source = currentEmail ? ` (${currentEmail})` : "";
      const message = encodeURIComponent(`${intro}${source} ${detail}`.trim());

      if (typeof window !== "undefined") {
        window.open(
          `https://wa.me/${profesorContacto.waPhone}?text=${message}`,
          "_blank",
          "noopener,noreferrer"
        );
      }
    }

    const payload: ClientInteractionRequest = {
      id: createId("interaction"),
      alumnoNombre: alumnoName,
      alumnoEmail: currentEmail,
      telefono: telefono !== "Sin telefono" ? telefono : undefined,
      type,
      title: copy.title,
      detail,
      status: "pendiente",
      createdAt: new Date().toISOString(),
      sourceCategory: "rutina",
    };

    setInteractionRaw((prev) => [payload, ...normalizeClientInteractionRequests(prev)]);
    if (type === "pregunta-profesor") {
      setInteractionStatus(`Abriendo WhatsApp con ${profesorContacto?.nombre || "el profesor"}.`);
      return;
    }

    setInteractionStatus(copy.success);
  };

  const handleSaveAnthropometry = () => {
    setAnthroStatus("");

    if (!alumnoName) {
      setAnthroStatus("No pudimos identificar al alumno para guardar mediciones.");
      return;
    }

    const payload: AnthropometryEntry = {
      id: createId("anthro"),
      alumnoNombre: alumnoName,
      createdAt: new Date().toISOString(),
      pesoKg: toNullableNumber(anthroForm.pesoKg),
      aguaLitros: toNullableNumber(anthroForm.aguaLitros),
      suenoHoras: toNullableNumber(anthroForm.suenoHoras),
      actividadNivel: toNullableNumber(anthroForm.actividadNivel),
      cinturaCm: toNullableNumber(anthroForm.cinturaCm),
      caderaCm: toNullableNumber(anthroForm.caderaCm),
      grasaPct: toNullableNumber(anthroForm.grasaPct),
      musculoPct: toNullableNumber(anthroForm.musculoPct),
      notas: anthroForm.notas.trim() || undefined,
    };

    setAnthropometryRaw((prev) => [payload, ...normalizeAnthropometry(prev)]);

    setAnthroForm({
      pesoKg: "",
      aguaLitros: "",
      suenoHoras: "",
      actividadNivel: "",
      cinturaCm: "",
      caderaCm: "",
      grasaPct: "",
      musculoPct: "",
      notas: "",
    });

    setShowAnthroForm(false);
    setAnthroStatus("Antropometria actualizada.");
  };

  const progressPct = Math.round(((questionIndex + 1) / SESSION_QUESTIONS.length) * 100);
  const panelEyebrow = "Panel Alumno";
  const sectionHeadlines: Record<MainCategory, { title: string; description: string }> = {
    inicio: {
      title: `Hola, ${alumnoName || "alumno"}`,
      description: "Resumen diario con accesos rapidos a entrenamiento, nutricion y cuenta.",
    },
    rutina: {
      title: "Rutina de entrenamiento",
      description: "Plan semanal simple: elige semana y dia, revisa ejercicios y registra tus cargas.",
    },
    nutricion: {
      title: "Plan nutricional",
      description: "Objetivos de macros, comidas del dia y referencias de ingesta para mantener rumbo.",
    },
    progreso: {
      title: "Cuenta y progreso",
      description: "Estado del pase, datos personales y evolucion semanal para ajustar el plan.",
    },
    musica: {
      title: "Musica para entrenar",
      description: "Playlists y recomendaciones para activar foco durante entrenamiento y recuperacion.",
    },
  };

  const activeHeadline = sectionHeadlines[mainCategory];
  const topCategoryCards: Array<{
    id: MainCategory;
    label: string;
    helper: string;
    value: string;
  }> = [
    {
      id: "inicio",
      label: "Inicio",
      helper: "resumen diario",
      value:
        todayWorkoutLogs.length > 0
          ? `${todayExercisesDoneCount} ejercicio(s) hoy`
          : "Sin registro hoy",
    },
    {
      id: "rutina",
      label: "Rutina",
      helper: "entrenamiento",
      value: `${weekPlanForAlumno.totalDias} dia(s)`,
    },
    {
      id: "nutricion",
      label: "Nutricion",
      helper: "plan activo",
      value: selectedNutritionPlan ? `${nutritionTargets.calorias || 0} kcal` : "Sin plan",
    },
    {
      id: "progreso",
      label: "Cuenta",
      helper: "pase y datos",
      value: isPassCurrentlyActive ? "Pase activo" : "Pase pendiente",
    },
    {
      id: "musica",
      label: "Musica",
      helper: "playlists",
      value: `${musicAssignments.length} lista(s)`,
    },
  ];

  const mobileDockItems: Array<{ id: MainCategory; label: string; iconLabel: string }> = [
    { id: "inicio", label: "Inicio", iconLabel: "IN" },
    { id: "rutina", label: "Entrena", iconLabel: "TR" },
    { id: "nutricion", label: "Nutricion", iconLabel: "NU" },
    { id: "progreso", label: "Cuenta", iconLabel: "CU" },
  ];

  const canOpenProfessorWhatsApp = Boolean(profesorContacto?.waPhone);
  const profileImageSrc = useMemo(() => {
    const fromAccount =
      typeof accountData?.sidebarImage === "string" ? accountData.sidebarImage.trim() : "";
    if (fromAccount) return fromAccount;

    if (typeof window === "undefined") return "";
    try {
      const fromLocalStorage = window.localStorage.getItem("pf-control-sidebar-image-v1") || "";
      return String(fromLocalStorage).trim();
    } catch {
      return "";
    }
  }, [accountData?.sidebarImage]);
  const hasProfileImage = Boolean(profileImageSrc);

  const renderQuickMetricIcon = (icon: QuickMetricIcon) => {
    const baseClassName =
      "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20";

    if (icon === "agua") {
      return (
        <span className={`${baseClassName} bg-gradient-to-b from-sky-400 to-blue-600`}>
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3C12 3 6 10 6 14a6 6 0 0 0 12 0c0-4-6-11-6-11Z" />
          </svg>
        </span>
      );
    }

    if (icon === "sueno") {
      return (
        <span className={`${baseClassName} bg-gradient-to-b from-indigo-300 to-indigo-600`}>
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 14.2A8 8 0 1 1 9.8 4a6.2 6.2 0 0 0 10.2 10.2Z" />
          </svg>
        </span>
      );
    }

    if (icon === "peso") {
      return (
        <span className={`${baseClassName} bg-gradient-to-b from-cyan-300 to-teal-500`}>
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10v4M6 8v8M9 10v4M15 10v4M18 8v8M21 10v4" />
            <path d="M9 12h6" />
          </svg>
        </span>
      );
    }

    return (
      <span className={`${baseClassName} bg-gradient-to-b from-rose-400 to-fuchsia-600`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h4l3-5 4 10 3-5h4" />
        </svg>
      </span>
    );
  };

  return (
    <main className="pf-alumno-main mx-auto max-w-7xl space-y-5 p-4 pb-28 text-slate-100 sm:p-6 sm:pb-8">
      {mainCategory !== "inicio" ? (
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-[#061a2b] p-5 sm:p-6">

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200/85">{panelEyebrow}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{activeHeadline.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-200/90">{activeHeadline.description}</p>
          </div>

          <div className="rounded-2xl border border-cyan-200/30 bg-cyan-500/10 px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">Objetivo actual</p>
            <p className="mt-1 text-sm font-semibold text-cyan-50">{objetivo}</p>
            <p className="mt-1 text-xs text-cyan-100/80">
              Vigencia: {formatDate(alumnoMetaMatch?.meta?.startDate || null)} - {formatDate(alumnoMetaMatch?.meta?.endDate || null)}
            </p>
            <p className="mt-1 text-xs text-cyan-100/80">{todayWeekdayLabel} · {todayDateKey}</p>
          </div>
        </div>

        <div className="relative mt-4 rounded-2xl border border-white/15 bg-slate-950/50 p-3 xl:hidden">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-white">{greetingLabel}</p>
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
              {todayWeekdayLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-300">{todayProgressText}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ReliableActionButton
              type="button"
              onClick={jumpToTodayRoutine}
              className="rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-left"
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Entrenamiento</p>
              <p className="mt-1 text-sm font-semibold text-white">{todayExerciseCount} ejercicio(s)</p>
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              onClick={() => goToAlumnoCategory("progreso")}
              className="rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-left"
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">Cuenta</p>
              <p className="mt-1 text-sm font-semibold text-white">{isPassCurrentlyActive ? "Pase activo" : "Revisar pago"}</p>
            </ReliableActionButton>
          </div>
        </div>

        <div className="relative mt-5 hidden gap-2 xl:grid xl:grid-cols-5">
          {topCategoryCards.map((item) => {
            const isActive = mainCategory === item.id;

            return (
              <ReliableActionButton
                key={item.id}
                type="button"
                onClick={() => goToAlumnoCategory(item.id)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-cyan-200/60 bg-cyan-400/20"
                    : "border-white/15 bg-slate-900/55 hover:border-cyan-200/35 hover:bg-slate-900/80"
                }`}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                <p className="mt-1 text-xs text-slate-300">{item.helper}</p>
              </ReliableActionButton>
            );
          })}
        </div>

        <div className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Rutinas activas" value={String(routineEntries.length)} tone="cyan" />
          <StatCard label="Prescripciones" value={String(latestPrescriptionCount)} tone="emerald" />
          <StatCard label="Plan nutricional" value={selectedNutritionPlan ? "Activo" : "Sin plan"} tone="fuchsia" />
          <StatCard label="Playlists" value={String(musicAssignments.length)} />
        </div>
      </section>
      ) : null}

      {mountedCategories.inicio ? (
        <section
          data-category="inicio"
          className={`pf-alumno-stage-panel ${
            mainCategory === "inicio"
              ? "pf-alumno-stage-active space-y-4 sm:space-y-5"
              : "pf-alumno-stage-hidden"
          }`}
          aria-hidden={mainCategory !== "inicio"}
        >
          <section className="relative overflow-hidden rounded-[2rem] border border-slate-700/70 bg-[#071320] p-4 sm:p-5">
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">
                  <span>Panel alumno</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    En linea
                  </span>
                </p>
                <h2 className="mt-1 text-3xl font-black leading-[1.05] text-white sm:text-4xl">
                  {`${greetingLabel}, ${alumnoName || "Alumno"}`}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {isPassCurrentlyActive ? "Plan activo" : "Plan pendiente"} · {passPlanLabel}
                </p>
              </div>
              <div className="relative h-16 w-16 shrink-0">
                <div className="h-full w-full overflow-hidden rounded-full border border-white/25 bg-slate-700/65">
                  {hasProfileImage ? (
                    <img src={profileImageSrc} alt="Perfil" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-black text-white">
                      {alumnoInitials}
                    </div>
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#071320] bg-emerald-400" />
              </div>
            </div>

            <div className="relative mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                Desde {formatDate(alumnoMetaMatch?.meta?.startDate || null)}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                Hasta {formatDate(alumnoMetaMatch?.meta?.endDate || null)}
              </span>
            </div>

            <article className="relative mt-4 rounded-3xl border border-white/10 bg-[#151b28]/95 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">Resumen de membresia</p>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                    isPassCurrentlyActive
                      ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100"
                      : "border-rose-300/35 bg-rose-500/15 text-rose-100"
                  }`}
                >
                  {isPassCurrentlyActive ? "Activa" : "Pendiente"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[#27344a] px-2 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-slate-300">Plan</p>
                  <p className="mt-1 text-base font-black text-white">{Math.max(weekPlanForAlumno.totalDias, 1)} dias</p>
                </div>
                <div className="rounded-2xl bg-[#27344a] px-2 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-slate-300">Semanas</p>
                  <p className="mt-1 text-base font-black text-white">{weekPlanForAlumno.totalSemanas}</p>
                </div>
                <div className="rounded-2xl bg-[#27344a] px-2 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-slate-300">Estado</p>
                  <p className="mt-1 text-base font-black text-white">{isPassCurrentlyActive ? "OK" : "Pago"}</p>
                </div>
              </div>

              <div className="mt-2 rounded-2xl bg-white/[0.05] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Objetivo</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-100">{objetivo}</p>
              </div>

              {!isPassCurrentlyActive ? (
                <div className="mt-3 rounded-2xl border border-rose-300/35 bg-rose-500/10 p-3 text-xs text-rose-100">
                  Tu pase esta pendiente o vencido. Regulariza el pago para habilitar nuevamente el acceso completo.
                  <div className="mt-2">
                    <ReliableActionButton
                      type="button"
                      onClick={() => router.push("/alumnos/pagos")}
                      className="rounded-lg border border-rose-200/45 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-50"
                    >
                      Ir a pagos
                    </ReliableActionButton>
                  </div>
                </div>
              ) : null}
            </article>

            <div className="relative mt-4 grid grid-cols-2 gap-2">
              <ReliableActionButton
                type="button"
                onClick={openQuestionnaire}
                className="rounded-2xl border border-white/10 bg-[#2a2d36] px-2 py-2 text-center text-[13px] font-bold leading-tight text-white"
              >
                Cuestionarios
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={jumpToTodayRoutine}
                className="rounded-2xl border border-white/10 bg-[#2a2d36] px-2 py-2 text-center text-[13px] font-bold leading-tight text-white"
              >
                Rutina
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => {
                  goToAlumnoCategory("progreso");
                  setProgressView("antropometria");
                }}
                className="col-span-2 rounded-2xl border border-white/10 bg-[#2a2d36] px-2 py-2 text-center text-[13px] font-bold leading-tight text-white"
              >
                Controles
              </ReliableActionButton>
            </div>
          </section>

          {musicAssignments.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-black text-white">ZZZ</p>
                  <p className="text-sm text-slate-300">{musicAssignments[0].objetivo || "Playlist sugerida para hoy"}</p>
                </div>
                <ReliableActionButton
                  type="button"
                  onClick={() => goToAlumnoCategory("musica")}
                  className="text-sm text-slate-200 underline decoration-white/35 underline-offset-4"
                >
                  Ver
                </ReliableActionButton>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {musicAssignments.slice(0, 3).map((item) => (
                  <ReliableActionButton
                    key={item.id}
                    type="button"
                    onClick={() => goToAlumnoCategory("musica")}
                    className="rounded-2xl bg-[#171a22] p-2 text-left"
                  >
                    <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-fuchsia-500/40 via-slate-900 to-cyan-500/30" />
                    <p className="mt-2 line-clamp-1 text-base font-black text-white">{item.playlistName}</p>
                    <p className="line-clamp-1 text-xs text-slate-300">
                      {item.recommendedSongArtist || getPlatformLabel(item.platform)}
                    </p>
                  </ReliableActionButton>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <h3 className="text-[2.1rem] font-black tracking-tight leading-[0.95] text-white sm:text-5xl">Carga rapida</h3>
              <p className="text-xs text-slate-400">{todayDateKey}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
              <ReliableActionButton
                type="button"
                onClick={() => {
                  goToAlumnoCategory("progreso");
                  setProgressView("antropometria");
                  setShowAnthroForm(true);
                }}
                className="overflow-hidden rounded-2xl bg-[#1b1d24] text-left"
              >
                <div className="flex min-h-[82px] items-center gap-3 p-3">
                  {renderQuickMetricIcon("agua")}
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-black leading-none text-white sm:text-3xl">Agua</p>
                    <p className="mt-1 text-sm text-slate-300">{quickWater === null ? "Sin dato" : `${quickWater} L`}</p>
                  </div>
                </div>
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => {
                  goToAlumnoCategory("progreso");
                  setProgressView("antropometria");
                  setShowAnthroForm(true);
                }}
                className="overflow-hidden rounded-2xl bg-[#1b1d24] text-left"
              >
                <div className="flex min-h-[82px] items-center gap-3 p-3">
                  {renderQuickMetricIcon("sueno")}
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-black leading-none text-white sm:text-3xl">Sueno</p>
                    <p className="mt-1 text-sm text-slate-300">{quickSleep === null ? "Sin dato" : `${quickSleep} h`}</p>
                  </div>
                </div>
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => {
                  goToAlumnoCategory("progreso");
                  setProgressView("antropometria");
                  setShowAnthroForm(true);
                }}
                className="overflow-hidden rounded-2xl bg-[#1b1d24] text-left"
              >
                <div className="flex min-h-[82px] items-center gap-3 p-3">
                  {renderQuickMetricIcon("peso")}
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-black leading-none text-white sm:text-3xl">Peso</p>
                    <p className="mt-1 text-sm text-slate-300">{quickWeight === null ? "Sin dato" : `${quickWeight} kg`}</p>
                  </div>
                </div>
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => {
                  goToAlumnoCategory("progreso");
                  setProgressView("antropometria");
                  setShowAnthroForm(true);
                }}
                className="overflow-hidden rounded-2xl bg-[#1b1d24] text-left"
              >
                <div className="flex min-h-[82px] items-center gap-3 p-3">
                  {renderQuickMetricIcon("actividad")}
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-black leading-none text-white sm:text-3xl">Actividad</p>
                    <p className="mt-1 text-sm text-slate-300">{quickActivity === null ? "Sin dato" : `${quickActivity}/10`}</p>
                  </div>
                </div>
              </ReliableActionButton>
            </div>
          </section>

          <section className="space-y-3 rounded-3xl bg-[#161922] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[2rem] font-black leading-none text-white sm:text-4xl">Peso corporal</h3>
              <ReliableActionButton
                type="button"
                onClick={() => {
                  goToAlumnoCategory("progreso");
                  setProgressView("antropometria");
                }}
                className="text-2xl text-slate-200"
              >
                ↻
              </ReliableActionButton>
            </div>

            <div className="rounded-3xl bg-[#1b1e27] p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-black text-white sm:text-2xl">{weight7Days === null ? "-" : weight7Days.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">kg</p>
                  <p className="text-base text-slate-200 sm:text-lg">7 dias</p>
                </div>
                <div>
                  <p className="text-xl font-black text-white sm:text-2xl">{weight15Days === null ? "-" : weight15Days.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">kg</p>
                  <p className="text-base text-slate-200 sm:text-lg">15 dias</p>
                </div>
                <div>
                  <p className="text-xl font-black text-white sm:text-2xl">{weightHistoric === null ? "-" : weightHistoric.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">kg</p>
                  <p className="text-base text-slate-200 sm:text-lg">Historico</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-3xl bg-[#0f1319] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[2rem] font-black leading-none text-white sm:text-4xl">Medidas corporales</h3>
              <ReliableActionButton
                type="button"
                onClick={() => {
                  goToAlumnoCategory("progreso");
                  setProgressView("antropometria");
                  setShowAnthroForm(true);
                }}
                className="text-3xl text-slate-200"
              >
                +
              </ReliableActionButton>
            </div>
            <p className="text-lg text-slate-400 sm:text-xl">
              {latestAnthro && (latestAnthro.cinturaCm !== null || latestAnthro.caderaCm !== null || latestAnthro.grasaPct !== null)
                ? `Cintura ${latestAnthro.cinturaCm ?? "-"} cm · Cadera ${latestAnthro.caderaCm ?? "-"} cm · Grasa ${latestAnthro.grasaPct ?? "-"}%`
                : "No se encontraron datos"}
            </p>

            <div className="flex items-center justify-between pt-2">
              <h3 className="text-[2rem] font-black leading-none text-white sm:text-4xl">Actividad</h3>
              <ReliableActionButton
                type="button"
                onClick={() => {
                  goToAlumnoCategory("progreso");
                  setProgressView("antropometria");
                  setShowAnthroForm(true);
                }}
                className="text-3xl text-slate-200"
              >
                +
              </ReliableActionButton>
            </div>
            <p className="text-lg text-slate-400 sm:text-xl">
              {quickActivity === null
                ? "No se encontraron datos"
                : `Ultimo registro de actividad: ${quickActivity}/10`}
            </p>
          </section>
        </section>
      ) : null}

      {mountedCategories.rutina ? (
        <section
          data-category="rutina"
          className={`pf-alumno-stage-panel ${
            mainCategory === "rutina"
              ? "pf-alumno-stage-active space-y-4 rounded-3xl border border-white/15 bg-slate-900/75 p-5"
              : "pf-alumno-stage-hidden"
          }`}
          aria-hidden={mainCategory !== "rutina"}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Rutina de entrenamiento</h2>
              <p className="mt-1 text-sm text-slate-300">
                Espacio enfocado en ejecutar la planificacion, registrar tus cargas y mantener progreso semanal.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-white/15 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                {weekPlanForAlumno.totalSemanas} semanas · {weekPlanForAlumno.totalDias} dias
              </div>
              <ReliableActionButton
                type="button"
                onClick={jumpToTodayRoutine}
                className="rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-100"
              >
                Hoy
              </ReliableActionButton>
            </div>
          </div>

          <section className="space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">Plan semanal</p>
            {weekPlanForAlumno.semanas.length === 0 ? (
              <p className="mt-2 text-sm text-slate-300">No hay semanas cargadas.</p>
            ) : (
              <>
                <div className="relative overflow-hidden border-y border-white/10 py-2">
                  <div
                    className={`mx-auto w-full max-w-[18rem] text-center transition-opacity duration-200 ease-out ${
                      isWeekSliding ? "opacity-70" : "opacity-100"
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Semana activa</p>
                    <p className="text-2xl font-black text-white">{selectedWeek?.nombre || "Sin semana"}</p>
                  </div>

                  <ReliableActionButton
                    type="button"
                    onClick={() => handleShiftWeek(-1)}
                    disabled={!canGoPreviousWeek}
                    className={`absolute left-0 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/60 text-white transition hover:bg-slate-900 disabled:pointer-events-none disabled:opacity-0 ${
                      canGoPreviousWeek ? "" : "opacity-0"
                    }`}
                    aria-label="Semana anterior"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </ReliableActionButton>

                  <ReliableActionButton
                    type="button"
                    onClick={() => handleShiftWeek(1)}
                    disabled={!canGoNextWeek}
                    className={`absolute right-0 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/60 text-white transition hover:bg-slate-900 disabled:pointer-events-none disabled:opacity-0 ${
                      canGoNextWeek ? "" : "opacity-0"
                    }`}
                    aria-label="Semana siguiente"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </ReliableActionButton>
                </div>

                {selectedWeek ? (
                  selectedWeek.dias.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-300">Semana sin dias cargados.</p>
                  ) : (
                    <div className="mt-1 overflow-hidden pb-1">
                      <div
                        className={`flex flex-wrap justify-center gap-2 transition-opacity duration-200 ease-out ${
                          isWeekSliding ? "opacity-70" : "opacity-100"
                        }`}
                      >
                        {selectedWeek.dias.map((dia) => {
                          const isSelectedDia = dia.id === selectedDayId;
                          return (
                            <ReliableActionButton
                              key={dia.id}
                              type="button"
                              onClick={() => setSelectedDayId(dia.id)}
                              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                                isSelectedDia
                                  ? "border-fuchsia-300/60 bg-fuchsia-500/80 text-white"
                                  : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                              }`}
                            >
                              {dia.dia}
                            </ReliableActionButton>
                          );
                        })}
                      </div>
                    </div>
                  )
                ) : null}

                {selectedDay ? (
                  <p className="mt-3 text-sm text-slate-200">
                    {selectedDay.planificacion || "Sin planificacion"}
                  </p>
                ) : null}
              </>
            )}
          </section>

          {selectedWeek && selectedDay && !selectedDayRoutineEntry ? (
            <div className="rounded-2xl border border-amber-300/35 bg-amber-500/10 p-4 text-sm text-amber-100">
              Este dia no tiene ejercicios cargados.
            </div>
          ) : null}

          <section className="rounded-2xl border border-white/15 bg-slate-950/45 p-2">
            <div className="flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={() => setTrainingView("descripcion")}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${
                  trainingView === "descripcion"
                    ? "bg-cyan-400 text-slate-950"
                    : "border border-white/20 bg-white/5 text-slate-100"
                }`}
              >
                Descripcion
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => setTrainingView("registros")}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${
                  trainingView === "registros"
                    ? "bg-cyan-400 text-slate-950"
                    : "border border-white/20 bg-white/5 text-slate-100"
                }`}
              >
                Registros
              </ReliableActionButton>
            </div>
          </section>

          {trainingView === "descripcion" ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2">
                <p className="text-sm font-semibold text-slate-100">
                  {selectedDay
                    ? `${selectedDay.dia}: ${selectedDay.planificacion || "Entrenamiento del dia"}`
                    : "Selecciona un dia para ver ejercicios"}
                </p>
                <span className="rounded-lg border border-white/20 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-300">
                  {weekPlanForAlumno.totalSemanas} semanas · {weekPlanForAlumno.totalDias} dias
                </span>
              </div>

              {activeSessionExerciseDetails.length === 0 ? (
                <div className="rounded-2xl border border-white/15 bg-slate-900/60 p-5 text-sm text-slate-300">
                  Este dia no tiene bloques ni ejercicios cargados.
                </div>
              ) : (
                activeSessionExerciseDetails.map((bloque) => (
                  <article key={bloque.id} className="rounded-2xl border border-white/15 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-xl font-black text-white">{bloque.titulo || "Bloque"}</h3>
                      <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-200">
                        {(bloque.ejercicios || []).length} ejercicio(s)
                      </span>
                    </div>
                    <div className="mt-2 rounded-lg border border-white/10 bg-slate-800/45 px-3 py-2">
                      <p className="text-sm text-slate-300">{bloque.objetivo || "Objetivo bloque"}</p>
                    </div>

                    {(bloque.ejercicios || []).length === 0 ? (
                      <p className="mt-3 rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-slate-400">
                        Este bloque no tiene ejercicios cargados.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {(bloque.ejercicios || []).map((item, index) => {
                          const detail = item.detail;
                          const exerciseName = detail?.nombre || `Ejercicio ${index + 1}`;
                          const exerciseKey = buildExerciseUiKey(String(bloque.id || "bloque"), String(item.ejercicioId || ""), index);
                          const isSelectedExercise = selectedExerciseKey === exerciseKey;
                          const previewImage = resolveExercisePreviewImage(String(detail?.videoUrl || ""));
                          const metricas = Array.isArray(item.metricas) ? item.metricas : [];
                          const descanso =
                            item.descanso ||
                            metricas.find((m) => /desc|rest/i.test(String(m.nombre || "")))?.valor ||
                            "0";
                          const rir =
                            metricas.find((m) => /rir/i.test(String(m.nombre || "")))?.valor ||
                            "S/D";
                          const carga =
                            item.carga ||
                            metricas.find((m) => /peso|kg|carga|load/i.test(String(m.nombre || "")))?.valor ||
                            "0";
                          const observaciones =
                            String(item.observaciones || "").trim() ||
                            metricas.find((m) => /obs|nota|comment/i.test(String(m.nombre || "")))?.valor ||
                            "S/D";
                          const gruposMusculares =
                            Array.isArray(detail?.gruposMusculares) && detail.gruposMusculares.length > 0
                              ? detail.gruposMusculares
                                  .map((group) => String(group || "").trim())
                                  .filter(Boolean)
                                  .slice(0, 8)
                              : [];

                          return (
                            <article
                              key={exerciseKey}
                              className={`rounded-xl border p-3 transition ${
                                isSelectedExercise
                                  ? "border-cyan-300/40 bg-slate-900/80"
                                  : "border-white/10 bg-slate-950/45"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleSelectExerciseForRecord(bloque, item, index)}
                                  className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-slate-800"
                                  title="Abrir ejercicio"
                                >
                                  {previewImage ? (
                                    <img
                                      src={previewImage}
                                      alt={exerciseName}
                                      className="h-full w-full object-cover"
                                      loading="eager"
                                      decoding="async"
                                    />
                                  ) : (
                                    <span className="block px-1 text-[10px] font-semibold text-slate-300">Sin preview</span>
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSelectExerciseForRecord(bloque, item, index);
                                      setSelectedExerciseSubView("nuevo-registro");
                                    }}
                                    className="block text-left text-[1.35rem] font-black leading-tight text-white underline decoration-transparent underline-offset-4 transition hover:decoration-cyan-300"
                                  >
                                    {exerciseName}
                                  </button>

                                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3 xl:grid-cols-6">
                                    <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">
                                      <p className="text-slate-400">Series</p>
                                      <p className="font-semibold text-white">{item.series}</p>
                                    </div>
                                    <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">
                                      <p className="text-slate-400">Rep.</p>
                                      <p className="font-semibold text-white">{item.repeticiones || "0"}</p>
                                    </div>
                                    <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">
                                      <p className="text-slate-400">Desc.</p>
                                      <p className="font-semibold text-white">{descanso}</p>
                                    </div>
                                    <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">
                                      <p className="text-slate-400">RIR</p>
                                      <p className="font-semibold text-white">{rir}</p>
                                    </div>
                                    <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">
                                      <p className="text-slate-400">Carga (Kg)</p>
                                      <p className="font-semibold text-white">{carga}</p>
                                    </div>
                                    <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">
                                      <p className="text-slate-400">Obs.</p>
                                      <p className="truncate font-semibold text-white">{observaciones}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {gruposMusculares.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {gruposMusculares.map((group) => (
                                    <span
                                      key={`${exerciseKey}-${group}`}
                                      className="rounded-md border border-violet-200/30 bg-violet-500/20 px-2 py-0.5 text-[11px] font-semibold text-violet-100"
                                    >
                                      {group}
                                    </span>
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold">
                                <ReliableActionButton
                                  type="button"
                                  onClick={() => {
                                    handleSelectExerciseForRecord(bloque, item, index);
                                    setSelectedExerciseSubView("registros");
                                  }}
                                  className="text-cyan-300"
                                >
                                  Ver pesos
                                </ReliableActionButton>
                                <ReliableActionButton
                                  type="button"
                                  onClick={() => handleSelectExerciseForRecord(bloque, item, index)}
                                  className="text-cyan-300"
                                >
                                  Registrar peso
                                </ReliableActionButton>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </article>
                ))
              )}

              {exerciseDetailScreenOpen && selectedExercisePanelData
                ? (() => {
                    const { block, item, index, exerciseKey } = selectedExercisePanelData;
                    const detail = item.detail;
                    const exerciseName = detail?.nombre || `Ejercicio ${index + 1}`;
                    const metricas = Array.isArray(item.metricas) ? item.metricas : [];
                    const descanso =
                      item.descanso ||
                      metricas.find((m) => /desc|rest/i.test(String(m.nombre || "")))?.valor ||
                      "S/D";
                    const rir = metricas.find((m) => /rir/i.test(String(m.nombre || "")))?.valor || "S/D";
                    const pesoBase =
                      item.carga ||
                      metricas.find((m) => /peso|kg|carga|load/i.test(String(m.nombre || "")))?.valor ||
                      "S/D";
                    const exerciseDescription =
                      String(detail?.descripcion || "").trim() ||
                      String(item.observaciones || "").trim() ||
                      "Sin descripcion cargada para este ejercicio.";
                    const exerciseVideoEmbed = resolveExerciseVideoEmbed(String(detail?.videoUrl || ""));

                    return (
                      <div className="fixed inset-0 z-[120] bg-slate-950/80 p-4 backdrop-blur-sm">
                        <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-cyan-300/30 bg-slate-950">
                          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-200">Pantalla del ejercicio</p>
                              <h4 className="text-lg font-black text-white">{exerciseName}</h4>
                              <p className="text-xs text-slate-300">{block.titulo || "Bloque"}</p>
                            </div>
                            <ReliableActionButton
                              type="button"
                              onClick={() => setExerciseDetailScreenOpen(false)}
                              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white"
                            >
                              Cerrar
                            </ReliableActionButton>
                          </div>

                          <div className="flex-1 overflow-y-auto p-4">
                            <div className="grid gap-4">
                              <div className="order-2 rounded-xl border border-cyan-300/25 bg-slate-900/60 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                                  Descripcion del ejercicio
                                </p>
                                <p className="mt-1 text-sm text-slate-100">{exerciseDescription}</p>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Series</p>
                                    <p className="mt-1 text-sm font-bold text-white">{item.series}</p>
                                  </div>
                                  <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Reps</p>
                                    <p className="mt-1 text-sm font-bold text-white">{item.repeticiones || "S/D"}</p>
                                  </div>
                                  <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Carga</p>
                                    <p className="mt-1 text-sm font-bold text-white">{pesoBase}</p>
                                  </div>
                                  <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Descanso</p>
                                    <p className="mt-1 text-sm font-bold text-white">{descanso}</p>
                                  </div>
                                  <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">RIR</p>
                                    <p className="mt-1 text-sm font-bold text-white">{rir}</p>
                                  </div>
                                  <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Observaciones</p>
                                    <p className="mt-1 text-sm font-bold text-white">{item.observaciones || "S/D"}</p>
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                                    Video del ejercicio
                                  </p>
                                  {exerciseVideoEmbed ? (
                                    <iframe
                                      title={`video-${exerciseKey}`}
                                      src={exerciseVideoEmbed}
                                      className="mt-2 aspect-video w-full min-h-[22rem] rounded-xl border border-white/20 md:min-h-[28rem]"
                                      loading="eager"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  ) : detail?.videoUrl ? (
                                    <a
                                      href={detail.videoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2 inline-flex rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
                                    >
                                      Abrir video de referencia
                                    </a>
                                  ) : (
                                    <p className="mt-2 text-sm text-cyan-100/80">Este ejercicio no tiene video cargado.</p>
                                  )}
                                </div>
                              </div>

                              <div className="order-1 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3">
                                <div className="flex flex-wrap gap-2">
                                  <ReliableActionButton
                                    type="button"
                                    onClick={() => setSelectedExerciseSubView("nuevo-registro")}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                                      selectedExerciseSubView === "nuevo-registro"
                                        ? "bg-emerald-400 text-slate-950"
                                        : "border border-white/20 bg-slate-900/45 text-emerald-50"
                                    }`}
                                  >
                                    Nuevo registro
                                  </ReliableActionButton>
                                  <ReliableActionButton
                                    type="button"
                                    onClick={() => setSelectedExerciseSubView("registros")}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                                      selectedExerciseSubView === "registros"
                                        ? "bg-emerald-400 text-slate-950"
                                        : "border border-white/20 bg-slate-900/45 text-emerald-50"
                                    }`}
                                  >
                                    Registros
                                  </ReliableActionButton>
                                </div>

                                {selectedExerciseSubView === "nuevo-registro" ? (
                                  <div className="mt-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
                                      Nuevo registro en este ejercicio
                                    </p>

                                    {latestSelectedExerciseLog ? (
                                      <p className="mt-1 text-xs text-emerald-50/90">
                                        Ultimo registro: {formatShortDate(latestSelectedExerciseLog.fecha)} · serie {latestSelectedExerciseLog.series} · {latestSelectedExerciseLog.repeticiones} reps · {latestSelectedExerciseLog.pesoKg} kg
                                      </p>
                                    ) : null}

                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                      <label className="text-sm text-emerald-50">
                                        Fecha
                                        <input
                                          value={recordForm.fecha}
                                          onChange={(e) => setRecordForm((prev) => ({ ...prev, fecha: e.target.value }))}
                                          type="date"
                                          className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                                        />
                                      </label>
                                      <label className="text-sm text-emerald-50">
                                        Series hechas
                                        <input
                                          value={recordForm.series}
                                          onChange={(e) => setRecordForm((prev) => ({ ...prev, series: e.target.value }))}
                                          inputMode="numeric"
                                          className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                                          placeholder="1"
                                        />
                                      </label>
                                      <label className="text-sm text-emerald-50">
                                        Reps hechas
                                        <input
                                          value={recordForm.repeticiones}
                                          onChange={(e) => setRecordForm((prev) => ({ ...prev, repeticiones: e.target.value }))}
                                          inputMode="numeric"
                                          className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                                          placeholder="0"
                                        />
                                      </label>
                                      <label className="text-sm text-emerald-50">
                                        Peso (kg)
                                        <input
                                          value={recordForm.pesoKg}
                                          onChange={(e) => setRecordForm((prev) => ({ ...prev, pesoKg: e.target.value }))}
                                          inputMode="decimal"
                                          className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                                          placeholder="0"
                                        />
                                      </label>
                                      <label className="text-sm text-emerald-50 md:col-span-2">
                                        Comentarios
                                        <textarea
                                          value={recordForm.comentarios}
                                          onChange={(e) => setRecordForm((prev) => ({ ...prev, comentarios: e.target.value }))}
                                          rows={2}
                                          className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                                          placeholder="Sensaciones, tecnica, observaciones..."
                                        />
                                      </label>
                                      <label className="inline-flex items-center gap-2 text-sm text-emerald-50 md:col-span-2">
                                        <input
                                          type="checkbox"
                                          checked={recordForm.molestia}
                                          onChange={(e) => setRecordForm((prev) => ({ ...prev, molestia: e.target.checked }))}
                                          className="h-4 w-4"
                                        />
                                        Reportar molestia
                                      </label>
                                    </div>

                                    <ReliableActionButton
                                      type="button"
                                      onClick={handleSaveWorkoutRecord}
                                      className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400"
                                    >
                                      Guardar metrica
                                    </ReliableActionButton>

                                    {recordStatus ? <p className="mt-2 text-sm text-emerald-100">{recordStatus}</p> : null}
                                  </div>
                                ) : (
                                  <div className="mt-3 rounded-xl border border-white/15 bg-slate-950/45 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                                      Registros de este ejercicio
                                    </p>
                                    {selectedExerciseWorkoutLogs.length === 0 ? (
                                      <p className="mt-2 text-sm text-slate-300">
                                        Aun no hay registros para este ejercicio.
                                      </p>
                                    ) : (
                                      <div className="mt-2 space-y-2">
                                        {selectedExerciseWorkoutLogs.slice(0, 6).map((log) => (
                                          <div
                                            key={log.id}
                                            className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <p className="font-semibold text-white">
                                                {formatShortDate(log.fecha)} · {log.series} serie(s) · {log.repeticiones} reps · {log.pesoKg} kg
                                              </p>
                                              <ReliableActionButton
                                                type="button"
                                                onClick={() => handleDeleteWorkoutRecord(log.id)}
                                                className="rounded-md border border-rose-300/40 bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-100"
                                              >
                                                Eliminar
                                              </ReliableActionButton>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-300">
                                              Molestia: {log.molestia ? "Si" : "No"} · {formatDateTime(log.createdAt)}
                                            </p>
                                            {log.comentarios ? (
                                              <p className="mt-1 text-xs text-slate-300">{log.comentarios}</p>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                : null}
            </section>
          ) : null}

          {trainingView === "registros" ? (
            <section className="space-y-4">
              <article className="rounded-2xl border border-white/15 bg-slate-900/60 p-4">
                <h3 className="text-xl font-black text-white">Registros de entrenamiento</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Historial separado por semana, dia y ejercicio de la seleccion actual.
                </p>

                {groupedWorkoutLogs.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                    Sin registros para este dia.
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-4">
                      <div className="flex h-44 items-end gap-3">
                        {groupedWorkoutLogs.slice(-8).map((item) => {
                          const ratio = maxWorkoutWeight > 0 ? item.maxPeso / maxWorkoutWeight : 0;
                          const height = Math.max(10, Math.round(ratio * 140));

                          return (
                            <div key={item.fecha} className="flex min-w-[48px] flex-col items-center gap-2">
                              <div
                                className="w-10 rounded-md bg-gradient-to-t from-cyan-500 to-emerald-300"
                                style={{ height: `${height}px` }}
                                title={`${item.maxPeso} kg`}
                              />
                              <p className="text-[11px] text-slate-300">{formatShortDate(item.fecha)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {sessionWorkoutLogs.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-white">{formatShortDate(item.fecha)}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-300">{formatDateTime(item.createdAt)}</p>
                              <ReliableActionButton
                                type="button"
                                onClick={() => handleDeleteWorkoutRecord(item.id)}
                                className="rounded-md border border-rose-300/40 bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-100"
                              >
                                Eliminar
                              </ReliableActionButton>
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-4">
                            <p>Serie: {item.series}</p>
                            <p>Repeticiones: {item.repeticiones}</p>
                            <p>Peso: {item.pesoKg} kg</p>
                            <p>Molestia: {item.molestia ? "Si" : "No"}</p>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                            <p>Semana: {item.weekName || selectedWeek?.nombre || "-"}</p>
                            <p>Dia: {item.dayName || selectedDay?.dia || "-"}</p>
                            <p>Ejercicio: {item.exerciseName || "Sin detalle"}</p>
                          </div>
                          {item.comentarios ? <p className="mt-2 text-slate-300">{item.comentarios}</p> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            </section>
          ) : null}

          {latestFeedback ? (
            <article className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-emerald-50">
              <p className="text-xs uppercase tracking-wide text-emerald-200">Ultima evaluacion registrada</p>
              <p className="mt-1 text-sm">
                Exigencia {latestFeedback.effort}/10 · Cansancio {latestFeedback.fatigue}/10 · Estado {latestFeedback.mood}
              </p>
              <p className="text-xs text-emerald-100/90">
                {formatDateTime(latestFeedback.createdAt)} · Objetivo: {latestFeedback.goalResult}
              </p>
            </article>
          ) : null}

          {completionMessage ? (
            <article className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4 text-cyan-50">
              <p className="text-lg font-semibold">Sesion finalizada.</p>
              <p className="mt-2 text-sm">{completionMessage}</p>
            </article>
          ) : null}

          <ReliableActionButton
            type="button"
            onClick={openQuestionnaire}
            disabled={!routineEntryForLogs}
            className="w-full rounded-2xl bg-fuchsia-600 px-4 py-3 text-lg font-black text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Finalizar entrenamiento
          </ReliableActionButton>

          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3">
            <ReliableActionButton
              type="button"
              onClick={() => setShowInteractionPanel((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-xl border border-emerald-200/35 bg-emerald-950/45 px-3 py-2 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200/35 bg-emerald-500/20 text-emerald-100">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.94 0-3.73-.64-5.17-1.72L3 19l.9-4.08A8.5 8.5 0 1 1 21 11.5Z" />
                    <path d="M8.5 10.5h7" />
                    <path d="M8.5 13.5h4.5" />
                  </svg>
                </span>
                <span>
                  <p className="text-sm font-black text-white">Enviar solicitud al profesor</p>
                  <p className="text-xs text-emerald-100/85">
                    {showInteractionPanel ? "Ocultar opciones" : "Abrir opciones rapidas"}
                  </p>
                </span>
              </span>
              <span className="rounded-lg border border-emerald-200/35 bg-emerald-900/50 px-2 py-1 text-right">
                <span className="block text-[10px] uppercase tracking-[0.12em] text-emerald-100/85">Pend.</span>
                <span className="block text-base font-black text-white">{pendingInteractionCount}</span>
              </span>
            </ReliableActionButton>

            {showInteractionPanel ? (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <ReliableActionButton
                    type="button"
                    onClick={() => handleSendRoutineInteraction("cambio-rutina")}
                    className="rounded-xl border border-cyan-300/35 bg-cyan-500/15 p-3 text-left"
                  >
                    <p className="text-sm font-black text-white">Solicitar cambio de rutina</p>
                    <p className="mt-1 text-xs text-cyan-100">Ajustes por carga, tiempo o molestias.</p>
                  </ReliableActionButton>
                  <ReliableActionButton
                    type="button"
                    onClick={() => handleSendRoutineInteraction("ajuste-nutricion")}
                    className="rounded-xl border border-fuchsia-300/35 bg-fuchsia-500/15 p-3 text-left"
                  >
                    <p className="text-sm font-black text-white">Solicitar plan nutricional</p>
                    <p className="mt-1 text-xs text-fuchsia-100">Cambios de porciones, horarios o comidas.</p>
                  </ReliableActionButton>
                  <ReliableActionButton
                    type="button"
                    onClick={() => handleSendRoutineInteraction("pregunta-profesor")}
                    disabled={!canOpenProfessorWhatsApp}
                    className="rounded-xl border border-white/20 bg-slate-950/60 p-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <p className="text-sm font-black text-white">Pregunta al profesor (WhatsApp)</p>
                    <p className="mt-1 text-xs text-slate-300">
                      {canOpenProfessorWhatsApp
                        ? `Chat directo con ${profesorContacto?.nombre || "profesor"}.`
                        : "Sin numero de WhatsApp configurado."}
                    </p>
                  </ReliableActionButton>
                </div>

                {interactionStatus ? <p className="mt-3 text-xs text-emerald-100">{interactionStatus}</p> : null}
                {latestInteractionRequest ? (
                  <p className="mt-1 text-xs text-emerald-100/80">
                    Ultima solicitud: {latestInteractionRequest.title} · {formatDateTime(latestInteractionRequest.createdAt)}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {mountedCategories.nutricion ? (
        <section
          data-category="nutricion"
          className={`pf-alumno-stage-panel ${
            mainCategory === "nutricion"
              ? "pf-alumno-stage-active space-y-4 rounded-3xl border border-white/15 bg-slate-900/75 p-5"
              : "pf-alumno-stage-hidden"
          }`}
          aria-hidden={mainCategory !== "nutricion"}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Plan nutricional</h2>
              <p className="mt-1 text-sm text-slate-300">Objetivos, macros y comidas detalladas para tu plan actual.</p>
            </div>

            <div className="rounded-xl border border-white/15 bg-slate-900/50 p-2">
              <div className="flex gap-2">
                <ReliableActionButton
                  type="button"
                  onClick={() => setNutritionView("plan")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    nutritionView === "plan"
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-white/20 bg-white/5 text-slate-100"
                  }`}
                >
                  Plan
                </ReliableActionButton>
                <ReliableActionButton
                  type="button"
                  onClick={() => setNutritionView("recetas")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    nutritionView === "recetas"
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-white/20 bg-white/5 text-slate-100"
                  }`}
                >
                  Recetas
                </ReliableActionButton>
              </div>
            </div>
          </div>

          {!selectedNutritionPlan ? (
            <div className="rounded-2xl border border-white/15 bg-slate-900/60 p-5 text-sm text-slate-300">
              No tiene un plan de alimentacion activo.
            </div>
          ) : (
            <>
              {nutritionView === "plan" ? (
                <>
                  <article className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Plan activo</p>
                    <h3 className="mt-1 text-lg font-bold text-white">{selectedNutritionPlan.nombre || "Plan personalizado"}</h3>
                    <p className="mt-1 text-sm text-emerald-50/90">
                      Objetivo: {nutritionGoalLabel(selectedNutritionPlan.objetivo)} · Actualizado: {formatDateTime(selectedNutritionPlan.updatedAt)}
                    </p>
                    {selectedNutritionPlan.notas ? (
                      <p className="mt-2 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-slate-100">
                        {selectedNutritionPlan.notas}
                      </p>
                    ) : null}
                  </article>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Calorias" value={`${nutritionTargets.calorias || 0} kcal`} tone="cyan" />
                    <StatCard label="Proteinas" value={`${nutritionTargets.proteinas || 0} g`} tone="emerald" />
                    <StatCard label="Carbohidratos" value={`${nutritionTargets.carbohidratos || 0} g`} tone="fuchsia" />
                    <StatCard label="Grasas" value={`${nutritionTargets.grasas || 0} g`} />
                  </div>

                  <article className="rounded-2xl border border-white/15 bg-slate-900/60 p-4">
                    <h3 className="text-lg font-bold text-white">Ingesta estimada del plan</h3>
                    <p className="mt-2 text-sm text-slate-200">
                      {selectedNutritionIntake.calorias} kcal · {selectedNutritionIntake.proteinas} g pro · {selectedNutritionIntake.carbohidratos} g carb · {selectedNutritionIntake.grasas} g grasas
                    </p>
                  </article>
                </>
              ) : null}

              {nutritionView === "recetas" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {(selectedNutritionPlan.comidas || []).length === 0 ? (
                    <div className="rounded-2xl border border-white/15 bg-slate-900/60 p-5 text-sm text-slate-300">
                      No hay recetas o comidas cargadas todavia.
                    </div>
                  ) : (
                    (selectedNutritionPlan.comidas || []).map((comida) => (
                      <article
                        key={comida.id}
                        className="rounded-2xl border border-cyan-300/25 bg-cyan-500/5 p-4"
                      >
                        <h3 className="text-base font-bold text-white">{comida.nombre || "Comida"}</h3>
                        {(comida.items || []).length === 0 ? (
                          <p className="mt-2 text-sm text-slate-300">Sin alimentos cargados.</p>
                        ) : (
                          <ul className="mt-3 space-y-2 text-sm text-slate-200">
                            {(comida.items || []).map((item) => {
                              const food = nutritionFoodsById.get(String(item.foodId));
                              const gramos = Math.max(0, Number(item.gramos) || 0);
                              const kcal = food ? Math.round((food.kcalPer100g * gramos) / 100) : 0;

                              return (
                                <li
                                  key={item.id}
                                  className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/55 px-3 py-2"
                                >
                                  <span>{food?.nombre || "Alimento"}</span>
                                  <span className="text-xs text-slate-300">{gramos} g · {kcal} kcal</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </article>
                    ))
                  )}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {mountedCategories.progreso ? (
        <section
          data-category="progreso"
          className={`pf-alumno-stage-panel ${
            mainCategory === "progreso"
              ? "pf-alumno-stage-active space-y-4 rounded-3xl border border-white/15 bg-slate-900/75 p-5"
              : "pf-alumno-stage-hidden"
          }`}
          aria-hidden={mainCategory !== "progreso"}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Progreso</h2>
              <p className="mt-1 text-sm text-slate-300">
                Sigue tu progreso semanal de rutina y tus cambios corporales en antropometria.
              </p>
            </div>

            <div className="rounded-xl border border-white/15 bg-slate-900/50 p-2">
              <div className="flex gap-2">
                <ReliableActionButton
                  type="button"
                  onClick={() => setProgressView("semanal-rutina")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    progressView === "semanal-rutina"
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-white/20 bg-white/5 text-slate-100"
                  }`}
                >
                  Progreso semanal
                </ReliableActionButton>
                <ReliableActionButton
                  type="button"
                  onClick={() => setProgressView("antropometria")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    progressView === "antropometria"
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-white/20 bg-white/5 text-slate-100"
                  }`}
                >
                  Antropometria
                </ReliableActionButton>
              </div>
            </div>
          </div>

          {progressView === "semanal-rutina" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Semanas activas" value={String(weeklyProgressTotals.totalWeeks)} tone="cyan" />
                <StatCard label="Dias planificados" value={String(weeklyProgressTotals.totalDays)} tone="emerald" />
                <StatCard label="Dias con registro" value={String(weeklyProgressTotals.completedDays)} tone="fuchsia" />
                <StatCard label="Cumplimiento" value={`${weeklyProgressTotals.completionPct}%`} />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <article className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-300">Ultimo registro de rutina</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {weeklyProgressTotals.lastWorkoutAt
                      ? formatDateTime(weeklyProgressTotals.lastWorkoutAt)
                      : "Sin registros aun"}
                  </p>
                </article>
                <article className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-300">Ultima autoevaluacion</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {weeklyProgressTotals.lastFeedbackAt
                      ? formatDateTime(weeklyProgressTotals.lastFeedbackAt)
                      : "Sin evaluaciones aun"}
                  </p>
                </article>
              </div>

              {weeklyRoutineProgress.length === 0 ? (
                <div className="rounded-2xl border border-white/15 bg-slate-900/60 p-5 text-sm text-slate-300">
                  No hay una rutina semanal cargada para mostrar progreso.
                </div>
              ) : (
                <div className="space-y-3">
                  {weeklyRoutineProgress.map((week) => (
                    <article key={week.id} className="rounded-2xl border border-white/15 bg-slate-900/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-black text-white">{week.nombre}</h3>
                        <p className="text-sm text-cyan-100">
                          {week.completedDays}/{week.totalDays} dias con registro ({week.completionPct}%)
                        </p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                          style={{ width: `${week.completionPct}%` }}
                        />
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                        {week.dayProgress.map((day) => (
                          <div
                            key={day.id}
                            className={`rounded-lg border px-2 py-2 text-xs ${
                              day.hasLog
                                ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                                : "border-white/15 bg-slate-950/50 text-slate-300"
                            }`}
                          >
                            <p className="font-semibold">{day.dia}</p>
                            <p className="mt-1">{day.hasLog ? "Completado" : "Pendiente"}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <article className="rounded-2xl border border-white/15 bg-slate-900/60 p-4">
                <h3 className="text-lg font-black text-white">Ultimas evaluaciones de sesion</h3>
                {alumnoFeedbackHistory.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-300">Todavia no hay evaluaciones cargadas.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {alumnoFeedbackHistory.slice(0, 5).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-white/10 bg-slate-950/55 p-3 text-sm text-slate-200"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">{entry.sessionTitle}</p>
                          <p className="text-xs text-slate-300">{formatDateTime(entry.createdAt)}</p>
                        </div>
                        <p className="mt-2 text-xs text-slate-300">
                          Exigencia {entry.effort}/10 · Cansancio {entry.fatigue}/10 · Estado {entry.mood} · Objetivo {entry.goalResult}
                        </p>
                        {entry.comment ? <p className="mt-1 text-xs text-slate-300">{entry.comment}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">Antropometria del alumno</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Seguimiento de peso, medidas corporales y estado general.
                  </p>
                </div>
                <ReliableActionButton
                  type="button"
                  onClick={() => setShowAnthroForm((prev) => !prev)}
                  className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white"
                >
                  {showAnthroForm ? "Cerrar carga" : "Cargar medicion"}
                </ReliableActionButton>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Peso 7 dias" value={formatWeight(weight7Days)} tone="cyan" />
                <StatCard label="Peso 15 dias" value={formatWeight(weight15Days)} tone="emerald" />
                <StatCard label="Peso historico" value={formatWeight(weightHistoric)} tone="fuchsia" />
                <StatCard label="IMC" value={bmi === null ? "-" : bmi.toFixed(1)} />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-300">Edad</p>
                  <p className="text-2xl font-black text-white">{age === null ? "-" : `${age}`}</p>
                </article>
                <article className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-300">Altura</p>
                  <p className="text-2xl font-black text-white">{heightCm ? `${heightCm} cm` : "-"}</p>
                </article>
                <article className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-300">Telefono</p>
                  <p className="text-sm font-semibold text-white">{telefono}</p>
                </article>
                <article className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-300">Tendencia peso</p>
                  <p className="text-2xl font-black text-white">
                    {weightDelta === null ? "-" : `${weightDelta > 0 ? "+" : ""}${weightDelta} kg`}
                  </p>
                </article>
              </div>

              {showAnthroForm ? (
                <article className="rounded-2xl border border-cyan-300/25 bg-cyan-500/5 p-4">
                  <h3 className="text-lg font-black text-white">Nueva medicion antropometrica</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-sm text-slate-200">
                      Peso (kg)
                      <input
                        value={anthroForm.pesoKg}
                        onChange={(e) => setAnthroForm((prev) => ({ ...prev, pesoKg: e.target.value }))}
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Agua (litros)
                      <input
                        value={anthroForm.aguaLitros}
                        onChange={(e) => setAnthroForm((prev) => ({ ...prev, aguaLitros: e.target.value }))}
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Sueno (horas)
                      <input
                        value={anthroForm.suenoHoras}
                        onChange={(e) => setAnthroForm((prev) => ({ ...prev, suenoHoras: e.target.value }))}
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Actividad (1-10)
                      <input
                        value={anthroForm.actividadNivel}
                        onChange={(e) => setAnthroForm((prev) => ({ ...prev, actividadNivel: e.target.value }))}
                        inputMode="numeric"
                        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                      />
                    </label>

                    <label className="text-sm text-slate-200">
                      Cintura (cm)
                      <input
                        value={anthroForm.cinturaCm}
                        onChange={(e) => setAnthroForm((prev) => ({ ...prev, cinturaCm: e.target.value }))}
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Cadera (cm)
                      <input
                        value={anthroForm.caderaCm}
                        onChange={(e) => setAnthroForm((prev) => ({ ...prev, caderaCm: e.target.value }))}
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Grasa (%)
                      <input
                        value={anthroForm.grasaPct}
                        onChange={(e) => setAnthroForm((prev) => ({ ...prev, grasaPct: e.target.value }))}
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Musculo (%)
                      <input
                        value={anthroForm.musculoPct}
                        onChange={(e) => setAnthroForm((prev) => ({ ...prev, musculoPct: e.target.value }))}
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                      />
                    </label>

                    <label className="text-sm text-slate-200 md:col-span-2 xl:col-span-4">
                      Notas
                      <textarea
                        value={anthroForm.notas}
                        onChange={(e) => setAnthroForm((prev) => ({ ...prev, notas: e.target.value }))}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
                        placeholder="Observaciones sobre la evolucion..."
                      />
                    </label>
                  </div>

                  <ReliableActionButton
                    type="button"
                    onClick={handleSaveAnthropometry}
                    className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400"
                  >
                    Guardar medicion
                  </ReliableActionButton>
                </article>
              ) : null}

              {anthroStatus ? <p className="text-sm text-cyan-200">{anthroStatus}</p> : null}

              <article className="rounded-2xl border border-white/15 bg-slate-900/60 p-4">
                <h3 className="text-lg font-black text-white">Historial antropometrico</h3>
                {alumnoAnthropometry.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-300">No se encontraron datos.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {alumnoAnthropometry.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-white/10 bg-slate-950/55 p-3 text-sm text-slate-200"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">{formatDateTime(entry.createdAt)}</p>
                          <p className="text-xs text-slate-300">Peso: {formatWeight(entry.pesoKg)}</p>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-4">
                          <p>Agua: {entry.aguaLitros ?? "-"}</p>
                          <p>Sueno: {entry.suenoHoras ?? "-"}</p>
                          <p>Actividad: {entry.actividadNivel ?? "-"}</p>
                          <p>Grasa: {entry.grasaPct ?? "-"}</p>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <p>Cintura: {entry.cinturaCm ?? "-"} cm</p>
                          <p>Cadera: {entry.caderaCm ?? "-"} cm</p>
                        </div>
                        {entry.notas ? <p className="mt-2 text-slate-300">{entry.notas}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </>
          )}
        </section>
      ) : null}

      {mountedCategories.musica ? (
        <section
          data-category="musica"
          className={`pf-alumno-stage-panel ${
            mainCategory === "musica"
              ? "pf-alumno-stage-active space-y-4 rounded-3xl border border-white/15 bg-slate-900/75 p-5"
              : "pf-alumno-stage-hidden"
          }`}
          aria-hidden={mainCategory !== "musica"}
        >
          <div>
            <h2 className="text-2xl font-black">Playlists recomendadas</h2>
            <p className="mt-1 text-sm text-slate-300">Escucha las playlists sugeridas para tu entrenamiento y recuperacion.</p>
          </div>

          {musicAssignments.length === 0 ? (
            <div className="rounded-2xl border border-white/15 bg-slate-900/60 p-5 text-sm text-slate-300">
              Aun no tienes playlists asignadas.
            </div>
          ) : (
            <>
              <article className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-fuchsia-100/90">Reproductor recomendado</p>
                <h3 className="mt-1 text-xl font-black text-white">{musicAssignments[0].playlistName}</h3>
                <p className="mt-1 text-sm text-slate-200">
                  Objetivo: {musicAssignments[0].objetivo || "General"} · Dia: {musicAssignments[0].diaSemana || "Libre"}
                </p>
                <MusicPlayer item={musicAssignments[0]} />
              </article>

              <div className="grid gap-3 md:grid-cols-2">
                {musicAssignments.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/15 bg-slate-900/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-cyan-100">{getPlatformLabel(item.platform)}</p>
                        <h3 className="mt-1 text-lg font-bold text-white">{item.playlistName}</h3>
                        <p className="mt-1 text-sm text-slate-200">Objetivo: {item.objetivo || "General"}</p>
                        <p className="text-sm text-slate-200">Dia: {item.diaSemana || "Libre"}</p>
                        <p className="text-xs text-slate-300">Actualizada: {formatDateTime(item.createdAt)}</p>
                      </div>
                      <a
                        href={item.playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
                      >
                        Abrir
                      </a>
                    </div>

                    <MusicPlayer item={item} />

                    {item.recommendedSongTitle || item.recommendedSongArtist ? (
                      <p className="mt-3 rounded-lg border border-white/15 bg-slate-900/55 px-3 py-2 text-xs text-slate-200">
                        Tema sugerido: {item.recommendedSongTitle || "-"}
                        {item.recommendedSongArtist ? ` · ${item.recommendedSongArtist}` : ""}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}

      <nav
        className="pf-alumno-dock fixed inset-x-0 bottom-0 z-[95] px-2 xl:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.35rem)" }}
        aria-label="Navegacion principal del alumno"
      >
        <div className="mx-auto w-[min(95vw,360px)] rounded-2xl border border-slate-700 bg-slate-950/98 px-1.5 py-1.5">
          <div className="grid grid-cols-4 gap-1">
            {mobileDockItems.map((item) => {
              const isActive = mainCategory === item.id;

              return (
                <ReliableActionButton
                  key={item.id}
                  type="button"
                  onClick={() => goToAlumnoCategory(item.id)}
                  className={`rounded-xl border px-1 py-1.5 text-center ${
                    isActive
                      ? "border-cyan-200/65 bg-cyan-500/18"
                      : "border-white/12 bg-slate-900/75"
                  }`}
                >
                  <span
                    className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-black ${
                      isActive
                        ? "border-cyan-200/65 bg-cyan-500/32 text-cyan-50"
                        : "border-white/20 bg-white/5 text-slate-200"
                    }`}
                  >
                    {item.iconLabel}
                  </span>
                  <span className={`mt-0.5 block text-[10px] font-semibold leading-none ${isActive ? "text-cyan-100" : "text-slate-300"}`}>
                    {item.label}
                  </span>
                </ReliableActionButton>
              );
            })}
          </div>
        </div>
      </nav>

      {questionnaireOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-slate-900 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-3xl font-black text-white">Evaluacion de la sesion</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Completa estas preguntas para registrar como te sentiste al finalizar tu entrenamiento.
                </p>
              </div>
              <ReliableActionButton
                type="button"
                onClick={closeQuestionnaire}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-bold text-white"
              >
                Cerrar
              </ReliableActionButton>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-cyan-300/60">
              <div
                className="h-full bg-cyan-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <p className="mt-4 text-center text-lg text-slate-200">
              Pregunta {questionIndex + 1} de {SESSION_QUESTIONS.length}
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <h4 className="text-3xl font-black text-white">{activeQuestion.title}</h4>
              <p className="mt-2 text-sm text-slate-300">{activeQuestion.helper}</p>

              {activeQuestion.kind === "datetime" ? (
                <input
                  type="datetime-local"
                  value={sessionAnswers.trainedAt}
                  onChange={(e) =>
                    setSessionAnswers((prev) => ({ ...prev, trainedAt: e.target.value }))
                  }
                  className="mt-4 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-slate-100"
                />
              ) : null}

              {activeQuestion.kind === "scale" ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }).map((_, index) => {
                      const value = index + 1;
                      const selected =
                        activeQuestion.id === "effort"
                          ? sessionAnswers.effort === value
                          : sessionAnswers.fatigue === value;

                      return (
                        <ReliableActionButton
                          key={`${activeQuestion.id}-${value}`}
                          type="button"
                          onClick={() =>
                            setSessionAnswers((prev) =>
                              activeQuestion.id === "effort"
                                ? { ...prev, effort: value }
                                : { ...prev, fatigue: value }
                            )
                          }
                          className={`rounded-xl px-3 py-3 text-lg font-black ${
                            selected
                              ? "bg-cyan-500 text-white"
                              : "border border-white/20 bg-white/10 text-slate-100"
                          }`}
                        >
                          {value}
                        </ReliableActionButton>
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-xs text-slate-400">
                    <span>1 - Sin esfuerzo</span>
                    <span>10 - Maximo esfuerzo posible</span>
                  </div>
                </div>
              ) : null}

              {activeQuestion.kind === "choice" ? (
                <div className="mt-4 space-y-2">
                  {(activeQuestion.options || []).map((option) => {
                    const selected =
                      activeQuestion.id === "mood"
                        ? sessionAnswers.mood === option
                        : sessionAnswers.goalResult === option;

                    return (
                      <ReliableActionButton
                        key={`${activeQuestion.id}-${option}`}
                        type="button"
                        onClick={() =>
                          setSessionAnswers((prev) =>
                            activeQuestion.id === "mood"
                              ? { ...prev, mood: option }
                              : { ...prev, goalResult: option }
                          )
                        }
                        className={`w-full rounded-xl px-4 py-3 text-left text-lg font-bold ${
                          selected
                            ? "bg-cyan-500 text-white"
                            : "border border-white/20 bg-white/10 text-slate-100"
                        }`}
                      >
                        {option}
                      </ReliableActionButton>
                    );
                  })}
                </div>
              ) : null}

              {activeQuestion.kind === "text" ? (
                <textarea
                  value={sessionAnswers.comment}
                  onChange={(e) =>
                    setSessionAnswers((prev) => ({ ...prev, comment: e.target.value }))
                  }
                  rows={4}
                  className="mt-4 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-slate-100"
                  placeholder="Ej: No me senti con energia, me dolio el hombro, me gusto la rutina de hoy"
                />
              ) : null}
            </div>

            {questionError ? <p className="mt-3 text-sm text-rose-300">{questionError}</p> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <ReliableActionButton
                type="button"
                onClick={() => {
                  setQuestionError("");
                  setQuestionIndex((prev) => Math.max(0, prev - 1));
                }}
                disabled={questionIndex === 0}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Anterior
              </ReliableActionButton>

              <ReliableActionButton
                type="button"
                onClick={handleNextQuestion}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400"
              >
                {questionIndex === SESSION_QUESTIONS.length - 1 ? "Enviar" : "Siguiente"}
              </ReliableActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
