import { getSyncValue, setSyncValue } from "@/lib/syncStore";

export const PAYMENT_TRANSFER_ACCOUNTS_KEY = "pf-control-payment-transfer-accounts-v1";

export type TransferDestinationAccountRecord = {
  id: string;
  label: string;
  bankName: string;
  accountType: string;
  holderName: string;
  holderDocument: string;
  accountNumber: string;
  cbu: string;
  alias: string;
  notes: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

type TransferDestinationAccountInput = Partial<TransferDestinationAccountRecord> & {
  label?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value: unknown, maxLength: number): string {
  return String(value || "").trim().slice(0, Math.max(1, maxLength));
}

function normalizeVisibility(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return true;
}

function normalizeAccountRecord(value: unknown): TransferDestinationAccountRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = normalizeText(row.id, 80);
  const label = normalizeText(row.label, 120);

  if (!id || !label) {
    return null;
  }

  const createdAt = normalizeText(row.createdAt, 40) || nowIso();
  const updatedAt = normalizeText(row.updatedAt, 40) || createdAt;

  return {
    id,
    label,
    bankName: normalizeText(row.bankName, 120),
    accountType: normalizeText(row.accountType, 80),
    holderName: normalizeText(row.holderName, 120),
    holderDocument: normalizeText(row.holderDocument, 60),
    accountNumber: normalizeText(row.accountNumber, 80),
    cbu: normalizeText(row.cbu, 80),
    alias: normalizeText(row.alias, 120),
    notes: normalizeText(row.notes, 400),
    isVisible: normalizeVisibility(row.isVisible),
    createdAt,
    updatedAt,
  };
}

async function saveTransferAccounts(accounts: TransferDestinationAccountRecord[]): Promise<void> {
  await setSyncValue(PAYMENT_TRANSFER_ACCOUNTS_KEY, accounts.slice(0, 120));
}

export async function getTransferAccounts(): Promise<TransferDestinationAccountRecord[]> {
  const raw = await getSyncValue(PAYMENT_TRANSFER_ACCOUNTS_KEY);
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => normalizeAccountRecord(item))
    .filter((item): item is TransferDestinationAccountRecord => Boolean(item))
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
}

export async function getVisibleTransferAccounts(): Promise<TransferDestinationAccountRecord[]> {
  const accounts = await getTransferAccounts();
  return accounts.filter((item) => item.isVisible);
}

export async function upsertTransferAccount(
  input: TransferDestinationAccountInput
): Promise<TransferDestinationAccountRecord> {
  const accounts = await getTransferAccounts();
  const normalizedId = normalizeText(input.id, 80);
  const now = nowIso();

  const current = normalizedId
    ? accounts.find((item) => item.id === normalizedId) || null
    : null;

  const next: TransferDestinationAccountRecord = {
    id: current?.id || createId(),
    label: normalizeText(input.label ?? current?.label, 120),
    bankName: normalizeText(input.bankName ?? current?.bankName, 120),
    accountType: normalizeText(input.accountType ?? current?.accountType, 80),
    holderName: normalizeText(input.holderName ?? current?.holderName, 120),
    holderDocument: normalizeText(input.holderDocument ?? current?.holderDocument, 60),
    accountNumber: normalizeText(input.accountNumber ?? current?.accountNumber, 80),
    cbu: normalizeText(input.cbu ?? current?.cbu, 80),
    alias: normalizeText(input.alias ?? current?.alias, 120),
    notes: normalizeText(input.notes ?? current?.notes, 400),
    isVisible:
      input.isVisible === undefined
        ? current?.isVisible ?? true
        : normalizeVisibility(input.isVisible),
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };

  if (!next.label) {
    throw new Error("La cuenta debe tener una etiqueta visible.");
  }

  if (!next.cbu && !next.alias && !next.accountNumber) {
    throw new Error("Debes indicar al menos CBU/CVU, alias o numero de cuenta.");
  }

  const withoutCurrent = accounts.filter((item) => item.id !== next.id);
  withoutCurrent.unshift(next);
  await saveTransferAccounts(withoutCurrent);

  return next;
}

export async function deleteTransferAccount(id: string): Promise<boolean> {
  const normalizedId = normalizeText(id, 80);
  if (!normalizedId) {
    return false;
  }

  const accounts = await getTransferAccounts();
  const next = accounts.filter((item) => item.id !== normalizedId);

  if (next.length === accounts.length) {
    return false;
  }

  await saveTransferAccounts(next);
  return true;
}
