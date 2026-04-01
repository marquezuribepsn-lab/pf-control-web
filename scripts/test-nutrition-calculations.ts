import assert from "node:assert/strict";

import {
  buildMealDistribution,
  calculateAdvancedTargets,
  calculateRiskProfile,
  calculateTargets,
  createMealNames,
  parseKeywords,
  roundValue,
  timeToMinutes,
} from "../app/categorias/[categoria]/nutritionCalculations";

function run() {
  const base = calculateTargets({
    sexo: "femenino",
    edad: 30,
    pesoKg: 62,
    alturaCm: 167,
    actividad: "moderado",
    objetivo: "mantenimiento",
  });

  assert.ok(base.calorias > 1500 && base.calorias < 2800, "Calorias base fuera de rango razonable");
  assert.ok(base.proteinas > 80, "Proteinas base demasiado bajas");

  const advanced = calculateAdvancedTargets({
    sexo: "masculino",
    edad: "28",
    pesoKg: "78",
    alturaCm: "178",
    actividad: "alto",
    objetivo: "masa",
    trainingSessionsPerDay: "2",
    trainingFocus: "fuerza",
    trainingTime: "tarde",
    wakeUpTime: "06:30",
    sleepTime: "22:45",
    preferredMeals: "5",
    anamnesis: "sin observaciones",
    enfermedades: ["ninguna"],
    medicamentos: "",
    alergias: "",
    foodLikes: "pollo, arroz",
    foodDislikes: "",
    cinturaCm: "84",
    caderaCm: "98",
    cuelloCm: "38",
    brazoCm: "34",
    musloCm: "58",
  });

  assert.ok(advanced.targets.calorias > 2200, "Calorias avanzadas para masa demasiado bajas");
  assert.ok(advanced.imc > 20 && advanced.imc < 30, "IMC avanzado fuera de rango esperado");

  const risk = calculateRiskProfile({
    sexo: "femenino",
    edad: "42",
    pesoKg: "82",
    alturaCm: "160",
    actividad: "ligero",
    objetivo: "deficit",
    trainingSessionsPerDay: "1",
    trainingFocus: "mixto",
    trainingTime: "noche",
    wakeUpTime: "07:00",
    sleepTime: "23:00",
    preferredMeals: "4",
    anamnesis: "",
    enfermedades: ["diabetes"],
    medicamentos: "metformina",
    alergias: "",
    foodLikes: "",
    foodDislikes: "",
    cinturaCm: "101",
    caderaCm: "108",
    cuelloCm: "34",
    brazoCm: "33",
    musloCm: "60",
  });

  assert.ok(["bajo", "moderado", "alto"].includes(risk.riskLevel), "Nivel de riesgo invalido");
  assert.ok(risk.rce > 0.5, "RCE esperada mayor a 0.5 para caso de riesgo");

  const distribution = buildMealDistribution(5);
  assert.equal(distribution.length, 5, "Distribucion de 5 comidas invalida");
  assert.equal(roundValue(distribution.reduce((acc, value) => acc + value, 0)), 1, "Distribucion no suma 1");

  const names = createMealNames(4, "manana");
  assert.equal(names.length, 4, "Nombres de comidas invalidos");

  const keywords = parseKeywords(" Pollo, arroz , banana ");
  assert.deepEqual(keywords, ["pollo", "arroz", "banana"], "Parser de keywords incorrecto");

  const minutes = timeToMinutes("07:30", 0);
  assert.equal(minutes, 450, "Conversion de hora a minutos incorrecta");

  console.log("Nutrition calculations tests: OK");
}

run();
