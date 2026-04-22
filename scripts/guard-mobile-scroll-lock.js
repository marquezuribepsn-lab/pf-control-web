/*
 * guard:mobile-scroll-lock
 *
 * Candado tecnico para las reglas CSS que hacen que el scroll vertical rapido
 * en mobile NO muestre parpadeo / "carga" de paneles al entrar/salir del
 * viewport. Cualquier regresion en `app/globals.css` que vuelva a activar
 * estas optimizaciones problematicas debe hacer fallar el build y el deploy.
 *
 * Reglas prohibidas (causa raiz validada en produccion 2026-04-22):
 *
 *  1. `-webkit-overflow-scrolling: touch` en `body` o `html`.
 *     En iOS activa el compositor por mosaicos (tiled rendering): los tiles
 *     fuera del viewport no se rasterizan hasta que entran a pantalla, lo
 *     que se ve como "carga" al bajar/subir. Safari moderno ya hace momentum
 *     scroll del root por defecto.
 *
 *  2. `will-change: transform` aplicado a selectores universales de botones
 *     (`button`, `[role="button"]`, `*`). Promover cada boton a capa GPU
 *     agota la memoria de texturas en iOS y fuerza re-raster durante scroll
 *     rapido.
 *
 *  3. `content-visibility: auto` en los paneles del stage del alumno
 *     (`.pf-alumno-stage-panel`). Hace que el browser difiera el paint de
 *     paneles offscreen y los repinte al entrar por scroll = flash visible.
 *
 *  4. Reglas globales con selector universal `*` y `!important` dentro de
 *     `.pf-training-shell` o `.pf-alumno-main` (p.ej. `filter: none !important`,
 *     `box-shadow: none !important` sobre `*`, `*::before`, `*::after`).
 *     Fuerzan style recalc sobre miles de nodos en cada repaint y provocan
 *     la sensacion de "traba" al moverse por la app.
 *
 * Reglas REQUERIDAS:
 *  - `.pf-alumno-stage-panel` debe declarar `contain: none` y
 *    `content-visibility: visible`.
 *  - `.pf-alumno-stage-hidden` debe ocultar con `display: none !important`.
 *
 * Uso: se invoca desde el pipeline de deploy (deploy-vps.ps1) antes del
 * build. Si falla, el deploy se aborta.
 */

const fs = require('fs');
const path = require('path');

const globalsCssPath = path.resolve(__dirname, '../app/globals.css');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo leer ${filePath}: ${String(error)}`);
  }
}

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function main() {
  const rawSource = readFileSafe(globalsCssPath);
  const source = stripCssComments(rawSource);

  const checks = [
    {
      name: 'noWebkitOverflowScrollingTouch',
      pass: !/-webkit-overflow-scrolling\s*:\s*touch/i.test(source),
      detail:
        '`-webkit-overflow-scrolling: touch` esta prohibido en app/globals.css. Activa el compositor de mosaicos iOS y genera parpadeo al scrollear rapido.',
    },
    {
      name: 'noUniversalWillChangeTransformOnButtons',
      pass: (() => {
        // Busca reglas que combinan selector universal de botones con `will-change: transform`.
        const blockRegex = /\.pf-action-btn\s*,\s*button\s*,\s*\[role="button"\]\s*\{[^}]*\}/g;
        const matches = source.match(blockRegex) || [];
        return !matches.some((block) => /will-change\s*:\s*transform/i.test(block));
      })(),
      detail:
        '`will-change: transform` en el selector global de botones esta prohibido. Promueve cada boton a capa GPU y agota memoria de texturas en iOS.',
    },
    {
      name: 'noContentVisibilityAutoOnStagePanel',
      pass: (() => {
        const blockRegex = /\.pf-alumno-stage-panel\s*\{[^}]*\}/g;
        const matches = source.match(blockRegex) || [];
        return !matches.some((block) => /content-visibility\s*:\s*auto/i.test(block));
      })(),
      detail:
        '`content-visibility: auto` en .pf-alumno-stage-panel esta prohibido. Difiere el paint offscreen y causa flash al entrar por scroll.',
    },
    {
      name: 'noContainLayoutOrPaintOnStagePanel',
      pass: (() => {
        const blockRegex = /\.pf-alumno-stage-panel\s*\{[^}]*\}/g;
        const matches = source.match(blockRegex) || [];
        return !matches.some((block) => /contain\s*:\s*(?:layout|paint|strict|content)/i.test(block));
      })(),
      detail:
        '`contain: layout|paint|strict|content` en .pf-alumno-stage-panel esta prohibido. Causa repaint tardio en scroll mobile.',
    },
    {
      name: 'stagePanelKeepsContainNoneAndVisible',
      pass: (() => {
        const blockRegex = /\.pf-alumno-stage-panel\s*\{([^}]*)\}/;
        const match = source.match(blockRegex);
        if (!match) return false;
        const block = match[1];
        return (
          /contain\s*:\s*none/i.test(block) &&
          /content-visibility\s*:\s*visible/i.test(block)
        );
      })(),
      detail:
        '.pf-alumno-stage-panel debe declarar `contain: none` y `content-visibility: visible` explicitos (candado anti-regresion).',
    },
    {
      name: 'noUniversalImportantInAlumnoMain',
      pass: (() => {
        // Detecta reglas tipo `.pf-alumno-main *` con `!important` para propiedades de paint.
        const blockRegex = /\.pf-alumno-main\s+\*[^{]*\{([^}]*)\}/g;
        let match;
        while ((match = blockRegex.exec(source)) !== null) {
          if (/!important/i.test(match[1])) {
            return false;
          }
        }
        return true;
      })(),
      detail:
        'Reglas universales `*` con `!important` dentro de .pf-alumno-main estan prohibidas. Fuerzan style recalc masivo y traban la UI.',
    },
    {
      name: 'noUniversalImportantInTrainingShell',
      pass: (() => {
        const blockRegex = /\.pf-training-shell\s+\*(?:::before|::after)?(?:\s*,\s*\.pf-training-shell\s+\*(?:::before|::after)?)*\s*\{([^}]*)\}/g;
        let match;
        while ((match = blockRegex.exec(source)) !== null) {
          if (/!important/i.test(match[1])) {
            return false;
          }
        }
        return true;
      })(),
      detail:
        'Reglas universales `*` con `!important` dentro de .pf-training-shell estan prohibidas.',
    },
  ];

  const failed = checks.filter((check) => !check.pass);
  const output = {
    ok: failed.length === 0,
    file: path.relative(process.cwd(), globalsCssPath),
    failedChecks: failed.map((item) => item.name),
    checks,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exit(1);
  }
}

main();
