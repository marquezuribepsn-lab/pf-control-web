import { NextResponse } from "next/server";
import { notifySyncChanged } from "@/lib/pushNotifications";
import { getSyncValue, isValidSyncKey, setSyncValue } from "@/lib/syncStore";
import { sendWhatsAppAlertForSyncChange } from "@/lib/whatsappAlerts";

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
        // do not fail writes if whatsapp delivery fails
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sync write failed" }, { status: 500 });
  }
}
