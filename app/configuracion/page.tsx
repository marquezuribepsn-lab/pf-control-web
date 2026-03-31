"use client";

import { useEffect, useMemo, useState } from "react";

const SCREEN_SCALE_KEY = "pf-control-screen-scale-v1";
const SCREEN_EDIT_MODE_KEY = "pf-control-screen-edit-mode-v1";
const NOTIFICATIONS_ENABLED_KEY = "pf-control-notifications-enabled-v1";
const NAV_CONFIG_KEY = "pf-control-nav-config-v1";
const SIDEBAR_IMAGE_KEY = "pf-control-sidebar-image-v1";
const SIDEBAR_IMAGE_PENDING_SYNC_KEY = "pf-control-sidebar-image-pending-sync-v1";
const HOME_EDIT_MODE_KEY = "pf-control-home-edit-mode-v1";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const SW_VERSION = "20260331-2";
const SW_URL = `/pf-sw.js?v=${SW_VERSION}`;

const SIDEBAR_IMAGE_MAX_EDGE = 960;
const SIDEBAR_IMAGE_TARGET_BYTES = 360 * 1024;
const SIDEBAR_IMAGE_MAX_DATA_URL_LENGTH = 900_000;

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.35;

function clampScale(value: number): number {
  if (value < MIN_SCALE) return MIN_SCALE;
  if (value > MAX_SCALE) return MAX_SCALE;
  return Number(value.toFixed(2));
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return 0;
  const base64Length = dataUrl.length - commaIndex - 1;
  return Math.ceil((base64Length * 3) / 4);
}

function loadImageFromObjectUrl(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    image.src = objectUrl;
  });
}

