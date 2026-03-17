export async function sendColaboradorCredentials(email: string, password: string, nombreCompleto: string) {
  ensureMailConfigured();
  if (password === 'BAJA') {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Aviso de baja - PF Control',
      html: `
        <h2>Hola ${nombreCompleto}</h2>
        <p>Te informamos que has sido dado de baja como colaborador en PF Control.</p>
        <p>Si tienes dudas, contacta al administrador.</p>
      `,
    });
  } else {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
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
}
import { prisma } from './prisma';
import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

const db = prisma as any;

const hasMailConfig = Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASSWORD);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_PASSWORD || '',
  },
});

function ensureMailConfigured() {
  if (!hasMailConfig) {
    throw new Error('El envío de mails no está configurado en el servidor. Faltan GMAIL_USER y GMAIL_PASSWORD.');
  }
}

export async function generateVerificationToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
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

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
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
