"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSessions } from "../../components/SessionsProvider";
import { useCategories } from "../../components/CategoriesProvider";
import { useAlumnos } from "../../components/AlumnosProvider";
import { usePlayers } from "../../components/PlayersProvider";
import { useEjercicios } from "../../components/EjerciciosProvider";
import SesionesAIPlanner from "../../components/sesiones/SesionesAIPlanner";
import { useSharedState } from "../../components/useSharedState";
import {
  type BloqueEntrenamiento,
  type PrescripcionSesionPersona,
  type Sesion,
} from "../../data/mockData";

type SesionForm = {
  titulo: string;
  objetivo: string;
  duracion: string;
  asignacionTipo: "jugadoras" | "alumnos";
  categoriaAsignada: string;
  jugadoraAsignada: string;
  alumnoAsignado: string;
};

type EntrenamientoSection = "sesiones" | "ejercicios";

const EMPTY_FORM: SesionForm = {
  titulo: "",
  objetivo: "",
  duracion: "",
  asignacionTipo: "jugadoras",
  categoriaAsignada: "",
  jugadoraAsignada: "",
  alumnoAsignado: "",
};

function buildEquipoLabel(form: SesionForm): string {
  if (form.asignacionTipo === "alumnos") {
    return `Alumno/a: ${form.alumnoAsignado || "Sin asignar"}`;
  }
  return `Categoria: ${form.categoriaAsignada || "Sin categoria"}`;
}

function emptyBlock(): BloqueEntrenamiento {
  return {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    titulo: "Nuevo bloque",
    objetivo: "",
    ejercicios: [],
  };
}

function emptyMeasurement() {
  return {
    nombre: "",
    valor: "",
  };
}

type PersonaProgramable = {
  tipo: "jugadoras" | "alumnos";
  nombre: string;
  fechaNacimiento?: string;
  altura?: string;
  peso?: string;
  objetivo?: string;
};

type QuickExerciseForm = {
  nombre: string;
  categoria: string;
  descripcion: string;
  objetivo: string;
  videoUrl: string;
  gruposMusculares: string[];
};

type AutomationPreset = {
  id: string;
  label: string;
  intensidad: number;
  volumen: number;
  description: string;
};

const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    id: "progressive-overload",
    label: "Sobrecarga progresiva",
    intensidad: 5,
    volumen: 4,
    description: "Sube carga y algo de volumen para semanas de desarrollo.",
  },
  {
    id: "intensification",
    label: "Intensificacion",
    intensidad: 8,
    volumen: -8,
    description: "Prioriza %1RM y baja volumen para enfocarte en calidad de esfuerzo.",
  },
  {
    id: "deload",
    label: "Descarga",
    intensidad: -7,
    volumen: -18,
    description: "Reduce estres acumulado y mantiene gesto tecnico sin fatigar.",
  },
  {
    id: "maintenance",
    label: "Mantenimiento",
    intensidad: 0,
    volumen: 0,
    description: "Sostiene la estructura actual con pequenos ajustes por readiness.",
  },
];

const MUSCLE_GROUP_OPTIONS = [
  "Cuadriceps",
  "Isquiotibiales",
  "Gluteos",
  "Gemelos",
  "Aductores",
  "Core",
  "Pectorales",
  "Dorsales",
  "Trapecio",
  "Hombros",
  "Biceps",
  "Triceps",
  "Antebrazos",
  "Cadena posterior",
  "Estabilizadores",
];

const QUICK_EXERCISE_DEFAULT: QuickExerciseForm = {
  nombre: "",
  categoria: "Fuerza",
  descripcion: "",
  objetivo: "",
  videoUrl: "",
  gruposMusculares: [],
};

type JornadaEntrenamiento = {
  id: string;
  categoria: string;
  fecha: string;
  hora: string;
  suspendida?: boolean;
};

type AsistenciaRegistro = {
  jornadaId: string;
  estado: "presente" | "ausente";
};

const ASISTENCIAS_JORNADAS_KEY = "pf-control-asistencias-jornadas-v1";
const ASISTENCIAS_REGISTROS_KEY = "pf-control-asistencias-registros-v1";

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toPersonaKey = (persona: PersonaProgramable) => `${persona.tipo}:${persona.nombre}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roundToStep = (value: number, step: number) => Math.round(value / step) * step;

const parseNumericValue = (input?: string) => {
  if (!input) return null;
  const match = input.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRepetitionRange = (value: string) => {
  const matches = value.replace(",", ".").match(/\d+(?:\.\d+)?/g) || [];
  const numbers = matches.map(Number).filter(Number.isFinite);
  if (numbers.length === 0) {
    return { min: 0, max: 0, avg: 0 };
  }
  if (numbers.length === 1) {
    return { min: numbers[0], max: numbers[0], avg: numbers[0] };
  }
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return { min, max, avg: (min + max) / 2 };
};

const formatRepetitionRange = (min: number, max: number) => {
  const safeMin = Math.max(1, Math.round(min));
  const safeMax = Math.max(safeMin, Math.round(max));
  return safeMin === safeMax ? `${safeMin}` : `${safeMin}-${safeMax}`;
};

const parseLoadDescriptor = (value?: string) => {
  if (!value || !value.trim()) {
    return { kind: "unknown" as const, amount: null };
  }

  const numericValue = parseNumericValue(value);
  if (numericValue === null) {
    return { kind: "unknown" as const, amount: null };
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("%")) {
    return { kind: "percent" as const, amount: numericValue };
  }
  if (normalized.includes("kg") || normalized.includes("kilo")) {
    return { kind: "kg" as const, amount: numericValue };
  }

  return { kind: "kg" as const, amount: numericValue };
};

const parseSeconds = (value?: string) => {
  if (!value) return null;
  const numericValue = parseNumericValue(value);
  return numericValue === null ? null : numericValue;
};

const formatSeconds = (seconds: number | null, fallback?: string) => {
  if (seconds === null || !Number.isFinite(seconds)) {
    return fallback || "";
  }
  return `${Math.max(10, Math.round(seconds))}s`;
};

const getAgeFromBirthDate = (value?: string) => {
  if (!value) return null;
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
};

const getExerciseStrengthFactor = (exerciseName: string) => {
  const normalized = exerciseName.toLowerCase();
  if (normalized.includes("sentadilla") || normalized.includes("squat")) return 1.15;
  if (normalized.includes("peso muerto") || normalized.includes("deadlift")) return 1.3;
  if (normalized.includes("hip thrust")) return 1.1;
  if (normalized.includes("press") || normalized.includes("bench")) return 0.75;
  if (normalized.includes("remo") || normalized.includes("row")) return 0.8;
  if (normalized.includes("zancada") || normalized.includes("lunge")) return 0.65;
  if (normalized.includes("curl") || normalized.includes("core")) return 0.45;
  return 0.6;
};

const getReadinessScore = (persona: PersonaProgramable) => {
  const age = getAgeFromBirthDate(persona.fechaNacimiento);
  const weight = parseNumericValue(persona.peso);
  const height = parseNumericValue(persona.altura);

  const ageFactor = age === null ? 1 : age < 16 ? 0.92 : age < 18 ? 0.96 : age <= 35 ? 1 : age <= 45 ? 0.97 : 0.93;
  const weightFactor = weight === null ? 1 : clamp(0.94 + (weight - 55) * 0.002, 0.88, 1.08);
  const heightFactor = height === null ? 1 : clamp(0.97 + (height - 165) * 0.001, 0.93, 1.05);
  const objectiveText = (persona.objetivo || "").toLowerCase();
  const objectiveFactor = objectiveText.includes("fuerza") ? 1.03 : objectiveText.includes("recuper") ? 0.97 : 1;

  return clamp(ageFactor * weightFactor * heightFactor * objectiveFactor, 0.84, 1.12);
};

const findMetricNumber = (
  metricas: { nombre: string; valor: string }[] | undefined,
  names: string[]
) => {
  if (!metricas) return null;
  const found = metricas.find((metrica) =>
    names.some((name) => metrica.nombre.toLowerCase().includes(name))
  );
  return found ? parseNumericValue(found.valor) : null;
};

type SesionesPageProps = {
  embedded?: boolean;
};

export default function SesionesPage({ embedded = false }: SesionesPageProps = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { sesiones, agregarSesion, editarSesion, eliminarSesion } = useSessions();
  const { categorias } = useCategories();
  const { alumnos } = useAlumnos();
  const { jugadoras } = usePlayers();
  const { ejercicios, agregarEjercicio, editarEjercicio, eliminarEjercicio } = useEjercicios();
  const [jornadas] = useSharedState<JornadaEntrenamiento[]>([], {
    key: ASISTENCIAS_JORNADAS_KEY,
    legacyLocalStorageKey: ASISTENCIAS_JORNADAS_KEY,
  });
  const [asistencias] = useSharedState<AsistenciaRegistro[]>([], {
    key: ASISTENCIAS_REGISTROS_KEY,
    legacyLocalStorageKey: ASISTENCIAS_REGISTROS_KEY,
  });

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [entrenamientoSection, setEntrenamientoSection] = useState<EntrenamientoSection>("sesiones");
  const [editandoSesion, setEditandoSesion] = useState<string | null>(null);
  const [editandoBloquesId, setEditandoBloquesId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SesionForm>(EMPTY_FORM);
  const [bloquesDraft, setBloquesDraft] = useState<BloqueEntrenamiento[]>([]);
  const [busquedasEjercicio, setBusquedasEjercicio] = useState<Record<string, string>>({});
  const [automatizandoSesionId, setAutomatizandoSesionId] = useState<string | null>(null);
  const [personasSeleccionadas, setPersonasSeleccionadas] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("progressive-overload");
  const [intensidadDelta, setIntensidadDelta] = useState(5);
  const [volumenDelta, setVolumenDelta] = useState(0);
  const [quickExerciseOpen, setQuickExerciseOpen] = useState(false);
  const [quickExerciseEditId, setQuickExerciseEditId] = useState<string | null>(null);
  const [exerciseDetailId, setExerciseDetailId] = useState<string | null>(null);
  const [exerciseDetailTouchStartY, setExerciseDetailTouchStartY] = useState<number | null>(null);
  const [quickExerciseBlockIndex, setQuickExerciseBlockIndex] = useState<number | null>(null);
  const [quickExerciseForm, setQuickExerciseForm] =
    useState<QuickExerciseForm>(QUICK_EXERCISE_DEFAULT);

  const categoriasEjercicios = useMemo(() => {
    const fromExisting = ejercicios.map((item) => item.categoria).filter(Boolean);
    return Array.from(new Set(["Fuerza", "Velocidad", "Resistencia", "Tecnica", "Prevencion", "Core", "Potencia", ...fromExisting])).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [ejercicios]);

  const ejerciciosOrdenados = useMemo(
    () => [...ejercicios].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [ejercicios]
  );

  const totalCategoriasBiblioteca = useMemo(
    () => new Set(ejercicios.map((item) => item.categoria).filter(Boolean)).size,
    [ejercicios]
  );

  const returnToHref = useMemo(() => {
    const search = searchParams.toString();
    return `${pathname}${search ? `?${search}` : ""}`;
  }, [pathname, searchParams]);

  const nuevaSesionHref = useMemo(
    () => `/nueva-sesion?returnTo=${encodeURIComponent(returnToHref)}`,
    [returnToHref]
  );

  useEffect(() => {
    const sectionRaw = String(searchParams.get("seccion") || searchParams.get("panel") || "")
      .trim()
      .toLowerCase();
    setEntrenamientoSection(sectionRaw === "ejercicios" ? "ejercicios" : "sesiones");
  }, [searchParams]);

  const jugadorasFiltradas = useMemo(
    () =>
      jugadoras.filter(
        (jugadora) =>
          jugadora.categoria === formData.categoriaAsignada &&
          (jugadora.deporte || "").trim().length > 0
      ),
    [formData.categoriaAsignada, jugadoras]
  );

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditandoSesion(null);
    setMostrarFormulario(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      equipo: buildEquipoLabel(formData),
      categoriaAsignada:
        formData.asignacionTipo === "jugadoras" ? formData.categoriaAsignada : undefined,
      jugadoraAsignada:
        formData.asignacionTipo === "jugadoras"
          ? formData.jugadoraAsignada || undefined
          : undefined,
      alumnoAsignado:
        formData.asignacionTipo === "alumnos" ? formData.alumnoAsignado : undefined,
    };

    if (editandoSesion) {
      editarSesion(editandoSesion, payload);
    } else {
      agregarSesion({ ...payload, bloques: [] });
    }

    resetForm();
  };

  const handleEdit = (sesion: Sesion) => {
    setFormData({
      titulo: sesion.titulo,
      objetivo: sesion.objetivo,
      duracion: sesion.duracion,
      asignacionTipo: sesion.asignacionTipo || "jugadoras",
      categoriaAsignada: sesion.categoriaAsignada || "",
      jugadoraAsignada: sesion.jugadoraAsignada || "",
      alumnoAsignado: sesion.alumnoAsignado || "",
    });
    setEditandoSesion(sesion.id);
    setMostrarFormulario(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta sesión?")) {
      eliminarSesion(id);
      if (editandoBloquesId === id) {
        setEditandoBloquesId(null);
        setBloquesDraft([]);
      }
    }
  };

  const startBlockEdit = (sesion: Sesion) => {
    setEditandoBloquesId(sesion.id);
    setBloquesDraft(
      (sesion.bloques || []).map((bloque) => ({
        ...bloque,
        ejercicios: Array.isArray(bloque.ejercicios) ? bloque.ejercicios : [],
      }))
    );
  };

  const updateBlockField = (
    index: number,
    key: "titulo" | "objetivo",
    value: string
  ) => {
    setBloquesDraft((prev) =>
      prev.map((bloque, i) => (i === index ? { ...bloque, [key]: value } : bloque))
    );
  };

  const addBlock = () => {
    setBloquesDraft((prev) => [...prev, emptyBlock()]);
  };

  const removeBlock = (index: number) => {
    setBloquesDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const saveBlocks = () => {
    if (!editandoBloquesId) return;
    editarSesion(editandoBloquesId, { bloques: bloquesDraft });
    setEditandoBloquesId(null);
    setBloquesDraft([]);
    setBusquedasEjercicio({});
  };

  const updateBusqueda = (blockId: string, value: string) => {
    setBusquedasEjercicio((prev) => ({ ...prev, [blockId]: value }));
  };

  const addExerciseToBlock = (blockIndex: number, ejercicioId: string) => {
    setBloquesDraft((prev) =>
      prev.map((bloque, i) => {
        if (i !== blockIndex) return bloque;
        return {
          ...bloque,
          ejercicios: [
            ...(Array.isArray(bloque.ejercicios) ? bloque.ejercicios : []),
            {
              ejercicioId,
              series: 3,
              repeticiones: "10",
              carga: "",
              descanso: "60s",
              observaciones: "",
              metricas: [],
            },
          ],
        };
      })
    );
  };

  const updateExerciseField = (
    blockIndex: number,
    exerciseIndex: number,
    key: "series" | "repeticiones" | "carga" | "descanso" | "observaciones",
    value: string
  ) => {
    setBloquesDraft((prev) =>
      prev.map((bloque, i) => {
        if (i !== blockIndex) return bloque;
        return {
          ...bloque,
          ejercicios: (bloque.ejercicios || []).map((ejercicio, j) => {
            if (j !== exerciseIndex) return ejercicio;
            if (key === "series") {
              const parsed = Number(value);
              return { ...ejercicio, series: Number.isFinite(parsed) ? parsed : 0 };
            }
            return { ...ejercicio, [key]: value };
          }),
        };
      })
    );
  };

  const removeExerciseFromBlock = (blockIndex: number, exerciseIndex: number) => {
    setBloquesDraft((prev) =>
      prev.map((bloque, i) => {
        if (i !== blockIndex) return bloque;
        return {
          ...bloque,
          ejercicios: (bloque.ejercicios || []).filter((_, j) => j !== exerciseIndex),
        };
      })
    );
  };

  const addMeasurementToExercise = (blockIndex: number, exerciseIndex: number) => {
    setBloquesDraft((prev) =>
      prev.map((bloque, i) => {
        if (i !== blockIndex) return bloque;
        return {
          ...bloque,
          ejercicios: (bloque.ejercicios || []).map((ejercicio, j) => {
            if (j !== exerciseIndex) return ejercicio;
            return {
              ...ejercicio,
              metricas: [...(ejercicio.metricas || []), emptyMeasurement()],
            };
          }),
        };
      })
    );
  };

  const updateMeasurementField = (
    blockIndex: number,
    exerciseIndex: number,
    measurementIndex: number,
    key: "nombre" | "valor",
    value: string
  ) => {
    setBloquesDraft((prev) =>
      prev.map((bloque, i) => {
        if (i !== blockIndex) return bloque;
        return {
          ...bloque,
          ejercicios: (bloque.ejercicios || []).map((ejercicio, j) => {
            if (j !== exerciseIndex) return ejercicio;
            return {
              ...ejercicio,
              metricas: (ejercicio.metricas || []).map((medicion, k) =>
                k === measurementIndex ? { ...medicion, [key]: value } : medicion
              ),
            };
          }),
        };
      })
    );
  };

  const removeMeasurementFromExercise = (
    blockIndex: number,
    exerciseIndex: number,
    measurementIndex: number
  ) => {
    setBloquesDraft((prev) =>
      prev.map((bloque, i) => {
        if (i !== blockIndex) return bloque;
        return {
          ...bloque,
          ejercicios: (bloque.ejercicios || []).map((ejercicio, j) => {
            if (j !== exerciseIndex) return ejercicio;
            return {
              ...ejercicio,
              metricas: (ejercicio.metricas || []).filter((_, k) => k !== measurementIndex),
            };
          }),
        };
      })
    );
  };

  const getExerciseName = (id: string) => {
    const ex = ejercicios.find((item) => item.id === id);
    return ex ? ex.nombre : "Ejercicio";
  };

  const getYouTubeEmbedUrl = (url: string): string | null => {
    const ytMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
    );
    if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&playsinline=1`;
    return null;
  };

  const isDirectVideoFile = (url: string): boolean => {
    return /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i.test(url);
  };

  const resetQuickExercise = () => {
    setQuickExerciseOpen(false);
    setQuickExerciseEditId(null);
    setQuickExerciseBlockIndex(null);
    setQuickExerciseForm(QUICK_EXERCISE_DEFAULT);
  };

  const openQuickExerciseEditor = (
    blockIndex: number | null = null,
    prefillName = "",
    existingExerciseId?: string
  ) => {
    if (existingExerciseId) {
      const existing = ejercicios.find((item) => item.id === existingExerciseId);
      if (existing) {
        setQuickExerciseForm({
          nombre: existing.nombre,
          categoria: existing.categoria,
          descripcion: existing.descripcion || "",
          objetivo: existing.objetivo || "",
          videoUrl: existing.videoUrl || "",
          gruposMusculares: existing.gruposMusculares || [],
        });
        setQuickExerciseEditId(existing.id);
      }
    } else {
      setQuickExerciseForm({
        ...QUICK_EXERCISE_DEFAULT,
        nombre: prefillName,
      });
      setQuickExerciseEditId(null);
    }

    setQuickExerciseBlockIndex(blockIndex);
    setQuickExerciseOpen(true);
  };

  const toggleQuickExerciseMuscleGroup = (group: string) => {
    setQuickExerciseForm((prev) => ({
      ...prev,
      gruposMusculares: prev.gruposMusculares.includes(group)
        ? prev.gruposMusculares.filter((item) => item !== group)
        : [...prev.gruposMusculares, group],
    }));
  };

  const submitQuickExercise = (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = quickExerciseForm.nombre.trim();
    const categoria = quickExerciseForm.categoria.trim();

    if (!nombre || !categoria) {
      return;
    }

    const payload = {
      nombre,
      categoria,
      descripcion: quickExerciseForm.descripcion.trim() || undefined,
      objetivo: quickExerciseForm.objetivo.trim() || undefined,
      videoUrl: quickExerciseForm.videoUrl.trim() || undefined,
      gruposMusculares: quickExerciseForm.gruposMusculares,
    };

    if (quickExerciseEditId) {
      editarEjercicio(quickExerciseEditId, payload);
      if (quickExerciseBlockIndex !== null) {
        const blockId = bloquesDraft[quickExerciseBlockIndex]?.id;
        if (blockId) {
          setBusquedasEjercicio((prev) => ({
            ...prev,
            [blockId]: nombre,
          }));
        }
      }
      resetQuickExercise();
      return;
    }

    const nuevoId = agregarEjercicio(payload);
    if (quickExerciseBlockIndex !== null) {
      addExerciseToBlock(quickExerciseBlockIndex, nuevoId);
    }
    resetQuickExercise();
  };

  const getSessionTargets = (sesion: Sesion): PersonaProgramable[] => {
    if (sesion.asignacionTipo === "alumnos") {
      if (sesion.alumnoAsignado) {
        return alumnos
          .filter((alumno) => alumno.nombre === sesion.alumnoAsignado)
          .map((alumno) => ({
            tipo: "alumnos" as const,
            nombre: alumno.nombre,
            fechaNacimiento: alumno.fechaNacimiento,
            altura: alumno.altura,
            peso: alumno.peso,
            objetivo: alumno.objetivo,
          }));
      }

      return alumnos.map((alumno) => ({
        tipo: "alumnos" as const,
        nombre: alumno.nombre,
        fechaNacimiento: alumno.fechaNacimiento,
        altura: alumno.altura,
        peso: alumno.peso,
        objetivo: alumno.objetivo,
      }));
    }

    return jugadoras
      .filter((jugadora) => {
        if (sesion.jugadoraAsignada) {
          return jugadora.nombre === sesion.jugadoraAsignada;
        }
        if (sesion.categoriaAsignada) {
          return jugadora.categoria === sesion.categoriaAsignada;
        }
        return true;
      })
      .map((jugadora) => ({
        tipo: "jugadoras" as const,
        nombre: jugadora.nombre,
        fechaNacimiento: jugadora.fechaNacimiento,
        altura: jugadora.altura,
        peso: jugadora.peso,
        objetivo: jugadora.objetivo,
      }));
  };

  const sesionAutomatizada = useMemo(
    () => sesiones.find((sesion) => sesion.id === automatizandoSesionId) || null,
    [automatizandoSesionId, sesiones]
  );

  const personasAutomatizables = useMemo(
    () => (sesionAutomatizada ? getSessionTargets(sesionAutomatizada) : []),
    [sesionAutomatizada, alumnos, jugadoras]
  );

  const togglePersonaSeleccionada = (personaKey: string) => {
    setPersonasSeleccionadas((prev) =>
      prev.includes(personaKey)
        ? prev.filter((item) => item !== personaKey)
        : [...prev, personaKey]
    );
  };

  const openAutomation = (sesion: Sesion) => {
    if (automatizandoSesionId === sesion.id) {
      setAutomatizandoSesionId(null);
      setPersonasSeleccionadas([]);
      return;
    }

    const targets = getSessionTargets(sesion);
    setAutomatizandoSesionId(sesion.id);
    setPersonasSeleccionadas(targets.map(toPersonaKey));
    setIntensidadDelta(5);
    setVolumenDelta(4);
    setSelectedPresetId("progressive-overload");
  };

  const selectedAutomationTargets = useMemo(
    () =>
      personasAutomatizables.filter((persona) =>
        personasSeleccionadas.includes(toPersonaKey(persona))
      ),
    [personasAutomatizables, personasSeleccionadas]
  );

  const applyPreset = (presetId: string) => {
    const preset = AUTOMATION_PRESETS.find((item) => item.id === presetId);
    setSelectedPresetId(presetId);
    if (!preset) {
      return;
    }
    setIntensidadDelta(preset.intensidad);
    setVolumenDelta(preset.volumen);
  };

  const buildPrescripcionBloques = (
    sesion: Sesion,
    persona: PersonaProgramable,
    intensidad: number,
    volumen: number
  ) => {
    const readiness = getReadinessScore(persona);
    const intensityMultiplier = Math.max(0.7, 1 + (intensidad / 100) * readiness);
    const volumeMultiplier = Math.max(0.6, 1 + (volumen / 100) * (0.85 + readiness * 0.15));

    return (sesion.bloques || []).map((bloque) => ({
      ...bloque,
      id: createId(),
      ejercicios: (bloque.ejercicios || []).map((ejercicio) => {
        const exerciseName = getExerciseName(ejercicio.ejercicioId);
        const reps = parseRepetitionRange(ejercicio.repeticiones);
        const adjustedSeries = clamp(Math.round(ejercicio.series * volumeMultiplier), 1, 12);
        const adjustedRepsMin = clamp(reps.min * volumeMultiplier, 1, 30);
        const adjustedRepsMax = clamp(reps.max * volumeMultiplier, adjustedRepsMin, 30);
        const load = parseLoadDescriptor(ejercicio.carga);
        const explicit1RM = findMetricNumber(ejercicio.metricas, ["1rm", "%rm", "rm base"]);
        const bodyWeight = parseNumericValue(persona.peso);

        let estimated1RM = explicit1RM;
        if (estimated1RM === null && load.kind === "kg" && load.amount !== null && reps.avg > 0) {
          estimated1RM = load.amount * (1 + reps.avg / 30);
        }

        if (estimated1RM === null && load.kind === "percent" && load.amount !== null && bodyWeight) {
          const heuristic = bodyWeight * getExerciseStrengthFactor(exerciseName);
          estimated1RM = heuristic / Math.max(load.amount / 100, 0.35);
        }

        let cargaCalculada = ejercicio.carga || "";
        let porcentajeEstimado: number | null = null;

        if (load.kind === "kg" && load.amount !== null) {
          const nextKg = roundToStep(load.amount * intensityMultiplier, 0.5);
          cargaCalculada = `${nextKg.toFixed(nextKg % 1 === 0 ? 0 : 1)} kg`;
          if (estimated1RM) {
            porcentajeEstimado = (nextKg / estimated1RM) * 100;
          }
        } else if (load.kind === "percent" && load.amount !== null) {
          const nextPercent = clamp(load.amount + intensidad * readiness, 30, 100);
          porcentajeEstimado = nextPercent;
          cargaCalculada = `${Math.round(nextPercent)}% 1RM`;
        } else if (estimated1RM) {
          const nextPercent = clamp(65 + intensidad * readiness, 35, 95);
          const nextKg = roundToStep(estimated1RM * (nextPercent / 100), 0.5);
          porcentajeEstimado = nextPercent;
          cargaCalculada = `${nextKg.toFixed(nextKg % 1 === 0 ? 0 : 1)} kg`;
        }

        const descansoBase = parseSeconds(ejercicio.descanso);
        const descansoCalculado =
          descansoBase === null
            ? ejercicio.descanso || ""
            : formatSeconds(
                descansoBase * (1 + Math.max(intensidad, 0) / 100 * 0.2 - Math.max(volumen, 0) / 100 * 0.08),
                ejercicio.descanso
              );

        const tonnage = parseNumericValue(cargaCalculada) || 0;
        const volumenTotal = tonnage > 0 ? tonnage * adjustedSeries * ((adjustedRepsMin + adjustedRepsMax) / 2) : 0;

        const metricas = [
          ...(ejercicio.metricas || []).filter(
            (metrica) => !["%1rm", "carga sugerida", "tonelaje", "perfil"].includes(metrica.nombre.toLowerCase())
          ),
          {
            nombre: "%1RM",
            valor: porcentajeEstimado ? `${Math.round(porcentajeEstimado)}%` : "Estimado",
          },
          {
            nombre: "Carga sugerida",
            valor: cargaCalculada || "Sin base",
          },
          {
            nombre: "Tonelaje",
            valor: volumenTotal > 0 ? `${Math.round(volumenTotal)} kg` : "-",
          },
          {
            nombre: "Perfil",
            valor: `Readiness ${Math.round(readiness * 100)}%`,
          },
        ];

        return {
          ...ejercicio,
          series: adjustedSeries,
          repeticiones: formatRepetitionRange(adjustedRepsMin, adjustedRepsMax),
          carga: cargaCalculada,
          descanso: descansoCalculado,
          metricas,
        };
      }),
    }));
  };

  const applyAutomation = (sesion: Sesion) => {
    const targets = getSessionTargets(sesion).filter((persona) =>
      personasSeleccionadas.includes(toPersonaKey(persona))
    );

    if (targets.length === 0) {
      return;
    }

    const generated: PrescripcionSesionPersona[] = targets.map((persona) => {
      const readiness = getReadinessScore(persona);
      return {
        id: createId(),
        personaNombre: persona.nombre,
        personaTipo: persona.tipo,
        createdAt: new Date().toISOString(),
        intensidadDelta,
        volumenDelta,
        readinessScore: Math.round(readiness * 100),
        resumen: `${AUTOMATION_PRESETS.find((item) => item.id === selectedPresetId)?.label || "Ajuste personalizado"} | Intensidad ${intensidadDelta >= 0 ? "+" : ""}${intensidadDelta}% | Volumen ${volumenDelta >= 0 ? "+" : ""}${volumenDelta}%`,
        bloques: buildPrescripcionBloques(sesion, persona, intensidadDelta, volumenDelta),
      };
    });

    editarSesion(sesion.id, {
      prescripciones: [
        ...(sesion.prescripciones || []),
        ...generated,
      ].slice(-180),
    });
  };

  const removePrescription = (sesion: Sesion, prescriptionId: string) => {
    editarSesion(sesion.id, {
      prescripciones: (sesion.prescripciones || []).filter((item) => item.id !== prescriptionId),
    });
  };

  const automationPreview = useMemo(() => {
    if (!sesionAutomatizada || selectedAutomationTargets.length === 0) {
      return null;
    }

    const generated = selectedAutomationTargets.map((persona) => ({
      persona,
      blocks: buildPrescripcionBloques(
        sesionAutomatizada,
        persona,
        intensidadDelta,
        volumenDelta
      ),
      readiness: Math.round(getReadinessScore(persona) * 100),
    }));

    let totalExercises = 0;
    let totalTonnage = 0;
    let percentAccumulator = 0;
    let percentCount = 0;
    const sampleAdjustments: { persona: string; ejercicio: string; carga: string; reps: string }[] = [];

    for (const item of generated) {
      for (const block of item.blocks) {
        for (const exercise of block.ejercicios || []) {
          totalExercises += 1;
          const tonnageMetric = (exercise.metricas || []).find(
            (metric) => metric.nombre === "Tonelaje"
          );
          const percentMetric = (exercise.metricas || []).find(
            (metric) => metric.nombre === "%1RM"
          );
          totalTonnage += parseNumericValue(tonnageMetric?.valor) || 0;
          const percentValue = parseNumericValue(percentMetric?.valor);
          if (percentValue !== null) {
            percentAccumulator += percentValue;
            percentCount += 1;
          }

          if (sampleAdjustments.length < 4) {
            sampleAdjustments.push({
              persona: item.persona.nombre,
              ejercicio: getExerciseName(exercise.ejercicioId),
              carga: exercise.carga || "Sin base",
              reps: `${exercise.series}x${exercise.repeticiones}`,
            });
          }
        }
      }
    }

    return {
      selectedCount: generated.length,
      avgReadiness: Math.round(
        generated.reduce((acc, item) => acc + item.readiness, 0) / generated.length
      ),
      totalExercises,
      totalTonnage: Math.round(totalTonnage),
      avgPercent1RM: percentCount > 0 ? Math.round(percentAccumulator / percentCount) : null,
      sampleAdjustments,
    };
  }, [
    getExerciseName,
    intensidadDelta,
    selectedAutomationTargets,
    sesionAutomatizada,
    volumenDelta,
  ]);

  useEffect(() => {
    const preset = AUTOMATION_PRESETS.find((item) => item.id === selectedPresetId);
    if (!preset) {
      setSelectedPresetId("custom");
      return;
    }

    if (preset.intensidad !== intensidadDelta || preset.volumen !== volumenDelta) {
      setSelectedPresetId("custom");
    }
  }, [intensidadDelta, selectedPresetId, volumenDelta]);

  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (exerciseDetailId) {
        setExerciseDetailId(null);
        setExerciseDetailTouchStartY(null);
        return;
      }

      if (quickExerciseOpen) {
        setQuickExerciseOpen(false);
        setQuickExerciseEditId(null);
        setQuickExerciseBlockIndex(null);
        setQuickExerciseForm(QUICK_EXERCISE_DEFAULT);
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [exerciseDetailId, quickExerciseOpen]);

  const sesionesOperativas = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const jornadasActivas = jornadas.filter((jornada) => !jornada.suspendida);
    const jornadasProximas = jornadasActivas.filter((jornada) => jornada.fecha >= hoy).length;
    const presentes = asistencias.filter((item) => item.estado === "presente").length;
    const ausentes = asistencias.filter((item) => item.estado === "ausente").length;

    return {
      totalSesiones: sesiones.length,
      totalJornadas: jornadasActivas.length,
      jornadasProximas,
      totalPresentes: presentes,
      totalAusentes: ausentes,
      totalJugadoras: jugadoras.length,
      totalAlumnos: alumnos.length,
    };
  }, [alumnos.length, asistencias, jornadas, jugadoras.length, sesiones.length]);

  const setEntrenamientoSectionView = (nextSection: EntrenamientoSection) => {
    setEntrenamientoSection(nextSection);

    if (typeof window === "undefined") return;
    const nextUrl = new URL(window.location.href);

    if (nextSection === "ejercicios") {
      nextUrl.searchParams.set("seccion", "ejercicios");
    } else {
      nextUrl.searchParams.delete("seccion");
      nextUrl.searchParams.delete("panel");
    }

    const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next !== current) {
      window.history.pushState({}, "", next);
    }
  };

  const totalRegistrosAsistencia =
    sesionesOperativas.totalPresentes + sesionesOperativas.totalAusentes;
  const tasaAsistencia =
    totalRegistrosAsistencia > 0
      ? Math.round((sesionesOperativas.totalPresentes / totalRegistrosAsistencia) * 100)
      : null;
  const ContainerTag: "main" | "div" = embedded ? "div" : "main";
  const containerClassName = embedded
    ? "w-full space-y-6 px-1 py-2 pf-v2-t lg:px-2"
    : "mx-auto max-w-7xl space-y-6 p-6 pf-v2-t";

  return (
    <ContainerTag className={containerClassName}>
      <section className="pf-v2-hero-block">

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pf-v2-eyebrow">Centro de operaciones</span>
            <h1 className="pf-v2-h1" style={{ fontSize: 32 }}>Entrenamiento</h1>
            <p className="pf-v2-muted" style={{ marginTop: 8 }}>
              Unifica sesiones y ejercicios en un mismo modulo para planificar, ajustar y ejecutar sin salir de contexto.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {entrenamientoSection === "ejercicios" ? (
              <ReliableActionButton
                type="button"
                onClick={() => openQuickExerciseEditor(null, "")}
                className="pf-v2-btn"
              >
                + Nuevo ejercicio
              </ReliableActionButton>
            ) : (
              <Link
                href={nuevaSesionHref}
                className="pf-v2-btn"
              >
                + Nueva sesion
              </Link>
            )}

            {entrenamientoSection === "ejercicios" ? (
              <ReliableActionButton
                type="button"
                onClick={() => setEntrenamientoSectionView("sesiones")}
                className="rounded-xl border pf-v2-b-hi pf-v2-s-hi px-4 py-2 text-sm font-semibold pf-v2-t transition pf-v2-hover"
              >
                Ver sesiones
              </ReliableActionButton>
            ) : (
              <Link
                href="/semana"
                className="rounded-xl border pf-v2-b-hi pf-v2-s-hi px-4 py-2 text-sm font-semibold pf-v2-t transition pf-v2-hover"
              >
                Ver templates
              </Link>
            )}
          </div>
        </div>

        <div className="relative mt-4 inline-flex rounded-xl border pf-v2-b-hi pf-v2-s-deep p-1">
          <ReliableActionButton
            type="button"
            onClick={() => setEntrenamientoSectionView("sesiones")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              entrenamientoSection === "sesiones"
                ? "pf-v2-s-accent pf-v2-t"
                : "pf-v2-t pf-v2-hover"
            }`}
          >
            Sesiones
          </ReliableActionButton>
          <ReliableActionButton
            type="button"
            onClick={() => setEntrenamientoSectionView("ejercicios")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              entrenamientoSection === "ejercicios"
                ? "pf-v2-s-ok pf-v2-t"
                : "pf-v2-t pf-v2-hover"
            }`}
          >
            Ejercicios
          </ReliableActionButton>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border pf-v2-b-accent pf-v2-s-accent p-4">
            <p className="text-[11px] uppercase tracking-wide pf-v2-t-accent">
              {entrenamientoSection === "ejercicios" ? "Ejercicios cargados" : "Sesiones activas"}
            </p>
            <p className="text-3xl font-black pf-v2-t">
              {entrenamientoSection === "ejercicios" ? ejerciciosOrdenados.length : sesionesOperativas.totalSesiones}
            </p>
          </div>
          <div className="rounded-2xl border pf-v2-b-ok pf-v2-s-ok p-4">
            <p className="text-[11px] uppercase tracking-wide pf-v2-t-ok">
              {entrenamientoSection === "ejercicios" ? "Categorias" : "Jornadas proximas"}
            </p>
            <p className="text-3xl font-black pf-v2-t">
              {entrenamientoSection === "ejercicios" ? totalCategoriasBiblioteca : sesionesOperativas.jornadasProximas}
            </p>
          </div>
          <div className="rounded-2xl border pf-v2-b-ok pf-v2-s-ok p-4">
            <p className="text-[11px] uppercase tracking-wide pf-v2-t-ok">
              {entrenamientoSection === "ejercicios" ? "Con video" : "Asistencia"}
            </p>
            <p className="text-3xl font-black pf-v2-t">
              {entrenamientoSection === "ejercicios"
                ? ejerciciosOrdenados.filter((item) => String(item.videoUrl || "").trim().length > 0).length
                : tasaAsistencia === null
                ? "-"
                : `${tasaAsistencia}%`}
            </p>
          </div>
          <div className="rounded-2xl border pf-v2-b-hi pf-v2-s-deep p-4">
            <p className="text-[11px] uppercase tracking-wide pf-v2-t-70">
              {entrenamientoSection === "ejercicios" ? "Sin video" : "Plantel / Alumnos"}
            </p>
            <p className="text-3xl font-black pf-v2-t">
              {entrenamientoSection === "ejercicios"
                ? ejerciciosOrdenados.filter((item) => String(item.videoUrl || "").trim().length === 0).length
                : `${sesionesOperativas.totalJugadoras}/${sesionesOperativas.totalAlumnos}`}
            </p>
          </div>
        </div>
      </section>

      {entrenamientoSection === "sesiones" ? (
      <>
      <section className="grid gap-3 md:grid-cols-3">
        <Link
          href="/asistencias"
          className="rounded-2xl border pf-v2-b-accent pf-v2-s-accent px-4 py-3 text-left text-sm font-semibold pf-v2-t-accent transition hover:-translate-y-0.5 pf-v2-hover"
        >
          Abrir asistencias
        </Link>
        <Link
          href="/clientes?seccion=plantel"
          className="rounded-2xl border pf-v2-b-ok pf-v2-s-ok px-4 py-3 text-left text-sm font-semibold pf-v2-t-ok transition hover:-translate-y-0.5 pf-v2-hover"
        >
          Abrir plantel
        </Link>
        <Link
          href="/registros"
          className="rounded-2xl border pf-v2-b-violet pf-v2-s-violet px-4 py-3 text-left text-sm font-semibold pf-v2-t-violet transition hover:-translate-y-0.5 pf-v2-hover"
        >
          Ver registros
        </Link>
      </section>

      <SesionesAIPlanner />

      {mostrarFormulario && editandoSesion && (
        <div className="mb-6 rounded-2xl border pf-v2-b-hi pf-v2-s-deep p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">
            {editandoSesion ? "Editar Sesión" : "Nueva Sesión"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium pf-v2-t">Título</label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="mt-1 block w-full rounded-md border pf-v2-b-hi pf-v2-s-deep px-3 py-2 pf-v2-t"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium pf-v2-t">Asignar a</label>
                <select
                  value={formData.asignacionTipo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      asignacionTipo: e.target.value as "jugadoras" | "alumnos",
                      jugadoraAsignada: "",
                      alumnoAsignado: "",
                    })
                  }
                  className="mt-1 block w-full rounded-md border pf-v2-b-hi pf-v2-s-deep px-3 py-2 pf-v2-t"
                >
                  <option value="jugadoras">Jugadoras</option>
                  <option value="alumnos">Alumno/a</option>
                </select>
              </div>

              {formData.asignacionTipo === "jugadoras" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium pf-v2-t">Categoría</label>
                    <select
                      value={formData.categoriaAsignada}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          categoriaAsignada: e.target.value,
                          jugadoraAsignada: "",
                        })
                      }
                      className="mt-1 block w-full rounded-md border pf-v2-b-hi pf-v2-s-deep px-3 py-2 pf-v2-t"
                      required
                    >
                      <option value="">Seleccionar categoría</option>
                      {categorias
                        .filter((cat) => cat.habilitada)
                        .map((cat) => (
                          <option key={cat.nombre} value={cat.nombre}>
                            {cat.nombre}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium pf-v2-t">
                      Jugadora (opcional)
                    </label>
                    <select
                      value={formData.jugadoraAsignada}
                      onChange={(e) =>
                        setFormData({ ...formData, jugadoraAsignada: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border pf-v2-b-hi pf-v2-s-deep px-3 py-2 pf-v2-t"
                    >
                      <option value="">Todas las jugadoras de la categoría</option>
                      {jugadorasFiltradas.map((jugadora) => (
                        <option key={jugadora.nombre} value={jugadora.nombre}>
                          {jugadora.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium pf-v2-t">Alumno/a</label>
                  <select
                    value={formData.alumnoAsignado}
                    onChange={(e) => setFormData({ ...formData, alumnoAsignado: e.target.value })}
                    className="mt-1 block w-full rounded-md border pf-v2-b-hi pf-v2-s-deep px-3 py-2 pf-v2-t"
                    required
                  >
                    <option value="">Seleccionar alumno/a</option>
                    {alumnos.map((alumno) => (
                      <option key={alumno.nombre} value={alumno.nombre}>
                        {alumno.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium pf-v2-t">Objetivo</label>
              <textarea
                value={formData.objetivo}
                onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                className="mt-1 block w-full rounded-md border pf-v2-b-hi pf-v2-s-deep px-3 py-2 pf-v2-t"
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium pf-v2-t">Duración (minutos)</label>
                <input
                  type="number"
                  value={formData.duracion}
                  onChange={(e) => setFormData({ ...formData, duracion: e.target.value })}
                  className="mt-1 block w-full rounded-md border pf-v2-b-hi pf-v2-s-deep px-3 py-2 pf-v2-t"
                  placeholder="60"
                  required
                />
              </div>
              <div className="rounded-xl border pf-v2-b-hi pf-v2-s-deep p-3 text-sm pf-v2-t">
                Los bloques se editan al guardar la sesión con el botón &quot;Cargar bloques&quot;.
              </div>
            </div>

            <div className="flex gap-2">
              <ReliableActionButton
                type="submit"
                className="rounded-xl pf-v2-s-blue px-4 py-2 text-sm font-medium pf-v2-t pf-v2-hover"
              >
                {editandoSesion ? "Actualizar" : "Crear"}
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={resetForm}
                className="rounded-xl border pf-v2-b-hi px-4 py-2 text-sm font-medium pf-v2-t pf-v2-hover"
              >
                Cancelar
              </ReliableActionButton>
            </div>
          </form>
        </div>
      )}

      {editandoBloquesId && (
        <div className="mb-6 rounded-2xl border pf-v2-b-hi pf-v2-s-deep p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="pf-v2-h2">Editor de bloques</h2>
            <div className="flex gap-2">
              <ReliableActionButton
                onClick={addBlock}
                className="rounded-lg pf-v2-s-blue px-3 py-1.5 text-sm font-semibold pf-v2-t"
              >
                + Bloque
              </ReliableActionButton>
              <ReliableActionButton
                onClick={saveBlocks}
                className="rounded-lg pf-v2-s-ok px-3 py-1.5 text-sm font-semibold pf-v2-t"
              >
                Guardar bloques
              </ReliableActionButton>
              <ReliableActionButton
                onClick={() => {
                  setEditandoBloquesId(null);
                  setBloquesDraft([]);
                  setBusquedasEjercicio({});
                }}
                className="rounded-lg border pf-v2-b-hi px-3 py-1.5 text-sm pf-v2-t"
              >
                Cerrar
              </ReliableActionButton>
            </div>
          </div>

          <div className="grid gap-3">
            {bloquesDraft.length === 0 && (
              <p className="text-sm pf-v2-t-70">Todavía no hay bloques. Agrega el primero.</p>
            )}

            {bloquesDraft.map((bloque, index) => (
              <div key={bloque.id} className="rounded-xl border pf-v2-b pf-v2-s-deep p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold pf-v2-t">Bloque {index + 1}</p>
                  <ReliableActionButton
                    onClick={() => removeBlock(index)}
                    className="text-xs font-semibold pf-v2-t-danger"
                  >
                    Eliminar bloque
                  </ReliableActionButton>
                </div>
                <input
                  value={bloque.titulo}
                  onChange={(e) => updateBlockField(index, "titulo", e.target.value)}
                  className="mb-2 w-full rounded-md border pf-v2-b-hi pf-v2-s px-3 py-2 pf-v2-t"
                  placeholder="Título del bloque"
                />
                <textarea
                  value={bloque.objetivo}
                  onChange={(e) => updateBlockField(index, "objetivo", e.target.value)}
                  className="w-full rounded-md border pf-v2-b-hi pf-v2-s px-3 py-2 pf-v2-t"
                  placeholder="Objetivo del bloque"
                  rows={2}
                />

                <div className="mt-3 rounded-lg border pf-v2-b pf-v2-s-deep p-3">
                  <label className="pf-v2-field-label">
                    Buscar ejercicio
                  </label>
                  <input
                    value={busquedasEjercicio[bloque.id] || ""}
                    onChange={(e) => updateBusqueda(bloque.id, e.target.value)}
                    className="mb-2 w-full rounded-md border pf-v2-b-hi pf-v2-s px-3 py-2 pf-v2-t"
                    placeholder="Ej: sentadilla, sprint, core"
                  />

                  <div className="max-h-36 overflow-y-auto rounded-md border pf-v2-b">
                    {(() => {
                      const query = (busquedasEjercicio[bloque.id] || "").trim().toLowerCase();
                      const filtered = ejercicios
                        .filter((ej) => ej.nombre.toLowerCase().includes(query))
                        .slice(0, 8);

                      if (filtered.length === 0 && query.length > 0) {
                        return (
                          <div className="p-3">
                            <p className="mb-2 text-xs pf-v2-t-70">
                              No encontramos ese ejercicio en tu biblioteca.
                            </p>
                            <ReliableActionButton
                              type="button"
                              onClick={() => openQuickExerciseEditor(index, busquedasEjercicio[bloque.id] || "")}
                              className="w-full rounded-md border pf-v2-b-ok pf-v2-s-ok px-3 py-2 text-sm font-semibold pf-v2-t-ok"
                            >
                              Crear ejercicio nuevo
                            </ReliableActionButton>
                          </div>
                        );
                      }

                      return filtered.map((ej) => (
                        <div
                          key={`${bloque.id}-${ej.id}`}
                          className="flex items-center justify-between border-b pf-v2-b px-3 py-2"
                        >
                          <ReliableActionButton
                            type="button"
                            onClick={() => addExerciseToBlock(index, ej.id)}
                            className="flex-1 text-left text-sm pf-v2-t"
                          >
                            {ej.nombre}
                          </ReliableActionButton>
                          <div className="ml-2 flex items-center gap-2">
                            <ReliableActionButton
                              type="button"
                              onClick={() => openQuickExerciseEditor(index, "", ej.id)}
                              className="text-[11px] font-semibold pf-v2-t-warn"
                            >
                              Editar
                            </ReliableActionButton>
                            <ReliableActionButton
                              type="button"
                              onClick={() => addExerciseToBlock(index, ej.id)}
                              className="text-[11px] font-semibold pf-v2-t-70"
                            >
                              + agregar
                            </ReliableActionButton>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  <ReliableActionButton
                    type="button"
                    onClick={() => openQuickExerciseEditor(index, busquedasEjercicio[bloque.id] || "")}
                    className="mt-2 w-full rounded-md border pf-v2-b-accent pf-v2-s-accent px-3 py-2 text-xs font-semibold pf-v2-t-accent"
                  >
                    Nuevo ejercicio rapido
                  </ReliableActionButton>

                  <div className="mt-3 grid gap-2">
                    {(bloque.ejercicios || []).map((ejercicioAsignado, exerciseIndex) => (
                      <div
                        key={`${bloque.id}-${exerciseIndex}`}
                        className="rounded-md border pf-v2-b pf-v2-s-deep p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <ReliableActionButton
                            type="button"
                            onClick={() => setExerciseDetailId(ejercicioAsignado.ejercicioId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setExerciseDetailId(ejercicioAsignado.ejercicioId);
                              }
                            }}
                            className="text-left text-sm font-semibold pf-v2-t underline-offset-2 hover:underline transition-colors"
                          >
                            {getExerciseName(ejercicioAsignado.ejercicioId)}
                          </ReliableActionButton>
                          <ReliableActionButton
                            type="button"
                            onClick={() => removeExerciseFromBlock(index, exerciseIndex)}
                            className="text-xs font-semibold pf-v2-t-danger"
                          >
                            Quitar
                          </ReliableActionButton>
                        </div>

                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <div className="rounded-md border pf-v2-b-hi pf-v2-s px-2 py-2">
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide pf-v2-t-70">
                              Series
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={ejercicioAsignado.series}
                              onChange={(e) =>
                                updateExerciseField(index, exerciseIndex, "series", e.target.value)
                              }
                              className="w-20 rounded border pf-v2-b-hi pf-v2-s px-2 py-1.5 text-xs pf-v2-t"
                              placeholder="3"
                            />
                          </div>

                          <div className="rounded-md border pf-v2-b-hi pf-v2-s px-2 py-2">
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide pf-v2-t-70">
                              Reps
                            </label>
                            <input
                              value={ejercicioAsignado.repeticiones}
                              onChange={(e) =>
                                updateExerciseField(index, exerciseIndex, "repeticiones", e.target.value)
                              }
                              className="w-24 rounded border pf-v2-b-hi pf-v2-s px-2 py-1.5 text-xs pf-v2-t"
                              placeholder="8-12"
                            />
                          </div>

                          <div className="rounded-md border pf-v2-b-hi pf-v2-s px-2 py-2">
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide pf-v2-t-70">
                              Carga
                            </label>
                            <input
                              value={ejercicioAsignado.carga || ""}
                              onChange={(e) =>
                                updateExerciseField(index, exerciseIndex, "carga", e.target.value)
                              }
                              className="w-28 rounded border pf-v2-b-hi pf-v2-s px-2 py-1.5 text-xs pf-v2-t"
                              placeholder="70% 1RM o 42 kg"
                            />
                          </div>

                          <div className="rounded-md border pf-v2-b-hi pf-v2-s px-2 py-2">
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide pf-v2-t-70">
                              Descanso
                            </label>
                            <input
                              value={ejercicioAsignado.descanso || ""}
                              onChange={(e) =>
                                updateExerciseField(index, exerciseIndex, "descanso", e.target.value)
                              }
                              className="w-24 rounded border pf-v2-b-hi pf-v2-s px-2 py-1.5 text-xs pf-v2-t"
                              placeholder="60s"
                            />
                          </div>

                          {(ejercicioAsignado.metricas || []).map((medicion, measurementIndex) => (
                            <div
                              key={`${bloque.id}-${exerciseIndex}-${measurementIndex}`}
                              className="rounded-md border pf-v2-b-hi pf-v2-s px-2 py-2"
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <input
                                  value={medicion.nombre}
                                  onChange={(e) =>
                                    updateMeasurementField(
                                      index,
                                      exerciseIndex,
                                      measurementIndex,
                                      "nombre",
                                      e.target.value
                                    )
                                  }
                                  className="w-20 rounded border pf-v2-b-hi pf-v2-s px-2 py-1 text-[10px] pf-v2-t"
                                  placeholder="RIR"
                                />
                                <ReliableActionButton
                                  type="button"
                                  onClick={() =>
                                    removeMeasurementFromExercise(index, exerciseIndex, measurementIndex)
                                  }
                                  className="text-[10px] font-semibold pf-v2-t-danger"
                                >
                                  x
                                </ReliableActionButton>
                              </div>
                              <input
                                value={medicion.valor}
                                onChange={(e) =>
                                  updateMeasurementField(
                                    index,
                                    exerciseIndex,
                                    measurementIndex,
                                    "valor",
                                    e.target.value
                                  )
                                }
                                className="w-20 rounded border pf-v2-b-hi pf-v2-s px-2 py-1.5 text-xs pf-v2-t"
                                placeholder="2"
                              />
                            </div>
                          ))}

                          <ReliableActionButton
                            type="button"
                            onClick={() => addMeasurementToExercise(index, exerciseIndex)}
                            className="rounded-md border pf-v2-b-accent px-2 py-2 text-sm font-bold pf-v2-t-accent"
                            title="Agregar métrica"
                          >
                            +
                          </ReliableActionButton>
                        </div>

                        <textarea
                          value={ejercicioAsignado.observaciones || ""}
                          onChange={(e) =>
                            updateExerciseField(
                              index,
                              exerciseIndex,
                              "observaciones",
                              e.target.value
                            )
                          }
                          className="mt-2 w-full rounded-md border pf-v2-b-hi pf-v2-s px-2 py-2 text-sm pf-v2-t"
                          placeholder="Observaciones"
                          rows={2}
                        />

                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {sesiones.map((sesion) => (
          <div key={sesion.id} className="rounded-2xl border pf-v2-b-hi pf-v2-s-deep p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{sesion.titulo}</h2>
                <p className="mt-1 text-sm pf-v2-t-70">{sesion.objetivo}</p>
              </div>
              <div className="flex gap-1">
                <ReliableActionButton
                  onClick={() => handleEdit(sesion)}
                  className="rounded p-1 pf-v2-t-70 pf-v2-hover"
                  title="Editar sesión"
                >
                  Editar
                </ReliableActionButton>
                <ReliableActionButton
                  onClick={() => startBlockEdit(sesion)}
                  className="rounded p-1 pf-v2-t-accent pf-v2-hover"
                  title="Cargar bloques"
                >
                  Bloques
                </ReliableActionButton>
                <ReliableActionButton
                  onClick={() => openAutomation(sesion)}
                  className="rounded p-1 pf-v2-t-ok pf-v2-hover"
                  title="Automatizar cargas"
                >
                  Progresion
                </ReliableActionButton>
                <ReliableActionButton
                  onClick={() => handleDelete(sesion.id)}
                  className="rounded p-1 pf-v2-t-70 pf-v2-hover"
                  title="Eliminar"
                >
                  Eliminar
                </ReliableActionButton>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl pf-v2-s-deep p-3">
                <p className="text-xs pf-v2-t-70">Asignación</p>
                <p className="font-medium">
                  {sesion.asignacionTipo === "alumnos"
                    ? `Alumno/a: ${sesion.alumnoAsignado || "-"}`
                    : `Jugadoras (${sesion.categoriaAsignada || "-"})`}
                </p>
              </div>

              <div className="rounded-xl pf-v2-s-deep p-3">
                <p className="text-xs pf-v2-t-70">Jugadora puntual</p>
                <p className="font-medium">{sesion.jugadoraAsignada || "Todas"}</p>
              </div>

              <div className="rounded-xl pf-v2-s-deep p-3">
                <p className="text-xs pf-v2-t-70">Duración</p>
                <p className="font-medium">{sesion.duracion} min</p>
              </div>

              <div className="rounded-xl pf-v2-s-deep p-3">
                <p className="text-xs pf-v2-t-70">Bloques</p>
                <p className="font-medium">{sesion.bloques.length}</p>
              </div>

              <div className="rounded-xl pf-v2-s-deep p-3">
                <p className="text-xs pf-v2-t-70">Prescripciones</p>
                <p className="font-medium">{sesion.prescripciones?.length || 0}</p>
              </div>
            </div>

            {automatizandoSesionId === sesion.id ? (
              <div className="mt-4 rounded-2xl border pf-v2-b-ok pf-v2-s-ok p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold pf-v2-t-ok">
                      Motor de progresion individual
                    </p>
                    <p className="mt-1 text-xs pf-v2-t-70">
                      Ajusta intensidad y volumen solo para las personas que selecciones. La sesion base no se rompe: se guardan prescripciones individuales encima.
                    </p>
                  </div>
                  <ReliableActionButton
                    type="button"
                    onClick={() => setAutomatizandoSesionId(null)}
                    className="rounded-lg border pf-v2-b-hi px-3 py-1.5 text-xs font-semibold pf-v2-t"
                  >
                    Cerrar
                  </ReliableActionButton>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
                  <div className="rounded-xl border pf-v2-b pf-v2-s-deep p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide pf-v2-t-50">
                      Personas objetivo
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {personasAutomatizables.map((persona) => {
                        const personaKey = toPersonaKey(persona);
                        const isChecked = personasSeleccionadas.includes(personaKey);
                        const readiness = Math.round(getReadinessScore(persona) * 100);

                        return (
                          <label
                            key={personaKey}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                              isChecked
                                ? "pf-v2-b-ok pf-v2-s-ok"
                                : "pf-v2-b pf-v2-s-deep"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePersonaSeleccionada(personaKey)}
                              className="mt-1"
                            />
                            <div>
                              <p className="font-semibold pf-v2-t">{persona.nombre}</p>
                              <p className="text-xs pf-v2-t-70">
                                Perfil {persona.tipo === "alumnos" ? "alumno/a" : "jugadora"} | Readiness {readiness}%
                              </p>
                              <p className="text-[11px] pf-v2-t-50">
                                {persona.peso ? `${persona.peso} kg` : "Peso -"} | {persona.altura ? `${persona.altura} cm` : "Altura -"}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                      {personasAutomatizables.length === 0 ? (
                        <p className="pf-v2-muted">
                          Esta sesion no tiene personas elegibles para automatizar.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border pf-v2-b pf-v2-s-deep p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide pf-v2-t-50">
                      Ajuste semanal
                    </p>

                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide pf-v2-t-50">
                      Preset tecnico
                    </label>
                    <select
                      value={selectedPresetId}
                      onChange={(e) => applyPreset(e.target.value)}
                      className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm"
                    >
                      {AUTOMATION_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                      <option value="custom">Personalizado</option>
                    </select>
                    <p className="mt-2 text-xs pf-v2-t-70">
                      {AUTOMATION_PRESETS.find((preset) => preset.id === selectedPresetId)?.description ||
                        "Ajuste manual libre para que no dependas de presets cerrados."}
                    </p>

                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide pf-v2-t-50">
                      Intensidad (%)
                    </label>
                    <input
                      type="number"
                      value={intensidadDelta}
                      onChange={(e) => {
                        setSelectedPresetId("custom");
                        setIntensidadDelta(Number(e.target.value) || 0);
                      }}
                      className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm"
                    />

                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide pf-v2-t-50">
                      Volumen (%)
                    </label>
                    <input
                      type="number"
                      value={volumenDelta}
                      onChange={(e) => {
                        setSelectedPresetId("custom");
                        setVolumenDelta(Number(e.target.value) || 0);
                      }}
                      className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm"
                    />

                    <p className="mt-3 text-xs pf-v2-t-70">
                      Intensidad mueve carga y %1RM. Volumen ajusta series, reps y descanso sugerido.
                    </p>

                    {automationPreview ? (
                      <div className="mt-4 rounded-xl border pf-v2-b-accent pf-v2-s-accent p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide pf-v2-t-accent">
                          Preview tecnico
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg pf-v2-s-deep px-3 py-2 text-xs">
                            <p className="pf-v2-t-50">Personas seleccionadas</p>
                            <p className="font-semibold pf-v2-t">{automationPreview.selectedCount}</p>
                          </div>
                          <div className="rounded-lg pf-v2-s-deep px-3 py-2 text-xs">
                            <p className="pf-v2-t-50">Readiness promedio</p>
                            <p className="font-semibold pf-v2-t-ok">{automationPreview.avgReadiness}%</p>
                          </div>
                          <div className="rounded-lg pf-v2-s-deep px-3 py-2 text-xs">
                            <p className="pf-v2-t-50">Ejercicios recalculados</p>
                            <p className="font-semibold pf-v2-t">{automationPreview.totalExercises}</p>
                          </div>
                          <div className="rounded-lg pf-v2-s-deep px-3 py-2 text-xs">
                            <p className="pf-v2-t-50">%1RM medio</p>
                            <p className="font-semibold pf-v2-t">
                              {automationPreview.avgPercent1RM ? `${automationPreview.avgPercent1RM}%` : "Estimado"}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs pf-v2-t-70">
                          Tonelaje total estimado: {automationPreview.totalTonnage.toLocaleString("es-AR")} kg
                        </p>
                        <div className="mt-2 grid gap-2">
                          {automationPreview.sampleAdjustments.map((sample, index) => (
                            <div
                              key={`${sample.persona}-${sample.ejercicio}-${index}`}
                              className="rounded-lg border pf-v2-b pf-v2-s-deep px-3 py-2 text-xs"
                            >
                              <p className="font-semibold pf-v2-t">{sample.persona}</p>
                              <p className="pf-v2-t-70">
                                {sample.ejercicio} · {sample.reps} · {sample.carga}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <ReliableActionButton
                      type="button"
                      onClick={() => applyAutomation(sesion)}
                      disabled={personasSeleccionadas.length === 0 || sesion.bloques.length === 0}
                      className="mt-4 w-full rounded-xl pf-v2-s-ok px-4 py-2 text-sm font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Aplicar automatizacion
                    </ReliableActionButton>
                  </div>
                </div>
              </div>
            ) : null}

            {sesion.prescripciones && sesion.prescripciones.length > 0 ? (
              <div className="mt-4 rounded-2xl border pf-v2-b pf-v2-s-deep p-4">
                <p className="text-xs font-semibold uppercase tracking-wide pf-v2-t-50">
                  Prescripciones individuales guardadas
                </p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {sesion.prescripciones.map((prescripcion) => (
                    <div
                      key={prescripcion.id}
                      className="rounded-xl border pf-v2-b pf-v2-s-deep p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold pf-v2-t">{prescripcion.personaNombre}</p>
                          <p className="text-xs pf-v2-t-70">{prescripcion.resumen}</p>
                        </div>
                        <ReliableActionButton
                          type="button"
                          onClick={() => removePrescription(sesion, prescripcion.id)}
                          className="rounded-lg border pf-v2-b-danger px-2 py-1 text-[11px] font-semibold pf-v2-t-danger"
                        >
                          Quitar
                        </ReliableActionButton>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg pf-v2-s-deep px-3 py-2 text-xs">
                          <p className="pf-v2-t-50">Readiness</p>
                          <p className="font-semibold pf-v2-t-ok">{prescripcion.readinessScore}%</p>
                        </div>
                        <div className="rounded-lg pf-v2-s-deep px-3 py-2 text-xs">
                          <p className="pf-v2-t-50">Bloques</p>
                          <p className="font-semibold pf-v2-t">{prescripcion.bloques.length}</p>
                        </div>
                        <div className="rounded-lg pf-v2-s-deep px-3 py-2 text-xs">
                          <p className="pf-v2-t-50">Actualizada</p>
                          <p className="font-semibold pf-v2-t">
                            {new Date(prescripcion.createdAt).toLocaleDateString("es-AR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      </>
      ) : (
      <section className="rounded-3xl border pf-v2-b-hi pf-v2-s-deep p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black pf-v2-t">Biblioteca de ejercicios</h2>
            <p className="text-sm pf-v2-t-70">
              Gestiona ejercicios dentro del modulo Entrenamiento.
            </p>
          </div>
          <ReliableActionButton
            type="button"
            onClick={() => openQuickExerciseEditor(null, "")}
            className="pf-v2-btn"
          >
            + Nuevo ejercicio
          </ReliableActionButton>
        </div>

        {ejerciciosOrdenados.length === 0 ? (
          <p className="rounded-xl border pf-v2-b pf-v2-s-deep p-4 text-sm pf-v2-t-70">
            No hay ejercicios cargados todavia.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ejerciciosOrdenados.map((ejercicio) => (
              <article key={ejercicio.id} className="rounded-2xl border pf-v2-b pf-v2-s-deep p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold pf-v2-t">{ejercicio.nombre}</p>
                    <p className="mt-1 text-xs pf-v2-t-accent">{ejercicio.categoria || "Sin categoria"}</p>
                  </div>
                  <div className="flex gap-1">
                    <ReliableActionButton
                      type="button"
                      onClick={() => openQuickExerciseEditor(null, "", ejercicio.id)}
                      className="rounded-lg border pf-v2-b-hi px-2 py-1 text-[11px] font-semibold pf-v2-t"
                    >
                      Editar
                    </ReliableActionButton>
                    <ReliableActionButton
                      type="button"
                      onClick={() => {
                        if (confirm(`Eliminar ejercicio ${ejercicio.nombre}?`)) {
                          eliminarEjercicio(ejercicio.id);
                        }
                      }}
                      className="rounded-lg border pf-v2-b-danger px-2 py-1 text-[11px] font-semibold pf-v2-t-danger"
                    >
                      Eliminar
                    </ReliableActionButton>
                  </div>
                </div>

                {ejercicio.objetivo ? (
                  <p className="mt-2 text-xs pf-v2-t-70">Objetivo: {ejercicio.objetivo}</p>
                ) : null}
                {ejercicio.descripcion ? (
                  <p className="mt-1 line-clamp-3 text-xs pf-v2-t-50">{ejercicio.descripcion}</p>
                ) : null}

                {(ejercicio.gruposMusculares || []).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(ejercicio.gruposMusculares || []).slice(0, 4).map((grupo) => (
                      <span
                        key={`${ejercicio.id}-${grupo}`}
                        className="rounded-full border pf-v2-b-accent pf-v2-s-accent px-2 py-0.5 text-[10px] font-semibold pf-v2-t-accent"
                      >
                        {grupo}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3">
                  <ReliableActionButton
                    type="button"
                    onClick={() => setExerciseDetailId(ejercicio.id)}
                    className="rounded-lg border pf-v2-b-accent px-3 py-1.5 text-xs font-semibold pf-v2-t-accent"
                  >
                    Ver detalle
                  </ReliableActionButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      )}

      {exerciseDetailId ? (() => {
        const detailEx = ejercicios.find((e) => e.id === exerciseDetailId);
        const embedUrl = detailEx?.videoUrl ? getYouTubeEmbedUrl(detailEx.videoUrl) : null;
        const isDirectVideo = detailEx?.videoUrl ? isDirectVideoFile(detailEx.videoUrl) : false;
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center pf-v2-s-deep p-4">
            <div
              className="w-full max-w-2xl rounded-2xl border pf-v2-b-hi pf-v2-s-deep shadow-2xl"
              onTouchStart={(e) => setExerciseDetailTouchStartY(e.changedTouches[0]?.clientY ?? null)}
              onTouchEnd={(e) => {
                if (exerciseDetailTouchStartY === null) return;
                const touchEndY = e.changedTouches[0]?.clientY ?? exerciseDetailTouchStartY;
                const deltaY = touchEndY - exerciseDetailTouchStartY;
                setExerciseDetailTouchStartY(null);
                if (deltaY > 90) {
                  setExerciseDetailId(null);
                }
              }}
            >
              <div className="flex justify-center border-b pf-v2-b px-6 pt-2">
                <span className="h-1.5 w-12 rounded-full pf-v2-s" aria-hidden="true" />
              </div>
              <div className="flex items-center justify-between gap-3 border-b pf-v2-b px-6 py-4">
                <h2 className="text-lg font-bold pf-v2-t">
                  {detailEx?.nombre ?? "Ejercicio"}
                </h2>
                <ReliableActionButton
                  type="button"
                  onClick={() => setExerciseDetailId(null)}
                  className="rounded-lg border pf-v2-b-hi px-3 py-1.5 text-xs font-semibold pf-v2-t pf-v2-hover"
                >
                  Cerrar
                </ReliableActionButton>
              </div>

              <div className="max-h-[80vh] overflow-y-auto p-6 space-y-4">
                {detailEx?.videoUrl ? (
                  isDirectVideo ? (
                    <div className="w-full overflow-hidden rounded-xl border pf-v2-b">
                      <video
                        src={detailEx.videoUrl}
                        controls
                        playsInline
                        className="w-full rounded-xl"
                        style={{ maxHeight: "400px" }}
                      />
                    </div>
                  ) : embedUrl ? (
                    <div className="aspect-video w-full overflow-hidden rounded-xl border pf-v2-b">
                      <iframe
                        src={embedUrl}
                        title={detailEx.nombre}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        width="100%"
                        height="100%"
                        className="h-full w-full"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full overflow-hidden rounded-xl border pf-v2-b">
                      <iframe
                        src={detailEx.videoUrl}
                        title={detailEx.nombre}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        width="100%"
                        height="100%"
                        className="h-full w-full"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-xl border pf-v2-b-warn pf-v2-s-warn px-6 py-8 text-center">
                    <span className="text-3xl">🎯</span>
                    <p className="text-base font-semibold pf-v2-t-warn">
                      Consulta al profe la ejecucion correcta
                    </p>
                    <p className="text-xs pf-v2-t-50">
                      Este ejercicio no tiene video de referencia cargado aun.
                    </p>
                  </div>
                )}

                {(detailEx?.objetivo || detailEx?.descripcion || (detailEx?.gruposMusculares?.length ?? 0) > 0) && (
                  <div className="space-y-2 rounded-xl border pf-v2-b pf-v2-s-deep p-4">
                    {detailEx?.objetivo && (
                      <p className="text-xs pf-v2-t-70">
                        <span className="font-semibold pf-v2-t">Objetivo: </span>
                        {detailEx.objetivo}
                      </p>
                    )}
                    {detailEx?.descripcion && (
                      <p className="text-xs pf-v2-t-70">
                        <span className="font-semibold pf-v2-t">Descripcion: </span>
                        {detailEx.descripcion}
                      </p>
                    )}
                    {(detailEx?.gruposMusculares?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {detailEx!.gruposMusculares!.map((g) => (
                          <span
                            key={g}
                            className="rounded-full border pf-v2-b-accent pf-v2-s-accent px-2 py-0.5 text-[10px] font-semibold pf-v2-t-accent"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })() : null}

      {quickExerciseOpen ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto pf-v2-s-deep p-4">
          <div className="mt-8 w-full max-w-3xl rounded-2xl border pf-v2-b-hi pf-v2-s-deep p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold pf-v2-t">
                  {quickExerciseEditId ? "Editar ejercicio" : "Nuevo ejercicio rapido"}
                </h2>
                <p className="text-xs pf-v2-t-70">
                  Crea o edita ejercicios sin salir de Entrenamiento.
                </p>
              </div>
              <ReliableActionButton
                type="button"
                onClick={resetQuickExercise}
                className="rounded-lg border pf-v2-b-hi px-3 py-1.5 text-xs font-semibold pf-v2-t"
              >
                Cerrar
              </ReliableActionButton>
            </div>

            <form onSubmit={submitQuickExercise} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="pf-v2-field-label">
                    Nombre
                  </label>
                  <input
                    value={quickExerciseForm.nombre}
                    onChange={(e) =>
                      setQuickExerciseForm((prev) => ({ ...prev, nombre: e.target.value }))
                    }
                    className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm"
                    placeholder="Ej: Hip thrust unilateral"
                    required
                  />
                </div>
                <div>
                  <label className="pf-v2-field-label">
                    Categoria
                  </label>
                  <select
                    value={quickExerciseForm.categoria}
                    onChange={(e) =>
                      setQuickExerciseForm((prev) => ({ ...prev, categoria: e.target.value }))
                    }
                    className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm"
                    required
                  >
                    {categoriasEjercicios.map((categoria) => (
                      <option key={categoria} value={categoria}>
                        {categoria}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="pf-v2-field-label">
                  Objetivo
                </label>
                <input
                  value={quickExerciseForm.objetivo}
                  onChange={(e) =>
                    setQuickExerciseForm((prev) => ({ ...prev, objetivo: e.target.value }))
                  }
                  className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm"
                  placeholder="Ej: Desarrollar fuerza de cadera y estabilizacion"
                />
              </div>

              <div>
                <label className="pf-v2-field-label">
                  Descripcion
                </label>
                <textarea
                  value={quickExerciseForm.descripcion}
                  onChange={(e) =>
                    setQuickExerciseForm((prev) => ({ ...prev, descripcion: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm"
                  placeholder="Indicaciones tecnicas y puntos de control"
                />
              </div>

              <div>
                <label className="pf-v2-field-label">
                  Link de video
                </label>
                <input
                  value={quickExerciseForm.videoUrl}
                  onChange={(e) =>
                    setQuickExerciseForm((prev) => ({ ...prev, videoUrl: e.target.value }))
                  }
                  className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm"
                  placeholder="https://youtube.com/..."
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide pf-v2-t-50">
                  Grupos musculares involucrados
                </label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {MUSCLE_GROUP_OPTIONS.map((group) => {
                    const active = quickExerciseForm.gruposMusculares.includes(group);
                    return (
                      <label
                        key={group}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                          active
                            ? "pf-v2-b-accent pf-v2-s-accent pf-v2-t-accent"
                            : "pf-v2-b pf-v2-s-deep pf-v2-t"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleQuickExerciseMuscleGroup(group)}
                        />
                        <span>{group}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <ReliableActionButton
                  type="button"
                  onClick={resetQuickExercise}
                  className="rounded-xl border pf-v2-b-hi px-4 py-2 text-sm font-semibold pf-v2-t"
                >
                  Cancelar
                </ReliableActionButton>
                <ReliableActionButton
                  type="submit"
                  className="pf-v2-btn"
                >
                  {quickExerciseEditId ? "Guardar cambios" : "Guardar ejercicio"}
                </ReliableActionButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </ContainerTag>
  );
}
