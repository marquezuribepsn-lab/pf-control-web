"use client";

import { useEffect, useMemo, useState } from "react";
import { useAlumnos } from "../../../components/AlumnosProvider";
import { markManualSaveIntent, useSharedState } from "../../../components/useSharedState";
import { argentineFoodsBase, type ArgentineFood } from "../../../data/argentineFoods";
import {
  buildMealDistribution as calcBuildMealDistribution,
  calculateAdvancedTargets as calcAdvancedTargets,
  calculateRiskProfile as calcRiskProfile,
  calculateTargets as calcTargets,
  createMealNames as calcMealNames,
  escapeHtml as calcEscapeHtml,
  estimateTrainingMinutes as calcTrainingMinutes,
  minutesToTime as calcMinutesToTime,
  parseKeywords as calcParseKeywords,
  parseNumber as calcParseNumber,
  roundValue as calcRoundValue,
  timeToMinutes as calcTimeToMinutes,
} from "./nutritionCalculations";
import {
  buildNutritionDetailUrl,
  buildNutritionListUrl,
  filterAssignedClientRows,
  parseNutritionDetailFromSearch,
} from "./nutritionFlow";

type NutritionGoal = "mantenimiento" | "recomposicion" | "masa" | "deficit";
type BiologicalSex = "femenino" | "masculino";
type ActivityLevel = "sedentario" | "ligero" | "moderado" | "alto" | "muy-alto";
type TrainingFocus = "fuerza" | "resistencia" | "mixto" | "tecnico";
type TrainingTime = "manana" | "mediodia" | "tarde" | "noche";
type MedicalFlag = "diabetes" | "hipotiroidismo" | "hipertension" | "dislipidemia" | "sop" | "ninguna";

type NutritionAITemplate = {
  id: string;
  name: string;
  goal: NutritionGoal;
  brief: NutritionAIBrief;
  createdAt: string;
};

type RiskProfile = {
  imc: number;
  rce: number;
  rcc: number;
  bodyFatEstimate: number;
  riskLevel: "bajo" | "moderado" | "alto";
  notes: string[];
};

type PlanFoodItem = {
  id: string;
  foodId: string;
  gramos: number;
};

type PlanMeal = {
  id: string;
  nombre: string;
  items: PlanFoodItem[];
};

type NutritionTargets = {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
};

