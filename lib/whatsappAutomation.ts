import { sendWhatsAppText } from "@/lib/whatsappAlerts";

export type CategoryKey = "cobranzas" | "asistencia_rutinas" | "recordatorios_otros";

export type RuleKey =
  | "aviso_anticipado"
  | "dia_vencimiento"
  | "vencido"
  | "renovacion_plan"
  | "actualizacion_datos"
  | "encuesta_fin_semana"
  | "cumpleanos_anticipado"
  | "cumpleanos_hoy"
  | "cumpleanos_post"
  | "programado_fecha_hora";

export type RuleConfig = {
  enabled: boolean;
  daysOffset: number;
  sendFrom: string;
  sendTo: string;
  message: string;
};

export type WhatsAppConfig = {
  connection: {
    enabled: boolean;
    countryCode: string;
    phoneNumber: string;
  };
  categories: Record<CategoryKey, { rules: Partial<Record<RuleKey, RuleConfig>> }>;
  updatedAt?: string;
  updatedBy?: string;
};

export type AutomationCandidate = {
  recipientId: string;
  recipientLabel: string;
  recipientType: string;
  recipientPhone: string;
  daysToDue: number | null;
  variables: Record<string, string>;
  preview: string;
  withinWindow: boolean;
  reason: string;
};

export const WHATSAPP_CONFIG_KEY = "whatsapp-config-v1";
const CLIENT_META_KEY = "pf-control-clientes-meta-v1";
const PAGOS_KEY = "pf-control-pagos-v1";
const ALUMNOS_KEY = "pf-control-alumnos";
const SCHEDULE_KEY_PREFIX = "whatsapp-schedule-";

const DEFAULT_CONFIG: WhatsAppConfig = {
  connection: {
    enabled: false,
    countryCode: "54",
    phoneNumber: "",
  },
  categories: {
    cobranzas: {
      rules: {
        aviso_anticipado: {
          enabled: true,
          daysOffset: 1,
          sendFrom: "09:00",
          sendTo: "20:00",
          message:
            "Hola {{nombre}}, tu cuota de la actividad {{actividad}} vence dentro de {{dias}} dias. Monto: {{total}}.",
        },
        dia_vencimiento: {
          enabled: true,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message:
            "Hola {{nombre}}, tu cuota de la actividad {{actividad}} vence hoy. Monto: {{total}}.",
        },
        vencido: {
          enabled: false,
          daysOffset: 1,
          sendFrom: "10:00",
          sendTo: "19:00",
          message:
            "Hola {{nombre}}, tu cuota de {{actividad}} vencio hace {{dias}} dias. Si ya pagaste, ignora este mensaje.",
        },
        renovacion_plan: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        actualizacion_datos: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        encuesta_fin_semana: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "18:00",
          sendTo: "21:00",
          message: "",
        },
      },
    },
    asistencia_rutinas: {
      rules: {
        aviso_anticipado: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        dia_vencimiento: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        vencido: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        renovacion_plan: {
          enabled: true,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "Hola {{nombre}}, ya tenes disponible tu plan de entrenamiento actualizado.",
        },
        actualizacion_datos: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "Hola {{nombre}}, actualizamos informacion importante de tu seguimiento.",
        },
        encuesta_fin_semana: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "18:00",
          sendTo: "21:00",
          message: "",
        },
      },
    },
    recordatorios_otros: {
      rules: {
        aviso_anticipado: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        dia_vencimiento: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        vencido: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        renovacion_plan: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        actualizacion_datos: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "",
        },
        encuesta_fin_semana: {
          enabled: true,
          daysOffset: 0,
          sendFrom: "18:00",
          sendTo: "21:00",
          message:
            "Hola {{nombre}}, terminaste tu semana de entrenamiento. Contanos como te sentiste en esta encuesta: {{link}}",
        },
        cumpleanos_anticipado: {
          enabled: false,
          daysOffset: 3,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "Hola {{nombre}}, en {{dias}} dias es tu cumpleanos. Te esperamos en {{actividad}}.",
        },
        cumpleanos_hoy: {
          enabled: false,
          daysOffset: 0,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "Feliz cumpleanos {{nombre}}. Que tengas un gran dia. Nos vemos en {{actividad}}.",
        },
        cumpleanos_post: {
          enabled: false,
          daysOffset: 1,
          sendFrom: "09:00",
          sendTo: "20:00",
          message: "Hola {{nombre}}, esperamos que hayas tenido un excelente cumpleanos. Te esperamos en {{actividad}}.",
        },
      },
    },
  },
};

