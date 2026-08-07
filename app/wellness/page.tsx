"use client";

import Link from "@/components/ReliableLink";
import { useMemo, useState } from "react";
import { useWellness } from "../../components/WellnessProvider";
import type { WellnessItem } from "../../data/mockData";

const AVAIL_COLORS: Record<string, string> = {
  Disponible: "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok",
  Limitada: "pf-v2-b-warn pf-v2-s-warn pf-v2-t-warn",
  "No disponible": "pf-v2-b-danger pf-v2-s-danger pf-v2-t-danger",
};

function ScoreBadge({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100;
  const color =
    label === "Bienestar"
      ? value >= 7 ? "pf-v2-t-ok" : value >= 4 ? "pf-v2-t-warn" : "pf-v2-t-danger"
      : value <= 3 ? "pf-v2-t-ok" : value <= 6 ? "pf-v2-t-warn" : "pf-v2-t-danger";

  return (
    <div className="flex flex-col gap-1 rounded-xl border pf-v2-b pf-v2-s-hi p-3">
      <span className="text-xs pf-v2-t-50">{label}</span>
      <span className={`text-xl font-bold${color}`}>{value}<span className="text-sm font-normal pf-v2-t-40">/{max}</span></span>
      <div className="h-1 w-full overflow-hidden rounded-full pf-v2-s-hi">
        <div
          className={`h-full rounded-full transition-all ${
            label === "Bienestar"
              ? value >= 7 ? "pf-v2-s-ok" : value >= 4 ? "pf-v2-s-warn" : "pf-v2-s-danger"
              : value <= 3 ? "pf-v2-s-ok" : value <= 6 ? "pf-v2-s-warn" : "pf-v2-s-danger"
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
    <div className="pf-v2-page">
      {/* ── Header ── */}
      <section className="pf-v2-hero-block">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pf-v2-eyebrow">Monitoreo de Plantel</span>
            <h1 className="pf-v2-h1" style={{ fontSize: 32 }}>Wellness</h1>
            <p className="pf-v2-muted" style={{ marginTop: 8 }}>
              Estado diario del plantel: bienestar, fatiga, dolor y disponibilidad.
            </p>
          </div>
          <Link href="/nuevo-wellness" className="pf-v2-btn">
            + Nuevo registro
          </Link>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Registros cargados", value: stats.total, icon: "📋", tone: "pf-v2-b-accent" },
          {
            label: "Promedio bienestar",
            value: stats.promedio.toFixed(1),
            icon: "🌡️",
            tone: "pf-v2-b-ok",
          },
          { label: "Disponibles", value: stats.disponibles, icon: "✅", tone: "pf-v2-b-ok" },
          { label: "Limitadas / no disp.", value: stats.limitadas, icon: "⚠️", tone: "pf-v2-b-warn" },
        ].map((s) => (
          <div
            key={s.label}
            className={`pf-v2-card ${s.tone}`}
          >
            <p className="pf-v2-muted">{s.icon} {s.label}</p>
            <p className="mt-2 text-3xl font-bold pf-v2-t">{s.value}</p>
          </div>
        ))}
      </section>

      {/* ── Filters ── */}
      <section className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar jugadora…"
          className="h-10 min-w-[200px] rounded-xl border pf-v2-b-hi pf-v2-s-hi px-4 text-sm pf-v2-t pf-v2-ph outline-none focus:ring-1"
        />
        <div className="flex gap-2">
          {["Todos", "Disponible", "Limitada", "No disponible"].map((op) => (
            <button
              key={op}
              onClick={() => setFiltroDisp(op)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                filtroDisp === op
                  ? "pf-v2-b-accent pf-v2-s-accent pf-v2-t-accent"
                  : "pf-v2-b pf-v2-s-hi pf-v2-t-50"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      </section>

      {/* ── List ── */}
      {filteredList.length === 0 ? (
        <div className="pf-v2-card">
          <p className="text-4xl">💚</p>
          <p className="mt-3 text-lg font-semibold pf-v2-t">Sin registros</p>
          <p className="mt-1 text-sm pf-v2-t-40">
            {wellnessList.length === 0
              ? "Aún no hay registros de wellness cargados."
              : "No se encontraron registros con ese filtro."}
          </p>
          {wellnessList.length === 0 && (
            <Link href="/nuevo-wellness" className="pf-v2-btn">
              Cargar primer registro
            </Link>
          )}
        </div>
      ) : (
        <section className="grid gap-4">
          {filteredList.map((item: WellnessItem, idx: number) => (
            <div
              key={`${item.nombre}-${idx}`}
              className="pf-v2-card"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* Left: name + badge */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full pf-v2-s-hi text-lg font-bold pf-v2-t-70">
                    {item.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold pf-v2-t">{item.nombre}</h2>
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        AVAIL_COLORS[item.disponibilidad] ?? "pf-v2-b pf-v2-s-hi pf-v2-t-70"
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
                <div className="mt-4 rounded-xl border pf-v2-b pf-v2-s-hi p-3">
                  <p className="mb-1 text-xs pf-v2-t-40">Comentario</p>
                  <p className="text-sm pf-v2-t-70">{item.comentario}</p>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
