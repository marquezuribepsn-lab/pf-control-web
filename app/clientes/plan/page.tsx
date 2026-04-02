"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAlumnos } from "../../../components/AlumnosProvider";
import { usePlayers } from "../../../components/PlayersProvider";
import { useSessions } from "../../../components/SessionsProvider";
import { useSharedState } from "../../../components/useSharedState";
import { argentineFoodsBase } from "../../../data/argentineFoods";

type ClienteTipo = "jugadora" | "alumno";
type PlanViewTab = "plan-entrenamiento" | "plan-nutricional";

type ClienteView = {
  id: string;
  tipo: ClienteTipo;
  nombre: string;
  categoria?: string;
};

type NutritionGoal = "mantenimiento" | "recomposicion" | "masa" | "deficit";

type NutritionTargets = {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
};

type NutritionPlan = {
  id: string;
  nombre: string;
  alumnoAsignado: string | null;
  objetivo: NutritionGoal;
  notas: string;
  targets: NutritionTargets;
  comidas: Array<{
    id: string;
    nombre: string;
    items: Array<{
      id: string;
      foodId: string;
      gramos: number;
    }>;
  }>;
  updatedAt: string;
};

type AlumnoNutritionAssignment = {
  alumnoNombre: string;
  planId: string;
  assignedAt: string;
};

