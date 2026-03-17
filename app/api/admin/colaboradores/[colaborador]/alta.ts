import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: { colaborador: string } }) {
  try {
    const colaborador = await prisma.user.findUnique({
      where: { id: params.colaborador, role: 'COLABORADOR' },
    });
    if (!colaborador) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
    const token = await generateVerificationToken(colaborador.email);
    await sendVerificationEmail(colaborador.email, token);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
