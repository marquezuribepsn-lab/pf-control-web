import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export type SessionRole = "SUPERADMIN" | "ADMIN" | "COLABORADOR" | "CLIENTE";

export type SessionUser = {
  id: string;
  email: string;
  role: SessionRole;
};

/** Roles del staff (gestionan el negocio). Excluye a CLIENTE/alumno. */
export const STAFF_ROLES: SessionRole[] = ["SUPERADMIN", "ADMIN", "COLABORADOR"];

/** Roles con acceso administrativo total a un profesor. */
export const ADMIN_ROLES: SessionRole[] = ["SUPERADMIN", "ADMIN"];

/**
 * Devuelve el usuario de la sesión actual o null si no hay sesión válida.
 * Centraliza la lectura de `auth()` para los route handlers de la API.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; role?: string }
    | undefined;

  if (!user?.id) {
    return null;
  }

  return {
    id: String(user.id),
    email: String(user.email || "").trim().toLowerCase(),
    role: String(user.role || "").trim().toUpperCase() as SessionRole,
  };
}

export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.includes(String(role || "").trim().toUpperCase() as SessionRole);
}

export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(String(role || "").trim().toUpperCase() as SessionRole);
}

/** Permisos granulares de un colaborador (qué puede editar / ver). */
export type ColaboradorPermisos = {
  puedeEditarRegistros: boolean;
  puedeEditarPlanes: boolean;
  puedeVerTodosAlumnos: boolean;
};

/**
 * Lee los flags de permisos de un colaborador desde la base.
 * Fail-closed: ante cualquier error devuelve todo en `false` (bloquea),
 * que es el default seguro para un control de permisos.
 */
export async function getColaboradorPermisos(userId: string): Promise<ColaboradorPermisos> {
  try {
    const u = await db.user.findUnique({
      where: { id: userId },
      select: {
        puedeEditarRegistros: true,
        puedeEditarPlanes: true,
        puedeVerTodosAlumnos: true,
      },
    });
    return {
      puedeEditarRegistros: Boolean(u?.puedeEditarRegistros),
      puedeEditarPlanes: Boolean(u?.puedeEditarPlanes),
      puedeVerTodosAlumnos: Boolean(u?.puedeVerTodosAlumnos),
    };
  } catch {
    return {
      puedeEditarRegistros: false,
      puedeEditarPlanes: false,
      puedeVerTodosAlumnos: false,
    };
  }
}
