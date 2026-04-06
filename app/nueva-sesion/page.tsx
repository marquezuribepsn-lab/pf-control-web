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

  function goToSesiones() {
    router.replace("/sesiones");
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

    goToSesiones();
  }

  return (
    <main className="mx-auto max-w-5xl p-6 text-slate-100">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-900 via-cyan-950/45 to-slate-900 p-6 shadow-[0_20px_70px_rgba(6,182,212,0.14)]">
        <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/80">
              Flujo dedicado
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Nueva sesion
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
              Crea una sesion en pantalla exclusiva y vuelve a Sesiones cuando termines.
            </p>
          </div>

          <button
            type="button"
            onClick={goToSesiones}
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Volver a Sesiones
          </button>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-2xl border border-white/15 bg-slate-900/80 p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Título de la sesión
            </label>
            <input
              value={form.titulo}
              onChange={(e) => updateField("titulo", e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
              placeholder="Ej: Fuerza tren inferior + aceleración"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-200">Objetivo</label>
            <input
              value={form.objetivo}
              onChange={(e) => updateField("objetivo", e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
              placeholder="Ej: Desarrollar fuerza y aceleración inicial"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Duración (min)
            </label>
            <input
              value={form.duracion}
              onChange={(e) => updateField("duracion", e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
              placeholder="Ej: 70"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">Asignar a</label>
            <select
              value={form.asignacionTipo}
              onChange={(e) => updateField("asignacionTipo", e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
            >
              <option value="jugadoras">Jugadoras</option>
              <option value="alumnos">Alumno/a</option>
            </select>
          </div>

          {form.asignacionTipo === "jugadoras" ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Categoría de jugadoras</label>
                <select
                  value={form.categoriaAsignada}
                  onChange={(e) => {
                    updateField("categoriaAsignada", e.target.value);
                    updateField("jugadoraAsignada", "");
                  }}
                  className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
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
                <label className="mb-1 block text-sm font-medium text-slate-200">
                  Jugadora (opcional)
                </label>
                <select
                  value={form.jugadoraAsignada}
                  onChange={(e) => updateField("jugadoraAsignada", e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
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
              <label className="mb-1 block text-sm font-medium text-slate-200">Alumno/a</label>
              <select
                value={form.alumnoAsignado}
                onChange={(e) => updateField("alumnoAsignado", e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
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

          <div className="md:col-span-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            Los bloques se cargan y editan después de crear la sesión, desde la pantalla de sesiones.
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={goToSesiones}
            className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Volver sin guardar
          </button>
          <button
            type="submit"
            className="rounded-xl border border-cyan-100/40 bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
          >
            Guardar sesión
          </button>
        </div>
      </form>
    </main>
  );
}