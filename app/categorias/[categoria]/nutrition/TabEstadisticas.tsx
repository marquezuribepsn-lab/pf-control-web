"use client";

import { useMemo, useState } from "react";
import { argentineFoodsBase } from "../../../../data/argentineFoods";
import { GOAL_LABELS, GOAL_COLORS, getImcCategory } from "./constants";
import { buildFoodMap, calcPlanIntake, recordsForAlumno } from "./utils";
import type { NutritionHubState } from "./types";

type Props = Pick<
  NutritionHubState,
  "planes" | "assignments" | "customFoods" | "anthropometry" | "alumnosNombres"
>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = "text-slate-100",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ─── Bar chart (pure CSS) ─────────────────────────────────────────────────────

function BarChart({
  data,
  color = "#34d399",
  unit = "",
  maxVal,
}: {
  data: { label: string; value: number }[];
  color?: string;
  unit?: string;
  maxVal?: number;
}) {
  if (data.length === 0) return null;
  const max = maxVal ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-right text-xs text-slate-400">{label}</span>
          <div className="flex-1">
            <div className="relative h-6 overflow-hidden rounded-md bg-slate-800/60">
              <div
                className="absolute inset-y-0 left-0 rounded-md transition-all"
                style={{
                  width: `${(value / max) * 100}%`,
                  backgroundColor: color,
                  opacity: 0.75,
                }}
              />
              <span className="absolute inset-0 flex items-center pl-2 text-xs font-medium text-slate-200">
                {value.toFixed(0)}{unit}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SVG Weight trend ─────────────────────────────────────────────────────────

function WeightTrend({ data }: { data: { fecha: string; peso: number }[] }) {
  if (data.length < 2) {
    return (
      <p className="text-center text-sm text-slate-500 py-4">
        Necesitás al menos 2 registros para ver la tendencia.
      </p>
    );
  }

  const W = 400;
  const H = 100;
  const pesos = data.map((d) => d.peso);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const range = max - min || 1;

  const pts = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((d.peso - min) / range) * (H - 10) - 5;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: 100 }}
      >
        <defs>
          <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${H} ${pts} ${W},${H}`}
          fill="url(#wgrad)"
        />
        <polyline
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
          points={pts}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * W;
          const y = H - ((d.peso - min) / range) * (H - 10) - 5;
          return (
            <circle key={i} cx={x} cy={y} r="4" fill="#34d399" />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{data[0].fecha}</span>
        <span>{data[data.length - 1].fecha}</span>
      </div>
    </div>
  );
}

// ─── Donut (CSS conic-gradient) ───────────────────────────────────────────────

function DonutChart({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const gradient = segments
    .map(({ value, color }) => {
      const start = (cumulative / total) * 100;
      cumulative += value;
      const end = (cumulative / total) * 100;
      return `${color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative shrink-0"
        style={{
          width: 80,
          height: 80,
          background: `conic-gradient(${gradient})`,
          borderRadius: "50%",
          mask: "radial-gradient(circle at center, transparent 35%, black 36%)",
          WebkitMask: "radial-gradient(circle at center, transparent 35%, black 36%)",
        }}
      />
      <div className="space-y-1">
        {segments.map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-slate-400">{label}</span>
            <span className="font-semibold text-slate-200">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TabEstadisticas({
  planes,
  assignments,
  customFoods,
  anthropometry,
  alumnosNombres,
}: Props) {
  const [selectedAlumno, setSelectedAlumno] = useState<string>(alumnosNombres[0] ?? "");
  const foodMap = useMemo(
    () => buildFoodMap(argentineFoodsBase, customFoods),
    [customFoods]
  );

  // ── Global stats ──
  const totalPlanes = planes.length;
  const totalAsignados = assignments.length;
  const goalDistrib = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of planes) {
      counts.set(p.objetivo, (counts.get(p.objetivo) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([goal, count]) => ({
      label: GOAL_LABELS[goal as keyof typeof GOAL_LABELS] ?? goal,
      value: count,
    }));
  }, [planes]);

  const avgCalories = useMemo(() => {
    if (planes.length === 0) return 0;
    const sum = planes.reduce((acc, p) => {
      const intake = calcPlanIntake(p, foodMap);
      return acc + (intake.calorias > 0 ? intake.calorias : p.targets.calorias);
    }, 0);
    return Math.round(sum / planes.length);
  }, [planes, foodMap]);

  // ── Per-alumno ──
  const alumnoRecords = useMemo(
    () => recordsForAlumno(anthropometry, selectedAlumno),
    [anthropometry, selectedAlumno]
  );

  const weightData = alumnoRecords
    .filter((r) => r.pesoKg !== null)
    .map((r) => ({ fecha: r.fecha, peso: r.pesoKg as number }));

  const imcData = alumnoRecords
    .filter((r) => r.imc !== null)
    .map((r) => ({ fecha: r.fecha, imc: r.imc as number }));

  const alumnoPlans = useMemo(
    () => planes.filter((p) => assignments.some((a) => a.planId === p.id && a.alumnoNombre === selectedAlumno) || p.alumnoAsignado === selectedAlumno),
    [planes, assignments, selectedAlumno]
  );

  const latestRecord = alumnoRecords[alumnoRecords.length - 1];

  const goalChartData = [
    { label: "Objetivo", value: latestRecord ? 0 : 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-100">📊 Estadísticas</h2>
        <p className="mt-1 text-sm text-slate-400">Resumen global y evolución por alumno.</p>
      </div>

      {/* ── Global overview ── */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Resumen global</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Planes creados" value={String(totalPlanes)} color="text-emerald-400" />
          <StatCard label="Asignaciones" value={String(totalAsignados)} color="text-blue-400" />
          <StatCard
            label="Prom. kcal objetivo"
            value={avgCalories > 0 ? `${avgCalories}` : "—"}
            sub="kcal / día"
            color="text-amber-400"
          />
          <StatCard
            label="Registros antrop."
            value={String(anthropometry.length)}
            color="text-violet-400"
          />
        </div>
      </div>

      {/* ── Goal distribution ── */}
      {goalDistrib.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h3 className="mb-4 font-semibold text-slate-200">Distribución de objetivos</h3>
          <BarChart
            data={goalDistrib}
            color="#34d399"
            maxVal={Math.max(...goalDistrib.map((d) => d.value))}
          />
        </div>
      )}

      {/* ── Plan calories bar ── */}
      {planes.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h3 className="mb-4 font-semibold text-slate-200">Calorías objetivo por plan</h3>
          <BarChart
            data={planes.slice(0, 10).map((p) => ({
              label: p.nombre.slice(0, 16),
              value: p.targets.calorias,
            }))}
            color="#f59e0b"
            unit=" kcal"
          />
        </div>
      )}

      {/* ── Per-alumno section ── */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Por alumno</h3>
        {alumnosNombres.length > 0 ? (
          <select
            value={selectedAlumno}
            onChange={(e) => setSelectedAlumno(e.target.value)}
            className="mb-4 w-full max-w-sm rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
          >
            {alumnosNombres.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-500 mb-4">No hay alumnos cargados aún.</p>
        )}

        {selectedAlumno && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Weight trend */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h4 className="mb-3 font-semibold text-slate-200">⚖️ Evolución de peso</h4>
              <WeightTrend data={weightData} />
            </div>

            {/* IMC history */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h4 className="mb-3 font-semibold text-slate-200">📏 Historial de IMC</h4>
              {imcData.length === 0 ? (
                <p className="text-sm text-slate-500">Sin registros de IMC.</p>
              ) : (
                <div className="space-y-2">
                  {imcData.slice(-5).reverse().map((d, i) => {
                    const cat = getImcCategory(d.imc);
                    return (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                        <span className="text-xs text-slate-400">{d.fecha}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: cat.color }}>{d.imc.toFixed(1)}</span>
                          <span className="text-xs" style={{ color: cat.color }}>{cat.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Plans for this alumno */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 lg:col-span-2">
              <h4 className="mb-3 font-semibold text-slate-200">📋 Planes asignados</h4>
              {alumnoPlans.length === 0 ? (
                <p className="text-sm text-slate-500">Sin planes asignados.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {alumnoPlans.map((p) => {
                    const intake = calcPlanIntake(p, foodMap);
                    const kcal = intake.calorias > 0 ? intake.calorias : p.targets.calorias;
                    return (
                      <div key={p.id} className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
                        <p className="font-semibold text-slate-200">{p.nombre}</p>
                        <p className={`text-xs ${GOAL_COLORS[p.objetivo]}`}>{GOAL_LABELS[p.objetivo]}</p>
                        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                          <span className="text-slate-500">Target: <span className="text-amber-400">{p.targets.calorias} kcal</span></span>
                          {intake.calorias > 0 && (
                            <span className="text-slate-500">Real: <span className="text-emerald-400">{intake.calorias} kcal</span></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
