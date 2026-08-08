"use client";

import ReliableActionButton from "@/components/ReliableActionButton";
import DateInput from "@/components/DateInput";
import { useEffect, useLayoutEffect, useState } from "react";
import { signOut } from "next-auth/react";

type AccountData = {
  id: string;
  email: string;
  role: string;
  nombreCompleto: string;
  edad: number;
  fechaNacimiento: string | number | null;
  altura: number;
  telefono: string | null;
  telefonoVerificado: boolean;
  direccion: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

// ── País / Código de llamada ──────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: "AR", flag: "🇦🇷", dial: "+54",  name: "Argentina" },
  { code: "UY", flag: "🇺🇾", dial: "+598", name: "Uruguay" },
  { code: "PY", flag: "🇵🇾", dial: "+595", name: "Paraguay" },
  { code: "BO", flag: "🇧🇴", dial: "+591", name: "Bolivia" },
  { code: "CL", flag: "🇨🇱", dial: "+56",  name: "Chile" },
  { code: "BR", flag: "🇧🇷", dial: "+55",  name: "Brasil" },
  { code: "PE", flag: "🇵🇪", dial: "+51",  name: "Perú" },
  { code: "CO", flag: "🇨🇴", dial: "+57",  name: "Colombia" },
  { code: "VE", flag: "🇻🇪", dial: "+58",  name: "Venezuela" },
  { code: "EC", flag: "🇪🇨", dial: "+593", name: "Ecuador" },
  { code: "MX", flag: "🇲🇽", dial: "+52",  name: "México" },
  { code: "US", flag: "🇺🇸", dial: "+1",   name: "EE.UU." },
  { code: "ES", flag: "🇪🇸", dial: "+34",  name: "España" },
  { code: "DE", flag: "🇩🇪", dial: "+49",  name: "Alemania" },
  { code: "GB", flag: "🇬🇧", dial: "+44",  name: "Reino Unido" },
];

const KNOWN_DIALS = COUNTRY_CODES.map((c) => c.dial).sort((a, b) => b.length - a.length);

/** Parsea un teléfono almacenado (+54XXXXXXXXXX) en {code, local} */
function parseStoredPhone(stored: string): { code: string; local: string } {
  const s = stored.trim();
  if (!s) return { code: "+54", local: "" };
  for (const dial of KNOWN_DIALS) {
    if (s.startsWith(dial)) {
      return { code: dial, local: s.slice(dial.length) };
    }
  }
  // Sin prefijo reconocido — asumir Argentina
  return { code: "+54", local: s };
}

