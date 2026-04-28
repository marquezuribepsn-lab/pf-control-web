import { getSyncValue, setSyncValue } from "@/lib/syncStore";

export const CLIENTES_META_KEY = "pf-control-clientes-meta-v1";
export const PAYMENT_ORDERS_KEY = "pf-control-payment-orders-v1";

const DEFAULT_RENEWAL_DAYS = 30;
const DEFAULT_AMOUNT_ARS = Number(process.env.PF_PAYMENT_DEFAULT_AMOUNT_ARS || 0) || 15000;

export type ClienteMetaBilling = Record<string, unknown> & {
  email?: string;
  pagoEstado?: string;
  startDate?: string;
  endDate?: string;
  renewalDays?: number;
  moneda?: string;
  importe?: string | number;
  saldo?: string;
  emailPagador?: string;
  autoRenewPlan?: boolean;
};

export type BillingAccessReason = "active" | "no-meta" | "pending-payment" | "expired-pass";

export type BillingAccess = {
  active: boolean;
  reason: BillingAccessReason;
  clientKey: string | null;
  meta: ClienteMetaBilling | null;
  daysRemaining: number | null;
};

export type PaymentOrderProvider = "mercadopago" | "manual";
export type ManualPaymentMethod = "transferencia" | "efectivo" | "mercadopago";
export type PaymentMethod = "mercadopago" | ManualPaymentMethod;

export type PaymentOrderStatus =
  | "pending"
  | "approved"
  | "in_process"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"
  | "expired";

export type PaymentOrderRecord = {
  id: string;
  userId: string;
  email: string;
  clientKey: string | null;
  provider: PaymentOrderProvider;
  paymentMethod: PaymentMethod;
  externalReference: string;
  preferenceId: string | null;
  checkoutUrl: string | null;
  amount: number;
  currency: string;
  periodDays: number;
  status: PaymentOrderStatus;
  providerStatus: string | null;
  providerPaymentId: string | null;
  receiptNumber: string | null;
  receiptIssuedAt: string | null;
  approvedAt: string | null;
  adminNote: string | null;
  reviewedByUserId: string | null;
  reviewedByUserEmail: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ClientMetaMap = Record<string, ClienteMetaBilling>;

function nowIso() {
  return new Date().toISOString();
}

function todayDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeCurrency(value: unknown): string {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || "ARS";
}

function normalizeOrderProvider(value: unknown): PaymentOrderProvider {
  const provider = String(value || "").trim().toLowerCase();
  if (provider === "manual") {
    return "manual";
  }
  return "mercadopago";
}

function normalizeManualMethod(value: unknown): ManualPaymentMethod {
  const method = String(value || "").trim().toLowerCase();
  if (method === "efectivo") {
    return "efectivo";
  }
  if (method === "mercadopago") {
    return "mercadopago";
  }
  return "transferencia";
}

function normalizePaymentMethod(value: unknown, provider: PaymentOrderProvider): PaymentMethod {
  const method = String(value || "").trim().toLowerCase();

  if (method === "mercadopago") {
    return "mercadopago";
  }

  if (method === "transferencia" || method === "efectivo") {
    return method;
  }

  if (provider === "manual") {
    return "transferencia";
  }

  return "mercadopago";
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function parseDateOnly(value: unknown): Date | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const parsed = new Date(`${normalized.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addDays(dateOnly: string, days: number): string {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) return "";
  parsed.setDate(parsed.getDate() + days);
  return formatDateOnlyLocal(parsed);
}

function formatDateOnlyLocal(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addCalendarMonths(dateOnly: string, months: number): string {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) return "";

  const baseYear = parsed.getFullYear();
  const baseMonth = parsed.getMonth();
  const baseDay = parsed.getDate();

  const totalMonths = baseMonth + Math.max(1, Math.round(months));
  const targetYear = baseYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const targetMonthLastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(baseDay, targetMonthLastDay);

  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

function resolveRenewalEndDate(startDateOnly: string, periodDays: number): string {
  const normalizedDays = toPositiveInt(periodDays, DEFAULT_RENEWAL_DAYS);

  if (normalizedDays % DEFAULT_RENEWAL_DAYS === 0) {
    const months = Math.max(1, Math.round(normalizedDays / DEFAULT_RENEWAL_DAYS));
    return addCalendarMonths(startDateOnly, months);
  }

  return addDays(startDateOnly, normalizedDays);
}

function diffDaysInclusive(from: Date, to: Date): number {
  const start = new Date(`${from.toISOString().slice(0, 10)}T00:00:00`);
  const end = new Date(`${to.toISOString().slice(0, 10)}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(365, Math.round(parsed)));
}

function toPositiveAmount(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Number(value.toFixed(2)));
  }

  const normalized = String(value || "")
    .replace(/,/g, ".")
    .replace(/[^0-9.\-]/g, "")
    .trim();

  if (!normalized) return fallback;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(1, Number(parsed.toFixed(2)));
}

