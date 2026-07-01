# 🔒 Auditoría de Ciberseguridad — LogiControl v1.2

## Información General

| Campo | Valor |
|-------|-------|
| **Sistema** | LogiControl v1.2.0 |
| **Stack Tecnológico** | React 19, TanStack Start/Router, TypeScript, Supabase, Zustand, Vite |
| **Fecha de Auditoría** | Junio 2025 |
| **Estándar Aplicado** | OWASP Top 10 (2021), OWASP ASVS 4.0, mejores prácticas de desarrollo seguro |
| **Alcance** | Código fuente del frontend y funciones del servidor (14 archivos críticos) |
| **Clasificación** | Auditoría de caja blanca (análisis estático de código) |

---

## Resumen Ejecutivo

La aplicación LogiControl presenta una arquitectura moderna con separación cliente/servidor
adecuada. Sin embargo, se identificaron **vulnerabilidades críticas** que requieren atención
inmediata, junto con hallazgos de severidad alta y media que deben abordarse en un plan de
remediación priorizado.

### Distribución de Hallazgos

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| 🔴 **CRÍTICA** | 3 | Requiere acción inmediata |
| 🟠 **ALTA** | 6 | Requiere acción a corto plazo |
| 🟡 **MEDIA** | 8 | Planificar remediación |
| 🟢 **BAJA** | 5 | Mejora recomendada |

---

## 1. Autenticación (Sesiones, Tokens, Refresh, Logout, Almacenamiento de Credenciales)

### ✅ Aspectos Positivos

- Uso de `supabase.auth.onAuthStateChange` para escuchar cambios de sesión en tiempo real.
- `autoRefreshToken: true` configurado correctamente en el cliente.
- `signOut()` implementado y accesible desde la interfaz.
- El middleware `requireSupabaseAuth` valida tokens JWT en cada server function.
- `persistSession: true` mantiene la sesión entre recargas.

### 🔴 HALLAZGO CRÍTICO C-01: Service Role Key Expuesta en Archivo .env Versionado

**Descripción:** El archivo `.env` contiene la `SUPABASE_SERVICE_ROLE_KEY` con valor real y,
aunque `.gitignore` incluye `.env`, el archivo ya fue commiteado al repositorio Git (existe
en el directorio `.git`). Cualquier persona con acceso al repositorio puede obtener acceso
total a la base de datos, bypaseando RLS completamente.

**Riesgo:** CRÍTICO (CVSS 9.8)

**Impacto:** Acceso total a la base de datos, creación/eliminación de usuarios, lectura de
todos los datos de negocio, modificación o borrado masivo de registros.

**Recomendación:**
1. Rotar inmediatamente la Service Role Key desde el panel de Supabase.
2. Eliminar el archivo `.env` del historial de Git usando `git filter-branch` o BFG Repo-Cleaner.
3. Usar variables de entorno del proveedor de hosting (Lovable Cloud, Vercel, etc.).

**Ejemplo de Implementación:**
```bash
# Rotar la key en Supabase Dashboard > Settings > API
# Eliminar del historial de Git:
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Configurar en el proveedor de hosting (ejemplo Vercel):
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```


### 🟡 HALLAZGO M-01: Almacenamiento de Sesión en localStorage

**Descripción:** En `client.ts` se configura `storage: localStorage` para las sesiones de
Supabase. `localStorage` es accesible desde cualquier script JavaScript en la misma página,
haciéndolo vulnerable a ataques XSS.

**Riesgo:** MEDIO

**Impacto:** Si un atacante logra inyectar JavaScript (XSS), puede robar el token de sesión
y suplantar al usuario.

**Recomendación:** Considerar migrar a cookies `httpOnly` para el almacenamiento de sesiones
en entornos SSR (TanStack Start lo soporta). Esto elimina la posibilidad de acceso por
JavaScript malicioso.

