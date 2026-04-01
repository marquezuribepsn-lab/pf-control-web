"use client";

import { useMemo } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  variables: Record<string, string>;
  title?: string;
  disabled?: boolean;
};

function interpolate(message: string, variables: Record<string, string>) {
  return String(message || "").replace(/\{\{\s*([a-zA-Z0-9_\-.]+)\s*\}\}/g, (_full, key: string) => {
    return variables[key] ?? "";
  });
}

export default function WhatsAppMessageEditor({
  value,
  onChange,
  variables,
  title,
  disabled = false,
}: Props) {
  const preview = useMemo(() => interpolate(value, variables), [value, variables]);
  const vars = Object.keys(variables || {}).sort((a, b) => a.localeCompare(b));

  const insertVariable = (name: string) => {
    if (disabled) {
      return;
    }

    const token = `{{${name}}}`;
    const next = value && !value.endsWith(" ") ? `${value} ${token}` : `${value}${token}`;
    onChange(next);
  };

  return (
    <section className="rounded-xl border border-white/15 bg-slate-900/70 p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">
        {title || "Editor de mensaje"}
      </h3>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Mensaje</label>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-36 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            placeholder="Escribe tu mensaje. Usa variables como {{nombre}}"
            disabled={disabled}
          />
          <p className="mt-2 text-xs text-slate-400">Usa llaves dobles para variables dinamicas.</p>

          <div className="mt-2 flex flex-wrap gap-2">
            {vars.map((item) => (
              <button
                key={`insert-${item}`}
                type="button"
                onClick={() => insertVariable(item)}
                disabled={disabled}
                className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Insertar {`{{${item}}}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Vista previa</label>
          <div className="min-h-36 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {preview || "(sin contenido)"}
          </div>
          <p className="mt-2 text-xs text-slate-400">Se renderiza con el destinatario seleccionado.</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-slate-800/50 p-3">
        <p className="text-xs font-semibold text-slate-200">Variables disponibles</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {vars.length === 0 ? <span className="text-xs text-slate-400">Sin variables</span> : null}
          {vars.map((item) => (
            <span key={item} className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200">
              {`{{${item}}}`} = {variables[item]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
