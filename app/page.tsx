"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, useEffect, useMemo, useState } from "react";
import { CategoriesContext } from "../components/CategoriesProvider";
import { useAlumnos } from "../components/AlumnosProvider";
import { useSessions } from "../components/SessionsProvider";
import { dashboardStats } from "../data/mockData";

type Alerta = {
  nombre: string;
  detalle: string;
};

type Modulo = {
  label: string;
  href: string;
  desc: string;
  tone: string;
};

type HomeConfig = {
  badge: string;
  titulo: string;
  subtitulo: string;
  botonPrimarioLabel: string;
  botonPrimarioHref: string;
  botonSecundarioLabel: string;
  botonSecundarioHref: string;
  radarTitulo: string;
  radarDetalle: string;
  diaLabel: string;
  equipo: string;
  duracion: string;
  bloques: string;
  objetivo: string;
  alertas: Alerta[];
  modulos: Modulo[];
};

function normalizeAppHref(value: string | undefined, fallback: string): string {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  if (/^[a-zA-Z0-9/_-]+$/.test(raw)) {
    return `/${raw.replace(/^\/+/, "")}`;
  }

  return fallback;
}

function guessAppHrefByLabel(label: string): string | null {
  const normalized = String(label || "").trim().toLowerCase();

  if (!normalized) return null;
  if (normalized.includes("inicio")) return "/";
  if (normalized.includes("sesion")) return "/sesiones";
  if (normalized.includes("ejercicio")) return "/sesiones?seccion=ejercicios";
  if (normalized.includes("cliente")) return "/clientes";
  if (normalized.includes("semana")) return "/semana";
  if (normalized.includes("plantel") || normalized.includes("jugadora") || normalized.includes("alumno")) {
    return "/clientes?seccion=plantel";
  }
  if (normalized.includes("registro")) return "/registros";
  if (normalized.includes("categoria")) return "/categorias";
  if (normalized.includes("deporte")) return "/deportes";
  if (normalized.includes("equipo")) return "/equipos";
  if (normalized.includes("asistencia")) return "/asistencias";
  if (normalized.includes("wellness")) return "/wellness";
  if (normalized.includes("nutricion")) return "/categorias/Nutricion";
  if (normalized.includes("configuracion")) return "/configuracion";
  if (normalized.includes("cuenta")) return "/cuenta";

  return null;
}

function resolveActionHref(rawHref: string | undefined, label: string, fallbackHref: string): string {
  const raw = String(rawHref || "").trim();
  const normalized = normalizeAppHref(raw, fallbackHref);
  const guessed = guessAppHrefByLabel(label);

  if (raw === "#" || raw === "/" || !raw) {
    if (guessed) {
      return guessed;
    }
    return fallbackHref;
  }

  if (normalized === "/" && guessed && guessed !== "/") {
    return guessed;
  }

  return normalized;
}

function resolveDashboardStatHref(title: string, index: number): string {
  const normalized = title.toLowerCase();

  if (normalized.includes("categoria")) return "/categorias";
  if (normalized.includes("jugadora") || normalized.includes("alumno") || normalized.includes("plantel")) return "/clientes?seccion=plantel";
  if (normalized.includes("wellness")) return "/wellness";
  if (normalized.includes("carga") || normalized.includes("sesion")) return "/semana";

  const fallbackByIndex = ["/categorias", "/clientes?seccion=plantel", "/semana", "/wellness"];
  return fallbackByIndex[index] || "/registros";
}

function resolveDashboardStatHint(title: string, index: number): string {
  const normalized = title.toLowerCase();

  if (normalized.includes("categoria")) return "Abrir mapa de categorias";
  if (normalized.includes("jugadora") || normalized.includes("alumno") || normalized.includes("plantel")) {
    return "Ver plantilla operativa";
  }
  if (normalized.includes("wellness")) return "Revisar balance de carga";
  if (normalized.includes("carga") || normalized.includes("sesion")) return "Entrar al plan semanal";

  const fallbackHints = [
    "Explorar indicadores",
    "Ir al panel asociado",
    "Abrir vista detallada",
    "Continuar con acciones",
  ];

  return fallbackHints[index % fallbackHints.length];
}

