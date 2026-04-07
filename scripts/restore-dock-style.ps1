param(
  [string]$Tag = "restore-dock-2026-04-06-sidebar-order-lock",
  [string]$TargetFile = "components/AppShell.tsx",
  [switch]$NoCommit,
  [switch]$Push
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function RunGit([string]$Command) {
  Write-Host "git $Command"
  Invoke-Expression "git $Command"
  if ($LASTEXITCODE -ne 0) {
    Fail "Fallo: git $Command"
  }
}

git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
  Fail "Este directorio no es un repositorio git."
}

$dirty = git status --porcelain
if ($dirty) {
  Fail "Hay cambios sin commitear. Guarda/commitea antes de restaurar la barra."
}

Write-Host "[1/4] Verificando tag de restore..."
RunGit "fetch --tags --quiet"
$tagExists = git rev-parse --verify --quiet "refs/tags/$Tag"
if (-not $tagExists) {
  Fail "No existe el tag '$Tag'."
}

Write-Host "[2/4] Restaurando archivo de barra desde tag..."
RunGit "checkout $Tag -- $TargetFile"

$changed = git diff --name-only -- $TargetFile
if (-not $changed) {
  Write-Host "No habia diferencias para restaurar en $TargetFile."
  exit 0
}

if ($NoCommit) {
  Write-Host "[3/4] Restauracion aplicada sin commit (-NoCommit)."
  Write-Host "Revisa cambios y commitea manualmente si corresponde."
  exit 0
}

Write-Host "[3/4] Creando commit de restauracion de barra..."
RunGit "add $TargetFile"
RunGit "commit -m \"restore(ui): rollback dock style from $Tag\""

if ($Push) {
  Write-Host "[4/4] Publicando commit en remoto..."
  RunGit "push"
} else {
  Write-Host "[4/4] Commit creado localmente. Usa 'git push' cuando quieras publicarlo."
}

Write-Host "Restauracion de barra completada."
