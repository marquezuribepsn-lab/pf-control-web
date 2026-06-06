import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPhoneVerificationCode } from '@/lib/email';
import { randomUUID } from 'crypto';

const db = prisma as any;

const CODE_PREFIX = 'phone-code-';
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutos

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(raw: unknown): string {
  return String(raw || '').trim().replace(/\s+/g, '');
}

// ── POST ─────────────────────────────────────────────────────────────────────
// Body { action: "send", phone: "+54 2257613518" } → genera y envía el código
// Body { action: "verify", phone: "...", code: "123456" } → verifica el código
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '').trim().toLowerCase();

  // Cargar usuario para obtener email
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  }).catch(() => null);

  if (!user) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  // ── Acción: enviar código ─────────────────────────────────────────────────
  if (action === 'send') {
    const phone = normalizePhone(body?.phone);
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      return NextResponse.json(
        { message: 'Ingresá un número de teléfono válido antes de verificar.' },
        { status: 400 }
      );
    }

    // Borrar códigos anteriores de este usuario
    await db.verificationToken
      .deleteMany({
        where: {
          userId: session.user.id,
          token: { startsWith: CODE_PREFIX },
        },
      })
      .catch(() => null);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    await db.verificationToken.create({
      data: {
        id: randomUUID(),
        email: user.email,
        token: `${CODE_PREFIX}${code}`,
        expiresAt,
        userId: session.user.id,
      },
    });

    // Enviar vía email (siempre disponible)
    let emailSent = false;
    let emailError = '';
    try {
      await sendPhoneVerificationCode(user.email, phone, code);
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'error_desconocido';
      console.error('[phone-verify] Error enviando email:', emailError);
    }

    if (!emailSent) {
      return NextResponse.json(
        { message: `No se pudo enviar el código por email. Error: ${emailError}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      message: `Código enviado a ${user.email}. Tenés 10 minutos para ingresarlo.`,
    });
  }

  // ── Acción: verificar código ──────────────────────────────────────────────
  if (action === 'verify') {
    const code = String(body?.code || '').replace(/\D/g, '').slice(0, 6);
    if (!code || code.length !== 6) {
      return NextResponse.json(
        { message: 'El código debe tener 6 dígitos.' },
        { status: 400 }
      );
    }

    const phone = normalizePhone(body?.phone);
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      return NextResponse.json(
        { message: 'Número de teléfono no válido.' },
        { status: 400 }
      );
    }

    const tokenRecord = await db.verificationToken.findFirst({
      where: {
        userId: session.user.id,
        token: `${CODE_PREFIX}${code}`,
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { message: 'Código incorrecto. Verificá que hayas ingresado el código exacto.' },
        { status: 400 }
      );
    }

    if (new Date(tokenRecord.expiresAt) < new Date()) {
      await db.verificationToken.delete({ where: { id: tokenRecord.id } }).catch(() => null);
      return NextResponse.json(
        { message: 'El código expiró. Solicitá uno nuevo.' },
        { status: 400 }
      );
    }

    // Guardar teléfono y marcarlo como verificado
    await db.user.update({
      where: { id: session.user.id },
      data: {
        telefono: phone,
        telefonoVerificado: true,
      },
    });

    // Borrar el token usado
    await db.verificationToken.delete({ where: { id: tokenRecord.id } }).catch(() => null);

    return NextResponse.json({
      ok: true,
      verified: true,
      message: 'Teléfono verificado correctamente.',
    });
  }

  return NextResponse.json(
    { message: 'Acción no válida. Usá "send" o "verify".' },
    { status: 400 }
  );
}
