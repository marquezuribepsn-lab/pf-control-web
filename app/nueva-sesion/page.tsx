"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSessions } from "../../components/SessionsProvider";
import { useCategories } from "../../components/CategoriesProvider";
import { useAlumnos } from "../../components/AlumnosProvider";
import { usePlayers } from "../../components/PlayersProvider";

export default function NuevaSesionPage() {
  const router = useRouter();
  const { agregarSesion } = useSessions();
  const { categorias } = useCategories();
  const { alumnos } = useAlumnos();
  const { jugadoras } = usePlayers();

  const [form, setForm] = useState({
    titulo: "",
    objetivo: "",
    duracion: "",
    asignacionTipo: "jugadoras" as "jugadoras" | "alumnos",
    categoriaAsignada: "Primera",
    jugadoraAsignada: "",
    alumnoAsignado: "",
  });

  const jugadorasFiltradas = useMemo(
    () =>
      jugadoras.filter(
        (jugadora) =>
          jugadora.categoria === form.categoriaAsignada &&
          (jugadora.deporte || "").trim().length > 0
      ),
    [form.categoriaAsignada, jugadoras]
  );

  function updateField(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const equipoDerivado =
      form.asignacionTipo === "jugadoras"
        ? `Categoria: ${form.categoriaAsignada || "Sin categoria"}`
        : `Alumno/a: ${form.alumnoAsignado || "Sin asignar"}`;

    agregarSesion({
      titulo: form.titulo,
      objetivo: form.objetivo,
      duracion: form.duracion || "0",
      equipo: equipoDerivado,
      asignacionTipo: form.asignacionTipo,
      categoriaAsignada:
        form.asignacionTipo === "jugadoras" ? form.categoriaAsignada : undefined,
      jugadoraAsignada:
        form.asignacionTipo === "jugadoras" ? form.jugadoraAsignada || undefined : undefined,
      alumnoAsignado:
        form.asignacionTipo === "alumnos" ? form.alumnoAsignado : undefined,
      bloques: [],
    });

    router.push("/sesiones");
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nueva sesión</h1>
        <p className="text-sm text-neutral-600">
          Carga de una nueva sesión de entrenamiento.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Título de la sesión
            </label>
            <input
              value={form.titulo}
              onChange={(e) => updateField("titulo", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
              placeholder="Ej: Fuerza tren inferior + aceleración"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Objetivo</label>
            <input
              value={form.objetivo}
              onChange={(e) => updateField("objetivo", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
              placeholder="Ej: Desarrollar fuerza y aceleración inicial"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Duración (min)
            </label>
            <input
              value={form.duracion}
              onChange={(e) => updateField("duracion", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
              placeholder="Ej: 70"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Asignar a</label>
            <select
              value={form.asignacionTipo}
              onChange={(e) => updateField("asignacionTipo", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
            >
              <option value="jugadoras">Jugadoras</option>
              <option value="alumnos">Alumno/a</option>
            </select>
          </div>

          {form.asignacionTipo === "jugadoras" ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Categoría de jugadoras</label>
                <select
                  value={form.categoriaAsignada}
                  onChange={(e) => {
                    updateField("categoriaAsignada", e.target.value);
                    updateField("jugadoraAsignada", "");
                  }}
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
                >
                  {categorias
                    .filter((cat) => cat.habilitada)
                    .map((cat) => (
                      <option key={cat.nombre} value={cat.nombre}>
                        {cat.nombre}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Jugadora (opcional)
                </label>
                <select
                  value={form.jugadoraAsignada}
                  onChange={(e) => updateField("jugadoraAsignada", e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
                >
                  <option value="">Todas las jugadoras de la categoría</option>
                  {jugadorasFiltradas.map((jugadora) => (
                    <option key={jugadora.nombre} value={jugadora.nombre}>
                      {jugadora.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">Alumno/a</label>
              <select
                value={form.alumnoAsignado}
                onChange={(e) => updateField("alumnoAsignado", e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
                required={form.asignacionTipo === "alumnos"}
              >
                <option value="">Seleccionar alumno/a</option>
                {alumnos.map((alumno) => (
                  <option key={alumno.nombre} value={alumno.nombre}>
                    {alumno.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            Los bloques se cargan y editan después de crear la sesión, desde la pantalla de sesiones.
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Guardar sesión
          </button>
        </div>
      </form>
    </main>
  );
}