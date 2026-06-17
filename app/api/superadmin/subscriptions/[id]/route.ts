import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// GET /api/superadmin/subscriptions/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const sub = await db.profesorSubscription.findUnique({
    where: { id },
    include: {
      profesor: {
        select: {
          id: true,
          email: true,
          nombreCompleto: true,
          telefono: true,
        },
      },
      pagos: {
        orderBy: { fechaPago: "desc" },
      },
    },
  });

  if (!sub) return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });

  return NextResponse.json({ subscription: sub });
}

// PATCH /api/superadmin/subscriptions/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const existing = await db.profesorSubscription.findUnique({
    where: { id },
    select: { id: true, profesorId: true },
  });
  if (!existing) return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });

  const body = await req.json();
  const { planTipo, maxAlumnos, maxPlanes, estado, fechaVencimiento, moneda, importe, periodoDias, notas } = body;

  const updateData: any = {};
  if (planTipo !== undefined)         updateData.planTipo         = planTipo;
  if (maxAlumnos !== undefined)       updateData.maxAlumnos       = Number(maxAlumnos);
  if (maxPlanes !== undefined)        updateData.maxPlanes        = Number(maxPlanes);
  if (estado !== undefined)           updateData.estado           = estado;
  if (fechaVencimiento !== undefined) updateData.fechaVencimiento = fechaVencimiento ? new Date(fechaVencimiento) : null;
  if (moneda !== undefined)           updateData.moneda           = moneda;
  if (importe !== undefined)          updateData.importe          = Number(importe);
  if (periodoDias !== undefined)      updateData.periodoDias      = Number(periodoDias);
  if (notas !== undefined)            updateData.notas            = notas;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar" }, { status: 400 });
  }

  const sub = await db.profesorSubscription.update({
    where: { id },
    data: updateData,
  });

  // Audit
  const prof = await db.user
    .findUnique({ where: { id: existing.profesorId }, select: { email: true } })
    .catch(() => null);
  const changed = Object.entries(updateData)
    .map(([k, v]) => `${k}: ${v instanceof Date ? v.toLocaleDateString("es-AR") : v}`)
    .join(" · ");
  await logAudit("sub_update", `Actualizó suscripción [${id.slice(-6)}] — ${changed}`, prof?.email ?? null);

  return NextResponse.json({ subscription: sub });
}

// DELETE /api/superadmin/subscriptions/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const existing = await db.profesorSubscription.findUnique({
    where: { id },
    select: { id: true, profesorId: true, planTipo: true },
  });
  if (!existing) return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });

  // Delete payments first (cascade if not set in schema)
  await db.profesorPago.deleteMany({ where: { subscriptionId: id } });
  await db.profesorSubscription.delete({ where: { id } });

  // Audit
  const prof = await db.user
    .findUnique({ where: { id: existing.profesorId }, select: { email: true } })
    .catch(() => null);
  await logAudit(
    "sub_delete",
    `Eliminó suscripción [${id.slice(-6)}] — plan: ${existing.planTipo}`,
    prof?.email ?? null
  );

  return NextResponse.json({ ok: true });
}
