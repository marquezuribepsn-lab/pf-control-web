/**
 * Provisión de un usuario ALUMNO (role CLIENTE) de prueba en la base local.
 * Uso: node scripts/ensure-test-alumno.js
 * Idempotente: si el usuario existe, resetea su password al valor por defecto.
 */
require("dotenv").config({ path: ".env.local" });

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const email = "alumno.demo@pfcontrol.local";
const password = "alumnodemo2026";
const role = "CLIENTE";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });
  const hashedPassword = await bcrypt.hash(password, 10);

  const baseData = {
    role,
    emailVerified: true,
    estado: "activo",
    nombreCompleto: "Alumno Demo",
  };

  const user = existing
    ? await prisma.user.update({
        where: { email },
        data: { ...baseData, password: hashedPassword },
        select: { id: true, email: true, role: true, emailVerified: true },
      })
    : await prisma.user.create({
        data: { email, password: hashedPassword, ...baseData },
        select: { id: true, email: true, role: true, emailVerified: true },
      });

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: !existing,
        user,
        credentials: { email, password },
      },
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
