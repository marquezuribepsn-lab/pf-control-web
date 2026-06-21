/**
 * /api/progression/ia-generate
 *
 * Motor de Progresión con streaming SSE.
 * Procesa paso a paso y emite eventos en tiempo real:
 *   - step        → texto del paso actual
 *   - metrics     → RPE, fatiga, completitud
 *   - decision    → decisión + fase + delta
 *   - exercise    → nombre del ejercicio que se está calculando
 *   - complete    → ProgressionOutput completo
 *   - error       → mensaje de error
 *
 * Si ANTHROPIC_API_KEY está configurada, llama a Claude para
 * enriquecer el razonamiento y detectar alertas contextuales.
 */

import { NextRequest } from 'next/server';
import { getSessionUser, isStaffRole } from '@/lib/apiAuth';
import {
  analyzeWeekPerformance,
  detectPlateau,
  decideProgression,
  generateNextWeekPlan,
  DECISION_DELTAS,
  DECISION_LABELS,
  PHASE_LABELS,
  namesLikelyMatch,
  type ProgressionEngineInput,
  type ProgressionOutput,
  type WeekPerformanceMetrics,
  type ProgressionSemanaPlan,
  type WorkoutLogEntry,
  type SessionFeedbackEntry,
  type TrainingCompletionEntry,
  type ProgressionHistoryRecord,
} from '@/lib/trainingProgressionEngine';

export const maxDuration = 45;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const mkId  = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function buildMetricsText(m: WeekPerformanceMetrics): string {
  const parts: string[] = [];
  if (m.avgRpe !== null)     parts.push(`RPE ${m.avgRpe.toFixed(1)}/10`);
  if (m.avgFatigue !== null) parts.push(`Fatiga ${m.avgFatigue.toFixed(1)}/10`);
  parts.push(`Completitud ${Math.round(m.completionRate * 100)}%`);
  if (m.totalRealLoad > 0)   parts.push(`${Math.round(m.totalRealLoad)} kg acumulados`);
  return parts.join(' · ');
}

// ─────────────────────────────────────────────
// CLAUDE ENRICHMENT (opcional)
// ─────────────────────────────────────────────

type ClaudeEnrichment = {
  razonamientoGeneral: string;
  alertas: string[];
};

