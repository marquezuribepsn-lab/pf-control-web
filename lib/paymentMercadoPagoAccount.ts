import crypto from "crypto";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";

export const PAYMENT_MERCADOPAGO_LINKED_ACCOUNT_KEY = "pf-control-payment-mercadopago-linked-account-v1";
export const PAYMENT_MERCADOPAGO_OAUTH_STATE_KEY = "pf-control-payment-mercadopago-oauth-state-v1";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000;

type MercadoPagoLinkedAccountStored = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scope: string | null;
  publicKey: string | null;
  userId: string | null;
  nickname: string | null;
  email: string | null;
  expiresAt: string | null;
  connectedAt: string;
  updatedAt: string;
};

type MercadoPagoOauthStateStored = {
  state: string;
  adminUserId: string;
  createdAt: string;
};

type MercadoPagoOauthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  user_id?: number | string;
  public_key?: string;
  expires_in?: number;
};

type MercadoPagoMeResponse = {
  id?: number | string;
  nickname?: string;
  email?: string;
};

export type MercadoPagoLinkedAccountPublic = {
  userId: string | null;
  nickname: string | null;
  email: string | null;
  scope: string | null;
  publicKey: string | null;
  expiresAt: string | null;
  connectedAt: string;
  updatedAt: string;
};

export type MercadoPagoAccessResolution = {
  configured: boolean;
  source: "linked-account" | "env" | "none";
  accessToken: string | null;
  expectedCollectorId: string | null;
  accountLabel: string | null;
  linkedAccount: MercadoPagoLinkedAccountPublic | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: unknown, maxLength: number): string {
  return String(value || "").trim().slice(0, Math.max(1, maxLength));
}

function normalizeNullableText(value: unknown, maxLength: number): string | null {
  const normalized = normalizeText(value, maxLength);
  return normalized || null;
}

function normalizeIsoDate(value: unknown): string | null {
  const normalized = normalizeText(value, 40);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeLinkedAccount(value: unknown): MercadoPagoLinkedAccountStored | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const accessToken = normalizeText(row.accessToken, 3000);
  if (!accessToken) {
    return null;
  }

  const connectedAt = normalizeIsoDate(row.connectedAt) || nowIso();
  const updatedAt = normalizeIsoDate(row.updatedAt) || connectedAt;

  return {
    accessToken,
    refreshToken: normalizeNullableText(row.refreshToken, 3000),
    tokenType: normalizeText(row.tokenType, 40) || "bearer",
    scope: normalizeNullableText(row.scope, 200),
    publicKey: normalizeNullableText(row.publicKey, 120),
    userId: normalizeNullableText(row.userId, 60),
    nickname: normalizeNullableText(row.nickname, 120),
    email: normalizeNullableText(row.email, 200),
    expiresAt: normalizeIsoDate(row.expiresAt),
    connectedAt,
    updatedAt,
  };
}

function toPublicLinkedAccount(
  value: MercadoPagoLinkedAccountStored | null
): MercadoPagoLinkedAccountPublic | null {
  if (!value) {
    return null;
  }

  return {
    userId: value.userId,
    nickname: value.nickname,
    email: value.email,
    scope: value.scope,
    publicKey: value.publicKey,
    expiresAt: value.expiresAt,
    connectedAt: value.connectedAt,
    updatedAt: value.updatedAt,
  };
}

function buildExpiresAt(expiresInSeconds: number | null | undefined): string | null {
  const expiresIn = Number(expiresInSeconds);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    return null;
  }

  return new Date(Date.now() + Math.round(expiresIn * 1000)).toISOString();
}

function shouldRefreshToken(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return expiresAtMs - Date.now() <= TOKEN_REFRESH_MARGIN_MS;
}

function getMercadoPagoOauthClientId(): string {
  return normalizeText(process.env.MERCADOPAGO_APP_CLIENT_ID, 120);
}

function getMercadoPagoOauthClientSecret(): string {
  return normalizeText(process.env.MERCADOPAGO_APP_CLIENT_SECRET, 300);
}

export function isMercadoPagoOauthConfigured(): boolean {
  return Boolean(getMercadoPagoOauthClientId() && getMercadoPagoOauthClientSecret());
}

export function buildMercadoPagoOauthAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", params.state);
  url.searchParams.set("redirect_uri", params.redirectUri);
  return url.toString();
}

