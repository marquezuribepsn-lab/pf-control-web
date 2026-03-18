const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

async function testForgotPassword(email) {
  const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function testRegister(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
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

  const text = await response.text();
  return { status: response.status, body: text, location: response.headers.get('location') };
}

async function main() {
  const mainEmail = 'marquezuribepsn@gmail.com';
  const mainPassword = 'pfcontrol2026';
  const smokeMailboxBase = process.env.SMOKE_MAILBOX_BASE || 'marquezuribepsn@gmail.com';
  const [mailboxUser, mailboxDomain] = smokeMailboxBase.split('@');
  const registerEmail = `${mailboxUser}+smoke${Date.now()}@${mailboxDomain}`;
  const registerPassword = 'pfcontrol2026';
  const mode = process.argv[2] || 'all';

  if (mode === 'forgot') {
    console.log(JSON.stringify({ forgot: await testForgotPassword(mainEmail) }, null, 2));
    return;
  }

  if (mode === 'register') {
    console.log(JSON.stringify({ register: await testRegister(registerEmail, registerPassword) }, null, 2));
    return;
  }

  if (mode === 'login') {
    console.log(JSON.stringify({ login: await testLogin(mainEmail, mainPassword) }, null, 2));
    return;
  }

  const forgot = await testForgotPassword(mainEmail);
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const register = await testRegister(registerEmail, registerPassword);
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const login = await testLogin(mainEmail, mainPassword);

  console.log(JSON.stringify({ forgot, register, login }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});