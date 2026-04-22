"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";

type SharedStateOptions = {
  key: string;
  legacyLocalStorageKey?: string;
  pollMs?: number;
};

const NOTIFICATIONS_ENABLED_KEY = "pf-control-notifications-enabled-v1";
const LOCAL_SYNC_CACHE_PREFIX = "pf-control-sync-cache-v1:";
const MANUAL_SAVE_INTENT_TTL_MS = 2500;
const STRICT_MANUAL_INTENT_KEYS = new Set([
  "pf-control-clientes-meta-v1",
  "pf-control-pagos-v1",
  "pf-control-sesiones",
  "pf-control-semana-plan",
  "pf-control-alumno-week-notifications",
  "pf-control-asistencias-jornadas-v1",
  "pf-control-asistencias-registros-v1",
  "pf-control-alumnos",
  "pf-control-jugadoras",
  "pf-control-categorias",
  "pf-control-deportes",
  "pf-control-ejercicios",
  "pf-control-equipos",
  "pf-control-wellness",
]);
const STRICT_MANUAL_INTENT_PREFIXES = ["pf-control-clientes-table-ui-v1-"];

type ToastType = "success" | "error" | "warning";

const OFFLINE_WRITE_TOAST_TTL_MS = 2200;
const MOBILE_INTERACTION_HOLD_MS = 480;
const BOOTSTRAP_RETRY_DELAYS_MS = [1200, 2600, 4800];

let mobileInteractionListenersInstalled = false;
let mobileInteractionLastAt = 0;

function markMobileInteraction() {
  mobileInteractionLastAt = Date.now();
}

function isMobileInteractionActive() {
  if (typeof window === "undefined") {
    return false;
  }

  if (!window.matchMedia("(max-width: 1024px)").matches) {
    return false;
  }

  return Date.now() - mobileInteractionLastAt < MOBILE_INTERACTION_HOLD_MS;
}

function ensureMobileInteractionTracking() {
  if (typeof window === "undefined" || mobileInteractionListenersInstalled) {
    return;
  }

  const listenerOptions: AddEventListenerOptions = { passive: true };

  window.addEventListener("touchstart", markMobileInteraction, listenerOptions);
  window.addEventListener("touchmove", markMobileInteraction, listenerOptions);
  window.addEventListener("scroll", markMobileInteraction, listenerOptions);
  window.addEventListener("wheel", markMobileInteraction, listenerOptions);
  window.addEventListener("pointerdown", markMobileInteraction, listenerOptions);

  mobileInteractionListenersInstalled = true;
}

const ANY_SAVE_KEY = "__any__";
type ManualIntent = {
  count: number;
  expiresAt: number;
};

const manualSaveIntentByKey = new Map<string, ManualIntent>();
const pendingSaveKeys = new Set<string>();

function isStrictManualKey(key: string) {
  return (
    STRICT_MANUAL_INTENT_KEYS.has(key) ||
    STRICT_MANUAL_INTENT_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

function emitPendingSaveStatus() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("pf-pending-save-status", {
      detail: {
        keys: Array.from(pendingSaveKeys),
        hasPending: pendingSaveKeys.size > 0,
      },
    })
  );
}

function setPendingForKey(key: string, isPending: boolean) {
  const hadKey = pendingSaveKeys.has(key);

  if (isPending) {
    pendingSaveKeys.add(key);
  } else {
    pendingSaveKeys.delete(key);
  }

  const hasKey = pendingSaveKeys.has(key);
  if (hadKey !== hasKey) {
    emitPendingSaveStatus();
  }
}

export function getPendingSaveStatus() {
  return {
    keys: Array.from(pendingSaveKeys),
    hasPending: pendingSaveKeys.size > 0,
  };
}

function getIntentCount(key: string) {
  const intent = manualSaveIntentByKey.get(key);
  if (!intent) return 0;
  if (Date.now() > intent.expiresAt) {
    manualSaveIntentByKey.delete(key);
    return 0;
  }
  return intent.count;
}

export function markManualSaveIntent(key?: string, count = 1) {
  const normalizedKey = key && key.trim() ? key.trim() : ANY_SAVE_KEY;
  const safeCount = Math.max(1, Math.floor(count));

  // No acumulamos intents para evitar autosave tardio al escribir.
  manualSaveIntentByKey.set(normalizedKey, {
    count: safeCount,
    expiresAt: Date.now() + MANUAL_SAVE_INTENT_TTL_MS,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("pf-manual-save-intent", {
        detail: { key: normalizedKey },
      })
    );
  }
}

