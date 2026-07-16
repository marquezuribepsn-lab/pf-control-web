"use client";

import Image from "next/image";
import PlanesDestacados from "@/components/PlanesDestacados";
import ReliableActionButton from "@/components/ReliableActionButton";
import ReliableLink from "@/components/ReliableLink";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type ManualPaymentReceipt = {
  number: string | null;
  issuedAt: string | null;
  amount: number;
  currency: string;
  periodDays: number;
  paymentMethod: "transferencia" | "efectivo" | "mercadopago";
  status: string;
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
      return "border-emerald-300/35 bg-emerald-500/15 text-emerald-200";
    case "warning":
      return "border-amber-300/35 bg-amber-500/15 text-amber-200";
    case "danger":
      return "border-rose-300/35 bg-rose-500/15 text-rose-200";
    default:
      return "border-slate-300/25 bg-slate-500/15 text-slate-200";
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

function IconWalletCard({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <rect x="2.8" y="6" width="18.4" height="13" rx="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.8 10.4h18.4" strokeLinecap="round" />
      <path d="M6.5 14.4h4" strokeLinecap="round" />
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

const PAYMENT_STATUS_BRANDED_LOADING_MIN_MS = 0;

export default function AlumnoPagosClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentQueryStatus = String(searchParams.get("payment") || "").trim().toLowerCase();
  const payFromApp = searchParams.get("pay") === "1";
  const nativePlatformFlag = String(searchParams.get("pfnative") || "").trim().toLowerCase();

  const [isIosNative, setIsIosNative] = useState(false);

  useEffect(() => {
    setIsIosNative(detectIosNative(nativePlatformFlag));
  }, [nativePlatformFlag]);

  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [manualLoadingMethod, setManualLoadingMethod] = useState<
    "transferencia" | "efectivo" | "mercadopago" | null
  >(null);
  const [statusRefreshLoading, setStatusRefreshLoading] = useState(false);
  const [manualNote, setManualNote] = useState("");
  const [manualReceipt, setManualReceipt] = useState<ManualPaymentReceipt | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const statusRefreshTimerRef = useRef<number | null>(null);
  const statusRefreshTokenRef = useRef(0);
  const manualSectionRef = useRef<HTMLElement | null>(null);

  const scrollToManualSection = useCallback(() => {
    manualSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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

  const requestManualReview = async (method: "transferencia" | "efectivo" | "mercadopago") => {
    if (!status) return;

    setManualLoadingMethod(method);
    setError("");

    try {
      const response = await fetch("/api/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method,
          amount: status.billing.amount,
          currency: status.billing.currency,
          periodDays: status.billing.periodDays,
          note: manualNote,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        receipt?: ManualPaymentReceipt;
      };

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo registrar el pago manual"));
      }

      setMessage(
        data.message ||
          "Solicitud enviada. Queda pendiente de confirmacion del admin para renovar tu pase."
      );
      setManualReceipt(data.receipt || null);
      setManualNote("");
      await loadStatus({ withBrandedLoader: true });
    } catch (manualError) {
      setError(
        manualError instanceof Error
          ? manualError.message
          : "No se pudo registrar el pago manual."
      );
    } finally {
      setManualLoadingMethod(null);
    }
  };

  const handleManualRefresh = async () => {
    await loadStatus({ withBrandedLoader: true });
    setLastRefreshedAt(new Date().toISOString());
  };

  const isActive = Boolean(status?.active);
  // MP checkout requiere que el alumno tenga ficha de billing (clientKey) para que
  // el webhook pueda activar automáticamente el pase. Si aún no está vinculado,
  // se muestra un aviso en lugar de deshabilitar sin explicación.
  const canPay = Boolean(status?.mercadoPago?.configured && status?.reason !== "no-meta");
  const noMetaBlocksMP = Boolean(status?.mercadoPago?.configured && status?.reason === "no-meta");
  // Los botones manuales (transferencia/efectivo/QR MP) siempre están habilitados:
  // el admin puede revisar y aprobar el pago aunque no haya ficha de billing todavía.
  const canRequestManual = Boolean(status?.manualMethodsEnabled);
  const canUseQrStore = Boolean(status?.mercadoPago?.qrStore?.enabled);

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

    if (lastRefreshedAt) {
      items.push({
        id: `refresh-${lastRefreshedAt}`,
        icon: "refresh",
        tone: "neutral",
        title: "Estado actualizado",
        subtitle: isActive ? "Tu pase fue renovado exitosamente" : "Se volvio a consultar tu estado de pago",
        time: formatTime(lastRefreshedAt),
        ts: new Date(lastRefreshedAt).getTime() || 0,
      });
    }

    items.sort((a, b) => b.ts - a.ts);
    return items.slice(0, 5);
  }, [status?.latestApprovedOrder, status?.latestOrder, lastRefreshedAt, isActive]);

  return (
    <main className="pf-alumno-main pf-alumno-v2">
      <div className="pf-a2-shell pb-24 md:pb-8">
        {statusRefreshLoading ? (
          <div
            className="pf-a3-routine-log-overlay pf-a2-payments-loading-overlay"
            role="status"
            aria-live="polite"
            aria-label="Actualizando estado de pagos"
          >
            <section className="pf-a3-routine-empty pf-a3-routine-loading pf-a2-payments-loading-panel">
              <div className="pf-a3-routine-loading-visual" aria-hidden="true">
                <span className="pf-a3-routine-loading-ring" />
                <span className="pf-a3-routine-loading-core">PF</span>
              </div>
              <p className="pf-a3-routine-loading-brand">PF Control</p>
              <h2>Actualizando estado...</h2>
              <p>Sincronizando pagos y validaciones del centro.</p>
            </section>
          </div>
        ) : null}

        <header className="pf-a2-hero pf-a2-hero-shell rounded-[1.4rem] border px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => { window.location.assign("/alumnos/inicio"); }}
              className="pf-a2-back-btn mt-0.5"
              aria-label="Volver al inicio"
              title="Volver al inicio"
              style={{ position: "relative", zIndex: 9999 }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only">Volver al inicio</span>
            </button>

            <div className="min-w-0">
              <p className="pf-a2-eyebrow">BILLING</p>
              <h1 className="mt-1 break-words text-[clamp(1.35rem,4vw,2.2rem)] font-black text-white">
                Centro de pagos
              </h1>
              <p className="mt-2 max-w-2xl break-words text-sm text-slate-300">
                Gestiona tu pase mensual, paga por Mercado Pago o informa pago manual para revision.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {!isIosNative ? (
              <ReliableActionButton
                type="button"
                onClick={startCheckout}
                disabled={!canPay || checkoutLoading || loading || statusRefreshLoading}
                className="pf-a2-solid-btn inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                <IconWalletCard className="h-4 w-4" />
                {checkoutLoading ? "Redirigiendo..." : "Pagar ahora"}
                <IconChevron className="h-3.5 w-3.5" />
              </ReliableActionButton>
            ) : null}
            <ReliableActionButton
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={statusRefreshLoading}
              className="pf-a2-ghost-btn inline-flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              <IconRefresh className="h-4 w-4" />
              Actualizar estado
            </ReliableActionButton>
          </div>

          {noMetaBlocksMP && !isIosNative ? (
            <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              El pago con Mercado Pago requiere que el admin vincule tu cuenta al perfil de alumno. Mientras tanto podes informar un pago manual abajo.
            </p>
          ) : null}
        </header>

        {message ? (
          <section className="pf-a2-banner pf-a2-banner-ok flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${toneIconClasses("ok")}`}>
              <IconCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{splitMessage(message).title}</p>
              {splitMessage(message).subtitle ? (
                <p className="mt-0.5 text-xs text-emerald-100/75">{splitMessage(message).subtitle}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="pf-a2-banner pf-a2-banner-danger flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${toneIconClasses("danger")}`}>
              <IconAlert className="h-4 w-4" />
            </span>
            <p className="min-w-0">{error}</p>
          </section>
        ) : null}

        {!isIosNative ? (
          <PlanesDestacados
            daysRemaining={status?.daysRemaining ?? null}
            onSelectPlan={startCheckout}
            checkoutLoading={checkoutLoading}
            canPay={canPay}
          />
        ) : null}

        <section className="grid gap-4">
          <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneIconClasses(statusTone)}`}>
                  <IconCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-black text-white">
                    {loading ? "Consultando..." : resolveReasonLabel(status?.reason || "no-meta")}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {loading
                      ? "Estamos consultando tu pase, espera unos segundos."
                      : resolveReasonDetail(status?.reason || "no-meta")}
                  </p>
                </div>
              </div>
              <span className={`pf-a2-badge pf-a2-badge-${statusTone}`}>
                {isActive ? "ACTIVO" : "INHABILITADO"}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
                  <IconCalendar className="h-4 w-4 shrink-0 text-slate-400" />
                  Pago al dia
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-100">
                  {status?.paymentSummary?.isPaid ? "Si" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
                  <IconCalendar className="h-4 w-4 shrink-0 text-slate-400" />
                  Vigencia del plan
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-100">
                  {formatDate(status?.paymentSummary?.planValidUntil || status?.billing.endDate)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
                  <IconClock className="h-4 w-4 shrink-0 text-slate-400" />
                  Ultimo pago
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-100">
                  {formatDate(status?.paymentSummary?.latestPaymentAt)}
                </span>
              </div>
            </div>

            {status?.paymentSummary?.latestPaymentAt ? (
              <p className="mt-3 text-xs text-slate-300">
                Ultimo pago confirmado: {formatDate(status.paymentSummary.latestPaymentAt)}
                {typeof status.paymentSummary.latestPaymentAmount === "number"
                  ? ` · ${formatMoney(
                      status.paymentSummary.latestPaymentAmount,
                      status.paymentSummary.latestPaymentCurrency || status.billing.currency
                    )}`
                  : ""}
                {status.paymentSummary.latestPaymentMethod
                  ? ` · ${resolvePaymentMethodLabel(status.paymentSummary.latestPaymentMethod)}`
                  : ""}
              </p>
            ) : null}

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneIconClasses("ok")}`}>
                <IconDollar className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200/80">Monto de renovacion</p>
                <p className="mt-0.5 text-xl font-black text-white">
                  {formatMoney(status?.billing.amount || 0, status?.billing.currency || "ARS")}
                </p>
                <p className="text-xs text-emerald-100/70">
                  Periodo: {status?.billing.periodDays || 0} dias
                  {typeof status?.daysRemaining === "number" ? ` · Restan ${status.daysRemaining} dias` : ""}
                </p>
                {status?.mercadoPago?.accountLabel ? (
                  <p className="mt-1 text-xs text-emerald-100/60">
                    Cuenta receptora: {status.mercadoPago.accountLabel}
                  </p>
                ) : null}
              </div>
              <IconChevron className="h-4 w-4 shrink-0 text-emerald-200/50" />
            </div>

            {canUseQrStore && !isIosNative ? (
              <section className="mt-4 rounded-xl border border-violet-300/30 bg-violet-500/10 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-violet-100/90">QR tienda</p>
                <h3 className="mt-1 text-sm font-black text-violet-100">
                  {status?.mercadoPago?.qrStore?.label || "Mercado Pago QR"}
                </h3>

                <div className="mt-3 flex flex-wrap items-start gap-3">
                  {status?.mercadoPago?.qrStore?.qrImageDataUrl ? (
                    <div className="rounded-lg border border-white/20 bg-white/95 p-1.5">
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
                    <p className="text-xs text-violet-50/90">
                      Escanea este QR desde la app de Mercado Pago para pagar como en tienda.
                    </p>

                    {status?.mercadoPago?.qrStore?.notes ? (
                      <p className="text-xs text-violet-100/90">{status.mercadoPago.qrStore.notes}</p>
                    ) : null}

                    {status?.mercadoPago?.qrStore?.paymentLink ? (
                      <a
                        href={status.mercadoPago.qrStore.paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg border border-violet-200/45 bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-100"
                      >
                        Abrir link de pago
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {isIosNative ? (
              <>
                <div className="mt-4 rounded-xl border border-slate-500/45 bg-slate-900/40 p-3">
                  <p className="text-sm text-slate-200">
                    Para gestionar o renovar tu pase, ingresa a{" "}
                    <span className="font-semibold text-white">pf-control.com</span> desde el
                    navegador de tu telefono o computadora.
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Desde aqui podes consultar el estado de tu pase en cualquier momento.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ReliableLink
                    href="/alumnos/inicio"
                    className="pf-a2-ghost-btn inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold"
                  >
                    Ir a inicio
                  </ReliableLink>
                </div>
              </>
            ) : null}
          </article>

          {!isIosNative ? (
            <section>
              <h3 className="text-sm font-black text-white">Opciones de pago</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <ReliableActionButton
                  type="button"
                  onClick={startCheckout}
                  disabled={!canPay || checkoutLoading || loading || statusRefreshLoading}
                  className="pf-a2-card flex items-center gap-3 rounded-2xl border p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white">
                    <MercadoPagoLogo className="h-6 w-9" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">Mercado Pago</span>
                    <span className="block text-xs text-slate-300">Paga de forma rapida y segura</span>
                  </span>
                  <IconChevron className="h-4 w-4 shrink-0 text-slate-400" />
                </ReliableActionButton>

                <ReliableActionButton
                  type="button"
                  onClick={scrollToManualSection}
                  className="pf-a2-card flex items-center gap-3 rounded-2xl border p-3.5 text-left"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-500/15 text-violet-200">
                    <IconDocument className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">Pago manual</span>
                    <span className="block text-xs text-slate-300">Informa tu pago para revision</span>
                  </span>
                  <IconChevron className="h-4 w-4 shrink-0 text-slate-400" />
                </ReliableActionButton>
              </div>
            </section>
          ) : null}

          {!isIosNative ? (
          <article ref={manualSectionRef} className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
            <p className="pf-a2-eyebrow">Pago manual</p>
            <h2 className="mt-1 text-xl font-black text-white">Transferencia, efectivo o QR Mercado Pago</h2>
            <p className="mt-2 text-sm text-slate-300">
              Si ya pagaste por fuera del checkout, envia el aviso para revision del admin.
            </p>

            <div className="mt-3 rounded-xl border border-white/15 bg-slate-950/45 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                Cuentas destino (transferencia)
              </p>
              {Array.isArray(status?.transferAccounts) && status.transferAccounts.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {status.transferAccounts.map((account) => (
                    <article key={account.id} className="rounded-lg border border-white/10 bg-slate-900/70 p-2.5 text-xs text-slate-200">
                      <p className="font-semibold text-slate-100">{account.label}</p>
                      <p className="text-slate-300">
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
                <p className="mt-2 text-xs text-slate-400">
                  El admin aun no cargo cuentas de transferencia visibles.
                </p>
              )}
            </div>

            <label className="mt-3 block text-[11px] uppercase tracking-[0.14em] text-slate-400" htmlFor="manual-note">
              Nota opcional
            </label>
            <textarea
              id="manual-note"
              value={manualNote}
              onChange={(event) => setManualNote(event.target.value)}
              placeholder="Referencia, comprobante o comentario"
              rows={4}
              className="pf-a2-input mt-2 w-full rounded-xl border border-slate-500/55 bg-slate-900/55 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-300/65"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={() => void requestManualReview("transferencia")}
                disabled={Boolean(manualLoadingMethod) || loading || statusRefreshLoading || !canRequestManual}
                className="pf-a2-ghost-btn rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {manualLoadingMethod === "transferencia" ? "Enviando..." : "Informar transferencia"}
              </ReliableActionButton>

              <ReliableActionButton
                type="button"
                onClick={() => void requestManualReview("efectivo")}
                disabled={Boolean(manualLoadingMethod) || loading || statusRefreshLoading || !canRequestManual}
                className="pf-a2-ghost-btn rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {manualLoadingMethod === "efectivo" ? "Enviando..." : "Informar efectivo"}
              </ReliableActionButton>

              <ReliableActionButton
                type="button"
                onClick={() => void requestManualReview("mercadopago")}
                disabled={Boolean(manualLoadingMethod) || loading || statusRefreshLoading || !canRequestManual}
                className="pf-a2-ghost-btn rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {manualLoadingMethod === "mercadopago" ? "Enviando..." : "Informar pago QR MP"}
              </ReliableActionButton>
            </div>

            {manualReceipt ? (
              <section className="pf-a2-kpi mt-4 rounded-xl border p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Comprobante generado</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {manualReceipt.number || "Sin numero"}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Emitido: {formatDate(manualReceipt.issuedAt)} · Metodo: {resolvePaymentMethodLabel(manualReceipt.paymentMethod)}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {formatMoney(manualReceipt.amount, manualReceipt.currency)} · Periodo: {manualReceipt.periodDays} dias
                </p>
                <p className="mt-1 text-xs text-slate-400">Estado: {resolveOrderStatusLabel(manualReceipt.status)}</p>
              </section>
            ) : null}

            {status?.latestOrder ? (
              <section className="pf-a2-kpi mt-4 rounded-xl border p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Ultimo intento</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {resolveOrderStatusLabel(status.latestOrder.status)} ·{" "}
                  {formatMoney(status.latestOrder.amount, status.latestOrder.currency)}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Metodo: {resolvePaymentMethodLabel(status.latestOrder.paymentMethod)}
                  {status.latestOrder.providerStatus ? ` · ${status.latestOrder.providerStatus}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Creado: {formatDate(status.latestOrder.createdAt)}
                  {status.latestOrder.approvedAt
                    ? ` · Aprobado: ${formatDate(status.latestOrder.approvedAt)}`
                    : ""}
                  {status.latestOrder.reviewedAt
                    ? ` · Revisado: ${formatDate(status.latestOrder.reviewedAt)}`
                    : ""}
                </p>
                {status.latestOrder.receiptNumber || status.latestOrder.receiptIssuedAt ? (
                  <p className="mt-1 text-xs text-violet-200">
                    Comprobante: {status.latestOrder.receiptNumber || "-"}
                    {status.latestOrder.receiptIssuedAt
                      ? ` · Emitido: ${formatDate(status.latestOrder.receiptIssuedAt)}`
                      : ""}
                  </p>
                ) : null}
                {status.latestOrder.adminNote ? (
                  <p className="mt-1 text-xs text-slate-300">Nota admin: {status.latestOrder.adminNote}</p>
                ) : null}
              </section>
            ) : null}
          </article>
          ) : null}

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-white">Actividad reciente</h3>
              {activityItems.length > 0 ? (
                <ReliableActionButton
                  type="button"
                  onClick={scrollToManualSection}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 transition-colors hover:text-sky-200"
                  aria-label="Ver el detalle completo de tus movimientos"
                >
                  Ver todo
                  <IconChevron className="h-3.5 w-3.5" />
                </ReliableActionButton>
              ) : null}
            </div>
            <div className="mt-2 space-y-2">
              {activityItems.length > 0 ? (
                activityItems.map((item) => (
                  <div
                    key={item.id}
                    className="pf-a2-card flex items-center gap-3 rounded-2xl border p-3"
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
                      <span className="block text-sm font-semibold text-white">{item.title}</span>
                      <span className="block text-xs text-slate-300">{item.subtitle}</span>
                    </span>
                    {item.time ? (
                      <span className="shrink-0 text-xs text-slate-400">{item.time}</span>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="pf-a2-card rounded-2xl border p-3.5 text-xs text-slate-400">
                  Todavia no hay actividad reciente para mostrar.
                </p>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}