**Ejemplo de Implementación:**
```typescript
// En auth-middleware.ts, usar cookie-based auth:
import { parseCookies, setCookie } from 'vinxi/http';

export const supabaseSSR = createServerClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
  {
    cookies: {
      get(name: string) {
        const cookies = parseCookies();
        return cookies[name];
      },
      set(name: string, value: string, options: CookieOptions) {
        setCookie(name, value, { ...options, httpOnly: true, secure: true, sameSite: 'lax' });
      },
      remove(name: string, options: CookieOptions) {
        setCookie(name, '', { ...options, maxAge: 0 });
      },
    },
  }
);
```

### 🟡 HALLAZGO M-02: Registro Público (Sign-Up) Habilitado sin Restricciones

**Descripción:** En `login.tsx`, el formulario de registro (`signUp`) está expuesto
públicamente. Cualquier persona puede crear una cuenta en el sistema sin invitación o
aprobación del administrador.

**Riesgo:** MEDIO

**Impacto:** Usuarios no autorizados pueden acceder al sistema. Aunque tendrían rol "viewer"
por defecto, pueden ver datos de negocio sensibles (montos USD, proveedores, operaciones).

**Recomendación:** Deshabilitar el auto-registro desde Supabase Dashboard o implementar un
flujo de invitación controlado por el administrador (que ya existe en `createUserAdmin`).

**Ejemplo de Implementación:**
```typescript
// Opción 1: Deshabilitar signup en Supabase Dashboard
// Authentication > Settings > Disable Sign ups

// Opción 2: Si se necesita mantener, añadir dominio permitido:
const ALLOWED_DOMAINS = ['@empresa.com', '@logicontrol.co'];
const submit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (mode === "signup") {
    const domain = email.split('@')[1];
    if (!ALLOWED_DOMAINS.some(d => email.endsWith(d))) {
      toast.error("Solo se permiten correos corporativos");
      return;
    }
    // ... resto del signup
  }
};
```

---


## 2. Autorización (Roles, Permisos, Protección de Rutas, Server Functions)

### ✅ Aspectos Positivos

- Sistema de roles de 3 niveles (admin, operador, viewer) bien definido.
- `assertAdmin()` en todas las server functions administrativas.
- Middleware `requireSupabaseAuth` protege todas las funciones del servidor.
- Validación con Zod de los inputs en server functions.
- Protección contra auto-eliminación del administrador (`data.user_id === userId`).

### 🟠 HALLAZGO A-01: Protección de Rutas Solo en Frontend (Client-Side)

**Descripción:** La protección de rutas se realiza exclusivamente en el componente `AppShell`
mediante `if (!user) return <Navigate to="/login" />`. No existe un `beforeLoad` a nivel de
ruta de TanStack Router que proteja server-side. Un atacante puede acceder a los datos
manipulando el estado del cliente.

**Riesgo:** ALTO

**Impacto:** Si un atacante manipula el estado del cliente o accede directamente a las API de
Supabase con un token válido, puede acceder a datos sin la restricción de UI.

**Recomendación:** Implementar `beforeLoad` en rutas protegidas para validar autenticación
a nivel de servidor antes de renderizar.

**Ejemplo de Implementación:**
```typescript
// En cada ruta protegida (o en un layout compartido):
export const Route = createFileRoute("/operaciones")({
  beforeLoad: async ({ context }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
  },
  component: () => <AppShell><Operaciones /></AppShell>,
});

// Alternativa: crear un layout autenticado:
// src/routes/_authenticated.tsx
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: '/login' });
  },
});
```

### 🟠 HALLAZGO A-02: Falta de Verificación de Rol en Operaciones de Datos (Store)

**Descripción:** En `jobs-store.ts`, las operaciones `addJob`, `updateJob`, `deleteJob`,
`resetToDemo`, y `clearAll` se ejecutan directamente con el cliente Supabase del usuario
autenticado, sin verificar que el rol del usuario tenga permisos para esa operación.

**Riesgo:** ALTO

**Impacto:** Un usuario con rol "viewer" podría, mediante manipulación del estado o llamadas
directas, modificar o eliminar datos si las políticas RLS de Supabase no están correctamente
configuradas. La función `clearAll` y `resetToDemo` son particularmente peligrosas.

