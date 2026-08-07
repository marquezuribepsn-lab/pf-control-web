'use client';

import ReliableActionButton from "@/components/ReliableActionButton";
import DateInput from "@/components/DateInput";
import { useEffect, useMemo, useState } from 'react';
import { AuthBackdrop } from '../shared';
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
  const [anamnesisUnlocked, setAnamnesisUnlocked] = useState(false);
  const [anamnesis, setAnamnesis] = useState<AnamnesisForm>(INITIAL_ANAMNESIS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const commitmentScale = useMemo(() => Array.from({ length: 10 }, (_, index) => index + 1), []);
  const phoneDigits = useMemo(() => telefono.replace(/\D/g, ''), [telefono]);
  const showAnamnesis = anamnesisUnlocked;

  useEffect(() => {
    if (!anamnesisUnlocked && phoneDigits.length >= 8) {
      setAnamnesisUnlocked(true);
    }
  }, [anamnesisUnlocked, phoneDigits]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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

    if (phoneDigits.length < 8) {
      setError('Completa un numero de telefono valido para habilitar la anamnesis.');
      setLoading(false);
      return;
    }

    if (!showAnamnesis) {
      setError('Completa telefono para desplegar y responder la anamnesis.');
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

      const normalizedEmail = email.trim().toLowerCase();
      const verifyHref = `/auth/verify?email=${encodeURIComponent(normalizedEmail)}`;

      router.replace(verifyHref);

      window.setTimeout(() => {
        if (!window.location.pathname.startsWith('/auth/verify')) {
          window.location.replace(verifyHref);
        }
      }, 180);

      return;
    } catch (err) {
      setError('Error al conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pf-v2 pf-v2-auth">
      <AuthBackdrop />

      <section className="pf-v2-auth-pitch">
        <span className="pf-v2-auth-badge">Alta inicial</span>
        <h1 className="pf-v2-auth-title" style={{ fontSize: "clamp(32px, 4vw, 44px)" }}>
          Registro de ingresante
        </h1>
        <p className="pf-v2-auth-lead">
          Completás tus datos, dejás la anamnesis de aptitud física y recibís validación
          por mail. Después el profesor revisa y habilita tu cuenta.
        </p>

        <ol style={{ display: "grid", gap: 8, listStyle: "none", margin: 0, padding: 0, maxWidth: 480 }}>
          <StepItem index="1" title="Datos personales" text="Nombre, contacto y datos base de salud." />
          <StepItem index="2" title="Anamnesis" text="Cuestionario clínico y hábitos." />
          <StepItem index="3" title="Credenciales" text="Email y contraseña para acceso seguro." />
          <StepItem index="4" title="Verificación" text="Confirmás el mail y entrás al login." />
        </ol>

        <p className="pf-v2-alert" style={{ maxWidth: 480 }}>
          <strong style={{ color: "var(--v2-warning)" }}>Importante:</strong>{" "}
          para continuar tenés que aceptar la declaración de aptitud y responsabilidad.
        </p>
      </section>

      <section className="pf-v2-auth-panel pf-v2-auth-panel-wide">
        <div className="pf-v2-auth-head">
          <span className="pf-v2-auth-logo">PF</span>
        </div>

        <span className="pf-v2-auth-kicker">Formulario</span>
        <h2 className="pf-v2-auth-h2">Creá tu cuenta</h2>
        <p className="pf-v2-auth-sub">
          La plataforma te va a pedir validación del profesor antes de habilitar el acceso.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
          {error ? <p className="pf-v2-alert pf-v2-alert-error">{error}</p> : null}

          <div className="pf-v2-quiz-grid">
            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="reg-nombre">Nombre</label>
              <input id="reg-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                className="pf-v2-input" placeholder="Ej: Sofía" autoComplete="given-name" required />
            </div>

            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="reg-apellido">Apellido</label>
              <input id="reg-apellido" type="text" value={apellido} onChange={(e) => setApellido(e.target.value)}
                className="pf-v2-input" placeholder="Ej: Pérez" autoComplete="family-name" required />
            </div>

            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="reg-edad">Edad</label>
              <input id="reg-edad" type="number" min={1} max={120} value={edad} onChange={(e) => setEdad(e.target.value)}
                className="pf-v2-input" placeholder="Ej: 24" required />
            </div>

            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="reg-nacimiento">Fecha de nacimiento</label>
              <DateInput id="reg-nacimiento" value={fechaNacimiento} onChange={setFechaNacimiento}
                className="pf-v2-input" required />
            </div>

            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="reg-altura">Altura (cm)</label>
              <input id="reg-altura" type="number" min={0} step="0.1" value={altura} onChange={(e) => setAltura(e.target.value)}
                className="pf-v2-input" placeholder="Ej: 172" required />
            </div>

            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="reg-peso">Peso (kg)</label>
              <input id="reg-peso" type="number" min={0} step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)}
                className="pf-v2-input" placeholder="Ej: 68" required />
            </div>

            <div className="pf-v2-field pf-v2-quiz-wide">
              <label className="pf-v2-field-label" htmlFor="reg-telefono">Número de teléfono</label>
              <input id="reg-telefono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)}
                className="pf-v2-input" placeholder="Ej: +5491112345678" autoComplete="tel" required />
            </div>
          </div>

          <section className="pf-v2-quiz">
            <div className="pf-v2-quiz-head">
              <h3 className="pf-v2-h2" style={{ fontSize: 15 }}>Cuestionario de ingreso (anamnesis)</h3>
              <span className={`pf-v2-chip ${showAnamnesis ? "pf-v2-chip-ok" : "pf-v2-chip-accent"}`}>
                {showAnamnesis ? "Habilitado" : "Se habilita al completar teléfono"}
              </span>
            </div>

            {showAnamnesis ? (
              <div className="pf-v2-quiz-grid">
                <TextAnswer label="¿Estás actualmente bajo tratamiento médico?"
                  value={anamnesis.tratamientoMedico}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, tratamientoMedico: v }))}
                  placeholder="Detalle breve" />
                <TextAnswer label="¿Tenés o tuviste lesión, dolor o limitación física?"
                  value={anamnesis.lesionesLimitaciones}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, lesionesLimitaciones: v }))}
                  placeholder="Detalle breve" />
                <TextAnswer label="¿Tomás medicación regularmente? ¿Cuál?"
                  value={anamnesis.medicacionRegular}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, medicacionRegular: v }))}
                  placeholder="Detalle breve" />
                <TextAnswer label="¿Tuviste alguna cirugía en los últimos 2 años?"
                  value={anamnesis.cirugiasRecientes}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, cirugiasRecientes: v }))}
                  placeholder="Detalle breve" />
                <TextAnswer label="¿Antecedentes de hipertensión, diabetes, problemas cardíacos o respiratorios?"
                  value={anamnesis.antecedentesClinicos}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, antecedentesClinicos: v }))}
                  placeholder="Detalle breve" />
                <TextAnswer label="¿Tenés autorización médica para realizar actividad física?"
                  value={anamnesis.autorizacionMedica}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, autorizacionMedica: v }))}
                  placeholder="Detalle breve" />

                <div className="pf-v2-quiz-wide">
                  <TextAreaAnswer label="¿Entrenaste antes? ¿Cuánto tiempo y qué tipo de entrenamiento hacías?"
                    value={anamnesis.experienciaEntrenamiento}
                    onChange={(v) => setAnamnesis((prev) => ({ ...prev, experienciaEntrenamiento: v }))} />
                </div>

                <OptionGroup label="¿Cómo describirías tu alimentación actual?"
                  options={ALIMENTACION_OPTIONS}
                  selected={anamnesis.alimentacionActual}
                  onToggle={(v) => setAnamnesis((prev) => ({ ...prev, alimentacionActual: toggleListValue(prev.alimentacionActual, v) }))} />

                <TextAnswer label='Si marcaste "Otro" en alimentación, detallalo'
                  value={anamnesis.alimentacionDetalle}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, alimentacionDetalle: v }))}
                  placeholder="Opcional" />

                <TextAreaAnswer label="¿Sufrís de algún desorden alimentario? ¿Cuál?"
                  value={anamnesis.desordenAlimentario}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, desordenAlimentario: v }))} />

                <TextAnswer label="¿Consumís alcohol, cigarrillos u otras sustancias?"
                  value={anamnesis.consumoSustancias}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, consumoSustancias: v }))}
                  placeholder="Detalle breve" />

                <TextAnswer label="¿Tomás suplementos (proteína, creatina, multivitamínicos)?"
                  value={anamnesis.suplementos}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, suplementos: v }))}
                  placeholder="Detalle breve" />

                <OptionGroup label="¿Qué tipo de entrenamiento te interesa más?"
                  options={INTERES_ENTRENAMIENTO_OPTIONS}
                  selected={anamnesis.interesEntrenamiento}
                  onToggle={(v) => setAnamnesis((prev) => ({ ...prev, interesEntrenamiento: toggleListValue(prev.interesEntrenamiento, v) }))} />

                <TextAnswer label="Si querés sumar detalle del interés, escribilo"
                  value={anamnesis.interesDetalle}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, interesDetalle: v }))}
                  placeholder="Opcional" />

                <OptionGroup label="¿Cómo llegaste hasta mí?"
                  options={ORIGEN_CONTACTO_OPTIONS}
                  selected={anamnesis.origenContacto}
                  onToggle={(v) => setAnamnesis((prev) => ({ ...prev, origenContacto: toggleListValue(prev.origenContacto, v) }))} />

                <TextAnswer label='Si marcaste "Otro" en origen, detallalo'
                  value={anamnesis.origenDetalle}
                  onChange={(v) => setAnamnesis((prev) => ({ ...prev, origenDetalle: v }))}
                  placeholder="Opcional" />

                <fieldset className="pf-v2-quiz-wide" style={{ border: 0, margin: 0, padding: 0 }}>
                  <legend className="pf-v2-field-label" style={{ marginBottom: 10 }}>
                    ¿Qué tan comprometido/a estás con tu objetivo?
                  </legend>
                  <div className="pf-v2-scale">
                    {commitmentScale.map((value) => (
                      <button key={`compromiso-${value}`} type="button"
                        aria-pressed={anamnesis.compromisoObjetivo === value}
                        onClick={() => setAnamnesis((prev) => ({ ...prev, compromisoObjetivo: value }))}>
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="pf-v2-quiz-wide" style={{ border: 0, margin: 0, padding: 0 }}>
                  <legend className="pf-v2-field-label" style={{ marginBottom: 10 }}>
                    Declaro que los datos son verídicos y autorizo su uso para seguimiento de mi progreso.
                  </legend>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" className="pf-v2-option"
                      aria-pressed={anamnesis.consentimientoSalud === "si"}
                      onClick={() => setAnamnesis((prev) => ({ ...prev, consentimientoSalud: "si" }))}>
                      Sí
                    </button>
                    <button type="button" className="pf-v2-option"
                      aria-pressed={anamnesis.consentimientoSalud === "no"}
                      onClick={() => setAnamnesis((prev) => ({ ...prev, consentimientoSalud: "no" }))}>
                      No
                    </button>
                  </div>
                </fieldset>
              </div>
            ) : (
              <p className="pf-v2-muted" style={{ margin: 0 }}>
                Completá un número de teléfono válido y la anamnesis se despliega automáticamente acá abajo.
              </p>
            )}
          </section>

          <div className="pf-v2-field">
            <label className="pf-v2-field-label" htmlFor="reg-club">Club (opcional)</label>
            <input id="reg-club" type="text" value={club} onChange={(e) => setClub(e.target.value)}
              className="pf-v2-input" placeholder="Club / institución" />
          </div>

          <div className="pf-v2-field">
            <label className="pf-v2-field-label" htmlFor="reg-objetivo">Objetivo (opcional)</label>
            <input id="reg-objetivo" type="text" value={objetivo} onChange={(e) => setObjetivo(e.target.value)}
              className="pf-v2-input" placeholder="Objetivo principal" />
          </div>

          <div className="pf-v2-field">
            <label className="pf-v2-field-label" htmlFor="reg-observaciones">Observaciones (opcional)</label>
            <textarea id="reg-observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              className="pf-v2-input" rows={3} placeholder="Info adicional" />
          </div>

          <div className="pf-v2-field">
            <label className="pf-v2-field-label" htmlFor="reg-email">Email</label>
            <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="pf-v2-input" placeholder="tu@email.com" autoComplete="email" required />
          </div>

          <div className="pf-v2-quiz-grid">
            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="reg-password">Contraseña</label>
              <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="pf-v2-input" placeholder="Mínimo 6 caracteres" autoComplete="new-password" minLength={6} required />
            </div>

            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="reg-confirm">Confirmar contraseña</label>
              <input id="reg-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="pf-v2-input" placeholder="Repetí la contraseña" autoComplete="new-password" minLength={6} required />
            </div>
          </div>

          <ReliableActionButton type="submit" disabled={loading} className="pf-v2-auth-submit">
            {loading ? "Registrando..." : "Crear cuenta"}
          </ReliableActionButton>
        </form>

        <div className="pf-v2-divider" style={{ margin: "26px 0 22px" }}>
          <span>Acceso de usuarios</span>
        </div>

        <p className="pf-v2-auth-foot">
          ¿Ya tenés cuenta? <a href="/auth/login">Iniciá sesión acá</a>
        </p>
      </section>
    </main>
  );
}

function StepItem({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <li className="pf-v2-step">
      <span className="pf-v2-step-n">{index}</span>
      <span>
        <span className="pf-v2-step-title">{title}</span>
        <span className="pf-v2-step-text">{text}</span>
      </span>
    </li>
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
    <label className="pf-v2-field">
      <span className="pf-v2-field-label">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pf-v2-input"
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
    <label className="pf-v2-field">
      <span className="pf-v2-field-label">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pf-v2-input"
        rows={3}
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
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <legend className="pf-v2-field-label" style={{ marginBottom: 9 }}>{label}</legend>
      <div className="pf-v2-option-grid">
        {options.map((option) => (
          <button
            key={`${label}-${option}`}
            type="button"
            className="pf-v2-option"
            aria-pressed={selected.includes(option)}
            onClick={() => onToggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
