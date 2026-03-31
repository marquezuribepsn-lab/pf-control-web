import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';
import { auth } from '@/lib/auth';
import { isProtectedAdminEmail } from '@/lib/operationalUsers';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ colaborador: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  const params = await context.params;
  try {
    const colaborador = await prisma.user.findUnique({
      where: { id: params.colaborador },
    });

    if (!colaborador) {
      return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
    }

    if (isProtectedAdminEmail(colaborador.email) || colaborador.role === 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Cuenta protegida' }, { status: 403 });
    }

    if (colaborador.role !== 'COLABORADOR') {
      return NextResponse.json({ success: false, error: 'El usuario no es colaborador' }, { status: 400 });
    }

    const token = await generateVerificationToken(colaborador.email);
    await sendVerificationEmail(colaborador.email, token);

    return NextResponse.json({ success: true });
  } catch (error) {
    let errorMsg = 'Error desconocido';
    if (typeof error === 'object' && error && 'message' in error) {
      errorMsg = (error as { message?: string }).message || errorMsg;
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
