"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
  telefono: string;
  variables: Record<string, string>;
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
  runId?: string;
  categoryKey?: string;
  ruleKey?: string;
  sent?: number;
  failed?: number;
  retryCount?: number;
  emailAlertSent?: boolean;
  whatsappAlertSent?: boolean;
  alertError?: string | null;
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

function cloneConfig(config: WhatsAppConfig) {
  return JSON.parse(JSON.stringify(config)) as WhatsAppConfig;
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

export default function AdminWhatsAppPage() {
  const { data: session, status: sessionStatus } = useSession();

  const [activeTab, setActiveTab] = useState<TabId>("cobranzas");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [config, setConfig] = useState<WhatsAppConfig>(getDefaultWhatsAppConfig());
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runnerState, setRunnerState] = useState<RunnerState>({});
  const [runnerAlerts, setRunnerAlerts] = useState<RunnerAlertRow[]>([]);

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

  const role = (session?.user as any)?.role;

  const recipientById = useMemo(
    () => new Map(recipients.map((recipient) => [recipient.id, recipient])),
    [recipients]
  );

  const selectedManualRecipients = useMemo(
    () => manualRecipientIds.map((id) => recipientById.get(id)).filter(Boolean) as Recipient[],
    [manualRecipientIds, recipientById]
  );

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

  const resetFeedback = () => {
    setStatus("");
    setError("");
  };

  const loadAll = async () => {
    setLoading(true);
    resetFeedback();

    try {
      const [configRes, recipientsRes, historyRes, runsRes] = await Promise.all([
        fetch("/api/whatsapp/config", { cache: "no-store" }),
        fetch("/api/whatsapp/recipients", { cache: "no-store" }),
        fetch("/api/admin/whatsapp-history", { cache: "no-store" }),
        fetch("/api/admin/whatsapp-automation-runs", { cache: "no-store" }),
      ]);

      const [configJson, recipientsJson, historyJson, runsJson] = await Promise.all([
        configRes.json(),
        recipientsRes.json(),
        historyRes.json(),
        runsRes.json(),
      ]);

      if (!configRes.ok) {
        throw new Error(configJson?.error || "No se pudo cargar configuracion");
      }

      const nextConfig = configJson?.config || getDefaultWhatsAppConfig();
      setConfig(nextConfig);

      const nextRecipients = Array.isArray(recipientsJson?.recipients) ? recipientsJson.recipients : [];
      setRecipients(nextRecipients);

      const nextHistory = Array.isArray(historyJson?.history) ? historyJson.history : [];
      setHistory(nextHistory);

      const nextRuns = Array.isArray(runsJson?.runs) ? runsJson.runs : [];
      setRuns(nextRuns);
      setRunnerState(
        runsJson?.runnerState && typeof runsJson.runnerState === "object"
          ? runsJson.runnerState
          : {}
      );
      setRunnerAlerts(Array.isArray(runsJson?.alerts) ? runsJson.alerts : []);

      if (!testRecipientId && nextRecipients.length > 0) {
        setTestRecipientId(nextRecipients[0].id);
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

  const saveConfig = async () => {
    resetFeedback();
    try {
      setSaving(true);
      const response = await fetch("/api/whatsapp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar configuracion");
      }

      setConfig(data?.config || config);
      setStatus("Configuracion guardada.");
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

  const sendManual = async (mode: "test" | "prod") => {
    resetFeedback();

    if (selectedManualRecipients.length === 0) {
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
          destinatarios: selectedManualRecipients,
          mensaje: manualMessage,
          tipo: "Manual",
          subcategoria: manualSubcategoryKey || "manual",
          categoryKey: manualCategoryKey || "manual",
          subcategoryKey: manualSubcategoryKey || "manual",
          mode,
          forceText: true,
          triggeredBy: "admin_manual",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo enviar mensaje manual");
      }

      setStatus(
        mode === "test"
          ? "Prueba de mensaje manual ejecutada."
          : "Envio manual ejecutado."
      );

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
          mode: "test",
          forceText: true,
          triggeredBy: "admin_test",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo probar mensaje");
      }

      setStatus(`Prueba enviada para ${sub.label}.`);
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo simular subcategoria");
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
          forceWindow: true,
          includeDisabled: false,
          limit: 200,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo ejecutar automatizacion");
      }

      setStatus(
        dryRun
          ? `Dry run ejecutado para ${subcategoryKey}.`
          : `Ejecucion real enviada para ${subcategoryKey}.`
      );

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
        body: JSON.stringify({ force }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo ejecutar runner");
      }

      if (data?.skipped) {
        setStatus(`Runner omitido: ${String(data.reason || "not_due")}.`);
      } else {
        setStatus(`Runner ejecutado. Run ID: ${String(data.runId || "-")}`);
      }

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar runner");
    } finally {
      setActionLoading(false);
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

  if (sessionStatus === "loading") {
    return (
      <main className="mx-auto max-w-7xl p-6 text-slate-100">
        <p className="text-sm text-slate-300">Cargando panel de WhatsApp...</p>
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
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <header className="mb-5 rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">Configuracion de WhatsApp</h1>
            <p className="mt-1 text-sm text-slate-300">
              Administra mensajes manuales y automatizaciones por subcategoria.
            </p>
          </div>

          <button
            type="button"
            onClick={saveConfig}
            disabled={saving}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Conexion: <span className="font-bold text-white">{config.connection.enabled ? "Activa" : "Desactivada"}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Modo: <span className="font-bold text-white">{config.connection.mode}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Destinatarios: <span className="font-bold text-white">{recipients.length}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            Runner cada <span className="font-bold text-white">{config.automationRunner.intervalMinutes} min</span>
            <p className="mt-1 text-[11px] text-slate-400">
              Proxima: {runnerState.nextRunAt ? formatDateTime(runnerState.nextRunAt) : "-"}
            </p>
          </div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              activeTab === tab.id
                ? "bg-emerald-500/25 text-emerald-100"
                : "bg-slate-800/70 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {status ? <p className="mb-3 text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="mb-3 text-sm text-cyan-200">Cargando datos del panel...</p> : null}

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

            <div className="mt-3 grid max-h-72 gap-2 overflow-auto md:grid-cols-2 xl:grid-cols-3">
              {recipients.map((recipient) => {
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
                  </label>
                );
              })}
            </div>

            <div className="mt-3">
              <WhatsAppMessageEditor
                title="Editor de mensaje"
                value={manualMessage}
                onChange={setManualMessage}
                variables={previewVariables}
                disabled={actionLoading}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => sendManual("test")}
                disabled={actionLoading}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Probar Mensaje
              </button>
              <button
                type="button"
                onClick={() => sendManual("prod")}
                disabled={actionLoading}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar ahora
              </button>
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
              <button
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
              </button>
              <a
                href={buildHistoryExportUrl()}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Exportar CSV filtrado
              </a>
              <button
                type="button"
                onClick={() => runRunnerNow(false)}
                disabled={actionLoading}
                className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                Runner ahora (respeta frecuencia)
              </button>
              <button
                type="button"
                onClick={() => runRunnerNow(true)}
                disabled={actionLoading}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Runner forzado
              </button>
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
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedHistoryRowId((prev) => (prev === rowKey ? "" : rowKey))
                                }
                                className="rounded-md border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 font-semibold text-cyan-100"
                              >
                                {expanded ? "Ocultar" : `Ver (${details.length})`}
                              </button>
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
                    {run.categoryKey || "general"} · {run.ruleKey || "all"} · {run.dryRun ? "dry" : "real"}
                  </p>
                  <p>
                    reglas={run.rulesExecuted ?? "-"} · sent={run.sent ?? "-"} · failed={run.failed ?? "-"} · retries={run.retryCount ?? 0} · ok={String(run.ok)}
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
                    className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-3 text-xs text-rose-100"
                  >
                    <p className="font-semibold">{formatDateTime(alert.createdAt)}</p>
                    <p>
                      run={alert.runId || "-"} · {alert.categoryKey || "all"} / {alert.ruleKey || "all"}
                    </p>
                    <p>
                      sent={alert.sent ?? 0} · failed={alert.failed ?? 0} · retries={alert.retryCount ?? 0}
                    </p>
                    <p>
                      email={String(alert.emailAlertSent)} · whatsapp={String(alert.whatsappAlertSent)}
                    </p>
                    {alert.alertError ? <p>error={alert.alertError}</p> : null}
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
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => resetRuleMessage(activeTab, subcategoryKey)}
                          disabled={actionLoading}
                          className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Mensaje por defecto
                        </button>
                        <button
                          type="button"
                          onClick={() => testSubcategoryMessage(activeTab, subcategoryKey)}
                          disabled={actionLoading}
                          className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Probar Mensaje
                        </button>
                        <button
                          type="button"
                          onClick={() => simulateRule(activeTab, subcategoryKey)}
                          disabled={actionLoading}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Simular
                        </button>
                        <button
                          type="button"
                          onClick={() => runRule(activeTab, subcategoryKey, true)}
                          disabled={actionLoading}
                          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Dry run
                        </button>
                        <button
                          type="button"
                          onClick={() => runRule(activeTab, subcategoryKey, false)}
                          disabled={actionLoading}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Ejecutar ahora
                        </button>
                      </div>

                      {sim ? (
                        <div className="mt-3 rounded-lg border border-indigo-300/30 bg-indigo-500/10 p-3 text-xs text-indigo-100">
                          Coincidencias: {sim.totalMatched} · Reglas evaluadas: {sim.rulesEvaluated}
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
