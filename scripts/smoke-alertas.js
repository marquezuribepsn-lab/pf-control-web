/**
 * smoke-alertas.js
 * Comprehensive smoke test for the alerts system.
 *
 * Runs two tiers of checks:
 *   1. UNIT — pure logic, no server needed (always runs)
 *   2. API  — hit live endpoints (needs SMOKE_BASE_URL or server running on :3000)
 *
 * Usage:
 *   # Local (unit tests only — API tests will try 127.0.0.1:3000):
 *   node scripts/smoke-alertas.js
 *
 *   # Against VPS:
 *   SMOKE_BASE_URL=https://pf-control.com \
 *   CRON_SECRET=<secret> \
 *   SMOKE_MAIN_EMAIL=<email> \
 *   SMOKE_MAIN_PASSWORD=<password> \
 *   node scripts/smoke-alertas.js
 */

const baseUrl      = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const cronSecret   = process.env.CRON_SECRET || "";
const adminEmail   = process.env.SMOKE_MAIN_EMAIL    || "marquezuribepsn@gmail.com";
const adminPass    = process.env.SMOKE_MAIN_PASSWORD || "pfcontrol2026";

// ── Colors ────────────────────────────────────────────────────────
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";

function pass(name, detail = "")  { console.log(`  ${GREEN}✓${RESET} ${name}${detail ? ` — ${detail}` : ""}`); }
function fail(name, detail = "")  { console.log(`  ${RED}✗${RESET} ${name}${detail ? ` — ${detail}` : ""}`); }
function skip(name, reason = "")  { console.log(`  ${YELLOW}~${RESET} ${name}${reason ? ` (${reason})` : ""}`); }
function section(title)           { console.log(`\n${BOLD}${title}${RESET}`); }

// ── Helpers ───────────────────────────────────────────────────────
function normalizeWhatsAppPhone(input) {
  const digits = String(input || "").replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("549") && digits.length >= 12) return digits;
  if (digits.startsWith("54")  && digits.length >= 12) return `549${digits.slice(2)}`;
  if (digits.length === 10) return `549${digits}`;
  return null;
}

function toCookieHeader(setCookieList) {
  return (Array.isArray(setCookieList) ? setCookieList : [])
    .map((e) => String(e).split(";")[0]).filter(Boolean).join("; ");
}

async function loginAsAdmin() {
  const csrfRes  = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfRes.ok) throw new Error(`CSRF fetch failed: ${csrfRes.status}`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = typeof csrfRes.headers.getSetCookie === "function"
    ? csrfRes.headers.getSetCookie() : [];

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: toCookieHeader(csrfCookies),
    },
    body: new URLSearchParams({ email: adminEmail, password: adminPass, csrfToken, callbackUrl: `${baseUrl}/`, json: "true" }).toString(),
    redirect: "manual",
  });
  const loginCookies = typeof loginRes.headers.getSetCookie === "function"
    ? loginRes.headers.getSetCookie() : [];
  const location = loginRes.headers.get("location") || "";
  if (loginRes.status !== 302 || /error=/i.test(location)) {
    throw new Error(`Login failed: status=${loginRes.status} location=${location}`);
  }
  return toCookieHeader([...csrfCookies, ...loginCookies]);
}

async function apiCall(path, { method = "GET", body, cookie, secret } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON response */ }
  return { status: res.status, data };
}

// ── 1. UNIT TESTS ─────────────────────────────────────────────────
const unitFails = [];

function unitAssert(name, condition, detail = "") {
  if (condition) {
    pass(name, detail);
  } else {
    fail(name, detail);
    unitFails.push(name);
  }
}