type PaymentRecord = {
  clientId: string;
  clientName: string;
  fecha: string;
  importe: number;
  moneda: string;
  createdAt: string;
};

type RecipientProfile = {
  id: string;
  label: string;
  type: string;
  actividad: string;
  fechaNacimiento: string;
  endDate: string;
  startDate: string;
  updatedAt: string;
  moneda: string;
  importe: string;
  telefono: string;
  link: string;
};

type AutomationContext = {
  config: WhatsAppConfig;
  profiles: RecipientProfile[];
  now: Date;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRule(input: unknown, fallback: RuleConfig): RuleConfig {
  const source = isObject(input) ? input : {};

  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback.enabled,
    daysOffset:
      typeof source.daysOffset === "number" && Number.isFinite(source.daysOffset)
        ? source.daysOffset
        : fallback.daysOffset,
    sendFrom:
      typeof source.sendFrom === "string" && source.sendFrom.trim()
        ? source.sendFrom
        : fallback.sendFrom,
    sendTo:
      typeof source.sendTo === "string" && source.sendTo.trim() ? source.sendTo : fallback.sendTo,
    message:
      typeof source.message === "string" && source.message.trim()
        ? source.message
        : fallback.message,
  };
}

export function normalizeWhatsAppConfig(input: unknown): WhatsAppConfig {
  const source = isObject(input) ? input : {};
  const sourceConnection = isObject(source.connection) ? source.connection : {};
  const sourceCategories = isObject(source.categories) ? source.categories : {};

  const categories: Record<CategoryKey, { rules: Partial<Record<RuleKey, RuleConfig>> }> = {
    cobranzas: { rules: {} },
    asistencia_rutinas: { rules: {} },
    recordatorios_otros: { rules: {} },
  };

  (Object.keys(DEFAULT_CONFIG.categories) as CategoryKey[]).forEach((categoryKey) => {
    const defaultCategory = DEFAULT_CONFIG.categories[categoryKey];
    const sourceCategory = isObject(sourceCategories[categoryKey]) ? sourceCategories[categoryKey] : {};
    const sourceRules = isObject(sourceCategory.rules) ? sourceCategory.rules : {};

    (Object.keys(defaultCategory.rules) as RuleKey[]).forEach((ruleKey) => {
      const ruleDefault = defaultCategory.rules[ruleKey];
      if (!ruleDefault) {
        return;
      }

      categories[categoryKey].rules[ruleKey] = normalizeRule(
        sourceRules[ruleKey],
        ruleDefault
      );
    });
  });

  return {
    connection: {
      enabled:
        typeof sourceConnection.enabled === "boolean"
          ? sourceConnection.enabled
          : DEFAULT_CONFIG.connection.enabled,
      countryCode:
        typeof sourceConnection.countryCode === "string" && sourceConnection.countryCode.trim()
          ? sourceConnection.countryCode
          : DEFAULT_CONFIG.connection.countryCode,
      phoneNumber:
        typeof sourceConnection.phoneNumber === "string"
          ? sourceConnection.phoneNumber
          : DEFAULT_CONFIG.connection.phoneNumber,
    },
    categories,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined,
    updatedBy: typeof source.updatedBy === "string" ? source.updatedBy : undefined,
  };
}

function parseDate(raw: string): Date | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const date = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(target: Date, now: Date): number {
  const ms = atStartOfDay(target).getTime() - atStartOfDay(now).getTime();
  return Math.round(ms / 86_400_000);
}

function parseTimeToMinutes(raw: string): number | null {
  const value = String(raw || "").trim();
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function withinTimeWindow(now: Date, from: string, to: string): boolean {
  const start = parseTimeToMinutes(from);
  const end = parseTimeToMinutes(to);
  if (start === null || end === null) return true;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (start <= end) {
    return nowMinutes >= start && nowMinutes <= end;
  }

  return nowMinutes >= start || nowMinutes <= end;
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, token: string) => {
    return variables[token] ?? `{{${token}}}`;
  });
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  return digits.length >= 8 ? digits : "";
}

function normalizeCountryCode(raw: unknown, fallback = "54"): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits || fallback;
}

