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

const TIPO_META: Record<NotifTipo, { label: string; icon: string; color: string; iconBg: string }> = {
  novedad: { label: "Novedad", icon: "✨", color: "#75a1d7", iconBg: "rgba(56,189,248,0.14)" },
  recordatorio: { label: "Recordatorio", icon: "⏰", color: "#f59e0b", iconBg: "rgba(248,113,113,0.14)" },
  mensaje: { label: "Mensaje", icon: "💬", color: "#5eaed2", iconBg: "rgba(34,229,255,0.14)" },
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
/* Panel de notificaciones — diseño "PF Control v2 - Notificaciones".
   Es una tarjeta centrada de 420px, no el cajon lateral de altura completa
   que habia antes. */
.pf-notif-root { position: relative; }
.pf-notif-bell {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; border-radius: 14px; cursor: pointer;
  border: 1px solid rgba(117, 161, 215,0.35);
  background: linear-gradient(135deg, rgba(94, 144, 201,0.22), rgba(27, 37, 48,0.55));
  color: #edf3fa; transition: transform .12s ease, background .2s ease;
}
.pf-notif-bell:hover { background: linear-gradient(135deg, rgba(94, 144, 201,0.36), rgba(27, 37, 48,0.7)); }
.pf-notif-bell:active { transform: scale(0.94); }
.pf-notif-badge {
  position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 2px rgba(9, 13, 17,0.9);
}

/* El backdrop centra la tarjeta. */
.pf-notif-backdrop {
  position: fixed; inset: 0; z-index: 2147482000; background: rgba(2, 3, 4, 0.72);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
  opacity: 1; transition: opacity .18s ease;
}
.pf-notif-backdrop.pf-notif-closing { opacity: 0; }

/* Estado en reposo VISIBLE: la entrada es una transicion, no una animacion con
   fill-mode:both, que si no arranca deja el panel invisible. */
.pf-notif-panel {
  position: relative; z-index: 2147482001;
  /* 100% en vez de 94vw: el backdrop ya aporta 20px de padding a cada lado y
     con 94vw el panel se los comia, dejando el texto pegado al borde. */
  width: 420px; max-width: 100%; max-height: 86dvh;
  display: flex; flex-direction: column;
  background: #080a10; border: 1px solid rgba(56,189,248,0.14); border-radius: 22px;
  padding: 26px; color: #eef2f7;
  font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  opacity: 1; transform: translateY(0);
  transition: transform .3s cubic-bezier(0.16,1,0.3,1), opacity .22s ease;
}
.pf-notif-panel.pf-notif-closing { opacity: 0; transform: translateY(12px); }

.pf-notif-head { flex-shrink: 0; }
.pf-notif-head-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
.pf-notif-title { font-family: 'Space Grotesk', Inter, sans-serif; font-size: 26px; font-weight: 800; letter-spacing: -0.01em; margin: 0; }
.pf-notif-title small {
  display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: #38bdf8; margin-bottom: 6px; font-family: Inter, sans-serif;
}
.pf-notif-close {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; cursor: pointer;
  background: rgba(255,255,255,0.06); border: 0; color: #eef2f7;
  display: flex; align-items: center; justify-content: center;
  transition: transform .2s cubic-bezier(0.16,1,0.3,1), background .2s ease;
}
.pf-notif-close:hover { background: rgba(255,255,255,0.12); }
.pf-notif-close:active { transform: scale(0.96); }

.pf-notif-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.pf-notif-unread { font-size: 13.5px; color: rgba(226,232,240,0.45); }
.pf-notif-markall { background: none; border: 0; color: #22e5ff; font-size: 13px; font-weight: 700; cursor: pointer; padding: 0; }
.pf-notif-markall:disabled { color: rgba(226,232,240,0.3); cursor: default; }

.pf-notif-tabs {
  display: flex; gap: 8px; overflow-x: auto; flex-shrink: 0;
  padding-bottom: 14px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.07);
  scrollbar-width: none;
}
.pf-notif-tabs::-webkit-scrollbar { display: none; }
.pf-notif-tab {
  flex-shrink: 0; display: flex; align-items: center; gap: 7px;
  padding: 10px 18px; border-radius: 100px; border: 0; cursor: pointer;
  background: rgba(255,255,255,0.05); color: rgba(226,232,240,0.6);
  font-family: inherit; font-size: 13.5px; font-weight: 700; white-space: nowrap;
  transition: background .18s ease, color .18s ease;
}
.pf-notif-tab.is-active { background: #22e5ff; color: #00131a; }
.pf-notif-tab-count {
  min-width: 19px; height: 19px; padding: 0 5px; border-radius: 100px;
  background: rgba(255,255,255,0.1); color: #eef2f7;
  font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center;
}
.pf-notif-tab.is-active .pf-notif-tab-count { background: rgba(0,19,26,0.25); color: #00131a; }

.pf-notif-list {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 10px; padding-top: 14px;
}
.pf-notif-item {
  display: flex; gap: 14px; cursor: pointer;
  background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px; padding: 16px 18px;
  transition: background .15s ease, border-color .15s ease;
}
.pf-notif-item:hover { background: rgba(255,255,255,0.06); }
.pf-notif-item.is-unread { border-color: rgba(34,229,255,0.22); }
.pf-notif-ic {
  width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.pf-notif-body { flex: 1; min-width: 0; }
.pf-notif-body-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 4px; }
.pf-notif-ntitle { font-size: 14.5px; font-weight: 800; margin: 0; }
.pf-notif-meta { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
.pf-notif-time { font-size: 11.5px; color: rgba(226,232,240,0.4); }
.pf-notif-dot { width: 8px; height: 8px; border-radius: 50%; background: #22e5ff; box-shadow: 0 0 8px rgba(34,229,255,0.6); flex-shrink: 0; }
.pf-notif-text { font-size: 13px; color: rgba(226,232,240,0.55); line-height: 1.5; margin: 0; }
.pf-notif-text.is-collapsed { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pf-notif-empty { text-align: center; padding: 40px 0; font-size: 13.5px; color: rgba(226,232,240,0.4); }
.pf-notif-empty-emoji { font-size: 30px; margin-bottom: 10px; }
.pf-notif-empty p { margin: 0; }
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
  const [closing, setClosing] = useState(false);
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

  const closePanel = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

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
          {/* `data-open` es obligatorio: globals.css tiene un candado que deja
              invisible y sin eventos a cualquier [role="dialog"] o
              [aria-modal] dentro de .pf-training-shell que no lo declare.
              Sin esto el panel se montaba con opacity:0 y pointer-events:none,
              asi que la campana parecia no hacer nada. */}
          <div
            className={`pf-notif-backdrop${closing ? " pf-notif-closing" : ""}`}
            data-open="true"
            onClick={closePanel}
          >
          <aside
            className={`pf-notif-panel${closing ? " pf-notif-closing" : ""}`}
            data-open="true"
            role="dialog"
            aria-modal="true"
            aria-label="Notificaciones"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pf-notif-head">
              <div className="pf-notif-head-row">
                <h2 className="pf-notif-title">
                  <small>Tu hub</small>
                  Notificaciones
                </h2>
                <button type="button" className="pf-notif-close" onClick={closePanel} aria-label="Cerrar">
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="5" x2="15" y2="15" />
                    <line x1="15" y1="5" x2="5" y2="15" />
                  </svg>
                </button>
              </div>
              <div className="pf-notif-actions">
                <span className="pf-notif-unread">
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
                  <p>No hay notificaciones en esta categoría.</p>
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
                      <span className="pf-notif-ic" style={{ background: meta.iconBg }}>
                        {meta.icon}
                      </span>
                      <div className="pf-notif-body">
                        <div className="pf-notif-body-top">
                          <p className="pf-notif-ntitle">{n.titulo}</p>
                          <span className="pf-notif-meta">
                            <span className="pf-notif-time">{relativeTime(n.createdAt)}</span>
                            {!n.leido && <span className="pf-notif-dot" />}
                          </span>
                        </div>
                        <p className={`pf-notif-text${isExpanded ? "" : " is-collapsed"}`}>{n.cuerpo}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
          </div>
        </>
      )}
    </div>
  );
}
