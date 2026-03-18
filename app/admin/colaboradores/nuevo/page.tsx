"use client";
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
          asignaciones: form.asignaciones
            .split(',')
            .map((id: string) => id.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) setSuccess(true);
      else setError(data.error || data.message || 'Error desconocido');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <main className="mx-auto max-w-4xl p-6 text-slate-100">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight">Nuevo colaborador</h1>
        <p className="text-sm text-slate-300">Crea la cuenta, define permisos y envía credenciales automáticamente.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input name="email" type="email" placeholder="email@dominio.com" value={form.email} onChange={handleChange} required className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50" />
          </Field>
          <Field label="Nombre completo">
            <input name="nombreCompleto" placeholder="Nombre y apellido" value={form.nombreCompleto} onChange={handleChange} required className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50" />
          </Field>
          <Field label="Edad">
            <input name="edad" placeholder="Edad" value={form.edad} onChange={handleChange} required type="number" className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50" />
          </Field>
          <Field label="Fecha de nacimiento">
            <input name="fechaNacimiento" value={form.fechaNacimiento} onChange={handleChange} required type="date" className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50" />
          </Field>
          <Field label="Altura (cm)">
            <input name="altura" placeholder="Ej: 172" value={form.altura} onChange={handleChange} required type="number" step="0.01" className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50" />
          </Field>
          <Field label="Teléfono">
            <input name="telefono" placeholder="Opcional" value={form.telefono} onChange={handleChange} className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50" />
          </Field>
        </div>

        <Field label="Dirección">
          <input name="direccion" placeholder="Opcional" value={form.direccion} onChange={handleChange} className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50" />
        </Field>

        <Field label="IDs de alumnos asignados (separados por coma)">
          <input name="asignaciones" placeholder="id1, id2, id3" value={form.asignaciones} onChange={handleChange} className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50" />
        </Field>

        <div className="grid gap-2 sm:grid-cols-3">
          <Checkbox name="puedeEditarRegistros" checked={form.puedeEditarRegistros} onChange={handleChange} label="Puede editar registros" />
          <Checkbox name="puedeEditarPlanes" checked={form.puedeEditarPlanes} onChange={handleChange} label="Puede editar planes" />
          <Checkbox name="puedeVerTodosAlumnos" checked={form.puedeVerTodosAlumnos} onChange={handleChange} label="Puede ver todos los alumnos" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={loading} className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-2 text-sm font-black text-slate-950 transition hover:from-emerald-300 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? 'Creando...' : 'Crear colaborador'}
          </button>
          {success && <span className="text-sm font-semibold text-emerald-300">Colaborador creado y credenciales enviadas por mail.</span>}
          {error && <span className="text-sm font-semibold text-rose-300">{error}</span>}
        </div>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Checkbox({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: (e: any) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">
      <input name={name} type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}
