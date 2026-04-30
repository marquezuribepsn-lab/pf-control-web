"use client";

import AdminRunningLoaderOverlay, {
  AdminRunningLoaderCard,
} from "@/components/admin/AdminRunningLoader";
import {
  ADMIN_PAGE_CONTAINER,
  ADMIN_PAGE_CONTAINER_STACK,
} from "@/components/admin/layoutTokens";
import { useMinimumLoading } from "@/components/admin/useMinimumLoading";
import ReliableActionButton from "@/components/ReliableActionButton";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import WhatsAppMessageEditor from "@/components/whatsapp/WhatsAppMessageEditor";
import {
  getDefaultWhatsAppConfig,
  listConfigSubcategories,
  WHATSAPP_CATEGORY_ORDER,
  type WhatsAppConfig,
  type WhatsAppSubcategoryConfig,
} from "@/lib/whatsappConfig";

type TabId =
  | "cobranzas"
  | "asistencia_rutinas"
  | "recordatorios_otros"
  | "envio_manual"
  | "historial"
  | "configuracion";

type Recipient = {
  id: string;
  label: string;
  tipo: "alumno" | "colaborador";
  estado?: string;
  telefono: string;
  actividad?: string;
  daysToDue?: number | null;
  paymentStatus?: string;
  planStatus?: string;
  hasPendingPlanUpdate?: boolean;
  variables: Record<string, string>;
};

type MissingPhoneRow = {
  id: string;
  label: string;
  tipo: "alumno";
  ownerKey?: string;
  estado?: string;
  rawPhone: string;
  reason: "missing_phone" | "invalid_phone";
};

type HistoryRecipientResult = {
  id?: string;
  label?: string;
  phone?: string | null;
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  providerMessageId?: string | null;
  renderedMessage?: string;
};

type HistoryRow = {
  id?: string;
  createdAt?: string;
  tipo?: string;
  subcategoria?: string;
  categoryKey?: string;
  subcategoryKey?: string;
  triggeredBy?: string;
  triggeredByUserId?: string;
  triggeredByUserEmail?: string;
  triggeredByUserName?: string;
  runId?: string;
  mensaje?: string;
  total?: number;
  ok?: number;
  failed?: number;
  skipped?: number;
  mode?: string;
  results?: HistoryRecipientResult[];
  rules?: Array<{
    categoryKey?: string;
    ruleKey?: string;
    matched?: number;
    ok?: number;
    failed?: number;
    retried?: number;
  }>;
};

type RunRow = {
  key: string;
  runId: string;
  updatedAt?: string;
  dryRun?: boolean;
  categoryKey?: string;
  ruleKey?: string;
  ok?: boolean;
  sent?: number;
  failed?: number;
  retryCount?: number;
  rulesExecuted?: number;
  summary?: Record<string, unknown>;
};

type RunnerState = {
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastRunId?: string;
  lastError?: string | null;
  consecutiveFailures?: number;
  nextRunAt?: string | null;
};

type RunnerAlertRow = {
  id?: string;
  createdAt?: string;
  type?: string;
  runId?: string;
  categoryKey?: string;
  ruleKey?: string;
  sent?: number;
  failed?: number;
  retryCount?: number;
  totalMissing?: number;
  previewNames?: string;
  emailAlertSent?: boolean;
  whatsappAlertSent?: boolean;
  alertError?: string | null;
};

type WebSessionStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "connected"
  | "auth_failure"
  | "error";

type WhatsAppWebSession = {
  status: WebSessionStatus;
  connected: boolean;
  phone: string | null;
  pushname: string | null;
  qr: string | null;
  qrImageDataUrl: string | null;
  lastError: string | null;
  lastEventAt: string | null;
};

type SimMatch = {
  id: string;
  nombre: string;
  telefono: string;
  reason: string;
  message: string;
  categoria: string;
  ruleKey: string;
};

type SimResult = {
  totalMatched: number;
  rulesEvaluated: number;
  matches: SimMatch[];
};

type HistoryFilters = {
  from: string;
  to: string;
  status: "all" | "ok" | "partial" | "failed";
  type: string;
  user: string;
  rule: string;
};

const TAB_ITEMS: Array<{ id: TabId; label: string }> = [
  { id: "cobranzas", label: "Cobranzas" },
  { id: "asistencia_rutinas", label: "Asistencia y Rutinas" },
  { id: "recordatorios_otros", label: "Recordatorios y Otros" },
  { id: "envio_manual", label: "Envio Manual" },
  { id: "historial", label: "Historial" },
  { id: "configuracion", label: "Configuracion" },
];

const ADMIN_MIN_LOADING_MS = 2000;

type LoadIssue = {
  block: string;
  message: string;
};

type FetchBlockResult<T> = {
  ok: boolean;
  status: number | null;
  data: T | null;
  message: string;
};

function cloneConfig(config: WhatsAppConfig) {
  return JSON.parse(JSON.stringify(config)) as WhatsAppConfig;
}

function resolvePayloadMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const typed = payload as { message?: unknown; error?: unknown };
    const candidate = typeof typed.error === "string" ? typed.error : typed.message;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallback;
}

async function parseResponsePayload<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchJsonBlock<T>(url: string): Promise<FetchBlockResult<T>> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const data = await parseResponsePayload<T>(response);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        message: resolvePayloadMessage(data, `Error HTTP ${response.status} en ${url}`),
      };
    }

    return { ok: true, status: response.status, data, message: "" };
  } catch (error) {
    return {
      ok: false,
      status: null,
      data: null,
      message: error instanceof Error ? error.message : `No se pudo consultar ${url}`,
    };
  }
}

function formatDateTime(value: string | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-AR");
}

function getHistoryStatus(row: HistoryRow): "ok" | "partial" | "failed" {
  const total = Number(row.total || (Array.isArray(row.results) ? row.results.length : 0));
  const ok = Number(row.ok || 0);
  const failed = Number(row.failed || 0);

  if (total === 0) return "ok";
  if (failed <= 0) return "ok";
  if (ok <= 0) return "failed";
  return "partial";
}

function getRowUserLabel(row: HistoryRow) {
  return (
    row.triggeredByUserEmail ||
    row.triggeredByUserName ||
    row.triggeredBy ||
    "-"
  );
}

function getRule(config: WhatsAppConfig, categoryKey: string, subKey: string): WhatsAppSubcategoryConfig | null {
  const category = config.categories[categoryKey];
  if (!category) return null;
  return category.subcategories[subKey] || null;
}

function getWebSessionStatusLabel(status: WebSessionStatus | undefined) {
  switch (status) {
    case "connected":
      return "Conectada";
    case "qr_ready":
      return "QR listo";
    case "connecting":
      return "Conectando";
    case "auth_failure":
      return "Error de auth";
    case "error":
      return "Error";
    case "disconnected":
    default:
      return "Desconectada";
  }
}

function getWebSessionStatusTone(status: WebSessionStatus | undefined) {
  switch (status) {
    case "connected":
      return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
    case "qr_ready":
      return "border-cyan-300/30 bg-cyan-500/15 text-cyan-100";
    case "connecting":
      return "border-amber-300/30 bg-amber-500/15 text-amber-100";
    case "auth_failure":
    case "error":
      return "border-rose-300/40 bg-rose-500/15 text-rose-100";
    case "disconnected":
    default:
      return "border-slate-300/20 bg-slate-500/10 text-slate-200";
  }
}

