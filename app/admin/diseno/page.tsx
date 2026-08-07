"use client";

/**
 * Mesa de diseño del panel de admin (ruta SOLO de desarrollo, sin login).
 *
 * Es el equivalente de `/alumnos/diseno` para el panel: renderiza contenido de
 * mentira dentro del AppShell real, así se puede ver e iterar el dock, la barra
 * superior y las primitivas con las mismas clases `.pf-v2-*` que usa la app.
 *
 * `proxy.ts` la bloquea en producción: en el VPS pide login como cualquier otra
 * ruta del panel. No hay datos reales acá, pero tampoco tiene sentido exponer
 * la estructura del panel.
 */

const METRICAS = [
  { k: "Alumnos activos", v: "128", d: "+6 esta semana" },
  { k: "Sesiones hoy", v: "14", d: "3 en curso" },
  { k: "Asistencia", v: "92%", d: "últimos 30 días" },
  { k: "Pagos al día", v: "81%", d: "24 pendientes" },
];

export default function DisenoPanelPage() {
  return (
    <div className="pf-v2-page">
      <header className="pf-v2-page-head">
        <div>
          <span className="pf-v2-eyebrow">Mesa de diseño</span>
          <h1 className="pf-v2-h1">Primitivas del panel</h1>
          <p className="pf-v2-muted">
            Contenido de prueba para ver el dock, la barra superior y las cards en vivo.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="pf-v2-btn pf-v2-btn-2">Secundario</button>
          <button type="button" className="pf-v2-btn">Acción principal</button>
        </div>
      </header>

      <section className="pf-v2-grid-4">
        {METRICAS.map((m) => (
          <article key={m.k} className="pf-v2-card">
            <span className="pf-v2-stat-label">{m.k}</span>
            <strong className="pf-v2-stat-value">{m.v}</strong>
            <span className="pf-v2-muted">{m.d}</span>
          </article>
        ))}
      </section>

      <section className="pf-v2-grid-split">
        <article className="pf-v2-card">
          <h2 className="pf-v2-h2">Card ancha</h2>
          <p className="pf-v2-muted">
            Columna principal de la grilla partida (1.3fr / 1fr).
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <span className="pf-v2-chip pf-v2-chip-accent">Acento</span>
            <span className="pf-v2-chip pf-v2-chip-ok">Al día</span>
            <span className="pf-v2-chip pf-v2-chip-warn">Por vencer</span>
            <span className="pf-v2-chip pf-v2-chip-danger">Vencido</span>
            <span className="pf-v2-chip">Neutro</span>
          </div>
        </article>

        <article className="pf-v2-card">
          <h2 className="pf-v2-h2">Formulario</h2>
          <div className="pf-v2-field">
            <label className="pf-v2-field-label" htmlFor="d-nombre">Nombre</label>
            <input id="d-nombre" className="pf-v2-input" placeholder="Ana Pérez" />
          </div>
          <div className="pf-v2-field">
            <label className="pf-v2-field-label" htmlFor="d-notas">Notas</label>
            <textarea id="d-notas" className="pf-v2-input" rows={3} placeholder="Observaciones..." />
          </div>
        </article>
      </section>
    </div>
  );
}
