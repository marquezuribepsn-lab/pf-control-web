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
    <section className="rounded-xl border pf-v2-b-hi pf-v2-s-deep p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.18em] pf-v2-t-ok">
        {title || "Editor de mensaje"}
      </h3>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold pf-v2-t-70">Mensaje</label>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={applyNormalization}
            className="min-h-36 w-full rounded-lg border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm"
            placeholder="Escribe tu mensaje. Usa variables como {{nombre}}"
            disabled={disabled}
          />
          <p className="mt-2 text-xs pf-v2-t-50">
            El sistema detecta y normaliza automaticamente variables del tipo {'{'}nombre{'}'}, [[nombre]] y {'{{nombre}}'}.
          </p>

          {normalized.changed ? (
            <div className="mt-2 rounded-lg border pf-v2-b-accent pf-v2-s-accent px-3 py-2 text-xs pf-v2-t-accent">
              Se detectaron ajustes automaticos de formato. Al salir del campo, el texto se guarda normalizado.
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold pf-v2-t-70">Vista previa</label>
          <div className="min-h-36 rounded-lg border pf-v2-b-ok pf-v2-s-ok p-3 text-sm pf-v2-t-ok">
            {preview || "(sin contenido)"}
          </div>
          <p className="mt-2 text-xs pf-v2-t-50">Se renderiza con el destinatario seleccionado.</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border pf-v2-b pf-v2-s-deep p-3">
        <p className="text-xs font-semibold pf-v2-t">Validacion automatica</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border pf-v2-b pf-v2-s-deep p-2 text-[11px] pf-v2-t-70">
            <p className="font-semibold pf-v2-t">No editable (autocompletado por sistema)</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {detectedTokens.length === 0 ? (
                <span className="pf-v2-t-50">Sin variables detectadas</span>
              ) : (
                detectedTokens.map((item) => (
                  <span
                    key={`detected-${item}`}
                    className="rounded-full border pf-v2-b-accent pf-v2-s-accent px-2 py-0.5 pf-v2-t-accent"
                  >
                    {`{{${item}}}`}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border pf-v2-b pf-v2-s-deep p-2 text-[11px] pf-v2-t-70">
            <p className="font-semibold pf-v2-t">Editable por admin</p>
            <p className="mt-1">
              Todo el texto libre del mensaje. Las variables se completan solas con la ficha del alumno.
            </p>
          </div>
        </div>

        {normalized.unknownVariables.length > 0 ? (
          <div className="mt-2 rounded-lg border pf-v2-b-danger pf-v2-s-danger px-3 py-2 text-xs pf-v2-t-danger">
            Variables no validas: {normalized.unknownVariables.map((item) => `{{${item}}}`).join(", ")}
          </div>
        ) : null}

        {normalized.missingRequiredVariables.length > 0 ? (
          <div className="mt-2 rounded-lg border pf-v2-b-warn pf-v2-s-warn px-3 py-2 text-xs pf-v2-t-warn">
            Faltan variables requeridas: {normalized.missingRequiredVariables.map((item) => `{{${item}}}`).join(", ")}
          </div>
        ) : null}

        <p className="mt-3 text-xs font-semibold pf-v2-t">Variables disponibles</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {vars.length === 0 ? <span className="text-xs pf-v2-t-50">Sin variables</span> : null}
          {vars.map((item) => (
            <span key={item} className="rounded-full border pf-v2-b-accent pf-v2-s-accent px-2 py-1 text-[11px] pf-v2-t-accent">
              {`{{${item}}}`} = {variables[item]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
