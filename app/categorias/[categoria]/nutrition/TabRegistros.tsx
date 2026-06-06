"use client";

import { useState, useMemo } from "react";
import { markManualSaveIntent } from "../../../../components/useSharedState";
import { ANTHROPOMETRY_KEY, getImcCategory } from "./constants";
import { calcImc, calcNavyBodyFat, parseNum, uid, recordsForAlumno } from "./utils";
import type { AnthropometryRecord, NutritionHubState } from "./types";

type Props = Pick<NutritionHubState, "anthropometry" | "setAnthropometry" | "alumnosNombres">;

// ─── Tiny SVG sparkline ───────────────────────────────────────────────────────

function Sparkline({ data, color = "#34d399" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 120;
  const h = 36;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={(data.length - 1) / (data.length - 1) * w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r="3"
        fill={color}
      />
    </svg>
  );
}

// ─── Form modal ───────────────────────────────────────────────────────────────

function RecordForm({
  alumnosNombres,
  initial,
  onSave,
  onCancel,
}: {
  alumnosNombres: string[];
  initial?: Partial<AnthropometryRecord>;
  onSave: (r: AnthropometryRecord) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [alumno, setAlumno] = useState(initial?.alumnoNombre ?? alumnosNombres[0] ?? "");
  const [fecha, setFecha] = useState(initial?.fecha ?? today);
  const [peso, setPeso] = useState(String(initial?.pesoKg ?? ""));
  const [alturaCm, setAlturaCm] = useState(String(initial?.alturaCm ?? ""));
  const [cintura, setCintura] = useState(String(initial?.cinturaCm ?? ""));
  const [cadera, setCadera] = useState(String(initial?.caderaCm ?? ""));
  const [cuello, setCuello] = useState(String(initial?.cuelloCm ?? ""));
  const [brazo, setBrazo] = useState(String(initial?.brazoCm ?? ""));
  const [muslo, setMuslo] = useState(String(initial?.musloCm ?? ""));
  const [notas, setNotas] = useState(initial?.notas ?? "");

  const pesoN = parseNum(peso, 0);
  const alturaaN = parseNum(alturaCm, 0);
  const cinturaaN = parseNum(cintura, 0);
  const caderaaN = parseNum(cadera, 0);
  const cuelloN = parseNum(cuello, 0);

  const imc = pesoN > 0 && alturaaN > 0 ? calcImc(pesoN, alturaaN) : null;
  const navyBf =
    cinturaaN > 0 && cuelloN > 0 && alturaaN > 0
      ? calcNavyBodyFat("femenino", alturaaN, cinturaaN, cuelloN, caderaaN || undefined)
      : null;

  function handleSave() {
    if (!alumno) return;
    const record: AnthropometryRecord = {
      id: initial?.id ?? uid("anth"),
      alumnoNombre: alumno,
      fecha,
      pesoKg: pesoN || null,
      alturaCm: alturaaN || null,
      imc,
      cinturaCm: cinturaaN || null,
      caderaCm: caderaaN || null,
      cuelloCm: cuelloN || null,
      brazoCm: parseNum(brazo, 0) || null,
      musloCm: parseNum(muslo, 0) || null,
      grasaCorporalPct: navyBf !== null ? Math.max(3, navyBf) : null,
      notas,
    };
    onSave(record);
  }

  const inputCls =
    "w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-bold text-slate-100">
          {initial?.id ? "Editar registro" : "Nuevo registro antropométrico"}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Alumno</label>
            {alumnosNombres.length > 0 ? (
              <select value={alumno} onChange={(e) => setAlumno(e.target.value)} className={inputCls}>
                {alumnosNombres.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            ) : (
              <input value={alumno} onChange={(e) => setAlumno(e.target.value)} placeholder="Nombre del alumno" className={inputCls} />
            )}
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
          </div>

          {[
            { label: "Peso (kg)", value: peso, set: setPeso },
            { label: "Altura (cm)", value: alturaCm, set: setAlturaCm },
            { label: "Cintura (cm)", value: cintura, set: setCintura },
            { label: "Cadera (cm)", value: cadera, set: setCadera },
            { label: "Cuello (cm)", value: cuello, set: setCuello },
            { label: "Brazo (cm)", value: brazo, set: setBrazo },
            { label: "Muslo (cm)", value: muslo, set: setMuslo },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
              <input
                type="number"
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder="—"
                className={inputCls}
              />
            </div>
          ))}

          {/* Auto-calculated */}
          {imc !== null && (
            <div className="col-span-2 flex gap-3">
              <div className="flex-1 rounded-lg bg-emerald-500/10 px-3 py-2">
                <p className="text-xs text-slate-500">IMC calculado</p>
                <p className="font-bold text-emerald-400">{imc.toFixed(1)} — {getImcCategory(imc).label}</p>
              </div>
              {navyBf !== null && (
                <div className="flex-1 rounded-lg bg-blue-500/10 px-3 py-2">
                  <p className="text-xs text-slate-500">% Grasa (Navy)</p>
                  <p className="font-bold text-blue-400">{Math.max(3, navyBf).toFixed(1)}%</p>
                </div>
              )}
            </div>
          )}

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones opcionales..."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!alumno}
            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            Guardar
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Student card ─────────────────────────────────────────────────────────────

function AlumnoCard({
  alumnoNombre,
  records,
  onAdd,
  onDelete,
}: {
  alumnoNombre: string;
  records: AnthropometryRecord[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const last = records[records.length - 1];
  const weightHistory = records.map((r) => r.pesoKg).filter(Boolean) as number[];
  const imcHistory = records.map((r) => r.imc).filter(Boolean) as number[];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-slate-100">{alumnoNombre}</h4>
          <p className="text-xs text-slate-500">{records.length} registro{records.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {weightHistory.length >= 2 && (
            <Sparkline data={weightHistory} color="#34d399" />
          )}
          <button
            onClick={onAdd}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
          >
            + Registro
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-700"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Summary of last record */}
      {last && (
        <div className="mt-3 flex flex-wrap gap-2">
          {last.pesoKg && (
            <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">
              ⚖️ {last.pesoKg} kg
            </span>
          )}
          {last.imc && (
            <span className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: `${getImcCategory(last.imc).color}22`, color: getImcCategory(last.imc).color }}>
              IMC {last.imc.toFixed(1)}
            </span>
          )}
          {last.grasaCorporalPct && (
            <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">
              🔬 {last.grasaCorporalPct.toFixed(1)}% grasa
            </span>
          )}
          {last.cinturaCm && (
            <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">
              📐 {last.cinturaCm} cm cintura
            </span>
          )}
          <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-500">
            📅 {last.fecha}
          </span>
        </div>
      )}

      {/* Sparklines */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {imcHistory.length >= 2 && (
            <div>
              <p className="mb-1 text-xs text-slate-500">Tendencia IMC</p>
              <Sparkline data={imcHistory} color="#a78bfa" />
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="pb-1 text-left">Fecha</th>
                  <th className="pb-1 text-right">Peso</th>
                  <th className="pb-1 text-right">IMC</th>
                  <th className="pb-1 text-right">Cintura</th>
                  <th className="pb-1 text-right">% Grasa</th>
                  <th className="pb-1" />
                </tr>
              </thead>
              <tbody>
                {[...records].reverse().map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-1.5 text-slate-300">{r.fecha}</td>
                    <td className="py-1.5 text-right text-slate-300">{r.pesoKg ? `${r.pesoKg}` : "—"}</td>
                    <td className="py-1.5 text-right" style={{ color: r.imc ? getImcCategory(r.imc).color : "#64748b" }}>
                      {r.imc ? r.imc.toFixed(1) : "—"}
                    </td>
                    <td className="py-1.5 text-right text-slate-300">{r.cinturaCm ?? "—"}</td>
                    <td className="py-1.5 text-right text-slate-300">
                      {r.grasaCorporalPct ? `${r.grasaCorporalPct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-1.5 pl-2">
                      <button
                        onClick={() => onDelete(r.id)}
                        className="text-slate-600 hover:text-red-400"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab component ────────────────────────────────────────────────────────────

export default function TabRegistros({ anthropometry, setAnthropometry, alumnosNombres }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [formAlumno, setFormAlumno] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const alumnosWithRecords = useMemo(() => {
    const names = new Set(anthropometry.map((r) => r.alumnoNombre));
    alumnosNombres.forEach((n) => names.add(n));
    return Array.from(names).sort();
  }, [anthropometry, alumnosNombres]);

  const filtered = alumnosWithRecords.filter((n) =>
    n.toLowerCase().includes(search.toLowerCase())
  );

  function handleSave(record: AnthropometryRecord) {
    markManualSaveIntent(ANTHROPOMETRY_KEY);
    setAnthropometry((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const existing = base.findIndex((r) => r.id === record.id);
      if (existing >= 0) {
        const next = [...base];
        next[existing] = record;
        return next;
      }
      return [...base, record];
    });
    setShowForm(false);
    setFormAlumno(null);
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    markManualSaveIntent(ANTHROPOMETRY_KEY);
    setAnthropometry((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-5">
      {showForm && (
        <RecordForm
          alumnosNombres={formAlumno ? [formAlumno, ...alumnosNombres.filter((n) => n !== formAlumno)] : alumnosNombres}
          initial={formAlumno ? { alumnoNombre: formAlumno } : undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setFormAlumno(null); }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-100">📏 Registros Antropométricos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Historial de medidas corporales, IMC y % grasa por alumno.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormAlumno(null); }}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          + Nuevo registro
        </button>
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar alumno..."
        className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
      />

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <p className="text-slate-500">
            {search ? "No hay alumnos que coincidan." : "Aún no hay registros. Agrega el primero."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((nombre) => (
            <AlumnoCard
              key={nombre}
              alumnoNombre={nombre}
              records={recordsForAlumno(anthropometry, nombre)}
              onAdd={() => { setFormAlumno(nombre); setShowForm(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
