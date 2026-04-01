import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";

const CONFIG_KEY = "whatsapp-config-v1";

const DEFAULT_CONFIG = {
  connection: {
    enabled: true,
    mode: "test",
  },
  categories: {
    cobranzas: { enabled: true },
    recordatorios_otros: { enabled: true },
  },
  updatedAt: new Date(0).toISOString(),
};

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

  const config = (await getSyncValue(CONFIG_KEY)) || DEFAULT_CONFIG;
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const nextConfig = {
      ...DEFAULT_CONFIG,
      ...(body || {}),
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
