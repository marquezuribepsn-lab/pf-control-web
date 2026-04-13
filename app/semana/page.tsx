"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAlumnos } from "../../components/AlumnosProvider";
import { useCategories } from "../../components/CategoriesProvider";
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

type TemplateExerciseDraft = {
  id: string;
  ejercicioId: string;
  series: string;
  repeticiones: string;
  descanso: string;
  carga: string;
  especificaciones: TemplateExerciseSpec[];
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

const STORAGE_KEY = "pf-control-semana-plan";
const ALUMNO_NOTIFICATIONS_KEY = "pf-control-alumno-week-notifications";
const GENERAL_OWNER_KEY = "general:plan";
const AUTO_OBJECTIVE_PREFIX = "[AUTO-PRESCRIPCION]";

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createTemplateSpec = (): TemplateExerciseSpec => ({
  id: createId(),
  nombre: "",
  valor: "",
});

const createTemplateExercise = (): TemplateExerciseDraft => ({
  id: createId(),
  ejercicioId: "",
  series: "0",
  repeticiones: "0",
  descanso: "0",
  carga: "",
  especificaciones: [],
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

export default function SemanaPage() {
  const { jugadoras } = usePlayers();
  const { alumnos } = useAlumnos();
  const { categorias } = useCategories();
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

  const migratedRef = useRef(false);
  const alumnoPlanHashesRef = useRef<Record<string, string>>({});
  const alumnoNotificationCooldownRef = useRef<Record<string, number>>({});
  const [tipoFiltro, setTipoFiltro] = useState<PersonaTipo>("jugadoras");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [selectedOwnerKey, setSelectedOwnerKey] = useState<string>(GENERAL_OWNER_KEY);
  const [nuevoDiaPorSemana, setNuevoDiaPorSemana] = useState<Record<string, string>>({});
  const [nuevaPlanPorSemana, setNuevaPlanPorSemana] = useState<Record<string, string>>({});
  const [templatesTab, setTemplatesTab] = useState<"nuevo" | "mis">("mis");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
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

  const categoriasJugadoras = useMemo(() => {
    const fromJugadoras = jugadoras
      .map((jugadora) => jugadora.categoria?.trim() || "")
      .filter((cat) => Boolean(cat));
    const fromCategorias = categorias.filter((cat) => cat.habilitada).map((cat) => cat.nombre);
    return Array.from(new Set([...fromCategorias, ...fromJugadoras]));
  }, [categorias, jugadoras]);

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

  const personasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return todasLasPersonas.filter((persona) => {
      if (persona.tipo !== tipoFiltro) return false;

      if (
        tipoFiltro === "jugadoras" &&
        categoriaFiltro !== "todas" &&
        (persona.categoria || "") !== categoriaFiltro
      ) {
        return false;
      }

      return persona.nombre.toLowerCase().includes(texto);
    });
  }, [busqueda, categoriaFiltro, tipoFiltro, todasLasPersonas]);

  const personaSeleccionada = useMemo(() => {
    return todasLasPersonas.find((persona) => toOwnerKey(persona) === selectedOwnerKey) || null;
  }, [selectedOwnerKey, todasLasPersonas]);

  useEffect(() => {
    if (!loaded || !isSemanaStoreV3(store)) return;

    const hasSelected = store.planes.some((plan) => plan.ownerKey === selectedOwnerKey);
    if (hasSelected) return;

    const fromFilter = personasFiltradas[0];
    if (fromFilter) {
      const key = toOwnerKey(fromFilter);
      setSelectedOwnerKey(key);
      setStore((prev) => (isSemanaStoreV3(prev) ? ensurePlanForPersona(prev, fromFilter) : prev));
      return;
    }

    const firstPlan = store.planes[0];
    if (firstPlan) {
      setSelectedOwnerKey(firstPlan.ownerKey);
    }
  }, [loaded, personasFiltradas, selectedOwnerKey, setStore, store]);

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

  const templatesCompatibles = useMemo(() => {
    if (!personaSeleccionada) return [];
    return storeV3.templates.filter((template) => {
      if (template.tipo !== personaSeleccionada.tipo) return false;
      if (template.tipo === "jugadoras") {
        if (!template.categoria) return true;
        return template.categoria === (personaSeleccionada.categoria || "");
      }
      return true;
    });
  }, [personaSeleccionada, storeV3.templates]);

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

  const templateDraftWeek = useMemo(
    () => templateDraft.semanas.find((week) => week.id === templateDraftWeekId) || null,
    [templateDraft.semanas, templateDraftWeekId]
  );

  const templateDraftDay = useMemo(
    () => templateDraftWeek?.dias.find((day) => day.id === templateDraftDayId) || null,
    [templateDraftDayId, templateDraftWeek]
  );

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
            const currentTraining = day.entrenamiento || createTemplateDayTraining();
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
      semanas: cloneSemanas(templateDraft.semanas).map((week) => ({
        ...week,
        dias: week.dias.map((day) => ({
          ...day,
          planificacion: (day.planificacion || "").trim() || day.entrenamiento?.titulo || "",
          objetivo: (day.objetivo || "").trim() || day.entrenamiento?.descripcion || "",
        })),
      })),
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

  const aplicarPlantilla = (templateId?: string) => {
    const id = templateId || selectedTemplateId;
    if (!id) {
      notifyWarning("Selecciona un template para aplicar");
      return;
    }

    const plantilla = storeV3.templates.find((item) => item.id === id);
    if (!plantilla) {
      notifyError("No se encontro el template seleccionado");
      return;
    }

    if (personaSeleccionada) {
      if (plantilla.tipo !== personaSeleccionada.tipo) {
        notifyError("El template no coincide con el tipo de persona seleccionada");
        return;
      }

      if (
        plantilla.tipo === "jugadoras" &&
        plantilla.categoria &&
        plantilla.categoria !== (personaSeleccionada.categoria || "")
      ) {
        notifyError("La categoria del template no coincide con la jugadora seleccionada");
        return;
      }
    }

    if (
      !window.confirm(
        "Aplicar este template reemplazara las semanas actuales de la persona seleccionada. Continuar?"
      )
    ) {
      notifyWarning("Operacion cancelada");
      return;
    }

    markManualSaveIntent(STORAGE_KEY);
    actualizarSemanasSeleccionadas(() => cloneSemanas(plantilla.semanas));
    setSelectedTemplateId(id);
    notifySuccess("Template aplicado correctamente");
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

  const tituloFiltro =
    tipoFiltro === "jugadoras"
      ? `${personasFiltradas.length} jugadoras encontradas`
      : `${personasFiltradas.length} alumnos encontrados`;

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

  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
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
          <h1 className="text-3xl font-bold">Semana</h1>
          <p className="text-sm text-slate-300">
            Selecciona una persona y gestiona su plan semanal por semanas y dias.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap gap-2">
            <ReliableActionButton
              onClick={agregarSemana}
              disabled={!planSeleccionado}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Semana
            </ReliableActionButton>
            <ReliableActionButton
              onClick={resetearPlanSeleccionado}
              disabled={!planSeleccionado}
              className="rounded-xl border border-slate-500 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Resetear plan seleccionado
            </ReliableActionButton>
          </div>

          <ReliableActionButton
            type="button"
            onClick={() => setHistorialScreenOpen((prev) => !prev)}
            className="w-full rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 sm:w-auto"
          >
            {historialScreenOpen ? "Ocultar funciones" : "Ver mas funciones"}
          </ReliableActionButton>
        </div>
      </div>

      {alumnoNotifications.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-amber-100">Alertas de alumnos</h2>
              <p className="text-xs text-slate-300">
                Registro automatico de cambios recientes en semanas de alumnos.
              </p>
            </div>
            <ReliableActionButton
              type="button"
              onClick={() => setAlumnoNotifications([])}
              className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200"
            >
              Limpiar alertas
            </ReliableActionButton>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {alumnoNotifications.slice(0, 6).map((notification) => (
              <ReliableActionButton
                key={notification.id}
                type="button"
                onClick={() => {
                  setTipoFiltro("alumnos");
                  setSelectedOwnerKey(notification.ownerKey);
                }}
                className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-left transition hover:border-amber-300/35 hover:bg-slate-900"
              >
                <p className="text-sm font-semibold text-white">{notification.alumnoNombre}</p>
                <p className="mt-1 text-xs text-slate-300">{notification.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-amber-200">
                  <span className="rounded-full border border-amber-300/20 px-2 py-1">
                    {notification.totalSemanas} semanas
                  </span>
                  <span className="rounded-full border border-amber-300/20 px-2 py-1">
                    {notification.totalDias} dias
                  </span>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  {new Date(notification.createdAt).toLocaleString("es-AR")}
                </p>
              </ReliableActionButton>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold">Browser de personas</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Tipo</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as PersonaTipo)}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="jugadoras">Jugadoras</option>
              <option value="alumnos">Alumnos</option>
            </select>
          </div>

          {tipoFiltro === "jugadoras" && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                Categoria
              </label>
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="todas">Todas</option>
                {categoriasJugadoras.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={tipoFiltro === "jugadoras" ? "md:col-span-2" : "md:col-span-3"}>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
              Buscar persona
            </label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Escribe nombre..."
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-300">{tituloFiltro}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {personasFiltradas.slice(0, 20).map((persona) => {
            const ownerKey = toOwnerKey(persona);
            const isSelected = ownerKey === selectedOwnerKey;

            return (
              <ReliableActionButton
                key={ownerKey}
                type="button"
                onClick={() => seleccionarPersona(persona)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  isSelected
                    ? "border-cyan-300 bg-cyan-400/25 text-cyan-100"
                    : "border-cyan-400/30 bg-cyan-400/10"
                }`}
              >
                {persona.nombre}
                {persona.categoria ? ` - ${persona.categoria}` : ""}
              </ReliableActionButton>
            );
          })}
          {personasFiltradas.length === 0 && (
            <p className="text-xs text-slate-400">No hay resultados para ese filtro.</p>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-[30px] border border-cyan-300/20 bg-gradient-to-b from-slate-900/85 via-slate-900/65 to-slate-950/75 p-5 shadow-[0_20px_55px_-28px_rgba(34,211,238,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">Templates</h2>
              <p className="text-xs text-slate-300">
                Crea planes base limpios y reutilizables para asignar en segundos.
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
          <div className="mt-5 rounded-2xl bg-slate-950/40 p-5 ring-1 ring-white/10">
            <h3 className="text-base font-semibold text-white">Biblioteca de templates</h3>
            <p className="mt-1 text-xs text-slate-300">
              Gestiona, edita y aplica tus templates guardados.
            </p>

            {templatesFiltrados.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-slate-900/60 p-4 text-sm text-slate-300">
                No hay templates guardados con ese filtro.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {templatesFiltrados.map((template) => {
                  const totalDias = template.semanas.reduce(
                    (acc, week) => acc + week.dias.length,
                    0
                  );
                  const isCompatible = templatesCompatibles.some(
                    (item) => item.id === template.id
                  );

                  return (
                    <article
                      key={template.id}
                      className="rounded-2xl bg-slate-900/55 p-4 ring-1 ring-white/10 transition hover:ring-cyan-300/30"
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
                            {template.semanas.length} semanas · {totalDias} dias ·
                            actualizado {new Date(template.updatedAt || template.createdAt || 0).toLocaleString("es-AR")}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <ReliableActionButton
                            type="button"
                            onClick={() => editarTemplate(template.id)}
                            className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                          >
                            Editar
                          </ReliableActionButton>
                          <ReliableActionButton
                            type="button"
                            onClick={() => aplicarPlantilla(template.id)}
                            disabled={!personaSeleccionada || !isCompatible}
                            className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Aplicar
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
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-3xl bg-slate-950/45 p-5 ring-1 ring-cyan-300/20 shadow-[0_14px_35px_-25px_rgba(34,211,238,0.7)]">
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

            <div className="rounded-3xl bg-slate-950/20 p-5 ring-1 ring-white/10">
              <div className="pb-5">
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
                <div className="mt-5 border-t border-white/10 pt-5">
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

                  {templateDraftWeek && templateDraftDay && templateDraftDay.entrenamiento ? (
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
                ) : !templateDraftDay.entrenamiento ? (
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
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                        Titulo sesion
                        <input
                          value={templateDraftDay.entrenamiento.titulo}
                          onChange={(e) =>
                            actualizarEntrenamientoDiaTemplate(
                              templateDraftWeek.id,
                              templateDraftDay.id,
                              (training) => ({ ...training, titulo: e.target.value })
                            )
                          }
                          className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                        Duracion
                        <input
                          value={templateDraftDay.entrenamiento.duracion}
                          onChange={(e) =>
                            actualizarEntrenamientoDiaTemplate(
                              templateDraftWeek.id,
                              templateDraftDay.id,
                              (training) => ({ ...training, duracion: e.target.value })
                            )
                          }
                          className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                          placeholder="60 min"
                        />
                      </label>
                      <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300 md:col-span-1">
                        Descripcion
                        <input
                          value={templateDraftDay.entrenamiento.descripcion}
                          onChange={(e) =>
                            actualizarEntrenamientoDiaTemplate(
                              templateDraftWeek.id,
                              templateDraftDay.id,
                              (training) => ({ ...training, descripcion: e.target.value })
                            )
                          }
                          className="w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                        />
                      </label>
                    </div>

                    <div className="space-y-3">
                      {templateDraftDay.entrenamiento.bloques.map((block, blockIndex) => {
                        const blockGridColumns = block.ejercicios[0]?.especificaciones || [];

                        return (
                          <article
                            key={block.id}
                            className={`px-1 ${blockIndex > 0 ? "border-t border-white/10 pt-4" : "pt-1"}`}
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
                              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/55 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                                  Configuracion grilla plan:
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  Puede agregar/quitar columnas dinamicamente.
                                </p>

                                <div className="mt-3 space-y-2">
                                  <input
                                    value="Series:"
                                    readOnly
                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                  />
                                  <input
                                    value="Rep.:"
                                    readOnly
                                    className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-slate-200"
                                  />
                                  <input
                                    value="Desc.:"
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
                                className="rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm text-white"
                                placeholder="Objetivo bloque"
                              />
                            </div>

                            <div className="mt-2 space-y-2">
                              {block.ejercicios.map((exercise) => (
                                <div
                                  key={exercise.id}
                                  className="rounded-xl border border-white/10 bg-slate-900/20 p-3"
                                >
                                  <div className="grid gap-2 md:grid-cols-5">
                                    <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300 md:col-span-2">
                                      Ejercicio
                                      <select
                                        value={exercise.ejercicioId}
                                        onChange={(e) =>
                                          actualizarEjercicioTemplate(
                                            templateDraftWeek.id,
                                            templateDraftDay.id,
                                            block.id,
                                            exercise.id,
                                            "ejercicioId",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                      >
                                        <option value="">Seleccione ejercicio</option>
                                        {ejercicios.map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.nombre}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                                      Series
                                      <input
                                        value={exercise.series}
                                        onChange={(e) =>
                                          actualizarEjercicioTemplate(
                                            templateDraftWeek.id,
                                            templateDraftDay.id,
                                            block.id,
                                            exercise.id,
                                            "series",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        placeholder="0"
                                      />
                                    </label>

                                    <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                                      Repeticiones
                                      <input
                                        value={exercise.repeticiones}
                                        onChange={(e) =>
                                          actualizarEjercicioTemplate(
                                            templateDraftWeek.id,
                                            templateDraftDay.id,
                                            block.id,
                                            exercise.id,
                                            "repeticiones",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        placeholder="0"
                                      />
                                    </label>

                                    <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                                      Descanso
                                      <input
                                        value={exercise.descanso}
                                        onChange={(e) =>
                                          actualizarEjercicioTemplate(
                                            templateDraftWeek.id,
                                            templateDraftDay.id,
                                            block.id,
                                            exercise.id,
                                            "descanso",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        placeholder="0"
                                      />
                                    </label>
                                  </div>

                                  {exercise.especificaciones.length > 0 ? (
                                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                                      {exercise.especificaciones.map((spec, specIndex) => (
                                        <label
                                          key={spec.id}
                                          className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300"
                                        >
                                          {spec.nombre || `Campo ${specIndex + 1}`}
                                          <input
                                            value={spec.valor}
                                            onChange={(e) =>
                                              actualizarEspecificacionEjercicio(
                                                templateDraftWeek.id,
                                                templateDraftDay.id,
                                                block.id,
                                                exercise.id,
                                                spec.id,
                                                "valor",
                                                e.target.value
                                              )
                                            }
                                            className="w-full rounded border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                            placeholder="0"
                                          />
                                        </label>
                                      ))}
                                    </div>
                                  ) : null}

                                  <div className="mt-2 flex flex-wrap gap-2">
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
                                      className="rounded-full border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100"
                                    >
                                      Eliminar ejercicio
                                    </ReliableActionButton>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-950/70 p-2 ring-1 ring-white/10 backdrop-blur">
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
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100"
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
              <div className="rounded-2xl bg-slate-950/45 p-4 ring-1 ring-cyan-300/15">
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

      {historialScreenOpen ? (
        <section
          className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/80 p-4 sm:p-6"
          onClick={() => setHistorialScreenOpen(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Historial y Comparacion</h2>
                <p className="mt-1 text-xs text-slate-300">
                  Guarda versiones del plan y compara cambios semana a semana.
                </p>
              </div>

              <ReliableActionButton
                type="button"
                onClick={() => setHistorialScreenOpen(false)}
                className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                Cerrar
              </ReliableActionButton>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <input
                value={historialEtiqueta}
                onChange={(e) => setHistorialEtiqueta(e.target.value)}
                placeholder="Etiqueta opcional (ej: Pretemporada)"
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
              <ReliableActionButton
                onClick={guardarEnHistorial}
                disabled={!planSeleccionado}
                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Guardar version en historial
              </ReliableActionButton>
              <p className="text-xs text-slate-300">Versiones guardadas: {historialPlanSeleccionado.length}</p>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <select
                value={compareAId}
                onChange={(e) => setCompareAId(e.target.value)}
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">Comparacion A (historial)</option>
                {historialPlanSeleccionado.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.etiqueta ? `${item.etiqueta} - ` : ""}
                    {formatHistoryDate(item.createdAt)}
                  </option>
                ))}
              </select>

              <select
                value={compareBId}
                onChange={(e) => setCompareBId(e.target.value)}
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="__current__">Comparar contra plan actual</option>
                {historialPlanSeleccionado.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.etiqueta ? `${item.etiqueta} - ` : ""}
                    {formatHistoryDate(item.createdAt)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex gap-2">
              <ReliableActionButton
                onClick={restaurarDesdeHistorial}
                disabled={!compareAId || !planSeleccionado}
                className="rounded-xl border border-amber-300/40 px-4 py-2 text-sm font-semibold text-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Restaurar version A
              </ReliableActionButton>
            </div>

            {comparacion && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm">
                <p className="font-semibold text-white">
                  Estado de comparacion: {comparacion.iguales ? "Sin cambios" : "Con cambios"}
                </p>

                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Version A</p>
                    <p className="text-xs text-slate-300">Semanas: {comparacion.statsA.totalSemanas}</p>
                    <p className="text-xs text-slate-300">Dias: {comparacion.statsA.totalDias}</p>
                    <p className="text-xs text-slate-300">Dias con sesion: {comparacion.statsA.diasConSesion}</p>
                    <p className="text-xs text-slate-300">Bloques: {comparacion.statsA.totalBloques}</p>
                    <p className="text-xs text-slate-300">Ejercicios: {comparacion.statsA.totalEjercicios}</p>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Version B</p>
                    <p className="text-xs text-slate-300">Semanas: {comparacion.statsB.totalSemanas}</p>
                    <p className="text-xs text-slate-300">Dias: {comparacion.statsB.totalDias}</p>
                    <p className="text-xs text-slate-300">Dias con sesion: {comparacion.statsB.diasConSesion}</p>
                    <p className="text-xs text-slate-300">Bloques: {comparacion.statsB.totalBloques}</p>
                    <p className="text-xs text-slate-300">Ejercicios: {comparacion.statsB.totalEjercicios}</p>
                  </div>
                </div>

                {!comparacion.iguales && (
                  <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-cyan-300">
                      Semanas con diferencias
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {comparacion.semanasConCambios.map((semanaNombre) => (
                        <span
                          key={semanaNombre}
                          className="rounded-full border border-cyan-400/30 px-2 py-1 text-xs text-cyan-200"
                        >
                          {semanaNombre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {insightsUnicos && (
              <section className="mt-4 rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-slate-900/85 to-slate-800/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-cyan-100">Motor Unico de Microciclo</h2>
                  <span className="rounded-full border border-cyan-300/35 px-3 py-1 text-xs font-semibold text-cyan-200">
                    ADN {insightsUnicos.fingerprint}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
                    <p className="text-slate-400">Indice microciclo</p>
                    <p className="text-lg font-bold text-emerald-300">{insightsUnicos.microcycleScore}/100</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
                    <p className="text-slate-400">Dias con sesion</p>
                    <p className="text-lg font-bold text-white">
                      {insightsUnicos.diasConSesion}/{insightsUnicos.totalDias}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
                    <p className="text-slate-400">Variedad semanal</p>
                    <p className="text-lg font-bold text-cyan-200">{insightsUnicos.variedad}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
                    <p className="text-slate-400">Densidad</p>
                    <p className="text-lg font-bold text-amber-200">{insightsUnicos.densidad}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Sugerencias inteligentes</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-200">
                    {insightsUnicos.sugerencias.map((sugerencia) => (
                      <li key={sugerencia}>- {sugerencia}</li>
                    ))}
                  </ul>
                  {insightsUnicos.acciones.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {insightsUnicos.acciones.map((action) => (
                        <ReliableActionButton
                          key={action.id}
                          type="button"
                          onClick={() => applySuggestion(action.id)}
                          style={{
                            width: "100%",
                            border: "1px solid rgba(56, 189, 248, 0.35)",
                            borderRadius: 14,
                            padding: "12px 14px",
                            background:
                              "linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(16, 185, 129, 0.14))",
                            color: "#e2f8ff",
                            textAlign: "left",
                            cursor: "pointer",
                            boxShadow: "0 12px 30px rgba(2, 132, 199, 0.14)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              letterSpacing: 0.4,
                              textTransform: "uppercase",
                              marginBottom: 4,
                            }}
                          >
                            {action.title}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "rgba(226, 248, 255, 0.78)",
                              lineHeight: 1.45,
                            }}
                          >
                            {action.detail}
                          </div>
                        </ReliableActionButton>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            )}
          </div>
        </section>
      ) : null}

      {!planSeleccionado ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-slate-900/50 p-6 text-sm text-slate-300">
          Selecciona una jugadora o alumno para crear/editar su plan semanal.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            Plan activo: <span className="font-semibold text-white">{planSeleccionado.nombre}</span>
            {planSeleccionado.categoria ? ` (${planSeleccionado.categoria})` : ""}
          </div>

          {planSeleccionado.semanas.map((semana) => (
            <section
              key={semana.id}
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                      Nombre semana
                    </label>
                    <input
                      value={semana.nombre}
                      onChange={(e) => actualizarSemana(semana.id, { nombre: e.target.value })}
                      className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                      Objetivo
                    </label>
                    <input
                      value={semana.objetivo}
                      onChange={(e) => actualizarSemana(semana.id, { objetivo: e.target.value })}
                      className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <ReliableActionButton
                    onClick={() => duplicarSemana(semana.id)}
                    className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs font-semibold text-cyan-200"
                  >
                    Duplicar semana
                  </ReliableActionButton>
                  <ReliableActionButton
                    onClick={() => eliminarSemana(semana.id)}
                    className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-200"
                  >
                    Eliminar semana
                  </ReliableActionButton>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {semana.dias.map((dia) => (
                  <div key={dia.id} className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Dia
                    </label>
                    <input
                      value={dia.dia}
                      onChange={(e) => actualizarDia(semana.id, dia.id, "dia", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm"
                    />

                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Sesion vinculada
                    </label>
                    <select
                      value={dia.sesionId || ""}
                      onChange={(e) => {
                        const nextSesionId = e.target.value;

                        if (!nextSesionId) {
                          vincularSesionDia(semana.id, dia.id, "", false);
                          return;
                        }

                        const hasManualText =
                          Boolean((dia.planificacion || "").trim()) ||
                          Boolean((dia.objetivo || "").trim());

                        const shouldReplace = hasManualText
                          ? window.confirm(
                              "Quieres reemplazar planificacion y objetivo del dia con los datos de la sesion? Aceptar = reemplazar / Cancelar = mantener textos actuales"
                            )
                          : true;

                        vincularSesionDia(semana.id, dia.id, nextSesionId, shouldReplace);
                      }}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm"
                    >
                      <option value="">Sin sesion vinculada</option>
                      {sesionesDisponibles.map((sesion) => (
                        <option key={sesion.id} value={sesion.id}>
                          {sesion.titulo}
                        </option>
                      ))}
                    </select>

                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Planificacion
                    </label>
                    <textarea
                      value={dia.planificacion}
                      onChange={(e) =>
                        actualizarDia(semana.id, dia.id, "planificacion", e.target.value)
                      }
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm"
                    />

                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Objetivo del dia
                    </label>
                    <textarea
                      value={dia.objetivo || ""}
                      onChange={(e) => actualizarDia(semana.id, dia.id, "objetivo", e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-slate-700 px-3 py-2 text-sm"
                    />

                    {dia.sesionId && (
                      <div className="mt-3 rounded-lg border border-cyan-400/25 bg-slate-900/60 p-3">
                        {(() => {
                          const linked = getEffectiveLinkedSession(dia.sesionId || "");
                          if (!linked) {
                            return (
                              <p className="text-xs text-rose-300">
                                La sesion vinculada ya no existe o no esta disponible.
                              </p>
                            );
                          }

                          const { sesion, bloques, isPersonalized, prescripcion } = linked;

                          return (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                                {sesion.titulo} - bloques {bloques.length}
                              </p>
                              {isPersonalized ? (
                                <p className="text-[11px] text-emerald-300">
                                  Prescripcion individual activa: {prescripcion?.resumen || "Ajuste personalizado"}
                                </p>
                              ) : null}
                              {bloques.length === 0 ? (
                                <p className="text-xs text-slate-400">Esta sesion no tiene bloques todavia.</p>
                              ) : (
                                <div className="space-y-2">
                                  {bloques.map((bloque) => (
                                    <div
                                      key={bloque.id}
                                      className="rounded border border-white/10 bg-slate-800/80 p-2"
                                    >
                                      <p className="text-xs font-semibold text-white">{bloque.titulo}</p>
                                      <p className="text-[11px] text-slate-300">
                                        {bloque.objetivo || "Sin objetivo"}
                                      </p>
                                      <ul className="mt-1 space-y-1 text-[11px] text-slate-300">
                                        {(bloque.ejercicios || []).map((ejercicio, idx) => (
                                          <li key={`${bloque.id}-${idx}`}>
                                            {getExerciseName(ejercicio.ejercicioId)} - {ejercicio.series}x{" "}
                                            {ejercicio.repeticiones}
                                            {ejercicio.descanso
                                              ? ` - Descanso ${ejercicio.descanso}`
                                              : ""}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <ReliableActionButton
                      onClick={() => eliminarDia(semana.id, dia.id)}
                      className="mt-3 rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-200"
                    >
                      Eliminar dia
                    </ReliableActionButton>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-slate-800/40 p-4">
                <h3 className="text-sm font-semibold">Agregar dia a {semana.nombre}</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <input
                    value={nuevoDiaPorSemana[semana.id] || ""}
                    onChange={(e) =>
                      setNuevoDiaPorSemana((prev) => ({ ...prev, [semana.id]: e.target.value }))
                    }
                    placeholder="Dia (Ej: Lunes)"
                    className="rounded-xl border border-white/20 bg-slate-700 px-3 py-2 text-sm"
                  />
                  <input
                    value={nuevaPlanPorSemana[semana.id] || ""}
                    onChange={(e) =>
                      setNuevaPlanPorSemana((prev) => ({ ...prev, [semana.id]: e.target.value }))
                    }
                    placeholder="Planificacion"
                    className="rounded-xl border border-white/20 bg-slate-700 px-3 py-2 text-sm md:col-span-2"
                  />
                </div>
                <ReliableActionButton
                  onClick={() => agregarDia(semana.id)}
                  className="mt-3 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Agregar dia
                </ReliableActionButton>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
