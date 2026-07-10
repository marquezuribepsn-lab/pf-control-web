"use client";

/**
 * Sandbox de diseño — pantalla de ENTRENAMIENTO del alumno (ruta pública).
 *
 * Reproduce fielmente el diseño hecho en Figma ("Gym app design" → TrainScreen):
 * paleta Lakers (fondo púrpura #552583 + acento dorado #FDB927 con glow),
 * tabs de sección, tarjeta hero con orbe y anillo giratorio, y CTA animado con
 * botón de glow pulsante. 100% presentacional, datos de mentira.
 *
 * Nota: usa estilos inline + SVG inline (sin lucide-react, que no está instalado)
 * para no depender de la hoja .pf-a3-* real. Sirve como mesa de trabajo para
 * validar el diseño antes de portarlo al componente real del alumno.
 */

import { useState } from "react";

/* ── Paleta MIX: estructura Figma + identidad naranja/acero de la app ──
 * Reemplazamos el púrpura/dorado Lakers por azul acero (fondos) + naranja
 * (acentos), que es la dirección que ya venimos usando en el resto del alumno. */
const STEEL = "#2f4a7a";              // azul acero — tintes de fondo (ex púrpura)
const ACCENT = "#ff9d55";             // naranja — texto/números/acentos (ex dorado)
const ACCENT_SOLID = "#f97316";       // naranja sólido — puntos, anillo, orbe
const GLOW = "rgba(249,123,52,.5)";   // glow naranja (ex glow dorado)
const ORANGE_BTN = "linear-gradient(160deg, #ff9048 0%, #f4700f 100%)"; // CTA energía

const GRAY_300 = "#CCCCCC";
const GRAY_400 = "#999999";
const GRAY_500 = "#666666";
const GREEN = "#2ECC71";

