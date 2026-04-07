const fs = require('fs');
const path = require('path');

const layoutPath = path.resolve(__dirname, '../app/layout.tsx');
const appShellPath = path.resolve(__dirname, '../components/AppShell.tsx');
const reliableLinkPath = path.resolve(__dirname, '../components/ReliableLink.tsx');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo leer ${filePath}: ${String(error)}`);
  }
}

function getHardFallbackDelayMs(source) {
  const match = source.match(/HARD_MODE_FALLBACK_DELAY_MS\s*=\s*(\d+)/);
  if (!match) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function main() {
  const layoutSource = readFileSafe(layoutPath);
  const appShellSource = readFileSafe(appShellPath);
  const reliableLinkSource = readFileSafe(reliableLinkPath);

  const hardFallbackDelayMs = getHardFallbackDelayMs(reliableLinkSource);

  const checks = [
    {
      name: 'layoutImportsAuth',
      pass: /import\s+\{\s*auth\s*\}\s+from\s+["']\.\.\/lib\/auth["'];/.test(layoutSource),
      detail: 'app/layout debe importar auth() para seed de perfil inicial.',
    },
    {
      name: 'rootLayoutIsAsync',
      pass: /export\s+default\s+async\s+function\s+RootLayout/.test(layoutSource),
      detail: 'RootLayout debe ser async para obtener session server-side.',
    },
    {
      name: 'layoutComputesInitialProfileName',
      pass: /resolveInitialProfileName\(/.test(layoutSource) && /const\s+initialProfileName\s*=/.test(layoutSource),
      detail: 'app/layout debe calcular initialProfileName para evitar fallback transitorio.',
    },
    {
      name: 'layoutPassesInitialPropsToAppShell',
      pass: /<AppShell[^>]*initialRole=\{initialRole\}[^>]*initialProfileName=\{initialProfileName\}/s.test(layoutSource),
      detail: 'AppShell debe recibir initialRole + initialProfileName desde layout.',
    },
    {
      name: 'appShellAcceptsInitialProfileNameProp',
      pass: /initialProfileName\?:\s*string\s*\|\s*null;/.test(appShellSource),
      detail: 'AppShellProps debe declarar initialProfileName opcional.',
    },
    {
      name: 'appShellSeedsInitialProfileName',
      pass:
        /normalizedInitialName\s*=\s*typeof\s+initialProfileName/.test(appShellSource) &&
        /localStorage\.setItem\(SIDEBAR_PROFILE_NAME_KEY,\s*normalizedInitialName\)/.test(appShellSource),
      detail: 'AppShell debe seedear initialProfileName al cache local.',
    },
    {
      name: 'appShellStableDisplayNameFallback',
      pass: /const\s+displayName\s*=\s*sessionKnownName\s*\|\|\s*cachedProfileName\s*\|\|\s*resolveUserDisplayName\(\s*\)/.test(appShellSource),
      detail: 'displayName debe priorizar session + cache estable para evitar flash Usuario.',
    },
    {
      name: 'appShellStableRoleLabelFallback',
      pass: /const\s+roleLabel\s*=\s*roleToLabel\(\s*normalizedRole\s*\|\|\s*cachedProfileRole\s*\)/.test(appShellSource),
      detail: 'roleLabel debe usar fallback de rol cacheado para evitar flash USUARIO.',
    },
    {
      name: 'appShellHasNoHardReload',
      pass: !/window\.location\.assign\(/.test(appShellSource),
      detail: 'AppShell no debe incluir hard reload directo.',
    },
    {
      name: 'reliableLinkHardFallbackDelayInRange',
      pass: Number.isFinite(hardFallbackDelayMs) && hardFallbackDelayMs >= 500 && hardFallbackDelayMs <= 5000,
      detail: 'ReliableLink debe mantener HARD_MODE_FALLBACK_DELAY_MS entre 500 y 5000ms.',
    },
    {
      name: 'reliableLinkHardFallbackExists',
      pass: /window\.location\.assign\(/.test(reliableLinkSource),
      detail: 'ReliableLink hard mode debe conservar fallback de navegacion dura para clicks bloqueados.',
    },
    {
      name: 'reliableLinkUsesNextLink',
      pass: /<NextLink/.test(reliableLinkSource),
      detail: 'ReliableLink debe mantenerse sobre NextLink para transiciones SPA.',
    },
  ];

  const failed = checks.filter((check) => !check.pass);
  const output = {
    ok: failed.length === 0,
    files: {
      layout: path.relative(process.cwd(), layoutPath),
      appShell: path.relative(process.cwd(), appShellPath),
      reliableLink: path.relative(process.cwd(), reliableLinkPath),
    },
    hardFallbackDelayMs,
    failedChecks: failed.map((item) => item.name),
    checks,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
}
