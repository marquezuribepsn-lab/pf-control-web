"use client";

import Image from "next/image";
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

type MercadoPagoQrStoreConfig = {
  enabled: boolean;
  label: string;
  paymentLink: string;
  qrPayload: string;
  qrImageDataUrl: string | null;
  notes: string;
  updatedAt: string | null;
};

type MercadoPagoQrStoreFormState = {
  enabled: boolean;
  label: string;
  paymentLink: string;
  qrPayload: string;
  notes: string;
};

type MercadoPagoQrStoreResponse = {
  ok?: boolean;
  config?: MercadoPagoQrStoreConfig;
  message?: string;
};

type MercadoPagoConnectAccount = {
  userId: string | null;
  nickname: string | null;
  email: string | null;
  scope: string | null;
  publicKey: string | null;
  expiresAt: string | null;
  connectedAt: string;
  updatedAt: string;
};

type MercadoPagoConnectStatusResponse = {
  ok?: boolean;
  oauthEnabled?: boolean;
  configured?: boolean;
  source?: "linked-account" | "env" | "none" | string;
  accountLabel?: string | null;
  connected?: boolean;
  linkedAccount?: MercadoPagoConnectAccount | null;
  message?: string;
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

const EMPTY_MERCADO_PAGO_QR_FORM: MercadoPagoQrStoreFormState = {
  enabled: false,
  label: "",
  paymentLink: "",
  qrPayload: "",
  notes: "",
};

const EMPTY_MERCADO_PAGO_CONNECT_STATUS: MercadoPagoConnectStatusResponse = {
  ok: true,
  oauthEnabled: false,
  configured: false,
  source: "none",
  accountLabel: null,
  connected: false,
  linkedAccount: null,
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
  if (normalized === "mercadopago") return "Mercado Pago QR";
  return "Manual";
}

function resolveStatusTone(status: string): string {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "approved") return "border-emerald-300/45 bg-emerald-500/15 text-emerald-100";
  if (normalized === "rejected") return "border-rose-300/45 bg-rose-500/15 text-rose-100";
  return "border-amber-300/45 bg-amber-500/15 text-amber-100";
}

