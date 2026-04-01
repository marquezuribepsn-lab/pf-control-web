import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from './prisma';

const db = prisma as any;

const hasBrevoApiConfig = Boolean(process.env.BREVO_API_KEY && (process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM));
const hasSmtpConfig = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const hasMailtrapConfig = Boolean(process.env.MAILTRAP_HOST && process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS);
const hasGmailConfig = Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASSWORD);

const isProduction = process.env.NODE_ENV === 'production';
const activeProvider = hasBrevoApiConfig
  ? 'brevo'
  : hasSmtpConfig
  ? 'smtp'
  : !isProduction && hasMailtrapConfig
  ? 'mailtrap'
  : !isProduction && hasGmailConfig
  ? 'gmail'
  : null;

const hasMailConfig = Boolean(activeProvider);

const defaultFromAddress = process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.GMAIL_USER || '';
const defaultFromName = process.env.BREVO_SENDER_NAME || 'PF Control';
const mailAppName = process.env.MAIL_APP_NAME || 'PF Control';
const mailAppUrl = process.env.NEXTAUTH_URL || 'https://pf-control.com';
const mailPanelUrl = `${mailAppUrl}/auth/login`;
const mailPrimaryColor = process.env.MAIL_PRIMARY_COLOR || '#06b6d4';
const mailAccentColor = process.env.MAIL_ACCENT_COLOR || '#10b981';
const mailSupportEmail = process.env.MAIL_SUPPORT_EMAIL || defaultFromAddress;
const mailSendTimeoutMs = Math.max(3000, Math.min(60000, Number(process.env.MAIL_SEND_TIMEOUT_MS) || 15000));
const mailSendRetries = Math.max(1, Math.min(5, Number(process.env.MAIL_SEND_RETRIES) || 2));

const transporter = activeProvider === 'smtp'
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    })
  : activeProvider === 'mailtrap'
  ? nodemailer.createTransport({
      host: process.env.MAILTRAP_HOST,
      port: Number(process.env.MAILTRAP_PORT) || 587,
      secure: Number(process.env.MAILTRAP_PORT) === 465,
      auth: {
        user: process.env.MAILTRAP_USER || '',
        pass: process.env.MAILTRAP_PASS || '',
      },
    })
  : activeProvider === 'gmail'
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || '',
        pass: process.env.GMAIL_PASSWORD || '',
      },
    })
  : null;

function ensureMailConfigured() {
  if (!hasMailConfig) {
    const scope = isProduction ? 'produccion' : 'desarrollo';
    throw new Error(`El envio de mails no esta configurado para ${scope}. En produccion se requiere BREVO_API_KEY + BREVO_SENDER_EMAIL o SMTP completo.`);
  }

  if (!defaultFromAddress) {
    throw new Error('Falta configurar el remitente de correo (BREVO_SENDER_EMAIL, MAIL_FROM, SMTP_FROM o GMAIL_USER).');
  }
}

