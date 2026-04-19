"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useEffect, useMemo, useState } from "react";

type AccessOption = {
  href: string;
  label: string;
  category: string;
};

type Colaborador = {
  id: string;
  email: string;
  role: "ADMIN" | "COLABORADOR" | "CLIENTE";
  estado?: string;
  nombreCompleto?: string;
  puedeEditarRegistros?: boolean;
  puedeEditarPlanes?: boolean;
  puedeVerTodosAlumnos?: boolean;
  permisosGranulares?: {
    accesos?: Record<string, boolean>;
    [key: string]: unknown;
  } | null;
  colaboraciones?: Array<{ alumnoId: string; puedeEditar?: boolean }>;
  asignaciones?: string[];
  edad?: number | null;
  fechaNacimiento?: string | null;
  altura?: number | null;
  telefono?: string | null;
  direccion?: string | null;
};

type ColaboradorDraft = {
  id: string;
  email: string;
  nombreCompleto: string;
  estado: string;
  puedeEditarRegistros: boolean;
  puedeEditarPlanes: boolean;
  puedeVerTodosAlumnos: boolean;
  accesos: Record<string, boolean>;
  permisosGranulares: Record<string, unknown>;
};

type SignupAnamnesis = {
  tratamientoMedico?: string;
  lesionesLimitaciones?: string;
  medicacionRegular?: string;
  cirugiasRecientes?: string;
  antecedentesClinicos?: string;
  autorizacionMedica?: string;
  experienciaEntrenamiento?: string;
  alimentacionActual?: string[];
  alimentacionDetalle?: string;
  desordenAlimentario?: string;
  consumoSustancias?: string;
  suplementos?: string;
  interesEntrenamiento?: string[];
  interesDetalle?: string;
  compromisoObjetivo?: number | null;
  origenContacto?: string[];
  origenDetalle?: string;
  consentimientoSalud?: string;
};

type SignupProfile = {
  nombre?: string;
  apellido?: string;
  nombreCompleto?: string;
  edad?: number | null;
  altura?: string;
  peso?: string;
  telefono?: string;
  fechaNacimiento?: string;
  club?: string;
  objetivo?: string;
  observaciones?: string;
  anamnesis?: SignupAnamnesis;
  updatedAt?: string;
};

type ClientePasswordAdmin = {
  visiblePassword: string;
  source: "register" | "admin_reset" | "account_change" | "password_reset";
  updatedAt: string;
  updatedByRole: string;
  updatedByEmail: string | null;
};

type ClienteUsuario = {
  id: string;
  email: string;
  role: "ADMIN" | "COLABORADOR" | "CLIENTE";
  estado?: string;
  emailVerified?: boolean;
  nombreCompleto?: string;
  edad?: number | null;
  fechaNacimiento?: string | null;
  altura?: number | null;
  telefono?: string | null;
  createdAt?: string | null;
  signupProfile?: SignupProfile | null;
  passwordAdmin?: ClientePasswordAdmin | null;
};

type AsignacionSeleccionada = {
  alumnoId: string;
  puedeEditar: boolean;
};

type ColaboradorDetailDraft = {
  id: string;
  email: string;
  nombreCompleto: string;
  edad: string;
  fechaNacimiento: string;
  altura: string;
  telefono: string;
  direccion: string;
  estado: string;
  puedeEditarRegistros: boolean;
  puedeEditarPlanes: boolean;
  puedeVerTodosAlumnos: boolean;
};

type ColaboradorCreateForm = {
  email: string;
  nombreCompleto: string;
  edad: string;
  fechaNacimiento: string;
  altura: string;
  telefono: string;
  direccion: string;
  puedeEditarRegistros: boolean;
  puedeEditarPlanes: boolean;
  puedeVerTodosAlumnos: boolean;
  asignaciones: string;
};

const ACCESS_OPTIONS: AccessOption[] = [
  { href: "/plantel", label: "Plantel", category: "Base" },
  { href: "/semana", label: "Templates", category: "Planificacion" },
  { href: "/sesiones", label: "Entrenamiento", category: "Planificacion" },
  { href: "/asistencias", label: "Asistencias", category: "Seguimiento" },
  { href: "/registros", label: "Registros", category: "Seguimiento" },
  { href: "/categorias", label: "Categorias", category: "Catalogos" },
  { href: "/deportes", label: "Deportes", category: "Catalogos" },
  { href: "/equipos", label: "Equipos", category: "Catalogos" },
  { href: "/clientes", label: "Clientes", category: "Clientes" },
  { href: "/clientes/musica", label: "Musica alumnos", category: "Clientes" },
];

const CATEGORY_ACCESS_HREFS = ["/categorias", "/deportes", "/equipos"];

const ALL_ACCESS_TRUE = ACCESS_OPTIONS.reduce<Record<string, boolean>>((acc, item) => {
  acc[item.href] = true;
  return acc;
}, {});

const INITIAL_CREATE_FORM: ColaboradorCreateForm = {
  email: "",
  nombreCompleto: "",
  edad: "",
  fechaNacimiento: "",
  altura: "",
  telefono: "",
  direccion: "",
  puedeEditarRegistros: false,
  puedeEditarPlanes: false,
  puedeVerTodosAlumnos: false,
  asignaciones: "",
};

function normalizeAccessMap(raw: unknown): Record<string, boolean> {
  const result = { ...ALL_ACCESS_TRUE };

  if (!raw || typeof raw !== "object") {
    return result;
  }

  const input = raw as Record<string, unknown>;
  for (const option of ACCESS_OPTIONS) {
    const maybe = input[option.href];
    if (typeof maybe === "boolean") {
      result[option.href] = maybe;
    }
  }

  return result;
}

function mapColaboradorToDraft(colab: Colaborador): ColaboradorDraft {
  const permisosGranulares =
    colab.permisosGranulares && typeof colab.permisosGranulares === "object"
      ? { ...colab.permisosGranulares }
      : {};

  const accesos = normalizeAccessMap(colab.permisosGranulares?.accesos);

  return {
    id: colab.id,
    email: colab.email,
    nombreCompleto: String(colab.nombreCompleto || "Sin nombre"),
    estado: String(colab.estado || "activo"),
    puedeEditarRegistros: Boolean(colab.puedeEditarRegistros),
    puedeEditarPlanes: Boolean(colab.puedeEditarPlanes),
    puedeVerTodosAlumnos: Boolean(colab.puedeVerTodosAlumnos),
    accesos,
    permisosGranulares,
  };
}

