import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type AIEngine = "periodizador-v1" | "microciclo-v2";

type AIEvent = {
  date: string;
  label: string;
  kind?: string;
  importance?: number;
};

type AIBlock = {
  title: string;
  objective: string;
  suggestions: string[];
};

type AISessionBlueprint = {
  id: string;
  title: string;
  objective: string;
  durationMin: number;
  blocks: AIBlock[];
  tags: string[];
};

type AIWeek = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  focus: string;
  load: "base" | "build" | "peak" | "deload";
  sessionBlueprints: AISessionBlueprint[];
};

type AIPlan = {
  id: string;
  createdAt: string;
  updatedAt: string;
  engine: AIEngine;
  targetType: "jugadoras" | "alumnos";
  targetName: string;
  sport: string;
  category: string;
  level: string;
  notes: string;
  sessionsPerWeek: number;
  sessionDurationMin: number;
  totalWeeks: number;
  startDate: string;
  events: AIEvent[];
  weeks: AIWeek[];
};

type CreatePayload = {
  mode: "create";
  engine?: AIEngine;
  targetType?: "jugadoras" | "alumnos";
  targetName?: string;
  sport?: string;
  category?: string;
  level?: string;
  notes?: string;
  sessionsPerWeek?: number;
  sessionDurationMin?: number;
  weeks?: number;
  startDate?: string;
  events?: AIEvent[];
};

