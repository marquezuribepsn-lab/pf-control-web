"use client";

/**
 * Personajes de la racha. Uno por nivel, del fueguito inicial a la leyenda.
 * Son formas geometricas simples pensadas para leerse bien a 40px (el badge
 * de la tarjeta) y a 140px (la pantalla de la racha).
 */

import type { Personaje } from "@/lib/racha";

const FORMAS: Record<Personaje, string> = {
  // Chispa: llama chica y redondeada.
  chispa:
    "M12 4.5c1.6 2 2.2 3.2 2.2 4.6 0 .9-.3 1.6-.8 2.2.1-.5 0-1-.3-1.4-.5 1.3-1.4 2-2.2 2.7-.9.8-1.3 1.6-1.1 2.5-1.2-.6-2-1.9-2-3.4 0-1.3.6-2.3 1.4-3.3.8-1 1.4-1.9 1.4-3 0-.3 0-.6-.1-.9z",
  // Llama: la clasica, ancha abajo.
  llama:
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  // Fogata: llama sobre dos troncos cruzados.
  fogata:
    "M12 2.5c.6 2.6-.7 3.9-2 5.2-1.3 1.4-2.5 2.8-2.5 5 0 3.2 2.2 5.3 4.5 5.3s4.5-2.1 4.5-5.3c0-1.8-.8-3.1-1.7-4.3-.8-1-1.4-1.9-1.4-3.1 0-1 .3-1.8.5-2.8-.8.4-1.5 1.1-1.8 2-.2-.9-.7-1.6-1.6-2z M3.6 20.2l6.2-2.6.8 1.8-6.2 2.6zM20.4 20.2l-6.2-2.6-.8 1.8 6.2 2.6z",
  // Cometa: nucleo con estela.
  cometa:
    "M17.6 3.2a5.6 5.6 0 1 1-7.9 7.9 5.6 5.6 0 0 1 7.9-7.9zM8.6 13.4l-4.9 4.9a1 1 0 0 0 1.4 1.4l4.9-4.9a7.8 7.8 0 0 1-1.4-1.4zM5.3 12.6 2.6 15.3a.9.9 0 0 0 1.3 1.3l2.7-2.7a8 8 0 0 1-1.3-1.3zM11.4 16.4l-2.7 2.7a.9.9 0 0 0 1.3 1.3l2.7-2.7a8 8 0 0 1-1.3-1.3z",
  // Estrella de cinco puntas.
  estrella: "M12 2.4l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.2l6.5-.9z",
  // Sol con rayos.
  sol:
    "M12 7.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2zM12 1.2a1 1 0 0 1 1 1v2.1a1 1 0 1 1-2 0V2.2a1 1 0 0 1 1-1zM12 18.7a1 1 0 0 1 1 1v2.1a1 1 0 1 1-2 0v-2.1a1 1 0 0 1 1-1zM1.2 12a1 1 0 0 1 1-1h2.1a1 1 0 1 1 0 2H2.2a1 1 0 0 1-1-1zM18.7 12a1 1 0 0 1 1-1h2.1a1 1 0 1 1 0 2h-2.1a1 1 0 0 1-1-1zM4.4 4.4a1 1 0 0 1 1.4 0l1.5 1.5a1 1 0 1 1-1.4 1.4L4.4 5.8a1 1 0 0 1 0-1.4zM16.7 16.7a1 1 0 0 1 1.4 0l1.5 1.5a1 1 0 1 1-1.4 1.4l-1.5-1.5a1 1 0 0 1 0-1.4zM19.6 4.4a1 1 0 0 1 0 1.4l-1.5 1.5a1 1 0 1 1-1.4-1.4l1.5-1.5a1 1 0 0 1 1.4 0zM7.3 16.7a1 1 0 0 1 0 1.4l-1.5 1.5a1 1 0 1 1-1.4-1.4l1.5-1.5a1 1 0 0 1 1.4 0z",
  // Corona de tres picos.
  corona:
    "M3 8.4l3.6 2.7L12 4.3l5.4 6.8L21 8.4l-1.7 9.4a1.4 1.4 0 0 1-1.4 1.1H6.1a1.4 1.4 0 0 1-1.4-1.1zM6.6 21h10.8a1 1 0 1 1 0 2H6.6a1 1 0 1 1 0-2z",
  // Leyenda: diamante.
  leyenda: "M7.4 2.5h9.2L22 9.1 12 22 2 9.1zM12 5.6 6.6 9.3 12 17l5.4-7.7z",
};

export default function RachaPersonaje({
  personaje,
  colores,
  size = 40,
  apagado = false,
}: {
  personaje: Personaje;
  colores: [string, string];
  size?: number;
  /** Nivel todavia no desbloqueado: se dibuja en gris. */
  apagado?: boolean;
}) {
  const gradId = `pf-racha-${personaje}${apagado ? "-off" : ""}`;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={apagado ? "rgba(245,246,250,0.22)" : colores[0]} />
          <stop offset="1" stopColor={apagado ? "rgba(245,246,250,0.10)" : colores[1]} />
        </linearGradient>
      </defs>
      <path d={FORMAS[personaje]} fill={`url(#${gradId})`} fillRule="evenodd" />
    </svg>
  );
}
