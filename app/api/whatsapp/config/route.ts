import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import { getDefaultWhatsAppConfig, normalizeWhatsAppConfig } from "@/lib/whatsappConfig";
import { normalizeTemplateMessage } from "@/lib/whatsappTemplateVariables";

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

    const validationWarnings: Array<{
      categoryKey: string;
      subcategoryKey: string;
      unknownVariables: string[];
    }> = [];

    for (const [categoryKey, category] of Object.entries(normalized.categories)) {
      for (const [subcategoryKey, sub] of Object.entries(category.subcategories)) {
        const messageNormalization = normalizeTemplateMessage(sub.message, {
          allowedVariables: Array.isArray(sub.variables) ? sub.variables : [],
        });

        sub.message = messageNormalization.message;

        if (messageNormalization.unknownVariables.length > 0) {
          validationWarnings.push({
            categoryKey,
            subcategoryKey,
            unknownVariables: messageNormalization.unknownVariables,
          });
        }
      }
    }

    const nextConfig = {
      ...normalized,
      updatedAt: new Date().toISOString(),
    };
    await setSyncValue(CONFIG_KEY, nextConfig);
    return NextResponse.json({
      ok: true,
      config: nextConfig,
      validationWarnings,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error al guardar configuracion" },
      { status: 500 }
    );
  }
}
