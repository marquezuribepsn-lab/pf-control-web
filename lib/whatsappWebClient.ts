import path from "path";
import { normalizeWhatsAppPhone } from "@/lib/whatsappAlerts";

type SessionStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "connected"
  | "auth_failure"
  | "error";

type SendWhatsAppWebResult = {
  ok: boolean;
  status: number;
  providerMessageId: string | null;
  error: string | null;
  sessionStatus: SessionStatus;
};

export type WhatsAppWebSessionSnapshot = {
  status: SessionStatus;
  connected: boolean;
  phone: string | null;
  pushname: string | null;
  qr: string | null;
  qrImageDataUrl: string | null;
  lastError: string | null;
  lastEventAt: string | null;
};

type ClientInfoShape = {
  wid?: {
    user?: string;
  };
  pushname?: string;
};

type SendMessageResultShape = {
  id?: {
    _serialized?: string;
  };
};

type WhatsAppWebClient = {
  initialize: () => Promise<void>;
  destroy: () => Promise<void>;
  logout: () => Promise<void>;
  sendMessage: (chatId: string, message: string) => Promise<SendMessageResultShape>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  info?: ClientInfoShape;
};

type WhatsAppWebDependencies = {
  ClientCtor: new (options: Record<string, unknown>) => WhatsAppWebClient;
  LocalAuthCtor: new (options: Record<string, unknown>) => unknown;
  toDataURL: (text: string, options?: Record<string, unknown>) => Promise<string>;
};

type InternalState = {
  client: WhatsAppWebClient | null;
  initPromise: Promise<void> | null;
  status: SessionStatus;
  phone: string | null;
  pushname: string | null;
  qr: string | null;
  qrImageDataUrl: string | null;
  lastError: string | null;
  lastEventAt: string | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  shouldKeepAlive: boolean;
};

const GLOBAL_STATE_KEY = "__pf_whatsapp_web_state__";
const DEFAULT_INIT_TIMEOUT_MS = 12000;
const BASE_RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_DELAY_MS = 30000;

declare global {
  var __pf_whatsapp_web_state__: InternalState | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function createInitialState(): InternalState {
  return {
    client: null,
    initPromise: null,
    status: "disconnected",
    phone: null,
    pushname: null,
    qr: null,
    qrImageDataUrl: null,
    lastError: null,
    lastEventAt: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    shouldKeepAlive: false,
  };
}

function clearReconnectTimer() {
  const state = getState();
  if (!state.reconnectTimer) {
    return;
  }
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
}

function scheduleReconnect(reason: string) {
  const state = getState();
  if (!state.shouldKeepAlive || state.reconnectTimer) {
    return;
  }

  const attempt = state.reconnectAttempts + 1;
  state.reconnectAttempts = attempt;
  const nextDelay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** (attempt - 1), MAX_RECONNECT_DELAY_MS);

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;

    if (!getState().shouldKeepAlive) {
      return;
    }

    void connectWhatsAppWebSession()
      .then((snapshot) => {
        const current = getState();
        if (snapshot.status === "connected") {
          current.reconnectAttempts = 0;
          return;
        }

        if (current.shouldKeepAlive) {
          scheduleReconnect(reason);
        }
      })
      .catch((error) => {
        updateState({
          status: "error",
          lastError:
            error instanceof Error
              ? `reconnect_failed_${reason}: ${error.message}`
              : `reconnect_failed_${reason}`,
        });

        if (getState().shouldKeepAlive) {
          scheduleReconnect(reason);
        }
      });
  }, nextDelay);
}

function getState(): InternalState {
  const globalRef = globalThis as unknown as Record<string, InternalState | undefined>;
  const existing = globalRef[GLOBAL_STATE_KEY];
  if (existing) {
    return existing;
  }

  const created = createInitialState();
  globalRef[GLOBAL_STATE_KEY] = created;
  return created;
}

function updateState(patch: Partial<InternalState>) {
  const state = getState();
  Object.assign(state, patch, { lastEventAt: nowIso() });
}

