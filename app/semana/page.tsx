"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAlumnos } from "../../components/AlumnosProvider";
import { useEjercicios } from "../../components/EjerciciosProvider";
import { usePlayers } from "../../components/PlayersProvider";
import { useSessions } from "../../components/SessionsProvider";
import { markManualSaveIntent, useSharedState } from "../../components/useSharedState";
import { semana as semanaInicial, type Sesion } from "../../data/mockData";

type LegacySemanaItem = {
  dia: string;
  sesion: string;
};

type TemplateExerciseSpec = {
  id: string;
  nombre: string;
  valor: string;
};

type TemplateSetDraft = {
  id: string;
  serie: number;
  repeticiones: string;
  cargaKg: string;
  rir: string;
  descanso: string;
  observaciones: string;
};

type TemplateSuperSerieDraft = {
  id: string;
  ejercicioId: string;
  series: string;
  repeticiones: string;
  descanso: string;
  carga: string;
};

type TemplateExerciseDraft = {
  id: string;
  ejercicioId: string;
  series: string;
  repeticiones: string;
  descanso: string;
  carga: string;
  especificaciones: TemplateExerciseSpec[];
  serieDesglose: TemplateSetDraft[];
  superSerie: TemplateSuperSerieDraft[];
};

type TemplateBlockDraft = {
  id: string;
  titulo: string;
  objetivo: string;
  ejercicios: TemplateExerciseDraft[];
};

type TemplateDayTraining = {
  titulo: string;
  descripcion: string;
  duracion: string;
  bloques: TemplateBlockDraft[];
};

type DiaPlan = {
  id: string;
  dia: string;
  planificacion: string;
  objetivo?: string;
  sesionId?: string;
  entrenamiento?: TemplateDayTraining;
};

type SemanaPlan = {
  id: string;
  nombre: string;
  objetivo: string;
  dias: DiaPlan[];
};

type PersonaTipo = "jugadoras" | "alumnos";

type PersonaItem = {
  tipo: PersonaTipo;
  nombre: string;
  categoria?: string;
};

type PlanPorPersona = {
  ownerKey: string;
  tipo: PersonaTipo;
  nombre: string;
  categoria?: string;
  semanas: SemanaPlan[];
  historial?: PlanHistoryItem[];
};

type PlanHistoryItem = {
  id: string;
  createdAt: string;
  etiqueta?: string;
  semanas: SemanaPlan[];
};

type PlanTemplate = {
  id: string;
  nombre: string;
  tipo: PersonaTipo;
  categoria?: string;
  descripcion?: string;
  etiquetas?: string[];
  feedbackQuestions?: string[];
  createdAt?: string;
  updatedAt?: string;
  semanas: SemanaPlan[];
};

type SemanaStoreV2 = {
  version: 2;
  planes: PlanPorPersona[];
};

type SemanaStoreV3 = {
  version: 3;
  planes: PlanPorPersona[];
  templates: PlanTemplate[];
};

type ToastKind = "success" | "warning" | "error";

type SuggestionAction = {
  id: "fill-free-day" | "diversify-session" | "add-recovery-day";
  title: string;
  detail: string;
};

type AlumnoWeekNotification = {
  id: string;
  ownerKey: string;
  alumnoNombre: string;
  createdAt: string;
  summary: string;
  totalSemanas: number;
  totalDias: number;
};

type OwnerOption = {
  ownerKey: string;
  label: string;
  detail: string;
};

type TemplateWeightLog = {
  id: string;
  templateId: string;
  templateNombre: string;
  alumnoNombre?: string;
  blockId: string;
  blockTitulo: string;
  exerciseId: string;
  exerciseNombre: string;
  fecha: string;
  nroSerie: number;
  nroRep: number;
  pesoKg: number;
  molestia: boolean;
  comentario?: string;
  createdAt: string;
};

type AlumnoWorkoutLogLite = {
  id: string;
  alumnoNombre: string;
  sessionId: string;
  sessionTitle: string;
  weekId?: string;
  weekName?: string;
  dayId?: string;
  dayName?: string;
  blockId?: string;
  blockTitle?: string;
  exerciseId?: string;
  exerciseName?: string;
  exerciseKey?: string;
  fecha: string;
  series: number;
  repeticiones: number;
  pesoKg: number;
  molestia: boolean;
  comentario?: string;
  createdAt: string;
};

const STORAGE_KEY = "pf-control-semana-plan";
const ALUMNO_NOTIFICATIONS_KEY = "pf-control-alumno-week-notifications";
const TEMPLATE_WEIGHT_LOGS_KEY = "pf-control-template-weight-logs-v1";
const ALUMNO_WORKOUT_LOGS_KEY = "pf-control-alumno-workout-logs-v1";
const GENERAL_OWNER_KEY = "general:plan";
const AUTO_OBJECTIVE_PREFIX = "[AUTO-PRESCRIPCION]";

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createTemplateSpec = (): TemplateExerciseSpec => ({
  id: createId(),
  nombre: "",
  valor: "",
});

const createTemplateSetDraft = (serie: number): TemplateSetDraft => ({
  id: createId(),
  serie,
  repeticiones: "",
  cargaKg: "",
  rir: "",
  descanso: "",
  observaciones: "",
});

const createTemplateSuperSerieDraft = (
  seed?: Partial<Pick<TemplateSuperSerieDraft, "ejercicioId" | "series" | "repeticiones" | "descanso" | "carga">>
): TemplateSuperSerieDraft => ({
  id: createId(),
  ejercicioId: seed?.ejercicioId || "",
  series: seed?.series || "",
  repeticiones: seed?.repeticiones || "",
  descanso: seed?.descanso || "",
  carga: seed?.carga || "",
});

const createTemplateExercise = (): TemplateExerciseDraft => ({
  id: createId(),
  ejercicioId: "",
  series: "0",
  repeticiones: "0",
  descanso: "0",
  carga: "",
  especificaciones: [],
  serieDesglose: [],
  superSerie: [],
});

const createTemplateBlock = (index: number): TemplateBlockDraft => ({
  id: createId(),
  titulo: `Bloque ${index + 1}`,
  objetivo: "",
  ejercicios: [createTemplateExercise()],
});

const createTemplateDayTraining = (): TemplateDayTraining => ({
  titulo: "Sesion",
  descripcion: "",
  duracion: "",
  bloques: [createTemplateBlock(0)],
});

const cloneTemplateTraining = (
  training: TemplateDayTraining | undefined
): TemplateDayTraining | undefined => {
  if (!training) return undefined;

  return {
    ...training,
    bloques: (training.bloques || []).map((block) => ({
      ...block,
      id: createId(),
      ejercicios: (block.ejercicios || []).map((exercise) => ({
        ...exercise,
        id: createId(),
        especificaciones: (exercise.especificaciones || []).map((spec) => ({
          ...spec,
          id: createId(),
        })),
        serieDesglose: (exercise.serieDesglose || []).map((setDraft, setIndex) => ({
          ...setDraft,
          id: createId(),
          serie: Number.isFinite(Number(setDraft.serie)) ? Number(setDraft.serie) : setIndex + 1,
        })),
        superSerie: (exercise.superSerie || []).map((superExercise) => ({
          ...superExercise,
          id: createId(),
        })),
      })),
    })),
  };
};

const toOwnerKey = (persona: PersonaItem) =>
  `${persona.tipo}:${persona.nombre.trim().toLowerCase()}`;

const cloneSemanas = (semanas: SemanaPlan[]): SemanaPlan[] =>
  semanas.map((semana) => ({
    ...semana,
    id: createId(),
    dias: semana.dias.map((dia) => ({
      ...dia,
      id: createId(),
      entrenamiento: cloneTemplateTraining(dia.entrenamiento),
    })),
  }));

const normalizeSemanasForCompare = (semanas: SemanaPlan[]) =>
  semanas.map((semana) => ({
    nombre: semana.nombre,
    objetivo: semana.objetivo,
    dias: semana.dias.map((dia) => ({
      dia: dia.dia,
      planificacion: dia.planificacion,
      objetivo: dia.objetivo || "",
      sesionId: dia.sesionId || "",
    })),
  }));

const hashPlanFingerprint = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 8);
};

const summarizePlanLoad = (semanas: SemanaPlan[]) => ({
  totalSemanas: semanas.length,
  totalDias: semanas.reduce((acc, semana) => acc + semana.dias.length, 0),
});

const isAutoObjective = (value?: string) =>
  Boolean((value || "").trim().startsWith(AUTO_OBJECTIVE_PREFIX));

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizePersonKey = (value: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const namesLikelyMatch = (a: string, b: string) => {
  const left = normalizePersonKey(a);
  const right = normalizePersonKey(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  const shared = leftTokens.filter((token) => rightTokens.includes(token));

  return shared.length >= 2 || shared.some((token) => token.length >= 5);
};

const tokenizeText = (value: string) =>
  new Set(normalizeText(value).split(" ").filter((token) => token.length >= 4));

const SESSION_FOCUS_GROUPS = [
  { tag: "fuerza", keywords: ["fuerza", "gym", "pesas", "sentadilla", "empuje"] },
  { tag: "velocidad", keywords: ["velocidad", "sprint", "aceleracion", "cambio", "agilidad"] },
  { tag: "potencia", keywords: ["potencia", "salto", "pliometr", "explos"] },
  { tag: "tecnica", keywords: ["tecnica", "gesto", "coordin", "control", "habilidad"] },
  { tag: "resistencia", keywords: ["resistencia", "aerob", "capacidad", "tempo", "intermitente"] },
  { tag: "recuperacion", keywords: ["recuper", "movilidad", "descarga", "respiracion", "regener"] },
] as const;

const extractFocusTags = (value: string) => {
  const normalized = normalizeText(value);
  const tags = new Set<string>();

  for (const group of SESSION_FOCUS_GROUPS) {
    if (group.keywords.some((keyword) => normalized.includes(keyword))) {
      tags.add(group.tag);
    }
  }

  return tags;
};

const getSessionExerciseCount = (session: Sesion) =>
  (session.bloques || []).reduce((acc, bloque) => acc + (bloque.ejercicios || []).length, 0);

const getSessionProfile = (session: Sesion) => {
  const text = [
    session.titulo,
    session.objetivo,
    ...(session.bloques || []).flatMap((bloque) => [bloque.titulo, bloque.objetivo]),
  ].join(" ");

  const tags = extractFocusTags(text);

  return {
    tags,
    tokens: tokenizeText(text),
    blockCount: (session.bloques || []).length,
    exerciseCount: getSessionExerciseCount(session),
    hasRecoveryBias: tags.has("recuperacion"),
  };
};

const buildSessionUsageMap = (semanas: SemanaPlan[]) => {
  const usage = new Map<string, number>();

  for (const semana of semanas) {
    for (const dia of semana.dias) {
      if (!dia.sesionId) continue;
      usage.set(dia.sesionId, (usage.get(dia.sesionId) || 0) + 1);
    }
  }

  return usage;
};

const scoreTokenOverlap = (left: Set<string>, right: Set<string>) => {
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
};

const scoreSessionCandidate = ({
  session,
  objectiveText,
  usageCount,
  excludeSessionId,
  preferUnused = false,
  recoveryBias = false,
  avoidTags = [],
}: {
  session: Sesion;
  objectiveText: string;
  usageCount: number;
  excludeSessionId?: string;
  preferUnused?: boolean;
  recoveryBias?: boolean;
  avoidTags?: string[];
}) => {
  if (excludeSessionId && session.id === excludeSessionId) {
    return Number.NEGATIVE_INFINITY;
  }

  const objectiveTokens = tokenizeText(objectiveText);
  const objectiveTags = extractFocusTags(objectiveText);
  const profile = getSessionProfile(session);

  let score = 0;
  score += Math.min(8, scoreTokenOverlap(objectiveTokens, profile.tokens) * 1.75);

  let tagMatches = 0;
  for (const tag of objectiveTags) {
    if (profile.tags.has(tag)) {
      tagMatches += 1;
    }
  }
  score += tagMatches * 6;

  if (preferUnused && usageCount === 0) {
    score += 5;
  }

  if (recoveryBias) {
    score += profile.hasRecoveryBias ? 10 : -5;
  }

  if (avoidTags.length > 0) {
    for (const tag of avoidTags) {
      if (profile.tags.has(tag)) {
        score -= 4;
      }
    }
  }

  score += Math.min(profile.blockCount, 4) * 1.25;
  score += Math.min(profile.exerciseCount, 12) * 0.35;
  score += session.objetivo.trim() ? 1.5 : 0;
  score -= usageCount * 3.5;

  return score;
};

const getSemanaBaseDias = (): DiaPlan[] =>
  semanaInicial.map((item) => ({
    id: createId(),
    dia: item.dia,
    planificacion: item.sesion,
    objetivo: "",
  }));

const createTemplateDay = (index: number): DiaPlan => ({
  id: createId(),
  dia: `Dia ${index + 1}`,
  planificacion: "",
  objetivo: "",
  sesionId: "",
  entrenamiento: createTemplateDayTraining(),
});

const createTemplateWeek = (index: number): SemanaPlan => ({
  id: createId(),
  nombre: `Semana ${index + 1}`,
  objetivo: "",
  dias: [createTemplateDay(0)],
});

const createTemplateDraft = (personaTipo: PersonaTipo, categoria?: string): PlanTemplate => ({
  id: createId(),
  nombre: "NUEVO PLAN BLANCO",
  tipo: personaTipo,
  categoria,
  descripcion: "",
  etiquetas: [],
  feedbackQuestions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  semanas: [createTemplateWeek(0)],
});

const getSemanaBase = (): SemanaPlan[] => [
  {
    id: createId(),
    nombre: "Semana 1",
    objetivo: "Plan semanal editable",
    dias: getSemanaBaseDias(),
  },
];

const getDefaultStore = (): SemanaStoreV3 => ({
  version: 3,
  planes: [],
  templates: [],
});

const isLegacySemana = (value: unknown): value is LegacySemanaItem[] => {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "dia" in item &&
      "sesion" in item &&
      typeof (item as { dia: unknown }).dia === "string" &&
      typeof (item as { sesion: unknown }).sesion === "string"
  );
};

const isSemanaPlanList = (value: unknown): value is SemanaPlan[] => {
  if (!Array.isArray(value)) return false;

  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "nombre" in item &&
      "dias" in item &&
      Array.isArray((item as { dias: unknown }).dias)
  );
};

const isSemanaStoreV2 = (value: unknown): value is SemanaStoreV2 => {
  if (typeof value !== "object" || value === null) return false;
  if (!("version" in value) || !("planes" in value)) return false;
  return (
    (value as { version?: unknown }).version === 2 &&
    Array.isArray((value as { planes: unknown }).planes)
  );
};

const isSemanaStoreV3 = (value: unknown): value is SemanaStoreV3 => {
  if (typeof value !== "object" || value === null) return false;
  if (!("version" in value) || !("planes" in value) || !("templates" in value)) return false;
  return (
    (value as { version?: unknown }).version === 3 &&
    Array.isArray((value as { planes: unknown }).planes) &&
    Array.isArray((value as { templates: unknown }).templates)
  );
};

const ensurePlanForPersona = (store: SemanaStoreV3, persona: PersonaItem): SemanaStoreV3 => {
  const ownerKey = toOwnerKey(persona);
  const exists = store.planes.some((plan) => plan.ownerKey === ownerKey);
  if (exists) return store;

  return {
    ...store,
    planes: [
      ...store.planes,
      {
        ownerKey,
        tipo: persona.tipo,
        nombre: persona.nombre,
        categoria: persona.categoria,
        semanas: getSemanaBase(),
        historial: [],
      },
    ],
  };
};

const getYouTubeVideoId = (value: string): string | null => {
  const input = (value || "").trim();
  if (!input) return null;

  const match = input.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
};

const getExerciseThumbnail = (videoUrl?: string) => {
  const raw = (videoUrl || "").trim();
  if (!raw) return "";

  const ytId = getYouTubeVideoId(raw);
  if (ytId) {
    return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  }

  if (/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(raw)) {
    return raw;
  }

  return "";
};

const normalizeAlumnoWorkoutLogs = (rawValue: unknown): AlumnoWorkoutLogLite[] => {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id || createId()),
        alumnoNombre: String(item.alumnoNombre || item.alumno || "").trim(),
        sessionId: String(item.sessionId || "").trim(),
        sessionTitle: String(item.sessionTitle || item.sesion || "Sesion").trim() || "Sesion",
        weekId: String(item.weekId || "").trim() || undefined,
        weekName: String(item.weekName || item.week || "").trim() || undefined,
        dayId: String(item.dayId || "").trim() || undefined,
        dayName: String(item.dayName || item.dia || "").trim() || undefined,
        blockId: String(item.blockId || "").trim() || undefined,
        blockTitle: String(item.blockTitle || item.block || "").trim() || undefined,
        exerciseId: String(item.exerciseId || "").trim() || undefined,
        exerciseName: String(item.exerciseName || item.ejercicio || "").trim() || undefined,
        exerciseKey: String(item.exerciseKey || "").trim() || undefined,
        fecha: String(item.fecha || "").slice(0, 10),
        series: Math.max(1, Math.round(Number(item.series || 1))),
        repeticiones: Math.max(0, Math.round(Number(item.repeticiones || 0))),
        pesoKg: Math.max(0, Number(item.pesoKg ?? item.peso ?? 0)),
        molestia: Boolean(item.molestia),
        comentario: String(item.comentarios || item.comentario || "").trim() || undefined,
        createdAt: String(item.createdAt || new Date().toISOString()),
      };
    })
    .filter((item) => item.alumnoNombre && item.sessionId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
};

