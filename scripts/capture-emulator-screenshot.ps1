$ErrorActionPreference = "Stop"

param(
  [string]$Device = "emulator-5554",
  [string]$OutputPath = "storage/copilot-screenshot.png"
)

function Test-SupportedImageSignature {
  param([byte[]]$Bytes)

  if ($Bytes.Length -lt 8) {
    return $false
  }

  $isPng = (
    $Bytes[0] -eq 0x89 -and
    $Bytes[1] -eq 0x50 -and
    $Bytes[2] -eq 0x4E -and
    $Bytes[3] -eq 0x47 -and
    $Bytes[4] -eq 0x0D -and
    $Bytes[5] -eq 0x0A -and
    $Bytes[6] -eq 0x1A -and
    $Bytes[7] -eq 0x0A
  )

  $isJpeg = (
    $Bytes.Length -ge 2 -and
    $Bytes[0] -eq 0xFF -and
    $Bytes[1] -eq 0xD8
  )

  $isGif = (
    $Bytes.Length -ge 6 -and
    $Bytes[0] -eq 0x47 -and
    $Bytes[1] -eq 0x49 -and
    $Bytes[2] -eq 0x46 -and
    $Bytes[3] -eq 0x38 -and
    ($Bytes[4] -eq 0x37 -or $Bytes[4] -eq 0x39) -and
    $Bytes[5] -eq 0x61
  )

  $isWebp = (
    $Bytes.Length -ge 12 -and
    $Bytes[0] -eq 0x52 -and
    $Bytes[1] -eq 0x49 -and
    $Bytes[2] -eq 0x46 -and
    $Bytes[3] -eq 0x46 -and
    $Bytes[8] -eq 0x57 -and
    $Bytes[9] -eq 0x45 -and
    $Bytes[10] -eq 0x42 -and
    $Bytes[11] -eq 0x50
  )

  return ($isPng -or $isJpeg -or $isGif -or $isWebp)
}

$adbCmd = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbCmd) {
  Write-Host "adb no esta disponible en PATH." -ForegroundColor Red
  exit 1
}

& adb start-server | Out-Null

$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath
} else {
  Join-Path (Get-Location) $OutputPath
}

$outputDir = Split-Path -Parent $resolvedOutput
if ($outputDir -and -not (Test-Path $outputDir)) {
  New-Item -Path $outputDir -ItemType Directory -Force | Out-Null
}

$tmpPath = "$resolvedOutput.tmp"
if (Test-Path $tmpPath) {
  Remove-Item $tmpPath -Force
}

$process = Start-Process \
  -FilePath "adb" \
  -ArgumentList @("-s", $Device, "exec-out", "screencap", "-p") \
  -NoNewWindow \
  -Wait \
  -PassThru \
  -RedirectStandardOutput $tmpPath

if ($process.ExitCode -ne 0) {
  if (Test-Path $tmpPath) {
    Remove-Item $tmpPath -Force
  }
  Write-Host "adb devolvio ExitCode=$($process.ExitCode) al capturar pantalla." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $tmpPath)) {
  Write-Host "No se genero salida de captura." -ForegroundColor Red
  exit 1
}

$bytes = [System.IO.File]::ReadAllBytes($tmpPath)
if (-not (Test-SupportedImageSignature -Bytes $bytes)) {
  Remove-Item $tmpPath -Force
  Write-Host "La captura no es una imagen valida (png/jpg/gif/webp)." -ForegroundColor Red
  exit 1
}

[System.IO.File]::WriteAllBytes($resolvedOutput, $bytes)
Remove-Item $tmpPath -Force

Write-Host "Screenshot valida creada: $resolvedOutput" -ForegroundColor Green
Write-Host "Tamano: $($bytes.Length) bytes" -ForegroundColor DarkGray
