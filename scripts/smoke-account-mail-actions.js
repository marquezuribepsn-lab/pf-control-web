const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'https://pf-control.com';
const smokeMailboxBase = process.env.SMOKE_MAILBOX_BASE || 'marquezuribepsn@gmail.com';

function makeAlias(prefix) {
  const [user, domain] = String(smokeMailboxBase).split('@');
  return `${user}+${prefix}${Date.now()}@${domain}`;
}

async function postJson(url, body, extraHeaders = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = { raw: await response.text() };
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
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

  const loginCookie = response.headers.get('set-cookie') || '';
  const combinedCookie = [csrfCookie, loginCookie].filter(Boolean).join('; ');

  return {
    status: response.status,
    location: response.headers.get('location'),
    cookie: combinedCookie,
  };
}

async function postWithCookie(url, cookie) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Cookie: cookie },
  });

  const text = await response.text();
  return {
    status: response.status,
    body: text,
  };
}

async function patchAccount(cookie, body) {
  const response = await fetch(`${baseUrl}/api/account`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  return {
    status: response.status,
    body: text,
  };
}

async function triggerForgotPassword(email) {
  const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  const body = await response.text();
  return {
    status: response.status,
    body,
  };
}

async function main() {
  const password = 'Pfcontrol1234';
  const createdEmail = makeAlias('acct');
  const changedEmail = makeAlias('acctchg');

  const register = await postJson(`${baseUrl}/api/auth/register`, {
    email: createdEmail,
    password,
  });

  const login = await testLogin(createdEmail, password);
  const forgotPassword = await triggerForgotPassword(createdEmail);
  const verifyWithoutAuth = await postWithCookie(`${baseUrl}/api/account/verify`, '');
  const accountPatchWithoutAuth = await patchAccount('', {
    email: changedEmail,
    currentPassword: password,
    newPassword: '',
  });

  const checks = [
    {
      name: 'register',
      pass: register.status === 201,
      detail: { status: register.status, data: register.data },
    },
    {
      name: 'loginNewUser',
      pass:
        login.status === 302 &&
        String(login.location || '').includes('/auth/login?error=CredentialsSignin'),
      detail: { status: login.status, location: login.location },
    },
    {
      name: 'forgotPasswordMailTrigger',
      pass: forgotPassword.status === 200,
      detail: forgotPassword,
    },
    {
      name: 'accountVerifyRequiresAuth',
      pass: verifyWithoutAuth.status === 401,
      detail: verifyWithoutAuth,
    },
    {
      name: 'accountPatchRequiresAuth',
      pass: accountPatchWithoutAuth.status === 401,
      detail: accountPatchWithoutAuth,
    },
  ];

  const failedChecks = checks.filter((item) => !item.pass).map((item) => item.name);
  const output = {
    ok: failedChecks.length === 0,
    failedChecks,
    checks,
    emails: {
      createdEmail,
      changedEmail,
    },
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