type NutritionFood = {
  id: string;
  nombre: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

const NUTRITION_PLANS_KEY = "pf-control-nutricion-planes-v1";
const NUTRITION_ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
const NUTRITION_CUSTOM_FOODS_KEY = "pf-control-nutricion-alimentos-v1";

function safeDecodeParam(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePersonKey(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyMatch(a: string, b: string): boolean {
  const left = normalizePersonKey(a);
  const right = normalizePersonKey(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  const shared = leftTokens.filter((token) => rightTokens.includes(token));

  return shared.length >= 2 || shared.some((token) => token.length >= 5);
}

function nutritionGoalLabel(goal: NutritionGoal): string {
  switch (goal) {
    case "mantenimiento":
      return "Mantenimiento";
    case "recomposicion":
      return "Recomposicion";
    case "masa":
      return "Masa muscular";
    case "deficit":
      return "Deficit";
    default:
      return goal;
  }
}

function buildPlanHref(clientId: string, tab: PlanViewTab): string {
  const params = new URLSearchParams();
  params.set("cliente", clientId);
  params.set("tab", tab);
  return `/clientes/plan?${params.toString()}`;
}

function ClientePlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawClientId = safeDecodeParam(searchParams.get("cliente"));
  const rawTab = safeDecodeParam(searchParams.get("tab"));
  const tab: PlanViewTab = rawTab === "plan-nutricional" ? "plan-nutricional" : "plan-entrenamiento";

  const { jugadoras } = usePlayers();
  const { alumnos } = useAlumnos();
  const { sesiones } = useSessions();
  const [nutritionPlans] = useSharedState<NutritionPlan[]>([], {
    key: NUTRITION_PLANS_KEY,
    legacyLocalStorageKey: NUTRITION_PLANS_KEY,
  });
  const [nutritionAssignments] = useSharedState<AlumnoNutritionAssignment[]>([], {
    key: NUTRITION_ASSIGNMENTS_KEY,
    legacyLocalStorageKey: NUTRITION_ASSIGNMENTS_KEY,
  });
  const [nutritionCustomFoods] = useSharedState<NutritionFood[]>([], {
    key: NUTRITION_CUSTOM_FOODS_KEY,
    legacyLocalStorageKey: NUTRITION_CUSTOM_FOODS_KEY,
  });

  const clientes = useMemo<ClienteView[]>(() => {
    const jugadorasMapped: ClienteView[] = jugadoras.map((jugadora) => ({
      id: `jugadora:${jugadora.nombre}`,
      tipo: "jugadora",
      nombre: jugadora.nombre,
      categoria: jugadora.categoria,
    }));

    const alumnosMapped: ClienteView[] = alumnos.map((alumno) => ({
      id: `alumno:${alumno.nombre}`,
      tipo: "alumno",
      nombre: alumno.nombre,
    }));

    return [...jugadorasMapped, ...alumnosMapped];
  }, [alumnos, jugadoras]);

  const selectedClient = useMemo(
    () => clientes.find((cliente) => cliente.id === rawClientId) || null,
    [clientes, rawClientId]
  );

  const sesionesCliente = useMemo(() => {
    if (!selectedClient) return [];

    return sesiones.filter((sesion) => {
      if (selectedClient.tipo === "jugadora") {
        const porCategoria =
          sesion.asignacionTipo === "jugadoras" &&
          (sesion.categoriaAsignada || "") === (selectedClient.categoria || "");
        const porNombre =
          sesion.asignacionTipo === "jugadoras" &&
          (sesion.jugadoraAsignada || "") === selectedClient.nombre;
        return porCategoria || porNombre;
      }

      return (
        sesion.asignacionTipo === "alumnos" &&
        (sesion.alumnoAsignado || "") === selectedClient.nombre
      );
    });
  }, [selectedClient, sesiones]);

  const nutritionFoodsById = useMemo(() => {
    const mergedFoods: NutritionFood[] = [
      ...(argentineFoodsBase as NutritionFood[]),
      ...nutritionCustomFoods,
    ];
    return new Map(mergedFoods.map((food) => [food.id, food]));
  }, [nutritionCustomFoods]);

  const selectedNutritionAssignment = useMemo(() => {
    if (!selectedClient) return null;
    const clientName = selectedClient.nombre;
    const clientIdName = selectedClient.id.split(":")[1] || "";
    const matches = nutritionAssignments.filter(
      (assignment) =>
        namesLikelyMatch(assignment.alumnoNombre, clientName) ||
        namesLikelyMatch(assignment.alumnoNombre, clientIdName)
    );

    if (matches.length === 0) return null;

    return matches
      .slice()
      .sort(
        (a, b) =>
          new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()
      )[0];
  }, [nutritionAssignments, selectedClient]);

  const selectedNutritionPlan = useMemo(() => {
    if (!selectedClient) return null;

    if (selectedNutritionAssignment) {
      const assigned =
        nutritionPlans.find((plan) => plan.id === selectedNutritionAssignment.planId) || null;
      if (assigned) {
        return assigned;
      }
    }

    const clientName = selectedClient.nombre;
    const clientIdName = selectedClient.id.split(":")[1] || "";

    return (
      nutritionPlans
        .filter(
          (plan) =>
            namesLikelyMatch(plan.alumnoAsignado || "", clientName) ||
            namesLikelyMatch(plan.alumnoAsignado || "", clientIdName)
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        )[0] || null
    );
  }, [nutritionPlans, selectedClient, selectedNutritionAssignment]);

  const selectedNutritionIntake = useMemo(() => {
    if (!selectedNutritionPlan) {
      return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
    }

    const totals = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };

    for (const meal of selectedNutritionPlan.comidas || []) {
      for (const item of meal.items || []) {
        const food = nutritionFoodsById.get(item.foodId);
        if (!food) continue;
        const ratio = Math.max(0, Number(item.gramos) || 0) / 100;
        totals.calorias += food.kcalPer100g * ratio;
        totals.proteinas += food.proteinPer100g * ratio;
        totals.carbohidratos += food.carbsPer100g * ratio;
        totals.grasas += food.fatPer100g * ratio;
      }
    }

    return {
      calorias: Math.round(totals.calorias * 10) / 10,
      proteinas: Math.round(totals.proteinas * 10) / 10,
      carbohidratos: Math.round(totals.carbohidratos * 10) / 10,
      grasas: Math.round(totals.grasas * 10) / 10,
    };
  }, [nutritionFoodsById, selectedNutritionPlan]);

  const backHref = selectedClient
    ? `/clientes/ficha/${encodeURIComponent(selectedClient.id)}/datos`
    : "/clientes";

  const navigateWithFallback = (href: string) => {
    if (typeof window === "undefined") {
      router.push(href);
      return;
    }

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    router.push(href);

    window.setTimeout(() => {
      const nextUrl = `${window.location.pathname}${window.location.search}`;
      if (nextUrl === currentUrl) {
        window.location.assign(href);
      }
    }, 180);
  };

  if (!selectedClient) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-slate-100">
        <section className="rounded-3xl border border-amber-300/30 bg-amber-500/10 p-6">
          <h1 className="text-2xl font-black text-white">Plan del cliente</h1>
          <p className="mt-2 text-sm text-amber-100">
            No se encontro el cliente solicitado o faltan parametros de navegacion.
          </p>
          <Link
            href="/clientes"
            className="mt-4 inline-flex rounded-xl border border-amber-200/40 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/10"
          >
            Volver a Clientes
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6 text-slate-100">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-900 via-cyan-950/45 to-slate-900 p-6 shadow-[0_20px_70px_rgba(6,182,212,0.12)]">
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-8 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/80">Vista dedicada</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Plan de {selectedClient.nombre}</h1>
            <p className="mt-2 text-sm text-slate-200/90">
              Esta pantalla muestra el plan sin mezclarlo con la ficha general del cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateWithFallback(backHref)}
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Volver a ficha
          </button>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2">
          <Link
            href={buildPlanHref(selectedClient.id, "plan-entrenamiento")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              tab === "plan-entrenamiento"
                ? "border-cyan-200/55 bg-cyan-300 text-slate-950"
                : "border-white/20 bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Plan entrenamiento
          </Link>
          <Link
            href={buildPlanHref(selectedClient.id, "plan-nutricional")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              tab === "plan-nutricional"
                ? "border-cyan-200/55 bg-cyan-300 text-slate-950"
                : "border-white/20 bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Plan nutricional
          </Link>
        </div>
      </section>

      {tab === "plan-entrenamiento" ? (
        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xl font-black text-white">Plan de entrenamiento</h2>
            <Link
              href="/sesiones"
              className="rounded-lg border border-cyan-300/35 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
            >
              Gestionar sesiones
            </Link>
          </div>

          {sesionesCliente.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
              No hay sesiones vinculadas para este cliente todavia.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sesionesCliente.map((sesion) => (
                <article key={sesion.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-lg font-bold text-white">{sesion.titulo}</p>
                  <p className="mt-1 text-sm text-slate-300">{sesion.objetivo}</p>
                  <p className="mt-2 text-xs font-semibold text-cyan-100">
                    {sesion.duracion} min · {sesion.bloques.length} bloques
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
          <h2 className="text-xl font-black text-white">Plan nutricional</h2>
          {selectedNutritionPlan ? (
            <>
              <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-100">Plan asignado</p>
                    <p className="text-lg font-black text-white">{selectedNutritionPlan.nombre}</p>
                  </div>
                  <p className="text-xs text-slate-300">
                    Asignado: {new Date(selectedNutritionAssignment?.assignedAt || selectedNutritionPlan.updatedAt).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">Objetivo</p>
                    <p className="font-bold text-cyan-100">{nutritionGoalLabel(selectedNutritionPlan.objetivo)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">Kcal objetivo</p>
                    <p className="font-bold text-white">{selectedNutritionPlan.targets.calorias}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">P/C/G objetivo</p>
                    <p className="font-bold text-white">
                      {selectedNutritionPlan.targets.proteinas} / {selectedNutritionPlan.targets.carbohidratos} / {selectedNutritionPlan.targets.grasas} g
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">P/C/G del plan</p>
                    <p className="font-bold text-emerald-100">
                      {selectedNutritionIntake.proteinas} / {selectedNutritionIntake.carbohidratos} / {selectedNutritionIntake.grasas} g
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {selectedNutritionPlan.comidas.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                    El plan no tiene comidas cargadas todavia.
                  </p>
                ) : (
                  selectedNutritionPlan.comidas.map((meal) => (
                    <article key={meal.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="font-semibold text-white">{meal.nombre}</p>
                      {meal.items.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-400">Sin alimentos cargados.</p>
                      ) : (
                        <div className="mt-2 space-y-1 text-sm">
                          {meal.items.map((item) => {
                            const food = nutritionFoodsById.get(item.foodId);
                            return (
                              <p key={item.id} className="text-slate-200">
                                • {food?.nombre || "Alimento no encontrado"} - {item.gramos} g
                              </p>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold">Este cliente aun no tiene un plan nutricional asignado.</p>
              <p className="mt-1 text-amber-50/90">
                Puedes asignarlo desde el modulo de nutricion para verlo aqui.
              </p>
              <Link
                href="/categorias/Nutricion"
                className="mt-3 inline-flex rounded-lg border border-amber-200/40 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/10"
              >
                Ir a Nutricion
              </Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default function ClientePlanPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl p-6 text-slate-100">
          <section className="rounded-3xl border border-cyan-200/20 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-300">Cargando plan del cliente...</p>
          </section>
        </main>
      }
    >
      <ClientePlanContent />
    </Suspense>
  );
}
