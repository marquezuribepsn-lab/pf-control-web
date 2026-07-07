/**
 * Habilita el acceso (billing) del alumno de prueba en la base local.
 * Marca pagoEstado="confirmado" y una membresía activa por 1 año en el
 * client meta map (clave pf-control-clientes-meta-v1 de sync_entries).
 * Uso: node scripts/ensure-test-alumno-access.js
 */
require("dotenv").config({ path: ".env.local" });

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CLIENTES_META_KEY = "pf-control-clientes-meta-v1";
const email = "alumno.demo@pfcontrol.local";
const clientKey = "alumno:demo";

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const today = new Date();
  const start = dateOnly(today);
  const end = dateOnly(new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000));

  const row = await prisma.syncEntry.findUnique({ where: { key: CLIENTES_META_KEY } });
  const map =
    row && row.value && typeof row.value === "object" ? { ...row.value } : {};

  const previous = map[clientKey] && typeof map[clientKey] === "object" ? map[clientKey] : {};

  map[clientKey] = {
    ...previous,
    email,
    nombre: "Alumno Demo",
    pagoEstado: "confirmado",
    startDate: start,
    endDate: end,
    membresia: "activa",
  };

  await prisma.syncEntry.upsert({
    where: { key: CLIENTES_META_KEY },
    update: { value: map },
    create: { key: CLIENTES_META_KEY, value: map },
  });

  console.log(
    JSON.stringify(
      { ok: true, clientKey, access: map[clientKey] },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
