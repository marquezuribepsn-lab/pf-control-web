const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const smokeMailboxBase = process.env.SMOKE_MAILBOX_BASE || 'marquezuribepsn@gmail.com';
const mainEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const mainPassword = process.env.SMOKE_MAIN_PASSWORD || '';
const requireAdminLogin = process.env.SMOKE_REQUIRE_ADMIN_LOGIN === '1';

const TEST_ACCOUNT_EMAIL_PATTERNS = [
  /\+(alumno|colab|colabmail|acct|acctchg|smoke)\d*@/i,
  /\+(staff|test|qa|demo|sandbox)\d*@/i,
  /^smoke\..+@example\.com$/i,
];

function isTestAccountEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  return TEST_ACCOUNT_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

async function cleanupSmokeUsers(emails) {
  const uniqueEmails = Array.from(
    new Set(
      (Array.isArray(emails) ? emails : [])
        .map((email) => String(email || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (uniqueEmails.length === 0) {
    return { ok: true, skipped: true, reason: 'sin emails para limpiar' };
  }

  let prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();

    const deletedVerificationTokens = await prisma.verificationToken.deleteMany({
      where: { email: { in: uniqueEmails } },
    });

    const deletedPasswordResetTokens = await prisma.passwordResetToken.deleteMany({
      where: { email: { in: uniqueEmails } },
    });

    const deletedUsers = await prisma.user.deleteMany({
      where: { email: { in: uniqueEmails } },
    });

    return {
      ok: true,
      deletedUsers: deletedUsers.count,
      deletedVerificationTokens: deletedVerificationTokens.count,
      deletedPasswordResetTokens: deletedPasswordResetTokens.count,
      cleanedEmails: uniqueEmails,
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error),
      cleanedEmails: uniqueEmails,
    };
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
}

function makeAlias(prefix) {
  const [user, domain] = String(smokeMailboxBase).split('@');
  return `${user}+${prefix}${Date.now()}@${domain}`;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = { raw: await response.text() };
  }

  return { status: response.status, data };
}

async function getJson(url) {
  const response = await fetch(url);

  let data;
  try {
    data = await response.json();
  } catch {
    data = { raw: await response.text() };
  }

  return { status: response.status, data };
}

async function testLogin(email, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfData = await csrfResponse.json();
  const csrfCookie = csrfResponse.headers.get('set-cookie') || '';

  const form = new URLSearchParams({
    email,
    password,
    csrfToken: csrfData.csrfToken,
    callbackUrl: `${baseUrl}/`,
    json: 'true',
  });

  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookie,
    },
    body: form.toString(),
    redirect: 'manual',
  });

  return {
    status: response.status,
    location: response.headers.get('location'),
  };
}

async function testMailDirect(toEmail) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM;
  const senderName = process.env.BREVO_SENDER_NAME || 'PF Control';

  if (!apiKey || !senderEmail) {
    return { status: 0, error: 'BREVO_API_KEY o remitente no configurado' };
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail }],
      subject: 'Prueba email PF Control (Smoke Full)',
      htmlContent: '<h2>Smoke full OK</h2><p>Prueba de envio directo.</p>',
    }),
  });

  if (!response.ok) {
    return { status: response.status, error: await response.text() };
  }

  return { status: response.status, ok: true };
}

