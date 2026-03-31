#!/usr/bin/env bash
set -euo pipefail

cd /root/pf-control-web

# Remove accidental empty secret line, if present.
if grep -q '^WHATSAPP_AUTOMATION_SECRET=$' .env.production; then
  sed -i '/^WHATSAPP_AUTOMATION_SECRET=$/d' .env.production
fi

if ! grep -q '^WHATSAPP_AUTOMATION_SECRET=' .env.production; then
  secret=$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')
  echo "WHATSAPP_AUTOMATION_SECRET=$secret" >> .env.production
fi

cat > /usr/local/bin/pf-whatsapp-automation.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /root/pf-control-web
SECRET=$(grep '^WHATSAPP_AUTOMATION_SECRET=' .env.production | tail -n1 | cut -d= -f2-)
BASE=$(grep '^NEXTAUTH_URL=' .env.production | tail -n1 | cut -d= -f2- || true)
if [ -z "${BASE}" ]; then BASE="https://pf-control.com"; fi
WHATSAPP_AUTOMATION_SECRET="${SECRET}" SMOKE_BASE_URL="${BASE}" node scripts/run-whatsapp-automation.js >> /var/log/pf-whatsapp-automation.log 2>&1
EOF

chmod +x /usr/local/bin/pf-whatsapp-automation.sh

( crontab -l 2>/dev/null | grep -v 'pf-whatsapp-automation.sh' ; echo '*/15 * * * * /usr/local/bin/pf-whatsapp-automation.sh' ) | crontab -

pm2 restart pf-control-web --update-env >/dev/null

/usr/local/bin/pf-whatsapp-automation.sh || true

echo '--- SECRET STATUS ---'
if grep -q '^WHATSAPP_AUTOMATION_SECRET=' .env.production; then
  echo 'WHATSAPP_AUTOMATION_SECRET configurado'
else
  echo 'WHATSAPP_AUTOMATION_SECRET no encontrado'
fi

echo '--- CRON ---'
crontab -l | grep 'pf-whatsapp-automation.sh'

echo '--- LOG TAIL ---'
if [ -f /var/log/pf-whatsapp-automation.log ]; then
  tail -n 30 /var/log/pf-whatsapp-automation.log
else
  echo 'log file missing'
fi
