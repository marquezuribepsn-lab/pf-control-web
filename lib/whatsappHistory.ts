export type WhatsAppHistoryRow = {
  id?: string;
  createdAt?: string;
  tipo?: string;
  categoryKey?: string;
  subcategoria?: string;
  subcategoryKey?: string;
  triggeredBy?: string;
  triggeredByUserId?: string;
  triggeredByUserEmail?: string;
  triggeredByUserName?: string;
  runId?: string;
  mode?: string;
  mensaje?: string;
  total?: number;
  ok?: number;
  failed?: number;
  skipped?: number;
  results?: Array<Record<string, unknown>>;
  rules?: Array<Record<string, unknown>>;
};

export type WhatsAppHistoryFilters = {
  from?: string;
  to?: string;
  status?: string;
  type?: string;
  user?: string;
  rule?: string;
  category?: string;
  limit?: number;
};

function parseDateSafe(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateStart(value: string | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(`${raw.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateEnd(value: string | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(`${raw.slice(0, 10)}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLower(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getHistoryStatus(row: WhatsAppHistoryRow) {
  const total = toNumber(row.total, Array.isArray(row.results) ? row.results.length : 0);
  const ok = toNumber(row.ok, 0);
  const failed = toNumber(row.failed, 0);

  if (total === 0) return "ok";
  if (failed <= 0) return "ok";
  if (ok <= 0) return "failed";
  return "partial";
}

export function filterWhatsAppHistory(
  rows: WhatsAppHistoryRow[],
  filters: WhatsAppHistoryFilters
) {
  const fromDate = normalizeDateStart(filters.from);
  const toDate = normalizeDateEnd(filters.to);
  const statusFilter = toLower(filters.status);
  const typeFilter = toLower(filters.type);
  const userFilter = toLower(filters.user);
  const ruleFilter = toLower(filters.rule);
  const categoryFilter = toLower(filters.category);
  const limit = Math.max(1, Math.min(1000, Number(filters.limit) || 500));

  const filtered = rows.filter((row) => {
    const createdAt = parseDateSafe(row.createdAt);
    if (fromDate && (!createdAt || createdAt.getTime() < fromDate.getTime())) {
      return false;
    }
    if (toDate && (!createdAt || createdAt.getTime() > toDate.getTime())) {
      return false;
    }

    if (statusFilter && statusFilter !== "all") {
      if (getHistoryStatus(row) !== statusFilter) {
        return false;
      }
    }

    if (typeFilter && typeFilter !== "all") {
      if (toLower(row.tipo) !== typeFilter) {
        return false;
      }
    }

    if (ruleFilter && ruleFilter !== "all") {
      const rowRule = toLower(row.subcategoryKey || row.subcategoria);
      if (rowRule !== ruleFilter) {
        return false;
      }
    }

    if (categoryFilter && categoryFilter !== "all") {
      const rowCategory = toLower(row.categoryKey);
      if (rowCategory !== categoryFilter) {
        return false;
      }
    }

    if (userFilter) {
      const haystack = [
        row.triggeredBy,
        row.triggeredByUserId,
        row.triggeredByUserEmail,
        row.triggeredByUserName,
      ]
        .map((value) => toLower(value))
        .join(" ");

      if (!haystack.includes(userFilter)) {
        return false;
      }
    }

    return true;
  });

  return filtered.slice(0, limit);
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  if (/[,"\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function serializeHistoryToCsv(rows: WhatsAppHistoryRow[]) {
  const header = [
    "id",
    "createdAt",
    "status",
    "tipo",
    "categoryKey",
    "subcategoryKey",
    "triggeredBy",
    "triggeredByUserEmail",
    "mode",
    "total",
    "ok",
    "failed",
    "skipped",
    "runId",
    "mensaje",
  ];

  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.createdAt,
        getHistoryStatus(row),
        row.tipo,
        row.categoryKey,
        row.subcategoryKey || row.subcategoria,
        row.triggeredBy,
        row.triggeredByUserEmail,
        row.mode,
        row.total,
        row.ok,
        row.failed,
        row.skipped,
        row.runId,
        row.mensaje,
      ]
        .map((value) => csvEscape(value))
        .join(",")
    );
  }

  return lines.join("\n");
}
