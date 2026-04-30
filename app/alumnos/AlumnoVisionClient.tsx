"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useAlumnos } from "@/components/AlumnosProvider";
import { useEjercicios } from "@/components/EjerciciosProvider";
import { useSessions } from "@/components/SessionsProvider";
import { useSharedState } from "@/components/useSharedState";
import type {
  Alumno,
  BloqueEntrenamiento,
  Ejercicio,
  PrescripcionSesionPersona,
  Sesion,
} from "@/data/mockData";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  sessionTitle?: string;
  blockTitle?: string;
  exerciseName?: string;
  fecha?: string;
  createdAt?: string;
  series?: number;
  repeticiones?: number;
  pesoKg?: number;
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

type PaymentBadgeTone = "ok" | "warning" | "danger" | "neutral";

const CATEGORIES: MainCategory[] = ["inicio", "rutina", "nutricion", "progreso", "musica"];

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
    subtitle: "Resumen de hoy, estado de pago y atajos rapidos.",
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
const WORKOUT_LOGS_KEY = "pf-control-alumno-workout-logs-v1";
const ANTHROPOMETRY_KEY = "pf-control-alumno-antropometria-v1";
const ULTRA_MOBILE_INITIAL_BLOCKS = 1;
const ULTRA_MOBILE_ROUTINE_FALLBACK_SESSIONS = 2;
const ULTRA_MOBILE_STORAGE_REFRESH_MS = 6000;
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

