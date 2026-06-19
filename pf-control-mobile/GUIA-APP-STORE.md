# Guía paso a paso — Publicar PF Control en la App Store

Esta guía cubre TODO lo que falta para subir la app a la App Store. Está pensada
para copiar y pegar. Lo que **solo vos podés hacer** (porque requiere tu cuenta
de Apple, pago y credenciales) está marcado con 🔑.

El código de la app ya está listo:
- ✅ Pago oculto dentro de iOS (regla 3.1.1).
- ✅ Notificaciones push nativas con `expo-notifications` (regla 4.2.3).
- ✅ Borrado de cuenta dentro de la app (regla 5.1.1(v)).
- ✅ Política de privacidad pública: https://pf-control.com/privacidad
- ✅ Bundle identifier real configurado: `com.pfcontrol.app`
  (si querés otro, cambialo en `app.json` → `ios.bundleIdentifier` antes de empezar).

---

## 0. Requisitos previos (una sola vez)

| Qué | Cómo | Costo |
|-----|------|-------|
| 🔑 Apple Developer Program | https://developer.apple.com/programs/enroll/ | USD 99/año |
| 🔑 Cuenta Expo (gratis) | https://expo.dev/signup | Gratis |
| Una Mac o usar EAS en la nube | EAS compila en la nube, no necesitás Xcode local | Gratis (plan free alcanza) |
| `eas-cli` instalado | `npm install -g eas-cli` | Gratis |

> No necesitás Xcode ni una Mac física: `eas build` compila en los servidores de Expo.
> Solo necesitás una Mac si querés correr la app en un simulador local.

---

## 1. 🔑 Apple Developer — crear el App ID y la app

1. Entrá a https://developer.apple.com/account y aceptá el contrato vigente
   (Agreements, Tax, and Banking).
2. **Certificates, Identifiers & Profiles → Identifiers → +**
   - Tipo: **App IDs → App**.
   - Description: `PF Control`.
   - Bundle ID: **Explicit** → `com.pfcontrol.app`.
   - Capabilities: marcá **Push Notifications**.
   - Registrar.
3. **Keys → +** (esto crea la clave APNs para push):
   - Key Name: `PF Control Push`.
   - Marcá **Apple Push Notifications service (APNs)**.
   - Continuar → Registrar → **Descargá el archivo `.p8`** (solo se puede bajar
     una vez) y anotá el **Key ID** y tu **Team ID** (arriba a la derecha).
   - Guardalo bien: EAS lo va a usar para enviar push a iOS.

---

## 2. 🔑 App Store Connect — crear el registro de la app

1. Entrá a https://appstoreconnect.apple.com → **My Apps → + → New App**.
2. Completá:
   - Platform: **iOS**.
   - Name: `PF Control` (debe ser único en toda la App Store; si está tomado,
     usá algo como `PF Control - Entrenamiento`).
   - Primary Language: **Spanish (Mexico)** o el que prefieras.
   - Bundle ID: elegí `com.pfcontrol.app` (aparece de lo creado en el paso 1).
   - SKU: `pfcontrol-ios` (interno, cualquier texto).
3. Anotá el **App Store Connect App ID** (el número que aparece en la URL o en
   App Information → General → Apple ID).

---

## 3. Configurar EAS en el proyecto

Desde la carpeta `pf-control-mobile`:

```bash
cd pf-control-mobile

# 1) Login en Expo
eas login

# 2) Inicializar EAS: crea el projectId y lo escribe en app.json (extra.eas.projectId)
eas init
```

> `eas init` agrega automáticamente `extra.eas.projectId` en `app.json`. Ese
> projectId es lo que el código (`App.tsx → resolveExpoProjectId`) necesita para
> generar el push token. Hasta que exista, la app NO genera token (no rompe, solo
> no registra push).

Después editá `eas.json` → bloque `submit.production.ios` con tus datos reales
(reemplazá los `REEMPLAZAR_CON_*`):

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "tu-apple-id@email.com",
      "ascAppId": "EL_APP_STORE_CONNECT_APP_ID_DEL_PASO_2",
      "appleTeamId": "TU_TEAM_ID_DEL_PASO_1"
    }
  }
}
```

---

## 4. Cargar las credenciales (push + firma)

```bash
# Configurar credenciales de iOS de forma interactiva
eas credentials
```

- Elegí plataforma **iOS** → perfil **production**.
- **Push Notifications (APNs):** subí el archivo `.p8` del paso 1 (te pedirá Key
  ID y Team ID). Esto habilita el envío real de push.
- **Distribution Certificate / Provisioning Profile:** dejá que EAS los genere
  automáticamente ("Let EAS handle it"). Solo te va a pedir login de Apple una vez.

---

## 5. Compilar y subir

```bash
# Compilar el binario de producción (en la nube de Expo)
eas build --platform ios --profile production

