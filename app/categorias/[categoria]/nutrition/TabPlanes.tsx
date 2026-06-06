"use client";

import { useState, useMemo, useCallback } from "react";
import { markManualSaveIntent } from "../../../../components/useSharedState";
import { allFoodsBase, type ArgentineFood } from "../../../../data/argentineFoods";
import {
  PLANS_KEY,
  ASSIGNMENTS_KEY,
  GOAL_LABELS,
  GOAL_COLORS,
  GOAL_BG_COLORS,
  ACTIVITY_LABELS,
  DEFAULT_MEAL_NAMES,
} from "./constants";
import {
  calcTargets,
  buildFoodMap,
  calcMealNutrients,
  calcPlanIntake,
  uid,
  parseNum,
  roundValue,
} from "./utils";
import type {
  ActivityLevel,
  BiologicalSex,
  CustomFood,
  NutritionGoal,
  NutritionHubState,
  NutritionPlan,
  PlanFoodItem,
  PlanMeal,
} from "./types";

type Props = Pick<
  NutritionHubState,
  "planes" | "setPlanes" | "assignments" | "setAssignments" | "customFoods" | "alumnosNombres"
>;

const INPUT_CLS =
  "w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

// ─── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({
  value,
  target,
  color,
  label,
  unit = "g",
}: {
  value: number;
  target: number;
  color: string;
  label: string;
  unit?: string;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = value > target && target > 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={over ? "text-red-400" : "text-slate-300"}>
          {value.toFixed(0)}/{target.toFixed(0)} {unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: over ? "#f87171" : color }}
        />
      </div>
    </div>
  );
}

// ─── Food search ──────────────────────────────────────────────────────────────

