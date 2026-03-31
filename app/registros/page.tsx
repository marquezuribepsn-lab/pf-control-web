"use client";

import { useMemo } from "react";
import * as XLSX from "xlsx";
import { useAlumnos } from "../../components/AlumnosProvider";
import { usePlayers } from "../../components/PlayersProvider";
import { useSessions } from "../../components/SessionsProvider";
import { useSharedState } from "../../components/useSharedState";

type ClienteMeta = {
  pagoEstado: "confirmado" | "pendiente";
  moneda: string;
  importe: string;
  saldo: string;
  startDate: string;
  tipoAsesoria: "entrenamiento" | "nutricion" | "completa";
  modalidad: "virtual" | "presencial";
  [key: string]: unknown;
};

type PagoRegistro = {
  id: string;
  clientId: string;
  clientName: string;
  fecha: string;
  importe: number;
  moneda: string;
  createdAt: string;
};

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const PAGOS_KEY = "pf-control-pagos-v1";

function formatMonthKeyLabel(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!year || !month) {
    return monthKey;
  }

  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("es-AR", { month: "short", year: "2-digit" });
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "red" | "blue" | "yellow";
}) {
  const accentClass = {
    green: "text-emerald-300",
    red: "text-rose-300",
    blue: "text-cyan-300",
    yellow: "text-amber-300",
  }[accent ?? "blue"] ?? "text-slate-100";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-5 shadow-[0_14px_36px_rgba(2,12,27,0.26)]">
      <p className="text-sm text-slate-300">{label}</p>
      <h2 className={`mt-2 text-2xl font-semibold ${accentClass}`}>{value}</h2>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function RegistrosPage() {
  const { jugadoras } = usePlayers();
  const { alumnos } = useAlumnos();
  const { sesiones } = useSessions();
  const [clientesMeta] = useSharedState<Record<string, ClienteMeta>>({}, {
    key: CLIENTE_META_KEY,
    legacyLocalStorageKey: CLIENTE_META_KEY,
  });
  const [pagos] = useSharedState<PagoRegistro[]>([], {
    key: PAGOS_KEY,
    legacyLocalStorageKey: PAGOS_KEY,
  });

  const stats = useMemo(() => {
    const totalClientes = jugadoras.length + alumnos.length;
    const activos = [
      ...jugadoras.filter((j) => (j.estado || "activo") === "activo"),
      ...alumnos.filter((a) => (a.estado || "activo") === "activo"),
    ].length;
    const finalizados = totalClientes - activos;

    const metas = Object.values(clientesMeta);

    const pagosConfirmados = metas.filter((m) => m.pagoEstado === "confirmado").length;
    const pagosPendientes = metas.filter((m) => m.pagoEstado === "pendiente").length;

    const ingresosBrutos = metas
      .filter((m) => m.pagoEstado === "confirmado")
      .reduce((acc, m) => {
        const val = parseFloat((m.importe ?? "0").toString().replace(",", "."));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);

    const saldoPendiente = metas
      .filter((m) => m.pagoEstado === "pendiente")
      .reduce((acc, m) => {
        const val = parseFloat((m.importe ?? "0").toString().replace(",", "."));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);

    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();

    const nuevosEsteMes = [
      ...jugadoras.map((j) => ({ id: `jugadora:${j.nombre}` })),
      ...alumnos.map((a) => ({ id: `alumno:${a.nombre}` })),
    ].filter(({ id }) => {
      const meta = clientesMeta[id];
      if (!meta?.startDate) return false;
      const d = new Date(meta.startDate);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    }).length;

    const tipoAsesoria = metas.reduce(
      (acc, m) => {
        const t = m.tipoAsesoria ?? "completa";
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const modalidades = metas.reduce(
      (acc, m) => {
        const mod = m.modalidad ?? "presencial";
        acc[mod] = (acc[mod] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalClientes,
      activos,
      finalizados,
      pagosConfirmados,
      pagosPendientes,
      ingresosBrutos,
      saldoPendiente,
      nuevosEsteMes,
      sesionesTotales: sesiones.length,
      tipoAsesoria,
      modalidades,
    };
  }, [jugadoras, alumnos, sesiones, clientesMeta]);

  const mesNombre = new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });

  const allClientes = useMemo(() => {
    return [
      ...jugadoras.map((j) => ({
        id: `jugadora:${j.nombre}`,
        nombre: j.nombre,
        tipo: "Jugadora",
        estado: j.estado || "activo",
        categoria: j.categoria,
        club: j.club,
      })),
      ...alumnos.map((a) => ({
        id: `alumno:${a.nombre}`,
        nombre: a.nombre,
        tipo: "Alumno",
        estado: a.estado || "activo",
        categoria: undefined,
        club: a.club,
      })),
    ].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [jugadoras, alumnos]);

  const resumenMensualIngresos = useMemo(() => {
    const agrupado: Record<
      string,
      { cantidadPagos: number; total: number; clientes: Set<string>; moneda: string }
    > = {};

    for (const pago of pagos) {
      if (!pago.fecha) continue;
      const key = pago.fecha.slice(0, 7);
      if (!agrupado[key]) {
        agrupado[key] = {
          cantidadPagos: 0,
          total: 0,
          clientes: new Set<string>(),
          moneda: pago.moneda || "ARS",
        };
      }

      agrupado[key].cantidadPagos += 1;
      agrupado[key].total += Number(pago.importe) || 0;
      agrupado[key].clientes.add(pago.clientId);
      if (!agrupado[key].moneda && pago.moneda) {
        agrupado[key].moneda = pago.moneda;
      }
    }

    return Object.entries(agrupado)
      .map(([mes, item]) => ({
        mes,
        cantidadPagos: item.cantidadPagos,
        clientesUnicos: item.clientes.size,
        total: item.total,
        moneda: item.moneda || "ARS",
      }))
      .sort((a, b) => b.mes.localeCompare(a.mes));
  }, [pagos]);

  const chartData = useMemo(() => {
    const ascending = [...resumenMensualIngresos].sort((a, b) => a.mes.localeCompare(b.mes));
    return ascending.slice(-8);
  }, [resumenMensualIngresos]);

  const trendData = useMemo(() => {
    const width = 680;
    const height = 220;
    const paddingX = 42;
    const paddingY = 24;

    if (chartData.length === 0) {
      return {
        width,
        height,
        bars: [] as Array<{ x: number; y: number; w: number; h: number; label: string; value: number }>,
        linePath: "",
        areaPath: "",
        maxValue: 0,
      };
    }

    const maxValue = Math.max(...chartData.map((item) => item.total), 1);
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingY * 2;
    const slotWidth = innerWidth / chartData.length;
    const barWidth = Math.max(20, slotWidth * 0.45);

    const points = chartData.map((item, index) => {
      const normalized = item.total / maxValue;
      const x = paddingX + slotWidth * index + slotWidth / 2;
      const y = height - paddingY - normalized * innerHeight;
      const barHeight = normalized * innerHeight;

      return {
        x,
        y,
        label: formatMonthKeyLabel(item.mes),
        value: item.total,
        w: barWidth,
        h: barHeight,
      };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const first = points[0];
    const last = points[points.length - 1];
    const areaPath = `${linePath} L ${last.x} ${height - paddingY} L ${first.x} ${height - paddingY} Z`;

    return {
      width,
      height,
      bars: points,
      linePath,
      areaPath,
      maxValue,
    };
  }, [chartData]);

  const paymentDistribution = useMemo(() => {
    const confirmed = stats.pagosConfirmados;
    const pending = stats.pagosPendientes;
    const total = confirmed + pending;
    const confirmedPct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
    const pendingPct = total > 0 ? 100 - confirmedPct : 0;

    return { confirmed, pending, total, confirmedPct, pendingPct };
  }, [stats.pagosConfirmados, stats.pagosPendientes]);

  const businessInsights = useMemo(() => {
    const currentMonth = chartData[chartData.length - 1];
    const previousMonth = chartData[chartData.length - 2];

    const currentIncome = currentMonth?.total ?? 0;
    const previousIncome = previousMonth?.total ?? 0;
    const growthPct =
      previousIncome > 0
        ? ((currentIncome - previousIncome) / previousIncome) * 100
        : currentIncome > 0
        ? 100
        : 0;

    const avgTicket =
      pagos.length > 0
        ? pagos.reduce((acc, pago) => acc + (Number(pago.importe) || 0), 0) / pagos.length
        : 0;

    const avgPaymentsPerMonth =
      resumenMensualIngresos.length > 0
        ? pagos.length / resumenMensualIngresos.length
        : 0;

    return {
      currentLabel: currentMonth ? formatMonthKeyLabel(currentMonth.mes) : "Sin datos",
      growthPct,
      avgTicket,
      avgPaymentsPerMonth,
    };
  }, [chartData, pagos, resumenMensualIngresos.length]);

  const exportarExcelIngresos = () => {
    const hojaMensual = resumenMensualIngresos.map((row) => ({
      Mes: row.mes,
      "Pagos registrados": row.cantidadPagos,
      "Clientes unicos": row.clientesUnicos,
      Moneda: row.moneda,
      "Ingreso total": row.total,
    }));

    const hojaDetalle = pagos.map((pago) => ({
      Fecha: pago.fecha,
      Cliente: pago.clientName,
      Moneda: pago.moneda,
      Importe: pago.importe,
      "Registrado en": new Date(pago.createdAt).toLocaleString("es-AR"),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaMensual), "Resumen mensual");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaDetalle), "Detalle pagos");

    const fileDate = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `ingresos_mensuales_${fileDate}.xlsx`);
  };

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:p-6">
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-cyan-200/15 bg-gradient-to-br from-slate-900 via-[#102237] to-[#0b1831] p-5 shadow-[0_22px_60px_rgba(2,12,27,0.36)] sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center rounded-full border border-cyan-200/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100/90">
            Dashboard comercial
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Registros</h1>
          <p className="mt-1 text-sm text-slate-200/90">
          Resumen de clientes, pagos y actividad del sistema.
          </p>
        </div>
      </div>

      {/* Clientes */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Clientes
      </h2>
      <section className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard label="Total clientes" value={stats.totalClientes} accent="blue" />
        <StatCard label="Activos" value={stats.activos} accent="green" />
        <StatCard label="Finalizados" value={stats.finalizados} />
        <StatCard
          label="Nuevos este mes"
          value={stats.nuevosEsteMes}
          sub={mesNombre}
          accent="blue"
        />
      </section>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Resumen mensual de ingresos
      </h2>
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <article className="rounded-3xl border border-white/10 bg-slate-900/75 p-4 shadow-[0_16px_40px_rgba(2,12,27,0.35)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/80">Tendencia de ingresos</p>
              <h3 className="text-base font-black text-white sm:text-lg">Ultimos meses</h3>
            </div>
            <span className="rounded-full border border-cyan-200/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              Maximo {trendData.maxValue > 0 ? `$${trendData.maxValue.toLocaleString("es-AR")}` : "—"}
            </span>
          </div>

          {chartData.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/20 bg-slate-800/45 p-4 text-sm text-slate-300">
              No hay pagos suficientes para graficar la tendencia.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/50 p-3">
              <svg
                viewBox={`0 0 ${trendData.width} ${trendData.height}`}
                className="h-56 min-w-[640px] w-full"
                role="img"
                aria-label="Grafico de ingresos por mes"
              >
                <defs>
                  <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(45,212,191,0.32)" />
                    <stop offset="100%" stopColor="rgba(45,212,191,0.04)" />
                  </linearGradient>
                  <linearGradient id="incomeLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>

                {[0, 1, 2, 3].map((tick) => {
                  const y = 24 + ((trendData.height - 48) / 3) * tick;
                  return (
                    <line
                      key={`tick-${tick}`}
                      x1={24}
                      y1={y}
                      x2={trendData.width - 24}
                      y2={y}
                      stroke="rgba(148,163,184,0.2)"
                      strokeDasharray="4 6"
                    />
                  );
                })}

                {trendData.areaPath ? <path d={trendData.areaPath} fill="url(#incomeArea)" /> : null}

                {trendData.bars.map((bar) => (
                  <g key={bar.label}>
                    <rect
                      x={bar.x - bar.w / 2}
                      y={trendData.height - 24 - bar.h}
                      width={bar.w}
                      height={bar.h}
                      rx={8}
                      fill="rgba(34,211,238,0.22)"
                    />
                    <text
                      x={bar.x}
                      y={trendData.height - 6}
                      textAnchor="middle"
                      fontSize="11"
                      fill="rgba(186,230,253,0.9)"
                    >
                      {bar.label}
                    </text>
                  </g>
                ))}

                {trendData.linePath ? (
                  <path d={trendData.linePath} fill="none" stroke="url(#incomeLine)" strokeWidth={3.4} strokeLinecap="round" />
                ) : null}
                {trendData.bars.map((bar) => (
                  <circle
                    key={`point-${bar.label}`}
                    cx={bar.x}
                    cy={bar.y}
                    r={4.2}
                    fill="#22d3ee"
                    stroke="rgba(2,6,23,0.9)"
                    strokeWidth={2}
                  />
                ))}
              </svg>
            </div>
          )}
        </article>

        <article className="grid gap-4 rounded-3xl border border-white/10 bg-slate-900/75 p-4 shadow-[0_16px_40px_rgba(2,12,27,0.35)] sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/80">Pulso financiero</p>
            <h3 className="text-base font-black text-white sm:text-lg">Distribucion de pagos</h3>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
              <span>Confirmados</span>
              <span className="font-bold text-emerald-300">{paymentDistribution.confirmedPct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-700/55">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300"
                style={{ width: `${paymentDistribution.confirmedPct}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
              <span>Pendientes</span>
              <span className="font-bold text-amber-300">{paymentDistribution.pendingPct}%</span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Variacion mensual</p>
              <p className="mt-1 text-xl font-black text-white">
                {businessInsights.growthPct >= 0 ? "+" : ""}
                {businessInsights.growthPct.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-300">vs mes anterior ({businessInsights.currentLabel})</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Ticket promedio</p>
              <p className="mt-1 text-xl font-black text-emerald-300">${businessInsights.avgTicket.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-slate-300">Pago medio por registro</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Ritmo de cobro</p>
              <p className="mt-1 text-xl font-black text-cyan-300">{businessInsights.avgPaymentsPerMonth.toFixed(1)}</p>
              <p className="text-xs text-slate-300">Pagos promedio por mes</p>
            </div>
          </div>
        </article>
      </section>

      <section className="mb-6 rounded-2xl border border-white/10 bg-slate-800/70 p-4 shadow-[0_14px_36px_rgba(2,12,27,0.26)] sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-300">
            Consolidado por mes en base a pagos registrados en Clientes.
          </p>
          <button
            type="button"
            onClick={exportarExcelIngresos}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Descargar Excel
          </button>
        </div>

        {resumenMensualIngresos.length === 0 ? (
          <p className="text-sm text-slate-400">No hay pagos suficientes para resumir por mes.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/70">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-slate-300">
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Pagos</th>
                  <th className="px-3 py-2">Clientes unicos</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {resumenMensualIngresos.map((row) => (
                  <tr key={row.mes} className="border-t border-white/10">
                    <td className="px-3 py-2 font-medium text-slate-100">{row.mes}</td>
                    <td className="px-3 py-2 text-slate-200">{row.cantidadPagos}</td>
                    <td className="px-3 py-2 text-slate-200">{row.clientesUnicos}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-300">
                      {row.moneda} {row.total.toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pagos */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Pagos
      </h2>
      <section className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          label="Pagos confirmados"
          value={stats.pagosConfirmados}
          accent="green"
        />
        <StatCard
          label="Pagos pendientes"
          value={stats.pagosPendientes}
          accent={stats.pagosPendientes > 0 ? "red" : "green"}
        />
        <StatCard
          label="Ingresos confirmados"
          value={
            stats.ingresosBrutos > 0
              ? `$${stats.ingresosBrutos.toLocaleString("es-AR")}`
              : "—"
          }
          accent="green"
        />
        <StatCard
          label="Saldo pendiente"
          value={
            stats.saldoPendiente > 0
              ? `$${stats.saldoPendiente.toLocaleString("es-AR")}`
              : "—"
          }
          accent={stats.saldoPendiente > 0 ? "yellow" : "green"}
        />
      </section>

      {/* Sesiones y tipo */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Sesiones y asesoría
      </h2>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <StatCard
          label="Sesiones creadas"
          value={stats.sesionesTotales}
          accent="blue"
        />
        <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-5 shadow-[0_14px_36px_rgba(2,12,27,0.26)]">
          <p className="text-sm text-slate-300">Tipo de asesoría</p>
          <div className="mt-3 space-y-1">
            {(["completa", "entrenamiento", "nutricion"] as const).map((tipo) => (
              <div key={tipo} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-300">{tipo}</span>
                <span className="font-semibold text-white">{stats.tipoAsesoria[tipo] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-5 shadow-[0_14px_36px_rgba(2,12,27,0.26)]">
          <p className="text-sm text-slate-300">Modalidad</p>
          <div className="mt-3 space-y-1">
            {(["presencial", "virtual"] as const).map((mod) => (
              <div key={mod} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-300">{mod}</span>
                <span className="font-semibold text-white">{stats.modalidades[mod] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Listado de clientes */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Todos los clientes ({allClientes.length})
      </h2>
      <section className="grid gap-3">
        {allClientes.length === 0 && (
          <p className="text-sm text-neutral-400">No hay clientes registrados aún.</p>
        )}
        {allClientes.map((cliente) => {
          const meta = clientesMeta[cliente.id] as ClienteMeta | undefined;
          return (
            <div
              key={cliente.id}
              className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-800/70 p-4 shadow-[0_14px_36px_rgba(2,12,27,0.26)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-100">{cliente.nombre}</p>
                <p className="text-xs text-slate-300">
                  {cliente.tipo}
                  {cliente.categoria ? ` · ${cliente.categoria}` : ""}
                  {cliente.club ? ` · ${cliente.club}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {meta?.startDate && (
                  <span className="rounded-full border border-slate-400/35 bg-slate-700/70 px-3 py-1 text-xs text-slate-200">
                    Desde {new Date(meta.startDate).toLocaleDateString("es-AR")}
                  </span>
                )}
                {meta?.tipoAsesoria && (
                  <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200 capitalize">
                    {meta.tipoAsesoria}
                  </span>
                )}
                {meta?.pagoEstado ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      meta.pagoEstado === "confirmado"
                        ? "border border-emerald-300/35 bg-emerald-400/10 text-emerald-200"
                        : "border border-rose-300/35 bg-rose-400/10 text-rose-200"
                    }`}
                  >
                    Pago {meta.pagoEstado}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    cliente.estado === "activo"
                      ? "border border-emerald-300/35 bg-emerald-400/10 text-emerald-200"
                      : "border border-slate-400/35 bg-slate-700/70 text-slate-200"
                  }`}
                >
                  {cliente.estado}
                </span>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}