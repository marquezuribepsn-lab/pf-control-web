import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

const db = prisma as any;

export async function POST(req: NextRequest) {
  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ message: 'Body JSON invalido' }, { status: 400 });
    }

    const { email, password } = payload || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !password || password.length < 6) {
      return NextResponse.json(
        { message: 'Email y contraseña (mínimo 6 caracteres) requeridos' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'El email ya está registrado' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: 'CLIENTE',
      },
    });

    // Generate verification token
    const token = await generateVerificationToken(user.email);

    // Send verification email
    await sendVerificationEmail(user.email, token);

    return NextResponse.json(
      { message: 'Usuario creado. Revisa tu email para verificar.' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { message: 'Error al registrarse' },
      { status: 500 }
    );
  }
}
