import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  applyApprovedPayment,
  getManualPaymentOrders,
  updatePaymentOrderById,
} from "@/lib/billing";

type ManualAction = "approve" | "reject";

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeAction(value: unknown): ManualAction | null {
  const action = String(value || "").trim().toLowerCase();
  if (action === "approve" || action === "reject") {
    return action;
  }
  return null;
}

function mapOrderForResponse(order: Awaited<ReturnType<typeof getManualPaymentOrders>>[number]) {
  return {
    id: order.id,
    userId: order.userId,
    email: order.email,
    clientKey: order.clientKey,
    paymentMethod: order.paymentMethod,
    status: order.status,
    providerStatus: order.providerStatus,
    amount: order.amount,
    currency: order.currency,
    periodDays: order.periodDays,
    receiptNumber: order.receiptNumber,
    receiptIssuedAt: order.receiptIssuedAt,
    createdAt: order.createdAt,
    approvedAt: order.approvedAt,
    reviewedAt: order.reviewedAt,
    adminNote: order.adminNote,
    reviewedByUserEmail: order.reviewedByUserEmail,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const includeAll = String(req.nextUrl.searchParams.get("all") || "").trim() === "1";
  const email = normalizeEmail(req.nextUrl.searchParams.get("email") || "");

  const orders = await getManualPaymentOrders({
    onlyPending: !includeAll,
    email: email || undefined,
  });

  return NextResponse.json({
    ok: true,
    total: orders.length,
    orders: orders.map(mapOrderForResponse),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = String(body?.orderId || "").trim();
  const action = normalizeAction(body?.action);
  const adminNote = String(body?.adminNote || "").trim().slice(0, 400);

  if (!orderId || !action) {
    return NextResponse.json(
      { message: "Debes indicar orderId y action (approve/reject)." },
      { status: 400 }
    );
  }

  const manualOrders = await getManualPaymentOrders({ onlyPending: false });
  const targetOrder = manualOrders.find((order) => order.id === orderId);

  if (!targetOrder) {
    return NextResponse.json({ message: "Orden manual no encontrada" }, { status: 404 });
  }

  const reviewerUserId = String(session.user.id || "").trim() || null;
  const reviewerEmail = normalizeEmail(session.user.email || "") || null;
  const reviewDate = new Date().toISOString();

  if (action === "approve") {
    const applyResult = await applyApprovedPayment({
      clientKey: targetOrder.clientKey,
      email: targetOrder.email,
      amount: targetOrder.amount,
      currency: targetOrder.currency,
      periodDays: targetOrder.periodDays,
      approvedAt: reviewDate,
    });

    if (!applyResult) {
      return NextResponse.json(
        { message: "No se pudo renovar el pase: no encontramos la ficha del alumno." },
        { status: 409 }
      );
    }

    const updated = await updatePaymentOrderById(orderId, {
      status: "approved",
      providerStatus: "approved_by_admin",
      approvedAt: reviewDate,
      reviewedAt: reviewDate,
      reviewedByUserId: reviewerUserId,
      reviewedByUserEmail: reviewerEmail,
      adminNote: adminNote || targetOrder.adminNote,
    });

    return NextResponse.json({
      ok: true,
      action,
      message: "Pago aprobado, pase renovado y acceso del alumno habilitado automaticamente.",
      order: updated ? mapOrderForResponse(updated) : null,
      renewal: {
        clientKey: applyResult.clientKey,
        endDate: applyResult.meta.endDate || null,
      },
    });
  }

  const updated = await updatePaymentOrderById(orderId, {
    status: "rejected",
    providerStatus: "rejected_by_admin",
    reviewedAt: reviewDate,
    reviewedByUserId: reviewerUserId,
    reviewedByUserEmail: reviewerEmail,
    adminNote: adminNote || targetOrder.adminNote,
  });

  return NextResponse.json({
    ok: true,
    action,
    message: "Pago rechazado. El alumno sigue inhabilitado hasta un pago valido.",
    order: updated ? mapOrderForResponse(updated) : null,
  });
}
