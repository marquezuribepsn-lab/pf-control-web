"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type NavLink = {
  href: string;
  label: string;
  icon: string;
  tone: string;
};

type AppShellProps = {
  links: NavLink[];
  children: React.ReactNode;
};

type InlineToast = {
  id: number;
  type: "success" | "error";
  message: string;
};

const PRIMARY_ORDER = [
  "/",
  "/semana",
  "/sesiones",
  "/nueva-sesion",
  "/plantel",
  "/clientes",
];

const NAV_CONFIG_KEY = "pf-control-nav-config-v1";
const SIDEBAR_IMAGE_KEY = "pf-control-sidebar-image-v1";
const SCREEN_SCALE_KEY = "pf-control-screen-scale-v1";

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

export default function AppShell({ links, children }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<NavConfig>(() => getDefaultConfig(links));
  const [dragState, setDragState] = useState<{ href: string } | null>(null);
  const [sidebarImage, setSidebarImage] = useState<string | null>(null);
  const [screenScale, setScreenScale] = useState(1);
  const [toasts, setToasts] = useState<InlineToast[]>([]);

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
  }, [links]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const custom = event as CustomEvent<{ type?: "success" | "error"; message?: string }>;
      const type = custom.detail?.type === "error" ? "error" : "success";
      const message = custom.detail?.message || "Cambio guardado";
      const id = Date.now() + Math.floor(Math.random() * 1000);

      setToasts((prev) => [...prev, { id, type, message }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 3800);
    };

    window.addEventListener("pf-inline-toast", onToast);
    return () => window.removeEventListener("pf-inline-toast", onToast);
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
    setMobileOpen(false);
  }, [pathname]);

  const linkByHref = new Map(links.map((link) => [link.href, link]));

  const orderedLinks = config.order
    .map((href) => linkByHref.get(href))
    .filter((link): link is NavLink => Boolean(link));

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
      return next;
    });
  };

  const scaledStyle = {
    transform: `scale(${screenScale})`,
    transformOrigin: "top left",
    width: `${100 / screenScale}%`,
    minHeight: `${100 / screenScale}vh`,
  } as const;

  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-[auto_1fr]" style={scaledStyle}>
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
        className={`fixed left-0 top-0 z-40 h-screen border-r border-white/15 bg-slate-900/95 backdrop-blur-md transition-all duration-300 lg:sticky ${
          collapsed ? "w-20" : "w-72"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -left-12 top-0 h-36 w-36 rounded-full bg-cyan-500/30 blur-3xl" />
          <div className="absolute right-0 top-16 h-32 w-32 rounded-full bg-fuchsia-500/25 blur-3xl" />
        </div>

        <div className="relative flex h-full flex-col p-4 lg:p-5">
          {collapsed && sidebarImage && (
            <div className="mb-3 flex justify-center">
              <img
                src={sidebarImage}
                alt="Imagen lateral"
                className="h-10 w-10 rounded-lg border border-white/20 object-cover"
              />
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-2">
            {!collapsed && (
              <div>
                {sidebarImage && (
                  <img
                    src={sidebarImage}
                    alt="Imagen lateral"
                    className="mb-2 h-12 w-12 rounded-xl border border-white/20 object-cover"
                  />
                )}
                <p className="text-xl font-black tracking-tight text-white">PF Control</p>
                <p className="text-xs text-slate-300">Plataforma para preparadores fisicos</p>
              </div>
            )}

            <button
              onClick={toggleCollapsed}
              className="rounded-lg border border-white/20 bg-slate-800/70 px-2 py-1 text-xs font-bold text-white"
            >
              {collapsed ? ">>" : "<<"}
            </button>
          </div>

          <nav
            className="grid gap-2 rounded-xl border border-white/10 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnList}
          >
            {orderedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                draggable
                onDragStart={() => setDragState({ href: link.href })}
                onDragEnd={() => setDragState(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDropOnItem(link.href);
                }}
                className="group relative overflow-hidden rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                title={link.label}
              >
                <span className={`absolute inset-0 bg-gradient-to-r ${link.tone} opacity-80 transition group-hover:opacity-100`} />
                <span className="relative flex items-center justify-center gap-2">
                  <span>{link.icon}</span>
                  {!collapsed && <span>{link.label}</span>}
                </span>
              </Link>
            ))}
          </nav>

            <div className="mt-auto grid gap-2 pt-4">
              <Link
                href="/cuenta"
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
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
                className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-100"
                title="Cerrar sesión"
              >
                {collapsed ? "🚪" : "🚪 Cerrar sesión"}
              </button>
            </div>
        </div>
      </aside>

      <div className={`relative transition-all duration-300 ${collapsed ? "lg:ml-0" : "lg:ml-0"}`}>
        <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
                toast.type === "success"
                  ? "border-emerald-200/40 bg-emerald-500/25 text-emerald-50"
                  : "border-rose-200/40 bg-rose-500/25 text-rose-50"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
                {toast.type === "success" ? "Guardado" : "Error"}
              </p>
              <p className="mt-1 text-sm font-semibold">{toast.message}</p>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>
        <div className="pt-16 lg:pt-0">{children}</div>
      </div>
    </div>
  );
}
