import { NextResponse } from "next/server";
import { addPushSubscription } from "@/lib/pushNotifications";
import { getSessionUser } from "@/lib/apiAuth";

type SubscriptionPayload = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubscriptionPayload;
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }

    // La suscripcion queda asociada al usuario logueado. Sin esto solo se
    // puede hacer broadcast, y un aviso personal ("tu racha esta congelada")
    // terminaria llegandole a todos los dispositivos registrados.
    const user = await getSessionUser();

    await addPushSubscription({
      endpoint: body.endpoint,
      keys: body.keys,
      userEmail: String(user?.email || "").trim().toLowerCase() || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "subscribe failed" }, { status: 500 });
  }
}
