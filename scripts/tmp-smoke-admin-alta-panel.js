const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.production') });

const prisma = new PrismaClient();
const baseUrl = 'http://127.0.0.1:3000';
const adminEmail = String(process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com').trim().toLowerCase();
const adminPassword = String(process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026');
const testEmail = `alta.panel+e2e${Date.now()}@example.com`;
const testName = `E2E Alta ${Date.now().toString().slice(-6)}`;
const SIGNUP_PROFILES_KEY = 'pf-control-signup-profiles-v1';
const ALUMNOS_KEY = 'pf-control-alumnos';
const CLIENTES_META_KEY = 'pf-control-clientes-meta-v1';

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

async function getAdminUserByEmail(email) {
  const exact = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (exact?.id && exact?.email) {
    return exact;
  }

  const rows = await prisma.$queryRaw`
    SELECT id, email
    FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;

  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0];
  }

  return null;
}

async function loginByCredentials(email, password) {
  if (!password) {
    return { ok: false, status: 400, location: 'missing-password', cookieHeader: '' };
  }

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

async function loginByOneTimeToken(email) {
  const user = await getAdminUserByEmail(email);
  if (!user?.id || !user?.email) {
    return { ok: false, status: 404, location: 'user-not-found', cookieHeader: '' };
  }

  const token = `login-link-smoke-${randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      email: user.email,
      token,
      expiresAt,
      userId: user.id,
    },
  });

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    return { ok: false, status: csrfResponse.status, location: 'csrf-failed', cookieHeader: '' };
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    return { ok: false, status: 500, location: 'csrf-token-missing', cookieHeader: '' };
  }

  const csrfCookies = getSetCookieValues(csrfResponse.headers);
  const body = new URLSearchParams({
    email: String(user.email).trim().toLowerCase(),
    loginToken: token,
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

async function getUsers(cookieHeader) {
  const response = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Cookie: cookieHeader },
    redirect: 'manual',
  });

  const data = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(data)) {
    throw new Error(`No se pudo listar usuarios admin (status=${response.status})`);
  }

  return data;
}

async function setEstadoActivo(cookieHeader, userId) {
  const response = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ userId, role: 'CLIENTE', estado: 'activo' }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`No se pudo activar cliente (status=${response.status}, message=${String(data?.message || '')})`);
  }

  return data;
}

async function upsertSignupProfile(email, payload) {
  const row = await prisma.syncEntry.findUnique({
    where: { key: SIGNUP_PROFILES_KEY },
    select: { value: true },
  });

  const map = row?.value && typeof row.value === 'object' ? { ...(row.value) } : {};
  map[email] = payload;

  await prisma.syncEntry.upsert({
    where: { key: SIGNUP_PROFILES_KEY },
    update: { value: map },
    create: { key: SIGNUP_PROFILES_KEY, value: map },
  });
}

async function removeSignupProfile(email) {
  const row = await prisma.syncEntry.findUnique({
    where: { key: SIGNUP_PROFILES_KEY },
    select: { value: true },
  });

  if (!row?.value || typeof row.value !== 'object') {
    return;
  }

  const map = { ...(row.value) };
  if (!(email in map)) {
    return;
  }

  delete map[email];

  await prisma.syncEntry.update({
    where: { key: SIGNUP_PROFILES_KEY },
    data: { value: map },
  });
}

async function removeSmokeAlumnoArtifacts(nombre, email) {
  const normalizedNombre = String(nombre || '').trim().toLowerCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const alumnosRow = await prisma.syncEntry.findUnique({
    where: { key: ALUMNOS_KEY },
    select: { value: true },
  });

  if (Array.isArray(alumnosRow?.value)) {
    const cleaned = alumnosRow.value.filter((item) => {
      const itemName = String(item?.nombre || '').trim().toLowerCase();
      return itemName !== normalizedNombre;
    });

    if (cleaned.length !== alumnosRow.value.length) {
      await prisma.syncEntry.upsert({
        where: { key: ALUMNOS_KEY },
        update: { value: cleaned },
        create: { key: ALUMNOS_KEY, value: cleaned },
      });
    }
  }

  const metaRow = await prisma.syncEntry.findUnique({
    where: { key: CLIENTES_META_KEY },
    select: { value: true },
  });

  if (metaRow?.value && typeof metaRow.value === 'object') {
    const map = { ...(metaRow.value) };
    let changed = false;

    for (const [key, value] of Object.entries(map)) {
      const rawName = String(key || '').replace(/^alumno:/i, '').trim().toLowerCase();
      const rawEmail =
        value && typeof value === 'object' ? String(value.email || '').trim().toLowerCase() : '';

      if (rawName === normalizedNombre || rawEmail === normalizedEmail) {
        delete map[key];
        changed = true;
      }
    }

    if (changed) {
      await prisma.syncEntry.upsert({
        where: { key: CLIENTES_META_KEY },
        update: { value: map },
        create: { key: CLIENTES_META_KEY, value: map },
      });
    }
  }
}

