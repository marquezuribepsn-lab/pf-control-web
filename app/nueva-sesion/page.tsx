"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSessions } from "../../components/SessionsProvider";
import { useCategories } from "../../components/CategoriesProvider";
import { useAlumnos } from "../../components/AlumnosProvider";
import { usePlayers } from "../../components/PlayersProvider";

const NUEVA_SESION_DRAFT_KEY = "pf-control-nueva-sesion-draft-v1";

const QUICK_TEMPLATES = [
  {
    id: "fuerza",
    label: "Fuerza",
    titulo: "Fuerza de tren inferior",
    objetivo: "Desarrollar fuerza maxima y control tecnico en ejercicios base",
    duracion: "70",
  },
  {
    id: "velocidad",
    label: "Velocidad",
    titulo: "Velocidad y aceleracion",
    objetivo: "Mejorar aceleracion inicial y cambios de ritmo en distancias cortas",
    duracion: "55",
  },
  {
    id: "recuperacion",
    label: "Recuperacion",
    titulo: "Recuperacion activa",
    objetivo: "Reducir fatiga acumulada con movilidad, core y activacion ligera",
    duracion: "45",
  },
] as const;

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
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [skipNextDraftSave, setSkipNextDraftSave] = useState(false);

  const jugadorasFiltradas = useMemo(
    () =>
      jugadoras.filter(
        (jugadora) =>
          jugadora.categoria === form.categoriaAsignada &&
          (jugadora.deporte || "").trim().length > 0
      ),
    [form.categoriaAsignada, jugadoras]
  );

  const categoriasHabilitadas = useMemo(
    () => categorias.filter((cat) => cat.habilitada),
    [categorias]
  );

  const errors = useMemo(() => {
    const next: Partial<Record<string, string>> = {};

    if (form.titulo.trim().length < 5) {
      next.titulo = "El titulo debe tener al menos 5 caracteres";
    }

    if (form.objetivo.trim().length < 8) {
      next.objetivo = "El objetivo debe tener al menos 8 caracteres";
    }

    const duracionRaw = form.duracion.trim();
    if (duracionRaw.length > 0) {
      const duracionNumber = Number(duracionRaw);
      const isInteger = /^\d+$/.test(duracionRaw);

      if (!isInteger || Number.isNaN(duracionNumber)) {
        next.duracion = "La duracion debe ser un numero entero";
      } else if (duracionNumber < 10 || duracionNumber > 240) {
        next.duracion = "La duracion recomendada es entre 10 y 240 minutos";
      }
    }

    if (form.asignacionTipo === "jugadoras") {
      if (!form.categoriaAsignada.trim()) {
        next.categoriaAsignada = "Selecciona una categoria";
      }

      if (categoriasHabilitadas.length === 0) {
        next.categoriaAsignada = "No hay categorias habilitadas para asignar";
      }

      if (
        form.jugadoraAsignada.trim() &&
        !jugadorasFiltradas.some((jugadora) => jugadora.nombre === form.jugadoraAsignada)
      ) {
        next.jugadoraAsignada = "La jugadora seleccionada no pertenece al filtro actual";
      }
    }

    if (form.asignacionTipo === "alumnos" && !form.alumnoAsignado.trim()) {
      next.alumnoAsignado = "Selecciona un alumno/a para continuar";
    }

    return next;
  }, [categoriasHabilitadas.length, form, jugadorasFiltradas]);

  const hasErrors = Object.keys(errors).length > 0;

  const showFieldError = (field: keyof typeof errors, hasValue: boolean) => {
    if (!errors[field]) return null;
    if (submitAttempted || hasValue) return errors[field];
    return null;
  };

  const draftStatusText = useMemo(() => {
    if (!draftHydrated) {
      return "Cargando borrador...";
    }

    if (!draftSavedAt) {
      return "Borrador automatico activo";
    }

    return `Borrador guardado · ${new Date(draftSavedAt).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }, [draftHydrated, draftSavedAt]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NUEVA_SESION_DRAFT_KEY);
      if (!raw) {
        setDraftHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<typeof form>;
      setForm((prev) => ({
        ...prev,
        titulo: typeof parsed.titulo === "string" ? parsed.titulo : prev.titulo,
        objetivo: typeof parsed.objetivo === "string" ? parsed.objetivo : prev.objetivo,
        duracion: typeof parsed.duracion === "string" ? parsed.duracion : prev.duracion,
        asignacionTipo:
          parsed.asignacionTipo === "jugadoras" || parsed.asignacionTipo === "alumnos"
            ? parsed.asignacionTipo
            : prev.asignacionTipo,
        categoriaAsignada:
          typeof parsed.categoriaAsignada === "string"
            ? parsed.categoriaAsignada
            : prev.categoriaAsignada,
        jugadoraAsignada:
          typeof parsed.jugadoraAsignada === "string"
            ? parsed.jugadoraAsignada
            : prev.jugadoraAsignada,
        alumnoAsignado:
          typeof parsed.alumnoAsignado === "string"
            ? parsed.alumnoAsignado
            : prev.alumnoAsignado,
      }));
    } catch {
      // no bloquear formulario si falla el parseo del borrador
    } finally {
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    if (skipNextDraftSave) {
      setSkipNextDraftSave(false);
      return;
    }

    localStorage.setItem(NUEVA_SESION_DRAFT_KEY, JSON.stringify(form));
    setDraftSavedAt(Date.now());
  }, [draftHydrated, form, skipNextDraftSave]);

  function updateField(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);

    if (hasErrors) {
      return;
    }

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

    localStorage.removeItem(NUEVA_SESION_DRAFT_KEY);

    window.dispatchEvent(
      new CustomEvent("pf-inline-toast", {
        detail: {
          type: "success",
          title: "Sesion creada",
          message: "La sesion se guardo correctamente",
        },
      })
    );

    router.push("/sesiones");
  }

  function applyQuickTemplate(templateId: (typeof QUICK_TEMPLATES)[number]["id"]) {
    const template = QUICK_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      titulo: template.titulo,
      objetivo: template.objetivo,
      duracion: template.duracion,
    }));

    window.dispatchEvent(
      new CustomEvent("pf-inline-toast", {
        detail: {
          type: "success",
          title: "Plantilla aplicada",
          message: `Se cargo la plantilla ${template.label}`,
        },
      })
    );
  }

  function clearDraftAndForm() {
    localStorage.removeItem(NUEVA_SESION_DRAFT_KEY);
    setSkipNextDraftSave(true);
    setDraftSavedAt(null);
    setSubmitAttempted(false);

    setForm((prev) => ({
      titulo: "",
      objetivo: "",
      duracion: "",
      asignacionTipo: prev.asignacionTipo,
      categoriaAsignada: categoriasHabilitadas[0]?.nombre || "Primera",
      jugadoraAsignada: "",
      alumnoAsignado: "",
    }));

    window.dispatchEvent(
      new CustomEvent("pf-inline-toast", {
        detail: {
          type: "warning",
          title: "Borrador eliminado",
          message: "Se limpio el formulario de nueva sesion",
        },
      })
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-3 py-4 sm:p-6">
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-900 via-[#10233a] to-[#0a172f] p-5 shadow-[0_22px_60px_rgba(2,12,27,0.38)] sm:p-6">
        <div className="pointer-events-none absolute -top-20 right-0 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-0 h-44 w-44 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center rounded-full border border-cyan-200/35 bg-cyan-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">
            Planificacion
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">Nueva sesión</h1>
          <p className="mt-1 text-sm font-medium text-cyan-100/90 sm:text-base">
            Carga una sesión y definí su asignación en menos de un minuto.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/55 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/85">Asignación</p>
              <p className="mt-1 text-sm font-semibold text-white">{form.asignacionTipo === "jugadoras" ? "Jugadoras" : "Alumnos"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/55 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/85">Categorías activas</p>
              <p className="mt-1 text-sm font-semibold text-white">{categoriasHabilitadas.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/55 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/85">Jugadoras en filtro</p>
              <p className="mt-1 text-sm font-semibold text-white">{jugadorasFiltradas.length}</p>
            </div>
          </div>

          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100/80">
            {draftStatusText}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_48px_rgba(2,12,27,0.36)] backdrop-blur-sm sm:p-6"
      >
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100/90">
            Plantillas rapidas
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyQuickTemplate(template.id)}
                className="rounded-xl border border-cyan-200/35 bg-cyan-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-cyan-100 hover:bg-cyan-400/20"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-black uppercase tracking-[0.08em] text-cyan-100">
              Título de la sesión
            </label>
            <input
              value={form.titulo}
              onChange={(e) => updateField("titulo", e.target.value)}
              className="w-full rounded-2xl border border-cyan-200/25 bg-slate-800/75 px-4 py-3.5 text-white outline-none transition focus:border-cyan-300/65 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="Ej: Fuerza tren inferior + aceleración"
              required
            />
            {showFieldError("titulo", form.titulo.trim().length > 0) ? (
              <p className="mt-1 text-xs text-rose-300">{showFieldError("titulo", form.titulo.trim().length > 0)}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-black uppercase tracking-[0.08em] text-cyan-100">Objetivo</label>
            <input
              value={form.objetivo}
              onChange={(e) => updateField("objetivo", e.target.value)}
              className="w-full rounded-2xl border border-cyan-200/25 bg-slate-800/75 px-4 py-3.5 text-white outline-none transition focus:border-cyan-300/65 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="Ej: Desarrollar fuerza y aceleración inicial"
              required
            />
            {showFieldError("objetivo", form.objetivo.trim().length > 0) ? (
              <p className="mt-1 text-xs text-rose-300">{showFieldError("objetivo", form.objetivo.trim().length > 0)}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-black uppercase tracking-[0.08em] text-cyan-100">
              Duración (min)
            </label>
            <input
              value={form.duracion}
              onChange={(e) => updateField("duracion", e.target.value)}
              className="w-full rounded-2xl border border-cyan-200/25 bg-slate-800/75 px-4 py-3.5 text-white outline-none transition focus:border-cyan-300/65 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="Ej: 70"
            />
            {showFieldError("duracion", form.duracion.trim().length > 0) ? (
              <p className="mt-1 text-xs text-rose-300">{showFieldError("duracion", form.duracion.trim().length > 0)}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-black uppercase tracking-[0.08em] text-cyan-100">Asignar a</label>
            <select
              value={form.asignacionTipo}
              onChange={(e) => updateField("asignacionTipo", e.target.value)}
              className="w-full rounded-2xl border border-cyan-200/25 bg-slate-800/75 px-4 py-3.5 text-white outline-none transition focus:border-cyan-300/65 focus:ring-2 focus:ring-cyan-300/30"
            >
              <option value="jugadoras">Jugadoras</option>
              <option value="alumnos">Alumno/a</option>
            </select>
          </div>

          {form.asignacionTipo === "jugadoras" ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-black uppercase tracking-[0.08em] text-cyan-100">Categoría de jugadoras</label>
                <select
                  value={form.categoriaAsignada}
                  onChange={(e) => {
                    updateField("categoriaAsignada", e.target.value);
                    updateField("jugadoraAsignada", "");
                  }}
                  className="w-full rounded-2xl border border-cyan-200/25 bg-slate-800/75 px-4 py-3.5 text-white outline-none transition focus:border-cyan-300/65 focus:ring-2 focus:ring-cyan-300/30"
                >
                  {categoriasHabilitadas.map((cat) => (
                      <option key={cat.nombre} value={cat.nombre}>
                        {cat.nombre}
                      </option>
                    ))}
                </select>
                {showFieldError("categoriaAsignada", form.categoriaAsignada.trim().length > 0) ? (
                  <p className="mt-1 text-xs text-rose-300">{showFieldError("categoriaAsignada", form.categoriaAsignada.trim().length > 0)}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-black uppercase tracking-[0.08em] text-cyan-100">
                  Jugadora (opcional)
                </label>
                <select
                  value={form.jugadoraAsignada}
                  onChange={(e) => updateField("jugadoraAsignada", e.target.value)}
                  className="w-full rounded-2xl border border-cyan-200/25 bg-slate-800/75 px-4 py-3.5 text-white outline-none transition focus:border-cyan-300/65 focus:ring-2 focus:ring-cyan-300/30"
                >
                  <option value="">Todas las jugadoras de la categoría</option>
                  {jugadorasFiltradas.map((jugadora) => (
                    <option key={jugadora.nombre} value={jugadora.nombre}>
                      {jugadora.nombre}
                    </option>
                  ))}
                </select>
                {showFieldError("jugadoraAsignada", form.jugadoraAsignada.trim().length > 0) ? (
                  <p className="mt-1 text-xs text-rose-300">{showFieldError("jugadoraAsignada", form.jugadoraAsignada.trim().length > 0)}</p>
                ) : null}
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-black uppercase tracking-[0.08em] text-cyan-100">Alumno/a</label>
              <select
                value={form.alumnoAsignado}
                onChange={(e) => updateField("alumnoAsignado", e.target.value)}
                className="w-full rounded-2xl border border-cyan-200/25 bg-slate-800/75 px-4 py-3.5 text-white outline-none transition focus:border-cyan-300/65 focus:ring-2 focus:ring-cyan-300/30"
                required={form.asignacionTipo === "alumnos"}
              >
                <option value="">Seleccionar alumno/a</option>
                {alumnos.map((alumno) => (
                  <option key={alumno.nombre} value={alumno.nombre}>
                    {alumno.nombre}
                  </option>
                ))}
              </select>
              {showFieldError("alumnoAsignado", form.alumnoAsignado.trim().length > 0) ? (
                <p className="mt-1 text-xs text-rose-300">{showFieldError("alumnoAsignado", form.alumnoAsignado.trim().length > 0)}</p>
              ) : null}
            </div>
          )}

          <div className="md:col-span-2 rounded-2xl border border-cyan-200/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">
            Los bloques se cargan y editan después de crear la sesión, desde la pantalla de sesiones.
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">
              Guardado directo y redirección automática a sesiones
            </p>
            <button
              type="button"
              onClick={clearDraftAndForm}
              disabled={!draftHydrated}
              className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Limpiar borrador
            </button>
          </div>
          <button
            type="submit"
            disabled={!draftHydrated}
            className="w-full rounded-2xl border border-cyan-200/35 bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 px-6 py-3 text-sm font-black text-slate-950 shadow-[0_10px_28px_rgba(45,212,191,0.32)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            Guardar sesión
          </button>
        </div>
      </form>
    </main>
  );
}