"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useMemo, useState } from "react";
import { useEquipos } from "../../components/EquiposProvider";
import { usePlayers } from "../../components/PlayersProvider";
import { useCategories } from "../../components/CategoriesProvider";

type EquipoFormData = {
  nombre: string;
  categoria: string;
  temporada: string;
  descripcion: string;
};

const CARD_TONES = [
  {
    border: "border-cyan-300/26",
    glow: "from-cyan-500/16 via-blue-500/10 to-transparent",
    badge: "border-cyan-200/45 bg-cyan-400/16 text-cyan-100",
  },
  {
    border: "border-emerald-300/24",
    glow: "from-emerald-500/16 via-teal-500/10 to-transparent",
    badge: "border-emerald-200/45 bg-emerald-400/16 text-emerald-100",
  },
  {
    border: "border-violet-300/24",
    glow: "from-violet-500/16 via-fuchsia-500/10 to-transparent",
    badge: "border-violet-200/45 bg-violet-400/16 text-violet-100",
  },
];

const cleanText = (value: string): string => value.trim().replace(/\s+/g, " ");

const normalizeSearch = (value: string): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const initialFormData: EquipoFormData = {
  nombre: "",
  categoria: "",
  temporada: "",
  descripcion: "",
};

export default function EquiposPage() {
  const { equipos, agregarEquipo, editarEquipo, eliminarEquipo } = useEquipos();
  const { jugadoras } = usePlayers();
  const { categorias } = useCategories();

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoEquipo, setEditandoEquipo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [formData, setFormData] = useState<EquipoFormData>(initialFormData);

  const categoriasActivas = useMemo(
    () => categorias.filter((categoria) => categoria.habilitada),
    [categorias]
  );

  const equiposConJugadoras = useMemo(
    () =>
      equipos
        .map((equipo) => ({
          ...equipo,
          jugadoras: jugadoras.filter((jugadora) => jugadora.categoria === equipo.categoria).length,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [equipos, jugadoras]
  );

  const equiposFiltrados = useMemo(() => {
    const query = normalizeSearch(busqueda);
    if (!query) {
      return equiposConJugadoras;
    }

    return equiposConJugadoras.filter((equipo) => {
      const fields = [equipo.nombre, equipo.categoria, equipo.temporada, equipo.descripcion || ""];
      return fields.some((field) => normalizeSearch(field).includes(query));
    });
  }, [equiposConJugadoras, busqueda]);

  const stats = useMemo(() => {
    const totalEquipos = equiposConJugadoras.length;
    const totalJugadoras = equiposConJugadoras.reduce((acc, equipo) => acc + equipo.jugadoras, 0);
    const categoriasCubiertas = new Set(
      equiposConJugadoras
        .map((equipo) => (equipo.categoria || "").trim())
        .filter((categoria) => categoria.length > 0)
    ).size;
    const promedioJugadoras = totalEquipos > 0 ? (totalJugadoras / totalEquipos).toFixed(1) : "0";

    return {
      totalEquipos,
      totalJugadoras,
      categoriasCubiertas,
      promedioJugadoras,
    };
  }, [equiposConJugadoras]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: EquipoFormData = {
      nombre: cleanText(formData.nombre),
      categoria: cleanText(formData.categoria),
      temporada: cleanText(formData.temporada),
      descripcion: cleanText(formData.descripcion),
    };

    if (!payload.nombre || !payload.categoria || !payload.temporada) {
      return;
    }

    if (editandoEquipo) {
      editarEquipo(editandoEquipo, payload);
      setEditandoEquipo(null);
    } else {
      agregarEquipo(payload);
    }
    setFormData(initialFormData);
    setMostrarFormulario(false);
  };

  const handleEdit = (equipo: {
    id: string;
    nombre: string;
    categoria: string;
    temporada: string;
    descripcion?: string;
  }) => {
    setFormData({
      nombre: equipo.nombre,
      categoria: equipo.categoria,
      temporada: equipo.temporada,
      descripcion: equipo.descripcion || "",
    });
    setEditandoEquipo(equipo.id);
    setMostrarFormulario(true);
  };

  const handleCreateMode = () => {
    setEditandoEquipo(null);
    setFormData(initialFormData);
    setMostrarFormulario(true);
  };

  const handleCancelForm = () => {
    setMostrarFormulario(false);
    setEditandoEquipo(null);
    setFormData(initialFormData);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este equipo?")) {
      eliminarEquipo(id);
    }
  };

  return (
    <main className="mx-auto max-w-[1480px] space-y-6 p-6 text-slate-100">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/45 p-6 shadow-[0_20px_80px_rgba(6,182,212,0.14)]">
        <div className="pointer-events-none absolute -left-12 -top-14 h-44 w-44 rounded-full bg-cyan-400/24 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/80">Planificación Estructural</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Equipos</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
              Diseña planteles por categoría y temporada con acceso rápido a detalle y sesiones.
            </p>
          </div>

          <ReliableActionButton
            onClick={handleCreateMode}
            className="rounded-xl border border-cyan-300/35 bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
          >
            Nuevo equipo
          </ReliableActionButton>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Equipos" value={stats.totalEquipos} tone="cyan" />
          <StatTile label="Jugadoras" value={stats.totalJugadoras} tone="emerald" />
          <StatTile label="Categorías" value={stats.categoriasCubiertas} tone="violet" />
          <StatTile label="Promedio" value={stats.promedioJugadoras} tone="amber" suffix="jugadoras/equipo" />
        </div>
      </section>

      {mostrarFormulario && (
        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
          <h2 className="mb-4 text-xl font-bold text-white">
            {editandoEquipo ? "Editar equipo" : "Nuevo equipo"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Nombre
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="rounded-xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Categoría
                <select
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  className="rounded-xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categoriasActivas.map((cat) => (
                    <option key={cat.nombre} value={cat.nombre}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Temporada
                <input
                  type="text"
                  value={formData.temporada}
                  onChange={(e) => setFormData({ ...formData, temporada: e.target.value })}
                  className="rounded-xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200">
                Descripción
              </label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <ReliableActionButton
                type="submit"
                className="rounded-xl border border-cyan-300/35 bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-300"
              >
                {editandoEquipo ? "Actualizar" : "Crear"}
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={handleCancelForm}
                className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white"
              >
                Cancelar
              </ReliableActionButton>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Buscador de equipos</h2>
            <p className="mt-1 text-xs text-slate-400">Filtra por nombre, categoría, temporada o descripción.</p>
          </div>
          <span className="rounded-full border border-cyan-300/35 bg-cyan-500/12 px-3 py-1 text-[11px] font-semibold text-cyan-100">
            {equiposFiltrados.length} resultados
          </span>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar equipo..."
          className="w-full rounded-xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60"
        />
      </section>

      <section>
        {equiposFiltrados.length === 0 ? (
          <div className="rounded-3xl border border-white/12 bg-slate-900/70 p-8 text-center">
            <p className="text-lg font-bold text-slate-100">
              {equiposConJugadoras.length === 0 ? "No hay equipos cargados todavía." : "No encontramos coincidencias para tu búsqueda."}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {equiposConJugadoras.length === 0
                ? "Crea el primer equipo para comenzar a planificar la temporada."
                : "Ajusta el filtro o limpia la búsqueda para volver a ver todos los equipos."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {equiposFiltrados.map((equipo, index) => {
              const tone = CARD_TONES[index % CARD_TONES.length];

              return (
                <article
                  key={equipo.id}
                  className={`relative overflow-hidden rounded-3xl border bg-slate-900/80 p-5 shadow-[0_14px_36px_rgba(2,8,23,0.42)] ${tone.border}`}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow}`} />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/equipos/${encodeURIComponent(equipo.nombre)}`}
                        className="block truncate text-[1.55rem] font-black leading-tight text-white hover:text-cyan-100"
                      >
                        {equipo.nombre}
                      </Link>
                      <p className="mt-1 text-xs text-slate-300">{equipo.jugadoras} jugadoras asociadas</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>
                      {equipo.temporada}
                    </span>
                  </div>

                  <div className="relative mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/20 bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-slate-100">
                      {equipo.categoria}
                    </span>
                  </div>

                  {equipo.descripcion ? (
                    <p className="relative mt-3 line-clamp-2 text-sm text-slate-300">{equipo.descripcion}</p>
                  ) : (
                    <p className="relative mt-3 text-sm text-slate-400">Sin descripción cargada.</p>
                  )}

                  <div className="relative mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`/equipos/${encodeURIComponent(equipo.nombre)}`}
                      className="rounded-xl border border-cyan-300/35 bg-cyan-500/16 px-3 py-2 text-center text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/24"
                    >
                      Ver equipo
                    </Link>
                    <Link
                      href={`/equipos/${encodeURIComponent(equipo.nombre)}/sesiones`}
                      className="rounded-xl border border-emerald-300/35 bg-emerald-500/16 px-3 py-2 text-center text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/24"
                    >
                      Sesiones
                    </Link>
                    <ReliableActionButton
                      onClick={() => handleEdit(equipo)}
                      className="rounded-xl border border-white/25 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Editar
                    </ReliableActionButton>
                    <ReliableActionButton
                      onClick={() => handleDelete(equipo.id)}
                      className="rounded-xl border border-rose-300/35 bg-rose-500/16 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/24"
                    >
                      Eliminar
                    </ReliableActionButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatTile({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: string | number;
  tone: "cyan" | "emerald" | "violet" | "amber";
  suffix?: string;
}) {
  const palette = {
    cyan: "border-cyan-300/35 bg-cyan-500/12 text-cyan-100",
    emerald: "border-emerald-300/35 bg-emerald-500/12 text-emerald-100",
    violet: "border-violet-300/35 bg-violet-500/12 text-violet-100",
    amber: "border-amber-300/35 bg-amber-500/12 text-amber-100",
  };

  return (
    <article className={`rounded-2xl border p-3 shadow-sm ${palette[tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      {suffix ? <p className="text-[10px] text-slate-300">{suffix}</p> : null}
    </article>
  );
}
