import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getPlanPrecios,
  applyApprovedPayment,
  findClientMetaByEmail,
  createPaymentOrder,
} from "@/lib/billing";
import { resolveMercadoPagoAccess } from "@/lib/paymentMercadoPagoAccount";

function getAppBaseUrl(req: NextRequest): string {
  const envBase = String(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  const origin = req.nextUrl.origin || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return String(origin || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

function buildExternalReference(email: string): string {
  const safe = email.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "user";
  return `pf-admin-${safe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const planId = String(body.planId || "").trim();
  const alumnoEmail = String(body.alumnoEmail || "").trim().toLowerCase();
  const modo = String(body.modo || "").trim();

  if (!planId || !alumnoEmail || !modo) {
    return NextResponse.json(
      { message: "Faltan datos: planId, alumnoEmail y modo son requeridos" },
      { status: 400 }
    );
  }

  const planes = await getPlanPrecios();
  const plan = planes.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ message: "Plan no encontrado" }, { status: 404 });
  }

  const match = await findClientMetaByEmail(alumnoEmail);
  if (!match) {
    return NextResponse.json(
      { message: "No se encontro ficha de alumno para ese email. Verificar en Clientes." },
      { status: 404 }
    );
  }

  if (modo === "sin_pago") {
    const result = await applyApprovedPayment({
      clientKey: match.clientKey,
      email: alumnoEmail,
      amount: plan.precio,
      currency: plan.moneda,
      periodDays: plan.duracionDias,
      approvedAt: new Date().toISOString().slice(0, 10),
    });

    if (!result) {
      return NextResponse.json({ message: "No se pudo activar el pase del alumno" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      modo: "sin_pago",
      clientKey: result.clientKey,
      message: `Pase activado. Plan: ${plan.nombre}, ${plan.duracionDias} dias.`,
    });
  }

  if (modo === "con_pago_mp") {
    const mercadoPagoAccess = await resolveMercadoPagoAccess();
    const accessToken = String(mercadoPagoAccess.accessToken || "").trim();

    if (!mercadoPagoAccess.configured || !accessToken) {
      return NextResponse.json(
        { message: "Mercado Pago no esta configurado. Conecta una cuenta en Admin > Pagos." },
        { status: 500 }
      );
    }

    const baseUrl = getAppBaseUrl(req);
    const externalReference = buildExternalReference(alumnoEmail);
    const webhookToken = String(process.env.MERCADOPAGO_WEBHOOK_TOKEN || "").trim();
    const webhookQuery = webhookToken ? `?token=${encodeURIComponent(webhookToken)}` : "";

    const preferencePayload = {
      items: [
        {
          title: `PF Control - ${plan.nombre} (${plan.duracionDias} dias)`,
          quantity: 1,
          currency_id: plan.moneda,
          unit_price: plan.precio,
        },
      ],
      payer: { email: alumnoEmail },
      external_reference: externalReference,
      notification_url: `${baseUrl}/api/payments/webhook/mercadopago${webhookQuery}`,
      back_urls: {
        success: `${baseUrl}/alumnos/pagos?payment=success`,
        failure: `${baseUrl}/alumnos/pagos?payment=failure`,
        pending: `${baseUrl}/alumnos/pagos?payment=pending`,
      },
      auto_return: "approved",
      metadata: {
        clientKey: match.clientKey,
        periodDays: plan.duracionDias,
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
      console.error("[asignar-plan] MercadoPago error", preferenceResponse.status, errorBody);
      return NextResponse.json(
        { message: "No se pudo generar el link de pago. Intenta nuevamente." },
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
      userId: String((session.user as { id?: string } | undefined)?.id || "admin"),
      email: alumnoEmail,
      clientKey: match.clientKey,
      externalReference,
      amount: plan.precio,
      currency: plan.moneda,
      periodDays: plan.duracionDias,
      preferenceId: preferenceData.id || null,
      checkoutUrl,
    });

    return NextResponse.json({
      ok: true,
      modo: "con_pago_mp",
      checkoutUrl,
      orderId: order.id,
      externalReference: order.externalReference,
      message: `Link de pago generado para ${alumnoEmail}. Plan: ${plan.nombre}.`,
    });
  }

  return NextResponse.json(
    { message: "Modo invalido. Usa 'sin_pago' o 'con_pago_mp'" },
    { status: 400 }
  );
}
