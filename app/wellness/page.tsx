"use client";

import { useWellness } from "../../components/WellnessProvider";
import type { WellnessItem } from "../../data/mockData";

export default function WellnessPage() {
  const { wellness } = useWellness();

  const wellnessList: WellnessItem[] = Array.isArray(wellness) ? wellness : [];

  const promedio =
    wellnessList.length > 0
      ? wellnessList.reduce(
          (acc: number, item: WellnessItem) => acc + item.bienestar,
          0
        ) / wellnessList.length
      : 0;

  const jugadorasLimitadas = wellnessList.filter(
    (item: WellnessItem) => item.disponibilidad !== "Disponible"
  ).length;

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Wellness</h1>
        <p className="text-sm text-neutral-600">
          Estado diario del plantel: bienestar, fatiga, dolor y disponibilidad.
        </p>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Registros cargados</p>
          <h2 className="mt-2 text-2xl font-semibold">{wellnessList.length}</h2>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Promedio bienestar</p>
          <h2 className="mt-2 text-2xl font-semibold">
            {promedio.toFixed(1)}
          </h2>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Jugadoras limitadas</p>
          <h2 className="mt-2 text-2xl font-semibold">{jugadorasLimitadas}</h2>
        </div>
      </section>

      <section className="grid gap-4">
        {wellnessList.map((item: WellnessItem) => (
          <div
            key={`${item.nombre}-${item.comentario}`}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{item.nombre}</h2>
                <p className="text-sm text-neutral-600">
                  {item.disponibilidad}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">Bienestar</p>
                  <p className="text-lg font-semibold">{item.bienestar}</p>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">Fatiga</p>
                  <p className="text-lg font-semibold">{item.fatiga}</p>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">Dolor</p>
                  <p className="text-lg font-semibold">{item.dolor}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 p-3">
              <p className="text-xs text-neutral-500">Comentario</p>
              <p className="text-sm text-neutral-700">{item.comentario}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}