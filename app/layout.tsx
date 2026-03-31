import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "PF Control",
  description: "Plataforma para preparadores físicos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const links = [
    { href: "/", label: "Inicio", icon: "🏠", tone: "from-cyan-500 to-blue-600" },
    { href: "/alumno/inicio", label: "Inicio alumno", icon: "☀️", tone: "from-cyan-500 to-blue-600" },
    { href: "/alumno/rutina", label: "Rutina", icon: "🏋️", tone: "from-blue-600 to-indigo-600" },
    { href: "/alumno/nutricion", label: "Nutricion", icon: "🥗", tone: "from-emerald-500 to-lime-600" },
    { href: "/alumno/medidas", label: "Medidas", icon: "📏", tone: "from-violet-500 to-purple-600" },
    { href: "/alumno/progreso", label: "Mi progreso", icon: "📈", tone: "from-emerald-500 to-cyan-600" },
    { href: "/plantel", label: "Plantel", icon: "👥", tone: "from-emerald-500 to-teal-600" },
    { href: "/semana", label: "Semana", icon: "📅", tone: "from-violet-500 to-purple-600" },
    { href: "/sesiones", label: "Sesiones", icon: "🏋️", tone: "from-blue-600 to-indigo-600" },
    { href: "/asistencias", label: "Asistencias", icon: "✅", tone: "from-teal-500 to-cyan-600" },
    { href: "/ejercicios", label: "Ejercicios", icon: "🎯", tone: "from-fuchsia-500 to-pink-600" },
    { href: "/registros", label: "Registros", icon: "📊", tone: "from-amber-500 to-orange-600" },
    { href: "/categorias", label: "Categorías", icon: "🏷️", tone: "from-rose-500 to-red-600" },
    { href: "/deportes", label: "Deportes", icon: "⚽", tone: "from-sky-500 to-cyan-600" },
    { href: "/categorias/Nutricion", label: "Nutrición", icon: "🥗", tone: "from-emerald-500 to-lime-600" },
    { href: "/equipos", label: "Equipos", icon: "🛡️", tone: "from-indigo-500 to-violet-600" },
    { href: "/clientes", label: "Clientes", icon: "👤", tone: "from-lime-500 to-green-600" },
    { href: "/admin/musica", label: "Musica", icon: "🎧", tone: "from-fuchsia-500 to-pink-600", adminOnly: true },
    { href: "/admin/whatsapp", label: "Whats App", icon: "/whatsapp-logo.svg", tone: "from-green-500 to-emerald-600", adminOnly: true },
    { href: "/configuracion", label: "Configuración", icon: "⚙️", tone: "from-slate-500 to-gray-600" },
    { href: "/nueva-sesion", label: "Nueva sesión", icon: "🚀", tone: "from-cyan-500 to-sky-600" },
  ];

  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <AuthSessionProvider>
          <CategoriesProvider>
            <EquiposProvider>
              <DeportesProvider>
                <EjerciciosProvider>
                  <PlayersProvider>
                    <AlumnosProvider>
                      <SessionsProvider>
                        <WellnessProvider>
                          <AppShell links={links}>{children}</AppShell>
                        </WellnessProvider>
                      </SessionsProvider>
                    </AlumnosProvider>
                  </PlayersProvider>
                </EjerciciosProvider>
              </DeportesProvider>
            </EquiposProvider>
          </CategoriesProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}