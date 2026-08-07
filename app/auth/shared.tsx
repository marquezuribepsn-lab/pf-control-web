'use client';

/**
 * Piezas comunes a las pantallas de acceso (login, registro, recuperación).
 *
 * Todas comparten el mismo layout partido del handoff v2: a la izquierda lo que
 * la plataforma promete, a la derecha el formulario. Las clases viven en
 * `app/admin-v2.css` bajo el namespace `.pf-v2-auth-*`.
 */

/** Fondo del handoff: manchas radiales con blur, ruido y viñeta. */
export function AuthBackdrop() {
  return (
    <div className="pf-v2-bg" aria-hidden="true">
      <div className="pf-v2-blob pf-v2-blob-1" />
      <div className="pf-v2-blob pf-v2-blob-2" />
      <div className="pf-v2-blob pf-v2-blob-3" />
      <div className="pf-v2-noise" />
      <div className="pf-v2-vignette" />
    </div>
  );
}

const PITCH = [
  { title: 'Entrenamiento', desc: 'Sesiones y ejercicios con acceso protegido.' },
  { title: 'Plantel', desc: 'Datos, control operativo y seguimiento centralizado.' },
  { title: 'Registros', desc: 'Historial de trabajo y reportes bajo sesión activa.' },
  { title: 'Cuenta', desc: 'Perfil, verificación y cierre de sesión en un solo lugar.' },
];

/** Columna izquierda. Se oculta en pantallas angostas (ver admin-v2.css). */
export function AuthPitch() {
  return (
    <section className="pf-v2-auth-pitch">
      <span className="pf-v2-auth-badge">Acceso privado</span>
      <h1 className="pf-v2-auth-title">PF Control</h1>
      <p className="pf-v2-auth-lead">
        Toda la plataforma queda bloqueada hasta iniciar sesión. Entrás, trabajás y
        administrás el plantel desde un único acceso seguro.
      </p>
      <dl className="pf-v2-auth-features">
        {PITCH.map((f) => (
          <div key={f.title} className="pf-v2-auth-feature">
            <dt>{f.title}</dt>
            <dd>{f.desc}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Pantalla de espera, con el mismo fondo que el resto del acceso. */
export function AuthLoader({ message }: { message: string }) {
  return (
    <main className="pf-v2 pf-v2-auth">
      <AuthBackdrop />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
        }}
      >
        <span className="pf-v2-auth-logo">PF</span>
        <p style={{ fontSize: 13, color: 'var(--v2-fg-50)', margin: 0 }}>{message}</p>
      </div>
    </main>
  );
}
