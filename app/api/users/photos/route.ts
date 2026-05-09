import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const db = prisma as any;
const SIDEBAR_IMAGE_SYNC_KEY_PREFIX = 'pf-control-user-sidebar-image:';

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeImage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  try {
    // sidebarImage is stored in the users table but is not in the Prisma schema.
    // Use a raw query to read it alongside email/nombreCompleto.
    const rows = (await db.$queryRaw(
      Prisma.sql`SELECT id, email, nombreCompleto, sidebarImage FROM users`
    )) as Array<{
      id: string;
      email: string | null;
      nombreCompleto: string | null;
      sidebarImage: string | null;
    }>;

    const fallbackEntries = (await db.syncEntry.findMany({
      where: { key: { startsWith: SIDEBAR_IMAGE_SYNC_KEY_PREFIX } },
      select: { key: true, value: true },
    })) as Array<{ key: string; value: unknown }>;

    const fallbackMap = new Map<string, string>();
    for (const entry of fallbackEntries) {
      const userId = String(entry.key || '').slice(SIDEBAR_IMAGE_SYNC_KEY_PREFIX.length);
      const image = normalizeImage(entry.value);
      if (userId && image) fallbackMap.set(userId, image);
    }

    const byEmail: Record<string, string> = {};
    const byName: Record<string, string> = {};

    for (const row of rows) {
      const image = normalizeImage(row.sidebarImage) || fallbackMap.get(row.id) || null;
      if (!image) continue;

      const email = normalizeEmail(row.email);
      if (email) byEmail[email] = image;

      const name = (row.nombreCompleto || '').trim();
      if (name) byName[name.toLowerCase()] = image;
    }

    return NextResponse.json({ byEmail, byName });
  } catch (error) {
    console.error('[users/photos] error:', error);
    return NextResponse.json({ message: 'Error leyendo fotos' }, { status: 500 });
  }
}
