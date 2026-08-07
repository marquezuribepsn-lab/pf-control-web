"use client";

import { useEffect } from "react";

export default function CategoriaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Categoria Error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 pf-v2-t">
      <div className="rounded-2xl border pf-v2-b-danger pf-v2-s-danger p-6">
        <h2 className="mb-2 text-xl font-black pf-v2-t-danger">Error al cargar la página</h2>
        <p className="mb-4 text-sm pf-v2-t-70">
          {error?.message || "Error desconocido"}
        </p>
        {error?.stack && (
          <pre className="mb-4 max-h-40 overflow-auto rounded-lg pf-v2-s-deep p-3 text-xs pf-v2-t-danger whitespace-pre-wrap">
            {error.stack}
          </pre>
        )}
        <button
          onClick={reset}
          className="rounded-lg pf-v2-s-danger px-4 py-2 text-sm font-semibold pf-v2-t"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
