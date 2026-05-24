import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// POST /api/superadmin/profesores/import
// Body: { rows: Array<{ email, nombre, telefono?, password?, plan?, maxAlumnos? }> }
export async function POST(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows: any[] = body.rows ?? [];

  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "No hay filas para importar" }, { status: 400 });

  const created: string[] = [];
  const skipped: string[] = [];
  const errors: { email: string; reason: string }[] = [];

  for (const row of rows) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      errors.push({ email: email || "(vacío)", reason: "Email inválido" });
      continue;
    }

    // Check duplicate
    const exists = await db.user.findUnique({ where: { email }, select: { id: true } }).catch(() => null);
    if (exists) { skipped.push(email); continue; }

    const nombre   = String(row.nombre ?? row.nombreCompleto ?? "").trim() || "Sin nombre";
    const telefono = String(row.telefono ?? "").trim() || null;
    const planTipo = (["basico","pro","elite"].includes(row.plan)) ? row.plan : "basico";
    const maxAlumnos = Number(row.maxAlumnos) > 0 ? Number(row.maxAlumnos) : 30;
    const maxPlanes  = Number(row.maxPlanes)  > 0 ? Number(row.maxPlanes)  : 5;
    const rawPass  = String(row.password ?? "").trim();
    const password = rawPass.length >= 6 ? rawPass : Math.random().toString(36).slice(-8);

    try {
      const hashed = await bcrypt.hash(password, 10);
      await db.user.create({
        data: {
          email,
          password: hashed,
          nombreCompleto: nombre,
          telefono,
          role: "ADMIN",
          emailVerified: true,
          estado: "activo",
          subscription: {
            create: {
              planTipo,
              maxAlumnos,
              maxPlanes,
              estado: "trial",
            },
          },
        },
      });
      created.push(email);
    } catch (e: any) {
      errors.push({ email, reason: e?.message ?? "Error desconocido" });
    }
  }

  if (created.length > 0) {
    await logAudit(
      "importacion_profesores",
      `Importados ${created.length} profesores (${skipped.length} omitidos, ${errors.length} errores)`,
      null
    );
  }

  return NextResponse.json({ ok: true, created, skipped, errors });
}