// En el cliente aplicamos el tema con un layout effect (síncrono, antes del
// paint) para evitar el parpadeo: sin esto la página pinta primero en tema
// oscuro por defecto y recién después salta al tema guardado. En el server
// cae a useEffect (no-op) para no romper el render.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Phone verification
  const [countryCode, setCountryCode] = useState("+54");
  const [phoneLocal, setPhoneLocal] = useState(""); // número sin código de país
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

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
      const storedPhone = String(data.telefono || "");
      setTelefono(storedPhone);
      const parsed = parseStoredPhone(storedPhone);
      setCountryCode(parsed.code);
      setPhoneLocal(parsed.local);
      setDireccion(String(data.direccion || ""));
      setEmail(data.email);
      setPhoneVerified(Boolean(data.telefonoVerificado));
      setPhoneCodeSent(false);
      setPhoneCode("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la cuenta");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccount();
  }, []);

  // Sync the combined telefono value whenever country code or local number changes
  useEffect(() => {
    const digits = phoneLocal.replace(/\D/g, "");
    setTelefono(digits ? `${countryCode}${digits}` : "");
  }, [countryCode, phoneLocal]);

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
        const savedPhone = String(data.user.telefono || "");
        setTelefono(savedPhone);
        const parsed2 = parseStoredPhone(savedPhone);
        setCountryCode(parsed2.code);
        setPhoneLocal(parsed2.local);
        setPhoneVerified(Boolean(data.user.telefonoVerificado));
        setPhoneCodeSent(false);
        setPhoneCode("");
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

  const pushToast = (type: "success" | "error" | "warning", message: string, title?: string) => {
    window.dispatchEvent(
      new CustomEvent("pf-inline-toast", { detail: { type, message, title } })
    );
  };

  const handleSendPhoneCode = async () => {
    const fullPhone = `${countryCode}${phoneLocal.replace(/\D/g, "")}`;
    if (!phoneLocal || phoneLocal.replace(/\D/g, "").length < 6) {
      pushToast("error", "Ingresá un número de teléfono válido antes de verificar.", "Teléfono");
      return;
    }
    setPhoneSending(true);
    try {
      const res = await fetch("/api/account/phone-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo enviar el código");
      setPhoneCodeSent(true);
      pushToast("success", data.message || "Código enviado a tu email.", "Código enviado");
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Error al enviar el código", "Error");
    } finally {
      setPhoneSending(false);
    }
  };

  const handleVerifyPhoneCode = async () => {
    if (!phoneCode || phoneCode.replace(/\D/g, "").length !== 6) {
      pushToast("error", "Ingresá el código de 6 dígitos.", "Código inválido");
      return;
    }
    setPhoneVerifying(true);
    const fullPhone = `${countryCode}${phoneLocal.replace(/\D/g, "")}`;
    try {
      const [res] = await Promise.all([
        fetch("/api/account/phone-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "verify",
            code: phoneCode.replace(/\D/g, ""),
            phone: fullPhone,
          }),
        }),
        new Promise((r) => setTimeout(r, 700)), // carga mínima visible
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Código incorrecto");
      setPhoneVerified(true);
      setPhoneCodeSent(false);
      setPhoneCode("");
      pushToast("success", "Teléfono verificado correctamente.", "¡Verificado!");
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Error al verificar", "Error");
    } finally {
      setPhoneVerifying(false);
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

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setError("Ingresá tu contraseña actual para confirmar la eliminación.");
      return;
    }
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: deletePassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar la cuenta");
      }
      // Cuenta eliminada → cerrar sesión y volver al login
      await signOut({ callbackUrl: "/auth/login" });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la cuenta");
      setDeleting(false);
    }
  };

  const pageTextClass = "pf-v2-t";
  const mutedTextClass = "pf-v2-t-70";
  const sectionClass = "min-w-0 overflow-hidden rounded-3xl border pf-v2-b-hi pf-v2-s-deep p-6 shadow-lg";
  const inputClass = "box-border w-full max-w-full rounded-2xl border pf-v2-b-hi pf-v2-s-deep px-4 py-3 pf-v2-t outline-none transition";

  if (loading) {
    return (
      <main className={`pf-account-theme-scope mx-auto max-w-5xl p-6 ${pageTextClass}`}>
        <div className={sectionClass}>
          <p className={`text-sm${mutedTextClass}`}>Cargando cuenta...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={`pf-account-theme-scope mx-auto max-w-5xl p-6 ${pageTextClass}`}>
      <div className="mb-6">
        <h1 className="pf-v2-title">Cuenta</h1>
        <p className="pf-v2-title-sub">Revisá tus datos, actualizá tu acceso y reenviá el mail de verificación cuando lo necesites.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border pf-v2-b-danger pf-v2-s-danger px-4 py-3 text-sm pf-v2-t-danger">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-2xl border pf-v2-b-ok pf-v2-s-ok px-4 py-3 text-sm pf-v2-t-ok">
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start" }}>
        <section className={sectionClass}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="pf-v2-h2">Datos del profesor / admin</h2>
              <p className={`mt-1 text-sm${mutedTextClass}`}>Estos son los datos que hoy existen guardados para tu usuario.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${account?.emailVerified ? "pf-v2-s-ok pf-v2-t-ok" : "pf-v2-s-warn pf-v2-t-warn"}`}>
              {account?.emailVerified ? "Verificado" : "Sin verificar"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="Nombre completo" value={account?.nombreCompleto || "-"} />
            <InfoCard
              label="Telefono"
              value={account?.telefono ? `${account.telefono}${account.telefonoVerificado ? " ✓" : " (sin verificar)"}` : "-"}
            />
            <InfoCard label="Direccion" value={account?.direccion || "-"} />
            <InfoCard label="Edad" value={account?.edad !== undefined ? String(account.edad) : "-"} />
            <InfoCard label="Fecha de nacimiento" value={formatDate(account?.fechaNacimiento)} />
            <InfoCard label="Altura" value={account?.altura !== undefined ? `${account.altura} cm` : "-"} />
            <InfoCard label="Email" value={account?.email || "-"} />
            <InfoCard label="Rol" value={account?.role || "-"} />
            <InfoCard label="ID" value={account?.id || "-"} mono />
            <InfoCard label="Alta" value={formatDate(account?.createdAt)} />
            <InfoCard label="Ultima actualizacion" value={formatDate(account?.updatedAt)} />
            <InfoCard label="Estado del mail" value={account?.emailVerified ? "Verificado" : "Pendiente"} />
          </div>

          {!account?.emailVerified && (
            <div className="mt-5 rounded-2xl border pf-v2-b-warn pf-v2-s-warn p-4">
              <p className="text-sm pf-v2-t-warn">
                Tu email todavía no está verificado. Si no encontrás el mensaje, podés reenviarlo ahora.
              </p>
              <ReliableActionButton
                onClick={handleResendVerification}
                disabled={sendingVerification}
                className="mt-3 rounded-xl pf-v2-s-warn px-4 py-2 text-sm font-bold pf-v2-t transition pf-v2-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingVerification ? "Enviando..." : "Enviar mail de verificación"}
              </ReliableActionButton>
            </div>
          )}
        </section>

        <section className={sectionClass}>
          <h2 className="pf-v2-h2">Editar cuenta</h2>
          <p className={`mt-1 text-sm${mutedTextClass}`}>
            Los datos personales se guardan directo. Para cambiar email o contraseña te pedimos la contraseña actual.
          </p>

          <form className="pf-account-form mt-5 grid min-w-0 gap-4" onSubmit={handleSave} noValidate>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <label className={`grid min-w-0 gap-2 text-sm font-medium ${"pf-v2-t"}xl:col-span-2`}>
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

              <label className={`grid min-w-0 gap-2 text-sm font-medium ${"pf-v2-t"}`}>
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

              <label className={`grid min-w-0 gap-2 text-sm font-medium ${"pf-v2-t"}`}>
                Fecha de nacimiento
                <DateInput
                  value={fechaNacimiento}
                  onChange={setFechaNacimiento}
                  className={`${inputClass} pr-8`}
                />
              </label>

              <label className={`grid min-w-0 gap-2 text-sm font-medium ${"pf-v2-t"}`}>
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

              {/* ── Teléfono ─────────────────────────────────────────── */}
              <div className={`flex min-w-0 flex-col gap-2 text-sm font-medium xl:col-span-2 ${"pf-v2-t"}`}>
                {/* Etiqueta */}
                <span className="flex items-center gap-2">
                  Teléfono
                  {phoneVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full pf-v2-s-ok px-2.5 py-0.5 text-xs font-bold pf-v2-t-ok">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5.5L4 8L8.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Verificado
                    </span>
                  )}
                </span>

                {/* Selector de país + número en misma fila */}
                <div style={{ display: "flex", gap: "0.5rem", minWidth: 0 }}>
                  <select
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      if (phoneVerified) setPhoneVerified(false);
                      setPhoneCodeSent(false);
                      setPhoneCode("");
                    }}
                    style={{ width: "96px", flexShrink: 0 }}
                    className={`cursor-pointer rounded-2xl border px-2 py-3 text-sm outline-none transition ${
                      "pf-v2-b-hi pf-v2-s-deep pf-v2-t"
                    }`}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={phoneLocal}
                    onChange={(e) => {
                      setPhoneLocal(e.target.value);
                      if (phoneVerified) setPhoneVerified(false);
                      setPhoneCodeSent(false);
                      setPhoneCode("");
                    }}
                    placeholder="2257 613518"
                    style={{ flex: 1, minWidth: 0 }}
                    className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${
                      "pf-v2-b-hi pf-v2-s-deep pf-v2-t"
                    }`}
                  />
                </div>

                {/* Paso 1 — botón enviar código */}
                {phoneLocal.replace(/\D/g, "").length >= 6 && !phoneVerified && !phoneCodeSent && (
                  <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                    "pf-v2-b-accent pf-v2-s-accent"
                  }`}>
                    <p className={`text-xs ${"pf-v2-t-70"}`}>
                      Código de 6 dígitos a tu email
                    </p>
                    <ReliableActionButton
                      type="button"
                      onClick={handleSendPhoneCode}
                      disabled={phoneSending}
                      reliabilityMode="off"
                      className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap transition disabled:opacity-60 ${
                        "pf-v2-s-accent-full pf-v2-t pf-v2-hover"
                      }`}
                    >
                      {phoneSending ? "Enviando..." : "Enviar código"}
                    </ReliableActionButton>
                  </div>
                )}

                {/* Paso 2 — ingresar el código */}
                {phoneCodeSent && !phoneVerified && (
                  <div className={`rounded-2xl border p-4 ${
                    "pf-v2-b-ok pf-v2-s-ok"
                  }`}>
                    <p className={`mb-3 text-xs ${"pf-v2-t-ok"}`}>
                      Revisá tu email e ingresá el código:
                    </p>
                    {/* Fila: input + Confirmar */}
                    <div style={{ display: "flex", gap: "0.5rem", minWidth: 0 }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        style={{ flex: 1, minWidth: 0 }}
                        className={`rounded-2xl border px-3 py-3 text-center text-lg font-black tracking-[0.25em] outline-none transition ${
                          "pf-v2-b-ok pf-v2-s-deep pf-v2-t"
                        }`}
                        placeholder="000000"
                      />
                      <ReliableActionButton
                        type="button"
                        onClick={handleVerifyPhoneCode}
                        disabled={phoneVerifying || phoneCode.replace(/\D/g, "").length !== 6}
                        reliabilityMode="off"
                        style={{ flexShrink: 0 }}
                        className="rounded-xl pf-v2-s-ok px-4 py-3 text-sm font-bold pf-v2-t whitespace-nowrap transition pf-v2-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {phoneVerifying ? "Verificando…" : "Confirmar"}
                      </ReliableActionButton>
                    </div>
                    {/* Reenviar debajo */}
                    <div className="mt-2 flex justify-end">
                      <ReliableActionButton
                        type="button"
                        onClick={handleSendPhoneCode}
                        disabled={phoneSending}
                        reliabilityMode="off"
                        className={`text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50 transition ${
                          "pf-v2-t-50"
                        }`}
                      >
                        {phoneSending ? "Enviando…" : "Reenviar código"}
                      </ReliableActionButton>
                    </div>
                  </div>
                )}
              </div>

              <label className={`grid min-w-0 gap-2 text-sm font-medium ${"pf-v2-t"}xl:col-span-2`}>
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

            <div className={`mt-1 border-t pt-4 ${"pf-v2-b"}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${"pf-v2-t-50"}`}>Credenciales</p>
            </div>

            <label className={`grid min-w-0 gap-2 text-sm font-medium ${"pf-v2-t"}`}>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="tuemail@dominio.com"
              />
            </label>

            <label className={`grid min-w-0 gap-2 text-sm font-medium ${"pf-v2-t"}`}>
              Contraseña actual
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={inputClass}
                placeholder="Obligatoria para guardar cambios"
              />
            </label>

            <label className={`grid min-w-0 gap-2 text-sm font-medium ${"pf-v2-t"}`}>
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
              className="pf-v2-btn disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </ReliableActionButton>
          </form>

          <div className="mt-6 rounded-2xl border pf-v2-b-danger pf-v2-s-danger p-4">
            <p className="text-sm font-semibold pf-v2-t-danger">Sesion</p>
            <p className="mt-1 text-xs pf-v2-t-danger">
              Si terminaste de usar el sistema, cerrá tu sesion desde aca.
            </p>
            <ReliableActionButton
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-3 rounded-xl border pf-v2-b-danger pf-v2-s-danger px-4 py-2 text-sm font-bold pf-v2-t-danger transition pf-v2-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {signingOut ? "Cerrando sesion..." : "Cerrar sesion"}
            </ReliableActionButton>
          </div>

          <div className="mt-4 rounded-2xl border pf-v2-b-danger pf-v2-s-danger p-4">
            <p className="text-sm font-semibold pf-v2-t-danger">Eliminar cuenta</p>
            <p className="mt-1 text-xs pf-v2-t-danger">
              Borra de forma permanente tu cuenta y todos los datos asociados. Esta acción no se puede deshacer.
            </p>

            {!showDeleteConfirm ? (
              <ReliableActionButton
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setDeletePassword("");
                  setError(null);
                  setMessage(null);
                }}
                className="mt-3 rounded-xl border pf-v2-b-danger pf-v2-s-danger px-4 py-2 text-sm font-bold pf-v2-t-danger transition pf-v2-hover"
              >
                Eliminar mi cuenta
              </ReliableActionButton>
            ) : (
              <div className="mt-3 grid gap-3">
                <p className="text-xs font-semibold pf-v2-t-danger">
                  Ingresá tu contraseña actual para confirmar:
                </p>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  className={inputClass}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                />
                <div className="flex flex-wrap gap-2">
                  <ReliableActionButton
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="rounded-xl border pf-v2-b-danger pf-v2-s-danger px-4 py-2 text-sm font-bold pf-v2-t transition pf-v2-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deleting ? "Eliminando..." : "Confirmar eliminación"}
                  </ReliableActionButton>
                  <ReliableActionButton
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword("");
                    }}
                    disabled={deleting}
                    className="rounded-xl border pf-v2-b-hi pf-v2-s-deep px-4 py-2 text-sm font-bold pf-v2-t transition pf-v2-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Cancelar
                  </ReliableActionButton>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="pf-v2-card" style={{ padding: 16 }}>
      <span className="pf-v2-stat-label">{label}</span>
      <p className={`mt-2 break-all text-sm pf-v2-t ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function formatDate(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  const d = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-AR");
}

function formatDateForInput(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "";

  // Numeric timestamp (e.g. 946684800000 stored as integer in SQLite)
  const asNum = typeof value === "number" ? value : /^\d+$/.test(String(value)) ? Number(value) : NaN;
  if (!Number.isNaN(asNum)) {
    const d = new Date(asNum);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const str = String(value);
  // Already an ISO date like "2000-01-01T00:00:00.000Z" or "2000-01-01"
  if (str.length >= 10 && str[4] === "-") return str.slice(0, 10);

  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}
