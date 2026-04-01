"use client";

import { useEffect, useMemo, useState } from "react";
import WhatsAppMessageEditor from "../../../components/whatsapp/WhatsAppMessageEditor";

type TabId = "envio" | "plantillas" | "agenda" | "historial" | "automatizacion" | "config";

type Recipient = {
  id: string;
  label: string;
  tipo: "alumno" | "colaborador";
  telefono: string;
  variables: Record<string, string>;
};

type Template = {
  key: string;
  nombre: string;
  categoria: string;
  mensaje: string;
  createdAt: string;
  updatedAt: string;
};

type Schedule = {
  key: string;
  nombre: string;
  categoria: string;
  mensaje: string;
  destinatarios: string[];
  fecha: string;
  automatico?: boolean;
  estado?: "pendiente" | "enviado" | "parcial" | "error";
  createdAt: string;
  updatedAt: string;
};

type RunRow = {
  key: string;
  runId: string;
  updatedAt?: string;
  dryRun?: boolean;
  categoryKey?: string;
  ruleKey?: string;
  ok?: boolean;
  forcedFailureTest?: boolean;
};

type HistoryRow = {
  id?: string;
  createdAt?: string;
  mensaje?: string;
  total?: number;
  ok?: number;
  failed?: number;
};

type WhatsAppConfig = {
  connection?: {
    enabled?: boolean;
    mode?: string;
  };
  categories?: Record<string, { enabled?: boolean }>;
  updatedAt?: string;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "envio", label: "Envio manual" },
  { id: "plantillas", label: "Plantillas" },
  { id: "agenda", label: "Programacion" },
  { id: "historial", label: "Historial" },
  { id: "automatizacion", label: "Automatizacion" },
  { id: "config", label: "Configuracion" },
];

const DEFAULT_TEMPLATE_FORM = {
  key: "",
  nombre: "",
  categoria: "General",
  mensaje: "",
};

const DEFAULT_SCHEDULE_FORM = {
  key: "",
  nombre: "",
  categoria: "General",
  mensaje: "",
  fecha: "",
  automatico: true,
};

