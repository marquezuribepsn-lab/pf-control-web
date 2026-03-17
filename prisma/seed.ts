import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const db = prisma as any;

async function main() {
  console.log('🔄 Iniciando setup de base de datos...');

  // Check if admin already exists
  const adminExists = await db.user.findUnique({
    where: { email: 'maruquezuribepsn@gmail.com' },
  });

  if (adminExists) {
    console.log('✓ El admin ya existe');
    return;
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash('Gimnasio2005', 10);
  
  const admin = await db.user.create({
    data: {
      email: 'maruquezuribepsn@gmail.com',
      password: hashedPassword,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log('✅ Admin creado:');
  console.log(`   📧 Email: ${admin.email}`);
  console.log(`   🔑 Contraseña: Gimnasio2005`);
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
