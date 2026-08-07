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
          <span className="pf-v2-eyebrow">Gestión del club</span>
          <h1 className="pf-v2-h1" style={{ fontSize: 32 }}>Categorías</h1>
          <p className="pf-v2-muted" style={{ marginTop: 8 }}>
            Organización por categoría y resumen general.
          </p>
        </div>
      </header>

      <section className="pf-v2-card">
        <h2 className="pf-v2-h2" style={{ marginBottom: 14 }}>Agregar nueva categoría</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAgregarCategoria();
            }}
            placeholder="Nombre de la categoría"
            className="pf-v2-input"
            style={{ flex: 1, minWidth: 220 }}
            aria-label="Nombre de la categoría"
          />
          <ReliableActionButton onClick={handleAgregarCategoria} className="pf-v2-btn">
            Agregar
          </ReliableActionButton>
        </div>
      </section>

      <section className="pf-v2-grid-3">
        {categoriasConJugadoras.map((categoria, index) => {
          const hex = CATEGORY_TINTS[index % CATEGORY_TINTS.length];
          const icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];

          return (
            <article key={categoria.nombre} className="pf-v2-card pf-v2-lift">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <span
                  className="pf-v2-module-icon"
                  style={{ background: tinte(hex, 0.14), color: hex, boxShadow: `0 0 18px ${tinte(hex, 0.3)}` }}
                  aria-hidden="true"
                >
                  {icon}
                </span>
                <ReliableActionButton
                  onClick={() => toggleCategoria(categoria.nombre)}
                  className={`pf-v2-chip ${categoria.habilitada ? "pf-v2-chip-ok" : "pf-v2-chip-danger"}`}
                  style={{ cursor: "pointer" }}
                >
                  {categoria.habilitada ? "Habilitada" : "Deshabilitada"}
                </ReliableActionButton>
              </div>

              <h2 className="pf-v2-h2" style={{ marginTop: 14 }}>{categoria.nombre}</h2>

              <p className="pf-v2-muted" style={{ marginTop: 6 }} suppressHydrationWarning>
                Equipos: 1 · Jugadoras: {categoria.jugadoras}
              </p>

              <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                <Link href={`/categorias/${encodeURIComponent(categoria.nombre)}`} className="pf-v2-btn">
                  {categoria.habilitada ? "Ver jugadoras" : "Ver categoría"}
                </Link>
                <ReliableActionButton
                  onClick={() => eliminarCategoria(categoria.nombre)}
                  className="pf-v2-btn pf-v2-btn-danger"
                >
                  Eliminar
                </ReliableActionButton>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
