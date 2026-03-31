param(
  [string]$Server = "root@72.60.55.235",
  [string]$RemoteDir = "/root/pf-control-web",
  [string]$CronExpr = "15 3 * * *"
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

$scriptRoot = Split-Path -Parent $PSCommandPath
$probeLocalPath = Join-Path $scriptRoot "stress-platform-probe.js"
if (-not (Test-Path -LiteralPath $probeLocalPath)) {
  throw "No se encontro stress-platform-probe.js en $probeLocalPath"
}

$remoteRunnerPath = "/usr/local/bin/pf-stress-platform.sh"
$remoteSetupPath = "/tmp/pf-setup-stress-platform.sh"
$tempRoot = if ([string]::IsNullOrWhiteSpace($env:TEMP)) { [System.IO.Path]::GetTempPath() } else { $env:TEMP }
$localRunnerPath = Join-Path $tempRoot "pf-stress-platform.sh"
$localSetupPath = Join-Path $tempRoot "pf-setup-stress-platform.sh"

Write-Output "[1/1] Configurando stress probe diario en VPS..."

$runnerContent = @"
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

if [ -z "`${SMOKE_WHATSAPP_TEST_PHONE:-}" ] && [ -n "`${WHATSAPP_TO:-}" ]; then
  export SMOKE_WHATSAPP_TEST_PHONE="`${WHATSAPP_TO}"
fi

export SMOKE_BASE_URL="`${SMOKE_BASE_URL:-https://pf-control.com}"
export SMOKE_STRESS_LOOPS="`${SMOKE_STRESS_LOOPS:-2}"

node scripts/stress-platform-probe.js >> /var/log/pf-stress-platform.log 2>&1
"@

$setupContent = @"
#!/usr/bin/env bash
set -euo pipefail
remote_runner_path="$remoteRunnerPath"
cron_expr="$CronExpr"

chmod +x "`$remote_runner_path"
trap 'rm -f "`$tmp"' EXIT
existing=`$(crontab -l 2>/dev/null || true)
filtered=`$(printf "%s\n" "`$existing" | grep -vi '^no crontab for' | grep -v 'pf-stress-platform.sh' || true)
tmp=`$(mktemp)
if [ -n "`$filtered" ]; then
  printf "%s\n" "`$filtered" > "`$tmp"
else
  : > "`$tmp"
fi
printf "%s %s # pf-control-stress-platform\n" "`$cron_expr" "`$remote_runner_path" >> "`$tmp"
crontab "`$tmp"
"@

$runnerUnix = $runnerContent -replace "`r", ""
$setupUnix = $setupContent -replace "`r", ""

try {
  [System.IO.File]::WriteAllText($localRunnerPath, $runnerUnix, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText($localSetupPath, $setupUnix, [System.Text.UTF8Encoding]::new($false))

  Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $probeLocalPath,
    "$Server`:$RemoteDir/scripts/stress-platform-probe.js"
  ) -FailureMessage "No se pudo copiar stress-platform-probe.js al VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $localRunnerPath,
    "$Server`:$remoteRunnerPath"
  ) -FailureMessage "No se pudo copiar el runner de stress al VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "scp.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $localSetupPath,
    "$Server`:$remoteSetupPath"
  ) -FailureMessage "No se pudo copiar el script de cron de stress al VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "ssh.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $Server,
    "bash $remoteSetupPath ; rm -f $remoteSetupPath"
  ) -FailureMessage "No se pudo configurar cron de stress en VPS." -MaxAttempts 4 -DelaySeconds 3

  Invoke-ExternalWithRetry -Executable "ssh.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $Server,
    "/usr/local/bin/pf-stress-platform.sh || true"
  ) -FailureMessage "No se pudo ejecutar el runner de stress de prueba en VPS." -MaxAttempts 2 -DelaySeconds 1

  Invoke-ExternalWithRetry -Executable "ssh.exe" -Arguments @(
    "-o", "StrictHostKeyChecking=accept-new",
    $Server,
    "crontab -l | grep -q pf-control-stress-platform"
  ) -FailureMessage "No se detecto cron de stress luego de configurar." -MaxAttempts 2 -DelaySeconds 1

  Write-Output "Stress probe diario configurado correctamente."
}
finally {
  Remove-Item -LiteralPath $localRunnerPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $localSetupPath -Force -ErrorAction SilentlyContinue
}
