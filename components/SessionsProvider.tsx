"use client";

import {
  createContext,
  useContext,
  useMemo,
} from "react";
import { sesionesIniciales, type Sesion } from "../data/mockData";
import { markManualSaveIntent, useSharedState } from "./useSharedState";

type SessionsContextType = {
  sesiones: Sesion[];
  agregarSesion: (sesion: Omit<Sesion, 'id'>) => string;
  editarSesion: (id: string, sesion: Partial<Sesion>) => void;
  eliminarSesion: (id: string) => void;
};

const SessionsContext = createContext<SessionsContextType | undefined>(
  undefined
);

const STORAGE_KEY = "pf-control-sesiones";

const createSessionId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function SessionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sesiones, setSesiones] = useSharedState<Sesion[]>(sesionesIniciales, {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  function agregarSesion(sesion: Omit<Sesion, 'id'>) {
    markManualSaveIntent(STORAGE_KEY);
    const nuevaSesion: Sesion = {
      ...sesion,
      id: createSessionId(),
    };
    setSesiones((prev) => [nuevaSesion, ...prev]);
    return nuevaSesion.id;
  }

  function editarSesion(id: string, sesionActualizada: Partial<Sesion>) {
    markManualSaveIntent(STORAGE_KEY);
    setSesiones((prev) =>
      prev.map((sesion) =>
        sesion.id === id ? { ...sesion, ...sesionActualizada } : sesion
      )
    );
  }

  function eliminarSesion(id: string) {
    markManualSaveIntent(STORAGE_KEY);
    setSesiones((prev) => prev.filter((sesion) => sesion.id !== id));
  }

  const value = useMemo(
    () => ({
      sesiones,
      agregarSesion,
      editarSesion,
      eliminarSesion,
    }),
    [sesiones]
  );

  return (
    <SessionsContext.Provider value={value}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  const context = useContext(SessionsContext);
  if (!context) {
    throw new Error("useSessions debe usarse dentro de SessionsProvider");
  }
  return context;
}