import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

const db = prisma as any;
const MAX_SIDEBAR_IMAGE_LENGTH = 850_000;
const SIDEBAR_IMAGE_SYNC_KEY_PREFIX = 'pf-control-user-sidebar-image:';

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  role: true,
  nombreCompleto: true,
  edad: true,
  fechaNacimiento: true,
  altura: true,
  telefono: true,
  direccion: true,
  puedeEditarRegistros: true,
  puedeEditarPlanes: true,
  puedeVerTodosAlumnos: true,
  permisosGranulares: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
};

function normalizeEmailInput(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function normalizePasswordInput(raw: unknown): string {
  return typeof raw === 'string' ? raw.normalize('NFKC') : '';
}

function normalizePasswordForStorage(raw: unknown): string {
  return normalizePasswordInput(raw).trim();
}

function normalizeNameInput(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '';
  }

  return raw.trim().replace(/\s+/g, ' ');
}

function normalizeOptionalTextInput(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

function parseBoundedInteger(raw: unknown, min: number, max: number): number | null {
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function parseBoundedFloat(raw: unknown, min: number, max: number): number | null {
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < min || parsed > max) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

function parseDateInput(raw: unknown): Date | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim();
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function sameDayUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function normalizeSidebarImageInput(raw: unknown): string | null | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (raw === null) {
    return null;
  }

  if (typeof raw !== 'string') {
    return undefined;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

function getSidebarImageSyncKey(userId: string): string {
  return `${SIDEBAR_IMAGE_SYNC_KEY_PREFIX}${userId}`;
}

async function readSidebarImageFromSyncEntry(userId: string): Promise<string | null> {
  try {
    const entry = await db.syncEntry.findUnique({
      where: { key: getSidebarImageSyncKey(userId) },
      select: { value: true },
    });

    const value = entry?.value;
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }

    return null;
  } catch {
    return null;
  }
}

async function writeSidebarImageToSyncEntry(userId: string, sidebarImage: string | null): Promise<boolean> {
  try {
    await db.syncEntry.upsert({
      where: { key: getSidebarImageSyncKey(userId) },
      update: { value: sidebarImage },
      create: {
        key: getSidebarImageSyncKey(userId),
        value: sidebarImage,
      },
    });

    return true;
  } catch {
    return false;
  }
}

async function getSidebarImageForUser(userId: string): Promise<string | null> {
  const fallbackValue = await readSidebarImageFromSyncEntry(userId);

  try {
    const rows = (await db.$queryRaw(
      Prisma.sql`SELECT sidebarImage FROM users WHERE id = ${userId} LIMIT 1`
    )) as Array<{ sidebarImage: string | null }>;

    const value = rows?.[0]?.sidebarImage;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    return fallbackValue;
  } catch {
    return fallbackValue;
  }
}

async function writeSidebarImageForUser(userId: string, sidebarImage: string | null) {
  let persistedInUsersTable = false;

  try {
    await db.$executeRaw(
      Prisma.sql`UPDATE users SET sidebarImage = ${sidebarImage}, updatedAt = CURRENT_TIMESTAMP WHERE id = ${userId}`
    );
    persistedInUsersTable = true;
  } catch {
    // fallback handled below via sync entry
  }

  const persistedInSyncEntry = await writeSidebarImageToSyncEntry(userId, sidebarImage);

  if (!persistedInUsersTable && !persistedInSyncEntry) {
    throw new Error('No se pudo persistir la foto de perfil');
  }
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
    select: ACCOUNT_SELECT,
  });

  if (!user) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  const sidebarImage = await getSidebarImageForUser(session.user.id);

  return NextResponse.json({
    ...user,
    sidebarImage,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const {
    email,
    currentPassword,
    newPassword,
    sidebarImage,
    nombreCompleto,
    edad,
    fechaNacimiento,
    altura,
    telefono,
    direccion,
  } = payload || {};
  const requestedSidebarImage = normalizeSidebarImageInput(sidebarImage);
  const currentPasswordInput = normalizePasswordInput(currentPassword);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  const currentEmailNormalized = normalizeEmailInput(user.email);
  const requestedEmail = normalizeEmailInput(email);
  const normalizedEmail = requestedEmail || currentEmailNormalized;
  const nextPassword = normalizePasswordForStorage(newPassword);
  const emailChanged = normalizedEmail !== currentEmailNormalized;
  const passwordChanged = nextPassword.length > 0;

  const personalPayloadProvided =
    nombreCompleto !== undefined ||
    edad !== undefined ||
    fechaNacimiento !== undefined ||
    altura !== undefined ||
    telefono !== undefined ||
    direccion !== undefined;

  let normalizedNombreCompleto = String(user.nombreCompleto || '').trim();
  if (nombreCompleto !== undefined) {
    normalizedNombreCompleto = normalizeNameInput(nombreCompleto);
    if (!normalizedNombreCompleto) {
      return NextResponse.json({ message: 'El nombre completo es obligatorio' }, { status: 400 });
    }
  }

  let normalizedEdad = Number(user.edad || 0);
  if (edad !== undefined) {
    const parsedEdad = parseBoundedInteger(edad, 0, 120);
    if (parsedEdad === null) {
      return NextResponse.json({ message: 'La edad debe ser un numero entero entre 0 y 120' }, { status: 400 });
    }
    normalizedEdad = parsedEdad;
  }

  const currentBirthDate = user.fechaNacimiento instanceof Date ? user.fechaNacimiento : new Date(user.fechaNacimiento);
  let normalizedFechaNacimiento = currentBirthDate;
  if (fechaNacimiento !== undefined) {
    const parsedFechaNacimiento = parseDateInput(fechaNacimiento);
    if (!parsedFechaNacimiento) {
      return NextResponse.json({ message: 'La fecha de nacimiento no es valida' }, { status: 400 });
    }
    normalizedFechaNacimiento = parsedFechaNacimiento;
  }

  let normalizedAltura = Number(user.altura || 0);
  if (altura !== undefined) {
    const parsedAltura = parseBoundedFloat(altura, 0, 250);
    if (parsedAltura === null) {
      return NextResponse.json({ message: 'La altura debe estar entre 0 y 250 cm' }, { status: 400 });
    }
    normalizedAltura = parsedAltura;
  }

  const normalizedTelefono =
    telefono !== undefined ? normalizeOptionalTextInput(telefono) : user.telefono;
  const normalizedDireccion =
    direccion !== undefined ? normalizeOptionalTextInput(direccion) : user.direccion;

  const personalDataChanged =
    personalPayloadProvided &&
    (
      normalizedNombreCompleto !== String(user.nombreCompleto || '').trim() ||
      normalizedEdad !== Number(user.edad || 0) ||
      !sameDayUTC(normalizedFechaNacimiento, currentBirthDate) ||
      Math.abs(normalizedAltura - Number(user.altura || 0)) > 0.0001 ||
      normalizedTelefono !== user.telefono ||
      normalizedDireccion !== user.direccion
    );

  const currentSidebarImage = await getSidebarImageForUser(user.id);
  const sidebarImageChanged = requestedSidebarImage !== undefined && requestedSidebarImage !== currentSidebarImage;
  const hasCredentialChanges = emailChanged || passwordChanged;

  if (!hasCredentialChanges && !sidebarImageChanged && !personalDataChanged) {
    return NextResponse.json({ message: 'No hay cambios para guardar' }, { status: 400 });
  }

  if (requestedSidebarImage && requestedSidebarImage.length > MAX_SIDEBAR_IMAGE_LENGTH) {
    return NextResponse.json({ message: 'La imagen es demasiado grande. Usa una imagen mas liviana' }, { status: 400 });
  }

  if (hasCredentialChanges && !currentPasswordInput.trim()) {
    return NextResponse.json({ message: 'Debes ingresar tu contraseña actual' }, { status: 400 });
  }

  if (hasCredentialChanges) {
    const passwordMatch = await compareCurrentPassword(currentPasswordInput, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ message: 'La contraseña actual no es correcta' }, { status: 400 });
    }
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

  if (personalDataChanged) {
    data.nombreCompleto = normalizedNombreCompleto;
    data.edad = normalizedEdad;
    data.fechaNacimiento = normalizedFechaNacimiento;
    data.altura = normalizedAltura;
    data.telefono = normalizedTelefono;
    data.direccion = normalizedDireccion;
  }

  if (Object.keys(data).length > 0) {
    await db.user.update({
      where: { id: user.id },
      data,
    });
  }

  if (sidebarImageChanged) {
    try {
      await writeSidebarImageForUser(user.id, requestedSidebarImage ?? null);
    } catch {
      return NextResponse.json({ message: 'No se pudo guardar la foto de perfil. Intenta nuevamente' }, { status: 500 });
    }
  }

  const updatedUser = await db.user.findUnique({
    where: { id: user.id },
    select: ACCOUNT_SELECT,
  });

  if (!updatedUser) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  let message = 'Cuenta actualizada correctamente';

  if (hasCredentialChanges) {
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
  } else if (hasCredentialChanges) {
    message = 'Cuenta actualizada correctamente';
  } else if (personalDataChanged && !sidebarImageChanged) {
    message = 'Datos personales guardados correctamente';
  }

  if (sidebarImageChanged) {
    if (!hasCredentialChanges && !personalDataChanged) {
      message = 'Foto de perfil guardada correctamente';
    } else {
      message = `${message} y foto de perfil guardada`;
    }
  }

  return NextResponse.json({
    message,
    user: {
      ...updatedUser,
      sidebarImage: sidebarImageChanged ? requestedSidebarImage ?? null : currentSidebarImage,
    },
  });
}