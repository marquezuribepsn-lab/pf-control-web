// ─── Nutrition Hub — Constants ────────────────────────────────────────────────

import type {
  ActivityLevel,
  BiologicalSex,
  MedicalFlag,
  NutritionGoal,
  TrainingFocus,
  TrainingTime,
} from "./types";

// ─── Storage keys — must match AlumnoVisionClient.tsx ────────────────────────

export const PLANS_KEY = "pf-control-nutricion-planes-v1";
export const ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
export const CUSTOM_FOODS_KEY = "pf-control-nutricion-alimentos-v1";
export const ANTHROPOMETRY_KEY = "pf-control-nutricion-antropometria-v1";

// ─── Labels ───────────────────────────────────────────────────────────────────

export const GOAL_LABELS: Record<NutritionGoal, string> = {
  mantenimiento: "Mantenimiento",
  recomposicion: "Recomposición",
  masa: "Ganancia muscular",
  deficit: "Pérdida de grasa",
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentario: "Sedentario",
  ligero: "Ligero (1-3 días/semana)",
  moderado: "Moderado (3-5 días/semana)",
  alto: "Alto (6-7 días/semana)",
  "muy-alto": "Muy alto (2x/día)",
};

export const SEX_LABELS: Record<BiologicalSex, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
};

export const TRAINING_FOCUS_LABELS: Record<TrainingFocus, string> = {
  fuerza: "Fuerza",
  resistencia: "Resistencia",
  mixto: "Mixto",
  tecnico: "Técnico",
};

export const TRAINING_TIME_LABELS: Record<TrainingTime, string> = {
  manana: "Mañana",
  mediodia: "Mediodía",
  tarde: "Tarde",
  noche: "Noche",
};

export const MEDICAL_FLAG_LABELS: Record<MedicalFlag, string> = {
  diabetes: "Diabetes",
  hipotiroidismo: "Hipotiroidismo",
  hipertension: "Hipertensión",
  dislipidemia: "Dislipidemia",
  sop: "SOP",
  ninguna: "Ninguna",
};

export const GOAL_COLORS: Record<NutritionGoal, string> = {
  mantenimiento: "text-sky-400",
  recomposicion: "text-violet-400",
  masa: "text-emerald-400",
  deficit: "text-amber-400",
};

export const GOAL_BG_COLORS: Record<NutritionGoal, string> = {
  mantenimiento: "bg-sky-500/15 border-sky-500/30",
  recomposicion: "bg-violet-500/15 border-violet-500/30",
  masa: "bg-emerald-500/15 border-emerald-500/30",
  deficit: "bg-amber-500/15 border-amber-500/30",
};

// ─── Activity multipliers ────────────────────────────────────────────────────

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  "muy-alto": 1.9,
};

export const GOAL_FACTORS: Record<NutritionGoal, number> = {
  mantenimiento: 1,
  recomposicion: 0.92,
  masa: 1.12,
  deficit: 0.8,
};

// ─── IMC ranges ──────────────────────────────────────────────────────────────

export const IMC_RANGES = [
  { max: 18.5, label: "Bajo peso", color: "#60a5fa" },
  { max: 25, label: "Normal", color: "#34d399" },
  { max: 30, label: "Sobrepeso", color: "#fbbf24" },
  { max: 35, label: "Obesidad I", color: "#f97316" },
  { max: 40, label: "Obesidad II", color: "#ef4444" },
  { max: Infinity, label: "Obesidad III", color: "#dc2626" },
];

export function getImcCategory(imc: number) {
  return IMC_RANGES.find((r) => imc < r.max) ?? IMC_RANGES[IMC_RANGES.length - 1];
}

// ─── Default meal names ──────────────────────────────────────────────────────

export const DEFAULT_MEAL_NAMES = [
  "Desayuno",
  "Media mañana",
  "Almuerzo",
  "Merienda",
  "Cena",
  "Pre-entreno",
  "Post-entreno",
];

// ─── Tab config ───────────────────────────────────────────────────────────────

export const HUB_TABS = [
  { id: "planes", label: "Planes", icon: "📋" },
  { id: "alumnos", label: "Alumnos", icon: "👥" },
  { id: "ia", label: "IA", icon: "🤖" },
  { id: "calculadoras", label: "Calculadoras", icon: "🧮" },
  { id: "estadisticas", label: "Estadísticas", icon: "📊" },
  { id: "registros", label: "Registros", icon: "📏" },
  { id: "alimentos", label: "Alimentos", icon: "🥗" },
] as const;
