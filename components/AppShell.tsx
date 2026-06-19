"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import AdminRunningLoaderOverlay from "@/components/admin/AdminRunningLoader";
import { useMinimumLoading } from "@/components/admin/useMinimumLoading";
import Link from "@/components/ReliableLink";
import { installButtonFailsafe } from "@/lib/buttonFailsafe";
import { neutralizeViewportBlockers } from "@/lib/interactionGuard";
import {
  SIDEBAR_WIDGET_DEFAULT_TRANSITION_MS,
  SIDEBAR_WIDGET_OPTIONS,
  SIDEBAR_WIDGET_SETTINGS_EVENT,
  SIDEBAR_WIDGET_SETTINGS_KEY,
  normalizeSidebarWidgetSettings,
  type SidebarWidgetSettings,
} from "@/lib/sidebarWidget";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAlumnos } from "./AlumnosProvider";
import { usePlayers } from "./PlayersProvider";
import { useSessions } from "./SessionsProvider";
import { getPendingSaveStatus, useSharedState } from "./useSharedState";

type NavLink = {
  href: string;
  label: string;
  icon: string;
  tone: string;
  adminOnly?: boolean;
  clientOnly?: boolean;
};

type AppShellProps = {
  links: NavLink[];
  children: ReactNode;
  initialRole?: string | null;
  initialEstado?: string | null;
  initialProfileName?: string | null;
  initialSidebarImage?: string | null;
};

type InlineToast = {
  id: number;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  phase: "enter" | "exit";
};

type UserLike = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
  estado?: string | null;
};

type ProfesorContacto = {
  id: string;
  nombre: string;
  role: string;
  telefono: string;
  waPhone: string;
  source: string;
};

type WindowWithDockSmokeToken = Window & {
  __pfDockSmokeToken?: string;
};

type ClienteMetaSnapshot = {
  pagoEstado?: "confirmado" | "pendiente" | string;
  importe?: string | number | null;
};

type AsistenciaRegistroSnapshot = {
  estado?: "presente" | "ausente" | string;
};

type SidebarWidgetItem = {
  id: string;
  href: string;
  label: string;
  icon: string;
  value: string;
  detail: string;
  toneClass: string;
};

type ThemeMode = "dark" | "light";

const SIDEBAR_IMAGE_KEY = "pf-control-sidebar-image-v1";
const SIDEBAR_ROLE_KEY = "pf-control-sidebar-role-v1";
const SIDEBAR_PROFILE_NAME_KEY = "pf-control-sidebar-profile-name-v1";
const SIDEBAR_PROFILE_ROLE_KEY = "pf-control-sidebar-profile-role-v1";
const SCREEN_SCALE_KEY = "pf-control-screen-scale-v1";
const SCREEN_SCALE_EVENT = "pf-screen-scale-updated";
const THEME_MODE_KEY = "pf-control-theme-mode-v1";
const THEME_MODE_EVENT = "pf-theme-mode-updated";
const ACCENT_COLOR_KEY = "pf-control-accent-color-v1";
const ACCENT_COLOR_EVENT = "pf-accent-color-updated";
const DEFAULT_ACCENT_COLOR = "#2563eb"; // Harbiz royal blue
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const applyAccentColorToRoot = (color: string | null | undefined) => {
  if (typeof document === "undefined") return;
  const target = (color && HEX_RE.test(color)) ? color : DEFAULT_ACCENT_COLOR;
  document.documentElement.style.setProperty("--gym-accent", target);
};
const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const ASISTENCIAS_REGISTROS_KEY = "pf-control-asistencias-registros-v1";
const SIDEBAR_NAV_OPTIMISTIC_MS = 1400;
const SIDEBAR_WIDGET_FADE_MS = 260;
const ACCOUNT_SNAPSHOT_SYNC_MS = 120000;
const APP_TRANSITION_MIN_MS = 350;
const TRANSPARENT_PIXEL_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const WIDGET_TONE_CLASS_BY_ID: Record<string, string> = {
  "pending-saves": "border-amber-300/45 bg-gradient-to-br from-amber-500/20 via-slate-900/75 to-orange-500/22",
  "payments-completed": "border-emerald-300/45 bg-gradient-to-br from-emerald-500/22 via-slate-900/75 to-cyan-500/20",
  "payments-pending": "border-rose-300/45 bg-gradient-to-br from-rose-500/20 via-slate-900/75 to-amber-500/20",
  "attendance-rate": "border-cyan-300/45 bg-gradient-to-br from-cyan-500/20 via-slate-900/75 to-blue-500/20",
  "sessions-loaded": "border-violet-300/40 bg-gradient-to-br from-violet-500/20 via-slate-900/75 to-indigo-500/20",
  "active-clients": "border-lime-300/40 bg-gradient-to-br from-lime-500/20 via-slate-900/75 to-emerald-500/20",
};

const TONE_RGB_BY_NAME: Record<string, string> = {
  cyan: "56,189,248",
  blue: "59,130,246",
  violet: "139,92,246",
  purple: "168,85,247",
  teal: "20,184,166",
  amber: "245,158,11",
  orange: "249,115,22",
  rose: "244,63,94",
  red: "239,68,68",
  emerald: "16,185,129",
  lime: "132,204,22",
  sky: "14,165,233",
  indigo: "99,102,241",
  slate: "100,116,139",
  gray: "107,114,128",
  fuchsia: "217,70,239",
  pink: "236,72,153",
  green: "34,197,94",
};

const COLABORADOR_ACCESS_HREFS = [
  "/plantel",
  "/semana",
  "/sesiones",
  "/asistencias",
  "/ejercicios",
  "/registros",
  "/adherencia",
  "/calendario",
  "/alertas",
  "/categorias",
  "/deportes",
  "/equipos",
  "/clientes",
  "/clientes/musica",
  "/clientes/playlists",
  "/mensajes",
];

const COLABORADOR_CATEGORY_HREFS = ["/categorias", "/deportes", "/equipos"];
const CLIENTE_ACCESS_HREFS = [
  "/alumnos/inicio",
  "/alumnos/rutina",
  "/alumnos/nutricion",
  "/alumnos/progreso",
  "/alumnos/musica",
];

const ADMIN_SIDEBAR_LOCK_ORDER = [
  "/",
  "/semana",
  "/asistencias",
  "/admin/pagos",
  "/categorias",
  "/categorias/Nutricion",
  "/deportes",
  "/equipos",
  "/clientes",
  "/clientes/musica",
  "/admin/usuarios",
  "/admin/whatsapp",
  "/configuracion",
];

const ADMIN_SIDEBAR_LOCK_INDEX = ADMIN_SIDEBAR_LOCK_ORDER.reduce<Record<string, number>>(
  (acc, href, index) => {
    const path = href.split("?")[0] || "/";
    const normalizedHref = path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
    acc[normalizedHref] = index;
    return acc;
  },
  {}
);

const normalizePath = (value: string) => {
  const path = value.split("?")[0] || "/";
  if (path !== "/" && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
};

const resolveKnownUserDisplayName = (user?: UserLike | null): string | null => {
  const fromName = typeof user?.name === "string" ? user.name.trim() : "";
  if (fromName) return fromName;

  const fromEmail = typeof user?.email === "string" ? user.email.split("@")[0]?.trim() : "";
  if (fromEmail) return fromEmail;

  return null;
};

const resolveUserDisplayName = (user?: UserLike | null): string => {
  const resolved = resolveKnownUserDisplayName(user);
  if (resolved) return resolved;

  return "Usuario";
};

const resolveInitials = (name: string): string => {
  const words = name
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
};

const roleToLabel = (role: string | null | undefined): string => {
  if (role === "ADMIN") return "ADMIN";
  if (role === "COLABORADOR") return "COLAB";
  if (role === "CLIENTE") return "ALUMNO";
  return "USUARIO";
};

const compactSidebarLabel = (label: string): string => {
  const aliases: Record<string, string> = {
    "Asistencias": "Asist.",
    "Configuracion": "Config.",
    "Configuración": "Config.",
    "Usuarios y permisos": "Usuarios",
    "Admin colaboradores": "Colabs",
    "Cerrar sesión": "Salir",
  };

  return aliases[label] || label;
};

const formatPendingKeyLabel = (key: string) => {
  const keyLabels: Record<string, string> = {
    "pf-control-nutricion-planes-v1": "Nutricion · Planes",
    "pf-control-nutricion-alimentos-v1": "Nutricion · Alimentos",
    "pf-control-nutricion-asignaciones-v1": "Nutricion · Asignaciones",
    "pf-control-clientes-meta-v1": "Clientes · Fichas",
    "pf-control-pagos-v1": "Clientes · Pagos",
    "pf-control-sesiones": "Sesiones",
    "pf-control-semana-plan": "Templates · Plan",
    "pf-control-alumno-week-notifications": "Templates · Alertas",
    "pf-control-asistencias-jornadas-v1": "Asistencias · Jornadas",
    "pf-control-asistencias-registros-v1": "Asistencias · Registros",
    "pf-control-alumnos": "Alumnos",
    "pf-control-jugadoras": "Jugadoras",
    "pf-control-categorias": "Categorias",
    "pf-control-deportes": "Deportes",
    "pf-control-ejercicios": "Ejercicios",
    "pf-control-equipos": "Equipos",
    "pf-control-wellness": "Wellness",
  };

  if (keyLabels[key]) {
    return keyLabels[key];
  }

  const normalized = key
    .replace(/^pf-control-/, "")
    .replace(/-v\d+$/, "")
    .replace(/-/g, " ")
    .trim();

  if (!normalized) return key;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const lockAdminSidebarLinks = (links: NavLink[]): NavLink[] => {
  const seen = new Set<string>();
  const deduped = links.filter((link) => {
    const normalizedHref = normalizePath(link.href);
    if (seen.has(normalizedHref)) {
      return false;
    }

    seen.add(normalizedHref);
    return true;
  });

  return deduped
    .map((link, fallbackIndex) => ({
      link,
      fallbackIndex,
      normalizedHref: normalizePath(link.href),
    }))
    .sort((a, b) => {
      const orderA = ADMIN_SIDEBAR_LOCK_INDEX[a.normalizedHref] ?? Number.MAX_SAFE_INTEGER;
      const orderB = ADMIN_SIDEBAR_LOCK_INDEX[b.normalizedHref] ?? Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.fallbackIndex - b.fallbackIndex;
    })
    .map((item) => item.link);
};

const parseMoneyValue = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const formatCurrency = (value: number): string => {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `$${Math.round(safeValue).toLocaleString("es-AR")}`;
};

const clampScreenScale = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  if (value < 0.8) return 0.8;
  if (value > 1.35) return 1.35;
  return Number(value.toFixed(2));
};

const normalizeThemeMode = (value: unknown): ThemeMode => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "light") return "light";
  if (normalized === "dark") return "dark";
  // No explicit stored preference → respect OS/browser setting
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
};

