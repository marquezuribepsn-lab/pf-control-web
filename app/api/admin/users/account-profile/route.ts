import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isProtectedAdminEmail } from '@/lib/operationalUsers';

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesLikelyMatch(a: string, b: string) {
  const left = normalizeText(a);
  const right = normalizeText(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(' ').filter(Boolean);
  const rightTokens = right.split(' ').filter(Boolean);
  const shared = leftTokens.filter((token) => rightTokens.includes(token));

  return shared.length >= 2 || shared.some((token) => token.length >= 5);
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

async function resolveTargetUser(payload: Record<string, unknown>) {
  const requestedUserId = typeof payload?.userId === 'string' ? payload.userId.trim() : '';
  if (requestedUserId) {
    return prisma.user.findUnique({
      where: { id: requestedUserId },
      select: {
        id: true,
        email: true,
        role: true,
        nombreCompleto: true,
        fechaNacimiento: true,
        telefono: true,
      },
    });
  }

  const requestedEmail = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (requestedEmail) {
    return prisma.user.findUnique({
      where: { email: requestedEmail },
      select: {
        id: true,
        email: true,
        role: true,
        nombreCompleto: true,
        fechaNacimiento: true,
        telefono: true,
      },
    });
  }

  const requestedName =
    typeof payload?.nombreCompleto === 'string' ? payload.nombreCompleto.trim() : '';
  const requestedRoleRaw =
    typeof payload?.role === 'string' ? payload.role.trim().toUpperCase() : '';
  const requestedRole = ['ADMIN', 'COLABORADOR', 'CLIENTE'].includes(requestedRoleRaw)
    ? (requestedRoleRaw as UserRole)
    : undefined;
  if (!requestedName) {
    return null;
  }

  const users = await prisma.user.findMany({
    where: requestedRole ? { role: requestedRole } : undefined,
    select: {
      id: true,
      email: true,
      role: true,
      nombreCompleto: true,
      fechaNacimiento: true,
      telefono: true,
    },
    take: 500,
  });

  const matches = users.filter((user: { nombreCompleto?: string }) =>
    namesLikelyMatch(String(user.nombreCompleto || ''), requestedName)
  );

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    return 'AMBIGUOUS';
  }

  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const target = await resolveTargetUser(payload);

    if (!target) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
    }

    if (target === 'AMBIGUOUS') {
      return NextResponse.json(
        { message: 'Se encontraron varios usuarios. Usa email o userId para precisar.' },
        { status: 409 }
      );
    }

    const targetUser = target as {
      id: string;
      email: string;
      role: UserRole;
      nombreCompleto: string;
      fechaNacimiento?: Date | null;
      telefono?: string | null;
    };

    if (isProtectedAdminEmail(targetUser.email)) {
      return NextResponse.json(
        { message: 'La cuenta de administrador principal esta protegida' },
        { status: 403 }
      );
    }

    const hasNombreInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'nombre');
    const hasApellidoInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'apellido');
    const hasFechaNacimientoInPayload = Object.prototype.hasOwnProperty.call(
      payload || {},
      'fechaNacimiento'
    );
    const hasTelefonoInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'telefono');
    const hasEmailInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'email');

    const nextNombre = hasNombreInPayload ? String(payload?.nombre || '').trim() : undefined;
    const nextApellido = hasApellidoInPayload ? String(payload?.apellido || '').trim() : undefined;
    const nextTelefono = hasTelefonoInPayload ? String(payload?.telefono || '').trim() : undefined;
    const nextEmail = hasEmailInPayload ? String(payload?.email || '').trim().toLowerCase() : undefined;

    if (hasNombreInPayload && !nextNombre) {
      return NextResponse.json({ message: 'Nombre invalido' }, { status: 400 });
    }

    if (hasApellidoInPayload && !nextApellido) {
      return NextResponse.json({ message: 'Apellido invalido' }, { status: 400 });
    }

    if (hasEmailInPayload && !nextEmail) {
      return NextResponse.json({ message: 'Email invalido' }, { status: 400 });
    }

    let nextFechaNacimiento: Date | null | undefined;
    if (hasFechaNacimientoInPayload) {
      const rawDate = String(payload?.fechaNacimiento || '').trim();
      if (!rawDate) {
        nextFechaNacimiento = null;
      } else {
        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ message: 'Fecha de nacimiento invalida' }, { status: 400 });
        }
        nextFechaNacimiento = parsed;
      }
    }

    if (nextEmail && nextEmail !== targetUser.email) {
      const existing = await prisma.user.findUnique({
        where: { email: nextEmail },
        select: { id: true },
      });

      if (existing && String(existing.id) !== String(targetUser.id)) {
        return NextResponse.json({ message: 'Ese email ya esta en uso' }, { status: 409 });
      }
    }

    const currentSplit = splitNombreCompleto(targetUser.nombreCompleto);
    const mergedNombre = hasNombreInPayload ? nextNombre || '' : currentSplit.nombre;
    const mergedApellido = hasApellidoInPayload ? nextApellido || '' : currentSplit.apellido;

    const updateData: Record<string, unknown> = {};

    if (hasNombreInPayload || hasApellidoInPayload) {
      updateData.nombreCompleto = `${mergedNombre} ${mergedApellido}`.trim();
    }

    if (hasFechaNacimientoInPayload) {
      updateData.fechaNacimiento = nextFechaNacimiento;
    }

    if (hasTelefonoInPayload) {
      updateData.telefono = nextTelefono || null;
    }

    if (hasEmailInPayload && nextEmail) {
      updateData.email = nextEmail;
    }

    const updated =
      Object.keys(updateData).length > 0
        ? await prisma.user.update({
            where: { id: targetUser.id },
            data: updateData,
            select: {
              id: true,
              email: true,
              role: true,
              nombreCompleto: true,
              fechaNacimiento: true,
              telefono: true,
              updatedAt: true,
            },
          })
        : await prisma.user.findUnique({
            where: { id: targetUser.id },
            select: {
              id: true,
              email: true,
              role: true,
              nombreCompleto: true,
              fechaNacimiento: true,
              telefono: true,
              updatedAt: true,
            },
          });

    if (!updated) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Cuenta del cliente sincronizada correctamente',
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        nombreCompleto: updated.nombreCompleto,
        nombre: splitNombreCompleto(updated.nombreCompleto).nombre,
        apellido: splitNombreCompleto(updated.nombreCompleto).apellido,
        fechaNacimiento: updated.fechaNacimiento,
        telefono: updated.telefono,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Admin update account profile error:', error);
    return NextResponse.json({ message: 'Error al sincronizar la cuenta del cliente' }, { status: 500 });
  }
}
