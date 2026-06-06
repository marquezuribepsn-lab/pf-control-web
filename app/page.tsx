"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, useEffect, useMemo, useState } from "react";
import { CategoriesContext } from "../components/CategoriesProvider";
import { useAlumnos } from "../components/AlumnosProvider";
import { useSessions } from "../components/SessionsProvider";
import { usePlayers } from "../components/PlayersProvider";
import { useWellness } from "../components/WellnessProvider";

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
  const { jugadoras } = usePlayers();
  const { wellness } = useWellness();
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

  // ── Interactive color system — zero re-renders ────────────
  useEffect(() => {
    const root = document.documentElement;
    const onMove = (e: MouseEvent) => {
      root.style.setProperty("--mx", `${e.clientX}px`);
      root.style.setProperty("--my", `${e.clientY}px`);
      // Hue: mouse X maps 0→360 across viewport width
      const hue = Math.round((e.clientX / window.innerWidth) * 360);
      root.style.setProperty("--hue", `${hue}`);
      // Brightness: mouse Y maps subtle variation (0.85–1.1)
      const bright = 85 + Math.round((e.clientY / window.innerHeight) * 25);
      root.style.setProperty("--bright", `${bright}%`);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <main className="relative -mx-4 min-h-screen overflow-x-clip text-white">
      {/* Keyframes + global scoped styles */}
      <style>{`
        /* ── Defaults ────────────────────────────────────────── */
        :root { --hue: 135; --bright: 100%; }

        @keyframes pf-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pf-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.65); }
        }
        .pf-au   { animation: pf-fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        .pf-d1   { animation-delay: 0.04s; }
        .pf-d2   { animation-delay: 0.09s; }
        .pf-d3   { animation-delay: 0.14s; }
        .pf-d4   { animation-delay: 0.19s; }
        .pf-d5   { animation-delay: 0.24s; }
        .pf-dot-live { animation: pf-dot-pulse 2s ease-in-out infinite; }

        /* ── Hue-reactive tokens ─────────────────────────────── */
        .pf-accent       { color: hsl(var(--hue) 80% 72%); }
        .pf-accent-bg    { background: hsl(var(--hue) 70% 55%); }
        .pf-accent-glow  { box-shadow: 0 0 28px hsla(var(--hue), 70%, 60%, 0.45); }
        .pf-accent-border{ border-color: hsla(var(--hue), 70%, 65%, 0.3) !important; }

        /* Badge / pill */
        .pf-badge {
          border-color: hsla(var(--hue), 70%, 65%, 0.35);
          background: hsla(var(--hue), 70%, 60%, 0.12);
          color: hsl(var(--hue) 85% 78%);
        }
        .pf-badge-dot { background: hsl(var(--hue) 85% 72%); }

        /* Section label */
        .pf-label { color: hsl(var(--hue) 75% 72%); }

        /* Primary button */
        .pf-btn {
          background: hsl(var(--hue) 65% 52%);
          box-shadow: 0 0 28px hsla(var(--hue), 65%, 55%, 0.45);
          color: #fff;
          transition: all 0.3s ease;
        }
        .pf-btn:hover {
          background: hsl(var(--hue) 65% 58%);
          box-shadow: 0 0 44px hsla(var(--hue), 65%, 58%, 0.6);
          transform: translateY(-2px);
        }
        .pf-btn:active { transform: scale(0.97); }

        /* Stat cards — new gym design */
        .pf-stat-card { transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s ease; }
        .pf-stat-card:hover { transform: translateY(-3px) scale(1.015); }
        .pf-stat-card:active { transform: scale(0.98); }

        /* KPI mini-cards */
        .pf-k0 { background: hsla(calc(var(--hue) + 120), 60%, 50%, 0.09); border-color: hsla(calc(var(--hue) + 120), 60%, 60%, 0.22) !important; }
        .pf-k0 .pf-kval { color: hsl(calc(var(--hue) + 120) 75% 72%); }
        .pf-k1 { background: hsla(var(--hue), 65%, 55%, 0.09); border-color: hsla(var(--hue), 65%, 65%, 0.22) !important; }
        .pf-k1 .pf-kval { color: hsl(var(--hue) 80% 75%); }
        .pf-k2 { background: hsla(0, 70%, 55%, 0.09); border-color: hsla(0, 70%, 65%, 0.22) !important; }
        .pf-k2 .pf-kval { color: hsl(0 80% 72%); }
        .pf-k3 { background: hsla(calc(var(--hue) + 60), 65%, 55%, 0.09); border-color: hsla(calc(var(--hue) + 60), 65%, 65%, 0.22) !important; }
        .pf-k3 .pf-kval { color: hsl(calc(var(--hue) + 60) 80% 75%); }

        /* ── Por-card hover glow (mint gym) ─────────────────── */
        .pf-led { position: relative; overflow: hidden; }
        .pf-led::after {
          content: '';
          position: absolute; inset: 0; border-radius: inherit;
          background: radial-gradient(
            380px circle at var(--cx, 50%) var(--cy, 50%),
            rgba(97, 206, 112, 0.12) 0%,
            rgba(97, 206, 112, 0.05) 40%,
            transparent 65%
          );
          opacity: 0;
          transition: opacity 0.22s ease;
          pointer-events: none;
          z-index: 2;
        }
        .pf-led:hover::after { opacity: 1; }
        .pf-led:hover { border-color: rgba(97, 206, 112, 0.30) !important; }
      `}</style>

      <div className="relative mx-auto max-w-7xl px-5 py-8 md:px-7 lg:px-8">

        {/* ── Config toolbar ───────────────────────────────────── */}
        {configMode && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.09] bg-[#111417] p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
              Configuración de inicio
            </p>
            <div className="flex flex-wrap gap-2">
              {!editando ? (
                <ReliableActionButton
                  onClick={() => setEditando(true)}
                  className="rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-indigo-500 active:scale-95"
                >
                  Editar inicio
                </ReliableActionButton>
              ) : (
                <>
                  <ReliableActionButton
                    onClick={guardarConfig}
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-emerald-500 active:scale-95"
                  >
                    Guardar cambios
                  </ReliableActionButton>
                  <ReliableActionButton
                    onClick={() => setEditando(false)}
                    className="rounded-xl border border-white/[0.12] px-3 py-1.5 text-sm font-medium text-zinc-300 transition-all duration-200 hover:bg-white/[0.06]"
                  >
                    Cancelar
                  </ReliableActionButton>
                </>
              )}
              <ReliableActionButton
                onClick={resetConfig}
                className="rounded-xl border border-rose-500/25 px-3 py-1.5 text-sm font-medium text-rose-400 transition-all duration-200 hover:bg-rose-500/10"
              >
                Reset
              </ReliableActionButton>
              <Link
                href="/"
                onClick={closeHomeEditMode}
                className="rounded-xl border border-white/[0.10] px-3 py-1.5 text-sm font-medium text-zinc-400 transition-all duration-200 hover:bg-white/[0.05]"
              >
                Cerrar
              </Link>
            </div>
          </div>
        )}

        {/* ── HERO ─────────────────────────────────────────────── */}
        <header className="pf-au mb-10">
          {/* Badge vivo */}
          {editando ? (
            <input
              value={config.badge}
              onChange={(e) => setConfig({ ...config, badge: e.target.value })}
              className="mb-4 w-56 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300"
            />
          ) : (
            <span className="pf-badge mb-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wider">
              <span className="pf-badge-dot pf-dot-live h-1.5 w-1.5 rounded-full" />
              {config.badge}
            </span>
          )}

          {/* Título con gradient text */}
          {editando ? (
            <input
              value={config.titulo}
              onChange={(e) => setConfig({ ...config, titulo: e.target.value })}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-4xl font-bold text-white"
            />
          ) : (
            <h1 className="pf-page-hero-title mt-2 text-5xl md:text-[3.6rem]">
              {config.titulo}
            </h1>
          )}

          {editando ? (
            <textarea
              value={config.subtitulo}
              onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })}
              className="mt-4 w-full max-w-xl rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400"
              rows={2}
            />
          ) : (
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-400">
              {config.subtitulo}
            </p>
          )}

          {editando ? (
            <div className="mt-5 grid max-w-lg gap-3 sm:grid-cols-2">
              {[
                { label: "Botón primario", labelKey: "botonPrimarioLabel", hrefKey: "botonPrimarioHref" },
                { label: "Botón secundario", labelKey: "botonSecundarioLabel", hrefKey: "botonSecundarioHref" },
              ].map((btn) => (
                <div key={btn.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="mb-2 text-xs text-zinc-500">{btn.label}</p>
                  <input
                    value={(config as any)[btn.labelKey]}
                    onChange={(e) => setConfig({ ...config, [btn.labelKey]: e.target.value })}
                    className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                  />
                  <input
                    value={(config as any)[btn.hrefKey]}
                    onChange={(e) => setConfig({ ...config, [btn.hrefKey]: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={primaryActionHref}
                className="pf-btn pf-btn--primary !px-5 !py-2.5 !text-sm"
              >
                {config.botonPrimarioLabel}
              </Link>
              <Link
                href={secondaryActionHref}
                className="pf-btn pf-btn--ghost !px-5 !py-2.5 !text-sm"
              >
                {config.botonSecundarioLabel}
              </Link>
            </div>
          )}
        </header>

        {/* ── STATS ROW ─────────────────────────────────────────── */}
        <div className="pf-kpi-grid mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {useMemo(() => {
            const totalPersonas = jugadoras.length + alumnos.length;
            const wellnessList = Array.isArray(wellness) ? wellness : [];
            const wPromedio = wellnessList.length > 0
              ? (wellnessList.reduce((a, i) => a + i.bienestar, 0) / wellnessList.length).toFixed(1)
              : "—";
            const categoriasActivas = (categoriesContext?.categorias || []).filter((c) => c.habilitada && c.nombre.toLowerCase() !== "wellness").length;
            return [
              { title: "Categorías activas", value: String(categoriasActivas), href: "/categorias", hint: "Abrir mapa de categorías" },
              { title: "Jugadoras / Alumnos", value: String(totalPersonas), href: "/clientes?seccion=plantel", hint: "Ver plantilla operativa" },
              { title: "Sesiones creadas", value: String(sesiones.length), href: "/sesiones", hint: "Ir a sesiones" },
              { title: "Wellness promedio", value: String(wPromedio), href: "/wellness", hint: "Revisar balance de carga" },
            ];
          }, [jugadoras.length, alumnos.length, sesiones.length, wellness, categoriesContext]).map((stat, index) => {
            const variant = (["pf-kpi--emerald","pf-kpi--violet","pf-kpi--amber","pf-kpi--rose"] as const)[index];
            const delayClass = ["pf-d1","pf-d2","pf-d3","pf-d4"][index] ?? "";
            return (
              <Link
                key={stat.title}
                href={stat.href}
                className={`pf-au pf-kpi ${variant} ${delayClass} group block !p-5`}
              >
                <p className="pf-kpi__value !text-[2.5rem]">{stat.value}</p>
                <p className="pf-kpi__label mt-2">{stat.title}</p>
                <p className="pf-kpi__sub mt-2 group-hover:opacity-100" style={{ color: "var(--gym-accent-light)" }}>
                  {stat.hint} →
                </p>
              </Link>
            );
          })}
        </div>

        {/* ── MESA OPERATIVA ────────────────────────────────────── */}
        <section className="pf-au pf-led pf-d2 mb-5 pf-card rounded-2xl border p-6"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--cx", `${e.clientX - r.left}px`);
            e.currentTarget.style.setProperty("--cy", `${e.clientY - r.top}px`);
          }}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="pf-label mb-1 text-[11px] font-semibold uppercase tracking-widest">Mesa operativa</p>
              <h2 className="text-2xl font-bold text-white">Alumnos y planes activos</h2>
            </div>
            <div className="flex gap-2">
              <Link href="/clientes" className="pf-btn pf-btn--primary !px-4 !py-2 !text-xs">
                Crear cliente
              </Link>
              <Link href="/clientes" className="pf-btn pf-btn--ghost !px-4 !py-2 !text-xs">
                Asignar entrenamiento
              </Link>
            </div>
          </div>

          {/* KPIs */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Clientes activos", val: operativoKpis.totalAlumnos,        ki: 0 },
              { label: "Con plan",         val: operativoKpis.conPlan,             ki: 1 },
              { label: "Sin plan",         val: operativoKpis.sinPlan,             ki: 2 },
              { label: "Prescripciones",   val: operativoKpis.totalPrescripciones, ki: 3 },
            ].map((k) => (
              <div key={k.label} className={`pf-k${k.ki} rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5`}>
                <p className={`pf-kval text-3xl font-bold`}>{k.val}</p>
                <p className="mt-1 text-xs font-semibold text-white/60">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/[0.06] bg-black/[0.18] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <input
                value={operativoFiltro}
                onChange={(e) => setOperativoFiltro(e.target.value)}
                placeholder="Buscar alumno..."
                className="w-full max-w-xs rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-600 transition-colors duration-200 focus:border-indigo-500/50 focus:outline-none"
              />
              <Link href="/clientes" className="text-xs font-medium text-zinc-500 transition-colors duration-200 hover:text-indigo-400">
                Ver módulo clientes →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Alumno", "Estado", "Objetivo", "Sesiones", "Últ. act.", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alumnosOperativos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-zinc-600">
                        No hay alumnos con el filtro actual.
                      </td>
                    </tr>
                  ) : (
                    alumnosOperativos.slice(0, 8).map((alumno) => (
                      <tr key={alumno.nombre} className="border-b border-white/[0.04] transition-colors duration-150 hover:bg-indigo-500/[0.04]">
                        <td className="px-3 py-3 font-medium text-white">{alumno.nombre}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            alumno.estado === "Con plan"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}>
                            {alumno.estado}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-zinc-400">{alumno.objetivo}</td>
                        <td className="px-3 py-3 text-zinc-400">
                          {alumno.sesiones}
                          <span className="ml-1 text-zinc-600">({alumno.prescripciones})</span>
                        </td>
                        <td className="px-3 py-3 text-zinc-500">
                          {alumno.ultimaActualizacion
                            ? new Date(alumno.ultimaActualizacion).toLocaleDateString("es-AR")
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link href="/semana" className="text-xs font-medium text-zinc-500 transition-colors duration-200 hover:text-indigo-400">
                            Templates →
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

        {/* ── CATEGORÍAS ────────────────────────────────────────── */}
        <section className="pf-au pf-led pf-d3 mb-5 pf-card rounded-2xl border p-6"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--cx", `${e.clientX - r.left}px`);
            e.currentTarget.style.setProperty("--cy", `${e.clientY - r.top}px`);
          }}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="pf-label mb-1 text-[11px] font-semibold uppercase tracking-widest">Acceso rápido</p>
              <h2 className="text-2xl font-bold text-white">Categorías</h2>
            </div>
            <Link href="/categorias" className="text-xs font-medium text-zinc-500 transition-colors duration-200 hover:text-indigo-400">
              Ver todas →
            </Link>
          </div>
          {categoriasActivas.length === 0 ? (
            <p className="text-sm text-zinc-600">No hay categorías habilitadas.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {categoriasActivas.map((categoria, index) => {
                const accent = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
                return (
                  <Link
                    key={categoria.nombre}
                    href={`/categorias/${encodeURIComponent(categoria.nombre)}`}
                    className="group pf-card rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <div className={`mb-3 h-[2px] w-10 rounded-full bg-gradient-to-r ${accent}`} />
                    <p className="font-semibold" style={{ color: "#ffffff" }}>{categoria.nombre}</p>
                    <p className="mt-0.5 text-xs transition-colors duration-200 group-hover:text-indigo-400" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Abrir →
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ── RADAR + ALERTAS ───────────────────────────────────── */}
        <section className="pf-au pf-d4 mb-5 grid gap-4 lg:grid-cols-3">
          <div className="pf-led pf-card rounded-2xl border p-6 lg:col-span-2"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty("--cx", `${e.clientX - r.left}px`);
              e.currentTarget.style.setProperty("--cy", `${e.clientY - r.top}px`);
            }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              {editando ? (
                <input value={config.radarTitulo} onChange={(e) => setConfig({ ...config, radarTitulo: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xl font-bold text-white" />
              ) : (
                <h2 className="text-xl font-bold text-white">{config.radarTitulo}</h2>
              )}
              {editando ? (
                <input value={config.diaLabel} onChange={(e) => setConfig({ ...config, diaLabel: e.target.value })}
                  className="w-16 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300" />
              ) : (
                <span className="pf-badge rounded-full border px-3 py-1 text-xs font-medium">
                  {config.diaLabel}
                </span>
              )}
            </div>
            {editando ? (
              <textarea value={config.radarDetalle} onChange={(e) => setConfig({ ...config, radarDetalle: e.target.value })}
                className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-400" rows={2} />
            ) : (
              <p className="mb-4 text-sm leading-relaxed text-zinc-400">{config.radarDetalle}</p>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { label: "Equipo",   value: config.equipo,   onChange: (v: string) => setConfig({ ...config, equipo: v }) },
                { label: "Duración", value: config.duracion, onChange: (v: string) => setConfig({ ...config, duracion: v }) },
                { label: "Bloques",  value: config.bloques,  onChange: (v: string) => setConfig({ ...config, bloques: v }) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/[0.09] bg-[#111417] p-3">
                  <p className="mb-1 text-[11px] uppercase tracking-wider text-zinc-600">{item.label}</p>
                  {editando ? (
                    <input value={item.value} onChange={(e) => item.onChange(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
                  ) : (
                    <p className="font-semibold text-white">{item.value}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-xl border border-white/[0.09] bg-[#111417] p-3">
              <p className="mb-1 text-[11px] uppercase tracking-wider text-zinc-600">Objetivo</p>
              {editando ? (
                <textarea value={config.objetivo} onChange={(e) => setConfig({ ...config, objetivo: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" rows={2} />
              ) : (
                <p className="text-sm font-medium text-zinc-300">{config.objetivo}</p>
              )}
            </div>
          </div>

          {/* Alertas */}
          <div className="pf-card rounded-2xl border p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="mb-2 h-[2px] w-8 rounded-full bg-amber-400 opacity-80" />
                <h2 className="text-xl font-bold text-white">Alertas</h2>
              </div>
              {editando && (
                <ReliableActionButton onClick={addAlerta}
                  className="rounded-xl bg-amber-500 px-2.5 py-1 text-xs font-bold text-black transition-all duration-200 hover:bg-amber-400">
                  + Alerta
                </ReliableActionButton>
              )}
            </div>
            <div className="space-y-2">
              {config.alertas.map((alerta, index) => (
                <div key={index} className="rounded-xl border border-white/[0.08] bg-[#111417] p-3 transition-all duration-200 hover:border-white/[0.14]">
                  {editando ? (
                    <>
                      <input value={alerta.nombre} onChange={(e) => updateAlerta(index, { nombre: e.target.value })}
                        className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
                      <input value={alerta.detalle} onChange={(e) => updateAlerta(index, { detalle: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
                      <ReliableActionButton onClick={() => removeAlerta(index)}
                        className="mt-2 text-xs text-rose-400 hover:text-rose-300">
                        Eliminar
                      </ReliableActionButton>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-white">{alerta.nombre}</p>
                      <p className="text-xs text-zinc-400">{alerta.detalle}</p>
                    </>
                  )}
                </div>
              ))}
              {config.alertas.length === 0 && <p className="text-sm text-zinc-600">Sin alertas activas.</p>}
            </div>
          </div>
        </section>

        {/* ── MÓDULOS ───────────────────────────────────────────── */}
        <section className="pf-au pf-led pf-d5 pf-card rounded-2xl border p-6"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--cx", `${e.clientX - r.left}px`);
            e.currentTarget.style.setProperty("--cy", `${e.clientY - r.top}px`);
          }}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="pf-label mb-1 text-[11px] font-semibold uppercase tracking-widest">Accesos</p>
              <h2 className="text-2xl font-bold text-white">Módulos</h2>
            </div>
            {editando && (
              <ReliableActionButton onClick={addModulo} className="pf-btn rounded-xl px-3 py-1.5 text-xs font-semibold">
                + Módulo
              </ReliableActionButton>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {config.modulos.filter((item) => !isWellnessModulo(item)).map((item, index) =>
              editando ? (
                <div key={`${item.label}-${index}`} className="rounded-xl border border-white/[0.09] bg-[#111417] p-4">
                  <input value={item.label} onChange={(e) => updateModulo(index, { label: e.target.value })}
                    className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm font-bold text-white" />
                  <input value={item.href} onChange={(e) => updateModulo(index, { href: e.target.value })}
                    className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white" />
                  <textarea value={item.desc} onChange={(e) => updateModulo(index, { desc: e.target.value })}
                    className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white" rows={2} />
                  <input value={item.tone} onChange={(e) => updateModulo(index, { tone: e.target.value })}
                    placeholder="from-cyan-500 to-sky-600"
                    className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-400" />
                  <ReliableActionButton onClick={() => removeModulo(index)}
                    className="text-xs text-rose-400 hover:text-rose-300">
                    Eliminar
                  </ReliableActionButton>
                </div>
              ) : (
                <Link
                  key={`${item.label}-${index}`}
                  href={resolveActionHref(item.href, item.label, guessAppHrefByLabel(item.label) || "/")}
                  className="group pf-card rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(99,102,241,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "";
                  }}
                >
                  <div className={`mb-3 h-[2px] w-10 rounded-full bg-gradient-to-r ${item.tone}`} />
                  <p className="font-semibold" style={{ color: "#ffffff" }}>{item.label}</p>
                  <p className="mt-1 text-xs transition-colors duration-200 group-hover:text-indigo-400" style={{ color: "rgba(255,255,255,0.38)" }}>{item.desc}</p>
                </Link>
              )
            )}
          </div>
        </section>

      </div>
    </main>
  );
}