function FoodSearch({
  foodMap,
  onSelect,
  onClose,
}: {
  foodMap: Map<string, ArgentineFood | CustomFood>;
  onSelect: (food: ArgentineFood | CustomFood) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const needle = q.toLowerCase().trim();
    if (!needle) return [];
    const all = [...allFoodsBase, ...(Array.from(foodMap.values()).filter((f) => "createdAt" in f))] as (ArgentineFood | CustomFood)[];
    return all.filter((f) => f.nombre.toLowerCase().includes(needle)).slice(0, 12);
  }, [q, foodMap]);

  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-semibold text-slate-200">Buscar alimento</h4>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ej: pollo, arroz, banana..."
          className={INPUT_CLS}
        />
        <div className="mt-3 space-y-1 max-h-72 overflow-y-auto">
          {results.length === 0 && q.length > 1 && (
            <p className="py-4 text-center text-sm text-slate-500">Sin resultados para "{q}"</p>
          )}
          {results.map((food) => (
            <button
              key={food.id}
              onClick={() => onSelect(food)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-slate-800"
            >
              <div>
                <p className="text-sm text-slate-200">{food.nombre}</p>
                <p className="text-xs text-slate-500">{food.grupo}</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>{food.kcalPer100g} kcal</p>
                <p>{food.proteinPer100g}g p</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Plan form (create / edit meta) ──────────────────────────────────────────

function PlanForm({
  initial,
  alumnosNombres,
  onSave,
  onCancel,
}: {
  initial?: NutritionPlan | null;
  alumnosNombres: string[];
  onSave: (plan: NutritionPlan) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [alumno, setAlumno] = useState(initial?.alumnoAsignado ?? "");
  const [sexo, setSexo] = useState<BiologicalSex>(initial?.sexo ?? "femenino");
  const [edad, setEdad] = useState(String(initial?.edad ?? "25"));
  const [peso, setPeso] = useState(String(initial?.pesoKg ?? "65"));
  const [altura, setAltura] = useState(String(initial?.alturaCm ?? "165"));
  const [actividad, setActividad] = useState<ActivityLevel>(initial?.actividad ?? "moderado");
  const [objetivo, setObjetivo] = useState<NutritionGoal>(initial?.objetivo ?? "mantenimiento");
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [mealCount, setMealCount] = useState(initial?.comidas.length ?? 5);
  const [cintura, setCintura] = useState("");
  const [cadera, setCadera] = useState("");
  const [cuello, setCuello] = useState("");
  const [condiciones, setCondiciones] = useState<string[]>([]);

  const toggleCondicion = (c: string) =>
    setCondiciones((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  const targets = useMemo(
    () => calcTargets(sexo, parseNum(peso, 65), parseNum(altura, 165), parseNum(edad, 25), actividad, objetivo),
    [sexo, peso, altura, edad, actividad, objetivo]
  );

  function handleSave() {
    if (!nombre.trim()) return;
    const now = new Date().toISOString();
    const existingComidas = initial?.comidas ?? [];
    const comidas: PlanMeal[] = Array.from({ length: mealCount }, (_, i) => {
      return existingComidas[i] ?? {
        id: uid("meal"),
        nombre: DEFAULT_MEAL_NAMES[i] ?? `Comida ${i + 1}`,
        items: [],
      };
    });

    onSave({
      id: initial?.id ?? uid("plan"),
      nombre: nombre.trim(),
      alumnoAsignado: alumno || null,
      sexo,
      edad: parseNum(edad, 25),
      pesoKg: parseNum(peso, 65),
      alturaCm: parseNum(altura, 165),
      actividad,
      objetivo,
      notas,
      targets,
      comidas,
      updatedAt: now,
    });
  }

  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-bold text-slate-100">
          {initial ? "Editar plan" : "Nuevo plan nutricional"}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Col 1 */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Nombre del plan</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Plan de masa muscular" className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Alumno asignado</label>
              {alumnosNombres.length > 0 ? (
                <select value={alumno} onChange={(e) => setAlumno(e.target.value)} className={INPUT_CLS}>
                  <option value="">— Sin asignar —</option>
                  {alumnosNombres.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                <input value={alumno} onChange={(e) => setAlumno(e.target.value)} placeholder="Nombre del alumno" className={INPUT_CLS} />
              )}
            </div>

            {/* Sexo */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Sexo biológico</label>
              <div className="flex gap-2">
                {(["femenino", "masculino"] as BiologicalSex[]).map((s) => (
                  <button key={s} onClick={() => setSexo(s)} className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${sexo === s ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-slate-800/40 text-slate-400 hover:border-white/20"}`}>
                    {s === "femenino" ? "♀ Femenino" : "♂ Masculino"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Edad", value: edad, set: setEdad, unit: "años" },
                { label: "Peso", value: peso, set: setPeso, unit: "kg" },
                { label: "Altura", value: altura, set: setAltura, unit: "cm" },
              ].map(({ label, value, set, unit }) => (
                <div key={label}>
                  <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={value} onChange={(e) => set(e.target.value)} className={INPUT_CLS} />
                    <span className="shrink-0 text-xs text-slate-500">{unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Medidas corporales */}
            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                📐 Medidas corporales <span className="normal-case font-normal text-slate-600">(opcional)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Cintura", value: cintura, set: setCintura },
                  { label: "Cadera", value: cadera, set: setCadera },
                  { label: "Cuello", value: cuello, set: setCuello },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="mb-1 block text-xs text-slate-500">{label}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder="—"
                        className={INPUT_CLS}
                      />
                      <span className="shrink-0 text-xs text-slate-600">cm</span>
                    </div>
                  </div>
                ))}
              </div>
              {cintura && cuello && altura && (
                <p className="mt-2 text-xs text-blue-400">
                  % Grasa est.: {Math.max(3, (() => {
                    const c = parseNum(cintura, 0), ca = parseNum(cadera, 0), cu = parseNum(cuello, 0), a = parseNum(altura, 165);
                    if (sexo === "masculino") return 495 / (1.0324 - 0.19077 * Math.log10(c - cu) + 0.15456 * Math.log10(a)) - 450;
                    return 495 / (1.29579 - 0.35004 * Math.log10(c + ca - cu) + 0.221 * Math.log10(a)) - 450;
                  })()).toFixed(1)}%
                </p>
              )}
            </div>

            {/* Condiciones médicas */}
            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                🩺 Condiciones médicas
              </p>
              <div className="flex flex-wrap gap-2">
                {(["Diabetes", "Hipotiroidismo", "Hipertensión", "Dislipidemia", "SOP"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCondicion(c)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      condiciones.includes(c)
                        ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                        : "border-white/10 bg-slate-800/60 text-slate-400 hover:border-white/20 hover:text-slate-300"
                    }`}
                  >
                    {condiciones.includes(c) ? "✓ " : ""}{c}
                  </button>
                ))}
              </div>
              {condiciones.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Se aplicarán ajustes metabólicos en el cálculo de objetivos.
                </p>
              )}
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Nivel de actividad</label>
              <select value={actividad} onChange={(e) => setActividad(e.target.value as ActivityLevel)} className={INPUT_CLS}>
                {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Objetivo</label>
              <select value={objetivo} onChange={(e) => setObjetivo(e.target.value as NutritionGoal)} className={INPUT_CLS}>
                {(Object.entries(GOAL_LABELS) as [NutritionGoal, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {!initial && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Número de comidas</label>
                <input type="number" value={mealCount} onChange={(e) => setMealCount(Number(e.target.value))} min={1} max={7} className={INPUT_CLS} />
              </div>
            )}

            {/* Targets preview */}
            <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Objetivos calculados</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-900/60 py-2 text-center"><p className="text-lg font-black text-amber-400">{targets.calorias}</p><p className="text-slate-500">kcal</p></div>
                <div className="rounded-lg bg-slate-900/60 py-2 text-center"><p className="text-lg font-black text-emerald-400">{targets.proteinas}g</p><p className="text-slate-500">proteínas</p></div>
                <div className="rounded-lg bg-slate-900/60 py-2 text-center"><p className="text-lg font-black text-blue-400">{targets.carbohidratos}g</p><p className="text-slate-500">carbos</p></div>
                <div className="rounded-lg bg-slate-900/60 py-2 text-center"><p className="text-lg font-black text-yellow-400">{targets.grasas}g</p><p className="text-slate-500">grasas</p></div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Notas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={`${INPUT_CLS} resize-none`} placeholder="Observaciones, restricciones..." />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={handleSave} disabled={!nombre.trim()} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
            {initial ? "Guardar cambios" : "Crear plan"}
          </button>
          <button onClick={onCancel} className="rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
            Cancelar
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Meal editor ──────────────────────────────────────────────────────────────

function MealEditor({
  meal,
  foodMap,
  planTargets,
  onUpdateMeal,
  onDeleteMeal,
}: {
  meal: PlanMeal;
  foodMap: Map<string, ArgentineFood | CustomFood>;
  planTargets: { calorias: number; proteinas: number; carbohidratos: number; grasas: number };
  onUpdateMeal: (m: PlanMeal) => void;
  onDeleteMeal: () => void;
}) {
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const nutrients = calcMealNutrients(meal, foodMap);

  function handleAddFood(food: ArgentineFood | CustomFood) {
    const item: PlanFoodItem = { id: uid("item"), foodId: food.id, gramos: 100 };
    onUpdateMeal({ ...meal, items: [...meal.items, item] });
    setShowFoodSearch(false);
    setExpanded(true);
  }

  function handleUpdateGramos(itemId: string, gramos: number) {
    onUpdateMeal({
      ...meal,
      items: meal.items.map((it) => (it.id === itemId ? { ...it, gramos } : it)),
    });
  }

  function handleRemoveItem(itemId: string) {
    onUpdateMeal({ ...meal, items: meal.items.filter((it) => it.id !== itemId) });
  }

  function handleRenameMeal(name: string) {
    onUpdateMeal({ ...meal, nombre: name });
  }

  const perMealTarget = {
    calorias: roundValue(planTargets.calorias / 5),
    proteinas: roundValue(planTargets.proteinas / 5),
    carbohidratos: roundValue(planTargets.carbohidratos / 5),
    grasas: roundValue(planTargets.grasas / 5),
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/40">
      {showFoodSearch && (
        <FoodSearch
          foodMap={foodMap}
          onSelect={handleAddFood}
          onClose={() => setShowFoodSearch(false)}
        />
      )}

      {/* Meal header */}
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span className="text-sm">{expanded ? "▼" : "▶"}</span>
          <input
            value={meal.nombre}
            onChange={(e) => handleRenameMeal(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-sm font-semibold text-slate-200 focus:outline-none"
          />
        </button>
        <span className="shrink-0 text-xs font-medium text-amber-400">{nutrients.calorias} kcal</span>
        <button
          onClick={() => setShowFoodSearch(true)}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/20"
        >
          + Alimento
        </button>
        <button onClick={onDeleteMeal} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-white/5 px-3 pb-3">
          {meal.items.length === 0 ? (
            <p className="py-3 text-center text-xs text-slate-500">Sin alimentos. Agregá uno.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {meal.items.map((item) => {
                const food = foodMap.get(item.foodId);
                if (!food) return null;
                const n = {
                  calorias: roundValue((food.kcalPer100g * item.gramos) / 100),
                  proteinas: roundValue((food.proteinPer100g * item.gramos) / 100),
                  carbohidratos: roundValue((food.carbsPer100g * item.gramos) / 100),
                  grasas: roundValue((food.fatPer100g * item.gramos) / 100),
                };
                return (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-slate-200">{food.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {n.calorias} kcal · {n.proteinas}g P · {n.carbohidratos}g C · {n.grasas}g G
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={item.gramos}
                        onChange={(e) => handleUpdateGramos(item.id, Number(e.target.value))}
                        min={1}
                        className="w-16 rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-center text-xs text-slate-100 focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">g</span>
                      <button onClick={() => handleRemoveItem(item.id)} className="text-slate-600 hover:text-red-400 ml-1">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Meal macro summary */}
          {meal.items.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <MacroBar value={nutrients.calorias} target={perMealTarget.calorias} color="#f59e0b" label="Kcal" unit="kcal" />
              <MacroBar value={nutrients.proteinas} target={perMealTarget.proteinas} color="#34d399" label="Proteínas" />
              <MacroBar value={nutrients.carbohidratos} target={perMealTarget.carbohidratos} color="#60a5fa" label="Carbos" />
              <MacroBar value={nutrients.grasas} target={perMealTarget.grasas} color="#fbbf24" label="Grasas" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Plan detail ──────────────────────────────────────────────────────────────

// ─── IA Improver modal ────────────────────────────────────────────────────────

function IAPlanImprover({
  plan,
  foodMap,
  onClose,
}: {
  plan: NutritionPlan;
  foodMap: Map<string, ArgentineFood | CustomFood>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const intake = useMemo(() => calcPlanIntake(plan, foodMap), [plan, foodMap]);

  const prompt = useMemo(() => {
    const mealLines = plan.comidas.map((meal) => {
      const mNutr = calcMealNutrients(meal, foodMap);
      const items = meal.items.map((item) => {
        const food = foodMap.get(item.foodId);
        if (!food) return `  - [alimento desconocido] ${item.gramos}g`;
        const kcal = Math.round((food.kcalPer100g * item.gramos) / 100);
        return `  - ${food.nombre}: ${item.gramos}g (${kcal} kcal)`;
      });
      return [
        `**${meal.nombre}** — ${mNutr.calorias} kcal | P:${mNutr.proteinas}g C:${mNutr.carbohidratos}g G:${mNutr.grasas}g`,
        ...(items.length > 0 ? items : ["  (sin alimentos cargados)"]),
      ].join("\n");
    }).join("\n\n");

    const diff = {
      kcal: Math.round(intake.calorias - plan.targets.calorias),
      p: Math.round(intake.proteinas - plan.targets.proteinas),
      c: Math.round(intake.carbohidratos - plan.targets.carbohidratos),
      g: Math.round(intake.grasas - plan.targets.grasas),
    };

    return `Eres un nutricionista deportivo experto. Tengo un plan nutricional que quiero mejorar. Analizá el plan actual y sugerí mejoras concretas.

**PERFIL DEL ATLETA**
- Alumno: ${plan.alumnoAsignado ?? "Sin asignar"}
- Sexo: ${plan.sexo === "femenino" ? "Femenino" : "Masculino"}
- Edad: ${plan.edad} años | Peso: ${plan.pesoKg} kg | Altura: ${plan.alturaCm} cm
- Actividad: ${ACTIVITY_LABELS[plan.actividad]}
- Objetivo: ${GOAL_LABELS[plan.objetivo]}

**OBJETIVOS DE MACROS**
- Calorías: ${plan.targets.calorias} kcal
- Proteínas: ${plan.targets.proteinas}g | Carbohidratos: ${plan.targets.carbohidratos}g | Grasas: ${plan.targets.grasas}g

**PLAN ACTUAL (${plan.comidas.length} comidas)**
${mealLines}

**RESUMEN ACTUAL VS OBJETIVOS**
- Calorías: ${intake.calorias} / ${plan.targets.calorias} kcal (${diff.kcal >= 0 ? "+" : ""}${diff.kcal})
- Proteínas: ${intake.proteinas}g / ${plan.targets.proteinas}g (${diff.p >= 0 ? "+" : ""}${diff.p}g)
- Carbohidratos: ${intake.carbohidratos}g / ${plan.targets.carbohidratos}g (${diff.c >= 0 ? "+" : ""}${diff.c}g)
- Grasas: ${intake.grasas}g / ${plan.targets.grasas}g (${diff.g >= 0 ? "+" : ""}${diff.g}g)
${plan.notas ? `\n**Notas del plan:** ${plan.notas}` : ""}

**LO QUE NECESITO**
1. Evaluá si el plan cumple los objetivos de macros y calorías.
2. Identificá desequilibrios nutricionales o carencias.
3. Sugerí sustituciones de alimentos específicas con gramos exactos.
4. Proponé ajustes en los horarios o distribución de comidas si es necesario.
5. Si hay comidas sin alimentos cargados, sugerí alimentos concretos con gramos para completarlas.
6. Usá alimentos típicos argentinos, fáciles de conseguir.
7. Devolvé el plan mejorado completo, comida por comida, con los alimentos y gramos actualizados.`;
  }, [plan, foodMap, intake]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* fallback */ }
  }

  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-100">🤖 Mejorar plan con IA</h3>
              <p className="text-xs text-slate-400 mt-0.5">{plan.nombre}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
          </div>

          {/* Resumen del plan actual */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Calorías actuales", val: `${intake.calorias}`, target: `/ ${plan.targets.calorias}`, color: "text-amber-400" },
              { label: "Proteínas", val: `${intake.proteinas}g`, target: `/ ${plan.targets.proteinas}g`, color: "text-emerald-400" },
              { label: "Carbos", val: `${intake.carbohidratos}g`, target: `/ ${plan.targets.carbohidratos}g`, color: "text-blue-400" },
              { label: "Grasas", val: `${intake.grasas}g`, target: `/ ${plan.targets.grasas}g`, color: "text-yellow-400" },
            ].map(({ label, val, target, color }) => (
              <div key={label} className="rounded-xl bg-slate-800/50 p-2.5 text-center">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`font-bold ${color}`}>{val}</p>
                <p className="text-xs text-slate-600">{target} objetivo</p>
              </div>
            ))}
          </div>

          {/* Prompt */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400">Prompt generado — copialo y pegalo en Claude o ChatGPT</p>
              <button
                onClick={handleCopy}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "border border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {copied ? "✓ Copiado!" : "📋 Copiar prompt"}
              </button>
            </div>
            <textarea
              readOnly
              value={prompt}
              rows={16}
              className="w-full resize-none rounded-xl border border-white/5 bg-slate-800/40 p-3 font-mono text-xs text-slate-300 focus:outline-none"
            />
          </div>

          {/* Tips */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
            <p className="text-xs font-semibold text-violet-400 mb-1">💡 Cómo usarlo</p>
            <ol className="space-y-0.5 text-xs text-slate-400 list-decimal list-inside">
              <li>Copiá el prompt con el botón de arriba.</li>
              <li>Abrí Claude.ai, ChatGPT o cualquier IA.</li>
              <li>Pegá el prompt y envialo.</li>
              <li>Con la respuesta, volvé aquí y actualizá las comidas del plan.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Plan detail ──────────────────────────────────────────────────────────────

function PlanDetail({
  plan,
  foodMap,
  alumnosNombres,
  onUpdate,
  onDelete,
  onBack,
}: {
  plan: NutritionPlan;
  foodMap: Map<string, ArgentineFood | CustomFood>;
  alumnosNombres: string[];
  onUpdate: (plan: NutritionPlan) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showIAImprover, setShowIAImprover] = useState(false);
  const intake = useMemo(() => calcPlanIntake(plan, foodMap), [plan, foodMap]);

  function handleAddMeal() {
    const newMeal: PlanMeal = {
      id: uid("meal"),
      nombre: DEFAULT_MEAL_NAMES[plan.comidas.length] ?? `Comida ${plan.comidas.length + 1}`,
      items: [],
    };
    onUpdate({ ...plan, comidas: [...plan.comidas, newMeal], updatedAt: new Date().toISOString() });
  }

  function handleUpdateMeal(mealId: string, updated: PlanMeal) {
    onUpdate({
      ...plan,
      comidas: plan.comidas.map((m) => (m.id === mealId ? updated : m)),
      updatedAt: new Date().toISOString(),
    });
  }

  function handleDeleteMeal(mealId: string) {
    onUpdate({
      ...plan,
      comidas: plan.comidas.filter((m) => m.id !== mealId),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-5">
      {showEditForm && (
        <PlanForm
          initial={plan}
          alumnosNombres={alumnosNombres}
          onSave={(updated) => { onUpdate(updated); setShowEditForm(false); }}
          onCancel={() => setShowEditForm(false)}
        />
      )}

      {showIAImprover && (
        <IAPlanImprover
          plan={plan}
          foodMap={foodMap}
          onClose={() => setShowIAImprover(false)}
        />
      )}

      {/* Back */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-slate-200">
          ← Volver
        </button>
        <h2 className="text-xl font-black text-slate-100">{plan.nombre}</h2>
      </div>

      {/* Plan meta */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${GOAL_BG_COLORS[plan.objetivo]} ${GOAL_COLORS[plan.objetivo]}`}>
          {GOAL_LABELS[plan.objetivo]}
        </span>
        {plan.alumnoAsignado && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-400">
            👤 {plan.alumnoAsignado}
          </span>
        )}
        <span className="text-xs text-slate-500">
          {plan.pesoKg} kg · {plan.alturaCm} cm · {plan.edad} años
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => setShowIAImprover(true)}
            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 transition-colors"
          >
            🤖 Mejorar con IA
          </button>
          <button
            onClick={() => setShowEditForm(true)}
            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            Editar meta
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20"
          >
            Eliminar plan
          </button>
        </div>
      </div>

      {/* Macro targets + intake */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">Progreso diario</h3>
          <span className="text-xs text-slate-500">{intake.calorias} / {plan.targets.calorias} kcal</span>
        </div>
        <div className="space-y-2">
          <MacroBar value={intake.calorias} target={plan.targets.calorias} color="#f59e0b" label="Calorías" unit="kcal" />
          <MacroBar value={intake.proteinas} target={plan.targets.proteinas} color="#34d399" label="Proteínas" />
          <MacroBar value={intake.carbohidratos} target={plan.targets.carbohidratos} color="#60a5fa" label="Carbohidratos" />
          <MacroBar value={intake.grasas} target={plan.targets.grasas} color="#fbbf24" label="Grasas" />
        </div>
      </div>

      {/* Meals */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">Comidas ({plan.comidas.length})</h3>
          <button
            onClick={handleAddMeal}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
          >
            + Añadir comida
          </button>
        </div>
        <div className="space-y-2">
          {plan.comidas.map((meal) => (
            <MealEditor
              key={meal.id}
              meal={meal}
              foodMap={foodMap}
              planTargets={plan.targets}
              onUpdateMeal={(updated) => handleUpdateMeal(meal.id, updated)}
              onDeleteMeal={() => handleDeleteMeal(meal.id)}
            />
          ))}
        </div>
      </div>

      {/* Notes */}
      {plan.notas && (
        <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Notas</p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{plan.notas}</p>
        </div>
      )}
    </div>
  );
}

// ─── Plan list card ───────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onSelect,
  onDelete,
}: {
  plan: NutritionPlan;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="group cursor-pointer rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-all hover:border-emerald-500/30 hover:bg-slate-900/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="truncate font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
            {plan.nombre}
          </h4>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className={`text-xs font-medium ${GOAL_COLORS[plan.objetivo]}`}>
              {GOAL_LABELS[plan.objetivo]}
            </span>
            {plan.alumnoAsignado && (
              <span className="text-xs text-slate-500">👤 {plan.alumnoAsignado}</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-800/60 py-1.5">
          <p className="font-bold text-amber-400">{plan.targets.calorias}</p>
          <p className="text-slate-500">kcal</p>
        </div>
        <div className="rounded-lg bg-slate-800/60 py-1.5">
          <p className="font-bold text-emerald-400">{plan.targets.proteinas}g</p>
          <p className="text-slate-500">prot</p>
        </div>
        <div className="rounded-lg bg-slate-800/60 py-1.5">
          <p className="font-bold text-blue-400">{plan.targets.carbohidratos}g</p>
          <p className="text-slate-500">carbs</p>
        </div>
        <div className="rounded-lg bg-slate-800/60 py-1.5">
          <p className="font-bold text-yellow-400">{plan.targets.grasas}g</p>
          <p className="text-slate-500">grasas</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {plan.comidas.length} comidas · actualizado {new Date(plan.updatedAt).toLocaleDateString("es-AR")}
      </p>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function TabPlanes({
  planes,
  setPlanes,
  assignments,
  setAssignments,
  customFoods,
  alumnosNombres,
}: Props) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [search, setSearch] = useState("");

  const foodMap = useMemo(
    () => buildFoodMap(allFoodsBase, customFoods),
    [customFoods]
  );

  const selectedPlan = useMemo(
    () => (selectedPlanId ? planes.find((p) => p.id === selectedPlanId) ?? null : null),
    [selectedPlanId, planes]
  );

  const filteredPlanes = useMemo(() => {
    if (!search.trim()) return planes;
    const q = search.toLowerCase();
    return planes.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.alumnoAsignado ?? "").toLowerCase().includes(q) ||
        GOAL_LABELS[p.objetivo].toLowerCase().includes(q)
    );
  }, [planes, search]);

  const handleSavePlan = useCallback(
    (plan: NutritionPlan) => {
      markManualSaveIntent(PLANS_KEY);
      setPlanes((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const idx = base.findIndex((p) => p.id === plan.id);
        if (idx >= 0) {
          const next = [...base];
          next[idx] = plan;
          return next;
        }
        return [plan, ...base];
      });

      // Sync assignments
      if (plan.alumnoAsignado) {
        markManualSaveIntent(ASSIGNMENTS_KEY);
        setAssignments((prev) => {
          const base = Array.isArray(prev) ? prev : [];
          const existing = base.findIndex((a) => a.alumnoNombre === plan.alumnoAsignado);
          const entry = { alumnoNombre: plan.alumnoAsignado!, planId: plan.id, assignedAt: new Date().toISOString() };
          if (existing >= 0) {
            const next = [...base];
            next[existing] = entry;
            return next;
          }
          return [...base, entry];
        });
      }
      setShowCreateForm(false);
    },
    [setPlanes, setAssignments]
  );

  function handleDeletePlan(planId: string) {
    if (!confirm("¿Eliminar este plan? Esta acción no se puede deshacer.")) return;
    markManualSaveIntent(PLANS_KEY);
    markManualSaveIntent(ASSIGNMENTS_KEY);
    setPlanes((prev) => prev.filter((p) => p.id !== planId));
    setAssignments((prev) => prev.filter((a) => a.planId !== planId));
    if (selectedPlanId === planId) setSelectedPlanId(null);
  }

  // ── Detail view ──
  if (selectedPlan) {
    return (
      <PlanDetail
        plan={selectedPlan}
        foodMap={foodMap}
        alumnosNombres={alumnosNombres}
        onUpdate={handleSavePlan}
        onDelete={() => handleDeletePlan(selectedPlan.id)}
        onBack={() => setSelectedPlanId(null)}
      />
    );
  }

  // ── List view ──
  return (
    <div className="space-y-5">
      {showCreateForm && (
        <PlanForm
          alumnosNombres={alumnosNombres}
          onSave={handleSavePlan}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-100">📋 Planes Nutricionales</h2>
          <p className="mt-1 text-sm text-slate-400">
            {planes.length} plan{planes.length !== 1 ? "es" : ""} creado{planes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          + Nuevo plan
        </button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar plan o alumno..."
        className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
      />

      {filteredPlanes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <p className="text-slate-500">
            {search ? "No hay planes que coincidan." : "Aún no hay planes. ¡Creá el primero!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPlanes.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSelect={() => setSelectedPlanId(plan.id)}
              onDelete={() => handleDeletePlan(plan.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
