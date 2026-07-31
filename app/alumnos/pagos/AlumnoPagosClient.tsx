"use client";

import Image from "next/image";
import ReliableActionButton from "@/components/ReliableActionButton";
import ReliableLink from "@/components/ReliableLink";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PaymentStatusResponse = {
  active: boolean;
  reason: "active" | "no-meta" | "pending-payment" | "expired-pass";
  daysRemaining: number | null;
  billing: {
    startDate: string | null;
    endDate: string | null;
    pagoEstado: string | null;
    amount: number;
    currency: string;
    periodDays: number;
  };
  paymentSummary: {
    isPaid: boolean;
    planValidUntil: string | null;
    latestPaymentAt: string | null;
    latestPaymentAmount: number | null;
    latestPaymentCurrency: string | null;
    latestPaymentMethod: "mercadopago" | "transferencia" | "efectivo" | null;
    latestPaymentOrderId: string | null;
  };
  latestOrder: {
    id: string;
    provider: "mercadopago" | "manual";
    paymentMethod: "mercadopago" | "transferencia" | "efectivo";
    status: string;
    providerStatus: string | null;
    amount: number;
    currency: string;
    periodDays: number;
    createdAt: string;
    approvedAt: string | null;
    adminNote: string | null;
    reviewedAt: string | null;
    receiptNumber: string | null;
    receiptIssuedAt: string | null;
  } | null;
  latestApprovedOrder: {
    id: string;
    provider: "mercadopago" | "manual";
    paymentMethod: "mercadopago" | "transferencia" | "efectivo";
    status: string;
    amount: number;
    currency: string;
    createdAt: string;
    approvedAt: string | null;
    receiptNumber: string | null;
    receiptIssuedAt: string | null;
  } | null;
  providerConfigured: boolean;
  manualMethodsEnabled: boolean;
  mercadoPago: {
    configured: boolean;
    accountLabel: string | null;
    collectorGuardEnabled: boolean;
    qrStore: {
      enabled: boolean;
      label: string | null;
      paymentLink: string | null;
      qrImageDataUrl: string | null;
      notes: string | null;
      updatedAt: string | null;
    };
  };
  transferAccounts: Array<{
    id: string;
    label: string;
    bankName: string;
    accountType: string;
    holderName: string;
    holderDocument: string;
    accountNumber: string;
    cbu: string;
    alias: string;
    notes: string;
  }>;
};