type ExtendPayload = {
  mode: "extend";
  engine?: AIEngine;
  existingPlan?: AIPlan;
  weeks?: number;
  events?: AIEvent[];
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (base: string, days: number) => {
  const date = new Date(`${base}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
};

const mkId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

const weekLoad = (weekIndex: number, totalWeeks: number): AIWeek["load"] => {
  if (totalWeeks <= 2) return weekIndex === totalWeeks - 1 ? "deload" : "build";
  if (weekIndex === totalWeeks - 1) return "deload";
  if (weekIndex >= totalWeeks - 2) return "peak";
  if (weekIndex === 0) return "base";
  return "build";
};

const weekFocus = (engine: AIEngine, load: AIWeek["load"], sport: string) => {
  const sportText = sport || "deporte";
  if (engine === "microciclo-v2") {
    if (load === "deload") return `Microciclo tecnico y recuperacion para ${sportText}`;
    if (load === "peak") return `Microciclo competitivo para ${sportText}`;
    if (load === "build") return `Microciclo de intensificacion para ${sportText}`;
    return `Microciclo base para ${sportText}`;
  }

  if (load === "deload") return `Descarga y consolidacion en ${sportText}`;
  if (load === "peak") return `Puesta a punto para rendimiento en ${sportText}`;
  if (load === "build") return `Desarrollo progresivo en ${sportText}`;
  return `Base tecnica y fisica para ${sportText}`;
};

const createWeekBlueprint = (
  weekNumber: number,
  startDate: string,
  sessionsPerWeek: number,
  sessionDurationMin: number,
  focus: string,
  load: AIWeek["load"]
): AIWeek => {
  const endDate = addDays(startDate, 6);
  const sessionBlueprints: AISessionBlueprint[] = [];

  for (let idx = 0; idx < sessionsPerWeek; idx += 1) {
    const sessionId = mkId();
    const sessionDay = addDays(startDate, Math.min(idx * 2, 6));
    sessionBlueprints.push({
      id: sessionId,
      title: `Sesion IA ${weekNumber}.${idx + 1}`,
      objective: `${focus} (${load})`,
      durationMin: sessionDurationMin,
      tags: [load, `week-${weekNumber}`],
      blocks: [
        {
          title: "Activacion",
          objective: "Elevar temperatura y preparar patrones de movimiento",
          suggestions: ["Movilidad dinamica", "Core anti-rotacion", "Saltos de baja carga"],
        },
        {
          title: "Bloque principal",
          objective: "Trabajo especifico de fuerza/velocidad segun objetivo semanal",
          suggestions: ["Serie principal autoregulada", "Complementarios por patron", "Control de RPE"],
        },
        {
          title: "Cierre",
          objective: "Bajar carga interna y consolidar tecnica",
          suggestions: ["Respiracion", "Movilidad final", "Registro de sensaciones"],
        },
      ],
    });

    // Use sessionDay in title metadata to keep deterministic spacing.
    sessionBlueprints[sessionBlueprints.length - 1].title += ` · ${sessionDay}`;
  }

  return {
    weekNumber,
    startDate,
    endDate,
    focus,
    load,
    sessionBlueprints,
  };
};

const buildPlan = (payload: CreatePayload): AIPlan => {
  const now = new Date().toISOString();
  const engine: AIEngine = payload.engine === "microciclo-v2" ? "microciclo-v2" : "periodizador-v1";
  const startDate = payload.startDate || toIsoDate(new Date());
  const totalWeeks = clampInt(payload.weeks, 1, 16, 3);
  const sessionsPerWeek = clampInt(payload.sessionsPerWeek, 1, 7, 3);
  const sessionDurationMin = clampInt(payload.sessionDurationMin, 30, 180, 70);

  const weeks: AIWeek[] = [];
  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
    const weekStart = addDays(startDate, weekIndex * 7);
    const load = weekLoad(weekIndex, totalWeeks);
    const focus = weekFocus(engine, load, payload.sport || "deporte");
    weeks.push(
      createWeekBlueprint(
        weekIndex + 1,
        weekStart,
        sessionsPerWeek,
        sessionDurationMin,
        focus,
        load
      )
    );
  }

  return {
    id: `plan-${mkId()}`,
    createdAt: now,
    updatedAt: now,
    engine,
    targetType: payload.targetType === "jugadoras" ? "jugadoras" : "alumnos",
    targetName: payload.targetName?.trim() || "Objetivo IA",
    sport: payload.sport?.trim() || "Futbol",
    category: payload.category?.trim() || "General",
    level: payload.level?.trim() || "desarrollo",
    notes: payload.notes?.trim() || "",
    sessionsPerWeek,
    sessionDurationMin,
    totalWeeks,
    startDate,
    events: Array.isArray(payload.events) ? payload.events : [],
    weeks,
  };
};

const extendPlan = (payload: ExtendPayload): AIPlan => {
  const existing = payload.existingPlan;
  if (!existing || !Array.isArray(existing.weeks) || existing.weeks.length === 0) {
    return buildPlan({ mode: "create", engine: payload.engine });
  }

  const now = new Date().toISOString();
  const extraWeeks = clampInt(payload.weeks, 1, 16, 1);
  const weeks = [...existing.weeks];
  const baseCount = weeks.length;
  const lastWeek = weeks[weeks.length - 1];
  const firstExtraStart = addDays(lastWeek.endDate, 1);

  for (let idx = 0; idx < extraWeeks; idx += 1) {
    const absoluteIndex = baseCount + idx;
    const weekStart = addDays(firstExtraStart, idx * 7);
    const load = weekLoad(absoluteIndex, baseCount + extraWeeks);
    const focus = weekFocus(existing.engine, load, existing.sport || "deporte");
    weeks.push(
      createWeekBlueprint(
        absoluteIndex + 1,
        weekStart,
        clampInt(existing.sessionsPerWeek, 1, 7, 3),
        clampInt(existing.sessionDurationMin, 30, 180, 70),
        focus,
        load
      )
    );
  }

  return {
    ...existing,
    updatedAt: now,
    totalWeeks: weeks.length,
    events: [...(Array.isArray(existing.events) ? existing.events : []), ...(Array.isArray(payload.events) ? payload.events : [])],
    weeks,
  };
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ ok: false, message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreatePayload | ExtendPayload;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Payload invalido" }, { status: 400 });
    }

    if (body.mode === "extend") {
      const plan = extendPlan(body);
      return NextResponse.json({ ok: true, plan });
    }

    const plan = buildPlan(body as CreatePayload);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al generar plan IA",
      },
      { status: 500 }
    );
  }
}
