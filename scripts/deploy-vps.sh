#!/usr/bin/env bash
# Bash equivalent of scripts/deploy-vps.ps1 for use from macOS/Linux.
# Connects to the VPS, backs up the current install, uploads code, runs
# npm ci + db migrate + build + pm2 restart. Smoke tests are skipped by
# default to keep deploys fast; pass --smoke to enable them.
#
# DATOS PERSISTENTES: los sync-store (data/ y storage/) se preservan
# automáticamente en cada deploy. El archivo data/sync-store.json nunca
# se sube desde dev (contiene datos de prueba locales, no de producción).

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
# Prisma schema + migrations se suben por separado (nunca el .db)
PRISMA_FILES=(
  "prisma/schema.prisma"
  "prisma/migrations"
  "prisma/seed.ts"
)

FILES_TO_DELETE="package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ecosystem.config.cjs proxy.ts next-auth.d.ts"
# Nota: prisma/dev.db NUNCA se incluye en el deploy (datos de produccion)
DIRS_TO_DELETE="app components lib scripts data public"

PRUNE_FROM=$((BACKUP_RETENTION + 1))

echo "[1/5] Creando backup, guardando datos persistentes y preparando carpeta remota..."
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

# --- Guardar datos persistentes ANTES de limpiar ---
# Nunca se pierden datos de produccion por un deploy
mkdir -p /tmp/pf-deploy-databackup
if [ -f "$REMOTE_DIR/data/sync-store.json" ]; then
  cp "$REMOTE_DIR/data/sync-store.json" /tmp/pf-deploy-databackup/data-sync-store.json
  echo "  -> sync-store legacy (data/) guardado."
fi
if [ -f "$REMOTE_DIR/storage/sync-store.json" ]; then
  cp "$REMOTE_DIR/storage/sync-store.json" /tmp/pf-deploy-databackup/storage-sync-store.json
  echo "  -> sync-store (storage/) guardado."
fi

mkdir -p "$REMOTE_DIR"
cd "$REMOTE_DIR"
rm -rf $DIRS_TO_DELETE
rm -f $FILES_TO_DELETE
# Borrar solo el codigo prisma (schema + migrations), NUNCA el dev.db
rm -rf prisma/migrations prisma/schema.prisma prisma/seed.ts 2>/dev/null || true
# El dev.db (base de datos de produccion) jamas se toca en el deploy
EOF

echo "[2/5] Subiendo archivos al VPS..."
SCP_ARGS=()
for p in "${INCLUDE_PATHS[@]}"; do
  SCP_ARGS+=("$PROJECT_ROOT/$p")
done
scp -r -q "${SCP_ARGS[@]}" "$SERVER:$REMOTE_DIR/"

# Subir archivos prisma (NUNCA el .db — eso es la base de datos de produccion)
ssh "$SERVER" "mkdir -p $REMOTE_DIR/prisma"
for pf in "${PRISMA_FILES[@]}"; do
  if [ -e "$PROJECT_ROOT/$pf" ]; then
    scp -r -q "$PROJECT_ROOT/$pf" "$SERVER:$REMOTE_DIR/$pf"
  fi
done

echo "[3/5] Restaurando datos persistentes del VPS..."
ssh "$SERVER" bash -s <<EOF
set -e
# Siempre eliminar el data/sync-store.json recien subido desde dev.
# Contiene datos de desarrollo locales, nunca datos de produccion.
rm -f "$REMOTE_DIR/data/sync-store.json"

# Restaurar sync-store legacy (data/) si habia datos de produccion guardados
if [ -f /tmp/pf-deploy-databackup/data-sync-store.json ]; then
  mkdir -p "$REMOTE_DIR/data"
  cp /tmp/pf-deploy-databackup/data-sync-store.json "$REMOTE_DIR/data/sync-store.json"
  echo "  -> sync-store legacy (data/) restaurado."
fi

# Restaurar sync-store principal (storage/) si habia datos de produccion guardados
if [ -f /tmp/pf-deploy-databackup/storage-sync-store.json ]; then
  mkdir -p "$REMOTE_DIR/storage"
  cp /tmp/pf-deploy-databackup/storage-sync-store.json "$REMOTE_DIR/storage/sync-store.json"
  echo "  -> sync-store (storage/) restaurado."
fi

rm -rf /tmp/pf-deploy-databackup
EOF

echo "[4/5] Configurando entorno y ejecutando install, build y PM2..."
SMOKE_BLOCK=""
if [[ "$RUN_SMOKES" -eq 1 ]]; then
  SMOKE_BLOCK="npm run smoke:login:guard; npm run smoke:alumnos:rutina:back; npm run smoke:alumnos:nutricion; npm run smoke:dock:no-reload; npm run smoke:sidebar:order; npm run smoke:mail:guard;"
fi

ssh "$SERVER" bash -s <<EOF
set -e
cd "$REMOTE_DIR"

# --- Asegurar que DATABASE_URL está configurado ---
# Si está presente, los datos van a SQLite (prisma/dev.db) que el deploy NUNCA toca.
# Esto garantiza persistencia total de datos entre deploys.
if [ ! -f ./.db.env ]; then
  echo 'DATABASE_URL="file:./prisma/dev.db"' > ./.db.env
  echo "  -> .db.env creado con DATABASE_URL para persistencia SQLite."
elif ! grep -q "^DATABASE_URL=" ./.db.env 2>/dev/null; then
  echo 'DATABASE_URL="file:./prisma/dev.db"' >> ./.db.env
  echo "  -> DATABASE_URL agregado a .db.env para persistencia SQLite."
fi

# Escribir DATABASE_URL en .env.local → Next.js lo carga automaticamente en
# produccion SIN depender del entorno de PM2. Asi el token de MP persiste
# aunque el servidor se reinicie o PM2 pierda su entorno guardado.
if [ ! -f ./.env.local ]; then
  echo 'DATABASE_URL="file:./prisma/dev.db"' > ./.env.local
  echo "  -> .env.local creado con DATABASE_URL (Next.js lo carga siempre)."
elif ! grep -q "^DATABASE_URL=" ./.env.local 2>/dev/null; then
  echo 'DATABASE_URL="file:./prisma/dev.db"' >> ./.env.local
  echo "  -> DATABASE_URL agregado a .env.local."
fi

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

echo "[5/5] Deploy completado."
