param(
  [string]$Server = "root@72.60.55.235",
  [string]$RemoteDir = "/root/pf-control-web",
  [string]$RemoteBackupsDir = "/root/pf-control-web-backups"
)

$ErrorActionPreference = "Stop"

$remoteRollback = "set -e; last_backup=`$(ls -1dt $RemoteBackupsDir/pf-control-web-* 2>/dev/null | head -n 1); if [ -z \"`$last_backup\" ]; then echo 'No hay backups para rollback.'; exit 1; fi; rm -rf $RemoteDir; cp -a \"`$last_backup\" $RemoteDir; cd $RemoteDir; npm install; npm run build; (pm2 describe pf-control-web > /dev/null 2>&1 && pm2 restart pf-control-web || pm2 start ecosystem.config.cjs --env production); pm2 save; echo Rollback aplicado desde: \"`$last_backup\""

Write-Host "[1/1] Aplicando rollback al ultimo backup en el VPS..."
ssh $Server $remoteRollback
if ($LASTEXITCODE -ne 0) {
  throw "Fallo el rollback remoto por SSH."
}

Write-Host "Rollback completado."
