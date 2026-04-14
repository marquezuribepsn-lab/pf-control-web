import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import {
  type WhatsAppConfig,
  type WhatsAppSubcategoryConfig,
  normalizeWhatsAppConfig,
} from "@/lib/whatsappConfig";
import {
  listWhatsAppRecipientsAudit,
  type WhatsAppMissingPhoneRow,
  type WhatsAppRecipient,
} from "@/lib/whatsappRecipients";
import { interpolateMessage } from "@/lib/whatsappDispatch";

type BuildOptions = {
  categoryKey?: string;
  ruleKey?: string;
  includeDisabled?: boolean;
  forceWindow?: boolean;
  limit?: number;
};

const DATA_UPDATE_EVENTS_KEY = "whatsapp-data-update-events-v1";

type DataUpdateEvent = {
  id: string;
  clientKey: string;
  nombre: string;
  updatedAt: string;
  consumedAt?: string | null;
};

export type AutomationMatch = {
  id: string;
  nombre: string;
  telefono: string;
  categoria: string;
  ruleKey: string;
  message: string;
  variables: Record<string, string>;
  reason: string;
  dataUpdateEventId?: string;
};

export type BuildAutomationMatchesResult = {
  config: WhatsAppConfig;
  rulesEvaluated: number;
  totalMatched: number;
  limitedTo: number;
  matches: AutomationMatch[];
  missingPhones: WhatsAppMissingPhoneRow[];
};

