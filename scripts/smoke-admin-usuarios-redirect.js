const { PrismaClient } = require("@prisma/client");

const { loginForSmoke } = require("./utils/smoke-auth");

const prisma = new PrismaClient();

async function main() {
  const login = await loginForSmoke({ prisma });
  if (!login.ok) {
    throw new Error(`admin login fallo: status=${login.status} location=${login.location}`);
  }

  const baseUrl = login.baseUrl;
  const response = await fetch(`${baseUrl}/admin/usuarios`, {
    headers: {
      Cookie: login.cookieHeader,
    },
    redirect: "manual",
  });

  const body = await response.text();
  const location = response.headers.get("location") || "";
  const bodyHasPermissionCopy = /usuarios y permisos|permisos de colaboradores|colaboradores/i.test(body);
  const pass = response.status === 200 && bodyHasPermissionCopy;

  const output = {
    ok: pass,
    baseUrl,
    auth: {
      responseStatus: login.status,
      location: login.location,
      method: login.method,
    },
    checks: {
      status: response.status,
      location,
      bodyHasPermissionCopy,
      expected: "pagina disponible para administrar permisos",
    },
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
