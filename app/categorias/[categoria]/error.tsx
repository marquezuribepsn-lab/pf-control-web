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
    <div className="mx-auto max-w-2xl px-4 py-10 text-slate-100">
      <div className="rounded-2xl border border-red-500/30 bg-red-900/20 p-6">
        <h2 className="mb-2 text-xl font-black text-red-400">Error al cargar la página</h2>
        <p className="mb-4 text-sm text-slate-300">
          {error?.message || "Error desconocido"}
        </p>
        {error?.stack && (
          <pre className="mb-4 max-h-40 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-red-200 whitespace-pre-wrap">
            {error.stack}
          </pre>
        )}
        <button
          onClick={reset}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
