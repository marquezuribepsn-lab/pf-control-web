param(
  [string]$Server = "root@72.60.55.235",
  [string]$RemoteDir = "/root/pf-control-web",
  [string]$BaseUrl = "https://pf-control.com",
  [string]$RemoteScreenshotPath = "/root/pf-control-web/storage/smoke-clientes-visual-vps.png",
  [string]$RemoteRunnerPath = "/usr/local/bin/pf-clientes-visual-smoke.sh",
  [string]$RemoteLogPath = "/var/log/pf-clientes-visual-smoke.log",
  [int]$MinAvatarImages = 0,
  [int]$MinOnlineRows = 0,
  [int]$IntervalMinutes = 30,
  [switch]$RequireAvatarImage,
  [switch]$RequireOnlineRow,
  [switch]$InstallCron,
  [switch]$InstallWithDeps
)

$ErrorActionPreference = "Stop"

function Invoke-ExternalWithRetry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Executable,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [string]$FailureMessage,
    [int]$MaxAttempts = 3,
    [int]$DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt += 1) {
    & $Executable @Arguments
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
      return
    }

    if ($attempt -lt $MaxAttempts) {
      Write-Warning ("Intento {0}/{1} fallo para {2} (exit {3}). Reintentando..." -f $attempt, $MaxAttempts, $Executable, $exitCode)
      Start-Sleep -Seconds $DelaySeconds
      continue
    }

    throw ("{0} (exit {1})" -f $FailureMessage, $exitCode)
  }
}

if ($MinAvatarImages -lt 0) {
  throw "MinAvatarImages no puede ser negativo."
}

if ($MinOnlineRows -lt 0) {
  throw "MinOnlineRows no puede ser negativo."
}

if ($IntervalMinutes -lt 1 -or $IntervalMinutes -gt 60) {
  throw "IntervalMinutes debe estar entre 1 y 60."
}

$scriptRoot = Split-Path -Parent $PSCommandPath
$localSmokeScriptPath = Join-Path $scriptRoot "smoke-clientes-visual.js"
if (-not (Test-Path -LiteralPath $localSmokeScriptPath)) {
  throw "No se encontro smoke-clientes-visual.js en $localSmokeScriptPath"
}

$effectiveMinAvatarImages = if ($RequireAvatarImage -and $MinAvatarImages -lt 1) { 1 } else { $MinAvatarImages }
$effectiveMinOnlineRows = if ($RequireOnlineRow -and $MinOnlineRows -lt 1) { 1 } else { $MinOnlineRows }
$playwrightInstallCommand = if ($InstallWithDeps) {
  "npx playwright install --with-deps chromium"
} else {
  "npx playwright install chromium"
}
$cronExpr = if ($IntervalMinutes -eq 60) { "0 * * * *" } else { "*/$IntervalMinutes * * * *" }
$cronMarker = "# pf-control-clientes-visual-smoke"

$tempRoot = if ([string]::IsNullOrWhiteSpace($env:TEMP)) { [System.IO.Path]::GetTempPath() } else { $env:TEMP }
$localTempSetupScript = Join-Path $tempRoot "pf-setup-clientes-visual-smoke.sh"

Write-Output "[1/1] Instalando y ejecutando smoke visual de Clientes en VPS..."

$setupTemplate = @'
#!/usr/bin/env bash
set -euo pipefail

cd __REMOTE_DIR__

if ! /usr/bin/node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  npm install --no-save --no-package-lock playwright@1.58.2
fi

__PLAYWRIGHT_INSTALL_COMMAND__

if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | grep '=' | tr -d '\r' | xargs)
fi

if [ -z "${SMOKE_MAIN_EMAIL:-}" ] && [ -n "${ACCESS_USER_EMAIL:-}" ]; then
  export SMOKE_MAIN_EMAIL="${ACCESS_USER_EMAIL}"
fi

if [ -z "${SMOKE_MAIN_PASSWORD:-}" ] && [ -n "${ACCESS_USER_PASSWORD:-}" ]; then
  export SMOKE_MAIN_PASSWORD="${ACCESS_USER_PASSWORD}"
fi

