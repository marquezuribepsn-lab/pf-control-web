import { prisma } from "@/lib/prisma";

const db = prisma as any;

/**
 * Visibilidad de alumnos por colaborador (enforcement REAL de
 * `puedeVerTodosAlumnos`, server-side, en la capa de datos).
 *
 * Diseño: el roster de alumnos vive en blobs COMPARTIDOS que se reescriben
 * enteros desde el cliente. Filtrar sólo en lectura sería peligroso: el primer
 * guardado del colaborador borraría a los alumnos ocultos. Por eso:
 *   - GET  -> se filtra el blob a los alumnos asignados.
 *   - PUT  -> se hace MERGE contra el blob completo guardado, preservando a los
 *             alumnos ocultos y aplicando sólo los cambios sobre los visibles.
 *
 * Clave de matcheo: `email` (estable, presente en clientes-meta) con respaldo
 * por `nombre` (única opción para el roster, que no guarda email/id).
 */

export const ROSTER_KEY = "pf-control-alumnos";
export const CLIENTES_META_KEY = "pf-control-clientes-meta-v1";

/** Keys cuya lectura/escritura se acota por asignaciones del colaborador. */
export const ALUMNO_SCOPED_KEYS = new Set<string>([ROSTER_KEY, CLIENTES_META_KEY]);

export type AlumnoScope = {
  emails: Set<string>;
  names: Set<string>;
};

function normEmail(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

function normName(v: unknown): string {
  return String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Nombre embebido en la key de clientes-meta: "alumno:<nombre>". */
function nameFromMetaKey(key: string): string {
  const raw = String(key || "");
  const idx = raw.indexOf(":");
  return idx >= 0 ? raw.slice(idx + 1) : raw;
}

/**
 * Conjunto de alumnos asignados a un colaborador, leído de AlumnoAsignado.
 * Devuelve emails y nombres normalizados para matchear contra los blobs.
 */
export async function getColaboradorAlumnoScope(colaboradorId: string): Promise<AlumnoScope> {
  const scope: AlumnoScope = { emails: new Set(), names: new Set() };
  try {
    const rows = await db.alumnoAsignado.findMany({
      where: { colaboradorId },
      select: { alumno: { select: { email: true, nombreCompleto: true } } },
    });
    for (const row of rows) {
      const email = normEmail(row?.alumno?.email);
      const name = normName(row?.alumno?.nombreCompleto);
      if (email) scope.emails.add(email);
      if (name) scope.names.add(name);
    }
  } catch {
    // Fail-closed: ante error devolvemos scope vacío (no ve a nadie),
    // que es el default seguro para un control de visibilidad.
  }
  return scope;
}

/** ¿La entrada de clientes-meta corresponde a un alumno visible? */
function metaEntryVisible(key: string, value: unknown, scope: AlumnoScope): boolean {
  const email = normEmail(toRecord(value).email);
  if (email && scope.emails.has(email)) return true;
  // Respaldo por nombre (roster/clientes-meta no siempre tienen email).
  return scope.names.has(normName(nameFromMetaKey(key)));
}

/** ¿La entrada del roster (array) corresponde a un alumno visible? */
function rosterEntryVisible(entry: unknown, scope: AlumnoScope): boolean {
  const rec = toRecord(entry);
  const email = normEmail(rec.email);
  if (email && scope.emails.has(email)) return true;
  return scope.names.has(normName(rec.nombre));
}

/** Filtra un blob (roster o clientes-meta) a los alumnos asignados. */
export function filterScopedValueForRead(key: string, value: unknown, scope: AlumnoScope): unknown {
  if (key === CLIENTES_META_KEY) {
    const record = toRecord(value);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      if (metaEntryVisible(k, v, scope)) result[k] = v;
    }
    return result;
  }

  if (key === ROSTER_KEY) {
    return toArray(value).filter((entry) => rosterEntryVisible(entry, scope));
  }

  return value;
}

/**
 * Combina la escritura parcial de un colaborador (sólo ve a sus asignados)
 * con el blob completo guardado, preservando a los alumnos ocultos.
 * Impide además crear/modificar alumnos fuera del scope.
 */
export function mergeScopedValueForWrite(
  key: string,
  existing: unknown,
  incoming: unknown,
  scope: AlumnoScope
): unknown {
  if (key === CLIENTES_META_KEY) {
    const existingRec = toRecord(existing);
    const incomingRec = toRecord(incoming);
    const result: Record<string, unknown> = { ...existingRec };

    // Aplica cambios sólo sobre entradas visibles del payload entrante.
    for (const [k, v] of Object.entries(incomingRec)) {
      if (metaEntryVisible(k, v, scope)) result[k] = v;
    }

    // Borrados: si una entrada visible existía y el colaborador la quitó.
    for (const [k, v] of Object.entries(existingRec)) {
      if (metaEntryVisible(k, v, scope) && !(k in incomingRec)) {
        delete result[k];
      }
    }

    return result;
  }

  if (key === ROSTER_KEY) {
    const hidden = toArray(existing).filter((entry) => !rosterEntryVisible(entry, scope));
    const visibleIncoming = toArray(incoming).filter((entry) => rosterEntryVisible(entry, scope));
    return [...hidden, ...visibleIncoming];
  }

  return incoming;
}
