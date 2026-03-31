"use client";

import { useEffect, useMemo, useState } from "react";

type RunEntry = {
  key: string;
  createdAt: string;
  value: {
    runId?: string;
    ok?: boolean;
    dryRun?: boolean;
    totals?: {
      matched?: number;
      sent?: number;
      failed?: number;
      skippedByWindow?: number;
    };
    rulesExecuted?: number;
    generatedAt?: string;
    triggeredBy?: string;
    source?: string;
    error?: string | null;
  } | null;
};

type Props = {
  reloadToken?: number;
};

export default function WhatsAppAutomationRunsTable({ reloadToken = 0 }: Props) {
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ok" | "error">("todos");

  const filteredRuns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return runs.filter((entry) => {
      const value = entry.value || {};
      const ok = Boolean(value.ok);

      if (statusFilter === "ok" && !ok) {
        return false;
      }

      if (statusFilter === "error" && ok) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        value.runId,
        value.triggeredBy,
        value.source,
        value.error,
        value.generatedAt,
      ]
        .map((item) => String(item || ""))
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [runs, search, statusFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/whatsapp-automation-runs", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("No se pudieron cargar las corridas automaticas");
        }
        const data = await response.json();
        if (!cancelled) {
          setRuns(Array.isArray(data?.runs) ? data.runs : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las corridas automaticas");
          setRuns([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-white">Ultimas ejecuciones automaticas</h2>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-4">
        <input
          type="text"
          placeholder="Buscar por runId, usuario, error"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 md:col-span-2"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "todos" | "ok" | "error")}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100"
        >
          <option value="todos">Estado: todos</option>
          <option value="ok">OK</option>
          <option value="error">Con error</option>
        </select>
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          Resultados: {filteredRuns.length}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
          Cargando corridas automaticas...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
      ) : filteredRuns.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-400">
          Sin corridas automaticas registradas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-300">
                <th className="border-b border-slate-700 p-2 text-left">Fecha</th>
                <th className="border-b border-slate-700 p-2 text-left">Run ID</th>
                <th className="border-b border-slate-700 p-2 text-left">Disparado por</th>
                <th className="border-b border-slate-700 p-2 text-left">Modo</th>
                <th className="border-b border-slate-700 p-2 text-left">Reglas</th>
                <th className="border-b border-slate-700 p-2 text-left">Matched</th>
                <th className="border-b border-slate-700 p-2 text-left">Enviados</th>
                <th className="border-b border-slate-700 p-2 text-left">Fallidos</th>
                <th className="border-b border-slate-700 p-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((entry, index) => {
                const value = entry.value || {};
                const ok = Boolean(value.ok);
                const totals = value.totals || {};
                const runDate = value.generatedAt || entry.createdAt;

                return (
                  <tr key={entry.key} className={index % 2 === 0 ? "bg-slate-900" : "bg-slate-950"}>
                    <td className="border-b border-slate-800 p-2 text-slate-200">
                      {new Date(runDate).toLocaleString()}
                    </td>
                    <td className="border-b border-slate-800 p-2 text-slate-200">{value.runId || "-"}</td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">
                      <div>{value.triggeredBy || "-"}</div>
                      <div className="text-[11px] text-slate-500">{value.source || "-"}</div>
                    </td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">{value.dryRun ? "dry-run" : "run"}</td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">{Number(value.rulesExecuted || 0)}</td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">{Number(totals.matched || 0)}</td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">{Number(totals.sent || 0)}</td>
                    <td className="border-b border-slate-800 p-2 text-slate-300">{Number(totals.failed || 0)}</td>
                    <td className="border-b border-slate-800 p-2">
                      <div
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          ok ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/20 text-rose-100"
                        }`}
                      >
                        {ok ? "ok" : "error"}
                      </div>
                      {!ok && value.error ? (
                        <div className="mt-1 max-w-[260px] text-[11px] text-rose-300">{String(value.error)}</div>
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
