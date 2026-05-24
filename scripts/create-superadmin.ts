/**
 * Script para crear el primer usuario SUPERADMIN
 * Uso: npx tsx scripts/create-superadmin.ts <email> <password>
 * Ejemplo: npx tsx scripts/create-superadmin.ts god@system.com supersecret123
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Uso: npx tsx scripts/create-superadmin.ts <email> <password>");
    process.exit(1);
  }

  const existing = await (prisma as any).user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    // Update existing user to SUPERADMIN
    const updated = await (prisma as any).user.update({
      where: { email: email.toLowerCase() },
      data: { role: "SUPERADMIN", emailVerified: true, estado: "activo" },
    });
    console.log(`✅ Usuario ${email} actualizado a SUPERADMIN (id: ${updated.id})`);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await (prisma as any).user.create({
    data: {
      email: email.toLowerCase(),
      password: hashed,
      nombreCompleto: "SuperAdmin",
      role: "SUPERADMIN",
      emailVerified: true,
      estado: "activo",
    },
  });

  console.log(`✅ SuperAdmin creado: ${email} (id: ${user.id})`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
