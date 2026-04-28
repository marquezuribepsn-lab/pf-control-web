type AdminRunningLoaderCardProps = {
  message?: string;
  detail?: string;
  className?: string;
};

type AdminRunningLoaderOverlayProps = {
  active: boolean;
  message?: string;
  detail?: string;
  mode?: "fixed" | "absolute";
  className?: string;
  backdropClassName?: string;
  cardClassName?: string;
  ariaLive?: "off" | "polite" | "assertive";
};

const mergeClassNames = (...values: Array<string | null | undefined>) =>
  values.filter((value) => Boolean(value)).join(" ");

export function AdminRunningLoaderCard({
  message = "Cargando...",
  detail = "Buscando datos...",
  className,
}: AdminRunningLoaderCardProps) {
  return (
    <div
      className={mergeClassNames(
        "flex items-center gap-3 rounded-xl border border-cyan-300/35 bg-slate-950/80 px-4 py-3 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]",
        className
      )}
    >
      <div className="relative h-12 w-12 shrink-0">
        <span className="absolute inset-0 rounded-full border-2 border-cyan-200/25" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-200 border-r-cyan-300/70 animate-spin" />
        <span
          className="absolute inset-[4px] rounded-full border border-cyan-200/30 border-l-transparent animate-spin"
          style={{ animationDirection: "reverse", animationDuration: "1.7s" }}
        />

        <span className="absolute inset-0 flex items-center justify-center text-cyan-100">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="15.5" cy="4.5" r="2.2" />
            <path d="M13.5 8.5l-2.9 2.4l-3.2-.4" />
            <path d="M10.8 11.2l2.3 2.4l3 .5" />
            <path d="M13.1 13.6l-2 3.8" />
            <path d="M10.7 10.7L8 14.1l-3 .8" />
          </svg>
        </span>
      </div>

      <div className="min-w-[160px]">
        <p className="text-sm font-semibold text-cyan-100">{message}</p>
        <p className="text-xs text-cyan-100/75">{detail}</p>
      </div>
    </div>
  );
}

export default function AdminRunningLoaderOverlay({
  active,
  message,
  detail,
  mode = "fixed",
  className,
  backdropClassName,
  cardClassName,
  ariaLive = "polite",
}: AdminRunningLoaderOverlayProps) {
  if (!active) {
    return null;
  }

  const positionClass = mode === "absolute" ? "absolute inset-0" : "fixed inset-0";

  return (
    <div
      className={mergeClassNames(
        positionClass,
        "z-[120] flex items-center justify-center",
        "bg-slate-950/60 backdrop-blur-sm",
        backdropClassName,
        className
      )}
      aria-live={ariaLive}
    >
      <AdminRunningLoaderCard message={message} detail={detail} className={cardClassName} />
    </div>
  );
}