const parseSeriesCount = (seriesValue: string) => {
  const parsed = Math.round(Number(seriesValue || 0));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const buildTemplateExerciseKey = (blockId: string, exerciseId: string, exerciseIndex: number) =>
  `${blockId}::${exerciseId || "sin-ejercicio"}::${exerciseIndex}`;

export default function SemanaPage() {
  const { jugadoras } = usePlayers();
  const { alumnos } = useAlumnos();
  const { sesiones } = useSessions();
  const { ejercicios } = useEjercicios();

  const [store, setStore, loaded] = useSharedState<
    SemanaStoreV3 | SemanaStoreV2 | SemanaPlan[] | LegacySemanaItem[]
  >(getDefaultStore(), {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });
  const [alumnoNotifications, setAlumnoNotifications] = useSharedState<AlumnoWeekNotification[]>(
    [],
    {
      key: ALUMNO_NOTIFICATIONS_KEY,
      legacyLocalStorageKey: ALUMNO_NOTIFICATIONS_KEY,
    }
  );
  const [templateWeightLogs, setTemplateWeightLogs] = useSharedState<TemplateWeightLog[]>([], {
    key: TEMPLATE_WEIGHT_LOGS_KEY,
    legacyLocalStorageKey: TEMPLATE_WEIGHT_LOGS_KEY,
  });
  const [alumnoWorkoutLogsRaw, setAlumnoWorkoutLogsRaw] = useSharedState<unknown[]>([], {
    key: ALUMNO_WORKOUT_LOGS_KEY,
    legacyLocalStorageKey: ALUMNO_WORKOUT_LOGS_KEY,
  });

  const migratedRef = useRef(false);
  const alumnoPlanHashesRef = useRef<Record<string, string>>({});
  const alumnoNotificationCooldownRef = useRef<Record<string, number>>({});
  const [tipoFiltro, setTipoFiltro] = useState<PersonaTipo>("jugadoras");
  const [selectedOwnerKey, setSelectedOwnerKey] = useState<string>(GENERAL_OWNER_KEY);
  const [nuevoDiaPorSemana, setNuevoDiaPorSemana] = useState<Record<string, string>>({});
  const [nuevaPlanPorSemana, setNuevaPlanPorSemana] = useState<Record<string, string>>({});
  const [templatesTab, setTemplatesTab] = useState<"nuevo" | "mis">("mis");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templatePreviewWeekId, setTemplatePreviewWeekId] = useState("");
  const [templatePreviewDayId, setTemplatePreviewDayId] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateDraft, setTemplateDraft] = useState<PlanTemplate>(
    createTemplateDraft("jugadoras")
  );
  const [templateDraftWeekId, setTemplateDraftWeekId] = useState("");
  const [templateDraftDayId, setTemplateDraftDayId] = useState("");
  const [templateTagInput, setTemplateTagInput] = useState("");
  const [templateFeedbackInput, setTemplateFeedbackInput] = useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [feedbackConfigOpen, setFeedbackConfigOpen] = useState(false);
  const [blockMenuOpenId, setBlockMenuOpenId] = useState<string | null>(null);
  const [blockGridConfigOpenId, setBlockGridConfigOpenId] = useState<string | null>(null);
  const [exerciseSelectorOpenId, setExerciseSelectorOpenId] = useState<string | null>(null);
  const [exerciseSelectorQuery, setExerciseSelectorQuery] = useState<Record<string, string>>({});
  const [weightViewer, setWeightViewer] = useState<{
    blockId: string;
    blockTitulo: string;
    exerciseId: string;
    exerciseNombre: string;
  } | null>(null);
  const [weightRegister, setWeightRegister] = useState<{
    blockId: string;
    blockTitulo: string;
    exerciseId: string;
    exerciseNombre: string;
  } | null>(null);
  const [weightRegisterScope, setWeightRegisterScope] = useState<"template" | "alumno">(
    "template"
  );
  const [weightForm, setWeightForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    nroSerie: "1",
    nroRep: "0",
    pesoKg: "0",
    molestia: false,
    comentario: "",
  });
  const [blockTitleEdit, setBlockTitleEdit] = useState<{
    blockId: string;
    value: string;
  } | null>(null);
  const templateNameInputRef = useRef<HTMLInputElement | null>(null);
  const [historialEtiqueta, setHistorialEtiqueta] = useState("");
  const [compareAId, setCompareAId] = useState("");
  const [compareBId, setCompareBId] = useState("__current__");
  const [historialScreenOpen, setHistorialScreenOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const [toastPhase, setToastPhase] = useState<"enter" | "exit">("enter");
  const toastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (
    message: string,
    kind: ToastKind = "success",
    durationMs = 2600
  ) => {
    setToast({ message, kind });
    setToastPhase("exit");

    if (toastHideTimerRef.current) {
      clearTimeout(toastHideTimerRef.current);
    }

    if (toastClearTimerRef.current) {
      clearTimeout(toastClearTimerRef.current);
    }

    requestAnimationFrame(() => {
      setToastPhase("enter");
    });

    const hideAt = Math.max(durationMs - 220, 140);
    toastHideTimerRef.current = setTimeout(() => {
      setToastPhase("exit");
    }, hideAt);

    toastClearTimerRef.current = setTimeout(() => {
      setToast(null);
      setToastPhase("enter");
      toastHideTimerRef.current = null;
      toastClearTimerRef.current = null;
    }, durationMs);
  };

  const notifySuccess = (message = "Los cambios se han realizado correctamente") => {
    showToast(message, "success");
  };

  const notifyWarning = (message: string) => {
    showToast(message, "warning");
  };

  const notifyError = (message: string) => {
    showToast(message, "error", 3200);
  };

  useEffect(() => {
    if (!loaded || migratedRef.current) return;
    migratedRef.current = true;

    if (isSemanaStoreV3(store)) {
      if (store.planes.length === 0) {
        setStore({
          version: 3,
          planes: [
            {
              ownerKey: GENERAL_OWNER_KEY,
              tipo: "jugadoras",
              nombre: "Plan general",
              semanas: getSemanaBase(),
              historial: [],
            },
          ],
          templates: store.templates || [],
        });
      }
      return;
    }

    if (isSemanaStoreV2(store)) {
      setStore({
        version: 3,
        planes: store.planes,
        templates: [],
      });
      return;
    }

    if (isSemanaPlanList(store)) {
      setStore({
        version: 3,
        planes: [
          {
            ownerKey: GENERAL_OWNER_KEY,
            tipo: "jugadoras",
            nombre: "Plan general",
            semanas: store,
            historial: [],
          },
        ],
        templates: [],
      });
      return;
    }

    if (isLegacySemana(store)) {
      setStore({
        version: 3,
        planes: [
          {
            ownerKey: GENERAL_OWNER_KEY,
            tipo: "jugadoras",
            nombre: "Plan general",
            semanas: [
              {
                id: createId(),
                nombre: "Semana 1",
                objetivo: "Plan semanal editable",
                dias: store.map((item) => ({
                  id: createId(),
                  dia: item.dia,
                  planificacion: item.sesion,
                  objetivo: "",
                })),
              },
            ],
            historial: [],
          },
        ],
        templates: [],
      });
      return;
    }

    setStore(getDefaultStore());
  }, [loaded, setStore, store]);

  useEffect(() => {
    return () => {
      if (toastHideTimerRef.current) {
        clearTimeout(toastHideTimerRef.current);
      }

      if (toastClearTimerRef.current) {
        clearTimeout(toastClearTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!toast || toast.kind !== "error" || !toastRef.current) {
      return;
    }

    toastRef.current.animate(
      [
        { transform: "translateX(0px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(0px)" },
      ],
      { duration: 280, easing: "ease-in-out" }
    );
  }, [toast]);

  const storeV3 = useMemo(() => (isSemanaStoreV3(store) ? store : getDefaultStore()), [store]);

  useEffect(() => {
    if (!loaded || !isSemanaStoreV3(store)) {
      return;
    }

    const nextHashes: Record<string, string> = {};
    const changedPlans: PlanPorPersona[] = [];

    for (const plan of store.planes) {
      if (plan.tipo !== "alumnos") {
        continue;
      }

      const planHash = hashPlanFingerprint(
        JSON.stringify(normalizeSemanasForCompare(plan.semanas))
      );
      nextHashes[plan.ownerKey] = planHash;

      const previousHash = alumnoPlanHashesRef.current[plan.ownerKey];
      if (previousHash && previousHash !== planHash) {
        changedPlans.push(plan);
      }
    }

    if (Object.keys(alumnoPlanHashesRef.current).length === 0) {
      alumnoPlanHashesRef.current = nextHashes;
      return;
    }

    alumnoPlanHashesRef.current = nextHashes;

    if (changedPlans.length === 0) {
      return;
    }

    const now = Date.now();
    const freshPlans = changedPlans.filter((plan) => {
      const lastAt = alumnoNotificationCooldownRef.current[plan.ownerKey] || 0;
      if (now - lastAt < 12000) {
        return false;
      }
      alumnoNotificationCooldownRef.current[plan.ownerKey] = now;
      return true;
    });

    if (freshPlans.length === 0) {
      return;
    }

    const newNotifications = freshPlans.map((plan) => {
      const summaryStats = summarizePlanLoad(plan.semanas);
      return {
        id: createId(),
        ownerKey: plan.ownerKey,
        alumnoNombre: plan.nombre,
        createdAt: new Date().toISOString(),
        summary: `Semana actualizada: ${summaryStats.totalSemanas} semanas activas y ${summaryStats.totalDias} dias cargados.`,
        totalSemanas: summaryStats.totalSemanas,
        totalDias: summaryStats.totalDias,
      } satisfies AlumnoWeekNotification;
    });

    setAlumnoNotifications((prev) => [...newNotifications, ...prev].slice(0, 40));

    const toastMessage =
      freshPlans.length === 1
        ? `Se actualizo la semana de ${freshPlans[0].nombre}`
        : `Se actualizaron ${freshPlans.length} planes de alumnos`;

    showToast(toastMessage, "warning", 3200);
  }, [loaded, setAlumnoNotifications, showToast, store]);

  const todasLasPersonas = useMemo<PersonaItem[]>(() => {
    const listJugadoras: PersonaItem[] = jugadoras.map((jugadora) => ({
      tipo: "jugadoras",
      nombre: jugadora.nombre,
      categoria: jugadora.categoria,
    }));

    const listAlumnos: PersonaItem[] = alumnos.map((alumno) => ({
      tipo: "alumnos",
      nombre: alumno.nombre,
    }));

    return [...listJugadoras, ...listAlumnos];
  }, [alumnos, jugadoras]);

  const ownerOptions = useMemo<OwnerOption[]>(() => {
    const byKey = new Map<string, OwnerOption>();

    byKey.set(GENERAL_OWNER_KEY, {
      ownerKey: GENERAL_OWNER_KEY,
      label: "Plan general",
      detail: "Vista global",
    });

    for (const persona of todasLasPersonas) {
      const ownerKey = toOwnerKey(persona);
      byKey.set(ownerKey, {
        ownerKey,
        label: persona.nombre,
        detail:
          persona.tipo === "alumnos"
            ? "Alumno"
            : persona.categoria
            ? `Jugadora - ${persona.categoria}`
            : "Jugadora",
      });
    }

    for (const plan of storeV3.planes) {
      if (byKey.has(plan.ownerKey)) {
        continue;
      }

      byKey.set(plan.ownerKey, {
        ownerKey: plan.ownerKey,
        label: plan.nombre,
        detail: plan.tipo === "alumnos" ? "Alumno" : "Jugadora",
      });
    }

    const generalOption = byKey.get(GENERAL_OWNER_KEY);
    const rest = Array.from(byKey.values())
      .filter((option) => option.ownerKey !== GENERAL_OWNER_KEY)
      .sort((left, right) => left.label.localeCompare(right.label));

    return generalOption ? [generalOption, ...rest] : rest;
  }, [storeV3.planes, todasLasPersonas]);

  const personaSeleccionada = useMemo(() => {
    return todasLasPersonas.find((persona) => toOwnerKey(persona) === selectedOwnerKey) || null;
  }, [selectedOwnerKey, todasLasPersonas]);

  const alumnoDestinoActivo =
    personaSeleccionada?.tipo === "alumnos" ? personaSeleccionada : null;

  useEffect(() => {
    if (!loaded || !isSemanaStoreV3(store)) return;

    const hasSelected = store.planes.some((plan) => plan.ownerKey === selectedOwnerKey);
    if (hasSelected) return;

    const preferredPersona =
      todasLasPersonas.find((persona) => persona.tipo === tipoFiltro) || todasLasPersonas[0];
    if (preferredPersona) {
      const key = toOwnerKey(preferredPersona);
      setSelectedOwnerKey(key);
      setStore((prev) =>
        isSemanaStoreV3(prev) ? ensurePlanForPersona(prev, preferredPersona) : prev
      );
      return;
    }

    const firstPlan = store.planes[0];
    if (firstPlan) {
      setSelectedOwnerKey(firstPlan.ownerKey);
    }
  }, [loaded, selectedOwnerKey, setStore, store, tipoFiltro, todasLasPersonas]);

  const planSeleccionado = useMemo(() => {
    return storeV3.planes.find((plan) => plan.ownerKey === selectedOwnerKey) || null;
  }, [selectedOwnerKey, storeV3.planes]);

  const sesionesDisponibles = useMemo(() => {
    if (!personaSeleccionada) return [];

    if (personaSeleccionada.tipo === "alumnos") {
      return sesiones
        .filter(
          (sesion) =>
            sesion.asignacionTipo === "alumnos" &&
            (!sesion.alumnoAsignado || sesion.alumnoAsignado === personaSeleccionada.nombre)
        )
        .sort((a, b) => a.titulo.localeCompare(b.titulo));
    }

    return sesiones
      .filter((sesion) => {
        const esJugadoras = (sesion.asignacionTipo || "jugadoras") === "jugadoras";
        if (!esJugadoras) return false;

        const coincideCategoria =
          !sesion.categoriaAsignada ||
          !personaSeleccionada.categoria ||
          sesion.categoriaAsignada === personaSeleccionada.categoria;
        const coincideJugadora =
          !sesion.jugadoraAsignada || sesion.jugadoraAsignada === personaSeleccionada.nombre;

        return coincideCategoria && coincideJugadora;
      })
      .sort((a, b) => a.titulo.localeCompare(b.titulo));
  }, [personaSeleccionada, sesiones]);

  const sesionesById = useMemo(
    () => new Map(sesiones.map((sesion) => [sesion.id, sesion])),
    [sesiones]
  );

  const getLatestPersonaPrescription = (sesion: Sesion) => {
    if (!personaSeleccionada) {
      return null;
    }

    const matching = (sesion.prescripciones || []).filter(
      (item) =>
        item.personaNombre === personaSeleccionada.nombre &&
        item.personaTipo === personaSeleccionada.tipo
    );

    if (matching.length === 0) {
      return null;
    }

    return matching.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )[0];
  };

  const getEffectiveLinkedSession = (sesionId?: string) => {
    if (!sesionId) {
      return null;
    }

    const sesion = sesionesById.get(sesionId);
    if (!sesion) {
      return null;
    }

    const prescripcion = getLatestPersonaPrescription(sesion);

    return {
      sesion,
      bloques: prescripcion?.bloques || sesion.bloques || [],
      isPersonalized: Boolean(prescripcion),
      prescripcion,
    };
  };

  const buildTemplateTrainingFromLinkedSession = (
    linkedSession: ReturnType<typeof getEffectiveLinkedSession>
  ): TemplateDayTraining | null => {
    if (!linkedSession) {
      return null;
    }

    const linkedSessionId = String(linkedSession.sesion.id || "linked-session");
    const rawBlocks = Array.isArray(linkedSession.bloques) ? linkedSession.bloques : [];

    const mappedBlocks: TemplateBlockDraft[] = rawBlocks
      .filter((block) => block && typeof block === "object")
      .map((block, blockIndex) => {
        const blockRow = block as Record<string, unknown>;
        const blockId = String(blockRow.id || `${linkedSessionId}-block-${blockIndex + 1}`);
        const rawExercises = Array.isArray(blockRow.ejercicios) ? blockRow.ejercicios : [];

        const mappedExercises: TemplateExerciseDraft[] = rawExercises
          .filter((exercise) => exercise && typeof exercise === "object")
          .map((exercise, exerciseIndex) => {
            const exerciseRow = exercise as Record<string, unknown>;
            const exerciseId = String(exerciseRow.id || `${blockId}-exercise-${exerciseIndex + 1}`);
            const rawMetricas = Array.isArray(exerciseRow.metricas) ? exerciseRow.metricas : [];
            const rawSerieDesglose = Array.isArray(exerciseRow.serieDesglose)
              ? exerciseRow.serieDesglose
              : [];
            const rawSuperSerie = Array.isArray(exerciseRow.superSerie)
              ? exerciseRow.superSerie
              : [];

            const especificaciones: TemplateExerciseSpec[] = rawMetricas
              .filter((item) => item && typeof item === "object")
              .map((item, metricIndex) => {
                const metricRow = item as Record<string, unknown>;
                return {
                  id: String(metricRow.id || `${exerciseId}-spec-${metricIndex + 1}`),
                  nombre: String(metricRow.nombre || `Campo ${metricIndex + 1}`),
                  valor: String(metricRow.valor || ""),
                };
              });

            return {
              id: exerciseId,
              ejercicioId: String(exerciseRow.ejercicioId || ""),
              series: String(exerciseRow.series || "0"),
              repeticiones: String(exerciseRow.repeticiones || "0"),
              descanso: String(exerciseRow.descanso || "0"),
              carga: String(exerciseRow.carga || ""),
              especificaciones,
              serieDesglose: rawSerieDesglose
                .filter((item) => item && typeof item === "object")
                .map((item, setIndex) => {
                  const setRow = item as Record<string, unknown>;
                  return {
                    id: String(setRow.id || `${exerciseId}-set-${setIndex + 1}`),
                    serie: Number.isFinite(Number(setRow.serie))
                      ? Number(setRow.serie)
                      : setIndex + 1,
                    repeticiones: String(setRow.repeticiones || ""),
                    cargaKg: String(setRow.cargaKg || setRow.carga || ""),
                    rir: String(setRow.rir || ""),
                    descanso: String(setRow.descanso || exerciseRow.descanso || ""),
                    observaciones: String(setRow.observaciones || ""),
                  };
                }),
              superSerie: rawSuperSerie
                .filter((item) => item && typeof item === "object")
                .map((item, superIndex) => {
                  const superRow = item as Record<string, unknown>;
                  return {
                    id: String(superRow.id || `${exerciseId}-super-${superIndex + 1}`),
                    ejercicioId: String(superRow.ejercicioId || ""),
                    series: String(superRow.series || ""),
                    repeticiones: String(superRow.repeticiones || ""),
                    descanso: String(superRow.descanso || ""),
                    carga: String(superRow.carga || ""),
                  };
                }),
            };
          });

        return {
          id: blockId,
          titulo: String(blockRow.titulo || `Bloque ${blockIndex + 1}`),
          objetivo: String(blockRow.objetivo || ""),
          ejercicios: mappedExercises.length > 0 ? mappedExercises : [createTemplateExercise()],
        };
      });

    if (mappedBlocks.length === 0) {
      return null;
    }

    return {
      titulo: String(linkedSession.sesion.titulo || "Sesion"),
      descripcion: String(linkedSession.sesion.objetivo || ""),
      duracion: String(linkedSession.sesion.duracion || ""),
      bloques: mappedBlocks,
    };
  };

  useEffect(() => {
    if (!loaded || !selectedOwnerKey || !planSeleccionado || !personaSeleccionada) {
      return;
    }

    let changed = false;

    setStore((prev) => {
      if (!isSemanaStoreV3(prev)) {
        return prev;
      }

      const nextPlanes = prev.planes.map((plan) => {
        if (plan.ownerKey !== selectedOwnerKey) {
          return plan;
        }

        const nextWeeks = plan.semanas.map((semana) => ({
          ...semana,
          dias: semana.dias.map((dia) => {
            const linked = getEffectiveLinkedSession(dia.sesionId);
            if (!linked || !linked.isPersonalized) {
              return dia;
            }

            const nextObjective = `${AUTO_OBJECTIVE_PREFIX} ${
              linked.prescripcion?.resumen || "Prescripcion individual activa"
            }`;

            if (
              (isAutoObjective(dia.objetivo) || !(dia.objetivo || "").trim()) &&
              dia.objetivo !== nextObjective
            ) {
              changed = true;
              return {
                ...dia,
                objetivo: nextObjective,
              };
            }

            return dia;
          }),
        }));

        return changed ? { ...plan, semanas: nextWeeks } : plan;
      });

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        planes: nextPlanes,
      };
    });
  }, [
    loaded,
    personaSeleccionada,
    planSeleccionado,
    selectedOwnerKey,
    sesionesById,
    setStore,
  ]);

  const getExerciseName = (id: string) => {
    const ejercicio = ejercicios.find((item) => item.id === id);
    return ejercicio ? ejercicio.nombre : "Ejercicio";
  };

  const templatesOrdenados = useMemo(() => {
    return [...storeV3.templates].sort((a, b) => {
      const left = new Date(b.updatedAt || b.createdAt || 0).getTime();
      const right = new Date(a.updatedAt || a.createdAt || 0).getTime();
      return left - right;
    });
  }, [storeV3.templates]);

  const templatesFiltrados = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) return templatesOrdenados;

    return templatesOrdenados.filter((template) => {
      const tags = (template.etiquetas || []).join(" ").toLowerCase();
      const base = `${template.nombre} ${template.descripcion || ""} ${tags}`.toLowerCase();
      return base.includes(query);
    });
  }, [templateSearch, templatesOrdenados]);

  const selectedTemplate = useMemo(
    () => storeV3.templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, storeV3.templates]
  );

  const selectedTemplatePreviewWeek = useMemo(
    () => selectedTemplate?.semanas.find((week) => week.id === templatePreviewWeekId) || null,
    [selectedTemplate, templatePreviewWeekId]
  );

  const selectedTemplatePreviewDay = useMemo(
    () => selectedTemplatePreviewWeek?.dias.find((day) => day.id === templatePreviewDayId) || null,
    [templatePreviewDayId, selectedTemplatePreviewWeek]
  );

  const templateDraftWeek = useMemo(
    () => templateDraft.semanas.find((week) => week.id === templateDraftWeekId) || null,
    [templateDraft.semanas, templateDraftWeekId]
  );

  const templateDraftDay = useMemo(
    () => templateDraftWeek?.dias.find((day) => day.id === templateDraftDayId) || null,
    [templateDraftDayId, templateDraftWeek]
  );

  const templateDraftDayLinkedSession = getEffectiveLinkedSession(templateDraftDay?.sesionId);
  const templateDraftDayEffectiveTraining =
    templateDraftDay?.entrenamiento ||
    buildTemplateTrainingFromLinkedSession(templateDraftDayLinkedSession);

  const templateScopeWeek = useMemo(
    () => templateDraft.semanas[0] || templateDraftWeek || null,
    [templateDraft.semanas, templateDraftWeek]
  );

  const templateScopeDay = useMemo(
    () => templateScopeWeek?.dias[0] || templateDraftDay || null,
    [templateDraftDay, templateScopeWeek]
  );

  const templateScopeWeekId = templateScopeWeek?.id || "";
  const templateScopeDayId = templateScopeDay?.id || "";

  const alumnoWorkoutLogs = useMemo(
    () => normalizeAlumnoWorkoutLogs(alumnoWorkoutLogsRaw),
    [alumnoWorkoutLogsRaw]
  );

  const templateWeightLogsSorted = useMemo(
    () => [...templateWeightLogs].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [templateWeightLogs]
  );

  const weightViewerRows = useMemo(() => {
    if (!weightViewer) return [];

    const fromTemplate = templateWeightLogsSorted.filter(
      (row) => row.templateId === templateDraft.id && row.blockId === weightViewer.blockId && row.exerciseId === weightViewer.exerciseId
    );

    const fromAlumno = alumnoWorkoutLogs
      .filter((row) => {
        const matchesAlumno = alumnoDestinoActivo
          ? namesLikelyMatch(row.alumnoNombre, alumnoDestinoActivo.nombre)
          : true;

        return (
          matchesAlumno &&
          row.exerciseId === weightViewer.exerciseId &&
          (!weightViewer.blockId || row.blockId === weightViewer.blockId)
        );
      })
      .map((row) => ({
        id: row.id,
        templateId: templateDraft.id,
        templateNombre: templateDraft.nombre,
        alumnoNombre: row.alumnoNombre,
        blockId: row.blockId || "",
        blockTitulo: row.blockTitle || "",
        exerciseId: row.exerciseId || "",
        exerciseNombre: row.exerciseName || weightViewer.exerciseNombre,
        fecha: row.fecha,
        nroSerie: row.series,
        nroRep: row.repeticiones,
        pesoKg: row.pesoKg,
        molestia: row.molestia,
        comentario: row.comentario,
        createdAt: row.createdAt,
      }));

    return [...fromTemplate, ...fromAlumno]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 120);
  }, [alumnoDestinoActivo, alumnoWorkoutLogs, templateDraft.id, templateDraft.nombre, templateWeightLogsSorted, weightViewer]);

  const historialPlanSeleccionado = planSeleccionado?.historial || [];

  useEffect(() => {
    if (historialPlanSeleccionado.length === 0) {
      setCompareAId("");
      setCompareBId("__current__");
      return;
    }

    const hasA = historialPlanSeleccionado.some((item) => item.id === compareAId);
    if (!hasA) {
      setCompareAId(historialPlanSeleccionado[0].id);
    }

    const hasB =
      compareBId === "__current__" ||
      historialPlanSeleccionado.some((item) => item.id === compareBId);
    if (!hasB) {
      setCompareBId("__current__");
    }
  }, [compareAId, compareBId, historialPlanSeleccionado, selectedOwnerKey]);

  const getSemanasByComparisonId = (id: string): SemanaPlan[] | null => {
    if (!planSeleccionado) return null;
    if (id === "__current__") return planSeleccionado.semanas;

    const historyItem = historialPlanSeleccionado.find((item) => item.id === id);
    return historyItem ? historyItem.semanas : null;
  };

  const buildStats = (semanas: SemanaPlan[]) => {
    const totalDias = semanas.reduce((acc, semana) => acc + semana.dias.length, 0);
    const diasConSesion = semanas.reduce(
      (acc, semana) =>
        acc + semana.dias.filter((dia) => Boolean((dia.sesionId || "").trim())).length,
      0
    );

    let totalBloques = 0;
    let totalEjercicios = 0;

    for (const semana of semanas) {
      for (const dia of semana.dias) {
        const linked = getEffectiveLinkedSession(dia.sesionId);
        if (!linked) continue;
        const bloques = linked.bloques;
        totalBloques += bloques.length;
        totalEjercicios += bloques.reduce(
          (acc, bloque) => acc + (bloque.ejercicios || []).length,
          0
        );
      }
    }

    return {
      totalSemanas: semanas.length,
      totalDias,
      diasConSesion,
      totalBloques,
      totalEjercicios,
    };
  };

  const comparacion = useMemo(() => {
    if (!compareAId) {
      return null;
    }

    const semanasA = getSemanasByComparisonId(compareAId);
    const semanasB = getSemanasByComparisonId(compareBId);
    if (!semanasA || !semanasB) {
      return null;
    }

    const normalA = normalizeSemanasForCompare(semanasA);
    const normalB = normalizeSemanasForCompare(semanasB);
    const iguales = JSON.stringify(normalA) === JSON.stringify(normalB);

    const maxLen = Math.max(normalA.length, normalB.length);
    const semanasConCambios: string[] = [];

    for (let i = 0; i < maxLen; i++) {
      const weekA = normalA[i];
      const weekB = normalB[i];
      if (JSON.stringify(weekA || null) !== JSON.stringify(weekB || null)) {
        semanasConCambios.push(weekA?.nombre || weekB?.nombre || `Semana ${i + 1}`);
      }
    }

    return {
      iguales,
      semanasConCambios,
      statsA: buildStats(semanasA),
      statsB: buildStats(semanasB),
    };
  }, [compareAId, compareBId, historialPlanSeleccionado, personaSeleccionada, planSeleccionado, sesionesById]);

  const insightsUnicos = useMemo(() => {
    if (!planSeleccionado) {
      return null;
    }

    const semanas = planSeleccionado.semanas;
    const totalDias = semanas.reduce((acc, semana) => acc + semana.dias.length, 0);
    const diasConSesion = semanas.reduce(
      (acc, semana) => acc + semana.dias.filter((dia) => Boolean(dia.sesionId)).length,
      0
    );

    const sesionesIds = semanas.flatMap((semana) =>
      semana.dias.map((dia) => dia.sesionId).filter((value): value is string => Boolean(value))
    );
    const sesionesUnicas = new Set(sesionesIds).size;

    let totalEjercicios = 0;
    let totalBloques = 0;

    for (const semana of semanas) {
      for (const dia of semana.dias) {
        const linked = getEffectiveLinkedSession(dia.sesionId);
        if (!linked) continue;
        const bloques = linked.bloques;
        totalBloques += bloques.length;
        totalEjercicios += bloques.reduce(
          (acc, bloque) => acc + (bloque.ejercicios || []).length,
          0
        );
      }
    }

    const densidad = diasConSesion > 0 ? totalEjercicios / diasConSesion : 0;
    const variedad = diasConSesion > 0 ? sesionesUnicas / diasConSesion : 0;

    const microcycleScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(35 + diasConSesion * 6 + variedad * 28 + Math.min(densidad, 8) * 4)
      )
    );

    const fingerprint = hashPlanFingerprint(
      JSON.stringify(normalizeSemanasForCompare(semanas))
    );

    const sugerencias: string[] = [];
    const acciones: SuggestionAction[] = [];
    if (diasConSesion < totalDias - 1) {
      sugerencias.push("Sube 1 dia con sesion para mejorar continuidad del microciclo.");
      if (sesionesDisponibles.length > 0) {
        acciones.push({
          id: "fill-free-day",
          title: "Completar dia libre",
          detail: "Asigna la sesion mas compatible segun objetivo semanal y repeticiones actuales.",
        });
      }
    }
    if (variedad < 0.55) {
      sugerencias.push("Hay monotonia alta: rota sesiones o bloques entre dias similares.");
      if (sesionesDisponibles.length > 1) {
        acciones.push({
          id: "diversify-session",
          title: "Diversificar carga",
          detail: "Detecta la repeticion mas debil y la cambia por una alternativa mejor puntuada.",
        });
      }
    }
    if (densidad > 10) {
      sugerencias.push("Densidad elevada: reduce ejercicios por dia o agrega pausas de descarga.");
      acciones.push({
        id: "add-recovery-day",
        title: "Agregar dia de descarga",
        detail: "Inserta una descarga estrategica en la semana con mayor carga acumulada.",
      });
    }
    if (sugerencias.length === 0) {
      sugerencias.push("Plan equilibrado: mantén esta estructura y controla wellness semanal.");
    }

    return {
      totalDias,
      diasConSesion,
      totalBloques,
      totalEjercicios,
      densidad: densidad.toFixed(1),
      variedad: (variedad * 100).toFixed(0),
      microcycleScore,
      fingerprint,
      sugerencias,
      acciones,
    };
  }, [personaSeleccionada, planSeleccionado, sesionesById, sesionesDisponibles]);

  const formatHistoryDate = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleString("es-AR");
    } catch {
      return isoDate;
    }
  };

  const applySuggestion = (actionId: SuggestionAction["id"]) => {
    if (!planSeleccionado || !personaSeleccionada) {
      notifyError("Selecciona una persona antes de aplicar una sugerencia");
      return;
    }

    setStore((prev) => {
      if (!isSemanaStoreV3(prev)) {
        return prev;
      }

      let changed = false;

      const nextPlanes = prev.planes.map((plan) => {
        if (plan.ownerKey !== selectedOwnerKey) {
          return plan;
        }

        const currentWeeks = plan.semanas;
        let nextWeeks = currentWeeks;
        const usage = buildSessionUsageMap(currentWeeks);

        if (actionId === "fill-free-day") {
          const freeDayCandidates = currentWeeks.flatMap((semana) =>
            semana.dias
              .filter((dia) => !dia.sesionId)
              .map((dia) => {
                const objectiveText = [dia.objetivo || "", semana.objetivo, dia.dia].join(" ");
                const bestSession = sesionesDisponibles
                  .map((session) => ({
                    session,
                    score: scoreSessionCandidate({
                      session,
                      objectiveText,
                      usageCount: usage.get(session.id) || 0,
                      preferUnused: true,
                    }),
                  }))
                  .sort((left, right) => right.score - left.score)[0];

                return bestSession
                  ? {
                      semanaId: semana.id,
                      diaId: dia.id,
                      score:
                        bestSession.score +
                        (dia.objetivo ? 4 : 0) +
                        (semana.objetivo.trim() ? 2 : 0),
                      session: bestSession.session,
                    }
                  : null;
              })
              .filter((item): item is NonNullable<typeof item> => Boolean(item))
          );

          const bestTarget = freeDayCandidates.sort((left, right) => right.score - left.score)[0];
          if (!bestTarget) {
            return plan;
          }

          nextWeeks = currentWeeks.map((semana) => {
            const dias = semana.dias.map((dia) => {
              if (semana.id !== bestTarget.semanaId || dia.id !== bestTarget.diaId) {
                return dia;
              }
              changed = true;
              return {
                ...dia,
                sesionId: bestTarget.session.id,
                planificacion: bestTarget.session.titulo,
                objetivo: dia.objetivo || bestTarget.session.objetivo || semana.objetivo || "",
              };
            });
            return { ...semana, dias };
          });
        }

        if (actionId === "diversify-session") {
          const repeatedId = Array.from(usage.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
          const repeatedUsage = repeatedId ? usage.get(repeatedId) || 0 : 0;
          const repeatedSession = repeatedId ? sesionesById.get(repeatedId) : undefined;

          if (!repeatedId || repeatedUsage < 2 || !repeatedSession) {
            return plan;
          }

          const repeatedTags = Array.from(getSessionProfile(repeatedSession).tags);
          const replacementCandidates = currentWeeks.flatMap((semana) =>
            semana.dias
              .filter((dia) => dia.sesionId === repeatedId)
              .map((dia) => {
                const objectiveText = [dia.objetivo || "", semana.objetivo, dia.dia].join(" ");
                const bestReplacement = sesionesDisponibles
                  .filter((session) => session.id !== repeatedId)
                  .map((session) => ({
                    session,
                    score: scoreSessionCandidate({
                      session,
                      objectiveText,
                      usageCount: usage.get(session.id) || 0,
                      excludeSessionId: repeatedId,
                      preferUnused: true,
                      avoidTags: repeatedTags,
                    }),
                  }))
                  .sort((left, right) => right.score - left.score)[0];

                return bestReplacement
                  ? {
                      semanaId: semana.id,
                      diaId: dia.id,
                      session: bestReplacement.session,
                      score: bestReplacement.score,
                    }
                  : null;
              })
              .filter((item): item is NonNullable<typeof item> => Boolean(item))
          );

          const bestSwap = replacementCandidates.sort((left, right) => right.score - left.score)[0];
          if (!bestSwap) {
            return plan;
          }

          nextWeeks = currentWeeks.map((semana) => ({
            ...semana,
            dias: semana.dias.map((dia) => {
              if (semana.id !== bestSwap.semanaId || dia.id !== bestSwap.diaId) {
                return dia;
              }
              changed = true;
              return {
                ...dia,
                sesionId: bestSwap.session.id,
                planificacion: bestSwap.session.titulo,
                objetivo: dia.objetivo || bestSwap.session.objetivo || semana.objetivo || "",
              };
            }),
          }));
        }

        if (actionId === "add-recovery-day") {
          const busiestWeek = currentWeeks
            .map((semana, index) => {
              const totalWeekExercises = semana.dias.reduce((acc, dia) => {
                if (!dia.sesionId) return acc;
                const linkedSession = sesionesById.get(dia.sesionId);
                return acc + (linkedSession ? getSessionExerciseCount(linkedSession) : 0);
              }, 0);

              return { semana, index, totalWeekExercises };
            })
            .sort((left, right) => right.totalWeekExercises - left.totalWeekExercises)[0];

          if (!busiestWeek) {
            return plan;
          }

          const alreadyHasRecovery = busiestWeek.semana.dias.some((dia) =>
            `${dia.dia} ${dia.planificacion} ${dia.objetivo || ""}`.toLowerCase().includes("recuper")
          );

          if (alreadyHasRecovery) {
            return plan;
          }

          const getDayLoad = (dia: DiaPlan) => {
            if (!dia.sesionId) return -1;
            const linkedSession = sesionesById.get(dia.sesionId);
            return linkedSession ? getSessionExerciseCount(linkedSession) : -1;
          };

          const anchorIndex = busiestWeek.semana.dias.reduce(
            (bestIndex, dia, currentIndex, dias) =>
              getDayLoad(dia) > getDayLoad(dias[bestIndex]) ? currentIndex : bestIndex,
            0
          );

          changed = true;
          nextWeeks = currentWeeks.map((semana, index) =>
            index === busiestWeek.index
              ? {
                  ...semana,
                  dias: [
                    ...semana.dias.slice(0, anchorIndex + 1),
                    {
                      id: createId(),
                      dia: "Recuperacion estrategica",
                      planificacion: "Movilidad, descarga neural y respiracion guiada",
                      objetivo: "Bajar fatiga acumulada y consolidar adaptaciones del bloque mas exigente",
                      sesionId: "",
                    },
                    ...semana.dias.slice(anchorIndex + 1),
                  ],
                }
              : semana
          );
        }

        if (!changed) {
          return plan;
        }

        const snapshot: PlanHistoryItem = {
          id: createId(),
          createdAt: new Date().toISOString(),
          etiqueta: `Auto respaldo antes de ${actionId}`,
          semanas: cloneSemanas(currentWeeks),
        };

        return {
          ...plan,
          semanas: nextWeeks,
          historial: [snapshot, ...(plan.historial || [])].slice(0, 30),
        };
      });

      if (!changed) {
        queueMicrotask(() => notifyWarning("No hubo cambios para aplicar con esa sugerencia"));
        return prev;
      }

      queueMicrotask(() => notifySuccess("Sugerencia aplicada y respaldo guardado"));
      return {
        ...prev,
        planes: nextPlanes,
      };
    });
  };

  const templateDraftExists = useMemo(
    () => storeV3.templates.some((template) => template.id === templateDraft.id),
    [storeV3.templates, templateDraft.id]
  );

  useEffect(() => {
    if (!selectedTemplateId) return;
    const exists = storeV3.templates.some((template) => template.id === selectedTemplateId);
    if (!exists) {
      setSelectedTemplateId("");
    }
  }, [selectedTemplateId, storeV3.templates]);

  useEffect(() => {
    if (templatesTab !== "mis") return;
    if (templatesFiltrados.length === 0) return;

    const exists = templatesFiltrados.some((template) => template.id === selectedTemplateId);
    if (!exists) {
      setSelectedTemplateId(templatesFiltrados[0].id);
    }
  }, [selectedTemplateId, templatesFiltrados, templatesTab]);

  useEffect(() => {
    const weeks = selectedTemplate?.semanas || [];

    if (weeks.length === 0) {
      if (templatePreviewWeekId) {
        setTemplatePreviewWeekId("");
      }
      if (templatePreviewDayId) {
        setTemplatePreviewDayId("");
      }
      return;
    }

    const week = weeks.find((item) => item.id === templatePreviewWeekId) || weeks[0];
    if (week.id !== templatePreviewWeekId) {
      setTemplatePreviewWeekId(week.id);
    }

    const days = week.dias || [];
    if (days.length === 0) {
      if (templatePreviewDayId) {
        setTemplatePreviewDayId("");
      }
      return;
    }

    const day = days.find((item) => item.id === templatePreviewDayId) || days[0];
    if (day.id !== templatePreviewDayId) {
      setTemplatePreviewDayId(day.id);
    }
  }, [selectedTemplate, templatePreviewDayId, templatePreviewWeekId]);

  useEffect(() => {
    if (templateDraft.semanas.length === 0) {
      setTemplateDraft((prev) => ({ ...prev, semanas: [createTemplateWeek(0)] }));
    }
  }, [templateDraft.semanas.length]);

  useEffect(() => {
    if (templateDraft.semanas.length === 0) {
      if (templateDraftWeekId) {
        setTemplateDraftWeekId("");
      }
      return;
    }

    const exists = templateDraft.semanas.some((week) => week.id === templateDraftWeekId);
    if (!exists) {
      setTemplateDraftWeekId(templateDraft.semanas[0].id);
    }
  }, [templateDraft.semanas, templateDraftWeekId]);

  useEffect(() => {
    const days = templateDraftWeek?.dias || [];

    if (days.length === 0) {
      if (templateDraftDayId) {
        setTemplateDraftDayId("");
      }
      return;
    }

    const exists = days.some((day) => day.id === templateDraftDayId);
    if (!exists) {
      setTemplateDraftDayId(days[0].id);
    }
  }, [templateDraftDayId, templateDraftWeek]);

  const seleccionarPersona = (persona: PersonaItem) => {
    const key = toOwnerKey(persona);
    setSelectedOwnerKey(key);
    setStore((prev) => (isSemanaStoreV3(prev) ? ensurePlanForPersona(prev, persona) : prev));
  };

  const actualizarSemanasSeleccionadas = (
    updater: (semanasActuales: SemanaPlan[]) => SemanaPlan[]
  ) => {
    if (!selectedOwnerKey) return;

    markManualSaveIntent(STORAGE_KEY);

    setStore((prev) => {
      if (!isSemanaStoreV3(prev)) return prev;

      return {
        ...prev,
        planes: prev.planes.map((plan) =>
          plan.ownerKey === selectedOwnerKey
            ? { ...plan, semanas: updater(plan.semanas) }
            : plan
        ),
      };
    });
  };

  const actualizarSemana = (semanaId: string, changes: Partial<SemanaPlan>) => {
    actualizarSemanasSeleccionadas((semanas) =>
      semanas.map((semana) => (semana.id === semanaId ? { ...semana, ...changes } : semana))
    );
  };

  const eliminarSemana = (semanaId: string) => {
    actualizarSemanasSeleccionadas((semanas) => semanas.filter((semana) => semana.id !== semanaId));
    notifySuccess();
  };

  const agregarSemana = () => {
    actualizarSemanasSeleccionadas((semanas) => [
      ...semanas,
      {
        id: createId(),
        nombre: `Semana ${semanas.length + 1}`,
        objetivo: "Objetivo de la semana",
        dias: getSemanaBaseDias(),
      },
    ]);
    notifySuccess();
  };

  const duplicarSemana = (semanaId: string) => {
    actualizarSemanasSeleccionadas((semanas) => {
      const index = semanas.findIndex((semana) => semana.id === semanaId);
      if (index === -1) return semanas;

      const original = semanas[index];
      const copia: SemanaPlan = {
        ...original,
        id: createId(),
        nombre: `${original.nombre} (copia)`,
        dias: original.dias.map((dia) => ({
          ...dia,
          id: createId(),
        })),
      };

      const next = [...semanas];
      next.splice(index + 1, 0, copia);
      return next;
    });
    notifySuccess();
  };

  const actualizarDia = (
    semanaId: string,
    diaId: string,
    key: "dia" | "planificacion" | "objetivo" | "sesionId",
    value: string
  ) => {
    actualizarSemanasSeleccionadas((semanas) =>
      semanas.map((semana) => {
        if (semana.id !== semanaId) return semana;

        return {
          ...semana,
          dias: semana.dias.map((dia) => (dia.id === diaId ? { ...dia, [key]: value } : dia)),
        };
      })
    );
  };

  const vincularSesionDia = (
    semanaId: string,
    diaId: string,
    sesionId: string,
    replaceTexts: boolean
  ) => {
    actualizarSemanasSeleccionadas((semanas) =>
      semanas.map((semana) => {
        if (semana.id !== semanaId) return semana;

        return {
          ...semana,
          dias: semana.dias.map((dia) => {
            if (dia.id !== diaId) return dia;

            if (!sesionId) {
              return { ...dia, sesionId: "" };
            }

            const sesion = sesionesById.get(sesionId);
            if (!sesion) {
              return { ...dia, sesionId };
            }

            if (!replaceTexts) {
              return {
                ...dia,
                sesionId,
              };
            }

            const prescripcion = getLatestPersonaPrescription(sesion);
            const objetivoAuto = prescripcion
              ? `${AUTO_OBJECTIVE_PREFIX} ${prescripcion.resumen}`
              : sesion.objetivo || "";

            return {
              ...dia,
              sesionId,
              planificacion: sesion.titulo,
              objetivo: objetivoAuto,
            };
          }),
        };
      })
    );
  };

  const eliminarDia = (semanaId: string, diaId: string) => {
    actualizarSemanasSeleccionadas((semanas) =>
      semanas.map((semana) =>
        semana.id === semanaId
          ? { ...semana, dias: semana.dias.filter((dia) => dia.id !== diaId) }
          : semana
      )
    );
    notifySuccess();
  };

  const agregarDia = (semanaId: string) => {
    const dia = (nuevoDiaPorSemana[semanaId] || "").trim();
    const planificacion = (nuevaPlanPorSemana[semanaId] || "").trim();
    if (!dia || !planificacion) return;

    actualizarSemanasSeleccionadas((semanas) =>
      semanas.map((semana) =>
        semana.id === semanaId
          ? {
              ...semana,
              dias: [...semana.dias, { id: createId(), dia, planificacion, objetivo: "" }],
            }
          : semana
      )
    );

    setNuevoDiaPorSemana((prev) => ({ ...prev, [semanaId]: "" }));
    setNuevaPlanPorSemana((prev) => ({ ...prev, [semanaId]: "" }));
    notifySuccess();
  };

  const resetearPlanSeleccionado = () => {
    actualizarSemanasSeleccionadas(() => getSemanaBase());
    setNuevoDiaPorSemana({});
    setNuevaPlanPorSemana({});
    notifySuccess();
  };

  const withTemplateDraftUpdate = (updater: (current: PlanTemplate) => PlanTemplate) => {
    setTemplateDraft((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }));
  };

  const iniciarNuevoTemplate = () => {
    const personaTipo = personaSeleccionada?.tipo || tipoFiltro;
    const categoria =
      personaTipo === "jugadoras" ? personaSeleccionada?.categoria || undefined : undefined;
    const nextDraft = createTemplateDraft(personaTipo, categoria);

    setTemplateDraft(nextDraft);
    setTemplateDraftWeekId(nextDraft.semanas[0]?.id || "");
    setTemplateDraftDayId(nextDraft.semanas[0]?.dias[0]?.id || "");
    setTemplateTagInput("");
    setTemplateFeedbackInput("");
    setTemplateMenuOpen(false);
    setFeedbackConfigOpen(false);
    setBlockMenuOpenId(null);
    setBlockGridConfigOpenId(null);
    setBlockTitleEdit(null);
    setTemplatesTab("nuevo");
  };

  const editarTemplate = (templateId: string) => {
    const template = storeV3.templates.find((item) => item.id === templateId);
    if (!template) {
      notifyError("No se encontro el template seleccionado");
      return;
    }

    const clone: PlanTemplate = {
      ...template,
      etiquetas: [...(template.etiquetas || [])],
      feedbackQuestions: [...(template.feedbackQuestions || [])],
      semanas: cloneSemanas(template.semanas),
    };

    setTemplateDraft(clone);
    setTemplateDraftWeekId(clone.semanas[0]?.id || "");
    setTemplateDraftDayId(clone.semanas[0]?.dias[0]?.id || "");
    setSelectedTemplateId(template.id);
    setTemplateMenuOpen(false);
    setFeedbackConfigOpen(false);
    setBlockMenuOpenId(null);
    setBlockGridConfigOpenId(null);
    setBlockTitleEdit(null);
    setTemplatesTab("nuevo");
  };

  const actualizarTemplateMeta = (changes: Partial<PlanTemplate>) => {
    withTemplateDraftUpdate((current) => ({ ...current, ...changes }));
  };

  const agregarTemplateTag = () => {
    const tag = templateTagInput.trim();
    if (!tag) return;

    withTemplateDraftUpdate((current) => {
      const nextTags = Array.from(new Set([...(current.etiquetas || []), tag]));
      return { ...current, etiquetas: nextTags };
    });
    setTemplateTagInput("");
  };

  const eliminarTemplateTag = (tag: string) => {
    withTemplateDraftUpdate((current) => ({
      ...current,
      etiquetas: (current.etiquetas || []).filter((item) => item !== tag),
    }));
  };

  const actualizarTemplateSemanas = (
    updater: (currentWeeks: SemanaPlan[]) => SemanaPlan[]
  ) => {
    withTemplateDraftUpdate((current) => ({
      ...current,
      semanas: updater(current.semanas),
    }));
  };

  const agregarSemanaTemplate = () => {
    actualizarTemplateSemanas((weeks) => [...weeks, createTemplateWeek(weeks.length)]);
  };

  const eliminarSemanaTemplate = (weekId: string) => {
    actualizarTemplateSemanas((weeks) => {
      const remaining = weeks.filter((week) => week.id !== weekId);
      return remaining.length > 0 ? remaining : [createTemplateWeek(0)];
    });
  };

  const actualizarSemanaTemplate = (weekId: string, changes: Partial<SemanaPlan>) => {
    actualizarTemplateSemanas((weeks) =>
      weeks.map((week) => (week.id === weekId ? { ...week, ...changes } : week))
    );
  };

  const agregarDiaTemplate = (weekId: string) => {
    actualizarTemplateSemanas((weeks) =>
      weeks.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          dias: [...week.dias, createTemplateDay(week.dias.length)],
        };
      })
    );
  };

  const eliminarDiaTemplate = (weekId: string, dayId: string) => {
    actualizarTemplateSemanas((weeks) =>
      weeks.map((week) => {
        if (week.id !== weekId) return week;
        const remainingDays = week.dias.filter((day) => day.id !== dayId);
        return {
          ...week,
          dias: remainingDays.length > 0 ? remainingDays : [createTemplateDay(0)],
        };
      })
    );
  };

  const actualizarDiaTemplate = (
    weekId: string,
    dayId: string,
    key: "dia" | "planificacion" | "objetivo",
    value: string
  ) => {
    actualizarTemplateSemanas((weeks) =>
      weeks.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          dias: week.dias.map((day) =>
            day.id === dayId ? { ...day, [key]: value } : day
          ),
        };
      })
    );
  };

  const actualizarEntrenamientoDiaTemplate = (
    weekId: string,
    dayId: string,
    updater: (training: TemplateDayTraining) => TemplateDayTraining
  ) => {
    actualizarTemplateSemanas((weeks) =>
      weeks.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          dias: week.dias.map((day) => {
            if (day.id !== dayId) return day;
            const linkedTraining = buildTemplateTrainingFromLinkedSession(
              getEffectiveLinkedSession(day.sesionId)
            );
            const currentTraining =
              day.entrenamiento || linkedTraining || createTemplateDayTraining();
            return {
              ...day,
              entrenamiento: updater(currentTraining),
            };
          }),
        };
      })
    );
  };

  const agregarBloqueTemplate = (weekId: string, dayId: string) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: [...training.bloques, createTemplateBlock(training.bloques.length)],
    }));
  };

  const eliminarBloqueTemplate = (weekId: string, dayId: string, blockId: string) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => {
      const remaining = training.bloques.filter((block) => block.id !== blockId);
      return {
        ...training,
        bloques: remaining.length > 0 ? remaining : [createTemplateBlock(0)],
      };
    });
  };

  const duplicarBloqueTemplate = (weekId: string, dayId: string, blockId: string) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => {
      const blockIndex = training.bloques.findIndex((block) => block.id === blockId);
      if (blockIndex < 0) {
        return training;
      }

      const source = training.bloques[blockIndex];
      const duplicatedBlock: TemplateBlockDraft = {
        ...source,
        id: createId(),
        titulo: `${String(source.titulo || `Bloque ${blockIndex + 1}`).trim()} copia`,
        objetivo: String(source.objetivo || ""),
        ejercicios: (source.ejercicios || []).map((exercise) => ({
          ...exercise,
          id: createId(),
          especificaciones: (exercise.especificaciones || []).map((spec) => ({
            ...spec,
            id: createId(),
          })),
          serieDesglose: (exercise.serieDesglose || []).map((setDraft, setIndex) => ({
            ...setDraft,
            id: createId(),
            serie: Number.isFinite(Number(setDraft.serie)) ? Number(setDraft.serie) : setIndex + 1,
          })),
          superSerie: (exercise.superSerie || []).map((superExercise) => ({
            ...superExercise,
            id: createId(),
          })),
        })),
      };

      const bloques = [...training.bloques];
      bloques.splice(blockIndex + 1, 0, duplicatedBlock);

      return {
        ...training,
        bloques,
      };
    });
  };

  const actualizarBloqueTemplate = (
    weekId: string,
    dayId: string,
    blockId: string,
    key: "titulo" | "objetivo",
    value: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) =>
        block.id === blockId ? { ...block, [key]: value } : block
      ),
    }));
  };

  const confirmarEdicionNombreBloque = (weekId: string, dayId: string, blockId: string) => {
    const nextTitle = (blockTitleEdit?.value || "").trim();
    if (!nextTitle) {
      notifyWarning("El nombre del bloque no puede estar vacio");
      return;
    }

    actualizarBloqueTemplate(weekId, dayId, blockId, "titulo", nextTitle);
    setBlockTitleEdit(null);
  };

  const agregarEjercicioTemplate = (weekId: string, dayId: string, blockId: string) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) =>
        block.id === blockId
          ? {
              ...block,
              ejercicios: [
                ...block.ejercicios,
                {
                  ...createTemplateExercise(),
                  especificaciones: (block.ejercicios[0]?.especificaciones || []).map((spec) => ({
                    ...createTemplateSpec(),
                    nombre: spec.nombre,
                    valor: "",
                  })),
                },
              ],
            }
          : block
      ),
    }));
  };

  const eliminarEjercicioTemplate = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        const remaining = block.ejercicios.filter((exercise) => exercise.id !== exerciseId);
        return {
          ...block,
          ejercicios: remaining.length > 0 ? remaining : [createTemplateExercise()],
        };
      }),
    }));
  };

  const actualizarEjercicioTemplate = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    key: "ejercicioId" | "series" | "repeticiones" | "descanso" | "carga",
    value: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) =>
            exercise.id === exerciseId ? { ...exercise, [key]: value } : exercise
          ),
        };
      }),
    }));
  };

  const agregarEspecificacionEjercicio = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  especificaciones: [...exercise.especificaciones, createTemplateSpec()],
                }
              : exercise
          ),
        };
      }),
    }));
  };

  const actualizarEspecificacionEjercicio = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    specId: string,
    key: "nombre" | "valor",
    value: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            return {
              ...exercise,
              especificaciones: exercise.especificaciones.map((spec) =>
                spec.id === specId ? { ...spec, [key]: value } : spec
              ),
            };
          }),
        };
      }),
    }));
  };

  const eliminarEspecificacionEjercicio = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    specId: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  especificaciones: exercise.especificaciones.filter((spec) => spec.id !== specId),
                }
              : exercise
          ),
        };
      }),
    }));
  };

  const getTemplateSpecValue = (exercise: TemplateExerciseDraft, token: string) => {
    const normalizedToken = String(token || "").trim().toLowerCase();
    if (!normalizedToken) {
      return "";
    }

    const specs = exercise.especificaciones || [];
    const exactMatch = specs.find(
      (spec) => String(spec.nombre || "").trim().toLowerCase() === normalizedToken
    );
    if (exactMatch) {
      return exactMatch.valor || "";
    }

    const includesMatch = specs.find((spec) =>
      String(spec.nombre || "").trim().toLowerCase().includes(normalizedToken)
    );
    return includesMatch?.valor || "";
  };

  const upsertTemplateSpecValue = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    specName: string,
    value: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;

            const specs = [...(exercise.especificaciones || [])];
            const existingIndex = specs.findIndex(
              (spec) => String(spec.nombre || "").toLowerCase() === specName.toLowerCase()
            );

            if (existingIndex >= 0) {
              specs[existingIndex] = {
                ...specs[existingIndex],
                valor: value,
              };
            } else {
              specs.push({
                ...createTemplateSpec(),
                nombre: specName,
                valor: value,
              });
            }

            return {
              ...exercise,
              especificaciones: specs,
            };
          }),
        };
      }),
    }));
  };

  const agregarColumnaGrillaBloque = (weekId: string, dayId: string, blockId: string) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        const nextIndex = (block.ejercicios[0]?.especificaciones.length || 0) + 1;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => ({
            ...exercise,
            especificaciones: [
              ...exercise.especificaciones,
              {
                ...createTemplateSpec(),
                nombre: `Campo ${nextIndex}`,
              },
            ],
          })),
        };
      }),
    }));
  };

  const actualizarNombreColumnaGrillaBloque = (
    weekId: string,
    dayId: string,
    blockId: string,
    specIndex: number,
    value: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => {
            const nextSpecs = [...exercise.especificaciones];
            if (!nextSpecs[specIndex]) {
              nextSpecs[specIndex] = createTemplateSpec();
            }
            nextSpecs[specIndex] = {
              ...nextSpecs[specIndex],
              nombre: value,
            };
            return {
              ...exercise,
              especificaciones: nextSpecs,
            };
          }),
        };
      }),
    }));
  };

  const eliminarColumnaGrillaBloque = (
    weekId: string,
    dayId: string,
    blockId: string,
    specIndex: number
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => ({
            ...exercise,
            especificaciones: exercise.especificaciones.filter((_, idx) => idx !== specIndex),
          })),
        };
      }),
    }));
  };

  const getTemplateExerciseLabel = (exerciseId: string) => {
    if (!exerciseId) return "Seleccione ejercicio";
    return getExerciseName(exerciseId);
  };

  const getTemplateExerciseQuery = (exercise: TemplateExerciseDraft) => {
    return exerciseSelectorQuery[exercise.id] ?? getTemplateExerciseLabel(exercise.ejercicioId);
  };

  const updateTemplateExerciseQuery = (exerciseRowId: string, value: string) => {
    setExerciseSelectorQuery((prev) => ({
      ...prev,
      [exerciseRowId]: value,
    }));
  };

  const getTemplateExerciseCandidates = (exerciseRowId: string) => {
    const query = (exerciseSelectorQuery[exerciseRowId] || "").trim().toLowerCase();
    const base = ejercicios.slice();

    const sorted = base.sort((left, right) => {
      const leftHasVideo = Boolean((left.videoUrl || "").trim());
      const rightHasVideo = Boolean((right.videoUrl || "").trim());
      if (leftHasVideo !== rightHasVideo) {
        return leftHasVideo ? -1 : 1;
      }
      return left.nombre.localeCompare(right.nombre, "es");
    });

    if (!query) {
      return sorted.slice(0, 8);
    }

    return sorted
      .filter((item) => {
        const text = `${item.nombre} ${item.categoria || ""} ${item.descripcion || ""}`.toLowerCase();
        return text.includes(query);
      })
      .slice(0, 8);
  };

  const seleccionarEjercicioTemplateDesdePicker = (
    blockId: string,
    exerciseId: string,
    selectedExerciseId: string
  ) => {
    if (!templateScopeWeekId || !templateScopeDayId) {
      notifyWarning("No hay una estructura activa para editar");
      return;
    }

    actualizarEjercicioTemplate(
      templateScopeWeekId,
      templateScopeDayId,
      blockId,
      exerciseId,
      "ejercicioId",
      selectedExerciseId
    );

    const selected = ejercicios.find((item) => item.id === selectedExerciseId);
    setExerciseSelectorQuery((prev) => ({
      ...prev,
      [exerciseId]: selected ? selected.nombre : "",
    }));
    setExerciseSelectorOpenId(null);
  };

  const toggleDesgloseSeriesTemplate = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;

            if ((exercise.serieDesglose || []).length > 0) {
              return {
                ...exercise,
                serieDesglose: [],
              };
            }

            const totalSeries = parseSeriesCount(exercise.series);
            const nextBreakdown = Array.from({ length: totalSeries }, (_, index) =>
              createTemplateSetDraft(index + 1)
            );

            return {
              ...exercise,
              serieDesglose: nextBreakdown,
            };
          }),
        };
      }),
    }));
  };

  const actualizarSerieDesgloseTemplate = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    setId: string,
    key: "repeticiones" | "cargaKg" | "rir" | "descanso" | "observaciones",
    value: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            return {
              ...exercise,
              serieDesglose: (exercise.serieDesglose || []).map((setRow) =>
                setRow.id === setId ? { ...setRow, [key]: value } : setRow
              ),
            };
          }),
        };
      }),
    }));
  };

  const agregarSuperSerieTemplate = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;

            const nextSuperItem = createTemplateSuperSerieDraft({
              series: exercise.series,
              repeticiones: exercise.repeticiones,
              descanso: exercise.descanso,
              carga: exercise.carga,
            });

            return {
              ...exercise,
              superSerie: [...(exercise.superSerie || []), nextSuperItem],
            };
          }),
        };
      }),
    }));
  };

  const actualizarSuperSerieTemplate = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    superId: string,
    key: "ejercicioId" | "series" | "repeticiones" | "descanso" | "carga",
    value: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            return {
              ...exercise,
              superSerie: (exercise.superSerie || []).map((row) =>
                row.id === superId ? { ...row, [key]: value } : row
              ),
            };
          }),
        };
      }),
    }));
  };

  const eliminarSuperSerieTemplate = (
    weekId: string,
    dayId: string,
    blockId: string,
    exerciseId: string,
    superId: string
  ) => {
    actualizarEntrenamientoDiaTemplate(weekId, dayId, (training) => ({
      ...training,
      bloques: training.bloques.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          ejercicios: block.ejercicios.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            return {
              ...exercise,
              superSerie: (exercise.superSerie || []).filter((row) => row.id !== superId),
            };
          }),
        };
      }),
    }));
  };

  const abrirVerPesos = (
    blockId: string,
    blockTitulo: string,
    exerciseId: string,
    exerciseNombre: string
  ) => {
    setWeightViewer({ blockId, blockTitulo, exerciseId, exerciseNombre });
  };

  const abrirRegistrarPeso = (
    blockId: string,
    blockTitulo: string,
    exerciseId: string,
    exerciseNombre: string
  ) => {
    setWeightRegister({ blockId, blockTitulo, exerciseId, exerciseNombre });
    setWeightRegisterScope("template");
    setWeightForm({
      fecha: new Date().toISOString().slice(0, 10),
      nroSerie: "1",
      nroRep: "0",
      pesoKg: "0",
      molestia: false,
      comentario: "",
    });
  };

  const eliminarTemplatePeso = (logId: string) => {
    setTemplateWeightLogs((prev) => prev.filter((row) => row.id !== logId));
  };

  const guardarRegistroPeso = () => {
    if (!weightRegister) {
      return;
    }

    const parsedSerie = Math.max(1, Math.round(Number(weightForm.nroSerie || 0)));
    const parsedRep = Math.max(0, Math.round(Number(weightForm.nroRep || 0)));
    const parsedPeso = Math.max(0, Number(weightForm.pesoKg || 0));

    if (!Number.isFinite(parsedSerie) || !Number.isFinite(parsedRep) || !Number.isFinite(parsedPeso)) {
      notifyWarning("Completa serie, repeticiones y peso con valores validos");
      return;
    }

    const now = new Date().toISOString();

    const payload: TemplateWeightLog = {
      id: createId(),
      templateId: templateDraft.id,
      templateNombre: templateDraft.nombre,
      alumnoNombre: alumnoDestinoActivo?.nombre,
      blockId: weightRegister.blockId,
      blockTitulo: weightRegister.blockTitulo,
      exerciseId: weightRegister.exerciseId,
      exerciseNombre: weightRegister.exerciseNombre,
      fecha: weightForm.fecha || new Date().toISOString().slice(0, 10),
      nroSerie: parsedSerie,
      nroRep: parsedRep,
      pesoKg: parsedPeso,
      molestia: weightForm.molestia,
      comentario: weightForm.comentario.trim() || undefined,
      createdAt: now,
    };

    setTemplateWeightLogs((prev) => [payload, ...prev]);

    if (weightRegisterScope === "alumno") {
      if (!alumnoDestinoActivo) {
        notifyWarning("Selecciona un alumno destino para sincronizar al perfil");
      } else {
        const syncPayload: AlumnoWorkoutLogLite = {
          id: createId(),
          alumnoNombre: alumnoDestinoActivo.nombre,
          sessionId: `template:${templateDraft.id}`,
          sessionTitle: templateDraft.nombre || "Template",
          weekId: templateScopeWeekId || undefined,
          weekName: templateScopeWeek?.nombre || undefined,
          dayId: templateScopeDayId || undefined,
          dayName: templateScopeDay?.dia || undefined,
          blockId: weightRegister.blockId,
          blockTitle: weightRegister.blockTitulo,
          exerciseId: weightRegister.exerciseId,
          exerciseName: weightRegister.exerciseNombre,
          exerciseKey: buildTemplateExerciseKey(weightRegister.blockId, weightRegister.exerciseId, 0),
          fecha: weightForm.fecha || new Date().toISOString().slice(0, 10),
          series: parsedSerie,
          repeticiones: parsedRep,
          pesoKg: parsedPeso,
          molestia: weightForm.molestia,
          comentario: weightForm.comentario.trim() || undefined,
          createdAt: now,
        };

        setAlumnoWorkoutLogsRaw((prev) => [syncPayload, ...normalizeAlumnoWorkoutLogs(prev)]);
      }
    }

    setWeightRegister(null);
    notifySuccess("Peso registrado correctamente");
  };

  const agregarFeedbackQuestion = () => {
    const question = templateFeedbackInput.trim();
    if (!question) return;

    withTemplateDraftUpdate((current) => ({
      ...current,
      feedbackQuestions: [...(current.feedbackQuestions || []), question],
    }));
    setTemplateFeedbackInput("");
  };

  const actualizarFeedbackQuestion = (index: number, value: string) => {
    withTemplateDraftUpdate((current) => ({
      ...current,
      feedbackQuestions: (current.feedbackQuestions || []).map((question, idx) =>
        idx === index ? value : question
      ),
    }));
  };

  const eliminarFeedbackQuestion = (index: number) => {
    withTemplateDraftUpdate((current) => ({
      ...current,
      feedbackQuestions: (current.feedbackQuestions || []).filter((_, idx) => idx !== index),
    }));
  };

  const guardarTemplateActual = () => {
    const nombre = templateDraft.nombre.trim();
    if (!nombre) {
      notifyWarning("Define un nombre para guardar el template");
      return;
    }

    const now = new Date().toISOString();
    const personaTipo = personaSeleccionada?.tipo || templateDraft.tipo;
    const categoria =
      personaTipo === "jugadoras"
        ? personaSeleccionada?.categoria || templateDraft.categoria
        : undefined;

    const baseWeek = templateScopeWeek || createTemplateWeek(0);
    const baseDay = templateScopeDay || createTemplateDay(0);

    const payload: PlanTemplate = {
      ...templateDraft,
      nombre,
      tipo: personaTipo,
      categoria,
      descripcion: (templateDraft.descripcion || "").trim(),
      etiquetas: (templateDraft.etiquetas || []).map((tag) => tag.trim()).filter(Boolean),
      feedbackQuestions: (templateDraft.feedbackQuestions || [])
        .map((question) => question.trim())
        .filter(Boolean),
      createdAt: templateDraft.createdAt || now,
      updatedAt: now,
      semanas: cloneSemanas([
        {
          ...baseWeek,
          nombre: baseWeek.nombre || "Plantilla",
          dias: [
            {
              ...baseDay,
              dia: baseDay.dia || "Entrenamiento",
              planificacion:
                (baseDay.planificacion || "").trim() || baseDay.entrenamiento?.titulo || "",
              objetivo:
                (baseDay.objetivo || "").trim() || baseDay.entrenamiento?.descripcion || "",
            },
          ],
        },
      ]),
    };

    markManualSaveIntent(STORAGE_KEY);
    setStore((prev) => {
      if (!isSemanaStoreV3(prev)) return prev;

      const exists = prev.templates.some((template) => template.id === payload.id);
      if (exists) {
        return {
          ...prev,
          templates: prev.templates.map((template) =>
            template.id === payload.id ? payload : template
          ),
        };
      }

      return {
        ...prev,
        templates: [payload, ...prev.templates],
      };
    });

    setTemplateDraft(payload);
    setSelectedTemplateId(payload.id);
    setTemplatesTab("mis");
    setTemplateMenuOpen(false);
    notifySuccess("Template guardado correctamente");
  };

  const eliminarPlantilla = (templateId?: string) => {
    const id = templateId || selectedTemplateId;
    if (!id) {
      notifyWarning("Selecciona un template para eliminar");
      return;
    }

    if (!window.confirm("Eliminar este template? Esta accion no se puede deshacer.")) {
      notifyWarning("Operacion cancelada");
      return;
    }

    markManualSaveIntent(STORAGE_KEY);
    setStore((prev) => {
      if (!isSemanaStoreV3(prev)) return prev;
      return {
        ...prev,
        templates: prev.templates.filter((template) => template.id !== id),
      };
    });

    if (selectedTemplateId === id) {
      setSelectedTemplateId("");
    }

    if (templateDraft.id === id) {
      iniciarNuevoTemplate();
    }

    notifySuccess("Template eliminado correctamente");
  };

  const asignarTemplateAAlumno = (templateId: string) => {
    const template = storeV3.templates.find((item) => item.id === templateId);
    if (!template) {
      notifyError("No se encontro el template seleccionado");
      return;
    }

    if (!personaSeleccionada || personaSeleccionada.tipo !== "alumnos") {
      notifyWarning("Selecciona un alumno en Persona activa para asignar el template");
      return;
    }

    const ownerKey = toOwnerKey(personaSeleccionada);
    const existingPlan = storeV3.planes.find((plan) => plan.ownerKey === ownerKey);

    if (
      existingPlan &&
      !window.confirm(
        `Esto reemplazara el plan semanal actual de ${personaSeleccionada.nombre}. Continuar?`
      )
    ) {
      notifyWarning("Operacion cancelada");
      return;
    }

    const semanasTemplate = cloneSemanas(template.semanas);
    markManualSaveIntent(STORAGE_KEY);

    setStore((prev) => {
      if (!isSemanaStoreV3(prev)) return prev;

      const planIndex = prev.planes.findIndex((plan) => plan.ownerKey === ownerKey);

      if (planIndex === -1) {
        return {
          ...prev,
          planes: [
            ...prev.planes,
            {
              ownerKey,
              tipo: "alumnos",
              nombre: personaSeleccionada.nombre,
              semanas: semanasTemplate,
              historial: [],
            },
          ],
        };
      }

      return {
        ...prev,
        planes: prev.planes.map((plan, index) => {
          if (index !== planIndex) {
            return plan;
          }

          const snapshot: PlanHistoryItem = {
            id: createId(),
            createdAt: new Date().toISOString(),
            etiqueta: `Respaldo antes de asignar template ${template.nombre}`,
            semanas: cloneSemanas(plan.semanas),
          };

          return {
            ...plan,
            tipo: "alumnos",
            nombre: personaSeleccionada.nombre,
            semanas: semanasTemplate,
            historial: [snapshot, ...(plan.historial || [])].slice(0, 30),
          };
        }),
      };
    });

    setTipoFiltro("alumnos");
    setSelectedOwnerKey(ownerKey);
    notifySuccess(`Template asignado a ${personaSeleccionada.nombre}`);
  };

  const guardarEnHistorial = () => {
    if (!planSeleccionado) return;

    const snapshot: PlanHistoryItem = {
      id: createId(),
      createdAt: new Date().toISOString(),
      etiqueta: historialEtiqueta.trim() || undefined,
      semanas: cloneSemanas(planSeleccionado.semanas),
    };

    setStore((prev) => {
      if (!isSemanaStoreV3(prev)) return prev;
      return {
        ...prev,
        planes: prev.planes.map((plan) => {
          if (plan.ownerKey !== selectedOwnerKey) return plan;
          const historialActual = plan.historial || [];
          return {
            ...plan,
            historial: [snapshot, ...historialActual].slice(0, 30),
          };
        }),
      };
    });

    setHistorialEtiqueta("");
    setCompareAId(snapshot.id);
    setCompareBId("__current__");
    notifySuccess("Version guardada en historial");
  };

  const restaurarDesdeHistorial = () => {
    if (!compareAId) return;
    const snapshot = historialPlanSeleccionado.find((item) => item.id === compareAId);
    if (!snapshot) {
      notifyError("No se encontro la version seleccionada");
      return;
    }

    if (!window.confirm("Restaurar esta version reemplazara el plan actual. Continuar?")) {
      notifyWarning("Operacion cancelada");
      return;
    }

    actualizarSemanasSeleccionadas(() => cloneSemanas(snapshot.semanas));
    notifySuccess("Version restaurada correctamente");
  };

  const toastStyle =
    toast?.kind === "warning"
      ? "border-amber-300/40 bg-amber-500/15"
      : toast?.kind === "error"
      ? "border-rose-300/40 bg-rose-500/15"
      : "border-emerald-300/40 bg-emerald-500/15";

  const toastBadge =
    toast?.kind === "warning"
      ? "[!]"
      : toast?.kind === "error"
      ? "[x]"
      : "[OK]";

  const canEditTemplateTraining = Boolean(templateScopeWeekId && templateScopeDayId);
  const activeTemplateTraining = templateScopeDay?.entrenamiento;
  const activeTemplateBlocks = activeTemplateTraining?.bloques || [];

  const templateWeightLogIds = useMemo(
    () => new Set(templateWeightLogsSorted.map((row) => row.id)),
    [templateWeightLogsSorted]
  );

  const weightRegisterRows = useMemo(() => {
    if (!weightRegister) return [];

    const fromTemplate = templateWeightLogsSorted.filter(
      (row) =>
        row.templateId === templateDraft.id &&
        row.blockId === weightRegister.blockId &&
        row.exerciseId === weightRegister.exerciseId
    );

    const fromAlumno = alumnoWorkoutLogs
      .filter((row) => {
        const matchesAlumno = alumnoDestinoActivo
          ? namesLikelyMatch(row.alumnoNombre, alumnoDestinoActivo.nombre)
          : true;

        return (
          matchesAlumno &&
          row.exerciseId === weightRegister.exerciseId &&
          (!weightRegister.blockId || row.blockId === weightRegister.blockId)
        );
      })
      .map((row) => ({
        id: row.id,
        templateId: templateDraft.id,
        templateNombre: templateDraft.nombre,
        alumnoNombre: row.alumnoNombre,
        blockId: row.blockId || "",
        blockTitulo: row.blockTitle || "",
        exerciseId: row.exerciseId || "",
        exerciseNombre: row.exerciseName || weightRegister.exerciseNombre,
        fecha: row.fecha,
        nroSerie: row.series,
        nroRep: row.repeticiones,
        pesoKg: row.pesoKg,
        molestia: row.molestia,
        comentario: row.comentario,
        createdAt: row.createdAt,
      }));

    return [...fromTemplate, ...fromAlumno]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 80);
  }, [
    alumnoDestinoActivo,
    alumnoWorkoutLogs,
    templateDraft.id,
    templateDraft.nombre,
    templateWeightLogsSorted,
    weightRegister,
  ]);

  return (
    <main className="mx-auto w-full max-w-[1820px] px-4 py-6 text-slate-100 sm:px-6">
      {toast && (
        <div className="pointer-events-none fixed right-4 top-4 z-50 w-full max-w-xs">
          <div
            ref={toastRef}
            className={`rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-200 ease-out ${toastStyle} ${
              toastPhase === "enter"
                ? "translate-y-0 scale-100 opacity-100"
                : "-translate-y-2 scale-95 opacity-0"
            }`}
          >
            <p className="text-sm font-semibold text-white">
              {toastBadge} {toast.message}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Templates de entrenamiento</h1>
          <p className="text-sm text-slate-300">
            Workspace dedicado para crear, editar y asignar templates con bloques armables y ejercicios reutilizables.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap gap-2">
            <ReliableActionButton
              type="button"
              onClick={iniciarNuevoTemplate}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Nuevo template
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              onClick={() => setTemplatesTab("mis")}
              className="rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-100"
            >
              Mis templates
            </ReliableActionButton>
          </div>

          <ReliableActionButton
            type="button"
            onClick={guardarTemplateActual}
            className="w-full rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 sm:w-auto"
          >
            Guardar template
          </ReliableActionButton>
        </div>
      </div>

      <section className="mb-6 rounded-[30px] border border-cyan-300/20 bg-gradient-to-b from-slate-900/88 via-slate-900/64 to-slate-950/80 px-5 py-6 shadow-[0_26px_72px_-42px_rgba(34,211,238,0.52)] sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">
              Panel integral
            </p>
            <p className="mt-1 text-sm text-slate-200">
              Un solo apartado con sectorizacion clara: templates, entrenamiento y plan semanal activo.
            </p>
          </div>
          <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            {alumnoDestinoActivo
              ? `Alumno destino: ${alumnoDestinoActivo.nombre}`
              : "Alumno destino: no seleccionado"}
          </span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="border-b border-white/10 pb-4 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-5">
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
              Persona activa
            </label>
            <select
              value={selectedOwnerKey}
              onChange={(event) => {
                const nextOwnerKey = event.target.value;

                if (nextOwnerKey === GENERAL_OWNER_KEY) {
                  setSelectedOwnerKey(GENERAL_OWNER_KEY);
                  return;
                }

                const persona = todasLasPersonas.find(
                  (item) => toOwnerKey(item) === nextOwnerKey
                );

                if (persona) {
                  setTipoFiltro(persona.tipo);
                  seleccionarPersona(persona);
                  return;
                }

                setSelectedOwnerKey(nextOwnerKey);
              }}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              {ownerOptions.map((option) => (
                <option key={option.ownerKey} value={option.ownerKey}>
                  {option.label} - {option.detail}
                </option>
              ))}
            </select>
            <div className="mt-3 border-l-2 border-cyan-300/40 bg-cyan-500/[0.07] px-3 py-2 text-xs text-cyan-100">
              <p className="font-semibold uppercase tracking-wide">Plan activo</p>
              <p className="mt-1 text-sm text-white">
                {planSeleccionado?.nombre || "Sin plan seleccionado"}
              </p>
              {personaSeleccionada?.categoria ? (
                <p className="mt-1 text-[11px] text-cyan-200">Categoria: {personaSeleccionada.categoria}</p>
              ) : null}
            </div>
          </div>

          <div className="xl:pl-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-amber-100">Alertas de alumnos</h2>
                <p className="text-[11px] text-slate-300">Cambios recientes para acceso rapido.</p>
              </div>
              <ReliableActionButton
                type="button"
                onClick={() => setAlumnoNotifications([])}
                disabled={alumnoNotifications.length === 0}
                className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Limpiar
              </ReliableActionButton>
            </div>

            {alumnoNotifications.length > 0 ? (
              <div className="mt-3 space-y-2">
                {alumnoNotifications.slice(0, 4).map((notification) => (
                  <ReliableActionButton
                    key={notification.id}
                    type="button"
                    onClick={() => {
                      setTipoFiltro("alumnos");
                      setSelectedOwnerKey(notification.ownerKey);
                    }}
                    className="w-full border-l-2 border-amber-300/35 bg-slate-900/55 px-3 py-2 text-left transition hover:border-amber-200"
                  >
                    <p className="text-xs font-semibold text-white">{notification.alumnoNombre}</p>
                    <p className="mt-1 text-[11px] text-slate-300">{notification.summary}</p>
                  </ReliableActionButton>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">Sin alertas activas por ahora.</p>
            )}
          </div>
        </div>

      <section className="mt-6 rounded-[28px] border border-cyan-300/18 bg-slate-950/24 p-5 shadow-[0_24px_56px_-46px_rgba(8,47,73,0.9)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Templates + entrenamiento
              </h2>
              <p className="text-xs text-slate-300">
                Crea planes base con su entrenamiento integrado y reutilizable.
              </p>
              <p className="mt-2 text-[11px] text-cyan-100/90">
                {alumnoDestinoActivo
                  ? `Alumno destino activo: ${alumnoDestinoActivo.nombre}`
                  : "Selecciona un alumno en Persona activa para habilitar Asignar desde la biblioteca."}
              </p>
            </div>

            <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-slate-950/65 p-1 ring-1 ring-white/10">
              <ReliableActionButton
                type="button"
                onClick={iniciarNuevoTemplate}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  templatesTab === "nuevo"
                    ? "bg-cyan-300 text-slate-950 shadow-[0_8px_20px_-10px_rgba(103,232,249,0.8)]"
                    : "text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-100"
                }`}
              >
                Nuevo template
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => setTemplatesTab("mis")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  templatesTab === "mis"
                    ? "bg-cyan-300 text-slate-950 shadow-[0_8px_20px_-10px_rgba(103,232,249,0.8)]"
                    : "text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-100"
                }`}
              >
                Mis templates
              </ReliableActionButton>
            </div>
          </div>

          {templatesTab === "mis" ? (
            <input
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Buscar template..."
              className="w-full max-w-xs rounded-xl border border-cyan-300/20 bg-slate-950/55 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
            />
          ) : null}
        </div>

        {templatesTab === "mis" ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <h3 className="text-base font-semibold text-white">Biblioteca de templates</h3>
            <p className="mt-1 text-xs text-slate-300">
              Gestiona y edita tus templates guardados.
            </p>

            {templatesFiltrados.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-slate-900/60 p-4 text-sm text-slate-300">
                No hay templates guardados con ese filtro.
              </div>
            ) : (
              <>
              <div className="mt-4 space-y-3">
                {templatesFiltrados.map((template) => {
                  const isSelected = selectedTemplateId === template.id;
                  const totalDias = template.semanas.reduce(
                    (acc, week) => acc + week.dias.length,
                    0
                  );
                  const totalBloques = template.semanas.reduce(
                    (acc, week) =>
                      acc +
                      week.dias.reduce(
                        (dayAcc, day) => dayAcc + (day.entrenamiento?.bloques?.length || 0),
                        0
                      ),
                    0
                  );

                  return (
                    <article
                      key={template.id}
                      className={`rounded-xl border p-4 transition ${
                        isSelected
                          ? "border-cyan-200/60 bg-cyan-500/[0.08]"
                          : "border-white/10 bg-slate-900/35 hover:border-cyan-300/30"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-white">{template.nombre}</p>
                          <p className="mt-1 text-xs text-slate-300">
                            {template.descripcion || "Sin descripcion"}
                          </p>

                          {(template.etiquetas || []).length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(template.etiquetas || []).map((tag) => (
                                <span
                                  key={`${template.id}-${tag}`}
                                  className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <p className="mt-2 text-[11px] text-slate-400">
                            {totalBloques} bloques · {totalDias} dias activos ·
                            actualizado {new Date(template.updatedAt || template.createdAt || 0).toLocaleString("es-AR")}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <ReliableActionButton
                            type="button"
                            onClick={() => setSelectedTemplateId(template.id)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                              isSelected
                                ? "border-cyan-200/70 bg-cyan-300 text-slate-950"
                                : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                            }`}
                          >
                            {isSelected ? "Viendo" : "Ver template"}
                          </ReliableActionButton>
                          <ReliableActionButton
                            type="button"
                            onClick={() => asignarTemplateAAlumno(template.id)}
                            disabled={!alumnoDestinoActivo}
                            className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Asignar a alumno
                          </ReliableActionButton>
                          <ReliableActionButton
                            type="button"
                            onClick={() => editarTemplate(template.id)}
                            className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                          >
                            Editar
                          </ReliableActionButton>
                          <ReliableActionButton
                            type="button"
                            onClick={() => eliminarPlantilla(template.id)}
                            className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100"
                          >
                            Eliminar
                          </ReliableActionButton>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {selectedTemplate ? (
                <section className="mt-5 rounded-2xl border-2 border-cyan-300/30 bg-cyan-500/[0.06] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">Vista template</p>
                      <h4 className="mt-1 text-lg font-black text-white">{selectedTemplate.nombre}</h4>
                      <p className="mt-1 text-xs text-slate-300">
                        Previsualizacion solo lectura en categoria. No entra en modo edicion.
                      </p>
                    </div>
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                      {(selectedTemplate.semanas || []).length} semanas
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedTemplate.semanas || []).map((week) => (
                      <ReliableActionButton
                        key={`preview-week-${week.id}`}
                        type="button"
                        onClick={() => setTemplatePreviewWeekId(week.id)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          templatePreviewWeekId === week.id
                            ? "border-cyan-200/70 bg-cyan-300 text-slate-950"
                            : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                        }`}
                      >
                        {week.nombre || "Semana"}
                      </ReliableActionButton>
                    ))}
                  </div>

                  {selectedTemplatePreviewWeek ? (
                    <div className="mt-3 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/[0.06] p-3">
                      <p className="text-sm font-semibold text-white">{selectedTemplatePreviewWeek.nombre}</p>
                      <p className="mt-1 text-xs text-slate-300">
                        {selectedTemplatePreviewWeek.objetivo || "Sin objetivo semanal"}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {(selectedTemplatePreviewWeek.dias || []).map((day) => (
                          <ReliableActionButton
                            key={`preview-day-${day.id}`}
                            type="button"
                            onClick={() => setTemplatePreviewDayId(day.id)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                              templatePreviewDayId === day.id
                                ? "border-cyan-200/70 bg-cyan-300 text-slate-950"
                                : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                            }`}
                          >
                            {day.dia || "Dia"}
                          </ReliableActionButton>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedTemplatePreviewDay ? (
                    <div className="mt-3 rounded-xl border border-white/15 bg-slate-950/45 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">Dia</p>
                          <p className="mt-1 text-base font-black text-white">{selectedTemplatePreviewDay.dia}</p>
                          <p className="mt-1 text-sm text-slate-200">
                            {selectedTemplatePreviewDay.planificacion || "Sin planificacion"}
                          </p>
                          {selectedTemplatePreviewDay.objetivo ? (
                            <p className="mt-1 text-xs text-fuchsia-100/90">
                              Objetivo del dia: {selectedTemplatePreviewDay.objetivo}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {selectedTemplatePreviewDay.entrenamiento?.bloques?.length ? (
                        <div className="mt-3 space-y-2">
                          {selectedTemplatePreviewDay.entrenamiento.bloques.map((block, blockIndex) => (
                            <article
                              key={`preview-block-${block.id || blockIndex}`}
                              className="rounded-lg border border-white/12 bg-slate-900/60 p-3"
                            >
                              <p className="text-sm font-semibold text-white">
                                {block.titulo || `Bloque ${blockIndex + 1}`}
                              </p>
                              {block.objetivo ? (
                                <p className="mt-1 text-xs text-slate-300">{block.objetivo}</p>
                              ) : null}

                              {(block.ejercicios || []).length > 0 ? (
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  {(block.ejercicios || []).map((exercise, exerciseIndex) => {
                                    const superSerieRows = Array.isArray(exercise.superSerie)
                                      ? exercise.superSerie
                                      : [];
                                    return (
                                      <div
                                        key={`preview-exercise-${exercise.id || exerciseIndex}`}
                                        className="rounded-md border border-white/10 bg-slate-950/45 p-2"
                                      >
                                        <p className="text-xs font-semibold text-white">
                                          {getExerciseName(exercise.ejercicioId)}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-300">
                                          {exercise.series || "-"} x {exercise.repeticiones || "-"} · Descanso {exercise.descanso || "-"} · Carga {exercise.carga || "-"}
                                        </p>

                                        {superSerieRows.length > 0 ? (
                                          <div className="mt-2 space-y-1 border-t border-violet-300/25 pt-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-100">Super serie</p>
                                            {superSerieRows.map((superItem, superIndex) => (
                                              <p
                                                key={`preview-super-${superItem.id || superIndex}`}
                                                className="text-[11px] text-violet-100/90"
                                              >
                                                {getExerciseName(superItem.ejercicioId)} · {superItem.series || "-"} x {superItem.repeticiones || "-"} · Descanso {superItem.descanso || "-"}
                                              </p>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-slate-400">Sin ejercicios en este bloque.</p>
                              )}
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-lg border border-white/10 bg-slate-900/55 p-3 text-sm text-slate-300">
                          Este dia no tiene entrenamiento cargado.
                        </p>
                      )}
                    </div>
                  ) : null}
                </section>
              ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-7 rounded-[28px] bg-slate-950/8 px-2 py-3 sm:px-3 sm:py-4">
            <div className="rounded-[18px] border-b border-cyan-300/25 pb-5">
              <h2 className="text-2xl font-semibold text-white">{templateDraft.nombre || "NUEVO PLAN BLANCO"}</h2>

              <div className="mt-3 space-y-3">
                <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                  Titulo
                  <input
                    ref={templateNameInputRef}
                    value={templateDraft.nombre}
                    onChange={(e) => actualizarTemplateMeta({ nombre: e.target.value })}
                    className="w-full rounded-xl border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                    placeholder="Nombre del plan"
                  />
                </label>

                <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                  Etiquetas
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input
                      value={templateTagInput}
                      onChange={(e) => setTemplateTagInput(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                      placeholder="Agregar etiqueta"
                    />
                    <ReliableActionButton
                      type="button"
                      onClick={agregarTemplateTag}
                      className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100"
                    >
                      + Agregar
                    </ReliableActionButton>
                  </div>
                </label>
              </div>

              {(templateDraft.etiquetas || []).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(templateDraft.etiquetas || []).map((tag) => (
                    <ReliableActionButton
                      key={`draft-tag-${tag}`}
                      type="button"
                      onClick={() => eliminarTemplateTag(tag)}
                      className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100"
                    >
                      {tag} x
                    </ReliableActionButton>
                  ))}
                </div>
              ) : null}

              <label className="mt-3 block space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Comentarios / descripcion
                <textarea
                  value={templateDraft.descripcion || ""}
                  onChange={(e) => actualizarTemplateMeta({ descripcion: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                  placeholder="Describe el objetivo del template"
                />
              </label>
            </div>

            <div className="space-y-5 rounded-[20px] bg-transparent p-0">
              <div className="hidden pb-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/85">Semanas</p>
                <p className="mt-1 text-xs text-slate-400">Estructura general del template.</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {templateDraft.semanas.map((week) => (
                    <ReliableActionButton
                      key={week.id}
                      type="button"
                      onClick={() => setTemplateDraftWeekId(week.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        templateDraftWeekId === week.id
                          ? "bg-cyan-300 text-slate-950 shadow-[0_8px_20px_-12px_rgba(34,211,238,0.9)]"
                          : "bg-slate-900/60 text-slate-200 hover:bg-slate-800/70"
                      }`}
                    >
                      {week.nombre}
                    </ReliableActionButton>
                  ))}
                  <ReliableActionButton
                    type="button"
                    onClick={agregarSemanaTemplate}
                    className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                  >
                    + Semana
                  </ReliableActionButton>
                  {templateDraftWeek ? (
                    <ReliableActionButton
                      type="button"
                      onClick={() => eliminarSemanaTemplate(templateDraftWeek.id)}
                      disabled={templateDraft.semanas.length <= 1}
                      className="rounded-full border border-rose-300/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 disabled:opacity-40"
                    >
                      Eliminar semana
                    </ReliableActionButton>
                  ) : null}
                </div>

                {templateDraftWeek ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                      Nombre semana
                      <input
                        value={templateDraftWeek.nombre}
                        onChange={(e) =>
                          actualizarSemanaTemplate(templateDraftWeek.id, { nombre: e.target.value })
                        }
                        className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                      Objetivo semanal
                      <input
                        value={templateDraftWeek.objetivo}
                        onChange={(e) =>
                          actualizarSemanaTemplate(templateDraftWeek.id, { objetivo: e.target.value })
                        }
                        className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              {templateDraftWeek ? (
                <div className="mt-5 hidden border-t border-white/10 pt-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200/85">Dias</p>
                  <p className="mt-1 text-xs text-slate-400">Selecciona un dia y define su enfoque.</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(templateDraftWeek.dias || []).map((day) => (
                      <ReliableActionButton
                        key={day.id}
                        type="button"
                        onClick={() => setTemplateDraftDayId(day.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          templateDraftDayId === day.id
                            ? "bg-emerald-300 text-slate-950 shadow-[0_8px_20px_-12px_rgba(16,185,129,0.9)]"
                            : "bg-slate-900/60 text-slate-200 hover:bg-slate-800/70"
                        }`}
                      >
                        {day.dia}
                      </ReliableActionButton>
                    ))}
                    <ReliableActionButton
                      type="button"
                      onClick={() => agregarDiaTemplate(templateDraftWeek.id)}
                      className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                    >
                      + Dia
                    </ReliableActionButton>
                    {templateDraftDay ? (
                      <ReliableActionButton
                        type="button"
                        onClick={() => eliminarDiaTemplate(templateDraftWeek.id, templateDraftDay.id)}
                        disabled={templateDraftWeek.dias.length <= 1}
                        className="rounded-full border border-rose-300/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 disabled:opacity-40"
                      >
                        Eliminar dia
                      </ReliableActionButton>
                    ) : null}
                  </div>

                  {templateDraftDay ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                          Dia
                          <input
                            value={templateDraftDay.dia}
                            onChange={(e) =>
                              actualizarDiaTemplate(
                                templateDraftWeek.id,
                                templateDraftDay.id,
                                "dia",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300 md:col-span-2">
                          Planificacion breve
                          <input
                            value={templateDraftDay.planificacion}
                            onChange={(e) =>
                              actualizarDiaTemplate(
                                templateDraftWeek.id,
                                templateDraftDay.id,
                                "planificacion",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                          />
                        </label>
                      </div>

                      <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                        Objetivo del dia
                        <textarea
                          value={templateDraftDay.objetivo || ""}
                          onChange={(e) =>
                            actualizarDiaTemplate(
                              templateDraftWeek.id,
                              templateDraftDay.id,
                              "objetivo",
                              e.target.value
                            )
                          }
                          rows={2}
                          className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                        />
                      </label>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">
                      Crea o selecciona un dia para editar su contenido.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="mt-5 border-t border-cyan-300/20 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/85">
                      Entrenamiento
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Bloques y ejercicios de la sesion del dia.
                    </p>
                  </div>

                  {templateDraftWeek && templateDraftDay && templateDraftDayEffectiveTraining ? (
                    <ReliableActionButton
                      type="button"
                      onClick={() => agregarBloqueTemplate(templateDraftWeek.id, templateDraftDay.id)}
                      className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                    >
                      Nuevo bloque
                    </ReliableActionButton>
                  ) : null}
                </div>

                {!templateDraftWeek || !templateDraftDay ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Selecciona una semana y un dia para cargar el bloque de entrenamiento.
                  </p>
                ) : !templateDraftDayEffectiveTraining ? (
                  <ReliableActionButton
                    type="button"
                    onClick={() =>
                      actualizarEntrenamientoDiaTemplate(
                        templateDraftWeek.id,
                        templateDraftDay.id,
                        (training) => training
                      )
                    }
                    className="mt-3 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                  >
                    Crear estructura de entrenamiento para este dia
                  </ReliableActionButton>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-3">
                      {templateDraftDayEffectiveTraining.bloques.map((block, blockIndex) => {
                        const blockGridColumns = block.ejercicios[0]?.especificaciones || [];
                        const optionalGridColumns = blockGridColumns.filter(
                          (spec) =>
                            spec.nombre.trim().length > 0 &&
                            spec.nombre.trim().toLowerCase() !== "observaciones"
                        );

                        return (
                          <article
                            key={block.id}
                            className={`relative px-0.5 ${blockIndex > 0 ? "mt-4 border-t border-white/12 pt-5" : "pt-2"}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              {blockTitleEdit?.blockId === block.id ? (
                                <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-2">
                                  <input
                                    value={blockTitleEdit.value}
                                    onChange={(e) =>
                                      setBlockTitleEdit({ blockId: block.id, value: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        confirmarEdicionNombreBloque(
                                          templateDraftWeek.id,
                                          templateDraftDay.id,
                                          block.id
                                        );
                                      }
                                      if (e.key === "Escape") {
                                        setBlockTitleEdit(null);
                                      }
                                    }}
                                    className="w-full rounded-lg border border-cyan-300/35 bg-slate-700 px-3 py-2 text-sm text-white md:flex-1"
                                    placeholder="Nombre bloque"
                                  />
                                  <ReliableActionButton
                                    type="button"
                                    onClick={() =>
                                      confirmarEdicionNombreBloque(
                                        templateDraftWeek.id,
                                        templateDraftDay.id,
                                        block.id
                                      )
                                    }
                                    className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100"
                                  >
                                    Guardar
                                  </ReliableActionButton>
                                  <ReliableActionButton
                                    type="button"
                                    onClick={() => setBlockTitleEdit(null)}
                                    className="rounded-full border border-white/20 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200"
                                  >
                                    Cancelar
                                  </ReliableActionButton>
                                </div>
                              ) : (
                                <p className="text-sm font-semibold text-white">{block.titulo}</p>
                              )}

                              <div className="relative flex items-center gap-2">
                                <ReliableActionButton
                                  type="button"
                                  onClick={() =>
                                    agregarEjercicioTemplate(
                                      templateDraftWeek.id,
                                      templateDraftDay.id,
                                      block.id
                                    )
                                  }
                                  className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-100"
                                >
                                  Agregar ejercicio
                                </ReliableActionButton>
                                <ReliableActionButton
                                  type="button"
                                  onClick={() => {
                                    setBlockGridConfigOpenId(null);
                                    setBlockMenuOpenId((current) =>
                                      current === block.id ? null : block.id
                                    );
                                  }}
                                  className="h-7 w-7 rounded-full border border-white/20 bg-slate-800 p-0 text-sm font-semibold text-slate-100"
                                >
                                  ⋯
                                </ReliableActionButton>

                                {blockMenuOpenId === block.id ? (
                                  <div className="absolute right-0 top-10 z-20 min-w-[220px] rounded-xl border border-white/15 bg-slate-900/95 p-2 shadow-2xl">
                                    <ReliableActionButton
                                      type="button"
                                      onClick={() => {
                                        setBlockMenuOpenId(null);
                                        setBlockTitleEdit({ blockId: block.id, value: block.titulo });
                                      }}
                                      className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-100 hover:bg-white/10"
                                    >
                                      Editar nombre del bloque
                                    </ReliableActionButton>
                                    <ReliableActionButton
                                      type="button"
                                      onClick={() => {
                                        setBlockMenuOpenId(null);
                                        setBlockGridConfigOpenId((current) =>
                                          current === block.id ? null : block.id
                                        );
                                      }}
                                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-100 hover:bg-white/10"
                                    >
                                      Configurar grilla plan
                                    </ReliableActionButton>
                                    <ReliableActionButton
                                      type="button"
                                      onClick={() => {
                                        setBlockMenuOpenId(null);
                                        setBlockGridConfigOpenId((current) =>
                                          current === block.id ? null : current
                                        );
                                        setBlockTitleEdit((current) =>
                                          current?.blockId === block.id ? null : current
                                        );
                                        duplicarBloqueTemplate(
                                          templateDraftWeek.id,
                                          templateDraftDay.id,
                                          block.id
                                        );
                                      }}
                                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-100 hover:bg-white/10"
                                    >
                                      Duplicar bloque
                                    </ReliableActionButton>
                                    <ReliableActionButton
                                      type="button"
                                      onClick={() => {
                                        setBlockMenuOpenId(null);
                                        setBlockGridConfigOpenId((current) =>
                                          current === block.id ? null : current
                                        );
                                        setBlockTitleEdit((current) =>
                                          current?.blockId === block.id ? null : current
                                        );
                                        eliminarBloqueTemplate(
                                          templateDraftWeek.id,
                                          templateDraftDay.id,
                                          block.id
                                        );
                                      }}
                                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-200 hover:bg-rose-500/15"
                                    >
                                      Eliminar bloque
                                    </ReliableActionButton>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {blockGridConfigOpenId === block.id ? (
                              <div className="mt-3 border-l-2 border-cyan-300/35 bg-cyan-500/[0.04] py-2 pl-3 pr-1.5">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                                  Configuracion grilla plan:
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  Series, repeticiones, descanso y carga kg son columnas base. El resto es
                                  opcional.
                                </p>

                                <div className="mt-3 space-y-2">
                                  <input
                                    value="Series:"
                                    readOnly
                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                  />
                                  <input
                                    value="Repeticiones:"
                                    readOnly
                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                  />
                                  <input
                                    value="Descanso:"
                                    readOnly
                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                  />
                                  <input
                                    value="Carga kg:"
                                    readOnly
                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                  />

                                  {blockGridColumns.map((spec, specIndex) => (
                                    <div key={`${block.id}-spec-col-${spec.id}`} className="flex items-center gap-2">
                                      <input
                                        value={spec.nombre}
                                        onChange={(e) =>
                                          actualizarNombreColumnaGrillaBloque(
                                            templateDraftWeek.id,
                                            templateDraftDay.id,
                                            block.id,
                                            specIndex,
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                        placeholder={`Campo ${specIndex + 1}`}
                                      />
                                      <ReliableActionButton
                                        type="button"
                                        onClick={() =>
                                          eliminarColumnaGrillaBloque(
                                            templateDraftWeek.id,
                                            templateDraftDay.id,
                                            block.id,
                                            specIndex
                                          )
                                        }
                                        className="rounded-full border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100"
                                      >
                                        x
                                      </ReliableActionButton>
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-3 flex flex-wrap justify-end gap-2">
                                  <ReliableActionButton
                                    type="button"
                                    onClick={() =>
                                      agregarColumnaGrillaBloque(
                                        templateDraftWeek.id,
                                        templateDraftDay.id,
                                        block.id
                                      )
                                    }
                                    className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                                  >
                                    Nuevo
                                  </ReliableActionButton>
                                  <ReliableActionButton
                                    type="button"
                                    onClick={() => setBlockGridConfigOpenId(null)}
                                    className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                                  >
                                    Aceptar
                                  </ReliableActionButton>
                                </div>
                              </div>
                            ) : null}

                            <div className="mt-2">
                              <input
                                value={block.objetivo}
                                onChange={(e) =>
                                  actualizarBloqueTemplate(
                                    templateDraftWeek.id,
                                    templateDraftDay.id,
                                    block.id,
                                    "objetivo",
                                    e.target.value
                                  )
                                }
                                className="w-full border-b border-white/20 bg-transparent px-0 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/45 focus:outline-none"
                                placeholder="Objetivo bloque"
                              />
                            </div>

                            <div className="mt-2 space-y-3">
                              {block.ejercicios.map((exercise, exerciseIndex) => {
                                const selectedExercise = ejercicios.find((item) => item.id === exercise.ejercicioId);
                                const selectorQuery = getTemplateExerciseQuery(exercise);
                                const selectorItems = getTemplateExerciseCandidates(exercise.id);
                                const thumb = getExerciseThumbnail(selectedExercise?.videoUrl);
                                const hasSeriesBreakdown = (exercise.serieDesglose || []).length > 0;
                                const hasSuperSerieGroup = (exercise.superSerie || []).length > 0;
                                const exerciseRowGridClass = hasSuperSerieGroup
                                  ? "grid gap-y-2 gap-x-1.5 md:grid-cols-[104px_minmax(0,1fr)] lg:grid-cols-[104px_minmax(0,1.35fr)_repeat(4,minmax(0,0.95fr))]"
                                  : "grid gap-y-2 gap-x-1.5 md:grid-cols-[104px_minmax(0,1fr)] lg:grid-cols-[104px_repeat(7,minmax(0,1fr))]";

                                return (
                                  <div
                                    key={exercise.id}
                                    className={`relative px-1 py-2.5 ${
                                      hasSuperSerieGroup
                                        ? "bg-transparent"
                                        : "border-b border-white/10 last:border-b-0"
                                    }`}
                                  >
                                    {hasSuperSerieGroup ? (
                                      <div className="mb-1.5 flex items-center gap-2">
                                        <span className="h-5 w-[2px] rounded-full bg-violet-300/75" />
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-100">
                                          Super serie 🔥
                                        </p>
                                        <span className="h-5 w-[2px] rounded-full bg-violet-300/45" />
                                      </div>
                                    ) : null}

                                    {hasSuperSerieGroup ? (
                                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-100/90">
                                        Inicio super serie
                                      </p>
                                    ) : null}

                                    <div
                                      className={`${exerciseRowGridClass} ${
                                        hasSuperSerieGroup
                                          ? "border-l-2 border-violet-300/35 pl-2.5 py-1.5"
                                          : "pl-0.5"
                                      }`}
                                    >
                                      <div className="h-[72px] w-[104px] overflow-hidden rounded-xl border border-white/15 bg-slate-950/55">
                                        {thumb ? (
                                          <img
                                            src={thumb}
                                            alt={selectedExercise?.nombre || "Ejercicio"}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                                            Sin preview
                                          </div>
                                        )}
                                      </div>

                                      <label
                                        className={`relative text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-1 ${
                                          hasSuperSerieGroup ? "lg:col-span-1" : "lg:col-span-2"
                                        }`}
                                      >
                                        Ejercicio
                                        <input
                                          value={selectorQuery}
                                          onFocus={() => setExerciseSelectorOpenId(exercise.id)}
                                          onChange={(event) => {
                                            updateTemplateExerciseQuery(exercise.id, event.target.value);
                                            setExerciseSelectorOpenId(exercise.id);
                                          }}
                                          onKeyDown={(event) => {
                                            if (event.key === "Escape") {
                                              setExerciseSelectorOpenId(null);
                                            }

                                            if (event.key === "Enter") {
                                              event.preventDefault();
                                              const first = selectorItems[0];
                                              if (first) {
                                                seleccionarEjercicioTemplateDesdePicker(
                                                  block.id,
                                                  exercise.id,
                                                  first.id
                                                );
                                              }
                                            }
                                          }}
                                          placeholder="Seleccione ejercicio"
                                          className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        />

                                        {exerciseSelectorOpenId === exercise.id ? (
                                          <div className="absolute left-0 top-[68px] z-20 max-h-72 w-full overflow-y-auto rounded-lg border border-white/15 bg-slate-900/95 p-1 shadow-2xl">
                                            {selectorItems.length === 0 ? (
                                              <p className="px-2 py-2 text-xs text-slate-400">Sin resultados.</p>
                                            ) : (
                                              selectorItems.map((item, itemIndex) => {
                                                const optionThumb = getExerciseThumbnail(item.videoUrl);
                                                return (
                                                  <ReliableActionButton
                                                    key={`${exercise.id}-${item.id}`}
                                                    type="button"
                                                    onClick={() =>
                                                      seleccionarEjercicioTemplateDesdePicker(
                                                        block.id,
                                                        exercise.id,
                                                        item.id
                                                      )
                                                    }
                                                    className={`grid w-full grid-cols-[42px_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                                                      itemIndex === 0
                                                        ? "bg-cyan-500/20 text-cyan-100"
                                                        : "text-slate-200 hover:bg-white/10"
                                                    }`}
                                                  >
                                                    <div className="h-9 w-[42px] overflow-hidden rounded border border-white/10 bg-slate-800">
                                                      {optionThumb ? (
                                                        <img
                                                          src={optionThumb}
                                                          alt={item.nombre}
                                                          className="h-full w-full object-cover"
                                                        />
                                                      ) : (
                                                        <div className="flex h-full items-center justify-center text-[9px] text-slate-400">
                                                          Sin
                                                        </div>
                                                      )}
                                                    </div>
                                                    <div>
                                                      <p className="line-clamp-1 text-xs font-semibold">{item.nombre}</p>
                                                      <p className="text-[10px] text-slate-400">
                                                        {itemIndex === 0
                                                          ? "Presione enter para asignar"
                                                          : item.categoria || "Ejercicio"}
                                                      </p>
                                                    </div>
                                                  </ReliableActionButton>
                                                );
                                              })
                                            )}
                                          </div>
                                        ) : null}
                                      </label>

                                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2 lg:col-span-1">
                                        Series
                                        <input
                                          value={exercise.series}
                                          onChange={(event) =>
                                            actualizarEjercicioTemplate(
                                              templateDraftWeek.id,
                                              templateDraftDay.id,
                                              block.id,
                                              exercise.id,
                                              "series",
                                              event.target.value
                                            )
                                          }
                                          className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        />
                                      </label>

                                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2 lg:col-span-1">
                                        Repeticiones
                                        <input
                                          value={exercise.repeticiones}
                                          onChange={(event) =>
                                            actualizarEjercicioTemplate(
                                              templateDraftWeek.id,
                                              templateDraftDay.id,
                                              block.id,
                                              exercise.id,
                                              "repeticiones",
                                              event.target.value
                                            )
                                          }
                                          className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        />
                                      </label>

                                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2 lg:col-span-1">
                                        Descanso
                                        <input
                                          value={exercise.descanso}
                                          onChange={(event) =>
                                            actualizarEjercicioTemplate(
                                              templateDraftWeek.id,
                                              templateDraftDay.id,
                                              block.id,
                                              exercise.id,
                                              "descanso",
                                              event.target.value
                                            )
                                          }
                                          className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        />
                                      </label>

                                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2 lg:col-span-1">
                                        Carga (kg)
                                        <input
                                          value={exercise.carga}
                                          onChange={(event) =>
                                            actualizarEjercicioTemplate(
                                              templateDraftWeek.id,
                                              templateDraftDay.id,
                                              block.id,
                                              exercise.id,
                                              "carga",
                                              event.target.value
                                            )
                                          }
                                          className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        />
                                      </label>

                                      {optionalGridColumns.map((spec, specIndex) => (
                                        <label
                                          key={`${exercise.id}-optional-col-${spec.id}`}
                                          className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2 lg:col-span-1"
                                        >
                                          {spec.nombre}
                                          <input
                                            value={getTemplateSpecValue(exercise, spec.nombre)}
                                            onChange={(event) =>
                                              upsertTemplateSpecValue(
                                                templateDraftWeek.id,
                                                templateDraftDay.id,
                                                block.id,
                                                exercise.id,
                                                spec.nombre,
                                                event.target.value
                                              )
                                            }
                                            className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                            placeholder={`Campo ${specIndex + 1}`}
                                          />
                                        </label>
                                      ))}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold">
                                      <ReliableActionButton
                                        type="button"
                                        onClick={() =>
                                          toggleDesgloseSeriesTemplate(
                                            templateDraftWeek.id,
                                            templateDraftDay.id,
                                            block.id,
                                            exercise.id
                                          )
                                        }
                                        className={`${hasSeriesBreakdown ? "text-rose-300" : "text-cyan-300"}`}
                                      >
                                        {hasSeriesBreakdown ? "Unificar serie" : "Desglosar serie"}
                                      </ReliableActionButton>
                                      <ReliableActionButton
                                        type="button"
                                        onClick={() =>
                                          agregarSuperSerieTemplate(
                                            templateDraftWeek.id,
                                            templateDraftDay.id,
                                            block.id,
                                            exercise.id
                                          )
                                        }
                                        disabled={!exercise.ejercicioId}
                                        className="text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Agregar ejercicio super-serie
                                      </ReliableActionButton>
                                      <ReliableActionButton
                                        type="button"
                                        onClick={() =>
                                          abrirVerPesos(
                                            block.id,
                                            block.titulo,
                                            exercise.ejercicioId,
                                            selectedExercise?.nombre || "Ejercicio"
                                          )
                                        }
                                        disabled={!exercise.ejercicioId}
                                        className="text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Ver pesos
                                      </ReliableActionButton>
                                      <ReliableActionButton
                                        type="button"
                                        onClick={() =>
                                          abrirRegistrarPeso(
                                            block.id,
                                            block.titulo,
                                            exercise.ejercicioId,
                                            selectedExercise?.nombre || "Ejercicio"
                                          )
                                        }
                                        disabled={!exercise.ejercicioId}
                                        className="text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Registrar peso
                                      </ReliableActionButton>
                                      <ReliableActionButton
                                        type="button"
                                        onClick={() =>
                                          eliminarEjercicioTemplate(
                                            templateDraftWeek.id,
                                            templateDraftDay.id,
                                            block.id,
                                            exercise.id
                                          )
                                        }
                                        className="text-rose-300"
                                      >
                                        Eliminar
                                      </ReliableActionButton>
                                    </div>

                                    {hasSeriesBreakdown ? (
                                      <div className="mt-3 border-l-2 border-cyan-300/35 bg-cyan-500/[0.04] py-1.5 pl-2.5 pr-1.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
                                          Desglose de series
                                        </p>
                                        <div className="mt-2 space-y-2">
                                          {(exercise.serieDesglose || []).map((setRow) => (
                                            <div
                                              key={setRow.id}
                                              className="grid gap-2 md:grid-cols-[auto_repeat(5,minmax(0,1fr))]"
                                            >
                                              <span className="rounded-md border border-white/15 bg-slate-900/60 px-2 py-2 text-xs text-slate-200">
                                                S{setRow.serie}
                                              </span>
                                              <input
                                                value={setRow.repeticiones}
                                                onChange={(event) =>
                                                  actualizarSerieDesgloseTemplate(
                                                    templateDraftWeek.id,
                                                    templateDraftDay.id,
                                                    block.id,
                                                    exercise.id,
                                                    setRow.id,
                                                    "repeticiones",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Rep"
                                                className="rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                              />
                                              <input
                                                value={setRow.descanso}
                                                onChange={(event) =>
                                                  actualizarSerieDesgloseTemplate(
                                                    templateDraftWeek.id,
                                                    templateDraftDay.id,
                                                    block.id,
                                                    exercise.id,
                                                    setRow.id,
                                                    "descanso",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Desc"
                                                className="rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                              />
                                              <input
                                                value={setRow.rir}
                                                onChange={(event) =>
                                                  actualizarSerieDesgloseTemplate(
                                                    templateDraftWeek.id,
                                                    templateDraftDay.id,
                                                    block.id,
                                                    exercise.id,
                                                    setRow.id,
                                                    "rir",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="RIR"
                                                className="rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                              />
                                              <input
                                                value={setRow.cargaKg}
                                                onChange={(event) =>
                                                  actualizarSerieDesgloseTemplate(
                                                    templateDraftWeek.id,
                                                    templateDraftDay.id,
                                                    block.id,
                                                    exercise.id,
                                                    setRow.id,
                                                    "cargaKg",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Carga kg"
                                                className="rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                              />
                                              <input
                                                value={setRow.observaciones}
                                                onChange={(event) =>
                                                  actualizarSerieDesgloseTemplate(
                                                    templateDraftWeek.id,
                                                    templateDraftDay.id,
                                                    block.id,
                                                    exercise.id,
                                                    setRow.id,
                                                    "observaciones",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Obs"
                                                className="rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}

                                    {hasSuperSerieGroup ? (
                                      <div className="mt-1 space-y-2">
                                        {(exercise.superSerie || []).map((superItem) => {
                                          const superExercise = ejercicios.find(
                                            (item) => item.id === superItem.ejercicioId
                                          );
                                          const superThumb = getExerciseThumbnail(superExercise?.videoUrl);
                                          const superCanTrackWeight = Boolean(superItem.ejercicioId);

                                          return (
                                            <div
                                              key={superItem.id}
                                              className="space-y-2 border-l-2 border-violet-300/35 py-1.5 pl-2.5"
                                            >
                                              <div className="grid gap-y-2 gap-x-1.5 md:grid-cols-[104px_minmax(0,1fr)] lg:grid-cols-[104px_minmax(0,1.35fr)_repeat(4,minmax(0,0.95fr))]">
                                                <div className="h-[72px] w-[104px] overflow-hidden rounded-xl border border-violet-200/20 bg-slate-950/55">
                                                  {superThumb ? (
                                                    <img
                                                      src={superThumb}
                                                      alt={superExercise?.nombre || "Ejercicio"}
                                                      className="h-full w-full object-cover"
                                                    />
                                                  ) : (
                                                    <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                                                      Sin preview
                                                    </div>
                                                  )}
                                                </div>

                                                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 lg:col-span-1">
                                                  Ejercicio
                                                  <select
                                                    value={superItem.ejercicioId}
                                                    onChange={(event) =>
                                                      actualizarSuperSerieTemplate(
                                                        templateDraftWeek.id,
                                                        templateDraftDay.id,
                                                        block.id,
                                                        exercise.id,
                                                        superItem.id,
                                                        "ejercicioId",
                                                        event.target.value
                                                      )
                                                    }
                                                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-sm text-white"
                                                  >
                                                    <option value="">Seleccione ejercicio</option>
                                                    {ejercicios.map((item) => (
                                                      <option key={`${superItem.id}-${item.id}`} value={item.id}>
                                                        {item.nombre}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>

                                                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2 lg:col-span-1">
                                                  Series
                                                  <input
                                                    value={superItem.series}
                                                    onChange={(event) =>
                                                      actualizarSuperSerieTemplate(
                                                        templateDraftWeek.id,
                                                        templateDraftDay.id,
                                                        block.id,
                                                        exercise.id,
                                                        superItem.id,
                                                        "series",
                                                        event.target.value
                                                      )
                                                    }
                                                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                                  />
                                                </label>

                                                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2 lg:col-span-1">
                                                  Repeticiones
                                                  <input
                                                    value={superItem.repeticiones}
                                                    onChange={(event) =>
                                                      actualizarSuperSerieTemplate(
                                                        templateDraftWeek.id,
                                                        templateDraftDay.id,
                                                        block.id,
                                                        exercise.id,
                                                        superItem.id,
                                                        "repeticiones",
                                                        event.target.value
                                                      )
                                                    }
                                                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                                  />
                                                </label>

                                                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2 lg:col-span-1">
                                                  Descanso
                                                  <input
                                                    value={superItem.descanso}
                                                    onChange={(event) =>
                                                      actualizarSuperSerieTemplate(
                                                        templateDraftWeek.id,
                                                        templateDraftDay.id,
                                                        block.id,
                                                        exercise.id,
                                                        superItem.id,
                                                        "descanso",
                                                        event.target.value
                                                      )
                                                    }
                                                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                                  />
                                                </label>

                                                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2 lg:col-span-1">
                                                  Carga (kg)
                                                  <input
                                                    value={superItem.carga}
                                                    onChange={(event) =>
                                                      actualizarSuperSerieTemplate(
                                                        templateDraftWeek.id,
                                                        templateDraftDay.id,
                                                        block.id,
                                                        exercise.id,
                                                        superItem.id,
                                                        "carga",
                                                        event.target.value
                                                      )
                                                    }
                                                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                                  />
                                                </label>
                                              </div>

                                              <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
                                                <ReliableActionButton
                                                  type="button"
                                                  disabled
                                                  className="text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                                                >
                                                  Desglosar serie
                                                </ReliableActionButton>
                                                <ReliableActionButton
                                                  type="button"
                                                  onClick={() =>
                                                    abrirVerPesos(
                                                      block.id,
                                                      block.titulo,
                                                      superItem.ejercicioId,
                                                      superExercise?.nombre || "Ejercicio"
                                                    )
                                                  }
                                                  disabled={!superCanTrackWeight}
                                                  className="text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                  Ver pesos
                                                </ReliableActionButton>
                                                <ReliableActionButton
                                                  type="button"
                                                  onClick={() =>
                                                    abrirRegistrarPeso(
                                                      block.id,
                                                      block.titulo,
                                                      superItem.ejercicioId,
                                                      superExercise?.nombre || "Ejercicio"
                                                    )
                                                  }
                                                  disabled={!superCanTrackWeight}
                                                  className="text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                  Registrar peso
                                                </ReliableActionButton>
                                                <ReliableActionButton
                                                  type="button"
                                                  onClick={() =>
                                                    eliminarSuperSerieTemplate(
                                                      templateDraftWeek.id,
                                                      templateDraftDay.id,
                                                      block.id,
                                                      exercise.id,
                                                      superItem.id
                                                    )
                                                  }
                                                  className="text-rose-300"
                                                >
                                                  Eliminar
                                                </ReliableActionButton>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : null}

                                    {hasSuperSerieGroup ? (
                                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-violet-100/90">
                                        Fin super serie
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-3 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-full border border-white/15 bg-slate-950/70 px-2.5 py-1.5 backdrop-blur-md">
              <ReliableActionButton
                type="button"
                onClick={guardarTemplateActual}
                className="flex-1 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_12px_28px_-16px_rgba(74,222,128,0.75)] sm:flex-none"
              >
                Guardar template
              </ReliableActionButton>

              <ReliableActionButton
                type="button"
                onClick={() => setTemplateMenuOpen((prev) => !prev)}
                className="rounded-full border border-white/20 bg-slate-800/85 px-3 py-2 text-sm font-semibold text-slate-100"
              >
                ▾
              </ReliableActionButton>

              {templateMenuOpen ? (
                <div className="absolute left-0 top-14 z-20 min-w-[260px] rounded-xl border border-white/15 bg-slate-900/95 p-2 shadow-2xl">
                  <ReliableActionButton
                    type="button"
                    onClick={() => {
                      setTemplateMenuOpen(false);
                      templateNameInputRef.current?.focus();
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
                  >
                    Editar nombre
                  </ReliableActionButton>
                  <ReliableActionButton
                    type="button"
                    onClick={() => {
                      setFeedbackConfigOpen((prev) => !prev);
                      setTemplateMenuOpen(false);
                    }}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
                  >
                    Configurar feedback post sesion
                  </ReliableActionButton>
                  <ReliableActionButton
                    type="button"
                    onClick={() => {
                      setTemplateMenuOpen(false);
                      if (templateDraftExists) {
                        eliminarPlantilla(templateDraft.id);
                      } else {
                        notifyWarning("Guarda primero el template para poder eliminarlo");
                      }
                    }}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-rose-200 hover:bg-rose-500/15"
                  >
                    Eliminar
                  </ReliableActionButton>
                </div>
              ) : null}
            </div>

            {feedbackConfigOpen ? (
              <div className="border-l-2 border-cyan-300/35 bg-cyan-500/[0.04] py-3 pl-3 pr-1.5">
                <p className="text-sm font-semibold text-white">Cuestionario de finalizacion</p>
                <p className="mt-1 text-xs text-slate-300">
                  Agrega, edita o elimina preguntas para el feedback post sesion.
                </p>

                <div className="mt-3 space-y-2">
                  {(templateDraft.feedbackQuestions || []).length === 0 ? (
                    <p className="text-xs text-slate-400">Sin preguntas configuradas.</p>
                  ) : (
                    (templateDraft.feedbackQuestions || []).map((question, index) => (
                      <div key={`feedback-${index}`} className="flex flex-wrap gap-2">
                        <input
                          value={question}
                          onChange={(e) => actualizarFeedbackQuestion(index, e.target.value)}
                          className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white md:flex-1"
                        />
                        <ReliableActionButton
                          type="button"
                          onClick={() => eliminarFeedbackQuestion(index)}
                          className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100"
                        >
                          Eliminar
                        </ReliableActionButton>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={templateFeedbackInput}
                    onChange={(e) => setTemplateFeedbackInput(e.target.value)}
                    placeholder="Nueva pregunta..."
                    className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white md:flex-1"
                  />
                  <ReliableActionButton
                    type="button"
                    onClick={agregarFeedbackQuestion}
                    className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                  >
                    + Agregar
                  </ReliableActionButton>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      </section>

      {weightViewer ? (
        <section
          className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/85 p-4 sm:p-6"
          onClick={() => setWeightViewer(null)}
        >
          <div
            className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">Pesos</h2>
                <p className="mt-1 text-xs text-slate-300">
                  {weightViewer.exerciseNombre} · {weightViewer.blockTitulo || "Bloque"}
                </p>
              </div>
              <ReliableActionButton
                type="button"
                onClick={() => setWeightViewer(null)}
                className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                Cerrar
              </ReliableActionButton>
            </div>

            {weightViewerRows.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                No hay registros de peso para este ejercicio todavia.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/55">
                <table className="min-w-full text-xs text-slate-200">
                  <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Nro. serie</th>
                      <th className="px-3 py-2 text-left">Nro. rep</th>
                      <th className="px-3 py-2 text-left">Peso</th>
                      <th className="px-3 py-2 text-left">Molestia</th>
                      <th className="px-3 py-2 text-left">Comentario</th>
                      <th className="px-3 py-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weightViewerRows.map((row) => {
                      const isTemplateRow = templateWeightLogIds.has(row.id);
                      return (
                        <tr key={row.id} className="border-t border-white/10">
                          <td className="px-3 py-2">{row.fecha || "-"}</td>
                          <td className="px-3 py-2">{row.nroSerie}</td>
                          <td className="px-3 py-2">{row.nroRep}</td>
                          <td className="px-3 py-2">{row.pesoKg}</td>
                          <td className="px-3 py-2">{row.molestia ? "Si" : "No"}</td>
                          <td className="px-3 py-2">{row.comentario || "SIN DATOS"}</td>
                          <td className="px-3 py-2">
                            {isTemplateRow ? (
                              <ReliableActionButton
                                type="button"
                                onClick={() => eliminarTemplatePeso(row.id)}
                                className="rounded-md border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100"
                              >
                                Eliminar
                              </ReliableActionButton>
                            ) : (
                              <span className="text-[11px] text-slate-500">Sin accion</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {weightRegister ? (
        <section
          className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/85 p-4 sm:p-6"
          onClick={() => setWeightRegister(null)}
        >
          <div
            className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">Registrar peso</h2>
                <p className="mt-1 text-xs text-slate-300">
                  {weightRegister.exerciseNombre} · {weightRegister.blockTitulo || "Bloque"}
                </p>
              </div>
              <ReliableActionButton
                type="button"
                onClick={() => setWeightRegister(null)}
                className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                Cerrar
              </ReliableActionButton>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
              <div className="mb-3 flex flex-wrap gap-2">
                <ReliableActionButton
                  type="button"
                  onClick={() => setWeightRegisterScope("template")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    weightRegisterScope === "template"
                      ? "bg-cyan-300 text-slate-950"
                      : "border border-white/20 bg-white/5 text-slate-200"
                  }`}
                >
                  Solo template
                </ReliableActionButton>
                <ReliableActionButton
                  type="button"
                  onClick={() => setWeightRegisterScope("alumno")}
                  disabled={!alumnoDestinoActivo}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    weightRegisterScope === "alumno"
                      ? "bg-emerald-300 text-slate-950"
                      : "border border-white/20 bg-white/5 text-slate-200"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  Sincronizar con alumno
                </ReliableActionButton>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="text-xs uppercase tracking-wide text-slate-300">
                  Fecha del registro
                  <input
                    type="date"
                    value={weightForm.fecha}
                    onChange={(event) => setWeightForm((prev) => ({ ...prev, fecha: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs uppercase tracking-wide text-slate-300">
                  Nro serie
                  <input
                    value={weightForm.nroSerie}
                    onChange={(event) => setWeightForm((prev) => ({ ...prev, nroSerie: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs uppercase tracking-wide text-slate-300">
                  Nro rep
                  <input
                    value={weightForm.nroRep}
                    onChange={(event) => setWeightForm((prev) => ({ ...prev, nroRep: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs uppercase tracking-wide text-slate-300">
                  Peso
                  <input
                    value={weightForm.pesoKg}
                    onChange={(event) => setWeightForm((prev) => ({ ...prev, pesoKg: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-end">
                <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Molestia?
                  <input
                    type="checkbox"
                    checked={weightForm.molestia}
                    onChange={(event) =>
                      setWeightForm((prev) => ({ ...prev, molestia: event.target.checked }))
                    }
                    className="h-4 w-4"
                  />
                </label>

                <label className="text-xs uppercase tracking-wide text-slate-300">
                  Comentario
                  <input
                    value={weightForm.comentario}
                    onChange={(event) => setWeightForm((prev) => ({ ...prev, comentario: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-sm text-white"
                  />
                </label>

                <ReliableActionButton
                  type="button"
                  onClick={guardarRegistroPeso}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Guardar
                </ReliableActionButton>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/55">
              <table className="min-w-full text-xs text-slate-200">
                <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Nro. serie</th>
                    <th className="px-3 py-2 text-left">Nro. rep</th>
                    <th className="px-3 py-2 text-left">Peso</th>
                    <th className="px-3 py-2 text-left">Molestia</th>
                    <th className="px-3 py-2 text-left">Comentario</th>
                    <th className="px-3 py-2 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {weightRegisterRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-400" colSpan={7}>
                        Sin registros para este ejercicio.
                      </td>
                    </tr>
                  ) : (
                    weightRegisterRows.map((row) => {
                      const isTemplateRow = templateWeightLogIds.has(row.id);
                      return (
                        <tr key={`register-row-${row.id}`} className="border-t border-white/10">
                          <td className="px-3 py-2">{row.fecha || "-"}</td>
                          <td className="px-3 py-2">{row.nroSerie}</td>
                          <td className="px-3 py-2">{row.nroRep}</td>
                          <td className="px-3 py-2">{row.pesoKg}</td>
                          <td className="px-3 py-2">{row.molestia ? "Si" : "No"}</td>
                          <td className="px-3 py-2">{row.comentario || "SIN DATOS"}</td>
                          <td className="px-3 py-2">
                            {isTemplateRow ? (
                              <ReliableActionButton
                                type="button"
                                onClick={() => eliminarTemplatePeso(row.id)}
                                className="rounded-md border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100"
                              >
                                Eliminar
                              </ReliableActionButton>
                            ) : (
                              <span className="text-[11px] text-slate-500">Sin accion</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
