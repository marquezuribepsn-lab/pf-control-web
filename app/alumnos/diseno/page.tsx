"use client";

/**
 * Sandbox de diseño del alumno (ruta pública, sin login).
 *
 * Reproduce las pantallas del alumno con datos de mentira usando las MISMAS
 * clases CSS que la vista real (.pf-n-*, ver `app/alumno-nuevo.css`). Sirve
 * como mesa de trabajo: acá se ve y se itera el diseño en vivo sin necesidad
 * de sesión, y una vez aprobado el look se porta a AlumnoVisionClient.
 *
 * Es 100% presentacional: no usa hooks de datos ni providers, así que puede
 * renderizarse fuera del árbol autenticado.
 */

import { useState } from "react";

const RING_C = 2 * Math.PI * 18;
const HERO_C = 2 * Math.PI * 25;

function dash(pct: number, c: number): string {
  return `${(Math.max(0, Math.min(100, pct)) / 100) * c} ${c}`;
}

const SEMANA = [
  { dow: "L", num: 27 },
  { dow: "M", num: 28 },
  { dow: "X", num: 29, hoy: true },
  { dow: "J", num: 30 },
  { dow: "V", num: 31 },
  { dow: "S", num: 1 },
  { dow: "D", num: 2 },
];

type Pantalla = "inicio" | "rutina" | "cuenta";

