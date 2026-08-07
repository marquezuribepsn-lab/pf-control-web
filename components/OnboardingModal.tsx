"use client";
// Shows once per alumno (tracked in localStorage).
// Dismissed permanently when user clicks "Listo" or closes.

import { useState } from "react";
import Link from "next/link";

const ONBOARDING_KEY = "pf-control-onboarding-done-v1";

type OnboardingModalProps = {
  nombre?: string;
  onDone: () => void;
};

function markDone(onDone: () => void) {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // Ignore storage exceptions in restricted browser modes.
  }
  onDone();
}

const steps = [
  {
    title: "Bienvenido/a",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto mb-3 h-12 w-12 pf-v2-t-accent"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        />
      </svg>
    ),
  },
  {
    title: "Tu plan de entrenamiento",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto mb-3 h-12 w-12 pf-v2-t-accent"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
        />
      </svg>
    ),
  },
  {
    title: "Registrá tus cargas",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto mb-3 h-12 w-12 pf-v2-t-accent"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
        />
      </svg>
    ),
  },
];

export default function OnboardingModal({ nombre, onDone }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  const isLast = step === steps.length - 1;
  const firstName = nombre ? nombre.split(" ")[0] : "";

  function handleClose() {
    setClosing(true);
    window.setTimeout(() => markDone(onDone), 200);
  }

  function handleNext() {
    if (isLast) {
      handleClose();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida al entrenamiento"
      className={`fixed inset-0 z-50 flex items-center justify-center pf-v2-s-deep backdrop-blur-sm px-4 pf-dialog-fade-overlay${
        closing ? " pf-dialog-is-closing" : ""
      }`}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl border pf-v2-b pf-v2-s-deep shadow-2xl pf-dialog-fade-panel${
          closing ? " pf-dialog-is-closing" : ""
        }`}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar bienvenida"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full pf-v2-t-40 transition pf-v2-hover "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Step dots */}
        <div className="flex justify-center gap-2 pt-6 pb-2" aria-label="Pasos del tutorial">
          {steps.map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                i === step ? "w-6 pf-v2-s-accent-full" : "pf-v2-s-hi"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-2 text-center">
          {/* Step 0 — Bienvenida */}
          {step === 0 && (
            <>
              {steps[0].icon}
              <h2 className="mb-2 text-xl font-bold pf-v2-t">
                ¡Bienvenido/a{firstName ? `, ${firstName}` : ""}! 👋
              </h2>
              <p className="mb-4 text-sm leading-relaxed pf-v2-t-70">
                Nos alegra que estés acá. Antes de empezar, completá tu perfil para que tu
                entrenador pueda personalizarte mejor el plan.
              </p>
              <Link
                href="/alumnos/cuenta"
                onClick={handleClose}
                className="mb-4 inline-flex items-center gap-1.5 rounded-lg pf-v2-s-accent px-4 py-2 text-sm font-medium pf-v2-t-accent transition pf-v2-hover"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
                Ir a mi perfil
              </Link>
            </>
          )}

          {/* Step 1 — Tu plan */}
          {step === 1 && (
            <>
              {steps[1].icon}
              <h2 className="mb-2 text-xl font-bold pf-v2-t">Así se ve tu plan</h2>
              <p className="mb-1 text-sm leading-relaxed pf-v2-t-70">
                En la pestaña <span className="font-semibold pf-v2-t-accent">Rutina</span> vas a
                encontrar tu plan de entrenamiento organizado por semanas y días.
              </p>
              <p className="text-sm leading-relaxed pf-v2-t-70">
                Cada día muestra los ejercicios asignados con sus series, repeticiones y descansos.
                Seguí el orden sugerido para aprovechar al máximo cada sesión.
              </p>
            </>
          )}

          {/* Step 2 — Registro de carga */}
          {step === 2 && (
            <>
              {steps[2].icon}
              <h2 className="mb-2 text-xl font-bold pf-v2-t">Cómo registrar una carga</h2>
              <p className="mb-1 text-sm leading-relaxed pf-v2-t-70">
                Al tocar cualquier ejercicio podés registrar el peso y las repeticiones que
                realizaste ese día — esto se guarda automáticamente en tu historial.
              </p>
              <p className="text-sm leading-relaxed pf-v2-t-70">
                Por ejemplo: si hiciste <span className="font-semibold pf-v2-t">3 series de 8</span> con{" "}
                <span className="font-semibold pf-v2-t">60 kg</span>, anotalo ahí para que
                tanto vos como tu entrenador puedan ver tu progreso.
              </p>
            </>
          )}

          {/* Navigation button */}
          <button
            type="button"
            onClick={handleNext}
            className="mt-5 w-full rounded-xl pf-v2-s-accent-full py-3 text-sm font-semibold pf-v2-t-on transition pf-v2-hover active:scale-[0.98]"
          >
            {isLast ? "Listo 🎉" : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}
