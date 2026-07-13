import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  upsertClientPasswordSnapshot,
  getClientPasswordSnapshotByUserId,
} from "@/lib/adminPasswordStore";
import { getClientMetaMap, saveClientMetaMap } from "@/lib/billing";

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
 * Sincroniza el email de la ficha del alumno (ClienteMeta, en el sync store) con
 * el email de login. Es CLAVE para el acceso: /api/payments/status resuelve el
 * pase del alumno buscando la ficha por `meta.email`. Si la ficha no tiene el
 * mismo email que la cuenta, el alumno queda bloqueado aunque tenga pase activo.
 */
async function syncFichaEmail(clientKey: string, email: string): Promise<void> {
  const key = String(clientKey || "").trim();
  const normalizedEmail = normalizeEmail(email);
  if (!key.startsWith("alumno:") || !normalizedEmail) {
    return;
  }
  try {
    const metaMap = await getClientMetaMap();
    const existing = metaMap[key];
    if (existing && typeof existing === "object") {
      metaMap[key] = { ...(existing as Record<string, unknown>), email: normalizedEmail };
      await saveClientMetaMap(metaMap);
    }
  } catch (error) {
    console.error("[admin/users/password] syncFichaEmail error", error);
  }
}

/**
 * Búsqueda de usuario a prueba de P2023: la tabla `users` tiene filas con
 * datos inconsistentes en algunas columnas (fechas/enum) que hacen fallar la
 * materialización normal de Prisma. Seleccionamos sólo columnas seguras con
 * SQL crudo para poder resolver la cuenta igualmente.
 */
async function findUserSafe(opts: { userId?: string; email?: string }): Promise<SafeUser | null> {
  const byId = Boolean(opts.userId);
  const where = byId ? "id = ?" : "LOWER(email) = ?";
  const param = byId ? String(opts.userId) : String(opts.email || "").trim().toLowerCase();

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
    const clientKey = String(body?.clientKey || "").trim();

    if (!userId && !bodyEmail) {
      return NextResponse.json({ message: "userId o email requerido" }, { status: 400 });
    }

    const user = await findUserSafe(userId ? { userId } : { email: bodyEmail });

    // La ficha del alumno todavía no tiene cuenta de login: la creamos acá.
    // Así "Establecer accesos" da de alta el acceso en vez de fallar.
    if (!user) {
      const createEmail = newEmail || bodyEmail;
      if (!createEmail || !isValidEmail(createEmail)) {
        return NextResponse.json(
          { message: "Cargá un email válido en la ficha para crear el acceso del alumno." },
          { status: 400 }
        );
      }

      const nextPassword = customPassword || generateTemporaryPassword();
      if (nextPassword.length < 6) {
        return NextResponse.json(
          { message: "La contraseña debe tener al menos 6 caracteres." },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(nextPassword, 10);
      const newId = randomUUID();
      const nombre = String(body?.nombre || "").trim() || "Sin nombre";
      // Prisma/SQLite guarda DateTime como epoch en milisegundos (número), no ISO.
      // Usar ms evita generar filas con datos inconsistentes (P2023) al leerlas.
      const nowMs = Date.now();

      try {
        // emailVerified=1 y estado='activo': el admin habilita el acceso directo,
        // por eso la cuenta puede iniciar sesión sin el paso de verificación por mail.
        // fechaNacimiento: su DEFAULT es un string que Prisma no puede parsear (P2023).
        // Lo fijamos como epoch ms (2000-01-01) para que la fila sea 100% legible.
        const fechaNacimientoMs = Date.UTC(2000, 0, 1);
        await db.$executeRawUnsafe(
          `INSERT INTO users (id, email, password, role, "emailVerified", estado, "updatedAt", "createdAt", "fechaNacimiento", "nombreCompleto") VALUES (?, ?, ?, 'CLIENTE', 1, 'activo', ?, ?, ?, ?)`,
          newId,
          createEmail,
          hashedPassword,
          nowMs,
          nowMs,
          fechaNacimientoMs,
          nombre
        );
      } catch (error) {
        console.error("[admin/users/password] create account error", error);
        return NextResponse.json(
          { message: "No se pudo crear el acceso. Puede que el email ya esté en uso." },
          { status: 409 }
        );
      }

      const snapshot = await upsertClientPasswordSnapshot({
        userId: newId,
        email: createEmail,
        visiblePassword: nextPassword,
        source: "admin_reset",
        updatedByRole: "ADMIN",
        updatedByEmail: normalizeEmail(session.user.email),
      });

      // Vincular la ficha del alumno con el email de login recién creado.
      await syncFichaEmail(clientKey, createEmail);

      return NextResponse.json({
        ok: true,
        message: "Acceso creado. Compartí el email y la contraseña con el alumno.",
        created: true,
        userId: newId,
        email: createEmail,
        emailChanged: false,
        passwordChanged: true,
        visiblePassword: nextPassword,
        snapshot,
      });
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

    // Mantener la ficha del alumno vinculada al email de login vigente, para que
    // el billing pueda resolver su pase (sea que cambió el email o no).
    await syncFichaEmail(clientKey, effectiveEmail);

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
