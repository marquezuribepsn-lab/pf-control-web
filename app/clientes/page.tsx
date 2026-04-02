"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useAlumnos } from "../../components/AlumnosProvider";
import { useCategories } from "../../components/CategoriesProvider";
import { useDeportes } from "../../components/DeportesProvider";
import { usePlayers } from "../../components/PlayersProvider";
import { useSessions } from "../../components/SessionsProvider";
import { markManualSaveIntent, useSharedState } from "../../components/useSharedState";
import { argentineFoodsBase } from "../../data/argentineFoods";
import { EtiquetasChips, Etiqueta } from "../../components/EtiquetasChips";

type ClienteTipo = "jugadora" | "alumno";
type ClienteEstado = "activo" | "finalizado";
type ClienteTab =
  | "datos"
  | "cuestionario"
  | "plan-entrenamiento"
  | "plan-nutricional"
  | "recetas"
  | "notas"
  | "documentos"
  | "chequeos"
  | "progreso";

type PlanViewTab = "plan-entrenamiento" | "plan-nutricional";

type ClienteView = {
  id: string;
  tipo: ClienteTipo;
  nombre: string;
  estado: ClienteEstado;
  practicaDeporte: boolean;
  deporte?: string;
  categoria?: string;
  posicion?: string;
  fechaNacimiento?: string;
  altura?: string;
  peso?: string;
  club?: string;
  objetivo?: string;
  observaciones?: string;
  wellness?: number;
  carga?: number;
};

type ClienteForm = {
  nombre: string;
  practicaDeporte: "si" | "no";
  estado: ClienteEstado;
  fechaNacimiento: string;
  altura: string;
  peso: string;
  deporte: string;
  categoria: string;
  posicion: string;
  club: string;
  objetivo: string;
  observaciones: string;
};

type ClienteMeta = {
  apellido: string;
  segundoApellido: string;
  email: string;
  codigoPais: string;
  telefono: string;
  pais: string;
  provincia: string;
  calle: string;
  numero: string;
  piso: string;
  depto: string;
  sexo: "masculino" | "femenino";
  startDate: string;
  endDate: string;
  lastCheck: string;
  nextCheck: string;
  objNutricional: string;
  colaboradores: string;
  chats: string;
  tipoAsesoria: "entrenamiento" | "nutricion" | "completa";
  modalidad: "virtual" | "presencial";
  categoriaPlan: string;
  pagoEstado: "confirmado" | "pendiente";
  moneda: string;
  importe: string;
  saldo: string;
  emailPagador: string;
  autoRenewPlan: boolean;
  renewalDays: number;
  tabNotas: Partial<Record<ClienteTab, string>>;
};

type DatosDraft = {
  nombre: string;
  fechaNacimiento: string;
  altura: string;
  peso: string;
  club: string;
  objetivo: string;
  observaciones: string;
  deporte: string;
  categoria: string;
  posicion: string;
};

