import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setSyncValue } from "@/lib/syncStore";

const mkRunId = () => `whatsapp-automation-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
    dryRun?: boolean;
    categoryKey?: string;
    ruleKey?: string;
    forceWindow?: boolean;
    includeDisabled?: boolean;
    forceFailureForTest?: boolean;
  };

  const runId = mkRunId();
  const dryRun = body.dryRun !== false;
  const categoryKey = String(body.categoryKey || "general");
  const ruleKey = String(body.ruleKey || "regla");
  const forceFailureForTest = body.forceFailureForTest === true;

  const startedAt = new Date().toISOString();

  const summary = {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun,
    categoryKey,
    ruleKey,
    rulesExecuted: 1,
    totalMatched: 0,
    sent: 0,
    failed: 0,
    forceWindow: Boolean(body.forceWindow),
    includeDisabled: Boolean(body.includeDisabled),
    emailAlertSent: false,
    whatsappAlertSent: false,
    alertError: null as string | null,
    forcedFailureTest: forceFailureForTest,
    ok: !forceFailureForTest,
    error: forceFailureForTest ? "forceFailureForTest" : null,
  };

  await setSyncValue(runId, summary);

  if (forceFailureForTest) {
    return NextResponse.json(
      {
        ok: false,
        runId,
        rulesExecuted: summary.rulesExecuted,
        error: summary.error,
        forcedFailureTest: true,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    runId,
    rulesExecuted: summary.rulesExecuted,
    summary,
  });
}
