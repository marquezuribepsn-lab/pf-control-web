"use client";

import { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAlumnos } from "../AlumnosProvider";
import { useColaboradores } from "../ColaboradoresProvider";
import WhatsAppHistoryTable from "./WhatsAppHistoryTable";
import WhatsAppAutomationRunsTable from "./WhatsAppAutomationRunsTable";

type CategoryKey = "cobranzas" | "asistencia_rutinas" | "recordatorios_otros";

type RuleKey =
  | "aviso_anticipado"
  | "dia_vencimiento"
  | "vencido"
  | "renovacion_plan"
  | "actualizacion_datos"
  | "encuesta_fin_semana"
  | "cumpleanos_anticipado"
  | "cumpleanos_hoy"
  | "cumpleanos_post";

type RuleConfig = {
  enabled: boolean;
  daysOffset: number;
  sendFrom: string;
  sendTo: string;
  message: string;
};

type RuleDefinition = {
  key: RuleKey;
  label: string;
  description: string;
  supportsOffset: boolean;
  offsetLabel: string;
  defaultValue: RuleConfig;
};

type WhatsAppConfig = {
  connection: {
    enabled: boolean;
    countryCode: string;
    phoneNumber: string;
  };
  categories: Record<CategoryKey, { rules: Record<RuleKey, RuleConfig> }>;
  updatedAt?: string;
  updatedBy?: string;
};

type RecipientOption = {
  id: string;
  label: string;
  type: "alumno" | "colaborador";
  phoneNumber?: string;
  variables: Record<string, string>;
};

type SimulationRecipient = {
  recipientId: string;
  recipientLabel: string;
  recipientType: string;
  daysToDue: number | null;
  preview: string;
  withinWindow: boolean;
  reason: string;
};

type RuleSimulationResult = {
  categoryKey: CategoryKey;
  ruleKey: RuleKey;
  summary: {
    totalMatched: number;
    readyToSendNow: number;
    blockedByWindow: number;
  };
  recipients: SimulationRecipient[];
};

type ScheduleItem = {
  key: string;
  createdAt?: string;
  value?: {
    nombre?: string;
    categoria?: string;
    subcategoria?: string;
    mensaje?: string;
    fecha?: string;
    estado?: string;
    automatico?: boolean;
  };
};

const TEMPLATE_VARIABLES = [
  { key: "nombre", label: "Nombre", sample: "Juan" },
  { key: "actividad", label: "Actividad", sample: "Futbol" },
  { key: "dias", label: "Dias", sample: "1" },
  { key: "total", label: "Total", sample: "$25000" },
  { key: "fecha", label: "Fecha", sample: "31/03/2026" },
  { key: "link", label: "Link", sample: "https://pf-control.com/encuesta" },
];

const CATEGORY_TABS: Array<{ key: CategoryKey | "configuracion"; label: string }> = [
  { key: "cobranzas", label: "Cobranzas" },
  { key: "asistencia_rutinas", label: "Asistencia y Rutinas" },
  { key: "recordatorios_otros", label: "Recordatorios y Otros" },
  { key: "configuracion", label: "Configuracion" },
];

