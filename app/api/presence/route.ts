import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;
const PRESENCE_KEY_PREFIX = "pf-control-presence-user:";
const ONLINE_WINDOW_MS = 90_000;
const MAX_EMAIL_LOOKUP = 180;

type PresenceState = "online" | "offline";

type PresenceRecord = {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  state?: string | null;
  lastHeartbeatAt?: string | null;
  lastSeenAt?: string | null;
  lastOnlineAt?: string | null;
  lastOfflineAt?: string | null;
  updatedAt?: string | null;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPresenceKey(userId: string): string {
  return `${PRESENCE_KEY_PREFIX}${userId}`;
}

function normalizePresenceState(value: unknown): PresenceState {
  return value === "offline" ? "offline" : "online";
}

function toPresenceRecord(value: unknown): PresenceRecord {
  return value && typeof value === "object" ? (value as PresenceRecord) : {};
}

function buildPresenceSnapshot(record: PresenceRecord | null | undefined, now: Date) {
  const safe = record || {};
  const heartbeatAt = parseIsoDate(safe.lastHeartbeatAt || safe.updatedAt);
  const lastSeenAt = parseIsoDate(safe.lastSeenAt || safe.lastHeartbeatAt || safe.lastOfflineAt || safe.updatedAt);
  const state = normalizePresenceState(safe.state);

  const stale = !heartbeatAt || now.getTime() - heartbeatAt.getTime() > ONLINE_WINDOW_MS;
  const isOnline = !stale && state === "online";

  return {
    userId: typeof safe.userId === "string" ? safe.userId : null,
    email: normalizeEmail(safe.email) || null,
    name: normalizeName(safe.name),
    state,
    isOnline,
    lastHeartbeatAt: heartbeatAt ? heartbeatAt.toISOString() : null,
    lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
    lastOnlineAt: parseIsoDate(safe.lastOnlineAt)?.toISOString() || null,
    lastOfflineAt: parseIsoDate(safe.lastOfflineAt)?.toISOString() || null,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const includeCurrent = url.searchParams.get("includeCurrent") !== "0";
  const emailsParam = String(url.searchParams.get("emails") || "");

  const requestedEmails = Array.from(
    new Set(
      emailsParam
        .split(",")
        .map((item) => normalizeEmail(decodeURIComponent(item || "")))
        .filter(Boolean)
    )
  ).slice(0, MAX_EMAIL_LOOKUP);

  const usersById = new Map<string, { id: string; email: string | null; name: string | null }>();

  if (includeCurrent) {
    usersById.set(String(session.user.id), {
      id: String(session.user.id),
      email: normalizeEmail((session.user as { email?: string | null } | undefined)?.email) || null,
      name: normalizeName((session.user as { name?: string | null } | undefined)?.name),
    });
  }

  if (requestedEmails.length > 0) {
    const users = await db.user.findMany({
      where: {
        email: {
          in: requestedEmails,
        },
      },
      select: {
        id: true,
        email: true,
        nombreCompleto: true,
      },
    });

    for (const user of users as Array<{ id: string; email: string | null; nombreCompleto?: string | null }>) {
      usersById.set(user.id, {
        id: user.id,
        email: normalizeEmail(user.email) || null,
        name: normalizeName(user.nombreCompleto),
      });
    }
  }

  const keys = Array.from(usersById.keys()).map((userId) => getPresenceKey(userId));
  const entries = keys.length
    ? await db.syncEntry.findMany({
        where: {
          key: {
            in: keys,
          },
        },
        select: {
          key: true,
          value: true,
        },
      })
    : [];

  const entryByKey = new Map<string, unknown>(
    (entries as Array<{ key: string; value: unknown }>).map((entry) => [entry.key, entry.value])
  );

  const now = new Date();
  const byEmail: Record<string, ReturnType<typeof buildPresenceSnapshot>> = {};

  for (const user of usersById.values()) {
    const snapshot = buildPresenceSnapshot(toPresenceRecord(entryByKey.get(getPresenceKey(user.id))), now);
    const emailKey = normalizeEmail(user.email);
    if (emailKey) {
      byEmail[emailKey] = {
        ...snapshot,
        userId: snapshot.userId || user.id,
        email: emailKey,
        name: snapshot.name || user.name || null,
      };
    }
  }

  const currentUserId = String(session.user.id);
  const current = usersById.has(currentUserId)
    ? buildPresenceSnapshot(toPresenceRecord(entryByKey.get(getPresenceKey(currentUserId))), now)
    : null;

  return NextResponse.json({
    now: now.toISOString(),
    onlineWindowMs: ONLINE_WINDOW_MS,
    current,
    byEmail,
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const rawBody = await req.text().catch(() => "");
  let body: Record<string, unknown> = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  const state = normalizePresenceState(body.state);
  const now = new Date();
  const nowIso = now.toISOString();
  const userId = String(session.user.id);
  const key = getPresenceKey(userId);

  const existing = await db.syncEntry.findUnique({
    where: { key },
    select: { value: true },
  });

  const previous = toPresenceRecord(existing?.value);
  const email = normalizeEmail((session.user as { email?: string | null } | undefined)?.email) || null;
  const name =
    normalizeName((session.user as { name?: string | null } | undefined)?.name) ||
    normalizeName(previous.name);

  const nextRecord: PresenceRecord = {
    ...previous,
    userId,
    email,
    name,
    state,
    lastHeartbeatAt: nowIso,
    lastSeenAt: nowIso,
    updatedAt: nowIso,
    lastOnlineAt: state === "online" ? nowIso : previous.lastOnlineAt || null,
    lastOfflineAt: state === "offline" ? nowIso : previous.lastOfflineAt || null,
  };

  await db.syncEntry.upsert({
    where: { key },
    update: { value: nextRecord },
    create: {
      key,
      value: nextRecord,
    },
  });

  return NextResponse.json({
    ok: true,
    onlineWindowMs: ONLINE_WINDOW_MS,
    presence: buildPresenceSnapshot(nextRecord, now),
  });
}
