const BASE_URL = process.env.BASE_URL || "https://pf-control.com";
const PLAN_KEY = "pf-control-semana-plan";
const OWNER_KEY = "alumnos:pablo marquez";
const OWNER_NAME = "Pablo Marquez";

const weekTemplates = [
  {
    nombre: "Semana 1",
    objetivo: "Base tecnica y consistencia de ejecucion",
  },
  {
    nombre: "Semana 2",
    objetivo: "Aumento de volumen y control del tempo",
  },
  {
    nombre: "Semana 3",
    objetivo: "Consolidacion de carga y eficiencia de movimiento",
  },
];

const dayTemplates = [
  {
    dia: "Dia 1",
    planificacion: "Pierna + core",
    objetivo: "Fuerza base de tren inferior",
    entrenamientoTitulo: "Pierna y estabilidad",
    duracion: "60",
    ejercicios: [
      {
        ejercicioId: "1",
        series: [3, 4, 4],
        repeticiones: ["8-10", "8-10", "6-8"],
        descanso: "90s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "Controlar la bajada y mantener la postura.",
      },
      {
        ejercicioId: "6",
        series: [3, 4, 4],
        repeticiones: ["8-10", "8-10", "6-8"],
        descanso: "90s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "Espalda neutra y cadera activa en todo el recorrido.",
      },
      {
        ejercicioId: "19",
        series: [3, 3, 4],
        repeticiones: ["10-12", "10-12", "8-10"],
        descanso: "75s",
        carga: ["RPE 6.5", "RPE 7", "RPE 7.5"],
        observaciones: "Subir con control y apoyar todo el pie.",
      },
      {
        ejercicioId: "15",
        series: [3, 4, 4],
        repeticiones: ["10", "8-10", "8"],
        descanso: "90s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "Priorizar rango completo y tecnica limpia.",
      },
      {
        ejercicioId: "8",
        series: [3, 3, 4],
        repeticiones: ["30-40s", "35-45s", "40-50s"],
        descanso: "45s",
        carga: ["Peso corporal", "Peso corporal", "Peso corporal"],
        observaciones: "Mantener abdomen firme sin perder alineacion.",
      },
      {
        ejercicioId: "18",
        series: [3, 3, 3],
        repeticiones: ["16-20", "18-22", "20-24"],
        descanso: "45s",
        carga: ["Ligera", "Ligera", "Ligera"],
        observaciones: "Girar con control sin colapsar la zona lumbar.",
      },
    ],
  },
  {
    dia: "Dia 2",
    planificacion: "Empuje y traccion",
    objetivo: "Fuerza de tren superior y estabilidad escapular",
    entrenamientoTitulo: "Upper body",
    duracion: "58",
    ejercicios: [
      {
        ejercicioId: "5",
        series: [3, 4, 4],
        repeticiones: ["8-10", "8", "6-8"],
        descanso: "90s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "Bajar controlado y empujar con trayectoria estable.",
      },
      {
        ejercicioId: "11",
        series: [3, 4, 4],
        repeticiones: ["8-10", "8-10", "6-8"],
        descanso: "90s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "Cerrar escapulas y mantener torso firme.",
      },
      {
        ejercicioId: "12",
        series: [3, 3, 4],
        repeticiones: ["8-10", "8-10", "6-8"],
        descanso: "75s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "No arquear la zona lumbar durante el empuje.",
      },
      {
        ejercicioId: "7",
        series: [3, 3, 4],
        repeticiones: ["6-8", "6-8", "6-8"],
        descanso: "90s",
        carga: ["Asistido", "Asistido", "Asistido"],
        observaciones: "Traccion completa y control en la fase negativa.",
      },
      {
        ejercicioId: "13",
        series: [2, 3, 3],
        repeticiones: ["10-12", "10-12", "8-10"],
        descanso: "60s",
        carga: ["Moderada", "Moderada", "Moderada"],
        observaciones: "Evitar balanceo para aislar correctamente.",
      },
      {
        ejercicioId: "14",
        series: [2, 3, 3],
        repeticiones: ["10-12", "10-12", "8-10"],
        descanso: "60s",
        carga: ["Moderada", "Moderada", "Moderada"],
        observaciones: "Extender completo sin compensar con hombros.",
      },
    ],
  },
  {
    dia: "Dia 3",
    planificacion: "Velocidad y potencia",
    objetivo: "Aceleracion, reactividad y capacidad anaerobica",
    entrenamientoTitulo: "Power day",
    duracion: "52",
    ejercicios: [
      {
        ejercicioId: "3",
        series: [5, 6, 6],
        repeticiones: ["1", "1", "1"],
        descanso: "75-90s",
        carga: ["Maxima tecnica", "Maxima tecnica", "Maxima tecnica"],
        observaciones: "Salida limpia y aceleracion explosiva.",
      },
      {
        ejercicioId: "4",
        series: [4, 5, 5],
        repeticiones: ["4-6", "4-6", "4-6"],
        descanso: "75s",
        carga: ["Reactivo", "Reactivo", "Reactivo"],
        observaciones: "Responder al estimulo sin perder control.",
      },
      {
        ejercicioId: "10",
        series: [4, 4, 5],
        repeticiones: ["5", "5", "4-5"],
        descanso: "90s",
        carga: ["Explosiva", "Explosiva", "Explosiva"],
        observaciones: "Aterrizar suave y estable en cada salto.",
      },
      {
        ejercicioId: "9",
        series: [3, 4, 4],
        repeticiones: ["10", "10-12", "12"],
        descanso: "60s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "Mantener ritmo constante de trabajo.",
      },
      {
        ejercicioId: "17",
        series: [3, 3, 4],
        repeticiones: ["20-24", "24-28", "28-32"],
        descanso: "45s",
        carga: ["Peso corporal", "Peso corporal", "Peso corporal"],
        observaciones: "Cadera estable y core activo en todo momento.",
      },
      {
        ejercicioId: "8",
        series: [3, 3, 3],
        repeticiones: ["30-40s", "35-45s", "40-50s"],
        descanso: "45s",
        carga: ["Peso corporal", "Peso corporal", "Peso corporal"],
        observaciones: "Finalizar con respiracion controlada.",
      },
    ],
  },
  {
    dia: "Dia 4",
    planificacion: "Full body",
    objetivo: "Integrar fuerza global y resistencia especifica",
    entrenamientoTitulo: "Mixto global",
    duracion: "62",
    ejercicios: [
      {
        ejercicioId: "16",
        series: [3, 4, 4],
        repeticiones: ["10-12", "10", "8-10"],
        descanso: "75s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "Paso largo, tronco firme y rodilla estable.",
      },
      {
        ejercicioId: "2",
        series: [3, 3, 4],
        repeticiones: ["6-8", "6-8", "6-8"],
        descanso: "90s",
        carga: ["Asistido", "Asistido", "Asistido"],
        observaciones: "Controlar fase excéntrica en cada repeticion.",
      },
      {
        ejercicioId: "20",
        series: [3, 3, 4],
        repeticiones: ["5-6", "6", "6-7"],
        descanso: "90s",
        carga: ["Asistido", "Asistido", "Asistido"],
        observaciones: "Buscar traccion completa con buena tecnica.",
      },
      {
        ejercicioId: "11",
        series: [3, 4, 4],
        repeticiones: ["8-10", "8-10", "6-8"],
        descanso: "90s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "Evitar balanceo para mantener eficacia.",
      },
      {
        ejercicioId: "9",
        series: [3, 3, 4],
        repeticiones: ["8-10", "10", "10-12"],
        descanso: "60s",
        carga: ["RPE 7", "RPE 7.5", "RPE 8"],
        observaciones: "Sostener intensidad sin romper tecnica.",
      },
      {
        ejercicioId: "18",
        series: [3, 3, 3],
        repeticiones: ["16-20", "18-22", "20-24"],
        descanso: "45s",
        carga: ["Ligera", "Ligera", "Ligera"],
        observaciones: "Movimiento fluido para cierre de sesion.",
      },
    ],
  },
];

