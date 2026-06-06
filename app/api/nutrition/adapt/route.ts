import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  adaptNutritionPlan,
  buildNutritionPlan,
  type ClientNutritionProfile,
  type NutritionTargets,
  type PlanMeal,
} from "@/lib/nutritionPlanAI";

type AdaptPayload = {
  mode: "adapt" | "create";
  profile: ClientNutritionProfile;
  basePlan?: {
    targets: NutritionTargets;
    comidas: PlanMeal[];
  };
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ ok: false, message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as AdaptPayload;

    if (!body?.profile) {
      return NextResponse.json({ ok: false, error: "Perfil del cliente requerido" }, { status: 400 });
    }

    const profile: ClientNutritionProfile = {
      nombre:            String(body.profile.nombre    || "Cliente"),
      sexo:              body.profile.sexo === "femenino" ? "femenino" : "masculino",
      pesoKg:            Math.max(Number(body.profile.pesoKg)  || 70, 30),
      alturaCm:          Math.max(Number(body.profile.alturaCm) || 170, 100),
      edad:              Math.max(Math.min(Number(body.profile.edad) || 25, 100), 10),
      actividad:         body.profile.actividad || "moderado",
      objetivo:          body.profile.objetivo  || "mantenimiento",
      observaciones:     body.profile.observaciones,
      comidasDia:        body.profile.comidasDia        ? Number(body.profile.comidasDia)        : undefined,
      diasEntrenamiento: body.profile.diasEntrenamiento ? Number(body.profile.diasEntrenamiento) : undefined,
      restricciones:     body.profile.restricciones,
      condicionesMedicas: body.profile.condicionesMedicas,
    };

    let result;
    if (body.mode === "adapt" && body.basePlan) {
      result = adaptNutritionPlan(profile, body.basePlan);
    } else {
      result = buildNutritionPlan(profile);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[nutrition/adapt]", err);
    return NextResponse.json({ ok: false, error: "Error al adaptar el plan" }, { status: 500 });
  }
}
