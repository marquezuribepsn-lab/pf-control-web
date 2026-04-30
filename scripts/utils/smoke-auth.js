const path = require("node:path");
const { randomBytes } = require("node:crypto");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.production") });

function splitSetCookie(raw) {
  if (!raw) return [];
  return String(raw).split(/,(?=\s*[^;,\s]+=)/g);
}

function getSetCookieValues(headers) {
  if (headers && typeof headers.getSetCookie === "function") {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
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

function normalizeEmail(rawEmail) {
  return String(rawEmail || "").trim().toLowerCase();
}

function resolveSmokeConfig() {
  const fallbackMailbox = String(process.env.SMOKE_MAILBOX_BASE || "marquezuribepsn@gmail.com").trim();
  const baseUrl = String(process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000")
    .trim()
    .replace(/\/+$/, "");
  const adminEmail = normalizeEmail(process.env.SMOKE_MAIN_EMAIL || fallbackMailbox);
  const adminPassword = String(process.env.SMOKE_MAIN_PASSWORD || "");

  if (!adminEmail) {
    throw new Error("No se pudo resolver email admin para ejecutar smokes.");
  }

  return {
    baseUrl,
    adminEmail,
    adminPassword,
  };
}

async function loginByCredentials(config) {
  const { baseUrl, adminEmail, adminPassword } = config;

  if (!adminPassword) {
    return {
      ok: false,
      status: 400,
      location: "missing-password",
      cookieHeader: "",
      method: "credentials",
    };
  }

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo (${csrfResponse.status})`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error("csrf token ausente");
  }

  const csrfCookies = getSetCookieValues(csrfResponse.headers);
  const body = new URLSearchParams({
    email: adminEmail,
    password: adminPassword,
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
    body,
    redirect: "manual",
  });

  const location = loginResponse.headers.get("location") || "";
  const loginCookies = getSetCookieValues(loginResponse.headers);

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(location),
    status: loginResponse.status,
    location,
    cookieHeader: toCookieHeader([...csrfCookies, ...loginCookies]),
    method: "credentials",
  };
}

async function createOneTimeLoginToken(prisma, email) {
  if (!prisma) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const exactUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  let user = exactUser;
  if (!user) {
    const fallbackRows = await prisma.$queryRaw`
      SELECT id, email
      FROM users
      WHERE lower(email) = lower(${normalizedEmail})
      LIMIT 1
    `;

    if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
      user = fallbackRows[0];
    }
  }

  if (!user?.id || !user?.email) {
    return null;
  }

  const token = `login-link-smoke-${randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      email: user.email,
      token,
      expiresAt,
      userId: user.id,
    },
  });

  return {
    token,
    email: user.email,
  };
}

async function loginByOneTimeToken(config, prisma) {
  const { baseUrl, adminEmail } = config;

  const tokenData = await createOneTimeLoginToken(prisma, adminEmail);
  if (!tokenData?.token) {
    return {
      ok: false,
      status: 404,
      location: "token-user-not-found",
      cookieHeader: "",
      method: "login-token",
    };
  }

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo (${csrfResponse.status})`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error("csrf token ausente");
  }

  const csrfCookies = getSetCookieValues(csrfResponse.headers);
  const body = new URLSearchParams({
    email: normalizeEmail(tokenData.email),
    loginToken: tokenData.token,
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
    body,
    redirect: "manual",
  });

  const location = loginResponse.headers.get("location") || "";
  const loginCookies = getSetCookieValues(loginResponse.headers);

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(location),
    status: loginResponse.status,
    location,
    cookieHeader: toCookieHeader([...csrfCookies, ...loginCookies]),
    method: "login-token",
  };
}

async function loginForSmoke(options = {}) {
  const config = resolveSmokeConfig();
  const credentialsLogin = await loginByCredentials(config);
  if (credentialsLogin.ok) {
    return {
      ...credentialsLogin,
      baseUrl: config.baseUrl,
      adminEmail: config.adminEmail,
    };
  }

  if (!options.prisma) {
    return {
      ...credentialsLogin,
      baseUrl: config.baseUrl,
      adminEmail: config.adminEmail,
    };
  }

  const tokenLogin = await loginByOneTimeToken(config, options.prisma);
  if (tokenLogin.ok) {
    return {
      ...tokenLogin,
      baseUrl: config.baseUrl,
      adminEmail: config.adminEmail,
    };
  }

  return {
    ...credentialsLogin,
    baseUrl: config.baseUrl,
    adminEmail: config.adminEmail,
  };
}

module.exports = {
  resolveSmokeConfig,
  loginForSmoke,
  splitSetCookie,
  getSetCookieValues,
  toCookieHeader,
  normalizeEmail,
};
