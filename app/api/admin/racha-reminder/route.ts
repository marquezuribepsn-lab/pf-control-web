/**
 * POST /api/admin/racha-reminder
 *
 * Recorre a los alumnos, calcula la racha de cada uno del lado del servidor y
 * manda un push personal a los que estan en riesgo, congelados o acaban de
 * perderla. Los avisos in-app ya existen en la campanita, pero solo se ven al
 * abrir la app; esto es lo que llega con la app cerrada.
 *
 * Lee:
 *   - pf-control-alumno-entrenamiento-completados-v1 → entrenamientos hechos
 *   - pf-control-semana-plan                         → dias de plan por alumno
 *   - pf-control-clientes-meta-v1                    → email de cada alumno
 *
 * Se limita a una corrida por dia salvo `force: true`, para que un cron que
 * dispare de mas no bombardee a nadie.
 *
 * Auth: CRON_SECRET (bearer o ?secret=) o sesion de ADMIN/SUPERADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";
import { sendPushNotificationToUser } from "@/lib/pushNotifications";
import { calcularRacha } from "@/lib/racha";

const COMPLETIONS_KEY = "pf-control-alumno-entrenamiento-completados-v1";
const WEEK_PLAN_KEY = "pf-control-semana-plan";
const CLIENTES_META_KEY = "pf-control-clientes-meta-v1";
const LAST_RUN_KEY = "pf-control-racha-reminder-last-run-v1";

type Completion = {
  fecha?: string;
  alumnoNombre?: string;
  alumnoEmail?: string;
};

function isAdmin(session: unknown): boolean {
  const role = String(
    (session as { user?: { role?: string } } | null)?.user?.role || ""
  ).toUpperCase();
  return role === "ADMIN" || role === "SUPERADMIN";
}

function isByCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

function normalizar(valor: string): string {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dias de entrenamiento cargados en la primera semana del plan del alumno. */
function diasDePlan(planStore: unknown, nombre: string, email: string): number {
  const planes = (planStore as { planes?: unknown[] } | null)?.planes;
  if (!Array.isArray(planes)) return 3;

  const objetivoNombre = normalizar(nombre);
  const objetivoEmail = String(email || "").trim().toLowerCase();

  for (const entry of planes) {
    const plan = entry as { ownerKey?: string; nombre?: string; semanas?: unknown[] };
    const owner = normalizar(String(plan?.ownerKey || "").split(":").pop() || "");
    const planNombre = normalizar(String(plan?.nombre || ""));
    const coincide =
      (objetivoNombre && (owner === objetivoNombre || planNombre === objetivoNombre)) ||
      (objetivoEmail && normalizar(objetivoEmail) === planNombre);

    if (!coincide) continue;

    const semanas = Array.isArray(plan?.semanas) ? plan.semanas : [];
    const primera = semanas[0] as { dias?: unknown[] } | undefined;
    const dias = Array.isArray(primera?.dias)
      ? primera.dias.filter((d) => !(d as { oculto?: boolean })?.oculto)
      : [];
    if (dias.length > 0) return dias.length;
  }

  return 3;
}

export async function POST(req: NextRequest) {
  if (!isByCronSecret(req)) {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let body: { force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* sin body */
  }

  const hoyKey = new Date().toISOString().slice(0, 10);
  if (!body.force) {
    const ultima = String((await getSyncValue(LAST_RUN_KEY)) || "");
    if (ultima === hoyKey) {
      return NextResponse.json({ ok: true, skipped: "ya corrio hoy" });
    }
  }

  const completionsRaw = await getSyncValue(COMPLETIONS_KEY);
  const completions: Completion[] = Array.isArray(completionsRaw) ? completionsRaw : [];
  const planStore = await getSyncValue(WEEK_PLAN_KEY);
  const metaRaw = (await getSyncValue(CLIENTES_META_KEY)) as Record<
    string,
    { email?: string; nombre?: string }
  > | null;

  // Se agrupan los entrenamientos por alumno. Los registros sin identidad se
  // ignoran: son anteriores al cambio que la agrega y no se le pueden
  // atribuir a nadie sin mezclar alumnos.
  const porAlumno = new Map<string, { nombre: string; email: string; fechas: string[] }>();
  for (const item of completions) {
    const email = String(item?.alumnoEmail || "").trim().toLowerCase();
    const nombre = String(item?.alumnoNombre || "").trim();
    const fecha = String(item?.fecha || "").trim();
    if (!fecha || (!email && !nombre)) continue;

    const clave = email || normalizar(nombre);
    const actual = porAlumno.get(clave) || { nombre, email, fechas: [] };
    actual.fechas.push(fecha);
    if (!actual.email && email) actual.email = email;
    if (!actual.nombre && nombre) actual.nombre = nombre;
    porAlumno.set(clave, actual);
  }

  // Email de respaldo desde la ficha del cliente, por si el registro no lo trae.
  const emailPorNombre = new Map<string, string>();
  for (const meta of Object.values(metaRaw || {})) {
    const nombre = normalizar(String(meta?.nombre || ""));
    const email = String(meta?.email || "").trim().toLowerCase();
    if (nombre && email) emailPorNombre.set(nombre, email);
  }

  const enviados: Array<{ alumno: string; estado: string; dispositivos: number }> = [];

  for (const [, alumno] of porAlumno) {
    const email = alumno.email || emailPorNombre.get(normalizar(alumno.nombre)) || "";
    if (!email) continue;

    const dias = diasDePlan(planStore, alumno.nombre, email);
    const racha = calcularRacha(alumno.fechas, dias);

    let titulo = "";
    let cuerpo = "";

    if (racha.estado === "congelada") {
      titulo = `Tu racha de ${racha.dias} está congelada 🧊`;
      cuerpo =
        racha.diasParaPerderla > 0
          ? `Entrená hoy y la recuperás. Te quedan ${racha.diasParaPerderla} ${racha.diasParaPerderla === 1 ? "día" : "días"}.`
          : "Entrená hoy para recuperarla antes de que vuelva a cero.";
    } else if (
      racha.estado === "perdida" &&
      racha.diasDesdeUltimo !== null &&
      racha.diasDesdeUltimo <= racha.margenDias * 2 + 1
    ) {
      // Solo el dia siguiente a perderla: despues deja de tener sentido.
      titulo = "Perdiste tu racha 💔";
      cuerpo = "Pasaron demasiados días sin entrenar. Arrancá una nueva hoy mismo.";
    } else if (
      racha.estado === "activa" &&
      racha.diasDesdeUltimo !== null &&
      racha.diasDesdeUltimo >= racha.margenDias
    ) {
      titulo = "No pierdas tu racha 🔥";
      cuerpo = `Llevás ${racha.dias} ${racha.dias === 1 ? "entrenamiento" : "entrenamientos"} seguidos. Entrená hoy para mantenerla.`;
    }

    if (!titulo) continue;

    const dispositivos = await sendPushNotificationToUser(email, {
      title: titulo,
      body: cuerpo,
      tag: "pf-racha",
      url: "/alumnos/inicio",
      at: new Date().toISOString(),
    });

    enviados.push({ alumno: alumno.nombre || email, estado: racha.estado, dispositivos });
  }

  await setSyncValue(LAST_RUN_KEY, hoyKey);

  return NextResponse.json({
    ok: true,
    alumnosEvaluados: porAlumno.size,
    avisosEnviados: enviados.length,
    detalle: enviados,
  });
}
