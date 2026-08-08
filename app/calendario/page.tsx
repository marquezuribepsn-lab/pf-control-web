"use client";

import { useAlumnos } from "@/components/AlumnosProvider";
import { useSharedState } from "@/components/useSharedState";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// ─── Sync keys ────────────────────────────────────────────────
const COMPLETIONS_KEY  = "pf-control-alumno-entrenamiento-completados-v1";
const WORKOUT_LOGS_KEY = "pf-control-alumno-workout-logs-v1";
const CLIENTES_META_KEY = "pf-control-clientes-meta-v1";
const CHECKIN_KEY      = "pf-control-checkin-semanal-v1";

// ─── Types ────────────────────────────────────────────────────
type CompletionItem = {
  alumnoNombre?: string;
  fecha?: string;
  completado?: boolean;
};

type WorkoutItem = {
  alumnoNombre?: string;
  fecha?: string;
  molestia?: boolean;
  ejercicioNombre?: string;
  series?: number;
  repeticiones?: number;
  pesoKg?: number;
};

type ClienteMeta = {
  endDate?: string;
  pagoEstado?: string;
};

type CheckinItem = {
  alumnoNombre?: string;
  semanaOf?: string;
  createdAt?: string;
};

// ─── Helpers ──────────────────────────────────────────────────
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseToKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  // Use UTC components to avoid timezone shifts when date-only strings are parsed
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw; // already YYYY-MM-DD
  }
  return toDateKey(d);
}

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Build a 6-row grid of day-cells for the given month
function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Monday = 0 ... Sunday = 6
  let startDow = firstDay.getDay() - 1; // JS: 0=Sun
  if (startDow < 0) startDow = 6;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

// ─── Event type indicator ─────────────────────────────────────
type EventKind = "completion" | "workout" | "expiry" | "checkin";
const EVENT_COLORS: Record<EventKind, string> = {
  completion: "pf-v2-s-ok",
  workout:    "pf-v2-s-accent-full",
  expiry:     "pf-v2-s-warn",
  checkin:    "pf-v2-s-violet",
};
const EVENT_LABELS: Record<EventKind, string> = {
  completion: "Entrenamiento completado",
  workout:    "Carga registrada",
  expiry:     "Suscripción vence",
  checkin:    "Check-in semanal",
};

type DayEvent = {
  kind: EventKind;
  label: string;
};

type DayData = {
  events: DayEvent[];
  completions: CompletionItem[];
  workouts: WorkoutItem[];
  expiringClients: string[];
  checkins: CheckinItem[];
};

