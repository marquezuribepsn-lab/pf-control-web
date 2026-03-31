import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const db = prisma as any;
const CONFIG_KEY = 'whatsapp-config-v1';

type RuleConfig = {
  enabled: boolean;
  daysOffset: number;
  sendFrom: string;
  sendTo: string;
  message: string;
};

type CategoryConfig = {
  rules: Record<string, RuleConfig>;
};

type WhatsAppConfig = {
  connection: {
    enabled: boolean;
    countryCode: string;
    phoneNumber: string;
  };
  categories: Record<string, CategoryConfig>;
  updatedAt?: string;
  updatedBy?: string;
};

const DEFAULT_CONFIG: WhatsAppConfig = {
  connection: {
    enabled: false,
    countryCode: '54',
    phoneNumber: '',
  },
  categories: {
    cobranzas: {
      rules: {
        aviso_anticipado: {
          enabled: true,
          daysOffset: 1,
          sendFrom: '09:00',
          sendTo: '20:00',
          message:
            'Hola {{nombre}}, tu cuota de la actividad {{actividad}} vence dentro de {{dias}} dias. Monto: {{total}}.',
        },
        dia_vencimiento: {
          enabled: true,
          daysOffset: 0,
          sendFrom: '09:00',
          sendTo: '20:00',
          message:
            'Hola {{nombre}}, tu cuota de la actividad {{actividad}} vence hoy. Monto: {{total}}.',
        },
        vencido: {
          enabled: false,
          daysOffset: 1,
          sendFrom: '10:00',
          sendTo: '19:00',
          message:
            'Hola {{nombre}}, tu cuota de {{actividad}} vencio hace {{dias}} dias. Si ya pagaste, ignora este mensaje.',
        },
      },
    },
    asistencia_rutinas: {
      rules: {
        renovacion_plan: {
          enabled: true,
          daysOffset: 0,
          sendFrom: '09:00',
          sendTo: '20:00',
          message: 'Hola {{nombre}}, ya tenes disponible tu plan de entrenamiento actualizado.',
        },
        actualizacion_datos: {
          enabled: false,
          daysOffset: 0,
          sendFrom: '09:00',
          sendTo: '20:00',
          message: 'Hola {{nombre}}, actualizamos informacion importante de tu seguimiento.',
        },
      },
    },
    recordatorios_otros: {
      rules: {
        encuesta_fin_semana: {
          enabled: true,
          daysOffset: 0,
          sendFrom: '18:00',
          sendTo: '21:00',
          message:
            'Hola {{nombre}}, terminaste tu semana de entrenamiento. Contanos como te sentiste en esta encuesta: {{link}}',
        },
        cumpleanos_anticipado: {
          enabled: false,
          daysOffset: 3,
          sendFrom: '09:00',
          sendTo: '20:00',
          message: 'Hola {{nombre}}, en {{dias}} dias es tu cumpleanos. Te esperamos en {{actividad}}.',
        },
        cumpleanos_hoy: {
          enabled: false,
          daysOffset: 0,
          sendFrom: '09:00',
          sendTo: '20:00',
          message: 'Feliz cumpleanos {{nombre}}. Que tengas un gran dia. Nos vemos en {{actividad}}.',
        },
        cumpleanos_post: {
          enabled: false,
          daysOffset: 1,
          sendFrom: '09:00',
          sendTo: '20:00',
          message: 'Hola {{nombre}}, esperamos que hayas tenido un excelente cumpleanos. Te esperamos en {{actividad}}.',
        },
      },
    },
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRule(input: unknown, fallback: RuleConfig): RuleConfig {
  const source = isObject(input) ? input : {};

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : fallback.enabled,
    daysOffset:
      typeof source.daysOffset === 'number' && Number.isFinite(source.daysOffset)
        ? source.daysOffset
        : fallback.daysOffset,
    sendFrom: typeof source.sendFrom === 'string' && source.sendFrom.trim() ? source.sendFrom : fallback.sendFrom,
    sendTo: typeof source.sendTo === 'string' && source.sendTo.trim() ? source.sendTo : fallback.sendTo,
    message: typeof source.message === 'string' && source.message.trim() ? source.message : fallback.message,
  };
}

function normalizeConfig(input: unknown): WhatsAppConfig {
  const source = isObject(input) ? input : {};
  const sourceConnection = isObject(source.connection) ? source.connection : {};
  const sourceCategories = isObject(source.categories) ? source.categories : {};

  const categories: Record<string, CategoryConfig> = {};

  for (const [categoryKey, categoryValue] of Object.entries(DEFAULT_CONFIG.categories)) {
    const sourceCategory = isObject(sourceCategories[categoryKey]) ? sourceCategories[categoryKey] : {};
    const sourceRules = isObject(sourceCategory.rules) ? sourceCategory.rules : {};

    const nextRules: Record<string, RuleConfig> = {};
    for (const [ruleKey, ruleDefault] of Object.entries(categoryValue.rules)) {
      nextRules[ruleKey] = normalizeRule(sourceRules[ruleKey], ruleDefault);
    }

    categories[categoryKey] = { rules: nextRules };
  }

  return {
    connection: {
      enabled:
        typeof sourceConnection.enabled === 'boolean'
          ? sourceConnection.enabled
          : DEFAULT_CONFIG.connection.enabled,
      countryCode:
        typeof sourceConnection.countryCode === 'string' && sourceConnection.countryCode.trim()
          ? sourceConnection.countryCode
          : DEFAULT_CONFIG.connection.countryCode,
      phoneNumber:
        typeof sourceConnection.phoneNumber === 'string' ? sourceConnection.phoneNumber : DEFAULT_CONFIG.connection.phoneNumber,
    },
    categories,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
    updatedBy: typeof source.updatedBy === 'string' ? source.updatedBy : undefined,
  };
}

export async function GET() {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const entry = await db.syncEntry.findUnique({ where: { key: CONFIG_KEY } });
  const config = normalizeConfig(entry?.value || DEFAULT_CONFIG);

  return NextResponse.json({ config });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { config?: unknown };
  const incoming = body.config ?? body;

  const existingEntry = await db.syncEntry.findUnique({ where: { key: CONFIG_KEY } });
  const current = normalizeConfig(existingEntry?.value || DEFAULT_CONFIG);

  const source = isObject(incoming) ? incoming : {};
  const sourceConnection = isObject(source.connection) ? source.connection : {};
  const sourceCategories = isObject(source.categories) ? source.categories : {};

  const merged: WhatsAppConfig = {
    ...current,
    connection: {
      enabled:
        typeof sourceConnection.enabled === 'boolean'
          ? sourceConnection.enabled
          : current.connection.enabled,
      countryCode:
        typeof sourceConnection.countryCode === 'string' && sourceConnection.countryCode.trim()
          ? sourceConnection.countryCode
          : current.connection.countryCode,
      phoneNumber:
        typeof sourceConnection.phoneNumber === 'string'
          ? sourceConnection.phoneNumber
          : current.connection.phoneNumber,
    },
    categories: Object.fromEntries(
      Object.entries(current.categories).map(([categoryKey, categoryValue]) => {
        const patchCategory = isObject(sourceCategories[categoryKey]) ? sourceCategories[categoryKey] : {};
        const patchRules = isObject(patchCategory.rules) ? patchCategory.rules : {};

        const rules = Object.fromEntries(
          Object.entries(categoryValue.rules).map(([ruleKey, ruleValue]) => {
            return [ruleKey, normalizeRule(patchRules[ruleKey], ruleValue)];
          })
        ) as Record<string, RuleConfig>;

        return [categoryKey, { rules }];
      })
    ) as Record<string, CategoryConfig>,
  };

  const normalized = normalizeConfig(merged);

  const payload: WhatsAppConfig = {
    ...normalized,
    updatedAt: new Date().toISOString(),
    updatedBy: String((session.user as any)?.email || ''),
  };

  await db.syncEntry.upsert({
    where: { key: CONFIG_KEY },
    create: {
      key: CONFIG_KEY,
      value: payload,
    },
    update: {
      value: payload,
    },
  });

  return NextResponse.json({ ok: true, config: payload });
}
