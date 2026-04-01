import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const rows = await db.syncEntry.findMany({
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
    });

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

    return NextResponse.json({ ok: true, runs });
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
