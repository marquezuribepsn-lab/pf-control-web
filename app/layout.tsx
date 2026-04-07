import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Sora, Space_Grotesk } from "next/font/google";
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
import { auth } from "../lib/auth";

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
  description: "Plataforma para preparadores físicos",
};

export const viewport: Viewport = {
  themeColor: "#081124",
};

function resolveInitialProfileName(user?: { name?: string | null; email?: string | null } | null): string | null {
  const fromName = typeof user?.name === "string" ? user.name.trim() : "";
  if (fromName) {
    return fromName;
  }

  const fromEmail = typeof user?.email === "string" ? user.email.split("@")[0]?.trim() : "";
  return fromEmail || null;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const initialRole = typeof (session?.user as { role?: string | null } | undefined)?.role === "string"
    ? String((session?.user as { role?: string | null }).role || "").trim().toUpperCase() || null
    : null;
  const initialProfileName = resolveInitialProfileName(session?.user as { name?: string | null; email?: string | null } | null);

  const links = [
    { href: "/", label: "Inicio", icon: "🏠", tone: "from-cyan-500 to-blue-600" },
    { href: "/plantel", label: "Plantel", icon: "👥", tone: "from-emerald-500 to-teal-600" },
    { href: "/semana", label: "Semana", icon: "📅", tone: "from-violet-500 to-purple-600" },
    { href: "/sesiones", label: "Sesiones", icon: "🏋️", tone: "from-blue-600 to-indigo-600" },
    { href: "/asistencias", label: "Asistencias", icon: "✅", tone: "from-teal-500 to-cyan-600" },
    { href: "/ejercicios", label: "Ejercicios", icon: "🎯", tone: "from-fuchsia-500 to-pink-600" },
    { href: "/registros", label: "Registros", icon: "📊", tone: "from-amber-500 to-orange-600" },
    { href: "/categorias", label: "Categorías", icon: "🏷️", tone: "from-rose-500 to-red-600" },
    { href: "/categorias/Nutricion", label: "Nutricion", icon: "🥗", tone: "from-emerald-500 to-lime-600" },
    { href: "/deportes", label: "Deportes", icon: "⚽", tone: "from-sky-500 to-cyan-600" },
    { href: "/equipos", label: "Equipos", icon: "🛡️", tone: "from-indigo-500 to-violet-600" },
    { href: "/clientes", label: "Clientes", icon: "👤", tone: "from-lime-500 to-green-600" },
    { href: "/clientes/musica", label: "Musica", icon: "🎧", tone: "from-fuchsia-500 to-pink-600" },
    { href: "/admin/usuarios", label: "Usuarios y permisos", icon: "🛠️", tone: "from-orange-500 to-amber-600", adminOnly: true },
    { href: "/admin/musica", label: "Musica", icon: "🎵", tone: "from-fuchsia-500 to-purple-600", adminOnly: true },
    { href: "/admin/whatsapp", label: "WhatsApp", icon: "💬", tone: "from-emerald-500 to-green-600", adminOnly: true },
    { href: "/configuracion", label: "Configuración", icon: "⚙️", tone: "from-slate-500 to-gray-600" },
  ];

  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen bg-slate-950 text-slate-100`}>
        <AuthSessionProvider>
          <div className="pf-root-atmosphere">
            <CategoriesProvider>
              <EquiposProvider>
                <DeportesProvider>
                  <EjerciciosProvider>
                    <PlayersProvider>
                      <AlumnosProvider>
                        <SessionsProvider>
                          <WellnessProvider>
                            <AppShell links={links} initialRole={initialRole} initialProfileName={initialProfileName}>
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