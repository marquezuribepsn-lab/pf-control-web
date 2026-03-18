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
        rememberMe: { label: 'Remember me', type: 'checkbox' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : null;
        const password = typeof credentials?.password === 'string' ? credentials.password : null;

        if (!email || !password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user || !user.emailVerified) {
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