export default function SandboxDisenoAlumno() {
  const [pantalla, setPantalla] = useState<Pantalla>("inicio");

  return (
    <main className="pf-n" data-pf-alumno-category={pantalla}>
      <div className="pf-n-stage">
        <div
          style={{
            marginBottom: "18px",
            borderRadius: "12px",
            border: "1px dashed rgba(255,255,255,0.2)",
            padding: "8px 12px",
            fontSize: "11px",
            color: "rgba(245,246,250,0.5)",
          }}
        >
          Mesa de diseño — datos de ejemplo.
        </div>

        {pantalla === "inicio" ? <Inicio /> : null}
        {pantalla === "rutina" ? <Rutina /> : null}
        {pantalla === "cuenta" ? <Cuenta /> : null}
      </div>

      <nav className="pf-n-nav" aria-label="Navegación principal del alumno">
        <button
          type="button"
          className="pf-n-nav-item"
          aria-current={pantalla === "rutina" ? "page" : undefined}
          onClick={() => setPantalla("rutina")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <rect x="1" y="8" width="3" height="4" rx="1" fill="currentColor" />
            <rect x="16" y="8" width="3" height="4" rx="1" fill="currentColor" />
            <rect x="5" y="6" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span className="pf-n-nav-label">Rutina</span>
        </button>
        <button
          type="button"
          className="pf-n-nav-item"
          aria-current={pantalla === "inicio" ? "page" : undefined}
          onClick={() => setPantalla("inicio")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M3 9L10 3L17 9V17H12V12H8V17H3V9Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span className="pf-n-nav-label">Inicio</span>
        </button>
        <button
          type="button"
          className="pf-n-nav-item"
          aria-current={pantalla === "cuenta" ? "page" : undefined}
          onClick={() => setPantalla("cuenta")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="6.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M3 18C3 14 6 12 10 12C14 12 17 14 17 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className="pf-n-nav-label">Cuenta</span>
        </button>
      </nav>
    </main>
  );
}

function Inicio() {
  return (
    <div className="pf-n-screen">
      <div className="pf-n-home-head">
        <div>
          <h1 className="pf-n-home-greeting">
            Buenos días,
            <br />
            <span className="pf-n-home-name">Pablo</span>
          </h1>
          <p className="pf-n-home-subline">Preparado para comenzar a entrenar.</p>
        </div>

        <div className="pf-n-home-actions">
          <span className="pf-n-avatar" title="En línea">
            <span className="pf-n-avatar-initials">PM</span>
            <span className="pf-n-avatar-dot" aria-hidden="true" />
          </span>
          <span className="pf-n-bell" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 20 20">
              <path
                d="M10 2C7 2 5 4.5 5 8V11L3 14H17L15 11V8C15 4.5 13 2 10 2Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="17" r="1.5" fill="currentColor" />
            </svg>
            <span className="pf-n-bell-dot" />
          </span>
        </div>
      </div>

      <div className="pf-n-hero">
        <div className="pf-n-hero-body">
          <span className="pf-n-hero-ring" aria-hidden="true">
            <svg width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />
              <circle
                cx="30"
                cy="30"
                r="25"
                fill="none"
                stroke="#67e8f9"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={dash(0, HERO_C)}
              />
            </svg>
            <span className="pf-n-hero-ring-icon">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <rect x="1" y="10" width="4" height="4" rx="1" fill="#fff" />
                <rect x="19" y="10" width="4" height="4" rx="1" fill="#fff" />
                <rect x="6" y="8" width="3" height="8" rx="1" fill="#fff" />
                <rect x="15" y="8" width="3" height="8" rx="1" fill="#fff" />
                <rect x="9" y="11" width="6" height="2" fill="#fff" />
              </svg>
            </span>
          </span>
          <div className="pf-n-hero-text">
            <p className="pf-n-eyebrow">Tu entrenamiento</p>
            <p className="pf-n-hero-title">Rutina de hoy</p>
            <p className="pf-n-hero-meta">4 ejercicios · Lunes</p>
          </div>
        </div>
        <button type="button" className="pf-n-cta">
          Comenzar entrenamiento <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="pf-n-rings">
        <span className="pf-n-ring">
          <span className="pf-n-ring-track">
            <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(129,140,248,0.2)" strokeWidth="4" />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="#818cf8"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={dash(0, RING_C)}
              />
            </svg>
            <span className="pf-n-ring-icon" style={{ color: "#818cf8" }} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <rect x="1" y="10" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="19" y="10" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
              </svg>
            </span>
          </span>
          <span className="pf-n-ring-value">
            0<span>/5</span>
          </span>
          <span className="pf-n-ring-label">Entrenos</span>
        </span>

        <span className="pf-n-vrule" aria-hidden="true" />

        <span className="pf-n-ring">
          <span className="pf-n-ring-track">
            <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(96,165,250,0.2)" strokeWidth="4" />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={dash(0, RING_C)}
              />
            </svg>
            <span className="pf-n-ring-icon" aria-hidden="true">
              <span
                style={{ width: 13, height: 13, borderRadius: "50%", background: "#60a5fa", opacity: 0.85, display: "block" }}
              />
            </span>
          </span>
          <span className="pf-n-ring-value">
            0<span>/8</span>
          </span>
          <span className="pf-n-ring-label">Agua</span>
        </span>

        <span className="pf-n-vrule" aria-hidden="true" />

        <span className="pf-n-ring">
          <span className="pf-n-ring-track pf-n-ring-track-static">
            <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(196,181,253,0.25)" strokeWidth="4" strokeDasharray="3 4" />
            </svg>
            <span className="pf-n-ring-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 20 20">
                <path d="M15 10.5A6 6 0 1 1 9.5 5A7.5 7.5 0 0 0 15 10.5Z" fill="#c4b5fd" />
              </svg>
            </span>
          </span>
          <span className="pf-n-ring-value">—</span>
          <span className="pf-n-ring-label">Sueño</span>
        </span>
      </div>

      <div className="pf-n-quote">
        <p>Cuida tu cuerpo, es el único lugar que tienes para vivir.</p>
      </div>

      <h2 className="pf-n-heading">Acciones rápidas</h2>
      <div className="pf-n-quick">
        <button type="button" className="pf-n-quick-item">
          <span className="pf-n-quick-icon" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 20 20">
              <circle cx="10" cy="6.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M3 18C3 14 6 12 10 12C14 12 17 14 17 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="pf-n-quick-label">Progreso</span>
        </button>
        <button type="button" className="pf-n-quick-item">
          <span className="pf-n-quick-icon" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 20 20">
              <rect x="2" y="5" width="16" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <rect x="2" y="8" width="16" height="2.4" fill="currentColor" />
            </svg>
          </span>
          <span className="pf-n-quick-label">Pagos</span>
        </button>
        <button type="button" className="pf-n-quick-item">
          <span className="pf-n-quick-icon" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 20 20">
              <circle cx="5" cy="15" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="15" cy="13" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M7.6 15V5.5L17.6 3.5V13" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <span className="pf-n-quick-label">Música</span>
        </button>
      </div>

      <div className="pf-n-week">
        {SEMANA.map((d) => (
          <span key={d.dow} className={`pf-n-week-day${d.hoy ? " pf-n-week-day-today" : ""}`}>
            <span className="pf-n-week-dow">{d.dow}</span>
            <span className="pf-n-week-num">{d.num}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Rutina() {
  return (
    <div className="pf-n-screen pf-n-screen-glow">
      <div className="pf-n-routine-head">
        <p className="pf-n-eyebrow">Train</p>
        <h1 className="pf-n-title">Plan de entrenamiento</h1>
      </div>

      <div className="pf-n-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="true" className="pf-n-tab">
          <div className="pf-n-tab-text">Entrenamiento</div>
          <div className="pf-n-tab-underline" />
        </button>
        <button type="button" role="tab" aria-selected="false" className="pf-n-tab">
          <div className="pf-n-tab-text">Nutrición</div>
          <div className="pf-n-tab-underline" />
        </button>
        <button type="button" role="tab" aria-selected="false" className="pf-n-tab">
          <div className="pf-n-tab-text">Recuperación</div>
          <div className="pf-n-tab-underline" />
        </button>
      </div>

      <h2 className="pf-n-day-title">Lunes</h2>
      <div className="pf-n-coach">
        <span className="pf-n-coach-avatar">VM</span>
        <span className="pf-n-coach-name">Valentino Marquez Uribe</span>
      </div>
      <p className="pf-n-sync">Última sincronización: 29/07/2026, 07:06 a. m.</p>

      <div className="pf-n-stats">
        <div className="pf-n-stat">
          <span className="pf-n-stat-value">3</span>
          <span className="pf-n-stat-label">Sesiones</span>
        </div>
        <span className="pf-n-vrule" />
        <div className="pf-n-stat">
          <span className="pf-n-stat-value">2</span>
          <span className="pf-n-stat-label">Bloques</span>
        </div>
        <span className="pf-n-vrule" />
        <div className="pf-n-stat">
          <span className="pf-n-stat-value">8</span>
          <span className="pf-n-stat-label">Ejercicios</span>
        </div>
      </div>

      <div className="pf-n-weekpick">
        <button type="button" className="pf-n-round">
          ‹
        </button>
        <span className="pf-n-weekpick-label">Semana 1</span>
        <button type="button" className="pf-n-round">
          ›
        </button>
      </div>

      <div className="pf-n-days">
        <button type="button" className="pf-n-day pf-n-day-active">
          Lunes
        </button>
        <button type="button" className="pf-n-day">
          Martes
        </button>
        <button type="button" className="pf-n-day">
          Miércoles
        </button>
      </div>

      <div className="pf-n-ready">
        <p className="pf-n-ready-title">Estás listo para entrenar</p>
        <p className="pf-n-ready-sub">4 ejercicios en esta sesión</p>
        <button type="button" className="pf-n-cta">
          Comenzar a entrenar
        </button>
      </div>
    </div>
  );
}

function Cuenta() {
  return (
    <div className="pf-n-screen">
      <div className="pf-n-identity">
        <h1 className="pf-n-identity-name">Pablo</h1>
        <p className="pf-n-identity-mail">pablo.marquez.mda@gmail.com</p>
        <span className="pf-n-identity-role">Rol: Cliente</span>
      </div>

      <p className="pf-n-label">Datos personales</p>
      <div className="pf-n-card" style={{ marginBottom: 22 }}>
        {[
          { label: "Nombre completo", value: "Pablo", bg: "rgba(99,102,241,0.18)" },
          { label: "Edad", value: "—", bg: "rgba(251,146,60,0.18)" },
          { label: "Altura (cm)", value: "—", bg: "rgba(34,211,238,0.16)" },
          { label: "Teléfono", value: "Agregar", bg: "rgba(52,211,153,0.16)" },
          { label: "Dirección", value: "Agregar", bg: "rgba(196,181,253,0.18)" },
        ].map((row) => (
          <button key={row.label} type="button" className="pf-n-row">
            <span className="pf-n-row-icon" style={{ background: row.bg }} />
            <span className="pf-n-row-label">{row.label}</span>
            <span className="pf-n-row-value">{row.value}</span>
            <span className="pf-n-row-chevron">›</span>
          </button>
        ))}
      </div>

      <p className="pf-n-label">Credenciales</p>
      <div className="pf-n-card" style={{ marginBottom: 22 }}>
        <button type="button" className="pf-n-row">
          <span className="pf-n-row-icon" style={{ background: "rgba(96,165,250,0.16)" }} />
          <span className="pf-n-row-label">Email</span>
          <span className="pf-n-row-value">pablo.marquez.mda@gmail.com</span>
          <span className="pf-n-row-chevron">›</span>
        </button>
        <button type="button" className="pf-n-row">
          <span className="pf-n-row-icon" style={{ background: "rgba(255,255,255,0.08)" }} />
          <span className="pf-n-row-label">Contraseña</span>
          <span className="pf-n-row-value">••••••••</span>
          <span className="pf-n-row-chevron">›</span>
        </button>
      </div>

      <div className="pf-n-card">
        <button type="button" className="pf-n-signout">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