const RULES_BY_CATEGORY: Record<CategoryKey, RuleDefinition[]> = {
  cobranzas: [
    {
      key: "aviso_anticipado",
      label: "Aviso anticipado",
      description: "Envia recordatorio antes del vencimiento.",
      supportsOffset: true,
      offsetLabel: "Dias antes del vencimiento",
      defaultValue: {
        enabled: true,
        daysOffset: 1,
        sendFrom: "09:00",
        sendTo: "20:00",
        message:
          "Hola {{nombre}}, tu cuota de la actividad {{actividad}} vence dentro de {{dias}} dias. Monto: {{total}}.",
      },
    },
    {
      key: "dia_vencimiento",
      label: "Dia del vencimiento",
      description: "Se dispara el mismo dia del vencimiento.",
      supportsOffset: false,
      offsetLabel: "",
      defaultValue: {
        enabled: true,
        daysOffset: 0,
        sendFrom: "09:00",
        sendTo: "20:00",
        message:
          "Hola {{nombre}}, tu cuota de la actividad {{actividad}} vence hoy. Monto: {{total}}.",
      },
    },
    {
      key: "vencido",
      label: "Cuota vencida",
      description: "Aviso cuando la cuota ya vencio.",
      supportsOffset: true,
      offsetLabel: "Dias despues del vencimiento",
      defaultValue: {
        enabled: false,
        daysOffset: 1,
        sendFrom: "10:00",
        sendTo: "19:00",
        message:
          "Hola {{nombre}}, tu cuota de {{actividad}} vencio hace {{dias}} dias. Si ya pagaste, ignora este mensaje.",
      },
    },
  ],
  asistencia_rutinas: [
    {
      key: "renovacion_plan",
      label: "Renovacion de plan",
      description: "Se envia al renovar o actualizar plan.",
      supportsOffset: false,
      offsetLabel: "",
      defaultValue: {
        enabled: true,
        daysOffset: 0,
        sendFrom: "09:00",
        sendTo: "20:00",
        message: "Hola {{nombre}}, ya tenes disponible tu plan de entrenamiento actualizado.",
      },
    },
    {
      key: "actualizacion_datos",
      label: "Actualizacion de datos",
      description: "Aviso cuando se actualizan datos importantes.",
      supportsOffset: false,
      offsetLabel: "",
      defaultValue: {
        enabled: false,
        daysOffset: 0,
        sendFrom: "09:00",
        sendTo: "20:00",
        message: "Hola {{nombre}}, actualizamos informacion importante de tu seguimiento.",
      },
    },
  ],
  recordatorios_otros: [
    {
      key: "encuesta_fin_semana",
      label: "Encuesta de fin de semana",
      description: "Encuesta automatica al finalizar la semana.",
      supportsOffset: false,
      offsetLabel: "",
      defaultValue: {
        enabled: true,
        daysOffset: 0,
        sendFrom: "18:00",
        sendTo: "21:00",
        message:
          "Hola {{nombre}}, terminaste tu semana de entrenamiento. Contanos como te sentiste en esta encuesta: {{link}}",
      },
    },
    {
      key: "cumpleanos_anticipado",
      label: "Cumpleanos anticipado",
      description: "Aviso configurable dias antes del cumpleanos.",
      supportsOffset: true,
      offsetLabel: "Dias antes del cumpleanos",
      defaultValue: {
        enabled: false,
        daysOffset: 3,
        sendFrom: "09:00",
        sendTo: "20:00",
        message: "Hola {{nombre}}, en {{dias}} dias es tu cumpleanos. Te esperamos en {{actividad}}.",
      },
    },
    {
      key: "cumpleanos_hoy",
      label: "Cumpleanos hoy",
      description: "Mensaje que se envia el mismo dia del cumpleanos.",
      supportsOffset: false,
      offsetLabel: "",
      defaultValue: {
        enabled: false,
        daysOffset: 0,
        sendFrom: "09:00",
        sendTo: "20:00",
        message: "Feliz cumpleanos {{nombre}}. Que tengas un gran dia. Nos vemos en {{actividad}}.",
      },
    },
    {
      key: "cumpleanos_post",
      label: "Cumpleanos posterior",
      description: "Mensaje configurable dias despues del cumpleanos.",
      supportsOffset: true,
      offsetLabel: "Dias despues del cumpleanos",
      defaultValue: {
        enabled: false,
        daysOffset: 1,
        sendFrom: "09:00",
        sendTo: "20:00",
        message: "Hola {{nombre}}, esperamos que hayas tenido un excelente cumpleanos. Te esperamos en {{actividad}}.",
      },
    },
  ],
};

function buildDefaultConfig(): WhatsAppConfig {
  const categories = {
    cobranzas: { rules: {} as Record<RuleKey, RuleConfig> },
    asistencia_rutinas: { rules: {} as Record<RuleKey, RuleConfig> },
    recordatorios_otros: { rules: {} as Record<RuleKey, RuleConfig> },
  };

  (Object.keys(RULES_BY_CATEGORY) as CategoryKey[]).forEach((categoryKey) => {
    RULES_BY_CATEGORY[categoryKey].forEach((rule) => {
      categories[categoryKey].rules[rule.key] = { ...rule.defaultValue };
    });
  });

  return {
    connection: {
      enabled: false,
      countryCode: "54",
      phoneNumber: "",
    },
    categories,
  };
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

function pickPhoneFromSource(source: Record<string, unknown>) {
  const candidates = [
    source.telefono,
    source.phone,
    source.whatsapp,
    source.telefonoWhatsapp,
    source.celular,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || "").replace(/\D/g, "");
    if (normalized.length >= 8) {
      return normalized;
    }
  }

  return "";
}

