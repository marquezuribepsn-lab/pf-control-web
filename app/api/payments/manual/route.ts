import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createManualPaymentRequest,
  getBillingDefaults,
  type ManualPaymentMethod,
  resolveBillingAccessByEmail,
} from "@/lib/billing";
import { sendWhatsAppInternalAlert } from "@/lib/whatsappAlerts";

function toPositiveAmount(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Number(parsed.toFixed(2)));
}

function toPositiveDays(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(365, Math.round(parsed)));
}

function normalizeCurrency(value: unknown, fallback: string): string {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || fallback;
}

function resolveManualMethod(value: unknown): ManualPaymentMethod | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "transferencia" || normalized === "efectivo" || normalized === "mercadopago") {
    return normalized;
  }
  return null;
}

function formatMoney(amount: number, currency: string): string {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `${currency.toUpperCase()} ${safeAmount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function resolveMethodLabel(method: ManualPaymentMethod): string {
  if (method === "transferencia") return "Transferencia";
  if (method === "efectivo") return "Efectivo";
  return "Mercado Pago QR";
}

export async function POST(req: NextRequest) {
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
  if (!access.clientKey) {
    return NextResponse.json(
      {
        message:
          "No encontramos tu ficha de alumno para asociar el pago. Contacta al profesor para vincular tu cuenta.",
      },
      { status: 400 }
    );
  }

  const payload = await req.json().catch(() => ({}));
  const method = resolveManualMethod(payload?.method);

  if (!method) {
    return NextResponse.json(
      { message: "Metodo invalido. Usa transferencia, efectivo o mercadopago." },
      { status: 400 }
    );
  }

  const defaults = getBillingDefaults(access.meta);
  const amount = toPositiveAmount(payload?.amount, defaults.amount);
  const periodDays = toPositiveDays(payload?.periodDays, defaults.periodDays);
  const currency = normalizeCurrency(payload?.currency, defaults.currency);
  const note = String(payload?.note || "").trim().slice(0, 400);

  const order = await createManualPaymentRequest({
    userId: session.user.id,
    email,
    clientKey: access.clientKey,
    amount,
    currency,
    periodDays,
    method,
    note,
  });

  const alertMessageLines = [
    "PF Control · Pago manual reportado",
    `Alumno: ${email}`,
    `Metodo: ${resolveMethodLabel(method)}`,
    `Importe: ${formatMoney(amount, currency)}`,
    `Periodo: ${periodDays} dias`,
    `Comprobante: ${order.receiptNumber || order.id}`,
    `Fecha: ${new Date(order.createdAt).toLocaleString("es-AR")}`,
  ];

  if (note) {
    alertMessageLines.push(`Nota: ${note}`);
  }

  let whatsAppAlertSent = false;
  try {
    const alertResult = await sendWhatsAppInternalAlert(alertMessageLines.join("\n"));
    whatsAppAlertSent = Boolean(alertResult?.ok);
  } catch {
    whatsAppAlertSent = false;
  }

  return NextResponse.json({
    ok: true,
    message: "Solicitud enviada. El admin debe confirmar el pago para renovar tu pase.",
    whatsAppAlertSent,
    order: {
      id: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      providerStatus: order.providerStatus,
      createdAt: order.createdAt,
      receiptNumber: order.receiptNumber,
      receiptIssuedAt: order.receiptIssuedAt,
      amount: order.amount,
      currency: order.currency,
      periodDays: order.periodDays,
    },
    receipt: {
      number: order.receiptNumber,
      issuedAt: order.receiptIssuedAt,
      amount: order.amount,
      currency: order.currency,
      periodDays: order.periodDays,
      paymentMethod: order.paymentMethod,
      status: order.status,
    },
  });
}
