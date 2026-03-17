import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendVerificationEmail, sendColaboradorCredentials } from '@/lib/email';

const prisma = new PrismaClient();

// Historial de acciones
async function logAccion(colaboradorId: string, accion: string, detalles: any) {
  await prisma.syncEntry.create({
    data: {
      key: `colaborador-${colaboradorId}-log`,
      value: { accion, detalles, fecha: new Date().toISOString() },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { colaborador: string } }) {
  const colaborador = await prisma.user.findUnique({
    where: { id: params.colaborador, role: 'COLABORADOR' },
  });
  if (!colaborador) return NextResponse.json({ colaborador: null }, { status: 404 });
  // Obtener historial
  const historial = await prisma.syncEntry.findMany({ where: { key: `colaborador-${params.colaborador}-log` } });
  return NextResponse.json({ colaborador, historial });
}

export async function PUT(req: NextRequest, { params }: { params: { colaborador: string } }) {
  const data = await req.json();
  try {
    const colaborador = await prisma.user.update({
      where: { id: params.colaborador, role: 'COLABORADOR' },
      data,
    });
    await logAccion(params.colaborador, 'modificacion', data);
    return NextResponse.json({ success: true, colaborador });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { colaborador: string } }) {
  try {
    // Suspender en vez de borrar
    const colaborador = await prisma.user.update({
      where: { id: params.colaborador, role: 'COLABORADOR' },
      data: { estado: 'suspendido' },
    });
    await logAccion(params.colaborador, 'suspension', {});
    // Enviar aviso por mail
    await sendColaboradorCredentials(colaborador.email, 'BAJA', colaborador.nombreCompleto);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
