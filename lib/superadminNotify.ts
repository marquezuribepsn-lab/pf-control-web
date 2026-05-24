/**
 * Notificaciones del God Panel → Profesores
 * Email + WhatsApp (si tienen teléfono)
 */

import nodemailer from "nodemailer";
import { sendWhatsAppText } from "./whatsappAlerts";
import { prisma } from "./prisma";

const db = prisma as any;

const APP_NAME = "PF Control";
const APP_URL  = process.env.NEXTAUTH_URL || "https://pf-control.com";
const FROM     = process.env.GMAIL_USER   || process.env.BREVO_SENDER_EMAIL || "";
const PASS     = process.env.GMAIL_PASSWORD || "";

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type NotifType =
  | "pago_confirmado"
  | "vencimiento_proximo"
  | "suscripcion_activada"
  | "suscripcion_suspendida"
  | "suscripcion_vencida"
  | "aviso_personalizado";

export type NotifPayload = {
  type:           NotifType;
  profesorEmail:  string;
  profesorNombre: string;
  profesorTelefono?: string | null;
  // datos variables según tipo
  monto?:          string;
  moneda?:         string;
  metodoPago?:     string;
  periodoHasta?:   string;
  diasRestantes?:  number;
  planTipo?:       string;
  mensajeExtra?:   string;
  channels:        ("email" | "whatsapp")[];
};

