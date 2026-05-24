import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// GET /api/superadmin/alertas
// Devuelve alertas inteligentes calculadas sobre el estado actual del sistema.
export async function GET() {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = Date.now();

  const profesores = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true, email: true, nombreCompleto: true, estado: true, lastLoginAt: true,
      subscription: {
        select: { estado: true, fechaVencimiento: true, planTipo: true },
      },
      _count: { select: { asignaciones: true } },
    },
  });

  type Alerta = {
    tipo: string;
    nivel: "critico" | "warning" | "info";
    titulo: string;
    detalle: string;
  };
  const alertas: Alerta[] = [];

  // 1. Vencen en los próximos 7 días
  const expiringSoon = profesores.filter((p: any) => {
    if (!p.subscription?.fechaVencimiento) return false;
    const dias = Math.ceil((new Date(p.subscription.fechaVencimiento).getTime() - now) / 86400000);
    return dias >= 0 && dias <= 7 && p.subscription.estado === "activo";
  });
  if (expiringSoon.length > 0) {
    alertas.push({
      tipo: "vencimiento_proximo",
      nivel: "warning",
      titulo: `${expiringSoon.length} profesor${expiringSoon.length > 1 ? "es vencen" : " vence"} esta semana`,
      detalle:
        expiringSoon
          .slice(0, 3)
          .map((p: any) => p.nombreCompleto || p.email)
          .join(", ") + (expiringSoon.length > 3 ? ` y ${expiringSoon.length - 3} más` : ""),
    });
  }

  // 2. Vencidos pero aún con estado "activo" (el cron no los suspendió todavía)
  const vencidosActivos = profesores.filter((p: any) => {
    if (!p.subscription?.fechaVencimiento) return false;
    const dias = Math.ceil((new Date(p.subscription.fechaVencimiento).getTime() - now) / 86400000);
    return dias < 0 && p.subscription.estado === "activo";
  });
  if (vencidosActivos.length > 0) {
    alertas.push({
      tipo: "vencido_activo",
      nivel: "critico",
      titulo: `${vencidosActivos.length} suscripción${vencidosActivos.length > 1 ? "es vencidas con" : " vencida con"} acceso activo`,
      detalle: "El cron aún no los suspendió. Ejecutá el cron manualmente desde Automatización.",
    });
  }

  // 3. Sin login en más de 30 días (con suscripción activa)
  const inactivos = profesores.filter((p: any) => {
    if (p.subscription?.estado !== "activo") return false;
    if (!p.lastLoginAt) return true;
    return Math.floor((now - new Date(p.lastLoginAt).getTime()) / 86400000) > 30;
  });
  if (inactivos.length > 0) {
    alertas.push({
      tipo: "inactividad",
      nivel: "info",
      titulo: `${inactivos.length} profesor${inactivos.length > 1 ? "es activos sin" : " activo sin"} login en más de 30 días`,
      detalle: "Enviá un recordatorio desde Herramientas → Broadcast masivo.",
    });
  }

  // 4. Suspendidos/vencidos con alumnos asignados
  const suspConAlumnos = profesores.filter(
    (p: any) =>
      (p.subscription?.estado === "suspendido" || p.subscription?.estado === "vencido") &&
      (p._count?.asignaciones ?? 0) > 0
  );
  if (suspConAlumnos.length > 0) {
    alertas.push({
      tipo: "suspendido_con_alumnos",
      nivel: "warning",
      titulo: `${suspConAlumnos.length} profesor${suspConAlumnos.length > 1 ? "es suspendidos con" : " suspendido con"} alumnos asignados`,
      detalle:
        suspConAlumnos
          .slice(0, 3)
          .map((p: any) => `${p.nombreCompleto || p.email} (${p._count.asignaciones} alumnos)`)
          .join(", ") + (suspConAlumnos.length > 3 ? ` y ${suspConAlumnos.length - 3} más` : ""),
    });
  }

  // 5. Activos sin suscripción configurada
  const sinSub = profesores.filter((p: any) => !p.subscription && p.estado === "activo");
  if (sinSub.length > 0) {
    alertas.push({
      tipo: "sin_suscripcion",
      nivel: "info",
      titulo: `${sinSub.length} profesor${sinSub.length > 1 ? "es sin" : " sin"} suscripción configurada`,
      detalle:
        sinSub
          .slice(0, 3)
          .map((p: any) => p.email)
          .join(", ") + (sinSub.length > 3 ? ` y ${sinSub.length - 3} más` : ""),
    });
  }

  return NextResponse.json({ ok: true, alertas });
}
