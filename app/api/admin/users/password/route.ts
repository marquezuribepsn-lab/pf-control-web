import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  upsertClientPasswordSnapshot,
  getClientPasswordSnapshotByUserId,
} from "@/lib/adminPasswordStore";

const db = prisma as any;

/**
 * Devuelve la contraseña visible guardada para un alumno (si la definió el admin).
 * Solo accesible para ADMIN. Se resuelve por userId o email.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const userIdParam = String(req.nextUrl.searchParams.get("userId") || "").trim();
  const emailParam = normalizeEmail(req.nextUrl.searchParams.get("email"));

  if (!userIdParam && !emailParam) {
    return NextResponse.json({ message: "userId o email requerido" }, { status: 400 });
  }

  const user = userIdParam
    ? await db.user.findUnique({ where: { id: userIdParam }, select: { id: true, email: true } })
    : await db.user.findUnique({ where: { email: emailParam }, select: { id: true, email: true } });

  if (!user) {
    return NextResponse.json({ ok: true, hasAccount: false, visiblePassword: null });
  }

  const snapshot = await getClientPasswordSnapshotByUserId(user.id);
  return NextResponse.json({
    ok: true,
    hasAccount: true,
    visiblePassword: snapshot?.visiblePassword || null,
    updatedAt: snapshot?.updatedAt || null,
    source: snapshot?.source || null,
  });
}

function normalizePassword(raw: unknown): string {
  return typeof raw === "string" ? raw.normalize("NFKC").trim() : "";
}

function normalizeEmail(raw: unknown): string {
  return String(raw || "").trim().toLowerCase();
}

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let value = "PF";
  for (let i = 0; i < 8; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const bodyEmail = normalizeEmail(body?.email);
    const customPassword = normalizePassword(body?.password);

    if (!userId && !bodyEmail) {
      return NextResponse.json({ message: "userId o email requerido" }, { status: 400 });
    }

    const user = userId
      ? await db.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, role: true },
        })
      : await db.user.findUnique({
          where: { email: bodyEmail },
          select: { id: true, email: true, role: true },
        });

    if (!user) {
      return NextResponse.json(
        { message: "No se encontró la cuenta del alumno. Verificá el email en la ficha." },
        { status: 404 }
      );
    }

    if (String(user.role || "").toUpperCase() !== "CLIENTE") {
      return NextResponse.json(
        { message: "Solo se permite blanquear contrasenas de clientes" },
        { status: 400 }
      );
    }

    const nextPassword = customPassword || generateTemporaryPassword();
    if (nextPassword.length < 6) {
      return NextResponse.json(
        { message: "La contrasena debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(nextPassword, 10);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
      select: { id: true },
    });

    await db.verificationToken
      .deleteMany({
        where: {
          email: normalizeEmail(user.email),
          token: { startsWith: "login-link-" },
        },
      })
      .catch(() => null);

    await db.passwordResetToken
      .deleteMany({
        where: {
          email: normalizeEmail(user.email),
        },
      })
      .catch(() => null);

    const snapshot = await upsertClientPasswordSnapshot({
      userId: user.id,
      email: normalizeEmail(user.email),
      visiblePassword: nextPassword,
      source: "admin_reset",
      updatedByRole: "ADMIN",
      updatedByEmail: normalizeEmail(session.user.email),
    });

    return NextResponse.json({
      ok: true,
      message: "Contrasena blanqueada correctamente",
      userId: user.id,
      email: normalizeEmail(user.email),
      visiblePassword: nextPassword,
      snapshot,
    });
  } catch (error) {
    console.error("[admin/users/password] error", error);
    return NextResponse.json({ message: "No se pudo blanquear la contrasena" }, { status: 500 });
  }
}
