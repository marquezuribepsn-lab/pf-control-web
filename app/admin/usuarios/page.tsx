"use client";

import { useEffect, useMemo, useState } from "react";

type AccessOption = {
  href: string;
  label: string;
  category: string;
};

type Colaborador = {
  id: string;
  email: string;
  role: "ADMIN" | "COLABORADOR" | "CLIENTE";
  estado?: string;
  nombreCompleto?: string;
  puedeEditarRegistros?: boolean;
  puedeEditarPlanes?: boolean;
  puedeVerTodosAlumnos?: boolean;
  permisosGranulares?: {
    accesos?: Record<string, boolean>;
    [key: string]: unknown;
  } | null;
};

type ColaboradorDraft = {
  id: string;
  email: string;
  nombreCompleto: string;
  estado: string;
  puedeEditarRegistros: boolean;
  puedeEditarPlanes: boolean;
  puedeVerTodosAlumnos: boolean;
  accesos: Record<string, boolean>;
  permisosGranulares: Record<string, unknown>;
};

const ACCESS_OPTIONS: AccessOption[] = [
  { href: "/plantel", label: "Plantel", category: "Base" },
  { href: "/semana", label: "Semana", category: "Planificacion" },
  { href: "/sesiones", label: "Sesiones", category: "Planificacion" },
  { href: "/asistencias", label: "Asistencias", category: "Seguimiento" },
  { href: "/ejercicios", label: "Ejercicios", category: "Biblioteca" },
  { href: "/registros", label: "Registros", category: "Seguimiento" },
  { href: "/categorias", label: "Categorias", category: "Catalogos" },
  { href: "/deportes", label: "Deportes", category: "Catalogos" },
  { href: "/equipos", label: "Equipos", category: "Catalogos" },
  { href: "/clientes", label: "Clientes", category: "Clientes" },
];

const CATEGORY_ACCESS_HREFS = ["/categorias", "/deportes", "/equipos"];

const ALL_ACCESS_TRUE = ACCESS_OPTIONS.reduce<Record<string, boolean>>((acc, item) => {
  acc[item.href] = true;
  return acc;
}, {});

function normalizeAccessMap(raw: unknown): Record<string, boolean> {
  const result = { ...ALL_ACCESS_TRUE };

  if (!raw || typeof raw !== "object") {
    return result;
  }

  const input = raw as Record<string, unknown>;
  for (const option of ACCESS_OPTIONS) {
    const maybe = input[option.href];
    if (typeof maybe === "boolean") {
      result[option.href] = maybe;
    }
  }

  return result;
}

function mapColaboradorToDraft(colab: Colaborador): ColaboradorDraft {
  const permisosGranulares =
    colab.permisosGranulares && typeof colab.permisosGranulares === "object"
      ? { ...colab.permisosGranulares }
      : {};

  const accesos = normalizeAccessMap(colab.permisosGranulares?.accesos);

  return {
    id: colab.id,
    email: colab.email,
    nombreCompleto: String(colab.nombreCompleto || "Sin nombre"),
    estado: String(colab.estado || "activo"),
    puedeEditarRegistros: Boolean(colab.puedeEditarRegistros),
    puedeEditarPlanes: Boolean(colab.puedeEditarPlanes),
    puedeVerTodosAlumnos: Boolean(colab.puedeVerTodosAlumnos),
    accesos,
    permisosGranulares,
  };
}