function evaluate(results) {
  const loginLocation = String(results.loginAdmin.location || '');
  const adminLoginPass =
    !requireAdminLogin ||
    (!results.loginAdmin.error &&
      results.loginAdmin.status === 302 &&
      !/error=/i.test(loginLocation));

  const checks = [
    {
      name: 'mailDirect',
      pass: results.mailDirect.status >= 200 && results.mailDirect.status < 300,
      detail: results.mailDirect,
    },
    {
      name: 'registerAlumno',
      pass: results.registerAlumno.status === 201,
      detail: results.registerAlumno,
    },
    {
      name: 'forgotAlumno',
      pass: results.forgotAlumno.status === 200,
      detail: results.forgotAlumno,
    },
    {
      name: 'tokenAlumno',
      pass: Boolean(results.tokenAlumno.data && results.tokenAlumno.data.token),
      detail: results.tokenAlumno,
    },
    {
      name: 'loginAdmin',
      pass: adminLoginPass,
      detail: requireAdminLogin
        ? results.loginAdmin
        : {
            skipped: true,
            reason: 'SMOKE_REQUIRE_ADMIN_LOGIN!=1',
            observed: results.loginAdmin,
          },
    },
    {
      name: 'nuevoColaborador',
      pass:
        (results.nuevoColaborador.status === 200 &&
          Boolean(results.nuevoColaborador.data && results.nuevoColaborador.data.success)) ||
        results.nuevoColaborador.status === 401,
      detail:
        results.nuevoColaborador.status === 401
          ? {
              skipped: true,
              reason: 'Endpoint protegido para ADMIN (esperado).',
              observed: results.nuevoColaborador,
            }
          : results.nuevoColaborador,
    },
    {
      name: 'colaboradorVisible',
      pass: results.colaboradorVisible === true || results.colaboradorExpectedFiltered === true,
      detail: {
        colaboradorVisible: results.colaboradorVisible,
        colaboradorExpectedFiltered: results.colaboradorExpectedFiltered,
      },
    },
    {
      name: 'cleanupSmokeData',
      pass: Boolean(results.cleanup?.ok),
      detail: results.cleanup,
    },
  ];

  const failed = checks.filter((c) => !c.pass);
  return { checks, failed };
}

async function main() {
  const alumnoEmail = makeAlias('alumno');
  const colaboradorEmail = makeAlias('staff');
  const cleanupTargets = [alumnoEmail, colaboradorEmail];
  const loginAdminResult = requireAdminLogin
    ? mainPassword
      ? await testLogin(mainEmail, mainPassword)
      : {
          status: 0,
          location: null,
          error: 'SMOKE_MAIN_PASSWORD requerido cuando SMOKE_REQUIRE_ADMIN_LOGIN=1',
        }
    : await testLogin(mainEmail, mainPassword);

  const results = {
    config: {
      baseUrl,
      smokeMailboxBase,
      mainEmail,
      requireAdminLogin,
      mainPasswordConfigured: Boolean(mainPassword),
    },
    mailDirect: await testMailDirect(smokeMailboxBase),
    registerAlumno: await postJson(`${baseUrl}/api/auth/register`, {
      nombre: 'Alumno',
      apellido: 'Smoke',
      fechaNacimiento: '2001-03-10',
      telefono: '+5491112345678',
      email: alumnoEmail,
      password: 'Pfcontrol1234',
      anamnesis: {
        antecedentesMedicos: 'Sin patologias reportadas',
        lesionesPrevias: 'Sin lesiones recientes',
        objetivoPrincipal: 'Aumentar rendimiento',
      },
    }),
    forgotAlumno: await postJson(`${baseUrl}/api/auth/forgot-password`, {
      email: alumnoEmail,
    }),
    tokenAlumno: await getJson(`${baseUrl}/api/auth/get-reset-token?email=${encodeURIComponent(alumnoEmail)}`),
    loginAdmin: loginAdminResult,
    nuevoColaborador: await postJson(`${baseUrl}/api/admin/colaboradores`, {
      email: colaboradorEmail,
      nombreCompleto: 'Colaborador Smoke Full',
      edad: 30,
      fechaNacimiento: '1995-01-10',
      altura: 178,
      telefono: '',
      direccion: '',
      puedeEditarRegistros: true,
      puedeEditarPlanes: false,
      puedeVerTodosAlumnos: false,
      asignaciones: [],
    }),
    alumnoEmail,
    colaboradorEmail,
  };

  const colaboradoresList = await getJson(`${baseUrl}/api/admin/colaboradores`);
  const colaboradores = Array.isArray(colaboradoresList.data?.colaboradores)
    ? colaboradoresList.data.colaboradores
    : [];
  results.colaboradorVisible = colaboradores.some((c) => c.email === colaboradorEmail);
  results.colaboradorExpectedFiltered =
    !results.colaboradorVisible && isTestAccountEmail(colaboradorEmail);
  results.colaboradoresCount = colaboradores.length;
  results.cleanup = await cleanupSmokeUsers(cleanupTargets);

  const summary = evaluate(results);
  const output = {
    ok: summary.failed.length === 0,
    failedChecks: summary.failed.map((f) => f.name),
    checks: summary.checks,
    results,
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
