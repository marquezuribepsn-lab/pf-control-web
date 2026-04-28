This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Base de datos (PostgreSQL + Prisma)

La app ya soporta persistencia en PostgreSQL sin cambiar los providers actuales.

Comportamiento:

- Si existe `DATABASE_URL`, el endpoint de sync guarda/lee en PostgreSQL.
- Si no existe `DATABASE_URL`, usa el store JSON (`SYNC_STORE_PATH`) como fallback.

Pasos:

1. Crear variables de entorno a partir de `.env.example`.
2. Configurar `DATABASE_URL`.
3. Generar cliente Prisma:

```bash
npm run db:generate
```

4. Crear tabla inicial en la DB:

```bash
npm run db:push
```

5. (Opcional) Abrir Prisma Studio:

```bash
npm run db:studio
```

### Setup automatico en VPS (Hostinger KVM)

Si no aparece una seccion de "Database" en el panel, puedes instalar PostgreSQL directo en el VPS y dejar la URL guardada para deploys futuros:

```bash
npm run setup:db:vps -- -DbPassword "TU_PASSWORD_FUERTE"
```

Opcionales:

```bash
npm run setup:db:vps -- -Server "root@TU_IP" -DbName "pf_control" -DbUser "pf_user" -DbPassword "TU_PASSWORD_FUERTE"
```

Este comando:

- instala PostgreSQL en el VPS (si falta),
- crea/actualiza usuario y base,
- guarda `DATABASE_URL` en `/root/pf-control-web/.db.env`,
- ejecuta `db:push` para crear tablas.

El script de deploy ya carga automaticamente `/root/pf-control-web/.db.env` y reinicia PM2 con `--update-env`.

## Ejecutar como servidor (sin dejar PowerShell abierto)

Este proyecto incluye PM2 para dejar la app corriendo en segundo plano.

1. Instalar dependencias:

```bash
npm install
```

2. Generar build de producción:

```bash
npm run build
```

3. Iniciar servidor en segundo plano:

```bash
npm run server:start
```

4. Ver estado:

```bash
npm run server:status
```

5. Ver logs:

```bash
npm run server:logs
```

6. Reiniciar:

```bash
npm run server:restart
```

7. Detener:

```bash
npm run server:stop
```

8. Eliminar proceso de PM2:

```bash
npm run server:delete
```

Nota: PM2 mantiene el proceso activo aunque cierres la terminal. Para reinicios de PC, puedes configurar arranque automático con PM2 o una tarea programada de Windows.

## Runner automatico de WhatsApp (cron + frecuencia configurable)

- El cron del runner se instala/actualiza con:

```bash
npm run whatsapp:automation:cron:setup
```

- El deploy a VPS ya ejecuta ese comando automaticamente.
- La entrada de cron corre cada minuto, pero la ejecucion real respeta la frecuencia definida en `/admin/whatsapp` (ejemplo: 5 o 10 minutos).
- Variables operativas recomendadas:
	- `WHATSAPP_AUTOMATION_SECRET`: autenticacion para invocar el runner sin sesion admin.
	- `WHATSAPP_AUTOMATION_CRON_ENABLED=1` (default).
	- `WHATSAPP_AUTOMATION_CRON_SCHEDULE="* * * * *"`.
	- `WHATSAPP_INTERNAL_ALERT_TO="54911...,54922..."` para alertas internas por WhatsApp.

## Release automatico total (sin parametros)

Ejecuta todo en cadena con un solo comando:

```bash
npm run release:auto
```

Este flujo hace automaticamente:

- git add de todos los cambios,
- commit automatico (si hay cambios),
- build local de produccion,
- deploy completo a VPS,
- creacion de tag de restore point,
- push de branch y tag a GitHub.

No necesitas pasar flags ni completar nada manualmente.

## Pagos de alumnos (Mercado Pago + manual con confirmacion admin)

