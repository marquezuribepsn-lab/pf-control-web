const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");

const { loginForSmoke } = require("./utils/smoke-auth");

const prisma = new PrismaClient();

const dockFromPath = process.env.SMOKE_DOCK_FROM_PATH || "/categorias";
const dockTargetHref = process.env.SMOKE_DOCK_TARGET_HREF || "/deportes";
const dockTargetHrefs = (() => {
  const rawMulti = String(process.env.SMOKE_DOCK_TARGET_HREFS || "").trim();
  if (rawMulti) {
    return rawMulti
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (process.env.SMOKE_DOCK_TARGET_HREF) {
    return [dockTargetHref];
  }

  return ["/deportes", "/equipos"];
})();

const requireRouteChange = String(process.env.SMOKE_DOCK_REQUIRE_ROUTE_CHANGE || "").trim() === "1";
const waitAfterClickMs = Number.parseInt(String(process.env.SMOKE_DOCK_WAIT_AFTER_CLICK_MS || "1800"), 10);
const screenshotPath =
  process.env.SMOKE_DOCK_SCREENSHOT_PATH ||
  path.join(os.tmpdir(), `pf-control-dock-smoke-${Date.now()}.png`);

async function ensureParentDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function readDockToken(page) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await page.evaluate(() => window.__pfDockSmokeToken || null);
    } catch (error) {
      const message = String(error || "");
      const isContextDestroyed = message.includes("Execution context was destroyed");
      const hasMoreAttempts = attempt < maxAttempts;

      if (!isContextDestroyed || !hasMoreAttempts) {
        throw error;
      }

      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(150);
    }
  }

  return null;
}

async function main() {
  if (dockTargetHrefs.length === 0) {
    throw new Error("SMOKE_DOCK_TARGET_HREFS no tiene destinos validos.");
  }

  const login = await loginForSmoke({ prisma });
  if (!login.ok) {
    throw new Error(`admin login fallo: status=${login.status} location=${login.location}`);
  }

  const baseUrl = login.baseUrl;
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
    await page.goto(`${baseUrl}${dockFromPath}`, { waitUntil: "domcontentloaded", timeout: 45000 });
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
        failureReasons.push(`dock link no encontrado: nav a[href=\"${targetHref}\"]`);
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
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});

      const stepAfterUrl = page.url();
      const stepAfterPath = new URL(stepAfterUrl).pathname;
      const tokenAfter = await readDockToken(page);
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
    const tokenAfterAll = await readDockToken(page);
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
        method: login.method,
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

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