async function fetchMercadoPagoMe(accessToken: string): Promise<MercadoPagoMeResponse | null> {
  const token = normalizeText(accessToken, 3000);
  if (!token) {
    return null;
  }

  const response = await fetch("https://api.mercadopago.com/users/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => ({}))) as MercadoPagoMeResponse;
  return data && typeof data === "object" ? data : null;
}

async function setLinkedAccountInternal(value: MercadoPagoLinkedAccountStored): Promise<void> {
  await setSyncValue(PAYMENT_MERCADOPAGO_LINKED_ACCOUNT_KEY, value);
}

export async function getMercadoPagoLinkedAccountStored(): Promise<MercadoPagoLinkedAccountStored | null> {
  const raw = await getSyncValue(PAYMENT_MERCADOPAGO_LINKED_ACCOUNT_KEY);
  const normalized = normalizeLinkedAccount(raw);

  if (!normalized) {
    return null;
  }

  return normalized;
}

export async function getMercadoPagoLinkedAccountPublic(): Promise<MercadoPagoLinkedAccountPublic | null> {
  const account = await getMercadoPagoLinkedAccountStored();
  return toPublicLinkedAccount(account);
}

export async function clearMercadoPagoLinkedAccount(): Promise<void> {
  await setSyncValue(PAYMENT_MERCADOPAGO_LINKED_ACCOUNT_KEY, null);
}

async function refreshMercadoPagoLinkedToken(
  account: MercadoPagoLinkedAccountStored
): Promise<MercadoPagoLinkedAccountStored> {
  if (!shouldRefreshToken(account.expiresAt)) {
    return account;
  }

  if (!account.refreshToken) {
    return account;
  }

  const clientId = getMercadoPagoOauthClientId();
  const clientSecret = getMercadoPagoOauthClientSecret();
  if (!clientId || !clientSecret) {
    return account;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: account.refreshToken,
  });

  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    return account;
  }

  const data = (await response.json().catch(() => ({}))) as MercadoPagoOauthTokenResponse;
  const accessToken = normalizeText(data.access_token, 3000);
  if (!accessToken) {
    return account;
  }

  const meData = await fetchMercadoPagoMe(accessToken);
  const now = nowIso();
  const refreshed: MercadoPagoLinkedAccountStored = {
    accessToken,
    refreshToken: normalizeNullableText(data.refresh_token, 3000) || account.refreshToken,
    tokenType: normalizeText(data.token_type, 40) || account.tokenType || "bearer",
    scope: normalizeNullableText(data.scope, 200) || account.scope,
    publicKey: normalizeNullableText(data.public_key, 120) || account.publicKey,
    userId: normalizeNullableText(meData?.id, 60) || normalizeNullableText(data.user_id, 60) || account.userId,
    nickname: normalizeNullableText(meData?.nickname, 120) || account.nickname,
    email: normalizeNullableText(meData?.email, 200) || account.email,
    expiresAt: buildExpiresAt(data.expires_in) || account.expiresAt,
    connectedAt: account.connectedAt,
    updatedAt: now,
  };

  await setLinkedAccountInternal(refreshed);
  return refreshed;
}

export async function resolveMercadoPagoAccess(): Promise<MercadoPagoAccessResolution> {
  const linked = await getMercadoPagoLinkedAccountStored();
  if (linked?.accessToken) {
    const refreshed = await refreshMercadoPagoLinkedToken(linked);
    return {
      configured: true,
      source: "linked-account",
      accessToken: refreshed.accessToken,
      expectedCollectorId: refreshed.userId,
      accountLabel: refreshed.nickname,
      linkedAccount: toPublicLinkedAccount(refreshed),
    };
  }

  const envAccessToken = normalizeText(process.env.MERCADOPAGO_ACCESS_TOKEN, 3000);
  const expectedCollectorId = normalizeNullableText(process.env.MERCADOPAGO_COLLECTOR_ID, 80);
  const accountLabel = normalizeNullableText(process.env.PF_MERCADOPAGO_ACCOUNT_LABEL, 120);

  if (envAccessToken) {
    return {
      configured: true,
      source: "env",
      accessToken: envAccessToken,
      expectedCollectorId,
      accountLabel,
      linkedAccount: null,
    };
  }

  return {
    configured: false,
    source: "none",
    accessToken: null,
    expectedCollectorId: null,
    accountLabel: null,
    linkedAccount: null,
  };
}

