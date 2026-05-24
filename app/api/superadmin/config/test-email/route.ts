import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import nodemailer from "nodemailer";

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// POST /api/superadmin/config/test-email — send a test email to the superadmin
export async function POST() {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const toEmail = (session as any).user?.email;
  if (!toEmail) return NextResponse.json({ error: "No email in session" }, { status: 400 });

  const subject = "✅ Test de email — God Panel";
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#0d1117;color:#e2e8f0;border-radius:12px;">
      <h2 style="color:#a78bfa;margin-bottom:8px;">✅ Email configurado correctamente</h2>
      <p style="color:#94a3b8;font-size:14px;">Este es un email de prueba enviado desde el God Panel.</p>
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;" />
      <p style="color:#475569;font-size:12px;">Si recibiste este mensaje, la integración de email está funcionando.</p>
    </div>
  `;

  // Try Brevo
  if (process.env.BREVO_API_KEY && (process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM)) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": process.env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { email: process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM, name: "God Panel" },
          to: [{ email: toEmail }],
          subject,
          htmlContent: html,
        }),
      });
      if (res.ok) return NextResponse.json({ ok: true, provider: "brevo", to: toEmail });
      const err = await res.text();
      return NextResponse.json({ ok: false, provider: "brevo", error: err }, { status: 500 });
    } catch (e: any) {
      return NextResponse.json({ ok: false, provider: "brevo", error: e.message }, { status: 500 });
    }
  }

  // Try Gmail
  if (process.env.GMAIL_USER && process.env.GMAIL_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASSWORD },
      });
      await transporter.sendMail({ from: process.env.GMAIL_USER, to: toEmail, subject, html });
      return NextResponse.json({ ok: true, provider: "gmail", to: toEmail });
    } catch (e: any) {
      return NextResponse.json({ ok: false, provider: "gmail", error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: "Ningún proveedor de email configurado" }, { status: 400 });
}
