/**
 * nutritionPlanAI.ts
 *
 * Motor algorítmico de adaptación de planes nutricionales.
 * No realiza llamadas a APIs externas: toda la lógica es matemática/fisiológica
 * basada en fórmulas estándar de nutrición deportiva.
 *
 * Flujo:
 *   1. calcTargets()   → calorías TDEE + macro distribución por objetivo
 *   2. adaptPlan()     → escala un plan existente a los nuevos targets
 *   3. buildPlan()     → genera un plan desde cero con alimentos del catálogo ARG
 */

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type NutritionGoal =
  | "mantenimiento"
  | "recomposicion"
  | "masa"
  | "deficit";

export type ActivityLevel =
  | "sedentario"
  | "ligero"
  | "moderado"
  | "alto"
  | "muy-alto";

export type BiologicalSex = "masculino" | "femenino";

export type NutritionTargets = {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
};

export type PlanFoodItem = { id: string; foodId: string; gramos: number };
export type PlanMeal    = { id: string; nombre: string; items: PlanFoodItem[] };

export type ClientNutritionProfile = {
  nombre: string;
  sexo: BiologicalSex;
  pesoKg: number;
  alturaCm: number;
  edad: number;
  actividad: ActivityLevel;
  objetivo: NutritionGoal;
  observaciones?: string;
  /** Número de comidas por día deseadas (3–6). Si no se indica, se usan 5. */
  comidasDia?: number;
  /** Días de entrenamiento por semana (1–7). Influye en el nivel de actividad. */
  diasEntrenamiento?: number;
  /** Restricciones / alergias alimentarias del cliente. */
  restricciones?: string;
  /** Condiciones médicas relevantes. */
  condicionesMedicas?: string;
};

export type NutritionPlanPayload = {
  targets: NutritionTargets;
  comidas: PlanMeal[];
};

// ─── Constantes fisiológicas ───────────────────────────────────────────────────

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario:  1.20,
  ligero:      1.375,
  moderado:    1.55,
  alto:        1.725,
  "muy-alto":  1.90,
};

/** Ajuste calórico sobre TDEE según objetivo */
const GOAL_KCAL_FACTOR: Record<NutritionGoal, number> = {
  mantenimiento: 1.00,
  recomposicion: 0.97,   // leve déficit para recomposición
  deficit:       0.82,   // déficit moderado ~18%
  masa:          1.10,   // superávit 10%
};

/** Proteína objetivo (g/kg peso) y % de calorías como grasa */
const MACRO_PROFILES: Record<NutritionGoal, { protPerKg: number; fatPct: number }> = {
  mantenimiento: { protPerKg: 1.8, fatPct: 0.30 },
  recomposicion: { protPerKg: 2.4, fatPct: 0.27 },
  deficit:       { protPerKg: 2.2, fatPct: 0.28 },
  masa:          { protPerKg: 2.0, fatPct: 0.25 },
};

// ─── Fórmula Mifflin-St Jeor ───────────────────────────────────────────────────

function calcBMR(
  sexo: BiologicalSex,
  pesoKg: number,
  alturaCm: number,
  edad: number,
): number {
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * edad;
  return sexo === "masculino" ? base + 5 : base - 161;
}

// ─── Cálculo de targets ────────────────────────────────────────────────────────