const KEYFRAMES = `
@keyframes pf-pulse-glow { 0%,100% { box-shadow: 0 0 12px 2px var(--glow-color); } 50% { box-shadow: 0 0 28px 8px var(--glow-color); } }
@keyframes pf-float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
@keyframes pf-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

/* ── Iconos inline (reemplazan lucide-react) ── */
function IcUser({ size = 11, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IcZap({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}
function IcPlay({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" aria-hidden="true">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}
function IcCheck({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ── Botón con glow reactivo ── */
function GlowButton({
  children,
  background,
  glow,
  onClick,
}: {
  children: React.ReactNode;
  background: string;
  glow: string;
  onClick?: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onClick}
      style={{
        width: "100%",
        fontWeight: 900,
        color: "#fff",
        borderRadius: "1rem",
        padding: "1rem",
        border: "none",
        cursor: "pointer",
        transition: "transform 120ms ease",
        transform: pressed ? "scale(0.96)" : "scale(1)",
        background,
        boxShadow: `0 0 18px 4px ${glow}`,
        animation: "pf-pulse-glow 2.4s ease-in-out infinite",
        ["--glow-color" as string]: glow,
      }}
    >
      {children}
    </button>
  );
}

const SECTIONS = [
  { id: "entrenamiento", label: "Entrenamiento" },
  { id: "nutricion", label: "Nutrición" },
  { id: "recuperacion", label: "Recuperación" },
] as const;

const STATS = [
  { label: "SESIONES\nASIGNADAS", value: "6" },
  { label: "TOTAL\nBLOQUES", value: "4" },
  { label: "TOTAL\nEJERCICIOS", value: "18" },
];

export default function SandboxDisenoEntrenamiento() {
  const [activeSection, setActiveSection] = useState<(typeof SECTIONS)[number]["id"]>("entrenamiento");
  const [started, setStarted] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#0F1923", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <style>{KEYFRAMES}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 390,
          minHeight: "100vh",
          background: "#2C3E50",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#fff",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem", background: "#1A252F" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${STEEL}, ${ACCENT_SOLID})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 13,
                color: "#fff",
              }}
            >
              PF
            </div>
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.02em" }}>Entrenar</span>
          </div>
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", padding: "0.75rem 1rem 1rem", gap: 8, overflowX: "auto" }}>
          {SECTIONS.map((s) => {
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                style={{
                  flexShrink: 0,
                  padding: "0.5rem 1rem",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "all 200ms ease",
                  ...(active
                    ? {
                        background: `linear-gradient(135deg, ${STEEL}, ${STEEL}bb)`,
                        color: ACCENT,
                        border: `1px solid ${ACCENT}66`,
                        boxShadow: `0 0 10px 2px ${GLOW}`,
                      }
                    : { color: "#666", background: "transparent", border: "1px solid transparent" }),
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {activeSection === "entrenamiento" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 1rem 1.5rem" }}>
            {/* Hero workout card */}
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "1.5rem",
                padding: "1.25rem",
                background: `linear-gradient(145deg, #1e2d3d 0%, ${STEEL}66 100%)`,
                border: `1px solid ${ACCENT}33`,
                boxShadow: `0 8px 32px ${GLOW}`,
              }}
            >
              {/* Orbe difuso */}
              <div
                style={{
                  position: "absolute",
                  right: -32,
                  top: -32,
                  width: 144,
                  height: 144,
                  borderRadius: "9999px",
                  opacity: 0.15,
                  filter: "blur(32px)",
                  background: ACCENT_SOLID,
                }}
              />
              {/* Anillo giratorio */}
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  top: 16,
                  width: 64,
                  height: 64,
                  borderRadius: "9999px",
                  opacity: 0.1,
                  border: `3px solid ${ACCENT_SOLID}`,
                  animation: "pf-spin-slow 8s linear infinite",
                }}
              />

              <h2 style={{ position: "relative", zIndex: 10, fontSize: 24, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
                FULL BODY —<br />
                <span style={{ color: ACCENT }}>FUERZA</span>
              </h2>
              <p style={{ position: "relative", zIndex: 10, fontSize: 10, color: GRAY_500, margin: "0 0 12px" }}>Actualizada el 07/07/2026</p>

              <div style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 20, height: 20, borderRadius: "9999px", background: `${ACCENT}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IcUser size={11} color={ACCENT} />
                </span>
                <span style={{ fontSize: 12, color: GRAY_300 }}>Valentino Márquez</span>
              </div>

              <div style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "9999px",
                    background: GREEN,
                    animation: "pf-pulse-glow 1.8s ease-in-out infinite",
                    ["--glow-color" as string]: "rgba(46,204,113,.8)",
                  }}
                />
                <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Sincronizado hace instantes
                </span>
              </div>

              <div style={{ position: "relative", zIndex: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      borderRadius: 12,
                      padding: 12,
                      textAlign: "center",
                      background: "rgba(0,0,0,.35)",
                      border: `1px solid ${ACCENT}22`,
                    }}
                  >
                    <p style={{ fontSize: 20, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: ACCENT, margin: 0 }}>{stat.value}</p>
                    <p style={{ fontSize: 8, color: GRAY_500, textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1.2, margin: "4px 0 0", whiteSpace: "pre-line" }}>
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA card */}
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "1.5rem",
                padding: "1.25rem",
                textAlign: "center",
                background: "#1e2d3d",
                border: `1px solid ${ACCENT}33`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.05,
                  backgroundImage: `repeating-linear-gradient(45deg, ${ACCENT_SOLID} 0, ${ACCENT_SOLID} 1px, transparent 0, transparent 50%)`,
                  backgroundSize: "12px 12px",
                }}
              />
              <div style={{ position: "relative", zIndex: 10 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    margin: "0 auto 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `linear-gradient(135deg, ${STEEL}, ${ACCENT_SOLID}55)`,
                    boxShadow: `0 0 20px 4px ${GLOW}`,
                    animation: "pf-float 3s ease-in-out infinite",
                  }}
                >
                  <IcZap size={28} color={ACCENT} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 900, margin: "0 0 2px" }}>
                  {started ? "¡En progreso!" : "Estás listo para entrenar"}
                </p>
                <p style={{ fontSize: 12, color: GRAY_400, margin: "0 0 16px" }}>5 ejercicios · ~45 min</p>
                <GlowButton
                  background={started ? "linear-gradient(135deg, #2ECC71, #27AE60)" : ORANGE_BTN}
                  glow={started ? "rgba(46,204,113,.6)" : GLOW}
                  onClick={() => setStarted((s) => !s)}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14 }}>
                    {started ? <IcCheck size={18} /> : <IcPlay size={18} />}
                    {started ? "Pausar entrenamiento" : "Comenzar a entrenar"}
                  </span>
                </GlowButton>
              </div>
            </div>
          </div>
        )}

        {activeSection === "nutricion" && (
          <div style={{ padding: "0 1rem" }}>
            <div style={{ borderRadius: "1.5rem", padding: "2rem", textAlign: "center", background: `linear-gradient(145deg, #1e2d3d, #007A3344)`, border: "1px solid #BA965322" }}>
              <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>Plan Nutricional</p>
              <p style={{ fontSize: 12, color: GRAY_500, margin: 0 }}>Próximamente con tu entrenador</p>
            </div>
          </div>
        )}

        {activeSection === "recuperacion" && (
          <div style={{ padding: "0 1rem" }}>
            <div style={{ borderRadius: "1.5rem", padding: "2rem", textAlign: "center", background: `linear-gradient(145deg, #1e2d3d, #1D428A44)`, border: "1px solid #FFC72C22" }}>
              <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>Rutinas de Recuperación</p>
              <p style={{ fontSize: 12, color: GRAY_500, margin: 0 }}>Próximamente</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
