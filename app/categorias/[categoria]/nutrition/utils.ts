// ─── Nutrition Hub — Utility Functions ───────────────────────────────────────

import type {
  ActivityLevel,
  AnthropometryRecord,
  BiologicalSex,
  CustomFood,
  NutritionGoal,
  NutritionPlan,
  NutritionTargets,
  PlanFoodItem,
  PlanMeal,
} from "./types";
import type { ArgentineFood } from "../../../../data/argentineFoods";
import { ACTIVITY_FACTORS, GOAL_FACTORS } from "./constants";

// ─── Number utils ─────────────────────────────────────────────────────────────

export function roundValue(v: number) {
  return Math.round(v * 10) / 10;
}

export function parseNum(value: string | number | undefined | null, fallback: number): number {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

// ─── BMR / TDEE ───────────────────────────────────────────────────────────────

export function calcHarrisBmr(
  sexo: BiologicalSex,
  pesoKg: number,
  alturaCm: number,
  edad: number
): number {
  return sexo === "masculino"
    ? 88.362 + 13.397 * pesoKg + 4.799 * alturaCm - 5.677 * edad
    : 447.593 + 9.247 * pesoKg + 3.098 * alturaCm - 4.33 * edad;
}

export function calcMifflinBmr(
  sexo: BiologicalSex,
  pesoKg: number,
  alturaCm: number,
  edad: number
): number {
  return sexo === "masculino"
    ? 10 * pesoKg + 6.25 * alturaCm - 5 * edad + 5
    : 10 * pesoKg + 6.25 * alturaCm - 5 * edad - 161;
}

export function calcTdee(bmr: number, actividad: ActivityLevel, objetivo: NutritionGoal): number {
  return bmr * ACTIVITY_FACTORS[actividad] * GOAL_FACTORS[objetivo];
}

// ─── Macro targets ────────────────────────────────────────────────────────────

export function calcTargets(
  sexo: BiologicalSex,
  pesoKg: number,
  alturaCm: number,
  edad: number,
  actividad: ActivityLevel,
  objetivo: NutritionGoal
): NutritionTargets {
  const cleanPeso = clamp(pesoKg || 70, 30, 250);
  const cleanAltura = clamp(alturaCm || 170, 130, 230);
  const cleanEdad = clamp(edad || 25, 10, 95);

  const harrisBmr = calcHarrisBmr(sexo, cleanPeso, cleanAltura, cleanEdad);
  const mifflinBmr = calcMifflinBmr(sexo, cleanPeso, cleanAltura, cleanEdad);
  const combinedBmr = (harrisBmr + mifflinBmr) / 2;

  const calorias = roundValue(calcTdee(combinedBmr, actividad, objetivo));

  const proteinFactor = objetivo === "masa" ? 2.2 : objetivo === "deficit" ? 2.1 : 2.0;
  const fatFactor = objetivo === "deficit" ? 0.7 : objetivo === "masa" ? 1.0 : 0.8;

  const proteinas = roundValue(cleanPeso * proteinFactor);
  const grasas = roundValue(cleanPeso * fatFactor);
  const carbohidratos = roundValue(Math.max(60, (calorias - proteinas * 4 - grasas * 9) / 4));

  return { calorias, proteinas, carbohidratos, grasas };
}

// ─── IMC / Body composition ───────────────────────────────────────────────────

export function calcImc(pesoKg: number, alturaCm: number): number {
  const h = alturaCm / 100;
  return roundValue(pesoKg / (h * h));
}

export function calcNavyBodyFat(
  sexo: BiologicalSex,
  alturaCm: number,
  cinturaCm: number,
  cuelloCm: number,
  caderaCm?: number
): number {
  if (sexo === "masculino") {
    return roundValue(
      495 / (1.0324 - 0.19077 * Math.log10(cinturaCm - cuelloCm) + 0.15456 * Math.log10(alturaCm)) - 450
    );
  }
  const cadera = caderaCm ?? cinturaCm * 1.1;
  return roundValue(
    495 /
      (1.29579 - 0.35004 * Math.log10(cinturaCm + cadera - cuelloCm) + 0.221 * Math.log10(alturaCm)) -
      450
  );
}

export function calcIdealWeight(sexo: BiologicalSex, alturaCm: number): number {
  // Devine (1974)
  const inchesOver5Feet = (alturaCm / 2.54) - 60;
  const base = sexo === "masculino" ? 50 : 45.5;
  return roundValue(base + 2.3 * Math.max(0, inchesOver5Feet));
}

export function calcIdealWeightRobinson(sexo: BiologicalSex, alturaCm: number): number {
  // Robinson (1983)
  const inchesOver5 = (alturaCm / 2.54) - 60;
  return roundValue(sexo === "masculino"
    ? 52 + 1.9 * Math.max(0, inchesOver5)
    : 49 + 1.7 * Math.max(0, inchesOver5));
}

export function calcIdealWeightMiller(sexo: BiologicalSex, alturaCm: number): number {
  // Miller (1983)
  const inchesOver5 = (alturaCm / 2.54) - 60;
  return roundValue(sexo === "masculino"
    ? 56.2 + 1.41 * Math.max(0, inchesOver5)
    : 53.1 + 1.36 * Math.max(0, inchesOver5));
}

export function calcIdealWeightHamwi(sexo: BiologicalSex, alturaCm: number): number {
  // Hamwi (1964)
  const inchesOver5 = (alturaCm / 2.54) - 60;
  return roundValue(sexo === "masculino"
    ? 48.2 + 2.7 * Math.max(0, inchesOver5)
    : 45.5 + 2.2 * Math.max(0, inchesOver5));
}

export function calcIdealWeightLorenz(sexo: BiologicalSex, alturaCm: number): number {
  // Lorenz (clásica Europa/LatAm)
  return roundValue(sexo === "masculino"
    ? (alturaCm - 100) - (alturaCm - 150) / 4
    : (alturaCm - 100) - (alturaCm - 150) / 2);
}

export function calcKatchMcArdleBmr(lbm: number): number {
  // Katch-McArdle — necesita masa magra (kg)
  return roundValue(370 + 21.6 * lbm);
}

export function calcFaoOmsBmr(sexo: BiologicalSex, pesoKg: number, edad: number): number {
  // FAO/OMS/ONU (1985) — por grupos etarios
  if (sexo === "masculino") {
    if (edad < 30) return roundValue(15.3 * pesoKg + 679);
    if (edad < 60) return roundValue(11.6 * pesoKg + 879);
    return roundValue(13.5 * pesoKg + 487);
  } else {
    if (edad < 30) return roundValue(14.7 * pesoKg + 496);
    if (edad < 60) return roundValue(8.7 * pesoKg + 829);
    return roundValue(10.5 * pesoKg + 596);
  }
}

export function calcWaterNeeds(pesoKg: number, actividad: ActivityLevel): number {
  // ml/día → retorna en litros
  const base = pesoKg * 35;
  const extra =
    actividad === "sedentario" ? 0 :
    actividad === "ligero" ? 350 :
    actividad === "moderado" ? 650 :
    actividad === "alto" ? 950 : 1200;
  return Math.round((base + extra) / 100) / 10;
}

// ─── Food / Meal calculations ─────────────────────────────────────────────────

export type FoodNutrients = {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
};

type AnyFood = ArgentineFood | CustomFood;

function isArgentineFood(f: AnyFood): f is ArgentineFood {
  return "source" in f;
}

export function calcItemNutrients(item: PlanFoodItem, foodMap: Map<string, AnyFood>): FoodNutrients {
  const food = foodMap.get(item.foodId);
  if (!food) return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };

  const factor = item.gramos / 100;
  return {
    calorias: roundValue(food.kcalPer100g * factor),
    proteinas: roundValue(food.proteinPer100g * factor),
    carbohidratos: roundValue(food.carbsPer100g * factor),
    grasas: roundValue(food.fatPer100g * factor),
  };
}

