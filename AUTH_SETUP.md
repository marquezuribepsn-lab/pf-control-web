# 🔐 Sistema de Autenticación - Instrucciones de Setup

## ¿Qué se agregó?

✅ **Sistema de Login/Register** con verificación de email  
✅ **Roles de usuario** (Admin, Colaborador, Cliente)  
✅ **Panel admin** para gestionar usuarios  
✅ **Protección de rutas** automática  
✅ **Cookies y sesiones** con NextAuth  
✅ **Opción "Recordar inicio de sesión"**  
✅ **Pre-registrado:** Tu cuenta admin con email `maruquezuribepsn@gmail.com` y contraseña `Gimnasio2005`

---

## 📋 Pasos para implementar

### 1. Instalar dependencias nuevas

```bash
npm install
```

Esto instala:
- `next-auth` - Manejo de sesiones
- `bcryptjs` - Hash de contraseñas  
- `nodemailer` - Envío de emails

### 2. Configurar variables de entorno

Copia `.env.example` a `.env.local` y completa:

```bash
cp .env.example .env.local
```

Luego edita `.env.local`:

```env
# Database (ya deberías tener esto)
DATABASE_URL="postgresql://user:password@localhost:5432/pf_control?schema=public"

# NextAuth - Genera un secret con:
# openssl rand -base64 32
NEXTAUTH_SECRET="tu-secret-generado-aqui"
NEXTAUTH_URL="https://pf-control.com"

# Email - Usa Gmail con App Password (NO tu contraseña regular)
GMAIL_USER="tu-email@gmail.com"
GMAIL_PASSWORD="tu-app-password"

# WhatsApp (ya deberías tener estos)
WHATSAPP_TOKEN="..."
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_TO="5492257613518"

# Web Push (ya deberías tener estos)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPIR_PRIVATE_KEY="..."
```

#### ⚠️ Importante - Gmail App Password

1. Ve a https://myaccount.google.com/security
2. Enable "2-Step Verification" (si no lo tienes)
3. Vuelve a Seguridad > Contraseñas de aplicaciones
4. Selecciona "Mail" y "Windows Computer"
5. Copia la contraseña generada → pégala en `GMAIL_PASSWORD`

### 3. Migrar la base de datos

```bash
npm run db:migrate
```

Esto crea las tablas: `users` y `verification_tokens`

### 4. Ejecutar seed para pre-registrar admin

```bash
npm run db:seed
```

✅ Se crea tu cuenta admin:
- **Email:** `maruquezuribepsn@gmail.com`
- **Contraseña:** `Gimnasio2005`
- **Rol:** ADMIN

### 5. Levantar el servidor

```bash
npm run dev
```

Abre http://localhost:3000 → Se redirige automáticamente a `/auth/login`

---

## 🚀 Usando el sistema

### Flujo de usuario nuevo

1. **Registro** (`/auth/register`)
   - Se registra con email + contraseña
   - Recibe email de verificación
   - Verifica email → acceso habilitado

2. **Inicio de sesión** (`/auth/login`)
   - Email + contraseña
   - Opción "Recordar inicio de sesión" (mantiene sesión 30 días)
   - Entra al dashboard protegido

3. **Admin lo ve en panel** (`/admin/usuarios`)
   - Nuevo usuario aparece como "CLIENTE"
   - Admin puede:
     - ✏️ Cambiar rol a "COLABORADOR"
     - 🗑️ Eliminar usuario

### Roles y permisos

| Rol | Acceso |
|-----|--------|
| **ADMIN** | Todo + `/admin/usuarios` |
| **COLABORADOR** | Todas las rutas del app |
| **CLIENTE** | Sin acceso (espera asignación) |

---

## 📁 Archivos nuevos creados

```
lib/
  ├── auth.ts                          # Config de NextAuth
  └── email.ts                         # Envío de emails + tokens

app/api/auth/
  ├── [...nextauth]/route.ts           # Handler de NextAuth
  ├── register/route.ts                # API de registro
  └── verify/route.ts                  # API de verificación email

app/auth/
 ├── login/page.tsx                   # Página de login
  ├── register/page.tsx                # Página de registro
  └── verify/page.tsx                  # Página de verificación

app/admin/
  └── usuarios/page.tsx                # Panel de gestión de usuarios

app/api/admin/
  └── users/route.ts                   # API para CRUD de usuarios

components/
  └── AuthSessionProvider.tsx          # Provider de sesiones

proxy.ts                               # Protección de rutas

prisma/
  └── seed.ts                          # Script para pre-registrar admin
```

---

## 🔧 Troubleshooting

### "No se envía el email de verificación"
- Verifica `GMAIL_USER` y `GMAIL_PASSWORD` en `.env.local`
- Gmail requiere una "App Password", no la contraseña regular
- Habilita "Aplicaciones menos seguras" en cuenta Google

### "La sesión no se guarda"
- Verifica que `NEXTAUTH_SECRET` esté present en `.env.local`
- Reinicia el servidor: `npm run dev`

### "Usuario no puede iniciar sesión y da error"
- Verifica que el email esté verificado en BD
- Comprueba la contraseña correcta
- En Prisma Studio (`npm run db:studio`): verifica que el usuario existe y tiene `emailVerified = true`

### "Rutas no se protegen"
- Asegúrate que las rutas están en el array `protectedRoutes` de `proxy.ts`
- Si agregás nuevas rutas, actualiza el middleware

---

## 📞 Testing rápido

### Test 1: Login
```bash
# Terminal
npm run dev

# Browser
1. Abre http://localhost:3000 → Se redirige a /auth/login
2. Email: maruquezuribepsn@gmail.com
3. Contraseña: Gimnasio2005
4. Acepta "Recordar inicio de sesión"
5. Enter → Dashboard ✅
```

### Test 2: Nuevo usuario
```bash
1. /auth/register
2. New email: test@example.com
3. Contraseña: Test1234
4. Revisa tu email → verifica
5. Login con esas credenciales
6. Admin ve al usuario como "CLIENTE" en /admin/usuarios
7. Admin lo cambia a "COLABORADOR"
```

---

## 🚢 Deployment a VPS

### Pasos en VPS

```bash
# 1. PM2 maneja las migraciones automáticas (opcional)
# 2. Agreg NEXTAUTH_SECRET a .db.env

ssh root@tu-vps
cd /root/pf-control-web

# 3. Instalar dependencias
npm install

# 4. Migrar BD
npm run db:setup   # O npm run db:migrate && npm run db:seed

# 5. Build y restart
npm run build
pm2 restart pf-control-web --update-env
```

---

## ✨ Recursos útiles

- NextAuth docs: https://next-auth.js.org/
- Prisma docs: https://www.prisma.io/docs/
- Gmail App Passwords: https://myaccount.google.com/security

---

¡Listo! El sistema está 100% funcional. Accede a http://localhost:3000 para probar. 🎉
