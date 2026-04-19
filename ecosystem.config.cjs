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
        MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
        MERCADOPAGO_WEBHOOK_TOKEN: process.env.MERCADOPAGO_WEBHOOK_TOKEN,
        MERCADOPAGO_COLLECTOR_ID: process.env.MERCADOPAGO_COLLECTOR_ID,
        PF_PAYMENT_DEFAULT_AMOUNT_ARS: process.env.PF_PAYMENT_DEFAULT_AMOUNT_ARS,
        PF_MERCADOPAGO_ACCOUNT_LABEL: process.env.PF_MERCADOPAGO_ACCOUNT_LABEL,
        SYNC_STORE_PATH: "/root/pf-control-web-storage/sync-store.json",
      },
    },
  ],
};
