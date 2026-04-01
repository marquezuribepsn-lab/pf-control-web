"use client";

import { useEffect, useMemo, useState } from "react";

type PlaylistRow = {
  id: string;
  nombre: string;
  url: string;
  objetivo?: string;
  diaSemana?: string;
  createdAt: string;
};

const STORAGE_KEY = "pf-control-music-playlists-v1";

const today = new Date().toISOString();

export default function AdminMusicaPage() {
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [diaSemana, setDiaSemana] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const sorted = useMemo(
    () => [...playlists].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [playlists]
  );

  const load = async () => {
    setError("");
    try {
      const response = await fetch(`/api/sync/${encodeURIComponent(STORAGE_KEY)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      setPlaylists(Array.isArray(data?.value) ? data.value : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar musica");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (next: PlaylistRow[]) => {
    const response = await fetch(`/api/sync/${encodeURIComponent(STORAGE_KEY)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: next }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || "No se pudieron guardar playlists");
    }

    setPlaylists(next);
  };

  const addPlaylist = async () => {
    setStatus("");
    setError("");

    try {
      const nombreTrim = nombre.trim();
      const urlTrim = url.trim();
      if (!nombreTrim || !urlTrim) {
        throw new Error("nombre y url son requeridos");
      }

      const next: PlaylistRow[] = [
        {
          id: `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          nombre: nombreTrim,
          url: urlTrim,
          objetivo: objetivo.trim() || undefined,
          diaSemana: diaSemana.trim() || undefined,
          createdAt: today,
        },
        ...playlists,
      ];

      await save(next);
      setNombre("");
      setUrl("");
      setObjetivo("");
      setDiaSemana("");
      setStatus("Playlist agregada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar playlist");
    }
  };

  const removePlaylist = async (id: string) => {
    setStatus("");
    setError("");

    try {
      const next = playlists.filter((item) => item.id !== id);
      await save(next);
      setStatus("Playlist eliminada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar playlist");
    }
  };

  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 rounded-2xl border border-fuchsia-400/30 bg-slate-900/70 p-6">
        <h1 className="text-3xl font-black">Musica</h1>
        <p className="mt-2 text-sm text-slate-300">
          Restaurado modulo de playlists para asignaciones por objetivo y dia semanal.
        </p>
      </div>

      <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-5">
        <h2 className="text-lg font-bold">Nueva playlist</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <input
            placeholder="URL Spotify"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <input
            placeholder="Objetivo (opcional)"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <input
            placeholder="Dia semana (opcional)"
            value={diaSemana}
            onChange={(e) => setDiaSemana(e.target.value)}
            className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={addPlaylist}
          className="mt-3 rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500"
        >
          Guardar playlist
        </button>

        {status ? <p className="mt-3 text-sm text-emerald-300">{status}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="mt-4 rounded-2xl border border-white/15 bg-slate-900/70 p-5">
        <h2 className="text-lg font-bold">Playlists ({sorted.length})</h2>
        <div className="mt-3 space-y-2">
          {sorted.length === 0 ? <p className="text-sm text-slate-400">No hay playlists cargadas.</p> : null}
          {sorted.map((item) => (
            <article key={item.id} className="rounded-lg border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">{item.nombre}</p>
              <a href={item.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">
                {item.url}
              </a>
              <p>Objetivo: {item.objetivo || "-"}</p>
              <p>Dia: {item.diaSemana || "-"}</p>
              <button
                type="button"
                onClick={() => removePlaylist(item.id)}
                className="mt-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-rose-200"
              >
                Eliminar
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
