"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayersContext } from "../../../components/PlayersProvider";
import { CategoriesContext } from "../../../components/CategoriesProvider";
import { useEquipos } from "../../../components/EquiposProvider";
import { type Jugadora } from "../../../data/mockData";

const INPUT_CLS =
  "w-full rounded-xl border border-white/12 bg-white/6 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30";
const LABEL_CLS = "mb-1 block text-sm font-medium text-slate-300";

export default function EquipoPage({ params }: { params: Promise<{ equipo: string }> }) {
  const router = useRouter();
  const { equipos, editarEquipo, eliminarEquipo } = useEquipos();
  const { jugadoras, cambiarCategoriaJugadora, eliminarJugadora } = useContext(PlayersContext)!;
  const { categorias } = useContext(CategoriesContext)!;
  const resolvedParams = use(params);
  const equipoNombre = decodeURIComponent(resolvedParams.equipo);

  const equipo = equipos.find((e) => e.nombre === equipoNombre);

  const [cambiandoCategoria, setCambiandoCategoria] = useState<string | null>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [editandoEquipo, setEditandoEquipo] = useState(false);
  const [formData, setFormData] = useState({
    nombre: equipo?.nombre || "",
    categoria: equipo?.categoria || "",
    temporada: equipo?.temporada || "",
    descripcion: equipo?.descripcion || "",
  });

  useEffect(() => {
    if (!equipo) return;
    setFormData({
      nombre: equipo.nombre,
      categoria: equipo.categoria,
      temporada: equipo.temporada,
      descripcion: equipo.descripcion || "",
    });
  }, [equipo?.id]);

  if (!equipo) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-6 text-slate-100">
        <div className="text-center">
          <p className="text-5xl">🏆</p>
          <p className="mt-4 text-xl font-semibold">Equipo no encontrado</p>
          <p className="mt-1 text-sm text-slate-400">El equipo que buscás no existe o fue eliminado.</p>
          <Link href="/equipos" className="pf-btn pf-btn--ghost mt-5 inline-block">
            ← Volver a Equipos
          </Link>
        </div>
      </main>
    );
  }

  const jugadorasEnEquipo = jugadoras.filter(
    (jugadora: Jugadora) => jugadora.categoria === equipo.categoria
  );

  const jugadorasFuera = jugadoras.filter(
    (jugadora: Jugadora) => jugadora.categoria !== equipo.categoria
  );

  const handleUpdateEquipo = (e: React.FormEvent) => {
    e.preventDefault();
    editarEquipo(equipo.id, formData);
    setEditandoEquipo(false);
  };

  const handleDeleteEquipo = () => {
    if (confirm("¿Estás seguro de que querés eliminar este equipo?")) {
      eliminarEquipo(equipo.id);
      router.push("/equipos");
    }
  };

  return (
    <main className="relative mx-auto max-w-[1480px] space-y-6 p-6 text-slate-100">
      {/* ── Header ── */}
      <section className="pf-page-hero mb-6">
        <div className="pf-blob pf-blob--tl" />
        <div className="pf-blob pf-blob--br" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="pf-page-hero-badge">🏆 Planificación Estructural</p>
            <h1 className="pf-page-hero-title">{equipo.nombre}</h1>
            <p className="pf-page-hero-sub">
              {equipo.categoria} · Temporada {equipo.temporada}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/equipos" className="pf-btn pf-btn--ghost">
              ← Equipos
            </Link>
            <ReliableActionButton
              onClick={() => setEditandoEquipo(true)}
              className="pf-btn pf-btn--ghost"
            >
              ✏️ Editar equipo
            </ReliableActionButton>
            <ReliableActionButton
              onClick={handleDeleteEquipo}
              className="pf-btn pf-btn--danger"
            >
              🗑 Eliminar
            </ReliableActionButton>
          </div>
        </div>
      </section>

      {/* ── Edit form ── */}
      {editandoEquipo && (
        <section className="pf-card rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-6">
          <h2 className="mb-5 text-lg font-semibold text-slate-200">✏️ Editar Equipo</h2>
          <form onSubmit={handleUpdateEquipo} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={LABEL_CLS}>Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className={INPUT_CLS}
                  required
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Temporada</label>
                <input
                  type="text"
                  value={formData.temporada}
                  onChange={(e) => setFormData({ ...formData, temporada: e.target.value })}
                  className={INPUT_CLS}
                  required
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Categoría</label>
                <select
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  className={INPUT_CLS}
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map((cat) => (
                    <option key={cat.nombre} value={cat.nombre}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Descripción</label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className={INPUT_CLS}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <ReliableActionButton type="submit" className="pf-btn pf-btn--success">
                Guardar cambios
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => setEditandoEquipo(false)}
                className="pf-btn pf-btn--ghost"
              >
                Cancelar
              </ReliableActionButton>
            </div>
          </form>
        </section>
      )}

      {/* ── Stats ── */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: "🏷️", label: "Categoría", value: equipo.categoria },
          { icon: "📅", label: "Temporada", value: equipo.temporada },
          { icon: "👥", label: "Jugadoras en el equipo", value: jugadorasEnEquipo.length },
        ].map((s) => (
          <div key={s.label} className="pf-card rounded-2xl border border-white/8 p-5">
            <p className="text-sm text-slate-400">{s.icon} {s.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-100" suppressHydrationWarning>{s.value}</p>
          </div>
        ))}
        {equipo.descripcion && (
          <div className="pf-card col-span-full rounded-2xl border border-white/8 p-5">
            <p className="text-sm text-slate-400">📝 Descripción</p>
            <p className="mt-1 text-slate-200">{equipo.descripcion}</p>
          </div>
        )}
      </section>

      {/* ── Jugadoras del equipo ── */}
      <section className="pf-card rounded-2xl border border-white/8 p-6">
        <h2 className="mb-5 text-lg font-semibold text-slate-200">👥 Jugadoras del Equipo</h2>
        {jugadorasEnEquipo.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No hay jugadoras asignadas a este equipo aún.
          </p>
        ) : (
          <div className="space-y-3">
            {jugadorasEnEquipo.map((jugadora) => (
              <div
                key={jugadora.nombre}
                className="rounded-xl border border-white/8 bg-white/3 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-sm font-bold text-slate-300">
                      {jugadora.nombre?.charAt(0).toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100">{jugadora.nombre}</p>
                      <p className="text-xs text-slate-500">{jugadora.posicion}</p>
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
                          {categorias
                            .filter((cat) => cat.habilitada)
                            .map((cat) => (
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
                          Cambiar equipo
                        </ReliableActionButton>
                        <ReliableActionButton
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${jugadora.nombre}?`)) {
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

                {/* Player detail grid */}
                <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Wellness", value: jugadora.wellness != null ? `${jugadora.wellness}/10` : null },
                    { label: "Carga", value: jugadora.carga },
                    { label: "Altura", value: jugadora.altura ? `${jugadora.altura} cm` : null },
                    { label: "Peso", value: jugadora.peso ? `${jugadora.peso} kg` : null },
                    { label: "Deporte", value: jugadora.deporte },
                    { label: "Club", value: jugadora.club },
                    { label: "Objetivo", value: jugadora.objetivo },
                    { label: "Nacimiento", value: jugadora.fechaNacimiento },
                  ]
                    .filter((d) => d.value)
                    .map((d) => (
                      <p key={d.label}>
                        <span className="font-medium text-slate-500">{d.label}: </span>
                        <span className="text-slate-300">{d.value}</span>
                      </p>
                    ))}
                </div>
                {jugadora.observaciones && (
                  <p className="mt-2 rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-500">Obs: </span>{jugadora.observaciones}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Agregar jugadoras ── */}
      {jugadorasFuera.length > 0 && (
        <section className="pf-card rounded-2xl border border-white/8 p-6">
          <h2 className="mb-5 text-lg font-semibold text-slate-200">➕ Agregar Jugadora al Equipo</h2>
          <div className="space-y-2">
            {jugadorasFuera.map((jugadora) => (
              <div
                key={jugadora.nombre}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">{jugadora.nombre}</p>
                  <p className="text-xs text-slate-500">Categoría actual: {jugadora.categoria || "Sin categoría"}</p>
                </div>
                <ReliableActionButton
                  onClick={() => cambiarCategoriaJugadora(jugadora.nombre, equipo.categoria)}
                  className="pf-btn pf-btn--primary text-xs"
                >
                  Agregar al equipo
                </ReliableActionButton>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
