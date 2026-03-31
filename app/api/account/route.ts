import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';
import { isProtectedAdminEmail } from '@/lib/operationalUsers';

const db = prisma as any;

type StoredNavPreset = {
  order: string[];
  locked: boolean;
  hasPersistedConfig: boolean;
};

function normalizePasswordInput(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
}

function splitNombreCompleto(nombreCompleto: string | null | undefined): {
  nombre: string;
  apellido: string;
} {
  const raw = String(nombreCompleto || '').trim();
  if (!raw) {
    return { nombre: '', apellido: '' };
  }

  const chunks = raw.split(/\s+/).filter(Boolean);
  return {
    nombre: chunks[0] || '',
    apellido: chunks.slice(1).join(' '),
  };
}

async function getSidebarImageForUser(userId: string): Promise<string | null> {
  const profileImageEntry = await db.syncEntry.findUnique({
    where: { key: `profile-image:${userId}` },
    select: { value: true },
  });

  const syncValue = profileImageEntry?.value;
  const sidebarImage =
    typeof syncValue === 'string'
      ? syncValue
      : syncValue && typeof syncValue === 'object' && 'sidebarImage' in syncValue
      ? String((syncValue as { sidebarImage?: unknown }).sidebarImage || '')
      : '';

  return sidebarImage || null;
}

