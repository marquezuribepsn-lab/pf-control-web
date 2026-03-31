import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  generateTrainingPlan,
  type CapabilityKey,
  type CalendarEventKind,
  type GeneratedTrainingPlan,
  type TrainingPlanEventInput,
  type TrainingPlanRequest,
  type TrainingLevel,
  type TrainingTargetType,
} from "@/lib/trainingPlanAI";

type RequestBody = {
  mode?: "create" | "extend";
  targetType?: TrainingTargetType;
  targetName?: string;
  sport?: string;
  category?: string;
  ageMin?: number;
  ageMax?: number;
  level?: TrainingLevel;
  objectives?: string[];
  capabilities?: CapabilityKey[];
  constraints?: string[];
  sessionsPerWeek?: number;
  sessionDurationMin?: number;
  weeks?: number;
  startDate?: string;
  notes?: string;
  events?: Array<{
    date?: string;
    label?: string;
    kind?: CalendarEventKind;
    importance?: number;
  }>;
  existingPlan?: GeneratedTrainingPlan;
};

const CAPABILITIES: CapabilityKey[] = [
  "fuerza",
  "velocidad",
  "resistencia",
  "potencia",
  "agilidad",
  "movilidad",
  "tecnica",
];

const LEVELS: TrainingLevel[] = ["iniciacion", "desarrollo", "rendimiento"];

const TARGETS: TrainingTargetType[] = ["alumno", "plantel"];

function sanitizeArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function toNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const sessionUser = (session?.user || {}) as { role?: string };

  if (!session || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;

  const mode = body.mode === "extend" ? "extend" : "create";
  const targetType = TARGETS.includes(body.targetType || "alumno")
    ? (body.targetType as TrainingTargetType)
    : "alumno";
  const level = LEVELS.includes(body.level || "desarrollo")
    ? (body.level as TrainingLevel)
    : "desarrollo";

  const capabilities = sanitizeArray(body.capabilities)
    .filter((item): item is CapabilityKey => CAPABILITIES.includes(item as CapabilityKey));

  const events: TrainingPlanEventInput[] = Array.isArray(body.events)
    ? body.events
        .map((event) => ({
          date: String(event.date || "").trim(),
          label: String(event.label || "Evento").trim() || "Evento",
          kind: (event.kind === "especial" ? "especial" : "partido") as CalendarEventKind,
          importance: toNumber(event.importance, 3),
        }))
        .filter((event) => event.date.length > 0)
    : [];

  const requestPayload: TrainingPlanRequest = {
    mode,
    targetType,
    targetName: String(body.targetName || "Plantel").trim() || "Plantel",
    sport: String(body.sport || "General").trim() || "General",
    category: String(body.category || "General").trim() || "General",
    ageMin: toNumber(body.ageMin, 16),
    ageMax: toNumber(body.ageMax, 25),
    level,
    objectives: sanitizeArray(body.objectives),
    capabilities,
    constraints: sanitizeArray(body.constraints),
    sessionsPerWeek: toNumber(body.sessionsPerWeek, 3),
    sessionDurationMin: toNumber(body.sessionDurationMin, 70),
    weeks: toNumber(body.weeks, 8),
    startDate: String(body.startDate || new Date().toISOString().slice(0, 10)),
    events,
    notes: String(body.notes || "").trim(),
    existingPlan: body.existingPlan,
  };

  if (requestPayload.mode === "extend" && !requestPayload.existingPlan) {
    return NextResponse.json(
      { message: "Para extender un plan, existingPlan es obligatorio" },
      { status: 400 }
    );
  }

  if (requestPayload.ageMax < requestPayload.ageMin) {
    return NextResponse.json(
      { message: "ageMax no puede ser menor a ageMin" },
      { status: 400 }
    );
  }

  const plan = generateTrainingPlan(requestPayload);

  return NextResponse.json({
    ok: true,
    engine: "periodizacion-reglada-v1",
    plan,
  });
}
