import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

const db = prisma as any;

function normalizeEmailInput(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function normalizePasswordInput(raw: unknown): string {
  return typeof raw === 'string' ? raw.normalize('NFKC') : '';
}

function normalizePasswordForStorage(raw: unknown): string {
  return normalizePasswordInput(raw).trim();
}

async function compareCurrentPassword(input: string, passwordHash: string): Promise<boolean> {
  if (!input) {
    return false;
  }

  if (await bcrypt.compare(input, passwordHash)) {
    return true;
  }

  const trimmed = input.trim();
  if (trimmed && trimmed !== input) {
    return bcrypt.compare(trimmed, passwordHash);
  }

  return false;
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      puedeEditarRegistros: true,
      puedeEditarPlanes: true,
      puedeVerTodosAlumnos: true,
      permisosGranulares: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const { email, currentPassword, newPassword } = payload || {};
  const currentPasswordInput = normalizePasswordInput(currentPassword);

  if (!currentPasswordInput.trim()) {
    return NextResponse.json({ message: 'Debes ingresar tu contraseña actual' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  const passwordMatch = await compareCurrentPassword(currentPasswordInput, user.password);
  if (!passwordMatch) {
    return NextResponse.json({ message: 'La contraseña actual no es correcta' }, { status: 400 });
  }

  const currentEmailNormalized = normalizeEmailInput(user.email);
  const requestedEmail = normalizeEmailInput(email);
  const normalizedEmail = requestedEmail || currentEmailNormalized;
  const nextPassword = normalizePasswordForStorage(newPassword);
  const emailChanged = normalizedEmail !== currentEmailNormalized;
  const passwordChanged = nextPassword.length > 0;

  if (!emailChanged && !passwordChanged) {
    return NextResponse.json({ message: 'No hay cambios para guardar' }, { status: 400 });
  }

  if (emailChanged) {
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser && existingUser.id !== user.id) {
      return NextResponse.json({ message: 'Ese email ya está en uso' }, { status: 400 });
    }
  }

  if (passwordChanged && nextPassword.length < 6) {
    return NextResponse.json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (emailChanged) {
    data.email = normalizedEmail;
    data.emailVerified = false;
  }

  if (passwordChanged) {
    data.password = await bcrypt.hash(nextPassword, 10);
  }

  const updatedUser = await db.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      email: true,
      role: true,
      puedeEditarRegistros: true,
      puedeEditarPlanes: true,
      puedeVerTodosAlumnos: true,
      permisosGranulares: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  let message = 'Cuenta actualizada correctamente';

  if (passwordChanged || emailChanged) {
    await db.verificationToken
      .deleteMany({
        where: {
          email: currentEmailNormalized,
          token: { startsWith: 'login-link-' },
        },
      })
      .catch(() => null);

    if (emailChanged) {
      await db.verificationToken
        .deleteMany({
          where: {
            email: normalizedEmail,
            token: { startsWith: 'login-link-' },
          },
        })
        .catch(() => null);
    }
  }

  if (emailChanged) {
    const token = await generateVerificationToken(updatedUser.email);
    await sendVerificationEmail(updatedUser.email, token);
    message = 'Cuenta actualizada. Te enviamos un mail para verificar el nuevo email';
  }

  return NextResponse.json({ message, user: updatedUser });
}