export default function AdminUsuariosPermisosPage() {
  const [items, setItems] = useState<ColaboradorDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setMessage(null);

        const res = await fetch("/api/admin/colaboradores", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar colaboradores");
        }

        const colaboradores = Array.isArray(data?.colaboradores) ? data.colaboradores : [];
        const onlyColaboradores = colaboradores.filter((c: Colaborador) => c.role === "COLABORADOR");

        if (!cancelled) {
          setItems(onlyColaboradores.map(mapColaboradorToDraft));
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al cargar permisos" });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter(
      (item) => item.nombreCompleto.toLowerCase().includes(q) || item.email.toLowerCase().includes(q)
    );
  }, [items, search]);

  const updateItem = (id: string, updater: (prev: ColaboradorDraft) => ColaboradorDraft) => {
    setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const setAllAccess = (id: string, value: boolean) => {
    updateItem(id, (item) => {
      const next = { ...item.accesos };
      for (const option of ACCESS_OPTIONS) {
        next[option.href] = value;
      }
      return { ...item, accesos: next };
    });
  };

  const saveItem = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;

    const allCategoryAccessBlocked = CATEGORY_ACCESS_HREFS.every(
      (href) => current.accesos[href] === false
    );

    if (allCategoryAccessBlocked) {
      setMessage({
        type: "error",
        text: "Debes dejar habilitada al menos una categoria (Categorias, Deportes o Equipos).",
      });
      return;
    }

    try {
      setSavingId(id);
      setMessage(null);

      const payload = {
        puedeEditarRegistros: current.puedeEditarRegistros,
        puedeEditarPlanes: current.puedeEditarPlanes,
        puedeVerTodosAlumnos: current.puedeVerTodosAlumnos,
        permisosGranulares: {
          ...current.permisosGranulares,
          accesos: current.accesos,
        },
      };

      const res = await fetch(`/api/admin/colaboradores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudieron guardar los permisos");
      }

      const updated = mapColaboradorToDraft(data.colaborador as Colaborador);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setMessage({ type: "success", text: `Permisos actualizados: ${updated.nombreCompleto}` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al guardar" });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/40 border-t-cyan-300" />
          <p className="mt-4 text-sm text-slate-300">Cargando permisos de colaboradores...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Usuarios y permisos</h1>
          <p className="mt-1 text-sm text-slate-300">
            Ajusta solo permisos de colaboradores: edicion y acceso por apartados.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-300">Buscar colaborador</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o email"
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
          />
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm font-semibold ${
            message.type === "success"
              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
              : "border-rose-400/30 bg-rose-500/15 text-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((item) => (
          <section key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white">{item.nombreCompleto}</h2>
                <p className="text-sm text-slate-300">{item.email}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  item.estado === "suspendido"
                    ? "bg-rose-500/20 text-rose-200"
                    : "bg-emerald-500/20 text-emerald-200"
                }`}
              >
                {item.estado === "suspendido" ? "Suspendido" : "Activo"}
              </span>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <ToggleChip
                label="Puede editar registros"
                checked={item.puedeEditarRegistros}
                onToggle={(checked) => updateItem(item.id, (prev) => ({ ...prev, puedeEditarRegistros: checked }))}
              />
              <ToggleChip
                label="Puede editar planes"
                checked={item.puedeEditarPlanes}
                onToggle={(checked) => updateItem(item.id, (prev) => ({ ...prev, puedeEditarPlanes: checked }))}
              />
              <ToggleChip
                label="Puede ver todos los alumnos"
                checked={item.puedeVerTodosAlumnos}
                onToggle={(checked) => updateItem(item.id, (prev) => ({ ...prev, puedeVerTodosAlumnos: checked }))}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-100">Acceso a categorias y apartados</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAllAccess(item.id, true)}
                    className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200"
                  >
                    Dar todo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllAccess(item.id, false)}
                    className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-200"
                  >
                    Quitar todo
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ACCESS_OPTIONS.map((option) => (
                  <label
                    key={option.href}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{option.label}</p>
                      <p className="text-[11px] text-slate-400">{option.category}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(item.accesos[option.href])}
                      onChange={(e) =>
                        updateItem(item.id, (prev) => ({
                          ...prev,
                          accesos: { ...prev.accesos, [option.href]: e.target.checked },
                        }))
                      }
                      className="h-4 w-4"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={savingId === item.id || item.estado === "suspendido"}
                onClick={() => saveItem(item.id)}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingId === item.id ? "Guardando permisos..." : "Guardar permisos"}
              </button>
            </div>
          </section>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
          No se encontraron colaboradores para mostrar.
        </div>
      )}
    </main>
  );
}

function ToggleChip({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}
