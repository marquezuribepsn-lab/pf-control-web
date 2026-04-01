const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const { PrismaClient } = require('@prisma/client');

const TEST_ACCOUNT_EMAIL_PATTERNS = [
  /\+(alumno|colab|colabmail|acct|acctchg|smoke)\d*@/i,
  /\+(staff|test|qa|demo|sandbox|reset|pwtoken|colabux)\d*@/i,
  /^smoke\..+@example\.com$/i,
];

function isTestAccountEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  return TEST_ACCOUNT_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

async function main() {
  const prisma = new PrismaClient();
  const dryRun = String(process.env.CLEANUP_DRY_RUN || 'false').toLowerCase() === 'true';

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        estado: true,
      },
    });

    const targets = users.filter((user) => isTestAccountEmail(user.email));
    const targetIds = targets.map((user) => user.id);
    const targetEmails = targets
      .map((user) => String(user.email || '').trim().toLowerCase())
      .filter(Boolean);

    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            dryRun: true,
            scannedUsers: users.length,
            matchedUsers: targets.length,
            sample: targets.slice(0, 20),
          },
          null,
          2
        )
      );
      return;
    }

    const [deletedVerificationTokens, deletedPasswordResetTokens, deletedUsers] = await Promise.all([
      targetEmails.length
        ? prisma.verificationToken.deleteMany({
            where: { email: { in: targetEmails } },
          })
        : Promise.resolve({ count: 0 }),
      targetEmails.length
        ? prisma.passwordResetToken.deleteMany({
            where: { email: { in: targetEmails } },
          })
        : Promise.resolve({ count: 0 }),
      targetIds.length
        ? prisma.user.deleteMany({
            where: { id: { in: targetIds } },
          })
        : Promise.resolve({ count: 0 }),
    ]);

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: false,
          scannedUsers: users.length,
          matchedUsers: targets.length,
          deletedUsers: deletedUsers.count,
          deletedVerificationTokens: deletedVerificationTokens.count,
          deletedPasswordResetTokens: deletedPasswordResetTokens.count,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
