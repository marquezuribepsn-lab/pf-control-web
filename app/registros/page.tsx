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
    cyan: { border: "pf-v2-b-accent pf-v2-s-accent", value: "pf-v2-t-accent" },
    emerald: { border: "pf-v2-b-ok pf-v2-s-ok", value: "pf-v2-t-ok" },
    rose: { border: "pf-v2-b-danger pf-v2-s-danger", value: "pf-v2-t-danger" },
    violet: { border: "pf-v2-b-violet pf-v2-s-violet", value: "pf-v2-t-violet" },
    amber: { border: "pf-v2-b-warn pf-v2-s-warn", value: "pf-v2-t-warn" },
    slate: { border: "pf-v2-b pf-v2-s-deep", value: "pf-v2-t" },
  };

  return (
    <article className={`rounded-2xl border p-4 ${palette[tone].border}`}>
      <p className="text-xs uppercase tracking-wide pf-v2-t-70">{label}</p>
      <p className={`mt-2 text-3xl font-black${palette[tone].value}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs pf-v2-t-40">{sub}</p> : null}
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
      <main className="mx-auto max-w-[1500px] p-6 pf-v2-t">
        <p className="pf-v2-muted">Cargando registros...</p>
      </main>
    );
  }

  if (role === "ADMIN") {
    return (
      <main className="mx-auto max-w-[1500px] p-6 pf-v2-t">
        <p className="pf-v2-muted">Redirigiendo a Pagos mensuales...</p>
      </main>
    );
  }

  return (
    <div className="pf-v2-page">
      <section className="pf-v2-hero-block">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pf-v2-eyebrow">Hub de analítica operativa</span>
            <h1 className="pf-v2-h1" style={{ fontSize: 32 }}>Registros</h1>
            <p className="pf-v2-muted" style={{ marginTop: 8 }}>Vista consolidada de clientes, pagos y asistencia en un solo lugar.</p>
          </div>
        </div>
        <div className="relative mt-5 grid gap-3 md:grid-cols-3">
          <StatCard label="Total clientes" value={stats.totalClientes} tone="cyan" />
          <StatCard label="Ingresos confirmados" value={formatCurrency(stats.ingresosBrutos)} tone="emerald" />
          <StatCard label="Presentismo general" value={`${stats.presentismoGeneral}%`} tone="violet" />
        </div>
      </section>

      <section className="rounded-2xl border p-5">
        <h2 className="pf-v2-h2">Asistencia</h2>
        <p className="pf-v2-muted">Estado actual de jornadas y presentismo.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <StatCard label="Jornadas activas" value={stats.jornadasActivas} tone="cyan" />
          <StatCard label="Categorias activas" value={stats.categoriasConJornadas} tone="amber" />
          <StatCard label="Presentes" value={stats.presentesAsistencia} tone="emerald" />
          <StatCard label="Ausentes" value={stats.ausentesAsistencia} tone="rose" />
          <StatCard label="Presentismo" value={`${stats.presentismoGeneral}%`} tone="violet" />
        </div>
      </section>

      <section className="rounded-2xl border p-5">
        <h2 className="pf-v2-h2">Clientes</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCard label="Total clientes" value={stats.totalClientes} tone="cyan" />
          <StatCard label="Activos" value={stats.activos} tone="emerald" />
          <StatCard label="Finalizados" value={stats.finalizados} tone="slate" />
          <StatCard label="Nuevos este mes" value={stats.nuevosEsteMes} sub={mesNombre} tone="violet" />
        </div>
      </section>

      <section className="rounded-2xl border p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="pf-v2-h2">Resumen mensual de ingresos</h2>
            <p className="pf-v2-muted">Consolidado por mes en base a pagos registrados en Clientes.</p>
          </div>
          <ReliableActionButton
            type="button"
            onClick={exportarExcelIngresos}
            className="rounded-xl border pf-v2-b-ok pf-v2-s-ok px-4 py-2 text-sm font-black pf-v2-t transition pf-v2-hover"
          >
            Descargar Excel
          </ReliableActionButton>
        </div>

        {resumenMensualIngresos.length === 0 ? (
          <p className="pf-v2-muted">No hay pagos suficientes para resumir por mes.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border pf-v2-b">
            <table className="min-w-full text-left text-sm">
              <thead className="pf-v2-s-deep pf-v2-t-70">
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Pagos</th>
                  <th className="px-3 py-2">Clientes unicos</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {resumenMensualIngresos.map((row) => (
                  <tr key={row.mes} className="border-t pf-v2-b">
                    <td className="px-3 py-2 font-medium pf-v2-t">{row.mes}</td>
                    <td className="px-3 py-2 pf-v2-t-70">{row.cantidadPagos}</td>
                    <td className="px-3 py-2 pf-v2-t-70">{row.clientesUnicos}</td>
                    <td className="px-3 py-2 font-semibold pf-v2-t-ok">
                      {row.moneda} {row.total.toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border p-5">
        <h2 className="pf-v2-h2">Pagos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCard label="Pagos confirmados" value={stats.pagosConfirmados} tone="emerald" />
          <StatCard label="Pagos pendientes" value={stats.pagosPendientes} tone={stats.pagosPendientes > 0 ? "rose" : "emerald"} />
          <StatCard label="Ingresos confirmados" value={formatCurrency(stats.ingresosBrutos)} tone="emerald" />
          <StatCard label="Saldo pendiente" value={formatCurrency(stats.saldoPendiente)} tone={stats.saldoPendiente > 0 ? "amber" : "emerald"} />
        </div>
      </section>

      <section className="rounded-2xl border p-5">
        <h2 className="pf-v2-h2">Sesiones y asesoria</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <StatCard label="Sesiones creadas" value={stats.sesionesTotales} tone="cyan" />

          <div className="pf-v2-card">
            <p className="text-sm font-semibold pf-v2-t-70">Tipo de asesoria</p>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="pf-v2-t-70">Completa</span>
                <span className="font-semibold pf-v2-t">{stats.tipoAsesoria.completa ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="pf-v2-t-70">Entrenamiento</span>
                <span className="font-semibold pf-v2-t">{stats.tipoAsesoria.entrenamiento ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="pf-v2-t-70">Nutricion</span>
                <span className="font-semibold pf-v2-t">{stats.tipoAsesoria.nutricion ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="pf-v2-card">
            <p className="text-sm font-semibold pf-v2-t-70">Modalidad</p>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="pf-v2-t-70">Presencial</span>
                <span className="font-semibold pf-v2-t">{stats.modalidades.presencial ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="pf-v2-t-70">Virtual</span>
                <span className="font-semibold pf-v2-t">{stats.modalidades.virtual ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-5">
        <h2 className="mb-3 text-xl font-bold">Todos los clientes ({allClientes.length})</h2>
        <div className="grid gap-3">
          {allClientes.length === 0 ? (
            <p className="pf-v2-muted">No hay clientes registrados aun.</p>
          ) : null}

          {allClientes.map((cliente) => {
            const meta = clientesMeta[cliente.id] as ClienteMeta | undefined;
            const estadoClienteClass =
              cliente.estado === "activo"
                ? "pf-v2-s-ok pf-v2-t-ok pf-v2-b-ok"
                : "pf-v2-s pf-v2-t-70 pf-v2-b";

            const estadoPagoClass =
              meta?.pagoEstado === "confirmado"
                ? "pf-v2-s-ok pf-v2-t-ok pf-v2-b-ok"
                : "pf-v2-s-danger pf-v2-t-danger pf-v2-b-danger";

            return (
              <article
                key={cliente.id}
                className="pf-v2-card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold pf-v2-t">{cliente.nombre}</p>
                  <p className="text-xs pf-v2-t-40">
                    {cliente.tipo}
                    {cliente.categoria ? ` · ${cliente.categoria}` : ""}
                    {cliente.club ? ` · ${cliente.club}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {meta?.startDate ? (
                    <span className="rounded-full border pf-v2-b pf-v2-s-hi px-3 py-1 text-xs pf-v2-t-70">
                      Desde {new Date(meta.startDate).toLocaleDateString("es-AR")}
                    </span>
                  ) : null}

                  {meta?.tipoAsesoria ? (
                    <span className="rounded-full border pf-v2-b-accent pf-v2-s-accent px-3 py-1 text-xs font-medium capitalize pf-v2-t-accent">
                      {meta.tipoAsesoria}
                    </span>
                  ) : null}

                  {meta?.pagoEstado ? (
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium${estadoPagoClass}`}>
                      Pago {meta.pagoEstado}
                    </span>
                  ) : null}

                  <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize${estadoClienteClass}`}>
                    {cliente.estado}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