function isWellnessModulo(modulo: Modulo): boolean {
  const href = modulo.href.trim().toLowerCase();
  return href === "/wellness" || href === "/nuevo-wellness";
}

const STORAGE_KEY = "pf-control-home-config-v2";
const HOME_EDIT_MODE_KEY = "pf-control-home-edit-mode-v1";

const CATEGORY_GRADIENTS = [
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-lime-500 to-green-600",
  "from-rose-500 to-red-600",
  "from-sky-500 to-indigo-600",
];

const CATEGORY_ICONS = ["SP", "DF", "GO", "AC", "WN", "EN", "ST", "PW"];

const defaultConfig: HomeConfig = {
  badge: "ATHLETIC EDITION",
  titulo: "PF Control",
  subtitulo:
    "Inicio con energia visual: colores vivos, foco en accion y accesos directos para trabajar rapido desde campo, gimnasio o escritorio.",
  botonPrimarioLabel: "Planificar sesion",
  botonPrimarioHref: "/sesiones",
  botonSecundarioLabel: "Biblioteca ejercicios",
  botonSecundarioHref: "/sesiones?seccion=ejercicios",
  radarTitulo: "Radar de entrenamiento",
  radarDetalle:
    "Fuerza de tren inferior, aceleracion y control de carga con monitoreo de wellness.",
  diaLabel: "HOY",
  equipo: "Primera Femenina",
  duracion: "70 min",
  bloques: "3",
  objetivo: "Desarrollar fuerza, prevencion y aceleracion con control de carga.",
  alertas: [
    { nombre: "Valentina Ruiz", detalle: "Fatiga alta - Wellness 4" },
    { nombre: "Sofia Gomez", detalle: "Molestia leve - Seguimiento" },
  ],
  modulos: [
    {
      label: "Plantel",
      href: "/clientes?seccion=plantel",
      desc: "Gestiona jugadoras y su estado deportivo.",
      tone: "from-cyan-500 to-sky-600",
    },
    {
      label: "Semana",
      href: "/semana",
      desc: "Planificacion semanal de cargas y objetivos.",
      tone: "from-emerald-500 to-teal-600",
    },
    {
      label: "Entrenamiento",
      href: "/sesiones",
      desc: "Gestiona sesiones y biblioteca de ejercicios en un solo modulo.",
      tone: "from-blue-600 to-indigo-600",
    },
    {
      label: "Asistencias",
      href: "/asistencias",
      desc: "Controla jornadas, presentes y ausencias por categoria.",
      tone: "from-teal-500 to-cyan-600",
    },
    {
      label: "Registros",
      href: "/registros",
      desc: "Seguimiento historico y reportes rapidos.",
      tone: "from-violet-500 to-purple-600",
    },
    {
      label: "Categorias",
      href: "/categorias",
      desc: "Clasifica ejercicios por enfoque fisico.",
      tone: "from-lime-500 to-green-600",
    },
    {
      label: "Equipos",
      href: "/equipos",
      desc: "Administra grupos y estructura de trabajo.",
      tone: "from-rose-500 to-red-600",
    },
  ],
};

