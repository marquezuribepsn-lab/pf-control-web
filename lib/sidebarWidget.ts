export const SIDEBAR_WIDGET_SETTINGS_KEY = "pf-control-sidebar-widget-settings-v1";
export const SIDEBAR_WIDGET_SETTINGS_EVENT = "pf-sidebar-widget-settings-updated";

export const SIDEBAR_WIDGET_MIN_TRANSITION_MS = 2000;
export const SIDEBAR_WIDGET_MAX_TRANSITION_MS = 20000;
export const SIDEBAR_WIDGET_DEFAULT_TRANSITION_MS = 5200;

export type SidebarWidgetOption = {
  href: string;
  label: string;
  icon: string;
  hint: string;
};

export type SidebarWidgetSettings = {
  transitionMs: number;
  selectedHrefs: string[];
};

export const SIDEBAR_WIDGET_OPTIONS: SidebarWidgetOption[] = [
  { href: "/", label: "Inicio", icon: "🏠", hint: "Vista general diaria" },
  { href: "/semana", label: "Semana", icon: "📅", hint: "Planificacion semanal" },
  { href: "/sesiones", label: "Entrenamiento", icon: "🤸", hint: "Sesiones y cargas" },
  { href: "/asistencias", label: "Asistencias", icon: "✅", hint: "Control de presencia" },
  { href: "/registros", label: "Registros", icon: "📊", hint: "Metricas operativas" },
  { href: "/categorias", label: "Categorias", icon: "🏷️", hint: "Organizacion del contenido" },
  { href: "/categorias/Nutricion", label: "Nutricion", icon: "🥗", hint: "Planificacion nutricional" },
  { href: "/deportes", label: "Deportes", icon: "⚽", hint: "Gestion deportiva" },
  { href: "/equipos", label: "Equipos", icon: "🛡️", hint: "Estructura de equipos" },
  { href: "/clientes", label: "Clientes", icon: "👤", hint: "Ficha y seguimiento" },
  { href: "/clientes/musica", label: "Musica", icon: "🎧", hint: "Playlists y motivacion" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "🛠️", hint: "Permisos y seguridad" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: "💬", hint: "Automatizacion y envios" },
  { href: "/configuracion", label: "Configuracion", icon: "⚙️", hint: "Preferencias de la app" },
];

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
  return SIDEBAR_WIDGET_OPTIONS.map((option) => option.href);
}

export function normalizeSidebarWidgetSettings(raw: unknown): SidebarWidgetSettings {
  const defaultSelected = getDefaultSidebarWidgetSelection();

  if (!raw || typeof raw !== "object") {
    return {
      transitionMs: SIDEBAR_WIDGET_DEFAULT_TRANSITION_MS,
      selectedHrefs: defaultSelected,
    };
  }

  const input = raw as Partial<SidebarWidgetSettings>;
  const selectedSet = new Set(defaultSelected.map((href) => normalizePath(href)));
  const selectedInput = Array.isArray(input.selectedHrefs)
    ? input.selectedHrefs
        .map((value) => normalizePath(String(value || "").trim()))
        .filter((value) => value.length > 0 && selectedSet.has(value))
    : defaultSelected;

  const dedupedSelected = Array.from(new Set(selectedInput));

  return {
    transitionMs: clampSidebarWidgetTransitionMs(Number(input.transitionMs)),
    selectedHrefs: dedupedSelected.length > 0 ? dedupedSelected : defaultSelected,
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
