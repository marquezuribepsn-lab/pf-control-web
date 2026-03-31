const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || "http://127.0.0.1:3000";
const secret = String(process.env.WHATSAPP_AUTOMATION_SECRET || "").trim();
const dryRun = process.argv.includes("--dry-run") || process.env.WHATSAPP_AUTOMATION_DRY_RUN === "1";
const adminEmail = process.env.SMOKE_MAIN_EMAIL || "marquezuribepsn@gmail.com";
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || "pfcontrol2026";

function splitSetCookie(raw) {
  if (!raw) return [];
  return String(raw).split(/,(?=\s*[^;,\s]+=)/g);
}

function getSetCookieValues(headers) {
  if (headers && typeof headers.getSetCookie === "function") {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) return values;
  }

  const single = headers?.get?.("set-cookie");
  return single ? splitSetCookie(single) : [];
}

function toCookieHeader(setCookieValues) {
  return (Array.isArray(setCookieValues) ? setCookieValues : [])
    .map((entry) => String(entry || "").split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function loginByCredentials(email, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`No se pudo obtener CSRF (${csrfResponse.status})`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error("csrf token ausente");
  }

  const csrfCookies = getSetCookieValues(csrfResponse.headers);

  const form = new URLSearchParams({
    email,
    password,
    csrfToken: csrfData.csrfToken,
    callbackUrl: `${baseUrl}/`,
    json: "true",
  }).toString();

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: toCookieHeader(csrfCookies),
    },
    body: form,
    redirect: "manual",
  });

  const location = loginResponse.headers.get("location") || "";
  const loginCookies = getSetCookieValues(loginResponse.headers);
  const cookieHeader = toCookieHeader([...csrfCookies, ...loginCookies]);

  if (loginResponse.status !== 302 || /error=/i.test(location) || !cookieHeader) {
    throw new Error(`Login ADMIN fallo (${loginResponse.status}) ${location}`);
  }

  return cookieHeader;
}

async function main() {
  let cookieHeader = "";
  if (!secret) {
    cookieHeader = await loginByCredentials(adminEmail, adminPassword);
  }

  const response = await fetch(`${baseUrl}/api/whatsapp/automation/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-whatsapp-automation-secret": secret } : {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ dryRun }),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  const output = {
    ok: response.ok,
    baseUrl,
    dryRun,
    authMode: secret ? "secret" : "admin-session",
    status: response.status,
    data,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
