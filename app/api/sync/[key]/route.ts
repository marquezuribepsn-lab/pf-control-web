import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole, getColaboradorPermisos } from "@/lib/apiAuth";
import { notifySyncChanged } from "@/lib/pushNotifications";
import { getSyncValue, isValidSyncKey, setSyncValue } from "@/lib/syncStore";
import { sendWhatsAppAlertForSyncChange } from "@/lib/whatsappAlerts";
import {
  ALUMNO_SCOPED_KEYS,
  getColaboradorAlumnoScope,
  filterScopedValueForRead,
  mergeScopedValueForWrite,
} from "@/lib/colaboradorScope";

const CLIENTES_META_KEY = "pf-control-clientes-meta-v1";
const DATA_UPDATE_EVENTS_KEY = "whatsapp-data-update-events-v1";

/**
 * Keys que SOLO el staff (admin/superadmin/colaborador) puede leer o escribir.
 * Contienen datos sensibles que un alumno (CLIENTE) nunca debe ver.
 */
const STAFF_ONLY_SYNC_KEYS = new Set<string>([
  "pf-control-admin-client-passwords-v1",
]);

/**
 * Permisos granulares de colaborador (enforcement REAL, server-side).
 *
 * Un COLABORADOR sin el flag correspondiente no puede escribir estas keys,
 * sin importar lo que muestre la UI. Para ADMIN/SUPERADMIN/CLIENTE no aplica
 * (CLIENTE escribe sólo sus propios datos, que no están en estas keys).
 *
 * Mapeo conservador: sólo se gatean keys cuya semántica es inequívoca.
 * Ante duda, NO se bloquea (fail-open) para no romper el trabajo legítimo.
 */
const PLAN_WRITE_KEYS = new Set<string>([
  "pf-control-semana-plan",
  "pf-control-ai-training-plans-v1",
  "pf-control-nutricion-planes-v1",
  "pf-control-nutricion-asignaciones-v1",
  "pf-control-nutricion-alimentos-v1",
]);

const REGISTRO_WRITE_KEYS = new Set<string>([
  "pf-control-asistencias-jornadas-v1",
  "pf-control-asistencias-registros-v1",
]);

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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { key: rawKey } = await context.params;
    const key = isValidSyncKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    if (STAFF_ONLY_SYNC_KEYS.has(key) && !isStaffRole(user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let value = await getSyncValue(key);

    // Visibilidad de alumnos: un colaborador sin `puedeVerTodosAlumnos`
    // sólo recibe a los alumnos que tiene asignados.
    if (user.role === "COLABORADOR" && ALUMNO_SCOPED_KEYS.has(key)) {
      const permisos = await getColaboradorPermisos(user.id);
      if (!permisos.puedeVerTodosAlumnos) {
        const scope = await getColaboradorAlumnoScope(user.id);
        value = filterScopedValueForRead(key, value, scope);
      }
    }

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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { key: rawKey } = await context.params;
    const key = isValidSyncKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    if (STAFF_ONLY_SYNC_KEYS.has(key) && !isStaffRole(user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Permisos granulares de colaborador (enforcement real, no sólo UI).
    if (user.role === "COLABORADOR" && (PLAN_WRITE_KEYS.has(key) || REGISTRO_WRITE_KEYS.has(key))) {
      const permisos = await getColaboradorPermisos(user.id);
      if (PLAN_WRITE_KEYS.has(key) && !permisos.puedeEditarPlanes) {
        return NextResponse.json({ error: "No tenés permiso para editar planes" }, { status: 403 });
      }
      if (REGISTRO_WRITE_KEYS.has(key) && !permisos.puedeEditarRegistros) {
        return NextResponse.json({ error: "No tenés permiso para editar registros" }, { status: 403 });
      }
    }

    const body = (await req.json()) as { value?: unknown };
    let value: unknown = body.value ?? null;
    const previousValue = await getSyncValue(key);

    // Visibilidad de alumnos: un colaborador acotado escribe sólo a sus
    // asignados. Mergeamos contra el blob completo para NO borrar a los
    // alumnos ocultos ni dejarle crear/editar fuera de su scope.
    if (user.role === "COLABORADOR" && ALUMNO_SCOPED_KEYS.has(key)) {
      const permisos = await getColaboradorPermisos(user.id);
      if (!permisos.puedeVerTodosAlumnos) {
        const scope = await getColaboradorAlumnoScope(user.id);
        value = mergeScopedValueForWrite(key, previousValue, value, scope);
      }
    }

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