function pickProgressiveValue(value, weekIndex) {
  if (Array.isArray(value)) {
    return String(value[Math.min(weekIndex, value.length - 1)]);
  }
  return String(value);
}

function createExercise(exerciseTemplate, weekIndex, weekNumber, dayNumber, exerciseNumber) {
  return {
    id: `pablo-w${weekNumber}-d${dayNumber}-e${exerciseNumber}`,
    ejercicioId: String(exerciseTemplate.ejercicioId),
    series: Number(pickProgressiveValue(exerciseTemplate.series, weekIndex)),
    repeticiones: pickProgressiveValue(exerciseTemplate.repeticiones, weekIndex),
    descanso: String(exerciseTemplate.descanso),
    carga: pickProgressiveValue(exerciseTemplate.carga, weekIndex),
    observaciones: String(exerciseTemplate.observaciones),
    metricas: [
      {
        nombre: "RIR",
        valor: weekIndex === 0 ? "3" : weekIndex === 1 ? "2" : "1-2",
      },
    ],
  };
}

function createWeeks() {
  return weekTemplates.map((weekTemplate, weekIndex) => {
    const weekNumber = weekIndex + 1;

    return {
      id: `pablo-week-${weekNumber}`,
      nombre: weekTemplate.nombre,
      objetivo: weekTemplate.objetivo,
      dias: dayTemplates.map((dayTemplate, dayIndex) => {
        const dayNumber = dayIndex + 1;
        const ejercicios = dayTemplate.ejercicios.map((exerciseTemplate, exerciseIndex) =>
          createExercise(exerciseTemplate, weekIndex, weekNumber, dayNumber, exerciseIndex + 1)
        );

        return {
          id: `pablo-week-${weekNumber}-day-${dayNumber}`,
          dia: dayTemplate.dia,
          planificacion: dayTemplate.planificacion,
          objetivo: dayTemplate.objetivo,
          sesionId: `pablo-plan-w${weekNumber}-d${dayNumber}`,
          entrenamiento: {
            titulo: dayTemplate.entrenamientoTitulo,
            descripcion: `${dayTemplate.planificacion} - ${dayTemplate.objetivo}`,
            duracion: dayTemplate.duracion,
            bloques: [
              {
                id: `pablo-week-${weekNumber}-day-${dayNumber}-block-1`,
                titulo: "Bloque principal",
                objetivo: dayTemplate.objetivo,
                ejercicios,
              },
            ],
          },
        };
      }),
    };
  });
}

