/**
 * Sistema de rachas de entrenamiento.
 *
 * La racha cuenta DIAS DE ENTRENAMIENTO seguidos, no dias de calendario:
 * nadie entrena los siete, asi que contar calendario la cortaria todas las
 * semanas y el numero nunca pasaria de 1.
 *
 * El margen de descanso permitido sale del plan del alumno: con 4 dias
 * cargados se espera entrenar cada ~2, asi que se toleran hasta 3 de descanso
 * entre sesiones. Sobre ese margen se apoyan los tres estados:
 *
 *   activa     -> entreno dentro del margen
 *   congelada  -> se paso un turno de entrenamiento (hasta 2 margenes)
 *   perdida    -> se paso el segundo, la racha vuelve a 0
 */

export type EstadoRacha = "activa" | "congelada" | "perdida";

export type Racha = {
  /** Entrenamientos seguidos. 0 cuando la racha se perdio. */
  dias: number;
  estado: EstadoRacha;
  /** Descanso tolerado entre sesiones, en dias. */
  margenDias: number;
  /** Dias transcurridos desde el ultimo entrenamiento. null si nunca entreno. */
  diasDesdeUltimo: number | null;
  /** Cuantos dias quedan antes de que la racha se pierda. 0 si ya se perdio. */
  diasParaPerderla: number;
};

export type NivelRacha = {
  /** Dias necesarios para alcanzarlo. */
  min: number;
  nombre: string;
  /** Identificador del personaje que se dibuja. */
  personaje: Personaje;
  /** Gradiente del personaje. */
  colores: [string, string];
};

export type Personaje =
  | "chispa"
  | "llama"
  | "fogata"
  | "cometa"
  | "estrella"
  | "sol"
  | "corona"
  | "leyenda";

/** Progresion hasta 365 dias, el nivel maximo. */
export const NIVELES_RACHA: NivelRacha[] = [
  { min: 1, nombre: "Chispa", personaje: "chispa", colores: ["#fde68a", "#f59e0b"] },
  { min: 7, nombre: "Llama", personaje: "llama", colores: ["#fbbf24", "#ef4444"] },
  { min: 21, nombre: "Fogata", personaje: "fogata", colores: ["#fb923c", "#dc2626"] },
  { min: 50, nombre: "Cometa", personaje: "cometa", colores: ["#67e8f9", "#6366f1"] },
  { min: 100, nombre: "Estrella", personaje: "estrella", colores: ["#fef08a", "#f59e0b"] },
  { min: 180, nombre: "Sol", personaje: "sol", colores: ["#fde047", "#f97316"] },
  { min: 270, nombre: "Corona", personaje: "corona", colores: ["#fcd34d", "#b45309"] },
  { min: 365, nombre: "Leyenda", personaje: "leyenda", colores: ["#a5f3fc", "#818cf8"] },
];

export const RACHA_MAXIMA = 365;

/** Margen de descanso tolerado segun los dias de entrenamiento del plan. */
export function margenDeDescanso(diasPlan: number): number {
  const dias = Math.max(1, Math.floor(diasPlan) || 1);
  return Math.ceil(7 / dias) + 1;
}

function aDiaAbsoluto(valor: string): number | null {
  const ms = new Date(`${valor}T00:00:00`).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 86400000);
}

/**
 * @param fechasISO fechas `YYYY-MM-DD` de los entrenamientos completados
 * @param diasPlan  dias de entrenamiento que el profe cargo en la semana
 */
export function calcularRacha(fechasISO: string[], diasPlan: number, hoy = new Date()): Racha {
  const margenDias = margenDeDescanso(diasPlan);
  const base: Racha = {
    dias: 0,
    estado: "perdida",
    margenDias,
    diasDesdeUltimo: null,
    diasParaPerderla: 0,
  };

  const fechas = Array.from(new Set(fechasISO.map((f) => String(f || "").trim()).filter(Boolean)))
    .map(aDiaAbsoluto)
    .filter((d): d is number => d !== null)
    .sort((a, b) => b - a);

  if (fechas.length === 0) return base;

  const diaHoy = Math.floor(new Date(hoy).setHours(0, 0, 0, 0) / 86400000);
  const diasDesdeUltimo = diaHoy - fechas[0];

  // Mas de dos margenes sin entrenar: la racha se perdio.
  if (diasDesdeUltimo > margenDias * 2) {
    return { ...base, diasDesdeUltimo };
  }

  let dias = 1;
  for (let i = 1; i < fechas.length; i += 1) {
    const salto = fechas[i - 1] - fechas[i];
    if (salto > 0 && salto <= margenDias) {
      dias += 1;
    } else {
      break;
    }
  }

  const estado: EstadoRacha = diasDesdeUltimo <= margenDias ? "activa" : "congelada";

  return {
    dias: Math.min(dias, RACHA_MAXIMA),
    estado,
    margenDias,
    diasDesdeUltimo,
    diasParaPerderla: Math.max(0, margenDias * 2 - diasDesdeUltimo),
  };
}

/** Nivel alcanzado con esa cantidad de dias. Null cuando todavia no hay racha. */
export function nivelDeRacha(dias: number): NivelRacha | null {
  if (dias < 1) return null;
  let actual: NivelRacha = NIVELES_RACHA[0];
  for (const nivel of NIVELES_RACHA) {
    if (dias >= nivel.min) actual = nivel;
  }
  return actual;
}

/** Proximo nivel a desbloquear. Null cuando ya esta en el maximo. */
export function siguienteNivel(dias: number): NivelRacha | null {
  return NIVELES_RACHA.find((nivel) => nivel.min > dias) ?? null;
}

/** Progreso 0-100 dentro del tramo entre el nivel actual y el siguiente. */
export function progresoAlSiguiente(dias: number): number {
  const siguiente = siguienteNivel(dias);
  if (!siguiente) return 100;
  const actual = nivelDeRacha(dias);
  const desde = actual?.min ?? 0;
  const tramo = siguiente.min - desde;
  if (tramo <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((dias - desde) / tramo) * 100)));
}
