"use client";

import { useState } from "react";
import { useEjercicios } from "../../components/EjerciciosProvider";

export default function EjerciciosPage() {
  const { ejercicios, agregarEjercicio, editarEjercicio, eliminarEjercicio } = useEjercicios();
  const SHORTS_PROFILE_URL = "https://www.youtube.com/@ValentinoCoachFit/shorts";
  const SHORTS_PROFILE_HANDLE = "@ValentinoCoachFit";

  const shortsPorPalabraClave: Array<{ palabras: string[]; url: string }> = [
    { palabras: ["plank", "plancha", "core", "russian", "twist"], url: "https://www.youtube.com/shorts/4KCdjPgZA9E" },
    { palabras: ["burpee", "burpees", "condicion", "resistencia"], url: "https://www.youtube.com/shorts/dO4PoO8XgNk" },
    { palabras: ["press", "banca", "curl", "biceps", "bíceps", "triceps", "tríceps", "dominada", "pull-up", "pull up", "pullups", "pull-ups"], url: "https://www.youtube.com/shorts/8ZSQfmM0w2c" },
    { palabras: ["mountain", "climber", "sprint", "sentadilla", "peso", "deadlift", "zancada", "lunge", "step-up", "step up", "stepups", "step-ups", "box jump", "saltos de caja", "clean", "jerk", "snatch", "farmer", "walk", "potencia"], url: "https://www.youtube.com/shorts/9FGqk6nF1Qw" },
  ];

  const normalizarTexto = (texto: string) =>
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const obtenerShortAutomatico = (nombreEjercicio: string): string => {
    const nombreNormalizado = normalizarTexto(nombreEjercicio);

    for (const regla of shortsPorPalabraClave) {
      const coincide = regla.palabras.some((palabra) =>
        nombreNormalizado.includes(normalizarTexto(palabra))
      );

      if (coincide) {
        return regla.url;
      }
    }

    return "";
  };

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoEjercicio, setEditandoEjercicio] = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [categoriaSugerida, setCategoriaSugerida] = useState<string>("");
  const [descripcionGenerada, setDescripcionGenerada] = useState<string>("");
  const [formData, setFormData] = useState({
    nombre: "",
    categoria: "",
    descripcion: "",
    objetivo: "",
    videoUrl: "",
  });

  // Función para buscar similitudes en el nombre
  const buscarSimilitudes = (nombre: string) => {
    if (!nombre.trim()) {
      setSugerencias([]);
      return;
    }

    const nombreLower = nombre.toLowerCase();
    const similares = ejercicios.filter(ejercicio =>
      ejercicio.nombre.toLowerCase().includes(nombreLower) ||
      nombreLower.split(' ').some(palabra =>
        ejercicio.nombre.toLowerCase().includes(palabra) && palabra.length > 2
      )
    ).slice(0, 5); // Limitar a 5 sugerencias

    setSugerencias(similares);
  };

  // Función para sugerir categoría basada en palabras clave
  const sugerirCategoria = (nombre: string) => {
    const nombreLower = nombre.toLowerCase();

    const mapaPalabrasClave: { [key: string]: string } = {
      // Fuerza
      'sentadilla': 'Fuerza',
      'press': 'Fuerza',
      'banca': 'Fuerza',
      'peso': 'Fuerza',
      'mancuerna': 'Fuerza',
      'barra': 'Fuerza',
      'levantamiento': 'Fuerza',
      'curl': 'Fuerza',
      'extension': 'Fuerza',
      'dominada': 'Fuerza',
      'pull': 'Fuerza',
      'push': 'Fuerza',

      // Velocidad
      'sprint': 'Velocidad',
      'aceleracion': 'Velocidad',
      'velocidad': 'Velocidad',
      'carrera': 'Velocidad',
      'dash': 'Velocidad',

      // Resistencia
      'circuito': 'Resistencia',
      'endurance': 'Resistencia',
      'resistencia': 'Resistencia',
      'burpee': 'Resistencia',
      'mountain': 'Resistencia',
      'climber': 'Resistencia',

      // Técnica
      'tecnica': 'Técnica',
      'coordinacion': 'Técnica',
      'balance': 'Técnica',
      'agilidad': 'Técnica',
      'conduccion': 'Técnica',
      'pase': 'Técnica',
      'tiro': 'Técnica',

      // Flexibilidad
      'estiramiento': 'Flexibilidad',
      'flexibilidad': 'Flexibilidad',
      'yoga': 'Flexibilidad',
      'pilates': 'Flexibilidad',
      'estirar': 'Flexibilidad',

      // Prevención
      'prevencion': 'Prevención',
      'lesion': 'Prevención',
      'core': 'Prevención',
      'estabilidad': 'Prevención',
      'equilibrio': 'Prevención',
      'plank': 'Prevención'
    };

    for (const [palabra, categoria] of Object.entries(mapaPalabrasClave)) {
      if (nombreLower.includes(palabra)) {
        setCategoriaSugerida(categoria);
        return;
      }
    }

    setCategoriaSugerida("");
  };

  // Función para generar descripción automática
  const generarDescripcion = (nombre: string, categoria: string) => {
    const nombreLower = nombre.toLowerCase();

    const descripcionesBase: { [key: string]: string } = {
      'Fuerza': 'Ejercicio de fuerza que desarrolla la potencia muscular y aumenta la masa muscular.',
      'Velocidad': 'Ejercicio de velocidad que mejora la capacidad de aceleración y reacción rápida.',
      'Resistencia': 'Ejercicio de resistencia que fortalece el sistema cardiovascular y muscular.',
      'Técnica': 'Ejercicio técnico que mejora la coordinación, precisión y habilidades específicas.',
      'Flexibilidad': 'Ejercicio de flexibilidad que aumenta el rango de movimiento y previene lesiones.',
      'Prevención': 'Ejercicio preventivo que fortalece el core y mejora la estabilidad articular.'
    };

    let descripcion = descripcionesBase[categoria] || 'Ejercicio diseñado para mejorar el rendimiento físico.';

    // Personalizar basado en palabras clave específicas
    if (nombreLower.includes('sentadilla')) {
      descripcion = 'Ejercicio compuesto que fortalece piernas, glúteos y core. Mejora la fuerza funcional y estabilidad.';
    } else if (nombreLower.includes('press') && nombreLower.includes('banca')) {
      descripcion = 'Ejercicio fundamental para el desarrollo del pecho, hombros y tríceps. Base del entrenamiento de fuerza superior.';
    } else if (nombreLower.includes('sprint')) {
      descripcion = 'Carrera de alta intensidad que desarrolla velocidad máxima y capacidad anaeróbica.';
    } else if (nombreLower.includes('burpee')) {
      descripcion = 'Ejercicio funcional completo que combina fuerza, cardio y coordinación en un movimiento dinámico.';
    } else if (nombreLower.includes('plank')) {
      descripcion = 'Ejercicio isométrico que fortalece el core, mejora la estabilidad y previene dolores de espalda.';
    }

    setDescripcionGenerada(descripcion);
  };

  const categoriasEjercicios = [
    "Fuerza",
    "Velocidad",
    "Resistencia",
    "Técnica",
    "Flexibilidad",
    "Prevención",
  ];

  // Función para convertir URLs de video a formato embed
  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;

    try {
      // YouTube
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';

        if (url.includes('youtube.com/watch?v=')) {
          videoId = url.split('v=')[1]?.split('&')[0];
        } else if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1]?.split('?')[0];
        } else if (url.includes('youtube.com/shorts/')) {
          videoId = url.split('shorts/')[1]?.split('?')[0];
        } else if (url.includes('youtube.com/embed/')) {
          videoId = url.split('embed/')[1]?.split('?')[0];
        }

        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }

      // Vimeo
      if (url.includes('vimeo.com')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
        if (videoId) {
          return `https://player.vimeo.com/video/${videoId}`;
        }
      }

      // Si no es una URL reconocida, devolver null
      return null;
    } catch (error) {
      console.error('Error parsing video URL:', error);
      return null;
    }
  };

  // Función para buscar shorts en YouTube
  const buscarShortEnYouTube = (nombreEjercicio: string) => {
    const query = `${nombreEjercicio} site:youtube.com/${SHORTS_PROFILE_HANDLE} shorts`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(searchUrl, '_blank');
  };

  // Función para validar URLs de video
  const isValidVideoUrl = (url: string): boolean => {
    if (!url) return true; // Permitir URLs vacías
    return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formDataFinal = { ...formData };

    // Validar URL de video
    if (formDataFinal.videoUrl && !isValidVideoUrl(formDataFinal.videoUrl)) {
      alert('Por favor ingresa una URL válida de YouTube o Vimeo');
      return;
    }

    if (editandoEjercicio) {
      editarEjercicio(editandoEjercicio, formDataFinal);
      setEditandoEjercicio(null);
    } else {
      agregarEjercicio(formDataFinal);
    }
    setFormData({ nombre: "", categoria: "", descripcion: "", objetivo: "", videoUrl: "" });
    setMostrarFormulario(false);
    setSugerencias([]);
    setCategoriaSugerida("");
    setDescripcionGenerada("");
  };

  const handleEdit = (ejercicio: any) => {
    setFormData({
      nombre: ejercicio.nombre,
      categoria: ejercicio.categoria,
      descripcion: ejercicio.descripcion || "",
      objetivo: ejercicio.objetivo || "",
      videoUrl: ejercicio.videoUrl || "",
    });
    setEditandoEjercicio(ejercicio.id);
    setMostrarFormulario(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este ejercicio?")) {
      eliminarEjercicio(id);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Ejercicios</h1>
          <p className="text-sm text-neutral-600">
            Gestión de ejercicios disponibles para sesiones de entrenamiento.
          </p>
        </div>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
        >
          Nuevo Ejercicio
        </button>
      </div>

      {mostrarFormulario && (
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-6 text-2xl font-bold text-center">
            {editandoEjercicio ? "Editar Ejercicio" : "Crear Nuevo Ejercicio"}
          </h2>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">ℹ️ Información requerida para el ejercicio:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Nombre del ejercicio:</strong> Identificación clara y específica</li>
              <li>• <strong>Categoría:</strong> Clasificación por tipo de entrenamiento</li>
              <li>• <strong>Descripción:</strong> Explicación breve de cómo realizarlo</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                📝 Nombre del ejercicio
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => {
                  const nuevoNombre = e.target.value;
                  setFormData({
                    ...formData,
                    nombre: nuevoNombre,
                  });
                  buscarSimilitudes(nuevoNombre);
                  sugerirCategoria(nuevoNombre);
                  generarDescripcion(nuevoNombre, formData.categoria || categoriaSugerida);
                }}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Ej: Sentadilla búlgara, Press de banca, Sprint 10m..."
                required
              />
              <p className="mt-1 text-xs text-neutral-500">
                Nombre claro y específico que identifique el ejercicio
              </p>

              {/* Sugerencias de ejercicios similares */}
              {sugerencias.length > 0 && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 mb-2">💡 Ejercicios similares encontrados:</p>
                  <div className="space-y-1">
                    {sugerencias.map((ejercicio) => (
                      <button
                        key={ejercicio.id}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            nombre: ejercicio.nombre,
                            categoria: ejercicio.categoria,
                            descripcion: ejercicio.descripcion || "",
                            objetivo: ejercicio.objetivo || "",
                            videoUrl: ejercicio.videoUrl || "",
                          });
                          setSugerencias([]);
                          setCategoriaSugerida("");
                          setDescripcionGenerada("");
                        }}
                        className="block w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {ejercicio.nombre} ({ejercicio.categoria})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categoría sugerida */}
              {categoriaSugerida && !formData.categoria && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800 mb-1">🎯 Categoría sugerida:</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, categoria: categoriaSugerida });
                      generarDescripcion(formData.nombre, categoriaSugerida);
                      setCategoriaSugerida("");
                    }}
                    className="text-sm text-green-700 hover:text-green-900 hover:underline font-medium"
                  >
                    {categoriaSugerida} - Hacer clic para aplicar
                  </button>
                </div>
              )}

              {/* Descripción generada */}
              {descripcionGenerada && !formData.descripcion && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">📝 Descripción sugerida:</p>
                  <p className="text-sm text-blue-700 mb-2">{descripcionGenerada}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, descripcion: descripcionGenerada });
                      setDescripcionGenerada("");
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Usar esta descripción
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                🏷️ Categoría del ejercicio
              </label>
              <select
                value={formData.categoria}
                onChange={(e) => {
                  const nuevaCategoria = e.target.value;
                  setFormData({ ...formData, categoria: nuevaCategoria });
                  if (formData.nombre) {
                    generarDescripcion(formData.nombre, nuevaCategoria);
                  }
                }}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar categoría</option>
                {categoriasEjercicios.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Clasifica el ejercicio según su propósito principal
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                📖 Descripción del ejercicio
              </label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                rows={3}
                placeholder="Describe cómo se realiza el ejercicio, qué músculos involucra, y cualquier detalle técnico importante..."
                required
              />
              <p className="mt-1 text-xs text-neutral-500">
                Explicación clara de la ejecución correcta del ejercicio
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                🎯 Objetivo del ejercicio
              </label>
              <input
                type="text"
                value={formData.objetivo}
                onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Ej: Desarrollo de fuerza, mejora de velocidad, fortalecimiento..."
              />
              <p className="mt-1 text-xs text-neutral-500">
                Propósito principal del ejercicio en el entrenamiento
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                🎬 URL del Video (Opcional)
              </label>
              <input
                type="url"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Soporta YouTube y Vimeo. Para shorts, usar preferentemente {SHORTS_PROFILE_HANDLE}.
              </p>
              <a
                href={SHORTS_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-blue-600 hover:underline"
              >
                Abrir perfil de shorts {SHORTS_PROFILE_HANDLE}
              </a>
              <p className="mt-1 text-xs text-amber-600">
                Carga manualmente la URL del video para visualizarlo en esta página.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {editandoEjercicio ? "Actualizar" : "Crear"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarFormulario(false);
                  setEditandoEjercicio(null);
                  setFormData({ nombre: "", categoria: "", descripcion: "", objetivo: "", videoUrl: "" });
                  setSugerencias([]);
                  setCategoriaSugerida("");
                  setDescripcionGenerada("");
                }}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ejercicios.map((ejercicio) => (
          <div
            key={ejercicio.id}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-neutral-900">{ejercicio.nombre}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                    🏷️ {ejercicio.categoria}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(ejercicio)}
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                  title="Editar"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(ejercicio.id)}
                  className="rounded p-1 text-neutral-400 hover:bg-red-100 hover:text-red-600"
                  title="Eliminar"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            {ejercicio.descripcion && (
              <div className="mb-3">
                <p className="text-sm text-neutral-600 leading-relaxed">
                  📖 <strong>Descripción:</strong> {ejercicio.descripcion}
                </p>
              </div>
            )}
            {ejercicio.objetivo && (
              <div className="mb-3">
                <p className="text-sm text-neutral-500">
                  🎯 <strong>Objetivo:</strong> {ejercicio.objetivo}
                </p>
              </div>
            )}
            {(() => {
              const videoUrlResuelta = ejercicio.videoUrl;
              if (!videoUrlResuelta) return null;

              const embedUrl = getEmbedUrl(videoUrlResuelta);
              return embedUrl ? (
                <div className="mt-3">
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-neutral-100">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={`Video de ${ejercicio.nombre}`}
                    />
                  </div>
                  <a
                    href={videoUrlResuelta}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                  >
                    Abrir short en YouTube {">"}
                  </a>
                </div>
              ) : (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ URL de video no válida. Solo se soportan YouTube y Vimeo.
                  </p>
                  <a
                    href={videoUrlResuelta}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Ver video original →
                  </a>
                </div>
              );
            })()}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => buscarShortEnYouTube(ejercicio.nombre)}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                title={`Buscar shorts en YouTube del canal ${SHORTS_PROFILE_HANDLE}`}
              >
                🔍 Buscar Short
              </button>
              <a
                href={SHORTS_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-50"
                title={`Abrir perfil ${SHORTS_PROFILE_HANDLE}`}
              >
                Ver perfil shorts
              </a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}