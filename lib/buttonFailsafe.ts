type CleanupFn = () => void;

const LINK_FAILSAFE_DELAY_MS = 260;

function buildComparableHref(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

function shouldIgnoreAnchorClick(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return true;
  }

  if (anchor.dataset.buttonFailsafeOff === "true") {
    return true;
  }

  if (anchor.closest('[data-button-failsafe-skip="true"]')) {
    return true;
  }

  const target = (anchor.getAttribute("target") || "").trim();
  if (target && target.toLowerCase() !== "_self") {
    return true;
  }

  if (anchor.hasAttribute("download")) {
    return true;
  }

  return false;
}

function resolveInternalTargetHref(anchor: HTMLAnchorElement): string | null {
  const rawHref = String(anchor.getAttribute("href") || "").trim();
  if (!rawHref) {
    return null;
  }

  if (
    rawHref.startsWith("#") ||
    rawHref.startsWith("mailto:") ||
    rawHref.startsWith("tel:") ||
    rawHref.startsWith("javascript:")
  ) {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(rawHref, window.location.origin);
  } catch {
    return null;
  }

  if (resolved.origin !== window.location.origin) {
    return null;
  }

  return buildComparableHref(resolved);
}

export function installButtonFailsafe(): CleanupFn {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => undefined;
  }

  const onDocumentClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    if (shouldIgnoreAnchorClick(event, anchor)) {
      return;
    }

    const targetHref = resolveInternalTargetHref(anchor);
    if (!targetHref) {
      return;
    }

    const currentHref = buildComparableHref(new URL(window.location.href));
    if (currentHref === targetHref) {
      return;
    }

    window.setTimeout(() => {
      const nowHref = buildComparableHref(new URL(window.location.href));
      if (nowHref === currentHref && document.visibilityState === "visible") {
        window.location.assign(targetHref);
      }
    }, LINK_FAILSAFE_DELAY_MS);
  };

  document.addEventListener("click", onDocumentClick, false);

  return () => {
    document.removeEventListener("click", onDocumentClick, false);
  };
}
