require('dotenv').config({ path: '../.env.production' });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const email = 'marquezuribepsn@gmail.com';
const password = 'pfcontrol2026';
const role = 'ADMIN';

async function main() {
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role,
      emailVerified: true,
      estado: 'activo',
      nombreCompleto: 'Valentino Marquez Uribe',
    },
    create: {
      email,
      password: hashedPassword,
      role,
      emailVerified: true,
      estado: 'activo',
      nombreCompleto: 'Valentino Marquez Uribe',
    },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
    },
  });

  console.log(JSON.stringify({
    ok: true,
    user,
    password,
  }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });