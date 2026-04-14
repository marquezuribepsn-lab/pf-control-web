export type WhatsAppMode = "test" | "prod";
export type WhatsAppProvider = "meta_cloud" | "whatsapp_web";

export type WhatsAppTriggerType =
  | "days_before"
  | "due_today"
  | "overdue"
  | "on_renewal"
  | "on_data_update"
  | "week_end";

export type WhatsAppSubcategoryConfig = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  triggerType: WhatsAppTriggerType;
  daysOffset: number;
  sendFrom: string;
  sendTo: string;
  message: string;
  variables: string[];
};

export type WhatsAppCategoryConfig = {
  key: string;
  label: string;
  enabled: boolean;
  subcategories: Record<string, WhatsAppSubcategoryConfig>;
};

export type WhatsAppAutomationRunnerConfig = {
  enabled: boolean;
  intervalMinutes: number;
  maxRetries: number;
  retryBackoffSeconds: number;
  alertEmailOnFailure: boolean;
  alertWhatsAppOnFailure: boolean;
};

export type WhatsAppConfig = {
  version: number;
  connection: {
    enabled: boolean;
    mode: WhatsAppMode;
    provider: WhatsAppProvider;
  };
  automationRunner: WhatsAppAutomationRunnerConfig;
  categories: Record<string, WhatsAppCategoryConfig>;
  updatedAt: string;
};

export const WHATSAPP_CATEGORY_ORDER = [
  "cobranzas",
  "asistencia_rutinas",
  "recordatorios_otros",
] as const;

function buildDefaultConfig(): WhatsAppConfig {
  return {
    version: 3,
    connection: {
      enabled: true,
      mode: "test",
      provider: "meta_cloud",
    },
    automationRunner: {
      enabled: true,
      intervalMinutes: 5,
      maxRetries: 1,
      retryBackoffSeconds: 20,
      alertEmailOnFailure: true,
      alertWhatsAppOnFailure: true,
    },
    categories: {
      cobranzas: {
        key: "cobranzas",
        label: "Cobranzas",
        enabled: true,
        subcategories: {
          aviso_anticipado: {
            key: "aviso_anticipado",
            label: "Aviso anticipado",
            description: "Mensaje X dias antes del vencimiento.",
            enabled: true,
            triggerType: "days_before",
            daysOffset: 1,
            sendFrom: "09:00",
            sendTo: "20:00",
            message:
              "*Aviso de vencimiento*\n\nHola {{nombre}},\ntu cuota de la actividad *{{actividad}}* vence dentro de *{{dias}}* dias.",
            variables: ["nombre", "actividad", "dias", "vencimiento", "total"],
          },
          dia_vencimiento: {
            key: "dia_vencimiento",
            label: "Dia del vencimiento",
            description: "Mensaje el mismo dia del vencimiento.",
            enabled: true,
            triggerType: "due_today",
            daysOffset: 0,
            sendFrom: "09:00",
            sendTo: "20:00",
            message:
              "*Vencimiento hoy*\n\nHola {{nombre}},\ntu cuota de la actividad *{{actividad}}* vence *hoy*.",
            variables: ["nombre", "actividad", "vencimiento", "total"],
          },
          ya_vencio: {
            key: "ya_vencio",
            label: "Ya vencio",
            description: "Mensaje cuando el vencimiento ya paso.",
            enabled: true,
            triggerType: "overdue",
            daysOffset: 0,
            sendFrom: "10:00",
            sendTo: "20:00",
            message:
              "*Cuota vencida*\n\nHola {{nombre}},\nregistramos que tu cuota de *{{actividad}}* ya vencio.\nSi ya abonaste, ignora este mensaje.",
            variables: ["nombre", "actividad", "vencimiento", "total"],
          },
          renovacion_plan: {
            key: "renovacion_plan",
            label: "Renovacion del plan",
            description: "Mensaje cuando se detecta una renovacion.",
            enabled: true,
            triggerType: "on_renewal",
            daysOffset: 0,
            sendFrom: "09:00",
            sendTo: "21:00",
            message:
              "*Renovacion confirmada*\n\nHola {{nombre}},\nse acredito tu renovacion de *{{actividad}}*.\nNuevo vencimiento: *{{vencimiento}}*.",
            variables: ["nombre", "actividad", "vencimiento", "total"],
          },
        },
      },
      asistencia_rutinas: {
        key: "asistencia_rutinas",
        label: "Asistencia y Rutinas",
        enabled: true,
        subcategories: {
          actualizacion_datos_importantes: {
            key: "actualizacion_datos_importantes",
            label: "Actualizacion de datos",
            description: "Mensaje cuando se actualizan datos importantes.",
            enabled: false,
            triggerType: "on_data_update",
            daysOffset: 0,
            sendFrom: "09:00",
            sendTo: "20:00",
            message:
              "Hola {{nombre}},\nactualizamos informacion importante de tu plan de {{actividad}}.",
            variables: ["nombre", "actividad", "fecha"],
          },
          encuesta_fin_semana: {
            key: "encuesta_fin_semana",
            label: "Encuesta fin de semana",
            description: "Envio automatico para cierre de semana.",
            enabled: true,
            triggerType: "week_end",
            daysOffset: 0,
            sendFrom: "17:00",
            sendTo: "21:00",
            message:
              "Hola {{nombre}},\nqueremos saber como te sentiste esta semana con {{actividad}}.\nResponde esta encuesta breve.",
            variables: ["nombre", "actividad"],
          },
        },
      },
      recordatorios_otros: {
        key: "recordatorios_otros",
        label: "Recordatorios y Otros",
        enabled: true,
        subcategories: {},
      },
    },
    updatedAt: new Date(0).toISOString(),
  };
}

