import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { decode as jwtDecode, encode as jwtEncode } from 'next-auth/jwt';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

const db = prisma as any;
const REMEMBERED_SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const SHORT_SESSION_MAX_AGE = 24 * 60 * 60;

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
        const rememberMe =
          credentials?.rememberMe === true ||
          credentials?.rememberMe === 'true' ||
          credentials?.rememberMe === '1' ||
          credentials?.rememberMe === 'on';

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
            rememberMe,
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
        token.rememberMe = Boolean((user as any).rememberMe);
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
