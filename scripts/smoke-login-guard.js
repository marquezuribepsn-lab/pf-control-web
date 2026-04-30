const path = require('path');
const { resolveSmokeConfig } = require('./utils/smoke-auth');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const smokeConfig = resolveSmokeConfig();

const baseUrlCandidates = [
  smokeConfig.baseUrl,
  'http://127.0.0.1:3000',
  process.env.NEXTAUTH_URL,
].filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);
const loginEmail = smokeConfig.adminEmail;

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGuardWithBaseUrl(baseUrl) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo: ${csrfResponse.status}`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error('csrf token ausente');
  }

  const csrfCookie = csrfResponse.headers.get('set-cookie') || '';
  const invalidPassword = `invalid-${Date.now()}`;

  const form = new URLSearchParams({
    email: loginEmail,
    password: invalidPassword,
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

  const location = response.headers.get('location') || '';

  if (response.status !== 302) {
    throw new Error(`callback status invalido: ${response.status}`);
  }

  if (/error=Configuration/i.test(location)) {
    throw new Error(`auth configuration error detectado: ${location}`);
  }

  if (!/error=CredentialsSignin/i.test(location)) {
    throw new Error(`respuesta inesperada de auth callback: ${location}`);
  }

  return {
    csrfStatus: csrfResponse.status,
    callbackStatus: response.status,
    callbackLocation: location,
    baseUrl,
  };
}

async function main() {
  let lastError = null;
  let checks = null;

  for (const baseUrl of baseUrlCandidates) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        checks = await runGuardWithBaseUrl(baseUrl);
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 4) {
          await delay(1200 * attempt);
        }
      }
    }

    if (checks) {
      break;
    }
  }

  if (!checks) {
    throw new Error(`login guard fallo: ${String(lastError)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
