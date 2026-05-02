const path = require("node:path");
const os = require("node:os");
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const { loginForSmoke } = require("./utils/smoke-auth");

const prisma = new PrismaClient();

async function resolveClienteEmail() {
  const user = await prisma.user.findFirst({
    where: {
      role: "CLIENTE",
      emailVerified: true,
      NOT: [{ estado: "suspendido" }, { estado: "baja" }],
    },
    select: { email: true },
    orderBy: { updatedAt: "desc" },
  });
  return String(user?.email || "").trim().toLowerCase();
}

async function findAndTriggerRoutineSwitch(page) {
  const candidates = [
    { type: "week-prev", locator: page.locator('button[aria-label="Semana anterior"]:not([disabled])').first() },
    { type: "week-next", locator: page.locator('button[aria-label="Semana siguiente"]:not([disabled])').first() },
  ];

  for (const candidate of candidates) {
    if ((await candidate.locator.count()) > 0) {
      await candidate.locator.click({ force: true });
      return candidate.type;
    }
  }

  const dayButtons = page.locator('button[aria-label^="Abrir Dia"]:not([disabled])');
  const count = await dayButtons.count();
  if (count > 1) {
    await dayButtons.nth(1).click({ force: true });
    return "day-second";
  }
  if (count > 0) {
    await dayButtons.first().click({ force: true });
    return "day-first";
  }

  throw new Error("No se encontro un control habilitado para cambiar semana o dia");
}

async function run() {
  const output = {
    ok: false,
    baseUrl: process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000",
    loginMethod: null,
    switchAction: null,
    loaderAppeared: false,
    loaderVisibleMs: 0,
    loaderAppearLatencyMs: 0,
    minExpectedMs: 1800,
    screenshotPath: path.join(os.tmpdir(), `pf-rutina-loader-smoke-${Date.now()}.png`),
    error: null,
  };

  const emailOverride = String(process.env.SMOKE_MAIN_EMAIL || "").trim().toLowerCase();
  const resolvedEmail = emailOverride || (await resolveClienteEmail());
  if (!resolvedEmail) {
    throw new Error("No se encontro usuario CLIENTE para smoke");
  }

  process.env.SMOKE_MAIN_EMAIL = resolvedEmail;
  process.env.SMOKE_MAIN_PASSWORD = String(process.env.SMOKE_MAIN_PASSWORD || "");

  const login = await loginForSmoke({ prisma });
  output.loginMethod = login.method;
  output.baseUrl = login.baseUrl;

  if (!login.ok) {
    throw new Error(`Login smoke fallo: status=${login.status} location=${login.location} method=${login.method}`);
  }

  const browser = await chromium.launch({ headless: true });
  let context;

  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 820 },
      extraHTTPHeaders: { Cookie: login.cookieHeader },
    });

    const page = await context.newPage();
    await page.goto(`${login.baseUrl}/alumnos/rutina`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(900);

    const loader = page.getByText("Cargando ejercicios...");

    const clickStart = Date.now();
    output.switchAction = await findAndTriggerRoutineSwitch(page);

    try {
      await loader.waitFor({ state: "visible", timeout: 2500 });
      output.loaderAppeared = true;
      output.loaderAppearLatencyMs = Date.now() - clickStart;

      const visibleStart = Date.now();
      await loader.waitFor({ state: "hidden", timeout: 7000 });
      output.loaderVisibleMs = Date.now() - visibleStart;
    } catch {
      output.loaderAppeared = false;
    }

    await page.screenshot({ path: output.screenshotPath, fullPage: true });

    output.ok = output.loaderAppeared && output.loaderVisibleMs >= output.minExpectedMs;

    console.log(JSON.stringify(output, null, 2));
    if (!output.ok) {
      process.exit(1);
    }
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

run()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
