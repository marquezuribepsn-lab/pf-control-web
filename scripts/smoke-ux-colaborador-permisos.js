const path = require('path');
const os = require('os');

const bcrypt = require('bcryptjs');
const { chromium } = require('playwright');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'https://pf-control.com';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';
const smokeMailboxBase = process.env.SMOKE_MAILBOX_BASE || adminEmail;

const testPassword = process.env.SMOKE_COLAB_PASSWORD || 'Pfcontrol1234!';
const stamp = Date.now();
const [mailUser, mailDomain] = String(smokeMailboxBase).split('@');
const colaboradorEmail = `${mailUser}+colabux${stamp}@${mailDomain}`;

const accessPolicy = {
  '/plantel': true,
  '/registros': true,
  '/sesiones': false,
  '/clientes': false,
};

function must(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function splitSetCookie(raw) {
  if (!raw) return [];
  return String(raw).split(/,(?=\s*[^;,\s]+=)/g);
}

function getSetCookieValues(headers) {
  if (headers && typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) return values;
  }

  const single = headers && typeof headers.get === 'function' ? headers.get('set-cookie') : null;
  return single ? splitSetCookie(single) : [];
}

function toCookieHeader(setCookieValues) {
  return (Array.isArray(setCookieValues) ? setCookieValues : [])
    .map((entry) => String(entry || '').split(';')[0])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join('; ');
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return { raw: await response.text() };
  }
}

async function createColaborador() {
  const response = await fetch(`${baseUrl}/api/admin/colaboradores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: colaboradorEmail,
      nombreCompleto: 'Colaborador UX Smoke',
      edad: 29,
      fechaNacimiento: '1997-01-10',
      altura: 176,
      telefono: '',
      direccion: '',
      puedeEditarRegistros: true,
      puedeEditarPlanes: false,
      puedeVerTodosAlumnos: false,
      asignaciones: [],
    }),
  });

  const data = await readJsonSafe(response);
  const id = data && data.colaborador && data.colaborador.id;

  return {
    status: response.status,
    data,
    id,
  };
}

async function configureColaborador(colaboradorId) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  const response = await fetch(`${baseUrl}/api/admin/colaboradores/${colaboradorId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'COLABORADOR',
      password: hashedPassword,
      puedeEditarRegistros: true,
      puedeEditarPlanes: false,
      puedeVerTodosAlumnos: false,
      permisosGranulares: {
        accesos: accessPolicy,
      },
      emailVerified: true,
      estado: 'activo',
    }),
  });

  return {
    status: response.status,
    data: await readJsonSafe(response),
  };
}

async function suspendColaborador(colaboradorId) {
  if (!colaboradorId) {
    return { skipped: true };
  }

  const response = await fetch(`${baseUrl}/api/admin/colaboradores/${colaboradorId}`, {
    method: 'DELETE',
  });

  return {
    status: response.status,
    data: await readJsonSafe(response),
  };
}

