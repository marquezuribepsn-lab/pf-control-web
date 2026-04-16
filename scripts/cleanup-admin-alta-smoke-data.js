const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ALUMNOS_KEY = 'pf-control-alumnos';
const CLIENTES_META_KEY = 'pf-control-clientes-meta-v1';

function isE2EAlumnoName(value) {
  return /^e2e alta\b/i.test(String(value || '').trim());
}

function isE2EEmail(value) {
  return String(value || '').toLowerCase().includes('alta.panel+e2e');
}

async function main() {
  const alumnosRow = await prisma.syncEntry.findUnique({
    where: { key: ALUMNOS_KEY },
    select: { value: true },
  });

  const metaRow = await prisma.syncEntry.findUnique({
    where: { key: CLIENTES_META_KEY },
    select: { value: true },
  });

  const alumnos = Array.isArray(alumnosRow?.value) ? alumnosRow.value : [];
  const cleanedAlumnos = alumnos.filter((item) => !isE2EAlumnoName(item?.nombre));

  let removedAlumnos = 0;
  if (cleanedAlumnos.length !== alumnos.length) {
    removedAlumnos = alumnos.length - cleanedAlumnos.length;
    await prisma.syncEntry.upsert({
      where: { key: ALUMNOS_KEY },
      update: { value: cleanedAlumnos },
      create: { key: ALUMNOS_KEY, value: cleanedAlumnos },
    });
  }

  const metaMap =
    metaRow?.value && typeof metaRow.value === 'object'
      ? { ...metaRow.value }
      : {};

  let removedMeta = 0;
  for (const [metaKey, metaValue] of Object.entries(metaMap)) {
    const email =
      metaValue && typeof metaValue === 'object'
        ? String(metaValue.email || '').toLowerCase()
        : '';

    if (isE2EAlumnoName(String(metaKey).replace(/^alumno:/i, '')) || isE2EEmail(email)) {
      delete metaMap[metaKey];
      removedMeta += 1;
    }
  }

  if (removedMeta > 0) {
    await prisma.syncEntry.upsert({
      where: { key: CLIENTES_META_KEY },
      update: { value: metaMap },
      create: { key: CLIENTES_META_KEY, value: metaMap },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        removedAlumnos,
        removedMeta,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: String(error?.message || error),
        },
        null,
        2
      )
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
