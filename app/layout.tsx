import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Sora, Space_Grotesk } from "next/font/google";
import { Prisma } from "@prisma/client";
import PlayersProvider from "../components/PlayersProvider";
import SessionsProvider from "../components/SessionsProvider";
import WellnessProvider from "../components/WellnessProvider";
import CategoriesProvider from "../components/CategoriesProvider";
import EquiposProvider from "../components/EquiposProvider";
import DeportesProvider from "../components/DeportesProvider";
import EjerciciosProvider from "../components/EjerciciosProvider";
import AppShell from "../components/AppShell";
import AlumnosProvider from "../components/AlumnosProvider";
import { AuthSessionProvider } from "../components/AuthSessionProvider";
import PresenceBeacon from "../components/PresenceBeacon";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PF Control",
  description: "Plataforma para preparadores fisicos",
};

export const viewport: Viewport = {
  themeColor: "#081124",
};

const db = prisma as any;
const SIDEBAR_IMAGE_SYNC_KEY_PREFIX = "pf-control-user-sidebar-image:";
const HARD_RELOAD_SPLASH_MIN_MS = 2000;

function resolveInitialProfileName(user?: { name?: string | null; email?: string | null } | null): string | null {
  const fromName = typeof user?.name === "string" ? user.name.trim() : "";
  if (fromName) {
    return fromName;
  }

  const fromEmail = typeof user?.email === "string" ? user.email.split("@")[0]?.trim() : "";
  return fromEmail || null;
}

function normalizeSidebarImageValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function resolveInitialSidebarImage(userId: string | null): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const syncKey = `${SIDEBAR_IMAGE_SYNC_KEY_PREFIX}${userId}`;
  let fallbackValue: string | null = null;

  try {
    const entry = await db.syncEntry.findUnique({
      where: { key: syncKey },
      select: { value: true },
    });

    fallbackValue = normalizeSidebarImageValue(entry?.value);
  } catch {
    fallbackValue = null;
  }

  try {
    const rows = (await db.$queryRaw(
      Prisma.sql`SELECT sidebarImage FROM users WHERE id = ${userId} LIMIT 1`
    )) as Array<{ sidebarImage: string | null }>;

    return normalizeSidebarImageValue(rows?.[0]?.sidebarImage) || fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const sessionUserId = typeof session?.user?.id === "string" ? session.user.id : null;
  const initialRole = typeof (session?.user as { role?: string | null } | undefined)?.role === "string"
    ? String((session?.user as { role?: string | null }).role || "").trim().toUpperCase() || null
    : null;
  const initialEstado = typeof (session?.user as { estado?: string | null } | undefined)?.estado === "string"
    ? String((session?.user as { estado?: string | null }).estado || "").trim().toUpperCase() || null
    : null;
  const initialProfileName = resolveInitialProfileName(
    session?.user as { name?: string | null; email?: string | null } | null
  );
  const initialSidebarImage = await resolveInitialSidebarImage(sessionUserId);

  const links = [
    { href: "/", label: "Inicio", icon: "\u{1F3E0}", tone: "from-cyan-500 to-blue-600" },
    { href: "/semana", label: "Templates", icon: "\u{1F4C5}", tone: "from-violet-500 to-purple-600" },
    { href: "/asistencias", label: "Asistencias", icon: "\u2705", tone: "from-teal-500 to-cyan-600" },
    { href: "/registros", label: "Registros", icon: "\u{1F4CA}", tone: "from-amber-500 to-orange-600" },
    {
      href: "/admin/pagos",
      label: "Pagos mensuales",
      icon: "\u{1F4B8}",
      tone: "from-amber-500 to-orange-600",
      adminOnly: true,
    },
    { href: "/categorias", label: "Categorias", icon: "\u{1F3F7}\uFE0F", tone: "from-rose-500 to-red-600" },
    { href: "/categorias/Nutricion", label: "Nutricion", icon: "\u{1F957}", tone: "from-emerald-500 to-lime-600" },
    { href: "/deportes", label: "Deportes", icon: "\u26BD", tone: "from-sky-500 to-cyan-600" },
    { href: "/equipos", label: "Equipos", icon: "\u{1F6E1}\uFE0F", tone: "from-indigo-500 to-violet-600" },
    {
      href: "/alumnos/inicio",
      label: "Inicio",
      icon: "\u{1F3E0}",
      tone: "from-cyan-500 to-emerald-600",
      clientOnly: true,
    },
    {
      href: "/alumnos/rutina",
      label: "Rutina",
      icon: "\u{1F3CB}\uFE0F",
      tone: "from-blue-600 to-indigo-600",
      clientOnly: true,
    },
    {
      href: "/alumnos/nutricion",
      label: "Plan nutricional",
      icon: "\u{1F957}",
      tone: "from-emerald-500 to-lime-600",
      clientOnly: true,
    },
    {
      href: "/alumnos/progreso",
      label: "Progreso",
      icon: "\u{1F4CA}",
      tone: "from-fuchsia-500 to-pink-600",
      clientOnly: true,
    },
    {
      href: "/alumnos/musica",
      label: "Musica",
      icon: "\u{1F3A7}",
      tone: "from-violet-500 to-purple-600",
      clientOnly: true,
    },
    { href: "/clientes", label: "Clientes", icon: "\u{1F464}", tone: "from-lime-500 to-green-600" },
    { href: "/clientes/musica", label: "Musica", icon: "\u{1F3A7}", tone: "from-fuchsia-500 to-pink-600" },
    {
      href: "/admin/usuarios",
      label: "Usuarios y permisos",
      icon: "\u{1F6E0}\uFE0F",
      tone: "from-orange-500 to-amber-600",
      adminOnly: true,
    },
    {
      href: "/admin/whatsapp",
      label: "WhatsApp",
      icon: "\u{1F4AC}",
      tone: "from-emerald-500 to-green-600",
      adminOnly: true,
    },
    { href: "/configuracion", label: "Configuracion", icon: "\u2699\uFE0F", tone: "from-slate-500 to-gray-600" },
  ];

  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen bg-slate-950 text-slate-100`}>
        <div
          id="pf-hard-reload-splash"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#05070a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          aria-live="polite"
        >
          <div
            style={{
              width: "min(420px, 92vw)",
              borderRadius: "24px",
              border: "1px solid rgba(115,226,191,0.25)",
              background: "rgba(8,16,28,0.95)",
              boxShadow: "0 18px 54px rgba(0,0,0,0.35)",
              padding: "24px 20px",
              display: "grid",
              placeItems: "center",
              rowGap: "10px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "62px",
                height: "62px",
                borderRadius: "31px",
                border: "2px solid rgba(115,226,191,0.4)",
                display: "grid",
                placeItems: "center",
              }}
              aria-hidden="true"
            >
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "23px",
                  border: "1px solid rgba(146,190,255,0.58)",
                  background: "rgba(9,16,26,0.92)",
                  color: "#ecfff7",
                  fontWeight: 900,
                  fontSize: "14px",
                  letterSpacing: "1.2px",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                PF
              </div>
            </div>
            <p
              style={{
                margin: 0,
                color: "#9db4cd",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.9px",
                textTransform: "uppercase",
              }}
            >
              PF Control
            </p>
            <p style={{ margin: 0, color: "#d9e8f8", fontSize: "13px", fontWeight: 700 }}>
              Cargando plataforma...
            </p>
          </div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var overlay = document.getElementById("pf-hard-reload-splash");
  if (!overlay) {
    return;
  }

  var ALLOWED_ALUMNO_CATEGORIES = {
    inicio: 1,
    rutina: 1,
    nutricion: 1,
    progreso: 1,
    musica: 1,
  };
  var LAST_CATEGORY_KEY = "pf-alumno-last-category-v1";
  var LAST_CATEGORY_TS_KEY = "pf-alumno-last-category-ts-v1";

  var isReloadNavigation = false;
  try {
    if (performance && typeof performance.getEntriesByType === "function") {
      var navigationEntries = performance.getEntriesByType("navigation");
      if (navigationEntries && navigationEntries.length > 0) {
        isReloadNavigation = navigationEntries[0].type === "reload";
      }
    }

    if (!isReloadNavigation && performance && performance.navigation) {
      isReloadNavigation = performance.navigation.type === 1;
    }
  } catch (_error) {
    isReloadNavigation = false;
  }

  var startedAt = Date.now();
  var hidden = false;

  var hideOverlay = function () {
    if (hidden || !overlay) {
      return;
    }

    hidden = true;
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.transition = "opacity 220ms ease";

    window.setTimeout(function () {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 260);
  };

  var waitForAlumnoRouteReady = function (done) {
    try {
      var path = String(window.location.pathname || "").toLowerCase();
      var match = path.match(/^\/alumnos\/([^/?#]+)/);

      if (!match) {
        done();
        return;
      }

      var expectedCategory = String(match[1] || "").trim();
      if (!ALLOWED_ALUMNO_CATEGORIES[expectedCategory]) {
        done();
        return;
      }

      var startedWaitAt = Date.now();
      var maxWaitMs = 4500;

      var checkReady = function () {
        var selector = '[data-pf-alumno-category="' + expectedCategory + '"]';
        if (document.querySelector(selector)) {
          done();
          return;
        }

        if (Date.now() - startedWaitAt >= maxWaitMs) {
          done();
          return;
        }

        window.requestAnimationFrame(checkReady);
      };

      checkReady();
    } catch (_error) {
      done();
    }
  };

  var maybeRestoreAlumnoReloadRoute = function () {
    try {
      if (!isReloadNavigation) {
        return false;
      }

      var currentPath = String(window.location.pathname || "").toLowerCase();
      var match = currentPath.match(/^\/alumnos\/([^/?#]+)/);
      if (!match) {
        return false;
      }

      var currentCategory = String(match[1] || "").trim();
      if (!ALLOWED_ALUMNO_CATEGORIES[currentCategory]) {
        return false;
      }

      var storedCategoryRaw = window.sessionStorage.getItem(LAST_CATEGORY_KEY);
      var storedCategory = String(storedCategoryRaw || "").trim().toLowerCase();
      if (!ALLOWED_ALUMNO_CATEGORIES[storedCategory]) {
        return false;
      }

      var storedTsRaw = window.sessionStorage.getItem(LAST_CATEGORY_TS_KEY);
      var storedTs = Number(storedTsRaw || "0");
      var isFresh = Number.isFinite(storedTs) && Date.now() - storedTs <= 10 * 60 * 1000;

      if (!isFresh || storedCategory === currentCategory) {
        return false;
      }

      var nextUrl = "/alumnos/" + storedCategory + String(window.location.search || "") + String(window.location.hash || "");
      window.location.replace(nextUrl);
      return true;
    } catch (_error) {
      return false;
    }
  };

  if (maybeRestoreAlumnoReloadRoute()) {
    return;
  }

  var finishWithMinimum = function () {
    var elapsed = Date.now() - startedAt;
    var remaining = Math.max(0, ${HARD_RELOAD_SPLASH_MIN_MS} - elapsed);
    window.setTimeout(function () {
      waitForAlumnoRouteReady(hideOverlay);
    }, remaining);
  };

  if (document.readyState === "complete") {
    finishWithMinimum();
  } else {
    window.addEventListener("load", finishWithMinimum, { once: true });
  }

  window.setTimeout(hideOverlay, ${HARD_RELOAD_SPLASH_MIN_MS + 6000});
})();`,
          }}
        />
        <AuthSessionProvider>
          <PresenceBeacon />
          <div className="pf-root-atmosphere">
            <CategoriesProvider>
              <EquiposProvider>
                <DeportesProvider>
                  <EjerciciosProvider>
                    <PlayersProvider>
                      <AlumnosProvider>
                        <SessionsProvider>
                          <WellnessProvider>
                            <AppShell
                              links={links}
                              initialRole={initialRole}
                              initialEstado={initialEstado}
                              initialProfileName={initialProfileName}
                              initialSidebarImage={initialSidebarImage}
                            >
                              {children}
                            </AppShell>
                          </WellnessProvider>
                        </SessionsProvider>
                      </AlumnosProvider>
                    </PlayersProvider>
                  </EjerciciosProvider>
                </DeportesProvider>
              </EquiposProvider>
            </CategoriesProvider>
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
