"use client";

import { useMemo } from "react";
import {
  extractTemplateVariables,
  normalizeTemplateMessage,
} from "@/lib/whatsappTemplateVariables";

type Props = {
  value: string;
  onChange: (value: string) => void;
  variables: Record<string, string>;
  requiredVariables?: string[];
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
  requiredVariables,
  title,
  disabled = false,
}: Props) {
  const vars = useMemo(
    () => Object.keys(variables || {}).sort((a, b) => a.localeCompare(b)),
    [variables]
  );

  const normalized = useMemo(
    () =>
      normalizeTemplateMessage(value, {
        allowedVariables: vars,
        requiredVariables,
      }),
    [value, vars, requiredVariables]
  );

  const detectedTokens = useMemo(
    () => extractTemplateVariables(normalized.message),
    [normalized.message]
  );

  const preview = useMemo(() => interpolate(normalized.message, variables), [normalized.message, variables]);

  const applyNormalization = () => {
    if (disabled || !normalized.changed) {
      return;
    }
    onChange(normalized.message);
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
            onBlur={applyNormalization}
            className="min-h-36 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            placeholder="Escribe tu mensaje. Usa variables como {{nombre}}"
            disabled={disabled}
          />
          <p className="mt-2 text-xs text-slate-400">
            El sistema detecta y normaliza automaticamente variables del tipo {'{'}nombre{'}'}, [[nombre]] y {'{{nombre}}'}.
          </p>

          {normalized.changed ? (
            <div className="mt-2 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
              Se detectaron ajustes automaticos de formato. Al salir del campo, el texto se guarda normalizado.
            </div>
          ) : null}
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
        <p className="text-xs font-semibold text-slate-200">Validacion automatica</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-2 text-[11px] text-slate-300">
            <p className="font-semibold text-slate-100">No editable (autocompletado por sistema)</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {detectedTokens.length === 0 ? (
                <span className="text-slate-400">Sin variables detectadas</span>
              ) : (
                detectedTokens.map((item) => (
                  <span
                    key={`detected-${item}`}
                    className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-100"
                  >
                    {`{{${item}}}`}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-2 text-[11px] text-slate-300">
            <p className="font-semibold text-slate-100">Editable por admin</p>
            <p className="mt-1">
              Todo el texto libre del mensaje. Las variables se completan solas con la ficha del alumno.
            </p>
          </div>
        </div>

        {normalized.unknownVariables.length > 0 ? (
          <div className="mt-2 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            Variables no validas: {normalized.unknownVariables.map((item) => `{{${item}}}`).join(", ")}
          </div>
        ) : null}

        {normalized.missingRequiredVariables.length > 0 ? (
          <div className="mt-2 rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Faltan variables requeridas: {normalized.missingRequiredVariables.map((item) => `{{${item}}}`).join(", ")}
          </div>
        ) : null}

        <p className="mt-3 text-xs font-semibold text-slate-200">Variables disponibles</p>
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
