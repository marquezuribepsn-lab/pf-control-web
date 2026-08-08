"use client";

import AdminRunningLoaderOverlay, {
  AdminRunningLoaderCard,
} from "@/components/admin/AdminRunningLoader";
import {
  ADMIN_CARD_SURFACE,
  ADMIN_PAGE_CONTAINER,
  ADMIN_PAGE_CONTAINER_STACK,
} from "@/components/admin/layoutTokens";
import { useMinimumLoading } from "@/components/admin/useMinimumLoading";
import ReliableActionButton from "@/components/ReliableActionButton";
import { useSharedState } from "@/components/useSharedState";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  receiptFileUrl: string | null;
  receiptFileName: string | null;
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
  email?: string;
  pagoEstado?: "confirmado" | "pendiente" | string;
  importe?: string | number | null;
};

type IncomeScope = "monthly" | "annual";

type IncomeSelectedSummary = {
  total: number;
  paymentCount: number;
  uniqueClients: number;
  currency: string;
  periodLabel: string;
};

type IncomeMonthlyRow = {
  month: string;
  total: number;
  paymentCount: number;
  uniqueClients: number;
  currency: string;
};

type IncomeSummaryResponse = {
  ok?: boolean;
  scope?: IncomeScope;
  resetAt?: string | null;
  selectedMonth?: string;
  selectedYear?: number;
  selected?: IncomeSelectedSummary;
  annual?: IncomeSelectedSummary;
  overall?: Omit<IncomeSelectedSummary, "periodLabel">;
  monthlyRows?: IncomeMonthlyRow[];
  message?: string;
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

type PlanPrecio = {
  id: string;
  nombre: string;
  precio: number;
  moneda: string;
  duracionDias: number;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlanPreciosResponse = {
  ok?: boolean;
  planes?: PlanPrecio[];
  plan?: PlanPrecio;
  message?: string;
};

type PlanPrecioForm = {
  id: string;
  nombre: string;
  precio: string;
  moneda: string;
  duracionDias: string;
  descripcion: string;
  activo: boolean;
};

const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";

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

const EMPTY_MERCADO_PAGO_CONNECT_STATUS: MercadoPagoConnectStatusResponse = {
  ok: true,
  oauthEnabled: false,
  configured: false,
  source: "none",
  accountLabel: null,
  connected: false,
  linkedAccount: null,
};

const EMPTY_PLAN_FORM: PlanPrecioForm = {
  id: "",
  nombre: "",
  precio: "",
  moneda: "ARS",
  duracionDias: "30",
  descripcion: "",
  activo: true,
};

const INCOME_MIN_LOADING_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseResponsePayload<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function resolvePayloadMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

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

function getCurrentMonthValue(): string {
  return new Date().toISOString().slice(0, 7);
}

function getCurrentYearValue(): string {
  return String(new Date().getFullYear());
}

function formatMonthLabel(month: string): string {
  const normalized = String(month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    return normalized || "-";
  }

  const year = Number(normalized.slice(0, 4));
  const monthIndex = Number(normalized.slice(5, 7)) - 1;
  const parsed = new Date(year, monthIndex, 1);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toLocaleDateString("es-AR", {
    month: "short",
    year: "numeric",
  });
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
  if (normalized === "approved") return "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok";
  if (normalized === "rejected") return "pf-v2-b-danger pf-v2-s-danger pf-v2-t-danger";
  return "pf-v2-b-warn pf-v2-s-warn pf-v2-t-warn";
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

function IncomeLoadingIndicator({ message = "Cargando...", detail = "Buscando datos..." }: {
  message?: string;
  detail?: string;
}) {
  return <AdminRunningLoaderCard message={message} detail={detail} />;
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
  const [mpConnectStatus, setMpConnectStatus] = useState<MercadoPagoConnectStatusResponse>(
    EMPTY_MERCADO_PAGO_CONNECT_STATUS
  );
  const [mpConnectLoading, setMpConnectLoading] = useState(true);
  const [mpConnectActionLoading, setMpConnectActionLoading] = useState(false);
  const [mpConnectError, setMpConnectError] = useState("");
  const [mpConnectMessage, setMpConnectMessage] = useState("");
  const [mpTokenInput, setMpTokenInput] = useState("");
  const [mpTokenLoading, setMpTokenLoading] = useState(false);
  const [mpTokenError, setMpTokenError] = useState("");
  const [mpTokenMessage, setMpTokenMessage] = useState("");
  const [mpTokenVisible, setMpTokenVisible] = useState(false);
  const [incomeScope, setIncomeScope] = useState<IncomeScope>("monthly");
  const [incomeMonth, setIncomeMonth] = useState<string>(getCurrentMonthValue());
  const [incomeYear, setIncomeYear] = useState<string>(getCurrentYearValue());
  const [incomeSummary, setIncomeSummary] = useState<IncomeSummaryResponse | null>(null);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [incomeRefreshing, setIncomeRefreshing] = useState(false);
  const [incomeResetting, setIncomeResetting] = useState(false);
  const [incomeError, setIncomeError] = useState("");
  const [incomeMessage, setIncomeMessage] = useState("");
  const incomeRequestIdRef = useRef(0);
  const incomeHasSnapshotRef = useRef(false);
  const incomeBusy = incomeLoading || incomeRefreshing || incomeResetting;
  const [planes, setPlanes] = useState<PlanPrecio[]>([]);
  const [planesLoading, setPlanesLoading] = useState(true);
  const [planesSaving, setPlanesSaving] = useState(false);
  const [planesError, setPlanesError] = useState("");
  const [planesMessage, setPlanesMessage] = useState("");
  const [planForm, setPlanForm] = useState<PlanPrecioForm>(EMPTY_PLAN_FORM);
  const adminBusyRaw =
    loading ||
    accountLoading ||
    accountSaving ||
    Boolean(actionLoadingId) ||
    mpConnectLoading ||
    mpConnectActionLoading ||
    incomeBusy ||
    planesLoading ||
    planesSaving;
  const adminBusy = useMinimumLoading(adminBusyRaw, INCOME_MIN_LOADING_MS);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = showAll ? "?all=1" : "";
      const response = await fetch(`/api/admin/payments/manual${query}`, { cache: "no-store" });
      const data = await parseResponsePayload<ManualOrdersResponse>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo cargar el panel de pagos manuales"));
      }

      setOrders(Array.isArray(data?.orders) ? data.orders : []);
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
      const data = await parseResponsePayload<TransferAccountsResponse>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo cargar cuentas de transferencia."));
      }

      setTransferAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
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

  const loadIncomeSummary = useCallback(async () => {
    const requestId = incomeRequestIdRef.current + 1;
    incomeRequestIdRef.current = requestId;
    const requestStartedAt = Date.now();

    const shouldUseBlockingLoader = !incomeHasSnapshotRef.current;
    if (shouldUseBlockingLoader) {
      setIncomeLoading(true);
    } else {
      setIncomeRefreshing(true);
    }

    setIncomeError("");

    try {
      const params = new URLSearchParams();
      params.set("scope", incomeScope);

      if (incomeScope === "monthly") {
        params.set("month", incomeMonth || getCurrentMonthValue());
      } else {
        const normalizedYear = String(incomeYear || "").replace(/[^0-9]/g, "").slice(0, 4);
        params.set("year", normalizedYear || getCurrentYearValue());
      }

      const response = await fetch(`/api/admin/payments/income?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await parseResponsePayload<IncomeSummaryResponse>(response);

      if (!response.ok || !data?.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo cargar el resumen de ingresos."));
      }

      if (requestId !== incomeRequestIdRef.current) {
        return;
      }

      setIncomeSummary(data);
      incomeHasSnapshotRef.current = true;
    } catch (err) {
      if (requestId !== incomeRequestIdRef.current) {
        return;
      }

      if (shouldUseBlockingLoader) {
        setIncomeSummary(null);
        incomeHasSnapshotRef.current = false;
      }

      setIncomeError(err instanceof Error ? err.message : "No se pudo cargar el resumen de ingresos.");
    } finally {
      const elapsedMs = Date.now() - requestStartedAt;
      const remainingMs = INCOME_MIN_LOADING_MS - elapsedMs;
      if (remainingMs > 0) {
        await sleep(remainingMs);
      }

      if (requestId !== incomeRequestIdRef.current) {
        return;
      }

      if (shouldUseBlockingLoader) {
        setIncomeLoading(false);
      } else {
        setIncomeRefreshing(false);
      }
    }
  }, [incomeMonth, incomeScope, incomeYear]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || role !== "ADMIN") {
      return;
    }
    void loadIncomeSummary();
  }, [loadIncomeSummary, role, sessionStatus]);

  useEffect(() => {
    if (incomeScope !== "monthly") {
      return;
    }

    const normalizedMonth = String(incomeMonth || "").trim();
    if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) {
      return;
    }

    const yearFromMonth = normalizedMonth.slice(0, 4);
    if (yearFromMonth && yearFromMonth !== incomeYear) {
      setIncomeYear(yearFromMonth);
    }
  }, [incomeMonth, incomeScope, incomeYear]);

  const loadMercadoPagoConnectStatus = useCallback(async () => {
    setMpConnectLoading(true);
    setMpConnectError("");

    try {
      const response = await fetch("/api/admin/payments/mercadopago/connect", { cache: "no-store" });
      const data = await parseResponsePayload<MercadoPagoConnectStatusResponse>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo cargar estado de conexion con Mercado Pago."));
      }

      setMpConnectStatus({
        ok: true,
        oauthEnabled: Boolean(data?.oauthEnabled),
        configured: Boolean(data?.configured),
        source: String(data?.source || "none"),
        accountLabel: data?.accountLabel || null,
        connected: Boolean(data?.connected),
        linkedAccount: data?.linkedAccount || null,
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

  const pendingCount = useMemo(
    () =>
      orders.filter((order) => {
        const status = String(order.status || "").trim().toLowerCase();
        const providerStatus = String(order.providerStatus || "").trim().toLowerCase();
        return (
          status === "pending" ||
          providerStatus === "pending_admin_confirmation" ||
          (status === "in_process" && !order.reviewedAt)
        );
      }).length,
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

  const resumenMensualIngresos = useMemo<IncomeMonthlyRow[]>(
    () => (Array.isArray(incomeSummary?.monthlyRows) ? incomeSummary.monthlyRows : []),
    [incomeSummary?.monthlyRows]
  );

  const displayedIncomeRows = useMemo<IncomeMonthlyRow[]>(() => {
    if (incomeScope === "annual") {
      return resumenMensualIngresos;
    }

    const selectedMonthKey = String(incomeSummary?.selectedMonth || incomeMonth || "").trim();
    if (!selectedMonthKey) {
      return [];
    }

    return resumenMensualIngresos.filter((row) => row.month === selectedMonthKey);
  }, [incomeScope, incomeMonth, incomeSummary?.selectedMonth, resumenMensualIngresos]);

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

      const data = await parseResponsePayload<{
        ok?: boolean;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo procesar la orden"));
      }

      setMessage(resolvePayloadMessage(data, "Accion completada."));
      setNotesByOrderId((prev) => ({ ...prev, [orderId]: "" }));
      await Promise.all([loadOrders(), loadIncomeSummary()]);
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

      const data = await parseResponsePayload<{
        ok?: boolean;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo guardar la cuenta."));
      }

      setAccountMessage(resolvePayloadMessage(data, "Cuenta guardada."));
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

      const data = await parseResponsePayload<{
        ok?: boolean;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo eliminar la cuenta."));
      }

      setAccountMessage(resolvePayloadMessage(data, "Cuenta eliminada."));
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

      const data = await parseResponsePayload<{
        ok?: boolean;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo actualizar visibilidad."));
      }

      setAccountMessage(resolvePayloadMessage(data, "Visibilidad actualizada."));
      await loadTransferAccounts();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "No se pudo actualizar visibilidad.");
    } finally {
      setAccountSaving(false);
    }
  };

  const resetIncomeSummary = async () => {
    setIncomeResetting(true);
    setIncomeError("");
    setIncomeMessage("");

    try {
      const response = await fetch("/api/admin/payments/income", {
        method: "DELETE",
      });

      const data = await parseResponsePayload<IncomeSummaryResponse>(response);
      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo reiniciar ingresos."));
      }

      setIncomeMessage(resolvePayloadMessage(data, "Ingresos reiniciados."));
      await loadIncomeSummary();
    } catch (err) {
      setIncomeError(err instanceof Error ? err.message : "No se pudo reiniciar ingresos.");
    } finally {
      setIncomeResetting(false);
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

      const data = await parseResponsePayload<MercadoPagoConnectStatusResponse>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo desconectar la cuenta de Mercado Pago."));
      }

      setMpConnectMessage(resolvePayloadMessage(data, "Cuenta desconectada."));
      await loadMercadoPagoConnectStatus();
    } catch (err) {
      setMpConnectError(
        err instanceof Error ? err.message : "No se pudo desconectar la cuenta de Mercado Pago."
      );
    } finally {
      setMpConnectActionLoading(false);
    }
  };

  const saveDirectToken = async () => {
    const token = mpTokenInput.trim();
    if (!token) {
      setMpTokenError("Pegá tu Access Token de Mercado Pago antes de guardar.");
      return;
    }
    setMpTokenLoading(true);
    setMpTokenError("");
    setMpTokenMessage("");
    try {
      const response = await fetch("/api/admin/payments/mercadopago/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await parseResponsePayload<{ ok?: boolean; message?: string }>(response);
      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo guardar el token."));
      }
      setMpTokenMessage(resolvePayloadMessage(data, "Token guardado correctamente."));
      setMpTokenInput("");
      await loadMercadoPagoConnectStatus();
    } catch (err) {
      setMpTokenError(err instanceof Error ? err.message : "Error al guardar el token.");
    } finally {
      setMpTokenLoading(false);
    }
  };

  const loadPlanes = useCallback(async () => {
    setPlanesLoading(true);
    setPlanesError("");

    try {
      const response = await fetch("/api/admin/payments/plan-precios", { cache: "no-store" });
      const data = await parseResponsePayload<PlanPreciosResponse>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo cargar planes."));
      }

      setPlanes(Array.isArray(data?.planes) ? data.planes : []);
    } catch (err) {
      setPlanes([]);
      setPlanesError(err instanceof Error ? err.message : "No se pudo cargar planes.");
    } finally {
      setPlanesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || role !== "ADMIN") return;
    void loadPlanes();
  }, [loadPlanes, role, sessionStatus]);

  const savePlan = async () => {
    setPlanesSaving(true);
    setPlanesError("");
    setPlanesMessage("");

    try {
      const response = await fetch("/api/admin/payments/plan-precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: planForm.id || undefined,
          nombre: planForm.nombre,
          precio: Number(planForm.precio),
          moneda: planForm.moneda || "ARS",
          duracionDias: Number(planForm.duracionDias) || 30,
          descripcion: planForm.descripcion,
          activo: planForm.activo,
        }),
      });

      const data = await parseResponsePayload<PlanPreciosResponse>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo guardar el plan."));
      }

      setPlanesMessage(planForm.id ? "Plan actualizado." : "Plan creado.");
      setPlanForm(EMPTY_PLAN_FORM);
      await loadPlanes();
    } catch (err) {
      setPlanesError(err instanceof Error ? err.message : "No se pudo guardar el plan.");
    } finally {
      setPlanesSaving(false);
    }
  };

  const deletePlan = async (id: string) => {
    setPlanesSaving(true);
    setPlanesError("");
    setPlanesMessage("");

    try {
      const response = await fetch("/api/admin/payments/plan-precios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await parseResponsePayload<PlanPreciosResponse>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo eliminar el plan."));
      }

      setPlanesMessage("Plan eliminado.");
      if (planForm.id === id) setPlanForm(EMPTY_PLAN_FORM);
      await loadPlanes();
    } catch (err) {
      setPlanesError(err instanceof Error ? err.message : "No se pudo eliminar el plan.");
    } finally {
      setPlanesSaving(false);
    }
  };

  if (sessionStatus === "loading") {
    return (
      <main className={ADMIN_PAGE_CONTAINER}>
        <div className={`${ADMIN_CARD_SURFACE}p-6 text-center`}>
          <div className="flex justify-center">
            <AdminRunningLoaderCard
              message="Cargando..."
              detail="Abriendo modulo admin..."
            />
          </div>
        </div>
      </main>
    );
  }

  if (role !== "ADMIN") {
    return (
      <main className={ADMIN_PAGE_CONTAINER}>
        <div className="rounded-2xl border pf-v2-b-danger pf-v2-s-danger p-4 text-sm pf-v2-t-danger">
          Esta seccion es solo para administradores.
        </div>
      </main>
    );
  }

  return (
    <main className={`relative ${ADMIN_PAGE_CONTAINER_STACK}`}>
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 z-0"
        aria-hidden="true"
      />
      <AdminRunningLoaderOverlay
        active={adminBusy}
        message="Cargando..."
        detail="Sincronizando panel de pagos..."
      />

      <section className="pf-v2-card">
        <p className="text-xs font-black uppercase tracking-[0.2em] pf-v2-t-warn">Admin pagos</p>
        <h1 className="pf-v2-title">Pagos <span>mensuales</span></h1>
        <p className="pf-v2-title-sub">Vista consolidada de ingresos mensuales y confirmaciones manuales para renovar pases de alumnos.</p>
        <p className="mt-2 text-sm pf-v2-t-70">
          Vista consolidada de ingresos mensuales y confirmaciones manuales para renovar pases de alumnos.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full border pf-v2-b-warn pf-v2-s-warn px-3 py-1 font-semibold pf-v2-t-warn">
            Pendientes: {pendingCount}
          </span>

          <ReliableActionButton
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="rounded-xl border pf-v2-b-hi pf-v2-s-hi px-3 py-2 font-semibold pf-v2-t"
          >
            {showAll ? "Ver solo pendientes" : "Ver historial reciente"}
          </ReliableActionButton>

          <ReliableActionButton
            type="button"
            onClick={() => void loadOrders()}
            className="rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 font-semibold pf-v2-t"
          >
            Actualizar
          </ReliableActionButton>
        </div>
      </section>

      {message ? (
        <section className="rounded-xl border pf-v2-b-ok pf-v2-s-ok px-4 py-3 text-sm pf-v2-t-ok">
          {message}
        </section>
      ) : null}

      {error ? (
        <section className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-4 py-3 text-sm pf-v2-t-danger">
          {error}
        </section>
      ) : null}

      {accountMessage ? (
        <section className="rounded-xl border pf-v2-b-accent pf-v2-s-accent px-4 py-3 text-sm pf-v2-t-accent">
          {accountMessage}
        </section>
      ) : null}

      {accountError ? (
        <section className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-4 py-3 text-sm pf-v2-t-danger">
          {accountError}
        </section>
      ) : null}

      {mpConnectMessage ? (
        <section className="rounded-xl border pf-v2-b-ok pf-v2-s-ok px-4 py-3 text-sm pf-v2-t-ok">
          {mpConnectMessage}
        </section>
      ) : null}

      {mpConnectError ? (
        <section className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-4 py-3 text-sm pf-v2-t-danger">
          {mpConnectError}
        </section>
      ) : null}

      {incomeMessage ? (
        <section className="rounded-xl border pf-v2-b-ok pf-v2-s-ok px-4 py-3 text-sm pf-v2-t-ok">
          {incomeMessage}
        </section>
      ) : null}

      {incomeError ? (
        <section className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-4 py-3 text-sm pf-v2-t-danger">
          {incomeError}
        </section>
      ) : null}

      {planesMessage ? (
        <section className="rounded-xl border pf-v2-b-ok pf-v2-s-ok px-4 py-3 text-sm pf-v2-t-ok">
          {planesMessage}
        </section>
      ) : null}

      {planesError ? (
        <section className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-4 py-3 text-sm pf-v2-t-danger">
          {planesError}
        </section>
      ) : null}

      <section className="rounded-2xl border p-5">
        <h2 className="text-xl font-black pf-v2-t">Planes de precios</h2>
        <p className="mt-1 text-sm pf-v2-t-70">
          Define los planes disponibles con nombre, precio y duracion. Al asignar un plan, el precio se usa automaticamente en Mercado Pago.
        </p>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-xl border pf-v2-b pf-v2-s p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] pf-v2-t-70">
              {planForm.id ? "Editar plan" : "Nuevo plan"}
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs pf-v2-t-70 sm:col-span-2">
                Nombre del plan
                <input
                  value={planForm.nombre}
                  onChange={(e) => setPlanForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Plan Mensual"
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70">
                Precio
                <input
                  type="number"
                  value={planForm.precio}
                  onChange={(e) => setPlanForm((p) => ({ ...p, precio: e.target.value }))}
                  placeholder="15000"
                  min={1}
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70">
                Moneda
                <select
                  value={planForm.moneda}
                  onChange={(e) => setPlanForm((p) => ({ ...p, moneda: e.target.value }))}
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </label>

              <label className="text-xs pf-v2-t-70">
                Duracion (dias)
                <input
                  type="number"
                  value={planForm.duracionDias}
                  onChange={(e) => setPlanForm((p) => ({ ...p, duracionDias: e.target.value }))}
                  placeholder="30"
                  min={1}
                  max={365}
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70 sm:col-span-2">
                Descripcion (opcional)
                <input
                  value={planForm.descripcion}
                  onChange={(e) => setPlanForm((p) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Acceso completo por 30 dias"
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>
            </div>

            <label className="mt-3 inline-flex items-center gap-2 text-sm pf-v2-t">
              <input
                type="checkbox"
                checked={planForm.activo}
                onChange={(e) => setPlanForm((p) => ({ ...p, activo: e.target.checked }))}
                className="h-4 w-4 rounded pf-v2-b-hi pf-v2-s-deep"
              />
              Plan activo
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={() => void savePlan()}
                disabled={planesSaving || planesLoading}
                className="rounded-xl pf-v2-s-accent px-4 py-2 text-sm font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-45"
              >
                {planesSaving ? "Guardando..." : planForm.id ? "Actualizar plan" : "Crear plan"}
              </ReliableActionButton>

              {planForm.id ? (
                <ReliableActionButton
                  type="button"
                  onClick={() => setPlanForm(EMPTY_PLAN_FORM)}
                  disabled={planesSaving}
                  className="rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-2 text-sm font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Cancelar edicion
                </ReliableActionButton>
              ) : null}
            </div>
          </article>

          <article className="rounded-xl border pf-v2-b pf-v2-s p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] pf-v2-t-70">Planes cargados</h3>

            {planesLoading ? (
              <p className="mt-3 text-sm pf-v2-t-70">Cargando planes...</p>
            ) : planes.length === 0 ? (
              <p className="pf-v2-muted">Todavia no hay planes creados.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {planes.map((plan) => (
                  <div key={plan.id} className="rounded-xl border pf-v2-b pf-v2-s-deep p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold pf-v2-t">{plan.nombre}</p>
                        <p className="text-xs pf-v2-t-50">
                          {formatMoney(plan.precio, plan.moneda)} &middot; {plan.duracionDias} dias
                        </p>
                        {plan.descripcion ? (
                          <p className="mt-1 text-xs pf-v2-t-50">{plan.descripcion}</p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                          plan.activo
                            ? "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok"
                            : "pf-v2-b pf-v2-s-deep pf-v2-t"
                        }`}
                      >
                        {plan.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <ReliableActionButton
                        type="button"
                        onClick={() =>
                          setPlanForm({
                            id: plan.id,
                            nombre: plan.nombre,
                            precio: String(plan.precio),
                            moneda: plan.moneda,
                            duracionDias: String(plan.duracionDias),
                            descripcion: plan.descripcion,
                            activo: plan.activo,
                          })
                        }
                        disabled={planesSaving}
                        className="rounded-lg border pf-v2-b-accent pf-v2-s-accent px-3 py-1.5 text-xs font-semibold pf-v2-t-accent disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Editar
                      </ReliableActionButton>

                      <ReliableActionButton
                        type="button"
                        onClick={() => void deletePlan(plan.id)}
                        disabled={planesSaving}
                        className="rounded-lg border pf-v2-b-danger pf-v2-s-danger px-3 py-1.5 text-xs font-semibold pf-v2-t-danger disabled:cursor-not-allowed disabled:opacity-45"
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

      <section className="rounded-2xl border p-5">
        <h2 className="text-xl font-black pf-v2-t">Estado general de pagos</h2>
        <p className="mt-1 text-sm pf-v2-t-70">Resumen en vivo desde la ficha de clientes.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border pf-v2-b-ok pf-v2-s-ok p-4">
            <p className="text-[11px] uppercase tracking-wide pf-v2-t-ok">Pagos confirmados</p>
            <p className="mt-2 text-2xl font-black pf-v2-t-ok">{paymentSummary.pagosConfirmados}</p>
          </article>

          <article className="rounded-xl border pf-v2-b-danger pf-v2-s-danger p-4">
            <p className="text-[11px] uppercase tracking-wide pf-v2-t-danger">Pagos pendientes</p>
            <p className="mt-2 text-2xl font-black pf-v2-t-danger">{paymentSummary.pagosPendientes}</p>
          </article>

          <article className="rounded-xl border pf-v2-b-accent pf-v2-s-accent p-4">
            <p className="text-[11px] uppercase tracking-wide pf-v2-t-accent">Ingresos confirmados</p>
            <p className="mt-2 text-2xl font-black pf-v2-t-accent">{formatPeso(paymentSummary.ingresosConfirmados)}</p>
          </article>

          <article className="rounded-xl border pf-v2-b-warn pf-v2-s-warn p-4">
            <p className="text-[11px] uppercase tracking-wide pf-v2-t-warn">Saldo pendiente</p>
            <p className="mt-2 text-2xl font-black pf-v2-t-warn">{formatPeso(paymentSummary.saldoPendiente)}</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black pf-v2-t">Resumen de ingresos</h2>
            <p className="mt-1 text-sm pf-v2-t-70">
              Filtra ingresos por periodo mensual o anual. Puedes reiniciar acumulados sin borrar historiales.
            </p>
            {incomeSummary?.resetAt ? (
              <p className="mt-1 text-xs pf-v2-t-50">Base de acumulado actual: {formatDate(incomeSummary.resetAt)}</p>
            ) : (
              <p className="mt-1 text-xs pf-v2-t-50">Base de acumulado: historico completo.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <ReliableActionButton
              type="button"
              onClick={() => setIncomeScope("monthly")}
              disabled={incomeBusy}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                incomeScope === "monthly"
                  ? "pf-v2-b-accent pf-v2-s-accent pf-v2-t-accent"
                  : "pf-v2-b-hi pf-v2-s-deep pf-v2-t"
              }disabled:cursor-not-allowed disabled:opacity-45`}
            >
              Mensual
            </ReliableActionButton>

            <ReliableActionButton
              type="button"
              onClick={() => setIncomeScope("annual")}
              disabled={incomeBusy}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                incomeScope === "annual"
                  ? "pf-v2-b-accent pf-v2-s-accent pf-v2-t-accent"
                  : "pf-v2-b-hi pf-v2-s-deep pf-v2-t"
              }disabled:cursor-not-allowed disabled:opacity-45`}
            >
              Anual
            </ReliableActionButton>

            <ReliableActionButton
              type="button"
              onClick={() => void loadIncomeSummary()}
              disabled={incomeBusy}
              className="rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-45"
            >
              {incomeLoading || incomeRefreshing ? "Cargando..." : "Recargar"}
            </ReliableActionButton>

            <ReliableActionButton
              type="button"
              onClick={() => void resetIncomeSummary()}
              disabled={incomeBusy}
              className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-3 py-2 text-sm font-semibold pf-v2-t-danger disabled:cursor-not-allowed disabled:opacity-45"
            >
              {incomeResetting ? "Reiniciando..." : "Limpiar ingresos"}
            </ReliableActionButton>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {incomeScope === "monthly" ? (
            <label className="text-xs pf-v2-t-70">
              Mes a consultar
              <input
                type="month"
                value={incomeMonth}
                onChange={(event) => setIncomeMonth(event.target.value)}
                disabled={incomeBusy}
                className="mt-1 w-full min-w-[190px] rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
              />
            </label>
          ) : (
            <label className="text-xs pf-v2-t-70">
              Ano a consultar
              <input
                type="number"
                value={incomeYear}
                onChange={(event) =>
                  setIncomeYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4) || getCurrentYearValue())
                }
                disabled={incomeBusy}
                min={2000}
                max={3000}
                className="mt-1 w-full min-w-[150px] rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
              />
            </label>
          )}
        </div>

        {incomeLoading && !incomeSummary ? (
          <div className="mt-5 flex justify-center" aria-live="polite">
            <IncomeLoadingIndicator />
          </div>
        ) : incomeSummary ? (
          <div className="relative mt-4">
            {incomeRefreshing ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl pf-v2-s backdrop-blur-sm"
                aria-live="polite"
              >
                <IncomeLoadingIndicator />
              </div>
            ) : null}

            <div
              className={`transition-opacity duration-200 ${
                incomeRefreshing ? "pointer-events-none opacity-55" : "opacity-100"
              }`}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl border pf-v2-b-ok pf-v2-s-ok p-4">
                  <p className="text-[11px] uppercase tracking-wide pf-v2-t-ok">
                    Total {incomeScope === "monthly" ? "mensual" : "anual"}
                  </p>
                  <p className="mt-2 text-2xl font-black pf-v2-t-ok">
                    {formatMoney(incomeSummary?.selected?.total || 0, incomeSummary?.selected?.currency || "ARS")}
                  </p>
                  <p className="mt-1 text-xs pf-v2-t-ok">
                    Periodo: {incomeScope === "monthly"
                      ? formatMonthLabel(incomeSummary?.selected?.periodLabel || incomeMonth)
                      : incomeSummary?.selected?.periodLabel || incomeYear}
                  </p>
                </article>

                <article className="rounded-xl border pf-v2-b-accent pf-v2-s-accent p-4">
                  <p className="text-[11px] uppercase tracking-wide pf-v2-t-accent">Pagos del periodo</p>
                  <p className="mt-2 text-2xl font-black pf-v2-t-accent">{incomeSummary?.selected?.paymentCount || 0}</p>
                </article>

                <article className="rounded-xl border pf-v2-b-blue pf-v2-s-blue p-4">
                  <p className="text-[11px] uppercase tracking-wide pf-v2-t-blue">Clientes unicos</p>
                  <p className="mt-2 text-2xl font-black pf-v2-t-blue">{incomeSummary?.selected?.uniqueClients || 0}</p>
                </article>

                <article className="rounded-xl border pf-v2-b-warn pf-v2-s-warn p-4">
                  <p className="text-[11px] uppercase tracking-wide pf-v2-t-warn">Acumulado general</p>
                  <p className="mt-2 text-2xl font-black pf-v2-t-warn">
                    {formatMoney(incomeSummary?.overall?.total || 0, incomeSummary?.overall?.currency || "ARS")}
                  </p>
                </article>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border pf-v2-b">
                <table className="min-w-full text-left text-sm">
                  <thead className="pf-v2-s-deep pf-v2-t">
                    <tr>
                      <th className="px-3 py-2">Mes</th>
                      <th className="px-3 py-2">Pagos</th>
                      <th className="px-3 py-2">Clientes unicos</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedIncomeRows.length === 0 ? (
                      <tr className="border-t pf-v2-b">
                        <td colSpan={4} className="px-3 py-4 text-center pf-v2-t-50">
                          {incomeScope === "monthly"
                            ? "No hay ingresos para el mes seleccionado."
                            : "No hay ingresos para el ano seleccionado."}
                        </td>
                      </tr>
                    ) : (
                      displayedIncomeRows.map((row) => (
                        <tr key={row.month} className="border-t pf-v2-b">
                          <td className="px-3 py-2 font-semibold pf-v2-t">{formatMonthLabel(row.month)}</td>
                          <td className="px-3 py-2 pf-v2-t-70">{row.paymentCount}</td>
                          <td className="px-3 py-2 pf-v2-t-70">{row.uniqueClients}</td>
                          <td className="px-3 py-2 font-semibold pf-v2-t-ok">
                            {formatMoney(row.total, row.currency || "ARS")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm pf-v2-t-70">No hay datos de ingresos para mostrar.</p>
        )}
      </section>

      <section className="rounded-2xl border p-5">
        <h2 className="text-xl font-black pf-v2-t">Cuenta Mercado Pago conectada</h2>
        <p className="mt-1 text-sm pf-v2-t-70">
          Vincula una cuenta real por OAuth. El sistema usara esa cuenta para checkout y webhooks sin
          copiar access tokens por usuario.
        </p>

        <div className="mt-4 rounded-xl border pf-v2-b pf-v2-s p-4 text-sm pf-v2-t">
          {mpConnectLoading ? (
            <p className="pf-v2-t-70">Cargando estado de conexion...</p>
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
            className="rounded-xl pf-v2-s-accent px-4 py-2 text-sm font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-45"
          >
            {mpConnectStatus.connected ? "Reconectar cuenta MP" : "Conectar cuenta MP"}
          </ReliableActionButton>

          <ReliableActionButton
            type="button"
            onClick={() => void disconnectMercadoPagoAccount()}
            disabled={mpConnectActionLoading || mpConnectLoading || !mpConnectStatus.connected}
            className="rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-2 text-sm font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-45"
          >
            {mpConnectActionLoading ? "Procesando..." : "Desconectar"}
          </ReliableActionButton>

          <ReliableActionButton
            type="button"
            onClick={() => void loadMercadoPagoConnectStatus()}
            disabled={mpConnectActionLoading || mpConnectLoading}
            className="rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-2 text-sm font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-45"
          >
            {mpConnectLoading ? "Cargando..." : "Recargar estado"}
          </ReliableActionButton>
        </div>

        {!mpConnectStatus.oauthEnabled ? (
          <p className="mt-3 text-xs pf-v2-t-warn">
            Para habilitar la conexion OAuth, configura MERCADOPAGO_APP_CLIENT_ID y
            MERCADOPAGO_APP_CLIENT_SECRET en el entorno.
          </p>
        ) : null}

        {/* ── Configurar token directo (sin OAuth) ── */}
        <div className="mt-5 rounded-xl border pf-v2-b-accent pf-v2-s-accent p-4">
          <p className="text-sm font-bold pf-v2-t-accent">Configurar token de acceso directo</p>
          <p className="mt-1 text-xs pf-v2-t-50">
            Si no podés usar OAuth, pegá tu <strong className="pf-v2-t">Access Token de producción</strong> de Mercado Pago.
            Se guarda en la base de datos del servidor y reemplaza al token de entorno.
            Obtené el tuyo en{" "}
            <a
              href="https://www.mercadopago.com.ar/developers/panel/app"
              target="_blank"
              rel="noopener noreferrer"
              className="underline pf-v2-t-accent"
            >
              Panel de Desarrolladores MP
            </a>.
          </p>

          <div className="mt-3 flex flex-wrap items-start gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type={mpTokenVisible ? "text" : "password"}
                value={mpTokenInput}
                onChange={(e) => { setMpTokenInput(e.target.value); setMpTokenError(""); setMpTokenMessage(""); }}
                placeholder="APP_USR-..."
                autoComplete="off"
                className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2.5 pr-10 text-sm pf-v2-t outline-none"
              />
              <button
                type="button"
                onClick={() => setMpTokenVisible((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pf-v2-t-50"
                aria-label={mpTokenVisible ? "Ocultar token" : "Mostrar token"}
              >
                {mpTokenVisible ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <ReliableActionButton
              type="button"
              disabled={mpTokenLoading || !mpTokenInput.trim()}
              onClick={() => void saveDirectToken()}
              className="rounded-xl pf-v2-s-accent-full px-4 py-2.5 text-sm font-bold pf-v2-t transition pf-v2-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {mpTokenLoading ? "Guardando..." : "Guardar token"}
            </ReliableActionButton>
          </div>

          {mpTokenError ? (
            <p className="mt-2 text-xs pf-v2-t-danger">{mpTokenError}</p>
          ) : null}
          {mpTokenMessage ? (
            <p className="mt-2 text-xs pf-v2-t-ok">✓ {mpTokenMessage}</p>
          ) : null}
        </div>
      </section>



      <section className="rounded-2xl border p-5">
        <h2 className="text-xl font-black pf-v2-t">Cuentas destino para transferencia</h2>
        <p className="mt-1 text-sm pf-v2-t-70">
          Carga aca las cuentas bancarias/corrientes que se mostraran a los alumnos al informar pagos por transferencia.
        </p>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-xl border pf-v2-b pf-v2-s p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] pf-v2-t-70">
              {accountForm.id ? "Editar cuenta" : "Nueva cuenta"}
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs pf-v2-t-70">
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
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70">
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
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70">
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
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70">
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
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70">
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
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70">
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
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70">
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
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70 sm:col-span-2">
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
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>

              <label className="text-xs pf-v2-t-70 sm:col-span-2">
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
                  className="mt-1 w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                />
              </label>
            </div>

            <label className="mt-3 inline-flex items-center gap-2 text-sm pf-v2-t">
              <input
                type="checkbox"
                checked={accountForm.isVisible}
                onChange={(event) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    isVisible: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded pf-v2-b-hi pf-v2-s-deep"
              />
              Visible para alumnos
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={() => void saveTransferAccount()}
                disabled={accountSaving}
                className="rounded-xl pf-v2-s-accent px-4 py-2 text-sm font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-45"
              >
                {accountSaving ? "Guardando..." : accountForm.id ? "Actualizar cuenta" : "Guardar cuenta"}
              </ReliableActionButton>

              <ReliableActionButton
                type="button"
                onClick={resetTransferAccountForm}
                disabled={accountSaving}
                className="rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-2 text-sm font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-45"
              >
                Limpiar
              </ReliableActionButton>
            </div>
          </article>

          <article className="rounded-xl border pf-v2-b pf-v2-s p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] pf-v2-t-70">
              Cuentas cargadas
            </h3>

            {accountLoading ? (
              <p className="mt-3 text-sm pf-v2-t-70">Cargando cuentas...</p>
            ) : transferAccounts.length === 0 ? (
              <p className="pf-v2-muted">Todavia no hay cuentas de transferencia cargadas.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {transferAccounts.map((account) => (
                  <div key={account.id} className="rounded-xl border pf-v2-b pf-v2-s-deep p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold pf-v2-t">{account.label}</p>
                        <p className="text-xs pf-v2-t-50">
                          {account.bankName || "Banco no definido"}
                          {account.accountType ? ` · ${account.accountType}` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                          account.isVisible
                            ? "pf-v2-b-ok pf-v2-s-ok pf-v2-t-ok"
                            : "pf-v2-b pf-v2-s-deep pf-v2-t"
                        }`}
                      >
                        {account.isVisible ? "Visible" : "Oculta"}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs pf-v2-t-70">
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
                        className="rounded-lg border pf-v2-b-accent pf-v2-s-accent px-3 py-1.5 text-xs font-semibold pf-v2-t-accent disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Editar
                      </ReliableActionButton>

                      <ReliableActionButton
                        type="button"
                        onClick={() => void toggleTransferAccountVisibility(account)}
                        disabled={accountSaving}
                        className="rounded-lg border pf-v2-b-hi pf-v2-s-deep px-3 py-1.5 text-xs font-semibold pf-v2-t disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {account.isVisible ? "Ocultar" : "Mostrar"}
                      </ReliableActionButton>

                      <ReliableActionButton
                        type="button"
                        onClick={() => void removeTransferAccount(account.id)}
                        disabled={accountSaving}
                        className="rounded-lg border pf-v2-b-danger pf-v2-s-danger px-3 py-1.5 text-xs font-semibold pf-v2-t-danger disabled:cursor-not-allowed disabled:opacity-45"
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
          <h2 className="text-xl font-black pf-v2-t">Confirmaciones manuales</h2>
          <p className="mt-1 text-sm pf-v2-t-70">
            Aprobacion o rechazo de pagos informados por transferencia, efectivo o QR de Mercado Pago.
          </p>
        </div>

        {loading ? (
          <p className="text-sm pf-v2-t-70">Cargando pagos manuales...</p>
        ) : orders.length === 0 ? (
          <p className="rounded-2xl border p-4 text-sm pf-v2-t-70">
            No hay solicitudes manuales para mostrar.
          </p>
        ) : (
          orders.map((order) => {
            const orderNote = notesByOrderId[order.id] ?? "";
            const status = String(order.status || "").trim().toLowerCase();
            const providerStatus = String(order.providerStatus || "").trim().toLowerCase();
            const pending =
              status === "pending" ||
              providerStatus === "pending_admin_confirmation" ||
              (status === "in_process" && !order.reviewedAt);

            return (
              <article key={order.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black pf-v2-t">{order.email}</p>
                    <p className="text-xs pf-v2-t-50">Orden: {order.id}</p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold${resolveStatusTone(order.status)}`}
                  >
                    {String(order.status || "pending").toUpperCase()}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border pf-v2-b pf-v2-s p-3">
                    <p className="text-[11px] uppercase tracking-wide pf-v2-t-50">Metodo</p>
                    <p className="mt-1 font-semibold pf-v2-t">{resolveMethodLabel(order.paymentMethod)}</p>
                  </div>

                  <div className="rounded-xl border pf-v2-b pf-v2-s p-3">
                    <p className="text-[11px] uppercase tracking-wide pf-v2-t-50">Importe</p>
                    <p className="mt-1 font-semibold pf-v2-t">{formatMoney(order.amount, order.currency)}</p>
                  </div>

                  <div className="rounded-xl border pf-v2-b pf-v2-s p-3">
                    <p className="text-[11px] uppercase tracking-wide pf-v2-t-50">Periodo</p>
                    <p className="mt-1 font-semibold pf-v2-t">{order.periodDays} dias</p>
                  </div>

                  <div className="rounded-xl border pf-v2-b pf-v2-s p-3">
                    <p className="text-[11px] uppercase tracking-wide pf-v2-t-50">Creado</p>
                    <p className="mt-1 font-semibold pf-v2-t">{formatDate(order.createdAt)}</p>
                  </div>
                </div>

                {order.adminNote ? (
                  <p className="mt-3 text-sm pf-v2-t-70">Nota alumno/admin previa: {order.adminNote}</p>
                ) : null}

                {order.receiptNumber || order.receiptIssuedAt ? (
                  <p className="mt-2 text-xs pf-v2-t-accent">
                    Comprobante: {order.receiptNumber || "-"}
                    {order.receiptIssuedAt ? ` · Emitido: ${formatDate(order.receiptIssuedAt)}` : ""}
                  </p>
                ) : null}

                {order.receiptFileUrl ? (
                  <div className="mt-3 rounded-xl border pf-v2-b-ok pf-v2-s-ok p-3">
                    <p className="text-[11px] uppercase tracking-wide pf-v2-t-ok">
                      Comprobante adjunto del alumno
                    </p>
                    {order.receiptFileUrl.startsWith("data:application/pdf") ? (
                      <a
                        href={order.receiptFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-sm font-semibold pf-v2-t-ok underline decoration-emerald-400/40 underline-offset-2"
                      >
                        Ver comprobante (PDF)
                        {order.receiptFileName ? (
                          <span className="text-xs font-normal pf-v2-t-50">
                            · {order.receiptFileName}
                          </span>
                        ) : null}
                      </a>
                    ) : (
                      <a
                        href={order.receiptFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={order.receiptFileUrl}
                          alt={`Comprobante de pago de ${order.email}`}
                          className="max-h-56 w-auto rounded-lg border pf-v2-b object-contain"
                        />
                        <span className="mt-1 block text-xs pf-v2-t-ok underline decoration-emerald-400/40 underline-offset-2">
                          Abrir en tamano completo
                        </span>
                      </a>
                    )}
                  </div>
                ) : null}

                {!pending ? (
                  <p className="mt-2 text-xs pf-v2-t-50">
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
                      className="w-full rounded-xl border pf-v2-b-hi pf-v2-s-deep px-3 py-2 text-sm pf-v2-t outline-none"
                    />

                    <div className="flex flex-wrap gap-3">
                      <ReliableActionButton
                        type="button"
                        onClick={() => void handleDecision(order.id, "approve")}
                        disabled={actionLoadingId === order.id}
                        className="pf-v2-btn"
                      >
                        {actionLoadingId === order.id ? "Procesando..." : "Aprobar y renovar pase"}
                      </ReliableActionButton>

                      <ReliableActionButton
                        type="button"
                        onClick={() => void handleDecision(order.id, "reject")}
                        disabled={actionLoadingId === order.id}
                        className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-4 py-2 text-sm font-semibold pf-v2-t-danger disabled:cursor-not-allowed disabled:opacity-40"
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
