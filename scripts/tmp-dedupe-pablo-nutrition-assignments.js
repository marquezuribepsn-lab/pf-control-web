const { PrismaClient } = require("@prisma/client");
const { loginForSmoke, normalizeEmail, resolveSmokeConfig } = require("./utils/smoke-auth");

const prisma = new PrismaClient();
const config = resolveSmokeConfig();

const baseUrl = config.baseUrl;
const targetEmail = normalizeEmail(process.env.SMOKE_ALUMNO_EMAIL || "pablo.marquez.mda@gmail.com");
const canonicalName = "Pablo Marquez";

const TARGET_NAME_KEYS = new Set(["pablo", "pablo marquez"]);

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTime(value) {
  const date = new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

async function fetchSyncValue(key, cookieHeader) {
  const response = await fetch(`${baseUrl}/api/sync/${encodeURIComponent(key)}`, {
    headers: {
      Cookie: cookieHeader,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GET /api/sync/${key} fallo con ${response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  return payload?.value ?? null;
}

async function putSyncValue(key, value, cookieHeader) {
  const response = await fetch(`${baseUrl}/api/sync/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    throw new Error(`PUT /api/sync/${key} fallo con ${response.status}`);
  }
}

function isTargetRow(row) {
  const rowEmail = normalizeEmail(row?.alumnoEmail);
  if (rowEmail && rowEmail === targetEmail) {
    return true;
  }

  const nameKey = normalizeName(row?.alumnoNombre);
  if (!nameKey) return false;

  return TARGET_NAME_KEYS.has(nameKey);
}

function pickCanonicalRow(rows) {
  const sorted = rows.slice().sort((a, b) => getTime(b?.assignedAt) - getTime(a?.assignedAt));
  const firstWithPlan = sorted.find((row) => String(row?.planId || "").trim().length > 0);
  const base = firstWithPlan || sorted[0] || null;

  if (!base) {
    return null;
  }

  const assignedAt = base.assignedAt || new Date().toISOString();

  return {
    ...base,
    alumnoNombre: canonicalName,
    alumnoEmail: targetEmail,
    assignedAt,
  };
}

async function main() {
  const login = await loginForSmoke({ prisma });
  if (!login.ok) {
    throw new Error(`Login admin fallo: status=${login.status} location=${login.location}`);
  }

  const key = "pf-control-nutricion-asignaciones-v1";
  const raw = await fetchSyncValue(key, login.cookieHeader);
  const rows = Array.isArray(raw) ? raw : [];

  const targetRows = rows.filter((row) => isTargetRow(row));
  const nonTargetRows = rows.filter((row) => !isTargetRow(row));

  if (targetRows.length === 0) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          changed: false,
          reason: "No se encontraron filas target para deduplicar.",
          targetEmail,
          beforeTargetRows: [],
          afterTargetRows: [],
        },
        null,
        2
      )
    );
    return;
  }

  const canonicalRow = pickCanonicalRow(targetRows);
  if (!canonicalRow) {
    throw new Error("No se pudo construir fila canonica para Pablo.");
  }

  const nextRows = [...nonTargetRows, canonicalRow].sort(
    (a, b) => getTime(b?.assignedAt) - getTime(a?.assignedAt)
  );

  await putSyncValue(key, nextRows, login.cookieHeader);

  const afterRaw = await fetchSyncValue(key, login.cookieHeader);
  const afterRows = Array.isArray(afterRaw) ? afterRaw : [];
  const afterTargetRows = afterRows.filter((row) => isTargetRow(row));

  console.log(
    JSON.stringify(
      {
        ok: true,
        changed: true,
        targetEmail,
        beforeTotalRows: rows.length,
        afterTotalRows: afterRows.length,
        beforeTargetCount: targetRows.length,
        afterTargetCount: afterTargetRows.length,
        canonicalRow,
        beforeTargetRows: targetRows,
        afterTargetRows,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