function hasManualSaveIntent(key: string) {
  if (isStrictManualKey(key)) {
    return getIntentCount(key) > 0;
  }

  return getIntentCount(key) > 0 || getIntentCount(ANY_SAVE_KEY) > 0;
}

function consumeManualSaveIntent(key: string) {
  const keyCount = getIntentCount(key);
  if (keyCount > 0) {
    manualSaveIntentByKey.delete(key);
    return true;
  }

  if (isStrictManualKey(key)) {
    return false;
  }

  const anyCount = getIntentCount(ANY_SAVE_KEY);
  if (anyCount > 0) {
    manualSaveIntentByKey.delete(ANY_SAVE_KEY);
    return true;
  }

  return false;
}

export function emitInlineToast(type: ToastType, message: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("pf-inline-toast", {
      detail: { type, message },
    })
  );
}

function maybeSendNotification(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const enabled = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === "1";
    if (!enabled) {
      return;
    }

    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    new Notification("PF Control", {
      body: `Se guardo un cambio en ${key}`,
      tag: `pf-change-${key}`,
    });
  } catch {
    // ignore notification errors
  }
}

async function getRemoteValue<T>(key: string): Promise<T | null> {
  const res = await fetch(`/api/sync/${encodeURIComponent(key)}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as { value: T | null };
  return data.value;
}

async function putRemoteValue<T>(key: string, value: T) {
  const res = await fetch(`/api/sync/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });

  if (!res.ok) {
    throw new Error("sync write failed");
  }
}

