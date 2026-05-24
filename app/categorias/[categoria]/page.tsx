"use client";

import { useContext, use } from "react";
import { PlayersContext } from "../../../components/PlayersProvider";
import { type Jugadora } from "../../../data/mockData";
import NutritionPlanner from "./NutritionPlanner";

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

const normalizeCategory = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export default function CategoriaPage({ params }: { params: Promise<{ categoria: string }> }) {
  const { jugadoras } = useContext(PlayersContext)!;
  const resolvedParams = use(params);
  const categoria = decodeURIComponent(resolvedParams.categoria);

  if (normalizeCategory(categoria) === "nutricion") {
    return (
      <main className="mx-auto w-full max-w-[1380px] px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <NutritionPlanner />
      </main>
    );
  }

  const visual = getCategoryVisual(categoria);

  const jugadorasEnCategoria = jugadoras.filter(
    (jugadora: Jugadora) => jugadora.categoria === categoria
  );

  return (
    <main className="relative mx-auto max-w-7xl p-6">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 z-0"
        style={{ background: `radial-gradient(ellipse 80% 55% at 50% -10%, hsla(var(--hue,142),65%,55%,0.1) 0%, transparent 70%)` }}
        aria-hidden="true"
      />
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white/90">
          <span className="mr-2">{visual.icon}</span>
          Categoría: {categoria}
        </h1>
        <p className="text-sm text-white/45">
          Jugadoras en esta categoría.
        </p>
      </div>

      <div className="pf-card rounded-2xl border p-6">
        <div className={`mb-4 h-2 rounded-full bg-gradient-to-r ${visual.tone}`} />
        <h2 className="text-xl font-semibold text-white/85 mb-4" style={{ color: `hsl(var(--hue,142),65%,65%)` }}>Jugadoras ({jugadorasEnCategoria.length})</h2>
        {jugadorasEnCategoria.length === 0 ? (
          <p className="text-white/75">No hay jugadoras en esta categoría.</p>
        ) : (
          <div className="space-y-4">
            {jugadorasEnCategoria.map((jugadora: Jugadora, index: number) => (
              <div key={index} className="border-b border-white/[0.06] pb-4 last:border-b-0">
                <h3 className="text-lg font-medium text-white/85">{jugadora.nombre}</h3>
                <div className="mt-2 grid gap-2 text-sm text-white/55 md:grid-cols-2">
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