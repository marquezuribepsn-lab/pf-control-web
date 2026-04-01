import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSyncValue } from "@/lib/syncStore";

type Recipient = {
  id: string;
  label: string;
  tipo: "alumno" | "colaborador";
  telefono: string;
  variables: Record<string, string>;
};

const db = prisma as any;

function normalizeKey(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePhone(input: string) {
  const digits = String(input || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("549") && digits.length >= 12) return digits;
  if (digits.startsWith("54") && digits.length >= 12) return `549${digits.slice(2)}`;
  if (digits.length === 10) return `549${digits}`;
  return "";
}

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [users, alumnosRaw, clientesMetaRaw] = await Promise.all([
    db.user.findMany({
      where: {
        OR: [{ role: "COLABORADOR" }, { role: "CLIENTE" }],
      },
      select: {
        id: true,
        role: true,
        nombreCompleto: true,
        email: true,
        telefono: true,
      },
      orderBy: { nombreCompleto: "asc" },
      take: 500,
    }),
    getSyncValue("pf-control-alumnos"),
    getSyncValue("pf-control-clientes-meta-v1"),
  ]);

  const recipients: Recipient[] = [];

  for (const user of users) {
    const phone = normalizePhone(user.telefono || "");
    if (!phone) continue;

    const isColab = user.role === "COLABORADOR";
    recipients.push({
      id: `user-${user.id}`,
      label: `${user.nombreCompleto || user.email}${isColab ? " (colaborador)" : ""}`,
      tipo: isColab ? "colaborador" : "alumno",
      telefono: phone,
      variables: {
        nombre: String(user.nombreCompleto || user.email || ""),
        email: String(user.email || ""),
        actividad: isColab ? "colaboracion" : "entrenamiento",
      },
    });
  }

  const alumnos = Array.isArray(alumnosRaw) ? alumnosRaw : [];
  const clientesMeta =
    clientesMetaRaw && typeof clientesMetaRaw === "object"
      ? (clientesMetaRaw as Record<string, any>)
      : {};

  const metaByName = new Map<string, any>();
  for (const [key, value] of Object.entries(clientesMeta)) {
    metaByName.set(normalizeKey(key), value);
  }

  for (const alumno of alumnos) {
    const nombre = String((alumno as any)?.nombre || "").trim();
    if (!nombre) continue;
    const meta = metaByName.get(normalizeKey(nombre)) || null;
    const phone = normalizePhone(String(meta?.telefono || ""));
    if (!phone) continue;

    const id = `alumno-${normalizeKey(nombre)}`;
    if (recipients.some((item) => item.id === id || item.telefono === phone)) {
      continue;
    }

    recipients.push({
      id,
      label: nombre,
      tipo: "alumno",
      telefono: phone,
      variables: {
        nombre,
        actividad: "entrenamiento",
      },
    });
  }

  recipients.sort((a, b) => a.label.localeCompare(b.label));
  return NextResponse.json({ ok: true, recipients });
}
