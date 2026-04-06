type GuardResult = {
  inspected: number;
  neutralized: number;
  neutralizedSelectors: string[];
};

const INTERACTIVE_DESCENDANT_SELECTOR =
  'a[href], button, input, select, textarea, [role="button"], [role="dialog"], [contenteditable="true"]';

const EXEMPT_SELECTOR =
  '[data-interaction-guard-exempt="true"], [aria-busy="true"], dialog, [role="dialog"]';

const SAMPLE_MARGIN = 64;
const MIN_VIEWPORT_COVERAGE = 0.97;
const MIN_BLOCKER_Z_INDEX = 50;

function getNumericZIndex(value: string): number {
  if (!value || value === "auto") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function coversMostViewport(rect: DOMRect, viewportWidth: number, viewportHeight: number): boolean {
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const widthRatio = rect.width / Math.max(1, viewportWidth);
  const heightRatio = rect.height / Math.max(1, viewportHeight);

  const nearLeft = rect.left <= viewportWidth * 0.03;
  const nearTop = rect.top <= viewportHeight * 0.03;

  return (
    widthRatio >= MIN_VIEWPORT_COVERAGE &&
    heightRatio >= MIN_VIEWPORT_COVERAGE &&
    nearLeft &&
    nearTop
  );
}

function buildSelectorHint(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const classList = Array.from(element.classList).filter(Boolean);
  if (classList.length > 0) {
    return `${element.tagName.toLowerCase()}.${classList.slice(0, 2).join(".")}`;
  }

  return element.tagName.toLowerCase();
}

function isLikelyViewportBlocker(element: HTMLElement, viewportWidth: number, viewportHeight: number): boolean {
  if (element === document.body || element === document.documentElement) {
    return false;
  }

  if (element.matches(EXEMPT_SELECTOR) || element.closest(EXEMPT_SELECTOR)) {
    return false;
  }

  const style = window.getComputedStyle(element);

  if (
    style.pointerEvents === "none" ||
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number.parseFloat(style.opacity || "1") <= 0.01
  ) {
    return false;
  }

  if (!(style.position === "fixed" || style.position === "sticky" || style.position === "absolute")) {
    return false;
  }

  if (getNumericZIndex(style.zIndex) < MIN_BLOCKER_Z_INDEX) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (!coversMostViewport(rect, viewportWidth, viewportHeight)) {
    return false;
  }

  if (element.querySelector(INTERACTIVE_DESCENDANT_SELECTOR)) {
    return false;
  }

  return true;
}

function collectCandidatesFromViewportSamples(): HTMLElement[] {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const points: Array<[number, number]> = [
    [viewportWidth / 2, viewportHeight / 2],
    [viewportWidth / 2, Math.min(viewportHeight - 1, SAMPLE_MARGIN)],
    [viewportWidth / 2, Math.max(1, viewportHeight - SAMPLE_MARGIN)],
    [Math.min(viewportWidth - 1, SAMPLE_MARGIN), viewportHeight / 2],
    [Math.max(1, viewportWidth - SAMPLE_MARGIN), viewportHeight / 2],
  ];

  const seen = new Set<HTMLElement>();

  for (const [x, y] of points) {
    const stack = document.elementsFromPoint(x, y);
    for (const node of stack) {
      if (!(node instanceof HTMLElement)) {
        continue;
      }

      let current: HTMLElement | null = node;
      while (current && current !== document.body) {
        if (!seen.has(current)) {
          seen.add(current);
        }
        current = current.parentElement;
      }
    }
  }

  return Array.from(seen);
}

export function neutralizeViewportBlockers(): GuardResult {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      inspected: 0,
      neutralized: 0,
      neutralizedSelectors: [],
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const candidates = collectCandidatesFromViewportSamples();
  const neutralizedSelectors: string[] = [];

  for (const candidate of candidates) {
    if (!isLikelyViewportBlocker(candidate, viewportWidth, viewportHeight)) {
      continue;
    }

    candidate.style.pointerEvents = "none";
    candidate.setAttribute("data-interaction-guard-neutralized", "true");
    neutralizedSelectors.push(buildSelectorHint(candidate));
  }

  return {
    inspected: candidates.length,
    neutralized: neutralizedSelectors.length,
    neutralizedSelectors,
  };
}
