"use client";

import { useMemo, useState } from "react";
import { useSessions } from "../SessionsProvider";
import { useEjercicios } from "../EjerciciosProvider";

type AIEngine = "periodizador-v1" | "microciclo-v2";

type AIBlock = {
  title: string;
  objective: string;
  suggestions: string[];
};

type AISessionBlueprint = {
  id: string;
  title: string;
  objective: string;
  durationMin: number;
  blocks: AIBlock[];
  tags: string[];
};

type AIWeek = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  focus: string;
  load: string;
  sessionBlueprints: AISessionBlueprint[];
};

type AIPlan = {
  id: string;
  engine: AIEngine;
  targetType: "jugadoras" | "alumnos";
  targetName: string;
  sport: string;
  category: string;
  sessionsPerWeek: number;
  sessionDurationMin: number;
  totalWeeks: number;
  startDate: string;
  weeks: AIWeek[];
};

type PlannerResponse = {
  ok: boolean;
  plan?: AIPlan;
  error?: string;
};

const TODAY = new Date().toISOString().slice(0, 10);

export default function SesionesAIPlanner() {
  const { agregarSesion } = useSessions();
  const { ejercicios } = useEjercicios();

  const [engine, setEngine] = useState<AIEngine>("periodizador-v1");
  const [targetName, setTargetName] = useState("Plan IA Equipo");
  const [targetType, setTargetType] = useState<"jugadoras" | "alumnos">("alumnos");
  const [sport, setSport] = useState("Futbol");
  const [category, setCategory] = useState("General");
  const [weeks, setWeeks] = useState(3);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionDurationMin, setSessionDurationMin] = useState(70);
  const [startDate, setStartDate] = useState(TODAY);
  const [notes, setNotes] = useState("");

  const [plan, setPlan] = useState<AIPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const availableSessions = useMemo(
    () => plan?.weeks.reduce((acc, week) => acc + week.sessionBlueprints.length, 0) || 0,
    [plan]
  );

  const callAi = async (mode: "create" | "extend") => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload =
        mode === "create"
          ? {
              mode,
              engine,
              targetType,
              targetName,
              sport,
              category,
              sessionsPerWeek,
              sessionDurationMin,
              weeks,
              startDate,
              notes,
            }
          : {
              mode,
              engine,
              existingPlan: plan,
              weeks,
            };

      const response = await fetch("/api/sesiones/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as PlannerResponse;
      if (!response.ok || !data.ok || !data.plan) {
        throw new Error(data.error || "No se pudo generar el plan IA");
      }

      setPlan(data.plan);
      setMessage(mode === "create" ? "Plan IA generado" : "Plan IA extendido");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar IA");
    } finally {
      setLoading(false);
    }
  };

  const importPlanToSessions = () => {
    if (!plan) return;

    const fallbackExerciseId = ejercicios[0]?.id || "1";

    for (const week of plan.weeks) {
      for (const blueprint of week.sessionBlueprints) {
        agregarSesion({
          titulo: `${blueprint.title} · W${week.weekNumber}`,
          objetivo: blueprint.objective,
          duracion: `${blueprint.durationMin} min`,
          equipo: `IA · ${plan.targetName}`,
          asignacionTipo: plan.targetType,
          categoriaAsignada: plan.targetType === "jugadoras" ? plan.category : undefined,
          alumnoAsignado: plan.targetType === "alumnos" ? plan.targetName : undefined,
          bloques: blueprint.blocks.map((block) => ({
            id: `${blueprint.id}-${block.title}`,
            titulo: block.title,
            objetivo: block.objective,
            ejercicios: [
              {
                ejercicioId: fallbackExerciseId,
                series: 3,
                repeticiones: "8-12",
                descanso: "60s",
                observaciones: block.suggestions.join(" | "),
                metricas: [],
              },
            ],
          })),
        });
      }
    }

    setMessage(`Importadas ${availableSessions} sesiones IA a la grilla`);
  };

  return (
    <section className="mb-6 rounded-2xl border border-cyan-400/25 bg-slate-900/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-cyan-200">Motores IA de Sesiones</h2>
          <p className="text-xs text-slate-300">Genera y extiende planificaciones por semanas desde la API IA.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-300">
          Motor IA
          <select value={engine} onChange={(e) => setEngine(e.target.value as AIEngine)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
            <option value="periodizador-v1">Periodizador v1</option>
            <option value="microciclo-v2">Microciclo v2</option>
          </select>
        </label>

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
          Semanas
          <input type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 1)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => callAi("create")} disabled={loading} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60">
          {loading ? "Generando..." : "Generar plan IA"}
        </button>
        <button type="button" onClick={() => callAi("extend")} disabled={loading || !plan} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          Extender plan IA
        </button>
        <button type="button" onClick={importPlanToSessions} disabled={!plan} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
          Importar sesiones al modulo
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {plan ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-800/60 p-3">
          <p className="text-sm font-semibold text-slate-100">
            Plan {plan.id} · {plan.engine} · {plan.totalWeeks} semanas · {availableSessions} sesiones
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {plan.weeks.map((week) => (
              <div key={`${plan.id}-${week.weekNumber}`} className="rounded-lg border border-white/10 bg-slate-900/60 p-2 text-xs text-slate-300">
                <p className="font-semibold text-slate-100">Semana {week.weekNumber}</p>
                <p>{week.startDate} a {week.endDate}</p>
                <p>Foco: {week.focus}</p>
                <p>Carga: {week.load}</p>
                <p>Sesiones: {week.sessionBlueprints.length}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
