"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWellness } from "../../components/WellnessProvider";

const SCORE_FIELDS = [
  { key: "bienestar", label: "Bienestar", icon: "💚", hint: "1 = muy mal, 10 = excelente", min: 1, max: 10 },
  { key: "fatiga", label: "Fatiga", icon: "😴", hint: "1 = sin fatiga, 10 = agotado", min: 1, max: 10 },
  { key: "dolor", label: "Dolor muscular", icon: "🩹", hint: "0 = sin dolor, 10 = dolor intenso", min: 0, max: 10 },
] as const;

function ScoreSlider({
  label,
  icon,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  icon: string;
  hint: string;
  value: string;
  min: number;
  max: number;
  onChange: (v: string) => void;
}) {
  const num = Number(value);
  const pct = ((num - min) / (max - min)) * 100;
  const isGoodHigh = label === "Bienestar";
  const color =
    isGoodHigh
      ? num >= 7 ? "text-emerald-300" : num >= 4 ? "text-amber-300" : "text-red-300"
      : num <= 3 ? "text-emerald-300" : num <= 6 ? "text-amber-300" : "text-red-300";

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-slate-200">{icon} {label}</span>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-2 w-full cursor-pointer accent-cyan-400"
        style={{ background: `linear-gradient(to right, rgb(34 211 238 / 0.7) ${pct}%, rgb(255 255 255 / 0.1) ${pct}%)` }}
      />
      <div className="mt-1 flex justify-between text-xs text-slate-600">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function NuevoWellnessPage() {
  const router = useRouter();
  const { agregarWellness } = useWellness();

  const [form, setForm] = useState({
    nombre: "",
    bienestar: "7",
    fatiga: "3",
    dolor: "1",
    disponibilidad: "Disponible",
    comentario: "",
  });

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    agregarWellness({
      nombre: form.nombre,
      bienestar: Number(form.bienestar),
      fatiga: Number(form.fatiga),
      dolor: Number(form.dolor),
      disponibilidad: form.disponibilidad,
      comentario: form.comentario,
    });
    router.push("/wellness");
  }

  const AVAIL_OPTIONS = [
    { value: "Disponible", label: "Disponible", color: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
    { value: "Limitada", label: "Limitada", color: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
    { value: "No disponible", label: "No disponible", color: "border-red-400/40 bg-red-400/10 text-red-300" },
  ];

  return (
    <main className="relative mx-auto max-w-[1480px] space-y-6 p-6 text-slate-100">
      {/* ── Header ── */}
      <section className="pf-page-hero mb-6">
        <div className="pf-blob pf-blob--tl" />
        <div className="pf-blob pf-blob--br" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="pf-page-hero-badge">💚 Monitoreo de Plantel</p>
            <h1 className="pf-page-hero-title">Nuevo Registro Wellness</h1>
            <p className="pf-page-hero-sub">
              Registrá el estado diario de una jugadora: bienestar, fatiga, dolor y disponibilidad.
            </p>
          </div>
          <Link href="/wellness" className="pf-btn pf-btn--ghost">
            ← Volver a Wellness
          </Link>
        </div>
      </section>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* ── Left: main fields ── */}
          <div className="space-y-6">
            {/* Nombre */}
            <div className="pf-card rounded-2xl border border-white/8 p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-200">👤 Jugadora</h2>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Nombre completo</label>
                <input
                  value={form.nombre}
                  onChange={(e) => updateField("nombre", e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-white/6 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30"
                  placeholder="Ej: Sofía Gómez"
                  required
                />
              </div>
            </div>

            {/* Scores */}
            <div className="pf-card rounded-2xl border border-white/8 p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-200">📊 Indicadores</h2>
              <div className="space-y-4">
                {SCORE_FIELDS.map((f) => (
                  <ScoreSlider
                    key={f.key}
                    label={f.label}
                    icon={f.icon}
                    hint={f.hint}
                    value={form[f.key]}
                    min={f.min}
                    max={f.max}
                    onChange={(v) => updateField(f.key, v)}
                  />
                ))}
              </div>
            </div>

            {/* Comentario */}
            <div className="pf-card rounded-2xl border border-white/8 p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-200">📝 Observaciones</h2>
              <textarea
                value={form.comentario}
                onChange={(e) => updateField("comentario", e.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-white/12 bg-white/6 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30"
                placeholder="Notas del estado diario, lesiones, sensaciones, etc."
              />
            </div>
          </div>

          {/* ── Right: availability + summary ── */}
          <div className="space-y-6">
            {/* Disponibilidad */}
            <div className="pf-card rounded-2xl border border-white/8 p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-200">📍 Disponibilidad</h2>
              <div className="space-y-2">
                {AVAIL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("disponibilidad", opt.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                      form.disponibilidad === opt.value
                        ? opt.color
                        : "border-white/8 bg-white/3 text-slate-400 hover:border-white/16 hover:text-slate-200"
                    }`}
                  >
                    {opt.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen */}
            <div className="pf-card rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-200">📋 Resumen</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Jugadora</span>
                  <span className="font-medium text-slate-200">{form.nombre || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Bienestar</span>
                  <span
                    className={`font-semibold ${
                      Number(form.bienestar) >= 7 ? "text-emerald-300" : Number(form.bienestar) >= 4 ? "text-amber-300" : "text-red-300"
                    }`}
                  >
                    {form.bienestar}/10
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fatiga</span>
                  <span className="font-semibold text-slate-200">{form.fatiga}/10</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dolor</span>
                  <span className="font-semibold text-slate-200">{form.dolor}/10</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Disponibilidad</span>
                  <span className="font-semibold text-slate-200">{form.disponibilidad}</span>
                </div>
              </div>

              <div className="mt-6">
                <ReliableActionButton
                  type="submit"
                  className="pf-btn pf-btn--success w-full justify-center"
                >
                  Guardar registro
                </ReliableActionButton>
              </div>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
