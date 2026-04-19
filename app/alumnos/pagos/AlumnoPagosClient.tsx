"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  } | null;
  providerConfigured: boolean;
  manualMethodsEnabled: boolean;
  mercadoPago: {
    configured: boolean;
    accountLabel: string | null;
    collectorGuardEnabled: boolean;
  };
};

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
      return "Tu pase esta activo";
    case "expired-pass":
      return "Tu pase vencio";
    case "pending-payment":
      return "Tu pase esta pendiente de pago";
    case "no-meta":
      return "No encontramos una ficha de pago asociada";
    default:
      return "Estado de pago";
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
      return "Desconocido por contracargo";
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

export default function AlumnoPagosClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentQueryStatus = String(searchParams.get("payment") || "").trim().toLowerCase();
  const shouldAutoValidatePayment = paymentQueryStatus === "success" || paymentQueryStatus === "pending";

  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [manualLoadingMethod, setManualLoadingMethod] = useState<"transferencia" | "efectivo" | null>(null);
  const [manualNote, setManualNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
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
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : "No se pudo consultar el estado de pagos.");
        setStatus(null);
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!paymentQueryStatus) return;

    if (paymentQueryStatus === "success") {
      setMessage("Estamos validando tu pago. En cuanto Mercado Pago lo confirme, tu pase se renueva automaticamente.");
      return;
    }

    if (paymentQueryStatus === "pending") {
      setMessage("Tu pago quedo pendiente. Apenas se apruebe, el pase se habilita en forma automatica.");
      return;
    }

    if (paymentQueryStatus === "failure") {
      setError("El pago no se pudo completar. Puedes intentar nuevamente.");
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

    setMessage("Pago confirmado. Acceso habilitado. Redirigiendo al inicio...");
    const timeoutId = window.setTimeout(() => {
      router.replace("/alumnos/inicio");
    }, 1300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [router, status?.active]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago.");
      setCheckoutLoading(false);
    }
  };

  const requestManualReview = async (method: "transferencia" | "efectivo") => {
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
      };

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo registrar el pago manual"));
      }

      setMessage(
        data.message ||
          "Solicitud enviada. Queda pendiente de confirmacion del admin para renovar tu pase."
      );
      setManualNote("");
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago manual.");
    } finally {
      setManualLoadingMethod(null);
    }
  };

  const isActive = Boolean(status?.active);
  const canPay = Boolean(status?.mercadoPago?.configured && status?.reason !== "no-meta");
  const canRequestManual = Boolean(status?.manualMethodsEnabled && status?.reason !== "no-meta");

  const nextStepMessage = useMemo(() => {
    if (!status) return "";

    if (isActive) {
      if (typeof status.daysRemaining === "number" && status.daysRemaining >= 0) {
        return `Tu pase esta activo. Dias restantes: ${status.daysRemaining}.`;
      }
      return "Tu pase esta activo.";
    }

    if (status.reason === "no-meta") {
      return "Tu cuenta todavia no tiene una ficha de pago vinculada. Contacta al profesor para habilitarla.";
    }

    if (status.reason === "expired-pass") {
      return "Tu pase vencio. Completa el pago para recuperar el acceso automaticamente.";
    }

    return "Tu pase esta pendiente de pago. Completa el checkout para habilitar el acceso.";
  }, [isActive, status]);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-5 text-slate-100 sm:p-8">
      <section className="rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-[0_20px_80px_rgba(6,182,212,0.16)]">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200/90">Pagos</p>
        <h1 className="mt-2 text-3xl font-black text-white">Gestion de pase</h1>
        <p className="mt-2 text-sm text-slate-300">
          Desde aqui puedes pagar con Mercado Pago o informar transferencia/efectivo. El acceso se renueva al aprobarse el pago.
        </p>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
        {loading ? (
          <p className="text-sm text-slate-300">Consultando estado de tu pase...</p>
        ) : status ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/85">Estado</p>
                <p className="mt-1 text-xl font-black text-white">{resolveReasonLabel(status.reason)}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  isActive
                    ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100"
                    : "border-rose-300/40 bg-rose-500/20 text-rose-100"
                }`}
              >
                {isActive ? "ACTIVO" : "INHABILITADO"}
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-200">{nextStepMessage}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Inicio</p>
                <p className="mt-1 text-sm font-semibold text-white">{formatDate(status.billing.startDate)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Vencimiento</p>
                <p className="mt-1 text-sm font-semibold text-white">{formatDate(status.billing.endDate)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/90">Proximo checkout</p>
              <p className="mt-1 text-lg font-black text-cyan-50">
                {formatMoney(status.billing.amount, status.billing.currency)}
              </p>
              <p className="text-xs text-cyan-100/90">Renovacion por {status.billing.periodDays} dias</p>
              {status.mercadoPago?.accountLabel ? (
                <p className="mt-2 text-xs text-cyan-100/95">
                  Cuenta Mercado Pago receptora: <span className="font-bold">{status.mercadoPago.accountLabel}</span>
                </p>
              ) : null}
            </div>

            {status.latestOrder ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">Ultimo intento</p>
                <p className="mt-1 text-white">
                  {resolveOrderStatusLabel(status.latestOrder.status)} · {formatMoney(status.latestOrder.amount, status.latestOrder.currency)}
                </p>
                <p className="text-xs text-slate-300">
                  Metodo: {resolvePaymentMethodLabel(status.latestOrder.paymentMethod)}
                  {status.latestOrder.providerStatus ? ` · ${status.latestOrder.providerStatus}` : ""}
                </p>
                <p className="text-xs text-slate-400">
                  Creado: {formatDate(status.latestOrder.createdAt)}
                  {status.latestOrder.approvedAt ? ` · Aprobado: ${formatDate(status.latestOrder.approvedAt)}` : ""}
                  {status.latestOrder.reviewedAt ? ` · Revisado: ${formatDate(status.latestOrder.reviewedAt)}` : ""}
                </p>
                {status.latestOrder.adminNote ? (
                  <p className="mt-1 text-xs text-slate-300">Nota admin: {status.latestOrder.adminNote}</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-rose-200">No pudimos cargar la informacion de pagos.</p>
        )}
      </section>

      {message ? (
        <section className="rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </section>
      ) : null}

      {error ? (
        <section className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </section>
      ) : null}

      {canRequestManual ? (
        <section className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Pago manual</p>
          <h2 className="mt-1 text-lg font-black text-amber-50">Transferencia o efectivo con confirmacion admin</h2>
          <p className="mt-2 text-sm text-amber-100/90">
            Si ya pagaste por transferencia o en efectivo, registra el aviso y el admin lo confirma desde su panel.
          </p>

          <label className="mt-3 block text-xs uppercase tracking-wide text-amber-100/80" htmlFor="manual-note">
            Detalle opcional (comprobante, referencia o aclaracion)
          </label>
          <textarea
            id="manual-note"
            value={manualNote}
            onChange={(event) => setManualNote(event.target.value)}
            placeholder="Ejemplo: Transferencia realizada desde Banco X, referencia 34567"
            rows={3}
            className="mt-2 w-full rounded-xl border border-amber-200/25 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/55"
          />

          <div className="mt-3 flex flex-wrap gap-3">
            <ReliableActionButton
              type="button"
              onClick={() => void requestManualReview("transferencia")}
              disabled={Boolean(manualLoadingMethod) || loading}
              className="rounded-xl border border-amber-200/45 bg-amber-300/20 px-4 py-2 text-sm font-semibold text-amber-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {manualLoadingMethod === "transferencia"
                ? "Enviando aviso..."
                : "Informar transferencia"}
            </ReliableActionButton>

            <ReliableActionButton
              type="button"
              onClick={() => void requestManualReview("efectivo")}
              disabled={Boolean(manualLoadingMethod) || loading}
              className="rounded-xl border border-amber-200/45 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {manualLoadingMethod === "efectivo" ? "Enviando aviso..." : "Informar pago en efectivo"}
            </ReliableActionButton>
          </div>
        </section>
      ) : null}

      <section className="flex flex-wrap gap-3">
        <ReliableActionButton
          type="button"
          onClick={() => void loadStatus()}
          className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100"
        >
          Actualizar estado
        </ReliableActionButton>

        <ReliableActionButton
          type="button"
          onClick={startCheckout}
          disabled={!canPay || checkoutLoading || loading}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {checkoutLoading ? "Redirigiendo a Mercado Pago..." : "Pagar con Mercado Pago"}
        </ReliableActionButton>

        <ReliableActionButton
          type="button"
          onClick={() => router.push("/alumnos/inicio")}
          className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100"
        >
          Volver al inicio
        </ReliableActionButton>
      </section>
    </main>
  );
}
