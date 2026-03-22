const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env.production") });

const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || "http://127.0.0.1:3000";
const smokeMailbox = process.env.SMOKE_MAILBOX_BASE || process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM || "";
const forgotEmail = process.env.SMOKE_MAIN_EMAIL || smokeMailbox;
const runDeliveryChecks = String(process.env.SMOKE_RUN_DELIVERY || "false").toLowerCase() === "true";
const runForgotPasswordCheck = String(process.env.SMOKE_RUN_FORGOT_PASSWORD || "false").toLowerCase() === "true";

function required(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Falta variable requerida: ${name}`);
  }
}

async function retry(label, fn, { attempts = 4, delayMs = 2000 } = {}) {
  let lastError;

  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`${label} fallo tras ${attempts} intentos: ${String(lastError)}`);
}

async function checkBrevoAccount() {
  const response = await fetch("https://api.brevo.com/v3/account", {
    headers: {
      "api-key": process.env.BREVO_API_KEY || "",
    },
  });

  if (!response.ok) {
    throw new Error(`Brevo account check fallo: ${response.status} ${await response.text()}`);
  }

  const account = await response.json();
  return {
    status: response.status,
    email: account?.email || null,
  };
}

async function sendDirectMail() {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM;
  const senderName = process.env.BREVO_SENDER_NAME || "PF Control";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY || "",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: smokeMailbox }],
      subject: `MAIL GUARD PF Control ${Date.now()}`,
      htmlContent: "<p>Smoke mail guard OK</p>",
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo send check fallo: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return {
    status: response.status,
    messageId: payload?.messageId || null,
  };
}

async function checkForgotPasswordRoute() {
  const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: forgotEmail }),
  });

  const body = await response.text();
  if (response.status !== 200) {
    throw new Error(`forgot-password fallo: ${response.status} ${body}`);
  }

  return {
    status: response.status,
    body,
  };
}

async function main() {
  required("BREVO_API_KEY", process.env.BREVO_API_KEY);
  required("BREVO_SENDER_EMAIL o MAIL_FROM", process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM);
  required("NEXTAUTH_URL o SMOKE_BASE_URL", baseUrl);

  if (runDeliveryChecks) {
    required("SMOKE mailbox", smokeMailbox);
  }

  if (runForgotPasswordCheck) {
    required("SMOKE forgot email", forgotEmail);
  }

  const results = {
    config: {
      baseUrl,
      smokeMailbox,
      forgotEmail,
      runDeliveryChecks,
      runForgotPasswordCheck,
    },
    brevoAccount: await retry("checkBrevoAccount", checkBrevoAccount),
    directMail: runDeliveryChecks
      ? await retry("sendDirectMail", sendDirectMail)
      : {
          skipped: true,
          reason: "SMOKE_RUN_DELIVERY=false",
        },
    forgotPassword: runForgotPasswordCheck
      ? await retry("checkForgotPasswordRoute", checkForgotPasswordRoute, {
          attempts: 6,
          delayMs: 2500,
        })
      : {
          skipped: true,
          reason: "SMOKE_RUN_FORGOT_PASSWORD=false",
        },
  };

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
