import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createManualPaymentRequest,
  getBillingDefaults,
  type ManualPaymentMethod,
  resolveBillingAccessByEmail,
} from "@/lib/billing";

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
  if (normalized === "transferencia" || normalized === "efectivo") {
    return normalized;
  }
  return null;
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
      { message: "Metodo invalido. Usa transferencia o efectivo." },
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

  return NextResponse.json({
    ok: true,
    message: "Solicitud enviada. El admin debe confirmar el pago para renovar tu pase.",
    order: {
      id: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      providerStatus: order.providerStatus,
      createdAt: order.createdAt,
    },
  });
}
