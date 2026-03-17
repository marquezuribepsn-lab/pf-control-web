"use client";

import { useState } from "react";

export default function NuevaJugadoraPage() {
  const [form, setForm] = useState({
    nombre: "",
    fechaNacimiento: "",
    altura: "",
    peso: "",
    deporte: "Fútbol",
    categoria: "Primera",
    club: "Club Atlético Ejemplo",
    objetivo: "",
    posicion: "",
    observaciones: "",
  });

  function updateField(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    alert("Jugadora guardada (por ahora de ejemplo)");
    console.log(form);
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nueva jugadora</h1>
        <p className="text-sm text-neutral-600">
          Carga de datos básicos del plantel.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Nombre completo
            </label>
            <input
              value={form.nombre}
              onChange={(e) => updateField("nombre", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
              placeholder="Ej: Sofía Gómez"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Fecha de nacimiento
            </label>
            <input
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) =>
                updateField("fechaNacimiento", e.target.value)
              }
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Altura (cm)</label>
            <input
              value={form.altura}
              onChange={(e) => updateField("altura", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
              placeholder="Ej: 168"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Peso (kg)</label>
            <input
              value={form.peso}
              onChange={(e) => updateField("peso", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
              placeholder="Ej: 60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Deporte</label>
            <input
              value={form.deporte}
              onChange={(e) => updateField("deporte", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Categoría</label>
            <input
              value={form.categoria}
              onChange={(e) => updateField("categoria", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Club</label>
            <input
              value={form.club}
              onChange={(e) => updateField("club", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Posición</label>
            <input
              value={form.posicion}
              onChange={(e) => updateField("posicion", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
              placeholder="Ej: Volante"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Objetivo</label>
          <input
            value={form.objetivo}
            onChange={(e) => updateField("objetivo", e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            placeholder="Ej: Potencia y prevención"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">
            Observaciones
          </label>
          <textarea
            value={form.observaciones}
            onChange={(e) => updateField("observaciones", e.target.value)}
            className="min-h-[120px] w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            placeholder="Notas generales"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Guardar jugadora
          </button>
        </div>
      </form>
    </main>
  );
}