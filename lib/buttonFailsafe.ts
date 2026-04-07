type CleanupFn = () => void;

const LINK_FAILSAFE_DELAY_MS = 260;
const LINK_FAILSAFE_HARD_DELAY_MS = 200;

type ReliabilityMode = "off" | "soft" | "hard";

type NavigationCandidate = {
  element: HTMLElement;
  targetHref: string;
  mode: ReliabilityMode;
};

export const FAILSAFE_NAVIGATE_EVENT = "pf-failsafe-navigate";

type FailsafeNavigateDetail = {
  href: string;
  replace?: boolean;
};

function buildComparableHref(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function resolveReliabilityMode(element: HTMLElement): ReliabilityMode {
  const explicitMode = (element.getAttribute("data-button-failsafe-mode") || "").trim().toLowerCase();
  const scopedMode =
    (element.closest("[data-button-failsafe-mode]")?.getAttribute("data-button-failsafe-mode") || "")
      .trim()
      .toLowerCase();
  const mode = explicitMode || scopedMode;

  if (element.dataset.buttonFailsafeOff === "true") {
    return "off";
  }

  if (element.closest('[data-button-failsafe-skip="true"]')) {
    return "off";
  }

  if (mode === "off" || mode === "soft" || mode === "hard") {
    return mode;
  }

  return "soft";
}

function shouldIgnoreAnchorClick(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (isModifiedClick(event)) {
    return true;
  }

  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
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

function resolveInternalTargetHrefFromRaw(rawHref: string): string | null {
  const href = String(rawHref || "").trim();
  if (!href) {
    return null;
  }

  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(href, window.location.origin);
  } catch {
    return null;
  }

  if (resolved.origin !== window.location.origin) {
    return null;
  }

  return buildComparableHref(resolved);
}

function resolveNavigationCandidate(eventTarget: Element, event: MouseEvent): NavigationCandidate | null {
  const anchor = eventTarget.closest("a[href]");
  if (anchor instanceof HTMLAnchorElement) {
    if (shouldIgnoreAnchorClick(event, anchor)) {
      return null;
    }

    const targetHref = resolveInternalTargetHref(anchor);
    if (!targetHref) {
      return null;
    }

    return {
      element: anchor,
      targetHref,
      mode: resolveReliabilityMode(anchor),
    };
  }

  const navElement = eventTarget.closest("[data-nav-href]");
  if (!(navElement instanceof HTMLElement)) {
    return null;
  }

  if (isModifiedClick(event)) {
    return null;
  }

  if (
    navElement instanceof HTMLButtonElement &&
    (navElement.disabled || navElement.getAttribute("aria-disabled") === "true")
  ) {
    return null;
  }

  const rawHref = navElement.getAttribute("data-nav-href") || "";
  const targetHref = resolveInternalTargetHrefFromRaw(rawHref);
  if (!targetHref) {
    return null;
  }

  return {
    element: navElement,
    targetHref,
    mode: resolveReliabilityMode(navElement),
  };
}

function requestRouterNavigation(targetHref: string, replace = false): boolean {
  try {
    const resolved = new URL(targetHref, window.location.origin);
    const nextHref = buildComparableHref(resolved);
    if (!nextHref) {
      return true;
    }

    const detail: FailsafeNavigateDetail = { href: nextHref, replace };
    window.dispatchEvent(new CustomEvent<FailsafeNavigateDetail>(FAILSAFE_NAVIGATE_EVENT, { detail }));
    return true;
  } catch {
    return false;
  }
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

    const candidate = resolveNavigationCandidate(target, event);
    if (!candidate || candidate.mode !== "hard") {
      return;
    }

    // Next Link handles anchor navigation; keep failsafe click fallback only for data-nav-href elements.
    if (candidate.element instanceof HTMLAnchorElement) {
      return;
    }

    const currentHref = buildComparableHref(new URL(window.location.href));
    if (currentHref === candidate.targetHref) {
      return;
    }

    window.setTimeout(() => {
      const nowHref = buildComparableHref(new URL(window.location.href));
      if (nowHref !== currentHref || document.visibilityState !== "visible") {
        return;
      }

      window.setTimeout(() => {
        const finalHref = buildComparableHref(new URL(window.location.href));
        if (finalHref === currentHref && document.visibilityState === "visible") {
          requestRouterNavigation(candidate.targetHref);
        }
      }, LINK_FAILSAFE_HARD_DELAY_MS);
    }, LINK_FAILSAFE_DELAY_MS);
  };

  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const navElement = target.closest("[data-nav-href]");
    if (!(navElement instanceof HTMLElement)) {
      return;
    }

    if (
      navElement instanceof HTMLButtonElement &&
      (navElement.disabled || navElement.getAttribute("aria-disabled") === "true")
    ) {
      return;
    }

    const rawHref = navElement.getAttribute("data-nav-href") || "";
    const targetHref = resolveInternalTargetHrefFromRaw(rawHref);
    if (!targetHref) {
      return;
    }

    const mode = resolveReliabilityMode(navElement);
    if (mode !== "hard") {
      return;
    }

    event.preventDefault();

    const currentHref = buildComparableHref(new URL(window.location.href));
    if (currentHref === targetHref) {
      return;
    }

    requestRouterNavigation(targetHref);
  };

  document.addEventListener("click", onDocumentClick, false);
  document.addEventListener("keydown", onDocumentKeyDown, true);

  return () => {
    document.removeEventListener("click", onDocumentClick, false);
    document.removeEventListener("keydown", onDocumentKeyDown, true);
  };
}
