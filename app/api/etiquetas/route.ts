import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser, isStaffRole } from '@/lib/apiAuth';

const prisma = new PrismaClient();

/** Sólo el staff (admin/superadmin/colaborador) gestiona etiquetas de alumnos. */
async function requireStaff(): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!isStaffRole(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  return null;
}

// GET: Listar todas las etiquetas de un usuario
export async function GET(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
  const etiquetas = await prisma.etiqueta.findMany({ where: { userId } });
  return NextResponse.json(etiquetas);
}

// POST: Crear una etiqueta
export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;

  const { userId, texto, color } = await req.json();
  if (!userId || !texto || !color) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  const etiqueta = await prisma.etiqueta.create({ data: { userId, texto, color } });
  return NextResponse.json(etiqueta);
}

// PUT: Editar una etiqueta
export async function PUT(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;

  const { id, texto, color } = await req.json();
  if (!id || !texto || !color) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  const etiqueta = await prisma.etiqueta.update({ where: { id }, data: { texto, color } });
  return NextResponse.json(etiqueta);
}

// DELETE: Eliminar una etiqueta
export async function DELETE(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  await prisma.etiqueta.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