export default function AdminWhatsAppPage() {
  const { data: session, status: sessionStatus } = useSession();

  const [activeTab, setActiveTab] = useState<TabId>("cobranzas");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loadIssues, setLoadIssues] = useState<LoadIssue[]>([]);

  const [config, setConfig] = useState<WhatsAppConfig>(getDefaultWhatsAppConfig());
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [missingPhoneRows, setMissingPhoneRows] = useState<MissingPhoneRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runnerState, setRunnerState] = useState<RunnerState>({});
  const [runnerAlerts, setRunnerAlerts] = useState<RunnerAlertRow[]>([]);
  const [webSession, setWebSession] = useState<WhatsAppWebSession | null>(null);
  const [webSessionLoading, setWebSessionLoading] = useState(false);
  const [webSessionBusy, setWebSessionBusy] = useState(false);

  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    from: "",
    to: "",
    status: "all",
    type: "all",
    user: "",
    rule: "all",
  });

  const [testRecipientId, setTestRecipientId] = useState("");
  const [simByRule, setSimByRule] = useState<Record<string, SimResult>>({});
  const [expandedHistoryRowId, setExpandedHistoryRowId] = useState("");

  const [manualRecipientIds, setManualRecipientIds] = useState<string[]>([]);
  const [manualCategoryKey, setManualCategoryKey] = useState("cobranzas");
  const [manualSubcategoryKey, setManualSubcategoryKey] = useState("aviso_anticipado");
  const [manualMessage, setManualMessage] = useState("");
  const [manualRecipientSearch, setManualRecipientSearch] = useState("");
  const [manualRecipientTypeFilter, setManualRecipientTypeFilter] = useState<"all" | "alumno" | "colaborador">("all");

  const role = String((session?.user as { role?: string } | undefined)?.role || "")
    .trim()
    .toUpperCase();
  const adminBusyRaw = loading || saving || actionLoading || webSessionBusy;
  const adminBusy = useMinimumLoading(adminBusyRaw, ADMIN_MIN_LOADING_MS);
  const webSessionPollDelayMsRef = useRef(4000);

  const recipientById = useMemo(
    () => new Map(recipients.map((recipient) => [recipient.id, recipient])),
    [recipients]
  );

  const selectedManualRecipients = useMemo(
    () => manualRecipientIds.map((id) => recipientById.get(id)).filter(Boolean) as Recipient[],
    [manualRecipientIds, recipientById]
  );

  const filteredManualRecipients = useMemo(() => {
    const search = manualRecipientSearch.trim().toLowerCase();

    return recipients.filter((recipient) => {
      if (manualRecipientTypeFilter !== "all" && recipient.tipo !== manualRecipientTypeFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        recipient.label,
        recipient.telefono,
        recipient.tipo,
        recipient.actividad,
        recipient.paymentStatus,
        recipient.planStatus,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(search);
    });
  }, [recipients, manualRecipientSearch, manualRecipientTypeFilter]);

  const visibleManualRecipientIds = useMemo(
    () => filteredManualRecipients.map((recipient) => recipient.id),
    [filteredManualRecipients]
  );

  const allVisibleManualSelected = useMemo(() => {
    if (visibleManualRecipientIds.length === 0) {
      return false;
    }
    return visibleManualRecipientIds.every((id) => manualRecipientIds.includes(id));
  }, [visibleManualRecipientIds, manualRecipientIds]);

  const testRecipient = testRecipientId ? recipientById.get(testRecipientId) || null : null;

  const previewVariables =
    testRecipient?.variables ||
    selectedManualRecipients[0]?.variables || {
      nombre: "Nombre",
      actividad: "entrenamiento",
      dias: "1",
      vencimiento: "2026-04-10",
      total: "25000",
    };

  const subcategoryOptions = useMemo(() => listConfigSubcategories(config), [config]);

  const historyTypeOptions = useMemo(() => {
    const uniq = Array.from(
      new Set(history.map((row) => String(row.tipo || "").trim()).filter(Boolean))
    );
    return uniq;
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter((row) => {
      const created = row.createdAt ? new Date(row.createdAt) : null;

      if (historyFilters.from) {
        const fromDate = new Date(`${historyFilters.from}T00:00:00`);
        if (!created || created.getTime() < fromDate.getTime()) return false;
      }

      if (historyFilters.to) {
        const toDate = new Date(`${historyFilters.to}T23:59:59.999`);
        if (!created || created.getTime() > toDate.getTime()) return false;
      }

      if (historyFilters.status !== "all" && getHistoryStatus(row) !== historyFilters.status) {
        return false;
      }

      if (historyFilters.type !== "all" && String(row.tipo || "") !== historyFilters.type) {
        return false;
      }

      if (historyFilters.rule !== "all") {
        const rowRule = String(row.subcategoryKey || row.subcategoria || "");
        if (rowRule !== historyFilters.rule) {
          return false;
        }
      }

      if (historyFilters.user.trim()) {
        const haystack = [
          row.triggeredBy,
          row.triggeredByUserId,
          row.triggeredByUserEmail,
          row.triggeredByUserName,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        if (!haystack.includes(historyFilters.user.trim().toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [history, historyFilters]);

  const detailByRuleRows = useMemo(() => {
    const map = new Map<
      string,
      { key: string; categoryKey: string; ruleKey: string; total: number; ok: number; failed: number; retried: number; lastRunAt: string }
    >();

    for (const row of filteredHistory) {
      const rowRules = Array.isArray(row.rules) ? row.rules : [];
      for (const rule of rowRules) {
        const categoryKey = String(rule.categoryKey || row.categoryKey || "-");
        const ruleKey = String(rule.ruleKey || row.subcategoryKey || row.subcategoria || "-");
        const key = `${categoryKey}:${ruleKey}`;
        const current = map.get(key) || {
          key,
          categoryKey,
          ruleKey,
          total: 0,
          ok: 0,
          failed: 0,
          retried: 0,
          lastRunAt: "",
        };

        current.total += Number(rule.matched || 0);
        current.ok += Number(rule.ok || 0);
        current.failed += Number(rule.failed || 0);
        current.retried += Number(rule.retried || 0);

        const createdAt = String(row.createdAt || "");
        if (!current.lastRunAt || createdAt > current.lastRunAt) {
          current.lastRunAt = createdAt;
        }

        map.set(key, current);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.lastRunAt.localeCompare(a.lastRunAt));
  }, [filteredHistory]);

  const manualSubcategories = useMemo(() => {
    return subcategoryOptions.filter((row) => row.categoryKey === manualCategoryKey);
  }, [manualCategoryKey, subcategoryOptions]);

  const manualRequiredVariables = useMemo(() => {
    const rule = getRule(config, manualCategoryKey, manualSubcategoryKey);
    return Array.isArray(rule?.variables) ? rule.variables : [];
  }, [config, manualCategoryKey, manualSubcategoryKey]);

  useEffect(() => {
    const firstSub = manualSubcategories[0]?.subcategoryKey || "";
    if (!firstSub) {
      setManualSubcategoryKey("");
      setManualMessage("");
      return;
    }

    if (!manualSubcategories.some((item) => item.subcategoryKey === manualSubcategoryKey)) {
      setManualSubcategoryKey(firstSub);
    }
  }, [manualCategoryKey, manualSubcategories, manualSubcategoryKey]);

  useEffect(() => {
    const selectedRule = getRule(config, manualCategoryKey, manualSubcategoryKey);
    if (selectedRule) {
      setManualMessage(selectedRule.message || "");
    }
  }, [config, manualCategoryKey, manualSubcategoryKey]);

  const resetFeedback = (clearIssues = false) => {
    setStatus("");
    setError("");
    if (clearIssues) {
      setLoadIssues([]);
    }
  };

  const loadWhatsAppWebSession = async (
    includeQr = true,
    options?: { silent?: boolean }
  ): Promise<boolean> => {
    const silent = options?.silent === true;

    try {
      if (!silent) {
        setWebSessionLoading(true);
      }

      const response = await fetch(
        `/api/admin/whatsapp-web/session?includeQr=${includeQr ? "1" : "0"}`,
        { cache: "no-store" }
      );
      const data = await parseResponsePayload<{
        session?: WhatsAppWebSession | null;
        message?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo cargar sesion de WhatsApp Web"));
      }

      setWebSession((data?.session || null) as WhatsAppWebSession | null);
      return true;
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "No se pudo cargar sesion de WhatsApp Web");
      }
      return false;
    } finally {
      if (!silent) {
        setWebSessionLoading(false);
      }
    }
  };

  const loadAll = async () => {
    setLoading(true);
    resetFeedback(true);

    try {
      const [configBlock, recipientsBlock, historyBlock, runsBlock] = await Promise.all([
        fetchJsonBlock<{ config?: WhatsAppConfig; message?: string; error?: string }>(
          "/api/whatsapp/config"
        ),
        fetchJsonBlock<{
          recipients?: Recipient[];
          missingPhones?: MissingPhoneRow[];
          message?: string;
          error?: string;
        }>("/api/whatsapp/recipients"),
        fetchJsonBlock<{ history?: HistoryRow[]; message?: string; error?: string }>(
          "/api/admin/whatsapp-history"
        ),
        fetchJsonBlock<{
          runs?: RunRow[];
          runnerState?: RunnerState;
          alerts?: RunnerAlertRow[];
          message?: string;
          error?: string;
        }>("/api/admin/whatsapp-automation-runs"),
      ]);

      const nextIssues: LoadIssue[] = [];

      let nextConfig = config;
      if (configBlock.ok && configBlock.data?.config) {
        nextConfig = configBlock.data.config;
        setConfig(nextConfig);
      } else {
        nextIssues.push({
          block: "Configuracion",
          message: configBlock.message || "No se pudo cargar configuracion",
        });
      }

      let nextRecipients: Recipient[] = [];
      if (recipientsBlock.ok) {
        nextRecipients = Array.isArray(recipientsBlock.data?.recipients)
          ? recipientsBlock.data.recipients
          : [];
        setRecipients(nextRecipients);
        setMissingPhoneRows(
          Array.isArray(recipientsBlock.data?.missingPhones)
            ? recipientsBlock.data.missingPhones
            : []
        );
      } else {
        nextIssues.push({
          block: "Destinatarios",
          message: recipientsBlock.message || "No se pudo cargar destinatarios",
        });
      }

      if (historyBlock.ok) {
        const nextHistory = Array.isArray(historyBlock.data?.history) ? historyBlock.data.history : [];
        setHistory(nextHistory);
      } else {
        nextIssues.push({
          block: "Historial",
          message: historyBlock.message || "No se pudo cargar historial",
        });
      }

      if (runsBlock.ok) {
        const nextRuns = Array.isArray(runsBlock.data?.runs) ? runsBlock.data.runs : [];
        setRuns(nextRuns);
        setRunnerState(
          runsBlock.data?.runnerState && typeof runsBlock.data.runnerState === "object"
            ? runsBlock.data.runnerState
            : {}
        );
        setRunnerAlerts(Array.isArray(runsBlock.data?.alerts) ? runsBlock.data.alerts : []);
      } else {
        nextIssues.push({
          block: "Runner",
          message: runsBlock.message || "No se pudo cargar el estado del runner",
        });
      }

      if (!testRecipientId && nextRecipients.length > 0) {
        setTestRecipientId(nextRecipients[0].id);
      }

      if (nextIssues.length > 0) {
        setLoadIssues(nextIssues);

        if (nextIssues.length === 4) {
          setError("No se pudo cargar ningun bloque del panel de WhatsApp.");
        } else {
          setStatus(`Panel cargado con advertencias (${nextIssues.length} bloque/s con error).`);
        }
      }

      if (nextConfig?.connection?.provider === "whatsapp_web") {
        await loadWhatsAppWebSession(true, { silent: nextIssues.length > 0 });
      } else {
        setWebSession(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar panel de WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void loadAll();
    }
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if (config.connection.provider !== "whatsapp_web") return;

    let cancelled = false;
    let timeoutId = 0;

    const scheduleNextPoll = (delayMs: number) => {
      if (cancelled) return;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        void runPoll();
      }, delayMs);
    };

    const runPoll = async () => {
      if (cancelled) return;

      const isVisible = document.visibilityState === "visible";
      const ok = await loadWhatsAppWebSession(isVisible, { silent: true });
      if (cancelled) return;

      if (ok) {
        webSessionPollDelayMsRef.current = 4000;
      } else {
        webSessionPollDelayMsRef.current = Math.min(
          30000,
          Math.max(6000, webSessionPollDelayMsRef.current * 2)
        );
      }

      const nextDelay = isVisible
        ? webSessionPollDelayMsRef.current
        : Math.max(15000, webSessionPollDelayMsRef.current);
      scheduleNextPoll(nextDelay);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        webSessionPollDelayMsRef.current = 4000;
        scheduleNextPoll(250);
      }
    };

    scheduleNextPoll(0);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [sessionStatus, config.connection.provider]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if (config.connection.provider !== "whatsapp_web") return;
    if (webSession || webSessionLoading) return;
    void loadWhatsAppWebSession(true);
  }, [sessionStatus, config.connection.provider, webSession, webSessionLoading]);

  const saveConfig = async () => {
    resetFeedback();
    try {
      setSaving(true);
      const response = await fetch("/api/whatsapp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await parseResponsePayload<{
        config?: WhatsAppConfig;
        validationWarnings?: string[];
        message?: string;
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo guardar configuracion"));
      }

      setConfig(data?.config || config);
      const validationWarnings = Array.isArray(data?.validationWarnings)
        ? data.validationWarnings
        : [];

      if (validationWarnings.length > 0) {
        setStatus(`Configuracion guardada con validacion automatica (${validationWarnings.length} aviso/s de variables).`);
      } else {
        setStatus("Configuracion guardada.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar configuracion");
    } finally {
      setSaving(false);
    }
  };

  const updateCategoryEnabled = (categoryKey: string, enabled: boolean) => {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      if (!next.categories[categoryKey]) return prev;
      next.categories[categoryKey].enabled = enabled;
      return next;
    });
  };

  const updateRule = (
    categoryKey: string,
    subcategoryKey: string,
    patch: Partial<WhatsAppSubcategoryConfig>
  ) => {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      const category = next.categories[categoryKey];
      if (!category) return prev;
      const sub = category.subcategories[subcategoryKey];
      if (!sub) return prev;
      category.subcategories[subcategoryKey] = {
        ...sub,
        ...patch,
      };
      return next;
    });
  };

  const resetRuleMessage = (categoryKey: string, subcategoryKey: string) => {
    const defaults = getDefaultWhatsAppConfig();
    const defaultRule = defaults.categories[categoryKey]?.subcategories[subcategoryKey];
    if (!defaultRule) return;

    updateRule(categoryKey, subcategoryKey, { message: defaultRule.message });
    setStatus(`Mensaje por defecto restaurado en ${subcategoryKey}.`);
  };

  const toggleManualRecipient = (recipientId: string) => {
    setManualRecipientIds((prev) =>
      prev.includes(recipientId)
        ? prev.filter((id) => id !== recipientId)
        : [...prev, recipientId]
    );
  };

  const toggleSelectAllVisibleManualRecipients = () => {
    setManualRecipientIds((prev) => {
      const visibleSet = new Set(visibleManualRecipientIds);

      if (allVisibleManualSelected) {
        return prev.filter((id) => !visibleSet.has(id));
      }

      const next = new Set(prev);
      for (const id of visibleManualRecipientIds) {
        next.add(id);
      }
      return Array.from(next);
    });
  };

  const clearManualSelection = () => {
    setManualRecipientIds([]);
  };

  const autoSelectManualRecipientsByRule = async () => {
    resetFeedback();

    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/automation/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryKey: manualCategoryKey,
          ruleKey: manualSubcategoryKey,
          limit: 500,
          forceWindow: true,
        }),
      });

      const data = await parseResponsePayload<{
        matches?: Array<{ id?: string }>;
        message?: string;
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo auto-seleccionar destinatarios"));
      }

      const matches = Array.isArray(data?.matches) ? data.matches : [];
      const candidateIds = matches
        .map((row: any) => String(row?.id || "").trim())
        .filter(Boolean)
        .filter((id: string) => recipientById.has(id));

      setManualRecipientIds(Array.from(new Set(candidateIds)));
      setStatus(`Auto-seleccion completada: ${candidateIds.length} alumno(s) segun la ficha y la regla.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en auto-seleccion de destinatarios");
    } finally {
      setActionLoading(false);
    }
  };

  const summarizeDispatch = (data: any) => {
    const results = Array.isArray(data?.results) ? data.results : [];
    const total = Number(data?.total ?? results.length);
    const okCount = Number(
      data?.okCount ?? results.filter((row: any) => row?.ok === true && row?.skipped !== true).length
    );
    const failedCount = Number(
      data?.failedCount ?? results.filter((row: any) => row?.ok !== true && row?.skipped !== true).length
    );
    const firstFailureReason =
      String(data?.firstFailureReason || "").trim() ||
      String(results.find((row: any) => row?.ok !== true)?.reason || "").trim() ||
      String(data?.error || "").trim() ||
      "sin_detalle";

    return {
      total,
      okCount,
      failedCount,
      firstFailureReason,
    };
  };

  const summarizeRun = (data: any) => {
    const summary = data?.summary && typeof data.summary === "object" ? data.summary : {};
    return {
      sent: Number((summary as any).sent || 0),
      failed: Number((summary as any).failed || 0),
      skipped: Number((summary as any).skipped || 0),
      totalMatched: Number((summary as any).totalMatched || 0),
      error: String((summary as any).error || data?.error || "").trim(),
    };
  };

  const formatDispatchReason = (rawReason: string) => {
    const reason = String(rawReason || "").trim();
    if (!reason) {
      return "sin_detalle";
    }

    if (reason === "recipient_is_sender_number") {
      return "No se puede enviar al mismo numero emisor de la API de WhatsApp. Usa un numero destinatario distinto.";
    }

    if (reason === "invalid_phone") {
      return "El numero de destino no es valido para WhatsApp.";
    }

    if (reason.includes("(#100) Invalid parameter")) {
      return "Meta rechazo el destino. Si estas probando con el mismo numero emisor, no se puede autoenviar.";
    }

    return reason;
  };

  const sendManual = async (mode: "test" | "prod", singleRecipientOnly = false) => {
    resetFeedback();

    const recipientsToSend = singleRecipientOnly
      ? selectedManualRecipients.slice(0, 1)
      : selectedManualRecipients;

    if (recipientsToSend.length === 0) {
      setError("Selecciona al menos un destinatario para envio manual.");
      return;
    }

    if (!manualMessage.trim()) {
      setError("El mensaje manual no puede estar vacio.");
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatarios: recipientsToSend,
          mensaje: manualMessage,
          tipo: "Manual",
          subcategoria: manualSubcategoryKey || "manual",
          categoryKey: manualCategoryKey || "manual",
          subcategoryKey: manualSubcategoryKey || "manual",
          mode,
          forceText: true,
          triggeredBy: singleRecipientOnly ? "admin_manual_test_prod" : "admin_manual",
        }),
      });

      const data = await parseResponsePayload<any>(response);
      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo enviar mensaje manual"));
      }

      if (typeof data?.normalizedMessage === "string" && data.normalizedMessage.trim()) {
        setManualMessage(data.normalizedMessage);
      }

      const summary = summarizeDispatch(data);
      if (summary.okCount <= 0) {
        throw new Error(`No se pudo entregar el mensaje: ${formatDispatchReason(summary.firstFailureReason)}`);
      }

      const unknownVariables = Array.isArray(data?.validation?.unknownVariables)
        ? data.validation.unknownVariables
        : [];
      const hasUnknownVariables = unknownVariables.length > 0;

      if (summary.failedCount > 0) {
        setStatus(
          `Envio parcial (${summary.okCount}/${summary.total}) - fallidos: ${summary.failedCount}.${
            hasUnknownVariables ? ` Variables no resueltas: ${unknownVariables.join(", ")}.` : ""
          }`
        );
      } else if (singleRecipientOnly) {
        setStatus(
          `Prueba real de mensaje manual enviada.${
            hasUnknownVariables ? ` Variables no resueltas: ${unknownVariables.join(", ")}.` : ""
          }`
        );
      } else {
        setStatus(
          `Envio manual ejecutado.${
            hasUnknownVariables ? ` Variables no resueltas: ${unknownVariables.join(", ")}.` : ""
          }`
        );
      }

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar mensaje manual");
    } finally {
      setActionLoading(false);
    }
  };

  const testSubcategoryMessage = async (categoryKey: string, subcategoryKey: string) => {
    resetFeedback();

    const recipient = testRecipient || selectedManualRecipients[0] || recipients[0];
    if (!recipient) {
      setError("No hay destinatario disponible para la prueba.");
      return;
    }

    const sub = getRule(config, categoryKey, subcategoryKey);
    if (!sub) {
      setError("No se encontro la subcategoria para prueba.");
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatarios: [recipient],
          mensaje: sub.message,
          tipo: "Prueba",
          subcategoria: subcategoryKey,
          categoryKey,
          subcategoryKey,
          mode: "prod",
          forceText: true,
          triggeredBy: "admin_test_prod",
        }),
      });

      const data = await parseResponsePayload<any>(response);
      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo probar mensaje"));
      }

      const summary = summarizeDispatch(data);
      if (summary.okCount <= 0) {
        throw new Error(`No se pudo entregar la prueba: ${formatDispatchReason(summary.firstFailureReason)}`);
      }

      if (summary.failedCount > 0) {
        setStatus(
          `Prueba parcial para ${sub.label} (${summary.okCount}/${summary.total}) - fallidos: ${summary.failedCount}.`
        );
      } else {
        setStatus(`Prueba real enviada para ${sub.label}.`);
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al probar mensaje");
    } finally {
      setActionLoading(false);
    }
  };

  const simulateRule = async (categoryKey: string, subcategoryKey: string) => {
    resetFeedback();

    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/automation/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryKey,
          ruleKey: subcategoryKey,
          limit: 500,
          forceWindow: true,
        }),
      });

      const data = await parseResponsePayload<any>(response);
      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo simular subcategoria"));
      }

      const matches = Array.isArray(data?.matches) ? data.matches : [];
      const summary = data?.summary || {};
      setSimByRule((prev) => ({
        ...prev,
        [`${categoryKey}:${subcategoryKey}`]: {
          totalMatched: Number(summary.totalMatched || 0),
          rulesEvaluated: Number(summary.rulesEvaluated || 0),
          matches: matches.map((row: any) => ({
            id: String(row?.id || ""),
            nombre: String(row?.nombre || "destinatario"),
            telefono: String(row?.telefono || ""),
            reason: String(row?.reason || "match"),
            message: String(row?.message || ""),
            categoria: String(row?.categoria || categoryKey),
            ruleKey: String(row?.ruleKey || subcategoryKey),
          })),
        },
      }));

      setStatus(`Simulacion lista para ${subcategoryKey}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al simular");
    } finally {
      setActionLoading(false);
    }
  };

  const runRule = async (categoryKey: string, subcategoryKey: string, dryRun: boolean) => {
    resetFeedback();

    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          categoryKey,
          ruleKey: subcategoryKey,
          mode: dryRun ? "test" : "prod",
          forceWindow: true,
          includeDisabled: false,
          limit: 200,
        }),
      });

      const data = await parseResponsePayload<any>(response);
      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo ejecutar automatizacion"));
      }

      const runSummary = summarizeRun(data);

      if (dryRun) {
        setStatus(`Dry run ejecutado para ${subcategoryKey}. Coincidencias: ${runSummary.totalMatched}.`);
      } else {
        if (data?.ok !== true) {
          if (runSummary.error === "connection_disabled") {
            throw new Error("La conexion de WhatsApp esta desactivada en Configuracion general.");
          }
          throw new Error(
            `No se entregaron mensajes (sent=${runSummary.sent}, failed=${runSummary.failed}, skipped=${runSummary.skipped}). ${runSummary.error || "Revisa historial para detalle."}`
          );
        }

        if (runSummary.totalMatched === 0) {
          setStatus(`Ejecucion real sin coincidencias para ${subcategoryKey}.`);
        } else if (runSummary.sent <= 0) {
          throw new Error(
            `No se entregaron mensajes (sent=${runSummary.sent}, failed=${runSummary.failed}, skipped=${runSummary.skipped}).`
          );
        } else if (runSummary.failed > 0) {
          setStatus(
            `Ejecucion parcial para ${subcategoryKey}: enviados ${runSummary.sent}, fallidos ${runSummary.failed}.`
          );
        } else {
          setStatus(`Ejecucion real enviada para ${subcategoryKey}.`);
        }
      }

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar automatizacion");
    } finally {
      setActionLoading(false);
    }
  };

  const runRunnerNow = async (force: boolean) => {
    resetFeedback();
    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/automation/runner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, mode: "prod" }),
      });
      const data = await parseResponsePayload<{
        skipped?: boolean;
        reason?: string;
        runId?: string;
        message?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo ejecutar runner"));
      }

      if (data?.skipped) {
        setStatus(`Runner omitido: ${String(data?.reason || "not_due")}.`);
      } else {
        setStatus(`Runner ejecutado. Run ID: ${String(data?.runId || "-")}`);
      }

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar runner");
    } finally {
      setActionLoading(false);
    }
  };

  const executeWebSessionAction = async (
    action: "connect" | "disconnect" | "logout" | "restart"
  ) => {
    resetFeedback();

    try {
      setWebSessionBusy(true);
      const response = await fetch("/api/admin/whatsapp-web/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await parseResponsePayload<{
        session?: WhatsAppWebSession | null;
        message?: string;
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(resolvePayloadMessage(data, "No se pudo actualizar sesion de WhatsApp Web"));
      }

      setWebSession((data?.session || null) as WhatsAppWebSession | null);

      if (action === "connect") {
        setStatus("Sesion WhatsApp Web iniciada. Escanea el QR para vincular.");
      } else if (action === "disconnect") {
        setStatus("Sesion WhatsApp Web desconectada.");
      } else if (action === "logout") {
        setStatus("Sesion WhatsApp Web cerrada y desvinculada.");
      } else {
        setStatus("Sesion WhatsApp Web reiniciada.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al gestionar sesion de WhatsApp Web");
    } finally {
      setWebSessionBusy(false);
    }
  };

  const buildHistoryExportUrl = () => {
    const params = new URLSearchParams();
    params.set("format", "csv");
    if (historyFilters.from) params.set("from", historyFilters.from);
    if (historyFilters.to) params.set("to", historyFilters.to);
    if (historyFilters.status !== "all") params.set("status", historyFilters.status);
    if (historyFilters.type !== "all") params.set("type", historyFilters.type);
    if (historyFilters.user.trim()) params.set("user", historyFilters.user.trim());
    if (historyFilters.rule !== "all") params.set("rule", historyFilters.rule);
    return `/api/admin/whatsapp-history?${params.toString()}`;
  };

  const providerLabel =
    config.connection.provider === "whatsapp_web" ? "WhatsApp Web" : "Meta Cloud API";

  if (sessionStatus === "loading") {
    return (
      <main className={ADMIN_PAGE_CONTAINER}>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
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
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 p-4 text-sm text-rose-200">
          Esta seccion es solo para administradores.
        </div>
      </main>
    );
  }

  return (
    <main className={ADMIN_PAGE_CONTAINER_STACK}>
      <AdminRunningLoaderOverlay
        active={adminBusy}
        message="Cargando..."
        detail="Sincronizando panel de WhatsApp..."
      />

      <header className="relative overflow-hidden rounded-[30px] border border-cyan-300/25 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-[0_24px_70px_-34px_rgba(6,182,212,0.7)]">
        <div className="pointer-events-none absolute -left-8 top-1 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-6 top-8 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100/85">
              Centro de mensajeria
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
              Hub de WhatsApp
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-200/90">
              Automatizaciones, envios manuales e historial operativo en una vista unificada.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ReliableActionButton
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
            >
              Actualizar panel
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              onClick={saveConfig}
              disabled={saving}
              className="rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </ReliableActionButton>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Conexion
            <p className="mt-1 text-base font-black text-white">
              {config.connection.enabled ? "Activa" : "Desactivada"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Proveedor
            <p className="mt-1 text-base font-black text-white">{providerLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Modo
            <p className="mt-1 text-base font-black text-white">{config.connection.mode}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Destinatarios
            <p className="mt-1 text-base font-black text-white">{recipients.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Alumnos sin numero
            <p className="mt-1 text-base font-black text-white">{missingPhoneRows.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Runner
            <p className="mt-1 text-base font-black text-white">
              cada {config.automationRunner.intervalMinutes} min
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Proxima: {runnerState.nextRunAt ? formatDateTime(runnerState.nextRunAt) : "-"}
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-white/15 bg-slate-900/65 p-3 shadow-[0_14px_40px_-30px_rgba(148,163,184,0.6)]">
        <div className="flex flex-wrap gap-2">
          {TAB_ITEMS.map((tab) => (
            <ReliableActionButton
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl px-4 py-2 text-xs font-bold tracking-wide transition ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-cyan-300 to-emerald-300 text-slate-950 shadow-[0_10px_24px_-16px_rgba(45,212,191,0.9)]"
                  : "bg-slate-800/70 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </ReliableActionButton>
          ))}
        </div>
      </section>

      {status ? (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {loadIssues.length > 0 ? (
        <div className="rounded-2xl border border-amber-300/35 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">Cargado con advertencias:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/90">
            {loadIssues.map((issue, index) => (
              <li key={`${issue.block}-${index}`}>
                {issue.block}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {loading ? (
        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/15 px-4 py-3 text-sm text-cyan-100">
          Cargando datos del panel...
        </div>
      ) : null}

      {activeTab === "envio_manual" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h2 className="text-lg font-bold">Envio manual</h2>
            <p className="mt-1 text-xs text-slate-400">
              Seleccion multiple de alumnos/colaboradores, subcategoria y envio inmediato.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Categoria
                <select
                  value={manualCategoryKey}
                  onChange={(event) => setManualCategoryKey(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                >
                  {WHATSAPP_CATEGORY_ORDER.map((categoryKey) => {
                    const category = config.categories[categoryKey];
                    if (!category) return null;
                    return (
                      <option key={categoryKey} value={categoryKey}>
                        {category.label}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="text-sm text-slate-300">
                Subcategoria
                <select
                  value={manualSubcategoryKey}
                  onChange={(event) => setManualSubcategoryKey(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                >
                  {manualSubcategories.map((row) => (
                    <option key={row.subcategoryKey} value={row.subcategoryKey}>
                      {row.subcategoryLabel}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm text-slate-300 md:col-span-2">
                Buscar alumno/contacto
                <input
                  type="text"
                  value={manualRecipientSearch}
                  onChange={(event) => setManualRecipientSearch(event.target.value)}
                  placeholder="nombre, telefono, estado o actividad"
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm text-slate-300">
                Tipo
                <select
                  value={manualRecipientTypeFilter}
                  onChange={(event) =>
                    setManualRecipientTypeFilter(
                      event.target.value === "alumno" || event.target.value === "colaborador"
                        ? event.target.value
                        : "all"
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="alumno">Solo alumnos</option>
                  <option value="colaborador">Solo colaboradores</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ReliableActionButton
                type="button"
                onClick={toggleSelectAllVisibleManualRecipients}
                disabled={actionLoading || visibleManualRecipientIds.length === 0}
                className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {allVisibleManualSelected ? "Quitar seleccion visible" : "Seleccionar visibles"}
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={clearManualSelection}
                disabled={actionLoading || manualRecipientIds.length === 0}
                className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50"
              >
                Limpiar seleccion
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={autoSelectManualRecipientsByRule}
                disabled={actionLoading}
                className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Auto-seleccionar por ficha
              </ReliableActionButton>
              <span className="text-xs text-slate-300">
                Seleccionados: <strong>{manualRecipientIds.length}</strong> / {recipients.length}
              </span>
            </div>

            <div className="mt-3 grid max-h-72 gap-2 overflow-auto md:grid-cols-2 xl:grid-cols-3">
              {filteredManualRecipients.map((recipient) => {
                const selected = manualRecipientIds.includes(recipient.id);
                return (
                  <label
                    key={recipient.id}
                    className={`rounded-lg border p-2 text-left text-xs ${
                      selected
                        ? "border-emerald-300/50 bg-emerald-500/15 text-emerald-100"
                        : "border-white/15 bg-slate-800/70 text-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleManualRecipient(recipient.id)}
                      className="mr-2"
                    />
                    <p className="font-semibold">{recipient.label}</p>
                    <p className="text-[11px] opacity-80">{recipient.telefono}</p>
                    <p className="text-[11px] opacity-80">{recipient.tipo}</p>
                    {recipient.estado ? (
                      <p className="text-[11px] opacity-80">estado: {recipient.estado}</p>
                    ) : null}
                    {recipient.actividad ? (
                      <p className="text-[11px] opacity-80">actividad: {recipient.actividad}</p>
                    ) : null}
                    {recipient.paymentStatus ? (
                      <p className="text-[11px] opacity-80">pago: {recipient.paymentStatus}</p>
                    ) : null}
                    {recipient.planStatus ? (
                      <p className="text-[11px] opacity-80">plan: {recipient.planStatus}</p>
                    ) : null}
                  </label>
                );
              })}
              {filteredManualRecipients.length === 0 ? (
                <div className="col-span-full rounded-lg border border-white/15 bg-slate-800/60 p-3 text-xs text-slate-300">
                  No hay destinatarios para el filtro actual.
                </div>
              ) : null}
            </div>

            <div className="mt-3">
              <WhatsAppMessageEditor
                title="Editor de mensaje"
                value={manualMessage}
                onChange={setManualMessage}
                variables={previewVariables}
                requiredVariables={manualRequiredVariables}
                disabled={actionLoading}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={() => sendManual("prod", true)}
                disabled={actionLoading}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Probar Mensaje (1 contacto)
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => sendManual("prod")}
                disabled={actionLoading}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar ahora
              </ReliableActionButton>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "historial" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h2 className="text-lg font-bold">Historial de envios</h2>
            <p className="mt-1 text-xs text-slate-400">
              Filtros avanzados por fecha, estado, tipo, regla y usuario.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <label className="text-xs text-slate-300">
                Desde
                <input
                  type="date"
                  value={historyFilters.from}
                  onChange={(event) =>
                    setHistoryFilters((prev) => ({ ...prev, from: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5"
                />
              </label>

              <label className="text-xs text-slate-300">
                Hasta
                <input
                  type="date"
                  value={historyFilters.to}
                  onChange={(event) =>
                    setHistoryFilters((prev) => ({ ...prev, to: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5"
                />
              </label>

              <label className="text-xs text-slate-300">
                Estado
                <select
                  value={historyFilters.status}
                  onChange={(event) =>
                    setHistoryFilters((prev) => ({
                      ...prev,
                      status: event.target.value as HistoryFilters["status"],
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5"
                >
                  <option value="all">all</option>
                  <option value="ok">ok</option>
                  <option value="partial">partial</option>
                  <option value="failed">failed</option>
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Tipo
                <select
                  value={historyFilters.type}
                  onChange={(event) =>
                    setHistoryFilters((prev) => ({ ...prev, type: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5"
                >
                  <option value="all">all</option>
                  {historyTypeOptions.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Regla
                <select
                  value={historyFilters.rule}
                  onChange={(event) =>
                    setHistoryFilters((prev) => ({ ...prev, rule: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5"
                >
                  <option value="all">all</option>
                  {subcategoryOptions.map((row) => (
                    <option key={`${row.categoryKey}:${row.subcategoryKey}`} value={row.subcategoryKey}>
                      {row.subcategoryLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Usuario
                <input
                  type="text"
                  placeholder="email, nombre o actor"
                  value={historyFilters.user}
                  onChange={(event) =>
                    setHistoryFilters((prev) => ({ ...prev, user: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={() =>
                  setHistoryFilters({
                    from: "",
                    to: "",
                    status: "all",
                    type: "all",
                    user: "",
                    rule: "all",
                  })
                }
                className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600"
              >
                Limpiar filtros
              </ReliableActionButton>
              <a
                href={buildHistoryExportUrl()}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Exportar CSV filtrado
              </a>
              <ReliableActionButton
                type="button"
                onClick={() => runRunnerNow(false)}
                disabled={actionLoading}
                className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                Runner ahora (respeta frecuencia)
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={() => runRunnerNow(true)}
                disabled={actionLoading}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Runner forzado
              </ReliableActionButton>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Mostrando {filteredHistory.length} registro(s) de {history.length}.
            </p>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-white/15 text-slate-200">
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Subcategoria</th>
                    <th className="px-2 py-2">Usuario</th>
                    <th className="px-2 py-2">Mensaje</th>
                    <th className="px-2 py-2">Total</th>
                    <th className="px-2 py-2">OK</th>
                    <th className="px-2 py-2">Fallidos</th>
                    <th className="px-2 py-2">Modo</th>
                    <th className="px-2 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-2 py-3 text-center text-slate-400">
                        Sin historial
                      </td>
                    </tr>
                  ) : null}
                  {filteredHistory.map((row, index) => {
                    const rowKey = String(row.id || `${index}-${row.createdAt || "sin-fecha"}`);
                    const details = Array.isArray(row.results) ? row.results : [];
                    const expanded = expandedHistoryRowId === rowKey;
                    const statusValue = getHistoryStatus(row);

                    return (
                      <Fragment key={rowKey}>
                        <tr key={`${rowKey}-summary`} className="border-b border-white/5">
                          <td className="px-2 py-2 font-semibold text-slate-100">{formatDateTime(row.createdAt)}</td>
                          <td className="px-2 py-2">{statusValue}</td>
                          <td className="px-2 py-2">{row.tipo || "-"}</td>
                          <td className="px-2 py-2">{row.subcategoryKey || row.subcategoria || "-"}</td>
                          <td className="px-2 py-2">{getRowUserLabel(row)}</td>
                          <td className="px-2 py-2">{row.mensaje || "(sin mensaje)"}</td>
                          <td className="px-2 py-2">{row.total ?? 0}</td>
                          <td className="px-2 py-2">{row.ok ?? 0}</td>
                          <td className="px-2 py-2">{row.failed ?? 0}</td>
                          <td className="px-2 py-2">{row.mode || "-"}</td>
                          <td className="px-2 py-2">
                            {details.length > 0 ? (
                              <ReliableActionButton
                                type="button"
                                onClick={() =>
                                  setExpandedHistoryRowId((prev) => (prev === rowKey ? "" : rowKey))
                                }
                                className="rounded-md border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 font-semibold text-cyan-100"
                              >
                                {expanded ? "Ocultar" : `Ver (${details.length})`}
                              </ReliableActionButton>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>

                        {expanded ? (
                          <tr key={`${rowKey}-details`} className="border-b border-white/10 bg-slate-950/35">
                            <td colSpan={11} className="px-2 py-3">
                              <div className="max-h-64 overflow-auto rounded-lg border border-white/10">
                                <table className="min-w-full text-left text-[11px] text-slate-300">
                                  <thead>
                                    <tr className="border-b border-white/10 text-slate-200">
                                      <th className="px-2 py-1">Destinatario</th>
                                      <th className="px-2 py-1">Telefono</th>
                                      <th className="px-2 py-1">Estado</th>
                                      <th className="px-2 py-1">Motivo</th>
                                      <th className="px-2 py-1">Provider ID</th>
                                      <th className="px-2 py-1">Mensaje renderizado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {details.map((result, detailIndex) => (
                                      <tr key={`${rowKey}-detail-${detailIndex}`} className="border-b border-white/5">
                                        <td className="px-2 py-1">{result.label || "-"}</td>
                                        <td className="px-2 py-1">{result.phone || "-"}</td>
                                        <td className="px-2 py-1">
                                          {result.ok ? "ok" : "fallido"}
                                          {result.skipped ? " (skipped)" : ""}
                                        </td>
                                        <td className="px-2 py-1">{result.reason || "-"}</td>
                                        <td className="px-2 py-1">{result.providerMessageId || "-"}</td>
                                        <td className="px-2 py-1">{result.renderedMessage || "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h3 className="text-sm font-bold text-slate-100">Detalle por regla (exportable)</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-white/10 text-slate-200">
                    <th className="px-2 py-2">Categoria</th>
                    <th className="px-2 py-2">Regla</th>
                    <th className="px-2 py-2">Matched</th>
                    <th className="px-2 py-2">OK</th>
                    <th className="px-2 py-2">Fallidos</th>
                    <th className="px-2 py-2">Reintentos</th>
                    <th className="px-2 py-2">Ultima corrida</th>
                  </tr>
                </thead>
                <tbody>
                  {detailByRuleRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-3 text-center text-slate-400">
                        Sin datos por regla para el filtro actual.
                      </td>
                    </tr>
                  ) : null}
                  {detailByRuleRows.map((row) => (
                    <tr key={row.key} className="border-b border-white/5">
                      <td className="px-2 py-2">{row.categoryKey}</td>
                      <td className="px-2 py-2">{row.ruleKey}</td>
                      <td className="px-2 py-2">{row.total}</td>
                      <td className="px-2 py-2">{row.ok}</td>
                      <td className="px-2 py-2">{row.failed}</td>
                      <td className="px-2 py-2">{row.retried}</td>
                      <td className="px-2 py-2">{formatDateTime(row.lastRunAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h3 className="text-sm font-bold text-slate-100">Ultimas ejecuciones automaticas</h3>
            <div className="mt-2 rounded-lg border border-white/10 bg-slate-800/50 p-3 text-xs text-slate-300">
              <p>Ultimo intento: {formatDateTime(runnerState.lastAttemptAt)}</p>
              <p>Ultimo exito: {formatDateTime(runnerState.lastSuccessAt)}</p>
              <p>Ultimo error: {runnerState.lastError || "-"}</p>
              <p>Fallos consecutivos: {runnerState.consecutiveFailures ?? 0}</p>
              <p>Proxima corrida: {formatDateTime(String(runnerState.nextRunAt || ""))}</p>
            </div>

            <div className="mt-3 space-y-2">
              {runs.length === 0 ? <p className="text-sm text-slate-400">Sin ejecuciones.</p> : null}
              {runs.map((run) => (
                <article
                  key={run.runId}
                  className="rounded-lg border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-300"
                >
                  <p className="font-semibold text-slate-100">{run.runId}</p>
                  <p>{formatDateTime(String(run.updatedAt || ""))}</p>
                  <p>
                    {run.categoryKey || "general"} - {run.ruleKey || "all"} - {run.dryRun ? "dry" : "real"}
                  </p>
                  <p>
                    reglas={run.rulesExecuted ?? "-"} - sent={run.sent ?? "-"} - failed={run.failed ?? "-"} - retries={run.retryCount ?? 0} - ok={String(run.ok)}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-200">
                Alertas de fallo del runner
              </h4>
              <div className="mt-2 space-y-2">
                {runnerAlerts.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin alertas registradas.</p>
                ) : null}
                {runnerAlerts.map((alert) => (
                  <article
                    key={String(alert.id || `${alert.runId}-${alert.createdAt}`)}
                    className={`rounded-lg border p-3 text-xs ${
                      alert.type === "missing_phone_push"
                        ? "border-amber-300/30 bg-amber-500/10 text-amber-100"
                        : "border-rose-300/30 bg-rose-500/10 text-rose-100"
                    }`}
                  >
                    <p className="font-semibold">{formatDateTime(alert.createdAt)}</p>

                    {alert.type === "missing_phone_push" ? (
                      <>
                        <p>
                          run={alert.runId || "-"} - {alert.categoryKey || "all"} / {alert.ruleKey || "all"}
                        </p>
                        <p>alumnos_sin_numero={alert.totalMissing ?? 0}</p>
                        {alert.previewNames ? <p>ejemplos={alert.previewNames}</p> : null}
                        {alert.alertError ? <p>error={alert.alertError}</p> : <p>push=enviado</p>}
                      </>
                    ) : (
                      <>
                        <p>
                          run={alert.runId || "-"} - {alert.categoryKey || "all"} / {alert.ruleKey || "all"}
                        </p>
                        <p>
                          sent={alert.sent ?? 0} - failed={alert.failed ?? 0} - retries={alert.retryCount ?? 0}
                        </p>
                        <p>
                          email={String(alert.emailAlertSent)} - whatsapp={String(alert.whatsappAlertSent)}
                        </p>
                        {alert.alertError ? <p>error={alert.alertError}</p> : null}
                      </>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "configuracion" ? (
        <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
          <h2 className="text-lg font-bold">Configuracion general</h2>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="rounded-lg border border-white/10 bg-slate-800/50 p-3 text-sm">
              <input
                type="checkbox"
                checked={config.connection.enabled !== false}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    connection: {
                      ...prev.connection,
                      enabled: event.target.checked,
                    },
                  }))
                }
                className="mr-2"
              />
              Conexion habilitada
            </label>

            <label className="text-sm text-slate-300">
              Modo de envio por defecto
              <select
                value={config.connection.mode}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    connection: {
                      ...prev.connection,
                      mode: event.target.value === "prod" ? "prod" : "test",
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
              >
                <option value="test">test</option>
                <option value="prod">prod</option>
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Proveedor de envio
              <select
                value={config.connection.provider || "meta_cloud"}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    connection: {
                      ...prev.connection,
                      provider:
                        event.target.value === "whatsapp_web" ? "whatsapp_web" : "meta_cloud",
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
              >
                <option value="meta_cloud">Meta Cloud API</option>
                <option value="whatsapp_web">WhatsApp Web (QR)</option>
              </select>
            </label>

            <label className="text-sm text-slate-300 md:col-span-2">
              Destinatario para pruebas rapidas
              <select
                value={testRecipientId}
                onChange={(event) => setTestRecipientId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
              >
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.label} ({recipient.telefono})
                  </option>
                ))}
              </select>
            </label>

            {config.connection.provider === "whatsapp_web" ? (
              <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-4 text-sm text-cyan-100 md:col-span-2">
                Vinculacion WhatsApp Web habilitada en esta seccion de Configuracion.
              </div>
            ) : null}

            <label className="rounded-lg border border-white/10 bg-slate-800/50 p-3 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={config.automationRunner.enabled !== false}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    automationRunner: {
                      ...prev.automationRunner,
                      enabled: event.target.checked,
                    },
                  }))
                }
                className="mr-2"
              />
              Runner automatico habilitado
            </label>

            <label className="text-sm text-slate-300">
              Frecuencia runner (minutos)
              <input
                type="number"
                min={1}
                max={60}
                value={config.automationRunner.intervalMinutes}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    automationRunner: {
                      ...prev.automationRunner,
                      intervalMinutes: Math.max(1, Math.min(60, Number(event.target.value || 5))),
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
              />
            </label>

            <label className="text-sm text-slate-300">
              Reintentos transitorios
              <input
                type="number"
                min={0}
                max={5}
                value={config.automationRunner.maxRetries}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    automationRunner: {
                      ...prev.automationRunner,
                      maxRetries: Math.max(0, Math.min(5, Number(event.target.value || 0))),
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
              />
            </label>

            <label className="text-sm text-slate-300">
              Backoff entre reintentos (seg)
              <input
                type="number"
                min={5}
                max={300}
                value={config.automationRunner.retryBackoffSeconds}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    automationRunner: {
                      ...prev.automationRunner,
                      retryBackoffSeconds: Math.max(
                        5,
                        Math.min(300, Number(event.target.value || 20))
                      ),
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
              />
            </label>

            <label className="rounded-lg border border-white/10 bg-slate-800/50 p-3 text-sm">
              <input
                type="checkbox"
                checked={config.automationRunner.alertEmailOnFailure !== false}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    automationRunner: {
                      ...prev.automationRunner,
                      alertEmailOnFailure: event.target.checked,
                    },
                  }))
                }
                className="mr-2"
              />
              Alerta por email ante fallo
            </label>

            <label className="rounded-lg border border-white/10 bg-slate-800/50 p-3 text-sm">
              <input
                type="checkbox"
                checked={config.automationRunner.alertWhatsAppOnFailure !== false}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    automationRunner: {
                      ...prev.automationRunner,
                      alertWhatsAppOnFailure: event.target.checked,
                    },
                  }))
                }
                className="mr-2"
              />
              Alerta por WhatsApp interno
            </label>

            <label className="rounded-lg border border-white/10 bg-slate-800/50 p-3 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={config.automationRunner.alertMissingPhonePush !== false}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    automationRunner: {
                      ...prev.automationRunner,
                      alertMissingPhonePush: event.target.checked,
                    },
                  }))
                }
                className="mr-2"
              />
              Aviso automatico push: alumnos sin numero
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-300/35 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-100">
              Alumnos sin numero de WhatsApp ({missingPhoneRows.length})
            </p>
            {missingPhoneRows.length === 0 ? (
              <p className="mt-2 text-xs text-amber-100/80">Todos los alumnos detectados tienen numero valido.</p>
            ) : (
              <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-amber-200/20">
                <table className="min-w-full text-left text-xs text-amber-100">
                  <thead>
                    <tr className="border-b border-amber-200/20 text-amber-50">
                      <th className="px-2 py-1">Alumno</th>
                      <th className="px-2 py-1">Estado</th>
                      <th className="px-2 py-1">Motivo</th>
                      <th className="px-2 py-1">Valor actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingPhoneRows.map((row) => (
                      <tr key={row.id} className="border-b border-amber-200/10">
                        <td className="px-2 py-1">{row.label}</td>
                        <td className="px-2 py-1">{row.estado || "activo"}</td>
                        <td className="px-2 py-1">{row.reason === "invalid_phone" ? "Numero invalido" : "Sin numero"}</td>
                        <td className="px-2 py-1">{row.rawPhone || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-950 p-5 shadow-[0_24px_70px_-36px_rgba(45,212,191,0.65)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100/85">
                  Vinculacion WhatsApp Web
                </p>
                <h3 className="mt-2 text-xl font-black text-white">QR y control de sesion</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Esta sesion se mantiene activa con reconexion automatica y almacenamiento local.
                </p>
              </div>

              {config.connection.provider === "whatsapp_web" ? (
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWebSessionStatusTone(
                    webSession?.status
                  )}`}
                >
                  {getWebSessionStatusLabel(webSession?.status)}
                </span>
              ) : (
                <span className="inline-flex rounded-full border border-slate-300/20 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  Inactivo (proveedor actual: Meta Cloud API)
                </span>
              )}
            </div>

            {config.connection.provider !== "whatsapp_web" ? (
              <div className="mt-4 rounded-2xl border border-white/15 bg-slate-900/70 p-4 text-sm text-slate-200">
                Activa el proveedor <span className="font-semibold text-white">WhatsApp Web (QR)</span> para
                habilitar la vinculacion por QR.
              </div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
                  <p className="text-sm font-semibold text-white">Estado de la sesion</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                      Numero
                      <p className="mt-1 text-sm font-bold text-white">{webSession?.phone || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                      Perfil
                      <p className="mt-1 text-sm font-bold text-white">{webSession?.pushname || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-xs text-slate-300 sm:col-span-2">
                      Ultimo evento
                      <p className="mt-1 text-sm font-bold text-white">
                        {webSession?.lastEventAt ? formatDateTime(webSession.lastEventAt) : "-"}
                      </p>
                    </div>
                    {webSession?.lastError ? (
                      <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 sm:col-span-2">
                        Error: {webSession.lastError}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ReliableActionButton
                      type="button"
                      onClick={() => executeWebSessionAction("connect")}
                      disabled={webSessionBusy}
                      className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                    >
                      Iniciar / Generar QR
                    </ReliableActionButton>
                    <ReliableActionButton
                      type="button"
                      onClick={() => executeWebSessionAction("restart")}
                      disabled={webSessionBusy}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                    >
                      Reiniciar sesion
                    </ReliableActionButton>
                    <ReliableActionButton
                      type="button"
                      onClick={() => executeWebSessionAction("disconnect")}
                      disabled={webSessionBusy}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                    >
                      Desconectar
                    </ReliableActionButton>
                    <ReliableActionButton
                      type="button"
                      onClick={() => executeWebSessionAction("logout")}
                      disabled={webSessionBusy}
                      className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
                    >
                      Cerrar sesion
                    </ReliableActionButton>
                    <ReliableActionButton
                      type="button"
                      onClick={() => void loadWhatsAppWebSession(true)}
                      disabled={webSessionLoading || webSessionBusy}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                    >
                      Actualizar estado
                    </ReliableActionButton>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
                  <p className="text-sm font-semibold text-white">QR de vinculacion</p>
                  {webSession?.qrImageDataUrl ? (
                    <div className="mt-3 inline-flex rounded-2xl border border-white/20 bg-white p-2">
                      <img
                        src={webSession.qrImageDataUrl}
                        alt="QR de vinculacion de WhatsApp Web"
                        className="h-56 w-56"
                      />
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-white/20 bg-slate-800/60 p-4 text-xs text-slate-300">
                      {webSession?.connected
                        ? "Sesion conectada y persistida. La automatizacion seguira usando esta vinculacion."
                        : "No hay QR visible todavia. Usa Iniciar / Generar QR para vincular el telefono."}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab !== "envio_manual" &&
      activeTab !== "historial" &&
      activeTab !== "configuracion" ? (
        <section className="space-y-4">
          {(() => {
            const category = config.categories[activeTab];
            if (!category) {
              return (
                <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4 text-sm text-slate-300">
                  Categoria no disponible.
                </div>
              );
            }

            const subEntries = Object.entries(category.subcategories);

            return (
              <>
                <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
                  <label className="text-sm font-semibold text-slate-200">
                    <input
                      type="checkbox"
                      checked={category.enabled !== false}
                      onChange={(event) => updateCategoryEnabled(activeTab, event.target.checked)}
                      className="mr-2"
                    />
                    Activar categoria {category.label}
                  </label>
                </div>

                {subEntries.length === 0 ? (
                  <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4 text-sm text-slate-400">
                    Esta categoria no tiene subcategorias cargadas.
                  </div>
                ) : null}

                {subEntries.map(([subcategoryKey, sub]) => {
                  const sim = simByRule[`${activeTab}:${subcategoryKey}`];

                  return (
                    <article
                      key={`${activeTab}-${subcategoryKey}`}
                      className="rounded-2xl border border-emerald-500/35 bg-slate-900/75 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-black text-emerald-300">{sub.label}</h3>
                          <p className="text-xs text-slate-300">{sub.description}</p>
                        </div>

                        <label className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={sub.enabled !== false}
                            onChange={(event) =>
                              updateRule(activeTab, subcategoryKey, { enabled: event.target.checked })
                            }
                            className="mr-2"
                          />
                          Activo
                        </label>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {sub.triggerType === "days_before" ? (
                          <label className="text-sm text-slate-300">
                            Dias antes
                            <input
                              type="number"
                              min={0}
                              max={365}
                              value={sub.daysOffset}
                              onChange={(event) =>
                                updateRule(activeTab, subcategoryKey, {
                                  daysOffset: Math.max(0, Math.min(365, Number(event.target.value || 0))),
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
                            />
                          </label>
                        ) : (
                          <div className="text-sm text-slate-400">
                            Trigger: <span className="font-semibold text-slate-200">{sub.triggerType}</span>
                          </div>
                        )}

                        <label className="text-sm text-slate-300">
                          Enviar desde
                          <input
                            type="time"
                            value={sub.sendFrom}
                            onChange={(event) =>
                              updateRule(activeTab, subcategoryKey, { sendFrom: event.target.value })
                            }
                            className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
                          />
                        </label>

                        <label className="text-sm text-slate-300">
                          Enviar hasta
                          <input
                            type="time"
                            value={sub.sendTo}
                            onChange={(event) =>
                              updateRule(activeTab, subcategoryKey, { sendTo: event.target.value })
                            }
                            className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
                          />
                        </label>
                      </div>

                      <div className="mt-3">
                        <WhatsAppMessageEditor
                          title="Editor de mensaje"
                          value={sub.message}
                          onChange={(value) => updateRule(activeTab, subcategoryKey, { message: value })}
                          variables={previewVariables}
                          requiredVariables={sub.variables}
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <ReliableActionButton
                          type="button"
                          onClick={() => resetRuleMessage(activeTab, subcategoryKey)}
                          disabled={actionLoading}
                          className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Mensaje por defecto
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={() => testSubcategoryMessage(activeTab, subcategoryKey)}
                          disabled={actionLoading}
                          className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Probar Mensaje
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={() => simulateRule(activeTab, subcategoryKey)}
                          disabled={actionLoading}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Simular
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={() => runRule(activeTab, subcategoryKey, true)}
                          disabled={actionLoading}
                          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Dry run
                        </ReliableActionButton>
                        <ReliableActionButton
                          type="button"
                          onClick={() => runRule(activeTab, subcategoryKey, false)}
                          disabled={actionLoading}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Ejecutar ahora
                        </ReliableActionButton>
                      </div>

                      {sim ? (
                        <div className="mt-3 rounded-lg border border-indigo-300/30 bg-indigo-500/10 p-3 text-xs text-indigo-100">
                          Coincidencias: {sim.totalMatched} - Reglas evaluadas: {sim.rulesEvaluated}
                          {sim.matches.length > 0 ? (
                            <div className="mt-2 max-h-48 overflow-auto rounded-md border border-indigo-200/30">
                              <table className="min-w-full text-left text-[11px] text-indigo-100">
                                <thead>
                                  <tr className="border-b border-indigo-200/20">
                                    <th className="px-2 py-1">Destinatario</th>
                                    <th className="px-2 py-1">Telefono</th>
                                    <th className="px-2 py-1">Motivo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sim.matches.map((match) => (
                                    <tr key={`${match.id}-${match.telefono}`} className="border-b border-indigo-200/10">
                                      <td className="px-2 py-1">{match.nombre}</td>
                                      <td className="px-2 py-1">{match.telefono || "-"}</td>
                                      <td className="px-2 py-1">{match.reason || "match"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </>
            );
          })()}
        </section>
      ) : null}

    </main>
  );
}
