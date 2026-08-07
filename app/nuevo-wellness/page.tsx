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
      ? num >= 7 ? "pf-v2-t-ok" : num >= 4 ? "pf-v2-t-warn" : "pf-v2-t-danger"
      : num <= 3 ? "pf-v2-t-ok" : num <= 6 ? "pf-v2-t-warn" : "pf-v2-t-danger";

  return (
    <div className="rounded-xl border pf-v2-b pf-v2-s-hi p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-sm font-medium pf-v2-t">{icon} {label}</span>
          <p className="text-xs pf-v2-t-40">{hint}</p>
        </div>
        <span className={`text-2xl font-bold${color}`}>{value}</span>
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
      <div className="mt-1 flex justify-between text-xs pf-v2-t-40">
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
    { value: "Disponible", label: "Disponible", color: "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok" },
    { value: "Limitada", label: "Limitada", color: "pf-v2-b-warn pf-v2-s-warn pf-v2-t-warn" },
    { value: "No disponible", label: "No disponible", color: "pf-v2-b-danger pf-v2-s-danger pf-v2-t-danger" },
  ];

  return (
    <div className="pf-v2-page">
      {/* ── Header ── */}
      <section className="pf-v2-hero-block">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pf-v2-eyebrow">Monitoreo de Plantel</span>
            <h1 className="pf-v2-h1" style={{ fontSize: 32 }}>Nuevo Registro Wellness</h1>
            <p className="pf-v2-muted" style={{ marginTop: 8 }}>
              Registrá el estado diario de una jugadora: bienestar, fatiga, dolor y disponibilidad.
            </p>
          </div>
          <Link href="/wellness" className="pf-v2-btn pf-v2-btn-2">
            ← Volver a Wellness
          </Link>
        </div>
      </section>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* ── Left: main fields ── */}
          <div className="space-y-6">
            {/* Nombre */}
            <div className="pf-v2-card">
              <h2 className="mb-4 text-base font-semibold pf-v2-t">👤 Jugadora</h2>
              <div>
                <label className="mb-1.5 block text-sm font-medium pf-v2-t-70">Nombre completo</label>
                <input
                  value={form.nombre}
                  onChange={(e) => updateField("nombre", e.target.value)}
                  className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-hi px-4 py-3 pf-v2-t pf-v2-ph outline-none transition focus:ring-1"
                  placeholder="Ej: Sofía Gómez"
                  required
                />
              </div>
            </div>

            {/* Scores */}
            <div className="pf-v2-card">
              <h2 className="mb-4 text-base font-semibold pf-v2-t">📊 Indicadores</h2>
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
            <div className="pf-v2-card">
              <h2 className="mb-4 text-base font-semibold pf-v2-t">📝 Observaciones</h2>
              <textarea
                value={form.comentario}
                onChange={(e) => updateField("comentario", e.target.value)}
                className="min-h-[120px] w-full rounded-xl border pf-v2-b-hi pf-v2-s-hi px-4 py-3 pf-v2-t pf-v2-ph outline-none transition focus:ring-1"
                placeholder="Notas del estado diario, lesiones, sensaciones, etc."
              />
            </div>
          </div>

          {/* ── Right: availability + summary ── */}
          <div className="space-y-6">
            {/* Disponibilidad */}
            <div className="pf-v2-card">
              <h2 className="mb-4 text-base font-semibold pf-v2-t">📍 Disponibilidad</h2>
              <div className="space-y-2">
                {AVAIL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("disponibilidad", opt.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                      form.disponibilidad === opt.value
                        ? opt.color
                        : "pf-v2-b pf-v2-s-hi pf-v2-t-50"
                    }`}
                  >
                    {opt.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen */}
            <div className="pf-v2-card">
              <h2 className="mb-4 text-base font-semibold pf-v2-t">📋 Resumen</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="pf-v2-t-50">Jugadora</span>
                  <span className="font-medium pf-v2-t">{form.nombre || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="pf-v2-t-50">Bienestar</span>
                  <span
                    className={`font-semibold ${
                      Number(form.bienestar) >= 7 ? "pf-v2-t-ok" : Number(form.bienestar) >= 4 ? "pf-v2-t-warn" : "pf-v2-t-danger"
                    }`}
                  >
                    {form.bienestar}/10
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="pf-v2-t-50">Fatiga</span>
                  <span className="font-semibold pf-v2-t">{form.fatiga}/10</span>
                </div>
                <div className="flex justify-between">
                  <span className="pf-v2-t-50">Dolor</span>
                  <span className="font-semibold pf-v2-t">{form.dolor}/10</span>
                </div>
                <div className="flex justify-between">
                  <span className="pf-v2-t-50">Disponibilidad</span>
                  <span className="font-semibold pf-v2-t">{form.disponibilidad}</span>
                </div>
              </div>

              <div className="mt-6">
                <ReliableActionButton
                  type="submit"
                  className="pf-v2-btn w-full justify-center"
                >
                  Guardar registro
                </ReliableActionButton>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
