require('dotenv').config({ path: '../.env.production' });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const email = 'marquezuribepsn@gmail.com';
const password = 'pfcontrol2026';
const role = 'ADMIN';
const forceResetPassword =
  process.argv.includes('--reset-password') ||
  String(process.env.ENSURE_ACCESS_USER_RESET_PASSWORD || '').toLowerCase() === '1';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });
  const hashedPassword = await bcrypt.hash(password, 10);

  const createData = {
    email,
    password: hashedPassword,
    role,
    emailVerified: true,
    estado: 'activo',
    nombreCompleto: 'Valentino Marquez Uribe',
  };

  const updateData = {
    role,
    emailVerified: true,
    estado: 'activo',
    nombreCompleto: 'Valentino Marquez Uribe',
    ...(forceResetPassword ? { password: hashedPassword } : {}),
  };

  const user = existing
    ? await prisma.user.update({
        where: { email },
        data: updateData,
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
        },
      })
    : await prisma.user.create({
        data: createData,
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
    passwordResetApplied: Boolean(forceResetPassword || !existing),
    note: forceResetPassword
      ? 'Password reset forced by flag/env.'
      : existing
      ? 'Existing user preserved without changing password.'
      : 'User created with default operational password.',
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