"use client";

/**
 * RutinaPrintOverlay
 * Full-screen preview + print/PDF export of a training routine, styled to match
 * the clean tabular layout used in the admin PDF (SEMANA · DIA header, section
 * bars, per-exercise tables with Series/Rep./Desc./métricas/Carga/Observaciones
 * and SUPERSERIE labels).
 *
 * Modes:
 *  - "dia"          → current day, real data
 *  - "semana"       → full week, real data
 *  - "dia-blanco"   → planilla de sesión: mantiene nombres de ejercicios y
 *                     encabezados, vacía las celdas de valores para anotar a mano.
 *  - "semana-blanco"→ igual que dia-blanco pero para la semana completa.
 *
 * Printing uses the browser's native window.print() (→ "Guardar como PDF").
 * No extra npm packages required.
 */

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

export type RutinaPrintMode = "dia" | "semana" | "dia-blanco" | "semana-blanco";

// ─── minimal structural types (compatible with page.tsx WeekPlanLite etc.) ──
type PrintExercise = {
  id: string;
  ejercicioId: string;
  series: string;
  repeticiones: string;
  descanso: string;
  carga: string;
  observaciones?: string;
  metricas?: Array<{ nombre?: string; valor?: string }>;
  superSerie?: Array<{
    id: string;
    ejercicioId: string;
    series: string;
    repeticiones: string;
    descanso: string;
    carga: string;
  }>;
};

type PrintBlock = {
  id: string;
  titulo: string;
  objetivo: string;
  ejercicios: PrintExercise[];
};

type PrintDay = {
  id: string;
  dia: string;
  planificacion: string;
  objetivo: string;
  oculto?: boolean;
  entrenamiento?: { bloques: PrintBlock[] };
};

type PrintWeek = {
  id: string;
  nombre: string;
  objetivo: string;
  dias: PrintDay[];
};

type EjercicioLite = { id: string; nombre: string };

type Props = {
  mode: RutinaPrintMode;
  clientName: string;
  professorName?: string;
  week: PrintWeek | null;
  day: PrintDay | null;
  ejercicios: EjercicioLite[];
  onClose: () => void;
};

