"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAlumnos } from "../../../components/AlumnosProvider";
import { useEjercicios } from "../../../components/EjerciciosProvider";
import { usePlayers } from "../../../components/PlayersProvider";
import { useSessions } from "../../../components/SessionsProvider";
import { markManualSaveIntent, useSharedState } from "../../../components/useSharedState";
import type { Sesion } from "../../../data/mockData";
import { argentineFoodsBase } from "../../../data/argentineFoods";
import type { TrainingPlan, TrainingPlanSession } from "../../../lib/trainingPlanAI";

type ClienteTipo = "jugadora" | "alumno";
type PlanViewTab = "plan-entrenamiento" | "plan-nutricional";
type PersonaTipo = "jugadoras" | "alumnos";

type ClienteView = {
  id: string;
  tipo: ClienteTipo;
  nombre: string;
  categoria?: string;
};

type NutritionGoal = "mantenimiento" | "recomposicion" | "masa" | "deficit";

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
  objetivo: NutritionGoal;
  notas: string;
  targets: NutritionTargets;
  comidas: Array<{
    id: string;
    nombre: string;
    items: Array<{
      id: string;
      foodId: string;
      gramos: number;
    }>;
  }>;
  updatedAt: string;
};

type AlumnoNutritionAssignment = {
  alumnoNombre: string;
  planId: string;
  assignedAt: string;
};

type NutritionFood = {
  id: string;
  nombre: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

type WeekDayPlan = {
  id: string;
  dia: string;
  planificacion: string;
  objetivo?: string;
  sesionId?: string;
};

type WeekPlan = {
  id: string;
  nombre: string;
  objetivo: string;
  dias: WeekDayPlan[];
};

type WeekPersonPlan = {
  ownerKey: string;
  tipo: PersonaTipo;
  nombre: string;
  categoria?: string;
  semanas: WeekPlan[];
  historial?: unknown[];
};

type WeekPlanTemplate = {
  id: string;
  nombre: string;
  tipo: PersonaTipo;
  categoria?: string;
  semanas: WeekPlan[];
};

type WeekStore = {
  version: number;
  planes: WeekPersonPlan[];
  templates: WeekPlanTemplate[];
};

type StoredAITrainingPlan = {
  id: string;
  nombre: string;
  createdAt: string;
  updatedAt: string;
  plan: TrainingPlan;
};

type TemplateLibraryItem = {
  optionId: string;
  source: "template" | "ia";
  nombre: string;
  categoria?: string;
  deporte?: string;
  totalSemanas: number;
  totalDias: number;
  diasConSesion: number;
  searchText: string;
  template?: WeekPlanTemplate;
  aiPlan?: StoredAITrainingPlan;
};

const NUTRITION_PLANS_KEY = "pf-control-nutricion-planes-v1";
const NUTRITION_ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
const NUTRITION_CUSTOM_FOODS_KEY = "pf-control-nutricion-alimentos-v1";
const WEEK_PLAN_KEY = "pf-control-semana-plan";
const AI_TRAINING_PLANS_KEY = "pf-control-ai-training-plans-v1";

const WEEK_DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const WEEKDAY_BY_INDEX = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
];

function normalizeText(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function guessExerciseCategory(name: string): string {
  const normalized = normalizeText(name);
  if (normalized.includes("sprint") || normalized.includes("aceler")) return "Velocidad";
  if (normalized.includes("salto") || normalized.includes("pliometr")) return "Potencia";
  if (normalized.includes("movilidad") || normalized.includes("respiracion")) return "Core";
  if (normalized.includes("intermit") || normalized.includes("aerob")) return "Condicion";
  if (
    normalized.includes("tecnica") ||
    normalized.includes("rondo") ||
    normalized.includes("juego")
  ) {
    return "Tecnica";
  }
  return "Fuerza";
}

function getDayLabelFromIsoDate(isoDate: string, fallbackIndex: number): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return WEEK_DAY_NAMES[fallbackIndex] || `Dia ${fallbackIndex + 1}`;
  }

  return WEEKDAY_BY_INDEX[parsed.getDay()] || WEEK_DAY_NAMES[fallbackIndex] || `Dia ${fallbackIndex + 1}`;
}

function toPersonaTipo(tipo: ClienteTipo): PersonaTipo {
  return tipo === "jugadora" ? "jugadoras" : "alumnos";
}

function buildPlanOwnerKey(tipo: PersonaTipo, nombre: string): string {
  return `${tipo}:${String(nombre || "").trim().toLowerCase()}`;
}

function createDefaultDayPlan(index: number): WeekDayPlan {
  return {
    id: createId("dia"),
    dia: WEEK_DAY_NAMES[index] || `Dia ${index + 1}`,
    planificacion: "",
    objetivo: "",
    sesionId: "",
  };
}

function createDefaultWeekPlan(index: number): WeekPlan {
  return {
    id: createId("semana"),
    nombre: `Semana ${index + 1}`,
    objetivo: "",
    dias: [createDefaultDayPlan(0)],
  };
}

function createDefaultClientTrainingPlan(cliente: ClienteView): WeekPersonPlan {
  const tipo = toPersonaTipo(cliente.tipo);
  return {
    ownerKey: buildPlanOwnerKey(tipo, cliente.nombre),
    tipo,
    nombre: cliente.nombre,
    categoria: cliente.categoria,
    semanas: [createDefaultWeekPlan(0)],
    historial: [],
  };
}

