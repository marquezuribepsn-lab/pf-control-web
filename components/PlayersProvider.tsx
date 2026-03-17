"use client";

import {
  createContext,
  useContext,
  useMemo,
} from "react";
import { jugadorasIniciales, type Jugadora } from "../data/mockData";
import { useSharedState } from "./useSharedState";

type PlayersContextType = {
  jugadoras: Jugadora[];
  agregarJugadora: (jugadora: Jugadora) => void;
  editarJugadora: (nombreActual: string, jugadoraActualizada: Partial<Jugadora>) => void;
  eliminarJugadora: (nombre: string) => void;
  cambiarCategoriaJugadora: (nombre: string, nuevaCategoria: string) => void;
};

export const PlayersContext = createContext<PlayersContextType | undefined>(
  undefined
);

const STORAGE_KEY = "pf-control-jugadoras";

export default function PlayersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [jugadoras, setJugadoras] = useSharedState<Jugadora[]>(jugadorasIniciales, {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  function agregarJugadora(jugadora: Jugadora) {
    setJugadoras((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return [jugadora, ...base];
    });
  }

  function editarJugadora(nombreActual: string, jugadoraActualizada: Partial<Jugadora>) {
    setJugadoras((prev) =>
      prev.map((jugadora) =>
        jugadora.nombre === nombreActual
          ? { ...jugadora, ...jugadoraActualizada }
          : jugadora
      )
    );
  }

  function eliminarJugadora(nombre: string) {
    setJugadoras((prev) => prev.filter((jugadora) => jugadora.nombre !== nombre));
  }

  function cambiarCategoriaJugadora(nombre: string, nuevaCategoria: string) {
    setJugadoras((prev) =>
      prev.map((jugadora) =>
        jugadora.nombre === nombre
          ? { ...jugadora, categoria: nuevaCategoria }
          : jugadora
      )
    );
  }

  const value = useMemo(
    () => ({
      jugadoras,
      agregarJugadora,
      editarJugadora,
      eliminarJugadora,
      cambiarCategoriaJugadora,
    }),
    [jugadoras]
  );

  return (
    <PlayersContext.Provider value={value}>
      {children}
    </PlayersContext.Provider>
  );
}

export function usePlayers() {
  const context = useContext(PlayersContext);
  if (!context) {
    throw new Error("usePlayers debe usarse dentro de PlayersProvider");
  }
  return context;
}
