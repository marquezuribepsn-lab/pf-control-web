"use client";

/**
 * CheckinSemanal
 * 3-question weekly check-in for alumnos.
 * Stored in sync key "pf-control-checkin-semanal-v1".
 *
 * After submit, calls /api/alumno/checkin-analyze (Claude / rule-based)
 * and stores claudeNivel / claudeAlerta / claudeResumen on the record.
 *
 * Shows the last 4 check-ins in a read-only feed.
 * Prevents re-submitting the same week.
 */

import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";
import { useCallback, useMemo, useState } from "react";

const CHECKIN_KEY = "pf-control-checkin-semanal-v1";

const SENSACION_OPTS = [
  { id: "1", emoji: "😞", label: "Muy mal" },
  { id: "2", emoji: "😕", label: "Mal" },
  { id: "3", emoji: "😐", label: "Regular" },
  { id: "4", emoji: "🙂", label: "Bien" },
  { id: "5", emoji: "😄", label: "Excelente" },
];

export type CheckinRecord = {
  id:             string;
  alumnoNombre?:  string;
  semanaOf:       string;       // ISO date of the Monday of that week
  createdAt:      string;
  sensacion:      string;       // "1"–"5"
  sensacionLabel: string;
  dolor:          boolean;
  dolorDetalle?:  string;
  cambios?:       string;
  // Claude enrichment (added after submit)
  claudeNivel?:   "bajo" | "medio" | "alto";
  claudeAlerta?:  boolean;
  claudeResumen?: string;
  claudePalabras?: string[];
};

type AnalysisResult = {
  nivel:         "bajo" | "medio" | "alto";
  resumen:       string;
  alertaProfe:   boolean;
  palabrasClave: string[];
};

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function mkId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" });
}

function normalizeCheckins(raw: unknown): CheckinRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r: any) => ({
      id:             String(r.id || mkId()),
      alumnoNombre:   r.alumnoNombre ? String(r.alumnoNombre) : undefined,
      semanaOf:       String(r.semanaOf || ""),
      createdAt:      String(r.createdAt || ""),
      sensacion:      String(r.sensacion || "3"),
      sensacionLabel: String(r.sensacionLabel || ""),
      dolor:          Boolean(r.dolor),
      dolorDetalle:   r.dolorDetalle ? String(r.dolorDetalle) : undefined,
      cambios:        r.cambios ? String(r.cambios) : undefined,
      claudeNivel:    r.claudeNivel   || undefined,
      claudeAlerta:   r.claudeAlerta  ?? undefined,
      claudeResumen:  r.claudeResumen || undefined,
      claudePalabras: Array.isArray(r.claudePalabras) ? r.claudePalabras : undefined,
    }));
}

