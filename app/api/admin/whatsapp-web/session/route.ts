import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  connectWhatsAppWebSession,
  disconnectWhatsAppWebSession,
  getWhatsAppWebSessionSnapshot,
} from "@/lib/whatsappWebClient";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const includeQr = req.nextUrl.searchParams.get("includeQr") !== "0";
  const session = await getWhatsAppWebSessionSnapshot({ includeQr });
  return NextResponse.json({ ok: true, session });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
    };

    const action = String(body.action || "connect").trim().toLowerCase();

    if (action === "disconnect") {
      const session = await disconnectWhatsAppWebSession({ logout: false });
      return NextResponse.json({ ok: true, session });
    }

    if (action === "logout") {
      const session = await disconnectWhatsAppWebSession({ logout: true });
      return NextResponse.json({ ok: true, session });
    }

    if (action === "restart") {
      await disconnectWhatsAppWebSession({ logout: false });
      const session = await connectWhatsAppWebSession();
      return NextResponse.json({ ok: true, session });
    }

    const session = await connectWhatsAppWebSession();
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo gestionar la sesion de WhatsApp Web",
      },
      { status: 500 }
    );
  }
}
