import { getSyncValue, setSyncValue } from "@/lib/syncStore";

export const PUSH_TOKENS_KEY = "pf-control-push-tokens-v1";

export type PushPlatform = "ios" | "android" | "web" | "unknown";

export type PushTokenRecord = {
  token: string;
  platform: PushPlatform;
  updatedAt: string;
};

// Mapa userId -> lista de tokens (un usuario puede tener varios dispositivos).
type PushTokenMap = Record<string, PushTokenRecord[]>;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizePlatform(value: unknown): PushPlatform {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ios" || normalized === "android" || normalized === "web") {
    return normalized;
  }
  return "unknown";
}

/** Valida el formato de un Expo push token. */
export function isValidExpoPushToken(value: unknown): boolean {
  const token = String(value || "").trim();
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

async function readMap(): Promise<PushTokenMap> {
  const raw = await getSyncValue(PUSH_TOKENS_KEY);
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const source = raw as Record<string, unknown>;
  const map: PushTokenMap = {};

  for (const [userId, value] of Object.entries(source)) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || !Array.isArray(value)) {
      continue;
    }

    const records: PushTokenRecord[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const token = String(row.token || "").trim();
      if (!isValidExpoPushToken(token)) continue;

      records.push({
        token,
        platform: normalizePlatform(row.platform),
        updatedAt: String(row.updatedAt || nowIso()),
      });
    }

    if (records.length > 0) {
      map[normalizedUserId] = records;
    }
  }

  return map;
}

/**
 * Guarda (o actualiza) un token para un usuario. Si el token ya existía para
 * otro usuario, lo migra al usuario actual (mismo dispositivo, distinta sesión).
 */
export async function upsertPushToken(input: {
  userId: string;
  token: string;
  platform: unknown;
}): Promise<PushTokenRecord | null> {
  const userId = String(input.userId || "").trim();
  const token = String(input.token || "").trim();

  if (!userId || !isValidExpoPushToken(token)) {
    return null;
  }

  const map = await readMap();

  // Quitar este token de cualquier otro usuario (el dispositivo cambió de dueño).
  for (const [otherUserId, records] of Object.entries(map)) {
    if (otherUserId === userId) continue;
    const filtered = records.filter((record) => record.token !== token);
    if (filtered.length !== records.length) {
      if (filtered.length > 0) {
        map[otherUserId] = filtered;
      } else {
        delete map[otherUserId];
      }
    }
  }

  const record: PushTokenRecord = {
    token,
    platform: normalizePlatform(input.platform),
    updatedAt: nowIso(),
  };

  const existing = map[userId] || [];
  const withoutDuplicate = existing.filter((entry) => entry.token !== token);
  map[userId] = [...withoutDuplicate, record];

  await setSyncValue(PUSH_TOKENS_KEY, map);
  return record;
}

/** Devuelve los tokens registrados para un usuario. */
export async function getPushTokensForUser(userId: string): Promise<PushTokenRecord[]> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return [];

  const map = await readMap();
  return map[normalizedUserId] || [];
}

/** Elimina un token puntual (p. ej. al cerrar sesión o si Expo lo marca inválido). */
export async function removePushToken(token: string): Promise<boolean> {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return false;

  const map = await readMap();
  let changed = false;

  for (const [userId, records] of Object.entries(map)) {
    const filtered = records.filter((record) => record.token !== normalizedToken);
    if (filtered.length !== records.length) {
      changed = true;
      if (filtered.length > 0) {
        map[userId] = filtered;
      } else {
        delete map[userId];
      }
    }
  }

  if (changed) {
    await setSyncValue(PUSH_TOKENS_KEY, map);
  }

  return changed;
}

/** Elimina todos los tokens de un usuario (usado al borrar la cuenta). */
export async function removeAllPushTokensForUser(userId: string): Promise<boolean> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return false;

  const map = await readMap();
  if (!map[normalizedUserId]) return false;

  delete map[normalizedUserId];
  await setSyncValue(PUSH_TOKENS_KEY, map);
  return true;
}
