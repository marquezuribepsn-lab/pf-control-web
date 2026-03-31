import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyPasswordResetToken } from '@/lib/email';

const db = prisma as any;

function normalizePasswordInput(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    const normalizedPassword = normalizePasswordInput(password);

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ message: 'Token requerido' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || normalizedPassword.length < 6) {
      return NextResponse.json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const resetToken = await verifyPasswordResetToken(token);

    if (!resetToken) {
      return NextResponse.json({ message: 'El enlace es inválido o expiró' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    const updatedUser = await db.user.update({
      where: { email: resetToken.email },
      select: { id: true },
      data: { password: hashedPassword },
    });

    await db.syncEntry.deleteMany({ where: { key: `user-password-admin:${updatedUser.id}` } });

    await db.passwordResetToken.delete({
      where: { token },
    });

    return NextResponse.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ message: 'No se pudo restablecer la contraseña' }, { status: 500 });
  }
}