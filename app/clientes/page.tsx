"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAlumnos } from "../../components/AlumnosProvider";
import { useCategories } from "../../components/CategoriesProvider";
import { useDeportes } from "../../components/DeportesProvider";
import { usePlayers } from "../../components/PlayersProvider";
import { useSessions } from "../../components/SessionsProvider";
import { useSharedState } from "../../components/useSharedState";
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

function sumarUnMes(dateValue: string): string {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setMonth(parsed.getMonth() + 1);
  return parsed.toISOString().slice(0, 10);
}

const TABS: { id: ClienteTab; label: string }[] = [
  { id: "datos", label: "Datos generales" },
  { id: "cuestionario", label: "Cuestionario" },
  { id: "plan-entrenamiento", label: "Plan entrenamiento" },
  { id: "plan-nutricional", label: "Plan nutricional" },
  { id: "recetas", label: "Recetas" },
  { id: "notas", label: "Notas" },
  { id: "documentos", label: "Documentos" },
  { id: "chequeos", label: "Chequeos" },
  { id: "progreso", label: "Progreso" },
];

const tabPlaceholderCopy: Partial<Record<ClienteTab, string>> = {
  cuestionario: "Cuestionario inicial, antecedentes y habitos.",
  "plan-nutricional": "Lineamientos nutricionales y adherencia semanal.",
  recetas: "Recetas sugeridas y planificacion de comidas.",
  notas: "Notas del profesional y seguimiento del cliente.",
  documentos: "Links o referencias de documentos cargados.",
  chequeos: "Checklist de chequeos periodicos.",
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
    endDate: "",
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
    tabNotas: {},
  };
}