async function sendMail(options: { to: string; subject: string; html: string }) {
  const normalizedTo = String(options.to || '').trim().toLowerCase();
  if (!isValidEmail(normalizedTo)) {
    throw new Error(`Email de destino invalido: ${options.to}`);
  }

  const subject = String(options.subject || '').trim();
  if (!subject) {
    throw new Error('El asunto del email no puede estar vacio.');
  }

  if (activeProvider === 'brevo') {
    await withRetries(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), mailSendTimeoutMs);
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.BREVO_API_KEY || '',
          },
          body: JSON.stringify({
            sender: {
              email: defaultFromAddress,
              name: defaultFromName,
            },
            to: [{ email: normalizedTo }],
            subject,
            htmlContent: options.html,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Brevo API error: ${response.status} ${text}`);
        }
      } finally {
        clearTimeout(timer);
      }
    }, mailSendRetries, 'sendMail(brevo)');

    return;
  }

  if (!transporter) {
    throw new Error('No hay proveedor SMTP disponible para enviar correo.');
  }

  await withRetries(
    () =>
      withTimeout(
        transporter.sendMail({
          from: defaultFromAddress,
          to: normalizedTo,
          subject,
          html: options.html,
        }),
        mailSendTimeoutMs,
        'sendMail(smtp)'
      ),
    mailSendRetries,
    'sendMail(smtp)'
  );
}

function parseRecipients(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function uniqueEmails(values: string[]) {
  return [...new Set(values.map((email) => email.toLowerCase()))];
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHref(url: string) {
  const value = String(url || '').trim();
  if (!value) return '#';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  return '#';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout en ${label} tras ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function withRetries<T>(fn: () => Promise<T>, retries: number, label: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    }
  }

  throw new Error(`${label} fallo tras ${retries} intento(s): ${String(lastError)}`);
}

function renderEmailLayout(options: {
  preheader?: string;
  title: string;
  intro?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}) {
  const preheader = escapeHtml(options.preheader || options.title);
  const title = escapeHtml(options.title);
  const intro = options.intro ? `<p style="margin:0 0 14px;color:#cbd5e1;font-size:14px;line-height:1.55;">${escapeHtml(options.intro)}</p>` : '';
  const ctaHref = options.ctaUrl ? safeHref(options.ctaUrl) : '#';
  const cta = options.ctaLabel && options.ctaUrl
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">
        <tr>
          <td align="center" bgcolor="${escapeHtml(mailPrimaryColor)}" style="border-radius:10px;">
            <a href="${escapeHtml(ctaHref)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 18px;border-radius:10px;color:#001018;text-decoration:none;font-weight:800;font-size:14px;font-family:Segoe UI,Arial,sans-serif;">
              ${escapeHtml(options.ctaLabel)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;">Si no ves el boton, abre este enlace: <a href="${escapeHtml(ctaHref)}" style="color:#7dd3fc;text-decoration:none;">${escapeHtml(ctaHref)}</a></p>
    `
    : '';
  const footerNote = escapeHtml(options.footerNote || 'Si necesitas ayuda, responde este correo.');

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <div style="margin:0;padding:24px 12px;background:#020617;font-family:Segoe UI,Arial,sans-serif;color:#e2e8f0;">
      <div style="max-width:680px;margin:0 auto;background:#0b1329;border:1px solid rgba(148,163,184,0.25);border-radius:16px;overflow:hidden;">
        <div style="padding:18px 20px;background:linear-gradient(135deg,${escapeHtml(mailPrimaryColor)}22,${escapeHtml(mailAccentColor)}22);border-bottom:1px solid rgba(148,163,184,0.22);">
          <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;color:#bae6fd;">${escapeHtml(mailAppName)}</p>
        </div>
        <div style="padding:20px;">
          <h2 style="margin:0 0 12px;font-size:23px;line-height:1.25;color:#f8fafc;">${title}</h2>
          ${intro}
          <div style="margin:0 0 16px;">${options.bodyHtml}</div>
          ${cta ? `<div style="margin:0 0 16px;">${cta}</div>` : ''}
          <div style="margin:18px 0 0;padding-top:12px;border-top:1px solid rgba(148,163,184,0.2);font-size:12px;color:#94a3b8;line-height:1.55;">
            <p style="margin:0 0 8px;">${footerNote}</p>
            <p style="margin:0;">${escapeHtml(mailAppName)} · <a href="${escapeHtml(safeHref(mailAppUrl))}" style="color:#7dd3fc;text-decoration:none;">${escapeHtml(mailAppUrl)}</a>${mailSupportEmail ? ` · ${escapeHtml(mailSupportEmail)}` : ''}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function getAdminNotificationRecipients() {
  const envRecipients = parseRecipients(
    process.env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_NOTIFICATION_EMAIL
  );

  if (envRecipients.length > 0) {
    return uniqueEmails(envRecipients);
  }

  let adminUserRecipients: string[] = [];
  try {
    const admins = await db.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    });
    adminUserRecipients = admins
      .map((item: { email?: string | null }) => String(item.email || "").trim().toLowerCase())
      .filter(Boolean);
  } catch {
    // Si falla el acceso a usuarios admin, seguimos con los mails configurados por env.
  }

  return uniqueEmails([...envRecipients, ...adminUserRecipients]);
}

