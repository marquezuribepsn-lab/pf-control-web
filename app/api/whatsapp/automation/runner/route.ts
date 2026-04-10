import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadWhatsAppConfigFromStore } from "@/lib/whatsappAutomation";
import {
  executeAutomationRun,
  getRunnerState,
  setRunnerState,
} from "@/lib/whatsappRunService";
import { sendWhatsAppAutomationFailureEmail } from "@/lib/email";
import { sendWhatsAppInternalAlert } from "@/lib/whatsappAlerts";

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

function plusMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + Math.max(1, minutes) * 60000);
}

export async function POST(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    force?: boolean;
    limit?: number;
    categoryKey?: string;
    ruleKey?: string;
    mode?: string;
  };

  const deliveryModeOverride =
    body.mode === "prod" || body.mode === "test" ? body.mode : "prod";

  const force = body.force === true;
  const now = new Date();
  const nowIso = now.toISOString();

  const config = await loadWhatsAppConfigFromStore();
  const runnerCfg = config.automationRunner;

  if (runnerCfg.enabled === false && !force) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "runner_disabled",
      nextRunAt: null,
    });
  }

  const state = await getRunnerState();
  const configuredNext = state.nextRunAt ? new Date(state.nextRunAt) : null;
  const intervalMinutes = Math.max(1, Number(runnerCfg.intervalMinutes) || 5);

  if (!force && configuredNext && configuredNext.getTime() > now.getTime()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not_due",
      nextRunAt: configuredNext.toISOString(),
      state,
    });
  }

  await setRunnerState({
    lastAttemptAt: nowIso,
    lastError: null,
    nextRunAt: plusMinutes(now, intervalMinutes).toISOString(),
  });

  try {
    const runResult = await executeAutomationRun({
      dryRun: false,
      deliveryModeOverride,
      forceWindow: false,
      includeDisabled: false,
      limit: Math.max(1, Math.min(500, Number(body.limit) || 500)),
      categoryKey: body.categoryKey,
      ruleKey: body.ruleKey,
      actor: {
        source: "runner",
        userId: actor.userId,
        userEmail: actor.userEmail,
        userName: actor.userName,
      },
    });

    const runOk = runResult.ok;
    const currentFailures = Number(state.consecutiveFailures || 0);

    await setRunnerState({
      lastRunId: runResult.runId,
      lastSuccessAt: runOk ? new Date().toISOString() : state.lastSuccessAt,
      lastFailureAt: runOk ? state.lastFailureAt : new Date().toISOString(),
      consecutiveFailures: runOk ? 0 : currentFailures + 1,
      lastError: runOk
        ? null
        : String((runResult.summary.error as string) || "automation_run_failed"),
      nextRunAt: plusMinutes(new Date(), intervalMinutes).toISOString(),
    });

    return NextResponse.json({
      ok: runOk,
      skipped: false,
      runId: runResult.runId,
      summary: runResult.summary,
      nextRunAt: plusMinutes(new Date(), intervalMinutes).toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const nextRunAt = plusMinutes(new Date(), intervalMinutes).toISOString();

    await setRunnerState({
      lastFailureAt: new Date().toISOString(),
      consecutiveFailures: Number(state.consecutiveFailures || 0) + 1,
      lastError: errorMessage,
      nextRunAt,
    }).catch(() => {
      // keep route resilient if state persistence fails
    });

    if (runnerCfg.alertEmailOnFailure) {
      await sendWhatsAppAutomationFailureEmail({
        runId: `runner-exception-${Date.now()}`,
        categoryKey: body.categoryKey || "all",
        ruleKey: body.ruleKey || "all",
        failed: 1,
        sent: 0,
        reason: `runner_exception:${errorMessage}`,
        attemptedAt: new Date().toISOString(),
        retryCount: 0,
      }).catch(() => {
        // alerting is non-blocking
      });
    }

    if (runnerCfg.alertWhatsAppOnFailure) {
      await sendWhatsAppInternalAlert(
        `PF Control: fallo runner cron WhatsApp (${errorMessage})`
      ).catch(() => {
        // alerting is non-blocking
      });
    }

    console.error("[whatsapp-runner-guard]", errorMessage);

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        skipped: false,
        nextRunAt,
      },
      { status: 500 }
    );
  }
}
