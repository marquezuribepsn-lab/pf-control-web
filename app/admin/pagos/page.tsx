"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useSharedState } from "@/components/useSharedState";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ManualOrder = {
  id: string;
  userId: string;
  email: string;
  clientKey: string | null;
  paymentMethod: "transferencia" | "efectivo" | "mercadopago";
  status: string;
  providerStatus: string | null;
  amount: number;
  currency: string;
  periodDays: number;
  receiptNumber: string | null;
  receiptIssuedAt: string | null;
  createdAt: string;
  approvedAt: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  reviewedByUserEmail: string | null;
};

type ManualOrdersResponse = {
  ok?: boolean;
  total?: number;
  orders?: ManualOrder[];
  message?: string;
};

type ClienteMetaSnapshot = {
  pagoEstado?: "confirmado" | "pendiente" | string;
  importe?: string | number | null;
};

type PagoRegistro = {
  id: string;
  clientId: string;
  clientName: string;
  fecha: string;
  importe: number;
  moneda: string;
  createdAt: string;
};

type ResumenMensualIngreso = {
  mes: string;
  cantidadPagos: number;
  clientesUnicos: number;
  total: number;
  moneda: string;
};

type TransferAccount = {
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
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

type TransferAccountsResponse = {
  ok?: boolean;
  total?: number;
  accounts?: TransferAccount[];
  message?: string;
};

type TransferAccountFormState = {
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
  isVisible: boolean;
};

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const PAGOS_KEY = "pf-control-pagos-v1";

const EMPTY_TRANSFER_ACCOUNT_FORM: TransferAccountFormState = {
  id: "",
  label: "",
  bankName: "",
  accountType: "",
  holderName: "",
  holderDocument: "",
  accountNumber: "",
  cbu: "",
  alias: "",
  notes: "",
  isVisible: true,
};

function parseMoneyAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(
    String(value || "")
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.-]/g, "")
      .trim()
  );

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(amount: number, currency = "ARS"): string {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `${currency.toUpperCase()} ${safeAmount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatPeso(amount: number): string {
  const safeAmount = Number.isFinite(Number(amount)) ? Math.max(0, Number(amount)) : 0;
  return `$${Math.round(safeAmount).toLocaleString("es-AR")}`;
}

function resolveMethodLabel(method: string): string {
  const normalized = String(method || "").trim().toLowerCase();
  if (normalized === "efectivo") return "Efectivo";
  if (normalized === "transferencia") return "Transferencia";
  return "Manual";
}

function resolveStatusTone(status: string): string {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "approved") return "border-emerald-300/45 bg-emerald-500/15 text-emerald-100";
  if (normalized === "rejected") return "border-rose-300/45 bg-rose-500/15 text-rose-100";
  return "border-amber-300/45 bg-amber-500/15 text-amber-100";
}

export default function AdminPagosManualPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = String((session?.user as { role?: string } | undefined)?.role || "")
    .trim()
    .toUpperCase();
  const [clientesMeta] = useSharedState<Record<string, ClienteMetaSnapshot>>({}, {
    key: CLIENTE_META_KEY,
    legacyLocalStorageKey: CLIENTE_META_KEY,
  });
  const [pagosMensuales] = useSharedState<PagoRegistro[]>([], {
    key: PAGOS_KEY,
    legacyLocalStorageKey: PAGOS_KEY,
  });

  const [orders, setOrders] = useState<ManualOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [notesByOrderId, setNotesByOrderId] = useState<Record<string, string>>({});
  const [transferAccounts, setTransferAccounts] = useState<TransferAccount[]>([]);
  const [accountForm, setAccountForm] = useState<TransferAccountFormState>(EMPTY_TRANSFER_ACCOUNT_FORM);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = showAll ? "?all=1" : "";
      const response = await fetch(`/api/admin/payments/manual${query}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as ManualOrdersResponse;

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo cargar el panel de pagos manuales"));
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "No se pudo cargar el panel de pagos manuales.");
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || role !== "ADMIN") {
      return;
    }
    void loadOrders();
  }, [loadOrders, role, sessionStatus]);

  const loadTransferAccounts = useCallback(async () => {
    setAccountLoading(true);
    setAccountError("");

    try {
      const response = await fetch("/api/admin/payments/accounts", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as TransferAccountsResponse;

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo cargar cuentas de transferencia."));
      }

      setTransferAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (err) {
      setTransferAccounts([]);
      setAccountError(err instanceof Error ? err.message : "No se pudo cargar cuentas de transferencia.");
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || role !== "ADMIN") {
      return;
    }
    void loadTransferAccounts();
  }, [loadTransferAccounts, role, sessionStatus]);

  const pendingCount = useMemo(
    () => orders.filter((order) => String(order.status || "").toLowerCase() === "pending").length,
    [orders]
  );

  const paymentSummary = useMemo(() => {
    const metas = Object.values(clientesMeta || {}).filter(
      (row): row is ClienteMetaSnapshot => Boolean(row) && typeof row === "object"
    );

    const pagosConfirmados = metas.filter(
      (meta) => String(meta.pagoEstado || "").trim().toLowerCase() === "confirmado"
    ).length;
    const pagosPendientes = metas.filter(
      (meta) => String(meta.pagoEstado || "").trim().toLowerCase() === "pendiente"
    ).length;

    const ingresosConfirmados = metas
      .filter((meta) => String(meta.pagoEstado || "").trim().toLowerCase() === "confirmado")
      .reduce((acc, meta) => acc + parseMoneyAmount(meta.importe), 0);

    const saldoPendiente = metas
      .filter((meta) => String(meta.pagoEstado || "").trim().toLowerCase() === "pendiente")
      .reduce((acc, meta) => acc + parseMoneyAmount(meta.importe), 0);

    return {
      pagosConfirmados,
      pagosPendientes,
      ingresosConfirmados,
      saldoPendiente,
    };
  }, [clientesMeta]);

  const resumenMensualIngresos = useMemo<ResumenMensualIngreso[]>(() => {
    const agrupado: Record<string, { cantidadPagos: number; total: number; clientes: Set<string>; moneda: string }> = {};

    for (const pago of pagosMensuales) {
      const mes = String(pago.fecha || "").slice(0, 7);
      if (!mes) continue;

      if (!agrupado[mes]) {
        agrupado[mes] = {
          cantidadPagos: 0,
          total: 0,
          clientes: new Set<string>(),
          moneda: String(pago.moneda || "ARS").toUpperCase() || "ARS",
        };
      }

      agrupado[mes].cantidadPagos += 1;
      agrupado[mes].total += parseMoneyAmount(pago.importe);
      agrupado[mes].clientes.add(String(pago.clientId || pago.clientName || pago.id || ""));
      if (!agrupado[mes].moneda && pago.moneda) {
        agrupado[mes].moneda = String(pago.moneda).toUpperCase();
      }
    }

    return Object.entries(agrupado)
      .map(([mes, item]) => ({
        mes,
        cantidadPagos: item.cantidadPagos,
        clientesUnicos: item.clientes.size,
        total: item.total,
        moneda: item.moneda || "ARS",
      }))
      .sort((a, b) => b.mes.localeCompare(a.mes));
  }, [pagosMensuales]);

  const handleDecision = async (orderId: string, action: "approve" | "reject") => {
    setActionLoadingId(orderId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          action,
          adminNote: String(notesByOrderId[orderId] || "").trim(),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo procesar la orden"));
      }

      setMessage(String(data.message || "Accion completada."));
      setNotesByOrderId((prev) => ({ ...prev, [orderId]: "" }));
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la orden.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const startEditTransferAccount = (account: TransferAccount) => {
    setAccountMessage("");
    setAccountError("");
    setAccountForm({
      id: account.id,
      label: account.label,
      bankName: account.bankName,
      accountType: account.accountType,
      holderName: account.holderName,
      holderDocument: account.holderDocument,
      accountNumber: account.accountNumber,
      cbu: account.cbu,
      alias: account.alias,
      notes: account.notes,
      isVisible: account.isVisible,
    });
  };

  const resetTransferAccountForm = () => {
    setAccountForm(EMPTY_TRANSFER_ACCOUNT_FORM);
  };

  const saveTransferAccount = async () => {
    setAccountSaving(true);
    setAccountError("");
    setAccountMessage("");

    try {
      const response = await fetch("/api/admin/payments/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(accountForm),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo guardar la cuenta."));
      }

      setAccountMessage(String(data.message || "Cuenta guardada."));
      resetTransferAccountForm();
      await loadTransferAccounts();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "No se pudo guardar la cuenta.");
    } finally {
      setAccountSaving(false);
    }
  };

  const removeTransferAccount = async (id: string) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return;

    setAccountSaving(true);
    setAccountError("");
    setAccountMessage("");

    try {
      const response = await fetch("/api/admin/payments/accounts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: normalizedId }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo eliminar la cuenta."));
      }

      setAccountMessage(String(data.message || "Cuenta eliminada."));
      if (accountForm.id === normalizedId) {
        resetTransferAccountForm();
      }
      await loadTransferAccounts();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "No se pudo eliminar la cuenta.");
    } finally {
      setAccountSaving(false);
    }
  };

  const toggleTransferAccountVisibility = async (account: TransferAccount) => {
    setAccountSaving(true);
    setAccountError("");
    setAccountMessage("");

    try {
      const response = await fetch("/api/admin/payments/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: account.id,
          isVisible: !account.isVisible,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo actualizar visibilidad."));
      }

      setAccountMessage(String(data.message || "Visibilidad actualizada."));
      await loadTransferAccounts();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "No se pudo actualizar visibilidad.");
    } finally {
      setAccountSaving(false);
    }
  };

  if (sessionStatus === "loading") {
    return (
      <main className="mx-auto max-w-5xl p-6 text-slate-100">
        <p className="text-sm text-slate-300">Cargando panel de pagos...</p>
      </main>
    );
  }

  if (role !== "ADMIN") {
    return (
      <main className="mx-auto max-w-4xl p-6 text-slate-100">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 p-4 text-sm text-rose-200">
          Esta seccion es solo para administradores.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-5 text-slate-100 sm:p-8">
      <section className="rounded-3xl border border-amber-300/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-[0_20px_80px_rgba(245,158,11,0.16)]">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200/90">Admin pagos</p>
        <h1 className="mt-2 text-3xl font-black text-white">Pagos mensuales</h1>
        <p className="mt-2 text-sm text-slate-300">
          Vista consolidada de ingresos mensuales y confirmaciones manuales para renovar pases de alumnos.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1 font-semibold text-amber-100">
            Pendientes: {pendingCount}
          </span>

          <ReliableActionButton
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white"
          >
            {showAll ? "Ver solo pendientes" : "Ver historial reciente"}
          </ReliableActionButton>

          <ReliableActionButton
            type="button"
            onClick={() => void loadOrders()}
            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 font-semibold text-slate-100"
          >
            Actualizar
          </ReliableActionButton>
        </div>
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

      {accountMessage ? (
        <section className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {accountMessage}
        </section>
      ) : null}

      {accountError ? (
        <section className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {accountError}
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
        <h2 className="text-xl font-black text-white">Estado general de pagos</h2>
        <p className="mt-1 text-sm text-slate-300">Resumen en vivo desde la ficha de clientes.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-emerald-300/35 bg-emerald-500/10 p-4">
            <p className="text-[11px] uppercase tracking-wide text-emerald-100/90">Pagos confirmados</p>
            <p className="mt-2 text-2xl font-black text-emerald-100">{paymentSummary.pagosConfirmados}</p>
          </article>

          <article className="rounded-xl border border-rose-300/35 bg-rose-500/10 p-4">
            <p className="text-[11px] uppercase tracking-wide text-rose-100/90">Pagos pendientes</p>
            <p className="mt-2 text-2xl font-black text-rose-100">{paymentSummary.pagosPendientes}</p>
          </article>

          <article className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 p-4">
            <p className="text-[11px] uppercase tracking-wide text-cyan-100/90">Ingresos confirmados</p>
            <p className="mt-2 text-2xl font-black text-cyan-100">{formatPeso(paymentSummary.ingresosConfirmados)}</p>
          </article>

          <article className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-4">
            <p className="text-[11px] uppercase tracking-wide text-amber-100/90">Saldo pendiente</p>
            <p className="mt-2 text-2xl font-black text-amber-100">{formatPeso(paymentSummary.saldoPendiente)}</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
        <h2 className="text-xl font-black text-white">Resumen mensual de ingresos</h2>
        <p className="mt-1 text-sm text-slate-300">Consolidado por mes en base a pagos registrados.</p>

        {resumenMensualIngresos.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Todavia no hay pagos suficientes para armar el resumen mensual.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-800 text-slate-200">
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Pagos</th>
                  <th className="px-3 py-2">Clientes unicos</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {resumenMensualIngresos.map((row) => (
                  <tr key={row.mes} className="border-t border-white/10">
                    <td className="px-3 py-2 font-semibold text-slate-100">{row.mes}</td>
                    <td className="px-3 py-2 text-slate-300">{row.cantidadPagos}</td>
                    <td className="px-3 py-2 text-slate-300">{row.clientesUnicos}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-200">
                      {row.moneda} {row.total.toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
        <h2 className="text-xl font-black text-white">Cuentas destino para transferencia</h2>
        <p className="mt-1 text-sm text-slate-300">
          Carga aca las cuentas bancarias/corrientes que se mostraran a los alumnos al informar pagos por transferencia.
        </p>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">
              {accountForm.id ? "Editar cuenta" : "Nueva cuenta"}
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300">
                Etiqueta visible
                <input
                  value={accountForm.label}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      label: event.target.value,
                    }))
                  }
                  placeholder="Cuenta principal"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300">
                Banco / billetera
                <input
                  value={accountForm.bankName}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      bankName: event.target.value,
                    }))
                  }
                  placeholder="Banco Galicia"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300">
                Tipo de cuenta
                <input
                  value={accountForm.accountType}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      accountType: event.target.value,
                    }))
                  }
                  placeholder="Caja de ahorro"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300">
                Titular
                <input
                  value={accountForm.holderName}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      holderName: event.target.value,
                    }))
                  }
                  placeholder="Nombre del titular"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300">
                CUIT / Documento
                <input
                  value={accountForm.holderDocument}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      holderDocument: event.target.value,
                    }))
                  }
                  placeholder="20-12345678-9"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300">
                Numero de cuenta
                <input
                  value={accountForm.accountNumber}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      accountNumber: event.target.value,
                    }))
                  }
                  placeholder="000123456789"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300">
                CBU/CVU
                <input
                  value={accountForm.cbu}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      cbu: event.target.value,
                    }))
                  }
                  placeholder="0000003100000000000000"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300 sm:col-span-2">
                Alias
                <input
                  value={accountForm.alias}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      alias: event.target.value,
                    }))
                  }
                  placeholder="mi.alias.pagos"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300 sm:col-span-2">
                Nota opcional
                <textarea
                  value={accountForm.notes}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Ejemplo: enviar comprobante por WhatsApp al finalizar la transferencia"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>
            </div>

            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={accountForm.isVisible}
                onChange={(event) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    isVisible: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-white/20 bg-slate-900"
              />
              Visible para alumnos
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={() => void saveTransferAccount()}
                disabled={accountSaving}
                className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {accountSaving ? "Guardando..." : accountForm.id ? "Actualizar cuenta" : "Guardar cuenta"}
              </ReliableActionButton>

              <ReliableActionButton
                type="button"
                onClick={resetTransferAccountForm}
                disabled={accountSaving}
                className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Limpiar
              </ReliableActionButton>
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">
              Cuentas cargadas
            </h3>

            {accountLoading ? (
              <p className="mt-3 text-sm text-slate-300">Cargando cuentas...</p>
            ) : transferAccounts.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Todavia no hay cuentas de transferencia cargadas.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {transferAccounts.map((account) => (
                  <div key={account.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">{account.label}</p>
                        <p className="text-xs text-slate-400">
                          {account.bankName || "Banco no definido"}
                          {account.accountType ? ` · ${account.accountType}` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                          account.isVisible
                            ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                            : "border-slate-400/40 bg-slate-700/30 text-slate-200"
                        }`}
                      >
                        {account.isVisible ? "Visible" : "Oculta"}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-slate-300">
                      {account.holderName ? <p>Titular: {account.holderName}</p> : null}
                      {account.holderDocument ? <p>CUIT/DNI: {account.holderDocument}</p> : null}
                      {account.accountNumber ? <p>Nro cuenta: {account.accountNumber}</p> : null}
                      {account.cbu ? <p>CBU/CVU: {account.cbu}</p> : null}
                      {account.alias ? <p>Alias: {account.alias}</p> : null}
                      {account.notes ? <p>Nota: {account.notes}</p> : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <ReliableActionButton
                        type="button"
                        onClick={() => startEditTransferAccount(account)}
                        disabled={accountSaving}
                        className="rounded-lg border border-cyan-300/35 bg-cyan-500/12 px-3 py-1.5 text-xs font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Editar
                      </ReliableActionButton>

                      <ReliableActionButton
                        type="button"
                        onClick={() => void toggleTransferAccountVisibility(account)}
                        disabled={accountSaving}
                        className="rounded-lg border border-white/20 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {account.isVisible ? "Ocultar" : "Mostrar"}
                      </ReliableActionButton>

                      <ReliableActionButton
                        type="button"
                        onClick={() => void removeTransferAccount(account.id)}
                        disabled={accountSaving}
                        className="rounded-lg border border-rose-300/40 bg-rose-500/12 px-3 py-1.5 text-xs font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Eliminar
                      </ReliableActionButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-black text-white">Confirmaciones manuales</h2>
          <p className="mt-1 text-sm text-slate-300">
            Aprobacion o rechazo de pagos informados por transferencia o efectivo.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-300">Cargando pagos manuales...</p>
        ) : orders.length === 0 ? (
          <p className="rounded-2xl border border-white/15 bg-slate-900/70 p-4 text-sm text-slate-300">
            No hay solicitudes manuales para mostrar.
          </p>
        ) : (
          orders.map((order) => {
            const orderNote = notesByOrderId[order.id] ?? "";
            const pending = String(order.status || "").toLowerCase() === "pending";

            return (
              <article key={order.id} className="rounded-2xl border border-white/15 bg-slate-900/75 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{order.email}</p>
                    <p className="text-xs text-slate-400">Orden: {order.id}</p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${resolveStatusTone(order.status)}`}
                  >
                    {String(order.status || "pending").toUpperCase()}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Metodo</p>
                    <p className="mt-1 font-semibold text-white">{resolveMethodLabel(order.paymentMethod)}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Importe</p>
                    <p className="mt-1 font-semibold text-white">{formatMoney(order.amount, order.currency)}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Periodo</p>
                    <p className="mt-1 font-semibold text-white">{order.periodDays} dias</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Creado</p>
                    <p className="mt-1 font-semibold text-white">{formatDate(order.createdAt)}</p>
                  </div>
                </div>

                {order.adminNote ? (
                  <p className="mt-3 text-sm text-slate-300">Nota alumno/admin previa: {order.adminNote}</p>
                ) : null}

                {order.receiptNumber || order.receiptIssuedAt ? (
                  <p className="mt-2 text-xs text-cyan-200">
                    Comprobante: {order.receiptNumber || "-"}
                    {order.receiptIssuedAt ? ` · Emitido: ${formatDate(order.receiptIssuedAt)}` : ""}
                  </p>
                ) : null}

                {!pending ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Revisado: {formatDate(order.reviewedAt)}
                    {order.reviewedByUserEmail ? ` por ${order.reviewedByUserEmail}` : ""}
                  </p>
                ) : null}

                {pending ? (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={orderNote}
                      onChange={(event) =>
                        setNotesByOrderId((prev) => ({
                          ...prev,
                          [order.id]: event.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Nota opcional para el alumno"
                      className="w-full rounded-xl border border-white/15 bg-slate-950/55 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                    />

                    <div className="flex flex-wrap gap-3">
                      <ReliableActionButton
                        type="button"
                        onClick={() => void handleDecision(order.id, "approve")}
                        disabled={actionLoadingId === order.id}
                        className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {actionLoadingId === order.id ? "Procesando..." : "Aprobar y renovar pase"}
                      </ReliableActionButton>

                      <ReliableActionButton
                        type="button"
                        onClick={() => void handleDecision(order.id, "reject")}
                        disabled={actionLoadingId === order.id}
                        className="rounded-xl border border-rose-300/45 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {actionLoadingId === order.id ? "Procesando..." : "Rechazar"}
                      </ReliableActionButton>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