async function assertAltaSyncedIntoClientes(nombre, email) {
  const normalizedNombre = String(nombre || '').trim().toLowerCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const alumnosRow = await prisma.syncEntry.findUnique({
    where: { key: ALUMNOS_KEY },
    select: { value: true },
  });

  const alumnos = Array.isArray(alumnosRow?.value) ? alumnosRow.value : [];
  const alumnoSynced = alumnos.some((item) => {
    const itemNombre = String(item?.nombre || '').trim().toLowerCase();
    const itemEstado = String(item?.estado || '').trim().toLowerCase();
    return itemNombre === normalizedNombre && itemEstado === 'activo';
  });

  if (!alumnoSynced) {
    throw new Error('El alta no sincronizo al alumno en pf-control-alumnos');
  }

  const metaRow = await prisma.syncEntry.findUnique({
    where: { key: CLIENTES_META_KEY },
    select: { value: true },
  });

  const metaMap =
    metaRow?.value && typeof metaRow.value === 'object'
      ? metaRow.value
      : {};

  const metaSynced = Object.entries(metaMap).some(([key, value]) => {
    const keyNombre = String(key || '').replace(/^alumno:/i, '').trim().toLowerCase();
    const keyEmail =
      value && typeof value === 'object' ? String(value.email || '').trim().toLowerCase() : '';
    return keyNombre === normalizedNombre || keyEmail === normalizedEmail;
  });

  if (!metaSynced) {
    throw new Error('El alta no sincronizo metadatos en pf-control-clientes-meta-v1');
  }

  return {
    alumnoSynced,
    metaSynced,
  };
}

async function main() {
  let createdUserId = null;

  try {
    const randomPassword = randomBytes(18).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const created = await prisma.user.create({
      data: {
        email: testEmail,
        password: hashedPassword,
        role: 'CLIENTE',
        estado: 'pendiente_alta',
        emailVerified: true,
        nombreCompleto: testName,
        edad: 24,
        fechaNacimiento: new Date('2001-04-10T00:00:00.000Z'),
        altura: 170,
        telefono: '5491112345678',
      },
      select: { id: true, email: true, estado: true },
    });

    createdUserId = created.id;

    await upsertSignupProfile(testEmail, {
      nombre: 'E2E',
      apellido: 'AltaPanel',
      nombreCompleto: testName,
      telefono: '5491112345678',
      fechaNacimiento: '2001-04-10',
      objetivo: 'Prueba de alta desde admin',
      anamnesis: {
        tratamientoMedico: 'No',
        lesionesLimitaciones: 'No',
        medicacionRegular: 'No',
        consentimientoSalud: 'si',
      },
      updatedAt: new Date().toISOString(),
    });

    let login = await loginByCredentials(adminEmail, adminPassword);
    if (!login.ok) {
      login = await loginByOneTimeToken(adminEmail);
    }

    if (!login.ok || !login.cookieHeader) {
      throw new Error(`No se pudo autenticar admin (status=${login.status}, location=${login.location})`);
    }

    const usersBefore = await getUsers(login.cookieHeader);
    const pending = usersBefore.find((u) => String(u.email || '').trim().toLowerCase() === testEmail);

    if (!pending) {
      throw new Error('El ingresante de prueba no aparece en /api/admin/users');
    }

    if (String(pending.estado || '').trim().toLowerCase() !== 'pendiente_alta') {
      throw new Error(`Estado inicial inesperado: ${String(pending.estado || 'sin-estado')}`);
    }

    const updated = await setEstadoActivo(login.cookieHeader, String(pending.id || ''));
    if (String(updated.estado || '').trim().toLowerCase() !== 'activo') {
      throw new Error(`PUT respondio estado inesperado: ${String(updated.estado || 'sin-estado')}`);
    }

    const usersAfter = await getUsers(login.cookieHeader);
    const active = usersAfter.find((u) => String(u.email || '').trim().toLowerCase() === testEmail);

    if (!active) {
      throw new Error('El ingresante no aparece luego del alta');
    }

    if (String(active.estado || '').trim().toLowerCase() !== 'activo') {
      throw new Error(`Estado final inesperado: ${String(active.estado || 'sin-estado')}`);
    }

    const syncChecks = await assertAltaSyncedIntoClientes(testName, testEmail);

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      testEmail,
      beforeEstado: pending.estado,
      afterEstado: active.estado,
      syncChecks,
      message: 'Flujo de alta admin validado correctamente',
    }, null, 2));
  } finally {
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => null);
    }

    await removeSignupProfile(testEmail).catch(() => null);
    await removeSmokeAlumnoArtifacts(testName, testEmail).catch(() => null);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});
