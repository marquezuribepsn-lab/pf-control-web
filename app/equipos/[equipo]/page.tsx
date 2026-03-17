"use client";

import { useContext, use, useState } from "react";
import { PlayersContext } from "../../../components/PlayersProvider";
import { CategoriesContext } from "../../../components/CategoriesProvider";
import { useEquipos } from "../../../components/EquiposProvider";
import { type Jugadora } from "../../../data/mockData";

export default function EquipoPage({ params }: { params: Promise<{ equipo: string }> }) {
  const { equipos, editarEquipo, eliminarEquipo } = useEquipos();
  const { jugadoras, cambiarCategoriaJugadora, eliminarJugadora } = useContext(PlayersContext)!;
  const { categorias } = useContext(CategoriesContext)!;
  const resolvedParams = use(params);
  const equipoNombre = decodeURIComponent(resolvedParams.equipo);

  const equipo = equipos.find((e) => e.nombre === equipoNombre);
  if (!equipo) {
    return <div>Equipo no encontrado</div>;
  }

  const jugadorasEnEquipo = jugadoras.filter(
    (jugadora: Jugadora) => jugadora.categoria === equipo.categoria
  );

  const [cambiandoCategoria, setCambiandoCategoria] = useState<string | null>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [editandoEquipo, setEditandoEquipo] = useState(false);
  const [formData, setFormData] = useState({
    nombre: equipo.nombre,
    categoria: equipo.categoria,
    temporada: equipo.temporada,
    descripcion: equipo.descripcion || "",
  });

  const handleUpdateEquipo = (e: React.FormEvent) => {
    e.preventDefault();
    editarEquipo(equipo.id, formData);
    setEditandoEquipo(false);
  };

  const handleDeleteEquipo = () => {
    if (confirm("¿Estás seguro de que quieres eliminar este equipo?")) {
      eliminarEquipo(equipo.id);
      // Redirect to equipos page would be handled by Next.js routing
    }
  };

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{equipo.nombre}</h1>
          <p className="text-sm text-neutral-600">
            {equipo.categoria} · Temporada {equipo.temporada}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditandoEquipo(true)}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Editar Equipo
          </button>
          <button
            onClick={handleDeleteEquipo}
            className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Eliminar Equipo
          </button>
        </div>
      </div>

      {editandoEquipo && (
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Editar Equipo</h2>
          <form onSubmit={handleUpdateEquipo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Nombre
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Categoría
              </label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
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
              <label className="block text-sm font-medium text-neutral-700">
                Temporada
              </label>
              <input
                type="text"
                value={formData.temporada}
                onChange={(e) => setFormData({ ...formData, temporada: e.target.value })}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Descripción
              </label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Actualizar
              </button>
              <button
                type="button"
                onClick={() => setEditandoEquipo(false)}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Detalles del Equipo</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium">Categoría</p>
            <p className="text-lg">{equipo.categoria}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Temporada</p>
            <p className="text-lg">{equipo.temporada}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Jugadoras</p>
            <p className="text-lg" suppressHydrationWarning={true}>{jugadorasEnEquipo.length}</p>
          </div>
        </div>
        {equipo.descripcion && (
          <div className="mt-4">
            <p className="text-sm font-medium">Descripción</p>
            <p className="text-lg">{equipo.descripcion}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4">Agregar Jugadora al Equipo</h2>
        <div className="space-y-2">
          {jugadoras
            .filter((j) => j.categoria !== equipo.categoria)
            .map((jugadora) => (
              <div key={jugadora.nombre} className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg">
                <div>
                  <p className="font-medium">{jugadora.nombre}</p>
                  <p className="text-sm text-neutral-600">Categoría actual: {jugadora.categoria}</p>
                </div>
                <button
                  onClick={() => cambiarCategoriaJugadora(jugadora.nombre, equipo.categoria)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  Agregar al equipo
                </button>
              </div>
            ))}
          {jugadoras.filter((j) => j.categoria !== equipo.categoria).length === 0 && (
            <p className="text-neutral-500 text-center py-4">No hay jugadoras disponibles para agregar.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Jugadoras</h2>
        {jugadorasEnEquipo.length === 0 ? (
          <p>No hay jugadoras en este equipo.</p>
        ) : (
          <div className="space-y-4">
            {jugadorasEnEquipo.map((jugadora, index) => (
              <div key={index} className="border-b border-neutral-200 pb-4 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium">{jugadora.nombre}</h3>
                  <div className="flex gap-2">
                    {cambiandoCategoria === jugadora.nombre ? (
                      <div className="flex gap-2">
                        <select
                          value={nuevaCategoria}
                          onChange={(e) => setNuevaCategoria(e.target.value)}
                          className="rounded border border-neutral-300 px-2 py-1 text-sm"
                        >
                          {categorias
                            .filter((cat) => cat.habilitada)
                            .map((cat) => (
                              <option key={cat.nombre} value={cat.nombre}>
                                {cat.nombre}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => {
                            if (nuevaCategoria && nuevaCategoria !== jugadora.categoria) {
                              cambiarCategoriaJugadora(jugadora.nombre, nuevaCategoria);
                            }
                            setCambiandoCategoria(null);
                            setNuevaCategoria("");
                          }}
                          className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => {
                            setCambiandoCategoria(null);
                            setNuevaCategoria("");
                          }}
                          className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setCambiandoCategoria(jugadora.nombre);
                            setNuevaCategoria(jugadora.categoria || "");
                          }}
                          className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
                        >
                          Cambiar Equipo
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Estás seguro de que quieres eliminar a ${jugadora.nombre}?`)) {
                              eliminarJugadora(jugadora.nombre);
                            }
                          }}
                          className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
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