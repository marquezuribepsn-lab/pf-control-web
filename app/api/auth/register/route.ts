import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';
import { getSyncValue, setSyncValue } from '@/lib/syncStore';

const db = prisma as any;
const SIGNUP_PROFILES_KEY = 'pf-control-signup-profiles-v1';

const ALIMENTACION_OPTIONS = [
  'equilibrada',
  'desordenada',
  'alta en ultraprocesados',
  'vegetariana / vegana',
  'otro',
] as const;

const INTERES_ENTRENAMIENTO_OPTIONS = [
  'fuerza y musculacion',
  'funcional',
  'mixto / personalizado',
] as const;

const ORIGEN_CONTACTO_OPTIONS = ['instagram', 'recomendado', 'otro'] as const;

type SignupAnamnesis = {
  tratamientoMedico: string;
  lesionesLimitaciones: string;
  medicacionRegular: string;
  cirugiasRecientes: string;
  antecedentesClinicos: string;
  autorizacionMedica: string;
  experienciaEntrenamiento: string;
  alimentacionActual: string[];
  alimentacionDetalle: string;
  desordenAlimentario: string;
  consumoSustancias: string;
  suplementos: string;
  interesEntrenamiento: string[];
  interesDetalle: string;
  compromisoObjetivo: number | null;
  origenContacto: string[];
  origenDetalle: string;
  consentimientoSalud: 'si' | 'no' | '';
};

type SignupProfile = {
  nombre: string;
  apellido: string;
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
  anamnesis: SignupAnamnesis;
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

function normalizeText(raw: unknown, max = 700): string {
  return String(raw ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function normalizeStringArray(raw: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const allowedSet = new Set(allowed.map((item) => item.toLowerCase()));
  const result: string[] = [];

  for (const entry of raw) {
    const normalized = normalizeText(entry, 80).toLowerCase();
    if (!normalized || !allowedSet.has(normalized)) {
      continue;
    }
    if (!result.includes(normalized)) {
      result.push(normalized);
    }
  }

  return result;
}

function normalizeCommitment(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}

function normalizeAnamnesis(input: any): SignupAnamnesis {
  const source = input?.anamnesis && typeof input.anamnesis === 'object' ? input.anamnesis : input;
  const consentimientoRaw = normalizeText(source?.consentimientoSalud, 10).toLowerCase();

  return {
    tratamientoMedico: normalizeText(source?.tratamientoMedico),
    lesionesLimitaciones: normalizeText(source?.lesionesLimitaciones),
    medicacionRegular: normalizeText(source?.medicacionRegular),
    cirugiasRecientes: normalizeText(source?.cirugiasRecientes),
    antecedentesClinicos: normalizeText(source?.antecedentesClinicos),
    autorizacionMedica: normalizeText(source?.autorizacionMedica),
    experienciaEntrenamiento: normalizeText(source?.experienciaEntrenamiento),
    alimentacionActual: normalizeStringArray(source?.alimentacionActual, ALIMENTACION_OPTIONS),
    alimentacionDetalle: normalizeText(source?.alimentacionDetalle),
    desordenAlimentario: normalizeText(source?.desordenAlimentario),
    consumoSustancias: normalizeText(source?.consumoSustancias),
    suplementos: normalizeText(source?.suplementos),
    interesEntrenamiento: normalizeStringArray(source?.interesEntrenamiento, INTERES_ENTRENAMIENTO_OPTIONS),
    interesDetalle: normalizeText(source?.interesDetalle),
    compromisoObjetivo: normalizeCommitment(source?.compromisoObjetivo),
    origenContacto: normalizeStringArray(source?.origenContacto, ORIGEN_CONTACTO_OPTIONS),
    origenDetalle: normalizeText(source?.origenDetalle),
    consentimientoSalud:
      consentimientoRaw === 'si' || consentimientoRaw === 'no'
        ? (consentimientoRaw as 'si' | 'no')
        : '',
  };
}

function validateAnamnesis(anamnesis: SignupAnamnesis): string | null {
  if (
    !anamnesis.tratamientoMedico ||
    !anamnesis.lesionesLimitaciones ||
    !anamnesis.medicacionRegular ||
    !anamnesis.cirugiasRecientes ||
    !anamnesis.antecedentesClinicos ||
    !anamnesis.autorizacionMedica ||
    !anamnesis.experienciaEntrenamiento ||
    !anamnesis.desordenAlimentario ||
    !anamnesis.consumoSustancias ||
    !anamnesis.suplementos
  ) {
    return 'Completa todas las respuestas de anamnesis obligatorias.';
  }

  if (anamnesis.alimentacionActual.length === 0) {
    return 'Selecciona al menos una opcion en alimentacion actual.';
  }

  if (anamnesis.interesEntrenamiento.length === 0) {
    return 'Selecciona al menos un tipo de entrenamiento de interes.';
  }

  if (anamnesis.origenContacto.length === 0) {
    return 'Selecciona como llegaste al servicio.';
  }

  if (anamnesis.compromisoObjetivo === null) {
    return 'Indica tu nivel de compromiso del 1 al 10.';
  }

  if (anamnesis.consentimientoSalud !== 'si') {
    return 'Debes aceptar la declaracion de aptitud y responsabilidad para continuar.';
  }

  return null;
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
    const normalizedPhone = normalizeText(payload?.telefono, 60);

    const nombre = normalizeText(payload?.nombre, 80);
    const apellido = normalizeText(payload?.apellido, 80);

    const nombreCompleto = normalizeText(
      payload?.nombreCompleto || `${nombre} ${apellido}`,
      140
    );

    const anamnesis = normalizeAnamnesis(payload);
    const anamnesisError = validateAnamnesis(anamnesis);

    const edadInput = toFiniteNumber(payload?.edad);
    const edadFromBirthDate = computeAgeFromBirthdate(normalizedBirthDate);
    const edad = edadInput !== null ? Math.max(0, Math.min(120, Math.round(edadInput))) : edadFromBirthDate;
    const alturaNumber = toFiniteNumber(payload?.altura);

    const profile: SignupProfile = {
      nombre,
      apellido,
      nombreCompleto,
      edad,
      altura: normalizeText(payload?.altura, 40),
      peso: normalizeText(payload?.peso, 40),
      telefono: normalizedPhone,
      fechaNacimiento: normalizedBirthDate,
      club: normalizeText(payload?.club, 140),
      objetivo: normalizeText(payload?.objetivo, 240),
      observaciones: normalizeText(payload?.observaciones, 500),
      practicaDeporte:
        payload?.practicaDeporte === true ||
        String(payload?.practicaDeporte || '').trim().toLowerCase() === 'si',
      deporte: normalizeText(payload?.deporte, 100),
      categoria: normalizeText(payload?.categoria, 100),
      posicion: normalizeText(payload?.posicion, 100),
      anamnesis,
      updatedAt: new Date().toISOString(),
    };

    if (!normalizedEmail || !normalizedPassword || normalizedPassword.length < 6) {
      return NextResponse.json(
        { message: 'Email y contraseña (mínimo 6 caracteres) requeridos' },
        { status: 400 }
      );
    }

    if (!nombre || !apellido || !normalizedBirthDate || !normalizedPhone) {
      return NextResponse.json(
        {
          message:
            'Completa nombre, apellido, fecha de nacimiento y numero de telefono para registrar la cuenta.',
        },
        { status: 400 }
      );
    }

    if (anamnesisError) {
      return NextResponse.json({ message: anamnesisError }, { status: 400 });
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
      { message: 'Registro finalizado. No se olvide de verificar su mail.' },
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
