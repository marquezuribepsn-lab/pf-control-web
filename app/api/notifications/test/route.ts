import { NextResponse } from "next/server";
import { sendPushNotificationToAll } from "@/lib/pushNotifications";
import { getSessionUser, isStaffRole } from "@/lib/apiAuth";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!isStaffRole(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

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
