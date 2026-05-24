"use client";

import { signOut } from "next-auth/react";

export default function SuscripcionSuspendidaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030608] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <span className="text-3xl">⚠️</span>
          </div>
        </div>
        <h1 className="mb-2 text-xl font-black text-white">Suscripción suspendida</h1>
        <p className="mb-6 text-sm text-slate-500">
          Tu acceso ha sido suspendido o tu suscripción venció. Contactá al administrador del sistema para renovar tu plan.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="w-full rounded-xl border border-amber-500/40 bg-amber-500/20 py-3 text-sm font-bold text-amber-200 transition-all hover:bg-amber-500/30"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
