import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

type ExerciseRecord = {
  id: string;
  fecha: string;
  serie: number;
  repeticiones: number;
  carga: number;
  rir: number;
  molestia: number;
  comentario: string;
  videoUrl: string;
  thumbnailUrl: string;
  isPR: boolean;
  createdAt: string;
};

type StoredValue = {
  records: ExerciseRecord[];
};

function sanitizeExerciseKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function parseDateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeRecord(input: unknown): ExerciseRecord | null {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const fecha = parseDateOnly(record.fecha);
  const serie = Number(record.serie);
  const repeticiones = Number(record.repeticiones);
  const carga = Number(record.carga);
  const rir = Number(record.rir);
  const molestia = Number(record.molestia);
  const comentario = typeof record.comentario === "string" ? record.comentario.trim().slice(0, 500) : "";
  const videoUrl = typeof record.videoUrl === "string" ? record.videoUrl.trim().slice(0, 3_000_000) : "";
  const thumbnailUrl =
    typeof record.thumbnailUrl === "string" ? record.thumbnailUrl.trim().slice(0, 1_200_000) : "";

  const isAllowedVideoUrl =
    !videoUrl ||
    /^https?:\/\//i.test(videoUrl) ||
    /^data:video\/[a-z0-9.+-]+;base64,/i.test(videoUrl);

  const isAllowedThumbnailUrl =
    !thumbnailUrl ||
    /^https?:\/\//i.test(thumbnailUrl) ||
    /^data:image\/[a-z0-9.+-]+;base64,/i.test(thumbnailUrl);

  if (!fecha) return null;
  if (!Number.isFinite(serie) || serie < 1 || serie > 100) return null;
  if (!Number.isFinite(repeticiones) || repeticiones < 1 || repeticiones > 500) return null;
  if (!Number.isFinite(carga) || carga < 0 || carga > 5000) return null;
  if (!Number.isFinite(rir) || rir < 0 || rir > 10) return null;
  if (!Number.isFinite(molestia) || molestia < 0 || molestia > 10) return null;
  if (!isAllowedVideoUrl) return null;
  if (!isAllowedThumbnailUrl) return null;

  const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
  const id = typeof record.id === "string" && record.id.trim().length > 0 ? record.id.trim() : `${Date.now()}`;

  return {
    id,
    fecha,
    serie,
    repeticiones,
    carga,
    rir,
    molestia,
    comentario,
    videoUrl,
    thumbnailUrl,
    isPR: Boolean(record.isPR),
    createdAt,
  };
}

function recalculatePR(records: ExerciseRecord[]): ExerciseRecord[] {
  const sortedAsc = [...records].sort(
    (a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt))
  );

  let best = -Infinity;
  const mapped = sortedAsc.map((item) => {
    const isPR = item.carga > best;
    if (item.carga > best) {
      best = item.carga;
    }
    return { ...item, isPR };
  });

  return mapped.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
}

function buildStorageKey(userId: string, exerciseKey: string): string {
  return `alumno-exercise-records:${userId}:${exerciseKey}`;
}

async function getStoredRecords(storageKey: string): Promise<ExerciseRecord[]> {
  const entry = await db.syncEntry.findUnique({
    where: { key: storageKey },
    select: { value: true },
  });

  if (!entry?.value || typeof entry.value !== "object") {
    return [];
  }

  const value = entry.value as StoredValue;
  if (!Array.isArray(value.records)) {
    return [];
  }

  return value.records
    .map((item) => normalizeRecord(item))
    .filter((item): item is ExerciseRecord => Boolean(item))
    .sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
}

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const rawExercise = req.nextUrl.searchParams.get("exercise") || "generico";
  const exerciseKey = sanitizeExerciseKey(rawExercise);

  if (!exerciseKey) {
    return NextResponse.json({ message: "Exercise invalido" }, { status: 400 });
  }

  const storageKey = buildStorageKey(session.user.id, exerciseKey);
  const records = recalculatePR(await getStoredRecords(storageKey));

  return NextResponse.json({ ok: true, exerciseKey, records });
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const rawExercise = typeof payload?.exercise === "string" ? payload.exercise : "generico";
  const exerciseKey = sanitizeExerciseKey(rawExercise);

  if (!exerciseKey) {
    return NextResponse.json({ message: "Exercise invalido" }, { status: 400 });
  }

  const normalizedRecord = normalizeRecord(payload?.record);
  if (!normalizedRecord) {
    return NextResponse.json({ message: "Registro invalido" }, { status: 400 });
  }

  const storageKey = buildStorageKey(session.user.id, exerciseKey);
  const current = await getStoredRecords(storageKey);

  const merged = [normalizedRecord, ...current.filter((item) => item.id !== normalizedRecord.id)]
    .sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
    .slice(0, 400);
  const withPR = recalculatePR(merged);

  await db.syncEntry.upsert({
    where: { key: storageKey },
    create: {
      key: storageKey,
      value: { records: withPR },
    },
    update: {
      value: { records: withPR },
    },
  });

  return NextResponse.json({ ok: true, exerciseKey, records: withPR }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const rawExercise = typeof payload?.exercise === "string" ? payload.exercise : "generico";
  const exerciseKey = sanitizeExerciseKey(rawExercise);

  if (!exerciseKey) {
    return NextResponse.json({ message: "Exercise invalido" }, { status: 400 });
  }

  const recordId = typeof payload?.recordId === "string" ? payload.recordId.trim() : "";
  if (!recordId) {
    return NextResponse.json({ message: "recordId requerido" }, { status: 400 });
  }

  const normalizedRecord = normalizeRecord(payload?.record);
  if (!normalizedRecord) {
    return NextResponse.json({ message: "Registro invalido" }, { status: 400 });
  }

  const storageKey = buildStorageKey(session.user.id, exerciseKey);
  const current = await getStoredRecords(storageKey);
  if (!current.some((item) => item.id === recordId)) {
    return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
  }

  const merged = current.map((item) => (item.id === recordId ? { ...normalizedRecord, id: recordId } : item));
  const withPR = recalculatePR(merged);

  await db.syncEntry.upsert({
    where: { key: storageKey },
    create: {
      key: storageKey,
      value: { records: withPR },
    },
    update: {
      value: { records: withPR },
    },
  });

  return NextResponse.json({ ok: true, exerciseKey, records: withPR });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const rawExercise = typeof payload?.exercise === "string" ? payload.exercise : "generico";
  const exerciseKey = sanitizeExerciseKey(rawExercise);

  if (!exerciseKey) {
    return NextResponse.json({ message: "Exercise invalido" }, { status: 400 });
  }

  const recordId = typeof payload?.recordId === "string" ? payload.recordId.trim() : "";
  if (!recordId) {
    return NextResponse.json({ message: "recordId requerido" }, { status: 400 });
  }

  const storageKey = buildStorageKey(session.user.id, exerciseKey);
  const current = await getStoredRecords(storageKey);
  const filtered = current.filter((item) => item.id !== recordId);
  const withPR = recalculatePR(filtered);

  await db.syncEntry.upsert({
    where: { key: storageKey },
    create: {
      key: storageKey,
      value: { records: withPR },
    },
    update: {
      value: { records: withPR },
    },
  });

  return NextResponse.json({ ok: true, exerciseKey, records: withPR });
}