export type NotifResult = {
  email:    { sent: boolean; error?: string };
  whatsapp: { sent: boolean; error?: string };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(v: unknown) {
  return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function buildEmailHtml(subject: string, heading: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string) {
  const cta = ctaLabel && ctaUrl
    ? `<div style="margin:20px 0"><a href="${esc(ctaUrl)}" style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px;">${esc(ctaLabel)}</a></div>`
    : "";
  return `
  <div style="background:#020617;padding:24px 12px;font-family:Segoe UI,Arial,sans-serif;color:#e2e8f0;">
    <div style="max-width:620px;margin:0 auto;background:#0b1329;border:1px solid rgba(148,163,184,.22);border-radius:16px;overflow:hidden;">
      <div style="padding:16px 24px;background:linear-gradient(135deg,#7c3aed22,#a21caf22);border-bottom:1px solid rgba(148,163,184,.15);">
        <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:900;color:#c4b5fd;">${esc(APP_NAME)}</p>
      </div>
      <div style="padding:28px 24px;">
        <h2 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#f8fafc;">${esc(heading)}</h2>
        ${bodyHtml}
        ${cta}
        <div style="margin-top:24px;padding-top:14px;border-top:1px solid rgba(148,163,184,.15);font-size:12px;color:#94a3b8;">
          <p style="margin:0;">${esc(APP_NAME)} · <a href="${esc(APP_URL)}" style="color:#7dd3fc;">${esc(APP_URL)}</a></p>
        </div>
      </div>
    </div>
  </div>`;
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 0;font-size:13px;color:#94a3b8;white-space:nowrap;padding-right:20px;">${esc(label)}</td><td style="padding:6px 0;font-size:13px;color:#f1f5f9;font-weight:700;">${esc(value)}</td></tr>`;
}

function table(rows: string) {
  return `<table style="border-collapse:collapse;width:100%;margin:12px 0;">${rows}</table>`;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Templates email ──────────────────────────────────────────────────────────
function buildEmailContent(p: NotifPayload): { subject: string; html: string } {
  const nombre = p.profesorNombre || p.profesorEmail;

  switch (p.type) {
    case "pago_confirmado": {
      const subject = `✅ Pago confirmado — ${APP_NAME}`;
      const html = buildEmailHtml(subject, "¡Pago confirmado!", `
        <p style="font-size:14px;color:#cbd5e1;margin:0 0 16px;">Hola <strong>${esc(nombre)}</strong>, tu pago fue registrado exitosamente. Aquí el detalle:</p>
        ${table([
          row("Monto",   `${p.monto ?? "—"} ${p.moneda ?? ""}`),
          row("Método",  p.metodoPago ?? "—"),
          row("Válido hasta", fmtDate(p.periodoHasta)),
          row("Plan",    p.planTipo ? p.planTipo.charAt(0).toUpperCase() + p.planTipo.slice(1) : "—"),
        ].join(""))}
        ${p.mensajeExtra ? `<p style="font-size:13px;color:#94a3b8;margin:12px 0 0;">${esc(p.mensajeExtra)}</p>` : ""}
      `, "Acceder al panel", `${APP_URL}/auth/login`);
      return { subject, html };
    }

    case "vencimiento_proximo": {
      const dias = p.diasRestantes ?? 0;
      const subject = `⚠️ Tu suscripción vence en ${dias} día${dias !== 1 ? "s" : ""} — ${APP_NAME}`;
      const html = buildEmailHtml(subject, `Tu suscripción vence pronto`, `
        <p style="font-size:14px;color:#cbd5e1;margin:0 0 16px;">Hola <strong>${esc(nombre)}</strong>, tu acceso a ${esc(APP_NAME)} vence en <strong>${dias} día${dias !== 1 ? "s" : ""}</strong>.</p>
        ${table([
          row("Vencimiento", fmtDate(p.periodoHasta)),
          row("Plan",        p.planTipo ? p.planTipo.charAt(0).toUpperCase() + p.planTipo.slice(1) : "—"),
        ].join(""))}
        <p style="font-size:13px;color:#f59e0b;margin:12px 0 0;">Contactá al administrador para renovar tu suscripción y mantener el acceso.</p>
        ${p.mensajeExtra ? `<p style="font-size:13px;color:#94a3b8;margin:8px 0 0;">${esc(p.mensajeExtra)}</p>` : ""}
      `);
      return { subject, html };
    }

    case "suscripcion_activada": {
      const subject = `🎉 Suscripción activada — ${APP_NAME}`;
      const html = buildEmailHtml(subject, "¡Suscripción activada!", `
        <p style="font-size:14px;color:#cbd5e1;margin:0 0 16px;">Hola <strong>${esc(nombre)}</strong>, tu suscripción fue activada. Ya podés ingresar al sistema.</p>
        ${table([
          row("Plan",    p.planTipo ? p.planTipo.charAt(0).toUpperCase() + p.planTipo.slice(1) : "—"),
          row("Hasta",   fmtDate(p.periodoHasta)),
        ].join(""))}
        ${p.mensajeExtra ? `<p style="font-size:13px;color:#94a3b8;margin:12px 0 0;">${esc(p.mensajeExtra)}</p>` : ""}
      `, "Ingresar al panel", `${APP_URL}/auth/login`);
      return { subject, html };
    }

    case "suscripcion_suspendida": {
      const subject = `🚫 Acceso suspendido — ${APP_NAME}`;
      const html = buildEmailHtml(subject, "Acceso suspendido", `
        <p style="font-size:14px;color:#cbd5e1;margin:0 0 16px;">Hola <strong>${esc(nombre)}</strong>, tu acceso a ${esc(APP_NAME)} fue suspendido temporalmente.</p>
        <p style="font-size:13px;color:#f87171;margin:0 0 16px;">Para reactivar tu cuenta, contactá al administrador del sistema.</p>
        ${p.mensajeExtra ? `<p style="font-size:13px;color:#94a3b8;margin:0;">${esc(p.mensajeExtra)}</p>` : ""}
      `);
      return { subject, html };
    }

    case "suscripcion_vencida": {
      const subject = `❌ Suscripción vencida — ${APP_NAME}`;
      const html = buildEmailHtml(subject, "Tu suscripción venció", `
        <p style="font-size:14px;color:#cbd5e1;margin:0 0 16px;">Hola <strong>${esc(nombre)}</strong>, tu suscripción de ${esc(APP_NAME)} venció y tu acceso fue desactivado.</p>
        <p style="font-size:13px;color:#f87171;margin:0 0 16px;">Contactá al administrador para renovar.</p>
        ${p.mensajeExtra ? `<p style="font-size:13px;color:#94a3b8;margin:0;">${esc(p.mensajeExtra)}</p>` : ""}
      `);
      return { subject, html };
    }

    case "aviso_personalizado":
    default: {
      const subject = `📢 Aviso de ${APP_NAME}`;
      const html = buildEmailHtml(subject, `Aviso de ${APP_NAME}`, `
        <p style="font-size:14px;color:#cbd5e1;margin:0 0 16px;">Hola <strong>${esc(nombre)}</strong>,</p>
        <p style="font-size:14px;color:#e2e8f0;margin:0 0 16px;white-space:pre-line;">${esc(p.mensajeExtra ?? "")}</p>
      `, "Acceder", `${APP_URL}/auth/login`);
      return { subject, html };
    }
  }
}

// ─── Templates WhatsApp ───────────────────────────────────────────────────────
function buildWhatsAppText(p: NotifPayload): string {
  const nombre = p.profesorNombre || p.profesorEmail;
  const dias = p.diasRestantes ?? 0;
  const vence = p.periodoHasta ? new Date(p.periodoHasta).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  switch (p.type) {
    case "pago_confirmado":
      return `✅ *${APP_NAME} — Pago confirmado*\n\nHola ${nombre}, tu pago fue registrado.\n💰 Monto: ${p.monto ?? "—"} ${p.moneda ?? ""}\n📋 Método: ${p.metodoPago ?? "—"}\n📅 Válido hasta: ${vence}${p.mensajeExtra ? `\n\n${p.mensajeExtra}` : ""}`;

    case "vencimiento_proximo":
      return `⚠️ *${APP_NAME} — Vencimiento próximo*\n\nHola ${nombre}, tu suscripción vence en *${dias} día${dias !== 1 ? "s" : ""}* (${vence}).\n\nContactá al administrador para renovar y mantener tu acceso.${p.mensajeExtra ? `\n\n${p.mensajeExtra}` : ""}`;

    case "suscripcion_activada":
      return `🎉 *${APP_NAME} — Suscripción activada*\n\nHola ${nombre}, tu suscripción fue activada. Ya podés ingresar al sistema.\n📅 Válido hasta: ${vence}${p.mensajeExtra ? `\n\n${p.mensajeExtra}` : ""}\n\n🔗 ${APP_URL}/auth/login`;

    case "suscripcion_suspendida":
      return `🚫 *${APP_NAME} — Acceso suspendido*\n\nHola ${nombre}, tu acceso fue suspendido temporalmente.\n\nContactá al administrador para reactivarlo.${p.mensajeExtra ? `\n\n${p.mensajeExtra}` : ""}`;

    case "suscripcion_vencida":
      return `❌ *${APP_NAME} — Suscripción vencida*\n\nHola ${nombre}, tu suscripción venció y el acceso fue desactivado.\n\nContactá al administrador para renovar.${p.mensajeExtra ? `\n\n${p.mensajeExtra}` : ""}`;

    case "aviso_personalizado":
    default:
      return `📢 *${APP_NAME}*\n\nHola ${nombre},\n\n${p.mensajeExtra ?? ""}`;
  }
}

// ─── Mailer ───────────────────────────────────────────────────────────────────
function getTransporter() {
  if (process.env.GMAIL_USER && process.env.GMAIL_PASSWORD) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASSWORD },
    });
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function sendProfesorNotification(payload: NotifPayload): Promise<NotifResult> {
  const result: NotifResult = {
    email:    { sent: false },
    whatsapp: { sent: false },
  };

  const emailContent = buildEmailContent(payload);

  // ── Email ──
  if (payload.channels.includes("email")) {
    try {
      // Try Brevo first
      if (process.env.BREVO_API_KEY && (process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM)) {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": process.env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { email: process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM, name: APP_NAME },
            to: [{ email: payload.profesorEmail }],
            subject: emailContent.subject,
            htmlContent: emailContent.html,
          }),
        });
        if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
        result.email.sent = true;
      } else {
        const t = getTransporter();
        if (!t) throw new Error("Sin configuración de email");
        await t.sendMail({ from: `${APP_NAME} <${FROM}>`, to: payload.profesorEmail, subject: emailContent.subject, html: emailContent.html });
        result.email.sent = true;
      }
    } catch (e: any) {
      result.email.error = e.message;
    }
  }

  // ── WhatsApp ──
  if (payload.channels.includes("whatsapp")) {
    const phone = payload.profesorTelefono;
    if (!phone) {
      result.whatsapp.error = "sin_telefono";
    } else {
      try {
        const msg = buildWhatsAppText(payload);
        const wa = await sendWhatsAppText(msg, { toOverride: phone, forceText: true });
        if (wa.ok) {
          result.whatsapp.sent = true;
        } else {
          result.whatsapp.error = wa.error ?? "wa_error";
        }
      } catch (e: any) {
        result.whatsapp.error = e.message;
      }
    }
  }

  // ── Log ──
  try {
    await db.notificacionLog.create({
      data: {
        profesorEmail:  payload.profesorEmail,
        profesorNombre: payload.profesorNombre,
        tipo:           payload.type,
        canales:        payload.channels.join(","),
        emailEnviado:   result.email.sent,
        emailError:     result.email.error ?? null,
        waEnviado:      result.whatsapp.sent,
        waError:        result.whatsapp.error ?? null,
      },
    });
  } catch { /* nunca bloquear por falla de log */ }

  return result;
}

