import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

export default auth((req) => {
  const session = req.auth;
  const pathname = req.nextUrl.pathname;
  const role = (session?.user as any)?.role;

  if (pathname === '/admin/usuarios') {
    return NextResponse.redirect(new URL('/clientes', req.url));
  }

  if (pathname.startsWith('/admin')) {
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }
  }

  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  if (role === 'CLIENTE') {
    const allowedExact = new Set(['/alumno/inicio', '/alumno/rutina', '/alumno/nutricion', '/alumno/medidas', '/alumno/progreso', '/alumno/ejercicio', '/cuenta']);
    const isAlumnoSection = pathname.startsWith('/alumno');

    if (pathname === '/') {
      return NextResponse.redirect(new URL('/alumno/inicio', req.url));
    }

    if (!isAlumnoSection && !allowedExact.has(pathname)) {
      return NextResponse.redirect(new URL('/alumno/inicio', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|auth|.*\\..*).*)',
  ],
};
