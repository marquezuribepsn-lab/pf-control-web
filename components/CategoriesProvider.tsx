"use client";

import {
  createContext,
  useContext,
  useEffect,
} from "react";
import { categoriasIniciales, type Categoria } from "../data/mockData";
import { markManualSaveIntent, useSharedState } from "./useSharedState";

type CategoriesContextType = {
  categorias: Categoria[];
  agregarCategoria: (categoria: Categoria) => void;
  toggleCategoria: (nombre: string) => void;
  eliminarCategoria: (nombre: string) => void;
};

const CategoriesContext = createContext<CategoriesContextType | undefined>(
  undefined
);

const STORAGE_KEY = "pf-control-categorias";
const NUTRITION_CATEGORY_NAME = "Nutricion";

export default function CategoriesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categorias, setCategorias] = useSharedState<Categoria[]>(categoriasIniciales, {
    key: STORAGE_KEY,
    legacyLocalStorageKey: STORAGE_KEY,
  });

  useEffect(() => {
    const hasNutrition = categorias.some(
      (categoria) => categoria.nombre.trim().toLowerCase() === NUTRITION_CATEGORY_NAME.toLowerCase()
    );

    if (hasNutrition) {
      return;
    }

    markManualSaveIntent(STORAGE_KEY);
    setCategorias((prev) => [...prev, { nombre: NUTRITION_CATEGORY_NAME, habilitada: true }]);
  }, [categorias, setCategorias]);

  function agregarCategoria(categoria: Categoria) {
    markManualSaveIntent(STORAGE_KEY);
    setCategorias((prev) => [...prev, categoria]);
  }

  function toggleCategoria(nombre: string) {
    markManualSaveIntent(STORAGE_KEY);
    setCategorias((prev) =>
      prev.map((cat) =>
        cat.nombre === nombre ? { ...cat, habilitada: !cat.habilitada } : cat
      )
    );
  }

  function eliminarCategoria(nombre: string) {
    markManualSaveIntent(STORAGE_KEY);
    setCategorias((prev) => prev.filter((cat) => cat.nombre !== nombre));
  }

  return (
    <CategoriesContext.Provider
      value={{ categorias, agregarCategoria, toggleCategoria, eliminarCategoria }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export { CategoriesContext };

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error("useCategories must be used within a CategoriesProvider");
  }
  return context;
}