function normalizePhoneForCountry(raw: unknown, countryCodeRaw?: unknown): string {
  let digits = normalizePhone(raw);
  if (!digits) return "";

  const countryCode = normalizeCountryCode(countryCodeRaw, "54");

  if (countryCode === "54") {
    if (digits.startsWith("54")) {
      digits = digits.slice(2);
    }

    if (digits.startsWith("0")) {
      digits = digits.slice(1);
    }

    const withTrunk15 = digits.match(/^(\d{2,4})15(\d{6,8})$/);
    if (withTrunk15) {
      digits = `${withTrunk15[1]}${withTrunk15[2]}`;
    }

    // Already in international mobile format without country code (9 + 10 local digits).
    if (digits.startsWith("9") && digits.length === 11) {
      return `54${digits}`;
    }

    // Local AR mobile should be exactly 10 digits (area + subscriber).
    if (digits.length === 10) {
      return `549${digits}`;
    }

    return "";
  }

  if (digits.startsWith(countryCode)) {
    return digits;
  }

  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  return digits.length >= 6 ? `${countryCode}${digits}` : "";
}

function normalizePayment(raw: unknown): PaymentRecord | null {
  if (!isObject(raw)) return null;

  const clientId = safeString(raw.clientId);
  if (!clientId) return null;

  const importeNumber = Number(raw.importe);

  return {
    clientId,
    clientName: safeString(raw.clientName),
    fecha: safeString(raw.fecha),
    importe: Number.isFinite(importeNumber) ? importeNumber : 0,
    moneda: safeString(raw.moneda) || "ARS",
    createdAt: safeString(raw.createdAt),
  };
}

function normalizeProfilesFromMeta(
  metaMap: Record<string, unknown>,
  latestPaymentByClientId: Map<string, PaymentRecord>
): RecipientProfile[] {
  const surveyLink = process.env.PF_CONTROL_WHATSAPP_SURVEY_LINK || "https://pf-control.com/alumno/progreso";

  return Object.entries(metaMap)
    .map(([clientId, rawMeta]) => {
      if (!isObject(rawMeta)) return null;

      const label = clientId.includes(":") ? clientId.split(":").slice(1).join(":") : clientId;
      const payment = latestPaymentByClientId.get(clientId);
      const moneda = safeString(rawMeta.moneda) || payment?.moneda || "ARS";
      const importe = safeString(rawMeta.importe) || (payment ? String(payment.importe) : "0");

      return {
        id: clientId,
        label,
        type: clientId.startsWith("alumno:") ? "alumno" : clientId.startsWith("jugadora:") ? "jugadora" : "cliente",
        actividad: safeString(rawMeta.categoriaPlan) || safeString(rawMeta.objNutricional) || "Entrenamiento",
        fechaNacimiento:
          safeString(rawMeta.fechaNacimiento) ||
          safeString(rawMeta.nacimiento) ||
          safeString(rawMeta.birthDate) ||
          safeString(rawMeta.birthday),
        endDate: safeString(rawMeta.endDate),
        startDate: safeString(rawMeta.startDate),
        updatedAt: safeString(rawMeta.updatedAt),
        moneda,
        importe,
        telefono: safeString(rawMeta.telefono),
        link: surveyLink,
      } satisfies RecipientProfile;
    })
    .filter((item): item is RecipientProfile => Boolean(item));
}

