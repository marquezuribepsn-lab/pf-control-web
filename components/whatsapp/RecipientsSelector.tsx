"use client";
// Selector de destinatarios (alumnos/colaboradores)
import { useAlumnos } from '../AlumnosProvider';
import { useColaboradores } from '../ColaboradoresProvider';
import { useState } from 'react';

export default function RecipientsSelector() {
  const { alumnos } = useAlumnos();
  const { colaboradores, loading: loadingColabs } = useColaboradores();
  const [selected, setSelected] = useState<{ [key: string]: boolean }>({});

  function handleToggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div>
      <h2>Seleccionar destinatarios</h2>
      <div className="mb-2 font-semibold">Alumnos</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-4">
        {alumnos.map((alumno) => (
          <label key={alumno.nombre} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!selected[alumno.nombre]}
              onChange={() => handleToggle(alumno.nombre)}
            />
            <span>{alumno.nombre}</span>
          </label>
        ))}
      </div>
      <div className="mb-2 font-semibold">Colaboradores</div>
      {loadingColabs ? (
        <div>Cargando colaboradores...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {colaboradores.map((colab: any) => (
            <label key={colab.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!selected[colab.id]}
                onChange={() => handleToggle(colab.id)}
              />
              <span>{colab.nombreCompleto || colab.email}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
