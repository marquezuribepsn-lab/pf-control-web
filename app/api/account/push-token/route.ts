import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  isValidExpoPushToken,
  upsertPushToken,
  removePushToken,
} from '@/lib/pushTokenStore';

/**
 * POST /api/account/push-token
 * Registra el Expo push token del dispositivo nativo para el usuario logueado.
 * Lo invoca la app móvil (WebView) inyectando un fetch con la sesión por cookie.
 */
export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const token = String((payload || {}).token || '').trim();
  const platform = (payload || {}).platform;

  if (!isValidExpoPushToken(token)) {
    return NextResponse.json({ message: 'Token de notificaciones inválido' }, { status: 400 });
  }

  const record = await upsertPushToken({
    userId: session.user.id,
    token,
    platform,
  });

  if (!record) {
    return NextResponse.json(
      { message: 'No se pudo registrar el token de notificaciones' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/account/push-token
 * Quita un token (p. ej. al cerrar sesión en el dispositivo).
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const token = String((payload || {}).token || '').trim();

  if (!isValidExpoPushToken(token)) {
    return NextResponse.json({ message: 'Token de notificaciones inválido' }, { status: 400 });
  }

  await removePushToken(token);
  return NextResponse.json({ ok: true });
}
