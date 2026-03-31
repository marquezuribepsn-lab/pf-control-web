import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  simulateAutomationRule,
  type CategoryKey,
  type RuleKey,
} from "@/lib/whatsappAutomation";

const db = prisma as any;

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    categoryKey?: CategoryKey;
    ruleKey?: RuleKey;
    forceWindow?: boolean;
    limit?: number;
  };

  if (!body.categoryKey || !body.ruleKey) {
    return NextResponse.json(
      { message: "categoryKey y ruleKey son requeridos" },
      { status: 400 }
    );
  }

  try {
    const result = await simulateAutomationRule(db, {
      categoryKey: body.categoryKey,
      ruleKey: body.ruleKey,
      forceWindow: Boolean(body.forceWindow),
      limit: typeof body.limit === "number" ? body.limit : 40,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo simular automatizacion";
    return NextResponse.json({ message }, { status: 500 });
  }
}
