import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { rateLimit, getIP } from '@/lib/rateLimit';

const CLIENTE_ALLOWED_PREFIXES = ['/alumnos', '/cuenta'];
const CLIENTE_PAYMENT_ALLOWED_PREFIXES = ['/alumnos/pagos', '/cuenta'];

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

function canClienteAccessWhilePaymentPending(pathname: string): boolean {
  const normalized = normalizePath(pathname);

  if (normalized === '/') {
    return false;
  }

  return CLIENTE_PAYMENT_ALLOWED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export default auth((req) => {
  const { pathname: rawPath } = req.nextUrl;
  const ip = getIP(req);

  // ── Rate limiting en rutas API (antes de cualquier lógica de sesión) ──
  if (rawPath.startsWith('/api/auth/')) {
    if (!rateLimit(ip, 'api-auth', { max: 30, windowMs: 60_000 })) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429, headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }
  if (rawPath.startsWith('/api/superadmin/')) {
    if (!rateLimit(ip, 'superadmin-api', { max: 120, windowMs: 60_000 })) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429, headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }
  if (rawPath.startsWith('/api/')) {
    if (!rateLimit(ip, 'api-global', { max: 200, windowMs: 60_000 })) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429, headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }

  const session = req.auth;
  const pathname = normalizePath(rawPath);

  if (!session?.user?.id) {
    return createLoginRedirect(req);
  }

  const role = String((session.user as { role?: string | null } | undefined)?.role || '')
    .trim()
    .toUpperCase();

  if (!role) {
    return createLoginRedirect(req);
  }

  if (role === 'SUPERADMIN') {
    // SUPERADMIN solo puede estar en /superadmin — todo lo demás redirige ahí
    if (!pathname.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL('/superadmin', req.url));
    }
    return NextResponse.next();
  }

  if (role === 'ADMIN') {
    // Block suspended/expired admins
    if (pathname.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }
    const subscriptionActive =
      (session.user as { subscriptionActive?: boolean | null } | undefined)?.subscriptionActive !== false;
    if (!subscriptionActive && !pathname.startsWith('/suscripcion-suspendida') && !pathname.startsWith('/cuenta')) {
      return NextResponse.redirect(new URL('/suscripcion-suspendida', req.url));
    }
    return NextResponse.next();
  }

  if (role === 'CLIENTE') {
    const subscriptionActive =
      (session.user as { subscriptionActive?: boolean | null } | undefined)?.subscriptionActive !==
      false;

    if (!subscriptionActive) {
      if (!canClienteAccessWhilePaymentPending(pathname)) {
        return NextResponse.redirect(new URL('/alumnos/pagos', req.url));
      }

      return NextResponse.next();
    }

    if (!canClienteAccess(pathname)) {
      return NextResponse.redirect(new URL('/alumnos', req.url));
    }

    // Keep a dedicated alumno home even when callbackUrl points to '/'.
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/alumnos', req.url));
    }

    return NextResponse.next();
  }

  // Non-superadmin roles cannot access superadmin pages.
  if (pathname.startsWith('/superadmin')) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  // Non-admin roles cannot access admin pages.
  if (pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
