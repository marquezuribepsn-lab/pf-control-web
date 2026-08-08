'use client';

import ReliableActionButton from "@/components/ReliableActionButton";
import { useState } from 'react';
import { AuthBackdrop, AuthPitch } from '../shared';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo enviar el mail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pf-v2 pf-v2-auth">
      <AuthBackdrop />
      <AuthPitch />

      <section className="pf-v2-auth-panel">
        <div className="pf-v2-auth-head">
          <span className="pf-v2-auth-logo">PF</span>
        </div>

        <span className="pf-v2-auth-kicker">Recuperación</span>
        <h1 className="pf-v2-auth-h2">Olvidé mi contraseña</h1>
        <p className="pf-v2-auth-sub">
          Ingresá tu email y te enviaremos un enlace para crear una nueva contraseña.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          {message ? <p className="pf-v2-alert pf-v2-alert-ok">{message}</p> : null}
          {error ? <p className="pf-v2-alert pf-v2-alert-error">{error}</p> : null}

          <div className="pf-v2-field">
            <label className="pf-v2-field-label-lg" htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="pf-v2-input pf-v2-input-lg"
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          </div>

          <ReliableActionButton type="submit" disabled={loading} className="pf-v2-auth-submit">
            {loading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
          </ReliableActionButton>
        </form>

        <div className="pf-v2-divider" style={{ margin: '26px 0 22px' }}>
          <span>Acceso de usuarios</span>
        </div>

        <p className="pf-v2-auth-foot">
          ¿Recordaste tu contraseña? <a href="/auth/login">Volver al login</a>
        </p>
      </section>
    </main>
  );
}
