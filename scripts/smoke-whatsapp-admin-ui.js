const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || "https://pf-control.com";
const adminEmail = process.env.SMOKE_MAIN_EMAIL || "marquezuribepsn@gmail.com";
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || "pfcontrol2026";
const expectedPath = "/admin/whatsapp";
const screenshotPath =
  process.env.SMOKE_WHATSAPP_ADMIN_UI_SCREENSHOT ||
  path.join(os.tmpdir(), `pf-control-whatsapp-admin-ui-${Date.now()}.png`);

async function ensureParentDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function login(page) {
  await page.goto(`${baseUrl}/auth/login`, { waitUntil: "networkidle", timeout: 45000 });

  const emailInput = page.locator('input[type="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  await emailInput.fill(adminEmail);
  await passwordInput.fill(adminPassword);

  const submitByType = page.locator('button[type="submit"]').first();
  const submitByText = page.getByRole("button", { name: /Iniciar sesi.n|Ingresar/i }).first();
  const submit = (await submitByType.count()) > 0 ? submitByType : submitByText;
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 45000 }),
    submit.click(),
  ]);
}

async function collectManualTabMarkers(page) {
  return page.evaluate(() => {
    const allText = document.body.innerText || "";
    const buttons = Array.from(document.querySelectorAll("button")).map((button) =>
      (button.textContent || "").replace(/\s+/g, " ").trim()
    );

    const insertButtons = buttons.filter((label) => /^Insertar \{\{/.test(label));

    return {
      hasInsertButtons: insertButtons.length > 0,
      insertButtons,
      hasCheckboxes: document.querySelectorAll('input[type="checkbox"]').length > 0,
      hasManualPanelText:
        allText.includes("Editor de mensaje") || allText.includes("Envio manual") || allText.includes("Enviar"),
    };
  });
}

async function collectHistoryTabMarkers(page) {
  const historyTab = page.locator("button").filter({ hasText: /hist/i }).first();
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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();

  try {
    await login(page);

    await page.goto(`${baseUrl}${expectedPath}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);

    const currentUrl = page.url();
    const manual = await collectManualTabMarkers(page);
    const history = await collectHistoryTabMarkers(page);

    await ensureParentDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const checks = [
      toCheck("route", currentUrl.includes(expectedPath), { currentUrl, expectedPath }),
      toCheck("manualInsertButtons", manual.hasInsertButtons, {
        sample: manual.insertButtons.slice(0, 5),
      }),
      toCheck("manualCheckboxes", manual.hasCheckboxes, { hasCheckboxes: manual.hasCheckboxes }),
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
        baseUrl,
        error: String(error && error.message ? error.message : error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
