"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useEffect, useMemo, useState } from "react";
import { useAlumnos } from "../../../components/AlumnosProvider";
import { useSharedState } from "../../../components/useSharedState";

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

type FormPlatform = MusicPlatform | "AUTO";

type MusicaAlumno = {
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

const STORAGE_KEY = "pf-control-music-playlists-v1";
const DIRECT_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"];

const PLATFORM_OPTIONS: Array<{ value: FormPlatform; label: string }> = [
  { value: "AUTO", label: "Detectar automaticamente" },
  { value: "SPOTIFY", label: "Spotify" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "YOUTUBE_MUSIC", label: "YouTube Music" },
  { value: "SOUNDCLOUD", label: "SoundCloud" },
  { value: "APPLE_MUSIC", label: "Apple Music" },
  { value: "DEEZER", label: "Deezer" },
  { value: "AMAZON_MUSIC", label: "Amazon Music" },
  { value: "AUDIO_FILE", label: "Archivo de audio" },
  { value: "OTHER", label: "Otro" },
];

const WEEKDAY_OPTIONS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const ALL_DAYS_VALUE = "todos-los-dias";

const mkId = () => `music-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

function buildDefaultPlaylistName(rawUrl: string, platform: MusicPlatform): string {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return "Playlist";
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "");
    return `${getPlatformLabel(platform)} · ${host}`;
  } catch {
    return getPlatformLabel(platform);
  }
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

function resolveSoundCloudEmbed(rawUrl: string): string | null {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return null;
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(normalized)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false`;
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

function resolveEmbeddedPlayerSource(platform: MusicPlatform, rawUrl: string): { kind: "iframe" | "audio" | "none"; src: string | null } {
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
    case "OTHER": {
      if (looksLikeAudioFile(normalized)) {
        return { kind: "audio", src: normalized };
      }
      return { kind: "none", src: null };
    }
    default:
      return { kind: "none", src: null };
  }
}

function normalizeAssignments(rawValue: unknown): MusicaAlumno[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const normalizedRows: MusicaAlumno[] = [];

  for (const rawRow of rawValue) {
    if (!rawRow || typeof rawRow !== "object") {
      continue;
    }

    const row = rawRow as Record<string, unknown>;
    const playlistUrl = normalizeUrl(String(row.playlistUrl || row.url || row.link || ""));

    if (!playlistUrl) {
      continue;
    }

    const rowPlatform = String(row.platform || "").trim().toUpperCase();
    const platform: MusicPlatform = [
      "SPOTIFY",
      "YOUTUBE",
      "YOUTUBE_MUSIC",
      "SOUNDCLOUD",
      "APPLE_MUSIC",
      "DEEZER",
      "AMAZON_MUSIC",
      "AUDIO_FILE",
      "OTHER",
    ].includes(rowPlatform)
      ? (rowPlatform as MusicPlatform)
      : inferPlatformFromUrl(playlistUrl);

    const playlistNameRaw = String(row.playlistName || row.nombre || row.title || "").trim();
    const playlistName = playlistNameRaw || buildDefaultPlaylistName(playlistUrl, platform);

    normalizedRows.push({
      id: String(row.id || mkId()),
      platform,
      alumnoNombre: String(row.alumnoNombre || row.alumno || "").trim(),
      playlistName,
      playlistUrl,
      objetivo: String(row.objetivo || "").trim() || undefined,
      diaSemana: String(row.diaSemana || "").trim() || undefined,
      recommendedSongTitle: String(row.recommendedSongTitle || "").trim() || undefined,
      recommendedSongArtist: String(row.recommendedSongArtist || "").trim() || undefined,
      createdAt: String(row.createdAt || new Date().toISOString()),
    });
  }

  return normalizedRows;
}

function signature(rows: MusicaAlumno[]): string {
  return rows
    .map((item) =>
      [
        item.id,
        item.platform,
        item.alumnoNombre,
        item.playlistName,
        item.playlistUrl,
        item.objetivo || "",
        item.diaSemana || "",
        item.recommendedSongTitle || "",
        item.recommendedSongArtist || "",
        item.createdAt,
      ].join("::")
    )
    .join("||");
}

function MusicPlayer({ item }: { item: MusicaAlumno }) {
  const player = resolveEmbeddedPlayerSource(item.platform, item.playlistUrl);

  if (player.kind === "audio" && player.src) {
    return <audio controls preload="none" className="mt-2 w-full" src={player.src} />;
  }

  if (player.kind === "iframe" && player.src) {
    return (
      <iframe
        title={`player-${item.id}`}
        src={player.src}
        className="mt-2 h-40 w-full rounded-lg border border-white/10"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      />
    );
  }

  return (
    <p className="mt-2 text-xs text-slate-400">
      Esta plataforma no permite embed directo en esta pagina. El alumno puede abrir el enlace y escuchar en su app.
    </p>
  );
}

