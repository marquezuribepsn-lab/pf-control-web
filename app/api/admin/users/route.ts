import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { filterOperationalUsers, isTestAccountEmail } from '@/lib/operationalUsers';

const db = prisma as any;

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'No autorizado' },
      { status: 401 }
    );
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      estado: true,
      nombreCompleto: true,
      edad: true,
      fechaNacimiento: true,
      altura: true,
      telefono: true,
      direccion: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(filterOperationalUsers(users));
}

export async function PUT(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'No autorizado' },
      { status: 401 }
    );
  }

  try {
    const { userId, role, estado } = await req.json();

    const hasRole = typeof role === 'string' && role.length > 0;
    const hasEstado = typeof estado === 'string' && estado.length > 0;

    if (!userId || (!hasRole && !hasEstado)) {
      return NextResponse.json(
        { message: 'Datos inválidos' },
        { status: 400 }
      );
    }

    if (hasRole && !['ADMIN', 'COLABORADOR', 'CLIENTE'].includes(role)) {
      return NextResponse.json(
        { message: 'Rol invalido' },
        { status: 400 }
      );
    }

    if (hasEstado && !['activo', 'suspendido', 'baja', 'pendiente_alta'].includes(String(estado))) {
      return NextResponse.json(
        { message: 'Estado invalido' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (hasRole) {
      updateData.role = role;
    }
    if (hasEstado) {
      updateData.estado = estado;
    }

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        estado: true,
        nombreCompleto: true,
        edad: true,
        fechaNacimiento: true,
        altura: true,
        telefono: true,
        direccion: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { message: 'Error al actualizar usuario' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'No autorizado' },
      { status: 401 }
    );
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { message: 'userId requerido' },
        { status: 400 }
      );
    }

    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { message: 'Error al eliminar usuario' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'No autorizado' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.cleanupTestAccounts) {
      return NextResponse.json(
        { message: 'Operacion no soportada' },
        { status: 400 }
      );
    }

    const users = await db.user.findMany({
      select: { id: true, email: true },
    });

    const currentUserId = String((session.user as any).id || '');
    const toDeleteIds = users
      .filter((user: { id: string; email?: string | null }) => isTestAccountEmail(user.email))
      .map((user: { id: string }) => user.id)
      .filter((id: string) => id !== currentUserId);

    let deletedCount = 0;
    if (toDeleteIds.length > 0) {
      const result = await db.user.deleteMany({
        where: {
          id: { in: toDeleteIds },
        },
      });
      deletedCount = result.count;
    }

    const remainingUsers = await db.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        estado: true,
        nombreCompleto: true,
        edad: true,
        fechaNacimiento: true,
        altura: true,
        telefono: true,
        direccion: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      message: `Se eliminaron ${deletedCount} cuentas de prueba`,
      deletedCount,
      users: filterOperationalUsers(remainingUsers),
    });
  } catch (error) {
    console.error('Cleanup test users error:', error);
    return NextResponse.json(
      { message: 'Error al limpiar cuentas de prueba' },
      { status: 500 }
    );
  }
}
