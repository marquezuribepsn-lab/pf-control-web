"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
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

type JornadaEntrenamiento = {
  id: string;
  categoria: string;
  fecha: string;
  suspendida?: boolean;
};

type AsistenciaRegistro = {
  jornadaId: string;
  jugadoraNombre: string;
  estado: "presente" | "ausente";
};

type CardTone = "cyan" | "emerald" | "rose" | "violet" | "amber" | "slate";

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const PAGOS_KEY = "pf-control-pagos-v1";
const ASISTENCIAS_JORNADAS_KEY = "pf-control-asistencias-jornadas-v1";
const ASISTENCIAS_REGISTROS_KEY = "pf-control-asistencias-registros-v1";

function StatCard({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: CardTone;
}) {
  const palette: Record<CardTone, { border: string; value: string }> = {
    cyan: { border: "border-cyan-300/35 bg-cyan-500/10", value: "text-cyan-100" },
    emerald: { border: "border-emerald-300/35 bg-emerald-500/10", value: "text-emerald-100" },
    rose: { border: "border-rose-300/35 bg-rose-500/10", value: "text-rose-100" },
    violet: { border: "border-violet-300/35 bg-violet-500/10", value: "text-violet-100" },
    amber: { border: "border-amber-300/35 bg-amber-500/10", value: "text-amber-100" },
    slate: { border: "border-white/15 bg-white/[0.03]", value: "text-slate-100" },
  };

  return (
    <article className={`rounded-2xl border p-4 ${palette[tone].border}`}>
      <p className="text-xs uppercase tracking-wide text-slate-300">{label}</p>
      <p className={`mt-2 text-3xl font-black ${palette[tone].value}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </article>
  );
}

function formatCurrency(value: number): string {
  if (value <= 0) return "-";
  return `$${value.toLocaleString("es-AR")}`;
}

export default function RegistrosPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const role = String((session?.user as { role?: string } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      return;
    }

    if (role === "ADMIN") {
      router.replace("/admin/pagos");
    }
  }, [role, router, sessionStatus]);

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
  const [jornadas] = useSharedState<JornadaEntrenamiento[]>([], {
    key: ASISTENCIAS_JORNADAS_KEY,
    legacyLocalStorageKey: ASISTENCIAS_JORNADAS_KEY,
  });
  const [asistenciaRegistros] = useSharedState<AsistenciaRegistro[]>([], {
    key: ASISTENCIAS_REGISTROS_KEY,
    legacyLocalStorageKey: ASISTENCIAS_REGISTROS_KEY,
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

    const presentesAsistencia = asistenciaRegistros.filter((r) => r.estado === "presente").length;
    const ausentesAsistencia = asistenciaRegistros.filter((r) => r.estado === "ausente").length;
    const totalAsistencia = presentesAsistencia + ausentesAsistencia;
    const presentismoGeneral = totalAsistencia > 0
      ? Math.round((presentesAsistencia / totalAsistencia) * 100)
      : 0;
    const jornadasActivas = jornadas.filter((j) => !j.suspendida).length;
    const categoriasConJornadas = new Set(
      jornadas
        .map((j) => (j.categoria || "").trim())
        .filter((categoria) => categoria.length > 0)
    ).size;

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
      jornadasActivas,
      categoriasConJornadas,
      presentesAsistencia,
      ausentesAsistencia,
      presentismoGeneral,
    };
  }, [jugadoras, alumnos, sesiones, clientesMeta, jornadas, asistenciaRegistros]);

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
    const agrupado: Record<string, { cantidadPagos: number; total: number; clientes: Set<string>; moneda: string }> = {};

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

  if (sessionStatus === "loading") {
    return (
      <main className="mx-auto max-w-[1500px] p-6 text-slate-100">
        <p className="text-sm text-slate-300">Cargando registros...</p>
      </main>
    );
  }

  if (role === "ADMIN") {
    return (
      <main className="mx-auto max-w-[1500px] p-6 text-slate-100">
        <p className="text-sm text-slate-300">Redirigiendo a Pagos mensuales...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-6 text-slate-100">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-900 via-cyan-950/45 to-slate-900 p-6 shadow-[0_20px_80px_rgba(6,182,212,0.12)]">
        <div className="pointer-events-none absolute -left-12 -top-14 h-44 w-44 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/80">Hub de analitica operativa</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Registros</h1>
          <p className="mt-2 text-sm text-slate-200/90">
            Vista consolidada de clientes, pagos y asistencia con la misma linea visual del modulo Clientes.
          </p>
        </div>

        <div className="relative mt-5 grid gap-3 md:grid-cols-3">
          <StatCard label="Total clientes" value={stats.totalClientes} tone="cyan" />
          <StatCard label="Ingresos confirmados" value={formatCurrency(stats.ingresosBrutos)} tone="emerald" />
          <StatCard label="Presentismo general" value={`${stats.presentismoGeneral}%`} tone="violet" />
        </div>
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Asistencia</h2>
        <p className="mt-1 text-sm text-slate-300">Estado actual de jornadas y presentismo.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <StatCard label="Jornadas activas" value={stats.jornadasActivas} tone="cyan" />
          <StatCard label="Categorias activas" value={stats.categoriasConJornadas} tone="amber" />
          <StatCard label="Presentes" value={stats.presentesAsistencia} tone="emerald" />
          <StatCard label="Ausentes" value={stats.ausentesAsistencia} tone="rose" />
          <StatCard label="Presentismo" value={`${stats.presentismoGeneral}%`} tone="violet" />
        </div>
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Clientes</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCard label="Total clientes" value={stats.totalClientes} tone="cyan" />
          <StatCard label="Activos" value={stats.activos} tone="emerald" />
          <StatCard label="Finalizados" value={stats.finalizados} tone="slate" />
          <StatCard label="Nuevos este mes" value={stats.nuevosEsteMes} sub={mesNombre} tone="violet" />
        </div>
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Resumen mensual de ingresos</h2>
            <p className="mt-1 text-sm text-slate-300">Consolidado por mes en base a pagos registrados en Clientes.</p>
          </div>
          <ReliableActionButton
            type="button"
            onClick={exportarExcelIngresos}
            className="rounded-xl border border-emerald-200/40 bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
          >
            Descargar Excel
          </ReliableActionButton>
        </div>

        {resumenMensualIngresos.length === 0 ? (
          <p className="text-sm text-slate-400">No hay pagos suficientes para resumir por mes.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-800 text-slate-200">
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
                    <td className="px-3 py-2 text-slate-300">{row.cantidadPagos}</td>
                    <td className="px-3 py-2 text-slate-300">{row.clientesUnicos}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-200">
                      {row.moneda} {row.total.toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Pagos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCard label="Pagos confirmados" value={stats.pagosConfirmados} tone="emerald" />
          <StatCard label="Pagos pendientes" value={stats.pagosPendientes} tone={stats.pagosPendientes > 0 ? "rose" : "emerald"} />
          <StatCard label="Ingresos confirmados" value={formatCurrency(stats.ingresosBrutos)} tone="emerald" />
          <StatCard label="Saldo pendiente" value={formatCurrency(stats.saldoPendiente)} tone={stats.saldoPendiente > 0 ? "amber" : "emerald"} />
        </div>
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Sesiones y asesoria</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <StatCard label="Sesiones creadas" value={stats.sesionesTotales} tone="cyan" />

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-sm font-semibold text-slate-300">Tipo de asesoria</p>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Completa</span>
                <span className="font-semibold text-slate-100">{stats.tipoAsesoria.completa ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Entrenamiento</span>
                <span className="font-semibold text-slate-100">{stats.tipoAsesoria.entrenamiento ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Nutricion</span>
                <span className="font-semibold text-slate-100">{stats.tipoAsesoria.nutricion ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-sm font-semibold text-slate-300">Modalidad</p>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Presencial</span>
                <span className="font-semibold text-slate-100">{stats.modalidades.presencial ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Virtual</span>
                <span className="font-semibold text-slate-100">{stats.modalidades.virtual ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="mb-3 text-xl font-bold">Todos los clientes ({allClientes.length})</h2>
        <div className="grid gap-3">
          {allClientes.length === 0 ? (
            <p className="text-sm text-slate-400">No hay clientes registrados aun.</p>
          ) : null}

          {allClientes.map((cliente) => {
            const meta = clientesMeta[cliente.id] as ClienteMeta | undefined;
            const estadoClienteClass =
              cliente.estado === "activo"
                ? "bg-emerald-500/10 text-emerald-200 border-emerald-300/35"
                : "bg-slate-500/10 text-slate-200 border-slate-300/35";

            const estadoPagoClass =
              meta?.pagoEstado === "confirmado"
                ? "bg-emerald-500/10 text-emerald-200 border-emerald-300/35"
                : "bg-rose-500/10 text-rose-200 border-rose-300/35";

            return (
              <article
                key={cliente.id}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-100">{cliente.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {cliente.tipo}
                    {cliente.categoria ? ` · ${cliente.categoria}` : ""}
                    {cliente.club ? ` · ${cliente.club}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {meta?.startDate ? (
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
                      Desde {new Date(meta.startDate).toLocaleDateString("es-AR")}
                    </span>
                  ) : null}

                  {meta?.tipoAsesoria ? (
                    <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-medium capitalize text-cyan-100">
                      {meta.tipoAsesoria}
                    </span>
                  ) : null}

                  {meta?.pagoEstado ? (
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${estadoPagoClass}`}>
                      Pago {meta.pagoEstado}
                    </span>
                  ) : null}

                  <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${estadoClienteClass}`}>
                    {cliente.estado}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
