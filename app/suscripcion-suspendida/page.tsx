"use client";

import { signOut } from "next-auth/react";

export default function SuscripcionSuspendidaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center pf-v2-s-deep px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border pf-v2-b-warn pf-v2-s-warn">
            <span className="text-3xl">⚠️</span>
          </div>
        </div>
        <h1 className="mb-2 text-xl font-black pf-v2-t">Suscripción suspendida</h1>
        <p className="mb-6 text-sm pf-v2-t-40">
          Tu acceso ha sido suspendido o tu suscripción venció. Contactá al administrador del sistema para renovar tu plan.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="w-full rounded-xl border pf-v2-b-warn pf-v2-s-warn py-3 text-sm font-bold pf-v2-t-warn transition-all pf-v2-hover"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
