import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  applyApprovedPayment,
  findClientMetaByEmail,
  createPaymentOrder,
  getClientMetaMap,
} from "@/lib/billing";

type MetodoDirecto = "transferencia" | "efectivo" | "gratis";

function normalizeMetodo(value: unknown): MetodoDirecto | null {
  const metodo = String(value || "").trim().toLowerCase();
  if (metodo === "transferencia" || metodo === "efectivo" || metodo === "gratis") {
    return metodo;
  }
  return null;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toAmount(value: unknown): number {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Confirmación directa de un pago manual desde la ficha del alumno (pestaña Datos).
 * A diferencia de /manual (que aprueba/rechaza órdenes creadas por el alumno),
 * este endpoint crea la orden YA aprobada y renueva el pase server-side por email,
 * usando el mismo núcleo (applyApprovedPayment) que Mercado Pago.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email || "").trim().toLowerCase();
  const clientKey = String(body.clientKey || "").trim();
  const metodo = normalizeMetodo(body.metodo);
  const currency = String(body.currency || "ARS").trim().toUpperCase() || "ARS";
  const periodDays = toPositiveInt(body.periodDays, 30);
  const esGratis = metodo === "gratis";
  const amount = esGratis ? 0 : toAmount(body.amount);

  if (!metodo || (!email && !clientKey)) {
    return NextResponse.json(
      { message: "Faltan datos: metodo (transferencia/efectivo/gratis) y email o clientKey son requeridos." },
      { status: 400 }
    );
  }

  // Resolver la ficha por clientKey (alumno:*) o por email.
  let resolvedClientKey: string | null = null;
  let resolvedEmail = email;

  if (clientKey.startsWith("alumno:")) {
    const metaMap = await getClientMetaMap();
    const meta = metaMap[clientKey];
    if (meta && typeof meta === "object") {
      resolvedClientKey = clientKey;
      resolvedEmail = String((meta as { email?: unknown }).email || email || "").trim().toLowerCase();
    }
  }

  if (!resolvedClientKey && email) {
    const match = await findClientMetaByEmail(email);
    if (match) {
      resolvedClientKey = match.clientKey;
      resolvedEmail = email;
    }
  }

  if (!resolvedClientKey) {
    return NextResponse.json(
      { message: "No se encontró ficha de alumno. Verificá el email o los datos en Clientes." },
      { status: 404 }
    );
  }

  const nowIso = new Date().toISOString();
  const reviewerUserId = String((session.user as { id?: string } | undefined)?.id || "") || null;
  const reviewerEmail = String(session.user.email || "").trim().toLowerCase() || null;
  const adminNote = esGratis
    ? "Pase libre (sin cobro) — confirmado desde ficha del alumno"
    : `Pago ${metodo} confirmado manualmente desde ficha del alumno`;

  // 1) Renovar el pase (mismo núcleo que MP).
  const applyResult = await applyApprovedPayment({
    clientKey: resolvedClientKey,
    email: resolvedEmail,
    amount,
    currency,
    periodDays,
    approvedAt: nowIso,
  });

  if (!applyResult) {
    return NextResponse.json(
      { message: "No se pudo renovar el pase: no encontramos la ficha del alumno." },
      { status: 409 }
    );
  }

  // 2) Dejar registro en el historial de órdenes (ya aprobado).
  const externalReference = `directo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const order = await createPaymentOrder({
    userId: reviewerUserId || "admin",
    email: resolvedEmail,
    clientKey: resolvedClientKey,
    provider: "manual",
    paymentMethod: esGratis ? "efectivo" : metodo,
    externalReference,
    amount,
    currency,
    periodDays,
    status: "approved",
    providerStatus: esGratis ? "free_pass_by_admin" : "approved_by_admin",
    receiptIssuedAt: nowIso,
    adminNote,
    reviewedByUserId: reviewerUserId,
    reviewedByUserEmail: reviewerEmail,
    reviewedAt: nowIso,
  });

  return NextResponse.json({
    ok: true,
    metodo,
    message: esGratis
      ? "Pase libre otorgado y acceso del alumno habilitado."
      : `Pago por ${metodo} confirmado, pase renovado y acceso habilitado.`,
    clientKey: applyResult.clientKey,
    endDate: applyResult.meta.endDate || null,
    orderId: order.id,
  });
}
