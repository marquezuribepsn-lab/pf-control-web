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
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
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
      tone: "",
    },
    {
      label: "Templates",
      href: "/semana",
      desc: "Biblioteca de templates y objetivos de carga.",
      tone: "",
    },
    {
      label: "Entrenamiento",
      href: "/sesiones",
      desc: "Gestiona sesiones y biblioteca de ejercicios en un solo modulo.",
      tone: "",
    },
    {
      label: "Asistencias",
      href: "/asistencias",
      desc: "Controla jornadas, presentes y ausencias por categoria.",
      tone: "",
    },
    {
      label: "Registros",
      href: "/registros",
      desc: "Seguimiento historico y reportes rapidos.",
      tone: "",
    },
    {
      label: "Categorias",
      href: "/categorias",
      desc: "Clasifica ejercicios por enfoque fisico.",
      tone: "",
    },
    {
      label: "Equipos",
      href: "/equipos",
      desc: "Administra grupos y estructura de trabajo.",
      tone: "",
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
                tone: "",
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
          tone: "",
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

  // Paleta por tarjeta, del handoff v2.
  const TINTES = ["#22e5ff", "#34d399", "#c084fc", "#fbbf24"];
  const suave = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  return (
    <div className="pf-v2-page">
      {/* ── Barra de configuración ─────────────────────────────── */}
      {configMode ? (
        <div
          className="pf-v2-card"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16 }}
        >
          <span className="pf-v2-eyebrow" style={{ margin: 0 }}>Configuración de inicio</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {!editando ? (
              <ReliableActionButton onClick={() => setEditando(true)} className="pf-v2-btn">
                Editar inicio
              </ReliableActionButton>
            ) : (
              <>
                <ReliableActionButton onClick={guardarConfig} className="pf-v2-btn">
                  Guardar cambios
                </ReliableActionButton>
                <ReliableActionButton onClick={() => setEditando(false)} className="pf-v2-btn pf-v2-btn-2">
                  Cancelar
                </ReliableActionButton>
              </>
            )}
            <Link href="/" onClick={closeHomeEditMode} className="pf-v2-btn pf-v2-btn-2">
              Cerrar
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Bienvenida ─────────────────────────────────────────── */}
      <header className="pf-v2-hero">
        <div style={{ minWidth: 0 }}>
          {editando ? (
            <input
              value={config.badge}
              onChange={(e) => setConfig({ ...config, badge: e.target.value })}
              className="pf-v2-input"
              style={{ maxWidth: 260, marginBottom: 12 }}
            />
          ) : (
            <span className="pf-v2-chip pf-v2-chip-accent" style={{ marginBottom: 14 }}>{config.badge}</span>
          )}

          {editando ? (
            <input
              value={config.titulo}
              onChange={(e) => setConfig({ ...config, titulo: e.target.value })}
              className="pf-v2-input"
              style={{ fontSize: 24, fontWeight: 700 }}
            />
          ) : (
            <h1 className="pf-v2-hero-title">{config.titulo}</h1>
          )}

          {editando ? (
            <textarea
              value={config.subtitulo}
              onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })}
              className="pf-v2-input"
              rows={2}
              style={{ marginTop: 12, maxWidth: 520 }}
            />
          ) : (
            <p className="pf-v2-muted" style={{ marginTop: 12, maxWidth: 520 }}>{config.subtitulo}</p>
          )}
        </div>

        {editando ? (
          <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
            {[
              { label: "Botón primario", labelKey: "botonPrimarioLabel", hrefKey: "botonPrimarioHref" },
              { label: "Botón secundario", labelKey: "botonSecundarioLabel", hrefKey: "botonSecundarioHref" },
            ].map((btn) => (
              <div key={btn.label} className="pf-v2-card" style={{ padding: 14 }}>
                <span className="pf-v2-field-label">{btn.label}</span>
                <input
                  value={(config as any)[btn.labelKey]}
                  onChange={(e) => setConfig({ ...config, [btn.labelKey]: e.target.value })}
                  className="pf-v2-input"
                  style={{ marginBottom: 8 }}
                />
                <input
                  value={(config as any)[btn.hrefKey]}
                  onChange={(e) => setConfig({ ...config, [btn.hrefKey]: e.target.value })}
                  className="pf-v2-input"
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link href={primaryActionHref} className="pf-v2-btn">{config.botonPrimarioLabel}</Link>
            <Link href={secondaryActionHref} className="pf-v2-btn pf-v2-btn-2">{config.botonSecundarioLabel}</Link>
          </div>
        )}
      </header>

      {/* ── Indicadores ────────────────────────────────────────── */}
      <section className="pf-v2-grid-4">
        {useMemo(() => {
          const totalPersonas = jugadoras.length + alumnos.length;
          const wellnessList = Array.isArray(wellness) ? wellness : [];
          const wPromedio = wellnessList.length > 0
            ? (wellnessList.reduce((a, i) => a + i.bienestar, 0) / wellnessList.length).toFixed(1)
            : "—";
          const categoriasHabilitadas = (categoriesContext?.categorias || []).filter(
            (c) => c.habilitada && c.nombre.toLowerCase() !== "wellness"
          ).length;
          return [
            { title: "Categorías activas", value: String(categoriasHabilitadas), href: "/categorias", icon: "◈", hint: "Abrir mapa de categorías" },
            { title: "Jugadoras / Alumnos", value: String(totalPersonas), href: "/clientes?seccion=plantel", icon: "◉", hint: "Ver plantilla operativa" },
            { title: "Sesiones creadas", value: String(sesiones.length), href: "/sesiones", icon: "▤", hint: "Ir a sesiones" },
            { title: "Wellness promedio", value: String(wPromedio), href: "/wellness", icon: "◐", hint: "Revisar balance de carga" },
          ];
        }, [jugadoras.length, alumnos.length, sesiones.length, wellness, categoriesContext]).map((stat, index) => {
          const hex = TINTES[index % TINTES.length];
          return (
            <Link key={stat.title} href={stat.href} className="pf-v2-kpi pf-v2-lift">
              <div className="pf-v2-kpi-top">
                <span
                  className="pf-v2-kpi-icon"
                  style={{ background: suave(hex, 0.14), color: hex, boxShadow: `0 0 18px ${suave(hex, 0.3)}` }}
                  aria-hidden="true"
                >
                  {stat.icon}
                </span>
              </div>
              <strong className="pf-v2-stat-value">{stat.value}</strong>
              <span className="pf-v2-stat-label">{stat.title}</span>
              <span className="pf-v2-module-go" style={{ color: hex, display: "block", marginTop: 10 }}>
                {stat.hint} →
              </span>
            </Link>
          );
        })}
      </section>

      {/* ── Mesa operativa + actividad ─────────────────────────── */}
      <section className="pf-v2-grid-split">
        <article className="pf-v2-card">
          <div className="pf-v2-page-head" style={{ marginBottom: 20 }}>
            <div>
              <span className="pf-v2-eyebrow">Mesa operativa</span>
              <h2 className="pf-v2-h2">Alumnos y planes activos</h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/clientes" className="pf-v2-btn">Crear cliente</Link>
              <Link href="/clientes" className="pf-v2-btn pf-v2-btn-2">Asignar entrenamiento</Link>
            </div>
          </div>

          <div className="pf-v2-grid-4" style={{ gap: 10, marginBottom: 20 }}>
            {[
              { label: "Clientes activos", val: operativoKpis.totalAlumnos },
              { label: "Con plan", val: operativoKpis.conPlan },
              { label: "Sin plan", val: operativoKpis.sinPlan },
              { label: "Prescripciones", val: operativoKpis.totalPrescripciones },
            ].map((k, i) => (
              <div key={k.label} className="pf-v2-card" style={{ padding: 16 }}>
                <strong className="pf-v2-stat-value" style={{ fontSize: 24, color: TINTES[i] }}>{k.val}</strong>
                <span className="pf-v2-stat-label">{k.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
            <input
              value={operativoFiltro}
              onChange={(e) => setOperativoFiltro(e.target.value)}
              placeholder="Buscar alumno..."
              className="pf-v2-input"
              style={{ maxWidth: 280 }}
              aria-label="Buscar alumno"
            />
            <Link href="/clientes" className="pf-v2-module-go" style={{ color: "var(--v2-accent)" }}>
              Ver módulo clientes →
            </Link>
          </div>

          <div className="pf-v2-table-wrap">
            <table className="pf-v2-table">
              <thead>
                <tr>
                  {["Alumno", "Estado", "Objetivo", "Sesiones", "Últ. act.", ""].map((h, i) => (
                    <th key={h || `col-${i}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alumnosOperativos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="pf-v2-table-empty">No hay alumnos con el filtro actual.</td>
                  </tr>
                ) : (
                  alumnosOperativos.slice(0, 8).map((alumno) => (
                    <tr key={alumno.nombre}>
                      <td>{alumno.nombre}</td>
                      <td>
                        <span className={`pf-v2-chip ${alumno.estado === "Con plan" ? "pf-v2-chip-ok" : "pf-v2-chip-danger"}`}>
                          {alumno.estado}
                        </span>
                      </td>
                      <td>{alumno.objetivo}</td>
                      <td>
                        {alumno.sesiones}
                        <span style={{ color: "var(--v2-fg-35)", marginLeft: 4 }}>({alumno.prescripciones})</span>
                      </td>
                      <td>
                        {alumno.ultimaActualizacion
                          ? new Date(alumno.ultimaActualizacion).toLocaleDateString("es-AR")
                          : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href="/semana" className="pf-v2-module-go" style={{ color: "var(--v2-accent)" }}>
                          Templates →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <div style={{ display: "grid", gap: 20 }}>
          {/* Sesión del día */}
          <article className="pf-v2-card">
            <div className="pf-v2-page-head" style={{ marginBottom: 14 }}>
              {editando ? (
                <input
                  value={config.radarTitulo}
                  onChange={(e) => setConfig({ ...config, radarTitulo: e.target.value })}
                  className="pf-v2-input"
                />
              ) : (
                <h2 className="pf-v2-h2">{config.radarTitulo}</h2>
              )}
              {editando ? (
                <input
                  value={config.diaLabel}
                  onChange={(e) => setConfig({ ...config, diaLabel: e.target.value })}
                  className="pf-v2-input"
                  style={{ maxWidth: 90 }}
                />
              ) : (
                <span className="pf-v2-chip pf-v2-chip-accent">{config.diaLabel}</span>
              )}
            </div>

            {editando ? (
              <textarea
                value={config.radarDetalle}
                onChange={(e) => setConfig({ ...config, radarDetalle: e.target.value })}
                className="pf-v2-input"
                rows={2}
                style={{ marginBottom: 14 }}
              />
            ) : (
              <p className="pf-v2-muted" style={{ marginBottom: 14 }}>{config.radarDetalle}</p>
            )}

            <div className="pf-v2-grid-3" style={{ gap: 10 }}>
              {[
                { label: "Equipo", value: config.equipo, onChange: (v: string) => setConfig({ ...config, equipo: v }) },
                { label: "Duración", value: config.duracion, onChange: (v: string) => setConfig({ ...config, duracion: v }) },
                { label: "Bloques", value: config.bloques, onChange: (v: string) => setConfig({ ...config, bloques: v }) },
              ].map((item) => (
                <div key={item.label} className="pf-v2-card" style={{ padding: 14 }}>
                  <span className="pf-v2-stat-label">{item.label}</span>
                  {editando ? (
                    <input value={item.value} onChange={(e) => item.onChange(e.target.value)} className="pf-v2-input" />
                  ) : (
                    <strong style={{ display: "block", fontSize: 14, fontWeight: 700, marginTop: 4 }}>{item.value}</strong>
                  )}
                </div>
              ))}
            </div>

            <div className="pf-v2-card" style={{ padding: 14, marginTop: 10 }}>
              <span className="pf-v2-stat-label">Objetivo</span>
              {editando ? (
                <textarea
                  value={config.objetivo}
                  onChange={(e) => setConfig({ ...config, objetivo: e.target.value })}
                  className="pf-v2-input"
                  rows={2}
                />
              ) : (
                <p style={{ fontSize: 13, color: "var(--v2-fg-70)", margin: "4px 0 0" }}>{config.objetivo}</p>
              )}
            </div>
          </article>

          {/* Alertas */}
          <article className="pf-v2-card">
            <div className="pf-v2-page-head" style={{ marginBottom: 14 }}>
              <div>
                <span className="pf-v2-eyebrow" style={{ color: "var(--v2-warning)" }}>Atención</span>
                <h2 className="pf-v2-h2">Alertas</h2>
              </div>
              {editando ? (
                <ReliableActionButton onClick={addAlerta} className="pf-v2-btn pf-v2-btn-2">
                  + Alerta
                </ReliableActionButton>
              ) : null}
            </div>

            {config.alertas.length === 0 ? (
              <p className="pf-v2-muted" style={{ margin: 0 }}>Sin alertas activas.</p>
            ) : (
              <ul className="pf-v2-feed">
                {config.alertas.map((alerta, index) => (
                  <li key={index}>
                    <span className="pf-v2-feed-dot" style={{ color: "var(--v2-warning)" }} aria-hidden="true" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {editando ? (
                        <>
                          <input
                            value={alerta.nombre}
                            onChange={(e) => updateAlerta(index, { nombre: e.target.value })}
                            className="pf-v2-input"
                            style={{ marginBottom: 6 }}
                          />
                          <input
                            value={alerta.detalle}
                            onChange={(e) => updateAlerta(index, { detalle: e.target.value })}
                            className="pf-v2-input"
                          />
                          <ReliableActionButton
                            onClick={() => removeAlerta(index)}
                            className="pf-v2-module-go"
                            style={{ color: "var(--v2-danger)", marginTop: 8, background: "none", border: 0, cursor: "pointer" }}
                          >
                            Eliminar
                          </ReliableActionButton>
                        </>
                      ) : (
                        <>
                          <span className="pf-v2-feed-title">{alerta.nombre}</span>
                          <span className="pf-v2-feed-meta">{alerta.detalle}</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>

      {/* ── Categorías ─────────────────────────────────────────── */}
      <section className="pf-v2-card">
        <div className="pf-v2-page-head" style={{ marginBottom: 18 }}>
          <div>
            <span className="pf-v2-eyebrow">Acceso rápido</span>
            <h2 className="pf-v2-h2">Categorías</h2>
          </div>
          <Link href="/categorias" className="pf-v2-module-go" style={{ color: "var(--v2-accent)" }}>
            Ver todas →
          </Link>
        </div>

        {categoriasActivas.length === 0 ? (
          <p className="pf-v2-muted" style={{ margin: 0 }}>No hay categorías habilitadas.</p>
        ) : (
          <div className="pf-v2-grid-4">
            {categoriasActivas.map((categoria, index) => {
              const hex = TINTES[index % TINTES.length];
              return (
                <Link
                  key={categoria.nombre}
                  href={`/categorias/${encodeURIComponent(categoria.nombre)}`}
                  className="pf-v2-module pf-v2-lift"
                >
                  <span
                    className="pf-v2-module-icon"
                    style={{ background: suave(hex, 0.14), color: hex, boxShadow: `0 0 18px ${suave(hex, 0.3)}` }}
                    aria-hidden="true"
                  >
                    {CATEGORY_ICONS[index % CATEGORY_ICONS.length]}
                  </span>
                  <span>
                    <span className="pf-v2-module-name">{categoria.nombre}</span>
                  </span>
                  <span className="pf-v2-module-go" style={{ color: hex }}>Abrir →</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Módulos ────────────────────────────────────────────── */}
      <section className="pf-v2-card">
        <div className="pf-v2-page-head" style={{ marginBottom: 18 }}>
          <div>
            <span className="pf-v2-eyebrow">Accesos</span>
            <h2 className="pf-v2-h2">Módulos</h2>
          </div>
          {editando ? (
            <ReliableActionButton onClick={addModulo} className="pf-v2-btn pf-v2-btn-2">
              + Módulo
            </ReliableActionButton>
          ) : null}
        </div>

        <div className="pf-v2-grid-4">
          {config.modulos.filter((item) => !isWellnessModulo(item)).map((item, index) => {
            const hex = TINTES[index % TINTES.length];

            if (editando) {
              return (
                <div key={`${item.label}-${index}`} className="pf-v2-card" style={{ padding: 16 }}>
                  <input
                    value={item.label}
                    onChange={(e) => updateModulo(index, { label: e.target.value })}
                    className="pf-v2-input"
                    style={{ marginBottom: 8 }}
                  />
                  <input
                    value={item.href}
                    onChange={(e) => updateModulo(index, { href: e.target.value })}
                    className="pf-v2-input"
                    style={{ marginBottom: 8 }}
                  />
                  <textarea
                    value={item.desc}
                    onChange={(e) => updateModulo(index, { desc: e.target.value })}
                    className="pf-v2-input"
                    rows={2}
                  />
                  <ReliableActionButton
                    onClick={() => removeModulo(index)}
                    className="pf-v2-module-go"
                    style={{ color: "var(--v2-danger)", marginTop: 8, background: "none", border: 0, cursor: "pointer" }}
                  >
                    Eliminar
                  </ReliableActionButton>
                </div>
              );
            }

            return (
              <Link
                key={`${item.label}-${index}`}
                href={resolveActionHref(item.href, item.label, guessAppHrefByLabel(item.label) || "/")}
                className="pf-v2-module pf-v2-lift"
              >
                <span
                  className="pf-v2-module-icon"
                  style={{ background: suave(hex, 0.14), color: hex, boxShadow: `0 0 18px ${suave(hex, 0.3)}` }}
                  aria-hidden="true"
                >
                  {item.label.slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <span className="pf-v2-module-name">{item.label}</span>
                  <span className="pf-v2-module-desc">{item.desc}</span>
                </span>
                <span className="pf-v2-module-go" style={{ color: hex }}>Abrir →</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
