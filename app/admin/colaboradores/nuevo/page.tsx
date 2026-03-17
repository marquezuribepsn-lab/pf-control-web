import { useState } from 'react';

export default function NuevoColaboradorPage() {
  const [form, setForm] = useState({
    email: '',
    nombreCompleto: '',
    edad: '',
    fechaNacimiento: '',
    altura: '',
    telefono: '',
    direccion: '',
    puedeEditarRegistros: false,
    puedeEditarPlanes: false,
    puedeVerTodosAlumnos: false,
    asignaciones: '', // IDs separados por coma
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          edad: parseInt(form.edad, 10),
          altura: parseFloat(form.altura),
          asignaciones: form.asignaciones.split(',').map((id: string) => id.trim()),
        }),
      });
      const data = await res.json();
      if (data.success) setSuccess(true);
      else setError(data.error || 'Error desconocido');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2>Nuevo Colaborador</h2>
      <form onSubmit={handleSubmit}>
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <input name="nombreCompleto" placeholder="Nombre completo" value={form.nombreCompleto} onChange={handleChange} required />
        <input name="edad" placeholder="Edad" value={form.edad} onChange={handleChange} required type="number" />
        <input name="fechaNacimiento" placeholder="Fecha de nacimiento" value={form.fechaNacimiento} onChange={handleChange} required type="date" />
        <input name="altura" placeholder="Altura (cm)" value={form.altura} onChange={handleChange} required type="number" step="0.01" />
        <input name="telefono" placeholder="Teléfono" value={form.telefono} onChange={handleChange} />
        <input name="direccion" placeholder="Dirección" value={form.direccion} onChange={handleChange} />
        <label><input name="puedeEditarRegistros" type="checkbox" checked={form.puedeEditarRegistros} onChange={handleChange} /> Puede editar registros</label>
        <label><input name="puedeEditarPlanes" type="checkbox" checked={form.puedeEditarPlanes} onChange={handleChange} /> Puede editar planes</label>
        <label><input name="puedeVerTodosAlumnos" type="checkbox" checked={form.puedeVerTodosAlumnos} onChange={handleChange} /> Puede ver todos los alumnos</label>
        <input name="asignaciones" placeholder="IDs de alumnos asignados (separados por coma)" value={form.asignaciones} onChange={handleChange} />
        <button type="submit" disabled={loading}>Crear colaborador</button>
      </form>
      {success && <div>Colaborador creado y credenciales enviadas por mail.</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
