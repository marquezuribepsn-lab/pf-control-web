"use client";

import Link from "@/components/ReliableLink";
import { useMemo, useState } from "react";
import { useWellness } from "../../components/WellnessProvider";
import type { WellnessItem } from "../../data/mockData";

const AVAIL_COLORS: Record<string, string> = {
  Disponible: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  Limitada: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  "No disponible": "border-red-400/40 bg-red-400/10 text-red-300",
};

function ScoreBadge({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100;
  const color =
    label === "Bienestar"
      ? value >= 7 ? "text-emerald-300" : value >= 4 ? "text-amber-300" : "text-red-300"
      : value <= 3 ? "text-emerald-300" : value <= 6 ? "text-amber-300" : "text-red-300";

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/8 bg-white/4 p-3">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{value}<span className="text-sm font-normal text-slate-500">/{max}</span></span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${
            label === "Bienestar"
              ? value >= 7 ? "bg-emerald-400" : value >= 4 ? "bg-amber-400" : "bg-red-400"
              : value <= 3 ? "bg-emerald-400" : value <= 6 ? "bg-amber-400" : "bg-red-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function WellnessPage() {
  const { wellness } = useWellness();
  const [busqueda, setBusqueda] = useState("");
  const [filtroDisp, setFiltroDisp] = useState<string>("Todos");

  const wellnessList: WellnessItem[] = Array.isArray(wellness) ? wellness : [];

  const stats = useMemo(() => {
    const total = wellnessList.length;
    const promedio =
      total > 0 ? wellnessList.reduce((a, i) => a + i.bienestar, 0) / total : 0;
    const limitadas = wellnessList.filter((i) => i.disponibilidad !== "Disponible").length;
    const disponibles = wellnessList.filter((i) => i.disponibilidad === "Disponible").length;
    return { total, promedio, limitadas, disponibles };
  }, [wellnessList]);

  const filteredList = useMemo(() => {
    let list = [...wellnessList];
    if (filtroDisp !== "Todos") list = list.filter((i) => i.disponibilidad === filtroDisp);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter((i) => i.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [wellnessList, filtroDisp, busqueda]);

  return (
    <main className="relative mx-auto max-w-[1480px] space-y-6 p-6 text-slate-100">
      {/* ── Header ── */}
      <section className="pf-page-hero mb-6">
        <div className="pf-blob pf-blob--tl" />
        <div className="pf-blob pf-blob--br" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="pf-page-hero-badge">💚 Monitoreo de Plantel</p>
            <h1 className="pf-page-hero-title">Wellness</h1>
            <p className="pf-page-hero-sub">
              Estado diario del plantel: bienestar, fatiga, dolor y disponibilidad.
            </p>
          </div>
          <Link href="/nuevo-wellness" className="pf-btn pf-btn--primary">
            + Nuevo registro
          </Link>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Registros cargados", value: stats.total, icon: "📋", tone: "border-cyan-300/26" },
          {
            label: "Promedio bienestar",
            value: stats.promedio.toFixed(1),
            icon: "🌡️",
            tone: "border-emerald-300/26",
          },
          { label: "Disponibles", value: stats.disponibles, icon: "✅", tone: "border-emerald-300/26" },
          { label: "Limitadas / no disp.", value: stats.limitadas, icon: "⚠️", tone: "border-amber-300/26" },
        ].map((s) => (
          <div
            key={s.label}
            className={`pf-card rounded-2xl border p-5 ${s.tone}`}
          >
            <p className="text-sm text-slate-400">{s.icon} {s.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-100">{s.value}</p>
          </div>
        ))}
      </section>

      {/* ── Filters ── */}
      <section className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar jugadora…"
          className="h-10 min-w-[200px] rounded-xl border border-white/12 bg-white/6 px-4 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30"
        />
        <div className="flex gap-2">
          {["Todos", "Disponible", "Limitada", "No disponible"].map((op) => (
            <button
              key={op}
              onClick={() => setFiltroDisp(op)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                filtroDisp === op
                  ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-300"
                  : "border-white/10 bg-white/4 text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      </section>

      {/* ── List ── */}
      {filteredList.length === 0 ? (
        <div className="pf-card rounded-2xl border border-white/8 p-12 text-center">
          <p className="text-4xl">💚</p>
          <p className="mt-3 text-lg font-semibold text-slate-200">Sin registros</p>
          <p className="mt-1 text-sm text-slate-500">
            {wellnessList.length === 0
              ? "Aún no hay registros de wellness cargados."
              : "No se encontraron registros con ese filtro."}
          </p>
          {wellnessList.length === 0 && (
            <Link href="/nuevo-wellness" className="pf-btn pf-btn--primary mt-5 inline-block">
              Cargar primer registro
            </Link>
          )}
        </div>
      ) : (
        <section className="grid gap-4">
          {filteredList.map((item: WellnessItem, idx: number) => (
            <div
              key={`${item.nombre}-${idx}`}
              className="pf-card rounded-2xl border border-white/8 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* Left: name + badge */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-lg font-bold text-slate-300">
                    {item.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-100">{item.nombre}</h2>
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        AVAIL_COLORS[item.disponibilidad] ?? "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      {item.disponibilidad}
                    </span>
                  </div>
                </div>

                {/* Right: score chips */}
                <div className="grid grid-cols-3 gap-3 lg:w-[420px]">
                  <ScoreBadge label="Bienestar" value={item.bienestar} />
                  <ScoreBadge label="Fatiga" value={item.fatiga} />
                  <ScoreBadge label="Dolor" value={item.dolor} />
                </div>
              </div>

              {item.comentario && (
                <div className="mt-4 rounded-xl border border-white/8 bg-white/3 p-3">
                  <p className="mb-1 text-xs text-slate-500">Comentario</p>
                  <p className="text-sm text-slate-300">{item.comentario}</p>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
