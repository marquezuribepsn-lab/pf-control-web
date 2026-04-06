"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { getPendingSaveStatus } from "./useSharedState";

type NavLink = {
  href: string;
  label: string;
  icon: string;
  tone: string;
  adminOnly?: boolean;
};

type AppShellProps = {
  links: NavLink[];
  children: React.ReactNode;
};

type InlineToast = {
  id: number;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  phase: "enter" | "exit";
};

const PRIMARY_ORDER = [
  "/",
  "/semana",
  "/sesiones",
  "/plantel",
  "/clientes",
];

const NAV_CONFIG_KEY = "pf-control-nav-config-v1";
const SIDEBAR_IMAGE_KEY = "pf-control-sidebar-image-v1";
const SCREEN_SCALE_KEY = "pf-control-screen-scale-v1";
const SIDEBAR_COLLAPSED_KEY = "pf-control-sidebar-collapsed-v1";
const SIDEBAR_ROLE_KEY = "pf-control-sidebar-role-v1";
const DOCK_LABEL_MODE_KEY = "pf-control-dock-label-mode-v1";
const MIN_SCREEN_SCALE = 0.8;
const MAX_SCREEN_SCALE = 1.35;
const COLABORADOR_ACCESS_HREFS = [
  "/plantel",
  "/semana",
  "/sesiones",
  "/asistencias",
  "/ejercicios",
  "/registros",
  "/categorias",
  "/deportes",
  "/equipos",
  "/clientes",
  "/clientes/musica",
  "/clientes/playlists",
];

const COLABORADOR_CATEGORY_HREFS = ["/categorias", "/deportes", "/equipos"];

type NavConfig = {
  order: string[];
};

const getDefaultConfig = (links: NavLink[]): NavConfig => {
  const allHrefs = links.map((link) => link.href);
  const preferred = PRIMARY_ORDER.filter((href) => allHrefs.includes(href));
  const rest = allHrefs.filter((href) => !preferred.includes(href));
  return { order: [...preferred, ...rest] };
};

const normalizeConfig = (links: NavLink[], rawConfig: Partial<NavConfig> | null): NavConfig => {
  const defaults = getDefaultConfig(links);

  if (!rawConfig) {
    return defaults;
  }

  const validHrefs = new Set(links.map((link) => link.href));
  const used = new Set<string>();
  const order: string[] = [];

  const oldPrimary = (rawConfig as { primary?: string[] } | null)?.primary || [];
  const oldSecondary = (rawConfig as { secondary?: string[] } | null)?.secondary || [];
  const sourceOrder = [...(rawConfig.order || []), ...oldPrimary, ...oldSecondary];

  for (const href of sourceOrder) {
    if (validHrefs.has(href) && !used.has(href)) {
      order.push(href);
      used.add(href);
    }
  }

  for (const href of defaults.order) {
    if (!used.has(href)) {
      order.push(href);
      used.add(href);
    }
  }

  return { order };
};

const reorderToTarget = (list: string[], dragHref: string, targetHref: string): string[] => {
  if (dragHref === targetHref) {
    return list;
  }

  const withoutDragged = list.filter((href) => href !== dragHref);
  const targetIndex = withoutDragged.indexOf(targetHref);

  if (targetIndex === -1) {
    return [...withoutDragged, dragHref];
  }

  withoutDragged.splice(targetIndex, 0, dragHref);
  return withoutDragged;
};

const normalizePath = (value: string) => {
  const path = value.split("?")[0] || "/";
  if (path !== "/" && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
};

type DockLabelMode = "full" | "compact" | "icon";

const normalizeDockLabelMode = (value: string | null): DockLabelMode => {
  if (value === "full" || value === "compact" || value === "icon") {
    return value;
  }
  return "compact";
};

const sanitizeScreenScale = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  if (numeric < MIN_SCREEN_SCALE) return MIN_SCREEN_SCALE;
  if (numeric > MAX_SCREEN_SCALE) return MAX_SCREEN_SCALE;
  return numeric;
};

const resolveUserDisplayName = (user: any): string => {
  const fromName = typeof user?.name === "string" ? user.name.trim() : "";
  if (fromName) return fromName;

  const fromEmail = typeof user?.email === "string" ? user.email.split("@")[0]?.trim() : "";
  if (fromEmail) return fromEmail;

  return "Usuario";
};

const resolveInitials = (name: string): string => {
  const words = name
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "U";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
};

