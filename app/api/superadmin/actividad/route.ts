import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// GET /api/superadmin/actividad
export async function GET() {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = Date.now();

  const profesores = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      email: true,
      nombreCompleto: true,
      telefono: true,
      estado: true,
      createdAt: true,
      lastLoginAt: true,
      notasInternas: true,
      subscription: {
        select: { planTipo: true, estado: true, maxAlumnos: true },
      },
      _count: { select: { asignaciones: true } },
    },
    orderBy: { lastLoginAt: { sort: "desc", nulls: "last" } },
  });

  const rows = profesores.map((p: any) => {
    const dias = p.lastLoginAt
      ? Math.floor((now - new Date(p.lastLoginAt).getTime()) / 86400000)
      : null;

    const nivel: "activo" | "reciente" | "inactivo" | "nunca" =
      dias === null   ? "nunca"    :
      dias <= 7       ? "activo"   :
      dias <= 30      ? "reciente" : "inactivo";

    return {
      id:             p.id,
      email:          p.email,
      nombreCompleto: p.nombreCompleto,
      estado:         p.estado,
      createdAt:      p.createdAt,
      lastLoginAt:    p.lastLoginAt,
      notasInternas:  p.notasInternas,
      diasSinLogin:   dias,
      nivelActividad: nivel,
      alumnosCount:   p._count?.asignaciones ?? 0,
      subscription:   p.subscription,
    };
  });

  // Conteos
  const counts = {
    activo:   rows.filter((r: any) => r.nivelActividad === "activo").length,
    reciente: rows.filter((r: any) => r.nivelActividad === "reciente").length,
    inactivo: rows.filter((r: any) => r.nivelActividad === "inactivo").length,
    nunca:    rows.filter((r: any) => r.nivelActividad === "nunca").length,
  };

  return NextResponse.json({ ok: true, profesores: rows, counts });
}

// PATCH /api/superadmin/actividad — guardar notas internas de un profesor
export async function PATCH(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { profesorId, notasInternas } = body;
  if (!profesorId) return NextResponse.json({ error: "profesorId requerido" }, { status: 400 });

  await db.user.update({
    where: { id: profesorId },
    data: { notasInternas: notasInternas ?? null },
  });

  return NextResponse.json({ ok: true });
}
