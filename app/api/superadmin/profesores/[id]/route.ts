import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

function isSuperAdmin(session: any) {
  return session?.user?.role === "SUPERADMIN";
}

// GET /api/superadmin/profesores/[id]
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = await context.params;
  const profesor = await db.user.findUnique({
    where: { id: params.id, role: "ADMIN" },
    select: {
      id: true,
      email: true,
      nombreCompleto: true,
      telefono: true,
      estado: true,
      createdAt: true,
      notasInternas: true,
      subscription: {
        include: { pagos: { orderBy: { fechaPago: "desc" }, take: 20 } },
      },
    },
  });

  if (!profesor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const alumnosCount = await db.alumnoAsignado.count({ where: { colaboradorId: params.id } });

  return NextResponse.json({ profesor: { ...profesor, alumnosCount } });
}

// PATCH /api/superadmin/profesores/[id] — update estado, datos personales
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = await context.params;
  const body = await req.json();
  const { estado, nombreCompleto, telefono, email, newPassword, notasInternas } = body;

  const updateData: any = {};
  if (estado          !== undefined) updateData.estado          = estado;
  if (nombreCompleto  !== undefined) updateData.nombreCompleto  = nombreCompleto;
  if (telefono        !== undefined) updateData.telefono        = telefono;
  if (email           !== undefined) updateData.email           = email;
  if (notasInternas   !== undefined) updateData.notasInternas   = notasInternas || null;
  if (newPassword) {
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ error: "Contraseña mínimo 6 caracteres" }, { status: 400 });
    }
    updateData.password = await bcrypt.hash(newPassword, 12);
  }

  const updated = await db.user.update({
    where: { id: params.id },
    data: updateData,
    select: { id: true, email: true, nombreCompleto: true, estado: true, telefono: true },
  });

  // Audit
  const detalles: string[] = [];
  if (newPassword)            detalles.push("cambió contraseña");
  if (estado)                 detalles.push(`cambió estado → ${estado}`);
  if (nombreCompleto)         detalles.push("actualizó nombre");
  if (email)                  detalles.push("actualizó email");
  if (telefono !== undefined) detalles.push("actualizó teléfono");
  if (detalles.length) await logAudit("profesor_editado", detalles.join(" · "), updated.email);

  return NextResponse.json({ profesor: updated });
}

// DELETE /api/superadmin/profesores/[id] — soft delete (set estado = baja)
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = await context.params;
  const user = await db.user.findUnique({ where: { id: params.id }, select: { email: true } }).catch(() => null);
  await db.user.update({
    where: { id: params.id },
    data: { estado: "baja" },
  });
  await logAudit("profesor_eliminado", "Dado de baja (soft delete)", user?.email ?? null);
  return NextResponse.json({ ok: true });
}
