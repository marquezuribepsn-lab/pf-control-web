import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAutomationMatches } from "@/lib/whatsappAutomation";

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
    includeDisabled?: boolean;
    forceWindow?: boolean;
  };

  const result = await buildAutomationMatches({
    categoryKey: body.categoryKey,
    ruleKey: body.ruleKey,
    limit: body.limit,
    includeDisabled: body.includeDisabled,
    forceWindow: body.forceWindow,
  });

  return NextResponse.json({
    ok: true,
    summary: {
      categoryKey: String(body.categoryKey || "all"),
      ruleKey: String(body.ruleKey || "all"),
      rulesEvaluated: result.rulesEvaluated,
      totalMatched: result.totalMatched,
      limitedTo: result.limitedTo,
    },
    matches: result.matches,
  });
}
