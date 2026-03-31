"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  | "antropometria"
  | "progreso";

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

type IngresanteCliente = {
  id: string;
  nombre?: string;
  apellido?: string;
  nombreCompleto: string;
  email: string;
  telefono?: string;
  fechaNacimiento?: string;
  emailVerified: boolean;
  createdAt: string;
  estado: string;
  intake?: {
    anamnesis?: {
      antecedentesMedicos?: string;
      lesionesPrevias?: string;
      objetivoPrincipal?: string;
      medicacionActual?: string;
      cirugias?: string;
      actividadFisicaActual?: string;
      restricciones?: string;
    };
  };
};

type AlumnoAccountStatus = {
  userId: string;
  email: string;
  nombreCompleto: string;
  sidebarImage: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
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

type AlumnoAnthropometryRecord = {
  id: string;
  alumnoNombre: string;
  fecha: string;
  peso: number;
  grasaCorporal: number;
  cintura: number;
  cadera: number;
  pecho: number;
  brazo: number;
  muslo: number;
  comentario: string;
  updatedAt: string;
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
const ALUMNO_ANTROPOMETRIA_KEY = "pf-control-alumno-antropometria-v1";
const PASSWORD_VISIBLE_TTL_MS = 2 * 60 * 1000;
const SIDEBAR_IMAGE_MAX_EDGE = 960;
const SIDEBAR_IMAGE_TARGET_BYTES = 360 * 1024;
const SIDEBAR_IMAGE_MAX_DATA_URL_LENGTH = 900_000;

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return 0;
  const base64Length = dataUrl.length - commaIndex - 1;
  return Math.ceil((base64Length * 3) / 4);
}

function loadImageFromObjectUrl(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    image.src = objectUrl;
  });
}