function toDateInputValue(value: unknown): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function mapColaboradorToDetailDraft(colab: Colaborador): ColaboradorDetailDraft {
  return {
    id: colab.id,
    email: String(colab.email || ""),
    nombreCompleto: String(colab.nombreCompleto || ""),
    edad: colab.edad == null ? "" : String(colab.edad),
    fechaNacimiento: toDateInputValue(colab.fechaNacimiento),
    altura: colab.altura == null ? "" : String(colab.altura),
    telefono: String(colab.telefono || ""),
    direccion: String(colab.direccion || ""),
    estado: String(colab.estado || "activo"),
    puedeEditarRegistros: Boolean(colab.puedeEditarRegistros),
    puedeEditarPlanes: Boolean(colab.puedeEditarPlanes),
    puedeVerTodosAlumnos: Boolean(colab.puedeVerTodosAlumnos),
  };
}

function splitName(fullName: string) {
  const normalized = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { nombre: '', apellido: '' };
  }

  const parts = normalized.split(' ');
  if (parts.length === 1) {
    return { nombre: parts[0], apellido: '' };
  }

  return {
    nombre: parts.slice(0, 1).join(' '),
    apellido: parts.slice(1).join(' '),
  };
}

function resolveIngresanteNombre(cliente: ClienteUsuario) {
  const fromProfileNombre = String(cliente.signupProfile?.nombre || '').trim();
  const fromProfileApellido = String(cliente.signupProfile?.apellido || '').trim();
  const fallbackNombreCompleto = String(
    cliente.signupProfile?.nombreCompleto || cliente.nombreCompleto || ''
  )
    .trim()
    .replace(/\s+/g, ' ');

  if (fromProfileNombre || fromProfileApellido) {
    return {
      nombre: fromProfileNombre,
      apellido: fromProfileApellido,
      nombreCompleto: `${fromProfileNombre} ${fromProfileApellido}`.trim(),
    };
  }

  const guessed = splitName(fallbackNombreCompleto);
  return {
    ...guessed,
    nombreCompleto: fallbackNombreCompleto,
  };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Sin dato';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin dato';
  return parsed.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolvePasswordSourceLabel(source: string | null | undefined) {
  const normalized = String(source || '').trim().toLowerCase();

  switch (normalized) {
    case 'register':
      return 'Registro';
    case 'admin_reset':
      return 'Blanqueo admin';
    case 'account_change':
      return 'Cambio en cuenta';
    case 'password_reset':
      return 'Recupero por mail';
    default:
      return 'Sin fuente';
  }
}

function formatListValue(raw: unknown) {
  if (!Array.isArray(raw)) {
    return 'Sin dato';
  }

  const value = raw
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(', ');

  return value || 'Sin dato';
}

function buildAnamnesisRows(anamnesis: SignupAnamnesis | null | undefined) {
  if (!anamnesis) {
    return [] as Array<{ pregunta: string; respuesta: string }>;
  }

  return [
    {
      pregunta: 'Tratamiento medico actual',
      respuesta: String(anamnesis.tratamientoMedico || 'Sin dato'),
    },
    {
      pregunta: 'Lesion, dolor o limitacion fisica',
      respuesta: String(anamnesis.lesionesLimitaciones || 'Sin dato'),
    },
    {
      pregunta: 'Medicacion regular',
      respuesta: String(anamnesis.medicacionRegular || 'Sin dato'),
    },
    {
      pregunta: 'Cirugias en ultimos 2 anos',
      respuesta: String(anamnesis.cirugiasRecientes || 'Sin dato'),
    },
    {
      pregunta: 'Antecedentes clinicos',
      respuesta: String(anamnesis.antecedentesClinicos || 'Sin dato'),
    },
    {
      pregunta: 'Autorizacion medica',
      respuesta: String(anamnesis.autorizacionMedica || 'Sin dato'),
    },
    {
      pregunta: 'Experiencia entrenando',
      respuesta: String(anamnesis.experienciaEntrenamiento || 'Sin dato'),
    },
    {
      pregunta: 'Alimentacion actual',
      respuesta: formatListValue(anamnesis.alimentacionActual),
    },
    {
      pregunta: 'Detalle de alimentacion',
      respuesta: String(anamnesis.alimentacionDetalle || 'Sin dato'),
    },
    {
      pregunta: 'Desorden alimentario',
      respuesta: String(anamnesis.desordenAlimentario || 'Sin dato'),
    },
    {
      pregunta: 'Consumo de sustancias',
      respuesta: String(anamnesis.consumoSustancias || 'Sin dato'),
    },
    {
      pregunta: 'Suplementos',
      respuesta: String(anamnesis.suplementos || 'Sin dato'),
    },
    {
      pregunta: 'Interes de entrenamiento',
      respuesta: formatListValue(anamnesis.interesEntrenamiento),
    },
    {
      pregunta: 'Detalle del interes',
      respuesta: String(anamnesis.interesDetalle || 'Sin dato'),
    },
    {
      pregunta: 'Compromiso (1-10)',
      respuesta:
        Number.isFinite(Number(anamnesis.compromisoObjetivo))
          ? String(anamnesis.compromisoObjetivo)
          : 'Sin dato',
    },
    {
      pregunta: 'Origen del contacto',
      respuesta: formatListValue(anamnesis.origenContacto),
    },
    {
      pregunta: 'Detalle del origen',
      respuesta: String(anamnesis.origenDetalle || 'Sin dato'),
    },
    {
      pregunta: 'Declaracion de aptitud',
      respuesta:
        String(anamnesis.consentimientoSalud || '').trim().toLowerCase() === 'si'
          ? 'Aceptada'
          : 'No aceptada',
    },
  ];
}

export default function AdminUsuariosPermisosPage() {
  const [items, setItems] = useState<ColaboradorDraft[]>([]);
  const [clientes, setClientes] = useState<ClienteUsuario[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [showColaboradoresPanel, setShowColaboradoresPanel] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<ColaboradorCreateForm>(INITIAL_CREATE_FORM);
  const [createLoading, setCreateLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [expandedColaboradorId, setExpandedColaboradorId] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailSavingId, setDetailSavingId] = useState<string | null>(null);
  const [assignSavingId, setAssignSavingId] = useState<string | null>(null);
  const [detailActionLoadingId, setDetailActionLoadingId] = useState<string | null>(null);
  const [clientActionLoadingId, setClientActionLoadingId] = useState<string | null>(null);
  const [clientPasswordActionLoadingId, setClientPasswordActionLoadingId] = useState<string | null>(null);
  const [clientPasswordSearch, setClientPasswordSearch] = useState("");
  const [clientCustomPasswordById, setClientCustomPasswordById] = useState<Record<string, string>>({});
  const [ingresanteModalId, setIngresanteModalId] = useState<string | null>(null);
  const [confirmAltaId, setConfirmAltaId] = useState<string | null>(null);

  const [detailDraftById, setDetailDraftById] = useState<Record<string, ColaboradorDetailDraft>>({});
  const [detailAsignacionesById, setDetailAsignacionesById] = useState<Record<string, AsignacionSeleccionada[]>>({});
  const [detailHistorialById, setDetailHistorialById] = useState<Record<string, Array<{ value?: { accion?: string; fecha?: string } }>>>({});
  const [detailClientSearchById, setDetailClientSearchById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const panel = new URLSearchParams(window.location.search).get("panel");
    if (panel === "colaboradores") {
      setShowColaboradoresPanel(true);
    }
  }, []);

  const loadColaboradores = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/colaboradores", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar colaboradores");
      }

      const colaboradores = Array.isArray(data?.colaboradores) ? data.colaboradores : [];
      const onlyColaboradores = colaboradores.filter((c: Colaborador) => c.role === "COLABORADOR");
      setItems(onlyColaboradores.map(mapColaboradorToDraft));
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al cargar colaboradores" });
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setClientes(list.filter((user: ClienteUsuario) => user.role === "CLIENTE"));
    } catch {
      setClientes([]);
    }
  };

  useEffect(() => {
    void loadColaboradores();
    void loadClientes();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadClientes();
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter(
      (item) => item.nombreCompleto.toLowerCase().includes(q) || item.email.toLowerCase().includes(q)
    );
  }, [items, search]);

  const colaboradoresStats = useMemo(() => {
    const total = items.length;
    const activos = items.filter((item) => item.estado !== "suspendido").length;
    const suspendidos = total - activos;
    return { total, activos, suspendidos };
  }, [items]);

  const clientesPendientesAlta = useMemo(
    () =>
      clientes.filter(
        (cliente) =>
          cliente.role === "CLIENTE" &&
          cliente.emailVerified === true &&
          String(cliente.estado || "activo").trim().toLowerCase() !== "activo"
      ),
    [clientes]
  );

  const clientesSinVerificar = useMemo(
    () => clientes.filter((cliente) => cliente.role === "CLIENTE" && cliente.emailVerified !== true),
    [clientes]
  );

  const clientesSoportePassword = useMemo(
    () =>
      clientes.filter((cliente) => {
        if (cliente.role !== 'CLIENTE') return false;

        const query = clientPasswordSearch.trim().toLowerCase();
        if (!query) return true;

        const nombre = String(resolveIngresanteNombre(cliente).nombreCompleto || '').toLowerCase();
        const email = String(cliente.email || '').toLowerCase();
        return nombre.includes(query) || email.includes(query);
      }),
    [clientes, clientPasswordSearch]
  );

  const ingresanteModal = useMemo(
    () => clientesPendientesAlta.find((cliente) => cliente.id === ingresanteModalId) || null,
    [clientesPendientesAlta, ingresanteModalId]
  );

  const confirmAltaCliente = useMemo(
    () => clientesPendientesAlta.find((cliente) => cliente.id === confirmAltaId) || null,
    [clientesPendientesAlta, confirmAltaId]
  );

  const updateItem = (id: string, updater: (prev: ColaboradorDraft) => ColaboradorDraft) => {
    setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const setAllAccess = (id: string, value: boolean) => {
    updateItem(id, (item) => {
      const next = { ...item.accesos };
      for (const option of ACCESS_OPTIONS) {
        next[option.href] = value;
      }
      return { ...item, accesos: next };
    });
  };

  const saveItem = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;

    const allCategoryAccessBlocked = CATEGORY_ACCESS_HREFS.every((href) => current.accesos[href] === false);

    if (allCategoryAccessBlocked) {
      setMessage({
        type: "error",
        text: "Debes dejar habilitada al menos una categoria (Categorias, Deportes o Equipos).",
      });
      return;
    }

    try {
      setSavingId(id);
      setMessage(null);

      const payload = {
        puedeEditarRegistros: current.puedeEditarRegistros,
        puedeEditarPlanes: current.puedeEditarPlanes,
        puedeVerTodosAlumnos: current.puedeVerTodosAlumnos,
        permisosGranulares: {
          ...current.permisosGranulares,
          accesos: current.accesos,
        },
      };

      const res = await fetch(`/api/admin/colaboradores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudieron guardar los permisos");
      }

      const updated = mapColaboradorToDraft(data.colaborador as Colaborador);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setMessage({ type: "success", text: `Permisos actualizados: ${updated.nombreCompleto}` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al guardar" });
    } finally {
      setSavingId(null);
    }
  };

  const createColaborador = async () => {
    if (!createForm.email.trim() || !createForm.nombreCompleto.trim()) {
      setMessage({ type: "error", text: "Email y nombre completo son requeridos" });
      return;
    }

    try {
      setCreateLoading(true);
      setMessage(null);

      const payload = {
        email: createForm.email.trim().toLowerCase(),
        nombreCompleto: createForm.nombreCompleto.trim(),
        edad: Number(createForm.edad || 0),
        fechaNacimiento: createForm.fechaNacimiento || null,
        altura: Number(createForm.altura || 0),
        telefono: createForm.telefono.trim(),
        direccion: createForm.direccion.trim(),
        puedeEditarRegistros: createForm.puedeEditarRegistros,
        puedeEditarPlanes: createForm.puedeEditarPlanes,
        puedeVerTodosAlumnos: createForm.puedeVerTodosAlumnos,
        asignaciones: createForm.asignaciones
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      };

      const response = await fetch("/api/admin/colaboradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo crear el colaborador");
      }

      setMessage({ type: "success", text: "Colaborador creado y credenciales enviadas" });
      setCreateForm(INITIAL_CREATE_FORM);
      setShowCreateForm(false);
      await loadColaboradores();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al crear colaborador" });
    } finally {
      setCreateLoading(false);
    }
  };

  const buildClienteFichaHref = (cliente: ClienteUsuario) => {
    const nombre = String(cliente.nombreCompleto || "").trim();
    if (!nombre) {
      return "/clientes";
    }

    return `/clientes/ficha/${encodeURIComponent(`alumno:${nombre}`)}/datos`;
  };

  const darAltaCliente = async (cliente: ClienteUsuario): Promise<boolean> => {
    try {
      setClientActionLoadingId(cliente.id);
      setMessage(null);

      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: cliente.id,
          role: "CLIENTE",
          estado: "activo",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "No se pudo dar de alta al cliente");
      }

      setMessage({
        type: "success",
        text: `Alta aplicada: ${String(resolveIngresanteNombre(cliente).nombreCompleto || cliente.email)}`,
      });

      await loadClientes();
      setConfirmAltaId(null);
      setIngresanteModalId((prev) => (prev === cliente.id ? null : prev));
      return true;
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Error al dar de alta al cliente",
      });
      return false;
    } finally {
      setClientActionLoadingId(null);
    }
  };

  const abrirIngresante = (clienteId: string) => {
    setIngresanteModalId(clienteId);
    setConfirmAltaId(null);
  };

  const abrirConfirmacionAlta = (clienteId: string) => {
    setIngresanteModalId(clienteId);
    setConfirmAltaId(clienteId);
  };

  const confirmarAltaIngresante = async () => {
    if (!confirmAltaCliente) {
      return;
    }

    await darAltaCliente(confirmAltaCliente);
  };

  const blanquearContrasenaCliente = async (cliente: ClienteUsuario, customMode: boolean) => {
    const customPassword = String(clientCustomPasswordById[cliente.id] || '').trim();

    if (customMode && customPassword.length < 6) {
      setMessage({
        type: 'error',
        text: 'La contrasena personalizada debe tener al menos 6 caracteres.',
      });
      return;
    }

    try {
      setClientPasswordActionLoadingId(cliente.id);
      setMessage(null);

      const response = await fetch('/api/admin/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: cliente.id,
          password: customMode ? customPassword : undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        visiblePassword?: string;
      };

      if (!response.ok) {
        throw new Error(String(data.message || 'No se pudo blanquear la contrasena del cliente'));
      }

      setMessage({
        type: 'success',
        text: `Contrasena blanqueada para ${cliente.email}: ${String(data.visiblePassword || '')}`,
      });

      setClientCustomPasswordById((prev) => ({ ...prev, [cliente.id]: '' }));
      await loadClientes();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo blanquear la contrasena del cliente',
      });
    } finally {
      setClientPasswordActionLoadingId(null);
    }
  };

  const loadColaboradorDetail = async (id: string) => {
    try {
      setDetailLoadingId(id);

      const response = await fetch(`/api/admin/colaboradores/${id}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data?.colaborador) {
        throw new Error(data?.error || "No se pudo cargar el detalle del colaborador");
      }

      const colaborador = data.colaborador as Colaborador;
      setDetailDraftById((prev) => ({ ...prev, [id]: mapColaboradorToDetailDraft(colaborador) }));

      const fromColaboraciones = Array.isArray(colaborador.colaboraciones)
        ? colaborador.colaboraciones
            .map((item) => ({
              alumnoId: String(item.alumnoId || "").trim(),
              puedeEditar: Boolean(item.puedeEditar),
            }))
            .filter((item) => item.alumnoId.length > 0)
        : [];

      const fromAsignaciones = Array.isArray(colaborador.asignaciones)
        ? colaborador.asignaciones
            .map((alumnoId) => ({ alumnoId: String(alumnoId || "").trim(), puedeEditar: true }))
            .filter((item) => item.alumnoId.length > 0)
        : [];

      setDetailAsignacionesById((prev) => ({
        ...prev,
        [id]: fromColaboraciones.length > 0 ? fromColaboraciones : fromAsignaciones,
      }));

      setDetailHistorialById((prev) => ({
        ...prev,
        [id]: Array.isArray(data.historial) ? data.historial : [],
      }));
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al cargar detalle" });
    } finally {
      setDetailLoadingId(null);
    }
  };

  const openDetailPanel = async (id: string) => {
    if (expandedColaboradorId === id) {
      setExpandedColaboradorId(null);
      return;
    }

    setExpandedColaboradorId(id);
    await loadColaboradorDetail(id);
  };

  const updateDetailDraft = (id: string, patch: Partial<ColaboradorDetailDraft>) => {
    setDetailDraftById((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, ...patch } };
    });
  };

  const saveDetail = async (id: string) => {
    const draft = detailDraftById[id];
    if (!draft) return;

    try {
      setDetailSavingId(id);
      setMessage(null);

      const payload = {
        email: draft.email.trim().toLowerCase(),
        nombreCompleto: draft.nombreCompleto.trim(),
        edad: Number(draft.edad || 0),
        fechaNacimiento: draft.fechaNacimiento || null,
        altura: Number(draft.altura || 0),
        telefono: draft.telefono.trim(),
        direccion: draft.direccion.trim(),
        estado: draft.estado,
        puedeEditarRegistros: draft.puedeEditarRegistros,
        puedeEditarPlanes: draft.puedeEditarPlanes,
        puedeVerTodosAlumnos: draft.puedeVerTodosAlumnos,
      };

      const response = await fetch(`/api/admin/colaboradores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No se pudieron guardar los datos");
      }

      setMessage({ type: "success", text: "Datos del colaborador actualizados" });
      await loadColaboradores();
      await loadColaboradorDetail(id);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al guardar datos" });
    } finally {
      setDetailSavingId(null);
    }
  };

  const setAsignaciones = (id: string, updater: (prev: AsignacionSeleccionada[]) => AsignacionSeleccionada[]) => {
    setDetailAsignacionesById((prev) => ({
      ...prev,
      [id]: updater(prev[id] || []),
    }));
  };

  const toggleAlumnoAsignado = (colaboradorId: string, alumnoId: string, checked: boolean) => {
    setAsignaciones(colaboradorId, (prev) => {
      if (checked) {
        if (prev.some((item) => item.alumnoId === alumnoId)) {
          return prev;
        }
        return [...prev, { alumnoId, puedeEditar: true }];
      }
      return prev.filter((item) => item.alumnoId !== alumnoId);
    });
  };

  const togglePuedeEditarAsignado = (colaboradorId: string, alumnoId: string, checked: boolean) => {
    setAsignaciones(colaboradorId, (prev) =>
      prev.map((item) => (item.alumnoId === alumnoId ? { ...item, puedeEditar: checked } : item))
    );
  };

  const saveAsignaciones = async (id: string) => {
    try {
      setAssignSavingId(id);
      setMessage(null);

      const asignaciones = detailAsignacionesById[id] || [];
      const response = await fetch(`/api/admin/colaboradores/${id}/asignaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asignaciones }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No se pudieron actualizar asignaciones");
      }

      setMessage({ type: "success", text: "Asignaciones actualizadas" });
      await loadColaboradorDetail(id);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al guardar asignaciones" });
    } finally {
      setAssignSavingId(null);
    }
  };

  const sendVerification = async (id: string) => {
    try {
      setDetailActionLoadingId(id);
      setMessage(null);

      const response = await fetch(`/api/admin/colaboradores/${id}/alta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo enviar el mail de verificacion");
      }

      setMessage({ type: "success", text: "Verificacion enviada" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al enviar verificacion" });
    } finally {
      setDetailActionLoadingId(null);
    }
  };

  const toggleEstadoColaborador = async (id: string) => {
    const currentDetail = detailDraftById[id];
    const currentItem = items.find((item) => item.id === id);
    const estado = currentDetail?.estado || currentItem?.estado || "activo";

    try {
      setDetailActionLoadingId(id);
      setMessage(null);

      if (estado === "suspendido") {
        const response = await fetch(`/api/admin/colaboradores/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: "activo" }),
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "No se pudo reactivar el colaborador");
        }

        setMessage({ type: "success", text: "Colaborador reactivado" });
      } else {
        const response = await fetch(`/api/admin/colaboradores/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "No se pudo suspender el colaborador");
        }

        setMessage({ type: "success", text: "Colaborador suspendido" });
      }

      await loadColaboradores();
      await loadColaboradorDetail(id);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al actualizar estado" });
    } finally {
      setDetailActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/40 border-t-cyan-300" />
          <p className="mt-4 text-sm text-slate-300">Cargando permisos de colaboradores...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Usuarios y permisos</h1>
          <p className="mt-1 text-sm text-slate-300">
            Gestion centralizada de usuarios colaboradores, permisos y accesos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ReliableActionButton
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:from-emerald-300 hover:to-cyan-300"
          >
            {showCreateForm ? "Cerrar alta" : "+ Nuevo colaborador"}
          </ReliableActionButton>
          <ReliableActionButton
            type="button"
            onClick={() => setShowColaboradoresPanel((prev) => !prev)}
            className="rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/25"
          >
            {showColaboradoresPanel ? "Ocultar colaboradores" : "Ver colaboradores"}
          </ReliableActionButton>
        </div>
      </div>

      {showCreateForm ? (
        <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-black text-white">Alta de colaborador</h2>
          <p className="mt-1 text-xs text-slate-300">Se crea la cuenta y se envia credencial por mail.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                type="email"
                className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                placeholder="email@dominio.com"
              />
            </Field>
            <Field label="Nombre completo">
              <input
                value={createForm.nombreCompleto}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, nombreCompleto: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                placeholder="Nombre y apellido"
              />
            </Field>
            <Field label="Edad">
              <input
                value={createForm.edad}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, edad: e.target.value }))}
                type="number"
                className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
              />
            </Field>
            <Field label="Fecha de nacimiento">
              <input
                value={createForm.fechaNacimiento}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, fechaNacimiento: e.target.value }))}
                type="date"
                className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
              />
            </Field>
            <Field label="Altura (cm)">
              <input
                value={createForm.altura}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, altura: e.target.value }))}
                type="number"
                step="0.01"
                className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
              />
            </Field>
            <Field label="Telefono">
              <input
                value={createForm.telefono}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, telefono: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
              />
            </Field>
          </div>

          <div className="mt-3 grid gap-3">
            <Field label="Direccion">
              <input
                value={createForm.direccion}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, direccion: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
              />
            </Field>
            <Field label="IDs de alumnos asignados (coma)">
              <input
                value={createForm.asignaciones}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, asignaciones: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                placeholder="id1, id2"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <ToggleChip
              label="Puede editar registros"
              checked={createForm.puedeEditarRegistros}
              onToggle={(checked) => setCreateForm((prev) => ({ ...prev, puedeEditarRegistros: checked }))}
            />
            <ToggleChip
              label="Puede editar planes"
              checked={createForm.puedeEditarPlanes}
              onToggle={(checked) => setCreateForm((prev) => ({ ...prev, puedeEditarPlanes: checked }))}
            />
            <ToggleChip
              label="Puede ver todos los alumnos"
              checked={createForm.puedeVerTodosAlumnos}
              onToggle={(checked) => setCreateForm((prev) => ({ ...prev, puedeVerTodosAlumnos: checked }))}
            />
          </div>

          <div className="mt-4">
            <ReliableActionButton
              type="button"
              onClick={() => void createColaborador()}
              disabled={createLoading}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:from-emerald-300 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createLoading ? "Creando..." : "Crear colaborador"}
            </ReliableActionButton>
          </div>
        </section>
      ) : null}

      <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/75 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Total colaboradores</p>
            <p className="mt-1 text-2xl font-black text-white">{colaboradoresStats.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Activos</p>
            <p className="mt-1 text-2xl font-black text-emerald-100">{colaboradoresStats.activos}</p>
          </div>
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-200">Suspendidos</p>
            <p className="mt-1 text-2xl font-black text-rose-100">{colaboradoresStats.suspendidos}</p>
          </div>
        </div>

        <div className="mb-4 overflow-hidden rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),rgba(15,23,42,0.96)_52%,rgba(2,6,23,0.96)_100%)] p-4 shadow-[0_18px_50px_rgba(8,17,35,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-100/80">Onboarding</p>
              <p className="text-lg font-black text-white">Nuevo ingresante</p>
              <p className="text-xs text-slate-300">
                Revisa la ficha inicial, valida anamnesis y aplica Dar de Alta.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200/30 bg-cyan-500/15 px-3 py-2 text-right text-xs text-cyan-100">
              <p>Pendientes: {clientesPendientesAlta.length}</p>
              <p>Sin verificar: {clientesSinVerificar.length}</p>
            </div>
          </div>

          {clientesPendientesAlta.length === 0 ? (
            <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-300">
              No hay nuevos ingresantes pendientes de alta.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {clientesPendientesAlta.map((cliente) => {
                const nombre = resolveIngresanteNombre(cliente);
                return (
                  <article
                    key={`cliente-pendiente-${cliente.id}`}
                    className="rounded-xl border border-cyan-200/20 bg-slate-900/70 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/80">Nuevo ingresante</p>
                        <p className="text-sm font-black text-white">{nombre.nombreCompleto || 'Sin nombre'}</p>
                        <p className="text-xs text-slate-300">{cliente.email}</p>
                      </div>
                      <span className="rounded-full border border-amber-200/40 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-100">
                        Pendiente
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-[11px] text-slate-300 sm:grid-cols-2">
                      <p>Telefono: {String(cliente.signupProfile?.telefono || cliente.telefono || 'Sin dato')}</p>
                      <p>Nacimiento: {String(cliente.signupProfile?.fechaNacimiento || cliente.fechaNacimiento || 'Sin dato')}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <ReliableActionButton
                        type="button"
                        onClick={() => abrirIngresante(cliente.id)}
                        className="rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25"
                      >
                        Nuevo ingresante
                      </ReliableActionButton>

                      <ReliableActionButton
                        type="button"
                        onClick={() => abrirConfirmacionAlta(cliente.id)}
                        disabled={clientActionLoadingId === cliente.id}
                        className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {clientActionLoadingId === cliente.id ? 'Dando alta...' : 'Dar de Alta'}
                      </ReliableActionButton>

                      <a
                        href={buildClienteFichaHref(cliente)}
                        className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
                      >
                        Ver ficha en Clientes
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 shadow-[0_14px_40px_rgba(120,53,15,0.35)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100/85">Soporte claves</p>
              <p className="text-lg font-black text-white">Contrasenas de clientes</p>
              <p className="text-xs text-amber-100/90">
                Puedes blanquear una clave y ver la ultima clave registrada para soporte al cliente.
              </p>
            </div>

            <div className="w-full max-w-sm">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-100/85">
                Buscar cliente
              </label>
              <input
                value={clientPasswordSearch}
                onChange={(e) => setClientPasswordSearch(e.target.value)}
                placeholder="Nombre o email"
                className="w-full rounded-xl border border-amber-200/30 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/60"
              />
            </div>
          </div>

          <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/50 p-3">
            {clientesSoportePassword.length === 0 ? (
              <p className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
                No hay clientes para mostrar en soporte de contrasenas.
              </p>
            ) : (
              clientesSoportePassword.map((cliente) => {
                const nombre = resolveIngresanteNombre(cliente).nombreCompleto || cliente.nombreCompleto || 'Sin nombre';
                const snapshot = cliente.passwordAdmin;
                return (
                  <article
                    key={`cliente-password-${cliente.id}`}
                    className="rounded-xl border border-white/10 bg-slate-900/75 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-white">{String(nombre)}</p>
                        <p className="text-xs text-slate-300">{cliente.email}</p>
                      </div>
                      <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-100">
                        {String(cliente.estado || 'activo')}
                      </span>
                    </div>

                    <div className="mt-2 grid gap-2 text-xs text-slate-200 sm:grid-cols-2 lg:grid-cols-4">
                      <p>
                        <span className="text-slate-400">Clave visible:</span>{' '}
                        <span className="font-mono font-bold text-amber-100">
                          {snapshot?.visiblePassword || 'Sin registro'}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-400">Fuente:</span> {resolvePasswordSourceLabel(snapshot?.source)}
                      </p>
                      <p>
                        <span className="text-slate-400">Actualizado:</span> {formatDateTime(snapshot?.updatedAt || null)}
                      </p>
                      <p>
                        <span className="text-slate-400">Por:</span>{' '}
                        {snapshot?.updatedByEmail || snapshot?.updatedByRole || 'Sin dato'}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ReliableActionButton
                        type="button"
                        onClick={() => void blanquearContrasenaCliente(cliente, false)}
                        disabled={clientPasswordActionLoadingId === cliente.id}
                        className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {clientPasswordActionLoadingId === cliente.id ? 'Procesando...' : 'Blanquear automatica'}
                      </ReliableActionButton>

                      <input
                        value={clientCustomPasswordById[cliente.id] || ''}
                        onChange={(e) =>
                          setClientCustomPasswordById((prev) => ({
                            ...prev,
                            [cliente.id]: e.target.value,
                          }))
                        }
                        placeholder="Contrasena personalizada"
                        className="min-w-[220px] flex-1 rounded-lg border border-white/20 bg-slate-800 px-3 py-1.5 text-xs text-white outline-none focus:border-amber-200/65"
                      />

                      <ReliableActionButton
                        type="button"
                        onClick={() => void blanquearContrasenaCliente(cliente, true)}
                        disabled={clientPasswordActionLoadingId === cliente.id}
                        className="rounded-lg border border-amber-300/45 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Aplicar clave
                      </ReliableActionButton>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        {showColaboradoresPanel ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-100">Ver colaboradores</p>
            {items.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-300">
                Aun no hay colaboradores creados.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const detailDraft = detailDraftById[item.id];
                  const detailAsignaciones = detailAsignacionesById[item.id] || [];
                  const detailHistorial = detailHistorialById[item.id] || [];
                  const detailSearch = detailClientSearchById[item.id] || "";
                  const asignacionesSet = new Set(detailAsignaciones.map((asignacion) => asignacion.alumnoId));
                  const clientesFiltrados = clientes.filter((cliente) =>
                    detailSearch.trim()
                      ? cliente.email.toLowerCase().includes(detailSearch.trim().toLowerCase())
                      : true
                  );

                  return (
                    <div key={`panel-${item.id}`} className="rounded-xl border border-white/10 bg-slate-900/75 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-white">{item.nombreCompleto}</p>
                          <p className="text-xs text-slate-300">{item.email}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                            item.estado === "suspendido"
                              ? "bg-rose-500/20 text-rose-200"
                              : "bg-emerald-500/20 text-emerald-200"
                          }`}
                        >
                          {item.estado === "suspendido" ? "Suspendido" : "Activo"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <ReliableActionButton
                          type="button"
                          onClick={() => {
                            void openDetailPanel(item.id);
                          }}
                          className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/20"
                        >
                          {expandedColaboradorId === item.id ? "Cerrar panel completo" : "Gestionar completo"}
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={() => {
                            setShowColaboradoresPanel(false);
                            document
                              .getElementById(`permisos-${item.id}`)
                              ?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-100 transition hover:bg-white/10"
                        >
                          Ir a permisos rapidos
                        </ReliableActionButton>
                      </div>

                      {expandedColaboradorId === item.id ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                          {detailLoadingId === item.id || !detailDraft ? (
                            <p className="text-sm text-slate-300">Cargando detalle...</p>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-black text-white">Panel completo de colaborador</p>
                                <p className="text-xs text-slate-300">Incluye datos, estado, asignaciones y acciones.</p>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Email">
                                  <input
                                    value={detailDraft.email}
                                    onChange={(e) => updateDetailDraft(item.id, { email: e.target.value })}
                                    className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                                  />
                                </Field>
                                <Field label="Nombre completo">
                                  <input
                                    value={detailDraft.nombreCompleto}
                                    onChange={(e) => updateDetailDraft(item.id, { nombreCompleto: e.target.value })}
                                    className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                                  />
                                </Field>
                                <Field label="Edad">
                                  <input
                                    value={detailDraft.edad}
                                    onChange={(e) => updateDetailDraft(item.id, { edad: e.target.value })}
                                    type="number"
                                    className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                                  />
                                </Field>
                                <Field label="Fecha de nacimiento">
                                  <input
                                    value={detailDraft.fechaNacimiento}
                                    onChange={(e) => updateDetailDraft(item.id, { fechaNacimiento: e.target.value })}
                                    type="date"
                                    className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                                  />
                                </Field>
                                <Field label="Altura (cm)">
                                  <input
                                    value={detailDraft.altura}
                                    onChange={(e) => updateDetailDraft(item.id, { altura: e.target.value })}
                                    type="number"
                                    step="0.01"
                                    className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                                  />
                                </Field>
                                <Field label="Telefono">
                                  <input
                                    value={detailDraft.telefono}
                                    onChange={(e) => updateDetailDraft(item.id, { telefono: e.target.value })}
                                    className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                                  />
                                </Field>
                              </div>

                              <Field label="Direccion">
                                <input
                                  value={detailDraft.direccion}
                                  onChange={(e) => updateDetailDraft(item.id, { direccion: e.target.value })}
                                  className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                                />
                              </Field>

                              <div className="grid gap-2 sm:grid-cols-3">
                                <ToggleChip
                                  label="Puede editar registros"
                                  checked={detailDraft.puedeEditarRegistros}
                                  onToggle={(checked) => updateDetailDraft(item.id, { puedeEditarRegistros: checked })}
                                />
                                <ToggleChip
                                  label="Puede editar planes"
                                  checked={detailDraft.puedeEditarPlanes}
                                  onToggle={(checked) => updateDetailDraft(item.id, { puedeEditarPlanes: checked })}
                                />
                                <ToggleChip
                                  label="Puede ver todos los alumnos"
                                  checked={detailDraft.puedeVerTodosAlumnos}
                                  onToggle={(checked) => updateDetailDraft(item.id, { puedeVerTodosAlumnos: checked })}
                                />
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <ReliableActionButton
                                  type="button"
                                  onClick={() => void saveDetail(item.id)}
                                  disabled={detailSavingId === item.id}
                                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {detailSavingId === item.id ? "Guardando..." : "Guardar datos"}
                                </ReliableActionButton>
                                <ReliableActionButton
                                  type="button"
                                  onClick={() => void sendVerification(item.id)}
                                  disabled={detailActionLoadingId === item.id}
                                  className="rounded-xl border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Enviar verificacion
                                </ReliableActionButton>
                                <ReliableActionButton
                                  type="button"
                                  onClick={() => void toggleEstadoColaborador(item.id)}
                                  disabled={detailActionLoadingId === item.id}
                                  className={`rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    detailDraft.estado === "suspendido"
                                      ? "border border-emerald-300/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                                      : "border border-rose-300/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                                  }`}
                                >
                                  {detailDraft.estado === "suspendido" ? "Reactivar" : "Dar de baja"}
                                </ReliableActionButton>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                                <p className="text-sm font-black text-white">Asignaciones</p>
                                <p className="mt-1 text-xs text-slate-300">Selecciona clientes y define si puede editar.</p>

                                <input
                                  value={detailSearch}
                                  onChange={(e) =>
                                    setDetailClientSearchById((prev) => ({ ...prev, [item.id]: e.target.value }))
                                  }
                                  placeholder="Buscar cliente por email"
                                  className="mt-3 w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                                />

                                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/40 p-3">
                                  {clientesFiltrados.length === 0 ? (
                                    <p className="text-sm text-slate-300">No hay clientes para asignar.</p>
                                  ) : (
                                    clientesFiltrados.map((cliente) => {
                                      const checked = asignacionesSet.has(cliente.id);
                                      const asignacion = detailAsignaciones.find((entry) => entry.alumnoId === cliente.id);

                                      return (
                                        <div key={`${item.id}-${cliente.id}`} className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
                                          <label className="flex items-center gap-2 text-sm text-slate-100">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={(e) => toggleAlumnoAsignado(item.id, cliente.id, e.target.checked)}
                                              className="h-4 w-4"
                                            />
                                            <span>{cliente.email}</span>
                                          </label>

                                          {checked ? (
                                            <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                                              <input
                                                type="checkbox"
                                                checked={Boolean(asignacion?.puedeEditar)}
                                                onChange={(e) =>
                                                  togglePuedeEditarAsignado(item.id, cliente.id, e.target.checked)
                                                }
                                                className="h-4 w-4"
                                              />
                                              Puede editar registros de este alumno
                                            </label>
                                          ) : null}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                <ReliableActionButton
                                  type="button"
                                  onClick={() => void saveAsignaciones(item.id)}
                                  disabled={assignSavingId === item.id}
                                  className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {assignSavingId === item.id ? "Actualizando..." : "Actualizar asignaciones"}
                                </ReliableActionButton>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                                <p className="text-sm font-black text-white">Historial</p>
                                {detailHistorial.length === 0 ? (
                                  <p className="mt-2 text-sm text-slate-300">Sin acciones registradas.</p>
                                ) : (
                                  <div className="mt-2 space-y-2">
                                    {detailHistorial.slice(0, 8).map((entry, index) => (
                                      <div key={`${item.id}-hist-${index}`} className="rounded-lg border border-white/10 bg-slate-800/60 p-2">
                                        <p className="text-xs font-semibold text-slate-100">{entry.value?.accion || "accion"}</p>
                                        <p className="text-[11px] text-slate-400">{entry.value?.fecha || ""}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Permisos rapidos</h2>
          <p className="text-xs text-slate-300">Edita accesos por apartado sin salir de esta pantalla.</p>
        </div>
        <div className="w-full max-w-sm">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-300">Buscar colaborador</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o email"
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
          />
        </div>
      </section>

      {message ? (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm font-semibold ${
            message.type === "success"
              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
              : "border-rose-400/30 bg-rose-500/15 text-rose-200"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="space-y-4">
        {filtered.map((item) => (
          <section id={`permisos-${item.id}`} key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white">{item.nombreCompleto}</h2>
                <p className="text-sm text-slate-300">{item.email}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  item.estado === "suspendido"
                    ? "bg-rose-500/20 text-rose-200"
                    : "bg-emerald-500/20 text-emerald-200"
                }`}
              >
                {item.estado === "suspendido" ? "Suspendido" : "Activo"}
              </span>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <ToggleChip
                label="Puede editar registros"
                checked={item.puedeEditarRegistros}
                onToggle={(checked) => updateItem(item.id, (prev) => ({ ...prev, puedeEditarRegistros: checked }))}
              />
              <ToggleChip
                label="Puede editar planes"
                checked={item.puedeEditarPlanes}
                onToggle={(checked) => updateItem(item.id, (prev) => ({ ...prev, puedeEditarPlanes: checked }))}
              />
              <ToggleChip
                label="Puede ver todos los alumnos"
                checked={item.puedeVerTodosAlumnos}
                onToggle={(checked) => updateItem(item.id, (prev) => ({ ...prev, puedeVerTodosAlumnos: checked }))}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-100">Acceso a categorias y apartados</p>
                <div className="flex gap-2">
                  <ReliableActionButton
                    type="button"
                    onClick={() => setAllAccess(item.id, true)}
                    className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200"
                  >
                    Dar todo
                  </ReliableActionButton>
                  <ReliableActionButton
                    type="button"
                    onClick={() => setAllAccess(item.id, false)}
                    className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-200"
                  >
                    Quitar todo
                  </ReliableActionButton>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ACCESS_OPTIONS.map((option) => (
                  <label
                    key={option.href}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{option.label}</p>
                      <p className="text-[11px] text-slate-400">{option.category}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(item.accesos[option.href])}
                      onChange={(e) =>
                        updateItem(item.id, (prev) => ({
                          ...prev,
                          accesos: { ...prev.accesos, [option.href]: e.target.checked },
                        }))
                      }
                      className="h-4 w-4"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <ReliableActionButton
                type="button"
                disabled={savingId === item.id || item.estado === "suspendido"}
                onClick={() => void saveItem(item.id)}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingId === item.id ? "Guardando permisos..." : "Guardar permisos"}
              </ReliableActionButton>
            </div>
          </section>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
          No se encontraron colaboradores para mostrar.
        </div>
      ) : null}

      {ingresanteModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-cyan-200/30 bg-slate-950/95 p-5 shadow-[0_35px_90px_rgba(2,8,24,0.65)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-100/80">Nuevo ingresante</p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {resolveIngresanteNombre(ingresanteModal).nombreCompleto || 'Sin nombre'}
                </h2>
                <p className="text-sm text-slate-300">{ingresanteModal.email}</p>
              </div>

              <ReliableActionButton
                type="button"
                onClick={() => {
                  setIngresanteModalId(null);
                  setConfirmAltaId(null);
                }}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
              >
                Cerrar
              </ReliableActionButton>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile label="Nombre" value={resolveIngresanteNombre(ingresanteModal).nombre || 'Sin dato'} />
              <InfoTile label="Apellido" value={resolveIngresanteNombre(ingresanteModal).apellido || 'Sin dato'} />
              <InfoTile label="Telefono" value={String(ingresanteModal.signupProfile?.telefono || ingresanteModal.telefono || 'Sin dato')} />
              <InfoTile label="Nacimiento" value={String(ingresanteModal.signupProfile?.fechaNacimiento || ingresanteModal.fechaNacimiento || 'Sin dato')} />
              <InfoTile label="Altura" value={String(ingresanteModal.signupProfile?.altura || ingresanteModal.altura || 'Sin dato')} />
              <InfoTile label="Peso" value={String(ingresanteModal.signupProfile?.peso || 'Sin dato')} />
              <InfoTile label="Objetivo" value={String(ingresanteModal.signupProfile?.objetivo || 'Sin dato')} />
              <InfoTile label="Registrado" value={formatDateTime(ingresanteModal.createdAt)} />
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-3">
              <p className="text-sm font-black text-white">Observaciones iniciales</p>
              <p className="mt-1 text-sm text-slate-200">
                {String(ingresanteModal.signupProfile?.observaciones || 'Sin observaciones')}
              </p>
            </div>

            <details className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-3" open>
              <summary className="cursor-pointer text-sm font-black text-cyan-100">Anamnesis de ingreso</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {buildAnamnesisRows(ingresanteModal.signupProfile?.anamnesis).length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-300 sm:col-span-2">
                    Sin respuestas de anamnesis disponibles.
                  </p>
                ) : (
                  buildAnamnesisRows(ingresanteModal.signupProfile?.anamnesis).map((entry) => (
                    <div key={`${entry.pregunta}-${entry.respuesta}`} className="rounded-lg border border-white/10 bg-slate-950/70 p-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">{entry.pregunta}</p>
                      <p className="mt-1 text-sm text-slate-100">{entry.respuesta}</p>
                    </div>
                  ))
                )}
              </div>
            </details>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <a
                href={buildClienteFichaHref(ingresanteModal)}
                className="rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-500/25"
              >
                Ver ficha en Clientes
              </a>
              <ReliableActionButton
                type="button"
                onClick={() => setConfirmAltaId(ingresanteModal.id)}
                disabled={clientActionLoadingId === ingresanteModal.id}
                className="rounded-xl border border-emerald-300/45 bg-emerald-500/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clientActionLoadingId === ingresanteModal.id ? 'Aplicando alta...' : 'Dar de Alta'}
              </ReliableActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {confirmAltaCliente ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-amber-200/35 bg-[#0b1220] p-6 text-center shadow-[0_28px_80px_rgba(2,6,20,0.7)]">
            <p className="text-5xl font-black text-amber-200">!</p>
            <h3 className="mt-2 text-4xl font-black text-white">Atencion</h3>
            <p className="mt-2 text-lg text-slate-100">Se creara una membresia:</p>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-4 text-left text-sm text-slate-100">
              <p>
                Titular: <strong>{resolveIngresanteNombre(confirmAltaCliente).nombreCompleto || 'Sin nombre'}</strong>
              </p>
              <p>Email: {confirmAltaCliente.email}</p>
              <p>
                Fecha nacimiento:{' '}
                {String(confirmAltaCliente.signupProfile?.fechaNacimiento || confirmAltaCliente.fechaNacimiento || 'Sin dato')}
              </p>
              <p>Estado actual: {String(confirmAltaCliente.estado || 'pendiente_alta')}</p>
            </div>

            <p className="mt-5 text-lg text-white">Estas seguro que desea continuar?</p>

            <div className="mt-4 flex justify-center gap-3">
              <ReliableActionButton
                type="button"
                onClick={() => void confirmarAltaIngresante()}
                disabled={clientActionLoadingId === confirmAltaCliente.id}
                className="rounded-lg bg-[#e76f51] px-6 py-2 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clientActionLoadingId === confirmAltaCliente.id ? 'Aplicando...' : 'OK'}
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => setConfirmAltaId(null)}
                className="rounded-lg bg-slate-500 px-6 py-2 text-sm font-black text-white transition hover:bg-slate-400"
              >
                Cancelar
              </ReliableActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value || 'Sin dato'}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ToggleChip({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}