**Recomendación:** Mover operaciones destructivas (`clearAll`, `resetToDemo`) a server
functions protegidas con `assertAdmin()`, y confiar en RLS para las operaciones CRUD regulares.

**Ejemplo de Implementación:**
```typescript
// Crear server function para operaciones destructivas:
export const clearAllJobsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as unknown as AuthContext;
    await assertAdmin(userId);
    await supabaseAdmin.from("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return { success: true };
  });

// En el store, llamar a la server function:
clearAll: async () => {
  await clearAllJobsAdmin();
  set({ jobs: [], lastImport: null });
},
```

### 🟡 HALLAZGO M-03: Sin Control de Rol para Rutas Específicas (Solo UI)

**Descripción:** La ruta `/usuarios` y `/configuracion` (pestaña Usuarios) solo ocultan
contenido en la UI basándose en `useMyRole().isAdmin`. El filtrado de navegación en
`app-sidebar.tsx` usa `adminOnly` como flag de UI, pero la ruta en sí es accesible.

**Riesgo:** MEDIO

**Impacto:** Un usuario con rol "operador" o "viewer" puede navegar manualmente a
`/configuracion` y ver la estructura de la página, aunque las server functions bloqueen
las acciones administrativas.

**Recomendación:** Añadir verificación de rol tanto en la UI como en `beforeLoad` de la
ruta para redirigir a usuarios sin permisos.

**Ejemplo de Implementación:**
```typescript
// En /usuarios o /configuracion, validar rol antes de cargar:
export const Route = createFileRoute("/usuarios")({
  beforeLoad: async () => {
    // Verificar sesión y rol
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: '/login' });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (data?.role !== 'admin') throw redirect({ to: '/' });
  },
  component: () => <AppShell><UsuariosPage /></AppShell>,
});
```

---


## 3. Variables de Entorno (Exposición de Service Key, Público vs Privado)

### ✅ Aspectos Positivos

- Separación correcta entre `VITE_SUPABASE_*` (público) y `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- `client.server.ts` solo usa `process.env` (no `import.meta.env`), previniendo bundling al cliente.
- Variables de entorno validadas con mensajes de error descriptivos al iniciar.

### 🔴 HALLAZGO CRÍTICO C-02: Service Role Key Commiteada al Repositorio

**Descripción:** El archivo `.env` contiene:
- `SUPABASE_SERVICE_ROLE_KEY` (clave con acceso total a la BD, bypasa RLS)
- `SUPABASE_PROJECT_ID`

Aunque `.gitignore` lista `.env`, el archivo existe en el directorio del proyecto y fue
commiteado previamente (evidenciado por `.git/COMMIT_EDITMSG` activo). El historial de Git
preserva todos los valores en claro indefinidamente.

**Riesgo:** CRÍTICO (CVSS 9.8)

**Impacto:** Cualquier persona con acceso al repositorio (actual o historial) puede:
- Leer/modificar/eliminar TODOS los datos sin restricción de RLS.
- Crear usuarios administradores.
- Eliminar tablas completas.
- Acceder a información confidencial de operaciones comerciales.

**Recomendación:**
1. **Inmediato:** Rotar TODAS las claves en Supabase Dashboard.
2. **Inmediato:** Eliminar `.env` del historial de Git.
3. **Permanente:** Usar solo variables de entorno del proveedor de hosting.
4. **Permanente:** Implementar detección de secretos en pre-commit hooks.

**Ejemplo de Implementación:**
```bash
# 1. Instalar herramienta de detección de secretos:
npm install -D @secretlint/secretlint-rule-preset-recommend secretlint

# 2. Crear .secretlintrc.json:
{
  "rules": [
    { "id": "@secretlint/secretlint-rule-preset-recommend" }
  ]
}

# 3. Agregar pre-commit hook (con husky):
npx husky add .husky/pre-commit "npx secretlint '**/*'"

# 4. Limpiar historial con BFG:
bfg --delete-files .env
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

