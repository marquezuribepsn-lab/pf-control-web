import "./globals.css";
// Vista de alumno — diseño nuevo (handoff "Rediseño PF Control Fitness").
// Va después de globals.css para ganar en empates de especificidad.
import "./alumno-nuevo.css";
// Panel de admin — diseño v2 (handoff "gym / neón cian sobre negro").
import "./admin-v2.css";
import type { Metadata, Viewport } from "next";
import { Inter, Sora, Space_Grotesk } from "next/font/google";
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

// Tipografia del rediseno del alumno (handoff de diseno): Inter.
const alumnoFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-alumno",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PF Control",
  description: "Plataforma para preparadores fisicos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#081124",
};

const db = prisma as any;
const SIDEBAR_IMAGE_SYNC_KEY_PREFIX = "pf-control-user-sidebar-image:";

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
  // Sidebar image se carga en el cliente desde localStorage / useSharedState
  // para evitar 2 queries DB extra en cada page load.
  void sessionUserId; // keep reference to avoid lint warning
  const initialSidebarImage: string | null = null;

  // Navegacion del panel segun el handoff v2: tres secciones.
  // El grupo GRUPOS va con rol de admin, igual que las pantallas que quedaron
  // fuera del menu. `proxy.ts` lo enforza del lado del servidor: esconder el
  // link no alcanza como control de acceso.
  const links = [
    // ── MENU ──────────────────────────────────────────────────────────────
    { href: "/", label: "Inicio", icon: "\u{1F3E0}", tone: "from-cyan-500 to-blue-600", section: "menu" as const },
    { href: "/clientes", label: "Plantel", icon: "\u{1F464}", tone: "from-lime-500 to-green-600", section: "menu" as const },
    { href: "/semana", label: "Entrenamiento", icon: "\u{1F3CB}\uFE0F", tone: "from-violet-500 to-purple-600", section: "menu" as const },
    { href: "/asistencias", label: "Asistencias", icon: "\u2705", tone: "from-teal-500 to-cyan-600", section: "menu" as const },
    { href: "/alertas", label: "Avisos", icon: "\u{1F514}", tone: "from-rose-500 to-orange-600", section: "menu" as const },

    // ── Seccion secundaria, sin titulo ────────────────────────────────────
    { href: "/configuracion", label: "Config.", icon: "\u2699\uFE0F", tone: "from-slate-500 to-gray-600", section: "extra" as const },
    { href: "/calendario", label: "Calendario", icon: "\u{1F5D3}\uFE0F", tone: "from-indigo-500 to-violet-600", section: "extra" as const },
    { href: "/categorias", label: "Categor\u00edas", icon: "\u{1F3F7}\uFE0F", tone: "from-rose-500 to-red-600", section: "extra" as const },

    // ── GRUPOS (admin) ────────────────────────────────────────────────────
    { href: "/categorias/Nutricion", label: "Nutrici\u00f3n", icon: "\u{1F957}", tone: "from-emerald-500 to-lime-600", section: "grupos" as const, adminOnly: true },
    { href: "/admin/pagos", label: "Pagos", icon: "\u{1F4B8}", tone: "from-amber-500 to-orange-600", section: "grupos" as const, adminOnly: true },
    { href: "/clientes/musica", label: "M\u00fasica", icon: "\u{1F3A7}", tone: "from-fuchsia-500 to-pink-600", section: "grupos" as const, adminOnly: true },
    { href: "/admin/whatsapp", label: "WhatsApp", icon: "\u{1F4AC}", tone: "from-emerald-500 to-green-600", section: "grupos" as const, adminOnly: true },
    { href: "/mensajes", label: "Mensajes", icon: "\u{1F4AC}", tone: "from-emerald-500 to-teal-600", section: "grupos" as const, adminOnly: true },
    { href: "/equipos", label: "Equipos y Deportes", icon: "\u{1F6E1}\uFE0F", tone: "from-indigo-500 to-violet-600", section: "grupos" as const, adminOnly: true },
    { href: "/admin/usuarios", label: "Usuarios", icon: "\u{1F6E0}\uFE0F", tone: "from-orange-500 to-amber-600", section: "grupos" as const, adminOnly: true },

    // ── Vista de alumno ───────────────────────────────────────────────────
    { href: "/alumnos/inicio", label: "Inicio", icon: "\u{1F3E0}", tone: "from-cyan-500 to-emerald-600", clientOnly: true },
    { href: "/alumnos/rutina", label: "Rutina", icon: "\u{1F3CB}\uFE0F", tone: "from-blue-600 to-indigo-600", clientOnly: true },
    { href: "/alumnos/nutricion", label: "Plan nutricional", icon: "\u{1F957}", tone: "from-emerald-500 to-lime-600", clientOnly: true },
    { href: "/alumnos/progreso", label: "Progreso", icon: "\u{1F4CA}", tone: "from-fuchsia-500 to-pink-600", clientOnly: true },
    { href: "/alumnos/musica", label: "Musica", icon: "\u{1F3A7}", tone: "from-violet-500 to-purple-600", clientOnly: true },
  ];

  // SUPERADMIN tiene su propio shell completo — no usa AppShell ni providers de alumnos
  if (initialRole === "SUPERADMIN") {
    return (
      <html lang="es">
        <body className={`${bodyFont.variable} ${displayFont.variable} ${alumnoFont.variable} min-h-screen bg-[#080a0b] text-white`}>
          <AuthSessionProvider>
            {children}
          </AuthSessionProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${displayFont.variable} ${alumnoFont.variable} min-h-screen bg-slate-950 text-slate-100`}>
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
