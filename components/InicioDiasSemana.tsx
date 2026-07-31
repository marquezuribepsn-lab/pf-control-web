"use client";

/**
 * InicioDiasSemana
 * Tira Lun-Dom para el inicio del alumno. No existe en la app un calendario
 * de entrenamientos asignados por día, así que esta tira es puramente
 * informativa/de ubicación temporal: marca qué día es hoy dentro de la
 * semana y, cuando hay actividad real registrada ese día (vía useHomeEvents),
 * muestra un punto debajo del número. No inventa "entrenos asignados" por
 * día porque esa data no existe.
 */

import { useHomeEvents } from "@/components/useHomeEvents";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

function todayIndex(): number {
  const day = new Date().getDay(); // 0=domingo
  return day === 0 ? 6 : day - 1;
}

function weekDates(): Date[] {
  const now = new Date();
  const idx = todayIndex();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - idx);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function InicioDiasSemana() {
  const idx = todayIndex();
  const dates = weekDates();
  const { events } = useHomeEvents();
  const eventDates = events.map((e) => new Date(e.timestamp));

  return (
    <div className="pf-n-week" role="list" aria-label="Días de la semana">
      {DIAS.map((letra, i) => {
        const fecha = dates[i];
        const hasActivity = eventDates.some((ed) => sameDay(ed, fecha));
        const isToday = i === idx;
        return (
          <span
            key={`${letra}-${i}`}
            role="listitem"
            className={`pf-n-week-day${isToday ? " pf-n-week-day-today" : ""}`}
            aria-current={isToday ? "date" : undefined}
          >
            <span className="pf-n-week-dow">{letra}</span>
            <span
              className="pf-n-week-num"
              style={!isToday && hasActivity ? { color: "var(--n-cyan-soft)", fontWeight: 700 } : undefined}
            >
              {fecha.getDate()}
            </span>
          </span>
        );
      })}
    </div>
  );
}
