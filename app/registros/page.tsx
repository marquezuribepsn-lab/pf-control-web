"use client";

import Link from "@/components/ReliableLink";
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

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const PAGOS_KEY = "pf-control-pagos-v1";
const ASISTENCIAS_JORNADAS_KEY = "pf-control-asistencias-jornadas-v1";
const ASISTENCIAS_REGISTROS_KEY = "pf-control-asistencias-registros-v1";

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
    green: "text-green-600",
    red: "text-red-500",
    blue: "text-blue-600",
    yellow: "text-yellow-500",
  }[accent ?? "blue"] ?? "text-neutral-800";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
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
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">Registros</h1>
        <div className="flex gap-2">
          <Link href="/asistencias" className="rounded-xl border border-cyan-300/35 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10">
            Asistencias
          </Link>
          <Link href="/sesiones" className="rounded-xl border border-violet-300/35 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/10">
            Sesiones
          </Link>
          <Link href="/plantel" className="rounded-xl border border-emerald-300/35 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10">
            Plantel
          </Link>
        </div>
      </div>
      <p className="mb-6 text-sm text-slate-300">
        Resumen de clientes, pagos y operacion diaria conectada con asistencias.
      </p>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        <StatCard label="Jornadas activas" value={stats.jornadasActivas} accent="blue" />
        <StatCard label="Categorias activas" value={stats.categoriasConJornadas} accent="yellow" />
        <StatCard label="Presentes" value={stats.presentesAsistencia} accent="green" />
        <StatCard label="Ausentes" value={stats.ausentesAsistencia} accent="red" />
        <StatCard label="Presentismo general" value={`${stats.presentismoGeneral}%`} accent="blue" />
      </section>

      {/* Clientes */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
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

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Resumen mensual de ingresos
      </h2>
      <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
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
                    <td className="px-3 py-2 font-semibold text-green-700">
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
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
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
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Sesiones y asesoría
      </h2>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <StatCard
          label="Sesiones creadas"
          value={stats.sesionesTotales}
          accent="blue"
        />
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
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
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
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
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Todos los clientes ({allClientes.length})
      </h2>
      <section className="grid gap-3">
        {allClientes.length === 0 && (
          <p className="text-sm text-slate-400">No hay clientes registrados aún.</p>
        )}
        {allClientes.map((cliente) => {
          const meta = clientesMeta[cliente.id] as ClienteMeta | undefined;
          return (
            <div
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
                {meta?.startDate && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                    Desde {new Date(meta.startDate).toLocaleDateString("es-AR")}
                  </span>
                )}
                {meta?.tipoAsesoria && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 capitalize">
                    {meta.tipoAsesoria}
                  </span>
                )}
                {meta?.pagoEstado ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      meta.pagoEstado === "confirmado"
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-500"
                    }`}
                  >
                    Pago {meta.pagoEstado}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    cliente.estado === "activo"
                      ? "bg-green-50 text-green-600"
                      : "bg-neutral-100 text-neutral-500"
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