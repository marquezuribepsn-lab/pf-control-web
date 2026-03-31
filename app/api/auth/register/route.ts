import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {
  generateVerificationToken,
  sendVerificationEmail,
  sendAdminAlumnoRegisteredEmail,
} from '@/lib/email';

const db = prisma as any;

export async function POST(req: NextRequest) {
  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ message: 'Body JSON invalido' }, { status: 400 });
    }

    const {
      email,
      password,
      nombre,
      apellido,
      fechaNacimiento,
      telefono,
      anamnesis,
    } = payload || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedNombre = typeof nombre === 'string' ? nombre.trim() : '';
    const normalizedApellido = typeof apellido === 'string' ? apellido.trim() : '';
    const normalizedTelefono = typeof telefono === 'string' ? telefono.trim() : '';
    const normalizedFechaNacimiento =
      typeof fechaNacimiento === 'string' ? fechaNacimiento.trim() : '';
    const normalizedAnamnesis =
      anamnesis && typeof anamnesis === 'object' && !Array.isArray(anamnesis) ? anamnesis : null;
    const antecedentesMedicos =
      typeof normalizedAnamnesis?.antecedentesMedicos === 'string'
        ? normalizedAnamnesis.antecedentesMedicos.trim()
        : '';
    const lesionesPrevias =
      typeof normalizedAnamnesis?.lesionesPrevias === 'string'
        ? normalizedAnamnesis.lesionesPrevias.trim()
        : '';
    const objetivoPrincipal =
      typeof normalizedAnamnesis?.objetivoPrincipal === 'string'
        ? normalizedAnamnesis.objetivoPrincipal.trim()
        : '';

    if (
      !normalizedEmail ||
      !password ||
      password.length < 6 ||
      !normalizedNombre ||
      !normalizedApellido ||
      !normalizedFechaNacimiento ||
      !normalizedTelefono ||
      !antecedentesMedicos ||
      !lesionesPrevias ||
      !objetivoPrincipal
    ) {
      return NextResponse.json(
        {
          message:
            'Completa nombre, apellido, fecha de nacimiento, telefono, email, contraseña y anamnesis inicial obligatoria',
        },
        { status: 400 }
      );
    }

    const birthDate = new Date(normalizedFechaNacimiento);
    if (Number.isNaN(birthDate.getTime())) {
      return NextResponse.json({ message: 'Fecha de nacimiento invalida' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'El email ya está registrado' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.user.create({
      data: {
        nombreCompleto: `${normalizedNombre} ${normalizedApellido}`.trim(),
        fechaNacimiento: birthDate,
        telefono: normalizedTelefono,
        email: normalizedEmail,
        password: hashedPassword,
        role: 'CLIENTE',
        estado: 'ingresante',
      },
    });

    // Guardamos la ficha de ingreso para revision/admin alta posterior.
    await db.syncEntry.upsert({
      where: { key: `ingresante:${user.id}` },
      create: {
        key: `ingresante:${user.id}`,
        value: {
          userId: user.id,
          nombre: normalizedNombre,
          apellido: normalizedApellido,
          nombreCompleto: `${normalizedNombre} ${normalizedApellido}`.trim(),
          email: normalizedEmail,
          telefono: normalizedTelefono,
          fechaNacimiento: normalizedFechaNacimiento,
          anamnesis: {
            antecedentesMedicos,
            lesionesPrevias,
            objetivoPrincipal,
            medicacionActual:
              typeof normalizedAnamnesis?.medicacionActual === 'string'
                ? normalizedAnamnesis.medicacionActual.trim()
                : '',
            cirugias:
              typeof normalizedAnamnesis?.cirugias === 'string'
                ? normalizedAnamnesis.cirugias.trim()
                : '',
            actividadFisicaActual:
              typeof normalizedAnamnesis?.actividadFisicaActual === 'string'
                ? normalizedAnamnesis.actividadFisicaActual.trim()
                : '',
            restricciones:
              typeof normalizedAnamnesis?.restricciones === 'string'
                ? normalizedAnamnesis.restricciones.trim()
                : '',
          },
          estado: 'pendiente_revision_admin',
          createdAt: new Date().toISOString(),
        },
      },
      update: {
        value: {
          userId: user.id,
          nombre: normalizedNombre,
          apellido: normalizedApellido,
          nombreCompleto: `${normalizedNombre} ${normalizedApellido}`.trim(),
          email: normalizedEmail,
          telefono: normalizedTelefono,
          fechaNacimiento: normalizedFechaNacimiento,
          anamnesis: {
            antecedentesMedicos,
            lesionesPrevias,
            objetivoPrincipal,
            medicacionActual:
              typeof normalizedAnamnesis?.medicacionActual === 'string'
                ? normalizedAnamnesis.medicacionActual.trim()
                : '',
            cirugias:
              typeof normalizedAnamnesis?.cirugias === 'string'
                ? normalizedAnamnesis.cirugias.trim()
                : '',
            actividadFisicaActual:
              typeof normalizedAnamnesis?.actividadFisicaActual === 'string'
                ? normalizedAnamnesis.actividadFisicaActual.trim()
                : '',
            restricciones:
              typeof normalizedAnamnesis?.restricciones === 'string'
                ? normalizedAnamnesis.restricciones.trim()
                : '',
          },
          estado: 'pendiente_revision_admin',
          createdAt: new Date().toISOString(),
        },
      },
    });

    // Generate verification token
    const token = await generateVerificationToken(user.email);

    // Send verification email
    await sendVerificationEmail(user.email, token);

    // Notificacion al/los admin para revision de ingreso.
    await sendAdminAlumnoRegisteredEmail({
      tipo: 'ingresante_web',
      userId: user.id,
      nombre: normalizedNombre,
      apellido: normalizedApellido,
      email: normalizedEmail,
      telefono: normalizedTelefono,
      fechaNacimiento: normalizedFechaNacimiento,
      anamnesis: {
        antecedentesMedicos,
        lesionesPrevias,
        objetivoPrincipal,
      },
      estado: 'pendiente_revision_admin',
    }).catch(() => {
      // No frenamos el registro si falla aviso al admin.
    });

    return NextResponse.json(
      {
        message:
          'Registro enviado. Verifica tu email y espera la aprobacion del administrador para ingresar.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { message: 'Error al registrarse' },
      { status: 500 }
    );
  }
}
