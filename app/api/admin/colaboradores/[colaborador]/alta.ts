import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest, context: { params: Promise<{ colaborador: string }> }) {
  const params = await context.params;
  try {
    const colaborador = await prisma.user.findUnique({
      where: { id: params.colaborador },
    });
    if (!colaborador) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
    const token = await generateVerificationToken(colaborador.email);
    await sendVerificationEmail(colaborador.email, token);
    return NextResponse.json({ success: true });
  } catch (error) {
    let errorMsg = 'Error desconocido';
    if (typeof error === 'object' && error && 'message' in error) {
      errorMsg = (error as any).message;
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
