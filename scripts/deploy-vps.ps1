param(
  [string]$Server = "root@72.60.55.235",
  [string]$RemoteDir = "/root/pf-control-web",
  [string]$RemoteBackupsDir = "/root/pf-control-web-backups",
  [int]$BackupRetention = 3,
  [switch]$RunUxPermisosSmoke,
  [switch]$RunMailIntensiveSmokes
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path


$includePaths = @(
  "app",
  "components",
  "lib",
  "scripts",
  "prisma/schema.prisma",
  "prisma/migrations",
  "prisma/seed.ts",
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

if ($BackupRetention -lt 1) {
  throw "BackupRetention debe ser mayor o igual a 1."
}

$filesToDelete = "package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ecosystem.config.cjs proxy.ts next-auth.d.ts"
$dirsToDelete = "app components lib scripts data public"

$pruneFrom = $BackupRetention + 1
$remoteBackupAndPrep = "set -e; mkdir -p $RemoteBackupsDir; if [ -f $RemoteDir/package.json ]; then ts=`$(date +%Y%m%d-%H%M%S); backupDir=$RemoteBackupsDir/pf-control-web-`$ts; mkdir -p `$backupDir; cp -a $RemoteDir/. `$backupDir/; rm -rf `$backupDir/node_modules `$backupDir/.next `$backupDir/.turbo `$backupDir/.cache `$backupDir/.git; fi; ls -1dt $RemoteBackupsDir/pf-control-web-* 2>/dev/null | tail -n +$pruneFrom | xargs -r rm -rf; mkdir -p $RemoteDir; cd $RemoteDir; rm -rf $dirsToDelete; rm -f $filesToDelete"

$uxGuardrailStep = if ($RunUxPermisosSmoke.IsPresent) {
  "npm run smoke:ux:permisos;"
} else {
  "echo '[guardrail] smoke:ux:permisos omitido (usa -RunUxPermisosSmoke para activarlo)';"
}

$mailIntensiveStep = if ($RunMailIntensiveSmokes.IsPresent) {
  "SMOKE_REQUIRE_ADMIN_LOGIN=1 npm run smoke:auth:mail:all;"
} else {
  "echo '[guardrail] smoke:auth:mail:all omitido para ahorrar creditos de Brevo (usa -RunMailIntensiveSmokes para activarlo)';"
}

$remoteBuild = "set -e; cd $RemoteDir; if [ -f ./.db.env ]; then set -a; . ./.db.env; set +a; fi; npm ci --legacy-peer-deps --no-audit --no-fund --loglevel=error; npm run db:migrate:deploy; npm run db:generate; npm run smoke:runtime:db; npm run guard:interaction-lock; npm run guard:mobile-scroll-lock; npm run guard:shell-profile-lock; npm run build; (pm2 describe pf-control-web > /dev/null 2>&1 && pm2 restart pf-control-web --update-env || pm2 start ecosystem.config.cjs --env production); npm run whatsapp:automation:cron:setup; npm run smoke:login:guard; npm run smoke:alumnos:rutina:back; npm run smoke:dock:no-reload; npm run smoke:sidebar:order; npm run smoke:mail:guard; $mailIntensiveStep (npm run smoke:admin:usuarios:redirect || echo '[guardrail] smoke:admin:usuarios:redirect fallo (revisa SMOKE_MAIN_PASSWORD). Continuando para evitar magic-link automatico.'); $uxGuardrailStep pm2 save"

Write-Output "[1/4] Creando backup y preparando carpeta remota..."
ssh $Server $remoteBackupAndPrep
if ($LASTEXITCODE -ne 0) {
  throw "Fallo el backup/preparacion remota por SSH."
}


Write-Output "[2/4] Subiendo archivos al VPS..."
scp -r $fullPaths "$Server`:$RemoteDir/"
if ($LASTEXITCODE -ne 0) {
  throw "Fallo scp al subir archivos al VPS."
}

Write-Output "[3/4] Ejecutando install, build y PM2 en el VPS..."
ssh $Server $remoteBuild
if ($LASTEXITCODE -ne 0) {
  throw "Fallo la ejecucion remota por SSH."
}

Write-Output "[4/4] Verificacion final completada."

Write-Output "Deploy completado."