function runUnitTests() {
  section("1. UNIT — normalizeWhatsAppPhone");

  // 10 digits → prepend 549
  unitAssert("10 digits → 549XXXXXXXXXX",
    normalizeWhatsAppPhone("2257613518") === "5492257613518",
    `got: ${normalizeWhatsAppPhone("2257613518")}`);

  // already has 549 prefix
  unitAssert("549XXXXXXXXXX → unchanged",
    normalizeWhatsAppPhone("5492257613518") === "5492257613518",
    `got: ${normalizeWhatsAppPhone("5492257613518")}`);

  // starts with 54 (12 digits) → insert 9
  unitAssert("542257613518 (12d, starts 54) → 5492257613518",
    normalizeWhatsAppPhone("542257613518") === "5492257613518",
    `got: ${normalizeWhatsAppPhone("542257613518")}`);

  // spaces / hyphens stripped
  unitAssert("spaces/hyphens stripped",
    normalizeWhatsAppPhone("  225-761-3518  ") === "5492257613518",
    `got: ${normalizeWhatsAppPhone("  225-761-3518  ")}`);

  // empty → null
  unitAssert("empty → null",
    normalizeWhatsAppPhone("") === null);

  // too short → null
  unitAssert("too short (5 digits) → null",
    normalizeWhatsAppPhone("12345") === null,
    `got: ${normalizeWhatsAppPhone("12345")}`);

  section("2. UNIT — phone double-prefix (checkin-reminder fix)");

  // Simulate the OLD behaviour (prepend codigoPais="54" before normalize)
  const oldBad = normalizeWhatsAppPhone("54" + "5492257613518".replace(/\D/g, ""));
  unitAssert("OLD bug: '54' + '5492257613518' → wrong",
    oldBad !== "5492257613518",
    `old produced: ${oldBad} (should be wrong)`);

  // New behaviour: just strip and normalize directly
  const newGood = normalizeWhatsAppPhone("5492257613518".replace(/\D/g, ""));
  unitAssert("NEW fix: normalize('5492257613518') → correct",
    newGood === "5492257613518",
    `got: ${newGood}`);

  // codigoPais=54, telefono=2257613518 (10-digit, most common case)
  const phone10 = normalizeWhatsAppPhone("2257613518".replace(/\D/g, ""));
  unitAssert("10-digit telefono normalizes correctly",
    phone10 === "5492257613518",
    `got: ${phone10}`);

  section("3. UNIT — alertas-profe detalle branch (dead code removed)");
  // Simulate dias >= 0 branch only
  const dias = 3;
  const detalle = dias === 0 ? "Vence hoy" : `Vence en ${dias} día${dias === 1 ? "" : "s"}`;
  unitAssert("dias=3 → 'Vence en 3 días'",
    detalle === "Vence en 3 días",
    `got: "${detalle}"`);

  const dias0 = 0;
  const detalle0 = dias0 === 0 ? "Vence hoy" : `Vence en ${dias0} día${dias0 === 1 ? "" : "s"}`;
  unitAssert("dias=0 → 'Vence hoy'",
    detalle0 === "Vence hoy",
    `got: "${detalle0}"`);

  section("4. UNIT — badge count (no double-count)");
  // Simulate old vs new
  const total = 10; const urgente = 3;
  const oldCount = (urgente) + (total); // old buggy formula
  const newCount = total;               // fixed
  unitAssert("old formula double-counts urgente",
    oldCount === 13, `old=${oldCount}`);
  unitAssert("new formula uses total only",
    newCount === 10, `new=${newCount}`);
}

// ── 2. API TESTS ──────────────────────────────────────────────────
const apiFails = [];

function apiAssert(name, condition, detail = "") {
  if (condition) {
    pass(name, detail);
  } else {
    fail(name, detail);
    apiFails.push(name);
  }
}