function normalizePaymentStatus(value: unknown): PaymentOrderStatus {
  const status = String(value || "").trim().toLowerCase();
  switch (status) {
    case "approved":
      return "approved";
    case "in_process":
    case "authorized":
    case "pending":
      return "in_process";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    case "charged_back":
      return "charged_back";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
}

function createOrderId() {
  return `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildManualReceiptNumber() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CMP-${yyyy}${mm}${dd}-${suffix}`;
}

export async function getClientMetaMap(): Promise<ClientMetaMap> {
  const raw = await getSyncValue(CLIENTES_META_KEY);
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return { ...(raw as ClientMetaMap) };
}

export async function saveClientMetaMap(value: ClientMetaMap): Promise<void> {
  await setSyncValue(CLIENTES_META_KEY, value);
}

export async function findClientMetaByEmail(email: string): Promise<{
  clientKey: string;
  meta: ClienteMetaBilling;
} | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const metaMap = await getClientMetaMap();

  for (const [clientKey, meta] of Object.entries(metaMap)) {
    if (!String(clientKey || "").startsWith("alumno:")) {
      continue;
    }

    if (normalizeEmail(meta?.email) === normalizedEmail) {
      return { clientKey, meta: meta || {} };
    }
  }

  return null;
}

export function isPassActive(meta: ClienteMetaBilling | null | undefined, now = new Date()): boolean {
  if (!meta) return false;

  const pagoEstado = String(meta.pagoEstado || "").trim().toLowerCase();
  if (pagoEstado && pagoEstado !== "confirmado") {
    return false;
  }

  const endDate = parseDateOnly(meta.endDate);
  if (!endDate) {
    return pagoEstado === "confirmado";
  }

  const today = parseDateOnly(todayDateOnly(now));
  if (!today) return false;

  return endDate.getTime() >= today.getTime();
}

export function getPassDaysRemaining(meta: ClienteMetaBilling | null | undefined, now = new Date()): number | null {
  if (!meta) return null;
  const endDate = parseDateOnly(meta.endDate);
  if (!endDate) return null;

  const today = parseDateOnly(todayDateOnly(now));
  if (!today) return null;

  return diffDaysInclusive(today, endDate);
}

export async function resolveBillingAccessByEmail(email: string): Promise<BillingAccess> {
  const match = await findClientMetaByEmail(email);

  if (!match) {
    return {
      active: false,
      reason: "no-meta",
      clientKey: null,
      meta: null,
      daysRemaining: null,
    };
  }

  const meta = match.meta || {};
  const pagoEstado = String(meta.pagoEstado || "").trim().toLowerCase();
  const passActive = isPassActive(meta);
  const daysRemaining = getPassDaysRemaining(meta);

  if (passActive) {
    return {
      active: true,
      reason: "active",
      clientKey: match.clientKey,
      meta,
      daysRemaining,
    };
  }

  const endDate = parseDateOnly(meta.endDate);
  const today = parseDateOnly(todayDateOnly());

  if (endDate && today && endDate.getTime() < today.getTime()) {
    return {
      active: false,
      reason: "expired-pass",
      clientKey: match.clientKey,
      meta,
      daysRemaining,
    };
  }

  if (pagoEstado !== "confirmado") {
    return {
      active: false,
      reason: "pending-payment",
      clientKey: match.clientKey,
      meta,
      daysRemaining,
    };
  }

  return {
    active: false,
    reason: "expired-pass",
    clientKey: match.clientKey,
    meta,
    daysRemaining,
  };
}