function normalizeWeekStore(rawValue: unknown): WeekStore {
  const store = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
  const rawPlanes = Array.isArray(store.planes) ? store.planes : [];
  const rawTemplates = Array.isArray(store.templates) ? store.templates : [];

  const planes: WeekPersonPlan[] = rawPlanes
    .filter((row) => row && typeof row === "object")
    .map((row, rowIndex) => {
      const item = row as Record<string, unknown>;
      const tipo: PersonaTipo = item.tipo === "jugadoras" ? "jugadoras" : "alumnos";
      const nombre = String(item.nombre || `Plan ${rowIndex + 1}`).trim() || `Plan ${rowIndex + 1}`;
      const ownerKey =
        String(item.ownerKey || buildPlanOwnerKey(tipo, nombre)).trim().toLowerCase() ||
        buildPlanOwnerKey(tipo, nombre);
      const semanasRaw = Array.isArray(item.semanas) ? item.semanas : [];

      const semanas: WeekPlan[] = semanasRaw
        .filter((week) => week && typeof week === "object")
        .map((week, weekIndex) => {
          const weekRow = week as Record<string, unknown>;
          const diasRaw = Array.isArray(weekRow.dias) ? weekRow.dias : [];

          const dias: WeekDayPlan[] = diasRaw
            .filter((day) => day && typeof day === "object")
            .map((day, dayIndex) => {
              const dayRow = day as Record<string, unknown>;
              return {
                id: String(dayRow.id || createId("dia")),
                dia: String(dayRow.dia || WEEK_DAY_NAMES[dayIndex] || `Dia ${dayIndex + 1}`),
                planificacion: String(dayRow.planificacion || "").trim(),
                objetivo: String(dayRow.objetivo || "").trim(),
                sesionId: String(dayRow.sesionId || "").trim(),
              };
            });

          return {
            id: String(weekRow.id || createId("semana")),
            nombre: String(weekRow.nombre || `Semana ${weekIndex + 1}`),
            objetivo: String(weekRow.objetivo || "").trim(),
            dias: dias.length > 0 ? dias : [createDefaultDayPlan(0)],
          };
        });

      return {
        ownerKey,
        tipo,
        nombre,
        categoria: String(item.categoria || "").trim() || undefined,
        semanas: semanas.length > 0 ? semanas : [createDefaultWeekPlan(0)],
        historial: Array.isArray(item.historial) ? item.historial : [],
      };
    });

  const templates: WeekPlanTemplate[] = rawTemplates
    .filter((row) => row && typeof row === "object")
    .map((row, rowIndex) => {
      const item = row as Record<string, unknown>;
      const tipo: PersonaTipo = item.tipo === "jugadoras" ? "jugadoras" : "alumnos";
      const nombre =
        String(item.nombre || `Template ${rowIndex + 1}`).trim() || `Template ${rowIndex + 1}`;
      const semanasRaw = Array.isArray(item.semanas) ? item.semanas : [];

      const semanas: WeekPlan[] = semanasRaw
        .filter((week) => week && typeof week === "object")
        .map((week, weekIndex) => {
          const weekRow = week as Record<string, unknown>;
          const diasRaw = Array.isArray(weekRow.dias) ? weekRow.dias : [];

          const dias: WeekDayPlan[] = diasRaw
            .filter((day) => day && typeof day === "object")
            .map((day, dayIndex) => {
              const dayRow = day as Record<string, unknown>;
              return {
                id: String(dayRow.id || createId("dia")),
                dia: String(dayRow.dia || WEEK_DAY_NAMES[dayIndex] || `Dia ${dayIndex + 1}`),
                planificacion: String(dayRow.planificacion || "").trim(),
                objetivo: String(dayRow.objetivo || "").trim(),
                sesionId: String(dayRow.sesionId || "").trim(),
              };
            });

          return {
            id: String(weekRow.id || createId("semana")),
            nombre: String(weekRow.nombre || `Semana ${weekIndex + 1}`),
            objetivo: String(weekRow.objetivo || "").trim(),
            dias: dias.length > 0 ? dias : [createDefaultDayPlan(0)],
          };
        });

      return {
        id: String(item.id || createId("template")),
        nombre,
        tipo,
        categoria: String(item.categoria || "").trim() || undefined,
        semanas: semanas.length > 0 ? semanas : [createDefaultWeekPlan(0)],
      };
    });

  return {
    version: 3,
    planes,
    templates,
  };
}