const PRINT_STYLES = `
.pf-rutina-print-overlay {
  position: fixed; inset: 0; z-index: 2147483000;
  background: #525659; overflow: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
}
.pfr-topbar {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 18px; background: #1f2937; color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.35);
}
.pfr-topbar h2 { font-size: 14px; font-weight: 700; margin: 0; }
.pfr-topbar p { font-size: 11px; opacity: .7; margin: 2px 0 0; }
.pfr-btn {
  border: 0; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 700;
  cursor: pointer;
}
.pfr-btn-secondary { background: rgba(255,255,255,.12); color: #fff; }
.pfr-btn-secondary:hover { background: rgba(255,255,255,.2); }
.pfr-btn-primary { background: #2563eb; color: #fff; }
.pfr-btn-primary:hover { background: #1d4ed8; }

.pfr-doc {
  max-width: 900px; margin: 24px auto; padding: 40px 44px;
  background: #fff; color: #111; border-radius: 6px;
  box-shadow: 0 10px 40px rgba(0,0,0,.4);
}
.pfr-doc-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 20px;
}
.pfr-brand { display: flex; align-items: center; gap: 12px; }
.pfr-logo {
  width: 48px; height: 48px; border-radius: 12px;
  background: linear-gradient(160deg, #f97316 0%, #c2410c 100%);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 19px; letter-spacing: .02em;
  box-shadow: 0 6px 16px -6px rgba(249,115,22,.7);
}
.pfr-brand-name { font-size: 17px; font-weight: 900; margin: 0; letter-spacing: .01em; color: #111; }
.pfr-doc-header .pfr-kicker { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: #9ca3af; margin: 2px 0 0; }
.pfr-doc-header .pfr-meta { text-align: right; font-size: 11px; color: #6b7280; line-height: 1.6; }
.pfr-doc-header .pfr-client { font-size: 20px; font-weight: 900; margin: 0 0 2px; color: #111; }
.pfr-doc-header .pfr-meta b { color: #111; font-weight: 700; }

.pfr-overline {
  font-size: 12px; letter-spacing: .08em; color: #6b7280;
  text-transform: uppercase; margin: 0 0 12px;
}
.pfr-section-bar {
  background: #e9eaec; color: #111; font-weight: 800; text-transform: uppercase;
  font-size: 14px; padding: 10px 14px; border-radius: 4px; margin: 18px 0 12px;
}
.pfr-superserie {
  color: #2f6df6; font-weight: 800; font-size: 12px; letter-spacing: .06em;
  text-transform: uppercase; margin: 14px 0 4px; border-left: 3px solid #2f6df6; padding-left: 8px;
}
.pfr-ex-name { font-weight: 800; font-size: 15px; margin: 10px 0 4px; }
.pfr-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
.pfr-table th {
  background: #f3f4f6; border: 1px solid #d1d5db; padding: 7px 10px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; text-align: left; color: #374151;
}
.pfr-table td { border: 1px solid #d1d5db; padding: 7px 10px; font-size: 13px; color: #111; }
.pfr-blank td { height: 30px; }
.pfr-day + .pfr-day { margin-top: 28px; }
.pfr-empty { color: #9ca3af; font-style: italic; font-size: 13px; margin: 4px 0 12px; }

@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .pf-rutina-print-overlay, .pf-rutina-print-overlay * { visibility: visible !important; }
  .pf-rutina-print-overlay {
    position: absolute !important;
    top: 0 !important; left: 0 !important; right: 0 !important; bottom: auto !important;
    height: auto !important; background: #fff !important;
    overflow: visible !important;
  }
  .pfr-no-print { display: none !important; }
  .pfr-doc { box-shadow: none !important; margin: 0 auto !important; max-width: none !important; padding: 0 !important; border-radius: 0 !important; }
  body { zoom: 1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pfr-day-break { page-break-before: always; }
  .pfr-ex-group { page-break-inside: avoid; }
  @page { size: A4; margin: 1.2cm; }
}
`;

