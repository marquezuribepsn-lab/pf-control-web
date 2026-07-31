"use client";

/**
 * FraseDelDia
 * Frase motivacional del inicio del alumno. Muestra una frase distinta por día
 * (determinística); al tocarla se expande para ver el autor y compartirla
 * (Web Share API con fallback a portapapeles).
 *
 * Diseño: handoff "Rediseño PF Control Fitness" — la frase va suelta sobre el
 * fondo, en itálica, precedida por una comilla cyan. Sin tarjeta.
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
    <section aria-label="Frase del día">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="pf-n-quote"
        style={{ width: "100%", border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}
      >
        <p>{quote.text}</p>
      </button>

      <div className="pf-expand-wrap" data-open={expanded ? "true" : "false"}>
        <div className="pf-expand-inner">
          <div className="pf-n-quote-more">
            {quote.author ? <span className="pf-n-quote-author">— {quote.author}</span> : <span />}
            <button type="button" onClick={handleShare} className="pf-n-quote-share">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="18" cy="5" r="2.6" />
                <circle cx="6" cy="12" r="2.6" />
                <circle cx="18" cy="19" r="2.6" />
                <path d="M8.3 10.8 15.7 6.4M8.3 13.2l7.4 4.4" strokeLinecap="round" />
              </svg>
              {shareMsg ?? "Compartir"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
