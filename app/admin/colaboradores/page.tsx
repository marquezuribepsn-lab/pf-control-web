"use client";
import Link from 'next/link';
import { ColaboradoresProvider, useColaboradores } from '@/components/ColaboradoresProvider';

function ColaboradoresList() {
  const { colaboradores, loading, error } = useColaboradores();

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-slate-100">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-72 rounded-xl bg-slate-800" />
          <div className="h-28 rounded-2xl bg-slate-800" />
          <div className="h-28 rounded-2xl bg-slate-800" />
        </div>
      </main>
    );
  }

  const activos = colaboradores.filter((c: any) => c.estado !== 'suspendido').length;
  const suspendidos = colaboradores.filter((c: any) => c.estado === 'suspendido').length;

  return (
    <main className="mx-auto max-w-6xl p-6 text-slate-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Admin colaboradores</h1>
          <p className="text-sm text-slate-300">Gestiona permisos, estado y asignaciones del equipo.</p>
        </div>

        <Link
          href="/admin/colaboradores/nuevo"
          className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:from-emerald-300 hover:to-cyan-300"
        >
          + Nuevo colaborador
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard title="Total" value={colaboradores.length} tone="from-cyan-500/20 to-blue-500/20" />
        <StatCard title="Activos" value={activos} tone="from-emerald-500/20 to-teal-500/20" />
        <StatCard title="Suspendidos" value={suspendidos} tone="from-rose-500/20 to-red-500/20" />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/15 p-3 text-sm font-semibold text-rose-200">
          {error}
        </div>
      )}

      {colaboradores.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
          Aun no hay colaboradores creados.
        </div>
      ) : (
        <div className="space-y-4">
          {colaboradores.map((colab: any) => {
            const permisos = [
              colab.puedeEditarRegistros ? 'Editar registros' : null,
              colab.puedeEditarPlanes ? 'Editar planes' : null,
              colab.puedeVerTodosAlumnos ? 'Ver todos alumnos' : null,
            ].filter(Boolean);

            return (
              <Link
                key={colab.id}
                href={`/admin/colaboradores/${colab.id}`}
                className="block rounded-2xl border border-white/10 bg-slate-900/65 p-5 transition hover:border-cyan-300/50 hover:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-white">{colab.nombreCompleto}</p>
                    <p className="text-sm text-slate-300">{colab.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      colab.estado === 'suspendido'
                        ? 'bg-rose-500/20 text-rose-200'
                        : 'bg-emerald-500/20 text-emerald-200'
                    }`}
                  >
                    {colab.estado === 'suspendido' ? 'Suspendido' : 'Activo'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold text-slate-100">Permisos</p>
                    <p>{permisos.length ? permisos.join(' • ') : 'Sin permisos especiales'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">Alumnos asignados</p>
                    <p>
                      {colab.colaboraciones?.length
                        ? colab.colaboraciones.map((a: any) => a.alumno?.nombreCompleto).filter(Boolean).join(', ')
                        : 'Sin asignaciones'}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function StatCard({ title, value, tone }: { title: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-r ${tone} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{title}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

export default function ColaboradoresPage() {
  return (
    <ColaboradoresProvider>
      <ColaboradoresList />
    </ColaboradoresProvider>
  );
}
