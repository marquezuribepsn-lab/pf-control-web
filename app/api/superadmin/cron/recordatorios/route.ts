import { NextResponse } from "next/server";
import { sendBulkVencimientoWarnings, sendProfesorNotification } from "@/lib/superadminNotify";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

// Leer configuración guardada en SyncEntry (con fallback a env/defaults)
async function readConfig() {
  try {
    const entries = await db.syncEntry.findMany({
      where: { key: { in: ["sa-config:diasGracia", "sa-config:cronChannels", "sa-config:diasUmbral", "sa-config:cronMensaje"] } },
      select: { key: true, value: true },
    });
    const cfg: Record<string, any> = {};
    for (const e of entries) cfg[e.key] = e.value;
    return {
      diasGracia:   Number(cfg["sa-config:diasGracia"]   ?? process.env.CRON_DIAS_GRACIA ?? 3),
      diasUmbral:   Number(cfg["sa-config:diasUmbral"]   ?? process.env.CRON_DIAS_UMBRAL ?? 7),
      cronChannels: String(cfg["sa-config:cronChannels"] ?? process.env.CRON_CHANNELS    ?? "email"),
    };
  } catch {
    return { diasGracia: 3, diasUmbral: 7, cronChannels: "email" };
  }
}

function isBySecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const bearer = req.headers.get("authorization") ?? "";
  if (bearer === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

async function isSuperAdmin(req: Request): Promise<boolean> {
  if (isBySecret(req)) return true;
  try {
    const session = await auth();
    return (session?.user as any)?.role === "SUPERADMIN";
  } catch {
    return false;
  }
}

// ─── Core logic ───────────────────────────────────────────────────────────────
async function runCron(opts: {
  diasUmbral: number;
  diasGracia: number;
  channels: ("email" | "whatsapp")[];
}) {
  const { diasUmbral, diasGracia, channels } = opts;
  const now = new Date();

  const profesores = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      email: true,
      nombreCompleto: true,
      telefono: true,
      subscription: {
        select: { id: true, estado: true, fechaVencimiento: true, planTipo: true },
      },
    },
  });

  // 1. Enviar avisos de vencimiento próximo
  const warnings = await sendBulkVencimientoWarnings(profesores, diasUmbral, channels);

  // 2. Auto-suspender los que ya vencieron y pasaron los días de gracia
  let suspended = 0;
  const suspendedList: string[] = [];

  for (const p of profesores) {
    const sub = p.subscription;
    if (!sub || sub.estado !== "activo" || !sub.fechaVencimiento) continue;

    const daysOverdue = Math.floor(
      (now.getTime() - new Date(sub.fechaVencimiento).getTime()) / 86400000
    );

    if (daysOverdue >= diasGracia) {
      try {
        await db.profesorSubscription.update({
          where: { id: sub.id },
          data: { estado: "vencido" },
        });
        suspended++;
        suspendedList.push(p.email);

        // Notificar al profesor que fue suspendido
        await sendProfesorNotification({
          type: "suscripcion_vencida",
          profesorEmail: p.email,
          profesorNombre: p.nombreCompleto,
          profesorTelefono: p.telefono,
          planTipo: sub.planTipo,
          channels,
        }).catch(() => {});

        await logAudit("cron_suspension", `Auto-suspendido por vencimiento (${daysOverdue}d de gracia)`, p.email);
      } catch {}
    }
  }

  const result = {
    timestamp: now.toISOString(),
    diasUmbral,
    diasGracia,
    channels,
    warnings,
    suspended,
    suspendedList,
  };

  // Guardar último run
  try {
    await db.syncEntry.upsert({
      where: { key: "sa-cron:last-run" },
      create: { key: "sa-cron:last-run", value: JSON.stringify(result) },
      update: { value: JSON.stringify(result) },
    });
  } catch {}

  return result;
}

// ─── GET: llamado por crontab del VPS ─────────────────────────────────────────
export async function GET(req: Request) {
  if (!isBySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url  = new URL(req.url);
  const cfg  = await readConfig();

  const diasUmbral = Number(url.searchParams.get("diasUmbral") ?? cfg.diasUmbral);
  const diasGracia = Number(url.searchParams.get("diasGracia") ?? cfg.diasGracia);
  const rawCh = (url.searchParams.get("channels") ?? cfg.cronChannels)
    .split(",")
    .map((c: string) => c.trim())
    .filter((c: string): c is "email" | "whatsapp" => c === "email" || c === "whatsapp");

  const result = await runCron({ diasUmbral, diasGracia, channels: rawCh });
  return NextResponse.json({ ok: true, ...result });
}

// ─── POST: trigger manual desde el panel ─────────────────────────────────────
export async function POST(req: Request) {
  if (!(await isSuperAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const cfg  = await readConfig();

  const diasUmbral = Number(body.diasUmbral ?? cfg.diasUmbral);
  const diasGracia = Number(body.diasGracia ?? cfg.diasGracia);
  const channels: ("email" | "whatsapp")[] = Array.isArray(body.channels)
    ? body.channels.filter((c: string) => c === "email" || c === "whatsapp")
    : cfg.cronChannels.split(",").filter((c: string): c is "email" | "whatsapp" => c === "email" || c === "whatsapp");

  const result = await runCron({ diasUmbral, diasGracia, channels });
  await logAudit("cron_manual", `Trigger manual · diasUmbral: ${diasUmbral} · diasGracia: ${diasGracia} · canales: ${channels.join(",")} · suspendidos: ${result.suspended} · avisos: ${result.warnings?.sent ?? 0}`);
  return NextResponse.json({ ok: true, ...result });
}
