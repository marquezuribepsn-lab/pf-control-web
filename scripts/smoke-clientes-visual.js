const fs = require('fs');
const os = require('os');
const path = require('path');

const { chromium } = require('playwright');

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'https://pf-control.com';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';
const screenshotPath = process.env.SMOKE_SCREENSHOT_PATH || path.join(os.tmpdir(), `pf-control-clientes-visual-${Date.now()}.png`);
const expectedPath = process.env.SMOKE_CLIENTES_EXPECT_PATH || '/clientes';

function parsePositiveIntEnv(name, fallback) {
  const value = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function parseBooleanEnv(name, fallback = false) {
  const value = String(process.env[name] || '').trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

const requireAvatarImage = parseBooleanEnv('SMOKE_CLIENTES_REQUIRE_AVATAR_IMAGE', false);
const requireOnlineRow = parseBooleanEnv('SMOKE_CLIENTES_REQUIRE_ONLINE_ROW', false);
const thresholds = {
  minRows: parsePositiveIntEnv('SMOKE_CLIENTES_MIN_ROWS', 1),
  minAlumnoRows: parsePositiveIntEnv('SMOKE_CLIENTES_MIN_ALUMNO_ROWS', 1),
  minPresenceTextRows: parsePositiveIntEnv('SMOKE_CLIENTES_MIN_PRESENCE_TEXT_ROWS', 1),
  minPresenceDotRows: parsePositiveIntEnv('SMOKE_CLIENTES_MIN_PRESENCE_DOT_ROWS', 1),
  minAvatarRows: parsePositiveIntEnv('SMOKE_CLIENTES_MIN_AVATAR_ROWS', 1),
  minAvatarImages: parsePositiveIntEnv('SMOKE_CLIENTES_MIN_AVATAR_IMAGES', requireAvatarImage ? 1 : 0),
  minOnlineRows: parsePositiveIntEnv('SMOKE_CLIENTES_MIN_ONLINE_ROWS', requireOnlineRow ? 1 : 0),
};

async function ensureParentDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function readResponseTextSafe(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function collectFailureReasons(summary, currentUrl) {
  const reasons = [];

  if (summary.rowCount < thresholds.minRows) {
    reasons.push(`rowCount ${summary.rowCount} < ${thresholds.minRows}`);
  }

  if (summary.alumnoRows < thresholds.minAlumnoRows) {
    reasons.push(`alumnoRows ${summary.alumnoRows} < ${thresholds.minAlumnoRows}`);
  }

  if (summary.rowsWithPresenceText < thresholds.minPresenceTextRows) {
    reasons.push(`rowsWithPresenceText ${summary.rowsWithPresenceText} < ${thresholds.minPresenceTextRows}`);
  }

  if (summary.rowsWithPresenceDot < thresholds.minPresenceDotRows) {
    reasons.push(`rowsWithPresenceDot ${summary.rowsWithPresenceDot} < ${thresholds.minPresenceDotRows}`);
  }

  if (summary.rowsWithAvatar < thresholds.minAvatarRows) {
    reasons.push(`rowsWithAvatar ${summary.rowsWithAvatar} < ${thresholds.minAvatarRows}`);
  }

  if (summary.rowsWithAvatarImage < thresholds.minAvatarImages) {
    reasons.push(`rowsWithAvatarImage ${summary.rowsWithAvatarImage} < ${thresholds.minAvatarImages}`);
  }

  if (summary.rowsOnline < thresholds.minOnlineRows) {
    reasons.push(`rowsOnline ${summary.rowsOnline} < ${thresholds.minOnlineRows}`);
  }

  if (expectedPath && !String(currentUrl || '').includes(expectedPath)) {
    reasons.push(`currentUrl ${currentUrl} does not include ${expectedPath}`);
  }

  return reasons;
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error('SMOKE_MAIN_EMAIL y SMOKE_MAIN_PASSWORD son requeridos para la verificacion visual.');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(800);
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Contraseña').fill(adminPassword);

    const authResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/auth/callback/credentials') && response.request().method() === 'POST',
      { timeout: 45000 }
    );

    await page.getByRole('button', { name: /Iniciar sesión/i }).click();
    const authResponse = await authResponsePromise;
    const authResponseBody = await readResponseTextSafe(authResponse);

    await page.waitForURL((url) => !url.pathname.startsWith('/auth/login') && !url.search.includes('error='), {
      timeout: 45000,
    });

    await page.goto(`${baseUrl}/clientes`, { waitUntil: 'networkidle', timeout: 45000 });

    const rows = page.locator('[data-client-row="true"]');
    await rows.first().waitFor({ state: 'visible', timeout: 30000 });

    const summary = await rows.evaluateAll((nodes) => {
      const samples = [];
      let alumnoRows = 0;
      let rowsWithPresenceText = 0;
      let rowsWithPresenceDot = 0;
      let rowsWithAvatar = 0;
      let rowsWithAvatarImage = 0;
      let rowsWithAvatarInitials = 0;
      let rowsOnline = 0;
      let rowsOffline = 0;

      for (const node of nodes) {
        const type = node.getAttribute('data-client-type') || '';
        const hasAvatar = Boolean(node.querySelector('[data-client-avatar="true"]'));
        const hasAvatarImage = Boolean(node.querySelector('[data-client-avatar-image="true"]'));
        const hasAvatarInitials = Boolean(node.querySelector('[data-client-avatar-initials="true"]'));
        const presenceText = node.querySelector('[data-client-presence-text]')?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const presenceDot = node.querySelector('[data-client-presence-dot]')?.getAttribute('data-client-presence-dot') || '';
        const name = node.querySelector('[data-client-name="true"]')?.textContent?.replace(/\s+/g, ' ').trim() || '';

        if (type === 'alumno') {
          alumnoRows += 1;
          if (presenceText) rowsWithPresenceText += 1;
          if (presenceDot) rowsWithPresenceDot += 1;
          if (presenceDot === 'online') rowsOnline += 1;
          if (presenceDot === 'offline') rowsOffline += 1;
        }

        if (hasAvatar) rowsWithAvatar += 1;
        if (hasAvatarImage) rowsWithAvatarImage += 1;
        if (hasAvatarInitials) rowsWithAvatarInitials += 1;

        if (samples.length < 6) {
          samples.push({
            name,
            type,
            presenceText,
            presenceDot,
            hasAvatar,
            hasAvatarImage,
            hasAvatarInitials,
          });
        }
      }

      return {
        rowCount: nodes.length,
        alumnoRows,
        rowsWithPresenceText,
        rowsWithPresenceDot,
        rowsWithAvatar,
        rowsWithAvatarImage,
        rowsWithAvatarInitials,
        rowsOnline,
        rowsOffline,
        samples,
      };
    });

    await ensureParentDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const failureReasons = collectFailureReasons(summary, page.url());

    const output = {
      ok: failureReasons.length === 0,
      baseUrl,
      thresholds,
      expectedPath,
      auth: {
        responseStatus: authResponse.status(),
        responseBody: authResponseBody,
      },
      screenshotPath,
      currentUrl: page.url(),
      summary,
      failureReasons,
    };

    console.log(JSON.stringify(output, null, 2));

    if (!output.ok) {
      process.exit(1);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        baseUrl,
        error: String(error?.message || error),
        screenshotPath,
      },
      null,
      2
    )
  );
  process.exit(1);
});