type PagoRegistro = {
  id: string;
  clientId: string;
  clientName: string;
  fecha: string;
  importe: number;
  moneda: string;
  createdAt: string;
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

type NutritionPlanStatus = {
  hasPlan: boolean;
  planName: string;
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

type VisibleClientColumn = "etiquetas" | "vencimiento" | "ultimo-pago";

type ClientTableColumnKey =
  | "cliente"
  | "tipo"
  | "categoria"
  | "plan"
  | "acciones"
  | VisibleClientColumn;

const INITIAL_FORM: ClienteForm = {
  nombre: "",
  practicaDeporte: "si",
  estado: "activo",
  fechaNacimiento: "",
  altura: "",
  peso: "",
  deporte: "Fútbol",
  categoria: "",
  posicion: "",
  club: "",
  objetivo: "",
  observaciones: "",
};

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const PAGOS_KEY = "pf-control-pagos-v1";
const CLIENT_TABLE_UI_KEY_PREFIX = "pf-control-clientes-table-ui-v1";
const NUTRITION_PLANS_KEY = "pf-control-nutricion-planes-v1";
const NUTRITION_ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
const NUTRITION_CUSTOM_FOODS_KEY = "pf-control-nutricion-alimentos-v1";

const DEFAULT_COLUMN_WIDTHS: Record<ClientTableColumnKey, number> = {
  cliente: 300,
  tipo: 140,
  categoria: 190,
  plan: 180,
  etiquetas: 260,
  vencimiento: 170,
  "ultimo-pago": 190,
  acciones: 260,
};

type ClientTableUiPrefs = {
  visibleExtraColumns: VisibleClientColumn[];
  rowHeight: number;
  columnWidths: Record<ClientTableColumnKey, number>;
  planFilter: PlanFilterType;
};

type PlanFilterType =
  | "todos"
  | "con-plan"
  | "sin-plan"
  | "con-plan-entrenamiento"
  | "con-plan-nutricional"
  | "sin-plan-nutricional";

const DEFAULT_CLIENT_TABLE_UI_PREFS: ClientTableUiPrefs = {
  visibleExtraColumns: ["etiquetas"],
  rowHeight: 96,
  columnWidths: DEFAULT_COLUMN_WIDTHS,
  planFilter: "todos",
};

function sanitizeClientTableUiPrefs(raw: ClientTableUiPrefs): ClientTableUiPrefs {
  const allExtraColumns: VisibleClientColumn[] = ["etiquetas", "vencimiento", "ultimo-pago"];
  const allPlanFilters: PlanFilterType[] = [
    "todos",
    "con-plan",
    "sin-plan",
    "con-plan-entrenamiento",
    "con-plan-nutricional",
    "sin-plan-nutricional",
  ];
  const visibleExtraColumns = Array.isArray(raw.visibleExtraColumns)
    ? allExtraColumns.filter((column) => raw.visibleExtraColumns.includes(column))
    : DEFAULT_CLIENT_TABLE_UI_PREFS.visibleExtraColumns;

  const rowHeight = Number.isFinite(Number(raw.rowHeight))
    ? Math.max(72, Math.min(120, Number(raw.rowHeight)))
    : DEFAULT_CLIENT_TABLE_UI_PREFS.rowHeight;

  const columnWidths = (Object.keys(DEFAULT_COLUMN_WIDTHS) as ClientTableColumnKey[]).reduce(
    (acc, key) => {
      const value = Number(raw.columnWidths?.[key]);
      acc[key] = Number.isFinite(value) ? Math.max(90, Math.min(1100, value)) : DEFAULT_COLUMN_WIDTHS[key];
      return acc;
    },
    {} as Record<ClientTableColumnKey, number>
  );

  const planFilter = allPlanFilters.includes(raw.planFilter)
    ? raw.planFilter
    : DEFAULT_CLIENT_TABLE_UI_PREFS.planFilter;

  return {
    visibleExtraColumns,
    rowHeight,
    columnWidths,
    planFilter,
  };
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

function normalizePersonKey(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  // Considera match cuando comparte al menos 2 tokens, o 1 token largo.
  return shared.length >= 2 || shared.some((token) => token.length >= 5);
}

function sumarDias(dateValue: string, days: number): string {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function parseDateAtStart(dateValue: string): Date | null {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeWhatsAppNumber(meta: ClienteMeta): string {
  let phone = (meta.telefono || "").replace(/\D+/g, "");
  if (!phone) return "";

  if (phone.startsWith("00")) {
    phone = phone.slice(2);
  }

  if (phone.startsWith("549")) {
    return phone;
  }

  if (phone.startsWith("54")) {
    if (phone.length === 12) {
      return `549${phone.slice(2)}`;
    }
    return phone;
  }

  const countryHint = `${meta.codigoPais || ""} ${meta.pais || ""}`.toLowerCase();
  const isArgentina = /arg/.test(countryHint);

  if (isArgentina) {
    if (phone.length === 11 && phone.startsWith("0")) {
      return `549${phone.slice(1)}`;
    }

    if (phone.length === 10) {
      return `549${phone}`;
    }
  }

  return phone;
}

function buildPlanViewHref(clientId: string, tab: PlanViewTab): string {
  const params = new URLSearchParams();
  params.set("cliente", clientId);
  params.set("tab", tab);
  return `/clientes/plan?${params.toString()}`;
}

function buildClientDetailHref(clientId: string, tab: ClienteTab = "datos"): string {
  return `/clientes/ficha/${encodeURIComponent(clientId)}/${tab}`;
}

const TABS: { id: ClienteTab; label: string; icon: string }[] = [
  { id: "datos", label: "Datos generales", icon: "🧾" },
  { id: "cuestionario", label: "Cuestionario", icon: "🧠" },
  { id: "plan-entrenamiento", label: "Plan entrenamiento", icon: "🏋" },
  { id: "plan-nutricional", label: "Plan nutricional", icon: "🥗" },
  { id: "recetas", label: "Recetas", icon: "🍽" },
  { id: "notas", label: "Notas", icon: "📝" },
  { id: "documentos", label: "Documentos", icon: "📁" },
  { id: "chequeos", label: "Chequeos", icon: "✅" },
  { id: "progreso", label: "Progreso", icon: "📈" },
];

const tabPlaceholderCopy: Partial<Record<ClienteTab, string>> = {
  cuestionario: "Cuestionario inicial, antecedentes y habitos.",
  "plan-nutricional": "Lineamientos nutricionales y adherencia semanal.",
  recetas: "Recetas sugeridas y planificacion de comidas.",
  notas: "Notas del profesional y seguimiento del cliente.",
  documentos: "Links o referencias de documentos cargados.",
  chequeos: "Checklist de chequeos periodicos.",
};

const tabVisualConfig: Partial<
  Record<ClienteTab, { badge: string; title: string; hint: string; accent: string }>
> = {
  cuestionario: {
    badge: "Intake",
    title: "Mapa inicial del cliente",
    hint: "Sintetiza antecedentes, limitaciones y contexto para decisiones mas rapidas.",
    accent: "border-fuchsia-300/35 bg-fuchsia-500/10",
  },
  recetas: {
    badge: "Nutricion",
    title: "Biblioteca de recetas aplicables",
    hint: "Registra alternativas practicas y reemplazos por disponibilidad o preferencia.",
    accent: "border-amber-300/35 bg-amber-500/10",
  },
  notas: {
    badge: "Coaching",
    title: "Bitacora profesional",
    hint: "Documenta avances, fricciones y acuerdos para sostener adherencia.",
    accent: "border-cyan-300/35 bg-cyan-500/10",
  },
  documentos: {
    badge: "Recursos",
    title: "Repositorio de soporte",
    hint: "Centraliza links, archivos clave y evidencia compartida con el cliente.",
    accent: "border-indigo-300/35 bg-indigo-500/10",
  },
  chequeos: {
    badge: "Control",
    title: "Panel de chequeos periodicos",
    hint: "Anota mediciones y cumplimiento para detectar desvio temprano.",
    accent: "border-emerald-300/35 bg-emerald-500/10",
  },
};

function defaultMeta(cliente: ClienteView): ClienteMeta {
  const nowDate = new Date().toISOString().slice(0, 10);
  return {
    apellido: "",
    segundoApellido: "",
    email: "",
    codigoPais: "Argentina",
    telefono: "",
    pais: "Argentina",
    provincia: "",
    calle: "",
    numero: "",
    piso: "",
    depto: "",
    sexo: "femenino",
    startDate: nowDate,
    endDate: sumarDias(nowDate, 30),
    lastCheck: "SIN DATOS",
    nextCheck: "SIN DATOS",
    objNutricional: "SIN DATOS",
    colaboradores: "Solo la cuenta principal",
    chats: "Solo la cuenta principal",
    tipoAsesoria: "completa",
    modalidad: "presencial",
    categoriaPlan: cliente.categoria || "",
    pagoEstado: "confirmado",
    moneda: "ARS",
    importe: "30000",
    saldo: "0",
    emailPagador: "",
    autoRenewPlan: true,
    renewalDays: 30,
    tabNotas: {},
  };
}

export default function ClientesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isDetailMode, setIsDetailMode] = useState(false);
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [detailTabId, setDetailTabId] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasByUserId, setEtiquetasByUserId] = useState<Record<string, Etiqueta[]>>({});
  const [etiquetaSearch, setEtiquetaSearch] = useState("");
  const [etiquetaCrear, setEtiquetaCrear] = useState({ texto: "", color: "#2196f3" });
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnResize, setColumnResize] = useState<{
    column: ClientTableColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);
  const { jugadoras, agregarJugadora, editarJugadora, eliminarJugadora } = usePlayers();
  const { alumnos, agregarAlumno, editarAlumno, eliminarAlumno } = useAlumnos();
  const { categorias } = useCategories();
  const { deportes } = useDeportes();
  const { sesiones } = useSessions();

  const sessionScope = useMemo(() => {
    const raw = String(session?.user?.id || session?.user?.email || "anon");
    return raw.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  }, [session?.user?.email, session?.user?.id]);

  const clientTableUiKey = `${CLIENT_TABLE_UI_KEY_PREFIX}-${sessionScope}`;

  const [clientTableUiPrefs, setClientTableUiPrefs, clientTableUiLoaded] = useSharedState<ClientTableUiPrefs>(
    DEFAULT_CLIENT_TABLE_UI_PREFS,
    {
      key: clientTableUiKey,
    }
  );

  const normalizedTableUiPrefs = useMemo(
    () => sanitizeClientTableUiPrefs(clientTableUiPrefs || DEFAULT_CLIENT_TABLE_UI_PREFS),
    [clientTableUiPrefs]
  );

  const visibleExtraColumns = normalizedTableUiPrefs.visibleExtraColumns;
  const rowHeight = normalizedTableUiPrefs.rowHeight;
  const columnWidths = normalizedTableUiPrefs.columnWidths;
  const filtroPlan = normalizedTableUiPrefs.planFilter;
  const rowCellVerticalPadding = useMemo(() => {
    const value = Math.round((rowHeight - 24) / 2);
    return Math.max(2, Math.min(18, value));
  }, [rowHeight]);

  const [clientesMeta, setClientesMeta] = useSharedState<Record<string, ClienteMeta>>({}, {
    key: CLIENTE_META_KEY,
    legacyLocalStorageKey: CLIENTE_META_KEY,
  });
  const [pagos, setPagos] = useSharedState<PagoRegistro[]>([], {
    key: PAGOS_KEY,
    legacyLocalStorageKey: PAGOS_KEY,
  });
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

  const [vista, setVista] = useState<ClienteEstado>("activo");
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | ClienteTipo>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroDeporte, setFiltroDeporte] = useState("todos");
  const [filtroClub, setFiltroClub] = useState("");
  const [crearOpen, setCrearOpen] = useState(false);
  const [form, setForm] = useState<ClienteForm>(INITIAL_FORM);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClienteTab>("datos");
  const [datosDraft, setDatosDraft] = useState<DatosDraft | null>(null);
  const [pagoForm, setPagoForm] = useState({
    clientId: "",
    fecha: new Date().toISOString().slice(0, 10),
    importe: "",
    moneda: "ARS",
  });

  useEffect(() => {
    const safeDecodeParam = (value: string | null) => {
      if (!value) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    const syncFromLocation = () => {
      if (typeof window === "undefined") return;

      const normalizedPath = window.location.pathname.replace(/\/+$/, "");
      const detailPathMatch = normalizedPath.match(/^\/clientes\/ficha\/([^/]+)(?:\/([^/]+))?$/i);

      if (detailPathMatch) {
        setIsDetailMode(true);
        setDetailClientId(safeDecodeParam(detailPathMatch[1]));
        setDetailTabId(safeDecodeParam(detailPathMatch[2] || "datos"));
        return;
      }

      const params = new URLSearchParams(window.location.search);
      setIsDetailMode(params.get("detalle") === "1");
      setDetailClientId(safeDecodeParam(params.get("cliente")));
      setDetailTabId(safeDecodeParam(params.get("tab")));
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, [pathname]);

  const categoriasOptions = useMemo(
    () => categorias.filter((cat) => cat.habilitada).map((cat) => cat.nombre),
    [categorias]
  );

  useEffect(() => {
    if (!isDetailMode || !detailClientId) return;

    setSelectedClientId(detailClientId);

    if (detailTabId && TABS.some((tab) => tab.id === detailTabId)) {
      setActiveTab(detailTabId as ClienteTab);
    }
  }, [detailClientId, detailTabId, isDetailMode]);

  const deportesOptions = useMemo(
    () => deportes.filter((dep) => dep.habilitado).map((dep) => dep.nombre),
    [deportes]
  );

  const posicionesOptions = useMemo(() => {
    const dep = deportes.find((item) => item.nombre === form.deporte);
    return dep?.posiciones || [];
  }, [deportes, form.deporte]);

  const clientes = useMemo<ClienteView[]>(() => {
    const jugadorasMapped: ClienteView[] = jugadoras.map((j) => ({
      id: `jugadora:${j.nombre}`,
      tipo: "jugadora",
      nombre: j.nombre,
      estado: j.estado || "activo",
      practicaDeporte: true,
      deporte: j.deporte,
      categoria: j.categoria,
      posicion: j.posicion,
      fechaNacimiento: j.fechaNacimiento,
      altura: j.altura,
      peso: j.peso,
      club: j.club,
      objetivo: j.objetivo,
      observaciones: j.observaciones,
      wellness: j.wellness,
      carga: j.carga,
    }));

    const alumnosMapped: ClienteView[] = alumnos.map((a) => ({
      id: `alumno:${a.nombre}`,
      tipo: "alumno",
      nombre: a.nombre,
      estado: a.estado || "activo",
      practicaDeporte: false,
      fechaNacimiento: a.fechaNacimiento,
      altura: a.altura,
      peso: a.peso,
      club: a.club,
      objetivo: a.objetivo,
      observaciones: a.observaciones,
    }));

    return [...jugadorasMapped, ...alumnosMapped];
  }, [alumnos, jugadoras]);
  // Declarar selectedClient y useEffect después de clientes

  const selectedClient = useMemo(
    () => clientes.find((cliente) => cliente.id === selectedClientId) || null,
    [clientes, selectedClientId]
  );

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
    const planMatchedByEmbeddedAlumno = nutritionPlans
      .filter(
        (plan) =>
          namesLikelyMatch(plan.alumnoAsignado || "", clientName) ||
          namesLikelyMatch(plan.alumnoAsignado || "", clientIdName)
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      )[0];

    return planMatchedByEmbeddedAlumno || null;
  }, [nutritionPlans, selectedClient, selectedNutritionAssignment]);

  const nutritionPlanStatusByClientId = useMemo(() => {
    const map = new Map<string, NutritionPlanStatus>();

    for (const client of clientes) {
      const clientName = client.nombre;
      const clientIdName = client.id.split(":")[1] || "";

      const assignment = nutritionAssignments
        .filter(
          (item) =>
            namesLikelyMatch(item.alumnoNombre, clientName) ||
            namesLikelyMatch(item.alumnoNombre, clientIdName)
        )
        .sort(
          (a, b) =>
            new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()
        )[0];

      let matchedPlan: NutritionPlan | null = null;

      if (assignment) {
        matchedPlan = nutritionPlans.find((plan) => plan.id === assignment.planId) || null;
      }

      if (!matchedPlan) {
        matchedPlan =
          nutritionPlans
            .filter(
              (plan) =>
                namesLikelyMatch(plan.alumnoAsignado || "", clientName) ||
                namesLikelyMatch(plan.alumnoAsignado || "", clientIdName)
            )
            .sort(
              (a, b) =>
                new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
            )[0] || null;
      }

      if (matchedPlan) {
        map.set(client.id, {
          hasPlan: true,
          planName: matchedPlan.nombre,
          updatedAt: matchedPlan.updatedAt,
        });
      } else {
        map.set(client.id, {
          hasPlan: false,
          planName: "",
          updatedAt: "",
        });
      }
    }

    return map;
  }, [clientes, nutritionAssignments, nutritionPlans]);

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

  useEffect(() => {
    if (!selectedClient) return;
    fetch(`/api/etiquetas?userId=${selectedClient.id.split(":")[1]}`)
      .then((res) => res.json())
      .then((data: Etiqueta[]) => {
        setEtiquetas(data || []);
        setEtiquetasByUserId((prev) => ({
          ...prev,
          [selectedClient.id.split(":")[1]]: data || [],
        }));
      });
  }, [selectedClient]);

  const sesionesPorCliente = useMemo(() => {
    const result: Record<string, number> = {};

    for (const cliente of clientes) {
      const count = sesiones.filter((sesion) => {
        if (cliente.tipo === "jugadora") {
          const porCategoria =
            sesion.asignacionTipo === "jugadoras" &&
            (sesion.categoriaAsignada || "") === (cliente.categoria || "");
          const porNombre =
            sesion.asignacionTipo === "jugadoras" &&
            (sesion.jugadoraAsignada || "") === cliente.nombre;
          return porCategoria || porNombre;
        }

        return (
          sesion.asignacionTipo === "alumnos" &&
          (sesion.alumnoAsignado || "") === cliente.nombre
        );
      }).length;

      result[cliente.id] = count;
    }

    return result;
  }, [clientes, sesiones]);

  const clientesFiltrados = useMemo(() => {
    const query = search.trim().toLowerCase();
    const clubQuery = filtroClub.trim().toLowerCase();
    const etiquetaQuery = normalizePersonKey(etiquetaSearch);

    const base = clientes
      .filter((cliente) => cliente.estado === vista)
      .filter((cliente) => (filtroTipo === "todos" ? true : cliente.tipo === filtroTipo))
      .filter((cliente) =>
        filtroCategoria === "todas" ? true : (cliente.categoria || "") === filtroCategoria
      )
      .filter((cliente) =>
        filtroDeporte === "todos" ? true : (cliente.deporte || "") === filtroDeporte
      )
      .filter((cliente) => (clubQuery ? (cliente.club || "").toLowerCase().includes(clubQuery) : true))
      .filter((cliente) => {
        const sesionesClienteCount = sesionesPorCliente[cliente.id] || 0;
        const hasTrainingPlan = sesionesClienteCount > 0;
        const hasNutritionPlan = Boolean(nutritionPlanStatusByClientId.get(cliente.id)?.hasPlan);

        if (filtroPlan === "con-plan") return hasTrainingPlan || hasNutritionPlan;
        if (filtroPlan === "sin-plan") return !hasTrainingPlan && !hasNutritionPlan;
        if (filtroPlan === "con-plan-entrenamiento") return hasTrainingPlan;
        if (filtroPlan === "con-plan-nutricional") return hasNutritionPlan;
        if (filtroPlan === "sin-plan-nutricional") return !hasNutritionPlan;
        return true;
      })
      .filter((cliente) => {
        if (!query) return true;
        return (
          cliente.nombre.toLowerCase().includes(query) ||
          (cliente.club || "").toLowerCase().includes(query) ||
          (cliente.categoria || "").toLowerCase().includes(query)
        );
      })
      .filter((cliente) => {
        if (!etiquetaQuery) return true;
        const userId = cliente.id.split(":")[1];
        const etiquetasCliente = etiquetasByUserId[userId] || [];
        return etiquetasCliente.some((tag) => normalizePersonKey(tag.texto).includes(etiquetaQuery));
      });

    return base
      .filter((cliente) => {
        const sesionesClienteCount = sesionesPorCliente[cliente.id] || 0;
        const hasTrainingPlan = sesionesClienteCount > 0;
        const hasNutritionPlan = Boolean(nutritionPlanStatusByClientId.get(cliente.id)?.hasPlan);

        if (filtroPlan === "con-plan") return hasTrainingPlan || hasNutritionPlan;
        if (filtroPlan === "sin-plan") return !hasTrainingPlan && !hasNutritionPlan;
        if (filtroPlan === "con-plan-entrenamiento") return hasTrainingPlan;
        if (filtroPlan === "con-plan-nutricional") return hasNutritionPlan;
        if (filtroPlan === "sin-plan-nutricional") return !hasNutritionPlan;
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [
    clientes,
    etiquetaSearch,
    etiquetasByUserId,
    filtroCategoria,
    filtroClub,
    filtroDeporte,
    filtroPlan,
    filtroTipo,
    search,
    nutritionPlanStatusByClientId,
    sesionesPorCliente,
    vista,
  ]);

  const planStatusSummary = useMemo(() => {
    const query = search.trim().toLowerCase();
    const clubQuery = filtroClub.trim().toLowerCase();
    const etiquetaQuery = normalizePersonKey(etiquetaSearch);

    const base = clientes
      .filter((cliente) => cliente.estado === vista)
      .filter((cliente) => (filtroTipo === "todos" ? true : cliente.tipo === filtroTipo))
      .filter((cliente) =>
        filtroCategoria === "todas" ? true : (cliente.categoria || "") === filtroCategoria
      )
      .filter((cliente) =>
        filtroDeporte === "todos" ? true : (cliente.deporte || "") === filtroDeporte
      )
      .filter((cliente) =>
        clubQuery ? (cliente.club || "").toLowerCase().includes(clubQuery) : true
      )
      .filter((cliente) => {
        if (!query) return true;
        return (
          cliente.nombre.toLowerCase().includes(query) ||
          (cliente.club || "").toLowerCase().includes(query) ||
          (cliente.categoria || "").toLowerCase().includes(query)
        );
      })
      .filter((cliente) => {
        if (!etiquetaQuery) return true;
        const userId = cliente.id.split(":")[1];
        const etiquetasCliente = etiquetasByUserId[userId] || [];
        return etiquetasCliente.some((tag) => normalizePersonKey(tag.texto).includes(etiquetaQuery));
      });

    let conPlan = 0;
    let sinPlan = 0;
    let conEntrenamiento = 0;
    let conNutricional = 0;
    let sinNutricional = 0;

    for (const cliente of base) {
      const hasTrainingPlan = (sesionesPorCliente[cliente.id] || 0) > 0;
      const hasNutritionPlan = Boolean(nutritionPlanStatusByClientId.get(cliente.id)?.hasPlan);
      if (hasTrainingPlan || hasNutritionPlan) conPlan += 1;
      if (!hasTrainingPlan && !hasNutritionPlan) sinPlan += 1;
      if (hasTrainingPlan) conEntrenamiento += 1;
      if (hasNutritionPlan) conNutricional += 1;
      if (!hasNutritionPlan) sinNutricional += 1;
    }

    return {
      total: base.length,
      conPlan,
      sinPlan,
      conEntrenamiento,
      conNutricional,
      sinNutricional,
    };
  }, [
    clientes,
    etiquetaSearch,
    etiquetasByUserId,
    filtroCategoria,
    filtroClub,
    filtroDeporte,
    filtroTipo,
    nutritionPlanStatusByClientId,
    search,
    sesionesPorCliente,
    vista,
  ]);

  useEffect(() => {
    const missingUserIds = clientesFiltrados
      .map((cliente) => cliente.id.split(":")[1])
      .filter((userId) => !etiquetasByUserId[userId]);

    if (missingUserIds.length === 0) return;

    Promise.all(
      missingUserIds.map(async (userId) => {
        const res = await fetch(`/api/etiquetas?userId=${userId}`);
        if (!res.ok) {
          return { userId, etiquetas: [] as Etiqueta[] };
        }
        const data = (await res.json()) as Etiqueta[];
        return { userId, etiquetas: data || [] };
      })
    ).then((rows) => {
      setEtiquetasByUserId((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          next[row.userId] = row.etiquetas;
        }
        return next;
      });
    });
  }, [clientesFiltrados, etiquetasByUserId]);

  const selectedMeta = useMemo(() => {
    if (!selectedClient) return null;
    return {
      ...defaultMeta(selectedClient),
      ...(clientesMeta[selectedClient.id] || {}),
    };
  }, [clientesMeta, selectedClient]);

  const sesionesCliente = useMemo(() => {
    if (!selectedClient) return [];

    return sesiones
      .filter((sesion) => {
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
      })
      .slice(0, 8);
  }, [selectedClient, sesiones]);

  const resumen = useMemo(() => {
    const activos = clientes.filter((item) => item.estado === "activo").length;
    const finalizados = clientes.filter((item) => item.estado === "finalizado").length;
    return { activos, finalizados, total: clientes.length };
  }, [clientes]);

  const latestPaymentByClientId = useMemo(() => {
    const map = new Map<string, PagoRegistro>();
    for (const pago of pagos) {
      const current = map.get(pago.clientId);
      if (!current || new Date(pago.createdAt).getTime() > new Date(current.createdAt).getTime()) {
        map.set(pago.clientId, pago);
      }
    }
    return map;
  }, [pagos]);

  const tableColumns = useMemo(() => {
    const orderedExtras: VisibleClientColumn[] = ["etiquetas", "vencimiento", "ultimo-pago"];
    return [
      "cliente",
      "tipo",
      "categoria",
      "plan",
      ...orderedExtras.filter((column) => visibleExtraColumns.includes(column)),
      "acciones",
    ] as ClientTableColumnKey[];
  }, [visibleExtraColumns]);

  const toggleExtraColumn = (column: VisibleClientColumn) => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      const nextColumns = safe.visibleExtraColumns.includes(column)
        ? safe.visibleExtraColumns.filter((item) => item !== column)
        : [...safe.visibleExtraColumns, column];

      return {
        ...safe,
        visibleExtraColumns: nextColumns,
      };
    });
  };

  const setColumnWidth = (column: ClientTableColumnKey, width: number) => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      return {
        ...safe,
        columnWidths: {
          ...safe.columnWidths,
          [column]: Math.max(60, Math.min(900, width)),
        },
      };
    });
  };

  const setRowHeightValue = (value: number) => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      return {
        ...safe,
        rowHeight: Math.max(42, Math.min(90, value)),
      };
    });
  };

  const setPlanFilter = (value: PlanFilterType) => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      return {
        ...safe,
        planFilter: value,
      };
    });
  };

  const columnLabels: Record<ClientTableColumnKey, string> = {
    cliente: "Cliente",
    tipo: "Tipo",
    categoria: "Categoria",
    plan: "Plan",
    etiquetas: "Etiquetas",
    vencimiento: "Vencimiento",
    "ultimo-pago": "Ultimo pago",
    acciones: "Acciones",
  };

  const startColumnResize = (
    event: React.MouseEvent<HTMLDivElement>,
    column: ClientTableColumnKey
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setColumnResize({
      column,
      startX: event.clientX,
      startWidth: columnWidths[column],
    });
  };

  const estimateColumnWidth = (column: ClientTableColumnKey) => {
    const minByColumn: Record<ClientTableColumnKey, number> = {
      cliente: 180,
      tipo: 100,
      categoria: 110,
      plan: 110,
      etiquetas: 150,
      vencimiento: 130,
      "ultimo-pago": 130,
      acciones: 210,
    };

    if (column === "acciones") {
      return minByColumn.acciones;
    }

    const samples = clientesFiltrados.map((cliente) => {
      const sesionesCount = sesionesPorCliente[cliente.id] || 0;
      const userId = cliente.id.split(":")[1];
      const etiquetasCliente = etiquetasByUserId[userId] || [];
      const meta = getMeta(cliente);
      const lastPayment = latestPaymentByClientId.get(cliente.id);

      switch (column) {
        case "cliente":
          return `${cliente.nombre} ${cliente.club || "Sin club"}`;
        case "tipo":
          return cliente.tipo === "jugadora" ? "Jugadora" : "Alumno/a";
        case "categoria":
          return cliente.categoria || cliente.deporte || "-";
        case "plan":
          return sesionesCount > 0 ? `Con plan (${sesionesCount})` : "Sin plan";
        case "etiquetas":
          return etiquetasCliente.length === 0
            ? "Sin etiquetas"
            : etiquetasCliente.map((tag) => tag.texto).join(", ");
        case "vencimiento":
          return `${meta.endDate || "Sin fecha"} ${meta.startDate || ""}`;
        case "ultimo-pago":
          return lastPayment
            ? `${lastPayment.moneda} ${lastPayment.importe.toLocaleString("es-AR")} ${new Date(lastPayment.fecha).toLocaleDateString("es-AR")}`
            : "Sin pagos";
        default:
          return "";
      }
    });

    const maxChars = Math.max(
      columnLabels[column].length,
      ...samples.map((value) => String(value || "").length)
    );

    const estimated = Math.round(maxChars * 7.4 + 32);
    return Math.max(minByColumn[column], Math.min(estimated, 600));
  };

  const autoSizeColumn = (column: ClientTableColumnKey) => {
    setColumnWidth(column, estimateColumnWidth(column));
  };

  const autoSizeVisibleColumns = () => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      const nextWidths = { ...safe.columnWidths };
      for (const column of tableColumns) {
        nextWidths[column] = estimateColumnWidth(column);
      }

      return {
        ...safe,
        columnWidths: nextWidths,
      };
    });
  };

  const resetTableView = () => {
    setClientTableUiPrefs(DEFAULT_CLIENT_TABLE_UI_PREFS);
    setShowColumnsMenu(true);
  };

  const applyMynterPreset = () => {
    setClientTableUiPrefs((prev) => {
      const safe = sanitizeClientTableUiPrefs(prev || DEFAULT_CLIENT_TABLE_UI_PREFS);
      return {
        ...safe,
        rowHeight: 96,
        columnWidths: {
          ...safe.columnWidths,
          ...DEFAULT_COLUMN_WIDTHS,
        },
      };
    });
  };

  const saveTableView = () => {
    if (!clientTableUiLoaded) return;
    markManualSaveIntent(clientTableUiKey);
  };

  useEffect(() => {
    if (!columnResize) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - columnResize.startX;
      const nextWidth = Math.max(60, Math.min(900, columnResize.startWidth + delta));
      setColumnWidth(columnResize.column, nextWidth);
    };

    const handleMouseUp = () => {
      setColumnResize(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [columnResize]);

  useEffect(() => {
    if (!selectedClient) {
      setDatosDraft(null);
      return;
    }

    setDatosDraft({
      nombre: selectedClient.nombre,
      fechaNacimiento: selectedClient.fechaNacimiento || "",
      altura: selectedClient.altura || "",
      peso: selectedClient.peso || "",
      club: selectedClient.club || "",
      objetivo: selectedClient.objetivo || "",
      observaciones: selectedClient.observaciones || "",
      deporte: selectedClient.deporte || deportesOptions[0] || "",
      categoria: selectedClient.categoria || categoriasOptions[0] || "",
      posicion: selectedClient.posicion || "",
    });
  }, [categoriasOptions, deportesOptions, selectedClient]);

  useEffect(() => {
    if (pagoForm.clientId) return;
    if (clientes.length === 0) return;
    setPagoForm((prev) => ({ ...prev, clientId: clientes[0].id }));
  }, [clientes, pagoForm.clientId]);

  const getMeta = (cliente: ClienteView) => clientesMeta[cliente.id] || defaultMeta(cliente);

  const setMetaPatch = (clientId: string, patch: Partial<ClienteMeta>) => {
    const baseClient = clientes.find((item) => item.id === clientId);
    if (!baseClient) return;

    setClientesMeta((prev) => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || defaultMeta(baseClient)),
        ...patch,
      },
    }));
  };

  const migrateMeta = (oldId: string, nextId: string, nextMeta: ClienteMeta) => {
    setClientesMeta((prev) => {
      const clone = { ...prev };
      delete clone[oldId];
      clone[nextId] = nextMeta;
      return clone;
    });
  };

  const toggleEstado = (cliente: ClienteView) => {
    const proximoEstado: ClienteEstado =
      cliente.estado === "activo" ? "finalizado" : "activo";

    if (cliente.tipo === "jugadora") {
      editarJugadora(cliente.nombre, { estado: proximoEstado });
      return;
    }

    editarAlumno(cliente.nombre, { estado: proximoEstado });
  };

  const borrarCliente = (cliente: ClienteView) => {
    if (!confirm(`¿Eliminar cliente ${cliente.nombre}?`)) return;

    if (cliente.tipo === "jugadora") {
      eliminarJugadora(cliente.nombre);
    } else {
      eliminarAlumno(cliente.nombre);
    }

    setClientesMeta((prev) => {
      const clone = { ...prev };
      delete clone[cliente.id];
      return clone;
    });
  };

  const resetForm = () => {
    setForm({
      ...INITIAL_FORM,
      deporte: deportesOptions[0] || "Fútbol",
      categoria: categoriasOptions[0] || "",
    });
  };

  const submitCliente = (e: React.FormEvent) => {
    e.preventDefault();
    markManualSaveIntent("pf-control-alumnos");
    markManualSaveIntent("pf-control-jugadoras");
    const nombre = form.nombre.trim();
    if (!nombre) return;

    if (form.practicaDeporte === "si") {
      agregarJugadora({
        nombre,
        estado: form.estado,
        posicion: form.posicion.trim() || "Sin posicion",
        wellness: 0,
        carga: 0,
        fechaNacimiento: form.fechaNacimiento || undefined,
        altura: form.altura || undefined,
        peso: form.peso || undefined,
        deporte: form.deporte || undefined,
        categoria: form.categoria || undefined,
        club: form.club.trim() || undefined,
        objetivo: form.objetivo.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
      });
      setSelectedClientId(`jugadora:${nombre}`);
    } else {
      agregarAlumno({
        nombre,
        estado: form.estado,
        fechaNacimiento: form.fechaNacimiento || undefined,
        altura: form.altura || undefined,
        peso: form.peso || undefined,
        club: form.club.trim() || undefined,
        objetivo: form.objetivo.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
        practicaDeporte: false,
      });
      setSelectedClientId(`alumno:${nombre}`);
    }

    setCrearOpen(false);
    setActiveTab("datos");
    resetForm();
  };

  const saveDatosGenerales = () => {
    if (!selectedClient || !selectedMeta || !datosDraft) return;
    markManualSaveIntent(CLIENTE_META_KEY);

    const nextNombre = datosDraft.nombre.trim();
    if (!nextNombre) return;

    if (selectedClient.tipo === "jugadora") {
      editarJugadora(selectedClient.nombre, {
        nombre: nextNombre,
        fechaNacimiento: datosDraft.fechaNacimiento || undefined,
        altura: datosDraft.altura || undefined,
        peso: datosDraft.peso || undefined,
        club: datosDraft.club || undefined,
        objetivo: datosDraft.objetivo || undefined,
        observaciones: datosDraft.observaciones || undefined,
        deporte: datosDraft.deporte || undefined,
        categoria: datosDraft.categoria || undefined,
        posicion: datosDraft.posicion || undefined,
      });
    } else {
      editarAlumno(selectedClient.nombre, {
        nombre: nextNombre,
        fechaNacimiento: datosDraft.fechaNacimiento || undefined,
        altura: datosDraft.altura || undefined,
        peso: datosDraft.peso || undefined,
        club: datosDraft.club || undefined,
        objetivo: datosDraft.objetivo || undefined,
        observaciones: datosDraft.observaciones || undefined,
      });
    }

    const nextId = `${selectedClient.tipo}:${nextNombre}`;
    migrateMeta(selectedClient.id, nextId, {
      ...selectedMeta,
      categoriaPlan: datosDraft.categoria || selectedMeta.categoriaPlan,
    });
    setSelectedClientId(nextId);
  };

  const updateTabNote = (tab: ClienteTab, value: string) => {
    if (!selectedClient || !selectedMeta) return;
    setMetaPatch(selectedClient.id, {
      tabNotas: {
        ...selectedMeta.tabNotas,
        [tab]: value,
      },
    });
  };

  const openWhatsapp = (cliente: ClienteView) => {
    const meta = getMeta(cliente);
    const telefono = normalizeWhatsAppNumber(meta);
    if (!telefono) {
      window.dispatchEvent(
        new CustomEvent("pf-inline-toast", {
          detail: {
            type: "warning",
            title: "WhatsApp",
            message: "Numero de telefono invalido para abrir chat",
          },
        })
      );
      return;
    }

    const presetText = encodeURIComponent(`Hola ${cliente.nombre}, te escribo desde PF Control.`);
    window.open(`https://wa.me/${telefono}?text=${presetText}`, "_blank", "noopener,noreferrer");
  };

  const pushUrlWithoutReload = (href: string) => {
    if (typeof window === "undefined") return;
    const nextUrl = new URL(href, window.location.origin);
    const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) return;
    window.history.pushState({}, "", next);
  };

  const navigateWithRetry = (href: string, options?: { hardFallback?: boolean }) => {
    if (typeof window === "undefined") {
      router.push(href);
      return;
    }

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    router.push(href);

    window.setTimeout(() => {
      const nextUrl = `${window.location.pathname}${window.location.search}`;
      if (nextUrl === currentUrl) {
        if (options?.hardFallback) {
          window.location.assign(href);
          return;
        }
        router.replace(href);
      }
    }, 240);
  };

  useEffect(() => {
    router.prefetch("/clientes/plan");
    router.prefetch("/registros");
  }, [router]);

  function openClientPlanView(clientId: string, tab: PlanViewTab = "plan-entrenamiento") {
    navigateWithRetry(buildPlanViewHref(clientId, tab));
  }

  const openClientDetail = (clientId: string, tab: ClienteTab = "datos") => {
    setIsDetailMode(true);
    setDetailClientId(clientId);
    setDetailTabId(tab);
    setSelectedClientId(clientId);
    setActiveTab(tab);
    pushUrlWithoutReload(buildClientDetailHref(clientId, tab));
  };

  const closeClientDetail = () => {
    setIsDetailMode(false);
    setDetailClientId(null);
    setDetailTabId(null);
    pushUrlWithoutReload("/clientes");
  };

  const registrarPago = (e: React.FormEvent) => {
    e.preventDefault();
    markManualSaveIntent(PAGOS_KEY);
    markManualSaveIntent(CLIENTE_META_KEY);
    const cliente = clientes.find((item) => item.id === pagoForm.clientId);
    const importe = parseFloat(pagoForm.importe.replace(",", "."));

    if (!cliente || !pagoForm.fecha || Number.isNaN(importe) || importe <= 0) {
      return;
    }

    const pago: PagoRegistro = {
      id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
      clientId: cliente.id,
      clientName: cliente.nombre,
      fecha: pagoForm.fecha,
      importe,
      moneda: pagoForm.moneda,
      createdAt: new Date().toISOString(),
    };

    const metaActual = getMeta(cliente);
    const renewalDays = Number.isFinite(Number(metaActual.renewalDays))
      ? Math.max(1, Math.min(365, Number(metaActual.renewalDays)))
      : 30;
    const shouldAutoRenew = metaActual.autoRenewPlan !== false;

    let startDatePatch = metaActual.startDate;
    let endDatePatch = metaActual.endDate;

    if (shouldAutoRenew) {
      const paymentDate = parseDateAtStart(pagoForm.fecha);
      const currentEndDate = parseDateAtStart(metaActual.endDate);

      if (paymentDate) {
        const renewalBase = currentEndDate && currentEndDate >= paymentDate ? currentEndDate : paymentDate;
        endDatePatch = sumarDias(renewalBase.toISOString().slice(0, 10), renewalDays);
        startDatePatch = metaActual.startDate || pagoForm.fecha;
      }
    }

    setPagos((prev) => [pago, ...prev]);
    setMetaPatch(cliente.id, {
      pagoEstado: "confirmado",
      moneda: pagoForm.moneda,
      importe: String(importe),
      saldo: "0",
      startDate: startDatePatch,
      endDate: endDatePatch,
    });

    setSelectedClientId(cliente.id);
    setPagoForm((prev) => ({ ...prev, importe: "" }));
  };

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-6 text-slate-100">
      {!isDetailMode ? (
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-900 via-cyan-950/50 to-slate-900 p-6 shadow-[0_20px_80px_rgba(6,182,212,0.12)]">
        <div className="pointer-events-none absolute -left-12 -top-14 h-44 w-44 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/80">
              Hub comercial y operativo
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Clientes</h1>
            <p className="mt-2 text-sm text-slate-200/90">
              Gestion integral de fichas, pagos y planes en una vista mas clara y moderna.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isDetailMode ? (
              <button
                type="button"
                onClick={closeClientDetail}
                className="rounded-xl border border-cyan-100/40 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200"
              >
                Volver al listado
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCrearOpen((prev) => !prev);
                    if (!crearOpen) resetForm();
                  }}
                  className="rounded-xl border border-cyan-100/40 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200"
                >
                  Crear cliente
                </button>
                <button
                  type="button"
                  onClick={() => navigateWithRetry("/registros", { hardFallback: true })}
                  className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Ver registros
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-300/35 bg-emerald-500/15 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-100">Activos</p>
            <p className="text-3xl font-black">{resumen.activos}</p>
          </div>
          <div className="rounded-2xl border border-rose-300/35 bg-rose-500/15 p-4">
            <p className="text-xs uppercase tracking-wide text-rose-100">Finalizados</p>
            <p className="text-3xl font-black">{resumen.finalizados}</p>
          </div>
          <div className="rounded-2xl border border-cyan-300/35 bg-cyan-500/15 p-4">
            <p className="text-xs uppercase tracking-wide text-cyan-100">Total</p>
            <p className="text-3xl font-black">{resumen.total}</p>
          </div>
        </div>
      </section>
      ) : null}

      {!isDetailMode ? (
      <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Registrar pago</h2>
        <p className="mt-1 text-sm text-slate-300">
          Al registrar un pago, se renueva automaticamente la asesoria por 30 dias (configurable por cliente).
        </p>

        <form onSubmit={registrarPago} className="mt-4 grid gap-3 md:grid-cols-5">
          <select
            required
            value={pagoForm.clientId}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, clientId: e.target.value }))}
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="">Cliente</option>
            {clientes
              .slice()
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre} ({cliente.tipo})
                </option>
              ))}
          </select>

          <input
            required
            type="date"
            value={pagoForm.fecha}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, fecha: e.target.value }))}
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />

          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={pagoForm.importe}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, importe: e.target.value }))}
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            placeholder="Importe"
          />

          <select
            value={pagoForm.moneda}
            onChange={(e) => setPagoForm((prev) => ({ ...prev, moneda: e.target.value }))}
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
          >
            Guardar pago
          </button>
        </form>

        <div className="mt-4 grid gap-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Ultimos pagos ({pagos.length})
          </p>
          {pagos.slice(0, 5).map((pago) => (
            <div
              key={pago.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm"
            >
              <p className="font-semibold text-slate-100">{pago.clientName}</p>
              <p className="text-slate-300">{new Date(pago.fecha).toLocaleDateString("es-AR")}</p>
              <p className="font-bold text-emerald-200">
                {pago.moneda} {pago.importe.toLocaleString("es-AR")}
              </p>
            </div>
          ))}
          {pagos.length === 0 ? (
            <p className="text-sm text-slate-400">Todavia no hay pagos registrados.</p>
          ) : null}
        </div>
      </section>
      ) : null}

      {!isDetailMode && crearOpen ? (
        <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
          <h2 className="text-xl font-bold">Crear cliente</h2>
          <form onSubmit={submitCliente} className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Nombre"
              />
              <select
                value={form.practicaDeporte}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, practicaDeporte: e.target.value as "si" | "no" }))
                }
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="si">Practica deporte (jugadora)</option>
                <option value="no">No practica deporte (alumno/a)</option>
              </select>
              <select
                value={form.estado}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, estado: e.target.value as ClienteEstado }))
                }
                className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="activo">Activo</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <input type="date" value={form.fechaNacimiento} onChange={(e) => setForm((prev) => ({ ...prev, fechaNacimiento: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
              <input value={form.altura} onChange={(e) => setForm((prev) => ({ ...prev, altura: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Altura" />
              <input value={form.peso} onChange={(e) => setForm((prev) => ({ ...prev, peso: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Peso" />
              <input value={form.club} onChange={(e) => setForm((prev) => ({ ...prev, club: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Club" />
            </div>

            {form.practicaDeporte === "si" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <select value={form.deporte} onChange={(e) => setForm((prev) => ({ ...prev, deporte: e.target.value, posicion: "" }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                  {deportesOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select value={form.categoria} onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                  <option value="">Categoria</option>
                  {categoriasOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select value={form.posicion} onChange={(e) => setForm((prev) => ({ ...prev, posicion: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                  <option value="">Posicion</option>
                  {posicionesOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <input value={form.objetivo} onChange={(e) => setForm((prev) => ({ ...prev, objetivo: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Objetivo" />
              <input value={form.observaciones} onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Observaciones" />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCrearOpen(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200">Cancelar</button>
              <button type="submit" className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">Guardar cliente</button>
            </div>
          </form>
        </section>
      ) : null}

      <section
        className="grid gap-5"
        data-layout-lock="clientes-section"
        style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        {!isDetailMode ? (
        <div
          className="w-full rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),rgba(15,23,42,0.88)_38%,rgba(2,6,23,0.96)_100%)] p-5 shadow-[0_24px_60px_rgba(3,7,18,0.55)]"
          data-layout-lock="clientes-list-panel"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-white/15 bg-slate-950/55 p-1">
              <button type="button" onClick={() => setVista("activo")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === "activo" ? "bg-emerald-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Activos</button>
              <button type="button" onClick={() => setVista("finalizado")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === "finalizado" ? "bg-rose-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Finalizados</button>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, club o categoria" className="w-full max-w-sm rounded-xl border border-cyan-300/30 bg-slate-900/85 px-3 py-2 text-sm shadow-inner shadow-cyan-500/5" />
          </div>

          <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as "todos" | ClienteTipo)} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs">
              <option value="todos">Tipo: Todos</option>
              <option value="jugadora">Tipo: Jugadoras</option>
              <option value="alumno">Tipo: Alumnos</option>
            </select>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs">
              <option value="todas">Categoria: Todas</option>
              {categoriasOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={filtroDeporte} onChange={(e) => setFiltroDeporte(e.target.value)} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs">
              <option value="todos">Deporte: Todos</option>
              {deportesOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input value={filtroClub} onChange={(e) => setFiltroClub(e.target.value)} placeholder="Club" className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs" />
            <select value={filtroPlan} onChange={(e) => setPlanFilter(e.target.value as PlanFilterType)} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs">
              <option value="todos">Plan: Todos</option>
              <option value="con-plan">Con cualquier plan</option>
              <option value="sin-plan">Sin ningun plan</option>
              <option value="con-plan-entrenamiento">Con plan entrenamiento</option>
              <option value="con-plan-nutricional">Con plan nutricional</option>
              <option value="sin-plan-nutricional">Sin plan nutricional</option>
            </select>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setPlanFilter("todos")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "todos" ? "border-cyan-300/70 bg-cyan-500/20 text-cyan-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Todos ({planStatusSummary.total})
            </button>
            <button
              type="button"
              onClick={() => setPlanFilter("con-plan")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "con-plan" ? "border-emerald-300/70 bg-emerald-500/20 text-emerald-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Con plan ({planStatusSummary.conPlan})
            </button>
            <button
              type="button"
              onClick={() => setPlanFilter("sin-plan")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "sin-plan" ? "border-rose-300/70 bg-rose-500/20 text-rose-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Sin plan ({planStatusSummary.sinPlan})
            </button>
            <button
              type="button"
              onClick={() => setPlanFilter("con-plan-entrenamiento")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "con-plan-entrenamiento" ? "border-lime-300/70 bg-lime-500/20 text-lime-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Entrenamiento ({planStatusSummary.conEntrenamiento})
            </button>
            <button
              type="button"
              onClick={() => setPlanFilter("con-plan-nutricional")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "con-plan-nutricional" ? "border-sky-300/70 bg-sky-500/20 text-sky-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Nutricional ({planStatusSummary.conNutricional})
            </button>
            <button
              type="button"
              onClick={() => setPlanFilter("sin-plan-nutricional")}
              className={`rounded-full border px-2.5 py-1 font-semibold ${filtroPlan === "sin-plan-nutricional" ? "border-slate-300/70 bg-slate-600/30 text-slate-100" : "border-white/20 text-slate-200 hover:bg-white/10"}`}
            >
              Sin nutricional ({planStatusSummary.sinNutricional})
            </button>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total visibles</p>
              <p className="text-xl font-black text-white">{clientesFiltrados.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-emerald-200">Con plan</p>
              <p className="text-xl font-black text-emerald-100">{planStatusSummary.conPlan}</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Nutricional</p>
              <p className="text-xl font-black text-cyan-100">{planStatusSummary.conNutricional}</p>
            </div>
            <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-rose-200">Sin plan</p>
              <p className="text-xl font-black text-rose-100">{planStatusSummary.sinPlan}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-cyan-300/15 bg-slate-950/45 p-3 backdrop-blur-sm">
            {clientesFiltrados.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">No hay clientes en este apartado.</p>
            ) : (
              clientesFiltrados.map((cliente) => {
                const active = cliente.id === selectedClientId;
                const sesionesCount = sesionesPorCliente[cliente.id] || 0;
                const meta = getMeta(cliente);
                const userId = cliente.id.split(":")[1];
                const etiquetasCliente = etiquetasByUserId[userId] || [];
                const lastPayment = latestPaymentByClientId.get(cliente.id);
                const nutritionStatus = nutritionPlanStatusByClientId.get(cliente.id);

                return (
                  <article
                    key={cliente.id}
                    className={`w-full overflow-hidden rounded-2xl border p-2.5 transition ${active ? "border-cyan-300/45 bg-cyan-500/10" : "border-white/10 bg-slate-900/65 hover:border-cyan-300/30 hover:bg-slate-900/80"}`}
                    data-layout-lock="clientes-row-card"
                  >
                    <div className="flex flex-wrap items-center gap-2.5" data-layout-lock="clientes-row-content">
                      <div className="flex shrink-0 items-center justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-500/15 text-xs font-black text-cyan-100">
                          {cliente.nombre
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase() || "")
                            .join("") || "CL"}
                        </div>
                      </div>

                      <div className="min-w-[140px] flex-1">
                        <p className="truncate text-sm font-bold text-white">{cliente.nombre}</p>
                        <p className="truncate text-xs text-slate-300">{cliente.club || "Sin club"}</p>
                      </div>

                      <div className="flex shrink-0 items-center">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cliente.tipo === "jugadora" ? "bg-cyan-500/20 text-cyan-100" : "bg-lime-500/20 text-lime-100"}`}>
                          {cliente.tipo === "jugadora" ? "Jugadora" : "Alumno/a"}
                        </span>
                      </div>

                      <div className="min-w-[110px] text-xs text-slate-200">
                        <p className="truncate">{cliente.categoria || cliente.deporte || "-"}</p>
                      </div>

                      <div className="flex min-w-[180px] flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sesionesCount > 0 ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/20 text-rose-100"}`}>
                          {sesionesCount > 0 ? `Con plan (${sesionesCount})` : "Sin plan"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${nutritionStatus?.hasPlan ? "bg-cyan-500/20 text-cyan-100" : "bg-slate-700/60 text-slate-300"}`}
                          title={nutritionStatus?.hasPlan ? nutritionStatus.planName : "Sin plan nutricional"}
                        >
                          {nutritionStatus?.hasPlan ? "Nutri: con plan" : "Nutri: sin plan"}
                        </span>
                      </div>

                      <div className="min-w-[120px] text-[11px]">
                        <p className="truncate text-slate-300">{meta.endDate || "Sin vencimiento"}</p>
                        <p className="truncate text-slate-400">{lastPayment ? `${lastPayment.moneda} ${lastPayment.importe.toLocaleString("es-AR")}` : "Sin pagos"}</p>
                      </div>

                      <div className="min-w-[220px] max-w-[320px]">
                        {etiquetasCliente.length === 0 ? (
                          <span className="inline-flex rounded-full border border-slate-500/50 bg-slate-800/70 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                            Sin etiquetas
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {etiquetasCliente.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                className="max-w-[120px] truncate rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_2px_10px_rgba(15,23,42,0.35)]"
                                style={{ backgroundColor: tag.color || "#2196f3" }}
                                title={tag.texto}
                              >
                                {tag.texto}
                              </span>
                            ))}
                            {etiquetasCliente.length > 3 ? (
                              <span className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-2 py-1 text-[11px] font-bold text-cyan-100">
                                +{etiquetasCliente.length - 3}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <button type="button" onClick={() => openClientDetail(cliente.id, "datos")} className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10" title="Ver ficha">👁</button>
                        <button type="button" onClick={() => openClientDetail(cliente.id, "notas")} className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10" title="Chat y notas">💬</button>
                        <button type="button" onClick={() => openWhatsapp(cliente)} disabled={!getMeta(cliente).telefono} className="rounded-lg border border-emerald-300/40 bg-emerald-500/5 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-40" title="WhatsApp">🟢</button>
                        <Link href={buildPlanViewHref(cliente.id, "plan-entrenamiento")} prefetch className="rounded-lg border border-cyan-300/40 bg-cyan-500/5 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10" title="Abrir plan en pantalla nueva">📌</Link>
                        <button type="button" onClick={() => toggleEstado(cliente)} className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10" title="Activar/Finalizar">↔</button>
                        <button type="button" onClick={() => borrarCliente(cliente)} className="rounded-lg border border-rose-300/30 bg-rose-500/5 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/10" title="Eliminar">🗑</button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
        ) : null}

        {isDetailMode ? (
        <div className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg">
          {!selectedClient || !selectedMeta || !datosDraft ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">Selecciona un cliente para abrir su ficha.</div>
          ) : (
            <>
              <div className="mb-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ficha del cliente</p>
                    <h2 className="text-lg font-bold text-white">{selectedClient.nombre}</h2>
                    <p className="text-xs text-slate-300">{selectedClient.tipo === "jugadora" ? "Perfil de jugadora" : "Perfil de alumno"}</p>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openWhatsapp(selectedClient)}
                      disabled={!selectedMeta.telefono}
                      className="rounded-lg border border-emerald-300/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-40"
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={closeClientDetail}
                      className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
                    >
                      Volver al listado
                    </button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-800/95 via-slate-800/75 to-slate-700/60 p-4">
                <div className="grid gap-3 md:grid-cols-6">
                  <div>
                    <p className="text-xs text-slate-300">Cliente:</p>
                    <p className="text-2xl font-black text-white">{selectedClient.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Ultimo Chequeo:</p>
                    <p className="font-bold text-white">{selectedMeta.lastCheck}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Proximo chequeo:</p>
                    <p className="font-bold text-white">{selectedMeta.nextCheck}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Altura:</p>
                    <p className="font-bold text-white">{selectedClient.altura || "SIN DATOS"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Obj. Nutricional:</p>
                    <p className="font-bold text-white">{selectedMeta.objNutricional || "SIN DATOS"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Plan nutricional:</p>
                    <p className="font-bold text-white">
                      {selectedNutritionPlan ? selectedNutritionPlan.nombre : "SIN PLAN"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {TABS.map((tab, index) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setDetailTabId(tab.id);
                        pushUrlWithoutReload(buildClientDetailHref(selectedClient.id, tab.id));
                      }}
                      className={`pf-cliente-tab-card group relative overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition ${activeTab === tab.id ? "pf-cliente-tab-active border-cyan-300/70 bg-cyan-500/20 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.24)]" : "border-cyan-300/35 bg-slate-900/55 text-white hover:border-cyan-300/60 hover:bg-cyan-500/10"}`}
                      style={{ animationDelay: `${Math.min(index, 8) * 42}ms` }}
                    >
                      {activeTab === tab.id ? (
                        <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-cyan-100/90" />
                      ) : null}
                      <span className="relative flex items-start gap-2">
                        <span className="mt-0.5 text-base leading-none">{tab.icon}</span>
                        <span>
                          <span className="block text-sm font-bold leading-tight">{tab.label}</span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-300 group-hover:text-cyan-100">
                            Vista dedicada
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-2">
                  {/* Etiquetas chips visualización */}
                  <div className="w-full lg:w-auto">
                    <EtiquetasChips etiquetas={etiquetas} />
                  </div>
                  {/* Crear etiqueta */}
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await fetch("/api/etiquetas", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId: selectedClient.id.split(":")[1],
                          texto: etiquetaCrear.texto,
                          color: etiquetaCrear.color,
                        }),
                      });
                      if (res.ok) {
                        setEtiquetaCrear({ texto: "", color: "#2196f3" });
                        fetch(`/api/etiquetas?userId=${selectedClient.id.split(":")[1]}`)
                          .then((res) => res.json())
                          .then((data: Etiqueta[]) => {
                            setEtiquetas(data || []);
                            setEtiquetasByUserId((prev) => ({
                              ...prev,
                              [selectedClient.id.split(":")[1]]: data || [],
                            }));
                          });
                      }
                    }}
                  >
                    <input
                      value={etiquetaCrear.texto}
                      onChange={(e) => setEtiquetaCrear((prev) => ({ ...prev, texto: e.target.value }))}
                      placeholder="Nueva etiqueta"
                      className="rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs"
                    />
                    <input
                      type="color"
                      value={etiquetaCrear.color}
                      onChange={(e) => setEtiquetaCrear((prev) => ({ ...prev, color: e.target.value }))}
                      className="w-8 h-8 border border-white/20"
                    />
                    <button type="submit" className="rounded bg-cyan-400 px-2 py-1 text-xs font-bold text-slate-950 hover:bg-cyan-300">+</button>
                  </form>
                  {/* Buscador por etiqueta */}
                  <input
                    value={etiquetaSearch}
                    onChange={(e) => setEtiquetaSearch(e.target.value)}
                    placeholder="Buscar por etiqueta"
                    className="rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                {activeTab === "datos" ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100/85">Datos generales</p>
                        <h3 className="mt-1 text-xl font-black text-white">Cliente</h3>
                        <p className="mt-1 text-xs text-slate-200/90">Ficha personal, contacto y perfil deportivo en un solo panel.</p>
                      </div>

                      <div className="rounded-2xl border border-white/12 bg-slate-900/65 p-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">Identidad y contacto</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input value={datosDraft.nombre} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, nombre: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Nombre" />
                          <input value={selectedMeta.apellido} onChange={(e) => setMetaPatch(selectedClient.id, { apellido: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Apellido" />
                          <input value={selectedMeta.segundoApellido} onChange={(e) => setMetaPatch(selectedClient.id, { segundoApellido: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Segundo apellido" />
                          <input value={selectedMeta.email} onChange={(e) => setMetaPatch(selectedClient.id, { email: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Email" />
                          <input type="date" value={datosDraft.fechaNacimiento} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, fechaNacimiento: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
                          <input value={selectedMeta.telefono} onChange={(e) => setMetaPatch(selectedClient.id, { telefono: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Telefono" />
                          <input value={selectedMeta.codigoPais} onChange={(e) => setMetaPatch(selectedClient.id, { codigoPais: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Cod. telefono pais" />
                          <input value={selectedMeta.pais} onChange={(e) => setMetaPatch(selectedClient.id, { pais: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Pais" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/12 bg-slate-900/65 p-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">Ubicacion y perfil fisico</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input value={selectedMeta.provincia} onChange={(e) => setMetaPatch(selectedClient.id, { provincia: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Provincia/Estado" />
                          <input value={selectedMeta.calle} onChange={(e) => setMetaPatch(selectedClient.id, { calle: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Calle" />
                          <input value={selectedMeta.numero} onChange={(e) => setMetaPatch(selectedClient.id, { numero: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Numero" />
                          <input value={selectedMeta.piso} onChange={(e) => setMetaPatch(selectedClient.id, { piso: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Piso" />
                          <input value={selectedMeta.depto} onChange={(e) => setMetaPatch(selectedClient.id, { depto: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Depto" />
                          <select value={selectedMeta.sexo} onChange={(e) => setMetaPatch(selectedClient.id, { sexo: e.target.value as "masculino" | "femenino" })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                            <option value="masculino">Masculino</option>
                            <option value="femenino">Femenino</option>
                          </select>
                          <input value={datosDraft.altura} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, altura: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Altura" />
                          <input value={datosDraft.peso} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, peso: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Peso" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/12 bg-slate-900/65 p-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">Contexto deportivo y objetivos</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input value={datosDraft.club} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, club: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Club" />
                          {selectedClient.tipo === "jugadora" ? (
                            <>
                              <select value={datosDraft.deporte} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, deporte: e.target.value, posicion: "" } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                                {deportesOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                              <select value={datosDraft.categoria} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, categoria: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                                {categoriasOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                              <select value={datosDraft.posicion} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, posicion: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                                <option value="">Sin posicion</option>
                                {(deportes.find((dep) => dep.nombre === datosDraft.deporte)?.posiciones || []).map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                            </>
                          ) : null}
                          <input value={datosDraft.objetivo} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, objetivo: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm md:col-span-2" placeholder="Objetivo" />
                          <textarea value={datosDraft.observaciones} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, observaciones: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm md:col-span-2" rows={2} placeholder="Observaciones" />
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button type="button" onClick={saveDatosGenerales} className="rounded-xl bg-cyan-400 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300">
                            Guardar cambios
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-white">Informacion de la asesoria</h3>
                      <p className="text-xs text-slate-300">
                        Estas fechas muestran la vigencia real del plan para el cliente: desde cuando inicia y hasta cuando finaliza la asesoria.
                      </p>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Fecha de inicio</p>
                          <input type="date" value={selectedMeta.startDate} onChange={(e) => setMetaPatch(selectedClient.id, { startDate: e.target.value })} className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Fecha de fin</p>
                          <input type="date" value={selectedMeta.endDate} onChange={(e) => setMetaPatch(selectedClient.id, { endDate: e.target.value })} className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Categoria del plan</p>
                          <input value={selectedMeta.categoriaPlan} onChange={(e) => setMetaPatch(selectedClient.id, { categoriaPlan: e.target.value })} className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Categoria" />
                        </div>
                      </div>

                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-cyan-100">Renovacion automatica del plan</p>
                            <p className="text-xs text-slate-300">
                              Si el cliente paga y se registra el pago, se actualiza automaticamente la fecha de fin.
                            </p>
                          </div>
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                            <input
                              type="checkbox"
                              checked={selectedMeta.autoRenewPlan}
                              onChange={(e) => setMetaPatch(selectedClient.id, { autoRenewPlan: e.target.checked })}
                              className="h-4 w-4 accent-cyan-400"
                            />
                            Activa
                          </label>
                        </div>
                        <div className="mt-3 max-w-[230px] space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Plazo de renovacion (dias)</p>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={selectedMeta.renewalDays}
                            onChange={(e) => {
                              const value = Math.max(1, Math.min(365, Number(e.target.value || 30)));
                              setMetaPatch(selectedClient.id, { renewalDays: value });
                            }}
                            className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <textarea value={selectedMeta.colaboradores} onChange={(e) => setMetaPatch(selectedClient.id, { colaboradores: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" rows={2} placeholder="Colaboradores" />
                      <textarea value={selectedMeta.chats} onChange={(e) => setMetaPatch(selectedClient.id, { chats: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" rows={2} placeholder="Chats" />

                      <div className="grid gap-3 md:grid-cols-2">
                        <select value={selectedMeta.tipoAsesoria} onChange={(e) => setMetaPatch(selectedClient.id, { tipoAsesoria: e.target.value as ClienteMeta["tipoAsesoria"] })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                          <option value="entrenamiento">Entrenamiento</option>
                          <option value="nutricion">Nutricion</option>
                          <option value="completa">Completa</option>
                        </select>
                        <select value={selectedMeta.modalidad} onChange={(e) => setMetaPatch(selectedClient.id, { modalidad: e.target.value as ClienteMeta["modalidad"] })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                          <option value="virtual">Virtual</option>
                          <option value="presencial">Presencial</option>
                        </select>
                      </div>

                      <h4 className="pt-2 text-lg font-bold">Detalle de pagos</h4>
                      <div className="grid gap-3 md:grid-cols-3">
                        <select value={selectedMeta.moneda} onChange={(e) => setMetaPatch(selectedClient.id, { moneda: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"><option value="ARS">ARS</option><option value="USD">USD</option></select>
                        <input value={selectedMeta.importe} onChange={(e) => setMetaPatch(selectedClient.id, { importe: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Importe" />
                        <input value={selectedMeta.saldo} onChange={(e) => setMetaPatch(selectedClient.id, { saldo: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Saldo" />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <select value={selectedMeta.pagoEstado} onChange={(e) => setMetaPatch(selectedClient.id, { pagoEstado: e.target.value as ClienteMeta["pagoEstado"] })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm">
                          <option value="confirmado">Pago confirmado</option>
                          <option value="pendiente">Pago pendiente</option>
                        </select>
                        <input value={selectedMeta.emailPagador} onChange={(e) => setMetaPatch(selectedClient.id, { emailPagador: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Email del pagador" />
                      </div>
                    </div>
                  </div>
                ) : activeTab === "plan-entrenamiento" ? (
                  <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-black text-white">Plan de entrenamiento</h3>
                      <Link
                        href="/sesiones"
                        className="rounded-lg border border-cyan-300/35 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
                      >
                        Gestionar sesiones
                      </Link>
                    </div>

                    {sesionesCliente.length === 0 ? (
                      <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                        No hay sesiones vinculadas para este cliente todavia.
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {sesionesCliente.map((sesion) => (
                          <article key={sesion.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                            <p className="text-lg font-bold text-white">{sesion.titulo}</p>
                            <p className="mt-1 text-sm text-slate-300">{sesion.objetivo}</p>
                            <p className="mt-2 text-xs font-semibold text-cyan-100">
                              {sesion.duracion} min · {sesion.bloques.length} bloques
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeTab === "plan-nutricional" ? (
                  <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
                    <h3 className="text-lg font-black text-white">Plan nutricional</h3>

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
                          className="mt-3 inline-flex rounded-lg border border-amber-200/40 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/10"
                        >
                          Ir a Nutricion
                        </Link>
                      </div>
                    )}
                  </div>
                ) : activeTab === "progreso" ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-300">Wellness</p>
                      <p className="text-3xl font-black text-cyan-100">{selectedClient.wellness ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-300">Carga</p>
                      <p className="text-3xl font-black text-emerald-100">{selectedClient.carga ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-300">Peso actual</p>
                      <p className="text-3xl font-black text-violet-100">{selectedClient.peso || "-"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div
                      className={`rounded-2xl border p-4 ${
                        tabVisualConfig[activeTab]?.accent || "border-slate-300/25 bg-slate-700/20"
                      }`}
                    >
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-200/80">
                        {tabVisualConfig[activeTab]?.badge || "Detalle"}
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        {tabVisualConfig[activeTab]?.title || TABS.find((item) => item.id === activeTab)?.label}
                      </h3>
                      <p className="mt-1 text-sm text-slate-200/90">
                        {tabVisualConfig[activeTab]?.hint || tabPlaceholderCopy[activeTab] || "Apartado editable del cliente."}
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-white/15 bg-slate-950/45 p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Cliente</p>
                          <p className="truncate text-sm font-bold text-white">{selectedClient.nombre}</p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-slate-950/45 p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Vigencia plan</p>
                          <p className="truncate text-sm font-bold text-white">
                            {selectedMeta.startDate || "Sin inicio"} - {selectedMeta.endDate || "Sin fin"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-slate-950/45 p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Largo de nota</p>
                          <p className="text-sm font-bold text-white">
                            {(selectedMeta.tabNotas[activeTab] || "").trim().length} caracteres
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300">
                      Campo de trabajo para {TABS.find((item) => item.id === activeTab)?.label?.toLowerCase()}.
                    </p>
                    <textarea
                      value={selectedMeta.tabNotas[activeTab] || ""}
                      onChange={(e) => updateTabNote(activeTab, e.target.value)}
                      rows={10}
                      className="w-full rounded-2xl border border-white/20 bg-slate-900/80 px-4 py-3 text-sm leading-relaxed shadow-inner shadow-cyan-500/5"
                      placeholder="Escribe aqui observaciones accionables, acuerdos y pendientes..."
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        ) : null}
      </section>
    </main>
  );
}
