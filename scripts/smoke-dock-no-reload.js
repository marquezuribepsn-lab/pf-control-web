const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'https://pf-control.com';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';
const dockFromPath = process.env.SMOKE_DOCK_FROM_PATH || '/categorias';
const dockTargetHref = process.env.SMOKE_DOCK_TARGET_HREF || '/deportes';
const dockTargetHrefs = (() => {
  const rawMulti = String(process.env.SMOKE_DOCK_TARGET_HREFS || '').trim();
  if (rawMulti) {
    return rawMulti
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (process.env.SMOKE_DOCK_TARGET_HREF) {
    return [dockTargetHref];
  }

  return ['/deportes', '/equipos'];
})();
const requireRouteChange = String(process.env.SMOKE_DOCK_REQUIRE_ROUTE_CHANGE || '').trim() === '1';
const waitAfterClickMs = Number.parseInt(String(process.env.SMOKE_DOCK_WAIT_AFTER_CLICK_MS || '1800'), 10);
const screenshotPath = process.env.SMOKE_DOCK_SCREENSHOT_PATH || path.join(os.tmpdir(), `pf-control-dock-smoke-${Date.now()}.png`);

function splitSetCookie(raw) {
  if (!raw) return [];
  return String(raw).split(/,(?=\s*[^;,\s]+=)/g);
}

function getSetCookieValues(headers) {
  if (headers && typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
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

async function loginByCredentials() {
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
    email: adminEmail,
    password: adminPassword,
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

  const location = loginResponse.headers.get('location') || '';
  const loginCookies = getSetCookieValues(loginResponse.headers);

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(location),
    status: loginResponse.status,
    location,
    cookieHeader: toCookieHeader([...csrfCookies, ...loginCookies]),
  };
}

async function ensureParentDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error('SMOKE_MAIN_EMAIL y SMOKE_MAIN_PASSWORD son requeridos.');
  }

  if (dockTargetHrefs.length === 0) {
    throw new Error('SMOKE_DOCK_TARGET_HREFS no tiene destinos validos.');
  }

  const login = await loginByCredentials();
  if (!login.ok) {
    throw new Error(`admin login fallo: status=${login.status} location=${login.location}`);
  }

  const browser = await chromium.launch({ headless: true });
  let context;

  try {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: {
        Cookie: login.cookieHeader,
      },
    });

    const page = await context.newPage();
    await page.goto(`${baseUrl}${dockFromPath}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);

    const failureReasons = [];
    const tokenBefore = await page.evaluate(() => {
      window.__pfDockSmokeToken = Math.random().toString(36).slice(2);
      return window.__pfDockSmokeToken;
    });
    const steps = [];

    for (const targetHref of dockTargetHrefs) {
      const stepBeforeUrl = page.url();
      const stepBeforePath = new URL(stepBeforeUrl).pathname;
      const dockLink = page.locator(`nav a[href="${targetHref}"]`).first();
      const dockLinkCount = await dockLink.count();

      if (dockLinkCount === 0) {
        failureReasons.push(`dock link no encontrado: nav a[href="${targetHref}"]`);
        steps.push({
          targetHref,
          found: 0,
          beforeUrl: stepBeforeUrl,
          afterUrl: stepBeforeUrl,
          routeChanged: false,
          tokenPreserved: true,
        });
        continue;
      }

      await dockLink.click({ force: true });
      await page.waitForTimeout(Number.isFinite(waitAfterClickMs) ? waitAfterClickMs : 1800);

      const stepAfterUrl = page.url();
      const stepAfterPath = new URL(stepAfterUrl).pathname;
      const tokenAfter = await page.evaluate(() => window.__pfDockSmokeToken || null);
      const tokenPreserved = tokenAfter === tokenBefore;
      const routeChanged = stepAfterPath !== stepBeforePath;

      if (!tokenPreserved) {
        failureReasons.push(`dock click provoco recarga completa en ${targetHref} (token JS perdido)`);
      }

      if (requireRouteChange && !routeChanged) {
        failureReasons.push(`dock click no cambio ruta en ${targetHref}`);
      }

      steps.push({
        targetHref,
        found: dockLinkCount,
        beforeUrl: stepBeforeUrl,
        afterUrl: stepAfterUrl,
        routeChanged,
        tokenPreserved,
      });
    }

    await ensureParentDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const finalUrl = page.url();
    const tokenAfterAll = await page.evaluate(() => window.__pfDockSmokeToken || null);
    const tokenPreserved = tokenAfterAll === tokenBefore;

    const output = {
      ok: failureReasons.length === 0,
      baseUrl,
      dockFromPath,
      dockTargetHref,
      dockTargetHrefs,
      requireRouteChange,
      auth: {
        responseStatus: login.status,
        location: login.location,
      },
      initialUrl: `${baseUrl}${dockFromPath}`,
      finalUrl,
      tokenPreserved,
      steps,
      screenshotPath,
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
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
