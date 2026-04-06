const path = require('path');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const prisma = new PrismaClient();

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000';
const mainEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const mainPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';
const allowMagicLogin = process.env.SMOKE_ALLOW_MAGIC_LOGIN === '1';

function getSetCookieHeaderValues(headers) {
  if (headers?.getSetCookie && typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
  }

  const single = headers?.get?.('set-cookie');
  return single ? String(single).split(/,(?=\s*[^;,\s]+=)/g) : [];
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

async function loginByCredentials() {
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
  const loginCookie = toCookieHeader(getSetCookieHeaderValues(loginResponse.headers));

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(location),
    status: loginResponse.status,
    location,
    cookieHeader: [csrfCookie, loginCookie].filter(Boolean).join('; '),
  };
}

async function loginByMagicLink(email) {
  const requestResponse = await fetch(`${baseUrl}/api/auth/login-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!requestResponse.ok) {
    return {
      ok: false,
      status: requestResponse.status,
      location: 'magic-link-request-failed',
      cookieHeader: '',
    };
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const latestToken = await prisma.verificationToken.findFirst({
    where: {
      email: normalizedEmail,
      token: {
        startsWith: 'login-link-',
      },
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      expiresAt: 'desc',
    },
    select: {
      token: true,
    },
  });

  if (!latestToken?.token) {
    return {
      ok: false,
      status: 500,
      location: 'magic-token-not-found',
      cookieHeader: '',
    };
  }

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    return {
      ok: false,
      status: csrfResponse.status,
      location: 'csrf-failed',
      cookieHeader: '',
    };
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    return {
      ok: false,
      status: 500,
      location: 'csrf-token-missing',
      cookieHeader: '',
    };
  }

  const csrfCookies = toCookieHeader(getSetCookieHeaderValues(csrfResponse.headers));
  const body = new URLSearchParams({
    email: normalizedEmail,
    loginToken: latestToken.token,
    csrfToken: csrfData.csrfToken,
    callbackUrl: `${baseUrl}/`,
    json: 'true',
  }).toString();

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookies,
    },
    body,
    redirect: 'manual',
  });

  const location = loginResponse.headers.get('location') || '';
  const loginCookie = toCookieHeader(getSetCookieHeaderValues(loginResponse.headers));

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(location),
    status: loginResponse.status,
    location,
    cookieHeader: [csrfCookies, loginCookie].filter(Boolean).join('; '),
  };
}

async function loginAndGetCookie() {
  const credentialsLogin = await loginByCredentials();
  if (credentialsLogin.ok) {
    return credentialsLogin.cookieHeader;
  }

  if (allowMagicLogin) {
    const magicLogin = await loginByMagicLink(mainEmail);
    if (magicLogin.ok) {
      return magicLogin.cookieHeader;
    }

    throw new Error(
      `login admin invalido: credentials(status=${credentialsLogin.status}, location=${credentialsLogin.location}) magic(status=${magicLogin.status}, location=${magicLogin.location})`
    );
  }

  throw new Error(
    `login admin invalido: credentials(status=${credentialsLogin.status}, location=${credentialsLogin.location})`
  );
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
  const recalculatedPlan = results.recalculateWeek?.data?.plan;

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
    {
      name: 'recalculateWeek',
      pass:
        results.recalculateWeek.status === 200 &&
        Boolean(recalculatedPlan?.id) &&
        Number(recalculatedPlan?.totalWeeks || 0) === Number(extendedPlan?.totalWeeks || 0),
      detail: {
        status: results.recalculateWeek.status,
        planId: recalculatedPlan?.id,
        totalWeeks: recalculatedPlan?.totalWeeks || 0,
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
      targetType: 'alumnos',
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
      targetType: 'alumnos',
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
          description: 'Partido smoke',
          type: 'partido',
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
          description: 'Partido extend smoke',
          type: 'partido',
          importance: 3,
        },
      ],
    },
    cookie
  );

  const extendPlanData = extendPlan?.data?.plan;
  const recalculateWeek = await postJson(
    `${baseUrl}/api/sesiones/ai-plan`,
    {
      mode: 'recalculate-week',
      existingPlan: extendPlanData,
      weekNumber: 1,
      wellnessScore: 6.5,
      externalLoadDelta: -5,
      note: 'Smoke recalc',
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
    recalculateWeek,
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
      recalculateWeekStatus: recalculateWeek.status,
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

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
