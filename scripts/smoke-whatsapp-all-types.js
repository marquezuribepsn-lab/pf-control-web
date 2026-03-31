/* eslint-disable no-console */
const baseUrl = process.env.SMOKE_BASE_URL || "https://pf-control.com";
const adminEmail = process.env.SMOKE_MAIN_EMAIL || "";
const adminPassword = process.env.SMOKE_MAIN_PASSWORD || "";

function toCookieHeader(setCookieList) {
  return (Array.isArray(setCookieList) ? setCookieList : [])
    .map((entry) => String(entry).split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function loginAsAdmin() {
  if (!adminEmail || !adminPassword) {
    throw new Error("Faltan SMOKE_MAIN_EMAIL o SMOKE_MAIN_PASSWORD");
  }

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`No se pudo obtener CSRF: ${csrfResponse.status}`);
  }

  const csrfData = await csrfResponse.json();
  const csrfCookies = typeof csrfResponse.headers.getSetCookie === "function"
    ? csrfResponse.headers.getSetCookie()
    : [];

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: toCookieHeader(csrfCookies),
    },
    body: new URLSearchParams({
      email: adminEmail,
      password: adminPassword,
      csrfToken: csrfData.csrfToken,
      callbackUrl: `${baseUrl}/`,
      json: "true",
    }).toString(),
    redirect: "manual",
  });

  const location = loginResponse.headers.get("location") || "";
  const loginCookies = typeof loginResponse.headers.getSetCookie === "function"
    ? loginResponse.headers.getSetCookie()
    : [];

  if (loginResponse.status !== 302 || /error=/i.test(location)) {
    throw new Error(`Login admin fallo: status=${loginResponse.status} location=${location}`);
  }

  return toCookieHeader([...csrfCookies, ...loginCookies]);
}

async function call(path, method = "GET", body, cookie = "") {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { status: res.status, data };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const adminCookie = await loginAsAdmin();

  const configGet = await call("/api/whatsapp/config", "GET", undefined, adminCookie);
  if (configGet.status !== 200 || !configGet.data?.config?.categories) {
    throw new Error(`No se pudo obtener config de WhatsApp: ${configGet.status}`);
  }

  const categories = configGet.data.config.categories;
  const tag = `alltypes-${Date.now()}`;

  const recipient = {
    id: "alumno:Pablo",
    label: "Pablo",
    tipo: "alumno",
    variables: {
      nombre: "Pablo",
      actividad: "Entrenamiento",
      dias: "1",
      total: "$25000",
      fecha: new Date().toLocaleDateString("es-AR"),
      link: "https://pf-control.com",
    },
  };

  const modes = ["test", "manual", "automatico"];
  const checks = [];

  for (const [categoryKey, categoryValue] of Object.entries(categories)) {
    const rules = categoryValue?.rules || {};

    for (const [ruleKey, ruleConfig] of Object.entries(rules)) {
      const message = String(ruleConfig?.message || "Hola {{nombre}}, prueba de envio").trim();

      for (const mode of modes) {
        const subcategoria = `${ruleKey}__${mode}__${tag}`;
        const send = await call(
          "/api/whatsapp/send",
          "POST",
          {
            destinatarios: [recipient],
            mensaje: message,
            tipo: categoryKey,
            subcategoria,
            mode,
          },
          adminCookie
        );

        checks.push({
          categoryKey,
          ruleKey,
          mode,
          subcategoria,
          status: send.status,
          ok: Boolean(send.data?.ok),
          sentCount: Number(send.data?.sentCount || 0),
          failedCount: Number(send.data?.failedCount || 0),
          error: send.data?.error || null,
        });

        await sleep(120);
      }
    }
  }

  const history = await call("/api/admin/whatsapp-history", "GET", undefined, adminCookie);
  const rows = Array.isArray(history.data?.historial) ? history.data.historial : [];
  const historyBySub = new Map(
    rows
      .filter((row) => String(row?.value?.subcategoria || "").includes(tag))
      .map((row) => [String(row?.value?.subcategoria), row?.value])
  );

  const detailed = checks.map((check) => {
    const log = historyBySub.get(check.subcategoria) || {};
    return {
      ...check,
      logEstado: log.estado || null,
      payloadType: log.payloadType || null,
      providerMessageId: log.providerMessageId || null,
      telefonoDestino: log.telefonoDestino || null,
      logError: log.error || null,
      mensaje: log.mensaje || null,
    };
  });

  const failed = detailed.filter((item) => {
    return !(item.status === 200 && item.ok && item.logEstado === "enviado" && item.providerMessageId);
  });

  const byMode = detailed.reduce((acc, item) => {
    if (!acc[item.mode]) {
      acc[item.mode] = { total: 0, passed: 0, failed: 0 };
    }

    acc[item.mode].total += 1;
    if (item.status === 200 && item.ok && item.logEstado === "enviado" && item.providerMessageId) {
      acc[item.mode].passed += 1;
    } else {
      acc[item.mode].failed += 1;
    }

    return acc;
  }, {});

  const summary = {
    ok: failed.length === 0,
    baseUrl,
    tag,
    totals: {
      total: detailed.length,
      failed: failed.length,
      passed: detailed.length - failed.length,
    },
    byMode,
    failed,
    detailed,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
