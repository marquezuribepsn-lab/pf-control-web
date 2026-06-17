/**
 * POST /api/alumno/checkin-analyze
 * Analyzes free-text from a weekly check-in using Claude.
 * If ANTHROPIC_API_KEY is not set, returns a lightweight rule-based fallback.
 *
 * Body: { texto: string; tipo: "dolor" | "cambios" | "general" }
 * Returns: { nivel: "bajo"|"medio"|"alto"; resumen: string; alertaProfe: boolean; palabrasClave: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendWhatsAppInternalAlert } from "@/lib/whatsappAlerts";

type AnalysisResult = {
  nivel:        "bajo" | "medio" | "alto";
  resumen:      string;
  alertaProfe:  boolean;
  palabrasClave: string[];
};

// ── Keyword-based fallback (no API key) ──────────────────────────
const PAIN_HIGH_WORDS  = ["intenso","fuerte","insoportable","agudo","punzante","no puedo","hinchado","inflamad","fractura","roto","rota","cargado","lesion","lesión"];
const PAIN_MED_WORDS   = ["molestia","duele","dolor","ardor","incomodo","incómodo","tirantez","tension","tensión","rigidez"];
const CHANGE_HIGH_WORDS= ["operacion","operación","cirugía","cirugia","embarazada","embarazo","accidente","internado","hospital","enferm"];
const CHANGE_MED_WORDS = ["viaje","trabajo","estres","estrés","descanso","cansancio","dieta","mudanza","examen"];

function ruleBasedAnalysis(texto: string, tipo: string): AnalysisResult {
  const t = texto.toLowerCase();
  const words = t.split(/\s+/);

  const hasPainHigh   = PAIN_HIGH_WORDS.some((w) => t.includes(w));
  const hasPainMed    = PAIN_MED_WORDS.some((w) => t.includes(w));
  const hasChangeHigh = CHANGE_HIGH_WORDS.some((w) => t.includes(w));
  const hasChangeMed  = CHANGE_MED_WORDS.some((w) => t.includes(w));

  const keywords = words.filter(
    (w) => w.length > 4 && [...PAIN_HIGH_WORDS, ...PAIN_MED_WORDS, ...CHANGE_HIGH_WORDS, ...CHANGE_MED_WORDS].some((kw) => kw.includes(w) || w.includes(kw))
  ).slice(0, 5);

  if (tipo === "dolor") {
    if (hasPainHigh) return { nivel: "alto", resumen: "Reporte de dolor intenso — revisión recomendada.", alertaProfe: true, palabrasClave: keywords };
    if (hasPainMed)  return { nivel: "medio", resumen: "Menciona molestia o incomodidad moderada.", alertaProfe: false, palabrasClave: keywords };
    return { nivel: "bajo", resumen: "Sin señales de alarma en el reporte de dolor.", alertaProfe: false, palabrasClave: [] };
  }

  if (hasChangeHigh) return { nivel: "alto", resumen: "Cambio significativo en la vida del alumno.", alertaProfe: true, palabrasClave: keywords };
  if (hasChangeMed)  return { nivel: "medio", resumen: "Menciona cambios en rutina o contexto personal.", alertaProfe: false, palabrasClave: keywords };
  return { nivel: "bajo", resumen: "Sin cambios relevantes reportados.", alertaProfe: false, palabrasClave: [] };
}

// ── Claude analysis ───────────────────────────────────────────────
async function claudeAnalysis(texto: string, tipo: string): Promise<AnalysisResult | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const prompt = tipo === "dolor"
    ? `Analizá este reporte de dolor/molestia de un alumno de gimnasio. Respondé SOLO JSON sin texto adicional.
Texto: "${texto}"
JSON esperado: { "nivel": "bajo"|"medio"|"alto", "resumen": "1 oración profesional", "alertaProfe": true|false, "palabrasClave": ["array","de","palabras","clave"] }
- nivel alto = lesión seria, dolor intenso/agudo, zona articular
- nivel medio = molestia moderada, incomodidad habitual
- nivel bajo = sin señales de alarma
- alertaProfe = true solo si nivel alto`
    : `Analizá este texto libre de un alumno sobre cambios en su semana/rutina. Respondé SOLO JSON sin texto adicional.
Texto: "${texto}"
JSON esperado: { "nivel": "bajo"|"medio"|"alto", "resumen": "1 oración profesional", "alertaProfe": true|false, "palabrasClave": ["array","de","palabras","clave"] }
- nivel alto = cambio de vida importante (enfermedad, cirugía, accidente, etc.)
- nivel medio = cambio de contexto relevante para el entrenamiento (viaje, trabajo, estrés)
- nivel bajo = sin cambios relevantes
- alertaProfe = true solo si nivel alto`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json() as { content?: Array<{ type: string; text: string }> };
    const text = data.content?.find((c) => c.type === "text")?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as AnalysisResult;
    // Validate shape
    if (!["bajo","medio","alto"].includes(parsed.nivel)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { texto?: string; tipo?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const texto = String(body.texto || "").trim();
  const tipo  = String(body.tipo  || "general");

  if (!texto || texto.length < 5) {
    return NextResponse.json({ nivel: "bajo", resumen: "Texto insuficiente para analizar.", alertaProfe: false, palabrasClave: [] });
  }

  // Cap text length to avoid abuse
  const textoCapped = texto.slice(0, 500);

  const result = (await claudeAnalysis(textoCapped, tipo)) ?? ruleBasedAnalysis(textoCapped, tipo);

  // WhatsApp al profe si el nivel es alto — sin tokens extra (reutiliza el análisis)
  if (result.alertaProfe) {
    const alumnoNombre = (session.user as { name?: string }).name || "Un alumno";
    const tipoLabel    = tipo === "dolor" ? "🚨 Dolor/molestia" : "⚠️ Cambio importante";
    const msg = `${tipoLabel} — *${alumnoNombre}*\n\n"${textoCapped.slice(0, 120)}${textoCapped.length > 120 ? "…" : ""}"\n\n_${result.resumen}_\n\npf-control.com/alertas`;
    sendWhatsAppInternalAlert(msg).catch(() => { /* silencioso */ });
  }

  return NextResponse.json(result);
}