export default function ClientesMusicaPage() {
  const { alumnos } = useAlumnos();
  const [assignments, setAssignments] = useSharedState<MusicaAlumno[]>([], {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  const [selectedCatalogUrl, setSelectedCatalogUrl] = useState("");
  const [alumnoNombre, setAlumnoNombre] = useState("");
  const [platform, setPlatform] = useState<FormPlatform>("AUTO");
  const [playlistName, setPlaylistName] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [diaSemana, setDiaSemana] = useState("");
  const [recommendedSongTitle, setRecommendedSongTitle] = useState("");
  const [recommendedSongArtist, setRecommendedSongArtist] = useState("");
  const [previewAlumno, setPreviewAlumno] = useState("TODOS");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAssignments((prev) => {
      const normalizedCurrent = normalizeAssignments(prev as unknown);
      if (signature(prev as MusicaAlumno[]) === signature(normalizedCurrent)) {
        return prev;
      }
      return normalizedCurrent;
    });
  }, [setAssignments]);

  const sortedAssignments = useMemo(
    () => [...normalizeAssignments(assignments)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [assignments]
  );

  const alumnoOptions = useMemo(
    () => (Array.isArray(alumnos) ? alumnos.map((item) => item.nombre).filter(Boolean) : []),
    [alumnos]
  );

  const alumnoWithAssignments = useMemo(() => {
    const map = new Set<string>();
    for (const item of sortedAssignments) {
      if (item.alumnoNombre.trim()) {
        map.add(item.alumnoNombre.trim());
      }
    }
    return Array.from(map).sort((a, b) => a.localeCompare(b));
  }, [sortedAssignments]);

  const catalogOptions = useMemo(() => {
    const map = new Map<string, MusicaAlumno>();
    for (const item of sortedAssignments) {
      const key = item.playlistUrl.trim().toLowerCase();
      if (!key || map.has(key)) continue;
      map.set(key, item);
    }
    return Array.from(map.values()).sort((a, b) => a.playlistName.localeCompare(b.playlistName));
  }, [sortedAssignments]);

  const previewRows = useMemo(() => {
    if (previewAlumno === "TODOS") {
      return sortedAssignments;
    }
    return sortedAssignments.filter((item) => item.alumnoNombre === previewAlumno);
  }, [previewAlumno, sortedAssignments]);

  const previewPlatform = platform === "AUTO" ? inferPlatformFromUrl(playlistUrl) : platform;
  const effectivePreviewName = playlistName.trim() || buildDefaultPlaylistName(playlistUrl, previewPlatform);
  const previewItem: MusicaAlumno | null =
    normalizeUrl(playlistUrl)
      ? {
          id: "preview",
          platform: previewPlatform,
          alumnoNombre: alumnoNombre.trim(),
          playlistName: effectivePreviewName,
          playlistUrl: normalizeUrl(playlistUrl),
          objetivo: objetivo.trim() || undefined,
          diaSemana: diaSemana.trim() || undefined,
          recommendedSongTitle: recommendedSongTitle.trim() || undefined,
          recommendedSongArtist: recommendedSongArtist.trim() || undefined,
          createdAt: new Date().toISOString(),
        }
      : null;

  const addAssignment = () => {
    setStatus("");
    setError("");

    const target = alumnoNombre.trim();
    const url = normalizeUrl(playlistUrl);

    if (!url) {
      setError("Completa al menos la URL de la playlist.");
      return;
    }

    const resolvedPlatform = platform === "AUTO" ? inferPlatformFromUrl(url) : platform;
    const resolvedName = playlistName.trim() || buildDefaultPlaylistName(url, resolvedPlatform);

    const next: MusicaAlumno = {
      id: mkId(),
      platform: resolvedPlatform,
      alumnoNombre: target,
      playlistName: resolvedName,
      playlistUrl: url,
      objetivo: objetivo.trim() || undefined,
      diaSemana: diaSemana.trim() || undefined,
      recommendedSongTitle: recommendedSongTitle.trim() || undefined,
      recommendedSongArtist: recommendedSongArtist.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setAssignments((prev) => [next, ...(Array.isArray(prev) ? prev : [])]);
    setStatus(target ? "Asignacion guardada para el alumno." : "Playlist guardada en musica general.");
    setSelectedCatalogUrl("");
    setPlatform("AUTO");

    setPlaylistName("");
    setPlaylistUrl("");
    setObjetivo("");
    setDiaSemana("");
    setRecommendedSongTitle("");
    setRecommendedSongArtist("");
  };

  const loadFromCatalog = (url: string) => {
    setSelectedCatalogUrl(url);
    setStatus("");
    setError("");

    const selected = catalogOptions.find((item) => item.playlistUrl === url);
    if (!selected) {
      return;
    }

    setPlatform(selected.platform);
    setPlaylistName(selected.playlistName);
    setPlaylistUrl(selected.playlistUrl);
    setObjetivo(selected.objetivo || "");
    setDiaSemana(selected.diaSemana || "");
    setRecommendedSongTitle(selected.recommendedSongTitle || "");
    setRecommendedSongArtist(selected.recommendedSongArtist || "");
  };

  const removeAssignment = (id: string) => {
    setStatus("");
    setError("");
    setAssignments((prev) => (Array.isArray(prev) ? prev.filter((item) => item.id !== id) : []));
    setStatus("Asignacion eliminada.");
  };

  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 rounded-2xl border border-fuchsia-400/30 bg-slate-900/70 p-6">
        <h1 className="text-3xl font-black">Musica</h1>
        <p className="mt-2 text-sm text-slate-300">
          Categoria unificada: selecciona playlist desde cualquier plataforma y asignala a cada alumno con reproductor integrado.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Plataformas compatibles: Spotify, YouTube, YouTube Music, SoundCloud, Apple Music, Deezer, Amazon Music y links directos de audio.
        </p>
      </div>

      <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-5">
        <h2 className="text-lg font-bold">Nueva asignacion</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-slate-300 md:col-span-2 xl:col-span-2">
            Seleccionar desde catalogo (opcional)
            <select
              value={selectedCatalogUrl}
              onChange={(e) => loadFromCatalog(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Cargar datos de una playlist existente</option>
              {catalogOptions.map((item) => (
                <option key={`catalog-${item.id}`} value={item.playlistUrl}>
                  {item.playlistName} · {item.platform}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-300">
            Alumno
            <select
              value={alumnoNombre}
              onChange={(e) => setAlumnoNombre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Musica general (sin alumno)</option>
              {alumnoOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-300">
            Plataforma
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as FormPlatform)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              {PLATFORM_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-300">
            URL de la playlist
            <input
              value={playlistUrl}
              onChange={(e) => {
                setPlaylistUrl(e.target.value);
                setPlaylistName("");
                if (platform === "AUTO") {
                  const inferred = inferPlatformFromUrl(e.target.value);
                  if (inferred !== "OTHER") {
                    setPlatform(inferred);
                  }
                }
              }}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs text-slate-300">
            Objetivo
            <input
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="activacion, fuerza, recuperacion"
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs text-slate-300">
            Dia sugerido
            <select
              value={diaSemana}
              onChange={(e) => setDiaSemana(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Sin dia definido</option>
              <option value={ALL_DAYS_VALUE}>Todos los dias</option>
              {WEEKDAY_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-300">
            Cancion destacada
            <input
              value={recommendedSongTitle}
              onChange={(e) => setRecommendedSongTitle(e.target.value)}
              placeholder="Titulo"
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs text-slate-300">
            Artista
            <input
              value={recommendedSongArtist}
              onChange={(e) => setRecommendedSongArtist(e.target.value)}
              placeholder="Artista"
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {previewItem ? (
          <div className="mt-4 rounded-xl border border-cyan-400/30 bg-slate-800/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Preview del reproductor</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{previewItem.playlistName}</p>
            <MusicPlayer item={previewItem} />
            <ReliableActionButton
              type="button"
              onClick={addAssignment}
              className="mt-3 rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500"
            >
              Guardar asignacion musical
            </ReliableActionButton>
          </div>
        ) : null}

        <ReliableActionButton
          type="button"
          onClick={addAssignment}
          className="mt-4 rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500"
        >
          Guardar asignacion musical
        </ReliableActionButton>

        {status ? <p className="mt-3 text-sm text-emerald-300">{status}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="mt-4 rounded-2xl border border-white/15 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold">Asignaciones ({sortedAssignments.length})</h2>
          <label className="text-xs text-slate-300">
            Vista alumno
            <select
              value={previewAlumno}
              onChange={(e) => setPreviewAlumno(e.target.value)}
              className="mt-1 w-full min-w-52 rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="TODOS">Todos los alumnos</option>
              {alumnoWithAssignments.map((name) => (
                <option key={`preview-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 space-y-2">
          {previewRows.length === 0 ? (
            <p className="text-sm text-slate-400">No hay musica asignada.</p>
          ) : null}

          {previewRows.map((item) => {
            const showDistinctName = normalizeUrl(item.playlistName) !== normalizeUrl(item.playlistUrl);
            return (
              <article
                key={item.id}
                className="rounded-lg border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">{item.alumnoNombre || "Musica general"}</p>
                  <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">
                    {item.platform}
                  </span>
                </div>

                {showDistinctName ? <p className="font-semibold text-fuchsia-200">{item.playlistName}</p> : null}
                <a href={item.playlistUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline">
                  {item.playlistUrl}
                </a>
                <p>Objetivo: {item.objetivo || "-"}</p>
                <p>Dia: {item.diaSemana || "-"}</p>
                <p>
                  Cancion: {item.recommendedSongTitle || "-"}
                  {item.recommendedSongArtist ? ` · ${item.recommendedSongArtist}` : ""}
                </p>

                <MusicPlayer item={item} />

                <ReliableActionButton
                  type="button"
                  onClick={() => removeAssignment(item.id)}
                  className="mt-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-rose-200"
                >
                  Eliminar
                </ReliableActionButton>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
