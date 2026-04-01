import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue } from "@/lib/syncStore";

async function requireAdmin() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    categoryKey?: string;
    ruleKey?: string;
    limit?: number;
  };

  const categoryKey = String(body.categoryKey || "general");
  const ruleKey = String(body.ruleKey || "regla");
  const limit = Math.max(1, Math.min(100, Number(body.limit) || 10));

  const alumnos = await getSyncValue("pf-control-alumnos");
  const rows = Array.isArray(alumnos) ? alumnos : [];

  const matches = rows.slice(0, limit).map((item: any, index: number) => ({
    id: `${index + 1}`,
    nombre: String(item?.nombre || `Cliente ${index + 1}`),
    categoria: categoryKey,
    ruleKey,
  }));

  return NextResponse.json({
    ok: true,
    summary: {
      categoryKey,
      ruleKey,
      totalMatched: matches.length,
      limitedTo: limit,
    },
    matches,
  });
}
