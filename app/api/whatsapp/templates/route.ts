import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import {
  DEFAULT_TEMPLATE_VARIABLE_KEYS,
  normalizeTemplateMessage,
} from "@/lib/whatsappTemplateVariables";

const TEMPLATES_KEY = "whatsapp-templates-v1";

type WhatsAppTemplate = {
  key: string;
  nombre: string;
  categoria: string;
  mensaje: string;
  createdAt: string;
  updatedAt: string;
};

const mkKey = () => `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function requireAdmin() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return false;
  }
  return true;
}

async function readTemplates(): Promise<WhatsAppTemplate[]> {
  const current = await getSyncValue(TEMPLATES_KEY);
  return Array.isArray(current) ? (current as WhatsAppTemplate[]) : [];
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const templates = await readTemplates();
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<WhatsAppTemplate>;
  const nombre = String(body.nombre || "").trim();
  const categoria = String(body.categoria || "General").trim();
  const mensajeRaw = String(body.mensaje || "").trim();

  if (!nombre || !mensajeRaw) {
    return NextResponse.json({ error: "nombre y mensaje son requeridos" }, { status: 400 });
  }

  const normalizedMessage = normalizeTemplateMessage(mensajeRaw, {
    allowedVariables: Array.from(DEFAULT_TEMPLATE_VARIABLE_KEYS),
  });
  const mensaje = normalizedMessage.message;

  const templates = await readTemplates();
  const now = new Date().toISOString();
  const template: WhatsAppTemplate = {
    key: mkKey(),
    nombre,
    categoria,
    mensaje,
    createdAt: now,
    updatedAt: now,
  };

  const next = [template, ...templates].slice(0, 500);
  await setSyncValue(TEMPLATES_KEY, next);

  return NextResponse.json({
    ok: true,
    template,
    validation: {
      changed: normalizedMessage.changed,
      unknownVariables: normalizedMessage.unknownVariables,
      missingRequiredVariables: normalizedMessage.missingRequiredVariables,
    },
  });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { key?: string };
  const key = String(body.key || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key requerido" }, { status: 400 });
  }

  const templates = await readTemplates();
  const next = templates.filter((item) => item.key !== key);
  await setSyncValue(TEMPLATES_KEY, next);

  return NextResponse.json({ ok: true, removed: templates.length - next.length });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<WhatsAppTemplate>;
  const key = String(body.key || "").trim();
  const nombre = String(body.nombre || "").trim();
  const categoria = String(body.categoria || "General").trim();
  const mensajeRaw = String(body.mensaje || "").trim();

  if (!key || !nombre || !mensajeRaw) {
    return NextResponse.json(
      { error: "key, nombre y mensaje son requeridos" },
      { status: 400 }
    );
  }

  const normalizedMessage = normalizeTemplateMessage(mensajeRaw, {
    allowedVariables: Array.from(DEFAULT_TEMPLATE_VARIABLE_KEYS),
  });
  const mensaje = normalizedMessage.message;

  const templates = await readTemplates();
  const index = templates.findIndex((item) => item.key === key);
  if (index === -1) {
    return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  }

  const updated: WhatsAppTemplate = {
    ...templates[index],
    nombre,
    categoria,
    mensaje,
    updatedAt: new Date().toISOString(),
  };

  const next = [...templates];
  next[index] = updated;
  await setSyncValue(TEMPLATES_KEY, next);

  return NextResponse.json({
    ok: true,
    template: updated,
    validation: {
      changed: normalizedMessage.changed,
      unknownVariables: normalizedMessage.unknownVariables,
      missingRequiredVariables: normalizedMessage.missingRequiredVariables,
    },
  });
}
