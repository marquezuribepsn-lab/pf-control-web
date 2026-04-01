const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'https://pf-control.com';
const email = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const password = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';

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

async function testLogin(targetUrl, userEmail, userPassword) {
  const csrfResponse = await fetch(`${targetUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo: ${csrfResponse.status}`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error('csrf token ausente');
  }

  const csrfCookie = toCookieHeader(getSetCookieHeaderValues(csrfResponse.headers));

  const form = new URLSearchParams({
    email: userEmail,
    password: userPassword,
    csrfToken: csrfData.csrfToken,
    callbackUrl: `${targetUrl}/`,
    json: 'true',
  });

  const response = await fetch(`${targetUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(csrfCookie ? { Cookie: csrfCookie } : {}),
    },
    body: form.toString(),
    redirect: 'manual',
  });

  const location = response.headers.get('location') || '';

  return {
    status: response.status,
    location,
    pass:
      response.status === 302 &&
      !/error=/i.test(location) &&
      /https?:\/\//i.test(location),
  };
}

async function main() {
  const result = await testLogin(baseUrl, email, password);

  const payload = {
    ok: result.pass,
    baseUrl,
    email,
    status: result.status,
    location: result.location,
    checkedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(payload, null, 2));

  if (!payload.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
