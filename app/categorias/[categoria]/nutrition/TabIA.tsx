"use client";

import { useState, useMemo } from "react";
import { markManualSaveIntent } from "../../../../components/useSharedState";
import { PLANS_KEY, GOAL_LABELS, ACTIVITY_LABELS, SEX_LABELS } from "./constants";
import { calcTargets, buildAIPrompt, uid, parseNum } from "./utils";
import type { ActivityLevel, BiologicalSex, NutritionGoal, NutritionHubState, NutritionPlan } from "./types";

type Props = Pick<NutritionHubState, "planes" | "setPlanes" | "alumnosNombres">;

const FIELD_CLS =
  "w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-400">{children}</label>;
}

export default function TabIA({ planes, setPlanes, alumnosNombres }: Props) {
  const [alumno, setAlumno] = useState(alumnosNombres[0] ?? "");
  const [sexo, setSexo] = useState<BiologicalSex>("femenino");
  const [edad, setEdad] = useState("25");
  const [peso, setPeso] = useState("65");
  const [altura, setAltura] = useState("165");
  const [actividad, setActividad] = useState<ActivityLevel>("moderado");
  const [objetivo, setObjetivo] = useState<NutritionGoal>("mantenimiento");
  const [comidas, setComidas] = useState("5");
  const [alergias, setAlergias] = useState("");
  const [preferencias, setPreferencias] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [cintura, setCintura] = useState("");
  const [cadera, setCadera] = useState("");
  const [cuello, setCuello] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [planCreated, setPlanCreated] = useState(false);

  const targets = useMemo(
    () => calcTargets(sexo, parseNum(peso, 65), parseNum(altura, 165), parseNum(edad, 25), actividad, objetivo),
    [sexo, peso, altura, edad, actividad, objetivo]
  );

  const prompt = useMemo(
    () =>
      buildAIPrompt(
        { nombre: alumno, sexo: SEX_LABELS[sexo], edad, pesoKg: peso, alturaCm: altura, actividad: ACTIVITY_LABELS[actividad], objetivo: GOAL_LABELS[objetivo], comidas, alergias, preferencias, observaciones, cinturaCm: cintura, caderaCm: cadera, cuelloCm: cuello },
        targets
      ),
    [alumno, sexo, edad, peso, altura, actividad, objetivo, comidas, alergias, preferencias, observaciones, cintura, cadera, cuello, targets]
  );

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    } catch {
      // fallback: show in textarea
    }
  }

  function handleCreatePlan() {
    markManualSaveIntent(PLANS_KEY);
    const now = new Date().toISOString();
    const newPlan: NutritionPlan = {
      id: uid("plan"),
      nombre: `Plan IA — ${alumno || "sin asignar"}`,
      alumnoAsignado: alumno || null,
      sexo,
      edad: parseNum(edad, 25),
      pesoKg: parseNum(peso, 65),
      alturaCm: parseNum(altura, 165),
      actividad,
      objetivo,
      notas: `Generado con asistente IA.\n${observaciones}`.trim(),
      targets,
      comidas: Array.from({ length: parseNum(comidas, 5) }, (_, i) => ({
        id: uid("meal"),
        nombre: ["Desayuno", "Media mañana", "Almuerzo", "Merienda", "Cena", "Pre-entreno", "Post-entreno"][i] ?? `Comida ${i + 1}`,
        items: [],
      })),
      updatedAt: now,
    };
    setPlanes((prev) => [newPlan, ...(Array.isArray(prev) ? prev : [])]);
    setPlanCreated(true);
    setTimeout(() => setPlanCreated(false), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-100">🤖 Asistente IA de Nutrición</h2>
        <p className="mt-1 text-sm text-slate-400">
          Completá los datos del atleta y generá un prompt optimizado para crear un plan nutricional con IA.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Form ── */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h3 className="mb-4 font-semibold text-slate-200">Datos del atleta</h3>
          <div className="space-y-3">
            {/* Alumno */}
            <div>
              <Label>Alumno</Label>
              {alumnosNombres.length > 0 ? (
                <select value={alumno} onChange={(e) => setAlumno(e.target.value)} className={FIELD_CLS}>
                  <option value="">— Sin asignar —</option>
                  {alumnosNombres.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              ) : (
                <input value={alumno} onChange={(e) => setAlumno(e.target.value)} placeholder="Nombre del alumno" className={FIELD_CLS} />
              )}
            </div>

            {/* Sexo */}
            <div>
              <Label>Sexo biológico</Label>
              <div className="flex gap-2">
                {(["femenino", "masculino"] as BiologicalSex[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSexo(s)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                      sexo === s
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 bg-slate-800/40 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {s === "femenino" ? "♀ Femenino" : "♂ Masculino"}
                  </button>
                ))}
              </div>
            </div>

            {/* Basic metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Edad", value: edad, set: setEdad, unit: "años" },
                { label: "Peso", value: peso, set: setPeso, unit: "kg" },
                { label: "Altura", value: altura, set: setAltura, unit: "cm" },
              ].map(({ label, value, set, unit }) => (
                <div key={label}>
                  <Label>{label}</Label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={value} onChange={(e) => set(e.target.value)} className={FIELD_CLS} />
                    <span className="shrink-0 text-xs text-slate-500">{unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actividad */}
            <div>
              <Label>Nivel de actividad</Label>
              <select value={actividad} onChange={(e) => setActividad(e.target.value as ActivityLevel)} className={FIELD_CLS}>
                {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Objetivo */}
            <div>
              <Label>Objetivo</Label>
              <select value={objetivo} onChange={(e) => setObjetivo(e.target.value as NutritionGoal)} className={FIELD_CLS}>
                {(Object.entries(GOAL_LABELS) as [NutritionGoal, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Comidas */}
            <div>
              <Label>Número de comidas por día</Label>
              <input type="number" value={comidas} onChange={(e) => setComidas(e.target.value)} min={3} max={7} className={FIELD_CLS} />
            </div>

            {/* Opcionales */}
            <div className="border-t border-white/5 pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Datos opcionales</p>
              <div className="space-y-3">
                <div>
                  <Label>Alergias / Intolerancias</Label>
                  <input value={alergias} onChange={(e) => setAlergias(e.target.value)} placeholder="Gluten, lactosa..." className={FIELD_CLS} />
                </div>
                <div>
                  <Label>Preferencias alimentarias</Label>
                  <input value={preferencias} onChange={(e) => setPreferencias(e.target.value)} placeholder="Vegetariano, sin carne roja..." className={FIELD_CLS} />
                </div>
                <div>
                  <Label>Observaciones médicas</Label>
                  <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={`${FIELD_CLS} resize-none`} placeholder="Hipotiroidismo, diabetes..." />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Cintura", value: cintura, set: setCintura },
                    { label: "Cadera", value: cadera, set: setCadera },
                    { label: "Cuello", value: cuello, set: setCuello },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <Label>{label} (cm)</Label>
                      <input type="number" value={value} onChange={(e) => set(e.target.value)} placeholder="—" className={FIELD_CLS} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col gap-4">
          {/* Targets preview */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <h3 className="mb-3 font-semibold text-slate-200">📊 Objetivos calculados</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Calorías", value: `${targets.calorias} kcal`, color: "text-amber-400" },
                { label: "Proteínas", value: `${targets.proteinas} g`, color: "text-emerald-400" },
                { label: "Carbohidratos", value: `${targets.carbohidratos} g`, color: "text-blue-400" },
                { label: "Grasas", value: `${targets.grasas} g`, color: "text-yellow-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl bg-slate-800/50 px-3 py-2.5">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt area */}
          <div className="flex-1 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200">📝 Prompt para IA</h3>
              <button
                onClick={handleCopyPrompt}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  promptCopied
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "border border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {promptCopied ? "✓ Copiado!" : "Copiar prompt"}
              </button>
            </div>
            <textarea
              readOnly
              value={prompt}
              rows={14}
              className="w-full resize-none rounded-xl border border-white/5 bg-slate-800/40 p-3 font-mono text-xs text-slate-300 focus:outline-none"
            />
            <p className="mt-2 text-xs text-slate-500">
              Copiá este prompt y pegalo en Claude, ChatGPT u otro asistente IA para generar el plan.
            </p>
          </div>

          {/* Actions */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h3 className="mb-2 font-semibold text-slate-200">🚀 Crear plan base</h3>
            <p className="mb-3 text-xs text-slate-400">
              Crea un plan vacío con las comidas estructuradas. Luego lo completás con los alimentos del plan generado por la IA.
            </p>
            <button
              onClick={handleCreatePlan}
              className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                planCreated
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              {planCreated ? "✓ Plan creado — ve a la pestaña Planes" : "Crear plan base"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
