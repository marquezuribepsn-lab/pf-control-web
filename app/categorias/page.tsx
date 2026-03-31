"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
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

  const handleOpenCategoria = (nombre: string, habilitada: boolean) => {
    if (!habilitada) return;

    const targetPath = `/categorias/${encodeURIComponent(nombre)}`;
    router.push(targetPath);

    // Fallback defensivo: si por algun bloqueo de estado/evento no cambia de ruta,
    // forzamos navegacion nativa para evitar que el usuario quede trabado.
    window.setTimeout(() => {
      if (window.location.pathname !== targetPath) {
        window.location.assign(targetPath);
      }
    }, 220);
  };

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Categorias</h1>
        <p className="text-sm text-neutral-600">
          Organizacion por categoria y resumen general.
        </p>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-xl font-semibold">Agregar nueva categoria</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            placeholder="Nombre de la categoria"
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
              className={`rounded-2xl border border-white/20 bg-white p-4 shadow-sm transition sm:p-5 ${
                categoria.habilitada
                  ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                  : "cursor-not-allowed opacity-80"
              }`}
              onClick={() => handleOpenCategoria(categoria.nombre, categoria.habilitada)}
              role={categoria.habilitada ? "button" : undefined}
              tabIndex={categoria.habilitada ? 0 : -1}
              onKeyDown={(event) => {
                if (!categoria.habilitada) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpenCategoria(categoria.nombre, categoria.habilitada);
                }
              }}
            >
              <div className={`mb-3 h-2 rounded-full bg-gradient-to-r ${tone}`} />
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  <span className="mr-2">{icon}</span>
                  {categoria.nombre}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleCategoria(categoria.nombre);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      categoria.habilitada
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {categoria.habilitada ? "Habilitada" : "Deshabilitada"}
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      eliminarCategoria(categoria.nombre);
                    }}
                    className="rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600"
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
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenCategoria(categoria.nombre, categoria.habilitada);
                  }}
                  className={`mt-4 inline-block rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 ${tone}`}
                >
                  Ver jugadoras
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
