import { NextResponse } from "next/server";
import { sendPushNotificationToAll } from "@/lib/pushNotifications";

export async function POST() {
  try {
    await sendPushNotificationToAll({
      title: "PF Control",
      body: "Notificacion de prueba enviada correctamente.",
      at: new Date().toISOString(),
      test: true,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "test notification failed" }, { status: 500 });
  }
}
