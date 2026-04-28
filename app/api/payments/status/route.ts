import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getBillingDefaults,
  getLatestApprovedPaymentOrderForEmail,
  getLatestPaymentOrderForEmail,
  resolveBillingAccessByEmail,
} from "@/lib/billing";
import { getVisibleTransferAccounts } from "@/lib/paymentTransferAccounts";

function normalizePaymentState(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

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
  const latestApprovedOrder = await getLatestApprovedPaymentOrderForEmail(email);
  const transferAccounts = await getVisibleTransferAccounts();
  const defaults = getBillingDefaults(access.meta);
  const mercadoPagoAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
  const mercadoPagoAccountLabel = String(process.env.PF_MERCADOPAGO_ACCOUNT_LABEL || "").trim();
  const collectorGuardEnabled = Boolean(String(process.env.MERCADOPAGO_COLLECTOR_ID || "").trim());
  const isPaid =
    access.active || normalizePaymentState(access.meta?.pagoEstado) === "confirmado";

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
    paymentSummary: {
      isPaid,
      planValidUntil: access.meta?.endDate || null,
      latestPaymentAt:
        latestApprovedOrder?.approvedAt || latestApprovedOrder?.createdAt || null,
      latestPaymentAmount:
        typeof latestApprovedOrder?.amount === "number" ? latestApprovedOrder.amount : null,
      latestPaymentCurrency: latestApprovedOrder?.currency || null,
      latestPaymentMethod: latestApprovedOrder?.paymentMethod || null,
      latestPaymentOrderId: latestApprovedOrder?.id || null,
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
          receiptNumber: latestOrder.receiptNumber,
          receiptIssuedAt: latestOrder.receiptIssuedAt,
        }
      : null,
    latestApprovedOrder: latestApprovedOrder
      ? {
          id: latestApprovedOrder.id,
          provider: latestApprovedOrder.provider,
          paymentMethod: latestApprovedOrder.paymentMethod,
          status: latestApprovedOrder.status,
          amount: latestApprovedOrder.amount,
          currency: latestApprovedOrder.currency,
          createdAt: latestApprovedOrder.createdAt,
          approvedAt: latestApprovedOrder.approvedAt,
          receiptNumber: latestApprovedOrder.receiptNumber,
          receiptIssuedAt: latestApprovedOrder.receiptIssuedAt,
        }
      : null,
    providerConfigured: Boolean(mercadoPagoAccessToken),
    manualMethodsEnabled: true,
    mercadoPago: {
      configured: Boolean(mercadoPagoAccessToken),
      accountLabel: mercadoPagoAccountLabel || null,
      collectorGuardEnabled,
    },
    transferAccounts: transferAccounts.map((item) => ({
      id: item.id,
      label: item.label,
      bankName: item.bankName,
      accountType: item.accountType,
      holderName: item.holderName,
      holderDocument: item.holderDocument,
      accountNumber: item.accountNumber,
      cbu: item.cbu,
      alias: item.alias,
      notes: item.notes,
    })),
  });
}
