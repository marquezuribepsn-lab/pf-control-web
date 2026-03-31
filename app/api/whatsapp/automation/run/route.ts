import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  runAutomationRules,
  type CategoryKey,
  type RuleKey,
} from "@/lib/whatsappAutomation";
import { sendWhatsAppAutomationFailureEmail } from "@/lib/email";
import { sendWhatsAppEventAlert } from "@/lib/whatsappAlerts";

const db = prisma;

async function persistAutomationRunSummary(payload: Record<string, unknown>) {
  try {
    await db.syncEntry.create({
      data: {
        key: `whatsapp-automation-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        value: payload as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Keep endpoint response resilient even if summary persistence fails.
  }
}

async function notifyAutomationFailure(payload: {
  runId: string;
  generatedAt: string;
  triggeredBy: string;
  source: string;
  dryRun: boolean;
  rulesExecuted: number;
  requestedCategoryKey: CategoryKey | null;
  requestedRuleKey: RuleKey | null;
  totals: {
    matched: number;
    sent: number;
    failed: number;
    skippedByWindow: number;
  };
  error: string | null;
}) {
  if (payload.dryRun) {
    return {
      emailAlertSent: false,
      whatsappAlertSent: false,
      alertError: null as string | null,
    };
  }

  const summaryText =
    `WhatsApp automation fallo` +
    ` | runId=${payload.runId}` +
    ` | failed=${payload.totals.failed}` +
    ` | sent=${payload.totals.sent}` +
    ` | matched=${payload.totals.matched}` +
    (payload.error ? ` | error=${payload.error}` : "");

  const [mailResult, waResult] = await Promise.allSettled([
    sendWhatsAppAutomationFailureEmail({
      runId: payload.runId,
      generatedAt: payload.generatedAt,
      triggeredBy: payload.triggeredBy,
      source: payload.source,
      dryRun: payload.dryRun,
      rulesExecuted: payload.rulesExecuted,
      requestedCategoryKey: payload.requestedCategoryKey,
      requestedRuleKey: payload.requestedRuleKey,
      totals: payload.totals,
      error: payload.error,
    }),
    sendWhatsAppEventAlert(summaryText),
  ]);

  const errors = [mailResult, waResult]
    .filter((item) => item.status === "rejected")
    .map((item) => String((item as PromiseRejectedResult).reason || "unknown alert error"));

  return {
    emailAlertSent: mailResult.status === "fulfilled",
    whatsappAlertSent: waResult.status === "fulfilled",
    alertError: errors.length > 0 ? errors.join(" | ") : null,
  };
}

function isInternalAuthorized(req: NextRequest): boolean {
  const expected = String(process.env.WHATSAPP_AUTOMATION_SECRET || "").trim();
  if (!expected) {
    return false;
  }

  const provided = String(req.headers.get("x-whatsapp-automation-secret") || "").trim();
  return Boolean(provided) && provided === expected;
}

function isForceFailureTestEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return String(process.env.WHATSAPP_AUTOMATION_ALLOW_FORCE_FAILURE_TEST || "") === "1";
}

export async function POST(req: NextRequest) {
  const internal = isInternalAuthorized(req);

  let triggeredBy = "system";

  if (!internal) {
    const session = await auth();
    const sessionUser = (session?.user || {}) as { role?: string; email?: string | null };

    if (!session || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    triggeredBy = String(sessionUser.email || "admin");
  }

  const body = (await req.json().catch(() => ({}))) as {
    dryRun?: boolean;
    forceWindow?: boolean;
    includeDisabled?: boolean;
    categoryKey?: CategoryKey;
    ruleKey?: RuleKey;
    forceFailureForTest?: boolean;
  };

  const source = internal ? "internal-secret" : "admin-session";

  if (body.forceFailureForTest) {
    if (!isForceFailureTestEnabled()) {
      return NextResponse.json(
        {
          message:
            "forceFailureForTest deshabilitado en produccion. Activa WHATSAPP_AUTOMATION_ALLOW_FORCE_FAILURE_TEST=1 para usarlo.",
        },
        { status: 400 }
      );
    }

    const failedRunId = `auto-forcefail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const generatedAt = new Date().toISOString();
    const forcedDryRun = Boolean(body.dryRun);

    const alertMeta = await notifyAutomationFailure({
      runId: failedRunId,
      generatedAt,
      triggeredBy,
      source,
      dryRun: forcedDryRun,
      rulesExecuted: 0,
      requestedCategoryKey: body.categoryKey || null,
      requestedRuleKey: body.ruleKey || null,
      totals: {
        matched: 0,
        sent: 0,
        failed: 1,
        skippedByWindow: 0,
      },
      error: "Forced failure for alert pipeline test",
    });

    const forcedPayload = {
      ok: false,
      forcedFailureTest: true,
      runId: failedRunId,
      dryRun: forcedDryRun,
      totals: {
        matched: 0,
        sent: 0,
        failed: 1,
        skippedByWindow: 0,
      },
      rulesExecuted: 0,
      perRule: [],
      generatedAt,
      triggeredBy,
      source,
      requestedCategoryKey: body.categoryKey || null,
      requestedRuleKey: body.ruleKey || null,
      forceWindow: Boolean(body.forceWindow),
      includeDisabled: Boolean(body.includeDisabled),
      error: "Forced failure for alert pipeline test",
      emailAlertSent: alertMeta.emailAlertSent,
      whatsappAlertSent: alertMeta.whatsappAlertSent,
      alertError: alertMeta.alertError,
    };

    await persistAutomationRunSummary(forcedPayload);
    return NextResponse.json(forcedPayload);
  }

  try {
    const result = await runAutomationRules(db, {
      categoryKey: body.categoryKey,
      ruleKey: body.ruleKey,
      dryRun: Boolean(body.dryRun),
      forceWindow: Boolean(body.forceWindow),
      includeDisabled: Boolean(body.includeDisabled),
      triggeredBy,
    });

    let alertMeta = {
      emailAlertSent: false,
      whatsappAlertSent: false,
      alertError: null as string | null,
    };

    if (!result.ok) {
      alertMeta = await notifyAutomationFailure({
        runId: String(result.runId || `auto-error-${Date.now()}`),
        generatedAt: String(result.generatedAt || new Date().toISOString()),
        triggeredBy,
        source,
        dryRun: Boolean(result.dryRun),
        rulesExecuted: Number(result.rulesExecuted || 0),
        requestedCategoryKey: body.categoryKey || null,
        requestedRuleKey: body.ruleKey || null,
        totals: {
          matched: Number(result?.totals?.matched || 0),
          sent: Number(result?.totals?.sent || 0),
          failed: Number(result?.totals?.failed || 0),
          skippedByWindow: Number(result?.totals?.skippedByWindow || 0),
        },
        error: null,
      });
    }

    await persistAutomationRunSummary({
      runId: result.runId,
      ok: result.ok,
      dryRun: result.dryRun,
      totals: result.totals,
      rulesExecuted: result.rulesExecuted,
      perRule: result.perRule,
      generatedAt: result.generatedAt,
      triggeredBy,
      source,
      requestedCategoryKey: body.categoryKey || null,
      requestedRuleKey: body.ruleKey || null,
      forceWindow: Boolean(body.forceWindow),
      includeDisabled: Boolean(body.includeDisabled),
      emailAlertSent: alertMeta.emailAlertSent,
      whatsappAlertSent: alertMeta.whatsappAlertSent,
      alertError: alertMeta.alertError,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar automatizacion";

    const failedRunId = `auto-error-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const generatedAt = new Date().toISOString();
    const alertMeta = await notifyAutomationFailure({
      runId: failedRunId,
      generatedAt,
      triggeredBy,
      source,
      dryRun: Boolean(body.dryRun),
      rulesExecuted: 0,
      requestedCategoryKey: body.categoryKey || null,
      requestedRuleKey: body.ruleKey || null,
      totals: {
        matched: 0,
        sent: 0,
        failed: 1,
        skippedByWindow: 0,
      },
      error: message,
    });

    await persistAutomationRunSummary({
      runId: failedRunId,
      ok: false,
      dryRun: Boolean(body.dryRun),
      totals: {
        matched: 0,
        sent: 0,
        failed: 1,
        skippedByWindow: 0,
      },
      rulesExecuted: 0,
      perRule: [],
      generatedAt: new Date().toISOString(),
      triggeredBy,
      source,
      requestedCategoryKey: body.categoryKey || null,
      requestedRuleKey: body.ruleKey || null,
      forceWindow: Boolean(body.forceWindow),
      includeDisabled: Boolean(body.includeDisabled),
      error: message,
      emailAlertSent: alertMeta.emailAlertSent,
      whatsappAlertSent: alertMeta.whatsappAlertSent,
      alertError: alertMeta.alertError,
    });

    return NextResponse.json({ message }, { status: 500 });
  }
}
