const fs = require("node:fs");
const path = require("node:path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const text = fs.readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index <= 0) continue;

    let key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();

    if (key.startsWith("export ")) {
      key = key.slice("export ".length).trim();
    }

    if (!key) continue;

    env[key] = value;
  }

  return env;
}

const fileEnv = loadEnvFile(path.join(__dirname, ".env.production"));
const dbEnv = loadEnvFile(path.join(__dirname, ".db.env"));
const runtimeEnv = {
  ...fileEnv,
  ...dbEnv,
  ...process.env,
};

module.exports = {
  apps: [
    {
      name: "pf-control-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        NEXTAUTH_URL: runtimeEnv.NEXTAUTH_URL || "https://pf-control.com",
        NEXTAUTH_SECRET: runtimeEnv.NEXTAUTH_SECRET,
        DATABASE_URL: runtimeEnv.DATABASE_URL,
        SYNC_STORE_PATH: "/root/pf-control-web-storage/sync-store.json",
      },
    },
  ],
};