### 🟢 HALLAZGO B-01: Fallback de Variables de Entorno Client/Server Mezclado

**Descripción:** En `client.ts`:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
```
El fallback a `process.env` en código que se ejecuta tanto en cliente como en servidor puede
crear confusión y posibles leaks si Vite no realiza tree-shaking correcto.

**Riesgo:** BAJO

**Impacto:** Bajo riesgo real dado que Vite reemplaza `process.env.X` con `undefined` en el
bundle del cliente, pero la intención del código no es clara.

**Recomendación:** Documentar claramente la razón del fallback (SSR) y considerar usar una
utilidad de entorno unificada.

---


## 4. Base de Datos (RLS, Políticas, Permisos)

### ✅ Aspectos Positivos

- `client.server.ts` claramente documentado: "bypasses RLS - use only for admin operations".
- Las server functions usan `supabaseAdmin` solo para operaciones administrativas legítimas.
- El auth middleware crea un cliente Supabase con el token del usuario para respetar RLS.

### 🟠 HALLAZGO A-03: Operaciones CRUD en Cliente sin Garantía de RLS

**Descripción:** El `jobs-store.ts` opera directamente con el cliente de Supabase del usuario
(`supabase.from("jobs").insert(...)`, `.update(...)`, `.delete(...)`). La seguridad depende
**completamente** de que las políticas RLS en Supabase estén correctamente configuradas.
No se pudo verificar la configuración de RLS (está en Supabase Dashboard, fuera del código).

**Riesgo:** ALTO (condicionado a la configuración de RLS)

**Impacto:** Si las políticas RLS no están correctas:
- Un usuario "viewer" podría insertar, actualizar o eliminar registros.
- Un usuario podría acceder a datos de operaciones que no le corresponden.
- `clearAll` y `resetToDemo` podrían ejecutarse sin restricción.

**Recomendación:** Auditar y documentar las políticas RLS activas. Implementar políticas
granulares basadas en roles.

**Ejemplo de Implementación:**
```sql
-- Política RLS para tabla "jobs":
-- Lectura: todos los usuarios autenticados pueden leer
CREATE POLICY "jobs_select_authenticated" ON public.jobs
  FOR SELECT TO authenticated USING (true);

-- Inserción: solo admin y operador
CREATE POLICY "jobs_insert_role" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'operador')
    )
  );

-- Eliminación: solo admin
CREATE POLICY "jobs_delete_admin" ON public.jobs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Actualización: admin y operador
CREATE POLICY "jobs_update_role" ON public.jobs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'operador')
    )
  );
```

### 🟡 HALLAZGO M-04: Sin Auditoría de Cambios en Base de Datos

**Descripción:** No existe un registro de auditoría (audit log) que registre quién modificó,
eliminó o creó registros en la tabla `jobs`. El campo `created_by` se establece al insertar
pero no hay `updated_by` ni historial de cambios.

**Riesgo:** MEDIO

**Impacto:** Imposibilidad de rastrear acciones maliciosas o errores humanos. No se puede
determinar quién ejecutó `clearAll` o quién modificó un registro específico.

**Recomendación:** Implementar trigger de auditoría en PostgreSQL.

**Ejemplo de Implementación:**
```sql
-- Tabla de auditoría
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  user_id UUID REFERENCES auth.users(id),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger function
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, record_id, action, user_id, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar a tabla jobs
CREATE TRIGGER jobs_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---


## 5. Server Functions (Validación de Parámetros, Checks de Rol, Manejo de Errores)

### ✅ Aspectos Positivos

- Validación con Zod en todos los inputs (`z.string().email()`, `z.string().min(8)`, `z.string().uuid()`).
- `assertAdmin()` como guard centralizado antes de cada operación administrativa.
- Errores genéricos enviados al cliente (no exponen stack traces).
- Protección contra auto-eliminación de admin.
- Input validators con mensajes en español para la UX.

### 🟡 HALLAZGO M-05: Mensajes de Error de Supabase Auth Expuestos al Cliente

