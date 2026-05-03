const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");

const { loginForSmoke } = require("./utils/smoke-auth");

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      role: "CLIENTE",
      emailVerified: true,
      NOT: [{ estado: "suspendido" }, { estado: "baja" }],
    },
    select: { email: true },
    orderBy: { updatedAt: "desc" },
  });

  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) {
    throw new Error("No se encontro usuario CLIENTE para smoke");
  }

  process.env.SMOKE_MAIN_EMAIL = email;
  process.env.SMOKE_MAIN_PASSWORD = "";

  const login = await loginForSmoke({ prisma });
  if (!login.ok) {
    throw new Error(`login fallo status=${login.status} location=${login.location}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    extraHTTPHeaders: {
      Cookie: login.cookieHeader,
    },
  });

  try {
    const page = await context.newPage();
    await page.goto(`${login.baseUrl}/alumnos/rutina`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(2200);

    const trigger = page.locator('button[aria-label^="Registrar cargas de"]').first();
    const triggerCount = await trigger.count();

    if (triggerCount === 0) {
      throw new Error("No se encontro boton para abrir registro de carga");
    }

    await trigger.click({ force: true });
    await page.waitForTimeout(1400);

    const screenshotPath = path.join(process.cwd(), "storage", `tmp-routine-log-modal-${Date.now()}.png`);
    await fs.promises.mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const inspect = await page.evaluate(() => {
      const panel = document.querySelector(".pf-a3-routine-log-panel");
      const pane = document.querySelector(".pf-a3-routine-log-pane");
      const firstField = document.querySelector(".pf-a3-routine-log-field input");
      const tabs = document.querySelector(".pf-a3-routine-log-tabs");

      const toBox = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      };

      const panelStyles = panel ? window.getComputedStyle(panel) : null;
      const paneStyles = pane ? window.getComputedStyle(pane) : null;

      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        panel: toBox(panel),
        pane: toBox(pane),
        firstField: toBox(firstField),
        tabs: toBox(tabs),
        panelStyles: panelStyles
          ? {
              overflowX: panelStyles.overflowX,
              overflowY: panelStyles.overflowY,
              borderTopLeftRadius: panelStyles.borderTopLeftRadius,
              borderTopWidth: panelStyles.borderTopWidth,
              borderRightWidth: panelStyles.borderRightWidth,
              borderBottomWidth: panelStyles.borderBottomWidth,
              borderLeftWidth: panelStyles.borderLeftWidth,
            }
          : null,
        paneStyles: paneStyles
          ? {
              overflow: paneStyles.overflow,
              borderTopWidth: paneStyles.borderTopWidth,
              borderRightWidth: paneStyles.borderRightWidth,
              borderBottomWidth: paneStyles.borderBottomWidth,
              borderLeftWidth: paneStyles.borderLeftWidth,
            }
          : null,
      };
    });

    const output = {
      ok: true,
      email,
      screenshotPath,
      inspect,
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await context.close();
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
