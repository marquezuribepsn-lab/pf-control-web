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
  if (activeProvider === 'brevo') {
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
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Brevo API error: ${response.status} ${text}`);
    }

    return;
  }

  if (!transporter) {
    throw new Error('No hay proveedor SMTP disponible para enviar correo.');
  }

  await transporter.sendMail({
    from: defaultFromAddress,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

export async function sendColaboradorCredentials(email: string, password: string, nombreCompleto: string) {
  ensureMailConfigured();

  if (password === 'BAJA') {
    await sendMail({
      to: email,
      subject: 'Aviso de baja - PF Control',
      html: `
        <h2>Hola ${nombreCompleto}</h2>
        <p>Te informamos que has sido dado de baja como colaborador en PF Control.</p>
        <p>Si tienes dudas, contacta al administrador.</p>
      `,
    });
    return;
  }

  await sendMail({
    to: email,
    subject: 'Tus credenciales de acceso - PF Control',
    html: `
      <h2>¡Bienvenido, ${nombreCompleto}!</h2>
      <p>Te han dado de alta como colaborador en PF Control.</p>
      <p>Estas son tus credenciales de acceso:</p>
      <ul>
        <li><b>Email:</b> ${email}</li>
        <li><b>Contraseña:</b> ${password}</li>
      </ul>
      <p>Por favor, inicia sesión y cambia tu contraseña desde el panel de usuario.</p>
      <p>Accede aquí: <a href="${process.env.NEXTAUTH_URL}/auth/login">Panel de acceso</a></p>
      <p>Si tienes dudas, contacta al administrador.</p>
    `,
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
  const verifyUrl = `${process.env.NEXTAUTH_URL}/auth/verify?token=${token}`;

  await sendMail({
    to: email,
    subject: 'Verifica tu email - PF Control',
    html: `
      <h2>Bienvenido a PF Control</h2>
      <p>Haz click en el enlace a continuación para verificar tu email:</p>
      <a href="${verifyUrl}" style="
        display: inline-block;
        padding: 10px 20px;
        background-color: #2563eb;
        color: white;
        text-decoration: none;
        border-radius: 5px;
      ">
        Verificar email
      </a>
      <p>O copia y pega este enlace en tu navegador:</p>
      <p>${verifyUrl}</p>
      <p>Este enlace expira en 24 horas.</p>
    `,
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
  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

  await sendMail({
    to: email,
    subject: 'Recuperar contraseña - PF Control',
    html: `
      <h2>Recuperación de contraseña</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña en PF Control.</p>
      <a href="${resetUrl}" style="
        display: inline-block;
        padding: 10px 20px;
        background-color: #0ea5e9;
        color: white;
        text-decoration: none;
        border-radius: 5px;
      ">
        Crear nueva contraseña
      </a>
      <p>O copia y pega este enlace en tu navegador:</p>
      <p>${resetUrl}</p>
      <p>Este enlace expira en 1 hora.</p>
    `,
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
