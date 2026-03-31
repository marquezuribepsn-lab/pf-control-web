import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsappAlerts';
import { prisma } from '@/lib/prisma';

const db = prisma as any;
const CLIENT_META_KEY = 'pf-control-clientes-meta-v1';
const WHATSAPP_CONFIG_KEY = 'whatsapp-config-v1';

type IncomingRecipient =
  | string
  | {
      id?: string;
      label?: string;
      nombre?: string;
      tipo?: string;
      telefono?: string;
      phone?: string;
      whatsapp?: string;
      variables?: Record<string, unknown>;
    };

type NormalizedRecipient = {
  id: string;
  label: string;
  tipo: string;
  variables: Record<string, unknown>;
};

function normalizePhone(raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) return '';

  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  return digits.length >= 8 ? digits : '';
}

function normalizeCountryCode(raw: unknown, fallback = '54'): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits || fallback;
}

function normalizePhoneForCountry(raw: unknown, countryCodeRaw?: unknown): string {
  let digits = normalizePhone(raw);
  if (!digits) return '';

  const countryCode = normalizeCountryCode(countryCodeRaw, '54');

  if (countryCode === '54') {
    if (digits.startsWith('54')) {
      digits = digits.slice(2);
    }

    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    const withTrunk15 = digits.match(/^(\d{2,4})15(\d{6,8})$/);
    if (withTrunk15) {
      digits = `${withTrunk15[1]}${withTrunk15[2]}`;
    }

    // Already in international mobile format without country code (9 + 10 local digits).
    if (digits.startsWith('9') && digits.length === 11) {
      return `54${digits}`;
    }

    // Local AR mobile should be exactly 10 digits (area + subscriber).
    if (digits.length === 10) {
      return `549${digits}`;
    }

    return '';
  }

  if (digits.startsWith(countryCode)) {
    return digits;
  }

  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  return digits.length >= 6 ? `${countryCode}${digits}` : '';
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pickPhoneFromVariables(variables: Record<string, unknown>, countryCode?: string): string {
  const candidates = [
    variables.telefono,
    variables.phone,
    variables.whatsapp,
    variables.telefonoWhatsapp,
    variables.celular,
  ];

  for (const value of candidates) {
    const normalized = normalizePhoneForCountry(value, countryCode);
    if (normalized) return normalized;
  }

  return '';
}

function renderTemplate(template: string, variables: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, token: string) => {
    const value = variables[token];
    if (value === null || value === undefined || value === '') {
      return `{{${token}}}`;
    }
    return String(value);
  });
}

function normalizeRecipients(raw: unknown, countryCode?: string): NormalizedRecipient[] {
  if (!Array.isArray(raw)) return [];

  const normalized: NormalizedRecipient[] = [];

  raw.forEach((item, index) => {
    if (typeof item === 'string') {
      const label = item.trim();
      if (!label) return;

      normalized.push({
        id: `dest-${index}-${Date.now()}`,
        label,
        tipo: 'manual',
        variables: { nombre: label },
      });
      return;
    }

    if (!item || typeof item !== 'object') {
      return;
    }

    const source = item as {
      id?: unknown;
      label?: unknown;
      nombre?: unknown;
      tipo?: unknown;
      telefono?: unknown;
      phone?: unknown;
      whatsapp?: unknown;
      variables?: unknown;
    };

    const label = String(source.label || source.nombre || source.id || '').trim();
    if (!label) {
      return;
    }

    const id = String(source.id || `dest-${index}-${Date.now()}`);
    const tipo = String(source.tipo || 'manual');
    const variables = source.variables && typeof source.variables === 'object'
      ? (source.variables as Record<string, unknown>)
      : {};
    const inlinePhone =
      normalizePhoneForCountry(source.telefono, countryCode) ||
      normalizePhoneForCountry(source.phone, countryCode) ||
      normalizePhoneForCountry(source.whatsapp, countryCode);

    normalized.push({
      id,
      label,
      tipo,
      variables: {
        nombre: label,
        ...variables,
        ...(inlinePhone ? { telefono: inlinePhone } : {}),
      },
    });
  });

  return normalized;
}

