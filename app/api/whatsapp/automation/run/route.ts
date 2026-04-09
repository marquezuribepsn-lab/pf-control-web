import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeAutomationRun } from "@/lib/whatsappRunService";

async function resolveActor(req: NextRequest) {
  const configuredSecret = String(process.env.WHATSAPP_AUTOMATION_SECRET || "").trim();
  const receivedSecret = String(req.headers.get("x-whatsapp-automation-secret") || "").trim();

  if (configuredSecret && receivedSecret && configuredSecret === receivedSecret) {
    return {
      source: "runner" as const,
      userId: "runner-secret",
      userEmail: "runner@system.local",
      userName: "Runner Secret",
    };
  }

  const session = await auth();
  if (session && (session.user as any)?.role === "ADMIN") {
    return {
      source: "admin" as const,
      userId: String((session.user as any)?.id || ""),
      userEmail: String(session.user?.email || ""),
      userName: String(session.user?.name || ""),
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    dryRun?: boolean;
    categoryKey?: string;
    ruleKey?: string;
    mode?: string;
    forceWindow?: boolean;
    includeDisabled?: boolean;
    forceFailureForTest?: boolean;
    limit?: number;
  };

  const forceFailureForTest = body.forceFailureForTest === true;
  const allowForcedFailureInProd = process.env.WHATSAPP_AUTOMATION_ALLOW_FORCE_FAILURE_TEST === "1";

  if (forceFailureForTest && process.env.NODE_ENV === "production" && !allowForcedFailureInProd) {
    return NextResponse.json(
      {
        ok: false,
        error: "forceFailureForTest disabled",
      },
      { status: 400 }
    );
  }

  const runResult = await executeAutomationRun({
    dryRun: body.dryRun,
    categoryKey: body.categoryKey,
    ruleKey: body.ruleKey,
    deliveryModeOverride:
      body.mode === "prod" || body.mode === "test" ? body.mode : undefined,
    forceWindow: body.forceWindow,
    includeDisabled: body.includeDisabled,
    forceFailureForTest: body.forceFailureForTest,
    limit: body.limit,
    actor,
  });

  if (forceFailureForTest) {
    return NextResponse.json(
      {
        ok: false,
        runId: runResult.runId,
        rulesExecuted: runResult.rulesExecuted,
        error: runResult.summary?.error || "forceFailureForTest",
        forcedFailureTest: true,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: runResult.ok,
    runId: runResult.runId,
    rulesExecuted: runResult.rulesExecuted,
    summary: runResult.summary,
  });
}
