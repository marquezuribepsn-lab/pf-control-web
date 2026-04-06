"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ReliableLink";
import { useCategories } from "../../components/CategoriesProvider";
import { usePlayers } from "../../components/PlayersProvider";
import { useSessions } from "../../components/SessionsProvider";
import { useSharedState } from "../../components/useSharedState";

type JornadaEntrenamiento = {
  id: string;
  titulo: string;
  categoria: string;
  fecha: string;
  hora: string;
  ubicacion?: string;
  notas?: string;
  sesionId?: string;
  suspendida?: boolean;
  motivoSuspension?: string;
  suspendidaAt?: string;
};

type AsistenciaRegistro = {
  jornadaId: string;
  jugadoraNombre: string;
  estado: "presente" | "ausente";
  motivo?: string;
  updatedAt: string;
};

const JORNADAS_KEY = "pf-control-asistencias-jornadas-v1";
const REGISTROS_KEY = "pf-control-asistencias-registros-v1";

export default function AsistenciasPage() {
  const { categorias } = useCategories();
  const { jugadoras } = usePlayers();
  const { sesiones } = useSessions();

  const [jornadas, setJornadas] = useSharedState<JornadaEntrenamiento[]>([], {
    key: JORNADAS_KEY,
    legacyLocalStorageKey: JORNADAS_KEY,
  });
  const [registros, setRegistros] = useSharedState<AsistenciaRegistro[]>([], {
    key: REGISTROS_KEY,
    legacyLocalStorageKey: REGISTROS_KEY,
  });

  const [selectedCategoria, setSelectedCategoria] = useState("todas");
  const [selectedJornadaId, setSelectedJornadaId] = useState<string | null>(null);
  const [filtroFecha, setFiltroFecha] = useState("");
  const [suspensionModalJornadaId, setSuspensionModalJornadaId] = useState<string | null>(null);
  const [suspensionMotivo, setSuspensionMotivo] = useState("");
  const [suspensionError, setSuspensionError] = useState("");

  const [nuevaJornada, setNuevaJornada] = useState({
    titulo: "",
    categoria: "",
    fecha: "",
    hora: "",
    ubicacion: "",
    notas: "",
    sesionId: "",
  });

  const categoriasOptions = useMemo(() => {
    const fromCategorias = categorias
      .filter((cat) => cat.habilitada)
      .map((cat) => cat.nombre);
    const fromJugadoras = jugadoras
      .map((j) => (j.categoria || "").trim())
      .filter(Boolean);

    return Array.from(new Set([...fromCategorias, ...fromJugadoras])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [categorias, jugadoras]);

  const sesionesPorCategoria = useMemo(() => {
    const categoria = nuevaJornada.categoria;
    if (!categoria) return [];
    return sesiones.filter(
      (sesion) =>
        sesion.asignacionTipo === "jugadoras" &&
        (sesion.categoriaAsignada || "").trim() === categoria
    );
  }, [nuevaJornada.categoria, sesiones]);

  const jornadasFiltradas = useMemo(() => {
    return jornadas
      .filter((jornada) => {
        if (selectedCategoria !== "todas" && jornada.categoria !== selectedCategoria) return false;
        if (filtroFecha && jornada.fecha !== filtroFecha) return false;
        return true;
      })
      .sort((a, b) => {
        const aDate = `${a.fecha}T${a.hora || "00:00"}`;
        const bDate = `${b.fecha}T${b.hora || "00:00"}`;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
  }, [filtroFecha, jornadas, selectedCategoria]);

  const selectedJornada = useMemo(
    () => jornadas.find((jornada) => jornada.id === selectedJornadaId) || null,
    [jornadas, selectedJornadaId]
  );

  const jugadorasDisponibles = useMemo(() => {
    if (!selectedJornada) return [];
    return jugadoras
      .filter((jugadora) => (jugadora.categoria || "") === selectedJornada.categoria)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [jugadoras, selectedJornada]);

  const getRegistro = (jornadaId: string, jugadoraNombre: string) => {
    return registros.find(
      (registro) =>
        registro.jornadaId === jornadaId && registro.jugadoraNombre === jugadoraNombre
    );
  };

  const guardarEstado = (
    jornadaId: string,
    jugadoraNombre: string,
    estado: "presente" | "ausente",
    motivo?: string
  ) => {
    const cleanMotivo = (motivo || "").trim();
    setRegistros((prev) => {
      const existing = prev.find(
        (item) => item.jornadaId === jornadaId && item.jugadoraNombre === jugadoraNombre
      );

      if (existing) {
        return prev.map((item) => {
          if (item.jornadaId !== jornadaId || item.jugadoraNombre !== jugadoraNombre) {
            return item;
          }
          return {
            ...item,
            estado,
            motivo: estado === "ausente" && cleanMotivo ? cleanMotivo : undefined,
            updatedAt: new Date().toISOString(),
          };
        });
      }

      return [
        ...prev,
        {
          jornadaId,
          jugadoraNombre,
          estado,
          motivo: estado === "ausente" && cleanMotivo ? cleanMotivo : undefined,
          updatedAt: new Date().toISOString(),
        },
      ];
    });
  };

  const crearJornada = () => {
    if (!nuevaJornada.categoria || !nuevaJornada.fecha || !nuevaJornada.hora) {
      return;
    }

    const sesionSeleccionada = sesiones.find((sesion) => sesion.id === nuevaJornada.sesionId);
    const tituloFinal =
      nuevaJornada.titulo.trim() || sesionSeleccionada?.titulo || "Jornada de entrenamiento";

    const jornadaNueva: JornadaEntrenamiento = {
      id: Date.now().toString(),
      titulo: tituloFinal,
      categoria: nuevaJornada.categoria,
      fecha: nuevaJornada.fecha,
      hora: nuevaJornada.hora,
      ubicacion: nuevaJornada.ubicacion.trim() || undefined,
      notas: nuevaJornada.notas.trim() || undefined,
      sesionId: nuevaJornada.sesionId || undefined,
    };

    setJornadas((prev) => [jornadaNueva, ...prev]);
    setSelectedJornadaId(jornadaNueva.id);
    setNuevaJornada({
      titulo: "",
      categoria: nuevaJornada.categoria,
      fecha: "",
      hora: "",
      ubicacion: "",
      notas: "",
      sesionId: "",
    });
  };

  const eliminarJornada = (jornadaId: string) => {
    if (!confirm("¿Eliminar jornada y sus asistencias?")) return;

    setJornadas((prev) => prev.filter((item) => item.id !== jornadaId));
    setRegistros((prev) => prev.filter((item) => item.jornadaId !== jornadaId));
    if (selectedJornadaId === jornadaId) {
      setSelectedJornadaId(null);
    }
  };

  const suspenderJornada = (jornadaId: string, motivo: string) => {
    const cleanMotivo = motivo.trim();
    if (!cleanMotivo) {
      return;
    }

    setJornadas((prev) =>
      prev.map((item) =>
        item.id === jornadaId
          ? {
              ...item,
              suspendida: true,
              motivoSuspension: cleanMotivo,
              suspendidaAt: new Date().toISOString(),
            }
          : item
      )
    );
  };

  const abrirModalSuspension = (jornadaId: string) => {
    setSuspensionModalJornadaId(jornadaId);
    setSuspensionMotivo("");
    setSuspensionError("");
  };

  const cerrarModalSuspension = () => {
    setSuspensionModalJornadaId(null);
    setSuspensionMotivo("");
    setSuspensionError("");
  };

  const confirmarSuspension = () => {
    if (!suspensionModalJornadaId) return;
    const cleanMotivo = suspensionMotivo.trim();
    if (!cleanMotivo) {
      setSuspensionError("Debes indicar un motivo para suspender la jornada.");
      return;
    }

    suspenderJornada(suspensionModalJornadaId, cleanMotivo);
    cerrarModalSuspension();
  };

  useEffect(() => {
    if (!suspensionModalJornadaId) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cerrarModalSuspension();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [suspensionModalJornadaId]);

  const reactivarJornada = (jornadaId: string) => {
    setJornadas((prev) =>
      prev.map((item) =>
        item.id === jornadaId
          ? {
              ...item,
              suspendida: false,
              motivoSuspension: undefined,
              suspendidaAt: undefined,
            }
          : item
      )
    );
  };

  const resumen = useMemo(() => {
    if (!selectedJornada) return { presentes: 0, ausentes: 0, sinCargar: 0 };

    const total = jugadorasDisponibles.length;
    const presentes = jugadorasDisponibles.filter((jugadora) => {
      const registro = getRegistro(selectedJornada.id, jugadora.nombre);
      return registro?.estado === "presente";
    }).length;
    const ausentes = jugadorasDisponibles.filter((jugadora) => {
      const registro = getRegistro(selectedJornada.id, jugadora.nombre);
      return registro?.estado === "ausente";
    }).length;

    return {
      presentes,
      ausentes,
      sinCargar: Math.max(total - presentes - ausentes, 0),
    };
  }, [jugadorasDisponibles, registros, selectedJornada]);

  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Categoria operativa
          </p>
          <h1 className="text-3xl font-black">Asistencias</h1>
          <p className="mt-1 text-sm text-slate-300">
            Jornadas por dia y hora, con control de presentes y ausentes por categoria.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sesiones"
            className="rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Ver sesiones
          </Link>
          <Link
            href="/plantel"
            className="rounded-xl bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
          >
            Ir a plantel
          </Link>
        </div>
      </div>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-lg font-bold text-white">Nueva jornada</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Categoria
            </label>
            <select
              value={nuevaJornada.categoria}
              onChange={(e) =>
                setNuevaJornada((prev) => ({
                  ...prev,
                  categoria: e.target.value,
                  sesionId: "",
                }))
              }
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Seleccionar categoria</option>
              {categoriasOptions.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Dia
            </label>
            <input
              type="date"
              value={nuevaJornada.fecha}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, fecha: e.target.value }))
              }
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Hora
            </label>
            <input
              type="time"
              value={nuevaJornada.hora}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, hora: e.target.value }))
              }
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Sesion (opcional)
            </label>
            <select
              value={nuevaJornada.sesionId}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, sesionId: e.target.value }))
              }
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              disabled={!nuevaJornada.categoria}
            >
              <option value="">Sin sesion vinculada</option>
              {sesionesPorCategoria.map((sesion) => (
                <option key={sesion.id} value={sesion.id}>
                  {sesion.titulo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Titulo (opcional)
            </label>
            <input
              value={nuevaJornada.titulo}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, titulo: e.target.value }))
              }
              placeholder="Ej: Jornada tecnica"
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Ubicacion (opcional)
            </label>
            <input
              value={nuevaJornada.ubicacion}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, ubicacion: e.target.value }))
              }
              placeholder="Cancha 1"
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
            Notas (opcional)
          </label>
          <textarea
            value={nuevaJornada.notas}
            onChange={(e) =>
              setNuevaJornada((prev) => ({ ...prev, notas: e.target.value }))
            }
            rows={2}
            className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            placeholder="Objetivo de la jornada, indicaciones..."
          />
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={crearJornada}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
          >
            Crear jornada
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
        <div className="rounded-3xl border border-white/15 bg-slate-900/70 p-5">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                Filtrar categoria
              </label>
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="todas">Todas</option>
                {categoriasOptions.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                Filtrar fecha
              </label>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <h3 className="text-lg font-bold text-white">Jornadas</h3>
          <div className="mt-3 space-y-2">
            {jornadasFiltradas.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-4 text-sm text-slate-300">
                No hay jornadas cargadas para este filtro.
              </p>
            ) : (
              jornadasFiltradas.map((jornada) => {
                const active = jornada.id === selectedJornadaId;
                return (
                  <div
                    key={jornada.id}
                    className={`rounded-xl border px-3 py-3 transition ${
                      active
                        ? "border-cyan-300/40 bg-cyan-500/10"
                        : "border-white/10 bg-slate-950/45"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedJornadaId(jornada.id)}
                      className="w-full text-left"
                    >
                      <p className="font-semibold text-white">{jornada.titulo}</p>
                      <p className="text-xs text-slate-300">
                        {jornada.categoria} · {jornada.fecha} · {jornada.hora}
                      </p>
                      {jornada.suspendida ? (
                        <p className="mt-1 inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                          Jornada suspendida
                        </p>
                      ) : null}
                      {jornada.ubicacion ? (
                        <p className="text-xs text-slate-400">{jornada.ubicacion}</p>
                      ) : null}
                    </button>

                    <div className="mt-2 flex justify-end gap-2">
                      {jornada.suspendida ? (
                        <button
                          type="button"
                          onClick={() => reactivarJornada(jornada.id)}
                          className="rounded-lg border border-emerald-300/35 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10"
                        >
                          Reactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirModalSuspension(jornada.id)}
                          className="rounded-lg border border-amber-300/35 px-2 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/10"
                        >
                          Suspender
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => eliminarJornada(jornada.id)}
                        className="rounded-lg border border-rose-300/35 px-2 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/15 bg-slate-900/70 p-5">
          {!selectedJornada ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-sm text-slate-300">
              Selecciona una jornada para cargar asistencia.
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-white">{selectedJornada.titulo}</h3>
                  <p className="text-sm text-slate-300">
                    {selectedJornada.categoria} · {selectedJornada.fecha} · {selectedJornada.hora}
                  </p>
                  {selectedJornada.suspendida ? (
                    <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                      Jornada suspendida. Motivo: {selectedJornada.motivoSuspension || "Sin motivo"}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  {selectedJornada.suspendida ? (
                    <button
                      type="button"
                      onClick={() => reactivarJornada(selectedJornada.id)}
                      className="rounded-full border border-emerald-300/40 px-3 py-1 text-emerald-100 hover:bg-emerald-500/10"
                    >
                      Reactivar jornada
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => abrirModalSuspension(selectedJornada.id)}
                      className="rounded-full border border-amber-300/40 px-3 py-1 text-amber-100 hover:bg-amber-500/10"
                    >
                      Suspender jornada
                    </button>
                  )}
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-100">
                    Presentes: {resumen.presentes}
                  </span>
                  <span className="rounded-full bg-rose-500/20 px-2 py-1 text-rose-100">
                    Ausentes: {resumen.ausentes}
                  </span>
                  <span className="rounded-full bg-slate-700/60 px-2 py-1 text-slate-100">
                    Sin cargar: {resumen.sinCargar}
                  </span>
                </div>
              </div>

              {jugadorasDisponibles.length === 0 ? (
                <p className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-4 text-sm text-amber-100">
                  No hay jugadoras disponibles para la categoria seleccionada.
                </p>
              ) : (
                <div className="space-y-2">
                  {jugadorasDisponibles.map((jugadora) => {
                    const registro = getRegistro(selectedJornada.id, jugadora.nombre);
                    const estado = registro?.estado;
                    return (
                      <div
                        key={`${selectedJornada.id}-${jugadora.nombre}`}
                        className="rounded-xl border border-white/10 bg-slate-950/50 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{jugadora.nombre}</p>
                            <p className="text-xs text-slate-300">{jugadora.posicion || "Sin posicion"}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                guardarEstado(selectedJornada.id, jugadora.nombre, "presente")
                              }
                              disabled={Boolean(selectedJornada.suspendida)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                estado === "presente"
                                  ? "bg-emerald-400 text-slate-950"
                                  : "border border-emerald-300/40 text-emerald-100 hover:bg-emerald-500/10"
                              } disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                              Presente
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                guardarEstado(
                                  selectedJornada.id,
                                  jugadora.nombre,
                                  "ausente",
                                  registro?.motivo
                                )
                              }
                              disabled={Boolean(selectedJornada.suspendida)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                estado === "ausente"
                                  ? "bg-rose-400 text-slate-950"
                                  : "border border-rose-300/40 text-rose-100 hover:bg-rose-500/10"
                              } disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                              Ausente
                            </button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Motivo de ausencia (opcional)
                          </label>
                          <input
                            value={registro?.motivo || ""}
                            onChange={(e) =>
                              guardarEstado(
                                selectedJornada.id,
                                jugadora.nombre,
                                estado === "ausente" ? "ausente" : "presente",
                                e.target.value
                              )
                            }
                            disabled={Boolean(selectedJornada.suspendida)}
                            placeholder="Ej: lesion, estudio, viaje..."
                            className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {suspensionModalJornadaId ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4"
          onClick={cerrarModalSuspension}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-amber-300/30 bg-slate-900 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-amber-100">Suspender jornada</h3>
              <button
                type="button"
                onClick={cerrarModalSuspension}
                className="rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200"
              >
                Cerrar
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Esta accion bloquea la carga de asistencia hasta reactivar la jornada.
            </p>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                Motivo (obligatorio)
              </label>
              <textarea
                value={suspensionMotivo}
                onChange={(e) => {
                  setSuspensionMotivo(e.target.value);
                  if (suspensionError) setSuspensionError("");
                }}
                rows={3}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Ej: lluvia intensa, cancha cerrada, protocolo medico..."
              />
              {suspensionError ? (
                <p className="mt-1 text-xs font-semibold text-rose-200">{suspensionError}</p>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarModalSuspension}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarSuspension}
                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
              >
                Confirmar suspension
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
