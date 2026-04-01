import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendLoginAccessLinkEmail } from '@/lib/email';

const db = prisma as any;

function genericResponse() {
  return NextResponse.json({
    ok: true,
    message: 'Si la cuenta existe y esta verificada, te enviamos un enlace de acceso.',
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ ok: false, message: 'Email requerido' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        estado: true,
      },
    });

    if (!user || !user.emailVerified || user.estado !== 'activo') {
      return genericResponse();
    }

    await db.verificationToken.deleteMany({
      where: {
        email,
        token: {
          startsWith: 'login-link-',
        },
      },
    });

    const token = `login-link-${randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.verificationToken.create({
      data: {
        email,
        token,
        expiresAt,
        userId: user.id,
      },
    });

    await sendLoginAccessLinkEmail(email, token);

    return genericResponse();
  } catch (error) {
    console.error('Login-link request error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'No se pudo generar el enlace de acceso',
      },
      { status: 500 }
    );
  }
}
