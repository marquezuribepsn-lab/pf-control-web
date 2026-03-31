import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

const db = prisma as any;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ message: 'Email requerido' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true },
    });

    // Respuesta neutra para no exponer existencia de cuentas.
    if (!user) {
      return NextResponse.json({ message: 'Si el email existe, enviaremos un nuevo enlace.' });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: 'Tu email ya esta verificado.' });
    }

    await db.verificationToken.deleteMany({
      where: { email: user.email },
    });

    const token = await generateVerificationToken(user.email);
    await sendVerificationEmail(user.email, token);

    return NextResponse.json({ message: 'Te enviamos un nuevo email de verificacion.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json({ message: 'No pudimos reenviar el email por ahora.' }, { status: 500 });
  }
}
