import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PasswordSyncValue = {
  password?: string;
  passwordEncrypted?: string;
  passwordHash?: string;
  viewTokenHash?: string;
  viewTokenExpiresAt?: string;
  viewTokenUsedAt?: string;
  issuedAt?: string;
  issuedBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  source?: string;
};

const db = prisma as any;
const PASSWORD_ENCRYPTION_VERSION = "v1";
const VIEW_TOKEN_TTL_MS = 2 * 60 * 1000;

function getPasswordEncryptionKey() {
  const secret =
    String(process.env.ADMIN_PASSWORD_VIEW_SECRET || "").trim() ||
    String(process.env.NEXTAUTH_SECRET || "").trim();

  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

function encryptReadablePassword(value: string) {
  const key = getPasswordEncryptionKey();
  if (!key) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PASSWORD_ENCRYPTION_VERSION}:${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptReadablePassword(payload: string) {
  const key = getPasswordEncryptionKey();
  if (!key) {
    return null;
  }

  const parts = String(payload || "").split(":");
  if (parts.length !== 4) {
    return null;
  }

  const [version, ivRaw, authTagRaw, encryptedRaw] = parts;
  if (version !== PASSWORD_ENCRYPTION_VERSION) {
    return null;
  }

  try {
    const iv = Buffer.from(ivRaw, "base64url");
    const authTag = Buffer.from(authTagRaw, "base64url");
    const encrypted = Buffer.from(encryptedRaw, "base64url");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

function generateViewToken() {
  return randomBytes(24).toString("hex");
}

function hashViewToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyMatch(a: string, b: string) {
  const left = normalizeText(a);
  const right = normalizeText(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  const shared = leftTokens.filter((token) => rightTokens.includes(token));

  return shared.length >= 2 || shared.some((token) => token.length >= 5);
}

function getCredentialKey(userId: string) {
  return `user-password-admin:${userId}`;
}

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let password = "";
  for (let i = 0; i < bytes.length; i += 1) {
    password += alphabet[bytes[i] % alphabet.length];
  }
  return password;
}

async function resolveTargetUser(payload: any) {
  const requestedUserId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
  if (requestedUserId) {
    return db.user.findUnique({
      where: { id: requestedUserId },
      select: {
        id: true,
        email: true,
        role: true,
        nombreCompleto: true,
        estado: true,
        password: true,
      },
    });
  }

  const requestedEmail = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (requestedEmail) {
    return db.user.findUnique({
      where: { email: requestedEmail },
      select: {
        id: true,
        email: true,
        role: true,
        nombreCompleto: true,
        estado: true,
        password: true,
      },
    });
  }

  const requestedName = typeof payload?.nombreCompleto === "string" ? payload.nombreCompleto.trim() : "";
  const requestedRole = typeof payload?.role === "string" ? payload.role.trim().toUpperCase() : "";
  if (!requestedName) {
    return null;
  }

  const users = await db.user.findMany({
    where: requestedRole && ["ADMIN", "COLABORADOR", "CLIENTE"].includes(requestedRole)
      ? { role: requestedRole }
      : undefined,
    select: {
      id: true,
      email: true,
      role: true,
      nombreCompleto: true,
      estado: true,
      password: true,
    },
    take: 500,
  });

  const matches = users.filter((user: { nombreCompleto?: string }) =>
    namesLikelyMatch(String(user.nombreCompleto || ""), requestedName)
  );

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    return "AMBIGUOUS";
  }

  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const action = typeof payload?.action === "string" ? payload.action.trim().toLowerCase() : "";

    if (action !== "show" && action !== "reset" && action !== "issue-token") {
      return NextResponse.json({ message: "Accion invalida" }, { status: 400 });
    }

    const target = await resolveTargetUser(payload);

    if (!target) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
    }

    if (target === "AMBIGUOUS") {
      return NextResponse.json(
        { message: "Se encontraron varios usuarios. Usa email o userId para precisar." },
        { status: 409 }
      );
    }

    const targetUser = target as {
      id: string;
      email: string;
      role: string;
      nombreCompleto: string;
      estado: string;
      password: string;
    };

    const key = getCredentialKey(targetUser.id);
    const syncEntry = await db.syncEntry.findUnique({ where: { key } });
    const syncValue = (syncEntry?.value || {}) as PasswordSyncValue;

    const resolveSavedPassword = async () => {
      let savedPassword = "";
      if (typeof syncValue.passwordEncrypted === "string" && syncValue.passwordEncrypted) {
        savedPassword = decryptReadablePassword(syncValue.passwordEncrypted) || "";
      }

      if (!savedPassword && typeof syncValue.password === "string") {
        savedPassword = syncValue.password;
      }

      const savedHash = typeof syncValue.passwordHash === "string" ? syncValue.passwordHash : "";

      if (!savedPassword || !savedHash) {
        return {
          ok: false as const,
          response: NextResponse.json(
            {
              code: "PASSWORD_NOT_AVAILABLE",
              message: "No hay una contrasena consultable. Primero blanquea la contrasena.",
            },
            { status: 404 }
          ),
        };
      }

      if (savedHash !== targetUser.password) {
        await db.syncEntry.updateMany({
          where: { key },
          data: {
            value: {
              ...syncValue,
              password: null,
              passwordEncrypted: null,
              viewTokenHash: null,
              viewTokenExpiresAt: null,
              viewTokenUsedAt: null,
              updatedAt: new Date().toISOString(),
              source: "password-changed-by-user",
            },
          },
        });

        return {
          ok: false as const,
          response: NextResponse.json(
            {
              code: "PASSWORD_CHANGED",
              message: "El usuario ya modifico su contrasena, no puede ser consultada.",
            },
            { status: 409 }
          ),
        };
      }

      return {
        ok: true as const,
        savedPassword,
      };
    };

    if (action === "issue-token") {
      const resolved = await resolveSavedPassword();
      if (!resolved.ok) {
        return resolved.response;
      }

      const viewToken = generateViewToken();
      const viewTokenHash = hashViewToken(viewToken);
      const viewTokenExpiresAt = new Date(Date.now() + VIEW_TOKEN_TTL_MS).toISOString();

      await db.syncEntry.updateMany({
        where: { key },
        data: {
          value: {
            ...syncValue,
            viewTokenHash,
            viewTokenExpiresAt,
            viewTokenUsedAt: null,
            updatedAt: new Date().toISOString(),
            source: "admin-issue-view-token",
          },
        },
      });

      return NextResponse.json({
        ok: true,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
          nombreCompleto: targetUser.nombreCompleto,
          estado: targetUser.estado,
        },
        viewToken,
        viewTokenExpiresAt,
      });
    }

    if (action === "show") {
      const resolved = await resolveSavedPassword();
      if (!resolved.ok) {
        return resolved.response;
      }

      const requestViewToken =
        typeof payload?.viewToken === "string" ? payload.viewToken.trim() : "";
      const storedTokenHash =
        typeof syncValue.viewTokenHash === "string" ? syncValue.viewTokenHash : "";
      const storedTokenExpiresAt =
        typeof syncValue.viewTokenExpiresAt === "string" ? syncValue.viewTokenExpiresAt : "";

      if (!requestViewToken || !storedTokenHash || !storedTokenExpiresAt) {
        return NextResponse.json(
          {
            code: "VIEW_TOKEN_REQUIRED",
            message: "Solicita un token de visualizacion antes de ver la contrasena.",
          },
          { status: 400 }
        );
      }

      const expiresAtTime = new Date(storedTokenExpiresAt).getTime();
      if (!Number.isFinite(expiresAtTime) || expiresAtTime < Date.now()) {
        await db.syncEntry.updateMany({
          where: { key },
          data: {
            value: {
              ...syncValue,
              viewTokenHash: null,
              viewTokenExpiresAt: null,
              viewTokenUsedAt: null,
              updatedAt: new Date().toISOString(),
              source: "view-token-expired",
            },
          },
        });

        return NextResponse.json(
          {
            code: "VIEW_TOKEN_EXPIRED",
            message: "El token de visualizacion vencio. Solicita uno nuevo.",
          },
          { status: 410 }
        );
      }

      const requestTokenHash = hashViewToken(requestViewToken);
      if (requestTokenHash !== storedTokenHash) {
        return NextResponse.json(
          {
            code: "VIEW_TOKEN_INVALID",
            message: "Token de visualizacion invalido.",
          },
          { status: 401 }
        );
      }

      await db.syncEntry.updateMany({
        where: { key },
        data: {
          value: {
            ...syncValue,
            password: null,
            passwordEncrypted: null,
            viewTokenHash: null,
            viewTokenExpiresAt: null,
            viewTokenUsedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            source: "password-shown-once",
          },
        },
      });

      return NextResponse.json({
        ok: true,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
          nombreCompleto: targetUser.nombreCompleto,
          estado: targetUser.estado,
        },
        password: resolved.savedPassword,
        issuedAt: syncValue.issuedAt || syncValue.updatedAt || null,
      });
    }

    const nextPassword = generateTempPassword();
    const passwordEncrypted = encryptReadablePassword(nextPassword);
    if (!passwordEncrypted) {
      return NextResponse.json(
        { message: "Falta configurar secreto para gestionar contrasenas" },
        { status: 500 }
      );
    }

    const passwordHash = await bcrypt.hash(nextPassword, 10);

    await db.user.update({
      where: { id: targetUser.id },
      data: { password: passwordHash },
    });

    const now = new Date().toISOString();
    const updatedBy = String((session.user as any).email || (session.user as any).id || "admin");
    const viewToken = generateViewToken();
    const viewTokenHash = hashViewToken(viewToken);
    const viewTokenExpiresAt = new Date(Date.now() + VIEW_TOKEN_TTL_MS).toISOString();

    await db.syncEntry.upsert({
      where: { key },
      create: {
        key,
        value: {
          password: null,
          passwordEncrypted,
          passwordHash,
          viewTokenHash,
          viewTokenExpiresAt,
          viewTokenUsedAt: null,
          issuedAt: now,
          issuedBy: updatedBy,
          updatedAt: now,
          updatedBy,
          source: "admin-reset",
        },
      },
      update: {
        value: {
          ...(syncValue || {}),
          password: null,
          passwordEncrypted,
          passwordHash,
          viewTokenHash,
          viewTokenExpiresAt,
          viewTokenUsedAt: null,
          issuedAt: now,
          issuedBy: updatedBy,
          updatedAt: now,
          updatedBy,
          source: "admin-reset",
        },
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        role: targetUser.role,
        nombreCompleto: targetUser.nombreCompleto,
        estado: targetUser.estado,
      },
      viewToken,
      viewTokenExpiresAt,
      issuedAt: now,
      message: "Contrasena blanqueada correctamente",
    });
  } catch (error) {
    console.error("Admin password action error:", error);
    return NextResponse.json({ message: "Error al procesar contrasena" }, { status: 500 });
  }
}
