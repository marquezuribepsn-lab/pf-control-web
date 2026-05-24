import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// POST /api/superadmin/subscriptions — upsert subscription for a profesor
export async function POST(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { profesorId, planTipo, maxAlumnos, maxPlanes, estado, fechaVencimiento, moneda, importe, periodoDias, notas } = body;

  if (!profesorId) return NextResponse.json({ error: "profesorId requerido" }, { status: 400 });

  const upsertData: any = {};
  if (planTipo !== undefined) upsertData.planTipo = planTipo;
  if (maxAlumnos !== undefined) upsertData.maxAlumnos = Number(maxAlumnos);
  if (maxPlanes !== undefined) upsertData.maxPlanes = Number(maxPlanes);
  if (estado !== undefined) upsertData.estado = estado;
  if (fechaVencimiento !== undefined) upsertData.fechaVencimiento = fechaVencimiento ? new Date(fechaVencimiento) : null;
  if (moneda !== undefined) upsertData.moneda = moneda;
  if (importe !== undefined) upsertData.importe = Number(importe);
  if (periodoDias !== undefined) upsertData.periodoDias = Number(periodoDias);
  if (notas !== undefined) upsertData.notas = notas;

  const sub = await db.profesorSubscription.upsert({
    where: { profesorId },
    create: { profesorId, ...upsertData },
    update: upsertData,
  });

  // Audit
  const prof = await db.user.findUnique({ where: { id: profesorId }, select: { email: true } }).catch(() => null);
  const esNueva = !sub.updatedAt || sub.createdAt === sub.updatedAt;
  await logAudit(
    "sub_upsert",
    `${esNueva ? "Creó" : "Actualizó"} suscripción — plan: ${sub.planTipo} · estado: ${sub.estado} · vence: ${sub.fechaVencimiento ? new Date(sub.fechaVencimiento).toLocaleDateString("es-AR") : "sin fecha"}`,
    prof?.email ?? null
  );

  return NextResponse.json({ subscription: sub });
}
