import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

const db = prisma as any;

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      emailVerified: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ message: 'Tu email ya está verificado' }, { status: 400 });
  }

  const token = await generateVerificationToken(user.email);
  await sendVerificationEmail(user.email, token);

  return NextResponse.json({ message: 'Te enviamos un nuevo mail de verificación' });
}