export function useSharedState<T>(
  initialValue: T,
  options: SharedStateOptions
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const { key, legacyLocalStorageKey, pollMs = 12000 } = options;
  const [state, setState] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);
  const initialValueRef = useRef<T>(initialValue);
  const lastSyncedRef = useRef<string>(JSON.stringify(initialValue));
  const pendingSerializedRef = useRef<string | null>(null);
  const writeInFlightRef = useRef(false);
  const lastOfflineWriteToastAtRef = useRef(0);

  useEffect(() => {
    ensureMobileInteractionTracking();
  }, []);

  const pollIntervalMs = useMemo(() => {
    const normalizedPollMs = Number.isFinite(pollMs) ? Math.max(8000, Math.floor(pollMs)) : 12000;
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) {
      hash = (hash * 31 + key.charCodeAt(index)) | 0;
    }
    const staggerMs = Math.abs(hash) % 1200;
    return normalizedPollMs + staggerMs;
  }, [key, pollMs]);

  const readLocalSnapshot = (): T | null => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = localStorage.getItem(`${LOCAL_SYNC_CACHE_PREFIX}${key}`);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  const writeLocalSnapshot = (value: T) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.setItem(`${LOCAL_SYNC_CACHE_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // ignorar errores de cuota/localStorage no disponible
    }
  };

  const tryFlushPending = () => {
    if (!loaded || writeInFlightRef.current || !hasManualSaveIntent(key)) {
      return;
    }

    const snapshotSerialized = pendingSerializedRef.current;
    if (!snapshotSerialized) {
      return;
    }

    const snapshotState = JSON.parse(snapshotSerialized) as T;

    void (async () => {
      try {
        writeInFlightRef.current = true;
        await putRemoteValue(key, snapshotState);
        lastSyncedRef.current = snapshotSerialized;
        writeLocalSnapshot(snapshotState);

        if (pendingSerializedRef.current === snapshotSerialized) {
          pendingSerializedRef.current = null;
          setPendingForKey(key, false);
        }

        if (consumeManualSaveIntent(key)) {
          maybeSendNotification(key);
          emitInlineToast("success", "Cambios guardados correctamente");
        }
      } catch {
        setPendingForKey(key, true);
        if (consumeManualSaveIntent(key)) {
          emitInlineToast("error", "No se pudieron guardar los cambios");
        }
      } finally {
        writeInFlightRef.current = false;

        if (pendingSerializedRef.current && hasManualSaveIntent(key)) {
          tryFlushPending();
        }
      }
    })();
  };

  useEffect(() => {
    let active = true;
    const bootstrapRetryTimers: number[] = [];

    const applyRemoteSnapshot = (remoteValue: T) => {
      setState(remoteValue);
      lastSyncedRef.current = JSON.stringify(remoteValue);
      writeLocalSnapshot(remoteValue);
      setPendingForKey(key, false);
    };

    const scheduleBootstrapRetry = (attempt = 0) => {
      if (!active || typeof window === "undefined") {
        return;
      }

      const delay = BOOTSTRAP_RETRY_DELAYS_MS[attempt];
      if (!Number.isFinite(delay)) {
        return;
      }

      const timer = window.setTimeout(() => {
        void (async () => {
          try {
            const remoteValue = await getRemoteValue<T>(key);
            if (!active || remoteValue === null) {
              scheduleBootstrapRetry(attempt + 1);
              return;
            }

            applyRemoteSnapshot(remoteValue);
          } catch {
            scheduleBootstrapRetry(attempt + 1);
          }
        })();
      }, delay);

      bootstrapRetryTimers.push(timer);
    };

    const load = async () => {
      const localSnapshot = readLocalSnapshot();

      if (localSnapshot !== null) {
        setState(localSnapshot);
        lastSyncedRef.current = JSON.stringify(localSnapshot);
      }

      try {
        const remoteValue = await getRemoteValue<T>(key);
        if (!active) return;

        if (remoteValue !== null) {
          applyRemoteSnapshot(remoteValue);
          setLoaded(true);
          return;
        }

        if (legacyLocalStorageKey) {
          const legacy = localStorage.getItem(legacyLocalStorageKey);
          if (legacy) {
            try {
              const parsed = JSON.parse(legacy) as T;
              setState(parsed);
              lastSyncedRef.current = JSON.stringify(parsed);
              await putRemoteValue(key, parsed);
              writeLocalSnapshot(parsed);
              localStorage.removeItem(legacyLocalStorageKey);
              setPendingForKey(key, false);
              setLoaded(true);
              return;
            } catch {
              // ignore invalid legacy payload
            }
          }
        }

        await putRemoteValue(key, initialValueRef.current);
        writeLocalSnapshot(initialValueRef.current);
        setPendingForKey(key, false);
      } catch {
        if (localSnapshot !== null) {
          setPendingForKey(key, false);
        } else {
          scheduleBootstrapRetry(0);
        }
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    };

    void load();

    return () => {
      active = false;
      bootstrapRetryTimers.forEach((timer) => window.clearTimeout(timer));
      setPendingForKey(key, false);
    };
  }, [key, legacyLocalStorageKey]);

  useEffect(() => {
    if (!loaded) return;

    const serialized = JSON.stringify(state);
    if (serialized === lastSyncedRef.current) {
      setPendingForKey(key, false);
      return;
    }

    const strictManual = isStrictManualKey(key);
    const hasIntent = hasManualSaveIntent(key);

    // For strict manual keys, ignore automatic/UI-only mutations unless
    // there is an explicit save intent for that key.
    if (strictManual && !hasIntent) {
      if (!pendingSerializedRef.current) {
        setPendingForKey(key, false);
      }
      return;
    }

    pendingSerializedRef.current = serialized;
    setPendingForKey(key, true);

    tryFlushPending();
  }, [key, loaded, state]);

  useEffect(() => {
    if (!loaded) return;

    const onManualIntent = (event: Event) => {
      const custom = event as CustomEvent<{ key?: string }>;
      const intentKey = custom.detail?.key || ANY_SAVE_KEY;
      if (intentKey !== ANY_SAVE_KEY && intentKey !== key) {
        return;
      }
      tryFlushPending();
    };

    window.addEventListener("pf-manual-save-intent", onManualIntent);
    return () => {
      window.removeEventListener("pf-manual-save-intent", onManualIntent);
    };
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;

    const interval = setInterval(async () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          return;
        }

        if (typeof window !== "undefined" && !window.navigator.onLine) {
          return;
        }

        if (isMobileInteractionActive()) {
          return;
        }

        if (pendingSerializedRef.current || writeInFlightRef.current) {
          return;
        }

        const remoteValue = await getRemoteValue<T>(key);
        if (remoteValue === null) return;

        const remoteSerialized = JSON.stringify(remoteValue);
        if (remoteSerialized === lastSyncedRef.current) return;

        if (isMobileInteractionActive()) {
          return;
        }

        lastSyncedRef.current = remoteSerialized;
        writeLocalSnapshot(remoteValue);
        setState(remoteValue);
      } catch {
        // ignore polling errors
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [key, loaded, pollIntervalMs]);

  const guardedSetState: Dispatch<SetStateAction<T>> = (nextState) => {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      const now = Date.now();
      if (now - lastOfflineWriteToastAtRef.current > OFFLINE_WRITE_TOAST_TTL_MS) {
        lastOfflineWriteToastAtRef.current = now;
        emitInlineToast(
          "warning",
          "Sin conexion: los cambios se guardan localmente y se sincronizan cuando vuelva internet"
        );
      }
    }

    setState(nextState);
  };

  return [state, guardedSetState, loaded];
}
