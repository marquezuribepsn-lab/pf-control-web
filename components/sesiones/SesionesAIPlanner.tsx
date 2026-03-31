"use client";

import { useEffect, useMemo, useState } from "react";
import { useSessions } from "@/components/SessionsProvider";
import { useCategories } from "@/components/CategoriesProvider";
import { usePlayers } from "@/components/PlayersProvider";
import { useAlumnos } from "@/components/AlumnosProvider";
import { useEjercicios } from "@/components/EjerciciosProvider";
import { useWellness } from "@/components/WellnessProvider";
import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";
import type { BloqueEntrenamiento, Sesion } from "@/data/mockData";
import type {
  CapabilityKey,
  GeneratedTrainingPlan,
  PlanBlock,
  PlanExercise,
  PlanSession,
  PlanWeek,
  TrainingPlanEventInput,
  TrainingLevel,
  TrainingTargetType,
} from "@/lib/trainingPlanAI";
import { generateTrainingPlan } from "@/lib/trainingPlanAI";

type PlannerFormState = {
  targetType: TrainingTargetType;
  targetName: string;
  sport: string;
  category: string;
  ageMin: string;
  ageMax: string;
  level: TrainingLevel;
  weeks: string;
  sessionsPerWeek: string;
  sessionDurationMin: string;
  objectivesText: string;
  constraintsText: string;
  eventsText: string;
  notes: string;
  capabilities: CapabilityKey[];
};

type EventDraft = {
  id: string;
  date: string;
  kind: "partido" | "especial";
  label: string;
  importance: number;
};

type EventFormDraft = {
  date: string;
  kind: "partido" | "especial";
  label: string;
  importance: string;
};

type PlannerStorage = {
  plans: GeneratedTrainingPlan[];
};

type SyncPreviewStatus = "different" | "unchanged" | "missing";

type SyncPreviewItem = {
  title: string;
  normalizedTitle: string;
  weekNumber: number;
  status: SyncPreviewStatus;
  reason: string;
};

type SyncPreview = {
  total: number;
  toUpdate: number;
  unchanged: number;
  missing: number;
  items: SyncPreviewItem[];
};

type SyncReport = {
  planId: string;
  weekScope: string;
  updatedCount: number;
  unchangedCount: number;
  missingCount: number;
  updatedTitles: string[];
  unchangedTitles: string[];
  missingTitles: string[];
  generatedAt: string;
};

const STORAGE_KEY = "pf-control-sesiones-ia-plans-v1";
const PRESET_PLAN_ID = "preset-hockey-u17-speed-8w-v1";

const CAPABILITY_OPTIONS: Array<{ key: CapabilityKey; label: string }> = [
  { key: "fuerza", label: "Fuerza" },
  { key: "velocidad", label: "Velocidad" },
  { key: "resistencia", label: "Resistencia" },
  { key: "potencia", label: "Potencia" },
  { key: "agilidad", label: "Agilidad" },
  { key: "movilidad", label: "Movilidad" },
  { key: "tecnica", label: "Tecnica" },
];

const LEVEL_OPTIONS: Array<{ value: TrainingLevel; label: string }> = [
  { value: "iniciacion", label: "Iniciacion" },
  { value: "desarrollo", label: "Desarrollo" },
  { value: "rendimiento", label: "Rendimiento" },
];

const DEFAULT_FORM: PlannerFormState = {
  targetType: "plantel",
  targetName: "Hockey 15-17",
  sport: "Hockey",
  category: "Sub 18",
  ageMin: "15",
  ageMax: "17",
  level: "desarrollo",
  weeks: "8",
  sessionsPerWeek: "3",
  sessionDurationMin: "60",
  objectivesText: "Mejorar capacidades condicionales basicas\nAumentar velocidad util en partido\nMejorar repeticion de sprints con calidad tecnica",
  constraintsText: "1 dia gimnasio de 60 min\n2 dias campo de 60 min\n2 viernes por mes en cancha de 11 durante 90 min\nSin saltos de carga mayores al 10%",
  eventsText: "",
  notes: "Categoria hockey 15-17 con progresion realista, foco en velocidad de juego y base condicional.",
  capabilities: ["fuerza", "velocidad", "resistencia"],
};

function createLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseMultiline(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseEvents(text: string): Array<{
  date: string;
  label: string;
  kind: "partido" | "especial";
  importance: number;
}> {
  const lines = parseMultiline(text);

  return lines
    .map((line) => {
      const parts = line
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length === 0) {
        return null;
      }

      const date = parts[0] || "";
      const kind = parts[1] === "especial" ? "especial" : "partido";
      const label = parts[2] || (kind === "especial" ? "Evento especial" : "Partido");
      const importanceRaw = Number(parts[3] || 3);
      const importance = Number.isFinite(importanceRaw)
        ? Math.max(1, Math.min(5, Math.round(importanceRaw)))
        : 3;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return null;
      }

      return {
        date,
        label,
        kind,
        importance,
      };
    })
    .filter((event): event is { date: string; label: string; kind: "partido" | "especial"; importance: number } => Boolean(event));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function eventDraftToEvent(event: EventDraft): TrainingPlanEventInput {
  return {
    date: event.date,
    kind: event.kind,
    label: event.label,
    importance: clamp(Math.round(Number(event.importance || 3)), 1, 5),
  };
}

function mergeEvents(
  baseEvents: TrainingPlanEventInput[],
  extraEvents: TrainingPlanEventInput[]
): TrainingPlanEventInput[] {
  return [...baseEvents, ...extraEvents].filter((event, index, arr) => {
    const key = `${event.date}|${event.kind}|${event.label}`;
    return (
      arr.findIndex((candidate) => {
        const candidateKey = `${candidate.date}|${candidate.kind}|${candidate.label}`;
        return candidateKey === key;
      }) === index
    );
  });
}

function adjustRepsRange(input: string, loadDelta: number): string {
  if (!input) return input;
  const factor = clamp(1 + loadDelta / 90, 0.7, 1.15);

  return input.replace(/\d+(?:\.\d+)?/g, (raw) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return raw;
    return String(clamp(Math.round(num * factor), 1, 40));
  });
}

function toPlainDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";
  return date.toISOString().slice(0, 10);
}

function mondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + delta);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseIsoDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function shiftIsoDate(value: string, deltaDays: number): string {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return value;
  }
  return toPlainDate(addDays(parsed, deltaDays));
}

