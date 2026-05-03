"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useAlumnos } from "@/components/AlumnosProvider";
import { useEjercicios } from "@/components/EjerciciosProvider";
import { useSessions } from "@/components/SessionsProvider";
import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";
import type {
  Alumno,
  BloqueEntrenamiento,
  PrescripcionSesionPersona,
  Sesion,
} from "@/data/mockData";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";

type MainCategory = "inicio" | "rutina" | "nutricion" | "progreso" | "musica";

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
};

type NutritionMeal = {
  id?: string;
  nombre?: string;
  items?: NutritionMealItem[];
};

type NutritionPlanLite = {
  id: string;
  nombre?: string;
  alumnoAsignado?: string | null;
  objetivo?: string;
  notas?: string;
  targets?: NutritionTargets;
  comidas?: NutritionMeal[];
  updatedAt?: string;
};

type NutritionAssignmentLite = {
  alumnoNombre?: string;
  planId?: string;
  assignedAt?: string;
};

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

type PostSessionFeedbackConfigLite = {
  enabled: boolean;
  title?: string;
  questions: PostSessionFeedbackQuestionLite[];
};

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
};

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const MUSIC_PLAYLISTS_KEY = "pf-control-music-playlists-v1";
const NUTRITION_PLANS_KEY = "pf-control-nutricion-planes-v1";
const NUTRITION_ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
const WEEK_PLAN_KEY = "pf-control-semana-plan";
const WORKOUT_LOGS_KEY = "pf-control-alumno-workout-logs-v1";
const ANTHROPOMETRY_KEY = "pf-control-alumno-antropometria-v1";
const ULTRA_MOBILE_INITIAL_BLOCKS = 1;
const ULTRA_MOBILE_ROUTINE_FALLBACK_SESSIONS = 2;
const ULTRA_MOBILE_STORAGE_REFRESH_MS = 6000;
const ROUTINE_DAY_WEEK_MIN_LOADING_MS = 2000;
const ROUTINE_PULL_THRESHOLD = 74;
const ROUTINE_PULL_MAX_DISTANCE = 120;
const MAX_WORKOUT_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024;
const DIRECT_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"];

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

function readArrayFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);

    const cached = STORAGE_ARRAY_CACHE.get(key);
    if (cached && cached.raw === raw) {
      return cached.parsed as T[];
    }

    if (!raw) {
      STORAGE_ARRAY_CACHE.set(key, { raw: null, parsed: [] });
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    const rows = Array.isArray(parsed) ? (parsed as T[]) : [];

    STORAGE_ARRAY_CACHE.set(key, {
      raw,
      parsed: Array.isArray(parsed) ? (parsed as unknown[]) : [],
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
  const [routineExerciseLogDraft, setRoutineExerciseLogDraft] = useState<RoutineExerciseLogDraft>(
    createRoutineExerciseLogDraft()
  );
  const [routineExerciseLogEditingId, setRoutineExerciseLogEditingId] = useState<string | null>(null);
  const [routineExerciseLogStatus, setRoutineExerciseLogStatus] = useState<string>("");
  const [routineExerciseLogView, setRoutineExerciseLogView] = useState<RoutineExerciseLogView>("registro");
  const [routineExerciseLogSaving, setRoutineExerciseLogSaving] = useState(false);
  const [accountProfile, setAccountProfile] = useState<AccountProfileLite | null>(null);
  const [coachContact, setCoachContact] = useState<CoachContactLite | null>(null);
  const [routineLastSyncAt, setRoutineLastSyncAt] = useState<number | null>(null);
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

  const [weekPlanStoreRaw, , weekPlanSyncLoaded] = useSharedState<unknown>(null, {
    key: WEEK_PLAN_KEY,
    legacyLocalStorageKey: WEEK_PLAN_KEY,
    pollMs: isUltraMobile ? 15000 : 12000,
  });

  const shouldLoadNutritionData = !isUltraMobile || activeCategory === "nutricion";
  const shouldLoadWorkoutData =
    !isUltraMobile || activeCategory === "progreso" || activeCategory === "rutina" || activeCategory === "inicio";
  const shouldLoadAnthropometryData = !isUltraMobile || activeCategory === "progreso" || activeCategory === "inicio";
  const shouldLoadMusicData = !isUltraMobile || activeCategory === "musica" || activeCategory === "inicio";

  useEffect(() => {
    if (!weekPlanSyncLoaded && !workoutLogsSyncLoaded) {
      return;
    }

    setRoutineLastSyncAt(Date.now());
  }, [weekPlanStoreRaw, weekPlanSyncLoaded, workoutLogsShared, workoutLogsSyncLoaded]);

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
    }
  }, [activeCategory]);

  useEffect(() => {
    return () => {
      if (routineDayWeekLoadingTimerRef.current !== null) {
        window.clearTimeout(routineDayWeekLoadingTimerRef.current);
        routineDayWeekLoadingTimerRef.current = null;
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

  const workoutLogs = useMemo<WorkoutLogLite[]>(() => {
    if (!shouldLoadWorkoutData) {
      return [];
    }

    return normalizeWorkoutLogsLiteRows(workoutLogsShared).filter((item) => {
      return matchIdentityName(item.alumnoNombre) || matchIdentityEmail(item.alumnoEmail);
    });
  }, [matchIdentityEmail, matchIdentityName, shouldLoadWorkoutData, workoutLogsShared]);

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

  const hasWeekPlanRoutine = routineWeeks.length > 0;

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
    const clienteMetaRows = readArrayFromStorage<ClienteMetaLite>(CLIENTE_META_KEY);
    const matchedMeta =
      clienteMetaRows.find(
        (row) =>
          matchIdentityEmail(row.email) ||
          matchIdentityName(row.nombre)
      ) || null;
    setClientMeta(matchedMeta);

    if (shouldLoadNutritionData) {
      const plans = readArrayFromStorage<NutritionPlanLite>(NUTRITION_PLANS_KEY);
      const assignments = readArrayFromStorage<NutritionAssignmentLite>(NUTRITION_ASSIGNMENTS_KEY).sort(
        (a, b) => getTimestamp(b.assignedAt) - getTimestamp(a.assignedAt)
      );

      const matchedAssignment = assignments.find((item) => matchIdentityName(item.alumnoNombre));

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
    matchIdentityEmail,
    matchIdentityName,
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

    if (shouldLoadNutritionData) {
      trackedKeys.add(NUTRITION_PLANS_KEY);
      trackedKeys.add(NUTRITION_ASSIGNMENTS_KEY);
    }

    if (shouldLoadAnthropometryData) {
      trackedKeys.add(ANTHROPOMETRY_KEY);
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

  const routineLastSyncLabel = useMemo(() => {
    if (!routineLastSyncAt) {
      return "Ultima sincronizacion: pendiente";
    }

    return `Ultima sincronizacion: ${formatDateTime(new Date(routineLastSyncAt))} hs`;
  }, [routineLastSyncAt]);

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

  const isRoutineFullyExpanded = useMemo(() => {
    if (!selectedRoutineEntry || selectedRoutineEntry.blocks.length === 0) {
      return false;
    }

    return selectedRoutineEntry.blocks.every((block) => {
      const blockKey = `${selectedRoutineEntry.sesion.id}-${block.id}`;
      return Boolean(expandedRoutineBlocks[blockKey]);
    });
  }, [expandedRoutineBlocks, selectedRoutineEntry]);

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

  const handleRoutineRefresh = useCallback(() => {
    triggerRoutineRefresh();
  }, [triggerRoutineRefresh]);

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

  const handleRoutineToggleAll = useCallback(() => {
    if (!selectedRoutineEntry) return;

    const shouldExpand = !isRoutineFullyExpanded;
    const nextState: Record<string, boolean> = {};

    selectedRoutineEntry.blocks.forEach((block) => {
      nextState[`${selectedRoutineEntry.sesion.id}-${block.id}`] = shouldExpand;
    });

    setExpandedRoutineBlocks((previous) => ({
      ...previous,
      ...nextState,
    }));
  }, [isRoutineFullyExpanded, selectedRoutineEntry]);

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
      key: "progreso",
      label: "Control",
      icon: (
        <svg viewBox="0 0 24 24" className="pf-a2-dock-icon" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M5 17.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" strokeLinecap="round" />
          <path d="M8.5 10a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  const isRoutineLogPanelOpen = Boolean(routineExerciseLogTarget);

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
                      onClick={handleRoutineRefresh}
                      onPointerUp={() => handleRoutineRefresh()}
                      className="pf-a3-routine-icon-btn"
                      aria-label="Recargar plan"
                      title="Recargar plan"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M20 12a8 8 0 1 1-2.34-5.66" strokeLinecap="round" />
                        <path d="M20 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ReliableActionButton>

                    <ReliableActionButton
                      type="button"
                      onClick={handleRoutineToggleAll}
                      className="pf-a3-routine-icon-btn"
                      aria-label={isRoutineFullyExpanded ? "Contraer bloques" : "Expandir bloques"}
                      title={isRoutineFullyExpanded ? "Contraer bloques" : "Expandir bloques"}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M8 7h8M8 12h8M8 17h8" strokeLinecap="round" />
                        <path d="m5 7 1 1 2-2M5 12l1 1 2-2M5 17l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ReliableActionButton>

                    <ReliableActionButton
                      type="button"
                      onClick={() => goToCategory("progreso")}
                      onPointerUp={() => goToCategory("progreso")}
                      data-nav-href="/alumnos/progreso"
                      className="pf-a3-routine-icon-btn"
                      aria-label="Ir a progreso"
                      title="Ir a progreso"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <circle cx="12" cy="12" r="8" />
                        <path d="M12 8v4l2.6 1.8" strokeLinecap="round" strokeLinejoin="round" />
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
                  <h2>{hasWeekPlanRoutine ? "Sin bloques para este dia" : "No hay sesiones cargadas"}</h2>
                  <p>
                    {hasWeekPlanRoutine
                      ? "Tu profe aun no cargo ejercicios en este dia. Cambia de dia o actualiza para sincronizar."
                      : "Cuando tu profe asigne una sesion, la rutina aparecera aca automaticamente."}
                  </p>
                </section>
              ) : (
                <article key={selectedRoutineEntry.sesion.id} className="pf-a3-routine-session-card">
                  <div className="pf-a3-routine-block-stack">
                    {routineVisibleBlocks.map((block, blockIndex) => {
                      const blockKey = `${selectedRoutineEntry.sesion.id}-${block.id}`;
                      const isExpanded = !isUltraMobile || Boolean(expandedRoutineBlocks[blockKey]);
                      const visibleExercises = isExpanded ? block.ejercicios : [];
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

                          {isUltraMobile && block.ejercicios.length > 0 ? (
                            <ReliableActionButton
                              type="button"
                              onClick={() => toggleRoutineBlock(blockKey)}
                              className="pf-a3-routine-toggle"
                            >
                              {isExpanded ? "Ocultar ejercicios" : `Ver ejercicios (${block.ejercicios.length})`}
                            </ReliableActionButton>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>

                  {isUltraMobile && routineRemainingBlocks > 0 ? (
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
                    className={`pf-a3-routine-log-panel ${
                      isUltraMobile ? "pf-a3-routine-log-panel-mobile" : ""
                    } ${
                      routineExerciseVideoSource.kind !== "none" ? "pf-a3-routine-log-panel-has-video" : ""
                    }`}
                  >
                    <div className="pf-a3-routine-log-head">
                      <div className="min-w-0">
                        <p className="pf-a3-routine-log-kicker">Registrar carga</p>
                        <h3 className="pf-a3-routine-log-title">{routineExerciseLogTarget.exerciseName}</h3>
                        <p className="pf-a3-routine-log-meta">
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
                  </article>
                </div>,
                document.body
              )
                : null}
            </div>
          ) : null}

          {activeCategory === "nutricion" ? (
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                <p className="pf-a2-eyebrow">Plan asignado</p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {nutritionPlan?.nombre || "Sin plan cargado"}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  Objetivo: {nutritionPlan?.objetivo || clientMeta?.objNutricional || "No definido"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Ultima asignacion: {nutritionAssignedAt ? formatDateTime(nutritionAssignedAt) : "-"}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="pf-a2-kpi rounded-xl border p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Calorias objetivo</p>
                    <p className="mt-1 text-lg font-black text-white">
                      {toNumber(nutritionTargets?.calorias) || 0} kcal
                    </p>
                  </div>
                  <div className="pf-a2-kpi rounded-xl border p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Comidas</p>
                    <p className="mt-1 text-lg font-black text-white">
                      {Array.isArray(nutritionPlan?.comidas) ? nutritionPlan?.comidas.length : 0}
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

                {nutritionPlan?.notas ? (
                  <div className="pf-a2-drawer mt-4 rounded-xl border border-slate-500/45 bg-slate-900/40 p-3 text-sm text-slate-200">
                    {nutritionPlan.notas}
                  </div>
                ) : null}
              </article>

              <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
                <p className="pf-a2-eyebrow">Distribucion</p>
                <h2 className="mt-1 text-xl font-black text-white">Comidas del plan</h2>

                {Array.isArray(nutritionPlan?.comidas) && nutritionPlan.comidas.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {nutritionPlan.comidas.map((meal, index) => (
                      <section
                        key={meal.id || `${meal.nombre || "meal"}-${index}`}
                        className="pf-a2-kpi rounded-xl border p-3"
                      >
                        <h3 className="text-sm font-black text-slate-100">
                          {meal.nombre || `Comida ${index + 1}`}
                        </h3>
                        <div className="mt-2 space-y-1">
                          {(meal.items || []).map((item, itemIndex) => {
                            const label = item.nombre || item.foodId || `Item ${itemIndex + 1}`;
                            const grams = toNumber(item.gramos);

                            return (
                              <p key={`${meal.id || index}-${item.id || itemIndex}`} className="text-xs text-slate-300">
                                {label}
                                {grams !== null ? ` · ${grams} g` : ""}
                              </p>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="pf-a2-drawer mt-4 rounded-xl border border-slate-500/45 bg-slate-900/40 p-4 text-sm text-slate-300">
                    Aun no tienes comidas cargadas en tu plan. Pide a tu profe que te asigne una version actualizada.
                  </div>
                )}

              </article>
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