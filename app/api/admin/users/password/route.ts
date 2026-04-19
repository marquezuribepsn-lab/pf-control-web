import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { upsertClientPasswordSnapshot } from "@/lib/adminPasswordStore";

const db = prisma as any;

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
    const customPassword = normalizePassword(body?.password);

    if (!userId) {
      return NextResponse.json({ message: "userId requerido" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
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
