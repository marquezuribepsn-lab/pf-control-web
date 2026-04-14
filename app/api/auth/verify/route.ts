import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/email';
import { getSyncValue, setSyncValue } from '@/lib/syncStore';

const db = prisma as any;
const SIGNUP_PROFILES_KEY = 'pf-control-signup-profiles-v1';
const ALUMNOS_KEY = 'pf-control-alumnos';
const CLIENTES_META_KEY = 'pf-control-clientes-meta-v1';

type SignupAnamnesis = {
  tratamientoMedico?: string;
  lesionesLimitaciones?: string;
  medicacionRegular?: string;
  cirugiasRecientes?: string;
  antecedentesClinicos?: string;
  autorizacionMedica?: string;
  experienciaEntrenamiento?: string;
  alimentacionActual?: string[];
  alimentacionDetalle?: string;
  desordenAlimentario?: string;
  consumoSustancias?: string;
  suplementos?: string;
  interesEntrenamiento?: string[];
  interesDetalle?: string;
  compromisoObjetivo?: number | null;
  origenContacto?: string[];
  origenDetalle?: string;
  consentimientoSalud?: string;
};

type SignupProfile = {
  nombre?: string;
  apellido?: string;
  nombreCompleto?: string;
  edad?: number | null;
  altura?: string;
  peso?: string;
  telefono?: string;
  fechaNacimiento?: string;
  club?: string;
  objetivo?: string;
  observaciones?: string;
  practicaDeporte?: boolean;
  deporte?: string;
  categoria?: string;
  posicion?: string;
  anamnesis?: SignupAnamnesis;
};

