"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, useState } from "react";
import { PlayersContext } from "../../components/PlayersProvider";
import { CategoriesContext } from "../../components/CategoriesProvider";
import { type Jugadora } from "../../data/mockData";

const CATEGORY_TINTS = [
  "#22e5ff", "#34d399", "#f472b6", "#fbbf24",
  "#c084fc", "#a3e635", "#f87171", "#60a5fa",
];

/** Mismo color con alfa, para fondos y glows. */
function tinte(hex: string, alfa: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

const CATEGORY_ICONS = ["⚡", "🛡️", "🎯", "🚀", "🏆", "🔥", "🌟", "💪"];

export default function CategoriasPage() {
  const { jugadoras } = useContext(PlayersContext)!;
  const { categorias, agregarCategoria, toggleCategoria, eliminarCategoria } = useContext(CategoriesContext)!;
  const [nuevaCategoria, setNuevaCategoria] = useState("");

  const categoriasConJugadoras = categorias.map((categoria) => {
    const jugadorasEnCat = jugadoras.filter((j: Jugadora) => j.categoria === categoria.nombre);
    return {
      ...categoria,
      jugadoras: jugadorasEnCat.length,
    };
  });

  const handleAgregarCategoria = () => {
    if (nuevaCategoria.trim()) {
      agregarCategoria({ nombre: nuevaCategoria.trim(), habilitada: true });
      setNuevaCategoria("");
    }
  };

  return (
    <div className="pf-v2-page">
      <header className="pf-v2-page-head">
        <div>
          <span className="pf-v2-tagline">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.2" /><rect x="11" y="3" width="6" height="6" rx="1.2" /><rect x="3" y="11" width="6" height="6" rx="1.2" /><rect x="11" y="11" width="6" height="6" rx="1.2" /></svg>
            Gestión del club
          </span>
          <h1 className="pf-v2-title">Categorías</h1>
          <p className="pf-v2-title-sub">Organización por categoría y resumen general del plantel.</p>
        </div>
      </header>

      {/* Alta de categoria (handoff: screens/Categorias.dc.html) */}
      <section className="pf-v2-card" style={{ padding: 30 }}>
        <h2 className="pf-v2-h2 pf-v2-h2-accent" style={{ marginBottom: 20 }}>
          Agregar nueva categoría
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAgregarCategoria();
            }}
            placeholder="Nombre de la categoría"
            className="pf-v2-input pf-v2-input-lg"
            style={{ flex: 1, minWidth: 260 }}
            aria-label="Nombre de la categoría"
          />
          <ReliableActionButton
            onClick={handleAgregarCategoria}
            className="pf-v2-btn"
            style={{ padding: "14px 28px", borderRadius: 12, whiteSpace: "nowrap" }}
          >
            Agregar
          </ReliableActionButton>
        </div>
      </section>

      {/* Grilla de categorias: 3 columnas, cards de 26px */}
      <section className="pf-v2-grid-3" style={{ gap: 20 }}>
        {categoriasConJugadoras.map((categoria, index) => {
          const hex = CATEGORY_TINTS[index % CATEGORY_TINTS.length];
          const icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];

          return (
            <article key={categoria.nombre} className="pf-v2-card" style={{ padding: 26 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 17 }} aria-hidden="true">{icon}</span>
                  <span style={{ fontFamily: "var(--v2-display)", fontSize: 19, fontWeight: 800 }}>
                    {categoria.nombre}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ReliableActionButton
                    onClick={() => toggleCategoria(categoria.nombre)}
                    className={`pf-v2-chip ${categoria.habilitada ? "pf-v2-chip-ok" : "pf-v2-chip-danger"}`}
                    style={{ cursor: "pointer", border: "1px solid" }}
                  >
                    {categoria.habilitada ? "Habilitada" : "Deshabilitada"}
                  </ReliableActionButton>
                  <ReliableActionButton
                    onClick={() => eliminarCategoria(categoria.nombre)}
                    className="pf-v2-chip pf-v2-chip-danger"
                    style={{ cursor: "pointer", border: "1px solid" }}
                  >
                    Eliminar
                  </ReliableActionButton>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                <div style={{ fontSize: 14, color: "var(--v2-fg-50)" }}>
                  Equipos: <span style={{ color: "var(--v2-fg)", fontWeight: 700 }}>1</span>
                </div>
                <div style={{ fontSize: 14, color: "var(--v2-fg-50)" }} suppressHydrationWarning>
                  Jugadoras: <span style={{ color: "var(--v2-fg)", fontWeight: 700 }}>{categoria.jugadoras}</span>
                </div>
              </div>

              <Link
                href={`/categorias/${encodeURIComponent(categoria.nombre)}`}
                className="pf-v2-btn"
                style={{ padding: "12px 24px", borderRadius: 12, background: hex, color: "var(--v2-on-accent)", boxShadow: `0 8px 24px ${tinte(hex, 0.28)}` }}
              >
                {categoria.habilitada ? "Ver jugadoras" : "Ver categoría"}
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}