export async function sendAdminAlumnoRegisteredEmail(alumnoData: Record<string, unknown>) {
  ensureMailConfigured();

  const recipients = await getAdminNotificationRecipients();
  if (recipients.length === 0) {
    return;
  }

  const nombre = escapeHtml(alumnoData.nombre || "Sin nombre");
  const creadoEn = new Date().toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const fields = [
    ["Nombre", alumnoData.nombre],
    ["Estado", alumnoData.estado],
    ["Fecha de nacimiento", alumnoData.fechaNacimiento],
    ["Altura", alumnoData.altura],
    ["Peso", alumnoData.peso],
    ["Club", alumnoData.club],
    ["Objetivo", alumnoData.objetivo],
    ["Observaciones", alumnoData.observaciones],
    ["Practica deporte", alumnoData.practicaDeporte],
  ] as const;

  const rows = fields
    .map(([label, value]) => {
      const cleanValue = value === undefined || value === null || value === "" ? "-" : String(value);
      return `<tr><td style=\"padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;\">${escapeHtml(label)}</td><td style=\"padding:6px 10px;border-bottom:1px solid #e2e8f0;\">${escapeHtml(cleanValue)}</td></tr>`;
    })
    .join("");

  const rawJson = escapeHtml(JSON.stringify(alumnoData, null, 2));

  const html = renderEmailLayout({
    preheader: `Nuevo alumno registrado: ${String(alumnoData.nombre || '')}`,
    title: 'Nuevo alumno registrado',
    intro: 'Se registro un alumno nuevo en PF Control.',
    bodyHtml: `
      <p style="margin:0 0 14px;color:#cbd5e1;"><b>Fecha:</b> ${escapeHtml(creadoEn)}</p>
      <table style="border-collapse:collapse;width:100%;max-width:700px;margin-bottom:14px;background:#020617;border:1px solid rgba(148,163,184,0.2);border-radius:10px;overflow:hidden;">${rows}</table>
      <p style="margin:0 0 8px;color:#cbd5e1;"><b>Payload completo:</b></p>
      <pre style="background:#020617;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto;border:1px solid rgba(148,163,184,0.2);">${rawJson}</pre>
    `,
    ctaLabel: 'Abrir panel',
    ctaUrl: mailPanelUrl,
  });

  await Promise.all(
    recipients.map((to) =>
      sendMail({
        to,
        subject: `Nuevo alumno registrado: ${nombre}`,
        html,
      })
    )
  );
}

export async function sendColaboradorCredentials(email: string, password: string, nombreCompleto: string) {
  ensureMailConfigured();

  if (password === 'BAJA') {
    await sendMail({
      to: email,
      subject: 'Aviso de baja - PF Control',
      html: renderEmailLayout({
        preheader: 'Aviso de baja de colaborador',
        title: `Hola ${nombreCompleto}`,
        intro: 'Te informamos que has sido dado de baja como colaborador en PF Control.',
        bodyHtml: `<p style="margin:0;color:#cbd5e1;font-size:14px;">Si tienes dudas, contacta al administrador.</p>`,
        ctaLabel: 'Abrir panel',
        ctaUrl: mailPanelUrl,
      }),
    });
    return;
  }

  await sendMail({
    to: email,
    subject: 'Tus credenciales de acceso - PF Control',
    html: renderEmailLayout({
      preheader: 'Credenciales de acceso de colaborador',
      title: `Bienvenido, ${nombreCompleto}`,
      intro: 'Te han dado de alta como colaborador en PF Control.',
      bodyHtml: `
        <p style="margin:0 0 8px;color:#cbd5e1;">Estas son tus credenciales de acceso:</p>
        <ul style="margin:0 0 12px;padding-left:18px;color:#e2e8f0;">
          <li><b>Email:</b> ${escapeHtml(email)}</li>
          <li><b>Contrasena:</b> ${escapeHtml(password)}</li>
        </ul>
        <p style="margin:0;color:#cbd5e1;font-size:14px;">Por seguridad, inicia sesion y cambia tu contrasena desde el panel de usuario.</p>
      `,
      ctaLabel: 'Ir al panel',
      ctaUrl: mailPanelUrl,
    }),
  });
}