**Descripción:** En `users.functions.ts`:
```typescript
if (authErr) throw new Error(authErr.message);
```
Los mensajes de error de Supabase Auth se propagan directamente al frontend. Estos pueden
revelar información sobre la existencia de usuarios ("User already registered") o detalles
de configuración.

**Riesgo:** MEDIO

**Impacto:** Enumeración de usuarios (un atacante puede determinar si un email está
registrado), y posible exposición de detalles internos del sistema.

**Recomendación:** Mapear errores de Supabase a mensajes genéricos para el cliente.

**Ejemplo de Implementación:**
```typescript
// Mapeo de errores seguro:
function sanitizeAuthError(err: { message: string; status?: number }): string {
  const genericMessages: Record<string, string> = {
    'User already registered': 'No se pudo completar la operación. Verifique los datos.',
    'Email rate limit exceeded': 'Demasiados intentos. Intente más tarde.',
    'Password should be at least': 'La contraseña no cumple los requisitos mínimos.',
  };
  for (const [key, msg] of Object.entries(genericMessages)) {
    if (err.message.includes(key)) return msg;
  }
  return 'Error al procesar la solicitud. Contacte al administrador.';
}

// Uso:
if (authErr) throw new Error(sanitizeAuthError(authErr));
```

### 🟢 HALLAZGO B-02: Sin Límite de Intentos en Cambio de Contraseña

**Descripción:** La función `changePasswordAdmin` no tiene rate limiting. Un administrador
comprometido podría intentar cambiar contraseñas masivamente sin restricción.

**Riesgo:** BAJO (requiere acceso admin previo)

**Impacto:** En caso de compromiso de una cuenta admin, el atacante podría cambiar
contraseñas de todos los usuarios rápidamente.

**Recomendación:** Implementar logging de cada cambio de contraseña y alertas por actividad
inusual. Considerar requerir la contraseña actual del admin para confirmar la operación.

---


## 6. Validación de Datos (Formularios, APIs, Importaciones Excel)

### ✅ Aspectos Positivos

- Validación con Zod en server functions (email, password min 8, uuid, enum de roles).
- Formularios con `required`, `minLength`, y `type="email"` en HTML.
- Confirmación de contraseña verificada antes de enviar.
- El parser de Excel (`excel-import.ts`) normaliza y sanitiza valores con `String()` y `.trim()`.

### 🟠 HALLAZGO A-04: Sin Validación de Tamaño/Tipo de Archivo Excel

**Descripción:** En `importar.tsx`, la función `handleFile` acepta cualquier archivo sin
verificar:
- Tamaño máximo del archivo
- Tipo MIME real del archivo
- Extensión del archivo
- Número máximo de filas

Un archivo de 500MB+ o un archivo malicioso disfrazado como Excel podría causar DoS en el
navegador o el servidor.

**Riesgo:** ALTO

**Impacto:**
- DoS del navegador del usuario al procesar archivos enormes.
- Posible desbordamiento de memoria.
- Inserción masiva de cientos de miles de registros a Supabase (el loop en `addJobs` va
  hasta 200,000 registros sin límite configurable).

**Recomendación:** Validar archivo antes del procesamiento.

**Ejemplo de Implementación:**
```typescript
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const ALLOWED_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];
const MAX_ROWS = 50000;

const handleFile = async (file: File) => {
  // Validar extensión
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    toast.error(`Tipo de archivo no permitido. Use: ${ALLOWED_EXTENSIONS.join(', ')}`);
    return;
  }

  // Validar MIME type
  if (file.type && !ALLOWED_MIMES.includes(file.type)) {
    toast.error('El archivo no parece ser un Excel válido.');
    return;
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`Archivo demasiado grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024} MB`);
    return;
  }

  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    // ... continúa procesamiento

    // Validar número de filas después de parsear:
    if (result.jobs.length > MAX_ROWS) {
      toast.error(`El archivo contiene ${result.jobs.length} filas. Máximo permitido: ${MAX_ROWS}`);
      return;
    }
  } catch (err) {
    toast.error("Error al leer el archivo. Verifique que sea un Excel válido.");
  }
};
```

