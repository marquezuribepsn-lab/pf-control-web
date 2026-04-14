'use client';

import ReliableActionButton from "@/components/ReliableActionButton";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [edad, setEdad] = useState('');
  const [altura, setAltura] = useState('');
  const [peso, setPeso] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [club, setClub] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (!nombreCompleto.trim() || !edad.trim() || !altura.trim() || !peso.trim() || !telefono.trim() || !fechaNacimiento.trim()) {
      setError('Completa nombre, edad, altura, peso, telefono y fecha de nacimiento.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nombreCompleto,
          edad,
          altura,
          peso,
          telefono,
          fechaNacimiento,
          club,
          objetivo,
          observaciones,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Error al registrarse');
        return;
      }

      setSuccess(data.message || '¡Registro exitoso! Revisa tu email para verificar tu cuenta.');
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err) {
      setError('Error al conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#08111d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_24%),radial-gradient(circle_at_20%_80%,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(145deg,_#08111d_0%,_#0f2040_42%,_#1d4ed8_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-[2rem] border border-white/12 bg-slate-950/60 p-6 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur-2xl sm:p-8">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200/80">Registro</p>
            <h1 className="mt-3 text-3xl font-black text-white">Crear cuenta</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Completá tu ficha inicial, verificá el mail y luego esperá el alta del profesor.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-rose-400/35 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-100">
                {success}
              </div>
            )}

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Nombre completo
              <input
                type="text"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                placeholder="Nombre y apellido"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Edad
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={edad}
                  onChange={(e) => setEdad(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                  placeholder="Ej: 24"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Fecha de nacimiento
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Altura (cm)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                  placeholder="Ej: 172"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Peso (kg)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                  placeholder="Ej: 68"
                  required
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Numero de telefono
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                placeholder="Ej: +5491112345678"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Club (opcional)
              <input
                type="text"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                placeholder="Club / institucion"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Objetivo (opcional)
              <input
                type="text"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                placeholder="Objetivo principal"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Observaciones (opcional)
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="min-h-[96px] rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                placeholder="Info adicional"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
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
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Confirmar contraseña
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                placeholder="Repite la contraseña"
                required
                minLength={6}
              />
            </label>

            <ReliableActionButton
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:from-emerald-300 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </ReliableActionButton>
          </form>

          <p className="mt-6 text-center text-sm text-slate-300">
            ¿Ya tenés cuenta?{' '}
            <a href="/auth/login" className="font-bold text-cyan-300 transition hover:text-cyan-200">
              Iniciá sesión acá
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
