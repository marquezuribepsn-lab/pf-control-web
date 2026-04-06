const fs = require('fs');
const path = require('path');

const appShellPath = path.resolve(__dirname, '../components/AppShell.tsx');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo leer ${filePath}: ${String(error)}`);
  }
}

function main() {
  const source = readFileSafe(appShellPath);

  const checks = [
    {
      name: 'hasInteractionGuardImport',
      pass: /neutralizeViewportBlockers/.test(source),
      detail: 'AppShell debe importar y usar neutralizeViewportBlockers.',
    },
    {
      name: 'hasPointerDownCaptureGuard',
      pass: /addEventListener\(\s*"pointerdown"\s*,\s*onPointerDownCapture\s*,\s*true\s*\)/.test(source),
      detail: 'AppShell debe ejecutar guardia de interaccion en captura de pointerdown.',
    },
    {
      name: 'dockContainerPointerEventsAuto',
      pass: /className=\"[^\"]*pointer-events-auto[^\"]*rounded-\[1\.45rem\][^\"]*\"/.test(source),
      detail: 'El contenedor del dock debe mantener pointer-events-auto.',
    },
    {
      name: 'noExtremeDockZIndex',
      pass: !/z-\[214748\d+\]/.test(source),
      detail: 'No se permite z-index extremo en AppShell (riesgo de bloqueo global).',
    },
  ];

  const failed = checks.filter((check) => !check.pass);
  const output = {
    ok: failed.length === 0,
    file: path.relative(process.cwd(), appShellPath),
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
