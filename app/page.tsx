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
  if (normalized.includes("template")) return "/semana";
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
  if (normalized.includes("carga") || normalized.includes("sesion")) return "Entrar a templates";

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

function isTemplatesModulo(modulo: Modulo): boolean {
  const href = String(modulo.href || "").trim().toLowerCase();
  const label = String(modulo.label || "").trim().toLowerCase();
  return href === "/semana" || label === "semana" || label === "templates" || label.includes("template");
}

function normalizeTemplatesModulo(modulo: Modulo): Modulo {
  if (!isTemplatesModulo(modulo)) {
    return modulo;
  }

  const rawDesc = String(modulo.desc || "").trim();
  const desc = rawDesc.toLowerCase().includes("planificacion semanal") || !rawDesc
    ? "Biblioteca de templates y objetivos de carga."
    : rawDesc;

  return {
    ...modulo,
    label: "Templates",
    desc,
    href: "/semana",
  };
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
      label: "Templates",
      href: "/semana",
      desc: "Biblioteca de templates y objetivos de carga.",
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
          ? parsed.modulos
              .filter((modulo) => !isWellnessModulo(modulo))
              .map((modulo) => normalizeTemplatesModulo(modulo))
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
          modulos: hydratedConfig.modulos.map((modulo) => {
            const normalizedModulo = normalizeTemplatesModulo(modulo);
            return {
              ...normalizedModulo,
              href: resolveActionHref(
                normalizedModulo.href,
                normalizedModulo.label,
                guessAppHrefByLabel(normalizedModulo.label) || "/"
              ),
            };
          }),
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
      className="pf-home-stage relative -mx-4 min-h-screen overflow-x-clip text-[#FAF8FC]"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      {/* Fondo tactico — paleta: base #314A93, glows #61BDFF (cyan) y #CA91EE (lila). */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        {/* Base: navy profundo derivado de #314A93, un poco mas oscuro para contraste */}
        <div className="absolute inset-0 bg-[#0d1740]" />
        {/* Capa de paleta: degrade navy real #314A93 en la parte superior */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#314A93_0%,#1a2663_55%,#0d1740_100%)] opacity-80" />
        {/* Glows: cyan #61BDFF arriba-izquierda, lavanda #CA91EE abajo-derecha */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_45%_at_10%_0%,rgba(97,189,255,0.28),transparent_62%),radial-gradient(ellipse_55%_40%_at_100%_100%,rgba(202,145,238,0.22),transparent_60%)]" />
        {/* Scanlines horizontales finas (HUD) */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(250,248,252,0.9)_1px,transparent_1px)] [background-size:100%_4px]" />
        {/* Trazas diagonales de velocidad sobre el borde derecho — ahora violeta */}
        <div className="absolute -right-20 top-0 hidden h-full w-[45%] opacity-[0.10] [background-image:repeating-linear-gradient(115deg,rgba(178,141,231,0.9)_0,rgba(178,141,231,0.9)_2px,transparent_2px,transparent_22px)] md:block" />
        {/* Linea de carril top y bottom */}
        <div className="absolute left-0 right-0 top-[3.5rem] h-px bg-gradient-to-r from-transparent via-[#61BDFF]/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-[#CA91EE]/0 via-[#CA91EE]/60 to-[#61BDFF]/0" />
        {/* Corner brackets — marcadores de pista */}
        <div className="absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-[#61BDFF]/60" />
        <div className="absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-[#61BDFF]/60" />
        <div className="absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-[#CA91EE]/70" />
        <div className="absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-[#CA91EE]/70" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-6 md:px-7 md:py-8 lg:px-8">
        {configMode && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[#61BDFF]/60 bg-[#61BDFF]/[0.06] px-4 py-2.5">
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.35em] text-[#61BDFF]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#61BDFF]" />
              Config mode · inicio
            </p>
            <div className="flex flex-wrap gap-2">
              {!editando ? (
                <ReliableActionButton
                  onClick={() => setEditando(true)}
                  className="border border-[#61BDFF]/60 bg-[#61BDFF]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#61BDFF] transition hover:bg-[#61BDFF]/20"
                >
                  Editar inicio
                </ReliableActionButton>
              ) : (
                <>
                  <ReliableActionButton
                    onClick={guardarConfig}
                    className="border border-[#B28DE7]/60 bg-[#B28DE7]/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#CA91EE] transition hover:bg-[#B28DE7]/25"
                  >
                    Guardar
                  </ReliableActionButton>
                  <ReliableActionButton
                    onClick={() => setEditando(false)}
                    className="border border-[#FAF8FC]/30 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#FAF8FC] transition hover:bg-[#FAF8FC]/10"
                  >
                    Cancelar
                  </ReliableActionButton>
                </>
              )}
              <ReliableActionButton
                onClick={resetConfig}
                className="border border-[#CA91EE]/50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#CA91EE] transition hover:bg-[#CA91EE]/15"
              >
                Reset
              </ReliableActionButton>
              <Link
                href="/"
                onClick={closeHomeEditMode}
                className="border border-[#FAF8FC]/30 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#FAF8FC] transition hover:bg-[#FAF8FC]/10"
              >
                Cerrar
              </Link>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 00 / BRIEFING — hero abierto, sin caja. Marca de pista a la  */}
        {/* izquierda, headline gigante y metricas pegadas a la derecha.  */}
        {/* ============================================================ */}
        <header className="relative mb-10 pt-2">
          {/* Marca de seccion — lavanda (#CA91EE) */}
          <div className="mb-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.4em] text-[#CA91EE]">
            <span className="h-[2px] w-10 bg-[#CA91EE]" />
            <span className="font-mono">// 00 · BRIEFING</span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div className="relative">
              {editando ? (
                <input
                  value={config.badge}
                  onChange={(e) => setConfig({ ...config, badge: e.target.value })}
                  className="w-full max-w-sm rounded-sm border border-[#61BDFF]/40 bg-[#0d1740]/70 px-3 py-2 text-xs font-bold tracking-wide text-[#61BDFF]"
                />
              ) : (
                <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-[#61BDFF]">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#61BDFF] shadow-[0_0_12px_rgba(97,189,255,0.8)]" />
                  {config.badge}
                </p>
              )}

              {editando ? (
                <input
                  value={config.titulo}
                  onChange={(e) => setConfig({ ...config, titulo: e.target.value })}
                  className="mt-3 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/70 px-3 py-2 text-3xl font-black text-[#FAF8FC]"
                />
              ) : (
                <h1 className="mt-4 max-w-4xl text-[2.6rem] font-black uppercase leading-[0.92] tracking-[-0.02em] text-[#FAF8FC] md:text-[4.2rem]">
                  {config.titulo}
                  <span className="ml-2 inline-block h-3 w-3 translate-y-[-0.5em] bg-[#CA91EE] shadow-[0_0_20px_rgba(202,145,238,0.85)]" />
                </h1>
              )}

              {editando ? (
                <textarea
                  value={config.subtitulo}
                  onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })}
                  className="mt-3 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/70 px-3 py-2 text-sm text-[#FAF8FC]/90"
                  rows={3}
                />
              ) : (
                <p className="mt-5 max-w-2xl border-l-2 border-[#61BDFF]/50 pl-4 text-sm leading-7 text-[#FAF8FC]/75 md:text-base">
                  {config.subtitulo}
                </p>
              )}

              {editando ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/60 p-3">
                    <p className="mb-2 text-xs text-[#FAF8FC]/60">Boton primario</p>
                    <input
                      value={config.botonPrimarioLabel}
                      onChange={(e) =>
                        setConfig({ ...config, botonPrimarioLabel: e.target.value })
                      }
                      className="mb-2 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-sm"
                    />
                    <input
                      value={config.botonPrimarioHref}
                      onChange={(e) =>
                        setConfig({ ...config, botonPrimarioHref: e.target.value })
                      }
                      className="w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/60 p-3">
                    <p className="mb-2 text-xs text-[#FAF8FC]/60">Boton secundario</p>
                    <input
                      value={config.botonSecundarioLabel}
                      onChange={(e) =>
                        setConfig({ ...config, botonSecundarioLabel: e.target.value })
                      }
                      className="mb-2 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-sm"
                    />
                    <input
                      value={config.botonSecundarioHref}
                      onChange={(e) =>
                        setConfig({ ...config, botonSecundarioHref: e.target.value })
                      }
                      className="w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-7 flex flex-wrap items-stretch gap-3">
                  <Link
                    href={primaryActionHref}
                    className="group inline-flex items-center gap-3 bg-[#CA91EE] px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#1a1236] shadow-[0_14px_32px_rgba(202,145,238,0.35)] transition hover:bg-[#B28DE7] [clip-path:polygon(0_0,100%_0,100%_100%,10px_100%,0_calc(100%-10px))]"
                  >
                    <span>{config.botonPrimarioLabel}</span>
                    <span className="font-mono text-base transition-transform group-hover:translate-x-1">&gt;&gt;</span>
                  </Link>
                  <Link
                    href={secondaryActionHref}
                    className="group inline-flex items-center gap-3 border border-[#61BDFF]/50 bg-transparent px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#61BDFF] transition hover:border-[#61BDFF] hover:bg-[#61BDFF]/10"
                  >
                    <span>{config.botonSecundarioLabel}</span>
                    <span className="font-mono text-base opacity-70 transition-transform group-hover:translate-x-1">&gt;</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Columna lateral — tablero de mision */}
            <aside className="relative border-t border-[#FAF8FC]/10 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.35em] text-[#FAF8FC]/45">Mission Board</p>
              <div className="divide-y divide-[#FAF8FC]/[0.08]">
                <div className="flex items-baseline justify-between py-2.5">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[#FAF8FC]/55">Day</span>
                  {editando ? (
                    <input
                      value={config.diaLabel}
                      onChange={(e) => setConfig({ ...config, diaLabel: e.target.value })}
                      className="w-32 rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-right text-xs font-bold"
                    />
                  ) : (
                    <span className="font-mono text-sm font-black text-[#FAF8FC]">{config.diaLabel}</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between py-2.5">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[#FAF8FC]/55">Equipo</span>
                  {editando ? (
                    <input
                      value={config.equipo}
                      onChange={(e) => setConfig({ ...config, equipo: e.target.value })}
                      className="w-32 rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-right text-xs font-bold"
                    />
                  ) : (
                    <span className="font-mono text-sm font-black text-[#FAF8FC]">{config.equipo}</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between py-2.5">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[#FAF8FC]/55">Duracion</span>
                  {editando ? (
                    <input
                      value={config.duracion}
                      onChange={(e) => setConfig({ ...config, duracion: e.target.value })}
                      className="w-32 rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-right text-xs font-bold"
                    />
                  ) : (
                    <span className="font-mono text-sm font-black text-[#61BDFF]">{config.duracion}</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between py-2.5">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[#FAF8FC]/55">Bloques</span>
                  {editando ? (
                    <input
                      value={config.bloques}
                      onChange={(e) => setConfig({ ...config, bloques: e.target.value })}
                      className="w-32 rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-right text-xs font-bold"
                    />
                  ) : (
                    <span className="font-mono text-sm font-black text-[#CA91EE]">{config.bloques}</span>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </header>

        {/* ============================================================ */}
        {/* 01 / METRICS */}
        {/* ============================================================ */}
        <div className="mb-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.4em] text-[#61BDFF]">
          <span className="h-[2px] w-10 bg-[#61BDFF]" />
          <span className="font-mono">// 01 · METRICS</span>
        </div>
        <section className="relative mb-12 grid divide-y divide-[#FAF8FC]/[0.08] border-y border-[#FAF8FC]/10 bg-[linear-gradient(180deg,rgba(250,248,252,0.03),transparent)] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
          {dashboardStats.map((stat, index) => {
            const accents = [
              { bar: "bg-[#61BDFF]", text: "text-[#61BDFF]" },
              { bar: "bg-[#5FB7FA]", text: "text-[#5FB7FA]" },
              { bar: "bg-[#CA91EE]", text: "text-[#CA91EE]" },
              { bar: "bg-[#B28DE7]", text: "text-[#B28DE7]" },
            ];
            const accent = accents[index % accents.length];
            const statHref = resolveDashboardStatHref(stat.title, index);
            const statHint = resolveDashboardStatHint(stat.title, index);

            return (
              <Link
                key={stat.title}
                href={statHref}
                className="group relative flex items-start gap-4 px-5 py-5 transition hover:bg-[#FAF8FC]/[0.03]"
              >
                <span className={`mt-1 block h-10 w-[3px] ${accent.bar}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#FAF8FC]/55">
                    <span className="mr-2 font-mono text-[#FAF8FC]/40">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {stat.title}
                  </p>
                  <p className="mt-1 font-mono text-5xl font-black tracking-tight text-[#FAF8FC]">
                    {stat.value}
                  </p>
                  <p className={`mt-1 text-[11px] uppercase tracking-[0.14em] ${accent.text}`}>
                    {statHint}
                  </p>
                </div>
                <span className="self-center font-mono text-xs font-bold text-[#FAF8FC]/40 transition group-hover:translate-x-1 group-hover:text-[#61BDFF]">
                  &gt;
                </span>
              </Link>
            );
          })}
        </section>

        {/* ============================================================ */}
        {/* 02 / ROSTER */}
        {/* ============================================================ */}
        <section className="mb-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.4em] text-[#61BDFF]">
                <span className="h-[2px] w-10 bg-[#61BDFF]" />
                <span className="font-mono">// 02 · ROSTER</span>
              </div>
              <h3 className="mt-3 text-4xl font-black uppercase leading-none tracking-tight text-[#FAF8FC] md:text-5xl">
                Alumnos &amp; planes activos
              </h3>
              <p className="mt-2 max-w-xl text-sm text-[#FAF8FC]/60">
                Vista rapida con foco de trabajo diario, estilo CRM operativo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/clientes"
                className="inline-flex items-center gap-2 bg-[#61BDFF] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#0d1740] transition hover:bg-[#5FB7FA] [clip-path:polygon(0_0,100%_0,100%_100%,8px_100%,0_calc(100%-8px))]"
              >
                <span>Crear cliente</span>
                <span className="font-mono">+</span>
              </Link>
              <Link
                href="/clientes"
                className="inline-flex items-center gap-2 border border-[#FAF8FC]/30 bg-transparent px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#FAF8FC] transition hover:border-[#CA91EE]/70 hover:bg-[#FAF8FC]/5"
              >
                Asignar entrenamiento
              </Link>
            </div>
          </div>

          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-0 border-y border-[#FAF8FC]/10 md:grid-cols-4 md:divide-x md:divide-[#FAF8FC]/[0.08]">
            {[
              { label: "Activos", value: operativoKpis.totalAlumnos, bar: "bg-[#61BDFF]", text: "text-[#61BDFF]" },
              { label: "Con plan", value: operativoKpis.conPlan, bar: "bg-[#5FB7FA]", text: "text-[#5FB7FA]" },
              { label: "Sin plan", value: operativoKpis.sinPlan, bar: "bg-[#CA91EE]", text: "text-[#CA91EE]" },
              { label: "Prescripciones", value: operativoKpis.totalPrescripciones, bar: "bg-[#B28DE7]", text: "text-[#B28DE7]" },
            ].map((kpi) => (
              <div key={kpi.label} className="flex items-center gap-3 px-4 py-4">
                <span className={`block h-10 w-[3px] ${kpi.bar}`} />
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${kpi.text}`}>{kpi.label}</p>
                  <p className="mt-0.5 font-mono text-3xl font-black text-[#FAF8FC]">{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla */}
          <div className="border-t-2 border-[#61BDFF]/40 bg-[#0d1740]/50 p-4 backdrop-blur-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <input
                value={operativoFiltro}
                onChange={(e) => setOperativoFiltro(e.target.value)}
                placeholder="Buscar alumno por nombre..."
                className="w-full max-w-sm rounded-sm border border-[#FAF8FC]/15 bg-[#0d1740]/90 px-3 py-2 text-sm text-[#FAF8FC] placeholder:text-[#FAF8FC]/40 focus:border-[#61BDFF]/70 focus:outline-none"
              />
              <Link
                href="/clientes"
                className="inline-flex items-center gap-2 border border-[#61BDFF]/40 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#61BDFF] transition hover:bg-[#61BDFF]/10"
              >
                Modulo clientes <span className="font-mono">&gt;</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#61BDFF]/25 text-[10px] uppercase tracking-[0.22em] text-[#FAF8FC]/55">
                    <th className="px-3 py-2 font-bold">Alumno</th>
                    <th className="px-3 py-2 font-bold">Estado</th>
                    <th className="px-3 py-2 font-bold">Objetivo</th>
                    <th className="px-3 py-2 font-bold">Sesiones</th>
                    <th className="px-3 py-2 font-bold">Ult. actualizacion</th>
                    <th className="px-3 py-2 text-right font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnosOperativos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-[#FAF8FC]/55">
                        No hay alumnos para mostrar con el filtro actual.
                      </td>
                    </tr>
                  ) : (
                    alumnosOperativos.slice(0, 8).map((alumno) => (
                      <tr key={alumno.nombre} className="border-b border-[#FAF8FC]/[0.06] text-[#FAF8FC] transition hover:bg-[#61BDFF]/[0.05]">
                        <td className="px-3 py-3 font-bold">{alumno.nombre}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                              alumno.estado === "Con plan"
                                ? "text-[#61BDFF]"
                                : "text-[#CA91EE]"
                            }`}
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                alumno.estado === "Con plan" ? "bg-[#61BDFF]" : "bg-[#CA91EE]"
                              }`}
                            />
                            {alumno.estado}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[#FAF8FC]/80">{alumno.objetivo}</td>
                        <td className="px-3 py-3 font-mono">
                          {alumno.sesiones}
                          <span className="ml-1 text-xs text-[#B28DE7]">
                            ({alumno.prescripciones} presc.)
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-[#FAF8FC]/55">
                          {alumno.ultimaActualizacion
                            ? new Date(alumno.ultimaActualizacion).toLocaleDateString("es-AR")
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href="/semana"
                            className="inline-flex items-center gap-1 border border-[#FAF8FC]/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FAF8FC] transition hover:border-[#61BDFF]/70 hover:bg-[#FAF8FC]/5"
                          >
                            Templates <span className="font-mono">&gt;</span>
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

        {/* ============================================================ */}
        {/* 03 / STAGES */}
        {/* ============================================================ */}
        <section className="mb-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.4em] text-[#CA91EE]">
                <span className="h-[2px] w-10 bg-[#CA91EE]" />
                <span className="font-mono">// 03 · STAGES</span>
              </div>
              <h3 className="mt-3 text-4xl font-black uppercase leading-none tracking-tight text-[#FAF8FC] md:text-5xl">
                Acceso rapido por categorias
              </h3>
            </div>
            <Link
              href="/categorias"
              className="inline-flex items-center gap-2 border border-[#FAF8FC]/25 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FAF8FC] transition hover:border-[#CA91EE]/70 hover:bg-[#FAF8FC]/5"
            >
              Ver todas <span className="font-mono">&gt;</span>
            </Link>
          </div>

          {categoriasActivas.length === 0 ? (
            <p className="border-l-2 border-[#FAF8FC]/30 pl-4 text-sm text-[#FAF8FC]/55">
              No hay categorias habilitadas. Activa o crea categorias para ver accesos directos.
            </p>
          ) : (
            <div className="grid gap-0 border-y border-[#FAF8FC]/10 sm:grid-cols-2 sm:divide-x sm:divide-[#FAF8FC]/[0.08] lg:grid-cols-4">
              {categoriasActivas.map((categoria, index) => {
                const tone = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
                const icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];

                return (
                  <Link
                    key={categoria.nombre}
                    href={`/categorias/${encodeURIComponent(categoria.nombre)}`}
                    className="group relative flex flex-col gap-3 px-5 py-6 transition hover:bg-[#FAF8FC]/[0.03]"
                  >
                    <div className={`absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r ${tone} opacity-60 transition group-hover:opacity-100`} />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#FAF8FC]/45">
                        STAGE/{String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#FAF8FC]/45 transition group-hover:translate-x-1 group-hover:text-[#CA91EE]">
                        &gt;&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{icon}</span>
                      <p className="text-xl font-black uppercase leading-tight tracking-tight text-[#FAF8FC] transition group-hover:text-[#61BDFF]">
                        {categoria.nombre}
                      </p>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-[#FAF8FC]/55">
                      Abrir categoria
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ============================================================ */}
        {/* 04 / TODAY'S SESSION */}
        {/* ============================================================ */}
        <section className="mb-12 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.4em] text-[#61BDFF]">
              <span className="h-[2px] w-10 bg-[#61BDFF]" />
              <span className="font-mono">// 04 · TODAY&apos;S SESSION</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {editando ? (
                <input
                  value={config.radarTitulo}
                  onChange={(e) => setConfig({ ...config, radarTitulo: e.target.value })}
                  className="w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/70 px-3 py-2 text-2xl font-black text-[#FAF8FC]"
                />
              ) : (
                <h3 className="text-3xl font-black uppercase tracking-tight text-[#FAF8FC] md:text-4xl">
                  {config.radarTitulo}
                </h3>
              )}

              <span className="inline-flex items-center gap-2 border border-[#61BDFF]/50 px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.2em] text-[#61BDFF]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#61BDFF]" />
                {config.diaLabel}
              </span>
            </div>

            {editando ? (
              <textarea
                value={config.radarDetalle}
                onChange={(e) => setConfig({ ...config, radarDetalle: e.target.value })}
                className="mt-3 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/70 px-3 py-2 text-sm"
                rows={2}
              />
            ) : (
              <p className="mt-4 max-w-2xl border-l-2 border-[#61BDFF]/50 pl-4 text-sm leading-7 text-[#FAF8FC]/75">
                {config.radarDetalle}
              </p>
            )}

            {/* Stats inline separados por pipes */}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-sm">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#FAF8FC]/45">Equipo</span>
                <span className="font-black text-[#FAF8FC]">{config.equipo}</span>
              </div>
              <span className="text-[#FAF8FC]/20">|</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#FAF8FC]/45">Duracion</span>
                <span className="font-black text-[#61BDFF]">{config.duracion}</span>
              </div>
              <span className="text-[#FAF8FC]/20">|</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#FAF8FC]/45">Bloques</span>
                <span className="font-black text-[#CA91EE]">{config.bloques}</span>
              </div>
            </div>

            {/* Objetivo — quote */}
            <div className="mt-6 border-l-[3px] border-[#CA91EE] bg-gradient-to-r from-[#CA91EE]/12 via-transparent to-transparent py-3 pl-5 pr-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#CA91EE]">Objetivo</p>
              {editando ? (
                <textarea
                  value={config.objetivo}
                  onChange={(e) => setConfig({ ...config, objetivo: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-sm"
                  rows={2}
                />
              ) : (
                <p className="mt-1 text-base font-bold text-[#FAF8FC]">{config.objetivo}</p>
              )}
            </div>
          </div>

          {/* Alertas */}
          <aside>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.4em] text-[#CA91EE]">
                <span className="h-[2px] w-10 bg-[#CA91EE]" />
                <span className="font-mono">// ALERTAS</span>
              </div>
              {editando && (
                <ReliableActionButton
                  onClick={addAlerta}
                  className="rounded-sm border border-[#CA91EE]/50 bg-[#CA91EE]/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#CA91EE]"
                >
                  + Alerta
                </ReliableActionButton>
              )}
            </div>
            <ul className="divide-y divide-[#FAF8FC]/[0.08] border-y border-[#FAF8FC]/10">
              {config.alertas.map((alerta, index) => (
                <li key={index} className="flex gap-3 py-3">
                  <span className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-[#CA91EE] shadow-[0_0_10px_rgba(202,145,238,0.8)]" />
                  <div className="min-w-0 flex-1">
                    {editando ? (
                      <>
                        <input
                          value={alerta.nombre}
                          onChange={(e) => updateAlerta(index, { nombre: e.target.value })}
                          className="mb-2 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-sm"
                        />
                        <input
                          value={alerta.detalle}
                          onChange={(e) => updateAlerta(index, { detalle: e.target.value })}
                          className="w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-sm"
                        />
                        <ReliableActionButton
                          onClick={() => removeAlerta(index)}
                          className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#CA91EE]"
                        >
                          Eliminar alerta
                        </ReliableActionButton>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-black uppercase tracking-wide text-[#FAF8FC]">{alerta.nombre}</p>
                        <p className="mt-0.5 text-xs text-[#FAF8FC]/55">{alerta.detalle}</p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        {/* ============================================================ */}
        {/* 05 / MODULES */}
        {/* ============================================================ */}
        <section className="mb-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.4em] text-[#CA91EE]">
                <span className="h-[2px] w-10 bg-[#CA91EE]" />
                <span className="font-mono">// 05 · MODULES</span>
              </div>
              <h3 className="mt-3 text-4xl font-black uppercase leading-none tracking-tight text-[#FAF8FC] md:text-5xl">
                Modulos &amp; accesos
              </h3>
            </div>
            {editando && (
              <ReliableActionButton
                onClick={addModulo}
                className="inline-flex items-center gap-2 border border-[#61BDFF]/60 bg-[#61BDFF]/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#61BDFF] transition hover:bg-[#61BDFF]/25"
              >
                + Modulo
              </ReliableActionButton>
            )}
          </div>

          <div className="grid gap-0 border-y border-[#FAF8FC]/10 sm:grid-cols-2 sm:divide-x sm:divide-[#FAF8FC]/[0.08] lg:grid-cols-4">
            {config.modulos.filter((item) => !isWellnessModulo(item)).map((item, index) =>
              editando ? (
                <div
                  key={`${item.label}-${index}`}
                  className="border-b border-[#FAF8FC]/[0.08] bg-[#0d1740]/40 p-4"
                >
                  <input
                    value={item.label}
                    onChange={(e) => updateModulo(index, { label: e.target.value })}
                    className="mb-2 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-sm font-bold"
                  />
                  <input
                    value={item.href}
                    onChange={(e) => updateModulo(index, { href: e.target.value })}
                    className="mb-2 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-xs"
                  />
                  <textarea
                    value={item.desc}
                    onChange={(e) => updateModulo(index, { desc: e.target.value })}
                    className="mb-2 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-xs"
                    rows={2}
                  />
                  <input
                    value={item.tone}
                    onChange={(e) => updateModulo(index, { tone: e.target.value })}
                    className="mb-2 w-full rounded-sm border border-[#FAF8FC]/20 bg-[#0d1740]/90 px-2 py-1 text-xs"
                    placeholder="from-[#61BDFF] to-[#5FB7FA]"
                  />
                  <ReliableActionButton
                    onClick={() => removeModulo(index)}
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#CA91EE]"
                  >
                    Eliminar modulo
                  </ReliableActionButton>
                </div>
              ) : (
                <Link
                  key={`${item.label}-${index}`}
                  href={resolveActionHref(item.href, item.label, guessAppHrefByLabel(item.label) || "/")}
                  className="group relative flex flex-col gap-3 px-5 py-6 transition hover:bg-[#FAF8FC]/[0.03]"
                >
                  <div className={`absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r ${item.tone} opacity-50 transition group-hover:opacity-100`} />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#FAF8FC]/45">
                      MOD/{String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#FAF8FC]/45 transition group-hover:translate-x-1 group-hover:text-[#CA91EE]">
                      &gt;&gt;
                    </span>
                  </div>
                  <p className="text-lg font-black uppercase leading-tight tracking-tight text-[#FAF8FC] transition group-hover:text-[#61BDFF]">
                    {item.label}
                  </p>
                  <p className="text-xs leading-5 text-[#FAF8FC]/60">{item.desc}</p>
                </Link>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}