El flujo de pagos del alumno combina checkout de Mercado Pago y metodos manuales (transferencia/efectivo):

- Checkout del alumno: `/alumnos/pagos`
- API de estado: `/api/payments/status`
- API de checkout: `/api/payments/checkout`
- API de aviso manual alumno: `/api/payments/manual`
- Webhook: `/api/payments/webhook/mercadopago`
- Panel admin de confirmaciones: `/admin/pagos`
- API admin de confirmaciones: `/api/admin/payments/manual`
- API admin QR tienda Mercado Pago: `/api/admin/payments/mercadopago-qr`
- API admin resumen/reinicio de ingresos: `/api/admin/payments/income`
- API admin estado/conexion MP: `/api/admin/payments/mercadopago/connect`
- API admin inicio OAuth MP: `/api/admin/payments/mercadopago/connect/start`
- API admin callback OAuth MP: `/api/admin/payments/mercadopago/connect/callback`

Variables necesarias:

```bash
MERCADOPAGO_WEBHOOK_TOKEN=token-seguro-webhook
PF_PAYMENT_DEFAULT_AMOUNT_ARS=15000
```

Fuente de cobro de Mercado Pago (usa al menos una):

1) Recomendado: cuenta conectada por OAuth desde `/admin/pagos`

```bash
MERCADOPAGO_APP_CLIENT_ID=1234567890123456
MERCADOPAGO_APP_CLIENT_SECRET=APP_SECRET
# opcional: si no lo defines, se arma con NEXTAUTH_URL
MERCADOPAGO_APP_REDIRECT_URI=https://TU_DOMINIO/api/admin/payments/mercadopago/connect/callback
```

2) Fallback clasico por token de entorno

```bash
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
```

Variables opcionales recomendadas (aplican a OAuth y token):

```bash
MERCADOPAGO_COLLECTOR_ID=123456789
PF_MERCADOPAGO_ACCOUNT_LABEL=Mi cuenta Mercado Pago
```

Notas de configuracion:

- Si hay cuenta vinculada por OAuth, checkout/webhook usan esa cuenta automaticamente.
- Si no hay cuenta vinculada, checkout/webhook usan `MERCADOPAGO_ACCESS_TOKEN` como fallback.
- `MERCADOPAGO_ACCESS_TOKEN` debe ser de tu cuenta vendedora de Mercado Pago (la que recibe el dinero).
- Si defines `MERCADOPAGO_COLLECTOR_ID`, el checkout valida que la cuenta activa (OAuth o token) pertenezca a ese vendedor y bloquea cobros con una cuenta equivocada.
- `PF_MERCADOPAGO_ACCOUNT_LABEL` se muestra en la vista del alumno para identificar la cuenta receptora.

Configura en Mercado Pago la URL de notificacion apuntando a:

```bash
https://TU_DOMINIO/api/payments/webhook/mercadopago?token=token-seguro-webhook
```

Comportamiento esperado:

- Si el pase esta vencido o pendiente, el alumno queda inhabilitado para el resto del modulo y es redirigido a pagos.
- Cuando Mercado Pago confirma `approved`, el sistema renueva automaticamente la vigencia y rehabilita el acceso.
- Si el alumno informa transferencia o efectivo, queda una orden manual pendiente hasta que un admin la apruebe o rechace en `/admin/pagos`.
- El admin puede cargar un QR de tienda de Mercado Pago en `/admin/pagos` para mostrarlo al alumno con escaneo directo.
- Si el alumno paga por QR de tienda, puede informar el pago manual como `mercadopago` para revision administrativa.
- Al aprobar una orden manual, el sistema renueva el pase automaticamente igual que en Mercado Pago.
- En `/admin/pagos`, el bloque de ingresos permite filtrar mensual/anual y reiniciar acumulados con `Limpiar ingresos` (sin borrar historiales de ordenes).
- El resumen mensual de ingresos muestra meses sin cobros con total `0` para mantener continuidad de control.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
