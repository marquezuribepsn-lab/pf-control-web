"use client";

/**
 * InicioAnillos
 * Tarjeta "Rutina de hoy" + 3 anillos (Entrenos de la semana, Agua de hoy,
 * Sueño de anoche) para el inicio del alumno.
 *
 * Diseño: handoff "Rediseño PF Control Fitness" (`PF Control.dc.html`),
 * pantalla Inicio. Los anillos son SVG con stroke-dasharray, igual que el
 * handoff.
 *
 * No existe en la app un sistema de agenda ni contadores diarios de
 * agua/sueño/entrenos, así que estos anillos son contadores locales
 * *auto-reportados* por el alumno (mismo patrón de persistencia que el
 * check-in: useSharedState + markManualSaveIntent). Agua y sueño se
 * reinician solos cada día; entrenos se reinicia cada semana (lunes). No se
 * inventan valores: arrancan en 0/— hasta que el alumno los toca.
 */

import { useCallback, useState } from "react";
import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";
import { useHomeEvents } from "@/components/useHomeEvents";

const AGUA_KEY = "pf-control-inicio-agua-v1";
const SUENO_KEY = "pf-control-inicio-sueno-v1";
const ENTRENOS_KEY = "pf-control-inicio-entrenos-v1";

const AGUA_META = 8;
const ENTRENOS_META = 5;
const AGUA_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0..12 vasos
const SUENO_OPTIONS = Array.from({ length: 13 }, (_, i) => 4 + i * 0.5); // 4h..10h

/** Circunferencia de los anillos chicos (r=18) y del anillo del hero (r=25). */
const RING_C = 2 * Math.PI * 18;
const HERO_C = 2 * Math.PI * 25;

