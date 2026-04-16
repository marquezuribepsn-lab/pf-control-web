import { DefaultSession } from 'next-auth';
import { UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: UserRole;
      estado?: string;
    };
  }

  interface User {
    id: string;
    role: UserRole;
    estado?: string;
    rememberMe?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    estado?: string;
    rememberMe?: boolean;
  }
}

export {};