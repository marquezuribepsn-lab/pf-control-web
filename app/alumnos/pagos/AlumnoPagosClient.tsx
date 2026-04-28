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

export default function AlumnoPagosClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentQueryStatus = String(searchParams.get("payment") || "").trim().toLowerCase();

  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [manualLoadingMethod, setManualLoadingMethod] = useState<"transferencia" | "efectivo" | null>(null);
  const [manualNote, setManualNote] = useState("");
  const [manualReceipt, setManualReceipt] = useState<ManualPaymentReceipt | null>(null);
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
    } catch (loadError) {
      if (!options?.silent) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo consultar el estado de pagos."
        );
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
    router.prefetch("/alumnos/inicio");
  }, [router]);

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
      await loadStatus();
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

  const isActive = Boolean(status?.active);
  const canPay = Boolean(status?.mercadoPago?.configured && status?.reason !== "no-meta");
  const canRequestManual = Boolean(status?.manualMethodsEnabled && status?.reason !== "no-meta");

  const statusTone = useMemo(
    () => resolveStatusTone(isActive, status?.reason || "no-meta"),
    [isActive, status?.reason]
  );

  return (
    <main className="pf-alumno-main pf-alumno-v2">
      <div className="pf-a2-shell pb-24 md:pb-8">
        <header className="pf-a2-hero pf-a2-hero-shell rounded-[1.4rem] border px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <ReliableActionButton
                type="button"
                onClick={() => router.push("/alumnos/inicio")}
                className="pf-a2-back-btn mt-0.5"
                aria-label="Volver al inicio"
                title="Volver al inicio"
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
              </ReliableActionButton>

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

            <ReliableActionButton
              type="button"
              onClick={() => void loadStatus()}
              className="pf-a2-ghost-btn rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              Actualizar estado
            </ReliableActionButton>
          </div>
        </header>

        {message ? (
          <section className="pf-a2-banner pf-a2-banner-ok rounded-xl border px-4 py-3 text-sm">
            {message}
          </section>
        ) : null}

        {error ? (
          <section className="pf-a2-banner pf-a2-banner-danger rounded-xl border px-4 py-3 text-sm">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="pf-a2-eyebrow">Estado actual</p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {loading ? "Consultando..." : resolveReasonLabel(status?.reason || "no-meta")}
                </h2>
              </div>
              <span className={`pf-a2-badge pf-a2-badge-${statusTone}`}>
                {isActive ? "ACTIVO" : "INHABILITADO"}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300">
              {loading
                ? "Estamos consultando tu pase, espera unos segundos."
                : resolveReasonDetail(status?.reason || "no-meta")}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="pf-a2-kpi rounded-xl border p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Pago al dia</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {status?.paymentSummary?.isPaid ? "Si" : "No"}
                </p>
              </div>
              <div className="pf-a2-kpi rounded-xl border p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Vigencia del plan</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {formatDate(status?.paymentSummary?.planValidUntil || status?.billing.endDate)}
                </p>
              </div>
              <div className="pf-a2-kpi rounded-xl border p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Ultimo pago</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {formatDate(status?.paymentSummary?.latestPaymentAt)}
                </p>
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

            <div className="pf-a2-drawer mt-4 rounded-xl border border-slate-500/45 bg-slate-900/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Monto de renovacion</p>
              <p className="mt-1 text-xl font-black text-white">
                {formatMoney(status?.billing.amount || 0, status?.billing.currency || "ARS")}
              </p>
              <p className="text-xs text-slate-300">
                Periodo: {status?.billing.periodDays || 0} dias
                {typeof status?.daysRemaining === "number" ? ` · Restan ${status.daysRemaining} dias` : ""}
              </p>
              {status?.mercadoPago?.accountLabel ? (
                <p className="mt-2 text-xs text-slate-400">
                  Cuenta receptora: {status.mercadoPago.accountLabel}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={startCheckout}
                disabled={!canPay || checkoutLoading || loading}
                className="pf-a2-solid-btn rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {checkoutLoading ? "Redirigiendo..." : "Pagar con Mercado Pago"}
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => router.push("/alumnos/inicio")}
                className="pf-a2-ghost-btn rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Ir a inicio
              </ReliableActionButton>
            </div>
          </article>

          <article className="pf-a2-card rounded-[1.2rem] border p-4 sm:p-5">
            <p className="pf-a2-eyebrow">Pago manual</p>
            <h2 className="mt-1 text-xl font-black text-white">Transferencia o efectivo</h2>
            <p className="mt-2 text-sm text-slate-300">
              Si ya pagaste por fuera de Mercado Pago, envia el aviso para revision del admin.
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
                disabled={Boolean(manualLoadingMethod) || loading || !canRequestManual}
                className="pf-a2-ghost-btn rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {manualLoadingMethod === "transferencia" ? "Enviando..." : "Informar transferencia"}
              </ReliableActionButton>

              <ReliableActionButton
                type="button"
                onClick={() => void requestManualReview("efectivo")}
                disabled={Boolean(manualLoadingMethod) || loading || !canRequestManual}
                className="pf-a2-ghost-btn rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {manualLoadingMethod === "efectivo" ? "Enviando..." : "Informar efectivo"}
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
                  <p className="mt-1 text-xs text-cyan-200">
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
        </section>
      </div>
    </main>
  );
}