const compactDockLabel = (label: string) => {
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

export default function AppShell({ links, children }: AppShellProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const linksSignature = links
    .map((link) => `${link.href}|${link.label}|${link.icon}|${link.tone}|${link.adminOnly ? "1" : "0"}`)
    .join("||");
  const stableLinks = useMemo(() => links, [linksSignature]);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<NavConfig>(() => getDefaultConfig(stableLinks));
  const [dragState, setDragState] = useState<{ href: string } | null>(null);
  const [sidebarImage, setSidebarImage] = useState<string | null>(null);
  const [screenScale, setScreenScale] = useState(1);
  const [colaboradorAccessMap, setColaboradorAccessMap] = useState<Record<string, boolean> | null>(null);
  const [resolvedRole, setResolvedRole] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const cachedRole = localStorage.getItem(SIDEBAR_ROLE_KEY);
    return cachedRole && cachedRole.length > 0 ? cachedRole : null;
  });
  const [toasts, setToasts] = useState<InlineToast[]>([]);
  const [pendingSaveKeys, setPendingSaveKeys] = useState<string[]>([]);
  const [pendingPanelOpen, setPendingPanelOpen] = useState(false);
  const [hoveredDockIndex, setHoveredDockIndex] = useState<number | null>(null);
  const [dockLabelMode, setDockLabelMode] = useState<DockLabelMode>("compact");

  const formatPendingKeyLabel = (key: string) => {
    const keyLabels: Record<string, string> = {
      "pf-control-nutricion-planes-v1": "Nutricion · Planes",
      "pf-control-nutricion-alimentos-v1": "Nutricion · Alimentos",
      "pf-control-nutricion-asignaciones-v1": "Nutricion · Asignaciones",
      "pf-control-clientes-meta-v1": "Clientes · Fichas",
      "pf-control-pagos-v1": "Clientes · Pagos",
      "pf-control-sesiones": "Sesiones",
      "pf-control-semana-plan": "Semana · Plan",
      "pf-control-alumno-week-notifications": "Semana · Alertas",
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

    if (!normalized) {
      return key;
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const pendingBadgeSummary = (() => {
    if (pendingSaveKeys.length === 0) return "";
    const labels = pendingSaveKeys.slice(0, 2).map((key) => formatPendingKeyLabel(key));
    const base = labels.join(" + ");
    const rest = pendingSaveKeys.length - labels.length;
    return rest > 0 ? `${base} +${rest}` : base;
  })();

  const pushToast = (type: InlineToast["type"], message: string, title?: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const resolvedTitle =
      title ||
      (type === "success"
        ? "Cambios guardados"
        : type === "warning"
        ? "Atencion"
        : "Error");

    setToasts((prev) => [
      ...prev,
      {
        id,
        type,
        title: resolvedTitle,
        message,
        phase: "enter",
      },
    ]);

    window.setTimeout(() => {
      setToasts((prev) =>
        prev.map((item) => (item.id === id ? { ...item, phase: "exit" } : item))
      );
    }, 3200);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3850);
  };

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(NAV_CONFIG_KEY);
      const parsed = saved ? (JSON.parse(saved) as Partial<NavConfig>) : null;
      setConfig(normalizeConfig(stableLinks, parsed));
      setSidebarImage(localStorage.getItem(SIDEBAR_IMAGE_KEY));
      const savedScale = sanitizeScreenScale(localStorage.getItem(SCREEN_SCALE_KEY) || "1");
      setScreenScale(savedScale);
      localStorage.setItem(SCREEN_SCALE_KEY, String(savedScale));
      const savedDockLabelMode = localStorage.getItem(DOCK_LABEL_MODE_KEY);
      setDockLabelMode(normalizeDockLabelMode(savedDockLabelMode));
      const savedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (savedCollapsed === "1" || savedCollapsed === "0") {
        setCollapsed(savedCollapsed === "1");
      }
    } catch {
      setConfig(getDefaultConfig(stableLinks));
      setScreenScale(1);
      setCollapsed(false);
    }
  }, [stableLinks]);

  useEffect(() => {
    if (!mounted || !session?.user) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok || cancelled) {
          return;
        }

        const data = await response.json();
        const remoteImage =
          typeof data.sidebarImage === "string" && data.sidebarImage.trim()
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

        if (cancelled) {
          return;
        }

        setSidebarImage(remoteImage);
        setColaboradorAccessMap(normalizedAccess);

        if (remoteImage) {
          localStorage.setItem(SIDEBAR_IMAGE_KEY, remoteImage);
        } else {
          localStorage.removeItem(SIDEBAR_IMAGE_KEY);
        }

        window.dispatchEvent(new Event("pf-sidebar-image-updated"));
      } catch {
        // no bloquear el render del shell si falla la sincronizacion inicial
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, session?.user]);

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
        requestedType === "error"
          ? "error"
          : requestedType === "warning"
          ? "warning"
          : "success";
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
      if (event.key === SCREEN_SCALE_KEY) {
        const nextScale = sanitizeScreenScale(event.newValue || "1");
        setScreenScale(nextScale);
      }

      if (event.key === NAV_CONFIG_KEY) {
        const parsed = event.newValue
          ? (JSON.parse(event.newValue) as Partial<NavConfig>)
          : null;
        setConfig(normalizeConfig(stableLinks, parsed));
      }

      if (event.key === SIDEBAR_IMAGE_KEY) {
        setSidebarImage(event.newValue || null);
      }

      if (event.key === SIDEBAR_COLLAPSED_KEY) {
        if (event.newValue === "1" || event.newValue === "0") {
          setCollapsed(event.newValue === "1");
        }
      }

      if (event.key === DOCK_LABEL_MODE_KEY) {
        setDockLabelMode(normalizeDockLabelMode(event.newValue));
      }
    };

    const onScaleChange = () => {
      const savedScale = sanitizeScreenScale(localStorage.getItem(SCREEN_SCALE_KEY) || "1");
      setScreenScale(savedScale);
      localStorage.setItem(SCREEN_SCALE_KEY, String(savedScale));
    };

    const onNavConfigChange = () => {
      const saved = localStorage.getItem(NAV_CONFIG_KEY);
      const parsed = saved ? (JSON.parse(saved) as Partial<NavConfig>) : null;
      setConfig(normalizeConfig(stableLinks, parsed));
    };

    const onSidebarImageChange = () => {
      setSidebarImage(localStorage.getItem(SIDEBAR_IMAGE_KEY));
    };

    const onDockLabelModeChange = () => {
      const savedMode = localStorage.getItem(DOCK_LABEL_MODE_KEY);
      setDockLabelMode(normalizeDockLabelMode(savedMode));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("pf-screen-scale-updated", onScaleChange);
    window.addEventListener("pf-nav-config-updated", onNavConfigChange);
    window.addEventListener("pf-sidebar-image-updated", onSidebarImageChange);
    window.addEventListener("pf-dock-label-mode-updated", onDockLabelModeChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pf-screen-scale-updated", onScaleChange);
      window.removeEventListener("pf-nav-config-updated", onNavConfigChange);
      window.removeEventListener("pf-sidebar-image-updated", onSidebarImageChange);
      window.removeEventListener("pf-dock-label-mode-updated", onDockLabelModeChange);
    };
  }, [stableLinks]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    localStorage.setItem(NAV_CONFIG_KEY, JSON.stringify(config));
  }, [config, mounted]);

  useEffect(() => {
    setMobileOpen(false);
    setHoveredDockIndex(null);
  }, [pathname]);

  useEffect(() => {
    if (pendingSaveKeys.length === 0) {
      setPendingPanelOpen(false);
    }
  }, [pendingSaveKeys]);

  useEffect(() => {
    const nextRole = (session?.user as any)?.role;
    if (typeof nextRole === "string" && nextRole.length > 0) {
      setResolvedRole(nextRole);
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_ROLE_KEY, nextRole);
      }
    }
  }, [session?.user]);

  const role =
    ((session?.user as any)?.role as string | undefined) ??
    resolvedRole ??
    (pathname.startsWith("/admin") ? "ADMIN" : null);
  const displayName = resolveUserDisplayName(session?.user);
  const profileInitials = resolveInitials(displayName);
  const roleLabel = role === "ADMIN" ? "ADMIN" : role === "COLABORADOR" ? "COLABORADOR" : "USUARIO";
  const profileStatusText = `Panel: ${roleLabel} | PF Control`;
  const visibleLinks = useMemo(
    () =>
      stableLinks.filter((link) => {
        if (link.adminOnly && role !== "ADMIN") {
          return false;
        }

        if (role === "COLABORADOR" && COLABORADOR_ACCESS_HREFS.includes(link.href)) {
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
      }),
    [stableLinks, role, colaboradorAccessMap]
  );

  const orderedLinks = useMemo(() => {
    const linkByHref = new Map(visibleLinks.map((link) => [link.href, link]));
    return config.order
      .map((href) => linkByHref.get(href))
      .filter((link): link is NavLink => Boolean(link));
  }, [visibleLinks, config.order]);

  const [renderLinks, setRenderLinks] = useState<NavLink[]>(() =>
    getDefaultConfig(stableLinks).order
      .map((href) => stableLinks.find((link) => link.href === href))
      .filter((link): link is NavLink => Boolean(link))
  );

  useEffect(() => {
    if (orderedLinks.length > 0) {
      setRenderLinks(orderedLinks);
    }
  }, [orderedLinks]);

  useEffect(() => {
    setConfig((current) => {
      const normalized = normalizeConfig(visibleLinks, current);
      const sameOrder =
        normalized.order.length === current.order.length &&
        normalized.order.every((href, index) => href === current.order[index]);
      return sameOrder ? current : normalized;
    });
  }, [visibleLinks]);

  const handleDropOnItem = (targetHref: string) => {
    if (!dragState) {
      return;
    }

    setConfig((current) => {
      const reordered = reorderToTarget(current.order, dragState.href, targetHref);
      return { order: reordered };
    });
    setDragState(null);
  };

  const handleDropOnList = () => {
    if (!dragState) {
      return;
    }

    setConfig((current) => {
      const withoutDragged = current.order.filter((href) => href !== dragState.href);
      return { order: [...withoutDragged, dragState.href] };
    });
    setDragState(null);
  };

  const hasScaledLayout = Math.abs(screenScale - 1) > 0.001;
  const scaledStyle = hasScaledLayout
    ? ({
        transform: `scale(${screenScale})`,
        transformOrigin: "top left",
        width: `${100 / screenScale}%`,
        minHeight: `${100 / screenScale}dvh`,
      } as const)
    : undefined;

  const normalizedPathname = normalizePath(pathname);
  const dockItems: NavLink[] = renderLinks;

  const handleDockClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = normalizePath(href);
    if (target === normalizedPathname) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    router.push(href);

    // Reintento SPA no destructivo si un click queda sin transicionar.
    window.setTimeout(() => {
      if (typeof window === "undefined") return;
      if (normalizePath(window.location.pathname) !== target) {
        router.replace(href);
      }
    }, 220);
  };

  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden">
      <div className="relative">
        <div className="fixed left-4 top-4 z-[61]">
          <div className="flex items-center gap-3 rounded-[1.2rem] border border-cyan-200/35 bg-slate-900/78 px-3 py-2 shadow-[0_14px_36px_rgba(2,6,23,0.55)] backdrop-blur-xl">
            <div className="min-w-0">
              <p className="truncate text-[0.95rem] font-black leading-tight text-white">Hola! {displayName.toUpperCase()}</p>
              <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.11em] text-cyan-100/95">
                {profileStatusText}
              </p>
            </div>

            <Link
              href="/cuenta"
              prefetch={false}
              onClick={(event) => handleDockClick(event, "/cuenta")}
              className="group shrink-0 rounded-full"
              aria-label="Ir a cuenta"
              title="Ir a cuenta"
            >
              {sidebarImage ? (
                <img
                  src={sidebarImage}
                  alt="Abrir cuenta"
                  className="h-14 w-14 rounded-full border border-cyan-100/45 object-cover shadow-[0_10px_24px_rgba(2,6,23,0.5)] transition-transform duration-150 group-hover:scale-[1.04]"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-100/45 bg-cyan-500/25 text-sm font-black text-cyan-50 shadow-[0_10px_24px_rgba(2,6,23,0.5)] transition-transform duration-150 group-hover:scale-[1.04]">
                  {profileInitials}
                </span>
              )}
            </Link>
          </div>
        </div>

        {pendingSaveKeys.length > 0 ? (
          <div className="fixed left-4 top-[5.35rem] z-[59] pointer-events-none">
            <div className="pointer-events-auto space-y-2">
              <button
                type="button"
                onClick={() => setPendingPanelOpen((prev) => !prev)}
                className="rounded-xl border border-amber-300/45 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100 shadow-lg backdrop-blur-md"
              >
                Cambios pendientes de guardar ({pendingSaveKeys.length})
                {pendingBadgeSummary ? ` · ${pendingBadgeSummary}` : ""}
              </button>

              {pendingPanelOpen ? (
                <div className="w-[min(92vw,340px)] rounded-xl border border-amber-200/35 bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur-md">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
                    Modulos pendientes
                  </p>
                  <div className="mt-2 max-h-56 space-y-1 overflow-auto">
                    {pendingSaveKeys.map((key) => (
                      <div
                        key={key}
                        className="rounded-md border border-white/10 bg-slate-800/80 px-2 py-1.5"
                      >
                        <p className="text-xs font-semibold text-slate-100">{formatPendingKeyLabel(key)}</p>
                        <p className="text-[10px] text-slate-400">{key}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-300">
                    Recordatorio: los cambios se suben cuando presionas Guardar en cada pantalla.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pf-ios-toast rounded-[1.4rem] border px-4 py-3 shadow-2xl backdrop-blur-xl ${
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
                  className={`pf-ios-toast-icon mt-0.5 h-7 w-7 shrink-0 rounded-full border text-center text-sm leading-7 ${
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
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-90">
                    {toast.title}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5">{toast.message}</p>
                </div>
              </div>
              <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-black/20">
                <div className="pf-ios-toast-progress h-full rounded-full bg-white/70" />
              </div>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>
        <div className="pb-28 pt-4 md:pb-32" style={scaledStyle}>
          {children}
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-[120] px-2 pb-[env(safe-area-inset-bottom)]"
        onMouseLeave={() => setHoveredDockIndex(null)}
      >
        <div className="mx-auto w-full max-w-[1120px] overflow-visible">
          <div className="pointer-events-auto w-full overflow-visible rounded-[1.45rem] border border-white/28 bg-[linear-gradient(180deg,rgba(15,23,42,0.56),rgba(2,6,23,0.44))] px-2.5 py-2.5 shadow-[0_16px_40px_rgba(2,6,23,0.5)] backdrop-blur-2xl">
          <div className="flex items-end gap-2">
            <div className="pf-dock-scroll min-w-0 flex-1 overflow-x-auto overflow-y-visible py-1">
              <div className="flex w-max min-w-full items-end justify-center gap-2 px-1.5 md:px-2">
                {sidebarImage ? (
                  <img
                    src={sidebarImage}
                    alt="Perfil"
                    className="h-9 w-9 shrink-0 rounded-xl border border-white/20 object-cover"
                  />
                ) : null}

                {dockItems.map((link, index) => {
                  const hasChildLink = dockItems.some(
                    (candidate) =>
                      candidate.href !== link.href && candidate.href.startsWith(`${link.href}/`)
                  );
                  const normalizedHref = normalizePath(link.href);
                  const isCurrent =
                    normalizedPathname === normalizedHref ||
                    (!hasChildLink && normalizedHref !== "/" && normalizedPathname.startsWith(`${normalizedHref}/`));
                  const labelText = dockLabelMode === "compact" ? compactDockLabel(link.label) : link.label;

                  return (
                    <div key={link.href} className="flex items-end">
                      <Link
                        href={link.href}
                        prefetch={false}
                        onClick={(event) => handleDockClick(event, link.href)}
                        onMouseEnter={() => setHoveredDockIndex(index)}
                        onFocus={() => setHoveredDockIndex(index)}
                        onBlur={() => setHoveredDockIndex(null)}
                        className="group relative flex shrink-0 touch-manipulation flex-col items-center"
                        title={link.label}
                        aria-current={isCurrent ? "page" : undefined}
                        aria-label={link.label}
                      >
                        <span
                          className={`relative flex h-[2.95rem] w-[2.95rem] items-center justify-center rounded-2xl border pt-[1px] text-[1.15rem] leading-none shadow-[0_8px_18px_rgba(2,6,23,0.45)] transition-colors duration-150 md:h-[3.1rem] md:w-[3.1rem] md:text-[1.22rem] ${
                            isCurrent
                              ? "border-cyan-200/65 bg-cyan-400/20"
                              : "border-white/18 bg-slate-900/80"
                          }`}
                        >
                          {link.icon}
                        </span>

                        <span
                          className={`mt-1 h-1.5 w-1.5 rounded-full transition-opacity duration-150 ${
                            isCurrent ? "bg-cyan-200 opacity-100" : "bg-white/40 opacity-0 group-hover:opacity-80"
                          }`}
                        />

                        {dockLabelMode !== "icon" ? (
                          <span
                            className={`mt-1 w-[3.25rem] truncate text-center text-[9.5px] font-semibold leading-[0.72rem] transition-colors duration-150 ${
                              hoveredDockIndex === index || isCurrent ? "text-cyan-100" : "text-slate-300"
                            }`}
                          >
                            {labelText}
                          </span>
                        ) : null}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </div>
      </nav>
    </div>
  );
}