function normalizeTime(value: unknown, fallback: string) {
  const raw = String(value || "").trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw) ? raw : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const next = value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 50);

  return next.length > 0 ? next : fallback;
}

export function getDefaultWhatsAppConfig(): WhatsAppConfig {
  return buildDefaultConfig();
}

export function normalizeWhatsAppConfig(raw: unknown): WhatsAppConfig {
  const defaults = buildDefaultConfig();
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const connectionRaw =
    input.connection && typeof input.connection === "object"
      ? (input.connection as Record<string, unknown>)
      : {};

  const modeRaw = String(connectionRaw.mode || defaults.connection.mode).toLowerCase();
  const mode: WhatsAppMode = modeRaw === "prod" ? "prod" : "test";

  const providerRaw = String(connectionRaw.provider || defaults.connection.provider)
    .trim()
    .toLowerCase();
  const provider: WhatsAppProvider =
    providerRaw === "whatsapp_web" ? "whatsapp_web" : "meta_cloud";

  const runnerRaw =
    input.automationRunner && typeof input.automationRunner === "object"
      ? (input.automationRunner as Record<string, unknown>)
      : {};

  const categoriesRaw =
    input.categories && typeof input.categories === "object"
      ? (input.categories as Record<string, unknown>)
      : {};

  const categories = { ...defaults.categories } as Record<string, WhatsAppCategoryConfig>;

  for (const categoryKey of Object.keys(defaults.categories)) {
    const defaultCategory = defaults.categories[categoryKey];
    const rawCategory =
      categoriesRaw[categoryKey] && typeof categoriesRaw[categoryKey] === "object"
        ? (categoriesRaw[categoryKey] as Record<string, unknown>)
        : {};

    const rawSubcategories =
      rawCategory.subcategories && typeof rawCategory.subcategories === "object"
        ? (rawCategory.subcategories as Record<string, unknown>)
        : {};

    const nextSubcategories: Record<string, WhatsAppSubcategoryConfig> = {
      ...defaultCategory.subcategories,
    };

    for (const subKey of Object.keys(defaultCategory.subcategories)) {
      const defaultSub = defaultCategory.subcategories[subKey];
      const rawSub =
        rawSubcategories[subKey] && typeof rawSubcategories[subKey] === "object"
          ? (rawSubcategories[subKey] as Record<string, unknown>)
          : {};

      nextSubcategories[subKey] = {
        ...defaultSub,
        enabled:
          typeof rawSub.enabled === "boolean"
            ? rawSub.enabled
            : typeof (rawCategory as Record<string, unknown>).enabled === "boolean"
            ? Boolean((rawCategory as Record<string, unknown>).enabled)
            : defaultSub.enabled,
        daysOffset: Number.isFinite(Number(rawSub.daysOffset))
          ? Math.max(0, Math.min(365, Number(rawSub.daysOffset)))
          : defaultSub.daysOffset,
        sendFrom: normalizeTime(rawSub.sendFrom, defaultSub.sendFrom),
        sendTo: normalizeTime(rawSub.sendTo, defaultSub.sendTo),
        message: String(rawSub.message || defaultSub.message),
        variables: normalizeStringArray(rawSub.variables, defaultSub.variables),
      };
    }

    categories[categoryKey] = {
      ...defaultCategory,
      enabled:
        typeof rawCategory.enabled === "boolean"
          ? rawCategory.enabled
          : defaultCategory.enabled,
      subcategories: nextSubcategories,
    };
  }

  return {
    version: 3,
    connection: {
      enabled:
        typeof connectionRaw.enabled === "boolean"
          ? connectionRaw.enabled
          : defaults.connection.enabled,
      mode,
      provider,
    },
    automationRunner: {
      enabled:
        typeof runnerRaw.enabled === "boolean"
          ? runnerRaw.enabled
          : defaults.automationRunner.enabled,
      intervalMinutes: Number.isFinite(Number(runnerRaw.intervalMinutes))
        ? Math.max(1, Math.min(60, Number(runnerRaw.intervalMinutes)))
        : defaults.automationRunner.intervalMinutes,
      maxRetries: Number.isFinite(Number(runnerRaw.maxRetries))
        ? Math.max(0, Math.min(5, Number(runnerRaw.maxRetries)))
        : defaults.automationRunner.maxRetries,
      retryBackoffSeconds: Number.isFinite(Number(runnerRaw.retryBackoffSeconds))
        ? Math.max(5, Math.min(300, Number(runnerRaw.retryBackoffSeconds)))
        : defaults.automationRunner.retryBackoffSeconds,
      alertEmailOnFailure:
        typeof runnerRaw.alertEmailOnFailure === "boolean"
          ? runnerRaw.alertEmailOnFailure
          : defaults.automationRunner.alertEmailOnFailure,
      alertWhatsAppOnFailure:
        typeof runnerRaw.alertWhatsAppOnFailure === "boolean"
          ? runnerRaw.alertWhatsAppOnFailure
          : defaults.automationRunner.alertWhatsAppOnFailure,
    },
    categories,
    updatedAt:
      typeof input.updatedAt === "string" && input.updatedAt.trim()
        ? input.updatedAt
        : defaults.updatedAt,
  };
}

export function listConfigSubcategories(config: WhatsAppConfig) {
  const rows: Array<{
    categoryKey: string;
    categoryLabel: string;
    subcategoryKey: string;
    subcategoryLabel: string;
  }> = [];

  for (const categoryKey of Object.keys(config.categories)) {
    const category = config.categories[categoryKey];
    for (const subcategoryKey of Object.keys(category.subcategories)) {
      const sub = category.subcategories[subcategoryKey];
      rows.push({
        categoryKey,
        categoryLabel: category.label,
        subcategoryKey,
        subcategoryLabel: sub.label,
      });
    }
  }

  return rows;
}
