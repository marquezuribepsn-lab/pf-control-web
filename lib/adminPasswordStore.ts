import { getSyncValue, setSyncValue } from "@/lib/syncStore";

export const ADMIN_CLIENT_PASSWORDS_KEY = "pf-control-admin-client-passwords-v1";

export type ClientPasswordSource =
  | "register"
  | "admin_reset"
  | "account_change"
  | "password_reset";

export type ClientPasswordSnapshot = {
  userId: string;
  email: string;
  visiblePassword: string;
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

function normalizePassword(value: unknown): string {
  return String(value || "").normalize("NFKC").trim();
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
    const visiblePassword = normalizePassword(row.visiblePassword);

    if (!normalizedUserId || !visiblePassword) {
      continue;
    }

    map[normalizedUserId] = {
      userId: normalizedUserId,
      email: normalizeEmail(row.email),
      visiblePassword,
      source: (String(row.source || "register").trim().toLowerCase() || "register") as ClientPasswordSource,
      updatedAt: String(row.updatedAt || nowIso()),
      updatedByRole: normalizeRole(row.updatedByRole),
      updatedByEmail: normalizeEmail(row.updatedByEmail) || null,
    };
  }

  return map;
}

export async function upsertClientPasswordSnapshot(input: {
  userId: string;
  email: string;
  visiblePassword: string;
  source: ClientPasswordSource;
  updatedByRole?: string;
  updatedByEmail?: string | null;
}): Promise<ClientPasswordSnapshot | null> {
  const userId = String(input.userId || "").trim();
  const email = normalizeEmail(input.email);
  const visiblePassword = normalizePassword(input.visiblePassword);

  if (!userId || !email || !visiblePassword) {
    return null;
  }

  const map = await getClientPasswordMap();
  const snapshot: ClientPasswordSnapshot = {
    userId,
    email,
    visiblePassword,
    source: input.source,
    updatedAt: nowIso(),
    updatedByRole: normalizeRole(input.updatedByRole || "SYSTEM"),
    updatedByEmail: normalizeEmail(input.updatedByEmail) || null,
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
