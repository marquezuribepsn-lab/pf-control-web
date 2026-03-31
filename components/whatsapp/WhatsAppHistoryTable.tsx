"use client";
// Tabla de historial de envios
import { useEffect, useMemo, useState } from 'react';

type WhatsAppLog = {
  key: string;
  value: {
    destinatario?: string;
    destinatarioTipo?: string;
    tipo?: string;
    subcategoria?: string;
    mode?: string;
    estado?: string;
    triggeredBy?: string;
    error?: string;
    mensaje?: string;
    fecha?: string;
    [k: string]: any;
  } | null;
  createdAt: string;
};

type WhatsAppHistoryTableProps = {
  reloadToken?: number;
};

export default function WhatsAppHistoryTable({ reloadToken = 0 }: WhatsAppHistoryTableProps) {
  const [historial, setHistorial] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [modeFilter, setModeFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredHistorial = useMemo(() => {
    const query = search.trim().toLowerCase();

    return historial.filter((entry) => {
      const value = entry.value || {};
      const fechaBase = value.fecha ? new Date(value.fecha) : new Date(entry.createdAt);

      if (Number.isNaN(fechaBase.getTime())) {
        return false;
      }

      if (statusFilter !== 'todos' && String(value.estado || '').toLowerCase() !== statusFilter) {
        return false;
      }

      if (modeFilter !== 'todos' && String(value.mode || '').toLowerCase() !== modeFilter) {
        return false;
      }

      if (categoryFilter !== 'todos' && String(value.tipo || '').toLowerCase() !== categoryFilter) {
        return false;
      }

      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`);
        if (fechaBase < from) {
          return false;
        }
      }

      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59`);
        if (fechaBase > to) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const haystack = [
        value.destinatario,
        value.destinatarioTipo,
        value.tipo,
        value.subcategoria,
        value.mode,
        value.estado,
        value.triggeredBy,
        value.mensaje,
        value.error,
      ]
        .map((item) => String(item || ''))
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [categoryFilter, dateFrom, dateTo, historial, modeFilter, search, statusFilter]);

  useEffect(() => {
    async function fetchHistorial() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/whatsapp-history');
        if (!res.ok) {
          throw new Error('No se pudo cargar el historial');
        }
        const data = await res.json();
        setHistorial(data.historial || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
        setHistorial([]);
      } finally {
        setLoading(false);
      }
    }
    fetchHistorial();
  }, [reloadToken]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-black text-white">Historial de envios</h2>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError('');
            fetch('/api/admin/whatsapp-history')
              .then(async (res) => {
                if (!res.ok) {
                  throw new Error('No se pudo actualizar el historial');
                }
                const data = await res.json();
                setHistorial(data.historial || []);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'No se pudo actualizar el historial');
              })
              .finally(() => {
                setLoading(false);
              });
          }}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-100"
        >
          Actualizar
        </button>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-6">
        <input
          type="text"
          placeholder="Buscar en historial"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 md:col-span-2"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100"
        >
          <option value="todos">Estado: todos</option>
          <option value="enviado">Enviado</option>
          <option value="error">Error</option>
        </select>
        <select
          value={modeFilter}
          onChange={(event) => setModeFilter(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100"
        >
          <option value="todos">Modo: todos</option>
          <option value="manual">Manual</option>
          <option value="test">Test</option>
          <option value="automatico">Automatico</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100"
        >
          <option value="todos">Categoria: todas</option>
          <option value="cobranzas">Cobranzas</option>
          <option value="asistencia_rutinas">Asistencia y Rutinas</option>
          <option value="recordatorios_otros">Recordatorios y Otros</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100"
          />
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-400">Resultados: {filteredHistorial.length}</p>

      {loading ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">Cargando historial...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
      ) : filteredHistorial.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-400">Sin envios registrados.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-300">
                <th className="border-b border-slate-700 p-2 text-left">Fecha</th>
                <th className="border-b border-slate-700 p-2 text-left">Destinatario</th>
                <th className="border-b border-slate-700 p-2 text-left">Categoria</th>
                <th className="border-b border-slate-700 p-2 text-left">Subcategoria</th>
                <th className="border-b border-slate-700 p-2 text-left">Modo</th>
                <th className="border-b border-slate-700 p-2 text-left">Estado</th>
                <th className="border-b border-slate-700 p-2 text-left">Usuario</th>
                <th className="border-b border-slate-700 p-2 text-left">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistorial.map((entry, index) => {
                const estado = String(entry.value?.estado || '-');
                return (
                  <tr key={entry.key} className={index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-950'}>
                    <td className="border-b border-slate-800 p-2 text-slate-200">
                      {entry.value?.fecha
                        ? new Date(entry.value.fecha).toLocaleString()
                        : new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="border-b border-slate-800 p-2 text-slate-200">
                      <div>{entry.value?.destinatario || '-'}</div>
                      <div className="text-[11px] text-slate-500">{entry.value?.destinatarioTipo || '-'}</div>
                    </td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">{entry.value?.tipo || '-'}</td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">{entry.value?.subcategoria || '-'}</td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">{entry.value?.mode || '-'}</td>
                    <td className="border-b border-slate-800 p-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          estado === 'enviado'
                            ? 'bg-emerald-500/20 text-emerald-100'
                            : estado === 'error'
                            ? 'bg-rose-500/20 text-rose-100'
                            : 'bg-slate-600/30 text-slate-200'
                        }`}
                      >
                        {estado}
                      </span>
                    </td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">{entry.value?.triggeredBy || '-'}</td>
                    <td className="max-w-[360px] border-b border-slate-800 p-2 text-slate-300" title={entry.value?.mensaje || ''}>
                      <div className="line-clamp-2">{entry.value?.mensaje || '-'}</div>
                      {entry.value?.error ? (
                        <div className="mt-1 text-[11px] text-rose-300">{String(entry.value.error)}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
