# GanadoFinanzas

Sistema web general para administrar una empresa ganadera/agropecuaria.

## Modulos

- Finanzas: movimientos, reportes y exportacion CSV para 6 cajas.
- Deposito: articulos, stock minimo y movimientos para 4 depositos fisicos.
- Recursos Humanos: base inicial de personal, preparada para ampliar.

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
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
```

La clave `SUPABASE_SERVICE_ROLE_KEY` solo debe estar en el servidor, por ejemplo en Vercel Environment Variables. No debe enviarse al navegador.

## Vercel

1. Subir el proyecto a GitHub.
2. Importar el repositorio desde Vercel.
3. Framework: Next.js.
4. Build command: `pnpm build`.
5. Agregar las variables de Supabase en Production, Preview y Development.
6. Deploy.

## Base de datos

El archivo `supabase/schema.sql` crea:

- `finance_cashboxes`
- `finance_movements`
- `inventory_warehouses`
- `inventory_items`
- `inventory_movements`
- `hr_employees`
- Vistas de reporte para finanzas y deposito

## Siguiente paso

El modulo de Recursos Humanos puede avanzar con legajos, asistencia, adelantos, salarios, contratos, vacaciones y reportes por funcionario.