function normalizeName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseDateOnly(value: string): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(`${raw.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffInDaysFromToday(dateValue: string) {
  const parsed = parseDateOnly(dateValue);
  if (!parsed) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
}

function nowTimeHHmm(now: Date) {
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function inWindow(now: Date, from: string, to: string) {
  const current = nowTimeHHmm(now);
  return current >= from && current <= to;
}

function isToday(dateValue: string | undefined) {
  if (!dateValue) return false;
  const parsed = parseDateOnly(dateValue);
  if (!parsed) return false;

  const now = new Date();
  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  );
}

function shouldIncludeByRule(
  rule: WhatsAppSubcategoryConfig,
  recipient: WhatsAppRecipient,
  now: Date
): { pass: boolean; reason: string } {
  const daysUntilDue = recipient.endDate ? diffInDaysFromToday(recipient.endDate) : null;

  switch (rule.triggerType) {
    case "days_before": {
      const expected = Math.max(0, Number(rule.daysOffset) || 0);
      return {
        pass: daysUntilDue !== null && daysUntilDue === expected,
        reason: "days_before_match",
      };
    }
    case "due_today":
      return {
        pass: daysUntilDue !== null && daysUntilDue === 0,
        reason: "due_today_match",
      };
    case "overdue":
      return {
        pass: daysUntilDue !== null && daysUntilDue < 0,
        reason: "overdue_match",
      };
    case "on_renewal":
      return {
        pass: isToday(recipient.lastPaymentDate),
        reason: "renewal_today_match",
      };
    case "on_data_update":
      return {
        pass: false,
        reason: "data_update_pending_events",
      };
    case "week_end": {
      const day = now.getDay();
      return {
        pass: day === 0,
        reason: "week_end_sunday_match",
      };
    }
    default:
      return { pass: false, reason: "unsupported_trigger" };
  }
}

function recipientAllowedForCategory(recipient: WhatsAppRecipient, categoryKey: string) {
  const recipientStatus = normalizeName(recipient.estado || recipient.variables?.estado || "");
  if (recipient.tipo === "alumno" && recipientStatus === "finalizado") {
    return false;
  }

  if (categoryKey === "cobranzas" || categoryKey === "asistencia_rutinas") {
    return recipient.tipo === "alumno";
  }
  return true;
}

export async function loadWhatsAppConfigFromStore() {
  const raw = await getSyncValue("whatsapp-config-v1");
  return normalizeWhatsAppConfig(raw);
}

async function getPendingDataUpdateEvents() {
  const raw = await getSyncValue(DATA_UPDATE_EVENTS_KEY);
  const rows = Array.isArray(raw) ? (raw as DataUpdateEvent[]) : [];
  return rows.filter((event) => !event.consumedAt);
}

export async function buildAutomationMatches(options: BuildOptions): Promise<BuildAutomationMatchesResult> {
  const config = await loadWhatsAppConfigFromStore();
  const recipientsAudit = await listWhatsAppRecipientsAudit();
  const recipients = recipientsAudit.recipients;
  const pendingDataUpdateEvents = await getPendingDataUpdateEvents();

  const dataUpdateByName = new Map<string, DataUpdateEvent>();
  const dataUpdateByClientKey = new Map<string, DataUpdateEvent>();
  for (const event of pendingDataUpdateEvents) {
    const key = normalizeName(event.nombre);
    if (!key) continue;
    dataUpdateByName.set(key, event);

    const clientKey = String(event.clientKey || "").trim();
    if (clientKey) {
      dataUpdateByClientKey.set(clientKey, event);
    }
  }

  const includeDisabled = options.includeDisabled === true;
  const forceWindow = options.forceWindow === true;
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));

  const categoryFilter = String(options.categoryKey || "").trim();
  const ruleFilter = String(options.ruleKey || "").trim();

  const matches: AutomationMatch[] = [];
  const now = new Date();

  let rulesEvaluated = 0;

  for (const [categoryKey, category] of Object.entries(config.categories)) {
    if (categoryFilter && categoryFilter !== categoryKey) {
      continue;
    }

    if (!includeDisabled && category.enabled === false) {
      continue;
    }

    for (const [subKey, sub] of Object.entries(category.subcategories)) {
      if (ruleFilter && ruleFilter !== subKey) {
        continue;
      }

      if (!includeDisabled && sub.enabled === false) {
        continue;
      }

      if (!forceWindow && !inWindow(now, sub.sendFrom, sub.sendTo)) {
        continue;
      }

      rulesEvaluated += 1;

      for (const recipient of recipients) {
        if (!recipientAllowedForCategory(recipient, categoryKey)) {
          continue;
        }

        let dataUpdateEventId: string | undefined;

        if (sub.triggerType === "on_data_update") {
          const ownerKey = String(recipient.ownerKey || "").trim();
          const byOwner = ownerKey ? dataUpdateByClientKey.get(ownerKey) : null;
          const nameKey = normalizeName(recipient.variables.nombre || recipient.label);
          const byName = dataUpdateByName.get(nameKey);
          const event = byOwner || byName;
          if (!event) {
            continue;
          }
          dataUpdateEventId = event.id;
        }

        const check = shouldIncludeByRule(sub, recipient, now);
        if (!check.pass && sub.triggerType !== "on_data_update") {
          continue;
        }

        const message = interpolateMessage(sub.message, recipient.variables);
        matches.push({
          id: recipient.id,
          nombre: recipient.label,
          telefono: recipient.telefono,
          categoria: categoryKey,
          ruleKey: subKey,
          message,
          variables: recipient.variables,
          reason: sub.triggerType === "on_data_update" ? "data_update_event_match" : check.reason,
          dataUpdateEventId,
        });

        if (matches.length >= limit) {
          return {
            config,
            rulesEvaluated,
            totalMatched: matches.length,
            limitedTo: limit,
            matches,
            missingPhones: recipientsAudit.missingPhones,
          };
        }
      }
    }
  }

  return {
    config,
    rulesEvaluated,
    totalMatched: matches.length,
    limitedTo: limit,
    matches,
    missingPhones: recipientsAudit.missingPhones,
  };
}

export async function markDataUpdateEventsProcessed(eventIds: string[]) {
  const ids = Array.from(new Set(eventIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (ids.length === 0) {
    return;
  }

  const raw = await getSyncValue(DATA_UPDATE_EVENTS_KEY);
  const rows = Array.isArray(raw) ? (raw as DataUpdateEvent[]) : [];
  const now = new Date().toISOString();

  const next = rows.map((row) => {
    if (ids.includes(row.id) && !row.consumedAt) {
      return {
        ...row,
        consumedAt: now,
      };
    }
    return row;
  });

  await setSyncValue(DATA_UPDATE_EVENTS_KEY, next);
}

export function getRuleFromConfig(
  config: WhatsAppConfig,
  categoryKey: string,
  ruleKey: string
): WhatsAppSubcategoryConfig | null {
  const category = config.categories[categoryKey];
  if (!category) return null;
  return category.subcategories[ruleKey] || null;
}
