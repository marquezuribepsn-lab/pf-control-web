"use client";

import { useContext, useState } from "react";
import Link from "next/link";
import { useEquipos } from "../../components/EquiposProvider";
import { PlayersContext } from "../../components/PlayersProvider";
import { CategoriesContext } from "../../components/CategoriesProvider";
import { type Jugadora } from "../../data/mockData";

export default function EquiposPage() {
  const { equipos, agregarEquipo, editarEquipo, eliminarEquipo } = useEquipos();
  const { jugadoras } = useContext(PlayersContext)!;
  const { categorias } = useContext(CategoriesContext)!;

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoEquipo, setEditandoEquipo] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    categoria: "",
    temporada: "",
    descripcion: "",
  });

  const equiposConJugadoras = equipos.map((equipo) => ({
    ...equipo,
    jugadoras: jugadoras.filter((j: Jugadora) => j.categoria === equipo.categoria).length,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editandoEquipo) {
      editarEquipo(editandoEquipo, formData);
      setEditandoEquipo(null);
    } else {
      agregarEquipo(formData);
    }
    setFormData({ nombre: "", categoria: "", temporada: "", descripcion: "" });
    setMostrarFormulario(false);
  };

  const handleEdit = (equipo: any) => {
    setFormData({
      nombre: equipo.nombre,
      categoria: equipo.categoria,
      temporada: equipo.temporada,
      descripcion: equipo.descripcion || "",
    });
    setEditandoEquipo(equipo.id);
    setMostrarFormulario(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este equipo?")) {
      eliminarEquipo(id);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Equipos</h1>
          <p className="text-sm text-neutral-600">
            Gestión de equipos por categoría y temporada.
          </p>
        </div>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
        >
          Nuevo Equipo
        </button>
      </div>

      {mostrarFormulario && (
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-xl font-semibold">
            {editandoEquipo ? "Editar Equipo" : "Nuevo Equipo"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {editandoEquipo ? "Actualizar" : "Crear"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarFormulario(false);
                  setEditandoEquipo(null);
                  setFormData({ nombre: "", categoria: "", temporada: "", descripcion: "" });
                }}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {equiposConJugadoras.map((equipo) => (
          <div
            key={equipo.id}
            className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <Link
                  href={`/equipos/${encodeURIComponent(equipo.nombre)}`}
                  className="text-lg font-semibold hover:text-blue-600"
                >
                  {equipo.nombre}
                </Link>
                <p className="text-sm text-neutral-600">
                  {equipo.categoria} • {equipo.temporada} • {equipo.jugadoras} jugadoras
                </p>
                {equipo.descripcion && (
                  <p className="text-sm text-neutral-500 mt-1">{equipo.descripcion}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/equipos/${encodeURIComponent(equipo.nombre)}/sesiones`}
                  className="rounded-xl border border-green-300 px-3 py-1 text-sm text-green-600 hover:bg-green-50"
                  title="Planificar Sesión"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </Link>
                <button
                  onClick={() => handleEdit(equipo)}
                  className="rounded-xl border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(equipo.id)}
                  className="rounded-xl border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}