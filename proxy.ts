import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

const CLIENTE_ALLOWED_PREFIXES = ['/alumnos', '/cuenta'];

function normalizePath(pathname: string): string {
  if (pathname !== '/' && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function createLoginRedirect(req: NextRequest): NextResponse {
  const loginUrl = new URL('/auth/login', req.url);
  const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;

  if (callbackUrl) {
    loginUrl.searchParams.set('callbackUrl', callbackUrl);
  }

  return NextResponse.redirect(loginUrl);
}

function canClienteAccess(pathname: string): boolean {
  const normalized = normalizePath(pathname);

  if (normalized === '/') {
    return true;
  }

  return CLIENTE_ALLOWED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export default auth((req) => {
  const session = req.auth;
  const pathname = normalizePath(req.nextUrl.pathname);

  if (!session?.user?.id) {
    return createLoginRedirect(req);
  }

  const role = String((session.user as { role?: string | null } | undefined)?.role || '')
    .trim()
    .toUpperCase();

  if (!role) {
    return createLoginRedirect(req);
  }

  if (role === 'ADMIN') {
    return NextResponse.next();
  }

  if (role === 'CLIENTE') {
    if (!canClienteAccess(pathname)) {
      return NextResponse.redirect(new URL('/alumnos', req.url));
    }

    // Keep a dedicated alumno home even when callbackUrl points to '/'.
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/alumnos', req.url));
    }

    return NextResponse.next();
  }

  // Non-admin roles cannot access admin pages.
  if (pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|auth).*)',
  ],
};
