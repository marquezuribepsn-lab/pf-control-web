param(
  [string]$Server = "root@72.60.55.235",
  [string]$RemoteDir = "/root/pf-control-web",
  [int]$IntervalMinutes = 10
)

$ErrorActionPreference = "Stop"

if ($IntervalMinutes -lt 1 -or $IntervalMinutes -gt 60) {
  throw "IntervalMinutes debe estar entre 1 y 60."
}

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

$cronExpr = if ($IntervalMinutes -eq 60) { "0 * * * *" } else { "*/$IntervalMinutes * * * *" }
$remoteScriptPath = "/usr/local/bin/pf-login-healthcheck.sh"
$cronMarker = "# pf-control-login-healthcheck"

$scriptRoot = Split-Path -Parent $PSCommandPath
$smokeScriptLocalPath = Join-Path $scriptRoot "smoke-login-admin.js"
if (-not (Test-Path -LiteralPath $smokeScriptLocalPath)) {
  throw "No se encontro smoke-login-admin.js en $smokeScriptLocalPath"
}

$tempRoot = if ([string]::IsNullOrWhiteSpace($env:TEMP)) { [System.IO.Path]::GetTempPath() } else { $env:TEMP }
$localTempScript = Join-Path $tempRoot "pf-login-healthcheck.sh"
$localCronSetupScript = Join-Path $tempRoot "pf-setup-login-cron.sh"

Write-Host "[1/1] Configurando verificacion automatica de login en VPS..."
$scriptContent = @"
#!/usr/bin/env bash
set -euo pipefail
cd $RemoteDir
if [ -f .env.production ]; then
  export `$(grep -v '^#' .env.production | grep '=' | tr -d '\r' | xargs)
fi
if [ -f .db.env ]; then
  export `$(grep -v '^#' .db.env | grep '=' | tr -d '\r' | xargs)
fi

if [ -z "`${SMOKE_MAIN_EMAIL:-}" ] && [ -n "`${ACCESS_USER_EMAIL:-}" ]; then
  export SMOKE_MAIN_EMAIL="`${ACCESS_USER_EMAIL}"
fi

if [ -z "`${SMOKE_MAIN_PASSWORD:-}" ] && [ -n "`${ACCESS_USER_PASSWORD:-}" ]; then
  export SMOKE_MAIN_PASSWORD="`${ACCESS_USER_PASSWORD}"
fi

export SMOKE_BASE_URL="https://pf-control.com"
export SMOKE_REQUIRE_ADMIN_LOGIN="1"

if [ -z "`${SMOKE_MAIN_EMAIL:-}" ] || [ -z "`${SMOKE_MAIN_PASSWORD:-}" ]; then
  echo "{\"ok\":false,\"error\":\"SMOKE_MAIN_EMAIL/SMOKE_MAIN_PASSWORD requeridos para healthcheck estricto\",\"checkedAt\":\"`$(date -Is)\"}" >> /var/log/pf-login-healthcheck.log
  exit 1
fi

/usr/bin/node scripts/smoke-login-admin.js >> /var/log/pf-login-healthcheck.log 2>&1
"@

$cronSetupContent = @"
#!/usr/bin/env bash
set -euo pipefail
remote_script_path="$remoteScriptPath"
cron_expr="$cronExpr"
cron_marker="$cronMarker"

chmod +x "`$remote_script_path"
trap 'rm -f "`$tmp"' EXIT
existing=`$(crontab -l 2>/dev/null || true)
filtered=`$(printf "%s\n" "`$existing" | grep -vi '^no crontab for' | grep -v 'pf-control-login-healthcheck' || true)
tmp=`$(mktemp)
if [ -n "`$filtered" ]; then
  printf "%s\n" "`$filtered" > "`$tmp"
else
  : > "`$tmp"
fi
printf "%s %s %s\n" "`$cron_expr" "`$remote_script_path" "`$cron_marker" >> "`$tmp"
crontab "`$tmp"
echo "Healthcheck cron configurado: `$(printf '%s' "`$cron_expr")"
"@

$scriptUnix = $scriptContent -replace "`r", ""
$cronSetupUnix = $cronSetupContent -replace "`r", ""

try {
  [System.IO.File]::WriteAllText($localTempScript, $scriptUnix, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText($localCronSetupScript, $cronSetupUnix, [System.Text.UTF8Encoding]::new($false))

  Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $localTempScript,
    "$Server`:$remoteScriptPath"
  ) -FailureMessage "No se pudo copiar el script de healthcheck al VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $smokeScriptLocalPath,
    "$Server`:$RemoteDir/scripts/smoke-login-admin.js"
  ) -FailureMessage "No se pudo copiar smoke-login-admin.js al VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $localCronSetupScript,
    "$Server`:/tmp/pf-setup-login-cron.sh"
  ) -FailureMessage "No se pudo copiar el script de configuracion de cron al VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "ssh.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $Server,
    "bash /tmp/pf-setup-login-cron.sh ; rm -f /tmp/pf-setup-login-cron.sh"
  ) -FailureMessage "No se pudo configurar el healthcheck automatico en VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "ssh.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $Server,
    "crontab -l | grep -q pf-control-login-healthcheck"
  ) -FailureMessage "No se detecto el cron de healthcheck despues de configurar." -MaxAttempts 2 -DelaySeconds 1

  Write-Host "Verificacion automatica configurada."
}
finally {
  Remove-Item -LiteralPath $localTempScript -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $localCronSetupScript -Force -ErrorAction SilentlyContinue
}
