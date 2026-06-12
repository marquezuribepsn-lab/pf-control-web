import NextAuth, { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { decode as jwtDecode, encode as jwtEncode } from 'next-auth/jwt';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { resolveBillingAccessByEmail } from './billing';

const db = prisma as any;
const REMEMBERED_SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const SHORT_SESSION_MAX_AGE = 24 * 60 * 60;
const BILLING_REFRESH_WINDOW_MS = 120 * 1000; // 2 min — reduce DB queries per page load

type AuthUserRecord = {
  id: string;
  email: string;
  password: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'COLABORADOR' | 'CLIENTE';
  estado: string;
  emailVerified: boolean;
};

class AccountBlockedSigninError extends CredentialsSignin {
  code = 'account_blocked';
}

function normalizeEmailInput(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function getPasswordCandidates(rawPassword: string): string[] {
  const normalized = rawPassword.normalize('NFKC');
  const trimmed = normalized.trim();

  if (trimmed && trimmed !== normalized) {
    return [normalized, trimmed];
  }

  return [normalized];
}

async function findUserByEmail(email: string): Promise<AuthUserRecord | null> {
  try {
    const exactMatch = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        estado: true,
        emailVerified: true,
      },
    });

    if (exactMatch) {
      return exactMatch as AuthUserRecord;
    }
  } catch (error) {
    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

    if (errorCode !== 'P2023') {
      throw error;
    }
  }

  // Legacy compatibility for accounts stored with mixed-case emails.
  const caseInsensitiveMatch = await db.$queryRaw<AuthUserRecord[]>`
    SELECT id, email, password, role, estado, "emailVerified"
    FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;

  return Array.isArray(caseInsensitiveMatch) && caseInsensitiveMatch.length > 0
    ? caseInsensitiveMatch[0]
    : null;
}

class ForceSignOutError extends Error {
  code = 'FORCE_SIGN_OUT';
  constructor() { super('Session invalidated by admin'); }
}

async function refreshAdminSubscriptionClaims(token: Record<string, unknown>, force = false) {
  const email = normalizeEmailInput(token.email);
  if (!email) {
    token.subscriptionActive = true;
    token.subscriptionReason = 'no-meta';
    token.subscriptionCheckedAt = Date.now();
    return;
  }

  const now = Date.now();
  const checkedAt = Number(token.subscriptionCheckedAt || 0);
  const recentlyChecked = Number.isFinite(checkedAt) && now - checkedAt < BILLING_REFRESH_WINDOW_MS;

  if (!force && recentlyChecked) {
    return;
  }

  // Check for forced sign-out
  const userRecord = await findUserByEmail(email);
  if (userRecord && String(userRecord.estado || '').trim().toLowerCase() === 'force-logout') {
    await db.user.update({ where: { email }, data: { estado: 'activo' } }).catch(() => {});
    throw new ForceSignOutError();
  }

  // Check profesor subscription
  try {
    const userId = String(token.id || '');
    if (!userId) {
      token.subscriptionActive = true;
      token.subscriptionReason = 'no-id';
      token.subscriptionCheckedAt = now;
      return;
    }

    const sub = await db.profesorSubscription.findUnique({
      where: { profesorId: userId },
      select: { estado: true, fechaVencimiento: true, planTipo: true, maxAlumnos: true, maxPlanes: true },
    });

    if (!sub) {
      // No subscription record yet — allow access (first time setup)
      token.subscriptionActive = true;
      token.subscriptionReason = 'no-sub';
      token.subscriptionCheckedAt = now;
      return;
    }

    const estado = String(sub.estado || '').toLowerCase();
    const vencimiento = sub.fechaVencimiento ? new Date(sub.fechaVencimiento) : null;
    const expired = vencimiento && vencimiento < new Date();

    if (estado === 'suspendido' || estado === 'cancelado' || (estado === 'vencido') || (estado === 'activo' && expired)) {
      token.subscriptionActive = false;
      token.subscriptionReason = expired ? 'expired' : estado;
    } else {
      token.subscriptionActive = true;
      token.subscriptionReason = estado;
    }

    token.subscriptionEndDate = vencimiento ? vencimiento.toISOString() : null;
    token.subscriptionPlan = sub.planTipo;
    token.maxAlumnos = sub.maxAlumnos;
    token.maxPlanes = sub.maxPlanes;
    token.subscriptionCheckedAt = now;
  } catch {
    token.subscriptionActive = true;
    token.subscriptionReason = 'db-error';
    token.subscriptionCheckedAt = now;
  }
}

async function refreshClienteBillingClaims(token: Record<string, unknown>, force = false) {
  const email = normalizeEmailInput(token.email);
  if (!email) {
    token.subscriptionActive = true;
    token.subscriptionReason = 'no-meta';
    token.subscriptionEndDate = null;
    token.subscriptionCheckedAt = Date.now();
    return;
  }

  const now = Date.now();
  const checkedAt = Number(token.subscriptionCheckedAt || 0);
  const recentlyChecked = Number.isFinite(checkedAt) && now - checkedAt < BILLING_REFRESH_WINDOW_MS;

  if (!force && recentlyChecked) {
    return;
  }

  // Check for forced sign-out flag
  const userRecord = await findUserByEmail(email);
  if (userRecord && String(userRecord.estado || '').trim().toLowerCase() === 'force-logout') {
    // Reset so user can sign in again after being kicked out
    await db.user.update({ where: { email }, data: { estado: 'activo' } }).catch(() => {});
    throw new ForceSignOutError();
  }

  const access = await resolveBillingAccessByEmail(email);
  token.subscriptionActive = access.active;
  token.subscriptionReason = access.reason;
  token.subscriptionEndDate = access.meta?.endDate ? String(access.meta.endDate) : null;
  token.subscriptionCheckedAt = now;
}

export const authConfig = {
  trustHost: true,
  // Forzar nombres de cookies consistentes para entorno nginx HTTPS → HTTP proxy.
  // Sin esto, NextAuth usa "__Host-" al setear (ve AUTH_URL=https://)
  // pero busca sin prefijo al validar (ve request en http://localhost).
  // Resultado: MissingCSRF en cada intento de login.
  cookies: {
    sessionToken: {
      name: "__Secure-authjs.session-token",
      options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: true },
    },
    callbackUrl: {
      name: "__Secure-authjs.callback-url",
      options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: true },
    },
    csrfToken: {
      name: "__Host-authjs.csrf-token",
      options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: true },
    },
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        loginToken: { label: 'Login token', type: 'text' },
        rememberMe: { label: 'Remember me', type: 'checkbox' },
      },
      async authorize(credentials) {
        const email = normalizeEmailInput(credentials?.email);
        const password = typeof credentials?.password === 'string' ? credentials.password : null;
        const loginToken =
          typeof credentials?.loginToken === 'string' ? credentials.loginToken.trim() : null;
        const rememberMe =
          credentials?.rememberMe === true ||
          credentials?.rememberMe === 'true' ||
          credentials?.rememberMe === '1' ||
          credentials?.rememberMe === 'on';

        if (!email) {
          return null;
        }

        const user = await findUserByEmail(email);

        if (!user || !user.emailVerified) {
          return null;
        }

        const userStatus = String((user as any).estado || 'activo').trim().toLowerCase();
        if (user.role === 'CLIENTE' && (userStatus === 'suspendido' || userStatus === 'baja')) {
          throw new AccountBlockedSigninError();
        }

        if (loginToken) {
          const row = await db.verificationToken.findUnique({
            where: { token: loginToken },
            select: {
              email: true,
              token: true,
              expiresAt: true,
            },
          });

          const validToken =
            !!row &&
            String(row.email || '').trim().toLowerCase() === email &&
            String(row.token || '').startsWith('login-link-') &&
            new Date(row.expiresAt).getTime() > Date.now();

          if (!validToken) {
            return null;
          }

          await db.verificationToken
            .delete({ where: { token: loginToken } })
            .catch(() => null);

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            estado: userStatus,
            rememberMe,
          };
        }

        if (!password) {
          return null;
        }

        const passwordCandidates = getPasswordCandidates(password);
        let passwordMatch = false;

        for (const candidate of passwordCandidates) {
          if (await bcrypt.compare(candidate, user.password)) {
            passwordMatch = true;
            break;
          }
        }

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          estado: userStatus,
          rememberMe,
        };
      },
    }),
  ],
  pages: {
    signIn: '/auth/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.estado = (user as any).estado;
        token.rememberMe = Boolean((user as any).rememberMe);
        token.email = String((user as any).email || token.email || '').trim().toLowerCase();
        // Registrar último login (fire-and-forget, no bloquea la autenticación)
        if (user.id) {
          db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
        }
      }

      const role = String(token.role || '').trim().toUpperCase();
      if (role === 'SUPERADMIN') {
        // God mode — always active, no billing checks
        token.subscriptionActive = true;
        token.subscriptionReason = 'superadmin';
        token.subscriptionEndDate = null;
      } else if (role === 'ADMIN') {
        try {
          await refreshAdminSubscriptionClaims(token as Record<string, unknown>, Boolean(user));
        } catch (err) {
          if (err instanceof ForceSignOutError) {
            throw err;
          }
          if (typeof token.subscriptionActive !== 'boolean') {
            token.subscriptionActive = true;
            token.subscriptionReason = 'db-error';
          }
        }
      } else if (role === 'CLIENTE') {
        try {
          await refreshClienteBillingClaims(token as Record<string, unknown>, Boolean(user));
        } catch (err) {
          if (err instanceof ForceSignOutError) {
            throw err; // Invalidates session immediately
          }
          // Keep auth resilient for other billing errors
          if (typeof token.subscriptionActive !== 'boolean') {
            token.subscriptionActive = true;
            token.subscriptionReason = 'no-meta';
          }
        }
      } else {
        token.subscriptionActive = true;
        token.subscriptionReason = 'active';
        token.subscriptionEndDate = null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).estado = token.estado as string;
        (session.user as any).subscriptionActive = Boolean(token.subscriptionActive !== false);
        (session.user as any).subscriptionReason = String(token.subscriptionReason || 'active');
        (session.user as any).subscriptionEndDate = token.subscriptionEndDate
          ? String(token.subscriptionEndDate)
          : null;
        (session.user as any).subscriptionPlan = token.subscriptionPlan ? String(token.subscriptionPlan) : null;
        (session.user as any).maxAlumnos = token.maxAlumnos != null ? Number(token.maxAlumnos) : null;
        (session.user as any).maxPlanes = token.maxPlanes != null ? Number(token.maxPlanes) : null;
      }
      return session;
    },
  },
  jwt: {
    async encode(params) {
      const rememberMe = Boolean((params.token as any)?.rememberMe);
      const maxAge = rememberMe ? REMEMBERED_SESSION_MAX_AGE : SHORT_SESSION_MAX_AGE;
      return jwtEncode({ ...params, maxAge });
    },
    async decode(params) {
      return jwtDecode(params);
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: REMEMBERED_SESSION_MAX_AGE,
  },
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
