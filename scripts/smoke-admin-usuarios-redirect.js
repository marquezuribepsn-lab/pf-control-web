const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const prisma = new PrismaClient();

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';

function splitSetCookie(raw) {
  if (!raw) return [];
  return String(raw).split(/,(?=\s*[^;,\s]+=)/g);
}

function getSetCookieValues(headers) {
  if (headers && typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) return values;
  }

  const single = headers?.get?.('set-cookie');
  return single ? splitSetCookie(single) : [];
}

function toCookieHeader(setCookieValues) {
  return (Array.isArray(setCookieValues) ? setCookieValues : [])
    .map((entry) => String(entry || '').split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

async function loginByCredentials(email, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo (${csrfResponse.status})`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error('csrf token ausente');
  }

  const csrfCookies = getSetCookieValues(csrfResponse.headers);

  const body = new URLSearchParams({
    email,
    password,
    csrfToken: csrfData.csrfToken,
    callbackUrl: `${baseUrl}/`,
    json: 'true',
  }).toString();

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: toCookieHeader(csrfCookies),
    },
    body,
    redirect: 'manual',
  });

  const location = loginResponse.headers.get('location') || '';
  const loginCookies = getSetCookieValues(loginResponse.headers);

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(location),
    status: loginResponse.status,
    location,
    cookieHeader: toCookieHeader([...csrfCookies, ...loginCookies]),
  };
}

async function loginByMagicLink(email) {
  const requestResponse = await fetch(`${baseUrl}/api/auth/login-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!requestResponse.ok) {
    return {
      ok: false,
      status: requestResponse.status,
      location: 'magic-link-request-failed',
      cookieHeader: '',
    };
  }

  const latestToken = await prisma.verificationToken.findFirst({
    where: {
      email,
      token: {
        startsWith: 'login-link-',
      },
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      expiresAt: 'desc',
    },
    select: {
      token: true,
    },
  });

  if (!latestToken?.token) {
    return {
      ok: false,
      status: 500,
      location: 'magic-token-not-found',
      cookieHeader: '',
    };
  }

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    return {
      ok: false,
      status: csrfResponse.status,
      location: 'csrf-failed',
      cookieHeader: '',
    };
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    return {
      ok: false,
      status: 500,
      location: 'csrf-token-missing',
      cookieHeader: '',
    };
  }

  const csrfCookies = getSetCookieValues(csrfResponse.headers);
  const body = new URLSearchParams({
    email,
    loginToken: latestToken.token,
    csrfToken: csrfData.csrfToken,
    callbackUrl: `${baseUrl}/`,
    json: 'true',
  }).toString();

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: toCookieHeader(csrfCookies),
    },
    body,
    redirect: 'manual',
  });

  const location = loginResponse.headers.get('location') || '';
  const loginCookies = getSetCookieValues(loginResponse.headers);

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(location),
    status: loginResponse.status,
    location,
    cookieHeader: toCookieHeader([...csrfCookies, ...loginCookies]),
  };
}

async function main() {
  let login = await loginByCredentials(adminEmail, adminPassword);
  if (!login.ok) {
    login = await loginByMagicLink(adminEmail);
  }

  if (!login.ok) {
    throw new Error(`admin login fallo: status=${login.status} location=${login.location}`);
  }

  const response = await fetch(`${baseUrl}/admin/usuarios`, {
    headers: {
      Cookie: login.cookieHeader,
    },
    redirect: 'manual',
  });

  const body = await response.text();
  const location = response.headers.get('location') || '';
  const pass = response.status === 200 && /usuarios y permisos|permisos de colaboradores|colaboradores/i.test(body);

  const output = {
    ok: pass,
    baseUrl,
    checks: {
      status: response.status,
      location,
      bodyHasPermissionCopy: /usuarios y permisos|permisos de colaboradores|colaboradores/i.test(body),
      expected: 'pagina disponible para administrar permisos',
    },
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
