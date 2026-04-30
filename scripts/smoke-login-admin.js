const { PrismaClient } = require('@prisma/client');
const { loginForSmoke, resolveSmokeConfig } = require('./utils/smoke-auth');

const prisma = new PrismaClient();
const smokeConfig = resolveSmokeConfig();

async function main() {
  const result = await loginForSmoke({ prisma });

  const payload = {
    ok: result.ok,
    baseUrl: smokeConfig.baseUrl,
    email: smokeConfig.adminEmail,
    status: result.status,
    location: result.location,
    method: result.method,
    checkedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(payload, null, 2));

  if (!payload.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
});
