import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { sendColaboradorCredentials } from '@/lib/email';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const data = await req.json();
  const {
    email,
    nombreCompleto,
    edad,
    fechaNacimiento,
    altura,
    telefono,
    direccion,
    puedeEditarRegistros,
    puedeEditarPlanes,
    puedeVerTodosAlumnos,
    asignaciones // array de IDs de alumnos
  } = data;

  // Generar contraseña aleatoria segura
  const password = randomBytes(8).toString('hex');

  try {
    // Crear colaborador
    const colaborador = await prisma.user.create({
      data: {
        email,
        password,
        role: 'COLABORADOR',
        nombreCompleto,
        edad,
        fechaNacimiento: new Date(fechaNacimiento),
        altura,
        telefono,
        direccion,
        puedeEditarRegistros,
        puedeEditarPlanes,
        puedeVerTodosAlumnos,
      },
    });

    // Asignar alumnos
    if (Array.isArray(asignaciones)) {
      for (const alumnoId of asignaciones) {
        await prisma.alumnoAsignado.create({
          data: {
            colaboradorId: colaborador.id,
            alumnoId,
            puedeEditar: true,
          },
        });
      }
    }

    // Enviar credenciales por mail
    await sendColaboradorCredentials(email, password, nombreCompleto);

    return NextResponse.json({ success: true, colaborador });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  // Listar colaboradores
  const colaboradores = await prisma.user.findMany({
    where: { role: 'COLABORADOR' },
    include: {
      colaboraciones: {
        include: { alumno: true },
      },
    },
  });
  return NextResponse.json({ colaboradores });
}
