$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [string]$OutputPath
)

function Get-ImageFormat {
  param([byte[]]$Bytes)

  if ($Bytes.Length -ge 8 -and
    $Bytes[0] -eq 0x89 -and
    $Bytes[1] -eq 0x50 -and
    $Bytes[2] -eq 0x4E -and
    $Bytes[3] -eq 0x47 -and
    $Bytes[4] -eq 0x0D -and
    $Bytes[5] -eq 0x0A -and
    $Bytes[6] -eq 0x1A -and
    $Bytes[7] -eq 0x0A) {
    return "png"
  }

  if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xD8) {
    return "jpeg"
  }

  if ($Bytes.Length -ge 6 -and
    $Bytes[0] -eq 0x47 -and
    $Bytes[1] -eq 0x49 -and
    $Bytes[2] -eq 0x46 -and
    $Bytes[3] -eq 0x38 -and
    ($Bytes[4] -eq 0x37 -or $Bytes[4] -eq 0x39) -and
    $Bytes[5] -eq 0x61) {
    return "gif"
  }

  if ($Bytes.Length -ge 12 -and
    $Bytes[0] -eq 0x52 -and
    $Bytes[1] -eq 0x49 -and
    $Bytes[2] -eq 0x46 -and
    $Bytes[3] -eq 0x46 -and
    $Bytes[8] -eq 0x57 -and
    $Bytes[9] -eq 0x45 -and
    $Bytes[10] -eq 0x42 -and
    $Bytes[11] -eq 0x50) {
    return "webp"
  }

  return $null
}

function Convert-Utf16ExpandedBinary {
  param([byte[]]$Bytes)

  if ($Bytes.Length -lt 4) {
    return $null
  }

  if ($Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) {
    if ((($Bytes.Length - 2) % 2) -ne 0) {
      return $null
    }

    $decoded = New-Object byte[] (($Bytes.Length - 2) / 2)
    for ($source = 2; $source -lt $Bytes.Length; $source += 2) {
      $target = ($source - 2) / 2
      $decoded[$target] = $Bytes[$source]
    }
    return $decoded
  }

  if ($Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF) {
    if ((($Bytes.Length - 2) % 2) -ne 0) {
      return $null
    }

    $decoded = New-Object byte[] (($Bytes.Length - 2) / 2)
    for ($source = 3; $source -lt $Bytes.Length; $source += 2) {
      $target = ($source - 3) / 2
      $decoded[$target] = $Bytes[$source]
    }
    return $decoded
  }

  return $null
}

$resolvedInput = Resolve-Path $InputPath -ErrorAction Stop
$inputFullPath = $resolvedInput.Path
$inputBytes = [System.IO.File]::ReadAllBytes($inputFullPath)

$alreadyValidFormat = Get-ImageFormat -Bytes $inputBytes
if ($alreadyValidFormat) {
  if ([string]::IsNullOrWhiteSpace($OutputPath) -or
    [System.IO.Path]::GetFullPath($OutputPath) -eq [System.IO.Path]::GetFullPath($inputFullPath)) {
    Write-Host "La imagen ya era valida ($alreadyValidFormat): $inputFullPath" -ForegroundColor Green
    exit 0
  }

  $resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
  } else {
    Join-Path (Get-Location) $OutputPath
  }

  $outputDir = Split-Path -Parent $resolvedOutput
  if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  }

  [System.IO.File]::WriteAllBytes($resolvedOutput, $inputBytes)
  Write-Host "Imagen valida copiada en: $resolvedOutput" -ForegroundColor Green
  exit 0
}

$decodedBytes = Convert-Utf16ExpandedBinary -Bytes $inputBytes
if (-not $decodedBytes) {
  Write-Host "No se pudo reparar: el archivo no es imagen valida ni binario UTF-16 reparable." -ForegroundColor Red
  exit 1
}

$decodedFormat = Get-ImageFormat -Bytes $decodedBytes
if (-not $decodedFormat) {
  Write-Host "No se pudo reparar: el contenido recuperado no es png/jpg/gif/webp." -ForegroundColor Red
  exit 1
}

$targetPath = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $inputFullPath
} elseif ([System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath
} else {
  Join-Path (Get-Location) $OutputPath
}

$targetDir = Split-Path -Parent $targetPath
if ($targetDir -and -not (Test-Path $targetDir)) {
  New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
}

[System.IO.File]::WriteAllBytes($targetPath, $decodedBytes)
Write-Host "Imagen reparada correctamente: $targetPath" -ForegroundColor Green
Write-Host "Formato detectado: $decodedFormat" -ForegroundColor DarkGray
Write-Host "Tamano final: $($decodedBytes.Length) bytes" -ForegroundColor DarkGray
