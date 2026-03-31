import { NextResponse } from "next/server";
import { notifySyncChanged } from "@/lib/pushNotifications";
import { getSyncValue, isValidSyncKey, setSyncValue } from "@/lib/syncStore";
import { sendAdminAlumnoRegisteredEmail } from "@/lib/email";
import { sendWhatsAppAlertForSyncChange } from "@/lib/whatsappAlerts";

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[];
}

function alumnoFingerprint(item: Record<string, unknown>) {
  const nombre = String(item.nombre || "").trim().toLowerCase();
  const fechaNacimiento = String(item.fechaNacimiento || "").trim().toLowerCase();
  return `${nombre}::${fechaNacimiento}`;
}

async function notifyAdminForNewAlumnos(previousValue: unknown, nextValue: unknown) {
  const previous = asRecordArray(previousValue);
  const next = asRecordArray(nextValue);

  if (next.length <= previous.length) {
    return;
  }

  const previousSet = new Set(previous.map((item) => alumnoFingerprint(item)));
  const nuevos = next.filter((item) => !previousSet.has(alumnoFingerprint(item)));

  for (const alumno of nuevos) {
    await sendAdminAlumnoRegisteredEmail(alumno);
  }
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
    if (key !== "pf-control-push-subs-v1") {
      await notifySyncChanged(key).catch(() => {
        // do not fail writes if push delivery fails
      });

      await sendWhatsAppAlertForSyncChange(key, previousValue, value).catch(() => {
        // do not fail writes if WhatsApp delivery fails
      });
    }

    if (key === "pf-control-alumnos") {
      await notifyAdminForNewAlumnos(previousValue, value).catch(() => {
        // no bloquear guardado por fallos de mail al admin
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sync write failed" }, { status: 500 });
  }
}
