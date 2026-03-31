import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const db = prisma as any;

// CRUD para programar envíos automáticos de WhatsApp
export async function GET() {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const schedules = await db.syncEntry.findMany({
    where: { key: { startsWith: 'whatsapp-schedule-' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const { nombre, categoria, subcategoria, mensaje, destinatarios, fecha, automatico } = (await req.json().catch(() => ({}))) as {
    nombre?: string;
    categoria?: string;
    subcategoria?: string;
    mensaje?: string;
    destinatarios?: unknown;
    fecha?: string;
    automatico?: boolean;
  };

  if (!nombre || !mensaje || !fecha || !Array.isArray(destinatarios)) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

  const parsedDate = new Date(String(fecha || ""));
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'Fecha invalida' }, { status: 400 });
  }

  const key = `whatsapp-schedule-${categoria || 'general'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const schedule = await db.syncEntry.create({
    data: {
      key,
      value: {
        nombre,
        categoria,
        subcategoria: subcategoria || 'programado_fecha_hora',
        mensaje,
        destinatarios,
        fecha: parsedDate.toISOString(),
        automatico: automatico !== false,
        estado: 'pendiente',
        creado: new Date().toISOString(),
      },
    },
  });
  return NextResponse.json({ schedule });
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
