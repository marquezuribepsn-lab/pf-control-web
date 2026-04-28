import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildMercadoPagoOauthAuthorizeUrl,
  createMercadoPagoOauthState,
  isMercadoPagoOauthConfigured,
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

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = String((session?.user as { role?: string | null } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  if (!session?.user?.id || role !== "ADMIN") {
    const target = new URL("/admin/pagos?mp_error=no_autorizado", req.url);
    return NextResponse.redirect(target);
  }

  if (!isMercadoPagoOauthConfigured()) {
    const target = new URL("/admin/pagos?mp_error=oauth_no_configurado", req.url);
    return NextResponse.redirect(target);
  }

  const redirectUri = getRedirectUri(req);
  const state = await createMercadoPagoOauthState(String(session.user.id));
  const authorizeUrl = buildMercadoPagoOauthAuthorizeUrl({
    clientId: String(process.env.MERCADOPAGO_APP_CLIENT_ID || "").trim(),
    redirectUri,
    state,
  });

  return NextResponse.redirect(authorizeUrl);
}