export function calcMealNutrients(meal: PlanMeal, foodMap: Map<string, AnyFood>): FoodNutrients {
  const sum = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
  for (const item of meal.items) {
    const n = calcItemNutrients(item, foodMap);
    sum.calorias += n.calorias;
    sum.proteinas += n.proteinas;
    sum.carbohidratos += n.carbohidratos;
    sum.grasas += n.grasas;
  }
  return {
    calorias: roundValue(sum.calorias),
    proteinas: roundValue(sum.proteinas),
    carbohidratos: roundValue(sum.carbohidratos),
    grasas: roundValue(sum.grasas),
  };
}

export function calcPlanIntake(plan: NutritionPlan, foodMap: Map<string, AnyFood>): FoodNutrients {
  const sum = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
  for (const meal of plan.comidas) {
    const n = calcMealNutrients(meal, foodMap);
    sum.calorias += n.calorias;
    sum.proteinas += n.proteinas;
    sum.carbohidratos += n.carbohidratos;
    sum.grasas += n.grasas;
  }
  return {
    calorias: roundValue(sum.calorias),
    proteinas: roundValue(sum.proteinas),
    carbohidratos: roundValue(sum.carbohidratos),
    grasas: roundValue(sum.grasas),
  };
}

export function buildFoodMap(
  base: ArgentineFood[],
  custom: CustomFood[]
): Map<string, AnyFood> {
  const map = new Map<string, AnyFood>();
  for (const f of base) map.set(f.id, f);
  for (const f of custom) map.set(f.id, f);
  return map;
}

