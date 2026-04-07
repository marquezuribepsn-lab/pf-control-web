"use client";

import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { startTransition } from "react";
import type { UrlObject } from "url";

type ReliabilityMode = "off" | "soft" | "hard";

type ReliableLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | UrlObject;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  reliabilityMode?: ReliabilityMode;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

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
  prefetch: _prefetch,
  ...props
}: ReliableLinkProps) {
  const router = useRouter();

  const mode =
    reliabilityMode === "off" || reliabilityMode === "soft" || reliabilityMode === "hard"
      ? reliabilityMode
      : "hard";

  const resolvedClassName = ["pf-reliable-link", className].filter(Boolean).join(" ");

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (typeof onClick === "function") {
      onClick(event);
    }

    if (event.defaultPrevented || isModifiedClick(event)) {
      return;
    }

    const target = (event.currentTarget.getAttribute("target") || "").trim().toLowerCase();
    if (target && target !== "_self") {
      return;
    }

    if (event.currentTarget.hasAttribute("download")) {
      return;
    }

    const hrefString = resolveHrefString(href);
    if (!hrefString) {
      return;
    }

    if (
      hrefString.startsWith("#") ||
      hrefString.startsWith("mailto:") ||
      hrefString.startsWith("tel:") ||
      hrefString.startsWith("javascript:")
    ) {
      return;
    }

    let nextUrl: URL;
    try {
      nextUrl = new URL(hrefString, window.location.origin);
    } catch {
      return;
    }

    if (nextUrl.origin !== window.location.origin) {
      return;
    }

    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

    if (currentPath === nextPath) {
      return;
    }

    event.preventDefault();
    if (replace) {
      startTransition(() => {
        router.replace(nextPath, { scroll });
      });
      return;
    }

    startTransition(() => {
      router.push(nextPath, { scroll });
    });
  };

  const resolvedHref = resolveHrefString(href) || "#";

  return (
    <a
      href={resolvedHref}
      data-button-failsafe-mode={mode}
      className={resolvedClassName}
      onClick={handleClick}
      {...props}
    />
  );
}
