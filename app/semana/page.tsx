"use client";

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

type DiaPlan = {
  id: string;
  dia: string;
  planificacion: string;
  objetivo?: string;
  sesionId?: string;
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

const toOwnerKey = (persona: PersonaItem) =>
  `${persona.tipo}:${persona.nombre.trim().toLowerCase()}`;

const cloneSemanas = (semanas: SemanaPlan[]): SemanaPlan[] =>
  semanas.map((semana) => ({
    ...semana,
    id: createId(),
    dias: semana.dias.map((dia) => ({ ...dia, id: createId() })),
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
  const [templateNombre, setTemplateNombre] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [historialEtiqueta, setHistorialEtiqueta] = useState("");
  const [compareAId, setCompareAId] = useState("");
  const [compareBId, setCompareBId] = useState("__current__");
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

  useEffect(() => {
    if (!selectedTemplateId) return;
    const exists = templatesCompatibles.some((template) => template.id === selectedTemplateId);
    if (!exists) {
      setSelectedTemplateId(templatesCompatibles[0]?.id || "");
    }
  }, [selectedTemplateId, templatesCompatibles]);

  const seleccionarPersona = (persona: PersonaItem) => {
    const key = toOwnerKey(persona);
    setSelectedOwnerKey(key);
  };

  const crearPlanParaPersonaSeleccionada = () => {
    if (!personaSeleccionada) return;

    setStore((prev) => (isSemanaStoreV3(prev) ? ensurePlanForPersona(prev, personaSeleccionada) : prev));
    showToast(`Plan creado para ${personaSeleccionada.nombre}`, "success", 2200);
  };

  const actualizarSemanasSeleccionadas = (
    updater: (semanasActuales: SemanaPlan[]) => SemanaPlan[]
  ) => {
    if (!selectedOwnerKey) return;

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

  const guardarPlantilla = () => {
    if (!personaSeleccionada || !planSeleccionado) return;
    const nombre = templateNombre.trim();
    if (!nombre) return;

    const plantilla: PlanTemplate = {
      id: createId(),
      nombre,
      tipo: personaSeleccionada.tipo,
      categoria: personaSeleccionada.tipo === "jugadoras" ? personaSeleccionada.categoria : undefined,
      semanas: cloneSemanas(planSeleccionado.semanas),
    };

    setStore((prev) => {
      if (!isSemanaStoreV3(prev)) return prev;
      return { ...prev, templates: [plantilla, ...prev.templates] };
    });

    setTemplateNombre("");
    setSelectedTemplateId(plantilla.id);
    notifySuccess("Plantilla guardada correctamente");
  };

  const aplicarPlantilla = () => {
    if (!selectedTemplateId) return;

    const plantilla = templatesCompatibles.find((item) => item.id === selectedTemplateId);
    if (!plantilla) {
      notifyError("No se encontro la plantilla seleccionada");
      return;
    }

    if (!window.confirm("Aplicar esta plantilla reemplazara las semanas actuales de la persona seleccionada. Continuar?")) {
      notifyWarning("Operacion cancelada");
      return;
    }

    actualizarSemanasSeleccionadas(() => cloneSemanas(plantilla.semanas));
    notifySuccess("Plantilla aplicada correctamente");
  };

  const eliminarPlantilla = () => {
    if (!selectedTemplateId) return;

    setStore((prev) => {
      if (!isSemanaStoreV3(prev)) return prev;
      return {
        ...prev,
        templates: prev.templates.filter((template) => template.id !== selectedTemplateId),
      };
    });

    setSelectedTemplateId("");
    notifySuccess("Plantilla eliminada correctamente");
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

  const guardarCambiosSemanales = () => {
    markManualSaveIntent(STORAGE_KEY);
    markManualSaveIntent(ALUMNO_NOTIFICATIONS_KEY);
  };

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 text-slate-100 sm:p-6">
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
          <h1 className="text-2xl font-bold sm:text-3xl">Semana</h1>
          <p className="text-sm text-slate-300">
            Selecciona una persona y gestiona su plan semanal por semanas y dias.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={guardarCambiosSemanales}
            className="rounded-xl border border-emerald-300/45 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/10"
          >
            Guardar cambios
          </button>
          <button
            onClick={agregarSemana}
            disabled={!planSeleccionado}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            + Semana
          </button>
          <button
            onClick={resetearPlanSeleccionado}
            disabled={!planSeleccionado}
            className="rounded-xl border border-slate-500 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Resetear plan seleccionado
          </button>
        </div>
      </div>

      {alumnoNotifications.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-500/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-amber-100">Alertas de alumnos</h2>
              <p className="text-xs text-slate-300">
                Registro automatico de cambios recientes en semanas de alumnos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAlumnoNotifications([])}
              className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200"
            >
              Limpiar alertas
            </button>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {alumnoNotifications.slice(0, 6).map((notification) => (
              <button
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
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
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
              <button
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
              </button>
            );
          })}
          {personasFiltradas.length === 0 && (
            <p className="text-xs text-slate-400">No hay resultados para ese filtro.</p>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold">Plantillas</h2>
        <p className="mt-1 text-xs text-slate-300">
          Guarda y aplica plantillas reutilizables por perfil
          {personaSeleccionada?.tipo === "jugadoras" ? " y categoria" : ""}.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            value={templateNombre}
            onChange={(e) => setTemplateNombre(e.target.value)}
            placeholder="Nombre de plantilla"
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <button
            onClick={guardarPlantilla}
            disabled={!personaSeleccionada || !planSeleccionado || !templateNombre.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar plantilla actual
          </button>
          <div className="text-xs text-slate-300">
            Compatibles: {templatesCompatibles.length}
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar plantilla</option>
            {templatesCompatibles.map((template) => (
              <option key={template.id} value={template.id}>
                {template.nombre}
                {template.categoria ? ` - ${template.categoria}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={aplicarPlantilla}
            disabled={!selectedTemplateId || !planSeleccionado}
            className="rounded-xl border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Aplicar plantilla
          </button>
          <button
            onClick={eliminarPlantilla}
            disabled={!selectedTemplateId}
            className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Eliminar plantilla
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold">Historial y Comparacion</h2>
        <p className="mt-1 text-xs text-slate-300">
          Guarda versiones del plan y compara cambios semana a semana.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            value={historialEtiqueta}
            onChange={(e) => setHistorialEtiqueta(e.target.value)}
            placeholder="Etiqueta opcional (ej: Pretemporada)"
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <button
            onClick={guardarEnHistorial}
            disabled={!planSeleccionado}
            className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar version en historial
          </button>
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
          <button
            onClick={restaurarDesdeHistorial}
            disabled={!compareAId || !planSeleccionado}
            className="rounded-xl border border-amber-300/40 px-4 py-2 text-sm font-semibold text-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Restaurar version A
          </button>
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
      </section>

      {insightsUnicos && (
        <section className="mb-6 rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-slate-900/85 to-slate-800/70 p-5">
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
                  <button
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
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {!planSeleccionado ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-slate-900/50 p-4 text-sm text-slate-300 sm:p-6">
          <p>Selecciona una jugadora o alumno para crear/editar su plan semanal.</p>
          {personaSeleccionada ? (
            <button
              type="button"
              onClick={crearPlanParaPersonaSeleccionada}
              className="mt-3 rounded-xl border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
            >
              Crear plan para {personaSeleccionada.nombre}
            </button>
          ) : null}
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
                  <button
                    onClick={() => duplicarSemana(semana.id)}
                    className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs font-semibold text-cyan-200"
                  >
                    Duplicar semana
                  </button>
                  <button
                    onClick={() => eliminarSemana(semana.id)}
                    className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-200"
                  >
                    Eliminar semana
                  </button>
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

                    <button
                      onClick={() => eliminarDia(semana.id, dia.id)}
                      className="mt-3 rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-200"
                    >
                      Eliminar dia
                    </button>
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
                <button
                  onClick={() => agregarDia(semana.id)}
                  className="mt-3 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Agregar dia
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
