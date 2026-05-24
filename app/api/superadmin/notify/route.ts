import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendProfesorNotification, sendBulkVencimientoWarnings, type NotifPayload } from "@/lib/superadminNotify";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// POST /api/superadmin/notify
// Body: { type, profesorId?, profesorEmail?, profesorNombre?, profesorTelefono?,
//         monto?, moneda?, metodoPago?, periodoHasta?, diasRestantes?, planTipo?,
//         mensajeExtra?, channels: ["email","whatsapp"],
//         bulk?: true, diasUmbral?: number }
export async function POST(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // ── Broadcast: enviar cualquier tipo a TODOS los profesores ──
  if (body.broadcast) {
    const { type, channels, mensajeExtra } = body;
    if (!type || !Array.isArray(channels) || !channels.length) {
      return NextResponse.json({ error: "type y channels requeridos" }, { status: 400 });
    }
    const profesores = await db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, email: true, nombreCompleto: true, telefono: true },
    });
    let sent = 0, failed = 0;
    for (const p of profesores) {
      const r = await sendProfesorNotification({
        type, profesorEmail: p.email, profesorNombre: p.nombreCompleto,
        profesorTelefono: p.telefono, mensajeExtra, channels,
      });
      const ok = channels.includes("email") ? r.email.sent : channels.includes("whatsapp") ? r.whatsapp.sent : false;
      ok ? sent++ : failed++;
      await new Promise(res => setTimeout(res, 150));
    }
    await logAudit("broadcast", `Tipo: ${type} · canales: ${channels.join(",")} · enviados: ${sent}/${profesores.length}`);
    return NextResponse.json({ ok: true, sent, failed, total: profesores.length });
  }

  // ── Bulk: enviar recordatorios de vencimiento a todos ──
  if (body.bulk) {
    const diasUmbral = Number(body.diasUmbral ?? 10);
    const channels = Array.isArray(body.channels) ? body.channels : ["email"];

    const profesores = await db.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true, email: true, nombreCompleto: true, telefono: true,
        subscription: { select: { estado: true, fechaVencimiento: true, planTipo: true } },
      },
    });

    const result = await sendBulkVencimientoWarnings(profesores, diasUmbral, channels);
    return NextResponse.json({ ok: true, ...result });
  }

  // ── Single notification ──
  const { type, profesorId, channels } = body;
  if (!type || !channels?.length) {
    return NextResponse.json({ error: "type y channels requeridos" }, { status: 400 });
  }

  // If profesorId given, fetch latest data from DB
  let email = body.profesorEmail;
  let nombre = body.profesorNombre;
  let telefono = body.profesorTelefono;

  if (profesorId) {
    const user = await db.user.findUnique({
      where: { id: profesorId },
      select: { email: true, nombreCompleto: true, telefono: true },
    });
    if (!user) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });
    email = user.email;
    nombre = user.nombreCompleto;
    telefono = user.telefono;
  }

  if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

  const payload: NotifPayload = {
    type,
    profesorEmail: email,
    profesorNombre: nombre || email,
    profesorTelefono: telefono ?? null,
    monto: body.monto,
    moneda: body.moneda,
    metodoPago: body.metodoPago,
    periodoHasta: body.periodoHasta,
    diasRestantes: body.diasRestantes != null ? Number(body.diasRestantes) : undefined,
    planTipo: body.planTipo,
    mensajeExtra: body.mensajeExtra,
    channels,
  };

  const result = await sendProfesorNotification(payload);
  await logAudit("notif_enviada", `Tipo: ${type} · canales: ${channels.join(",")}`, email);
  return NextResponse.json({ ok: true, result });
}
