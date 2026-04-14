import { prisma } from "@/lib/prisma";
import { getSyncValue } from "@/lib/syncStore";
import { normalizeWhatsAppPhone } from "@/lib/whatsappAlerts";

type RawPago = {
  clientName?: string;
  fecha?: string;
  importe?: number;
};

type DataUpdateEvent = {
  id?: string;
  clientKey?: string;
  nombre?: string;
  updatedAt?: string;
  consumedAt?: string | null;
};

type SemanaPlanStore = {
  planes?: Array<{
    ownerKey?: string;
    semanas?: Array<{
      dias?: Array<{
        planificacion?: string;
        sesionId?: string;
      }>;
    }>;
    historial?: Array<{
      createdAt?: string;
    }>;
  }>;
};

export type WhatsAppRecipient = {
  id: string;
  label: string;
  tipo: "alumno" | "colaborador";
  ownerKey?: string;
  telefono: string;
  actividad?: string;
  daysToDue?: number | null;
  paymentStatus?: string;
  planStatus?: string;
  hasPendingPlanUpdate?: boolean;
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

function compactLookupKey(value: string) {
  return normalizeKey(value).replace(/[^a-z0-9]/g, "");
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

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function derivePaymentStatus(daysToDue: number | null, rawPagoEstado: unknown) {
  const fromMeta = normalizeKey(String(rawPagoEstado || ""));

  if (fromMeta.includes("vencid") || fromMeta.includes("moros")) {
    return "vencido";
  }
  if (fromMeta.includes("pend")) {
    return "pendiente";
  }
  if (fromMeta.includes("confirm") || fromMeta.includes("pag")) {
    return "al_dia";
  }

  if (daysToDue === null) return "sin_vencimiento";
  if (daysToDue < 0) return "vencido";
  if (daysToDue === 0) return "vence_hoy";
  if (daysToDue <= 3) return "vence_pronto";
  return "al_dia";
}

function getOwnerKeyFromName(nombre: string) {
  const normalized = String(nombre || "").trim().toLowerCase();
  if (!normalized) return "";
  return `alumnos:${normalized}`;
}

function buildMetaLookup(metaStore: Record<string, any>) {
  const byNormalized = new Map<string, any>();
  const byCompact = new Map<string, any>();

  for (const [rawKey, meta] of Object.entries(metaStore)) {
    const key = String(rawKey || "").trim();
    if (!key) continue;

    const variants = new Set<string>();
    variants.add(normalizeKey(key));

    const colonIndex = key.indexOf(":");
    if (colonIndex >= 0 && colonIndex < key.length - 1) {
      variants.add(normalizeKey(key.slice(colonIndex + 1)));
    }

    for (const variant of variants) {
      if (!variant) continue;
      byNormalized.set(variant, meta);

      const compact = compactLookupKey(variant);
      if (compact) {
        byCompact.set(compact, meta);
      }
    }
  }

  return { byNormalized, byCompact };
}

function resolveMetaByName(name: string, lookup: ReturnType<typeof buildMetaLookup>) {
  const normalized = normalizeKey(name);
  if (normalized && lookup.byNormalized.has(normalized)) {
    return lookup.byNormalized.get(normalized) || null;
  }

  const compact = compactLookupKey(name);
  if (compact && lookup.byCompact.has(compact)) {
    return lookup.byCompact.get(compact) || null;
  }

  return null;
}

function pickAlumnoPhone(alumno: unknown) {
  const source = alumno && typeof alumno === "object" ? (alumno as Record<string, unknown>) : {};
  const candidates = [
    source.telefono,
    source.celular,
    source.whatsapp,
    source.telefonoWhatsapp,
    source.telefonoWhatsApp,
    source.phone,
    source.mobile,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function buildPlanSummaryByOwner(raw: unknown) {
  const store = raw && typeof raw === "object" ? (raw as SemanaPlanStore) : {};
  const planes = Array.isArray(store.planes) ? store.planes : [];
  const summary = new Map<string, { planItems: number; latestHistoryAt: string | null }>();

  for (const plan of planes) {
    const ownerKey = String(plan.ownerKey || "").trim();
    if (!ownerKey) continue;

    let planItems = 0;
    const semanas = Array.isArray(plan.semanas) ? plan.semanas : [];
    for (const semana of semanas) {
      const dias = Array.isArray(semana?.dias) ? semana.dias : [];
      for (const dia of dias) {
        const hasContent = Boolean(String(dia?.planificacion || "").trim() || String(dia?.sesionId || "").trim());
        if (hasContent) {
          planItems += 1;
        }
      }
    }

    const historial = Array.isArray(plan.historial) ? plan.historial : [];
    const latestHistoryAt = historial
      .map((item) => String(item?.createdAt || "").trim())
      .filter(Boolean)
      .sort()
      .at(-1) || null;

    summary.set(ownerKey, { planItems, latestHistoryAt });
  }

  return summary;
}

export async function listWhatsAppRecipients(): Promise<WhatsAppRecipient[]> {
  const [users, alumnosRaw, clientesMetaRaw, pagosRaw, dataUpdateEventsRaw, semanaPlanRaw] = await Promise.all([
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
    getSyncValue("whatsapp-data-update-events-v1"),
    getSyncValue("pf-control-semana-plan"),
  ]);

  const alumnos = Array.isArray(alumnosRaw) ? alumnosRaw : [];
  const clientesMeta =
    clientesMetaRaw && typeof clientesMetaRaw === "object"
      ? (clientesMetaRaw as Record<string, any>)
      : {};
  const pagos = Array.isArray(pagosRaw) ? (pagosRaw as RawPago[]) : [];
  const pendingDataUpdateEvents = Array.isArray(dataUpdateEventsRaw)
    ? (dataUpdateEventsRaw as DataUpdateEvent[]).filter((item) => !item?.consumedAt)
    : [];

  const pendingUpdateByName = new Map<string, DataUpdateEvent>();
  for (const event of pendingDataUpdateEvents) {
    const key = normalizeKey(String(event?.nombre || ""));
    if (!key) continue;
    pendingUpdateByName.set(key, event);
  }

  const planSummaryByOwner = buildPlanSummaryByOwner(semanaPlanRaw);

  const metaLookup = buildMetaLookup(clientesMeta);

  const latestPaymentByName = pickLatestPaymentByClientName(pagos);
  const recipients: WhatsAppRecipient[] = [];

  const pushRecipient = (candidate: {
    id: string;
    label: string;
    tipo: "alumno" | "colaborador";
    telefono: string;
    nombre: string;
    ownerKey?: string;
    email?: string;
    actividad: string;
    endDate?: string;
    pagoEstado?: string;
    saldo?: number | null;
    paymentDate?: string;
    paymentAmount?: number;
  }) => {
    const phone = normalizeWhatsAppPhone(candidate.telefono);
    if (!phone) return;

    const ownerKey = String(candidate.ownerKey || getOwnerKeyFromName(candidate.nombre));

    if (
      recipients.some(
        (item) =>
          item.id === candidate.id ||
          (ownerKey && item.ownerKey === ownerKey && item.tipo === candidate.tipo)
      )
    ) {
      return;
    }

    const days = candidate.endDate ? diffInDaysFromToday(candidate.endDate) : null;
    const paymentStatus = derivePaymentStatus(days, candidate.pagoEstado);
    const updateEvent = pendingUpdateByName.get(normalizeKey(candidate.nombre));
    const hasPendingPlanUpdate = Boolean(updateEvent);
    const planSummary = planSummaryByOwner.get(ownerKey);
    const planItems = Number(planSummary?.planItems || 0);
    const planStatus = hasPendingPlanUpdate
      ? "actualizacion_pendiente"
      : planItems > 0
      ? "plan_asignado"
      : "sin_plan";
    const saldo =
      typeof candidate.saldo === "number" && Number.isFinite(candidate.saldo)
        ? candidate.saldo
        : null;

    recipients.push({
      id: candidate.id,
      label: candidate.label,
      tipo: candidate.tipo,
      ownerKey,
      telefono: phone,
      actividad: candidate.actividad,
      daysToDue: days,
      paymentStatus,
      planStatus,
      hasPendingPlanUpdate,
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
        pago_estado: paymentStatus,
        saldo: saldo === null ? "" : String(saldo),
        plan_estado: planStatus,
        plan_items: String(planItems),
        actualizacion_plan: hasPendingPlanUpdate ? "si" : "no",
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
    const meta = resolveMetaByName(displayName, metaLookup);
    const payment = latestPaymentByName.get(normalized) || null;
    const isColab = user.role === "COLABORADOR";

    pushRecipient({
      id: `user-${user.id}`,
      label: `${displayName}${isColab ? " (colaborador)" : ""}`,
      tipo: isColab ? "colaborador" : "alumno",
      telefono: String(user.telefono || meta?.telefono || ""),
      nombre: displayName,
      ownerKey: getOwnerKeyFromName(displayName),
      email: String(user.email || ""),
      actividad: String(meta?.tipoAsesoria || (isColab ? "colaboracion" : "entrenamiento")),
      endDate: String(meta?.endDate || ""),
      pagoEstado: String(meta?.pagoEstado || ""),
      saldo: toNumberOrNull(meta?.saldo),
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
    const meta = resolveMetaByName(nombre, metaLookup);
    const payment = latestPaymentByName.get(normalized) || null;
    const alumnoPhone = pickAlumnoPhone(alumno);

    pushRecipient({
      id: `alumno-${normalized}`,
      label: nombre,
      tipo: "alumno",
      telefono: String(meta?.telefono || alumnoPhone || ""),
      nombre,
      ownerKey: `alumnos:${normalized}`,
      actividad: String(meta?.tipoAsesoria || "entrenamiento"),
      endDate: String(meta?.endDate || ""),
      pagoEstado: String(meta?.pagoEstado || ""),
      saldo: toNumberOrNull(meta?.saldo),
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
