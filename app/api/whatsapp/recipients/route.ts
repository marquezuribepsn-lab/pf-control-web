import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listWhatsAppRecipients } from "@/lib/whatsappRecipients";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const recipients = await listWhatsAppRecipients();
  return NextResponse.json({ ok: true, recipients });
}
