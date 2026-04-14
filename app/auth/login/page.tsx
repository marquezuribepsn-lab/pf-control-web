'use client';

import ReliableActionButton from "@/components/ReliableActionButton";
import { Suspense, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

const LOGIN_FAILED_ATTEMPTS_KEY = 'pf_login_failed_attempts';
const LOGIN_REMEMBER_EMAIL_KEY = 'pf_login_remembered_email';
const LOGIN_REMEMBER_ENABLED_KEY = 'pf_login_remember_enabled';
const LOGIN_REQUEST_TIMEOUT_MS = 12000;
const LOGIN_HARD_REDIRECT_FALLBACK_MS = 1500;

function isSignInFailure(result: unknown) {
  if (typeof result === 'string') {
    return /[?&]error=/i.test(result);
  }

  const payload = (result || {}) as { ok?: boolean; error?: string | null; url?: string | null };
  const errorCode = String(payload.error || '').trim();
  const responseUrl = String(payload.url || '').trim();
  const hasErrorInUrl = /[?&]error=/i.test(responseUrl);
  const explicitFailure = payload.ok === false;

  return explicitFailure || Boolean(errorCode) || hasErrorInUrl;
}

function extractSignInFailureCode(result: unknown): string {
  if (typeof result === 'string') {
    try {
      const parsed = new URL(result, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return String(parsed.searchParams.get('code') || '').trim().toLowerCase();
    } catch {
      return '';
    }
  }

  const payload = (result || {}) as { code?: string | null; url?: string | null };
  const directCode = String(payload.code || '').trim().toLowerCase();
  if (directCode) {
    return directCode;
  }

  const responseUrl = String(payload.url || '').trim();
  if (!responseUrl) {
    return '';
  }

  try {
    const parsed = new URL(responseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return String(parsed.searchParams.get('code') || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function resolveLoginErrorMessage(failureCode: string, fallbackToMagicLink: boolean): string {
  if (failureCode === 'pending_approval') {
    return 'Tu cuenta está verificada pero sigue pendiente de alta del profesor. Te avisaremos cuando quede habilitada.';
  }

  if (fallbackToMagicLink) {
    return 'Email o contraseña incorrectos. Revisa tus datos o usa el acceso por enlace al email.';
  }

  return 'Email o contraseña incorrectos. Revisa tus datos e intenta nuevamente.';
}

function resolvePostLoginHref(result: unknown): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  const responseUrl =
    typeof result === 'string'
      ? result
      : String(((result as { url?: string | null })?.url || '')).trim();

  if (!responseUrl) {
    return '/';
  }

  try {
    const parsed = new URL(responseUrl, window.location.origin);
    if (parsed.pathname.startsWith('/auth/login')) {
      return '/';
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
  } catch {
    return '/';
  }
}

function redirectAfterSuccessfulLogin(result: unknown, router: ReturnType<typeof useRouter>) {
  const targetHref = resolvePostLoginHref(result);
  router.replace(targetHref);

  if (typeof window === 'undefined') {
    return;
  }

  // Keep navigation SPA-only; if the first replace races with pending auth state,
  // retry once without forcing a hard reload.
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.setTimeout(() => {
    const nextUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) {
      router.replace(targetHref);
    }
  }, 240);

  // If client-side navigation is blocked by browser/session quirks, force hard redirect.
  window.setTimeout(() => {
    if (window.location.pathname.startsWith('/auth/login')) {
      window.location.replace(targetHref);
    }
  }, LOGIN_HARD_REDIRECT_FALLBACK_MS);
}

async function signInWithTimeout(options: Parameters<typeof signIn>[1]) {
  let timeoutId: number | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error('LOGIN_TIMEOUT'));
      }, LOGIN_REQUEST_TIMEOUT_MS);
    });

    return await Promise.race([signIn('credentials', options), timeoutPromise]);
  } finally {
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId);
    }
  }
}

