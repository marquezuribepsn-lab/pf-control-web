"use client";

import { useContext, use, useState } from "react";
import { useEquipos } from "../../../../components/EquiposProvider";
import { useSessions } from "../../../../components/SessionsProvider";
import { useEjercicios } from "../../../../components/EjerciciosProvider";
import { PlayersContext } from "../../../../components/PlayersProvider";
import { type Jugadora, type BloqueEntrenamiento } from "../../../../data/mockData";

export default function EquipoSesionesPage({ params }: { params: Promise<{ equipo: string }> }) {
  const { equipos } = useEquipos();
  const { sesiones, agregarSesion, editarSesion } = useSessions();
  const { ejercicios } = useEjercicios();
  const { jugadoras } = useContext(PlayersContext)!;
  const resolvedParams = use(params);
  const equipoNombre = decodeURIComponent(resolvedParams.equipo);

  const equipo = equipos.find((e) => e.nombre === equipoNombre);
  if (!equipo) {
    return <div>Equipo no encontrado</div>;
  }

  const sesionesEquipo = sesiones.filter((sesion) => sesion.equipo === equipo.nombre);
  const jugadorasEnEquipo = jugadoras.filter((j: Jugadora) => j.categoria === equipo.categoria);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<string | null>(null);
  const [mostrarBuscadorEjercicios, setMostrarBuscadorEjercicios] = useState(false);
  const [bloqueActual, setBloqueActual] = useState<string | null>(null);
  const [busquedaEjercicio, setBusquedaEjercicio] = useState("");
  const [ejerciciosSeleccionados, setEjerciciosSeleccionados] = useState<Set<string>>(new Set());
  const [parametrosGlobales, setParametrosGlobales] = useState({
    series: 3,
    repeticiones: "",
    carga: "",
    observaciones: "",
  });

  const [formData, setFormData] = useState({
    titulo: "",
    objetivo: "",
    duracion: "",
    bloques: "",
  });

  const [bloqueForm, setBloqueForm] = useState({
    titulo: "",
    objetivo: "",
  });

  const [ejercicioForm, setEjercicioForm] = useState({
    ejercicioId: "",
    series: 3,
    repeticiones: "",
    carga: "",
    observaciones: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    agregarSesion({
      ...formData,
      equipo: equipo.nombre,
      bloques: [], // Inicialmente sin bloques
    });
    setFormData({ titulo: "", objetivo: "", duracion: "", bloques: "" });
    setMostrarFormulario(false);
  };

  const agregarBloque = (sesionId: string) => {
    const nuevaSesion = sesiones.find(s => s.id === sesionId);
    if (!nuevaSesion) return;

    const nuevoBloque: BloqueEntrenamiento = {
      id: Date.now().toString(),
      titulo: bloqueForm.titulo,
      objetivo: bloqueForm.objetivo,
      ejercicios: [],
    };

    editarSesion(sesionId, {
      bloques: [...nuevaSesion.bloques, nuevoBloque],
    });

    setBloqueForm({ titulo: "", objetivo: "" });
  };

  const agregarEjerciciosABloque = (sesionId: string, bloqueId: string) => {
    const sesion = sesiones.find(s => s.id === sesionId);
    if (!sesion) return;

    const nuevosEjercicios = Array.from(ejerciciosSeleccionados).map(ejercicioId => ({
      ejercicioId,
      series: parametrosGlobales.series,
      repeticiones: parametrosGlobales.repeticiones,
      carga: parametrosGlobales.carga,
      observaciones: parametrosGlobales.observaciones,
    }));

    const bloquesActualizados = sesion.bloques.map(bloque =>
      bloque.id === bloqueId
        ? { ...bloque, ejercicios: [...bloque.ejercicios, ...nuevosEjercicios] }
        : bloque
    );

    editarSesion(sesionId, { bloques: bloquesActualizados });

    // Limpiar selección
    setEjerciciosSeleccionados(new Set());
    setParametrosGlobales({
      series: 3,
      repeticiones: "",
      carga: "",
      observaciones: "",
    });
    setMostrarBuscadorEjercicios(false);
    setBloqueActual(null);
  };

  const toggleEjercicioSeleccionado = (ejercicioId: string) => {
    const nuevosSeleccionados = new Set(ejerciciosSeleccionados);
    if (nuevosSeleccionados.has(ejercicioId)) {
      nuevosSeleccionados.delete(ejercicioId);
    } else {
      nuevosSeleccionados.add(ejercicioId);
    }
    setEjerciciosSeleccionados(nuevosSeleccionados);
  };

  const seleccionarTodosEjercicios = () => {
    const todosIds = new Set(ejerciciosFiltrados.map(e => e.id));
    setEjerciciosSeleccionados(todosIds);
  };

  const deseleccionarTodosEjercicios = () => {
    setEjerciciosSeleccionados(new Set());
  };

  const ejerciciosFiltrados = ejercicios.filter(ejercicio =>
    ejercicio.nombre.toLowerCase().includes(busquedaEjercicio.toLowerCase()) ||
    ejercicio.categoria.toLowerCase().includes(busquedaEjercicio.toLowerCase())
  );

  const getEjercicioById = (id: string) => ejercicios.find(e => e.id === id);

  const getEmbedUrl = (url: string) => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';

        if (url.includes('youtube.com/watch?v=')) {
          videoId = url.split('v=')[1]?.split('&')[0];
        } else if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1]?.split('?')[0];
        } else if (url.includes('youtube.com/embed/')) {
          videoId = url.split('embed/')[1]?.split('?')[0];
        }

        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }

      if (url.includes('vimeo.com')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
        if (videoId) {
          return `https://player.vimeo.com/video/${videoId}`;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Sesiones - {equipo.nombre}</h1>
          <p className="text-sm text-neutral-600">
            Planificación detallada de sesiones de entrenamiento
          </p>
        </div>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
        >
          Nueva Sesión
        </button>
      </div>

      {/* Información del equipo */}
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold mb-4">Información del Equipo</h2>
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
            <p className="text-lg">{jugadorasEnEquipo.length}</p>
          </div>
        </div>
        {equipo.descripcion && (
          <div className="mt-4">
            <p className="text-sm font-medium">Descripción</p>
            <p className="text-lg">{equipo.descripcion}</p>
          </div>
        )}
      </div>

      {mostrarFormulario && (
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-xl font-semibold">Nueva Sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Título de la Sesión
              </label>
              <input
                type="text"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                placeholder="Ej: Fuerza tren inferior + aceleración"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Objetivo
              </label>
              <textarea
                value={formData.objetivo}
                onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                rows={3}
                placeholder="Describe el objetivo principal de la sesión..."
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Duración (minutos)
                </label>
                <input
                  type="number"
                  value={formData.duracion}
                  onChange={(e) => setFormData({ ...formData, duracion: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                  placeholder="90"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Número estimado de bloques
                </label>
                <input
                  type="number"
                  value={formData.bloques}
                  onChange={(e) => setFormData({ ...formData, bloques: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                  placeholder="3"
                  required
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Crear Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarFormulario(false);
                  setFormData({ titulo: "", objetivo: "", duracion: "", bloques: "" });
                }}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sesiones del equipo */}
      <div className="space-y-6">
        {sesionesEquipo.map((sesion) => (
          <div key={sesion.id} className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-2xl font-bold">{sesion.titulo}</h3>
                <p className="text-neutral-600 mt-1">{sesion.objetivo}</p>
                <div className="flex gap-4 mt-2 text-sm text-neutral-500">
                  <span>⏱️ {sesion.duracion} min</span>
                  <span>📊 {sesion.bloques.length} bloques</span>
                </div>
              </div>
              <button
                onClick={() => setSesionSeleccionada(sesionSeleccionada === sesion.id ? null : sesion.id)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {sesionSeleccionada === sesion.id ? "Ocultar Detalles" : "Ver Detalles"}
              </button>
            </div>

            {sesionSeleccionada === sesion.id && (
              <div className="mt-6 space-y-6">
                {/* Formulario para agregar bloque */}
                <div className="rounded-xl bg-neutral-50 p-4">
                  <h4 className="text-lg font-semibold mb-3">Agregar Nuevo Bloque</h4>
                  <div className="grid gap-4 md:grid-cols-2 mb-4">
                    <input
                      type="text"
                      placeholder="Título del bloque"
                      value={bloqueForm.titulo}
                      onChange={(e) => setBloqueForm({ ...bloqueForm, titulo: e.target.value })}
                      className="rounded-md border border-neutral-300 px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="Objetivo del bloque"
                      value={bloqueForm.objetivo}
                      onChange={(e) => setBloqueForm({ ...bloqueForm, objetivo: e.target.value })}
                      className="rounded-md border border-neutral-300 px-3 py-2"
                    />
                  </div>
                  <button
                    onClick={() => agregarBloque(sesion.id)}
                    disabled={!bloqueForm.titulo || !bloqueForm.objetivo}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Agregar Bloque
                  </button>
                </div>

                {/* Bloques de la sesión */}
                <div className="space-y-4">
                  {sesion.bloques.map((bloque) => (
                    <div key={bloque.id} className="rounded-xl bg-neutral-50 p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h5 className="text-lg font-semibold">{bloque.titulo}</h5>
                          <p className="text-neutral-600">{bloque.objetivo}</p>
                        </div>
                        <button
                          onClick={() => {
                            setBloqueActual(bloqueActual === bloque.id ? null : bloque.id);
                            setMostrarBuscadorEjercicios(false);
                          }}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          {bloqueActual === bloque.id ? "Ocultar" : "Agregar Ejercicio"}
                        </button>
                      </div>

                      {/* Lista de ejercicios del bloque */}
                      <div className="space-y-3">
                        {bloque.ejercicios.map((ejercicioBloque, index) => {
                          const ejercicio = getEjercicioById(ejercicioBloque.ejercicioId);
                          if (!ejercicio) return null;

                          return (
                            <div key={index} className="rounded-lg bg-white p-4 border border-neutral-200">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h6 className="font-semibold">{ejercicio.nombre}</h6>
                                    <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                                      {ejercicio.categoria}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium">Series:</span> {ejercicioBloque.series}
                                    </div>
                                    <div>
                                      <span className="font-medium">Repeticiones:</span> {ejercicioBloque.repeticiones}
                                    </div>
                                    {ejercicioBloque.carga && (
                                      <div>
                                        <span className="font-medium">Carga:</span> {ejercicioBloque.carga}
                                      </div>
                                    )}
                                    {ejercicioBloque.observaciones && (
                                      <div className="col-span-2">
                                        <span className="font-medium">Observaciones:</span> {ejercicioBloque.observaciones}
                                      </div>
                                    )}
                                  </div>

                                  {ejercicio.descripcion && (
                                    <p className="text-sm text-neutral-600 mt-2">{ejercicio.descripcion}</p>
                                  )}
                                </div>

                                {/* Video del ejercicio */}
                                {ejercicio.videoUrl && (() => {
                                  const embedUrl = getEmbedUrl(ejercicio.videoUrl);
                                  return embedUrl ? (
                                    <div className="ml-4 flex-shrink-0">
                                      <div className="w-32 h-20 rounded-lg overflow-hidden bg-neutral-100">
                                        <iframe
                                          src={embedUrl}
                                          className="w-full h-full"
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                          allowFullScreen
                                          title={`Video de ${ejercicio.nombre}`}
                                        />
                                      </div>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Formulario para agregar ejercicios */}
                      {bloqueActual === bloque.id && (
                        <div className="mt-4 rounded-lg bg-white p-4 border border-neutral-200">
                          {!mostrarBuscadorEjercicios ? (
                            <div className="text-center">
                              <button
                                onClick={() => setMostrarBuscadorEjercicios(true)}
                                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                              >
                                Agregar Ejercicios
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Barra de búsqueda y controles */}
                              <div className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  placeholder="Buscar ejercicios..."
                                  value={busquedaEjercicio}
                                  onChange={(e) => setBusquedaEjercicio(e.target.value)}
                                  className="flex-1 rounded-md border border-neutral-300 px-3 py-2"
                                />
                                <button
                                  onClick={seleccionarTodosEjercicios}
                                  className="rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
                                >
                                  Todos
                                </button>
                                <button
                                  onClick={deseleccionarTodosEjercicios}
                                  className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
                                >
                                  Ninguno
                                </button>
                              </div>

                              {/* Lista de ejercicios con checkboxes */}
                              <div className="grid gap-2 max-h-60 overflow-y-auto border border-neutral-200 rounded-lg p-2">
                                {ejerciciosFiltrados.map((ejercicio) => (
                                  <label key={ejercicio.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={ejerciciosSeleccionados.has(ejercicio.id)}
                                      onChange={() => toggleEjercicioSeleccionado(ejercicio.id)}
                                      className="rounded border-neutral-300"
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium">{ejercicio.nombre}</div>
                                      <div className="text-sm text-neutral-600">{ejercicio.categoria}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>

                              {/* Parámetros globales */}
                              {ejerciciosSeleccionados.size > 0 && (
                                <div className="space-y-4 border-t border-neutral-200 pt-4">
                                  <h6 className="font-medium text-green-700">
                                    {ejerciciosSeleccionados.size} ejercicio{ejerciciosSeleccionados.size !== 1 ? 's' : ''} seleccionado{ejerciciosSeleccionados.size !== 1 ? 's' : ''}
                                  </h6>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                      <label className="block text-sm font-medium text-neutral-700">
                                        Series (todos)
                                      </label>
                                      <input
                                        type="number"
                                        value={parametrosGlobales.series}
                                        onChange={(e) => setParametrosGlobales({ ...parametrosGlobales, series: Number(e.target.value) })}
                                        className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                                        min="1"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-neutral-700">
                                        Repeticiones (todos)
                                      </label>
                                      <input
                                        type="text"
                                        value={parametrosGlobales.repeticiones}
                                        onChange={(e) => setParametrosGlobales({ ...parametrosGlobales, repeticiones: e.target.value })}
                                        className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                                        placeholder="8-10 o máx"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-neutral-700">
                                      Carga (todos)
                                    </label>
                                    <input
                                      type="text"
                                      value={parametrosGlobales.carga}
                                      onChange={(e) => setParametrosGlobales({ ...parametrosGlobales, carga: e.target.value })}
                                      className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                                      placeholder="70% 1RM o peso específico"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-neutral-700">
                                      Observaciones (todos)
                                    </label>
                                    <textarea
                                      value={parametrosGlobales.observaciones}
                                      onChange={(e) => setParametrosGlobales({ ...parametrosGlobales, observaciones: e.target.value })}
                                      className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
                                      rows={2}
                                      placeholder="Instrucciones específicas, técnica, etc."
                                    />
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => agregarEjerciciosABloque(sesion.id, bloque.id)}
                                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                                    >
                                      Agregar {ejerciciosSeleccionados.size} Ejercicio{ejerciciosSeleccionados.size !== 1 ? 's' : ''} al Bloque
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEjerciciosSeleccionados(new Set());
                                        setParametrosGlobales({
                                          series: 3,
                                          repeticiones: "",
                                          carga: "",
                                          observaciones: "",
                                        });
                                        setMostrarBuscadorEjercicios(false);
                                        setBloqueActual(null);
                                      }}
                                      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {sesionesEquipo.length === 0 && (
        <div className="rounded-2xl bg-white p-8 shadow-sm text-center">
          <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-neutral-900">No hay sesiones planificadas</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Crea tu primera sesión de entrenamiento para este equipo.
          </p>
        </div>
      )}
    </main>
  );
}