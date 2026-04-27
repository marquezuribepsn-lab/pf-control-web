$ErrorActionPreference = "Stop"

function Invoke-AdbSettingPut {
  param(
    [Parameter(Mandatory = $true)][string]$Device,
    [Parameter(Mandatory = $true)][string]$Namespace,
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )

  & adb -s $Device shell settings put $Namespace $Key $Value | Out-Null
}

function Invoke-AdbSettingGet {
  param(
    [Parameter(Mandatory = $true)][string]$Device,
    [Parameter(Mandatory = $true)][string]$Namespace,
    [Parameter(Mandatory = $true)][string]$Key
  )

  (& adb -s $Device shell settings get $Namespace $Key).Trim()
}

$adbCmd = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbCmd) {
  Write-Host "adb no esta disponible en PATH. Abri Android Studio y agrega platform-tools al PATH." -ForegroundColor Red
  exit 1
}

& adb start-server | Out-Null

$deviceLines = & adb devices
$devices = @()
foreach ($line in $deviceLines) {
  if ($line -match "^\s*(\S+)\s+device\s*$") {
    $deviceId = $matches[1]
    if ($deviceId -ne "List") {
      $devices += $deviceId
    }
  }
}

if ($devices.Count -eq 0) {
  Write-Host "No hay dispositivos Android conectados. Inicia el emulador y volve a correr este script." -ForegroundColor Yellow
  exit 0
}

$settingsToApply = @(
  @{ Namespace = "global"; Key = "window_animation_scale"; Value = "0" },
  @{ Namespace = "global"; Key = "transition_animation_scale"; Value = "0" },
  @{ Namespace = "global"; Key = "animator_duration_scale"; Value = "0" },
  @{ Namespace = "global"; Key = "always_finish_activities"; Value = "0" },
  @{ Namespace = "system"; Key = "pointer_location"; Value = "0" },
  @{ Namespace = "system"; Key = "show_touches"; Value = "0" }
)

foreach ($device in $devices) {
  Write-Host "Aplicando perfil de fluidez en $device..." -ForegroundColor Cyan

  foreach ($setting in $settingsToApply) {
    try {
      Invoke-AdbSettingPut -Device $device -Namespace $setting.Namespace -Key $setting.Key -Value $setting.Value
    } catch {
      Write-Warning "No se pudo aplicar $($setting.Namespace).$($setting.Key) en $device"
    }
  }

  $windowScale = Invoke-AdbSettingGet -Device $device -Namespace "global" -Key "window_animation_scale"
  $transitionScale = Invoke-AdbSettingGet -Device $device -Namespace "global" -Key "transition_animation_scale"
  $animatorScale = Invoke-AdbSettingGet -Device $device -Namespace "global" -Key "animator_duration_scale"

  Write-Host "Perfil aplicado en $device -> window=$windowScale transition=$transitionScale animator=$animatorScale" -ForegroundColor Green
}

Write-Host "Listo. Usa npm run android:run:boosted para iniciar Expo con el emulador tuneado." -ForegroundColor Green
