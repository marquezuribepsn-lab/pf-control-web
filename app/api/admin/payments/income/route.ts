import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getIncomeResetAt,
  getPaymentOrders,
  resetIncomeBaselineNow,
  type PaymentOrderRecord,
} from "@/lib/billing";

type IncomeScope = "monthly" | "annual";

type MonthBucketInternal = {
  month: string;
  total: number;
  paymentCount: number;
  clients: Set<string>;
  currency: string;
};

function normalizeScope(value: unknown): IncomeScope {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "annual") {
    return "annual";
  }
  return "monthly";
}

function normalizeMonthParam(value: unknown): string {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    return "";
  }

  const monthNumber = Number(normalized.slice(5, 7));
  if (!Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return "";
  }

  return normalized;
}

function normalizeYearParam(value: unknown): number | null {
  const normalized = String(value || "").trim();
  if (!/^\d{4}$/.test(normalized)) {
    return null;
  }

  const year = Number(normalized);
  if (!Number.isFinite(year) || year < 2000 || year > 3000) {
    return null;
  }

  return year;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function monthKeyFromDate(value: Date): string {
  return `${String(value.getFullYear()).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeCurrency(value: unknown): string {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || "ARS";
}

function formatAmount(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed.toFixed(2)));
}

function resolveOrderEventDate(order: PaymentOrderRecord): Date | null {
  const candidate =
    String(order.approvedAt || "").trim() ||
    String(order.reviewedAt || "").trim() ||
    String(order.createdAt || "").trim();

  if (!candidate) return null;

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function resolveClientIdentifier(order: PaymentOrderRecord): string {
  const clientKey = String(order.clientKey || "").trim();
  if (clientKey) return clientKey;

  const email = String(order.email || "").trim().toLowerCase();
  if (email) return email;

  return String(order.userId || order.id || "unknown");
}

function mergeCurrency(current: string, nextValue: string): string {
  const nextCurrency = normalizeCurrency(nextValue);
  if (!current) return nextCurrency;
  if (current === nextCurrency) return current;
  return "MIX";
}

function buildYearBuckets(year: number): Record<string, MonthBucketInternal> {
  const buckets: Record<string, MonthBucketInternal> = {};

  for (let month = 1; month <= 12; month += 1) {
    const monthKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
    buckets[monthKey] = {
      month: monthKey,
      total: 0,
      paymentCount: 0,
      clients: new Set<string>(),
      currency: "ARS",
    };
  }

  return buckets;
}

async function requireAdmin() {
  const session = await auth();
  const role = String((session?.user as { role?: string | null } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  if (!session?.user?.id || role !== "ADMIN") {
    return null;
  }

  return session;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const scope = normalizeScope(req.nextUrl.searchParams.get("scope"));
  const monthParam = normalizeMonthParam(req.nextUrl.searchParams.get("month"));
  const selectedMonth = monthParam || getCurrentMonthKey();
  const selectedYear =
    normalizeYearParam(req.nextUrl.searchParams.get("year")) || Number(selectedMonth.slice(0, 4)) || getCurrentYear();

  const resetAt = await getIncomeResetAt();
  const resetAtMs = resetAt ? new Date(resetAt).getTime() : Number.NEGATIVE_INFINITY;
  const orders = await getPaymentOrders();

  const approvedOrders = orders.filter((order) => String(order.status || "").toLowerCase() === "approved");

  const yearBuckets = buildYearBuckets(selectedYear);
  let annualTotal = 0;
  let annualPaymentCount = 0;
  const annualClients = new Set<string>();
  let annualCurrency = "";

  let overallTotal = 0;
  let overallPaymentCount = 0;
  const overallClients = new Set<string>();
  let overallCurrency = "";

  for (const order of approvedOrders) {
    const eventDate = resolveOrderEventDate(order);
    if (!eventDate) continue;

    const eventDateMs = eventDate.getTime();
    if (Number.isFinite(resetAtMs) && eventDateMs < resetAtMs) {
      continue;
    }

    const amount = formatAmount(order.amount);
    const currency = normalizeCurrency(order.currency);
    const clientId = resolveClientIdentifier(order);

    overallTotal += amount;
    overallPaymentCount += 1;
    overallClients.add(clientId);
    overallCurrency = mergeCurrency(overallCurrency, currency);

    if (eventDate.getFullYear() !== selectedYear) {
      continue;
    }

    const monthKey = monthKeyFromDate(eventDate);
    const bucket = yearBuckets[monthKey];
    if (!bucket) {
      continue;
    }

    bucket.total += amount;
    bucket.paymentCount += 1;
    bucket.clients.add(clientId);
    bucket.currency = mergeCurrency(bucket.currency, currency);

    annualTotal += amount;
    annualPaymentCount += 1;
    annualClients.add(clientId);
    annualCurrency = mergeCurrency(annualCurrency, currency);
  }

  const monthBucket = yearBuckets[selectedMonth] || {
    month: selectedMonth,
    total: 0,
    paymentCount: 0,
    clients: new Set<string>(),
    currency: "ARS",
  };

  const selectedSummary =
    scope === "annual"
      ? {
          total: Number(annualTotal.toFixed(2)),
          paymentCount: annualPaymentCount,
          uniqueClients: annualClients.size,
          currency: annualCurrency || "ARS",
          periodLabel: String(selectedYear),
        }
      : {
          total: Number(monthBucket.total.toFixed(2)),
          paymentCount: monthBucket.paymentCount,
          uniqueClients: monthBucket.clients.size,
          currency: monthBucket.currency || "ARS",
          periodLabel: selectedMonth,
        };

  const monthlyRows = Object.values(yearBuckets)
    .map((bucket) => ({
      month: bucket.month,
      total: Number(bucket.total.toFixed(2)),
      paymentCount: bucket.paymentCount,
      uniqueClients: bucket.clients.size,
      currency: bucket.currency || "ARS",
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return NextResponse.json({
    ok: true,
    scope,
    resetAt,
    selectedMonth,
    selectedYear,
    selected: selectedSummary,
    annual: {
      total: Number(annualTotal.toFixed(2)),
      paymentCount: annualPaymentCount,
      uniqueClients: annualClients.size,
      currency: annualCurrency || "ARS",
      periodLabel: String(selectedYear),
    },
    overall: {
      total: Number(overallTotal.toFixed(2)),
      paymentCount: overallPaymentCount,
      uniqueClients: overallClients.size,
      currency: overallCurrency || "ARS",
    },
    monthlyRows,
  });
}

export async function DELETE() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const resetAt = await resetIncomeBaselineNow();

  return NextResponse.json({
    ok: true,
    resetAt,
    message:
      "Ingresos reiniciados desde este momento. Los acumulados vuelven a cero y se recalculan con nuevos pagos aprobados.",
  });
}
