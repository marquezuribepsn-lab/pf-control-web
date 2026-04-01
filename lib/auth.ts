import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

const db = prisma as any;

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
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : null;
        const password = typeof credentials?.password === 'string' ? credentials.password : null;
        const loginToken =
          typeof credentials?.loginToken === 'string' ? credentials.loginToken.trim() : null;

        if (!email) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user || !user.emailVerified) {
          return null;
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
          };
        }

        if (!password) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          password,
          user.password
        );

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
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
