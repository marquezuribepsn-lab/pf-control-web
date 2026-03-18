"use client";
import { createContext, useContext, useState, useEffect } from 'react';

const ColaboradoresContext = createContext<any>(null);

export function ColaboradoresProvider({ children }: { children: React.ReactNode }) {
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchColaboradores() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch('/api/admin/colaboradores');
        if (!res.ok) {
          throw new Error('No se pudieron cargar los colaboradores');
        }
        const data = await res.json();
        setColaboradores(data.colaboradores || []);
      } catch (err: any) {
        setColaboradores([]);
        setError(err?.message || 'Error al cargar colaboradores');
      } finally {
        setLoading(false);
      }
    }
    fetchColaboradores();
  }, []);

  return (
    <ColaboradoresContext.Provider value={{ colaboradores, loading, error }}>
      {children}
    </ColaboradoresContext.Provider>
  );
}

export function useColaboradores() {
  return useContext(ColaboradoresContext);
}
