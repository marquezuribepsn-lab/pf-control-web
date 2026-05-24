import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// PATCH /api/superadmin/subscriptions/[id]/pagos/[pagoId] — edit a payment
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; pagoId: string } }
) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { monto, moneda, metodoPago, fechaPago, periodoDesde, periodoHasta, notas } = body;

  const updateData: any = {};
  if (monto       !== undefined) updateData.monto       = Number(monto);
  if (moneda      !== undefined) updateData.moneda      = moneda;
  if (metodoPago  !== undefined) updateData.metodoPago  = metodoPago;
  if (fechaPago   !== undefined) updateData.fechaPago   = new Date(fechaPago);
  if (periodoDesde !== undefined) updateData.periodoDesde = new Date(periodoDesde);
  if (periodoHasta !== undefined) {
    updateData.periodoHasta = new Date(periodoHasta);
    // Keep subscription vencimiento in sync with latest periodoHasta
    await db.profesorSubscription.update({
      where: { id: params.id },
      data: { fechaVencimiento: new Date(periodoHasta) },
    }).catch(() => {});
  }
  if (notas !== undefined) updateData.notas = notas || null;

  const pago = await db.profesorPago.update({
    where: { id: params.pagoId },
    data: updateData,
  });

  // Audit
  const sub = await db.profesorSubscription.findUnique({
    where: { id: params.id },
    include: { profesor: { select: { email: true } } },
  }).catch(() => null);
  await logAudit(
    "pago_editado",
    `Pago ${params.pagoId.slice(-6)} editado`,
    sub?.profesor?.email ?? null
  );

  return NextResponse.json({ pago });
}

// DELETE /api/superadmin/subscriptions/[id]/pagos/[pagoId] — delete a payment
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; pagoId: string } }
) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.profesorPago.delete({ where: { id: params.pagoId } });

  const sub = await db.profesorSubscription.findUnique({
    where: { id: params.id },
    include: { profesor: { select: { email: true } } },
  }).catch(() => null);
  await logAudit(
    "pago_eliminado",
    `Pago ${params.pagoId.slice(-6)} eliminado`,
    sub?.profesor?.email ?? null
  );

  return NextResponse.json({ ok: true });
}
