"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

type SharedStateOptions = {
  key: string;
  legacyLocalStorageKey?: string;
  pollMs?: number;
};

const NOTIFICATIONS_ENABLED_KEY = "pf-control-notifications-enabled-v1";

type ToastType = "success" | "error";

function emitInlineToast(type: ToastType, message: string) {
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
  const { key, legacyLocalStorageKey, pollMs = 4000 } = options;
  const [state, setState] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);
  const lastSyncedRef = useRef<string>(JSON.stringify(initialValue));

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const remoteValue = await getRemoteValue<T>(key);
        if (!active) return;

        if (remoteValue !== null) {
          setState(remoteValue);
          lastSyncedRef.current = JSON.stringify(remoteValue);
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
              localStorage.removeItem(legacyLocalStorageKey);
              setLoaded(true);
              return;
            } catch {
              // ignore invalid legacy payload
            }
          }
        }

        await putRemoteValue(key, initialValue);
      } catch {
        // ignore transient network errors
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [initialValue, key, legacyLocalStorageKey]);

  useEffect(() => {
    if (!loaded) return;

    const serialized = JSON.stringify(state);
    if (serialized === lastSyncedRef.current) return;

    void (async () => {
      try {
        await putRemoteValue(key, state);
        lastSyncedRef.current = serialized;
        maybeSendNotification(key);
        emitInlineToast("success", `Cambios guardados correctamente (${key})`);
      } catch {
        emitInlineToast("error", `No se pudieron guardar los cambios (${key})`);
      }
    })();
  }, [key, loaded, state]);

  useEffect(() => {
    if (!loaded) return;

    const interval = setInterval(async () => {
      try {
        const remoteValue = await getRemoteValue<T>(key);
        if (remoteValue === null) return;

        const remoteSerialized = JSON.stringify(remoteValue);
        if (remoteSerialized === lastSyncedRef.current) return;

        lastSyncedRef.current = remoteSerialized;
        setState(remoteValue);
      } catch {
        // ignore polling errors
      }
    }, pollMs);

    return () => clearInterval(interval);
  }, [key, loaded, pollMs]);

  return [state, setState, loaded];
}
