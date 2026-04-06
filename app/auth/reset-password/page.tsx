'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('El enlace no es válido o está incompleto.');
    }
  }, [token]);

  useEffect(() => {
    if (!redirecting) {
      return;
    }

    const softRedirect = window.setTimeout(() => {
      router.replace('/auth/login');
    }, 900);

    return () => {
      window.clearTimeout(softRedirect);
    };
  }, [redirecting, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!token) {
      setError('El enlace no es válido o está incompleto.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo restablecer la contraseña');
      }

      setMessage((data.message || 'Contraseña actualizada') + ' Redirigiendo al login...');
      setRedirecting(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#08111d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_24%),radial-gradient(circle_at_20%_80%,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(145deg,_#08111d_0%,_#0f2040_42%,_#1d4ed8_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/12 bg-slate-950/60 p-6 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur-2xl sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200/80">Nueva contraseña</p>
          <h1 className="mt-3 text-3xl font-black text-white">Restablecer contraseña</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Elegí una nueva contraseña para volver a entrar a PF Control.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {message && <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-100">{message}</div>}
            {error && <div className="rounded-2xl border border-rose-400/35 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">{error}</div>}

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Nueva contraseña
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Confirmar contraseña
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                placeholder="Repite la nueva contraseña"
                minLength={6}
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading || redirecting || !token}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:from-emerald-300 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading || redirecting ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-300">
            <a href="/auth/login" className="font-bold text-cyan-300 transition hover:text-cyan-200">
              Volver al login
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#08111d]" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}