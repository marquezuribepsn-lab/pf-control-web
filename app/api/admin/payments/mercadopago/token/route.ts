import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  clearMercadoPagoLinkedAccount,
  linkMercadoPagoAccountFromOauthToken,
} from "@/lib/paymentMercadoPagoAccount";

// POST  /api/admin/payments/mercadopago/token
// Guarda un access token de Mercado Pago directamente (sin OAuth).
// El token se valida contra la API de MP antes de guardarse.
export async function POST(req: NextRequest) {
  const session = await auth();
  const role = String(
    (session?.user as { role?: string } | undefined)?.role || ""
  )
    .trim()
    .toUpperCase();

  if (!session || role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken = String(body.accessToken || "").trim();

  if (!accessToken) {
    return NextResponse.json(
      { message: "El campo accessToken es requerido." },
      { status: 400 }
    );
  }

  // Validar el token llamando a la API de Mercado Pago
  const meResponse = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => null);

  if (!meResponse || !meResponse.ok) {
    return NextResponse.json(
      {
        message:
          "El token no es válido o Mercado Pago no respondió. Verificá que sea un Access Token de producción correcto.",
      },
      { status: 400 }
    );
  }

  const meData = (await meResponse.json().catch(() => ({}))) as {
    id?: number | string;
    nickname?: string;
    email?: string;
  };

  // Guardarlo reutilizando el mismo almacenamiento que OAuth
  const linked = await linkMercadoPagoAccountFromOauthToken({
    access_token: accessToken,
    refresh_token: undefined,
    token_type: "bearer",
    scope: "offline_access read write",
    user_id: meData.id,
    public_key: undefined,
    expires_in: undefined, // sin expiración conocida
  });

  return NextResponse.json({
    ok: true,
    message: `Token guardado correctamente. Cuenta: ${linked.nickname || linked.email || String(meData.id || "desconocida")}`,
    linkedAccount: linked,
  });
}

// DELETE /api/admin/payments/mercadopago/token
// Elimina el token guardado (equivale a desconectar).
export async function DELETE() {
  const session = await auth();
  const role = String(
    (session?.user as { role?: string } | undefined)?.role || ""
  )
    .trim()
    .toUpperCase();

  if (!session || role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 });
  }

  await clearMercadoPagoLinkedAccount();
  return NextResponse.json({ ok: true, message: "Token eliminado." });
}
