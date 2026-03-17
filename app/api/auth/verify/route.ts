import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/email';

const db = prisma as any;

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { message: 'Token requerido' },
        { status: 400 }
      );
    }

    // Verify token
    const verificationToken = await verifyToken(token);

    if (!verificationToken) {
      return NextResponse.json(
        { message: 'Token inválido o expirado' },
        { status: 400 }
      );
    }

    // Update user as verified
    await db.user.update({
      where: { email: verificationToken.email },
      data: { emailVerified: true },
    });

    // Delete verification token
    await db.verificationToken.delete({
      where: { token },
    });

    return NextResponse.json(
      { message: 'Email verificado correctamente' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { message: 'Error al verificar email' },
      { status: 500 }
    );
  }
}
