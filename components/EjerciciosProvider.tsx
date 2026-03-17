"use client";

import {
  createContext,
  useContext,
  useMemo,
} from "react";
import { type Ejercicio } from "../data/mockData";
import { useSharedState } from "./useSharedState";

type EjerciciosContextType = {
  ejercicios: Ejercicio[];
  agregarEjercicio: (ejercicio: Omit<Ejercicio, 'id'>) => string;
  editarEjercicio: (id: string, ejercicio: Partial<Ejercicio>) => void;
  eliminarEjercicio: (id: string) => void;
};

const EjerciciosContext = createContext<EjerciciosContextType | undefined>(
  undefined
);

const STORAGE_KEY = "pf-control-ejercicios";

const ejerciciosIniciales: Ejercicio[] = [
  {
    id: "1",
    nombre: "Sentadilla búlgara",
    categoria: "Fuerza",
    descripcion: "Ejercicio unilateral para tren inferior",
    objetivo: "Desarrollo de fuerza y estabilidad",
    videoUrl: "https://www.youtube.com/watch?v=Dy28eq2PjcM",
  },
  {
    id: "2",
    nombre: "Nordic curl asistido",
    categoria: "Fuerza",
    descripcion: "Ejercicio isométrico para isquiotibiales",
    objetivo: "Fortalecimiento de cadena posterior",
    videoUrl: "https://youtu.be/8CdvEGXpoHQ",
  },
  {
    id: "3",
    nombre: "Sprint 10m",
    categoria: "Velocidad",
    descripcion: "Aceleración máxima en distancia corta",
    objetivo: "Desarrollo de velocidad inicial",
    videoUrl: "https://www.youtube.com/watch?v=8p6QtL6yFyY",
  },
  {
    id: "4",
    nombre: "Salidas reactivas",
    categoria: "Velocidad",
    descripcion: "Respuesta rápida a estímulos",
    objetivo: "Mejora de capacidad reactiva",
    videoUrl: "https://vimeo.com/76979871",
  },
  {
    id: "5",
    nombre: "Press de banca",
    categoria: "Fuerza",
    descripcion: "Ejercicio compuesto para pecho y tríceps",
    objetivo: "Desarrollo de fuerza en tren superior",
    videoUrl: "https://www.youtube.com/shorts/8ZSQfmM0w2c",
  },
  {
    id: "6",
    nombre: "Peso muerto rumano",
    categoria: "Fuerza",
    descripcion: "Ejercicio para cadena posterior",
    objetivo: "Fortalecimiento de isquiotibiales y glúteos",
    videoUrl: "https://www.youtube.com/watch?v=2sh43ZTxpOA",
  },
  {
    id: "7",
    nombre: "Dominadas asistidas",
    categoria: "Fuerza",
    descripcion: "Ejercicio para espalda y bíceps",
    objetivo: "Desarrollo de fuerza en tren superior",
    videoUrl: "https://www.youtube.com/watch?v=9U2KxOgkD4I",
  },
  {
    id: "8",
    nombre: "Plank",
    categoria: "Core",
    descripcion: "Ejercicio isométrico para core",
    objetivo: "Fortalecimiento del centro del cuerpo",
    videoUrl: "https://www.youtube.com/shorts/4KCdjPgZA9E",
  },
  {
    id: "9",
    nombre: "Burpees",
    categoria: "Condición",
    descripcion: "Ejercicio full body explosivo",
    objetivo: "Mejora cardiovascular y fuerza",
    videoUrl: "https://www.youtube.com/shorts/dO4PoO8XgNk",
  },
  {
    id: "10",
    nombre: "Saltos de caja",
    categoria: "Potencia",
    descripcion: "Ejercicio pliométrico para piernas",
    objetivo: "Desarrollo de potencia en tren inferior",
    videoUrl: "https://www.youtube.com/watch?v=qN-vkuZ3K8o",
  },
  {
    id: "11",
    nombre: "Remo con barra",
    categoria: "Fuerza",
    descripcion: "Ejercicio compuesto para espalda",
    objetivo: "Desarrollo de dorsales y posteriores",
    videoUrl: "https://www.youtube.com/watch?v=FWJR5Ve8bnQ",
  },
  {
    id: "12",
    nombre: "Press militar",
    categoria: "Fuerza",
    descripcion: "Ejercicio para hombros",
    objetivo: "Desarrollo de deltoides",
    videoUrl: "https://www.youtube.com/watch?v=qEwKCR5JCog",
  },
  {
    id: "13",
    nombre: "Curl de bíceps",
    categoria: "Fuerza",
    descripcion: "Ejercicio de aislamiento para bíceps",
    objetivo: "Desarrollo de bíceps braquial",
    videoUrl: "https://www.youtube.com/watch?v=ykJmrZ5v0Oo",
  },
  {
    id: "14",
    nombre: "Extensiones de tríceps",
    categoria: "Fuerza",
    descripcion: "Ejercicio de aislamiento para tríceps",
    objetivo: "Desarrollo de tríceps braquial",
    videoUrl: "https://www.youtube.com/watch?v=6SS6K3lAwZ8",
  },
  {
    id: "15",
    nombre: "Sentadilla profunda",
    categoria: "Fuerza",
    descripcion: "Ejercicio compuesto para piernas",
    objetivo: "Desarrollo completo de cuádriceps y glúteos",
    videoUrl: "https://www.youtube.com/watch?v=Dy28eq2PjcM",
  },
  {
    id: "16",
    nombre: "Zancadas alternas",
    categoria: "Fuerza",
    descripcion: "Ejercicio unilateral para piernas",
    objetivo: "Equilibrio muscular y estabilidad",
    videoUrl: "https://www.youtube.com/watch?v=L8fvypPrzzs",
  },
  {
    id: "17",
    nombre: "Mountain climbers",
    categoria: "Condición",
    descripcion: "Ejercicio dinámico para core",
    objetivo: "Fortalecimiento y resistencia cardiovascular",
    videoUrl: "https://www.youtube.com/shorts/9FGqk6nF1Qw",
  },
  {
    id: "18",
    nombre: "Russian twists",
    categoria: "Core",
    descripcion: "Ejercicio rotacional para oblicuos",
    objetivo: "Fortalecimiento de oblicuos",
    videoUrl: "https://www.youtube.com/watch?v=7Pj_RreVd5o",
  },
  {
    id: "19",
    nombre: "Step-ups",
    categoria: "Fuerza",
    descripcion: "Ejercicio funcional para piernas",
    objetivo: "Fuerza y coordinación",
    videoUrl: "https://www.youtube.com/watch?v=gwLzBJYoWlI",
  },
  {
    id: "20",
    nombre: "Pull-ups",
    categoria: "Fuerza",
    descripcion: "Dominadas completas",
    objetivo: "Fuerza máxima en espalda y brazos",
    videoUrl: "https://www.youtube.com/watch?v=eGo4IYlbE5g",
  },
  {
    id: "21",
    nombre: "Deadlift convencional",
    categoria: "Fuerza",
    descripcion: "Ejercicio compuesto completo",
    objetivo: "Desarrollo de fuerza total del cuerpo",
    videoUrl: "https://www.youtube.com/watch?v=ytGaGIn3SjE",
  },
  {
    id: "22",
    nombre: "Clean and jerk",
    categoria: "Potencia",
    descripcion: "Movimiento olímpico completo",
    objetivo: "Desarrollo de potencia explosiva",
    videoUrl: "https://www.youtube.com/watch?v=MEj4XGCg_3g",
  },
  {
    id: "23",
    nombre: "Snatch",
    categoria: "Potencia",
    descripcion: "Movimiento olímpico de arranque",
    objetivo: "Potencia y coordinación",
    videoUrl: "https://www.youtube.com/watch?v=9xQp2sldyts",
  },
  {
    id: "24",
    nombre: "Box jumps",
    categoria: "Potencia",
    descripcion: "Saltos pliométricos a caja",
    objetivo: "Potencia en tren inferior",
    videoUrl: "https://www.youtube.com/watch?v=qN-vkuZ3K8o",
  },
  {
    id: "25",
    nombre: "Farmer's walk",
    categoria: "Fuerza",
    descripcion: "Caminata con pesas",
    objetivo: "Fuerza de agarre y core",
    videoUrl: "https://www.youtube.com/watch?v=Da6aC0Q5jVQ",
  },
];

