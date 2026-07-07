"use client";

/**
 * FraseDelDia
 * Tarjeta motivacional del home del alumno con degradado magenta→violeta,
 * inspirada en la captura del "hub de notificaciones". Muestra una frase
 * distinta por día (determinística), con botón "Compartir" (Web Share API con
 * fallback a portapapeles) y "Ver completa" para expandir el texto largo.
 *
 * Es aditiva y autocontenida: no depende del estado del cliente ni del server.
 */

import { useMemo, useState } from "react";

type Quote = { text: string; author?: string };

const QUOTES: Quote[] = [
  { text: "Cuando algo es lo suficientemente importante, hazlo. Incluso cuando todo esté en tu contra.", author: "Elon Musk" },
  { text: "El dolor que sientes hoy será la fuerza que sentirás mañana.", author: "Arnold Schwarzenegger" },
  { text: "No cuentes los días, haz que los días cuenten.", author: "Muhammad Ali" },
  { text: "La disciplina es el puente entre las metas y los logros.", author: "Jim Rohn" },
  { text: "El cuerpo logra lo que la mente cree.", author: "Napoleon Hill" },
  { text: "No se trata de tener tiempo, se trata de hacer tiempo." },
  { text: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
  { text: "La motivación te pone en marcha, el hábito te mantiene.", author: "Jim Ryun" },
  { text: "Cuida tu cuerpo, es el único lugar que tienes para vivir.", author: "Jim Rohn" },
  { text: "El único entrenamiento malo es el que no hiciste." },
  { text: "Los límites, como los miedos, muchas veces son solo una ilusión.", author: "Michael Jordan" },
  { text: "La fuerza no viene de la capacidad física, sino de una voluntad indomable.", author: "Mahatma Gandhi" },
  { text: "Hazlo con miedo, pero hazlo." },
  { text: "Un poco de progreso cada día suma grandes resultados." },
  { text: "La constancia vence al talento cuando el talento no es constante." },
];

function pickDailyIndex(len: number): number {
  if (len <= 0) return 0;
  const now = new Date();
  const dayNumber = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000
  );
  return ((dayNumber % len) + len) % len;
}

export default function FraseDelDia() {
  const [expanded, setExpanded] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const quote = useMemo(() => QUOTES[pickDailyIndex(QUOTES.length)], []);
  const fullText = quote.author ? `“${quote.text}” — ${quote.author}` : `“${quote.text}”`;
  const isLong = quote.text.length > 70;

  const handleShare = async () => {
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && typeof nav.share === "function") {
        await nav.share({ title: "Frase del día", text: fullText });
        return;
      }
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
        await nav.clipboard.writeText(fullText);
        setShareMsg("¡Copiado!");
        window.setTimeout(() => setShareMsg(null), 1800);
      }
    } catch {
      /* usuario canceló o no soportado */
    }
  };

  return (
    <section
      className="pf-frase-card"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "1.1rem",
        padding: "1rem 1.15rem 1.05rem",
        background:
          "linear-gradient(122deg, #557bc7 0%, #4567b2 48%, #29416f 100%)",
        boxShadow: "0 16px 34px rgba(77, 114, 195, 0.32)",
        color: "#fff",
      }}
    >
      {/* brillo sutil superior derecha */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-40%",
          right: "-10%",
          width: "58%",
          height: "160%",
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.22), transparent 72%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.6rem",
          marginBottom: "0.6rem",
        }}
      >
        <span
          style={{
            fontSize: "10.5px",
            fontWeight: 600,
            letterSpacing: "0.11em",
            textTransform: "uppercase",
            opacity: 0.82,
          }}
        >
          — Frase del día
        </span>

        <button
          type="button"
          onClick={handleShare}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.34rem",
            border: "1px solid rgba(255,255,255,0.55)",
            background: "rgba(255,255,255,0.16)",
            color: "#fff",
            borderRadius: "999px",
            padding: "0.3rem 0.7rem",
            fontSize: "11.5px",
            fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="18" cy="5" r="2.6" />
            <circle cx="6" cy="12" r="2.6" />
            <circle cx="18" cy="19" r="2.6" />
            <path d="M8.3 10.8 15.7 6.4M8.3 13.2l7.4 4.4" strokeLinecap="round" />
          </svg>
          {shareMsg ?? "Compartir"}
        </button>
      </div>

      <p
        style={{
          position: "relative",
          margin: 0,
          fontSize: "clamp(1.02rem, 4.2vw, 1.24rem)",
          fontWeight: 600,
          lineHeight: 1.4,
          fontStyle: "italic",
          letterSpacing: "-0.012em",
          textShadow: "0 1px 10px rgba(25, 38, 71, 0.28)",
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }),
        }}
      >
        {quote.text}
      </p>

      {(quote.author || isLong) && (
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.6rem",
            marginTop: "0.7rem",
          }}
        >
          <span style={{ fontSize: "11.5px", fontWeight: 700, opacity: 0.9 }}>
            {expanded && quote.author ? `— ${quote.author}` : ""}
          </span>

          {isLong ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.28rem",
                border: 0,
                background: "transparent",
                color: "#fff",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                opacity: 0.95,
              }}
            >
              {expanded ? "Ver menos" : "Ver completa"}
              <span aria-hidden="true">{expanded ? "↑" : "→"}</span>
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
    </section>
  );
}
