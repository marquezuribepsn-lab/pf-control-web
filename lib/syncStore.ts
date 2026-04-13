import { promises as fs } from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";

const STORE_PATH = path.join(process.cwd(), "storage", "sync-store.json");
const LEGACY_STORE_PATH = path.join(process.cwd(), "data", "sync-store.json");
const HAS_DATABASE_URL = Boolean(process.env.DATABASE_URL);

type SyncStore = Record<string, unknown>;

let prismaClientPromise: Promise<PrismaClient | null> | null = null;
let migrationPromise: Promise<void> | null = null;

async function getPrismaClient(): Promise<PrismaClient | null> {
  if (!HAS_DATABASE_URL) {
    return null;
  }

  if (!prismaClientPromise) {
    prismaClientPromise = import("@/lib/prisma")
      .then(({ prisma }) => prisma)
      .catch(() => null);
  }

  return prismaClientPromise;
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    try {
      await fs.access(LEGACY_STORE_PATH);
      const legacyRaw = await fs.readFile(LEGACY_STORE_PATH, "utf-8");
      await fs.writeFile(STORE_PATH, legacyRaw, "utf-8");
      return;
    } catch {
      // legacy file not available
    }

    await fs.writeFile(STORE_PATH, JSON.stringify({}, null, 2), "utf-8");
  }
}

async function readStore(): Promise<SyncStore> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  try {
    return JSON.parse(raw) as SyncStore;
  } catch {
    return {};
  }
}

async function writeStore(store: SyncStore) {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

async function migrateLegacyFileStoreToDbIfNeeded() {
  if (!HAS_DATABASE_URL) {
    return;
  }

  if (!migrationPromise) {
    migrationPromise = (async () => {
      const prisma = await getPrismaClient();
      if (!prisma) {
        return;
      }

      const existingRows = await prisma.syncEntry.count();
      if (existingRows > 0) {
        return;
      }

      const legacyStore = await readStore();
      const entries = Object.entries(legacyStore);
      if (entries.length === 0) {
        return;
      }

      await prisma.$transaction(
        entries.map(([key, value]) =>
          prisma.syncEntry.upsert({
            where: { key },
            update: { value: (value ?? null) as any },
            create: { key, value: (value ?? null) as any },
          })
        )
      );
    })().catch(() => {
      // keep requests working even if migration fails
    });
  }

  await migrationPromise;
}

export function isValidSyncKey(rawKey: string): string | null {
  if (!/^[a-zA-Z0-9-_]+$/.test(rawKey)) {
    return null;
  }
  return rawKey;
}

export async function getSyncValue(key: string): Promise<unknown | null> {
  if (HAS_DATABASE_URL) {
    await migrateLegacyFileStoreToDbIfNeeded();
    const prisma = await getPrismaClient();
    if (prisma) {
      const row = await prisma.syncEntry.findUnique({
        where: { key },
        select: { value: true },
      });
      if (row) {
        return row.value ?? null;
      }

      // If DB is enabled but this key was never migrated, reuse file snapshot.
      const fileStore = await readStore();
      if (key in fileStore) {
        const fallbackValue = fileStore[key] ?? null;
        await prisma.syncEntry.upsert({
          where: { key },
          update: { value: fallbackValue as any },
          create: { key, value: fallbackValue as any },
        });
        return fallbackValue;
      }

      return null;
    }
  }

  const store = await readStore();
  return key in store ? store[key] : null;
}

export async function setSyncValue(key: string, value: unknown): Promise<void> {
  if (HAS_DATABASE_URL) {
    await migrateLegacyFileStoreToDbIfNeeded();
    const prisma = await getPrismaClient();
    if (prisma) {
      await prisma.syncEntry.upsert({
        where: { key },
        update: { value: (value ?? null) as any },
        create: { key, value: (value ?? null) as any },
      });
      return;
    }
  }

  const store = await readStore();
  store[key] = value ?? null;
  await writeStore(store);
}
