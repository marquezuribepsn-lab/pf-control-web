const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const smokeMailboxBase = process.env.SMOKE_MAILBOX_BASE || 'marquezuribepsn@gmail.com';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';

function getSetCookies(response) {
  const headers = response?.headers;
  if (!headers) return [];

  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().filter(Boolean);
  }

  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function toCookieHeader(cookies) {
  return (Array.isArray(cookies) ? cookies : [])
    .map((cookie) => String(cookie).split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function makeAlias(prefix) {
  const [user, domain] = String(smokeMailboxBase).split('@');
  return `${user}+${prefix}${Date.now()}@${domain}`;
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
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

  return { status: response.status, data, headers: response.headers };
}

async function adminLogin() {
  return loginByCredentials(adminEmail, adminPassword);
}

async function loginByCredentials(email, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`No se pudo obtener csrf token (${csrfResponse.status})`);
  }

  const csrfData = await csrfResponse.json();
  const csrfCookies = getSetCookies(csrfResponse);

  if (!csrfData?.csrfToken) {
    throw new Error('csrf token ausente');
  }

  const form = new URLSearchParams({
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
    body: form,
    redirect: 'manual',
  });

  const location = String(loginResponse.headers.get('location') || '');
  const loginCookies = getSetCookies(loginResponse);
  const cookieHeader = toCookieHeader([...csrfCookies, ...loginCookies]);

  const ok =
    loginResponse.status === 302 &&
    !/error=/i.test(location) &&
    /session-token/i.test(cookieHeader);

  return {
    ok,
    status: loginResponse.status,
    location,
    cookieHeader,
  };
}

async function registerAlumno(email, password) {
  return postJson(`${baseUrl}/api/auth/register`, {
    nombre: 'Smoke',
    apellido: 'PasswordToken',
    fechaNacimiento: '1997-03-20',
    telefono: '+5491112345678',
    email,
    password,
    anamnesis: {
      tratamientoMedico: 'no',
      lesionesLimitaciones: 'no',
      medicacionRegular: 'no',
      cirugiasRecientes: 'no',
      antecedentesClinicos: 'sin antecedentes relevantes',
      autorizacionMedica: 'si',
      experienciaEntrenamiento: 'intermedio',
      alimentacionActual: ['equilibrada'],
      alimentacionDetalle: '',
      desordenAlimentario: 'no',
      consumoSustancias: 'no',
      suplementos: 'no',
      interesEntrenamiento: ['mixto / personalizado'],
      interesDetalle: '',
      compromisoObjetivo: 8,
      origenContacto: ['instagram'],
      origenDetalle: '',
      consentimientoSalud: 'si',
    },
  });
}

async function listUsers(cookieHeader) {
  const response = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Cookie: cookieHeader },
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : [];
  } catch {
    data = [];
  }

  return { status: response.status, data };
}

async function deleteUser(userId, cookieHeader) {
  const response = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ userId }),
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  return { status: response.status, data };
}

async function adminPasswordAction(body, cookieHeader) {
  return postJson(`${baseUrl}/api/admin/users/password`, body, {
    Cookie: cookieHeader,
  });
}

async function main() {
  const testEmail = makeAlias('pwtoken');
  const registerPassword = 'Pfcontrol1234';
  const report = {
    ok: false,
    baseUrl,
    testEmail,
    steps: {},
    cleanup: { attempted: false },
  };

  let cookieHeader = '';
  let userId = '';

  try {
    const login = await adminLogin();
    report.steps.loginAdmin = {
      status: login.status,
      location: login.location,
      ok: login.ok,
    };

    if (!login.ok) {
      throw new Error('Login de admin no valido para smoke one-time');
    }

    cookieHeader = login.cookieHeader;

    const register = await registerAlumno(testEmail, registerPassword);
    report.steps.registerAlumno = { status: register.status };

    if (register.status !== 201) {
      throw new Error(`No se pudo registrar alumno (${register.status})`);
    }

    const users = await listUsers(cookieHeader);
    report.steps.listUsers = { status: users.status };

    if (users.status !== 200 || !Array.isArray(users.data)) {
      throw new Error(`No se pudo listar usuarios admin (${users.status})`);
    }

    const target = users.data.find((user) => String(user?.email || '').toLowerCase() === testEmail.toLowerCase());
    if (!target?.id) {
      throw new Error('No se encontro el usuario de prueba en listado admin');
    }

    userId = String(target.id);
    const isEmailVerified = Boolean(target.emailVerified);
    report.steps.targetUser = {
      id: userId,
      role: String(target.role || ''),
      emailVerified: isEmailVerified,
    };

    const reset = await adminPasswordAction({ userId }, cookieHeader);
    const visiblePassword = String(reset.data?.visiblePassword || '');
    report.steps.resetPassword = {
      status: reset.status,
      hasPassword: Boolean(visiblePassword),
    };

    if (reset.status !== 200 || !visiblePassword) {
      throw new Error(`Reset password invalido (${reset.status})`);
    }

    const loginAfterReset = await loginByCredentials(testEmail, visiblePassword);
    report.steps.loginWithResetPassword = {
      status: loginAfterReset.status,
      location: loginAfterReset.location,
      ok: loginAfterReset.ok,
      expectedBlockedUntilVerification: !isEmailVerified,
    };

    if (!loginAfterReset.ok && isEmailVerified) {
      throw new Error(
        `No se pudo iniciar sesion con contrasena blanqueada (${loginAfterReset.status})`
      );
    }

    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.error = String(error);
  } finally {
    if (cookieHeader && userId) {
      report.cleanup.attempted = true;
      const cleanup = await deleteUser(userId, cookieHeader).catch((error) => ({
        status: 0,
        data: { error: String(error) },
      }));
      report.cleanup.status = cleanup.status;
      report.cleanup.ok = cleanup.status === 200;
    }

    console.log(JSON.stringify(report, null, 2));

    if (!report.ok) {
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});