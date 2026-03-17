import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: { colaborador: string } }) {
  const { asignaciones } = await req.json(); // array de IDs de alumnos
  try {
    // Eliminar asignaciones previas
    await prisma.alumnoAsignado.deleteMany({ where: { colaboradorId: params.colaborador } });
    // Crear nuevas asignaciones
    for (const alumnoId of asignaciones) {
      await prisma.alumnoAsignado.create({
        data: {
          colaboradorId: params.colaborador,
          alumnoId,
          puedeEditar: true,
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { colaborador: string } }) {
  const asignaciones = await prisma.alumnoAsignado.findMany({
    where: { colaboradorId: params.colaborador },
    include: { alumno: true },
  });
  return NextResponse.json({ asignaciones });
}
