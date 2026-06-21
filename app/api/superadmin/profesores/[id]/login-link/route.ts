import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const db = prisma as any;

// POST /api/superadmin/profesores/[id]/login-link
// Genera un link de acceso temporal de 1 hora para el profesor
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = await context.params;
  const user = await db.user.findUnique({
    where: { id: params.id, role: "ADMIN" },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });

  // Eliminar links viejos del mismo usuario
  await db.verificationToken.deleteMany({
    where: { userId: user.id, token: { startsWith: "login-link-" } },
  }).catch(() => {});

  const token    = `login-link-${crypto.randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await db.verificationToken.create({
    data: { email: user.email, token, expiresAt, userId: user.id },
  });

  const appUrl = (process.env.NEXTAUTH_URL || "https://pf-control.com").replace(/\/$/, "");
  const link   = `${appUrl}/auth/login?loginToken=${token}`;

  return NextResponse.json({ ok: true, link, expiresAt });
}
