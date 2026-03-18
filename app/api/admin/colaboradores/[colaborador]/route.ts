import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendColaboradorCredentials } from '@/lib/email';

const prisma = new PrismaClient();

// Historial de acciones
async function logAccion(colaboradorId: string, accion: string, detalles: any) {
  await prisma.syncEntry.create({
    data: {
      key: `colaborador-${colaboradorId}-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      value: { accion, detalles, fecha: new Date().toISOString() },
    },
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ colaborador: string }> }) {
  const params = await context.params;
  const colaborador = await prisma.user.findUnique({
    where: { id: params.colaborador },
    include: {
      colaboraciones: {
        include: { alumno: true },
      },
    },
  });
  if (!colaborador) return NextResponse.json({ colaborador: null }, { status: 404 });
  // Obtener historial
  const historial = await prisma.syncEntry.findMany({
    where: {
      key: {
        startsWith: `colaborador-${params.colaborador}-log-`,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const asignaciones = colaborador.colaboraciones.map((c) => c.alumnoId);
  return NextResponse.json({ colaborador: { ...colaborador, asignaciones }, historial });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ colaborador: string }> }) {
  const params = await context.params;
  const input = await req.json();
  try {
    const existing = await prisma.user.findUnique({ where: { id: params.colaborador } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
    }

    const data = {
      ...input,
      email: typeof input.email === 'string' ? input.email.trim().toLowerCase() : input.email,
    };

    const colaborador = await prisma.user.update({
      where: { id: params.colaborador },
      data,
    });
    await logAccion(params.colaborador, 'modificacion', data);
    return NextResponse.json({ success: true, colaborador });
  } catch (error) {
    let errorMsg = 'Error desconocido';
    if (typeof error === 'object' && error && 'message' in error) {
      errorMsg = (error as any).message;
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ colaborador: string }> }) {
  const params = await context.params;
  try {
    const existing = await prisma.user.findUnique({ where: { id: params.colaborador } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
    }

    // Suspender en vez de borrar
    const colaborador = await prisma.user.update({
      where: { id: params.colaborador },
      data: { estado: 'suspendido' },
    });
    await logAccion(params.colaborador, 'suspension', {});
    // Enviar aviso por mail
    await sendColaboradorCredentials(colaborador.email, 'BAJA', colaborador.nombreCompleto);
    return NextResponse.json({ success: true });
  } catch (error) {
    let errorMsg = 'Error desconocido';
    if (typeof error === 'object' && error && 'message' in error) {
      errorMsg = (error as any).message;
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
