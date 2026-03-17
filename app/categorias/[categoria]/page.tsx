"use client";

import { useContext, use } from "react";
import { PlayersContext } from "../../../components/PlayersProvider";
import { type Jugadora } from "../../../data/mockData";

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

const getCategoryVisual = (categoria: string) => {
  const seed = categoria
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = seed % CATEGORY_GRADIENTS.length;

  return {
    tone: CATEGORY_GRADIENTS[index],
    icon: CATEGORY_ICONS[index % CATEGORY_ICONS.length],
  };
};

export default function CategoriaPage({ params }: { params: Promise<{ categoria: string }> }) {
  const { jugadoras } = useContext(PlayersContext)!;
  const resolvedParams = use(params);
  const categoria = decodeURIComponent(resolvedParams.categoria);
  const visual = getCategoryVisual(categoria);

  const jugadorasEnCategoria = jugadoras.filter(
    (jugadora: Jugadora) => jugadora.categoria === categoria
  );

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          <span className="mr-2">{visual.icon}</span>
          Categoría: {categoria}
        </h1>
        <p className="text-sm text-neutral-600">
          Jugadoras en esta categoría.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className={`mb-4 h-2 rounded-full bg-gradient-to-r ${visual.tone}`} />
        <h2 className="text-xl font-semibold mb-4">Jugadoras ({jugadorasEnCategoria.length})</h2>
        {jugadorasEnCategoria.length === 0 ? (
          <p>No hay jugadoras en esta categoría.</p>
        ) : (
          <div className="space-y-4">
            {jugadorasEnCategoria.map((jugadora: Jugadora, index: number) => (
              <div key={index} className="border-b border-neutral-200 pb-4 last:border-b-0">
                <h3 className="text-lg font-medium">{jugadora.nombre}</h3>
                <div className="mt-2 grid gap-2 text-sm text-neutral-600 md:grid-cols-2">
                  <p><strong>Posición:</strong> {jugadora.posicion}</p>
                  <p><strong>Wellness:</strong> {jugadora.wellness}/10</p>
                  <p><strong>Carga:</strong> {jugadora.carga}</p>
                  {jugadora.fechaNacimiento && <p><strong>Fecha de nacimiento:</strong> {jugadora.fechaNacimiento}</p>}
                  {jugadora.altura && <p><strong>Altura:</strong> {jugadora.altura} cm</p>}
                  {jugadora.peso && <p><strong>Peso:</strong> {jugadora.peso} kg</p>}
                  {jugadora.deporte && <p><strong>Deporte:</strong> {jugadora.deporte}</p>}
                  {jugadora.club && <p><strong>Club:</strong> {jugadora.club}</p>}
                  {jugadora.objetivo && <p><strong>Objetivo:</strong> {jugadora.objetivo}</p>}
                  {jugadora.observaciones && <p><strong>Observaciones:</strong> {jugadora.observaciones}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}