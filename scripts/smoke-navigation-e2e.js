const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
require('dotenv').config({ path: path.resolve(__dirname, '../.db.env') });

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'https://pf-control.com';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';
const clientEmail = process.env.SMOKE_CLIENT_EMAIL || 'marquezuribepsn+client-smoke@gmail.com';
const clientPassword = process.env.SMOKE_CLIENT_PASSWORD || 'pfcontrol2026';

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
  const cookieHeader = toCookieHeader([...csrfCookies, ...loginCookies]);

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(location),
    status: loginResponse.status,
    location,
    cookieHeader,
  };
}

async function checkPath(pathname, cookieHeader) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    redirect: 'manual',
  });

  return {
    path: pathname,
    status: response.status,
    location: response.headers.get('location') || null,
  };
}

function assertCheck(name, pass, detail) {
  return { name, pass, detail };
}

function assertSkipped(name, detail) {
  return { name, pass: true, skipped: true, detail };
}

async function callAdminJson(pathname, cookieHeader, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body || {}),
  });

  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function resolveClientCredentials(adminCookieHeader) {
  const normalizedEmail = String(clientEmail || '').trim().toLowerCase();
  const normalizedPassword = String(clientPassword || '');

  if (normalizedEmail && normalizedPassword) {
    const directLogin = await loginByCredentials(normalizedEmail, normalizedPassword);
    if (directLogin.ok) {
      return {
        ok: true,
        source: 'env',
        email: normalizedEmail,
        password: normalizedPassword,
        login: directLogin,
      };
    }
  }

  if (!normalizedEmail) {
    return {
      ok: false,
      reason: 'SMOKE_CLIENT_EMAIL no configurado',
    };
  }

  const reset = await callAdminJson('/api/admin/users/password', adminCookieHeader, {
    action: 'reset',
    email: normalizedEmail,
  });

  if (!reset.ok) {
    return {
      ok: false,
      reason: 'No se pudo resetear password de cliente smoke',
      reset,
    };
  }

  const viewToken = String(reset.data?.viewToken || '').trim();
  if (!viewToken) {
    return {
      ok: false,
      reason: 'Reset de cliente smoke sin viewToken',
      reset,
    };
  }

  const show = await callAdminJson('/api/admin/users/password', adminCookieHeader, {
    action: 'show',
    email: normalizedEmail,
    viewToken,
  });

  const resolvedPassword = String(show.data?.password || '');
  const resolvedEmail = String(show.data?.user?.email || normalizedEmail).trim().toLowerCase();

  if (!show.ok || !resolvedPassword) {
    return {
      ok: false,
      reason: 'No se pudo obtener password visible de cliente smoke',
      reset,
      show,
    };
  }

  const login = await loginByCredentials(resolvedEmail, resolvedPassword);
  if (!login.ok) {
    return {
      ok: false,
      reason: 'Cliente smoke no pudo iniciar sesion con password reseteada',
      reset,
      show,
      login,
    };
  }

  return {
    ok: true,
    source: 'admin-reset',
    email: resolvedEmail,
    password: resolvedPassword,
    login,
  };
}

async function main() {
  const checks = [];

  const guestLogin = await checkPath('/auth/login', '');
  const guestForgot = await checkPath('/auth/forgot-password', '');
  const guestReset = await checkPath('/auth/reset-password', '');

  checks.push(assertCheck('guestAuthLoginPage', guestLogin.status === 200, guestLogin));
  checks.push(assertCheck('guestForgotPage', guestForgot.status === 200, guestForgot));
  checks.push(assertCheck('guestResetPage', guestReset.status === 200, guestReset));

  const adminLogin = await loginByCredentials(adminEmail, adminPassword);
  checks.push(assertCheck('adminLogin', adminLogin.ok, adminLogin));

  const adminTargets = ['/', '/categorias', '/categorias/Nutricion', '/admin/whatsapp', '/sesiones', '/clientes', '/cuenta'];
  for (const target of adminTargets) {
    const result = await checkPath(target, adminLogin.cookieHeader);
    const pass = result.status === 200;
    checks.push(assertCheck(`adminPath:${target}`, pass, result));
  }

  const clientCredentials = await resolveClientCredentials(adminLogin.cookieHeader);
  if (!clientCredentials.ok) {
    checks.push(assertSkipped('clientChecksSkipped', clientCredentials));
  } else {
    const clientLogin = clientCredentials.login;
    checks.push(assertCheck('clientLogin', clientLogin.ok, { ...clientLogin, source: clientCredentials.source, email: clientCredentials.email }));

    const clientHome = await checkPath('/', clientLogin.cookieHeader);
    checks.push(
      assertCheck(
        'clientRootRedirectsToAlumnoInicio',
        [302, 307, 308].includes(clientHome.status) && /\/alumno\/inicio/.test(String(clientHome.location || '')),
        clientHome
      )
    );

    const clientAllowed = ['/alumno/inicio', '/alumno/rutina', '/alumno/nutricion', '/alumno/medidas', '/alumno/progreso', '/alumno/ejercicio', '/cuenta'];
    for (const target of clientAllowed) {
      const result = await checkPath(target, clientLogin.cookieHeader);
      checks.push(assertCheck(`clientAllowed:${target}`, result.status === 200, result));
    }

    const clientBlockedCategorias = await checkPath('/categorias', clientLogin.cookieHeader);
    checks.push(
      assertCheck(
        'clientBlockedCategoriasRedirect',
        [302, 307, 308].includes(clientBlockedCategorias.status) && /\/alumno\/inicio/.test(String(clientBlockedCategorias.location || '')),
        clientBlockedCategorias
      )
    );

    const clientBlockedAdmin = await checkPath('/admin/whatsapp', clientLogin.cookieHeader);
    checks.push(
      assertCheck(
        'clientBlockedAdminRedirect',
        [302, 307, 308].includes(clientBlockedAdmin.status) && /\/auth\/login/.test(String(clientBlockedAdmin.location || '')),
        clientBlockedAdmin
      )
    );
  }

  const failed = checks.filter((item) => !item.pass);
  const skipped = checks.filter((item) => item.skipped).map((item) => item.name);

  const output = {
    ok: failed.length === 0,
    baseUrl,
    checks,
    skippedChecks: skipped,
    failedChecks: failed.map((item) => item.name),
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
  });