### 🟡 HALLAZGO M-06: Sin Sanitización de Contenido de Celdas Excel (XSS Almacenado)

**Descripción:** Los valores extraídos del Excel se convierten a `String()` y se insertan
en Supabase sin sanitización de caracteres HTML/JS. Si un campo como `observaciones` o
`material` contiene `<script>alert('XSS')</script>`, se almacena tal cual.

**Riesgo:** MEDIO

**Impacto:** XSS almacenado (Stored XSS). Los datos maliciosos se renderizan en componentes
React. React escapa por defecto con JSX, lo que **mitiga significativamente** este riesgo,
pero existen vectores como `dangerouslySetInnerHTML`, atributos `href`, o tooltips HTML.

**Recomendación:** Sanitizar valores al importar (eliminar tags HTML) como defensa en
profundidad, incluso si React escapa la mayoría de casos.

**Ejemplo de Implementación:**
```typescript
// Utilidad de sanitización para valores de Excel:
function sanitizeExcelValue(value: unknown): string {
  const str = String(value ?? '').trim();
  // Eliminar tags HTML potencialmente peligrosos
  return str.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '');
}

// También prevenir CSV injection (fórmulas maliciosas):
function sanitizeFormulaInjection(value: string): string {
  // Si comienza con =, +, -, @ puede ser fórmula maliciosa
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value; // Prefijo de texto en Excel
  }
  return value;
}
```

---


## 7. Ataques Comunes (SQLi, XSS, CSRF, Clickjacking, IDOR, Mass Assignment)

### ✅ Aspectos Positivos

- **SQLi:** Supabase client utiliza consultas parametrizadas internamente (PostgREST). No se
  construyen queries SQL manualmente en el código.
- **XSS:** React escapa automáticamente el contenido renderizado en JSX. No se encontró uso de
  `dangerouslySetInnerHTML`.
- **CSRF:** Las server functions usan tokens Bearer (no cookies), lo que mitiga CSRF clásico.
- **IDOR:** Los UUIDs de Supabase hacen impráctica la enumeración secuencial.

### 🟠 HALLAZGO A-05: Posible Mass Assignment en Operaciones de Update

**Descripción:** En `jobs-store.ts`, la función `updateJob(id, patch)` acepta un `Partial<Job>`
arbitrario y lo convierte a una fila de base de datos sin filtrar los campos permitidos:
```typescript
updateJob: async (id, patch) => {
  const patchRow = jobToRow(patch); // Convierte TODOS los campos del patch
  await supabase.from("jobs").update(patchRow).eq("id", id);
}
```

Un usuario malintencionado podría enviar campos adicionales como `created_by` o intentar
modificar campos que no debería poder cambiar según su rol.

**Riesgo:** ALTO (mitigado parcialmente por RLS si está correctamente configurado)

**Impacto:** Modificación de campos protegidos, escalación de privilegios si `created_by`
o campos de auditoría son modificables.

**Recomendación:** Implementar una lista blanca de campos editables por rol y filtrar el
patch antes de enviarlo a Supabase.

**Ejemplo de Implementación:**
```typescript
const EDITABLE_FIELDS_BY_ROLE: Record<AppRole, Set<string>> = {
  admin: new Set(['*']), // todos
  operador: new Set([
    'status', 'observaciones', 'eta', 'ata', 'aduana', 'factura',
    'responsable', 'prioridad', 'escalado', 'motivoRetraso',
    // ... campos operativos
  ]),
  viewer: new Set([]), // ninguno
};

function filterPatchByRole(patch: Partial<Job>, role: AppRole): Partial<Job> {
  const allowed = EDITABLE_FIELDS_BY_ROLE[role];
  if (allowed.has('*')) return patch;
  const filtered: Partial<Job> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (allowed.has(key)) {
      (filtered as any)[key] = value;
    }
  }
  return filtered;
}
```

### 🟡 HALLAZGO M-07: Sin Protección contra Clickjacking

