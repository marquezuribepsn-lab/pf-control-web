import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const db = prisma as any;

// CRUD para plantillas de WhatsApp
export async function GET() {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const templates = await db.syncEntry.findMany({
    where: { key: { startsWith: 'whatsapp-template-' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    nombre?: string;
    categoria?: string;
    mensaje?: string;
  };
  const nombre = String(body.nombre || '').trim();
  const categoria = String(body.categoria || 'general').trim();
  const mensaje = String(body.mensaje || '').trim();

  if (!nombre || !mensaje) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

  const key = `whatsapp-template-${categoria || 'general'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const template = await db.syncEntry.create({
    data: { key, value: { nombre, categoria, mensaje, fecha: new Date().toISOString() } },
  });
  return NextResponse.json({ template });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  if (!key) return NextResponse.json({ error: 'Falta key' }, { status: 400 });
  await db.syncEntry.delete({ where: { key } });
  return NextResponse.json({ ok: true });
}