export default function RutinaPrintOverlay({
  mode,
  clientName,
  professorName,
  week,
  day,
  ejercicios,
  onClose,
}: Props) {
  const blank = mode === "dia-blanco" || mode === "semana-blanco";
  const wholeWeek = mode === "semana" || mode === "semana-blanco";

  const nameOf = useMemo(() => {
    const map = new Map(ejercicios.map((e) => [e.id, e.nombre]));
    return (id: string) => map.get(id) || id.replace(/[-_]/g, " ");
  }, [ejercicios]);

  const days = useMemo<PrintDay[]>(() => {
    if (!week) return [];
    if (wholeWeek) return week.dias.filter((d) => !d.oculto);
    return day ? [day] : [];
  }, [week, day, wholeWeek]);

  // Auto-open the print dialog shortly after mount (native "Save as PDF").
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        /* ignore */
      }
    }, 450);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cell = (raw: string | undefined) => (blank ? "" : (raw && raw.trim()) || "-");

  const generatedOn = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const renderDay = (d: PrintDay, idx: number) => {
    const bloques = (d.entrenamiento?.bloques ?? []).filter(
      (b) => (b.ejercicios?.length ?? 0) > 0
    );
    // Union of custom metric column names across the day's main exercises.
    const metricNames: string[] = [];
    bloques.forEach((b) =>
      b.ejercicios.forEach((ex) =>
        (ex.metricas ?? []).forEach((m) => {
          const n = (m.nombre || "").trim();
          if (n && !metricNames.includes(n)) metricNames.push(n);
        })
      )
    );

    const overline = `${week?.nombre ?? "Semana"} · ${d.dia}`.toUpperCase();

    const renderTable = (
      name: string,
      row: { series: string; repeticiones: string; descanso: string; carga: string; observaciones?: string; metricas?: Array<{ nombre?: string; valor?: string }> }
    ) => (
      <>
        <p className="pfr-ex-name">{name}</p>
        <table className={`pfr-table${blank ? " pfr-blank" : ""}`}>
          <thead>
            <tr>
              <th>Series</th>
              <th>Rep.</th>
              <th>Desc.</th>
              {metricNames.map((n) => (
                <th key={n}>{n}</th>
              ))}
              <th>Carga (kg)</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{cell(row.series)}</td>
              <td>{cell(row.repeticiones)}</td>
              <td>{cell(row.descanso)}</td>
              {metricNames.map((n) => {
                const found = (row.metricas ?? []).find(
                  (m) => (m.nombre || "").trim() === n
                );
                return <td key={n}>{cell(found?.valor)}</td>;
              })}
              <td>{cell(row.carga)}</td>
              <td>{cell(row.observaciones)}</td>
            </tr>
          </tbody>
        </table>
      </>
    );

    return (
      <div key={d.id} className={`pfr-day${idx > 0 ? " pfr-day-break" : ""}`}>
        <p className="pfr-overline">{overline}</p>
        {bloques.length === 0 ? (
          <p className="pfr-empty">Sin ejercicios asignados en este día.</p>
        ) : (
          bloques.map((bloque) => (
            <div key={bloque.id} className="pfr-block">
              <div className="pfr-section-bar">{bloque.titulo || "Bloque"}</div>
              {bloque.ejercicios.map((ex) => {
                const isSuper = (ex.superSerie?.length ?? 0) > 0;
                return (
                  <div key={ex.id} className="pfr-ex-group">
                    {isSuper && <div className="pfr-superserie">Superserie</div>}
                    {renderTable(nameOf(ex.ejercicioId), ex)}
                    {(ex.superSerie ?? []).map((s) =>
                      <div key={s.id}>{renderTable(nameOf(s.ejercicioId), s)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    );
  };

  if (typeof document === "undefined") return null;

  const overlay = (
    <div className="pf-rutina-print-overlay" role="dialog" aria-modal="true">
      <style>{PRINT_STYLES}</style>

      <div className="pfr-topbar pfr-no-print">
        <div>
          <h2>Vista de impresión — {wholeWeek ? "Semana completa" : "Día"}{blank ? " (en blanco)" : ""}</h2>
          <p>{clientName || "Rutina"} · Usá “Guardar como PDF” en el destino de impresión</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="pfr-btn pfr-btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button className="pfr-btn pfr-btn-primary" onClick={() => window.print()}>
            🖨️ Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <div className="pfr-doc">
        <div className="pfr-doc-header">
          <div className="pfr-brand">
            <div className="pfr-logo">PF</div>
            <div>
              <p className="pfr-brand-name">PF Control</p>
              <p className="pfr-kicker">Plan de entrenamiento</p>
            </div>
          </div>
          <div className="pfr-meta">
            <p className="pfr-client">{clientName || "Rutina"}</p>
            {professorName ? (
              <p style={{ margin: 0 }}>Profesor: <b>{professorName}</b></p>
            ) : null}
            {week?.nombre ? <p style={{ margin: 0 }}>{week.nombre}</p> : null}
            <p style={{ margin: 0 }}>Generado: {generatedOn}</p>
          </div>
        </div>

        {days.length === 0 ? (
          <p className="pfr-empty">No hay días para mostrar.</p>
        ) : (
          days.map((d, i) => renderDay(d, i))
        )}
      </div>
    </div>
  );

  // CANDADO TÉCNICO: el overlay SIEMPRE se renderiza en un portal a document.body.
  // Si queda dentro del árbol, algún ancestro con overflow/transform lo recorta y
  // en @media print el position:absolute cae fuera de la página → PDF en blanco.
  return createPortal(overlay, document.body);
}
