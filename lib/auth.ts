import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { isProtectedAdminEmail } from './operationalUsers';

const db = prisma as any;

function normalizePasswordInput(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
}

function buildSessionName(user: {
  nombreCompleto?: string | null;
}): string {
  const nombreCompleto = String(user.nombreCompleto || '').trim();
  return nombreCompleto || 'Profe';
}

export const authConfig = {
  trustHost: true,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember me', type: 'checkbox' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : null;
        const password = typeof credentials?.password === 'string' ? credentials.password : null;
        const normalizedPassword = normalizePasswordInput(credentials?.password);

        if (!email || !password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user || !user.emailVerified || user.estado !== 'activo') {
          return null;
        }

        let passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch && normalizedPassword && normalizedPassword !== password) {
          passwordMatch = await bcrypt.compare(normalizedPassword, user.password);
        }

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: buildSessionName(user),
          role: isProtectedAdminEmail(user.email) ? 'ADMIN' : user.role,
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
        token.role = isProtectedAdminEmail((user as any).email)
          ? 'ADMIN'
          : (user as any).role;
      }

      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, nombreCompleto: true, email: true },
        });

        if (dbUser) {
          token.role = isProtectedAdminEmail(dbUser.email) ? 'ADMIN' : dbUser.role;
          token.name = buildSessionName(dbUser);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        session.user.name = typeof token.name === 'string' ? token.name : session.user.name;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
