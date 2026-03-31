import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePasswordResetToken, sendPasswordResetEmail } from '@/lib/email';

const db = prisma as any;

export async function POST(req: NextRequest) {
  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ message: 'Body JSON invalido' }, { status: 400 });
    }

    const { email } = payload || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail) {
      return NextResponse.json({ message: 'Debes ingresar un email' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'Si el email existe, te enviaremos un enlace de recuperación.' });
    }

    const token = await generatePasswordResetToken(user.email, user.id);
    await sendPasswordResetEmail(user.email, token);

    return NextResponse.json({ message: 'Si el email existe, te enviaremos un enlace de recuperación.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'No pudimos enviar el correo de recuperacion. Intenta nuevamente en unos minutos.' },
      { status: 500 }
    );
  }
}