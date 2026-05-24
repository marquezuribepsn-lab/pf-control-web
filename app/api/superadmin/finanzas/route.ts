import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

export async function GET() {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── Profesores con suscripción ────────────────────────────────────────────
  type SubRow = {
    id: string; estado: string; planTipo: string; importe: number; moneda: string;
    periodoDias: number; fechaVencimiento: string | null; updatedAt: string | null;
  };
  type ProfeRow = { id: string; email: string; nombreCompleto: string; subscription: SubRow | null };

  const profesores: ProfeRow[] = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true, email: true, nombreCompleto: true,
      subscription: {
        select: {
          id: true, estado: true, planTipo: true,
          importe: true, moneda: true, periodoDias: true,
          fechaVencimiento: true, updatedAt: true,
        },
      },
    },
  });

  // ── MRR / ARR ─────────────────────────────────────────────────────────────
  let mrrUSD = 0, mrrARS = 0;
  for (const p of profesores) {
    const sub = p.subscription;
    if (!sub || sub.estado !== "activo" || !sub.importe) continue;
    const monthly = (sub.importe / (sub.periodoDias || 30)) * 30;
    if      (sub.moneda === "USD") mrrUSD += monthly;
    else if (sub.moneda === "ARS") mrrARS += monthly;
  }

  // ── Conteos ───────────────────────────────────────────────────────────────
  const activeCount    = profesores.filter(p => p.subscription?.estado === "activo").length;
  const trialCount     = profesores.filter(p => p.subscription?.estado === "trial").length;
  const suspendedCount = profesores.filter(p =>
    p.subscription && ["suspendido", "vencido", "cancelado"].includes(p.subscription.estado)
  ).length;

  // Churn: subs que vencieron este mes
  const churnedThisMonth = profesores.filter(p => {
    const sub = p.subscription;
    return sub &&
      ["vencido", "cancelado"].includes(sub.estado) &&
      sub.updatedAt && new Date(sub.updatedAt) >= startOfMonth;
  }).length;
  const churnBase = activeCount + churnedThisMonth;
  const churnRate = churnBase > 0 ? Math.round((churnedThisMonth / churnBase) * 100) : 0;

  // ── Forecast: vencimientos próximos ──────────────────────────────────────
  type ForecastItem = {
    email: string; nombre: string; importe: number; moneda: string;
    planTipo: string; fechaVencimiento: string; diasRestantes: number;
  };

  const forecast: Record<"d30" | "d60" | "d90", ForecastItem[]> = { d30: [], d60: [], d90: [] };
  const forecastTotals: Record<"d30" | "d60" | "d90", { USD: number; ARS: number }> = {
    d30: { USD: 0, ARS: 0 },
    d60: { USD: 0, ARS: 0 },
    d90: { USD: 0, ARS: 0 },
  };

  for (const p of profesores) {
    const sub = p.subscription;
    if (!sub || sub.estado !== "activo" || !sub.fechaVencimiento) continue;
    const days = Math.ceil((new Date(sub.fechaVencimiento).getTime() - now.getTime()) / 86400000);
    if (days < 0 || days > 90) continue;

    const item: ForecastItem = {
      email: p.email, nombre: p.nombreCompleto,
      importe: sub.importe, moneda: sub.moneda,
      planTipo: sub.planTipo,
      fechaVencimiento: sub.fechaVencimiento,
      diasRestantes: days,
    };

    for (const [key, max] of [["d30", 30], ["d60", 60], ["d90", 90]] as const) {
      if (days <= max) {
        forecast[key].push(item);
        if (sub.moneda === "USD") forecastTotals[key].USD += sub.importe;
        else if (sub.moneda === "ARS") forecastTotals[key].ARS += sub.importe;
      }
    }
  }

  // Sort: soonest first
  for (const key of ["d30", "d60", "d90"] as const) {
    forecast[key].sort((a, b) => a.diasRestantes - b.diasRestantes);
  }

  // ── Tendencia mensual (últimos 6 meses) ───────────────────────────────────
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const pagos = await db.profesorPago.findMany({
    where: { fechaPago: { gte: sixMonthsAgo } },
    select: { monto: true, moneda: true, fechaPago: true },
  });

  // Inicializar los 6 meses
  const trend: { month: string; label: string; USD: number; ARS: number; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trend.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
      USD: 0, ARS: 0, count: 0,
    });
  }

  for (const p of pagos) {
    const key = new Date(p.fechaPago).toISOString().slice(0, 7);
    const entry = trend.find(t => t.month === key);
    if (entry) {
      if      (p.moneda === "USD") entry.USD += p.monto;
      else if (p.moneda === "ARS") entry.ARS += p.monto;
      entry.count++;
    }
  }

  // ── Breakdown por plan ───────────────────────────────────────────────────
  const planBreakdown: Record<string, { count: number; mrrUSD: number; mrrARS: number }> = {
    basico: { count: 0, mrrUSD: 0, mrrARS: 0 },
    pro:    { count: 0, mrrUSD: 0, mrrARS: 0 },
    elite:  { count: 0, mrrUSD: 0, mrrARS: 0 },
  };
  for (const p of profesores) {
    const sub = p.subscription;
    if (!sub || sub.estado !== "activo") continue;
    const plan = sub.planTipo as string;
    if (!planBreakdown[plan]) planBreakdown[plan] = { count: 0, mrrUSD: 0, mrrARS: 0 };
    planBreakdown[plan].count++;
    const monthly = (sub.importe / (sub.periodoDias || 30)) * 30;
    if      (sub.moneda === "USD") planBreakdown[plan].mrrUSD += monthly;
    else if (sub.moneda === "ARS") planBreakdown[plan].mrrARS += monthly;
  }

  // ── Conversión trial → activo ─────────────────────────────────────────────
  const subsConPago = await db.profesorPago.findMany({
    distinct: ["subscriptionId"],
    select: { subscriptionId: true },
  });
  const subIdsConPago = new Set(subsConPago.map((p: any) => p.subscriptionId));
  const convertidosTotales = profesores.filter(p => p.subscription && subIdsConPago.has(p.subscription.id)).length;
  const nuncaPagaron = profesores.filter(p => p.subscription && !subIdsConPago.has(p.subscription.id) && p.subscription.estado !== "trial").length;
  const tasaConversion = (convertidosTotales + nuncaPagaron) > 0
    ? Math.round((convertidosTotales / (convertidosTotales + nuncaPagaron)) * 100) : 0;
  const pagosEsteMes = await db.profesorPago.findMany({
    where: { fechaPago: { gte: startOfMonth } },
    distinct: ["subscriptionId"],
    select: { subscriptionId: true },
  });
  const subIdsEsteMes = new Set(pagosEsteMes.map((p: any) => p.subscriptionId));
  const convertidosEsteMes = profesores.filter(p => p.subscription && subIdsEsteMes.has(p.subscription.id)).length;

  // Total recaudado alltime
  const allPagos = await db.profesorPago.aggregate({ _sum: { monto: true } });

  // ── Crecimiento: nuevas altas y bajas por mes (últimos 6 meses) ──────────
  const newUsers = await db.user.findMany({
    where: { role: "ADMIN", createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true },
  });
  const growth = trend.map(t => ({ ...t, nuevos: 0 }));
  for (const u of newUsers) {
    const key = new Date(u.createdAt).toISOString().slice(0, 7);
    const entry = growth.find(g => g.month === key);
    if (entry) entry.nuevos++;
  }

  return NextResponse.json({
    ok: true,
    mrr:   { USD: mrrUSD, ARS: mrrARS },
    arr:   { USD: mrrUSD * 12, ARS: mrrARS * 12 },
    counts: { active: activeCount, trial: trialCount, suspended: suspendedCount, total: profesores.length },
    churn:  { thisMonth: churnedThisMonth, rate: churnRate },
    forecast,
    forecastTotals,
    trend,
    growth,
    conversion: {
      tasa: tasaConversion,
      convertidosTotales,
      nuncaPagaron,
      convertidosEsteMes,
      trialsActivos: trialCount,
      total: profesores.length,
    },
    planBreakdown,
    totalRecaudado: allPagos._sum.monto ?? 0,
  });
}
