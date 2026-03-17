param(
  [string]$Server = "root@72.60.55.235",
  [string]$RemoteDir = "/root/pf-control-web",
  [string]$RemoteBackupsDir = "/root/pf-control-web-backups"
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$includePaths = @(
  "app",
  "components",
  "lib",
  "prisma",
  "data",
  "public",
  "proxy.ts",
  "next-auth.d.ts",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "ecosystem.config.cjs"
)

$fullPaths = $includePaths | ForEach-Object { Join-Path $projectRoot $_ }

$filesToDelete = "package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ecosystem.config.cjs proxy.ts next-auth.d.ts schema.prisma"
$dirsToDelete = "app components lib prisma data public"

$remoteBackupAndPrep = "set -e; mkdir -p $RemoteBackupsDir; if [ -f $RemoteDir/package.json ]; then ts=`$(date +%Y%m%d-%H%M%S); cp -a $RemoteDir $RemoteBackupsDir/pf-control-web-`$ts; fi; mkdir -p $RemoteDir; cd $RemoteDir; rm -rf $dirsToDelete; rm -f $filesToDelete"
$remoteBuild = "set -e; cd $RemoteDir; if [ -f .db.env ]; then set -a; . ./.db.env; set +a; fi; npm ci; npm run db:generate; npm run db:push; npm run build; (pm2 describe pf-control-web > /dev/null 2>&1 && pm2 restart pf-control-web --update-env || pm2 start ecosystem.config.cjs --env production); pm2 save"

Write-Host "[1/4] Creando backup y preparando carpeta remota..."
ssh $Server $remoteBackupAndPrep
if ($LASTEXITCODE -ne 0) {
  throw "Fallo el backup/preparacion remota por SSH."
}

Write-Host "[2/4] Subiendo archivos al VPS..."
scp -r $fullPaths "$Server`:$RemoteDir/"
if ($LASTEXITCODE -ne 0) {
  throw "Fallo scp al subir archivos al VPS."
}

Write-Host "[3/4] Ejecutando install, build y PM2 en el VPS..."
ssh $Server $remoteBuild
if ($LASTEXITCODE -ne 0) {
  throw "Fallo la ejecucion remota por SSH."
}

Write-Host "[4/4] Verificacion final completada."

Write-Host "Deploy completado."
