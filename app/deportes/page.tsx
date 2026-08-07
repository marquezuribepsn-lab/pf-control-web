"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useMemo, useState } from "react";
import { useDeportes } from "../../components/DeportesProvider";

const SPORT_CARD_TONES = [
  {
    border: "pf-v2-b-accent",
    glow: "",
    badge: "pf-v2-b-accent pf-v2-s-accent pf-v2-t-accent",
    edit: "pf-v2-t-accent",
  },
  {
    border: "pf-v2-b-ok",
    glow: "",
    badge: "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok",
    edit: "pf-v2-t-ok",
  },
  {
    border: "pf-v2-b-violet",
    glow: "",
    badge: "pf-v2-b-violet pf-v2-s-violet pf-v2-t-violet",
    edit: "pf-v2-t-violet",
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
    <div className="pf-v2-page">
      <section className="pf-v2-hero-block">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pf-v2-eyebrow">Centro Operativo</span>
            <h1 className="pf-v2-h1" style={{ fontSize: 32 }}>Deportes</h1>
            <p className="pf-v2-muted" style={{ marginTop: 8 }}>Gestiona disciplinas y posiciones con una vista moderna enfocada en operación diaria.</p>
          </div>
          <div className="pf-v2-card min-w-[180px] text-right">
            <span className="pf-v2-stat-label">Total actual</span>
            <strong className="pf-v2-stat-value">{stats.total}</strong>
            <span className="pf-v2-stat-label">deportes cargados</span>
          </div>
        </div>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Habilitados" value={stats.habilitados} tone="emerald" />
          <StatTile label="Deshabilitados" value={stats.deshabilitados} tone="rose" />
          <StatTile label="Posiciones" value={stats.posicionesTotales} tone="cyan" />
          <StatTile label="Promedio" value={stats.promedioPosiciones} tone="violet" suffix="por deporte" />
        </div>
      </section>

      <section className="pf-v2-card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold pf-v2-t">Agregar nuevo deporte</h2>
            <p className="mt-1 text-xs pf-v2-t-40">Se crea como habilitado con lista de posiciones vacía.</p>
          </div>
          <span className="rounded-full border pf-v2-b-accent pf-v2-s-accent px-3 py-1 text-[11px] font-semibold pf-v2-t-accent">
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
            className="pf-v2-input"
          />
          <ReliableActionButton
            onClick={handleAgregarDeporte}
            className="pf-v2-btn"
          >
            Agregar
          </ReliableActionButton>
        </div>
      </section>

      <section className="pf-v2-card">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="pf-v2-h2">Buscador inteligente</h2>
            <p className="mt-1 text-xs pf-v2-t-40">
              Busca por nombre de deporte o por cualquier posición (por ejemplo &quot;delantero&quot; o &quot;base&quot;).
            </p>
          </div>
          <span className="rounded-full border pf-v2-b-accent pf-v2-s-accent px-3 py-1 text-[11px] font-semibold pf-v2-t-accent">
            {deportesFiltrados.length} resultados
          </span>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Filtrar deportes o posiciones..."
          className="pf-v2-input"
        />
      </section>

      <section>
        {deportesFiltrados.length === 0 ? (
          <div className="pf-v2-card">
            <p className="pf-v2-h2">
              {sortedDeportes.length === 0 ? "No hay deportes cargados todavía." : "No encontramos coincidencias para tu búsqueda."}
            </p>
            <p className="pf-v2-muted">
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
                  className="pf-v2-card" style={{ position: "relative", overflow: "hidden" }}
                >
                  <div className={`pointer-events-none absolute inset-0${tone.glow}`} />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[1.65rem] font-black leading-tight pf-v2-t">{deporte.nombre}</h2>
                      <p className="mt-1 text-xs pf-v2-t-70">{deporte.posiciones.length} posiciones registradas</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <ReliableActionButton
                        onClick={() => toggleDeporte(deporte.nombre)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
                          deporte.habilitado
                            ? "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok"
                            : "pf-v2-b-danger pf-v2-s-danger pf-v2-t-danger"
                        }`}
                      >
                        {deporte.habilitado ? "Habilitado" : "Deshabilitado"}
                      </ReliableActionButton>

                      <ReliableActionButton
                        onClick={() => eliminarDeporte(deporte.nombre)}
                        className="rounded-full border pf-v2-b-danger pf-v2-s-danger px-3 py-1 text-[11px] font-bold pf-v2-t transition pf-v2-hover"
                      >
                        Eliminar
                      </ReliableActionButton>
                    </div>
                  </div>

                  <div className="pf-v2-card mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-[0.16em] pf-v2-t-70">Posiciones</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold${tone.badge}`}>
                        {deporte.posiciones.length}
                      </span>
                    </div>

                    {deporte.posiciones.length === 0 ? (
                      <p className="text-xs pf-v2-t-50">Todavía no agregaste posiciones para este deporte.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {deporte.posiciones.map((posicion, positionIndex) => (
                          <li
                            key={`${deporte.nombre}-${posicion}-${positionIndex}`}
                            className="flex items-center justify-between gap-2 rounded-lg border pf-v2-b pf-v2-s-deep px-2.5 py-1.5 text-sm pf-v2-t"
                          >
                            <span className="truncate">{posicion}</span>
                            <ReliableActionButton
                              onClick={() => handleEliminarPosicion(deporte.nombre, posicion)}
                              className="h-5 w-5 rounded-full pf-v2-s-danger text-center text-xs font-black leading-5 pf-v2-t-danger pf-v2-hover"
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
                          className="flex-1 rounded-lg border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-xs pf-v2-t pf-v2-ph outline-none"
                        />
                        <ReliableActionButton
                          onClick={() => handleAgregarPosicion(deporte.nombre)}
                          className="pf-v2-btn !px-3 !py-2 !text-xs"
                        >
                          Agregar
                        </ReliableActionButton>
                      </div>
                    ) : null}

                    <ReliableActionButton
                      onClick={() => setEditando(editando === deporte.nombre ? null : deporte.nombre)}
                      className={`mt-3 text-xs font-semibold${tone.edit}`}
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
    </div>
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
    cyan: "pf-v2-b-accent pf-v2-s-accent pf-v2-t-accent",
    emerald: "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok",
    rose: "pf-v2-b-danger pf-v2-s-danger pf-v2-t-danger",
    violet: "pf-v2-b-violet pf-v2-s-violet pf-v2-t-violet",
  };

  return (
    <article className={`rounded-2xl border p-3 ${palette[tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] pf-v2-t-40">{label}</p>
      <p className="mt-1 text-2xl font-black pf-v2-t">{value}</p>
      {suffix ? <p className="text-[10px] pf-v2-t-50">{suffix}</p> : null}
    </article>
  );
}
