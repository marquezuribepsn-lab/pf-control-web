"use client";

import Link from "next/link";
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
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Categorías</h1>
        <p className="text-sm text-neutral-600">
          Organización por categoría y resumen general.
        </p>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Agregar nueva categoría</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            placeholder="Nombre de la categoría"
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-500"
          />
          <button
            onClick={handleAgregarCategoria}
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Agregar
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categoriasConJugadoras.map((categoria, index) => {
          const tone = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
          const icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];

          return (
            <div
              key={categoria.nombre}
              className="rounded-2xl border border-white/20 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`mb-3 h-2 rounded-full bg-gradient-to-r ${tone}`} />
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">
                  <span className="mr-2">{icon}</span>
                  {categoria.nombre}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleCategoria(categoria.nombre)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      categoria.habilitada
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {categoria.habilitada ? "Habilitada" : "Deshabilitada"}
                  </button>
                  <button
                    onClick={() => eliminarCategoria(categoria.nombre)}
                    className="rounded-full px-3 py-1 text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-neutral-600">
                <p>Equipos: 1</p>
                <p suppressHydrationWarning={true}>Jugadoras: {categoria.jugadoras}</p>
              </div>
              {categoria.habilitada && (
                <Link
                  href={`/categorias/${encodeURIComponent(categoria.nombre)}`}
                  className={`mt-4 inline-block rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 ${tone}`}
                >
                  Ver jugadoras
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}