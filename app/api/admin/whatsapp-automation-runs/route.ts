import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export async function GET(_req: NextRequest) {
  const session = await auth();

  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const runs = await db.syncEntry.findMany({
    where: {
      key: {
        startsWith: "whatsapp-automation-run-",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return NextResponse.json({ runs });
}
