"use client";

/**
 * /alertas
 * Dashboard de avisos para el profe.
 * Muestra vencimientos, inactividad, alertas de salud, check-ins pendientes y mensajes.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { AlertItem, AlertasResponse } from "@/app/api/admin/alertas-profe/route";

// ── helpers ─────────────────────────────────────────────────────

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff < 7) return `hace ${diff}d`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

const NIVEL_DOT: Record<string, string> = {
  alta:  "bg-rose-500",
  media: "bg-amber-400",
  baja:  "bg-slate-500",
};

const TYPE_ICON: Record<string, string> = {
  vencimiento:        "💳",
  inactividad:        "😴",
  salud:              "🚨",
  "checkin-pendiente":"📝",
  mensaje:            "💬",
};

const TYPE_LABEL: Record<string, string> = {
  vencimiento:        "Vencimiento",
  inactividad:        "Inactividad",
  salud:              "Alerta salud",
  "checkin-pendiente":"Sin check-in",
  mensaje:            "Mensaje",
};

// ── sub-components ───────────────────────────────────────────────

function AlertCard({ item, onAction }: { item: AlertItem; onAction: (href: string) => void }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
        item.nivel === "alta"
          ? "border-rose-500/30 bg-rose-500/8"
          : item.nivel === "media"
          ? "border-amber-500/25 bg-amber-500/6"
          : "border-white/8 bg-white/[0.03]"
      }`}
    >
      {/* nivel dot */}
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${NIVEL_DOT[item.nivel]}`} />

      {/* content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-white/90 truncate">{item.alumnoNombre}</p>
          {item.fecha && (
            <span className="shrink-0 text-xs text-white/30">{timeAgo(item.fecha)}</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-white/50 leading-relaxed">{item.detalle}</p>
      </div>

      {/* action */}
      {item.href && (
        <button
          onClick={() => onAction(item.href!)}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:border-white/20 hover:text-white/90 transition-colors"
        >
          Ver →
        </button>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  emptyMsg,
  onAction,
  defaultOpen = true,
}: {
  title: string;
  icon: string;
  items: AlertItem[];
  emptyMsg: string;
  onAction: (href: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-bold text-white/80">{title}</span>
          {items.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              items.some((i) => i.nivel === "alta")
                ? "bg-rose-500/25 text-rose-300"
                : "bg-white/10 text-white/50"
            }`}>
              {items.length}
            </span>
          )}
        </div>
        <span className="text-white/30 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-white/8 px-5 py-4 space-y-2">
          {items.length === 0 ? (
            <p className="text-xs text-white/30 italic py-2">{emptyMsg}</p>
          ) : (
            items.map((item, i) => (
              <AlertCard key={`${item.type}-${item.alumnoNombre}-${i}`} item={item} onAction={onAction} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────

export default function AlertasPage() {
  const router = useRouter();
  const [data,    setData]    = useState<AlertasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchAlertas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/alertas-profe");
      if (res.status === 401) { setError("No autorizado"); return; }
      if (!res.ok) { setError("Error al cargar alertas"); return; }
      const json = await res.json() as AlertasResponse;
      setData(json);
      setLastFetch(new Date());
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlertas(); }, [fetchAlertas]);

  const handleAction = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  // ── loading ─────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
          <p className="text-sm text-white/40">Calculando avisos…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-3xl">⚠️</p>
        <p className="text-sm text-white/50">{error}</p>
        <button onClick={fetchAlertas} className="text-xs text-cyan-400 underline">Reintentar</button>
      </div>
    );
  }

  const urgente  = data?.urgente ?? 0;
  const total    = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">🔔 Avisos</h1>
          <p className="mt-0.5 text-xs text-white/40">
            {total === 0 ? "Todo en orden" : `${total} aviso${total > 1 ? "s" : ""}${urgente > 0 ? ` · ${urgente} urgente${urgente > 1 ? "s" : ""}` : ""}`}
            {lastFetch && ` · Actualizado ${timeAgo(lastFetch.toISOString())}`}
          </p>
        </div>
        <button
          onClick={fetchAlertas}
          disabled={loading}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60 hover:border-white/20 hover:text-white transition-colors disabled:opacity-40"
        >
          {loading ? "…" : "↻ Actualizar"}
        </button>
      </div>

      {/* Summary chips */}
      {total > 0 && (
        <div className="flex flex-wrap gap-2">
          {urgente > 0 && (
            <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300">
              🔴 {urgente} urgente{urgente > 1 ? "s" : ""}
            </span>
          )}
          {(data?.vencimientos.length ?? 0) > 0 && (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-300">
              💳 {data!.vencimientos.length} vencimiento{data!.vencimientos.length > 1 ? "s" : ""}
            </span>
          )}
          {(data?.inactivos.length ?? 0) > 0 && (
            <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs text-slate-300">
              😴 {data!.inactivos.length} inactivo{data!.inactivos.length > 1 ? "s" : ""}
            </span>
          )}
          {(data?.mensajes.length ?? 0) > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">
              💬 {data!.mensajes.length} mensaje{data!.mensajes.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
        <div className="flex flex-col items-center gap-4 py-16">
          <span className="text-5xl">✅</span>
          <p className="text-base font-semibold text-white/70">Todo en orden</p>
          <p className="text-sm text-white/30 text-center max-w-xs">
            No hay vencimientos próximos, alumnos inactivos ni alertas de salud por ahora.
          </p>
        </div>
      )}

      {/* Sections — ordered by urgency */}
      {(data?.salud.length ?? 0) > 0 && (
        <Section
          title="Alertas de salud"
          icon="🚨"
          items={data!.salud}
          emptyMsg="Sin alertas de salud"
          onAction={handleAction}
          defaultOpen
        />
      )}

      {(data?.mensajes.length ?? 0) > 0 && (
        <Section
          title="Mensajes sin leer"
          icon="💬"
          items={data!.mensajes}
          emptyMsg="Sin mensajes pendientes"
          onAction={handleAction}
          defaultOpen
        />
      )}

      <Section
        title="Vencimientos próximos"
        icon="💳"
        items={data?.vencimientos ?? []}
        emptyMsg="Sin vencimientos en los próximos 7 días ✓"
        onAction={handleAction}
        defaultOpen={(data?.vencimientos.length ?? 0) > 0}
      />

      <Section
        title="Alumnos inactivos"
        icon="😴"
        items={data?.inactivos ?? []}
        emptyMsg="Todos los alumnos activos tienen actividad reciente ✓"
        onAction={handleAction}
        defaultOpen={(data?.inactivos.length ?? 0) > 0}
      />

      <Section
        title="Sin check-in esta semana"
        icon="📝"
        items={data?.sinCheckin ?? []}
        emptyMsg="Todos completaron el check-in esta semana ✓"
        onAction={handleAction}
        defaultOpen={false}
      />

    </div>
  );
}
