'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [antecedentesMedicos, setAntecedentesMedicos] = useState('');
  const [lesionesPrevias, setLesionesPrevias] = useState('');
  const [objetivoPrincipal, setObjetivoPrincipal] = useState('');
  const [medicacionActual, setMedicacionActual] = useState('');
  const [cirugias, setCirugias] = useState('');
  const [actividadFisicaActual, setActividadFisicaActual] = useState('');
  const [restricciones, setRestricciones] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const navigateWithFallback = (path: string) => {
    try {
      router.push(path);

      window.setTimeout(() => {
        if (window.location.pathname !== path) {
          window.location.assign(path);
        }
      }, 250);
    } catch {
      window.location.assign(path);
    }
  };

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

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          apellido,
          fechaNacimiento,
          telefono,
          email,
          password,
          anamnesis: {
            antecedentesMedicos,
            lesionesPrevias,
            objetivoPrincipal,
            medicacionActual,
            cirugias,
            actividadFisicaActual,
            restricciones,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Error al registrarse');
        return;
      }

      setSuccess('Registro enviado. Verifica tu email y espera la aprobacion del administrador.');
      window.setTimeout(() => {
        navigateWithFallback('/auth/login');
      }, 2000);
    } catch (err) {
      setError('Error al conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08111d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_24%),radial-gradient(circle_at_20%_80%,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(145deg,_#08111d_0%,_#0f2040_42%,_#1d4ed8_100%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-3 py-4 sm:px-6 sm:py-10">
        <div className="w-full rounded-[2rem] border border-white/12 bg-slate-950/60 p-4 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur-2xl sm:p-8">
          <div className="mb-6 sm:mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200/80">Registro</p>
            <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">Crear cuenta</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Completá los datos de acceso y después verificá el mail para habilitar el ingreso.
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

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Nombre
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                  placeholder="Nombre"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Apellido
                <input
                  type="text"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                  placeholder="Apellido"
                  required
                />
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">Anamnesis inicial</p>
              <p className="mt-2 text-sm text-slate-300">
                Estos datos llegan al administrador para validar tu ingreso y alta como alumno.
              </p>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Antecedentes medicos
                  <textarea
                    value={antecedentesMedicos}
                    onChange={(e) => setAntecedentesMedicos(e.target.value)}
                    className="min-h-24 rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                    placeholder="Patologias, diagnosticos, hipertension, asma, etc."
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Lesiones previas
                  <textarea
                    value={lesionesPrevias}
                    onChange={(e) => setLesionesPrevias(e.target.value)}
                    className="min-h-24 rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                    placeholder="Lesiones importantes, fecha aproximada y estado actual."
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Objetivo principal
                  <textarea
                    value={objetivoPrincipal}
                    onChange={(e) => setObjetivoPrincipal(e.target.value)}
                    className="min-h-20 rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                    placeholder="Que esperas lograr con el plan de entrenamiento."
                    required
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-slate-200">
                    Medicacion actual
                    <textarea
                      value={medicacionActual}
                      onChange={(e) => setMedicacionActual(e.target.value)}
                      className="min-h-20 rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                      placeholder="Si no tomas, escribe: Ninguna"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-slate-200">
                    Cirugias o intervenciones
                    <textarea
                      value={cirugias}
                      onChange={(e) => setCirugias(e.target.value)}
                      className="min-h-20 rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                      placeholder="Fechas y zona corporal"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-slate-200">
                    Actividad fisica actual
                    <textarea
                      value={actividadFisicaActual}
                      onChange={(e) => setActividadFisicaActual(e.target.value)}
                      className="min-h-20 rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                      placeholder="Dias, intensidad, deportes"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-slate-200">
                    Restricciones medicas o fisicas
                    <textarea
                      value={restricciones}
                      onChange={(e) => setRestricciones(e.target.value)}
                      className="min-h-20 rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                      placeholder="Movimientos a evitar, recomendaciones medicas"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Telefono
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/55 focus:bg-slate-900"
                  placeholder="Ej: +54 9 11 1234 5678"
                  required
                />
              </label>
            </div>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:from-emerald-300 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-300">
            ¿Ya tenés cuenta?{' '}
            <button
              type="button"
              onClick={() => navigateWithFallback('/auth/login')}
              className="font-bold text-cyan-300 transition hover:text-cyan-200"
            >
              Iniciá sesión acá
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
