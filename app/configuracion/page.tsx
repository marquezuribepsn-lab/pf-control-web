"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import {
  SIDEBAR_WIDGET_OPTIONS,
  SIDEBAR_WIDGET_DEFAULT_TRANSITION_MS,
  normalizeSidebarWidgetSettings,
  readSidebarWidgetSettingsFromStorage,
  writeSidebarWidgetSettingsToStorage,
} from "@/lib/sidebarWidget";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const SCREEN_SCALE_KEY = "pf-control-screen-scale-v1";
const SCREEN_EDIT_MODE_KEY = "pf-control-screen-edit-mode-v1";
const NOTIFICATIONS_ENABLED_KEY = "pf-control-notifications-enabled-v1";
const NAV_CONFIG_KEY = "pf-control-nav-config-v1";
const SIDEBAR_IMAGE_KEY = "pf-control-sidebar-image-v1";
const HOME_EDIT_MODE_KEY = "pf-control-home-edit-mode-v1";
const DOCK_LABEL_MODE_KEY = "pf-control-dock-label-mode-v1";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.35;

type DockLabelMode = "full" | "compact" | "icon";

function clampScale(value: number): number {
  if (value < MIN_SCALE) return MIN_SCALE;
  if (value > MAX_SCALE) return MAX_SCALE;
  return Number(value.toFixed(2));
}

