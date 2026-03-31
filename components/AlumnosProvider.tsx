"use client";

import { createContext, useContext, useMemo } from "react";
import { alumnosIniciales, type Alumno } from "../data/mockData";
import { markManualSaveIntent, useSharedState } from "./useSharedState";

type AlumnosContextType = {
  alumnos: Alumno[];
  agregarAlumno: (alumno: Alumno) => void;
  editarAlumno: (nombreActual: string, alumnoActualizado: Partial<Alumno>) => void;
  eliminarAlumno: (nombre: string) => void;
};

const AlumnosContext = createContext<AlumnosContextType | undefined>(undefined);

const STORAGE_KEY = "pf-control-alumnos";

export default function AlumnosProvider({ children }: { children: React.ReactNode }) {
  const [alumnos, setAlumnos] = useSharedState<Alumno[]>(alumnosIniciales, {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  function agregarAlumno(alumno: Alumno) {
    markManualSaveIntent(STORAGE_KEY);
    setAlumnos((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return [alumno, ...base];
    });
  }

  function editarAlumno(nombreActual: string, alumnoActualizado: Partial<Alumno>) {
    markManualSaveIntent(STORAGE_KEY);
    setAlumnos((prev) =>
      prev.map((alumno) =>
        alumno.nombre === nombreActual ? { ...alumno, ...alumnoActualizado } : alumno
      )
    );
  }

  function eliminarAlumno(nombre: string) {
    markManualSaveIntent(STORAGE_KEY);
    setAlumnos((prev) => prev.filter((alumno) => alumno.nombre !== nombre));
  }

  const value = useMemo(
    () => ({ alumnos, agregarAlumno, editarAlumno, eliminarAlumno }),
    [alumnos]
  );

  return <AlumnosContext.Provider value={value}>{children}</AlumnosContext.Provider>;
}

export function useAlumnos() {
  const context = useContext(AlumnosContext);
  if (!context) {
    throw new Error("useAlumnos debe usarse dentro de AlumnosProvider");
  }
  return context;
}
