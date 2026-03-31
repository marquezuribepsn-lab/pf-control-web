type NutritionGoal = "mantenimiento" | "recomposicion" | "masa" | "deficit";
type BiologicalSex = "femenino" | "masculino";
type ActivityLevel = "sedentario" | "ligero" | "moderado" | "alto" | "muy-alto";
type TrainingFocus = "fuerza" | "resistencia" | "mixto" | "tecnico";
type TrainingTime = "manana" | "mediodia" | "tarde" | "noche";
type MedicalFlag = "diabetes" | "hipotiroidismo" | "hipertension" | "dislipidemia" | "sop" | "ninguna";

type NutritionTargets = {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
};

type NutritionAIBriefInput = {
  sexo: BiologicalSex;
  edad: string;
  pesoKg: string;
  alturaCm: string;
  actividad: ActivityLevel;
  objetivo: NutritionGoal;
  trainingSessionsPerDay: string;
  trainingFocus: TrainingFocus;
  trainingTime: TrainingTime;
  wakeUpTime: string;
  sleepTime: string;
  preferredMeals: string;
  anamnesis: string;
  enfermedades: MedicalFlag[];
  medicamentos: string;
  alergias: string;
  foodLikes: string;
  foodDislikes: string;
  cinturaCm: string;
  caderaCm: string;
  cuelloCm: string;
  brazoCm: string;
  musloCm: string;
};

type RiskProfile = {
  imc: number;
  rce: number;
  rcc: number;
  bodyFatEstimate: number;
  riskLevel: "bajo" | "moderado" | "alto";
  notes: string[];
};

const activityFactors: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  "muy-alto": 1.9,
};

const goalFactors: Record<NutritionGoal, number> = {
  mantenimiento: 1,
  recomposicion: 0.92,
  masa: 1.12,
  deficit: 0.8,
};

export function roundValue(value: number) {
  return Math.round(value * 10) / 10;
}

export function parseNumber(value: string, fallback: number) {
  const normalized = Number(String(value || "").replace(",", "."));
  return Number.isFinite(normalized) ? normalized : fallback;
}

export function calculateTargets({
  sexo,
  edad,
  pesoKg,
  alturaCm,
  actividad,
  objetivo,
}: {
  sexo: BiologicalSex;
  edad: number;
  pesoKg: number;
  alturaCm: number;
  actividad: ActivityLevel;
  objetivo: NutritionGoal;
}): NutritionTargets {
  const cleanEdad = Math.max(10, Math.min(95, edad || 25));
  const cleanPeso = Math.max(30, Math.min(250, pesoKg || 70));
  const cleanAltura = Math.max(130, Math.min(230, alturaCm || 170));

  const bmr =
    sexo === "masculino"
      ? 88.362 + 13.397 * cleanPeso + 4.799 * cleanAltura - 5.677 * cleanEdad
      : 447.593 + 9.247 * cleanPeso + 3.098 * cleanAltura - 4.33 * cleanEdad;

  const tdee = bmr * activityFactors[actividad] * goalFactors[objetivo];

  const proteinFactor = objetivo === "masa" ? 2.2 : objetivo === "mantenimiento" ? 1.8 : 2;
  const fatFactor = objetivo === "deficit" ? 0.7 : objetivo === "masa" ? 1 : 0.8;

  const proteinas = roundValue(cleanPeso * proteinFactor);
  const grasas = roundValue(cleanPeso * fatFactor);
  const calorias = roundValue(tdee);

  const kcalProte = proteinas * 4;
  const kcalGrasas = grasas * 9;
  const carbohidratos = roundValue(Math.max(0, (calorias - kcalProte - kcalGrasas) / 4));

  return {
    calorias,
    proteinas,
    carbohidratos,
    grasas,
  };
}

export function parseKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function timeToMinutes(value: string, fallback: number) {
  const [rawH, rawM] = String(value || "").split(":");
  const h = Number(rawH);
  const m = Number(rawM);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  return Math.max(0, Math.min(23, h)) * 60 + Math.max(0, Math.min(59, m));
}

