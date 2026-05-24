import { prisma } from "./prisma";

const db = prisma as any;

/**
 * Registra una acción del SUPERADMIN en el audit log.
 * Nunca lanza excepciones — siempre fire-and-forget.
 */
export async function logAudit(
  accion: string,
  detalle: string,
  profesorEmail?: string | null
): Promise<void> {
  try {
    await db.auditLog.create({
      data: { accion, detalle, profesorEmail: profesorEmail ?? null },
    });
  } catch { /* nunca bloquear por falla de auditoría */ }
}
