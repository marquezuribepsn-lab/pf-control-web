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

const TYPE_ICON: Record<string, string> = {
  vencimiento:        "💳",
  inactividad:        "😴",
  salud:              "🚨",
  "checkin-pendiente":"📝",
  mensaje:            "💬",
};

// ── sub-components ───────────────────────────────────────────────

function AlertCard({ item, onAction }: { item: AlertItem; onAction: (href: string) => void }) {
  return (
    <div className="pf-v2-alert-row" data-nivel={item.nivel}>
      <span className="pf-v2-alert-dot" aria-hidden="true" />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span className="pf-v2-alert-name">{item.alumnoNombre}</span>
          {item.fecha ? <span className="pf-v2-alert-when">{timeAgo(item.fecha)}</span> : null}
        </div>
        <span className="pf-v2-alert-detail">{item.detalle}</span>
      </div>

      {item.href ? (
        <button
          type="button"
          onClick={() => onAction(item.href!)}
          className="pf-v2-btn pf-v2-btn-2"
          style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }}
        >
          Ver →
        </button>
      ) : null}
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
  const hayUrgentes = items.some((i) => i.nivel === "alta");

  return (
    <section className="pf-v2-fold">
      <button type="button" onClick={() => setOpen((v) => !v)} className="pf-v2-fold-head" aria-expanded={open}>
        <span className="pf-v2-fold-title">
          <span aria-hidden="true">{icon}</span>
          {title}
          {items.length > 0 ? (
            <span className={`pf-v2-chip ${hayUrgentes ? "pf-v2-chip-danger" : ""}`}>{items.length}</span>
          ) : null}
        </span>
        <span className="pf-v2-fold-caret" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="pf-v2-fold-body">
          {items.length === 0 ? (
            <p className="pf-v2-muted" style={{ margin: 0 }}>{emptyMsg}</p>
          ) : (
            items.map((item, i) => (
              <AlertCard key={`${item.type}-${item.alumnoNombre}-${i}`} item={item} onAction={onAction} />
            ))
          )}
        </div>
      ) : null}
    </section>
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

  if (loading && !data) {
    return (
      <div className="pf-v2-page">
        <div className="pf-v2-empty">
          <span className="pf-v2-spinner" aria-hidden="true" />
          <p className="pf-v2-muted" style={{ margin: 0 }}>Calculando avisos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pf-v2-page">
        <div className="pf-v2-empty">
          <span className="pf-v2-empty-mark" style={{ background: "rgba(248,113,113,0.12)", color: "var(--v2-danger)", boxShadow: "0 0 26px rgba(248,113,113,0.22)" }} aria-hidden="true">!</span>
          <p className="pf-v2-muted" style={{ margin: 0 }}>{error}</p>
          <button type="button" onClick={fetchAlertas} className="pf-v2-btn pf-v2-btn-2">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const urgente  = data?.urgente ?? 0;
  const total    = data?.total ?? 0;

  return (
    <div className="pf-v2-page" style={{ maxWidth: 860 }}>
      <header className="pf-v2-page-head">
        <div>
          <h1 className="pf-v2-title">Avisos</h1>
        </div>
        <button type="button" onClick={fetchAlertas} disabled={loading} className="pf-v2-btn pf-v2-btn-2">
          {loading ? "Actualizando..." : "↻ Actualizar"}
        </button>
      </header>

      {total > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {urgente > 0 ? (
            <span className="pf-v2-chip pf-v2-chip-danger">
              {urgente} urgente{urgente > 1 ? "s" : ""}
            </span>
          ) : null}
          {(data?.vencimientos.length ?? 0) > 0 ? (
            <span className="pf-v2-chip pf-v2-chip-warn">
              {data!.vencimientos.length} vencimiento{data!.vencimientos.length > 1 ? "s" : ""}
            </span>
          ) : null}
          {(data?.inactivos.length ?? 0) > 0 ? (
            <span className="pf-v2-chip">
              {data!.inactivos.length} inactivo{data!.inactivos.length > 1 ? "s" : ""}
            </span>
          ) : null}
          {(data?.mensajes.length ?? 0) > 0 ? (
            <span className="pf-v2-chip pf-v2-chip-ok">
              {data!.mensajes.length} mensaje{data!.mensajes.length > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {total === 0 ? (
        <div className="pf-v2-empty">
          <span className="pf-v2-empty-mark" aria-hidden="true">✓</span>
          <h2 className="pf-v2-h2">Todo en orden</h2>
          <p className="pf-v2-muted" style={{ maxWidth: 340, margin: 0 }}>
            No hay vencimientos próximos, alumnos inactivos ni alertas de salud por ahora.
          </p>
        </div>
      ) : null}

      {(data?.salud.length ?? 0) > 0 ? (
        <Section
          title="Alertas de salud"
          icon={TYPE_ICON.salud}
          items={data!.salud}
          emptyMsg="Sin alertas de salud"
          onAction={handleAction}
          defaultOpen
        />
      ) : null}

      {(data?.mensajes.length ?? 0) > 0 ? (
        <Section
          title="Mensajes sin leer"
          icon={TYPE_ICON.mensaje}
          items={data!.mensajes}
          emptyMsg="Sin mensajes pendientes"
          onAction={handleAction}
          defaultOpen
        />
      ) : null}

      <Section
        title="Vencimientos próximos"
        icon={TYPE_ICON.vencimiento}
        items={data?.vencimientos ?? []}
        emptyMsg="Sin vencimientos en los próximos 7 días."
        onAction={handleAction}
        defaultOpen={(data?.vencimientos.length ?? 0) > 0}
      />

      <Section
        title="Alumnos inactivos"
        icon={TYPE_ICON.inactividad}
        items={data?.inactivos ?? []}
        emptyMsg="Todos los alumnos activos tienen actividad reciente."
        onAction={handleAction}
        defaultOpen={(data?.inactivos.length ?? 0) > 0}
      />

      <Section
        title="Sin check-in esta semana"
        icon={TYPE_ICON["checkin-pendiente"]}
        items={data?.sinCheckin ?? []}
        emptyMsg="Todos completaron el check-in esta semana."
        onAction={handleAction}
        defaultOpen={false}
      />
    </div>
  );
}