export SMOKE_BASE_URL="__BASE_URL__"
export SMOKE_SCREENSHOT_PATH="__REMOTE_SCREENSHOT_PATH__"
export SMOKE_CLIENTES_MIN_AVATAR_IMAGES="__MIN_AVATAR_IMAGES__"
export SMOKE_CLIENTES_MIN_ONLINE_ROWS="__MIN_ONLINE_ROWS__"
export SMOKE_CLIENTES_REQUIRE_AVATAR_IMAGE="__REQUIRE_AVATAR_IMAGE__"
export SMOKE_CLIENTES_REQUIRE_ONLINE_ROW="__REQUIRE_ONLINE_ROW__"

node scripts/smoke-clientes-visual.js
'@

$runnerTemplate = @'
#!/usr/bin/env bash
set -euo pipefail

cd __REMOTE_DIR__

if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | grep '=' | tr -d '\r' | xargs)
fi

if [ -z "${SMOKE_MAIN_EMAIL:-}" ] && [ -n "${ACCESS_USER_EMAIL:-}" ]; then
  export SMOKE_MAIN_EMAIL="${ACCESS_USER_EMAIL}"
fi

if [ -z "${SMOKE_MAIN_PASSWORD:-}" ] && [ -n "${ACCESS_USER_PASSWORD:-}" ]; then
  export SMOKE_MAIN_PASSWORD="${ACCESS_USER_PASSWORD}"
fi

export SMOKE_BASE_URL="__BASE_URL__"
export SMOKE_SCREENSHOT_PATH="__REMOTE_SCREENSHOT_PATH__"
export SMOKE_CLIENTES_MIN_AVATAR_IMAGES="__MIN_AVATAR_IMAGES__"
export SMOKE_CLIENTES_MIN_ONLINE_ROWS="__MIN_ONLINE_ROWS__"
export SMOKE_CLIENTES_REQUIRE_AVATAR_IMAGE="__REQUIRE_AVATAR_IMAGE__"
export SMOKE_CLIENTES_REQUIRE_ONLINE_ROW="__REQUIRE_ONLINE_ROW__"

/usr/bin/node scripts/smoke-clientes-visual.js >> __REMOTE_LOG_PATH__ 2>&1
'@

$cronSetupTemplate = @'
#!/usr/bin/env bash
set -euo pipefail

remote_runner_path="__REMOTE_RUNNER_PATH__"
cron_expr="__CRON_EXPR__"
cron_marker="__CRON_MARKER__"

chmod +x "$remote_runner_path"
trap 'rm -f "$tmp"' EXIT
existing=$(crontab -l 2>/dev/null || true)
filtered=$(printf "%s\n" "$existing" | grep -vi '^no crontab for' | grep -v 'pf-control-clientes-visual-smoke' || true)
tmp=$(mktemp)
if [ -n "$filtered" ]; then
  printf "%s\n" "$filtered" > "$tmp"
else
  : > "$tmp"
fi
printf "%s %s %s\n" "$cron_expr" "$remote_runner_path" "$cron_marker" >> "$tmp"
crontab "$tmp"
echo "Clientes visual smoke cron configurado: $cron_expr"
'@

$setupUnix = $setupTemplate.Replace('__REMOTE_DIR__', $RemoteDir)
$setupUnix = $setupUnix.Replace('__PLAYWRIGHT_INSTALL_COMMAND__', $playwrightInstallCommand)
$setupUnix = $setupUnix.Replace('__BASE_URL__', $BaseUrl)
$setupUnix = $setupUnix.Replace('__REMOTE_SCREENSHOT_PATH__', $RemoteScreenshotPath)
$setupUnix = $setupUnix.Replace('__MIN_AVATAR_IMAGES__', [string]$effectiveMinAvatarImages)
$setupUnix = $setupUnix.Replace('__MIN_ONLINE_ROWS__', [string]$effectiveMinOnlineRows)
$setupUnix = $setupUnix.Replace('__REQUIRE_AVATAR_IMAGE__', $(if ($RequireAvatarImage) { '1' } else { '0' }))
$setupUnix = $setupUnix.Replace('__REQUIRE_ONLINE_ROW__', $(if ($RequireOnlineRow) { '1' } else { '0' }))
$setupUnix = $setupUnix -replace "`r", ""

