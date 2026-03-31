const { spawn } = require('child_process');

const baseUrl = process.env.SMOKE_BASE_URL || 'https://pf-control.com';

async function cleanupEmailArtifacts(email) {
  let prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return { ok: true, skipped: true, reason: 'email vacio' };
    }

    const deletedVerificationTokens = await prisma.verificationToken.deleteMany({
      where: { email: normalizedEmail },
    });

    const deletedPasswordResetTokens = await prisma.passwordResetToken.deleteMany({
      where: { email: normalizedEmail },
    });

    const deletedUsers = await prisma.user.deleteMany({
      where: { email: normalizedEmail },
    });

    return {
      ok: true,
      deletedUsers: deletedUsers.count,
      deletedVerificationTokens: deletedVerificationTokens.count,
      deletedPasswordResetTokens: deletedPasswordResetTokens.count,
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error),
    };
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
}

function runCommand(command, args, label) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: false,
      env: {
        ...process.env,
        SMOKE_BASE_URL: baseUrl,
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({ label, code: code ?? 1, stdout, stderr });
    });
  });
}

async function runResetE2E() {
  const tag = Date.now();
  const email = `marquezuribepsn+reset${tag}@gmail.com`;
  const pass = 'Pfcontrol1234';
  const pass2 = 'Pfcontrol5678';

  const post = async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { status: response.status, data };
  };

  const get = async (url) => {
    const response = await fetch(url);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { status: response.status, data };
  };

  const register = await post(`${baseUrl}/api/auth/register`, {
    nombre: 'Reset',
    apellido: 'Smoke',
    fechaNacimiento: '1999-02-02',
    telefono: '+5491112345678',
    email,
    password: pass,
    anamnesis: {
      antecedentesMedicos: 'Sin patologias reportadas',
      lesionesPrevias: 'Sin lesiones recientes',
      objetivoPrincipal: 'Retomar entrenamiento',
    },
  });

  const forgot = await post(`${baseUrl}/api/auth/forgot-password`, { email });
  const token = await get(`${baseUrl}/api/auth/get-reset-token?email=${encodeURIComponent(email)}`);
  const reset = await post(`${baseUrl}/api/auth/reset-password`, {
    token: token.data?.token,
    password: pass2,
  });
  const resetReuse = await post(`${baseUrl}/api/auth/reset-password`, {
    token: token.data?.token,
    password: 'OtroPass123',
  });

  const ok =
    register.status === 201 &&
    forgot.status === 200 &&
    token.status === 200 &&
    Boolean(token.data?.token) &&
    reset.status === 200 &&
    resetReuse.status === 400;

  const summary = {
    ok,
    label: 'resetE2E',
    register: register.status,
    forgot: forgot.status,
    token: token.status,
    reset: reset.status,
    resetReuse: resetReuse.status,
  };

  const cleanup = await cleanupEmailArtifacts(email);
  summary.cleanup = cleanup;

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  console.log(`Running unified auth+mail checks on ${baseUrl}`);

  const checks = [];
  checks.push(await runCommand('node', ['scripts/smoke-auth.js'], 'smoke-auth'));
  checks.push(await runCommand('node', ['scripts/smoke-account-mail-actions.js'], 'smoke-account-mail-actions'));
  checks.push(await runCommand('node', ['scripts/smoke-mail-guard.js'], 'smoke-mail-guard'));
  checks.push(await runCommand('node', ['scripts/smoke-full.js'], 'smoke-full'));
  checks.push(await runCommand('node', ['scripts/smoke-admin-usuarios-redirect.js'], 'smoke-admin-usuarios-redirect'));
  checks.push(await runCommand('node', ['scripts/smoke-password-one-time.js'], 'smoke-password-one-time'));

  const resetResult = await runResetE2E();

  const failed = checks.filter((check) => check.code !== 0).map((check) => check.label);
  if (!resetResult.ok) {
    failed.push('resetE2E');
  }

  const result = {
    ok: failed.length === 0,
    baseUrl,
    failed,
    checks: checks.map((check) => ({ label: check.label, code: check.code })),
    resetE2E: {
      ok: resetResult.ok,
      register: resetResult.register,
      forgot: resetResult.forgot,
      token: resetResult.token,
      reset: resetResult.reset,
      resetReuse: resetResult.resetReuse,
    },
  };

  console.log('\n=== FINAL SUMMARY ===');
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
