import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeWhatsAppPhone } from "@/lib/whatsappAlerts";

const db = prisma as any;

type ContactSource = "asignado" | "colaborador" | "admin";

type ContactCandidate = {
  id: string;
  nombreCompleto?: string | null;
  role?: string | null;
  telefono?: string | null;
  estado?: string | null;
};

function normalizePhoneForChat(input: unknown): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const strict = normalizeWhatsAppPhone(raw);
  if (strict) return strict;

  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;

  if (digits.startsWith("00") && digits.length > 4) {
    return normalizePhoneForChat(digits.slice(2));
  }

  if (digits.startsWith("549") && digits.length >= 12) {
    return digits;
  }

  if (digits.startsWith("54") && digits.length >= 12) {
    return `549${digits.slice(2)}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `549${digits.slice(1)}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }

  return null;
}

function toContactoPayload(candidate: ContactCandidate, source: ContactSource) {
  const waPhone = normalizePhoneForChat(candidate.telefono);
  if (!waPhone) return null;

  const role = String(candidate.role || "COLABORADOR").toUpperCase();
  const nombre =
    String(candidate.nombreCompleto || "").trim() ||
    (role === "ADMIN" ? "Administrador" : "Profesor");

  return {
    id: String(candidate.id || ""),
    nombre,
    role,
    telefono: String(candidate.telefono || "").trim(),
    waPhone,
    source,
  };
}

function isActive(candidate: ContactCandidate): boolean {
  const estado = String(candidate.estado || "activo").trim().toLowerCase();
  return estado !== "suspendido" && estado !== "baja";
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const userId = String(session.user.id);

    const currentUser = (await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    })) as { id: string; role: string } | null;

    if (!currentUser) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    let contacto: ReturnType<typeof toContactoPayload> | null = null;

    if (String(currentUser.role || "").toUpperCase() === "CLIENTE") {
      const asignaciones = (await db.alumnoAsignado.findMany({
        where: { alumnoId: userId },
        include: {
          colaborador: {
            select: {
              id: true,
              nombreCompleto: true,
              role: true,
              telefono: true,
              estado: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })) as Array<{
        puedeEditar?: boolean;
        createdAt?: string;
        colaborador?: ContactCandidate | null;
      }>;

      const linked = asignaciones
        .slice()
        .sort((a, b) => Number(Boolean(b.puedeEditar)) - Number(Boolean(a.puedeEditar)))
        .map((row) => row.colaborador)
        .filter((row): row is ContactCandidate => Boolean(row))
        .find((row) => {
          const role = String(row.role || "").toUpperCase();
          return role === "COLABORADOR" && isActive(row) && Boolean(normalizePhoneForChat(row.telefono));
        });

      if (linked) {
        contacto = toContactoPayload(linked, "asignado");
      }
    }

    if (!contacto) {
      const colaborador = (await db.user.findFirst({
        where: {
          role: "COLABORADOR",
          telefono: { not: null },
        },
        select: {
          id: true,
          nombreCompleto: true,
          role: true,
          telefono: true,
          estado: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      })) as ContactCandidate | null;

      if (colaborador && isActive(colaborador)) {
        contacto = toContactoPayload(colaborador, "colaborador");
      }
    }

    if (!contacto) {
      const admin = (await db.user.findFirst({
        where: {
          role: "ADMIN",
          telefono: { not: null },
        },
        select: {
          id: true,
          nombreCompleto: true,
          role: true,
          telefono: true,
          estado: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      })) as ContactCandidate | null;

      if (admin && isActive(admin)) {
        contacto = toContactoPayload(admin, "admin");
      }
    }

    if (!contacto) {
      return NextResponse.json(
        { ok: false, error: "No hay un numero de telefono de profesor/admin configurado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, contacto });
  } catch (error) {
    console.error("[api/alumnos/profesor-contacto]", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo resolver el contacto del profesor" },
      { status: 500 }
    );
  }
}