export async function generateVerificationToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.verificationToken.create({
    data: {
      email,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function sendVerificationEmail(email: string, token: string) {
  ensureMailConfigured();
  const verifyUrl = `${mailAppUrl}/auth/verify?token=${token}`;

  await sendMail({
    to: email,
    subject: 'Verifica tu email - PF Control',
    html: renderEmailLayout({
      preheader: 'Verifica tu cuenta de PF Control',
      title: 'Verifica tu email',
      intro: 'Haz clic en el boton para validar tu cuenta y habilitar todas las funciones.',
      bodyHtml: `
        <p style="margin:0 0 10px;color:#cbd5e1;">Si no funciona el boton, copia este enlace en tu navegador:</p>
        <p style="margin:0 0 10px;word-break:break-all;"><a href="${escapeHtml(safeHref(verifyUrl))}" style="color:#7dd3fc;text-decoration:none;">${escapeHtml(verifyUrl)}</a></p>
        <p style="margin:0;color:#94a3b8;font-size:12px;">Este enlace expira en 24 horas.</p>
      `,
      ctaLabel: 'Verificar email',
      ctaUrl: verifyUrl,
    }),
  });
}

export async function verifyToken(token: string) {
  const verificationToken = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken) {
    return null;
  }

  if (verificationToken.expiresAt < new Date()) {
    await db.verificationToken.delete({
      where: { token },
    });
    return null;
  }

  return verificationToken;
}

export async function generatePasswordResetToken(email: string, userId?: string | null): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.passwordResetToken.deleteMany({
    where: { email },
  });

  await db.passwordResetToken.create({
    data: {
      email,
      token,
      expiresAt,
      userId: userId || null,
    },
  });

  return token;
}

export async function sendPasswordResetEmail(email: string, token: string) {
  ensureMailConfigured();
  const resetUrl = `${mailAppUrl}/auth/reset-password?token=${token}`;

  await sendMail({
    to: email,
    subject: 'Recuperar contraseña - PF Control',
    html: renderEmailLayout({
      preheader: 'Recuperacion de contrasena de PF Control',
      title: 'Recuperacion de contrasena',
      intro: 'Recibimos una solicitud para restablecer tu contrasena en PF Control.',
      bodyHtml: `
        <p style="margin:0 0 10px;color:#cbd5e1;">Si no solicitaste este cambio, ignora este correo.</p>
        <p style="margin:0 0 10px;color:#cbd5e1;">Tambien puedes copiar este enlace en tu navegador:</p>
        <p style="margin:0 0 10px;word-break:break-all;"><a href="${escapeHtml(safeHref(resetUrl))}" style="color:#7dd3fc;text-decoration:none;">${escapeHtml(resetUrl)}</a></p>
        <p style="margin:0;color:#94a3b8;font-size:12px;">Este enlace expira en 1 hora.</p>
      `,
      ctaLabel: 'Crear nueva contrasena',
      ctaUrl: resetUrl,
    }),
  });
}

export async function verifyPasswordResetToken(token: string) {
  const resetToken = await db.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken) {
    return null;
  }

  if (resetToken.expiresAt < new Date()) {
    await db.passwordResetToken.delete({
      where: { token },
    });
    return null;
  }

  return resetToken;
}

