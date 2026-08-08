"use client";

import ChatPanel, { type ChatMessage } from "@/components/ChatPanel";
import { useAlumnos } from "@/components/AlumnosProvider";
import { useSharedState } from "@/components/useSharedState";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

const MENSAJES_KEY = "pf-control-mensajes-v1";

export default function MensajesPage() {
  const { data: session } = useSession();
  const { alumnos, alumnosLoaded } = useAlumnos();
  const [allMessages] = useSharedState<ChatMessage[]>([], {
    key: MENSAJES_KEY,
    pollMs: 8000,
  });

  const [selectedAlumno, setSelectedAlumno] = useState<string | null>(null);

  const myName = (session?.user as { name?: string | null } | undefined)?.name ?? "profe";

  // Build per-alumno summaries
  const alumnoSummaries = useMemo(() => {
    const msgs = Array.isArray(allMessages) ? allMessages : [];
    return alumnos.map((alumno) => {
      const conversation = msgs.filter(
        (m) =>
          (m.de === myName && m.para === alumno.nombre) ||
          (m.de === alumno.nombre && m.para === myName)
      );
      const lastMsg = conversation[conversation.length - 1] ?? null;
      const unread = conversation.filter((m) => m.para === myName && !m.leido).length;
      return { alumno, lastMsg, unread };
    });
  }, [alumnos, allMessages, myName]);

  return (
    <div className="pf-v2-page" style={{ maxWidth: 1100 }}>
      <header className="pf-v2-page-head">
        <div>
          <h1 className="pf-v2-title">Mensajes</h1>
        </div>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {/* Lista de alumnos */}
        <div style={{ width: 320, flexShrink: 0, display: "grid", gap: 8, minWidth: 240 }}>
          {!alumnosLoaded ? (
            <p className="pf-v2-muted">Cargando alumnos...</p>
          ) : null}
          {alumnosLoaded && alumnos.length === 0 ? (
            <p className="pf-v2-muted">No tenés alumnos registrados.</p>
          ) : null}

          {alumnoSummaries.map(({ alumno, lastMsg, unread }) => (
            <button
              key={alumno.nombre}
              type="button"
              onClick={() => setSelectedAlumno(alumno.nombre)}
              className="pf-v2-option"
              aria-pressed={selectedAlumno === alumno.nombre}
              style={{ width: "100%" }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {alumno.nombre}
                </span>
                {unread > 0 ? <span className="pf-v2-nav-badge">{unread}</span> : null}
              </span>
              <span
                className="pf-v2-feed-meta"
                style={{ marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {lastMsg
                  ? `${lastMsg.de === myName ? "Vos: " : ""}${lastMsg.texto}`
                  : "Sin mensajes aún"}
              </span>
            </button>
          ))}
        </div>

        {/* Conversación */}
        <div style={{ flex: 1, minWidth: 280 }}>
          {selectedAlumno ? (
            <ChatPanel myName={myName} myRole="profe" otherName={selectedAlumno} />
          ) : (
            <div className="pf-v2-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 260 }}>
              <p className="pf-v2-muted" style={{ margin: 0 }}>
                Elegí un alumno para ver la conversación.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
