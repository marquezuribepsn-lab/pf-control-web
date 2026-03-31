import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const db = prisma as any;
const ONLINE_THRESHOLD_DEFAULT_SEC = 90;

function parseThresholdSeconds(rawValue: string | null): number {
  const parsed = Number(rawValue || ONLINE_THRESHOLD_DEFAULT_SEC);
  if (!Number.isFinite(parsed)) {
    return ONLINE_THRESHOLD_DEFAULT_SEC;
  }

  return Math.max(30, Math.min(600, Math.round(parsed)));
}

function extractUserIdFromKey(key: string, prefix: string): string | null {
  if (!key.startsWith(prefix)) {
    return null;
  }

  const userId = key.slice(prefix.length).trim();
  return userId || null;
}

function parseSidebarImage(syncValue: unknown): string | null {
  if (typeof syncValue === 'string') {
    return syncValue || null;
  }

  if (syncValue && typeof syncValue === 'object' && 'sidebarImage' in syncValue) {
    const sidebarImage = String((syncValue as { sidebarImage?: unknown }).sidebarImage || '').trim();
    return sidebarImage || null;
  }

  return null;
}

function parseLastSeenAt(syncValue: unknown, fallbackIso: string): string | null {
  if (syncValue && typeof syncValue === 'object' && 'lastSeenAt' in syncValue) {
    const candidate = String((syncValue as { lastSeenAt?: unknown }).lastSeenAt || '').trim();
    const parsed = new Date(candidate);
    if (candidate && !Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const parsedFallback = new Date(fallbackIso);
  if (Number.isNaN(parsedFallback.getTime())) {
    return null;
  }

  return parsedFallback.toISOString();
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const thresholdSec = parseThresholdSeconds(new URL(req.url).searchParams.get('thresholdSec'));
  const nowMs = Date.now();

  const [clientUsers, profileEntries, presenceEntries] = await Promise.all([
    db.user.findMany({
      where: { role: 'CLIENTE' },
      select: {
        id: true,
        email: true,
        nombreCompleto: true,
        sidebarImage: true,
      },
      take: 1000,
    }),
    db.syncEntry.findMany({
      where: { key: { startsWith: 'profile-image:' } },
      select: {
        key: true,
        value: true,
      },
      take: 3000,
    }),
    db.syncEntry.findMany({
      where: { key: { startsWith: 'presence:' } },
      select: {
        key: true,
        value: true,
        updatedAt: true,
      },
      take: 3000,
    }),
  ]);

  const sidebarImageByUserId = new Map<string, string>();
  for (const entry of profileEntries as Array<{ key: string; value: unknown }>) {
    const userId = extractUserIdFromKey(String(entry.key || ''), 'profile-image:');
    if (!userId) continue;

    const sidebarImage = parseSidebarImage(entry.value);
    if (sidebarImage) {
      sidebarImageByUserId.set(userId, sidebarImage);
    }
  }

  const lastSeenByUserId = new Map<string, string>();
  for (const entry of presenceEntries as Array<{ key: string; value: unknown; updatedAt: string }>) {
    const userId = extractUserIdFromKey(String(entry.key || ''), 'presence:');
    if (!userId) continue;

    const lastSeenAt = parseLastSeenAt(entry.value, String(entry.updatedAt || ''));
    if (lastSeenAt) {
      lastSeenByUserId.set(userId, lastSeenAt);
    }
  }

  const rows = (clientUsers as Array<{
    id: string;
    email: string;
    nombreCompleto: string;
    sidebarImage?: string | null;
  }>).map((user) => {
    const lastSeenAt = lastSeenByUserId.get(user.id) || null;
    const isOnline =
      Boolean(lastSeenAt) && nowMs - new Date(String(lastSeenAt)).getTime() <= thresholdSec * 1000;

    return {
      userId: user.id,
      email: String(user.email || '').trim().toLowerCase(),
      nombreCompleto: String(user.nombreCompleto || ''),
      sidebarImage: sidebarImageByUserId.get(user.id) || String(user.sidebarImage || '').trim() || null,
      lastSeenAt,
      isOnline,
    };
  });

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    thresholdSec,
    rows,
  });
}
