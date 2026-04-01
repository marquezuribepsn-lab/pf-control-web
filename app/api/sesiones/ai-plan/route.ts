import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildTrainingPlan,
  extendTrainingPlan,
  recalculateTrainingWeek,
  type TrainingPlan,
  type TrainingPlanEvent,
} from "@/lib/trainingPlanAI";

type CreatePayload = {
  mode: "create";
  targetType?: "jugadoras" | "alumnos";
  targetName?: string;
  sport?: string;
  category?: string;
  ageMin?: number;
  ageMax?: number;
  level?: string;
  notes?: string;
  objectives?: string[] | string;
  capabilities?: string[] | string;
  constraints?: string[] | string;
  sessionsPerWeek?: number;
  sessionDurationMin?: number;
  weeks?: number;
  startDate?: string;
  events?: TrainingPlanEvent[];
};

type ExtendPayload = {
  mode: "extend";
  existingPlan?: TrainingPlan;
  weeks?: number;
  events?: TrainingPlanEvent[];
};

type RecalculatePayload = {
  mode: "recalculate-week";
  existingPlan?: TrainingPlan;
  weekNumber?: number;
  wellnessScore?: number;
  externalLoadDelta?: number;
  note?: string;
};

type SupportedPayload = CreatePayload | ExtendPayload | RecalculatePayload;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ ok: false, message: "No autorizado" }, { status: 401 });
  }

  if ((session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json(
      {
        ok: false,
        message: "Solo ADMIN puede generar o modificar planes IA",
      },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as SupportedPayload;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Payload invalido" }, { status: 400 });
    }

    if (body.mode === "extend") {
      const plan = extendTrainingPlan({
        existingPlan: body.existingPlan,
        extraWeeks: body.weeks,
        events: body.events,
      });
      return NextResponse.json({ ok: true, plan });
    }

    if (body.mode === "recalculate-week") {
      const plan = recalculateTrainingWeek({
        plan: body.existingPlan,
        weekNumber: body.weekNumber,
        wellnessScore: body.wellnessScore,
        externalLoadDelta: body.externalLoadDelta,
        note: body.note,
      });
      return NextResponse.json({ ok: true, plan });
    }

    const plan = buildTrainingPlan(body as CreatePayload);
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
