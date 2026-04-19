import { DefaultSession } from 'next-auth';
import { UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: UserRole;
      estado?: string;
      subscriptionActive?: boolean;
      subscriptionReason?: string;
      subscriptionEndDate?: string | null;
    };
  }

  interface User {
    id: string;
    role: UserRole;
    estado?: string;
    rememberMe?: boolean;
    subscriptionActive?: boolean;
    subscriptionReason?: string;
    subscriptionEndDate?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    estado?: string;
    rememberMe?: boolean;
    subscriptionActive?: boolean;
    subscriptionReason?: string;
    subscriptionEndDate?: string | null;
    subscriptionCheckedAt?: number;
  }
}

export {};