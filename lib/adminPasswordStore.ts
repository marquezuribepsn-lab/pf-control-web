import { getSyncValue, setSyncValue } from "@/lib/syncStore";

export const ADMIN_CLIENT_PASSWORDS_KEY = "pf-control-admin-client-passwords-v1";

export type ClientPasswordSource =
  | "register"
  | "admin_reset"
  | "account_change"
  | "password_reset";

/**
 * Snapshot de auditoría de contraseña de un alumno.
 *
 * IMPORTANTE: por seguridad ya NO se almacena la contraseña en texto plano.
 * Sólo se guarda metadata (cuándo, por quién y a través de qué flujo cambió).
 * Para entregarle la clave a un alumno, el admin debe blanquearla: el endpoint
 * de blanqueo devuelve la nueva contraseña una sola vez en su respuesta.
 */
export type ClientPasswordSnapshot = {
  userId: string;
  email: string;
  source: ClientPasswordSource;
  updatedAt: string;
  updatedByRole: string;
  updatedByEmail: string | null;
};

type PasswordMap = Record<string, ClientPasswordSnapshot>;

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value: unknown): string {
  return String(value || "").trim().toUpperCase() || "SYSTEM";
}

export async function getClientPasswordMap(): Promise<PasswordMap> {
  const raw = await getSyncValue(ADMIN_CLIENT_PASSWORDS_KEY);
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const source = raw as Record<string, unknown>;
  const map: PasswordMap = {};

  for (const [userId, value] of Object.entries(source)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const row = value as Record<string, unknown>;
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedUserId) {
      continue;
    }

    // Nota: se ignora intencionalmente `row.visiblePassword` de datos antiguos;
    // no se vuelve a exponer ni a re-escribir.
    map[normalizedUserId] = {
      userId: normalizedUserId,
      email: normalizeEmail(row.email),
      source: (String(row.source || "register").trim().toLowerCase() || "register") as ClientPasswordSource,
      updatedAt: String(row.updatedAt || nowIso()),
      updatedByRole: normalizeRole(row.updatedByRole),
      updatedByEmail: normalizeEmail(row.updatedByEmail) || null,
    };
  }

  return map;
}

/**
 * Registra metadata del cambio de contraseña de un alumno.
 * Acepta `visiblePassword` por compatibilidad con los llamadores existentes,
 * pero NO la persiste (se descarta).
 */
export async function upsertClientPasswordSnapshot(input: {
  userId: string;
  email: string;
  visiblePassword?: string;
  source: ClientPasswordSource;
  updatedByRole?: string;
  updatedByEmail?: string | null;
}): Promise<ClientPasswordSnapshot | null> {
  const userId = String(input.userId || "").trim();
  const email = normalizeEmail(input.email);

  if (!userId || !email) {
    return null;
  }

  const map = await getClientPasswordMap();
  const snapshot: ClientPasswordSnapshot = {
    userId,
    email,
    source: input.source,
    updatedAt: nowIso(),
    updatedByRole: normalizeRole(input.updatedByRole || "SYSTEM"),
    updatedByEmail: normalizeEmail(input.updatedByEmail) || null,
  };

  map[userId] = snapshot;
  // setSyncValue reescribe el mapa completo a partir de getClientPasswordMap(),
  // que ya descarta cualquier `visiblePassword` antiguo: esto purga el texto
  // plano remanente a medida que se actualiza cada alumno.
  await setSyncValue(ADMIN_CLIENT_PASSWORDS_KEY, map);
  return snapshot;
}

export async function getClientPasswordSnapshotByUserId(
  userId: string
): Promise<ClientPasswordSnapshot | null> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;

  const map = await getClientPasswordMap();
  return map[normalizedUserId] || null;
}

/** Elimina el snapshot de un usuario (usado al borrar la cuenta). */
export async function removeClientPasswordSnapshot(userId: string): Promise<boolean> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return false;

  const map = await getClientPasswordMap();
  if (!map[normalizedUserId]) return false;

  delete map[normalizedUserId];
  await setSyncValue(ADMIN_CLIENT_PASSWORDS_KEY, map);
  return true;
}
