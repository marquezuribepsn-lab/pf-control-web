/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }

  return env;
}

async function graphGet(token, pathWithQuery) {
  const url = `https://graph.facebook.com/v20.0/${pathWithQuery}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.production');
  if (!fs.existsSync(envPath)) {
    throw new Error(`No se encontro ${envPath}`);
  }

  const env = parseEnvFile(envPath);
  const token = env.WHATSAPP_TOKEN || '';
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID || '';
  const businessAccountId = env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

  if (!token || !phoneNumberId) {
    throw new Error('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en .env.production');
  }

  const phoneInfo = await graphGet(
    token,
    `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,code_verification_status,name_status`
  );

  const templates = businessAccountId
    ? await graphGet(
        token,
        `${businessAccountId}/message_templates?name=pf_alerta_general&fields=name,status,language,category,quality_score,components`
      )
    : { status: null, json: { note: 'WHATSAPP_BUSINESS_ACCOUNT_ID no configurado' } };

  const allTemplates = businessAccountId
    ? await graphGet(
        token,
        `${businessAccountId}/message_templates?limit=50&fields=name,status,language,category,components`
      )
    : { status: null, json: { note: 'WHATSAPP_BUSINESS_ACCOUNT_ID no configurado' } };

  const subscribedApps = businessAccountId
    ? await graphGet(token, `${businessAccountId}/subscribed_apps`)
    : { status: null, json: { note: 'WHATSAPP_BUSINESS_ACCOUNT_ID no configurado' } };

  console.log(
    JSON.stringify(
      {
        phoneNumberId,
        businessAccountId: businessAccountId || null,
        phoneInfo,
        templates,
        allTemplates,
        subscribedApps,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
