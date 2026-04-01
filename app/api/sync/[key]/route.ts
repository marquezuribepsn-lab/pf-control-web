import { NextResponse } from "next/server";
import { notifySyncChanged } from "@/lib/pushNotifications";
import { getSyncValue, isValidSyncKey, setSyncValue } from "@/lib/syncStore";
import { sendWhatsAppAlertForSyncChange } from "@/lib/whatsappAlerts";

const CLIENTES_META_KEY = "pf-control-clientes-meta-v1";
const DATA_UPDATE_EVENTS_KEY = "whatsapp-data-update-events-v1";

type DataUpdateEvent = {
  id: string;
  clientKey: string;
  nombre: string;
  updatedAt: string;
  consumedAt?: string | null;
};

const IMPORTANT_META_FIELDS = [
  "telefono",
  "codigoPais",
  "email",
  "pais",
  "provincia",
  "calle",
  "numero",
  "piso",
  "depto",
  "startDate",
  "endDate",
  "categoriaPlan",
  "tipoAsesoria",
  "modalidad",
  "pagoEstado",
  "moneda",
  "importe",
  "saldo",
  "autoRenewPlan",
  "renewalDays",
];

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getComparableMetaSnapshot(value: unknown) {
  const record = toRecord(value);
  const snapshot: Record<string, unknown> = {};
  for (const field of IMPORTANT_META_FIELDS) {
    snapshot[field] = field in record ? record[field] : null;
  }
  return snapshot;
}

function getNombreFromClientKey(clientKey: string) {
  const raw = String(clientKey || "");
  const parts = raw.split(":");
  return String(parts[1] || parts[0] || "").trim();
}

async function registerClienteDataUpdateEvents(previousValue: unknown, nextValue: unknown) {
  const previous = toRecord(previousValue);
  const next = toRecord(nextValue);

  const changedClientKeys = Object.keys(next).filter((clientKey) => {
    const before = getComparableMetaSnapshot(previous[clientKey]);
    const after = getComparableMetaSnapshot(next[clientKey]);
    return JSON.stringify(before) !== JSON.stringify(after);
  });

  if (changedClientKeys.length === 0) {
    return;
  }

  const existingRaw = await getSyncValue(DATA_UPDATE_EVENTS_KEY);
  const existing = Array.isArray(existingRaw) ? (existingRaw as DataUpdateEvent[]) : [];
  const nowIso = new Date().toISOString();

  const queue = [...existing];
  for (const clientKey of changedClientKeys) {
    const nombre = getNombreFromClientKey(clientKey);
    if (!nombre) {
      continue;
    }

    const openIndex = queue.findIndex((event) => event.clientKey === clientKey && !event.consumedAt);
    if (openIndex >= 0) {
      queue[openIndex] = {
        ...queue[openIndex],
        nombre,
        updatedAt: nowIso,
      };
      continue;
    }

    queue.unshift({
      id: `wh-upd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      clientKey,
      nombre,
      updatedAt: nowIso,
      consumedAt: null,
    });
  }

  await setSyncValue(DATA_UPDATE_EVENTS_KEY, queue.slice(0, 500));
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key: rawKey } = await context.params;
    const key = isValidSyncKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    const value = await getSyncValue(key);

    return NextResponse.json({ value });
  } catch {
    return NextResponse.json({ error: "Sync read failed" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key: rawKey } = await context.params;
    const key = isValidSyncKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    const body = (await req.json()) as { value?: unknown };
    const value = body.value ?? null;
    const previousValue = await getSyncValue(key);

    await setSyncValue(key, value);

    if (key === CLIENTES_META_KEY) {
      await registerClienteDataUpdateEvents(previousValue, value).catch(() => {
        // keep sync writes resilient if event queue update fails
      });
    }

    if (key !== "pf-control-push-subs-v1") {
      await notifySyncChanged(key).catch(() => {
        // do not fail writes if push delivery fails
      });

      await sendWhatsAppAlertForSyncChange(key, previousValue, value).catch(() => {
        // do not fail writes if whatsapp delivery fails
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sync write failed" }, { status: 500 });
  }
}
