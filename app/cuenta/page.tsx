"use client";

import { useEffect, useState } from "react";

type AccountData = {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function CuentaPage() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
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

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6 text-slate-100">
        <div className="rounded-3xl border border-white/15 bg-slate-900/75 p-6">
          <p className="text-sm text-slate-300">Cargando cuenta...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6 text-slate-100">
      <div className="mb-6">
        <h1 className="text-3xl font-black">Cuenta</h1>
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

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-6 shadow-lg">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Datos del profesor / admin</h2>
              <p className="mt-1 text-sm text-slate-300">Estos son los datos que hoy existen guardados para tu usuario.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${account?.emailVerified ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
              {account?.emailVerified ? "Verificado" : "Sin verificar"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="Email" value={account?.email || "-"} />
            <InfoCard label="Rol" value={account?.role || "-"} />
            <InfoCard label="ID" value={account?.id || "-"} mono />
            <InfoCard label="Alta" value={formatDate(account?.createdAt)} />
            <InfoCard label="Última actualización" value={formatDate(account?.updatedAt)} />
            <InfoCard label="Estado del mail" value={account?.emailVerified ? "Verificado" : "Pendiente"} />
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

        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-6 shadow-lg">
          <h2 className="text-xl font-bold">Editar cuenta</h2>
          <p className="mt-1 text-sm text-slate-300">
            Para modificar email o contraseña te pedimos la contraseña actual.
          </p>

          <form className="mt-5 grid gap-4" onSubmit={handleSave}>
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