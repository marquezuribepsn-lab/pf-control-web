"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useMemo, useState } from "react";
import { useAlumnos } from "../../../components/AlumnosProvider";
import { useSharedState } from "../../../components/useSharedState";

type MusicaAlumno = {
  id: string;
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

const mkId = () => `music-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function ClientesMusicaPage() {
  const { alumnos } = useAlumnos();
  const [assignments, setAssignments] = useSharedState<MusicaAlumno[]>([], {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  const [alumnoNombre, setAlumnoNombre] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [diaSemana, setDiaSemana] = useState("");
  const [recommendedSongTitle, setRecommendedSongTitle] = useState("");
  const [recommendedSongArtist, setRecommendedSongArtist] = useState("");

  const sortedAssignments = useMemo(
    () => [...assignments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [assignments]
  );

  const alumnoOptions = useMemo(
    () => (Array.isArray(alumnos) ? alumnos.map((item) => item.nombre).filter(Boolean) : []),
    [alumnos]
  );

  const addAssignment = () => {
    const target = alumnoNombre.trim();
    const name = playlistName.trim();
    const url = playlistUrl.trim();

    if (!target || !name || !url) {
      alert("Completa alumno, nombre de playlist y URL.");
      return;
    }

    const next: MusicaAlumno = {
      id: mkId(),
      alumnoNombre: target,
      playlistName: name,
      playlistUrl: url,
      objetivo: objetivo.trim() || undefined,
      diaSemana: diaSemana.trim() || undefined,
      recommendedSongTitle: recommendedSongTitle.trim() || undefined,
      recommendedSongArtist: recommendedSongArtist.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setAssignments((prev) => [next, ...(Array.isArray(prev) ? prev : [])]);

    setPlaylistName("");
    setPlaylistUrl("");
    setObjetivo("");
    setDiaSemana("");
    setRecommendedSongTitle("");
    setRecommendedSongArtist("");
  };

  const removeAssignment = (id: string) => {
    setAssignments((prev) => (Array.isArray(prev) ? prev.filter((item) => item.id !== id) : []));
  };

  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 rounded-2xl border border-fuchsia-400/30 bg-slate-900/70 p-6">
        <h1 className="text-3xl font-black">Musica para alumnos</h1>
        <p className="mt-2 text-sm text-slate-300">
          Asigna musica por alumno con objetivo, dia sugerido y cancion destacada.
        </p>
      </div>

      <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-5">
        <h2 className="text-lg font-bold">Nueva asignacion</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs text-slate-300">
            Alumno
            <select
              value={alumnoNombre}
              onChange={(e) => setAlumnoNombre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Seleccionar alumno</option>
              {alumnoOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-300">
            Playlist / lista
            <input
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs text-slate-300">
            URL Spotify
            <input
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
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
            <input
              value={diaSemana}
              onChange={(e) => setDiaSemana(e.target.value)}
              placeholder="lunes, martes..."
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
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

        <ReliableActionButton
          type="button"
          onClick={addAssignment}
          className="mt-4 rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500"
        >
          Guardar asignacion musical
        </ReliableActionButton>
      </section>

      <section className="mt-4 rounded-2xl border border-white/15 bg-slate-900/70 p-5">
        <h2 className="text-lg font-bold">Asignaciones ({sortedAssignments.length})</h2>
        <div className="mt-3 space-y-2">
          {sortedAssignments.length === 0 ? (
            <p className="text-sm text-slate-400">No hay musica asignada.</p>
          ) : null}

          {sortedAssignments.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-300"
            >
              <p className="text-sm font-semibold text-slate-100">{item.alumnoNombre}</p>
              <p className="font-semibold text-fuchsia-200">{item.playlistName}</p>
              <a href={item.playlistUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline">
                {item.playlistUrl}
              </a>
              <p>Objetivo: {item.objetivo || "-"}</p>
              <p>Dia: {item.diaSemana || "-"}</p>
              <p>
                Cancion: {item.recommendedSongTitle || "-"}
                {item.recommendedSongArtist ? ` · ${item.recommendedSongArtist}` : ""}
              </p>

              <ReliableActionButton
                type="button"
                onClick={() => removeAssignment(item.id)}
                className="mt-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-rose-200"
              >
                Eliminar
              </ReliableActionButton>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
