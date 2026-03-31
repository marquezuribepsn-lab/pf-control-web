"use client";

import {
  createContext,
  useContext,
  useMemo,
} from "react";
import { wellnessInicial, type WellnessItem } from "../data/mockData";
import { markManualSaveIntent, useSharedState } from "./useSharedState";

type WellnessContextType = {
  wellness: WellnessItem[];
  agregarWellness: (item: WellnessItem) => void;
};

const WellnessContext = createContext<WellnessContextType | undefined>(
  undefined
);

const STORAGE_KEY = "pf-control-wellness";

export default function WellnessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [wellness, setWellness] = useSharedState<WellnessItem[]>(wellnessInicial, {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  function agregarWellness(item: WellnessItem) {
    markManualSaveIntent(STORAGE_KEY);
    setWellness((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return [item, ...base];
    });
  }

  const value = useMemo(
    () => ({
      wellness,
      agregarWellness,
    }),
    [wellness]
  );

  return (
    <WellnessContext.Provider value={value}>
      {children}
    </WellnessContext.Provider>
  );
}

export function useWellness() {
  const context = useContext(WellnessContext);
  if (!context) {
    throw new Error("useWellness debe usarse dentro de WellnessProvider");
  }
  return context;
}