"use client";

import NextLink from "next/link";
import type { LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";
import type { UrlObject } from "url";

type ReliabilityMode = "off" | "soft" | "hard";

type ReliableLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | UrlObject;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  reliabilityMode?: ReliabilityMode;
};

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
  prefetch = false,
  ...props
}: ReliableLinkProps) {
  const mode =
    reliabilityMode === "off" || reliabilityMode === "soft" || reliabilityMode === "hard"
      ? reliabilityMode
      : "hard";

  const resolvedClassName = ["pf-reliable-link", className].filter(Boolean).join(" ");
  const resolvedHref = resolveHrefString(href) || "#";

  if (mode === "hard") {
    return (
      <a
        href={resolvedHref}
        data-button-failsafe-mode={mode}
        className={resolvedClassName}
        onClick={onClick}
        {...props}
      />
    );
  }

  return (
    <NextLink
      href={href as LinkProps["href"]}
      prefetch={prefetch}
      replace={replace}
      scroll={scroll}
      data-button-failsafe-mode={mode}
      className={resolvedClassName}
      onClick={onClick}
      {...props}
    />
  );
}
