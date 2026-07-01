# DOCUMENTO TÉCNICO — LogiControl v1.2
## Sistema de Seguimiento Logístico y Control de Operaciones

**Versión:** 1.2.0  
**Fecha:** Junio 2026  
**Desarrollador:** Misael Becerra  
**País:** Colombia

---

## 1. DESCRIPCIÓN GENERAL

LogiControl es una plataforma web tipo ERP (Enterprise Resource Planning) orientada al control y seguimiento de operaciones de compras, importaciones y logística empresarial. Permite gestionar el ciclo completo de una orden de compra desde su creación hasta la entrega final en campo.

### 1.1 Propósito
Brindar visibilidad completa de cada operación, optimizando la toma de decisiones y fortaleciendo la eficiencia en toda la cadena de suministro.

### 1.2 Alcance
- Seguimiento por línea de orden de compra (LLAVE = OC + Posición)
- Dashboard gerencial con KPIs en tiempo real
- Control de incumplimiento y alertas operativas
- Módulo independiente de importaciones
- Gestión de usuarios con roles y permisos
- Importación masiva desde archivos Excel

---

## 2. ARQUITECTURA TÉCNICA

### 2.1 Stack Tecnológico

| Componente | Tecnología | Versión | Propósito |
|---|---|---|---|
| Frontend | React | 19.2 | Interfaz de usuario |
| Routing | TanStack Router | 1.168 | Navegación SPA |
| Estado global | Zustand | 5.0 | Manejo de estado |
| Base de datos | Supabase (PostgreSQL) | — | Persistencia y auth |
| UI Components | shadcn/ui + Radix | — | Componentes accesibles |
| Estilos | Tailwind CSS | 4.2 | Diseño responsivo |
| Gráficos | Recharts | 2.15 | Visualización de datos |
| Build | Vite | 8.0 | Empaquetado y dev server |
| Lenguaje | TypeScript | 5.8 | Tipado estático |
| Excel | xlsx (SheetJS) | 0.18 | Lectura/escritura Excel |
| Validación | Zod | 3.24 | Validación de esquemas |
| Formularios | React Hook Form | 7.71 | Manejo de formularios |