function resolveMercadoPagoOauthErrorMessage(code: string): string {
  const normalized = String(code || "").trim().toLowerCase();

  if (normalized === "no_autorizado") {
    return "No autorizado para conectar la cuenta de Mercado Pago.";
  }

  if (normalized === "oauth_no_configurado") {
    return "OAuth de Mercado Pago no configurado. Define MERCADOPAGO_APP_CLIENT_ID y MERCADOPAGO_APP_CLIENT_SECRET.";
  }

  if (normalized === "faltan_datos_oauth") {
    return "Mercado Pago no devolvio los datos esperados para completar la conexion.";
  }

  if (normalized === "state_invalido") {
    return "La sesion de conexion expiro o no es valida. Intenta conectar nuevamente.";
  }

  if (normalized === "fallo_conexion") {
    return "No se pudo terminar la conexion con Mercado Pago. Intenta nuevamente.";
  }

  if (normalized.startsWith("oauth_")) {
    return `Mercado Pago devolvio un error OAuth (${normalized.replace("oauth_", "")}).`;
  }

  return "No se pudo conectar la cuenta de Mercado Pago.";
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
  const [qrStoreForm, setQrStoreForm] = useState<MercadoPagoQrStoreFormState>(EMPTY_MERCADO_PAGO_QR_FORM);
  const [qrStorePreview, setQrStorePreview] = useState<string | null>(null);
  const [qrStoreUpdatedAt, setQrStoreUpdatedAt] = useState<string | null>(null);
  const [qrStoreLoading, setQrStoreLoading] = useState(true);
  const [qrStoreSaving, setQrStoreSaving] = useState(false);
  const [qrStoreError, setQrStoreError] = useState("");
  const [qrStoreMessage, setQrStoreMessage] = useState("");
  const [mpConnectStatus, setMpConnectStatus] = useState<MercadoPagoConnectStatusResponse>(
    EMPTY_MERCADO_PAGO_CONNECT_STATUS
  );
  const [mpConnectLoading, setMpConnectLoading] = useState(true);
  const [mpConnectActionLoading, setMpConnectActionLoading] = useState(false);
  const [mpConnectError, setMpConnectError] = useState("");
  const [mpConnectMessage, setMpConnectMessage] = useState("");

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

  const loadMercadoPagoConnectStatus = useCallback(async () => {
    setMpConnectLoading(true);
    setMpConnectError("");

    try {
      const response = await fetch("/api/admin/payments/mercadopago/connect", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as MercadoPagoConnectStatusResponse;

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo cargar estado de conexion con Mercado Pago."));
      }

      setMpConnectStatus({
        ok: true,
        oauthEnabled: Boolean(data.oauthEnabled),
        configured: Boolean(data.configured),
        source: String(data.source || "none"),
        accountLabel: data.accountLabel || null,
        connected: Boolean(data.connected),
        linkedAccount: data.linkedAccount || null,
      });
    } catch (err) {
      setMpConnectStatus(EMPTY_MERCADO_PAGO_CONNECT_STATUS);
      setMpConnectError(
        err instanceof Error ? err.message : "No se pudo cargar estado de conexion con Mercado Pago."
      );
    } finally {
      setMpConnectLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || role !== "ADMIN") {
      return;
    }
    void loadMercadoPagoConnectStatus();
  }, [loadMercadoPagoConnectStatus, role, sessionStatus]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const connected = String(url.searchParams.get("mp_connected") || "").trim();
    const errorCode = String(url.searchParams.get("mp_error") || "").trim();

    if (!connected && !errorCode) {
      return;
    }

    if (connected === "1") {
      setMpConnectMessage("Cuenta de Mercado Pago conectada correctamente.");
      setMpConnectError("");
    }

    if (errorCode) {
      setMpConnectError(resolveMercadoPagoOauthErrorMessage(errorCode));
      setMpConnectMessage("");
    }

    url.searchParams.delete("mp_connected");
    url.searchParams.delete("mp_error");
    window.history.replaceState({}, "", url.toString());

    void loadMercadoPagoConnectStatus();
  }, [loadMercadoPagoConnectStatus]);

  const loadQrStoreConfig = useCallback(async () => {
    setQrStoreLoading(true);
    setQrStoreError("");

    try {
      const response = await fetch("/api/admin/payments/mercadopago-qr", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as MercadoPagoQrStoreResponse;

      if (!response.ok || !data.config) {
        throw new Error(String(data.message || "No se pudo cargar configuracion QR de Mercado Pago."));
      }

      setQrStoreForm({
        enabled: Boolean(data.config.enabled),
        label: String(data.config.label || ""),
        paymentLink: String(data.config.paymentLink || ""),
        qrPayload: String(data.config.qrPayload || ""),
        notes: String(data.config.notes || ""),
      });
      setQrStorePreview(data.config.qrImageDataUrl || null);
      setQrStoreUpdatedAt(data.config.updatedAt || null);
    } catch (err) {
      setQrStoreError(
        err instanceof Error ? err.message : "No se pudo cargar configuracion QR de Mercado Pago."
      );
      setQrStoreForm(EMPTY_MERCADO_PAGO_QR_FORM);
      setQrStorePreview(null);
      setQrStoreUpdatedAt(null);
    } finally {
      setQrStoreLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || role !== "ADMIN") {
      return;
    }
    void loadQrStoreConfig();
  }, [loadQrStoreConfig, role, sessionStatus]);

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

  const saveQrStoreConfig = async () => {
    setQrStoreSaving(true);
    setQrStoreError("");
    setQrStoreMessage("");

    try {
      const response = await fetch("/api/admin/payments/mercadopago-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(qrStoreForm),
      });

      const data = (await response.json().catch(() => ({}))) as MercadoPagoQrStoreResponse;

      if (!response.ok || !data.config) {
        throw new Error(String(data.message || "No se pudo guardar QR de Mercado Pago."));
      }

      setQrStoreMessage(String(data.message || "QR guardado."));
      setQrStoreForm({
        enabled: Boolean(data.config.enabled),
        label: String(data.config.label || ""),
        paymentLink: String(data.config.paymentLink || ""),
        qrPayload: String(data.config.qrPayload || ""),
        notes: String(data.config.notes || ""),
      });
      setQrStorePreview(data.config.qrImageDataUrl || null);
      setQrStoreUpdatedAt(data.config.updatedAt || null);
    } catch (err) {
      setQrStoreError(err instanceof Error ? err.message : "No se pudo guardar QR de Mercado Pago.");
    } finally {
      setQrStoreSaving(false);
    }
  };

  const resetQrStoreConfig = async () => {
    setQrStoreSaving(true);
    setQrStoreError("");
    setQrStoreMessage("");

    try {
      const response = await fetch("/api/admin/payments/mercadopago-qr", {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => ({}))) as MercadoPagoQrStoreResponse;

      if (!response.ok || !data.config) {
        throw new Error(String(data.message || "No se pudo reiniciar QR de Mercado Pago."));
      }

      setQrStoreMessage(String(data.message || "Configuracion QR reiniciada."));
      setQrStoreForm(EMPTY_MERCADO_PAGO_QR_FORM);
      setQrStorePreview(null);
      setQrStoreUpdatedAt(data.config.updatedAt || null);
    } catch (err) {
      setQrStoreError(err instanceof Error ? err.message : "No se pudo reiniciar QR de Mercado Pago.");
    } finally {
      setQrStoreSaving(false);
    }
  };

  const startMercadoPagoConnect = () => {
    setMpConnectMessage("");
    setMpConnectError("");
    window.location.assign("/api/admin/payments/mercadopago/connect/start");
  };

  const disconnectMercadoPagoAccount = async () => {
    setMpConnectActionLoading(true);
    setMpConnectMessage("");
    setMpConnectError("");

    try {
      const response = await fetch("/api/admin/payments/mercadopago/connect", {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => ({}))) as MercadoPagoConnectStatusResponse;

      if (!response.ok) {
        throw new Error(String(data.message || "No se pudo desconectar la cuenta de Mercado Pago."));
      }

      setMpConnectMessage(String(data.message || "Cuenta desconectada."));
      await loadMercadoPagoConnectStatus();
    } catch (err) {
      setMpConnectError(
        err instanceof Error ? err.message : "No se pudo desconectar la cuenta de Mercado Pago."
      );
    } finally {
      setMpConnectActionLoading(false);
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

      {qrStoreMessage ? (
        <section className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {qrStoreMessage}
        </section>
      ) : null}

      {qrStoreError ? (
        <section className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {qrStoreError}
        </section>
      ) : null}

      {mpConnectMessage ? (
        <section className="rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {mpConnectMessage}
        </section>
      ) : null}

      {mpConnectError ? (
        <section className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {mpConnectError}
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
        <h2 className="text-xl font-black text-white">Cuenta Mercado Pago conectada</h2>
        <p className="mt-1 text-sm text-slate-300">
          Vincula una cuenta real por OAuth. El sistema usara esa cuenta para checkout y webhooks sin
          copiar access tokens por usuario.
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-200">
          {mpConnectLoading ? (
            <p className="text-slate-300">Cargando estado de conexion...</p>
          ) : (
            <div className="space-y-2">
              <p>
                Estado: {mpConnectStatus.configured ? "Configurado" : "Sin configurar"}
              </p>
              <p>
                Fuente de cobro: {mpConnectStatus.source === "linked-account"
                  ? "Cuenta conectada (OAuth)"
                  : mpConnectStatus.source === "env"
                    ? "Token de entorno"
                    : "Sin fuente de cobro"}
              </p>
              {mpConnectStatus.accountLabel ? <p>Cuenta: {mpConnectStatus.accountLabel}</p> : null}
              {mpConnectStatus.linkedAccount?.nickname ? (
                <p>Alias MP: {mpConnectStatus.linkedAccount.nickname}</p>
              ) : null}
              {mpConnectStatus.linkedAccount?.email ? (
                <p>Email MP: {mpConnectStatus.linkedAccount.email}</p>
              ) : null}
              {mpConnectStatus.linkedAccount?.updatedAt ? (
                <p>Actualizado: {formatDate(mpConnectStatus.linkedAccount.updatedAt)}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ReliableActionButton
            type="button"
            onClick={startMercadoPagoConnect}
            disabled={mpConnectActionLoading || mpConnectLoading || !mpConnectStatus.oauthEnabled}
            className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {mpConnectStatus.connected ? "Reconectar cuenta MP" : "Conectar cuenta MP"}
          </ReliableActionButton>

          <ReliableActionButton
            type="button"
            onClick={() => void disconnectMercadoPagoAccount()}
            disabled={mpConnectActionLoading || mpConnectLoading || !mpConnectStatus.connected}
            className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {mpConnectActionLoading ? "Procesando..." : "Desconectar"}
          </ReliableActionButton>

          <ReliableActionButton
            type="button"
            onClick={() => void loadMercadoPagoConnectStatus()}
            disabled={mpConnectActionLoading || mpConnectLoading}
            className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {mpConnectLoading ? "Cargando..." : "Recargar estado"}
          </ReliableActionButton>
        </div>

        {!mpConnectStatus.oauthEnabled ? (
          <p className="mt-3 text-xs text-amber-200/90">
            Para habilitar la conexion OAuth, configura MERCADOPAGO_APP_CLIENT_ID y
            MERCADOPAGO_APP_CLIENT_SECRET en el entorno.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
        <h2 className="text-xl font-black text-white">Mercado Pago QR de tienda</h2>
        <p className="mt-1 text-sm text-slate-300">
          Configura un QR de cobro tipo tienda para que el alumno pueda pagar escaneando, sin cargar credenciales
          developer por cada cuenta.
        </p>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">Configuracion QR</h3>

            <div className="mt-3 grid gap-3">
              <label className="text-xs text-slate-300">
                Nombre visible para alumnos
                <input
                  value={qrStoreForm.label}
                  onChange={(event) =>
                    setQrStoreForm((prev) => ({
                      ...prev,
                      label: event.target.value,
                    }))
                  }
                  placeholder="Tienda PF Control"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300">
                Link de pago Mercado Pago (opcional)
                <input
                  value={qrStoreForm.paymentLink}
                  onChange={(event) =>
                    setQrStoreForm((prev) => ({
                      ...prev,
                      paymentLink: event.target.value,
                    }))
                  }
                  placeholder="https://mpago.la/..."
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300">
                Texto o payload del QR
                <textarea
                  value={qrStoreForm.qrPayload}
                  onChange={(event) =>
                    setQrStoreForm((prev) => ({
                      ...prev,
                      qrPayload: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Si lo dejas vacio, se usa automaticamente el link de pago"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>

              <label className="text-xs text-slate-300">
                Nota para el alumno (opcional)
                <textarea
                  value={qrStoreForm.notes}
                  onChange={(event) =>
                    setQrStoreForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Ejemplo: luego envia el comprobante desde Informar pago QR"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/45"
                />
              </label>
            </div>

            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={qrStoreForm.enabled}
                onChange={(event) =>
                  setQrStoreForm((prev) => ({
                    ...prev,
                    enabled: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-white/20 bg-slate-900"
              />
              Habilitar QR para alumnos
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={() => void saveQrStoreConfig()}
                disabled={qrStoreSaving || qrStoreLoading}
                className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {qrStoreSaving ? "Guardando..." : "Guardar QR"}
              </ReliableActionButton>

              <ReliableActionButton
                type="button"
                onClick={() => void resetQrStoreConfig()}
                disabled={qrStoreSaving || qrStoreLoading}
                className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Reiniciar
              </ReliableActionButton>

              <ReliableActionButton
                type="button"
                onClick={() => void loadQrStoreConfig()}
                disabled={qrStoreSaving || qrStoreLoading}
                className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {qrStoreLoading ? "Cargando..." : "Recargar"}
              </ReliableActionButton>
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">Vista previa del QR</h3>

            {qrStoreLoading ? (
              <p className="mt-3 text-sm text-slate-300">Cargando configuracion QR...</p>
            ) : qrStorePreview ? (
              <div className="mt-3 space-y-3">
                <div className="inline-flex rounded-xl border border-white/15 bg-white/95 p-2">
                  <Image
                    src={qrStorePreview}
                    alt="QR Mercado Pago"
                    width={220}
                    height={220}
                    unoptimized
                    className="h-[220px] w-[220px] rounded-lg"
                  />
                </div>

                <div className="space-y-1 text-xs text-slate-300">
                  <p>
                    Estado: {qrStoreForm.enabled ? "Visible para alumnos" : "Oculto"}
                  </p>
                  <p>
                    Etiqueta: {qrStoreForm.label || "Mercado Pago QR"}
                  </p>
                  {qrStoreUpdatedAt ? <p>Actualizado: {formatDate(qrStoreUpdatedAt)}</p> : null}
                </div>

                {qrStoreForm.paymentLink ? (
                  <a
                    href={qrStoreForm.paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-lg border border-cyan-300/45 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                  >
                    Abrir link de pago
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Aun no hay QR generado. Guarda un link o payload para crear la vista previa.
              </p>
            )}
          </article>
        </div>
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
            Aprobacion o rechazo de pagos informados por transferencia, efectivo o QR de Mercado Pago.
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
