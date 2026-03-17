import { NextResponse } from "next/server";
import { removePushSubscription } from "@/lib/pushNotifications";

type UnsubscribePayload = {
  endpoint?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UnsubscribePayload;
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }

    await removePushSubscription(body.endpoint);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unsubscribe failed" }, { status: 500 });
  }
}
