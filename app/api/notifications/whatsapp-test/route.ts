import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendWhatsAppEventAlert } from "@/lib/whatsappAlerts";

export async function POST(req: Request) {
  const session = await auth();

  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { message?: string };
    const text = String(body?.message || "Prueba de WhatsApp desde PF Control").trim();

    if (!text) {
      return NextResponse.json({ message: "Mensaje vacio" }, { status: 400 });
    }

    await sendWhatsAppEventAlert(text);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "whatsapp test failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
