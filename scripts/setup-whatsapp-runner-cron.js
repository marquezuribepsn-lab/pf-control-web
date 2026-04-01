const { execSync } = require("child_process");

const marker = "# PF_CONTROL_WHATSAPP_RUNNER";

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, `'\\''`)}'`;
}

function run(command) {
  return execSync(command, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}

function getCurrentCrontab() {
  try {
    return run("crontab -l 2>/dev/null || true");
  } catch {
    return "";
  }
}

function main() {
  if (process.platform === "win32") {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "windows_platform" }, null, 2));
    return;
  }

  const enabled = process.env.WHATSAPP_AUTOMATION_CRON_ENABLED !== "0";
  const schedule = String(process.env.WHATSAPP_AUTOMATION_CRON_SCHEDULE || "* * * * *").trim();
  const cwd = process.cwd();
  const nextAuthUrl = String(process.env.NEXTAUTH_URL || "http://127.0.0.1:3000").trim();
  const automationSecret = String(process.env.WHATSAPP_AUTOMATION_SECRET || "").trim();
  const logPath = String(process.env.WHATSAPP_AUTOMATION_CRON_LOG || "/var/log/pf-whatsapp-automation.log").trim();

  const envParts = [
    `NEXTAUTH_URL=${shellQuote(nextAuthUrl)}`,
    automationSecret ? `WHATSAPP_AUTOMATION_SECRET=${shellQuote(automationSecret)}` : "",
    "WHATSAPP_AUTOMATION_DRY_RUN=0",
  ].filter(Boolean);

  const cronCommand = `${schedule} cd ${shellQuote(cwd)} ; /usr/bin/env ${envParts.join(
    " "
  )} npm run --silent whatsapp:automation:run >> ${shellQuote(logPath)} 2>&1 ${marker}`;

  const current = getCurrentCrontab();
  const keptLines = current
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.includes(marker));

  const nextLines = [...keptLines];
  if (enabled) {
    nextLines.push(cronCommand);
  }

  const nextCrontab = `${nextLines.join("\n")}\n`;
  execSync("crontab -", { input: nextCrontab, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });

  console.log(
    JSON.stringify(
      {
        ok: true,
        enabled,
        schedule,
        marker,
        secretConfigured: Boolean(automationSecret),
        line: enabled ? cronCommand : null,
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
}
