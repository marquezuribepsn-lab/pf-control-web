import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export async function GET() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const entry = await db.syncEntry.findUnique({
      where: { key: "sa-cron:last-run" },
      select: { value: true },
    });
    const lastRun = entry ? JSON.parse(entry.value) : null;
    return NextResponse.json({ ok: true, lastRun });
  } catch {
    return NextResponse.json({ ok: true, lastRun: null });
  }
}
