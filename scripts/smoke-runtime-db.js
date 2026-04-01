const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
require('dotenv').config({ path: path.resolve(__dirname, '../.db.env') });

const { PrismaClient } = require('@prisma/client');

const requiredColumns = [
  'email',
  'password',
  'role',
  'emailVerified',
  'nombreCompleto',
  'puedeEditarRegistros',
  'puedeEditarPlanes',
  'puedeVerTodosAlumnos',
  'permisosGranulares',
  'estado',
];
const projectRoot = path.resolve(__dirname, '..');
const schemaPath = path.resolve(projectRoot, 'prisma/schema.prisma');

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function getDatabaseKind(databaseUrl) {
  if (/^file:/i.test(databaseUrl)) return 'sqlite';
  if (/^postgres(ql)?:/i.test(databaseUrl)) return 'postgres';
  if (/^mysql:/i.test(databaseUrl)) return 'mysql';
  return 'unknown';
}

function getDatasourceConfigFromSchema() {
  if (!fs.existsSync(schemaPath)) {
    return null;
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  const datasourceBlockMatch = schema.match(/datasource\s+\w+\s*\{[\s\S]*?\}/m);
  if (!datasourceBlockMatch) {
    return null;
  }

  const datasourceBlock = datasourceBlockMatch[0];
  const providerMatch = datasourceBlock.match(/provider\s*=\s*"([^"]+)"/);
  const urlLiteralMatch = datasourceBlock.match(/url\s*=\s*"([^"]+)"/);
  const urlEnvMatch = datasourceBlock.match(/url\s*=\s*env\("([^"]+)"\)/);

  const provider = providerMatch ? String(providerMatch[1]).trim().toLowerCase() : '';
  let urlValue = '';

  if (urlLiteralMatch) {
    urlValue = String(urlLiteralMatch[1] || '').trim();
  } else if (urlEnvMatch) {
    const envKey = String(urlEnvMatch[1] || '').trim();
    urlValue = String(process.env[envKey] || '').trim();
  }

  return {
    provider,
    url: urlValue,
  };
}

function resolveSqlitePath(databaseUrl, baseDir) {
  const raw = String(databaseUrl || '').replace(/^file:/i, '');
  const withoutQuery = raw.split('?')[0] || '';

  if (!withoutQuery) {
    throw new Error('DATABASE_URL sqlite invalido: ruta vacia');
  }

  if (path.isAbsolute(withoutQuery)) {
    return path.normalize(withoutQuery);
  }

  return path.resolve(baseDir || projectRoot, withoutQuery);
}

function readRealPathSafe(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return null;
  }
}

async function readUserColumns(prisma, kind) {
  if (kind === 'sqlite') {
    const rows = await prisma.$queryRawUnsafe("PRAGMA table_info('users')");
    return rows.map((row) => String(row.name || '').trim()).filter(Boolean);
  }

  if (kind === 'postgres') {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users'"
    );
    return rows.map((row) => String(row.column_name || '').trim()).filter(Boolean);
  }

  if (kind === 'mysql') {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
    );
    return rows.map((row) => String(row.COLUMN_NAME || '').trim()).filter(Boolean);
  }

  throw new Error('DATABASE_URL con proveedor no soportado para validacion de columnas');
}

function pushCheck(checks, name, pass, detail) {
  checks.push({ name, pass, detail });
}

async function main() {
  const datasource = getDatasourceConfigFromSchema();
  const databaseUrl = String(datasource?.url || process.env.DATABASE_URL || '').trim();

  if (!databaseUrl && !datasource?.provider) {
    throw new Error('No se pudo resolver datasource/url desde prisma/schema.prisma ni DATABASE_URL');
  }

  const kind = datasource?.provider || getDatabaseKind(databaseUrl);
  const checks = [];

  if (kind === 'sqlite') {
    if (!databaseUrl) {
      throw new Error('Datasource sqlite sin URL resuelta');
    }

    const sqliteBaseDir = datasource?.url ? path.dirname(schemaPath) : projectRoot;
    const resolvedDbPath = resolveSqlitePath(databaseUrl, sqliteBaseDir);

    pushCheck(checks, 'sqliteDbFileExists', fs.existsSync(resolvedDbPath), {
      resolvedDbPath,
    });

    pushCheck(checks, 'sqliteDbPathLooksExpected', /\/dev\.db$/i.test(normalizePath(resolvedDbPath)), {
      resolvedDbPath,
    });

    const legacyDbPath = path.join(projectRoot, 'dev.db');
    const prismaDbPath = path.join(projectRoot, 'prisma', 'dev.db');

    if (fs.existsSync(legacyDbPath) && fs.existsSync(prismaDbPath)) {
      const legacyRealPath = readRealPathSafe(legacyDbPath);
      const prismaRealPath = readRealPathSafe(prismaDbPath);

      pushCheck(
        checks,
        'legacyRootDevDbPointsToPrismaDb',
        Boolean(legacyRealPath && prismaRealPath && legacyRealPath === prismaRealPath),
        {
          legacyDbPath,
          prismaDbPath,
          legacyRealPath,
          prismaRealPath,
        }
      );
    } else {
      pushCheck(checks, 'legacyRootDevDbPointsToPrismaDb', true, {
        skipped: true,
        reason: 'dev.db raiz o prisma/dev.db no presente en este entorno',
      });
    }
  } else {
    pushCheck(checks, 'sqlitePathChecksSkipped', true, {
      skipped: true,
      reason: `DATABASE_URL no sqlite (${kind})`,
    });
  }

  const prisma = new PrismaClient();
  try {
    const detectedColumns = await readUserColumns(prisma, kind);
    const missingColumns = requiredColumns.filter((column) => !detectedColumns.includes(column));

    pushCheck(checks, 'usersHasCriticalColumns', missingColumns.length === 0, {
      requiredColumns,
      missingColumns,
      detectedColumns,
    });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  const failed = checks.filter((check) => !check.pass).map((check) => check.name);
  const output = {
    ok: failed.length === 0,
    databaseKind: kind,
    databaseUrlSource: datasource?.url ? 'schema' : 'env',
    checks,
    failedChecks: failed,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
