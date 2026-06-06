"use client";

import {
  createContext,
  useContext,
  useMemo,
} from "react";
import { type Ejercicio } from "../data/mockData";
import { markManualSaveIntent, useSharedState } from "./useSharedState";

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
  // ── PLIOMÉTRICOS – TREN INFERIOR ─────────────────────────────────────────
  {
    id: "vc-01",
    nombre: "Salto c/ Rodillas al Pecho",
    categoria: "Pliométrico",
    descripcion: "Salto explosivo llevando ambas rodillas al pecho",
    objetivo: "Potencia y reactividad en tren inferior",
    gruposMusculares: ["Tren Inferior", "Full Body"],
    videoUrl: "https://www.youtube.com/shorts/tmtS6FQpBX8",
  },
  {
    id: "vc-02",
    nombre: "Salto Unipodal Asistido",
    categoria: "Pliométrico",
    descripcion: "Salto pliométrico unipodal con asistencia",
    objetivo: "Desarrollo de potencia unilateral en tren inferior",
    gruposMusculares: ["Tren Inferior"],
    videoUrl: "https://www.youtube.com/shorts/MROLqI3VwnA",
  },
  {
    id: "vc-03",
    nombre: "Salto Bipodal Asistido",
    categoria: "Pliométrico",
    descripcion: "Salto pliométrico bipodal con asistencia",
    objetivo: "Desarrollo de potencia en tren inferior",
    gruposMusculares: ["Tren Inferior"],
    videoUrl: "https://www.youtube.com/shorts/8rIEWLrJ5nQ",
  },
  // ── PLIOMÉTRICOS – TREN SUPERIOR ─────────────────────────────────────────
  {
    id: "vc-04",
    nombre: "Jerk c/ Barra (Plyo Push)",
    categoria: "Pliométrico",
    descripcion: "Empuje pliométrico con barra — Plyo Push",
    objetivo: "Potencia explosiva en cadena anterior de tren superior",
    gruposMusculares: ["Tren Superior", "Cadena Anterior"],
    videoUrl: "https://www.youtube.com/shorts/SvyycSoD8Ps",
  },
  {
    id: "vc-05",
    nombre: "Remo Unilateral en Polea (Plyo Pull)",
    categoria: "Pliométrico",
    descripcion: "Tracción pliométrica unilateral en polea",
    objetivo: "Potencia explosiva en cadena posterior de tren superior",
    gruposMusculares: ["Tren Superior", "Cadena Posterior", "Espalda"],
    videoUrl: "https://www.youtube.com/shorts/jkEDPJtyUo8",
  },
  // ── ISOMÉTRICOS – TREN INFERIOR ──────────────────────────────────────────
  {
    id: "vc-06",
    nombre: "Estocada en Iso Hold c/ Barra por Debajo",
    categoria: "Isométrico",
    descripcion: "Estocada con retención isométrica, barra en posición baja",
    objetivo: "Fuerza isométrica en cuádriceps y glúteos",
    gruposMusculares: ["Tren Inferior", "Cuádriceps", "Glúteos"],
    videoUrl: "https://www.youtube.com/shorts/L93Bbuj-0EQ",
  },
  {
    id: "vc-07",
    nombre: "Hip Thrust c/ Barra Iso Catch",
    categoria: "Isométrico",
    descripcion: "Hip thrust con barra y captura isométrica",
    objetivo: "Fuerza isométrica en glúteos e isquiotibiales",
    gruposMusculares: ["Tren Inferior", "Glúteos", "Isquiotibiales"],
    videoUrl: "https://www.youtube.com/shorts/ltK9_di8Is8",
  },
  // ── ISOMÉTRICOS – TREN SUPERIOR ──────────────────────────────────────────
  {
    id: "vc-08",
    nombre: "Presa Plano c/ Barra Iso Push Hold",
    categoria: "Isométrico",
    descripcion: "Press plano con barra y retención isométrica",
    objetivo: "Fuerza isométrica en pectoral y tríceps",
    gruposMusculares: ["Tren Superior", "Pectoral", "Tríceps"],
    videoUrl: "https://www.youtube.com/shorts/CtGfTZuDmMk",
  },
  // ── ISOMÉTRICOS – CONTRA PARED ───────────────────────────────────────────
  {
    id: "vc-09",
    nombre: "Cambio de Apoyo Iso Switch",
    categoria: "Isométrico",
    descripcion: "Isométrico contra pared con cambio de apoyo",
    objetivo: "Estabilidad y control motor en tren inferior",
    gruposMusculares: ["Tren Inferior", "Full Body"],
    videoUrl: "https://www.youtube.com/shorts/gfjeRd0QGnA",
  },
  {
    id: "vc-10",
    nombre: "Cambio de Apoyo Sostenido Iso Switch Hold",
    categoria: "Isométrico",
    descripcion: "Isométrico contra pared con cambio y sostenimiento de apoyo",
    objetivo: "Fuerza isométrica y control postural",
    gruposMusculares: ["Tren Inferior", "Full Body"],
    videoUrl: "https://www.youtube.com/shorts/GNSQP7S5nzo",
  },
  {
    id: "vc-11",
    nombre: "Flexoextensión Inferior Iso Switch Wall",
    categoria: "Isométrico",
    descripcion: "Flexoextensión contra pared con cambio isométrico",
    objetivo: "Control motor y fuerza isométrica inferior",
    gruposMusculares: ["Tren Inferior", "Full Body"],
    videoUrl: "https://www.youtube.com/shorts/IaWAbE4lAfQ",
  },
  {
    id: "vc-12",
    nombre: "Apoyo Sostenido Iso Hold Wall",
    categoria: "Isométrico",
    descripcion: "Sostenimiento isométrico contra pared",
    objetivo: "Fuerza isométrica y estabilidad postural",
    gruposMusculares: ["Tren Inferior", "Full Body"],
    videoUrl: "https://www.youtube.com/shorts/99H4w-f1FuQ",
  },
  // ── BALÍSTICOS ───────────────────────────────────────────────────────────
  {
    id: "vc-13",
    nombre: "Lanzamiento MB Lateral c/ Rotación",
    categoria: "Balístico",
    descripcion: "Lanzamiento lateral de medicine ball con rotación de tronco",
    objetivo: "Potencia rotatoria y fuerza explosiva de core",
    gruposMusculares: ["Core", "Full Body"],
    videoUrl: "https://www.youtube.com/shorts/loUPfteUdhA",
  },
  {
    id: "vc-14",
    nombre: "Lanzamiento MB Frontal",
    categoria: "Balístico",
    descripcion: "Lanzamiento frontal de medicine ball",
    objetivo: "Potencia explosiva en cadena anterior",
    gruposMusculares: ["Core", "Full Body"],
    videoUrl: "https://www.youtube.com/shorts/9I3rMfST2QU",
  },
  // ── BÁSICOS DE FUERZA ────────────────────────────────────────────────────
  {
    id: "vc-15",
    nombre: "Sentadilla en Hack",
    categoria: "Básico de Fuerza",
    descripcion: "Sentadilla en máquina Hack — ejercicio básico de fuerza",
    objetivo: "Desarrollo de fuerza en cuádriceps y glúteos",
    gruposMusculares: ["Tren Inferior", "Cuádriceps", "Glúteos"],
    videoUrl: "https://www.youtube.com/shorts/B3s_EY07H34",
  },
  {
    id: "vc-16",
    nombre: "Press Plano c/ Barra",
    categoria: "Básico de Fuerza",
    descripcion: "Press plano con barra — ejercicio básico de fuerza de tren superior",
    objetivo: "Desarrollo de fuerza en pectoral",
    gruposMusculares: ["Tren Superior", "Pectoral"],
    videoUrl: "https://www.youtube.com/shorts/W41NmJFChoQ",
  },
  // ── ESPECÍFICOS – TREN INFERIOR – CUÁDRICEPS ─────────────────────────────
  {
    id: "vc-17",
    nombre: "Sentadilla en Smith",
    categoria: "Específico",
    descripcion: "Sentadilla en máquina Smith — cadena ant/post tren inferior",
    objetivo: "Desarrollo de cuádriceps y glúteos",
    gruposMusculares: ["Tren Inferior", "Cuádriceps", "Glúteos"],
    videoUrl: "https://www.youtube.com/shorts/x4c5r1bwRGI",
  },
  {
    id: "vc-18",
    nombre: "Sentadilla Búlgara en Smith",
    categoria: "Específico",
    descripcion: "Sentadilla búlgara unilateral en Smith",
    objetivo: "Fuerza y estabilidad unilateral de cuádriceps",
    gruposMusculares: ["Tren Inferior", "Cuádriceps"],
    videoUrl: "https://www.youtube.com/shorts/geeTZrzi24g",
  },
  {
    id: "vc-19",
    nombre: "Sentadilla Búlgara en Hack",
    categoria: "Específico",
    descripcion: "Sentadilla búlgara unilateral en máquina Hack",
    objetivo: "Fuerza y desarrollo unilateral de cuádriceps",
    gruposMusculares: ["Tren Inferior", "Cuádriceps"],
    videoUrl: "https://www.youtube.com/shorts/MkDH7HBrjiA",
  },
  {
    id: "vc-20",
    nombre: "Sillón de Cuádriceps (bilateral)",
    categoria: "Específico",
    descripcion: "Extensión de rodillas bilateral en máquina",
    objetivo: "Desarrollo de cuádriceps",
    gruposMusculares: ["Tren Inferior", "Cuádriceps"],
    videoUrl: "https://www.youtube.com/shorts/IBdsIaYkFwU",
  },
  {
    id: "vc-21",
    nombre: "Sillón de Cuádriceps Unilateral",
    categoria: "Específico",
    descripcion: "Extensión de rodillas unilateral en máquina",
    objetivo: "Desarrollo unilateral de cuádriceps",
    gruposMusculares: ["Tren Inferior", "Cuádriceps"],
    videoUrl: "https://www.youtube.com/shorts/Jw-ijh6_RTI",
  },
  {
    id: "vc-22",
    nombre: "Sillón de Cuádriceps Unilateral (Individual)",
    categoria: "Específico",
    descripcion: "Extensión de rodillas unilateral — variante individual",
    objetivo: "Desarrollo y corrección unilateral de cuádriceps",
    gruposMusculares: ["Tren Inferior", "Cuádriceps"],
    videoUrl: "https://www.youtube.com/shorts/FEK7B1I38zo",
  },
  // ── ESPECÍFICOS – TREN INFERIOR – ISQUIOS ────────────────────────────────
  {
    id: "vc-23",
    nombre: "Sillón de Isquios Unilateral",
    categoria: "Específico",
    descripcion: "Curl de piernas unilateral en máquina",
    objetivo: "Desarrollo unilateral de isquiotibiales",
    gruposMusculares: ["Tren Inferior", "Isquiotibiales"],
    videoUrl: "https://www.youtube.com/shorts/8XyIPbiFSCY",
  },
  // ── ESPECÍFICOS – TREN SUPERIOR – ESPALDA ────────────────────────────────
  {
    id: "vc-24",
    nombre: "Remo c/ Barra (Agarre Supino)",
    categoria: "Específico",
    descripcion: "Remo con barra en agarre supino — cadena posterior",
    objetivo: "Desarrollo de espalda y bíceps",
    gruposMusculares: ["Tren Superior", "Espalda", "Bíceps"],
    videoUrl: "https://www.youtube.com/shorts/t_rHCSe_kKI",
  },
  {
    id: "vc-25",
    nombre: "Remo T (Agarre Neutro)",
    categoria: "Específico",
    descripcion: "Remo en T con agarre neutro",
    objetivo: "Desarrollo de espalda media y romboides",
    gruposMusculares: ["Tren Superior", "Espalda"],
    videoUrl: "https://www.youtube.com/shorts/nQ6SN1i1Dgc",
  },
  {
    id: "vc-26",
    nombre: "Remo T (Agarre Prono)",
    categoria: "Específico",
    descripcion: "Remo en T con agarre prono",
    objetivo: "Desarrollo de espalda alta y dorsales",
    gruposMusculares: ["Tren Superior", "Espalda"],
    videoUrl: "https://www.youtube.com/shorts/wjDbgu2niSU",
  },
  {
    id: "vc-27",
    nombre: "Remo Bajo (Agarre Supino)",
    categoria: "Específico",
    descripcion: "Remo bajo en polea con agarre supino",
    objetivo: "Desarrollo de espalda baja y bíceps",
    gruposMusculares: ["Tren Superior", "Espalda"],
    videoUrl: "https://www.youtube.com/shorts/TbK3zaDurqk",
  },
  {
    id: "vc-28",
    nombre: "Remo Bajo (Agarre Neutro)",
    categoria: "Específico",
    descripcion: "Remo bajo en polea con agarre neutro",
    objetivo: "Desarrollo de espalda media",
    gruposMusculares: ["Tren Superior", "Espalda"],
    videoUrl: "https://www.youtube.com/shorts/GPReKcofUmg",
  },
  {
    id: "vc-29",
    nombre: "Remo Bajo (Agarre Abierto/Neutro)",
    categoria: "Específico",
    descripcion: "Remo bajo en polea con agarre abierto y neutro",
    objetivo: "Desarrollo de espalda y deltoides posterior",
    gruposMusculares: ["Tren Superior", "Espalda"],
    videoUrl: "https://www.youtube.com/shorts/WvutLWXTxwE",
  },
  {
    id: "vc-30",
    nombre: "Remo Bajo Unilateral",
    categoria: "Específico",
    descripcion: "Remo bajo unilateral en polea",
    objetivo: "Desarrollo unilateral de espalda",
    gruposMusculares: ["Tren Superior", "Espalda"],
    videoUrl: "https://www.youtube.com/shorts/J_ExC-tNEcw",
  },
  {
    id: "vc-31",
    nombre: "Dominadas (Supinas) Asistidas c/ Banda",
    categoria: "Específico",
    descripcion: "Dominadas en agarre supino asistidas con banda elástica",
    objetivo: "Desarrollo de espalda y bíceps",
    gruposMusculares: ["Tren Superior", "Espalda", "Bíceps"],
    videoUrl: "https://www.youtube.com/shorts/Gzic9bgD3Ks",
  },
  // ── ESPECÍFICOS – TREN SUPERIOR – PECTORAL / TRÍCEPS ─────────────────────
  {
    id: "vc-32",
    nombre: "Press Cerrado c/ Barra",
    categoria: "Específico",
    descripcion: "Press con agarre cerrado para pectoral y tríceps",
    objetivo: "Desarrollo de pectoral interno y tríceps",
    gruposMusculares: ["Tren Superior", "Pectoral", "Tríceps"],
    videoUrl: "https://www.youtube.com/shorts/2YVHwPYXnDY",
  },
  {
    id: "vc-33",
    nombre: "Flexiones Declinadas (Rodillas Apoyadas)",
    categoria: "Específico",
    descripcion: "Flexiones en posición declinada con rodillas apoyadas",
    objetivo: "Desarrollo de pectoral superior y tríceps",
    gruposMusculares: ["Tren Superior", "Pectoral", "Tríceps"],
    videoUrl: "https://www.youtube.com/shorts/oTIuDS-SjEg",
  },
  {
    id: "vc-34",
    nombre: "Flexiones Declinadas (Punta de Pies)",
    categoria: "Específico",
    descripcion: "Flexiones en posición declinada sobre punta de pies",
    objetivo: "Desarrollo de pectoral superior y tríceps",
    gruposMusculares: ["Tren Superior", "Pectoral", "Tríceps"],
    videoUrl: "https://www.youtube.com/shorts/61OxpJUMDqE",
  },
  {
    id: "vc-35",
    nombre: "Fondos en Paralelas",
    categoria: "Específico",
    descripcion: "Fondos en barras paralelas — cadena anterior tren superior",
    objetivo: "Desarrollo de pectoral y tríceps",
    gruposMusculares: ["Tren Superior", "Pectoral", "Tríceps"],
    videoUrl: "https://www.youtube.com/shorts/3t5aVxvW6og",
  },
  // ── ESPECÍFICOS – DELTOIDES ───────────────────────────────────────────────
  {
    id: "vc-36",
    nombre: "Vuelos Posteriores en Peck Deck",
    categoria: "Específico",
    descripcion: "Vuelos posteriores en máquina peck deck",
    objetivo: "Desarrollo de deltoides posterior",
    gruposMusculares: ["Tren Superior", "Deltoides Posterior"],
    videoUrl: "https://www.youtube.com/shorts/N44Ue0VOYfg",
  },
  {
    id: "vc-37",
    nombre: "Jalón a la Cara en Polea (Face Pull)",
    categoria: "Específico",
    descripcion: "Face pull en polea alta — deltoides posterior",
    objetivo: "Desarrollo de deltoides posterior y manguito rotador",
    gruposMusculares: ["Tren Superior", "Deltoides Posterior"],
    videoUrl: "https://www.youtube.com/shorts/84W0xpwu5Eg",
  },
  {
    id: "vc-38",
    nombre: "Vuelos Laterales Unilateral Inclinado",
    categoria: "Específico",
    descripcion: "Vuelos laterales unilaterales en posición inclinada con mancuerna",
    objetivo: "Desarrollo de deltoides medial",
    gruposMusculares: ["Tren Superior", "Deltoides Medial"],
    videoUrl: "https://www.youtube.com/shorts/pDysL_FTO3M",
  },
  {
    id: "vc-39",
    nombre: "Press Militar c/ Mancuernas",
    categoria: "Específico",
    descripcion: "Press militar con mancuernas — deltoides anterior",
    objetivo: "Desarrollo de deltoides anterior",
    gruposMusculares: ["Tren Superior", "Deltoides Anterior"],
    videoUrl: "https://www.youtube.com/shorts/K5WyFV1o_aM",
  },
  {
    id: "vc-40",
    nombre: "Press Militar c/ Barra",
    categoria: "Específico",
    descripcion: "Press militar con barra — deltoides completo",
    objetivo: "Desarrollo integral de deltoides",
    gruposMusculares: ["Tren Superior", "Deltoides Anterior", "Deltoides Medial", "Deltoides Posterior"],
    videoUrl: "https://www.youtube.com/shorts/1PbiVvFrex4",
  },
  // ── ESPECÍFICOS – BÍCEPS ─────────────────────────────────────────────────
  {
    id: "vc-41",
    nombre: "Curl Unilateral en Banco Scott c/ Mancuerna",
    categoria: "Específico",
    descripcion: "Curl unilateral en banco Scott con mancuerna — bíceps short head",
    objetivo: "Desarrollo de cabeza corta del bíceps",
    gruposMusculares: ["Tren Superior", "Bíceps"],
    videoUrl: "https://www.youtube.com/shorts/2VY8rXI5PQs",
  },
  {
    id: "vc-42",
    nombre: "Curl en Banco Scott c/ Barra W",
    categoria: "Específico",
    descripcion: "Curl en banco Scott con barra W — bíceps short head",
    objetivo: "Desarrollo de cabeza corta del bíceps",
    gruposMusculares: ["Tren Superior", "Bíceps"],
    videoUrl: "https://www.youtube.com/shorts/3QjpouUCbT4",
  },
  // ── ACCESORIOS – TREN INFERIOR ───────────────────────────────────────────
  {
    id: "vc-43",
    nombre: "Aducción en Máquina Sentado",
    categoria: "Accesorio",
    descripcion: "Aducción de cadera en máquina, posición sentado",
    objetivo: "Desarrollo de aductores",
    gruposMusculares: ["Tren Inferior", "Aductores"],
    videoUrl: "https://www.youtube.com/shorts/rfwtD8JUS50",
  },
  {
    id: "vc-44",
    nombre: "Abducción en Máquina Sentado",
    categoria: "Accesorio",
    descripcion: "Abducción de cadera en máquina, posición sentado",
    objetivo: "Desarrollo de abductores y glúteos",
    gruposMusculares: ["Tren Inferior", "Abductores", "Glúteos"],
    videoUrl: "https://www.youtube.com/shorts/YWc1EmaRCYI",
  },
  {
    id: "vc-45",
    nombre: "Aducción en Máquina de Pie",
    categoria: "Accesorio",
    descripcion: "Aducción de cadera en máquina, posición de pie",
    objetivo: "Desarrollo funcional de aductores",
    gruposMusculares: ["Tren Inferior", "Aductores"],
    videoUrl: "https://www.youtube.com/shorts/PLGWVsqyhnk",
  },
  {
    id: "vc-46",
    nombre: "Abducción en Máquina de Pie",
    categoria: "Accesorio",
    descripcion: "Abducción de cadera en máquina, posición de pie",
    objetivo: "Desarrollo funcional de abductores y glúteos",
    gruposMusculares: ["Tren Inferior", "Abductores", "Glúteos"],
    videoUrl: "https://www.youtube.com/shorts/iizVNxoRPfo",
  },
  // ── ACCESORIOS – TREN SUPERIOR ───────────────────────────────────────────
  {
    id: "vc-47",
    nombre: "Copa c/ Mancuerna (Long Head)",
    categoria: "Accesorio",
    descripcion: "Extensión en copa con mancuerna — tríceps long head",
    objetivo: "Desarrollo de cabeza larga del tríceps",
    gruposMusculares: ["Tren Superior", "Tríceps"],
    videoUrl: "https://www.youtube.com/shorts/n-SWD32sGNE",
  },
  // ── COMBINADOS / COMPLEJOS ───────────────────────────────────────────────
  {
    id: "vc-48",
    nombre: "Estocada + Rotación de Tronco c/ Carga Sostenida",
    categoria: "Combinado",
    descripcion: "Estocada combinada con rotación de tronco sosteniendo carga",
    objetivo: "Fuerza funcional de tren inferior y core",
    gruposMusculares: ["Tren Inferior", "Core"],
    videoUrl: "https://www.youtube.com/shorts/5pW2J3usz7o",
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
    markManualSaveIntent(STORAGE_KEY);
    const nuevoId = Date.now().toString();
    const nuevoEjercicio: Ejercicio = {
      ...ejercicio,
      id: nuevoId,
    };
    setEjercicios((prev) => [...prev, nuevoEjercicio]);
    return nuevoId;
  }

  function editarEjercicio(id: string, ejercicioActualizado: Partial<Ejercicio>) {
    markManualSaveIntent(STORAGE_KEY);
    setEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.id === id ? { ...ejercicio, ...ejercicioActualizado } : ejercicio
      )
    );
  }

  function eliminarEjercicio(id: string) {
    markManualSaveIntent(STORAGE_KEY);
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