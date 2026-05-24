import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// POST /api/superadmin/subscriptions/[id]/pagos — register a payment
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { monto, moneda, metodoPago, fechaPago, periodoDesde, periodoHasta, comprobante, notas } = body;

  if (!monto || !periodoDesde || !periodoHasta) {
    return NextResponse.json({ error: "monto, periodoDesde y periodoHasta son requeridos" }, { status: 400 });
  }

  const pago = await db.profesorPago.create({
    data: {
      subscriptionId: params.id,
      monto: Number(monto),
      moneda: moneda || "USD",
      metodoPago: metodoPago || "efectivo",
      fechaPago: fechaPago ? new Date(fechaPago) : new Date(),
      periodoDesde: new Date(periodoDesde),
      periodoHasta: new Date(periodoHasta),
      comprobante: comprobante || null,
      notas: notas || null,
    },
  });

  // Auto-update subscription to 'activo' and set new vencimiento
  await db.profesorSubscription.update({
    where: { id: params.id },
    data: {
      estado: "activo",
      fechaVencimiento: new Date(periodoHasta),
    },
  });

  // Audit
  const sub = await db.profesorSubscription.findUnique({
    where: { id: params.id },
    include: { profesor: { select: { email: true } } },
  }).catch(() => null);
  await logAudit(
    "pago_registrado",
    `${new Intl.NumberFormat("es-AR",{style:"currency",currency:pago.moneda,maximumFractionDigits:0}).format(pago.monto)} · ${pago.metodoPago} · período hasta ${new Date(periodoHasta).toLocaleDateString("es-AR")}`,
    sub?.profesor?.email ?? null
  );

  return NextResponse.json({ pago });
}

// GET /api/superadmin/subscriptions/[id]/pagos — list payments
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pagos = await db.profesorPago.findMany({
    where: { subscriptionId: params.id },
    orderBy: { fechaPago: "desc" },
  });

  return NextResponse.json({ pagos });
}
