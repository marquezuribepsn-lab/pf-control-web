import { NextResponse } from "next/server";
import { addPushSubscription } from "@/lib/pushNotifications";

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

    await addPushSubscription({
      endpoint: body.endpoint,
      keys: body.keys,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "subscribe failed" }, { status: 500 });
  }
}
