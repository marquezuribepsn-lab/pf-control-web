"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useMemo, useState } from "react";
import { usePlayers } from "../components/PlayersProvider";
import { useSharedState } from "../components/useSharedState";

type JornadaEntrenamiento = {
  id: string;
  categoria: string;
  fecha: string;
  suspendida?: boolean;
};

type AsistenciaRegistro = {
  jornadaId: string;
  jugadoraNombre: string;
  estado: "presente" | "ausente";
};

type PlantelPanelProps = {
  embedded?: boolean;
};

const JORNADAS_KEY = "pf-control-asistencias-jornadas-v1";
const REGISTROS_KEY = "pf-control-asistencias-registros-v1";

export default function PlantelPanel({ embedded = false }: PlantelPanelProps) {
  const { jugadoras, editarJugadora, eliminarJugadora } = usePlayers();
  const [jornadas] = useSharedState<JornadaEntrenamiento[]>([], {
    key: JORNADAS_KEY,
    legacyLocalStorageKey: JORNADAS_KEY,
  });
  const [registros] = useSharedState<AsistenciaRegistro[]>([], {
    key: REGISTROS_KEY,
    legacyLocalStorageKey: REGISTROS_KEY,
  });

  const [editando, setEditando] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");

  const stats = useMemo(() => {
    const presentes = registros.filter((item) => item.estado === "presente").length;
    const ausentes = registros.filter((item) => item.estado === "ausente").length;
    const totalRegistros = presentes + ausentes;
    const presentismo = totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0;

    return {
      totalJugadoras: jugadoras.length,
      jornadasActivas: jornadas.filter((jornada) => !jornada.suspendida).length,
      presentes,
      ausentes,
      presentismo,
    };
  }, [jornadas, jugadoras.length, registros]);

  const asistenciaByJugadora = useMemo(() => {
    const map = new Map<string, { presentes: number; ausentes: number }>();

    for (const registro of registros) {
      const current = map.get(registro.jugadoraNombre) || { presentes: 0, ausentes: 0 };
      if (registro.estado === "presente") {
        current.presentes += 1;
      } else {
        current.ausentes += 1;
      }
      map.set(registro.jugadoraNombre, current);
    }

    return map;
  }, [registros]);

  const proximasJornadasByCategoria = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map = new Map<string, number>();

    for (const jornada of jornadas) {
      if (jornada.suspendida || jornada.fecha < today) continue;
      const categoria = (jornada.categoria || "").trim();
      if (!categoria) continue;
      map.set(categoria, (map.get(categoria) || 0) + 1);
    }

    return map;
  }, [jornadas]);

  return (
    <section className={embedded ? "rounded-3xl border pf-v2-b-hi pf-v2-s-deep p-6 shadow-lg" : ""}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] pf-v2-t-accent">Clientes · Vista integrada</p>
          <h2 className="text-3xl font-black">Plantel</h2>
          <p className="text-sm pf-v2-t-70">Gestion de jugadoras con contexto de asistencias y jornadas.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/asistencias"
            className="rounded-xl border pf-v2-b-accent px-3 py-2 text-xs font-semibold pf-v2-t-accent pf-v2-hover"
          >
            Asistencias
          </Link>
          <Link
            href="/registros"
            className="rounded-xl border pf-v2-b-violet px-3 py-2 text-xs font-semibold pf-v2-t-violet pf-v2-hover"
          >
            Registros
          </Link>
        </div>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border pf-v2-b-accent pf-v2-s-accent p-4">
          <p className="text-xs uppercase tracking-wide pf-v2-t-accent">Jugadoras</p>
          <p className="text-3xl font-black pf-v2-t">{stats.totalJugadoras}</p>
        </div>
        <div className="rounded-2xl border pf-v2-b-ok pf-v2-s-ok p-4">
          <p className="text-xs uppercase tracking-wide pf-v2-t-ok">Jornadas activas</p>
          <p className="text-3xl font-black pf-v2-t">{stats.jornadasActivas}</p>
        </div>
        <div className="rounded-2xl border pf-v2-b-ok pf-v2-s-ok p-4">
          <p className="text-xs uppercase tracking-wide pf-v2-t-ok">Presentes</p>
          <p className="text-3xl font-black pf-v2-t">{stats.presentes}</p>
        </div>
        <div className="rounded-2xl border pf-v2-b-danger pf-v2-s-danger p-4">
          <p className="text-xs uppercase tracking-wide pf-v2-t-danger">Ausentes</p>
          <p className="text-3xl font-black pf-v2-t">{stats.ausentes}</p>
        </div>
        <div className="rounded-2xl border pf-v2-b-hi pf-v2-s-deep p-4">
          <p className="text-xs uppercase tracking-wide pf-v2-t-70">Presentismo</p>
          <p className="text-3xl font-black pf-v2-t">{stats.presentismo}%</p>
        </div>
      </section>

      <section className="grid gap-4">
        {jugadoras.length === 0 && (
          <p className="rounded-2xl border pf-v2-b pf-v2-s-deep p-4 text-sm pf-v2-t-70">
            No hay jugadoras cargadas en el plantel.
          </p>
        )}

        {jugadoras.map((jugadora) => (
          <div
            key={jugadora.nombre}
            className="rounded-2xl border pf-v2-b pf-v2-s-deep p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {editando === jugadora.nombre ? (
                  <div className="mb-2">
                    <input
                      type="text"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      className="w-full rounded-lg border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-lg font-semibold pf-v2-t"
                      placeholder="Nuevo nombre"
                    />
                    <div className="mt-2 flex gap-2">
                      <ReliableActionButton
                        onClick={() => {
                          const trimmed = nuevoNombre.trim();
                          if (trimmed && trimmed !== jugadora.nombre) {
                            editarJugadora(jugadora.nombre, { nombre: trimmed });
                          }
                          setEditando(null);
                          setNuevoNombre("");
                        }}
                        className="rounded-lg pf-v2-s-ok px-3 py-1 text-sm pf-v2-t pf-v2-hover"
                      >
                        Guardar
                      </ReliableActionButton>
                      <ReliableActionButton
                        onClick={() => {
                          setEditando(null);
                          setNuevoNombre("");
                        }}
                        className="rounded-lg border pf-v2-b-hi px-3 py-1 text-sm pf-v2-t pf-v2-hover"
                      >
                        Cancelar
                      </ReliableActionButton>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold pf-v2-t">{jugadora.nombre}</h2>
                )}

                <p className="text-sm pf-v2-t-70">{jugadora.posicion}</p>
                <p className="mt-1 text-xs pf-v2-t-50">
                  {jugadora.categoria} · {jugadora.club}
                </p>
                <p className="mt-2 text-xs pf-v2-t-accent">
                  Proximas jornadas en su categoria: {proximasJornadasByCategoria.get(jugadora.categoria || "") || 0}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-right text-sm pf-v2-t-70">
                  <p>Wellness: {jugadora.wellness}</p>
                  <p>Carga: {jugadora.carga}</p>
                  <p>
                    Asistencia: {asistenciaByJugadora.get(jugadora.nombre)?.presentes || 0} P / {asistenciaByJugadora.get(jugadora.nombre)?.ausentes || 0} A
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Link
                    href={`/asistencias?categoria=${encodeURIComponent(jugadora.categoria || "")}`}
                    className="rounded-lg border pf-v2-b-accent px-3 py-1 text-sm pf-v2-t-accent pf-v2-hover"
                  >
                    Asistencia
                  </Link>
                  <ReliableActionButton
                    onClick={() => {
                      setEditando(jugadora.nombre);
                      setNuevoNombre(jugadora.nombre);
                    }}
                    className="rounded-lg border pf-v2-b-hi px-3 py-1 text-sm pf-v2-t pf-v2-hover"
                  >
                    Editar
                  </ReliableActionButton>
                  <ReliableActionButton
                    onClick={() => {
                      if (confirm(`Eliminar a ${jugadora.nombre}?`)) {
                        eliminarJugadora(jugadora.nombre);
                      }
                    }}
                    className="rounded-lg pf-v2-s-danger px-3 py-1 text-sm pf-v2-t pf-v2-hover"
                  >
                    Eliminar
                  </ReliableActionButton>
                </div>
              </div>
            </div>

            {(jugadora.objetivo || jugadora.observaciones) && (
              <div className="mt-4 rounded-xl border pf-v2-b pf-v2-s-deep p-3 text-sm pf-v2-t">
                <p>
                  <span className="font-medium">Objetivo:</span> {jugadora.objetivo || "-"}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Observaciones:</span> {jugadora.observaciones || "-"}
                </p>
              </div>
            )}
          </div>
        ))}
      </section>
    </section>
  );
}