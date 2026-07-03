"use client";

/**
 * PlanesDestacados
 * Selector visual de planes para el centro de pagos del alumno, inspirado en las
 * capturas (tarjetas con borde lateral de color, precio tachado + descuento,
 * urgencia "Quedan X días con este precio" e "Incluye"). El botón "Pagar con
 * Mercado Pago" reutiliza el checkout real existente (que cobra el monto de
 * renovación configurado por el admin), por lo que estas tarjetas son una capa
 * presentacional de marketing sobre el flujo de cobro ya implementado.
 *
 * Es aditiva y autocontenida: recibe el monto real por props y no toca la lógica
 * de estado/checkout del cliente de pagos.
 */

type Plan = {
  id: string;
  title: string;
  subtitle: string;
  border: string;
  glow: string;
  originalPrice: number;
  price: number;
  discountPct: number;
  highlighted?: boolean;
  badge?: string;
  includes: string[];
};

const PLANS: Plan[] = [
  {
    id: "12-clases",
    title: "12 clases",
    subtitle: "3 por semana · 30 días",
    border: "#ef4444",
    glow: "rgba(239, 68, 68, 0.28)",
    originalPrice: 48000,
    price: 39000,
    discountPct: 19,
    highlighted: true,
    badge: "Más elegido",
    includes: [
      "Rutina y plan nutricional al día",
      "Seguimiento de progreso completo",
      "Acceso a todas las franjas horarias",
    ],
  },
  {
    id: "8-clases",
    title: "8 clases",
    subtitle: "2 por semana · 30 días",
    border: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.26)",
    originalPrice: 36000,
    price: 31000,
    discountPct: 14,
    includes: [
      "Rutina personalizada mensual",
      "Seguimiento de progreso",
      "Franjas horarias seleccionadas",
    ],
  },
];

function formatARS(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `$${safe.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type Props = {
  daysRemaining?: number | null;
  onSelectPlan: () => void;
  checkoutLoading?: boolean;
  canPay?: boolean;
};

export default function PlanesDestacados({
  daysRemaining,
  onSelectPlan,
  checkoutLoading = false,
  canPay = true,
}: Props) {
  const promoDays =
    typeof daysRemaining === "number" && daysRemaining > 0 ? daysRemaining : 6;

  return (
    <section
      style={{
        position: "relative",
        borderRadius: "1.2rem",
        border: "1px solid rgba(167, 139, 250, 0.22)",
        background:
          "linear-gradient(160deg, rgba(27, 20, 48, 0.92) 0%, rgba(20, 15, 34, 0.94) 100%)",
        padding: "1.05rem 1.05rem 1.15rem",
        boxShadow: "0 18px 40px rgba(10, 6, 22, 0.5)",
        color: "#f5f3fb",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "10.5px",
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#a78bfa",
            }}
          >
            Planes disponibles
          </p>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.15rem", fontWeight: 900, color: "#fff" }}>
            Elegí tu pase mensual
          </h2>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.32rem",
            borderRadius: "999px",
            border: "1px solid rgba(245, 158, 11, 0.42)",
            background: "rgba(245, 158, 11, 0.14)",
            color: "#fbbf24",
            padding: "0.24rem 0.62rem",
            fontSize: "11px",
            fontWeight: 800,
          }}
        >
          ⏳ Quedan {promoDays} días con este precio
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.85rem",
          marginTop: "0.95rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            style={{
              position: "relative",
              borderRadius: "0.95rem",
              borderLeft: `5px solid ${plan.border}`,
              border: "1px solid rgba(167, 139, 250, 0.16)",
              borderLeftWidth: "5px",
              borderLeftColor: plan.border,
              background: `linear-gradient(180deg, ${plan.glow} 0%, rgba(15, 11, 26, 0) 62%), rgba(18, 13, 30, 0.82)`,
              padding: "0.95rem 0.95rem 1rem",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900, color: "#fff" }}>{plan.title}</h3>
                <p style={{ margin: "0.15rem 0 0", fontSize: "12px", color: "#c4b5fd", fontWeight: 600 }}>
                  {plan.subtitle}
                </p>
              </div>
              {plan.badge ? (
                <span
                  style={{
                    borderRadius: "999px",
                    background: plan.border,
                    color: "#fff",
                    padding: "0.2rem 0.55rem",
                    fontSize: "10px",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {plan.badge}
                </span>
              ) : null}
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", marginTop: "0.7rem" }}>
              <span style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {formatARS(plan.price)}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  color: "#94a3b8",
                  textDecoration: "line-through",
                  marginBottom: "0.15rem",
                }}
              >
                {formatARS(plan.originalPrice)}
              </span>
              <span
                style={{
                  marginBottom: "0.15rem",
                  borderRadius: "999px",
                  background: "rgba(34, 197, 94, 0.16)",
                  border: "1px solid rgba(34, 197, 94, 0.4)",
                  color: "#4ade80",
                  padding: "0.14rem 0.5rem",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                -{plan.discountPct}%
              </span>
            </div>
            <p style={{ margin: "0.28rem 0 0", fontSize: "11.5px", color: "#94a3b8" }}>por mes</p>

            <ul style={{ listStyle: "none", margin: "0.8rem 0 0", padding: 0, display: "grid", gap: "0.4rem" }}>
              {plan.includes.map((item) => (
                <li key={item} style={{ display: "flex", gap: "0.45rem", fontSize: "12.5px", color: "#e2ddf5" }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={plan.border} strokeWidth="2.6" style={{ flexShrink: 0, marginTop: "1px" }} aria-hidden="true">
                    <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onSelectPlan}
              disabled={!canPay || checkoutLoading}
              style={{
                marginTop: "1rem",
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                borderRadius: "0.75rem",
                border: 0,
                background: canPay
                  ? "linear-gradient(120deg, #8b5cf6 0%, #7c3aed 100%)"
                  : "rgba(124, 58, 237, 0.35)",
                color: "#fff",
                padding: "0.6rem 0.9rem",
                fontSize: "13px",
                fontWeight: 800,
                cursor: !canPay || checkoutLoading ? "not-allowed" : "pointer",
                opacity: !canPay || checkoutLoading ? 0.6 : 1,
                boxShadow: canPay ? "0 10px 22px rgba(124, 58, 237, 0.35)" : "none",
              }}
            >
              {checkoutLoading ? "Redirigiendo..." : "Pagar con Mercado Pago"}
            </button>
          </article>
        ))}
      </div>

      <p style={{ margin: "0.85rem 0 0", fontSize: "11px", color: "#8b82a8", textAlign: "center" }}>
        El cobro se procesa por el monto de renovación vigente configurado por tu centro.
      </p>
    </section>
  );
}