async function buildContext(db: any, now: Date = new Date()): Promise<AutomationContext> {
  const [configEntry, metaEntry, pagosEntry, alumnosEntry] = await Promise.all([
    db.syncEntry.findUnique({ where: { key: WHATSAPP_CONFIG_KEY } }),
    db.syncEntry.findUnique({ where: { key: CLIENT_META_KEY } }),
    db.syncEntry.findUnique({ where: { key: PAGOS_KEY } }),
    db.syncEntry.findUnique({ where: { key: ALUMNOS_KEY } }),
  ]);

  const config = normalizeWhatsAppConfig(configEntry?.value || DEFAULT_CONFIG);

  const pagosRaw = Array.isArray(pagosEntry?.value) ? (pagosEntry.value as unknown[]) : [];
  const pagos = pagosRaw.map(normalizePayment).filter((item): item is PaymentRecord => Boolean(item));

  const latestPaymentByClientId = new Map<string, PaymentRecord>();
  pagos.forEach((payment) => {
    const current = latestPaymentByClientId.get(payment.clientId);
    const currentDate = parseDate(current?.fecha || current?.createdAt || "")?.getTime() || 0;
    const incomingDate = parseDate(payment.fecha || payment.createdAt || "")?.getTime() || 0;
    if (!current || incomingDate >= currentDate) {
      latestPaymentByClientId.set(payment.clientId, payment);
    }
  });

  const metaMap = isObject(metaEntry?.value) ? (metaEntry.value as Record<string, unknown>) : {};
  let profiles = normalizeProfilesFromMeta(metaMap, latestPaymentByClientId);

  const alumnosRaw = Array.isArray(alumnosEntry?.value) ? (alumnosEntry.value as unknown[]) : [];
  const birthByAlumnoName = new Map<string, string>();
  alumnosRaw.forEach((item) => {
    if (!isObject(item)) return;
    const nombre = safeString((item as Record<string, unknown>).nombre);
    const fechaNacimiento = safeString((item as Record<string, unknown>).fechaNacimiento);
    if (!nombre || !fechaNacimiento) return;
    birthByAlumnoName.set(normalizeText(nombre), fechaNacimiento);
  });

  profiles = profiles.map((profile) => {
    if (profile.fechaNacimiento) {
      return profile;
    }

    const fallbackBirth = birthByAlumnoName.get(normalizeText(profile.label));
    if (!fallbackBirth) {
      return profile;
    }

    return {
      ...profile,
      fechaNacimiento: fallbackBirth,
    };
  });

  if (profiles.length === 0) {
    const users = await db.user.findMany({
      where: { role: "CLIENTE", estado: "activo" },
      select: {
        id: true,
        nombreCompleto: true,
        email: true,
        telefono: true,
        fechaNacimiento: true,
      },
      take: 300,
    });

    profiles = users.map((user: any) => ({
      id: `user:${String(user.id)}`,
      label: String(user.nombreCompleto || user.email || user.id),
      type: "cliente",
      actividad: "Entrenamiento",
      fechaNacimiento: String(user.fechaNacimiento || ""),
      endDate: "",
      startDate: "",
      updatedAt: "",
      moneda: "ARS",
      importe: "0",
      telefono: String(user.telefono || ""),
      link: process.env.PF_CONTROL_WHATSAPP_SURVEY_LINK || "https://pf-control.com/alumno/progreso",
    }));
  }

  return { config, profiles, now };
}

