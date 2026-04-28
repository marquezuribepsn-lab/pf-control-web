import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  consumeMercadoPagoOauthState,
  exchangeMercadoPagoOauthCode,
  isMercadoPagoOauthConfigured,
  linkMercadoPagoAccountFromOauthToken,
} from "@/lib/paymentMercadoPagoAccount";

function getAppBaseUrl(req: NextRequest): string {
  const envBase = String(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (envBase) {
    return envBase.replace(/\/+$/, "");
  }

  const origin = req.nextUrl.origin || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return String(origin || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

function getRedirectUri(req: NextRequest): string {
  const explicit = String(process.env.MERCADOPAGO_APP_REDIRECT_URI || "").trim();
  if (explicit) {
    return explicit;
  }

  return `${getAppBaseUrl(req)}/api/admin/payments/mercadopago/connect/callback`;
}

function adminPagosRedirect(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL("/admin/pagos", req.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = String((session?.user as { role?: string | null } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  if (!session?.user?.id || role !== "ADMIN") {
    return adminPagosRedirect(req, { mp_error: "no_autorizado" });
  }

  if (!isMercadoPagoOauthConfigured()) {
    return adminPagosRedirect(req, { mp_error: "oauth_no_configurado" });
  }

  const error = String(req.nextUrl.searchParams.get("error") || "").trim();
  if (error) {
    return adminPagosRedirect(req, { mp_error: `oauth_${error}` });
  }

  const code = String(req.nextUrl.searchParams.get("code") || "").trim();
  const state = String(req.nextUrl.searchParams.get("state") || "").trim();

  if (!code || !state) {
    return adminPagosRedirect(req, { mp_error: "faltan_datos_oauth" });
  }

  const stateIsValid = await consumeMercadoPagoOauthState({
    state,
    adminUserId: String(session.user.id),
  });

  if (!stateIsValid) {
    return adminPagosRedirect(req, { mp_error: "state_invalido" });
  }

  try {
    const tokenData = await exchangeMercadoPagoOauthCode({
      code,
      redirectUri: getRedirectUri(req),
    });

    await linkMercadoPagoAccountFromOauthToken(tokenData);
    return adminPagosRedirect(req, { mp_connected: "1" });
  } catch {
    return adminPagosRedirect(req, { mp_error: "fallo_conexion" });
  }
}
