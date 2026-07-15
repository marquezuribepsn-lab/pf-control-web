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
        padding: "0.9rem 1rem",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        backgroundColor: "rgba(2, 6, 23, 0.55)",
        backgroundImage:
          "linear-gradient(160deg, rgba(30, 64, 120, 0.42), rgba(8, 15, 30, 0.28) 70%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow:
          "0 26px 60px -26px rgba(8, 15, 30, 0.6), 0 0 0 1px rgba(56, 189, 248, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        color: "#fff",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          width: "100%",
          border: 0,
          background: "transparent",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 auto",
            width: "42px",
            height: "42px",
            borderRadius: "0.85rem",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#7dd3fc",
            border: "1px solid rgba(125, 211, 252, 0.28)",
            background: "linear-gradient(160deg, rgba(56, 189, 248, 0.18), rgba(37, 99, 235, 0.14))",
            fontSize: "1.5rem",
            fontWeight: 900,
            fontFamily: "Georgia, serif",
            lineHeight: 1,
          }}
        >
          &rdquo;
        </span>

        <span style={{ flex: "1 1 auto", minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "10.5px",
              fontWeight: 700,
              letterSpacing: "0.11em",
              textTransform: "uppercase",
              color: "#7dd3fc",
              marginBottom: "0.22rem",
            }}
          >
            Frase del día
          </span>
          <span
            style={{
              display: expanded ? "block" : "-webkit-box",
              WebkitLineClamp: expanded ? undefined : 2,
              WebkitBoxOrient: expanded ? undefined : ("vertical" as const),
              overflow: expanded ? "visible" : "hidden",
              fontSize: "0.92rem",
              fontWeight: 600,
              lineHeight: 1.4,
              fontStyle: "italic",
              letterSpacing: "-0.008em",
            }}
          >
            {quote.text}
          </span>
          {expanded && quote.author ? (
            <span style={{ display: "block", marginTop: "0.4rem", fontSize: "11.5px", fontWeight: 700, opacity: 0.9 }}>
              — {quote.author}
            </span>
          ) : null}
        </span>

        <span
          aria-hidden="true"
          style={{
            flex: "0 0 auto",
            display: "inline-flex",
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 180ms ease",
            color: "#9db1c9",
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {expanded && (
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "0.65rem",
          }}
        >
          <button
            type="button"
            onClick={handleShare}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.34rem",
              border: "1px solid rgba(125, 211, 252, 0.4)",
              background: "rgba(56, 189, 248, 0.12)",
              color: "#e0f2fe",
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
      )}
    </section>
  );
}
