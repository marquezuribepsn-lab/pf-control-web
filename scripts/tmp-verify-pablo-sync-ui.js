const path = require("node:path");
const { randomBytes } = require("node:crypto");

const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const {
  getSetCookieValues,
  loginForSmoke,
  normalizeEmail,
  resolveSmokeConfig,
  toCookieHeader,
} = require("./utils/smoke-auth");

const prisma = new PrismaClient();
const smokeConfig = resolveSmokeConfig();

const baseUrl = smokeConfig.baseUrl;
const alumnoEmail = normalizeEmail(process.env.SMOKE_ALUMNO_EMAIL || "pablo.marquez.mda@gmail.com");

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function toIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

async function createOneTimeLoginToken(email) {
  const normalizedEmail = normalizeEmail(email);

  const exactUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  let user = exactUser;
  if (!user) {
    const fallbackRows = await prisma.$queryRaw`
      SELECT id, email
      FROM users
      WHERE lower(email) = lower(${normalizedEmail})
      LIMIT 1
    `;

    if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
      user = fallbackRows[0];
    }
  }

  if (!user?.id || !user?.email) {
    throw new Error(`No se encontro usuario para ${normalizedEmail}`);
  }

  const token = `login-link-smoke-${randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      email: user.email,
      token,
      expiresAt,
      userId: user.id,
    },
  });

  return {
    email: normalizeEmail(user.email),
    token,
  };
}

async function loginByToken(email) {
  const tokenData = await createOneTimeLoginToken(email);

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`csrf fallo (${csrfResponse.status})`);
  }

  const csrfData = await csrfResponse.json();
  if (!csrfData?.csrfToken) {
    throw new Error("csrf token ausente");
  }

  const csrfCookies = getSetCookieValues(csrfResponse.headers);
  const body = new URLSearchParams({
    email: tokenData.email,
    loginToken: tokenData.token,
    csrfToken: csrfData.csrfToken,
    callbackUrl: `${baseUrl}/`,
    json: "true",
  }).toString();

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: toCookieHeader(csrfCookies),
    },
    body,
    redirect: "manual",
  });

  const location = loginResponse.headers.get("location") || "";
  const loginCookies = getSetCookieValues(loginResponse.headers);

  return {
    ok: loginResponse.status === 302 && !/error=/i.test(location),
    status: loginResponse.status,
    location,
    cookieHeader: toCookieHeader([...csrfCookies, ...loginCookies]),
    method: "login-token",
  };
}

async function resolvePabloContext() {
  const [metaRow, assignmentsRow, plansRow, alumnosRow] = await Promise.all([
    prisma.syncEntry.findUnique({ where: { key: "pf-control-clientes-meta-v1" } }),
    prisma.syncEntry.findUnique({ where: { key: "pf-control-nutricion-asignaciones-v1" } }),
    prisma.syncEntry.findUnique({ where: { key: "pf-control-nutricion-planes-v1" } }),
    prisma.syncEntry.findUnique({ where: { key: "pf-control-alumnos-v1" } }),
  ]);

  const clientesMeta = parseJson(metaRow?.value || "{}", {});
  const assignments = parseJson(assignmentsRow?.value || "[]", []);
  const plans = parseJson(plansRow?.value || "[]", []);
  const alumnos = parseJson(alumnosRow?.value || "[]", []);

  const assignmentMatches = assignments
    .filter((item) => {
      const byEmail = normalizeEmail(item?.alumnoEmail) === alumnoEmail;
      const byName = String(item?.alumnoNombre || "").trim().toLowerCase().includes("pablo");
      return byEmail || byName;
    })
    .sort((a, b) => new Date(b?.assignedAt || 0).getTime() - new Date(a?.assignedAt || 0).getTime());

  const assignment = assignmentMatches[0] || null;
  const assignmentPlan = assignment
    ? plans.find((plan) => String(plan?.id || "") === String(assignment.planId || "")) || null
    : null;

  const metaEntries = Array.isArray(clientesMeta)
    ? clientesMeta.map((value, index) => {
        const inferredId = String(value?.id || value?.clientId || value?.key || `row:${index}`);
        return [inferredId, value];
      })
    : Object.entries(clientesMeta || {});

  const clienteMetaEntry =
    metaEntries.find(([, value]) => {
      const item = value || {};
      return normalizeEmail(item.email) === alumnoEmail;
    }) || null;

  let clientId = clienteMetaEntry?.[0] || "";

  if (!clientId) {
    const alumnoMatch = alumnos.find((item) => {
      const byEmail = normalizeEmail(item?.email) === alumnoEmail;
      const byName = String(item?.nombre || "").trim().toLowerCase().includes("pablo");
      return byEmail || byName;
    });

    if (alumnoMatch?.nombre) {
      clientId = `alumno:${String(alumnoMatch.nombre).trim()}`;
    }
  }

  if (!clientId && assignment?.alumnoNombre) {
    clientId = `alumno:${String(assignment.alumnoNombre).trim()}`;
  }

  return {
    clientId,
    assignment,
    assignmentPlan,
    debug: {
      metaIsArray: Array.isArray(clientesMeta),
      metaEntryCount: metaEntries.length,
      alumnosCount: Array.isArray(alumnos) ? alumnos.length : 0,
      assignmentMatchCount: assignmentMatches.length,
      assignmentAlumnoNombre: String(assignment?.alumnoNombre || ""),
    },
  };
}

async function extractAdminPlanName(page) {
  return page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("p")).filter(
      (node) => node.textContent?.trim().toLowerCase() === "plan asignado"
    );

    for (const label of labels) {
      const container = label.parentElement;
      const nameNode = container?.querySelector("p.text-lg.font-black.text-white");
      const name = nameNode?.textContent?.trim() || "";
      if (name) {
        return name;
      }
    }

    return "";
  });
}

async function extractAlumnoPlanName(page) {
  return page.evaluate(() => {
    const mainHeading = document.querySelector("h2.mt-1.text-xl.font-black.text-white");
    const headingText = mainHeading?.textContent?.trim() || "";
    if (headingText) {
      return headingText;
    }

    const fallback = Array.from(document.querySelectorAll("h2")).find((node) => {
      const text = node.textContent?.trim() || "";
      return text.length > 0 && text.toLowerCase() !== "plan nutricional";
    });

    return fallback?.textContent?.trim() || "";
  });
}

function extractClientIdFromHref(rawHref) {
  const href = String(rawHref || "").trim();
  if (!href) return "";

  if (href.includes("/clientes/ficha/")) {
    const afterFicha = href.split("/clientes/ficha/")[1] || "";
    const encodedClientId = afterFicha.split("/")[0] || "";
    if (!encodedClientId) return "";
    try {
      return decodeURIComponent(encodedClientId);
    } catch {
      return encodedClientId;
    }
  }

  if (href.includes("/clientes/plan?")) {
    const query = href.split("?")[1] || "";
    const params = new URLSearchParams(query);
    return params.get("cliente") || "";
  }

  return "";
}

async function resolveClientIdFromClientesPage(adminCookieHeader) {
  const clientesUrl = `${baseUrl}/clientes`;
  const screenshotPath = path.join("/tmp", `pf-manual-clientes-pablo-${Date.now()}.png`);

  const result = await chromium.launch({ headless: true }).then((browser) =>
    browser
      .newContext({
        viewport: { width: 1600, height: 1200 },
        extraHTTPHeaders: { Cookie: adminCookieHeader },
      })
      .then(async (ctx) => {
        const page = await ctx.newPage();
        await page.goto(clientesUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(2500);

        const discovered = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('article[data-layout-lock="clientes-row-card"]'));

          for (const card of cards) {
            const text = String(card.textContent || "").toLowerCase();
            if (!text.includes("pablo")) continue;

            const link =
              card.querySelector('a[href*="/clientes/ficha/"]') ||
              card.querySelector('a[href*="/clientes/plan?"]');

            if (link) {
              return {
                href: String(link.getAttribute("href") || ""),
                cardText: String(card.textContent || "").replace(/\s+/g, " ").trim(),
              };
            }
          }

          const genericLink = Array.from(document.querySelectorAll('a[href*="/clientes/ficha/"]')).find((node) => {
            const surrounding = String(node.closest("article")?.textContent || "").toLowerCase();
            const ownText = String(node.textContent || "").toLowerCase();
            return surrounding.includes("pablo") || ownText.includes("pablo");
          });

          if (genericLink) {
            const card = genericLink.closest("article");
            return {
              href: String(genericLink.getAttribute("href") || ""),
              cardText: String(card?.textContent || "").replace(/\s+/g, " ").trim(),
            };
          }

          return {
            href: "",
            cardText: "",
          };
        });

        await page.screenshot({ path: screenshotPath, fullPage: true });
        await ctx.close();
        await browser.close();

        return {
          clientesUrl,
          screenshotPath,
          href: discovered.href,
          cardText: discovered.cardText,
          clientId: extractClientIdFromHref(discovered.href),
        };
      })
  );

  return result;
}

async function captureAdminPlanName(clientId, adminCookieHeader) {
  const adminUrl = `${baseUrl}/clientes/plan?cliente=${encodeURIComponent(clientId)}&tab=plan-nutricional`;
  const screenshotPath = path.join("/tmp", `pf-manual-admin-plan-${Date.now()}.png`);

  const context = await chromium.launch({ headless: true }).then((browser) =>
    browser.newContext({
      viewport: { width: 1600, height: 1200 },
      extraHTTPHeaders: { Cookie: adminCookieHeader },
    }).then(async (ctx) => {
      const page = await ctx.newPage();
      await page.goto(adminUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);
      const headingFound = (await page.getByText("Plan nutricional", { exact: false }).count()) > 0;
      const planName = await extractAdminPlanName(page);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await ctx.close();
      await browser.close();

      return {
        url: adminUrl,
        headingFound,
        planName,
        screenshotPath,
      };
    })
  );

  return context;
}

async function captureAlumnoPlanName(alumnoCookieHeader) {
  const alumnoUrl = `${baseUrl}/alumnos/nutricion`;
  const screenshotPath = path.join("/tmp", `pf-manual-alumno-plan-${Date.now()}.png`);

  const context = await chromium.launch({ headless: true }).then((browser) =>
    browser.newContext({
      viewport: { width: 1600, height: 1200 },
      extraHTTPHeaders: { Cookie: alumnoCookieHeader },
    }).then(async (ctx) => {
      const page = await ctx.newPage();
      await page.goto(alumnoUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);
      const headingFound = (await page.getByText("Plan nutricional", { exact: false }).count()) > 0;
      const planName = await extractAlumnoPlanName(page);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await ctx.close();
      await browser.close();

      return {
        url: alumnoUrl,
        headingFound,
        planName,
        screenshotPath,
      };
    })
  );

  return context;
}

async function main() {
  const failures = [];

  const pabloContext = await resolvePabloContext();

  const adminLogin = await loginForSmoke({ prisma });
  if (!adminLogin.ok) {
    throw new Error(`Login admin fallo: status=${adminLogin.status} location=${adminLogin.location}`);
  }

  let resolvedClientId = pabloContext.clientId;
  let clientesLookup = null;

  if (!resolvedClientId) {
    clientesLookup = await resolveClientIdFromClientesPage(adminLogin.cookieHeader);
    resolvedClientId = clientesLookup.clientId;
  }

  if (!resolvedClientId) {
    failures.push("No se pudo resolver clientId de Pablo para abrir ficha/plan.");
  }

  const alumnoLogin = await loginByToken(alumnoEmail);
  if (!alumnoLogin.ok) {
    throw new Error(`Login alumno fallo: status=${alumnoLogin.status} location=${alumnoLogin.location}`);
  }

  const adminView = resolvedClientId
    ? await captureAdminPlanName(resolvedClientId, adminLogin.cookieHeader)
    : {
        url: "",
        headingFound: false,
        planName: "",
        screenshotPath: "",
      };
  const alumnoView = await captureAlumnoPlanName(alumnoLogin.cookieHeader);

  const assignmentPlanName = String(pabloContext.assignmentPlan?.nombre || pabloContext.assignmentPlan?.title || "").trim();
  const assignmentPlanId = String(pabloContext.assignment?.planId || "").trim();
  const adminPlanName = String(adminView.planName || "").trim();
  const alumnoPlanName = String(alumnoView.planName || "").trim();

  if (!adminView.headingFound) failures.push("Admin: no se detecto heading de plan nutricional.");
  if (!alumnoView.headingFound) failures.push("Alumno: no se detecto heading de plan nutricional.");
  if (!adminPlanName) failures.push("Admin: no se pudo leer nombre de plan.");
  if (!alumnoPlanName) failures.push("Alumno: no se pudo leer nombre de plan.");
  if (!assignmentPlanId) failures.push("No se encontro planId asignado para Pablo en sync store.");

  if (assignmentPlanName && adminPlanName && assignmentPlanName !== adminPlanName) {
    failures.push(`Admin muestra '${adminPlanName}' pero asignado es '${assignmentPlanName}'.`);
  }

  if (assignmentPlanName && alumnoPlanName && assignmentPlanName !== alumnoPlanName) {
    failures.push(`Alumno muestra '${alumnoPlanName}' pero asignado es '${assignmentPlanName}'.`);
  }

  if (adminPlanName && alumnoPlanName && adminPlanName !== alumnoPlanName) {
    failures.push(`Admin y Alumno muestran planes distintos: '${adminPlanName}' vs '${alumnoPlanName}'.`);
  }

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        baseUrl,
        alumnoEmail,
        clientId: resolvedClientId,
        assignment: {
          planId: assignmentPlanId,
          planName: assignmentPlanName,
          assignedAt: toIso(pabloContext.assignment?.assignedAt),
        },
        debug: pabloContext.debug,
        clientesLookup,
        adminView,
        alumnoView,
        failures,
      },
      null,
      2
    )
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