async function optimizeClientProfileImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight) || 1;
    const scale = Math.min(1, SIDEBAR_IMAGE_MAX_EDGE / longestSide);

    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));
    let quality = 0.82;

    const canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");

    if (!context) {
      throw new Error("No se pudo preparar el compresor de imagen");
    }

    const render = (q: number) => {
      canvas.width = width;
      canvas.height = height;
      context = canvas.getContext("2d");
      if (!context) {
        throw new Error("No se pudo renderizar la imagen");
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", q);
    };

    let dataUrl = render(quality);

    while (
      (estimateDataUrlBytes(dataUrl) > SIDEBAR_IMAGE_TARGET_BYTES ||
        dataUrl.length > SIDEBAR_IMAGE_MAX_DATA_URL_LENGTH) &&
      quality > 0.5
    ) {
      quality = Number((quality - 0.08).toFixed(2));
      dataUrl = render(quality);
    }

    while (dataUrl.length > SIDEBAR_IMAGE_MAX_DATA_URL_LENGTH && width > 320 && height > 320) {
      width = Math.max(320, Math.round(width * 0.85));
      height = Math.max(320, Math.round(height * 0.85));
      dataUrl = render(Math.max(quality, 0.62));
    }

    if (dataUrl.length > SIDEBAR_IMAGE_MAX_DATA_URL_LENGTH) {
      throw new Error("La imagen sigue siendo muy grande. Elegi una foto mas liviana.");
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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

function parseHeightMeters(value?: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/g, ".").replace(/[^0-9.]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  if (parsed > 10) {
    return parsed / 100;
  }

  return parsed;
}

function computeImc(weightKg: number, heightMeters: number | null): number | null {
  if (!heightMeters || heightMeters <= 0) return null;
  const value = weightKg / (heightMeters * heightMeters);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function estimateBodyFatRfm(
  heightMeters: number | null,
  waistCm: number,
  sexo: "masculino" | "femenino"
): number | null {
  if (!heightMeters || heightMeters <= 0 || !Number.isFinite(waistCm) || waistCm <= 0) {
    return null;
  }

  const heightCm = heightMeters * 100;
  const raw = sexo === "masculino"
    ? 64 - 20 * (heightCm / waistCm)
    : 76 - 20 * (heightCm / waistCm);

  if (!Number.isFinite(raw)) return null;
  const clamped = Math.max(2, Math.min(70, raw));
  return Math.round(clamped * 10) / 10;
}

function imcCategory(imc: number | null): string {
  if (imc === null) return "Sin datos";
  if (imc < 18.5) return "Bajo peso";
  if (imc < 25) return "Normopeso";
  if (imc < 30) return "Sobrepeso";
  return "Obesidad";
}

function bodyFatCategory(
  bodyFatPct: number | null,
  sexo: "masculino" | "femenino"
): string {
  if (bodyFatPct === null || !Number.isFinite(bodyFatPct) || bodyFatPct <= 0) {
    return "Sin datos";
  }

  if (sexo === "masculino") {
    if (bodyFatPct < 6) return "Esencial";
    if (bodyFatPct < 14) return "Atletico";
    if (bodyFatPct < 18) return "Fitness";
    if (bodyFatPct < 25) return "Promedio";
    return "Alto";
  }

  if (bodyFatPct < 14) return "Esencial";
  if (bodyFatPct < 21) return "Atletico";
  if (bodyFatPct < 25) return "Fitness";
  if (bodyFatPct < 32) return "Promedio";
  return "Alto";
}

function buildLinePath(values: number[], width = 320, height = 120): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
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

const TABS: { id: ClienteTab; label: string }[] = [
  { id: "datos", label: "Datos generales" },
  { id: "cuestionario", label: "Cuestionario" },
  { id: "plan-entrenamiento", label: "Plan entrenamiento" },
  { id: "plan-nutricional", label: "Plan nutricional" },
  { id: "recetas", label: "Recetas" },
  { id: "notas", label: "Notas" },
  { id: "documentos", label: "Documentos" },
  { id: "antropometria", label: "Antropometria" },
  { id: "progreso", label: "Progreso" },
];

const tabPlaceholderCopy: Partial<Record<ClienteTab, string>> = {
  cuestionario: "Cuestionario inicial, antecedentes y habitos.",
  "plan-nutricional": "Lineamientos nutricionales y adherencia semanal.",
  recetas: "Recetas sugeridas y planificacion de comidas.",
  notas: "Notas del profesional y seguimiento del cliente.",
  documentos: "Links o referencias de documentos cargados.",
  antropometria: "Historial de medidas antropometricas del alumno.",
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
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
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
  const [anthropometryRecords, setAnthropometryRecords] = useSharedState<AlumnoAnthropometryRecord[]>([], {
    key: ALUMNO_ANTROPOMETRIA_KEY,
    legacyLocalStorageKey: ALUMNO_ANTROPOMETRIA_KEY,
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
  const [ingresantes, setIngresantes] = useState<IngresanteCliente[]>([]);
  const [ingresantesLoading, setIngresantesLoading] = useState(false);
  const [ingresantesError, setIngresantesError] = useState("");
  const [ingresantesSuccess, setIngresantesSuccess] = useState("");
  const [ingresanteActionId, setIngresanteActionId] = useState("");
  const [resendVerificationId, setResendVerificationId] = useState("");
  const [anthropometryEditingId, setAnthropometryEditingId] = useState<string | null>(null);
  const [anthropometryDraft, setAnthropometryDraft] = useState<AlumnoAnthropometryRecord | null>(null);
  const [accountPasswordLoading, setAccountPasswordLoading] = useState(false);
  const [accountPasswordInfo, setAccountPasswordInfo] = useState<{
    userId: string;
    email: string;
    role: string;
    password: string;
    issuedAt: string | null;
  } | null>(null);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const [accountSidebarImage, setAccountSidebarImage] = useState<string | null>(null);
  const [accountSidebarImageLoading, setAccountSidebarImageLoading] = useState(false);
  const [accountSidebarImageSaving, setAccountSidebarImageSaving] = useState(false);
  const [accountSidebarImageMessage, setAccountSidebarImageMessage] = useState<string | null>(null);
  const [accountSidebarImageError, setAccountSidebarImageError] = useState<string | null>(null);
  const [resolvedAccountUserId, setResolvedAccountUserId] = useState<string | null>(null);
  const [resolvedAccountEmail, setResolvedAccountEmail] = useState<string | null>(null);
  const [alumnoAccountStatuses, setAlumnoAccountStatuses] = useState<AlumnoAccountStatus[]>([]);

  const loadIngresantes = async () => {
    if (!isAdmin) return;

    try {
      setIngresantesLoading(true);
      setIngresantesError("");
      const res = await fetch("/api/admin/ingresantes");
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data?.message || "No se pudieron cargar ingresantes");
      }
      setIngresantes(Array.isArray(data) ? data : []);
    } catch (error) {
      setIngresantesError(error instanceof Error ? error.message : "No se pudieron cargar ingresantes");
      setIngresantes([]);
    } finally {
      setIngresantesLoading(false);
    }
  };

  const handleIngresanteAction = async (userId: string, action: "aprobar" | "rechazar") => {
    if (!isAdmin) return;
    const actionLabel = action === "aprobar" ? "aprobar" : "rechazar";
    if (!confirm(`Confirmas ${actionLabel} este ingresante?`)) return;

    try {
      setIngresanteActionId(userId);
      setIngresantesError("");
      setIngresantesSuccess("");
      const res = await fetch("/api/admin/ingresantes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "No se pudo actualizar ingresante");
      }
      setIngresantes((current) => current.filter((item) => item.id !== userId));
      setIngresantesSuccess(
        action === "aprobar"
          ? "Alumno dado de alta correctamente."
          : "Ingresante rechazado correctamente."
      );
    } catch (error) {
      setIngresantesError(error instanceof Error ? error.message : "No se pudo actualizar ingresante");
    } finally {
      setIngresanteActionId("");
    }
  };

  const handleResendIngresanteVerification = async (email: string, userId: string) => {
    if (!isAdmin) return;
    if (!email) return;

    try {
      setResendVerificationId(userId);
      setIngresantesError("");
      setIngresantesSuccess("");

      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'No se pudo reenviar verificacion');
      }

      setIngresantesSuccess(data?.message || 'Correo de verificacion reenviado exitosamente.');
      await loadIngresantes();
    } catch (error) {
      setIngresantesError(
        error instanceof Error ? error.message : 'No se pudo reenviar verificacion'
      );
    } finally {
      setResendVerificationId("");
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadIngresantes();
  }, [isAdmin]);

  useEffect(() => {
    const safeDecodeParam = (value: string | null) => {
      if (!value) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    setIsDetailMode(searchParams.get("detalle") === "1");
    setDetailClientId(safeDecodeParam(searchParams.get("cliente")));
    setDetailTabId(safeDecodeParam(searchParams.get("tab")));
  }, [searchParams]);

  const categoriasOptions = useMemo(
    () => categorias.filter((cat) => cat.habilitada).map((cat) => cat.nombre),
    [categorias]
  );

  const normalizedActiveTab = useMemo(
    () =>
      String(activeTab || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-"),
    [activeTab]
  );
  const isPlanNutricionalTab = normalizedActiveTab === "plan-nutricional";

  useEffect(() => {
    if (!isDetailMode || !detailClientId) return;

    setSelectedClientId(detailClientId);

    const normalizedDetailTabId = detailTabId === "chequeos" ? "antropometria" : detailTabId;

    if (normalizedDetailTabId && TABS.some((tab) => tab.id === normalizedDetailTabId)) {
      setActiveTab(normalizedDetailTabId as ClienteTab);
    }
  }, [detailClientId, detailTabId, isDetailMode]);

  const openClientDetail = (clientId: string, tab: ClienteTab = "datos") => {
    setSelectedClientId(clientId);
    setActiveTab(tab);
    setIsDetailMode(true);
    setDetailClientId(clientId);
    setDetailTabId(tab);

    const params = new URLSearchParams();
    params.set("detalle", "1");
    params.set("cliente", clientId);
    params.set("tab", tab);
    router.push(`/clientes?${params.toString()}`);
  };

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

  useEffect(() => {
    setAccountPasswordInfo(null);
  }, [selectedClient?.id]);

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

  const selectedAnthropometryRecords = useMemo(() => {
    if (!selectedClient) return [];

    const clientName = selectedClient.nombre;
    const clientIdName = selectedClient.id.split(":")[1] || "";

    return anthropometryRecords
      .filter(
        (record) =>
          namesLikelyMatch(record.alumnoNombre, clientName) ||
          namesLikelyMatch(record.alumnoNombre, clientIdName)
      )
      .slice()
      .sort((a, b) => {
        const dateDiff = new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });
  }, [anthropometryRecords, selectedClient]);

  const latestAnthropometry = selectedAnthropometryRecords[0] || null;
  const previousAnthropometry = selectedAnthropometryRecords[1] || null;
  const anthropometryPesoDiff =
    latestAnthropometry && previousAnthropometry
      ? latestAnthropometry.peso - previousAnthropometry.peso
      : 0;
  const anthropometryCinturaDiff =
    latestAnthropometry && previousAnthropometry
      ? latestAnthropometry.cintura - previousAnthropometry.cintura
      : 0;

  const formatDiff = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    if (rounded === 0) return "0";
    return `${rounded > 0 ? "+" : ""}${rounded}`;
  };

  const selectedHeightMeters = useMemo(
    () => parseHeightMeters(selectedClient?.altura),
    [selectedClient?.altura]
  );

  const anthropometrySexo = useMemo(
    () => ((selectedClient ? clientesMeta[selectedClient.id]?.sexo : "femenino") || "femenino") as "masculino" | "femenino",
    [clientesMeta, selectedClient]
  );

  const latestImc = useMemo(() => {
    if (!latestAnthropometry) return null;
    return computeImc(latestAnthropometry.peso, selectedHeightMeters);
  }, [latestAnthropometry, selectedHeightMeters]);

  const previousImc = useMemo(() => {
    if (!previousAnthropometry) return null;
    return computeImc(previousAnthropometry.peso, selectedHeightMeters);
  }, [previousAnthropometry, selectedHeightMeters]);

  const imcDiff =
    latestImc !== null && previousImc !== null ? Math.round((latestImc - previousImc) * 10) / 10 : 0;

  const latestBodyFatCategory = useMemo(
    () => bodyFatCategory(latestAnthropometry?.grasaCorporal ?? null, anthropometrySexo),
    [anthropometrySexo, latestAnthropometry?.grasaCorporal]
  );

  const anthropometryChartData = useMemo(() => {
    return selectedAnthropometryRecords
      .slice()
      .reverse()
      .map((record) => ({
        date: record.fecha,
        peso: record.peso,
        grasa: record.grasaCorporal,
        imc: computeImc(record.peso, selectedHeightMeters),
      }));
  }, [selectedAnthropometryRecords, selectedHeightMeters]);

  const pesoLinePath = useMemo(
    () => buildLinePath(anthropometryChartData.map((item) => item.peso)),
    [anthropometryChartData]
  );

  const imcLinePath = useMemo(
    () => buildLinePath(anthropometryChartData.map((item) => item.imc ?? 0)),
    [anthropometryChartData]
  );

  const grasaLinePath = useMemo(
    () => buildLinePath(anthropometryChartData.map((item) => item.grasa)),
    [anthropometryChartData]
  );

  const recalculateAnthropometryForSelected = () => {
    if (!isAdmin || !selectedClient || selectedClient.tipo !== "alumno") return;
    if (!selectedHeightMeters) {
      window.dispatchEvent(
        new CustomEvent("pf-inline-toast", {
          detail: {
            type: "warning",
            title: "Antropometria",
            message: "No se puede calcular sin altura del alumno en Datos generales.",
          },
        })
      );
      return;
    }

    const sexo = anthropometrySexo;
    const selectedName = selectedClient.nombre;
    const selectedIdName = selectedClient.id.split(":")[1] || "";

    markManualSaveIntent(ALUMNO_ANTROPOMETRIA_KEY);
    setAnthropometryRecords((prev) =>
      prev.map((item) => {
        const belongsToSelected =
          namesLikelyMatch(item.alumnoNombre, selectedName) ||
          namesLikelyMatch(item.alumnoNombre, selectedIdName);

        if (!belongsToSelected) {
          return item;
        }

        const recalculatedBodyFat = estimateBodyFatRfm(selectedHeightMeters, item.cintura, sexo);
        return {
          ...item,
          grasaCorporal: recalculatedBodyFat ?? item.grasaCorporal,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const startAnthropometryEdit = (record: AlumnoAnthropometryRecord) => {
    setAnthropometryEditingId(record.id);
    setAnthropometryDraft({ ...record });
  };

  const cancelAnthropometryEdit = () => {
    setAnthropometryEditingId(null);
    setAnthropometryDraft(null);
  };

  const saveAnthropometryEdit = () => {
    if (!anthropometryEditingId || !anthropometryDraft) return;

    const numericFields = [
      "peso",
      "grasaCorporal",
      "cintura",
      "cadera",
      "pecho",
      "brazo",
      "muslo",
    ] as const;

    const sanitized: AlumnoAnthropometryRecord = {
      ...anthropometryDraft,
      fecha: anthropometryDraft.fecha,
      comentario: anthropometryDraft.comentario || "",
      updatedAt: new Date().toISOString(),
    };

    for (const field of numericFields) {
      const value = Number(anthropometryDraft[field]);
      if (!Number.isFinite(value) || value < 0) {
        return;
      }
      sanitized[field] = Math.round(value * 10) / 10;
    }

    markManualSaveIntent(ALUMNO_ANTROPOMETRIA_KEY);
    setAnthropometryRecords((prev) =>
      prev.map((item) => (item.id === anthropometryEditingId ? sanitized : item))
    );
    cancelAnthropometryEdit();
  };

  const deleteAnthropometryRecord = (record: AlumnoAnthropometryRecord) => {
    if (!isAdmin) return;
    const ok = window.confirm(
      `Eliminar registro de ${new Date(record.fecha).toLocaleDateString("es-AR")}?`
    );
    if (!ok) return;

    markManualSaveIntent(ALUMNO_ANTROPOMETRIA_KEY);
    setAnthropometryRecords((prev) => prev.filter((item) => item.id !== record.id));

    if (anthropometryEditingId === record.id) {
      cancelAnthropometryEdit();
    }
  };

  const downloadAnthropometryCsv = () => {
    if (!selectedClient || selectedAnthropometryRecords.length === 0 || typeof window === "undefined") {
      return;
    }

    const headers = [
      "fecha",
      "alumno",
      "peso_kg",
      "grasa_pct",
      "cintura_cm",
      "cadera_cm",
      "pecho_cm",
      "brazo_cm",
      "muslo_cm",
      "imc",
      "comentario",
    ];

    const rows = selectedAnthropometryRecords.map((record) => {
      const imc = computeImc(record.peso, selectedHeightMeters);
      return [
        record.fecha,
        selectedClient.nombre,
        record.peso,
        record.grasaCorporal,
        record.cintura,
        record.cadera,
        record.pecho,
        record.brazo,
        record.muslo,
        imc ?? "",
        (record.comentario || "").replace(/\n/g, " "),
      ];
    });

    const toCsvCell = (value: string | number) => {
      const asText = String(value ?? "");
      if (asText.includes(",") || asText.includes('"') || asText.includes("\n")) {
        return `"${asText.replace(/"/g, '""')}"`;
      }
      return asText;
    };

    const csv = [headers.join(","), ...rows.map((row) => row.map(toCsvCell).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileSafeName = selectedClient.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.href = url;
    link.download = `antropometria-${fileSafeName}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

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

  useEffect(() => {
    if (!isAdmin) {
      setAlumnoAccountStatuses([]);
      return;
    }

    let cancelled = false;

    const loadAlumnoAccountStatuses = async () => {
      try {
        const response = await fetch('/api/admin/users/client-status?thresholdSec=90', {
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) {
          return;
        }

        const rows = Array.isArray(data?.rows) ? (data.rows as AlumnoAccountStatus[]) : [];
        setAlumnoAccountStatuses(rows);
      } catch {
        if (!cancelled) {
          setAlumnoAccountStatuses([]);
        }
      }
    };

    void loadAlumnoAccountStatuses();

    const intervalId = window.setInterval(() => {
      void loadAlumnoAccountStatuses();
    }, 30_000);

    const handleFocus = () => {
      void loadAlumnoAccountStatuses();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadAlumnoAccountStatuses();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAdmin]);

  const resolvedAlumnoStatusByClientId = useMemo(() => {
    const byEmail = new Map<string, AlumnoAccountStatus>();
    for (const row of alumnoAccountStatuses) {
      const normalizedEmail = String(row.email || '').trim().toLowerCase();
      if (normalizedEmail) {
        byEmail.set(normalizedEmail, row);
      }
    }

    const resolved = new Map<string, AlumnoAccountStatus | null>();

    for (const cliente of clientes) {
      if (cliente.tipo !== 'alumno') {
        resolved.set(cliente.id, null);
        continue;
      }

      const mergedMeta = {
        ...defaultMeta(cliente),
        ...(clientesMeta[cliente.id] || {}),
      };

      const metaEmail = String(mergedMeta.email || '').trim().toLowerCase();
      if (metaEmail && byEmail.has(metaEmail)) {
        resolved.set(cliente.id, byEmail.get(metaEmail) || null);
        continue;
      }

      const candidates = alumnoAccountStatuses
        .filter((row) => namesLikelyMatch(row.nombreCompleto, cliente.nombre))
        .slice()
        .sort((left, right) => {
          if (left.isOnline !== right.isOnline) {
            return left.isOnline ? -1 : 1;
          }

          const leftHasImage = Boolean(left.sidebarImage);
          const rightHasImage = Boolean(right.sidebarImage);
          if (leftHasImage !== rightHasImage) {
            return leftHasImage ? -1 : 1;
          }

          const leftSeen = left.lastSeenAt ? new Date(left.lastSeenAt).getTime() : 0;
          const rightSeen = right.lastSeenAt ? new Date(right.lastSeenAt).getTime() : 0;
          return rightSeen - leftSeen;
        });

      resolved.set(cliente.id, candidates[0] || null);
    }

    return resolved;
  }, [alumnoAccountStatuses, clientes, clientesMeta]);

  const selectedMeta = useMemo(() => {
    if (!selectedClient) return null;
    return {
      ...defaultMeta(selectedClient),
      ...(clientesMeta[selectedClient.id] || {}),
    };
  }, [clientesMeta, selectedClient]);

  const selectedClientEmail = useMemo(
    () => String(selectedMeta?.email || "").trim().toLowerCase(),
    [selectedMeta?.email]
  );

  useEffect(() => {
    let cancelled = false;

    const loadAccountSidebarImage = async () => {
      setAccountSidebarImageMessage(null);
      setAccountSidebarImageError(null);

      if (!isAdmin || !selectedClient || selectedClient.tipo !== "alumno") {
        setAccountSidebarImage(null);
        setResolvedAccountUserId(null);
        setResolvedAccountEmail(null);
        return;
      }

      const params = new URLSearchParams({ role: "CLIENTE" });
      if (selectedClientEmail) {
        params.set("email", selectedClientEmail);
      } else {
        params.set("nombreCompleto", selectedClient.nombre);
      }

      try {
        setAccountSidebarImageLoading(true);
        const response = await fetch(`/api/admin/users/profile-image?${params.toString()}`);
        const data = await response.json().catch(() => ({}));

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          if (response.status === 404) {
            setAccountSidebarImage(null);
            setResolvedAccountUserId(null);
            setResolvedAccountEmail(null);
            return;
          }
          throw new Error(data?.message || "No se pudo cargar la foto de perfil");
        }

        const remoteImage = typeof data?.sidebarImage === "string" && data.sidebarImage
          ? data.sidebarImage
          : null;
        setAccountSidebarImage(remoteImage);
        setResolvedAccountUserId(typeof data?.user?.id === "string" ? data.user.id : null);
        setResolvedAccountEmail(typeof data?.user?.email === "string" ? data.user.email : null);
      } catch (error) {
        if (!cancelled) {
          setAccountSidebarImage(null);
          setResolvedAccountUserId(null);
          setResolvedAccountEmail(null);
          setAccountSidebarImageError(
            error instanceof Error ? error.message : "No se pudo cargar la foto de perfil"
          );
        }
      } finally {
        if (!cancelled) {
          setAccountSidebarImageLoading(false);
        }
      }
    };

    void loadAccountSidebarImage();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, selectedClient?.id, selectedClient?.nombre, selectedClient?.tipo, selectedClientEmail]);

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
  return Math.max(minByColumn[column], Math.min(estimated, 900));
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

    if (selectedClient.tipo === "alumno") {
      void syncAlumnoAccountProfile({
        currentClientName: selectedClient.nombre,
        nextClientId: nextId,
        nextNombre,
        apellido: selectedMeta.apellido,
        fechaNacimiento: datosDraft.fechaNacimiento,
        telefono: selectedMeta.telefono,
        email: selectedMeta.email,
      });
    }
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

  const emitInlineToast = (
    type: "success" | "error" | "warning",
    title: string,
    message: string
  ) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("pf-inline-toast", {
        detail: { type, title, message },
      })
    );
  };

  const syncAlumnoAccountProfile = async (options: {
    currentClientName: string;
    nextClientId: string;
    nextNombre: string;
    apellido: string;
    fechaNacimiento: string;
    telefono: string;
    email: string;
  }) => {
    if (!isAdmin) return;

    const normalizedEmail = String(options.email || "").trim().toLowerCase();
    const payload: Record<string, unknown> = {
      role: "CLIENTE",
      nombre: options.nextNombre,
      apellido: String(options.apellido || "").trim(),
      fechaNacimiento: options.fechaNacimiento || null,
      telefono: options.telefono || "",
      email: normalizedEmail,
    };

    if (resolvedAccountUserId) {
      payload.userId = resolvedAccountUserId;
    } else if (resolvedAccountEmail) {
      payload.email = resolvedAccountEmail;
    } else if (normalizedEmail) {
      payload.email = normalizedEmail;
    } else {
      payload.nombreCompleto = options.currentClientName;
    }

    try {
      const response = await fetch("/api/admin/users/account-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "No se pudo sincronizar la cuenta del alumno");
      }

      const updatedUserId = typeof data?.user?.id === "string" ? data.user.id : null;
      const updatedEmail = typeof data?.user?.email === "string" ? data.user.email : normalizedEmail;
      const updatedTelefono = typeof data?.user?.telefono === "string" ? data.user.telefono : options.telefono;
      const updatedApellido = typeof data?.user?.apellido === "string" ? data.user.apellido : options.apellido;

      setResolvedAccountUserId(updatedUserId);
      setResolvedAccountEmail(updatedEmail || null);

      setMetaPatch(options.nextClientId, {
        email: updatedEmail || "",
        telefono: updatedTelefono || "",
        apellido: updatedApellido || "",
      });

      emitInlineToast(
        "success",
        "Cuenta",
        data?.message || "Cuenta del alumno sincronizada automaticamente"
      );
    } catch (error) {
      emitInlineToast(
        "error",
        "Cuenta",
        error instanceof Error ? error.message : "No se pudo sincronizar la cuenta del alumno"
      );
    }
  };

  const saveAccountSidebarImage = async (image: string | null) => {
    if (!isAdmin || !selectedClient || selectedClient.tipo !== "alumno") {
      emitInlineToast("warning", "Cuenta", "Solo aplica a alumnos con usuario de acceso");
      return;
    }

    setAccountSidebarImageSaving(true);
    setAccountSidebarImageMessage(null);
    setAccountSidebarImageError(null);

    try {
      const payload: Record<string, string | null> = {
        ...buildAlumnoAccountLookupPayload(),
        sidebarImage: image,
      };

      const response = await fetch("/api/admin/users/profile-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "No se pudo actualizar la foto de perfil");
      }

      const remoteImage =
        typeof data?.sidebarImage === "string" && data.sidebarImage ? data.sidebarImage : null;
      setAccountSidebarImage(remoteImage);
      const message = String(data?.message || "Foto de perfil actualizada");
      setAccountSidebarImageMessage(message);
      emitInlineToast("success", "Cuenta", message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo actualizar la foto de perfil";
      setAccountSidebarImageError(message);
      emitInlineToast("error", "Cuenta", message);
    } finally {
      setAccountSidebarImageSaving(false);
    }
  };

  const handleAccountSidebarImageFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const optimized = await optimizeClientProfileImage(file);
      await saveAccountSidebarImage(optimized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo procesar la imagen";
      setAccountSidebarImageError(message);
      emitInlineToast("error", "Cuenta", message);
    }
  };

  const buildAlumnoAccountLookupPayload = () => {
    const payload: Record<string, string> = {
      role: "CLIENTE",
    };

    if (resolvedAccountUserId) {
      payload.userId = resolvedAccountUserId;
      return payload;
    }

    if (resolvedAccountEmail) {
      payload.email = resolvedAccountEmail;
      return payload;
    }

    if (selectedClientEmail) {
      payload.email = selectedClientEmail;
      return payload;
    }

    if (selectedClient) {
      payload.nombreCompleto = selectedClient.nombre;
    }

    return payload;
  };

  const runAccountPasswordAction = async (action: "show" | "reset") => {
    if (!isAdmin) {
      emitInlineToast("warning", "Permisos", "Solo el admin puede gestionar contrasenas");
      return;
    }

    if (!selectedClient || !selectedMeta) {
      emitInlineToast("warning", "Cuenta", "Selecciona un cliente primero");
      return;
    }

    if (selectedClient.tipo !== "alumno") {
      emitInlineToast("warning", "Cuenta", "Solo aplica a alumnos con usuario de acceso");
      return;
    }

    try {
      setAccountPasswordLoading(true);
      const payload = buildAlumnoAccountLookupPayload();

      const tokenAction = action === "show" ? "issue-token" : "reset";

      const tokenResponse = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          action: tokenAction,
        }),
      });

      const tokenData = await tokenResponse.json().catch(() => ({}));

      if (!tokenResponse.ok) {
        if (action === "show" && tokenData?.code === "PASSWORD_CHANGED") {
          setAccountPasswordInfo(null);
          emitInlineToast("warning", "Informacion", tokenData?.message || "El usuario ya modifico su contrasena, no puede ser consultada.");
          return;
        }

        emitInlineToast("error", "Cuenta", tokenData?.message || "No se pudo procesar la contrasena");
        return;
      }

      const viewToken = String(tokenData?.viewToken || "").trim();
      if (!viewToken) {
        emitInlineToast("error", "Cuenta", "No se pudo obtener token de visualizacion");
        return;
      }

      const response = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          action: "show",
          viewToken,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data?.code === "PASSWORD_CHANGED") {
          setAccountPasswordInfo(null);
          emitInlineToast("warning", "Informacion", data?.message || "El usuario ya modifico su contrasena, no puede ser consultada.");
          return;
        }

        emitInlineToast("error", "Cuenta", data?.message || "No se pudo procesar la contrasena");
        return;
      }
      setAccountPasswordInfo({
        userId: String(data?.user?.id || ""),
        email: String(data?.user?.email || ""),
        role: String(data?.user?.role || ""),
        password: String(data?.password || ""),
        issuedAt: data?.issuedAt || null,
      });
      window.setTimeout(() => {
        setAccountPasswordInfo((current) => {
          if (!current || current.userId !== String(data?.user?.id || "")) {
            return current;
          }
          return null;
        });
      }, PASSWORD_VISIBLE_TTL_MS);

      if (action === "reset") {
        emitInlineToast("success", "Exito", "Contrasena blanqueada correctamente");
      } else {
        emitInlineToast("success", "Exito", "Contrasena consultada correctamente");
      }
    } catch {
      emitInlineToast("error", "Cuenta", "No se pudo procesar la contrasena");
    } finally {
      setAccountPasswordLoading(false);
    }
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
    <main className="mx-auto max-w-[1500px] px-3 py-4 text-slate-100 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-slate-300">
            Vista unificada con apartados operativos estilo panel profesional.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCrearOpen((prev) => !prev);
            if (!crearOpen) resetForm();
          }}
          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
        >
          Crear cliente
        </button>
      </div>

      <section className="mb-6 grid gap-3 md:grid-cols-3">
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
      </section>

      {isAdmin ? (
        <section className="mb-6 rounded-3xl border border-amber-300/30 bg-amber-500/10 p-4 shadow-lg sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-amber-50">Ingresantes</h2>
              <p className="mt-1 text-sm text-amber-100/85">
                Solicitudes nuevas desde el registro publico. Aprobalas para dar alta como alumno.
              </p>
            </div>
            <div className="rounded-xl border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-sm font-bold text-amber-100">
              Pendientes: {ingresantes.length}
            </div>
          </div>

          {ingresantesError ? (
            <div className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
              {ingresantesError}
            </div>
          ) : null}

          {ingresantesSuccess ? (
            <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">
              {ingresantesSuccess}
            </div>
          ) : null}

          {ingresantesLoading ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/55 p-3 text-sm text-slate-200">
              Cargando ingresantes...
            </div>
          ) : null}

          {!ingresantesLoading && ingresantes.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/55 p-3 text-sm text-slate-200">
              No hay ingresantes pendientes.
            </div>
          ) : null}

          {!ingresantesLoading && ingresantes.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {ingresantes.map((item) => {
                const anamnesis = item.intake?.anamnesis || {};
                return (
                  <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-base font-black text-white">{item.nombreCompleto || "Sin nombre"}</p>
                        <p className="text-sm text-slate-300">{item.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-2 py-1 font-bold ${item.emailVerified ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"}`}>
                          {item.emailVerified ? "Email verificado" : "Email pendiente"}
                        </span>
                        <span className="rounded-full bg-sky-500/20 px-2 py-1 font-bold text-sky-200">
                          {new Date(item.createdAt).toLocaleDateString("es-AR")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
                      <p><span className="font-semibold text-slate-100">Telefono:</span> {item.telefono || "-"}</p>
                      <p>
                        <span className="font-semibold text-slate-100">Nacimiento:</span>{" "}
                        {item.fechaNacimiento ? new Date(item.fechaNacimiento).toLocaleDateString("es-AR") : "-"}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-slate-800/55 p-3">
                        <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-cyan-200">Antecedentes</p>
                        <p>{anamnesis.antecedentesMedicos || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-800/55 p-3">
                        <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-cyan-200">Lesiones</p>
                        <p>{anamnesis.lesionesPrevias || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-800/55 p-3">
                        <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-cyan-200">Objetivo</p>
                        <p>{anamnesis.objetivoPrincipal || "-"}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleIngresanteAction(item.id, "aprobar")}
                        disabled={ingresanteActionId === item.id || !item.emailVerified}
                        className="rounded-xl bg-emerald-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {ingresanteActionId === item.id ? "Procesando..." : "Dar alta como alumno"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIngresanteAction(item.id, "rechazar")}
                        disabled={ingresanteActionId === item.id}
                        className="rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-sm font-bold text-rose-100 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResendIngresanteVerification(item.email, item.id)}
                        disabled={resendVerificationId === item.id}
                        className="rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resendVerificationId === item.id ? 'Reenviando...' : 'Reenviar verificacion'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-5">
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

      {crearOpen ? (
        <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-5">
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
          className="w-full rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),rgba(15,23,42,0.88)_38%,rgba(2,6,23,0.96)_100%)] p-4 shadow-[0_24px_60px_rgba(3,7,18,0.55)] sm:p-5"
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
                const alumnoStatus = resolvedAlumnoStatusByClientId.get(cliente.id) || null;
                const alumnoSidebarImage = cliente.tipo === "alumno" ? alumnoStatus?.sidebarImage || null : null;
                const alumnoIsOnline = cliente.tipo === "alumno" ? Boolean(alumnoStatus?.isOnline) : false;
                const userId = cliente.id.split(":")[1];
                const etiquetasCliente = etiquetasByUserId[userId] || [];
                const lastPayment = latestPaymentByClientId.get(cliente.id);
                const nutritionStatus = nutritionPlanStatusByClientId.get(cliente.id);

                return (
                  <article
                    key={cliente.id}
                    className={`w-full overflow-hidden rounded-2xl border p-2.5 transition ${active ? "border-cyan-300/45 bg-cyan-500/10" : "border-white/10 bg-slate-900/65 hover:border-cyan-300/30 hover:bg-slate-900/80"}`}
                    data-layout-lock="clientes-row-card"
                    data-client-row="true"
                    data-client-id={cliente.id}
                    data-client-type={cliente.tipo}
                  >
                    <div className="flex flex-wrap items-center gap-2.5" data-layout-lock="clientes-row-content">
                      <div className="flex shrink-0 items-center justify-center">
                        <div
                          className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-cyan-300/35 bg-cyan-500/15 text-xs font-black text-cyan-100"
                          data-client-avatar="true"
                          data-client-avatar-state={alumnoSidebarImage ? "image" : "initials"}
                        >
                          {alumnoSidebarImage ? (
                            <img src={alumnoSidebarImage} alt={`Foto de ${cliente.nombre}`} className="h-full w-full object-cover" data-client-avatar-image="true" />
                          ) : (
                            <span data-client-avatar-initials="true">
                              {cliente.nombre
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase() || "")
                                .join("") || "CL"}
                            </span>
                          )}

                          {cliente.tipo === "alumno" ? (
                            <span
                              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-slate-950 ${alumnoIsOnline ? "bg-emerald-400" : "bg-slate-500"}`}
                              title={alumnoIsOnline ? "En linea" : "Desconectado"}
                              data-client-presence-dot={alumnoIsOnline ? "online" : "offline"}
                            />
                          ) : null}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 sm:min-w-[140px]">
                        <p className="truncate text-sm font-bold text-white" data-client-name="true">{cliente.nombre}</p>
                        <p className="truncate text-xs text-slate-300">
                          {cliente.club || "Sin club"}
                          {cliente.tipo === "alumno" ? (
                            <span className={alumnoIsOnline ? "text-emerald-300" : "text-slate-400"} data-client-presence-text={alumnoIsOnline ? "online" : "offline"}>
                              {` · ${alumnoIsOnline ? "En linea" : "Desconectado"}`}
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cliente.tipo === "jugadora" ? "bg-cyan-500/20 text-cyan-100" : "bg-lime-500/20 text-lime-100"}`}>
                          {cliente.tipo === "jugadora" ? "Jugadora" : "Alumno/a"}
                        </span>
                      </div>

                      <div className="min-w-0 w-full text-xs text-slate-200 sm:w-auto sm:min-w-[110px]">
                        <p className="truncate">{cliente.categoria || cliente.deporte || "-"}</p>
                      </div>

                      <div className="flex min-w-0 w-full flex-wrap items-center gap-1.5 sm:w-auto sm:min-w-[180px]">
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

                      <div className="min-w-0 w-full text-[11px] sm:w-auto sm:min-w-[120px]">
                        <p className="truncate text-slate-300">{meta.endDate || "Sin vencimiento"}</p>
                        <p className="truncate text-slate-400">{lastPayment ? `${lastPayment.moneda} ${lastPayment.importe.toLocaleString("es-AR")}` : "Sin pagos"}</p>
                      </div>

                      <div className="min-w-0 w-full sm:w-auto sm:min-w-[120px]">
                        {etiquetasCliente.length === 0 ? (
                          <span className="text-xs text-slate-500">Sin etiquetas</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {etiquetasCliente.slice(0, 2).map((tag) => (
                              <span
                                key={tag.id}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: tag.color || "#2196f3" }}
                                title={tag.texto}
                              >
                                {tag.texto}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex w-full flex-wrap items-center justify-start gap-1.5 sm:ml-auto sm:w-auto sm:shrink-0 sm:justify-end">
                        <Link
                          href={`/clientes?detalle=1&cliente=${encodeURIComponent(cliente.id)}&tab=datos`}
                          onClick={(event) => {
                            event.preventDefault();
                            openClientDetail(cliente.id, "datos");
                          }}
                          className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                          title="Ver"
                        >
                          👁
                        </Link>
                        <button type="button" onClick={() => openClientDetail(cliente.id, "notas")} className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10" title="Chat">💬</button>
                        <button type="button" onClick={() => openWhatsapp(cliente)} disabled={!getMeta(cliente).telefono} className="rounded-lg border border-emerald-300/40 bg-emerald-500/5 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-40" title="WhatsApp">🟢</button>
                        <button type="button" onClick={() => openClientDetail(cliente.id, "plan-entrenamiento")} className="rounded-lg border border-cyan-300/40 bg-cyan-500/5 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10" title="Asignar">📌</button>
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
                    <Link
                      href="/clientes"
                      onClick={() => {
                        setIsDetailMode(false);
                        setDetailClientId(null);
                        setDetailTabId(null);
                      }}
                      className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
                    >
                      Volver al listado
                    </Link>
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
                    <p className="text-xs text-slate-300">Ultima antropometria:</p>
                    <p className="font-bold text-white">{selectedMeta.lastCheck}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Proxima antropometria:</p>
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
                <div className="flex flex-wrap gap-2">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${activeTab === tab.id ? "border-cyan-300/70 bg-cyan-500/20 text-cyan-50" : "border-cyan-300/40 text-white hover:bg-cyan-500/10"}`}
                    >
                      {tab.label}
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
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-white">Cliente</h3>
                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-3">
                        <p className="text-sm font-bold text-cyan-100">Foto de perfil de la cuenta</p>
                        <p className="text-xs text-slate-300">
                          Se sincroniza con el perfil del cliente en todos sus dispositivos.
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="h-16 w-16 overflow-hidden rounded-full border border-white/20 bg-slate-900/70">
                            {accountSidebarImage ? (
                              <img
                                src={accountSidebarImage}
                                alt="Foto de perfil del cliente"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-slate-300">
                                Sin foto
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <input
                              ref={profileImageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleAccountSidebarImageFileChange}
                            />
                            <button
                              type="button"
                              onClick={() => profileImageInputRef.current?.click()}
                              disabled={
                                accountSidebarImageSaving ||
                                accountSidebarImageLoading ||
                                selectedClient.tipo !== "alumno"
                              }
                              className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10 disabled:opacity-50"
                            >
                              {accountSidebarImage ? "Cambiar foto" : "Subir foto"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void saveAccountSidebarImage(null);
                              }}
                              disabled={
                                accountSidebarImageSaving ||
                                accountSidebarImageLoading ||
                                !accountSidebarImage ||
                                selectedClient.tipo !== "alumno"
                              }
                              className="rounded-lg border border-rose-300/40 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/10 disabled:opacity-50"
                            >
                              Quitar foto
                            </button>
                          </div>
                        </div>

                        {accountSidebarImageLoading ? (
                          <p className="mt-2 text-[11px] text-slate-400">Cargando foto actual...</p>
                        ) : null}
                        {accountSidebarImageSaving ? (
                          <p className="mt-2 text-[11px] text-slate-400">Guardando foto...</p>
                        ) : null}
                        {selectedClient.tipo !== "alumno" ? (
                          <p className="mt-2 text-[11px] text-amber-200">
                            Esta accion aplica a clientes con cuenta de acceso (alumnos).
                          </p>
                        ) : null}
                        {accountSidebarImageError ? (
                          <p className="mt-2 text-[11px] text-rose-200">{accountSidebarImageError}</p>
                        ) : null}
                        {accountSidebarImageMessage ? (
                          <p className="mt-2 text-[11px] text-emerald-200">{accountSidebarImageMessage}</p>
                        ) : null}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <input value={datosDraft.nombre} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, nombre: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Nombre" />
                        <input value={selectedMeta.apellido} onChange={(e) => setMetaPatch(selectedClient.id, { apellido: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Apellido" />
                        <input value={selectedMeta.segundoApellido} onChange={(e) => setMetaPatch(selectedClient.id, { segundoApellido: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Segundo apellido" />
                        <input value={selectedMeta.email} onChange={(e) => setMetaPatch(selectedClient.id, { email: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Email" />
                        <input type="date" value={datosDraft.fechaNacimiento} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, fechaNacimiento: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
                        <input value={selectedMeta.telefono} onChange={(e) => setMetaPatch(selectedClient.id, { telefono: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Telefono" />
                        <input value={selectedMeta.codigoPais} onChange={(e) => setMetaPatch(selectedClient.id, { codigoPais: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Cod. telefono pais" />
                        <input value={selectedMeta.pais} onChange={(e) => setMetaPatch(selectedClient.id, { pais: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Pais" />
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
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <input value={datosDraft.peso} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, peso: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Peso" />
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
                      </div>

                      <div className="grid gap-3">
                        <input value={datosDraft.objetivo} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, objetivo: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Objetivo" />
                        <textarea value={datosDraft.observaciones} onChange={(e) => setDatosDraft((prev) => prev ? { ...prev, observaciones: e.target.value } : prev)} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" rows={2} placeholder="Observaciones" />
                      </div>

                      <div className="flex justify-end">
                        <button type="button" onClick={saveDatosGenerales} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300">Guardar cambios</button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {isAdmin ? (
                        <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-cyan-100">Usuarios y permisos</p>
                              <p className="text-xs text-slate-300">
                                Gestiona la cuenta de acceso del alumno desde Clientes. Si ya cambio su contrasena, primero blanqueala y luego consultala.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void runAccountPasswordAction("show");
                                }}
                                disabled={accountPasswordLoading || selectedClient.tipo !== "alumno"}
                                className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10 disabled:opacity-50"
                              >
                                Ver contrasena
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void runAccountPasswordAction("reset");
                                }}
                                disabled={accountPasswordLoading || selectedClient.tipo !== "alumno"}
                                className="rounded-lg border border-emerald-300/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-50"
                              >
                                Blanquear contrasena
                              </button>
                            </div>
                          </div>

                          {accountPasswordInfo ? (
                            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-slate-300">Contrasena actual</p>
                              <p className="mt-1 break-all font-mono text-sm font-bold text-white">{accountPasswordInfo.password}</p>
                              <p className="mt-1 text-[11px] text-slate-400">
                                {accountPasswordInfo.email || selectedMeta.email || selectedClient.nombre}
                                {accountPasswordInfo.issuedAt
                                  ? ` · ${new Date(accountPasswordInfo.issuedAt).toLocaleString("es-AR")}`
                                  : ""}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

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
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-xl font-bold">Plan entrenamiento</h3>
                      <Link href="/sesiones" className="rounded-lg border border-cyan-300/35 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10">Gestionar sesiones</Link>
                    </div>
                    {sesionesCliente.length === 0 ? (
                      <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">No hay sesiones vinculadas para este cliente todavia.</p>
                    ) : (
                      <div className="space-y-2">
                        {sesionesCliente.map((sesion) => (
                          <div key={sesion.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                            <p className="font-semibold text-white">{sesion.titulo}</p>
                            <p className="text-xs text-slate-300">{sesion.objetivo}</p>
                            <p className="mt-1 text-xs text-cyan-100">{sesion.duracion} min · {sesion.bloques.length} bloques</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : isPlanNutricionalTab ? (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white">Plan nutricional asignado</h3>
                    {selectedNutritionPlan ? (
                      <>
                        <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-emerald-100">Plan</p>
                              <p className="text-lg font-black text-white">{selectedNutritionPlan.nombre}</p>
                            </div>
                            <p className="text-xs text-slate-300">
                              Asignado: {new Date(selectedNutritionAssignment?.assignedAt || selectedNutritionPlan.updatedAt).toLocaleDateString("es-AR")}
                            </p>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-4">
                            <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-slate-300">Objetivo</p>
                              <p className="font-bold text-cyan-100">
                                {nutritionGoalLabel(selectedNutritionPlan.objetivo)}
                              </p>
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

                        <div className="space-y-3">
                          {selectedNutritionPlan.comidas.length === 0 ? (
                            <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                              El plan no tiene comidas cargadas todavia.
                            </p>
                          ) : (
                            selectedNutritionPlan.comidas.map((meal) => (
                              <div
                                key={meal.id}
                                className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
                              >
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
                              </div>
                            ))
                          )}
                        </div>

                        <div>
                          <p className="mb-2 text-sm text-slate-300">Notas adicionales del cliente</p>
                          <textarea
                            value={selectedMeta.tabNotas["plan-nutricional"] || ""}
                            onChange={(e) => updateTabNote("plan-nutricional", e.target.value)}
                            rows={5}
                            className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                            placeholder="Escribe aqui..."
                          />
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                        <p className="font-semibold">Este cliente aun no tiene un plan nutricional asignado.</p>
                        <p className="mt-1 text-amber-50/90">
                          Puedes asignarlo desde el modulo de nutricion para verlo automaticamente aqui.
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
                ) : activeTab === "antropometria" ? (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white">Antropometria</h3>
                    {selectedClient.tipo !== "alumno" ? (
                      <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                        Esta seccion aplica solo a alumnos.
                      </p>
                    ) : selectedAnthropometryRecords.length === 0 ? (
                      <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                        Todavia no hay medidas registradas para este alumno.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-300">
                            Registros: <span className="font-semibold text-white">{selectedAnthropometryRecords.length}</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={recalculateAnthropometryForSelected}
                                className="rounded-lg border border-emerald-300/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10"
                              >
                                Calcular IMC y grasa
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={downloadAnthropometryCsv}
                              className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
                            >
                              Descargar planilla CSV
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-5">
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                            <p className="text-xs text-slate-300">Ultimo registro</p>
                            <p className="text-sm font-semibold text-white">
                              {latestAnthropometry
                                ? new Date(latestAnthropometry.fecha).toLocaleDateString("es-AR")
                                : "-"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                            <p className="text-xs text-slate-300">Peso</p>
                            <p className="text-2xl font-black text-cyan-100">
                              {latestAnthropometry ? latestAnthropometry.peso : "-"}
                            </p>
                            <p className="text-xs text-slate-400">Delta: {formatDiff(anthropometryPesoDiff)} kg</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                            <p className="text-xs text-slate-300">% grasa</p>
                            <p className="text-2xl font-black text-emerald-100">
                              {latestAnthropometry ? latestAnthropometry.grasaCorporal : "-"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                            <p className="text-xs text-slate-300">Cintura</p>
                            <p className="text-2xl font-black text-violet-100">
                              {latestAnthropometry ? latestAnthropometry.cintura : "-"}
                            </p>
                            <p className="text-xs text-slate-400">Delta: {formatDiff(anthropometryCinturaDiff)} cm</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                            <p className="text-xs text-slate-300">IMC</p>
                            <p className="text-2xl font-black text-amber-100">
                              {latestImc ?? "-"}
                            </p>
                            <p className="text-xs text-slate-400">{imcCategory(latestImc)} · Delta: {formatDiff(imcDiff)}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                            Parametro IMC: {imcCategory(latestImc)}
                          </span>
                          <span className="rounded-full border border-violet-300/35 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-100">
                            Parametro grasa ({anthropometrySexo === "masculino" ? "hombre" : "mujer"}): {latestBodyFatCategory}
                          </span>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-3">
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-sm font-semibold text-white">Evolucion de peso</p>
                              <p className="text-[11px] text-slate-400">kg</p>
                            </div>
                            {anthropometryChartData.length < 2 ? (
                              <p className="text-xs text-slate-400">Se necesitan al menos 2 registros para graficar.</p>
                            ) : (
                              <svg viewBox="0 0 320 120" className="h-28 w-full">
                                <path d={pesoLinePath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                            )}
                          </div>

                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-sm font-semibold text-white">Evolucion de IMC</p>
                              <p className="text-[11px] text-slate-400">kg/m2</p>
                            </div>
                            {anthropometryChartData.filter((item) => item.imc !== null).length < 2 ? (
                              <p className="text-xs text-slate-400">Carga altura en datos del cliente para calcular IMC.</p>
                            ) : (
                              <svg viewBox="0 0 320 120" className="h-28 w-full">
                                <path d={imcLinePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                            )}
                          </div>

                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-sm font-semibold text-white">Evolucion de grasa estimada</p>
                              <p className="text-[11px] text-slate-400">%</p>
                            </div>
                            {anthropometryChartData.length < 2 ? (
                              <p className="text-xs text-slate-400">Se necesitan al menos 2 registros para graficar.</p>
                            ) : (
                              <svg viewBox="0 0 320 120" className="h-28 w-full">
                                <path d={grasaLinePath} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                            )}
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-white/10">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-300">
                              <tr>
                                <th className="px-3 py-2">Fecha</th>
                                <th className="px-3 py-2">Peso</th>
                                <th className="px-3 py-2">Grasa %</th>
                                <th className="px-3 py-2">Cintura</th>
                                <th className="px-3 py-2">Cadera</th>
                                <th className="px-3 py-2">Pecho</th>
                                <th className="px-3 py-2">Brazo</th>
                                <th className="px-3 py-2">Muslo</th>
                                <th className="px-3 py-2">IMC</th>
                                <th className="px-3 py-2">Parametro IMC</th>
                                <th className="px-3 py-2">Parametro grasa</th>
                                <th className="px-3 py-2">Comentario</th>
                                <th className="px-3 py-2">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {selectedAnthropometryRecords.map((record) => (
                                <tr key={`${record.id}-${record.updatedAt}`} className="bg-slate-950/40 text-slate-100">
                                  {anthropometryEditingId === record.id && anthropometryDraft ? (
                                    <>
                                      <td className="px-3 py-2"><input type="date" value={anthropometryDraft.fecha} onChange={(e) => setAnthropometryDraft((prev) => (prev ? { ...prev, fecha: e.target.value } : prev))} className="w-32 rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" /></td>
                                      <td className="px-3 py-2"><input type="number" min={0} step="0.1" value={anthropometryDraft.peso} onChange={(e) => setAnthropometryDraft((prev) => (prev ? { ...prev, peso: Number(e.target.value) } : prev))} className="w-20 rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" /></td>
                                      <td className="px-3 py-2"><input type="number" min={0} step="0.1" value={anthropometryDraft.grasaCorporal} onChange={(e) => setAnthropometryDraft((prev) => (prev ? { ...prev, grasaCorporal: Number(e.target.value) } : prev))} className="w-20 rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" /></td>
                                      <td className="px-3 py-2"><input type="number" min={0} step="0.1" value={anthropometryDraft.cintura} onChange={(e) => setAnthropometryDraft((prev) => (prev ? { ...prev, cintura: Number(e.target.value) } : prev))} className="w-20 rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" /></td>
                                      <td className="px-3 py-2"><input type="number" min={0} step="0.1" value={anthropometryDraft.cadera} onChange={(e) => setAnthropometryDraft((prev) => (prev ? { ...prev, cadera: Number(e.target.value) } : prev))} className="w-20 rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" /></td>
                                      <td className="px-3 py-2"><input type="number" min={0} step="0.1" value={anthropometryDraft.pecho} onChange={(e) => setAnthropometryDraft((prev) => (prev ? { ...prev, pecho: Number(e.target.value) } : prev))} className="w-20 rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" /></td>
                                      <td className="px-3 py-2"><input type="number" min={0} step="0.1" value={anthropometryDraft.brazo} onChange={(e) => setAnthropometryDraft((prev) => (prev ? { ...prev, brazo: Number(e.target.value) } : prev))} className="w-20 rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" /></td>
                                      <td className="px-3 py-2"><input type="number" min={0} step="0.1" value={anthropometryDraft.muslo} onChange={(e) => setAnthropometryDraft((prev) => (prev ? { ...prev, muslo: Number(e.target.value) } : prev))} className="w-20 rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" /></td>
                                      <td className="px-3 py-2 text-xs text-slate-300">{computeImc(anthropometryDraft.peso, selectedHeightMeters) ?? "-"}</td>
                                      <td className="px-3 py-2 text-xs text-slate-300">{imcCategory(computeImc(anthropometryDraft.peso, selectedHeightMeters))}</td>
                                      <td className="px-3 py-2 text-xs text-slate-300">{bodyFatCategory(anthropometryDraft.grasaCorporal, anthropometrySexo)}</td>
                                      <td className="px-3 py-2"><input value={anthropometryDraft.comentario} onChange={(e) => setAnthropometryDraft((prev) => (prev ? { ...prev, comentario: e.target.value } : prev))} className="w-48 rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs" /></td>
                                      <td className="px-3 py-2">
                                        <div className="flex gap-1">
                                          <button type="button" onClick={saveAnthropometryEdit} className="rounded border border-emerald-300/40 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/10">Guardar</button>
                                          <button type="button" onClick={cancelAnthropometryEdit} className="rounded border border-white/25 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/10">Cancelar</button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-3 py-2">{new Date(record.fecha).toLocaleDateString("es-AR")}</td>
                                      <td className="px-3 py-2">{record.peso}</td>
                                      <td className="px-3 py-2">{record.grasaCorporal}</td>
                                      <td className="px-3 py-2">{record.cintura}</td>
                                      <td className="px-3 py-2">{record.cadera}</td>
                                      <td className="px-3 py-2">{record.pecho}</td>
                                      <td className="px-3 py-2">{record.brazo}</td>
                                      <td className="px-3 py-2">{record.muslo}</td>
                                      <td className="px-3 py-2">{computeImc(record.peso, selectedHeightMeters) ?? "-"}</td>
                                      <td className="px-3 py-2">{imcCategory(computeImc(record.peso, selectedHeightMeters))}</td>
                                      <td className="px-3 py-2">{bodyFatCategory(record.grasaCorporal, anthropometrySexo)}</td>
                                      <td className="px-3 py-2 text-slate-300">{record.comentario || "-"}</td>
                                      <td className="px-3 py-2">
                                        {isAdmin ? (
                                          <div className="flex gap-1">
                                            <button type="button" onClick={() => startAnthropometryEdit(record)} className="rounded border border-cyan-300/40 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/10">Editar</button>
                                            <button type="button" onClick={() => deleteAnthropometryRecord(record)} className="rounded border border-rose-300/40 px-2 py-1 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/10">Borrar</button>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-slate-500">Solo lectura</span>
                                        )}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
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
                  <div>
                    <h3 className="mb-2 text-xl font-bold text-white">{TABS.find((item) => item.id === activeTab)?.label}</h3>
                    <p className="mb-3 text-sm text-slate-300">{tabPlaceholderCopy[activeTab] || "Apartado editable del cliente."}</p>
                    <textarea
                      value={selectedMeta.tabNotas[activeTab] || ""}
                      onChange={(e) => updateTabNote(activeTab, e.target.value)}
                      rows={7}
                      className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                      placeholder="Escribe aqui..."
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
