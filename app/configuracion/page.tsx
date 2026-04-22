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
const SCREEN_SCALE_EVENT = "pf-screen-scale-updated";
const NOTIFICATIONS_ENABLED_KEY = "pf-control-notifications-enabled-v1";
const NAV_CONFIG_KEY = "pf-control-nav-config-v1";
const SIDEBAR_IMAGE_KEY = "pf-control-sidebar-image-v1";
const HOME_EDIT_MODE_KEY = "pf-control-home-edit-mode-v1";
const DOCK_LABEL_MODE_KEY = "pf-control-dock-label-mode-v1";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const MAX_PROFILE_IMAGE_DATA_URL_LENGTH = 850_000;
const PROFILE_IMAGE_MAX_DIMENSION = 720;
const PROFILE_IMAGE_MIN_DIMENSION = 220;

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

function applyScreenScalePreview(value: number) {
  if (typeof document === "undefined") {
    return;
  }

  if (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches) {
    document.documentElement.style.setProperty("--pf-screen-scale", "1");
    return;
  }

  document.documentElement.style.setProperty("--pf-screen-scale", String(clampScale(value)));
}

function emitInlineToast(type: "success" | "error" | "warning", message: string, title?: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("pf-inline-toast", {
      detail: { type, message, title },
    })
  );
}

function emitSidebarImageUpdated(forceClear = false) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("pf-sidebar-image-updated", {
      detail: { forceClear },
    })
  );
}
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("No se pudo leer la imagen seleccionada"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la imagen seleccionada"));
    image.src = dataUrl;
  });
}

