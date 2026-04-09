import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import {
  appendWhatsAppHistory,
  dispatchWhatsAppBatch,
  type DispatchResult,
} from "@/lib/whatsappDispatch";
import {
  buildAutomationMatches,
  markDataUpdateEventsProcessed,
  type AutomationMatch,
} from "@/lib/whatsappAutomation";
import { sendWhatsAppAutomationFailureEmail } from "@/lib/email";
import { sendWhatsAppInternalAlert } from "@/lib/whatsappAlerts";

const ALERTS_KEY = "whatsapp-automation-alerts-v1";
const RUN_PREFIX = "whatsapp-automation-run-";

export const RUNNER_STATE_KEY = "whatsapp-automation-runner-state-v1";

export type RunActor = {
  source?: "admin" | "runner" | "api";
  userId?: string;
  userEmail?: string;
  userName?: string;
};

export type ExecuteAutomationRunInput = {
  dryRun?: boolean;
  categoryKey?: string;
  ruleKey?: string;
  deliveryModeOverride?: "test" | "prod";
  forceWindow?: boolean;
  includeDisabled?: boolean;
  forceFailureForTest?: boolean;
  limit?: number;
  actor?: RunActor;
};

export type ExecuteAutomationRunOutput = {
  ok: boolean;
  runId: string;
  rulesExecuted: number;
  summary: Record<string, unknown>;
};

type DispatchResultWithRetry = DispatchResult & {
  attempts?: number;
  retried?: boolean;
};

type RunnerState = {
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastRunId?: string;
  lastError?: string | null;
  consecutiveFailures?: number;
  nextRunAt?: string | null;
};

