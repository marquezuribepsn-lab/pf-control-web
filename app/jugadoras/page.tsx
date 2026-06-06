"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlayersContext } from "../../components/PlayersProvider";
import { CategoriesContext } from "../../components/CategoriesProvider";

const INPUT_CLS =
  "w-full rounded-xl border border-white/[0.1] bg-[#0e1012] px-4 py-3 text-white/85 placeholder:text-white/25 outline-none focus:border-cyan-400/40 focus:bg-[#111417] transition";
const LABEL_CLS = "mb-1 block text-sm font-medium text-white/75";

export default function NuevaJugadoraPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { agregarJugadora } = useContext(PlayersContext)!;
  const { categorias } = useContext(CategoriesContext)!;

  const categoriaInicial = useMemo(
    () => searchParams.get("categoria") || "Primera",
    [searchParams]
  );

  const [form, setForm] = useState({
    nombre: "",
    fechaNacimiento: "",
    altura: "",
    peso: "",
    deporte: "Fútbol",
    categoria: categoriaInicial,
    club: "",
    objetivo: "",
    posicion: "",
    observaciones: "",
  });

  const [guardado, setGuardado] = useState(false);

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;

    agregarJugadora({
      nombre: form.nombre.trim(),
      fechaNacimiento: form.fechaNacimiento,
      altura: form.altura,
      peso: form.peso,
      deporte: form.deporte,
      categoria: form.categoria,
      club: form.club,
      objetivo: form.objetivo,
      posicion: form.posicion,
      observaciones: form.observaciones,
      wellness: 7,
      carga: 0,
    });

    setGuardado(true);
    // Redirect to the category page after save
    setTimeout(() => {
      router.push(`/categorias/${encodeURIComponent(form.categoria)}`);
    }, 800);
  }

  const categoriasHabilitadas = categorias.filter((c) => c.habilitada);

  return (
    <main className="relative mx-auto max-w-4xl p-6 text-slate-100">
      <section className="pf-page-hero mb-6">
        <div className="pf-blob pf-blob--tl" />
        <div className="pf-blob pf-blob--br" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="pf-page-hero-badge">👤 Gestión del plantel</p>
            <h1 className="pf-page-hero-title">Nueva jugadora</h1>
            <p className="pf-page-hero-sub">Carga de datos básicos del plantel.</p>
          </div>
          <Link
            href={form.categoria ? `/categorias/${encodeURIComponent(form.categoria)}` : "/categorias"}
            className="pf-btn pf-btn--ghost"
          >
            ← Volver
          </Link>
        </div>
      </section>

      {guardado && (
        <div className="mb-4 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
          ✅ Jugadora guardada correctamente. Redirigiendo…
        </div>
      )}

      <form onSubmit={handleSubmit} className="pf-card rounded-2xl border p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={LABEL_CLS}>Nombre completo *</label>
            <input
              value={form.nombre}
              onChange={(e) => updateField("nombre", e.target.value)}
              className={INPUT_CLS}
              placeholder="Ej: Sofía Gómez"
              required
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Categoría</label>
            <select
              value={form.categoria}
              onChange={(e) => updateField("categoria", e.target.value)}
              className={INPUT_CLS}
            >
              {/* Siempre incluimos la categoría actual para no romper el valor seleccionado */}
              {categoriasHabilitadas.length === 0 && (
                <option value="">Sin categorías habilitadas</option>
              )}
              {categoriasHabilitadas.map((cat) => (
                <option key={cat.nombre} value={cat.nombre}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLS}>Posición</label>
            <input
              value={form.posicion}
              onChange={(e) => updateField("posicion", e.target.value)}
              className={INPUT_CLS}
              placeholder="Ej: Volante"
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Fecha de nacimiento</label>
            <input
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => updateField("fechaNacimiento", e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Deporte</label>
            <input
              value={form.deporte}
              onChange={(e) => updateField("deporte", e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Altura (cm)</label>
            <input
              value={form.altura}
              onChange={(e) => updateField("altura", e.target.value)}
              className={INPUT_CLS}
              placeholder="Ej: 168"
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Peso (kg)</label>
            <input
              value={form.peso}
              onChange={(e) => updateField("peso", e.target.value)}
              className={INPUT_CLS}
              placeholder="Ej: 60"
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Club</label>
            <input
              value={form.club}
              onChange={(e) => updateField("club", e.target.value)}
              className={INPUT_CLS}
              placeholder="Ej: Club Atlético Ejemplo"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={LABEL_CLS}>Objetivo</label>
          <input
            value={form.objetivo}
            onChange={(e) => updateField("objetivo", e.target.value)}
            className={INPUT_CLS}
            placeholder="Ej: Potencia y prevención"
          />
        </div>

        <div className="mt-4">
          <label className={LABEL_CLS}>Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={(e) => updateField("observaciones", e.target.value)}
            className={`min-h-[100px] ${INPUT_CLS}`}
            placeholder="Notas generales, lesiones previas, etc."
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Link
            href={form.categoria ? `/categorias/${encodeURIComponent(form.categoria)}` : "/categorias"}
            className="pf-btn pf-btn--ghost"
          >
            Cancelar
          </Link>
          <ReliableActionButton
            type="submit"
            className="pf-btn pf-btn--primary"
            disabled={guardado}
          >
            Guardar jugadora
          </ReliableActionButton>
        </div>
      </form>
    </main>
  );
}
