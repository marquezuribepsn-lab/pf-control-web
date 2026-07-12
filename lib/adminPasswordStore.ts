import { getSyncValue, setSyncValue } from "@/lib/syncStore";

export const ADMIN_CLIENT_PASSWORDS_KEY = "pf-control-admin-client-passwords-v1";

export type ClientPasswordSource =
  | "register"
  | "admin_reset"
  | "account_change"
  | "password_reset";

/**
 * Snapshot de contraseña de un alumno.
 *
 * `visiblePassword` guarda, SOLO para las contraseñas que define el admin
 * (blanqueo/generación), el texto para que el admin pueda consultarlo luego
 * en la ficha del alumno. Las contraseñas que el alumno elige por su cuenta
 * (registro/cambio propio) NUNCA se guardan en texto: siguen siendo un hash
 * bcrypt irreversible, por lo que su `visiblePassword` queda null.
 */
export type ClientPasswordSnapshot = {
  userId: string;
  email: string;
  source: ClientPasswordSource;
  updatedAt: string;
  updatedByRole: string;
  updatedByEmail: string | null;
  visiblePassword: string | null;
};

/** Flujos en los que la contraseña la define el admin (se puede mostrar). */
const ADMIN_DEFINED_SOURCES: ReadonlySet<ClientPasswordSource> = new Set([
  "admin_reset",
]);

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

    const source = (String(row.source || "register").trim().toLowerCase() || "register") as ClientPasswordSource;
    const rawVisible = typeof row.visiblePassword === "string" ? row.visiblePassword : "";
    // Solo conservamos el texto visible para contraseñas definidas por el admin.
    const visiblePassword = ADMIN_DEFINED_SOURCES.has(source) && rawVisible ? rawVisible : null;

    map[normalizedUserId] = {
      userId: normalizedUserId,
      email: normalizeEmail(row.email),
      source,
      updatedAt: String(row.updatedAt || nowIso()),
      updatedByRole: normalizeRole(row.updatedByRole),
      updatedByEmail: normalizeEmail(row.updatedByEmail) || null,
      visiblePassword,
    };
  }

  return map;
}

/**
 * Registra el cambio de contraseña de un alumno.
 * Si la fuente es un flujo definido por el admin (blanqueo), persiste el
 * texto en `visiblePassword` para que el admin pueda consultarlo luego.
 * En cualquier otro flujo (registro / cambio del propio alumno) NO se guarda
 * texto: se descarta y queda null.
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

  const isAdminDefined = ADMIN_DEFINED_SOURCES.has(input.source);
  const visiblePassword =
    isAdminDefined && typeof input.visiblePassword === "string" && input.visiblePassword
      ? input.visiblePassword
      : null;

  const map = await getClientPasswordMap();
  const snapshot: ClientPasswordSnapshot = {
    userId,
    email,
    source: input.source,
    updatedAt: nowIso(),
    updatedByRole: normalizeRole(input.updatedByRole || "SYSTEM"),
    updatedByEmail: normalizeEmail(input.updatedByEmail) || null,
    visiblePassword,
  };

  map[userId] = snapshot;
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
