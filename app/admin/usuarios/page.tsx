'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const [error, setError] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const router = useRouter();
  const { data: session } = useSession();

  // Redirect if not admin
  useEffect(() => {
    if (session && (session.user as any).role !== 'ADMIN') {
      router.push('/');
    }
  }, [session, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error('Error al cargar usuarios');
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setError('Error al cargar usuarios');
      } finally {
        setLoading(false);
      }
    };

    if (session) fetchUsers();
  }, [session]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!res.ok) throw new Error('Error al actualizar usuario');

      const updated = await res.json();
      setUsers(users.map(u => u.id === userId ? updated : u));
    } catch (err) {
      setError('Error al actualizar rol');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) throw new Error('Error al eliminar usuario');

      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      setError('Error al eliminar usuario');
    }
  };

  const filteredUsers = filterRole
    ? users.filter(u => u.role === filterRole)
    : users;

  const clientesCount = users.filter(u => u.role === 'CLIENTE').length;
  const colaboradoresCount = users.filter(u => u.role === 'COLABORADOR').length;

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Gestión de Usuarios</h1>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-100 p-4 rounded-lg">
          <p className="text-gray-600 text-sm">Total Usuarios</p>
          <p className="text-3xl font-bold text-blue-600">{users.length}</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded-lg">
          <p className="text-gray-600 text-sm">Clientes</p>
          <p className="text-3xl font-bold text-yellow-600">{clientesCount}</p>
        </div>
        <div className="bg-green-100 p-4 rounded-lg">
          <p className="text-gray-600 text-sm">Colaboradores</p>
          <p className="text-3xl font-bold text-green-600">{colaboradoresCount}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filtrar por rol
        </label>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
        >
          <option value="">Todos</option>
          <option value="CLIENTE">Clientes</option>
          <option value="COLABORADOR">Colaboradores</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Email
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Verificado
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Registrado
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={user.role === 'ADMIN'}
                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
                  >
                    <option value="CLIENTE">Cliente</option>
                    <option value="COLABORADOR">Colaborador</option>
                    <option value="ADMIN" disabled>
                      Admin
                    </option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      user.emailVerified
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.emailVerified ? 'Verificado' : 'No verificado'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(user.createdAt).toLocaleDateString('es-AR')}
                </td>
                <td className="px-6 py-4">
                  {user.role !== 'ADMIN' && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
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

      {filteredUsers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No hay usuarios que mostrar
        </div>
      )}
    </div>
  );
}
