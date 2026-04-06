"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useMemo, useState } from "react";
import { usePlayers } from "../../components/PlayersProvider";
import { useSharedState } from "../../components/useSharedState";

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

const JORNADAS_KEY = "pf-control-asistencias-jornadas-v1";
const REGISTROS_KEY = "pf-control-asistencias-registros-v1";

export default function PlantelPage() {
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
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Plantel</h1>
          <p className="text-sm text-slate-300">Gestion de jugadoras con contexto de asistencias y jornadas.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/asistencias"
            className="rounded-xl border border-cyan-300/35 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
          >
            Asistencias
          </Link>
          <Link
            href="/registros"
            className="rounded-xl border border-violet-300/35 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/10"
          >
            Registros
          </Link>
        </div>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-cyan-100">Jugadoras</p>
          <p className="text-3xl font-black text-white">{stats.totalJugadoras}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-100">Jornadas activas</p>
          <p className="text-3xl font-black text-white">{stats.jornadasActivas}</p>
        </div>
        <div className="rounded-2xl border border-lime-300/30 bg-lime-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-lime-100">Presentes</p>
          <p className="text-3xl font-black text-white">{stats.presentes}</p>
        </div>
        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-rose-100">Ausentes</p>
          <p className="text-3xl font-black text-white">{stats.ausentes}</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300">Presentismo</p>
          <p className="text-3xl font-black text-white">{stats.presentismo}%</p>
        </div>
      </section>

      <section className="grid gap-4">
        {jugadoras.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            No hay jugadoras cargadas en el plantel.
          </p>
        )}

        {jugadoras.map((jugadora) => (
          <div
            key={jugadora.nombre}
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {editando === jugadora.nombre ? (
                  <div className="mb-2">
                    <input
                      type="text"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-lg font-semibold text-white"
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
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500"
                      >
                        Guardar
                      </ReliableActionButton>
                      <ReliableActionButton
                        onClick={() => {
                          setEditando(null);
                          setNuevoNombre("");
                        }}
                        className="rounded-lg border border-white/20 px-3 py-1 text-sm text-slate-200 hover:bg-white/10"
                      >
                        Cancelar
                      </ReliableActionButton>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold text-white">{jugadora.nombre}</h2>
                )}

                <p className="text-sm text-slate-300">{jugadora.posicion}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {jugadora.categoria} · {jugadora.club}
                </p>
                <p className="mt-2 text-xs text-cyan-100">
                  Proximas jornadas en su categoria: {proximasJornadasByCategoria.get(jugadora.categoria || "") || 0}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-right text-sm text-slate-300">
                  <p>Wellness: {jugadora.wellness}</p>
                  <p>Carga: {jugadora.carga}</p>
                  <p>
                    Asistencia: {asistenciaByJugadora.get(jugadora.nombre)?.presentes || 0} P / {asistenciaByJugadora.get(jugadora.nombre)?.ausentes || 0} A
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Link
                    href={`/asistencias?categoria=${encodeURIComponent(jugadora.categoria || "")}`}
                    className="rounded-lg border border-cyan-300/35 px-3 py-1 text-sm text-cyan-100 hover:bg-cyan-500/10"
                  >
                    Asistencia
                  </Link>
                  <ReliableActionButton
                    onClick={() => {
                      setEditando(jugadora.nombre);
                      setNuevoNombre(jugadora.nombre);
                    }}
                    className="rounded-lg border border-white/20 px-3 py-1 text-sm text-slate-100 hover:bg-white/10"
                  >
                    Editar
                  </ReliableActionButton>
                  <ReliableActionButton
                    onClick={() => {
                      if (confirm(`Eliminar a ${jugadora.nombre}?`)) {
                        eliminarJugadora(jugadora.nombre);
                      }
                    }}
                    className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                  >
                    Eliminar
                  </ReliableActionButton>
                </div>
              </div>
            </div>

            {(jugadora.objetivo || jugadora.observaciones) && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-800/60 p-3 text-sm text-slate-200">
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
    </main>
  );
}