export function minutesToTime(value: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)));
  const h = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const m = (safe % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function estimateTrainingMinutes(trainingTime: TrainingTime) {
  switch (trainingTime) {
    case "manana":
      return 8 * 60;
    case "mediodia":
      return 13 * 60;
    case "tarde":
      return 18 * 60;
    case "noche":
      return 20 * 60;
    default:
      return 18 * 60;
  }
}

export function calculateAdvancedTargets(brief: NutritionAIBriefInput) {
  const edad = Math.max(10, Math.min(95, parseNumber(brief.edad, 24)));
  const pesoKg = Math.max(30, Math.min(250, parseNumber(brief.pesoKg, 60)));
  const alturaCm = Math.max(130, Math.min(230, parseNumber(brief.alturaCm, 165)));

  const harrisBmr =
    brief.sexo === "masculino"
      ? 88.362 + 13.397 * pesoKg + 4.799 * alturaCm - 5.677 * edad
      : 447.593 + 9.247 * pesoKg + 3.098 * alturaCm - 4.33 * edad;

  const mifflinBmr =
    brief.sexo === "masculino"
      ? 10 * pesoKg + 6.25 * alturaCm - 5 * edad + 5
      : 10 * pesoKg + 6.25 * alturaCm - 5 * edad - 161;

  const combinedBmr = (harrisBmr + mifflinBmr) / 2;
  const imc = pesoKg / ((alturaCm / 100) * (alturaCm / 100));

  let metabolicAdjustment = 1;
  if (brief.enfermedades.includes("diabetes")) metabolicAdjustment *= 0.96;
  if (brief.enfermedades.includes("hipotiroidismo")) metabolicAdjustment *= 0.97;
  if (brief.enfermedades.includes("sop")) metabolicAdjustment *= 0.98;

  const calorias = roundValue(
    combinedBmr * activityFactors[brief.actividad] * goalFactors[brief.objetivo] * metabolicAdjustment
  );

  const sessionsPerDay = Math.max(1, Math.min(3, Math.round(parseNumber(brief.trainingSessionsPerDay, 1))));
  const baseProteinFactor =
    brief.objetivo === "masa"
      ? 2.2
      : brief.objetivo === "deficit"
        ? 2.1
        : brief.objetivo === "recomposicion"
          ? 2
          : 1.8;
  const trainingProteinExtra =
    brief.trainingFocus === "fuerza" ? 0.15 : brief.trainingFocus === "resistencia" ? 0.05 : 0.1;
  const proteinFactor = baseProteinFactor + trainingProteinExtra + (sessionsPerDay > 1 ? 0.1 : 0);

  const baseFatFactor = brief.objetivo === "deficit" ? 0.7 : brief.objetivo === "masa" ? 1 : 0.8;
  const fatFactor = brief.enfermedades.includes("dislipidemia") ? Math.max(0.65, baseFatFactor - 0.08) : baseFatFactor;

  const proteinas = roundValue(pesoKg * proteinFactor);
  const grasas = roundValue(pesoKg * fatFactor);
  const carbohidratos = roundValue(Math.max(60, (calorias - proteinas * 4 - grasas * 9) / 4));

  return {
    targets: {
      calorias,
      proteinas,
      carbohidratos,
      grasas,
    },
    bmrHarris: roundValue(harrisBmr),
    bmrMifflin: roundValue(mifflinBmr),
    imc: roundValue(imc),
    sessionsPerDay,
    pesoKg,
    alturaCm,
    edad,
  };
}

export function buildMealDistribution(mealsCount: number) {
  if (mealsCount <= 3) return [0.3, 0.4, 0.3];
  if (mealsCount === 4) return [0.25, 0.15, 0.35, 0.25];
  if (mealsCount === 5) return [0.22, 0.12, 0.3, 0.12, 0.24];
  return [0.2, 0.1, 0.24, 0.1, 0.16, 0.2];
}

export function createMealNames(mealsCount: number, trainingTime: TrainingTime) {
  if (mealsCount <= 3) return ["Desayuno", "Comida principal", "Cena"];
  if (mealsCount === 4) return ["Desayuno", "Snack", "Comida principal", "Cena"];
  if (mealsCount === 5) {
    if (trainingTime === "manana") {
      return ["Pre-entreno", "Post-entreno", "Almuerzo", "Merienda", "Cena"];
    }
    if (trainingTime === "noche") {
      return ["Desayuno", "Media manana", "Almuerzo", "Pre-entreno", "Post-entreno/Cena"];
    }
    return ["Desayuno", "Media manana", "Almuerzo", "Pre-entreno", "Cena"];
  }
  return ["Desayuno", "Media manana", "Almuerzo", "Pre-entreno", "Post-entreno", "Cena"];
}

export function calculateRiskProfile(brief: NutritionAIBriefInput): RiskProfile {
  const pesoKg = Math.max(30, Math.min(250, parseNumber(brief.pesoKg, 60)));
  const alturaCm = Math.max(130, Math.min(230, parseNumber(brief.alturaCm, 165)));
  const cinturaCm = Math.max(45, Math.min(180, parseNumber(brief.cinturaCm, 72)));
  const caderaCm = Math.max(55, Math.min(200, parseNumber(brief.caderaCm, 95)));
  const cuelloCm = Math.max(25, Math.min(70, parseNumber(brief.cuelloCm, 33)));

  const imc = pesoKg / ((alturaCm / 100) * (alturaCm / 100));
  const rce = cinturaCm / alturaCm;
  const rcc = cinturaCm / caderaCm;

  const bodyFatEstimate =
    brief.sexo === "masculino"
      ? 495 / (1.0324 - 0.19077 * Math.log10(cinturaCm - cuelloCm) + 0.15456 * Math.log10(alturaCm)) - 450
      : 495 / (1.29579 - 0.35004 * Math.log10(cinturaCm + caderaCm - cuelloCm) + 0.221 * Math.log10(alturaCm)) - 450;

  const notes: string[] = [];
  let score = 0;

  if (imc >= 30 || imc < 18.5) {
    score += 2;
    notes.push("IMC fuera de rango ideal.");
  } else if (imc >= 25) {
    score += 1;
    notes.push("IMC en sobrepeso.");
  }

  if (rce >= 0.6) {
    score += 2;
    notes.push("RCE elevada (riesgo cardiometabolico alto).");
  } else if (rce >= 0.5) {
    score += 1;
    notes.push("RCE moderada.");
  }

  if ((brief.sexo === "masculino" && rcc >= 0.95) || (brief.sexo === "femenino" && rcc >= 0.85)) {
    score += 1;
    notes.push("Relacion cintura-cadera elevada.");
  }

  if (brief.enfermedades.some((item) => item !== "ninguna")) {
    score += 1;
    notes.push("Antecedentes metabolicos a monitorizar.");
  }

  const riskLevel = score >= 4 ? "alto" : score >= 2 ? "moderado" : "bajo";

  return {
    imc: roundValue(imc),
    rce: roundValue(rce),
    rcc: roundValue(rcc),
    bodyFatEstimate: roundValue(bodyFatEstimate),
    riskLevel,
    notes,
  };
}

export function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
