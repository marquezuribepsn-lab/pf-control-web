import NextAuth, { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { decode as jwtDecode, encode as jwtEncode } from 'next-auth/jwt';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { resolveBillingAccessByEmail } from './billing';

const db = prisma as any;
const REMEMBERED_SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const SHORT_SESSION_MAX_AGE = 24 * 60 * 60;
const BILLING_REFRESH_WINDOW_MS = 5 * 1000;

type AuthUserRecord = {
  id: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'COLABORADOR' | 'CLIENTE';
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

  const access = await resolveBillingAccessByEmail(email);
  token.subscriptionActive = access.active;
  token.subscriptionReason = access.reason;
  token.subscriptionEndDate = access.meta?.endDate ? String(access.meta.endDate) : null;
  token.subscriptionCheckedAt = now;
}

export const authConfig = {
  trustHost: true,
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
      }

      const role = String(token.role || '').trim().toUpperCase();
      if (role === 'CLIENTE') {
        try {
          await refreshClienteBillingClaims(token as Record<string, unknown>, Boolean(user));
        } catch {
          // Keep auth resilient if billing state cannot be resolved.
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
