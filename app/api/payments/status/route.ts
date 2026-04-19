import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getBillingDefaults,
  getLatestPaymentOrderForEmail,
  resolveBillingAccessByEmail,
} from "@/lib/billing";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const role = String((session.user as { role?: string | null } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  if (role !== "CLIENTE") {
    return NextResponse.json({ message: "Solo disponible para alumnos" }, { status: 403 });
  }

  const email = String(session.user.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "No se pudo resolver el email de la cuenta" }, { status: 400 });
  }

  const access = await resolveBillingAccessByEmail(email);
  const latestOrder = await getLatestPaymentOrderForEmail(email);
  const defaults = getBillingDefaults(access.meta);
  const mercadoPagoAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
  const mercadoPagoAccountLabel = String(process.env.PF_MERCADOPAGO_ACCOUNT_LABEL || "").trim();
  const collectorGuardEnabled = Boolean(String(process.env.MERCADOPAGO_COLLECTOR_ID || "").trim());

  return NextResponse.json({
    active: access.active,
    reason: access.reason,
    daysRemaining: access.daysRemaining,
    clientKey: access.clientKey,
    billing: {
      startDate: access.meta?.startDate || null,
      endDate: access.meta?.endDate || null,
      pagoEstado: access.meta?.pagoEstado || null,
      amount: defaults.amount,
      currency: defaults.currency,
      periodDays: defaults.periodDays,
    },
    latestOrder: latestOrder
      ? {
          id: latestOrder.id,
          provider: latestOrder.provider,
          paymentMethod: latestOrder.paymentMethod,
          status: latestOrder.status,
          providerStatus: latestOrder.providerStatus,
          amount: latestOrder.amount,
          currency: latestOrder.currency,
          periodDays: latestOrder.periodDays,
          createdAt: latestOrder.createdAt,
          approvedAt: latestOrder.approvedAt,
          adminNote: latestOrder.adminNote,
          reviewedAt: latestOrder.reviewedAt,
        }
      : null,
    providerConfigured: Boolean(mercadoPagoAccessToken),
    manualMethodsEnabled: true,
    mercadoPago: {
      configured: Boolean(mercadoPagoAccessToken),
      accountLabel: mercadoPagoAccountLabel || null,
      collectorGuardEnabled,
    },
  });
}
