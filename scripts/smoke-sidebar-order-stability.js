const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'https://pf-control.com';
const adminEmail = process.env.SMOKE_MAIN_EMAIL || 'marquezuribepsn@gmail.com';
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || 'pfcontrol2026';
const sidebarPath = process.env.SMOKE_SIDEBAR_PATH || '/categorias';
const requiredHrefs = String(process.env.SMOKE_SIDEBAR_REQUIRED_HREFS || '/categorias,/deportes,/equipos')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const waitAfterLoadMsRaw = Number.parseInt(String(process.env.SMOKE_SIDEBAR_WAIT_AFTER_LOAD_MS || '1000'), 10);
const waitBetweenSnapshotsMsRaw = Number.parseInt(
  String(process.env.SMOKE_SIDEBAR_WAIT_BETWEEN_SNAPSHOTS_MS || '1700'),
  10
);

const waitAfterLoadMs = Number.isFinite(waitAfterLoadMsRaw) && waitAfterLoadMsRaw >= 0 ? waitAfterLoadMsRaw : 1000;
const waitBetweenSnapshotsMs =
  Number.isFinite(waitBetweenSnapshotsMsRaw) && waitBetweenSnapshotsMsRaw >= 0
    ? waitBetweenSnapshotsMsRaw
    : 1700;

const screenshotPath =
  process.env.SMOKE_SIDEBAR_SCREENSHOT_PATH ||
  path.join(os.tmpdir(), `pf-control-sidebar-order-smoke-${Date.now()}.png`);

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

async function collectSidebarSnapshot(page) {
  return page.evaluate(() => {
    const normalizePath = (rawHref) => {
      try {
        const parsed = new URL(rawHref, window.location.origin);
        const pathname = parsed.pathname || '/';
        if (pathname !== '/' && pathname.endsWith('/')) {
          return pathname.slice(0, -1);
        }
        return pathname;
      } catch {
        return String(rawHref || '').trim();
      }
    };

    return Array.from(document.querySelectorAll('aside nav a[href]')).map((anchor) => {
      const rawHref = anchor.getAttribute('href') || '';
      const ariaLabel = anchor.getAttribute('aria-label') || '';
      const textLabel = anchor.textContent || '';

      return {
        href: normalizePath(rawHref),
        label: (ariaLabel || textLabel).replace(/\s+/g, ' ').trim(),
      };
    });
  });
}

function indexMap(hrefs) {
  return hrefs.reduce((acc, href, index) => {
    if (!(href in acc)) {
      acc[href] = index;
    }
    return acc;
  }, {});
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error('SMOKE_MAIN_EMAIL y SMOKE_MAIN_PASSWORD son requeridos.');
  }

  if (requiredHrefs.length === 0) {
    throw new Error('SMOKE_SIDEBAR_REQUIRED_HREFS no tiene rutas validas.');
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
    await page.goto(`${baseUrl}${sidebarPath}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('aside nav a[href]', { timeout: 20000 });
    await page.waitForTimeout(waitAfterLoadMs);

    const initialSnapshot = await collectSidebarSnapshot(page);
    await page.waitForTimeout(waitBetweenSnapshotsMs);
    const delayedSnapshot = await collectSidebarSnapshot(page);

    const initialOrder = initialSnapshot.map((item) => item.href);
    const delayedOrder = delayedSnapshot.map((item) => item.href);

    const initialIndexes = indexMap(initialOrder);
    const delayedIndexes = indexMap(delayedOrder);

    const missingRequiredInitial = requiredHrefs.filter((href) => !initialOrder.includes(href));
    const missingRequiredDelayed = requiredHrefs.filter((href) => !delayedOrder.includes(href));
    const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(delayedOrder);
    const requiredIndexChanges = requiredHrefs.filter(
      (href) => Number.isInteger(initialIndexes[href]) && Number.isInteger(delayedIndexes[href]) && initialIndexes[href] !== delayedIndexes[href]
    );

    const failureReasons = [];
    if (missingRequiredInitial.length > 0) {
      failureReasons.push(`faltan rutas en snapshot inicial: ${missingRequiredInitial.join(', ')}`);
    }

    if (missingRequiredDelayed.length > 0) {
      failureReasons.push(`faltan rutas en snapshot tardio: ${missingRequiredDelayed.join(', ')}`);
    }

    if (orderChanged) {
      failureReasons.push('el orden de links del sidebar cambio entre snapshots');
    }

    if (requiredIndexChanges.length > 0) {
      failureReasons.push(`cambiaron indices de rutas criticas: ${requiredIndexChanges.join(', ')}`);
    }

    await ensureParentDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const output = {
      ok: failureReasons.length === 0,
      baseUrl,
      sidebarPath,
      requiredHrefs,
      waitAfterLoadMs,
      waitBetweenSnapshotsMs,
      auth: {
        responseStatus: login.status,
        location: login.location,
      },
      initialSnapshot: {
        count: initialSnapshot.length,
        links: initialSnapshot,
      },
      delayedSnapshot: {
        count: delayedSnapshot.length,
        links: delayedSnapshot,
      },
      orderChanged,
      requiredIndexChanges,
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