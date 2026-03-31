import { DefaultSession } from 'next-auth';
import { UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: UserRole;
      name?: string | null;
      sidebarImage?: string | null;
    };
  }

  interface User {
    id: string;
    role: UserRole;
    name?: string | null;
    sidebarImage?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    name?: string | null;
    sidebarImage?: string | null;
  }
}

export {};