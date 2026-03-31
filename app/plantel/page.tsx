"use client";

import { useState } from "react";
import { usePlayers } from "../../components/PlayersProvider";

export default function PlantelPage() {
  const { jugadoras, editarJugadora, eliminarJugadora } = usePlayers();
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Plantel</h1>
        <p className="text-sm text-neutral-600">
          Vista general de jugadoras y estado actual.
        </p>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm text-neutral-500">Total jugadoras</p>
        <h2 className="mt-2 text-2xl font-semibold">{jugadoras.length}</h2>
      </div>

      <div className="grid gap-4">
        {jugadoras.map((jugadora) => (
          <div
            key={jugadora.nombre}
            className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {editando === jugadora.nombre ? (
                  <div className="mb-2">
                    <input
                      type="text"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-lg font-semibold"
                      placeholder="Nuevo nombre"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          if (nuevoNombre.trim()) {
                            editarJugadora(jugadora.nombre, { nombre: nuevoNombre.trim() });
                            setEditando(null);
                            setNuevoNombre("");
                          }
                        }}
                        className="rounded-lg bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => {
                          setEditando(null);
                          setNuevoNombre("");
                        }}
                        className="rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold">{jugadora.nombre}</h2>
                )}
                <p className="text-sm text-neutral-600">
                  {jugadora.posicion}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {jugadora.categoria} · {jugadora.club}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-right text-sm text-neutral-600">
                  <p>Wellness: {jugadora.wellness}</p>
                  <p>Carga: {jugadora.carga}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditando(jugadora.nombre);
                      setNuevoNombre(jugadora.nombre);
                    }}
                    className="rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Estás seguro de que quieres eliminar a ${jugadora.nombre}?`)) {
                        eliminarJugadora(jugadora.nombre);
                      }
                    }}
                    className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>

            {(jugadora.objetivo || jugadora.observaciones) && (
              <div className="mt-4 rounded-xl border border-neutral-200 p-3 text-sm text-neutral-700">
                <p>
                  <span className="font-medium">Objetivo:</span>{" "}
                  {jugadora.objetivo || "-"}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Observaciones:</span>{" "}
                  {jugadora.observaciones || "-"}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}