"use client";

/**
 * InicioDiasSemana
 * Tira Lun-Dom para el inicio del alumno. No existe en la app un calendario
 * de entrenamientos asignados por día, así que esta tira es puramente
 * informativa/de ubicación temporal: marca qué día es hoy dentro de la
 * semana. No inventa "entrenos asignados" por día porque esa data no existe.
 */

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

function todayIndex(): number {
  const day = new Date().getDay(); // 0=domingo
  return day === 0 ? 6 : day - 1;
}

export default function InicioDiasSemana() {
  const idx = todayIndex();
  return (
    <div className="pf-a3-days-strip" role="list" aria-label="Días de la semana">
      {DIAS.map((d, i) => (
        <span
          key={`${d}-${i}`}
          role="listitem"
          className={`pf-a3-day-chip${i === idx ? " pf-a3-day-chip-active" : ""}`}
          aria-current={i === idx ? "date" : undefined}
        >
          {d}
        </span>
      ))}
    </div>
  );
}
