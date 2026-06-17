"use client";

/**
 * /alumnos/plan-imprimir
 * Print-friendly version of the alumno's training plan.
 * Reads the plan from localStorage (pf-control-semana-plan) and
 * renders all weeks → days → blocks → exercises.
 * window.print() is triggered automatically on load.
 */

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

const WEEK_PLAN_KEY = "pf-control-semana-plan";

// ─── types (minimal subset needed for rendering) ────────────────
type WeekExercise = {
  id: string;
  ejercicioId: string;
  series: string;
  repeticiones: string;
  descanso: string;
  carga: string;
  observaciones?: string;
  superSerie?: Array<{ ejercicioId: string; series: string; repeticiones: string; carga: string }>;
};

type WeekBlock = {
  id: string;
  titulo: string;
  objetivo: string;
  ejercicios: WeekExercise[];
};

type WeekDay = {
  id: string;
  dia: string;
  planificacion: string;
  objetivo: string;
  oculto?: boolean;
  entrenamiento?: { bloques: WeekBlock[] };
};

type WeekPlan = {
  id: string;
  nombre: string;
  objetivo: string;
  oculto?: boolean;
  dias: WeekDay[];
};

type PersonPlan = {
  ownerKey: string;
  nombre: string;
  semanas: WeekPlan[];
};