async function callClaudeForEnrichment(params: {
  personaName: string;
  metrics: WeekPerformanceMetrics;
  decision: string;
  phase: string;
  effectiveLoadDeltaPct: number;
  currentWeekPlan: ProgressionSemanaPlan;
  workoutLogs: WorkoutLogEntry[];
  ejercicioMap: Record<string, { categoria?: string; nombre?: string }>;
  rationaleEs: string;
}): Promise<ClaudeEnrichment | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const { personaName, metrics, decision, phase, effectiveLoadDeltaPct, currentWeekPlan, workoutLogs, ejercicioMap, rationaleEs } = params;

  // Build exercises summary
  const exercisesSummary: string[] = [];
  for (const dia of currentWeekPlan.dias ?? []) {
    if (!dia.entrenamiento) continue;
    for (const bloque of dia.entrenamiento.bloques ?? []) {
      for (const ex of bloque.ejercicios ?? []) {
        const info  = ejercicioMap[ex.ejercicioId] || {};
        const name  = info.nombre || ex.ejercicioId;
        const cat   = info.categoria || '—';
        const logs  = workoutLogs.filter((l) => namesLikelyMatch(l.alumnoNombre || '', personaName) && (l.exerciseId === ex.ejercicioId || (info.nombre && (l.exerciseName || '').toLowerCase() === info.nombre.toLowerCase())));
        const maxKg = logs.length > 0 ? Math.max(...logs.map((l) => l.pesoKg)) : null;
        exercisesSummary.push(
          `  • ${name} (${cat}): ${ex.series}x${ex.repeticiones} @ ${ex.carga || '—'}${maxKg !== null ? ` [real levantado: ${maxKg} kg]` : ''}`
        );
      }
    }
  }

  const prompt = `Sos un preparador físico especialista. Analizá el rendimiento semanal del alumno y generá un razonamiento profesional para el plan de la próxima semana.

ALUMNO: ${personaName}

RENDIMIENTO DE ESTA SEMANA:
- RPE promedio: ${metrics.avgRpe !== null ? `${metrics.avgRpe.toFixed(1)}/10` : 'sin datos'}
- Fatiga promedio: ${metrics.avgFatigue !== null ? `${metrics.avgFatigue.toFixed(1)}/10` : 'sin datos'}
- Sesiones completadas: ${metrics.sessionsCompleted}/${metrics.sessionsPlanned} (${Math.round(metrics.completionRate * 100)}%)
- Carga total registrada: ${metrics.totalRealLoad > 0 ? `${metrics.totalRealLoad} kg` : 'sin registros'}
- Molestias reportadas: ${metrics.painReportCount}

EJERCICIOS SEMANA ACTUAL:
${exercisesSummary.join('\n') || '  (sin ejercicios registrados)'}

DECISIÓN DEL SISTEMA: ${DECISION_LABELS[decision as keyof typeof DECISION_LABELS] || decision}
FASE: ${PHASE_LABELS[phase as keyof typeof PHASE_LABELS] || phase}
DELTA DE CARGA APLICADO: ${effectiveLoadDeltaPct > 0 ? '+' : ''}${effectiveLoadDeltaPct}%

RAZONAMIENTO BASE:
${rationaleEs}

TAREA:
1. Escribí un razonamiento detallado y profesional (2-4 oraciones) explicando la estrategia para la próxima semana, considerando el nivel percibido real del alumno y las cargas registradas.
2. Si hay algo que amerite atención especial (molestias, fatiga alta, bajo cumplimiento, diferencia entre carga prescrita y real), listalo como alerta.

Respondé SOLO con JSON válido, sin texto adicional:
{
  "razonamientoGeneral": "...",
  "alertas": ["...", "..."]
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json() as { content?: Array<{ type: string; text: string }> };
    const text = data.content?.find((c) => c.type === 'text')?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as ClaudeEnrichment;
    return parsed;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return new Response('No autenticado', { status: 401 });
  }
  if (!isStaffRole(sessionUser.role)) {
    return new Response('No autorizado', { status: 403 });
  }

  let body: Partial<ProgressionEngineInput> & { historicalRecords?: ProgressionHistoryRecord[] };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const {
    ownerKey, personaName, currentWeekPlan, weekNumberInPlan,
    workoutLogs, sessionFeedbacks, trainingCompletions,
    ejercicioMap, historicalRecords, manualOverridePct,
  } = body;

  if (!ownerKey || !personaName || !currentWeekPlan || weekNumberInPlan == null) {
    return new Response('Missing required fields', { status: 400 });
  }

  const logs        = (workoutLogs       as WorkoutLogEntry[])       || [];
  const feedbacks   = (sessionFeedbacks  as SessionFeedbackEntry[])  || [];
  const completions = (trainingCompletions as TrainingCompletionEntry[]) || [];
  const exMap       = (ejercicioMap as Record<string, { categoria?: string; nombre?: string }>) || {};
  const history     = (historicalRecords as ProgressionHistoryRecord[]) || [];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      try {
        // ── PASO 1: ANÁLISIS DE RENDIMIENTO ──────────────────────
        send({ type: 'step', text: `Leyendo rendimiento de ${personaName}…` });
        await sleep(350);

        const metrics = analyzeWeekPerformance({
          ownerKey: ownerKey!,
          personaName: personaName!,
          currentWeekPlan: currentWeekPlan!,
          workoutLogs: logs,
          sessionFeedbacks: feedbacks,
          trainingCompletions: completions,
        });

        if (metrics.hasData) {
          send({ type: 'metrics', text: buildMetricsText(metrics), rpe: metrics.avgRpe, fatigue: metrics.avgFatigue, completion: metrics.completionRate });
          await sleep(400);
        } else {
          send({ type: 'step', text: 'Sin registros — usando posición en el mesociclo.' });
          await sleep(300);
        }

        // ── PASO 2: HISTORIAL Y PLATEAU ───────────────────────────
        send({ type: 'step', text: 'Revisando historial de progresión…' });
        await sleep(300);

        const personHistory = history.filter((r) => r.ownerKey === ownerKey);
        const plateau       = detectPlateau(personHistory);

        if (plateau.detected) {
          send({ type: 'step', text: `⚠ Plateau detectado — ${plateau.consecutiveLowStimulus} semanas de bajo estímulo` });
          await sleep(400);
        } else if (personHistory.length > 0) {
          const lastRecord = personHistory.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0];
          send({ type: 'step', text: `Última semana: ${lastRecord.weekLabel} (${DECISION_LABELS[lastRecord.decision]})` });
          await sleep(300);
        }

        // ── PASO 3: DECISIÓN DE PROGRESIÓN ────────────────────────
        send({ type: 'step', text: 'Formulando estrategia de carga…' });
        await sleep(450);

        const { decision, phase, rationaleEs, effectiveLoadDeltaPct } = decideProgression(
          metrics,
          weekNumberInPlan!,
          plateau,
          manualOverridePct ?? null
        );

        send({
          type: 'decision',
          decision,
          phase,
          delta: effectiveLoadDeltaPct,
          text: `${DECISION_LABELS[decision]} · ${effectiveLoadDeltaPct > 0 ? '+' : ''}${effectiveLoadDeltaPct}% carga · ${PHASE_LABELS[phase]}`,
        });
        await sleep(350);

        // ── PASO 4: CÁLCULO EJERCICIO POR EJERCICIO ───────────────
        send({ type: 'step', text: 'Calculando cargas para cada ejercicio…' });

        // Recopilar ejercicios para emitirlos uno por uno
        const allExercises: { id: string; nombre: string }[] = [];
        for (const dia of currentWeekPlan?.dias ?? []) {
          if (!dia.entrenamiento) continue;
          for (const bloque of dia.entrenamiento.bloques ?? []) {
            for (const ex of bloque.ejercicios ?? []) {
              allExercises.push({
                id:     ex.ejercicioId,
                nombre: exMap[ex.ejercicioId]?.nombre || ex.ejercicioId,
              });
            }
          }
        }

        const delayPerEx = allExercises.length > 0
          ? Math.min(200, Math.max(70, 1400 / allExercises.length))
          : 0;

        for (const ex of allExercises) {
          send({ type: 'exercise', name: ex.nombre });
          await sleep(delayPerEx);
        }

        // ── PASO 5: ENRIQUECIMIENTO IA (si hay API key) ───────────
        let enrichedRationale = rationaleEs;
        let aiAlerts: string[] = [];
        const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

        if (hasKey) {
          send({ type: 'step', text: 'IA revisando valores y corrigiendo…' });
          await sleep(200);

          const aiResult = await callClaudeForEnrichment({
            personaName: personaName!,
            metrics,
            decision,
            phase,
            effectiveLoadDeltaPct,
            currentWeekPlan: currentWeekPlan!,
            workoutLogs: logs,
            ejercicioMap: exMap,
            rationaleEs,
          });

          if (aiResult) {
            if (aiResult.razonamientoGeneral?.trim()) {
              enrichedRationale = aiResult.razonamientoGeneral.trim();
            }
            if (Array.isArray(aiResult.alertas)) {
              aiAlerts = aiResult.alertas.filter(Boolean);
            }
            send({ type: 'step', text: '✓ Análisis IA completado' });
          } else {
            send({ type: 'step', text: '(continuando con motor algorítmico)' });
          }
          await sleep(250);
        }

        // ── PASO 6: GENERACIÓN DEL PLAN ───────────────────────────
        const nextWeekNumber = weekNumberInPlan! + 1;
        send({ type: 'step', text: `Preparando Semana ${nextWeekNumber} · ${PHASE_LABELS[phase]}…` });
        await sleep(250);

        const personaLogs = logs.filter((l) => namesLikelyMatch(l.alumnoNombre || '', personaName!));

        const nextWeekPlan = generateNextWeekPlan({
          currentWeekPlan: currentWeekPlan!,
          decision,
          phase,
          weekNumber: nextWeekNumber,
          rationaleEs: enrichedRationale,
          effectiveLoadDeltaPct,
          personaWorkoutLogs: personaLogs,
          ejercicioMap: exMap,
        });

        const deltas       = DECISION_DELTAS[decision];
        const weekLabel    = `Semana ${nextWeekNumber} · ${PHASE_LABELS[phase]}`;
        const generatedAt  = new Date().toISOString();

        const historyRecord: ProgressionHistoryRecord = {
          id: mkId(),
          ownerKey:           ownerKey!,
          personaNombre:      personaName!,
          generatedAt,
          weekNumberInPlan:   weekNumberInPlan!,
          weekLabel,
          decision,
          phase,
          loadDeltaPct:       effectiveLoadDeltaPct,
          intensityDeltaPct:  deltas.intensityDeltaPct,
          seriesDelta:        deltas.seriesDelta,
          metrics,
          rationaleEs:        enrichedRationale,
          manualOverride:     manualOverridePct !== null && manualOverridePct !== undefined,
          overrideLoadDeltaPct: manualOverridePct ?? undefined,
          plateauDetected:    plateau.detected,
        };

        const result: ProgressionOutput & { aiAlerts?: string[] } = {
          decision, phase, metrics,
          loadDeltaPct:      effectiveLoadDeltaPct,
          intensityDeltaPct: deltas.intensityDeltaPct,
          seriesDelta:       deltas.seriesDelta,
          rationaleEs:       enrichedRationale,
          weekLabel, generatedAt,
          nextWeekPlan, plateau, historyRecord,
          aiAlerts: aiAlerts.length > 0 ? aiAlerts : undefined,
        };

        // ── FINAL ─────────────────────────────────────────────────
        send({ type: 'step', text: `✓ Plan listo — ${weekLabel}` });
        await sleep(150);
        send({ type: 'complete', result });

      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Error al generar el plan' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disables nginx buffering for SSE
    },
  });
}
