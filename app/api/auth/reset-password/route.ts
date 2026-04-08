import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyPasswordResetToken } from '@/lib/email';

const db = prisma as any;

function normalizeEmailInput(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function normalizePasswordForStorage(raw: unknown): string {
  return typeof raw === 'string' ? raw.normalize('NFKC').trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    const { token, password } = payload || {};
    const normalizedPassword = normalizePasswordForStorage(password);

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ message: 'Token requerido' }, { status: 400 });
    }

    if (!normalizedPassword || normalizedPassword.length < 6) {
      return NextResponse.json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const resetToken = await verifyPasswordResetToken(token);

    if (!resetToken) {
      return NextResponse.json({ message: 'El enlace es inválido o expiró' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    const tokenUserId = typeof resetToken.userId === 'string' ? resetToken.userId.trim() : '';
    const tokenEmail = normalizeEmailInput(resetToken.email);

    if (!tokenUserId && !tokenEmail) {
      return NextResponse.json({ message: 'Token inválido' }, { status: 400 });
    }

    const updatedUser = await db.user.update({
      where: tokenUserId ? { id: tokenUserId } : { email: tokenEmail },
      data: { password: hashedPassword },
      select: { email: true },
    });

    await db.verificationToken
      .deleteMany({
        where: {
          email: normalizeEmailInput(updatedUser.email),
          token: { startsWith: 'login-link-' },
        },
      })
      .catch(() => null);

    await db.passwordResetToken.delete({
      where: { token },
    });

    return NextResponse.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ message: 'No se pudo restablecer la contraseña' }, { status: 500 });
  }
}