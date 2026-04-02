"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
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

export default function AppShell({ links, children }: AppShellProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const linksSignature = links
    .map((link) => `${link.href}|${link.label}|${link.icon}|${link.tone}|${link.adminOnly ? "1" : "0"}`)
    .join("||");
  const stableLinks = useMemo(() => links, [linksSignature]);
  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") {
      return { width: 1366, height: 768 };
    }

    return { width: window.innerWidth, height: window.innerHeight };
  });
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
  const [toasts, setToasts] = useState<InlineToast[]>([]);
  const [pendingSaveKeys, setPendingSaveKeys] = useState<string[]>([]);
  const [pendingPanelOpen, setPendingPanelOpen] = useState(false);
  const [sidebarSelectedHref, setSidebarSelectedHref] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    void (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      } catch {
        // evitar bloquear la app si no se puede limpiar cache/sw
      }
    })();
  }, []);

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
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(NAV_CONFIG_KEY);
      const parsed = saved ? (JSON.parse(saved) as Partial<NavConfig>) : null;
      setConfig(normalizeConfig(stableLinks, parsed));
      setSidebarImage(localStorage.getItem(SIDEBAR_IMAGE_KEY));
      const savedScale = Number(localStorage.getItem(SCREEN_SCALE_KEY) || "1");
      setScreenScale(Number.isFinite(savedScale) && savedScale > 0 ? savedScale : 1);
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
        const nextScale = Number(event.newValue || "1");
        setScreenScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
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
    };

    const onScaleChange = () => {
      const savedScale = Number(localStorage.getItem(SCREEN_SCALE_KEY) || "1");
      setScreenScale(Number.isFinite(savedScale) && savedScale > 0 ? savedScale : 1);
    };

    const onNavConfigChange = () => {
      const saved = localStorage.getItem(NAV_CONFIG_KEY);
      const parsed = saved ? (JSON.parse(saved) as Partial<NavConfig>) : null;
      setConfig(normalizeConfig(stableLinks, parsed));
    };

    const onSidebarImageChange = () => {
      setSidebarImage(localStorage.getItem(SIDEBAR_IMAGE_KEY));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("pf-screen-scale-updated", onScaleChange);
    window.addEventListener("pf-nav-config-updated", onNavConfigChange);
    window.addEventListener("pf-sidebar-image-updated", onSidebarImageChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pf-screen-scale-updated", onScaleChange);
      window.removeEventListener("pf-nav-config-updated", onNavConfigChange);
      window.removeEventListener("pf-sidebar-image-updated", onSidebarImageChange);
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
  }, [pathname]);

  useEffect(() => {
    setSidebarSelectedHref(null);
  }, [pathname]);

  useEffect(() => {
    if (pendingSaveKeys.length === 0) {
      setPendingPanelOpen(false);
    }
  }, [pendingSaveKeys]);

  const role = (session?.user as any)?.role;
  const visibleLinks = stableLinks.filter((link) => {
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
  });

  const linkByHref = new Map(visibleLinks.map((link) => [link.href, link]));

  const orderedLinks = config.order
    .map((href) => linkByHref.get(href))
    .filter((link): link is NavLink => Boolean(link));

  useEffect(() => {
    setConfig((current) => normalizeConfig(visibleLinks, current));
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

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

  const navigateSidebar = (href: string) => {
    setMobileOpen(false);
    setSidebarSelectedHref(href);

    const avoidHardReload =
      COLABORADOR_CATEGORY_HREFS.includes(href) ||
      href.startsWith("/categorias/") ||
      href.startsWith("/deportes") ||
      href.startsWith("/equipos");

    if (normalizePath(pathname) === normalizePath(href)) {
      return;
    }

    if (typeof window === "undefined") {
      router.push(href);
      return;
    }

    const targetPath = normalizePath(href);
    router.prefetch(href);
    router.push(href);

    window.setTimeout(() => {
      const pushedPath = normalizePath(window.location.pathname);
      if (pushedPath !== targetPath) {
        router.replace(href);

        window.setTimeout(() => {
          const replacedPath = normalizePath(window.location.pathname);
          if (!avoidHardReload && replacedPath !== targetPath) {
            window.location.assign(href);
          }
        }, 220);
      }
    }, 180);
  };

  const scaledStyle = {
    transform: `scale(${screenScale})`,
    transformOrigin: "top left",
    width: `${100 / screenScale}%`,
    minHeight: `${100 / screenScale}dvh`,
  } as const;

  const transitionKey =
    (() => {
      if (pathname === "/") {
        return "/";
      }

      const firstSegment = `/${pathname.split("/").filter(Boolean)[0] || ""}`;
      if (COLABORADOR_CATEGORY_HREFS.includes(firstSegment)) {
        return "/categorias-grupo";
      }

      return firstSegment;
    })();

  const isWideSidebar = viewport.width >= 1800 && viewport.height >= 860;
  const isCompactSidebar = viewport.width <= 1300 || viewport.height <= 760;

  const desktopExpandedWidthClass = isWideSidebar
    ? "lg:w-[19.5rem]"
    : isCompactSidebar
    ? "lg:w-[16.75rem]"
    : "lg:w-[18rem]";

  const desktopCollapsedWidthClass = "lg:w-[4.75rem]";

  const shellExpandedPaddingClass = isWideSidebar
    ? "lg:pl-[19.5rem]"
    : isCompactSidebar
    ? "lg:pl-[16.75rem]"
    : "lg:pl-[18rem]";

  const shellCollapsedPaddingClass = "lg:pl-[4.75rem]";

  const sidebarPaddingClass = isCompactSidebar ? "p-3" : "p-4";
  const navPanelPaddingClass = isCompactSidebar ? "p-2" : "p-2.5";
  const navGapClass = isCompactSidebar ? "gap-1" : "gap-1.5";
  const navButtonPaddingClass = isCompactSidebar
    ? "px-2.5 py-2"
    : "px-3 py-2.5";
  const navIconTextClass = isCompactSidebar ? "text-[1.1rem]" : "text-[1.2rem]";
  const footerButtonPaddingClass = isCompactSidebar
    ? "px-2.5 py-2 text-[0.76rem]"
    : "px-3 py-2.5 text-[0.8rem]";
  const footerSpacingClass = isCompactSidebar ? "mt-2 gap-1.5" : "mt-3 gap-2";

  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  return (
    <div
      className={`relative min-h-[100svh] overflow-x-hidden transition-[padding] duration-300 ${
        collapsed ? shellCollapsedPaddingClass : shellExpandedPaddingClass
      }`}
    >
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg border border-white/20 bg-slate-900/90 px-3 py-2 text-sm font-bold text-white shadow-lg lg:hidden"
      >
        Menu
      </button>

      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-label="Cerrar menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 h-[100svh] max-h-[100svh] border-r border-cyan-200/15 bg-gradient-to-b from-[#051325] via-[#071a33] to-[#040b1a] shadow-[0_24px_64px_rgba(3,10,28,0.62)] backdrop-blur-md ${
          collapsed
            ? `w-[4.75rem] ${desktopCollapsedWidthClass}`
            : `w-[min(88vw,18rem)] ${desktopExpandedWidthClass}`
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-300/15 to-transparent" />
          <div className="absolute -left-10 top-24 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${sidebarPaddingClass}`}>
          <div className={`mb-3 flex items-start ${collapsed ? "justify-center" : "justify-between"} gap-2`}>
            {!collapsed ? (
              <div className="min-w-0">
                {sidebarImage && (
                  <img
                    src={sidebarImage}
                    alt="Imagen lateral"
                    className="mb-2 h-10 w-10 rounded-lg border border-white/20 object-cover"
                  />
                )}
                <p className="text-[1.05rem] font-black tracking-tight text-sky-100">PF Control</p>
                <p className="text-[0.68rem] text-sky-200/80">Gestion deportiva</p>
              </div>
            ) : null}

            {collapsed && sidebarImage ? (
              <img
                src={sidebarImage}
                alt="Imagen lateral"
                className="h-9 w-9 rounded-lg border border-white/20 object-cover"
              />
            ) : null}

            <button
              onClick={toggleCollapsed}
              className="rounded-lg border border-sky-200/30 bg-slate-800/70 px-2 py-1 text-[0.68rem] font-bold text-sky-100"
            >
              {collapsed ? ">>" : "<<"}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <nav
              className={`flex h-full flex-col rounded-2xl border border-cyan-200/20 bg-[#071429]/86 ${navPanelPaddingClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`}
            >
              {!collapsed ? (
                <p className="mb-2 px-1 text-[0.6rem] font-black uppercase tracking-[0.22em] text-sky-200/80">
                  Menu
                </p>
              ) : null}
              <div className={`grid content-start ${navGapClass}`}>
                {orderedLinks.map((link) => {
                  const effectivePath = sidebarSelectedHref || pathname;
                  const hasChildLink = orderedLinks.some(
                    (candidate) =>
                      candidate.href !== link.href && candidate.href.startsWith(`${link.href}/`)
                  );
                  const isActive =
                    effectivePath === link.href ||
                    (!hasChildLink && link.href !== "/" && effectivePath.startsWith(`${link.href}/`));

                  return (
                    <button
                      key={link.href}
                      type="button"
                      onClick={() => navigateSidebar(link.href)}
                      className={`group relative flex w-full items-center rounded-xl border font-semibold text-white transition-colors ${navButtonPaddingClass} ${
                        collapsed ? "justify-center" : "justify-start gap-3"
                      } ${
                        isActive
                          ? "border-cyan-300/50 bg-cyan-400/14 text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.2)]"
                          : "border-white/10 bg-slate-900/45 text-sky-100/95 hover:bg-slate-800/65"
                      }`}
                      title={link.label}
                    >
                      {!collapsed && (
                        <span
                          className={`absolute inset-y-2 left-0 w-[2px] rounded-r ${
                            isActive ? "bg-cyan-200" : "bg-transparent"
                          }`}
                        />
                      )}

                      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                        <span className={`${collapsed ? "text-[1.18rem]" : navIconTextClass} select-none font-normal leading-none`}>
                          {link.icon}
                        </span>
                      </span>

                      {!collapsed && (
                        <span className="truncate text-left text-[0.82rem] font-semibold tracking-[0.01em] text-sky-100">
                          {link.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

            <div className={`grid ${footerSpacingClass}`}>
              <button
                type="button"
                onClick={() => navigateSidebar("/cuenta")}
                className={`rounded-xl border font-semibold transition-none ${footerButtonPaddingClass} ${
                  pathname === "/cuenta"
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                    : "border-white/15 bg-slate-800/60 text-slate-100 hover:bg-slate-800/90"
                }`}
                title="Cuenta"
              >
                {collapsed ? "👤" : "👤 Cuenta"}
              </button>

              <button
                onClick={() => signOut({ callbackUrl: "/auth/login" })}
                className={`w-full rounded-xl border border-rose-500/30 bg-rose-500/10 font-semibold text-rose-300 transition-none hover:bg-rose-500/20 hover:text-rose-100 ${footerButtonPaddingClass}`}
                title="Cerrar sesión"
              >
                {collapsed ? "🚪" : "🚪 Cerrar sesión"}
              </button>
            </div>
        </div>
      </aside>

      <div className={`relative transition-all duration-300 ${collapsed ? "lg:ml-0" : "lg:ml-0"}`}>
        {pendingSaveKeys.length > 0 ? (
          <div className="fixed left-4 top-4 z-[59] pointer-events-none">
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
        <div key={transitionKey} className="pf-route-enter pt-16 lg:pt-0" style={scaledStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}