function toSnapshot(includeQr: boolean): WhatsAppWebSessionSnapshot {
  const state = getState();
  return {
    status: state.status,
    connected: state.status === "connected",
    phone: state.phone,
    pushname: state.pushname,
    qr: includeQr ? state.qr : null,
    qrImageDataUrl: includeQr ? state.qrImageDataUrl : null,
    lastError: state.lastError,
    lastEventAt: state.lastEventAt,
  };
}

async function loadDependencies(): Promise<WhatsAppWebDependencies> {
  const [{ default: QRCode }, whatsappWebModule] = await Promise.all([
    import("qrcode"),
    import("whatsapp-web.js"),
  ]);

  const ClientCtor = (whatsappWebModule as { Client?: unknown }).Client;
  const LocalAuthCtor = (whatsappWebModule as { LocalAuth?: unknown }).LocalAuth;

  if (typeof ClientCtor !== "function" || typeof LocalAuthCtor !== "function") {
    throw new Error("No se pudo inicializar dependencias de WhatsApp Web");
  }

  return {
    ClientCtor: ClientCtor as WhatsAppWebDependencies["ClientCtor"],
    LocalAuthCtor: LocalAuthCtor as WhatsAppWebDependencies["LocalAuthCtor"],
    toDataURL: QRCode.toDataURL,
  };
}

function resolveAuthDataPath() {
  const raw = String(process.env.WHATSAPP_WEB_SESSION_DIR || "").trim();
  if (raw) {
    return path.resolve(raw);
  }
  return path.join(process.cwd(), "storage", "whatsapp-web-auth");
}

