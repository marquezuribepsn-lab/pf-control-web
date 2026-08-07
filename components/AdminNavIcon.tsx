"use client";

/**
 * Iconos del sidebar del panel, tomados tal cual del handoff v2.
 * Son paths dibujados a mano con `stroke: currentColor`, no una librería.
 *
 * Se indexan por `href` porque es lo que el shell ya tiene a mano en cada
 * link, y así el ícono no depende del texto del label (que puede cambiar).
 */

const PATHS: Record<string, React.ReactNode> = {
  "/": (
    <>
      <path d="M4 11.5 L12 4.5 L20 11.5" />
      <path d="M6.5 10 V19.5 H17.5 V10" />
    </>
  ),
  "/clientes": (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5 C3.5 15.5 6 14 9 14 C12 14 14.5 15.5 14.5 19.5" />
      <circle cx="17.5" cy="9.5" r="2.2" />
      <path d="M15 19.5 C15.2 16.6 16.5 15.3 17.8 15.3 C19.3 15.3 20.4 16.7 20.5 19.5" />
    </>
  ),
  "/semana": (
    <>
      <rect x="2.5" y="10" width="3" height="4" rx="1" />
      <rect x="18.5" y="10" width="3" height="4" rx="1" />
      <rect x="5.5" y="9" width="2.4" height="6" rx="1" />
      <rect x="16.1" y="9" width="2.4" height="6" rx="1" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  "/asistencias": (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12.3 L11 15.3 L16 9.3" />
    </>
  ),
  "/alertas": (
    <>
      <path d="M7 9.5 C7 6.5 9.2 4.5 12 4.5 C14.8 4.5 17 6.5 17 9.5 V13 L19 16 H5 L7 13 Z" />
      <path d="M10 18.2 a2 2 0 0 0 4 0" />
    </>
  ),
  "/configuracion": (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5 V6 M12 18 V20.5 M3.5 12 H6 M18 12 H20.5 M6 6 L7.7 7.7 M16.3 16.3 L18 18 M6 18 L7.7 16.3 M16.3 7.7 L18 6" />
    </>
  ),
  "/calendario": (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2.2" />
      <line x1="4" y1="9.5" x2="20" y2="9.5" />
      <line x1="8.5" y1="3" x2="8.5" y2="6.5" />
      <line x1="15.5" y1="3" x2="15.5" y2="6.5" />
    </>
  ),
  "/categorias": <path d="M12 4 L20 12 L12 20 L4 12 Z" />,
  "/categorias/Nutricion": (
    <>
      <path d="M12 4.5 C9.2 4.5 7.2 7.2 7.2 11 C7.2 15.5 9.4 19.5 12 20.5 C14.6 19.5 16.8 15.5 16.8 11 C16.8 7.2 14.8 4.5 12 4.5 Z" />
      <path d="M12 4.5 L13.4 6.6" />
    </>
  ),
  "/admin/pagos": (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.2" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  "/clientes/musica": (
    <>
      <path d="M4 15 V6 l12 -2 v9" />
      <circle cx="4" cy="17" r="2.3" />
      <circle cx="16" cy="15" r="2.3" />
    </>
  ),
  "/admin/whatsapp": (
    <>
      <path d="M4 5 H20 V16 H10 L5 20 V16 H4 Z" />
      <circle cx="9" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  "/mensajes": <path d="M4 5 H20 V16 H10 L5 20 V16 H4 Z" />,
  "/equipos": <path d="M12 3 L19 6 V11 C19 15.5 16 19 12 20.5 C8 19 5 15.5 5 11 V6 Z" />,
  "/admin/usuarios": (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.2 19.5 C5.2 15.7 8.1 14.3 12 14.3 C15.9 14.3 18.8 15.7 18.8 19.5" />
    </>
  ),
};

/** Color propio de cada ítem del grupo GRUPOS, según el handoff. */
export const NAV_TINT: Record<string, string> = {
  "/categorias/Nutricion": "#34d399",
  "/admin/pagos": "#fbbf24",
  "/clientes/musica": "#c084fc",
  "/admin/whatsapp": "#34d399",
  "/mensajes": "#60a5fa",
  "/equipos": "#22e5ff",
  "/admin/usuarios": "#f472b6",
};

export default function AdminNavIcon({ href, size = 20 }: { href: string; size?: number }) {
  const path = PATHS[href];
  if (!path) {
    // Sin ícono conocido se dibuja un punto, para no romper la grilla del dock.
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.4" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
