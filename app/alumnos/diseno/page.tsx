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

        {/* ─────────────────────────────────────────────────────────────
            Pantalla: Progreso (capa pf-a2). Reproduce el JSX real de
            AlumnoVisionClient (activeCategory === "progreso") con datos de
            ejemplo, para poder ver e iterar su diseño sin login. */}
        <div
          style={{
            margin: "1.6rem 0 0.9rem",
            borderRadius: "0.8rem",
            border: "1px dashed rgba(167, 139, 250, 0.4)",
            background: "rgba(30, 20, 55, 0.5)",
            padding: "0.55rem 0.75rem",
            fontSize: "11.5px",
            color: "#c4b5fd",
          }}
        >
          Pantalla: Progreso — misma capa pf-a2 de las vistas internas.
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
              <p className="pf-a2-eyebrow">Ultima medicion</p>
              <h2 className="mt-1 text-xl font-black text-white">Antropometria</h2>

              <p className="mt-2 text-xs text-slate-400">Registro del 6 jul 2026, 08:00</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="pf-a2-kpi rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Peso</p>
                  <p className="mt-1 text-lg font-black text-white">78.4 kg</p>
                </div>
                <div className="pf-a2-kpi rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Agua</p>
                  <p className="mt-1 text-lg font-black text-white">2.5 L</p>
                </div>
                <div className="pf-a2-kpi rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Sueño</p>
                  <p className="mt-1 text-lg font-black text-white">7 h</p>
                </div>
                <div className="pf-a2-kpi rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Actividad</p>
                  <p className="mt-1 text-lg font-black text-white">6/10</p>
                </div>
              </div>

              <div className="pf-a2-drawer mt-4 rounded-xl border border-slate-500/45 bg-slate-900/40 p-3 text-sm text-slate-200">
                Variacion de peso vs registro anterior: -0.7 kg.
              </div>
            </article>

            <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
              <p className="pf-a2-eyebrow">Consistencia semanal</p>
              <h2 className="mt-1 text-xl font-black text-white">Ritmo de entreno</h2>
              <p className="mt-2 text-sm text-slate-300">
                En los ultimos 7 dias registraste 4 entradas de entrenamiento.
              </p>

              <div className="pf-a2-progress-track mt-3 h-2 overflow-hidden rounded-full bg-slate-700/70">
                <div className="pf-a2-progress-fill h-full rounded-full" style={{ width: "68%" }} />
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                Score 68/100
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="pf-a2-kpi rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Registros totales</p>
                  <p className="mt-1 text-lg font-black text-white">12</p>
                </div>
                <div className="pf-a2-kpi rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Check-ins</p>
                  <p className="mt-1 text-lg font-black text-white">9</p>
                </div>
              </div>
            </article>
          </div>

          <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
            <p className="pf-a2-eyebrow">Ultimos registros</p>
            <h2 className="mt-1 text-xl font-black text-white">Historial de entreno</h2>

            <div className="mt-3 space-y-2">
              {[
                { title: "Push A", ex: "Press banca", meta: "· 4 series · 8 reps · 60 kg", date: "5 jul 2026, 09:12", block: "Fuerza" },
                { title: "Pull A", ex: "Remo con barra", meta: "· 4 series · 10 reps · 50 kg", date: "3 jul 2026, 08:40", block: "Espalda" },
                { title: "Legs", ex: "Sentadilla", meta: "· 5 series · 6 reps · 80 kg", date: "1 jul 2026, 19:05", block: null },
              ].map((log, index) => (
                <div
                  key={index}
                  className="pf-a2-drawer rounded-xl border border-slate-600/45 bg-slate-900/45 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-100">{log.title}</p>
                    <p className="text-xs text-slate-400">{log.date}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {log.ex} {log.meta}
                  </p>
                  {log.block ? <p className="mt-1 text-xs text-slate-400">Bloque: {log.block}</p> : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
