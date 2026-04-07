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
