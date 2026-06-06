"use client";

/**
 * DateInput — campo de texto libre para fechas.
 *
 * El usuario tipea dígitos y las barras "/" aparecen solas:
 *   03    →  "03"
 *   0309  →  "03/09"
 *   03091990 →  "03/09/1990"
 *
 * - value / onChange usan formato yyyy-mm-dd internamente.
 * - Nunca abre el calendario nativo del browser (type="text").
 * - autoComplete="off" impide que el browser detecte el campo como fecha.
 */

import { useState } from "react";

// yyyy-mm-dd → DD/MM/YYYY  (para mostrar)
function toDisplay(stored: string): string {
  if (!stored) return "";
  const p = stored.split("-");
  if (p.length === 3 && p[0].length === 4 && p[1] && p[2]) {
    return `${p[2].padStart(2, "0")}/${p[1].padStart(2, "0")}/${p[0]}`;
  }
  return "";
}

// 8 dígitos crudos → "DD/MM/YYYY"
function insertSlashes(digits: string): string {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// DD/MM/YYYY (8 dígitos completos) → yyyy-mm-dd si válido, o ""
function toStored(digits: string): string {
  if (digits.length < 8) return "";
  const day = +digits.slice(0, 2);
  const mon = +digits.slice(2, 4);
  const yr  = +digits.slice(4, 8);
  if (mon < 1 || mon > 12 || day < 1 || day > 31 || yr < 1900 || yr > new Date().getFullYear()) return "";
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

export default function DateInput({
  value,
  onChange,
  className = "",
  placeholder = "DD/MM/AAAA",
  required,
  id,
}: Props) {
  // El display se inicializa desde el value externo
  const [display, setDisplay] = useState(() => toDisplay(value));

  // Guarda el último value externo para detectar cambios externos
  const [lastExternal, setLastExternal] = useState(value);

  // Si el value externo cambió desde afuera (ej: abrir otro cliente), sincroniza
  if (value !== lastExternal) {
    setLastExternal(value);
    setDisplay(toDisplay(value));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Extrae solo dígitos de lo que escribió el usuario
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = insertSlashes(digits);
    setDisplay(formatted);

    if (digits.length === 0) {
      onChange("");
    } else if (digits.length === 8) {
      const stored = toStored(digits);
      if (stored) onChange(stored);
    }
    // Si está incompleto todavía, no actualiza el padre
  }

  const digits   = display.replace(/\D/g, "");
  const complete = digits.length === 8;
  const valid    = complete && toStored(digits) !== "";

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={10}
        required={required}
        className={className}
      />
      {complete && (
        <span
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${
            valid ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {valid ? "✓" : "✗"}
        </span>
      )}
    </div>
  );
}
