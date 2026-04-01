import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
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

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanedAsignaciones = Array.isArray(asignaciones)
    ? asignaciones.map((id: string) => id.trim()).filter(Boolean)
    : [];

  if (!normalizedEmail || !nombreCompleto) {
    return NextResponse.json({ success: false, error: 'Email y nombre completo son requeridos' }, { status: 400 });
  }

  // Generar contraseña aleatoria segura
  const password = randomBytes(8).toString('hex');
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'El email ya está registrado' }, { status: 400 });
    }

    // Crear colaborador
    const colaborador = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: 'COLABORADOR',
        emailVerified: true,
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
    if (cleanedAsignaciones.length > 0) {
      for (const alumnoId of cleanedAsignaciones) {
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
    await sendColaboradorCredentials(normalizedEmail, password, nombreCompleto);

    return NextResponse.json({ success: true, colaborador });
  } catch (error) {
    let errorMsg = 'Error desconocido';
    if (typeof error === 'object' && error && 'message' in error) {
      errorMsg = (error as any).message;
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function GET() {
  // Listar colaboradores
  const colaboradores = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'COLABORADOR' },
        { colaboraciones: { some: {} } },
      ],
    },
    include: {
      colaboraciones: {
        include: { alumno: true },
      },
    },
  });
  return NextResponse.json({ colaboradores });
}
