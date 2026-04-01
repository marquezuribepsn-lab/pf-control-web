import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue } from "@/lib/syncStore";

const HISTORY_KEY = "whatsapp-history-v1";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const history = await getSyncValue(HISTORY_KEY);
  const rows = Array.isArray(history) ? history : [];
  return NextResponse.json({ ok: true, history: rows });
}
