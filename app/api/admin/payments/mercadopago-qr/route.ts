import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getMercadoPagoQrStoreConfig,
  resetMercadoPagoQrStoreConfig,
  upsertMercadoPagoQrStoreConfig,
} from "@/lib/paymentMercadoPagoQrStore";

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

  const config = await getMercadoPagoQrStoreConfig();

  return NextResponse.json({
    ok: true,
    config,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const config = await upsertMercadoPagoQrStoreConfig({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      label: typeof body.label === "string" ? body.label : undefined,
      paymentLink: typeof body.paymentLink === "string" ? body.paymentLink : undefined,
      qrPayload: typeof body.qrPayload === "string" ? body.qrPayload : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return NextResponse.json({
      ok: true,
      message: "QR de Mercado Pago guardado correctamente.",
      config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la configuracion de QR Mercado Pago.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const config = await resetMercadoPagoQrStoreConfig();

  return NextResponse.json({
    ok: true,
    message: "Configuracion QR reiniciada.",
    config,
  });
}