type NutritionPlan = {
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

type AlumnoNutritionAssignment = {
  alumnoNombre: string;
  planId: string;
  assignedAt: string;
};

type NutritionAIBrief = {
  sexo: BiologicalSex;
  edad: string;
  pesoKg: string;
  alturaCm: string;
  actividad: ActivityLevel;
  objetivo: NutritionGoal;
  trainingSessionsPerDay: string;
  trainingFocus: TrainingFocus;
  trainingTime: TrainingTime;
  wakeUpTime: string;
  sleepTime: string;
  preferredMeals: string;
  anamnesis: string;
  enfermedades: MedicalFlag[];
  medicamentos: string;
  alergias: string;
  foodLikes: string;
  foodDislikes: string;
  cinturaCm: string;
  caderaCm: string;
  cuelloCm: string;
  brazoCm: string;
  musloCm: string;
};

const PLANS_KEY = "pf-control-nutricion-planes-v1";
const CUSTOM_FOODS_KEY = "pf-control-nutricion-alimentos-v1";
const ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
const AI_TEMPLATES_KEY = "pf-control-nutricion-ia-templates-v1";

const DEFAULT_MEALS: PlanMeal[] = [
  { id: "meal-desayuno", nombre: "Desayuno", items: [] },
  { id: "meal-comida-1", nombre: "Comida 1", items: [] },
  { id: "meal-comida-2", nombre: "Comida 2", items: [] },
  { id: "meal-cena", nombre: "Cena", items: [] },
];

const MEDICAL_OPTIONS: Array<{ id: MedicalFlag; label: string }> = [
  { id: "ninguna", label: "Ninguna" },
  { id: "diabetes", label: "Diabetes" },
  { id: "hipotiroidismo", label: "Hipotiroidismo" },
  { id: "hipertension", label: "Hipertension" },
  { id: "dislipidemia", label: "Dislipidemia" },
  { id: "sop", label: "SOP" },
];

const INITIAL_AI_BRIEF: NutritionAIBrief = {
  sexo: "femenino",
  edad: "24",
  pesoKg: "60",
  alturaCm: "165",
  actividad: "moderado",
  objetivo: "mantenimiento",
  trainingSessionsPerDay: "1",
  trainingFocus: "mixto",
  trainingTime: "tarde",
  wakeUpTime: "07:00",
  sleepTime: "23:00",
  preferredMeals: "4",
  anamnesis: "",
  enfermedades: ["ninguna"],
  medicamentos: "",
  alergias: "",
  foodLikes: "",
  foodDislikes: "",
  cinturaCm: "72",
  caderaCm: "95",
  cuelloCm: "33",
  brazoCm: "28",
  musloCm: "54",
};

function roundValue(value: number) {
  return calcRoundValue(value);
}

function buildPlanName(index: number) {
  return `Plan nutricional ${index}`;
}

function calculateTargets({
  sexo,
  edad,
  pesoKg,
  alturaCm,
  actividad,
  objetivo,
}: {
  sexo: BiologicalSex;
  edad: number;
  pesoKg: number;
  alturaCm: number;
  actividad: ActivityLevel;
  objetivo: NutritionGoal;
}): NutritionTargets {
  return calcTargets({ sexo, edad, pesoKg, alturaCm, actividad, objetivo });
}

function createDefaultPlan(index = 1): NutritionPlan {
  const targets = calculateTargets({
    sexo: "femenino",
    edad: 24,
    pesoKg: 60,
    alturaCm: 165,
    actividad: "moderado",
    objetivo: "mantenimiento",
  });

  return {
    id: `plan-${Date.now()}`,
    nombre: buildPlanName(index),
    alumnoAsignado: null,
    sexo: "femenino",
    edad: 24,
    pesoKg: 60,
    alturaCm: 165,
    actividad: "moderado",
    objetivo: "mantenimiento",
    notas: "",
    targets,
    comidas: DEFAULT_MEALS,
    updatedAt: new Date().toISOString(),
  };
}

function parseNumber(value: string, fallback: number) {
  return calcParseNumber(value, fallback);
}

function foodTotals(food: ArgentineFood, gramos: number) {
  const ratio = Math.max(0, gramos) / 100;
  return {
    calorias: food.kcalPer100g * ratio,
    proteinas: food.proteinPer100g * ratio,
    carbohidratos: food.carbsPer100g * ratio,
    grasas: food.fatPer100g * ratio,
  };
}

function parseKeywords(value: string) {
  return calcParseKeywords(value);
}

function timeToMinutes(value: string, fallback: number) {
  return calcTimeToMinutes(value, fallback);
}

function minutesToTime(value: number) {
  return calcMinutesToTime(value);
}

function estimateTrainingMinutes(trainingTime: TrainingTime) {
  return calcTrainingMinutes(trainingTime);
}

function calculateAdvancedTargets(brief: NutritionAIBrief) {
  return calcAdvancedTargets(brief);
}

function buildMealDistribution(mealsCount: number) {
  return calcBuildMealDistribution(mealsCount);
}

function createMealNames(mealsCount: number, trainingTime: TrainingTime) {
  return calcMealNames(mealsCount, trainingTime);
}

function calculateRiskProfile(brief: NutritionAIBrief): RiskProfile {
  return calcRiskProfile(brief);
}

function escapeHtml(value: string) {
  return calcEscapeHtml(value);
}

export default function NutritionPlanner() {
  const { alumnos } = useAlumnos();
  const [isClientDetailMode, setIsClientDetailMode] = useState(false);
  const [isPlansViewMode, setIsPlansViewMode] = useState(false);
  const [detailAlumnoName, setDetailAlumnoName] = useState<string | null>(null);
  const [detailPlanId, setDetailPlanId] = useState<string | null>(null);

  const [plans, setPlans] = useSharedState<NutritionPlan[]>([createDefaultPlan(1)], {
    key: PLANS_KEY,
    legacyLocalStorageKey: PLANS_KEY,
  });

  const [customFoods, setCustomFoods] = useSharedState<ArgentineFood[]>([], {
    key: CUSTOM_FOODS_KEY,
    legacyLocalStorageKey: CUSTOM_FOODS_KEY,
  });

  const [assignments, setAssignments] = useSharedState<AlumnoNutritionAssignment[]>([], {
    key: ASSIGNMENTS_KEY,
    legacyLocalStorageKey: ASSIGNMENTS_KEY,
  });

  const [aiTemplates, setAiTemplates] = useSharedState<NutritionAITemplate[]>([], {
    key: AI_TEMPLATES_KEY,
    legacyLocalStorageKey: AI_TEMPLATES_KEY,
  });

  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || "");
  const [foodSearch, setFoodSearch] = useState("");
  const [newFoodName, setNewFoodName] = useState("");
  const [newFoodGroup, setNewFoodGroup] = useState("Personalizado");
  const [newFoodKcal, setNewFoodKcal] = useState("100");
  const [newFoodProtein, setNewFoodProtein] = useState("10");
  const [newFoodCarbs, setNewFoodCarbs] = useState("10");
  const [newFoodFat, setNewFoodFat] = useState("5");
  const [selectedFoodGroup, setSelectedFoodGroup] = useState<string>("todos");
  const [bulkFoodsInput, setBulkFoodsInput] = useState("");
  const [bulkImportMessage, setBulkImportMessage] = useState<string | null>(null);
  const [mealFoodSearch, setMealFoodSearch] = useState<Record<string, string>>({});
  const [assignmentSelectionByPlanId, setAssignmentSelectionByPlanId] = useState<Record<string, string>>({});
  const [aiBrief, setAiBrief] = useState<NutritionAIBrief>(INITIAL_AI_BRIEF);
  const [aiGenerationMessage, setAiGenerationMessage] = useState<string>("");
  const [aiTemplateName, setAiTemplateName] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");

  const allFoods = useMemo(() => {
    return [...argentineFoodsBase, ...customFoods];
  }, [customFoods]);

  const foodsById = useMemo(() => {
    return new Map(allFoods.map((food) => [food.id, food]));
  }, [allFoods]);

  const availableFoodGroups = useMemo(() => {
    return ["todos", ...new Set(allFoods.map((food) => food.grupo))];
  }, [allFoods]);

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === selectedPlanId) || plans[0] || null;
  }, [plans, selectedPlanId]);

  const assignedClientRows = useMemo(() => {
    return assignments
      .map((assignment) => {
        const plan = plans.find((item) => item.id === assignment.planId);
        if (!plan) return null;
        return {
          alumnoNombre: assignment.alumnoNombre,
          planId: assignment.planId,
          assignedAt: assignment.assignedAt,
          planNombre: plan.nombre,
          objetivo: plan.objetivo,
          calorias: plan.targets.calorias,
          updatedAt: plan.updatedAt,
        };
      })
      .filter(Boolean) as Array<{
      alumnoNombre: string;
      planId: string;
      assignedAt: string;
      planNombre: string;
      objetivo: NutritionGoal;
      calorias: number;
      updatedAt: string;
    }>;
  }, [assignments, plans]);

  const detailPlan = useMemo(() => {
    if (!detailPlanId) return null;
    return plans.find((plan) => plan.id === detailPlanId) || null;
  }, [detailPlanId, plans]);

  const filteredAssignedClientRows = useMemo(() => {
    return filterAssignedClientRows(assignedClientRows, clientSearch);
  }, [assignedClientRows, clientSearch]);

  const planIntake = useMemo(() => {
    if (!selectedPlan) {
      return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
    }

    const totals = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };

    for (const meal of selectedPlan.comidas) {
      for (const item of meal.items) {
        const food = foodsById.get(item.foodId);
        if (!food) continue;
        const row = foodTotals(food, item.gramos);
        totals.calorias += row.calorias;
        totals.proteinas += row.proteinas;
        totals.carbohidratos += row.carbohidratos;
        totals.grasas += row.grasas;
      }
    }

    return {
      calorias: roundValue(totals.calorias),
      proteinas: roundValue(totals.proteinas),
      carbohidratos: roundValue(totals.carbohidratos),
      grasas: roundValue(totals.grasas),
    };
  }, [selectedPlan, foodsById]);

  const filteredFoods = useMemo(() => {
    const needle = foodSearch.trim().toLowerCase();
    return allFoods.filter((food) => {
      if (selectedFoodGroup !== "todos" && food.grupo !== selectedFoodGroup) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const content = `${food.nombre} ${food.grupo}`.toLowerCase();
      return content.includes(needle);
    });
  }, [allFoods, foodSearch, selectedFoodGroup]);

  const updateAiBrief = <K extends keyof NutritionAIBrief>(key: K, value: NutritionAIBrief[K]) => {
    setAiBrief((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMedicalFlag = (flag: MedicalFlag) => {
    setAiBrief((prev) => {
      const current = prev.enfermedades;

      if (flag === "ninguna") {
        return { ...prev, enfermedades: ["ninguna"] };
      }

      const withoutNone = current.filter((item) => item !== "ninguna");
      const exists = withoutNone.includes(flag);
      const next = exists ? withoutNone.filter((item) => item !== flag) : [...withoutNone, flag];

      return {
        ...prev,
        enfermedades: next.length > 0 ? next : ["ninguna"],
      };
    });
  };

  const pickFoodId = (keywords: string[], excludedIds: Set<string>) => {
    for (const keyword of keywords) {
      const match = allFoods.find(
        (food) =>
          !excludedIds.has(food.id) &&
          (`${food.nombre} ${food.grupo}`.toLowerCase().includes(keyword) || food.grupo.toLowerCase().includes(keyword))
      );
      if (match) {
        excludedIds.add(match.id);
        return match.id;
      }
    }

    const fallback = allFoods.find((food) => !excludedIds.has(food.id));
    if (fallback) {
      excludedIds.add(fallback.id);
      return fallback.id;
    }

    return allFoods[0]?.id || "";
  };

  const generatePlanWithAI = () => {
    if (!selectedPlan) return;

    const advanced = calculateAdvancedTargets(aiBrief);
    const mealsCount = Math.max(3, Math.min(6, Math.round(parseNumber(aiBrief.preferredMeals, 4))));
    const distribution = buildMealDistribution(mealsCount);
    const mealNames = createMealNames(mealsCount, aiBrief.trainingTime);
    const trainingAt = estimateTrainingMinutes(aiBrief.trainingTime);
    const wakeAt = timeToMinutes(aiBrief.wakeUpTime, 7 * 60);
    const sleepAt = timeToMinutes(aiBrief.sleepTime, 23 * 60);
    const awakeSpan = Math.max(10 * 60, sleepAt - wakeAt);
    const step = awakeSpan / Math.max(1, mealsCount - 1);
    const likes = parseKeywords(aiBrief.foodLikes);
    const dislikes = parseKeywords(aiBrief.foodDislikes);
    const focusKeywords: Record<TrainingFocus, string[]> = {
      fuerza: ["huevo", "carne", "pollo", "atun", "yogur", "queso", "legumbre"],
      resistencia: ["arroz", "papa", "avena", "banana", "fruta", "pasta", "pan"],
      mixto: ["pollo", "arroz", "huevo", "fruta", "avena", "yogur"],
      tecnico: ["fruta", "yogur", "huevo", "arroz", "legumbre"],
    };

    const ignoredKeywords = new Set(dislikes);
    const excludedIds = new Set<string>();
    const baseKeywords = [...likes, ...focusKeywords[aiBrief.trainingFocus], "verdura", "fruta", "proteina"];

    const comidas: PlanMeal[] = mealNames.map((nombre, index) => {
      const plannedTime = minutesToTime(wakeAt + step * index);
      const pct = Math.round((distribution[index] || 0.15) * 100);
      const primaryKeywords = baseKeywords.filter((keyword) => !ignoredKeywords.has(keyword));
      const secondaryKeywords = ["avena", "arroz", "pollo", "huevo", "fruta", "verdura"];

      const firstFoodId = pickFoodId(primaryKeywords, excludedIds);
      const secondFoodId = pickFoodId([...secondaryKeywords, ...primaryKeywords], excludedIds);
      const thirdFoodId = pickFoodId(["fruta", "verdura", "legumbre", "yogur", ...primaryKeywords], excludedIds);

      const isPreTraining = Math.abs(wakeAt + step * index - (trainingAt - 90)) <= 70;
      const isPostTraining = Math.abs(wakeAt + step * index - (trainingAt + 70)) <= 70;
      const gramsBase = isPreTraining ? 90 : isPostTraining ? 140 : 110;

      return {
        id: `meal-${Date.now()}-${index}`,
        nombre: `${nombre} (${plannedTime})`,
        items: [
          firstFoodId ? { id: `item-${Date.now()}-${index}-a`, foodId: firstFoodId, gramos: gramsBase } : null,
          secondFoodId ? { id: `item-${Date.now()}-${index}-b`, foodId: secondFoodId, gramos: Math.max(70, gramsBase - 20) } : null,
          thirdFoodId ? { id: `item-${Date.now()}-${index}-c`, foodId: thirdFoodId, gramos: 80 } : null,
        ].filter(Boolean) as PlanFoodItem[],
      };
    });

    const riskProfile = calculateRiskProfile(aiBrief);
    const patologias = aiBrief.enfermedades.includes("ninguna")
      ? "sin patologias reportadas"
      : aiBrief.enfermedades.join(", ");

    const notes = [
      `Generado con asistente IA nutricional - ${new Date().toLocaleString()}`,
      `Formula base: Harris-Benedict + Mifflin-St Jeor (promedio).`,
      `IMC estimado: ${advanced.imc}.`,
      `Perimetria: cintura ${aiBrief.cinturaCm} cm, cadera ${aiBrief.caderaCm} cm, cuello ${aiBrief.cuelloCm} cm, brazo ${aiBrief.brazoCm} cm, muslo ${aiBrief.musloCm} cm.`,
      `Riesgo metabolico: ${riskProfile.riskLevel.toUpperCase()} (RCE ${riskProfile.rce} / RCC ${riskProfile.rcc} / GC estimado ${riskProfile.bodyFatEstimate}%).`,
      `Notas de riesgo: ${riskProfile.notes.join(" ") || "Sin alertas relevantes."}`,
      `Patologias/condiciones: ${patologias}.`,
      `Medicacion: ${aiBrief.medicamentos.trim() || "No reporta"}.`,
      `Alergias/intolerancias: ${aiBrief.alergias.trim() || "No reporta"}.`,
      `Anamnesis: ${aiBrief.anamnesis.trim() || "Sin observaciones."}`,
      `Entrenamiento: ${advanced.sessionsPerDay} sesion(es)/dia - ${aiBrief.trainingFocus} - horario ${aiBrief.trainingTime}.`,
      `Horario sugerido de comidas desde ${aiBrief.wakeUpTime} hasta ${aiBrief.sleepTime}.`,
      `Distribucion kcal por comida: ${distribution.map((value) => `${Math.round(value * 100)}%`).join(" / ")}.`,
      `Preferencias usadas: ${aiBrief.foodLikes.trim() || "No definidas"}.`,
      `Alimentos evitados: ${aiBrief.foodDislikes.trim() || "No definidos"}.`,
    ].join("\n");

    updatePlan(selectedPlan.id, (plan) => ({
      ...plan,
      sexo: aiBrief.sexo,
      edad: advanced.edad,
      pesoKg: advanced.pesoKg,
      alturaCm: advanced.alturaCm,
      actividad: aiBrief.actividad,
      objetivo: aiBrief.objetivo,
      targets: advanced.targets,
      notas: notes,
      comidas,
      nombre: `${plan.nombre} · IA`,
    }));

    setAiGenerationMessage("Plan generado con IA. Revisa y ajusta detalles antes de guardar.");
  };

  const saveCurrentAIBriefAsTemplate = () => {
    const safeName = aiTemplateName.trim() || `Plantilla ${aiBrief.objetivo} ${new Date().toLocaleDateString()}`;
    const template: NutritionAITemplate = {
      id: `tpl-${Date.now()}`,
      name: safeName,
      goal: aiBrief.objetivo,
      brief: { ...aiBrief },
      createdAt: new Date().toISOString(),
    };

    setAiTemplates((prev) => [template, ...prev]);
    setAiTemplateName("");
    setSelectedTemplateId(template.id);
    setAiGenerationMessage("Plantilla IA creada. Se guarda junto con Guardar cambios.");
  };

  const applySelectedTemplate = () => {
    const template = aiTemplates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    setAiBrief({ ...template.brief });
    setAiGenerationMessage(`Plantilla aplicada: ${template.name}.`);
  };

  const deleteSelectedTemplate = () => {
    if (!selectedTemplateId) return;
    setAiTemplates((prev) => prev.filter((item) => item.id !== selectedTemplateId));
    setSelectedTemplateId("");
    setAiGenerationMessage("Plantilla eliminada. Se confirma al guardar cambios.");
  };

  const exportCurrentPlanPdf = (mode: "paciente" | "profesional") => {
    if (!selectedPlan) return;

    const riskProfile = calculateRiskProfile(aiBrief);
    const generatedAt = new Date().toLocaleString();

    const mealRows = selectedPlan.comidas
      .map((meal) => {
        const items = meal.items
          .map((item) => {
            const food = foodsById.get(item.foodId);
            const foodName = food?.nombre || "Alimento";
            return `<li>${escapeHtml(foodName)} - ${item.gramos} g</li>`;
          })
          .join("");

        return `
          <section style="margin-bottom:14px; padding:10px; border:1px solid #d6d8dc; border-radius:10px;">
            <h3 style="margin:0 0 8px; font-size:15px;">${escapeHtml(meal.nombre)}</h3>
            <ul style="margin:0; padding-left:18px;">${items || "<li>Sin items</li>"}</ul>
          </section>
        `;
      })
      .join("");

    const patientSummary = [
      `Objetivo principal: ${selectedPlan.objetivo}.`,
      `Enfocarse en constancia de horarios y adherencia a porciones.`,
      `Revisar hidratacion diaria y tolerancia digestiva.`,
      aiBrief.alergias.trim() ? `Alergias/intolerancias: ${aiBrief.alergias.trim()}.` : "",
      aiBrief.foodDislikes.trim() ? `Evitar segun preferencia: ${aiBrief.foodDislikes.trim()}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const professionalSummary = [
      `Formula: Harris-Benedict + Mifflin-St Jeor (promedio).`,
      `Perimetria: cintura ${aiBrief.cinturaCm} cm, cadera ${aiBrief.caderaCm} cm, cuello ${aiBrief.cuelloCm} cm, brazo ${aiBrief.brazoCm} cm, muslo ${aiBrief.musloCm} cm.`,
      `IMC ${riskProfile.imc}, RCE ${riskProfile.rce}, RCC ${riskProfile.rcc}, GC estimado ${riskProfile.bodyFatEstimate}%, riesgo ${riskProfile.riskLevel}.`,
      `Condiciones: ${aiBrief.enfermedades.includes("ninguna") ? "sin patologias reportadas" : aiBrief.enfermedades.join(", ")}.`,
      `Medicacion: ${aiBrief.medicamentos.trim() || "No reporta"}.`,
      `Anamnesis: ${aiBrief.anamnesis.trim() || "Sin observaciones."}`,
    ].join(" ");

    const html = `
      <html>
        <head>
          <title>${escapeHtml(selectedPlan.nombre)}</title>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              background: #f8fafc;
            }
            .page {
              max-width: 900px;
              margin: 0 auto;
              padding: 24px;
            }
            .header {
              border-radius: 16px;
              background: linear-gradient(120deg, #0b1324, #1d3557);
              color: #f8fafc;
              padding: 16px 18px;
              margin-bottom: 14px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 10px;
            }
            .brand {
              font-weight: 800;
              letter-spacing: 0.04em;
              font-size: 14px;
            }
            .badge {
              border: 1px solid rgba(125, 211, 252, 0.45);
              border-radius: 999px;
              padding: 4px 10px;
              font-size: 11px;
              font-weight: 700;
              color: #bae6fd;
              background: rgba(6, 182, 212, 0.18);
            }
            .subtitle {
              margin: 8px 0 0;
              font-size: 12px;
              color: #cbd5e1;
            }
            .card {
              background: #ffffff;
              border: 1px solid #dbe5f0;
              border-radius: 14px;
              padding: 14px;
              margin-bottom: 12px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 8px;
              font-size: 13px;
            }
            .macro-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 8px;
              margin-top: 10px;
            }
            .macro {
              border-radius: 10px;
              padding: 8px;
              background: #f1f5f9;
              text-align: center;
            }
            .meal {
              margin-bottom: 10px;
              padding: 10px;
              border: 1px solid #d6d8dc;
              border-radius: 10px;
              background: #ffffff;
            }
            .meal h3 {
              margin: 0 0 8px;
              font-size: 15px;
            }
            .summary {
              margin: 0;
              padding: 10px;
              border-radius: 10px;
              background: #e2e8f0;
              font-size: 13px;
              line-height: 1.4;
            }
            .footer {
              margin-top: 10px;
              font-size: 12px;
              color: #475569;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <section class="header">
              <div class="header-top">
                <div class="brand">PF CONTROL · PLAN NUTRICIONAL</div>
                <span class="badge">${mode === "paciente" ? "VERSION PACIENTE" : "VERSION PROFESIONAL"}</span>
              </div>
              <p class="subtitle">Generado: ${escapeHtml(generatedAt)}</p>
            </section>

            <section class="card">
              <h1 style="margin:0 0 8px; font-size:22px;">${escapeHtml(selectedPlan.nombre)}</h1>
              <div class="grid">
                <p style="margin:0;"><strong>Alumno:</strong> ${escapeHtml(selectedPlan.alumnoAsignado || "Sin asignar")}</p>
                <p style="margin:0;"><strong>Objetivo:</strong> ${escapeHtml(selectedPlan.objetivo)}</p>
              </div>
              <div class="macro-grid">
                <div class="macro"><strong>${selectedPlan.targets.calorias}</strong><br/>kcal</div>
                <div class="macro"><strong>${selectedPlan.targets.proteinas} g</strong><br/>proteinas</div>
                <div class="macro"><strong>${selectedPlan.targets.carbohidratos} g</strong><br/>carbohidratos</div>
                <div class="macro"><strong>${selectedPlan.targets.grasas} g</strong><br/>grasas</div>
              </div>
            </section>

            <section class="card">
              <p class="summary">
            ${escapeHtml(mode === "paciente" ? patientSummary : professionalSummary)}
              </p>
            </section>

            <section class="card">
              <h2 style="margin:0 0 8px;">Distribucion de comidas</h2>
              ${mealRows.replace(/<section style=\"margin-bottom:14px; padding:10px; border:1px solid #d6d8dc; border-radius:10px;\">/g, "<section class=\"meal\">")}
            </section>

            ${
              mode === "profesional"
                ? `<section class=\"card\"><h2 style=\"margin:0 0 8px;\">Notas</h2>
              <pre style=\"white-space:pre-wrap; border:1px solid #d6d8dc; border-radius:10px; padding:10px; margin:0;\">${escapeHtml(selectedPlan.notas || "Sin notas")}</pre></section>`
                : ""
            }

            <p class="footer">PF Control · Nutricion deportiva</p>
          </div>
        </body>
      </html>
    `;

    const printable = window.open("", "_blank", "width=900,height=700");
    if (!printable) {
      setAiGenerationMessage("No se pudo abrir la ventana para exportar PDF.");
      return;
    }

    printable.document.open();
    printable.document.write(html);
    printable.document.close();
    printable.focus();
    printable.print();
  };

  const updatePlan = (planId: string, updater: (plan: NutritionPlan) => NutritionPlan) => {
    setPlans((prev) =>
      prev.map((plan) => (plan.id === planId ? { ...updater(plan), updatedAt: new Date().toISOString() } : plan))
    );
  };

  const addPlan = () => {
    const newPlan = createDefaultPlan(plans.length + 1);
    setPlans((prev) => [newPlan, ...prev]);
    setSelectedPlanId(newPlan.id);
  };

  const deletePlan = (planId: string) => {
    if (plans.length <= 1) return;

    setPlans((prev) => prev.filter((plan) => plan.id !== planId));

    setAssignments((prev) => prev.filter((assignment) => assignment.planId !== planId));

    if (selectedPlanId === planId) {
      const next = plans.find((plan) => plan.id !== planId);
      setSelectedPlanId(next?.id || "");
    }
  };

  const recomputeTargets = (plan: NutritionPlan) => {
    return calculateTargets({
      sexo: plan.sexo,
      edad: plan.edad,
      pesoKg: plan.pesoKg,
      alturaCm: plan.alturaCm,
      actividad: plan.actividad,
      objetivo: plan.objetivo,
    });
  };

  const addMeal = (planId: string) => {
    updatePlan(planId, (plan) => ({
      ...plan,
      comidas: [
        ...plan.comidas,
        {
          id: `meal-${Date.now()}`,
          nombre: `Comida ${plan.comidas.length + 1}`,
          items: [],
        },
      ],
    }));
  };

  const removeMeal = (planId: string, mealId: string) => {
    updatePlan(planId, (plan) => ({
      ...plan,
      comidas: plan.comidas.filter((meal) => meal.id !== mealId),
    }));
  };

  const addFoodToMeal = (planId: string, mealId: string, foodId: string) => {
    updatePlan(planId, (plan) => ({
      ...plan,
      comidas: plan.comidas.map((meal) =>
        meal.id !== mealId
          ? meal
          : {
              ...meal,
              items: [
                ...meal.items,
                { id: `item-${Date.now()}-${Math.random()}`, foodId, gramos: 100 },
              ],
            }
      ),
    }));
  };

  const updateMealItem = (
    planId: string,
    mealId: string,
    itemId: string,
    patch: Partial<PlanFoodItem>
  ) => {
    updatePlan(planId, (plan) => ({
      ...plan,
      comidas: plan.comidas.map((meal) =>
        meal.id !== mealId
          ? meal
          : {
              ...meal,
              items: meal.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            }
      ),
    }));
  };

  const removeMealItem = (planId: string, mealId: string, itemId: string) => {
    updatePlan(planId, (plan) => ({
      ...plan,
      comidas: plan.comidas.map((meal) =>
        meal.id !== mealId
          ? meal
          : { ...meal, items: meal.items.filter((item) => item.id !== itemId) }
      ),
    }));
  };

  const addCustomFood = () => {
    const nombre = newFoodName.trim();
    if (!nombre) return;

    const customFood: ArgentineFood = {
      id: `custom-${Date.now()}`,
      nombre,
      grupo: newFoodGroup.trim() || "Personalizado",
      kcalPer100g: parseNumber(newFoodKcal, 100),
      proteinPer100g: parseNumber(newFoodProtein, 0),
      carbsPer100g: parseNumber(newFoodCarbs, 0),
      fatPer100g: parseNumber(newFoodFat, 0),
      source: "TCA-AR",
    };

    setCustomFoods((prev) => [customFood, ...prev]);

    setNewFoodName("");
    setNewFoodGroup("Personalizado");
    setNewFoodKcal("100");
    setNewFoodProtein("10");
    setNewFoodCarbs("10");
    setNewFoodFat("5");
  };

  const importFoodsFromRawCsv = (rawCsv: string) => {
    const raw = rawCsv.trim();
    if (!raw) {
      setBulkImportMessage("Pega un CSV para importar alimentos.");
      return;
    }

    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      setBulkImportMessage("El CSV necesita encabezado y al menos una fila.");
      return;
    }

    const header = lines[0].toLowerCase();
    const delimiter = header.includes(";") ? ";" : ",";

    const imported: ArgentineFood[] = [];
    const existingNames = new Set(allFoods.map((food) => food.nombre.trim().toLowerCase()));

    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split(delimiter).map((col) => col.trim());
      if (cols.length < 6) {
        continue;
      }

      const [nombre, grupo, kcal, protein, carbs, fat] = cols;
      const normalizedName = nombre.toLowerCase();

      if (!nombre || existingNames.has(normalizedName)) {
        continue;
      }

      imported.push({
        id: `bulk-${Date.now()}-${i}`,
        nombre,
        grupo: grupo || "Sin grupo",
        kcalPer100g: parseNumber(kcal, 0),
        proteinPer100g: parseNumber(protein, 0),
        carbsPer100g: parseNumber(carbs, 0),
        fatPer100g: parseNumber(fat, 0),
        source: "TCA-AR",
      });

      existingNames.add(normalizedName);
    }

    if (imported.length === 0) {
      setBulkImportMessage("No se importaron filas nuevas (revisa formato o duplicados).");
      return;
    }

    setCustomFoods((prev) => [...imported, ...prev]);
    setBulkImportMessage(`Se importaron ${imported.length} alimentos.`);
    setBulkFoodsInput("");
  };

  const importFoodsFromCsv = () => {
    importFoodsFromRawCsv(bulkFoodsInput);
  };

  const handleCsvFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setBulkImportMessage("El archivo debe ser .csv");
      event.currentTarget.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      importFoodsFromRawCsv(content);
    };
    reader.onerror = () => {
      setBulkImportMessage("No se pudo leer el archivo CSV");
    };
    reader.readAsText(file);

    event.currentTarget.value = "";
  };

  const downloadCsvTemplate = () => {
    const rows = [
      "nombre,grupo,kcal,proteina,carbohidrato,grasa",
      "Pollo cocido,Carnes,165,31,0,3.6",
      "Arroz cocido,Cereales,130,2.4,28.2,0.3",
      "Avena,Cereales,389,16.9,66.3,6.9",
      "Lentejas cocidas,Legumbres,116,9,20.1,0.4",
    ];

    const content = rows.join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "plantilla-alimentos-nutricion.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const assignPlanToAlumno = (alumnoNombre: string, planId: string) => {
    if (!alumnoNombre || !planId) return;

    setAssignments((prev) => {
      const withoutAlumno = prev.filter((assignment) => assignment.alumnoNombre !== alumnoNombre);
      return [
        ...withoutAlumno,
        {
          alumnoNombre,
          planId,
          assignedAt: new Date().toISOString(),
        },
      ];
    });

    updatePlan(planId, (plan) => ({ ...plan, alumnoAsignado: alumnoNombre }));
  };

  const selectedAlumnoForPlan =
    assignmentSelectionByPlanId[selectedPlan.id] ?? selectedPlan.alumnoAsignado ?? "";

  const saveNutritionChanges = () => {
    markManualSaveIntent(PLANS_KEY);
    markManualSaveIntent(CUSTOM_FOODS_KEY);
    markManualSaveIntent(ASSIGNMENTS_KEY);
    markManualSaveIntent(AI_TEMPLATES_KEY);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromLocation = () => {
      const parsed = parseNutritionDetailFromSearch(window.location.search);
      setIsClientDetailMode(parsed.isDetailMode);
      setDetailAlumnoName(parsed.alumnoNombre);
      setDetailPlanId(parsed.planId);
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, []);

  const openClientPlanDetail = (alumnoNombre: string, planId: string) => {
    if (typeof window === "undefined") return;
    const detailUrl = buildNutritionDetailUrl(
      window.location.pathname,
      window.location.search,
      alumnoNombre,
      planId
    );
    window.location.assign(detailUrl);
  };

  const goBackToClientList = () => {
    if (typeof window === "undefined") return;
    window.location.assign(buildNutritionListUrl(window.location.pathname));
  };

  if (!selectedPlan) {
    return (
      <div className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 text-slate-100 shadow-lg sm:p-6">
        No hay plan nutricional activo.
      </div>
    );
  }

  const caloriasDiff = roundValue(planIntake.calorias - selectedPlan.targets.calorias);
  const officialFoodsCount = argentineFoodsBase.length;
  const visibleFoodsCount = filteredFoods.length;

  if (isClientDetailMode) {
    if (!detailPlan) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-slate-900/80 p-4">
            <h2 className="text-xl font-black text-slate-100">Detalle de plan nutricional</h2>
            <button
              type="button"
              onClick={goBackToClientList}
              className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
            >
              Volver al listado
            </button>
          </div>
          <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-4 text-slate-100 sm:p-6">
            No se encontro el plan seleccionado para ese cliente.
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-slate-100">
        <section className="rounded-2xl border border-white/15 bg-slate-900/80 p-4 shadow-lg sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-300">Ficha nutricional</p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">{detailAlumnoName || detailPlan.alumnoAsignado || "Alumno"}</h2>
              <p className="mt-1 text-sm text-slate-300">{detailPlan.nombre}</p>
            </div>
            <button
              type="button"
              onClick={goBackToClientList}
              className="w-full rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10 sm:w-auto sm:py-1.5"
            >
              Volver al listado
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-slate-950/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Objetivo</p>
              <p className="text-sm font-bold">{detailPlan.objetivo}</p>
            </div>
            <div className="rounded-xl bg-slate-950/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Calorias</p>
              <p className="text-sm font-bold">{detailPlan.targets.calorias} kcal</p>
            </div>
            <div className="rounded-xl bg-slate-950/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Proteinas</p>
              <p className="text-sm font-bold">{detailPlan.targets.proteinas} g</p>
            </div>
            <div className="rounded-xl bg-slate-950/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Carbohidratos</p>
              <p className="text-sm font-bold">{detailPlan.targets.carbohidratos} g</p>
            </div>
            <div className="rounded-xl bg-slate-950/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Grasas</p>
              <p className="text-sm font-bold">{detailPlan.targets.grasas} g</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-800/65 p-4 shadow-lg sm:p-5">
          <h3 className="text-lg font-black">Plan completo de comidas</h3>
          <div className="mt-3 space-y-3">
            {detailPlan.comidas.map((meal) => (
              <div key={meal.id} className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
                <p className="text-sm font-bold text-cyan-100">{meal.nombre}</p>
                {meal.items.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">Sin alimentos cargados.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {meal.items.map((item) => {
                      const food = foodsById.get(item.foodId);
                      const totals = food ? foodTotals(food, item.gramos) : null;
                      return (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-3 py-2 text-xs">
                          <span className="min-w-0 flex-1 font-semibold text-slate-100">{food?.nombre || "Alimento"}</span>
                          <span className="text-slate-300">{item.gramos} g</span>
                          <span className="text-slate-300">{totals ? `${roundValue(totals.calorias)} kcal` : "Sin datos"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-5">
          <h3 className="text-lg font-black">Notas profesionales</h3>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-200">
            {detailPlan.notas || "Sin notas registradas."}
          </pre>
        </section>
      </div>
    );
  }

  if (isPlansViewMode) {
    return (
      <div className="space-y-4 text-slate-100 sm:space-y-5">
        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Gestion de planes</p>
              <h2 className="mt-1 text-2xl font-black leading-none sm:text-3xl">Planes nutricionales</h2>
              <p className="mt-2 text-sm text-slate-300">
                Administra tus planes en esta pantalla y vuelve a Nutricion para editar el plan seleccionado.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPlansViewMode(false)}
              className="w-full rounded-xl border border-cyan-300/60 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 sm:w-auto"
            >
              Volver a Nutricion
            </button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-2xl border border-white/15 bg-slate-800/65 p-4 text-slate-100 shadow-lg sm:p-5">
            <h3 className="text-lg font-black">Listado de planes</h3>
            <p className="mt-1 text-xs text-slate-300">Selecciona uno para editarlo en la pantalla principal.</p>

            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <p className="rounded-lg bg-slate-900/65 px-3 py-2 text-slate-200">
                Total planes: <span className="font-black text-slate-100">{plans.length}</span>
              </p>
              <p className="rounded-lg bg-slate-900/65 px-3 py-2 text-slate-200">
                Con alumno: <span className="font-black text-slate-100">{plans.filter((plan) => Boolean(plan.alumnoAsignado)).length}</span>
              </p>
              <p className="rounded-lg bg-slate-900/65 px-3 py-2 text-slate-200">
                Sin alumno: <span className="font-black text-slate-100">{plans.filter((plan) => !plan.alumnoAsignado).length}</span>
              </p>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-slate-900/55">
              <div className="hidden border-b border-white/10 bg-slate-950/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-300 md:grid md:grid-cols-[minmax(0,1.4fr)_130px_110px_170px_170px] md:items-center md:gap-2">
                <span>Plan</span>
                <span>Objetivo</span>
                <span>Kcal</span>
                <span>Macros</span>
                <span>Asignado</span>
              </div>

              <div className="max-h-[58vh] overflow-y-auto">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`grid w-full grid-cols-1 gap-1 border-b border-white/5 px-3 py-2 text-left text-xs transition last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_130px_110px_170px_170px] md:items-center md:gap-2 ${
                      selectedPlanId === plan.id
                        ? "bg-cyan-500/15 text-cyan-50"
                        : "text-slate-200 hover:bg-slate-800/70"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">{plan.nombre}</span>
                      <span className="text-[11px] text-slate-400">Actualizado: {plan.updatedAt.slice(0, 10)}</span>
                    </span>
                    <span className="font-semibold capitalize">{plan.objetivo}</span>
                    <span className="font-semibold">{plan.targets.calorias}</span>
                    <span className="text-[11px]">P {plan.targets.proteinas} · C {plan.targets.carbohidratos} · G {plan.targets.grasas}</span>
                    <span className="truncate text-cyan-100">{plan.alumnoAsignado || "Sin asignar"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/15 bg-slate-800/65 p-4 text-slate-100 shadow-lg">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">Acciones</h3>
              <p className="mt-2 truncate rounded-lg bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
                Seleccionado: <span className="font-semibold text-white">{selectedPlan.nombre}</span>
              </p>
              <button
                type="button"
                onClick={() => setIsPlansViewMode(false)}
                className="mt-2 w-full rounded-xl border border-emerald-300/60 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100"
              >
                Editar plan seleccionado
              </button>
              <button
                type="button"
                onClick={addPlan}
                className="mt-3 w-full rounded-xl border border-cyan-300/60 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100"
              >
                Nuevo plan
              </button>
              <button
                type="button"
                onClick={() => deletePlan(selectedPlan.id)}
                disabled={plans.length <= 1}
                className="mt-2 w-full rounded-xl border border-rose-300/60 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 disabled:opacity-50"
              >
                Eliminar plan actual
              </button>
            </div>

            <div className="rounded-2xl border border-cyan-300/35 bg-cyan-500/10 p-4 text-slate-100 shadow-lg">
              <p className="text-xs font-black uppercase tracking-wide text-slate-200">Asignar a alumno</p>
              <select
                value={selectedAlumnoForPlan}
                onChange={(event) =>
                  setAssignmentSelectionByPlanId((prev) => ({
                    ...prev,
                    [selectedPlan.id]: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Seleccionar alumno</option>
                {alumnos.map((alumno) => (
                  <option key={alumno.nombre} value={alumno.nombre}>
                    {alumno.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => assignPlanToAlumno(selectedAlumnoForPlan, selectedPlan.id)}
                disabled={!selectedAlumnoForPlan}
                className="mt-2 w-full rounded-lg border border-cyan-300/60 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-50"
              >
                Asignar plan seleccionado
              </button>

              <div className="mt-3 space-y-1 text-xs text-slate-200">
                {assignments.length === 0 ? (
                  <p className="text-slate-300">Sin asignaciones todavia.</p>
                ) : (
                  assignments.slice(0, 10).map((assignment) => {
                    const assignedPlan = plans.find((plan) => plan.id === assignment.planId);
                    return (
                      <p key={`${assignment.alumnoNombre}-${assignment.planId}`}>
                        {assignment.alumnoNombre}: {assignedPlan?.nombre || "Plan eliminado"}
                      </p>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-100 sm:space-y-5">
      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black">Clientes con plan nutricional</h3>
          <p className="text-xs text-slate-300">Busca un alumno y toca su fila para abrir el plan completo.</p>
        </div>

        <div className="mb-3">
          <input
            value={clientSearch}
            onChange={(event) => setClientSearch(event.target.value)}
            placeholder="Buscar alumno por nombre"
            className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
          />
        </div>

        {assignedClientRows.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
            Todavia no hay clientes con plan asignado.
          </p>
        ) : (
          <div className="space-y-2">
            {clientSearch.trim() === "" ? (
              <p className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                Escribe en el buscador para ver alumnos y abrir su plan.
              </p>
            ) : filteredAssignedClientRows.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                No hay resultados para ese buscador.
              </p>
            ) : (
              filteredAssignedClientRows.map((row) => (
                <button
                  key={`${row.alumnoNombre}-${row.planId}`}
                  type="button"
                  onClick={() => openClientPlanDetail(row.alumnoNombre, row.planId)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-left transition hover:border-cyan-300/40 hover:bg-slate-800/80"
                >
                  <p className="truncate text-sm font-bold text-white">{row.alumnoNombre}</p>
                  <p className="truncate text-xs text-slate-300">{row.planNombre}</p>
                </button>
              ))
            )}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Categoria activa</p>
            <h2 className="mt-1 text-2xl font-black leading-none sm:text-3xl">Nutricion</h2>
            <p className="mt-2 text-sm text-slate-300">
              Planificacion con formula Harris-Benedict, objetivos editables y distribucion diaria de macros.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-300">
              Tabla oficial cargada: {officialFoodsCount} alimentos TCA-AR para buscar y asignar por comida.
            </p>
            <a
              href="https://www.argentina.gob.ar/anmat/tabla-composicion-alimentos"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-cyan-300 underline"
            >
              Abrir referencia oficial de tabla argentina
            </a>
            <p className="mt-2 text-xs text-slate-300">
              Los cambios en planes y comidas quedan en borrador hasta que presiones Guardar cambios.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => exportCurrentPlanPdf("paciente")}
              className="w-full rounded-xl border border-cyan-300/60 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-sm sm:w-auto"
            >
              PDF paciente
            </button>
            <button
              type="button"
              onClick={() => exportCurrentPlanPdf("profesional")}
              className="w-full rounded-xl border border-indigo-300/60 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-100 shadow-sm sm:w-auto"
            >
              PDF profesional
            </button>
            <button
              type="button"
              onClick={saveNutritionChanges}
              className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm sm:w-auto"
            >
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={() => setIsPlansViewMode(true)}
              className="w-full rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm sm:w-auto"
            >
              Ver planes
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-300/35 bg-gradient-to-br from-cyan-500/15 via-slate-900/80 to-emerald-500/10 p-4 shadow-lg sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Asistente IA Nutricional</p>
            <h3 className="mt-1 text-xl font-black">Generacion rapida de plan integral</h3>
            <p className="mt-1 text-xs text-slate-200">
              Completa anamnesis, salud, entrenamiento y gustos. Luego presiona crear para autogenerar objetivos,
              distribucion diaria y comidas base editables.
            </p>
          </div>
          <button
            type="button"
            onClick={generatePlanWithAI}
            className="w-full rounded-xl border border-cyan-300/70 bg-cyan-500/20 px-4 py-2 text-sm font-black text-cyan-100 sm:w-auto"
          >
            Crear plan nutricional con IA
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Sexo</span>
            <select
              value={aiBrief.sexo}
              onChange={(event) => updateAiBrief("sexo", event.target.value as BiologicalSex)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Edad</span>
            <input
              value={aiBrief.edad}
              onChange={(event) => updateAiBrief("edad", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Peso kg</span>
            <input
              value={aiBrief.pesoKg}
              onChange={(event) => updateAiBrief("pesoKg", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Altura cm</span>
            <input
              value={aiBrief.alturaCm}
              onChange={(event) => updateAiBrief("alturaCm", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Actividad</span>
            <select
              value={aiBrief.actividad}
              onChange={(event) => updateAiBrief("actividad", event.target.value as ActivityLevel)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="sedentario">Sedentario</option>
              <option value="ligero">Ligero</option>
              <option value="moderado">Moderado</option>
              <option value="alto">Alto</option>
              <option value="muy-alto">Muy alto</option>
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Objetivo</span>
            <select
              value={aiBrief.objetivo}
              onChange={(event) => updateAiBrief("objetivo", event.target.value as NutritionGoal)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="mantenimiento">Mantenimiento</option>
              <option value="recomposicion">Recomposicion</option>
              <option value="masa">Masa muscular</option>
              <option value="deficit">Deficit calorico</option>
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Sesiones por dia</span>
            <select
              value={aiBrief.trainingSessionsPerDay}
              onChange={(event) => updateAiBrief("trainingSessionsPerDay", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Tipo entrenamiento</span>
            <select
              value={aiBrief.trainingFocus}
              onChange={(event) => updateAiBrief("trainingFocus", event.target.value as TrainingFocus)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="fuerza">Fuerza</option>
              <option value="resistencia">Resistencia</option>
              <option value="mixto">Mixto</option>
              <option value="tecnico">Tecnico</option>
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Horario de entrenamiento</span>
            <select
              value={aiBrief.trainingTime}
              onChange={(event) => updateAiBrief("trainingTime", event.target.value as TrainingTime)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="manana">Manana</option>
              <option value="mediodia">Mediodia</option>
              <option value="tarde">Tarde</option>
              <option value="noche">Noche</option>
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Hora de despertar</span>
            <input
              type="time"
              value={aiBrief.wakeUpTime}
              onChange={(event) => updateAiBrief("wakeUpTime", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Hora de dormir</span>
            <input
              type="time"
              value={aiBrief.sleepTime}
              onChange={(event) => updateAiBrief("sleepTime", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Cantidad de comidas</span>
            <select
              value={aiBrief.preferredMeals}
              onChange={(event) => updateAiBrief("preferredMeals", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Cintura (cm)</span>
            <input
              value={aiBrief.cinturaCm}
              onChange={(event) => updateAiBrief("cinturaCm", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Cadera (cm)</span>
            <input
              value={aiBrief.caderaCm}
              onChange={(event) => updateAiBrief("caderaCm", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Cuello (cm)</span>
            <input
              value={aiBrief.cuelloCm}
              onChange={(event) => updateAiBrief("cuelloCm", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Brazo (cm)</span>
            <input
              value={aiBrief.brazoCm}
              onChange={(event) => updateAiBrief("brazoCm", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Muslo (cm)</span>
            <input
              value={aiBrief.musloCm}
              onChange={(event) => updateAiBrief("musloCm", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-cyan-300/25 bg-slate-900/65 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Plantillas IA</p>
          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)] lg:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
            <input
              value={aiTemplateName}
              onChange={(event) => setAiTemplateName(event.target.value)}
              placeholder="Nombre de plantilla"
              className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Seleccionar plantilla</option>
              {aiTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} - {template.goal}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={saveCurrentAIBriefAsTemplate}
              className="rounded-lg border border-emerald-300/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100"
            >
              Guardar plantilla
            </button>
            <button
              type="button"
              onClick={applySelectedTemplate}
              disabled={!selectedTemplateId}
              className="rounded-lg border border-cyan-300/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={deleteSelectedTemplate}
              disabled={!selectedTemplateId}
              className="rounded-lg border border-rose-300/50 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 disabled:opacity-50"
            >
              Eliminar plantilla
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Anamnesis / contexto clinico</span>
            <textarea
              value={aiBrief.anamnesis}
              onChange={(event) => updateAiBrief("anamnesis", event.target.value)}
              className="h-24 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              placeholder="Habitos, digestivo, energia, sueno, objetivos y antecedentes..."
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Medicamentos</span>
            <textarea
              value={aiBrief.medicamentos}
              onChange={(event) => updateAiBrief("medicamentos", event.target.value)}
              className="h-24 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              placeholder="Dosis/frecuencia de medicacion relevante..."
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Alergias/intolerancias</span>
            <textarea
              value={aiBrief.alergias}
              onChange={(event) => updateAiBrief("alergias", event.target.value)}
              className="h-20 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              placeholder="Lactosa, gluten, frutos secos, etc..."
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wide text-slate-300">Gustos / no gustos (coma separada)</span>
            <input
              value={aiBrief.foodLikes}
              onChange={(event) => updateAiBrief("foodLikes", event.target.value)}
              className="mb-2 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              placeholder="pollo, arroz, banana, yogur"
            />
            <input
              value={aiBrief.foodDislikes}
              onChange={(event) => updateAiBrief("foodDislikes", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              placeholder="no le gusta: pescado, legumbres"
            />
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-white/15 bg-slate-900/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Patologias/metabolico</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MEDICAL_OPTIONS.map((option) => (
              <label key={option.id} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={aiBrief.enfermedades.includes(option.id)}
                  onChange={() => toggleMedicalFlag(option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {(() => {
            const risk = calculateRiskProfile(aiBrief);
            return (
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <p className="rounded-lg bg-slate-800/70 px-2 py-1 text-xs">IMC: <strong>{risk.imc}</strong></p>
                <p className="rounded-lg bg-slate-800/70 px-2 py-1 text-xs">RCE: <strong>{risk.rce}</strong></p>
                <p className="rounded-lg bg-slate-800/70 px-2 py-1 text-xs">RCC: <strong>{risk.rcc}</strong></p>
                <p className="rounded-lg bg-slate-800/70 px-2 py-1 text-xs">Riesgo: <strong>{risk.riskLevel.toUpperCase()}</strong></p>
              </div>
            );
          })()}
          {aiGenerationMessage ? <p className="mt-2 text-xs font-semibold text-emerald-200">{aiGenerationMessage}</p> : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-white/15 bg-slate-800/65 p-4 text-slate-100 shadow-lg">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="w-full text-sm sm:max-w-md">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Plan activo</span>
              <select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-slate-100"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} · {plan.objetivo}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setIsPlansViewMode(true)}
              className="w-full rounded-xl border border-cyan-300/60 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 sm:w-auto"
            >
              Ver planes
            </button>
          </div>

          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <p className="rounded-lg bg-slate-900/60 px-3 py-2 text-slate-200">
              <span className="font-semibold text-slate-100">Objetivo:</span> {selectedPlan.objetivo}
            </p>
            <p className="rounded-lg bg-slate-900/60 px-3 py-2 text-slate-200">
              <span className="font-semibold text-slate-100">Meta kcal:</span> {selectedPlan.targets.calorias}
            </p>
            <p className="rounded-lg bg-slate-900/60 px-3 py-2 text-slate-200">
              <span className="font-semibold text-slate-100">Asignado:</span> {selectedPlan.alumnoAsignado || "Sin asignar"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/15 bg-slate-800/65 p-4 text-slate-100 shadow-lg">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-300">Nombre del plan</span>
                <input
                  value={selectedPlan.nombre}
                  onChange={(event) => updatePlan(selectedPlan.id, (plan) => ({ ...plan, nombre: event.target.value }))}
                  className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-slate-100"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-300">Sexo biologico</span>
                <select
                  value={selectedPlan.sexo}
                  onChange={(event) =>
                    updatePlan(selectedPlan.id, (plan) => {
                      const next = { ...plan, sexo: event.target.value as BiologicalSex };
                      return { ...next, targets: recomputeTargets(next) };
                    })
                  }
                  className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-slate-100"
                >
                  <option value="femenino">Femenino</option>
                  <option value="masculino">Masculino</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-300">Edad</span>
                <input
                  type="number"
                  min={10}
                  max={95}
                  value={selectedPlan.edad}
                  onChange={(event) =>
                    updatePlan(selectedPlan.id, (plan) => {
                      const next = { ...plan, edad: parseNumber(event.target.value, plan.edad) };
                      return { ...next, targets: recomputeTargets(next) };
                    })
                  }
                  className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-slate-100"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-300">Peso (kg)</span>
                <input
                  type="number"
                  min={30}
                  max={250}
                  value={selectedPlan.pesoKg}
                  onChange={(event) =>
                    updatePlan(selectedPlan.id, (plan) => {
                      const next = { ...plan, pesoKg: parseNumber(event.target.value, plan.pesoKg) };
                      return { ...next, targets: recomputeTargets(next) };
                    })
                  }
                  className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-slate-100"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-300">Altura (cm)</span>
                <input
                  type="number"
                  min={130}
                  max={230}
                  value={selectedPlan.alturaCm}
                  onChange={(event) =>
                    updatePlan(selectedPlan.id, (plan) => {
                      const next = { ...plan, alturaCm: parseNumber(event.target.value, plan.alturaCm) };
                      return { ...next, targets: recomputeTargets(next) };
                    })
                  }
                  className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-slate-100"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-300">Nivel de actividad</span>
                <select
                  value={selectedPlan.actividad}
                  onChange={(event) =>
                    updatePlan(selectedPlan.id, (plan) => {
                      const next = { ...plan, actividad: event.target.value as ActivityLevel };
                      return { ...next, targets: recomputeTargets(next) };
                    })
                  }
                  className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-slate-100"
                >
                  <option value="sedentario">Sedentario</option>
                  <option value="ligero">Ligero</option>
                  <option value="moderado">Moderado</option>
                  <option value="alto">Alto</option>
                  <option value="muy-alto">Muy alto</option>
                </select>
              </label>

              <label className="text-sm md:col-span-2 lg:col-span-3">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-300">Objetivo</span>
                <select
                  value={selectedPlan.objetivo}
                  onChange={(event) =>
                    updatePlan(selectedPlan.id, (plan) => {
                      const next = { ...plan, objetivo: event.target.value as NutritionGoal };
                      return { ...next, targets: recomputeTargets(next) };
                    })
                  }
                  className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-slate-100"
                >
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="recomposicion">Recomposicion corporal</option>
                  <option value="masa">Aumento de masa muscular</option>
                  <option value="deficit">Deficit calorico</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-900 p-3 text-white">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">Meta calorias</p>
                <p className="text-xl font-black">{selectedPlan.targets.calorias} kcal</p>
              </div>
              <div className="rounded-xl bg-cyan-900 p-3 text-cyan-50">
                <p className="text-[11px] uppercase tracking-wide text-cyan-200">Proteinas</p>
                <p className="text-xl font-black">{selectedPlan.targets.proteinas} g</p>
              </div>
              <div className="rounded-xl bg-amber-900 p-3 text-amber-50">
                <p className="text-[11px] uppercase tracking-wide text-amber-200">Carbohidratos</p>
                <p className="text-xl font-black">{selectedPlan.targets.carbohidratos} g</p>
              </div>
              <div className="rounded-xl bg-emerald-900 p-3 text-emerald-50">
                <p className="text-[11px] uppercase tracking-wide text-emerald-200">Grasas</p>
                <p className="text-xl font-black">{selectedPlan.targets.grasas} g</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-800/65 p-4 text-slate-100 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">Comidas del plan</h3>
              <button
                type="button"
                onClick={() => addMeal(selectedPlan.id)}
                className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold"
              >
                Agregar comida
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {selectedPlan.comidas.map((meal) => (
                <div key={meal.id} className="rounded-xl border border-white/10 bg-slate-700/55 p-3">
                  {(() => {
                    const mealSearch = (mealFoodSearch[meal.id] || "").trim().toLowerCase();
                    const mealFoods = mealSearch
                      ? filteredFoods.filter((food) => `${food.nombre} ${food.grupo}`.toLowerCase().includes(mealSearch))
                      : filteredFoods;

                    return (
                      <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <input
                      value={meal.nombre}
                      onChange={(event) =>
                        updatePlan(selectedPlan.id, (plan) => ({
                          ...plan,
                          comidas: plan.comidas.map((row) =>
                            row.id === meal.id ? { ...row, nombre: event.target.value } : row
                          ),
                        }))
                      }
                      className="flex-1 rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeMeal(selectedPlan.id, meal.id)}
                      className="rounded-lg border border-rose-300/60 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200"
                    >
                      Quitar comida
                    </button>
                  </div>

                  <input
                    value={mealFoodSearch[meal.id] || ""}
                    onChange={(event) =>
                      setMealFoodSearch((prev) => ({
                        ...prev,
                        [meal.id]: event.target.value,
                      }))
                    }
                    placeholder="Buscar alimento para esta comida"
                    className="mb-3 w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
                  />

                  <div className="space-y-2">
                    {meal.items.map((item) => {
                      const food = foodsById.get(item.foodId);
                      const totals = food ? foodTotals(food, item.gramos) : null;

                      return (
                        <div key={item.id} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_120px_120px_auto] lg:items-center">
                          <select
                            value={item.foodId}
                            onChange={(event) =>
                              updateMealItem(selectedPlan.id, meal.id, item.id, {
                                foodId: event.target.value,
                              })
                            }
                            className="rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100 sm:col-span-2 lg:col-span-1"
                          >
                            {mealFoods.map((foodOption) => (
                              <option key={foodOption.id} value={foodOption.id}>
                                {foodOption.nombre} ({foodOption.kcalPer100g} kcal/100g)
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min={1}
                            value={item.gramos}
                            onChange={(event) =>
                              updateMealItem(selectedPlan.id, meal.id, item.id, {
                                gramos: Math.max(1, parseNumber(event.target.value, item.gramos)),
                              })
                            }
                            className="rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                          />

                          <p className="rounded-lg bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200">
                            {totals ? `${roundValue(totals.calorias)} kcal` : "Sin datos"}
                          </p>

                          <button
                            type="button"
                            onClick={() => removeMealItem(selectedPlan.id, meal.id, item.id)}
                            className="rounded-lg border border-rose-300/60 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 sm:col-span-2 lg:col-span-1"
                          >
                            Quitar
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => addFoodToMeal(selectedPlan.id, meal.id, mealFoods[0]?.id || allFoods[0].id)}
                    className="mt-3 rounded-lg border border-cyan-300/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200"
                  >
                    Agregar alimento
                  </button>
                  {mealFoods.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-200">No hay resultados para ese buscador en esta comida.</p>
                  ) : null}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">Ingesta kcal</p>
                <p className="text-xl font-black text-slate-100">{planIntake.calorias}</p>
                <p className={`text-xs ${caloriasDiff > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                  Diferencia: {caloriasDiff} kcal
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">Proteinas</p>
                <p className="text-xl font-black text-slate-100">{planIntake.proteinas} g</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">Carbohidratos</p>
                <p className="text-xl font-black text-slate-100">{planIntake.carbohidratos} g</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">Grasas</p>
                <p className="text-xl font-black text-slate-100">{planIntake.grasas} g</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-800/65 p-4 text-slate-100 shadow-lg">
            <h3 className="text-lg font-black">Base de alimentos</h3>
            <p className="text-xs text-slate-300">Busqueda sobre la tabla completa y alta de alimentos personalizados.</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">Oficiales TCA-AR</p>
                <p className="text-lg font-black text-emerald-100">{officialFoodsCount}</p>
              </div>
              <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Personalizados</p>
                <p className="text-lg font-black text-cyan-100">{customFoods.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/55 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Resultados filtro</p>
                <p className="text-lg font-black text-slate-100">{visibleFoodsCount}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                value={foodSearch}
                onChange={(event) => setFoodSearch(event.target.value)}
                placeholder="Buscar alimento por nombre o grupo"
                className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
              <select
                value={selectedFoodGroup}
                onChange={(event) => setSelectedFoodGroup(event.target.value)}
                className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100"
              >
                {availableFoodGroups.map((groupName) => (
                  <option key={groupName} value={groupName}>
                    {groupName === "todos" ? "Todos los grupos" : groupName}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/10 bg-slate-900/60">
              {filteredFoods.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-300">No hay alimentos para el filtro actual.</p>
              ) : (
                filteredFoods.map((food) => (
                  <div key={food.id} className="grid gap-2 border-b border-white/5 px-3 py-2 text-sm last:border-b-0 sm:grid-cols-[1fr_auto] sm:gap-3">
                    <div>
                      <p className="font-semibold leading-tight">{food.nombre}</p>
                      <p className="text-xs text-slate-300">{food.grupo} · {food.source}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-100 sm:justify-end">
                      <span className="rounded-md bg-slate-700 px-2 py-0.5">{food.kcalPer100g} kcal</span>
                      <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-cyan-100">P {food.proteinPer100g}g</span>
                      <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-amber-100">C {food.carbsPer100g}g</span>
                      <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-emerald-100">G {food.fatPer100g}g</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              <input
                value={newFoodName}
                onChange={(event) => setNewFoodName(event.target.value)}
                placeholder="Nombre alimento"
                className="rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
              <input
                value={newFoodGroup}
                onChange={(event) => setNewFoodGroup(event.target.value)}
                placeholder="Grupo"
                className="rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
              <input
                value={newFoodKcal}
                onChange={(event) => setNewFoodKcal(event.target.value)}
                placeholder="kcal/100g"
                className="rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
              <input
                value={newFoodProtein}
                onChange={(event) => setNewFoodProtein(event.target.value)}
                placeholder="proteina/100g"
                className="rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
              <input
                value={newFoodCarbs}
                onChange={(event) => setNewFoodCarbs(event.target.value)}
                placeholder="carbohidrato/100g"
                className="rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
              <input
                value={newFoodFat}
                onChange={(event) => setNewFoodFat(event.target.value)}
                placeholder="grasa/100g"
                className="rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={addCustomFood}
              className="mt-3 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Agregar alimento personalizado
            </button>

            <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/55 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-200">Importacion masiva (CSV)</p>
              <p className="mt-1 text-xs text-slate-300">
                Formato: nombre,grupo,kcal,proteina,carbohidrato,grasa por cada fila.
              </p>

              <button
                type="button"
                onClick={downloadCsvTemplate}
                className="mt-2 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-100"
              >
                Descargar formato CSV
              </button>

              <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-cyan-300/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
                Subir archivo .csv
                <input type="file" accept=".csv,text/csv" onChange={handleCsvFileUpload} className="hidden" />
              </label>

              <textarea
                value={bulkFoodsInput}
                onChange={(event) => setBulkFoodsInput(event.target.value)}
                className="mt-2 h-28 w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400"
                placeholder={"nombre,grupo,kcal,proteina,carbohidrato,grasa\nPollo cocido,Carnes,165,31,0,3.6\nArroz cocido,Cereales,130,2.4,28.2,0.3"}
              />
              <button
                type="button"
                onClick={importFoodsFromCsv}
                className="mt-2 rounded-lg border border-cyan-300/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200"
              >
                Importar lote de alimentos
              </button>
              {bulkImportMessage ? (
                <p className="mt-2 text-xs font-semibold text-slate-200">{bulkImportMessage}</p>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveNutritionChanges}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                Guardar cambios de nutricion
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
