"use client";

import { useMemo, useState, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { emitInlineToast } from "./useSharedState";

type ReliabilityMode = "off" | "soft" | "hard";

type ReliableActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  reliabilityMode?: ReliabilityMode;
  lockWhileRunning?: boolean;
  failureMessage?: string;
};

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as Promise<unknown>).then === "function";
}

export default function ReliableActionButton({
  reliabilityMode = "hard",
  lockWhileRunning = true,
  failureMessage,
  onClick,
  disabled,
  className,
  ...props
}: ReliableActionButtonProps) {
  const [running, setRunning] = useState(false);

  const mode = useMemo<ReliabilityMode>(() => {
    if (reliabilityMode === "off" || reliabilityMode === "soft" || reliabilityMode === "hard") {
      return reliabilityMode;
    }
    return "hard";
  }, [reliabilityMode]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (lockWhileRunning && running) {
      event.preventDefault();
      return;
    }

    if (!onClick) {
      return;
    }

    try {
      const result = onClick(event);
      if (!isPromiseLike(result)) {
        return;
      }

      if (lockWhileRunning) {
        setRunning(true);
      }

      void result
        .catch((error) => {
          console.error("[reliable-action-button] error", error);
          emitInlineToast("error", failureMessage || "No se pudo completar la accion");
        })
        .finally(() => {
          if (lockWhileRunning) {
            setRunning(false);
          }
        });
    } catch (error) {
      console.error("[reliable-action-button] error", error);
      emitInlineToast("error", failureMessage || "No se pudo completar la accion");
      if (lockWhileRunning) {
        setRunning(false);
      }
    }
  };

  return (
    <button
      {...props}
      className={["pf-action-btn", className].filter(Boolean).join(" ")}
      onClick={handleClick}
      disabled={Boolean(disabled) || (lockWhileRunning && running)}
      aria-busy={lockWhileRunning && running ? true : undefined}
      data-button-failsafe-mode={mode}
      data-running={running ? "true" : "false"}
    />
  );
}