async function resolveRecipientPhone(
  recipient: NormalizedRecipient,
  options: {
    clientMetaById: Record<string, unknown>;
    countryCode: string;
  }
) {
  const fromVariables = pickPhoneFromVariables(recipient.variables, options.countryCode);
  if (fromVariables) {
    return fromVariables;
  }

  const metaById = options.clientMetaById;
  const metaKeys = [recipient.id, `alumno:${recipient.label}`];
  for (const key of metaKeys) {
    const rawMeta = metaById[key];
    if (rawMeta && typeof rawMeta === 'object') {
      const maybePhone = normalizePhoneForCountry((rawMeta as Record<string, unknown>).telefono, options.countryCode);
      if (maybePhone) {
        return maybePhone;
      }
    }
  }

  const targetLabel = normalizeText(recipient.label);
  if (targetLabel) {
    for (const [metaId, rawMeta] of Object.entries(metaById)) {
      if (!rawMeta || typeof rawMeta !== 'object') continue;

      const metaLabel = normalizeText(String(metaId).split(':').slice(1).join(':'));
      if (!metaLabel) continue;

      if (
        metaLabel === targetLabel ||
        metaLabel.includes(targetLabel) ||
        targetLabel.includes(metaLabel)
      ) {
        const maybePhone = normalizePhoneForCountry((rawMeta as Record<string, unknown>).telefono, options.countryCode);
        if (maybePhone) {
          return maybePhone;
        }
      }
    }
  }

  const recipientId = String(recipient.id || '');
  const candidateUserId = recipientId.includes(':') ? recipientId.split(':').slice(1).join(':') : recipientId;

  const user = await db.user.findFirst({
    where: {
      OR: [
        candidateUserId ? { id: candidateUserId } : undefined,
        { email: recipient.label },
        { nombreCompleto: recipient.label },
      ].filter(Boolean),
    },
    select: { telefono: true },
  });

  let userPhone = normalizePhoneForCountry(user?.telefono, options.countryCode);

  if (!userPhone && targetLabel) {
    const users = await db.user.findMany({
      where: {
        telefono: {
          not: null,
        },
      },
      select: {
        telefono: true,
        nombreCompleto: true,
      },
      take: 300,
    });

    const fallbackUser = users.find((item: { nombreCompleto?: string | null }) => {
      const userLabel = normalizeText(item?.nombreCompleto || '');
      if (!userLabel) return false;
      return userLabel === targetLabel || userLabel.includes(targetLabel) || targetLabel.includes(userLabel);
    });

    userPhone = normalizePhoneForCountry((fallbackUser as { telefono?: string | null } | undefined)?.telefono, options.countryCode);
  }

  return userPhone;
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      destinatarios?: IncomingRecipient[];
      mensaje?: string;
      tipo?: string;
      subcategoria?: string;
      mode?: 'manual' | 'automatico' | 'test';
      variables?: Record<string, unknown>;
    };

    const mensaje = String(body.mensaje || '').trim();
    const tipo = String(body.tipo || 'general').trim();
    const subcategoria = String(body.subcategoria || 'general').trim();
    const mode = body.mode === 'automatico' || body.mode === 'test' ? body.mode : 'manual';
    const globalVariables =
      body.variables && typeof body.variables === 'object'
        ? (body.variables as Record<string, unknown>)
        : {};

    const [clientMetaEntry, configEntry] = await Promise.all([
      db.syncEntry.findUnique({ where: { key: CLIENT_META_KEY } }),
      db.syncEntry.findUnique({ where: { key: WHATSAPP_CONFIG_KEY } }),
    ]);

    const configValue = configEntry?.value && typeof configEntry.value === 'object'
      ? (configEntry.value as Record<string, unknown>)
      : {};
    const connection = configValue.connection && typeof configValue.connection === 'object'
      ? (configValue.connection as Record<string, unknown>)
      : {};
    const countryCode = normalizeCountryCode(connection.countryCode, '54');

    const destinatarios = normalizeRecipients(body.destinatarios, countryCode);

    if (destinatarios.length === 0 || !mensaje) {
      return NextResponse.json({ error: 'Faltan destinatarios o mensaje' }, { status: 400 });
    }

    const clientMetaById =
      clientMetaEntry?.value && typeof clientMetaEntry.value === 'object'
        ? (clientMetaEntry.value as Record<string, unknown>)
        : {};

    const results = [];

    for (const dest of destinatarios) {
      const renderedMessage = renderTemplate(mensaje, {
        ...globalVariables,
        ...dest.variables,
      });

      try {
        const destinationPhone = await resolveRecipientPhone(dest, { clientMetaById, countryCode });

        if (!destinationPhone) {
          throw new Error(`El destinatario ${dest.label} no tiene telefono valido`);
        }

        const sendResult = await sendWhatsAppText(renderedMessage, destinationPhone || undefined, {
          forceTemplate: true,
          preferPersonalizedFollowUpText: mode !== 'automatico',
        });

        // Log en SyncEntry
        await db.syncEntry.create({
          data: {
            key: `whatsapp-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            value: {
              destinatario: dest.label,
              destinatarioId: dest.id,
              destinatarioTipo: dest.tipo,
              plantilla: mensaje,
              mensaje: renderedMessage,
              tipo,
              subcategoria,
              mode,
              estado: 'enviado',
              payloadType: sendResult.payloadType,
              providerMessageId: sendResult.providerMessageId,
              telefonoDestino: destinationPhone || null,
              triggeredBy: (session.user as any)?.email || 'admin',
              fecha: new Date().toISOString(),
            },
          },
        });

        results.push({ dest: dest.label, ok: true });
      } catch (err) {
        const errorMessage = (err as Error).message;

        await db.syncEntry.create({
          data: {
            key: `whatsapp-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            value: {
              destinatario: dest.label,
              destinatarioId: dest.id,
              destinatarioTipo: dest.tipo,
              plantilla: mensaje,
              mensaje: renderedMessage,
              tipo,
              subcategoria,
              mode,
              estado: 'error',
              telefonoDestino: null,
              error: errorMessage,
              triggeredBy: (session.user as any)?.email || 'admin',
              fecha: new Date().toISOString(),
            },
          },
        });

        results.push({ dest: dest.label, ok: false, error: errorMessage });
      }
    }

    const sentCount = results.filter((item) => item.ok).length;
    const failedCount = results.length - sentCount;

    return NextResponse.json({
      ok: failedCount === 0,
      sentCount,
      failedCount,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
