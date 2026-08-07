import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { rateLimit, getIP } from '@/lib/rateLimit';

const CLIENTE_ALLOWED_PREFIXES = ['/alumnos', '/cuenta'];
const CLIENTE_PAYMENT_ALLOWED_PREFIXES = ['/alumnos/pagos', '/cuenta'];

/**
 * Rutas que puede ver un COLABORADOR. Todo lo que no este aca queda bajo ADMIN.
 *
 * Antes era al reves: el colaborador entraba a todo salvo /admin y /superadmin.
 * El diseno v2 define tres secciones de menu y deja el grupo "GRUPOS"
 * (Nutricion, Pagos, Musica, WhatsApp, Mensajes, Equipos y Deportes, Usuarios)
 * como gestion de administrador, junto con las pantallas que quedaron fuera del
 * menu. Con lista negra habria que acordarse de sumar cada pantalla nueva; con
 * lista blanca, lo que se olvide queda cerrado en vez de abierto.
 *
 * Corresponde a las secciones MENU y secundaria del handoff.
 */
const COLABORADOR_ALLOWED_PREFIXES = [
  '/clientes',
  '/semana',
  '/asistencias',
  '/alertas',
  '/configuracion',
  '/calendario',
  '/categorias',
  '/cuenta',
];

/**
 * Sub-rutas que cuelgan de un prefijo permitido pero NO son del colaborador.
 * Sin estas excepciones el prefijo padre las dejaria pasar:
 *   - /categorias/nutricion  -> Nutricion es de GRUPOS (admin)
 *   - /clientes/musica       -> Musica es de GRUPOS (admin)
 *   - /clientes/plan         -> quedo fuera del menu del handoff (admin)
 */
const COLABORADOR_DENIED_PREFIXES = [
  '/categorias/nutricion',
  '/clientes/musica',
  '/clientes/plan',
];

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

function canColaboradorAccess(pathname: string): boolean {
  const normalized = normalizePath(pathname).toLowerCase();

  if (normalized === '/') {
    return true;
  }

  if (
    COLABORADOR_DENIED_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    )
  ) {
    return false;
  }

  return COLABORADOR_ALLOWED_PREFIXES.some(
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

  // ── Rutas públicas — nunca requieren sesión ──
  // Sin este bloque, un usuario sin sesión que visite /auth/login
  // queda atrapado en un loop infinito de callbackUrls anidadas.
  if (rawPath.startsWith('/auth/')) {
    return NextResponse.next();
  }

  // Páginas legales públicas — accesibles sin sesión (la App Store exige
  // que la política de privacidad sea alcanzable estando deslogueado).
  if (rawPath === '/privacidad' || rawPath.startsWith('/privacidad/')) {
    return NextResponse.next();
  }

  // Mesa de diseño del alumno — pública, solo datos de ejemplo (sin sesión ni
  // datos reales). Permite iterar el diseño de los paneles sin necesidad de
  // iniciar sesión; no expone nada sensible.
  if (rawPath === '/alumnos/diseno' || rawPath.startsWith('/alumnos/diseno/')) {
    return NextResponse.next();
  }

  // Mesa de diseño del panel de admin. Misma idea que la del alumno, pero SOLO
  // en desarrollo: aunque no muestra datos reales, no hay motivo para publicar
  // la estructura del panel en el VPS. En produccion cae al flujo normal (login).
  if (
    process.env.NODE_ENV !== 'production' &&
    (rawPath === '/admin/diseno' || rawPath.startsWith('/admin/diseno/'))
  ) {
    return NextResponse.next();
  }

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
        // Incluir ?pay=1 para que AlumnoPagosClient no redirija de vuelta a /alumnos/inicio
        // (lo que generaría un loop: middleware→pagos, client→inicio, middleware→pagos…)
        return NextResponse.redirect(new URL('/alumnos/pagos?pay=1', req.url));
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

  // Resto de roles (COLABORADOR / PROFESOR): lista blanca. Lo que no figure
  // queda del lado de ADMIN. Esconder el link del menu no alcanza como control
  // de acceso: sin esto se entra escribiendo la URL.
  if (!canColaboradorAccess(pathname)) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.json|robots\\.txt|sitemap\\.xml).*)',
  ],
};