export async function sendLoginAccessLinkEmail(email: string, token: string) {
  ensureMailConfigured();

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email requerido para enviar acceso por enlace.');
  }

  const loginUrl = `${mailAppUrl}/auth/login?magic=${encodeURIComponent(token)}&email=${encodeURIComponent(normalizedEmail)}`;

  await sendMail({
    to: normalizedEmail,
    subject: 'Tu enlace de acceso - PF Control',
    html: renderEmailLayout({
      preheader: 'Accede a PF Control desde cualquier dispositivo',
      title: 'Enlace de acceso seguro',
      intro: 'Usa este enlace para iniciar sesion sin escribir contrasena en este dispositivo.',
      bodyHtml: `
        <p style="margin:0 0 10px;color:#cbd5e1;">Este enlace es de un solo uso y expira en 15 minutos.</p>
        <p style="margin:0 0 10px;color:#cbd5e1;">Si no lo solicitaste, ignora este correo.</p>
        <p style="margin:0 0 10px;word-break:break-all;"><a href="${escapeHtml(safeHref(loginUrl))}" style="color:#7dd3fc;text-decoration:none;">${escapeHtml(loginUrl)}</a></p>
      `,
      ctaLabel: 'Iniciar sesion con enlace',
      ctaUrl: loginUrl,
    }),
  });
}

export async function sendWhatsAppAutomationFailureEmail(input: {
  runId: string;
  categoryKey?: string;
  ruleKey?: string;
  failed: number;
  sent: number;
  reason?: string | null;
  attemptedAt?: string;
  retryCount?: number;
}) {
  ensureMailConfigured();

  const recipients = await getAdminNotificationRecipients();
  if (recipients.length === 0) {
    return { delivered: false, recipients: 0 };
  }

  const attemptedAt = input.attemptedAt
    ? new Date(input.attemptedAt).toLocaleString("es-AR")
    : new Date().toLocaleString("es-AR");

  const category = String(input.categoryKey || "all");
  const rule = String(input.ruleKey || "all");
  const reason = String(input.reason || "fallo_de_envio");

  const html = renderEmailLayout({
    preheader: `Fallo del runner de WhatsApp (${input.runId})`,
    title: "Alerta: fallo en corrida automatica de WhatsApp",
    intro: "Se detecto una corrida con fallos y requiere revision operativa.",
    bodyHtml: `
      <table style="border-collapse:collapse;width:100%;max-width:700px;margin-bottom:14px;background:#020617;border:1px solid rgba(148,163,184,0.2);border-radius:10px;overflow:hidden;">
        <tr><td style="padding:7px 10px;border-bottom:1px solid #1e293b;font-weight:700;">Run ID</td><td style="padding:7px 10px;border-bottom:1px solid #1e293b;">${escapeHtml(input.runId)}</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid #1e293b;font-weight:700;">Fecha</td><td style="padding:7px 10px;border-bottom:1px solid #1e293b;">${escapeHtml(attemptedAt)}</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid #1e293b;font-weight:700;">Categoria</td><td style="padding:7px 10px;border-bottom:1px solid #1e293b;">${escapeHtml(category)}</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid #1e293b;font-weight:700;">Regla</td><td style="padding:7px 10px;border-bottom:1px solid #1e293b;">${escapeHtml(rule)}</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid #1e293b;font-weight:700;">Enviados OK</td><td style="padding:7px 10px;border-bottom:1px solid #1e293b;">${escapeHtml(input.sent)}</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid #1e293b;font-weight:700;">Fallidos</td><td style="padding:7px 10px;border-bottom:1px solid #1e293b;">${escapeHtml(input.failed)}</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid #1e293b;font-weight:700;">Reintentos</td><td style="padding:7px 10px;border-bottom:1px solid #1e293b;">${escapeHtml(input.retryCount ?? 0)}</td></tr>
        <tr><td style="padding:7px 10px;font-weight:700;">Motivo</td><td style="padding:7px 10px;">${escapeHtml(reason)}</td></tr>
      </table>
      <p style="margin:0;color:#cbd5e1;">Revisa el panel de WhatsApp para detalle por destinatario y ejecutar correcciones.</p>
    `,
    ctaLabel: "Abrir panel de WhatsApp",
    ctaUrl: `${mailAppUrl}/admin/whatsapp`,
  });

  await Promise.all(
    recipients.map((to) =>
      sendMail({
        to,
        subject: `PF Control - Alerta runner WhatsApp (${input.runId})`,
        html,
      })
    )
  );

  return { delivered: true, recipients: recipients.length };
}
