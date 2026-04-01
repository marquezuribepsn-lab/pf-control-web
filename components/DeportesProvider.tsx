"use client";

import {
  createContext,
  useContext,
  useEffect,
} from "react";
import { deportesIniciales, type Deporte } from "../data/mockData";
import { markManualSaveIntent, useSharedState } from "./useSharedState";

type DeportesContextType = {
  deportes: Deporte[];
  agregarDeporte: (deporte: Deporte) => void;
  toggleDeporte: (nombre: string) => void;
  eliminarDeporte: (nombre: string) => void;
  actualizarDeporte: (nombre: string, updates: Partial<Deporte>) => void;
};

const DeportesContext = createContext<DeportesContextType | undefined>(
  undefined
);

const STORAGE_KEY = "pf-control-deportes";

export default function DeportesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [deportes, setDeportes] = useSharedState<Deporte[]>(deportesIniciales, {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  useEffect(() => {
    // Ensure default sports retain positions if historical payload is missing them.
    setDeportes((prev) => {
      const merged = deportesIniciales.map((initial) => {
        const savedDeporte = prev.find((s) => s.nombre === initial.nombre);
        if (!savedDeporte) return initial;

        return {
          ...savedDeporte,
          posiciones:
            savedDeporte.posiciones && savedDeporte.posiciones.length > 0
              ? savedDeporte.posiciones
              : initial.posiciones,
        };
      });

      const newSports = prev.filter(
        (s) => !deportesIniciales.some((init) => init.nombre === s.nombre)
      );

      return [...merged, ...newSports];
    });
  }, [setDeportes]);

  function agregarDeporte(deporte: Deporte) {
    markManualSaveIntent(STORAGE_KEY);
    setDeportes((prev) => [...prev, deporte]);
  }

  function toggleDeporte(nombre: string) {
    markManualSaveIntent(STORAGE_KEY);
    setDeportes((prev) =>
      prev.map((dep) =>
        dep.nombre === nombre ? { ...dep, habilitado: !dep.habilitado } : dep
      )
    );
  }

  function eliminarDeporte(nombre: string) {
    markManualSaveIntent(STORAGE_KEY);
    setDeportes((prev) => prev.filter((dep) => dep.nombre !== nombre));
  }

  function actualizarDeporte(nombre: string, updates: Partial<Deporte>) {
    markManualSaveIntent(STORAGE_KEY);
    setDeportes((prev) =>
      prev.map((dep) =>
        dep.nombre === nombre ? { ...dep, ...updates } : dep
      )
    );
  }

  return (
    <DeportesContext.Provider
      value={{ deportes, agregarDeporte, toggleDeporte, eliminarDeporte, actualizarDeporte }}
    >
      {children}
    </DeportesContext.Provider>
  );
}

export { DeportesContext };

export function useDeportes() {
  const context = useContext(DeportesContext);
  if (!context) {
    throw new Error("useDeportes must be used within a DeportesProvider");
  }
  return context;
}