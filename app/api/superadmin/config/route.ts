import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export const CONFIG_KEYS = [
  "sa-config:diasGracia",
  "sa-config:cronChannels",
  "sa-config:diasUmbral",
  "sa-config:cronMensaje",
] as const;

export const CONFIG_DEFAULTS: Record<string, any> = {
  "sa-config:diasGracia":   3,
  "sa-config:cronChannels": "email",
  "sa-config:diasUmbral":   7,
  "sa-config:cronMensaje":  "",
};

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// GET /api/superadmin/config
export async function GET() {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entries = await db.syncEntry.findMany({
    where: { key: { in: [...CONFIG_KEYS] } },
    select: { key: true, value: true },
  });

  const config: Record<string, any> = { ...CONFIG_DEFAULTS };
  for (const e of entries) config[e.key] = e.value;

  return NextResponse.json({ ok: true, config });
}

// PATCH /api/superadmin/config
// Body: { "sa-config:diasGracia": 3, "sa-config:cronChannels": "email,whatsapp", ... }
export async function PATCH(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  for (const [key, value] of Object.entries(body)) {
    if (!(CONFIG_KEYS as readonly string[]).includes(key)) continue;
    await db.syncEntry.upsert({
      where:  { key },
      create: { key, value: value as any },
      update: { value: value as any },
    });
  }

  return NextResponse.json({ ok: true });
}