function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function buildHockeyPresetPlan(): GeneratedTrainingPlan {
  const monday = mondayOfCurrentWeek();
  const fridayEvents: TrainingPlanEventInput[] = [];

  for (let week = 1; week <= 8; week += 1) {
    if (week % 2 === 0) {
      const friday = addDays(monday, (week - 1) * 7 + 4);
      fridayEvents.push({
        date: friday.toISOString().slice(0, 10),
        kind: "especial",
        label: `Cancha de 11 (viernes quincenal) W${week}`,
        importance: 4,
      });
    }
  }

  const generated = generateTrainingPlan({
    mode: "create",
    targetType: "plantel",
    targetName: "Hockey 15-17",
    sport: "Hockey",
    category: "Sub 18",
    ageMin: 15,
    ageMax: 17,
    level: "desarrollo",
    objectives: [
      "Mejorar capacidades condicionales basicas",
      "Aumentar velocidad util en partido",
      "Mejorar repeticion de sprints con control tecnico",
    ],
    capabilities: ["fuerza", "velocidad", "resistencia"],
    constraints: [
      "1 dia gimnasio 60 min",
      "2 dias campo 60 min",
      "2 viernes por mes cancha de 11 90 min",
      "Progresion de carga sin saltos mayores al 10%",
    ],
    sessionsPerWeek: 3,
    sessionDurationMin: 60,
    weeks: 8,
    startDate: monday.toISOString().slice(0, 10),
    events: fridayEvents,
    notes:
      "Plantilla base creada automaticamente para categoria hockey 15-17 segun especificaciones operativas del cuerpo tecnico.",
  });

  const withRequestedStructure = {
    ...generated,
    id: PRESET_PLAN_ID,
    targetName: "Hockey 15-17",
    category: "Sub 18",
    weeks: generated.weeks.map((week) => {
      const pickByFocus = (focus: CapabilityKey): PlanSession => {
        return (
          week.sessions.find((session) => session.focus === focus) ||
          week.sessions[0]
        );
      };

      const gymSessionBase = pickByFocus("fuerza");
      const fieldSpeedBase = pickByFocus("velocidad");
      const fieldResBase = pickByFocus("resistencia");

      const gymSession: PlanSession = {
        ...gymSessionBase,
        id: `${gymSessionBase.id}-gym`,
        dayLabel: "Lunes (Gimnasio)",
        focus: "fuerza",
        durationMin: 60,
        objective: "Desarrollar base de fuerza y prevenir lesiones para sostener velocidad en juego.",
        rationale:
          "Sesion de fuerza estructural para mejorar produccion de fuerza, estabilidad y transferencia a aceleraciones.",
      };

      const fieldSpeed: PlanSession = {
        ...fieldSpeedBase,
        id: `${fieldSpeedBase.id}-field-speed`,
        dayLabel: "Martes (Campo)",
        focus: "velocidad",
        durationMin: 60,
        objective: "Mejorar aceleracion, velocidad de decision y cambios de direccion.",
        rationale:
          "Trabajo especifico de campo para hacer mas rapidas las acciones determinantes del partido.",
      };

      const fieldRes: PlanSession = {
        ...fieldResBase,
        id: `${fieldResBase.id}-field-res`,
        dayLabel: "Jueves (Campo)",
        focus: "resistencia",
        durationMin: 60,
        objective: "Sostener esfuerzos de alta intensidad sin perder calidad tecnica.",
        rationale:
          "Combinacion de resistencia especifica y velocidad-resistencia para repetir esfuerzos en contexto competitivo.",
      };

      const sessions: PlanSession[] = [gymSession, fieldSpeed, fieldRes];

      if (week.weekNumber % 2 === 0) {
        const fridayBlocks: PlanBlock[] = [
          {
            title: "Transiciones en cancha de 11",
            objective: "Mejorar velocidad tactica y ocupacion de espacios amplios.",
            rationale: "Estimulo quincenal de campo completo para transferir capacidades condicionales al juego real.",
            exercises: [
              {
                name: "Transiciones 8v8 + porteras",
                sets: 4,
                reps: "4 min",
                restSec: 120,
                intensityGuide: "RPE 7-8",
                rationale: "Aumenta velocidad de reorganizacion ofensiva-defensiva.",
              },
              {
                name: "Juego condicionado en cancha de 11",
                sets: 2,
                reps: "10 min",
                restSec: 180,
                intensityGuide: "RPE 7",
                rationale: "Consolida decisiones rapidas en espacio competitivo real.",
              },
            ],
          },
        ];

        sessions.push({
          id: `w${week.weekNumber}-friday-field11`,
          dayLabel: "Viernes (Cancha de 11)",
          focus: "velocidad",
          durationMin: 90,
          objective:
            "Sesion quincenal de 90 minutos en campo completo para transferir velocidad y resistencia al partido.",
          rationale:
            "Cumple especificacion operativa de 2 viernes por mes en cancha de 11 con carga controlada.",
          blocks: fridayBlocks,
        });
      }

      return {
        ...week,
        sessions,
      };
    }),
  };

  return {
    ...withRequestedStructure,
    progressionSummary: [
      ...withRequestedStructure.progressionSummary,
      "Estructura fija semanal aplicada: 1 gimnasio (60) + 2 campo (60) y viernes quincenal en cancha de 11 (90).",
      "Categoria hockey 15-17 con foco prioritario en capacidades basicas y velocidad util de partido.",
    ],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeCompact(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

function buildExerciseObservation(exercise: PlanExercise): string {
  const parts = [
    exercise.rationale,
    exercise.notes?.trim() || "",
    exercise.tempo?.trim() ? `Tempo: ${exercise.tempo.trim()}` : "",
    exercise.rir?.trim() ? `RIR: ${exercise.rir.trim()}` : "",
  ].filter((part) => Boolean(part));

  return parts.join(" | ");
}

function focusToCategory(focus: CapabilityKey): string {
  if (focus === "fuerza") return "Fuerza";
  if (focus === "velocidad") return "Velocidad";
  if (focus === "resistencia") return "Resistencia";
  if (focus === "potencia") return "Potencia";
  if (focus === "agilidad") return "Tecnica";
  if (focus === "movilidad") return "Prevencion";
  return "Tecnica";
}

function phaseLabel(phase: string): string {
  if (phase === "acumulacion") return "Acumulacion";
  if (phase === "intensificacion") return "Intensificacion";
  if (phase === "descarga") return "Descarga";
  return "Competitiva";
}

export default function SesionesAIPlanner() {
  const { sesiones, agregarSesion, editarSesion } = useSessions();
  const { categorias } = useCategories();
  const { jugadoras } = usePlayers();
  const { alumnos } = useAlumnos();
  const { ejercicios, agregarEjercicio } = useEjercicios();
  const { wellness } = useWellness();

  const [form, setForm] = useState<PlannerFormState>(DEFAULT_FORM);
  const [storage, setStorage, storageLoaded] = useSharedState<PlannerStorage>(
    { plans: [] },
    { key: STORAGE_KEY, legacyLocalStorageKey: STORAGE_KEY }
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtendingPlanId, setIsExtendingPlanId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [lastSyncReport, setLastSyncReport] = useState<SyncReport | null>(null);
  const [extensionWeeksByPlan, setExtensionWeeksByPlan] = useState<Record<string, string>>({});
  const [extensionEventsByPlan, setExtensionEventsByPlan] = useState<Record<string, string>>({});
  const [calendarEvents, setCalendarEvents] = useState<EventDraft[]>([]);
  const [eventDraft, setEventDraft] = useState<EventFormDraft>({
    date: "",
    kind: "partido",
    label: "",
    importance: "3",
  });
  const [extensionCalendarEventsByPlan, setExtensionCalendarEventsByPlan] =
    useState<Record<string, EventDraft[]>>({});
  const [extensionDraftByPlan, setExtensionDraftByPlan] = useState<
    Record<string, EventFormDraft>
  >({});

  const categoryOptions = useMemo(
    () => categorias.filter((cat) => cat.habilitada).map((cat) => cat.nombre),
    [categorias]
  );

  const sportOptions = useMemo(() => {
    const fromJugadoras = jugadoras
      .map((item) => (item.deporte || "").trim())
      .filter(Boolean);
    return Array.from(new Set(["General", ...fromJugadoras])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [jugadoras]);

  const defaultAlumnoName = useMemo(() => alumnos[0]?.nombre || "", [alumnos]);

  const plans = storage.plans || [];

  const getExerciseOptionsForFocus = (focus: CapabilityKey): string[] => {
    const preferredCategory = normalizeText(focusToCategory(focus));
    const fromPreferred = ejercicios
      .filter((item) => normalizeText(item.categoria || "") === preferredCategory)
      .map((item) => item.nombre.trim())
      .filter(Boolean);

    const fromAll = ejercicios
      .map((item) => item.nombre.trim())
      .filter(Boolean);

    const combined = [...fromPreferred, ...fromAll];
    const uniqueByNormalized = new Map<string, string>();

    for (const name of combined) {
      const key = normalizeText(name);
      if (!key || uniqueByNormalized.has(key)) {
        continue;
      }
      uniqueByNormalized.set(key, name);
    }

    return Array.from(uniqueByNormalized.values()).sort((a, b) => a.localeCompare(b));
  };

  const handleTargetTypeChange = (nextType: TrainingTargetType) => {
    if (nextType === "alumno") {
      setForm((prev) => ({
        ...prev,
        targetType: "alumno",
        targetName: prev.targetName || defaultAlumnoName,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      targetType: "plantel",
      targetName: prev.targetName || prev.category || "Plantel",
    }));
  };

  const toggleCapability = (capability: CapabilityKey) => {
    setForm((prev) => {
      const already = prev.capabilities.includes(capability);
      if (already) {
        const next = prev.capabilities.filter((item) => item !== capability);
        return {
          ...prev,
          capabilities: next.length > 0 ? next : prev.capabilities,
        };
      }
      return {
        ...prev,
        capabilities: [...prev.capabilities, capability],
      };
    });
  };

  const addCalendarEvent = () => {
    if (!eventDraft.date) {
      setErrorMessage("Completa la fecha del evento.");
      return;
    }

    const newEvent: EventDraft = {
      id: createLocalId(),
      date: eventDraft.date,
      kind: eventDraft.kind,
      label:
        eventDraft.label.trim() ||
        (eventDraft.kind === "partido" ? "Partido" : "Evento especial"),
      importance: clamp(Number(eventDraft.importance || 3), 1, 5),
    };

    setCalendarEvents((prev) =>
      [...prev, newEvent].sort((a, b) => a.date.localeCompare(b.date))
    );
    setEventDraft({ date: "", kind: "partido", label: "", importance: "3" });
    setErrorMessage("");
  };

  const removeCalendarEvent = (id: string) => {
    setCalendarEvents((prev) => prev.filter((event) => event.id !== id));
  };

  const getExtensionDraft = (planId: string): EventFormDraft => {
    return (
      extensionDraftByPlan[planId] || {
        date: "",
        kind: "partido",
        label: "",
        importance: "3",
      }
    );
  };

  const setExtensionDraft = (planId: string, next: EventFormDraft) => {
    setExtensionDraftByPlan((prev) => ({
      ...prev,
      [planId]: next,
    }));
  };

  const addExtensionCalendarEvent = (planId: string) => {
    const draft = getExtensionDraft(planId);
    if (!draft.date) {
      setErrorMessage("Completa la fecha para agregar evento de extension.");
      return;
    }

    const newEvent: EventDraft = {
      id: createLocalId(),
      date: draft.date,
      kind: draft.kind,
      label: draft.label.trim() || (draft.kind === "partido" ? "Partido" : "Evento especial"),
      importance: clamp(Number(draft.importance || 3), 1, 5),
    };

    setExtensionCalendarEventsByPlan((prev) => ({
      ...prev,
      [planId]: [...(prev[planId] || []), newEvent].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    }));

    setExtensionDraft(planId, { date: "", kind: "partido", label: "", importance: "3" });
    setErrorMessage("");
  };

  const removeExtensionCalendarEvent = (planId: string, eventId: string) => {
    setExtensionCalendarEventsByPlan((prev) => ({
      ...prev,
      [planId]: (prev[planId] || []).filter((event) => event.id !== eventId),
    }));
  };

  const exportPlanPdf = (plan: GeneratedTrainingPlan) => {
    const printableWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
    if (!printableWindow) {
      setErrorMessage("No se pudo abrir la ventana para exportar. Habilita popups.");
      return;
    }

    const weeksHtml = plan.weeks
      .map((week) => {
        const sessionsHtml = week.sessions
          .map((session) => {
            const blocksHtml = session.blocks
              .map((block) => {
                const exercisesHtml = block.exercises
                  .map(
                    (exercise) =>
                      `<li>${escapeHtml(exercise.name)} | ${exercise.sets}x${escapeHtml(
                        exercise.reps
                      )} | descanso ${exercise.restSec}s | ${escapeHtml(
                        exercise.intensityGuide
                      )}${exercise.tempo ? ` | tempo ${escapeHtml(exercise.tempo)}` : ""}${
                        exercise.rir ? ` | RIR ${escapeHtml(exercise.rir)}` : ""
                      }${exercise.notes ? ` | obs: ${escapeHtml(exercise.notes)}` : ""}</li>`
                  )
                  .join("");

                return `
                  <div class="block">
                    <h5>${escapeHtml(block.title)}</h5>
                    <p><strong>Objetivo:</strong> ${escapeHtml(block.objective)}</p>
                    <p><strong>Justificacion:</strong> ${escapeHtml(block.rationale)}</p>
                    <ul>${exercisesHtml}</ul>
                  </div>
                `;
              })
              .join("");

            return `
              <div class="session">
                <h4>${escapeHtml(session.dayLabel)} | ${escapeHtml(session.focus)} | ${session.durationMin} min</h4>
                <p>${escapeHtml(session.objective)}</p>
                ${blocksHtml}
              </div>
            `;
          })
          .join("");

        return `
          <section class="week">
            <h3>Semana ${week.weekNumber} | ${escapeHtml(phaseLabel(week.phase))} | Carga ${week.loadIndex}/100</h3>
            <p>${escapeHtml(toPlainDate(week.startDate))} a ${escapeHtml(toPlainDate(week.endDate))}</p>
            <p>${escapeHtml(week.rationale)}</p>
            ${sessionsHtml}
          </section>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>Plan ${escapeHtml(plan.targetName)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1, h2, h3, h4, h5 { margin: 0 0 8px 0; }
            p, li { font-size: 12px; line-height: 1.5; }
            .meta { margin-bottom: 16px; }
            .week { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
            .session { border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 8px; }
            .block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-top: 6px; }
            ul { margin: 6px 0 0 18px; padding: 0; }
            @media print { body { margin: 10mm; } }
          </style>
        </head>
        <body>
          <h1>Plan IA de entrenamiento</h1>
          <div class="meta">
            <p><strong>Objetivo:</strong> ${escapeHtml(plan.targetName)}</p>
            <p><strong>Deporte/Categoria:</strong> ${escapeHtml(plan.sport)} / ${escapeHtml(plan.category)}</p>
            <p><strong>Nivel:</strong> ${escapeHtml(plan.level)} | <strong>Edad:</strong> ${plan.ageMin}-${plan.ageMax} | <strong>Semanas:</strong> ${plan.totalWeeks}</p>
          </div>
          ${weeksHtml}
        </body>
      </html>
    `;

    printableWindow.document.open();
    printableWindow.document.write(html);
    printableWindow.document.close();
    printableWindow.focus();
    printableWindow.print();
  };

  const recalculateWeekByReadiness = (plan: GeneratedTrainingPlan, weekNumber: number) => {
    const targetPeople =
      plan.targetType === "alumno"
        ? [plan.targetName]
        : jugadoras
            .filter((player) => !plan.category || plan.category === "General" || player.categoria === plan.category)
            .map((player) => player.nombre);

    const uniquePeople = Array.from(new Set(targetPeople.map((name) => normalizeText(name))));
    if (uniquePeople.length === 0) {
      setErrorMessage("No hay personas vinculadas para recalcular esta semana.");
      return;
    }

    const wellnessByName = new Map(wellness.map((item) => [normalizeText(item.nombre), item]));
    const playerByName = new Map(jugadoras.map((player) => [normalizeText(player.nombre), player]));

    const scores = uniquePeople.map((name) => {
      const player = playerByName.get(name);
      const wellnessRow = wellnessByName.get(name);

      let score = 82;
      if (typeof player?.wellness === "number") {
        score += (player.wellness - 7) * 6;
      }
      if (typeof player?.carga === "number") {
        score += clamp((500 - player.carga) / 30, -12, 8);
      }
      if (wellnessRow) {
        score += (wellnessRow.bienestar - 7) * 5;
        score -= Math.max(wellnessRow.fatiga - 4, 0) * 3;
        score -= Math.max(wellnessRow.dolor - 2, 0) * 4;
        if ((wellnessRow.disponibilidad || "").toLowerCase().includes("limit")) {
          score -= 8;
        }
      }

      return clamp(score, 45, 108);
    });

    const readinessAvg = Math.round(
      scores.reduce((acc, value) => acc + value, 0) / scores.length
    );

    let loadDelta = 0;
    if (readinessAvg <= 65) loadDelta = -14;
    else if (readinessAvg <= 75) loadDelta = -10;
    else if (readinessAvg <= 85) loadDelta = -6;
    else if (readinessAvg >= 97) loadDelta = 3;

    const nextPlan: GeneratedTrainingPlan = {
      ...plan,
      version: plan.version + 1,
      updatedAt: new Date().toISOString(),
      weeks: plan.weeks.map((week) => {
        if (week.weekNumber !== weekNumber) {
          return week;
        }

        const nextLoad = clamp(week.loadIndex + loadDelta, 35, 95);
        const durationFactor = clamp(1 + loadDelta / 120, 0.82, 1.05);

        return {
          ...week,
          loadIndex: nextLoad,
          rationale:
            `${week.rationale} Recalculo por readiness promedio ${readinessAvg}% (` +
            `${loadDelta >= 0 ? "+" : ""}${loadDelta}% de carga).`,
          sessions: week.sessions.map((session) => ({
            ...session,
            durationMin: clamp(Math.round(session.durationMin * durationFactor), 35, 150),
            rationale:
              `${session.rationale} Ajuste readiness ${readinessAvg}% (` +
              `${loadDelta >= 0 ? "+" : ""}${loadDelta}%).`,
            blocks: session.blocks.map((block) => ({
              ...block,
              exercises: block.exercises.map((exercise) => {
                const setsFactor = clamp(1 + loadDelta / 45, 0.7, 1.1);
                const nextSets = clamp(Math.round(exercise.sets * setsFactor), 1, 8);
                const restFactor = clamp(1 - loadDelta / 80, 0.85, 1.25);
                const nextRest = clamp(Math.round(exercise.restSec * restFactor), 30, 240);

                return {
                  ...exercise,
                  sets: nextSets,
                  reps: adjustRepsRange(exercise.reps, loadDelta),
                  restSec: nextRest,
                  intensityGuide: `${exercise.intensityGuide} | ajuste ${loadDelta >= 0 ? "+" : ""}${loadDelta}%`,
                };
              }),
            })),
          })),
        };
      }),
    };

    markManualSaveIntent(STORAGE_KEY);
    setStorage((prev) => ({
      plans: (prev.plans || []).map((item) => (item.id === plan.id ? nextPlan : item)),
    }));

    setStatusMessage(
      `Semana ${weekNumber} recalculada con readiness ${readinessAvg}% (${loadDelta >= 0 ? "+" : ""}${loadDelta}% carga).`
    );
    setErrorMessage("");
  };

  const buildRequest = (mode: "create" | "extend", existingPlan?: GeneratedTrainingPlan, extensionWeeks?: number, extensionEvents?: string) => {
    const weeks =
      mode === "extend" && extensionWeeks
        ? extensionWeeks
        : Math.max(1, Number(form.weeks) || 8);

    const existingEvents =
      mode === "extend" && existingPlan
        ? existingPlan.weeks.flatMap((week) => week.events || [])
        : [];

    const parsedEvents = parseEvents(mode === "extend" ? extensionEvents || "" : form.eventsText);
    const visualEvents =
      mode === "extend" && existingPlan
        ? (extensionCalendarEventsByPlan[existingPlan.id] || []).map(eventDraftToEvent)
        : calendarEvents.map(eventDraftToEvent);

    const mergedEvents = mergeEvents(existingEvents, mergeEvents(parsedEvents, visualEvents));

    return {
      mode,
      targetType: mode === "extend" && existingPlan ? existingPlan.targetType : form.targetType,
      targetName:
        mode === "extend" && existingPlan
          ? existingPlan.targetName
          : form.targetName,
      sport: mode === "extend" && existingPlan ? existingPlan.sport : form.sport,
      category: mode === "extend" && existingPlan ? existingPlan.category : form.category,
      ageMin: mode === "extend" && existingPlan ? existingPlan.ageMin : Number(form.ageMin) || 16,
      ageMax: mode === "extend" && existingPlan ? existingPlan.ageMax : Number(form.ageMax) || 25,
      level: mode === "extend" && existingPlan ? existingPlan.level : form.level,
      objectives:
        mode === "extend" && existingPlan
          ? existingPlan.objectives
          : parseMultiline(form.objectivesText),
      capabilities:
        mode === "extend" && existingPlan
          ? existingPlan.capabilities
          : form.capabilities,
      constraints:
        mode === "extend" && existingPlan
          ? existingPlan.constraints
          : parseMultiline(form.constraintsText),
      sessionsPerWeek:
        mode === "extend" && existingPlan
          ? existingPlan.sessionsPerWeek
          : Math.max(1, Number(form.sessionsPerWeek) || 3),
      sessionDurationMin:
        mode === "extend" && existingPlan
          ? existingPlan.sessionDurationMin
          : Math.max(35, Number(form.sessionDurationMin) || 80),
      weeks,
      startDate:
        mode === "extend" && existingPlan
          ? existingPlan.startDate
          : new Date().toISOString().slice(0, 10),
      events: mergedEvents,
      notes: mode === "extend" && existingPlan ? existingPlan.notes || "" : form.notes,
      existingPlan,
    };
  };

  const runPlanRequest = async (
    mode: "create" | "extend",
    existingPlan?: GeneratedTrainingPlan,
    extensionWeeks?: number,
    extensionEvents?: string
  ): Promise<GeneratedTrainingPlan | null> => {
    setErrorMessage("");

    const payload = buildRequest(mode, existingPlan, extensionWeeks, extensionEvents);

    const response = await fetch("/api/sesiones/ai-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => ({}))) as {
      plan?: GeneratedTrainingPlan;
      message?: string;
    };

    if (!response.ok || !result.plan) {
      throw new Error(result.message || "No se pudo generar el plan");
    }

    return result.plan;
  };

  const generateNewPlan = async () => {
    setStatusMessage("");
    setErrorMessage("");
    setIsGenerating(true);

    try {
      const plan = await runPlanRequest("create");
      if (!plan) return;

      markManualSaveIntent(STORAGE_KEY);
      setStorage((prev) => ({
        plans: [plan, ...(prev.plans || [])].slice(0, 20),
      }));
      const created = createSessionsFromPlan(plan, undefined, { silent: true });
      setStatusMessage(
        created > 0
          ? `Plan generado y cargado en sesiones: ${created} sesiones con bloques y ejercicios.`
          : "Plan generado. Las sesiones ya estaban cargadas previamente."
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error generando plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const extendPlan = async (plan: GeneratedTrainingPlan) => {
    const extensionWeeks = Math.max(1, Number(extensionWeeksByPlan[plan.id] || "4") || 4);
    const extensionEvents = extensionEventsByPlan[plan.id] || "";

    setStatusMessage("");
    setErrorMessage("");
    setIsExtendingPlanId(plan.id);

    try {
      const updatedPlan = await runPlanRequest("extend", plan, extensionWeeks, extensionEvents);
      if (!updatedPlan) return;

      markManualSaveIntent(STORAGE_KEY);
      setStorage((prev) => ({
        plans: (prev.plans || []).map((item) =>
          item.id === plan.id ? updatedPlan : item
        ),
      }));

      const created = createSessionsFromPlan(updatedPlan, undefined, { silent: true });
      setStatusMessage(
        created > 0
          ? `Plan extendido +${extensionWeeks} semanas y cargado en sesiones (${created} nuevas).`
          : `Plan extendido +${extensionWeeks} semanas (sin nuevas sesiones por duplicados).`
      );
      setExtensionWeeksByPlan((prev) => ({ ...prev, [plan.id]: "4" }));
      setExtensionEventsByPlan((prev) => ({ ...prev, [plan.id]: "" }));
      setExtensionCalendarEventsByPlan((prev) => ({ ...prev, [plan.id]: [] }));
      setExtensionDraftByPlan((prev) => ({
        ...prev,
        [plan.id]: { date: "", kind: "partido", label: "", importance: "3" },
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error extendiendo plan");
    } finally {
      setIsExtendingPlanId(null);
    }
  };

  const removePlan = (planId: string) => {
    markManualSaveIntent(STORAGE_KEY);
    setStorage((prev) => ({
      plans: (prev.plans || []).filter((plan) => plan.id !== planId),
    }));
  };

  const resolvePlanBaseStartDate = (plan: GeneratedTrainingPlan): Date => {
    const fromPlan = parseIsoDate(plan.startDate);
    if (fromPlan) {
      return fromPlan;
    }

    const fromFirstWeek = parseIsoDate(plan.weeks[0]?.startDate || "");
    if (fromFirstWeek) {
      return fromFirstWeek;
    }

    return mondayOfCurrentWeek();
  };

  const resequencePlanWeeks = (
    plan: GeneratedTrainingPlan,
    inputWeeks: PlanWeek[]
  ): PlanWeek[] => {
    const baseStart = resolvePlanBaseStartDate(plan);

    return inputWeeks.map((week, index) => {
      const newStart = addDays(baseStart, index * 7);
      const newEnd = addDays(newStart, 6);
      const oldStart = parseIsoDate(week.startDate);
      const deltaDays = oldStart ? dayDiff(oldStart, newStart) : 0;

      const shiftedEvents = (week.events || []).map((event) => ({
        ...event,
        date: shiftIsoDate(event.date, deltaDays),
      }));

      return {
        ...week,
        weekNumber: index + 1,
        startDate: toPlainDate(newStart),
        endDate: toPlainDate(newEnd),
        events: shiftedEvents,
        hasMatch: shiftedEvents.some((event) => event.kind === "partido"),
      };
    });
  };

  const duplicatePlanWeek = (plan: GeneratedTrainingPlan, weekNumber: number) => {
    const sourceIndex = plan.weeks.findIndex((week) => week.weekNumber === weekNumber);
    if (sourceIndex === -1) {
      setErrorMessage("No se encontro la semana para duplicar.");
      return;
    }

    const sourceWeek = plan.weeks[sourceIndex];
    const duplicatedWeek: PlanWeek = {
      ...sourceWeek,
      events: (sourceWeek.events || []).map((event) => ({ ...event })),
      sessions: sourceWeek.sessions.map((session) => ({
        ...session,
        id: createLocalId(),
        blocks: session.blocks.map((block) => ({
          ...block,
          exercises: block.exercises.map((exercise) => ({ ...exercise })),
        })),
      })),
    };

    const insertedWeeks = [
      ...plan.weeks.slice(0, sourceIndex + 1),
      duplicatedWeek,
      ...plan.weeks.slice(sourceIndex + 1),
    ];

    const normalizedWeeks = resequencePlanWeeks(plan, insertedWeeks);

    markManualSaveIntent(STORAGE_KEY);
    setStorage((prev) => ({
      plans: (prev.plans || []).map((item) =>
        item.id === plan.id
          ? {
              ...item,
              weeks: normalizedWeeks,
              totalWeeks: normalizedWeeks.length,
              startDate: normalizedWeeks[0]?.startDate || item.startDate,
              updatedAt: new Date().toISOString(),
            }
          : item
      ),
    }));

    setErrorMessage("");
    setStatusMessage(
      `Semana ${weekNumber} duplicada. El plan ahora tiene ${normalizedWeeks.length} semanas.`
    );
  };

  const deletePlanWeek = (plan: GeneratedTrainingPlan, weekNumber: number) => {
    if (plan.weeks.length <= 1) {
      setErrorMessage("No se puede borrar la unica semana del plan.");
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Vas a borrar la semana ${weekNumber} del plan ${plan.targetName}. Continuar?`
      );
      if (!confirmed) {
        setStatusMessage("Borrado de semana cancelado.");
        return;
      }
    }

    const filteredWeeks = plan.weeks.filter((week) => week.weekNumber !== weekNumber);
    if (filteredWeeks.length === plan.weeks.length) {
      setErrorMessage("No se encontro la semana para borrar.");
      return;
    }

    const normalizedWeeks = resequencePlanWeeks(plan, filteredWeeks);

    markManualSaveIntent(STORAGE_KEY);
    setStorage((prev) => ({
      plans: (prev.plans || []).map((item) =>
        item.id === plan.id
          ? {
              ...item,
              weeks: normalizedWeeks,
              totalWeeks: normalizedWeeks.length,
              startDate: normalizedWeeks[0]?.startDate || item.startDate,
              updatedAt: new Date().toISOString(),
            }
          : item
      ),
    }));

    setErrorMessage("");
    setStatusMessage(
      `Semana ${weekNumber} borrada. El plan ahora tiene ${normalizedWeeks.length} semanas.`
    );
  };

  const updatePlanExerciseField = (
    planId: string,
    weekNumber: number,
    sessionId: string,
    blockIndex: number,
    exerciseIndex: number,
    key:
      | "name"
      | "sets"
      | "reps"
      | "intensityGuide"
      | "restSec"
      | "rationale"
      | "tempo"
      | "rir"
      | "notes",
    value: string
  ) => {
    markManualSaveIntent(STORAGE_KEY);
    setStorage((prev) => ({
      plans: (prev.plans || []).map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        return {
          ...plan,
          updatedAt: new Date().toISOString(),
          weeks: plan.weeks.map((week) => {
            if (week.weekNumber !== weekNumber) {
              return week;
            }

            return {
              ...week,
              sessions: week.sessions.map((session) => {
                if (session.id !== sessionId) {
                  return session;
                }

                return {
                  ...session,
                  blocks: session.blocks.map((block, currentBlockIndex) => {
                    if (currentBlockIndex !== blockIndex) {
                      return block;
                    }

                    return {
                      ...block,
                      exercises: block.exercises.map((exercise, currentExerciseIndex) => {
                        if (currentExerciseIndex !== exerciseIndex) {
                          return exercise;
                        }

                        if (key === "sets") {
                          const parsed = Number(value);
                          return {
                            ...exercise,
                            sets: Number.isFinite(parsed) ? clamp(Math.round(parsed), 1, 20) : exercise.sets,
                          };
                        }

                        if (key === "restSec") {
                          const parsed = Number(value);
                          return {
                            ...exercise,
                            restSec: Number.isFinite(parsed)
                              ? clamp(Math.round(parsed), 10, 360)
                              : exercise.restSec,
                          };
                        }

                        if (key === "name") {
                          const nextName = value.trim();
                          return {
                            ...exercise,
                            name: nextName || exercise.name,
                          };
                        }

                        return {
                          ...exercise,
                          [key]: value,
                        };
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        };
      }),
    }));
  };

  const ensureExerciseId = (
    name: string,
    focus: CapabilityKey,
    objective: string,
    rationale: string
  ): string => {
    const normalizedName = normalizeText(name);
    const found = ejercicios.find(
      (item) => normalizeText(item.nombre) === normalizedName
    );

    if (found) {
      return found.id;
    }

    const similar = ejercicios.find((item) =>
      normalizeText(item.nombre).includes(normalizedName) ||
      normalizedName.includes(normalizeText(item.nombre))
    );

    if (similar) {
      return similar.id;
    }

    return agregarEjercicio({
      nombre: name,
      categoria: focusToCategory(focus),
      descripcion: rationale,
      objetivo: objective,
      videoUrl: "https://www.youtube.com/@ValentinoCoachFit/shorts",
    });
  };

  const buildPlanSessionTitle = (
    plan: GeneratedTrainingPlan,
    weekNumber: number,
    session: PlanSession
  ) => `W${weekNumber} ${plan.targetName} ${session.dayLabel} ${session.focus}`;

  const buildBloquesFromPlan = (
    weekPhase: string,
    weekLoadIndex: number,
    session: PlanSession
  ): BloqueEntrenamiento[] => {
    return session.blocks.map((block) => ({
      id: createLocalId(),
      titulo: block.title,
      objetivo: block.objective,
      ejercicios: block.exercises.map((exercise) => ({
        ejercicioId: ensureExerciseId(
          exercise.name,
          session.focus,
          block.objective,
          exercise.rationale
        ),
        series: exercise.sets,
        repeticiones: exercise.reps,
        descanso: `${exercise.restSec}s`,
        carga: exercise.intensityGuide,
        observaciones: buildExerciseObservation(exercise),
        metricas: [
          { nombre: "Por que", valor: exercise.rationale },
          { nombre: "Fase", valor: phaseLabel(weekPhase) },
          { nombre: "Carga", valor: `${weekLoadIndex}/100` },
          ...(exercise.tempo?.trim()
            ? [{ nombre: "Tempo", valor: exercise.tempo.trim() }]
            : []),
          ...(exercise.rir?.trim()
            ? [{ nombre: "RIR", valor: exercise.rir.trim() }]
            : []),
        ],
      })),
    }));
  };

  const summarizeSessionDiff = (
    existing: Sesion,
    session: PlanSession
  ): { status: "different" | "unchanged"; reason: string } => {
    const expectedObjective = `${session.objective} ${session.rationale}`;
    const expectedDuration = String(session.durationMin);

    const reasons: string[] = [];

    if (normalizeCompact(existing.objetivo) !== normalizeCompact(expectedObjective)) {
      reasons.push("objetivo distinto");
    }

    if (normalizeCompact(existing.duracion) !== normalizeCompact(expectedDuration)) {
      reasons.push("duracion distinta");
    }

    if (existing.bloques.length !== session.blocks.length) {
      reasons.push("cantidad de bloques distinta");
    }

    const blockCount = Math.min(existing.bloques.length, session.blocks.length);
    for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
      const currentBlock = existing.bloques[blockIndex];
      const expectedBlock = session.blocks[blockIndex];

      if (normalizeCompact(currentBlock.titulo) !== normalizeCompact(expectedBlock.title)) {
        reasons.push(`bloque ${blockIndex + 1} titulo distinto`);
        break;
      }

      if (normalizeCompact(currentBlock.objetivo) !== normalizeCompact(expectedBlock.objective)) {
        reasons.push(`bloque ${blockIndex + 1} objetivo distinto`);
        break;
      }

      if (currentBlock.ejercicios.length !== expectedBlock.exercises.length) {
        reasons.push(`bloque ${blockIndex + 1} ejercicios distintos`);
        break;
      }

      const exerciseCount = Math.min(currentBlock.ejercicios.length, expectedBlock.exercises.length);
      for (let exerciseIndex = 0; exerciseIndex < exerciseCount; exerciseIndex += 1) {
        const currentExercise = currentBlock.ejercicios[exerciseIndex];
        const expectedExercise = expectedBlock.exercises[exerciseIndex];
        const expectedRest = `${expectedExercise.restSec}s`;
        const expectedObservation = buildExerciseObservation(expectedExercise);

        if (Number(currentExercise.series) !== Number(expectedExercise.sets)) {
          reasons.push(`ejercicio ${exerciseIndex + 1} series distintas`);
          break;
        }

        if (normalizeCompact(currentExercise.repeticiones) !== normalizeCompact(expectedExercise.reps)) {
          reasons.push(`ejercicio ${exerciseIndex + 1} reps distintas`);
          break;
        }

        if (normalizeCompact(currentExercise.descanso || "") !== normalizeCompact(expectedRest)) {
          reasons.push(`ejercicio ${exerciseIndex + 1} descanso distinto`);
          break;
        }

        if (normalizeCompact(currentExercise.carga || "") !== normalizeCompact(expectedExercise.intensityGuide)) {
          reasons.push(`ejercicio ${exerciseIndex + 1} carga distinta`);
          break;
        }

        if (
          normalizeCompact(currentExercise.observaciones || "") !==
          normalizeCompact(expectedObservation)
        ) {
          reasons.push(`ejercicio ${exerciseIndex + 1} observaciones distintas`);
          break;
        }
      }

      if (reasons.length > 0) {
        break;
      }
    }

    if (reasons.length === 0) {
      return {
        status: "unchanged",
        reason: "sin cambios",
      };
    }

    return {
      status: "different",
      reason: reasons.slice(0, 2).join(", "),
    };
  };

  const buildSyncPreview = (
    plan: GeneratedTrainingPlan,
    onlyWeekNumber?: number
  ): SyncPreview => {
    const weeks = typeof onlyWeekNumber === "number"
      ? plan.weeks.filter((week) => week.weekNumber === onlyWeekNumber)
      : plan.weeks;

    const items: SyncPreviewItem[] = [];

    for (const week of weeks) {
      for (const session of week.sessions) {
        const title = buildPlanSessionTitle(plan, week.weekNumber, session);
        const normalizedTitle = normalizeText(title);

        const existing = sesiones.find((item) => normalizeText(item.titulo) === normalizedTitle);

        if (!existing) {
          items.push({
            title,
            normalizedTitle,
            weekNumber: week.weekNumber,
            status: "missing",
            reason: "sesion no creada",
          });
          continue;
        }

        const diff = summarizeSessionDiff(existing, session);
        items.push({
          title,
          normalizedTitle,
          weekNumber: week.weekNumber,
          status: diff.status,
          reason: diff.reason,
        });
      }
    }

    const toUpdate = items.filter((item) => item.status === "different").length;
    const unchanged = items.filter((item) => item.status === "unchanged").length;
    const missing = items.filter((item) => item.status === "missing").length;

    return {
      total: items.length,
      toUpdate,
      unchanged,
      missing,
      items,
    };
  };

  const confirmSyncPreview = (
    plan: GeneratedTrainingPlan,
    preview: SyncPreview,
    onlyWeekNumber?: number
  ): boolean => {
    if (typeof window === "undefined") {
      return true;
    }

    const scopeLabel = typeof onlyWeekNumber === "number"
      ? `semana ${onlyWeekNumber}`
      : "todo el plan";

    const sampleDiffs = preview.items
      .filter((item) => item.status === "different")
      .slice(0, 4)
      .map((item) => `- ${item.title}: ${item.reason}`);

    const sampleMissing = preview.items
      .filter((item) => item.status === "missing")
      .slice(0, 3)
      .map((item) => `- ${item.title}`);

    const lines = [
      `Plan: ${plan.targetName}`,
      `Alcance: ${scopeLabel}`,
      `Detectadas: ${preview.total}`,
      `Actualizar: ${preview.toUpdate}`,
      `Sin cambios: ${preview.unchanged}`,
      `Faltantes: ${preview.missing}`,
    ];

    if (sampleDiffs.length > 0) {
      lines.push("", "Cambios detectados:", ...sampleDiffs);
    }

    if (sampleMissing.length > 0) {
      lines.push("", "Sesiones faltantes:", ...sampleMissing);
    }

    lines.push("", "Deseas aplicar los cambios ahora?");
    return window.confirm(lines.join("\n"));
  };

  const runPlanSync = (
    plan: GeneratedTrainingPlan,
    onlyWeekNumber?: number
  ) => {
    const preview = buildSyncPreview(plan, onlyWeekNumber);

    if (preview.total === 0) {
      setErrorMessage("No hay semanas para aplicar cambios.");
      return;
    }

    const confirmed = confirmSyncPreview(plan, preview, onlyWeekNumber);
    if (!confirmed) {
      setStatusMessage("Aplicacion cancelada por el usuario.");
      return;
    }

    applyPlanEditsToExistingSessions(plan, onlyWeekNumber, preview);
  };

  const applyPlanEditsToExistingSessions = (
    plan: GeneratedTrainingPlan,
    onlyWeekNumber?: number,
    providedPreview?: SyncPreview
  ) => {
    const preview = providedPreview || buildSyncPreview(plan, onlyWeekNumber);

    const weeks = typeof onlyWeekNumber === "number"
      ? plan.weeks.filter((week) => week.weekNumber === onlyWeekNumber)
      : plan.weeks;

    if (weeks.length === 0) {
      setErrorMessage("No hay semanas para aplicar cambios.");
      return;
    }

    let updated = 0;
    const updatedTitles: string[] = [];
    const unchangedTitles = preview.items
      .filter((item) => item.status === "unchanged")
      .map((item) => item.title);
    const missingTitles = preview.items
      .filter((item) => item.status === "missing")
      .map((item) => item.title);

    const previewByTitle = new Map(preview.items.map((item) => [item.normalizedTitle, item]));

    for (const week of weeks) {
      for (const session of week.sessions) {
        const targetTitle = buildPlanSessionTitle(plan, week.weekNumber, session);
        const normalizedTitle = normalizeText(targetTitle);
        const previewItem = previewByTitle.get(normalizedTitle);

        if (!previewItem || previewItem.status !== "different") {
          continue;
        }

        const existing = sesiones.find(
          (item) => normalizeText(item.titulo) === normalizedTitle
        );

        if (!existing) {
          continue;
        }

        const bloques = buildBloquesFromPlan(week.phase, week.loadIndex, session);

        editarSesion(existing.id, {
          titulo: targetTitle,
          objetivo: `${session.objective} ${session.rationale}`,
          duracion: String(session.durationMin),
          equipo:
            plan.targetType === "alumno"
              ? `Alumno/a: ${plan.targetName}`
              : `Categoria: ${plan.category}`,
          asignacionTipo: plan.targetType === "alumno" ? "alumnos" : "jugadoras",
          categoriaAsignada: plan.targetType === "plantel" ? plan.category : undefined,
          jugadoraAsignada: undefined,
          alumnoAsignado: plan.targetType === "alumno" ? plan.targetName : undefined,
          bloques,
        });

        updated += 1;
        updatedTitles.push(targetTitle);
      }
    }

    const report: SyncReport = {
      planId: plan.id,
      weekScope:
        typeof onlyWeekNumber === "number" ? `Semana ${onlyWeekNumber}` : "Plan completo",
      updatedCount: updated,
      unchangedCount: preview.unchanged,
      missingCount: preview.missing,
      updatedTitles,
      unchangedTitles,
      missingTitles,
      generatedAt: new Date().toISOString(),
    };

    setLastSyncReport(report);
    setErrorMessage("");

    if (updated === 0 && preview.missing > 0) {
      setStatusMessage(
        "No se aplicaron cambios. Las sesiones detectadas todavia no estaban creadas."
      );
      return;
    }

    if (updated === 0 && preview.unchanged > 0) {
      setStatusMessage(
        "No se aplicaron cambios porque las sesiones existentes ya estaban sincronizadas."
      );
      return;
    }

    if (preview.missing > 0) {
      setStatusMessage(
        `Se actualizaron ${updated} sesiones existentes. ${preview.unchanged} ya estaban iguales y ${preview.missing} no estaban creadas.`
      );
      return;
    }

    setStatusMessage(
      `Se actualizaron ${updated} sesiones existentes. ${preview.unchanged} ya estaban iguales.`
    );
  };

  const createSessionsFromPlan = (
    plan: GeneratedTrainingPlan,
    onlyWeekNumber?: number,
    options?: { silent?: boolean }
  ): number => {
    const silent = Boolean(options?.silent);
    const weeks = typeof onlyWeekNumber === "number"
      ? plan.weeks.filter((week) => week.weekNumber === onlyWeekNumber)
      : plan.weeks;

    if (weeks.length === 0) {
      if (!silent) {
        setErrorMessage("No hay semanas para crear sesiones.");
      }
      return 0;
    }

    let created = 0;

    for (const week of weeks) {
      for (const session of week.sessions) {
        const alreadyExists = sesiones.some((item) =>
          normalizeText(item.titulo) ===
          normalizeText(
            `W${week.weekNumber} ${plan.targetName} ${session.dayLabel} ${session.focus}`
          )
        );

        if (alreadyExists) {
          continue;
        }

        const bloques = buildBloquesFromPlan(week.phase, week.loadIndex, session);

        const targetTitle = buildPlanSessionTitle(plan, week.weekNumber, session);

        agregarSesion({
          titulo: targetTitle,
          objetivo: `${session.objective} ${session.rationale}`,
          duracion: String(session.durationMin),
          equipo:
            plan.targetType === "alumno"
              ? `Alumno/a: ${plan.targetName}`
              : `Categoria: ${plan.category}`,
          asignacionTipo: plan.targetType === "alumno" ? "alumnos" : "jugadoras",
          categoriaAsignada: plan.targetType === "plantel" ? plan.category : undefined,
          jugadoraAsignada: undefined,
          alumnoAsignado: plan.targetType === "alumno" ? plan.targetName : undefined,
          bloques,
          prescripciones: [],
        });

        created += 1;
      }
    }

    if (created === 0) {
      if (!silent) {
        setStatusMessage("No se crearon sesiones nuevas porque ya existian para esas semanas.");
      }
      return 0;
    }

    if (!silent) {
      setStatusMessage(`Se crearon ${created} sesiones desde el plan IA.`);
    }
    return created;
  };

  useEffect(() => {
    if (!storageLoaded) {
      return;
    }

    if ((storage.plans || []).some((plan) => plan.id === PRESET_PLAN_ID)) {
      return;
    }

    const presetPlan = buildHockeyPresetPlan();
    markManualSaveIntent(STORAGE_KEY);
    setStorage((prev) => ({
      plans: [presetPlan, ...(prev.plans || [])].slice(0, 20),
    }));

    const createdFromPreset = createSessionsFromPlan(presetPlan, undefined, {
      silent: true,
    });
    setStatusMessage(
      createdFromPreset > 0
        ? `Se cargo automaticamente el plan base Hockey 15-17 y se crearon ${createdFromPreset} sesiones estructuradas con bloques y ejercicios.`
        : "Se cargo automaticamente el plan base Hockey 15-17 (las sesiones ya estaban creadas)."
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage.plans, storageLoaded, setStorage]);

  return (
    <section className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-cyan-100">IA para planes estructurados</h2>
          <p className="mt-1 text-sm text-slate-300">
            Crea y extiende planes periodizados por semanas con ajuste por edad, nivel,
            objetivos y calendario de partidos.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tipo objetivo
              </label>
              <select
                value={form.targetType}
                onChange={(e) => handleTargetTypeChange(e.target.value as TrainingTargetType)}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="plantel">Plantel</option>
                <option value="alumno">Alumno/a</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Objetivo asignado
              </label>
              {form.targetType === "alumno" ? (
                <select
                  value={form.targetName}
                  onChange={(e) => setForm((prev) => ({ ...prev, targetName: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar alumno</option>
                  {alumnos.map((alumno) => (
                    <option key={alumno.nombre} value={alumno.nombre}>
                      {alumno.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.targetName}
                  onChange={(e) => setForm((prev) => ({ ...prev, targetName: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  placeholder="Ej: Primera hockey"
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Deporte
              </label>
              <select
                value={form.sport}
                onChange={(e) => setForm((prev) => ({ ...prev, sport: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                {sportOptions.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Categoria
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="General">General</option>
                {categoryOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Edad minima
              </label>
              <input
                type="number"
                min="8"
                value={form.ageMin}
                onChange={(e) => setForm((prev) => ({ ...prev, ageMin: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Edad maxima
              </label>
              <input
                type="number"
                min="8"
                value={form.ageMax}
                onChange={(e) => setForm((prev) => ({ ...prev, ageMax: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nivel
              </label>
              <select
                value={form.level}
                onChange={(e) => setForm((prev) => ({ ...prev, level: e.target.value as TrainingLevel }))}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                {LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Semanas iniciales
              </label>
              <input
                type="number"
                min="1"
                max="52"
                value={form.weeks}
                onChange={(e) => setForm((prev) => ({ ...prev, weeks: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sesiones por semana
              </label>
              <input
                type="number"
                min="1"
                max="6"
                value={form.sessionsPerWeek}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sessionsPerWeek: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Duracion por sesion (min)
              </label>
              <input
                type="number"
                min="35"
                max="150"
                value={form.sessionDurationMin}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sessionDurationMin: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Capacidades condicionales
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {CAPABILITY_OPTIONS.map((option) => {
                const active = form.capabilities.includes(option.key);
                return (
                  <label
                    key={option.key}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                      active
                        ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-100"
                        : "border-white/10 bg-slate-800 text-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleCapability(option.key)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Objetivos (1 por linea)
              </label>
              <textarea
                rows={5}
                value={form.objectivesText}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, objectivesText: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Ej: Mejorar fuerza maxima"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Restricciones (1 por linea)
              </label>
              <textarea
                rows={5}
                value={form.constraintsText}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, constraintsText: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Ej: Evitar impacto alto en jugadoras en retorno"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Calendario visual de fechas clave
              </label>

              <div className="mt-1 grid gap-2 rounded-xl border border-white/15 bg-slate-800/70 p-3 md:grid-cols-2">
                <input
                  type="date"
                  value={eventDraft.date}
                  onChange={(e) => setEventDraft((prev) => ({ ...prev, date: e.target.value }))}
                  className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm"
                />
                <select
                  value={eventDraft.kind}
                  onChange={(e) =>
                    setEventDraft((prev) => ({
                      ...prev,
                      kind: e.target.value as "partido" | "especial",
                    }))
                  }
                  className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm"
                >
                  <option value="partido">Partido</option>
                  <option value="especial">Especial</option>
                </select>
                <input
                  value={eventDraft.label}
                  onChange={(e) => setEventDraft((prev) => ({ ...prev, label: e.target.value }))}
                  className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm md:col-span-2"
                  placeholder="Descripcion (ej: Fecha 3 torneo)"
                />
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={eventDraft.importance}
                  onChange={(e) =>
                    setEventDraft((prev) => ({ ...prev, importance: e.target.value }))
                  }
                  className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Importancia 1-5"
                />
                <button
                  type="button"
                  onClick={addCalendarEvent}
                  className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200"
                >
                  Agregar fecha
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {calendarEvents.length === 0 ? (
                  <p className="text-xs text-slate-400">No agregaste fechas todavia.</p>
                ) : (
                  calendarEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs"
                    >
                      <p className="text-slate-200">
                        {event.date} | {event.kind} | {event.label} | imp {event.importance}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeCalendarEvent(event.id)}
                        className="rounded-md border border-rose-300/30 px-2 py-1 text-[11px] font-semibold text-rose-200"
                      >
                        Quitar
                      </button>
                    </div>
                  ))
                )}
              </div>

              <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Entrada rapida opcional (texto)
              </label>
              <textarea
                rows={3}
                value={form.eventsText}
                onChange={(e) => setForm((prev) => ({ ...prev, eventsText: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                placeholder="YYYY-MM-DD | partido|especial | descripcion | importancia"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Notas del pedido
              </label>
              <textarea
                rows={8}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Contexto, recursos, limitaciones"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateNewPlan}
              disabled={isGenerating}
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? "Generando..." : "Generar plan con IA"}
            </button>
          </div>

          {statusMessage ? (
            <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {statusMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {errorMessage}
            </p>
          ) : null}

          {lastSyncReport ? (
            <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
              <p className="font-semibold">
                Ultimo reporte de sync ({lastSyncReport.weekScope})
              </p>
              <p className="mt-1 text-xs text-amber-200/90">
                Actualizadas: {lastSyncReport.updatedCount} | Sin cambios: {lastSyncReport.unchangedCount} | Faltantes: {lastSyncReport.missingCount}
              </p>

              {lastSyncReport.updatedTitles.length > 0 ? (
                <details className="mt-2 rounded-md border border-amber-300/20 bg-slate-950/30 p-2">
                  <summary className="cursor-pointer text-xs font-semibold text-amber-200">
                    Ver sesiones actualizadas ({lastSyncReport.updatedTitles.length})
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-100">
                    {lastSyncReport.updatedTitles.slice(0, 12).map((title) => (
                      <li key={`updated-${title}`}>{title}</li>
                    ))}
                    {lastSyncReport.updatedTitles.length > 12 ? (
                      <li>...y {lastSyncReport.updatedTitles.length - 12} mas</li>
                    ) : null}
                  </ul>
                </details>
              ) : null}

              {lastSyncReport.missingTitles.length > 0 ? (
                <details className="mt-2 rounded-md border border-amber-300/20 bg-slate-950/30 p-2">
                  <summary className="cursor-pointer text-xs font-semibold text-amber-200">
                    Ver sesiones faltantes ({lastSyncReport.missingTitles.length})
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-100">
                    {lastSyncReport.missingTitles.slice(0, 12).map((title) => (
                      <li key={`missing-${title}`}>{title}</li>
                    ))}
                    {lastSyncReport.missingTitles.length > 12 ? (
                      <li>...y {lastSyncReport.missingTitles.length - 12} mas</li>
                    ) : null}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Como se construye el plan
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200">
            <li>Periodizacion semanal con fase de acumulacion, intensificacion, descarga y competencia.</li>
            <li>Ajuste automatico de carga y volumen cuando hay partidos en el calendario.</li>
            <li>Bloques por sesion con objetivo, justificacion, series, reps, descanso e intensidad.</li>
            <li>Escalado por edad y nivel para evitar propuestas fuera de contexto.</li>
            <li>Extension de plan por nuevas semanas conservando historial y progresion previa.</li>
            <li>Exportacion rapida a PDF y recalculo semanal por wellness/carga real.</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {plans.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
            Todavia no hay planes IA guardados.
          </p>
        ) : null}

        {plans.map((plan) => (
          <article
            key={plan.id}
            className="rounded-2xl border border-white/15 bg-slate-950/40 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {plan.targetName} · {plan.sport} · {plan.totalWeeks} semanas
                </h3>
                <p className="text-xs text-slate-300">
                  Version {plan.version} · {plan.level} · {plan.ageMin}-{plan.ageMax} anios
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => exportPlanPdf(plan)}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-100"
                >
                  Exportar PDF
                </button>
                <button
                  type="button"
                  onClick={() => createSessionsFromPlan(plan)}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                >
                  Crear todas las sesiones
                </button>
                <button
                  type="button"
                  onClick={() => runPlanSync(plan)}
                  className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200"
                >
                  Aplicar cambios a sesiones creadas
                </button>
                <button
                  type="button"
                  onClick={() => removePlan(plan.id)}
                  className="rounded-lg border border-rose-300/30 px-3 py-1.5 text-xs font-semibold text-rose-200"
                >
                  Eliminar plan
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Base cientifica aplicada
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-200">
                  {plan.scientificBasis.map((item, index) => (
                    <li key={`${plan.id}-basis-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Resumen de progresion
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-200">
                  {plan.progressionSummary.map((item, index) => (
                    <li key={`${plan.id}-summary-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Extender plan existente
              </p>
              <div className="mt-2 grid gap-2 lg:grid-cols-[120px_1fr_auto]">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={extensionWeeksByPlan[plan.id] || "4"}
                  onChange={(e) =>
                    setExtensionWeeksByPlan((prev) => ({
                      ...prev,
                      [plan.id]: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                />
                <textarea
                  rows={2}
                  value={extensionEventsByPlan[plan.id] || ""}
                  onChange={(e) =>
                    setExtensionEventsByPlan((prev) => ({
                      ...prev,
                      [plan.id]: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  placeholder="Fechas nuevas: YYYY-MM-DD | partido | descripcion | importancia"
                />
                <button
                  type="button"
                  onClick={() => extendPlan(plan)}
                  disabled={isExtendingPlanId === plan.id}
                  className="rounded-lg bg-indigo-400 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isExtendingPlanId === plan.id ? "Extendiendo..." : "Agregar semanas"}
                </button>
              </div>

              <div className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-slate-950/40 p-2 lg:grid-cols-4">
                <input
                  type="date"
                  value={getExtensionDraft(plan.id).date}
                  onChange={(e) =>
                    setExtensionDraft(plan.id, {
                      ...getExtensionDraft(plan.id),
                      date: e.target.value,
                    })
                  }
                  className="rounded-md border border-white/20 bg-slate-900 px-2 py-1.5 text-xs"
                />
                <select
                  value={getExtensionDraft(plan.id).kind}
                  onChange={(e) =>
                    setExtensionDraft(plan.id, {
                      ...getExtensionDraft(plan.id),
                      kind: e.target.value as "partido" | "especial",
                    })
                  }
                  className="rounded-md border border-white/20 bg-slate-900 px-2 py-1.5 text-xs"
                >
                  <option value="partido">Partido</option>
                  <option value="especial">Especial</option>
                </select>
                <input
                  value={getExtensionDraft(plan.id).label}
                  onChange={(e) =>
                    setExtensionDraft(plan.id, {
                      ...getExtensionDraft(plan.id),
                      label: e.target.value,
                    })
                  }
                  className="rounded-md border border-white/20 bg-slate-900 px-2 py-1.5 text-xs"
                  placeholder="Descripcion"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={getExtensionDraft(plan.id).importance}
                    onChange={(e) =>
                      setExtensionDraft(plan.id, {
                        ...getExtensionDraft(plan.id),
                        importance: e.target.value,
                      })
                    }
                    className="w-16 rounded-md border border-white/20 bg-slate-900 px-2 py-1.5 text-xs"
                    placeholder="Imp"
                  />
                  <button
                    type="button"
                    onClick={() => addExtensionCalendarEvent(plan.id)}
                    className="flex-1 rounded-md border border-cyan-300/35 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold text-cyan-200"
                  >
                    + Fecha
                  </button>
                </div>
              </div>

              {(extensionCalendarEventsByPlan[plan.id] || []).length > 0 ? (
                <div className="mt-2 space-y-1">
                  {(extensionCalendarEventsByPlan[plan.id] || []).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-[11px]"
                    >
                      <p className="text-slate-200">
                        {event.date} | {event.kind} | {event.label} | imp {event.importance}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeExtensionCalendarEvent(plan.id, event.id)}
                        className="rounded border border-rose-300/25 px-1.5 py-0.5 font-semibold text-rose-200"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              {plan.weeks.map((week) => (
                <details
                  key={`${plan.id}-week-${week.weekNumber}`}
                  className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        Semana {week.weekNumber} · {phaseLabel(week.phase)} · Carga {week.loadIndex}/100
                      </p>
                      <div className="flex items-center gap-2">
                        {week.hasMatch ? (
                          <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                            Con partido
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            createSessionsFromPlan(plan, week.weekNumber);
                          }}
                          className="rounded-md border border-cyan-300/35 px-2 py-1 text-[11px] font-semibold text-cyan-200"
                        >
                          Crear semana
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            duplicatePlanWeek(plan, week.weekNumber);
                          }}
                          className="rounded-md border border-emerald-300/35 px-2 py-1 text-[11px] font-semibold text-emerald-200"
                        >
                          Duplicar semana
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            deletePlanWeek(plan, week.weekNumber);
                          }}
                          className="rounded-md border border-rose-300/35 px-2 py-1 text-[11px] font-semibold text-rose-200"
                        >
                          Borrar semana
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            runPlanSync(plan, week.weekNumber);
                          }}
                          className="rounded-md border border-amber-300/35 px-2 py-1 text-[11px] font-semibold text-amber-200"
                        >
                          Aplicar semana editada
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            recalculateWeekByReadiness(plan, week.weekNumber);
                          }}
                          className="rounded-md border border-violet-300/35 px-2 py-1 text-[11px] font-semibold text-violet-200"
                        >
                          Recalcular por wellness
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      {week.startDate} a {week.endDate}
                    </p>
                  </summary>

                  <p className="mt-3 text-xs text-slate-300">{week.rationale}</p>

                  {week.events.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {week.events.map((event, index) => (
                        <span
                          key={`${plan.id}-week-${week.weekNumber}-event-${index}`}
                          className="rounded-full border border-white/15 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200"
                        >
                          {event.date} · {event.kind} · {event.label}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-2">
                    {week.sessions.map((session) => (
                      <div
                        key={`${plan.id}-week-${week.weekNumber}-session-${session.id}`}
                        className="rounded-lg border border-white/10 bg-slate-950/40 p-3"
                      >
                        <p className="text-sm font-semibold text-white">
                          {session.dayLabel} · {session.focus} · {session.durationMin} min
                        </p>
                        <p className="mt-1 text-xs text-slate-300">{session.objective}</p>

                        <div className="mt-2 grid gap-2">
                          {session.blocks.map((block, blockIndex) => (
                            <div
                              key={`${plan.id}-week-${week.weekNumber}-session-${session.id}-block-${blockIndex}`}
                              className="rounded-md border border-white/10 bg-slate-900/60 p-2"
                            >
                              <p className="text-xs font-semibold text-cyan-200">{block.title}</p>
                              <p className="text-[11px] text-slate-300">{block.objective}</p>
                              <p className="mt-1 text-[11px] text-slate-400">{block.rationale}</p>
                              <div className="mt-2 grid gap-2">
                                {block.exercises.map((exercise, exerciseIndex) => {
                                  const exerciseOptions = getExerciseOptionsForFocus(session.focus);

                                  return (
                                    <div
                                      key={`${plan.id}-week-${week.weekNumber}-session-${session.id}-exercise-${exerciseIndex}`}
                                      className="rounded-md border border-white/10 bg-slate-950/50 p-2"
                                    >
                                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                        Ejercicio (seleccionable)
                                      </label>
                                      <select
                                        value={exercise.name}
                                        onChange={(event) =>
                                          updatePlanExerciseField(
                                            plan.id,
                                            week.weekNumber,
                                            session.id,
                                            blockIndex,
                                            exerciseIndex,
                                            "name",
                                            event.target.value
                                          )
                                        }
                                        className="w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                      >
                                        <option value={exercise.name}>{exercise.name}</option>
                                        {exerciseOptions
                                          .filter((name) => normalizeText(name) !== normalizeText(exercise.name))
                                          .map((name) => (
                                            <option key={`${session.id}-${blockIndex}-${exerciseIndex}-${name}`} value={name}>
                                              {name}
                                            </option>
                                          ))}
                                      </select>

                                      <details className="mt-1 rounded border border-white/10 bg-slate-900/40 p-1.5">
                                        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                          Nombre personalizado (opcional)
                                        </summary>
                                        <input
                                          value={exercise.name}
                                          onChange={(event) =>
                                            updatePlanExerciseField(
                                              plan.id,
                                              week.weekNumber,
                                              session.id,
                                              blockIndex,
                                              exerciseIndex,
                                              "name",
                                              event.target.value
                                            )
                                          }
                                          className="mt-1.5 w-full rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                          placeholder="Nombre personalizado del ejercicio"
                                        />
                                      </details>

                                      <div className="mt-2 flex flex-wrap items-end gap-2">
                                        <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                            Series
                                          </label>
                                          <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={exercise.sets}
                                            onChange={(event) =>
                                              updatePlanExerciseField(
                                                plan.id,
                                                week.weekNumber,
                                                session.id,
                                                blockIndex,
                                                exerciseIndex,
                                                "sets",
                                                event.target.value
                                              )
                                            }
                                            className="w-20 rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                          />
                                        </div>

                                        <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                            Reps
                                          </label>
                                          <input
                                            value={exercise.reps}
                                            onChange={(event) =>
                                              updatePlanExerciseField(
                                                plan.id,
                                                week.weekNumber,
                                                session.id,
                                                blockIndex,
                                                exerciseIndex,
                                                "reps",
                                                event.target.value
                                              )
                                            }
                                            className="w-24 rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                          />
                                        </div>

                                        <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                            Carga
                                          </label>
                                          <input
                                            value={exercise.intensityGuide}
                                            onChange={(event) =>
                                              updatePlanExerciseField(
                                                plan.id,
                                                week.weekNumber,
                                                session.id,
                                                blockIndex,
                                                exerciseIndex,
                                                "intensityGuide",
                                                event.target.value
                                              )
                                            }
                                            className="w-32 rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                          />
                                        </div>

                                        <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                            Descanso
                                          </label>
                                          <input
                                            type="number"
                                            min="10"
                                            max="360"
                                            value={exercise.restSec}
                                            onChange={(event) =>
                                              updatePlanExerciseField(
                                                plan.id,
                                                week.weekNumber,
                                                session.id,
                                                blockIndex,
                                                exerciseIndex,
                                                "restSec",
                                                event.target.value
                                              )
                                            }
                                            className="w-24 rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                          />
                                        </div>

                                        <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                            Tempo
                                          </label>
                                          <input
                                            value={exercise.tempo || ""}
                                            onChange={(event) =>
                                              updatePlanExerciseField(
                                                plan.id,
                                                week.weekNumber,
                                                session.id,
                                                blockIndex,
                                                exerciseIndex,
                                                "tempo",
                                                event.target.value
                                              )
                                            }
                                            className="w-24 rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                            placeholder="3-1-1"
                                          />
                                        </div>

                                        <div className="rounded-md border border-white/15 bg-slate-700/70 px-2 py-2">
                                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                            RIR
                                          </label>
                                          <input
                                            value={exercise.rir || ""}
                                            onChange={(event) =>
                                              updatePlanExerciseField(
                                                plan.id,
                                                week.weekNumber,
                                                session.id,
                                                blockIndex,
                                                exerciseIndex,
                                                "rir",
                                                event.target.value
                                              )
                                            }
                                            className="w-20 rounded border border-white/20 bg-slate-700 px-2 py-1.5 text-xs text-white"
                                            placeholder="2"
                                          />
                                        </div>
                                      </div>

                                      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                        Justificacion IA
                                      </label>
                                      <textarea
                                        value={exercise.rationale}
                                        onChange={(event) =>
                                          updatePlanExerciseField(
                                            plan.id,
                                            week.weekNumber,
                                            session.id,
                                            blockIndex,
                                            exerciseIndex,
                                            "rationale",
                                            event.target.value
                                          )
                                        }
                                        className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        rows={2}
                                        placeholder="Por que se incluye este ejercicio"
                                      />

                                      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                        Observaciones del coach
                                      </label>
                                      <textarea
                                        value={exercise.notes || ""}
                                        onChange={(event) =>
                                          updatePlanExerciseField(
                                            plan.id,
                                            week.weekNumber,
                                            session.id,
                                            blockIndex,
                                            exerciseIndex,
                                            "notes",
                                            event.target.value
                                          )
                                        }
                                        className="mt-1 w-full rounded-md border border-white/20 bg-slate-700 px-2 py-2 text-xs text-white"
                                        rows={2}
                                        placeholder="Observaciones extra, regresiones o progresiones"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
