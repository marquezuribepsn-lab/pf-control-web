"use client";

import { useEffect, useRef, useState } from "react";

export function useMinimumLoading(active: boolean, minDurationMs = 2000): boolean {
  const [visible, setVisible] = useState(active);
  const startedAtRef = useRef<number | null>(active ? Date.now() : null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (active) {
      startedAtRef.current = Date.now();

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      setVisible(true);
      return;
    }

    if (!visible) {
      startedAtRef.current = null;
      return;
    }

    const startedAt = startedAtRef.current;
    const elapsed = startedAt == null ? minDurationMs : Date.now() - startedAt;
    const remainingMs = Math.max(0, minDurationMs - elapsed);

    if (remainingMs === 0) {
      setVisible(false);
      startedAtRef.current = null;
      return;
    }

    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      startedAtRef.current = null;
      setVisible(false);
    }, remainingMs);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [active, minDurationMs, visible]);

  return visible;
}
