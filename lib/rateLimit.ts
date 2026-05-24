/**
 * rateLimit.ts — In-memory rate limiter (sin dependencias externas)
 *
 * Uso:
 *   const ok = rateLimit(ip, "login", { max: 10, windowMs: 60_000 })
 *   if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
 */

interface Bucket {
  count: number;
  resetAt: number;
}

// Map global: `${key}:${ip}` → Bucket
const store = new Map<string, Bucket>();

// Limpiar entradas vencidas cada 5 minutos
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }, 5 * 60 * 1000);
}

export function rateLimit(
  ip: string,
  key: string,
  { max, windowMs }: { max: number; windowMs: number }
): boolean {
  const storeKey = `${key}:${ip}`;
  const now = Date.now();
  const bucket = store.get(storeKey);

  if (!bucket || bucket.resetAt < now) {
    store.set(storeKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

/** Extrae IP real considerando proxy/nginx */
export function getIP(req: Request): string {
  const headers = (req as any).headers;
  return (
    headers.get?.("x-real-ip") ??
    headers.get?.("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