// ─── helpers ─────────────────────────────────────────────────────
function readPlanFromStorage(ownerKey: string): PersonPlan | null {
  try {
    const raw = localStorage.getItem(WEEK_PLAN_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, PersonPlan>;
    // Try exact key, then case-insensitive
    const plan = store[ownerKey]
      ?? Object.values(store).find(
           (p) => (p.ownerKey || "").toLowerCase() === ownerKey.toLowerCase()
         );
    return plan ?? null;
  } catch {
    return null;
  }
}

function ExerciseRow({ ex, idx }: { ex: WeekExercise; idx: number }) {
  const name = ex.ejercicioId.replace(/[-_]/g, " ");
  const spec  = [
    ex.series && `${ex.series} series`,
    ex.repeticiones && `${ex.repeticiones} reps`,
    ex.carga && `@ ${ex.carga}`,
    ex.descanso && `· desc. ${ex.descanso}`,
  ].filter(Boolean).join(" ");

  return (
    <tr className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
      <td className="border border-gray-200 px-3 py-1.5 text-sm capitalize">{name}</td>
      <td className="border border-gray-200 px-3 py-1.5 text-sm text-gray-600">{spec || "—"}</td>
      <td className="border border-gray-200 px-3 py-1.5 text-sm text-gray-500">{ex.observaciones || ""}</td>
    </tr>
  );
}

export default function PlanImprimirPage() {
  const { data: session, status } = useSession();
  const [plan, setPlan] = useState<PersonPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  const userEmail = (session?.user as { email?: string } | undefined)?.email || "";
  const userName  = (session?.user as { name?: string } | undefined)?.name || "";

  useEffect(() => {
    if (status !== "authenticated") return;
    const ownerKey = userEmail || userName;
    if (!ownerKey) return;
    const p = readPlanFromStorage(ownerKey);
    setPlan(p);
    setLoaded(true);
  }, [status, userEmail, userName]);

  // Auto-print once loaded
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try { window.print(); } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [loaded]);

  const visibleWeeks = useMemo(
    () => (plan?.semanas ?? []).filter((w) => !w.oculto),
    [plan]
  );

  if (status === "loading" || !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-400 text-sm">Cargando plan…</p>
      </div>
    );
  }

  if (!plan || visibleWeeks.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white p-8">
        <p className="text-xl">📭</p>
        <p className="text-gray-500 text-sm">No se encontró plan de entrenamiento.</p>
        <button onClick={() => window.history.back()} className="text-blue-600 text-sm underline">
          Volver
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Print-only styles injected inline for reliability */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1.5cm; size: A4; }
          h2 { page-break-before: always; }
          h2:first-of-type { page-break-before: avoid; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; color: #111; }
      `}</style>

      {/* Action bar — hidden when printing */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-gray-800">Plan de entrenamiento</h1>
          <p className="text-xs text-gray-400">{plan.nombre}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.history.back()}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            ← Volver
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            🖨️ Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Printable content */}
      <main className="mx-auto max-w-4xl px-6 py-8">

        {/* Header */}
        <header className="mb-8 border-b-2 border-gray-900 pb-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400">Plan de entrenamiento</p>
              <h1 className="mt-1 text-2xl font-black text-gray-900">{plan.nombre}</h1>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Generado: {new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</p>
              <p className="mt-0.5">pf-control.com</p>
            </div>
          </div>
        </header>

        {/* Weeks */}
        {visibleWeeks.map((week, wIdx) => {
          const visibleDays = week.dias.filter((d) => !d.oculto);
          return (
            <section key={week.id} className={wIdx > 0 ? "mt-10" : ""}>
              <h2 className="mb-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
                {week.nombre}
                {week.objetivo && (
                  <span className="ml-3 text-xs font-normal text-gray-300 normal-case tracking-normal">
                    {week.objetivo}
                  </span>
                )}
              </h2>

              {visibleDays.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Sin días planificados.</p>
              ) : (
                <div className="space-y-6">
                  {visibleDays.map((day) => {
                    const bloques = day.entrenamiento?.bloques ?? [];
                    const hasBloques = bloques.some((b) => b.ejercicios.length > 0);
                    return (
                      <div key={day.id}>
                        {/* Day header */}
                        <div className="mb-2 flex items-baseline gap-3 border-b border-gray-300 pb-1">
                          <h3 className="text-base font-bold text-gray-900">{day.dia}</h3>
                          {day.objetivo && (
                            <span className="text-sm text-gray-500">{day.objetivo}</span>
                          )}
                          {day.planificacion && day.planificacion !== day.objetivo && (
                            <span className="text-xs text-gray-400">· {day.planificacion}</span>
                          )}
                        </div>

                        {!hasBloques ? (
                          <p className="text-sm text-gray-400 italic">Descanso / sin ejercicios asignados.</p>
                        ) : (
                          <div className="space-y-4">
                            {bloques.map((bloque) => {
                              if (bloque.ejercicios.length === 0) return null;
                              return (
                                <div key={bloque.id}>
                                  {/* Block header */}
                                  <div className="mb-1.5 flex items-baseline gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                                      {bloque.titulo || "Bloque"}
                                    </span>
                                    {bloque.objetivo && (
                                      <span className="text-xs text-gray-400">{bloque.objetivo}</span>
                                    )}
                                  </div>

                                  {/* Exercises table */}
                                  <table className="w-full border-collapse text-left">
                                    <thead>
                                      <tr className="bg-gray-100">
                                        <th className="border border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 w-2/5">Ejercicio</th>
                                        <th className="border border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 w-2/5">Series · Reps · Carga</th>
                                        <th className="border border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 w-1/5">Notas</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {bloque.ejercicios.map((ex, idx) => (
                                        <ExerciseRow key={ex.id} ex={ex} idx={idx} />
                                      ))}
                                    </tbody>
                                  </table>

                                  {/* Superseries note */}
                                  {bloque.ejercicios.some((e) => (e.superSerie?.length ?? 0) > 0) && (
                                    <p className="mt-1 text-xs text-gray-400 italic">
                                      * Los ejercicios en superserie se realizan consecutivamente sin descanso entre ellos.
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {/* Footer */}
        <footer className="mt-12 border-t border-gray-200 pt-4 text-center text-xs text-gray-300">
          <p>PFControl · pf-control.com · Documento generado el {new Date().toLocaleDateString("es-AR")}</p>
        </footer>
      </main>
    </>
  );
}
