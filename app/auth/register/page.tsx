'use client';

import ReliableActionButton from "@/components/ReliableActionButton";
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const ALIMENTACION_OPTIONS = [
  'Equilibrada',
  'Desordenada',
  'Alta en ultraprocesados',
  'Vegetariana / vegana',
  'Otro',
] as const;

const INTERES_ENTRENAMIENTO_OPTIONS = [
  'Fuerza y musculacion',
  'Funcional',
  'Mixto / personalizado',
] as const;

const ORIGEN_CONTACTO_OPTIONS = ['Instagram', 'Recomendado', 'Otro'] as const;

type AnamnesisForm = {
  tratamientoMedico: string;
  lesionesLimitaciones: string;
  medicacionRegular: string;
  cirugiasRecientes: string;
  antecedentesClinicos: string;
  autorizacionMedica: string;
  experienciaEntrenamiento: string;
  alimentacionActual: string[];
  alimentacionDetalle: string;
  desordenAlimentario: string;
  consumoSustancias: string;
  suplementos: string;
  interesEntrenamiento: string[];
  interesDetalle: string;
  compromisoObjetivo: number | null;
  origenContacto: string[];
  origenDetalle: string;
  consentimientoSalud: 'si' | 'no' | '';
};

const INITIAL_ANAMNESIS: AnamnesisForm = {
  tratamientoMedico: '',
  lesionesLimitaciones: '',
  medicacionRegular: '',
  cirugiasRecientes: '',
  antecedentesClinicos: '',
  autorizacionMedica: '',
  experienciaEntrenamiento: '',
  alimentacionActual: [],
  alimentacionDetalle: '',
  desordenAlimentario: '',
  consumoSustancias: '',
  suplementos: '',
  interesEntrenamiento: [],
  interesDetalle: '',
  compromisoObjetivo: null,
  origenContacto: [],
  origenDetalle: '',
  consentimientoSalud: '',
};

function toggleListValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export default function RegisterPage() {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
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
  const [showAnamnesis, setShowAnamnesis] = useState(false);
  const [anamnesis, setAnamnesis] = useState<AnamnesisForm>(INITIAL_ANAMNESIS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const commitmentScale = useMemo(() => Array.from({ length: 10 }, (_, index) => index + 1), []);

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

    if (!nombre.trim() || !apellido.trim() || !edad.trim() || !altura.trim() || !peso.trim() || !telefono.trim() || !fechaNacimiento.trim()) {
      setError('Completa nombre, apellido, edad, altura, peso, telefono y fecha de nacimiento.');
      setLoading(false);
      return;
    }

    if (
      !anamnesis.tratamientoMedico.trim() ||
      !anamnesis.lesionesLimitaciones.trim() ||
      !anamnesis.medicacionRegular.trim() ||
      !anamnesis.cirugiasRecientes.trim() ||
      !anamnesis.antecedentesClinicos.trim() ||
      !anamnesis.autorizacionMedica.trim() ||
      !anamnesis.experienciaEntrenamiento.trim() ||
      !anamnesis.desordenAlimentario.trim() ||
      !anamnesis.consumoSustancias.trim() ||
      !anamnesis.suplementos.trim()
    ) {
      setError('Completa todas las respuestas obligatorias del cuestionario de ingreso.');
      setLoading(false);
      return;
    }

    if (
      anamnesis.alimentacionActual.length === 0 ||
      anamnesis.interesEntrenamiento.length === 0 ||
      anamnesis.origenContacto.length === 0 ||
      !anamnesis.compromisoObjetivo
    ) {
      setError('Faltan selecciones obligatorias en el cuestionario (alimentacion, interes, compromiso u origen).');
      setLoading(false);
      return;
    }

    if (anamnesis.consentimientoSalud !== 'si') {
      setError('Debes aceptar la declaracion de aptitud y responsabilidad para crear la cuenta.');
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
          nombre,
          apellido,
          edad,
          altura,
          peso,
          telefono,
          fechaNacimiento,
          club,
          objetivo,
          observaciones,
          anamnesis,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Error al registrarse');
        return;
      }

      setSuccess(data.message || '¡Registro exitoso! Revisa tu email para verificar tu cuenta.');
      setTimeout(() => router.replace('/auth/login?registered=1'), 2200);
    } catch (err) {
      setError('Error al conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#040a17] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.24),transparent_25%),radial-gradient(circle_at_86%_18%,rgba(56,189,248,0.2),transparent_28%),radial-gradient(circle_at_24%_82%,rgba(16,185,129,0.16),transparent_30%),linear-gradient(150deg,#040a17_0%,#0b1d3c_44%,#1e3a8a_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:46px_46px]" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1880px] items-start gap-6 px-4 py-6 lg:grid-cols-[minmax(320px,0.62fr)_minmax(0,1.38fr)] lg:gap-7 lg:px-6 lg:py-8 xl:gap-8 xl:px-8">
        <section className="rounded-[2rem] border border-cyan-200/20 bg-slate-950/45 p-6 shadow-[0_30px_80px_rgba(2,8,25,0.45)] backdrop-blur-xl lg:sticky lg:top-6 lg:max-w-[560px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-cyan-100/85">Alta inicial</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-white">Registro de ingresante</h1>
          <p className="mt-4 text-sm leading-7 text-slate-200/90">
            Completas tus datos, dejas la anamnesis de aptitud fisica y recibes validacion por mail.
            Luego el profesor revisa y habilita tu cuenta.
          </p>

          <div className="mt-7 space-y-3">
            <StepItem index="1" title="Datos personales" text="Nombre, contacto y datos base de salud." />
            <StepItem index="2" title="Anamnesis" text="Cuestionario clinico y habitos en formato desplegable." />
            <StepItem index="3" title="Credenciales" text="Email y contraseña para acceso seguro." />
            <StepItem index="4" title="Verificacion" text="Confirmas mail y el sistema te redirige al login." />
          </div>

          <div className="mt-8 rounded-2xl border border-amber-200/35 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
            Importante: para continuar debes aceptar la declaracion de aptitud y responsabilidad.
          </div>
        </section>

        <section className="min-w-0 rounded-[2rem] border border-white/12 bg-slate-950/65 p-5 shadow-[0_28px_90px_rgba(4,10,24,0.5)] backdrop-blur-2xl sm:p-7 md:p-8 xl:p-9">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-100/85">Formulario</p>
              <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Crea tu cuenta</h2>
              <p className="mt-2 text-sm text-slate-300">La plataforma te pedira validacion de profesor antes de habilitar acceso.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAnamnesis((prev) => !prev)}
              className="rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-500/25"
            >
              {showAnamnesis ? 'Ocultar anamnesis' : 'Mostrar anamnesis'}
            </button>
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
                  placeholder="Ej: Sofía"
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
                  placeholder="Ej: Perez"
                  required
                />
              </label>

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

            <section className="rounded-2xl border border-white/10 bg-slate-900/45 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-black text-white">Cuestionario de ingreso (anamnesis)</p>
                <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
                  Desplegable
                </span>
              </div>

              {showAnamnesis ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextAnswer
                    label="Estas actualmente bajo tratamiento medico?"
                    value={anamnesis.tratamientoMedico}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, tratamientoMedico: value }))}
                    placeholder="Detalle breve"
                  />
                  <TextAnswer
                    label="Tenes o tuviste lesion, dolor o limitacion fisica?"
                    value={anamnesis.lesionesLimitaciones}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, lesionesLimitaciones: value }))}
                    placeholder="Detalle breve"
                  />
                  <TextAnswer
                    label="Tomas medicacion regularmente? Cual?"
                    value={anamnesis.medicacionRegular}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, medicacionRegular: value }))}
                    placeholder="Detalle breve"
                  />
                  <TextAnswer
                    label="Tuviste alguna cirugia en los ultimos 2 anos?"
                    value={anamnesis.cirugiasRecientes}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, cirugiasRecientes: value }))}
                    placeholder="Detalle breve"
                  />
                  <TextAnswer
                    label="Tenes antecedentes de hipertension, diabetes, problemas cardiacos o respiratorios?"
                    value={anamnesis.antecedentesClinicos}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, antecedentesClinicos: value }))}
                    placeholder="Detalle breve"
                  />
                  <TextAnswer
                    label="Tenes autorizacion medica para realizar actividad fisica?"
                    value={anamnesis.autorizacionMedica}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, autorizacionMedica: value }))}
                    placeholder="Detalle breve"
                  />

                  <div className="md:col-span-2">
                    <TextAreaAnswer
                      label="Entrenaste antes? Cuanto tiempo y que tipo de entrenamiento hacias?"
                      value={anamnesis.experienciaEntrenamiento}
                      onChange={(value) => setAnamnesis((prev) => ({ ...prev, experienciaEntrenamiento: value }))}
                    />
                  </div>

                  <OptionGroup
                    label="Como describirias tu alimentacion actual?"
                    options={ALIMENTACION_OPTIONS}
                    selected={anamnesis.alimentacionActual}
                    onToggle={(value) =>
                      setAnamnesis((prev) => ({
                        ...prev,
                        alimentacionActual: toggleListValue(prev.alimentacionActual, value),
                      }))
                    }
                  />

                  <TextAnswer
                    label="Si marcaste Otro en alimentacion, detallalo"
                    value={anamnesis.alimentacionDetalle}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, alimentacionDetalle: value }))}
                    placeholder="Opcional"
                  />

                  <TextAreaAnswer
                    label="Sufris de algun desorden alimentario? Cual?"
                    value={anamnesis.desordenAlimentario}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, desordenAlimentario: value }))}
                  />

                  <TextAnswer
                    label="Consumis alcohol, cigarrillos u otras sustancias?"
                    value={anamnesis.consumoSustancias}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, consumoSustancias: value }))}
                    placeholder="Detalle breve"
                  />

                  <TextAnswer
                    label="Tomas suplementos (proteina, creatina, multivitaminicos, etc.)?"
                    value={anamnesis.suplementos}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, suplementos: value }))}
                    placeholder="Detalle breve"
                  />

                  <OptionGroup
                    label="Que tipo de entrenamiento te interesa mas?"
                    options={INTERES_ENTRENAMIENTO_OPTIONS}
                    selected={anamnesis.interesEntrenamiento}
                    onToggle={(value) =>
                      setAnamnesis((prev) => ({
                        ...prev,
                        interesEntrenamiento: toggleListValue(prev.interesEntrenamiento, value),
                      }))
                    }
                  />

                  <TextAnswer
                    label="Si queres sumar detalle del interes, escribilo"
                    value={anamnesis.interesDetalle}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, interesDetalle: value }))}
                    placeholder="Opcional"
                  />

                  <OptionGroup
                    label="Como llegaste hasta mi?"
                    options={ORIGEN_CONTACTO_OPTIONS}
                    selected={anamnesis.origenContacto}
                    onToggle={(value) =>
                      setAnamnesis((prev) => ({
                        ...prev,
                        origenContacto: toggleListValue(prev.origenContacto, value),
                      }))
                    }
                  />

                  <TextAnswer
                    label="Si marcaste Otro en origen, detallalo"
                    value={anamnesis.origenDetalle}
                    onChange={(value) => setAnamnesis((prev) => ({ ...prev, origenDetalle: value }))}
                    placeholder="Opcional"
                  />

                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-slate-100">Que tan comprometido/a estas con tu objetivo?</p>
                    <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
                      {commitmentScale.map((value) => (
                        <button
                          key={`compromiso-${value}`}
                          type="button"
                          onClick={() => setAnamnesis((prev) => ({ ...prev, compromisoObjetivo: value }))}
                          className={`rounded-lg border px-2 py-1 text-sm font-bold transition ${
                            anamnesis.compromisoObjetivo === value
                              ? 'border-cyan-200 bg-cyan-300 text-slate-950'
                              : 'border-white/20 bg-slate-800/80 text-slate-100 hover:bg-slate-700/80'
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-slate-100">
                      Declaro que los datos son veridicos y autorizo su uso para seguimiento de mi progreso.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setAnamnesis((prev) => ({ ...prev, consentimientoSalud: 'si' }))}
                        className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${
                          anamnesis.consentimientoSalud === 'si'
                            ? 'border-emerald-200 bg-emerald-300 text-slate-950'
                            : 'border-white/20 bg-slate-800/80 text-slate-100 hover:bg-slate-700/80'
                        }`}
                      >
                        Si
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnamnesis((prev) => ({ ...prev, consentimientoSalud: 'no' }))}
                        className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${
                          anamnesis.consentimientoSalud === 'no'
                            ? 'border-rose-200 bg-rose-300 text-slate-950'
                            : 'border-white/20 bg-slate-800/80 text-slate-100 hover:bg-slate-700/80'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-white/10 bg-slate-900/65 px-3 py-2 text-xs text-slate-300">
                  Desplega este bloque para cargar la anamnesis de ingreso.
                </p>
              )}
            </section>

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
        </section>
      </div>
    </main>
  );
}

function StepItem({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200/45 bg-cyan-500/20 text-xs font-black text-cyan-100">
        {index}
      </span>
      <div>
        <p className="text-sm font-black text-white">{title}</p>
        <p className="text-xs text-slate-300">{text}</p>
      </div>
    </div>
  );
}

function TextAnswer({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-3 text-sm font-semibold text-slate-200">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-white/15 bg-slate-800/85 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/55"
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaAnswer({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-3 text-sm font-semibold text-slate-200">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[84px] rounded-xl border border-white/15 bg-slate-800/85 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/55"
      />
    </label>
  );
}

function OptionGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-100">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={`${label}-${option}`}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                active
                  ? 'border-cyan-200/70 bg-cyan-400/20 text-cyan-100'
                  : 'border-white/15 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