export async function applyApprovedPaymentByEmail(params: {
  email: string;
  amount: number;
  currency: string;
  periodDays?: number;
  approvedAt?: string;
}): Promise<{
  clientKey: string;
  meta: ClienteMetaBilling;
} | null> {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) return null;

  const metaMap = await getClientMetaMap();
  const foundEntry = Object.entries(metaMap).find(
    ([clientKey, value]) =>
      String(clientKey || "").startsWith("alumno:") && normalizeEmail(value?.email) === normalizedEmail
  );

  if (!foundEntry) {
    return null;
  }

  const [clientKey, currentMetaRaw] = foundEntry;
  const currentMeta = currentMetaRaw || {};

  const periodDays = toPositiveInt(
    params.periodDays ?? currentMeta.renewalDays,
    DEFAULT_RENEWAL_DAYS
  );

  const approvedDate = parseDateOnly(params.approvedAt) || parseDateOnly(todayDateOnly()) || new Date();
  const approvedDateOnly = formatDateOnlyLocal(approvedDate);

  // Renewals are recalculated from the payment approval date, not from a previous end date.
  const nextStartDate = approvedDateOnly;
  const nextEndDate = resolveRenewalEndDate(nextStartDate, periodDays);

  const nextMeta: ClienteMetaBilling = {
    ...currentMeta,
    email: normalizeEmail(currentMeta.email || normalizedEmail),
    pagoEstado: "confirmado",
    moneda: normalizeCurrency(params.currency || currentMeta.moneda),
    importe: String(toPositiveAmount(params.amount, DEFAULT_AMOUNT_ARS)),
    saldo: "0",
    emailPagador: normalizedEmail,
    startDate: nextStartDate,
    endDate: nextEndDate,
    renewalDays: periodDays,
  };

  metaMap[clientKey] = nextMeta;
  await saveClientMetaMap(metaMap);

  return {
    clientKey,
    meta: nextMeta,
  };
}

