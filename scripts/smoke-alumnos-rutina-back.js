const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const { loginForSmoke } = require("./utils/smoke-auth");

const prisma = new PrismaClient();

const fromPath = process.env.SMOKE_ALUMNO_FROM_PATH || "/alumnos/rutina";
const expectedTargetPath = process.env.SMOKE_ALUMNO_BACK_TARGET_PATH || "/alumnos/inicio";
const waitAfterLoadMs = Number.parseInt(String(process.env.SMOKE_ALUMNO_WAIT_AFTER_LOAD_MS || "1200"), 10);
const waitAfterClickMs = Number.parseInt(String(process.env.SMOKE_ALUMNO_WAIT_AFTER_CLICK_MS || "1800"), 10);
const screenshotPath =
  process.env.SMOKE_ALUMNO_SCREENSHOT_PATH ||
  path.join(os.tmpdir(), `pf-control-alumno-rutina-back-${Date.now()}.png`);

async function ensureParentDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function resolveClienteEmail() {
  const user = await prisma.user.findFirst({
    where: {
      role: "CLIENTE",
      emailVerified: true,
      NOT: [
        { estado: "suspendido" },
        { estado: "baja" },
      ],
    },
    select: {
      email: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const email = String(user?.email || "").trim().toLowerCase();
  if (email) {
    return email;
  }

  const smokeEmail = "smoke.alumno@pf-control.local";
  const existingSmokeUser = await prisma.user.findUnique({
    where: { email: smokeEmail },
    select: { id: true },
  });

  if (existingSmokeUser?.id) {
    await prisma.user.update({
      where: { id: existingSmokeUser.id },
      data: {
        role: "CLIENTE",
        estado: "activo",
        emailVerified: true,
        nombreCompleto: "Smoke Alumno",
      },
    });
    return smokeEmail;
  }

  const hashedPassword = await bcrypt.hash("SmokeAlumno123!", 10);

  await prisma.user.create({
    data: {
      email: smokeEmail,
      password: hashedPassword,
      role: "CLIENTE",
      estado: "activo",
      emailVerified: true,
      nombreCompleto: "Smoke Alumno",
    },
  });

  return smokeEmail;
}

async function main() {
  const clienteEmail = await resolveClienteEmail();
  if (!clienteEmail) {
    throw new Error("No se encontro usuario CLIENTE para ejecutar smoke de alumnos.");
  }

  process.env.SMOKE_MAIN_EMAIL = clienteEmail;
  process.env.SMOKE_MAIN_PASSWORD = "";

  const login = await loginForSmoke({ prisma });
  if (!login.ok) {
    throw new Error(
      `login CLIENTE fallo: email=${clienteEmail} status=${login.status} location=${login.location}`
    );
  }

  const browser = await chromium.launch({ headless: true });
  let context;

  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 820 },
      extraHTTPHeaders: {
        Cookie: login.cookieHeader,
      },
    });

    const page = await context.newPage();
    const initialUrl = `${login.baseUrl}${fromPath}`;

    await page.goto(initialUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(Number.isFinite(waitAfterLoadMs) ? waitAfterLoadMs : 1200);

    const loadedPath = await page.evaluate(() => window.location.pathname);
    const failureReasons = [];

    if (!loadedPath.startsWith("/alumnos")) {
      failureReasons.push(`ruta inicial inesperada: ${loadedPath}`);
    }

    const tokenBefore = await page.evaluate(() => {
      window.__pfAlumnoBackSmokeToken = Math.random().toString(36).slice(2);
      return window.__pfAlumnoBackSmokeToken;
    });

    const backButton = page
      .locator('button[aria-label="Volver al inicio"], a[aria-label="Volver al inicio"]')
      .first();
    const backButtonFound = await backButton.count();

    if (backButtonFound === 0) {
      failureReasons.push("no se encontro boton de volver al inicio en rutina");
    } else {
      await backButton.click({ force: true });
      await page.waitForTimeout(Number.isFinite(waitAfterClickMs) ? waitAfterClickMs : 1800);
    }

    const finalUrl = page.url();
    const finalPath = new URL(finalUrl).pathname;
    const finalPathFromWindow = await page.evaluate(() => window.location.pathname);
    const tokenAfter = await page.evaluate(() => window.__pfAlumnoBackSmokeToken || null);
    const tokenPreserved = tokenAfter === tokenBefore;

    if (backButtonFound > 0 && finalPathFromWindow !== expectedTargetPath) {
      failureReasons.push(
        `el boton no navego a ${expectedTargetPath}; ruta final ${finalPathFromWindow}`
      );
    }

    if (!tokenPreserved) {
      failureReasons.push("se detecto recarga completa al usar boton volver (token JS perdido)");
    }

    await ensureParentDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const output = {
      ok: failureReasons.length === 0,
      baseUrl: login.baseUrl,
      clienteEmail,
      fromPath,
      expectedTargetPath,
      auth: {
        responseStatus: login.status,
        location: login.location,
        method: login.method,
      },
      initialUrl,
      loadedPath,
      finalUrl,
      finalPath,
      finalPathFromWindow,
      backButtonFound,
      tokenPreserved,
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
