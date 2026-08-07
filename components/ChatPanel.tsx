"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";

const MENSAJES_KEY = "pf-control-mensajes-v1";

export type ChatMessage = {
  id: string;
  de: string;
  deRole: "profe" | "alumno";
  para: string;
  texto: string;
  createdAt: string;
  leido: boolean;
};

export type ChatPanelProps = {
  myName: string;
  myRole: "profe" | "alumno";
  otherName: string;
  compact?: boolean;
};

function formatTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

export default function ChatPanel({ myName, myRole, otherName, compact = false }: ChatPanelProps) {
  const [allMessages, setAllMessages, loaded] = useSharedState<ChatMessage[]>([], {
    key: MENSAJES_KEY,
    pollMs: 8000,
  });

  const [inputText, setInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter messages for this conversation (both directions)
  const messages = useMemo(() => {
    const base = Array.isArray(allMessages) ? allMessages : [];
    return base.filter(
      (m) =>
        (m.de === myName && m.para === otherName) ||
        (m.de === otherName && m.para === myName)
    );
  }, [allMessages, myName, otherName]);

  // Unread count: messages addressed to me that I haven't read
  const unreadCount = useMemo(() => {
    return messages.filter((m) => m.para === myName && !m.leido).length;
  }, [messages, myName]);

  // Mark incoming messages as read when viewed
  useEffect(() => {
    if (!loaded) return;
    const base = Array.isArray(allMessages) ? allMessages : [];
    const hasUnread = base.some(
      (m) => m.para === myName && !m.leido && (m.de === otherName)
    );
    if (!hasUnread) return;

    setAllMessages((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      return prevArr.map((m) => {
        if (m.para === myName && !m.leido && m.de === otherName) {
          return { ...m, leido: true };
        }
        return m;
      });
    });
    markManualSaveIntent(MENSAJES_KEY);
  }, [loaded, allMessages, myName, otherName]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function sendMessage() {
    const texto = inputText.trim();
    if (!texto || !myName) return;

    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      de: myName,
      deRole: myRole,
      para: otherName,
      texto,
      createdAt: new Date().toISOString(),
      leido: false,
    };

    setAllMessages((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      return [...prevArr, newMsg];
    });
    markManualSaveIntent(MENSAJES_KEY);
    setInputText("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const containerHeight = compact ? "h-72" : "h-[420px]";

  return (
    <div className="flex flex-col rounded-[1.2rem] border pf-v2-b pf-v2-s-deep overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b pf-v2-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-black pf-v2-t">
            💬 Chat con {otherName === "profe" ? "el profe" : otherName}
          </span>
          {unreadCount > 0 && (
            <span className="rounded-full pf-v2-s-danger px-2 py-0.5 text-xs font-bold pf-v2-t">
              {unreadCount}
            </span>
          )}
        </div>
        {!loaded && (
          <span className="text-xs pf-v2-t-50">Cargando...</span>
        )}
      </div>

      {/* Messages area */}
      <div className={`flex-1 overflow-y-auto px-4 py-3 ${containerHeight} space-y-2`}>
        {loaded && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm pf-v2-t-50">Empezá la conversación 💬</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.de === myName;
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm font-medium ${
                  isMe
                    ? "pf-v2-s-accent pf-v2-t rounded-br-sm"
                    : "pf-v2-s-deep pf-v2-t rounded-bl-sm"
                }`}
              >
                {msg.texto}
              </div>
              <span className="text-[10px] pf-v2-t-40 px-1">
                {isMe ? "Vos" : msg.de} · {formatTime(msg.createdAt)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t pf-v2-b px-3 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí un mensaje..."
            disabled={!myName}
            className="flex-1 rounded-xl border pf-v2-b pf-v2-s-deep px-3 py-2 text-sm pf-v2-t pf-v2-ph focus:outline-none "
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!inputText.trim() || !myName}
            className="rounded-xl pf-v2-s-accent-full px-4 py-2 text-sm font-bold pf-v2-t transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
