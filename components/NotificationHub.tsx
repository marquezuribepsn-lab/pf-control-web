"use client";

/**
 * NotificationHub — centro de notificaciones del alumno.
 *
 * Campana con badge de no-leídas + panel deslizable que unifica en un solo
 * lugar todo lo que recibe el alumno:
 *   - "mensaje"      → mensajes del profe (reutiliza el chat pf-control-mensajes-v1)
 *   - "recordatorio" → recordatorios derivados (vencimiento de plan, etc.) pasados por prop
 *   - "novedad"      → novedades almacenadas por el coach (pf-control-notificaciones-v1)
 *
 * Lectura/no-leído + historial completo. Las novedades almacenadas guardan su
 * estado `leido` en el store compartido; el resto se marca leído localmente.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSharedState } from "@/components/useSharedState";
import type { ChatMessage } from "@/components/ChatPanel";

const NOTIFS_KEY = "pf-control-notificaciones-v1";
const MENSAJES_KEY = "pf-control-mensajes-v1";

export type NotifTipo = "novedad" | "recordatorio" | "mensaje";

/** Notificación almacenada por el coach (persistente, con estado leído propio). */
export type StoredNotif = {
  id: string;
  para: string; // clave/identidad del alumno destinatario
  tipo: NotifTipo;
  titulo: string;
  cuerpo: string;
  leido: boolean;
  createdAt: string; // ISO
  de?: string;
};

/** Notificación derivada en tiempo real (recordatorios/novedades calculadas). */
export type DerivedNotif = {
  id: string; // estable y determinista (ej. "venc:2026-12-31")
  tipo: NotifTipo;
  titulo: string;
  cuerpo: string;
  createdAt: string; // ISO
  de?: string;
};

type UnifiedNotif = {
  id: string;
  tipo: NotifTipo;
  titulo: string;
  cuerpo: string;
  createdAt: string;
  de?: string;
  leido: boolean;
  stored: boolean; // true → estado leído vive en el store compartido
};

type Props = {
  studentName: string;
  studentKey: string;
  derived?: DerivedNotif[];
};

const TIPO_META: Record<NotifTipo, { label: string; icon: string; color: string }> = {
  novedad: { label: "Novedad", icon: "✨", color: "#559df7" },
  recordatorio: { label: "Recordatorio", icon: "⏰", color: "#f59e0b" },
  mensaje: { label: "Mensaje", icon: "💬", color: "#38bdf8" },
};