// ─── Bulk: vencimientos próximos ──────────────────────────────────────────────
export type ProfesorBulk = {
  id: string; email: string; nombreCompleto: string; telefono?: string | null;
  subscription?: { estado: string; fechaVencimiento?: string | null; planTipo: string } | null;
};

export async function sendBulkVencimientoWarnings(
  profesores: ProfesorBulk[],
  diasUmbral: number,
  channels: ("email" | "whatsapp")[]
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0, failed = 0, skipped = 0;
  const now = Date.now();

  for (const p of profesores) {
    const sub = p.subscription;
    if (!sub || sub.estado !== "activo" || !sub.fechaVencimiento) { skipped++; continue; }
    const dias = Math.ceil((new Date(sub.fechaVencimiento).getTime() - now) / 86400000);
    if (dias < 0 || dias > diasUmbral) { skipped++; continue; }

    const r = await sendProfesorNotification({
      type: "vencimiento_proximo",
      profesorEmail: p.email,
      profesorNombre: p.nombreCompleto,
      profesorTelefono: p.telefono,
      diasRestantes: dias,
      periodoHasta: sub.fechaVencimiento,
      planTipo: sub.planTipo,
      channels,
    });

    const ok = (channels.includes("email") ? r.email.sent : true) || (channels.includes("whatsapp") ? r.whatsapp.sent : false);
    ok ? sent++ : failed++;

    // Small delay to avoid rate limiting
    await new Promise(res => setTimeout(res, 200));
  }

  return { sent, failed, skipped };
}