// ─── Unique ID ────────────────────────────────────────────────────────────────

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Anthropometry helpers ────────────────────────────────────────────────────

export function latestRecord(
  records: AnthropometryRecord[],
  alumnoNombre: string
): AnthropometryRecord | null {
  const filtered = records
    .filter((r) => r.alumnoNombre === alumnoNombre)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return filtered[0] ?? null;
}

export function recordsForAlumno(
  records: AnthropometryRecord[],
  alumnoNombre: string
): AnthropometryRecord[] {
  return records
    .filter((r) => r.alumnoNombre === alumnoNombre)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ─── AI brief builder ─────────────────────────────────────────────────────────

export type AIBriefFields = {
  nombre: string;
  sexo: string;
  edad: string;
  pesoKg: string;
  alturaCm: string;
  actividad: string;
  objetivo: string;
  comidas: string;
  alergias: string;
  preferencias: string;
  observaciones: string;
  cinturaCm: string;
  caderaCm: string;
  cuelloCm: string;
};

export function buildAIPrompt(fields: AIBriefFields, targets: NutritionTargets): string {
  return `Eres un nutricionista deportivo profesional. Crea un plan nutricional completo y detallado para:

**DATOS DEL ATLETA**
- Nombre: ${fields.nombre || "Sin nombre"}
- Sexo biológico: ${fields.sexo}
- Edad: ${fields.edad} años
- Peso: ${fields.pesoKg} kg
- Altura: ${fields.alturaCm} cm
- Nivel de actividad: ${fields.actividad}
- Objetivo: ${fields.objetivo}
- Número de comidas/día: ${fields.comidas || "5"}
- Alergias/Intolerancias: ${fields.alergias || "Ninguna"}
- Preferencias: ${fields.preferencias || "Sin preferencias especiales"}
- Observaciones médicas: ${fields.observaciones || "Ninguna"}
${fields.cinturaCm ? `- Cintura: ${fields.cinturaCm} cm` : ""}
${fields.caderaCm ? `- Cadera: ${fields.caderaCm} cm` : ""}
${fields.cuelloCm ? `- Cuello: ${fields.cuelloCm} cm` : ""}

**OBJETIVOS CALCULADOS**
- Calorías objetivo: ${targets.calorias} kcal
- Proteínas: ${targets.proteinas} g
- Carbohidratos: ${targets.carbohidratos} g
- Grasas: ${targets.grasas} g

**INSTRUCCIONES**
1. Diseña ${fields.comidas || "5"} comidas distribuidas a lo largo del día.
2. Para cada comida especifica: nombre, hora sugerida, lista de alimentos con gramos exactos, y totales de macros.
3. Usa alimentos típicos argentinos y fáciles de conseguir.
4. Incluye variedad y considera las preferencias indicadas.
5. Al final añade recomendaciones de hidratación y suplementación si aplica.
6. Formato: bien estructurado, claro y profesional.`;
}
