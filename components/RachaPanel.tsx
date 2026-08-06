"use client";

/**
 * Pantalla de la racha. Se abre al tocar el personaje de la tarjeta "Rutina de
 * hoy" y muestra el nivel actual, cuanto falta para el siguiente, el estado
 * (activa / congelada / perdida) y la lista completa de niveles.
 *
 * Va por portal a <body>: es position:fixed y, dentro del arbol del alumno,
 * `.pf-n-screen` conserva un transform de su animacion de entrada, que crearia
 * bloque contenedor y lo encerraria en su caja.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import RachaPersonaje from "@/components/RachaPersonaje";
import {
  NIVELES_RACHA,
  RACHA_MAXIMA,
  nivelDeRacha,
  progresoAlSiguiente,
  siguienteNivel,
  type Racha,
} from "@/lib/racha";

const ESTADO_COPY: Record<Racha["estado"], { titulo: string; texto: string; tono: string }> = {
  activa: {
    titulo: "Racha activa",
    texto: "Seguí entrenando para no cortarla.",
    tono: "pf-n-racha-estado-ok",
  },
  congelada: {
    titulo: "Racha congelada",
    texto: "Te salteaste un turno. Entrená y volvés a sumar donde estabas.",
    tono: "pf-n-racha-estado-warn",
  },
  perdida: {
    titulo: "Sin racha activa",
    texto: "Entrená hoy para arrancar una nueva.",
    tono: "pf-n-racha-estado-off",
  },
};

export default function RachaPanel({ racha, onClose }: { racha: Racha; onClose: () => void }) {
  const [montado, setMontado] = useState(false);
  const [entrando, setEntrando] = useState(true);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => setMontado(true), []);

  // Mismo criterio que el hub de notificaciones: el estado en reposo es
  // visible y el fundido se dispara con tres oportunidades, para que nunca
  // quede invisible si alguna no corre.
  useEffect(() => {
    let vivo = true;
    const mostrar = () => { if (vivo) setEntrando(false); };
    const raf = requestAnimationFrame(mostrar);
    const t0 = window.setTimeout(mostrar, 0);
    const t1 = window.setTimeout(mostrar, 120);
    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, []);

  const cerrar = () => {
    setCerrando(true);
    window.setTimeout(onClose, 240);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!montado || typeof document === "undefined") return null;

  const nivel = nivelDeRacha(racha.dias);
  const proximo = siguienteNivel(racha.dias);
  const progreso = progresoAlSiguiente(racha.dias);
  const estado = ESTADO_COPY[racha.estado];
  const claseEstado = `${cerrando ? " pf-n-racha-closing" : ""}${entrando ? " pf-n-racha-entering" : ""}`;

  return createPortal(
    <div className={`pf-n-racha-layer${claseEstado}`} role="dialog" aria-modal="true" aria-label="Tu racha" data-open="true">
      <div className="pf-n-racha-top">
        <button type="button" className="pf-n-racha-close" onClick={cerrar} aria-label="Cerrar">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="5" x2="15" y2="15" />
            <line x1="15" y1="5" x2="5" y2="15" />
          </svg>
        </button>
      </div>

      <div className="pf-n-racha-hero">
        <span className={`pf-n-racha-figura${racha.estado === "congelada" ? " pf-n-racha-figura-fria" : ""}`}>
          {nivel ? (
            <RachaPersonaje personaje={nivel.personaje} colores={nivel.colores} size={140} />
          ) : (
            <RachaPersonaje personaje="chispa" colores={["#fde68a", "#f59e0b"]} size={140} apagado />
          )}
        </span>

        <p className="pf-n-racha-dias">
          {racha.dias}
          <span>{racha.dias === 1 ? " día" : " días"}</span>
        </p>
        <p className="pf-n-racha-nombre">{nivel ? nivel.nombre : "Sin racha"}</p>

        <div className={`pf-n-racha-estado ${estado.tono}`}>
          <p className="pf-n-racha-estado-titulo">{estado.titulo}</p>
          <p className="pf-n-racha-estado-texto">
            {racha.estado === "congelada" && racha.diasParaPerderla > 0
              ? `${estado.texto} Te quedan ${racha.diasParaPerderla} ${racha.diasParaPerderla === 1 ? "día" : "días"}.`
              : estado.texto}
          </p>
        </div>
      </div>

      {proximo ? (
        <div className="pf-n-racha-progreso">
          <div className="pf-n-racha-progreso-track">
            <div className="pf-n-racha-progreso-fill" style={{ width: `${progreso}%` }} />
          </div>
          <p className="pf-n-racha-progreso-texto">
            {proximo.min - racha.dias} {proximo.min - racha.dias === 1 ? "día" : "días"} para desbloquear{" "}
            <b>{proximo.nombre}</b>
          </p>
        </div>
      ) : (
        <div className="pf-n-racha-progreso">
          <p className="pf-n-racha-progreso-texto">
            Llegaste al nivel máximo: <b>{RACHA_MAXIMA} días</b>.
          </p>
        </div>
      )}

      <p className="pf-n-label">Niveles</p>
      <div className="pf-n-racha-niveles">
        {NIVELES_RACHA.map((n) => {
          const desbloqueado = racha.dias >= n.min;
          return (
            <div key={n.nombre} className={`pf-n-racha-nivel${desbloqueado ? " pf-n-racha-nivel-on" : ""}`}>
              <RachaPersonaje personaje={n.personaje} colores={n.colores} size={30} apagado={!desbloqueado} />
              <span className="pf-n-racha-nivel-nombre">{n.nombre}</span>
              <span className="pf-n-racha-nivel-dias">{n.min} d</span>
            </div>
          );
        })}
      </div>

      <p className="pf-n-label">Cómo funciona</p>
      <ul className="pf-n-racha-reglas">
        <li>Cada entrenamiento que terminás suma un día a la racha.</li>
        <li>
          Se cuentan entrenamientos, no días del calendario: podés descansar hasta{" "}
          {racha.margenDias} {racha.margenDias === 1 ? "día" : "días"} entre sesiones sin cortarla.
        </li>
        <li>Si se te pasa un turno, la racha queda congelada y la recuperás entrenando.</li>
        <li>Si se te pasa el segundo, vuelve a cero.</li>
      </ul>
    </div>,
    document.body
  );
}