$runnerUnix = $runnerTemplate.Replace('__REMOTE_DIR__', $RemoteDir)
$runnerUnix = $runnerUnix.Replace('__BASE_URL__', $BaseUrl)
$runnerUnix = $runnerUnix.Replace('__REMOTE_SCREENSHOT_PATH__', $RemoteScreenshotPath)
$runnerUnix = $runnerUnix.Replace('__MIN_AVATAR_IMAGES__', [string]$effectiveMinAvatarImages)
$runnerUnix = $runnerUnix.Replace('__MIN_ONLINE_ROWS__', [string]$effectiveMinOnlineRows)
$runnerUnix = $runnerUnix.Replace('__REQUIRE_AVATAR_IMAGE__', $(if ($RequireAvatarImage) { '1' } else { '0' }))
$runnerUnix = $runnerUnix.Replace('__REQUIRE_ONLINE_ROW__', $(if ($RequireOnlineRow) { '1' } else { '0' }))
$runnerUnix = $runnerUnix.Replace('__REMOTE_LOG_PATH__', $RemoteLogPath)
$runnerUnix = $runnerUnix -replace "`r", ""

$cronSetupUnix = $cronSetupTemplate.Replace('__REMOTE_RUNNER_PATH__', $RemoteRunnerPath)
$cronSetupUnix = $cronSetupUnix.Replace('__CRON_EXPR__', $cronExpr)
$cronSetupUnix = $cronSetupUnix.Replace('__CRON_MARKER__', $cronMarker)
$cronSetupUnix = $cronSetupUnix -replace "`r", ""

$localTempRunnerScript = Join-Path $tempRoot "pf-clientes-visual-smoke.sh"
$localTempCronSetupScript = Join-Path $tempRoot "pf-setup-clientes-visual-cron.sh"

try {
  [System.IO.File]::WriteAllText($localTempSetupScript, $setupUnix, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText($localTempRunnerScript, $runnerUnix, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText($localTempCronSetupScript, $cronSetupUnix, [System.Text.UTF8Encoding]::new($false))

  Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $localSmokeScriptPath,
    "$Server`:$RemoteDir/scripts/smoke-clientes-visual.js"
  ) -FailureMessage "No se pudo copiar smoke-clientes-visual.js al VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $localTempRunnerScript,
    "$Server`:$RemoteRunnerPath"
  ) -FailureMessage "No se pudo copiar el runner del smoke visual al VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $localTempSetupScript,
    "$Server`:/tmp/pf-setup-clientes-visual-smoke.sh"
  ) -FailureMessage "No se pudo copiar el setup del smoke visual al VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "ssh.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $Server,
    "bash /tmp/pf-setup-clientes-visual-smoke.sh ; rm -f /tmp/pf-setup-clientes-visual-smoke.sh"
  ) -FailureMessage "No se pudo instalar/ejecutar el smoke visual en VPS." -MaxAttempts 2 -DelaySeconds 2

  if ($InstallCron) {
    Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
      "-o", "StrictHostKeyChecking=accept-new",
      $localTempCronSetupScript,
      "$Server`:/tmp/pf-setup-clientes-visual-cron.sh"
    ) -FailureMessage "No se pudo copiar el setup del cron visual al VPS." -MaxAttempts 4 -DelaySeconds 3

    Invoke-ExternalWithRetry -Executable "ssh.exe" -Arguments @(
      "-o", "StrictHostKeyChecking=accept-new",
      $Server,
      "bash /tmp/pf-setup-clientes-visual-cron.sh ; rm -f /tmp/pf-setup-clientes-visual-cron.sh ; crontab -l | grep -q pf-control-clientes-visual-smoke"
    ) -FailureMessage "No se pudo configurar el cron del smoke visual en VPS." -MaxAttempts 2 -DelaySeconds 2
  }
}
finally {
  Remove-Item -LiteralPath $localTempSetupScript -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $localTempRunnerScript -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $localTempCronSetupScript -Force -ErrorAction SilentlyContinue
}