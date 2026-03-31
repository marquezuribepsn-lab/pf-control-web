const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
require('dotenv').config({ path: path.resolve(__dirname, '../.db.env') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const email = process.env.ACCESS_USER_EMAIL || 'marquezuribepsn@gmail.com';
const password = process.env.ACCESS_USER_PASSWORD || process.env.SMOKE_MAIN_PASSWORD || '';
const role = 'ADMIN';

async function main() {
  if (!password) {
    throw new Error('ACCESS_USER_PASSWORD o SMOKE_MAIN_PASSWORD es requerido.');
  }

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

  const output = {
    ok: true,
    user,
  };

  if (process.env.SHOW_ACCESS_PASSWORD === '1') {
    output.password = password;
  }

  console.log(JSON.stringify(output));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });