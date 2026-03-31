'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function VerifyPageContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const navigateWithFallback = useCallback((path: string) => {
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
  }, [router]);

  useEffect(() => {
    let timeoutId: number | undefined;

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
          setMessage('Email verificado. Tu cuenta queda pendiente de aprobacion del administrador.');
          timeoutId = window.setTimeout(() => {
            navigateWithFallback('/auth/login');
          }, 3000);
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

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [token, navigateWithFallback]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-xl sm:p-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-800 sm:mb-8 sm:text-3xl">
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
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="text-4xl">✗</div>
            <p className="text-red-600 font-medium">{message}</p>
            <button
              type="button"
              onClick={() => navigateWithFallback('/auth/register')}
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Volver a registrarse
            </button>
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
          <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-xl sm:p-8">
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
