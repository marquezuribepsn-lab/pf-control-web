"use client";

/**
 * InicioActividadReciente
 * Feed de "Actividad reciente" del inicio del alumno. Consume useHomeEvents
 * (bitácora local de acciones auto-reportadas: check-in, agua, sueño,
 * entreno, peso) y la muestra en orden cronológico inverso. No inventa
 * actividad: si no hay eventos, muestra un estado vacío honesto.
 */

import { useHomeEvents, type HomeEvent, type HomeEventType } from "@/components/useHomeEvents";

const ICONS: Record<HomeEventType, React.ReactNode> = {
  checkin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  agua: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 3.8c2.7 3.1 5.2 6.2 5.2 9.2a5.2 5.2 0 1 1-10.4 0c0-3 2.5-6.1 5.2-9.2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sueno: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M20 13.2a8 8 0 1 1-9.2-9.1 6.4 6.4 0 0 0 9.2 9.1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  entreno: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M6.5 8.5v7M17.5 8.5v7" strokeLinecap="round" />
      <path d="M3.5 10.5v3M20.5 10.5v3" strokeLinecap="round" />
      <path d="M6.5 12h11" strokeLinecap="round" />
    </svg>
  ),
  peso: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5v3.5l2.2 2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const COLORS: Record<HomeEventType, string> = {
  checkin: "#4ade80",
  agua: "#38bdf8",
  sueno: "#818cf8",
  entreno: "#4ade80",
  peso: "#22d3ee",
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "ayer";
  if (diffD < 7) return `hace ${diffD} días`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function EventRow({ event }: { event: HomeEvent }) {
  return (
    <li className="pf-a3-activity-row">
      <span className="pf-a3-activity-icon" style={{ color: COLORS[event.tipo], background: `${COLORS[event.tipo]}1f` }} aria-hidden="true">
        {ICONS[event.tipo]}
      </span>
      <span className="pf-a3-activity-body">
        <span className="pf-a3-activity-label">{event.label}</span>
        {event.detail ? <span className="pf-a3-activity-detail">{event.detail}</span> : null}
      </span>
      <span className="pf-a3-activity-time">{formatRelative(event.timestamp)}</span>
    </li>
  );
}

export default function InicioActividadReciente() {
  const { events } = useHomeEvents();

  return (
    <div className="pf-a3-panel-block pf-a3-activity-card">
      <div className="pf-a3-section-head">
        <h2 className="pf-a3-section-title">Actividad reciente</h2>
      </div>
      {events.length === 0 ? (
        <p className="pf-a3-activity-empty">
          Todavía no registraste actividad hoy. Sumá agua, marcá un entreno o hacé tu check-in para verlo acá.
        </p>
      ) : (
        <ul className="pf-a3-activity-list">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
}
