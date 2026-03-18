const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const smokeMailboxBase = process.env.SMOKE_MAILBOX_BASE || 'marquezuribepsn@gmail.com';
const mainEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const mainPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';

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
      pass: results.loginAdmin.status === 302 && String(results.loginAdmin.location || '').endsWith('/'),
      detail: results.loginAdmin,
    },
    {
      name: 'nuevoColaborador',
      pass: results.nuevoColaborador.status === 200 && Boolean(results.nuevoColaborador.data && results.nuevoColaborador.data.success),
      detail: results.nuevoColaborador,
    },
    {
      name: 'colaboradorVisible',
      pass: results.colaboradorVisible === true,
      detail: { colaboradorVisible: results.colaboradorVisible },
    },
  ];

  const failed = checks.filter((c) => !c.pass);
  return { checks, failed };
}

async function main() {
  const alumnoEmail = makeAlias('alumno');
  const colaboradorEmail = makeAlias('colab');

  const results = {
    config: { baseUrl, smokeMailboxBase, mainEmail },
    mailDirect: await testMailDirect(smokeMailboxBase),
    registerAlumno: await postJson(`${baseUrl}/api/auth/register`, {
      email: alumnoEmail,
      password: 'Pfcontrol1234',
    }),
    forgotAlumno: await postJson(`${baseUrl}/api/auth/forgot-password`, {
      email: alumnoEmail,
    }),
    tokenAlumno: await getJson(`${baseUrl}/api/auth/get-reset-token?email=${encodeURIComponent(alumnoEmail)}`),
    loginAdmin: await testLogin(mainEmail, mainPassword),
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
  results.colaboradoresCount = colaboradores.length;

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