async function getNavPresetForUser(userId: string): Promise<StoredNavPreset> {
  const navConfigEntry = await db.syncEntry.findUnique({
    where: { key: `nav-config:${userId}` },
    select: { value: true },
  });

  const syncValue = navConfigEntry?.value;
  const rawOrder =
    syncValue && typeof syncValue === 'object' && 'order' in syncValue
      ? (syncValue as { order?: unknown }).order
      : undefined;
  const rawLocked =
    syncValue && typeof syncValue === 'object' && 'locked' in syncValue
      ? (syncValue as { locked?: unknown }).locked
      : undefined;

  const order = Array.isArray(rawOrder)
    ? rawOrder.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    order,
    locked: typeof rawLocked === 'boolean' ? rawLocked : true,
    hasPersistedConfig: Boolean(navConfigEntry),
  };
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
      nombreCompleto: true,
      fechaNacimiento: true,
      telefono: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  const [sidebarImage, navPreset] = await Promise.all([
    getSidebarImageForUser(user.id),
    getNavPresetForUser(user.id),
  ]);

  return NextResponse.json({
    ...user,
    nombre: splitNombreCompleto(user.nombreCompleto).nombre,
    apellido: splitNombreCompleto(user.nombreCompleto).apellido,
    sidebarImage,
    navConfig: navPreset.hasPersistedConfig ? { order: navPreset.order } : null,
    navPresetLocked: navPreset.locked,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const payload = await req.json();
  const { email, currentPassword, newPassword } = payload || {};

  const hasNombreInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'nombre');
  const hasApellidoInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'apellido');
  const hasFechaNacimientoInPayload = Object.prototype.hasOwnProperty.call(
    payload || {},
    'fechaNacimiento'
  );
  const hasTelefonoInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'telefono');

  const nextNombre =
    hasNombreInPayload && typeof payload.nombre === 'string' ? payload.nombre.trim() : undefined;
  const nextApellido =
    hasApellidoInPayload && typeof payload.apellido === 'string' ? payload.apellido.trim() : undefined;
  const nextTelefono =
    hasTelefonoInPayload && typeof payload.telefono === 'string'
      ? payload.telefono.trim()
      : undefined;

  let nextFechaNacimiento: Date | undefined;
  if (hasFechaNacimientoInPayload) {
    if (typeof payload.fechaNacimiento !== 'string') {
      return NextResponse.json({ message: 'Fecha de nacimiento invalida' }, { status: 400 });
    }

    const rawDate = payload.fechaNacimiento.trim();
    const parsed = new Date(rawDate);
    if (!rawDate || Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ message: 'Fecha de nacimiento invalida' }, { status: 400 });
    }
    nextFechaNacimiento = parsed;
  }

  if (hasNombreInPayload && typeof payload.nombre !== 'string') {
    return NextResponse.json({ message: 'Nombre invalido' }, { status: 400 });
  }

  if (hasApellidoInPayload && typeof payload.apellido !== 'string') {
    return NextResponse.json({ message: 'Apellido invalido' }, { status: 400 });
  }

  if (hasTelefonoInPayload && typeof payload.telefono !== 'string') {
    return NextResponse.json({ message: 'Telefono invalido' }, { status: 400 });
  }

  if ((hasNombreInPayload && !nextNombre) || (hasApellidoInPayload && !nextApellido)) {
    return NextResponse.json({ message: 'Nombre y apellido no pueden estar vacios' }, { status: 400 });
  }

  const hasSidebarImageInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'sidebarImage');
  const rawSidebarImage = hasSidebarImageInPayload ? payload.sidebarImage : undefined;
  const nextSidebarImage =
    rawSidebarImage === null
      ? null
      : typeof rawSidebarImage === 'string'
      ? rawSidebarImage.trim()
      : undefined;

  if (hasSidebarImageInPayload && rawSidebarImage !== null && typeof rawSidebarImage !== 'string') {
    return NextResponse.json({ message: 'Formato de imagen invalido' }, { status: 400 });
  }

  if (typeof nextSidebarImage === 'string' && nextSidebarImage.length > 2_000_000) {
    return NextResponse.json({ message: 'La imagen es demasiado grande' }, { status: 400 });
  }

  const hasNavConfigInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'navConfig');
  const rawNavConfig = hasNavConfigInPayload ? payload.navConfig : undefined;
  let nextNavOrder: string[] | null | undefined;

  if (hasNavConfigInPayload) {
    if (rawNavConfig === null) {
      nextNavOrder = [];
    } else if (
      rawNavConfig &&
      typeof rawNavConfig === 'object' &&
      Array.isArray((rawNavConfig as { order?: unknown }).order)
    ) {
      nextNavOrder = (rawNavConfig as { order: unknown[] }).order
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, 128);
    } else {
      return NextResponse.json({ message: 'Formato de menu invalido' }, { status: 400 });
    }
  }

  const hasNavPresetLockedInPayload = Object.prototype.hasOwnProperty.call(
    payload || {},
    'navPresetLocked'
  );
  const rawNavPresetLocked = hasNavPresetLockedInPayload ? payload.navPresetLocked : undefined;
  const nextNavPresetLocked =
    typeof rawNavPresetLocked === 'boolean' ? rawNavPresetLocked : undefined;

  if (hasNavPresetLockedInPayload && typeof rawNavPresetLocked !== 'boolean') {
    return NextResponse.json({ message: 'Valor de candado invalido' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  const [currentSidebarImage, currentNavPreset] = await Promise.all([
    getSidebarImageForUser(user.id),
    getNavPresetForUser(user.id),
  ]);

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : user.email;
  const nextPassword = normalizePasswordInput(newPassword);
  const rawCurrentPassword = typeof currentPassword === 'string' ? currentPassword : '';
  const normalizedCurrentPassword = normalizePasswordInput(currentPassword);
  const currentSplitName = splitNombreCompleto(user.nombreCompleto);
  const currentNombre = currentSplitName.nombre;
  const currentApellido = currentSplitName.apellido;
  const currentTelefono = String(user.telefono || '').trim();
  const currentFechaNacimientoISO = user.fechaNacimiento
    ? new Date(user.fechaNacimiento).toISOString().slice(0, 10)
    : '';

  const emailChanged = normalizedEmail !== user.email;
  const passwordChanged = Boolean(nextPassword);
  const isCurrentUserProtectedAdmin = isProtectedAdminEmail(user.email);
  const protectedAdminNeedsRoleRepair = isCurrentUserProtectedAdmin && user.role !== 'ADMIN';
  const nombreChanged = hasNombreInPayload && nextNombre !== currentNombre;
  const apellidoChanged = hasApellidoInPayload && nextApellido !== currentApellido;
  const telefonoChanged = hasTelefonoInPayload && nextTelefono !== currentTelefono;
  const fechaNacimientoChanged =
    hasFechaNacimientoInPayload &&
    nextFechaNacimiento?.toISOString().slice(0, 10) !== currentFechaNacimientoISO;
  const sidebarImageChanged =
    hasSidebarImageInPayload && nextSidebarImage !== currentSidebarImage;
  const navConfigChanged =
    hasNavConfigInPayload &&
    JSON.stringify(nextNavOrder || []) !== JSON.stringify(currentNavPreset.order);
  const navPresetLockedChanged =
    hasNavPresetLockedInPayload && nextNavPresetLocked !== currentNavPreset.locked;

  if (
    !emailChanged &&
    !passwordChanged &&
    !nombreChanged &&
    !apellidoChanged &&
    !telefonoChanged &&
    !fechaNacimientoChanged &&
    !sidebarImageChanged &&
    !navConfigChanged &&
    !navPresetLockedChanged &&
    !protectedAdminNeedsRoleRepair
  ) {
    return NextResponse.json({ message: 'No hay cambios para guardar' }, { status: 400 });
  }

  if (isCurrentUserProtectedAdmin && emailChanged) {
    return NextResponse.json(
      { message: 'La cuenta de administrador principal no puede cambiar su email' },
      { status: 403 }
    );
  }

  if (!isCurrentUserProtectedAdmin && emailChanged && isProtectedAdminEmail(normalizedEmail)) {
    return NextResponse.json(
      { message: 'Ese email esta reservado para el administrador principal' },
      { status: 403 }
    );
  }

  const requiresPasswordValidation = emailChanged || passwordChanged;

  if (requiresPasswordValidation) {
    if (!rawCurrentPassword) {
      return NextResponse.json({ message: 'Debes ingresar tu contraseña actual' }, { status: 400 });
    }

    let passwordMatch = await bcrypt.compare(rawCurrentPassword, user.password);
    if (
      !passwordMatch &&
      normalizedCurrentPassword &&
      normalizedCurrentPassword !== rawCurrentPassword
    ) {
      passwordMatch = await bcrypt.compare(normalizedCurrentPassword, user.password);
    }

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

  if (typeof newPassword === 'string' && newPassword.length > 0 && !nextPassword) {
    return NextResponse.json({ message: 'La nueva contraseña no puede estar vacia' }, { status: 400 });
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

  if (protectedAdminNeedsRoleRepair) {
    data.role = 'ADMIN';
  }

  if (nombreChanged) {
    // nombre/apellido se consolidan en nombreCompleto para compatibilidad actual
  }

  if (telefonoChanged) {
    data.telefono = nextTelefono || null;
  }

  if (fechaNacimientoChanged && nextFechaNacimiento) {
    data.fechaNacimiento = nextFechaNacimiento;
  }

  if (nombreChanged || apellidoChanged) {
    const mergedNombre = nombreChanged ? nextNombre || '' : currentNombre;
    const mergedApellido = apellidoChanged ? nextApellido || '' : currentApellido;
    data.nombreCompleto = `${mergedNombre} ${mergedApellido}`.trim();
  }

  if (hasSidebarImageInPayload) {
    if (nextSidebarImage) {
      await db.syncEntry.upsert({
        where: { key: `profile-image:${user.id}` },
        create: {
          key: `profile-image:${user.id}`,
          value: { sidebarImage: nextSidebarImage },
        },
        update: {
          value: { sidebarImage: nextSidebarImage },
        },
      });
    } else {
      await db.syncEntry.deleteMany({ where: { key: `profile-image:${user.id}` } });
    }
  }

  if (hasNavConfigInPayload || hasNavPresetLockedInPayload) {
    const mergedOrder = hasNavConfigInPayload ? nextNavOrder || [] : currentNavPreset.order;
    const mergedLocked =
      hasNavPresetLockedInPayload && typeof nextNavPresetLocked === 'boolean'
        ? nextNavPresetLocked
        : currentNavPreset.locked;

    await db.syncEntry.upsert({
      where: { key: `nav-config:${user.id}` },
      create: {
        key: `nav-config:${user.id}`,
        value: {
          order: mergedOrder,
          locked: mergedLocked,
          updatedAt: new Date().toISOString(),
        },
      },
      update: {
        value: {
          order: mergedOrder,
          locked: mergedLocked,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  const selectUserFields = {
    id: true,
    nombreCompleto: true,
    fechaNacimiento: true,
    telefono: true,
    email: true,
    role: true,
    emailVerified: true,
    createdAt: true,
    updatedAt: true,
  };

  const updatedUser =
    Object.keys(data).length > 0
      ? await db.user.update({
          where: { id: user.id },
          data,
          select: selectUserFields,
        })
      : await db.user.findUnique({
          where: { id: user.id },
          select: selectUserFields,
        });

  if (!updatedUser) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  if (passwordChanged) {
    await db.syncEntry.deleteMany({ where: { key: `user-password-admin:${user.id}` } });
  }

  const [updatedSidebarImage, updatedNavPreset] = await Promise.all([
    getSidebarImageForUser(updatedUser.id),
    getNavPresetForUser(updatedUser.id),
  ]);

  let message = 'Cuenta actualizada correctamente';

  if (emailChanged) {
    const token = await generateVerificationToken(updatedUser.email);
    await sendVerificationEmail(updatedUser.email, token);
    message = 'Cuenta actualizada. Te enviamos un mail para verificar el nuevo email';
  }

  return NextResponse.json({
    message,
    user: {
      ...updatedUser,
      nombre: splitNombreCompleto(updatedUser.nombreCompleto).nombre,
      apellido: splitNombreCompleto(updatedUser.nombreCompleto).apellido,
      sidebarImage: updatedSidebarImage,
      navConfig: { order: updatedNavPreset.order },
      navPresetLocked: updatedNavPreset.locked,
    },
  });
}