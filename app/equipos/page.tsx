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
    border: "pf-v2-b-accent",
    glow: "",
    badge: "pf-v2-b-accent pf-v2-s-accent pf-v2-t-accent",
  },
  {
    border: "pf-v2-b-ok",
    glow: "",
    badge: "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok",
  },
  {
    border: "pf-v2-b-violet",
    glow: "",
    badge: "pf-v2-b-violet pf-v2-s-violet pf-v2-t-violet",
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
    <div className="pf-v2-page">
      <section className="pf-v2-hero-block">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pf-v2-eyebrow">Planificación Estructural</span>
            <h1 className="pf-v2-h1" style={{ fontSize: 32 }}>Equipos</h1>
            <p className="pf-v2-muted" style={{ marginTop: 8 }}>Diseña planteles por categoría y temporada con acceso rápido a detalle y sesiones.</p>
          </div>
          <ReliableActionButton onClick={handleCreateMode} className="pf-v2-btn">
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
        <section className="pf-v2-card">
          <h2 className="mb-4 text-xl font-bold pf-v2-t">
            {editandoEquipo ? "Editar equipo" : "Nuevo equipo"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="pf-v2-field">
                Nombre
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="pf-v2-input"
                  required
                />
              </label>

              <label className="pf-v2-field">
                Categoría
                <select
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  className="pf-v2-input"
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

              <label className="pf-v2-field">
                Temporada
                <input
                  type="text"
                  value={formData.temporada}
                  onChange={(e) => setFormData({ ...formData, temporada: e.target.value })}
                  className="pf-v2-input"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium pf-v2-t-70">
                Descripción
              </label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="mt-1 block w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-2.5 pf-v2-t pf-v2-ph outline-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <ReliableActionButton
                type="submit"
                className="pf-v2-btn"
              >
                {editandoEquipo ? "Actualizar" : "Crear"}
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={handleCancelForm}
                className="pf-v2-input"
              >
                Cancelar
              </ReliableActionButton>
            </div>
          </form>
        </section>
      )}

      <section className="pf-v2-card">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="pf-v2-h2">Buscador de equipos</h2>
            <p className="mt-1 text-xs pf-v2-t-40">Filtra por nombre, categoría, temporada o descripción.</p>
          </div>
          <span className="rounded-full border pf-v2-b-accent pf-v2-s-accent px-3 py-1 text-[11px] font-semibold pf-v2-t-accent">
            {equiposFiltrados.length} resultados
          </span>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar equipo..."
          className="pf-v2-input"
        />
      </section>

      <section>
        {equiposFiltrados.length === 0 ? (
          <div className="pf-v2-card">
            <p className="pf-v2-h2">
              {equiposConJugadoras.length === 0 ? "No hay equipos cargados todavía." : "No encontramos coincidencias para tu búsqueda."}
            </p>
            <p className="pf-v2-muted">
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
                  className="pf-v2-card" style={{ position: "relative", overflow: "hidden" }}
                >
                  <div className={`pointer-events-none absolute inset-0${tone.glow}`} />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/equipos/${encodeURIComponent(equipo.nombre)}`}
                        className="block truncate text-[1.55rem] font-black leading-tight pf-v2-t"
                      >
                        {equipo.nombre}
                      </Link>
                      <p className="mt-1 text-xs pf-v2-t-70">{equipo.jugadoras} jugadoras asociadas</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold${tone.badge}`}>
                      {equipo.temporada}
                    </span>
                  </div>

                  <div className="relative mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border pf-v2-b-hi pf-v2-s-deep px-2.5 py-1 text-[11px] font-semibold pf-v2-t-70">
                      {equipo.categoria}
                    </span>
                  </div>

                  {equipo.descripcion ? (
                    <p className="relative mt-3 line-clamp-2 text-sm pf-v2-t-70">{equipo.descripcion}</p>
                  ) : (
                    <p className="relative mt-3 text-sm pf-v2-t-40">Sin descripción cargada.</p>
                  )}

                  <div className="relative mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`/equipos/${encodeURIComponent(equipo.nombre)}`}
                      className="rounded-xl border pf-v2-b-accent pf-v2-s-accent px-3 py-2 text-center text-xs font-semibold pf-v2-t-accent transition pf-v2-hover"
                    >
                      Ver equipo
                    </Link>
                    <Link
                      href={`/equipos/${encodeURIComponent(equipo.nombre)}/sesiones`}
                      className="rounded-xl border pf-v2-b-ok pf-v2-s-ok px-3 py-2 text-center text-xs font-semibold pf-v2-t-ok transition pf-v2-hover"
                    >
                      Sesiones
                    </Link>
                    <ReliableActionButton
                      onClick={() => handleEdit(equipo)}
                      className="pf-v2-input"
                    >
                      Editar
                    </ReliableActionButton>
                    <ReliableActionButton
                      onClick={() => handleDelete(equipo.id)}
                      className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-3 py-2 text-xs font-semibold pf-v2-t-danger pf-v2-hover"
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
    </div>
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
    cyan: "pf-v2-b-accent pf-v2-s-accent pf-v2-t-accent",
    emerald: "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok",
    violet: "pf-v2-b-violet pf-v2-s-violet pf-v2-t-violet",
    amber: "pf-v2-b-warn pf-v2-s-warn pf-v2-t-warn",
  };

  return (
    <article className={`rounded-2xl border p-3 ${palette[tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] pf-v2-t-40">{label}</p>
      <p className="mt-1 text-2xl font-black pf-v2-t">{value}</p>
      {suffix ? <p className="text-[10px] pf-v2-t-50">{suffix}</p> : null}
    </article>
  );
}
