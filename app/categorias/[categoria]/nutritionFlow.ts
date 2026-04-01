export type AssignedClientRow = {
  alumnoNombre: string;
  planId: string;
  assignedAt: string;
  planNombre: string;
  objetivo: string;
  calorias: number;
  updatedAt: string;
};

export function filterAssignedClientRows(rows: AssignedClientRow[], query: string) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) {
    return rows;
  }

  return rows.filter((row) => {
    const content = `${row.alumnoNombre} ${row.planNombre} ${row.objetivo}`.toLowerCase();
    return content.includes(needle);
  });
}

export function parseNutritionDetailFromSearch(search: string) {
  const params = new URLSearchParams(search || "");
  const detail = params.get("detalleCliente") === "1";
  const alumno = params.get("alumno");
  const planId = params.get("plan");

  return {
    isDetailMode: detail && Boolean(planId),
    alumnoNombre: alumno ? decodeURIComponent(alumno) : null,
    planId: planId ? decodeURIComponent(planId) : null,
  };
}

export function buildNutritionDetailUrl(pathname: string, search: string, alumnoNombre: string, planId: string) {
  const params = new URLSearchParams(search || "");
  params.set("detalleCliente", "1");
  params.set("alumno", alumnoNombre);
  params.set("plan", planId);
  return `${pathname}?${params.toString()}`;
}

export function buildNutritionListUrl(pathname: string) {
  return pathname;
}