async function initializeClient() {
  const state = getState();
  state.shouldKeepAlive = true;

  if (state.initPromise) {
    await state.initPromise;
    return;
  }

  if (state.client) {
    const canReuseClient =
      state.status === "connected" || state.status === "connecting" || state.status === "qr_ready";

    if (canReuseClient) {
      return;
    }

    const staleClient = state.client;
    updateState({
      client: null,
      initPromise: null,
    });

    try {
      await staleClient.destroy();
    } catch {
      // Ignore stale client cleanup errors before re-init.
    }
  }

  const deps = await loadDependencies();
  const client = new deps.ClientCtor({
    authStrategy: new deps.LocalAuthCtor({
      clientId: "pf-control",
      dataPath: resolveAuthDataPath(),
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    },
  });

  client.on("qr", (qrRaw) => {
    if (getState().client !== client) {
      return;
    }

    const qrText = String(qrRaw || "").trim();
    if (!qrText) {
      return;
    }

    updateState({
      status: "qr_ready",
      qr: qrText,
      lastError: null,
    });

    void deps
      .toDataURL(qrText, {
        margin: 1,
        width: 320,
      })
      .then((qrImageDataUrl) => {
        updateState({ qrImageDataUrl });
      })
      .catch(() => {
        updateState({ qrImageDataUrl: null });
      });
  });

  client.on("ready", () => {
    if (getState().client !== client) {
      return;
    }

    clearReconnectTimer();
    const info = client.info;
    updateState({
      status: "connected",
      qr: null,
      qrImageDataUrl: null,
      lastError: null,
      phone: info?.wid?.user || null,
      pushname: info?.pushname || null,
    });
    getState().reconnectAttempts = 0;
  });

  client.on("authenticated", () => {
    if (getState().client !== client) {
      return;
    }

    updateState({
      status: "connecting",
      lastError: null,
    });
  });

  client.on("auth_failure", (message) => {
    if (getState().client !== client) {
      return;
    }

    clearReconnectTimer();
    updateState({
      client: null,
      initPromise: null,
      status: "auth_failure",
      lastError: String(message || "auth_failure"),
      phone: null,
      pushname: null,
    });

    void client.destroy().catch(() => undefined);

    if (getState().shouldKeepAlive) {
      scheduleReconnect("auth_failure");
    }
  });

  client.on("disconnected", (reason) => {
    if (getState().client !== client) {
      return;
    }

    clearReconnectTimer();
    updateState({
      client: null,
      initPromise: null,
      status: "disconnected",
      lastError: String(reason || "disconnected"),
      phone: null,
      pushname: null,
      qr: null,
      qrImageDataUrl: null,
    });

    void client.destroy().catch(() => undefined);

    if (getState().shouldKeepAlive) {
      scheduleReconnect("disconnected");
    }
  });

  updateState({
    client,
    status: "connecting",
    lastError: null,
    qr: null,
    qrImageDataUrl: null,
    shouldKeepAlive: true,
  });

  const initPromise = client
    .initialize()
    .catch((error) => {
      const current = getState();
      if (current.client === client) {
        updateState({
          client: null,
          initPromise: null,
          status: "error",
          lastError: error instanceof Error ? error.message : "init_failed",
          phone: null,
          pushname: null,
        });

        void client.destroy().catch(() => undefined);

        if (current.shouldKeepAlive) {
          scheduleReconnect("init_error");
        }
      }
      throw error;
    })
    .finally(() => {
      const current = getState();
      if (current.initPromise === initPromise) {
        current.initPromise = null;
      }
    });

  state.initPromise = initPromise;
  await initPromise;
}

async function waitForReady(timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = getState();
    if (state.status === "connected") {
      return true;
    }
    if (state.status === "auth_failure" || state.status === "error") {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return getState().status === "connected";
}

export async function getWhatsAppWebSessionSnapshot(options?: { includeQr?: boolean }) {
  return toSnapshot(options?.includeQr !== false);
}

export async function connectWhatsAppWebSession() {
  const state = getState();
  state.shouldKeepAlive = true;
  clearReconnectTimer();

  try {
    await initializeClient();
  } catch {
    // Keep snapshot available even when init fails.
  }
  return toSnapshot(true);
}

export async function disconnectWhatsAppWebSession(options?: { logout?: boolean }) {
  const state = getState();
  const client = state.client;
  const isManualLogout = Boolean(options?.logout);

  clearReconnectTimer();

  updateState({
    client: null,
    initPromise: null,
    status: "disconnected",
    qr: null,
    qrImageDataUrl: null,
    phone: null,
    pushname: null,
    lastError: null,
    shouldKeepAlive: false,
    reconnectAttempts: 0,
  });

  if (!client) {
    return toSnapshot(true);
  }

  try {
    if (options?.logout) {
      await client.logout();
    }
  } catch (error) {
    updateState({
      lastError: error instanceof Error ? error.message : "logout_failed",
    });
  }

  try {
    await client.destroy();
  } catch (error) {
    updateState({
      lastError: error instanceof Error ? error.message : "destroy_failed",
    });
  }

  if (isManualLogout) {
    const current = getState();
    current.qr = null;
    current.qrImageDataUrl = null;
  }

  return toSnapshot(true);
}

export async function sendWhatsAppWebText(
  message: string,
  input: {
    to: string;
    waitReadyMs?: number;
  }
): Promise<SendWhatsAppWebResult> {
  const phone = normalizeWhatsAppPhone(input.to);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      providerMessageId: null,
      error: "invalid_phone",
      sessionStatus: getState().status,
    };
  }

  await connectWhatsAppWebSession();

  const isReady = await waitForReady(Math.max(1000, input.waitReadyMs || DEFAULT_INIT_TIMEOUT_MS));
  const state = getState();

  if (!isReady || !state.client || state.status !== "connected") {
    return {
      ok: false,
      status: 503,
      providerMessageId: null,
      error: `session_${state.status}`,
      sessionStatus: state.status,
    };
  }

  const chatId = `${phone}@c.us`;

  try {
    const result = await state.client.sendMessage(chatId, String(message || ""));
    const providerMessageId =
      typeof result?.id?._serialized === "string"
        ? result.id._serialized
        : null;

    return {
      ok: true,
      status: 200,
      providerMessageId,
      error: null,
      sessionStatus: state.status,
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      providerMessageId: null,
      error: error instanceof Error ? error.message : "send_failed",
      sessionStatus: getState().status,
    };
  }
}
