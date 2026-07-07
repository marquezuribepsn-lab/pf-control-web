"use client";

/**
 * Sandbox de diseño del alumno (ruta pública, sin login).
 *
 * Reproduce los paneles reales del home del alumno con datos de mentira,
 * usando las MISMAS clases CSS (.pf-a3-*, .pf-alumno-v2) y los mismos
 * subcomponentes reales (FraseDelDia, PlanesDestacados). Sirve como mesa de
 * trabajo: acá se ve y se itera el diseño en vivo (sin necesidad de sesión) y
 * una vez aprobado el look, se porta a AlumnoVisionClient.
 *
 * No toca ni depende de la lógica real de datos/checkout; es 100% presentacional.
 */

import FraseDelDia from "@/components/FraseDelDia";
import PlanesDestacados from "@/components/PlanesDestacados";

const MUSIC_CARDS = [
  { id: "m1", title: "Beast Mode", artist: "Varios artistas", platform: "Spotify", type: "Playlist" },
  { id: "m2", title: "Cardio Pump", artist: "Running Hits", platform: "Spotify", type: "Playlist" },
  { id: "m3", title: "Focus Lift", artist: "Deep Gym", platform: "YouTube", type: "Video" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function SandboxDisenoAlumno() {
  const noop = () => {};

  return (
    <main
      className="pf-alumno-main pf-alumno-v2 pf-alumno-main-inicio"
      data-pf-alumno-category="inicio"
      style={{ minHeight: "100vh", background: "#08070d" }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0.9rem 0.9rem 3rem" }}>
        <div
          style={{
            marginBottom: "0.9rem",
            borderRadius: "0.8rem",
            border: "1px dashed rgba(167, 139, 250, 0.4)",
            background: "rgba(30, 20, 55, 0.5)",
            padding: "0.55rem 0.75rem",
            fontSize: "11.5px",
            color: "#c4b5fd",
          }}
        >
          Mesa de diseño — datos de ejemplo. Lo que quede acá se porta a los
          paneles reales del alumno.
        </div>

        <div className="pf-a3-home-stack">
          {/* Coach card */}
          <article className="pf-a3-coach-card">
            <div className="pf-a3-coach-top">
              <div className="pf-a3-coach-identity">
                <span className="pf-a3-coach-avatar" aria-hidden="true">
                  VM
                </span>
                <div className="min-w-0">
                  <p className="pf-a3-coach-name">Valentino Márquez</p>
                  <p className="pf-a3-coach-role">Tu entrenador</p>
                </div>
              </div>
              <span className="pf-a3-coach-star" aria-hidden="true">
                ★
              </span>
            </div>

            <div className="pf-a3-coach-meta-row">
              <div className="pf-a3-coach-meta-item">
                <p>12 clases</p>
                <span>Membresía</span>
              </div>
              <div className="pf-a3-coach-meta-item">
                <p>01 jul</p>
                <span>Desde</span>
              </div>
              <div className="pf-a3-coach-meta-item">
                <p>31 jul</p>
                <span>Hasta</span>
              </div>
            </div>
          </article>

          {/* Música */}
          <section className="pf-a3-panel-block">
            <div className="pf-a3-section-head">
              <div>
                <h2 className="pf-a3-section-title">Música</h2>
                <p className="pf-a3-section-subtitle">Playlist sugerida para hoy</p>
              </div>
              <button type="button" onClick={noop} className="pf-a3-link-btn">
                Ver
              </button>
            </div>

            <div className="pf-a3-music-scroll" role="list" aria-label="Playlists recomendadas">
              {MUSIC_CARDS.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={noop}
                  className="pf-a3-music-card pf-a3-music-card-action"
                  role="listitem"
                >
                  <div className="pf-a3-music-cover">
                    <div className="pf-a3-music-fallback-shell">
                      <span className="pf-a3-music-fallback-platform">{track.platform}</span>
                      <span className="pf-a3-music-fallback">{getInitials(track.title)}</span>
                      <span className="pf-a3-music-fallback-type">{track.type}</span>
                    </div>
                  </div>
                  <p className="pf-a3-music-title">{track.title}</p>
                  <p className="pf-a3-music-artist">{track.artist}</p>
                  <p className="pf-a3-music-hint">
                    {track.platform} · {track.type}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Frase del día (componente real) */}
          <FraseDelDia />

          {/* Carga rápida */}
          <section className="pf-a3-panel-block">
            <div className="pf-a3-section-head">
              <h2 className="pf-a3-section-title">Carga rápida</h2>
              <button type="button" onClick={noop} className="pf-a3-link-btn">
                Ver
              </button>
            </div>

            <div className="pf-a3-quick-grid">
              <button type="button" onClick={noop} className="pf-a3-quick-item">
                <span className="pf-a3-quick-icon pf-a3-quick-icon-agua" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
                    <path d="M12 3.8c2.7 3.1 5.2 6.2 5.2 9.2a5.2 5.2 0 1 1-10.4 0c0-3 2.5-6.1 5.2-9.2Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Agua</span>
              </button>

              <button type="button" onClick={noop} className="pf-a3-quick-item">
                <span className="pf-a3-quick-icon pf-a3-quick-icon-sueno" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
                    <path d="M4 14h16M6 10h6m8 0h-4" strokeLinecap="round" />
                    <path d="M5 14v3h2.5v-3M16.5 14v3H19v-3" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="3.5" y="7" width="17" height="7" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Sueño</span>
              </button>

              <button type="button" onClick={noop} className="pf-a3-quick-item">
                <span className="pf-a3-quick-icon pf-a3-quick-icon-progreso" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
                    <path d="M5 17.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" strokeLinecap="round" />
                    <path d="M8.5 10a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Progreso</span>
              </button>

              <button type="button" onClick={noop} className="pf-a3-quick-item">
                <span className="pf-a3-quick-icon pf-a3-quick-icon-pagos" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
                    <rect x="3.5" y="6" width="17" height="12" rx="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.5 10.5h11" strokeLinecap="round" />
                    <circle cx="8" cy="14.2" r="0.8" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span>Pagos</span>
              </button>
            </div>
          </section>

          {/* Peso y medidas */}
          <section className="pf-a3-panel-block pf-a3-panel-block-flat">
            <div className="pf-a3-section-head">
              <h2 className="pf-a3-section-title">Peso y medidas corporales</h2>
              <div className="pf-a3-head-actions">
                <button type="button" onClick={noop} className="pf-a3-icon-btn" aria-label="Actualizar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4" aria-hidden="true">
                    <path d="M20 12a8 8 0 1 1-2.3-5.6" strokeLinecap="round" />
                    <path d="M20 5v4h-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" onClick={noop} className="pf-a3-link-btn pf-a3-link-btn-strong">
                  Progreso
                </button>
              </div>
            </div>

            <div className="pf-a3-weight-content">
              <div className="pf-a3-weight-kpi-grid">
                <div>
                  <p className="pf-a3-weight-value">78.4</p>
                  <p className="pf-a3-weight-unit">kg</p>
                  <p className="pf-a3-weight-label">7 días</p>
                </div>
                <div>
                  <p className="pf-a3-weight-value">79.1</p>
                  <p className="pf-a3-weight-unit">kg</p>
                  <p className="pf-a3-weight-label">15 días</p>
                </div>
                <div>
                  <p className="pf-a3-weight-value">81.6</p>
                  <p className="pf-a3-weight-unit">kg</p>
                  <p className="pf-a3-weight-label">Histórico</p>
                </div>
              </div>

              <div className="pf-a3-chart-wrap" aria-label="Evolución de peso">
                <svg viewBox="0 0 300 170" className="pf-a3-weight-chart" preserveAspectRatio="none" role="img">
                  <line x1="12" y1="148" x2="288" y2="148" className="pf-a3-chart-axis" />
                  <line x1="12" y1="20" x2="12" y2="148" className="pf-a3-chart-axis" />
                  <polyline points="12,40 70,58 128,52 186,82 244,96 288,120" className="pf-a3-chart-line" />
                  <circle cx="288" cy="120" r="4" className="pf-a3-chart-dot" />
                </svg>
              </div>
            </div>
          </section>

          {/* Planes / Pagos (componente real) */}
          <PlanesDestacados daysRemaining={6} onSelectPlan={noop} canPay />
        </div>
      </div>
    </main>
  );
}
