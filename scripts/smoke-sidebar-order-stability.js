const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");

const { loginForSmoke } = require("./utils/smoke-auth");

const prisma = new PrismaClient();

const sidebarPath = process.env.SMOKE_SIDEBAR_PATH || "/categorias";
const requiredHrefs = String(process.env.SMOKE_SIDEBAR_REQUIRED_HREFS || "/categorias,/deportes,/equipos")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const waitAfterLoadMsRaw = Number.parseInt(String(process.env.SMOKE_SIDEBAR_WAIT_AFTER_LOAD_MS || "1000"), 10);
const waitBetweenSnapshotsMsRaw = Number.parseInt(
  String(process.env.SMOKE_SIDEBAR_WAIT_BETWEEN_SNAPSHOTS_MS || "1700"),
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

async function ensureParentDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function collectSidebarSnapshot(page) {
  return page.evaluate(() => {
    const normalizePath = (rawHref) => {
      try {
        const parsed = new URL(rawHref, window.location.origin);
        const pathname = parsed.pathname || "/";
        if (pathname !== "/" && pathname.endsWith("/")) {
          return pathname.slice(0, -1);
        }
        return pathname;
      } catch {
        return String(rawHref || "").trim();
      }
    };

    return Array.from(document.querySelectorAll("aside nav a[href]")).map((anchor) => {
      const rawHref = anchor.getAttribute("href") || "";
      const ariaLabel = anchor.getAttribute("aria-label") || "";
      const textLabel = anchor.textContent || "";

      return {
        href: normalizePath(rawHref),
        label: (ariaLabel || textLabel).replace(/\s+/g, " ").trim(),
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
  if (requiredHrefs.length === 0) {
    throw new Error("SMOKE_SIDEBAR_REQUIRED_HREFS no tiene rutas validas.");
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
    await page.goto(`${baseUrl}${sidebarPath}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("aside nav a[href]", { timeout: 20000 });
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
      (href) =>
        Number.isInteger(initialIndexes[href]) &&
        Number.isInteger(delayedIndexes[href]) &&
        initialIndexes[href] !== delayedIndexes[href]
    );

    const failureReasons = [];
    if (missingRequiredInitial.length > 0) {
      failureReasons.push(`faltan rutas en snapshot inicial: ${missingRequiredInitial.join(", ")}`);
    }

    if (missingRequiredDelayed.length > 0) {
      failureReasons.push(`faltan rutas en snapshot tardio: ${missingRequiredDelayed.join(", ")}`);
    }

    if (orderChanged) {
      failureReasons.push("el orden de links del sidebar cambio entre snapshots");
    }

    if (requiredIndexChanges.length > 0) {
      failureReasons.push(`cambiaron indices de rutas criticas: ${requiredIndexChanges.join(", ")}`);
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
        method: login.method,
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

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