function resolvePaymentBadge(meta: ClienteMetaLite | null): {
  tone: PaymentBadgeTone;
  label: string;
  detail: string;
} {
  if (!meta) {
    return {
      tone: "neutral",
      label: "Sin ficha",
      detail: "No encontramos una ficha de pago vinculada a tu cuenta.",
    };
  }

  const status = String(meta.pagoEstado || "").trim().toLowerCase();
  const endDate = parseDateValue(meta.endDate);
  const now = Date.now();
  const isExpired = Boolean(endDate && endDate.getTime() < now);
  const isActiveByDate = Boolean(endDate && endDate.getTime() >= now);

  if (isExpired) {
    return {
      tone: "danger",
      label: "Vencido",
      detail: `Tu pase vencio el ${formatDate(meta.endDate)}.`,
    };
  }

  if (status.includes("pend") || status.includes("proceso")) {
    return {
      tone: "warning",
      label: "Pendiente",
      detail: "Tu pago esta pendiente de confirmacion.",
    };
  }

  if (status.includes("aprob") || status.includes("activo") || isActiveByDate) {
    return {
      tone: "ok",
      label: "Al dia",
      detail: endDate
        ? `Pase activo hasta ${formatDate(meta.endDate)}.`
        : "Tu pase se encuentra activo.",
    };
  }

  return {
    tone: "neutral",
    label: "A revisar",
    detail: "Tu estado de pago necesita revision.",
  };
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
  const { alumnos } = useAlumnos();
  const { sesiones } = useSessions();
  const { ejercicios } = useEjercicios();

  const [activeCategory, setActiveCategory] = useState<MainCategory>(initialCategory);
  const [clientMeta, setClientMeta] = useState<ClienteMetaLite | null>(null);
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlanLite | null>(null);
  const [nutritionAssignedAt, setNutritionAssignedAt] = useState<string | null>(null);
  const [selectedMusicAssignmentId, setSelectedMusicAssignmentId] = useState<string | null>(null);
  const [musicArtworkByUrl, setMusicArtworkByUrl] = useState<Record<string, string>>({});
  const [musicNameByUrl, setMusicNameByUrl] = useState<Record<string, string>>({});
  const [musicContentTypeByUrl, setMusicContentTypeByUrl] = useState<Record<string, MusicContentType>>({});
  const [musicCoachLine, setMusicCoachLine] = useState<string>(resolveRandomMusicCoachLine(currentName || ""));
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogLite[]>([]);
  const [anthropometryEntries, setAnthropometryEntries] = useState<AnthropometryEntryLite[]>([]);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [selectedRoutineSessionId, setSelectedRoutineSessionId] = useState<string | null>(null);
  const [expandedRoutineBlocks, setExpandedRoutineBlocks] = useState<Record<string, boolean>>({});
  const [visibleRoutineBlockCount, setVisibleRoutineBlockCount] = useState<number>(ULTRA_MOBILE_INITIAL_BLOCKS);
  const [accountProfile, setAccountProfile] = useState<AccountProfileLite | null>(null);
  const [coachContact, setCoachContact] = useState<CoachContactLite | null>(null);
  const storageRefreshRafRef = useRef<number | null>(null);
  const storageRefreshIdleRef = useRef<number | null>(null);
  const lastStorageRefreshTsRef = useRef<number>(0);
  const requestedMusicArtworkRef = useRef<Set<string>>(new Set());

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

  const shouldLoadNutritionData = !isUltraMobile || activeCategory === "nutricion";
  const shouldLoadWorkoutData = !isUltraMobile || activeCategory === "progreso";
  const shouldLoadAnthropometryData = !isUltraMobile || activeCategory === "progreso" || activeCategory === "inicio";
  const shouldLoadMusicData = !isUltraMobile || activeCategory === "musica" || activeCategory === "inicio";

  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (!isUltraMobile || typeof document === "undefined") return;

    const root = document.documentElement;
    root.classList.add("pf-mobile-webview");
    root.classList.add("pf-mobile-fluid");
  }, [isUltraMobile]);

  useEffect(() => {
    if (activeCategory !== "rutina") {
      setSelectedRoutineSessionId(null);
      setExpandedRoutineBlocks({});
      setVisibleRoutineBlockCount(ULTRA_MOBILE_INITIAL_BLOCKS);
    }
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
        sessions: effectiveRoutineSessions.length,
        blocks: 0,
        exercises: 0,
      };
    }

    const totalBlocks = effectiveRoutineSessions.reduce((count, sesion) => {
      const prescripciones = Array.isArray(sesion.prescripciones) ? sesion.prescripciones : [];
      const matchedPrescripcion =
        prescripciones.find((item) => item.personaTipo === "alumnos" && matchIdentityName(item.personaNombre)) ||
        null;

      const sourceBlocks =
        matchedPrescripcion && Array.isArray(matchedPrescripcion.bloques) && matchedPrescripcion.bloques.length > 0
          ? matchedPrescripcion.bloques
          : Array.isArray(sesion.bloques)
          ? sesion.bloques
          : [];

      return count + sourceBlocks.length;
    }, 0);

    const totalExercises = effectiveRoutineSessions.reduce((count, sesion) => {
      const prescripciones = Array.isArray(sesion.prescripciones) ? sesion.prescripciones : [];
      const matchedPrescripcion =
        prescripciones.find((item) => item.personaTipo === "alumnos" && matchIdentityName(item.personaNombre)) ||
        null;

      const sourceBlocks =
        matchedPrescripcion && Array.isArray(matchedPrescripcion.bloques) && matchedPrescripcion.bloques.length > 0
          ? matchedPrescripcion.bloques
          : Array.isArray(sesion.bloques)
          ? sesion.bloques
          : [];

      return count + sourceBlocks.reduce((blockCount, block) => blockCount + (block.ejercicios?.length || 0), 0);
    }, 0);

    return {
      sessions: effectiveRoutineSessions.length,
      blocks: totalBlocks,
      exercises: totalExercises,
    };
  }, [activeCategory, effectiveRoutineSessions, isUltraMobile, matchIdentityName]);

  useEffect(() => {
    if (activeCategory !== "rutina" || !isUltraMobile) return;

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
  }, [activeCategory, effectiveRoutineSessions, isUltraMobile]);

  useEffect(() => {
    if (activeCategory !== "rutina" || !isUltraMobile) return;
    setVisibleRoutineBlockCount(ULTRA_MOBILE_INITIAL_BLOCKS);
    setExpandedRoutineBlocks({});
  }, [activeCategory, isUltraMobile, selectedRoutineSessionId]);

  const routineSessionsForDetails = useMemo(() => {
    if (activeCategory !== "rutina") return [];

    if (!isUltraMobile) {
      return effectiveRoutineSessions;
    }

    if (!selectedRoutineSessionId) {
      return effectiveRoutineSessions.slice(0, 1);
    }

    const selectedSession = effectiveRoutineSessions.find((session) => session.id === selectedRoutineSessionId);
    return selectedSession ? [selectedSession] : effectiveRoutineSessions.slice(0, 1);
  }, [activeCategory, effectiveRoutineSessions, isUltraMobile, selectedRoutineSessionId]);

  const routineEntries = useMemo<RoutineEntry[]>(() => {
    if (activeCategory !== "rutina") return [];

    return routineSessionsForDetails.map((sesion) => {
      const prescripciones = Array.isArray(sesion.prescripciones) ? sesion.prescripciones : [];
      const matchedPrescripcion =
        prescripciones.find((item) => item.personaTipo === "alumnos" && matchIdentityName(item.personaNombre)) ||
        null;

      const sourceBlocks =
        matchedPrescripcion && Array.isArray(matchedPrescripcion.bloques) && matchedPrescripcion.bloques.length > 0
          ? matchedPrescripcion.bloques
          : Array.isArray(sesion.bloques)
          ? sesion.bloques
          : [];

      const blocks: RoutineBlock[] = sourceBlocks.map((block) => ({
        ...block,
        ejercicios: Array.isArray(block.ejercicios) ? block.ejercicios : [],
      }));

      const totalExercises = blocks.reduce((count, block) => count + block.ejercicios.length, 0);

      return {
        sesion,
        prescripcion: matchedPrescripcion,
        blocks,
        totalExercises,
      };
    });
  }, [activeCategory, matchIdentityName, routineSessionsForDetails]);

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

    if (shouldLoadWorkoutData) {
      const logRows = readArrayFromStorage<WorkoutLogLite>(WORKOUT_LOGS_KEY)
        .filter((item) => matchIdentityName(item.alumnoNombre))
        .sort((a, b) => {
          const left = getTimestamp(a.createdAt || a.fecha);
          const right = getTimestamp(b.createdAt || b.fecha);
          return right - left;
        });
      setWorkoutLogs(logRows);
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
    shouldLoadWorkoutData,
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

    if (shouldLoadWorkoutData) {
      trackedKeys.add(WORKOUT_LOGS_KEY);
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
    shouldLoadWorkoutData,
  ]);


  const paymentBadge = useMemo(() => resolvePaymentBadge(clientMeta), [clientMeta]);

  const paymentHomeSummary = useMemo(() => {
    const hasPaymentLabel =
      paymentBadge.tone === "ok" ? "Si, activo" : paymentBadge.tone === "warning" ? "En proceso" : "No";

    const actionLabel =
      paymentBadge.tone === "ok"
        ? "Sin deuda"
        : paymentBadge.tone === "warning"
        ? "Confirmar pago"
        : paymentBadge.tone === "danger"
        ? "Pagar ahora"
        : "Regularizar ficha";

    const actionDetail =
      paymentBadge.tone === "ok"
        ? "Tu pase esta habilitado para entrenar."
        : paymentBadge.tone === "warning"
        ? "Tu pago esta en validacion."
        : paymentBadge.tone === "danger"
        ? "Debes pagar para mantener el acceso."
        : "Aun no hay una ficha de pago activa.";

    return {
      hasPaymentLabel,
      lastPaymentLabel: formatDate(clientMeta?.startDate),
      dueDateLabel: formatDate(clientMeta?.endDate),
      actionLabel,
      actionDetail,
    };
  }, [clientMeta?.endDate, clientMeta?.startDate, paymentBadge.tone]);

  const paymentActionToneClass =
    paymentBadge.tone === "ok"
      ? "pf-a3-status-item-ok"
      : paymentBadge.tone === "danger"
      ? "pf-a3-status-item-danger"
      : "pf-a3-status-item-warning";

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
  const heroSubtitle = `Vista ${categoryMeta.short.toLowerCase()}. Usa la flecha para volver al inicio.`;

  const goToCategory = useCallback(
    (nextCategory: MainCategory) => {
      if (nextCategory === activeCategory) return;
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
    [activeCategory, router]
  );

  const goToHomeCategory = useCallback(() => {
    goToCategory("inicio");
  }, [goToCategory]);

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

    // WebView fallback: if router navigation is swallowed, force a hard navigation.
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

    router.prefetch("/alumnos/pagos");
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

  return (
    <main className="pf-alumno-main pf-alumno-v2">
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
                  onClick={goToHomeCategory}
                  onPointerUp={() => goToHomeCategory()}
                  data-nav-href="/alumnos/inicio"
                  className="pf-a2-back-btn mt-0.5"
                  aria-label="Volver al inicio"
                  title="Volver al inicio"
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
                  <span className="sr-only">Volver al inicio</span>
                </ReliableActionButton>

                <div className="min-w-0">
                  <p className="pf-a2-eyebrow break-words">{categoryMeta.badge}</p>
                  <h1 className="mt-1 break-words text-[clamp(1.35rem,4vw,2.35rem)] font-black leading-tight text-white">
                    {heroTitle}
                  </h1>
                  <p className="mt-2 max-w-2xl break-words text-sm text-slate-300">{heroSubtitle}</p>
                </div>
              </div>

              {activeCategory !== "musica" ? (
                <div className="flex max-w-full flex-wrap items-center gap-2">
                  <span className={`pf-a2-badge pf-a2-badge-${paymentBadge.tone}`}>
                    Estado pago: {paymentBadge.label}
                  </span>
                  <ReliableActionButton
                    type="button"
                    onClick={openPayments}
                    onPointerUp={() => openPayments()}
                    data-nav-href="/alumnos/pagos"
                    className="pf-a2-ghost-btn rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em]"
                  >
                    Pagos
                  </ReliableActionButton>
                </div>
              ) : null}
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
                <ReliableActionButton
                  type="button"
                  onClick={openPayments}
                  onPointerUp={() => openPayments()}
                  data-nav-href="/alumnos/pagos"
                  className="pf-a3-main-action-btn"
                >
                  Controles
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

              <section className="pf-a3-panel-block pf-a3-panel-block-pagos">
                <div className="pf-a3-section-head">
                  <h2 className="pf-a3-section-title">Pagos</h2>
                  <ReliableActionButton
                    type="button"
                    onClick={openPayments}
                    onPointerUp={() => openPayments()}
                    data-nav-href="/alumnos/pagos"
                    className="pf-a3-link-btn"
                    aria-label="Ir a pagos"
                    title="Pagos"
                  >
                    Gestionar
                  </ReliableActionButton>
                </div>

                <div className="pf-a3-status-grid">
                  <article className={`pf-a3-status-item pf-a3-status-item-${paymentBadge.tone}`}>
                    <p className="pf-a3-status-kicker">Estado</p>
                    <p className="pf-a3-status-value">{paymentBadge.label}</p>
                    <p className="pf-a3-status-detail">{paymentBadge.detail}</p>
                  </article>

                  <article className="pf-a3-status-item">
                    <p className="pf-a3-status-kicker">Tiene pago</p>
                    <p className="pf-a3-status-value">{paymentHomeSummary.hasPaymentLabel}</p>
                    <p className="pf-a3-status-detail">Ultimo pago: {paymentHomeSummary.lastPaymentLabel}</p>
                  </article>

                  <article className="pf-a3-status-item">
                    <p className="pf-a3-status-kicker">Vencimiento</p>
                    <p className="pf-a3-status-value">{paymentHomeSummary.dueDateLabel}</p>
                    <p className="pf-a3-status-detail">Plan: {coachPlanLabel}</p>
                  </article>

                  <article className={`pf-a3-status-item ${paymentActionToneClass}`}>
                    <p className="pf-a3-status-kicker">Accion</p>
                    <p className="pf-a3-status-value">{paymentHomeSummary.actionLabel}</p>
                    <p className="pf-a3-status-detail">{paymentHomeSummary.actionDetail}</p>
                  </article>
                </div>
              </section>
            </div>
          ) : null}

          {activeCategory === "rutina" ? (
            <div className="pf-a3-routine-shell">
              <section className="pf-a3-routine-overview">
                <div className="pf-a3-routine-overview-head">
                  <div>
                    <p className="pf-a3-routine-overview-kicker">Training Template</p>
                    <h2 className="pf-a3-routine-overview-title">Rutina semanal estilo Mynter</h2>
                    <p className="pf-a3-routine-overview-subtitle">
                      Vista organizada por sesiones y bloques para seguir cada ejercicio sin perder foco.
                    </p>
                  </div>
                  <span className="pf-a3-routine-overview-chip">{routineSummary.sessions} sesiones activas</span>
                </div>

                <div className="pf-a3-routine-kpi-grid">
                  <article className="pf-a3-routine-kpi">
                    <p className="pf-a3-routine-kpi-label">Sesiones</p>
                    <p className="pf-a3-routine-kpi-value">{routineSummary.sessions}</p>
                  </article>
                  <article className="pf-a3-routine-kpi">
                    <p className="pf-a3-routine-kpi-label">Bloques</p>
                    <p className="pf-a3-routine-kpi-value">{routineSummary.blocks}</p>
                  </article>
                  <article className="pf-a3-routine-kpi">
                    <p className="pf-a3-routine-kpi-label">Ejercicios</p>
                    <p className="pf-a3-routine-kpi-value">{routineSummary.exercises}</p>
                  </article>
                </div>
              </section>

              {isUltraMobile && effectiveRoutineSessions.length > 1 ? (
                <section className="pf-a3-routine-session-strip">
                  <p className="pf-a3-routine-session-strip-title">Sesion activa</p>
                  <div className="pf-a3-routine-session-scroll">
                    {effectiveRoutineSessions.map((session, index) => {
                      const isSelected = session.id === selectedRoutineSessionId;

                      return (
                        <ReliableActionButton
                          key={`session-chip-${session.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedRoutineSessionId(session.id);
                            setExpandedRoutineBlocks({});
                            setVisibleRoutineBlockCount(ULTRA_MOBILE_INITIAL_BLOCKS);
                          }}
                          className={`pf-a3-routine-session-chip ${
                            isSelected ? "pf-a3-routine-session-chip-active" : ""
                          }`}
                        >
                          <span>{index + 1}.</span>
                          <span>{session.titulo || "Sesion"}</span>
                        </ReliableActionButton>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {routineEntries.length === 0 ? (
                <section className="pf-a3-routine-empty">
                  <h2>No hay sesiones cargadas</h2>
                  <p>Cuando tu profe asigne una sesion, la rutina aparecera aca automaticamente.</p>
                </section>
              ) : (
                <>
                  {routineEntries.map((entry) => {
                    const visibleBlocks = isUltraMobile
                      ? entry.blocks.slice(0, Math.max(1, visibleRoutineBlockCount))
                      : entry.blocks;
                    const remainingBlocks = Math.max(0, entry.blocks.length - visibleBlocks.length);

                    return (
                      <article key={entry.sesion.id} className="pf-a3-routine-session-card">
                        <div className="pf-a3-routine-session-head">
                          <div>
                            <p className="pf-a3-routine-session-kicker">
                              {entry.prescripcion ? "Ajustada por tu profe" : "Base del plan"}
                            </p>
                            <h2 className="pf-a3-routine-session-title">{entry.sesion.titulo || "Sesion"}</h2>
                            <p className="pf-a3-routine-session-goal">
                              {entry.sesion.objetivo || "Sin objetivo cargado"}
                            </p>
                          </div>

                          <div className="pf-a3-routine-session-pills">
                            <span className="pf-a3-routine-meta-pill">{entry.blocks.length} bloques</span>
                            <span className="pf-a3-routine-meta-pill">{entry.totalExercises} ejercicios</span>
                            <span className="pf-a3-routine-meta-pill">{entry.sesion.duracion || "-"} min</span>
                          </div>
                        </div>

                        <div className="pf-a3-routine-block-stack">
                          {visibleBlocks.map((block, blockIndex) => {
                            const blockKey = `${entry.sesion.id}-${block.id}`;
                            const isExpanded = !isUltraMobile || Boolean(expandedRoutineBlocks[blockKey]);
                            const visibleExercises = isExpanded ? block.ejercicios : [];

                            return (
                              <section key={blockKey} className="pf-a3-routine-block">
                                <div className="pf-a3-routine-block-head">
                                  <div>
                                    <p className="pf-a3-routine-block-kicker">Bloque {blockIndex + 1}</p>
                                    <h3 className="pf-a3-routine-block-title">{block.titulo}</h3>
                                  </div>
                                  <span className="pf-a3-routine-block-count">{block.ejercicios.length} ejercicios</span>
                                </div>

                                <p className="pf-a3-routine-block-goal">{block.objetivo || "Sin objetivo"}</p>

                                {visibleExercises.length > 0 ? (
                                  <div className="pf-a3-routine-exercise-list">
                                    {visibleExercises.map((exercise, index) => {
                                      const exerciseDetail = exercise.ejercicioId
                                        ? ejerciciosById.get(exercise.ejercicioId) || null
                                        : null;
                                      const metricsLabel =
                                        Array.isArray(exercise.metricas) && exercise.metricas.length > 0
                                          ? exercise.metricas
                                              .map((metric) => `${metric.nombre}: ${metric.valor}`)
                                              .join(" · ")
                                          : "";

                                      return (
                                        <article
                                          key={`${block.id}-${exercise.ejercicioId || index}`}
                                          className="pf-a3-routine-exercise-row"
                                        >
                                          <div className="pf-a3-routine-exercise-main">
                                            <span className="pf-a3-routine-exercise-index">{index + 1}</span>
                                            <div className="min-w-0">
                                              <p className="pf-a3-routine-exercise-name">
                                                {exerciseDetail?.nombre || `Ejercicio ${index + 1}`}
                                              </p>
                                              <p className="pf-a3-routine-exercise-desc">
                                                {exerciseDetail?.objetivo ||
                                                  exerciseDetail?.categoria ||
                                                  "Ejecuta con tecnica y control."}
                                              </p>
                                            </div>
                                          </div>

                                          <div className="pf-a3-routine-exercise-tags">
                                            <span className="pf-a3-routine-exercise-tag">{exercise.series} series</span>
                                            <span className="pf-a3-routine-exercise-tag">
                                              {exercise.repeticiones || "-"} reps
                                            </span>
                                            {exercise.descanso ? (
                                              <span className="pf-a3-routine-exercise-tag">
                                                Descanso {exercise.descanso}
                                              </span>
                                            ) : null}
                                            {exercise.carga ? (
                                              <span className="pf-a3-routine-exercise-tag">Carga {exercise.carga}</span>
                                            ) : null}
                                          </div>

                                          {metricsLabel ? (
                                            <p className="pf-a3-routine-exercise-metrics">{metricsLabel}</p>
                                          ) : null}

                                          {exercise.observaciones ? (
                                            <p className="pf-a3-routine-exercise-note">{exercise.observaciones}</p>
                                          ) : null}
                                        </article>
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
                                    {isExpanded
                                      ? "Ocultar ejercicios"
                                      : `Ver ejercicios (${block.ejercicios.length})`}
                                  </ReliableActionButton>
                                ) : null}
                              </section>
                            );
                          })}
                        </div>

                        {isUltraMobile && remainingBlocks > 0 ? (
                          <ReliableActionButton
                            type="button"
                            onClick={() =>
                              setVisibleRoutineBlockCount((previous) =>
                                Math.min(previous + 2, entry.blocks.length)
                              )
                            }
                            className="pf-a3-routine-more"
                          >
                            Cargar 2 bloques mas ({remainingBlocks} restantes)
                          </ReliableActionButton>
                        ) : null}
                      </article>
                    );
                  })}
                </>
              )}
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

                <ReliableActionButton
                  type="button"
                  onClick={openPayments}
                  onPointerUp={() => openPayments()}
                  data-nav-href="/alumnos/pagos"
                  className="pf-a2-ghost-btn mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  Revisar estado de pagos
                </ReliableActionButton>
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