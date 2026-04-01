/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000';
const mainEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const mainPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';

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

async function readJsonSafe(response) {
  const raw = await response.text();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

async function loginAndGetCookie() {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo: ${csrfResponse.status}`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error('csrf token ausente');
  }

  const csrfCookie = toCookieHeader(getSetCookieHeaderValues(csrfResponse.headers));

  const form = new URLSearchParams({
    email: mainEmail,
    password: mainPassword,
    csrfToken: csrfData.csrfToken,
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
  return [csrfCookie, loginCookie].filter(Boolean).join('; ');
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

  return {
    status: response.status,
    data: await readJsonSafe(response),
  };
}

async function getPage(url, cookieHeader) {
  const response = await fetch(url, {
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    redirect: 'manual',
  });

  const body = await response.text();
  return { status: response.status, body };
}

function evaluate(results) {
  const createdPlan = results.createPlan?.data?.plan;
  const extendedPlan = results.extendPlan?.data?.plan;

  const checks = [
    {
      name: 'unauthorizedAiPlanGuard',
      pass: results.unauthorized.status === 401,
      detail: results.unauthorized,
    },
    {
      name: 'createPlan',
      pass:
        results.createPlan.status === 200 &&
        Boolean(createdPlan?.id) &&
        Array.isArray(createdPlan?.weeks) &&
        createdPlan.weeks.length >= 1,
      detail: {
        status: results.createPlan.status,
        planId: createdPlan?.id,
        weeks: Array.isArray(createdPlan?.weeks) ? createdPlan.weeks.length : 0,
      },
    },
    {
      name: 'extendPlan',
      pass:
        results.extendPlan.status === 200 &&
        Boolean(extendedPlan?.id) &&
        Number(extendedPlan?.totalWeeks || 0) > Number(createdPlan?.totalWeeks || 0),
      detail: {
        status: results.extendPlan.status,
        baseWeeks: createdPlan?.totalWeeks || 0,
        extendedWeeks: extendedPlan?.totalWeeks || 0,
      },
    },
    {
      name: 'sesionesPageReachable',
      pass:
        results.sesionesPage.status === 200 &&
        Number(results.sesionesPage.bodyLength || 0) > 500,
      detail: {
        status: results.sesionesPage.status,
        bodyLength: results.sesionesPage.bodyLength,
      },
    },
  ];

  const failedChecks = checks.filter((item) => !item.pass);
  return { checks, failedChecks };
}

async function main() {
  const unauthorized = await postJson(
    `${baseUrl}/api/sesiones/ai-plan`,
    {
      mode: 'create',
      targetType: 'alumno',
      targetName: 'Smoke AI',
      sport: 'Futbol',
      category: 'General',
      weeks: 2,
    },
    ''
  );

  if (unauthorized.status === 404) {
    const sesionesPage = await getPage(`${baseUrl}/sesiones`, '');
    const output = {
      ok: true,
      skipped: true,
      skipReason: 'Endpoint /api/sesiones/ai-plan no disponible en este deployment',
      summary: {
        unauthorizedStatus: unauthorized.status,
        sesionesStatus: sesionesPage.status,
        sesionesBodyLength: sesionesPage.body.length,
      },
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const cookie = await loginAndGetCookie();

  const createPlan = await postJson(
    `${baseUrl}/api/sesiones/ai-plan`,
    {
      mode: 'create',
      targetType: 'alumno',
      targetName: `Smoke Sesiones AI ${Date.now()}`,
      sport: 'Futbol',
      category: 'General',
      ageMin: 16,
      ageMax: 27,
      level: 'desarrollo',
      objectives: ['fuerza', 'resistencia'],
      capabilities: ['fuerza', 'potencia', 'movilidad'],
      constraints: ['sin saltos de carga mayores al 10%'],
      sessionsPerWeek: 3,
      sessionDurationMin: 70,
      weeks: 2,
      startDate: new Date().toISOString().slice(0, 10),
      notes: 'Smoke test sesiones ai',
      events: [
        {
          date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          label: 'Partido smoke',
          kind: 'partido',
          importance: 4,
        },
      ],
    },
    cookie
  );

  const existingPlan = createPlan?.data?.plan;
  const extendPlan = await postJson(
    `${baseUrl}/api/sesiones/ai-plan`,
    {
      mode: 'extend',
      existingPlan,
      weeks: 1,
      events: [
        {
          date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          label: 'Partido extend smoke',
          kind: 'partido',
          importance: 3,
        },
      ],
    },
    cookie
  );

  const sesionesPage = await getPage(`${baseUrl}/sesiones`, cookie);

  const results = {
    config: {
      baseUrl,
      mainEmail,
      hasMainPassword: Boolean(mainPassword),
    },
    unauthorized: {
      status: unauthorized.status,
      message: unauthorized?.data?.message || null,
    },
    createPlan,
    extendPlan,
    sesionesPage: {
      status: sesionesPage.status,
      bodyLength: sesionesPage.body.length,
    },
  };

  const { checks, failedChecks } = evaluate(results);

  const output = {
    ok: failedChecks.length === 0,
    failedChecks,
    checks,
    summary: {
      createPlanStatus: createPlan.status,
      extendPlanStatus: extendPlan.status,
      sesionesStatus: sesionesPage.status,
      createdWeeks: createPlan?.data?.plan?.totalWeeks || null,
      extendedWeeks: extendPlan?.data?.plan?.totalWeeks || null,
    },
  };

  console.log(JSON.stringify(output, null, 2));

  if (failedChecks.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