function evaluateRule(
  profile: RecipientProfile,
  ruleKey: RuleKey,
  rule: RuleConfig,
  now: Date
): { match: boolean; daysToDue: number | null; reason: string } {
  const endDate = parseDate(profile.endDate);
  const startDate = parseDate(profile.startDate);
  const updatedAt = parseDate(profile.updatedAt);

  const dueDiff = endDate ? diffDays(endDate, now) : null;

  const getBirthdayDiffs = () => {
    const birthDate = parseDate(profile.fechaNacimiento);
    if (!birthDate) {
      return null;
    }

    const today = atStartOfDay(now);
    const thisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    const nextBirthday = thisYear.getTime() >= today.getTime()
      ? thisYear
      : new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
    const lastBirthday = thisYear.getTime() <= today.getTime()
      ? thisYear
      : new Date(today.getFullYear() - 1, birthDate.getMonth(), birthDate.getDate());

    return {
      daysUntil: diffDays(nextBirthday, today),
      daysSince: Math.abs(diffDays(lastBirthday, today)),
    };
  };

  if (ruleKey === "aviso_anticipado") {
    if (dueDiff === null) return { match: false, daysToDue: null, reason: "Sin fecha de vencimiento" };
    return {
      match: dueDiff === Math.max(0, rule.daysOffset),
      daysToDue: dueDiff,
      reason: `Coincide ${rule.daysOffset} dias antes`,
    };
  }

  if (ruleKey === "dia_vencimiento") {
    if (dueDiff === null) return { match: false, daysToDue: null, reason: "Sin fecha de vencimiento" };
    return {
      match: dueDiff === 0,
      daysToDue: dueDiff,
      reason: "Coincide con el dia de vencimiento",
    };
  }

  if (ruleKey === "vencido") {
    if (dueDiff === null) return { match: false, daysToDue: null, reason: "Sin fecha de vencimiento" };
    const target = -Math.max(1, rule.daysOffset);
    return {
      match: dueDiff === target,
      daysToDue: dueDiff,
      reason: `Coincide ${Math.abs(target)} dias despues del vencimiento`,
    };
  }

  if (ruleKey === "renovacion_plan") {
    if (!startDate) return { match: false, daysToDue: null, reason: "Sin fecha de inicio" };
    const startDiff = diffDays(startDate, now);
    return {
      match: startDiff === 0,
      daysToDue: dueDiff,
      reason: "Plan renovado hoy",
    };
  }

  if (ruleKey === "actualizacion_datos") {
    if (!updatedAt) return { match: false, daysToDue: dueDiff, reason: "Sin timestamp de actualizacion" };
    const updatedDiff = diffDays(updatedAt, now);
    return {
      match: updatedDiff === 0,
      daysToDue: dueDiff,
      reason: "Datos actualizados hoy",
    };
  }

  if (ruleKey === "encuesta_fin_semana") {
    const day = now.getDay();
    return {
      match: day === 0,
      daysToDue: dueDiff,
      reason: "Encuesta de fin de semana (domingo)",
    };
  }

  if (ruleKey === "cumpleanos_anticipado") {
    const birthday = getBirthdayDiffs();
    if (!birthday) return { match: false, daysToDue: null, reason: "Sin fecha de nacimiento" };
    const target = Math.max(1, rule.daysOffset);
    return {
      match: birthday.daysUntil === target,
      daysToDue: birthday.daysUntil,
      reason: `Cumpleanos en ${target} dias`,
    };
  }

  if (ruleKey === "cumpleanos_hoy") {
    const birthday = getBirthdayDiffs();
    if (!birthday) return { match: false, daysToDue: null, reason: "Sin fecha de nacimiento" };
    return {
      match: birthday.daysUntil === 0,
      daysToDue: 0,
      reason: "Cumpleanos hoy",
    };
  }

  if (ruleKey === "cumpleanos_post") {
    const birthday = getBirthdayDiffs();
    if (!birthday) return { match: false, daysToDue: null, reason: "Sin fecha de nacimiento" };
    const target = Math.max(1, rule.daysOffset);
    return {
      match: birthday.daysUntil !== 0 && birthday.daysSince === target,
      daysToDue: -target,
      reason: `Cumpleanos hace ${target} dias`,
    };
  }

  return {
    match: false,
    daysToDue: dueDiff,
    reason: "Regla no soportada",
  };
}

function buildVariables(profile: RecipientProfile, daysToDue: number | null, now: Date): Record<string, string> {
  const fecha = parseDate(profile.endDate)
    ? parseDate(profile.endDate)?.toLocaleDateString("es-AR") || now.toLocaleDateString("es-AR")
    : now.toLocaleDateString("es-AR");

  const rawTotal = `${profile.moneda} ${profile.importe}`.trim();

  return {
    nombre: profile.label,
    actividad: profile.actividad || "Entrenamiento",
    dias: String(daysToDue === null ? 0 : Math.abs(daysToDue)),
    total: rawTotal || "ARS 0",
    fecha,
    link: profile.link,
  };
}

function evaluateCandidates(
  context: AutomationContext,
  categoryKey: CategoryKey,
  ruleKey: RuleKey,
  options?: { forceWindow?: boolean; includeDisabled?: boolean }
): { rule: RuleConfig; candidates: AutomationCandidate[] } {
  const rule = context.config.categories[categoryKey]?.rules?.[ruleKey];

  if (!rule) {
    return {
      rule: {
        enabled: false,
        daysOffset: 0,
        sendFrom: "09:00",
        sendTo: "20:00",
        message: "",
      },
      candidates: [],
    };
  }

  if (!rule.enabled && !options?.includeDisabled) {
    return { rule, candidates: [] };
  }

  const candidates: AutomationCandidate[] = [];

  context.profiles.forEach((profile) => {
    const matchInfo = evaluateRule(profile, ruleKey, rule, context.now);
    if (!matchInfo.match) return;

    const withinWindowNow = options?.forceWindow
      ? true
      : withinTimeWindow(context.now, rule.sendFrom, rule.sendTo);

    const variables = buildVariables(profile, matchInfo.daysToDue, context.now);
    const preview = renderTemplate(rule.message, variables);

    candidates.push({
      recipientId: profile.id,
      recipientLabel: profile.label,
      recipientType: profile.type,
      recipientPhone: normalizePhoneForCountry(profile.telefono, context.config.connection.countryCode),
      daysToDue: matchInfo.daysToDue,
      variables,
      preview,
      withinWindow: withinWindowNow,
      reason: matchInfo.reason,
    });
  });

  return { rule, candidates };
}

