import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  upsertClientPasswordSnapshot,
  getClientPasswordSnapshotByUserId,
} from "@/lib/adminPasswordStore";

const db = prisma as any;

function normalizePassword(raw: unknown): string {
  return typeof raw === "string" ? raw.normalize("NFKC").trim() : "";
}

function normalizeEmail(raw: unknown): string {
  return String(raw || "").trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let value = "PF";
  for (let i = 0; i < 8; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

type SafeUser = { id: string; email: string; role: string };

/**
 * Búsqueda de usuario a prueba de P2023: la tabla `users` tiene filas con
 * datos inconsistentes en algunas columnas (fechas/enum) que hacen fallar la
 * materialización normal de Prisma. Seleccionamos sólo columnas seguras con
 * SQL crudo para poder resolver la cuenta igualmente.
 */
async function findUserSafe(opts: { userId?: string; email?: string }): Promise<SafeUser | null> {
  const byId = Boolean(opts.userId);
  const where = byId ? "id = ?" : "email = ?";
  const param = byId ? String(opts.userId) : String(opts.email);

  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT id, email, role FROM users WHERE ${where} LIMIT 1`,
      param
    )) as Array<Record<string, unknown>>;

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: String(row.id || ""),
      email: String(row.email || ""),
      role: String(row.role || ""),
    };
  } catch (error) {
    console.error("[admin/users/password] findUserSafe error", error);
    return null;
  }
}

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

  const user = await findUserSafe(
    userIdParam ? { userId: userIdParam } : { email: emailParam }
  );

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
    const generatePassword = Boolean(body?.generatePassword);
    const newEmail = normalizeEmail(body?.newEmail);

    if (!userId && !bodyEmail) {
      return NextResponse.json({ message: "userId o email requerido" }, { status: 400 });
    }

    const user = await findUserSafe(userId ? { userId } : { email: bodyEmail });

    if (!user) {
      return NextResponse.json(
        { message: "No se encontró la cuenta del alumno. Verificá el email en la ficha." },
        { status: 404 }
      );
    }

    if (user.role.toUpperCase() !== "CLIENTE") {
      return NextResponse.json(
        { message: "Solo se permite editar el acceso de alumnos (clientes)." },
        { status: 400 }
      );
    }

    const currentEmail = normalizeEmail(user.email);
    // ¿Se pidió cambiar el email de login?
    const wantsEmailChange = Boolean(newEmail) && newEmail !== currentEmail;
    // ¿Se pidió tocar la contraseña? (manual, o generar una nueva)
    const wantsPasswordChange = generatePassword || Boolean(customPassword);

    if (!wantsEmailChange && !wantsPasswordChange) {
      return NextResponse.json(
        { message: "No hay cambios para aplicar. Editá el email o definí una contraseña." },
        { status: 400 }
      );
    }

    // 1) Cambio de email de login (si corresponde).
    if (wantsEmailChange) {
      if (!isValidEmail(newEmail)) {
        return NextResponse.json(
          { message: "El nuevo email no tiene un formato válido." },
          { status: 400 }
        );
      }
      const taken = await findUserSafe({ email: newEmail });
      if (taken && taken.id !== user.id) {
        return NextResponse.json(
          { message: "Ese email ya está en uso por otra cuenta." },
          { status: 409 }
        );
      }
      await db.$executeRawUnsafe(
        `UPDATE users SET email = ? WHERE id = ?`,
        newEmail,
        user.id
      );
    }

    // Email vigente tras el posible cambio (para tokens y snapshot).
    const effectiveEmail = wantsEmailChange ? newEmail : currentEmail;

    // 2) Cambio de contraseña (si corresponde).
    let nextPassword: string | null = null;
    if (wantsPasswordChange) {
      nextPassword = customPassword || generateTemporaryPassword();
      if (nextPassword.length < 6) {
        return NextResponse.json(
          { message: "La contraseña debe tener al menos 6 caracteres." },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(nextPassword, 10);
      // Update por SQL crudo para no tocar las columnas con datos inconsistentes.
      await db.$executeRawUnsafe(
        `UPDATE users SET password = ? WHERE id = ?`,
        hashedPassword,
        user.id
      );
    }

    // Invalidar magic-links / tokens de reset del email anterior y el nuevo.
    for (const mail of new Set([currentEmail, effectiveEmail])) {
      if (!mail) continue;
      await db.verificationToken
        .deleteMany({ where: { email: mail, token: { startsWith: "login-link-" } } })
        .catch(() => null);
      await db.passwordResetToken.deleteMany({ where: { email: mail } }).catch(() => null);
    }

    // 3) Snapshot: sólo persistimos texto visible cuando se definió una contraseña.
    let snapshot = null;
    if (wantsPasswordChange && nextPassword) {
      snapshot = await upsertClientPasswordSnapshot({
        userId: user.id,
        email: effectiveEmail,
        visiblePassword: nextPassword,
        source: "admin_reset",
        updatedByRole: "ADMIN",
        updatedByEmail: normalizeEmail(session.user.email),
      });
    }

    const message = wantsEmailChange && wantsPasswordChange
      ? "Email y contraseña actualizados correctamente"
      : wantsEmailChange
        ? "Email de acceso actualizado correctamente"
        : "Contraseña actualizada correctamente";

    return NextResponse.json({
      ok: true,
      message,
      userId: user.id,
      email: effectiveEmail,
      emailChanged: wantsEmailChange,
      passwordChanged: wantsPasswordChange,
      visiblePassword: nextPassword,
      snapshot,
    });
  } catch (error) {
    console.error("[admin/users/password] error", error);
    return NextResponse.json({ message: "No se pudo actualizar la contraseña." }, { status: 500 });
  }
}