function normalizeNameKey(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRuleDefinition(category: CategoryKey, ruleKey: RuleKey) {
  return RULES_BY_CATEGORY[category].find((rule) => rule.key === ruleKey);
}

export default function WhatsAppAdminPanel() {
  const { data: session } = useSession();
  const { alumnos } = useAlumnos();
  const { colaboradores, loading: loadingColaboradores } = useColaboradores();

  const [config, setConfig] = useState<WhatsAppConfig>(buildDefaultConfig());
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [activeTab, setActiveTab] = useState<CategoryKey | "configuracion">("cobranzas");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipientMap, setSelectedRecipientMap] = useState<Record<string, boolean>>({});
  const [manualCategory, setManualCategory] = useState<CategoryKey>("cobranzas");
  const [manualRule, setManualRule] = useState<RuleKey>("aviso_anticipado");
  const [manualMessage, setManualMessage] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [sendingManual, setSendingManual] = useState(false);
  const [testingRuleKey, setTestingRuleKey] = useState<string>("");
  const [runningAutomationNow, setRunningAutomationNow] = useState(false);
  const [simulatingRuleKey, setSimulatingRuleKey] = useState<string>("");
  const [simulationByRule, setSimulationByRule] = useState<Record<string, RuleSimulationResult>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [historyReloadToken, setHistoryReloadToken] = useState(0);
  const [metaPhoneByAlumnoName, setMetaPhoneByAlumnoName] = useState<Record<string, string>>({});
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduleAutomatico, setScheduleAutomatico] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/sync/pf-control-clientes-meta-v1", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        const value = data?.value;

        if (!response.ok || !value || typeof value !== "object") {
          if (!cancelled) {
            setMetaPhoneByAlumnoName({});
          }
          return;
        }

        const next: Record<string, string> = {};

        Object.entries(value as Record<string, unknown>).forEach(([id, rawMeta]) => {
          if (!String(id).startsWith("alumno:")) return;

          const labelFromId = String(id).split(":").slice(1).join(":");
          const key = normalizeNameKey(labelFromId);
          if (!key || !rawMeta || typeof rawMeta !== "object") return;

          const phone = pickPhoneFromSource(rawMeta as Record<string, unknown>);
          if (phone) {
            next[key] = phone;
          }
        });

        if (!cancelled) {
          setMetaPhoneByAlumnoName(next);
        }
      } catch {
        if (!cancelled) {
          setMetaPhoneByAlumnoName({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const recipientOptions = useMemo<RecipientOption[]>(() => {
    const alumnosList = (Array.isArray(alumnos) ? alumnos : []).map((alumno: any, index: number) => {
      const nombre = String(alumno?.nombre || `Alumno ${index + 1}`);
      const actividad = String(alumno?.deporte || alumno?.categoria || "Entrenamiento");
      const telefono =
        pickPhoneFromSource(alumno || {}) ||
        metaPhoneByAlumnoName[normalizeNameKey(nombre)] ||
        "";
      return {
        id: `alumno:${nombre}`,
        label: nombre,
        type: "alumno" as const,
        phoneNumber: telefono || undefined,
        variables: {
          nombre,
          actividad,
          dias: "1",
          total: "$25000",
          fecha: new Date().toLocaleDateString("es-AR"),
          link: "https://pf-control.com",
          ...(telefono ? { telefono } : {}),
        },
      };
    });

    const colabList = (Array.isArray(colaboradores) ? colaboradores : []).map((colab: any, index: number) => {
      const nombre = String(colab?.nombreCompleto || colab?.email || `Colaborador ${index + 1}`);
      const telefono = pickPhoneFromSource(colab || {});
      return {
        id: `colaborador:${String(colab?.id || nombre)}`,
        label: nombre,
        type: "colaborador" as const,
        phoneNumber: telefono || undefined,
        variables: {
          nombre,
          actividad: "Colaboracion",
          dias: "1",
          total: "$0",
          fecha: new Date().toLocaleDateString("es-AR"),
          link: "https://pf-control.com",
          ...(telefono ? { telefono } : {}),
        },
      };
    });

    return [...alumnosList, ...colabList];
  }, [alumnos, colaboradores, metaPhoneByAlumnoName]);

  const filteredRecipients = useMemo(() => {
    const query = recipientSearch.trim().toLowerCase();
    if (!query) return recipientOptions;
    return recipientOptions.filter((recipient) => recipient.label.toLowerCase().includes(query));
  }, [recipientOptions, recipientSearch]);

  const selectedRecipients = useMemo(() => {
    const selectedIds = new Set(
      Object.entries(selectedRecipientMap)
        .filter(([, selected]) => selected)
        .map(([id]) => id)
    );
    return recipientOptions.filter((recipient) => selectedIds.has(recipient.id));
  }, [recipientOptions, selectedRecipientMap]);

  const manualPreviewVariables = selectedRecipients[0]?.variables || {
    nombre: "Juan",
    actividad: "Actividad",
    dias: "1",
    total: "$25000",
    fecha: new Date().toLocaleDateString("es-AR"),
    link: "https://pf-control.com",
  };

  const manualPreview = renderTemplate(manualMessage, manualPreviewVariables);

  const loadSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const response = await fetch("/api/whatsapp/schedule", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.message || data?.error || "No se pudieron cargar las programaciones"));
      }
      setSchedules(Array.isArray(data?.schedules) ? (data.schedules as ScheduleItem[]) : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las programaciones");
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoadingConfig(true);
      setErrorMessage("");

      try {
        const response = await fetch("/api/whatsapp/config", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(String(data?.message || data?.error || "No se pudo cargar la configuracion"));
        }

        if (!cancelled && data?.config) {
          setConfig((previous) => ({
            ...previous,
            ...data.config,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar la configuracion de WhatsApp");
        }
      } finally {
        if (!cancelled) {
          setLoadingConfig(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadSchedules();
  }, []);

  useEffect(() => {
    if (!manualMessage) {
      const defaultRule = getRuleDefinition(manualCategory, manualRule);
      if (defaultRule) {
        setManualMessage(defaultRule.defaultValue.message);
      }
    }
  }, [manualCategory, manualRule, manualMessage]);

  const updateRuleConfig = (
    category: CategoryKey,
    ruleKey: RuleKey,
    updater: (current: RuleConfig) => RuleConfig
  ) => {
    setConfig((previous) => {
      const currentRule = previous.categories[category]?.rules?.[ruleKey];
      if (!currentRule) return previous;

      return {
        ...previous,
        categories: {
          ...previous.categories,
          [category]: {
            ...previous.categories[category],
            rules: {
              ...previous.categories[category].rules,
              [ruleKey]: updater(currentRule),
            },
          },
        },
      };
    });
  };

  const insertVariableInRule = (category: CategoryKey, ruleKey: RuleKey, variable: string) => {
    updateRuleConfig(category, ruleKey, (current) => ({
      ...current,
      message: `${current.message}${current.message.endsWith(" ") || !current.message ? "" : " "}{{${variable}}}`,
    }));
  };

  const resetRuleMessage = (category: CategoryKey, ruleKey: RuleKey) => {
    const definition = getRuleDefinition(category, ruleKey);
    if (!definition) return;

    updateRuleConfig(category, ruleKey, (current) => ({
      ...current,
      message: definition.defaultValue.message,
      daysOffset: definition.defaultValue.daysOffset,
      sendFrom: definition.defaultValue.sendFrom,
      sendTo: definition.defaultValue.sendTo,
    }));
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipientMap((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  };

  const bulkSelectByType = (type: RecipientOption["type"], selected: boolean) => {
    setSelectedRecipientMap((previous) => {
      const next = { ...previous };
      recipientOptions
        .filter((recipient) => recipient.type === type)
        .forEach((recipient) => {
          next[recipient.id] = selected;
        });
      return next;
    });
  };

  const insertVariableInManual = (variable: string) => {
    setManualMessage((previous) => `${previous}${previous.endsWith(" ") || !previous ? "" : " "}{{${variable}}}`);
  };

  const persistConfig = async (nextConfig: WhatsAppConfig, successMessageText: string) => {
    setSavingConfig(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/whatsapp/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: nextConfig }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.message || data?.error || "No se pudieron guardar los cambios"));
      }

      if (data?.config) {
        setConfig((previous) => ({ ...previous, ...data.config }));
      }

      setStatusMessage(successMessageText);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron guardar los cambios");
      return false;
    } finally {
      setSavingConfig(false);
    }
  };

  const saveConfig = async () => {
    await persistConfig(config, "Configuracion guardada correctamente.");
  };

  const setConnectionEnabled = async (nextEnabled: boolean) => {
    if (loadingConfig || savingConfig || config.connection.enabled === nextEnabled) {
      return;
    }

    const previousConfig = config;
    const nextConfig: WhatsAppConfig = {
      ...config,
      connection: {
        ...config.connection,
        enabled: nextEnabled,
      },
    };

    setConfig(nextConfig);

    const success = await persistConfig(
      nextConfig,
      nextEnabled ? "Automatizaciones activadas correctamente." : "Automatizaciones pausadas correctamente."
    );

    if (!success) {
      setConfig(previousConfig);
    }
  };

  const postMessage = async (payload: {
    message: string;
    category: CategoryKey;
    rule: RuleKey;
    mode: "manual" | "test" | "automatico";
  }) => {
    if (selectedRecipients.length === 0) {
      throw new Error("Selecciona al menos un destinatario para enviar.");
    }

    const recipientsForSend = selectedRecipients;

    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destinatarios: recipientsForSend.map((recipient) => ({
          id: recipient.id,
          label: recipient.label,
          tipo: recipient.type,
          variables: recipient.variables,
        })),
        mensaje: payload.message,
        tipo: payload.category,
        subcategoria: payload.rule,
        mode: payload.mode,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(data?.message || data?.error || "No se pudo enviar el mensaje"));
    }

    return {
      ...(data as { ok?: boolean; sentCount?: number; failedCount?: number }),
      recipients: recipientsForSend.map((recipient) => recipient.label),
    };
  };

  const handleManualSend = async () => {
    if (!manualMessage.trim()) {
      setErrorMessage("Escribe un mensaje manual antes de enviar.");
      return;
    }

    if (selectedRecipients.length === 0) {
      setErrorMessage("Selecciona al menos un destinatario para el envio manual.");
      return;
    }

    setSendingManual(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const result = await postMessage({
        message: manualMessage,
        category: manualCategory,
        rule: manualRule,
        mode: "manual",
      });

      setStatusMessage(
        `Envio manual completado. Enviados: ${result.sentCount || 0}. Fallidos: ${result.failedCount || 0}.`
      );
      setHistoryReloadToken((previous) => previous + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo enviar el mensaje manual");
    } finally {
      setSendingManual(false);
    }
  };

  const handleRuleTest = async (category: CategoryKey, ruleKey: RuleKey, message: string) => {
    if (!message.trim()) {
      setErrorMessage("La regla no tiene mensaje para probar.");
      return;
    }

    const token = `${category}:${ruleKey}`;
    setTestingRuleKey(token);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const result = await postMessage({
        message,
        category,
        rule: ruleKey,
        mode: "test",
      });

      const recipientsText = Array.isArray((result as { recipients?: string[] }).recipients)
        ? (result as { recipients?: string[] }).recipients?.join(", ")
        : "";
      setStatusMessage(
        `Prueba enviada${recipientsText ? ` a ${recipientsText}` : ""}. Enviados: ${result.sentCount || 0}. Fallidos: ${result.failedCount || 0}.`
      );
      setHistoryReloadToken((previous) => previous + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo enviar la prueba");
    } finally {
      setTestingRuleKey("");
    }
  };

  const handleRuleSimulation = async (category: CategoryKey, ruleKey: RuleKey) => {
    const token = `${category}:${ruleKey}`;
    setSimulatingRuleKey(token);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/whatsapp/automation/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryKey: category, ruleKey, limit: 15 }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.message || data?.error || "No se pudo simular la regla"));
      }

      setSimulationByRule((previous) => ({
        ...previous,
        [token]: {
          categoryKey: data.categoryKey,
          ruleKey: data.ruleKey,
          summary: {
            totalMatched: Number(data?.summary?.totalMatched || 0),
            readyToSendNow: Number(data?.summary?.readyToSendNow || 0),
            blockedByWindow: Number(data?.summary?.blockedByWindow || 0),
          },
          recipients: Array.isArray(data.recipients) ? data.recipients : [],
        },
      }));

      setStatusMessage("Simulacion actualizada para la regla seleccionada.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo simular la regla");
    } finally {
      setSimulatingRuleKey("");
    }
  };

  const handleRunAutomationsNow = async () => {
    setRunningAutomationNow(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/whatsapp/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.message || data?.error || "No se pudieron ejecutar automatizaciones"));
      }

      setStatusMessage(
        `Automatizaciones ejecutadas (${data.runId || "sin runId"}). Reglas: ${data.rulesExecuted || 0}. Enviados: ${data?.totals?.sent || 0}. Fallidos: ${data?.totals?.failed || 0}.`
      );
      setHistoryReloadToken((previous) => previous + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron ejecutar automatizaciones");
    } finally {
      setRunningAutomationNow(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!scheduleName.trim() || !manualMessage.trim() || !scheduleDateTime) {
      setErrorMessage("Completa nombre, fecha/hora y mensaje para programar.");
      return;
    }

    if (selectedRecipients.length === 0) {
      setErrorMessage("Selecciona al menos un destinatario para programar.");
      return;
    }

    setSavingSchedule(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const recipientsPayload = selectedRecipients.map((recipient) => ({
        id: recipient.id,
        label: recipient.label,
        tipo: recipient.type,
        telefono: recipient.phoneNumber || undefined,
        variables: recipient.variables,
      }));

      const fechaIso = new Date(scheduleDateTime).toISOString();

      const response = await fetch("/api/whatsapp/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: scheduleName,
          categoria: manualCategory,
          subcategoria: manualRule,
          mensaje: manualMessage,
          destinatarios: recipientsPayload,
          fecha: fechaIso,
          automatico: scheduleAutomatico,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.message || data?.error || "No se pudo programar el envio"));
      }

      setStatusMessage("Programacion guardada correctamente.");
      setScheduleName("");
      setScheduleDateTime("");
      setScheduleAutomatico(true);
      await loadSchedules();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo programar el envio");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (key: string) => {
    try {
      const response = await fetch("/api/whatsapp/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.message || data?.error || "No se pudo eliminar la programacion"));
      }

      setSchedules((previous) => previous.filter((item) => item.key !== key));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar la programacion");
    }
  };

  const renderRuleCards = (category: CategoryKey) => {
    return RULES_BY_CATEGORY[category].map((rule) => {
      const currentRule = config.categories[category].rules[rule.key];
      const preview = renderTemplate(currentRule.message, manualPreviewVariables);
      const testToken = `${category}:${rule.key}`;
      const simulationToken = `${category}:${rule.key}`;
      const simulation = simulationByRule[simulationToken];

      return (
        <article
          key={rule.key}
          className="rounded-2xl border border-emerald-400/30 bg-slate-950/70 shadow-[0_18px_48px_rgba(2,12,27,0.45)]"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-emerald-600/10 px-4 py-3">
            <div>
              <h3 className="text-base font-extrabold text-emerald-100">{rule.label}</h3>
              <p className="text-xs text-emerald-200/85">{rule.description}</p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <input
                type="checkbox"
                checked={currentRule.enabled}
                onChange={(event) =>
                  updateRuleConfig(category, rule.key, (current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              Activo
            </label>
          </header>

          <div className="space-y-3 px-4 py-4">
            <div className="grid gap-3 md:grid-cols-3">
              {rule.supportsOffset ? (
                <label className="space-y-1 text-xs font-semibold text-slate-300">
                  {rule.offsetLabel}
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={currentRule.daysOffset}
                    onChange={(event) =>
                      updateRuleConfig(category, rule.key, (current) => ({
                        ...current,
                        daysOffset: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                  Regla sin offset de dias.
                </div>
              )}

              <label className="space-y-1 text-xs font-semibold text-slate-300">
                Enviar desde
                <input
                  type="time"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  value={currentRule.sendFrom}
                  onChange={(event) =>
                    updateRuleConfig(category, rule.key, (current) => ({
                      ...current,
                      sendFrom: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="space-y-1 text-xs font-semibold text-slate-300">
                Enviar hasta
                <input
                  type="time"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  value={currentRule.sendTo}
                  onChange={(event) =>
                    updateRuleConfig(category, rule.key, (current) => ({
                      ...current,
                      sendTo: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Mensaje automatico</label>
              <textarea
                className="min-h-[110px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={currentRule.message}
                onChange={(event) =>
                  updateRuleConfig(category, rule.key, (current) => ({
                    ...current,
                    message: event.target.value,
                  }))
                }
              />
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <button
                    key={`${rule.key}-${variable.key}`}
                    type="button"
                    className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-emerald-300/50 hover:text-emerald-100"
                    onClick={() => insertVariableInRule(category, rule.key, variable.key)}
                  >
                    {`{{${variable.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/75 px-3 py-2 text-sm text-slate-200">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Vista previa</p>
              <p className="whitespace-pre-line">{preview}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => resetRuleMessage(category, rule.key)}
                className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-slate-700"
              >
                Mensaje por defecto
              </button>
              <button
                type="button"
                onClick={() => handleRuleTest(category, rule.key, currentRule.message)}
                className="rounded-xl border border-emerald-400/45 bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/30"
                disabled={testingRuleKey === testToken}
              >
                {testingRuleKey === testToken ? "Probando..." : "Probar Mensaje"}
              </button>
              <button
                type="button"
                onClick={() => handleRuleSimulation(category, rule.key)}
                className="rounded-xl border border-cyan-400/45 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25"
                disabled={simulatingRuleKey === simulationToken}
              >
                {simulatingRuleKey === simulationToken ? "Simulando..." : "Simular destinatarios"}
              </button>
            </div>

            {simulation ? (
              <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-3 text-xs text-cyan-100">
                <p className="font-semibold">
                  Simulacion: {simulation.summary.totalMatched} coincidencias · {simulation.summary.readyToSendNow} listas ahora · {simulation.summary.blockedByWindow} fuera de ventana
                </p>
                <div className="mt-2 space-y-1.5">
                  {simulation.recipients.slice(0, 6).map((recipient) => (
                    <div key={`${simulationToken}-${recipient.recipientId}`} className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
                      <p className="font-semibold text-slate-100">
                        {recipient.recipientLabel} <span className="text-slate-400">({recipient.recipientType})</span>
                      </p>
                      <p className="text-slate-300">{recipient.preview}</p>
                      <p className={`mt-1 ${recipient.withinWindow ? "text-emerald-200" : "text-amber-200"}`}>
                        {recipient.withinWindow ? "Dentro de ventana de envio" : "Fuera de ventana de envio"} · {recipient.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </article>
      );
    });
  };

  if ((session?.user as any)?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-5xl rounded-3xl border border-rose-400/35 bg-rose-500/10 p-5 text-sm text-rose-100">
        No autorizado. Esta seccion es solo para ADMIN.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 px-2 pb-8 pt-2 sm:px-4">
      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_22px_70px_rgba(2,12,27,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10">
              <img src="/whatsapp-logo.svg" alt="WhatsApp" className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">Configuracion de WhatsApp</h1>
              <p className="text-sm text-slate-300">
                Administra mensajes automaticos, recordatorios y envios manuales para alumnos y colaboradores.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.04em] ${
                config.connection.enabled
                  ? "border-emerald-300/45 bg-emerald-500/15 text-emerald-100"
                  : "border-amber-300/45 bg-amber-500/15 text-amber-100"
              }`}
            >
              {config.connection.enabled ? "Automatizaciones activas" : "Automatizaciones pausadas"}
            </span>

            <button
              type="button"
              onClick={() => void setConnectionEnabled(!config.connection.enabled)}
              disabled={savingConfig || loadingConfig}
              className={`rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-[0.04em] text-white disabled:opacity-60 ${
                config.connection.enabled
                  ? "border-amber-400/50 bg-amber-600 hover:bg-amber-500"
                  : "border-emerald-400/50 bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {savingConfig
                ? "Guardando..."
                : config.connection.enabled
                  ? "Pausar automatizaciones"
                  : "Reanudar automatizaciones"}
            </button>

            <button
              type="button"
              onClick={saveConfig}
              disabled={savingConfig || loadingConfig}
              className="rounded-xl border border-red-500/40 bg-red-600 px-5 py-2.5 text-sm font-black uppercase tracking-[0.04em] text-white hover:bg-red-500 disabled:opacity-60"
            >
              {savingConfig ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>

        {statusMessage ? (
          <p className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mt-3 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-3">
        <div className="grid gap-2 md:grid-cols-4">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                activeTab === tab.key
                  ? "border-emerald-300/55 bg-emerald-500/15 text-emerald-100"
                  : "border-white/10 bg-slate-900/80 text-slate-300 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-black text-white">Destinatarios</h2>
            <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
              Seleccionados: {selectedRecipients.length}
            </span>
          </div>

          <input
            type="text"
            placeholder="Buscar alumno o colaborador"
            className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={recipientSearch}
            onChange={(event) => setRecipientSearch(event.target.value)}
          />

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => bulkSelectByType("alumno", true)}
              className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-100"
            >
              Marcar alumnos
            </button>
            <button
              type="button"
              onClick={() => bulkSelectByType("colaborador", true)}
              className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-100"
            >
              Marcar colaboradores
            </button>
            <button
              type="button"
              onClick={() => setSelectedRecipientMap({})}
              className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200"
            >
              Limpiar
            </button>
          </div>

          <div className="max-h-[360px] space-y-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-2">
            {filteredRecipients.map((recipient) => (
              <label
                key={recipient.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={Boolean(selectedRecipientMap[recipient.id])}
                  onChange={() => toggleRecipient(recipient.id)}
                />
                <div className="min-w-0">
                  <span className="block truncate text-sm text-slate-100">{recipient.label}</span>
                  <span className={`block truncate text-[10px] ${recipient.phoneNumber ? "text-cyan-200" : "text-amber-300"}`}>
                    {recipient.phoneNumber ? `Tel: ${recipient.phoneNumber}` : "Sin telefono registrado"}
                  </span>
                </div>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-400">
                  {recipient.type}
                </span>
              </label>
            ))}

            {filteredRecipients.length === 0 ? (
              <div className="px-2 py-5 text-center text-sm text-slate-400">
                Sin resultados para la busqueda.
              </div>
            ) : null}
          </div>

          {loadingColaboradores ? (
            <p className="mt-2 text-xs text-slate-400">Cargando colaboradores...</p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <h2 className="mb-3 text-lg font-black text-white">Envio manual</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-slate-300">
              Categoria
              <select
                value={manualCategory}
                onChange={(event) => {
                  const nextCategory = event.target.value as CategoryKey;
                  setManualCategory(nextCategory);
                  const nextRule = RULES_BY_CATEGORY[nextCategory][0]?.key;
                  if (nextRule) {
                    setManualRule(nextRule);
                  }
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {Object.entries({
                  cobranzas: "Cobranzas",
                  asistencia_rutinas: "Asistencia y Rutinas",
                  recordatorios_otros: "Recordatorios y Otros",
                }).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-semibold text-slate-300">
              Subcategoria
              <select
                value={manualRule}
                onChange={(event) => setManualRule(event.target.value as RuleKey)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {RULES_BY_CATEGORY[manualCategory].map((rule) => (
                  <option key={rule.key} value={rule.key}>
                    {rule.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 space-y-2">
            <label className="text-xs font-semibold text-slate-300">Mensaje</label>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={manualMessage}
              onChange={(event) => setManualMessage(event.target.value)}
              placeholder="Escribe o personaliza el mensaje manual"
            />
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map((variable) => (
                <button
                  key={`manual-${variable.key}`}
                  type="button"
                  onClick={() => insertVariableInManual(variable.key)}
                  className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-emerald-300/50 hover:text-emerald-100"
                >
                  {`{{${variable.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/75 px-3 py-2 text-sm text-slate-200">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Vista previa</p>
            <p className="whitespace-pre-line">{manualPreview}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleRuleTest(manualCategory, manualRule, manualMessage)}
              className="rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/25"
              disabled={sendingManual}
            >
              Probar Mensaje
            </button>
            <button
              type="button"
              onClick={handleManualSend}
              className="rounded-xl border border-cyan-400/45 bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/25"
              disabled={sendingManual}
            >
              {sendingManual ? "Enviando..." : "Enviar ahora"}
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3">
            <h3 className="text-sm font-black text-cyan-100">Programar envio (fecha y hora)</h3>
            <p className="mt-1 text-xs text-slate-300">
              Para mensajes puntuales, define fecha/hora y si corre en automatico cuando llegue ese momento.
            </p>

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <label className="space-y-1 text-xs font-semibold text-slate-300 md:col-span-2">
                Nombre de la programacion
                <input
                  type="text"
                  value={scheduleName}
                  onChange={(event) => setScheduleName(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  placeholder="Ej: Recordatorio especial marzo"
                />
              </label>

              <label className="space-y-1 text-xs font-semibold text-slate-300">
                Fecha y hora
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(event) => setScheduleDateTime(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                <input
                  type="checkbox"
                  checked={scheduleAutomatico}
                  onChange={(event) => setScheduleAutomatico(event.target.checked)}
                />
                Ejecutar automatico
              </label>

              <button
                type="button"
                onClick={handleCreateSchedule}
                disabled={savingSchedule}
                className="rounded-xl border border-cyan-400/45 bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60"
              >
                {savingSchedule ? "Programando..." : "Guardar programacion"}
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-2">
              {loadingSchedules ? (
                <p className="text-xs text-slate-400">Cargando programaciones...</p>
              ) : (
                <div className="max-h-52 space-y-1 overflow-auto">
                  {schedules.length === 0 ? (
                    <p className="text-xs text-slate-400">No hay programaciones guardadas.</p>
                  ) : (
                    schedules.map((item) => (
                      <div key={item.key} className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-2 text-xs text-slate-200">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-semibold text-slate-100">{item.value?.nombre || item.key}</p>
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(item.key)}
                            className="rounded-md border border-rose-300/35 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-200"
                          >
                            Eliminar
                          </button>
                        </div>
                        <p className="mt-1 text-slate-300">
                          {item.value?.categoria || "general"} / {item.value?.subcategoria || "programado"} · {item.value?.automatico === false ? "manual" : "automatico"}
                        </p>
                        <p className="text-slate-400">
                          Fecha: {item.value?.fecha ? new Date(item.value.fecha).toLocaleString("es-AR") : "sin fecha"} · Estado: {item.value?.estado || "pendiente"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </article>
      </section>

      {loadingConfig ? (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
          Cargando configuracion de WhatsApp...
        </section>
      ) : null}

      {!loadingConfig && activeTab !== "configuracion" ? (
        <section className="grid gap-4 lg:grid-cols-2">{renderRuleCards(activeTab as CategoryKey)}</section>
      ) : null}

      {!loadingConfig && activeTab === "configuracion" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-emerald-400/30 bg-slate-950/70 p-4">
            <h2 className="text-lg font-black text-emerald-100">Gestion de conexion</h2>
            <p className="mt-1 text-sm text-slate-300">
              Define si la automatizacion de WhatsApp esta activa y actualiza el numero operativo.
            </p>

            <div className="mt-4 space-y-3">
              <label className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                <input
                  type="checkbox"
                  checked={config.connection.enabled}
                  disabled={savingConfig || loadingConfig}
                  onChange={(event) => {
                    void setConnectionEnabled(event.target.checked);
                  }}
                />
                Servicio activo
              </label>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-xs font-semibold text-slate-300 md:col-span-2">
                  Telefono (E164)
                  <input
                    type="text"
                    placeholder="Ej: 2381784549"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={config.connection.phoneNumber}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        connection: {
                          ...previous.connection,
                          phoneNumber: event.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-300">
                  Pais
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={config.connection.countryCode}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        connection: {
                          ...previous.connection,
                          countryCode: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-400/30 bg-slate-950/70 p-4">
            <h2 className="text-lg font-black text-emerald-100">Probar envio de mensaje</h2>
            <p className="mt-1 text-sm text-slate-300">
              Usa los destinatarios seleccionados y valida rapidamente la conexion activa.
            </p>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">
                Si no seleccionas destinatarios, la prueba se envia como test al admin logueado.
              </p>
              <button
                type="button"
                onClick={() => handleRuleTest("recordatorios_otros", "encuesta_fin_semana", "Prueba de conexion WhatsApp desde PF Control")}
                className="mt-3 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/25"
              >
                Probar Mensaje
              </button>
              <button
                type="button"
                onClick={handleRunAutomationsNow}
                className="mt-3 ml-2 rounded-xl border border-cyan-400/45 bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60"
                disabled={runningAutomationNow}
              >
                {runningAutomationNow ? "Ejecutando..." : "Ejecutar automatizaciones ahora"}
              </button>
            </div>
          </article>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
        <WhatsAppAutomationRunsTable reloadToken={historyReloadToken} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
        <WhatsAppHistoryTable reloadToken={historyReloadToken} />
      </section>
    </div>
  );
}
