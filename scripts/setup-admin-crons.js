/**
 * Sets up VPS crontab entries for the three admin alert endpoints:
 *   - /api/admin/vencimientos      POST  (daily, 9 AM AR = 12:00 UTC)
 *   - /api/admin/checkin-reminder  POST  (every Monday, 10 AM AR = 13:00 UTC)
 *   - /api/admin/resumen-semanal   POST  (every Monday, 9 AM AR = 12:00 UTC)
 *
 * Usage (on the VPS):
 *   CRON_SECRET=<your-cron-secret> NEXTAUTH_URL=https://pf-control.com node scripts/setup-admin-crons.js
 *
 * Re-running this script is idempotent — it replaces existing entries.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const MARKER = "# PF_CONTROL_ADMIN_CRONS";

function run(cmd) {
  return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}

function readEnvFile(filePath, key) {
  try {
    const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (trimmed.startsWith(`${key}=`)) return trimmed.slice(key.length + 1).replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* ignore */ }
  return "";
}

function getCurrentCrontab() {
  try { return run("crontab -l 2>/dev/null || echo ''"); } catch { return ""; }
}

function main() {
  if (process.platform === "win32") {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "windows_platform" }));
    return;
  }

  const cwd = process.cwd();
  const envFile = path.join(cwd, ".env.local");
  const envFileProd = path.join(cwd, ".env.production");

  const baseUrl = (
    process.env.NEXTAUTH_URL ||
    readEnvFile(envFile, "NEXTAUTH_URL") ||
    readEnvFile(envFileProd, "NEXTAUTH_URL") ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");

  const secret = (
    process.env.CRON_SECRET ||
    readEnvFile(envFile, "CRON_SECRET") ||
    readEnvFile(envFileProd, "CRON_SECRET") ||
    ""
  ).trim();

  if (!secret) {
    console.error(JSON.stringify({ ok: false, error: "CRON_SECRET is not set — export it before running this script" }));
    process.exit(1);
  }

  const logDir = "/var/log";
  const curlBase = `/usr/bin/curl -s -o /dev/null -w "%{http_code}" -X POST`;

  // ── Cron entries ──────────────────────────────────────────────────
  // Times are UTC. Argentina is UTC-3 (UTC-2 in DST, but we use -3 as conservative).
  const jobs = [
    {
      // Daily 9 AM AR = 12:00 UTC
      schedule: "0 12 * * *",
      label: "vencimientos",
      url: `${baseUrl}/api/admin/vencimientos`,
      body: '{"daysAhead":7}',
      log: `${logDir}/pf-vencimientos.log`,
    },
    {
      // Every Monday 10 AM AR = 13:00 UTC
      schedule: "0 13 * * 1",
      label: "checkin-reminder",
      url: `${baseUrl}/api/admin/checkin-reminder`,
      body: "{}",
      log: `${logDir}/pf-checkin-reminder.log`,
    },
    {
      // Every Monday 9 AM AR = 12:30 UTC (after vencimientos)
      schedule: "30 12 * * 1",
      label: "resumen-semanal",
      url: `${baseUrl}/api/admin/resumen-semanal`,
      body: '{"sendWhatsApp":true}',
      log: `${logDir}/pf-resumen-semanal.log`,
    },
  ];

  const cronLines = jobs.map(({ schedule, label, url, body, log }) => {
    const cmd = `${curlBase} -H 'Authorization: Bearer ${secret}' -H 'Content-Type: application/json' -d '${body}' '${url}' >> ${log} 2>&1`;
    return `${schedule} ${cmd} ${MARKER}:${label}`;
  });

  // Remove old entries, append new ones
  const current = getCurrentCrontab();
  const kept = current
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !l.includes(MARKER));

  const next = [...kept, ...cronLines].join("\n") + "\n";
  execSync("crontab -", { input: next, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    secretConfigured: true,
    jobs: jobs.map((j) => ({ label: j.label, schedule: j.schedule, log: j.log })),
  }, null, 2));
}

try {
  main();
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
}
