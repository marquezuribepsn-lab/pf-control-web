"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useAlumnos } from "@/components/AlumnosProvider";
import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";

type AlumnoPlaylistAssignment = {
  id?: string;
  alumnoNombre: string;
  spotifyUrl: string;
  playlistTitle: string;
  isActive?: boolean;
  objetivo?: string;
  diaSemana?: string;
  recommendedSongTitle?: string;
  recommendedSongArtist?: string;
  updatedAt: string;
};

const PLAYLISTS_KEY = "pf-control-alumno-playlists-v1";
const ALL_ALUMNOS_KEY = "__ALL_ALUMNOS__";
const OBJECTIVE_OPTIONS = [
  "Fuerza",
  "Movilidad",
  "Cardio",
  "Pre-entreno",
  "Post-entreno",
  "Recuperacion",
  "Libre",
];
const DAY_OPTIONS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function extractSpotifyPlaylistId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  const uriMatch = raw.match(/^spotify:playlist:([a-zA-Z0-9]+)$/i);
  if (uriMatch?.[1]) {
    return uriMatch[1];
  }

  const webMatch = raw.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)(?:\?|$)/i);
  if (webMatch?.[1]) {
    return webMatch[1];
  }

  return null;
}

export default function AdminMusicaPage() {
  const { data: session } = useSession();
  const { alumnos } = useAlumnos();
  const [assignments, setAssignments] = useSharedState<AlumnoPlaylistAssignment[]>([], {
    key: PLAYLISTS_KEY,
    legacyLocalStorageKey: PLAYLISTS_KEY,
  });

  const [selectedAlumno, setSelectedAlumno] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [playlistObjetivo, setPlaylistObjetivo] = useState("Libre");
  const [playlistDiaSemana, setPlaylistDiaSemana] = useState("Sin dia");
  const [recommendedSongTitle, setRecommendedSongTitle] = useState("");
  const [recommendedSongArtist, setRecommendedSongArtist] = useState("");
  const [searchText, setSearchText] = useState("");
  const [objectiveFilter, setObjectiveFilter] = useState("todos");
  const [alumnoFilter, setAlumnoFilter] = useState("todos");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const spotifyPlaylistId = useMemo(() => extractSpotifyPlaylistId(spotifyUrl), [spotifyUrl]);
  const spotifyEmbedUrl = spotifyPlaylistId
    ? `https://open.spotify.com/embed/playlist/${spotifyPlaylistId}?utm_source=generator`
    : null;

  const sortedAssignments = useMemo(() => {
    return assignments
      .map((item, index) => ({
        ...item,
        id: item.id || `${item.alumnoNombre}-${item.updatedAt}-${index}`,
      }))
      .sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt)));
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const needle = searchText.trim().toLowerCase();

    return sortedAssignments.filter((item) => {
      if (objectiveFilter !== "todos" && (item.objetivo || "Libre") !== objectiveFilter) {
        return false;
      }

      if (alumnoFilter !== "todos" && item.alumnoNombre !== alumnoFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const content = [
        item.alumnoNombre,
        item.playlistTitle,
        item.objetivo || "",
        item.diaSemana || "",
        item.recommendedSongTitle || "",
        item.recommendedSongArtist || "",
      ]
        .join(" ")
        .toLowerCase();

      return content.includes(needle);
    });
  }, [alumnoFilter, objectiveFilter, searchText, sortedAssignments]);

  const previewRows = useMemo(() => {
    return filteredAssignments
      .map((item) => {
        const playlistId = extractSpotifyPlaylistId(item.spotifyUrl);
        if (!playlistId) return null;
        return {
          ...item,
          embedUrl: `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator`,
        };
      })
      .filter(Boolean)
      .slice(0, 9) as Array<
      AlumnoPlaylistAssignment & {
        id: string;
        embedUrl: string;
      }
    >;
  }, [filteredAssignments]);

  const saveAssignment = () => {
    setMessage("");
    setError("");

    const alumnoNombre =
      selectedAlumno === ALL_ALUMNOS_KEY ? ALL_ALUMNOS_KEY : normalizeName(selectedAlumno);
    const playlistId = extractSpotifyPlaylistId(spotifyUrl);

    if (!alumnoNombre) {
      setError("Selecciona un alumno.");
      return;
    }

    if (!playlistId) {
      setError("Ingresa una URL o URI valida de playlist de Spotify.");
      return;
    }

    const cleanedTitle = normalizeName(playlistTitle) || "Playlist de entrenamiento";
    const canonicalUrl = `https://open.spotify.com/playlist/${playlistId}`;

    markManualSaveIntent(PLAYLISTS_KEY);
    setAssignments((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      next.unshift({
        id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
        alumnoNombre,
        spotifyUrl: canonicalUrl,
        playlistTitle: cleanedTitle,
        isActive: true,
        objetivo: playlistObjetivo || "Libre",
        diaSemana: playlistDiaSemana === "Sin dia" ? "" : playlistDiaSemana,
        recommendedSongTitle: normalizeName(recommendedSongTitle),
        recommendedSongArtist: normalizeName(recommendedSongArtist),
        updatedAt: new Date().toISOString(),
      });
      return next;
    });

    setMessage(
      alumnoNombre === ALL_ALUMNOS_KEY
        ? "Playlist global agregada para todos los alumnos."
        : "Playlist agregada correctamente."
    );
    setSpotifyUrl("");
    setPlaylistTitle("");
    setPlaylistObjetivo("Libre");
    setPlaylistDiaSemana("Sin dia");
    setRecommendedSongTitle("");
    setRecommendedSongArtist("");
  };

  const removeAssignment = (id: string) => {
    markManualSaveIntent(PLAYLISTS_KEY);
    setAssignments((prev) =>
      prev.filter((item, index) => (item.id || `${item.alumnoNombre}-${item.updatedAt}-${index}`) !== id)
    );
  };

  const toggleAssignmentActive = (id: string, nextActive: boolean) => {
    markManualSaveIntent(PLAYLISTS_KEY);
    setAssignments((prev) =>
      prev.map((item, index) => {
        const safeId = item.id || `${item.alumnoNombre}-${item.updatedAt}-${index}`;
        if (safeId !== id) {
          return item;
        }
        return { ...item, isActive: nextActive };
      })
    );
  };

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-3 py-4 text-slate-100 sm:px-6 sm:py-6">
        <div className="rounded-3xl border border-rose-400/35 bg-rose-500/10 p-4 text-sm text-rose-100">
          No autorizado. Esta seccion es solo para ADMIN.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 text-slate-100 sm:px-6 sm:py-6">
      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-300">Admin · Musica</p>
        <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Anadir playlist de Spotify</h1>
        <p className="mt-1 text-sm text-slate-300">
          Asigna playlists por alumno. La vista de abajo muestra un preview tipo Spotify con canciones de la playlist.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Alumno
            <select
              value={selectedAlumno}
              onChange={(event) => setSelectedAlumno(event.target.value)}
              className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            >
              <option value="">Seleccionar alumno</option>
              <option value={ALL_ALUMNOS_KEY}>Todos los alumnos (global)</option>
              {alumnos
                .map((item) => item.nombre)
                .sort((a, b) => a.localeCompare(b))
                .map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Titulo playlist
            <input
              type="text"
              value={playlistTitle}
              onChange={(event) => setPlaylistTitle(event.target.value)}
              placeholder="Ej: Semana 2 · Cardio"
              className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Objetivo
            <select
              value={playlistObjetivo}
              onChange={(event) => setPlaylistObjetivo(event.target.value)}
              className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            >
              {OBJECTIVE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Dia (opcional)
            <select
              value={playlistDiaSemana}
              onChange={(event) => setPlaylistDiaSemana(event.target.value)}
              className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            >
              <option value="Sin dia">Sin dia</option>
              {DAY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Cancion recomendada (titulo)
            <input
              type="text"
              value={recommendedSongTitle}
              onChange={(event) => setRecommendedSongTitle(event.target.value)}
              placeholder="Ej: Till I Collapse"
              className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Artista recomendado
            <input
              type="text"
              value={recommendedSongArtist}
              onChange={(event) => setRecommendedSongArtist(event.target.value)}
              placeholder="Ej: Eminem"
              className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-200">
          URL o URI de Spotify
          <input
            type="text"
            value={spotifyUrl}
            onChange={(event) => setSpotifyUrl(event.target.value)}
            placeholder="https://open.spotify.com/playlist/..."
            className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
          />
        </label>

        {spotifyEmbedUrl && (
          <div className="mt-4 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Preview Spotify</p>
            <iframe
              title="Preview Spotify playlist"
              src={spotifyEmbedUrl}
              width="100%"
              height="352"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="mt-2 w-full rounded-xl border border-white/10"
            />
            <p className="mt-2 text-xs text-slate-300">
              Nota: por limitaciones de Spotify, no se puede embeber toda la app completa dentro del panel,
              pero este preview muestra lista y reproduccion de la playlist.
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-rose-200">{error}</p>}
        {message && <p className="mt-3 text-sm font-semibold text-emerald-200">{message}</p>}

        <button
          type="button"
          onClick={saveAssignment}
          className="mt-4 rounded-xl bg-fuchsia-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-fuchsia-300"
        >
          Guardar playlist
        </button>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6">
        <h2 className="text-lg font-black text-white">Asignaciones actuales</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
            Buscar
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Alumno, playlist, objetivo..."
              className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100"
            />
          </label>

          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
            Filtrar objetivo
            <select
              value={objectiveFilter}
              onChange={(event) => setObjectiveFilter(event.target.value)}
              className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100"
            >
              <option value="todos">Todos</option>
              {OBJECTIVE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
            Filtrar alumno
            <select
              value={alumnoFilter}
              onChange={(event) => setAlumnoFilter(event.target.value)}
              className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100"
            >
              <option value="todos">Todos</option>
              <option value={ALL_ALUMNOS_KEY}>Todos los alumnos (global)</option>
              {alumnos
                .map((item) => item.nombre)
                .sort((a, b) => a.localeCompare(b))
                .map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="mt-3 space-y-2">
          {filteredAssignments.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-4 text-sm text-slate-300">
              No hay playlists para los filtros aplicados.
            </div>
          )}

          {filteredAssignments.map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <p className="text-sm font-bold text-white">
                {item.alumnoNombre === ALL_ALUMNOS_KEY ? "Todos los alumnos (global)" : item.alumnoNombre}
              </p>
              <p className="mt-1 text-xs font-semibold text-fuchsia-200">{item.playlistTitle}</p>
              <div className="mt-1 inline-flex rounded-full border border-white/15 bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold">
                {item.isActive === false ? "Inactiva" : "Activa"}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                  {item.objetivo || "Libre"}
                </span>
                {item.diaSemana ? (
                  <span className="rounded-full border border-violet-300/35 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-100">
                    {item.diaSemana}
                  </span>
                ) : null}
              </div>
              {item.recommendedSongTitle ? (
                <p className="mt-1 text-xs text-emerald-100">
                  Hoy sugerida: <span className="font-semibold">{item.recommendedSongTitle}</span>
                  {item.recommendedSongArtist ? ` · ${item.recommendedSongArtist}` : ""}
                </p>
              ) : null}
              <a
                href={item.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex text-xs font-semibold text-cyan-300 underline-offset-2 hover:underline"
              >
                Abrir playlist
              </a>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => toggleAssignmentActive(String(item.id || ""), item.isActive === false)}
                  className="mr-2 rounded-lg border border-amber-300/35 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25"
                >
                  {item.isActive === false ? "Activar" : "Desactivar"}
                </button>
                <button
                  type="button"
                  onClick={() => removeAssignment(String(item.id || ""))}
                  className="rounded-lg border border-rose-300/35 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25"
                >
                  Quitar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6">
        <h2 className="text-lg font-black text-white">Vista de playlists (Spotify)</h2>
        <p className="mt-1 text-sm text-slate-300">
          Preview simultaneo de hasta 9 playlists segun tus filtros para gestionar por lote.
        </p>

        {previewRows.length === 0 ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-4 text-sm text-slate-300">
            No hay playlists validas para previsualizar.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {previewRows.map((row) => (
              <article key={`preview-${row.id}`} className="rounded-2xl border border-white/10 bg-slate-900/65 p-3">
                <p className="text-sm font-black text-white">{row.playlistTitle}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {row.alumnoNombre === ALL_ALUMNOS_KEY ? "Todos los alumnos (global)" : row.alumnoNombre}
                </p>
                <iframe
                  title={`Preview ${row.playlistTitle}`}
                  src={row.embedUrl}
                  width="100%"
                  height="232"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="mt-2 w-full rounded-xl border border-white/10"
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