function normalizeName(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatDateOnly(value: unknown) {
  if (!value) return '';
  const asString = String(value || '').trim();
  if (!asString) return '';
  const parsed = new Date(asString.includes('T') ? asString : `${asString.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number) {
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function formatList(raw: unknown): string {
  if (!Array.isArray(raw)) {
    return '';
  }

  return raw
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(', ');
}

function buildAnamnesisSummary(anamnesis: SignupAnamnesis | undefined): string {
  if (!anamnesis || typeof anamnesis !== 'object') {
    return '';
  }

  const parts = [
    `Tratamiento medico: ${String(anamnesis.tratamientoMedico || 'No informado').trim()}`,
    `Lesiones/limitaciones: ${String(anamnesis.lesionesLimitaciones || 'No informado').trim()}`,
    `Medicacion: ${String(anamnesis.medicacionRegular || 'No informado').trim()}`,
    `Cirugias ultimos 2 anos: ${String(anamnesis.cirugiasRecientes || 'No informado').trim()}`,
    `Antecedentes clinicos: ${String(anamnesis.antecedentesClinicos || 'No informado').trim()}`,
    `Autorizacion medica: ${String(anamnesis.autorizacionMedica || 'No informado').trim()}`,
    `Experiencia entrenando: ${String(anamnesis.experienciaEntrenamiento || 'No informado').trim()}`,
    `Alimentacion actual: ${formatList(anamnesis.alimentacionActual) || 'No informado'}`,
    anamnesis.alimentacionDetalle
      ? `Detalle alimentacion: ${String(anamnesis.alimentacionDetalle).trim()}`
      : '',
    `Desorden alimentario: ${String(anamnesis.desordenAlimentario || 'No informado').trim()}`,
    `Alcohol/cigarrillos/sustancias: ${String(anamnesis.consumoSustancias || 'No informado').trim()}`,
    `Suplementos: ${String(anamnesis.suplementos || 'No informado').trim()}`,
    `Interes de entrenamiento: ${formatList(anamnesis.interesEntrenamiento) || 'No informado'}`,
    anamnesis.interesDetalle
      ? `Detalle interes: ${String(anamnesis.interesDetalle).trim()}`
      : '',
    `Compromiso: ${Number.isFinite(Number(anamnesis.compromisoObjetivo)) ? String(anamnesis.compromisoObjetivo) : 'No informado'}`,
    `Origen de contacto: ${formatList(anamnesis.origenContacto) || 'No informado'}`,
    anamnesis.origenDetalle
      ? `Detalle origen: ${String(anamnesis.origenDetalle).trim()}`
      : '',
    `Declaracion aceptada: ${String(anamnesis.consentimientoSalud || 'No').trim().toUpperCase() === 'SI' ? 'SI' : 'NO'}`,
  ]
    .map((line) => line.trim())
    .filter(Boolean);

  return parts.join(' | ');
}

function buildDefaultMeta(input: { email: string; telefono: string; categoria: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    apellido: '',
    segundoApellido: '',
    email: input.email,
    codigoPais: 'Argentina',
    telefono: input.telefono,
    pais: 'Argentina',
    provincia: '',
    calle: '',
    numero: '',
    piso: '',
    depto: '',
    sexo: 'femenino',
    startDate: today,
    endDate: addDays(today, 30),
    lastCheck: 'PENDIENTE DE ALTA',
    nextCheck: 'PENDIENTE DE ALTA',
    objNutricional: 'SIN DATOS',
    colaboradores: 'Pendiente de asignacion',
    chats: 'Pendiente de asignacion',
    tipoAsesoria: 'entrenamiento',
    modalidad: 'presencial',
    categoriaPlan: input.categoria,
    pagoEstado: 'pendiente',
    moneda: 'ARS',
    importe: '0',
    saldo: '0',
    emailPagador: input.email,
    autoRenewPlan: false,
    renewalDays: 30,
    tabNotas: {},
  };
}

async function syncVerifiedAlumnoToClientes(email: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return;

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      email: true,
      nombreCompleto: true,
      fechaNacimiento: true,
      altura: true,
      telefono: true,
    },
  });

  if (!user) return;

  const profileRaw = await getSyncValue(SIGNUP_PROFILES_KEY);
  const profileMap =
    profileRaw && typeof profileRaw === 'object'
      ? (profileRaw as Record<string, SignupProfile>)
      : {};
  const profile = profileMap[normalizedEmail] || {};

  const nombreFromParts = `${String(profile.nombre || '').trim()} ${String(profile.apellido || '').trim()}`
    .trim()
    .replace(/\s+/g, ' ');
  const nombre = String(profile.nombreCompleto || nombreFromParts || user.nombreCompleto || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!nombre) {
    return;
  }

  const fechaNacimiento = formatDateOnly(profile.fechaNacimiento || user.fechaNacimiento);
  const altura = String(profile.altura || (Number(user.altura || 0) > 0 ? user.altura : '') || '').trim();
  const peso = String(profile.peso || '').trim();
  const club = String(profile.club || '').trim();
  const objetivo = String(profile.objetivo || '').trim();
  const telefono = String(profile.telefono || user.telefono || '').trim();
  const categoria = String(profile.categoria || '').trim();
  const extraObs = String(profile.observaciones || '').trim();
  const anamnesisSummary = buildAnamnesisSummary(profile.anamnesis);
  const observaciones = [
    'Cuenta verificada. Pendiente de alta del profesor.',
    extraObs,
    anamnesisSummary ? `Anamnesis: ${anamnesisSummary}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const alumnosRaw = await getSyncValue(ALUMNOS_KEY);
  const alumnos = Array.isArray(alumnosRaw) ? [...alumnosRaw] : [];

  const nextAlumno = {
    nombre,
    estado: 'activo',
    fechaNacimiento: fechaNacimiento || undefined,
    altura: altura || undefined,
    peso: peso || undefined,
    club: club || undefined,
    objetivo: objetivo || undefined,
    observaciones: observaciones || undefined,
    practicaDeporte: Boolean(profile.practicaDeporte),
  };

  const existingAlumnoIndex = alumnos.findIndex((item: any) => normalizeName(item?.nombre) === normalizeName(nombre));
  if (existingAlumnoIndex >= 0) {
    alumnos[existingAlumnoIndex] = {
      ...(alumnos[existingAlumnoIndex] as Record<string, unknown>),
      ...nextAlumno,
    };
  } else {
    alumnos.unshift(nextAlumno);
  }

  await setSyncValue(ALUMNOS_KEY, alumnos);

  const metaRaw = await getSyncValue(CLIENTES_META_KEY);
  const metaMap =
    metaRaw && typeof metaRaw === 'object'
      ? ({ ...(metaRaw as Record<string, Record<string, unknown>>) })
      : {};

  const metaKey = `alumno:${nombre}`;
  const previousMeta =
    metaMap[metaKey] && typeof metaMap[metaKey] === 'object'
      ? (metaMap[metaKey] as Record<string, unknown>)
      : {};

  const previousTabNotas =
    previousMeta.tabNotas && typeof previousMeta.tabNotas === 'object'
      ? (previousMeta.tabNotas as Record<string, unknown>)
      : {};

  metaMap[metaKey] = {
    ...buildDefaultMeta({
      email: normalizedEmail,
      telefono,
      categoria,
    }),
    ...previousMeta,
    email: normalizedEmail,
    telefono: telefono || String(previousMeta.telefono || ''),
    categoriaPlan: categoria || String(previousMeta.categoriaPlan || ''),
    pagoEstado: String(previousMeta.pagoEstado || 'pendiente'),
    lastCheck: String(previousMeta.lastCheck || 'PENDIENTE DE ALTA'),
    nextCheck: String(previousMeta.nextCheck || 'PENDIENTE DE ALTA'),
    colaboradores: String(previousMeta.colaboradores || 'Pendiente de asignacion'),
    chats: String(previousMeta.chats || 'Pendiente de asignacion'),
    tabNotas: {
      ...previousTabNotas,
      cuestionario:
        anamnesisSummary ||
        String(previousTabNotas.cuestionario || ''),
    },
  };

  await setSyncValue(CLIENTES_META_KEY, metaMap);
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { message: 'Token requerido' },
        { status: 400 }
      );
    }

    // Verify token
    const verificationToken = await verifyToken(token);

    if (!verificationToken) {
      return NextResponse.json(
        { message: 'Token inválido o expirado' },
        { status: 400 }
      );
    }

    // Update user as verified
    const verifiedUser = await db.user.update({
      where: { email: verificationToken.email },
      data: { emailVerified: true },
      select: {
        email: true,
        role: true,
      },
    });

    if (verifiedUser.role === 'CLIENTE') {
      await syncVerifiedAlumnoToClientes(verifiedUser.email).catch((error) => {
        console.error('Verify sync error:', error);
      });
    }

    // Delete verification token
    await db.verificationToken.delete({
      where: { token },
    });

    return NextResponse.json(
      { message: 'Mail verificado. Tu cuenta quedo pendiente de alta del profesor.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { message: 'Error al verificar email' },
      { status: 500 }
    );
  }
}
