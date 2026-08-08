"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
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
    <div className="pf-v2-page">
      <header className="pf-v2-page-head">
        <div>
          <span className="pf-v2-tagline">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.2" /><rect x="11" y="3" width="6" height="6" rx="1.2" /><rect x="3" y="11" width="6" height="6" rx="1.2" /><rect x="11" y="11" width="6" height="6" rx="1.2" /></svg>
            Categoría operativa
          </span>
          <h1 className="pf-v2-title">Asistencias</h1>
          <p className="pf-v2-title-sub">Jornadas por día y hora, con control de presentes y ausentes por categoría.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/sesiones" className="pf-v2-btn pf-v2-btn-2">Ver sesiones</Link>
          <Link href="/clientes?seccion=plantel" className="pf-v2-btn">Ir a plantel</Link>
        </div>
      </header>

      <section className="pf-v2-card">
        <h2 className="pf-v2-h2">Nueva jornada</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="pf-v2-field-label">
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
              className="pf-v2-input"
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
            <label className="pf-v2-field-label">
              Dia
            </label>
            <input
              type="date"
              value={nuevaJornada.fecha}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, fecha: e.target.value }))
              }
              className="pf-v2-input"
            />
          </div>

          <div>
            <label className="pf-v2-field-label">
              Hora
            </label>
            <input
              type="time"
              value={nuevaJornada.hora}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, hora: e.target.value }))
              }
              className="pf-v2-input"
            />
          </div>

          <div>
            <label className="pf-v2-field-label">
              Sesion (opcional)
            </label>
            <select
              value={nuevaJornada.sesionId}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, sesionId: e.target.value }))
              }
              className="pf-v2-input"
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
            <label className="pf-v2-field-label">
              Titulo (opcional)
            </label>
            <input
              value={nuevaJornada.titulo}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, titulo: e.target.value }))
              }
              placeholder="Ej: Jornada tecnica"
              className="pf-v2-input"
            />
          </div>

          <div>
            <label className="pf-v2-field-label">
              Ubicacion (opcional)
            </label>
            <input
              value={nuevaJornada.ubicacion}
              onChange={(e) =>
                setNuevaJornada((prev) => ({ ...prev, ubicacion: e.target.value }))
              }
              placeholder="Cancha 1"
              className="pf-v2-input"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="pf-v2-field-label">
            Notas (opcional)
          </label>
          <textarea
            value={nuevaJornada.notas}
            onChange={(e) =>
              setNuevaJornada((prev) => ({ ...prev, notas: e.target.value }))
            }
            rows={2}
            className="pf-v2-input"
            placeholder="Objetivo de la jornada, indicaciones..."
          />
        </div>

        <div className="mt-4">
          <ReliableActionButton
            type="button"
            onClick={crearJornada}
            className="pf-v2-btn"
          >
            Crear jornada
          </ReliableActionButton>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
        <div className="pf-v2-card">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="pf-v2-field-label">
                Filtrar categoria
              </label>
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="pf-v2-input"
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
              <label className="pf-v2-field-label">
                Filtrar fecha
              </label>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="pf-v2-input"
              />
            </div>
          </div>

          <h3 className="text-lg font-bold pf-v2-t">Jornadas</h3>
          <div className="mt-3 space-y-2">
            {jornadasFiltradas.length === 0 ? (
              <p className="pf-v2-card pf-v2-muted" style={{ padding: "16px 14px" }}>
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
                        ? "pf-v2-b-blue pf-v2-s-blue"
                        : "pf-v2-b pf-v2-s"
                    }`}
                  >
                    <ReliableActionButton
                      type="button"
                      onClick={() => setSelectedJornadaId(jornada.id)}
                      className="w-full text-left pf-v2-t"
                    >
                      <p style={{ fontWeight: 600 }}>{jornada.titulo}</p>
                      <p className="pf-v2-muted" style={{ fontSize: 12 }}>
                        {jornada.categoria} · {jornada.fecha} · {jornada.hora}
                      </p>
                      {jornada.suspendida ? (
                        <p className="pf-v2-chip pf-v2-chip-warn" style={{ marginTop: 4 }}>
                          Jornada suspendida
                        </p>
                      ) : null}
                      {jornada.ubicacion ? (
                        <p className="pf-v2-muted" style={{ fontSize: 12 }}>{jornada.ubicacion}</p>
                      ) : null}
                    </ReliableActionButton>

                    <div className="mt-2 flex justify-end gap-2">
                      {jornada.suspendida ? (
                        <ReliableActionButton
                          type="button"
                          onClick={() => reactivarJornada(jornada.id)}
                          className="pf-v2-option" style={{ padding: "6px 12px", fontSize: 12 }}
                        >
                          Reactivar
                        </ReliableActionButton>
                      ) : (
                        <ReliableActionButton
                          type="button"
                          onClick={() => abrirModalSuspension(jornada.id)}
                          className="pf-v2-option" style={{ padding: "6px 12px", fontSize: 12 }}
                        >
                          Suspender
                        </ReliableActionButton>
                      )}
                      <ReliableActionButton
                        type="button"
                        onClick={() => eliminarJornada(jornada.id)}
                        className="pf-v2-option" style={{ padding: "6px 12px", fontSize: 12 }}
                      >
                        Eliminar
                      </ReliableActionButton>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="pf-v2-card">
          {!selectedJornada ? (
            <div className="pf-v2-card pf-v2-muted">
              Selecciona una jornada para cargar asistencia.
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black pf-v2-t">{selectedJornada.titulo}</h3>
                  <p className="pf-v2-muted">
                    {selectedJornada.categoria} · {selectedJornada.fecha} · {selectedJornada.hora}
                  </p>
                  {selectedJornada.suspendida ? (
                    <p className="pf-v2-chip pf-v2-chip-warn" style={{ marginTop: 8 }}>
                      Jornada suspendida. Motivo: {selectedJornada.motivoSuspension || "Sin motivo"}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  {selectedJornada.suspendida ? (
                    <ReliableActionButton
                      type="button"
                      onClick={() => reactivarJornada(selectedJornada.id)}
                      className="pf-v2-chip pf-v2-chip-ok" style={{ cursor: "pointer" }}
                    >
                      Reactivar jornada
                    </ReliableActionButton>
                  ) : (
                    <ReliableActionButton
                      type="button"
                      onClick={() => abrirModalSuspension(selectedJornada.id)}
                      className="pf-v2-chip pf-v2-chip-warn" style={{ cursor: "pointer" }}
                    >
                      Suspender jornada
                    </ReliableActionButton>
                  )}
                  <span className="pf-v2-chip pf-v2-chip-ok">
                    Presentes: {resumen.presentes}
                  </span>
                  <span className="pf-v2-chip pf-v2-chip-danger">
                    Ausentes: {resumen.ausentes}
                  </span>
                  <span className="pf-v2-chip">
                    Sin cargar: {resumen.sinCargar}
                  </span>
                </div>
              </div>

              {jugadorasDisponibles.length === 0 ? (
                <p className="pf-v2-alert" style={{ borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.1)", color: "#fde68a" }}>
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
                        className="pf-v2-card" style={{ padding: 14 }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p style={{ fontWeight: 600 }}>{jugadora.nombre}</p>
                            <p className="pf-v2-muted" style={{ fontSize: 12 }}>{jugadora.posicion || "Sin posicion"}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <ReliableActionButton
                              type="button"
                              onClick={() =>
                                guardarEstado(selectedJornada.id, jugadora.nombre, "presente")
                              }
                              disabled={Boolean(selectedJornada.suspendida)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                estado === "presente"
                                  ? "pf-v2-s-ok pf-v2-t"
                                  : "border pf-v2-b-ok pf-v2-t-ok pf-v2-hover"
                              }disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                              Presente
                            </ReliableActionButton>
                            <ReliableActionButton
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
                                  ? "pf-v2-s-danger pf-v2-t"
                                  : "border pf-v2-b-danger pf-v2-t-danger pf-v2-hover"
                              }disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                              Ausente
                            </ReliableActionButton>
                          </div>
                        </div>

                        <div className="mt-2">
                          <label className="pf-v2-field-label">
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
                            className="pf-v2-input"
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
          className="fixed inset-0 z-[80] flex items-center justify-center pf-v2-s-deep p-4"
          onClick={cerrarModalSuspension}
        >
          <div
            className="pf-v2-card" style={{ width: "100%", maxWidth: 520, borderColor: "rgba(251,191,36,0.3)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold pf-v2-t-warn">Suspender jornada</h3>
              <ReliableActionButton
                type="button"
                onClick={cerrarModalSuspension}
                className="rounded-lg border pf-v2-b-hi px-3 py-1 text-xs font-semibold pf-v2-t"
              >
                Cerrar
              </ReliableActionButton>
            </div>

            <p className="pf-v2-muted">
              Esta accion bloquea la carga de asistencia hasta reactivar la jornada.
            </p>

            <div className="mt-3">
              <label className="pf-v2-field-label">
                Motivo (obligatorio)
              </label>
              <textarea
                value={suspensionMotivo}
                onChange={(e) => {
                  setSuspensionMotivo(e.target.value);
                  if (suspensionError) setSuspensionError("");
                }}
                rows={3}
                className="pf-v2-input"
                placeholder="Ej: lluvia intensa, cancha cerrada, protocolo medico..."
              />
              {suspensionError ? (
                <p className="mt-1 text-xs font-semibold pf-v2-t-danger">{suspensionError}</p>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <ReliableActionButton
                type="button"
                onClick={cerrarModalSuspension}
                className="pf-v2-btn pf-v2-btn-2"
              >
                Cancelar
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={confirmarSuspension}
                className="pf-v2-btn"
              >
                Confirmar suspension
              </ReliableActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
