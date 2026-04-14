import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listWhatsAppRecipientsAudit } from "@/lib/whatsappRecipients";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const audit = await listWhatsAppRecipientsAudit();

  return NextResponse.json({
    ok: true,
    recipients: audit.recipients,
    missingPhones: audit.missingPhones,
    summary: {
      totalRecipients: audit.recipients.length,
      missingPhones: audit.missingPhones.length,
    },
  });
}
