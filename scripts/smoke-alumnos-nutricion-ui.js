const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const { loginForSmoke } = require("./utils/smoke-auth");

const prisma = new PrismaClient();

const nutritionPath = process.env.SMOKE_ALUMNO_NUTRITION_PATH || "/alumnos/nutricion";
const searchQuery = String(process.env.SMOKE_NUTRITION_QUERY || "banana").trim();
const gramsDraftRaw = String(process.env.SMOKE_NUTRITION_GRAMS || "180").trim();
const manualBarcode = String(process.env.SMOKE_NUTRITION_BARCODE || "5449000000996")
  .replace(/\s+/g, "")
  .trim();

const waitAfterLoadMs = Number.parseInt(String(process.env.SMOKE_NUTRITION_WAIT_AFTER_LOAD_MS || "1300"), 10);
const waitAfterActionMs = Number.parseInt(String(process.env.SMOKE_NUTRITION_WAIT_AFTER_ACTION_MS || "1200"), 10);
const allowCreateFallbackUser = String(process.env.SMOKE_ALUMNO_CREATE_FALLBACK_USER || "").trim() === "1";

const screenshotPath =
  process.env.SMOKE_NUTRITION_SCREENSHOT_PATH ||
  path.join(os.tmpdir(), `pf-control-alumno-nutrition-ui-${Date.now()}.png`);

const fixtureImagePath =
  process.env.SMOKE_NUTRITION_FIXTURE_IMAGE ||
  path.join(os.tmpdir(), "pf-control-nutrition-fixture.png");

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

