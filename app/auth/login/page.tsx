'use client';

import ReliableActionButton from "@/components/ReliableActionButton";
import { AuthBackdrop, AuthLoader, AuthPitch } from "../shared";
import PasswordRevealInput from "@/components/PasswordRevealInput";
import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
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
  if (failureCode === 'account_blocked') {
    return 'Tu cuenta esta suspendida o dada de baja. Contacta al profesor para revisar el estado.';
  }

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

/**
 * Implementación directa del flujo de login con NextAuth v5.
 * En lugar de usar signIn() de next-auth/react (que tiene bugs de CSRF en beta.30
 * detrás de proxy nginx), manejamos el CSRF manualmente:
 * 1. GET /api/auth/csrf  → obtiene token + setea cookie
 * 2. POST /api/auth/callback/credentials con csrfToken en el body
 */
async function signInDirect(credentials: {
  email: string;
  password?: string;
  loginToken?: string;
  rememberMe: boolean;
  callbackUrl: string;
}): Promise<{ ok: boolean; error?: string | null; url?: string | null }> {
  // 1. Obtener CSRF token (la respuesta también setea la cookie __Host-authjs.csrf-token)
  const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!csrfRes.ok) throw new Error('CSRF_FETCH_FAILED');
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  if (!csrfToken) throw new Error('CSRF_EMPTY');

  // 2. POST credenciales + csrfToken
  const body = new URLSearchParams();
  body.set('csrfToken', csrfToken);
  body.set('callbackUrl', credentials.callbackUrl);
  body.set('email', credentials.email);
  if (credentials.password) body.set('password', credentials.password);
  if (credentials.loginToken) body.set('loginToken', credentials.loginToken);
  body.set('rememberMe', credentials.rememberMe ? 'true' : '');
  body.set('json', 'true');

  const res = await fetch('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'include',
    redirect: 'manual', // no seguir redirects automáticamente
    body: body.toString(),
  });

  // NextAuth devuelve redirect o JSON según el header 'json: true'
  if (res.type === 'opaqueredirect') {
    // Redirect manual — si la URL no tiene error= es éxito
    return { ok: true, url: credentials.callbackUrl };
  }

  if (res.headers.get('content-type')?.includes('application/json')) {
    const data = (await res.json()) as { url?: string; error?: string };
    const hasError = Boolean(data.error) || /[?&]error=/i.test(data.url || '');
    return { ok: !hasError, error: data.error || null, url: data.url || null };
  }

  // Respuesta de redirect: ver Location header
  const location = res.headers.get('location') || '';
  const hasError = /[?&]error=/i.test(location);
  return { ok: !hasError, url: hasError ? null : credentials.callbackUrl, error: hasError ? location : null };
}

async function signInWithTimeout(options: {
  email: string;
  password?: string;
  loginToken?: string;
  rememberMe: boolean;
  redirect: boolean;
  callbackUrl: string;
}) {
  let timeoutId: number | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error('LOGIN_TIMEOUT'));
      }, LOGIN_REQUEST_TIMEOUT_MS);
    });

    return await Promise.race([signInDirect(options), timeoutPromise]);
  } finally {
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId);
    }
  }
}

function LoginPageContent() {
  // ── Todos los hooks deben ir antes de cualquier return condicional ──
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
        const result = await signInDirect({
          email: magicEmail,
          loginToken: magicToken,
          rememberMe: false,
          callbackUrl: '/',
        });

        if (isSignInFailure(result)) {
          const failureCode = extractSignInFailureCode(result);
          if (failureCode === 'pending_approval' || failureCode === 'account_blocked') {
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

  // ── Returns condicionales DESPUÉS de todos los hooks ──
  if (status === 'loading') {
    return <AuthLoader message="Verificando sesión..." />;
  }

  if (status === 'authenticated') {
    return <AuthLoader message="Redirigiendo..." />;
  }

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
        if (failureCode === 'pending_approval' || failureCode === 'account_blocked') {
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
    <main className="pf-v2 pf-v2-auth">
      <AuthBackdrop />
      <AuthPitch />

      <section className="pf-v2-auth-panel">
        <div className="pf-v2-auth-head">
          <span className="pf-v2-auth-logo">PF</span>
          <dl className="pf-v2-auth-status">
            <dt>Estado</dt>
            <dd>Protegido</dd>
          </dl>
        </div>

        <span className="pf-v2-auth-kicker">Login</span>
        <h2 className="pf-v2-auth-h2">Ingresar a la plataforma</h2>
        <p className="pf-v2-auth-sub">
          Usá tu cuenta verificada para desbloquear todo el sistema.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
          {magicLoading && magicToken ? (
            <p className="pf-v2-alert pf-v2-alert-info">Validando enlace de acceso...</p>
          ) : null}

          {error ? <p className="pf-v2-alert pf-v2-alert-error">{error}</p> : null}
          {magicSent ? <p className="pf-v2-alert pf-v2-alert-ok">{magicSent}</p> : null}

          <div className="pf-v2-field">
            <label className="pf-v2-field-label-lg" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pf-v2-input pf-v2-input-lg"
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="pf-v2-field">
            <label className="pf-v2-field-label-lg" htmlFor="login-password">Contraseña</label>
            <PasswordRevealInput
              id="login-password"
              value={password}
              onChange={setPassword}
              className="pf-v2-input pf-v2-input-lg"
              placeholder="Ingresa tu contraseña"
              required
            />
          </div>

          <label className="pf-v2-check">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span className="pf-v2-check-box" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="#00131a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10.5 L8 14.5 L16 5.5" />
              </svg>
            </span>
            <span>Recordar inicio de sesión</span>
          </label>

          <ReliableActionButton type="submit" disabled={loading} className="pf-v2-auth-submit">
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </ReliableActionButton>

          {canUseMagicAccess ? (
            <>
              <p style={{ fontSize: 12.5, color: "var(--v2-accent)", margin: 0 }}>
                Detectamos varios intentos fallidos. Podés entrar con un enlace seguro al email.
              </p>
              <ReliableActionButton
                type="button"
                onClick={handleRequestMagicLink}
                disabled={magicLoading || loading}
                className="pf-v2-auth-submit pf-v2-auth-submit-2"
              >
                {magicLoading ? "Enviando enlace..." : "Entrar con enlace al email"}
              </ReliableActionButton>
            </>
          ) : null}

          <a href="/auth/forgot-password" className="pf-v2-auth-link" style={{ textAlign: "right" }}>
            Olvidé mi contraseña
          </a>
        </form>

        <div className="pf-v2-divider" style={{ margin: "26px 0 22px" }}>
          <span>Acceso de usuarios</span>
        </div>

        <p className="pf-v2-auth-foot">
          ¿No tenés cuenta? <a href="/auth/register">Registrate acá</a>
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoader message="Cargando acceso..." />}>
      <LoginPageContent />
    </Suspense>
  );
}
