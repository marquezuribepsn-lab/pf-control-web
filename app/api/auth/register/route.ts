import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';
import { getSyncValue, setSyncValue } from '@/lib/syncStore';

const db = prisma as any;
const SIGNUP_PROFILES_KEY = 'pf-control-signup-profiles-v1';

type SignupProfile = {
  nombreCompleto: string;
  edad: number | null;
  altura: string;
  peso: string;
  telefono: string;
  fechaNacimiento: string;
  club: string;
  objetivo: string;
  observaciones: string;
  practicaDeporte: boolean;
  deporte: string;
  categoria: string;
  posicion: string;
  updatedAt: string;
};

function normalizeDateOnly(raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toFiniteNumber(raw: unknown): number | null {
  const value = String(raw ?? '').trim().replace(',', '.');
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function computeAgeFromBirthdate(dateOnly: string): number | null {
  if (!dateOnly) return null;
  const birthDate = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    now.getMonth() < birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate());
  if (beforeBirthday) {
    age -= 1;
  }

  if (!Number.isFinite(age) || age < 0 || age > 120) {
    return null;
  }

  return age;
}

async function saveSignupProfile(email: string, profile: SignupProfile) {
  const raw = await getSyncValue(SIGNUP_PROFILES_KEY);
  const current = raw && typeof raw === 'object' ? ({ ...(raw as Record<string, SignupProfile>) }) : {};
  current[email] = profile;
  await setSyncValue(SIGNUP_PROFILES_KEY, current);
}

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
    const normalizedPassword = typeof password === 'string' ? password.normalize('NFKC').trim() : '';
    const normalizedBirthDate = normalizeDateOnly(payload?.fechaNacimiento);
    const normalizedPhone = String(payload?.telefono || '').trim();

    const nombreCompleto = String(
      payload?.nombreCompleto || `${String(payload?.nombre || '').trim()} ${String(payload?.apellido || '').trim()}`
    )
      .trim()
      .replace(/\s+/g, ' ');

    const edadInput = toFiniteNumber(payload?.edad);
    const edadFromBirthDate = computeAgeFromBirthdate(normalizedBirthDate);
    const edad = edadInput !== null ? Math.max(0, Math.min(120, Math.round(edadInput))) : edadFromBirthDate;
    const alturaNumber = toFiniteNumber(payload?.altura);

    const profile: SignupProfile = {
      nombreCompleto,
      edad,
      altura: String(payload?.altura ?? '').trim(),
      peso: String(payload?.peso ?? '').trim(),
      telefono: normalizedPhone,
      fechaNacimiento: normalizedBirthDate,
      club: String(payload?.club ?? '').trim(),
      objetivo: String(payload?.objetivo ?? '').trim(),
      observaciones: String(payload?.observaciones ?? '').trim(),
      practicaDeporte:
        payload?.practicaDeporte === true ||
        String(payload?.practicaDeporte || '').trim().toLowerCase() === 'si',
      deporte: String(payload?.deporte ?? '').trim(),
      categoria: String(payload?.categoria ?? '').trim(),
      posicion: String(payload?.posicion ?? '').trim(),
      updatedAt: new Date().toISOString(),
    };

    if (!normalizedEmail || !normalizedPassword || normalizedPassword.length < 6) {
      return NextResponse.json(
        { message: 'Email y contraseña (mínimo 6 caracteres) requeridos' },
        { status: 400 }
      );
    }

    if (!nombreCompleto || !normalizedBirthDate || !normalizedPhone) {
      return NextResponse.json(
        {
          message:
            'Completa nombre completo, fecha de nacimiento y numero de telefono para registrar la cuenta.',
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (existingUser.emailVerified) {
        return NextResponse.json(
          { message: 'El email ya está registrado' },
          { status: 400 }
        );
      }

      const refreshedPassword = await bcrypt.hash(normalizedPassword, 10);
      await db.user.update({
        where: { id: existingUser.id },
        data: {
          password: refreshedPassword,
          role: 'CLIENTE',
          estado: 'pendiente_alta',
          nombreCompleto,
          edad: edad ?? 0,
          fechaNacimiento: new Date(`${normalizedBirthDate}T00:00:00`),
          altura: alturaNumber ?? 0,
          telefono: normalizedPhone,
        },
      });

      await saveSignupProfile(normalizedEmail, profile).catch(() => {
        // Keep auth flow resilient if sync store write fails.
      });

      const token = await generateVerificationToken(existingUser.email);
      await sendVerificationEmail(existingUser.email, token);

      return NextResponse.json(
        { message: 'Cuenta existente sin verificar. Te reenviamos el email de verificación.' },
        { status: 200 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    // Create user
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: 'CLIENTE',
        estado: 'pendiente_alta',
        nombreCompleto,
        edad: edad ?? 0,
        fechaNacimiento: new Date(`${normalizedBirthDate}T00:00:00`),
        altura: alturaNumber ?? 0,
        telefono: normalizedPhone,
      },
    });

    await saveSignupProfile(normalizedEmail, profile).catch(() => {
      // Keep auth flow resilient if sync store write fails.
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
