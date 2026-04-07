param(
  [string]$Tag = "restore-dock-2026-04-06-sidebar-order-lock",
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
  Fail "Hay cambios sin commitear. Guarda/commitea antes del rollback completo."
}

Write-Host "[1/5] Verificando tag de restore..."
RunGit "fetch --tags --quiet"
$tagExists = git rev-parse --verify --quiet "refs/tags/$Tag"
if (-not $tagExists) {
  Fail "No existe el tag '$Tag'."
}

$commitsAhead = [int](git rev-list --count "$Tag..HEAD")
if ($commitsAhead -eq 0) {
  Write-Host "No hay commits por revertir: HEAD ya coincide con $Tag."
  exit 0
}

Write-Host "[2/5] Revirtiendo cambios desde $Tag hasta HEAD en un solo rollback..."
$revertResult = git revert --no-commit "$Tag..HEAD" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host $revertResult
  Fail "El rollback encontro conflictos. Resuelve conflictos manualmente o ejecuta: git revert --abort"
}

$hasChanges = git diff --cached --name-only
if (-not $hasChanges) {
  Write-Host "No hubo cambios para commitear tras revert."
  exit 0
}

Write-Host "[3/5] Creando commit de rollback completo..."
RunGit "commit -m \"restore: rollback full project state to $Tag\""

Write-Host "[4/5] Commit creado correctamente."
if ($Push) {
  Write-Host "[5/5] Publicando rollback en remoto..."
  RunGit "push"
} else {
  Write-Host "[5/5] Rollback listo localmente. Usa 'git push' para publicarlo."
}

Write-Host "Rollback completo finalizado."