async function loginByCredentials(email, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo (${csrfResponse.status})`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData || !csrfData.csrfToken) {
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

async function openAuthenticatedContext(cookieHeader) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    extraHTTPHeaders: {
      Cookie: cookieHeader,
    },
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function ensureAdminView(page) {
  await page.goto(`${baseUrl}/admin/usuarios`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(900);

  const body = await page.textContent('body');
  const hasUsersAndPerms = /usuarios y permisos/i.test(String(body || ''));
  const hasColabCopy = /colaborador/i.test(String(body || ''));

  return {
    hasUsersAndPerms,
    hasColabCopy,
    url: page.url(),
  };
}

async function collectSidebarVisibility(page) {
  const checks = [
    { href: '/plantel', expectedVisible: true },
    { href: '/registros', expectedVisible: true },
    { href: '/sesiones', expectedVisible: false },
    { href: '/clientes', expectedVisible: false },
    { href: '/admin/usuarios', expectedVisible: false },
  ];

  const results = [];
  for (const check of checks) {
    const locator = page.locator(`aside a[href="${check.href}"]`);
    const visible = (await locator.count()) > 0;
    results.push({
      href: check.href,
      expectedVisible: check.expectedVisible,
      visible,
      pass: visible === check.expectedVisible,
    });
  }

  return results;
}

async function main() {
  must(adminEmail, 'SMOKE_MAIN_EMAIL es requerido');
  must(adminPassword, 'SMOKE_MAIN_PASSWORD es requerido');

  const screenshots = {
    admin: path.join(os.tmpdir(), `pf-control-admin-usuarios-${stamp}.png`),
    colaborador: path.join(os.tmpdir(), `pf-control-colab-sidebar-${stamp}.png`),
  };

  const output = {
    ok: false,
    baseUrl,
    adminEmail,
    colaboradorEmail,
    steps: {},
    screenshots,
  };

  let adminBrowser;
  let adminContext;
  let adminPage;
  let colabBrowser;
  let colabContext;
  let colabPage;
  let colaboradorId = '';

  try {
    const created = await createColaborador();
    output.steps.createColaborador = { status: created.status, id: created.id || null };
    if (created.status !== 200 || !created.id) {
      throw new Error(`No se pudo crear colaborador de prueba. status=${created.status}`);
    }
    colaboradorId = created.id;

    const configured = await configureColaborador(colaboradorId);
    output.steps.configureColaborador = { status: configured.status, data: configured.data };
    if (configured.status !== 200) {
      throw new Error(
        `No se pudo configurar permisos del colaborador. status=${configured.status} detail=${JSON.stringify(configured.data)}`
      );
    }

    const loginAdmin = await loginByCredentials(adminEmail, adminPassword);
    output.steps.loginAdmin = {
      ok: loginAdmin.ok,
      status: loginAdmin.status,
      location: loginAdmin.location,
    };
    if (!loginAdmin.ok) {
      throw new Error(
        `admin login fallo: status=${loginAdmin.status} location=${loginAdmin.location}`
      );
    }

    const adminSession = await openAuthenticatedContext(loginAdmin.cookieHeader);
    adminBrowser = adminSession.browser;
    adminContext = adminSession.context;
    adminPage = adminSession.page;

    const adminView = await ensureAdminView(adminPage);
    output.steps.adminView = adminView;
    await adminPage.screenshot({ path: screenshots.admin, fullPage: true });

    const loginColaborador = await loginByCredentials(colaboradorEmail, testPassword);
    output.steps.loginColaborador = {
      ok: loginColaborador.ok,
      status: loginColaborador.status,
      location: loginColaborador.location,
    };
    if (!loginColaborador.ok) {
      throw new Error(
        `colaborador login fallo: status=${loginColaborador.status} location=${loginColaborador.location}`
      );
    }

    const colabSession = await openAuthenticatedContext(loginColaborador.cookieHeader);
    colabBrowser = colabSession.browser;
    colabContext = colabSession.context;
    colabPage = colabSession.page;

    await colabPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 });
    await colabPage.waitForTimeout(1200);
    const sidebar = await collectSidebarVisibility(colabPage);
    output.steps.colaboradorSidebar = sidebar;
    await colabPage.screenshot({ path: screenshots.colaborador, fullPage: true });

    const adminPass = adminView.hasUsersAndPerms && adminView.hasColabCopy;
    const sidebarPass = sidebar.every((item) => item.pass);

    output.ok = adminPass && sidebarPass;
    output.summary = {
      adminPass,
      sidebarPass,
      checkedLinks: sidebar.length,
    };
  } finally {
    output.steps.cleanup = await suspendColaborador(colaboradorId);

    if (adminContext) {
      await adminContext.close().catch(() => {});
    }
    if (adminBrowser) {
      await adminBrowser.close().catch(() => {});
    }
    if (colabContext) {
      await colabContext.close().catch(() => {});
    }
    if (colabBrowser) {
      await colabBrowser.close().catch(() => {});
    }
  }

  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        baseUrl,
        colaboradorEmail,
        error: String(error && error.message ? error.message : error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
