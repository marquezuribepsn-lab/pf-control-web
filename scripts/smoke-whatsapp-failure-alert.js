const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';

function splitCookieHeader(raw) {
  if (!raw) return [];
  return String(raw).split(/,(?=\s*[^;\s]+=)/g);
}

function getSetCookieValues(headers) {
  if (headers && typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
  }

  const single = headers?.get?.('set-cookie');
  if (!single) return [];
  return splitCookieHeader(single);
}

function toCookieHeader(setCookieValues) {
  return (Array.isArray(setCookieValues) ? setCookieValues : [])
    .map((entry) => String(entry || '').split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

async function loginAsAdmin() {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`No se pudo obtener CSRF: ${csrfResponse.status}`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error('csrfToken ausente');
  }

  const csrfCookies = getSetCookieValues(csrfResponse.headers);

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
  if (loginResponse.status !== 302 || /error=/i.test(location)) {
    throw new Error(`Login admin fallo: status=${loginResponse.status}, location=${location}`);
  }

  const loginCookies = getSetCookieValues(loginResponse.headers);
  const mergedCookies = [...csrfCookies, ...loginCookies];
  return toCookieHeader(mergedCookies);
}

async function callJson(path, method, body, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return {
    status: response.status,
    data,
  };
}

async function main() {
  const cookie = await loginAsAdmin();

  const forcedRun = await callJson(
    '/api/whatsapp/automation/run',
    'POST',
    {
      dryRun: false,
      forceFailureForTest: true,
    },
    cookie
  );

  const runId = String(forcedRun.data?.runId || '');

  if (forcedRun.status === 400) {
    const output = {
      ok: true,
      skipped: true,
      baseUrl,
      reason: 'forceFailureForTest disabled',
      detail: forcedRun,
      hint: 'En produccion activa WHATSAPP_AUTOMATION_ALLOW_FORCE_FAILURE_TEST=1 para esta prueba controlada.',
    };

    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const runsList = await callJson('/api/admin/whatsapp-automation-runs', 'GET', undefined, cookie);
  const runs = Array.isArray(runsList.data?.runs) ? runsList.data.runs : [];
  const matchingRun = runs.find((entry) => String(entry?.value?.runId || '') === runId);
  const value = matchingRun?.value || {};

  const checks = [
    {
      name: 'forcedRunResponse',
      pass: forcedRun.status === 200 && Boolean(runId) && forcedRun.data?.forcedFailureTest === true,
      detail: { status: forcedRun.status, runId, forcedFailureTest: forcedRun.data?.forcedFailureTest ?? null },
    },
    {
      name: 'runPersisted',
      pass: Boolean(matchingRun),
      detail: { found: Boolean(matchingRun) },
    },
    {
      name: 'runMarkedFailed',
      pass: value?.ok === false,
      detail: { ok: value?.ok ?? null },
    },
    {
      name: 'runMarkedForcedTest',
      pass: value?.forcedFailureTest === true,
      detail: { forcedFailureTest: value?.forcedFailureTest ?? null },
    },
    {
      name: 'alertFlagsPresent',
      pass:
        typeof value?.emailAlertSent === 'boolean' &&
        typeof value?.whatsappAlertSent === 'boolean' &&
        (value?.alertError === null || typeof value?.alertError === 'string'),
      detail: {
        emailAlertSent: value?.emailAlertSent ?? null,
        whatsappAlertSent: value?.whatsappAlertSent ?? null,
        alertError: value?.alertError ?? null,
      },
    },
  ];

  const failedChecks = checks.filter((item) => !item.pass).map((item) => item.name);

  const output = {
    ok: failedChecks.length === 0,
    baseUrl,
    runId,
    failedChecks,
    checks,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
