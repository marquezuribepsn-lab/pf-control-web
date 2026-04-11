"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";

const PRESENCE_PING_MS = 25000;

type PresenceState = "online" | "offline" | "unknown";

function setPresenceBadgeState(state: PresenceState) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-pf-presence", state);
}

export default function PresenceBeacon() {
  const { data: session } = useSession();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userId = String(session?.user?.id || "").trim();
    if (!userId) {
      setPresenceBadgeState("unknown");
      return;
    }

    let cancelled = false;

    const syncPresence = async (state: "online" | "offline", preferBeacon = false) => {
      const payload = JSON.stringify({ state });

      if (preferBeacon && typeof navigator.sendBeacon === "function") {
        const sent = navigator.sendBeacon(
          "/api/presence",
          new Blob([payload], { type: "application/json" })
        );

        if (sent) {
          if (!cancelled) {
            setPresenceBadgeState(state);
          }
          return;
        }
      }

      try {
        const response = await fetch("/api/presence", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: state === "offline",
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setPresenceBadgeState(state === "online" ? "unknown" : "offline");
          }
          return;
        }

        const data = await response.json().catch(() => ({}));
        const resolvedState = data?.presence?.isOnline === true ? "online" : state;

        if (!cancelled) {
          setPresenceBadgeState(resolvedState);
        }
      } catch {
        if (!cancelled) {
          setPresenceBadgeState(state === "online" ? "unknown" : "offline");
        }
      }
    };

    void syncPresence("online");

    const intervalId = window.setInterval(() => {
      void syncPresence("online");
    }, PRESENCE_PING_MS);

    const onFocus = () => {
      void syncPresence("online");
    };

    const onOnline = () => {
      void syncPresence("online");
    };

    const onOffline = () => {
      void syncPresence("offline");
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncPresence("online");
      } else {
        void syncPresence("offline");
      }
    };

    const onPageHide = () => {
      void syncPresence("offline", true);
    };

    const onBeforeUnload = () => {
      void syncPresence("offline", true);
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void syncPresence("offline", true);
    };
  }, [session?.user?.id]);

  return null;
}
