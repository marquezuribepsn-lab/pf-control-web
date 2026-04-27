"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type AccountData = {
  id: string;
  email: string;
  role: string;
  nombreCompleto: string;
  edad: number;
  fechaNacimiento: string;
  altura: number;
  telefono: string | null;
  direccion: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type ThemeMode = "dark" | "light";

const THEME_MODE_KEY = "pf-control-theme-mode-v1";
const THEME_MODE_EVENT = "pf-theme-mode-updated";

function normalizeThemeMode(value: unknown): ThemeMode {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "light" ? "light" : "dark";
}

function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;

  const resolved = normalizeThemeMode(mode);
  document.documentElement.setAttribute("data-pf-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

export default function CuentaPage() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [edad, setEdad] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [altura, setAltura] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setNombreCompleto(String(data.nombreCompleto || ""));
      setEdad(String(data.edad ?? ""));
      setFechaNacimiento(formatDateForInput(data.fechaNacimiento));
      setAltura(data.altura !== undefined && data.altura !== null ? String(data.altura) : "");
      setTelefono(String(data.telefono || ""));
      setDireccion(String(data.direccion || ""));
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncTheme = () => {
      const nextTheme = normalizeThemeMode(window.localStorage.getItem(THEME_MODE_KEY));
      setThemeMode(nextTheme);
      applyThemeMode(nextTheme);
    };

    syncTheme();

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_MODE_KEY) {
        syncTheme();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handleThemeModeChange = (nextMode: ThemeMode) => {
    if (typeof window === "undefined") return;

    const normalized = normalizeThemeMode(nextMode);
    setThemeMode(normalized);
    applyThemeMode(normalized);
    window.localStorage.setItem(THEME_MODE_KEY, normalized);
    window.dispatchEvent(new Event(THEME_MODE_EVENT));
  };

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
          email,
          currentPassword,
          newPassword,
          nombreCompleto,
          edad,
          fechaNacimiento,
          altura,
          telefono,
          direccion,
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
        setNombreCompleto(String(data.user.nombreCompleto || ""));
        setEdad(String(data.user.edad ?? ""));
        setFechaNacimiento(formatDateForInput(data.user.fechaNacimiento));
        setAltura(data.user.altura !== undefined && data.user.altura !== null ? String(data.user.altura) : "");
        setTelefono(String(data.user.telefono || ""));
        setDireccion(String(data.user.direccion || ""));
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

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ callbackUrl: "/auth/login" });
  };

  const isLightTheme = themeMode === "light";
  const pageTextClass = isLightTheme ? "text-slate-800" : "text-slate-100";
  const mutedTextClass = isLightTheme ? "text-slate-600" : "text-slate-300";
  const sectionClass = isLightTheme
    ? "min-w-0 overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/95 p-6 shadow-[0_16px_42px_rgba(15,23,42,0.12)]"
    : "min-w-0 overflow-hidden rounded-3xl border border-white/15 bg-slate-900/75 p-6 shadow-lg";
  const inputClass = isLightTheme
    ? "box-border w-full max-w-full rounded-2xl border border-emerald-200/70 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
    : "box-border w-full max-w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60";

  if (loading) {
    return (
      <main className={`pf-account-theme-scope mx-auto max-w-5xl p-6 ${pageTextClass}`}>
        <div className={sectionClass}>
          <p className={`text-sm ${mutedTextClass}`}>Cargando cuenta...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={`pf-account-theme-scope mx-auto max-w-5xl p-6 ${pageTextClass}`}>
      <div className="mb-6">
        <h1 className="text-3xl font-black">Cuenta</h1>
        <p className={`mt-1 text-sm ${mutedTextClass}`}>
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className={sectionClass}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Datos del profesor / admin</h2>
              <p className={`mt-1 text-sm ${mutedTextClass}`}>Estos son los datos que hoy existen guardados para tu usuario.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${account?.emailVerified ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
              {account?.emailVerified ? "Verificado" : "Sin verificar"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="Nombre completo" value={account?.nombreCompleto || "-"} light={isLightTheme} />
            <InfoCard label="Telefono" value={account?.telefono || "-"} light={isLightTheme} />
            <InfoCard label="Direccion" value={account?.direccion || "-"} light={isLightTheme} />
            <InfoCard label="Edad" value={account?.edad !== undefined ? String(account.edad) : "-"} light={isLightTheme} />
            <InfoCard label="Fecha de nacimiento" value={formatDate(account?.fechaNacimiento)} light={isLightTheme} />
            <InfoCard label="Altura" value={account?.altura !== undefined ? `${account.altura} cm` : "-"} light={isLightTheme} />
            <InfoCard label="Email" value={account?.email || "-"} light={isLightTheme} />
            <InfoCard label="Rol" value={account?.role || "-"} light={isLightTheme} />
            <InfoCard label="ID" value={account?.id || "-"} mono light={isLightTheme} />
            <InfoCard label="Alta" value={formatDate(account?.createdAt)} light={isLightTheme} />
            <InfoCard label="Ultima actualizacion" value={formatDate(account?.updatedAt)} light={isLightTheme} />
            <InfoCard label="Estado del mail" value={account?.emailVerified ? "Verificado" : "Pendiente"} light={isLightTheme} />
          </div>

          {!account?.emailVerified && (
            <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-100">
                Tu email todavía no está verificado. Si no encontrás el mensaje, podés reenviarlo ahora.
              </p>
              <ReliableActionButton
                onClick={handleResendVerification}
                disabled={sendingVerification}
                className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingVerification ? "Enviando..." : "Enviar mail de verificación"}
              </ReliableActionButton>
            </div>
          )}
        </section>

        <section className={sectionClass}>
          <h2 className="text-xl font-bold">Editar cuenta</h2>
          <p className={`mt-1 text-sm ${mutedTextClass}`}>
            Los datos personales se guardan directo. Para cambiar email o contraseña te pedimos la contraseña actual.
          </p>

          <div className="mt-5 rounded-2xl border border-emerald-300/35 bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-emerald-100">Apariencia</p>
                <p className="mt-1 text-xs text-emerald-100/90">Alterna entre modo oscuro y claro.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ReliableActionButton
                  type="button"
                  onClick={() => handleThemeModeChange("dark")}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                    themeMode === "dark"
                      ? "border-cyan-200/60 bg-cyan-500/25 text-cyan-50"
                      : "border-white/20 bg-slate-900/30 text-slate-200"
                  }`}
                >
                  Oscuro
                </ReliableActionButton>
                <ReliableActionButton
                  type="button"
                  onClick={() => handleThemeModeChange("light")}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                    themeMode === "light"
                      ? "border-emerald-200/70 bg-emerald-400/30 text-emerald-50"
                      : "border-white/20 bg-slate-900/30 text-slate-200"
                  }`}
                >
                  Claro
                </ReliableActionButton>
              </div>
            </div>
          </div>

          <form className="pf-account-form mt-5 grid min-w-0 gap-4" onSubmit={handleSave}>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <label className={`grid min-w-0 gap-2 text-sm font-medium ${isLightTheme ? "text-slate-700" : "text-slate-200"} xl:col-span-2`}>
                Nombre completo
                <input
                  type="text"
                  value={nombreCompleto}
                  onChange={(event) => setNombreCompleto(event.target.value)}
                  className={inputClass}
                  placeholder="Nombre y apellido"
                  required
                />
              </label>

              <label className={`grid min-w-0 gap-2 text-sm font-medium ${isLightTheme ? "text-slate-700" : "text-slate-200"}`}>
                Edad
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  value={edad}
                  onChange={(event) => setEdad(event.target.value)}
                  className={inputClass}
                  placeholder="34"
                />
              </label>

              <label className={`grid min-w-0 gap-2 text-sm font-medium ${isLightTheme ? "text-slate-700" : "text-slate-200"}`}>
                Fecha de nacimiento
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={(event) => setFechaNacimiento(event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className={`grid min-w-0 gap-2 text-sm font-medium ${isLightTheme ? "text-slate-700" : "text-slate-200"}`}>
                Altura (cm)
                <input
                  type="number"
                  min={0}
                  max={250}
                  step={0.1}
                  value={altura}
                  onChange={(event) => setAltura(event.target.value)}
                  className={inputClass}
                  placeholder="172"
                />
              </label>

              <label className={`grid min-w-0 gap-2 text-sm font-medium ${isLightTheme ? "text-slate-700" : "text-slate-200"}`}>
                Telefono
                <input
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  className={inputClass}
                  placeholder="+54 ..."
                />
              </label>

              <label className={`grid min-w-0 gap-2 text-sm font-medium ${isLightTheme ? "text-slate-700" : "text-slate-200"} xl:col-span-2`}>
                Direccion
                <input
                  type="text"
                  value={direccion}
                  onChange={(event) => setDireccion(event.target.value)}
                  className={inputClass}
                  placeholder="Calle y numero"
                />
              </label>
            </div>

            <div className={`mt-1 border-t pt-4 ${isLightTheme ? "border-slate-200" : "border-white/10"}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isLightTheme ? "text-slate-500" : "text-slate-400"}`}>Credenciales</p>
            </div>

            <label className={`grid min-w-0 gap-2 text-sm font-medium ${isLightTheme ? "text-slate-700" : "text-slate-200"}`}>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="tuemail@dominio.com"
              />
            </label>

            <label className={`grid min-w-0 gap-2 text-sm font-medium ${isLightTheme ? "text-slate-700" : "text-slate-200"}`}>
              Contraseña actual
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={inputClass}
                placeholder="Obligatoria para guardar cambios"
              />
            </label>

            <label className={`grid min-w-0 gap-2 text-sm font-medium ${isLightTheme ? "text-slate-700" : "text-slate-200"}`}>
              Nueva contraseña
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={inputClass}
                placeholder="Opcional"
              />
            </label>

            <ReliableActionButton
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </ReliableActionButton>
          </form>

          <div className="mt-6 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4">
            <p className="text-sm font-semibold text-rose-100">Sesion</p>
            <p className="mt-1 text-xs text-rose-100/90">
              Si terminaste de usar el sistema, cerrá tu sesion desde aca.
            </p>
            <ReliableActionButton
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-3 rounded-xl border border-rose-200/60 bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-100 transition hover:bg-rose-500/35 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {signingOut ? "Cerrando sesion..." : "Cerrar sesion"}
            </ReliableActionButton>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value, mono = false, light = false }: { label: string; value: string; mono?: boolean; light?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${light ? "border-emerald-200/70 bg-emerald-50/60" : "border-white/10 bg-slate-950/60"}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${light ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
      <p className={`mt-2 break-all text-sm ${light ? "text-slate-800" : "text-slate-100"} ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

function formatDateForInput(value?: string) {
  if (!value) return "";
  if (value.length >= 10) return value.slice(0, 10);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}