function mkRunId() {
  return `${RUN_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function isTransientFailureReason(reason: string | undefined) {
  const value = String(reason || "").toLowerCase();
  if (!value) return false;

  return (
    value.includes("provider_status_5") ||
    value.includes("provider_status_429") ||
    value.includes("timeout") ||
    value.includes("network") ||
    value.includes("socket") ||
    value.includes("econn") ||
    value.includes("etimedout") ||
    value.includes("fetch") ||
    value.includes("tempor") ||
    value.includes("rate")
  );
}

async function sendMatchWithRetry(input: {
  match: AutomationMatch;
  deliveryMode: "test" | "prod";
  maxRetries: number;
  retryBackoffSeconds: number;
}) {
  const maxRetries = Math.max(0, Math.min(5, Number(input.maxRetries) || 0));
  const retryBackoffSeconds = Math.max(1, Math.min(300, Number(input.retryBackoffSeconds) || 20));

  let lastResult: DispatchResultWithRetry | null = null;
  let retryCount = 0;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const one = await dispatchWhatsAppBatch({
      recipients: [
        {
          id: input.match.id,
          label: input.match.nombre,
          telefono: input.match.telefono,
          variables: input.match.variables,
        },
      ],
      message: input.match.message,
      mode: input.deliveryMode,
      forceText: true,
    });

    const result = {
      ...(one.results[0] || {
        id: input.match.id,
        label: input.match.nombre,
        phone: input.match.telefono,
        ok: false,
        reason: "send_result_missing",
      }),
      attempts: attempt,
      retried: attempt > 1,
    } as DispatchResultWithRetry;

    lastResult = result;

    if (result.ok) {
      return {
        result,
        retryCount,
      };
    }

    if (!isTransientFailureReason(result.reason) || attempt > maxRetries) {
      return {
        result,
        retryCount,
      };
    }

    retryCount += 1;
    await sleep(retryBackoffSeconds * 1000 * attempt);
  }

  return {
    result:
      lastResult ||
      ({
        id: input.match.id,
        label: input.match.nombre,
        phone: input.match.telefono,
        ok: false,
        reason: "retry_loop_unexpected_exit",
      } as DispatchResultWithRetry),
    retryCount,
  };
}

async function appendAutomationAlertLog(entry: Record<string, unknown>) {
  const raw = await getSyncValue(ALERTS_KEY);
  const rows = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const next = [entry, ...rows].slice(0, 300);
  await setSyncValue(ALERTS_KEY, next);
}

function buildRuleStats(matches: AutomationMatch[]) {
  const byRule = new Map<string, { categoryKey: string; ruleKey: string; matched: number; ok: number; failed: number; retried: number }>();

  for (const match of matches) {
    const key = `${match.categoria}:${match.ruleKey}`;
    const current = byRule.get(key) || {
      categoryKey: match.categoria,
      ruleKey: match.ruleKey,
      matched: 0,
      ok: 0,
      failed: 0,
      retried: 0,
    };
    current.matched += 1;
    byRule.set(key, current);
  }

  return byRule;
}

function applyResultToRuleStats(
  stats: Map<string, { categoryKey: string; ruleKey: string; matched: number; ok: number; failed: number; retried: number }>,
  match: AutomationMatch,
  result: DispatchResultWithRetry,
  retryCount: number
) {
  const key = `${match.categoria}:${match.ruleKey}`;
  const current = stats.get(key);
  if (!current) return;

  if (result.ok) {
    current.ok += 1;
  } else {
    current.failed += 1;
  }

  current.retried += retryCount;
}

export async function executeAutomationRun(
  input: ExecuteAutomationRunInput
): Promise<ExecuteAutomationRunOutput> {
  const runId = mkRunId();
  const dryRun = input.dryRun !== false;
  const categoryKey = String(input.categoryKey || "all");
  const ruleKey = String(input.ruleKey || "all");
  const forceFailureForTest = input.forceFailureForTest === true;
  const startedAt = new Date().toISOString();

  const matchesResult = await buildAutomationMatches({
    categoryKey: input.categoryKey,
    ruleKey: input.ruleKey,
    includeDisabled: input.includeDisabled,
    forceWindow: input.forceWindow,
    limit: input.limit,
  });

  const runnerCfg = matchesResult.config.automationRunner;
  const configuredDeliveryMode =
    matchesResult.config.connection.mode === "prod" ? "prod" : "test";
  const deliveryMode =
    input.deliveryModeOverride === "prod" || input.deliveryModeOverride === "test"
      ? input.deliveryModeOverride
      : configuredDeliveryMode;
  const canSend =
    matchesResult.config.connection.enabled !== false &&
    !dryRun &&
    !forceFailureForTest;

  const ruleStats = buildRuleStats(matchesResult.matches);

  let retryCount = 0;
  let retriedRecipients = 0;

  const results: DispatchResultWithRetry[] = [];

  if (!canSend) {
    for (const row of matchesResult.matches) {
      results.push({
        id: row.id,
        label: row.nombre,
        phone: row.telefono,
        ok: !forceFailureForTest,
        skipped: true,
        reason: forceFailureForTest
          ? "forced_failure"
          : dryRun
          ? "dry_run"
          : "connection_disabled",
        renderedMessage: row.message,
      });
    }
  } else {
    for (const match of matchesResult.matches) {
      const sent = await sendMatchWithRetry({
        match,
        deliveryMode,
        maxRetries: runnerCfg.maxRetries,
        retryBackoffSeconds: runnerCfg.retryBackoffSeconds,
      });

      results.push(sent.result);
      retryCount += sent.retryCount;
      if (sent.retryCount > 0) {
        retriedRecipients += 1;
      }

      applyResultToRuleStats(ruleStats, match, sent.result, sent.retryCount);
    }
  }

  const total = results.length;
  const okCount = results.filter((row) => row.ok).length;
  const sentCount = results.filter((row) => row.ok && !row.skipped).length;
  const failedCount = forceFailureForTest
    ? results.length
    : results.filter((row) => !row.ok && !row.skipped).length;
  const skippedCount = results.filter((row) => row.skipped).length;

  let summary = {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun,
    categoryKey,
    ruleKey,
    rulesExecuted: matchesResult.rulesEvaluated,
    totalMatched: matchesResult.totalMatched,
    total,
    sent: canSend ? sentCount : 0,
    failed: canSend ? failedCount : forceFailureForTest ? failedCount : 0,
    skipped: skippedCount,
    deliveryMode,
    retryCount,
    retriedRecipients,
    forceWindow: Boolean(input.forceWindow),
    includeDisabled: Boolean(input.includeDisabled),
    emailAlertSent: false,
    whatsappAlertSent: false,
    alertError: null as string | null,
    forcedFailureTest: forceFailureForTest,
    triggeredBy: input.actor?.source || "api",
    triggeredByUserId: input.actor?.userId || null,
    triggeredByUserEmail: input.actor?.userEmail || null,
    triggeredByUserName: input.actor?.userName || null,
    rules: Array.from(ruleStats.values()),
    ok: forceFailureForTest ? false : canSend ? failedCount === 0 : true,
    error: forceFailureForTest ? "forceFailureForTest" : null,
  };

  await setSyncValue(runId, summary);

  if (canSend && deliveryMode === "prod") {
    const sentOkIds = new Set(results.filter((row) => row.ok).map((row) => row.id));
    const processedDataUpdateEventIds = matchesResult.matches
      .filter((match) => sentOkIds.has(match.id) && match.dataUpdateEventId)
      .map((match) => String(match.dataUpdateEventId));

    await markDataUpdateEventsProcessed(processedDataUpdateEventIds).catch(() => {
      // Keep run resilient if event consumption update fails.
    });
  }

  await appendWhatsAppHistory({
    id: `wh-auto-${Date.now()}`,
    createdAt: new Date().toISOString(),
    tipo: "Automatizacion",
    subcategoria: ruleKey,
    categoryKey,
    subcategoryKey: ruleKey,
    triggeredBy: input.actor?.source || "automation_run",
    triggeredByUserId: input.actor?.userId || null,
    triggeredByUserEmail: input.actor?.userEmail || null,
    triggeredByUserName: input.actor?.userName || null,
    runId,
    mode: dryRun ? "test" : matchesResult.config.connection.mode,
    mensaje: matchesResult.matches[0]?.message || "",
    total,
    ok: canSend ? sentCount : 0,
    failed: canSend ? failedCount : forceFailureForTest ? failedCount : 0,
    skipped: skippedCount,
    results,
    rules: Array.from(ruleStats.values()),
  });

  const shouldAlert = !dryRun && !summary.ok && !forceFailureForTest;

  if (shouldAlert) {
    const firstFailure = results.find((row) => !row.ok)?.reason || "unknown_error";
    const alertErrors: string[] = [];

    if (runnerCfg.alertEmailOnFailure) {
      try {
        const mailRes = await sendWhatsAppAutomationFailureEmail({
          runId,
          categoryKey,
          ruleKey,
          failed: summary.failed,
          sent: summary.sent,
          reason: firstFailure,
          attemptedAt: summary.finishedAt,
          retryCount,
        });
        summary = {
          ...summary,
          emailAlertSent: mailRes.delivered,
        };
      } catch (error) {
        alertErrors.push(`email:${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (runnerCfg.alertWhatsAppOnFailure) {
      try {
        const waAlert = await sendWhatsAppInternalAlert(
          `PF Control: fallo runner WhatsApp (${runId}) categoria=${categoryKey} regla=${ruleKey} sent=${summary.sent} failed=${summary.failed} retries=${retryCount} motivo=${firstFailure}`
        );

        summary = {
          ...summary,
          whatsappAlertSent: waAlert.ok,
        };

        if (!waAlert.ok && waAlert.reasons.length > 0) {
          alertErrors.push(`whatsapp:${waAlert.reasons.join("|")}`);
        }
      } catch (error) {
        alertErrors.push(`whatsapp:${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (alertErrors.length > 0) {
      summary = {
        ...summary,
        alertError: alertErrors.join("; "),
      };
    }

    await appendAutomationAlertLog({
      id: `wh-alert-${Date.now()}`,
      createdAt: new Date().toISOString(),
      runId,
      categoryKey,
      ruleKey,
      failed: summary.failed,
      sent: summary.sent,
      retryCount,
      emailAlertSent: summary.emailAlertSent,
      whatsappAlertSent: summary.whatsappAlertSent,
      alertError: summary.alertError,
    }).catch(() => {
      // Keep run resilient if alert log persistence fails.
    });

    await setSyncValue(runId, summary);
  }

  return {
    ok: Boolean(summary.ok),
    runId,
    rulesExecuted: summary.rulesExecuted,
    summary,
  };
}

export async function getRunnerState() {
  const raw = await getSyncValue(RUNNER_STATE_KEY);
  return raw && typeof raw === "object" ? (raw as RunnerState) : {};
}

export async function setRunnerState(patch: Partial<RunnerState>) {
  const current = await getRunnerState();
  const next: RunnerState = {
    ...current,
    ...patch,
  };
  await setSyncValue(RUNNER_STATE_KEY, next);
  return next;
}