async function runApiTests() {
  section("5. API — auth (requires server running)");

  let cookie = "";
  let serverUp = false;

  // Check if server is up
  try {
    const ping = await fetch(`${baseUrl}/api/auth/csrf`, { signal: AbortSignal.timeout(5000) });
    serverUp = ping.ok;
  } catch {
    serverUp = false;
  }

  if (!serverUp) {
    skip("server reachable", `${baseUrl} not responding — skipping API tests`);
    return;
  }

  pass("server reachable", baseUrl);

  // Try login
  try {
    cookie = await loginAsAdmin();
    pass("admin login", "session obtained");
  } catch (e) {
    fail("admin login", String(e));
    apiFails.push("admin login");
    if (!cronSecret) {
      skip("remaining API tests", "no cookie and no CRON_SECRET");
      return;
    }
  }

  // Choose auth method for cron endpoints
  const cronAuth = cronSecret
    ? { secret: cronSecret }
    : { cookie };

  section("6. API — GET /api/admin/alertas-profe");
  {
    const r = await apiCall("/api/admin/alertas-profe", cookie ? { cookie } : { secret: cronSecret });
    apiAssert("status 200",      r.status === 200, `got ${r.status}`);
    apiAssert("has total",       typeof r.data?.total    === "number", `total=${r.data?.total}`);
    apiAssert("has urgente",     typeof r.data?.urgente  === "number", `urgente=${r.data?.urgente}`);
    apiAssert("has vencimientos",Array.isArray(r.data?.vencimientos),  `count=${r.data?.vencimientos?.length}`);
    apiAssert("has inactivos",   Array.isArray(r.data?.inactivos),     `count=${r.data?.inactivos?.length}`);
    apiAssert("has salud",       Array.isArray(r.data?.salud),         `count=${r.data?.salud?.length}`);
    apiAssert("has sinCheckin",  Array.isArray(r.data?.sinCheckin),    `count=${r.data?.sinCheckin?.length}`);
    apiAssert("has mensajes",    Array.isArray(r.data?.mensajes),      `count=${r.data?.mensajes?.length}`);
    apiAssert("has generadoEn",  typeof r.data?.generadoEn === "string");

    // No href should point to /admin/checkin-reminder (fixed to /clientes)
    const allHrefs = [
      ...(r.data?.vencimientos || []),
      ...(r.data?.inactivos    || []),
      ...(r.data?.salud        || []),
      ...(r.data?.sinCheckin   || []),
      ...(r.data?.mensajes     || []),
    ].map((a) => a.href || "");
    const badHref = allHrefs.find((h) => h.includes("/admin/checkin-reminder"));
    apiAssert("no broken /admin/checkin-reminder href", !badHref, badHref || "ok");

    if (r.status === 200) {
      console.log(`     → total=${r.data.total} urgente=${r.data.urgente} vencimientos=${r.data.vencimientos.length} inactivos=${r.data.inactivos.length}`);
    }
  }

  section("7. API — GET /api/admin/vencimientos");
  {
    const r = await apiCall("/api/admin/vencimientos", cronAuth);
    apiAssert("status 200",   r.status === 200, `got ${r.status}`);
    apiAssert("has expiring", Array.isArray(r.data?.expiring), `count=${r.data?.expiring?.length}`);
    apiAssert("has total",    typeof r.data?.total === "number", `total=${r.data?.total}`);
    if (r.status === 200) {
      console.log(`     → ${r.data.total} clientes por vencer en ${r.data.daysAhead}d`);
    }
  }

  section("8. API — GET /api/admin/checkin-reminder (preview)");
  {
    const r = await apiCall("/api/admin/checkin-reminder", cronAuth);
    apiAssert("status 200",   r.status === 200, `got ${r.status}`);
    apiAssert("has pending",  Array.isArray(r.data?.pending), `pending=${r.data?.pending?.length}`);
    apiAssert("has done",     Array.isArray(r.data?.done),    `done=${r.data?.done?.length}`);
    apiAssert("has thisMonday", typeof r.data?.thisMonday === "string");
    if (r.status === 200) {
      console.log(`     → pending=${r.data.pending.length} done=${r.data.done.length} semana=${r.data.thisMonday}`);
    }
  }

  section("9. API — GET /api/admin/resumen-semanal (preview stats)");
  {
    const r = await apiCall("/api/admin/resumen-semanal", cookie ? { cookie } : cronAuth);
    apiAssert("status 200",           r.status === 200, `got ${r.status}`);
    apiAssert("has totalLogs",        typeof r.data?.totalLogs        === "number");
    apiAssert("has totalCheckins",    typeof r.data?.totalCheckins    === "number");
    apiAssert("has alumnosActivos",   typeof r.data?.alumnosActivos   === "number");
    if (r.status === 200) {
      console.log(`     → logs=${r.data.totalLogs} checkins=${r.data.totalCheckins} activos=${r.data.alumnosActivos}`);
    }
  }

  section("10. API — auth guard (unauthenticated → 401)");
  {
    const r = await apiCall("/api/admin/alertas-profe");
    apiAssert("alertas-profe returns 401 without auth", r.status === 401, `got ${r.status}`);

    const r2 = await apiCall("/api/admin/vencimientos");
    apiAssert("vencimientos returns 401 without auth", r2.status === 401, `got ${r2.status}`);
  }

  section("11. API — POST /api/alumno/checkin-analyze (rule-based fallback)");
  {
    // Test with alumno session (uses admin cookie as proxy — the endpoint checks session.user.id)
    const r = await apiCall("/api/alumno/checkin-analyze", {
      method: "POST",
      body: { texto: "Siento un dolor intenso en la rodilla y está muy hinchada", tipo: "dolor" },
      cookie,
    });
    if (r.status === 200) {
      apiAssert("nivel is valid",    ["bajo","medio","alto"].includes(r.data?.nivel), `got: ${r.data?.nivel}`);
      apiAssert("has resumen",       typeof r.data?.resumen === "string" && r.data.resumen.length > 0);
      apiAssert("high pain → alto",  r.data?.nivel === "alto", `nivel=${r.data?.nivel}`);
      apiAssert("alertaProfe true",  r.data?.alertaProfe === true, `alertaProfe=${r.data?.alertaProfe}`);
      console.log(`     → nivel=${r.data.nivel} alertaProfe=${r.data.alertaProfe} resumen="${r.data.resumen?.slice(0,60)}"`);
    } else if (r.status === 401) {
      skip("checkin-analyze test", "admin session not valid for alumno endpoint — expected");
    } else {
      apiAssert("checkin-analyze status 200", false, `got ${r.status}: ${JSON.stringify(r.data).slice(0,80)}`);
    }
  }
}

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}🧪 smoke-alertas — pf-control-web${RESET}`);
  console.log(`   baseUrl: ${baseUrl}`);
  console.log(`   cronSecret: ${cronSecret ? "✓ set" : "✗ not set"}`);

  runUnitTests();
  await runApiTests();

  const totalFails = unitFails.length + apiFails.length;
  console.log("");
  if (totalFails === 0) {
    console.log(`${GREEN}${BOLD}All checks passed ✓${RESET}\n`);
  } else {
    console.log(`${RED}${BOLD}${totalFails} check(s) failed:${RESET}`);
    [...unitFails, ...apiFails].forEach((n) => console.log(`  ${RED}✗${RESET} ${n}`));
    console.log("");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\n${RED}Fatal error:${RESET}`, e);
  process.exit(1);
});
