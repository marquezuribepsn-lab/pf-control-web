// ─── Nutrition Hub — Shared Types ─────────────────────────────────────────────

export type NutritionGoal = "mantenimiento" | "recomposicion" | "masa" | "deficit";
export type BiologicalSex = "femenino" | "masculino";
export type ActivityLevel = "sedentario" | "ligero" | "moderado" | "alto" | "muy-alto";
export type TrainingFocus = "fuerza" | "resistencia" | "mixto" | "tecnico";
export type TrainingTime = "manana" | "mediodia" | "tarde" | "noche";
export type MedicalFlag =
  | "diabetes"
  | "hipotiroidismo"
  | "hipertension"
  | "dislipidemia"
  | "sop"
  | "ninguna";

export type NutritionTargets = {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
};

// ─── Food / Meal ─────────────────────────────────────────────────────────────

export type PlanFoodItem = {
  id: string;
  foodId: string;
  gramos: number;
};

export type PlanMeal = {
  id: string;
  nombre: string;
  items: PlanFoodItem[];
};

export type CustomFood = {
  id: string;
  nombre: string;
  grupo: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  createdAt: string;
};

// ─── Nutrition Plan ───────────────────────────────────────────────────────────

export type NutritionPlan = {
  id: string;
  nombre: string;
  alumnoAsignado: string | null;
  sexo: BiologicalSex;
  edad: number;
  pesoKg: number;
  alturaCm: number;
  actividad: ActivityLevel;
  objetivo: NutritionGoal;
  notas: string;
  targets: NutritionTargets;
  comidas: PlanMeal[];
  updatedAt: string;
};

// ─── Assignment ───────────────────────────────────────────────────────────────

export type AlumnoNutritionAssignment = {
  alumnoNombre: string;
  planId: string;
  assignedAt: string;
};

// ─── Anthropometry ───────────────────────────────────────────────────────────

export type AnthropometryRecord = {
  id: string;
  alumnoNombre: string;
  fecha: string;
  pesoKg: number | null;
  alturaCm: number | null;
  imc: number | null;
  cinturaCm: number | null;
  caderaCm: number | null;
  cuelloCm: number | null;
  brazoCm: number | null;
  musloCm: number | null;
  grasaCorporalPct: number | null;
  notas: string;
};

// ─── Hub State (props passed to each tab) ────────────────────────────────────

export type NutritionHubState = {
  planes: NutritionPlan[];
  setPlanes: React.Dispatch<React.SetStateAction<NutritionPlan[]>>;
  assignments: AlumnoNutritionAssignment[];
  setAssignments: React.Dispatch<React.SetStateAction<AlumnoNutritionAssignment[]>>;
  customFoods: CustomFood[];
  setCustomFoods: React.Dispatch<React.SetStateAction<CustomFood[]>>;
  anthropometry: AnthropometryRecord[];
  setAnthropometry: React.Dispatch<React.SetStateAction<AnthropometryRecord[]>>;
  alumnosNombres: string[];
  loaded: boolean;
};

export type NutritionHubTab =
  | "planes"
  | "alumnos"
  | "ia"
  | "calculadoras"
  | "estadisticas"
  | "registros"
  | "alimentos";
