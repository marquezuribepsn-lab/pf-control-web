"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { signOut } from "next-auth/react";

// ─── Types ───────────────────────────────────────────────────────────────────
type Pago = {
  id: string; monto: number; moneda: string; metodoPago: string;
  fechaPago: string; periodoDesde: string; periodoHasta: string; notas: string | null;
};
type Subscription = {
  id: string; planTipo: string; maxAlumnos: number; maxPlanes: number;
  estado: string; fechaInicio: string; fechaVencimiento: string | null;
  moneda: string; importe: number; periodoDias: number; notas: string | null;
  pagos?: Pago[];
};
type Profesor = {
  id: string; email: string; nombreCompleto: string; telefono: string | null;
  estado: string; createdAt: string; alumnosCount: number; subscription: Subscription | null;
  notasInternas?: string | null;
};
type Section = "dashboard" | "profesores" | "pagos" | "automatizacion" | "historial" | "finanzas" | "actividad" | "herramientas" | "configuracion" | "auditoria";
type AlertaItem = { tipo: string; nivel: "critico" | "warning" | "info"; titulo: string; detalle: string };
type NotifType = "pago_confirmado" | "vencimiento_proximo" | "suscripcion_activada" | "suscripcion_suspendida" | "suscripcion_vencida" | "aviso_personalizado";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PLAN_META: Record<string, { label: string; pill: string }> = {
  basico: { label: "Básico", pill: "border-slate-600/50 text-slate-400 bg-slate-500/10" },
  pro:    { label: "Pro",    pill: "border-violet-500/40 text-violet-300 bg-violet-500/10" },
  elite:  { label: "Elite",  pill: "border-amber-500/40 text-amber-300 bg-amber-500/10" },
};
const SUB_META: Record<string, { label: string; dot: string; pill: string }> = {
  trial:      { label: "Trial",      dot: "bg-sky-400",     pill: "border-sky-500/30 text-sky-300 bg-sky-500/10" },
  activo:     { label: "Activo",     dot: "bg-emerald-400", pill: "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" },
  suspendido: { label: "Suspendido", dot: "bg-amber-400",   pill: "border-amber-500/30 text-amber-300 bg-amber-500/10" },
  vencido:    { label: "Vencido",    dot: "bg-red-400",     pill: "border-red-500/30 text-red-300 bg-red-500/10" },
  cancelado:  { label: "Cancelado",  dot: "bg-slate-500",   pill: "border-slate-600/30 text-slate-400 bg-slate-500/10" },
};
const NOTIF_LABELS: Record<NotifType, string> = {
  pago_confirmado:       "✅ Pago confirmado",
  vencimiento_proximo:   "⚠️ Vencimiento próximo",
  suscripcion_activada:  "🎉 Suscripción activada",
  suscripcion_suspendida:"🚫 Acceso suspendido",
  suscripcion_vencida:   "❌ Suscripción vencida",
  aviso_personalizado:   "📢 Aviso personalizado",
};

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r =>
    r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMoney(n: number, cur = "USD") {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
}
function daysUntil(d?: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function ini(name: string, email: string) {
  return (name || email).slice(0, 2).toUpperCase();
}
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return "ahora mismo";
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  return `hace ${Math.floor(s / 3600)}h`;
}
function waLink(tel: string) {
  return `https://wa.me/${tel.replace(/\D/g, "")}`;
}

// ─── Pill components ──────────────────────────────────────────────────────────
function SubPill({ estado }: { estado: string }) {
  const m = SUB_META[estado] ?? SUB_META.cancelado;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${m.pill}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}
function PlanPill({ plan }: { plan: string }) {
  const m = PLAN_META[plan] ?? PLAN_META.basico;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${m.pill}`}>
      {m.label}
    </span>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0e1012]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 border border-violet-500/20">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 opacity-20 blur-xl" />
          <svg className="relative h-7 w-7 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-violet-400/60">God Panel</p>
          <p className="mt-1 text-sm font-black text-white">Cargando sistema...</p>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: "ok" | "err"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl transition-all ${type === "ok" ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200" : "border-red-500/30 bg-red-500/15 text-red-200"}`}>
      <span>{type === "ok" ? "✓" : "✕"}</span>
      <span className="text-sm font-semibold">{msg}</span>
    </div>
  );
}

