import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const db = prisma as any;
const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || 'maruquezuribepsn@gmail.com';
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.SMOKE_MAIN_PASSWORD || '';

async function main() {
  console.log('🔄 Iniciando setup de base de datos...');

  // Check if admin already exists
  const adminExists = await db.user.findUnique({
    where: { email: seedAdminEmail },
  });

  if (adminExists) {
    console.log('✓ El admin ya existe');
    return;
  }

  if (!seedAdminPassword) {
    console.log('⚠️ SEED_ADMIN_PASSWORD no configurada. Se omite creacion de admin.');
    return;
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash(seedAdminPassword, 10);
  
  const admin = await db.user.create({
    data: {
      email: seedAdminEmail,
      password: hashedPassword,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log('✅ Admin creado:');
  console.log(`   📧 Email: ${admin.email}`);
  console.log(`   👤 Rol: ${admin.role}`);
  console.log('\n✨ Setup completado exitosamente');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
