"use client";

import {
  createContext,
  useContext,
  useMemo,
} from "react";
import { type Jugadora } from "../data/mockData";
import { useSharedState } from "./useSharedState";

export type Equipo = {
  id: string;
  nombre: string;
  categoria: string;
  temporada: string;
  descripcion?: string;
};

type EquiposContextType = {
  equipos: Equipo[];
  agregarEquipo: (equipo: Omit<Equipo, 'id'>) => void;
  editarEquipo: (id: string, equipo: Partial<Equipo>) => void;
  eliminarEquipo: (id: string) => void;
  getJugadorasEnEquipo: (equipoId: string, jugadoras: Jugadora[]) => Jugadora[];
};

const EquiposContext = createContext<EquiposContextType | undefined>(
  undefined
);

const STORAGE_KEY = "pf-control-equipos";

const equiposIniciales: Equipo[] = [
  {
    id: "1",
    nombre: "Primera Femenina",
    categoria: "Primera",
    temporada: "2026",
    descripcion: "Equipo principal femenino",
  },
  {
    id: "2",
    nombre: "Sub 18 Femenina",
    categoria: "Sub 18",
    temporada: "2026",
    descripcion: "Equipo sub 18 femenino",
  },
  {
    id: "3",
    nombre: "Sub 16 Femenina",
    categoria: "Sub 16",
    temporada: "2026",
    descripcion: "Equipo sub 16 femenino",
  },
];

export default function EquiposProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [equipos, setEquipos] = useSharedState<Equipo[]>(equiposIniciales, {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  function agregarEquipo(equipo: Omit<Equipo, 'id'>) {
    const nuevoEquipo: Equipo = {
      ...equipo,
      id: Date.now().toString(),
    };
    setEquipos((prev) => [...prev, nuevoEquipo]);
  }

  function editarEquipo(id: string, equipoActualizado: Partial<Equipo>) {
    setEquipos((prev) =>
      prev.map((equipo) =>
        equipo.id === id ? { ...equipo, ...equipoActualizado } : equipo
      )
    );
  }

  function eliminarEquipo(id: string) {
    setEquipos((prev) => prev.filter((equipo) => equipo.id !== id));
  }

  function getJugadorasEnEquipo(equipoId: string, jugadoras: Jugadora[]): Jugadora[] {
    const equipo = equipos.find(e => e.id === equipoId);
    if (!equipo) return [];
    return jugadoras.filter(j => j.categoria === equipo.categoria);
  }

  const value = useMemo(
    () => ({
      equipos,
      agregarEquipo,
      editarEquipo,
      eliminarEquipo,
      getJugadorasEnEquipo,
    }),
    [equipos]
  );

  return (
    <EquiposContext.Provider value={value}>
      {children}
    </EquiposContext.Provider>
  );
}

export function useEquipos() {
  const context = useContext(EquiposContext);
  if (!context) {
    throw new Error("useEquipos debe usarse dentro de EquiposProvider");
  }
  return context;
}