import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import { getDefaultWhatsAppConfig, normalizeWhatsAppConfig } from "@/lib/whatsappConfig";

const CONFIG_KEY = "whatsapp-config-v1";

async function requireAdmin() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const raw = await getSyncValue(CONFIG_KEY);
  const config = normalizeWhatsAppConfig(raw || getDefaultWhatsAppConfig());
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const normalized = normalizeWhatsAppConfig(body || {});
    const nextConfig = {
      ...normalized,
      updatedAt: new Date().toISOString(),
    };
    await setSyncValue(CONFIG_KEY, nextConfig);
    return NextResponse.json({ ok: true, config: nextConfig });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error al guardar configuracion" },
      { status: 500 }
    );
  }
}
