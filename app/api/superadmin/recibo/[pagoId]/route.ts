import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET /api/superadmin/recibo/[pagoId]
// Devuelve HTML de comprobante listo para imprimir / guardar como PDF.
export async function GET(_req: Request, { params }: { params: { pagoId: string } }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPERADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const pago = await db.profesorPago.findUnique({
    where: { id: params.pagoId },
    include: {
      subscription: {
        include: {
          profesor: { select: { email: true, nombreCompleto: true, telefono: true } },
        },
      },
    },
  });

  if (!pago) return new Response("Pago no encontrado", { status: 404 });

  const prof = pago.subscription.profesor;
  const num  = pago.id.slice(-6).toUpperCase();
  const fmt  = (d: string) => new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const fmtS = (d: string) => new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  const monto = new Intl.NumberFormat("es-AR", {
    style: "currency", currency: pago.moneda, maximumFractionDigits: 0,
  }).format(pago.monto);
  const plan = (pago.subscription.planTipo as string).charAt(0).toUpperCase() + (pago.subscription.planTipo as string).slice(1);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Comprobante #${num} — ${prof.nombreCompleto}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#111;padding:48px;max-width:640px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:2px solid #111;margin-bottom:32px}
    .brand{font-size:24px;font-weight:900;letter-spacing:-1px}
    .brand em{color:#7c3aed;font-style:normal}
    .num{text-align:right}
    .num p{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#888;margin-bottom:4px}
    .num strong{font-size:22px;font-weight:900}
    .num small{display:block;font-size:11px;color:#888;margin-top:4px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:32px}
    .cap{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#888;margin-bottom:8px}
    .info p{font-size:14px;font-weight:600;margin-bottom:2px}
    .info span{font-size:12px;color:#555}
    .badge{display:inline-block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;margin-top:8px}
    table{width:100%;border-collapse:collapse;margin-bottom:28px}
    th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#888;padding:8px 0;border-bottom:1px solid #e5e5e5}
    td{padding:14px 0;font-size:13px;border-bottom:1px solid #f4f4f4;vertical-align:top}
    .total-row{display:flex;justify-content:flex-end;align-items:baseline;gap:16px;padding:16px 0;border-top:2px solid #111;margin-top:4px}
    .total-row span{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#888}
    .total-row strong{font-size:30px;font-weight:900}
    .footer{margin-top:36px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:11px;color:#aaa;text-align:center;line-height:1.7}
    @media print{body{padding:0}@page{margin:1.5cm}}
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">PF<em>Control</em></div>
    <div class="num">
      <p>Comprobante de pago</p>
      <strong>#${num}</strong>
      <small>${fmt(pago.fechaPago)}</small>
    </div>
  </div>

  <div class="grid">
    <div>
      <p class="cap">Profesor</p>
      <div class="info">
        <p>${prof.nombreCompleto}</p>
        <span>${prof.email}</span>
        ${prof.telefono ? `<br/><span>${prof.telefono}</span>` : ""}
      </div>
    </div>
    <div>
      <p class="cap">Suscripción</p>
      <div class="info">
        <p>Plan ${plan}</p>
        <span>Período: ${fmtS(pago.periodoDesde)} → ${fmtS(pago.periodoHasta)}</span>
        <span class="badge">✓ Pagado</span>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th>Método de pago</th>
        <th style="text-align:right">Importe</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          Suscripción PFControl — Plan ${plan}<br/>
          <span style="font-size:11px;color:#888">${fmtS(pago.periodoDesde)} al ${fmtS(pago.periodoHasta)}</span>
        </td>
        <td style="text-transform:capitalize">${pago.metodoPago}</td>
        <td style="text-align:right;font-weight:700">${monto}</td>
      </tr>
      ${pago.notas ? `<tr><td colspan="3" style="font-size:11px;color:#888;padding-top:4px">Nota: ${pago.notas}</td></tr>` : ""}
    </tbody>
  </table>

  <div class="total-row">
    <span>Total abonado</span>
    <strong>${monto}</strong>
  </div>

  <div class="footer">
    <p>Generado por PFControl · pf-control.com</p>
    <p>ID de transacción: ${pago.id}</p>
  </div>

  <script>window.addEventListener("load", () => window.print())</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
