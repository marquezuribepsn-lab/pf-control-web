"use client";

import NextLink from "next/link";
import type { LinkProps } from "next/link";
import { useEffect, useRef, type AnchorHTMLAttributes } from "react";
import type { UrlObject } from "url";

type ReliabilityMode = "off" | "soft" | "hard";

type ReliableLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | UrlObject;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  reliabilityMode?: ReliabilityMode;
};

const HARD_MODE_FALLBACK_DELAY_MS = 520;

function resolveHrefString(href: ReliableLinkProps["href"]): string | null {
  if (typeof href === "string") {
    return href;
  }

  if (!href || typeof href !== "object") {
    return null;
  }

  const pathname = typeof href.pathname === "string" && href.pathname ? href.pathname : "/";
  const hash = typeof href.hash === "string" ? href.hash : "";

  const query = href.query;
  const params = new URLSearchParams();
  if (query && typeof query === "object") {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) {
            params.append(key, String(item));
          }
        }
      } else if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
  }

  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ""}${hash}`;
}

export default function ReliableLink({
  reliabilityMode = "hard",
  className,
  onClick,
  href,
  replace,
  scroll,
  prefetch,
  ...props
}: ReliableLinkProps) {
  const mode =
    reliabilityMode === "off" || reliabilityMode === "soft" || reliabilityMode === "hard"
      ? reliabilityMode
      : "hard";

  const hardFallbackTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (hardFallbackTimerRef.current !== null) {
        window.clearTimeout(hardFallbackTimerRef.current);
        hardFallbackTimerRef.current = null;
      }
    },
    []
  );

  const resolvedClassName = ["pf-reliable-link", className].filter(Boolean).join(" ");
  const resolvedHref = resolveHrefString(href) || "#";

  const handleClick: AnchorHTMLAttributes<HTMLAnchorElement>["onClick"] = (event) => {
    if (onClick) {
      onClick(event);
    }

    if (mode !== "hard") {
      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.currentTarget;
    if (target instanceof HTMLAnchorElement) {
      const targetAttr = (target.getAttribute("target") || "").trim().toLowerCase();
      if ((targetAttr && targetAttr !== "_self") || target.hasAttribute("download")) {
        return;
      }
    }

    if (
      resolvedHref.startsWith("#") ||
      resolvedHref.startsWith("mailto:") ||
      resolvedHref.startsWith("tel:") ||
      resolvedHref.startsWith("javascript:")
    ) {
      return;
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(resolvedHref, window.location.origin);
    } catch {
      return;
    }

    if (targetUrl.origin !== window.location.origin) {
      return;
    }

    const fromComparable = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const targetComparable = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;

    if (targetComparable === fromComparable) {
      return;
    }

    if (hardFallbackTimerRef.current !== null) {
      window.clearTimeout(hardFallbackTimerRef.current);
      hardFallbackTimerRef.current = null;
    }

    hardFallbackTimerRef.current = window.setTimeout(() => {
      hardFallbackTimerRef.current = null;
      const currentComparable = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentComparable !== fromComparable || document.visibilityState !== "visible") {
        return;
      }

      // Last-resort recovery for dead clicks when App Router transition does not start.
      window.location.assign(targetComparable);
    }, HARD_MODE_FALLBACK_DELAY_MS);
  };

  return (
    <NextLink
      href={href as LinkProps["href"]}
      prefetch={prefetch}
      replace={replace}
      scroll={scroll}
      data-button-failsafe-mode={mode}
      className={resolvedClassName}
      onClick={handleClick}
      {...props}
    />
  );
}
