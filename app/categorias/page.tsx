"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, useState } from "react";
import { PlayersContext } from "../../components/PlayersProvider";
import { CategoriesContext } from "../../components/CategoriesProvider";
import { type Jugadora } from "../../data/mockData";

const CATEGORY_GRADIENTS = [
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-lime-500 to-green-600",
  "from-rose-500 to-red-600",
  "from-sky-500 to-indigo-600",
];

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
    <main className="relative mx-auto max-w-7xl p-6">
      <section className="pf-page-hero mb-6">
        <div className="pf-blob pf-blob--tl" />
        <div className="pf-blob pf-blob--br" />
        <div className="relative">
          <p className="pf-page-hero-badge">⚡ Gestión del club</p>
          <h1 className="pf-page-hero-title">Categorías</h1>
          <p className="pf-page-hero-sub">Organización por categoría y resumen general.</p>
        </div>
      </section>

      <div className="pf-card mb-6 rounded-2xl border p-6">
        <h2 className="text-xl font-semibold text-white/85 mb-4" style={{ color: `hsl(var(--hue,346),65%,65%)` }}>Agregar nueva categoría</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            placeholder="Nombre de la categoría"
            className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-white/85 placeholder:text-white/25 outline-none focus:border-white/[0.2] focus:bg-white/[0.06]"
          />
          <ReliableActionButton
            onClick={handleAgregarCategoria}
            className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Agregar
          </ReliableActionButton>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categoriasConJugadoras.map((categoria, index) => {
          const tone = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
          const icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];

          return (
            <div
              key={categoria.nombre}
              className="pf-card group rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-1"
            >
              <div className={`mb-3 h-2 rounded-full bg-gradient-to-r ${tone}`} />
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-white/90">
                  <span className="mr-2">{icon}</span>
                  {categoria.nombre}
                </h2>
                <div className="flex gap-2">
                  <ReliableActionButton
                    onClick={() => toggleCategoria(categoria.nombre)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      categoria.habilitada
                        ? "rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
                        : "rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-300"
                    }`}
                  >
                    {categoria.habilitada ? "Habilitada" : "Deshabilitada"}
                  </ReliableActionButton>
                  <ReliableActionButton
                    onClick={() => eliminarCategoria(categoria.nombre)}
                    className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/15"
                  >
                    Eliminar
                  </ReliableActionButton>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-white/55">
                <p>Equipos: 1</p>
                <p suppressHydrationWarning={true}>Jugadoras: {categoria.jugadoras}</p>
              </div>
              <Link
                href={`/categorias/${encodeURIComponent(categoria.nombre)}`}
                className={`mt-4 inline-block rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 ${tone}`}
              >
                {categoria.habilitada ? "Ver jugadoras" : "Ver categoria"}
              </Link>
            </div>
          );
        })}
      </div>
    </main>
  );
}
