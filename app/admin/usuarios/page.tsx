'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'COLABORADOR' | 'CLIENTE';
  emailVerified: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session && (session.user as any).role !== 'ADMIN') {
      router.push('/');
    }
  }, [session, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setError('');
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error('Error al cargar usuarios');
        const data = await res.json();
        setUsers(data);
      } catch {
        setError('Error al cargar usuarios');
      } finally {
        setLoading(false);
      }
    };

    if (session) fetchUsers();
  }, [session]);

  const handleCleanupTestAccounts = async () => {
    if (!confirm('Esto eliminara cuentas de prueba detectadas. Continuar?')) return;

    try {
      setCleanupLoading(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleanupTestAccounts: true }),
      });

      if (!res.ok) throw new Error('Error al limpiar cuentas de prueba');

      const data = await res.json();
      setUsers(data.users ?? []);
      setSuccess(`Limpieza completada. Cuentas eliminadas: ${data.deletedCount ?? 0}.`);
    } catch {
      setError('Error al limpiar cuentas de prueba');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!res.ok) throw new Error('Error al actualizar usuario');

      const updated = await res.json();
      setUsers(users.map((u) => (u.id === userId ? updated : u)));
    } catch {
      setError('Error al actualizar rol');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Estas seguro de que quieres eliminar este usuario?')) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) throw new Error('Error al eliminar usuario');

      setUsers(users.filter((u) => u.id !== userId));
    } catch {
      setError('Error al eliminar usuario');
    }
  };

  const filteredUsers = filterRole ? users.filter((u) => u.role === filterRole) : users;

  const clientesCount = users.filter((u) => u.role === 'CLIENTE').length;
  const colaboradoresCount = users.filter((u) => u.role === 'COLABORADOR').length;

  const roleTone = (role: User['role']) => {
    if (role === 'ADMIN') return 'bg-amber-500/20 text-amber-200 border-amber-300/30';
    if (role === 'COLABORADOR') return 'bg-cyan-500/20 text-cyan-200 border-cyan-300/30';
    return 'bg-emerald-500/20 text-emerald-200 border-emerald-300/30';
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/40 border-t-cyan-300" />
          <p className="mt-4 text-sm text-slate-300">Cargando usuarios...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6 text-slate-100">
      <div className="mb-6">
        <h1 className="text-4xl font-black tracking-tight">Gestion de Usuarios</h1>
        <p className="mt-1 text-sm text-slate-300">Administra roles y acceso desde el panel.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/15 p-4 text-sm font-semibold text-rose-200">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/15 p-4 text-sm font-semibold text-emerald-200">
          {success}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Total Usuarios</p>
          <p className="mt-1 text-3xl font-black text-white">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Clientes</p>
          <p className="mt-1 text-3xl font-black text-white">{clientesCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Colaboradores</p>
          <p className="mt-1 text-3xl font-black text-white">{colaboradoresCount}</p>
        </div>
      </div>

      <div className="mb-6 max-w-sm">
        <label className="mb-2 block text-sm font-semibold text-slate-300">Filtrar por rol</label>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/50"
        >
          <option value="">Todos</option>
          <option value="CLIENTE">Clientes</option>
          <option value="COLABORADOR">Colaboradores</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </div>

      <div className="mb-6">
        <button
          onClick={handleCleanupTestAccounts}
          disabled={cleanupLoading}
          className="rounded-xl border border-amber-300/40 bg-amber-500/15 px-4 py-2 text-sm font-bold text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cleanupLoading ? 'Limpiando cuentas de prueba...' : 'Limpiar cuentas de prueba'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/65">
        <table className="w-full">
          <thead className="border-b border-white/10 bg-slate-800/70">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-300">Email</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-300">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-300">Verificado</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-300">Registrado</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-white/10 hover:bg-slate-800/40">
                <td className="px-6 py-4 text-sm text-slate-100">{user.email}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${roleTone(user.role)}`}>{user.role}</span>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={user.role === 'ADMIN'}
                      className="rounded-lg border border-white/15 bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-300/60 disabled:opacity-60"
                    >
                      <option value="CLIENTE">Cliente</option>
                      <option value="COLABORADOR">Colaborador</option>
                      <option value="ADMIN" disabled>Admin</option>
                    </select>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${user.emailVerified ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>
                    {user.emailVerified ? 'Verificado' : 'No verificado'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-300">{new Date(user.createdAt).toLocaleDateString('es-AR')}</td>
                <td className="px-6 py-4">
                  {user.role !== 'ADMIN' && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="rounded-lg bg-rose-500/20 px-3 py-1 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && <div className="py-8 text-center text-slate-400">No hay usuarios que mostrar</div>}
    </main>
  );
}
