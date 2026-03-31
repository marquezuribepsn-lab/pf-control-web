import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const db = prisma as any;
const MAX_SIDEBAR_IMAGE_LENGTH = 2_000_000;

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

async function resolveTargetUser(payload: any) {
  const requestedUserId = typeof payload?.userId === 'string' ? payload.userId.trim() : '';
  if (requestedUserId) {
    return db.user.findUnique({
      where: { id: requestedUserId },
      select: {
        id: true,
        email: true,
        role: true,
        nombreCompleto: true,
      },
    });
  }

  const requestedEmail = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (requestedEmail) {
    return db.user.findUnique({
      where: { email: requestedEmail },
      select: {
        id: true,
        email: true,
        role: true,
        nombreCompleto: true,
      },
    });
  }

  const requestedName =
    typeof payload?.nombreCompleto === 'string' ? payload.nombreCompleto.trim() : '';
  const requestedRole = typeof payload?.role === 'string' ? payload.role.trim().toUpperCase() : '';
  if (!requestedName) {
    return null;
  }

  const users = await db.user.findMany({
    where: requestedRole && ['ADMIN', 'COLABORADOR', 'CLIENTE'].includes(requestedRole)
      ? { role: requestedRole }
      : undefined,
    select: {
      id: true,
      email: true,
      role: true,
      nombreCompleto: true,
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const payload = {
    userId: url.searchParams.get('userId') || '',
    email: url.searchParams.get('email') || '',
    nombreCompleto: url.searchParams.get('nombreCompleto') || '',
    role: url.searchParams.get('role') || '',
  };

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
    role: string;
    nombreCompleto: string;
  };

  const key = `profile-image:${targetUser.id}`;
  const profileImageEntry = await db.syncEntry.findUnique({
    where: { key },
    select: { value: true },
  });

  const syncValue = profileImageEntry?.value;
  const sidebarImage =
    typeof syncValue === 'string'
      ? syncValue
      : syncValue && typeof syncValue === 'object' && 'sidebarImage' in syncValue
      ? String((syncValue as { sidebarImage?: unknown }).sidebarImage || '')
      : '';

  return NextResponse.json({
    ok: true,
    user: targetUser,
    sidebarImage: sidebarImage || null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const payload = await req.json().catch(() => ({}));
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
      role: string;
      nombreCompleto: string;
    };

    const rawSidebarImage = payload?.sidebarImage;
    if (rawSidebarImage !== null && typeof rawSidebarImage !== 'string') {
      return NextResponse.json({ message: 'Formato de imagen invalido' }, { status: 400 });
    }

    const nextSidebarImage =
      typeof rawSidebarImage === 'string' ? rawSidebarImage.trim() : null;

    if (typeof nextSidebarImage === 'string' && nextSidebarImage.length > MAX_SIDEBAR_IMAGE_LENGTH) {
      return NextResponse.json({ message: 'La imagen es demasiado grande' }, { status: 400 });
    }

    const key = `profile-image:${targetUser.id}`;

    if (nextSidebarImage) {
      await db.syncEntry.upsert({
        where: { key },
        create: {
          key,
          value: {
            sidebarImage: nextSidebarImage,
            updatedAt: new Date().toISOString(),
            source: 'admin-clientes-profile-image',
          },
        },
        update: {
          value: {
            sidebarImage: nextSidebarImage,
            updatedAt: new Date().toISOString(),
            source: 'admin-clientes-profile-image',
          },
        },
      });
    } else {
      await db.syncEntry.deleteMany({ where: { key } });
    }

    return NextResponse.json({
      ok: true,
      user: targetUser,
      sidebarImage: nextSidebarImage || null,
      message: nextSidebarImage
        ? 'Foto de perfil actualizada correctamente'
        : 'Foto de perfil eliminada correctamente',
    });
  } catch (error) {
    console.error('Admin update profile image error:', error);
    return NextResponse.json({ message: 'Error al actualizar la foto de perfil' }, { status: 500 });
  }
}
