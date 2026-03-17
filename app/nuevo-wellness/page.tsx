"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWellness } from "../../components/WellnessProvider";

export default function NuevoWellnessPage() {
  const router = useRouter();
  const { agregarWellness } = useWellness();

  const [form, setForm] = useState({
    nombre: "",
    bienestar: "7",
    fatiga: "3",
    dolor: "1",
    disponibilidad: "Disponible",
    comentario: "",
  });

  function updateField(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    agregarWellness({
      nombre: form.nombre,
      bienestar: Number(form.bienestar),
      fatiga: Number(form.fatiga),
      dolor: Number(form.dolor),
      disponibilidad: form.disponibilidad,
      comentario: form.comentario,
    });

    router.push("/wellness");
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nuevo wellness</h1>
        <p className="text-sm text-neutral-600">
          Carga diaria de bienestar, fatiga, dolor y disponibilidad.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) => updateField("nombre", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
              placeholder="Ej: Sofía Gómez"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Bienestar</label>
            <input
              type="number"
              min="1"
              max="10"
              value={form.bienestar}
              onChange={(e) => updateField("bienestar", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Fatiga</label>
            <input
              type="number"
              min="1"
              max="10"
              value={form.fatiga}
              onChange={(e) => updateField("fatiga", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Dolor</label>
            <input
              type="number"
              min="0"
              max="10"
              value={form.dolor}
              onChange={(e) => updateField("dolor", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Disponibilidad
            </label>
            <select
              value={form.disponibilidad}
              onChange={(e) => updateField("disponibilidad", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            >
              <option>Disponible</option>
              <option>Limitada</option>
              <option>No disponible</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Comentario</label>
          <textarea
            value={form.comentario}
            onChange={(e) => updateField("comentario", e.target.value)}
            className="min-h-[120px] w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            placeholder="Notas del estado diario"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Guardar wellness
          </button>
        </div>
      </form>
    </main>
  );
}