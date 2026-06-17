import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dispatchWhatsAppBatch } from "@/lib/whatsappDispatch";

/**
 * POST /api/progression/notify
 * Envía notificación WhatsApp a un alumno/jugadora cuando su plan semanal
 * fue generado por el Motor de Progresión IA.
 *
 * Body: { personaNombre, weekLabel, decision, loadDeltaPct, rationaleEs? }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: {
    personaNombre?: string;
    weekLabel?: string;
    decision?: string;
    loadDeltaPct?: number;
    rationaleEs?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { personaNombre, weekLabel, decision, loadDeltaPct, rationaleEs } = body;

  if (!personaNombre?.trim()) {
    return NextResponse.json({ error: "personaNombre requerido" }, { status: 400 });
  }

  // Buscar usuario por nombreCompleto (primer nombre para match flexible)
  const firstName = personaNombre.trim().split(" ")[0];
  const user = await prisma.user.findFirst({
    where: {
      nombreCompleto: { contains: firstName },
      telefono: { not: null },
    },
    select: {
      telefono: true,
      nombreCompleto: true,
    },
  });

  if (!user?.telefono) {
    return NextResponse.json(
      {
        ok: false,
        skipped: true,
        reason: `No se encontró teléfono registrado para "${personaNombre}".`,
      },
      { status: 200 }
    );
  }

  const sign = (loadDeltaPct ?? 0) >= 0 ? "+" : "";
  const deltaLabel = `${sign}${loadDeltaPct ?? 0}%`;

  const mensaje =
    `🏋️ *Nuevo plan semanal disponible*\n\n` +
    `Hola *${user.nombreCompleto}*, tu entrenador acaba de generar tu plan para la próxima semana.\n\n` +
    `📅 *${weekLabel || "Próxima semana"}*\n` +
    `📊 Ajuste de carga: *${deltaLabel}*\n` +
    `🎯 *${decision || "Progresión inteligente"}*\n` +
    (rationaleEs
      ? `\n_${rationaleEs.slice(0, 220)}${rationaleEs.length > 220 ? "…" : ""}_\n`
      : "") +
    `\n💪 Ingresá a la app para ver todos los detalles de tu entrenamiento.`;

  const dispatch = await dispatchWhatsAppBatch({
    recipients: [{ telefono: user.telefono, label: user.nombreCompleto }],
    message: mensaje,
    mode: "prod",
    forceText: true,
  });

  const sent = dispatch.results.find((r) => r.ok);
  if (!sent) {
    return NextResponse.json(
      { ok: false, reason: dispatch.results[0]?.reason || "Error al enviar" },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, sentTo: user.telefono });
}
