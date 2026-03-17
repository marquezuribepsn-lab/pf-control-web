import { useState, useEffect } from 'react';
import { useAlumnos } from '@/components/AlumnosProvider';
import { useRouter } from 'next/navigation';

export default function ColaboradorDetallePage({ params }: { params: { colaborador: string } }) {
  const router = useRouter();
  const colaboradorId = params.colaborador;
  const [colaborador, setColaborador] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [historial, setHistorial] = useState<any[]>([]);
  useEffect(() => {
    async function fetchColaborador() {
      setLoading(true);
      const res = await fetch(`/api/admin/colaboradores/${colaboradorId}`);
      const data = await res.json();
      setColaborador(data.colaborador);
      setHistorial(data.historial || []);
      setLoading(false);
    }
    fetchColaborador();
  }, [colaboradorId]);
  const handleReactivar = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/colaboradores/${colaboradorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'activo' }),
      });
      const data = await res.json();
      if (data.success) setSuccess('Colaborador reactivado');
      else setError(data.error || 'Error desconocido');
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleEdit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/colaboradores/${colaboradorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(colaborador),
      });
      const data = await res.json();
      if (data.success) setSuccess('Datos actualizados');
      else setError(data.error || 'Error desconocido');
    } catch (err: any) {
      return (
        <div>
          <h2>Colaborador: {colaborador.nombreCompleto}</h2>
          <div>Estado: <b>{colaborador.estado}</b></div>
          {colaborador.estado === 'suspendido' && (
            <button onClick={handleReactivar} disabled={loading}>Reactivar colaborador</button>
          )}
          <form onSubmit={handleEdit}>
            <input name="email" value={colaborador.email} onChange={e => setColaborador({ ...colaborador, email: e.target.value })} required />
            <input name="nombreCompleto" value={colaborador.nombreCompleto} onChange={e => setColaborador({ ...colaborador, nombreCompleto: e.target.value })} required />
            <input name="edad" value={colaborador.edad} onChange={e => setColaborador({ ...colaborador, edad: parseInt(e.target.value, 10) })} required type="number" />
            <input name="fechaNacimiento" value={colaborador.fechaNacimiento?.slice(0,10)} onChange={e => setColaborador({ ...colaborador, fechaNacimiento: e.target.value })} required type="date" />
            <input name="altura" value={colaborador.altura} onChange={e => setColaborador({ ...colaborador, altura: parseFloat(e.target.value) })} required type="number" step="0.01" />
            <input name="telefono" value={colaborador.telefono || ''} onChange={e => setColaborador({ ...colaborador, telefono: e.target.value })} />
            <input name="direccion" value={colaborador.direccion || ''} onChange={e => setColaborador({ ...colaborador, direccion: e.target.value })} />
            <label><input name="puedeEditarRegistros" type="checkbox" checked={colaborador.puedeEditarRegistros} onChange={e => setColaborador({ ...colaborador, puedeEditarRegistros: e.target.checked })} /> Puede editar registros</label>
            <label><input name="puedeEditarPlanes" type="checkbox" checked={colaborador.puedeEditarPlanes} onChange={e => setColaborador({ ...colaborador, puedeEditarPlanes: e.target.checked })} /> Puede editar planes</label>
            <label><input name="puedeVerTodosAlumnos" type="checkbox" checked={colaborador.puedeVerTodosAlumnos} onChange={e => setColaborador({ ...colaborador, puedeVerTodosAlumnos: e.target.checked })} /> Puede ver todos los alumnos</label>
            <button type="submit" disabled={loading}>Guardar cambios</button>
          </form>
          <hr />
          <form onSubmit={handleAsignaciones}>
            <label>Buscar alumno:</label>
            <input
              type="text"
              placeholder="Buscar por nombre"
              onChange={e => setAlumnoSearch(e.target.value)}
            />
            <label>Alumnos asignados:</label>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ccc', padding: 8 }}>
              {alumnos
                .filter(alumno => alumno.nombre.toLowerCase().includes((alumnoSearch || '').toLowerCase()))
                .map(alumno => (
                  <div key={alumno.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={asignacionesInput.includes(alumno.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setAsignacionesInput([...asignacionesInput, alumno.id]);
                          } else {
                            setAsignacionesInput(asignacionesInput.filter(id => id !== alumno.id));
                          }
                        }}
                      />
                      {alumno.nombre} (ID: {alumno.id})
                    </label>
                  </div>
                ))}
            </div>
            <button type="submit" disabled={asignacionesLoading}>Actualizar asignaciones</button>
          </form>
          <button onClick={handleAlta} disabled={loading}>Enviar verificación</button>
          <button onClick={handleBaja} disabled={loading}>Suspender colaborador</button>
          <hr />
          <h3>Historial de acciones</h3>
          <ul>
            {historial.map((h, idx) => (
              <li key={idx}>{h.value.accion} - {h.value.fecha} {JSON.stringify(h.value.detalles)}</li>
            ))}
          </ul>
          {success && <div style={{ color: 'green' }}>{success}</div>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
        </div>
      );
    setAsignacionesLoading(true);
    try {
      const res = await fetch(`/api/admin/colaboradores/${colaboradorId}/asignaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asignaciones: asignacionesInput }),
      });
      const data = await res.json();
      if (data.success) setSuccess('Asignaciones actualizadas');
      else setError(data.error || 'Error en asignaciones');
      setAsignacionesLoading(false);
    } catch (err: any) {
      setError(err.message);
      setAsignacionesLoading(false);
    }
  };

  if (loading) return <div>Cargando...</div>;
  if (!colaborador) return <div>No encontrado</div>;

  return (
    <div>
      <h2>Colaborador: {colaborador.nombreCompleto}</h2>
      <form onSubmit={handleEdit}>
        <input name="email" value={colaborador.email} onChange={e => setColaborador({ ...colaborador, email: e.target.value })} required />
        <input name="nombreCompleto" value={colaborador.nombreCompleto} onChange={e => setColaborador({ ...colaborador, nombreCompleto: e.target.value })} required />
        <input name="edad" value={colaborador.edad} onChange={e => setColaborador({ ...colaborador, edad: parseInt(e.target.value, 10) })} required type="number" />
        <input name="fechaNacimiento" value={colaborador.fechaNacimiento?.slice(0,10)} onChange={e => setColaborador({ ...colaborador, fechaNacimiento: e.target.value })} required type="date" />
        <input name="altura" value={colaborador.altura} onChange={e => setColaborador({ ...colaborador, altura: parseFloat(e.target.value) })} required type="number" step="0.01" />
        <input name="telefono" value={colaborador.telefono || ''} onChange={e => setColaborador({ ...colaborador, telefono: e.target.value })} />
        <input name="direccion" value={colaborador.direccion || ''} onChange={e => setColaborador({ ...colaborador, direccion: e.target.value })} />
        <label><input name="puedeEditarRegistros" type="checkbox" checked={colaborador.puedeEditarRegistros} onChange={e => setColaborador({ ...colaborador, puedeEditarRegistros: e.target.checked })} /> Puede editar registros</label>
        <label><input name="puedeEditarPlanes" type="checkbox" checked={colaborador.puedeEditarPlanes} onChange={e => setColaborador({ ...colaborador, puedeEditarPlanes: e.target.checked })} /> Puede editar planes</label>
        <label><input name="puedeVerTodosAlumnos" type="checkbox" checked={colaborador.puedeVerTodosAlumnos} onChange={e => setColaborador({ ...colaborador, puedeVerTodosAlumnos: e.target.checked })} /> Puede ver todos los alumnos</label>
        <button type="submit" disabled={loading}>Guardar cambios</button>
      </form>
      <hr />
      <form onSubmit={handleAsignaciones}>
        <label>Buscar alumno:</label>
        <input
          type="text"
          placeholder="Buscar por nombre"
          onChange={e => setAlumnoSearch(e.target.value)}
        />
        <label>Alumnos asignados:</label>
        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ccc', padding: 8 }}>
          {alumnos
            .filter(alumno => alumno.nombre.toLowerCase().includes((alumnoSearch || '').toLowerCase()))
            .map(alumno => (
              <div key={alumno.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={asignacionesInput.includes(alumno.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setAsignacionesInput([...asignacionesInput, alumno.id]);
                      } else {
                        setAsignacionesInput(asignacionesInput.filter(id => id !== alumno.id));
                      }
                    }}
                  />
                  {alumno.nombre} (ID: {alumno.id})
                </label>
              </div>
            ))}
        </div>
        <button type="submit" disabled={asignacionesLoading}>Actualizar asignaciones</button>
      </form>
        // Buscador de alumnos
        const [alumnoSearch, setAlumnoSearch] = useState('');
      <button onClick={handleAlta} disabled={loading}>Enviar verificación</button>
      <button onClick={handleBaja} disabled={loading}>Dar de baja</button>
      {success && <div style={{ color: 'green' }}>{success}</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
  // Fin del componente
  // Agregada llave de cierre faltante
  }