export default function EjerciciosProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ejercicios, setEjercicios] = useSharedState<Ejercicio[]>(ejerciciosIniciales, {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  function agregarEjercicio(ejercicio: Omit<Ejercicio, 'id'>): string {
    const nuevoId = Date.now().toString();
    const nuevoEjercicio: Ejercicio = {
      ...ejercicio,
      id: nuevoId,
    };
    setEjercicios((prev) => [...prev, nuevoEjercicio]);
    return nuevoId;
  }

  function editarEjercicio(id: string, ejercicioActualizado: Partial<Ejercicio>) {
    setEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.id === id ? { ...ejercicio, ...ejercicioActualizado } : ejercicio
      )
    );
  }

  function eliminarEjercicio(id: string) {
    setEjercicios((prev) => prev.filter((ejercicio) => ejercicio.id !== id));
  }

  const value = useMemo(
    () => ({
      ejercicios,
      agregarEjercicio,
      editarEjercicio,
      eliminarEjercicio,
    }),
    [ejercicios]
  );

  return (
    <EjerciciosContext.Provider value={value}>
      {children}
    </EjerciciosContext.Provider>
  );
}

export function useEjercicios() {
  const context = useContext(EjerciciosContext);
  if (!context) {
    throw new Error("useEjercicios debe usarse dentro de EjerciciosProvider");
  }
  return context;
}