async function ensureParentDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function ensureFixtureImage(filePath) {
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  await ensureParentDir(filePath);
  await fs.promises.writeFile(filePath, Buffer.from(tinyPngBase64, "base64"));
  return filePath;
}

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

  const email = String(user?.email || "").trim().toLowerCase();
  if (email) {
    return email;
  }

  if (!allowCreateFallbackUser) {
    throw new Error(
      "No hay usuario CLIENTE verificado para smoke. Activa SMOKE_ALUMNO_CREATE_FALLBACK_USER=1 para crear uno tecnico."
    );
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

async function readTokenWithRetry(page) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await page.evaluate(() => window.__pfNutritionSmokeToken || null);
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

function gramsToRegex(rawValue) {
  const numeric = Number.parseFloat(String(rawValue || "0").replace(/,/g, "."));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return /\d+\s*g/i;
  }

  const compact = Number.isInteger(numeric) ? String(Math.trunc(numeric)) : String(numeric);
  const escaped = compact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}(?:\\.0)?\\s*g`, "i");
}

async function main() {
  const clienteEmail = await resolveClienteEmail();
  process.env.SMOKE_MAIN_EMAIL = clienteEmail;
  process.env.SMOKE_MAIN_PASSWORD = "";

  const login = await loginForSmoke({ prisma });
  if (!login.ok) {
    throw new Error(
      `login CLIENTE fallo: email=${clienteEmail} status=${login.status} location=${login.location}`
    );
  }

  const preparedFixtureImage = await ensureFixtureImage(fixtureImagePath);
  const browser = await chromium.launch({ headless: true });
  let context;

  try {
    context = await browser.newContext({
      viewport: { width: 1366, height: 920 },
      extraHTTPHeaders: {
        Cookie: login.cookieHeader,
      },
    });

    const page = await context.newPage();
    const failureReasons = [];
    const interaction = {
      nutritionHeadingFound: false,
      switchedToRegistro: false,
      composerOpened: false,
      searchResultsCount: 0,
      favoriteToggleChanged: false,
      addButtonWorked: false,
      gramsApplied: false,
      barcodeDetected: false,
      barcodePromptHandled: false,
      calIaEstimated: false,
      calIaAdded: false,
      tokenPreserved: false,
    };

    page.on("dialog", async (dialog) => {
      try {
        const message = String(dialog.message() || "");
        const isBarcodePrompt =
          dialog.type() === "prompt" &&
          /codigo de barras|c[oó]digo de barras/i.test(message);

        if (isBarcodePrompt) {
          interaction.barcodePromptHandled = true;
          await dialog.accept(manualBarcode || "5449000000996");
          return;
        }

        await dialog.dismiss();
      } catch {
        // Ignore dialog handling errors and continue the smoke run.
      }
    });

    const initialUrl = `${login.baseUrl}${nutritionPath}`;
    await page.goto(initialUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(Number.isFinite(waitAfterLoadMs) ? waitAfterLoadMs : 1300);

    const loadedPath = await page.evaluate(() => window.location.pathname);
    if (loadedPath !== "/alumnos/nutricion") {
      failureReasons.push(`ruta inicial inesperada: ${loadedPath}`);
    }

    const nutritionHeading = page.locator("h2", { hasText: "Nutrición del alumno" }).first();
    interaction.nutritionHeadingFound = (await nutritionHeading.count()) > 0;
    if (!interaction.nutritionHeadingFound) {
      failureReasons.push("no se encontro encabezado de nutricion del alumno");
    }

    const modeButtons = page.locator(".pf-a3-nutrition-mode-btn");
    const modeButtonsCount = await modeButtons.count();

    if (modeButtonsCount < 2) {
      failureReasons.push("no se encontraron los botones de modo de nutricion");
    } else {
      const registroButton = modeButtons.nth(1);
      await registroButton.scrollIntoViewIfNeeded().catch(() => {});
      await registroButton.click({ force: true });

      await page
        .waitForFunction(() => {
          const buttons = Array.from(document.querySelectorAll(".pf-a3-nutrition-mode-btn"));
          if (buttons.length < 2) {
            return false;
          }

          const registroButtonEl = buttons[1];
          const isRegistroActive = registroButtonEl.classList.contains("is-active");
          const hasDiaryHead = Boolean(document.querySelector(".pf-a4-nutrition-diary-head"));
          return isRegistroActive && hasDiaryHead;
        }, null, { timeout: 12000 })
        .catch(async () => {
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll(".pf-a3-nutrition-mode-btn"));
            const target = buttons[1];
            if (target && target instanceof HTMLElement) {
              target.click();
            }
          });
        });

      await page.waitForTimeout(Number.isFinite(waitAfterActionMs) ? waitAfterActionMs : 1200);
      interaction.switchedToRegistro =
        (await page.locator(".pf-a4-nutrition-diary-head").count()) > 0;

      if (!interaction.switchedToRegistro) {
        failureReasons.push("no se abrio la vista de registro del alumno");
      }
    }

    const tokenBefore = await page.evaluate(() => {
      window.__pfNutritionSmokeToken = Math.random().toString(36).slice(2);
      return window.__pfNutritionSmokeToken;
    });

    const plusButton = page.locator('button[aria-label^="Agregar alimento en"]').first();
    const plusButtonCount = await plusButton.count();

    if (plusButtonCount === 0) {
      failureReasons.push("no se encontro el boton + para agregar alimentos");
    } else {
      await plusButton.click({ force: true });
      await page.waitForTimeout(Number.isFinite(waitAfterActionMs) ? waitAfterActionMs : 1200);

      interaction.composerOpened =
        (await page.locator("p", { hasText: "Carga de alimento" }).count()) > 0;

      if (!interaction.composerOpened) {
        failureReasons.push("el boton + no abrio el composer de alimento");
      }
    }

    const searchInput = page.locator('label:has-text("Buscador de alimentos") input').first();
    const gramsInput = page.locator('label:has-text("Gramaje") input').first();

    if ((await searchInput.count()) === 0) {
      failureReasons.push("no se encontro el input del buscador de alimentos");
    } else {
      await searchInput.fill(searchQuery || "banana");
    }

    if ((await gramsInput.count()) === 0) {
      failureReasons.push("no se encontro el input de gramaje");
    } else {
      await gramsInput.fill(gramsDraftRaw || "180");
    }

    const searchRows = page.locator(".pf-a4-nutrition-search-row");
    try {
      await searchRows.first().waitFor({ state: "visible", timeout: 15000 });
    } catch {
      failureReasons.push("el buscador no devolvio resultados visibles");
    }

    interaction.searchResultsCount = await searchRows.count();

    let firstFoodName = "";
    if (interaction.searchResultsCount > 0) {
      const firstRow = searchRows.first();
      firstFoodName = String(
        (await firstRow.locator(".pf-a4-nutrition-search-name").first().textContent()) || ""
      ).trim();

      const favoriteToggle = firstRow.locator('button[aria-label*="favorito"]').first();
      if ((await favoriteToggle.count()) === 0) {
        failureReasons.push("no se encontro el boton de favorito en resultados");
      } else {
        const beforeLabel = String((await favoriteToggle.getAttribute("aria-label")) || "").trim();
        await favoriteToggle.click({ force: true });
        await page.waitForTimeout(450);
        const afterLabel = String((await favoriteToggle.getAttribute("aria-label")) || "").trim();

        interaction.favoriteToggleChanged = Boolean(beforeLabel && afterLabel && beforeLabel !== afterLabel);
        if (!interaction.favoriteToggleChanged) {
          failureReasons.push("el boton de favorito no cambio de estado tras el click");
        }
      }

      const mealEntriesBefore = await page.locator(".pf-a4-nutrition-meal-entry-row").count();
      const addButton = firstRow.locator("button", { hasText: "Agregar" }).first();

      if ((await addButton.count()) === 0) {
        failureReasons.push("no se encontro el boton Agregar en resultados");
      } else {
        await addButton.click({ force: true });
        await page
          .waitForFunction(
            (beforeCount) => {
              return document.querySelectorAll(".pf-a4-nutrition-meal-entry-row").length > beforeCount;
            },
            mealEntriesBefore,
            { timeout: 12000 }
          )
          .catch(() => {
            failureReasons.push("Agregar no sumo entradas en la comida seleccionada");
          });

        const mealEntriesAfter = await page.locator(".pf-a4-nutrition-meal-entry-row").count();
        interaction.addButtonWorked = mealEntriesAfter > mealEntriesBefore;

        const matchingEntry = page
          .locator(".pf-a4-nutrition-meal-entry-row", { hasText: firstFoodName || searchQuery || "banana" })
          .first();

        if ((await matchingEntry.count()) === 0) {
          failureReasons.push(`no se encontro la entrada agregada para ${firstFoodName || "alimento"}`);
        } else {
          const metaText = String(
            (await matchingEntry.locator(".pf-a4-nutrition-meal-entry-meta").first().textContent()) || ""
          );
          interaction.gramsApplied = gramsToRegex(gramsDraftRaw).test(metaText);

          if (!interaction.gramsApplied) {
            failureReasons.push(
              `la entrada agregada no refleja gramaje esperado (${gramsDraftRaw} g): ${metaText.trim()}`
            );
          }
        }
      }
    }

    const fileInputs = page.locator('input[type="file"][accept="image/*"][capture="environment"]');
    const fileInputsCount = await fileInputs.count();

    if (fileInputsCount < 2) {
      failureReasons.push("no se encontraron los inputs de captura para barcode y CAL IA");
    } else {
      const barcodeInput = fileInputs.nth(0);
      await barcodeInput.setInputFiles(preparedFixtureImage);

      await page
        .locator("p", { hasText: "Producto detectado:" })
        .first()
        .waitFor({ state: "visible", timeout: 20000 })
        .then(() => {
          interaction.barcodeDetected = true;
        })
        .catch(() => {
          failureReasons.push("escanear codigo no llego a estado de producto detectado");
        });

      const calIaInput = fileInputs.nth(1);
      await calIaInput.setInputFiles(preparedFixtureImage);

      await page
        .locator(".pf-a4-nutrition-cal-ia-card")
        .first()
        .waitFor({ state: "visible", timeout: 20000 })
        .then(() => {
          interaction.calIaEstimated = true;
        })
        .catch(() => {
          failureReasons.push("estimador CAL IA no genero una tarjeta de estimacion");
        });

      if (interaction.calIaEstimated) {
        const mealEntriesBeforeCalIa = await page.locator(".pf-a4-nutrition-meal-entry-row").count();
        const addEstimateButton = page.locator("button", { hasText: "Agregar estimación" }).first();

        if ((await addEstimateButton.count()) === 0) {
          failureReasons.push("no se encontro boton Agregar estimacion");
        } else {
          await addEstimateButton.click({ force: true });
          await page
            .waitForFunction(
              (beforeCount) => {
                return document.querySelectorAll(".pf-a4-nutrition-meal-entry-row").length > beforeCount;
              },
              mealEntriesBeforeCalIa,
              { timeout: 12000 }
            )
            .catch(() => {
              failureReasons.push("Agregar estimacion no sumo entrada en la comida");
            });

          const mealEntriesAfterCalIa = await page.locator(".pf-a4-nutrition-meal-entry-row").count();
          interaction.calIaAdded = mealEntriesAfterCalIa > mealEntriesBeforeCalIa;
        }
      }
    }

    const tokenAfter = await readTokenWithRetry(page);
    interaction.tokenPreserved = tokenAfter === tokenBefore;
    if (!interaction.tokenPreserved) {
      failureReasons.push("se detecto recarga completa durante el flujo de nutricion");
    }

    await ensureParentDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const output = {
      ok: failureReasons.length === 0,
      baseUrl: login.baseUrl,
      clienteEmail,
      nutritionPath,
      query: searchQuery,
      gramsDraft: gramsDraftRaw,
      barcodeUsed: manualBarcode,
      auth: {
        responseStatus: login.status,
        location: login.location,
        method: login.method,
      },
      interaction,
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