// Detecta si la web corre dentro del wrapper nativo de iOS. La app móvil deja
// marcas (window global, localStorage, cookie, clase en <html> y ?pfnative=ios).
// Dentro de iOS ocultamos los flujos de cobro para cumplir la regla 3.1.1 de la
// App Store, que prohíbe dirigir a mecanismos de pago externos a la compra in-app.
function detectIosNative(searchFlag: string): boolean {
  if (searchFlag === "ios") return true;
  if (typeof window === "undefined") return false;

  try {
    if ((window as unknown as { __PF_NATIVE_PLATFORM__?: string }).__PF_NATIVE_PLATFORM__ === "ios") {
      return true;
    }
    if (window.localStorage?.getItem("pfNativePlatform") === "ios") {
      return true;
    }
    if (document.documentElement?.classList?.contains("pf-native-ios")) {
      return true;
    }
    if (/(?:^|;\s*)pf_native=ios(?:;|$)/.test(document.cookie || "")) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(amount: number, currency = "ARS"): string {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `${currency.toUpperCase()} ${safeAmount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function resolveReasonLabel(reason: PaymentStatusResponse["reason"]): string {
  switch (reason) {
    case "active":
      return "Pase activo";
    case "expired-pass":
      return "Pase vencido";
    case "pending-payment":
      return "Pago pendiente";
    case "no-meta":
      return "Sin ficha de pago";
    default:
      return "Estado de pago";
  }
}

function resolveReasonDetail(reason: PaymentStatusResponse["reason"]): string {
  switch (reason) {
    case "active":
      return "Tu acceso esta habilitado. Puedes seguir entrenando sin bloqueos.";
    case "expired-pass":
      return "Tu pase vencio. Completa el pago para recuperar acceso de inmediato.";
    case "pending-payment":
      return "Detectamos un pago en proceso. Cuando se confirme, se habilita solo.";
    case "no-meta":
      return "Tu cuenta aun no tiene una ficha de pago asociada.";
    default:
      return "Revisa tu estado de pago actual.";
  }
}

function resolveOrderStatusLabel(status: string): string {
  const normalized = String(status || "").trim().toLowerCase();
  switch (normalized) {
    case "approved":
      return "Aprobado";
    case "pending":
      return "Pendiente";
    case "in_process":
      return "En proceso";
    case "rejected":
      return "Rechazado";
    case "cancelled":
      return "Cancelado";
    case "refunded":
      return "Reintegrado";
    case "charged_back":
      return "Contracargo";
    case "expired":
      return "Expirado";
    default:
      return normalized || "Sin estado";
  }
}

function resolvePaymentMethodLabel(method: string): string {
  const normalized = String(method || "").trim().toLowerCase();
  switch (normalized) {
    case "mercadopago":
      return "Mercado Pago";
    case "transferencia":
      return "Transferencia";
    case "efectivo":
      return "Efectivo";
    default:
      return "Metodo no especificado";
  }
}

function resolveStatusTone(isActive: boolean, reason: PaymentStatusResponse["reason"]):
  | "ok"
  | "warning"
  | "danger"
  | "neutral" {
  if (isActive) return "ok";
  if (reason === "pending-payment") return "warning";
  if (reason === "expired-pass") return "danger";
  return "neutral";
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

// Divide un mensaje de una sola oracion en titulo + subtitulo (si hay una
// segunda oracion), para el banner de estado con icono estilo "Centro de pagos".
function splitMessage(msg: string): { title: string; subtitle: string } {
  const trimmed = msg.trim();
  const idx = trimmed.indexOf(". ");
  if (idx === -1) return { title: trimmed, subtitle: "" };
  return { title: trimmed.slice(0, idx + 1), subtitle: trimmed.slice(idx + 2).trim() };
}

function toneIconClasses(tone: "ok" | "warning" | "danger" | "neutral"): string {
  switch (tone) {
    case "ok":
      return "pf-n-bd-green pf-n-bg-green pf-n-t-green";
    case "warning":
      return "pf-n-bd-orange pf-n-bg-orange pf-n-t-orange";
    case "danger":
      return "pf-n-bd-red pf-n-bg-red pf-n-t-red";
    default:
      return "pf-n-bd pf-n-bg-soft pf-n-t";
  }
}

function IconCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <path d="M12 3.8 21.3 20H2.7L12 3.8Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 10v4.2" strokeLinecap="round" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconRefresh({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2" strokeLinecap="round" />
      <path d="M18 4v3.4h-3.4M6 20v-3.4h3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCalendar({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 3.3v3.4M16 3.3v3.4M3.5 9.6h17" strokeLinecap="round" />
    </svg>
  );
}

function IconClock({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.3" />
      <path d="M12 7.6V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDollar({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <path d="M12 3v18" strokeLinecap="round" />
      <path d="M16.5 7.2c0-1.5-1.6-2.7-4-2.7-2.6 0-4.3 1.3-4.3 3.1 0 4 8.6 1.9 8.6 5.9 0 1.9-1.9 3.2-4.5 3.2-2.4 0-4.1-1.1-4.3-2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevron({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDocument({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3.5V8h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.6 12.2h6.8M8.6 15.4h6.8" strokeLinecap="round" />
    </svg>
  );
}

function MercadoPagoLogo({ className = "h-6 w-6" }: { className?: string }) {
  // Isologotipo oficial de Mercado Pago (marca del "apreton de manos" sobre ovalo azul).
  // Uso nominativo para identificar el medio de pago: colores y proporciones oficiales,
  // sin recolorear ni distorsionar la marca.
  return (
    <svg
      viewBox="0 0 512 340"
      className={className}
      role="img"
      aria-label="Mercado Pago"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="256" cy="170" rx="254" ry="168" fill="#009EE3" />
      <ellipse cx="256" cy="170" rx="254" ry="168" fill="url(#mpGloss)" />
      <path
        d="M96 150c14-30 46-52 84-52 30 0 52 12 76 30 24-18 46-30 76-30 38 0 70 22 84 52 6 12 4 24-6 30-40 26-90 42-154 42s-114-16-154-42c-10-6-12-18-6-30Z"
        fill="#FFE600"
      />
      <path
        d="M172 158c8-14 22-22 40-22 12 0 22 4 30 12l14 12 14-12c8-8 18-12 30-12 18 0 32 8 40 22"
        fill="none"
        stroke="#2D3277"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="212" cy="150" r="12" fill="#2D3277" />
      <circle cx="300" cy="150" r="12" fill="#2D3277" />
      <defs>
        <linearGradient id="mpGloss" x1="256" y1="2" x2="256" y2="338" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PfPayLogo({ className = "h-12 w-12" }: { className?: string }) {
  // Marca propia de PF Control para el centro de pagos: emblema de "pase" con
  // monograma PF. Al ser un logo propio (no un medio de pago de terceros) esta
  // permitido mostrarlo dentro de la app nativa.
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="PF Control Pagos"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#pfpayBg)" />
      <rect
        x="2.75"
        y="2.75"
        width="58.5"
        height="58.5"
        rx="17.25"
        fill="none"
        stroke="url(#pfpayStroke)"
        strokeWidth="1.5"
      />
      <rect x="14" y="24" width="36" height="24" rx="6" fill="none" stroke="#5f9de7" strokeWidth="2.4" opacity="0.55" />
      <path d="M14 32h36" stroke="#5f9de7" strokeWidth="2.4" opacity="0.55" />
      <text
        x="32"
        y="30"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="17"
        fontWeight="800"
        fill="#ffffff"
        letterSpacing="0.5"
      >
        PF
      </text>
      <defs>
        <linearGradient id="pfpayBg" x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1b8bf3" />
          <stop offset="0.55" stopColor="#025ce4" />
          <stop offset="1" stopColor="#003dce" />
        </linearGradient>
        <linearGradient id="pfpayStroke" x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// El comprobante viaja como data URL dentro del JSON (mismo patron que el avatar
// y el QR de MP). Las imagenes se comprimen en el cliente para no inflar el store.
const RECEIPT_MAX_INPUT_BYTES = 10 * 1024 * 1024;
const RECEIPT_MAX_DATA_URL_CHARS = 1_300_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

async function compressImageDataUrl(
  dataUrl: string,
  maxSide = 1400,
  quality = 0.72
): Promise<string> {
  const image = document.createElement("img");
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    image.src = dataUrl;
  });

  const largestSide = Math.max(image.width, image.height);
  const scale = largestSide > maxSide ? maxSide / largestSide : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function IconPaperclip({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <path
        d="M20 11.5 12.4 19a4.5 4.5 0 0 1-6.4-6.4l7.8-7.8a3 3 0 0 1 4.3 4.3l-7.8 7.8a1.5 1.5 0 0 1-2.2-2.2l7-7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClose({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

const PAYMENT_STATUS_BRANDED_LOADING_MIN_MS = 0;

export default function AlumnoPagosClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentQueryStatus = String(searchParams.get("payment") || "").trim().toLowerCase();
  const payFromApp = searchParams.get("pay") === "1";
  const nativePlatformFlag = String(searchParams.get("pfnative") || "").trim().toLowerCase();

  const [isIosNative, setIsIosNative] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsIosNative(detectIosNative(nativePlatformFlag));
  }, [nativePlatformFlag]);

  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [statusRefreshLoading, setStatusRefreshLoading] = useState(false);
  const [manualNote, setManualNote] = useState("");
  const [manualSheetOpen, setManualSheetOpen] = useState(false);
  const [manualMethod, setManualMethod] = useState<"transferencia" | "efectivo">("transferencia");
  const [manualAmount, setManualAmount] = useState("");
  const [manualFileUrl, setManualFileUrl] = useState<string | null>(null);
  const [manualFileName, setManualFileName] = useState<string | null>(null);
  const [manualFileError, setManualFileError] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const statusRefreshTimerRef = useRef<number | null>(null);
  const statusRefreshTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (statusRefreshTimerRef.current !== null) {
        window.clearTimeout(statusRefreshTimerRef.current);
        statusRefreshTimerRef.current = null;
      }
    };
  }, []);

  const loadStatus = useCallback(async (options?: { silent?: boolean; withBrandedLoader?: boolean }) => {
    const isSilent = Boolean(options?.silent);
    const withBrandedLoader = Boolean(options?.withBrandedLoader);
    const refreshToken = withBrandedLoader ? ++statusRefreshTokenRef.current : statusRefreshTokenRef.current;
    const brandedLoadingStartedAt = withBrandedLoader ? Date.now() : 0;

    if (withBrandedLoader) {
      if (statusRefreshTimerRef.current !== null) {
        window.clearTimeout(statusRefreshTimerRef.current);
        statusRefreshTimerRef.current = null;
      }

      setStatusRefreshLoading(true);
      setError("");
      if (!isSilent) {
        setLoading(true);
      }
    } else if (!isSilent) {
      setLoading(true);
      setError("");
    }

    try {
      const response = await fetch("/api/payments/status", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as PaymentStatusResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo consultar el estado de pagos"));
      }

      setStatus(data);
    } catch (loadError) {
      if (!isSilent) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo consultar el estado de pagos."
        );
        setStatus(null);
      }
    } finally {
      if (withBrandedLoader) {
        const elapsed = Date.now() - brandedLoadingStartedAt;
        const remaining = Math.max(0, PAYMENT_STATUS_BRANDED_LOADING_MIN_MS - elapsed);

        if (remaining > 0 && typeof window !== "undefined") {
          await new Promise<void>((resolve) => {
            statusRefreshTimerRef.current = window.setTimeout(() => {
              statusRefreshTimerRef.current = null;
              resolve();
            }, remaining);
          });
        }

        if (refreshToken === statusRefreshTokenRef.current) {
          setStatusRefreshLoading(false);
        }
      }

      if (!isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Sincroniza el estado de pago automaticamente cada vez que se vuelve al
  // Centro de pagos: al traer la app al frente, volver atras (bfcache), cambiar
  // de pestana o recuperar el foco. Es silencioso para no parpadear.
  useEffect(() => {
    if (typeof document === "undefined") return;

    let lastAutoSyncAt = 0;
    const autoSync = () => {
      const now = Date.now();
      // Throttle: evita fetches duplicados cuando varios eventos disparan juntos.
      if (now - lastAutoSyncAt < 2500) return;
      lastAutoSyncAt = now;
      void loadStatus({ silent: true });
    };

    const syncIfVisible = () => {
      if (document.visibilityState === "visible") autoSync();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) autoSync();
    };

    document.addEventListener("visibilitychange", syncIfVisible);
    window.addEventListener("focus", syncIfVisible);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", syncIfVisible);
      window.removeEventListener("focus", syncIfVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [loadStatus]);

  useEffect(() => {
    router.prefetch("/alumnos/inicio");
  }, [router]);

  // If the user lands here without ?pay=1 or ?payment=..., send them back to inicio.
  // This prevents a server-side redirect loop: the server no longer redirects pagos→inicio,
  // so this client-side guard replaces that behaviour safely.
  useEffect(() => {
    if (!payFromApp && !paymentQueryStatus) {
      router.replace("/alumnos/inicio");
    }
    // intentionally omitting deps: payFromApp and paymentQueryStatus are URL-derived
    // constants that won't change during the component's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!paymentQueryStatus) return;

    if (paymentQueryStatus === "success") {
      setMessage("Pago recibido. Estamos validandolo con Mercado Pago.");
      return;
    }

    if (paymentQueryStatus === "pending") {
      setMessage("Tu pago quedo pendiente. Te avisamos cuando se confirme.");
      return;
    }

    if (paymentQueryStatus === "failure") {
      setError("El pago no se pudo completar. Puedes intentarlo nuevamente.");
    }
  }, [paymentQueryStatus]);

  useEffect(() => {
    if (!status) return;
    if (status.active) return;
    if (status.reason === "no-meta") return;

    const intervalId = window.setInterval(() => {
      void loadStatus({ silent: true });
    }, 7000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadStatus, status]);

  useEffect(() => {
    if (!status?.active) return;

    setMessage((previous) => previous || "Tu pase esta activo. Puedes revisar tu estado cuando quieras.");
  }, [status?.active]);


  const startCheckout = async () => {
    if (!status) return;

    setCheckoutLoading(true);
    setError("");

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: status.billing.amount,
          currency: status.billing.currency,
          periodDays: status.billing.periodDays,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        checkoutUrl?: string;
        message?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(String(data.message || "No se pudo iniciar el pago"));
      }

      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error ? checkoutError.message : "No se pudo iniciar el pago."
      );
      setCheckoutLoading(false);
    }
  };

  const openManualSheet = useCallback(() => {
    setManualFileError("");
    setError("");
    setManualAmount(
      status?.billing.amount ? String(status.billing.amount) : ""
    );
    setManualSheetOpen(true);
  }, [status?.billing.amount]);

  const closeManualSheet = useCallback(() => {
    setManualSheetOpen(false);
  }, []);

  const handleReceiptFileChange = async (file: File | null) => {
    setManualFileError("");

    if (!file) {
      setManualFileUrl(null);
      setManualFileName(null);
      return;
    }

    const isPdf = file.type === "application/pdf";
    const isImage = /^image\/(png|jpe?g|webp)$/i.test(file.type);

    if (!isPdf && !isImage) {
      setManualFileError("Formato no valido. Adjunta una imagen JPG/PNG o un PDF.");
      return;
    }

    if (file.size > RECEIPT_MAX_INPUT_BYTES) {
      setManualFileError("El archivo supera los 10 MB.");
      return;
    }

    try {
      let dataUrl = await readFileAsDataUrl(file);
      if (isImage) {
        dataUrl = await compressImageDataUrl(dataUrl);
      }

      if (dataUrl.length > RECEIPT_MAX_DATA_URL_CHARS) {
        setManualFileError(
          isPdf
            ? "El PDF es muy pesado. Adjunta una foto del comprobante o un PDF mas liviano."
            : "La imagen es muy pesada. Proba con otra foto."
        );
        return;
      }

      setManualFileUrl(dataUrl);
      setManualFileName(file.name);
    } catch {
      setManualFileError("No se pudo procesar el archivo.");
    }
  };

  const submitManualPayment = async () => {
    if (!status) return;

    const parsedAmount = Number(String(manualAmount).replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setManualFileError("Ingresa un monto valido.");
      return;
    }

    setManualSubmitting(true);
    setManualFileError("");
    setError("");

    try {
      const response = await fetch("/api/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: manualMethod,
          amount: parsedAmount,
          currency: status.billing.currency,
          periodDays: status.billing.periodDays,
          note: manualNote,
          receiptFileUrl: manualFileUrl,
          receiptFileName: manualFileName,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo enviar el informe de pago"));
      }

      setMessage(
        data.message ||
          "Informe enviado. Queda pendiente de confirmacion del admin para renovar tu pase."
      );
      setManualNote("");
      setManualFileUrl(null);
      setManualFileName(null);
      setManualSheetOpen(false);
      await loadStatus({ withBrandedLoader: true });
    } catch (manualError) {
      setManualFileError(
        manualError instanceof Error ? manualError.message : "No se pudo enviar el informe."
      );
    } finally {
      setManualSubmitting(false);
    }
  };

  const isActive = Boolean(status?.active);

  // Ciclo de facturacion para la barra de progreso del pase (rediseño).
  const cyclePeriod = Math.max(1, Number(status?.billing.periodDays) || 0);
  const cycleRemaining =
    typeof status?.daysRemaining === "number" ? Math.max(0, status.daysRemaining) : 0;
  const cycleElapsed = Math.max(0, Math.min(cyclePeriod, cyclePeriod - cycleRemaining));
  const cycleProgress = Math.round((cycleElapsed / cyclePeriod) * 100);
  // MP checkout requiere que el alumno tenga ficha de billing (clientKey) para que
  // el webhook pueda activar automáticamente el pase. Si aún no está vinculado,
  // se muestra un aviso en lugar de deshabilitar sin explicación.
  const canPay = Boolean(status?.mercadoPago?.configured && status?.reason !== "no-meta");
  const noMetaBlocksMP = Boolean(status?.mercadoPago?.configured && status?.reason === "no-meta");
  // Los botones manuales (transferencia/efectivo/QR MP) siempre están habilitados:
  // el admin puede revisar y aprobar el pago aunque no haya ficha de billing todavía.
  const canRequestManual = Boolean(status?.manualMethodsEnabled);
  const canUseQrStore = Boolean(status?.mercadoPago?.qrStore?.enabled);

  // Apple 3.1.3(e): el pase de gimnasio es un servicio fisico consumido fuera de
  // la app (el alumno entrena presencialmente), por lo que esta permitido cobrarlo
  // con Mercado Pago (medio de pago externo) dentro de la app iOS nativa. Por eso
  // ya no se ocultan las opciones de pago en el WebView nativo.
  const paymentsHiddenForNative: boolean = false;
  // El bloque "ingresa por el navegador" queda solo como respaldo: se muestra
  // unicamente si en nativo no hay ningun medio de pago disponible.
  const showNativeFallback =
    isIosNative && (paymentsHiddenForNative || (!canPay && !canRequestManual && !canUseQrStore));

  const statusTone = useMemo(
    () => resolveStatusTone(isActive, status?.reason || "no-meta"),
    [isActive, status?.reason]
  );

  type ActivityItem = {
    id: string;
    icon: "check" | "refresh" | "alert";
    tone: "ok" | "warning" | "danger" | "neutral";
    title: string;
    subtitle: string;
    time: string;
    ts: number;
  };

  const activityItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    const approved = status?.latestApprovedOrder;
    if (approved) {
      const when = approved.approvedAt || approved.createdAt;
      items.push({
        id: `approved-${approved.id}`,
        icon: "check",
        tone: "ok",
        title: "Pago aprobado",
        subtitle: `${resolvePaymentMethodLabel(approved.paymentMethod)} · ${formatDate(when)}`,
        time: formatTime(when),
        ts: new Date(when || 0).getTime() || 0,
      });
    }

    const latest = status?.latestOrder;
    if (latest && (!approved || latest.id !== approved.id)) {
      const normalized = String(latest.status || "").trim().toLowerCase();
      const isBad = normalized === "rejected" || normalized === "cancelled" || normalized === "charged_back";
      items.push({
        id: `latest-${latest.id}`,
        icon: isBad ? "alert" : "refresh",
        tone: isBad ? "danger" : normalized === "approved" ? "ok" : "warning",
        title: resolveOrderStatusLabel(latest.status),
        subtitle: `${resolvePaymentMethodLabel(latest.paymentMethod)} · ${formatDate(latest.createdAt)}`,
        time: formatTime(latest.createdAt),
        ts: new Date(latest.createdAt || 0).getTime() || 0,
      });
    }

    items.sort((a, b) => b.ts - a.ts);
    return items.slice(0, 5);
  }, [status?.latestApprovedOrder, status?.latestOrder]);

  return (
    <main className="pf-n">
      <div className="pf-n-stage">
        {statusRefreshLoading ? (
          <div
            className="pf-n-routine-log-overlay pf-n-payments-loading-overlay"
            role="status"
            aria-live="polite"
            aria-label="Actualizando estado de pagos"
          >
            <section className="pf-n-routine-empty pf-n-routine-loading pf-n-payments-loading-panel">
              <div className="pf-n-routine-loading-visual" aria-hidden="true">
                <span className="pf-n-routine-loading-ring" />
                <span className="pf-n-routine-loading-core">PF</span>
              </div>
              <p className="pf-n-routine-loading-brand">PF Control</p>
              <h2>Actualizando estado...</h2>
              <p>Sincronizando pagos y validaciones del centro.</p>
            </section>
          </div>
        ) : null}

        <div className="pf-n-detail-head">
          <button
            type="button"
            onClick={() => { window.location.assign("/alumnos/inicio"); }}
            className="pf-n-back"
            aria-label="Volver al inicio"
            title="Volver al inicio"
          >
            ‹
          </button>
          <div>
            <p className="pf-n-eyebrow">Billing</p>
            <h1 className="pf-n-title-sm">Centro de pagos</h1>
          </div>
        </div>

        {noMetaBlocksMP && !paymentsHiddenForNative ? (
          <div className="pf-n-gate">
            <p className="pf-n-gate-text">
              El pago con Mercado Pago requiere que el admin vincule tu cuenta al perfil de alumno.
              Mientras tanto podes informar un pago manual abajo.
            </p>
          </div>
        ) : null}

        {message ? (
          <section className="pf-n-banner pf-n-banner-ok flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${toneIconClasses("ok")}`}>
              <IconCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{splitMessage(message).title}</p>
              {splitMessage(message).subtitle ? (
                <p className="mt-0.5 text-xs pf-n-t-green">{splitMessage(message).subtitle}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="pf-n-banner pf-n-banner-danger flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${toneIconClasses("danger")}`}>
              <IconAlert className="h-4 w-4" />
            </span>
            <p className="min-w-0">{error}</p>
          </section>
        ) : null}

        <section className="grid gap-4">
          {/* Tarjeta del pase (rediseño): degradado teal -> cyan -> indigo con
              el estado, el vencimiento, el importe de renovacion y los dias. */}
          <article className="pf-n-pass">
            <div className="pf-n-pass-top">
              <span className="pf-n-pass-brand">PF Control · Pase</span>
              <span className="pf-n-pass-mark">PF</span>
            </div>
            <p className="pf-n-pass-state">
              {loading ? "Consultando..." : isActive ? "Activo" : "Inhabilitado"}
            </p>
            <p className="pf-n-pass-owner">
              {status?.paymentSummary?.planValidUntil || status?.billing.endDate
                ? `Vence ${formatDate(status?.paymentSummary?.planValidUntil || status?.billing.endDate)}`
                : "Sin vencimiento cargado"}
            </p>
            <div className="pf-n-pass-foot">
              <div>
                <p className="pf-n-pass-key">Renueva por</p>
                <p className="pf-n-pass-val">
                  {formatMoney(status?.billing.amount || 0, status?.billing.currency || "ARS")}
                </p>
              </div>
              <div className="text-right">
                <p className="pf-n-pass-key">Restan</p>
                <p className="pf-n-pass-val">
                  {typeof status?.daysRemaining === "number" ? `${status.daysRemaining} dias` : "-"}
                </p>
              </div>
            </div>
          </article>

          {/* Ciclo de facturacion */}
          <div className="pf-n-cycle">
            <div className="pf-n-cycle-track">
              <div className="pf-n-cycle-fill" style={{ width: `${cycleProgress}%` }} />
            </div>
            <div className="pf-n-cycle-foot">
              <span>Ciclo de facturacion</span>
              <span className="pf-n-cycle-count">
                {cycleElapsed}/{status?.billing.periodDays || 0} dias
              </span>
            </div>
          </div>

          {/* Solo se muestra si hay contenido: QR de tienda o el aviso nativo. */}
          {(canUseQrStore && !paymentsHiddenForNative) || showNativeFallback ? (
          <article className="pf-n-card rounded-[1.2rem] border p-4 sm:p-5">

            {canUseQrStore && !paymentsHiddenForNative ? (
              <section className="mt-4 rounded-xl border pf-n-bd-indigo pf-n-bg-indigo p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] pf-n-t-indigo">QR tienda</p>
                <h3 className="mt-1 text-sm font-black pf-n-t-indigo">
                  {status?.mercadoPago?.qrStore?.label || "Mercado Pago QR"}
                </h3>

                <div className="mt-3 flex flex-wrap items-start gap-3">
                  {status?.mercadoPago?.qrStore?.qrImageDataUrl ? (
                    <div className="rounded-lg border pf-n-bd pf-n-bg-soft p-1.5">
                      <Image
                        src={status.mercadoPago.qrStore.qrImageDataUrl}
                        alt="QR para pagar con Mercado Pago"
                        width={140}
                        height={140}
                        unoptimized
                        className="h-[140px] w-[140px] rounded"
                      />
                    </div>
                  ) : null}

                  <div className="min-w-[180px] flex-1 space-y-2">
                    <p className="text-xs pf-n-t-indigo">
                      Escanea este QR desde la app de Mercado Pago para pagar como en tienda.
                    </p>

                    {status?.mercadoPago?.qrStore?.notes ? (
                      <p className="text-xs pf-n-t-indigo">{status.mercadoPago.qrStore.notes}</p>
                    ) : null}

                    {status?.mercadoPago?.qrStore?.paymentLink ? (
                      <a
                        href={status.mercadoPago.qrStore.paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg border pf-n-bd-indigo pf-n-bg-indigo px-3 py-1.5 text-xs font-semibold pf-n-t-indigo"
                      >
                        Abrir link de pago
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {showNativeFallback ? (
              <>
                <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border pf-n-bd pf-n-bg-soft p-4 text-center">
                  <PfPayLogo className="h-14 w-14" />
                  <p className="text-sm pf-n-t">
                    Para gestionar o renovar tu pase, ingresa a{" "}
                    <span className="font-semibold pf-n-t">pf-control.com</span> desde el
                    navegador de tu telefono o computadora.
                  </p>
                  <p className="mt-2 text-xs pf-n-t-45">
                    Desde aqui podes consultar el estado de tu pase en cualquier momento.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ReliableLink
                    href="/alumnos/inicio"
                    className="pf-n-ghost-btn inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold"
                  >
                    Ir a inicio
                  </ReliableLink>
                </div>
              </>
            ) : null}
          </article>
          ) : null}

          {!paymentsHiddenForNative ? (
            <section>
              <h3 className="text-sm font-black pf-n-t">Opciones de pago</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <ReliableActionButton
                  type="button"
                  onClick={startCheckout}
                  disabled={!canPay || checkoutLoading || loading || statusRefreshLoading}
                  className="pf-n-card flex items-center gap-3 rounded-2xl border p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border pf-n-bd bg-white">
                    <MercadoPagoLogo className="h-6 w-9" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold pf-n-t">Mercado Pago</span>
                    <span className="block text-xs pf-n-t-70">Paga de forma rapida y segura</span>
                  </span>
                  <IconChevron className="h-4 w-4 shrink-0 pf-n-t-45" />
                </ReliableActionButton>

                <ReliableActionButton
                  type="button"
                  onClick={openManualSheet}
                  disabled={!canRequestManual || loading || statusRefreshLoading}
                  className="pf-n-card flex items-center gap-3 rounded-2xl border p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-45"
                  aria-haspopup="dialog"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border pf-n-bd-indigo pf-n-bg-indigo pf-n-t-indigo">
                    <IconDocument className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold pf-n-t">Pago manual</span>
                    <span className="block text-xs pf-n-t-70">Transferencia o efectivo</span>
                  </span>
                  <IconChevron className="h-4 w-4 shrink-0 pf-n-t-45" />
                </ReliableActionButton>
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="text-sm font-black pf-n-t">Actividad reciente</h3>
            <div className="mt-2 space-y-2">
              {activityItems.length > 0 ? (
                activityItems.map((item) => (
                  <div
                    key={item.id}
                    className="pf-n-card flex items-center gap-3 rounded-2xl border p-3"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${toneIconClasses(item.tone)}`}>
                      {item.icon === "check" ? (
                        <IconCheck className="h-4 w-4" />
                      ) : item.icon === "alert" ? (
                        <IconAlert className="h-4 w-4" />
                      ) : (
                        <IconRefresh className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold pf-n-t">{item.title}</span>
                      <span className="block text-xs pf-n-t-70">{item.subtitle}</span>
                    </span>
                    {item.time ? (
                      <span className="shrink-0 text-xs pf-n-t-45">{item.time}</span>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="pf-n-card rounded-2xl border p-3.5 text-xs pf-n-t-45">
                  Todavia no hay actividad reciente para mostrar.
                </p>
              )}
            </div>
          </section>
        </section>
      </div>

      {mounted && manualSheetOpen
        ? createPortal(
        <div
          className="pf-alumno-v2 pf-n-portal fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-sheet-title"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={closeManualSheet}
            className="absolute inset-0 h-full w-full cursor-default bg-black/65 backdrop-blur-sm"
          />

          <section className="pf-n-sheet relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[1.6rem] border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-[1.6rem] sm:pb-5">
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full pf-n-bg-soft sm:hidden" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="pf-n-eyebrow">Pago manual</p>
                <h2 id="manual-sheet-title" className="mt-1 text-xl font-black pf-n-t">
                  Informar pago
                </h2>
              </div>
              <button
                type="button"
                onClick={closeManualSheet}
                aria-label="Cerrar"
                className="pf-n-back-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {/* Metodo: solo transferencia o efectivo */}
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] pf-n-t-45">Metodo de pago</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["transferencia", "efectivo"] as const).map((method) => {
                const selected = manualMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setManualMethod(method)}
                    aria-pressed={selected}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                      selected
                        ? "pf-n-bd-cyan pf-n-bg-cyan pf-n-t"
                        : "pf-n-bd pf-n-bg-soft pf-n-t-70"
                    }`}
                  >
                    {method === "transferencia" ? "Transferencia" : "Efectivo"}
                  </button>
                );
              })}
            </div>

            {/* Cuentas destino solo aplican a transferencia */}
            {manualMethod === "transferencia" ? (
              <div className="mt-3 rounded-xl border pf-n-bd pf-n-bg-soft p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] pf-n-t-45">
                  Cuentas destino
                </p>
                {Array.isArray(status?.transferAccounts) && status.transferAccounts.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {status.transferAccounts.map((account) => (
                      <article
                        key={account.id}
                        className="rounded-lg border pf-n-bd pf-n-bg-soft p-2.5 text-xs pf-n-t"
                      >
                        <p className="font-semibold pf-n-t">{account.label}</p>
                        <p className="pf-n-t-70">
                          {account.bankName || "Banco no definido"}
                          {account.accountType ? ` · ${account.accountType}` : ""}
                        </p>
                        {account.holderName ? <p>Titular: {account.holderName}</p> : null}
                        {account.holderDocument ? <p>CUIT/DNI: {account.holderDocument}</p> : null}
                        {account.accountNumber ? <p>Nro cuenta: {account.accountNumber}</p> : null}
                        {account.cbu ? <p>CBU/CVU: {account.cbu}</p> : null}
                        {account.alias ? <p>Alias: {account.alias}</p> : null}
                        {account.notes ? <p>Nota: {account.notes}</p> : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs pf-n-t-45">
                    El admin aun no cargo cuentas de transferencia visibles.
                  </p>
                )}
              </div>
            ) : null}

            {/* Monto */}
            <label
              className="mt-4 block text-[11px] uppercase tracking-[0.14em] pf-n-t-45"
              htmlFor="manual-amount"
            >
              Monto ({status?.billing.currency || "ARS"})
            </label>
            <input
              id="manual-amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="any"
              value={manualAmount}
              onChange={(event) => setManualAmount(event.target.value)}
              placeholder="0"
              className="pf-n-input mt-2 w-full rounded-xl border pf-n-bd pf-n-bg-soft px-3 py-2.5 text-base font-semibold pf-n-t outline-none focus:pf-n-bd-cyan"
            />
            {status?.billing.amount ? (
              <p className="mt-1.5 text-xs pf-n-t-45">
                Monto de renovacion vigente:{" "}
                {formatMoney(status.billing.amount, status.billing.currency)}
              </p>
            ) : null}

            {/* Comprobante */}
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] pf-n-t-45">
              Comprobante de pago
            </p>
            {manualFileUrl ? (
              <div className="mt-2 rounded-xl border pf-n-bd-green pf-n-bg-green/[0.08] p-3">
                {manualFileUrl.startsWith("data:application/pdf") ? (
                  <p className="text-sm font-semibold pf-n-t-green">PDF adjuntado</p>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={manualFileUrl}
                    alt="Vista previa del comprobante"
                    className="max-h-48 w-auto rounded-lg border pf-n-bd object-contain"
                  />
                )}
                <p className="mt-2 truncate text-xs pf-n-t-70">{manualFileName}</p>
                <button
                  type="button"
                  onClick={() => void handleReceiptFileChange(null)}
                  className="mt-2 text-xs font-semibold pf-n-t-red underline underline-offset-2"
                >
                  Quitar comprobante
                </button>
              </div>
            ) : (
              <label
                htmlFor="manual-receipt-file"
                className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed pf-n-bd pf-n-bg-soft px-3 py-4 text-left transition-colors hover:pf-n-bd-cyan"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border pf-n-bd-cyan pf-n-bg-cyan pf-n-t-cyan">
                  <IconPaperclip className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold pf-n-t">Adjuntar comprobante</span>
                  <span className="block text-xs pf-n-t-45">Foto o PDF · JPG, PNG o PDF</span>
                </span>
              </label>
            )}
            <input
              id="manual-receipt-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                void handleReceiptFileChange(file);
                event.target.value = "";
              }}
            />

            {/* Nota */}
            <label
              className="mt-4 block text-[11px] uppercase tracking-[0.14em] pf-n-t-45"
              htmlFor="manual-note"
            >
              Nota opcional
            </label>
            <textarea
              id="manual-note"
              value={manualNote}
              onChange={(event) => setManualNote(event.target.value)}
              placeholder="Referencia, numero de operacion o comentario"
              rows={3}
              className="pf-n-input mt-2 w-full rounded-xl border pf-n-bd pf-n-bg-soft px-3 py-2 text-sm pf-n-t outline-none focus:pf-n-bd-cyan"
            />

            {manualFileError ? (
              <p className="mt-3 rounded-xl border pf-n-bd-red pf-n-bg-red px-3 py-2 text-xs pf-n-t-red">
                {manualFileError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={() => void submitManualPayment()}
                disabled={manualSubmitting}
                className="pf-n-solid-btn inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {manualSubmitting ? "Enviando..." : "Enviar informe"}
              </ReliableActionButton>
              <button
                type="button"
                onClick={closeManualSheet}
                disabled={manualSubmitting}
                className="pf-n-ghost-btn rounded-2xl border px-4 py-3 text-sm font-semibold disabled:opacity-45"
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>,
            document.body
          )
        : null}
    </main>
  );
}