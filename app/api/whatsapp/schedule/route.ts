import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";

const SCHEDULE_KEY = "whatsapp-schedule-v1";

type WhatsAppSchedule = {
  key: string;
  nombre: string;
  categoria: string;
  mensaje: string;
  destinatarios: string[];
  fecha: string;
  automatico?: boolean;
  estado?: "pendiente" | "enviado" | "parcial" | "error";
  createdAt: string;
  updatedAt: string;
};

const mkKey = () => `sch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function requireAdmin() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return false;
  }
  return true;
}

async function readSchedules(): Promise<WhatsAppSchedule[]> {
  const current = await getSyncValue(SCHEDULE_KEY);
  return Array.isArray(current) ? (current as WhatsAppSchedule[]) : [];
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const schedules = await readSchedules();
  return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<WhatsAppSchedule>;
  const nombre = String(body.nombre || "").trim();
  const categoria = String(body.categoria || "General").trim();
  const mensaje = String(body.mensaje || "").trim();
  const fecha = String(body.fecha || "").trim();
  const destinatarios = Array.isArray(body.destinatarios)
    ? body.destinatarios.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!nombre || !mensaje || !fecha) {
    return NextResponse.json({ error: "nombre, mensaje y fecha son requeridos" }, { status: 400 });
  }

  const schedules = await readSchedules();
  const now = new Date().toISOString();
  const schedule: WhatsAppSchedule = {
    key: mkKey(),
    nombre,
    categoria,
    mensaje,
    destinatarios,
    fecha,
    automatico: Boolean(body.automatico),
    estado: "pendiente",
    createdAt: now,
    updatedAt: now,
  };

  const next = [schedule, ...schedules].slice(0, 1000);
  await setSyncValue(SCHEDULE_KEY, next);

  return NextResponse.json({ ok: true, schedule });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { key?: string };
  const key = String(body.key || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key requerido" }, { status: 400 });
  }

  const schedules = await readSchedules();
  const next = schedules.filter((item) => item.key !== key);
  await setSyncValue(SCHEDULE_KEY, next);

  return NextResponse.json({ ok: true, removed: schedules.length - next.length });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<WhatsAppSchedule>;
  const key = String(body.key || "").trim();
  const nombre = String(body.nombre || "").trim();
  const categoria = String(body.categoria || "General").trim();
  const mensaje = String(body.mensaje || "").trim();
  const fecha = String(body.fecha || "").trim();
  const destinatarios = Array.isArray(body.destinatarios)
    ? body.destinatarios.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!key || !nombre || !mensaje || !fecha) {
    return NextResponse.json(
      { error: "key, nombre, mensaje y fecha son requeridos" },
      { status: 400 }
    );
  }

  const schedules = await readSchedules();
  const index = schedules.findIndex((item) => item.key === key);
  if (index === -1) {
    return NextResponse.json({ error: "Programacion no encontrada" }, { status: 404 });
  }

  const updated: WhatsAppSchedule = {
    ...schedules[index],
    nombre,
    categoria,
    mensaje,
    fecha,
    destinatarios,
    automatico: body.automatico ?? schedules[index].automatico ?? false,
    estado: body.estado || schedules[index].estado || "pendiente",
    updatedAt: new Date().toISOString(),
  };

  const next = [...schedules];
  next[index] = updated;
  await setSyncValue(SCHEDULE_KEY, next);

  return NextResponse.json({ ok: true, schedule: updated });
}
