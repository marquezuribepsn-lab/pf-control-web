import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// GET /api/superadmin/audit?limit=200&accion=broadcast
export async function GET(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit         = Math.min(Number(searchParams.get("limit") ?? 200), 500);
  const accion        = searchParams.get("accion")        ?? undefined;
  const desde         = searchParams.get("desde")         ?? undefined;
  const profesorEmail = searchParams.get("profesorEmail") ?? undefined;
  const q             = searchParams.get("q")             ?? undefined;

  const where: any = {};
  if (accion)         where.accion    = accion;
  if (desde)          where.createdAt = { gte: new Date(desde) };
  if (profesorEmail)  where.profesorEmail = { contains: profesorEmail };
  if (q) {
    where.OR = [
      { profesorEmail: { contains: q } },
      { detalle:       { contains: q } },
    ];
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, accion: true, detalle: true, profesorEmail: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, logs });
}
