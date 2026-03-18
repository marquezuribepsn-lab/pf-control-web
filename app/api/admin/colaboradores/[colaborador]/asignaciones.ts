import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest, context: { params: Promise<{ colaborador: string }> }) {
  const params = await context.params;
  const { asignaciones } = await req.json();
  try {
    const normalized: Array<{ alumnoId: string; puedeEditar: boolean }> = Array.isArray(asignaciones)
      ? asignaciones
          .map((item: any) => {
            if (typeof item === 'string') {
              const alumnoId = item.trim();
              return alumnoId ? { alumnoId, puedeEditar: true } : null;
            }

            if (item && typeof item.alumnoId === 'string') {
              const alumnoId = item.alumnoId.trim();
              if (!alumnoId) return null;
              return { alumnoId, puedeEditar: Boolean(item.puedeEditar) };
            }

            return null;
          })
          .filter((item): item is { alumnoId: string; puedeEditar: boolean } => Boolean(item))
      : [];

    // Eliminar asignaciones previas
    await prisma.alumnoAsignado.deleteMany({ where: { colaboradorId: params.colaborador } });

    // Crear nuevas asignaciones
    for (const item of normalized) {
      await prisma.alumnoAsignado.create({
        data: {
          colaboradorId: params.colaborador,
          alumnoId: item.alumnoId,
          puedeEditar: item.puedeEditar,
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    let errorMsg = 'Error desconocido';
    if (typeof error === 'object' && error && 'message' in error) {
      errorMsg = (error as any).message;
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ colaborador: string }> }) {
  const params = await context.params;
  const asignaciones = await prisma.alumnoAsignado.findMany({
    where: { colaboradorId: params.colaborador },
    include: { alumno: true },
  });
  return NextResponse.json({ asignaciones });
}