export function calcNutritionTargets(p: ClientNutritionProfile): NutritionTargets {
  const bmr     = calcBMR(p.sexo, p.pesoKg, p.alturaCm, p.edad);
  const tdee    = bmr * ACTIVITY_FACTORS[p.actividad];
  const calorias = Math.round(tdee * GOAL_KCAL_FACTOR[p.objetivo]);

  const { protPerKg, fatPct } = MACRO_PROFILES[p.objetivo];
  const proteinas     = Math.round(p.pesoKg * protPerKg);
  const grasas        = Math.round((calorias * fatPct) / 9);
  const carbsRaw      = (calorias - proteinas * 4 - grasas * 9) / 4;
  const carbohidratos = Math.max(Math.round(carbsRaw), 50);

  return { calorias, proteinas, carbohidratos, grasas };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

// ─── Adaptación de plan existente ─────────────────────────────────────────────

/**
 * Escala proporcialmente todos los gramos de un plan base para que sus
 * calorías se acerquen a los targets calculados para el nuevo perfil.
 * Preserva la estructura de comidas y alimentos originales.
 */
export function adaptNutritionPlan(
  profile: ClientNutritionProfile,
  basePlan: { targets: NutritionTargets; comidas: PlanMeal[] },
): NutritionPlanPayload {
  const newTargets = calcNutritionTargets(profile);
  const oldKcal    = basePlan.targets.calorias || 2000;
  const ratio      = newTargets.calorias / oldKcal;

  const comidas: PlanMeal[] = basePlan.comidas.map((meal) => ({
    id:     meal.id || uid(),
    nombre: meal.nombre,
    items:  meal.items.map((item) => ({
      id:     item.id || uid(),
      foodId: item.foodId,
      gramos: clamp(Math.round(item.gramos * ratio), 5, 1000),
    })),
  }));

  return { targets: newTargets, comidas };
}

// ─── Generación desde cero ────────────────────────────────────────────────────

/**
 * Macros de cada alimento base del catálogo TCA-AR (verificados).
 * Usado internamente para calcular gramos sin importar el JSON completo.
 */
const FOOD_MACROS: Record<string, { kcal: number; p: number; c: number; g: number }> = {
  "avena-arrollada-cruda":            { kcal: 357, p: 15.6, c: 62.5, g: 6.5  },
  "yogur-descremado":                 { kcal:  36, p:  2.9, c:  6.0, g: 0.0  },
  "banana":                           { kcal:  92, p:  1.2, c: 23.0, g: 0.2  },
  "nuez":                             { kcal: 690, p: 13.9, c: 13.7, g: 67.4 },
  "manzana-con-piel":                 { kcal:  48, p:  0.3, c: 13.8, g: 0.2  },
  "pollo-pechuga-sin-piel-crudo":     { kcal: 114, p: 22.5, c:  0.0, g: 2.6  },
  "atun-enlatado-al-natural":         { kcal:  86, p: 19.4, c:  0.0, g: 1.0  },
  "arroz-blanco-crudo":               { kcal: 339, p:  6.9, c: 79.2, g: 0.2  },
  "papa-hervida":                     { kcal:  81, p:  1.7, c: 20.0, g: 0.1  },
  "batata-cruda":                     { kcal:  73, p:  1.1, c: 19.8, g: 0.1  },
  "aceite-de-oliva":                  { kcal: 900, p:  0.0, c:  0.0, g:100.0 },
  "brocoli-crudo":                    { kcal:  27, p:  3.3, c:  5.5, g: 0.2  },
  "pan-blanco-tipo-molde-lacteado":   { kcal: 244, p:  9.4, c: 50.2, g: 2.2  },
  "huevo-de-gallina-entero-hervido":  { kcal: 156, p: 12.0, c:  0.4, g:11.8  },
};

/** Calcula cuántos gramos de un alimento aportan las kcal indicadas */
function gramsForKcal(foodId: string, targetKcal: number): number {
  const f = FOOD_MACROS[foodId];
  if (!f || f.kcal === 0) return 100;
  return clamp(Math.round((targetKcal / f.kcal) * 100), 10, 800);
}

/** Calcula cuántos gramos aportan la proteína indicada */
function gramsForProtein(foodId: string, targetProt: number): number {
  const f = FOOD_MACROS[foodId];
  if (!f || f.p === 0) return 100;
  return clamp(Math.round((targetProt / f.p) * 100), 10, 600);
}

// ─── Distribuciones calóricas según número de comidas ─────────────────────────

/** Qué porción del total de kcal/prot va a cada "slot" de comida */
type MealSlot = { nombre: string; kcalPct: number; protPct: number };

function getMealSlots(n: number): MealSlot[] {
  if (n <= 3) return [
    { nombre: "Desayuno",  kcalPct: 0.30, protPct: 0.25 },
    { nombre: "Almuerzo",  kcalPct: 0.42, protPct: 0.40 },
    { nombre: "Cena",      kcalPct: 0.28, protPct: 0.35 },
  ];
  if (n === 4) return [
    { nombre: "Desayuno",  kcalPct: 0.25, protPct: 0.22 },
    { nombre: "Almuerzo",  kcalPct: 0.38, protPct: 0.38 },
    { nombre: "Merienda",  kcalPct: 0.12, protPct: 0.10 },
    { nombre: "Cena",      kcalPct: 0.25, protPct: 0.30 },
  ];
  if (n === 6) return [
    { nombre: "Desayuno",       kcalPct: 0.20, protPct: 0.18 },
    { nombre: "Media mañana",   kcalPct: 0.10, protPct: 0.10 },
    { nombre: "Almuerzo",       kcalPct: 0.30, protPct: 0.30 },
    { nombre: "Merienda",       kcalPct: 0.10, protPct: 0.10 },
    { nombre: "Cena",           kcalPct: 0.20, protPct: 0.22 },
    { nombre: "Colación nocturna", kcalPct: 0.10, protPct: 0.10 },
  ];
  // Default (5 comidas)
  return [
    { nombre: "Desayuno",      kcalPct: 0.25, protPct: 0.22 },
    { nombre: "Media mañana",  kcalPct: 0.10, protPct: 0.10 },
    { nombre: "Almuerzo",      kcalPct: 0.35, protPct: 0.38 },
    { nombre: "Merienda",      kcalPct: 0.10, protPct: 0.10 },
    { nombre: "Cena",          kcalPct: 0.20, protPct: 0.20 },
  ];
}

/** Genera los items para una comida dado su slot y tipo de comida */
function buildMealItems(
  slotName: string,
  slotKcal: number,
  slotProt: number,
  objetivo: NutritionGoal,
  item: (foodId: string, gramos: number) => PlanFoodItem
): PlanFoodItem[] {
  const carbSource = objetivo === "deficit" ? "batata-cruda" : "arroz-blanco-crudo";

  const name = slotName.toLowerCase();

  // ── Desayuno / Media mañana style ─────────────────────────────────────
  if (name.includes("desayuno")) {
    const avenaKcal = slotKcal * 0.40;
    const yogurProt = Math.max(slotProt - FOOD_MACROS["avena-arrollada-cruda"].p * (gramsForKcal("avena-arrollada-cruda", avenaKcal) / 100), 4);
    return [
      item("avena-arrollada-cruda", gramsForKcal("avena-arrollada-cruda", avenaKcal)),
      item("yogur-descremado",      gramsForProtein("yogur-descremado", yogurProt)),
      item("banana",                clamp(Math.round(slotKcal * 0.20 / FOOD_MACROS["banana"].kcal * 100), 80, 200)),
      item("nuez",                  clamp(Math.round(slotKcal * 0.12 / FOOD_MACROS["nuez"].kcal * 100), 10, 35)),
    ];
  }

  if (name.includes("media mañana") || name.includes("colación nocturna")) {
    return [
      item("manzana-con-piel", clamp(Math.round(slotKcal * 0.55 / FOOD_MACROS["manzana-con-piel"].kcal * 100), 100, 300)),
      item("yogur-descremado", clamp(Math.round(slotKcal * 0.45 / FOOD_MACROS["yogur-descremado"].kcal * 100), 100, 300)),
    ];
  }

  if (name.includes("merienda")) {
    return [
      item("pan-blanco-tipo-molde-lacteado", clamp(Math.round(slotKcal * 0.55 / FOOD_MACROS["pan-blanco-tipo-molde-lacteado"].kcal * 100), 30, 120)),
      item("yogur-descremado",               clamp(Math.round(slotKcal * 0.45 / FOOD_MACROS["yogur-descremado"].kcal * 100), 100, 300)),
    ];
  }

  if (name.includes("almuerzo")) {
    const polloGrams  = gramsForProtein("pollo-pechuga-sin-piel-crudo", slotProt);
    const kcalPollo   = polloGrams / 100 * FOOD_MACROS["pollo-pechuga-sin-piel-crudo"].kcal;
    const kcalAceite  = 8 / 100 * FOOD_MACROS["aceite-de-oliva"].kcal;
    const kcalBrocoli = 150 / 100 * FOOD_MACROS["brocoli-crudo"].kcal;
    const kcalCarbs   = Math.max(slotKcal - kcalPollo - kcalAceite - kcalBrocoli, 0);
    return [
      item("pollo-pechuga-sin-piel-crudo", polloGrams),
      item(carbSource,                     gramsForKcal(carbSource, kcalCarbs)),
      item("brocoli-crudo",                150),
      item("aceite-de-oliva",              8),
    ];
  }

  // Cena y cualquier otra comida proteica
  const atunGrams  = gramsForProtein("atun-enlatado-al-natural", slotProt);
  const kcalAtun   = atunGrams / 100 * FOOD_MACROS["atun-enlatado-al-natural"].kcal;
  const kcalAc2    = 8 / 100 * FOOD_MACROS["aceite-de-oliva"].kcal;
  const kcalBroc2  = 150 / 100 * FOOD_MACROS["brocoli-crudo"].kcal;
  const kcalParaP  = Math.max(slotKcal - kcalAtun - kcalAc2 - kcalBroc2, 0);
  return [
    item("atun-enlatado-al-natural", atunGrams),
    item("papa-hervida",             gramsForKcal("papa-hervida", kcalParaP)),
    item("brocoli-crudo",            150),
    item("aceite-de-oliva",          8),
  ];
}

/**
 * Genera un plan nutricional completo desde cero, calibrado al perfil del cliente.
 * Usa alimentos del catálogo TCA-AR verificados.
 * Soporta 3–6 comidas por día via profile.comidasDia.
 */
export function buildNutritionPlan(profile: ClientNutritionProfile): NutritionPlanPayload {
  const targets = calcNutritionTargets(profile);

  // ── helper: item ──────────────────────────────────────────────────────────
  const item = (foodId: string, gramos: number): PlanFoodItem => ({
    id: uid(), foodId, gramos: clamp(Math.round(gramos), 10, 800),
  });

  const n = clamp(Math.round(profile.comidasDia ?? 5), 3, 6);
  const slots = getMealSlots(n);

  const comidas: PlanMeal[] = slots.map((slot) => ({
    id:     uid(),
    nombre: slot.nombre,
    items:  buildMealItems(
      slot.nombre,
      targets.calorias  * slot.kcalPct,
      targets.proteinas * slot.protPct,
      profile.objetivo,
      item
    ),
  }));

  return { targets, comidas };
}
