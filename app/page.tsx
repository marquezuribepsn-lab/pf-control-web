"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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
  /** Frase motivacional del hero, segunda linea en cian (handoff: Inicio). */
  lema?: string;
  /** Foto del gimnasio del hero (data URL o ruta). El handoff la trae de un
      `image-slot`; aca la carga el profe desde el modo edicion. */
  heroImagen?: string;
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
  lema: "Hoy toca subir el nivel.",
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
  const { data: session } = useSession();
  const { alumnos } = useAlumnos();
  const { sesiones } = useSessions();
  const { jugadoras } = usePlayers();
  const { wellness } = useWellness();
  const [configMode, setConfigMode] = useState(false);
  const [editando, setEditando] = useState(false);
  const [operativoFiltro, setOperativoFiltro] = useState("");
  const [config, setConfig] = useState<HomeConfig>(defaultConfig);
  // Modal "Alumnos en linea" del hero (handoff: Inicio.dc.html).
  const [mostrarEnLinea, setMostrarEnLinea] = useState(false);
  const [presencia, setPresencia] = useState<Record<string, { isOnline: boolean; lastSeenAt: string | null }>>({});
  const [ahora, setAhora] = useState<Date | null>(null);
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

  // El reloj arranca en null para no desincronizar la hidratacion.
  useEffect(() => {
    setAhora(new Date());
    const id = window.setInterval(() => setAhora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Conexiones reales: /api/presence resuelve por email y devuelve isOnline.
  const emailsAlumnos = useMemo(
    () =>
      alumnos
        .map((a) => String((a as { email?: string | null }).email || "").trim().toLowerCase())
        .filter(Boolean),
    [alumnos]
  );

  useEffect(() => {
    if (emailsAlumnos.length === 0) return;

    let vivo = true;
    const consultar = async () => {
      try {
        const query = encodeURIComponent(emailsAlumnos.join(","));
        const res = await fetch(`/api/presence?emails=${query}&includeCurrent=0`);
        if (!res.ok) return;
        const data = (await res.json()) as { byEmail?: Record<string, { isOnline?: boolean; lastSeenAt?: string | null }> };
        if (!vivo) return;
        const mapa: Record<string, { isOnline: boolean; lastSeenAt: string | null }> = {};
        for (const [email, snap] of Object.entries(data.byEmail || {})) {
          mapa[email] = { isOnline: !!snap?.isOnline, lastSeenAt: snap?.lastSeenAt ?? null };
        }
        setPresencia(mapa);
      } catch {
        // Sin presencia se muestran todos como desconectados; no vale romper la pantalla.
      }
    };

    void consultar();
    const id = window.setInterval(consultar, 45_000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [emailsAlumnos]);

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

  const profileNombre = String(
    (session?.user as { name?: string | null } | undefined)?.name || ""
  ).trim();

  const wellnessPromedio = (() => {
    const lista = Array.isArray(wellness) ? wellness : [];
    if (lista.length === 0) return "-";
    return (lista.reduce((a, i) => a + Number(i.bienestar || 0), 0) / lista.length).toFixed(1);
  })();

  // ── Datos del dashboard del handoff ─────────────────────────────────────

  const DIAS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const fechaLarga = ahora
    ? `${DIAS[ahora.getDay()]}, ${ahora.getDate()} de ${MESES[ahora.getMonth()]} de ${ahora.getFullYear()}`.toUpperCase()
    : "";

  const saludo = (() => {
    const h = ahora ? ahora.getHours() : 9;
    if (h < 12) return "Buenos dias";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  })();

  // Conexiones: los alumnos ordenados por estado y ultima actividad.
  const conexiones = useMemo(() => {
    const lista = alumnos.map((alumno) => {
      const email = String((alumno as { email?: string | null }).email || "").trim().toLowerCase();
      const snap = email ? presencia[email] : undefined;
      const nombre = String(alumno.nombre || "").trim();
      return {
        nombre,
        inicial: nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?",
        enLinea: !!snap?.isOnline,
        visto: snap?.lastSeenAt ?? null,
      };
    });

    return lista.sort((a, b) => {
      if (a.enLinea !== b.enLinea) return a.enLinea ? -1 : 1;
      return (b.visto || "").localeCompare(a.visto || "");
    });
  }, [alumnos, presencia]);

  const enLinea = conexiones.filter((c) => c.enLinea);

  /** "hace 3 min", "ayer". Vacio si nunca se lo vio. */
  const desdeHace = (iso: string | null): string => {
    if (!iso || !ahora) return "sin registro";
    const min = Math.round((ahora.getTime() - new Date(iso).getTime()) / 60000);
    if (!Number.isFinite(min) || min < 0) return "sin registro";
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${min} min`;
    const hs = Math.round(min / 60);
    if (hs < 24) return `hace ${hs} h`;
    const dias = Math.round(hs / 24);
    return dias === 1 ? "ayer" : `hace ${dias} dias`;
  };

  /* Feed de actividad. Ojo: ni `Sesion` ni `WellnessItem` guardan fecha
     (ver data/mockData.ts), asi que no se puede ordenar por tiempo ni mostrar
     "hace 2h" como en el handoff. Se listan los ultimos cargados y la linea
     secundaria lleva el dato real que si existe, en vez de una fecha inventada. */
  const actividad = useMemo(() => {
    const items: Array<{ titulo: string; meta: string; hex: string }> = [];

    const wellnessList = Array.isArray(wellness) ? wellness : [];
    for (const w of [...wellnessList].reverse().slice(0, 2)) {
      const valor = Number(w.bienestar);
      const bajo = Number.isFinite(valor) && valor <= 5;
      items.push({
        titulo: `${w.nombre || "Alumno"} reporto bienestar ${Number.isFinite(valor) ? valor : "-"}/10`,
        meta: w.disponibilidad || (bajo ? "Requiere seguimiento" : "Disponible"),
        hex: bajo ? "#f87171" : "#34d399",
      });
    }

    for (const sesion of [...sesiones].reverse().slice(0, 2)) {
      items.push({
        titulo: `Sesion "${sesion.titulo || "sin titulo"}"`,
        meta: [sesion.alumnoAsignado || sesion.jugadoraAsignada || sesion.equipo, sesion.objetivo]
          .filter(Boolean)
          .join(" - ") || "sin asignar",
        hex: "#38bdf8",
      });
    }

    return items.slice(0, 4);
  }, [wellness, sesiones]);

  // Paleta por tarjeta, del handoff v2.
  const TINTES = ["#22e5ff", "#34d399", "#c084fc", "#fbbf24"];
  const suave = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  /** Path SVG de 120x30 a partir de una serie. Null si no alcanza para una linea. */
  const sparkline = (serie: number[]): string | null => {
    const vals = serie.filter((n) => Number.isFinite(n));
    if (vals.length < 2) return null;
    const min = Math.min(...vals), max = Math.max(...vals);
    const rango = max - min || 1;
    const paso = 120 / (vals.length - 1);
    return vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${(i * paso).toFixed(1)} ${(26 - ((v - min) / rango) * 22).toFixed(1)}`)
      .join(" ");
  };

  const indicadores = useMemo(() => {
    const categorias = (categoriesContext?.categorias || []).filter(
      (c) => c.habilitada && c.nombre.toLowerCase() !== "wellness"
    ).length;

    return [
      { title: "Categorías activas", value: String(categorias), href: "/categorias", icon: "◈", hint: "Abrir mapa de categorías", hex: TINTES[0], spark: null },
      { title: "Jugadoras / alumnos", value: String(jugadoras.length + alumnos.length), href: "/clientes?seccion=plantel", icon: "◉", hint: "Ver plantilla operativa", hex: TINTES[1], spark: null },
      { title: "Sesiones creadas", value: String(sesiones.length), href: "/sesiones", icon: "▤", hint: "Ir a sesiones", hex: TINTES[2], spark: null },
      {
        title: "Wellness promedio",
        value: wellnessPromedio,
        href: "/wellness",
        icon: "◐",
        hint: "Revisar balance de carga",
        hex: TINTES[3],
        spark: sparkline((Array.isArray(wellness) ? wellness : []).map((w) => Number(w.bienestar))),
      },
    ];
  }, [categoriesContext, jugadoras.length, alumnos.length, sesiones.length, wellnessPromedio, wellness]);

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

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="pf-v2-hero-card">
        <div className="pf-v2-hero-row">
          <div style={{ minWidth: 0 }}>
            <span className="pf-v2-hero-date" suppressHydrationWarning>{fechaLarga || " "}</span>

            {editando ? (
              <input
                value={config.lema ?? defaultConfig.lema ?? ""}
                onChange={(e) => setConfig({ ...config, lema: e.target.value })}
                className="pf-v2-input"
                style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}
              />
            ) : (
              <h1 className="pf-v2-hero-h1" suppressHydrationWarning>
                {saludo}, {(profileNombre || "profe").split(" ")[0]}.
                <br />
                <span>{config.lema || defaultConfig.lema}</span>
              </h1>
            )}

            {editando ? (
              <textarea
                value={config.subtitulo}
                onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })}
                className="pf-v2-input"
                rows={2}
                style={{ marginBottom: 26, maxWidth: 480 }}
              />
            ) : (
              <p className="pf-v2-hero-lead">
                {alumnos.length + jugadoras.length} atletas activos, {sesiones.length}{" "}
                {sesiones.length === 1 ? "sesión creada" : "sesiones creadas"} y una wellness promedio de{" "}
                {wellnessPromedio}/10 — todo desde un solo panel.
              </p>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ReliableActionButton
                type="button"
                onClick={() => setMostrarEnLinea(true)}
                className="pf-v2-btn"
                style={{ padding: "15px 26px", borderRadius: 14 }}
              >
                <span className="pf-v2-pulse" style={{ color: "var(--v2-on-accent)" }} aria-hidden="true" />
                Ver alumnos en línea
              </ReliableActionButton>
              <Link
                href="/clientes"
                className="pf-v2-btn pf-v2-btn-2"
                style={{ padding: "15px 26px", borderRadius: 14 }}
              >
                Ver clientes
              </Link>
            </div>
          </div>

          {/* Foto del gimnasio. El handoff la trae de un image-slot; acá sale
              de la config para que el profe pueda cambiarla. */}
          <div className="pf-v2-hero-photo">
            {config.heroImagen ? <img src={config.heroImagen} alt="" /> : null}
            <div className="pf-v2-hero-photo-caption">
              <span className="pf-v2-kicker" style={{ marginBottom: 4 }}>{config.badge}</span>
              <span style={{ fontFamily: "var(--v2-display)", fontSize: 15, fontWeight: 700, color: "#f5f9ff" }}>
                Entrená donde entrenás.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Indicadores ────────────────────────────────────────── */}
      <section className="pf-v2-grid-4">
        {indicadores.map((k) => (
          <Link key={k.title} href={k.href} className="pf-v2-kpi pf-v2-lift">
            <div className="pf-v2-kpi-top">
              <span
                className="pf-v2-kpi-icon"
                style={{ background: suave(k.hex, 0.14), color: k.hex, boxShadow: `0 0 18px ${suave(k.hex, 0.3)}` }}
                aria-hidden="true"
              >
                {k.icon}
              </span>
            </div>
            <strong className="pf-v2-stat-value">{k.value}</strong>
            <span className="pf-v2-stat-label" style={{ marginBottom: 14 }}>{k.title}</span>
            {k.spark ? (
              <svg width="100%" height="30" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">
                <path d={k.spark} fill="none" stroke={k.hex} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
            <span className="pf-v2-module-go" style={{ color: k.hex }}>{k.hint} →</span>
          </Link>
        ))}
      </section>

      {/* ── Conexiones + actividad ─────────────────────────────── */}
      <section className="pf-v2-grid-split">
        <article className="pf-v2-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
            <div>
              <span className="pf-v2-kicker">En vivo</span>
              <h2 className="pf-v2-h2">Conexiones de clientes</h2>
            </div>
            <span
              className="pf-v2-chip pf-v2-chip-ok"
              style={{ display: "flex", alignItems: "center", gap: 7 }}
              suppressHydrationWarning
            >
              <span className="pf-v2-pulse" aria-hidden="true" />
              {enLinea.length} en línea
            </span>
          </div>

          {conexiones.length === 0 ? (
            <p className="pf-v2-muted" style={{ margin: 0 }}>Todavía no hay alumnos cargados.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {conexiones.slice(0, 6).map((c) => (
                <div key={c.nombre} className="pf-v2-live-row">
                  <span className="pf-v2-avatar" data-online={c.enLinea} aria-hidden="true">{c.inicial}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{c.nombre}</span>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: c.enLinea ? "var(--v2-success)" : "var(--v2-fg-40)" }}>
                      {c.enLinea ? "En línea" : "Desconectada"}
                    </span>
                    <span style={{ display: "block", fontSize: 10.5, color: "var(--v2-fg-35)" }} suppressHydrationWarning>
                      {desdeHace(c.visto)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="pf-v2-card">
          <span className="pf-v2-kicker">Actividad</span>
          <h2 className="pf-v2-h2" style={{ marginBottom: 20 }}>Últimos movimientos</h2>

          {actividad.length === 0 ? (
            <p className="pf-v2-muted" style={{ margin: 0 }}>Sin movimientos registrados.</p>
          ) : (
            <ul className="pf-v2-feed">
              {actividad.map((a, i) => (
                <li key={`${a.titulo}-${i}`}>
                  <span className="pf-v2-feed-dot" style={{ color: a.hex }} aria-hidden="true" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span className="pf-v2-feed-title">{a.titulo}</span>
                    <span className="pf-v2-feed-meta">{a.meta}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {/* ── Módulos ────────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div>
            <span className="pf-v2-kicker">Accesos</span>
            <h2 className="pf-v2-h2" style={{ fontSize: 20 }}>Módulos</h2>
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

      {/* ── Modal "Alumnos en línea" ───────────────────────────── */}
      {mostrarEnLinea ? (
        <div
          className="pf-v2-modal-backdrop"
          onClick={() => setMostrarEnLinea(false)}
          role="presentation"
        >
          <div
            className="pf-v2-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Alumnos en línea"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 className="pf-v2-h2">Alumnos en línea</h2>
              <button
                type="button"
                className="pf-v2-modal-close"
                onClick={() => setMostrarEnLinea(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <p className="pf-v2-muted" style={{ margin: "0 0 20px" }}>
              {enLinea.length === 0
                ? "Nadie conectado ahora mismo."
                : `${enLinea.length} ${enLinea.length === 1 ? "conectado" : "conectados"} ahora mismo.`}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {enLinea.map((o) => (
                <div key={o.nombre} className="pf-v2-modal-row">
                  <span className="pf-v2-avatar" data-online="true" aria-hidden="true">{o.inicial}</span>
                  <div>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{o.nombre}</span>
                    <span className="pf-v2-feed-meta">En línea</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