export async function createMercadoPagoOauthState(adminUserId: string): Promise<string> {
  const state = crypto.randomBytes(24).toString("hex");
  const payload: MercadoPagoOauthStateStored = {
    state,
    adminUserId: normalizeText(adminUserId, 120),
    createdAt: nowIso(),
  };

  await setSyncValue(PAYMENT_MERCADOPAGO_OAUTH_STATE_KEY, payload);
  return state;
}

export async function consumeMercadoPagoOauthState(params: {
  state: string;
  adminUserId: string;
}): Promise<boolean> {
  const expectedState = normalizeText(params.state, 200);
  const expectedAdminUserId = normalizeText(params.adminUserId, 120);
  if (!expectedState || !expectedAdminUserId) {
    return false;
  }

  const raw = await getSyncValue(PAYMENT_MERCADOPAGO_OAUTH_STATE_KEY);
  const payload = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const storedState = normalizeText(payload?.state, 200);
  const storedAdminUserId = normalizeText(payload?.adminUserId, 120);
  const createdAt = normalizeIsoDate(payload?.createdAt);

  await setSyncValue(PAYMENT_MERCADOPAGO_OAUTH_STATE_KEY, null);

  if (!storedState || !storedAdminUserId || !createdAt) {
    return false;
  }

  if (storedState !== expectedState) {
    return false;
  }

  if (storedAdminUserId !== expectedAdminUserId) {
    return false;
  }

  const ageMs = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > OAUTH_STATE_TTL_MS) {
    return false;
  }

  return true;
}

export async function exchangeMercadoPagoOauthCode(params: {
  code: string;
  redirectUri: string;
}): Promise<MercadoPagoOauthTokenResponse> {
  const code = normalizeText(params.code, 600);
  const redirectUri = normalizeText(params.redirectUri, 1000);
  const clientId = getMercadoPagoOauthClientId();
  const clientSecret = getMercadoPagoOauthClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("OAuth de Mercado Pago no configurado. Falta MERCADOPAGO_APP_CLIENT_ID o MERCADOPAGO_APP_CLIENT_SECRET.");
  }

  if (!code || !redirectUri) {
    throw new Error("Falta codigo o redirectUri para completar OAuth de Mercado Pago.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `No se pudo completar OAuth con Mercado Pago (${response.status}). ${errorBody || ""}`.trim()
    );
  }

  const data = (await response.json().catch(() => ({}))) as MercadoPagoOauthTokenResponse;
  const accessToken = normalizeText(data.access_token, 3000);
  if (!accessToken) {
    throw new Error("Mercado Pago no devolvio access_token al conectar la cuenta.");
  }

  return data;
}

export async function linkMercadoPagoAccountFromOauthToken(
  tokenData: MercadoPagoOauthTokenResponse
): Promise<MercadoPagoLinkedAccountPublic> {
  const accessToken = normalizeText(tokenData.access_token, 3000);
  if (!accessToken) {
    throw new Error("No se pudo guardar la cuenta de Mercado Pago: access_token invalido.");
  }

  const current = await getMercadoPagoLinkedAccountStored();
  const meData = await fetchMercadoPagoMe(accessToken);
  const now = nowIso();

  const next: MercadoPagoLinkedAccountStored = {
    accessToken,
    refreshToken: normalizeNullableText(tokenData.refresh_token, 3000),
    tokenType: normalizeText(tokenData.token_type, 40) || "bearer",
    scope: normalizeNullableText(tokenData.scope, 200),
    publicKey: normalizeNullableText(tokenData.public_key, 120),
    userId: normalizeNullableText(meData?.id, 60) || normalizeNullableText(tokenData.user_id, 60),
    nickname: normalizeNullableText(meData?.nickname, 120),
    email: normalizeNullableText(meData?.email, 200),
    expiresAt: buildExpiresAt(tokenData.expires_in),
    connectedAt: current?.connectedAt || now,
    updatedAt: now,
  };

  await setLinkedAccountInternal(next);
  return toPublicLinkedAccount(next) as MercadoPagoLinkedAccountPublic;
}