async function optimizeProfileImage(file: File): Promise<string> {
  const originalDataUrl = await readFileAsDataUrl(file);
  if (originalDataUrl.length <= MAX_PROFILE_IMAGE_DATA_URL_LENGTH) {
    return originalDataUrl;
  }

  const image = await loadImageFromDataUrl(originalDataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo preparar la imagen para guardar");
  }

  let width = image.naturalWidth;
  let height = image.naturalHeight;
  const maxSide = Math.max(width, height);

  if (maxSide > PROFILE_IMAGE_MAX_DIMENSION) {
    const ratio = PROFILE_IMAGE_MAX_DIMENSION / maxSide;
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  let quality = 0.88;
  let attempts = 0;

  while (attempts < 12) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const optimized = canvas.toDataURL("image/jpeg", quality);
    if (optimized.length <= MAX_PROFILE_IMAGE_DATA_URL_LENGTH) {
      return optimized;
    }

    if (quality > 0.46) {
      quality = Math.max(0.42, Number((quality - 0.08).toFixed(2)));
    } else {
      const nextWidth = Math.max(PROFILE_IMAGE_MIN_DIMENSION, Math.round(width * 0.85));
      const nextHeight = Math.max(PROFILE_IMAGE_MIN_DIMENSION, Math.round(height * 0.85));

      if (nextWidth === width && nextHeight === height) {
        break;
      }

      width = nextWidth;
      height = nextHeight;
      quality = 0.78;
    }

    attempts += 1;
  }

  throw new Error("La imagen es demasiado pesada. Prueba con una mas liviana");
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
  const [sidebarImageDraft, setSidebarImageDraft] = useState<string | null>(null);
  const [savingSidebarImage, setSavingSidebarImage] = useState(false);
  const [sidebarImageError, setSidebarImageError] = useState<string | null>(null);
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
    setSidebarImageDraft(nextSidebarImage);
    setDockLabelMode(nextDockLabelMode);
    applyScreenScalePreview(nextScale);

    const widgetSettings = readSidebarWidgetSettingsFromStorage();
    setWidgetTransitionMs(widgetSettings.transitionMs);
    setWidgetSelectedCards(widgetSettings.selectedCards);

    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }

    void (async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const remoteImage =
          typeof data?.sidebarImage === "string" && data.sidebarImage.trim().length > 0
            ? data.sidebarImage
            : null;

        setSidebarImage(remoteImage);
        setSidebarImageDraft(remoteImage);

        if (remoteImage) {
          localStorage.setItem(SIDEBAR_IMAGE_KEY, remoteImage);
        }

        emitSidebarImageUpdated(false);
      } catch {
        // no bloquear configuracion si falla la sincronizacion remota
      }
    })();

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

  const sidebarImageDirty = sidebarImageDraft !== sidebarImage;

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
    applyScreenScalePreview(savedScale);
    setEditMode(false);
    localStorage.removeItem(SCREEN_EDIT_MODE_KEY);
  };

  const guardarPantalla = () => {
    const nextScale = clampScale(draftScale);
    localStorage.setItem(SCREEN_SCALE_KEY, String(nextScale));
    localStorage.removeItem(SCREEN_EDIT_MODE_KEY);
    setSavedScale(nextScale);
    setDraftScale(nextScale);
    applyScreenScalePreview(nextScale);
    setEditMode(false);
    window.dispatchEvent(new Event(SCREEN_SCALE_EVENT));
    emitInlineToast("success", "Escala de pantalla guardada correctamente");
  };

  const resetPantalla = () => {
    setDraftScale(1);
    localStorage.setItem(SCREEN_SCALE_KEY, "1");
    setSavedScale(1);
    applyScreenScalePreview(1);
    window.dispatchEvent(new Event(SCREEN_SCALE_EVENT));
    emitInlineToast("success", "Escala de pantalla reseteada al 100%");
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
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      const message = "Selecciona un archivo de imagen valido";
      setSidebarImageError(message);
      emitInlineToast("error", message, "Error");
      return;
    }

    setSidebarImageError(null);

    void (async () => {
      try {
        const optimized = await optimizeProfileImage(file);
        setSidebarImageDraft(optimized);
        emitInlineToast("success", "Imagen lista. Presiona Guardar cambios");
      } catch (processError) {
        const message = processError instanceof Error
          ? processError.message
          : "No se pudo preparar la imagen de perfil";
        setSidebarImageError(message);
        emitInlineToast("error", message, "Error");
      }
    })();
  };

  const removeSidebarImage = () => {
    setSidebarImageDraft(null);
    setSidebarImageError(null);
  };

  const revertSidebarImageDraft = () => {
    setSidebarImageDraft(sidebarImage);
    setSidebarImageError(null);
  };

  const guardarSidebarImage = async () => {
    setSavingSidebarImage(true);
    setSidebarImageError(null);

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sidebarImage: sidebarImageDraft }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "No se pudo guardar la foto de perfil");
      }

      const persistedImage =
        typeof data?.user?.sidebarImage === "string" && data.user.sidebarImage.trim().length > 0
          ? data.user.sidebarImage
          : null;

      setSidebarImage(persistedImage);
      setSidebarImageDraft(persistedImage);

      if (persistedImage) {
        localStorage.setItem(SIDEBAR_IMAGE_KEY, persistedImage);
      } else {
        localStorage.removeItem(SIDEBAR_IMAGE_KEY);
      }

      emitSidebarImageUpdated(!persistedImage);
      emitInlineToast("success", data?.message || "Foto de perfil guardada correctamente");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "No se pudo guardar la foto de perfil";
      setSidebarImageError(message);
      emitInlineToast("error", message, "Error");
    } finally {
      setSavingSidebarImage(false);
    }
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

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-3">
          <div className="flex items-center gap-3">
            {sidebarImageDraft ? (
              <img src={sidebarImageDraft} alt="Sidebar" className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/15 bg-slate-800 text-xs text-slate-300">
                Sin foto
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <ReliableActionButton
                type="button"
                onClick={removeSidebarImage}
                disabled={savingSidebarImage || !sidebarImageDraft}
                className="rounded-lg border border-rose-300/45 px-3 py-1.5 text-xs font-semibold text-rose-100"
              >
                Quitar
              </ReliableActionButton>
              <ReliableActionButton
                type="button"
                onClick={guardarSidebarImage}
                disabled={!sidebarImageDirty || savingSidebarImage}
                className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingSidebarImage ? "Guardando..." : "Guardar cambios"}
              </ReliableActionButton>
              {sidebarImageDirty ? (
                <ReliableActionButton
                  type="button"
                  onClick={revertSidebarImageDraft}
                  disabled={savingSidebarImage}
                  className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Revertir
                </ReliableActionButton>
              ) : null}
            </div>
          </div>

          {!sidebarImageDraft ? (
            <p className="mt-2 text-xs text-slate-300">Todavia no tienes foto de perfil cargada.</p>
          ) : null}
        </div>

        {sidebarImageDirty ? (
          <p className="mt-2 text-xs text-amber-200">Hay cambios de foto pendientes de guardar.</p>
        ) : null}

        {sidebarImageError ? (
          <p className="mt-2 text-xs text-rose-200">{sidebarImageError}</p>
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
              onChange={(e) => {
                const nextScale = clampScale(Number(e.target.value));
                setDraftScale(nextScale);

                if (editMode) {
                  applyScreenScalePreview(nextScale);
                }
              }}
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
