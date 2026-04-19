import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { filterOperationalUsers, isTestAccountEmail } from '@/lib/operationalUsers';
import { sendClienteAltaAprobadaEmail } from '@/lib/email';
import { getSyncValue, setSyncValue } from '@/lib/syncStore';
import { getClientPasswordMap, type ClientPasswordSnapshot } from '@/lib/adminPasswordStore';

const db = prisma as any;
const SIGNUP_PROFILES_KEY = 'pf-control-signup-profiles-v1';
const ALUMNOS_KEY = 'pf-control-alumnos';
const CLIENTES_META_KEY = 'pf-control-clientes-meta-v1';
const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  estado: true,
  nombreCompleto: true,
  edad: true,
  fechaNacimiento: true,
  altura: true,
  telefono: true,
  direccion: true,
  emailVerified: true,
  createdAt: true,
} as const;

type AdminUserRecord = {
  id: string;
  email: string;
  role: 'ADMIN' | 'COLABORADOR' | 'CLIENTE';
  estado: string;
  nombreCompleto: string;
  edad: number | null;
  fechaNacimiento: Date | null;
  altura: number | null;
  telefono: string | null;
  direccion: string | null;
  emailVerified: boolean;
  createdAt: Date;
};

type SignupProfileLite = {
  nombre?: string;
  apellido?: string;
  nombreCompleto?: string;
  altura?: string | number;
  peso?: string | number;
  telefono?: string;
  fechaNacimiento?: string;
  club?: string;
  objetivo?: string;
  observaciones?: string;
  practicaDeporte?: boolean;
  deporte?: string;
  categoria?: string;
  posicion?: string;
};

type ClienteMetaSync = Record<string, unknown> & {
  email?: string;
  telefono?: string;
  categoriaPlan?: string;
  nextCheck?: string;
  tabNotas?: Record<string, unknown>;
};

function normalizeNameKey(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
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
    lastCheck: 'ALTA CONFIRMADA',
    nextCheck: addDays(today, 30),
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

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
  }
  return false;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function mapRawAdminUser(row: Record<string, unknown>): AdminUserRecord {
  const roleRaw = String(row.role || 'CLIENTE').toUpperCase();
  const role = ['ADMIN', 'COLABORADOR', 'CLIENTE'].includes(roleRaw)
    ? (roleRaw as AdminUserRecord['role'])
    : 'CLIENTE';

  return {
    id: String(row.id || ''),
    email: String(row.email || ''),
    role,
    estado: String(row.estado || 'activo'),
    nombreCompleto: String(row.nombreCompleto || 'Sin nombre'),
    edad: toNullableNumber(row.edad),
    fechaNacimiento: toDate(row.fechaNacimiento),
    altura: toNullableNumber(row.altura),
    telefono: row.telefono == null ? null : String(row.telefono),
    direccion: row.direccion == null ? null : String(row.direccion),
    emailVerified: toBoolean(row.emailVerified),
    createdAt: toDate(row.createdAt) || new Date(0),
  };
}

function isPrismaConversionError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2023'
  );
}

