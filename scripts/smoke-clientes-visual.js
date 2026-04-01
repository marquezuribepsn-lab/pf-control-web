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
  minRows: parsePositiveIntEnv('SMOKE_CLIENTES_MIN_ROWS', 0),
  minTypeBadgeRows: parsePositiveIntEnv('SMOKE_CLIENTES_MIN_TYPE_BADGE_ROWS', 1),
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

function splitSetCookie(raw) {
  if (!raw) return [];
  return String(raw).split(/,(?=\s*[^;,\s]+=)/g);
}

function getSetCookieValues(headers) {
  if (headers && typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) return values;
  }

  const single = headers?.get?.('set-cookie');
  return single ? splitSetCookie(single) : [];
}

function toCookieHeader(setCookieValues) {
  return (Array.isArray(setCookieValues) ? setCookieValues : [])
    .map((entry) => String(entry || '').split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

async function loginByCredentials(email, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo (${csrfResponse.status})`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error('csrf token ausente');
  }

  const csrfCookies = getSetCookieValues(csrfResponse.headers);
  const body = new URLSearchParams({
    email,
    password,
    csrfToken: csrfData.csrfToken,
    callbackUrl: `${baseUrl}/`,
    json: 'true',
  }).toString();

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: toCookieHeader(csrfCookies),
    },
    body,
    redirect: 'manual',
  });

  const loginLocation = loginResponse.headers.get('location') || '';
  const loginCookies = getSetCookieValues(loginResponse.headers);

  const loginResponseBody = await readResponseTextSafe(loginResponse);

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(loginLocation),
    status: loginResponse.status,
    location: loginLocation,
    body: loginResponseBody,
    cookieHeader: toCookieHeader([...csrfCookies, ...loginCookies]),
  };
}

function collectFailureReasons(summary, currentUrl) {
  const reasons = [];

  if (summary.rowCount === 0) {
    if (!summary.emptyStateVisible) {
      reasons.push('rowCount 0 y no se detecto estado vacio de clientes');
    }
  } else {
    if (summary.rowCount < thresholds.minRows) {
      reasons.push(`rowCount ${summary.rowCount} < ${thresholds.minRows}`);
    }

    if (summary.rowsWithTypeBadge < thresholds.minTypeBadgeRows) {
      reasons.push(`rowsWithTypeBadge ${summary.rowsWithTypeBadge} < ${thresholds.minTypeBadgeRows}`);
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
  let context;
  let page;

  try {
    const login = await loginByCredentials(adminEmail, adminPassword);
    if (!login.ok) {
      throw new Error(`admin login fallo: status=${login.status} location=${login.location}`);
    }

    context = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
      deviceScaleFactor: 1,
      extraHTTPHeaders: {
        Cookie: login.cookieHeader,
      },
    });
    page = await context.newPage();

    await page.goto(`${baseUrl}/clientes`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1800);

    const rows = page.locator('article[data-layout-lock="clientes-row-card"]');

    const summary = await rows.evaluateAll((nodes) => {
      const samples = [];
      let rowsWithTypeBadge = 0;
      let rowsWithAvatar = 0;
      let rowsWithAvatarImage = 0;
      let rowsWithAvatarInitials = 0;
      let rowsOnline = 0;
      let rowsOffline = 0;

      for (const node of nodes) {
        const name = node.querySelector('p.text-sm.font-bold')?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const typeBadge = Array.from(node.querySelectorAll('span'))
          .map((item) => item.textContent?.replace(/\s+/g, ' ').trim() || '')
          .find((text) => /jugadora|alumno/i.test(text)) || '';
        const hasAvatar = Boolean(node.querySelector('div.h-10.w-10.rounded-full'));
        const hasAvatarImage = Boolean(node.querySelector('img'));
        const hasAvatarInitials = hasAvatar;

        if (typeBadge) rowsWithTypeBadge += 1;
        if (/online/i.test(node.textContent || '')) rowsOnline += 1;
        if (/offline/i.test(node.textContent || '')) rowsOffline += 1;

        if (hasAvatar) rowsWithAvatar += 1;
        if (hasAvatarImage) rowsWithAvatarImage += 1;
        if (hasAvatarInitials) rowsWithAvatarInitials += 1;

        if (samples.length < 6) {
          samples.push({
            name,
            typeBadge,
            hasAvatar,
            hasAvatarImage,
            hasAvatarInitials,
          });
        }
      }

      const bodyText = document.body?.textContent?.replace(/\s+/g, ' ').trim() || '';

      return {
        rowCount: nodes.length,
        rowsWithTypeBadge,
        rowsWithAvatar,
        rowsWithAvatarImage,
        rowsWithAvatarInitials,
        rowsOnline,
        rowsOffline,
        emptyStateVisible: /no hay clientes en este apartado/i.test(bodyText),
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
        responseStatus: login.status,
        location: login.location,
        responseBody: login.body,
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
    if (context) {
      await context.close();
    }
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