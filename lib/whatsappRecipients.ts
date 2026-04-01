import { prisma } from "@/lib/prisma";
import { getSyncValue } from "@/lib/syncStore";
import { normalizeWhatsAppPhone } from "@/lib/whatsappAlerts";

type RawPago = {
  clientName?: string;
  fecha?: string;
  importe?: number;
};

export type WhatsAppRecipient = {
  id: string;
  label: string;
  tipo: "alumno" | "colaborador";
  telefono: string;
  endDate?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
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

function parseDateOnly(value: string): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(`${raw.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffInDaysFromToday(dateValue: string): number | null {
  const parsed = parseDateOnly(dateValue);
  if (!parsed) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
}

function pickLatestPaymentByClientName(rows: RawPago[]) {
  const latest = new Map<string, RawPago>();

  for (const row of rows) {
    const clientName = normalizeKey(String(row.clientName || ""));
    if (!clientName) continue;

    const current = latest.get(clientName);
    const currentDate = current?.fecha ? parseDateOnly(current.fecha) : null;
    const nextDate = row.fecha ? parseDateOnly(row.fecha) : null;

    if (!current) {
      latest.set(clientName, row);
      continue;
    }

    if (!nextDate) {
      continue;
    }

    if (!currentDate || nextDate > currentDate) {
      latest.set(clientName, row);
    }
  }

  return latest;
}

export async function listWhatsAppRecipients(): Promise<WhatsAppRecipient[]> {
  const [users, alumnosRaw, clientesMetaRaw, pagosRaw] = await Promise.all([
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
      take: 1200,
    }),
    getSyncValue("pf-control-alumnos"),
    getSyncValue("pf-control-clientes-meta-v1"),
    getSyncValue("pf-control-pagos-v1"),
  ]);

  const alumnos = Array.isArray(alumnosRaw) ? alumnosRaw : [];
  const clientesMeta =
    clientesMetaRaw && typeof clientesMetaRaw === "object"
      ? (clientesMetaRaw as Record<string, any>)
      : {};
  const pagos = Array.isArray(pagosRaw) ? (pagosRaw as RawPago[]) : [];

  const metaByName = new Map<string, any>();
  for (const [key, value] of Object.entries(clientesMeta)) {
    metaByName.set(normalizeKey(key), value);
  }

  const latestPaymentByName = pickLatestPaymentByClientName(pagos);
  const recipients: WhatsAppRecipient[] = [];

  const pushRecipient = (candidate: {
    id: string;
    label: string;
    tipo: "alumno" | "colaborador";
    telefono: string;
    nombre: string;
    email?: string;
    actividad: string;
    endDate?: string;
    paymentDate?: string;
    paymentAmount?: number;
  }) => {
    const phone = normalizeWhatsAppPhone(candidate.telefono);
    if (!phone) return;

    if (recipients.some((item) => item.id === candidate.id || item.telefono === phone)) {
      return;
    }

    const days = candidate.endDate ? diffInDaysFromToday(candidate.endDate) : null;

    recipients.push({
      id: candidate.id,
      label: candidate.label,
      tipo: candidate.tipo,
      telefono: phone,
      endDate: candidate.endDate,
      lastPaymentDate: candidate.paymentDate,
      lastPaymentAmount: candidate.paymentAmount,
      variables: {
        nombre: candidate.nombre,
        email: String(candidate.email || ""),
        actividad: candidate.actividad,
        dias: days === null ? "" : String(days),
        fecha: String(candidate.endDate || ""),
        vencimiento: String(candidate.endDate || ""),
        total:
          typeof candidate.paymentAmount === "number" && Number.isFinite(candidate.paymentAmount)
            ? String(candidate.paymentAmount)
            : "",
      },
    });
  };

  for (const user of users) {
    const displayName = String(user.nombreCompleto || user.email || "").trim();
    if (!displayName) continue;

    const normalized = normalizeKey(displayName);
    const meta = metaByName.get(normalized) || null;
    const payment = latestPaymentByName.get(normalized) || null;
    const isColab = user.role === "COLABORADOR";

    pushRecipient({
      id: `user-${user.id}`,
      label: `${displayName}${isColab ? " (colaborador)" : ""}`,
      tipo: isColab ? "colaborador" : "alumno",
      telefono: String(user.telefono || meta?.telefono || ""),
      nombre: displayName,
      email: String(user.email || ""),
      actividad: isColab ? "colaboracion" : "entrenamiento",
      endDate: String(meta?.endDate || ""),
      paymentDate: String(payment?.fecha || ""),
      paymentAmount:
        typeof payment?.importe === "number" && Number.isFinite(payment.importe)
          ? payment.importe
          : undefined,
    });
  }

  for (const alumno of alumnos) {
    const nombre = String((alumno as any)?.nombre || "").trim();
    if (!nombre) continue;

    const normalized = normalizeKey(nombre);
    const meta = metaByName.get(normalized) || null;
    const payment = latestPaymentByName.get(normalized) || null;

    pushRecipient({
      id: `alumno-${normalized}`,
      label: nombre,
      tipo: "alumno",
      telefono: String(meta?.telefono || ""),
      nombre,
      actividad: "entrenamiento",
      endDate: String(meta?.endDate || ""),
      paymentDate: String(payment?.fecha || ""),
      paymentAmount:
        typeof payment?.importe === "number" && Number.isFinite(payment.importe)
          ? payment.importe
          : undefined,
    });
  }

  recipients.sort((a, b) => a.label.localeCompare(b.label));
  return recipients;
}
