"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useMemo, useState } from "react";
import { useDeportes } from "../../components/DeportesProvider";

const SPORT_CARD_TONES = [
  {
    border: "border-cyan-300/26",
    glow: "from-cyan-500/16 via-blue-500/10 to-transparent",
    badge: "border-cyan-200/45 bg-cyan-400/18 text-cyan-100",
    edit: "text-cyan-200 hover:text-cyan-100",
  },
  {
    border: "border-emerald-300/24",
    glow: "from-emerald-500/16 via-teal-500/10 to-transparent",
    badge: "border-emerald-200/45 bg-emerald-400/16 text-emerald-100",
    edit: "text-emerald-200 hover:text-emerald-100",
  },
  {
    border: "border-violet-300/24",
    glow: "from-violet-500/16 via-fuchsia-500/10 to-transparent",
    badge: "border-violet-200/45 bg-violet-400/16 text-violet-100",
    edit: "text-violet-200 hover:text-violet-100",
  },
];

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, " ");
const normalizeSearchToken = (value: string): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function DeportesPage() {
  const { deportes, agregarDeporte, toggleDeporte, eliminarDeporte, actualizarDeporte } = useDeportes();
  const [nuevoDeporte, setNuevoDeporte] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevaPosicion, setNuevaPosicion] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const sortedDeportes = useMemo(
    () => [...deportes].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [deportes]
  );

  const stats = useMemo(() => {
    const total = deportes.length;
    const habilitados = deportes.filter((deporte) => deporte.habilitado).length;
    const posicionesTotales = deportes.reduce((acc, deporte) => acc + deporte.posiciones.length, 0);
    const promedioPosiciones = total > 0 ? (posicionesTotales / total).toFixed(1) : "0";

    return {
      total,
      habilitados,
      deshabilitados: Math.max(total - habilitados, 0),
      posicionesTotales,
      promedioPosiciones,
    };
  }, [deportes]);

  const deportesFiltrados = useMemo(() => {
    const query = normalizeSearchToken(busqueda);
    if (!query) {
      return sortedDeportes;
    }

    return sortedDeportes.filter((deporte) => {
      if (normalizeSearchToken(deporte.nombre).includes(query)) {
        return true;
      }

      return deporte.posiciones.some((posicion) => normalizeSearchToken(posicion).includes(query));
    });
  }, [sortedDeportes, busqueda]);

  const handleAgregarDeporte = () => {
    const cleanedName = normalizeText(nuevoDeporte);
    if (cleanedName) {
      agregarDeporte({ nombre: cleanedName, habilitado: true, posiciones: [] });
      setNuevoDeporte("");
    }
  };

  const handleAgregarPosicion = (deporteNombre: string) => {
    const cleanedPosition = normalizeText(nuevaPosicion);
    if (cleanedPosition) {
      const deporte = deportes.find((d) => d.nombre === deporteNombre);
      if (deporte) {
        actualizarDeporte(deporteNombre, {
          posiciones: [...deporte.posiciones, cleanedPosition],
        });
        setNuevaPosicion("");
      }
    }
  };

  const handleEliminarPosicion = (deporteNombre: string, posicion: string) => {
    const deporte = deportes.find((d) => d.nombre === deporteNombre);
    if (deporte) {
      actualizarDeporte(deporteNombre, {
        posiciones: deporte.posiciones.filter((p) => p !== posicion),
      });
    }
  };

  return (
    <main className="relative mx-auto max-w-[1480px] space-y-6 p-6 text-slate-100">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 z-0"
        style={{ background: `radial-gradient(ellipse 80% 55% at 50% -10%, hsla(var(--hue,197),65%,55%,0.1) 0%, transparent 70%)` }}
        aria-hidden="true"
      />
      <section className="relative overflow-hidden pf-card rounded-3xl border p-6">
        <div className="pointer-events-none absolute -left-14 -top-16 h-48 w-48 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-44 w-44 rounded-full bg-violet-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/80">Centro Operativo</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Deportes</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
              Gestiona disciplinas y posiciones con una vista moderna enfocada en operación diaria.
            </p>
          </div>

          <div className="grid min-w-[220px] gap-2 pf-card rounded-2xl border p-3 text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Snapshot</p>
            <p className="text-2xl font-black text-cyan-100">{stats.total}</p>
            <p className="text-xs text-slate-400">deportes cargados</p>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Habilitados" value={stats.habilitados} tone="emerald" />
          <StatTile label="Deshabilitados" value={stats.deshabilitados} tone="rose" />
          <StatTile label="Posiciones" value={stats.posicionesTotales} tone="cyan" />
          <StatTile label="Promedio" value={stats.promedioPosiciones} tone="violet" suffix="por deporte" />
        </div>
      </section>

      <section className="pf-card rounded-2xl border p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white/90" style={{ color: `hsl(var(--hue,197),65%,65%)` }}>Agregar nuevo deporte</h2>
            <p className="mt-1 text-xs text-white/40">Se crea como habilitado con lista de posiciones vacía.</p>
          </div>
          <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300">
            Total actual: {stats.total}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={nuevoDeporte}
            onChange={(e) => setNuevoDeporte(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAgregarDeporte();
              }
            }}
            placeholder="Nombre del deporte"
            className="flex-1 rounded-xl border border-white/[0.1] bg-[#0e1012] px-4 py-2.5 text-white/85 placeholder:text-white/25 outline-none focus:border-white/[0.2] focus:bg-[#111417]"
          />
          <ReliableActionButton
            onClick={handleAgregarDeporte}
            className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Agregar
          </ReliableActionButton>
        </div>
      </section>

      <section className="pf-card rounded-2xl border p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white/90" style={{ color: `hsl(var(--hue,197),65%,65%)` }}>Buscador inteligente</h2>
            <p className="mt-1 text-xs text-white/40">
              Busca por nombre de deporte o por cualquier posición (por ejemplo &quot;delantero&quot; o &quot;base&quot;).
            </p>
          </div>
          <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300">
            {deportesFiltrados.length} resultados
          </span>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Filtrar deportes o posiciones..."
          className="w-full rounded-xl border border-white/[0.1] bg-[#0e1012] px-4 py-2.5 text-white/85 placeholder:text-white/25 outline-none focus:border-white/[0.2] focus:bg-[#111417]"
        />
      </section>

      <section>
        {deportesFiltrados.length === 0 ? (
          <div className="pf-card rounded-2xl border p-8 text-center">
            <p className="text-lg font-bold text-white/90">
              {sortedDeportes.length === 0 ? "No hay deportes cargados todavía." : "No encontramos coincidencias para tu búsqueda."}
            </p>
            <p className="mt-1 text-sm text-white/40">
              {sortedDeportes.length === 0
                ? "Empieza creando el primero desde el bloque superior."
                : "Prueba con otro término o limpia el filtro para ver todos los deportes."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {deportesFiltrados.map((deporte, index) => {
              const tone = SPORT_CARD_TONES[index % SPORT_CARD_TONES.length];

              return (
                <article
                  key={deporte.nombre}
                  className={`pf-card relative overflow-hidden rounded-2xl border p-5`}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow}`} />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[1.65rem] font-black leading-tight text-white">{deporte.nombre}</h2>
                      <p className="mt-1 text-xs text-slate-300">{deporte.posiciones.length} posiciones registradas</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <ReliableActionButton
                        onClick={() => toggleDeporte(deporte.nombre)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
                          deporte.habilitado
                            ? "border-emerald-200/45 bg-emerald-400/22 text-emerald-100"
                            : "border-rose-200/45 bg-rose-500/24 text-rose-100"
                        }`}
                      >
                        {deporte.habilitado ? "Habilitado" : "Deshabilitado"}
                      </ReliableActionButton>

                      <ReliableActionButton
                        onClick={() => eliminarDeporte(deporte.nombre)}
                        className="rounded-full border border-rose-300/40 bg-rose-500/90 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-rose-500"
                      >
                        Eliminar
                      </ReliableActionButton>
                    </div>
                  </div>

                  <div className="relative mt-4 pf-card rounded-2xl border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Posiciones</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>
                        {deporte.posiciones.length}
                      </span>
                    </div>

                    {deporte.posiciones.length === 0 ? (
                      <p className="text-xs text-slate-400">Todavía no agregaste posiciones para este deporte.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {deporte.posiciones.map((posicion, positionIndex) => (
                          <li
                            key={`${deporte.nombre}-${posicion}-${positionIndex}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#0e1012] px-2.5 py-1.5 text-sm text-white/85"
                          >
                            <span className="truncate">{posicion}</span>
                            <ReliableActionButton
                              onClick={() => handleEliminarPosicion(deporte.nombre, posicion)}
                              className="h-5 w-5 rounded-full bg-rose-500/22 text-center text-xs font-black leading-5 text-rose-200 hover:bg-rose-500/40"
                              title="Eliminar posicion"
                            >
                              ×
                            </ReliableActionButton>
                          </li>
                        ))}
                      </ul>
                    )}

                    {editando === deporte.nombre ? (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={nuevaPosicion}
                          onChange={(e) => setNuevaPosicion(e.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleAgregarPosicion(deporte.nombre);
                            }
                          }}
                          placeholder="Nueva posición"
                          className="flex-1 rounded-lg border border-white/[0.1] bg-[#0e1012] px-3 py-2 text-xs text-white/85 placeholder:text-white/25 outline-none focus:border-white/[0.2] focus:bg-[#111417]"
                        />
                        <ReliableActionButton
                          onClick={() => handleAgregarPosicion(deporte.nombre)}
                          className="rounded-lg border border-cyan-300/40 bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300"
                        >
                          Agregar
                        </ReliableActionButton>
                      </div>
                    ) : null}

                    <ReliableActionButton
                      onClick={() => setEditando(editando === deporte.nombre ? null : deporte.nombre)}
                      className={`mt-3 text-xs font-semibold ${tone.edit}`}
                    >
                      {editando === deporte.nombre ? "Cancelar edición" : "Editar posiciones"}
                    </ReliableActionButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatTile({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: string | number;
  tone: "cyan" | "emerald" | "rose" | "violet";
  suffix?: string;
}) {
  const palette = {
    cyan: "border-cyan-300/35 bg-cyan-500/12 text-cyan-100",
    emerald: "border-emerald-300/35 bg-emerald-500/12 text-emerald-100",
    rose: "border-rose-300/35 bg-rose-500/12 text-rose-100",
    violet: "border-violet-300/35 bg-violet-500/12 text-violet-100",
  };

  return (
    <article className={`rounded-2xl border p-3 ${palette[tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      {suffix ? <p className="text-[10px] text-white/45">{suffix}</p> : null}
    </article>
  );
}
