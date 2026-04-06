"use client";
import ReliableActionButton from "@/components/ReliableActionButton";
import { use, useEffect, useMemo, useState } from 'react';

type ClienteUsuario = {
  id: string;
  email: string;
  role: 'ADMIN' | 'COLABORADOR' | 'CLIENTE';
};

type AsignacionSeleccionada = {
  alumnoId: string;
  puedeEditar: boolean;
};

export default function ColaboradorDetallePage({ params }: { params: Promise<{ colaborador: string }> }) {
  const resolvedParams = use(params);
  const colaboradorId = resolvedParams.colaborador;
  const [colaborador, setColaborador] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [clientes, setClientes] = useState<ClienteUsuario[]>([]);
  const [searchCliente, setSearchCliente] = useState('');
  const [asignaciones, setAsignaciones] = useState<AsignacionSeleccionada[]>([]);
  const [asignacionesLoading, setAsignacionesLoading] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);

  useEffect(() => {
    async function fetchColaborador() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/colaboradores/${colaboradorId}`);
        const data = await res.json();

        setColaborador(data.colaborador);
        setHistorial(data.historial || []);
        setAsignaciones(
          (data.colaborador?.colaboraciones || []).map((item: any) => ({
            alumnoId: item.alumnoId,
            puedeEditar: Boolean(item.puedeEditar),
          }))
        );

        const usersRes = await fetch('/api/admin/users');
        const usersData = await usersRes.json();
        const onlyClientes = Array.isArray(usersData)
          ? usersData.filter((user: ClienteUsuario) => user.role === 'CLIENTE')
          : [];
        setClientes(onlyClientes);
      } finally {
        setLoading(false);
      }
    }

    fetchColaborador();
  }, [colaboradorId]);

  const handleEdit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
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
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAsignaciones = async (e: any) => {
    e.preventDefault();
    setAsignacionesLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/colaboradores/${colaboradorId}/asignaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asignaciones }),
      });
      const data = await res.json();
      if (data.success) setSuccess('Asignaciones actualizadas');
      else setError(data.error || 'Error en asignaciones');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAsignacionesLoading(false);
    }
  };

  const handleAlta = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/colaboradores/${colaboradorId}/alta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) setSuccess('Verificación enviada');
      else setError(data.error || 'Error en verificación');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBaja = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/colaboradores/${colaboradorId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) setSuccess('Colaborador suspendido');
      else setError(data.error || 'Error en baja');
      if (data.success) {
        setColaborador((prev: any) => ({ ...prev, estado: 'suspendido' }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReactivar = async () => {
    setSaving(true);
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
      if (data.success) {
        setColaborador((prev: any) => ({ ...prev, estado: 'activo' }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const asignacionesSet = useMemo(() => new Set(asignaciones.map((a) => a.alumnoId)), [asignaciones]);
  const clientesFiltrados = useMemo(() => {
    const q = searchCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.email.toLowerCase().includes(q));
  }, [clientes, searchCliente]);

  if (loading) return <main className="mx-auto max-w-6xl p-6 text-slate-100">Cargando...</main>;
  if (!colaborador) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <p className="text-lg font-bold">No encontrado</p>
          <p className="mt-1 text-sm text-slate-300">No existe un colaborador con ese ID o no tiene rol COLABORADOR.</p>
        </div>
      </main>
    );
  }

  const toggleAlumno = (alumnoId: string, checked: boolean) => {
    setAsignaciones((prev) => {
      if (checked) {
        if (prev.some((p) => p.alumnoId === alumnoId)) return prev;
        return [...prev, { alumnoId, puedeEditar: true }];
      }
      return prev.filter((p) => p.alumnoId !== alumnoId);
    });
  };

  const togglePuedeEditar = (alumnoId: string, checked: boolean) => {
    setAsignaciones((prev) => prev.map((p) => (p.alumnoId === alumnoId ? { ...p, puedeEditar: checked } : p)));
  };

  return (
    <main className="mx-auto max-w-6xl p-6 text-slate-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{colaborador.nombreCompleto}</h1>
          <p className="text-sm text-slate-300">{colaborador.email}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            colaborador.estado === 'suspendido' ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'
          }`}
        >
          {colaborador.estado === 'suspendido' ? 'Suspendido' : 'Activo'}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <ReliableActionButton onClick={handleAlta} disabled={saving} className="rounded-xl bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/30 disabled:opacity-60">
          Enviar verificación
        </ReliableActionButton>
        {colaborador.estado === 'suspendido' ? (
          <ReliableActionButton onClick={handleReactivar} disabled={saving} className="rounded-xl bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-60">
            Reactivar colaborador
          </ReliableActionButton>
        ) : (
          <ReliableActionButton onClick={handleBaja} disabled={saving} className="rounded-xl bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-60">
            Dar de baja
          </ReliableActionButton>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleEdit} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-bold">Datos del colaborador</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email"><input value={colaborador.email || ''} onChange={e => setColaborador({ ...colaborador, email: e.target.value })} required className="input" /></Field>
            <Field label="Nombre completo"><input value={colaborador.nombreCompleto || ''} onChange={e => setColaborador({ ...colaborador, nombreCompleto: e.target.value })} required className="input" /></Field>
            <Field label="Edad"><input value={colaborador.edad ?? ''} onChange={e => setColaborador({ ...colaborador, edad: parseInt(e.target.value || '0', 10) })} required type="number" className="input" /></Field>
            <Field label="Fecha de nacimiento"><input value={String(colaborador.fechaNacimiento || '').slice(0, 10)} onChange={e => setColaborador({ ...colaborador, fechaNacimiento: e.target.value })} required type="date" className="input" /></Field>
            <Field label="Altura (cm)"><input value={colaborador.altura ?? ''} onChange={e => setColaborador({ ...colaborador, altura: parseFloat(e.target.value || '0') })} required type="number" step="0.01" className="input" /></Field>
            <Field label="Teléfono"><input value={colaborador.telefono || ''} onChange={e => setColaborador({ ...colaborador, telefono: e.target.value })} className="input" /></Field>
          </div>

          <Field label="Dirección"><input value={colaborador.direccion || ''} onChange={e => setColaborador({ ...colaborador, direccion: e.target.value })} className="input" /></Field>

          <div className="grid gap-2 sm:grid-cols-3">
            <Check label="Editar registros" checked={Boolean(colaborador.puedeEditarRegistros)} onChange={checked => setColaborador({ ...colaborador, puedeEditarRegistros: checked })} />
            <Check label="Editar planes" checked={Boolean(colaborador.puedeEditarPlanes)} onChange={checked => setColaborador({ ...colaborador, puedeEditarPlanes: checked })} />
            <Check label="Ver todos alumnos" checked={Boolean(colaborador.puedeVerTodosAlumnos)} onChange={checked => setColaborador({ ...colaborador, puedeVerTodosAlumnos: checked })} />
          </div>

          <ReliableActionButton type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:opacity-70">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </ReliableActionButton>
        </form>

        <div className="space-y-4">
          <form onSubmit={handleAsignaciones} className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-bold">Asignaciones</h2>
            <p className="text-xs text-slate-300">Selecciona clientes y define si el colaborador puede editar a cada uno.</p>
            <input
              value={searchCliente}
              onChange={(e) => setSearchCliente(e.target.value)}
              placeholder="Buscar cliente por email"
              className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
            />

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-slate-800/50 p-3">
              {clientesFiltrados.length === 0 ? (
                <p className="text-sm text-slate-300">No hay clientes para asignar.</p>
              ) : (
                clientesFiltrados.map((cliente) => {
                  const selected = asignacionesSet.has(cliente.id);
                  const asignacion = asignaciones.find((a) => a.alumnoId === cliente.id);
                  return (
                    <div key={cliente.id} className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => toggleAlumno(cliente.id, e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span>{cliente.email}</span>
                      </label>
                      {selected && (
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={Boolean(asignacion?.puedeEditar)}
                            onChange={(e) => togglePuedeEditar(cliente.id, e.target.checked)}
                            className="h-4 w-4"
                          />
                          Puede editar registros de este alumno
                        </label>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <ReliableActionButton type="submit" disabled={asignacionesLoading} className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-70">
              {asignacionesLoading ? 'Actualizando...' : 'Actualizar asignaciones'}
            </ReliableActionButton>
          </form>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h3 className="mb-3 text-lg font-bold">Historial de acciones</h3>
            {historial.length === 0 ? (
              <p className="text-sm text-slate-300">Sin acciones registradas.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-200">
                {historial.map((h, idx) => (
                  <li key={idx} className="rounded-xl border border-white/10 bg-slate-800/60 p-3">
                    <p className="font-semibold">{h.value?.accion || 'accion'}</p>
                    <p className="text-xs text-slate-400">{h.value?.fecha || ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {success && <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200">{success}</div>}
      {error && <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200">{error}</div>}
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

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}