function LoginPageContent() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const magicToken = String(searchParams.get('magic') || '').trim();
  const magicEmail = String(searchParams.get('email') || '').trim().toLowerCase();
  const authError = String(searchParams.get('error') || '').trim();
  const authCode = String(searchParams.get('code') || '').trim().toLowerCase();
  const canUseMagicAccess = failedAttempts >= 3;

  useEffect(() => {
    try {
      const storedAttempts = Number(window.sessionStorage.getItem(LOGIN_FAILED_ATTEMPTS_KEY) || 0);
      if (Number.isFinite(storedAttempts) && storedAttempts > 0) {
        setFailedAttempts(Math.min(10, Math.floor(storedAttempts)));
      }

      const rememberEnabled = window.localStorage.getItem(LOGIN_REMEMBER_ENABLED_KEY) === '1';
      if (rememberEnabled) {
        const rememberedEmail = String(window.localStorage.getItem(LOGIN_REMEMBER_EMAIL_KEY) || '')
          .trim()
          .toLowerCase();
        if (rememberedEmail) {
          setEmail(rememberedEmail);
        }
        setRememberMe(true);
      }
    } catch {
      // Ignoramos errores de storage en navegadores restringidos.
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [router, status]);

  useEffect(() => {
    if (!magicEmail) {
      return;
    }
    setEmail(magicEmail);
  }, [magicEmail]);

  useEffect(() => {
    if (authError !== 'CredentialsSignin') {
      return;
    }
    setError(resolveLoginErrorMessage(authCode, false));
  }, [authError, authCode]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(LOGIN_FAILED_ATTEMPTS_KEY, String(failedAttempts));
    } catch {
      // Ignoramos errores de storage en navegadores restringidos.
    }
  }, [failedAttempts]);

  useEffect(() => {
    try {
      if (!rememberMe) {
        window.localStorage.removeItem(LOGIN_REMEMBER_EMAIL_KEY);
        window.localStorage.removeItem(LOGIN_REMEMBER_ENABLED_KEY);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail) {
        window.localStorage.setItem(LOGIN_REMEMBER_EMAIL_KEY, normalizedEmail);
      }
      window.localStorage.setItem(LOGIN_REMEMBER_ENABLED_KEY, '1');
    } catch {
      // Ignoramos errores de storage en navegadores restringidos.
    }
  }, [rememberMe, email]);

  useEffect(() => {
    const consumeMagic = async () => {
      if (!magicToken || !magicEmail || status === 'authenticated') {
        return;
      }

      setMagicLoading(true);
      setError('');

      try {
        const result = await signIn('credentials', {
          email: magicEmail,
          loginToken: magicToken,
          redirect: false,
          callbackUrl: '/',
        });

        if (isSignInFailure(result)) {
          const failureCode = extractSignInFailureCode(result);
          if (failureCode === 'pending_approval') {
            setError(resolveLoginErrorMessage(failureCode, false));
          } else {
            setError('El enlace de acceso es invalido o expiro. Solicita uno nuevo.');
          }
          return;
        }

        setFailedAttempts(0);
        redirectAfterSuccessfulLogin(result, router);
      } catch {
        setError('No pudimos validar el enlace de acceso. Intenta nuevamente.');
      } finally {
        setMagicLoading(false);
      }
    };

    void consumeMagic();
  }, [magicToken, magicEmail, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMagicSent('');

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const result = await signInWithTimeout({
        email: normalizedEmail,
        password,
        rememberMe,
        redirect: false,
        callbackUrl: '/',
      });

      if (isSignInFailure(result)) {
        const failureCode = extractSignInFailureCode(result);
        if (failureCode === 'pending_approval') {
          setError(resolveLoginErrorMessage(failureCode, false));
          return;
        }

        const nextAttempts = Math.min(failedAttempts + 1, 10);
        setFailedAttempts(nextAttempts);
        setError(resolveLoginErrorMessage('', nextAttempts >= 3));
        return;
      }

      setFailedAttempts(0);
      redirectAfterSuccessfulLogin(result, router);
    } catch (err) {
      if (err instanceof Error && err.message === 'LOGIN_TIMEOUT') {
        setError('El inicio de sesion esta tardando demasiado. Revisa la conexion e intenta nuevamente.');
      } else {
        setError('Error al conectar. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestMagicLink = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Ingresa tu email para recibir el enlace de acceso.');
      return;
    }

    setMagicLoading(true);
    setError('');
    setMagicSent('');

    try {
      const response = await fetch('/api/auth/login-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-login-link-source': 'manual_after_password_attempts',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          source: 'manual_after_password_attempts',
          failedAttempts,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.message || 'No se pudo enviar el enlace'));
      }

      setMagicSent('Te enviamos un enlace de acceso al mail de tu cuenta.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el enlace de acceso.');
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#09111f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.22),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.2),_transparent_24%),linear-gradient(135deg,_#09111f_0%,_#102a56_48%,_#1d4ed8_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.35em] text-cyan-100">
              Acceso privado
            </span>
            <h1 className="mt-6 text-6xl font-black leading-none tracking-tight text-white">
              PF Control
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-200/85">
              Toda la plataforma queda bloqueada hasta iniciar sesión. Entrás, trabajás y administrás el plantel desde un único acceso seguro.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <FeatureCard title="Entrenamiento" text="Sesiones y ejercicios con acceso protegido." />
              <FeatureCard title="Plantel" text="Datos, control operativo y seguimiento centralizado." />
              <FeatureCard title="Registros" text="Historial de trabajo y reportes bajo sesión activa." />
              <FeatureCard title="Cuenta" text="Perfil, verificación y cierre de sesión en un solo lugar." />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-lg">
          <div className="rounded-[2rem] border border-white/12 bg-slate-950/55 p-6 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur-2xl sm:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-300/90 via-sky-400/80 to-blue-500/80 text-2xl font-black text-slate-950 shadow-[0_20px_40px_rgba(6,182,212,0.25)]">
                  PF
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Login</p>
                <h2 className="mt-3 text-3xl font-black text-white">Ingresar a la plataforma</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Usá tu cuenta verificada para desbloquear todo el sistema.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Estado</p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">Protegido</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {magicLoading && magicToken ? (
                <div className="rounded-2xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-3 text-sm font-medium text-cyan-100">
                  Validando enlace de acceso...
                </div>
              ) : null}

              {error && (
                <div className="rounded-2xl border border-rose-400/35 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">
                  {error}
                </div>
              )}

              {magicSent ? (
                <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-100">
                  {magicSent}
                </div>
              ) : null}

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/55 focus:bg-slate-900"
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
                  className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/55 focus:bg-slate-900"
                  placeholder="Ingresa tu contraseña"
                  required
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                />
                <span>Recordar inicio de sesión</span>
              </label>

              <ReliableActionButton
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
              </ReliableActionButton>

              {canUseMagicAccess ? (
                <>
                  <p className="text-xs font-semibold text-cyan-200/90">
                    Detectamos varios intentos fallidos. Puedes entrar con un enlace seguro al email.
                  </p>
                  <ReliableActionButton
                    type="button"
                    onClick={handleRequestMagicLink}
                    disabled={magicLoading || loading}
                    className="w-full rounded-2xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {magicLoading ? 'Enviando enlace...' : 'Entrar con enlace al email'}
                  </ReliableActionButton>
                </>
              ) : null}

            <div className="text-right">
              <a href="/auth/forgot-password" className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">
                Olvidé mi contraseña
              </a>
            </div>
            </form>

            <div className="mt-8 flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-slate-500">
              <span className="h-px flex-1 bg-white/10" />
              acceso de usuarios
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <p className="mt-6 text-center text-sm text-slate-300">
              ¿No tenés cuenta?{' '}
              <a href="/auth/register" className="font-bold text-cyan-300 transition hover:text-cyan-200">
                Registrate acá
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="relative isolate min-h-screen overflow-hidden bg-[#09111f] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.22),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.2),_transparent_24%),linear-gradient(135deg,_#09111f_0%,_#102a56_48%,_#1d4ed8_100%)]" />
          <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-10">
            <div className="rounded-2xl border border-white/12 bg-slate-950/55 px-6 py-4 text-sm text-slate-200 backdrop-blur-2xl">
              Cargando acceso...
            </div>
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}
