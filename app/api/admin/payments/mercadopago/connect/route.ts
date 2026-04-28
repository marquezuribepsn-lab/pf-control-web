import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  clearMercadoPagoLinkedAccount,
  getMercadoPagoLinkedAccountPublic,
  isMercadoPagoOauthConfigured,
  resolveMercadoPagoAccess,
} from "@/lib/paymentMercadoPagoAccount";

async function requireAdmin() {
  const session = await auth();
  const role = String((session?.user as { role?: string | null } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  if (!session?.user?.id || role !== "ADMIN") {
    return null;
  }

  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const access = await resolveMercadoPagoAccess();
  const linkedAccount = await getMercadoPagoLinkedAccountPublic();

  return NextResponse.json({
    ok: true,
    oauthEnabled: isMercadoPagoOauthConfigured(),
    configured: access.configured,
    source: access.source,
    accountLabel: access.accountLabel,
    connected: Boolean(linkedAccount),
    linkedAccount,
  });
}

export async function DELETE() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  await clearMercadoPagoLinkedAccount();

  return NextResponse.json({
    ok: true,
    message: "Cuenta de Mercado Pago desconectada.",
  });
}
