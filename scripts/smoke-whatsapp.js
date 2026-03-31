const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const requireAdminLogin = process.env.SMOKE_REQUIRE_ADMIN_LOGIN !== '0';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';
const testPhone = String(process.env.SMOKE_WHATSAPP_TEST_PHONE || process.env.WHATSAPP_TO || '').trim();
const requireSend = String(process.env.SMOKE_REQUIRE_WHATSAPP_SEND || '0').trim() === '1';

function toCookieHeader(setCookieList) {
  return (Array.isArray(setCookieList) ? setCookieList : [])
    .map((entry) => String(entry).split(';')[0])
    .filter(Boolean)
    .join('; ');
}

async function loginAsAdmin() {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`No se pudo obtener CSRF: ${csrfResponse.status}`);
  }

  const csrfData = await csrfResponse.json();
  const csrfCookies = typeof csrfResponse.headers.getSetCookie === 'function'
    ? csrfResponse.headers.getSetCookie()
    : [];

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: toCookieHeader(csrfCookies),
    },
    body: new URLSearchParams({
      email: adminEmail,
      password: adminPassword,
      csrfToken: csrfData.csrfToken,
      callbackUrl: `${baseUrl}/`,
      json: 'true',
    }).toString(),
    redirect: 'manual',
  });

  const location = loginResponse.headers.get('location') || '';
  const loginCookies = typeof loginResponse.headers.getSetCookie === 'function'
    ? loginResponse.headers.getSetCookie()
    : [];

  if (loginResponse.status !== 302 || /error=/i.test(location)) {
    throw new Error(`Login admin fallo: status=${loginResponse.status} location=${location}`);
  }

  return toCookieHeader([...csrfCookies, ...loginCookies]);
}

async function call(path, method = 'GET', body, cookie = '') {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { status: res.status, data };
}

async function main() {
  const adminCookie = requireAdminLogin ? await loginAsAdmin() : '';

  const summary = {
    baseUrl,
    requireAdminLogin,
    requireSend,
    checks: [],
    failed: [],
  };

  const templateCreate = await call('/api/whatsapp/templates', 'POST', {
    nombre: `Smoke Template ${Date.now()}`,
    categoria: 'General',
    mensaje: 'Hola {{nombre}}',
  }, adminCookie);
  const templateKey = templateCreate.data?.template?.key;
  summary.checks.push({ name: 'templateCreate', pass: templateCreate.status === 200 && Boolean(templateKey), detail: templateCreate });

  const templateList = await call('/api/whatsapp/templates', 'GET', undefined, adminCookie);
  summary.checks.push({ name: 'templateList', pass: templateList.status === 200, detail: { status: templateList.status, count: Array.isArray(templateList.data?.templates) ? templateList.data.templates.length : null } });

  if (templateKey) {
    const templateDelete = await call('/api/whatsapp/templates', 'DELETE', { key: templateKey }, adminCookie);
    summary.checks.push({ name: 'templateDelete', pass: templateDelete.status === 200 && templateDelete.data?.ok === true, detail: templateDelete });
  }

  const scheduleCreate = await call('/api/whatsapp/schedule', 'POST', {
    nombre: `Smoke Schedule ${Date.now()}`,
    categoria: 'General',
    mensaje: 'Mensaje programado de prueba',
    destinatarios: ['Prueba'],
    fecha: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }, adminCookie);
  const scheduleKey = scheduleCreate.data?.schedule?.key;
  summary.checks.push({ name: 'scheduleCreate', pass: scheduleCreate.status === 200 && Boolean(scheduleKey), detail: scheduleCreate });

  const scheduleList = await call('/api/whatsapp/schedule', 'GET', undefined, adminCookie);
  summary.checks.push({ name: 'scheduleList', pass: scheduleList.status === 200, detail: { status: scheduleList.status, count: Array.isArray(scheduleList.data?.schedules) ? scheduleList.data.schedules.length : null } });

  if (scheduleKey) {
    const scheduleDelete = await call('/api/whatsapp/schedule', 'DELETE', { key: scheduleKey }, adminCookie);
    summary.checks.push({ name: 'scheduleDelete', pass: scheduleDelete.status === 200 && scheduleDelete.data?.ok === true, detail: scheduleDelete });
  }

  const configGet = await call('/api/whatsapp/config', 'GET', undefined, adminCookie);
  summary.checks.push({
    name: 'configGet',
    pass: configGet.status === 200 && Boolean(configGet.data?.config),
    detail: { status: configGet.status },
  });

  const simulate = await call('/api/whatsapp/automation/simulate', 'POST', {
    categoryKey: 'cobranzas',
    ruleKey: 'aviso_anticipado',
    limit: 5,
  }, adminCookie);
  summary.checks.push({
    name: 'automationSimulate',
    pass: simulate.status === 200 && simulate.data?.ok === true,
    detail: { status: simulate.status, totalMatched: simulate.data?.summary?.totalMatched ?? null },
  });

  const runDry = await call('/api/whatsapp/automation/run', 'POST', {
    dryRun: true,
    categoryKey: 'recordatorios_otros',
    ruleKey: 'encuesta_fin_semana',
    forceWindow: true,
    includeDisabled: true,
  }, adminCookie);
  summary.checks.push({
    name: 'automationRunDry',
    pass: runDry.status === 200 && Boolean(runDry.data?.runId),
    detail: { status: runDry.status, rulesExecuted: runDry.data?.rulesExecuted ?? null },
  });

  const automationRuns = await call('/api/admin/whatsapp-automation-runs', 'GET', undefined, adminCookie);
  summary.checks.push({
    name: 'automationRunsList',
    pass: automationRuns.status === 200 && Array.isArray(automationRuns.data?.runs),
    detail: {
      status: automationRuns.status,
      count: Array.isArray(automationRuns.data?.runs) ? automationRuns.data.runs.length : null,
    },
  });

  if (testPhone) {
    const send = await call('/api/whatsapp/send', 'POST', {
      destinatarios: [
        {
          id: 'smoke-1',
          label: 'Prueba smoke',
          tipo: 'test',
          telefono: testPhone,
          variables: {
            nombre: 'Prueba smoke',
            telefono: testPhone,
          },
        },
      ],
      mensaje: `Smoke WhatsApp send ${Date.now()}`,
      tipo: 'General',
      subcategoria: 'smoke',
      mode: 'test',
    }, adminCookie);

    const sendResult = Array.isArray(send.data?.results) ? send.data.results[0] : null;
    summary.checks.push({
      name: 'send',
      pass: send.status === 200 && send.data?.ok === true && Boolean(sendResult) && sendResult.ok === true,
      detail: send,
    });
  } else {
    summary.checks.push({
      name: 'send',
      pass: !requireSend,
      skipped: !requireSend,
      detail: {
        skipped: !requireSend,
        reason: requireSend
          ? 'SMOKE_REQUIRE_WHATSAPP_SEND=1 pero SMOKE_WHATSAPP_TEST_PHONE/WHATSAPP_TO no configurado'
          : 'SMOKE_WHATSAPP_TEST_PHONE/WHATSAPP_TO no configurado',
      },
    });
  }

  summary.failed = summary.checks.filter((check) => !check.pass).map((check) => check.name);
  summary.ok = summary.failed.length === 0;

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