async function findManyAdminUsersSafe(): Promise<AdminUserRecord[]> {
  try {
    return await db.user.findMany({
      select: ADMIN_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    if (!isPrismaConversionError(error)) {
      throw error;
    }

    console.warn('[admin/users] Prisma P2023 detectado. Usando fallback SQL seguro.');

    const rawRows = (await db.$queryRawUnsafe(`
      SELECT
        id,
        email,
        role,
        estado,
        nombreCompleto,
        CAST(edad AS TEXT) AS edad,
        CAST(fechaNacimiento AS TEXT) AS fechaNacimiento,
        CAST(altura AS TEXT) AS altura,
        telefono,
        direccion,
        CAST(emailVerified AS TEXT) AS emailVerified,
        CAST(createdAt AS TEXT) AS createdAt
      FROM users
      ORDER BY createdAt DESC
    `)) as Array<Record<string, unknown>>;

    return rawRows.map(mapRawAdminUser);
  }
}

async function findAdminUserByIdSafe(userId: string): Promise<AdminUserRecord | null> {
  try {
    return await db.user.findUnique({
      where: { id: userId },
      select: ADMIN_USER_SELECT,
    });
  } catch (error) {
    if (!isPrismaConversionError(error)) {
      throw error;
    }

    console.warn('[admin/users] Prisma P2023 al leer usuario. Usando fallback SQL seguro.');

    const rawRows = (await db.$queryRawUnsafe(
      `
        SELECT
          id,
          email,
          role,
          estado,
          nombreCompleto,
          CAST(edad AS TEXT) AS edad,
          CAST(fechaNacimiento AS TEXT) AS fechaNacimiento,
          CAST(altura AS TEXT) AS altura,
          telefono,
          direccion,
          CAST(emailVerified AS TEXT) AS emailVerified,
          CAST(createdAt AS TEXT) AS createdAt
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      userId
    )) as Array<Record<string, unknown>>;

    if (rawRows.length === 0) {
      return null;
    }

    return mapRawAdminUser(rawRows[0]);
  }
}

async function syncClienteAltaToModules(user: AdminUserRecord, profileMap: Record<string, unknown>) {
  const email = normalizeEmail(user.email);
  if (!email) return;

  const profileRaw = profileMap[email];
  const profile =
    profileRaw && typeof profileRaw === 'object'
      ? (profileRaw as SignupProfileLite)
      : ({} as SignupProfileLite);

  const nombreFromParts = `${String(profile.nombre || '').trim()} ${String(profile.apellido || '').trim()}`
    .trim()
    .replace(/\s+/g, ' ');
  const nombre = String(profile.nombreCompleto || nombreFromParts || user.nombreCompleto || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!nombre) return;

  const fechaNacimiento = formatDateOnly(profile.fechaNacimiento || user.fechaNacimiento);
  const altura = String(profile.altura || (Number(user.altura || 0) > 0 ? user.altura : '') || '').trim();
  const peso = String(profile.peso || '').trim();
  const club = String(profile.club || '').trim();
  const objetivo = String(profile.objetivo || '').trim();
  const telefono = String(profile.telefono || user.telefono || '').trim();
  const categoria = String(profile.categoria || '').trim();
  const observacionesExtra = String(profile.observaciones || '').trim();

  const alumnosRaw = await getSyncValue(ALUMNOS_KEY);
  const alumnos = Array.isArray(alumnosRaw)
    ? [...(alumnosRaw as Array<Record<string, unknown>>)]
    : [];

  const metaRaw = await getSyncValue(CLIENTES_META_KEY);
  const metaMap =
    metaRaw && typeof metaRaw === 'object'
      ? ({ ...(metaRaw as Record<string, ClienteMetaSync>) })
      : {};

  const existingMetaEntry = Object.entries(metaMap).find(
    ([metaKey, value]) =>
      metaKey.startsWith('alumno:') && normalizeEmail((value as ClienteMetaSync)?.email) === email
  );
  const existingMetaKey = existingMetaEntry?.[0] || null;
  const existingMetaByEmail =
    existingMetaEntry && typeof existingMetaEntry[1] === 'object'
      ? (existingMetaEntry[1] as ClienteMetaSync)
      : ({} as ClienteMetaSync);

  const nombreDesdeMetaKey = existingMetaKey
    ? String(existingMetaKey.slice('alumno:'.length) || '').trim()
    : '';

  let existingAlumnoIndex = alumnos.findIndex(
    (item) => normalizeNameKey(String(item?.nombre || '')) === normalizeNameKey(nombre)
  );

  if (existingAlumnoIndex < 0 && nombreDesdeMetaKey) {
    existingAlumnoIndex = alumnos.findIndex(
      (item) => normalizeNameKey(String(item?.nombre || '')) === normalizeNameKey(nombreDesdeMetaKey)
    );
  }

  const previousAlumno =
    existingAlumnoIndex >= 0 && typeof alumnos[existingAlumnoIndex] === 'object'
      ? (alumnos[existingAlumnoIndex] as Record<string, unknown>)
      : {};

  const previousObs = String(previousAlumno.observaciones || '').trim();
  const nextObs = observacionesExtra
    ? previousObs.includes(observacionesExtra)
      ? previousObs
      : [previousObs, observacionesExtra].filter(Boolean).join(' | ')
    : previousObs;

  const nextAlumno: Record<string, unknown> = {
    ...previousAlumno,
    nombre,
    estado: 'activo',
    fechaNacimiento: fechaNacimiento || String(previousAlumno.fechaNacimiento || ''),
    altura: altura || String(previousAlumno.altura || ''),
    peso: peso || String(previousAlumno.peso || ''),
    club: club || String(previousAlumno.club || ''),
    objetivo: objetivo || String(previousAlumno.objetivo || ''),
    observaciones: nextObs || undefined,
    practicaDeporte: Boolean(profile.practicaDeporte || previousAlumno.practicaDeporte || false),
  };

  if (String(profile.deporte || '').trim()) {
    nextAlumno.deporte = String(profile.deporte || '').trim();
  }
  if (String(profile.categoria || '').trim()) {
    nextAlumno.categoria = String(profile.categoria || '').trim();
  }
  if (String(profile.posicion || '').trim()) {
    nextAlumno.posicion = String(profile.posicion || '').trim();
  }

  if (existingAlumnoIndex >= 0) {
    alumnos[existingAlumnoIndex] = nextAlumno;
  } else {
    alumnos.unshift(nextAlumno);
  }

  await setSyncValue(ALUMNOS_KEY, alumnos);

  const targetMetaKey = `alumno:${nombre}`;
  const previousMeta =
    metaMap[targetMetaKey] && typeof metaMap[targetMetaKey] === 'object'
      ? (metaMap[targetMetaKey] as ClienteMetaSync)
      : existingMetaByEmail;

  const previousTabNotas =
    previousMeta.tabNotas && typeof previousMeta.tabNotas === 'object'
      ? { ...(previousMeta.tabNotas as Record<string, unknown>) }
      : {};

  const today = new Date().toISOString().slice(0, 10);

  metaMap[targetMetaKey] = {
    ...buildDefaultMeta({
      email,
      telefono,
      categoria,
    }),
    ...previousMeta,
    email,
    telefono: telefono || String(previousMeta.telefono || ''),
    categoriaPlan: categoria || String(previousMeta.categoriaPlan || ''),
    lastCheck: 'ALTA CONFIRMADA',
    nextCheck: String(previousMeta.nextCheck || addDays(today, 30)),
    tabNotas: {
      ...previousTabNotas,
    },
  };

  if (existingMetaKey && existingMetaKey !== targetMetaKey) {
    delete metaMap[existingMetaKey];
  }

  await setSyncValue(CLIENTES_META_KEY, metaMap);
}

async function loadSignupProfiles() {
  const raw = await getSyncValue(SIGNUP_PROFILES_KEY);
  if (!raw || typeof raw !== 'object') {
    return {} as Record<string, unknown>;
  }

  return raw as Record<string, unknown>;
}

function attachSignupProfile<T extends { email?: string | null }>(
  users: T[],
  profileMap: Record<string, unknown>
) {
  return users.map((user) => {
    const email = String(user.email || '').trim().toLowerCase();
    return {
      ...user,
      signupProfile: email ? profileMap[email] || null : null,
    };
  });
}

function attachAdminPassword<T extends { id?: string | null; role?: string | null }>(
  users: T[],
  passwordMap: Record<string, ClientPasswordSnapshot>
) {
  return users.map((user) => {
    const userId = String(user.id || '').trim();
    const role = String(user.role || '').trim().toUpperCase();
    const snapshot = userId && role === 'CLIENTE' ? passwordMap[userId] || null : null;

    return {
      ...user,
      passwordAdmin: snapshot
        ? {
            visiblePassword: snapshot.visiblePassword,
            source: snapshot.source,
            updatedAt: snapshot.updatedAt,
            updatedByRole: snapshot.updatedByRole,
            updatedByEmail: snapshot.updatedByEmail,
          }
        : null,
    };
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'No autorizado' },
      { status: 401 }
    );
  }

  const users = await findManyAdminUsersSafe();

  const profileMap = await loadSignupProfiles();
  const passwordMap = await getClientPasswordMap();
  const operationalUsers = filterOperationalUsers(users);
  const withSignupProfile = attachSignupProfile(operationalUsers, profileMap);
  return NextResponse.json(attachAdminPassword(withSignupProfile, passwordMap));
}

export async function PUT(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'No autorizado' },
      { status: 401 }
    );
  }

  try {
    const { userId, role, estado } = await req.json();
    const safeUserId = String(userId || '').trim();

    const hasRole = typeof role === 'string' && role.length > 0;
    const hasEstado = typeof estado === 'string' && estado.length > 0;

    if (!safeUserId || (!hasRole && !hasEstado)) {
      return NextResponse.json(
        { message: 'Datos inválidos' },
        { status: 400 }
      );
    }

    const previousUser = await findAdminUserByIdSafe(safeUserId);
    if (!previousUser) {
      return NextResponse.json(
        { message: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (hasRole && !['ADMIN', 'COLABORADOR', 'CLIENTE'].includes(role)) {
      return NextResponse.json(
        { message: 'Rol invalido' },
        { status: 400 }
      );
    }

    if (hasEstado && !['activo', 'suspendido', 'baja', 'pendiente_alta'].includes(String(estado))) {
      return NextResponse.json(
        { message: 'Estado invalido' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (hasRole) {
      updateData.role = role;
    }
    if (hasEstado) {
      updateData.estado = estado;
    }

    await db.user.update({
      where: { id: safeUserId },
      data: updateData,
      select: { id: true },
    });

    const user = await findAdminUserByIdSafe(safeUserId);
    if (!user) {
      return NextResponse.json(
        { message: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const previousEstado = String(previousUser.estado || '').trim().toLowerCase();
    const currentEstado = String(user.estado || '').trim().toLowerCase();
    const becameActive = currentEstado === 'activo' && previousEstado !== 'activo';

    if (user.role === 'CLIENTE' && currentEstado === 'activo') {
      const profileMap = await loadSignupProfiles();

      await syncClienteAltaToModules(user, profileMap).catch((syncError) => {
        console.error('Admin alta sync error:', syncError);
      });

      if (becameActive) {
        await sendClienteAltaAprobadaEmail(user.email, user.nombreCompleto).catch((mailError) => {
          console.error('Admin alta mail error:', mailError);
        });
      }
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { message: 'Error al actualizar usuario' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'No autorizado' },
      { status: 401 }
    );
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { message: 'userId requerido' },
        { status: 400 }
      );
    }

    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { message: 'Error al eliminar usuario' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'No autorizado' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.cleanupTestAccounts) {
      return NextResponse.json(
        { message: 'Operacion no soportada' },
        { status: 400 }
      );
    }

    const users = await db.user.findMany({
      select: { id: true, email: true },
    });

    const currentUserId = String((session.user as any).id || '');
    const toDeleteIds = users
      .filter((user: { id: string; email?: string | null }) => isTestAccountEmail(user.email))
      .map((user: { id: string }) => user.id)
      .filter((id: string) => id !== currentUserId);

    let deletedCount = 0;
    if (toDeleteIds.length > 0) {
      const result = await db.user.deleteMany({
        where: {
          id: { in: toDeleteIds },
        },
      });
      deletedCount = result.count;
    }

    const remainingUsers = await findManyAdminUsersSafe();

    const profileMap = await loadSignupProfiles();
    const passwordMap = await getClientPasswordMap();

    return NextResponse.json({
      message: `Se eliminaron ${deletedCount} cuentas de prueba`,
      deletedCount,
      users: attachAdminPassword(
        attachSignupProfile(filterOperationalUsers(remainingUsers), profileMap),
        passwordMap
      ),
    });
  } catch (error) {
    console.error('Cleanup test users error:', error);
    return NextResponse.json(
      { message: 'Error al limpiar cuentas de prueba' },
      { status: 500 }
    );
  }
}
