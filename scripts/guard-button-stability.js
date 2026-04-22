const fs = require('fs');
const path = require('path');

const appShellPath = path.resolve(__dirname, '../components/AppShell.tsx');
const reliableLinkPath = path.resolve(__dirname, '../components/ReliableLink.tsx');
const buttonFailsafePath = path.resolve(__dirname, '../lib/buttonFailsafe.ts');
const sharedStatePath = path.resolve(__dirname, '../components/useSharedState.ts');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo leer ${filePath}: ${String(error)}`);
  }
}

function getNumericConstant(source, regex) {
  const match = source.match(regex);
  if (!match) return null;
  const value = Number.parseInt(String(match[1] || ''), 10);
  return Number.isFinite(value) ? value : null;
}

function main() {
  const appShellSource = readFileSafe(appShellPath);
  const reliableLinkSource = readFileSafe(reliableLinkPath);
  const buttonFailsafeSource = readFileSafe(buttonFailsafePath);
  const sharedStateSource = readFileSafe(sharedStatePath);

  const appShellOptimisticMs = getNumericConstant(
    appShellSource,
    /const\s+SIDEBAR_NAV_OPTIMISTIC_MS\s*=\s*(\d+)\s*;/
  );
  const reliableLinkFallbackMs = getNumericConstant(
    reliableLinkSource,
    /const\s+HARD_MODE_FALLBACK_DELAY_MS\s*=\s*(\d+)\s*;/
  );
  const reliableLinkLastResortMs = getNumericConstant(
    reliableLinkSource,
    /const\s+HARD_MODE_LAST_RESORT_DELAY_MS\s*=\s*(\d+)\s*;/
  );
  const buttonFailsafeDelayMs = getNumericConstant(
    buttonFailsafeSource,
    /const\s+LINK_FAILSAFE_DELAY_MS\s*=\s*(\d+)\s*;/
  );
  const buttonFailsafeHardDelayMs = getNumericConstant(
    buttonFailsafeSource,
    /const\s+LINK_FAILSAFE_HARD_DELAY_MS\s*=\s*(\d+)\s*;/
  );
  const sharedStateDefaultPollMs = getNumericConstant(
    sharedStateSource,
    /const\s*\{\s*key\s*,\s*legacyLocalStorageKey\s*,\s*pollMs\s*=\s*(\d+)\s*\}\s*=\s*options\s*;/
  );

  const hardReliabilityMatches = appShellSource.match(/reliabilityMode="hard"/g) || [];

  const checks = [
    {
      name: 'appShellHasFailsafeInstall',
      pass: /installButtonFailsafe/.test(appShellSource),
      detail: 'AppShell debe instalar installButtonFailsafe para recuperar clicks muertos.',
    },
    {
      name: 'appShellHasInteractionGuard',
      pass: /neutralizeViewportBlockers/.test(appShellSource),
      detail: 'AppShell debe mantener interaction guard contra overlays bloqueantes.',
    },
    {
      name: 'appShellUsesHardReliabilityForSidebarLinks',
      pass: hardReliabilityMatches.length >= 3,
      detail: 'Sidebar/perfil/widgets deben usar reliabilityMode="hard".',
    },
    {
      name: 'appShellNoSoftReliabilityRegression',
      pass: !/reliabilityMode="soft"/.test(appShellSource),
      detail: 'No se permite reliabilityMode="soft" en AppShell porque reduce el fallback de botones.',
    },
    {
      name: 'appShellOptimisticNavWithinBound',
      pass:
        appShellOptimisticMs !== null &&
        appShellOptimisticMs >= 300 &&
        appShellOptimisticMs <= 900,
      detail: 'SIDEBAR_NAV_OPTIMISTIC_MS debe quedar entre 300 y 900ms.',
    },
    {
      name: 'reliableLinkFallbackFastEnough',
      pass:
        reliableLinkFallbackMs !== null &&
        reliableLinkLastResortMs !== null &&
        reliableLinkFallbackMs >= 500 &&
        reliableLinkFallbackMs <= 600 &&
        reliableLinkLastResortMs <= 180,
      detail:
        'ReliableLink debe mantener fallback acotado (500-600ms) y ultimo intento rapido (<=180ms).',
    },
    {
      name: 'buttonFailsafeFallbackFastEnough',
      pass:
        buttonFailsafeDelayMs !== null &&
        buttonFailsafeHardDelayMs !== null &&
        buttonFailsafeDelayMs <= 200 &&
        buttonFailsafeHardDelayMs <= 160,
      detail:
        'buttonFailsafe debe recuperar navegacion de data-nav-href con retraso acotado.',
    },
    {
      name: 'sharedStateDefaultPollNotAggressive',
      pass: sharedStateDefaultPollMs !== null && sharedStateDefaultPollMs >= 7000,
      detail: 'useSharedState debe mantener pollMs por defecto >= 7000 para evitar jank global.',
    },
    {
      name: 'sharedStateSkipsHiddenPolling',
      pass: /document\.visibilityState\s*!==\s*"visible"/.test(sharedStateSource),
      detail: 'useSharedState debe omitir polling cuando la pestaña no es visible.',
    },
    {
      name: 'sharedStateSkipsOfflinePolling',
      pass: /!window\.navigator\.onLine/.test(sharedStateSource),
      detail: 'useSharedState debe omitir polling cuando no hay internet.',
    },
    {
      name: 'sharedStateSkipsDuringMobileInteraction',
      pass: /isMobileInteractionActive\(\)/.test(sharedStateSource),
      detail: 'useSharedState debe pausar polling durante interaccion tactil reciente en mobile.',
    },
  ];

  const failed = checks.filter((check) => !check.pass);
  const output = {
    ok: failed.length === 0,
    files: {
      appShell: path.relative(process.cwd(), appShellPath),
      reliableLink: path.relative(process.cwd(), reliableLinkPath),
      buttonFailsafe: path.relative(process.cwd(), buttonFailsafePath),
      sharedState: path.relative(process.cwd(), sharedStatePath),
    },
    metrics: {
      appShellOptimisticMs,
      reliableLinkFallbackMs,
      reliableLinkLastResortMs,
      buttonFailsafeDelayMs,
      buttonFailsafeHardDelayMs,
      sharedStateDefaultPollMs,
      hardReliabilityCount: hardReliabilityMatches.length,
    },
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
