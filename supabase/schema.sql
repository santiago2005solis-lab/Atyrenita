create extension if not exists pgcrypto;

create table if not exists finance_cashboxes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists finance_movements (
  id uuid primary key default gen_random_uuid(),
  cashbox_name text not null references finance_cashboxes(name),
  movement_type text not null check (movement_type in ('ingreso', 'egreso', 'transferencia')),
  movement_date date not null,
  concept text not null,
  category text not null,
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'PYG',
  payment_method text,
  document_number text,
  responsible text,
  related_party text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists finance_movements_cashbox_date_idx
  on finance_movements (cashbox_name, movement_date desc);

create index if not exists finance_movements_type_date_idx
  on finance_movements (movement_type, movement_date desc);

create table if not exists inventory_warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  warehouse_name text not null references inventory_warehouses(name),
  sku text not null,
  name text not null,
  category text not null,
  unit text not null,
  current_stock numeric(16, 3) not null default 0,
  min_stock numeric(16, 3) not null default 0,
  unit_cost numeric(16, 2) not null default 0,
  supplier text,
  updated_at timestamptz not null default now(),
  unique (warehouse_name, sku)
);

create index if not exists inventory_items_warehouse_idx
  on inventory_items (warehouse_name, name);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id),
  warehouse_name text not null references inventory_warehouses(name),
  target_warehouse_name text references inventory_warehouses(name),
  movement_type text not null check (movement_type in ('entrada', 'salida', 'traslado', 'ajuste')),
  movement_date date not null,
  quantity numeric(16, 3) not null check (quantity > 0),
  unit_cost numeric(16, 2) not null default 0,
  document_number text,
  responsible text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_item_date_idx
  on inventory_movements (item_id, movement_date desc);

create table if not exists hr_employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  document_number text,
  role text,
  department text,
  status text not null default 'activo' check (status in ('activo', 'licencia', 'inactivo')),
  start_date date,
  monthly_salary numeric(16, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create or replace view finance_cashbox_report as
select
  cashbox_name,
  date_trunc('month', movement_date)::date as month,
  sum(case when movement_type = 'ingreso' then amount else 0 end) as income,
  sum(case when movement_type = 'egreso' then amount else 0 end) as expense,
  sum(case when movement_type = 'transferencia' then amount else 0 end) as transfers,
  sum(case when movement_type = 'ingreso' then amount when movement_type = 'egreso' then -amount else 0 end) as balance
from finance_movements
group by cashbox_name, date_trunc('month', movement_date)::date;

create or replace view inventory_stock_report as
select
  warehouse_name,
  count(*) as item_count,
  sum(current_stock * unit_cost) as stock_value,
  sum(case when current_stock <= min_stock then 1 else 0 end) as low_stock_count
from inventory_items
group by warehouse_name;

alter table finance_cashboxes enable row level security;
alter table finance_movements enable row level security;
alter table inventory_warehouses enable row level security;
alter table inventory_items enable row level security;
alter table inventory_movements enable row level security;
alter table hr_employees enable row level security;

insert into finance_cashboxes (name) values
  ('Caja Ganadero Confinamiento'),
  ('Caja Ganadero a Pasto'),
  ('Caja Agricola'),
  ('Caja Inversiones'),
  ('Caja Maquinas'),
  ('Caja CDE')
on conflict (name) do nothing;

insert into inventory_warehouses (name) values
  ('Deposito Capitan'),
  ('Deposito Villagra'),
  ('Deposito Confinamiento 15 HAS'),
  ('Confinamiento 500 HAS')
on conflict (name) do nothing;

insert into inventory_items
  (warehouse_name, sku, name, category, unit, current_stock, min_stock, unit_cost, supplier)
values
  ('Deposito Capitan', 'ALM-001', 'Balanceado terminacion', 'Alimento', 'kg', 18450, 8000, 3100, 'Nutricion Campo'),
  ('Deposito Villagra', 'VET-014', 'Antiparasitario bovino', 'Veterinaria', 'litro', 64, 30, 125000, 'Veterinaria Norte'),
  ('Deposito Confinamiento 15 HAS', 'REP-022', 'Filtro hidraulico', 'Repuestos', 'unidad', 11, 8, 185000, 'Mecanica Diesel'),
  ('Confinamiento 500 HAS', 'AGR-102', 'Fertilizante granulado', 'Agricola', 'bolsa', 420, 150, 168000, 'Agroinsumos Central')
on conflict (warehouse_name, sku) do nothing;

insert into finance_movements
  (cashbox_name, movement_type, movement_date, concept, category, amount, payment_method, document_number, responsible, related_party, notes)
select
  'Caja Ganadero Confinamiento', 'ingreso', date '2026-07-21', 'Venta de novillos terminados', 'Venta', 328400000,
  'Transferencia bancaria', 'FV-00128', 'Administracion', 'Frigorifico regional', 'Operacion de cierre semanal'
where not exists (select 1 from finance_movements where document_number = 'FV-00128');

insert into finance_movements
  (cashbox_name, movement_type, movement_date, concept, category, amount, payment_method, document_number, responsible, related_party, notes)
select
  'Caja Ganadero Confinamiento', 'egreso', date '2026-07-20', 'Compra de balanceado terminacion', 'Alimento', 68400000,
  'Transferencia bancaria', 'FC-00451', 'Compras', 'Nutricion Campo', 'Reposicion mensual'
where not exists (select 1 from finance_movements where document_number = 'FC-00451');

insert into finance_movements
  (cashbox_name, movement_type, movement_date, concept, category, amount, payment_method, document_number, responsible, related_party, notes)
select
  'Caja Agricola', 'egreso', date '2026-07-17', 'Semillas y fertilizante', 'Agricola', 95800000,
  'Cheque', 'FC-00439', 'Compras', 'Agroinsumos Central', 'Campana de invierno'
where not exists (select 1 from finance_movements where document_number = 'FC-00439');

insert into hr_employees
  (full_name, document_number, role, department, status, start_date, monthly_salary, notes)
select
  'Carlos Benitez', '1234567', 'Encargado de campo', 'Ganaderia', 'activo', date '2024-02-15', 5200000,
  'Responsable de recorridas y novedades'
where not exists (select 1 from hr_employees where document_number = '1234567');

insert into hr_employees
  (full_name, document_number, role, department, status, start_date, monthly_salary, notes)
select
  'Maria Duarte', '2345678', 'Auxiliar administrativo', 'Administracion', 'activo', date '2025-03-01', 4300000,
  'Control documental y archivo'
where not exists (select 1 from hr_employees where document_number = '2345678');