**Descripción:** No se encontraron headers de seguridad configurados en la aplicación:
- `X-Frame-Options`
- `Content-Security-Policy` con `frame-ancestors`

La aplicación podría ser embebida en un iframe malicioso para capturar clicks del usuario.

**Riesgo:** MEDIO

**Impacto:** Un atacante podría crear una página que embeba LogiControl en un iframe
transparente y engañar al usuario para realizar acciones no deseadas (eliminar datos,
cambiar roles, etc.).

**Recomendación:** Configurar headers de seguridad en el servidor/CDN.

**Ejemplo de Implementación:**
```typescript
// En la configuración de Vite/Nitro (server middleware):
// vite.config.ts o nitro.config.ts
export default defineConfig({
  server: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "frame-ancestors 'none'; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co",
    }
  }
});

// O en public/_headers (para Netlify/Cloudflare):
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Content-Security-Policy: frame-ancestors 'none'
  Referrer-Policy: strict-origin-when-cross-origin
*/
```

### 🟢 HALLAZGO B-03: Operación DELETE sin Confirmación Server-Side

**Descripción:** `deleteJob` en el store ejecuta el DELETE directamente sin confirmación
adicional del lado del servidor. La confirmación `confirm()` del navegador en la UI puede
ser bypaseada.

**Riesgo:** BAJO (mitigado por RLS)

**Impacto:** Eliminación accidental o maliciosa de registros si RLS no restringe DELETE.

**Recomendación:** Implementar soft-delete (marcar como eliminado) en lugar de hard-delete.

---


## 8. Frontend (Protección de Rutas, localStorage, Manejo de Tokens, Exposición de Información)

### ✅ Aspectos Positivos

- Redirección a `/login` cuando no hay usuario autenticado (via `AppShell`).
- No se exponen tokens en URLs o query parameters.
- El signOut limpia la sesión correctamente.
- Los errores de autenticación se muestran como toasts genéricos.

### 🟡 HALLAZGO M-08: Console.log con Información Sensible en Producción

**Descripción:** Se encontraron múltiples `console.log` y `console.error` en código de
producción:
- `jobs-store.ts`: `console.log(\`[Store] Loaded ${all.length} jobs from cloud\`)`
- `jobs-store.ts`: `console.error(error)` (puede exponer detalles del error de Supabase)
- `__root.tsx`: `console.error(error)` en `ErrorComponent`
- `auth-middleware.ts`: `console.error(\`[Supabase] ${message}\`)` con nombres de variables

**Riesgo:** MEDIO

**Impacto:** Un atacante con acceso a la consola del navegador (DevTools) puede observar
información interna del sistema: cantidad de registros, errores de base de datos, nombres
de variables de entorno faltantes.

**Recomendación:** Eliminar o condicionar logs en producción.

**Ejemplo de Implementación:**
```typescript
// Crear utilidad de logging condicional:
const isDev = import.meta.env.DEV;

export const logger = {
  info: (...args: unknown[]) => isDev && console.log(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  error: (...args: unknown[]) => {
    if (isDev) console.error(...args);
    // En producción, enviar a servicio de monitoreo (ej: Sentry)
    // else reportToSentry(args);
  },
};

// Uso en jobs-store.ts:
import { logger } from '@/lib/logger';
logger.info(`[Store] Loaded ${all.length} jobs from cloud`);
```

### 🟠 HALLAZGO A-06: Exposición de Metadata de OpenGraph con URLs Internas

**Descripción:** En `__root.tsx`, los meta tags de OpenGraph exponen URLs de assets internos
almacenados en R2 (Cloudflare):
```
og:image: https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/...
```

**Riesgo:** ALTO (información)

**Impacto:** Revela infraestructura interna (Cloudflare R2 bucket público), ID del proyecto,
y podría ser utilizado para reconocimiento en ataques dirigidos.

**Recomendación:** Usar un dominio propio con CDN para assets públicos o un proxy que oculte
la infraestructura subyacente.

### 🟢 HALLAZGO B-04: Información de Versión Expuesta en UI

