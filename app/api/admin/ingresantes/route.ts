import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSyncValue, setSyncValue } from '@/lib/syncStore';
import { notifySyncChanged } from '@/lib/pushNotifications';

const db = prisma as any;

type IngresanteIntake = {
  nombre?: string;
  apellido?: string;
  nombreCompleto?: string;
  telefono?: string;
  fechaNacimiento?: string;
  anamnesis?: {
    antecedentesMedicos?: string;
    lesionesPrevias?: string;
    objetivoPrincipal?: string;
    medicacionActual?: string;
    cirugias?: string;
    actividadFisicaActual?: string;
    restricciones?: string;
  };
  estado?: string;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  decision?: string;
};

function isAdmin(session: any) {
  return Boolean(session && session.user && (session.user as any).role === 'ADMIN');
}

export async function GET() {
  const session = await auth();

  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const ingresantes = await db.user.findMany({
    where: {
      role: 'CLIENTE',
      estado: 'ingresante',
    },
    select: {
      id: true,
      nombreCompleto: true,
      email: true,
      telefono: true,
      fechaNacimiento: true,
      emailVerified: true,
      createdAt: true,
      estado: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (ingresantes.length === 0) {
    return NextResponse.json([]);
  }

  const intakeKeys = ingresantes.map((item: { id: string }) => `ingresante:${item.id}`);
  const intakeEntries = await db.syncEntry.findMany({
    where: { key: { in: intakeKeys } },
    select: { key: true, value: true },
  });

  const intakeMap = new Map<string, IngresanteIntake>();
  for (const entry of intakeEntries) {
    intakeMap.set(String(entry.key), (entry.value || {}) as IngresanteIntake);
  }

  const payload = ingresantes.map((item: any) => {
    const key = `ingresante:${item.id}`;
    const intake = intakeMap.get(key) || {};

    return {
      ...item,
      nombre: '',
      apellido: '',
      intake,
    };
  });

  return NextResponse.json(payload);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();

  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const reviewerEmail = (session?.user as any)?.email || 'admin';

  try {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (!userId || !['aprobar', 'rechazar'].includes(action)) {
      return NextResponse.json({ message: 'Datos invalidos' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        estado: true,
        nombreCompleto: true,
        telefono: true,
        fechaNacimiento: true,
      },
    });

    if (!user || user.role !== 'CLIENTE' || user.estado !== 'ingresante') {
      return NextResponse.json({ message: 'Ingresante no encontrado' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const intakeKey = `ingresante:${userId}`;

    if (action === 'aprobar') {
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: {
          estado: 'activo',
          role: 'CLIENTE',
        },
        select: {
          id: true,
          email: true,
          role: true,
          estado: true,
          emailVerified: true,
        },
      });

      const existingEntry = await db.syncEntry.findUnique({ where: { key: intakeKey } });
      const currentValue = ((existingEntry?.value || {}) as IngresanteIntake) || {};

      if (existingEntry) {
        await db.syncEntry.update({
          where: { key: intakeKey },
          data: {
            value: {
              ...currentValue,
              estado: 'aprobado',
              reviewedAt: nowIso,
              reviewedBy: reviewerEmail,
              decision: 'aprobado',
            },
          },
        });
      }

      // Alta operativa en la lista de alumnos para que aparezca en Clientes.
      const alumnosKey = 'pf-control-alumnos';
      const alumnosRaw = await getSyncValue(alumnosKey);
      const alumnosList = Array.isArray(alumnosRaw) ? [...alumnosRaw] : [];

      const nombreFinal = String(
        currentValue.nombreCompleto || user.nombreCompleto || ''
      ).trim();
      const objetivoFromIntake = String(currentValue?.anamnesis?.objetivoPrincipal || '').trim();
      const observacionesFromIntake = [
        currentValue?.anamnesis?.antecedentesMedicos,
        currentValue?.anamnesis?.lesionesPrevias,
      ]
        .filter(Boolean)
        .map((item) => String(item).trim())
        .join(' | ');

      const alreadyExists = alumnosList.some((item: any) => {
        const alumnoNombre = String(item?.nombre || '').trim().toLowerCase();
        return alumnoNombre && alumnoNombre === nombreFinal.toLowerCase();
      });

      if (!alreadyExists && nombreFinal) {
        alumnosList.unshift({
          nombre: nombreFinal,
          estado: 'activo',
          fechaNacimiento:
            typeof currentValue.fechaNacimiento === 'string' && currentValue.fechaNacimiento
              ? currentValue.fechaNacimiento
              : user.fechaNacimiento
              ? new Date(user.fechaNacimiento).toISOString().slice(0, 10)
              : '',
          altura: '',
          peso: '',
          club: '',
          objetivo: objetivoFromIntake,
          observaciones: observacionesFromIntake,
          practicaDeporte: false,
        });

        await setSyncValue(alumnosKey, alumnosList);
        await notifySyncChanged(alumnosKey).catch(() => {
          // No bloquear aprobacion si falla push de sincronizacion.
        });
      }

      return NextResponse.json({ message: 'Ingresante aprobado', user: updatedUser });
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        estado: 'baja',
      },
      select: {
        id: true,
        email: true,
        role: true,
        estado: true,
        emailVerified: true,
      },
    });

    const existingEntry = await db.syncEntry.findUnique({ where: { key: intakeKey } });
    if (existingEntry) {
      const currentValue = (existingEntry.value || {}) as IngresanteIntake;
      await db.syncEntry.update({
        where: { key: intakeKey },
        data: {
          value: {
            ...currentValue,
            estado: 'rechazado',
            reviewedAt: nowIso,
            reviewedBy: reviewerEmail,
            decision: 'rechazado',
          },
        },
      });
    }

    return NextResponse.json({ message: 'Ingresante rechazado', user: updatedUser });
  } catch (error) {
    console.error('Ingresantes PATCH error:', error);
    return NextResponse.json({ message: 'Error al actualizar ingresante' }, { status: 500 });
  }
}