### 2.2 Arquitectura de Capas

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  React 19 + TanStack Router + Tailwind CSS      │
├─────────────────────────────────────────────────┤
│              ESTADO (Zustand Store)              │
│  jobs-store.ts — CRUD + paginación + import     │
├─────────────────────────────────────────────────┤
│            LÓGICA DE NEGOCIO                     │
│  operational.ts — cálculos, SLA, días hábiles   │
│  excel-import.ts — parsing y mapeo columnas     │
│  aggregations.ts — agrupaciones por OC          │
├─────────────────────────────────────────────────┤
│              BACKEND (Supabase)                  │
│  PostgreSQL — tabla 'jobs' + 'profiles' + roles │
│  Auth — autenticación email/password            │
│  RLS — seguridad a nivel de fila                │
│  Server Functions — operaciones admin           │
└─────────────────────────────────────────────────┘
```

### 2.3 Estructura de Archivos

```
src/
├── components/          # Componentes reutilizables
│   ├── app-shell.tsx    # Layout principal con sidebar
│   ├── app-sidebar.tsx  # Navegación lateral
│   ├── job-form-dialog.tsx
│   ├── tracking-edit-dialog.tsx
│   └── ui/             # shadcn/ui components
├── integrations/
│   └── supabase/
│       ├── client.ts    # Cliente Supabase (browser)
│       ├── client.server.ts # Cliente admin (server)
│       ├── auth-middleware.ts
│       └── types.ts     # Tipos generados
├── lib/
│   ├── jobs-data.ts     # Tipos e interfaces (Job, Status, etc.)
│   ├── jobs-store.ts    # Zustand store principal
│   ├── operational.ts   # Lógica de negocio (días hábiles, USD, SLA)
│   ├── excel-import.ts  # Parser de Excel con aliases
│   ├── export-excel.ts  # Exportación a Excel
│   ├── aggregations.ts  # Agrupaciones
│   ├── auth.tsx         # Contexto de autenticación
│   ├── use-role.ts      # Hook de rol del usuario
│   └── use-profile.ts   # Hook de perfil del usuario
├── routes/
│   ├── __root.tsx       # Layout raíz + meta tags
│   ├── index.tsx        # Redirect a dashboard
│   ├── login.tsx        # Autenticación
│   ├── dashboard-gerencial.tsx # Dashboard principal
│   ├── casos.tsx        # Órdenes de Compra
│   ├── operaciones.tsx  # Tabla de líneas
│   ├── operaciones.$jobId.tsx # Detalle de línea
│   ├── importaciones.tsx # Módulo importaciones
│   ├── proyecciones.tsx # Forecast de entregas
│   ├── importar.tsx     # Importar Excel
│   ├── reportes.tsx     # Exportar reportes
│   ├── alertas.tsx      # Alertas operativas
│   ├── configuracion.tsx # Admin + Manual + Legal
│   └── usuarios.tsx     # Gestión de usuarios
└── styles.css           # Estilos globales
```

---

## 3. MODELO DE DATOS

### 3.1 Tabla Principal: `jobs`

La tabla `jobs` almacena todas las líneas de órdenes de compra. Cada registro representa una **línea** identificada por LLAVE = OC + Posición.


#### Campos principales (~80+ columnas):

| Campo | Columna Excel | Tipo | Descripción |
|---|---|---|---|
| id | — | UUID | Identificador único autogenerado |
| llave | LLAVE | TEXT | OC + Posición (identificador compuesto) |
| oc | T | TEXT | Número de Orden de Compra |
| posicion | — | TEXT | Posición dentro de la OC |
| proveedor | — | TEXT | Nombre del proveedor |
| material | — | TEXT | Descripción del material |
| codigo_sap | — | TEXT | Código SAP del material |
| qty | AO | NUMERIC | Cantidad ordenada |
| qty_entregada | — | NUMERIC | Cantidad recibida |
| valor_total_usd | BC | NUMERIC | Valor total USD (fuente única) |
| valor_pendiente_usd | — | NUMERIC | Valor pendiente USD |
| estado_entrega | BF | TEXT | Estado: Borrado/Entregado/Entrega Parcial/Sin entrega |
| estado_adicional | BH | TEXT | Liberación: 0=Activa / L=Liberada / B=Bloqueada |
| anio | AL | INTEGER | Año de la orden |
| mes | AM | INTEGER | Mes de la orden |
| gerencia | K | TEXT | Gerencia responsable |
| campo | M | TEXT | Campo/ubicación |
| responsable | — | TEXT | Responsable del seguimiento |
| fecha_compromiso | — | DATE | Fecha compromiso de entrega |
| dias_incumplimiento | BK | INTEGER | Días de incumplimiento |
| categoria_seguimiento | BY | TEXT | Categoría: Revisión Administrativa / Revisión Proveedor |
| detalle_status | BZ | TEXT | Detalle del status |
| status_general | CA | TEXT | Status general operativo |
| tipo_compra | — | TEXT | Nacional / Importación |
| created_at | — | TIMESTAMP | Fecha de creación del registro |
| created_by | — | UUID | Usuario que importó |

### 3.2 Tabla: `profiles`

| Campo | Tipo | Descripción |
|---|---|---|
| user_id | UUID | FK a auth.users |
| email | TEXT | Correo electrónico |
| display_name | TEXT | Nombre para mostrar |
| created_at | TIMESTAMP | Fecha de registro |

### 3.3 Tabla: `user_roles`

| Campo | Tipo | Descripción |
|---|---|---|
| user_id | UUID | FK a auth.users |
| role | TEXT | admin / operador / viewer |

---

## 4. SEGURIDAD

### 4.1 Autenticación
- **Proveedor:** Supabase Auth (email + password)
- **Sesión:** JWT con refresh automático
- **Almacenamiento:** LocalStorage (persistSession: true)
- **Confirmación de email:** Automática para usuarios creados por admin

### 4.2 Autorización (Roles)

| Rol | Permisos |
|---|---|
| **admin** | Control total: CRUD usuarios, cambiar contraseñas, importar, exportar, ver todo |
| **operador** | Crear/actualizar casos, importar Excel, gestionar operaciones |
| **viewer** | Solo lectura: dashboard, reportes, consultas |

### 4.3 Control de Acceso

- **Row Level Security (RLS):** Habilitado en Supabase para tablas sensibles
- **Server Functions:** Operaciones admin (crear/eliminar usuarios, cambiar roles/contraseñas) se ejecutan server-side con `service_role_key`
- **Middleware de auth:** `requireSupabaseAuth` valida el JWT antes de cualquier operación server
- **Validación de roles:** `assertAdmin()` verifica rol antes de operaciones privilegiadas

### 4.4 Protección de Datos

- **Variables de entorno:** `.env` en `.gitignore`, nunca se commitea
- **Keys separadas:**
  - `VITE_SUPABASE_PUBLISHABLE_KEY` — para el cliente (pública, segura)
  - `SUPABASE_SERVICE_ROLE_KEY` — solo server-side (nunca expuesta al browser)
- **GitHub Push Protection:** Activado para detectar secrets en commits
- **Cifrado:** Supabase cifra datos en reposo y en tránsito (TLS)

### 4.5 Seguridad del Frontend

- **No se exponen secrets** en el código del cliente
- **Validación con Zod** en server functions
- **Input sanitization** en formularios
- **CORS** controlado por Supabase

---

## 5. MÓDULOS DEL SISTEMA

### 5.1 Dashboard Gerencial
- **Datos:** Solo líneas nacionales (excluye tipoCompra="Importación")
- **Filtros:** Año, Semestre, Trimestre, Mes, Gerencia, Campo, Cuenta, Proveedor, Equipo, Liberación (BH), Estado (BF)
- **KPIs:** USD Comprado/Recibido/Pendiente, Líneas, Cumplimiento, Semáforo BK
- **Gráficos:** Pie cumplimiento, tendencia mensual, USD por gerencia/campo, proveedores top 5
- **Cálculos:** Todos en días hábiles (lun-vie, sin festivos Colombia)

### 5.2 Órdenes de Compra
- **Agrupación:** Por número de OC
- **Paginación:** 25 OC por página
- **Expandible:** Click para ver líneas de cada OC
- **KPIs:** Total OC, con pendientes, completadas, USD

### 5.3 Operaciones (Líneas)
- **Vista:** Todas las líneas (nacionales + importaciones)
- **Tabla:** TanStack Table con sort, filtro, paginación (50/pág)
- **Columnas:** LLAVE, OC, Pos, Proveedor, Material, QTY, Estado, Días incumplimiento, USD, etc.
- **Detalle:** Click en LLAVE para ver timeline completo de la línea

### 5.4 Módulo Importaciones
- **Independiente:** No afecta Dashboard Gerencial
- **Filtros propios:** Proveedor, Incoterms, Modalidad, Destino, Estado
- **Dashboard propio:** KPIs, gráficos por modalidad/incoterms/proveedor
- **Normalización:** Modalidades unificadas (maritimo/MARITIMO → Marítimo)

### 5.5 Proyecciones
- **Forecast:** 8 semanas por fecha compromiso
- **Top proveedores:** Por líneas pendientes
- **Tabla:** Paginada 25/pág, ordenada por fecha más próxima

### 5.6 Alertas Operativas
- **Filtro base:** Solo líneas activas (Sin entrega + Entrega Parcial)
- **Por usuario:** No-admin solo ve sus alertas (por responsable)
- **Tipos:** Incumplimiento crítico, Sin seguimiento (14 días hábiles), SLA vencido, ETA vencida
- **Prioridad:** Cada línea aparece en un solo tipo (el más urgente)

### 5.7 Importar Excel
- **Selector de hojas:** Detecta hojas del archivo
- **Hoja "Data Final"** → Líneas nacionales (Dashboard Gerencial)
- **Hoja "Importaciones"** → Marca como tipoCompra="Importación"
- **Post-import:** Recarga desde Supabase (loadFromCloud) para consistencia
- **Retry inteligente:** Si Supabase rechaza columnas, las elimina y reintenta

### 5.8 Configuración
- **Usuarios:** CRUD completo (solo admin)
- **Cambio de contraseña:** Por usuario
- **Manual de usuario:** Documentación integrada
- **Acerca de:** Información del sistema
- **Legal:** Derechos de autor, licencia, privacidad

---

## 6. LÓGICA DE NEGOCIO

### 6.1 Cálculo de Días Hábiles
Todas las funciones de cálculo de días usan días hábiles:
- **Excluye:** Sábados, Domingos
- **Excluye:** Festivos Colombia 2025-2026 (18 por año)
- **Funciones afectadas:** diasRetraso, delayDays, daysBetween, seguimiento

### 6.2 Clasificación de Estado (estadoOf)
Basada **exclusivamente** en la columna BF (estado_entrega):
- "BORRADO" → Borrado
- "ENTREGA PARCIAL" → Entregado Parcial
- "ENTREGADO" → Entregado
- "SIN ENTREGA" → Sin entrega

### 6.3 Valor USD (valorCompradoUsd)
- **Fuente única:** Columna BC (valor_total_usd)
- Si BC > 0 → retorna ese valor
- Si BC = 0 o null → retorna 0 (no estima de otras columnas)

### 6.4 Valor Recibido USD (valorRecibidoUsd)
- Borrado/Sin entrega → siempre 0
- Si existe valor_pendiente_usd → recibido = total - pendiente
- Si no → ratio por cantidades (qtyEntregada/qty × total)

### 6.5 Año y Mes
- **Fuente:** Columna AL (año), AM (mes)
- **Sin fallback:** No se deriva de fechas
- **Dashboard:** Filtro numérico estricto

---

## 7. IMPORT DE EXCEL

### 7.1 Mapeo de Columnas
El sistema mapea columnas por:
1. **Alias de nombre:** Busca el header del Excel en una lista de aliases conocidos
2. **Posición fija (fallback):** Si el alias no matchea, usa la posición de columna

### 7.2 Posiciones Fijas Críticas

| Columna | Índice | Campo |
|---|---|---|
| G | 6 | cuenta |
| K | 10 | gerencia |
| M | 12 | campo |
| Q | 16 | equipo |
| T | 19 | oc |
| AL | 37 | anio |
| AM | 38 | mes |
| AO | 40 | qty |
| BC | 54 | valorTotalUsd |
| BF | 57 | estadoEntrega (detección inteligente) |
| BH | 59 | estadoAdicional |
| BK | 62 | diasIncumplimiento |
| BY | 76 | categoriaSeguimiento |
| BZ | 77 | detalleStatus |
| CA | 78 | statusGeneral |

### 7.3 Detección Inteligente de BF
Si la columna no se encuentra por alias ni posición, el sistema escanea las primeras 50 filas buscando la columna con ≥50% de valores válidos (borrado/entregado/sin entrega/parcial).

---

## 8. DESPLIEGUE

### 8.1 Entorno de Desarrollo
```bash
npm run dev    # Inicia Vite dev server en localhost:8080
npm run build  # Build de producción → dist/
```

### 8.2 Producción (Netlify)
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Redirects:** `public/_redirects` → `/* /index.html 200` (SPA)
- **Variables de entorno:** VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY

### 8.3 Repositorio
- **GitHub:** PRB2026-dev/logicontrol
- **Rama:** master
- **Deploy automático:** Push a master → Netlify redeploy

---

## 9. MANTENIMIENTO

### 9.1 Agregar Festivos de Nuevo Año
Editar `src/lib/operational.ts` → constante `FESTIVOS` → agregar fechas del nuevo año.

### 9.2 Agregar Nueva Columna del Excel
1. Agregar campo en `src/lib/jobs-data.ts` (interface Job)
2. Agregar alias en `src/lib/excel-import.ts` (ALIASES)
3. Agregar mapeo en `rowToJob` y `jobToRow` de `src/lib/jobs-store.ts`
4. Crear columna en Supabase: `ALTER TABLE jobs ADD COLUMN nombre TEXT DEFAULT NULL;`

### 9.3 Crear Nuevo Módulo/Ruta
1. Crear archivo en `src/routes/nombre.tsx`
2. TanStack Router auto-genera la ruta
3. Agregar al sidebar en `src/components/app-sidebar.tsx`

---

## 10. CONTACTO Y SOPORTE

**Desarrollador:** Misael Becerra  
**Correo:** misaelbecerra18@gmail.com  
**Sistema:** LogiControl v1.2.0  
**Año:** 2026  

---

*Documento generado automáticamente. Última actualización: Junio 2026.*
