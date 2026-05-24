import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlanPrecios, savePlanPrecios, PlanPrecio } from "@/lib/billing";

function nowIso() {
  return new Date().toISOString();
}

function createPlanId() {
  return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 });
  }

  const planes = await getPlanPrecios();
  return NextResponse.json({ ok: true, planes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const existingId = String(body.id || "").trim();

  const nombre = String(body.nombre || "").trim();
  if (!nombre) {
    return NextResponse.json({ message: "El nombre del plan es requerido" }, { status: 400 });
  }

  const precio = Number(body.precio);
  if (!Number.isFinite(precio) || precio <= 0) {
    return NextResponse.json({ message: "El precio debe ser mayor a 0" }, { status: 400 });
  }

  const duracionDias = Math.max(1, Math.min(365, Math.round(Number(body.duracionDias) || 30)));
  const moneda = String(body.moneda || "ARS").trim().toUpperCase() || "ARS";
  const descripcion = String(body.descripcion || "").trim();
  const activo = body.activo !== false;
  const now = nowIso();

  const planes = await getPlanPrecios();

  if (existingId) {
    const index = planes.findIndex((p) => p.id === existingId);
    if (index < 0) {
      return NextResponse.json({ message: "Plan no encontrado" }, { status: 404 });
    }

    planes[index] = { ...planes[index], nombre, precio, moneda, duracionDias, descripcion, activo, updatedAt: now };
    await savePlanPrecios(planes);
    return NextResponse.json({ ok: true, plan: planes[index] });
  }

  const newPlan: PlanPrecio = {
    id: createPlanId(),
    nombre,
    precio,
    moneda,
    duracionDias,
    descripcion,
    activo,
    createdAt: now,
    updatedAt: now,
  };

  planes.push(newPlan);
  await savePlanPrecios(planes);
  return NextResponse.json({ ok: true, plan: newPlan });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ message: "ID del plan requerido" }, { status: 400 });
  }

  const planes = await getPlanPrecios();
  const filtered = planes.filter((p) => p.id !== id);

  if (filtered.length === planes.length) {
    return NextResponse.json({ message: "Plan no encontrado" }, { status: 404 });
  }

  await savePlanPrecios(filtered);
  return NextResponse.json({ ok: true });
}
