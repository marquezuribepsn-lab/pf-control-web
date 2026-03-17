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
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "https://pf-control.com",
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
        DATABASE_URL: process.env.DATABASE_URL,
        SYNC_STORE_PATH: "/root/pf-control-web-storage/sync-store.json",
      },
    },
  ],
};
