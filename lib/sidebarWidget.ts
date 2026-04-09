export const SIDEBAR_WIDGET_SETTINGS_KEY = "pf-control-sidebar-widget-settings-v1";
export const SIDEBAR_WIDGET_SETTINGS_EVENT = "pf-sidebar-widget-settings-updated";

export const SIDEBAR_WIDGET_MIN_TRANSITION_MS = 2000;
export const SIDEBAR_WIDGET_MAX_TRANSITION_MS = 20000;
export const SIDEBAR_WIDGET_DEFAULT_TRANSITION_MS = 5200;

export type SidebarWidgetOption = {
  id: string;
  href: string;
  label: string;
  icon: string;
  hint: string;
};

export type SidebarWidgetSettings = {
  transitionMs: number;
  selectedCards: string[];
};

export const SIDEBAR_WIDGET_OPTIONS: SidebarWidgetOption[] = [
  {
    id: "pending-saves",
    href: "/configuracion",
    label: "Pendientes de guardado",
    icon: "🟠",
    hint: "Cambios locales que faltan guardar",
  },
  {
    id: "payments-completed",
    href: "/registros",
    label: "Pagos hechos",
    icon: "💸",
    hint: "Pagos confirmados de clientes",
  },
  {
    id: "payments-pending",
    href: "/registros",
    label: "Pagos pendientes",
    icon: "🧾",
    hint: "Monto pendiente por cobrar",
  },
  {
    id: "attendance-rate",
    href: "/asistencias",
    label: "Presentismo",
    icon: "✅",
    hint: "Porcentaje general de asistencias",
  },
  {
    id: "sessions-loaded",
    href: "/sesiones",
    label: "Sesiones cargadas",
    icon: "🏋️",
    hint: "Sesiones de entrenamiento en el sistema",
  },
  {
    id: "active-clients",
    href: "/registros",
    label: "Clientes activos",
    icon: "👥",
    hint: "Clientes en estado activo",
  },
];

type LegacySidebarWidgetSettings = {
  transitionMs?: number;
  selectedHrefs?: string[];
  selectedCards?: string[];
};

const LEGACY_HREF_TO_CARD_ID: Record<string, string> = {
  "/": "active-clients",
  "/semana": "sessions-loaded",
  "/sesiones": "sessions-loaded",
  "/asistencias": "attendance-rate",
  "/registros": "payments-completed",
  "/clientes": "active-clients",
  "/configuracion": "pending-saves",
};

const normalizePath = (value: string): string => {
  const path = value.split("?")[0] || "/";
  if (path !== "/" && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
};

export function clampSidebarWidgetTransitionMs(value: number): number {
  if (!Number.isFinite(value)) {
    return SIDEBAR_WIDGET_DEFAULT_TRANSITION_MS;
  }

  const rounded = Math.round(value);
  if (rounded < SIDEBAR_WIDGET_MIN_TRANSITION_MS) return SIDEBAR_WIDGET_MIN_TRANSITION_MS;
  if (rounded > SIDEBAR_WIDGET_MAX_TRANSITION_MS) return SIDEBAR_WIDGET_MAX_TRANSITION_MS;
  return rounded;
}

export function getDefaultSidebarWidgetSelection(): string[] {
  return SIDEBAR_WIDGET_OPTIONS.map((option) => option.id);
}

export function normalizeSidebarWidgetSettings(raw: unknown): SidebarWidgetSettings {
  const defaultSelected = getDefaultSidebarWidgetSelection();

  if (!raw || typeof raw !== "object") {
    return {
      transitionMs: SIDEBAR_WIDGET_DEFAULT_TRANSITION_MS,
      selectedCards: defaultSelected,
    };
  }

  const input = raw as LegacySidebarWidgetSettings;
  const selectedSet = new Set(defaultSelected);

  const selectedFromCards = Array.isArray(input.selectedCards)
    ? input.selectedCards.map((value) => String(value || "").trim())
    : [];

  const selectedFromLegacyHrefs = Array.isArray(input.selectedHrefs)
    ? input.selectedHrefs
        .map((value) => LEGACY_HREF_TO_CARD_ID[normalizePath(String(value || "").trim())])
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];

  const selectedInput = (selectedFromCards.length > 0 ? selectedFromCards : selectedFromLegacyHrefs)
    .filter((value) => selectedSet.has(value));

  const dedupedSelected = Array.from(new Set(selectedInput));

  return {
    transitionMs: clampSidebarWidgetTransitionMs(Number(input.transitionMs)),
    selectedCards: dedupedSelected.length > 0 ? dedupedSelected : defaultSelected,
  };
}

export function readSidebarWidgetSettingsFromStorage(): SidebarWidgetSettings {
  if (typeof window === "undefined") {
    return normalizeSidebarWidgetSettings(null);
  }

  const raw = localStorage.getItem(SIDEBAR_WIDGET_SETTINGS_KEY);
  if (!raw) {
    return normalizeSidebarWidgetSettings(null);
  }

  try {
    return normalizeSidebarWidgetSettings(JSON.parse(raw));
  } catch {
    return normalizeSidebarWidgetSettings(null);
  }
}

export function writeSidebarWidgetSettingsToStorage(settings: SidebarWidgetSettings): SidebarWidgetSettings {
  const normalized = normalizeSidebarWidgetSettings(settings);

  if (typeof window !== "undefined") {
    localStorage.setItem(SIDEBAR_WIDGET_SETTINGS_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(SIDEBAR_WIDGET_SETTINGS_EVENT));
  }

  return normalized;
}
