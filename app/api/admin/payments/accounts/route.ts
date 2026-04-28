import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteTransferAccount,
  getTransferAccounts,
  upsertTransferAccount,
} from "@/lib/paymentTransferAccounts";

async function requireAdmin() {
  const session = await auth();
  const role = String((session?.user as { role?: string | null } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  if (!session?.user?.id || role !== "ADMIN") {
    return null;
  }

  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const accounts = await getTransferAccounts();

  return NextResponse.json({
    ok: true,
    total: accounts.length,
    accounts,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const account = await upsertTransferAccount({
      id: typeof body.id === "string" ? body.id : undefined,
      label: typeof body.label === "string" ? body.label : undefined,
      bankName: typeof body.bankName === "string" ? body.bankName : undefined,
      accountType: typeof body.accountType === "string" ? body.accountType : undefined,
      holderName: typeof body.holderName === "string" ? body.holderName : undefined,
      holderDocument: typeof body.holderDocument === "string" ? body.holderDocument : undefined,
      accountNumber: typeof body.accountNumber === "string" ? body.accountNumber : undefined,
      cbu: typeof body.cbu === "string" ? body.cbu : undefined,
      alias: typeof body.alias === "string" ? body.alias : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      isVisible: typeof body.isVisible === "boolean" ? body.isVisible : undefined,
    });

    return NextResponse.json({
      ok: true,
      message: "Cuenta guardada correctamente.",
      account,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "No se pudo guardar la cuenta de transferencia.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "").trim();

  if (!id) {
    return NextResponse.json({ message: "Debes indicar el id de la cuenta." }, { status: 400 });
  }

  const removed = await deleteTransferAccount(id);

  if (!removed) {
    return NextResponse.json({ message: "Cuenta no encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    message: "Cuenta eliminada correctamente.",
  });
}
