'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [router, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        rememberMe,
        redirect: false,
      });

      if (!result?.ok) {
        setError('No pudimos iniciar sesión. Revisa email, contraseña y verificación del correo.');
        return;
      }

      window.location.assign('/');
    } catch (err) {
      setError('Error al conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#09111f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.22),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.2),_transparent_24%),linear-gradient(135deg,_#09111f_0%,_#102a56_48%,_#1d4ed8_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.35em] text-cyan-100">
              Acceso privado
            </span>
            <h1 className="mt-6 text-6xl font-black leading-none tracking-tight text-white">
              PF Control
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-200/85">
              Toda la plataforma queda bloqueada hasta iniciar sesión. Entrás, trabajás y administrás el plantel desde un único acceso seguro.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <FeatureCard title="Sesiones" text="Planificación y progresiones con acceso protegido." />
              <FeatureCard title="Plantel" text="Datos, control operativo y seguimiento centralizado." />
              <FeatureCard title="Registros" text="Historial de trabajo y reportes bajo sesión activa." />
              <FeatureCard title="Cuenta" text="Perfil, verificación y cierre de sesión en un solo lugar." />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-lg">
          <div className="rounded-[2rem] border border-white/12 bg-slate-950/55 p-6 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur-2xl sm:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-300/90 via-sky-400/80 to-blue-500/80 text-2xl font-black text-slate-950 shadow-[0_20px_40px_rgba(6,182,212,0.25)]">
                  PF
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Login</p>
                <h2 className="mt-3 text-3xl font-black text-white">Ingresar a la plataforma</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Usá tu cuenta verificada para desbloquear todo el sistema.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Estado</p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">Protegido</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-2xl border border-rose-400/35 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">
                  {error}
                </div>
              )}

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/55 focus:bg-slate-900"
                  placeholder="tu@email.com"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/55 focus:bg-slate-900"
                  placeholder="Ingresa tu contraseña"
                  required
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                />
                <span>Recordar inicio de sesión</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>

            <div className="text-right">
              <a href="/auth/forgot-password" className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">
                Olvidé mi contraseña
              </a>
            </div>
            </form>

            <div className="mt-8 flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-slate-500">
              <span className="h-px flex-1 bg-white/10" />
              acceso de usuarios
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <p className="mt-6 text-center text-sm text-slate-300">
              ¿No tenés cuenta?{' '}
              <a href="/auth/register" className="font-bold text-cyan-300 transition hover:text-cyan-200">
                Registrate acá
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}