type AguaState = { fecha: string; vasos: number };
type SuenoState = { fecha: string; horas: number | null };
type EntrenosState = { semana: string; completados: number };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function mondayKey(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function formatHoras(h: number | null): string {
  if (h == null) return "—";
  const horas = Math.floor(h);
  const minutos = Math.round((h - horas) * 60);
  return minutos > 0 ? `${horas}h ${minutos}m` : `${horas}h`;
}

function dash(pct: number, circumference: number): string {
  const clamped = Math.max(0, Math.min(100, pct));
  return `${(clamped / 100) * circumference} ${circumference}`;
}

function Ring({
  pct,
  color,
  trackColor,
  icon,
  value,
  suffix,
  label,
  onClick,
  ariaLabel,
}: {
  pct: number;
  color: string;
  trackColor: string;
  icon: React.ReactNode;
  value: string;
  suffix?: string;
  label: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button type="button" onClick={onClick} className="pf-n-ring pf-n-quick-item" aria-label={ariaLabel}>
      <span className="pf-n-ring-track">
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r="18" fill="none" stroke={trackColor} strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={dash(pct, RING_C)}
          />
        </svg>
        <span className="pf-n-ring-icon" style={{ color }} aria-hidden="true">
          {icon}
        </span>
      </span>
      <span className="pf-n-ring-value">
        {value}
        {suffix ? <span>{suffix}</span> : null}
      </span>
      <span className="pf-n-ring-label">{label}</span>
    </button>
  );
}

export default function InicioAnillos({
  onComenzarRutina,
  rutinaResumen,
}: {
  onComenzarRutina?: () => void;
  /** Ej. "4 ejercicios · Lunes". Si no hay rutina resuelta se omite. */
  rutinaResumen?: string | null;
}) {
  const today = todayKey();
  const monday = mondayKey();
  const { addEvent } = useHomeEvents();

  const [aguaRaw, setAguaRaw] = useSharedState<AguaState>(
    { fecha: today, vasos: 0 },
    { key: AGUA_KEY, legacyLocalStorageKey: AGUA_KEY, silentToasts: true }
  );
  const [suenoRaw, setSuenoRaw] = useSharedState<SuenoState>(
    { fecha: today, horas: null },
    { key: SUENO_KEY, legacyLocalStorageKey: SUENO_KEY, silentToasts: true }
  );
  const [entrenosRaw, setEntrenosRaw] = useSharedState<EntrenosState>(
    { semana: monday, completados: 0 },
    { key: ENTRENOS_KEY, legacyLocalStorageKey: ENTRENOS_KEY, silentToasts: true }
  );

  const vasos = aguaRaw?.fecha === today ? Math.max(0, aguaRaw.vasos || 0) : 0;
  const horasSueno = suenoRaw?.fecha === today ? suenoRaw.horas ?? null : null;
  const entrenos = entrenosRaw?.semana === monday ? Math.max(0, entrenosRaw.completados || 0) : 0;

  const [activePicker, setActivePicker] = useState<"agua" | "sueno" | null>(null);

  const toggleAguaPicker = useCallback(() => {
    setActivePicker((prev) => (prev === "agua" ? null : "agua"));
  }, []);

  const toggleSuenoPicker = useCallback(() => {
    setActivePicker((prev) => (prev === "sueno" ? null : "sueno"));
  }, []);

  const elegirAgua = useCallback(
    (nextVasos: number) => {
      markManualSaveIntent(AGUA_KEY);
      setAguaRaw({ fecha: today, vasos: nextVasos });
      addEvent("agua", `Registraste ${nextVasos} vaso${nextVasos === 1 ? "" : "s"} de agua`);
      setActivePicker(null);
    },
    [today, setAguaRaw, addEvent]
  );

  const elegirSueno = useCallback(
    (nextHoras: number) => {
      markManualSaveIntent(SUENO_KEY);
      setSuenoRaw({ fecha: today, horas: nextHoras });
      addEvent("sueno", `Registraste ${formatHoras(nextHoras)} de sueño`);
      setActivePicker(null);
    },
    [today, setSuenoRaw, addEvent]
  );

  const marcarEntreno = useCallback(() => {
    markManualSaveIntent(ENTRENOS_KEY);
    setEntrenosRaw((prev) => {
      const base = prev?.semana === monday ? prev.completados || 0 : 0;
      return { semana: monday, completados: Math.min(ENTRENOS_META + 5, base + 1) };
    });
    addEvent("entreno", "Marcaste un entrenamiento como completado");
  }, [monday, setEntrenosRaw, addEvent]);

  const entrenosPct = (entrenos / ENTRENOS_META) * 100;

  return (
    <>
      {/* ── Tarjeta "Rutina de hoy" ───────────────────────────────────────── */}
      <div className="pf-n-hero">
        <div className="pf-n-hero-body">
          <span className="pf-n-hero-ring" aria-hidden="true">
            <svg width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />
              <circle
                cx="30"
                cy="30"
                r="25"
                fill="none"
                stroke="#67e8f9"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={dash(entrenosPct, HERO_C)}
              />
            </svg>
            <span className="pf-n-hero-ring-icon">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <rect x="1" y="10" width="4" height="4" rx="1" fill="#fff" />
                <rect x="19" y="10" width="4" height="4" rx="1" fill="#fff" />
                <rect x="6" y="8" width="3" height="8" rx="1" fill="#fff" />
                <rect x="15" y="8" width="3" height="8" rx="1" fill="#fff" />
                <rect x="9" y="11" width="6" height="2" fill="#fff" />
              </svg>
            </span>
          </span>

          <div className="pf-n-hero-text">
            <p className="pf-n-eyebrow">Tu entrenamiento</p>
            <p className="pf-n-hero-title">Rutina de hoy</p>
            <p className="pf-n-hero-meta">{rutinaResumen || "Toca comenzar para ver el plan del día"}</p>
          </div>
        </div>

        <button type="button" onClick={onComenzarRutina} className="pf-n-cta">
          Comenzar entrenamiento
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {/* ── Anillos ───────────────────────────────────────────────────────── */}
      <div className="pf-n-rings">
        <Ring
          pct={entrenosPct}
          color="#818cf8"
          trackColor="rgba(129,140,248,0.2)"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24">
              <rect x="1" y="10" width="4" height="4" rx="1" fill="currentColor" />
              <rect x="19" y="10" width="4" height="4" rx="1" fill="currentColor" />
              <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
            </svg>
          }
          value={String(entrenos)}
          suffix={`/${ENTRENOS_META}`}
          label="Entrenos"
          ariaLabel="Marcar un entrenamiento de esta semana como completado"
          onClick={marcarEntreno}
        />
        <span className="pf-n-vrule" aria-hidden="true" />
        <Ring
          pct={(vasos / AGUA_META) * 100}
          color="#60a5fa"
          trackColor="rgba(96,165,250,0.2)"
          icon={
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: "currentColor",
                opacity: 0.85,
                display: "block",
              }}
            />
          }
          value={String(vasos)}
          suffix={`/${AGUA_META}`}
          label="Agua"
          ariaLabel="Elegir cuantos vasos de agua tomaste hoy"
          onClick={toggleAguaPicker}
        />
        <span className="pf-n-vrule" aria-hidden="true" />
        <button
          type="button"
          onClick={toggleSuenoPicker}
          className="pf-n-ring pf-n-quick-item"
          aria-label="Elegir cuantas horas dormiste anoche"
        >
          <span className="pf-n-ring-track pf-n-ring-track-static">
            <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="rgba(196,181,253,0.25)"
                strokeWidth="4"
                strokeDasharray="3 4"
              />
            </svg>
            <span className="pf-n-ring-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 20 20">
                <path d="M15 10.5A6 6 0 1 1 9.5 5A7.5 7.5 0 0 0 15 10.5Z" fill="#c4b5fd" />
              </svg>
            </span>
          </span>
          <span className="pf-n-ring-value">{formatHoras(horasSueno)}</span>
          <span className="pf-n-ring-label">Sueño</span>
        </button>
      </div>

      {/* ── Selectores desplegables ───────────────────────────────────────── */}
      <div className="pf-expand-wrap" data-open={activePicker === "agua" ? "true" : "false"}>
        <div className="pf-expand-inner">
          <div className="pf-n-picker">
            <div className="pf-n-picker-head">
              <span className="pf-n-picker-title">Vasos de agua hoy</span>
              <button
                type="button"
                className="pf-n-picker-close"
                onClick={() => setActivePicker(null)}
                aria-label="Cerrar selector de agua"
              >
                ✕
              </button>
            </div>
            <div className="pf-n-picker-chips">
              {AGUA_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`pf-n-picker-chip${opt === vasos ? " pf-n-picker-chip-active" : ""}`}
                  onClick={() => elegirAgua(opt)}
                  aria-label={`${opt} vaso${opt === 1 ? "" : "s"} de agua`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pf-expand-wrap" data-open={activePicker === "sueno" ? "true" : "false"}>
        <div className="pf-expand-inner">
          <div className="pf-n-picker">
            <div className="pf-n-picker-head">
              <span className="pf-n-picker-title">Horas de sueño anoche</span>
              <button
                type="button"
                className="pf-n-picker-close"
                onClick={() => setActivePicker(null)}
                aria-label="Cerrar selector de sueño"
              >
                ✕
              </button>
            </div>
            <div className="pf-n-picker-chips">
              {SUENO_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`pf-n-picker-chip${opt === horasSueno ? " pf-n-picker-chip-active" : ""}`}
                  onClick={() => elegirSueno(opt)}
                  aria-label={`${formatHoras(opt)} de sueño`}
                >
                  {formatHoras(opt)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
