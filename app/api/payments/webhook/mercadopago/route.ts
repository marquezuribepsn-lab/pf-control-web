import { NextRequest, NextResponse } from "next/server";
import {
  applyApprovedPaymentByEmail,
  mapMercadoPagoStatus,
  updatePaymentOrderByExternalReference,
} from "@/lib/billing";
import { resolveMercadoPagoAccess } from "@/lib/paymentMercadoPagoAccount";

type MercadoPagoPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string | null;
  payer?: {
    email?: string;
  };
};

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeCurrency(value: unknown): string {
  return String(value || "ARS").trim().toUpperCase() || "ARS";
}

function normalizeAmount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed.toFixed(2)));
}

function extractPaymentId(searchParams: URLSearchParams, body: unknown): string {
  const bodyRecord = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const bodyData = bodyRecord.data && typeof bodyRecord.data === "object"
    ? (bodyRecord.data as Record<string, unknown>)
    : {};

  const fromQuery =
    searchParams.get("data.id") ||
    searchParams.get("id") ||
    searchParams.get("payment_id") ||
    "";

  if (String(fromQuery).trim()) {
    return String(fromQuery).trim();
  }

  const fromBody = bodyData.id || bodyRecord.id;
  return String(fromBody || "").trim();
}

export async function GET(req: NextRequest) {
  // Mercado Pago can hit GET for challenge/diagnostic checks.
  const webhookToken = String(process.env.MERCADOPAGO_WEBHOOK_TOKEN || "").trim();
  if (webhookToken) {
    const receivedToken = String(req.nextUrl.searchParams.get("token") || "").trim();
    if (!receivedToken || receivedToken !== webhookToken) {
      return NextResponse.json({ ok: false, message: "Token invalido" }, { status: 401 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const webhookToken = String(process.env.MERCADOPAGO_WEBHOOK_TOKEN || "").trim();
  if (webhookToken) {
    const receivedToken = String(req.nextUrl.searchParams.get("token") || "").trim();
    if (!receivedToken || receivedToken !== webhookToken) {
      return NextResponse.json({ ok: false, message: "Token invalido" }, { status: 401 });
    }
  }

  const mercadoPagoAccess = await resolveMercadoPagoAccess();
  const accessToken = String(mercadoPagoAccess.accessToken || "").trim();

  if (!mercadoPagoAccess.configured || !accessToken) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Mercado Pago no esta configurado. Conecta una cuenta en Admin > Pagos o define MERCADOPAGO_ACCESS_TOKEN.",
      },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const paymentId = extractPaymentId(req.nextUrl.searchParams, body);

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "notification_without_payment_id" });
  }

  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!paymentResponse.ok) {
    const errorBody = await paymentResponse.text().catch(() => "");
    console.error("[payments/webhook] MercadoPago payment fetch error", paymentResponse.status, errorBody);
    return NextResponse.json(
      { ok: false, message: "No se pudo consultar el pago en Mercado Pago" },
      { status: 502 }
    );
  }

  const paymentData = (await paymentResponse.json()) as MercadoPagoPayment;
  const externalReference = String(paymentData.external_reference || "").trim();
  const providerStatus = String(paymentData.status || "").trim().toLowerCase();
  const mappedStatus = mapMercadoPagoStatus(providerStatus);
  const payerEmail = normalizeEmail(paymentData.payer?.email);
  const amount = normalizeAmount(paymentData.transaction_amount);
  const currency = normalizeCurrency(paymentData.currency_id);

  const updatedOrder = externalReference
    ? await updatePaymentOrderByExternalReference(externalReference, {
        status: mappedStatus,
        providerStatus,
        providerPaymentId: String(paymentData.id || paymentId),
        approvedAt: mappedStatus === "approved" ? String(paymentData.date_approved || new Date().toISOString()) : null,
      })
    : null;

  if (mappedStatus === "approved") {
    const targetEmail = updatedOrder?.email || payerEmail;
    if (targetEmail) {
      await applyApprovedPaymentByEmail({
        email: targetEmail,
        amount,
        currency,
        periodDays: updatedOrder?.periodDays,
        approvedAt: String(paymentData.date_approved || new Date().toISOString()),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    paymentId: String(paymentData.id || paymentId),
    status: mappedStatus,
  });
}