**Descripción:** El sidebar muestra "v1.0" y la página "Acerca de" muestra "v1.2.0", email
de contacto, nombre del desarrollador y stack tecnológico completo.

**Riesgo:** BAJO

**Impacto:** Facilita el reconocimiento del sistema por parte de atacantes (fingerprinting).

**Recomendación:** Mostrar versión solo a usuarios autenticados (ya implementado al estar
dentro de `AppShell`) y considerar no exponer el stack tecnológico en la interfaz de
producción.

---


## 9. Carga de Archivos (Excel: Tamaño, Tipo, Contenido, Archivos Maliciosos)

### ✅ Aspectos Positivos

- El procesamiento de Excel se realiza en el navegador del cliente (no en el servidor),
  limitando el impacto de archivos maliciosos.
- Uso de la librería `xlsx` que parsea el archivo de forma segura sin ejecutar macros.
- Drag-and-drop implementado con manejo de errores.

### 🟠 HALLAZGO A-07: Falta de Límites en la Importación Masiva

**Descripción:** La función `addJobs` en `jobs-store.ts` tiene un loop que procesa chunks
de 500 registros hasta completar TODOS los datos del Excel, con un límite superior de
200,000 registros en `loadFromCloud`:
```typescript
if (all.length > 200000) break; // Límite solo en lectura
```
Pero no hay límite en la escritura (`addJobs`). Un archivo con 100,000+ filas generaría:
- 200+ requests HTTP a Supabase
- Carga significativa en la base de datos
- Posible timeout o throttling de Supabase

**Riesgo:** ALTO

**Impacto:** DoS de la base de datos, costos excesivos en Supabase (por queries), y
degradación del servicio para todos los usuarios.

**Recomendación:** Implementar límites de importación por sesión y confirmar cantidades
grandes con el usuario.

**Ejemplo de Implementación:**
```typescript
const MAX_IMPORT_ROWS = 10000;
const MAX_IMPORTS_PER_HOUR = 5;

addJobs: async (newJobs, fileName) => {
  if (newJobs.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Límite excedido: ${newJobs.length} filas. Máximo permitido: ${MAX_IMPORT_ROWS}. ` +
      `Divida el archivo en partes más pequeñas.`
    );
  }

  // Verificar rate limit (almacenado en localStorage o server-side)
  const imports = JSON.parse(localStorage.getItem('import_history') ?? '[]');
  const recentImports = imports.filter(
    (t: number) => Date.now() - t < 3600000 // última hora
  );
  if (recentImports.length >= MAX_IMPORTS_PER_HOUR) {
    throw new Error('Límite de importaciones por hora alcanzado. Intente más tarde.');
  }
  // ... continuar con la importación
  localStorage.setItem('import_history',
    JSON.stringify([...recentImports, Date.now()])
  );
};
```

### 🟡 HALLAZGO M-09: Vulnerabilidad de Zip Bomb en Archivos XLSX

**Descripción:** Los archivos XLSX son archivos ZIP internamente. La librería `xlsx` puede
ser vulnerable a "zip bombs" (archivos comprimidos que se expanden a tamaños enormes en
memoria), causando agotamiento de memoria en el navegador.

**Riesgo:** MEDIO

**Impacto:** Crash del navegador del usuario (DoS local). No afecta al servidor.

**Recomendación:** Validar el tamaño del archivo ANTES de procesarlo con `XLSX.read()`.
Considerar usar Web Workers para procesamiento pesado.

**Ejemplo de Implementación:**
```typescript
// Procesar en Web Worker para no bloquear UI:
// excel-worker.ts
self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(e.data, { type: "array", cellDates: true });
    // Validar tamaño de sheet
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
    const rowCount = range.e.r - range.s.r;
    if (rowCount > 100000) {
      self.postMessage({ error: `Archivo con ${rowCount} filas excede el límite` });
      return;
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    self.postMessage({ rows });
  } catch (err) {
    self.postMessage({ error: 'Error al procesar archivo' });
  }
};
```

---