async function fetchSyncValue(key) {
  const response = await fetch(`${BASE_URL}/api/sync/${key}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${key} failed with status ${response.status}`);
  }

  return response.json();
}

async function putSyncValue(key, value) {
  const response = await fetch(`${BASE_URL}/api/sync/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PUT ${key} failed with status ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  const currentPayload = await fetchSyncValue(PLAN_KEY);
  const currentValue = currentPayload && typeof currentPayload.value === "object" && currentPayload.value !== null
    ? currentPayload.value
    : {};

  const currentPlanes = Array.isArray(currentValue.planes) ? [...currentValue.planes] : [];
  const newPlan = {
    ownerKey: OWNER_KEY,
    tipo: "alumnos",
    nombre: OWNER_NAME,
    semanas: createWeeks(),
  };

  const targetIndex = currentPlanes.findIndex((plan) => {
    return String(plan?.ownerKey || "").trim().toLowerCase() === OWNER_KEY;
  });

  if (targetIndex >= 0) {
    currentPlanes[targetIndex] = newPlan;
  } else {
    currentPlanes.push(newPlan);
  }

  const nextValue = {
    ...currentValue,
    version: 3,
    planes: currentPlanes,
  };

  await putSyncValue(PLAN_KEY, nextValue);

  const weeks = newPlan.semanas.length;
  const days = newPlan.semanas.reduce((count, week) => count + week.dias.length, 0);
  const exercises = newPlan.semanas.reduce(
    (count, week) =>
      count +
      week.dias.reduce((dayCount, day) => {
        const blocks = Array.isArray(day.entrenamiento?.bloques) ? day.entrenamiento.bloques : [];
        const dayExercises = blocks.reduce((blockCount, block) => {
          const rows = Array.isArray(block.ejercicios) ? block.ejercicios.length : 0;
          return blockCount + rows;
        }, 0);
        return dayCount + dayExercises;
      }, 0),
    0
  );

  console.log(`Plan cargado para ${OWNER_NAME} (${OWNER_KEY})`);
  console.log(`Semanas: ${weeks}`);
  console.log(`Dias totales: ${days}`);
  console.log(`Ejercicios totales: ${exercises}`);
  console.log("Listo para ver en la vista de alumno.");
}

main().catch((error) => {
  console.error("No se pudo cargar el plan de Pablo.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
