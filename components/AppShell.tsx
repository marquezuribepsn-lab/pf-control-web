"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { FAILSAFE_NAVIGATE_EVENT, installButtonFailsafe } from "@/lib/buttonFailsafe";
import { neutralizeViewportBlockers } from "@/lib/interactionGuard";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  children: ReactNode;
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
};

const SIDEBAR_IMAGE_KEY = "pf-control-sidebar-image-v1";
const SIDEBAR_ROLE_KEY = "pf-control-sidebar-role-v1";

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

const normalizePath = (value: string) => {
  const path = value.split("?")[0] || "/";
  if (path !== "/" && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
};

const resolveUserDisplayName = (user?: UserLike | null): string => {
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

  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
};

const roleToLabel = (role: string | null | undefined): string => {
  if (role === "ADMIN") return "ADMIN";
  if (role === "COLABORADOR") return "COLAB";
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

  if (!normalized) return key;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export default function AppShell({ links, children }: AppShellProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const interactionGuardLastRunRef = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(900);
  const [sidebarImage, setSidebarImage] = useState<string | null>(null);
  const [resolvedRole, setResolvedRole] = useState<string | null>(null);
  const [colaboradorAccessMap, setColaboradorAccessMap] = useState<Record<string, boolean> | null>(null);
  const [toasts, setToasts] = useState<InlineToast[]>([]);
  const [pendingSaveKeys, setPendingSaveKeys] = useState<string[]>([]);
  const [pendingPanelOpen, setPendingPanelOpen] = useState(false);

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
    if (result.neutralized > 0) {
      console.warn("[interaction-guard] bloqueo neutralizado", result);
    }
  };

  useEffect(() => {
    setMounted(true);
    try {
      setSidebarImage(localStorage.getItem(SIDEBAR_IMAGE_KEY));
      const cachedRole = localStorage.getItem(SIDEBAR_ROLE_KEY);
      if (cachedRole && cachedRole.length > 0) {
        setResolvedRole(cachedRole);
      }
    } catch {
      setSidebarImage(null);
      setResolvedRole(null);
    }
  }, []);

  useEffect(() => {
    if (!mounted || !session?.user) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok || cancelled) return;

        const data = await response.json();
        const remoteImage =
          typeof data.sidebarImage === "string" && data.sidebarImage.trim() ? data.sidebarImage : null;

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

        setSidebarImage(remoteImage);
        setColaboradorAccessMap(normalizedAccess);

        if (remoteImage) {
          localStorage.setItem(SIDEBAR_IMAGE_KEY, remoteImage);
        } else {
          localStorage.removeItem(SIDEBAR_IMAGE_KEY);
        }

        window.dispatchEvent(new Event("pf-sidebar-image-updated"));
      } catch {
        // do not block shell render
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
        setSidebarImage(event.newValue || null);
      }

      if (event.key === SIDEBAR_ROLE_KEY) {
        setResolvedRole(event.newValue || null);
      }
    };

    const onSidebarImageChange = () => {
      setSidebarImage(localStorage.getItem(SIDEBAR_IMAGE_KEY));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("pf-sidebar-image-updated", onSidebarImageChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pf-sidebar-image-updated", onSidebarImageChange);
    };
  }, []);

  useEffect(() => {
    if (!mounted || pathname.startsWith("/auth")) return;

    const scheduledRuns = [0, 120, 420, 900].map((delayMs) =>
      window.setTimeout(() => runInteractionGuard(), delayMs)
    );

    const onPointerDownCapture = () => {
      runInteractionGuard();
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
  }, [mounted, pathname]);

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
    if (!mounted || pathname.startsWith("/auth")) return;

    const cleanup = installButtonFailsafe();
    return cleanup;
  }, [mounted, pathname]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") {
      return;
    }

    const onFailsafeNavigate = (event: Event) => {
      const custom = event as CustomEvent<{ href?: string; replace?: boolean }>;
      const href = typeof custom.detail?.href === "string" ? custom.detail.href.trim() : "";
      if (!href) {
        return;
      }

      const replace = custom.detail?.replace === true;
      if (replace) {
        router.replace(href, { scroll: true });
        return;
      }

      router.push(href, { scroll: true });
    };

    window.addEventListener(FAILSAFE_NAVIGATE_EVENT, onFailsafeNavigate as EventListener);
    return () => {
      window.removeEventListener(FAILSAFE_NAVIGATE_EVENT, onFailsafeNavigate as EventListener);
    };
  }, [mounted, router]);

  useEffect(() => {
    if (pendingSaveKeys.length === 0) {
      setPendingPanelOpen(false);
    }
  }, [pendingSaveKeys]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncViewport = () => {
      setViewportHeight(window.innerHeight || 900);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    const nextRole = (session?.user as UserLike | undefined)?.role;
    if (typeof nextRole === "string" && nextRole.length > 0) {
      setResolvedRole(nextRole);
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_ROLE_KEY, nextRole);
      }
    }
  }, [session?.user]);

  const role =
    ((session?.user as UserLike | undefined)?.role as string | undefined) ??
    resolvedRole ??
    (pathname.startsWith("/admin") ? "ADMIN" : null);

  const displayName = resolveUserDisplayName(session?.user as UserLike | undefined);
  const profileInitials = resolveInitials(displayName);
  const roleLabel = roleToLabel(role);

  const visibleLinks = useMemo(
    () =>
      links.filter((link) => {
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
    [links, role, colaboradorAccessMap]
  );

  const normalizedPathname = normalizePath(pathname);
  const allVisibleHrefs = visibleLinks.map((link) => normalizePath(link.href));
  const sidebarItemCount = Math.max(visibleLinks.length, 1);
  const reservedSidebarHeight = 160 + (pendingSaveKeys.length > 0 ? 48 : 0);
  const sidebarNavAvailableHeight = Math.max(260, viewportHeight - reservedSidebarHeight);
  const sidebarItemHeight = Math.max(
    34,
    Math.min(54, Math.floor(sidebarNavAvailableHeight / sidebarItemCount) - 4)
  );
  const sidebarIconSize =
    sidebarItemHeight < 38 ? "0.9rem" : sidebarItemHeight < 44 ? "1rem" : "1.12rem";
  const sidebarLabelSize =
    sidebarItemHeight < 38 ? "8px" : sidebarItemHeight < 44 ? "9px" : "10px";

  const pendingBadgeSummary = (() => {
    if (pendingSaveKeys.length === 0) return "";
    const labels = pendingSaveKeys.slice(0, 2).map((key) => formatPendingKeyLabel(key));
    const base = labels.join(" + ");
    const rest = pendingSaveKeys.length - labels.length;
    return rest > 0 ? `${base} +${rest}` : base;
  })();

  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[100svh] bg-transparent text-slate-100">
      <ReliableActionButton
        type="button"
        onClick={() => setMobileOpen((prev) => !prev)}
        className="fixed left-3 top-3 z-[97] inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/40 bg-slate-900/92 text-base text-cyan-100 shadow-lg md:hidden"
        aria-label={mobileOpen ? "Cerrar menu" : "Abrir menu"}
      >
        {mobileOpen ? "x" : "☰"}
      </ReliableActionButton>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-[88] bg-slate-950/65 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`pointer-events-auto fixed inset-y-0 left-0 z-[90] w-[clamp(88px,8.4vw,112px)] bg-[linear-gradient(180deg,rgba(5,16,34,0.46),rgba(5,16,34,0.22))] backdrop-blur-[2px] transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pointer-events-auto m-1.5 flex h-[calc(100%-0.75rem)] flex-col rounded-[1.45rem] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(2,10,24,0.62),rgba(4,18,40,0.45))]">
          <Link
            href="/cuenta"
            prefetch={false}
            reliabilityMode="hard"
            className="mx-auto mt-2 flex w-full max-w-[84px] flex-col items-center gap-1.5 rounded-2xl border border-cyan-300/35 bg-cyan-400/10 px-1.5 py-2 text-center shadow-[0_10px_24px_rgba(8,47,73,0.35)]"
            title="Ir a cuenta"
            aria-label="Ir a cuenta"
          >
            {sidebarImage ? (
              <img
                src={sidebarImage}
                alt="Cuenta"
                className="h-11 w-11 rounded-full border border-cyan-100/45 object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-100/50 bg-cyan-500/25 text-sm font-black text-cyan-50">
                {profileInitials}
              </span>
            )}
            <span className="w-full truncate text-[9px] font-black uppercase tracking-[0.06em] text-cyan-50">
              {displayName}
            </span>
            <span className="rounded-full border border-cyan-200/40 bg-slate-900/65 px-2 py-0.5 text-[8px] font-bold tracking-[0.08em] text-cyan-100">
              {roleLabel}
            </span>
          </Link>

          <nav className="mt-2 flex-1 overflow-hidden px-2 pb-2">
            <div
              className="grid w-full justify-items-center gap-1"
              style={{ gridTemplateRows: `repeat(${sidebarItemCount}, ${sidebarItemHeight}px)` }}
            >
              {visibleLinks.map((link) => {
                const normalizedHref = normalizePath(link.href);
                const hasChildLink = allVisibleHrefs.some(
                  (candidate) => candidate !== normalizedHref && candidate.startsWith(`${normalizedHref}/`)
                );
                const isCurrent =
                  normalizedPathname === normalizedHref ||
                  (!hasChildLink &&
                    normalizedHref !== "/" &&
                    normalizedPathname.startsWith(`${normalizedHref}/`));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    reliabilityMode="hard"
                    className={`group flex w-full max-w-[84px] flex-col items-center justify-center rounded-2xl border px-1.5 text-center transition-all duration-150 ${
                      isCurrent
                        ? "border-cyan-200/70 bg-cyan-400/18 text-cyan-50 shadow-[0_10px_22px_rgba(8,47,73,0.45)]"
                        : "border-cyan-300/20 bg-slate-900/52 text-slate-200 hover:border-cyan-200/45 hover:bg-cyan-400/10"
                    }`}
                    style={{
                      height: `${sidebarItemHeight}px`,
                      minHeight: `${sidebarItemHeight}px`,
                      paddingTop: sidebarItemHeight < 40 ? "2px" : "4px",
                      paddingBottom: sidebarItemHeight < 40 ? "2px" : "4px",
                    }}
                    aria-current={isCurrent ? "page" : undefined}
                    title={link.label}
                    aria-label={link.label}
                  >
                    <span className="leading-none" style={{ fontSize: sidebarIconSize }}>{link.icon}</span>
                    <span className="mt-1 w-full truncate font-semibold leading-tight" style={{ fontSize: sidebarLabelSize }}>
                      {compactSidebarLabel(link.label)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {pendingSaveKeys.length > 0 ? (
            <div className="px-2 pb-2">
              <ReliableActionButton
                type="button"
                onClick={() => setPendingPanelOpen((prev) => !prev)}
                className="mx-auto w-full max-w-[84px] rounded-xl border border-amber-300/45 bg-amber-500/18 px-2 py-1.5 text-[9px] font-bold text-amber-100"
                title="Cambios pendientes"
              >
                Pendientes ({pendingSaveKeys.length})
              </ReliableActionButton>
            </div>
          ) : null}
        </div>
      </aside>

      {pendingSaveKeys.length > 0 && pendingPanelOpen ? (
        <div className="fixed left-[104px] top-4 z-[92] w-[min(92vw,340px)] rounded-xl border border-amber-200/35 bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur-md">
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

      <main className="relative min-h-[100svh] pb-8 pt-14 md:pl-[clamp(98px,9.8vw,126px)] md:pt-4">
        <div className="px-4">{children}</div>
      </main>
    </div>
  );
}
