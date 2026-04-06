'use client';

import ReliableActionButton from "@/components/ReliableActionButton";
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [showLink, setShowLink] = useState(false);

  // Simulación: solo admins pueden ver el link
  const isAdmin = typeof window !== 'undefined' && localStorage.getItem('role') === 'ADMIN';
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo enviar el mail');
      }

      setMessage(data.message || 'Revisa tu bandeja de entrada.');

      // Si es admin, buscar el token y mostrar el link
      if (isAdmin) {
        const tokenRes = await fetch(`/api/auth/get-reset-token?email=${encodeURIComponent(email)}`);
        const tokenData = await tokenRes.json();
        if (tokenData.token) {
          const url = `${window.location.origin}/auth/reset-password?token=${tokenData.token}`;
          setResetLink(url);
          setShowLink(true);
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo enviar el mail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#08111d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_24%),radial-gradient(circle_at_20%_80%,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(145deg,_#08111d_0%,_#0f2040_42%,_#1d4ed8_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/12 bg-slate-950/60 p-6 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur-2xl sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Recuperación</p>
          <h1 className="mt-3 text-3xl font-black text-white">Olvidé mi contraseña</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Ingresá tu email y te enviaremos un enlace para crear una nueva contraseña.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {message && <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-100">{message}</div>}
            {error && <div className="rounded-2xl border border-rose-400/35 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">{error}</div>}
            {showLink && (
              <div className="rounded-2xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-3 text-sm font-medium text-cyan-100 flex items-center gap-2">
                <span>Link de recuperación:</span>
                <input
                  type="text"
                  value={resetLink}
                  readOnly
                  className="bg-transparent text-cyan-200 font-mono w-full"
                  style={{ border: 'none', outline: 'none' }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <ReliableActionButton
                  type="button"
                  className="ml-2 px-2 py-1 rounded bg-cyan-700 text-white text-xs"
                  onClick={() => navigator.clipboard.writeText(resetLink)}
                >
                  Copiar
                </ReliableActionButton>
              </div>
            )}

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/55 focus:bg-slate-900"
                placeholder="tu@email.com"
                required
              />
            </label>

            <ReliableActionButton
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
            </ReliableActionButton>
          </form>

          <p className="mt-6 text-center text-sm text-slate-300">
            ¿Recordaste tu contraseña?{' '}
            <a href="/auth/login" className="font-bold text-cyan-300 transition hover:text-cyan-200">
              Volver al login
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
