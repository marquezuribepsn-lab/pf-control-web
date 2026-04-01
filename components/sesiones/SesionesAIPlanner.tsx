"use client";

import { useMemo, useState } from "react";
import { useSessions } from "../SessionsProvider";
import { useEjercicios } from "../EjerciciosProvider";

import type {
  TrainingPlan,
  TrainingPlanEvent,
  TrainingPlanSession,
  TrainingPlanWeek,
} from "@/lib/trainingPlanAI";

type PlannerResponse = {
  ok: boolean;
  plan?: TrainingPlan;
  error?: string;
  message?: string;
};

type DraftEvent = {
  date: string;
  type: "partido" | "especial" | "control";
  description: string;
  importance: number;
};

const CAPABILITY_OPTIONS = [
  "fuerza",
  "velocidad",
  "resistencia",
  "potencia",
  "movilidad",
  "tecnica",
] as const;

const LEVEL_OPTIONS = [
  { value: "iniciacion", label: "Iniciacion" },
  { value: "desarrollo", label: "Desarrollo" },
  { value: "rendimiento", label: "Rendimiento" },
  { value: "elite", label: "Elite" },
] as const;

const parseList = (raw: string) =>
  raw
    .split(/[\n,;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const guessExerciseCategory = (name: string) => {
  const normalized = normalizeText(name);
  if (normalized.includes("sprint") || normalized.includes("aceler")) return "Velocidad";
  if (normalized.includes("salto") || normalized.includes("pliometr")) return "Potencia";
  if (normalized.includes("movilidad") || normalized.includes("respiracion")) return "Core";
  if (normalized.includes("intermit") || normalized.includes("aerob")) return "Condicion";
  if (normalized.includes("tecnica") || normalized.includes("rondo") || normalized.includes("juego")) return "Tecnica";
  return "Fuerza";
};

const TODAY = new Date().toISOString().slice(0, 10);

export default function SesionesAIPlanner() {
  const { agregarSesion } = useSessions();
  const { ejercicios, agregarEjercicio } = useEjercicios();

  const [targetName, setTargetName] = useState("Plan IA Equipo");
  const [targetType, setTargetType] = useState<"jugadoras" | "alumnos">("alumnos");
  const [sport, setSport] = useState("Futbol");
  const [category, setCategory] = useState("General");
  const [weeks, setWeeks] = useState(8);
  const [extendWeeks, setExtendWeeks] = useState(4);
  const [ageMin, setAgeMin] = useState(16);
  const [ageMax, setAgeMax] = useState(24);
  const [level, setLevel] = useState("desarrollo");
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([
    "fuerza",
    "velocidad",
    "resistencia",
  ]);
  const [objectivesText, setObjectivesText] = useState("fuerza, velocidad, resistencia");
  const [constraintsText, setConstraintsText] = useState(
    "sin saltos de carga mayores al 10%, asegurar tecnica en edades formativas"
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionDurationMin, setSessionDurationMin] = useState(75);
  const [startDate, setStartDate] = useState(TODAY);
  const [notes, setNotes] = useState("Plan con progresion realista y control de carga por contexto competitivo");
  const [weekToImport, setWeekToImport] = useState(1);
  const [weekToRecalculate, setWeekToRecalculate] = useState(1);
  const [recalcWellness, setRecalcWellness] = useState(7);
  const [recalcDelta, setRecalcDelta] = useState(0);
  const [recalcNote, setRecalcNote] = useState("Ajuste por disponibilidad y carga real");
  const [events, setEvents] = useState<DraftEvent[]>([
    { date: "", type: "partido", description: "", importance: 3 },
  ]);

  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loadingAction, setLoadingAction] = useState<"create" | "extend" | "recalculate" | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const availableSessions = useMemo(
    () => plan?.weeks.reduce((acc, week) => acc + week.sessions.length, 0) || 0,
    [plan]
  );

  const progressionSummary = useMemo(() => {
    if (!plan) return [];
    return plan.weeklyProgression.slice(0, 12);
  }, [plan]);

  const weekOptions = useMemo(() => {
    if (!plan) return [] as number[];
    return plan.weeks.map((week) => week.weekNumber);
  }, [plan]);

  const normalizedExerciseMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const exercise of ejercicios) {
      map.set(normalizeText(exercise.nombre), exercise.id);
    }
    return map;
  }, [ejercicios]);

  const parsedEvents = useMemo(
    () =>
      events
        .filter((event) => event.date && event.description.trim())
        .map((event) => ({
          date: event.date,
          type: event.type,
          description: event.description.trim(),
          importance: event.importance,
        })),
    [events]
  );

  const toggleCapability = (capability: string) => {
    setSelectedCapabilities((prev) => {
      if (prev.includes(capability)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== capability);
      }
      return [...prev, capability];
    });
  };

  const updateEvent = (index: number, changes: Partial<DraftEvent>) => {
    setEvents((prev) => prev.map((event, idx) => (idx === index ? { ...event, ...changes } : event)));
  };

  const addEvent = () => {
    setEvents((prev) => [...prev, { date: "", type: "especial", description: "", importance: 3 }]);
  };

  const removeEvent = (index: number) => {
    setEvents((prev) => prev.filter((_, idx) => idx !== index));
  };

  const callAi = async (mode: "create" | "extend" | "recalculate") => {
    setLoadingAction(mode);
    setError("");
    setMessage("");

    try {
      const payload =
        mode === "create"
          ? {
              mode: "create",
              targetType,
              targetName,
              sport,
              category,
              ageMin,
              ageMax,
              level,
              objectives: parseList(objectivesText),
              capabilities: selectedCapabilities,
              constraints: parseList(constraintsText),
              sessionsPerWeek,
              sessionDurationMin,
              weeks,
              startDate,
              notes,
              events: parsedEvents,
            }
          : mode === "extend"
          ? {
              mode: "extend",
              existingPlan: plan,
              weeks: extendWeeks,
              events: parsedEvents,
            }
          : {
              mode: "recalculate-week",
              existingPlan: plan,
              weekNumber: weekToRecalculate,
              wellnessScore: recalcWellness,
              externalLoadDelta: recalcDelta,
              note: recalcNote,
            };

      const response = await fetch("/api/sesiones/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as PlannerResponse;
      if (!response.ok || !data.ok || !data.plan) {
        throw new Error(data.error || data.message || "No se pudo generar el plan IA");
      }

      setPlan(data.plan);
      setWeekToImport(1);
      setWeekToRecalculate(1);
      setMessage(
        mode === "create"
          ? "Plan IA generado con periodizacion semanal y justificacion tecnica"
          : mode === "extend"
          ? `Plan extendido +${extendWeeks} semanas sin perder continuidad`
          : `Semana ${weekToRecalculate} recalculada por wellness/carga real`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar IA");
    } finally {
      setLoadingAction(null);
    }
  };

  const ensureExerciseId = (exerciseName: string) => {
    const normalized = normalizeText(exerciseName);
    const existing = normalizedExerciseMap.get(normalized);
    if (existing) return existing;

    const createdId = agregarEjercicio({
      nombre: exerciseName,
      categoria: guessExerciseCategory(exerciseName),
      descripcion: "Ejercicio generado desde plan IA periodizado",
      objetivo: "Transferir al objetivo semanal definido por IA",
      videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} ejercicio shorts`)}`,
    });

    normalizedExerciseMap.set(normalized, createdId);
    return createdId;
  };

  const importSession = (session: TrainingPlanSession, planReference: TrainingPlan) => {
    agregarSesion({
      titulo: `${session.title} · W${session.weekNumber}`,
      objetivo: session.goal,
      duracion: `${planReference.sessionDurationMin} min`,
      equipo: `IA · ${planReference.targetName}`,
      asignacionTipo: planReference.targetType,
      categoriaAsignada: planReference.targetType === "jugadoras" ? planReference.category : undefined,
      alumnoAsignado: planReference.targetType === "alumnos" ? planReference.targetName : undefined,
      bloques: session.blocks.map((block) => ({
        id: `${session.id}-${block.id}`,
        titulo: block.title,
        objetivo: block.purpose,
        ejercicios: block.exercises.map((exercise) => ({
          ejercicioId: ensureExerciseId(exercise.exerciseName),
          series: exercise.series,
          repeticiones: exercise.reps,
          descanso: `${exercise.restSec}s`,
          carga: exercise.intensity,
          observaciones: exercise.rationale,
          metricas: [
            { nombre: "Intensidad objetivo", valor: exercise.intensity },
            { nombre: "Descanso", valor: `${exercise.restSec}s` },
          ],
        })),
      })),
    });
  };

  const importPlanToSessions = () => {
    if (!plan) return;

    for (const week of plan.weeks) {
      for (const session of week.sessions) {
        importSession(session, plan);
      }
    }

    setMessage(`Importadas ${availableSessions} sesiones IA a la grilla`);
  };

  const importSingleWeek = () => {
    if (!plan) return;
    const selectedWeek = plan.weeks.find((week) => week.weekNumber === weekToImport);
    if (!selectedWeek) {
      setError("No encontramos la semana seleccionada para importar.");
      return;
    }

    for (const session of selectedWeek.sessions) {
      importSession(session, plan);
    }

    setMessage(`Importadas ${selectedWeek.sessions.length} sesiones de la semana ${selectedWeek.weekNumber}`);
  };

  const exportPlanPdf = () => {
    if (!plan) return;

    const popup = window.open("", "_blank", "width=1040,height=900");
    if (!popup) {
      setError("El navegador bloqueo la ventana de exportacion. Habilita popups para exportar PDF.");
      return;
    }

    const weeksHtml = plan.weeks
      .map(
        (week: TrainingPlanWeek) => `
          <section style="margin:0 0 18px;padding:14px;border:1px solid #d0d8e8;border-radius:10px;">
            <h3 style="margin:0 0 6px;font-size:16px;">Semana ${week.weekNumber} · ${week.phase}</h3>
            <p style="margin:0 0 8px;font-size:12px;color:#334155;">${week.startDate} a ${week.endDate} · Carga ${week.adjustedLoad} · ${week.focus}</p>
            <p style="margin:0 0 8px;font-size:12px;color:#334155;"><b>Justificacion:</b> ${week.rationale}</p>
            <ul style="margin:0;padding-left:18px;">
              ${week.sessions
                .map(
                  (session) =>
                    `<li style="margin:4px 0;font-size:12px;"><b>${session.title}</b> (${session.date}) - intensidad ${session.intensityTarget}% - ${session.goal}</li>`
                )
                .join("")}
            </ul>
          </section>
        `
      )
      .join("");

    const basisHtml = plan.scientificBasis.map((line) => `<li style="margin:4px 0;">${line}</li>`).join("");

    popup.document.write(`
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Plan IA ${plan.targetName}</title>
      </head>
      <body style="font-family:Segoe UI,Arial,sans-serif;padding:22px;color:#0f172a;">
        <h1 style="margin:0 0 10px;">Plan IA periodizado · ${plan.targetName}</h1>
        <p style="margin:0 0 14px;color:#334155;">${plan.sport} · ${plan.category} · ${plan.totalWeeks} semanas · ${plan.sessionsPerWeek} sesiones/semana</p>
        <h2 style="margin:18px 0 8px;font-size:18px;">Base cientifica</h2>
        <ul style="margin:0 0 18px;padding-left:18px;font-size:13px;color:#1e293b;">${basisHtml}</ul>
        <h2 style="margin:18px 0 8px;font-size:18px;">Progresion semanal</h2>
        ${weeksHtml}
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <section className="mb-6 rounded-2xl border border-cyan-400/25 bg-slate-900/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-cyan-200">Planificacion IA periodizada</h2>
          <p className="text-xs text-slate-300">
            Crea, extiende y recalcula planes con justificacion tecnica por semana, sesion y bloque.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-300">
          Tipo objetivo
          <select value={targetType} onChange={(e) => setTargetType(e.target.value as "jugadoras" | "alumnos")} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
            <option value="alumnos">Alumnos</option>
            <option value="jugadoras">Jugadoras</option>
          </select>
        </label>

        <label className="text-xs text-slate-300">
          Nombre objetivo
          <input value={targetName} onChange={(e) => setTargetName(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>

        <label className="text-xs text-slate-300">
          Deporte
          <input value={sport} onChange={(e) => setSport(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>

        <label className="text-xs text-slate-300">
          Categoria
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>

        <label className="text-xs text-slate-300">
          Nivel
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
            {LEVEL_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-300">
          Edad minima
          <input type="number" min={8} max={60} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value) || 8)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>

        <label className="text-xs text-slate-300">
          Edad maxima
          <input type="number" min={10} max={70} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value) || 10)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>

        <label className="text-xs text-slate-300">
          Semanas
          <input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 1)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>

        <label className="text-xs text-slate-300">
          Extender (+ semanas)
          <input type="number" min={1} max={24} value={extendWeeks} onChange={(e) => setExtendWeeks(Number(e.target.value) || 1)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>

        <label className="text-xs text-slate-300">
          Sesiones/semana
          <input type="number" min={1} max={7} value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(Number(e.target.value) || 1)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>

        <label className="text-xs text-slate-300">
          Duracion (min)
          <input type="number" min={30} max={180} value={sessionDurationMin} onChange={(e) => setSessionDurationMin(Number(e.target.value) || 60)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-300">
          Fecha inicio
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-300">
          Notas
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-300">
          Objetivos (coma o linea)
          <textarea value={objectivesText} onChange={(e) => setObjectivesText(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-300">
          Restricciones / contexto
          <textarea value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-slate-800/55 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Capacidades condicionales</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAPABILITY_OPTIONS.map((capability) => {
            const selected = selectedCapabilities.includes(capability);
            return (
              <button
                key={capability}
                type="button"
                onClick={() => toggleCapability(capability)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  selected
                    ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100"
                    : "border-white/20 bg-slate-900/60 text-slate-200 hover:border-cyan-300/40"
                }`}
              >
                {capability}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-slate-800/55 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Fechas clave (calendario)</p>
          <button type="button" onClick={addEvent} className="rounded-md border border-cyan-300/40 px-2 py-1 text-xs font-semibold text-cyan-100">
            + Fecha
          </button>
        </div>
        <div className="space-y-2">
          {events.map((event, index) => (
            <div key={`event-${index}`} className="grid gap-2 rounded-lg border border-white/10 bg-slate-900/60 p-2 md:grid-cols-[1fr_1fr_2fr_1fr_auto]">
              <input type="date" value={event.date} onChange={(e) => updateEvent(index, { date: e.target.value })} className="rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" />
              <select value={event.type} onChange={(e) => updateEvent(index, { type: e.target.value as DraftEvent["type"] })} className="rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs">
                <option value="partido">Partido</option>
                <option value="especial">Especial</option>
                <option value="control">Control</option>
              </select>
              <input value={event.description} onChange={(e) => updateEvent(index, { description: e.target.value })} placeholder="Descripcion del evento" className="rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" />
              <select value={event.importance} onChange={(e) => updateEvent(index, { importance: Number(e.target.value) || 3 })} className="rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs">
                <option value={1}>Importancia 1</option>
                <option value={2}>Importancia 2</option>
                <option value={3}>Importancia 3</option>
                <option value={4}>Importancia 4</option>
                <option value={5}>Importancia 5</option>
              </select>
              <button type="button" onClick={() => removeEvent(index)} className="rounded border border-rose-300/40 px-2 py-1 text-xs text-rose-200">
                quitar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => callAi("create")} disabled={loadingAction !== null} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60">
          {loadingAction === "create" ? "Generando..." : "Generar plan IA"}
        </button>
        <button type="button" onClick={() => callAi("extend")} disabled={loadingAction !== null || !plan} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {loadingAction === "extend" ? "Extendiendo..." : `Extender plan (+${extendWeeks} semanas)`}
        </button>
        <button type="button" onClick={() => callAi("recalculate")} disabled={loadingAction !== null || !plan} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60">
          {loadingAction === "recalculate" ? "Recalculando..." : "Recalcular semana"}
        </button>
        <button type="button" onClick={exportPlanPdf} disabled={!plan} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-60">
          Exportar PDF
        </button>
      </div>

      {plan ? (
        <div className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 md:grid-cols-3">
          <label className="text-xs text-slate-300">
            Importar semana
            <select value={weekToImport} onChange={(e) => setWeekToImport(Number(e.target.value) || 1)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
              {weekOptions.map((weekNumber) => (
                <option key={`import-${weekNumber}`} value={weekNumber}>Semana {weekNumber}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={importPlanToSessions} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
              Importar todo el plan
            </button>
            <button type="button" onClick={importSingleWeek} className="rounded-lg border border-emerald-300/40 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/10">
              Importar semana
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-3 md:col-span-3">
            <label className="text-xs text-slate-300">
              Semana a recalcular
              <select value={weekToRecalculate} onChange={(e) => setWeekToRecalculate(Number(e.target.value) || 1)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                {weekOptions.map((weekNumber) => (
                  <option key={`recalc-${weekNumber}`} value={weekNumber}>Semana {weekNumber}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-300">
              Wellness promedio (1-10)
              <input type="number" min={1} max={10} value={recalcWellness} onChange={(e) => setRecalcWellness(Number(e.target.value) || 1)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-slate-300">
              Delta carga externa (-30 a 30)
              <input type="number" min={-30} max={30} value={recalcDelta} onChange={(e) => setRecalcDelta(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-slate-300 md:col-span-3">
              Nota del ajuste
              <input value={recalcNote} onChange={(e) => setRecalcNote(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
            </label>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {plan ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-800/60 p-3">
          <p className="text-sm font-semibold text-slate-100">
            Plan {plan.id} · {plan.totalWeeks} semanas · {availableSessions} sesiones · {plan.sessionsPerWeek} por semana
          </p>
          <p className="mt-1 text-xs text-slate-300">
            Objetivo: {plan.targetName} · Deporte: {plan.sport} · Categoria: {plan.category} · Edad {plan.ageMin}-{plan.ageMax}
          </p>

          <div className="mt-3 rounded-lg border border-cyan-300/20 bg-slate-900/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Base cientifica</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-200">
              {plan.scientificBasis.map((line, idx) => (
                <li key={`basis-${idx}`}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Progresion semanal</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {progressionSummary.map((item) => (
                <div key={`prog-${item.week}`} className="rounded-md border border-white/10 bg-slate-950/55 p-2 text-xs text-slate-300">
                  <p className="font-semibold text-white">Semana {item.week}</p>
                  <p>Fase: {item.phase}</p>
                  <p>Carga: {item.load}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {plan.weeks.map((week) => (
              <div key={`${plan.id}-${week.weekNumber}`} className="rounded-lg border border-white/10 bg-slate-900/60 p-2 text-xs text-slate-300">
                <p className="font-semibold text-slate-100">Semana {week.weekNumber} · {week.phase}</p>
                <p>{week.startDate} a {week.endDate}</p>
                <p>Foco: {week.focus}</p>
                <p>Carga: {week.adjustedLoad} (plan {week.plannedLoad})</p>
                <p>Sesiones: {week.sessions.length}</p>
                <p className="mt-1 text-[11px] text-slate-400">{week.rationale}</p>
                {week.events.length > 0 ? (
                  <p className="mt-1 text-[11px] text-amber-200">
                    Eventos: {week.events.map((event) => `${event.date} ${event.type}`).join(" · ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
