import QRCode from "qrcode";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";

export const PAYMENT_MERCADOPAGO_QR_STORE_KEY = "pf-control-payment-mercadopago-qr-store-v1";

export type MercadoPagoQrStoreRecord = {
  enabled: boolean;
  label: string;
  paymentLink: string;
  qrPayload: string;
  qrImageDataUrl: string | null;
  notes: string;
  updatedAt: string | null;
};

type MercadoPagoQrStoreInput = Partial<{
  enabled: boolean;
  label: string;
  paymentLink: string;
  qrPayload: string;
  notes: string;
}>;

const DEFAULT_QR_STORE_CONFIG: MercadoPagoQrStoreRecord = {
  enabled: false,
  label: "",
  paymentLink: "",
  qrPayload: "",
  qrImageDataUrl: null,
  notes: "",
  updatedAt: null,
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: unknown, maxLength: number): string {
  return String(value || "").trim().slice(0, Math.max(1, maxLength));
}

function normalizeEnabled(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  if (normalized === "1" || normalized === "true" || normalized === "si" || normalized === "yes") {
    return true;
  }

  return fallback;
}

function normalizeRecord(value: unknown): MercadoPagoQrStoreRecord {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_QR_STORE_CONFIG };
  }

  const row = value as Record<string, unknown>;
  const paymentLink = normalizeText(row.paymentLink, 900);
  const qrPayload = normalizeText(row.qrPayload, 900) || paymentLink;

  return {
    enabled: normalizeEnabled(row.enabled, false),
    label: normalizeText(row.label, 120),
    paymentLink,
    qrPayload,
    qrImageDataUrl: normalizeText(row.qrImageDataUrl, 10000) || null,
    notes: normalizeText(row.notes, 500),
    updatedAt: normalizeText(row.updatedAt, 40) || null,
  };
}

async function buildQrDataUrl(payload: string): Promise<string | null> {
  const normalizedPayload = normalizeText(payload, 900);
  if (!normalizedPayload) {
    return null;
  }

  try {
    return await QRCode.toDataURL(normalizedPayload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 600,
    });
  } catch {
    throw new Error("No se pudo generar el QR. Revisa el texto o enlace ingresado.");
  }
}

async function saveConfig(config: MercadoPagoQrStoreRecord): Promise<void> {
  await setSyncValue(PAYMENT_MERCADOPAGO_QR_STORE_KEY, config);
}

export async function getMercadoPagoQrStoreConfig(): Promise<MercadoPagoQrStoreRecord> {
  const raw = await getSyncValue(PAYMENT_MERCADOPAGO_QR_STORE_KEY);
  const config = normalizeRecord(raw);

  if (config.qrPayload && !config.qrImageDataUrl) {
    const refreshed: MercadoPagoQrStoreRecord = {
      ...config,
      qrImageDataUrl: await buildQrDataUrl(config.qrPayload),
      updatedAt: config.updatedAt || nowIso(),
    };

    await saveConfig(refreshed);
    return refreshed;
  }

  return config;
}

export async function upsertMercadoPagoQrStoreConfig(
  input: MercadoPagoQrStoreInput
): Promise<MercadoPagoQrStoreRecord> {
  const current = await getMercadoPagoQrStoreConfig();
  const nextEnabled =
    input.enabled === undefined ? current.enabled : normalizeEnabled(input.enabled, current.enabled);
  const nextLabel =
    input.label === undefined ? current.label : normalizeText(input.label, 120);
  const nextPaymentLink =
    input.paymentLink === undefined ? current.paymentLink : normalizeText(input.paymentLink, 900);
  const nextQrPayloadInput =
    input.qrPayload === undefined ? current.qrPayload : normalizeText(input.qrPayload, 900);
  const nextQrPayload = nextQrPayloadInput || nextPaymentLink;
  const nextNotes =
    input.notes === undefined ? current.notes : normalizeText(input.notes, 500);

  if (nextEnabled && !nextQrPayload) {
    throw new Error("Para habilitar QR de tienda debes cargar un enlace o texto QR.");
  }

  const nextConfig: MercadoPagoQrStoreRecord = {
    enabled: nextEnabled,
    label: nextLabel || (nextEnabled ? "Mercado Pago QR" : ""),
    paymentLink: nextPaymentLink,
    qrPayload: nextQrPayload,
    qrImageDataUrl: nextQrPayload ? await buildQrDataUrl(nextQrPayload) : null,
    notes: nextNotes,
    updatedAt: nowIso(),
  };

  await saveConfig(nextConfig);
  return nextConfig;
}

export async function resetMercadoPagoQrStoreConfig(): Promise<MercadoPagoQrStoreRecord> {
  const cleared: MercadoPagoQrStoreRecord = {
    ...DEFAULT_QR_STORE_CONFIG,
    updatedAt: nowIso(),
  };

  await saveConfig(cleared);
  return cleared;
}
