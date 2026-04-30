const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");

const { loginForSmoke } = require("./utils/smoke-auth");

const prisma = new PrismaClient();

const expectedPath = "/admin/whatsapp";
const screenshotPath =
  process.env.SMOKE_WHATSAPP_ADMIN_UI_SCREENSHOT ||
  path.join(os.tmpdir(), `pf-control-whatsapp-admin-ui-${Date.now()}.png`);

async function ensureParentDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function collectManualTabMarkers(page) {
  const manualTab = page.locator("button").filter({ hasText: /envio\s+manual/i }).first();
  if ((await manualTab.count()) > 0) {
    await manualTab.click();
    await page.waitForTimeout(700);
  }

  return page.evaluate(() => {
    const allText = document.body.innerText || "";
    const buttons = Array.from(document.querySelectorAll("button")).map((button) =>
      (button.textContent || "").replace(/\s+/g, " ").trim()
    );

    const variableChips = Array.from(document.querySelectorAll("span")).map((entry) =>
      (entry.textContent || "").replace(/\s+/g, " ").trim()
    );

    const insertButtons = buttons.filter((label) => /^Insertar \{\{/.test(label));
    const chipVariables = variableChips.filter((label) => /^\{\{[^}]+\}\}\s*=\s*/.test(label));

    return {
      hasInsertButtons: insertButtons.length > 0,
      insertButtons,
      hasVariableChips: chipVariables.length > 0,
      chipVariables,
      hasCheckboxes: document.querySelectorAll('input[type="checkbox"]').length > 0,
      hasManualPanelText:
        allText.includes("Editor de mensaje") || allText.includes("Envio manual") || allText.includes("Enviar"),
    };
  });
}

async function collectHistoryTabMarkers(page) {
  const historyTab = page.locator("button").filter({ hasText: /historial/i }).first();
  if ((await historyTab.count()) === 0) {
    return {
      hasHistoryHeaders: false,
      missingHeaders: ["fecha", "mensaje", "total", "ok", "fallidos"],
      hasHistoryContext: false,
    };
  }

  if ((await historyTab.count()) > 0) {
    await historyTab.click();
    await page.waitForTimeout(700);
  }

  return page.evaluate(() => {
    const allText = (document.body.innerText || "").toLowerCase();
    const requiredHeaders = ["fecha", "mensaje", "total", "ok", "fallidos"];
    const missingHeaders = requiredHeaders.filter((header) => !allText.includes(header));
    const hasHistoryContext =
      allText.includes("historial") ||
      allText.includes("sin historial") ||
      allText.includes("historial de envios");

    return {
      hasHistoryHeaders: missingHeaders.length === 0,
      missingHeaders,
      hasHistoryContext,
    };
  });
}

function toCheck(name, pass, detail) {
  return { name, pass, detail };
}

async function main() {
  const login = await loginForSmoke({ prisma });
  if (!login.ok) {
    throw new Error(`admin login fallo: status=${login.status} location=${login.location}`);
  }

  const baseUrl = login.baseUrl;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    extraHTTPHeaders: {
      Cookie: login.cookieHeader,
    },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}${expectedPath}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);

    const currentUrl = page.url();
    const manual = await collectManualTabMarkers(page);
    const history = await collectHistoryTabMarkers(page);

    await ensureParentDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const checks = [
      toCheck("route", currentUrl.includes(expectedPath), { currentUrl, expectedPath }),
      toCheck("manualVariableControls", manual.hasInsertButtons || manual.hasVariableChips, {
        insertButtonsSample: manual.insertButtons.slice(0, 5),
        variableChipsSample: manual.chipVariables.slice(0, 5),
      }),
      toCheck("manualPanelText", manual.hasManualPanelText, {
        hasManualPanelText: manual.hasManualPanelText,
      }),
      toCheck("historySection", history.hasHistoryHeaders || history.hasHistoryContext, {
        hasHistoryHeaders: history.hasHistoryHeaders,
        hasHistoryContext: history.hasHistoryContext,
        missingHeaders: history.missingHeaders,
      }),
    ];

    const failedChecks = checks.filter((item) => !item.pass).map((item) => item.name);
    const output = {
      ok: failedChecks.length === 0,
      baseUrl,
      auth: {
        responseStatus: login.status,
        location: login.location,
        method: login.method,
      },
      screenshotPath,
      failedChecks,
      checks,
    };

    console.log(JSON.stringify(output, null, 2));

    if (!output.ok) {
      process.exit(1);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error && error.message ? error.message : error),
      },
      null,
      2
    )
  );
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
});
