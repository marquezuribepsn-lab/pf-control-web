import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// GET /api/superadmin/notificaciones?limit=100&tipo=pago_confirmado&desde=ISO
export async function GET(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url   = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
  const tipo  = url.searchParams.get("tipo") ?? undefined;
  const desde = url.searchParams.get("desde") ?? undefined;

  const where: Record<string, unknown> = {};
  if (tipo)  where.tipo      = tipo;
  if (desde) where.createdAt = { gte: new Date(desde) };

  const logs = await db.notificacionLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ ok: true, logs });
}

// DELETE /api/superadmin/notificaciones — purgar logs anteriores a N días
export async function DELETE(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dias = Number(body.dias ?? 90);
  const desde = new Date(Date.now() - dias * 86400_000);

  const { count } = await db.notificacionLog.deleteMany({
    where: { createdAt: { lt: desde } },
  });

  return NextResponse.json({ ok: true, deleted: count });
}
