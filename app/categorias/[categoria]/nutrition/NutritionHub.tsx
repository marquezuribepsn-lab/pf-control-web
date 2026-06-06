"use client";

import { useMemo, useState } from "react";
import { usePlayers } from "../../../../components/PlayersProvider";
import { markManualSaveIntent, useSharedState } from "../../../../components/useSharedState";
import {
  ANTHROPOMETRY_KEY,
  ASSIGNMENTS_KEY,
  CUSTOM_FOODS_KEY,
  HUB_TABS,
  PLANS_KEY,
} from "./constants";
import type {
  AlumnoNutritionAssignment,
  AnthropometryRecord,
  CustomFood,
  NutritionHubTab,
  NutritionPlan,
} from "./types";

import TabPlanes from "./TabPlanes";
import TabAlumnos from "./TabAlumnos";
import TabIA from "./TabIA";
import TabCalculadoras from "./TabCalculadoras";
import TabEstadisticas from "./TabEstadisticas";
import TabRegistros from "./TabRegistros";
import TabAlimentos from "./TabAlimentos";

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-64 rounded-xl bg-slate-800/60" />
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-slate-800/40" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-slate-800/40" />
    </div>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

export default function NutritionHub() {
  const [activeTab, setActiveTab] = useState<NutritionHubTab>("planes");

  // ── Shared state (synced to server + localStorage) ──
  const [planes, setPlanes, planesLoaded] = useSharedState<NutritionPlan[]>([], {
    key: PLANS_KEY,
    legacyLocalStorageKey: PLANS_KEY,
  });

  const [assignments, setAssignments, assignmentsLoaded] = useSharedState<
    AlumnoNutritionAssignment[]
  >([], {
    key: ASSIGNMENTS_KEY,
    legacyLocalStorageKey: ASSIGNMENTS_KEY,
  });

  const [customFoods, setCustomFoods, customFoodsLoaded] = useSharedState<CustomFood[]>([], {
    key: CUSTOM_FOODS_KEY,
    legacyLocalStorageKey: CUSTOM_FOODS_KEY,
  });

  const [anthropometry, setAnthropometry, anthroLoaded] = useSharedState<AnthropometryRecord[]>(
    [],
    { key: ANTHROPOMETRY_KEY }
  );

  // ── Jugadoras list from PlayersProvider (this is the categorías section) ──
  const { jugadoras } = usePlayers();
  const alumnosNombres = useMemo(
    () => jugadoras.map((j) => j.nombre).sort(),
    [jugadoras]
  );

  const loaded = planesLoaded && assignmentsLoaded && customFoodsLoaded && anthroLoaded;

  // ── Save handler exposed globally ──
  function handleSaveAll() {
    markManualSaveIntent(PLANS_KEY);
    markManualSaveIntent(ASSIGNMENTS_KEY);
    markManualSaveIntent(CUSTOM_FOODS_KEY);
    markManualSaveIntent(ANTHROPOMETRY_KEY);
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-100">🥦 Nutrición</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Planes · Asignaciones · IA · Calculadoras · Estadísticas · Registros · Alimentos
          </p>
        </div>
        <button
          onClick={handleSaveAll}
          className="hidden sm:flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20"
        >
          💾 Guardar todo
        </button>
      </div>

      {/* ── Tab nav ── */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {HUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as NutritionHubTab)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-6">
        {!loaded ? (
          <SkeletonLoader />
        ) : (
          <>
            {activeTab === "planes" && (
              <TabPlanes
                planes={Array.isArray(planes) ? planes : []}
                setPlanes={setPlanes}
                assignments={Array.isArray(assignments) ? assignments : []}
                setAssignments={setAssignments}
                customFoods={Array.isArray(customFoods) ? customFoods : []}
                alumnosNombres={alumnosNombres}
              />
            )}
            {activeTab === "alumnos" && (
              <TabAlumnos
                planes={Array.isArray(planes) ? planes : []}
                setPlanes={setPlanes}
                assignments={Array.isArray(assignments) ? assignments : []}
                setAssignments={setAssignments}
                alumnosNombres={alumnosNombres}
                anthropometry={Array.isArray(anthropometry) ? anthropometry : []}
              />
            )}
            {activeTab === "ia" && (
              <TabIA
                planes={Array.isArray(planes) ? planes : []}
                setPlanes={setPlanes}
                alumnosNombres={alumnosNombres}
              />
            )}
            {activeTab === "calculadoras" && <TabCalculadoras />}
            {activeTab === "estadisticas" && (
              <TabEstadisticas
                planes={Array.isArray(planes) ? planes : []}
                assignments={Array.isArray(assignments) ? assignments : []}
                customFoods={Array.isArray(customFoods) ? customFoods : []}
                anthropometry={Array.isArray(anthropometry) ? anthropometry : []}
                alumnosNombres={alumnosNombres}
              />
            )}
            {activeTab === "registros" && (
              <TabRegistros
                anthropometry={Array.isArray(anthropometry) ? anthropometry : []}
                setAnthropometry={setAnthropometry}
                alumnosNombres={alumnosNombres}
              />
            )}
            {activeTab === "alimentos" && (
              <TabAlimentos
                customFoods={Array.isArray(customFoods) ? customFoods : []}
                setCustomFoods={setCustomFoods}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
