"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSessions } from "../../components/SessionsProvider";
import { useCategories } from "../../components/CategoriesProvider";
import { useAlumnos } from "../../components/AlumnosProvider";
import { usePlayers } from "../../components/PlayersProvider";

function resolveReturnTo(rawValue: string | null): string {
  const raw = (rawValue || "").trim();
  if (!raw) {
    return "/sesiones";
  }

  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return "/sesiones";
  }

  return raw;
}

export default function NuevaSesionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { agregarSesion } = useSessions();
  const { categorias } = useCategories();
  const { alumnos } = useAlumnos();
  const { jugadoras } = usePlayers();

  const returnTo = useMemo(() => resolveReturnTo(searchParams.get("returnTo")), [searchParams]);

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
    () => jugadoras.filter((jugadora) => jugadora.categoria === form.categoriaAsignada),
    [form.categoriaAsignada, jugadoras]
  );

  function updateField(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function goToPreviousScreen() {
    const beforeNavigation = `${window.location.pathname}${window.location.search}`;
    router.replace(returnTo);

    // Fallback duro por si la navegacion SPA queda bloqueada por algun guard.
    window.setTimeout(() => {
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === beforeNavigation) {
        window.location.assign(returnTo);
      }
    }, 420);
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

    goToPreviousScreen();
  }

  return (
    <main className="mx-auto max-w-5xl p-6 pf-v2-t">
      <section className="relative overflow-hidden rounded-3xl border pf-v2-b-accent p-6">
        <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full pf-v2-s-accent blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-8 h-32 w-32 rounded-full pf-v2-s-ok blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] pf-v2-t-accent">
              Flujo dedicado
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight pf-v2-t">
              Nueva sesion
            </h1>
            <p className="mt-2 max-w-2xl text-sm pf-v2-t">
              Crea una sesion en pantalla exclusiva y vuelve a Sesiones cuando termines.
            </p>
          </div>

          <Link
            href={returnTo}
            className="rounded-xl border pf-v2-b-hi pf-v2-s-hi px-4 py-2 text-sm font-semibold pf-v2-t transition pf-v2-hover"
          >
            Volver a Sesiones
          </Link>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-2xl border pf-v2-b-hi pf-v2-s-deep p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium pf-v2-t">
              Título de la sesión
            </label>
            <input
              value={form.titulo}
              onChange={(e) => updateField("titulo", e.target.value)}
              className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-3 pf-v2-t outline-none"
              placeholder="Ej: Fuerza tren inferior + aceleración"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium pf-v2-t">Objetivo</label>
            <input
              value={form.objetivo}
              onChange={(e) => updateField("objetivo", e.target.value)}
              className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-3 pf-v2-t outline-none"
              placeholder="Ej: Desarrollar fuerza y aceleración inicial"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium pf-v2-t">
              Duración (min)
            </label>
            <input
              value={form.duracion}
              onChange={(e) => updateField("duracion", e.target.value)}
              className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-3 pf-v2-t outline-none"
              placeholder="Ej: 70"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium pf-v2-t">Asignar a</label>
            <select
              value={form.asignacionTipo}
              onChange={(e) => updateField("asignacionTipo", e.target.value)}
              className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-3 pf-v2-t outline-none"
            >
              <option value="jugadoras">Jugadoras</option>
              <option value="alumnos">Alumno/a</option>
            </select>
          </div>

          {form.asignacionTipo === "jugadoras" ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium pf-v2-t">Categoría de jugadoras</label>
                <select
                  value={form.categoriaAsignada}
                  onChange={(e) => {
                    updateField("categoriaAsignada", e.target.value);
                    updateField("jugadoraAsignada", "");
                  }}
                  className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-3 pf-v2-t outline-none"
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
                <label className="mb-1 block text-sm font-medium pf-v2-t">
                  Jugadora (opcional)
                </label>
                <select
                  value={form.jugadoraAsignada}
                  onChange={(e) => updateField("jugadoraAsignada", e.target.value)}
                  className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-3 pf-v2-t outline-none"
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
              <label className="mb-1 block text-sm font-medium pf-v2-t">Alumno/a</label>
              <select
                value={form.alumnoAsignado}
                onChange={(e) => updateField("alumnoAsignado", e.target.value)}
                className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-3 pf-v2-t outline-none"
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

          <div className="md:col-span-2 rounded-xl border pf-v2-b-accent pf-v2-s-accent p-3 text-sm pf-v2-t-accent">
            Los bloques se cargan y editan después de crear la sesión, desde la pantalla de sesiones.
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Link
            href={returnTo}
            className="rounded-xl border pf-v2-b-hi px-5 py-3 text-sm font-semibold pf-v2-t transition pf-v2-hover"
          >
            Volver sin guardar
          </Link>
          <ReliableActionButton
            type="submit"
            className="rounded-xl border pf-v2-b-accent pf-v2-s-accent px-5 py-3 text-sm font-black pf-v2-t transition pf-v2-hover"
          >
            Guardar sesión
          </ReliableActionButton>
        </div>
      </form>
    </main>
  );
}
