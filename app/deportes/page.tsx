"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useState } from "react";
import { useDeportes } from "../../components/DeportesProvider";

export default function DeportesPage() {
  const { deportes, agregarDeporte, toggleDeporte, eliminarDeporte, actualizarDeporte } = useDeportes();
  const [nuevoDeporte, setNuevoDeporte] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevaPosicion, setNuevaPosicion] = useState("");

  const handleAgregarDeporte = () => {
    if (nuevoDeporte.trim()) {
      agregarDeporte({ nombre: nuevoDeporte.trim(), habilitado: true, posiciones: [] });
      setNuevoDeporte("");
    }
  };

  const handleAgregarPosicion = (deporteNombre: string) => {
    if (nuevaPosicion.trim()) {
      const deporte = deportes.find(d => d.nombre === deporteNombre);
      if (deporte) {
        actualizarDeporte(deporteNombre, {
          posiciones: [...deporte.posiciones, nuevaPosicion.trim()]
        });
        setNuevaPosicion("");
      }
    }
  };

  const handleEliminarPosicion = (deporteNombre: string, posicion: string) => {
    const deporte = deportes.find(d => d.nombre === deporteNombre);
    if (deporte) {
      actualizarDeporte(deporteNombre, {
        posiciones: deporte.posiciones.filter(p => p !== posicion)
      });
    }
  };

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Deportes</h1>
        <p className="text-sm text-neutral-600">
          Gestión de deportes disponibles.
        </p>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Agregar nuevo deporte</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={nuevoDeporte}
            onChange={(e) => setNuevoDeporte(e.target.value)}
            placeholder="Nombre del deporte"
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
          />
          <ReliableActionButton
            onClick={handleAgregarDeporte}
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Agregar
          </ReliableActionButton>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {deportes.map((deporte) => (
          <div
            key={deporte.nombre}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">{deporte.nombre}</h2>
              <div className="flex gap-2">
                <ReliableActionButton
                  onClick={() => toggleDeporte(deporte.nombre)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    deporte.habilitado
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {deporte.habilitado ? "Habilitado" : "Deshabilitado"}
                </ReliableActionButton>
                <ReliableActionButton
                  onClick={() => eliminarDeporte(deporte.nombre)}
                  className="rounded-full px-3 py-1 text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                >
                  Eliminar
                </ReliableActionButton>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Posiciones:</h3>
              <ul className="space-y-1">
                {deporte.posiciones.map((pos, index) => (
                  <li key={index} className="flex items-center justify-between text-sm">
                    <span>{pos}</span>
                    <ReliableActionButton 
                      onClick={() => handleEliminarPosicion(deporte.nombre, pos)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </ReliableActionButton>
                  </li>
                ))}
              </ul>
              {editando === deporte.nombre && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={nuevaPosicion}
                    onChange={(e) => setNuevaPosicion(e.target.value)}
                    placeholder="Nueva posición"
                    className="flex-1 rounded border px-2 py-1 text-sm"
                  />
                  <ReliableActionButton
                    onClick={() => handleAgregarPosicion(deporte.nombre)}
                    className="rounded bg-neutral-900 px-3 py-1 text-sm text-white"
                  >
                    +
                  </ReliableActionButton>
                </div>
              )}
              <ReliableActionButton
                onClick={() => setEditando(editando === deporte.nombre ? null : deporte.nombre)}
                className="mt-2 text-sm text-neutral-600 hover:text-neutral-900"
              >
                {editando === deporte.nombre ? "Cancelar" : "Editar posiciones"}
              </ReliableActionButton>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
