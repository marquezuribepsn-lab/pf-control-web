import assert from "node:assert/strict";

import {
  buildNutritionDetailUrl,
  buildNutritionListUrl,
  filterAssignedClientRows,
  parseNutritionDetailFromSearch,
  type AssignedClientRow,
} from "../app/categorias/[categoria]/nutritionFlow";

function run() {
  const rows: AssignedClientRow[] = [
    {
      alumnoNombre: "Ana Perez",
      planId: "plan-1",
      assignedAt: "2026-03-21T10:00:00.000Z",
      planNombre: "Plan deficit 1",
      objetivo: "deficit",
      calorias: 1850,
      updatedAt: "2026-03-21T10:00:00.000Z",
    },
    {
      alumnoNombre: "Lucia Gomez",
      planId: "plan-2",
      assignedAt: "2026-03-21T10:00:00.000Z",
      planNombre: "Plan masa 2",
      objetivo: "masa",
      calorias: 2400,
      updatedAt: "2026-03-21T10:00:00.000Z",
    },
  ];

  const filteredByName = filterAssignedClientRows(rows, "ana");
  assert.equal(filteredByName.length, 1, "Buscador por nombre debe devolver una coincidencia");
  assert.equal(filteredByName[0].planId, "plan-1", "Plan filtrado por nombre incorrecto");

  const filteredByGoal = filterAssignedClientRows(rows, "masa");
  assert.equal(filteredByGoal.length, 1, "Buscador por objetivo debe devolver una coincidencia");
  assert.equal(filteredByGoal[0].planId, "plan-2", "Plan filtrado por objetivo incorrecto");

  const detailUrl = buildNutritionDetailUrl("/categorias/Nutricion", "?foo=bar", "Ana Perez", "plan-1");
  assert.ok(detailUrl.includes("detalleCliente=1"), "URL de detalle debe incluir detalleCliente");
  assert.ok(detailUrl.includes("alumno=Ana+Perez"), "URL de detalle debe incluir alumno");
  assert.ok(detailUrl.includes("plan=plan-1"), "URL de detalle debe incluir plan");

  const parsedDetail = parseNutritionDetailFromSearch("?detalleCliente=1&alumno=Ana+Perez&plan=plan-1");
  assert.equal(parsedDetail.isDetailMode, true, "Parseo de detalle debe activar modo detalle");
  assert.equal(parsedDetail.alumnoNombre, "Ana Perez", "Parseo de alumno incorrecto");
  assert.equal(parsedDetail.planId, "plan-1", "Parseo de plan incorrecto");

  const parsedList = parseNutritionDetailFromSearch("");
  assert.equal(parsedList.isDetailMode, false, "Sin query no debe activar modo detalle");

  const listUrl = buildNutritionListUrl("/categorias/Nutricion");
  assert.equal(listUrl, "/categorias/Nutricion", "URL de listado incorrecta");

  console.log("Nutrition flow tests: OK");
}

run();
