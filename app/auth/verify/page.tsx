'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Verificacion de mail
        </h1>

        <p className="mb-6 text-sm text-slate-600">
          Te enviamos un codigo por email. Ingresalo aca para validar tu cuenta.
        </p>

        {status === 'success' && (
          <div className="space-y-4">
            <div className="text-4xl">✓</div>
            <p className="text-green-600 font-medium">{message}</p>
            <p className="text-sm text-slate-500">
              {redirectIn === null ? 'Preparando redireccion...' : `Redirigiendo al login en ${redirectIn}s...`}
            </p>
            <button
              type="button"
              onClick={() => {
                router.replace(loginHref);
                window.setTimeout(() => {
                  if (!window.location.pathname.startsWith('/auth/login')) {
                    window.location.replace(loginHref);
                  }
                }, 120);
              }}
              className="inline-block mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Ir al login
            </button>
          </div>
        )}

        {status !== 'success' && (
          <div className="space-y-4 text-left">
            <form onSubmit={handleVerifyByCode} className="space-y-3">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                  required
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Codigo de verificacion
                <input
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="rounded-lg border border-slate-300 px-3 py-2 tracking-[0.3em] font-bold text-slate-800 outline-none focus:border-blue-500"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
              >
                {status === 'loading' ? 'Verificando...' : 'Verificar mail'}
              </button>
            </form>

            {status === 'error' ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {message}
              </p>
            ) : null}

            <div className="text-center">
              <a
                href="/auth/register"
                className="inline-block mt-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Volver al registro
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando verificación...</p>
          </div>
        </div>
      }
    >
      <VerifyPageContent />
    </Suspense>
  );
}
