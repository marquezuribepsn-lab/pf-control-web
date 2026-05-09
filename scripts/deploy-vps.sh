#!/usr/bin/env bash
# Bash equivalent of scripts/deploy-vps.ps1 for use from macOS/Linux.
# Connects to the VPS, backs up the current install, uploads code, runs
# npm ci + db migrate + build + pm2 restart. Smoke tests are skipped by
# default to keep deploys fast; pass --smoke to enable them.

set -euo pipefail

SERVER="${SERVER:-pf-control-vps}"
REMOTE_DIR="${REMOTE_DIR:-/root/pf-control-web}"
REMOTE_BACKUPS_DIR="${REMOTE_BACKUPS_DIR:-/root/pf-control-web-backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-3}"
RUN_SMOKES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --smoke) RUN_SMOKES=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

INCLUDE_PATHS=(
  "app"
  "components"
  "lib"
  "scripts"
  "prisma/schema.prisma"
  "prisma/migrations"
  "prisma/seed.ts"
  "data"
  "public"
  "proxy.ts"
  "next-auth.d.ts"
  "package.json"
  "package-lock.json"
  "next.config.ts"
  "tsconfig.json"
  "postcss.config.mjs"
  "eslint.config.mjs"
  "ecosystem.config.cjs"
)

FILES_TO_DELETE="package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ecosystem.config.cjs proxy.ts next-auth.d.ts"
DIRS_TO_DELETE="app components lib scripts data public"

PRUNE_FROM=$((BACKUP_RETENTION + 1))

echo "[1/4] Creando backup y preparando carpeta remota..."
ssh "$SERVER" bash -s <<EOF
set -e
mkdir -p "$REMOTE_BACKUPS_DIR"
if [ -f "$REMOTE_DIR/package.json" ]; then
  ts=\$(date +%Y%m%d-%H%M%S)
  backupDir="$REMOTE_BACKUPS_DIR/pf-control-web-\$ts"
  mkdir -p "\$backupDir"
  cp -a "$REMOTE_DIR/." "\$backupDir/"
  rm -rf "\$backupDir/node_modules" "\$backupDir/.next" "\$backupDir/.turbo" "\$backupDir/.cache" "\$backupDir/.git"
fi
ls -1dt "$REMOTE_BACKUPS_DIR"/pf-control-web-* 2>/dev/null | tail -n +$PRUNE_FROM | xargs -r rm -rf
mkdir -p "$REMOTE_DIR"
cd "$REMOTE_DIR"
rm -rf $DIRS_TO_DELETE
rm -f $FILES_TO_DELETE
EOF

echo "[2/4] Subiendo archivos al VPS..."
SCP_ARGS=()
for p in "${INCLUDE_PATHS[@]}"; do
  SCP_ARGS+=("$PROJECT_ROOT/$p")
done
scp -r -q "${SCP_ARGS[@]}" "$SERVER:$REMOTE_DIR/"

echo "[3/4] Ejecutando install, build y PM2 en el VPS..."
SMOKE_BLOCK=""
if [[ "$RUN_SMOKES" -eq 1 ]]; then
  SMOKE_BLOCK="npm run smoke:login:guard; npm run smoke:alumnos:rutina:back; npm run smoke:alumnos:nutricion; npm run smoke:dock:no-reload; npm run smoke:sidebar:order; npm run smoke:mail:guard;"
fi

ssh "$SERVER" bash -s <<EOF
set -e
cd "$REMOTE_DIR"
if [ -f ./.db.env ]; then set -a; . ./.db.env; set +a; fi
npm ci --legacy-peer-deps --no-audit --no-fund --loglevel=error
npm run db:migrate:deploy
npm run db:generate
npm run build
( pm2 describe pf-control-web > /dev/null 2>&1 \
    && pm2 restart pf-control-web --update-env \
    || pm2 start ecosystem.config.cjs --env production )
$SMOKE_BLOCK
pm2 save
EOF

echo "[4/4] Deploy completado."
