import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// GET /api/superadmin/profesores — 1 query total, zero N+1
export async function GET() {
  const session = await auth();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Single query: profesores + subscription + pagos en uno solo
  const profesores = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      email: true,
      nombreCompleto: true,
      telefono: true,
      estado: true,
      createdAt: true,
      notasInternas: true,
      subscription: {
        select: {
          id: true,
          planTipo: true,
          maxAlumnos: true,
          maxPlanes: true,
          estado: true,
          fechaInicio: true,
          fechaVencimiento: true,
          moneda: true,
          importe: true,
          periodoDias: true,
          notas: true,
          pagos: {
            orderBy: { fechaPago: "desc" },
            take: 30,
            select: {
              id: true,
              monto: true,
              moneda: true,
              metodoPago: true,
              fechaPago: true,
              periodoDesde: true,
              periodoHasta: true,
              notas: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Alumno counts: 1 groupBy query instead of N count queries
  const alumnosCounts = await db.alumnoAsignado.groupBy({
    by: ["colaboradorId"],
    _count: { _all: true },
  });
  const alumnosMap = new Map<string, number>(
    alumnosCounts.map((a: any) => [a.colaboradorId, a._count._all])
  );

  const result = profesores.map((p: any) => ({
    ...p,
    alumnosCount: alumnosMap.get(p.id) ?? 0,
  }));

  return NextResponse.json({ profesores: result });
}

// POST /api/superadmin/profesores — create new ADMIN user
export async function POST(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, nombreCompleto, password, planTipo, maxAlumnos, maxPlanes } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
  }

  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await db.user.create({
    data: {
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      nombreCompleto: nombreCompleto || "Sin nombre",
      role: "ADMIN",
      emailVerified: true,
      estado: "activo",
      subscription: {
        create: {
          planTipo: planTipo || "basico",
          maxAlumnos: maxAlumnos ?? 30,
          maxPlanes: maxPlanes ?? 5,
          estado: "trial",
        },
      },
    },
    select: { id: true, email: true, nombreCompleto: true, role: true, subscription: true },
  });

  return NextResponse.json({ profesor: user });
}
