'use client';

import ReliableActionButton from "@/components/ReliableActionButton";
import { AuthBackdrop, AuthLoader, AuthPitch } from "../shared";
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
  const [showManualRedirect, setShowManualRedirect] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('El enlace no es válido o está incompleto.');
    }
  }, [token]);

  useEffect(() => {
    if (!redirecting) {
      return;
    }

    const targetHref = '/auth/login';
    setShowManualRedirect(false);

    const softRedirect = window.setTimeout(() => {
      router.replace(targetHref);
    }, 350);

    const softRetry = window.setTimeout(() => {
      router.replace(targetHref);
    }, 1000);

    const hardFallback = window.setTimeout(() => {
      if (window.location.pathname.startsWith('/auth/reset-password')) {
        window.location.replace(targetHref);
      }
    }, 1800);

    const manualFallback = window.setTimeout(() => {
      setShowManualRedirect(true);
    }, 2600);

    return () => {
      window.clearTimeout(softRedirect);
      window.clearTimeout(softRetry);
      window.clearTimeout(hardFallback);
      window.clearTimeout(manualFallback);
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
      setShowManualRedirect(false);
      setRedirecting(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo restablecer la contraseña');
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

        <span className="pf-v2-auth-kicker">Nueva contraseña</span>
        <h1 className="pf-v2-auth-h2">Restablecer contraseña</h1>
        <p className="pf-v2-auth-sub">
          Elegí una nueva contraseña para volver a entrar a PF Control.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
          {message ? <p className="pf-v2-alert pf-v2-alert-ok">{message}</p> : null}
          {error ? <p className="pf-v2-alert pf-v2-alert-error">{error}</p> : null}

          <div className="pf-v2-field">
            <label className="pf-v2-field-label" htmlFor="reset-password">Nueva contraseña</label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pf-v2-input"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <div className="pf-v2-field">
            <label className="pf-v2-field-label" htmlFor="reset-confirm">Confirmar contraseña</label>
            <input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="pf-v2-input"
              placeholder="Repetí la nueva contraseña"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <ReliableActionButton
            type="submit"
            disabled={loading || redirecting || !token}
            className="pf-v2-auth-submit"
          >
            {redirecting ? "Redirigiendo al login..." : loading ? "Guardando..." : "Guardar nueva contraseña"}
          </ReliableActionButton>

          {showManualRedirect ? (
            <ReliableActionButton
              type="button"
              onClick={() => window.location.replace("/auth/login")}
              className="pf-v2-auth-submit pf-v2-auth-submit-2"
            >
              Ir al login ahora
            </ReliableActionButton>
          ) : null}
        </form>

        <div className="pf-v2-divider" style={{ margin: "26px 0 22px" }}>
          <span>Acceso de usuarios</span>
        </div>

        <p className="pf-v2-auth-foot">
          <a href="/auth/login">Volver al login</a>
        </p>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLoader message="Cargando..." />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
