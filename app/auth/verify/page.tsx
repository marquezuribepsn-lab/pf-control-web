'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function VerifyPageContent() {
  const loginHref = '/auth/login?verified=1';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [redirectIn, setRedirectIn] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token no proporcionado');
        return;
      }

      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok) {
          setStatus('success');
          setMessage(
            data.message ||
              'Mail verificado. Tu cuenta quedo pendiente de alta del profesor. Te avisaremos cuando puedas ingresar.'
          );
        } else {
          setStatus('error');
          setMessage(data.message || 'Error al verificar email');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Error al conectar');
      }
    };

    verify();
  }, [token]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Verificación
        </h1>

        {status === 'loading' && (
          <div className="space-y-4">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600">Verificando tu email...</p>
          </div>
        )}

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

        {status === 'error' && (
          <div className="space-y-4">
            <div className="text-4xl">✗</div>
            <p className="text-red-600 font-medium">{message}</p>
            <a
              href="/auth/register"
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Volver a registrarse
            </a>
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
