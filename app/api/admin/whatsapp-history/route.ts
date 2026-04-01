import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSyncValue } from "@/lib/syncStore";
import {
  filterWhatsAppHistory,
  serializeHistoryToCsv,
  type WhatsAppHistoryRow,
} from "@/lib/whatsappHistory";

const HISTORY_KEY = "whatsapp-history-v1";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const history = await getSyncValue(HISTORY_KEY);
  const rows = Array.isArray(history) ? (history as WhatsAppHistoryRow[]) : [];

  const filters = {
    from: req.nextUrl.searchParams.get("from") || "",
    to: req.nextUrl.searchParams.get("to") || "",
    status: req.nextUrl.searchParams.get("status") || "",
    type: req.nextUrl.searchParams.get("type") || "",
    user: req.nextUrl.searchParams.get("user") || "",
    rule: req.nextUrl.searchParams.get("rule") || "",
    category: req.nextUrl.searchParams.get("category") || "",
    limit: Number(req.nextUrl.searchParams.get("limit") || 500),
  };

  const filteredRows = filterWhatsAppHistory(rows, filters);
  const exportFormat = String(req.nextUrl.searchParams.get("format") || "").toLowerCase();

  if (exportFormat === "csv") {
    const csv = serializeHistoryToCsv(filteredRows);
    const filename = `whatsapp-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    history: filteredRows,
    total: rows.length,
    filtered: filteredRows.length,
    filters,
  });
}