export default function Home() {
  const { alumnos } = useAlumnos();
  const { sesiones } = useSessions();
  const [configMode, setConfigMode] = useState(false);
  const [editando, setEditando] = useState(false);
  const [operativoFiltro, setOperativoFiltro] = useState("");
  const [config, setConfig] = useState<HomeConfig>(defaultConfig);
  const categoriesContext = useContext(CategoriesContext);
  const primaryActionHref = resolveActionHref(
    config.botonPrimarioHref,
    config.botonPrimarioLabel,
    defaultConfig.botonPrimarioHref
  );
  const secondaryActionHref = resolveActionHref(
    config.botonSecundarioHref,
    config.botonSecundarioLabel,
    defaultConfig.botonSecundarioHref
  );
  const categoriasActivas = (categoriesContext?.categorias || []).filter(
    (categoria) => categoria.habilitada && categoria.nombre.toLowerCase() !== "wellness"
  );

  const mapaSesionesPorAlumno = useMemo(() => {
    const mapa = new Map<string, { total: number; prescripciones: number; ultimaActualizacion: string | null }>();

    for (const sesion of sesiones) {
      if (!sesion.alumnoAsignado) continue;

      const prev = mapa.get(sesion.alumnoAsignado) || {
        total: 0,
        prescripciones: 0,
        ultimaActualizacion: null,
      };

      const prescripcionesAlumno = (sesion.prescripciones || []).filter(
        (item) => item.personaTipo === "alumnos" && item.personaNombre === sesion.alumnoAsignado
      );

      const ultima = prescripcionesAlumno
        .map((item) => item.createdAt)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

      mapa.set(sesion.alumnoAsignado, {
        total: prev.total + 1,
        prescripciones: prev.prescripciones + prescripcionesAlumno.length,
        ultimaActualizacion:
          !prev.ultimaActualizacion || (ultima && new Date(ultima).getTime() > new Date(prev.ultimaActualizacion).getTime())
            ? ultima
            : prev.ultimaActualizacion,
      });
    }

    return mapa;
  }, [sesiones]);

  const alumnosOperativos = useMemo(() => {
    const query = operativoFiltro.trim().toLowerCase();
    return alumnos
      .map((alumno) => {
        const data = mapaSesionesPorAlumno.get(alumno.nombre) || {
          total: 0,
          prescripciones: 0,
          ultimaActualizacion: null,
        };

        return {
          nombre: alumno.nombre,
          objetivo: alumno.objetivo || "Sin objetivo",
          sesiones: data.total,
          prescripciones: data.prescripciones,
          ultimaActualizacion: data.ultimaActualizacion,
          estado: data.total > 0 ? "Con plan" : "Sin plan",
        };
      })
      .filter((item) => (query ? item.nombre.toLowerCase().includes(query) : true))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [alumnos, mapaSesionesPorAlumno, operativoFiltro]);

  const operativoKpis = useMemo(() => {
    const totalAlumnos = alumnos.length;
    const conPlan = alumnosOperativos.filter((item) => item.sesiones > 0).length;
    const sinPlan = totalAlumnos - conPlan;
    const totalPrescripciones = alumnosOperativos.reduce((acc, item) => acc + item.prescripciones, 0);

    return {
      totalAlumnos,
      conPlan,
      sinPlan,
      totalPrescripciones,
    };
  }, [alumnos.length, alumnosOperativos]);

  const activateHomeEditMode = () => {
    setConfigMode(true);
    setEditando(true);
  };

  const closeHomeEditMode = () => {
    setConfigMode(false);
    setEditando(false);
    localStorage.removeItem(HOME_EDIT_MODE_KEY);
  };

  useEffect(() => {
    const fromSidebarConfig = localStorage.getItem(HOME_EDIT_MODE_KEY) === "1";
    const params = new URLSearchParams(window.location.search);
    const fromLegacyQuery = params.get("config") === "1";

    if (fromSidebarConfig || fromLegacyQuery) {
      activateHomeEditMode();
    }

    const handleToggle = () => activateHomeEditMode();
    window.addEventListener("pf-home-edit-toggle", handleToggle);

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<HomeConfig>;
        const modulosGuardados = Array.isArray(parsed.modulos)
          ? parsed.modulos.filter((modulo) => !isWellnessModulo(modulo))
          : defaultConfig.modulos;

        const modulosConAsistencias = modulosGuardados.some(
          (modulo) => modulo.href.trim().toLowerCase() === "/asistencias"
        )
          ? modulosGuardados
          : [
              ...modulosGuardados,
              {
                label: "Asistencias",
                href: "/asistencias",
                desc: "Controla jornadas, presentes y ausencias por categoria.",
                tone: "from-teal-500 to-cyan-600",
              },
            ];

        const hydratedConfig = { ...defaultConfig, ...parsed, modulos: modulosConAsistencias };
        const sanitizedConfig: HomeConfig = {
          ...hydratedConfig,
          botonPrimarioHref: resolveActionHref(
            hydratedConfig.botonPrimarioHref,
            hydratedConfig.botonPrimarioLabel,
            defaultConfig.botonPrimarioHref
          ),
          botonSecundarioHref: resolveActionHref(
            hydratedConfig.botonSecundarioHref,
            hydratedConfig.botonSecundarioLabel,
            defaultConfig.botonSecundarioHref
          ),
          modulos: hydratedConfig.modulos.map((modulo) => ({
            ...modulo,
            href: resolveActionHref(modulo.href, modulo.label, guessAppHrefByLabel(modulo.label) || "/"),
          })),
        };

        setConfig(sanitizedConfig);

        if (JSON.stringify(hydratedConfig) !== JSON.stringify(sanitizedConfig)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedConfig));
        }
      } catch {
        // ignore invalid stored state
      }
    }

    return () => {
      window.removeEventListener("pf-home-edit-toggle", handleToggle);
    };
  }, []);

  const guardarConfig = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setEditando(false);
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateAlerta = (index: number, changes: Partial<Alerta>) => {
    setConfig((prev) => ({
      ...prev,
      alertas: prev.alertas.map((alerta, i) =>
        i === index ? { ...alerta, ...changes } : alerta
      ),
    }));
  };

  const removeAlerta = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      alertas: prev.alertas.filter((_, i) => i !== index),
    }));
  };

  const addAlerta = () => {
    setConfig((prev) => ({
      ...prev,
      alertas: [...prev.alertas, { nombre: "Nueva alerta", detalle: "Detalle" }],
    }));
  };

  const updateModulo = (index: number, changes: Partial<Modulo>) => {
    setConfig((prev) => ({
      ...prev,
      modulos: prev.modulos.map((modulo, i) =>
        i === index ? { ...modulo, ...changes } : modulo
      ),
    }));
  };

  const removeModulo = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      modulos: prev.modulos.filter((_, i) => i !== index),
    }));
  };

  const addModulo = () => {
    setConfig((prev) => ({
      ...prev,
      modulos: [
        ...prev.modulos,
        {
          label: "Nuevo modulo",
          href: "/",
          desc: "Descripcion editable",
          tone: "from-cyan-500 to-sky-600",
        },
      ],
    }));
  };

  return (
    <main
      className="relative -mx-4 min-h-screen overflow-x-clip text-slate-100"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[#061026]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(56,189,248,0.24),transparent_28%),radial-gradient(circle_at_86%_8%,rgba(16,185,129,0.22),transparent_30%),radial-gradient(circle_at_70%_85%,rgba(249,115,22,0.16),transparent_26%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.15)_1px,transparent_1px)] [background-size:62px_62px]" />
        <div className="absolute -left-16 top-14 h-72 w-72 rounded-full border border-cyan-300/25 bg-cyan-400/18 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full border border-indigo-300/20 bg-indigo-500/18 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full border border-emerald-300/20 bg-emerald-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-6 md:px-7 md:py-8 lg:px-8">
        {configMode && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Configuracion de inicio
            </p>
            <div className="flex flex-wrap gap-2">
              {!editando ? (
                <ReliableActionButton
                  onClick={() => setEditando(true)}
                  className="rounded-lg bg-cyan-400 px-3 py-1.5 text-sm font-bold text-slate-900"
                >
                  Editar inicio
                </ReliableActionButton>
              ) : (
                <>
                  <ReliableActionButton
                    onClick={guardarConfig}
                    className="rounded-lg bg-emerald-400 px-3 py-1.5 text-sm font-bold text-slate-900"
                  >
                    Guardar cambios
                  </ReliableActionButton>
                  <ReliableActionButton
                    onClick={() => setEditando(false)}
                    className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Cancelar
                  </ReliableActionButton>
                </>
              )}
              <ReliableActionButton
                onClick={resetConfig}
                className="rounded-lg border border-rose-300/50 px-3 py-1.5 text-sm font-semibold text-rose-100"
              >
                Reset
              </ReliableActionButton>
              <Link
                href="/"
                onClick={closeHomeEditMode}
                className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Cerrar configuracion
              </Link>
            </div>
          </div>
        )}

        <header className="relative mb-7 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(120deg,rgba(14,30,56,0.94),rgba(23,45,80,0.9)_52%,rgba(15,23,42,0.7)_100%)] p-6 shadow-[0_35px_95px_rgba(2,8,24,0.5)] md:p-8">
          <div className="absolute right-[-3rem] top-[-3rem] h-44 w-44 rounded-full bg-cyan-300/25 blur-3xl" />
          <div className="absolute bottom-[-2.25rem] right-14 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute inset-y-0 right-0 w-[42%] bg-[linear-gradient(145deg,rgba(6,182,212,0.2),rgba(129,140,248,0.14),rgba(16,185,129,0.2))]" />
          <div className="relative">
            {editando ? (
              <input
                value={config.badge}
                onChange={(e) => setConfig({ ...config, badge: e.target.value })}
                className="w-full max-w-sm rounded-lg border border-white/30 bg-slate-900/60 px-3 py-2 text-xs font-bold tracking-wide text-cyan-100"
              />
            ) : (
              <p className="inline-flex rounded-full border border-cyan-200/45 bg-cyan-300/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100">
                {config.badge}
              </p>
            )}

            {editando ? (
              <input
                value={config.titulo}
                onChange={(e) => setConfig({ ...config, titulo: e.target.value })}
                className="mt-3 w-full rounded-lg border border-white/30 bg-slate-900/60 px-3 py-2 text-3xl font-black text-white"
              />
            ) : (
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white md:text-[3.4rem]">
                {config.titulo}
              </h1>
            )}

            {editando ? (
              <textarea
                value={config.subtitulo}
                onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })}
                className="mt-3 w-full rounded-lg border border-white/30 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                rows={3}
              />
            ) : (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                {config.subtitulo}
              </p>
            )}

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {editando ? (
                <>
                  <div className="rounded-xl border border-white/20 bg-slate-900/50 p-3">
                    <p className="mb-2 text-xs text-slate-300">Boton primario</p>
                    <input
                      value={config.botonPrimarioLabel}
                      onChange={(e) =>
                        setConfig({ ...config, botonPrimarioLabel: e.target.value })
                      }
                      className="mb-2 w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm"
                    />
                    <input
                      value={config.botonPrimarioHref}
                      onChange={(e) =>
                        setConfig({ ...config, botonPrimarioHref: e.target.value })
                      }
                      className="w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="rounded-xl border border-white/20 bg-slate-900/50 p-3">
                    <p className="mb-2 text-xs text-slate-300">Boton secundario</p>
                    <input
                      value={config.botonSecundarioLabel}
                      onChange={(e) =>
                        setConfig({ ...config, botonSecundarioLabel: e.target.value })
                      }
                      className="mb-2 w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm"
                    />
                    <input
                      value={config.botonSecundarioHref}
                      onChange={(e) =>
                        setConfig({ ...config, botonSecundarioHref: e.target.value })
                      }
                      className="w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm"
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <Link
                    href={primaryActionHref}
                    className="rounded-xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 to-sky-400 px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-[#04243a] shadow-[0_14px_30px_rgba(34,211,238,0.35)] transition hover:translate-y-[-1px] hover:from-cyan-200 hover:to-sky-300"
                  >
                    {config.botonPrimarioLabel}
                  </Link>
                  <Link
                    href={secondaryActionHref}
                    className="rounded-xl border border-cyan-100/30 bg-slate-900/35 px-5 py-2.5 text-sm font-bold uppercase tracking-[0.08em] text-slate-100 transition hover:translate-y-[-1px] hover:border-cyan-200/55 hover:bg-slate-800/55"
                  >
                    {config.botonSecundarioLabel}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardStats.map((stat, index) => {
            const tones = [
              "from-cyan-500 to-blue-600",
              "from-emerald-500 to-green-600",
              "from-fuchsia-500 to-pink-600",
              "from-orange-500 to-red-600",
            ];
            const tone = tones[index % tones.length];
            const statHref = resolveDashboardStatHref(stat.title, index);
            const statHint = resolveDashboardStatHint(stat.title, index);

            return (
              <Link
                key={stat.title}
                href={statHref}
                className={`group relative overflow-hidden rounded-2xl border border-white/15 bg-slate-900/55 p-4 shadow-[0_15px_40px_rgba(2,8,20,0.4)] transition hover:-translate-y-1 hover:border-cyan-200/45`}
              >
                <div className={`mb-3 mr-12 h-1.5 rounded-full bg-gradient-to-r ${tone}`} />
                <p className="text-xs font-bold uppercase tracking-[0.17em] text-slate-300">{stat.title}</p>
                <p className="mt-2 text-4xl font-black tracking-tight text-white">{stat.value}</p>
                <p className="mt-2 text-xs text-slate-300">{statHint}</p>
                <span className="absolute right-4 top-3 text-xs font-black text-cyan-200/85 transition group-hover:translate-x-0.5">
                  ir &gt;
                </span>
                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/6 via-transparent to-cyan-200/10" />
                </div>
              </Link>
            );
          })}
        </section>

        <section className="mt-6 rounded-[2rem] border border-cyan-300/25 bg-[linear-gradient(145deg,rgba(4,16,36,0.95),rgba(6,26,58,0.92),rgba(5,18,40,0.96))] p-6 shadow-[0_32px_80px_rgba(2,8,24,0.5)]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/90">
                Mesa operativa
              </p>
              <h3 className="mt-1 text-3xl font-black leading-none text-white">Alumnos y planes activos</h3>
              <p className="mt-2 text-sm text-slate-300">
                Vista rapida con foco de trabajo diario, al estilo CRM operativo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/clientes"
                className="rounded-xl border border-cyan-100/35 bg-gradient-to-r from-cyan-300 to-sky-400 px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#04243a] shadow-[0_12px_24px_rgba(34,211,238,0.35)] transition hover:translate-y-[-1px]"
              >
                Crear cliente
              </Link>
              <Link
                href="/clientes"
                className="rounded-xl border border-slate-300/35 bg-slate-900/35 px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-100 transition hover:translate-y-[-1px] hover:border-cyan-100/40"
              >
                Asignar entrenamiento
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-emerald-300/35 bg-gradient-to-br from-emerald-500/20 to-transparent p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-100">Clientes activos</p>
              <p className="mt-1 text-3xl font-black text-white">{operativoKpis.totalAlumnos}</p>
            </div>
            <div className="rounded-2xl border border-blue-300/35 bg-gradient-to-br from-blue-500/20 to-transparent p-4">
              <p className="text-xs uppercase tracking-wide text-blue-100">Con plan</p>
              <p className="mt-1 text-3xl font-black text-white">{operativoKpis.conPlan}</p>
            </div>
            <div className="rounded-2xl border border-rose-300/35 bg-gradient-to-br from-rose-500/20 to-transparent p-4">
              <p className="text-xs uppercase tracking-wide text-rose-100">Sin plan</p>
              <p className="mt-1 text-3xl font-black text-white">{operativoKpis.sinPlan}</p>
            </div>
            <div className="rounded-2xl border border-violet-300/35 bg-gradient-to-br from-violet-500/20 to-transparent p-4">
              <p className="text-xs uppercase tracking-wide text-violet-100">Prescripciones</p>
              <p className="mt-1 text-3xl font-black text-white">{operativoKpis.totalPrescripciones}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/15 bg-slate-950/55 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <input
                value={operativoFiltro}
                onChange={(e) => setOperativoFiltro(e.target.value)}
                placeholder="Buscar alumno por nombre"
                className="w-full max-w-sm rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white"
              />
              <Link
                href="/clientes"
                className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/10"
              >
                Ver modulo clientes
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/15 text-xs uppercase tracking-wide text-slate-300">
                    <th className="px-3 py-2">Alumno</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Objetivo</th>
                    <th className="px-3 py-2">Sesiones</th>
                    <th className="px-3 py-2">Ult. actualizacion</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnosOperativos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-300">
                        No hay alumnos para mostrar con el filtro actual.
                      </td>
                    </tr>
                  ) : (
                    alumnosOperativos.slice(0, 8).map((alumno) => (
                      <tr key={alumno.nombre} className="border-b border-white/10 text-slate-100">
                        <td className="px-3 py-3 font-semibold">{alumno.nombre}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${
                              alumno.estado === "Con plan"
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-rose-500/20 text-rose-100"
                            }`}
                          >
                            {alumno.estado}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-200">{alumno.objetivo}</td>
                        <td className="px-3 py-3">
                          {alumno.sesiones}
                          <span className="ml-1 text-xs text-violet-200">
                            ({alumno.prescripciones} presc.)
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-300">
                          {alumno.ultimaActualizacion
                            ? new Date(alumno.ultimaActualizacion).toLocaleDateString("es-AR")
                            : "Sin movimientos"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href="/semana"
                            className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                          >
                            Abrir semana
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-slate-300/20 bg-[linear-gradient(160deg,rgba(33,48,74,0.92),rgba(41,56,82,0.88))] p-6 shadow-[0_24px_70px_rgba(2,8,24,0.45)] backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-2xl font-black text-white">Acceso rapido por categorias</h3>
            <Link
              href="/categorias"
              className="rounded-lg border border-white/25 bg-slate-900/35 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-white hover:bg-white/10"
            >
              Ver todas
            </Link>
          </div>

          {categoriasActivas.length === 0 ? (
            <p className="text-sm text-slate-300">
              No hay categorias habilitadas. Activa o crea categorias para ver accesos directos.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {categoriasActivas.map((categoria, index) => {
                const tone = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
                const icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];

                return (
                  <Link
                    key={categoria.nombre}
                    href={`/categorias/${encodeURIComponent(categoria.nombre)}`}
                    className="group rounded-2xl border border-white/20 bg-slate-900/35 p-4 transition hover:-translate-y-1 hover:border-cyan-200/40 hover:bg-slate-900/65"
                  >
                    <div className={`mb-3 h-2 rounded-full bg-gradient-to-r ${tone}`} />
                    <p className="text-2xl font-black text-white">
                      <span className="mr-2">{icon}</span>
                      {categoria.nombre}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-200">Abrir categoria</p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-[2rem] border border-slate-300/20 bg-[linear-gradient(160deg,rgba(34,50,79,0.95),rgba(44,61,89,0.9))] p-6 shadow-[0_24px_70px_rgba(2,8,24,0.45)] backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {editando ? (
                  <input
                    value={config.radarTitulo}
                    onChange={(e) => setConfig({ ...config, radarTitulo: e.target.value })}
                    className="w-full rounded-lg border border-white/30 bg-slate-900/60 px-3 py-2 text-xl font-black text-white"
                  />
                ) : (
                  <h3 className="text-xl font-black">{config.radarTitulo}</h3>
                )}

                {editando ? (
                  <input
                    value={config.diaLabel}
                    onChange={(e) => setConfig({ ...config, diaLabel: e.target.value })}
                    className="rounded-lg border border-white/30 bg-slate-900/60 px-3 py-1 text-xs font-bold text-white"
                  />
                ) : (
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                    {config.diaLabel}
                  </span>
                )}
              </div>

              {editando ? (
                <textarea
                  value={config.radarDetalle}
                  onChange={(e) => setConfig({ ...config, radarDetalle: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-white/30 bg-slate-900/60 px-3 py-2 text-sm"
                  rows={2}
                />
              ) : (
                <p className="mt-2 text-sm text-slate-200">{config.radarDetalle}</p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Equipo",
                    value: config.equipo,
                    onChange: (value: string) => setConfig({ ...config, equipo: value }),
                  },
                  {
                    label: "Duracion",
                    value: config.duracion,
                    onChange: (value: string) => setConfig({ ...config, duracion: value }),
                  },
                  {
                    label: "Bloques",
                    value: config.bloques,
                    onChange: (value: string) => setConfig({ ...config, bloques: value }),
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-slate-900/40 p-3">
                    <p className="text-xs text-slate-300">{item.label}</p>
                    {editando ? (
                      <input
                        value={item.value}
                        onChange={(e) => item.onChange(e.target.value)}
                        className="mt-1 w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm"
                      />
                    ) : (
                      <p className="font-semibold text-white">{item.value}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-slate-900/40 p-3">
                <p className="text-xs text-slate-300">Objetivo</p>
                {editando ? (
                  <textarea
                    value={config.objetivo}
                    onChange={(e) => setConfig({ ...config, objetivo: e.target.value })}
                    className="mt-1 w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm"
                    rows={2}
                  />
                ) : (
                  <p className="font-medium text-white">{config.objetivo}</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-amber-300/35 bg-[linear-gradient(170deg,rgba(89,52,13,0.58),rgba(42,18,12,0.6))] p-6 shadow-[0_24px_70px_rgba(45,23,7,0.42)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-black text-amber-100">Alertas</h3>
              {editando && (
                <ReliableActionButton
                  onClick={addAlerta}
                  className="rounded-md bg-amber-300 px-2 py-1 text-xs font-bold text-slate-900"
                >
                  + Alerta
                </ReliableActionButton>
              )}
            </div>
            <div className="space-y-3">
              {config.alertas.map((alerta, index) => (
                <div key={index} className="rounded-xl border border-amber-200/30 bg-slate-900/30 p-3">
                  {editando ? (
                    <>
                      <input
                        value={alerta.nombre}
                        onChange={(e) => updateAlerta(index, { nombre: e.target.value })}
                        className="mb-2 w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm"
                      />
                      <input
                        value={alerta.detalle}
                        onChange={(e) => updateAlerta(index, { detalle: e.target.value })}
                        className="w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm"
                      />
                      <ReliableActionButton
                        onClick={() => removeAlerta(index)}
                        className="mt-2 text-xs font-semibold text-rose-300"
                      >
                        Eliminar alerta
                      </ReliableActionButton>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-white">{alerta.nombre}</p>
                      <p className="text-sm text-slate-200">{alerta.detalle}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-slate-300/20 bg-[linear-gradient(160deg,rgba(35,50,75,0.95),rgba(49,63,90,0.9))] p-6 shadow-[0_24px_70px_rgba(2,8,24,0.45)] backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-2xl font-black">Modulos y accesos</h3>
            {editando && (
              <ReliableActionButton
                onClick={addModulo}
                className="rounded-md bg-cyan-300 px-2 py-1 text-xs font-bold text-slate-900"
              >
                + Modulo
              </ReliableActionButton>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {config.modulos.filter((item) => !isWellnessModulo(item)).map((item, index) =>
              editando ? (
                <div
                  key={`${item.label}-${index}`}
                  className="rounded-2xl border border-white/20 bg-slate-900/40 p-4"
                >
                  <input
                    value={item.label}
                    onChange={(e) => updateModulo(index, { label: e.target.value })}
                    className="mb-2 w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm font-bold"
                  />
                  <input
                    value={item.href}
                    onChange={(e) => updateModulo(index, { href: e.target.value })}
                    className="mb-2 w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs"
                  />
                  <textarea
                    value={item.desc}
                    onChange={(e) => updateModulo(index, { desc: e.target.value })}
                    className="mb-2 w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs"
                    rows={2}
                  />
                  <input
                    value={item.tone}
                    onChange={(e) => updateModulo(index, { tone: e.target.value })}
                    className="mb-2 w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-xs"
                    placeholder="from-cyan-500 to-sky-600"
                  />
                  <ReliableActionButton
                    onClick={() => removeModulo(index)}
                    className="text-xs font-semibold text-rose-300"
                  >
                    Eliminar modulo
                  </ReliableActionButton>
                </div>
              ) : (
                <Link
                  key={`${item.label}-${index}`}
                  href={resolveActionHref(item.href, item.label, guessAppHrefByLabel(item.label) || "/")}
                  className="group rounded-2xl border border-white/20 bg-slate-900/35 p-4 transition hover:-translate-y-1 hover:border-cyan-200/40 hover:bg-slate-900/65"
                >
                  <div className={`mb-2 h-1.5 rounded-full bg-gradient-to-r ${item.tone}`} />
                  <p className="text-lg font-black text-white">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-200">{item.desc}</p>
                </Link>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}