async function analyzeText(texto: string, tipo: "dolor" | "cambios" | "general"): Promise<AnalysisResult | null> {
  try {
    const res = await fetch("/api/alumno/checkin-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, tipo }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return await res.json() as AnalysisResult;
  } catch {
    return null;
  }
}

const NIVEL_COLORS: Record<string, string> = {
  bajo:  "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  medio: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  alto:  "border-rose-400/40 bg-rose-500/10 text-rose-300",
};

const NIVEL_LABELS: Record<string, string> = {
  bajo:  "Sin alertas",
  medio: "Atención moderada",
  alto:  "⚠️ Revisión recomendada",
};

type Props = {
  alumnoNombre?: string;
};

export default function CheckinSemanal({ alumnoNombre }: Props) {
  const [checkinsRaw, setCheckinsRaw] = useSharedState<unknown[]>([], {
    key: CHECKIN_KEY,
    legacyLocalStorageKey: CHECKIN_KEY,
  });

  const checkins = useMemo(() => normalizeCheckins(checkinsRaw), [checkinsRaw]);

  // My check-ins (filter by name if provided)
  const myCheckins = useMemo(() => {
    const list = alumnoNombre
      ? checkins.filter(
          (c) => (c.alumnoNombre || "").toLowerCase() === alumnoNombre.toLowerCase()
        )
      : checkins;
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [checkins, alumnoNombre]);

  // Check if already submitted this week
  const thisMonday = getMondayOf(new Date());
  const alreadyThisWeek = myCheckins.some((c) => c.semanaOf === thisMonday);

  // form state
  const [sensacion,    setSensacion]    = useState("3");
  const [dolor,        setDolor]        = useState(false);
  const [dolorDetalle, setDolorDetalle] = useState("");
  const [cambios,      setCambios]      = useState("");
  const [submitted,    setSubmitted]    = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);
  const [analyzing,    setAnalyzing]    = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleSubmit = useCallback(async () => {
    const opt = SENSACION_OPTS.find((o) => o.id === sensacion);
    const record: CheckinRecord = {
      id:            mkId(),
      alumnoNombre,
      semanaOf:      thisMonday,
      createdAt:     new Date().toISOString(),
      sensacion,
      sensacionLabel: opt?.label || sensacion,
      dolor,
      dolorDetalle:  dolor && dolorDetalle.trim() ? dolorDetalle.trim() : undefined,
      cambios:       cambios.trim() || undefined,
    };

    // Save immediately so the user sees confirmation
    markManualSaveIntent(CHECKIN_KEY);
    setCheckinsRaw((prev) => [record, ...normalizeCheckins(prev)]);
    setSubmitted(true);

    // Run Claude analysis on text fields (non-blocking UX)
    const hasDolorText  = dolor && Boolean(dolorDetalle.trim());
    const hasCambios    = Boolean(cambios.trim());

    if (hasDolorText || hasCambios) {
      setAnalyzing(true);
      try {
        // Analyze whichever text is more informative
        const texto = hasDolorText ? dolorDetalle.trim() : cambios.trim();
        const tipo  = hasDolorText ? "dolor" : "cambios";
        const result = await analyzeText(texto, tipo);

        if (result) {
          setAnalysisResult(result);
          // Patch the saved record with Claude enrichment
          markManualSaveIntent(CHECKIN_KEY);
          setCheckinsRaw((prev) => {
            const list = normalizeCheckins(prev);
            const idx  = list.findIndex((c) => c.id === record.id);
            if (idx === -1) return prev;
            const updated = [...list];
            updated[idx] = {
              ...updated[idx],
              claudeNivel:    result.nivel,
              claudeAlerta:   result.alertaProfe,
              claudeResumen:  result.resumen,
              claudePalabras: result.palabrasClave,
            };
            return updated;
          });
        }
      } finally {
        setAnalyzing(false);
      }
    }
  }, [alumnoNombre, thisMonday, sensacion, dolor, dolorDetalle, cambios, setCheckinsRaw]);

  const sensacionOpt = SENSACION_OPTS.find((o) => o.id === sensacion);
  void sensacionOpt;

  return (
    <div className="space-y-4">
      {/* Form card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-white/80">
            ✍️ Check-in semanal
          </h3>
          {myCheckins.length > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="text-xs text-violet-400/70 hover:text-violet-300 transition-colors"
            >
              {showHistory ? "Ocultar historial" : `Ver historial (${myCheckins.length})`}
            </button>
          )}
        </div>

        {submitted || alreadyThisWeek ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-semibold text-white/80">
              Check-in de esta semana registrado
            </p>
            {myCheckins[0] && (
              <div className="mt-1 rounded-xl border border-white/8 bg-white/5 px-4 py-2 text-xs text-white/50">
                Semana del {formatDate(myCheckins[0].semanaOf)} ·{" "}
                {SENSACION_OPTS.find((o) => o.id === myCheckins[0].sensacion)?.emoji}{" "}
                {myCheckins[0].sensacionLabel}
                {myCheckins[0].dolor && " · 🚨 Dolor reportado"}
              </div>
            )}

            {/* Claude analysis result */}
            {analyzing && (
              <div className="mt-2 flex items-center gap-2 text-xs text-white/40">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/20 border-t-violet-400" />
                Analizando con IA…
              </div>
            )}
            {!analyzing && analysisResult && (
              <div className={`mt-2 w-full rounded-xl border px-4 py-3 text-xs ${NIVEL_COLORS[analysisResult.nivel] || "border-white/10 bg-white/5 text-white/50"}`}>
                <p className="font-semibold mb-1">{NIVEL_LABELS[analysisResult.nivel]}</p>
                <p className="leading-relaxed">{analysisResult.resumen}</p>
                {analysisResult.palabrasClave?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {analysisResult.palabrasClave.map((kw) => (
                      <span key={kw} className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px]">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Q1: Sensación */}
            <div>
              <p className="mb-3 text-sm font-medium text-white/70">
                1. ¿Cómo te sentiste esta semana?
              </p>
              <div className="flex gap-2">
                {SENSACION_OPTS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSensacion(opt.id)}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 transition-all ${
                      sensacion === opt.id
                        ? "border-violet-400/60 bg-violet-500/15 text-white"
                        : "border-white/8 bg-white/[0.03] text-white/40 hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-[10px] leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Dolor / molestia */}
            <div>
              <p className="mb-2 text-sm font-medium text-white/70">
                2. ¿Tuviste algún dolor o molestia?
              </p>
              <div className="flex gap-2">
                {[
                  { val: false, label: "No, todo bien",    icon: "✅" },
                  { val: true,  label: "Sí, tuve molestia", icon: "🚨" },
                ].map(({ val, label, icon }) => (
                  <button
                    key={String(val)}
                    onClick={() => setDolor(val)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition-all ${
                      dolor === val
                        ? val
                          ? "border-rose-400/60 bg-rose-500/15 text-rose-200"
                          : "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                        : "border-white/8 bg-white/[0.03] text-white/40 hover:border-white/20"
                    }`}
                  >
                    <span>{icon}</span>
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
              {dolor && (
                <textarea
                  value={dolorDetalle}
                  onChange={(e) => setDolorDetalle(e.target.value)}
                  placeholder="¿Dónde? ¿Cuándo duele? (opcional)"
                  rows={2}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/40"
                />
              )}
            </div>

            {/* Q3: Cambios */}
            <div>
              <p className="mb-2 text-sm font-medium text-white/70">
                3. ¿Algo cambió en tu rutina o vida esta semana?{" "}
                <span className="text-xs text-white/30">(opcional)</span>
              </p>
              <textarea
                value={cambios}
                onChange={(e) => setCambios(e.target.value)}
                placeholder="Ej: estuve de viaje, cambie el trabajo, dormí mal..."
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/40"
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full rounded-xl bg-violet-500 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-400 active:scale-95 transition-all"
            >
              Enviar check-in 📤
            </button>
          </div>
        )}
      </div>

      {/* History */}
      {showHistory && myCheckins.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-white/30 px-1">Historial</p>
          {myCheckins.slice(0, 8).map((c) => {
            const opt = SENSACION_OPTS.find((o) => o.id === c.sensacion);
            return (
              <div
                key={c.id}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-white/40">
                    Semana del {formatDate(c.semanaOf)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{opt?.emoji}</span>
                    <span className="text-xs text-white/70">{c.sensacionLabel}</span>
                    {c.dolor && <span className="text-xs text-rose-400">🚨 dolor</span>}
                    {c.claudeNivel && c.claudeNivel !== "bajo" && (
                      <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${c.claudeNivel === "alto" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                        IA: {c.claudeNivel}
                      </span>
                    )}
                  </div>
                </div>
                {(c.dolorDetalle || c.cambios) && (
                  <div className="mt-1.5 space-y-0.5">
                    {c.dolorDetalle && (
                      <p className="text-xs text-white/40">Molestia: {c.dolorDetalle}</p>
                    )}
                    {c.cambios && (
                      <p className="text-xs text-white/40">Cambios: {c.cambios}</p>
                    )}
                  </div>
                )}
                {c.claudeResumen && (
                  <p className="mt-1 text-[11px] text-white/30 italic">{c.claudeResumen}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
