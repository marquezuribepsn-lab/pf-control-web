import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const db = prisma as any;

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ token: null });
  }
  const tokenEntry = await db.passwordResetToken.findFirst({
    where: { email: email.trim().toLowerCase() },
    orderBy: { createdAt: 'desc' },
    select: { token: true },
  });
  return NextResponse.json({ token: tokenEntry?.token || null });
}
