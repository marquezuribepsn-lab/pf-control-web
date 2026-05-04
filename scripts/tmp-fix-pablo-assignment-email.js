const { PrismaClient } = require("@prisma/client");
const { loginForSmoke, normalizeEmail, resolveSmokeConfig } = require("./utils/smoke-auth");

const prisma = new PrismaClient();
const smokeConfig = resolveSmokeConfig();

const baseUrl = smokeConfig.baseUrl;
const targetEmail = normalizeEmail(process.env.SMOKE_ALUMNO_EMAIL || "pablo.marquez.mda@gmail.com");

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

  const payload = await response.json();
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

function sortByAssignedAtDesc(rows) {
  return rows
    .slice()
    .sort((a, b) => new Date(b?.assignedAt || 0).getTime() - new Date(a?.assignedAt || 0).getTime());
}

async function main() {
  const login = await loginForSmoke({ prisma });
  if (!login.ok) {
    throw new Error(`Login admin fallo: status=${login.status} location=${login.location}`);
  }

  const assignmentsRaw = await fetchSyncValue("pf-control-nutricion-asignaciones-v1", login.cookieHeader);
  const assignments = Array.isArray(assignmentsRaw) ? assignmentsRaw : [];

  const relatedBefore = sortByAssignedAtDesc(
    assignments.filter((item) => {
      const byEmail = normalizeEmail(item?.alumnoEmail) === targetEmail;
      const byName = String(item?.alumnoNombre || "").trim().toLowerCase().includes("pablo");
      return byEmail || byName;
    })
  );

  const nextAssignments = assignments.map((item) => {
    const byEmail = normalizeEmail(item?.alumnoEmail) === targetEmail;
    const byName = String(item?.alumnoNombre || "").trim().toLowerCase().includes("pablo");

    if (!byEmail && !byName) {
      return item;
    }

    return {
      ...item,
      alumnoEmail: targetEmail,
    };
  });

  await putSyncValue("pf-control-nutricion-asignaciones-v1", nextAssignments, login.cookieHeader);

  const assignmentsAfterRaw = await fetchSyncValue("pf-control-nutricion-asignaciones-v1", login.cookieHeader);
  const assignmentsAfter = Array.isArray(assignmentsAfterRaw) ? assignmentsAfterRaw : [];

  const relatedAfter = sortByAssignedAtDesc(
    assignmentsAfter.filter((item) => normalizeEmail(item?.alumnoEmail) === targetEmail)
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        targetEmail,
        touchedRows: nextAssignments.filter((item, index) => {
          const prev = assignments[index] || {};
          return normalizeEmail(prev?.alumnoEmail) !== normalizeEmail(item?.alumnoEmail);
        }).length,
        relatedBefore,
        relatedAfter,
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
