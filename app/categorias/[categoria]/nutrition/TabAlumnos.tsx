"use client";

import { useState, useMemo } from "react";
import { markManualSaveIntent } from "../../../../components/useSharedState";
import { ASSIGNMENTS_KEY, PLANS_KEY, GOAL_LABELS, GOAL_COLORS } from "./constants";
import { latestRecord } from "./utils";
import type { AlumnoNutritionAssignment, NutritionHubState } from "./types";

type Props = Pick<
  NutritionHubState,
  "planes" | "setPlanes" | "assignments" | "setAssignments" | "alumnosNombres" | "anthropometry"
>;

export default function TabAlumnos({
  planes,
  setPlanes,
  assignments,
  setAssignments,
  alumnosNombres,
  anthropometry,
}: Props) {
  const [search, setSearch] = useState("");

  // Merge all students: those from AlumnosProvider + any who appear in assignments
  const allAlumnos = useMemo(() => {
    const names = new Set(alumnosNombres);
    assignments.forEach((a) => names.add(a.alumnoNombre));
    return Array.from(names).sort();
  }, [alumnosNombres, assignments]);

  const filtered = allAlumnos.filter((n) =>
    n.toLowerCase().includes(search.toLowerCase())
  );

  // Build quick lookup: alumnoNombre → assigned planId
  const assignmentByAlumno = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments) {
      map.set(a.alumnoNombre, a.planId);
    }
    return map;
  }, [assignments]);

  function handleAssign(alumnoNombre: string, planId: string) {
    markManualSaveIntent(ASSIGNMENTS_KEY);
    // Also update plan's alumnoAsignado
    markManualSaveIntent(PLANS_KEY);

    setAssignments((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const existing = base.findIndex((a) => a.alumnoNombre === alumnoNombre);
      const newAssignment: AlumnoNutritionAssignment = {
        alumnoNombre,
        planId,
        assignedAt: new Date().toISOString(),
      };
      if (existing >= 0) {
        const next = [...base];
        next[existing] = newAssignment;
        return next;
      }
      return [...base, newAssignment];
    });

    setPlanes((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return base.map((p) => {
        if (p.alumnoAsignado === alumnoNombre && p.id !== planId) {
          return { ...p, alumnoAsignado: null, updatedAt: new Date().toISOString() };
        }
        if (p.id === planId) {
          return { ...p, alumnoAsignado: alumnoNombre, updatedAt: new Date().toISOString() };
        }
        return p;
      });
    });
  }

  function handleUnassign(alumnoNombre: string) {
    markManualSaveIntent(ASSIGNMENTS_KEY);
    markManualSaveIntent(PLANS_KEY);

    const currentPlanId = assignmentByAlumno.get(alumnoNombre);
    setAssignments((prev) => prev.filter((a) => a.alumnoNombre !== alumnoNombre));
    if (currentPlanId) {
      setPlanes((prev) =>
        prev.map((p) =>
          p.id === currentPlanId
            ? { ...p, alumnoAsignado: null, updatedAt: new Date().toISOString() }
            : p
        )
      );
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black pf-v2-t">👥 Alumnos y Asignaciones</h2>
        <p className="mt-1 text-sm pf-v2-t-50">
          Asignación de planes nutricionales a cada alumno.
        </p>
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar alumno..."
        className="w-full rounded-xl border pf-v2-b pf-v2-s-deep px-4 py-2.5 text-sm pf-v2-t pf-v2-ph focus:outline-none"
      />

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border pf-v2-b pf-v2-s-deep px-3 py-1 text-xs pf-v2-t-50">
          {allAlumnos.length} alumnos
        </span>
        <span className="rounded-full border pf-v2-b-ok pf-v2-s-ok px-3 py-1 text-xs pf-v2-t-ok">
          {assignments.length} con plan asignado
        </span>
        <span className="rounded-full border pf-v2-b-warn pf-v2-s-warn px-3 py-1 text-xs pf-v2-t-warn">
          {allAlumnos.length - assignments.length} sin plan
        </span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed pf-v2-b p-10 text-center">
          <p className="pf-v2-t-40">No hay alumnos que coincidan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((nombre) => {
            const assignedPlanId = assignmentByAlumno.get(nombre);
            const assignedPlan = planes.find((p) => p.id === assignedPlanId);
            const last = latestRecord(anthropometry, nombre);

            return (
              <div
                key={nombre}
                className="rounded-2xl border pf-v2-b pf-v2-s-deep p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: name + last record */}
                  <div>
                    <h4 className="font-semibold pf-v2-t">{nombre}</h4>
                    {last && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {last.pesoKg && (
                          <span className="text-xs pf-v2-t-40">⚖️ {last.pesoKg} kg</span>
                        )}
                        {last.imc && (
                          <span className="text-xs pf-v2-t-40">IMC {last.imc.toFixed(1)}</span>
                        )}
                        <span className="text-xs pf-v2-t-40">📅 {last.fecha}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: assignment */}
                  <div className="flex items-center gap-2">
                    {assignedPlan ? (
                      <>
                        <div className="rounded-lg border pf-v2-b pf-v2-s-deep px-3 py-1.5 text-sm">
                          <p className="text-xs pf-v2-t-40">Plan asignado</p>
                          <p className="font-medium pf-v2-t">{assignedPlan.nombre}</p>
                          <p className={`text-xs ${GOAL_COLORS[assignedPlan.objetivo]}`}>
                            {GOAL_LABELS[assignedPlan.objetivo]}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnassign(nombre)}
                          className="rounded-lg border pf-v2-b-danger pf-v2-s-danger px-2.5 py-1.5 text-xs font-medium pf-v2-t-danger pf-v2-hover"
                          title="Desasignar plan"
                        >
                          Desasignar
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs pf-v2-t-40">Sin plan asignado</span>
                        {planes.length > 0 && (
                          <AssignPlanDropdown
                            planes={planes}
                            onAssign={(planId) => handleAssign(nombre, planId)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* If assigned: show plan targets */}
                {assignedPlan && (
                  <div className="mt-3 flex flex-wrap gap-3 border-t pf-v2-b pt-3 text-xs pf-v2-t-40">
                    <span>🔥 {assignedPlan.targets.calorias} kcal</span>
                    <span>💪 {assignedPlan.targets.proteinas}g prot</span>
                    <span>🍞 {assignedPlan.targets.carbohidratos}g carbs</span>
                    <span>🫒 {assignedPlan.targets.grasas}g grasas</span>
                    {assignedPlan.comidas.length > 0 && (
                      <span>🍽 {assignedPlan.comidas.length} comidas</span>
                    )}
                  </div>
                )}

                {/* Change plan if already assigned */}
                {assignedPlan && planes.length > 1 && (
                  <div className="mt-2">
                    <AssignPlanDropdown
                      planes={planes.filter((p) => p.id !== assignedPlanId)}
                      label="Cambiar plan"
                      onAssign={(planId) => handleAssign(nombre, planId)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Assign dropdown ──────────────────────────────────────────────────────────

function AssignPlanDropdown({
  planes,
  onAssign,
  label = "Asignar plan",
}: {
  planes: { id: string; nombre: string }[];
  onAssign: (planId: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border pf-v2-b-ok pf-v2-s-ok px-3 py-1.5 text-xs font-medium pf-v2-t-ok pf-v2-hover"
      >
        {label} ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 min-w-[200px] rounded-xl border pf-v2-b pf-v2-s-deep py-1 shadow-xl">
            {planes.map((p) => (
              <button
                key={p.id}
                onClick={() => { onAssign(p.id); setOpen(false); }}
                className="block w-full px-4 py-2 text-left text-sm pf-v2-t pf-v2-hover"
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