// ─── Modal Crear Profesor ─────────────────────────────────────────────────────
function ModalCrear({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ email: "", nombreCompleto: "", password: "", planTipo: "basico", maxAlumnos: "30", maxPlanes: "5", sendBienvenida: false });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setErr("");
    try {
      const r = await fetch("/api/superadmin/profesores", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, maxAlumnos: +form.maxAlumnos, maxPlanes: +form.maxPlanes }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error al crear");
      if (form.sendBienvenida) {
        await fetch("/api/superadmin/notify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "suscripcion_activada", profesorEmail: form.email,
            profesorNombre: form.nombreCompleto, channels: ["email"],
          }),
        }).catch(() => {});
      }
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-violet-500/20 bg-[#0e1012]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-violet-400/60">Nuevo acceso</p>
            <p className="text-sm font-black text-white">Crear Profesor</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-white transition-colors">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-6">
          {([["email","Email","email","prof@gym.com"],["nombreCompleto","Nombre completo","text","Juan Pérez"],["password","Contraseña","password","••••••••"]] as const).map(([k,l,t,ph]) => (
            <div key={k}>
              <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{l}</p>
              <input type={t} placeholder={ph} required value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none transition-colors" />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Plan</p>
              <select value={form.planTipo} onChange={e => setForm(f => ({ ...f, planTipo: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:outline-none">
                <option value="basico">Básico</option><option value="pro">Pro</option><option value="elite">Elite</option>
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Alumnos</p>
              <input type="number" min="1" value={form.maxAlumnos} onChange={e => setForm(f => ({ ...f, maxAlumnos: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:outline-none" />
            </div>
            <div>
              <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Planes</p>
              <input type="number" min="1" value={form.maxPlanes} onChange={e => setForm(f => ({ ...f, maxPlanes: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:outline-none" />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
            <input type="checkbox" checked={form.sendBienvenida} onChange={e => setForm(f => ({ ...f, sendBienvenida: e.target.checked }))} className="accent-violet-500" />
            <span className="text-sm text-slate-300">Enviar email de bienvenida al crear</span>
          </label>
          {err && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">{err}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-xl border border-violet-500/30 bg-violet-500/15 py-3 text-sm font-black text-violet-200 transition-all hover:bg-violet-500/25 disabled:opacity-40">
            {loading ? "Creando..." : "Crear Profesor"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Gestionar (suscripción + pago + notificaciones + historial) ────────
function ModalGestionar({ profesor, onClose, onSaved, onToast }: {
  profesor: Profesor; onClose: () => void; onSaved: () => void;
  onToast: (msg: string, t: "ok" | "err") => void;
}) {
  const sub = profesor.subscription;
  type Tab = "sub" | "pago" | "notif" | "hist" | "admin" | "log";
  const [tab, setTab] = useState<Tab>("sub");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Suscripción form
  const [sf, setSf] = useState({
    planTipo: sub?.planTipo ?? "basico", estado: sub?.estado ?? "trial",
    maxAlumnos: String(sub?.maxAlumnos ?? 30), maxPlanes: String(sub?.maxPlanes ?? 5),
    fechaVencimiento: sub?.fechaVencimiento?.slice(0, 10) ?? "",
    moneda: sub?.moneda ?? "USD", importe: String(sub?.importe ?? 0),
    periodoDias: String(sub?.periodoDias ?? 30), notas: sub?.notas ?? "",
  });

  // Pago form
  const today = new Date().toISOString().slice(0, 10);
  const periodoHastaDefault = new Date(Date.now() + (+sf.periodoDias || 30) * 86400000).toISOString().slice(0, 10);
  const [pf, setPf] = useState({
    monto: String(sub?.importe ?? 0), moneda: sub?.moneda ?? "USD",
    metodoPago: "transferencia", fechaPago: today,
    periodoDesde: today, periodoHasta: periodoHastaDefault, notas: "",
    notifEmail: true, notifWA: false,
  });

  // Notificación form
  const [nf, setNf] = useState<{
    type: NotifType; mensajeExtra: string; email: boolean; wa: boolean;
    diasRestantes: string;
  }>({
    type: "aviso_personalizado", mensajeExtra: "", email: true, wa: false, diasRestantes: "7",
  });
  const [notifSending, setNotifSending] = useState(false);

  const pagos = sub?.pagos ?? [];

  async function saveSub(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr("");
    try {
      const r = await fetch("/api/superadmin/subscriptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profesorId: profesor.id, ...sf, maxAlumnos: +sf.maxAlumnos, maxPlanes: +sf.maxPlanes, importe: +sf.importe, periodoDias: +sf.periodoDias, fechaVencimiento: sf.fechaVencimiento || null }),
      });
      if (!r.ok) throw new Error("Error al guardar");
      onSaved(); onToast("Suscripción guardada", "ok"); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr("");
    try {
      await fetch("/api/superadmin/subscriptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profesorId: profesor.id, ...sf, maxAlumnos: +sf.maxAlumnos, maxPlanes: +sf.maxPlanes, importe: +sf.importe, periodoDias: +sf.periodoDias }),
      });
      const fr = await (await fetch(`/api/superadmin/profesores/${profesor.id}`)).json();
      const subId = fr.profesor?.subscription?.id;
      if (!subId) throw new Error("No se encontró la suscripción");
      const r = await fetch(`/api/superadmin/subscriptions/${subId}/pagos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto: +pf.monto, moneda: pf.moneda, metodoPago: pf.metodoPago, fechaPago: pf.fechaPago, periodoDesde: pf.periodoDesde, periodoHasta: pf.periodoHasta, notas: pf.notas }),
      });
      if (!r.ok) throw new Error("Error al registrar pago");

      // Auto-notificación si se seleccionó
      const channels: string[] = [];
      if (pf.notifEmail) channels.push("email");
      if (pf.notifWA) channels.push("whatsapp");
      if (channels.length) {
        await fetch("/api/superadmin/notify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "pago_confirmado", profesorId: profesor.id, channels,
            monto: pf.monto, moneda: pf.moneda, metodoPago: pf.metodoPago,
            periodoHasta: pf.periodoHasta, planTipo: sf.planTipo,
          }),
        });
      }
      onSaved(); onToast("Pago registrado" + (channels.length ? " y notificación enviada" : ""), "ok"); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function sendNotif(e: React.FormEvent) {
    e.preventDefault(); setNotifSending(true); setErr("");
    const channels: string[] = [];
    if (nf.email) channels.push("email");
    if (nf.wa) channels.push("whatsapp");
    if (!channels.length) { setErr("Seleccioná al menos un canal"); setNotifSending(false); return; }
    try {
      const r = await fetch("/api/superadmin/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: nf.type, profesorId: profesor.id, channels,
          diasRestantes: nf.type === "vencimiento_proximo" ? +nf.diasRestantes : undefined,
          periodoHasta: sub?.fechaVencimiento ?? undefined,
          planTipo: sub?.planTipo ?? sf.planTipo,
          mensajeExtra: nf.mensajeExtra || undefined,
        }),
      });
      const d = await r.json();
      const emailOk = d.result?.email?.sent;
      const waOk    = d.result?.whatsapp?.sent;
      const waErr   = d.result?.whatsapp?.error;
      let msg = "";
      if (channels.includes("email") && emailOk) msg += "Email enviado. ";
      if (channels.includes("email") && !emailOk) msg += "Email falló. ";
      if (channels.includes("whatsapp") && waOk) msg += "WhatsApp enviado.";
      if (channels.includes("whatsapp") && !waOk) msg += `WhatsApp falló${waErr === "sin_telefono" ? " (sin teléfono)" : ""}.`;
      onToast(msg.trim() || "Notificación enviada", emailOk || waOk ? "ok" : "err");
      if (emailOk || waOk) { setNf(n => ({ ...n, mensajeExtra: "" })); }
    } catch (e: any) { setErr(e.message); }
    finally { setNotifSending(false); }
  }

  // Estado tab Admin
  const [pw, setPw]             = useState({ nueva: "", confirmar: "", saving: false, err: "", ok: false });
  const [loginLink, setLoginLink] = useState<{ url: string; exp: string } | null>(null);
  const [genLink, setGenLink]   = useState(false);
  const [infoForm, setInfoForm] = useState({ nombre: profesor.nombreCompleto, email: profesor.email, telefono: profesor.telefono ?? "" });
  const [infoSaving, setInfoSaving] = useState(false);
  const [showBaja, setShowBaja]   = useState(false);
  const [bajando,  setBajando]    = useState(false);

  // Estado tab Log (auditoría por profesor)
  const [logRows, setLogRows]     = useState<AuditRow[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logFetched, setLogFetched] = useState(false);

  // Notas internas
  const [notasText, setNotasText]       = useState(profesor.notasInternas ?? "");
  const [notasSaving, setNotasSaving]   = useState(false);
  const [notasOk, setNotasOk]           = useState(false);

  async function saveNotas() {
    setNotasSaving(true); setNotasOk(false);
    await fetch(`/api/superadmin/profesores/${profesor.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notasInternas: notasText }),
    });
    setNotasSaving(false); setNotasOk(true);
    setTimeout(() => setNotasOk(false), 2500);
  }

  // Estado editar/eliminar pago
  const [editPago, setEditPago]   = useState<Pago | null>(null);
  const [editPagoForm, setEditPagoForm] = useState<{
    monto: string; moneda: string; metodoPago: string;
    fechaPago: string; periodoDesde: string; periodoHasta: string; notas: string;
  } | null>(null);
  const [editPagoSaving, setEditPagoSaving] = useState(false);
  const [deletingPagoId, setDeletingPagoId] = useState<string | null>(null);

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.nueva.length < 6) { setPw(p => ({ ...p, err: "Mínimo 6 caracteres" })); return; }
    if (pw.nueva !== pw.confirmar) { setPw(p => ({ ...p, err: "Las contraseñas no coinciden" })); return; }
    setPw(p => ({ ...p, saving: true, err: "" }));
    try {
      const r = await fetch(`/api/superadmin/profesores/${profesor.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pw.nueva }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Error"); }
      setPw(p => ({ ...p, nueva: "", confirmar: "", ok: true, saving: false }));
      onToast("Contraseña actualizada", "ok");
    } catch (e: any) { setPw(p => ({ ...p, err: e.message, saving: false })); }
  }

  async function generarLink() {
    setGenLink(true);
    try {
      const r = await fetch(`/api/superadmin/profesores/${profesor.id}/login-link`, { method: "POST" });
      const d = await r.json();
      if (d.ok) { setLoginLink({ url: d.link, exp: d.expiresAt }); }
      else onToast("Error al generar link", "err");
    } catch { onToast("Error de conexión", "err"); }
    finally { setGenLink(false); }
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault(); setInfoSaving(true);
    try {
      const r = await fetch(`/api/superadmin/profesores/${profesor.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreCompleto: infoForm.nombre, email: infoForm.email, telefono: infoForm.telefono || null }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Error"); }
      onSaved(); onToast("Datos actualizados", "ok");
    } catch (e: any) { onToast(e.message, "err"); }
    finally { setInfoSaving(false); }
  }

  async function darBaja() {
    setBajando(true);
    try {
      await fetch(`/api/superadmin/profesores/${profesor.id}`, { method: "DELETE" });
      onToast("Profesor dado de baja", "ok"); onSaved(); onClose();
    } catch { onToast("Error al dar de baja", "err"); }
    finally { setBajando(false); }
  }

  async function fetchLog() {
    if (logFetched) return;
    setLogLoading(true);
    try {
      const r = await fetch(`/api/superadmin/audit?profesorEmail=${encodeURIComponent(profesor.email)}&limit=50`);
      const d = await r.json();
      setLogRows(d.logs ?? []);
      setLogFetched(true);
    } catch {}
    finally { setLogLoading(false); }
  }

  function openEditPago(p: Pago) {
    setEditPago(p);
    setEditPagoForm({
      monto:        String(p.monto),
      moneda:       p.moneda,
      metodoPago:   p.metodoPago,
      fechaPago:    p.fechaPago.slice(0, 10),
      periodoDesde: p.periodoDesde.slice(0, 10),
      periodoHasta: p.periodoHasta.slice(0, 10),
      notas:        p.notas ?? "",
    });
  }

  async function saveEditPago(e: React.FormEvent) {
    e.preventDefault();
    if (!editPago || !editPagoForm || !sub?.id) return;
    setEditPagoSaving(true);
    try {
      const r = await fetch(`/api/superadmin/subscriptions/${sub.id}/pagos/${editPago.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPagoForm),
      });
      if (!r.ok) throw new Error("Error al guardar");
      onToast("Pago actualizado", "ok");
      setEditPago(null); setEditPagoForm(null);
      onSaved();
    } catch { onToast("Error al guardar", "err"); }
    finally { setEditPagoSaving(false); }
  }

  async function deletePago(pagoId: string) {
    if (!sub?.id) return;
    setDeletingPagoId(pagoId);
    try {
      await fetch(`/api/superadmin/subscriptions/${sub.id}/pagos/${pagoId}`, { method: "DELETE" });
      onToast("Pago eliminado", "ok");
      onSaved();
    } catch { onToast("Error al eliminar", "err"); }
    finally { setDeletingPagoId(null); }
  }

  const TABS: [Tab, string][] = [
    ["sub","Suscripción"],["pago","Cobro"],["notif","Notificar"],
    ["hist",`Historial${pagos.length ? ` (${pagos.length})` : ""}`],
    ["admin","Admin"],["log","Log"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-[#0e1012]" style={{ maxHeight: "92vh" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.05] px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-sm font-black text-fuchsia-300">{ini(profesor.nombreCompleto, profesor.email)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">{profesor.nombreCompleto}</p>
            <p className="truncate text-[11px] text-slate-500">{profesor.email}</p>
          </div>
          {sub && <SubPill estado={sub.estado} />}
          {profesor.telefono && (
            <a href={waLink(profesor.telefono)} target="_blank" rel="noopener noreferrer"
              title={`WhatsApp: ${profesor.telefono}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-sm text-emerald-300 transition-colors hover:bg-emerald-500/20">
              💬
            </a>
          )}
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-white transition-colors">✕</button>
        </div>
        {/* Tabs */}
        <div className="flex shrink-0 border-b border-white/[0.05] px-6">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setTab(id); if (id === "log") fetchLog(); }}
              className={`mr-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] border-b-2 transition-colors ${tab === id ? "border-fuchsia-400 text-fuchsia-300" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Suscripción */}
          {tab === "sub" && (
            <form onSubmit={saveSub} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Plan</p>
                  <select value={sf.planTipo} onChange={e => setSf(f => ({ ...f, planTipo: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none">
                    <option value="basico">Básico</option><option value="pro">Pro</option><option value="elite">Elite</option>
                  </select>
                </div>
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Estado</p>
                  <select value={sf.estado} onChange={e => setSf(f => ({ ...f, estado: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none">
                    <option value="trial">Trial</option><option value="activo">Activo</option>
                    <option value="suspendido">Suspendido</option><option value="vencido">Vencido</option><option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Máx. alumnos</p>
                  <input type="number" min="1" value={sf.maxAlumnos} onChange={e => setSf(f => ({ ...f, maxAlumnos: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Máx. planes</p>
                  <input type="number" min="1" value={sf.maxPlanes} onChange={e => setSf(f => ({ ...f, maxPlanes: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Importe</p>
                  <div className="flex gap-2">
                    <select value={sf.moneda} onChange={e => setSf(f => ({ ...f, moneda: e.target.value }))} className="w-[4.5rem] rounded-xl border border-white/[0.06] bg-white/[0.04] px-2 py-2.5 text-sm text-white focus:outline-none">
                      <option value="USD">USD</option><option value="ARS">ARS</option>
                    </select>
                    <input type="number" min="0" value={sf.importe} onChange={e => setSf(f => ({ ...f, importe: e.target.value }))} className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:outline-none" />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Período (días)</p>
                  <input type="number" min="1" value={sf.periodoDias} onChange={e => setSf(f => ({ ...f, periodoDias: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none" />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Vencimiento</p>
                <input type="date" value={sf.fechaVencimiento} onChange={e => setSf(f => ({ ...f, fechaVencimiento: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none" />
              </div>
              <div>
                <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Notas internas</p>
                <textarea rows={2} value={sf.notas} onChange={e => setSf(f => ({ ...f, notas: e.target.value }))} className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none" />
              </div>
              {err && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">{err}</p>}
              <button type="submit" disabled={saving} className="w-full rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 py-3 text-sm font-black text-fuchsia-200 transition-all hover:bg-fuchsia-500/20 disabled:opacity-40">
                {saving ? "Guardando..." : "Guardar suscripción"}
              </button>
            </form>
          )}

          {/* Cobro */}
          {tab === "pago" && (
            <form onSubmit={registrarPago} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Monto</p>
                  <div className="flex gap-2">
                    <select value={pf.moneda} onChange={e => setPf(f => ({ ...f, moneda: e.target.value }))} className="w-[4.5rem] rounded-xl border border-white/[0.06] bg-white/[0.04] px-2 py-2.5 text-sm text-white focus:outline-none">
                      <option value="USD">USD</option><option value="ARS">ARS</option>
                    </select>
                    <input type="number" min="0" value={pf.monto} onChange={e => setPf(f => ({ ...f, monto: e.target.value }))} className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:outline-none" />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Método</p>
                  <select value={pf.metodoPago} onChange={e => setPf(f => ({ ...f, metodoPago: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none">
                    <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option><option value="crypto">Crypto</option><option value="otro">Otro</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Fecha de pago</p>
                <input type="date" value={pf.fechaPago} onChange={e => setPf(f => ({ ...f, fechaPago: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Período desde</p>
                  <input type="date" value={pf.periodoDesde} onChange={e => setPf(f => ({ ...f, periodoDesde: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Período hasta</p>
                  <input type="date" value={pf.periodoHasta} onChange={e => setPf(f => ({ ...f, periodoHasta: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none" />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Nota</p>
                <input type="text" value={pf.notas} onChange={e => setPf(f => ({ ...f, notas: e.target.value }))} placeholder="Opcional..." className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none" />
              </div>
              {/* Notificación automática */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5">
                <p className="mb-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Notificar al confirmar pago</p>
                <div className="flex gap-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={pf.notifEmail} onChange={e => setPf(f => ({ ...f, notifEmail: e.target.checked }))} className="accent-fuchsia-500" />
                    <span className="text-sm text-slate-300">Email</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={pf.notifWA} onChange={e => setPf(f => ({ ...f, notifWA: e.target.checked }))} className="accent-emerald-500" />
                    <span className="text-sm text-slate-300">WhatsApp</span>
                    {!profesor.telefono && <span className="text-[10px] text-slate-600">(sin tel.)</span>}
                  </label>
                </div>
              </div>
              {err && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">{err}</p>}
              <button type="submit" disabled={saving} className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-black text-emerald-200 transition-all hover:bg-emerald-500/20 disabled:opacity-40">
                {saving ? "Registrando..." : "✓ Confirmar cobro"}
              </button>
              <p className="text-center text-[10px] text-slate-600">El cobro activa automáticamente la suscripción</p>
            </form>
          )}

          {/* Notificar */}
          {tab === "notif" && (
            <form onSubmit={sendNotif} className="space-y-3">
              <div>
                <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Tipo de notificación</p>
                <select value={nf.type} onChange={e => setNf(f => ({ ...f, type: e.target.value as NotifType }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none">
                  {(Object.entries(NOTIF_LABELS) as [NotifType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {nf.type === "vencimiento_proximo" && (
                <div>
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Días restantes (para el mensaje)</p>
                  <input type="number" min="0" value={nf.diasRestantes} onChange={e => setNf(f => ({ ...f, diasRestantes: e.target.value }))} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none" />
                </div>
              )}
              <div>
                <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  {nf.type === "aviso_personalizado" ? "Mensaje *" : "Mensaje adicional (opcional)"}
                </p>
                <textarea rows={4} value={nf.mensajeExtra} onChange={e => setNf(f => ({ ...f, mensajeExtra: e.target.value }))}
                  required={nf.type === "aviso_personalizado"}
                  placeholder={nf.type === "aviso_personalizado" ? "Escribí el aviso aquí..." : "Agregar nota extra al mensaje..."}
                  className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none" />
              </div>
              {/* Canales */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5">
                <p className="mb-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Enviar por</p>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={nf.email} onChange={e => setNf(f => ({ ...f, email: e.target.checked }))} className="accent-fuchsia-500" />
                    <span className="text-sm text-slate-300">📧 Email</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={nf.wa} onChange={e => setNf(f => ({ ...f, wa: e.target.checked }))} className="accent-emerald-500" />
                    <span className="text-sm text-slate-300">💬 WhatsApp</span>
                    {!profesor.telefono && <span className="text-[10px] text-slate-600">(sin tel.)</span>}
                  </label>
                </div>
              </div>
              {!profesor.telefono && nf.wa && (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
                  Este profesor no tiene teléfono registrado. El WhatsApp no se enviará.
                </p>
              )}
              {err && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">{err}</p>}
              <button type="submit" disabled={notifSending} className="w-full rounded-xl border border-sky-500/30 bg-sky-500/10 py-3 text-sm font-black text-sky-200 transition-all hover:bg-sky-500/20 disabled:opacity-40">
                {notifSending ? "Enviando..." : "Enviar notificación"}
              </button>
            </form>
          )}

          {/* Historial */}
          {tab === "hist" && (
            <div className="space-y-2.5">
              {pagos.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-slate-600"><p className="text-4xl mb-3">💸</p><p className="text-sm">Sin cobros registrados</p></div>
              ) : pagos.map(p => (
                <div key={p.id} className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-emerald-400">{fmtMoney(p.monto, p.moneda)}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/[0.06] px-2.5 py-0.5 text-[10px] capitalize text-slate-500">{p.metodoPago}</span>
                      <button type="button" onClick={() => window.open(`/api/superadmin/recibo/${p.id}`, "_blank")}
                        title="Ver comprobante"
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.06] text-xs text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300">
                        🧾
                      </button>
                      <button type="button" onClick={() => openEditPago(p)}
                        title="Editar pago"
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400 transition-colors hover:bg-amber-500/15">
                        ✏️
                      </button>
                      <button type="button"
                        disabled={deletingPagoId === p.id}
                        onClick={() => { if (confirm("¿Eliminar este pago? Esta acción no se puede deshacer.")) deletePago(p.id); }}
                        title="Eliminar pago"
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-40">
                        {deletingPagoId === p.id ? "…" : "🗑"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">Período: {fmtDate(p.periodoDesde)} → {fmtDate(p.periodoHasta)}</p>
                  {p.notas && <p className="mt-1 text-[11px] italic text-slate-600">"{p.notas}"</p>}
                  <p className="mt-0.5 text-[10px] text-slate-700">Registrado: {fmtDate(p.fechaPago)}</p>
                </div>
              ))}

              {/* Modal editar pago */}
              {editPago && editPagoForm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-sm rounded-2xl border border-amber-500/20 bg-[#0e1012] p-6 shadow-2xl">
                    <p className="mb-1 text-sm font-black text-white">✏️ Editar cobro</p>
                    <p className="mb-4 text-[10px] text-slate-600">{fmtMoney(editPago.monto, editPago.moneda)} · {fmtDate(editPago.fechaPago)}</p>
                    <form onSubmit={saveEditPago} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Monto</p>
                          <div className="flex gap-1.5">
                            <select value={editPagoForm.moneda} onChange={e => setEditPagoForm(f => f ? { ...f, moneda: e.target.value } : f)}
                              className="w-[4rem] rounded-xl border border-white/[0.06] bg-white/[0.04] px-2 py-2 text-xs text-white focus:outline-none">
                              <option value="USD">USD</option><option value="ARS">ARS</option>
                            </select>
                            <input type="number" min="0" value={editPagoForm.monto}
                              onChange={e => setEditPagoForm(f => f ? { ...f, monto: e.target.value } : f)}
                              className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.04] px-2 py-2 text-sm text-white focus:outline-none" />
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Método</p>
                          <select value={editPagoForm.metodoPago} onChange={e => setEditPagoForm(f => f ? { ...f, metodoPago: e.target.value } : f)}
                            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-2 py-2 text-sm text-white focus:outline-none">
                            <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta</option><option value="crypto">Crypto</option><option value="otro">Otro</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Fecha de pago</p>
                        <input type="date" value={editPagoForm.fechaPago} onChange={e => setEditPagoForm(f => f ? { ...f, fechaPago: e.target.value } : f)}
                          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Período desde</p>
                          <input type="date" value={editPagoForm.periodoDesde} onChange={e => setEditPagoForm(f => f ? { ...f, periodoDesde: e.target.value } : f)}
                            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none" />
                        </div>
                        <div>
                          <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Período hasta</p>
                          <input type="date" value={editPagoForm.periodoHasta} onChange={e => setEditPagoForm(f => f ? { ...f, periodoHasta: e.target.value } : f)}
                            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Nota</p>
                        <input type="text" value={editPagoForm.notas} onChange={e => setEditPagoForm(f => f ? { ...f, notas: e.target.value } : f)}
                          placeholder="Opcional..."
                          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="submit" disabled={editPagoSaving}
                          className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/15 py-2.5 text-sm font-black text-amber-200 transition-all hover:bg-amber-500/25 disabled:opacity-40">
                          {editPagoSaving ? "Guardando..." : "Guardar cambios"}
                        </button>
                        <button type="button" onClick={() => { setEditPago(null); setEditPagoForm(null); }}
                          className="flex-1 rounded-xl border border-white/[0.06] py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-300">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Log ── */}
          {tab === "log" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
                  Acciones registradas para este profesor
                </p>
                <button type="button" onClick={() => { setLogFetched(false); fetchLog(); }}
                  className="text-[10px] text-slate-600 transition-colors hover:text-slate-400">↺ Recargar</button>
              </div>
              {logLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <svg className="h-5 w-5 animate-spin text-fuchsia-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              ) : logRows.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-slate-600">
                  <p className="text-3xl mb-3">📋</p>
                  <p className="text-sm">Sin acciones registradas</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03] overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02]">
                  {logRows.map(r => {
                    const m = AUDIT_META[r.accion] ?? { icon: "⚡", label: r.accion, color: "text-slate-400" };
                    return (
                      <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                        <span className="mt-0.5 shrink-0 text-sm">{m.icon}</span>
                        <div className="min-w-0 flex-1">
                          <span className={`text-[11px] font-bold ${m.color}`}>{m.label}</span>
                          <p className="mt-0.5 truncate text-[10px] text-slate-600">{r.detalle}</p>
                        </div>
                        <p className="shrink-0 text-[10px] text-slate-700 whitespace-nowrap">{fmtDate(r.createdAt)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Admin ── */}
          {tab === "admin" && (
            <div className="space-y-5">

              {/* Editar datos */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-base">✏️</span>
                  <p className="text-sm font-bold text-white">Editar datos</p>
                </div>
                <form onSubmit={saveInfo} className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Nombre completo</p>
                    <input type="text" value={infoForm.nombre}
                      onChange={e => setInfoForm(f => ({ ...f, nombre: e.target.value }))}
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-violet-500/40 focus:outline-none" />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Email</p>
                    <input type="email" value={infoForm.email}
                      onChange={e => setInfoForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-violet-500/40 focus:outline-none" />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Teléfono</p>
                    <input type="text" value={infoForm.telefono}
                      onChange={e => setInfoForm(f => ({ ...f, telefono: e.target.value }))}
                      placeholder="+54 9 11..."
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500/40 focus:outline-none" />
                  </div>
                  <button type="submit" disabled={infoSaving}
                    className="w-full rounded-xl border border-violet-500/25 bg-violet-500/10 py-2.5 text-sm font-black text-violet-300 transition-all hover:bg-violet-500/20 disabled:opacity-40">
                    {infoSaving ? "Guardando..." : "Guardar datos"}
                  </button>
                </form>
              </div>

              {/* Cambiar contraseña */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-base">🔑</span>
                  <p className="text-sm font-bold text-white">Cambiar contraseña</p>
                </div>
                <form onSubmit={cambiarPassword} className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Nueva contraseña</p>
                    <input type="password" value={pw.nueva} onChange={e => setPw(p => ({ ...p, nueva: e.target.value, ok: false, err: "" }))}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500/40 focus:outline-none" />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Confirmar contraseña</p>
                    <input type="password" value={pw.confirmar} onChange={e => setPw(p => ({ ...p, confirmar: e.target.value, ok: false, err: "" }))}
                      placeholder="Repetir contraseña"
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500/40 focus:outline-none" />
                  </div>
                  {pw.err && <p className="text-xs text-red-400">{pw.err}</p>}
                  {pw.ok  && <p className="text-xs text-emerald-400">✓ Contraseña actualizada</p>}
                  <button type="submit" disabled={pw.saving || !pw.nueva}
                    className="w-full rounded-xl border border-violet-500/25 bg-violet-500/10 py-2.5 text-sm font-black text-violet-300 transition-all hover:bg-violet-500/20 disabled:opacity-40">
                    {pw.saving ? "Guardando..." : "Actualizar contraseña"}
                  </button>
                </form>
              </div>

              {/* Link de acceso temporal */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-base">🔗</span>
                  <div>
                    <p className="text-sm font-bold text-white">Link de acceso temporal</p>
                    <p className="text-[10px] text-slate-600">Genera un link de inicio de sesión válido por 1 hora</p>
                  </div>
                </div>
                {!loginLink ? (
                  <button type="button" onClick={generarLink} disabled={genLink}
                    className="w-full rounded-xl border border-sky-500/25 bg-sky-500/10 py-2.5 text-sm font-black text-sky-300 transition-all hover:bg-sky-500/20 disabled:opacity-40">
                    {genLink ? "Generando..." : "Generar link"}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
                      <p className="break-all text-[11px] text-sky-400 font-mono">{loginLink.url}</p>
                      <p className="mt-1.5 text-[9px] text-slate-600">
                        Expira: {new Date(loginLink.exp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => window.open(loginLink.url, "_blank")}
                        className="flex-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 py-2 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500/20">
                        🚀 Entrar como
                      </button>
                      <button type="button"
                        onClick={() => { navigator.clipboard.writeText(loginLink.url); onToast("Link copiado", "ok"); }}
                        className="flex-1 rounded-xl border border-sky-500/25 bg-sky-500/10 py-2 text-xs font-bold text-sky-300 transition-all hover:bg-sky-500/20">
                        Copiar
                      </button>
                      <button type="button" onClick={() => setLoginLink(null)}
                        className="rounded-xl border border-white/[0.06] px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:text-slate-300">
                        ↺
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Notas internas ── */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-base">📝</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">Notas internas</p>
                    <p className="text-[10px] text-slate-600">Solo visibles para el superadmin</p>
                  </div>
                  {notasOk && <span className="text-[10px] font-bold text-emerald-400">✓ Guardado</span>}
                </div>
                <textarea
                  value={notasText}
                  onChange={e => { setNotasText(e.target.value); setNotasOk(false); }}
                  rows={4}
                  placeholder="Ej: Prometió pagar el viernes · descuento acordado 20% · revisar en 2 semanas..."
                  className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-700 focus:border-violet-500/40 focus:outline-none"
                />
                <button type="button" onClick={saveNotas} disabled={notasSaving}
                  className="mt-3 w-full rounded-xl border border-violet-500/25 bg-violet-500/10 py-2.5 text-sm font-black text-violet-300 transition-all hover:bg-violet-500/20 disabled:opacity-40">
                  {notasSaving ? "Guardando..." : "Guardar notas"}
                </button>
              </div>

              {/* ── Zona peligrosa ── */}
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-base">🗑</span>
                  <div>
                    <p className="text-sm font-bold text-white">Zona peligrosa</p>
                    <p className="text-[10px] text-slate-600">Soft delete — el profesor pierde acceso pero sus datos quedan</p>
                  </div>
                </div>
                {!showBaja ? (
                  <button type="button" onClick={() => setShowBaja(true)}
                    className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-black text-red-300 transition-all hover:bg-red-500/20">
                    Dar de baja
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-red-400">¿Confirmar? El estado pasará a "baja". Podés reactivarlo luego desde Gestionar → Suscripción.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={darBaja} disabled={bajando}
                        className="flex-1 rounded-xl border border-red-500/30 bg-red-500/15 py-2 text-sm font-black text-red-300 transition-all hover:bg-red-500/25 disabled:opacity-40">
                        {bajando ? "Procesando..." : "Confirmar baja"}
                      </button>
                      <button type="button" onClick={() => setShowBaja(false)}
                        className="flex-1 rounded-xl border border-white/[0.06] py-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-300">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── AlertasWidget ────────────────────────────────────────────────────────────
function AlertasWidget() {
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/superadmin/alertas")
      .then(r => r.json())
      .then(d => setAlertas(d.alertas ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || alertas.length === 0) return null;

  const NIVEL: Record<AlertaItem["nivel"], { bg: string; bar: string; icon: string; text: string }> = {
    critico: { bg: "border-red-500/20 bg-red-500/5",    bar: "bg-red-500",    icon: "🔴", text: "text-red-300"    },
    warning: { bg: "border-amber-500/20 bg-amber-500/5", bar: "bg-amber-400",  icon: "🟡", text: "text-amber-300"  },
    info:    { bg: "border-sky-500/20 bg-sky-500/5",     bar: "bg-sky-400",    icon: "🔵", text: "text-sky-300"    },
  };
  const criticos = alertas.filter(a => a.nivel === "critico").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0e1012]">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-sm">⚠️</span>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Alertas del sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[9px] font-black text-slate-500">{alertas.length} alerta{alertas.length > 1 ? "s" : ""}</span>
          {criticos > 0 && (
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[9px] font-black text-red-400">{criticos} crítico{criticos > 1 ? "s" : ""}</span>
          )}
        </div>
      </div>
      <div className="divide-y divide-white/[0.03]">
        {alertas.map((a, i) => {
          const m = NIVEL[a.nivel];
          return (
            <div key={i} className={`flex items-start gap-3 px-5 py-3.5 border-l-2 ${m.bg} ${a.nivel === "critico" ? "border-l-red-500" : a.nivel === "warning" ? "border-l-amber-400" : "border-l-sky-400"}`}>
              <span className="mt-0.5 shrink-0 text-sm">{m.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${m.text}`}>{a.titulo}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">{a.detalle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ data, onToast, onManage, onSection, lastSync, onRefresh }: { data: Profesor[]; onToast: (msg: string, t: "ok" | "err") => void; onManage: (p: Profesor) => void; onSection: (s: Section) => void; lastSync?: number; onRefresh?: () => void }) {
  const [bulkSending, setBulkSending] = useState(false);
  const activos  = data.filter(p => p.subscription?.estado === "activo").length;
  const trial    = data.filter(p => p.subscription?.estado === "trial").length;
  const susp     = data.filter(p => p.subscription?.estado === "suspendido" || p.estado === "suspendido").length;
  const totalAl  = data.reduce((a, p) => a + p.alumnosCount, 0);
  const ingresoUSD = data.filter(p => p.subscription?.estado === "activo" && p.subscription.moneda === "USD").reduce((a, p) => a + (p.subscription?.importe ?? 0), 0);
  const ingresoARS = data.filter(p => p.subscription?.estado === "activo" && p.subscription.moneda === "ARS").reduce((a, p) => a + (p.subscription?.importe ?? 0), 0);

  const porVencer = data
    .filter(p => { const d = daysUntil(p.subscription?.fechaVencimiento); return d !== null && d >= 0 && d <= 10; })
    .sort((a, b) => (daysUntil(a.subscription?.fechaVencimiento) ?? 99) - (daysUntil(b.subscription?.fechaVencimiento) ?? 99));

  const recientes = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  async function enviarRecordatorios(channels: ("email" | "whatsapp")[]) {
    setBulkSending(true);
    try {
      const r = await fetch("/api/superadmin/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk: true, diasUmbral: 10, channels }),
      });
      const d = await r.json();
      onToast(`Recordatorios: ${d.sent} enviados, ${d.skipped} sin vencer, ${d.failed} fallidos`, d.sent > 0 ? "ok" : "err");
    } catch { onToast("Error al enviar recordatorios", "err"); }
    finally { setBulkSending(false); }
  }

  return (
    <div className="space-y-5">
      {/* Alertas inteligentes */}
      <AlertasWidget />
      {/* Refresh bar */}
      {lastSync ? (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-700">
            Actualizado {timeAgo(lastSync)} · se refresca cada 30s
          </p>
          {onRefresh && (
            <button type="button" onClick={onRefresh}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-1.5 text-[10px] font-bold text-slate-600 transition-all hover:bg-white/[0.05] hover:text-slate-300">
              ↺ Refrescar
            </button>
          )}
        </div>
      ) : null}
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label:"Profesores",   val:data.length, sub:`${activos} activos`,        icon:"👤", border:"border-violet-500/15", from:"from-violet-500/10" },
          { label:"Alumnos",      val:totalAl,     sub:"en toda la plataforma",     icon:"🏋️", border:"border-sky-500/15",    from:"from-sky-500/10"    },
          { label:"En trial",     val:trial,       sub:"pendientes de convertir",   icon:"⏳", border:"border-amber-500/15",  from:"from-amber-500/10"  },
          { label:"Suspendidos",  val:susp,        sub:"sin acceso activo",         icon:"🚫", border:"border-red-500/15",    from:"from-red-500/10"    },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border ${k.border} bg-gradient-to-br ${k.from} to-transparent p-5`}>
            <div className="mb-3 flex items-start justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{k.label}</p>
              <span className="text-lg leading-none">{k.icon}</span>
            </div>
            <p className="text-3xl font-black text-white">{k.val}</p>
            <p className="mt-1 text-[11px] text-slate-600">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Por vencer */}
        <div className="overflow-hidden rounded-2xl border border-amber-500/15 bg-[#0e1012]">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,1)]" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400/70">Por vencer (10 días)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-400">{porVencer.length}</span>
              <button type="button" onClick={() => onSection("finanzas")}
                className="text-[9px] text-amber-400/40 transition-colors hover:text-amber-400">Forecast →</button>
            </div>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {porVencer.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-600">Todo en orden ✓</p>
            ) : porVencer.map(p => {
              const d = daysUntil(p.subscription?.fechaVencimiento);
              return (
                <div key={p.id} className="flex min-w-0 items-center gap-3 px-5 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-xs font-black text-amber-300">{ini(p.nombreCompleto, p.email)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{p.nombreCompleto}</p>
                    <p className="truncate text-[11px] text-slate-600">{p.email}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-black ${d === 0 ? "text-red-400" : d! <= 3 ? "text-orange-400" : "text-amber-400"}`}>{d === 0 ? "HOY" : `${d}d`}</span>
                  {p.telefono && (
                    <a href={waLink(p.telefono)} target="_blank" rel="noopener noreferrer"
                      title={`WhatsApp: ${p.telefono}`}
                      className="shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300 transition-colors hover:bg-emerald-500/20">
                      💬
                    </a>
                  )}
                  <button type="button" onClick={() => onManage(p)} title="Registrar cobro"
                    className="shrink-0 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-2 py-1 text-[9px] font-black text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20">
                    💳
                  </button>
                </div>
              );
            })}
          </div>
          {/* Botones de recordatorio bulk */}
          {porVencer.length > 0 && (
            <div className="border-t border-white/[0.04] flex gap-2 p-3">
              <button type="button" disabled={bulkSending} onClick={() => enviarRecordatorios(["email"])}
                className="flex-1 rounded-lg border border-amber-500/20 bg-amber-500/10 py-2 text-[11px] font-black text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-40">
                {bulkSending ? "Enviando..." : "📧 Email a todos"}
              </button>
              <button type="button" disabled={bulkSending} onClick={() => enviarRecordatorios(["email","whatsapp"])}
                className="flex-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 py-2 text-[11px] font-black text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-40">
                {bulkSending ? "..." : "📧+💬 Email & WA"}
              </button>
            </div>
          )}
        </div>

        {/* Últimos registros */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0e1012]">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-0.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,1)]" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-400/70">Últimos registros</p>
            </div>
            <button type="button" onClick={() => onSection("profesores")}
              className="text-[9px] text-violet-400/40 transition-colors hover:text-violet-400">Ver todos →</button>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {recientes.map(p => (
              <div key={p.id} className="flex min-w-0 items-center gap-3 px-5 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xs font-black text-violet-300">{ini(p.nombreCompleto, p.email)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{p.nombreCompleto}</p>
                  <p className="truncate text-[11px] text-slate-600">{fmtDate(p.createdAt)}</p>
                </div>
                <div className="shrink-0">{p.subscription ? <SubPill estado={p.subscription.estado} /> : <span className="text-[10px] text-slate-600">Sin plan</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trials activos */}
      {(() => {
        const trials = data
          .filter(p => p.subscription?.estado === "trial")
          .map(p => {
            const dias = daysUntil(p.subscription?.fechaVencimiento);
            const diasEnTrial = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000);
            return { p, dias, diasEnTrial };
          })
          .sort((a, b) => {
            // Primero los que tienen vencimiento próximo, luego los más viejos en trial
            if (a.dias !== null && b.dias !== null) return a.dias - b.dias;
            if (a.dias !== null) return -1;
            if (b.dias !== null) return 1;
            return b.diasEnTrial - a.diasEnTrial;
          });

        if (trials.length === 0) return null;
        return (
          <div className="overflow-hidden rounded-2xl border border-sky-500/15 bg-[#0e1012]">
            <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-0.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,1)]" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-400/70">Trials activos</p>
                <span className="rounded-full bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-black text-sky-400">{trials.length}</span>
              </div>
              <button type="button" onClick={() => onSection("profesores")}
                className="text-[9px] text-sky-400/40 transition-colors hover:text-sky-400">Ver todos →</button>
            </div>
            <div className="flex gap-0 divide-x divide-white/[0.03] overflow-x-auto">
              {trials.map(({ p, dias, diasEnTrial }) => (
                <div key={p.id} className="flex min-w-[180px] shrink-0 flex-col gap-2 px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-[10px] font-black text-sky-300">
                      {ini(p.nombreCompleto, p.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-white max-w-[110px]">{p.nombreCompleto}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {dias !== null
                      ? <span className={`text-[10px] font-bold ${dias <= 2 ? "text-red-400" : dias <= 5 ? "text-orange-400" : "text-sky-400"}`}>
                          {dias === 0 ? "Vence HOY" : dias < 0 ? "Venció" : `Vence en ${dias}d`}
                        </span>
                      : <span className="text-[10px] text-slate-600">{diasEnTrial}d en trial</span>
                    }
                    <button type="button" onClick={() => onManage(p)} title="Convertir a activo"
                      className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-2 py-1 text-[9px] font-black text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20">
                      💳
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Actividad reciente del panel */}
      <AuditMini onSection={onSection} />

      {/* Facturación */}
      <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/8 to-transparent p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-3 w-0.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,1)]" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/70">Facturación mensual estimada</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label:"USD / mes",  val:fmtMoney(ingresoUSD,"USD"), color:"text-emerald-300" },
            { label:"ARS / mes",  val:fmtMoney(ingresoARS,"ARS"), color:"text-sky-300"     },
            { label:"Activos",    val:String(activos),             color:"text-white"       },
            { label:"Sin plan",   val:String(data.filter(p => !p.subscription).length), color:"text-slate-500" },
          ].map(s => (
            <div key={s.label}>
              <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Profesores ───────────────────────────────────────────────────────────────
function Profesores({ data, onManage, onToggle, onCrear, onToast }: {
  data: Profesor[]; onManage: (p: Profesor) => void; onToggle: (p: Profesor) => void; onCrear: () => void;
  onToast: (msg: string, t: "ok" | "err") => void;
}) {
  const [q, setQ]           = useState("");
  const [filter, setFilter] = useState("todos");
  const [plan,   setPlan]   = useState("todos");
  const [sortBy,  setSortBy]  = useState<"nombre" | "plan" | "alumnos" | "vencimiento">("nombre");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  // CSV Import
  const [showImport, setShowImport]   = useState(false);
  const [importText, setImportText]   = useState("");
  const [importRows, setImportRows]   = useState<any[]>([]);
  const [importStep, setImportStep]   = useState<"paste"|"preview"|"done">("paste");
  const [importResult, setImportResult] = useState<{ created: string[]; skipped: string[]; errors: { email: string; reason: string }[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  function parseImportCSV(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
    return lines.slice(1).map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      const row: any = {};
      header.forEach((h, i) => { row[h] = cols[i] ?? ""; });
      return row;
    }).filter(r => r.email);
  }

  function openImport() {
    setImportText(""); setImportRows([]); setImportStep("paste");
    setImportResult(null); setShowImport(true);
  }

  function handleImportPreview() {
    const rows = parseImportCSV(importText);
    if (rows.length === 0) { onToast("No se encontraron filas válidas", "err"); return; }
    setImportRows(rows); setImportStep("preview");
  }

  async function handleImportSubmit() {
    setImportLoading(true);
    const res = await fetch("/api/superadmin/profesores/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: importRows }),
    });
    const d = await res.json();
    setImportResult(d); setImportStep("done"); setImportLoading(false);
    if (d.created?.length > 0) onToast(`${d.created.length} profesores importados`, "ok");
  }

  const IMPORT_TEMPLATE = `email,nombre,telefono,password,plan,maxAlumnos\njuan@ejemplo.com,Juan Pérez,1155551234,pass1234,basico,30\nana@ejemplo.com,Ana García,1166669999,pass5678,pro,50`;

  function toggleSortP(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortBy(col); setSortDir(1); }
  }
  function toggleSelect(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll(ids: string[]) { setSelected(new Set(ids)); }
  function clearSelection() { setSelected(new Set()); }
  const FILTERS = [
    { id:"todos",label:"Todos" },{ id:"activo",label:"Activos" },{ id:"trial",label:"Trial" },
    { id:"suspendido",label:"Suspendidos" },{ id:"vencido",label:"Vencidos" },{ id:"sin-plan",label:"Sin plan" },
  ];
  const filtered = data.filter(p => {
    const matchQ    = !q    || p.nombreCompleto.toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase());
    const matchPlan = plan === "todos" || p.subscription?.planTipo === plan;
    const est       = p.subscription?.estado ?? "sin-plan";
    return matchQ && matchPlan && (filter === "todos" || est === filter || (filter === "sin-plan" && !p.subscription));
  }).sort((a, b) => {
    const d = sortDir;
    if (sortBy === "alumnos")    return (a.alumnosCount - b.alumnosCount) * d;
    if (sortBy === "plan")       return (a.subscription?.planTipo ?? "").localeCompare(b.subscription?.planTipo ?? "") * d;
    if (sortBy === "vencimiento") {
      const va = daysUntil(a.subscription?.fechaVencimiento) ?? 9999;
      const vb = daysUntil(b.subscription?.fechaVencimiento) ?? 9999;
      return (va - vb) * d;
    }
    return (a.nombreCompleto || a.email).localeCompare(b.nombreCompleto || b.email) * d;
  });

  async function bulkSuspend() {
    setBulkSending(true);
    const targets = data.filter(p => selected.has(p.id) && p.estado === "activo");
    await Promise.allSettled(targets.map(p =>
      fetch(`/api/superadmin/profesores/${p.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "suspendido" }),
      })
    ));
    onToast(`${targets.length} profesor${targets.length !== 1 ? "es" : ""} suspendido${targets.length !== 1 ? "s" : ""}`, "ok");
    clearSelection(); setBulkSending(false);
  }

  async function bulkEmail() {
    setBulkSending(true);
    const targets = data.filter(p => selected.has(p.id));
    let sent = 0;
    await Promise.allSettled(targets.map(async p => {
      const r = await fetch("/api/superadmin/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "aviso_personalizado", profesorId: p.id, channels: ["email"], mensajeExtra: "" }),
      });
      const d = await r.json();
      if (d.result?.email?.sent) sent++;
    }));
    onToast(`${sent}/${targets.length} emails enviados`, sent > 0 ? "ok" : "err");
    clearSelection(); setBulkSending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 px-5 py-3.5">
          <span className="text-sm font-black text-violet-300">{selected.size} seleccionado{selected.size !== 1 ? "s" : ""}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={bulkSending} onClick={bulkSuspend}
              className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-40">
              {bulkSending ? "..." : "🚫 Suspender"}
            </button>
            <button type="button" disabled={bulkSending} onClick={bulkEmail}
              className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[10px] font-black text-sky-300 transition-colors hover:bg-sky-500/20 disabled:opacity-40">
              {bulkSending ? "..." : "📧 Email"}
            </button>
            <button type="button"
              onClick={() => {
                const sel = data.filter(p => selected.has(p.id));
                const csvRows = [
                  ["Nombre","Email","Teléfono","Estado","Plan","Est. Suscripción","Alumnos","Vencimiento"],
                  ...sel.map(p => [
                    p.nombreCompleto, p.email, p.telefono ?? "", p.estado,
                    p.subscription?.planTipo ?? "", p.subscription?.estado ?? "",
                    String(p.alumnosCount),
                    p.subscription?.fechaVencimiento ? fmtDate(p.subscription.fechaVencimiento) : "",
                  ]),
                ];
                downloadCSV(csvRows, `profesores-seleccionados-${new Date().toISOString().slice(0,10)}.csv`);
              }}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-300 transition-colors hover:bg-emerald-500/20">
              📥 Exportar
            </button>
          </div>
          <button type="button" onClick={clearSelection} className="ml-auto text-[10px] text-slate-600 transition-colors hover:text-slate-400">✕ Limpiar</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar..."
          className="h-10 w-48 shrink-0 rounded-xl border border-white/[0.06] bg-[#0e1012] px-4 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/30 focus:outline-none transition-colors" />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] border transition-all ${filter === f.id ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-white/[0.05] bg-white/[0.03] text-slate-500 hover:text-slate-300"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={plan} onChange={e => setPlan(e.target.value)}
          className="h-10 rounded-xl border border-white/[0.06] bg-[#0e1012] px-3 text-[11px] font-semibold text-slate-400 focus:outline-none focus:border-violet-500/30 transition-colors">
          <option value="todos">Plan: todos</option>
          <option value="basico">Básico</option>
          <option value="pro">Pro</option>
          <option value="elite">Elite</option>
        </select>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {filtered.length > 0 && (
            <button type="button"
              onClick={() => {
                const csvRows = [
                  ["Nombre","Email","Teléfono","Estado","Plan","Est. Suscripción","Alumnos","Máx. Alumnos","Importe","Moneda","Vencimiento"],
                  ...filtered.map(p => [
                    p.nombreCompleto, p.email, p.telefono ?? "", p.estado,
                    p.subscription?.planTipo ?? "", p.subscription?.estado ?? "",
                    String(p.alumnosCount), String(p.subscription?.maxAlumnos ?? ""),
                    String(p.subscription?.importe ?? ""), p.subscription?.moneda ?? "",
                    p.subscription?.fechaVencimiento ? fmtDate(p.subscription.fechaVencimiento) : "",
                  ]),
                ];
                downloadCSV(csvRows, `profesores-${new Date().toISOString().slice(0,10)}.csv`);
              }}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-[11px] font-bold text-slate-500 transition-all hover:bg-white/[0.06] hover:text-slate-300">
              📥 CSV
            </button>
          )}
          <button type="button" onClick={openImport}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-[11px] font-bold text-slate-500 transition-all hover:bg-white/[0.06] hover:text-slate-300">
            📤 Importar
          </button>
          <button type="button" onClick={onCrear}
            className="flex h-10 items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 text-sm font-black text-violet-200 transition-all hover:bg-violet-500/20">
            + Nuevo
          </button>
        </div>
      </div>

      {/* ── CSV Import Modal ─────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowImport(false)} />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e1012] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div>
                <h2 className="text-base font-black text-white">Importar Profesores</h2>
                <p className="text-[11px] text-slate-500">
                  {importStep === "paste" && "Pegá el CSV con los datos"}
                  {importStep === "preview" && `${importRows.length} fila${importRows.length !== 1 ? "s" : ""} listas para importar`}
                  {importStep === "done" && "Importación completada"}
                </p>
              </div>
              <button type="button" onClick={() => setShowImport(false)}
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* STEP 1: Paste */}
              {importStep === "paste" && (<>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">Columnas: <code className="rounded bg-white/[0.05] px-1 py-0.5 text-[10px] text-violet-300">email, nombre, telefono, password, plan, maxAlumnos</code></p>
                  <button type="button"
                    onClick={() => downloadCSV([["email","nombre","telefono","password","plan","maxAlumnos"],["juan@ejemplo.com","Juan Pérez","1155551234","pass1234","basico","30"],["ana@ejemplo.com","Ana García","1166669999","pass5678","pro","50"]], "plantilla-profesores.csv")}
                    className="text-[10px] font-bold text-violet-400 transition-colors hover:text-violet-200">
                    ⬇ Descargar plantilla
                  </button>
                </div>
                <textarea
                  value={importText} onChange={e => setImportText(e.target.value)}
                  placeholder={IMPORT_TEMPLATE}
                  rows={10}
                  className="w-full rounded-xl border border-white/[0.06] bg-[#0e1012] p-4 font-mono text-[11px] text-slate-300 placeholder:text-slate-700 focus:border-violet-500/30 focus:outline-none resize-none"
                />
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowImport(false)}
                    className="rounded-xl border border-white/[0.06] px-4 py-2 text-[11px] font-bold text-slate-500 transition-colors hover:bg-white/[0.04]">
                    Cancelar
                  </button>
                  <button type="button" onClick={handleImportPreview} disabled={!importText.trim()}
                    className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-5 py-2 text-[11px] font-black text-violet-200 transition-all hover:bg-violet-500/20 disabled:opacity-40">
                    Vista previa →
                  </button>
                </div>
              </>)}

              {/* STEP 2: Preview */}
              {importStep === "preview" && (<>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-white/[0.05] bg-[#0e1012]">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-[#0e1012]">
                      <tr className="border-b border-white/[0.05]">
                        {["Email","Nombre","Teléfono","Plan","MaxAlumnos"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {importRows.map((r, i) => (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-slate-300 font-mono">{r.email}</td>
                          <td className="px-3 py-2 text-slate-400">{r.nombre || r.nombreCompleto || "—"}</td>
                          <td className="px-3 py-2 text-slate-500">{r.telefono || "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${r.plan === "pro" ? "bg-violet-500/10 text-violet-300" : r.plan === "elite" ? "bg-amber-500/10 text-amber-300" : "bg-slate-500/10 text-slate-400"}`}>
                              {r.plan || "basico"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{r.maxAlumnos || "30"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-600">Los emails ya existentes serán omitidos. La contraseña se genera aleatoriamente si no se especifica.</p>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setImportStep("paste")}
                    className="rounded-xl border border-white/[0.06] px-4 py-2 text-[11px] font-bold text-slate-500 transition-colors hover:bg-white/[0.04]">
                    ← Volver
                  </button>
                  <button type="button" onClick={handleImportSubmit} disabled={importLoading}
                    className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-2 text-[11px] font-black text-emerald-200 transition-all hover:bg-emerald-500/20 disabled:opacity-40">
                    {importLoading ? "Importando..." : `✓ Importar ${importRows.length} profesores`}
                  </button>
                </div>
              </>)}

              {/* STEP 3: Results */}
              {importStep === "done" && importResult && (<>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                    <p className="text-2xl font-black text-emerald-300">{importResult.created.length}</p>
                    <p className="mt-1 text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Creados</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                    <p className="text-2xl font-black text-amber-300">{importResult.skipped.length}</p>
                    <p className="mt-1 text-[10px] font-bold text-amber-500/70 uppercase tracking-widest">Omitidos</p>
                  </div>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                    <p className="text-2xl font-black text-red-300">{importResult.errors.length}</p>
                    <p className="mt-1 text-[10px] font-bold text-red-500/70 uppercase tracking-widest">Errores</p>
                  </div>
                </div>
                {importResult.skipped.length > 0 && (
                  <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-3">
                    <p className="mb-1.5 text-[10px] font-black text-amber-400 uppercase tracking-widest">Emails ya existentes (omitidos)</p>
                    <p className="font-mono text-[10px] text-amber-300/70">{importResult.skipped.join(", ")}</p>
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-3 space-y-1">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Errores</p>
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="font-mono text-[10px] text-red-300/70">{e.email}: {e.reason}</p>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <button type="button" onClick={() => setShowImport(false)}
                    className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-6 py-2 text-[11px] font-black text-violet-200 transition-all hover:bg-violet-500/20">
                    Cerrar
                  </button>
                </div>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-white/[0.05] text-slate-600">Sin resultados</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0e1012]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="w-10 px-4 py-3">
                    <button type="button"
                      onClick={() => selected.size === filtered.length ? clearSelection() : selectAll(filtered.map(p => p.id))}
                      className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] transition-all ${selected.size === filtered.length && filtered.length > 0 ? "border-violet-500 bg-violet-500/30 text-violet-200" : "border-white/10 bg-white/[0.03] text-slate-600 hover:border-white/20"}`}>
                      {selected.size === filtered.length && filtered.length > 0 ? "✓" : selected.size > 0 ? "−" : ""}
                    </button>
                  </th>
                  {([["nombre","Profesor"],["plan","Plan"],["alumnos","Alumnos"],["vencimiento","Vencimiento"]] as const).map(([col, label]) => (
                    <th key={col} onClick={() => toggleSortP(col)}
                      className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 hover:text-slate-400 transition-colors select-none">
                      {label} <span className="ml-0.5 opacity-60">{sortBy === col ? (sortDir === 1 ? "↑" : "↓") : "↕"}</span>
                    </th>
                  ))}
                  {["Estado","Acciones"].map(h => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.map(p => {
                  const sub = p.subscription;
                  const d = daysUntil(sub?.fechaVencimiento);
                  const isSelected = selected.has(p.id);
                  return (
                    <tr key={p.id} className={`transition-colors ${isSelected ? "bg-violet-500/5 hover:bg-violet-500/8" : "hover:bg-white/[0.02]"}`}>
                      <td className="w-10 px-4 py-3.5">
                        <button type="button" onClick={e => { e.stopPropagation(); toggleSelect(p.id); }}
                          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] transition-all ${isSelected ? "border-violet-500 bg-violet-500/30 text-violet-200" : "border-white/10 bg-white/[0.03] text-slate-600 hover:border-white/20"}`}>
                          {isSelected ? "✓" : ""}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <button type="button" onClick={() => onManage(p)} className="flex min-w-0 w-full items-center gap-3 text-left transition-opacity hover:opacity-75">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${p.estado === "activo" ? "bg-violet-500/10 text-violet-300" : "bg-slate-500/10 text-slate-500"}`}>{ini(p.nombreCompleto, p.email)}</div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{p.nombreCompleto}</p>
                            <p
                              className="cursor-pointer truncate text-[11px] text-slate-600 transition-colors hover:text-slate-400"
                              title="Copiar email"
                              onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(p.email).then(() => onToast("Email copiado", "ok")).catch(() => {}); }}>
                              {p.email}
                            </p>
                          </div>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">{sub ? <PlanPill plan={sub.planTipo} /> : <span className="text-[11px] text-slate-600">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="text-sm font-bold text-white">{p.alumnosCount}</span>
                        {sub && <span className="ml-1 text-[11px] text-slate-600">/ {sub.maxAlumnos}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {d == null ? <span className="text-[11px] text-slate-600">—</span> : (
                          <div>
                            <p className={`text-sm font-bold ${d <= 0 ? "text-red-400" : d <= 7 ? "text-amber-400" : "text-slate-300"}`}>{d <= 0 ? "Vencido" : `${d}d`}</p>
                            <p className="text-[10px] text-slate-600">{fmtDate(sub?.fechaVencimiento)}</p>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">{sub ? <SubPill estado={sub.estado} /> : <span className="text-[10px] italic text-slate-600">Sin plan</span>}</td>
                      {/* Acciones — siempre visibles, sin superposición */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => onManage(p)}
                            className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1.5 text-[10px] font-black text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20">
                            Gestionar
                          </button>
                          {p.telefono && (
                            <a href={waLink(p.telefono)} target="_blank" rel="noopener noreferrer"
                              title={`WhatsApp: ${p.telefono}`}
                              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black text-emerald-300 transition-colors hover:bg-emerald-500/20">
                              💬
                            </a>
                          )}
                          <button type="button" onClick={() => onToggle(p)}
                            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition-colors ${p.estado === "activo" ? "border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"}`}>
                            {p.estado === "activo" ? "Suspender" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cobros ───────────────────────────────────────────────────────────────────
function Cobros({ data, onManage }: { data: Profesor[]; onManage: (p: Profesor) => void }) {
  type PagoRow = Pago & { nombre: string; email: string; plan: string };
  const [q,           setQ]           = useState("");
  const [metodo,      setMetodo]      = useState("todos");
  const [moneda,      setMoneda]      = useState("todos");
  const [fechaFilter, setFechaFilter] = useState<"todos" | "mes" | "mes_ant" | "3meses" | "custom">("todos");
  const [fechaDesde,  setFechaDesde]  = useState("");
  const [fechaHasta,  setFechaHasta]  = useState("");
  const [sortC,  setSortC]  = useState<"fecha" | "monto" | "nombre" | "plan">("fecha");
  const [sortDC, setSortDC] = useState<1 | -1>(-1);
  function toggleSortC(col: typeof sortC) {
    if (sortC === col) setSortDC(d => d === 1 ? -1 : 1);
    else { setSortC(col); setSortDC(col === "fecha" ? -1 : 1); }
  }

  const allRows: PagoRow[] = [];
  for (const p of data)
    for (const g of p.subscription?.pagos ?? [])
      allRows.push({ ...g, nombre: p.nombreCompleto, email: p.email, plan: p.subscription?.planTipo ?? "" });
  allRows.sort((a, b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime());

  const rows = allRows.filter(r => {
    const matchQ      = !q || r.nombre.toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase());
    const matchMetodo = metodo === "todos" || r.metodoPago === metodo;
    const matchMoneda = moneda === "todos" || r.moneda === moneda;
    let matchFecha = true;
    if (fechaFilter !== "todos") {
      const fp  = new Date(r.fechaPago);
      const now = new Date();
      if (fechaFilter === "mes") {
        matchFecha = fp.getFullYear() === now.getFullYear() && fp.getMonth() === now.getMonth();
      } else if (fechaFilter === "mes_ant") {
        const ant = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        matchFecha = fp.getFullYear() === ant.getFullYear() && fp.getMonth() === ant.getMonth();
      } else if (fechaFilter === "3meses") {
        const threeAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        matchFecha = fp >= threeAgo;
      } else if (fechaFilter === "custom") {
        if (fechaDesde) matchFecha = fp >= new Date(fechaDesde);
        if (fechaHasta) matchFecha = matchFecha && fp <= new Date(fechaHasta + "T23:59:59");
      }
    }
    return matchQ && matchMetodo && matchMoneda && matchFecha;
  }).sort((a, b) => {
    const d = sortDC;
    if (sortC === "monto")  return (a.monto - b.monto) * d;
    if (sortC === "nombre") return a.nombre.localeCompare(b.nombre) * d;
    if (sortC === "plan")   return a.plan.localeCompare(b.plan) * d;
    return (new Date(a.fechaPago).getTime() - new Date(b.fechaPago).getTime()) * d;
  });

  const totalUSD = rows.filter(r => r.moneda === "USD").reduce((a, r) => a + r.monto, 0);
  const totalARS = rows.filter(r => r.moneda === "ARS").reduce((a, r) => a + r.monto, 0);
  const METODOS  = ["todos","transferencia","efectivo","tarjeta","crypto","otro"];
  const hasFilter = q || metodo !== "todos" || moneda !== "todos" || fechaFilter !== "todos";

  return (
    <div className="space-y-4">
      {/* KPIs — reaccionan a filtros */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label:"Total USD",     val:fmtMoney(totalUSD,"USD"), color:"text-emerald-400" },
          { label:"Total ARS",     val:fmtMoney(totalARS,"ARS"), color:"text-sky-400"     },
          { label:"Transacciones", val:String(rows.length),       color:"text-white"       },
          { label:"Profesores",    val:String(new Set(rows.map(r => r.email)).size), color:"text-violet-400" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-5">
            <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-slate-600">{s.label}{hasFilter ? " (filtrado)" : ""}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar profesor..."
          className="h-9 w-44 shrink-0 rounded-xl border border-white/[0.06] bg-[#0e1012] px-4 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/30 focus:outline-none transition-colors" />
        <div className="flex flex-wrap gap-1.5">
          {METODOS.map(m => (
            <button key={m} type="button" onClick={() => setMetodo(m)}
              className={`rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] transition-all ${metodo === m ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-white/[0.05] bg-white/[0.03] text-slate-500 hover:text-slate-300"}`}>
              {m === "todos" ? "Métodos" : m}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {["todos","USD","ARS"].map(c => (
            <button key={c} type="button" onClick={() => setMoneda(c)}
              className={`rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] transition-all ${moneda === c ? "border-sky-500/30 bg-sky-500/15 text-sky-300" : "border-white/[0.05] bg-white/[0.03] text-slate-500 hover:text-slate-300"}`}>
              {c === "todos" ? "USD+ARS" : c}
            </button>
          ))}
        </div>
        {/* Fecha */}
        <div className="flex flex-wrap gap-1.5">
          {([["todos","📅 Fechas"],["mes","Este mes"],["mes_ant","Mes ant."],["3meses","3 meses"],["custom","Custom"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFechaFilter(id)}
              className={`rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] transition-all ${fechaFilter === id ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-white/[0.05] bg-white/[0.03] text-slate-500 hover:text-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>
        {fechaFilter === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
              className="h-9 rounded-xl border border-white/[0.06] bg-[#0e1012] px-3 text-sm text-white focus:border-violet-500/30 focus:outline-none transition-colors" />
            <span className="text-slate-600 text-xs">→</span>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
              className="h-9 rounded-xl border border-white/[0.06] bg-[#0e1012] px-3 text-sm text-white focus:border-violet-500/30 focus:outline-none transition-colors" />
          </div>
        )}
        {hasFilter && (
          <button type="button" onClick={() => { setQ(""); setMetodo("todos"); setMoneda("todos"); setFechaFilter("todos"); setFechaDesde(""); setFechaHasta(""); }}
            className="text-[11px] text-slate-600 transition-colors hover:text-slate-400">✕ Limpiar</button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0e1012]">
        <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-0.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,1)]" />
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/70">Historial</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-600">{rows.length} cobro{rows.length !== 1 ? "s" : ""}</span>
            {rows.length > 0 && (
              <button type="button"
                onClick={() => {
                  const csvRows = [
                    ["Profesor","Email","Plan","Monto","Moneda","Método","Período desde","Período hasta","Fecha pago","Notas"],
                    ...rows.map(r => [
                      r.nombre, r.email, r.plan,
                      String(r.monto), r.moneda, r.metodoPago,
                      fmtDate(r.periodoDesde), fmtDate(r.periodoHasta),
                      fmtDate(r.fechaPago), r.notas ?? "",
                    ]),
                  ];
                  downloadCSV(csvRows, `cobros-${new Date().toISOString().slice(0,10)}.csv`);
                }}
                className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold text-slate-500 transition-colors hover:text-slate-300 hover:bg-white/[0.06]">
                📥 CSV
              </button>
            )}
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-slate-600">
            <p className="text-4xl mb-2">💸</p>
            <p className="text-sm">{allRows.length > 0 ? "Sin resultados para ese filtro" : "Sin cobros aún"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {([["nombre","Profesor"],["plan","Plan"],["monto","Monto"]] as const).map(([col,label]) => (
                    <th key={col} onClick={() => toggleSortC(col)}
                      className="cursor-pointer whitespace-nowrap px-5 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 hover:text-slate-400 transition-colors select-none">
                      {label} <span className="ml-0.5 opacity-60">{sortC === col ? (sortDC === 1 ? "↑" : "↓") : "↕"}</span>
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-5 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">Método</th>
                  <th className="whitespace-nowrap px-5 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">Período</th>
                  <th onClick={() => toggleSortC("fecha")}
                    className="cursor-pointer whitespace-nowrap px-5 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 hover:text-slate-400 transition-colors select-none">
                    Fecha <span className="ml-0.5 opacity-60">{sortC === "fecha" ? (sortDC === 1 ? "↑" : "↓") : "↕"}</span>
                  </th>
                  <th className="whitespace-nowrap px-5 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {rows.map(r => (
                  <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <button type="button"
                        onClick={() => { const p = data.find(x => x.email === r.email); if (p) onManage(p); }}
                        className="text-left transition-opacity hover:opacity-70">
                        <p className="text-sm font-semibold text-white">{r.nombre}</p>
                        <p className="text-[11px] text-slate-600">{r.email}</p>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">{r.plan ? <PlanPill plan={r.plan} /> : <span className="text-[11px] text-slate-600">—</span>}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm font-black text-emerald-400">{fmtMoney(r.monto, r.moneda)}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[11px] capitalize text-slate-400">{r.metodoPago}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-slate-500">{fmtDate(r.periodoDesde)} → {fmtDate(r.periodoHasta)}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-slate-600">{fmtDate(r.fechaPago)}</td>
                    <td className="px-3 py-3.5">
                      <button type="button" onClick={() => window.open(`/api/superadmin/recibo/${r.id}`, "_blank")}
                        title="Ver comprobante"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] text-xs text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300">
                        🧾
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Automatización ───────────────────────────────────────────────────────────
type CronResult = {
  timestamp: string;
  diasUmbral: number;
  diasGracia: number;
  channels: string[];
  warnings: { sent: number; failed: number; skipped: number };
  suspended: number;
  suspendedList: string[];
};

function Automatizacion({ onToast }: { onToast: (m: string, t: "ok" | "err") => void }) {
  const [lastRun, setLastRun]   = useState<CronResult | null>(null);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty,  setConfigDirty]  = useState(false);
  const [history, setHistory]   = useState<{ accion: string; detalle: string; createdAt: string }[]>([]);
  const [config, setConfig]     = useState({
    diasUmbral: 7,
    diasGracia: 3,
    emailOn: true,
    waOn: false,
  });

  useEffect(() => {
    // Load cron last run
    fetch("/api/superadmin/cron/status")
      .then(r => r.json())
      .then(d => { setLastRun(d.lastRun ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load config from DB
    fetch("/api/superadmin/config")
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          const ch = String(d.config["sa-config:cronChannels"] || "email");
          setConfig({
            diasUmbral: Number(d.config["sa-config:diasUmbral"]  ?? 7),
            diasGracia: Number(d.config["sa-config:diasGracia"]  ?? 3),
            emailOn: ch.includes("email"),
            waOn:    ch.includes("whatsapp"),
          });
        }
      })
      .catch(() => {});

    // Load execution history from audit log
    fetch("/api/superadmin/audit?accion=cron_manual&limit=8")
      .then(r => r.json())
      .then(d => { if (d.logs) setHistory(d.logs); })
      .catch(() => {});
  }, []);

  async function saveConfig() {
    setConfigSaving(true);
    const channels: string[] = [];
    if (config.emailOn) channels.push("email");
    if (config.waOn) channels.push("whatsapp");
    try {
      const r = await fetch("/api/superadmin/config", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "sa-config:diasUmbral":   config.diasUmbral,
          "sa-config:diasGracia":   config.diasGracia,
          "sa-config:cronChannels": channels.join(",") || "email",
        }),
      });
      r.ok ? onToast("Configuración guardada", "ok") : onToast("Error al guardar", "err");
      setConfigDirty(false);
    } catch { onToast("Error de conexión", "err"); }
    finally { setConfigSaving(false); }
  }

  function updateConfig(patch: Partial<typeof config>) {
    setConfig(c => ({ ...c, ...patch }));
    setConfigDirty(true);
  }

  async function runNow() {
    setRunning(true);
    try {
      const channels: string[] = [];
      if (config.emailOn) channels.push("email");
      if (config.waOn)    channels.push("whatsapp");
      const r = await fetch("/api/superadmin/cron/recordatorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diasUmbral: config.diasUmbral, diasGracia: config.diasGracia, channels }),
      });
      const d = await r.json();
      if (d.ok) {
        setLastRun(d);
        onToast(`✓ ${d.warnings.sent} avis${d.warnings.sent !== 1 ? "os" : "o"} enviado${d.warnings.sent !== 1 ? "s" : ""} · ${d.suspended} suspendido${d.suspended !== 1 ? "s" : ""}`, "ok");
      } else {
        onToast("Error al ejecutar el cron", "err");
      }
    } catch {
      onToast("Error de conexión", "err");
    } finally {
      setRunning(false);
    }
  }

  function CheckBox({ on, onChange, color = "violet" }: { on: boolean; onChange: () => void; color?: string }) {
    const colors: Record<string, string> = {
      violet:  "border-violet-500 bg-violet-500/20 text-violet-300",
      emerald: "border-emerald-500 bg-emerald-500/20 text-emerald-300",
    };
    return (
      <button type="button"
        onClick={onChange}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${on ? colors[color] : "border-white/10 bg-white/[0.03]"}`}>
        {on && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>}
      </button>
    );
  }

  const canRun = !running && (config.emailOn || config.waOn);

  return (
    <div className="space-y-5">

      {/* Config + trigger */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-lg">🤖</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Recordatorios automáticos</p>
            <p className="text-[11px] text-slate-600">Cron diario · configura en el VPS para que corra solo</p>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-bold text-emerald-400">Activo</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Params */}
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Avisar antes del vencimiento</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={1} max={30}
                  value={config.diasUmbral}
                  onChange={e => updateConfig({ diasUmbral: Number(e.target.value) })}
                  className="w-20 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-center text-sm font-bold text-white focus:border-violet-500/50 focus:outline-none"
                />
                <span className="text-sm text-slate-400">días antes</span>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Días de gracia antes de suspender</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={30}
                  value={config.diasGracia}
                  onChange={e => updateConfig({ diasGracia: Number(e.target.value) })}
                  className="w-20 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-center text-sm font-bold text-white focus:border-violet-500/50 focus:outline-none"
                />
                <span className="text-sm text-slate-400">días de gracia</span>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-600">0 = suspensión inmediata al vencer</p>
            </div>
          </div>

          {/* Channels */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Canales de envío</p>
            <div className="space-y-3">
              <button type="button" onClick={() => updateConfig({ emailOn: !config.emailOn })}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">
                <CheckBox on={config.emailOn} onChange={() => updateConfig({ emailOn: !config.emailOn })} color="violet" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">📧 Email</p>
                  <p className="text-[10px] text-slate-600">Gmail o Brevo según configuración</p>
                </div>
              </button>
              <button type="button" onClick={() => updateConfig({ waOn: !config.waOn })}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">
                <CheckBox on={config.waOn} onChange={() => updateConfig({ waOn: !config.waOn })} color="emerald" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">💬 WhatsApp</p>
                  <p className="text-[10px] text-slate-600">Solo profes con teléfono cargado</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.04] pt-5">
          <button type="button" onClick={saveConfig} disabled={configSaving || !configDirty}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-bold text-emerald-300 transition-all hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40">
            {configSaving ? "Guardando..." : configDirty ? "💾 Guardar config" : "✓ Config guardada"}
          </button>
          <button type="button" onClick={runNow} disabled={!canRun}
            className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/15 px-5 py-2.5 text-sm font-bold text-violet-300 transition-all hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40">
            {running
              ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Ejecutando...</>
              : <><span>▶</span> Ejecutar ahora</>
            }
          </button>
          <p className="text-[11px] text-slate-600">La config se usa en el próximo cron automático</p>
        </div>
      </div>

      {/* Last run */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-lg">📋</span>
          <div>
            <p className="text-sm font-bold text-white">Última ejecución</p>
            <p className="text-[11px] text-slate-600">
              {loading ? "Cargando..." : lastRun ? fmtDate(lastRun.timestamp) : "Sin ejecuciones aún"}
            </p>
          </div>
          {lastRun && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {lastRun.channels.map(c => (
                <span key={c} className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {c === "email" ? "📧 Email" : "💬 WA"}
                </span>
              ))}
            </div>
          )}
        </div>

        {lastRun ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Avisos enviados", val: String(lastRun.warnings.sent),    color: "text-emerald-400" },
                { label: "Fallidos",        val: String(lastRun.warnings.failed),  color: "text-red-400"    },
                { label: "Sin suscripción", val: String(lastRun.warnings.skipped), color: "text-slate-500"  },
                { label: "Suspendidos",     val: String(lastRun.suspended),        color: "text-amber-400"  },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                  <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-slate-600">{s.label}</p>
                </div>
              ))}
            </div>
            {lastRun.suspendedList.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-amber-400/70">Suspendidos en esta ejecución</p>
                <div className="flex flex-wrap gap-2">
                  {lastRun.suspendedList.map(e => (
                    <span key={e} className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">{e}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : !loading && (
          <div className="flex flex-col items-center py-10 text-slate-600">
            <p className="mb-2 text-3xl">🤖</p>
            <p className="text-sm">Aún no se ejecutó ninguna automatización</p>
            <p className="mt-1 text-[11px]">Presioná "Ejecutar ahora" o configurá el cron en el VPS</p>
          </div>
        )}
      </div>

      {/* Historial de ejecuciones */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-lg">📅</span>
            <div>
              <p className="text-sm font-bold text-white">Historial de ejecuciones</p>
              <p className="text-[11px] text-slate-600">Últimas ejecuciones manuales</p>
            </div>
          </div>
          <div className="space-y-2">
            {history.map((h, i) => {
              const avisos   = h.detalle.match(/avisos:\s*(\d+)/)?.[1] ?? "—";
              const susp     = h.detalle.match(/suspendidos:\s*(\d+)/)?.[1] ?? "—";
              const canales  = h.detalle.match(/canales:\s*([^\s·]+)/)?.[1] ?? "—";
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-[10px] font-black text-violet-400">
                    {history.length - i}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-300">
                      📧 {avisos} avisos · 🚫 {susp} suspendidos · <span className="text-slate-600">{canales}</span>
                    </p>
                    <p className="text-[10px] text-slate-600">{fmtDate(h.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cron setup info */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-lg">⏰</span>
          <div>
            <p className="text-sm font-bold text-white">Setup del cron en VPS</p>
            <p className="text-[11px] text-slate-600">Configura una sola vez en el servidor</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-600">1. Agregar a crontab (corre todos los días a las 9:00 AM)</p>
            <code className="block break-all text-[11px] text-emerald-400">
              {`0 9 * * * curl -s "https://pf-control.com/api/superadmin/cron/recordatorios?secret=$CRON_SECRET&channels=email,whatsapp" >> /var/log/pf-cron.log 2>&1`}
            </code>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-600">2. Agregar CRON_SECRET a .env.production en el VPS</p>
            <code className="block text-[11px] text-sky-400">CRON_SECRET=tu_secret_aqui</code>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-600">3. Ver logs</p>
            <code className="block text-[11px] text-slate-400">tail -f /var/log/pf-cron.log</code>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Actividad ───────────────────────────────────────────────────────────────
type ActividadRow = {
  id: string; email: string; nombreCompleto: string; estado: string;
  createdAt: string; lastLoginAt: string | null; notasInternas: string | null;
  diasSinLogin: number | null; nivelActividad: "activo" | "reciente" | "inactivo" | "nunca";
  alumnosCount: number;
  subscription: { planTipo: string; estado: string; maxAlumnos: number } | null;
};
type ActividadCounts = { activo: number; reciente: number; inactivo: number; nunca: number };

const NIVEL_META: Record<ActividadRow["nivelActividad"], { label: string; color: string; dot: string; icon: string }> = {
  activo:   { label: "Activo",   color: "border-emerald-500/20 text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-400",  icon: "🟢" },
  reciente: { label: "Reciente", color: "border-sky-500/20 text-sky-400 bg-sky-500/10",             dot: "bg-sky-400",      icon: "🔵" },
  inactivo: { label: "Inactivo", color: "border-amber-500/20 text-amber-400 bg-amber-500/10",       dot: "bg-amber-400",   icon: "🟡" },
  nunca:    { label: "Sin datos",color: "border-slate-600/20 text-slate-500 bg-slate-500/10",        dot: "bg-slate-600",   icon: "⚫" },
};

function Actividad({ onToast, onManage }: { onToast: (m: string, t: "ok" | "err") => void; onManage: (id: string) => void }) {
  const [rows, setRows]       = useState<ActividadRow[]>([]);
  const [counts, setCounts]   = useState<ActividadCounts>({ activo: 0, reciente: 0, inactivo: 0, nunca: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all" | ActividadRow["nivelActividad"]>("all");
  const [editNotas, setEditNotas] = useState<{ id: string; text: string } | null>(null);
  const [savingNotas, setSavingNotas] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/superadmin/actividad");
      const d = await r.json();
      setRows(d.profesores ?? []);
      setCounts(d.counts ?? { activo: 0, reciente: 0, inactivo: 0, nunca: 0 });
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveNotas() {
    if (!editNotas) return;
    setSavingNotas(true);
    try {
      await fetch("/api/superadmin/actividad", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profesorId: editNotas.id, notasInternas: editNotas.text || null }),
      });
      setRows(prev => prev.map(r => r.id === editNotas.id ? { ...r, notasInternas: editNotas.text || null } : r));
      onToast("Nota guardada", "ok");
      setEditNotas(null);
    } catch { onToast("Error al guardar", "err"); }
    finally { setSavingNotas(false); }
  }

  const filtered = filter === "all" ? rows : rows.filter(r => r.nivelActividad === filter);

  function fmtLogin(ts: string | null) {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) + " " +
           d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-5">

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          { key: "activo",   label: "Activos ≤7 días",   color: "text-emerald-400", icon: "🟢" },
          { key: "reciente", label: "Recientes ≤30 días", color: "text-sky-400",     icon: "🔵" },
          { key: "inactivo", label: "Inactivos >30 días", color: "text-amber-400",   icon: "🟡" },
          { key: "nunca",    label: "Sin login registrado",color: "text-slate-500",  icon: "⚫" },
        ] as const).map(s => (
          <button key={s.key} type="button"
            onClick={() => setFilter(filter === s.key ? "all" : s.key)}
            className={`rounded-2xl border p-5 text-left transition-all ${filter === s.key ? "border-white/[0.12] bg-white/[0.06]" : "border-white/[0.05] bg-[#0e1012] hover:bg-white/[0.03]"}`}>
            <div className="mb-2 text-xl">{s.icon}</div>
            <p className={`text-2xl font-black ${s.color}`}>{counts[s.key]}</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-slate-600">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[11px] text-slate-600">
          {filtered.length} profesor{filtered.length !== 1 ? "es" : ""}
          {filter !== "all" && ` · filtro: ${NIVEL_META[filter].label}`}
        </p>
        {filter !== "all" && (
          <button type="button" onClick={() => setFilter("all")}
            className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
            ✕ Quitar filtro
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {filtered.length > 0 && (
            <button type="button"
              onClick={() => {
                const csvRows = [
                  ["Nombre","Email","Plan","Est. Suscripción","Alumnos","Último login","Días sin login","Actividad","Notas"],
                  ...filtered.map(r => [
                    r.nombreCompleto, r.email,
                    r.subscription?.planTipo ?? "", r.subscription?.estado ?? "",
                    String(r.alumnosCount),
                    r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString("es-AR") : "—",
                    r.diasSinLogin != null ? String(r.diasSinLogin) : "—",
                    NIVEL_META[r.nivelActividad].label,
                    r.notasInternas ?? "",
                  ]),
                ];
                downloadCSV(csvRows, `actividad-${new Date().toISOString().slice(0,10)}.csv`);
              }}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-400 transition-colors hover:bg-white/[0.06]">
              📥 CSV
            </button>
          )}
          <button type="button" onClick={fetchData}
            className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-400 transition-colors hover:bg-white/[0.06]">
            ↺ Refrescar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0e1012]">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <svg className="h-5 w-5 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-slate-600">
            <p className="mb-2 text-3xl">🔍</p>
            <p className="text-sm">Sin resultados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Profesor", "Plan / Estado", "Alumnos", "Último login", "Actividad", "Notas", ""].map(h => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.025]">
                {filtered.map(r => {
                  const meta = NIVEL_META[r.nivelActividad];
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-white/[0.015]">

                      {/* Profesor */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${r.estado === "activo" ? "bg-violet-500/10 text-violet-300" : "bg-slate-500/10 text-slate-500"}`}>
                            {ini(r.nombreCompleto, r.email)}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0f18] ${meta.dot}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-white max-w-[150px]">{r.nombreCompleto}</p>
                            <p className="truncate text-[10px] text-slate-600 max-w-[150px]">{r.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {r.subscription
                          ? <div className="space-y-1"><PlanPill plan={r.subscription.planTipo} /><SubPill estado={r.subscription.estado} /></div>
                          : <span className="text-[10px] italic text-slate-600">Sin plan</span>}
                      </td>

                      {/* Alumnos */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="text-sm font-bold text-white">{r.alumnosCount}</span>
                        {r.subscription && <span className="ml-1 text-[11px] text-slate-600">/ {r.subscription.maxAlumnos}</span>}
                      </td>

                      {/* Último login */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className="text-[11px] font-semibold text-slate-300">{fmtLogin(r.lastLoginAt)}</p>
                        {r.diasSinLogin !== null && (
                          <p className={`text-[10px] ${r.diasSinLogin > 30 ? "text-amber-500" : r.diasSinLogin > 7 ? "text-sky-500" : "text-emerald-500"}`}>
                            hace {r.diasSinLogin}d
                          </p>
                        )}
                      </td>

                      {/* Nivel */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </td>

                      {/* Notas */}
                      <td className="px-4 py-3.5">
                        <button type="button"
                          onClick={() => setEditNotas({ id: r.id, text: r.notasInternas ?? "" })}
                          className={`max-w-[160px] truncate rounded-lg border px-2 py-1 text-[10px] transition-colors ${r.notasInternas ? "border-violet-500/20 bg-violet-500/5 text-violet-300 hover:bg-violet-500/10" : "border-white/[0.06] bg-white/[0.02] text-slate-600 hover:text-slate-400"}`}>
                          {r.notasInternas ? r.notasInternas : "+ Agregar nota"}
                        </button>
                      </td>
                      {/* Acciones */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <button type="button" onClick={() => onManage(r.id)}
                          className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1.5 text-[10px] font-black text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20">
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal notas */}
      {editNotas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.07] bg-[#0e1012] p-6 shadow-2xl">
            <p className="mb-1 text-sm font-black text-white">📝 Nota interna</p>
            <p className="mb-4 text-[10px] text-slate-600">Solo visible para SUPERADMIN</p>
            <textarea
              rows={4}
              value={editNotas.text}
              onChange={e => setEditNotas(n => n ? { ...n, text: e.target.value } : n)}
              placeholder="Escribí una nota sobre este profesor..."
              className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-violet-500/40 focus:outline-none"
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={saveNotas} disabled={savingNotas}
                className="flex-1 rounded-xl border border-violet-500/30 bg-violet-500/15 py-2.5 text-sm font-black text-violet-300 transition-all hover:bg-violet-500/25 disabled:opacity-40">
                {savingNotas ? "Guardando..." : "Guardar"}
              </button>
              <button type="button" onClick={() => setEditNotas(null)}
                className="flex-1 rounded-xl border border-white/[0.06] py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-300">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Finanzas ────────────────────────────────────────────────────────────────
type FinanzasData = {
  mrr:   { USD: number; ARS: number };
  arr:   { USD: number; ARS: number };
  counts: { active: number; trial: number; suspended: number; total: number };
  churn:  { thisMonth: number; rate: number };
  forecast: Record<"d30" | "d60" | "d90", ForecastItem[]>;
  forecastTotals: Record<"d30" | "d60" | "d90", { USD: number; ARS: number }>;
  trend: { month: string; label: string; USD: number; ARS: number; count: number }[];
  growth: { month: string; label: string; nuevos: number }[];
  conversion: { tasa: number; convertidosTotales: number; nuncaPagaron: number; convertidosEsteMes: number; trialsActivos: number; total: number };
  planBreakdown: Record<string, { count: number; mrrUSD: number; mrrARS: number }>;
  totalRecaudado: number;
};
type ForecastItem = {
  email: string; nombre: string; importe: number; moneda: string;
  planTipo: string; fechaVencimiento: string; diasRestantes: number;
};

function Kpi({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">{label}</p>
        <span className="text-base">{icon}</span>
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] text-slate-600">{sub}</p>
    </div>
  );
}

function Finanzas() {
  const [data, setData]           = useState<FinanzasData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [forecastTab, setForecastTab] = useState<"d30" | "d60" | "d90">("d30");

  useEffect(() => {
    fetch("/api/superadmin/finanzas")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>
    );
  }
  if (!data) return <div className="py-20 text-center text-slate-600">Sin datos</div>;

  function fm(n: number, cur: string) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  }

  const maxTrendUSD = Math.max(...data.trend.map(t => t.USD), 1);
  const prevMonthUSD = data.trend[4]?.USD ?? 0;
  const currMonthUSD = data.trend[5]?.USD ?? 0;
  const momPct = prevMonthUSD > 0 ? Math.round(((currMonthUSD - prevMonthUSD) / prevMonthUSD) * 100) : null;
  const maxGrowth = Math.max(...(data.growth ?? []).map(g => g.nuevos), 1);
  const totalNuevos6m = (data.growth ?? []).reduce((a, g) => a + g.nuevos, 0);
  const forecastList   = data.forecast[forecastTab];
  const forecastTotals = data.forecastTotals[forecastTab];

  return (
    <div className="space-y-5">

      {/* Export */}
      <div className="flex justify-end">
        <button type="button"
          onClick={() => {
            const rows: string[][] = [
              ["Sección","Métrica","Valor","Moneda"],
              ["KPIs","MRR",String(Math.round(data.mrr.USD)),"USD"],
              ["KPIs","MRR",String(Math.round(data.mrr.ARS)),"ARS"],
              ["KPIs","ARR",String(Math.round(data.arr.USD)),"USD"],
              ["KPIs","Activos",String(data.counts.active),""],
              ["KPIs","Trial",String(data.counts.trial),""],
              ["KPIs","Suspendidos",String(data.counts.suspended),""],
              ["KPIs","Churn rate",String(data.churn.rate)+"%",""],
              ["","","",""],
              ["Tendencia","Mes","USD cobrado","Cobros"],
              ...data.trend.map(t => ["Tendencia",t.label,String(t.USD),String(t.count)]),
              ["","","",""],
              ["Planes","Plan","Activos","MRR USD"],
              ...Object.entries(data.planBreakdown).map(([plan, b]) => ["Planes",plan,String(b.count),String(Math.round(b.mrrUSD))]),
            ];
            downloadCSV(rows, `finanzas-${new Date().toISOString().slice(0,10)}.csv`);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-white/[0.06] hover:text-slate-300">
          📥 Exportar reporte
        </button>
      </div>

      {/* KPI row 1 — ingresos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="MRR USD"       value={fm(data.mrr.USD, "USD")}  sub="Ingreso mensual recurrente" color="text-emerald-400" icon="💵" />
        <Kpi label="ARR USD"       value={fm(data.arr.USD, "USD")}  sub="Proyección anual"           color="text-sky-400"     icon="📈" />
        {data.mrr.ARS > 0
          ? <Kpi label="MRR ARS"   value={fm(data.mrr.ARS, "ARS")} sub="Mensual en pesos"           color="text-amber-400"   icon="💸" />
          : <Kpi label="Activos"   value={String(data.counts.active)} sub="Suscripciones vigentes"  color="text-violet-400"  icon="👥" />
        }
        <Kpi label="Churn mensual" value={`${data.churn.rate}%`}
          sub={`${data.churn.thisMonth} no renovaron este mes`}
          color={data.churn.rate >= 20 ? "text-red-400" : data.churn.rate >= 10 ? "text-amber-400" : "text-slate-300"}
          icon="📉" />
      </div>

      {/* KPI row 2 — estados */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Activos"    value={String(data.counts.active)}    sub="Suscripciones vigentes"  color="text-emerald-400" icon="✅" />
        <Kpi label="Trial"      value={String(data.counts.trial)}     sub="En período de prueba"    color="text-sky-400"     icon="🆓" />
        <Kpi label="Suspendidos/Vencidos" value={String(data.counts.suspended)} sub="Sin acceso activo" color="text-red-400" icon="🚫" />
        <Kpi label="Total profesores" value={String(data.counts.total)} sub="Registrados en el sistema" color="text-slate-300" icon="👤" />
      </div>

      {/* Conversión trial → activo */}
      {data.conversion && (
        <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-lg">🎯</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Embudo de conversión</p>
              <p className="text-[11px] text-slate-600">Trial → Pago · todos los tiempos</p>
            </div>
            <div className={`shrink-0 rounded-full border px-3 py-1 text-sm font-black ${
              data.conversion.tasa >= 60 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : data.conversion.tasa >= 30 ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}>
              {data.conversion.tasa}% conversión
            </div>
          </div>

          {/* Funnel bars */}
          <div className="mb-5 space-y-2.5">
            {[
              { label: "Total registrados", val: data.conversion.total, pct: 100, color: "bg-slate-600" },
              { label: "Con al menos 1 pago", val: data.conversion.convertidosTotales, pct: data.conversion.total > 0 ? Math.round((data.conversion.convertidosTotales / data.conversion.total) * 100) : 0, color: "bg-violet-500" },
              { label: "Activos ahora", val: data.counts.active, pct: data.conversion.total > 0 ? Math.round((data.counts.active / data.conversion.total) * 100) : 0, color: "bg-emerald-500" },
            ].map(f => (
              <div key={f.label}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">{f.label}</p>
                  <p className="text-[11px] font-bold text-slate-300">{f.val} <span className="text-slate-600">({f.pct}%)</span></p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div className={`h-full rounded-full transition-all ${f.color}`} style={{ width: `${f.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 border-t border-white/[0.04] pt-4 md:grid-cols-4">
            {[
              { label: "Convertidos total",  val: data.conversion.convertidosTotales, color: "text-violet-300" },
              { label: "Nunca pagaron",       val: data.conversion.nuncaPagaron,       color: "text-red-300"    },
              { label: "Trials activos",      val: data.conversion.trialsActivos,      color: "text-sky-300"    },
              { label: "Pagaron este mes",    val: data.conversion.convertidosEsteMes, color: "text-emerald-300"},
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-center">
                <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-widest text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown por plan */}
      {data.planBreakdown && (
        <div className="grid grid-cols-3 gap-3">
          {(["basico","pro","elite"] as const).map(plan => {
            const b = data.planBreakdown?.[plan] ?? { count: 0, mrrUSD: 0, mrrARS: 0 };
            const META = { basico:{label:"Básico",c:"border-slate-600/40 bg-slate-500/5",t:"text-slate-300"}, pro:{label:"Pro",c:"border-violet-500/30 bg-violet-500/5",t:"text-violet-300"}, elite:{label:"Elite",c:"border-amber-500/30 bg-amber-500/5",t:"text-amber-300"} };
            const m = META[plan];
            return (
              <div key={plan} className={`rounded-2xl border p-4 ${m.c}`}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Plan</p>
                  <PlanPill plan={plan} />
                </div>
                <p className={`text-2xl font-black ${m.t}`}>{b.count}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">activos</p>
                {b.mrrUSD > 0 && <p className="mt-2 text-[11px] font-bold text-emerald-400">{fm(b.mrrUSD,"USD")}/mes</p>}
                {b.mrrARS > 0 && <p className={`${b.mrrUSD > 0 ? "" : "mt-2 "}text-[11px] font-bold text-sky-400`}>{fm(b.mrrARS,"ARS")}/mes</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Gráfico de tendencia + Forecast side by side */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Tendencia mensual */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-lg">📊</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Cobros por mes</p>
              <p className="text-[11px] text-slate-600">Últimos 6 meses · USD</p>
            </div>
            {momPct !== null && (
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${
                momPct > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                momPct < 0 ? "border-red-500/30 bg-red-500/10 text-red-400" :
                "border-white/[0.06] bg-white/[0.03] text-slate-500"
              }`}>
                {momPct > 0 ? "↑ +" : momPct < 0 ? "↓ " : "= "}{momPct}% vs ant.
              </span>
            )}
          </div>
          <div className="flex items-end gap-2" style={{ height: "120px" }}>
            {data.trend.map(t => {
              const pct = maxTrendUSD > 0 ? Math.max((t.USD / maxTrendUSD) * 100, t.USD > 0 ? 6 : 0) : 0;
              const isCurrent = t.month === new Date().toISOString().slice(0, 7);
              return (
                <div key={t.month} className="flex flex-1 flex-col items-center gap-1" style={{ height: "120px" }}>
                  {t.USD > 0 && (
                    <p className="text-[8px] font-bold text-slate-500 text-center leading-tight">
                      {fm(t.USD, "USD").replace("US$", "$")}
                    </p>
                  )}
                  <div className="flex w-full flex-1 flex-col justify-end">
                    <div
                      className={`w-full rounded-t-lg transition-all ${t.USD > 0
                        ? isCurrent
                          ? "bg-gradient-to-t from-violet-600 to-violet-400"
                          : "bg-gradient-to-t from-sky-700 to-sky-500"
                        : "bg-white/[0.03]"
                      }`}
                      style={{ height: `${pct}%`, minHeight: t.USD > 0 ? "6px" : "0" }}
                    />
                  </div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-600">{t.label}</p>
                  {t.count > 0 && <p className="text-[8px] text-slate-700">{t.count}p</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Forecast */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-lg">🔮</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Cobros esperados</p>
              <p className="text-[11px] text-slate-600">Profes que vencen próximamente</p>
            </div>
            <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.03] p-0.5">
              {(["d30", "d60", "d90"] as const).map(d => (
                <button key={d} type="button" onClick={() => setForecastTab(d)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all ${forecastTab === d ? "bg-amber-500/20 text-amber-300" : "text-slate-600 hover:text-slate-300"}`}>
                  {d.replace("d", "")}d
                </button>
              ))}
            </div>
          </div>

          {/* Totales esperados */}
          {(forecastTotals.USD > 0 || forecastTotals.ARS > 0) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {forecastTotals.USD > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2">
                  <p className="text-sm font-black text-amber-300">{fm(forecastTotals.USD, "USD")}</p>
                  <p className="text-[9px] text-slate-600">esperados en USD</p>
                </div>
              )}
              {forecastTotals.ARS > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2">
                  <p className="text-sm font-black text-amber-300">{fm(forecastTotals.ARS, "ARS")}</p>
                  <p className="text-[9px] text-slate-600">esperados en ARS</p>
                </div>
              )}
            </div>
          )}

          {forecastList.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-slate-600">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm">Sin vencimientos en {forecastTab.replace("d", "")} días</p>
            </div>
          ) : (
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {forecastList.map((f, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                    f.diasRestantes <= 3  ? "bg-red-500/15 text-red-300" :
                    f.diasRestantes <= 7  ? "bg-orange-500/15 text-orange-300" :
                    "bg-amber-500/15 text-amber-300"
                  }`}>
                    {f.diasRestantes}d
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[12px] font-semibold text-white">{f.nombre}</p>
                    <p className="truncate text-[10px] text-slate-600">{fmtDate(f.fechaVencimiento)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-black text-emerald-400">{fm(f.importe, f.moneda)}</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-600">{f.planTipo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gráfico de crecimiento */}
      {data.growth && data.growth.length > 0 && (
        <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-lg">🌱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Nuevos profesores por mes</p>
              <p className="text-[11px] text-slate-600">Altas · últimos 6 meses</p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-400">
              {totalNuevos6m} en 6 meses
            </span>
          </div>
          <div className="flex items-end gap-2" style={{ height: "100px" }}>
            {data.growth.map(g => {
              const pct = Math.max((g.nuevos / maxGrowth) * 100, g.nuevos > 0 ? 8 : 0);
              const isCurrent = g.month === new Date().toISOString().slice(0, 7);
              return (
                <div key={g.month} className="flex flex-1 flex-col items-center gap-1" style={{ height: "100px" }}>
                  {g.nuevos > 0 && (
                    <p className="text-[9px] font-bold text-slate-500">{g.nuevos}</p>
                  )}
                  <div className="flex w-full flex-1 flex-col justify-end">
                    <div
                      className={`w-full rounded-t-lg transition-all ${g.nuevos > 0
                        ? isCurrent ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                                    : "bg-gradient-to-t from-emerald-800 to-emerald-600"
                        : "bg-white/[0.03]"}`}
                      style={{ height: `${pct}%`, minHeight: g.nuevos > 0 ? "6px" : "0" }}
                    />
                  </div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-600">{g.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Historial de notificaciones ─────────────────────────────────────────────
type NotifLog = {
  id: string;
  profesorEmail: string;
  profesorNombre: string;
  tipo: string;
  canales: string;
  emailEnviado: boolean;
  emailError: string | null;
  waEnviado: boolean;
  waError: string | null;
  createdAt: string;
};

const TIPO_META: Record<string, { label: string; color: string; emoji: string }> = {
  pago_confirmado:        { label: "Pago confirmado",   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", emoji: "✅" },
  vencimiento_proximo:    { label: "Vencimiento",        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",     emoji: "⚠️" },
  suscripcion_activada:   { label: "Activada",           color: "text-sky-400 bg-sky-500/10 border-sky-500/20",           emoji: "🎉" },
  suscripcion_suspendida: { label: "Suspendida",         color: "text-orange-400 bg-orange-500/10 border-orange-500/20", emoji: "🚫" },
  suscripcion_vencida:    { label: "Vencida",            color: "text-red-400 bg-red-500/10 border-red-500/20",           emoji: "❌" },
  aviso_personalizado:    { label: "Aviso",              color: "text-violet-400 bg-violet-500/10 border-violet-500/20", emoji: "📢" },
};

function Historial() {
  const [logs, setLogs]         = useState<NotifLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterResult, setFilterResult] = useState<string>("all");
  const [purging, setPurging]   = useState(false);
  const [showPurge, setShowPurge] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/superadmin/notificaciones?limit=200");
      const d = await r.json();
      setLogs(d.logs ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function purge(dias: number) {
    setPurging(true);
    try {
      await fetch("/api/superadmin/notificaciones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias }),
      });
      await fetchLogs();
      setShowPurge(false);
    } catch {}
    finally { setPurging(false); }
  }

  const filtered = logs.filter(l => {
    if (filterTipo !== "all" && l.tipo !== filterTipo) return false;
    if (filterResult === "ok" && !(l.emailEnviado || l.waEnviado)) return false;
    if (filterResult === "err" && (l.emailEnviado || l.waEnviado)) return false;
    return true;
  });

  // Stats
  const total   = logs.length;
  const exitoso = logs.filter(l => l.emailEnviado || l.waEnviado).length;
  const fallido = total - exitoso;
  const hoy     = logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length;

  function fmtTs(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) + " " +
           d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  function CanalBadge({ sent, error, label }: { sent: boolean; error: string | null; label: string }) {
    if (sent)  return <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">{label} ✓</span>;
    if (error) return <span title={error} className="inline-flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400">{label} ✗</span>;
    return null;
  }

  return (
    <div className="space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total registros", val: String(total),   color: "text-white"        },
          { label: "Enviados OK",     val: String(exitoso), color: "text-emerald-400"  },
          { label: "Fallidos",        val: String(fallido), color: "text-red-400"      },
          { label: "Hoy",             val: String(hoy),     color: "text-sky-400"      },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-5">
            <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-slate-600">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros + acciones */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tipo */}
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          className="rounded-xl border border-white/[0.07] bg-[#0e1012] px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none focus:border-violet-500/50 cursor-pointer">
          <option value="all">Todos los tipos</option>
          {Object.entries(TIPO_META).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>

        {/* Resultado */}
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)}
          className="rounded-xl border border-white/[0.07] bg-[#0e1012] px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none focus:border-violet-500/50 cursor-pointer">
          <option value="all">Todos los resultados</option>
          <option value="ok">Solo exitosos</option>
          <option value="err">Solo fallidos</option>
        </select>

        <button type="button" onClick={fetchLogs}
          className="ml-auto rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-400 transition-colors hover:bg-white/[0.06]">
          ↺ Refrescar
        </button>

        <button type="button" onClick={() => setShowPurge(true)}
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/10">
          🗑 Purgar logs
        </button>
      </div>

      {/* Purge modal */}
      {showPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.07] bg-[#0e1012] p-6 shadow-2xl">
            <p className="text-sm font-black text-white mb-2">🗑 Purgar registros antiguos</p>
            <p className="text-xs text-slate-400 mb-5">Elimina logs más viejos de X días. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              {[30, 60, 90].map(d => (
                <button key={d} type="button" onClick={() => purge(d)} disabled={purging}
                  className="flex-1 rounded-xl border border-red-500/20 bg-red-500/10 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-40">
                  &gt;{d}d
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowPurge(false)}
              className="mt-3 w-full rounded-xl border border-white/[0.06] py-2 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-300">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0e1012]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3.5">
          <span className="mr-1 h-3 w-0.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,1)]" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-400/70">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <svg className="h-5 w-5 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-slate-600">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm">Sin registros{filterTipo !== "all" || filterResult !== "all" ? " con estos filtros" : " aún"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Fecha", "Profesor", "Tipo", "Canales", "Resultado"].map(h => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.025]">
                {filtered.map(l => {
                  const meta = TIPO_META[l.tipo] ?? { label: l.tipo, color: "text-slate-400 bg-slate-500/10 border-slate-500/20", emoji: "📨" };
                  const ok   = l.emailEnviado || l.waEnviado;
                  return (
                    <tr key={l.id} className="transition-colors hover:bg-white/[0.015]">
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="text-[11px] font-semibold text-slate-300">{fmtTs(l.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate text-[12px] font-semibold text-white max-w-[160px]">{l.profesorNombre}</p>
                        <p className="truncate text-[10px] text-slate-600 max-w-[160px]">{l.profesorEmail}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
                          {meta.emoji} {meta.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {l.canales.includes("email") && (
                            <CanalBadge sent={l.emailEnviado} error={l.emailError} label="📧" />
                          )}
                          {l.canales.includes("whatsapp") && (
                            <CanalBadge sent={l.waEnviado} error={l.waError} label="💬" />
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
                          {ok ? "Enviado" : "Fallido"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Auditoria ───────────────────────────────────────────────────────────────
type AuditRow = { id: string; accion: string; detalle: string; profesorEmail: string | null; createdAt: string };

const AUDIT_META: Record<string, { icon: string; label: string; color: string }> = {
  sub_upsert:          { icon: "📋", label: "Suscripción",     color: "text-violet-400"  },
  pago_registrado:     { icon: "💳", label: "Pago",            color: "text-emerald-400" },
  pago_editado:        { icon: "✏️", label: "Pago editado",    color: "text-amber-400"   },
  pago_eliminado:      { icon: "🗑", label: "Pago eliminado",  color: "text-red-400"     },
  profesor_editado:    { icon: "✏️", label: "Edición",         color: "text-amber-400"   },
  profesor_eliminado:  { icon: "🗑", label: "Baja",            color: "text-red-500"     },
  broadcast:           { icon: "📣", label: "Broadcast",       color: "text-fuchsia-400" },
  notif_enviada:       { icon: "📨", label: "Notificación",    color: "text-sky-400"     },
  cron_manual:         { icon: "🤖", label: "Cron manual",     color: "text-cyan-400"    },
  cron_suspension:     { icon: "🚫", label: "Auto-suspensión", color: "text-red-400"     },
};

// ─── AuditMini ────────────────────────────────────────────────────────────────
function AuditMini({ onSection }: { onSection: (s: Section) => void }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  useEffect(() => {
    fetch("/api/superadmin/audit?limit=6")
      .then(r => r.json())
      .then(d => setRows(d.logs ?? []))
      .catch(() => {});
  }, []);
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0e1012]">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-0.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,1)]" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-400/70">Actividad reciente</p>
        </div>
        <button type="button" onClick={() => onSection("auditoria")}
          className="text-[9px] text-fuchsia-400/40 transition-colors hover:text-fuchsia-400">Ver todo →</button>
      </div>
      <div className="divide-y divide-white/[0.025]">
        {rows.map(r => {
          const m = AUDIT_META[r.accion] ?? { icon: "⚡", label: r.accion, color: "text-slate-400" };
          return (
            <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="shrink-0 text-sm">{m.icon}</span>
              <div className="min-w-0 flex-1">
                <span className={`text-[11px] font-bold ${m.color}`}>{m.label}</span>
                {r.profesorEmail && <span className="ml-1.5 text-[10px] text-slate-600">{r.profesorEmail}</span>}
                <p className="mt-0.5 truncate text-[10px] text-slate-700 max-w-xs">{r.detalle}</p>
              </div>
              <p className="shrink-0 text-[10px] text-slate-700 whitespace-nowrap">{fmtDate(r.createdAt)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Auditoria() {
  const [rows, setRows]   = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState("todos");
  const [q, setQ]             = useState("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/superadmin/audit?${params}`);
      const d = await r.json();
      setRows(d.logs ?? []);
    } catch {}
    finally { setLoading(false); }
  }, [q]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const TIPOS = ["todos", ...Object.keys(AUDIT_META)];
  const filtered = filtro === "todos" ? rows : rows.filter(r => r.accion === filtro);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por email o detalle…"
          className="h-9 w-52 shrink-0 rounded-xl border border-white/[0.06] bg-[#0e1012] px-4 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/30 focus:outline-none transition-colors"
        />
        {q && (
          <button type="button" onClick={() => setQ("")}
            className="text-[11px] text-slate-600 transition-colors hover:text-slate-400">✕ Limpiar</button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {TIPOS.map(t => (
          <button key={t} type="button" onClick={() => setFiltro(t)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${filtro === t ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-white/[0.06] text-slate-500 hover:text-slate-300"}`}>
            {t === "todos" ? "Todos" : `${AUDIT_META[t].icon} ${AUDIT_META[t].label}`}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0e1012]">
        <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Registro de acciones</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/[0.05] bg-white/[0.03] px-2 py-0.5 text-[9px] font-black text-slate-600">{filtered.length}</span>
            {filtered.length > 0 && (
              <button type="button"
                onClick={() => {
                  const csvRows = [
                    ["Fecha","Acción","Detalle","Email Profesor"],
                    ...filtered.map(r => [
                      fmtDate(r.createdAt),
                      AUDIT_META[r.accion]?.label ?? r.accion,
                      r.detalle,
                      r.profesorEmail ?? "",
                    ]),
                  ];
                  downloadCSV(csvRows, `auditoria-${new Date().toISOString().slice(0,10)}.csv`);
                }}
                className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold text-slate-500 transition-colors hover:text-slate-300 hover:bg-white/[0.06]">
                📥 CSV
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-600">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm text-slate-600">Sin registros aún</p>
            <p className="mt-1 text-[11px] text-slate-700">Las acciones del panel se registrarán aquí automáticamente</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filtered.map(row => {
              const m = AUDIT_META[row.accion] ?? { icon: "⚡", label: row.accion, color: "text-slate-400" };
              return (
                <div key={row.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="mt-0.5 shrink-0 text-sm">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-bold ${m.color}`}>{m.label}</span>
                      {row.profesorEmail && (
                        <span className="text-[11px] text-slate-500">{row.profesorEmail}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-600">{row.detalle}</p>
                  </div>
                  <p className="shrink-0 text-[10px] text-slate-700 whitespace-nowrap">{fmtDate(row.createdAt)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Configuracion ───────────────────────────────────────────────────────────
type IntegStatus = {
  email:     { configured: boolean; provider: string | null; from: string | null; brevo: boolean; gmail: boolean };
  whatsapp:  { configured: boolean; enabled: boolean; phoneId: string | null };
  cron:      { configured: boolean; url: string | null };
};

function Configuracion({ onToast }: { onToast: (m: string, t: "ok" | "err") => void }) {
  const [cfg, setCfg] = useState<Record<string, any>>({
    "sa-config:diasGracia":   3,
    "sa-config:cronChannels": "email",
    "sa-config:diasUmbral":   7,
    "sa-config:cronMensaje":  "",
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [integ, setInteg]     = useState<IntegStatus | null>(null);

  useEffect(() => {
    fetch("/api/superadmin/config/status")
      .then(r => r.json())
      .then(d => { if (d.ok) setInteg(d.integrations); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/superadmin/config")
      .then(r => r.json())
      .then(d => { if (d.ok) setCfg(d.config); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const r = await fetch("/api/superadmin/config", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      r.ok ? onToast("Configuración guardada", "ok") : onToast("Error al guardar", "err");
    } catch { onToast("Error de conexión", "err"); }
    finally { setSaving(false); }
  }

  function toggleChannel(ch: string) {
    const parts = String(cfg["sa-config:cronChannels"] || "email").split(",").filter(Boolean);
    const idx = parts.indexOf(ch);
    if (idx >= 0) parts.splice(idx, 1); else parts.push(ch);
    setCfg(c => ({ ...c, "sa-config:cronChannels": parts.length ? parts.join(",") : "email" }));
  }

  const [testEmailSending, setTestEmailSending] = useState(false);
  async function sendTestEmail() {
    setTestEmailSending(true);
    try {
      const r = await fetch("/api/superadmin/config/test-email", { method: "POST" });
      const d = await r.json();
      d.ok ? onToast(`✅ Test enviado via ${d.provider} → ${d.to}`, "ok") : onToast(`❌ Error: ${d.error}`, "err");
    } catch { onToast("Error de conexión", "err"); }
    finally { setTestEmailSending(false); }
  }

  if (loading) return <div className="py-20 text-center text-sm text-slate-600">Cargando configuración…</div>;

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">

      {/* Estado de integraciones */}
      {integ && (() => {
        const items = [
          {
            key: "email",
            icon: "📧",
            label: "Email",
            ok: integ.email.configured,
            detail: integ.email.configured
              ? `${integ.email.provider} · ${integ.email.from}`
              : "Faltan GMAIL_USER/PASSWORD o BREVO_API_KEY",
            sub: integ.email.configured
              ? integ.email.brevo && integ.email.gmail ? "Gmail + Brevo disponibles" : integ.email.brevo ? "Brevo activo" : "Gmail activo"
              : null,
          },
          {
            key: "whatsapp",
            icon: "💬",
            label: "WhatsApp",
            ok: integ.whatsapp.configured,
            detail: integ.whatsapp.configured
              ? `WHATSAPP_ALERTS_ENABLED=1 · Phone ID configurado`
              : !integ.whatsapp.enabled
                ? "WHATSAPP_ALERTS_ENABLED no es 1"
                : "Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID",
            sub: null,
          },
          {
            key: "cron",
            icon: "⏰",
            label: "Cron secret",
            ok: integ.cron.configured,
            detail: integ.cron.configured
              ? "CRON_SECRET configurado"
              : "Falta CRON_SECRET en .env.production",
            sub: null,
          },
        ];
        return (
          <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-lg">🔌</span>
              <div>
                <p className="text-sm font-bold text-white">Estado de integraciones</p>
                <p className="text-[11px] text-slate-600">Variables de entorno en .env.production del VPS</p>
              </div>
              <div className="ml-auto">
                {items.every(i => i.ok)
                  ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-400">Todo OK</span>
                  : <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black text-amber-400">{items.filter(i => !i.ok).length} sin config</span>
                }
              </div>
            </div>
            <div className="space-y-2.5">
              {items.map(item => (
                <div key={item.key} className={`flex items-start gap-3 rounded-xl border p-4 ${item.ok ? "border-emerald-500/15 bg-emerald-500/5" : "border-red-500/15 bg-red-500/5"}`}>
                  <span className="mt-0.5 text-lg">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{item.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${item.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {item.ok ? "✓ Configurado" : "✕ Sin configurar"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{item.detail}</p>
                    {item.sub && <p className="mt-0.5 text-[10px] text-slate-600">{item.sub}</p>}
                    {/* Setup instructions cuando no está configurado */}
                    {!item.ok && item.key === "email" && (
                      <div className="mt-2 rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
                        <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-amber-400/70">Cómo configurar</p>
                        <p className="font-mono text-[10px] text-amber-300/80">BREVO_API_KEY=tu-api-key</p>
                        <p className="font-mono text-[10px] text-amber-300/80">BREVO_SENDER_EMAIL=noreply@tudominio.com</p>
                        <p className="mt-1 text-[10px] text-slate-600">O usar Gmail: GMAIL_USER + GMAIL_PASSWORD (app password)</p>
                      </div>
                    )}
                    {!item.ok && item.key === "whatsapp" && (
                      <div className="mt-2 rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
                        <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-amber-400/70">Cómo configurar</p>
                        <p className="font-mono text-[10px] text-amber-300/80">WHATSAPP_ALERTS_ENABLED=1</p>
                        <p className="font-mono text-[10px] text-amber-300/80">WHATSAPP_TOKEN=tu-token</p>
                        <p className="font-mono text-[10px] text-amber-300/80">WHATSAPP_PHONE_NUMBER_ID=tu-phone-id</p>
                      </div>
                    )}
                    {!item.ok && item.key === "cron" && (
                      <div className="mt-2 rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
                        <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-amber-400/70">Cómo configurar</p>
                        <p className="font-mono text-[10px] text-amber-300/80">CRON_SECRET=una-clave-segura-random</p>
                      </div>
                    )}
                    {/* Acciones por integración */}
                    {item.key === "email" && item.ok && (
                      <div className="mt-3">
                        <button type="button" onClick={sendTestEmail} disabled={testEmailSending}
                          className="flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[10px] font-bold text-sky-300 transition-all hover:bg-sky-500/20 disabled:opacity-40">
                          {testEmailSending ? "Enviando..." : "🧪 Probar email"}
                        </button>
                      </div>
                    )}
                    {item.key === "cron" && integ?.cron.url && (
                      <div className="mt-3 flex items-center gap-2">
                        <code className="flex-1 truncate rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1.5 font-mono text-[10px] text-slate-400">{integ.cron.url}</code>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(integ!.cron.url!); onToast("URL copiada", "ok"); }}
                          className="shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-bold text-slate-500 transition-colors hover:text-slate-300">
                          Copiar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Parámetros del cron */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-lg">⚙️</span>
          <div>
            <p className="text-sm font-bold text-white">Parámetros del cron</p>
            <p className="text-[11px] text-slate-600">Valores que usa el cron automático y el trigger manual del panel</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Días de advertencia</p>
            <p className="mb-2 text-[10px] text-slate-600">Enviar aviso cuando falten N días para vencer</p>
            <input type="number" min="1" max="60"
              value={cfg["sa-config:diasUmbral"]}
              onChange={e => setCfg(c => ({ ...c, "sa-config:diasUmbral": Number(e.target.value) }))}
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-violet-500/40 focus:outline-none" />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Días de gracia</p>
            <p className="mb-2 text-[10px] text-slate-600">Suspender N días después del vencimiento</p>
            <input type="number" min="0" max="30"
              value={cfg["sa-config:diasGracia"]}
              onChange={e => setCfg(c => ({ ...c, "sa-config:diasGracia": Number(e.target.value) }))}
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-violet-500/40 focus:outline-none" />
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Canales predeterminados</p>
          <div className="flex flex-wrap gap-3">
            {([["email","📧 Email","violet"],["whatsapp","💬 WhatsApp","emerald"]] as const).map(([ch, label, color]) => {
              const on = String(cfg["sa-config:cronChannels"] || "email").includes(ch);
              return (
                <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${on
                    ? color === "violet" ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                    : "border-white/[0.06] bg-white/[0.03] text-slate-500 hover:text-slate-300"
                  }`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] transition-all ${on
                    ? color === "violet" ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : "border-white/10 bg-white/[0.03]"
                  }`}>{on && "✓"}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mensaje del cron */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-lg">✉️</span>
          <div>
            <p className="text-sm font-bold text-white">Mensaje del sistema</p>
            <p className="text-[11px] text-slate-600">Se adjunta al final de todos los emails/mensajes automáticos del cron</p>
          </div>
        </div>
        <textarea rows={4}
          value={cfg["sa-config:cronMensaje"] || ""}
          onChange={e => setCfg(c => ({ ...c, "sa-config:cronMensaje": e.target.value }))}
          placeholder="Ej: Ante cualquier consulta respondé este email o escribinos al WhatsApp +54 9 11..."
          className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-fuchsia-500/40 focus:outline-none" />
        <p className="mt-2 text-[10px] text-slate-600">Dejar vacío para no incluir mensaje extra.</p>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/15 px-6 py-2.5 text-sm font-black text-violet-300 transition-all hover:bg-violet-500/25 disabled:opacity-40">
          {saving ? "Guardando…" : "💾 Guardar configuración"}
        </button>
      </div>
    </form>
  );
}

// ─── Herramientas ────────────────────────────────────────────────────────────
function Herramientas({ onToast, data }: { onToast: (m: string, t: "ok" | "err") => void; data: Profesor[] }) {
  const [bc, setBc]         = useState<{ type: NotifType; msg: string; emailOn: boolean; waOn: boolean }>({
    type: "aviso_personalizado", msg: "", emailOn: true, waOn: false,
  });
  const [bcSending, setBcSending]   = useState(false);
  const [bcResult, setBcResult]     = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [bcConfirm, setBcConfirm]   = useState(false);
  const [exporting, setExporting]   = useState<"profesores" | "cobros" | null>(null);

  async function sendBroadcast() {
    setBcSending(true); setBcConfirm(false);
    try {
      const channels: string[] = [];
      if (bc.emailOn) channels.push("email");
      if (bc.waOn)    channels.push("whatsapp");
      const r = await fetch("/api/superadmin/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcast: true, type: bc.type, mensajeExtra: bc.msg, channels }),
      });
      const d = await r.json();
      if (d.ok) {
        setBcResult(d);
        onToast(`Broadcast: ${d.sent} enviados · ${d.failed} fallidos de ${d.total}`, d.sent > 0 ? "ok" : "err");
      } else {
        onToast("Error en el broadcast", "err");
      }
    } catch { onToast("Error de conexión", "err"); }
    finally { setBcSending(false); }
  }

  async function exportarProfesores() {
    setExporting("profesores");
    try {
      const r = await fetch("/api/superadmin/profesores");
      const d = await r.json();
      const profesores: Profesor[] = d.profesores ?? [];
      const rows = [
        ["Nombre","Email","Teléfono","Estado","Plan","Est. Suscripción","Alumnos","Máx. Alumnos","Importe","Moneda","Vencimiento","Creado"],
        ...profesores.map(p => [
          p.nombreCompleto, p.email, p.telefono ?? "", p.estado,
          p.subscription?.planTipo ?? "", p.subscription?.estado ?? "",
          String(p.alumnosCount), String(p.subscription?.maxAlumnos ?? ""),
          String(p.subscription?.importe ?? ""), p.subscription?.moneda ?? "",
          p.subscription?.fechaVencimiento ? new Date(p.subscription.fechaVencimiento).toLocaleDateString("es-AR") : "",
          new Date(p.createdAt).toLocaleDateString("es-AR"),
        ]),
      ];
      downloadCSV(rows, `profesores-${new Date().toISOString().slice(0,10)}.csv`);
      onToast(`CSV exportado — ${profesores.length} profesores`, "ok");
    } catch { onToast("Error al exportar", "err"); }
    finally { setExporting(null); }
  }

  async function exportarCobros() {
    setExporting("cobros");
    try {
      // Pagos ya están en memoria — sin requests adicionales
      const rows: string[][] = [["Profesor","Email","Monto","Moneda","Método","Fecha pago","Período desde","Período hasta","Notas"]];
      for (const p of data) {
        for (const pago of p.subscription?.pagos ?? []) {
          rows.push([
            p.nombreCompleto, p.email, String(pago.monto), pago.moneda, pago.metodoPago,
            new Date(pago.fechaPago).toLocaleDateString("es-AR"),
            new Date(pago.periodoDesde).toLocaleDateString("es-AR"),
            new Date(pago.periodoHasta).toLocaleDateString("es-AR"),
            pago.notas ?? "",
          ]);
        }
      }
      downloadCSV(rows, `cobros-${new Date().toISOString().slice(0,10)}.csv`);
      onToast(`CSV exportado — ${rows.length - 1} cobros`, "ok");
    } catch { onToast("Error al exportar", "err"); }
    finally { setExporting(null); }
  }

  const canBroadcast = (bc.emailOn || bc.waOn) && !bcSending;

  return (
    <div className="space-y-5">

      {/* Broadcast */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-lg">📣</span>
          <div>
            <p className="text-sm font-bold text-white">Broadcast masivo</p>
            <p className="text-[11px] text-slate-600">Envía un mensaje a todos los profesores registrados</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo de mensaje</p>
            <select value={bc.type} onChange={e => setBc(b => ({ ...b, type: e.target.value as NotifType }))}
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500/40 cursor-pointer">
              {(Object.entries(NOTIF_LABELS) as [NotifType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Mensaje adicional</p>
            <textarea rows={3} value={bc.msg} onChange={e => setBc(b => ({ ...b, msg: e.target.value }))}
              placeholder="Texto libre que se incluirá al final del mensaje..."
              className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-fuchsia-500/40 focus:outline-none" />
          </div>
          <div className="flex flex-wrap gap-3">
            {([["emailOn","📧 Email","violet"],["waOn","💬 WhatsApp","emerald"]] as const).map(([key, label, color]) => (
              <button key={key} type="button"
                onClick={() => setBc(b => ({ ...b, [key]: !b[key] }))}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${bc[key]
                  ? color === "violet" ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "border-white/[0.06] bg-white/[0.03] text-slate-500 hover:text-slate-300"
                }`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded border transition-all text-[10px] ${bc[key]
                  ? color === "violet" ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-white/10 bg-white/[0.03]"
                }`}>{bc[key] && "✓"}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        {bcResult && (
          <div className="mt-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
            <div className="flex items-center gap-4">
              <div className="text-center"><p className="text-xl font-black text-emerald-400">{bcResult.sent}</p><p className="text-[9px] text-slate-600">enviados</p></div>
              <div className="text-center"><p className="text-xl font-black text-red-400">{bcResult.failed}</p><p className="text-[9px] text-slate-600">fallidos</p></div>
              <div className="text-center"><p className="text-xl font-black text-slate-300">{bcResult.total}</p><p className="text-[9px] text-slate-600">total</p></div>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3 border-t border-white/[0.04] pt-5">
          {!bcConfirm ? (
            <button type="button" onClick={() => setBcConfirm(true)} disabled={!canBroadcast}
              className="flex items-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/15 px-5 py-2.5 text-sm font-black text-fuchsia-300 transition-all hover:bg-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-40">
              📣 Enviar a todos
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-xs text-amber-400">¿Seguro? Se enviará a TODOS los profesores.</p>
              <button type="button" onClick={sendBroadcast} disabled={bcSending}
                className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-xs font-black text-red-300 hover:bg-red-500/25 disabled:opacity-40">
                {bcSending ? "Enviando..." : "Confirmar"}
              </button>
              <button type="button" onClick={() => setBcConfirm(false)}
                className="rounded-xl border border-white/[0.06] px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-300">
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Exportar */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0e1012] p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-lg">📥</span>
          <div>
            <p className="text-sm font-bold text-white">Exportar datos</p>
            <p className="text-[11px] text-slate-600">CSV compatible con Excel · incluye BOM UTF-8</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={exportarProfesores} disabled={exporting !== null}
            className="flex items-center gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-4 text-left transition-all hover:bg-sky-500/10 disabled:opacity-40">
            <span className="text-2xl">{exporting === "profesores" ? "⏳" : "👤"}</span>
            <div>
              <p className="text-sm font-bold text-white">Profesores</p>
              <p className="text-[10px] text-slate-600">Nombre, email, plan, alumnos, vencimiento</p>
            </div>
          </button>
          <button type="button" onClick={exportarCobros} disabled={exporting !== null}
            className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 text-left transition-all hover:bg-emerald-500/10 disabled:opacity-40">
            <span className="text-2xl">{exporting === "cobros" ? "⏳" : "💳"}</span>
            <div>
              <p className="text-sm font-bold text-white">Cobros</p>
              <p className="text-[10px] text-slate-600">Historial completo de pagos con períodos</p>
            </div>
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV: { id: Section; icon: string; label: string }[] = [
  { id:"dashboard",      icon:"⚡", label:"Dashboard"      },
  { id:"finanzas",       icon:"📊", label:"Finanzas"       },
  { id:"profesores",     icon:"👤", label:"Profesores"     },
  { id:"pagos",          icon:"💳", label:"Cobros"         },
  { id:"actividad",      icon:"👁", label:"Actividad"      },
  { id:"automatizacion", icon:"🤖", label:"Automatización" },
  { id:"historial",      icon:"📨", label:"Historial"      },
  { id:"herramientas",   icon:"🛠", label:"Herramientas"   },
  { id:"configuracion",  icon:"⚙️", label:"Configuración"  },
  { id:"auditoria",      icon:"🔍", label:"Auditoría"      },
];

// ─── Command Palette ──────────────────────────────────────────────────────────
const PALETTE_SECTIONS: { id: Section; label: string; icon: string; desc: string }[] = [
  { id:"dashboard",      label:"Dashboard",      icon:"📊", desc:"Visión general del sistema"             },
  { id:"finanzas",       label:"Finanzas",       icon:"💰", desc:"MRR · ARR · Forecast de cobros"         },
  { id:"profesores",     label:"Profesores",     icon:"👤", desc:"Gestión de accesos y suscripciones"     },
  { id:"pagos",          label:"Cobros",         icon:"💳", desc:"Historial de pagos"                     },
  { id:"actividad",      label:"Actividad",      icon:"📡", desc:"Último login · Inactivos"               },
  { id:"automatizacion", label:"Automatización", icon:"⚙️", desc:"Recordatorios automáticos"              },
  { id:"historial",      label:"Historial",      icon:"📬", desc:"Log de notificaciones enviadas"         },
  { id:"herramientas",   label:"Herramientas",   icon:"🛠", desc:"Broadcast · CSV · Link de acceso"       },
  { id:"configuracion",  label:"Configuración",  icon:"🔧", desc:"Canales · Mensaje global · Cron"        },
  { id:"auditoria",      label:"Auditoría",      icon:"🔍", desc:"Registro de acciones del panel"         },
];

function CommandPalette({ data, onClose, onSection, onManage }: {
  data: Profesor[]; onClose: () => void;
  onSection: (s: Section) => void; onManage: (p: Profesor) => void;
}) {
  const [q, setQ] = useState("");
  const inputRef  = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActiveIdx(0); }, [q]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const ql = q.toLowerCase();
  const matchSections  = PALETTE_SECTIONS.filter(s => !ql || s.label.toLowerCase().includes(ql) || s.desc.toLowerCase().includes(ql));
  const matchProfesores = data.filter(p =>
    ql && (p.nombreCompleto.toLowerCase().includes(ql) || p.email.toLowerCase().includes(ql))
  ).slice(0, 6);

  const items: { type: "section" | "profesor"; data: any }[] = [
    ...matchSections.map(s  => ({ type: "section"  as const, data: s })),
    ...matchProfesores.map(p => ({ type: "profesor" as const, data: p })),
  ];

  function select(idx: number) {
    const item = items[idx];
    if (!item) return;
    if (item.type === "section") { onSection(item.data.id); onClose(); }
    else { onManage(item.data); onClose(); }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); select(activeIdx); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0e1012] shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
          <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Buscar sección o profesor..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none" />
          <kbd className="rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-slate-600">ESC</kbd>
        </div>
        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto p-2">
          {!q && (
            <p className="py-5 text-center text-[11px] text-slate-700">Escribí para navegar · <kbd className="rounded border border-white/[0.06] px-1 py-0.5">↑↓</kbd> seleccionar · <kbd className="rounded border border-white/[0.06] px-1 py-0.5">↵</kbd> abrir</p>
          )}
          {matchSections.length > 0 && (
            <div className="mb-1">
              {q && <p className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-700">Secciones</p>}
              {matchSections.map((s, i) => {
                const idx = i;
                return (
                  <button key={s.id} type="button" onClick={() => select(idx)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${activeIdx === idx ? "bg-violet-500/10" : "hover:bg-white/[0.04]"}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm transition-all ${activeIdx === idx ? "bg-violet-500/20 text-violet-300" : "bg-white/[0.04] text-slate-500"}`}>{s.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{s.label}</p>
                      <p className="text-[11px] text-slate-600">{s.desc}</p>
                    </div>
                    <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
          {matchProfesores.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-700">Profesores</p>
              {matchProfesores.map((p, i) => {
                const idx = matchSections.length + i;
                return (
                  <button key={p.id} type="button" onClick={() => select(idx)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${activeIdx === idx ? "bg-violet-500/10" : "hover:bg-white/[0.04]"}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${p.estado === "activo" ? "bg-violet-500/10 text-violet-300" : "bg-slate-500/10 text-slate-500"}`}>
                      {ini(p.nombreCompleto, p.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{p.nombreCompleto}</p>
                      <p className="truncate text-[11px] text-slate-600">{p.email}</p>
                    </div>
                    {p.subscription && <SubPill estado={p.subscription.estado} />}
                  </button>
                );
              })}
            </div>
          )}
          {q && items.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-600">Sin resultados para "{q}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const [section, setSection]       = useState<Section>("dashboard");
  const [data, setData]             = useState<Profesor[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [lastSync, setLastSync]     = useState(0);
  const [showCrear, setShowCrear]   = useState(false);
  const [gestionar, setGestionar]   = useState<Profesor | null>(null);
  const [toast, setToast]           = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [alertasCriticas, setAlertasCriticas] = useState(0);
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [showPalette, setShowPalette]         = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ⌘K / Ctrl+K abre el command palette
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowPalette(p => !p);
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true);
    try {
      const res  = await fetch("/api/superadmin/profesores");
      const json = await res.json();
      // pagos y alumnosCount ya vienen incluidos — 0 requests adicionales
      setData(json.profesores ?? []);
      setLastSync(Date.now());
    } catch { /* silencioso */ }
    finally { setSyncing(false); setInitialLoad(false); }
  }, []);

  useEffect(() => {
    fetchData(false);
    intervalRef.current = setInterval(() => fetchData(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/superadmin/alertas")
      .then(r => r.json())
      .then(d => setAlertasCriticas((d.alertas ?? []).filter((a: AlertaItem) => a.nivel === "critico").length))
      .catch(() => {});
  }, []);

  async function toggleEstado(p: Profesor) {
    await fetch(`/api/superadmin/profesores/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: p.estado === "activo" ? "suspendido" : "activo" }),
    });
    fetchData(false);
  }

  if (initialLoad) return <LoadingScreen />;

  const TITLES: Record<Section, { t: string; s: string }> = {
    dashboard:      { t:"Dashboard",      s:"Visión general del sistema"                     },
    finanzas:       { t:"Finanzas",       s:"MRR · ARR · Forecast de cobros"                },
    profesores:     { t:"Profesores",     s:"Gestión de accesos y suscripciones"             },
    pagos:          { t:"Cobros",         s:"Historial de pagos de suscripciones"            },
    actividad:      { t:"Actividad",      s:"Último login · Inactivos · Notas internas"      },
    automatizacion: { t:"Automatización", s:"Recordatorios y suspensiones automáticas"       },
    historial:      { t:"Historial",      s:"Log de todas las notificaciones enviadas"       },
    herramientas:   { t:"Herramientas",   s:"Broadcast · Exportar CSV · Contraseña · Link"  },
    configuracion:  { t:"Configuración",  s:"Días de gracia · Canales cron · Mensaje global" },
    auditoria:      { t:"Auditoría",      s:"Registro de acciones del panel"                  },
  };

  return (
    <div className="flex min-h-screen bg-[#0e1012] text-white">

      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed bottom-0 left-0 top-0 z-40 flex w-56 flex-col border-r border-white/[0.04] bg-[#0e1012] transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm shadow-[0_0_16px_rgba(139,92,246,0.5)]">⚡</div>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-fuchsia-400/60">God Panel</p>
            <p className="truncate text-sm font-black text-white">Control Maestro</p>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-white lg:hidden">✕</button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[8px] font-black uppercase tracking-[0.25em] text-slate-700">Sistema</p>
          {NAV.map(n => {
            const active = section === n.id;
            const showBadge = !active && n.id === "dashboard" && alertasCriticas > 0;
            return (
              <button key={n.id} type="button"
                onClick={() => { setSection(n.id); setSidebarOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${active ? "bg-white/[0.06] border border-white/[0.08] text-white" : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-200 border border-transparent"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm transition-all ${active ? "bg-violet-500/25 text-violet-300" : "bg-white/[0.04] text-slate-500"}`}>{n.icon}</span>
                <span className="truncate">{n.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,1)]" />}
                {showBadge && (
                  <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black leading-none text-white shadow-[0_0_6px_rgba(239,68,68,0.7)]">
                    {alertasCriticas}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.04] p-4 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${syncing ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`} />
            <p className="min-w-0 flex-1 truncate text-[10px] text-slate-600">{syncing ? "Sincronizando..." : lastSync ? `Sync ${timeAgo(lastSync)}` : "—"}</p>
            {!syncing && <button type="button" onClick={() => fetchData(false)} className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">↺</button>}
          </div>
          <button type="button" onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-500 transition-all hover:bg-red-500/10 hover:text-red-400">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-sm">🔓</span>
            <span className="truncate">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-56">
        <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b border-white/[0.04] bg-[#0e1012]/95 px-4 py-4 lg:px-8 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-slate-400 transition-colors hover:text-white lg:hidden">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-black text-white">{TITLES[section].t}</h1>
              <p className="hidden text-[11px] text-slate-600 sm:block">{TITLES[section].s}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {syncing && <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />}
            <button type="button" onClick={() => setShowPalette(true)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-bold text-slate-500 transition-all hover:bg-white/[0.06] hover:text-slate-300">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <span className="hidden sm:block">Buscar</span>
              <kbd className="hidden rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 text-[9px] text-slate-700 sm:block">⌘K</kbd>
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2">
              <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,1)]" />
              <span className="hidden text-[10px] font-semibold text-slate-500 sm:block">Online</span>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div style={{ display: section === "dashboard"      ? "block" : "none" }}><Dashboard      data={data} onToast={(m,t) => setToast({ msg:m, type:t })} onManage={setGestionar} onSection={setSection} lastSync={lastSync} onRefresh={() => fetchData(false)} /></div>
          <div style={{ display: section === "finanzas"       ? "block" : "none" }}><Finanzas /></div>
          <div style={{ display: section === "profesores"     ? "block" : "none" }}><Profesores     data={data} onManage={setGestionar} onToggle={toggleEstado} onCrear={() => setShowCrear(true)} onToast={(m,t) => setToast({ msg:m, type:t })} /></div>
          <div style={{ display: section === "pagos"          ? "block" : "none" }}><Cobros         data={data} onManage={setGestionar} /></div>
          <div style={{ display: section === "actividad"      ? "block" : "none" }}><Actividad      onToast={(m,t) => setToast({ msg:m, type:t })} onManage={(id) => { const p = data.find(x => x.id === id); if (p) setGestionar(p); }} /></div>
          <div style={{ display: section === "automatizacion" ? "block" : "none" }}><Automatizacion onToast={(m,t) => setToast({ msg:m, type:t })} /></div>
          <div style={{ display: section === "historial"      ? "block" : "none" }}><Historial /></div>
          <div style={{ display: section === "herramientas"   ? "block" : "none" }}><Herramientas   onToast={(m,t) => setToast({ msg:m, type:t })} data={data} /></div>
          <div style={{ display: section === "configuracion"  ? "block" : "none" }}><Configuracion  onToast={(m,t) => setToast({ msg:m, type:t })} /></div>
          <div style={{ display: section === "auditoria"      ? "block" : "none" }}><Auditoria /></div>
        </div>
      </div>

      {/* Command Palette */}
      {showPalette && (
        <CommandPalette
          data={data}
          onClose={() => setShowPalette(false)}
          onSection={(s) => { setSection(s); setSidebarOpen(false); }}
          onManage={(p) => setGestionar(p)}
        />
      )}

      {/* Modals */}
      {showCrear && <ModalCrear onClose={() => setShowCrear(false)} onSaved={() => fetchData(false)} />}
      {gestionar  && (
        <ModalGestionar
          profesor={gestionar}
          onClose={() => setGestionar(null)}
          onSaved={() => fetchData(false)}
          onToast={(m, t) => setToast({ msg: m, type: t })}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
