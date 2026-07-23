# Atyrenita SG

Sistema web general para administrar una empresa ganadera/agropecuaria.

## Modulos

- Ganadero: estructura base para rodeo, lotes, pesajes, sanidad y reproduccion.
- Agricola: estructura base para campanas, parcelas, insumos, labores y cosecha.
- Maquinarias: estructura base para equipos, horas, combustible y mantenimiento.
- Recursos Humanos: base inicial de personal, preparada para ampliar.
- Financiero: movimientos, reportes y exportacion CSV para 6 cajas.
- Deposito: articulos, stock minimo y movimientos para 4 depositos fisicos.

## Cajas iniciales

- Caja Ganadero Confinamiento
- Caja Ganadero a Pasto
- Caja Agricola
- Caja Inversiones
- Caja Maquinas
- Caja CDE

## Depositos iniciales

- Deposito Capitan
- Deposito Villagra
- Deposito Confinamiento 15 HAS
- Confinamiento 500 HAS

## Desarrollo local

```bash
pnpm install
pnpm dev
```

La app funciona en modo demo cuando no hay variables de Supabase.

## Supabase

1. Crear un proyecto gratis en Supabase.
2. Abrir SQL Editor.
3. Ejecutar `supabase/schema.sql`.
4. Copiar `.env.example` a `.env.local`.
5. Completar:

```bash
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=TU_SUPABASE_SECRET_KEY
```

La clave `SUPABASE_SECRET_KEY` solo debe estar en el servidor, por ejemplo en Vercel Environment Variables. No debe enviarse al navegador. La app tambien acepta `SUPABASE_SERVICE_ROLE_KEY` para proyectos que todavia usen claves legacy.

## Usuarios y permisos

El login usa Supabase Auth. Los permisos internos viven en:

- `app_users`
- `app_module_permissions`

Roles:

- `desarrollador`: permisos totales.
- `administrador`: acceso avanzado por modulo.
- `editor`: puede cargar y modificar datos del modulo asignado.
- `lector`: solo puede consultar reportes y tablas.

Para el primer usuario:

1. Crear el usuario en Supabase Auth con el correo `desarrollosistema@aty.com`.
2. Ejecutar `supabase/auth-permissions.sql` en SQL Editor.
3. Agregar las variables de Supabase en Vercel.
4. Redeploy.

Si ya existe la base y se agregan los modulos nuevos, ejecutar `supabase/modules-update.sql`.
Para activar la estructura financiera nueva en una base ya creada, ejecutar `supabase/finance-structure-update.sql`.

Para activar el flujo de movimientos con estados Borrador, Pendiente, Confirmado y Anulado,
ejecutar `supabase/finance-workflow-update.sql` en el SQL Editor de Supabase.

## Vercel

1. Subir el proyecto a GitHub.
2. Importar el repositorio desde Vercel.
3. Framework: Next.js.
4. Install command: `npm install`.
5. Build command: `npm run build`.
6. Agregar las variables de Supabase en Production, Preview y Development.
7. Deploy.

## Base de datos

El archivo `supabase/schema.sql` crea:

- `finance_cashboxes`
- `finance_accounts`
- `cost_centers`
- `finance_movements`
- `inventory_warehouses`
- `inventory_items`
- `inventory_movements`
- `hr_employees`
- Vistas de reporte para financiero y deposito

## Siguiente paso

El modulo de Recursos Humanos puede avanzar con legajos, asistencia, adelantos, salarios, contratos, vacaciones y reportes por funcionario.
