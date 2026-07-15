"use client";

/**
 * InicioAnillos
 * Tarjeta "Próxima rutina" + 3 anillos (Entrenos de la semana, Agua de hoy,
 * Sueño de anoche) para el inicio del alumno.
 *
 * No existía en la app un sistema de agenda ("próximo entrenamiento con
 * horario") ni contadores diarios de agua/sueño/entrenos, así que estos
 * anillos son contadores locales *auto-reportados* por el alumno (igual
 * patrón de persistencia que el check-in semanal: useSharedState +
 * markManualSaveIntent). Agua y sueño se reinician solos cada día; entrenos
 * se reinicia cada semana (lunes). No se inventan valores: arrancan en 0/—
 * hasta que el alumno los toca.
 */

import { useCallback } from "react";
import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";
import { useHomeEvents } from "@/components/useHomeEvents";

const AGUA_KEY = "pf-control-inicio-agua-v1";
const SUENO_KEY = "pf-control-inicio-sueno-v1";
const ENTRENOS_KEY = "pf-control-inicio-entrenos-v1";

const AGUA_META = 8;
const ENTRENOS_META = 5;
const SUENO_PRESETS = [6, 6.5, 7, 7.5, 8, 8.5, 9];

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

function Ring({
  pct,
  color,
  trackColor,
  icon,
  value,
  label,
  onClick,
  ariaLabel,
}: {
  pct: number;
  color: string;
  trackColor: string;
  icon: React.ReactNode;
  value: string;
  label: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <button type="button" onClick={onClick} className="pf-a3-ring-item" aria-label={ariaLabel}>
      <span
        className="pf-a3-ring-track"
        style={{
          background: `conic-gradient(${color} ${clamped * 3.6}deg, ${trackColor} 0deg)`,
        }}
      >
        <span className="pf-a3-ring-hole">
          <span className="pf-a3-ring-icon" style={{ color }} aria-hidden="true">
            {icon}
          </span>
        </span>
      </span>
      <span className="pf-a3-ring-value">{value}</span>
      <span className="pf-a3-ring-label">{label}</span>
    </button>
  );
}

export default function InicioAnillos({ onComenzarRutina }: { onComenzarRutina?: () => void }) {
  const today = todayKey();
  const monday = mondayKey();
  const { addEvent } = useHomeEvents();

  const [aguaRaw, setAguaRaw] = useSharedState<AguaState>(
    { fecha: today, vasos: 0 },
    { key: AGUA_KEY, legacyLocalStorageKey: AGUA_KEY }
  );
  const [suenoRaw, setSuenoRaw] = useSharedState<SuenoState>(
    { fecha: today, horas: null },
    { key: SUENO_KEY, legacyLocalStorageKey: SUENO_KEY }
  );
  const [entrenosRaw, setEntrenosRaw] = useSharedState<EntrenosState>(
    { semana: monday, completados: 0 },
    { key: ENTRENOS_KEY, legacyLocalStorageKey: ENTRENOS_KEY }
  );

  const vasos = aguaRaw?.fecha === today ? Math.max(0, aguaRaw.vasos || 0) : 0;
  const horasSueno = suenoRaw?.fecha === today ? suenoRaw.horas ?? null : null;
  const entrenos = entrenosRaw?.semana === monday ? Math.max(0, entrenosRaw.completados || 0) : 0;

  const sumarAgua = useCallback(() => {
    markManualSaveIntent(AGUA_KEY);
    setAguaRaw((prev) => {
      const base = prev?.fecha === today ? prev.vasos || 0 : 0;
      return { fecha: today, vasos: Math.min(AGUA_META + 6, base + 1) };
    });
    addEvent("agua", "Sumaste un vaso de agua");
  }, [today, setAguaRaw, addEvent]);

  const ciclarSueno = useCallback(() => {
    markManualSaveIntent(SUENO_KEY);
    setSuenoRaw((prev) => {
      const current = prev?.fecha === today ? prev.horas ?? null : null;
      const idx = current == null ? -1 : SUENO_PRESETS.indexOf(current);
      const next = SUENO_PRESETS[(idx + 1) % SUENO_PRESETS.length];
      return { fecha: today, horas: next };
    });
    addEvent("sueno", `Registraste ${formatHoras(horasSueno)} de sueño`.replace("—", "tus horas"));
  }, [today, setSuenoRaw, addEvent, horasSueno]);

  const marcarEntreno = useCallback(() => {
    markManualSaveIntent(ENTRENOS_KEY);
    setEntrenosRaw((prev) => {
      const base = prev?.semana === monday ? prev.completados || 0 : 0;
      return { semana: monday, completados: Math.min(ENTRENOS_META + 5, base + 1) };
    });
    addEvent("entreno", "Marcaste un entrenamiento como completado");
  }, [monday, setEntrenosRaw, addEvent]);

  return (
    <>
      <div className="pf-a3-next-workout">
        <span className="pf-a3-next-workout-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
            <path d="M6.5 8.5v7M17.5 8.5v7" strokeLinecap="round" />
            <path d="M3.5 10.5v3M20.5 10.5v3" strokeLinecap="round" />
            <path d="M6.5 12h11" strokeLinecap="round" />
          </svg>
        </span>
        <div className="pf-a3-next-workout-info">
          <p className="pf-a3-next-workout-kicker">Tu entrenamiento</p>
          <p className="pf-a3-next-workout-title">Rutina de hoy</p>
          <p className="pf-a3-next-workout-sub">Toca comenzar para ver el plan del día</p>
        </div>
        <button type="button" onClick={onComenzarRutina} className="pf-a3-next-workout-cta">
          Comenzar
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3.5 w-3.5">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="pf-a3-rings-row">
        <Ring
          pct={(entrenos / ENTRENOS_META) * 100}
          color="#4ade80"
          trackColor="rgba(74, 222, 128, 0.14)"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M6.5 8.5v7M17.5 8.5v7" strokeLinecap="round" />
              <path d="M3.5 10.5v3M20.5 10.5v3" strokeLinecap="round" />
              <path d="M6.5 12h11" strokeLinecap="round" />
            </svg>
          }
          value={`${entrenos}/${ENTRENOS_META}`}
          label="Entrenos esta semana"
          ariaLabel="Marcar un entrenamiento de esta semana como completado"
          onClick={marcarEntreno}
        />
        <Ring
          pct={(vasos / AGUA_META) * 100}
          color="#38bdf8"
          trackColor="rgba(56, 189, 248, 0.14)"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M12 3.8c2.7 3.1 5.2 6.2 5.2 9.2a5.2 5.2 0 1 1-10.4 0c0-3 2.5-6.1 5.2-9.2Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          value={`${vasos}/${AGUA_META}`}
          label="Agua vasos hoy"
          ariaLabel="Sumar un vaso de agua de hoy"
          onClick={sumarAgua}
        />
        <Ring
          pct={horasSueno == null ? 0 : (horasSueno / 9) * 100}
          color="#818cf8"
          trackColor="rgba(129, 140, 248, 0.14)"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M20 13.2a8 8 0 1 1-9.2-9.1 6.4 6.4 0 0 0 9.2 9.1Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          value={formatHoras(horasSueno)}
          label="Sueño esta noche"
          ariaLabel="Registrar horas de sueño de anoche"
          onClick={ciclarSueno}
        />
      </div>
    </>
  );
}
