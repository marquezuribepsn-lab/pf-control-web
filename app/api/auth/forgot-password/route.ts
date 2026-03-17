import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePasswordResetToken, sendPasswordResetEmail } from '@/lib/email';

const db = prisma as any;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
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
    const message = error instanceof Error ? error.message : 'No se pudo procesar la solicitud';
    return NextResponse.json({ message }, { status: 500 });
  }
}