# Cuando termine, subirlo a App Store Connect / TestFlight
eas submit --platform ios --profile production --latest
```

- El build tarda ~15-25 min. Te da una URL para seguirlo.
- `eas submit` sube el `.ipa` a App Store Connect. Tarda unos minutos en
  aparecer en **TestFlight** (procesamiento de Apple).

---

## 6. 🔑 Completar la ficha en App Store Connect

En https://appstoreconnect.apple.com → tu app:

### App Privacy (obligatorio)
- **Privacy Policy URL:** `https://pf-control.com/privacidad`
- **Data collection:** declará lo que la app realmente usa:
  - **Contact Info** (email, nombre, teléfono) → usado para *App Functionality*,
    *vinculado al usuario*. No para tracking.
  - **User Content** (datos de entrenamiento/pagos) → *App Functionality*,
    vinculado al usuario.
  - **Identifiers** (push token) → *App Functionality*.
  - NO marques "Used for tracking" (no hacemos tracking publicitario).

### Información de la versión
- **Screenshots:** necesitás capturas de iPhone 6.7" (1290×2796) y 6.5".
  Sacalas corriendo la app o desde el simulador. Mínimo 1, ideal 3-5.
- **Description / Keywords / Support URL** (`https://pf-control.com`) /
  **Marketing URL** (opcional).
- **Age Rating:** completá el cuestionario (probablemente 4+).

### App Review Information (MUY importante para que no te rechacen)
- **Demo account:** dejá un usuario y contraseña de prueba (alumno) para que el
  revisor pueda entrar. Ej: el usuario `alumno.prueba@pfcontrol.test`.
- **Notes:** explicá las mitigaciones (texto sugerido abajo).

---

## 7. 🔑 Enviar a revisión

- En la página de la versión: **Add for Review → Submit**.
- Tiempo típico de revisión: 24-48 h.

---

## Texto sugerido para "App Review Notes"

```
PF Control es una plataforma de gestión de entrenamiento para alumnos de un
centro deportivo. La app móvil ofrece notificaciones push nativas (avisos de
rutina, pagos y novedades) además del acceso al panel del alumno.

Cuenta de prueba (alumno):
  Usuario: alumno.prueba@pfcontrol.test
  Contraseña: [completar]

Notas:
- Las funciones de cobro de cuotas no se muestran dentro de iOS; la gestión de
  pagos se realiza en el sitio web. La app no ofrece compras de bienes/servicios
  digitales, por lo que no aplica In-App Purchase.
- El usuario puede eliminar su cuenta de forma permanente desde Cuenta →
  Eliminar cuenta (cumple la guía 5.1.1(v)).
- Política de privacidad: https://pf-control.com/privacidad
```

---

## 8. Probar las notificaciones push (después del build)

Una vez instalada la app desde TestFlight y logueado un alumno, el token se
registra solo (la app lo manda a `POST /api/account/push-token`). Para enviar
una notificación de prueba desde el backend:

```ts
import { sendPushToUser } from "@/lib/pushSender";

await sendPushToUser(userId, {
  title: "PF Control",
  body: "Tu rutina de hoy ya está disponible 💪",
});
```

O probar suelto con cualquier token vía la herramienta de Expo:
https://expo.dev/notifications

---

## Resumen de qué falta y quién lo hace

| Paso | Quién |
|------|-------|
| 1. App ID + clave APNs | 🔑 vos (cuenta Apple) |
| 2. Registro app en App Store Connect | 🔑 vos |
| 3. `eas login` + `eas init` | 🔑 vos (login Expo) |
| 4. `eas credentials` (subir .p8) | 🔑 vos |
| 5. `eas build` + `eas submit` | vos (comandos listos arriba) |
| 6. Ficha + privacy labels + screenshots | 🔑 vos |
| 7. Enviar a revisión | 🔑 vos |
| Código de la app (3.1.1 / 4.2.3 / 5.1.1) | ✅ ya hecho |
| Política de privacidad pública | ✅ ya hecho |
| Bundle id real | ✅ ya hecho |
| Backend de push + store + sender | ✅ ya hecho |
```
