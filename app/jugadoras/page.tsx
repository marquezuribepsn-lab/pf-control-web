"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import Link from "@/components/ReliableLink";
import { useContext, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlayersContext } from "../../components/PlayersProvider";
import { CategoriesContext } from "../../components/CategoriesProvider";

const INPUT_CLS =
  "w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-3 pf-v2-t pf-v2-ph outline-none transition";
const LABEL_CLS = "mb-1 block text-sm font-medium pf-v2-t-70";

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
    <div className="pf-v2-page">
      <section className="pf-v2-hero-block">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pf-v2-eyebrow">Gestión del plantel</span>
            <h1 className="pf-v2-h1" style={{ fontSize: 32 }}>Nueva jugadora</h1>
            <p className="pf-v2-muted" style={{ marginTop: 8 }}>Carga de datos básicos del plantel.</p>
          </div>
          <Link
            href={form.categoria ? `/categorias/${encodeURIComponent(form.categoria)}` : "/categorias"}
            className="pf-v2-btn pf-v2-btn-2"
          >
            ← Volver
          </Link>
        </div>
      </section>

      {guardado && (
        <div className="mb-4 rounded-xl border pf-v2-b-ok pf-v2-s-ok px-4 py-3 text-sm font-medium pf-v2-t-ok">
          ✅ Jugadora guardada correctamente. Redirigiendo…
        </div>
      )}

      <form onSubmit={handleSubmit} className="pf-v2-card">
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
            className="pf-v2-btn pf-v2-btn-2"
          >
            Cancelar
          </Link>
          <ReliableActionButton
            type="submit"
            className="pf-v2-btn"
            disabled={guardado}
          >
            Guardar jugadora
          </ReliableActionButton>
        </div>
      </form>
    </div>
  );
}