function safeDecodeParam(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePersonKey(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function templateCategoryKey(value: string | undefined): string {
  const normalized = String(value || "").trim();
  return normalized || "__sin_categoria__";
}

function templateCategoryLabel(value: string | undefined): string {
  return String(value || "").trim() || "Sin categoria";
}

function namesLikelyMatch(a: string, b: string): boolean {
  const left = normalizePersonKey(a);
  const right = normalizePersonKey(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  const shared = leftTokens.filter((token) => rightTokens.includes(token));

  return shared.length >= 2 || shared.some((token) => token.length >= 5);
}

function nutritionGoalLabel(goal: NutritionGoal): string {
  switch (goal) {
    case "mantenimiento":
      return "Mantenimiento";
    case "recomposicion":
      return "Recomposicion";
    case "masa":
      return "Masa muscular";
    case "deficit":
      return "Deficit";
    default:
      return goal;
  }
}

function buildPlanHref(clientId: string, tab: PlanViewTab): string {
  const params = new URLSearchParams();
  params.set("cliente", clientId);
  params.set("tab", tab);
  return `/clientes/plan?${params.toString()}`;
}

function ClientePlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawClientId = safeDecodeParam(searchParams.get("cliente"));
  const rawTab = safeDecodeParam(searchParams.get("tab"));
  const [tab, setTab] = useState<PlanViewTab>(
    rawTab === "plan-nutricional" ? "plan-nutricional" : "plan-entrenamiento"
  );
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");
  const [selectedAiPlanId, setSelectedAiPlanId] = useState("");
  const [templateSourceFilter, setTemplateSourceFilter] = useState<"todos" | "template" | "ia">("todos");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("todas");
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [editingTemplateName, setEditingTemplateName] = useState("");
  const [editingTemplateCategory, setEditingTemplateCategory] = useState("");
  const [assigningPlan, setAssigningPlan] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignmentError, setAssignmentError] = useState("");

  useEffect(() => {
    setTab(rawTab === "plan-nutricional" ? "plan-nutricional" : "plan-entrenamiento");
  }, [rawTab]);

  const { jugadoras } = usePlayers();
  const { alumnos } = useAlumnos();
  const { sesiones, agregarSesion, editarSesion } = useSessions();
  const { ejercicios, agregarEjercicio } = useEjercicios();
  const [nutritionPlans] = useSharedState<NutritionPlan[]>([], {
    key: NUTRITION_PLANS_KEY,
    legacyLocalStorageKey: NUTRITION_PLANS_KEY,
  });
  const [nutritionAssignments] = useSharedState<AlumnoNutritionAssignment[]>([], {
    key: NUTRITION_ASSIGNMENTS_KEY,
    legacyLocalStorageKey: NUTRITION_ASSIGNMENTS_KEY,
  });
  const [nutritionCustomFoods] = useSharedState<NutritionFood[]>([], {
    key: NUTRITION_CUSTOM_FOODS_KEY,
    legacyLocalStorageKey: NUTRITION_CUSTOM_FOODS_KEY,
  });
  const [weekStoreRaw, setWeekStoreRaw] = useSharedState<WeekStore>(
    {
      version: 3,
      planes: [],
      templates: [],
    },
    {
      key: WEEK_PLAN_KEY,
      legacyLocalStorageKey: WEEK_PLAN_KEY,
    }
  );
  const [aiTrainingPlansRaw] = useSharedState<StoredAITrainingPlan[]>([], {
    key: AI_TRAINING_PLANS_KEY,
    legacyLocalStorageKey: AI_TRAINING_PLANS_KEY,
  });

  const clientes = useMemo<ClienteView[]>(() => {
    const jugadorasMapped: ClienteView[] = jugadoras.map((jugadora) => ({
      id: `jugadora:${jugadora.nombre}`,
      tipo: "jugadora",
      nombre: jugadora.nombre,
      categoria: jugadora.categoria,
    }));

    const alumnosMapped: ClienteView[] = alumnos.map((alumno) => ({
      id: `alumno:${alumno.nombre}`,
      tipo: "alumno",
      nombre: alumno.nombre,
    }));

    return [...jugadorasMapped, ...alumnosMapped];
  }, [alumnos, jugadoras]);

  const selectedClient = useMemo(() => {
    const fromCollection = clientes.find((cliente) => cliente.id === rawClientId) || null;
    if (fromCollection) return fromCollection;

    const separatorIndex = rawClientId.indexOf(":");
    if (separatorIndex < 0) return null;

    const tipoRaw = rawClientId.slice(0, separatorIndex).trim().toLowerCase();
    const nombreRaw = rawClientId.slice(separatorIndex + 1).trim();
    if (!nombreRaw) return null;

    if (tipoRaw === "alumno") {
      return {
        id: rawClientId,
        tipo: "alumno" as const,
        nombre: nombreRaw,
      };
    }

    if (tipoRaw === "jugadora") {
      return {
        id: rawClientId,
        tipo: "jugadora" as const,
        nombre: nombreRaw,
      };
    }

    return null;
  }, [clientes, rawClientId]);

  const weekStore = useMemo(() => normalizeWeekStore(weekStoreRaw), [weekStoreRaw]);

  const aiTrainingPlans = useMemo(() => {
    const rows = Array.isArray(aiTrainingPlansRaw) ? aiTrainingPlansRaw : [];
    return rows
      .filter((item) => item && item.id && item.plan)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
  }, [aiTrainingPlansRaw]);

  const templatesAsignablesAlumnos = useMemo(
    () => weekStore.templates.filter((template) => template.tipo === "alumnos"),
    [weekStore.templates]
  );

  const templatesNoAsignablesAlumnos = useMemo(
    () => weekStore.templates.filter((template) => template.tipo !== "alumnos"),
    [weekStore.templates]
  );

  const templateCategoryOptions = useMemo(() => {
    const options = new Set<string>();

    for (const template of templatesAsignablesAlumnos) {
      options.add(templateCategoryKey(template.categoria));
    }

    for (const aiPlan of aiTrainingPlans) {
      options.add(templateCategoryKey(aiPlan.plan?.category));
    }

    return Array.from(options).sort((a, b) => {
      if (a === "__sin_categoria__") return 1;
      if (b === "__sin_categoria__") return -1;
      return a.localeCompare(b, "es");
    });
  }, [aiTrainingPlans, templatesAsignablesAlumnos]);

  useEffect(() => {
    if (templateCategoryFilter === "todas") return;
    if (!templateCategoryOptions.includes(templateCategoryFilter)) {
      setTemplateCategoryFilter("todas");
    }
  }, [templateCategoryFilter, templateCategoryOptions]);

  const templateLibraryItems = useMemo<TemplateLibraryItem[]>(() => {
    const query = normalizeText(templateSearchTerm);

    const templateItems: TemplateLibraryItem[] = templatesAsignablesAlumnos.map((template) => {
      const totalDias = (template.semanas || []).reduce(
        (acc, week) => acc + (week.dias || []).length,
        0
      );
      const diasConSesion = (template.semanas || []).reduce(
        (acc, week) =>
          acc + (week.dias || []).filter((day) => Boolean((day.sesionId || "").trim())).length,
        0
      );

      const searchText = normalizeText(
        `${template.nombre} ${template.categoria || ""} ${(template.semanas || [])
          .map((week) => week.nombre)
          .join(" ")}`
      );

      return {
        optionId: `template:${template.id}`,
        source: "template",
        nombre: template.nombre,
        categoria: template.categoria,
        totalSemanas: (template.semanas || []).length,
        totalDias,
        diasConSesion,
        searchText,
        template,
      };
    });

    const aiItems: TemplateLibraryItem[] = aiTrainingPlans.map((plan) => {
      const weeks = Array.isArray(plan.plan?.weeks) ? plan.plan.weeks : [];
      const totalDias = weeks.reduce((acc, week) => acc + (week.sessions || []).length, 0);

      const searchText = normalizeText(
        `${plan.nombre} ${plan.plan?.category || ""} ${plan.plan?.sport || ""} ${weeks
          .map((week) => `${week.focus || ""} ${week.rationale || ""}`)
          .join(" ")}`
      );

      return {
        optionId: `ai:${plan.id}`,
        source: "ia",
        nombre: plan.nombre,
        categoria: plan.plan?.category,
        deporte: plan.plan?.sport,
        totalSemanas: weeks.length,
        totalDias,
        diasConSesion: totalDias,
        searchText,
        aiPlan: plan,
      };
    });

    return [...templateItems, ...aiItems].filter((item) => {
      if (templateSourceFilter !== "todos" && item.source !== templateSourceFilter) {
        return false;
      }

      if (templateCategoryFilter !== "todas") {
        if (templateCategoryKey(item.categoria) !== templateCategoryFilter) {
          return false;
        }
      }

      if (!query) return true;

      return item.searchText.includes(query);
    });
  }, [
    aiTrainingPlans,
    templateCategoryFilter,
    templateSearchTerm,
    templateSourceFilter,
    templatesAsignablesAlumnos,
  ]);

  const selectedAiPlan = useMemo(
    () => {
      if (!selectedAiPlanId.startsWith("ai:")) return null;
      const rawId = selectedAiPlanId.slice(3);
      return aiTrainingPlans.find((item) => item.id === rawId) || null;
    },
    [aiTrainingPlans, selectedAiPlanId]
  );

  const selectedTemplate = useMemo(() => {
    if (!selectedAiPlanId.startsWith("template:")) return null;
    const rawId = selectedAiPlanId.slice("template:".length);
    return templatesAsignablesAlumnos.find((item) => item.id === rawId) || null;
  }, [selectedAiPlanId, templatesAsignablesAlumnos]);

  const normalizedExerciseMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of ejercicios) {
      map.set(normalizeText(item.nombre), item.id);
    }
    return map;
  }, [ejercicios]);

  const sesionesCliente = useMemo(() => {
    if (!selectedClient) return [];

    return sesiones.filter((sesion) => {
      if (selectedClient.tipo === "jugadora") {
        const porCategoria =
          sesion.asignacionTipo === "jugadoras" &&
          (sesion.categoriaAsignada || "") === (selectedClient.categoria || "");
        const porNombre =
          sesion.asignacionTipo === "jugadoras" &&
          (sesion.jugadoraAsignada || "") === selectedClient.nombre;
        return porCategoria || porNombre;
      }

      return (
        sesion.asignacionTipo === "alumnos" &&
        (sesion.alumnoAsignado || "") === selectedClient.nombre
      );
    });
  }, [selectedClient, sesiones]);

  const selectedTrainingPlan = useMemo(() => {
    if (!selectedClient) return null;

    const tipo = toPersonaTipo(selectedClient.tipo);
    const ownerKey = buildPlanOwnerKey(tipo, selectedClient.nombre);

    const exact = weekStore.planes.find((plan) => plan.ownerKey === ownerKey) || null;
    if (exact) {
      return exact;
    }

    return (
      weekStore.planes.find(
        (plan) =>
          plan.tipo === tipo &&
          (namesLikelyMatch(plan.nombre, selectedClient.nombre) ||
            namesLikelyMatch(plan.ownerKey.split(":")[1] || "", selectedClient.nombre))
      ) || null
    );
  }, [selectedClient, weekStore.planes]);

  const fallbackTrainingPlan = useMemo(() => {
    if (!selectedClient) return null;
    return createDefaultClientTrainingPlan(selectedClient);
  }, [selectedClient]);

  const editableTrainingPlan = selectedTrainingPlan || fallbackTrainingPlan;

  const selectedTrainingWeek = useMemo(
    () => editableTrainingPlan?.semanas.find((week) => week.id === selectedWeekId) || null,
    [editableTrainingPlan?.semanas, selectedWeekId]
  );

  const selectedTrainingDay = useMemo(
    () => selectedTrainingWeek?.dias.find((day) => day.id === selectedDayId) || null,
    [selectedDayId, selectedTrainingWeek]
  );

  const selectedTrainingSession = useMemo(() => {
    if (!selectedTrainingDay?.sesionId) return null;
    return sesiones.find((sesion) => sesion.id === selectedTrainingDay.sesionId) || null;
  }, [selectedTrainingDay?.sesionId, sesiones]);

  const exerciseNameById = useMemo(
    () => new Map(ejercicios.map((exercise) => [exercise.id, exercise.nombre])),
    [ejercicios]
  );

  const selectedTrainingBlocks = useMemo(
    () => selectedTrainingSession?.bloques || [],
    [selectedTrainingSession]
  );

  const selectedTrainingExerciseCount = useMemo(
    () => selectedTrainingBlocks.reduce((acc, block) => acc + (block.ejercicios || []).length, 0),
    [selectedTrainingBlocks]
  );

  const trainingPlanStats = useMemo(() => {
    const weeks = editableTrainingPlan?.semanas || [];
    const totalDias = weeks.reduce((acc, week) => acc + (week.dias || []).length, 0);
    const diasConObjetivo = weeks.reduce(
      (acc, week) =>
        acc +
        (week.dias || []).filter((day) => Boolean(String(day.objetivo || "").trim())).length,
      0
    );

    return {
      totalSemanas: weeks.length,
      totalDias,
      diasConObjetivo,
    };
  }, [editableTrainingPlan?.semanas]);

  const selectedWeekStats = useMemo(() => {
    if (!selectedTrainingWeek) {
      return {
        totalDias: 0,
        diasConObjetivo: 0,
      };
    }

    const days = selectedTrainingWeek.dias || [];
    return {
      totalDias: days.length,
      diasConObjetivo: days.filter((day) => Boolean(String(day.objetivo || "").trim())).length,
    };
  }, [selectedTrainingWeek]);

  const sesionesDisponiblesParaPlan = useMemo(
    () => (sesionesCliente.length > 0 ? sesionesCliente : sesiones),
    [sesiones, sesionesCliente]
  );

  useEffect(() => {
    const weeks = editableTrainingPlan?.semanas || [];
    if (weeks.length === 0) {
      setSelectedWeekId("");
      setSelectedDayId("");
      return;
    }

    if (!weeks.some((week) => week.id === selectedWeekId)) {
      setSelectedWeekId(weeks[0].id);
    }
  }, [editableTrainingPlan?.semanas, selectedWeekId]);

  useEffect(() => {
    if (!selectedTrainingWeek || selectedTrainingWeek.dias.length === 0) {
      setSelectedDayId("");
      return;
    }

    if (!selectedTrainingWeek.dias.some((day) => day.id === selectedDayId)) {
      setSelectedDayId(selectedTrainingWeek.dias[0].id);
    }
  }, [selectedDayId, selectedTrainingWeek]);

  useEffect(() => {
    if (templateLibraryItems.length === 0) {
      if (selectedAiPlanId) {
        setSelectedAiPlanId("");
      }
      return;
    }

    const exists = templateLibraryItems.some((item) => item.optionId === selectedAiPlanId);

    if (!exists) {
      setSelectedAiPlanId(templateLibraryItems[0].optionId);
    }
  }, [selectedAiPlanId, templateLibraryItems]);

  const nutritionFoodsById = useMemo(() => {
    const mergedFoods: NutritionFood[] = [
      ...(argentineFoodsBase as NutritionFood[]),
      ...nutritionCustomFoods,
    ];
    return new Map(mergedFoods.map((food) => [food.id, food]));
  }, [nutritionCustomFoods]);

  const selectedNutritionAssignment = useMemo(() => {
    if (!selectedClient) return null;
    const clientName = selectedClient.nombre;
    const clientIdName = selectedClient.id.split(":")[1] || "";
    const matches = nutritionAssignments.filter(
      (assignment) =>
        namesLikelyMatch(assignment.alumnoNombre, clientName) ||
        namesLikelyMatch(assignment.alumnoNombre, clientIdName)
    );

    if (matches.length === 0) return null;

    return matches
      .slice()
      .sort(
        (a, b) =>
          new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()
      )[0];
  }, [nutritionAssignments, selectedClient]);

  const selectedNutritionPlan = useMemo(() => {
    if (!selectedClient) return null;

    if (selectedNutritionAssignment) {
      const assigned =
        nutritionPlans.find((plan) => plan.id === selectedNutritionAssignment.planId) || null;
      if (assigned) {
        return assigned;
      }
    }

    const clientName = selectedClient.nombre;
    const clientIdName = selectedClient.id.split(":")[1] || "";

    return (
      nutritionPlans
        .filter(
          (plan) =>
            namesLikelyMatch(plan.alumnoAsignado || "", clientName) ||
            namesLikelyMatch(plan.alumnoAsignado || "", clientIdName)
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        )[0] || null
    );
  }, [nutritionPlans, selectedClient, selectedNutritionAssignment]);

  const selectedNutritionIntake = useMemo(() => {
    if (!selectedNutritionPlan) {
      return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
    }

    const totals = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };

    for (const meal of selectedNutritionPlan.comidas || []) {
      for (const item of meal.items || []) {
        const food = nutritionFoodsById.get(item.foodId);
        if (!food) continue;
        const ratio = Math.max(0, Number(item.gramos) || 0) / 100;
        totals.calorias += food.kcalPer100g * ratio;
        totals.proteinas += food.proteinPer100g * ratio;
        totals.carbohidratos += food.carbsPer100g * ratio;
        totals.grasas += food.fatPer100g * ratio;
      }
    }

    return {
      calorias: Math.round(totals.calorias * 10) / 10,
      proteinas: Math.round(totals.proteinas * 10) / 10,
      carbohidratos: Math.round(totals.carbohidratos * 10) / 10,
      grasas: Math.round(totals.grasas * 10) / 10,
    };
  }, [nutritionFoodsById, selectedNutritionPlan]);

  const backHref = selectedClient
    ? `/clientes/ficha/${encodeURIComponent(selectedClient.id)}/datos`
    : "/clientes";

  useEffect(() => {
    router.prefetch(backHref);
  }, [backHref, router]);

  const switchPlanTab = (nextTab: PlanViewTab) => {
    if (!selectedClient) return;
    setTab(nextTab);

    if (typeof window === "undefined") return;
    const nextHref = buildPlanHref(selectedClient.id, nextTab);
    const nextUrl = new URL(nextHref, window.location.origin);
    const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next !== current) {
      window.history.pushState({}, "", next);
    }
  };

  const ensureExerciseId = (exerciseName: string): string => {
    const normalized = normalizeText(exerciseName);
    const existingId = normalizedExerciseMap.get(normalized);
    if (existingId) return existingId;

    const createdId = agregarEjercicio({
      nombre: exerciseName,
      categoria: guessExerciseCategory(exerciseName),
      descripcion: "Ejercicio generado desde asignacion de plan IA",
      objetivo: "Transferir el objetivo semanal definido por IA",
      videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} ejercicio`)}`,
    });

    normalizedExerciseMap.set(normalized, createdId);
    return createdId;
  };

  const upsertAiSessionForClient = (
    session: TrainingPlanSession,
    weekNumber: number,
    sourcePlan: TrainingPlan,
    sourcePlanRecord: StoredAITrainingPlan,
    client: ClienteView
  ): { sessionId: string; created: boolean } => {
    const sessionTitle = `${session.title} · W${weekNumber}`;
    const sessionTeamLabel = `IA · ${sourcePlanRecord.nombre}`;
    const assignedType: "jugadoras" | "alumnos" =
      client.tipo === "jugadora" ? "jugadoras" : "alumnos";

    const sharedPayload = {
      titulo: sessionTitle,
      objetivo: session.goal,
      duracion: `${sourcePlan.sessionDurationMin}`,
      equipo: sessionTeamLabel,
      asignacionTipo: assignedType,
      categoriaAsignada: client.tipo === "jugadora" ? client.categoria || "" : undefined,
      jugadoraAsignada: client.tipo === "jugadora" ? client.nombre : undefined,
      alumnoAsignado: client.tipo === "alumno" ? client.nombre : undefined,
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
    };

    const existingSession = sesiones.find((item) => {
      if (item.titulo !== sessionTitle) return false;
      if ((item.equipo || "") !== sessionTeamLabel) return false;

      if (client.tipo === "jugadora") {
        return (
          item.asignacionTipo === "jugadoras" &&
          namesLikelyMatch(item.jugadoraAsignada || "", client.nombre)
        );
      }

      return (
        item.asignacionTipo === "alumnos" &&
        namesLikelyMatch(item.alumnoAsignado || "", client.nombre)
      );
    });

    if (existingSession) {
      editarSesion(existingSession.id, sharedPayload);
      return {
        sessionId: existingSession.id,
        created: false,
      };
    }

    return {
      sessionId: agregarSesion(sharedPayload),
      created: true,
    };
  };

  const cloneTemplateSessionBlocks = (blocks: Sesion["bloques"]) =>
    (blocks || []).map((block, blockIndex) => ({
      id: `template-block-${block.id || blockIndex}-${createId("bloque")}`,
      titulo: block.titulo,
      objetivo: block.objetivo,
      ejercicios: (block.ejercicios || []).map((exercise) => ({
        ...exercise,
      })),
    }));

  const upsertTemplateSessionForClient = (
    sourceSession: Sesion,
    sourceTemplate: WeekPlanTemplate,
    client: ClienteView
  ): { sessionId: string; created: boolean } => {
    const sessionTeamLabel = `Template · ${sourceTemplate.nombre}`;
    const assignedType: "jugadoras" | "alumnos" =
      client.tipo === "jugadora" ? "jugadoras" : "alumnos";

    const sharedPayload = {
      titulo: sourceSession.titulo || "Sesion template",
      objetivo: sourceSession.objetivo || "",
      duracion: String(sourceSession.duracion || ""),
      equipo: sessionTeamLabel,
      asignacionTipo: assignedType,
      categoriaAsignada: client.tipo === "jugadora" ? client.categoria || "" : undefined,
      jugadoraAsignada: client.tipo === "jugadora" ? client.nombre : undefined,
      alumnoAsignado: client.tipo === "alumno" ? client.nombre : undefined,
      bloques: cloneTemplateSessionBlocks(sourceSession.bloques),
      prescripciones: [],
    };

    const existingSession = sesiones.find((item) => {
      if ((item.equipo || "") !== sessionTeamLabel) return false;
      if (!namesLikelyMatch(item.titulo || "", sourceSession.titulo || "")) return false;

      if (client.tipo === "jugadora") {
        return (
          item.asignacionTipo === "jugadoras" &&
          namesLikelyMatch(item.jugadoraAsignada || "", client.nombre)
        );
      }

      return (
        item.asignacionTipo === "alumnos" &&
        namesLikelyMatch(item.alumnoAsignado || "", client.nombre)
      );
    });

    if (existingSession) {
      editarSesion(existingSession.id, sharedPayload);
      return {
        sessionId: existingSession.id,
        created: false,
      };
    }

    return {
      sessionId: agregarSesion(sharedPayload),
      created: true,
    };
  };

  const openTemplateEdit = (template: WeekPlanTemplate) => {
    setEditingTemplateId(template.id);
    setEditingTemplateName(template.nombre);
    setEditingTemplateCategory(String(template.categoria || ""));
    setAssignmentError("");
    setAssignmentMessage("");
  };

  const cancelTemplateEdit = () => {
    setEditingTemplateId("");
    setEditingTemplateName("");
    setEditingTemplateCategory("");
  };

  const saveTemplateEdit = () => {
    const templateId = editingTemplateId;
    const nextName = String(editingTemplateName || "").trim();
    if (!templateId) return;

    if (!nextName) {
      setAssignmentError("El nombre del template no puede estar vacio.");
      return;
    }

    markManualSaveIntent(WEEK_PLAN_KEY);
    setWeekStoreRaw((prev) => {
      const base = normalizeWeekStore(prev);
      return {
        ...base,
        version: 3,
        templates: base.templates.map((template) =>
          template.id === templateId
            ? {
                ...template,
                nombre: nextName,
                categoria: String(editingTemplateCategory || "").trim() || undefined,
              }
            : template
        ),
      };
    });

    setAssignmentError("");
    setAssignmentMessage("Template actualizado correctamente.");
    cancelTemplateEdit();
  };

  const duplicateTemplateForAlumnos = (template: WeekPlanTemplate) => {
    const duplicated: WeekPlanTemplate = {
      ...template,
      id: createId("template"),
      nombre: `${template.nombre} copia`,
      tipo: "alumnos",
      semanas: (template.semanas || []).map((week, weekIndex) => ({
        ...week,
        id: createId("semana"),
        nombre: String(week.nombre || `Semana ${weekIndex + 1}`),
        dias: (week.dias || []).map((day, dayIndex) => ({
          ...day,
          id: createId("dia"),
          dia: String(day.dia || WEEK_DAY_NAMES[dayIndex] || `Dia ${dayIndex + 1}`),
        })),
      })),
    };

    markManualSaveIntent(WEEK_PLAN_KEY);
    setWeekStoreRaw((prev) => {
      const base = normalizeWeekStore(prev);
      return {
        ...base,
        version: 3,
        templates: [duplicated, ...base.templates],
      };
    });

    setSelectedAiPlanId(`template:${duplicated.id}`);
    setAssignmentError("");
    setAssignmentMessage(`Template ${duplicated.nombre} listo para asignar a alumnos.`);
  };

  const removeTemplate = (templateId: string) => {
    const target = weekStore.templates.find((template) => template.id === templateId);
    if (!target) return;

    if (!window.confirm(`Eliminar template ${target.nombre}?`)) {
      return;
    }

    markManualSaveIntent(WEEK_PLAN_KEY);
    setWeekStoreRaw((prev) => {
      const base = normalizeWeekStore(prev);
      return {
        ...base,
        version: 3,
        templates: base.templates.filter((template) => template.id !== templateId),
      };
    });

    if (selectedAiPlanId === `template:${templateId}`) {
      setSelectedAiPlanId("");
    }
    if (editingTemplateId === templateId) {
      cancelTemplateEdit();
    }

    setAssignmentError("");
    setAssignmentMessage("Template eliminado correctamente.");
  };

  const assignSelectedAiPlanToClient = () => {
    if (!selectedClient) {
      setAssignmentError("Selecciona un cliente para asignar entrenamiento.");
      return;
    }

    if (selectedClient.tipo !== "alumno") {
      setAssignmentError("La asignacion de templates se habilita solo desde la ficha de alumno.");
      return;
    }

    if (!selectedAiPlan && !selectedTemplate) {
      setAssignmentError("Selecciona un template para asignar.");
      return;
    }

    const targetClient = selectedClient;

    setAssigningPlan(true);
    setAssignmentError("");
    setAssignmentMessage("");

    try {
      if (selectedAiPlan) {
        const sourcePlan = selectedAiPlan.plan;
        let createdSessions = 0;
        let updatedSessions = 0;

        const nextWeeks: WeekPlan[] = sourcePlan.weeks.map((week) => {
          const orderedSessions = [...(week.sessions || [])].sort(
            (a, b) => a.sessionNumber - b.sessionNumber
          );

          const days: WeekDayPlan[] = orderedSessions.map((session, sessionIndex) => {
            const sessionResult = upsertAiSessionForClient(
              session,
              week.weekNumber,
              sourcePlan,
              selectedAiPlan,
              targetClient
            );

            if (sessionResult.created) {
              createdSessions += 1;
            } else {
              updatedSessions += 1;
            }

            return {
              id: createId("dia"),
              dia: getDayLabelFromIsoDate(session.date, sessionIndex),
              planificacion: session.title,
              objetivo: session.goal,
              sesionId: sessionResult.sessionId,
            };
          });

          return {
            id: createId("semana"),
            nombre: `Semana ${week.weekNumber}`,
            objetivo: [week.focus, week.rationale].filter(Boolean).join(" · "),
            dias: days.length > 0 ? days : [createDefaultDayPlan(0)],
          };
        });

        upsertClientTrainingPlan(
          (currentPlan) => ({
            ...currentPlan,
            semanas: nextWeeks.length > 0 ? nextWeeks : [createDefaultWeekPlan(0)],
          }),
          targetClient
        );

        if (nextWeeks.length > 0 && targetClient.id === selectedClient.id) {
          setSelectedWeekId(nextWeeks[0].id);
          setSelectedDayId(nextWeeks[0].dias[0]?.id || "");
        }

        setAssignmentMessage(
          `Template IA ${selectedAiPlan.nombre} asignado a ${targetClient.nombre}. Sesiones nuevas: ${createdSessions}. Sesiones actualizadas: ${updatedSessions}.`
        );
      } else if (selectedTemplate) {
        let createdSessions = 0;
        let updatedSessions = 0;
        let missingLinkedSessions = 0;
        const linkedSessionByTemplateSessionId = new Map<string, string>();

        const nextWeeks: WeekPlan[] = selectedTemplate.semanas.map((week, weekIndex) => {
          const days: WeekDayPlan[] = (week.dias || []).map((day, dayIndex) => {
            const sourceSessionId = String(day.sesionId || "").trim();
            let linkedSessionId = "";
            const sourceSession = sourceSessionId
              ? sesiones.find((item) => item.id === sourceSessionId) || null
              : null;
            const planningFallback = String(day.planificacion || "").trim();
            const planningText = planningFallback || sourceSession?.titulo || "";

            if (sourceSessionId) {
              const cachedSessionId = linkedSessionByTemplateSessionId.get(sourceSessionId);
              if (cachedSessionId) {
                linkedSessionId = cachedSessionId;
              } else {
                if (sourceSession) {
                  const result = upsertTemplateSessionForClient(
                    sourceSession,
                    selectedTemplate,
                    targetClient
                  );
                  linkedSessionId = result.sessionId;
                  linkedSessionByTemplateSessionId.set(sourceSessionId, linkedSessionId);

                  if (result.created) {
                    createdSessions += 1;
                  } else {
                    updatedSessions += 1;
                  }
                } else {
                  missingLinkedSessions += 1;
                }
              }
            }

            return {
              id: createId("dia"),
              dia: String(day.dia || WEEK_DAY_NAMES[dayIndex] || `Dia ${dayIndex + 1}`),
              planificacion: planningText,
              objetivo: String(day.objetivo || "").trim(),
              sesionId: linkedSessionId,
            };
          });

          return {
            id: createId("semana"),
            nombre: String(week.nombre || `Semana ${weekIndex + 1}`),
            objetivo: String(week.objetivo || "").trim(),
            dias: days.length > 0 ? days : [createDefaultDayPlan(0)],
          };
        });

        upsertClientTrainingPlan(
          (currentPlan) => ({
            ...currentPlan,
            semanas: nextWeeks.length > 0 ? nextWeeks : [createDefaultWeekPlan(0)],
          }),
          targetClient
        );

        if (nextWeeks.length > 0 && targetClient.id === selectedClient.id) {
          setSelectedWeekId(nextWeeks[0].id);
          setSelectedDayId(nextWeeks[0].dias[0]?.id || "");
        }

        const missingCopy =
          missingLinkedSessions > 0
            ? ` Links sin sesion encontrada: ${missingLinkedSessions}.`
            : "";
        setAssignmentMessage(
          `Template ${selectedTemplate.nombre} asignado a ${targetClient.nombre}. Sesiones nuevas: ${createdSessions}. Sesiones actualizadas: ${updatedSessions}.${missingCopy}`
        );
      }
    } catch (assignError) {
      setAssignmentError(
        assignError instanceof Error
          ? assignError.message
          : "No se pudo asignar el entrenamiento al cliente."
      );
    } finally {
      setAssigningPlan(false);
    }
  };

  const upsertClientTrainingPlan = (
    updater: (current: WeekPersonPlan) => WeekPersonPlan,
    clientOverride?: ClienteView
  ) => {
    const targetClient = clientOverride || selectedClient;
    if (!targetClient) return;

    markManualSaveIntent(WEEK_PLAN_KEY);

    const selectedTipo = toPersonaTipo(targetClient.tipo);
    const selectedOwnerKey = buildPlanOwnerKey(selectedTipo, targetClient.nombre);

    setWeekStoreRaw((prev) => {
      const base = normalizeWeekStore(prev);
      const planes = [...base.planes];

      const existingIndex = planes.findIndex(
        (plan) =>
          plan.ownerKey === selectedOwnerKey ||
          (plan.tipo === selectedTipo && namesLikelyMatch(plan.nombre, targetClient.nombre))
      );

      const currentPlan =
        existingIndex >= 0 ? planes[existingIndex] : createDefaultClientTrainingPlan(targetClient);

      const nextPlanRaw = updater({
        ...currentPlan,
        ownerKey: selectedOwnerKey,
        tipo: selectedTipo,
        nombre: targetClient.nombre,
        categoria: targetClient.categoria,
        semanas:
          Array.isArray(currentPlan.semanas) && currentPlan.semanas.length > 0
            ? currentPlan.semanas
            : [createDefaultWeekPlan(0)],
      });

      const nextPlan: WeekPersonPlan = {
        ...nextPlanRaw,
        ownerKey: selectedOwnerKey,
        tipo: selectedTipo,
        nombre: targetClient.nombre,
        categoria: targetClient.categoria,
        semanas:
          Array.isArray(nextPlanRaw.semanas) && nextPlanRaw.semanas.length > 0
            ? nextPlanRaw.semanas
            : [createDefaultWeekPlan(0)],
      };

      if (existingIndex >= 0) {
        planes[existingIndex] = nextPlan;
      } else {
        planes.push(nextPlan);
      }

      return {
        ...base,
        version: 3,
        planes,
      };
    });
  };

  const updateWeekField = (weekId: string, field: "nombre" | "objetivo", value: string) => {
    upsertClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) =>
        week.id === weekId
          ? {
              ...week,
              [field]: value,
            }
          : week
      ),
    }));
  };

  const updateDayField = (
    weekId: string,
    dayId: string,
    field: "dia" | "planificacion" | "objetivo" | "sesionId",
    value: string
  ) => {
    upsertClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;

        return {
          ...week,
          dias: week.dias.map((day) =>
            day.id === dayId
              ? {
                  ...day,
                  [field]: value,
                }
              : day
          ),
        };
      }),
    }));
  };

  const linkSessionToDay = (weekId: string, dayId: string, sessionId: string) => {
    const linkedSession = sesionesDisponiblesParaPlan.find((session) => session.id === sessionId) || null;

    upsertClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;

        return {
          ...week,
          dias: week.dias.map((day) => {
            if (day.id !== dayId) return day;

            if (!sessionId || !linkedSession) {
              return {
                ...day,
                sesionId: "",
              };
            }

            return {
              ...day,
              sesionId: linkedSession.id,
              planificacion: linkedSession.titulo || day.planificacion,
              objetivo: linkedSession.objetivo || day.objetivo || "",
            };
          }),
        };
      }),
    }));
  };

  const addWeekToPlan = () => {
    upsertClientTrainingPlan((plan) => {
      const nextWeek = createDefaultWeekPlan(plan.semanas.length);
      return {
        ...plan,
        semanas: [...plan.semanas, nextWeek],
      };
    });
  };

  const removeWeekFromPlan = (weekId: string) => {
    upsertClientTrainingPlan((plan) => {
      const remaining = plan.semanas.filter((week) => week.id !== weekId);
      return {
        ...plan,
        semanas: remaining.length > 0 ? remaining : [createDefaultWeekPlan(0)],
      };
    });
  };

  const addDayToWeek = (weekId: string) => {
    upsertClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;
        const nextIndex = week.dias.length;
        return {
          ...week,
          dias: [...week.dias, createDefaultDayPlan(nextIndex)],
        };
      }),
    }));
  };

  const removeDayFromWeek = (weekId: string, dayId: string) => {
    upsertClientTrainingPlan((plan) => ({
      ...plan,
      semanas: plan.semanas.map((week) => {
        if (week.id !== weekId) return week;
        const remainingDays = week.dias.filter((day) => day.id !== dayId);
        return {
          ...week,
          dias: remainingDays.length > 0 ? remainingDays : [createDefaultDayPlan(0)],
        };
      }),
    }));
  };

  if (!selectedClient) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-slate-100">
        <section className="rounded-3xl border border-amber-300/30 bg-amber-500/10 p-6">
          <h1 className="text-2xl font-black text-white">Plan del cliente</h1>
          <p className="mt-2 text-sm text-amber-100">
            No se encontro el cliente solicitado o faltan parametros de navegacion.
          </p>
          <Link
            href="/clientes"
            prefetch
            className="mt-4 inline-flex rounded-xl border border-amber-200/40 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/10"
          >
            Volver a Clientes
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6 text-slate-100">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-900 via-cyan-950/45 to-slate-900 p-6 shadow-[0_20px_70px_rgba(6,182,212,0.12)]">
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-8 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/80">Vista dedicada</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Plan de {selectedClient.nombre}</h1>
            <p className="mt-2 text-sm text-slate-200/90">
              Esta pantalla muestra el plan sin mezclarlo con la ficha general del cliente.
            </p>
          </div>
          <Link
            href={backHref}
            prefetch
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Volver a ficha
          </Link>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2">
          <ReliableActionButton
            type="button"
            onClick={() => switchPlanTab("plan-entrenamiento")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              tab === "plan-entrenamiento"
                ? "border-cyan-200/55 bg-cyan-300 text-slate-950"
                : "border-white/20 bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Plan entrenamiento
          </ReliableActionButton>
          <ReliableActionButton
            type="button"
            onClick={() => switchPlanTab("plan-nutricional")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              tab === "plan-nutricional"
                ? "border-cyan-200/55 bg-cyan-300 text-slate-950"
                : "border-white/20 bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Plan nutricional
          </ReliableActionButton>
        </div>
      </section>

      {tab === "plan-entrenamiento" ? (
        <section className="rounded-3xl border-2 border-cyan-300/30 bg-slate-900/75 p-5 shadow-[0_18px_48px_-28px_rgba(6,182,212,0.42)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-white">Plan de entrenamiento editable</h2>
              <p className="mt-1 text-sm text-slate-300">
                Edicion tipo template: semanas, dias, planificacion y objetivos en un flujo limpio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/semana"
                prefetch
                className="rounded-lg border border-cyan-300/35 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
              >
                Abrir Templates
              </Link>
              <ReliableActionButton
                type="button"
                onClick={addWeekToPlan}
                className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15"
              >
                Agregar semana
              </ReliableActionButton>
            </div>
          </div>

          <section className="mb-4 rounded-2xl border border-cyan-300/25 bg-cyan-500/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">Modo template</p>
                <h3 className="mt-1 text-lg font-black text-white">Edicion directa del template</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Vista simplificada para trabajar solo estructura semanal, dias, planificacion y objetivos.
                </p>
              </div>
              <Link
                href="/semana"
                prefetch
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
              >
                Ir a Templates
              </Link>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-cyan-300/25 bg-cyan-500/[0.06] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">Entrenamiento</p>
                    <p className="mt-1 text-sm text-slate-200/90">
                      Estructura visual alineada con Templates para editar semana y dia en el mismo flujo.
                    </p>
                  </div>
                  <ReliableActionButton
                    type="button"
                    onClick={addWeekToPlan}
                    className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
                  >
                    Agregar semana
                  </ReliableActionButton>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-900/45 p-3 text-xs text-slate-200">
                    Semanas: <span className="font-semibold text-white">{trainingPlanStats.totalSemanas}</span>
                  </div>
                  <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                    Dias: <span className="font-semibold">{trainingPlanStats.totalDias}</span>
                  </div>
                  <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                    Dias con objetivo: <span className="font-semibold">{trainingPlanStats.diasConObjetivo}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(editableTrainingPlan?.semanas || []).map((week) => (
                    <ReliableActionButton
                      key={week.id}
                      type="button"
                      onClick={() => setSelectedWeekId(week.id)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        selectedWeekId === week.id
                          ? "border-cyan-200/70 bg-cyan-400/15 text-cyan-50"
                          : "border-white/15 bg-slate-950/45 text-slate-100 hover:border-cyan-300/40"
                      }`}
                    >
                      {week.nombre || "Semana"}
                    </ReliableActionButton>
                  ))}
                </div>
              </section>

              {selectedTrainingWeek ? (
                <section className="space-y-4 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/[0.06] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-fuchsia-100/85">Semana seleccionada</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-white/20 bg-slate-900/50 px-2 py-0.5 text-slate-200">
                          {selectedWeekStats.totalDias} dias
                        </span>
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-cyan-100">
                          {selectedWeekStats.diasConObjetivo} con objetivo
                        </span>
                      </div>
                    </div>
                    <ReliableActionButton
                      type="button"
                      onClick={() => removeWeekFromPlan(selectedTrainingWeek.id)}
                      disabled={(editableTrainingPlan?.semanas.length || 0) <= 1}
                      className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      Eliminar semana
                    </ReliableActionButton>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-slate-300">Nombre semana</span>
                      <input
                        value={selectedTrainingWeek.nombre}
                        onChange={(event) =>
                          updateWeekField(selectedTrainingWeek.id, "nombre", event.target.value)
                        }
                        className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white"
                        placeholder="Semana 1"
                      />
                    </label>
                    <label className="space-y-1 md:col-span-1">
                      <span className="text-xs uppercase tracking-wide text-slate-300">Objetivo semanal</span>
                      <textarea
                        value={selectedTrainingWeek.objetivo || ""}
                        onChange={(event) =>
                          updateWeekField(selectedTrainingWeek.id, "objetivo", event.target.value)
                        }
                        className="min-h-[84px] w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white"
                        placeholder="Objetivo de la semana"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-fuchsia-300/20 bg-slate-900/55 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-white">Dias del template</p>
                      <ReliableActionButton
                        type="button"
                        onClick={() => addDayToWeek(selectedTrainingWeek.id)}
                        className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                      >
                        Agregar dia
                      </ReliableActionButton>
                    </div>

                    <div className="space-y-3">
                      {selectedTrainingWeek.dias.map((day) => (
                        <article
                          key={day.id}
                          className={`rounded-xl border p-3 transition ${
                            selectedDayId === day.id
                              ? "border-cyan-200/70 bg-cyan-500/10"
                              : "border-white/10 bg-slate-950/40 hover:border-cyan-300/35"
                          }`}
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <ReliableActionButton
                              type="button"
                              onClick={() => setSelectedDayId(day.id)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                                selectedDayId === day.id
                                  ? "border-cyan-200/70 bg-cyan-300 text-slate-950"
                                  : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                              }`}
                            >
                              {day.dia || "Dia"}
                            </ReliableActionButton>
                            <ReliableActionButton
                              type="button"
                              onClick={() => removeDayFromWeek(selectedTrainingWeek.id, day.id)}
                              disabled={selectedTrainingWeek.dias.length <= 1}
                              className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-40"
                            >
                              Eliminar dia
                            </ReliableActionButton>
                          </div>

                          <div className="grid gap-2 md:grid-cols-1">
                            <label className="space-y-1">
                              <span className="text-[11px] uppercase tracking-wide text-slate-300">Dia</span>
                              <input
                                value={day.dia}
                                onChange={(event) =>
                                  updateDayField(selectedTrainingWeek.id, day.id, "dia", event.target.value)
                                }
                                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-2.5 py-2 text-sm text-white"
                                placeholder="Lunes"
                              />
                            </label>
                            <label className="space-y-1 md:col-span-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-300">Planificacion</span>
                              <textarea
                                value={day.planificacion || ""}
                                onChange={(event) =>
                                  updateDayField(
                                    selectedTrainingWeek.id,
                                    day.id,
                                    "planificacion",
                                    event.target.value
                                  )
                                }
                                className="min-h-[72px] w-full rounded-lg border border-white/15 bg-slate-900/70 px-2.5 py-2 text-sm text-white"
                                placeholder="Descripcion del entrenamiento del dia"
                              />
                            </label>
                            <label className="space-y-1 md:col-span-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-300">Objetivo del dia</span>
                              <input
                                value={day.objetivo || ""}
                                onChange={(event) =>
                                  updateDayField(
                                    selectedTrainingWeek.id,
                                    day.id,
                                    "objetivo",
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-2.5 py-2 text-sm text-white"
                                placeholder="Objetivo especifico del dia"
                              />
                            </label>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/[0.05] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">Resumen del dia</p>
                    {!selectedTrainingDay ? (
                      <p className="mt-2 rounded-lg border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-300">
                        Selecciona un dia para ver su resumen.
                      </p>
                    ) : (
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg border border-white/12 bg-slate-950/45 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">Planificacion</p>
                          <p className="mt-1 text-sm text-slate-100">
                            {selectedTrainingDay.planificacion || "Sin planificacion cargada."}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/12 bg-slate-950/45 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">Objetivo del dia</p>
                          <p className="mt-1 text-sm text-slate-100">
                            {selectedTrainingDay.objetivo || "Sin objetivo cargado."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                  Crea o selecciona una semana para comenzar a editar la planificacion.
                </p>
              )}
            </div>

            <aside className="rounded-2xl border border-cyan-300/25 bg-cyan-500/[0.06] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/85">Vista alumno</p>
              <h3 className="mt-1 text-xl font-black text-white">Semana y dia actual</h3>
              <p className="mt-1 text-sm text-slate-300">
                Lo que edites aqui se refleja igual en la seccion Rutina del alumno.
              </p>

              {selectedTrainingWeek && selectedTrainingDay ? (
                <div className="mt-3 space-y-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-lg font-black text-white">{selectedTrainingWeek.nombre}</p>
                    <span className="rounded-lg border border-white/20 bg-white/5 px-2 py-0.5 text-xs text-slate-100">
                      {selectedTrainingDay.dia}
                    </span>
                  </div>
                  {selectedTrainingWeek.objetivo ? (
                    <p className="text-sm text-cyan-100">Objetivo semanal: {selectedTrainingWeek.objetivo}</p>
                  ) : null}
                  <p className="text-sm text-slate-100">
                    {selectedTrainingDay.planificacion || "Sin planificacion"}
                  </p>
                  {selectedTrainingDay.objetivo ? (
                    <p className="text-xs text-fuchsia-100/90">Objetivo del dia: {selectedTrainingDay.objetivo}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-300">
                  Sin semana o dia seleccionado.
                </p>
              )}
            </aside>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
          <h2 className="text-xl font-black text-white">Plan nutricional</h2>
          {selectedNutritionPlan ? (
            <>
              <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-100">Plan asignado</p>
                    <p className="text-lg font-black text-white">{selectedNutritionPlan.nombre}</p>
                  </div>
                  <p className="text-xs text-slate-300">
                    Asignado: {new Date(selectedNutritionAssignment?.assignedAt || selectedNutritionPlan.updatedAt).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">Objetivo</p>
                    <p className="font-bold text-cyan-100">{nutritionGoalLabel(selectedNutritionPlan.objetivo)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">Kcal objetivo</p>
                    <p className="font-bold text-white">{selectedNutritionPlan.targets.calorias}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">P/C/G objetivo</p>
                    <p className="font-bold text-white">
                      {selectedNutritionPlan.targets.proteinas} / {selectedNutritionPlan.targets.carbohidratos} / {selectedNutritionPlan.targets.grasas} g
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">P/C/G del plan</p>
                    <p className="font-bold text-emerald-100">
                      {selectedNutritionIntake.proteinas} / {selectedNutritionIntake.carbohidratos} / {selectedNutritionIntake.grasas} g
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {selectedNutritionPlan.comidas.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                    El plan no tiene comidas cargadas todavia.
                  </p>
                ) : (
                  selectedNutritionPlan.comidas.map((meal) => (
                    <article key={meal.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="font-semibold text-white">{meal.nombre}</p>
                      {meal.items.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-400">Sin alimentos cargados.</p>
                      ) : (
                        <div className="mt-2 space-y-1 text-sm">
                          {meal.items.map((item) => {
                            const food = nutritionFoodsById.get(item.foodId);
                            return (
                              <p key={item.id} className="text-slate-200">
                                • {food?.nombre || "Alimento no encontrado"} - {item.gramos} g
                              </p>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold">Este cliente aun no tiene un plan nutricional asignado.</p>
              <p className="mt-1 text-amber-50/90">
                Puedes asignarlo desde el modulo de nutricion para verlo aqui.
              </p>
              <Link
                href="/categorias/Nutricion"
                prefetch
                className="mt-3 inline-flex rounded-lg border border-amber-200/40 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/10"
              >
                Ir a Nutricion
              </Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default function ClientePlanPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl p-6 text-slate-100">
          <section className="rounded-3xl border border-cyan-200/20 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-300">Cargando plan del cliente...</p>
          </section>
        </main>
      }
    >
      <ClientePlanContent />
    </Suspense>
  );
}
