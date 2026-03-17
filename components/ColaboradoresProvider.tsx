import { createContext, useContext, useState, useEffect } from 'react';

const ColaboradoresContext = createContext<any>(null);

export function ColaboradoresProvider({ children }: { children: React.ReactNode }) {
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchColaboradores() {
      setLoading(true);
      const res = await fetch('/api/admin/colaboradores');
      const data = await res.json();
      setColaboradores(data.colaboradores || []);
      setLoading(false);
    }
    fetchColaboradores();
  }, []);

  return (
    <ColaboradoresContext.Provider value={{ colaboradores, loading }}>
      {children}
    </ColaboradoresContext.Provider>
  );
}

export function useColaboradores() {
  return useContext(ColaboradoresContext);
}
