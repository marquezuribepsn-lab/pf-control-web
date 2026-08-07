"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, use, useState, useMemo } from "react";
import { PlayersContext } from "../../../components/PlayersProvider";
import { CategoriesContext } from "../../../components/CategoriesProvider";
import { type Jugadora } from "../../../data/mockData";
import NutritionHub from "./nutrition/NutritionHub";

const CATEGORY_GRADIENTS = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
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
  v >= 8 ? "pf-v2-t-ok" : v >= 6 ? "pf-v2-t-warn" : "pf-v2-t-danger";

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
    <div className="pf-v2-page">
      {/* ── Header ── */}
      <section className="pf-v2-hero-block">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pf-v2-eyebrow">Categorías</span>
            <h1 className="pf-v2-h1" style={{ fontSize: 32 }}>{categoria}</h1>
            <p className="pf-v2-muted" style={{ marginTop: 8 }}>
              {totalEnCategoria} jugadora{totalEnCategoria !== 1 ? "s" : ""} en esta categoría.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/categorias" className="pf-v2-btn pf-v2-btn-2">
              ← Categorías
            </Link>
            <Link
              href={`/nueva-jugadora?categoria=${encodeURIComponent(categoria)}`}
              className="pf-v2-btn"
            >
              + Agregar jugadora
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="pf-v2-card">
          <p className="pf-v2-muted">👥 Total</p>
          <p className="mt-2 text-3xl font-bold pf-v2-t">{totalEnCategoria}</p>
        </div>
        <div className="pf-v2-card">
          <p className="pf-v2-muted">💚 Wellness promedio</p>
          <p className="mt-2 text-3xl font-bold pf-v2-t">
            {jugadorasEnCategoria.length > 0
              ? (jugadorasEnCategoria.reduce((a, j) => a + (j.wellness || 0), 0) / jugadorasEnCategoria.length).toFixed(1)
              : "—"}
          </p>
        </div>
        <div className="pf-v2-card">
          <p className="pf-v2-muted">⚡ Carga promedio</p>
          <p className="mt-2 text-3xl font-bold pf-v2-t">
            {jugadorasEnCategoria.length > 0
              ? Math.round(jugadorasEnCategoria.reduce((a, j) => a + (Number(j.carga) || 0), 0) / jugadorasEnCategoria.length)
              : "—"}
          </p>
        </div>
      </section>

      {/* ── Color accent bar ── */}
      <div className={`h-1.5 w-full rounded-full${visual.tone}`} />

      {/* ── Search ── */}
      <div className="flex items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar jugadora en esta categoría…"
          className="h-10 min-w-[220px] max-w-sm rounded-xl border pf-v2-b-hi pf-v2-s-hi px-4 text-sm pf-v2-t pf-v2-ph outline-none focus:ring-1"
        />
      </div>

      {/* ── Player list ── */}
      <section className="pf-v2-card">
        <h2 className="mb-5 text-lg font-semibold pf-v2-t">
          Jugadoras ({jugadorasEnCategoria.length})
        </h2>

        {jugadorasEnCategoria.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-3xl">👥</p>
            <p className="mt-3 text-base font-medium pf-v2-t-70">
              {busqueda ? "Sin resultados para esa búsqueda." : "No hay jugadoras en esta categoría."}
            </p>
            {!busqueda && (
              <Link
                href={`/nueva-jugadora?categoria=${encodeURIComponent(categoria)}`}
                className="pf-v2-btn"
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
                className="rounded-xl border pf-v2-b pf-v2-s-hi p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full pf-v2-s-hi text-sm font-bold pf-v2-t-70">
                      {jugadora.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold pf-v2-t">{jugadora.nombre}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {jugadora.posicion && (
                          <span className="text-xs pf-v2-t-50">{jugadora.posicion}</span>
                        )}
                        {jugadora.deporte && (
                          <span className="rounded-full border pf-v2-b pf-v2-s-hi px-2 py-0.5 text-xs pf-v2-t-50">
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
                          className="rounded-lg border pf-v2-b-hi pf-v2-s-hi px-2 py-1 text-sm pf-v2-t outline-none"
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
                          className="pf-v2-btn"
                        >
                          Guardar
                        </ReliableActionButton>
                        <ReliableActionButton
                          onClick={() => { setCambiandoCategoria(null); setNuevaCategoria(""); }}
                          className="pf-v2-btn pf-v2-btn-2"
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
                          className="pf-v2-btn pf-v2-btn-2"
                        >
                          Mover
                        </ReliableActionButton>
                        <ReliableActionButton
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${jugadora.nombre} de la categoría?`)) {
                              eliminarJugadora(jugadora.nombre);
                            }
                          }}
                          className="pf-v2-btn pf-v2-btn-danger"
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
                    <div className="rounded-lg border pf-v2-b pf-v2-s-hi px-3 py-2 text-xs">
                      <p className="pf-v2-t-40">Wellness</p>
                      <p className={`font-bold ${wellnessColor(jugadora.wellness)}`}>{jugadora.wellness}/10</p>
                    </div>
                  )}
                  {jugadora.carga != null && (
                    <div className="rounded-lg border pf-v2-b pf-v2-s-hi px-3 py-2 text-xs">
                      <p className="pf-v2-t-40">Carga</p>
                      <p className="font-bold pf-v2-t">{jugadora.carga}</p>
                    </div>
                  )}
                  {jugadora.altura && (
                    <div className="rounded-lg border pf-v2-b pf-v2-s-hi px-3 py-2 text-xs">
                      <p className="pf-v2-t-40">Altura</p>
                      <p className="font-bold pf-v2-t">{jugadora.altura} cm</p>
                    </div>
                  )}
                  {jugadora.peso && (
                    <div className="rounded-lg border pf-v2-b pf-v2-s-hi px-3 py-2 text-xs">
                      <p className="pf-v2-t-40">Peso</p>
                      <p className="font-bold pf-v2-t">{jugadora.peso} kg</p>
                    </div>
                  )}
                </div>

                {(jugadora.objetivo || jugadora.observaciones) && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs pf-v2-t-50">
                    {jugadora.objetivo && (
                      <p><span className="font-medium pf-v2-t-40">Objetivo: </span>{jugadora.objetivo}</p>
                    )}
                    {jugadora.observaciones && (
                      <p><span className="font-medium pf-v2-t-40">Obs: </span>{jugadora.observaciones}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
