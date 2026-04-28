import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createPaymentOrder,
  getBillingDefaults,
  resolveBillingAccessByEmail,
} from "@/lib/billing";
import { resolveMercadoPagoAccess } from "@/lib/paymentMercadoPagoAccount";

function getAppBaseUrl(req: NextRequest): string {
  const envBase = String(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (envBase) {
    return envBase.replace(/\/+$/, "");
  }

  const origin = req.nextUrl.origin || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return String(origin || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

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

function buildExternalReference(userId: string): string {
  const safeUser = String(userId || "user").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "user";
  return `pf-${safeUser}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function validateMercadoPagoCollector(accessToken: string, expectedCollectorId: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  const normalizedExpected = String(expectedCollectorId || "").trim();
  if (!normalizedExpected) {
    return { ok: true };
  }

  const response = await fetch("https://api.mercadopago.com/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      message: "No se pudo validar la cuenta de Mercado Pago configurada.",
    };
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string | number };
  const collectorId = String(data.id || "").trim();

  if (!collectorId || collectorId !== normalizedExpected) {
    return {
      ok: false,
      message:
        "La cuenta de Mercado Pago conectada no coincide con el vendedor esperado. Revisa la configuracion de cobros en Admin > Pagos.",
    };
  }

  return { ok: true };
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

  const mercadoPagoAccess = await resolveMercadoPagoAccess();
  const accessToken = String(mercadoPagoAccess.accessToken || "").trim();

  if (!mercadoPagoAccess.configured || !accessToken) {
    return NextResponse.json(
      {
        message:
          "Mercado Pago no esta configurado. Conecta una cuenta en Admin > Pagos o define MERCADOPAGO_ACCESS_TOKEN.",
      },
      { status: 500 }
    );
  }

  const expectedCollectorId = String(mercadoPagoAccess.expectedCollectorId || "").trim();
  if (expectedCollectorId) {
    const collectorValidation = await validateMercadoPagoCollector(accessToken, expectedCollectorId);
    if (!collectorValidation.ok) {
      return NextResponse.json(
        { message: collectorValidation.message || "Cuenta de Mercado Pago invalida" },
        { status: 500 }
      );
    }
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

  const defaults = getBillingDefaults(access.meta);
  const payload = await req.json().catch(() => ({}));

  const amount = toPositiveAmount(payload?.amount, defaults.amount);
  const periodDays = toPositiveDays(payload?.periodDays, defaults.periodDays);
  const currency = normalizeCurrency(payload?.currency, defaults.currency);

  const baseUrl = getAppBaseUrl(req);
  const externalReference = buildExternalReference(session.user.id);
  const webhookToken = String(process.env.MERCADOPAGO_WEBHOOK_TOKEN || "").trim();
  const webhookQuery = webhookToken ? `?token=${encodeURIComponent(webhookToken)}` : "";

  const preferencePayload = {
    items: [
      {
        title: `PF Control - Pase ${periodDays} dias`,
        quantity: 1,
        currency_id: currency,
        unit_price: amount,
      },
    ],
    payer: {
      email,
    },
    external_reference: externalReference,
    notification_url: `${baseUrl}/api/payments/webhook/mercadopago${webhookQuery}`,
    back_urls: {
      success: `${baseUrl}/alumnos/pagos?payment=success`,
      failure: `${baseUrl}/alumnos/pagos?payment=failure`,
      pending: `${baseUrl}/alumnos/pagos?payment=pending`,
    },
    auto_return: "approved",
    metadata: {
      userId: session.user.id,
      clientKey: access.clientKey,
      periodDays,
    },
  };

  const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferencePayload),
    cache: "no-store",
  });

  if (!preferenceResponse.ok) {
    const errorBody = await preferenceResponse.text().catch(() => "");
    console.error("[payments/checkout] MercadoPago error", preferenceResponse.status, errorBody);
    return NextResponse.json(
      { message: "No se pudo iniciar el checkout de pago. Intenta nuevamente." },
      { status: 502 }
    );
  }

  const preferenceData = (await preferenceResponse.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };

  const checkoutUrl = String(preferenceData.init_point || preferenceData.sandbox_init_point || "").trim();
  if (!checkoutUrl) {
    return NextResponse.json(
      { message: "Mercado Pago no devolvio un enlace de pago valido." },
      { status: 502 }
    );
  }

  const order = await createPaymentOrder({
    userId: session.user.id,
    email,
    clientKey: access.clientKey,
    externalReference,
    amount,
    currency,
    periodDays,
    preferenceId: preferenceData.id || null,
    checkoutUrl,
  });

  return NextResponse.json({
    ok: true,
    checkoutUrl,
    orderId: order.id,
    externalReference: order.externalReference,
  });
}
