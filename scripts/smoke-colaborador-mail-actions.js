const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'https://pf-control.com';
const smokeMailboxBase = process.env.SMOKE_MAILBOX_BASE || 'marquezuribepsn@gmail.com';
const mainEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const mainPassword = process.env.SMOKE_MAIN_PASSWORD || '';

function makeAlias(prefix) {
  const [user, domain] = String(smokeMailboxBase).split('@');
  return `${user}+${prefix}${Date.now()}@${domain}`;
}

function toCookieHeader(setCookieValue) {
  const raw = Array.isArray(setCookieValue)
    ? setCookieValue
    : setCookieValue
    ? [setCookieValue]
    : [];

  const chunks = raw.flatMap((entry) => String(entry || '').split(/,(?=\s*[^;,\s]+=)/g));
  const pairs = chunks
    .map((chunk) => chunk.split(';')[0]?.trim())
    .filter(Boolean);

  return [...new Set(pairs)].join('; ');
}

function getSetCookieHeaderValues(headers) {
  if (headers?.getSetCookie && typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
  }

  const single = headers?.get?.('set-cookie');
  return single ? [single] : [];
}

async function validateAdminSession(cookieHeader) {
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const userRole = payload?.user?.role;
  if (response.status !== 200 || userRole !== 'ADMIN') {
    throw new Error(`sesion admin invalida: status=${response.status}, role=${String(userRole || '')}`);
  }
}

async function loginAndGetCookie() {
  if (!mainPassword) {
    throw new Error('SMOKE_MAIN_PASSWORD requerido para smoke-colaborador-mail-actions.');
  }

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo: ${csrfResponse.status}`);
  }

  const csrfData = await csrfResponse.json();
  const csrfToken = csrfData?.csrfToken;
  if (!csrfToken) {
    throw new Error('csrf token ausente');
  }

  const csrfCookie = toCookieHeader(getSetCookieHeaderValues(csrfResponse.headers));

  const form = new URLSearchParams({
    email: mainEmail,
    password: mainPassword,
    csrfToken,
    callbackUrl: `${baseUrl}/`,
    json: 'true',
  });

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookie,
    },
    body: form.toString(),
    redirect: 'manual',
  });

  const location = loginResponse.headers.get('location') || '';
  if (loginResponse.status !== 302 || /error=/i.test(location)) {
    throw new Error(`login admin invalido: status=${loginResponse.status}, location=${location}`);
  }

  const loginCookie = toCookieHeader(getSetCookieHeaderValues(loginResponse.headers));
  const cookieHeader = [csrfCookie, loginCookie].filter(Boolean).join('; ');
  await validateAdminSession(cookieHeader);
  return cookieHeader;
}

async function postJson(url, body, cookieHeader) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  return {
    status: response.status,
    data,
  };
}

async function deleteJson(url, cookieHeader) {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  return {
    status: response.status,
    data,
  };
}

async function main() {
  const adminCookie = await loginAndGetCookie();
  const email = makeAlias('colabmail');

  const create = await postJson(`${baseUrl}/api/admin/colaboradores`, {
    email,
    nombreCompleto: 'Colaborador Smoke Mail Actions',
    edad: 31,
    fechaNacimiento: '1994-06-11',
    altura: 179,
    telefono: '',
    direccion: '',
    puedeEditarRegistros: true,
    puedeEditarPlanes: false,
    puedeVerTodosAlumnos: false,
    asignaciones: [],
  }, adminCookie);

  const colaboradorId = create.data?.colaborador?.id;
  const alta = colaboradorId
    ? await postJson(`${baseUrl}/api/admin/colaboradores/${colaboradorId}/alta`, {}, adminCookie)
    : { status: 0, data: { error: 'Sin colaboradorId' } };

  const baja = colaboradorId
    ? await deleteJson(`${baseUrl}/api/admin/colaboradores/${colaboradorId}`, adminCookie)
    : { status: 0, data: { error: 'Sin colaboradorId' } };

  const checks = [
    {
      name: 'createColaborador',
      pass: create.status === 200 && Boolean(colaboradorId),
      detail: create,
    },
    {
      name: 'altaColaborador',
      pass: alta.status === 200 && Boolean(alta.data?.success),
      detail: alta,
    },
    {
      name: 'bajaColaborador',
      pass: baja.status === 200 && Boolean(baja.data?.success),
      detail: baja,
    },
  ];

  const failedChecks = checks.filter((item) => !item.pass).map((item) => item.name);

  const output = {
    ok: failedChecks.length === 0,
    failedChecks,
    checks,
    email,
    colaboradorId: colaboradorId || null,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
