import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSyncValue } from "@/lib/syncStore";
import { RUNNER_STATE_KEY } from "@/lib/whatsappRunService";

const db = prisma as any;
const ALERTS_KEY = "whatsapp-automation-alerts-v1";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const [rows, runnerStateRaw, alertsRaw] = await Promise.all([
      db.syncEntry.findMany({
        where: {
          key: {
            startsWith: "whatsapp-automation-run-",
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          key: true,
          value: true,
          updatedAt: true,
        },
      }),
      getSyncValue(RUNNER_STATE_KEY),
      getSyncValue(ALERTS_KEY),
    ]);

    const runs = rows.map((row: any) => {
      const value = row.value && typeof row.value === "object" ? row.value : {};
      return {
        key: row.key,
        runId: row.key,
        updatedAt: row.updatedAt,
        value,
        ...(value as Record<string, unknown>),
      };
    });

    return NextResponse.json({
      ok: true,
      runs,
      runnerState:
        runnerStateRaw && typeof runnerStateRaw === "object" ? runnerStateRaw : {},
      alerts: Array.isArray(alertsRaw) ? alertsRaw.slice(0, 50) : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudieron listar ejecuciones",
        runs: [],
      },
      { status: 500 }
    );
  }
}
