const baseUrl = process.env.SMOKE_BASE_URL || 'https://pf-control.com';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';
const clientEmail = process.env.SMOKE_CLIENT_EMAIL || 'marquezuribepsn+client-smoke@gmail.com';
const clientPasswordEnv = process.env.SMOKE_CLIENT_PASSWORD || '';
const loops = Number(process.env.SMOKE_STRESS_LOOPS || 2);

function splitSetCookie(raw) {
  return raw ? String(raw).split(/,(?=\s*[^;,\s]+=)/g) : [];
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
    return { ok: false, status: csrfResponse.status, reason: 'csrf_failed', cookieHeader: '' };
  }

  const csrfData = await csrfResponse.json();
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

async function adminResolveClientPassword(adminCookieHeader, email) {
  const reset = await fetch(`${baseUrl}/api/admin/users/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookieHeader,
    },
    body: JSON.stringify({ action: 'reset', email }),
  });

  const resetData = await reset.json().catch(() => ({}));
  const viewToken = String(resetData?.viewToken || '');

  if (!viewToken) {
    return { ok: false, reason: 'reset_without_view_token', resetStatus: reset.status };
  }

  const show = await fetch(`${baseUrl}/api/admin/users/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookieHeader,
    },
    body: JSON.stringify({ action: 'show', email, viewToken }),
  });

  const showData = await show.json().catch(() => ({}));
  const password = String(showData?.password || '');

  if (!password) {
    return { ok: false, reason: 'show_without_password', showStatus: show.status };
  }

  return { ok: true, password };
}

async function probe(label, routes, cookieHeader, loops = 3) {
  const stats = [];
  const failures = [];

  for (const route of routes) {
    const times = [];
    let passCount = 0;

    for (let i = 0; i < loops; i += 1) {
      const start = Date.now();
      const response = await fetch(`${baseUrl}${route.path}`, {
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
        redirect: 'manual',
      });
      const elapsedMs = Date.now() - start;
      const location = response.headers.get('location') || '';

      times.push(elapsedMs);

      if (route.expect(response.status, location)) {
        passCount += 1;
      }
    }

    const avgMs = Math.round(times.reduce((acc, n) => acc + n, 0) / times.length);
    const maxMs = Math.max(...times);

    stats.push({
      path: route.path,
      successRate: `${passCount}/${loops}`,
      avgMs,
      maxMs,
    });

    if (passCount < loops) {
      failures.push({ path: route.path, successRate: `${passCount}/${loops}` });
    }
  }

  return { label, loops, stats, failures };
}

async function main() {
  const adminLogin = await loginByCredentials(adminEmail, adminPassword);
  if (!adminLogin.ok) {
    throw new Error(`admin_login_failed status=${adminLogin.status} location=${adminLogin.location}`);
  }

  let clientPassword = clientPasswordEnv;
  if (!clientPassword) {
    const resolved = await adminResolveClientPassword(adminLogin.cookieHeader, clientEmail);
    if (!resolved.ok) {
      throw new Error(`client_password_resolution_failed reason=${resolved.reason}`);
    }
    clientPassword = resolved.password;
  }

  const clientLogin = await loginByCredentials(clientEmail, clientPassword);
  if (!clientLogin.ok) {
    throw new Error(`client_login_failed status=${clientLogin.status} location=${clientLogin.location}`);
  }

  const guestRoutes = [
    { path: '/auth/login', expect: (status) => status === 200 },
    { path: '/auth/forgot-password', expect: (status) => status === 200 },
    { path: '/auth/reset-password', expect: (status) => status === 200 },
    { path: '/auth/register', expect: (status) => status === 200 },
    { path: '/auth/verify', expect: (status) => status === 200 },
    { path: '/api/admin/users', expect: (status) => status === 401 },
  ];

  const adminRoutes = [
    { path: '/', expect: (status) => status === 200 },
    { path: '/admin/colaboradores', expect: (status) => status === 200 },
    { path: '/admin/musica', expect: (status) => status === 200 },
    { path: '/clientes', expect: (status) => status === 200 },
    { path: '/clientes/playlists', expect: (status) => status === 200 },
    { path: '/alumnos', expect: (status) => status === 200 },
    { path: '/registros', expect: (status) => status === 200 },
    { path: '/categorias', expect: (status) => status === 200 },
    { path: '/categorias/Nutricion', expect: (status) => status === 200 },
    { path: '/admin/whatsapp', expect: (status) => status === 200 },
    { path: '/admin/usuarios', expect: (status, location) => [302, 307, 308].includes(status) && /\/clientes/.test(location) },
    { path: '/sesiones', expect: (status) => status === 200 },
    { path: '/ejercicios', expect: (status) => status === 200 },
    { path: '/plantel', expect: (status) => status === 200 },
    { path: '/nueva-jugadora', expect: (status) => status === 200 },
    { path: '/nueva-sesion', expect: (status) => status === 200 },
    { path: '/nuevo-wellness', expect: (status) => status === 200 },
    { path: '/registro-alumno', expect: (status) => status === 200 },
    { path: '/cuenta', expect: (status) => status === 200 },
    { path: '/configuracion', expect: (status) => status === 200 },
    { path: '/asistencias', expect: (status) => status === 200 },
    { path: '/deportes', expect: (status) => status === 200 },
    { path: '/equipos', expect: (status) => status === 200 },
    { path: '/jugadoras', expect: (status) => status === 200 },
    { path: '/semana', expect: (status) => status === 200 },
    { path: '/wellness', expect: (status) => status === 200 },
    { path: '/api/account', expect: (status) => status === 200 },
    { path: '/api/admin/ingresantes', expect: (status) => status === 200 },
    { path: '/api/admin/whatsapp-history', expect: (status) => status === 200 },
    { path: '/api/admin/whatsapp-automation-runs', expect: (status) => status === 200 },
    { path: '/api/whatsapp/config', expect: (status) => status === 200 },
    { path: '/api/whatsapp/schedule', expect: (status) => status === 200 },
    { path: '/api/whatsapp/templates', expect: (status) => status === 200 },
  ];

  const clientRoutes = [
    { path: '/', expect: (status, location) => [302, 307, 308].includes(status) && /\/alumno\/inicio/.test(location) },
    { path: '/alumno/inicio', expect: (status) => status === 200 },
    { path: '/alumno/rutina', expect: (status) => status === 200 },
    { path: '/alumno/nutricion', expect: (status) => status === 200 },
    { path: '/alumno/medidas', expect: (status) => status === 200 },
    { path: '/alumno/progreso', expect: (status) => status === 200 },
    { path: '/alumno/ejercicio', expect: (status) => status === 200 },
    { path: '/cuenta', expect: (status) => status === 200 },
    { path: '/categorias', expect: (status, location) => [302, 307, 308].includes(status) && /\/alumno\/inicio/.test(location) },
    { path: '/admin/whatsapp', expect: (status, location) => [302, 307, 308].includes(status) && /\/auth\/login/.test(location) },
    { path: '/api/admin/users', expect: (status) => status === 401 },
  ];

  const guest = await probe('guest', guestRoutes, '', loops);
  const admin = await probe('admin', adminRoutes, adminLogin.cookieHeader, loops);
  const client = await probe('client', clientRoutes, clientLogin.cookieHeader, loops);

  const failures = [...guest.failures, ...admin.failures, ...client.failures];

  const output = {
    ok: failures.length === 0,
    baseUrl,
    guest,
    admin,
    client,
    totalFailures: failures.length,
    failures,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error), baseUrl }, null, 2));
  process.exit(1);
});
