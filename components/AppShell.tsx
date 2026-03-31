"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  "/nueva-sesion",
  "/plantel",
  "/clientes",
  "/admin/whatsapp",
];

const NAV_CONFIG_KEY = "pf-control-nav-config-v1";
const SIDEBAR_IMAGE_KEY = "pf-control-sidebar-image-v1";
const SCREEN_SCALE_KEY = "pf-control-screen-scale-v1";
const SW_VERSION = "20260331-2";
const SW_URL = `/pf-sw.js?v=${SW_VERSION}`;

type NavConfig = {
  order: string[];
};

type AccountNavConfigPayload = {
  order?: unknown;
};

type SessionUserRole = {
  role?: string;
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

const getDisplayNameFromSession = (sessionUser: { name?: string | null } | null | undefined): string => {
  const rawName = (sessionUser?.name || "").trim();
  if (rawName.length > 0) {
    const first = rawName.split(/\s+/)[0] || rawName;
    return first.charAt(0).toUpperCase() + first.slice(1);
  }

  return "Profe";
};

export default function AppShell({ links, children }: AppShellProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [viewport, setViewport] = useState({ width: 1366, height: 768 });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<NavConfig>(() => getDefaultConfig(links));
  const [dragState, setDragState] = useState<{ href: string } | null>(null);
  const [sidebarImage, setSidebarImage] = useState<string | null>(null);
  const [screenScale, setScreenScale] = useState(1);
  const [toasts, setToasts] = useState<InlineToast[]>([]);
  const [pendingSaveKeys, setPendingSaveKeys] = useState<string[]>([]);
  const [pendingPanelOpen, setPendingPanelOpen] = useState(false);
  const [navPresetLocked, setNavPresetLocked] = useState(true);
  const [accountSyncReady, setAccountSyncReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const lastSyncedNavPayloadRef = useRef<string>("");
  const lastOnlineStatusRef = useRef<boolean | null>(null);

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

  const notifyConnectionStatus = (title: string, body: string, tag: string) => {
    if (typeof window === "undefined") {
      return;
    }

    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const payload = {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag,
    };

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(title, payload))
        .catch(() => {
          new Notification(title, payload);
        });
      return;
    }

    new Notification(title, payload);
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
      setConfig(normalizeConfig(links, parsed));
      setSidebarImage(localStorage.getItem(SIDEBAR_IMAGE_KEY));
      const savedScale = Number(localStorage.getItem(SCREEN_SCALE_KEY) || "1");
      setScreenScale(Number.isFinite(savedScale) && savedScale > 0 ? savedScale : 1);
    } catch {
      setConfig(getDefaultConfig(links));
      setScreenScale(1);
    }

    setAccountSyncReady(false);
  }, [links]);

  useEffect(() => {
    if (!mounted || !("serviceWorker" in navigator)) {
      return;
    }

    let isRefreshing = false;

    const handleControllerChange = () => {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void navigator.serviceWorker
      .register(SW_URL)
      .then(async (registration) => {
        await registration.update();

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) {
            return;
          }

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {
        // el shell sigue funcionando aunque falle el registro del SW
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") {
      return;
    }

    const isAdminSession =
      ((session?.user as SessionUserRole | undefined)?.role || "") === "ADMIN";

    const applyConnectionStatus = (online: boolean, shouldNotify: boolean) => {
      if (lastOnlineStatusRef.current === online) {
        return;
      }

      lastOnlineStatusRef.current = online;
      setIsOffline(!online);

      if (!shouldNotify) {
        return;
      }

      if (online) {
        pushToast(
          "success",
          "De vuelta en linea. Recuperamos la sincronizacion automaticamente.",
          "Conexion restablecida"
        );
        notifyConnectionStatus(
          "PF Control",
          "De vuelta en linea. La app retomo la sincronizacion.",
          "pf-connection-online"
        );
        return;
      }

      pushToast(
        "warning",
        "Modo sin conexion activado. Podes navegar y ver datos guardados, pero editar requiere internet.",
        "Sin conexion"
      );
      notifyConnectionStatus(
        "PF Control",
        "Modo sin conexion activado. Navegacion y consulta disponibles; para guardar cambios necesitas internet.",
        "pf-connection-offline"
      );
    };

    applyConnectionStatus(window.navigator.onLine, false);

    const handleOnline = () => applyConnectionStatus(true, isAdminSession);
    const handleOffline = () => applyConnectionStatus(false, isAdminSession);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [mounted, session?.user]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined" || !session?.user?.id) {
      return;
    }

    let cancelled = false;

    const sendPresenceHeartbeat = () => {
      if (cancelled || !navigator.onLine) {
        return;
      }

      void fetch("/api/account/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: window.location.pathname }),
        keepalive: true,
      }).catch(() => {
        // no interrumpimos la UX por errores de heartbeat
      });
    };

    const handleFocus = () => sendPresenceHeartbeat();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendPresenceHeartbeat();
      }
    };

    sendPresenceHeartbeat();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        sendPresenceHeartbeat();
      }
    }, 45_000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted, pathname, session?.user?.id]);

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
        const remoteNavPayload =
          data.navConfig && typeof data.navConfig === "object"
            ? (data.navConfig as AccountNavConfigPayload)
            : null;
        const remoteOrderRaw = remoteNavPayload?.order;
        const hasRemoteOrder = Array.isArray(remoteOrderRaw);
        const remoteNavConfig = hasRemoteOrder
          ? normalizeConfig(links, {
              order: remoteOrderRaw.filter(
                (item): item is string => typeof item === "string"
              ),
            })
          : null;
        const remoteLock = typeof data.navPresetLocked === "boolean" ? data.navPresetLocked : true;

        if (cancelled) {
          return;
        }

        setSidebarImage(remoteImage);
        if (remoteNavConfig) {
          setConfig(remoteNavConfig);
          localStorage.setItem(NAV_CONFIG_KEY, JSON.stringify(remoteNavConfig));
        }
        setNavPresetLocked(remoteLock);

        if (remoteImage) {
          localStorage.setItem(SIDEBAR_IMAGE_KEY, remoteImage);
        } else {
          localStorage.removeItem(SIDEBAR_IMAGE_KEY);
        }

        const localOrderFallback = (() => {
          try {
            const saved = localStorage.getItem(NAV_CONFIG_KEY);
            const parsed = saved ? (JSON.parse(saved) as Partial<NavConfig>) : null;
            return normalizeConfig(links, parsed).order;
          } catch {
            return getDefaultConfig(links).order;
          }
        })();

        lastSyncedNavPayloadRef.current = JSON.stringify({
          order: remoteNavConfig ? remoteNavConfig.order : localOrderFallback,
          locked: remoteLock,
        });
        window.dispatchEvent(new Event("pf-sidebar-image-updated"));
      } catch {
        // no bloquear el render del shell si falla la sincronizacion inicial
      } finally {
        if (!cancelled) {
          setAccountSyncReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [links, mounted, session?.user]);

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
        setConfig(normalizeConfig(links, parsed));
      }

      if (event.key === SIDEBAR_IMAGE_KEY) {
        setSidebarImage(event.newValue || null);
      }
    };

    const onScaleChange = () => {
      const savedScale = Number(localStorage.getItem(SCREEN_SCALE_KEY) || "1");
      setScreenScale(Number.isFinite(savedScale) && savedScale > 0 ? savedScale : 1);
    };

    const onNavConfigChange = () => {
      const saved = localStorage.getItem(NAV_CONFIG_KEY);
      const parsed = saved ? (JSON.parse(saved) as Partial<NavConfig>) : null;
      setConfig(normalizeConfig(links, parsed));
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
  }, [links]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    localStorage.setItem(NAV_CONFIG_KEY, JSON.stringify(config));
  }, [config, mounted]);

  useEffect(() => {
    if (!mounted || !session?.user || !accountSyncReady) {
      return;
    }

    const payload = {
      navConfig: config,
      navPresetLocked,
    };
    const payloadFingerprint = JSON.stringify({
      order: config.order,
      locked: navPresetLocked,
    });

    if (lastSyncedNavPayloadRef.current === payloadFingerprint) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((response) => {
        if (response.ok) {
          lastSyncedNavPayloadRef.current = payloadFingerprint;
        }
      });
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [accountSyncReady, config, mounted, navPresetLocked, session?.user]);

  useEffect(() => {
    if (!mounted || !session?.user) {
      return;
    }

    let cancelled = false;
    let inFlight = false;

    const syncSidebarImage = async () => {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;
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
        const localImageRaw = localStorage.getItem(SIDEBAR_IMAGE_KEY);
        const localImage = localImageRaw && localImageRaw.trim() ? localImageRaw : null;

        if (remoteImage === localImage) {
          return;
        }

        setSidebarImage(remoteImage);
        if (remoteImage) {
          localStorage.setItem(SIDEBAR_IMAGE_KEY, remoteImage);
        } else {
          localStorage.removeItem(SIDEBAR_IMAGE_KEY);
        }
        window.dispatchEvent(new Event("pf-sidebar-image-updated"));
      } catch {
        // no bloquear navegacion si falla el refresco remoto
      } finally {
        inFlight = false;
      }
    };

    const onFocus = () => {
      void syncSidebarImage();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncSidebarImage();
      }
    };

    const onOnline = () => {
      void syncSidebarImage();
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncSidebarImage();
      }
    }, 45000);

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void syncSidebarImage();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [mounted, session?.user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pendingSaveKeys.length === 0) {
      setPendingPanelOpen(false);
    }
  }, [pendingSaveKeys]);

  useEffect(() => {
    if (navPresetLocked) {
      setDragState(null);
    }
  }, [navPresetLocked]);

  const role = (session?.user as SessionUserRole | undefined)?.role;
  const alumnoAllowedHrefs = new Set([
    "/alumno/inicio",
    "/alumno/rutina",
    "/alumno/nutricion",
    "/alumno/medidas",
    "/alumno/progreso",
    "/alumno/ejercicio",
    "/cuenta",
  ]);
  const visibleLinks = links.filter((link) => {
    if (role === "CLIENTE") {
      return alumnoAllowedHrefs.has(link.href);
    }

    if (link.href.startsWith("/alumno/")) {
      return false;
    }

    return !link.adminOnly || role === "ADMIN";
  });

  const linkByHref = new Map(visibleLinks.map((link) => [link.href, link]));

  const orderedLinks = config.order
    .map((href) => linkByHref.get(href))
    .filter((link): link is NavLink => Boolean(link));

  useEffect(() => {
    setConfig((current) => normalizeConfig(visibleLinks, current));
  }, [role, links]);

  const handleDropOnItem = (targetHref: string) => {
    if (!dragState || navPresetLocked) {
      return;
    }

    setConfig((current) => {
      const reordered = reorderToTarget(current.order, dragState.href, targetHref);
      return { order: reordered };
    });
    setDragState(null);
  };

  const handleDropOnList = () => {
    if (!dragState || navPresetLocked) {
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
      return next;
    });
  };

  const navigateWithFallback = (targetHref: string) => {
    if (typeof window === "undefined") {
      return;
    }

    setMobileOpen(false);

    const targetPathname = (() => {
      try {
        return new URL(targetHref, window.location.origin).pathname;
      } catch {
        return targetHref;
      }
    })();

    try {
      router.push(targetHref);

      window.setTimeout(() => {
        if (window.location.pathname !== targetPathname) {
          window.location.assign(targetHref);
        }
      }, 280);
    } catch {
      window.location.assign(targetHref);
    }
  };

  const isPhoneViewport = viewport.width <= 768;
  const isTabletViewport = viewport.width > 768 && viewport.width <= 1200;
  const isTouchDrawerViewport = viewport.width < 1024;
  const isSmallViewport = viewport.width <= 1200;
  const effectiveScale = isSmallViewport ? 1 : screenScale;
  const contentScaledStyle =
    effectiveScale === 1
      ? ({ minHeight: "100dvh" } as const)
      : ({
          transform: `scale(${effectiveScale})`,
          transformOrigin: "top left",
          width: `${100 / effectiveScale}%`,
          minHeight: `${100 / effectiveScale}dvh`,
        } as const);

  const isUltraWideSidebar = viewport.width >= 1920 && viewport.height >= 900;
  const isCompactSidebar = viewport.height <= 840 || viewport.width <= 1400;
  const isUltraCompactSidebar = viewport.height <= 740;
  const isShortViewport = viewport.height <= 860;
  const isSidebarTightMode =
    (!isTouchDrawerViewport && viewport.height <= 900) || orderedLinks.length >= 14;
  const displayName = getDisplayNameFromSession(session?.user);

  const desktopExpandedWidthClass = isUltraWideSidebar
    ? "lg:w-80"
    : isUltraCompactSidebar
    ? "lg:w-64"
    : isCompactSidebar
    ? "lg:w-[19.5rem]"
    : "lg:w-[20.5rem]";

  const desktopCollapsedWidthClass = isUltraWideSidebar
    ? "lg:w-24"
    : isUltraCompactSidebar
    ? "lg:w-16"
    : "lg:w-20";

  const shellExpandedPaddingClass = isUltraWideSidebar
    ? "lg:pl-80"
    : isUltraCompactSidebar
    ? "lg:pl-64"
    : isCompactSidebar
    ? "lg:pl-[19.5rem]"
    : "lg:pl-[20.5rem]";

  const shellCollapsedPaddingClass = isUltraWideSidebar
    ? "lg:pl-24"
    : isUltraCompactSidebar
    ? "lg:pl-16"
    : "lg:pl-20";

  const shellPaddingClass = isTouchDrawerViewport
    ? ""
    : collapsed
    ? shellCollapsedPaddingClass
    : shellExpandedPaddingClass;

  const headerPaddingClass = isPhoneViewport
    ? "p-3.5"
    : isTabletViewport
    ? "p-[clamp(0.65rem,1.2vh,0.95rem)]"
    : isUltraWideSidebar
    ? "p-[clamp(0.95rem,1.2vh,1.35rem)]"
    : isUltraCompactSidebar
    ? "p-[clamp(0.5rem,1.2vh,0.85rem)]"
    : "p-[clamp(0.6rem,1.6vh,1.25rem)] lg:p-[clamp(0.7rem,1.8vh,1.35rem)]";

  const navGapClass = isPhoneViewport
    ? "gap-2.5"
    : isTabletViewport
    ? "gap-[clamp(0.3rem,0.9vh,0.5rem)]"
    : isSidebarTightMode
    ? "gap-[clamp(0.16rem,0.35vh,0.24rem)]"
    : isUltraWideSidebar
    ? "gap-[clamp(0.38rem,0.85vh,0.6rem)]"
    : isUltraCompactSidebar
    ? "gap-[clamp(0.22rem,0.5vh,0.35rem)]"
    : "gap-[clamp(0.34rem,0.9vh,0.62rem)]";

  const navButtonHeightClass = isPhoneViewport
    ? "min-h-[2.9rem]"
    : isTabletViewport
    ? "min-h-[2.8rem]"
    : isSidebarTightMode
    ? "min-h-[2.18rem]"
    : isShortViewport
    ? "min-h-[2.45rem]"
    : isUltraCompactSidebar
    ? "min-h-[2.55rem]"
    : "min-h-[2.75rem]";

  const navButtonPaddingClass = isPhoneViewport
    ? "px-3.5 py-3 text-[0.98rem]"
    : isTabletViewport
    ? "px-[clamp(0.55rem,1.5vw,0.8rem)] py-[clamp(0.35rem,0.9vh,0.58rem)] text-[clamp(0.8rem,1.65vh,0.95rem)]"
    : isSidebarTightMode
    ? "px-[clamp(0.48rem,0.95vw,0.62rem)] py-[clamp(0.25rem,0.45vh,0.34rem)] text-[clamp(0.74rem,1.2vh,0.84rem)]"
    : isShortViewport
    ? "px-[clamp(0.55rem,1.15vw,0.72rem)] py-[clamp(0.32rem,0.65vh,0.46rem)] text-[clamp(0.8rem,1.38vh,0.9rem)]"
    : isUltraWideSidebar
    ? "px-[clamp(0.7rem,1.25vw,1rem)] py-[clamp(0.48rem,1vh,0.78rem)] text-[clamp(0.9rem,1.6vh,1.05rem)]"
    : isUltraCompactSidebar
    ? "px-[clamp(0.54rem,1.1vw,0.72rem)] py-[clamp(0.36rem,0.75vh,0.52rem)] text-[clamp(0.8rem,1.45vh,0.9rem)]"
    : "px-[clamp(0.64rem,1.7vw,0.92rem)] py-[clamp(0.44rem,1vh,0.72rem)] text-[clamp(0.9rem,1.65vh,1.02rem)]";

  const footerButtonPaddingClass = isPhoneViewport
    ? "px-3.5 py-3 text-[0.95rem]"
    : isTabletViewport
    ? "px-[clamp(0.55rem,1.4vw,0.8rem)] py-[clamp(0.35rem,0.9vh,0.58rem)] text-[clamp(0.8rem,1.6vh,0.95rem)]"
    : isSidebarTightMode
    ? "px-[clamp(0.5rem,1vw,0.66rem)] py-[clamp(0.26rem,0.48vh,0.36rem)] text-[clamp(0.74rem,1.18vh,0.84rem)]"
    : isUltraWideSidebar
    ? "px-[clamp(0.7rem,1.25vw,1rem)] py-[clamp(0.48rem,1vh,0.78rem)] text-[clamp(0.88rem,1.55vh,1rem)]"
    : "px-[clamp(0.6rem,1.6vw,0.9rem)] py-[clamp(0.4rem,0.95vh,0.7rem)] text-[clamp(0.8rem,1.5vh,0.95rem)]";

  useEffect(() => {
    if (isTouchDrawerViewport && collapsed) {
      setCollapsed(false);
    }
  }, [collapsed, isTouchDrawerViewport]);

  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="min-h-[100svh] bg-slate-950" aria-busy="true" aria-live="polite" />
    );
  }

  return (
    <div
      className={`relative min-h-[100svh] overflow-x-hidden transition-[padding] duration-300 ${shellPaddingClass}`}
    >
      <button
        onClick={() => setMobileOpen(true)}
        className={`fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 rounded-2xl border border-cyan-200/35 bg-slate-900/95 px-4 py-2.5 text-[0.92rem] font-bold text-cyan-50 shadow-[0_10px_30px_rgba(8,47,73,0.45)] ${
          isTouchDrawerViewport ? "" : "hidden"
        }`}
      >
        Menu
      </button>

      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className={`fixed inset-0 z-30 bg-slate-950/75 backdrop-blur-[2px] ${
            isTouchDrawerViewport ? "" : "hidden"
          }`}
          aria-label="Cerrar menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 h-[100svh] max-h-[100svh] border-r border-white/15 bg-slate-900/95 backdrop-blur-md transition-all duration-300 ${
          isPhoneViewport
            ? "inset-y-2 left-2 h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-[min(92vw,25rem)] rounded-3xl border border-cyan-200/20 shadow-[0_24px_70px_rgba(2,12,27,0.65)]"
            : isTouchDrawerViewport && isTabletViewport
            ? "inset-y-3 left-3 h-[calc(100svh-1.5rem)] max-h-[calc(100svh-1.5rem)] w-[min(68vw,24rem)] rounded-3xl border border-cyan-200/20 shadow-[0_20px_60px_rgba(2,12,27,0.55)]"
            : collapsed
            ? `w-20 ${desktopCollapsedWidthClass}`
            : `w-[min(94vw,22rem)] md:w-[min(84vw,24rem)] ${desktopExpandedWidthClass}`
        } ${mobileOpen || !isTouchDrawerViewport ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -left-12 top-0 h-36 w-36 rounded-full bg-cyan-500/30 blur-3xl" />
          <div className="absolute right-0 top-16 h-32 w-32 rounded-full bg-fuchsia-500/25 blur-3xl" />
        </div>

        <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${isPhoneViewport ? "px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.9rem,env(safe-area-inset-top))]" : headerPaddingClass}`}>
          {collapsed && sidebarImage && (
            <div className="mb-[clamp(0.25rem,0.9vh,0.75rem)] flex justify-center">
              <img
                src={sidebarImage}
                alt="Imagen lateral"
                className="h-[clamp(2.2rem,4.5vh,2.8rem)] w-[clamp(2.2rem,4.5vh,2.8rem)] rounded-full border border-cyan-200/35 object-cover"
              />
            </div>
          )}

          <div className={`${isSidebarTightMode ? "mb-1.5" : isShortViewport ? "mb-2" : "mb-[clamp(0.35rem,1.1vh,1rem)]"} flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2`}>
            {!collapsed && (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {sidebarImage && !isUltraCompactSidebar ? (
                  <img
                    src={sidebarImage}
                    alt="Imagen lateral"
                    className={`${isSidebarTightMode ? "h-[2.05rem] w-[2.05rem]" : isShortViewport ? "h-[2.35rem] w-[2.35rem]" : "h-[2.75rem] w-[2.75rem]"} shrink-0 rounded-full border border-cyan-200/35 object-cover`}
                  />
                ) : null}

                <div className="min-w-0">
                  {!isTouchDrawerViewport ? (
                    <p className="truncate text-[clamp(0.68rem,1.15vh,0.78rem)] font-semibold text-cyan-200">Bienvenido profe {displayName}</p>
                  ) : null}
                  <p className={`${isPhoneViewport ? "text-[1.08rem]" : "text-[clamp(0.95rem,2.3vh,1.25rem)]"} truncate font-black tracking-tight text-white`}>PF Control</p>
                  {!isUltraCompactSidebar && !isShortViewport && !isSidebarTightMode && (
                    <p className={`${isPhoneViewport ? "text-[0.8rem]" : "text-[clamp(0.62rem,1.35vh,0.75rem)]"} truncate text-slate-300`}>Plataforma para preparadores fisicos</p>
                  )}
                </div>
              </div>
            )}

            {!isTouchDrawerViewport ? (
              <button
                onClick={toggleCollapsed}
                className="rounded-lg border border-white/20 bg-slate-800/70 px-2 py-[clamp(0.2rem,0.55vh,0.32rem)] text-[clamp(0.62rem,1.3vh,0.75rem)] font-bold text-white"
              >
                {collapsed ? ">>" : "<<"}
              </button>
            ) : (
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg border border-white/25 bg-slate-800/80 px-2.5 py-1.5 text-xs font-bold text-white"
                aria-label="Cerrar menu"
              >
                Cerrar
              </button>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {(isPhoneViewport || isTabletViewport) && !collapsed ? (
              <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100/85">
                Navegacion
              </p>
            ) : null}
            <nav
              className={`pf-sidebar-scroll grid min-h-0 flex-1 content-start overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-white/10 p-[clamp(0.28rem,0.8vh,0.58rem)] ${isPhoneViewport ? "bg-slate-950/30" : ""} ${navGapClass}`}
              onDragOver={(e) => {
                if (!navPresetLocked) {
                  e.preventDefault();
                }
              }}
              onDrop={() => {
                if (!navPresetLocked) {
                  handleDropOnList();
                }
              }}
            >
              {orderedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(event) => {
                    event.preventDefault();
                    navigateWithFallback(link.href);
                  }}
                  draggable={!navPresetLocked}
                  onDragStart={(event) => {
                    if (navPresetLocked) {
                      event.preventDefault();
                      return;
                    }
                    setDragState({ href: link.href });
                  }}
                  onDragEnd={() => setDragState(null)}
                  onDragOver={(e) => {
                    if (!navPresetLocked) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={(e) => {
                    if (navPresetLocked) {
                      return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropOnItem(link.href);
                  }}
                  className={`group relative overflow-hidden rounded-xl border font-semibold text-white transition hover:-translate-y-0.5 ${navPresetLocked ? "cursor-default" : "cursor-move"} ${navButtonHeightClass} ${
                    pathname === link.href
                      ? "border-cyan-200/45 ring-1 ring-cyan-200/20"
                      : "border-white/20"
                  } ${navButtonPaddingClass}`}
                  title={link.label}
                >
                  <span
                    className={`absolute inset-0 bg-gradient-to-r ${link.tone} transition group-hover:opacity-100 ${
                      pathname === link.href ? "opacity-95" : "opacity-75"
                    }`}
                  />
                      <span className={`relative flex h-full w-full items-center gap-2 ${collapsed ? "justify-center" : "justify-start"}`}>
                        {link.icon.startsWith("/") ? (
                          <img
                            src={link.icon}
                            alt=""
                            aria-hidden="true"
                            className={`${isPhoneViewport ? "h-[1.08rem] w-[1.08rem]" : "h-[clamp(0.92rem,1.9vh,1.18rem)] w-[clamp(0.92rem,1.9vh,1.18rem)]"} inline-flex shrink-0 items-center justify-center object-contain`}
                          />
                        ) : (
                          <span className={`${isPhoneViewport ? "text-[1.08rem]" : "text-[clamp(0.92rem,1.9vh,1.18rem)]"} inline-flex shrink-0 items-center justify-center leading-none`}>{link.icon}</span>
                        )}
                        {!collapsed && <span className="truncate font-bold leading-none tracking-[0.01em]">{link.label}</span>}
                        {isTouchDrawerViewport && !collapsed ? <span className="ml-auto text-xs text-white/80">&gt;</span> : null}
                  </span>
                </Link>
              ))}
            </nav>
          </div>

            <div className={`mt-[clamp(0.35rem,1vh,0.85rem)] grid gap-[clamp(0.24rem,0.7vh,0.5rem)] pb-1 pt-[clamp(0.25rem,0.75vh,0.7rem)] ${isTouchDrawerViewport ? "border-t border-white/10" : ""}`}>
              <Link
                href="/cuenta"
                onClick={(event) => {
                  event.preventDefault();
                  navigateWithFallback("/cuenta");
                }}
                className={`rounded-xl border font-semibold transition ${footerButtonPaddingClass} ${
                  pathname === "/cuenta"
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                    : "border-white/15 bg-slate-800/60 text-slate-100 hover:bg-slate-800/90"
                }`}
                title="Cuenta"
              >
                {collapsed ? "👤" : "👤 Cuenta"}
              </Link>

              <button
                onClick={() => signOut({ callbackUrl: "/auth/login" })}
                className={`w-full rounded-xl border border-rose-500/30 bg-rose-500/10 font-semibold text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-100 ${footerButtonPaddingClass}`}
                title="Cerrar sesión"
              >
                {collapsed ? "🚪" : "🚪 Cerrar sesión"}
              </button>
            </div>
        </div>
      </aside>

      <div className={`relative transition-all duration-300 ${collapsed ? "lg:ml-0" : "lg:ml-0"}`}>
        {isOffline ? (
          <div className="pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[70] flex justify-center px-3">
            <div className="rounded-full border border-amber-300/55 bg-amber-500/20 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100 shadow-lg backdrop-blur-md">
              Modo sin conexion: solo lectura
            </div>
          </div>
        ) : null}

        {pendingSaveKeys.length > 0 ? (
          <div className="pointer-events-none fixed left-4 top-16 z-[59] lg:top-4">
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

        <div className={`pointer-events-none fixed z-[60] flex w-[min(92vw,380px)] flex-col gap-2 ${
          isTouchDrawerViewport ? "right-3 top-20" : "right-4 top-4"
        }`}>
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
        <div className={`min-w-0 ${isTouchDrawerViewport ? "pt-20" : "pt-0"}`} style={contentScaledStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}