function normalizeDockLabelMode(value: string | null): DockLabelMode {
  if (value === "full" || value === "compact" || value === "icon") {
    return value;
  }
  return "compact";
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [savedScale, setSavedScale] = useState(1);
  const [draftScale, setDraftScale] = useState(1);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [sidebarImage, setSidebarImage] = useState<string | null>(null);
  const [dockLabelMode, setDockLabelMode] = useState<DockLabelMode>("compact");
  const [widgetTransitionMs, setWidgetTransitionMs] = useState(SIDEBAR_WIDGET_DEFAULT_TRANSITION_MS);
  const [widgetSelectedCards, setWidgetSelectedCards] = useState<string[]>(
    SIDEBAR_WIDGET_OPTIONS.map((option) => option.id)
  );

  useEffect(() => {
    const nextScale = clampScale(Number(localStorage.getItem(SCREEN_SCALE_KEY) || "1"));
    const nextEditMode = localStorage.getItem(SCREEN_EDIT_MODE_KEY) === "1";
    const nextNotifications = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === "1";
    const nextSidebarImage = localStorage.getItem(SIDEBAR_IMAGE_KEY);
    const nextDockLabelMode = normalizeDockLabelMode(localStorage.getItem(DOCK_LABEL_MODE_KEY));

    setSavedScale(nextScale);
    setDraftScale(nextScale);
    setEditMode(nextEditMode);
    setNotificationsEnabled(nextNotifications);
    setSidebarImage(nextSidebarImage);
    setDockLabelMode(nextDockLabelMode);

    const widgetSettings = readSidebarWidgetSettingsFromStorage();
    setWidgetTransitionMs(widgetSettings.transitionMs);
    setWidgetSelectedCards(widgetSettings.selectedCards);

    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    const initPush = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushSupported(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/pf-sw.js");
        const sub = await registration.pushManager.getSubscription();
        setPushSupported(true);
        setPushSubscribed(Boolean(sub));
      } catch {
        setPushSupported(false);
      }
    };

    void initPush();
  }, []);

  const scalePercent = useMemo(() => Math.round(draftScale * 100), [draftScale]);
  const widgetTransitionSeconds = useMemo(
    () => Math.max(2, Math.round(widgetTransitionMs / 1000)),
    [widgetTransitionMs]
  );

  const applyWidgetSettings = (nextTransitionMs: number, nextSelectedCards: string[]) => {
    const normalized = normalizeSidebarWidgetSettings({
      transitionMs: nextTransitionMs,
      selectedCards: nextSelectedCards,
    });
    setWidgetTransitionMs(normalized.transitionMs);
    setWidgetSelectedCards(normalized.selectedCards);
    writeSidebarWidgetSettingsToStorage(normalized);
  };

  const onWidgetTransitionChange = (seconds: number) => {
    applyWidgetSettings(seconds * 1000, widgetSelectedCards);
  };

  const toggleWidgetOption = (id: string) => {
    const alreadySelected = widgetSelectedCards.includes(id);
    if (alreadySelected && widgetSelectedCards.length === 1) {
      return;
    }

    const nextSelected = alreadySelected
      ? widgetSelectedCards.filter((value) => value !== id)
      : [...widgetSelectedCards, id];

    applyWidgetSettings(widgetTransitionMs, nextSelected);
  };

  const activarModificacion = () => {
    setEditMode(true);
    localStorage.setItem(SCREEN_EDIT_MODE_KEY, "1");
  };

  const cancelarModificacion = () => {
    setDraftScale(savedScale);
    setEditMode(false);
    localStorage.removeItem(SCREEN_EDIT_MODE_KEY);
  };

  const guardarPantalla = () => {
    const nextScale = clampScale(draftScale);
    localStorage.setItem(SCREEN_SCALE_KEY, String(nextScale));
    localStorage.removeItem(SCREEN_EDIT_MODE_KEY);
    setSavedScale(nextScale);
    setDraftScale(nextScale);
    setEditMode(false);
    window.dispatchEvent(new Event("pf-screen-scale-updated"));
  };

  const resetPantalla = () => {
    setDraftScale(1);
    localStorage.setItem(SCREEN_SCALE_KEY, "1");
    setSavedScale(1);
    window.dispatchEvent(new Event("pf-screen-scale-updated"));
  };

  const solicitarPermisoNotificaciones = async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === "granted") {
      new Notification("PF Control", {
        body: "Notificaciones activadas. Te avisaremos cada cambio guardado.",
      });
    }
  };

  const abrirEditorInicio = () => {
    localStorage.setItem(HOME_EDIT_MODE_KEY, "1");
    window.dispatchEvent(new Event("pf-home-edit-toggle"));
    router.push("/");
  };

  const resetearMenu = () => {
    localStorage.removeItem(NAV_CONFIG_KEY);
    window.dispatchEvent(new Event("pf-nav-config-updated"));
  };

  const handleSidebarImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) {
        return;
      }
      setSidebarImage(result);
      localStorage.setItem(SIDEBAR_IMAGE_KEY, result);
      window.dispatchEvent(new Event("pf-sidebar-image-updated"));
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  };

  const removeSidebarImage = () => {
    setSidebarImage(null);
    localStorage.removeItem(SIDEBAR_IMAGE_KEY);
    window.dispatchEvent(new Event("pf-sidebar-image-updated"));
  };

  const cambiarModoEtiquetasDock = (mode: DockLabelMode) => {
    setDockLabelMode(mode);
    localStorage.setItem(DOCK_LABEL_MODE_KEY, mode);
    window.dispatchEvent(new Event("pf-dock-label-mode-updated"));
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  };

  const activarPushRemoto = async () => {
    if (!pushSupported || !VAPID_PUBLIC_KEY) {
      return;
    }

    setPushLoading(true);
    try {
      let nextPermission = permission;
      if (permission !== "granted" && "Notification" in window) {
        nextPermission = await Notification.requestPermission();
        setPermission(nextPermission);
      }

      if (nextPermission !== "granted") {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setPushSubscribed(true);
    } finally {
      setPushLoading(false);
    }
  };

  const desactivarPushRemoto = async () => {
    if (!pushSupported) {
      return;
    }

    setPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setPushSubscribed(false);
        return;
      }

      await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      await subscription.unsubscribe();
      setPushSubscribed(false);
    } finally {
      setPushLoading(false);
    }
  };

  const enviarPruebaPush = async () => {
    await fetch("/api/notifications/test", { method: "POST" });
  };

  const cambiarNotificaciones = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? "1" : "0");
  };

  if (!loaded) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <p className="text-sm text-slate-300">Cargando configuracion...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6 text-slate-100">
      <div className="mb-6">
        <h1 className="text-3xl font-black">Configuracion</h1>
        <p className="mt-1 text-sm text-slate-300">
          Ajusta el tamano visual de toda la app y activa notificaciones tipo push del navegador.
        </p>
      </div>

      <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Panel general</h2>
        <p className="mt-1 text-sm text-slate-300">
          Opciones generales que antes estaban en la configuracion inferior del sidebar.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[auto_auto_auto] md:items-center">
          <ReliableActionButton
            type="button"
            onClick={abrirEditorInicio}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
          >
            Editar inicio
          </ReliableActionButton>

          <ReliableActionButton
            type="button"
            onClick={resetearMenu}
            className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white"
          >
            Reset menu lateral
          </ReliableActionButton>

          <label className="cursor-pointer rounded-xl border border-cyan-300/45 px-4 py-2 text-center text-sm font-semibold text-cyan-100">
            Cambiar imagen sidebar
            <input
              type="file"
              accept="image/*"
              onChange={handleSidebarImageChange}
              className="hidden"
            />
          </label>
        </div>

        {sidebarImage ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <img src={sidebarImage} alt="Sidebar" className="h-14 w-14 rounded-lg object-cover" />
            <ReliableActionButton
              type="button"
              onClick={removeSidebarImage}
              className="rounded-lg border border-rose-300/45 px-3 py-1.5 text-xs font-semibold text-rose-100"
            >
              Quitar imagen
            </ReliableActionButton>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-3">
          <p className="text-sm font-semibold text-slate-100">Dock inferior</p>
          <p className="mt-1 text-xs text-slate-400">
            Controla como se muestran los nombres de los botones para evitar que el dock quede demasiado ancho.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="dock-label-mode" className="text-xs font-semibold text-slate-200">
              Etiquetas del dock
            </label>
            <select
              id="dock-label-mode"
              value={dockLabelMode}
              onChange={(event) => cambiarModoEtiquetasDock(event.target.value as DockLabelMode)}
              className="rounded-lg border border-white/25 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100"
            >
              <option value="compact">Compactas</option>
              <option value="full">Completas</option>
              <option value="icon">Solo iconos</option>
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-cyan-300/25 bg-slate-950/65 p-3">
          <p className="text-sm font-semibold text-cyan-100">Widget rotativo del sidebar</p>
          <p className="mt-1 text-xs text-slate-400">
            Configura el carrusel de indicadores operativos que aparece abajo del menu lateral.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <label className="text-xs font-semibold text-slate-200">
                Tiempo de transicion: {widgetTransitionSeconds}s
              </label>
              <input
                type="range"
                min={2}
                max={20}
                step={1}
                value={widgetTransitionSeconds}
                onChange={(event) => onWidgetTransitionChange(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </div>
            <div className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-xs text-slate-300">
              {widgetSelectedCards.length} seleccionados
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SIDEBAR_WIDGET_OPTIONS.map((option) => {
              const checked = widgetSelectedCards.includes(option.id);
              return (
                <label
                  key={option.id}
                  className="flex items-start gap-2 rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleWidgetOption(option.id)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-100">
                      {option.icon} {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Debe quedar al menos una opcion marcada.
          </p>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Pantalla</h2>
        <p className="mt-1 text-sm text-slate-300">
          Solo puedes cambiar el tamano cuando activas &quot;Modificar pantalla&quot;.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Escala global: {scalePercent}%
            </label>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={draftScale}
              disabled={!editMode}
              onChange={(e) => setDraftScale(clampScale(Number(e.target.value)))}
              className="w-full"
            />
            <p className="mt-2 text-xs text-slate-400">
              Valor guardado: {Math.round(savedScale * 100)}%
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!editMode ? (
              <ReliableActionButton
                type="button"
                onClick={activarModificacion}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
              >
                Modificar pantalla
              </ReliableActionButton>
            ) : (
              <>
                <ReliableActionButton
                  type="button"
                  onClick={guardarPantalla}
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
                >
                  Guardar cambios
                </ReliableActionButton>
                <ReliableActionButton
                  type="button"
                  onClick={cancelarModificacion}
                  className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white"
                >
                  Cancelar
                </ReliableActionButton>
              </>
            )}
            <ReliableActionButton
              type="button"
              onClick={resetPantalla}
              className="rounded-xl border border-rose-300/45 px-4 py-2 text-sm font-semibold text-rose-100"
            >
              Reset 100%
            </ReliableActionButton>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 shadow-lg">
        <h2 className="text-xl font-bold">Notificaciones</h2>
        <p className="mt-1 text-sm text-slate-300">
          Al activarlas, cada cambio guardado en la app dispara una notificacion del sistema.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => cambiarNotificaciones(e.target.checked)}
            />
            Activar notificaciones de cambios
          </label>

          <ReliableActionButton
            type="button"
            onClick={solicitarPermisoNotificaciones}
            className="rounded-xl border border-cyan-300/45 px-4 py-2 text-sm font-semibold text-cyan-100"
          >
            Permitir notificaciones
          </ReliableActionButton>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Estado del permiso: {permission === "unsupported" ? "No soportado" : permission}
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-sm font-semibold text-slate-100">Push remoto (tipo sistema)</p>
          <p className="mt-1 text-xs text-slate-400">
            Requiere HTTPS y VAPID configurado. Si lo activas, recibes aviso cuando se guarda cualquier cambio.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <ReliableActionButton
              type="button"
              disabled={!pushSupported || !VAPID_PUBLIC_KEY || pushLoading}
              onClick={activarPushRemoto}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Activar push remoto
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              disabled={!pushSupported || pushLoading}
              onClick={desactivarPushRemoto}
              className="rounded-xl border border-rose-300/45 px-4 py-2 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Desactivar push
            </ReliableActionButton>
            <ReliableActionButton
              type="button"
              disabled={!pushSubscribed}
              onClick={enviarPruebaPush}
              className="rounded-xl border border-emerald-300/45 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enviar prueba
            </ReliableActionButton>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Estado push: {pushSupported ? (pushSubscribed ? "Suscripto" : "No suscripto") : "No soportado"}
          </p>
          {!VAPID_PUBLIC_KEY ? (
            <p className="mt-1 text-xs text-amber-300">
              Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en variables de entorno.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
