import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const db = prisma as any;

// Devuelve los últimos 50 envíos de WhatsApp registrados en SyncEntry
export async function GET(_req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const historial = await db.syncEntry.findMany({
    where: {
      key: {
        startsWith: 'whatsapp-log-',
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 120,
  });
  return NextResponse.json({ historial });
}
