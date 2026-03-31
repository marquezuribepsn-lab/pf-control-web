"use client";

import { useEffect, useRef, useState } from "react";

type AccountData = {
  id: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  telefono?: string | null;
  email: string;
  role: string;
  sidebarImage?: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

const SIDEBAR_IMAGE_KEY = "pf-control-sidebar-image-v1";
const SIDEBAR_IMAGE_MAX_EDGE = 960;
const SIDEBAR_IMAGE_TARGET_BYTES = 360 * 1024;
const SIDEBAR_IMAGE_MAX_DATA_URL_LENGTH = 900_000;

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

    const canvas = document.createElement("canvas");
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

export default function CuentaPage() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidebarImageSaving, setSidebarImageSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);

  const loadAccount = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar la cuenta");
      }

      setAccount(data);
      setNombre(data.nombre || "");
      setApellido(data.apellido || "");
      setFechaNacimiento(String(data.fechaNacimiento || "").slice(0, 10));
      setTelefono(data.telefono || "");
      setEmail(data.email);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la cuenta");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccount();
  }, []);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          apellido,
          fechaNacimiento,
          telefono,
          email,
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo guardar");
      }

      setMessage(data.message || "Cuenta actualizada");
      setCurrentPassword("");
      setNewPassword("");
      if (data.user) {
        setAccount(data.user);
        setNombre(data.user.nombre || "");
        setApellido(data.user.apellido || "");
        setFechaNacimiento(String(data.user.fechaNacimiento || "").slice(0, 10));
        setTelefono(data.user.telefono || "");
        setEmail(data.user.email);
      } else {
        await loadAccount();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setSendingVerification(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/account/verify", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo enviar el mail");
      }

      setMessage(data.message || "Mail enviado");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "No se pudo enviar el mail");
    } finally {
      setSendingVerification(false);
    }
  };

  const syncSidebarImageLocally = (image: string | null) => {
    setAccount((current) => {
      if (!current) return current;
      return { ...current, sidebarImage: image };
    });

    if (image) {
      localStorage.setItem(SIDEBAR_IMAGE_KEY, image);
    } else {
      localStorage.removeItem(SIDEBAR_IMAGE_KEY);
    }
    window.dispatchEvent(new Event("pf-sidebar-image-updated"));
  };

  const persistSidebarImage = async (image: string | null) => {
    setSidebarImageSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sidebarImage: image }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar la foto");
      }

      const remoteImage =
        typeof data?.user?.sidebarImage === "string" && data.user.sidebarImage.trim()
          ? data.user.sidebarImage
          : null;

      syncSidebarImageLocally(remoteImage);
      setMessage(data?.message || "Foto de perfil actualizada");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar la foto");
    } finally {
      setSidebarImageSaving(false);
    }
  };

  const handleSidebarImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const optimized = await optimizeSidebarImage(file);
      await persistSidebarImage(optimized);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo procesar la imagen");
    }
  };

  const handleRemoveSidebarImage = () => {
    void persistSidebarImage(null);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-3 py-4 text-slate-100 sm:p-6">
        <div className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 sm:p-6">
          <p className="text-sm text-slate-300">Cargando cuenta...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-3 py-4 text-slate-100 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black sm:text-3xl">Cuenta</h1>
        <p className="mt-1 text-sm text-slate-300">
          Revisa tus datos, actualiza tu acceso y reenvía el mail de verificación cuando lo necesites.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div>
              <h2 className="text-xl font-bold">Datos del profesor / admin</h2>
              <p className="mt-1 text-sm text-slate-300">Estos son los datos que hoy existen guardados para tu usuario.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${account?.emailVerified ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
              {account?.emailVerified ? "Verificado" : "Sin verificar"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="Nombre" value={account?.nombre || "-"} />
            <InfoCard label="Apellido" value={account?.apellido || "-"} />
            <InfoCard label="Fecha de nacimiento" value={formatDateOnly(account?.fechaNacimiento)} />
            <InfoCard label="Telefono" value={account?.telefono || "-"} />
            <InfoCard label="Email" value={account?.email || "-"} />
            <InfoCard label="Rol" value={account?.role || "-"} />
            <InfoCard label="ID" value={account?.id || "-"} mono />
            <InfoCard label="Alta" value={formatDate(account?.createdAt)} />
            <InfoCard label="Última actualización" value={formatDate(account?.updatedAt)} />
            <InfoCard label="Estado del mail" value={account?.emailVerified ? "Verificado" : "Pendiente"} />
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              Foto de perfil sincronizada
            </p>
            <div className="mt-3 flex items-center gap-3">
              {account?.sidebarImage ? (
                <img
                  src={account.sidebarImage}
                  alt="Foto de perfil"
                  className="h-14 w-14 rounded-xl border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/20 bg-slate-900/70 text-xs text-slate-300">
                  Sin foto
                </div>
              )}
              <p className="text-sm text-slate-200">
                Esta imagen se guarda en tu cuenta y se sincroniza al iniciar sesion en otros dispositivos.
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={profileImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSidebarImageFileChange}
              />
              <button
                type="button"
                onClick={() => profileImageInputRef.current?.click()}
                disabled={sidebarImageSaving}
                className="rounded-xl border border-cyan-300/45 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {account?.sidebarImage ? "Cambiar foto" : "Subir foto"}
              </button>
              <button
                type="button"
                onClick={handleRemoveSidebarImage}
                disabled={sidebarImageSaving || !account?.sidebarImage}
                className="rounded-xl border border-rose-300/45 px-3 py-2 text-xs font-bold text-rose-100 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Quitar foto
              </button>
            </div>

            {sidebarImageSaving ? (
              <p className="mt-2 text-xs text-slate-300">Guardando foto...</p>
            ) : null}
          </div>

          {!account?.emailVerified && (
            <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-100">
                Tu email todavía no está verificado. Si no encontrás el mensaje, podés reenviarlo ahora.
              </p>
              <button
                onClick={handleResendVerification}
                disabled={sendingVerification}
                className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingVerification ? "Enviando..." : "Enviar mail de verificación"}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-4 shadow-lg sm:p-6">
          <h2 className="text-xl font-bold">Editar cuenta</h2>
          <p className="mt-1 text-sm text-slate-300">
            Para modificar email o contraseña te pedimos la contraseña actual.
          </p>

          <form className="mt-5 grid gap-4" onSubmit={handleSave}>
            <div className="grid gap-4 xl:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-200">
                Nombre
                <input
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  className="w-full min-w-0 rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
                  placeholder="Nombre"
                  required
                />
              </label>

              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-200">
                Apellido
                <input
                  type="text"
                  value={apellido}
                  onChange={(event) => setApellido(event.target.value)}
                  className="w-full min-w-0 rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
                  placeholder="Apellido"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-200">
                Fecha de nacimiento
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={(event) => setFechaNacimiento(event.target.value)}
                  className="w-full min-w-0 rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
                  required
                />
              </label>

              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-200">
                Telefono
                <input
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  className="w-full min-w-0 rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
                  placeholder="Ej: +54 9 11 1234 5678"
                  required
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
                placeholder="tuemail@dominio.com"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Contraseña actual
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
                placeholder="Obligatoria para guardar cambios"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Nueva contraseña
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
                placeholder="Opcional"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 break-all text-sm text-slate-100 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

function formatDateOnly(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR");
}