// ─── Dot component ────────────────────────────────────────────
function EventDot({ kind }: { kind: EventKind }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${EVENT_COLORS[kind]}`}
    />
  );
}

// ─── Day detail panel ─────────────────────────────────────────
function DayDetailPanel({
  dateKey,
  data,
  onClose,
}: {
  dateKey: string;
  data: DayData;
  onClose: () => void;
}) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const label = `${d} de ${MONTH_NAMES_ES[m - 1]} ${y}`;

  const completedAlumnos = data.completions.filter((c) => c.completado !== false);
  const workoutByAlumno = data.workouts.reduce<Record<string, WorkoutItem[]>>((acc, w) => {
    const name = w.alumnoNombre || "Desconocido";
    if (!acc[name]) acc[name] = [];
    acc[name].push(w);
    return acc;
  }, {});

  const completedNames = new Set(completedAlumnos.map((c) => c.alumnoNombre || ""));
  const allNames = new Set([
    ...completedAlumnos.map((c) => c.alumnoNombre || ""),
    ...Object.keys(workoutByAlumno),
  ]);

  const hasAny =
    completedAlumnos.length > 0 ||
    data.workouts.length > 0 ||
    data.expiringClients.length > 0 ||
    data.checkins.length > 0;

  return (
    <div className="pf-v2-card" style={{ marginTop: 24 }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="pf-v2-h2" style={{ fontSize: 15 }}>
          📋 {label}
        </h3>
        <button
          onClick={onClose}
          className="pf-v2-option" style={{ padding: "5px 10px", fontSize: 12 }}
        >
          ✕ Cerrar
        </button>
      </div>

      {!hasAny && (
        <p className="pf-v2-muted">Sin actividad registrada para este día.</p>
      )}

      {/* Alumnos que entrenaron */}
      {allNames.size > 0 && (
        <section className="mb-5">
          <h4 className="pf-v2-field-label">
            Alumnos con actividad
          </h4>
          <div className="flex flex-col gap-2">
            {Array.from(allNames).map((nombre) => {
              const logs = workoutByAlumno[nombre] || [];
              const didComplete = completedNames.has(nombre);
              const hasPain = logs.some((l) => l.molestia);
              return (
                <div
                  key={nombre}
                  className="pf-v2-alert-row" style={{ flexWrap: "wrap", justifyContent: "space-between" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full pf-v2-s-hi text-xs font-black pf-v2-t-70">
                      {nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold pf-v2-t">{nombre}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {didComplete && (
                          <span className="inline-flex items-center gap-0.5 rounded-full pf-v2-s-ok px-2 py-0.5 text-[10px] font-semibold pf-v2-t-ok">
                            ✓ Completó sesión
                          </span>
                        )}
                        {logs.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full pf-v2-s-accent px-2 py-0.5 text-[10px] font-semibold pf-v2-t-accent">
                            {logs.length} carga{logs.length !== 1 ? "s" : ""} registrada{logs.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        {hasPain && (
                          <span className="inline-flex items-center gap-0.5 rounded-full pf-v2-s-danger px-2 py-0.5 text-[10px] font-semibold pf-v2-t-danger">
                            🚨 Molestia
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {logs.length > 0 && (
                    <div className="text-right text-[11px] pf-v2-t-40">
                      {logs.slice(0, 3).map((l, i) => (
                        <p key={i}>
                          {l.ejercicioNombre || "Ejercicio"}
                          {l.series ? ` · ${l.series}×${l.repeticiones || "?"}` : ""}
                          {l.pesoKg ? ` · ${l.pesoKg}kg` : ""}
                        </p>
                      ))}
                      {logs.length > 3 && (
                        <p className="pf-v2-t-40">+{logs.length - 3} más</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Check-ins */}
      {data.checkins.length > 0 && (
        <section className="mb-5">
          <h4 className="pf-v2-field-label">
            Check-ins semanales
          </h4>
          <div className="flex flex-col gap-1.5">
            {data.checkins.map((c, i) => (
              <div
                key={i}
                className="pf-v2-alert" style={{ display: "flex", alignItems: "center", gap: 8, borderColor: "rgba(192,132,252,0.25)", background: "rgba(192,132,252,0.1)", color: "#ddd6fe" }}
              >
                <span className="pf-v2-t-violet">📝</span>
                <span>{c.alumnoNombre || "Alumno"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suscripciones que vencen */}
      {data.expiringClients.length > 0 && (
        <section>
          <h4 className="pf-v2-field-label">
            Suscripciones que vencen
          </h4>
          <div className="flex flex-col gap-1.5">
            {data.expiringClients.map((nombre, i) => (
              <div
                key={i}
                className="pf-v2-alert" style={{ display: "flex", alignItems: "center", gap: 8, borderColor: "rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.1)", color: "#fde68a" }}
              >
                <span>⏰</span>
                <span>{nombre}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function CalendarioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  const { alumnos } = useAlumnos();

  const [completionsRaw]  = useSharedState<unknown[]>([], { key: COMPLETIONS_KEY,   legacyLocalStorageKey: COMPLETIONS_KEY });
  const [workoutsRaw]     = useSharedState<unknown[]>([], { key: WORKOUT_LOGS_KEY,   legacyLocalStorageKey: WORKOUT_LOGS_KEY });
  const [clientesMetaRaw] = useSharedState<unknown>(  {}, { key: CLIENTES_META_KEY,  legacyLocalStorageKey: CLIENTES_META_KEY });
  const [checkinsRaw]     = useSharedState<unknown[]>([], { key: CHECKIN_KEY,         legacyLocalStorageKey: CHECKIN_KEY });

  const today = new Date();
  const [currentYear,  setCurrentYear]  = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // ── parse raw data ────────────────────────────────────────────
  const completions = useMemo<CompletionItem[]>(() => {
    if (!Array.isArray(completionsRaw)) return [];
    return completionsRaw.filter(Boolean).map((r: any) => ({
      alumnoNombre: String(r.alumnoNombre || r.nombre || ""),
      fecha:        String(r.fecha || r.createdAt || ""),
      completado:   r.completado !== false,
    }));
  }, [completionsRaw]);

  const workouts = useMemo<WorkoutItem[]>(() => {
    if (!Array.isArray(workoutsRaw)) return [];
    return workoutsRaw.filter(Boolean).map((r: any) => ({
      alumnoNombre:   String(r.alumnoNombre || r.nombre || ""),
      fecha:          String(r.fecha || r.createdAt || ""),
      molestia:       Boolean(r.molestia),
      ejercicioNombre: String(r.ejercicioNombre || r.ejercicio || ""),
      series:         Number(r.series) || undefined,
      repeticiones:   Number(r.repeticiones) || undefined,
      pesoKg:         Number(r.pesoKg) || undefined,
    }));
  }, [workoutsRaw]);

  const clientesMeta = useMemo<Record<string, ClienteMeta>>(() => {
    if (!clientesMetaRaw || typeof clientesMetaRaw !== "object" || Array.isArray(clientesMetaRaw)) return {};
    return clientesMetaRaw as Record<string, ClienteMeta>;
  }, [clientesMetaRaw]);

  const checkins = useMemo<CheckinItem[]>(() => {
    if (!Array.isArray(checkinsRaw)) return [];
    return checkinsRaw.filter(Boolean).map((r: any) => ({
      alumnoNombre: String(r.alumnoNombre || r.nombre || ""),
      semanaOf:     String(r.semanaOf || ""),
      createdAt:    String(r.createdAt || ""),
    }));
  }, [checkinsRaw]);

  // ── build a map: dateKey → DayData ───────────────────────────
  const dayMap = useMemo<Map<string, DayData>>(() => {
    const map = new Map<string, DayData>();

    function getOrCreate(key: string): DayData {
      if (!map.has(key)) {
        map.set(key, { events: [], completions: [], workouts: [], expiringClients: [], checkins: [] });
      }
      return map.get(key)!;
    }

    // completions
    for (const c of completions) {
      const key = parseToKey(c.fecha);
      if (!key) continue;
      const day = getOrCreate(key);
      day.completions.push(c);
      if (!day.events.find((e) => e.kind === "completion")) {
        day.events.push({ kind: "completion", label: EVENT_LABELS.completion });
      }
    }

    // workouts
    for (const w of workouts) {
      const key = parseToKey(w.fecha);
      if (!key) continue;
      const day = getOrCreate(key);
      day.workouts.push(w);
      if (!day.events.find((e) => e.kind === "workout")) {
        day.events.push({ kind: "workout", label: EVENT_LABELS.workout });
      }
    }

    // expiries from clientesMeta
    for (const [nombre, meta] of Object.entries(clientesMeta)) {
      const key = parseToKey(meta.endDate);
      if (!key) continue;
      const day = getOrCreate(key);
      day.expiringClients.push(nombre);
      if (!day.events.find((e) => e.kind === "expiry")) {
        day.events.push({ kind: "expiry", label: EVENT_LABELS.expiry });
      }
    }

    // checkins — use createdAt date (or semanaOf if createdAt absent)
    for (const c of checkins) {
      const raw = c.createdAt || c.semanaOf;
      const key = parseToKey(raw);
      if (!key) continue;
      const day = getOrCreate(key);
      day.checkins.push(c);
      if (!day.events.find((e) => e.kind === "checkin")) {
        day.events.push({ kind: "checkin", label: EVENT_LABELS.checkin });
      }
    }

    return map;
  }, [completions, workouts, clientesMeta, checkins]);

  // ── calendar grid ─────────────────────────────────────────────
  const grid = useMemo(
    () => buildCalendarGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const todayKey = toDateKey(today);

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDateKey(null);
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDateKey(null);
  }

  const selectedData = selectedDateKey ? (dayMap.get(selectedDateKey) ?? null) : null;

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 pf-v2-b-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="pf-v2-page" style={{ maxWidth: 1080 }}>
      <div>
        <header className="pf-v2-page-head">
          <div>
            <h1 className="pf-v2-title">Calendario</h1>
          </div>
        </header>

        {/* Month navigation */}
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="pf-v2-btn pf-v2-btn-2" style={{ gap: 6 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Mes anterior
          </button>

          <h2 className="pf-v2-h2">
            {MONTH_NAMES_ES[currentMonth]} {currentYear}
          </h2>

          <button
            onClick={nextMonth}
            className="pf-v2-btn pf-v2-btn-2" style={{ gap: 6 }}
          >
            Mes siguiente
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div className="mb-4 flex flex-wrap gap-3">
          {(Object.entries(EVENT_LABELS) as [EventKind, string][]).map(([kind, label]) => (
            <div key={kind} className="flex items-center gap-1.5 text-xs pf-v2-t-50">
              <span className={`h-2 w-2 rounded-full ${EVENT_COLORS[kind]}`} />
              {label}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="pf-v2-card" style={{ overflow: "hidden", padding: 0 }}>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b pf-v2-b">
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide pf-v2-t-40"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {grid.map((week, rowIdx) => (
            <div
              key={rowIdx}
              className={`grid grid-cols-7 ${rowIdx < grid.length - 1 ? "border-b pf-v2-b" : ""}`}
            >
              {week.map((date, colIdx) => {
                if (!date) {
                  return (
                    <div
                      key={`empty-${colIdx}`}
                      className={`min-h-[80px] ${colIdx < 6 ? "border-r pf-v2-b" : ""}pf-v2-s`}
                    />
                  );
                }

                const key = toDateKey(date);
                const data = dayMap.get(key);
                const isToday = key === todayKey;
                const isSelected = key === selectedDateKey;
                const hasExpiry = (data?.expiringClients.length ?? 0) > 0;
                const visibleEvents = data?.events.slice(0, 3) ?? [];
                const extraCount = (data?.events.length ?? 0) - visibleEvents.length;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDateKey(isSelected ? null : key)}
                    className={`group relative min-h-[80px] p-2 text-left transition-colors
                      ${colIdx < 6 ? "border-r pf-v2-b" : ""}${hasExpiry ? "pf-v2-s-warn pf-v2-hover" : "pf-v2-hover"}${isSelected ? "ring-1 ring-inset pf-v2-s-blue" : ""}`}
                  >
                    {/* Day number */}
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                        ${isToday
                          ? "pf-v2-s-blue pf-v2-t"
                          : "pf-v2-t-70"}`}
                    >
                      {date.getDate()}
                    </span>

                    {/* Event dots */}
                    {visibleEvents.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {visibleEvents.map((ev, i) => (
                          <EventDot key={i} kind={ev.kind} />
                        ))}
                        {extraCount > 0 && (
                          <span className="text-[9px] font-semibold pf-v2-t-40 leading-none mt-px">
                            +{extraCount}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Expiry badge */}
                    {hasExpiry && (
                      <div className="mt-1 text-[9px] font-semibold pf-v2-t-warn leading-tight">
                        ⏰ {data!.expiringClients.length} vence
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Day detail panel */}
        {selectedDateKey && (
          <DayDetailPanel
            dateKey={selectedDateKey}
            data={selectedData ?? { events: [], completions: [], workouts: [], expiringClients: [], checkins: [] }}
            onClose={() => setSelectedDateKey(null)}
          />
        )}

        {/* Summary footer */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Entrenamientos este mes",
              value: completions.filter((c) => {
                const k = parseToKey(c.fecha);
                return k?.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`);
              }).length,
              color: "pf-v2-t-ok",
              bg: "pf-v2-s-ok pf-v2-b-ok",
            },
            {
              label: "Cargas registradas",
              value: workouts.filter((w) => {
                const k = parseToKey(w.fecha);
                return k?.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`);
              }).length,
              color: "pf-v2-t-accent",
              bg: "pf-v2-s-accent pf-v2-b-accent",
            },
            {
              label: "Check-ins este mes",
              value: checkins.filter((c) => {
                const k = parseToKey(c.createdAt || c.semanaOf);
                return k?.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`);
              }).length,
              color: "pf-v2-t-violet",
              bg: "pf-v2-s-violet pf-v2-b-violet",
            },
            {
              label: "Suscripciones vencen",
              value: Object.values(clientesMeta).filter((m) => {
                const k = parseToKey(m.endDate);
                return k?.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`);
              }).length,
              color: "pf-v2-t-warn",
              bg: "pf-v2-s-warn pf-v2-b-warn",
            },
          ].map(({ label, value, color, bg }) => (
            <article key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className="pf-v2-stat-label">{label}</p>
              <p className={`mt-2 text-3xl font-black tabular-nums${color}`}>{value}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
