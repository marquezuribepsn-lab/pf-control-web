import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const db = prisma as any;

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const rawPath = typeof payload?.path === 'string' ? payload.path.trim() : '';
  const path = rawPath ? rawPath.slice(0, 180) : null;
  const lastSeenAt = new Date().toISOString();
  const key = `presence:${session.user.id}`;

  await db.syncEntry.upsert({
    where: { key },
    create: {
      key,
      value: {
        userId: session.user.id,
        role: (session.user as { role?: string } | undefined)?.role || null,
        lastSeenAt,
        path,
      },
    },
    update: {
      value: {
        userId: session.user.id,
        role: (session.user as { role?: string } | undefined)?.role || null,
        lastSeenAt,
        path,
      },
    },
  });

  return NextResponse.json({ ok: true, lastSeenAt });
}