function normalize(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  try {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

const STYLES = `
.pf-notif-root { position: relative; }
.pf-notif-bell {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; border-radius: 14px; cursor: pointer;
  border: 1px solid rgba(85, 157, 247,0.35);
  background: linear-gradient(135deg, rgba(58, 142, 237,0.22), rgba(20, 37, 55,0.55));
  color: #e9f3fe; transition: transform .12s ease, background .2s ease;
}
.pf-notif-bell:hover { background: linear-gradient(135deg, rgba(58, 142, 237,0.36), rgba(20, 37, 55,0.7)); }
.pf-notif-bell:active { transform: scale(0.94); }
.pf-notif-badge {
  position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 2px rgba(6, 13, 20,0.9);
}
.pf-notif-backdrop {
  position: fixed; inset: 0; z-index: 2147482000; background: rgba(2, 6, 10,0.55);
  backdrop-filter: blur(2px);
}
.pf-notif-panel {
  position: fixed; z-index: 2147482001; top: 0; right: 0; height: 100dvh; width: min(420px, 100vw);
  background: #0b1520; color: #e9f3fe; display: flex; flex-direction: column;
  border-left: 1px solid rgba(85, 157, 247,0.22); box-shadow: -20px 0 60px rgba(0,0,0,0.5);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  animation: pf-notif-slide .22s ease;
}
@keyframes pf-notif-slide { from { transform: translateX(100%); } to { transform: translateX(0); } }
.pf-notif-head { padding: 18px 18px 12px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.pf-notif-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pf-notif-title { font-size: 18px; font-weight: 900; margin: 0; }
.pf-notif-title small { display: block; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #8bc1fa; margin-bottom: 2px; }
.pf-notif-close { background: rgba(255,255,255,0.08); border: 0; color: #e9f3fe; width: 32px; height: 32px; border-radius: 10px; cursor: pointer; font-size: 16px; }
.pf-notif-close:hover { background: rgba(255,255,255,0.16); }
.pf-notif-actions { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pf-notif-markall { background: none; border: 0; color: #8bc1fa; font-size: 12px; font-weight: 700; cursor: pointer; padding: 4px 0; }
.pf-notif-markall:disabled { color: #6b7280; cursor: default; }
.pf-notif-tabs { display: flex; gap: 6px; padding: 12px 14px; overflow-x: auto; border-bottom: 1px solid rgba(255,255,255,0.06); }
.pf-notif-tab { flex: 0 0 auto; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #b8d5f5; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.pf-notif-tab.is-active { background: linear-gradient(135deg,#3a8eed,#559df7); color: #fff; border-color: transparent; }
.pf-notif-tab-count { margin-left: 6px; background: rgba(0,0,0,0.25); border-radius: 999px; padding: 0 6px; font-size: 10px; }
.pf-notif-list { flex: 1; overflow-y: auto; padding: 8px 12px 20px; }
.pf-notif-item { display: flex; gap: 12px; padding: 12px; border-radius: 14px; cursor: pointer; transition: background .15s ease; align-items: flex-start; }
.pf-notif-item:hover { background: rgba(255,255,255,0.05); }
.pf-notif-item.is-unread { background: rgba(58, 142, 237,0.1); }
.pf-notif-item.is-unread:hover { background: rgba(58, 142, 237,0.16); }
.pf-notif-ic { flex: 0 0 auto; width: 38px; height: 38px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; background: rgba(255,255,255,0.06); }
.pf-notif-body { min-width: 0; flex: 1; }
.pf-notif-body-top { display: flex; align-items: center; gap: 8px; }
.pf-notif-ntitle { font-size: 14px; font-weight: 800; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-notif-time { margin-left: auto; font-size: 11px; color: #9ca3af; flex: 0 0 auto; }
.pf-notif-text { margin: 3px 0 0; font-size: 13px; color: #bdcee0; line-height: 1.4; }
.pf-notif-text.is-collapsed { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pf-notif-dot { flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; background: #559df7; margin-top: 6px; }
.pf-notif-empty { text-align: center; padding: 60px 20px; color: #7f97b0; }
.pf-notif-empty .pf-notif-empty-emoji { font-size: 34px; }
.pf-notif-empty p { margin: 10px 0 0; font-size: 13px; }
`;

export default function NotificationHub({ studentName, studentKey, derived = [] }: Props) {
  const [stored, setStored] = useSharedState<StoredNotif[]>([], {
    key: NOTIFS_KEY,
    pollMs: 15000,
  });
  const [messages] = useSharedState<ChatMessage[]>([], {
    key: MENSAJES_KEY,
    pollMs: 15000,
  });

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"todas" | NotifTipo>("todas");
  const [mounted, setMounted] = useState(false);
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const readStorageKey = useRef<string>("");

  // Local read-set for derived/message notifs (device-local, per student).
  useEffect(() => {
    setMounted(true);
    readStorageKey.current = `pf-control-notif-read-${normalize(studentKey || studentName)}`;
    try {
      const raw = localStorage.getItem(readStorageKey.current);
      if (raw) setLocalRead(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, [studentKey, studentName]);

  const persistLocalRead = useCallback((next: Set<string>) => {
    setLocalRead(new Set(next));
    try {
      localStorage.setItem(readStorageKey.current, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }, []);

  const matchesStudent = useCallback(
    (target: string) => {
      const t = normalize(target);
      return !t || t === normalize(studentName) || t === normalize(studentKey);
    },
    [studentName, studentKey]
  );

  const unified = useMemo<UnifiedNotif[]>(() => {
    if (!mounted) return [];
    const out: UnifiedNotif[] = [];

    // Novedades/recordatorios/mensajes almacenados por el coach para este alumno.
    stored
      .filter((n) => matchesStudent(n.para))
      .forEach((n) =>
        out.push({
          id: n.id,
          tipo: n.tipo,
          titulo: n.titulo,
          cuerpo: n.cuerpo,
          createdAt: n.createdAt,
          de: n.de,
          leido: Boolean(n.leido),
          stored: true,
        })
      );

    // Mensajes del profe desde el chat existente.
    messages
      .filter((m) => m.deRole === "profe" && matchesStudent(m.para))
      .forEach((m) =>
        out.push({
          id: `msg:${m.id}`,
          tipo: "mensaje",
          titulo: `Mensaje de ${m.de || "tu profe"}`,
          cuerpo: m.texto,
          createdAt: m.createdAt,
          de: m.de,
          leido: Boolean(m.leido) || localRead.has(`msg:${m.id}`),
          stored: false,
        })
      );

    // Recordatorios/novedades derivadas (pasadas por prop).
    derived.forEach((d) =>
      out.push({
        id: d.id,
        tipo: d.tipo,
        titulo: d.titulo,
        cuerpo: d.cuerpo,
        createdAt: d.createdAt,
        de: d.de,
        leido: localRead.has(d.id),
        stored: false,
      })
    );

    // Dedupe por id, orden por fecha desc.
    const seen = new Set<string>();
    return out
      .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [mounted, stored, messages, derived, localRead, matchesStudent]);

  const unreadCount = useMemo(() => unified.filter((n) => !n.leido).length, [unified]);

  const counts = useMemo(
    () => ({
      todas: unified.length,
      novedad: unified.filter((n) => n.tipo === "novedad").length,
      recordatorio: unified.filter((n) => n.tipo === "recordatorio").length,
      mensaje: unified.filter((n) => n.tipo === "mensaje").length,
    }),
    [unified]
  );

  const visible = useMemo(
    () => (tab === "todas" ? unified : unified.filter((n) => n.tipo === tab)),
    [unified, tab]
  );

  const markRead = useCallback(
    (n: UnifiedNotif) => {
      if (n.leido) return;
      if (n.stored) {
        setStored((prev) => prev.map((s) => (s.id === n.id ? { ...s, leido: true } : s)));
      } else {
        const next = new Set(localRead);
        next.add(n.id);
        persistLocalRead(next);
      }
    },
    [setStored, localRead, persistLocalRead]
  );

  const markAll = useCallback(() => {
    setStored((prev) =>
      prev.map((s) => (matchesStudent(s.para) && !s.leido ? { ...s, leido: true } : s))
    );
    const next = new Set(localRead);
    unified.forEach((n) => {
      if (!n.stored) next.add(n.id);
    });
    persistLocalRead(next);
  }, [setStored, matchesStudent, localRead, unified, persistLocalRead]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const showBadge = mounted && unreadCount > 0;

  const tabList: Array<{ id: "todas" | NotifTipo; label: string; count: number }> = [
    { id: "todas", label: "Todas", count: counts.todas },
    { id: "novedad", label: "Novedades", count: counts.novedad },
    { id: "recordatorio", label: "Recordatorios", count: counts.recordatorio },
    { id: "mensaje", label: "Mensajes", count: counts.mensaje },
  ];

  return (
    <div className="pf-notif-root">
      <style>{STYLES}</style>

      <button
        type="button"
        className="pf-notif-bell"
        onClick={() => setOpen(true)}
        aria-label={`Notificaciones${showBadge ? ` (${unreadCount} sin leer)` : ""}`}
      >
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {showBadge && <span className="pf-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <>
          <div className="pf-notif-backdrop" onClick={() => setOpen(false)} />
          <aside className="pf-notif-panel" role="dialog" aria-modal="true" aria-label="Notificaciones">
            <div className="pf-notif-head">
              <div className="pf-notif-head-row">
                <h2 className="pf-notif-title">
                  <small>Tu hub</small>
                  Notificaciones
                </h2>
                <button type="button" className="pf-notif-close" onClick={() => setOpen(false)} aria-label="Cerrar">
                  ✕
                </button>
              </div>
              <div className="pf-notif-actions">
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}
                </span>
                <button type="button" className="pf-notif-markall" onClick={markAll} disabled={unreadCount === 0}>
                  Marcar todas como leídas
                </button>
              </div>
            </div>

            <div className="pf-notif-tabs">
              {tabList.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`pf-notif-tab${tab === t.id ? " is-active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.count > 0 && <span className="pf-notif-tab-count">{t.count}</span>}
                </button>
              ))}
            </div>

            <div className="pf-notif-list">
              {visible.length === 0 ? (
                <div className="pf-notif-empty">
                  <div className="pf-notif-empty-emoji">🔔</div>
                  <p>No hay notificaciones acá.</p>
                </div>
              ) : (
                visible.map((n) => {
                  const meta = TIPO_META[n.tipo];
                  const isExpanded = expanded === n.id;
                  return (
                    <div
                      key={n.id}
                      className={`pf-notif-item${n.leido ? "" : " is-unread"}`}
                      onClick={() => {
                        markRead(n);
                        setExpanded(isExpanded ? null : n.id);
                      }}
                    >
                      <span className="pf-notif-ic" style={{ color: meta.color }}>
                        {meta.icon}
                      </span>
                      <div className="pf-notif-body">
                        <div className="pf-notif-body-top">
                          <p className="pf-notif-ntitle">{n.titulo}</p>
                          <span className="pf-notif-time">{relativeTime(n.createdAt)}</span>
                        </div>
                        <p className={`pf-notif-text${isExpanded ? "" : " is-collapsed"}`}>{n.cuerpo}</p>
                      </div>
                      {!n.leido && <span className="pf-notif-dot" />}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
