"use client";

/**
 * useHomeEvents
 * Bitácora local y liviana de "actividad reciente" del inicio del alumno
 * (agua, sueño, entrenos marcados, check-in). No es un sistema de auditoría:
 * es el mismo patrón de persistencia que ya usa CheckinSemanal
 * (useSharedState + markManualSaveIntent), acotado a los widgets nuevos del
 * inicio para poder mostrar un feed de "Actividad reciente" con datos reales
 * (generados por el propio alumno) en vez de inventados.
 */

import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";

const HOME_EVENTS_KEY = "pf-control-inicio-eventos-v1";
const MAX_EVENTS = 12;

export type HomeEventType = "checkin" | "agua" | "sueno" | "entreno" | "peso";

export type HomeEvent = {
  id: string;
  tipo: HomeEventType;
  label: string;
  detail?: string;
  timestamp: string; // ISO
};

function mkId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalize(raw: unknown): HomeEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r: any) => ({
      id: String(r.id || mkId()),
      tipo: (["checkin", "agua", "sueno", "entreno", "peso"].includes(r.tipo) ? r.tipo : "entreno") as HomeEventType,
      label: String(r.label || ""),
      detail: r.detail ? String(r.detail) : undefined,
      timestamp: String(r.timestamp || new Date().toISOString()),
    }))
    .slice(0, MAX_EVENTS);
}

export function useHomeEvents() {
  const [raw, setRaw] = useSharedState<unknown[]>([], {
    key: HOME_EVENTS_KEY,
    legacyLocalStorageKey: HOME_EVENTS_KEY,
  });

  const events = normalize(raw);

  const addEvent = (tipo: HomeEventType, label: string, detail?: string) => {
    markManualSaveIntent(HOME_EVENTS_KEY);
    setRaw((prev) => {
      const list = normalize(prev);
      const next: HomeEvent = {
        id: mkId(),
        tipo,
        label,
        detail,
        timestamp: new Date().toISOString(),
      };
      return [next, ...list].slice(0, MAX_EVENTS);
    });
  };

  return { events, addEvent };
}
