# ⚙️ AXON-LAB — Guía de Configuración Completa

## 1. Variables de entorno / Supabase

Este proyecto es **frontend puro** (HTML + JS con módulos ES), por lo que **no usa un archivo `.env`**.
Las credenciales van directamente en `js/supabase-config.js`:

```js
const SUPABASE_URL     = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key-publica';
```

### ¿Dónde encontrar estos valores?
1. Entra a [supabase.com](https://supabase.com) → tu proyecto
2. Ve a **Project Settings → API**
3. Copia **Project URL** y **anon / public key**

> ⚠️ La `anon key` es pública y segura para el frontend.
> **NUNCA** uses la `service_role key` en el cliente.

---

## 2. Base de datos — Ejecutar SQL

1. En Supabase Dashboard → **SQL Editor → New query**
2. Pega el contenido de `supabase_setup.sql`
3. Haz clic en **Run**

Esto crea:
| Objeto | Descripción |
|--------|-------------|
| `perfiles` | Tabla de perfiles de usuario |
| `laboratorios` | Recursos (archivos + enlaces) |
| `favoritos` | Laboratorios marcados por usuario |
| RLS Policies | Seguridad por fila para cada tabla |
| Buckets storage | `laboratorios` y `media` (50 MB c/u) |
| Trigger `on_auth_user_created` | Crea perfil automáticamente al registrar |
| RPC `increment_downloads` | Contador thread-safe |

---

## 3. Configurar Autenticación en Supabase

### Email/Password
- Authentication → Providers → **Email** → Enabled ✅
- Confirmar emails: puedes desactivarlo en desarrollo

### Redirect URLs (obligatorio para reset de contraseña)
En **Authentication → URL Configuration**:

```
Site URL:
  https://tudominio.com

Redirect URLs (agregar estas):
  https://tudominio.com/pages/restablecer.html
  http://localhost:5500/pages/restablecer.html
  https://pretel1.github.io/AXON-LAB/pages/restablecer.html
```

### Google OAuth (opcional)
1. Authentication → Providers → Google → Enable
2. Obtén Client ID y Secret en [Google Cloud Console](https://console.cloud.google.com)
3. Agrega URI de redirección: `https://TU-PROYECTO.supabase.co/auth/v1/callback`

---

## 4. Levantar el proyecto en local

Como el proyecto usa **módulos ES (`import/export`)**, necesita ser servido por un servidor HTTP.

### Opción A — VS Code Live Server (recomendado)
1. Instala la extensión **Live Server** en VS Code
2. Click derecho en `index.html` → **Open with Live Server**

### Opción B — Python
```bash
cd AXON-LAB
python -m http.server 5500
# Abre: http://localhost:5500
```

### Opción C — Node.js
```bash
npx serve .
```

> ❌ **No** abras `index.html` directamente con `file://` — los módulos no funcionan así.

---

## 5. Deploy en GitHub Pages

El proyecto ya está configurado para funcionar en GitHub Pages.

1. Ve a tu repositorio → **Settings → Pages**
2. Source: `Deploy from a branch` → `main` → `/ (root)`
3. Actualiza en `js/supabase-config.js` con tus credenciales reales
4. En Supabase agrega `https://tuusuario.github.io/AXON-LAB/pages/restablecer.html` a las Redirect URLs

---

## 6. Estructura de archivos

```
AXON-LAB/
├── index.html                  # SPA principal
├── supabase_setup.sql          # Script SQL completo ← EJECUTAR PRIMERO
├── CONFIGURACION.md            # Esta guía
├── css/
│   ├── estilo.css
│   ├── layout.css
│   ├── componentes.css
│   ├── animaciones.css
│   └── dark-mode.css
├── js/
│   ├── supabase-config.js      # 🔑 Credenciales Supabase
│   ├── auth.js                 # Auth completa (login/registro/reset)
│   ├── labs.js                 # CRUD laboratorios + uploads + enlaces
│   ├── router.js               # SPA router por hash
│   └── app.js                  # Inicializador principal
└── pages/
    ├── inicio.html             # Home con stats
    ├── laboratorios.html       # Listado con búsqueda y filtros
    ├── categorias.html         # Grid de categorías
    ├── detalle.html            # Vista de detalle de un lab
    ├── subir.html              # Upload archivo + enlace externo
    ├── login.html              # Login + recuperar contraseña
    ├── registro.html           # Registro + verificación email
    └── restablecer.html        # Nueva contraseña (desde email)
```

---

## 7. Roles de usuario

| Rol | Puede ver labs | Puede subir | Puede eliminar ajenos |
|-----|:-:|:-:|:-:|
| Invitado (sin login) | ✅ | ❌ | ❌ |
| `estudiante` | ✅ | ✅ | ❌ |
| `docente` | ✅ | ✅ | ❌ |
| `admin` | ✅ | ✅ | ✅ |

Para promover a admin, ejecuta en SQL Editor:
```sql
UPDATE public.perfiles SET rol = 'admin' WHERE email = 'tu@correo.com';
```

---

## 8. SQLite (entorno local sin Supabase)

Este proyecto usa Supabase directamente desde el frontend (no hay backend Node/Python).
SQLite **no es compatible** con este stack sin agregar un servidor backend.

**Alternativa para pruebas offline**: puedes usar el [mock local de Supabase](https://supabase.com/docs/guides/cli) con:
```bash
npm install -g supabase
supabase init
supabase start   # Levanta Postgres local + API compatible con Supabase SDK
```

---

## 9. Errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `CORS error` | Abriste con `file://` | Usar Live Server o servidor HTTP |
| `Invalid API key` | Credenciales incorrectas | Verificar `supabase-config.js` |
| `relation "perfiles" does not exist` | SQL no ejecutado | Ejecutar `supabase_setup.sql` |
| `new row violates row-level security` | RLS sin política | Verificar políticas en SQL |
| `storage bucket not found` | Buckets no creados | El SQL crea los buckets automáticamente |
| Link reset password no funciona | Redirect URL no configurada | Agregar URL en Auth → URL Configuration |
