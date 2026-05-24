import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// GET /api/superadmin/config/status — integration health check
export async function GET() {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const gmailOk  = !!(process.env.GMAIL_USER && process.env.GMAIL_PASSWORD);
  const brevoOk  = !!(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
  const waOk     = process.env.WHATSAPP_ALERTS_ENABLED === "1" &&
                   !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  const cronOk   = !!process.env.CRON_SECRET;

  return NextResponse.json({
    ok: true,
    integrations: {
      email: {
        configured: gmailOk || brevoOk,
        provider:   brevoOk ? "Brevo" : gmailOk ? "Gmail" : null,
        brevo:      brevoOk,
        gmail:      gmailOk,
        from:       process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || null,
      },
      whatsapp: {
        configured: waOk,
        enabled:    process.env.WHATSAPP_ALERTS_ENABLED === "1",
        phoneId:    process.env.WHATSAPP_PHONE_NUMBER_ID ? "set" : null,
      },
      cron: {
        configured: cronOk,
        url:        process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/api/superadmin/cron/recordatorios` : null,
      },
    },
  });
}
