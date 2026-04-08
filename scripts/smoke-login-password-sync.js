const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'https://pf-control.com';
const email = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const originalPassword = process.env.SMOKE_MAIN_PASSWORD || '';
const tempPassword = process.env.SMOKE_TEMP_PASSWORD || `PfSync${Date.now()}!`;

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

async function loginByCredentials(targetUrl, userEmail, userPassword) {
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

  const authCookie = toCookieHeader(getSetCookieHeaderValues(response.headers));
  const combinedCookie = [csrfCookie, authCookie].filter(Boolean).join('; ');
  const location = response.headers.get('location') || '';

  return {
    status: response.status,
    location,
    cookie: combinedCookie,
    pass:
      response.status === 302 &&
      !/error=/i.test(location) &&
      /https?:\/\//i.test(location),
  };
}

async function patchAccount(sessionCookie, body) {
  const response = await fetch(`${baseUrl}/api/account`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    body: JSON.stringify(body),
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
  };
}

async function tryRollback() {
  try {
    const tempLogin = await loginByCredentials(baseUrl, email, tempPassword);
    if (!tempLogin.pass || !tempLogin.cookie) {
      return {
        ok: false,
        reason: 'No se pudo autenticar con la password temporal para rollback',
        tempLogin,
      };
    }

    const rollbackPatch = await patchAccount(tempLogin.cookie, {
      email,
      currentPassword: tempPassword,
      newPassword: originalPassword,
    });

    if (rollbackPatch.status !== 200) {
      return {
        ok: false,
        reason: 'PATCH de rollback no retorno 200',
        rollbackPatch,
      };
    }

    const finalLogin = await loginByCredentials(baseUrl, email, originalPassword);
    return {
      ok: finalLogin.pass,
      reason: finalLogin.pass ? 'rollback aplicado' : 'rollback aplicado pero login final fallo',
      finalLogin,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function pushCheck(checks, name, pass, detail) {
  checks.push({ name, pass, detail });
}

async function main() {
  if (!originalPassword) {
    const output = {
      ok: true,
      skipped: true,
      reason: 'SMOKE_MAIN_PASSWORD no configurado; se omite prueba de sincronizacion de password.',
      baseUrl,
      email,
    };

    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const checks = [];
  let changed = false;
  let restored = false;

  try {
    const loginOriginal = await loginByCredentials(baseUrl, email, originalPassword);
    pushCheck(checks, 'loginOriginalPassword', loginOriginal.pass, {
      status: loginOriginal.status,
      location: loginOriginal.location,
    });

    if (!loginOriginal.pass || !loginOriginal.cookie) {
      throw new Error('No se pudo autenticar con la password original');
    }

    const changePatch = await patchAccount(loginOriginal.cookie, {
      email,
      currentPassword: originalPassword,
      newPassword: tempPassword,
    });

    const changePassOk = changePatch.status === 200;
    pushCheck(checks, 'patchChangePassword', changePassOk, {
      status: changePatch.status,
      data: changePatch.data,
    });

    if (!changePassOk) {
      throw new Error('No se pudo cambiar la password a temporal');
    }

    changed = true;

    const loginTemp = await loginByCredentials(baseUrl, email, tempPassword);
    pushCheck(checks, 'loginTemporaryPassword', loginTemp.pass, {
      status: loginTemp.status,
      location: loginTemp.location,
    });

    const loginOldAfterChange = await loginByCredentials(baseUrl, email, originalPassword);
    const oldShouldFail =
      loginOldAfterChange.status === 302 && /error=/i.test(String(loginOldAfterChange.location || ''));
    pushCheck(checks, 'oldPasswordRejectedAfterChange', oldShouldFail, {
      status: loginOldAfterChange.status,
      location: loginOldAfterChange.location,
    });

    if (!loginTemp.pass || !loginTemp.cookie) {
      throw new Error('No se pudo autenticar con la password temporal');
    }

    const restorePatch = await patchAccount(loginTemp.cookie, {
      email,
      currentPassword: tempPassword,
      newPassword: originalPassword,
    });

    const restorePatchOk = restorePatch.status === 200;
    pushCheck(checks, 'patchRestoreOriginalPassword', restorePatchOk, {
      status: restorePatch.status,
      data: restorePatch.data,
    });

    if (!restorePatchOk) {
      throw new Error('No se pudo restaurar la password original');
    }

    const loginRestored = await loginByCredentials(baseUrl, email, originalPassword);
    pushCheck(checks, 'loginRestoredOriginalPassword', loginRestored.pass, {
      status: loginRestored.status,
      location: loginRestored.location,
    });

    restored = Boolean(loginRestored.pass);
  } finally {
    if (changed && !restored) {
      const rollback = await tryRollback();
      pushCheck(checks, 'rollbackRecoveryAttempt', rollback.ok, rollback);
      restored = rollback.ok;
    }
  }

  const failedChecks = checks.filter((item) => !item.pass).map((item) => item.name);
  const output = {
    ok: failedChecks.length === 0,
    baseUrl,
    email,
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