export async function getPaymentOrders(): Promise<PaymentOrderRecord[]> {
  const raw = await getSyncValue(PAYMENT_ORDERS_KEY);
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const value = row as Record<string, unknown>;
      const provider = normalizeOrderProvider(value.provider);
      return {
        id: String(value.id || createOrderId()),
        userId: String(value.userId || ""),
        email: normalizeEmail(value.email),
        clientKey: value.clientKey ? String(value.clientKey) : null,
        provider,
        paymentMethod: normalizePaymentMethod(value.paymentMethod, provider),
        externalReference: String(value.externalReference || ""),
        preferenceId: value.preferenceId ? String(value.preferenceId) : null,
        checkoutUrl: value.checkoutUrl ? String(value.checkoutUrl) : null,
        amount: toPositiveAmount(value.amount, DEFAULT_AMOUNT_ARS),
        currency: normalizeCurrency(value.currency),
        periodDays: toPositiveInt(value.periodDays, DEFAULT_RENEWAL_DAYS),
        status: normalizePaymentStatus(value.status),
        providerStatus: value.providerStatus ? String(value.providerStatus) : null,
        providerPaymentId: value.providerPaymentId ? String(value.providerPaymentId) : null,
        receiptNumber: normalizeOptionalText(value.receiptNumber),
        receiptIssuedAt: normalizeOptionalText(value.receiptIssuedAt),
        approvedAt: value.approvedAt ? String(value.approvedAt) : null,
        adminNote: normalizeOptionalText(value.adminNote),
        reviewedByUserId: normalizeOptionalText(value.reviewedByUserId),
        reviewedByUserEmail: normalizeOptionalText(value.reviewedByUserEmail),
        reviewedAt: normalizeOptionalText(value.reviewedAt),
        createdAt: String(value.createdAt || nowIso()),
        updatedAt: String(value.updatedAt || nowIso()),
      } satisfies PaymentOrderRecord;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function savePaymentOrders(value: PaymentOrderRecord[]): Promise<void> {
  await setSyncValue(PAYMENT_ORDERS_KEY, value.slice(0, 4000));
}

export async function createPaymentOrder(input: {
  userId: string;
  email: string;
  clientKey: string | null;
  provider?: PaymentOrderProvider;
  paymentMethod?: PaymentMethod;
  externalReference: string;
  amount: number;
  currency: string;
  periodDays: number;
  status?: PaymentOrderStatus;
  providerStatus?: string | null;
  preferenceId?: string | null;
  checkoutUrl?: string | null;
  receiptNumber?: string | null;
  receiptIssuedAt?: string | null;
  adminNote?: string | null;
  reviewedByUserId?: string | null;
  reviewedByUserEmail?: string | null;
  reviewedAt?: string | null;
}): Promise<PaymentOrderRecord> {
  const now = nowIso();
  const provider = input.provider || "mercadopago";
  const paymentMethod = normalizePaymentMethod(input.paymentMethod, provider);
  const order: PaymentOrderRecord = {
    id: createOrderId(),
    userId: String(input.userId || ""),
    email: normalizeEmail(input.email),
    clientKey: input.clientKey || null,
    provider,
    paymentMethod,
    externalReference: String(input.externalReference || ""),
    preferenceId: input.preferenceId ? String(input.preferenceId) : null,
    checkoutUrl: input.checkoutUrl ? String(input.checkoutUrl) : null,
    amount: toPositiveAmount(input.amount, DEFAULT_AMOUNT_ARS),
    currency: normalizeCurrency(input.currency),
    periodDays: toPositiveInt(input.periodDays, DEFAULT_RENEWAL_DAYS),
    status: normalizePaymentStatus(input.status || "pending"),
    providerStatus: normalizeOptionalText(input.providerStatus),
    providerPaymentId: null,
    receiptNumber: normalizeOptionalText(input.receiptNumber),
    receiptIssuedAt: normalizeOptionalText(input.receiptIssuedAt),
    approvedAt: null,
    adminNote: normalizeOptionalText(input.adminNote),
    reviewedByUserId: normalizeOptionalText(input.reviewedByUserId),
    reviewedByUserEmail: normalizeOptionalText(input.reviewedByUserEmail),
    reviewedAt: normalizeOptionalText(input.reviewedAt),
    createdAt: now,
    updatedAt: now,
  };

  const orders = await getPaymentOrders();
  const filtered = orders.filter((item) => item.externalReference !== order.externalReference);
  filtered.unshift(order);
  await savePaymentOrders(filtered);
  return order;
}

export async function createManualPaymentRequest(input: {
  userId: string;
  email: string;
  clientKey: string | null;
  amount: number;
  currency: string;
  periodDays: number;
  method: ManualPaymentMethod;
  note?: string;
}): Promise<PaymentOrderRecord> {
  const externalReference = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return createPaymentOrder({
    userId: input.userId,
    email: input.email,
    clientKey: input.clientKey,
    provider: "manual",
    paymentMethod: input.method,
    externalReference,
    amount: input.amount,
    currency: input.currency,
    periodDays: input.periodDays,
    status: "pending",
    providerStatus: "pending_admin_confirmation",
    receiptNumber: buildManualReceiptNumber(),
    receiptIssuedAt: nowIso(),
    adminNote: input.note || null,
  });
}

type PaymentOrderPatch = Partial<Pick<
  PaymentOrderRecord,
  | "status"
  | "providerStatus"
  | "providerPaymentId"
  | "receiptNumber"
  | "receiptIssuedAt"
  | "approvedAt"
  | "checkoutUrl"
  | "preferenceId"
  | "paymentMethod"
  | "adminNote"
  | "reviewedByUserId"
  | "reviewedByUserEmail"
  | "reviewedAt"
>>;

function applyOrderPatch(current: PaymentOrderRecord, patch: PaymentOrderPatch): PaymentOrderRecord {
  return {
    ...current,
    status: patch.status ? normalizePaymentStatus(patch.status) : current.status,
    providerStatus: patch.providerStatus !== undefined
      ? normalizeOptionalText(patch.providerStatus)
      : current.providerStatus,
    providerPaymentId: patch.providerPaymentId !== undefined
      ? normalizeOptionalText(patch.providerPaymentId)
      : current.providerPaymentId,
    receiptNumber: patch.receiptNumber !== undefined
      ? normalizeOptionalText(patch.receiptNumber)
      : current.receiptNumber,
    receiptIssuedAt: patch.receiptIssuedAt !== undefined
      ? normalizeOptionalText(patch.receiptIssuedAt)
      : current.receiptIssuedAt,
    approvedAt: patch.approvedAt !== undefined ? normalizeOptionalText(patch.approvedAt) : current.approvedAt,
    checkoutUrl: patch.checkoutUrl !== undefined ? normalizeOptionalText(patch.checkoutUrl) : current.checkoutUrl,
    preferenceId: patch.preferenceId !== undefined ? normalizeOptionalText(patch.preferenceId) : current.preferenceId,
    paymentMethod: patch.paymentMethod
      ? normalizePaymentMethod(patch.paymentMethod, current.provider)
      : current.paymentMethod,
    adminNote: patch.adminNote !== undefined ? normalizeOptionalText(patch.adminNote) : current.adminNote,
    reviewedByUserId: patch.reviewedByUserId !== undefined
      ? normalizeOptionalText(patch.reviewedByUserId)
      : current.reviewedByUserId,
    reviewedByUserEmail: patch.reviewedByUserEmail !== undefined
      ? normalizeOptionalText(patch.reviewedByUserEmail)
      : current.reviewedByUserEmail,
    reviewedAt: patch.reviewedAt !== undefined ? normalizeOptionalText(patch.reviewedAt) : current.reviewedAt,
    updatedAt: nowIso(),
  };
}

export async function updatePaymentOrderByExternalReference(
  externalReference: string,
  patch: PaymentOrderPatch
): Promise<PaymentOrderRecord | null> {
  const normalizedReference = String(externalReference || "").trim();
  if (!normalizedReference) return null;

  const orders = await getPaymentOrders();
  const index = orders.findIndex((item) => item.externalReference === normalizedReference);
  if (index < 0) return null;

  const next = applyOrderPatch(orders[index], patch);

  orders[index] = next;
  await savePaymentOrders(orders);
  return next;
}

export async function updatePaymentOrderById(
  orderId: string,
  patch: PaymentOrderPatch
): Promise<PaymentOrderRecord | null> {
  const normalizedId = String(orderId || "").trim();
  if (!normalizedId) return null;

  const orders = await getPaymentOrders();
  const index = orders.findIndex((item) => item.id === normalizedId);
  if (index < 0) return null;

  const next = applyOrderPatch(orders[index], patch);
  orders[index] = next;

  await savePaymentOrders(orders);
  return next;
}

export async function getManualPaymentOrders(options?: {
  onlyPending?: boolean;
  email?: string;
}): Promise<PaymentOrderRecord[]> {
  const orders = await getPaymentOrders();
  const normalizedEmail = options?.email ? normalizeEmail(options.email) : "";

  return orders.filter((item) => {
    const isManual =
      item.provider === "manual" ||
      item.paymentMethod === "transferencia" ||
      item.paymentMethod === "efectivo" ||
      item.paymentMethod === "mercadopago";
    if (!isManual) return false;

    if (normalizedEmail && item.email !== normalizedEmail) {
      return false;
    }

    if (options?.onlyPending) {
      return item.status === "pending" || item.providerStatus === "pending_admin_confirmation";
    }

    return true;
  });
}

export async function getLatestPaymentOrderForEmail(email: string): Promise<PaymentOrderRecord | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const orders = await getPaymentOrders();
  return orders.find((item) => item.email === normalizedEmail) || null;
}

export async function getLatestApprovedPaymentOrderForEmail(email: string): Promise<PaymentOrderRecord | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const orders = await getPaymentOrders();
  return (
    orders.find((item) => item.email === normalizedEmail && item.status === "approved") || null
  );
}

export function getBillingDefaults(meta: ClienteMetaBilling | null | undefined) {
  return {
    amount: toPositiveAmount(meta?.importe, DEFAULT_AMOUNT_ARS),
    currency: normalizeCurrency(meta?.moneda || "ARS"),
    periodDays: toPositiveInt(meta?.renewalDays, DEFAULT_RENEWAL_DAYS),
  };
}

export function mapMercadoPagoStatus(status: unknown): PaymentOrderStatus {
  return normalizePaymentStatus(status);
}
