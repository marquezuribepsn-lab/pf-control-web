"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

type ReliabilityMode = "off" | "soft" | "hard";

type ReliableLinkProps = ComponentProps<typeof NextLink> & {
  reliabilityMode?: ReliabilityMode;
};

export default function ReliableLink({
  reliabilityMode = "hard",
  ...props
}: ReliableLinkProps) {
  const mode =
    reliabilityMode === "off" || reliabilityMode === "soft" || reliabilityMode === "hard"
      ? reliabilityMode
      : "hard";

  return <NextLink data-button-failsafe-mode={mode} {...props} />;
}
