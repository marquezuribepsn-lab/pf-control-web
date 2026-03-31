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
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

async function main() {
  const to = String(process.argv[2] || '').replace(/\D/g, '');
  const templateName = String(process.argv[3] || 'hello_world').trim();
  const templateLanguage = String(process.argv[4] || 'en_US').trim();
  const bodyParam = String(process.argv[5] || '').trim();

  if (!to) {
    throw new Error('Uso: node scripts/send-wa-template-test.js <telefono> [template] [language]');
  }

  const envPath = path.resolve(process.cwd(), '.env.production');
  const env = parseEnvFile(envPath);
  const token = env.WHATSAPP_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en .env.production');
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLanguage },
      ...(bodyParam
        ? {
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: bodyParam,
                  },
                ],
              },
            ],
          }
        : {}),
    },
  };

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  console.log(
    JSON.stringify(
      {
        status: res.status,
        to,
        templateName,
        templateLanguage,
        bodyParam: bodyParam || null,
        response: json,
      },
      null,
      2
    )
  );

  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