export default function AdminWhatsAppPage() {
  const [activeTab, setActiveTab] = useState<TabId>("envio");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loadingPanel, setLoadingPanel] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [manualMessage, setManualMessage] = useState("Hola {{nombre}}, recorda completar tu seguimiento de hoy.");
  const [sendMode, setSendMode] = useState<"test" | "prod">("test");

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateForm, setTemplateForm] = useState(DEFAULT_TEMPLATE_FORM);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleForm, setScheduleForm] = useState(DEFAULT_SCHEDULE_FORM);
  const [scheduleRecipientIds, setScheduleRecipientIds] = useState<string[]>([]);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [config, setConfig] = useState<WhatsAppConfig>({
    connection: { enabled: true, mode: "test" },
    categories: { cobranzas: { enabled: true }, recordatorios_otros: { enabled: true } },
  });

  const recipientById = useMemo(
    () => new Map(recipients.map((recipient) => [recipient.id, recipient])),
    [recipients]
  );

  const selectedRecipients = useMemo(
    () => selectedRecipientIds.map((id) => recipientById.get(id)).filter(Boolean) as Recipient[],
    [recipientById, selectedRecipientIds]
  );

  const previewVariables = selectedRecipients[0]?.variables || {
    nombre: "Nombre",
    actividad: "entrenamiento",
  };

  const resetFeedback = () => {
    setStatus("");
    setError("");
  };

  const loadAll = async () => {
    setLoadingPanel(true);
    try {
      const [
        recipientsRes,
        templatesRes,
        schedulesRes,
        runsRes,
        historyRes,
        configRes,
      ] = await Promise.all([
        fetch("/api/whatsapp/recipients", { cache: "no-store" }),
        fetch("/api/whatsapp/templates", { cache: "no-store" }),
        fetch("/api/whatsapp/schedule", { cache: "no-store" }),
        fetch("/api/admin/whatsapp-automation-runs", { cache: "no-store" }),
        fetch("/api/admin/whatsapp-history", { cache: "no-store" }),
        fetch("/api/whatsapp/config", { cache: "no-store" }),
      ]);

      const [
        recipientsJson,
        templatesJson,
        schedulesJson,
        runsJson,
        historyJson,
        configJson,
      ] = await Promise.all([
        recipientsRes.json(),
        templatesRes.json(),
        schedulesRes.json(),
        runsRes.json(),
        historyRes.json(),
        configRes.json(),
      ]);

      setRecipients(Array.isArray(recipientsJson?.recipients) ? recipientsJson.recipients : []);
      setTemplates(Array.isArray(templatesJson?.templates) ? templatesJson.templates : []);
      setSchedules(Array.isArray(schedulesJson?.schedules) ? schedulesJson.schedules : []);
      setRuns(Array.isArray(runsJson?.runs) ? runsJson.runs : []);
      setHistory(Array.isArray(historyJson?.history) ? historyJson.history : []);
      setConfig(configJson?.config || config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar panel de WhatsApp");
    } finally {
      setLoadingPanel(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const toggleRecipient = (id: string, setIds: (next: string[]) => void, currentIds: string[]) => {
    if (currentIds.includes(id)) {
      setIds(currentIds.filter((item) => item !== id));
      return;
    }
    setIds([...currentIds, id]);
  };

  const sendManual = async () => {
    resetFeedback();
    if (selectedRecipients.length === 0) {
      setError("Selecciona al menos un destinatario.");
      return;
    }
    if (!manualMessage.trim()) {
      setError("El mensaje no puede estar vacio.");
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatarios: selectedRecipients.map((recipient) => ({
            id: recipient.id,
            label: recipient.label,
            telefono: recipient.telefono,
            variables: recipient.variables,
          })),
          mensaje: manualMessage,
          tipo: "General",
          subcategoria: "manual",
          mode: sendMode,
          forceText: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo enviar mensaje");
      }

      setStatus(`Envio procesado para ${selectedRecipients.length} destinatario(s).`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar mensaje");
    } finally {
      setActionLoading(false);
    }
  };

  const saveTemplate = async () => {
    resetFeedback();
    if (!templateForm.nombre.trim() || !templateForm.mensaje.trim()) {
      setError("Completa nombre y mensaje de plantilla.");
      return;
    }

    try {
      setActionLoading(true);
      const method = templateForm.key ? "PUT" : "POST";
      const response = await fetch("/api/whatsapp/templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar plantilla");
      }

      setTemplateForm(DEFAULT_TEMPLATE_FORM);
      setStatus(templateForm.key ? "Plantilla actualizada" : "Plantilla creada");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar plantilla");
    } finally {
      setActionLoading(false);
    }
  };

  const editTemplate = (template: Template) => {
    setTemplateForm({
      key: template.key,
      nombre: template.nombre,
      categoria: template.categoria,
      mensaje: template.mensaje,
    });
    setActiveTab("plantillas");
  };

  const deleteTemplate = async (key: string) => {
    resetFeedback();
    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo eliminar plantilla");
      }
      setStatus("Plantilla eliminada");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar plantilla");
    } finally {
      setActionLoading(false);
    }
  };

  const saveSchedule = async () => {
    resetFeedback();
    if (!scheduleForm.nombre.trim() || !scheduleForm.mensaje.trim() || !scheduleForm.fecha.trim()) {
      setError("Completa nombre, fecha y mensaje de programacion.");
      return;
    }
    if (scheduleRecipientIds.length === 0) {
      setError("Selecciona al menos un destinatario para la programacion.");
      return;
    }

    const scheduleRecipients = scheduleRecipientIds
      .map((id) => recipientById.get(id)?.telefono || "")
      .filter(Boolean);

    try {
      setActionLoading(true);
      const method = scheduleForm.key ? "PUT" : "POST";
      const response = await fetch("/api/whatsapp/schedule", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scheduleForm,
          destinatarios: scheduleRecipients,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar programacion");
      }

      setScheduleForm(DEFAULT_SCHEDULE_FORM);
      setScheduleRecipientIds([]);
      setStatus(scheduleForm.key ? "Programacion actualizada" : "Programacion creada");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar programacion");
    } finally {
      setActionLoading(false);
    }
  };

  const editSchedule = (schedule: Schedule) => {
    setScheduleForm({
      key: schedule.key,
      nombre: schedule.nombre,
      categoria: schedule.categoria,
      mensaje: schedule.mensaje,
      fecha: schedule.fecha,
      automatico: schedule.automatico !== false,
    });

    const selected = recipients
      .filter((recipient) => schedule.destinatarios.includes(recipient.telefono))
      .map((recipient) => recipient.id);

    setScheduleRecipientIds(selected);
    setActiveTab("agenda");
  };

  const deleteSchedule = async (key: string) => {
    resetFeedback();
    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo eliminar programacion");
      }
      setStatus("Programacion eliminada");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar programacion");
    } finally {
      setActionLoading(false);
    }
  };

  const runAutomation = async (dryRun: boolean) => {
    resetFeedback();
    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          categoryKey: "recordatorios_otros",
          ruleKey: "encuesta_fin_semana",
          forceWindow: true,
          includeDisabled: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo ejecutar automatizacion");
      }
      setStatus(`${dryRun ? "Dry run" : "Run real"} ejecutado: ${data.runId}`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar automatizacion");
    } finally {
      setActionLoading(false);
    }
  };

  const saveConfig = async () => {
    resetFeedback();
    try {
      setActionLoading(true);
      const response = await fetch("/api/whatsapp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar configuracion");
      }
      setStatus("Configuracion guardada");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar configuracion");
    } finally {
      setActionLoading(false);
    }
  };

  const canSendManual = selectedRecipients.length > 0 && manualMessage.trim().length > 0;
  const canSaveTemplate = templateForm.nombre.trim().length > 0 && templateForm.mensaje.trim().length > 0;
  const canSaveSchedule =
    scheduleForm.nombre.trim().length > 0 &&
    scheduleForm.mensaje.trim().length > 0 &&
    scheduleForm.fecha.trim().length > 0 &&
    scheduleRecipientIds.length > 0;

  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-slate-900/70 p-6">
        <h1 className="text-3xl font-black">WhatsApp Admin</h1>
        <p className="mt-2 text-sm text-slate-300">
          Panel completo: envio manual, destinatarios, editor con variables, plantillas, programacion,
          historial y ejecuciones automaticas.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
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
      {loadingPanel ? <p className="mb-3 text-sm text-cyan-200">Cargando datos del panel...</p> : null}

      {activeTab === "envio" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h2 className="text-lg font-bold">Destinatarios (alumnos y colaboradores)</h2>
            <p className="mt-1 text-xs text-slate-400">Selecciona uno o mas destinatarios para envio manual.</p>
            <div className="mt-3 grid max-h-64 gap-2 overflow-auto md:grid-cols-2 xl:grid-cols-3">
              {recipients.length === 0 ? <p className="text-sm text-slate-400">Sin destinatarios con telefono.</p> : null}
              {recipients.map((recipient) => {
                const selected = selectedRecipientIds.includes(recipient.id);
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
                      onChange={() =>
                        toggleRecipient(recipient.id, setSelectedRecipientIds, selectedRecipientIds)
                      }
                      className="mr-2"
                    />
                    <p className="font-semibold">{recipient.label}</p>
                    <p className="text-[11px] opacity-80">{recipient.telefono}</p>
                    <p className="text-[11px] opacity-80">{recipient.tipo}</p>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setSendMode("test")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  sendMode === "test"
                    ? "bg-cyan-500/25 text-cyan-100"
                    : "bg-slate-800/70 text-slate-300"
                }`}
              >
                Modo test
              </button>
              <button
                type="button"
                onClick={() => setSendMode("prod")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  sendMode === "prod"
                    ? "bg-amber-500/25 text-amber-100"
                    : "bg-slate-800/70 text-slate-300"
                }`}
              >
                Modo produccion
              </button>
            </div>

            <WhatsAppMessageEditor
              title="Editor de mensaje WhatsApp"
              value={manualMessage}
              onChange={setManualMessage}
              variables={previewVariables}
              disabled={actionLoading}
            />

            <button
              type="button"
              onClick={sendManual}
              disabled={!canSendManual || actionLoading}
              className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading ? "Procesando..." : "Enviar mensaje manual"}
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === "plantillas" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h2 className="text-lg font-bold">CRUD de plantillas</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={templateForm.nombre}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, nombre: event.target.value }))}
                placeholder="Nombre plantilla"
                className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                value={templateForm.categoria}
                onChange={(event) =>
                  setTemplateForm((prev) => ({ ...prev, categoria: event.target.value }))
                }
                placeholder="Categoria"
                className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-3">
              <WhatsAppMessageEditor
                title="Mensaje de plantilla"
                value={templateForm.mensaje}
                onChange={(value) => setTemplateForm((prev) => ({ ...prev, mensaje: value }))}
                variables={previewVariables}
                disabled={actionLoading}
              />
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={saveTemplate}
                disabled={!canSaveTemplate || actionLoading}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? "Guardando..." : templateForm.key ? "Actualizar plantilla" : "Crear plantilla"}
              </button>
              {templateForm.key ? (
                <button
                  type="button"
                  onClick={() => setTemplateForm(DEFAULT_TEMPLATE_FORM)}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
                >
                  Cancelar edicion
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h3 className="text-sm font-bold text-slate-100">Plantillas ({templates.length})</h3>
            <div className="mt-3 space-y-2">
              {templates.length === 0 ? <p className="text-sm text-slate-400">Sin plantillas.</p> : null}
              {templates.map((template) => (
                <article
                  key={template.key}
                  className="rounded-lg border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-300"
                >
                  <p className="font-semibold text-slate-100">{template.nombre}</p>
                  <p>{template.categoria}</p>
                  <p className="mt-1">{template.mensaje}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => editTemplate(template)}
                      className="rounded-md bg-cyan-500/20 px-2 py-1 text-cyan-100"
                    >
                      Cargar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(template.key)}
                      className="rounded-md bg-rose-500/20 px-2 py-1 text-rose-100"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "agenda" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h2 className="text-lg font-bold">Programacion automatica</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={scheduleForm.nombre}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, nombre: event.target.value }))}
                placeholder="Nombre"
                className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                value={scheduleForm.categoria}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, categoria: event.target.value }))
                }
                placeholder="Categoria"
                className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={scheduleForm.fecha}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, fecha: event.target.value }))}
                className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-3">
              <WhatsAppMessageEditor
                title="Mensaje programado"
                value={scheduleForm.mensaje}
                onChange={(value) => setScheduleForm((prev) => ({ ...prev, mensaje: value }))}
                variables={previewVariables}
                disabled={actionLoading}
              />
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-slate-800/50 p-3">
              <p className="text-xs font-semibold text-slate-200">Destinatarios de la programacion</p>
              <div className="mt-2 grid max-h-56 gap-2 overflow-auto md:grid-cols-2 xl:grid-cols-3">
                {recipients.map((recipient) => {
                  const selected = scheduleRecipientIds.includes(recipient.id);
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
                        onChange={() =>
                          toggleRecipient(recipient.id, setScheduleRecipientIds, scheduleRecipientIds)
                        }
                        className="mr-2"
                      />
                      <p className="font-semibold">{recipient.label}</p>
                      <p className="text-[11px] opacity-80">{recipient.telefono}</p>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={saveSchedule}
                disabled={!canSaveSchedule || actionLoading}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading
                  ? "Guardando..."
                  : scheduleForm.key
                  ? "Actualizar programacion"
                  : "Crear programacion"}
              </button>
              {scheduleForm.key ? (
                <button
                  type="button"
                  onClick={() => {
                    setScheduleForm(DEFAULT_SCHEDULE_FORM);
                    setScheduleRecipientIds([]);
                  }}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
                >
                  Cancelar edicion
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h3 className="text-sm font-bold text-slate-100">Programaciones ({schedules.length})</h3>
            <div className="mt-3 space-y-2">
              {schedules.length === 0 ? <p className="text-sm text-slate-400">Sin programaciones.</p> : null}
              {schedules.map((schedule) => (
                <article
                  key={schedule.key}
                  className="rounded-lg border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-300"
                >
                  <p className="font-semibold text-slate-100">{schedule.nombre}</p>
                  <p>{schedule.categoria}</p>
                  <p>{schedule.fecha}</p>
                  <p>Destinatarios: {schedule.destinatarios.length}</p>
                  <p>Estado: {schedule.estado || "pendiente"}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => editSchedule(schedule)}
                      className="rounded-md bg-cyan-500/20 px-2 py-1 text-cyan-100"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSchedule(schedule.key)}
                      className="rounded-md bg-rose-500/20 px-2 py-1 text-rose-100"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "historial" ? (
        <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
          <h2 className="text-lg font-bold">Historial de mensajes enviados</h2>
          <div className="mt-3 overflow-x-auto">
            {history.length === 0 ? <p className="text-sm text-slate-400">Sin historial.</p> : null}
            {history.length > 0 ? (
              <table className="min-w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-white/15 text-slate-200">
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">Mensaje</th>
                    <th className="px-2 py-2">Total</th>
                    <th className="px-2 py-2">OK</th>
                    <th className="px-2 py-2">Fallidos</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, index) => (
                    <tr key={row.id || index} className="border-b border-white/5">
                      <td className="px-2 py-2 font-semibold text-slate-100">{row.createdAt || "sin fecha"}</td>
                      <td className="px-2 py-2">{row.mensaje || "(sin mensaje)"}</td>
                      <td className="px-2 py-2">{row.total ?? 0}</td>
                      <td className="px-2 py-2">{row.ok ?? 0}</td>
                      <td className="px-2 py-2">{row.failed ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "automatizacion" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h2 className="text-lg font-bold">Ejecucion automatica</h2>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => runAutomation(true)}
                disabled={actionLoading}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ejecutar dry run
              </button>
              <button
                type="button"
                onClick={() => runAutomation(false)}
                disabled={actionLoading}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ejecutar real
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
            <h3 className="text-sm font-bold text-slate-100">Ultimas ejecuciones ({runs.length})</h3>
            <div className="mt-3 space-y-2">
              {runs.length === 0 ? <p className="text-sm text-slate-400">Sin ejecuciones.</p> : null}
              {runs.map((run) => (
                <article
                  key={run.runId}
                  className="rounded-lg border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-300"
                >
                  <p className="font-semibold text-slate-100">{run.runId}</p>
                  <p>{run.updatedAt || "sin fecha"}</p>
                  <p>
                    {run.categoryKey || "general"} · {run.ruleKey || "regla"} · {run.dryRun ? "dry" : "real"}
                  </p>
                  <p>
                    ok={String(run.ok)}
                    {run.forcedFailureTest ? " · forcedFailureTest" : ""}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "config" ? (
        <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
          <h2 className="text-lg font-bold">Configuracion</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="rounded-lg border border-white/10 bg-slate-800/50 p-3 text-sm">
              <input
                type="checkbox"
                checked={config.connection?.enabled !== false}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    connection: {
                      ...(prev.connection || {}),
                      enabled: event.target.checked,
                    },
                  }))
                }
                className="mr-2"
              />
              Conexion habilitada
            </label>

            <label className="text-sm text-slate-300">
              Modo
              <select
                value={String(config.connection?.mode || "test")}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    connection: {
                      ...(prev.connection || {}),
                      mode: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2"
              >
                <option value="test">test</option>
                <option value="prod">prod</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={saveConfig}
            disabled={actionLoading}
            className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionLoading ? "Guardando..." : "Guardar configuracion"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