async function optimizeSidebarImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight) || 1;
    const scale = Math.min(1, SIDEBAR_IMAGE_MAX_EDGE / longestSide);

    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));
    let quality = 0.82;

    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");

    if (!context) {
      throw new Error("No se pudo preparar el compresor de imagen");
    }

    const render = (q: number) => {
      canvas.width = width;
      canvas.height = height;
      context = canvas.getContext("2d");
      if (!context) {
        throw new Error("No se pudo renderizar la imagen");
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", q);
    };

    let dataUrl = render(quality);

    while (
      (estimateDataUrlBytes(dataUrl) > SIDEBAR_IMAGE_TARGET_BYTES ||
        dataUrl.length > SIDEBAR_IMAGE_MAX_DATA_URL_LENGTH) &&
      quality > 0.5
    ) {
      quality = Number((quality - 0.08).toFixed(2));
      dataUrl = render(quality);
    }

    while (dataUrl.length > SIDEBAR_IMAGE_MAX_DATA_URL_LENGTH && width > 320 && height > 320) {
      width = Math.max(320, Math.round(width * 0.85));
      height = Math.max(320, Math.round(height * 0.85));
      dataUrl = render(Math.max(quality, 0.62));
    }

    if (dataUrl.length > SIDEBAR_IMAGE_MAX_DATA_URL_LENGTH) {
      throw new Error("La imagen sigue siendo muy grande. Elegi una foto mas liviana.");
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function ConfiguracionPage() {
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
  const [sidebarSaving, setSidebarSaving] = useState(false);
  const [sidebarMessage, setSidebarMessage] = useState<string | null>(null);
  const [sidebarError, setSidebarError] = useState<string | null>(null);

  const syncSidebarImageFromAccount = async () => {
    try {
      const response = await fetch('/api/account', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const remoteImage = typeof data.sidebarImage === 'string' && data.sidebarImage.trim()
        ? data.sidebarImage
        : null;

      if (remoteImage) {
        setSidebarImage(remoteImage);
        localStorage.setItem(SIDEBAR_IMAGE_KEY, remoteImage);
        window.dispatchEvent(new Event('pf-sidebar-image-updated'));
      } else {
        setSidebarImage(null);
        localStorage.removeItem(SIDEBAR_IMAGE_KEY);
        window.dispatchEvent(new Event('pf-sidebar-image-updated'));
      }
    } catch {
      // no bloquear configuracion si falla la sincronizacion inicial
    }
  };

  const markSidebarImagePendingSync = (image: string | null) => {
    localStorage.setItem(
      SIDEBAR_IMAGE_PENDING_SYNC_KEY,
      JSON.stringify({ image, savedAt: Date.now() })
    );
  };

  const clearSidebarImagePendingSync = () => {
    localStorage.removeItem(SIDEBAR_IMAGE_PENDING_SYNC_KEY);
  };

  const getSidebarImagePendingSync = (): string | null | undefined => {
    try {
      const raw = localStorage.getItem(SIDEBAR_IMAGE_PENDING_SYNC_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { image?: unknown };
      if (parsed.image === null) return null;
      return typeof parsed.image === "string" ? parsed.image : undefined;
    } catch {
      return undefined;
    }
  };

  const isRecoverableNetworkError = (error: unknown) => {
    if (!navigator.onLine) {
      return true;
    }

    const message = String(error || "");
    return /failed to fetch|networkerror|network request failed/i.test(message);
  };

  const saveSidebarImageInAccount = async (image: string | null, options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    setSidebarSaving(true);
    if (!silent) {
      setSidebarMessage(null);
      setSidebarError(null);
    }

    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sidebarImage: image }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'No se pudo guardar la imagen de perfil');
      }

      clearSidebarImagePendingSync();

      if (!silent) {
        setSidebarMessage('Foto de perfil sincronizada en tu cuenta');
      }
    } catch (error) {
      if (isRecoverableNetworkError(error)) {
        markSidebarImagePendingSync(image);
        if (!silent) {
          setSidebarError('Sin red. La foto se sincronizara automaticamente al reconectar.');
        }
      } else if (!silent) {
        setSidebarError(error instanceof Error ? error.message : 'No se pudo sincronizar la foto');
      }

      throw error;
    } finally {
      setSidebarSaving(false);
    }
  };

  useEffect(() => {
    const nextScale = clampScale(Number(localStorage.getItem(SCREEN_SCALE_KEY) || "1"));
    const nextEditMode = localStorage.getItem(SCREEN_EDIT_MODE_KEY) === "1";
    const nextNotifications = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === "1";
    const nextSidebarImage = localStorage.getItem(SIDEBAR_IMAGE_KEY);

    setSavedScale(nextScale);
    setDraftScale(nextScale);
    setEditMode(nextEditMode);
    setNotificationsEnabled(nextNotifications);
    setSidebarImage(nextSidebarImage);

    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }

    setLoaded(true);
    void syncSidebarImageFromAccount();
  }, []);

  useEffect(() => {
    const tryPendingImageSync = () => {
      if (!navigator.onLine) {
        return;
      }

      const pendingImage = getSidebarImagePendingSync();
      if (pendingImage === undefined) {
        return;
      }

      void saveSidebarImageInAccount(pendingImage, { silent: true })
        .then(() => {
          setSidebarMessage('Foto sincronizada automaticamente al volver la conexion');
          setSidebarError(null);
        })
        .catch(() => {
          // si vuelve a fallar por red, queda pendiente para el proximo evento online
        });
    };

    if (loaded) {
      void tryPendingImageSync();
    }

    window.addEventListener("online", tryPendingImageSync);
    return () => {
      window.removeEventListener("online", tryPendingImageSync);
    };
  }, [loaded]);

  useEffect(() => {
    const initPush = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushSupported(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register(SW_URL);
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
    window.location.href = "/";
  };

  const resetearMenu = () => {
    localStorage.removeItem(NAV_CONFIG_KEY);
    window.dispatchEvent(new Event("pf-nav-config-updated"));
  };

  const handleSidebarImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSidebarError(null);
    setSidebarMessage(null);

    try {
      const optimized = await optimizeSidebarImage(file);
      setSidebarImage(optimized);
      localStorage.setItem(SIDEBAR_IMAGE_KEY, optimized);
      window.dispatchEvent(new Event("pf-sidebar-image-updated"));
      await saveSidebarImageInAccount(optimized);
    } catch (error) {
      setSidebarError(error instanceof Error ? error.message : "No se pudo procesar la imagen");
    }

    event.currentTarget.value = "";
  };

  const removeSidebarImage = () => {
    setSidebarImage(null);
    localStorage.removeItem(SIDEBAR_IMAGE_KEY);
    window.dispatchEvent(new Event("pf-sidebar-image-updated"));
    void saveSidebarImageInAccount(null).catch(() => {
      // ya manejado con sidebarError
    });
  };

  const syncCurrentImageNow = async () => {
    if (!sidebarImage) {
      setSidebarError("No hay una foto local para sincronizar");
      return;
    }

    setSidebarError(null);
    setSidebarMessage(null);

    try {
      await saveSidebarImageInAccount(sidebarImage);
    } catch {
      // el mensaje de error ya se setea en saveSidebarImageInAccount
    }
  };

  const refreshImageFromAccountNow = async () => {
    setSidebarError(null);
    setSidebarMessage(null);

    setSidebarSaving(true);
    try {
      await syncSidebarImageFromAccount();
      setSidebarMessage("Foto actualizada desde tu cuenta");
    } catch {
      setSidebarError("No se pudo actualizar la foto desde tu cuenta");
    } finally {
      setSidebarSaving(false);
    }
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
      <main className="mx-auto max-w-4xl px-3 py-4 sm:p-6">
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-6">
          <p className="text-sm text-slate-300">Cargando configuracion...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-3 py-4 text-slate-100 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black sm:text-3xl">Configuracion</h1>
        <p className="mt-1 text-sm text-slate-300">
          Ajusta el tamano visual de toda la app y activa notificaciones tipo push del navegador.
        </p>
      </div>

      <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-5">
        <h2 className="text-xl font-bold">Panel general</h2>
        <p className="mt-1 text-sm text-slate-300">
          Opciones generales que antes estaban en la configuracion inferior del sidebar.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-center">
          <button
            type="button"
            onClick={abrirEditorInicio}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
          >
            Editar inicio
          </button>

          <button
            type="button"
            onClick={resetearMenu}
            className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white"
          >
            Reset menu lateral
          </button>

          <label className="cursor-pointer rounded-xl border border-cyan-300/45 px-4 py-2 text-center text-sm font-semibold text-cyan-100">
            Cambiar imagen sidebar
            <input
              type="file"
              accept="image/*"
              onChange={handleSidebarImageChange}
              disabled={sidebarSaving}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={syncCurrentImageNow}
            disabled={sidebarSaving || !sidebarImage}
            className="rounded-xl border border-cyan-200/35 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reintentar sincronizacion
          </button>

          <button
            type="button"
            onClick={refreshImageFromAccountNow}
            disabled={sidebarSaving}
            className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Traer foto desde cuenta
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-300">
          Estas opciones sirven tanto en celular como en compu cuando la red se corta o queda una foto vieja en un dispositivo.
        </p>

        {sidebarSaving ? (
          <p className="mt-3 text-xs text-slate-300">Sincronizando foto de perfil...</p>
        ) : null}

        {sidebarMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            {sidebarMessage}
          </p>
        ) : null}

        {sidebarError ? (
          <p className="mt-3 rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {sidebarError}
          </p>
        ) : null}

        {sidebarImage ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <img src={sidebarImage} alt="Sidebar" className="h-14 w-14 rounded-lg object-cover" />
            <button
              type="button"
              onClick={removeSidebarImage}
              disabled={sidebarSaving}
              className="rounded-lg border border-rose-300/45 px-3 py-1.5 text-xs font-semibold text-rose-100"
            >
              Quitar imagen
            </button>
          </div>
        ) : null}
      </section>

      <section className="mb-6 rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-5">
        <h2 className="text-xl font-bold">Pantalla</h2>
        <p className="mt-1 text-sm text-slate-300">
          Solo puedes cambiar el tamano cuando activas "Modificar pantalla".
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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
              <button
                type="button"
                onClick={activarModificacion}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
              >
                Modificar pantalla
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={guardarPantalla}
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
                >
                  Guardar cambios
                </button>
                <button
                  type="button"
                  onClick={cancelarModificacion}
                  className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white"
                >
                  Cancelar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={resetPantalla}
              className="rounded-xl border border-rose-300/45 px-4 py-2 text-sm font-semibold text-rose-100"
            >
              Reset 100%
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-5">
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

          <button
            type="button"
            onClick={solicitarPermisoNotificaciones}
            className="rounded-xl border border-cyan-300/45 px-4 py-2 text-sm font-semibold text-cyan-100"
          >
            Permitir notificaciones
          </button>
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
            <button
              type="button"
              disabled={!pushSupported || !VAPID_PUBLIC_KEY || pushLoading}
              onClick={activarPushRemoto}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Activar push remoto
            </button>
            <button
              type="button"
              disabled={!pushSupported || pushLoading}
              onClick={desactivarPushRemoto}
              className="rounded-xl border border-rose-300/45 px-4 py-2 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Desactivar push
            </button>
            <button
              type="button"
              disabled={!pushSubscribed}
              onClick={enviarPruebaPush}
              className="rounded-xl border border-emerald-300/45 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enviar prueba
            </button>
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
