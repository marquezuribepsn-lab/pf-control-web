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
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-black text-white">💬 Mensajes</h1>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Alumno list */}
        <div className="w-full md:w-72 shrink-0 space-y-2">
          {!alumnosLoaded && (
            <p className="text-sm text-slate-400">Cargando alumnos...</p>
          )}
          {alumnosLoaded && alumnos.length === 0 && (
            <p className="text-sm text-slate-400">No tenés alumnos registrados.</p>
          )}
          {alumnoSummaries.map(({ alumno, lastMsg, unread }) => {
            const isActive = selectedAlumno === alumno.nombre;
            return (
              <button
                key={alumno.nombre}
                type="button"
                onClick={() => setSelectedAlumno(alumno.nombre)}
                className={`w-full rounded-[1rem] border p-3 text-left transition-colors ${
                  isActive
                    ? "border-cyan-500/60 bg-cyan-600/15"
                    : "border-white/10 bg-slate-900/60 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white truncate">{alumno.nombre}</span>
                  {unread > 0 && (
                    <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                      {unread}
                    </span>
                  )}
                </div>
                {lastMsg ? (
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {lastMsg.de === myName ? "Vos: " : ""}{lastMsg.texto}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Sin mensajes aún</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Chat area */}
        <div className="flex-1">
          {selectedAlumno ? (
            <ChatPanel
              myName={myName}
              myRole="profe"
              otherName={selectedAlumno}
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-[1.2rem] border border-white/10 bg-[#080a0b]">
              <p className="text-sm text-slate-400">
                Seleccioná un alumno para ver la conversación 👈
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
