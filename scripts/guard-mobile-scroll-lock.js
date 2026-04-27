const fs = require("fs");
const path = require("path");

const globalsCssPath = path.resolve(__dirname, "../app/globals.css");
const mobileAppPath = path.resolve(__dirname, "../pf-control-mobile/App.tsx");

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`No se pudo leer ${filePath}: ${String(error)}`);
  }
}

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRuleBody(cssSource, selector) {
  const selectorRegex = new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const match = cssSource.match(selectorRegex);
  return match ? match[1] : "";
}

function hasDeclaration(ruleBody, declarationRegex) {
  return declarationRegex.test(ruleBody);
}

function buildMobileCheck(name, regex, detail, mobileAppExists, mobileAppSource) {
  const skipped = !mobileAppExists;
  return {
    name,
    pass: skipped || regex.test(mobileAppSource),
    detail: skipped ? `${detail} (omitido: pf-control-mobile/App.tsx no esta presente en este entorno).` : detail,
    skipped,
  };
}

function main() {
  const globalsCssRaw = readFileSafe(globalsCssPath);
  const globalsCss = stripCssComments(globalsCssRaw);
  const mobileAppExists = fileExists(mobileAppPath);
  const mobileAppSource = mobileAppExists ? readFileSafe(mobileAppPath) : "";

  const stagePanelBody = getRuleBody(globalsCss, ".pf-alumno-stage-panel");
  const stageHiddenBody = getRuleBody(globalsCss, ".pf-alumno-stage-hidden");
  const stageActiveBody = getRuleBody(globalsCss, ".pf-alumno-stage-active");
  const sidebarStaticBody = getRuleBody(globalsCss, ".pf-sidebar-static");
  const sidebarCategoryStaticBody = getRuleBody(globalsCss, ".pf-sidebar-category-static");
  const sidebarAvatarBody = getRuleBody(globalsCss, ".pf-sidebar-avatar-shell");

  const checks = [
    {
      name: "noWebkitOverflowScrollingTouch",
      pass: !/-webkit-overflow-scrolling\s*:\s*touch\b/i.test(globalsCss),
      detail:
        "app/globals.css no debe contener -webkit-overflow-scrolling: touch (causa paint por tiles y parpadeo al scrollear).",
    },
    {
      name: "noContentVisibilityAuto",
      pass: !/content-visibility\s*:\s*auto\b/i.test(globalsCss),
      detail:
        "app/globals.css no debe usar content-visibility:auto en paneles de alumno.",
    },
    {
      name: "noContainIntrinsicSize",
      pass: !/contain-intrinsic-size\s*:/i.test(globalsCss),
      detail:
        "app/globals.css no debe usar contain-intrinsic-size en stage/paneles de alumno.",
    },
    {
      name: "stagePanelContainNone",
      pass: hasDeclaration(stagePanelBody, /contain\s*:\s*none\b/i),
      detail: ".pf-alumno-stage-panel debe mantener contain:none.",
    },
    {
      name: "stagePanelContentVisibilityVisible",
      pass: hasDeclaration(stagePanelBody, /content-visibility\s*:\s*visible\b/i),
      detail: ".pf-alumno-stage-panel debe mantener content-visibility:visible.",
    },
    {
      name: "stageHiddenDisplayNoneImportant",
      pass: hasDeclaration(stageHiddenBody, /display\s*:\s*none\s*!important\b/i),
      detail: ".pf-alumno-stage-hidden debe mantener display:none !important.",
    },
    {
      name: "stageActiveAnimationNone",
      pass: hasDeclaration(stageActiveBody, /animation\s*:\s*none\b/i),
      detail: ".pf-alumno-stage-active debe mantener animation:none.",
    },
    {
      name: "sidebarStaticNoContainPaint",
      pass: !hasDeclaration(sidebarStaticBody, /contain\s*:\s*paint\b/i),
      detail: ".pf-sidebar-static no debe usar contain:paint.",
    },
    {
      name: "sidebarCategoryStaticNoContainPaint",
      pass: !hasDeclaration(sidebarCategoryStaticBody, /contain\s*:\s*paint\b/i),
      detail: ".pf-sidebar-category-static no debe usar contain:paint.",
    },
    {
      name: "sidebarAvatarNoContainPaint",
      pass: !hasDeclaration(sidebarAvatarBody, /contain\s*:\s*paint\b/i),
      detail: ".pf-sidebar-avatar-shell no debe usar contain:paint.",
    },
    buildMobileCheck(
      "webViewPullToRefreshDisabled",
      /pullToRefreshEnabled=\{false\}/,
      "pf-control-mobile/App.tsx debe mantener pullToRefreshEnabled={false}.",
      mobileAppExists,
      mobileAppSource,
    ),
    buildMobileCheck(
      "webViewOverScrollDisabled",
      /overScrollMode="never"/,
      "pf-control-mobile/App.tsx debe mantener overScrollMode=\"never\".",
      mobileAppExists,
      mobileAppSource,
    ),
    buildMobileCheck(
      "webViewSoftwareLayer",
      /androidLayerType="software"/,
      "pf-control-mobile/App.tsx debe mantener androidLayerType=\"software\".",
      mobileAppExists,
      mobileAppSource,
    ),
    buildMobileCheck(
      "webViewHardwareAccelerationDisabled",
      /androidHardwareAccelerationDisabled\b/,
      "pf-control-mobile/App.tsx debe mantener androidHardwareAccelerationDisabled.",
      mobileAppExists,
      mobileAppSource,
    ),
  ];

  const failed = checks.filter((check) => !check.pass);
  const output = {
    ok: failed.length === 0,
    files: {
      globalsCss: path.relative(process.cwd(), globalsCssPath),
      mobileApp: path.relative(process.cwd(), mobileAppPath),
    },
    mobileAppPresent: mobileAppExists,
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
