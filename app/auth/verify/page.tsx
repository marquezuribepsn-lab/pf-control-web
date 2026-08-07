'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AuthBackdrop, AuthLoader, AuthPitch } from '../shared';

type VerifyStatus = 'idle' | 'loading' | 'success' | 'error';

function VerifyPageContent() {
  const loginHref = '/auth/login?verified=1';
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [message, setMessage] = useState('');
  const [redirectIn, setRedirectIn] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = String(searchParams.get('token') || '').trim();
  const emailFromQuery = String(searchParams.get('email') || '').trim().toLowerCase();
  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState('');

  const submitVerification = useCallback(
    async (payload: { token?: string; email?: string; code?: string }) => {
      setStatus('loading');
      setMessage('Verificando datos...');

      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          setStatus('success');
          setMessage(
            String(data?.message || 'Mail verificado con exito. Redirigiendo al login.')
          );
          return;
        }

        setStatus('error');
        setMessage(String(data?.message || 'No se pudo verificar el mail.'));
      } catch {
        setStatus('error');
        setMessage('Error al conectar con el servidor.');
      }
    },
    []
  );

  useEffect(() => {
    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }
  }, [emailFromQuery]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void submitVerification({ token });
  }, [token, submitVerification]);

  useEffect(() => {
    if (status !== 'success') {
      setRedirectIn(null);
      return;
    }

    setRedirectIn(3);
    const intervalId = window.setInterval(() => {
      setRedirectIn((prev) => (prev && prev > 0 ? prev - 1 : 0));
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      router.replace(loginHref);

      // Fallback duro para casos donde el router SPA no navega (webview/bloqueos de historial).
      window.setTimeout(() => {
        if (!window.location.pathname.startsWith('/auth/login')) {
          window.location.replace(loginHref);
        }
      }, 180);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [loginHref, router, status]);

  const handleVerifyByCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);

    if (!normalizedEmail) {
      setStatus('error');
      setMessage('Ingresa tu email.');
      return;
    }

    if (normalizedCode.length !== 6) {
      setStatus('error');
      setMessage('Ingresa el codigo de 6 digitos que recibiste por mail.');
      return;
    }

    await submitVerification({ email: normalizedEmail, code: normalizedCode });
  };

  return (
    <main className="pf-v2 pf-v2-auth">
      <AuthBackdrop />
      <AuthPitch />

      <section className="pf-v2-auth-panel">
        <div className="pf-v2-auth-head">
          <span className="pf-v2-auth-logo">PF</span>
        </div>

        <span className="pf-v2-auth-kicker">Verificación</span>
        <h1 className="pf-v2-auth-h2">Verificación de mail</h1>
        <p className="pf-v2-auth-sub">
          Te enviamos un código por email. Ingresalo acá para validar tu cuenta.
        </p>

        {status === "success" ? (
          <div style={{ display: "grid", gap: 18 }}>
            <p className="pf-v2-alert pf-v2-alert-ok">{message}</p>
            <p style={{ fontSize: 13, color: "var(--v2-fg-50)", margin: 0 }}>
              {redirectIn === null
                ? "Preparando redirección..."
                : `Redirigiendo al login en ${redirectIn}s...`}
            </p>
            <button
              type="button"
              className="pf-v2-auth-submit"
              onClick={() => {
                router.replace(loginHref);
                window.setTimeout(() => {
                  if (!window.location.pathname.startsWith("/auth/login")) {
                    window.location.replace(loginHref);
                  }
                }, 120);
              }}
            >
              Ir al login
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerifyByCode} style={{ display: "grid", gap: 18 }}>
            {status === "error" ? (
              <p className="pf-v2-alert pf-v2-alert-error">{message}</p>
            ) : null}

            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="verify-email">Email</label>
              <input
                id="verify-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pf-v2-input"
                placeholder="tu@email.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="pf-v2-field">
              <label className="pf-v2-field-label" htmlFor="verify-code">Código de verificación</label>
              <input
                id="verify-code"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="pf-v2-input"
                style={{ letterSpacing: "0.3em", fontWeight: 700 }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                required
              />
            </div>

            <button type="submit" disabled={status === "loading"} className="pf-v2-auth-submit">
              {status === "loading" ? "Verificando..." : "Verificar mail"}
            </button>
          </form>
        )}

        <div className="pf-v2-divider" style={{ margin: "26px 0 22px" }}>
          <span>Acceso de usuarios</span>
        </div>

        <p className="pf-v2-auth-foot">
          <a href="/auth/register">Volver al registro</a>
        </p>
      </section>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<AuthLoader message="Cargando verificación..." />}>
      <VerifyPageContent />
    </Suspense>
  );
}