export default function ClientesPage() {
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetaSearch, setEtiquetaSearch] = useState("");
  const [etiquetaCrear, setEtiquetaCrear] = useState({ texto: "", color: "#2196f3" });
  const { jugadoras, agregarJugadora, editarJugadora, eliminarJugadora } = usePlayers();
  const { alumnos, agregarAlumno, editarAlumno, eliminarAlumno } = useAlumnos();
  const { categorias } = useCategories();
  const { deportes } = useDeportes();
  const { sesiones } = useSessions();

  const [clientesMeta, setClientesMeta] = useSharedState<Record<string, ClienteMeta>>({}, {
    key: CLIENTE_META_KEY,
    legacyLocalStorageKey: CLIENTE_META_KEY,
  });
  const [pagos, setPagos] = useSharedState<PagoRegistro[]>([], {
    key: PAGOS_KEY,
    legacyLocalStorageKey: PAGOS_KEY,
  });

  const [vista, setVista] = useState<ClienteEstado>("activo");
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | ClienteTipo>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroDeporte, setFiltroDeporte] = useState("todos");
  const [filtroClub, setFiltroClub] = useState("");
  const [filtroPlan, setFiltroPlan] = useState<"todos" | "con-plan" | "sin-plan">("todos");
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

  const categoriasOptions = useMemo(
    () => categorias.filter((cat) => cat.habilitada).map((cat) => cat.nombre),
    [categorias]
  );

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
    if (!selectedClient) return;
    fetch(`/api/etiquetas?userId=${selectedClient.id.split(":")[1]}`)
      .then((res) => res.json())
      .then(setEtiquetas);
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

    return clientes
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
        if (filtroPlan === "con-plan") return sesionesClienteCount > 0;
        if (filtroPlan === "sin-plan") return sesionesClienteCount === 0;
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
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [
    clientes,
    filtroCategoria,
    filtroClub,
    filtroDeporte,
    filtroPlan,
    filtroTipo,
    search,
    sesionesPorCliente,
    vista,
  ]);

  // ...existing code...
  useEffect(() => {
    if (!selectedClient) return;
    fetch(`/api/etiquetas?userId=${selectedClient.id.split(":")[1]}`)
      .then((res) => res.json())
      .then(setEtiquetas);
  }, [selectedClient]);

  const selectedMeta = useMemo(() => {
    if (!selectedClient) return null;
    return clientesMeta[selectedClient.id] || defaultMeta(selectedClient);
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

    useEffect(() => {
      if (!selectedClient) return;
      fetch(`/api/etiquetas?userId=${selectedClient.id.split(":")[1]}`)
        .then((res) => res.json())
        .then(setEtiquetas);
    }, [selectedClient]);

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
    const telefono = (meta.telefono || "").replace(/\D+/g, "");
    if (!telefono) return;
    window.open(`https://wa.me/${telefono}`, "_blank", "noopener,noreferrer");
  };

  const registrarPago = (e: React.FormEvent) => {
    e.preventDefault();
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

    setPagos((prev) => [pago, ...prev]);
    setMetaPatch(cliente.id, {
      pagoEstado: "confirmado",
      moneda: pagoForm.moneda,
      importe: String(importe),
      saldo: "0",
      startDate: pagoForm.fecha,
      endDate: sumarUnMes(pagoForm.fecha),
    });

    setSelectedClientId(cliente.id);
    setPagoForm((prev) => ({ ...prev, importe: "" }));
  };

  return (
    <main className="mx-auto max-w-[1500px] p-6 text-slate-100">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Clientes</h1>
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

      <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Registrar pago</h2>
        <p className="mt-1 text-sm text-slate-300">
          Al registrar un pago, se renueva automaticamente el plan por 1 mes desde la fecha indicada.
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

      <section className="grid gap-5 xl:grid-cols-[1fr_2.1fr]">
        <div className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-white/15 bg-slate-950/55 p-1">
              <button type="button" onClick={() => setVista("activo")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === "activo" ? "bg-emerald-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Activos</button>
              <button type="button" onClick={() => setVista("finalizado")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === "finalizado" ? "bg-rose-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Finalizados</button>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" className="w-full max-w-sm rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
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
            <select value={filtroPlan} onChange={(e) => setFiltroPlan(e.target.value as "todos" | "con-plan" | "sin-plan")} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-2 text-xs">
              <option value="todos">Plan: Todos</option>
              <option value="con-plan">Con plan</option>
              <option value="sin-plan">Sin plan</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            {clientesFiltrados.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">No hay clientes en este apartado.</p>
            ) : (
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-300">
                  <tr>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Categoria</th>
                    <th className="px-2 py-2">Plan</th>
                    <th className="px-2 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((cliente) => {
                    const active = cliente.id === selectedClientId;
                    const sesionesCount = sesionesPorCliente[cliente.id] || 0;
                    return (
                      <tr key={cliente.id} className={`border-t border-white/10 ${active ? "bg-cyan-500/10" : "bg-transparent"}`}>
                        <td className="px-2 py-2">
                          <p className="font-semibold text-white">{cliente.nombre}</p>
                          <p className="text-[11px] text-slate-400">{cliente.club || "Sin club"}</p>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cliente.tipo === "jugadora" ? "bg-cyan-500/20 text-cyan-100" : "bg-lime-500/20 text-lime-100"}`}>{cliente.tipo === "jugadora" ? "Jugadora" : "Alumno/a"}</span>
                        </td>
                        <td className="px-2 py-2 text-slate-200">{cliente.categoria || cliente.deporte || "-"}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sesionesCount > 0 ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/20 text-rose-100"}`}>{sesionesCount > 0 ? `Con plan (${sesionesCount})` : "Sin plan"}</span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button type="button" onClick={() => { setSelectedClientId(cliente.id); setActiveTab("datos"); }} className="rounded border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/10" title="Ver">👁</button>
                            <button type="button" onClick={() => { setSelectedClientId(cliente.id); setActiveTab("notas"); }} className="rounded border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/10" title="Chat">💬</button>
                            <button type="button" onClick={() => openWhatsapp(cliente)} disabled={!getMeta(cliente).telefono} className="rounded border border-emerald-300/40 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-40" title="WhatsApp">🟢</button>
                            <button type="button" onClick={() => { setSelectedClientId(cliente.id); setActiveTab("plan-entrenamiento"); }} className="rounded border border-cyan-300/40 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/10" title="Asignar">📌</button>
                            <button type="button" onClick={() => toggleEstado(cliente)} className="rounded border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/10" title="Activar/Finalizar">↔</button>
                            <button type="button" onClick={() => borrarCliente(cliente)} className="rounded border border-rose-300/30 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/10" title="Eliminar">🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg">
          {!selectedClient || !selectedMeta || !datosDraft ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">Selecciona un cliente para abrir su ficha.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-800/95 via-slate-800/75 to-slate-700/60 p-4">
                <div className="grid gap-3 md:grid-cols-5">
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
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
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
                  {/* Etiquetas chips visualización */}
                  <div className="ml-4">
                    <EtiquetasChips etiquetas={etiquetas} />
                  </div>
                  {/* Crear etiqueta */}
                  <form
                    className="flex items-center gap-2"
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
                          .then(setEtiquetas);
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
                    className="rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs ml-2"
                  />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                {activeTab === "datos" ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-white">Cliente</h3>
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
                      <h3 className="text-xl font-bold text-white">Informacion de la asesoria</h3>
                      <div className="grid gap-3 md:grid-cols-3">
                        <input type="date" value={selectedMeta.startDate} onChange={(e) => setMetaPatch(selectedClient.id, { startDate: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
                        <input type="date" value={selectedMeta.endDate} onChange={(e) => setMetaPatch(selectedClient.id, { endDate: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" />
                        <input value={selectedMeta.categoriaPlan} onChange={(e) => setMetaPatch(selectedClient.id, { categoriaPlan: e.target.value })} className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm" placeholder="Categoria" />
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
      </section>
    </main>
  );
}
