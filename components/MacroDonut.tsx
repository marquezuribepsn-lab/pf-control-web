"use client";

/**
 * MacroDonut — dona de macronutrientes para el "Objetivo nutricional".
 * Muestra un anillo segmentado por macro + un valor central (kcal) y una
 * leyenda con gramos y porcentaje por macro. SVG puro, sin dependencias.
 */

export type MacroSegment = {
  label: string;
  ratio: number; // porcentaje 0..100
  grams?: number | string;
  color: string;
};

type Props = {
  segments: MacroSegment[];
  centerValue: string;
  centerLabel?: string;
  size?: number;
  stroke?: number;
};

export default function MacroDonut({
  segments,
  centerValue,
  centerLabel = "kcal",
  size = 132,
  stroke = 16,
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.ratio), 0) || 1;

  const arcs = segments.map((seg, i) => {
    const frac = Math.max(0, seg.ratio) / total;
    const len = frac * c;
    const dash = `${len} ${c - len}`;
    const prior = segments
      .slice(0, i)
      .reduce((acc, s) => acc + (Math.max(0, s.ratio) / total) * c, 0);
    const dashOffset = -prior;
    return { seg, dash, dashOffset };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          {arcs.map(({ seg, dash, dashOffset }, i) => (
            <circle
              key={`${seg.label}-${i}`}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 900, color: "#f8fcff", lineHeight: 1 }}>
            {centerValue}
          </span>
          {centerLabel && (
            <span style={{ fontSize: 11, color: "#9dc3e6", marginTop: 2 }}>{centerLabel}</span>
          )}
        </div>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, minWidth: 130 }}>
        {segments.map((seg, i) => (
          <li key={`${seg.label}-legend-${i}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: seg.color,
                flex: "0 0 auto",
              }}
            />
            <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 700 }}>{seg.label}</span>
            <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: "auto" }}>
              {seg.grams != null ? `${seg.grams} g · ` : ""}
              {Math.round(seg.ratio)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
