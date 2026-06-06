"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, use, useState, useMemo } from "react";
import { PlayersContext } from "../../../components/PlayersProvider";
import { CategoriesContext } from "../../../components/CategoriesProvider";
import { type Jugadora } from "../../../data/mockData";
import NutritionHub from "./nutrition/NutritionHub";

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
  const seed = categoria.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = seed % CATEGORY_GRADIENTS.length;
  return { tone: CATEGORY_GRADIENTS[index], icon: CATEGORY_ICONS[index % CATEGORY_ICONS.length] };
};

const normalizeCategory = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

const wellnessColor = (v: number) =>
  v >= 8 ? "text-emerald-300" : v >= 6 ? "text-amber-300" : "text-red-300";

export default function CategoriaPage({ params }: { params: Promise<{ categoria: string }> }) {
  const { jugadoras, cambiarCategoriaJugadora, eliminarJugadora } = useContext(PlayersContext)!;
  const { categorias } = useContext(CategoriesContext)!;
  const resolvedParams = use(params);
  const categoria = decodeURIComponent(resolvedParams.categoria);

  const [busqueda, setBusqueda] = useState("");
  const [cambiandoCategoria, setCambiandoCategoria] = useState<string | null>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("");

  // ── Todos los hooks ANTES del return condicional (Rules of Hooks) ──────────
  const isNutricion = normalizeCategory(categoria) === "nutricion";

  const visual = useMemo(() => getCategoryVisual(categoria), [categoria]);

  const jugadorasEnCategoria = useMemo(() => {
    if (isNutricion) return [];
    const list = jugadoras.filter((j: Jugadora) => j.categoria === categoria);
    if (!busqueda.trim()) return list;
    const q = busqueda.toLowerCase();
    return list.filter((j) => j.nombre.toLowerCase().includes(q));
  }, [jugadoras, categoria, busqueda, isNutricion]);

  const categoriasHabilitadas = useMemo(
    () => categorias.filter((c) => c.habilitada),
    [categorias]
  );

  const totalEnCategoria = useMemo(
    () => jugadoras.filter((j: Jugadora) => j.categoria === categoria).length,
    [jugadoras, categoria]
  );

  // ── Return condicional DESPUÉS de todos los hooks ─────────────────────────
  if (isNutricion) {
    return (
      <div className="mx-auto w-full max-w-[1380px] px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <NutritionHub />
      </div>
    );
  }

  return (
    <main className="relative mx-auto max-w-[1480px] space-y-6 p-6 text-slate-100">
      {/* ── Header ── */}
      <section className="pf-page-hero mb-6">
        <div className="pf-blob pf-blob--tl" />
        <div className="pf-blob pf-blob--br" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="pf-page-hero-badge">
              {visual.icon} Categorías
            </p>
            <h1 className="pf-page-hero-title">{categoria}</h1>
            <p className="pf-page-hero-sub">
              {totalEnCategoria} jugadora{totalEnCategoria !== 1 ? "s" : ""} en esta categoría.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/categorias" className="pf-btn pf-btn--ghost">
              ← Categorías
            </Link>
            <Link
              href={`/nueva-jugadora?categoria=${encodeURIComponent(categoria)}`}
              className="pf-btn pf-btn--primary"
            >
              + Agregar jugadora
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="pf-card rounded-2xl border border-cyan-300/26 p-5">
          <p className="text-sm text-slate-400">👥 Total</p>
          <p className="mt-2 text-3xl font-bold text-slate-100">{totalEnCategoria}</p>
        </div>
        <div className="pf-card rounded-2xl border border-emerald-300/26 p-5">
          <p className="text-sm text-slate-400">💚 Wellness promedio</p>
          <p className="mt-2 text-3xl font-bold text-slate-100">
            {jugadorasEnCategoria.length > 0
              ? (jugadorasEnCategoria.reduce((a, j) => a + (j.wellness || 0), 0) / jugadorasEnCategoria.length).toFixed(1)
              : "—"}
          </p>
        </div>
        <div className="pf-card rounded-2xl border border-violet-300/26 p-5">
          <p className="text-sm text-slate-400">⚡ Carga promedio</p>
          <p className="mt-2 text-3xl font-bold text-slate-100">
            {jugadorasEnCategoria.length > 0
              ? Math.round(jugadorasEnCategoria.reduce((a, j) => a + (Number(j.carga) || 0), 0) / jugadorasEnCategoria.length)
              : "—"}
          </p>
        </div>
      </section>

      {/* ── Color accent bar ── */}
      <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${visual.tone}`} />

      {/* ── Search ── */}
      <div className="flex items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar jugadora en esta categoría…"
          className="h-10 min-w-[220px] max-w-sm rounded-xl border border-white/12 bg-white/6 px-4 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30"
        />
      </div>

      {/* ── Player list ── */}
      <section className="pf-card rounded-2xl border border-white/8 p-6">
        <h2 className="mb-5 text-lg font-semibold text-slate-200">
          Jugadoras ({jugadorasEnCategoria.length})
        </h2>

        {jugadorasEnCategoria.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-3xl">👥</p>
            <p className="mt-3 text-base font-medium text-slate-300">
              {busqueda ? "Sin resultados para esa búsqueda." : "No hay jugadoras en esta categoría."}
            </p>
            {!busqueda && (
              <Link
                href={`/nueva-jugadora?categoria=${encodeURIComponent(categoria)}`}
                className="pf-btn pf-btn--primary mt-5 inline-block"
              >
                Agregar primera jugadora
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {jugadorasEnCategoria.map((jugadora: Jugadora) => (
              <div
                key={jugadora.nombre}
                className="rounded-xl border border-white/8 bg-white/3 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-sm font-bold text-slate-300">
                      {jugadora.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100">{jugadora.nombre}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {jugadora.posicion && (
                          <span className="text-xs text-slate-400">{jugadora.posicion}</span>
                        )}
                        {jugadora.deporte && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                            {jugadora.deporte}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {cambiandoCategoria === jugadora.nombre ? (
                      <>
                        <select
                          value={nuevaCategoria}
                          onChange={(e) => setNuevaCategoria(e.target.value)}
                          className="rounded-lg border border-white/12 bg-white/8 px-2 py-1 text-sm text-slate-100 outline-none"
                        >
                          {categoriasHabilitadas.map((cat) => (
                            <option key={cat.nombre} value={cat.nombre}>
                              {cat.nombre}
                            </option>
                          ))}
                        </select>
                        <ReliableActionButton
                          onClick={() => {
                            if (nuevaCategoria && nuevaCategoria !== jugadora.categoria) {
                              cambiarCategoriaJugadora(jugadora.nombre, nuevaCategoria);
                            }
                            setCambiandoCategoria(null);
                            setNuevaCategoria("");
                          }}
                          className="pf-btn pf-btn--success text-xs"
                        >
                          Guardar
                        </ReliableActionButton>
                        <ReliableActionButton
                          onClick={() => { setCambiandoCategoria(null); setNuevaCategoria(""); }}
                          className="pf-btn pf-btn--ghost text-xs"
                        >
                          Cancelar
                        </ReliableActionButton>
                      </>
                    ) : (
                      <>
                        <ReliableActionButton
                          onClick={() => {
                            setCambiandoCategoria(jugadora.nombre);
                            setNuevaCategoria(jugadora.categoria || "");
                          }}
                          className="pf-btn pf-btn--ghost text-xs"
                        >
                          Mover
                        </ReliableActionButton>
                        <ReliableActionButton
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${jugadora.nombre} de la categoría?`)) {
                              eliminarJugadora(jugadora.nombre);
                            }
                          }}
                          className="pf-btn pf-btn--danger text-xs"
                        >
                          Eliminar
                        </ReliableActionButton>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats grid */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {jugadora.wellness != null && (
                    <div className="rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-xs">
                      <p className="text-slate-500">Wellness</p>
                      <p className={`font-bold ${wellnessColor(jugadora.wellness)}`}>{jugadora.wellness}/10</p>
                    </div>
                  )}
                  {jugadora.carga != null && (
                    <div className="rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-xs">
                      <p className="text-slate-500">Carga</p>
                      <p className="font-bold text-slate-200">{jugadora.carga}</p>
                    </div>
                  )}
                  {jugadora.altura && (
                    <div className="rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-xs">
                      <p className="text-slate-500">Altura</p>
                      <p className="font-bold text-slate-200">{jugadora.altura} cm</p>
                    </div>
                  )}
                  {jugadora.peso && (
                    <div className="rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-xs">
                      <p className="text-slate-500">Peso</p>
                      <p className="font-bold text-slate-200">{jugadora.peso} kg</p>
                    </div>
                  )}
                </div>

                {(jugadora.objetivo || jugadora.observaciones) && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-slate-400">
                    {jugadora.objetivo && (
                      <p><span className="font-medium text-slate-500">Objetivo: </span>{jugadora.objetivo}</p>
                    )}
                    {jugadora.observaciones && (
                      <p><span className="font-medium text-slate-500">Obs: </span>{jugadora.observaciones}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
