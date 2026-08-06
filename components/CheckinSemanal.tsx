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
import { useHomeEvents } from "@/components/useHomeEvents";
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
  bajo:  "pf-n-checkin-nivel-ok",
  medio: "pf-n-checkin-nivel-medio",
  alto:  "pf-n-checkin-nivel-alto",
};

const NIVEL_LABELS: Record<string, string> = {
  bajo:  "Sin alertas",
  medio: "Atención moderada",
  alto:  "⚠️ Revisión recomendada",
};

type Props = {
  alumnoNombre?: string;
  /** Modo compacto: solo pregunta 1 (sensación) + botón. Dolor/cambios quedan
   *  ocultos detrás de un enlace "+ Agregar" para no perder esos datos. */
  compact?: boolean;
};

export default function CheckinSemanal({ alumnoNombre, compact = false }: Props) {
  const [checkinsRaw, setCheckinsRaw] = useSharedState<unknown[]>([], {
    key: CHECKIN_KEY,
    legacyLocalStorageKey: CHECKIN_KEY,
    silentToasts: true,
  });

  const checkins = useMemo(() => normalizeCheckins(checkinsRaw), [checkinsRaw]);
  const { addEvent } = useHomeEvents();

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
  const [showExtra,    setShowExtra]    = useState(!compact);

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
    addEvent("checkin", `Hiciste tu check-in: ${record.sensacionLabel}`, record.dolor ? "Reportaste dolor o molestia" : undefined);

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
  }, [alumnoNombre, thisMonday, sensacion, dolor, dolorDetalle, cambios, setCheckinsRaw, addEvent]);

  const sensacionOpt = SENSACION_OPTS.find((o) => o.id === sensacion);
  void sensacionOpt;

  return (
    <div className="pf-n-checkin">
      <div className="pf-n-checkin-head">
        <h3 className="pf-n-checkin-title">
          {compact ? "Check-in de hoy" : "Check-in semanal"}
        </h3>
        {myCheckins.length > 0 && (
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="pf-n-checkin-link">
            {showHistory ? "Ocultar historial" : `Ver historial (${myCheckins.length})`}
          </button>
        )}
      </div>

      {submitted || alreadyThisWeek ? (
        <div className="pf-n-checkin-done">
          <span className="pf-n-checkin-done-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M4 10.5L8 14.5L16 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="pf-n-checkin-done-text">Check-in de esta semana registrado</p>

          {myCheckins[0] && (
            <p className="pf-n-checkin-done-meta">
              Semana del {formatDate(myCheckins[0].semanaOf)} ·{" "}
              {SENSACION_OPTS.find((o) => o.id === myCheckins[0].sensacion)?.emoji}{" "}
              {myCheckins[0].sensacionLabel}
              {myCheckins[0].dolor && " · dolor reportado"}
            </p>
          )}

          {analyzing && <p className="pf-n-checkin-done-meta">Analizando…</p>}

          {!analyzing && analysisResult && (
            <div className={`pf-n-checkin-nivel ${NIVEL_COLORS[analysisResult.nivel] || ""}`}>
              <p className="pf-n-checkin-nivel-title">{NIVEL_LABELS[analysisResult.nivel]}</p>
              <p className="pf-n-checkin-nivel-text">{analysisResult.resumen}</p>
              {analysisResult.palabrasClave?.length > 0 && (
                <div className="pf-n-checkin-tags">
                  {analysisResult.palabrasClave.map((kw) => (
                    <span key={kw} className="pf-n-checkin-tag">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="pf-n-checkin-q">
            {compact ? "¿Cómo te sentís hoy?" : "¿Cómo te sentiste esta semana?"}
          </p>
          <div className="pf-n-checkin-moods">
            {SENSACION_OPTS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSensacion(opt.id)}
                aria-pressed={sensacion === opt.id}
                className={`pf-n-checkin-mood${sensacion === opt.id ? " pf-n-checkin-mood-active" : ""}`}
              >
                <span className="pf-n-checkin-mood-emoji">{opt.emoji}</span>
                <span className="pf-n-checkin-mood-label">{opt.label}</span>
              </button>
            ))}
          </div>

          {showExtra && (
            <>
              <p className="pf-n-checkin-q">¿Tuviste algún dolor o molestia?</p>
              <div className="pf-n-checkin-pair">
                {[
                  { val: false, label: "No, todo bien", tone: "ok" },
                  { val: true, label: "Sí, tuve molestia", tone: "alert" },
                ].map(({ val, label, tone }) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setDolor(val)}
                    aria-pressed={dolor === val}
                    className={`pf-n-checkin-opt${dolor === val ? ` pf-n-checkin-opt-${tone}` : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {dolor && (
                <textarea
                  value={dolorDetalle}
                  onChange={(e) => setDolorDetalle(e.target.value)}
                  placeholder="¿Dónde? ¿Cuándo duele? (opcional)"
                  rows={2}
                  className="pf-n-checkin-textarea"
                />
              )}

              <p className="pf-n-checkin-q">
                ¿Algo cambió en tu rutina o en tu vida? <span>(opcional)</span>
              </p>
              <textarea
                value={cambios}
                onChange={(e) => setCambios(e.target.value)}
                placeholder="Ej: estuve de viaje, cambié el trabajo, dormí mal…"
                rows={2}
                className="pf-n-checkin-textarea"
              />
            </>
          )}

          <button type="button" onClick={handleSubmit} className="pf-n-cta pf-n-checkin-cta">
            {compact ? "Realizar check-in" : "Enviar check-in"}
          </button>

          {compact && !showExtra && (
            <button type="button" onClick={() => setShowExtra(true)} className="pf-n-checkin-link pf-n-checkin-more">
              Agregar dolor o cambios (opcional)
            </button>
          )}
        </>
      )}

      {showHistory && myCheckins.length > 0 && (
        <div className="pf-n-checkin-history">
          {myCheckins.slice(0, 8).map((c) => {
            const opt = SENSACION_OPTS.find((o) => o.id === c.sensacion);
            return (
              <div key={c.id} className="pf-n-checkin-hist-item">
                <div className="pf-n-checkin-hist-top">
                  <span className="pf-n-checkin-hist-date">Semana del {formatDate(c.semanaOf)}</span>
                  <span className="pf-n-checkin-hist-mood">
                    <span>{opt?.emoji}</span>
                    <span>{c.sensacionLabel}</span>
                    {c.dolor && <span className="pf-n-checkin-hist-pain">dolor</span>}
                    {c.claudeNivel && c.claudeNivel !== "bajo" && (
                      <span className={`pf-n-checkin-hist-nivel pf-n-checkin-hist-nivel-${c.claudeNivel}`}>
                        {c.claudeNivel}
                      </span>
                    )}
                  </span>
                </div>
                {c.dolorDetalle && <p className="pf-n-checkin-hist-meta">Molestia: {c.dolorDetalle}</p>}
                {c.cambios && <p className="pf-n-checkin-hist-meta">Cambios: {c.cambios}</p>}
                {c.claudeResumen && <p className="pf-n-checkin-hist-resumen">{c.claudeResumen}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
