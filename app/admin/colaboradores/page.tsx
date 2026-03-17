import { ColaboradoresProvider, useColaboradores } from '@/components/ColaboradoresProvider';

function ColaboradoresList() {
  const { colaboradores, loading } = useColaboradores();

  if (loading) return <div>Cargando colaboradores...</div>;

  return (
    <div>
      <h2>Colaboradores</h2>
      <ul>
        {colaboradores.map((colab: any) => (
          <li key={colab.id}>
            <b>{colab.nombreCompleto}</b> ({colab.email})<br />
            Permisos: {colab.puedeEditarRegistros ? 'Editar registros' : ''} {colab.puedeEditarPlanes ? 'Editar planes' : ''} {colab.puedeVerTodosAlumnos ? 'Ver todos los alumnos' : ''}<br />
            Alumnos asignados: {colab.colaboraciones.map((a: any) => a.alumno.nombreCompleto).join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ColaboradoresPage() {
  return (
    <ColaboradoresProvider>
      <ColaboradoresList />
    </ColaboradoresProvider>
  );
}