export async function simulateAutomationRule(
  db: any,
  params: {
    categoryKey: CategoryKey;
    ruleKey: RuleKey;
    now?: Date;
    forceWindow?: boolean;
    limit?: number;
  }
) {
  const context = await buildContext(db, params.now);
  const { rule, candidates } = evaluateCandidates(context, params.categoryKey, params.ruleKey, {
    forceWindow: Boolean(params.forceWindow),
    includeDisabled: true,
  });

  const limited = candidates.slice(0, Math.max(1, Math.min(300, Number(params.limit || 40))));
  const ready = limited.filter((item) => item.withinWindow).length;

  return {
    categoryKey: params.categoryKey,
    ruleKey: params.ruleKey,
    rule,
    summary: {
      generatedAt: new Date().toISOString(),
      totalMatched: candidates.length,
      returned: limited.length,
      readyToSendNow: ready,
      blockedByWindow: limited.length - ready,
    },
    recipients: limited,
  };
}

async function createLog(
  db: any,
  payload: {
    recipient: AutomationCandidate;
    categoryKey: string;
    ruleKey: string;
    status: "enviado" | "error";
    error?: string;
    template: string;
    renderedMessage: string;
    triggeredBy: string;
    runId: string;
  }
) {
  await db.syncEntry.create({
    data: {
      key: `whatsapp-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      value: {
        destinatario: payload.recipient.recipientLabel,
        destinatarioId: payload.recipient.recipientId,
        destinatarioTipo: payload.recipient.recipientType,
        plantilla: payload.template,
        mensaje: payload.renderedMessage,
        tipo: payload.categoryKey,
        subcategoria: payload.ruleKey,
        mode: "automatico",
        estado: payload.status,
        error: payload.error || null,
        triggeredBy: payload.triggeredBy,
        automationRunId: payload.runId,
        fecha: new Date().toISOString(),
      },
    },
  });
}

function parseScheduleDate(raw: unknown): Date | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pickPhoneFromUnknown(raw: unknown): string {
  if (!isObject(raw)) return "";

  const source = raw as Record<string, unknown>;
  const variableBag = isObject(source.variables) ? (source.variables as Record<string, unknown>) : {};

  const candidates = [
    source.telefono,
    source.phone,
    source.whatsapp,
    variableBag.telefono,
    variableBag.phone,
    variableBag.whatsapp,
    variableBag.telefonoWhatsapp,
    variableBag.celular,
  ];

  for (const candidate of candidates) {
    const phone = normalizePhoneForCountry(candidate, "54");
    if (phone) return phone;
  }

  return "";
}

async function executeScheduledMessages(
  db: any,
  context: AutomationContext,
  params: {
    dryRun: boolean;
    triggeredBy: string;
    runId: string;
    now: Date;
  }
) {
  const entries = await db.syncEntry.findMany({
    where: { key: { startsWith: SCHEDULE_KEY_PREFIX } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const profilesById = new Map(context.profiles.map((profile) => [profile.id, profile]));
  const profilesByLabel = new Map(context.profiles.map((profile) => [normalizeText(profile.label), profile]));

  let matched = 0;
  let sent = 0;
  let failed = 0;

  for (const entry of entries) {
    const value = isObject(entry.value) ? (entry.value as Record<string, unknown>) : {};
    const estado = String(value.estado || "pendiente").toLowerCase();
    const automatico = value.automatico !== false;

    if (!automatico || estado === "enviado" || estado === "cancelado") {
      continue;
    }

    const fecha = parseScheduleDate(value.fecha);
    if (!fecha || fecha.getTime() > params.now.getTime()) {
      continue;
    }

    const mensaje = String(value.mensaje || "").trim();
    const categoria = String(value.categoria || "recordatorios_otros").trim() || "recordatorios_otros";
    const subcategoria = String(value.subcategoria || "programado_fecha_hora").trim() || "programado_fecha_hora";
    const rawRecipients = Array.isArray(value.destinatarios) ? value.destinatarios : [];

    if (!mensaje || rawRecipients.length === 0) {
      await db.syncEntry.update({
        where: { key: String(entry.key) },
        data: {
          value: {
            ...value,
            estado: "error",
            ejecutadoAt: new Date().toISOString(),
            error: "Programacion sin mensaje o destinatarios",
          },
        },
      });
      failed += 1;
      continue;
    }

    let scheduleSent = 0;
    let scheduleFailed = 0;

    for (const recipientRaw of rawRecipients) {
      const raw: Record<string, unknown> = isObject(recipientRaw)
        ? (recipientRaw as Record<string, unknown>)
        : { label: recipientRaw };
      const recipientId = String(raw.id || raw.label || "programado").trim() || "programado";
      const recipientLabel = String(raw.label || raw.nombre || raw.id || "Destinatario").trim() || "Destinatario";
      const recipientType = String(raw.tipo || raw.type || "programado").trim() || "programado";

      const byId = profilesById.get(recipientId);
      const byLabel = profilesByLabel.get(normalizeText(recipientLabel));

      const destinationPhone =
        pickPhoneFromUnknown(raw) ||
        normalizePhoneForCountry(byId?.telefono, context.config.connection.countryCode) ||
        normalizePhoneForCountry(byLabel?.telefono, context.config.connection.countryCode);

      const variables = {
        nombre: recipientLabel,
        actividad: byId?.actividad || byLabel?.actividad || "Entrenamiento",
        dias: "0",
        total: byId ? `${byId.moneda} ${byId.importe}` : "$0",
        fecha: new Date().toLocaleDateString("es-AR"),
        link: byId?.link || byLabel?.link || "https://pf-control.com",
      };

      const renderedMessage = renderTemplate(mensaje, variables);
      matched += 1;

      try {
        if (!destinationPhone) {
          throw new Error("Destinatario sin telefono valido");
        }

        if (!params.dryRun) {
          await sendWhatsAppText(renderedMessage, destinationPhone, {
            forceTemplate: true,
          });

          await createLog(db, {
            recipient: {
              recipientId,
              recipientLabel,
              recipientType,
              recipientPhone: destinationPhone,
              daysToDue: null,
              variables,
              preview: renderedMessage,
              withinWindow: true,
              reason: "Programado por fecha/hora",
            },
            categoryKey: categoria,
            ruleKey: subcategoria,
            status: "enviado",
            template: mensaje,
            renderedMessage,
            triggeredBy: params.triggeredBy,
            runId: params.runId,
          });
        }

        scheduleSent += 1;
      } catch (error) {
        scheduleFailed += 1;

        if (!params.dryRun) {
          await createLog(db, {
            recipient: {
              recipientId,
              recipientLabel,
              recipientType,
              recipientPhone: destinationPhone,
              daysToDue: null,
              variables,
              preview: renderedMessage,
              withinWindow: true,
              reason: "Programado por fecha/hora",
            },
            categoryKey: categoria,
            ruleKey: subcategoria,
            status: "error",
            error: error instanceof Error ? error.message : "Error de envio",
            template: mensaje,
            renderedMessage,
            triggeredBy: params.triggeredBy,
            runId: params.runId,
          });
        }
      }
    }

    sent += scheduleSent;
    failed += scheduleFailed;

    if (!params.dryRun) {
      await db.syncEntry.update({
        where: { key: String(entry.key) },
        data: {
          value: {
            ...value,
            estado: scheduleFailed === 0 ? "enviado" : scheduleSent > 0 ? "parcial" : "error",
            ejecutadoAt: new Date().toISOString(),
            resultado: {
              total: rawRecipients.length,
              sent: scheduleSent,
              failed: scheduleFailed,
            },
          },
        },
      });
    }
  }

  return {
    categoryKey: "recordatorios_otros" as CategoryKey,
    ruleKey: "programado_fecha_hora" as RuleKey,
    enabled: true,
    dryRun: params.dryRun,
    matched,
    sent,
    failed,
    skippedByWindow: 0,
  };
}

async function executeRule(
  db: any,
  context: AutomationContext,
  params: {
    categoryKey: CategoryKey;
    ruleKey: RuleKey;
    dryRun: boolean;
    forceWindow?: boolean;
    triggeredBy: string;
    runId: string;
    includeDisabled?: boolean;
  }
) {
  const { rule, candidates } = evaluateCandidates(context, params.categoryKey, params.ruleKey, {
    forceWindow: Boolean(params.forceWindow),
    includeDisabled: Boolean(params.includeDisabled),
  });

  let sent = 0;
  let failed = 0;
  let skippedByWindow = 0;

  for (const candidate of candidates) {
    if (!candidate.withinWindow && !params.forceWindow) {
      skippedByWindow += 1;
      continue;
    }

    if (params.dryRun) {
      sent += 1;
      continue;
    }

    try {
      if (!candidate.recipientPhone) {
        throw new Error("Destinatario sin telefono valido");
      }

      await sendWhatsAppText(candidate.preview, candidate.recipientPhone, {
        forceTemplate: true,
      });
      sent += 1;

      await createLog(db, {
        recipient: candidate,
        categoryKey: params.categoryKey,
        ruleKey: params.ruleKey,
        status: "enviado",
        template: rule.message,
        renderedMessage: candidate.preview,
        triggeredBy: params.triggeredBy,
        runId: params.runId,
      });
    } catch (error) {
      failed += 1;
      await createLog(db, {
        recipient: candidate,
        categoryKey: params.categoryKey,
        ruleKey: params.ruleKey,
        status: "error",
        error: error instanceof Error ? error.message : "Error de envio",
        template: rule.message,
        renderedMessage: candidate.preview,
        triggeredBy: params.triggeredBy,
        runId: params.runId,
      });
    }
  }

  return {
    categoryKey: params.categoryKey,
    ruleKey: params.ruleKey,
    enabled: rule.enabled,
    dryRun: params.dryRun,
    matched: candidates.length,
    sent,
    failed,
    skippedByWindow,
  };
}

export async function runAutomationRules(
  db: any,
  params: {
    categoryKey?: CategoryKey;
    ruleKey?: RuleKey;
    dryRun?: boolean;
    forceWindow?: boolean;
    includeDisabled?: boolean;
    triggeredBy: string;
    now?: Date;
  }
) {
  const context = await buildContext(db, params.now);

  if (!context.config.connection.enabled) {
    return {
      ok: true,
      runId: `auto-disabled-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dryRun: Boolean(params.dryRun),
      totals: {
        matched: 0,
        sent: 0,
        failed: 0,
        skippedByWindow: 0,
      },
      rulesExecuted: 0,
      perRule: [],
      generatedAt: new Date().toISOString(),
      skipped: true,
      skippedReason: "whatsapp_connection_disabled",
    };
  }

  const runId = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const targets: Array<{ categoryKey: CategoryKey; ruleKey: RuleKey }> = [];

  if (params.categoryKey && params.ruleKey) {
    targets.push({ categoryKey: params.categoryKey, ruleKey: params.ruleKey });
  } else {
    (Object.keys(context.config.categories) as CategoryKey[]).forEach((categoryKey) => {
      (Object.keys(context.config.categories[categoryKey].rules) as RuleKey[]).forEach((ruleKey) => {
        const rule = context.config.categories[categoryKey].rules[ruleKey];
        if (rule && (rule.enabled || params.includeDisabled)) {
          targets.push({ categoryKey, ruleKey });
        }
      });
    });
  }

  const perRule = [];

  for (const target of targets) {
    const summary = await executeRule(db, context, {
      categoryKey: target.categoryKey,
      ruleKey: target.ruleKey,
      dryRun: Boolean(params.dryRun),
      forceWindow: Boolean(params.forceWindow),
      includeDisabled: Boolean(params.includeDisabled),
      triggeredBy: params.triggeredBy,
      runId,
    });
    perRule.push(summary);
  }

  const scheduledSummary = await executeScheduledMessages(db, context, {
    dryRun: Boolean(params.dryRun),
    triggeredBy: params.triggeredBy,
    runId,
    now: context.now,
  });

  if (scheduledSummary.matched > 0 || scheduledSummary.failed > 0 || scheduledSummary.sent > 0) {
    perRule.push(scheduledSummary);
  }

  const totals = perRule.reduce(
    (acc, current) => {
      acc.matched += current.matched;
      acc.sent += current.sent;
      acc.failed += current.failed;
      acc.skippedByWindow += current.skippedByWindow;
      return acc;
    },
    {
      matched: 0,
      sent: 0,
      failed: 0,
      skippedByWindow: 0,
    }
  );

  return {
    ok: totals.failed === 0,
    runId,
    dryRun: Boolean(params.dryRun),
    totals,
    rulesExecuted: perRule.length,
    perRule,
    generatedAt: new Date().toISOString(),
  };
}