const isMobileLikeViewport = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const narrowViewport = window.matchMedia("(max-width: 1024px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const tabletViewport = coarsePointer && window.innerWidth <= 1400;

  const userAgent =
    typeof navigator !== "undefined" ? String(navigator.userAgent || "") : "";
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(userAgent);

  const mobileWebViewClass =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("pf-mobile-webview") ||
      document.documentElement.classList.contains("pf-mobile-fluid"));

  return narrowViewport || tabletViewport || mobileUserAgent || mobileWebViewClass;
};

const applyThemeMode = (mode: ThemeMode) => {
  if (typeof document === "undefined") return;

  const resolved = normalizeThemeMode(mode);
  document.documentElement.setAttribute("data-pf-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
};

const applyScreenScale = (value: number) => {
  if (typeof document === "undefined") return;

  if (isMobileLikeViewport()) {
    document.documentElement.style.setProperty("--pf-screen-scale", "1");
    return;
  }

  document.documentElement.style.setProperty("--pf-screen-scale", String(clampScreenScale(value)));
};

const normalizeSidebarImageValue = (value: string | null | undefined): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const resolveToneEndpointColor = (tone: string | undefined, endpoint: "from" | "to") => {
  const match = String(tone || "").match(new RegExp(`\\b${endpoint}-([a-z]+)-\\d{2,3}\\b`, "i"));
  const toneName = String(match?.[1] || "").toLowerCase();
  const rgb = TONE_RGB_BY_NAME[toneName];
  if (!rgb) {
    return null;
  }

  return `rgba(${rgb},0.96)`;
};

const resolveSidebarLedColors = (tone: string | undefined) => {
  const fallback = {
    start: "rgba(232,154,127,0.96)",
    end: "rgba(204,120,92,0.96)",
  };

  const start = resolveToneEndpointColor(tone, "from") || fallback.start;
  const end = resolveToneEndpointColor(tone, "to") || fallback.end;

  return { start, end };
};

export default function AppShell({
  links,
  children,
  initialRole = null,
  initialEstado = null,
  initialProfileName = null,
  initialSidebarImage = null,
}: AppShellProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { jugadoras } = usePlayers();
  const { alumnos } = useAlumnos();
  const { sesiones } = useSessions();
  const [clientesMeta] = useSharedState<Record<string, ClienteMetaSnapshot>>({}, {
    key: CLIENTE_META_KEY,
    legacyLocalStorageKey: CLIENTE_META_KEY,
    pollMs: 60000,
  });
  const [asistenciaRegistros] = useSharedState<AsistenciaRegistroSnapshot[]>([], {
    key: ASISTENCIAS_REGISTROS_KEY,
    legacyLocalStorageKey: ASISTENCIAS_REGISTROS_KEY,
    pollMs: 60000,
  });
  const interactionGuardLastRunRef = useRef(0);
  const optimisticNavResetTimerRef = useRef<number | null>(null);
  const widgetTransitionTimeoutRef = useRef<number | null>(null);
  const sidebarNavFallbackTimerRef = useRef<number | null>(null);
  const prefetchedSidebarHrefRef = useRef<Set<string>>(new Set());

  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [sidebarImage, setSidebarImage] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return normalizeSidebarImageValue(initialSidebarImage);
    }

    return (
      normalizeSidebarImageValue(window.localStorage.getItem(SIDEBAR_IMAGE_KEY)) ||
      normalizeSidebarImageValue(initialSidebarImage)
    );
  });
  const [resolvedRole, setResolvedRole] = useState<string | null>(initialRole);
  const [resolvedEstado, setResolvedEstado] = useState<string | null>(initialEstado);
  const [cachedProfileName, setCachedProfileName] = useState<string>(() =>
    typeof initialProfileName === "string" ? initialProfileName.trim() : ""
  );
  const [cachedProfileRole, setCachedProfileRole] = useState<string | null>(null);
  const [colaboradorAccessMap, setColaboradorAccessMap] = useState<Record<string, boolean> | null>(null);
  const [toasts, setToasts] = useState<InlineToast[]>([]);
  const [profesorContacto, setProfesorContacto] = useState<ProfesorContacto | null>(null);
  const [profesorContactoLoading, setProfesorContactoLoading] = useState(false);
  const [profesorContactoError, setProfesorContactoError] = useState("");
  const [pendingSaveKeys, setPendingSaveKeys] = useState<string[]>([]);
  const [pendingPanelOpen, setPendingPanelOpen] = useState(false);
  const [optimisticNavHref, setOptimisticNavHref] = useState<string | null>(null);
  const [sidebarWidgetSettings, setSidebarWidgetSettings] = useState<SidebarWidgetSettings>(() =>
    normalizeSidebarWidgetSettings({
      transitionMs: SIDEBAR_WIDGET_DEFAULT_TRANSITION_MS,
      selectedCards: SIDEBAR_WIDGET_OPTIONS.map((option) => option.id),
    })
  );
  const [sidebarWidgetIndex, setSidebarWidgetIndex] = useState(0);
  const [sidebarWidgetPhase, setSidebarWidgetPhase] = useState<"enter" | "exit">("enter");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [clockNow, setClockNow] = useState<Date | null>(null);
  const [alertasCount, setAlertasCount] = useState(0);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    return normalizeThemeMode(window.localStorage.getItem(THEME_MODE_KEY));
  });
  const stableSidebarImageRef = useRef<string | null>(
    normalizeSidebarImageValue(sidebarImage || initialSidebarImage)
  );

  const setSidebarImageStable = (nextImage: string | null | undefined, allowClear = false) => {
    const normalized = normalizeSidebarImageValue(nextImage);

    if (normalized) {
      stableSidebarImageRef.current = normalized;
      setSidebarImage(normalized);
      return;
    }

    if (allowClear) {
      stableSidebarImageRef.current = null;
      setSidebarImage(null);
      return;
    }

    setSidebarImage((current) => current || stableSidebarImageRef.current || null);
  };

  const syncSidebarImageFromStorage = (allowClear = false) => {
    if (typeof window === "undefined") return;
    setSidebarImageStable(window.localStorage.getItem(SIDEBAR_IMAGE_KEY), allowClear);
  };

  const pushToast = (type: InlineToast["type"], message: string, title?: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const resolvedTitle =
      title ||
      (type === "success" ? "Cambios guardados" : type === "warning" ? "Atencion" : "Error");

    setToasts((prev) => [...prev, { id, type, title: resolvedTitle, message, phase: "enter" }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.map((item) => (item.id === id ? { ...item, phase: "exit" } : item)));
    }, 3200);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3850);
  };

  const runInteractionGuard = () => {
    if (typeof window === "undefined") return;

    const now = Date.now();
    if (now - interactionGuardLastRunRef.current < 150) return;
    interactionGuardLastRunRef.current = now;

    const result = neutralizeViewportBlockers();
    if (result.neutralized > 0 && process.env.NODE_ENV !== "production") {
      console.warn("[interaction-guard] bloqueo neutralizado", result);
    }
  };

  const markOptimisticSidebarNav = useCallback((targetHref: string) => {
    const normalizedTarget = normalizePath(targetHref);
    setOptimisticNavHref(normalizedTarget);

    if (optimisticNavResetTimerRef.current !== null) {
      window.clearTimeout(optimisticNavResetTimerRef.current);
      optimisticNavResetTimerRef.current = null;
    }

    optimisticNavResetTimerRef.current = window.setTimeout(() => {
      optimisticNavResetTimerRef.current = null;
      setOptimisticNavHref((current) => (current === normalizedTarget ? null : current));
    }, SIDEBAR_NAV_OPTIMISTIC_MS);
  }, []);

  const scheduleSidebarNavigationFallback = (targetHref: string) => {
    if (typeof window === "undefined") {
      return;
    }

    let resolvedTarget: URL;
    try {
      resolvedTarget = new URL(targetHref, window.location.origin);
    } catch {
      return;
    }

    const fromHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextHref = `${resolvedTarget.pathname}${resolvedTarget.search}${resolvedTarget.hash}`;

    if (!nextHref || nextHref === fromHref) {
      return;
    }

    if (sidebarNavFallbackTimerRef.current !== null) {
      window.clearTimeout(sidebarNavFallbackTimerRef.current);
      sidebarNavFallbackTimerRef.current = null;
    }

    sidebarNavFallbackTimerRef.current = window.setTimeout(() => {
      sidebarNavFallbackTimerRef.current = null;

      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentHref !== fromHref || document.visibilityState !== "visible") {
        return;
      }

      try {
        router.push(nextHref);
      } catch {
        // Keep SPA-only navigation in AppShell to comply with interaction guard policy.
      }
    }, 220);
  };

  const handleSidebarLinkClick = (targetHref: string) => {
    markOptimisticSidebarNav(targetHref);
    scheduleSidebarNavigationFallback(targetHref);
  };

  useEffect(
    () => () => {
      if (optimisticNavResetTimerRef.current !== null) {
        window.clearTimeout(optimisticNavResetTimerRef.current);
        optimisticNavResetTimerRef.current = null;
      }

      if (widgetTransitionTimeoutRef.current !== null) {
        window.clearTimeout(widgetTransitionTimeoutRef.current);
        widgetTransitionTimeoutRef.current = null;
      }

      if (sidebarNavFallbackTimerRef.current !== null) {
        window.clearTimeout(sidebarNavFallbackTimerRef.current);
        sidebarNavFallbackTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    setMounted(true);
    try {
      const initialImageFromServer = normalizeSidebarImageValue(initialSidebarImage);
      const localSidebarImage = normalizeSidebarImageValue(localStorage.getItem(SIDEBAR_IMAGE_KEY));

      if (!localSidebarImage && initialImageFromServer) {
        localStorage.setItem(SIDEBAR_IMAGE_KEY, initialImageFromServer);
      }

      setSidebarImageStable(localSidebarImage || initialImageFromServer);
      syncSidebarImageFromStorage();

      const rawWidgetSettings = localStorage.getItem(SIDEBAR_WIDGET_SETTINGS_KEY);
      if (rawWidgetSettings) {
        try {
          setSidebarWidgetSettings(normalizeSidebarWidgetSettings(JSON.parse(rawWidgetSettings)));
        } catch {
          setSidebarWidgetSettings(normalizeSidebarWidgetSettings(null));
        }
      } else {
        setSidebarWidgetSettings(normalizeSidebarWidgetSettings(null));
      }

      const normalizedInitialName = typeof initialProfileName === "string" ? initialProfileName.trim() : "";
      if (normalizedInitialName) {
        setCachedProfileName(normalizedInitialName);
        localStorage.setItem(SIDEBAR_PROFILE_NAME_KEY, normalizedInitialName);
      }

      const cachedName = String(localStorage.getItem(SIDEBAR_PROFILE_NAME_KEY) || "").trim();
      if (!normalizedInitialName && cachedName) {
        setCachedProfileName(cachedName);
      }

      const cachedProfileRoleValue = String(localStorage.getItem(SIDEBAR_PROFILE_ROLE_KEY) || "")
        .trim()
        .toUpperCase();
      if (cachedProfileRoleValue) {
        setCachedProfileRole(cachedProfileRoleValue);
      }

      const normalizedInitialRole = typeof initialRole === "string" ? initialRole.trim() : "";
      if (normalizedInitialRole) {
        const normalized = normalizedInitialRole.toUpperCase();
        setResolvedRole(normalized);
        setCachedProfileRole(normalized);
        localStorage.setItem(SIDEBAR_ROLE_KEY, normalized);
        localStorage.setItem(SIDEBAR_PROFILE_ROLE_KEY, normalized);
      } else {
        const cachedRole = String(localStorage.getItem(SIDEBAR_ROLE_KEY) || "")
          .trim()
          .toUpperCase();

        // Only reuse ADMIN cache to avoid stale lower-privilege roles causing icon reorder flicker.
        if (cachedRole === "ADMIN") {
          setResolvedRole(cachedRole);
        }
      }

      const normalizedInitialEstado = typeof initialEstado === "string" ? initialEstado.trim() : "";
      if (normalizedInitialEstado) {
        setResolvedEstado(normalizedInitialEstado.toUpperCase());
      }
    } catch {
      setSidebarImageStable(null, true);
      setResolvedRole(null);
      setResolvedEstado(null);
      setCachedProfileName("");
      setCachedProfileRole(null);
      setSidebarWidgetSettings(normalizeSidebarWidgetSettings(null));
    }
  }, [initialRole, initialEstado, initialProfileName, initialSidebarImage]);

  // ── Alertas badge polling (admin/colaborador only) ─────────────
  useEffect(() => {
    if (!mounted) return;
    const role = typeof resolvedRole === "string" ? resolvedRole.trim().toUpperCase() : "";
    if (role !== "ADMIN" && role !== "COLABORADOR" && role !== "SUPERADMIN") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/alertas-profe", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json() as { urgente?: number; total?: number };
        if (!cancelled) setAlertasCount(json.total ?? 0);
      } catch { /* silencioso */ }
    };
    poll();
    const interval = window.setInterval(poll, 5 * 60 * 1000); // cada 5 min
    return () => { cancelled = true; clearInterval(interval); };
  }, [mounted, resolvedRole]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    let cancelled = false;

    const syncAccountSnapshot = async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok || cancelled) return;

        const data = await response.json();
        const hasSidebarImageField = Object.prototype.hasOwnProperty.call(data || {}, "sidebarImage");
        const remoteImage =
          hasSidebarImageField && typeof data.sidebarImage === "string" && data.sidebarImage.trim()
            ? data.sidebarImage
            : null;

        const rawAccess =
          data?.permisosGranulares && typeof data.permisosGranulares === "object"
            ? (data.permisosGranulares as Record<string, unknown>).accesos
            : null;

        const normalizedAccess: Record<string, boolean> = {};
        if (rawAccess && typeof rawAccess === "object") {
          for (const [key, value] of Object.entries(rawAccess as Record<string, unknown>)) {
            if (typeof value === "boolean") {
              normalizedAccess[key] = value;
            }
          }
        }

        if (cancelled) return;

        setColaboradorAccessMap((previous) => {
          const prevMap = previous || {};
          const prevKeys = Object.keys(prevMap);
          const nextKeys = Object.keys(normalizedAccess);

          if (
            prevKeys.length === nextKeys.length &&
            nextKeys.every((entry) => prevMap[entry] === normalizedAccess[entry])
          ) {
            return previous;
          }

          return normalizedAccess;
        });

        if (hasSidebarImageField) {
          const normalizedLocalImage = normalizeSidebarImageValue(localStorage.getItem(SIDEBAR_IMAGE_KEY));
          const normalizedStableImage = normalizeSidebarImageValue(stableSidebarImageRef.current);

          if (remoteImage) {
            setSidebarImageStable(remoteImage);
            if (normalizedLocalImage !== remoteImage) {
              localStorage.setItem(SIDEBAR_IMAGE_KEY, remoteImage);
              window.dispatchEvent(new Event("pf-sidebar-image-updated"));
            }
          } else if (normalizedLocalImage) {
            // Keep locally cached image to avoid sidebar flicker on transient null snapshots.
            setSidebarImageStable(normalizedLocalImage);
          } else if (normalizedStableImage) {
            // Keep in-memory snapshot to avoid fallback flashes on delayed hydration.
            setSidebarImageStable(normalizedStableImage);
          } else {
            setSidebarImageStable(null, true);
          }
        }
      } catch {
        // do not block shell render
      }
    };

    void syncAccountSnapshot();

    const intervalId = window.setInterval(() => {
      void syncAccountSnapshot();
    }, ACCOUNT_SNAPSHOT_SYNC_MS);

    const onFocus = () => {
      void syncAccountSnapshot();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncAccountSnapshot();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [mounted, session?.user]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    syncSidebarImageFromStorage();
  }, [mounted]);

  // Reloj en tiempo real para el top bar
  useEffect(() => {
    setClockNow(new Date());
    const id = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // --hue fijo: 265 (violet), sin tracking de mouse
  useEffect(() => {
    document.documentElement.style.setProperty("--hue", "265");
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const narrowViewportQuery = window.matchMedia("(max-width: 1024px)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const syncViewport = () => {
      setIsMobileViewport(isMobileLikeViewport());
    };

    syncViewport();
    narrowViewportQuery.addEventListener("change", syncViewport);
    coarsePointerQuery.addEventListener("change", syncViewport);
    window.addEventListener("resize", syncViewport);

    return () => {
      narrowViewportQuery.removeEventListener("change", syncViewport);
      coarsePointerQuery.removeEventListener("change", syncViewport);
      window.removeEventListener("resize", syncViewport);
    };
  }, [mounted]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncScaleFromStorage = () => {
      const raw = localStorage.getItem(SCREEN_SCALE_KEY);
      applyScreenScale(clampScreenScale(Number(raw || "1")));
    };

    syncScaleFromStorage();
    window.addEventListener(SCREEN_SCALE_EVENT, syncScaleFromStorage);

    return () => {
      window.removeEventListener(SCREEN_SCALE_EVENT, syncScaleFromStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncAccentFromStorage = () => {
      applyAccentColorToRoot(window.localStorage.getItem(ACCENT_COLOR_KEY));
    };
    syncAccentFromStorage();
    window.addEventListener(ACCENT_COLOR_EVENT, syncAccentFromStorage);
    const onAccentStorage = (event: StorageEvent) => {
      if (event.key === ACCENT_COLOR_KEY) syncAccentFromStorage();
    };
    window.addEventListener("storage", onAccentStorage);

    const syncThemeFromStorage = () => {
      const stored = window.localStorage.getItem(THEME_MODE_KEY);
      const resolved = normalizeThemeMode(stored);
      applyThemeMode(resolved);
      setThemeMode(resolved);
    };

    syncThemeFromStorage();
    window.addEventListener(THEME_MODE_EVENT, syncThemeFromStorage);

    // Re-apply when OS preference changes (only matters when no stored override)
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemChange = () => {
      const stored = window.localStorage.getItem(THEME_MODE_KEY);
      if (!stored) syncThemeFromStorage();
    };
    mediaQuery.addEventListener("change", onSystemChange);

    return () => {
      window.removeEventListener(THEME_MODE_EVENT, syncThemeFromStorage);
      window.removeEventListener(ACCENT_COLOR_EVENT, syncAccentFromStorage);
      window.removeEventListener("storage", onAccentStorage);
      mediaQuery.removeEventListener("change", onSystemChange);
    };
  }, []);

  useEffect(() => {
    const initialPending = getPendingSaveStatus();
    setPendingSaveKeys(initialPending.keys);

    const onPendingSaveStatus = (event: Event) => {
      const custom = event as CustomEvent<{ keys?: string[] }>;
      const keys = Array.isArray(custom.detail?.keys) ? custom.detail.keys : [];
      setPendingSaveKeys(keys);
    };

    const onToast = (event: Event) => {
      const custom = event as CustomEvent<{
        type?: "success" | "error" | "warning";
        title?: string;
        message?: string;
      }>;
      const requestedType = custom.detail?.type;
      const type =
        requestedType === "error" ? "error" : requestedType === "warning" ? "warning" : "success";
      const message = custom.detail?.message || "Cambio guardado";
      pushToast(type, message, custom.detail?.title);
    };

    const onUnhandledRejection = () => {
      pushToast("error", "Ocurrio un problema inesperado en la pagina", "Error");
    };

    const onRuntimeError = () => {
      pushToast("error", "Se detecto un error inesperado", "Error");
    };

    window.addEventListener("pf-pending-save-status", onPendingSaveStatus);
    window.addEventListener("pf-inline-toast", onToast);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onRuntimeError);

    return () => {
      window.removeEventListener("pf-pending-save-status", onPendingSaveStatus);
      window.removeEventListener("pf-inline-toast", onToast);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onRuntimeError);
    };
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SIDEBAR_IMAGE_KEY) {
        setSidebarImageStable(event.newValue, true);
      }

      if (event.key === SIDEBAR_ROLE_KEY) {
        const nextRole = String(event.newValue || "").trim().toUpperCase();
        setResolvedRole(nextRole || null);
      }

      if (event.key === SIDEBAR_PROFILE_NAME_KEY) {
        setCachedProfileName(String(event.newValue || "").trim());
      }

      if (event.key === SIDEBAR_PROFILE_ROLE_KEY) {
        const nextProfileRole = String(event.newValue || "").trim().toUpperCase();
        setCachedProfileRole(nextProfileRole || null);
      }

      if (event.key === THEME_MODE_KEY) {
        applyThemeMode(normalizeThemeMode(event.newValue));
      }

      if (event.key === SIDEBAR_WIDGET_SETTINGS_KEY) {
        try {
          const parsed = event.newValue ? JSON.parse(event.newValue) : null;
          setSidebarWidgetSettings(normalizeSidebarWidgetSettings(parsed));
        } catch {
          setSidebarWidgetSettings(normalizeSidebarWidgetSettings(null));
        }
      }

      if (event.key === SCREEN_SCALE_KEY) {
        applyScreenScale(clampScreenScale(Number(event.newValue || "1")));
      }
    };

    const onSidebarImageChange = (event: Event) => {
      const custom = event as CustomEvent<{ forceClear?: boolean }>;
      const forceClear = custom.detail?.forceClear === true;
      syncSidebarImageFromStorage(forceClear);
    };

    const onSidebarWidgetSettingsChange = () => {
      try {
        const raw = localStorage.getItem(SIDEBAR_WIDGET_SETTINGS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        setSidebarWidgetSettings(normalizeSidebarWidgetSettings(parsed));
      } catch {
        setSidebarWidgetSettings(normalizeSidebarWidgetSettings(null));
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("pf-sidebar-image-updated", onSidebarImageChange);
    window.addEventListener(SIDEBAR_WIDGET_SETTINGS_EVENT, onSidebarWidgetSettingsChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pf-sidebar-image-updated", onSidebarImageChange);
      window.removeEventListener(SIDEBAR_WIDGET_SETTINGS_EVENT, onSidebarWidgetSettingsChange);
    };
  }, []);

  useEffect(() => {
    if (!mounted || pathname.startsWith("/auth")) return;

    const nextRole =
      ((session?.user as UserLike | undefined)?.role as string | undefined) ??
      resolvedRole ??
      null;
    const normalizedRole = typeof nextRole === "string" ? nextRole.trim().toUpperCase() : "";
    const isClienteMobile = normalizedRole === "CLIENTE" && isMobileLikeViewport();

    if (isClienteMobile) {
      return;
    }

    const scheduledRuns = [0, 120, 420, 900].map((delayMs) =>
      window.setTimeout(() => runInteractionGuard(), delayMs)
    );

    const onPointerDownCapture = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".pf-shell-nav-link")) {
        return;
      }

      window.setTimeout(() => {
        runInteractionGuard();
      }, 0);
    };

    const onFocus = () => {
      runInteractionGuard();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runInteractionGuard();
      }
    };

    const onResize = () => {
      if (isMobileLikeViewport()) {
        return;
      }
      runInteractionGuard();
    };

    document.addEventListener("pointerdown", onPointerDownCapture, true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize);

    return () => {
      scheduledRuns.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
    };
  }, [mounted, pathname, resolvedRole, session?.user]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined" || pathname.startsWith("/auth")) {
      return;
    }

    const onDocumentClickCapture = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }

      const targetAttr = String(anchor.getAttribute("target") || "").trim().toLowerCase();
      if ((targetAttr && targetAttr !== "_self") || anchor.hasAttribute("download")) {
        return;
      }

      const rawHref = String(anchor.getAttribute("href") || "").trim();
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }

      let resolvedTarget: URL;
      try {
        resolvedTarget = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }

      if (resolvedTarget.origin !== window.location.origin) {
        return;
      }

      const nextPath = normalizePath(resolvedTarget.pathname);
      if (!nextPath || nextPath === normalizePath(window.location.pathname)) {
        return;
      }

      markOptimisticSidebarNav(nextPath);
    };

    document.addEventListener("click", onDocumentClickCapture, true);
    return () => {
      document.removeEventListener("click", onDocumentClickCapture, true);
    };
  }, [markOptimisticSidebarNav, mounted, pathname]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const refreshServiceWorkers = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
        }
      } catch {
        // ignore service worker update failures
      }
    };

    void refreshServiceWorkers();
  }, [mounted]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const tokenStorageKey = "pf-dock-smoke-token";
    const currentWindow = window as WindowWithDockSmokeToken;

    try {
      const restored = window.sessionStorage.getItem(tokenStorageKey);
      if (!currentWindow.__pfDockSmokeToken && restored) {
        currentWindow.__pfDockSmokeToken = restored;
      }
    } catch {
      // ignore storage failures in restricted browsers
    }

    const persistToken = () => {
      const token = currentWindow.__pfDockSmokeToken;
      if (!token || typeof token !== "string") {
        return;
      }

      try {
        window.sessionStorage.setItem(tokenStorageKey, token);
      } catch {
        // ignore storage failures in restricted browsers
      }
    };

    window.addEventListener("pagehide", persistToken);
    window.addEventListener("beforeunload", persistToken);

    return () => {
      window.removeEventListener("pagehide", persistToken);
      window.removeEventListener("beforeunload", persistToken);
    };
  }, []);

  useEffect(() => {
    if (!mounted || pathname.startsWith("/auth")) return;

    const nextRole =
      ((session?.user as UserLike | undefined)?.role as string | undefined) ??
      resolvedRole ??
      null;
    const normalizedRole = typeof nextRole === "string" ? nextRole.trim().toUpperCase() : "";
    const isClienteMobile = normalizedRole === "CLIENTE" && isMobileLikeViewport();

    if (isClienteMobile) {
      return;
    }

    const cleanup = installButtonFailsafe();
    return cleanup;
  }, [mounted, pathname, resolvedRole, session?.user]);

  useEffect(() => {
    if (pendingSaveKeys.length === 0) {
      setPendingPanelOpen(false);
    }
  }, [pendingSaveKeys]);

  useEffect(() => {
    setMobileOpen(false);
    setOptimisticNavHref(null);

    if (optimisticNavResetTimerRef.current !== null) {
      window.clearTimeout(optimisticNavResetTimerRef.current);
      optimisticNavResetTimerRef.current = null;
    }

    if (sidebarNavFallbackTimerRef.current !== null) {
      window.clearTimeout(sidebarNavFallbackTimerRef.current);
      sidebarNavFallbackTimerRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    const nextUser = session?.user as UserLike | undefined;
    const nextRole = nextUser?.role;
    const nextEstado = nextUser?.estado;
    const nextKnownName = resolveKnownUserDisplayName(nextUser);

    if (typeof nextKnownName === "string" && nextKnownName.length > 0) {
      setCachedProfileName(nextKnownName);
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_PROFILE_NAME_KEY, nextKnownName);
      }
    }

    if (typeof nextRole === "string" && nextRole.length > 0) {
      const normalizedNextRole = nextRole.trim().toUpperCase();
      setResolvedRole(normalizedNextRole);
      setCachedProfileRole(normalizedNextRole);
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_ROLE_KEY, normalizedNextRole);
        localStorage.setItem(SIDEBAR_PROFILE_ROLE_KEY, normalizedNextRole);
      }
    }

    if (typeof nextEstado === "string" && nextEstado.length > 0) {
      setResolvedEstado(nextEstado.trim().toUpperCase());
    }
  }, [session?.user]);

  const role =
    ((session?.user as UserLike | undefined)?.role as string | undefined) ??
    resolvedRole ??
    (pathname.startsWith("/admin") ? "ADMIN" : null);
  const normalizedRole = typeof role === "string" ? role.trim().toUpperCase() : null;
  const userEstado =
    ((session?.user as UserLike | undefined)?.estado as string | undefined) ??
    resolvedEstado ??
    null;
  const normalizedEstado = typeof userEstado === "string" ? userEstado.trim().toUpperCase() : null;

  const sessionKnownName = resolveKnownUserDisplayName(session?.user as UserLike | undefined);
  const displayName = sessionKnownName || cachedProfileName || resolveUserDisplayName();
  const profileInitials = resolveInitials(displayName);
  const roleLabel = roleToLabel(normalizedRole || cachedProfileRole);
  const isClienteRole = normalizedRole === "CLIENTE";
  const shouldRenderSidebar = !(isClienteRole && isMobileViewport);
  const isClientePendingApproval = isClienteRole && normalizedEstado === "PENDIENTE_ALTA";
  const sidebarImageToRender = sidebarImage || stableSidebarImageRef.current;
  const hasSidebarImage = Boolean(sidebarImageToRender);
  const avatarImageSrc = sidebarImageToRender || TRANSPARENT_PIXEL_DATA_URL;

  useEffect(() => {
    if (!isClienteRole || !isMobileViewport) return;
    setMobileOpen(false);
  }, [isClienteRole, isMobileViewport]);

  useEffect(() => {
    if (!isClientePendingApproval || pathname.startsWith("/auth")) {
      setProfesorContacto(null);
      setProfesorContactoError("");
      setProfesorContactoLoading(false);
      return;
    }

    let cancelled = false;
    setProfesorContactoLoading(true);
    setProfesorContactoError("");

    const loadContacto = async () => {
      try {
        const response = await fetch("/api/alumnos/profesor-contacto", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (!response.ok || !payload?.ok || !payload?.contacto) {
          setProfesorContacto(null);
          setProfesorContactoError(
            String(payload?.error || "No pudimos obtener el contacto del profesor.")
          );
          return;
        }

        setProfesorContacto(payload.contacto as ProfesorContacto);
      } catch {
        if (cancelled) return;
        setProfesorContacto(null);
        setProfesorContactoError("No pudimos obtener el contacto del profesor.");
      } finally {
        if (!cancelled) {
          setProfesorContactoLoading(false);
        }
      }
    };

    void loadContacto();

    return () => {
      cancelled = true;
    };
  }, [isClientePendingApproval, pathname]);

  const pendingApprovalWhatsappHref = useMemo(() => {
    const waPhone = String(profesorContacto?.waPhone || "").trim();
    if (!waPhone) {
      return "";
    }

    const sessionEmail = String((session?.user as UserLike | undefined)?.email || "").trim().toLowerCase();
    const message = `Hola ${profesorContacto?.nombre || "profe"}, ya verifique mi mail y quedé pendiente de alta. Mi cuenta es ${sessionEmail || displayName}.`;

    return `https://wa.me/${encodeURIComponent(waPhone)}?text=${encodeURIComponent(message)}`;
  }, [profesorContacto, session?.user, displayName]);

  const visibleLinks = useMemo(() => {
    const filtered = links.filter((link) => {
        if (link.clientOnly && normalizedRole !== "CLIENTE") {
          return false;
        }

        if (link.adminOnly && normalizedRole !== "ADMIN") {
          // Keep admin links visible while role is unresolved to avoid icon reordering flicker.
          if (!normalizedRole) {
            return true;
          }
          return false;
        }

        if (normalizedRole === "ADMIN" && link.href === "/registros") {
          return false;
        }

        if (normalizedRole === "CLIENTE") {
          return CLIENTE_ACCESS_HREFS.includes(link.href);
        }

        if (normalizedRole === "COLABORADOR" && COLABORADOR_ACCESS_HREFS.includes(link.href)) {
          if (!colaboradorAccessMap || Object.keys(colaboradorAccessMap).length === 0) {
            return true;
          }

          if (link.href === "/clientes/musica" || link.href === "/clientes/playlists") {
            return colaboradorAccessMap["/clientes"] !== false;
          }

          const allCategoryAccessBlocked = COLABORADOR_CATEGORY_HREFS.every(
            (href) => colaboradorAccessMap[href] === false
          );

          if (allCategoryAccessBlocked && COLABORADOR_CATEGORY_HREFS.includes(link.href)) {
            return true;
          }

          return colaboradorAccessMap[link.href] !== false;
        }

        return true;
      });

    // Admin lock: keep a deterministic sidebar order and avoid duplicate hrefs.
    if (normalizedRole === "ADMIN") {
      return lockAdminSidebarLinks(filtered);
    }

    return filtered;
  }, [links, normalizedRole, colaboradorAccessMap]);

  const normalizedPathname = normalizePath(pathname);
  const isAlumnosRoute =
    normalizedPathname === "/alumnos" || normalizedPathname.startsWith("/alumnos/");
  const alumnosBootLoading = false;

  const appRouteTransitionRaw =
    optimisticNavHref !== null && optimisticNavHref !== normalizedPathname;
  const appRouteTransitionLoading = useMinimumLoading(
    appRouteTransitionRaw,
    APP_TRANSITION_MIN_MS
  );
  const appTransitionOverlayActive = appRouteTransitionLoading || alumnosBootLoading;
  const allVisibleHrefs = visibleLinks.map((link) => normalizePath(link.href));

  useEffect(() => {
    if (!mounted || typeof window === "undefined") {
      return;
    }

    const hrefsToPrefetch = visibleLinks.map((link) => normalizePath(link.href));
    if (hrefsToPrefetch.length === 0) {
      return;
    }

    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const runPrefetch = () => {
      for (const href of hrefsToPrefetch) {
        if (!href || prefetchedSidebarHrefRef.current.has(href)) {
          continue;
        }

        prefetchedSidebarHrefRef.current.add(href);
        try {
          router.prefetch(href);
        } catch {
          // Prefetch must never break navigation flow.
        }
      }
    };

    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(() => {
        runPrefetch();
      }, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(runPrefetch, 120);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
    };
  }, [mounted, router, visibleLinks]);

  const sidebarItemHeight = 38;
  const sidebarIconSize = "1rem";
  const sidebarLabelSize = "11px";
  const activeSidebarLink = useMemo(() => {
    for (const link of visibleLinks) {
      const normalizedHref = normalizePath(link.href);
      const hasChildLink = allVisibleHrefs.some(
        (candidate) => candidate !== normalizedHref && candidate.startsWith(`${normalizedHref}/`)
      );
      const isCurrent =
        normalizedPathname === normalizedHref ||
        (!hasChildLink &&
          normalizedHref !== "/" &&
          normalizedPathname.startsWith(`${normalizedHref}/`)) ||
        optimisticNavHref === normalizedHref;

      if (isCurrent) {
        return link;
      }
    }

    return visibleLinks[0] || null;
  }, [visibleLinks, allVisibleHrefs, normalizedPathname, optimisticNavHref]);
  const sidebarLedColors = useMemo(
    () => resolveSidebarLedColors(activeSidebarLink?.tone),
    [activeSidebarLink?.tone]
  );

  const sidebarOperationalStats = useMemo(() => {
    if (isClienteRole) {
      return {
        clientesActivos: 0,
        totalClientes: 0,
        pagosConfirmados: 0,
        pagosPendientes: 0,
        ingresosConfirmados: 0,
        saldoPendiente: 0,
        presentes: 0,
        totalAsistencia: 0,
        presentismo: 0,
        sesionesTotales: 0,
      };
    }

    const clientesActivos =
      jugadoras.filter((jugadora) => (jugadora.estado || "activo") === "activo").length +
      alumnos.filter((alumno) => (alumno.estado || "activo") === "activo").length;
    const totalClientes = jugadoras.length + alumnos.length;

    const metas = Object.values(clientesMeta || {}).filter(
      (value): value is ClienteMetaSnapshot => Boolean(value) && typeof value === "object"
    );

    const pagosConfirmados = metas.filter((meta) => meta.pagoEstado === "confirmado").length;
    const pagosPendientes = metas.filter((meta) => meta.pagoEstado === "pendiente").length;

    const ingresosConfirmados = metas
      .filter((meta) => meta.pagoEstado === "confirmado")
      .reduce((total, meta) => total + parseMoneyValue(meta.importe), 0);

    const saldoPendiente = metas
      .filter((meta) => meta.pagoEstado === "pendiente")
      .reduce((total, meta) => total + parseMoneyValue(meta.importe), 0);

    const presentes = asistenciaRegistros.filter((registro) => registro.estado === "presente").length;
    const ausentes = asistenciaRegistros.filter((registro) => registro.estado === "ausente").length;
    const totalAsistencia = presentes + ausentes;
    const presentismo = totalAsistencia > 0 ? Math.round((presentes / totalAsistencia) * 100) : 0;

    return {
      clientesActivos,
      totalClientes,
      pagosConfirmados,
      pagosPendientes,
      ingresosConfirmados,
      saldoPendiente,
      presentes,
      totalAsistencia,
      presentismo,
      sesionesTotales: sesiones.length,
    };
  }, [isClienteRole, jugadoras, alumnos, sesiones.length, clientesMeta, asistenciaRegistros]);

  const sidebarWidgetItems = useMemo<SidebarWidgetItem[]>(() => {
    if (isClienteRole) {
      return [];
    }

    const selectedSet = new Set(
      sidebarWidgetSettings.selectedCards.map((id) => String(id || "").trim()).filter((id) => id.length > 0)
    );

    const preferredOptions = SIDEBAR_WIDGET_OPTIONS.filter((option) => selectedSet.has(option.id));
    const options = preferredOptions.length > 0 ? preferredOptions : SIDEBAR_WIDGET_OPTIONS;

    const uniqueVisibleHrefs = Array.from(new Set(allVisibleHrefs));
    const fallbackHref = uniqueVisibleHrefs[0] || "/";

    const resolveWidgetHref = (href: string) => {
      const normalizedHref = normalizePath(href);
      return uniqueVisibleHrefs.includes(normalizedHref) ? normalizedHref : fallbackHref;
    };

    const pendingSummary = pendingSaveKeys.slice(0, 2).map((key) => formatPendingKeyLabel(key)).join(" + ");
    const pendingDetail =
      pendingSaveKeys.length === 0
        ? "Sin modulos pendientes"
        : pendingSaveKeys.length > 2
        ? `${pendingSummary} +${pendingSaveKeys.length - 2}`
        : pendingSummary;

    return options.map((option) => {
      const base = {
        id: option.id,
        href: resolveWidgetHref(option.href),
        label: option.label,
        icon: option.icon,
        toneClass:
          WIDGET_TONE_CLASS_BY_ID[option.id] ||
          "border-cyan-300/35 bg-gradient-to-br from-cyan-500/16 via-slate-900/75 to-blue-500/16",
      };

      if (option.id === "pending-saves") {
        return {
          ...base,
          value: String(pendingSaveKeys.length),
          detail: pendingDetail,
        };
      }

      if (option.id === "payments-completed") {
        return {
          ...base,
          value: String(sidebarOperationalStats.pagosConfirmados),
          detail: `Confirmados · ${formatCurrency(sidebarOperationalStats.ingresosConfirmados)}`,
        };
      }

      if (option.id === "payments-pending") {
        return {
          ...base,
          value: String(sidebarOperationalStats.pagosPendientes),
          detail: `Pendiente · ${formatCurrency(sidebarOperationalStats.saldoPendiente)}`,
        };
      }

      if (option.id === "attendance-rate") {
        return {
          ...base,
          value: `${sidebarOperationalStats.presentismo}%`,
          detail:
            sidebarOperationalStats.totalAsistencia > 0
              ? `${sidebarOperationalStats.presentes} presentes de ${sidebarOperationalStats.totalAsistencia}`
              : "Sin asistencias registradas",
        };
      }

      if (option.id === "sessions-loaded") {
        return {
          ...base,
          value: String(sidebarOperationalStats.sesionesTotales),
          detail: `${sidebarOperationalStats.sesionesTotales} sesiones cargadas`,
        };
      }

      if (option.id === "active-clients") {
        return {
          ...base,
          value: String(sidebarOperationalStats.clientesActivos),
          detail: `${sidebarOperationalStats.totalClientes} clientes totales`,
        };
      }

      return {
        ...base,
        value: "--",
        detail: option.hint,
      };
    });
  }, [allVisibleHrefs, isClienteRole, pendingSaveKeys, sidebarOperationalStats, sidebarWidgetSettings.selectedCards]);

  const activeSidebarWidgetItem = sidebarWidgetItems[sidebarWidgetIndex] || null;

  useEffect(() => {
    if (sidebarWidgetItems.length === 0) {
      setSidebarWidgetIndex(0);
      return;
    }

    setSidebarWidgetIndex((prev) => (prev >= sidebarWidgetItems.length ? 0 : prev));
  }, [sidebarWidgetItems.length]);

  useEffect(() => {
    if (!mounted || isMobileViewport || sidebarWidgetItems.length <= 1) {
      setSidebarWidgetPhase("enter");
      return;
    }

    const intervalId = window.setInterval(() => {
      setSidebarWidgetPhase("exit");

      if (widgetTransitionTimeoutRef.current !== null) {
        window.clearTimeout(widgetTransitionTimeoutRef.current);
      }

      widgetTransitionTimeoutRef.current = window.setTimeout(() => {
        setSidebarWidgetIndex((prev) => (prev + 1) % sidebarWidgetItems.length);
        setSidebarWidgetPhase("enter");
        widgetTransitionTimeoutRef.current = null;
      }, SIDEBAR_WIDGET_FADE_MS);
    }, sidebarWidgetSettings.transitionMs);

    return () => {
      window.clearInterval(intervalId);
      if (widgetTransitionTimeoutRef.current !== null) {
        window.clearTimeout(widgetTransitionTimeoutRef.current);
        widgetTransitionTimeoutRef.current = null;
      }
    };
  }, [isMobileViewport, mounted, sidebarWidgetItems.length, sidebarWidgetSettings.transitionMs]);

  const pendingBadgeSummary = (() => {
    if (pendingSaveKeys.length === 0) return "";
    const labels = pendingSaveKeys.slice(0, 2).map((key) => formatPendingKeyLabel(key));
    const base = labels.join(" + ");
    const rest = pendingSaveKeys.length - labels.length;
    return rest > 0 ? `${base} +${rest}` : base;
  })();

  if (pathname.startsWith("/auth") || pathname === "/privacidad") {
    return <>{children}</>;
  }

  return (
    <div className="pf-training-shell relative max-md:min-h-[100svh] md:min-h-[100dvh] bg-[#09090f] text-slate-100">
      <div className="pf-shell-bg-layer pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(ellipse_80%_45%_at_50%_-5%,hsla(220,70%,40%,0.18),transparent_65%)] max-md:hidden" aria-hidden="true" />
      <AdminRunningLoaderOverlay
        active={appRouteTransitionLoading}
        message="Cargando..."
        detail="Abriendo pantalla..."
        className="pointer-events-none md:left-[52px]"
      />
      {alumnosBootLoading ? (
        <div
          className="pf-a3-routine-log-overlay pf-a3-routine-log-overlay-mobile z-[121]"
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#05070a",
            padding: "16px",
          }}
        >
          <section className="pf-a3-routine-empty pf-a3-routine-loading w-[min(420px,92vw)]">
            <div className="pf-a3-routine-loading-visual" aria-hidden="true">
              <span className="pf-a3-routine-loading-ring" />
              <span className="pf-a3-routine-loading-core">PF</span>
            </div>
            <p className="pf-a3-routine-loading-brand">PF Control</p>
            <h2>Cargando plataforma...</h2>
            <p>Preparando tu pantalla.</p>
          </section>
        </div>
      ) : null}
      {!isClienteRole ? (
        <ReliableActionButton
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="fixed left-2 top-2 z-[97] inline-flex h-9 w-9 items-center justify-center rounded-xl text-base text-white/70 md:hidden"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          aria-label={mobileOpen ? "Cerrar menu" : "Abrir menu"}
        >
          {mobileOpen ? "✕" : "☰"}
        </ReliableActionButton>
      ) : null}


      {mobileOpen && !isClienteRole ? (
        <div
          className="fixed inset-0 z-[88] bg-slate-950/65 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* ── Top bar — profile at top-right like Instagram ── */}
      {shouldRenderSidebar ? (
        <header
          className="fixed top-0 right-0 z-[85] flex h-[52px] items-center justify-between gap-2 pr-3"
          style={{
            left: isMobileViewport ? "0" : "52px",
            background: "linear-gradient(180deg,rgba(5,5,10,0.92) 0%,rgba(5,5,10,0.0) 100%)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {/* ── LEFT: reloj + fecha + página ── */}
          <div className="flex min-w-0 flex-1 items-center gap-3 pl-4 overflow-hidden">
            {/* Reloj */}
            {clockNow && (
              <div className="flex shrink-0 items-baseline gap-1.5">
                <span className="tabular-nums text-[22px] font-black leading-none tracking-tight text-white/88">
                  {clockNow.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                <span
                  className="tabular-nums text-[13px] font-semibold leading-none"
                  style={{ color: `hsl(var(--hue,220),65%,68%)` }}
                >
                  {String(clockNow.getSeconds()).padStart(2, "0")}
                </span>
              </div>
            )}

            {/* Separador */}
            <span className="h-[20px] w-px shrink-0 bg-white/[0.08]" aria-hidden="true" />

            {/* Fecha */}
            {clockNow && (
              <div className="hidden flex-col leading-none sm:flex">
                <span className="text-[11px] font-semibold capitalize text-white/60">
                  {clockNow.toLocaleDateString("es-AR", { weekday: "long" })}
                </span>
                <span className="mt-[3px] text-[10px] font-medium capitalize text-white/35">
                  {clockNow.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            )}

            {/* Pendientes de guardado — siempre visible si los hay */}
            {pendingSaveKeys.length > 0 && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/28 bg-amber-500/10 px-2 py-[3px]">
                <span className="text-[10px] leading-none">⚠️</span>
                <span className="text-[10px] font-bold text-amber-200/80 whitespace-nowrap">
                  {pendingSaveKeys.length} sin guardar
                </span>
              </span>
            )}
          </div>

          {/* ── RIGHT: perfil fusionado ── */}
          <Link
            href="/cuenta"
            reliabilityMode="hard"
            className="flex shrink-0 items-center gap-2.5 px-3 transition-opacity duration-200 hover:opacity-80 active:scale-95"
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              handleSidebarLinkClick("/cuenta");
            }}
            title="Ir a cuenta"
            aria-label="Ir a cuenta"
          >
            <span className="hidden flex-col items-end leading-none sm:flex">
              <span className="text-[11px] font-semibold text-white/70">{displayName}</span>
              <span
                className="mt-[3px] text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ color: `hsl(var(--hue,220),60%,60%)` }}
              >
                {roleLabel}
              </span>
            </span>
            <span
              className="relative h-8 w-8 shrink-0 rounded-full"
              style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.08),0 0 12px hsla(var(--hue,220),72%,62%,0.28)` }}
            >
              <img
                src={avatarImageSrc}
                alt="Cuenta"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                className={`h-full w-full rounded-full object-cover transition-opacity duration-200 ${hasSidebarImage ? "opacity-100" : "opacity-0"}`}
              />
              <span
                className={`absolute inset-0 flex items-center justify-center rounded-full text-[11px] font-black transition-opacity duration-200 ${hasSidebarImage ? "opacity-0" : "opacity-100"}`}
                style={{
                  background: `linear-gradient(135deg,hsla(var(--hue,220),60%,25%,0.65),hsla(var(--hue,220),50%,16%,0.85))`,
                  color: `hsl(var(--hue,220),70%,78%)`,
                }}
                aria-hidden={hasSidebarImage}
              >
                {profileInitials}
              </span>
              <span
                className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-[1.5px] border-[#080810] bg-emerald-400"
                style={{ boxShadow: "0 0 5px rgba(52,211,153,0.8)" }}
                aria-hidden="true"
              />
            </span>
          </Link>
        </header>
      ) : null}

      {shouldRenderSidebar ? (
      <aside
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className={`pf-sidebar-mac pointer-events-auto fixed inset-y-0 left-0 z-[90] overflow-hidden translate-x-0 ${
          mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        }`}
        style={{
          width: sidebarExpanded || mobileOpen ? "clamp(160px,14vw,178px)" : "52px",
          transition: "width 320ms cubic-bezier(0.32,1,0.36,1)",
          /* Sidebar SIEMPRE oscura en ambos temas (Harbiz Dark Nav) */
          background: "linear-gradient(180deg,#0b1220 0%,#0a1020 100%)",
          borderRight: "1px solid rgba(148, 163, 184, 0.14)",
          backdropFilter: "blur(40px) saturate(160%)",
          WebkitBackdropFilter: "blur(40px) saturate(160%)",
        }}
      >
        {/* Top ambient glow */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-48 w-full"
          style={{ background: "radial-gradient(ellipse 100% 50% at 50% -5%, hsla(var(--hue,220),72%,58%,0.12) 0%, transparent 70%)" }}
          aria-hidden="true"
        />

        {/* Left LED strip */}
        <div
          className="pf-sidebar-led-strip absolute inset-y-4 left-0 z-[1] w-[2px] rounded-r-full"
          style={{
            background: `linear-gradient(180deg,transparent 0%,${sidebarLedColors.start} 28%,${sidebarLedColors.end} 72%,transparent 100%)`,
            boxShadow: `0 0 8px ${sidebarLedColors.start},0 0 18px ${sidebarLedColors.end}`,
          }}
          aria-hidden="true"
        />

        {/* Nav + widget — full height */}
        <div className="flex h-full flex-col pt-[52px] overflow-hidden">
          {/* Nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1.5">
            <div className="flex w-full flex-col gap-[2px]">
              {visibleLinks.map((link) => {
                const normalizedHref = normalizePath(link.href);
                const hasChildLink = allVisibleHrefs.some(
                  (candidate) => candidate !== normalizedHref && candidate.startsWith(`${normalizedHref}/`)
                );
                const isCurrent =
                  normalizedPathname === normalizedHref ||
                  (!hasChildLink &&
                    normalizedHref !== "/" &&
                    normalizedPathname.startsWith(`${normalizedHref}/`)) ||
                  optimisticNavHref === normalizedHref;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    reliabilityMode="hard"
                    className="pf-shell-nav-link group relative flex w-full items-center rounded-[10px] overflow-hidden transition-all duration-150"
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                      handleSidebarLinkClick(link.href);
                    }}
                    style={{
                      height: `${sidebarItemHeight}px`,
                      minHeight: `${sidebarItemHeight}px`,
                      background: isCurrent
                        ? `linear-gradient(90deg,hsla(var(--hue,220),65%,55%,0.22) 0%,hsla(var(--hue,220),50%,45%,0.07) 100%)`
                        : "transparent",
                      boxShadow: isCurrent
                        ? `inset 0 0 0 1px hsla(var(--hue,220),60%,65%,0.14)`
                        : undefined,
                    }}
                    aria-current={isCurrent ? "page" : undefined}
                    title={link.label}
                    aria-label={link.label}
                  >
                    {/* Hover fill */}
                    <span
                      className="pointer-events-none absolute inset-0 rounded-[10px] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      style={{ background: "color-mix(in srgb, var(--gym-accent) 18%, transparent)" }}
                      aria-hidden="true"
                    />
                    {/* Active accent bar */}
                    <span
                      className="absolute inset-y-[7px] left-0 w-[3px] rounded-r-full transition-all duration-300"
                      style={{
                        background: isCurrent
                          ? `linear-gradient(180deg,${sidebarLedColors.start},${sidebarLedColors.end})`
                          : "transparent",
                        boxShadow: isCurrent ? `0 0 7px ${sidebarLedColors.start}` : "none",
                        opacity: isCurrent ? 1 : 0,
                      }}
                      aria-hidden="true"
                    />
                    {/* Icon — always centered in the 52px zone */}
                    <span
                      className="relative z-[1] shrink-0 text-center leading-none transition-all duration-300"
                      style={{
                        fontSize: sidebarIconSize,
                        width: "52px",
                        textAlign: "center",
                      }}
                    >
                      {link.icon}
                      {link.href === "/alertas" && alertasCount > 0 && (
                        <span
                          className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/40"
                          style={{ fontSize: "9px", fontWeight: 700, lineHeight: 1, padding: "0 3px" }}
                          aria-label={`${alertasCount} avisos`}
                        >
                          {alertasCount > 99 ? "99+" : alertasCount}
                        </span>
                      )}
                    </span>
                    {/* Label — slides in when expanded */}
                    <span
                      className="relative z-[1] truncate text-left font-semibold leading-tight transition-all duration-300"
                      style={{
                        fontSize: sidebarLabelSize,
                        color: isCurrent ? `hsl(var(--hue,220),75%,88%)` : "rgba(255,255,255,0.5)",
                        maxWidth: sidebarExpanded || mobileOpen ? "110px" : "0px",
                        opacity: sidebarExpanded || mobileOpen ? 1 : 0,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        transitionDelay: sidebarExpanded || mobileOpen ? "40ms" : "0ms",
                      }}
                    >
                      {compactSidebarLabel(link.label)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Widget — only show when expanded */}
          {activeSidebarWidgetItem && (sidebarExpanded || mobileOpen) ? (
            <div
              className="px-1.5 pb-2"
              style={{ opacity: sidebarExpanded || mobileOpen ? 1 : 0, transition: "opacity 200ms 80ms" }}
            >
              <div
                className="mb-2 h-px w-full"
                style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.055),transparent)" }}
                aria-hidden="true"
              />
              <Link
                href={activeSidebarWidgetItem.href}
                reliabilityMode="hard"
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  handleSidebarLinkClick(activeSidebarWidgetItem.href);
                }}
                className="block w-full min-h-[100px] rounded-xl px-3 py-2.5 transition-all duration-200 hover:brightness-110"
                style={{
                  background: "linear-gradient(145deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.015) 100%)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05),0 8px 24px rgba(0,0,0,0.4)",
                }}
                title={`Widget: ${activeSidebarWidgetItem.label}`}
                aria-label={`Widget: ${activeSidebarWidgetItem.label}`}
              >
                <div
                  className={`transition-all duration-300 ${
                    sidebarWidgetPhase === "enter" ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                  }`}
                >
                  <p className="text-[7px] font-black uppercase tracking-[0.22em] text-white/28">Resumen</p>
                  <p className="mt-0.5 truncate text-[10px] font-bold text-white/65">{activeSidebarWidgetItem.label}</p>
                  <div className="mt-2 flex items-end justify-between gap-1">
                    <p className="text-[22px] font-black leading-none text-white">{activeSidebarWidgetItem.value}</p>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-xs"
                      style={{
                        background: `hsla(var(--hue,220),60%,50%,0.14)`,
                        border: `1px solid hsla(var(--hue,220),65%,65%,0.16)`,
                      }}
                    >
                      {activeSidebarWidgetItem.icon}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[9px] leading-tight text-white/35">
                    {activeSidebarWidgetItem.detail}
                  </p>
                </div>
              </Link>
              {sidebarWidgetItems.length > 1 ? (
                <div className="mt-1.5 flex items-center justify-center gap-1">
                  {sidebarWidgetItems.slice(0, 5).map((item, idx) => {
                    const isActive = sidebarWidgetItems[sidebarWidgetIndex]?.id === item.id;
                    return (
                      <span
                        key={`${item.id}-${idx}`}
                        className="h-[3px] rounded-full transition-all duration-300"
                        style={{
                          width: isActive ? "14px" : "4px",
                          background: isActive ? `hsl(var(--hue,220),70%,72%)` : "rgba(255,255,255,0.18)",
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Pending saves */}
          {!isClienteRole && pendingSaveKeys.length > 0 ? (
            <div className="px-1.5 pb-2 shrink-0">
              <ReliableActionButton
                type="button"
                onClick={() => setPendingPanelOpen((prev) => !prev)}
                title="Cambios pendientes"
                className="w-full overflow-hidden rounded-[9px] border border-amber-300/38 bg-amber-500/12 transition-all duration-150 hover:border-amber-300/55 hover:bg-amber-500/20"
                style={{
                  minHeight: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarExpanded || mobileOpen ? "flex-start" : "center",
                  padding: sidebarExpanded || mobileOpen ? "0 10px" : "0",
                }}
              >
                <span style={{ fontSize: "13px" }}>⚠️</span>
                <span
                  className="ml-1.5 truncate text-[10px] font-bold text-amber-100 transition-all duration-300"
                  style={{
                    maxWidth: sidebarExpanded || mobileOpen ? "100px" : "0px",
                    opacity: sidebarExpanded || mobileOpen ? 1 : 0,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  Pendientes ({pendingSaveKeys.length})
                </span>
              </ReliableActionButton>
            </div>
          ) : null}
        </div>
      </aside>
      ) : null}

      {!isClienteRole && pendingSaveKeys.length > 0 && pendingPanelOpen ? (
        <div className="fixed left-[60px] top-[56px] z-[92] w-[min(92vw,340px)] rounded-xl border border-amber-200/35 bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur-md">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
            Modulos pendientes
          </p>
          <div className="mt-2 max-h-56 space-y-1 overflow-auto pr-1">
            {pendingSaveKeys.map((key) => (
              <div key={key} className="rounded-md border border-white/10 bg-slate-800/80 px-2 py-1.5">
                <p className="text-xs font-semibold text-slate-100">{formatPendingKeyLabel(key)}</p>
                <p className="text-[10px] text-slate-400">{key}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-300">
            Recordatorio: los cambios se suben cuando presionas Guardar en cada pantalla.
          </p>
          {pendingBadgeSummary ? (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-100">
              Resumen: {pendingBadgeSummary}
            </p>
          ) : null}
        </div>
      ) : null}

      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed right-4 top-4 z-[96] flex w-[min(92vw,380px)] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-[1.2rem] border px-4 py-3 shadow-2xl backdrop-blur-xl ${
                toast.phase === "enter" ? "pf-ios-toast-enter" : "pf-ios-toast-exit"
              } ${
                toast.type === "success"
                  ? "border-emerald-200/45 bg-gradient-to-r from-emerald-500/35 to-cyan-400/30 text-emerald-50"
                  : toast.type === "warning"
                  ? "border-amber-200/45 bg-gradient-to-r from-amber-500/35 to-orange-400/30 text-amber-50"
                  : "border-rose-200/40 bg-rose-500/25 text-rose-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 h-7 w-7 shrink-0 rounded-full border text-center text-sm leading-7 ${
                    toast.type === "success"
                      ? "border-emerald-100/70 bg-emerald-100/25"
                      : toast.type === "warning"
                      ? "border-amber-100/70 bg-amber-100/25"
                      : "border-rose-100/70 bg-rose-100/25"
                  }`}
                >
                  {toast.type === "success" ? "✓" : toast.type === "warning" ? "!" : "x"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-90">{toast.title}</p>
                  <p className="mt-1 text-sm font-semibold leading-5">{toast.message}</p>
                </div>
              </div>
              <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-black/20">
                <div className="pf-ios-toast-progress h-full rounded-full bg-white/70" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {isClientePendingApproval ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/88 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-cyan-200/30 bg-slate-950/95 p-6 text-center shadow-[0_30px_80px_rgba(2,8,25,0.65)] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200/85">Cuenta pendiente</p>
            <h2 className="mt-3 text-3xl font-black text-white">Espera a que tu profesor te de alta</h2>
            <p className="mt-4 text-sm leading-7 text-slate-200/90">
              Ya verificaste tu mail y puedes iniciar sesion, pero la plataforma queda bloqueada hasta que el profesor
              confirme tu alta.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-300/35 bg-amber-500/12 px-4 py-3 text-sm font-semibold text-amber-100">
              Estado actual: pendiente de alta
            </div>

            {profesorContactoLoading ? (
              <p className="mt-4 text-sm text-cyan-100">Buscando contacto del profesor...</p>
            ) : null}

            {profesorContactoError ? (
              <p className="mt-4 rounded-xl border border-rose-300/35 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
                {profesorContactoError}
              </p>
            ) : null}

            {pendingApprovalWhatsappHref ? (
              <a
                href={pendingApprovalWhatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:from-emerald-300 hover:to-cyan-300"
              >
                Comunicarme con el profesor
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300"
              >
                Contacto del profesor no disponible
              </button>
            )}
          </div>
        </div>
      ) : null}

      <main
        className={`relative max-md:min-h-[100svh] md:min-h-[100dvh] pb-8 ${
          shouldRenderSidebar ? "md:pl-[52px]" : "md:pl-0"
        } md:pt-[52px] ${
          isAlumnosRoute ? "pt-0" : "pt-14"
        }`}
      >
        <div
          className={`${isAlumnosRoute ? "px-0 md:px-4" : "px-4"} transition-opacity duration-150`}
          style={
            appTransitionOverlayActive
              ? {
                  pointerEvents: "none",
                  opacity: 0,
                }
              : {
                  opacity: 1,
                }
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}


