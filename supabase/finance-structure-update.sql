create extension if not exists pgcrypto;

create table if not exists finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  account_type text not null check (
    account_type in ('ingreso', 'egreso', 'transferencia', 'inversion', 'otro')
  ),
  linked_module text not null default 'General' check (
    linked_module in (
      'Ganadero',
      'Agricola',
      'Maquinarias',
      'Recursos Humanos',
      'Financiero',
      'Deposito',
      'General'
    )
  ),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  linked_module text not null default 'General' check (
    linked_module in (
      'Ganadero',
      'Agricola',
      'Maquinarias',
      'Recursos Humanos',
      'Financiero',
      'Deposito',
      'General'
    )
  ),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into finance_accounts (name, account_type, linked_module) values
  ('Venta de ganado', 'ingreso', 'Ganadero'),
  ('Venta agricola', 'ingreso', 'Agricola'),
  ('Servicios y alquileres', 'ingreso', 'Maquinarias'),
  ('Compra de ganado', 'egreso', 'Ganadero'),
  ('Alimento animal', 'egreso', 'Ganadero'),
  ('Sanidad animal', 'egreso', 'Ganadero'),
  ('Insumos agricolas', 'egreso', 'Agricola'),
  ('Combustible', 'egreso', 'Maquinarias'),
  ('Mantenimiento de maquinarias', 'egreso', 'Maquinarias'),
  ('Repuestos', 'egreso', 'Maquinarias'),
  ('Sueldos y jornales', 'egreso', 'Recursos Humanos'),
  ('Deposito e inventario', 'egreso', 'Deposito'),
  ('Servicios generales', 'egreso', 'General'),
  ('Transferencias internas', 'transferencia', 'Financiero'),
  ('Inversiones', 'inversion', 'Financiero'),
  ('Otros', 'otro', 'General')
on conflict (name) do nothing;

insert into cost_centers (name, linked_module) values
  ('Ganadero Confinamiento', 'Ganadero'),
  ('Ganadero a Pasto', 'Ganadero'),
  ('Agricola', 'Agricola'),
  ('Maquinarias', 'Maquinarias'),
  ('Recursos Humanos', 'Recursos Humanos'),
  ('Deposito Capitan', 'Deposito'),
  ('Deposito Villagra', 'Deposito'),
  ('Deposito Confinamiento 15 HAS', 'Deposito'),
  ('Confinamiento 500 HAS', 'Deposito'),
  ('Administracion CDE', 'General'),
  ('Inversiones', 'Financiero'),
  ('General', 'General')
on conflict (name) do nothing;

alter table finance_movements add column if not exists linked_module text;
alter table finance_movements add column if not exists account_name text;
alter table finance_movements add column if not exists cost_center_name text;
alter table finance_movements add column if not exists source_module text;
alter table finance_movements add column if not exists status text;

update finance_movements
set linked_module = case
  when cashbox_name in ('Caja Ganadero Confinamiento', 'Caja Ganadero a Pasto') then 'Ganadero'
  when cashbox_name = 'Caja Agricola' then 'Agricola'
  when cashbox_name = 'Caja Maquinas' then 'Maquinarias'
  when cashbox_name = 'Caja Inversiones' then 'Financiero'
  when cashbox_name = 'Caja CDE' then 'General'
  else 'General'
end
where linked_module is null or linked_module = '';

update finance_movements
set account_name = case
  when movement_type = 'transferencia' then 'Transferencias internas'
  when category = 'Venta' and cashbox_name in ('Caja Ganadero Confinamiento', 'Caja Ganadero a Pasto') then 'Venta de ganado'
  when category = 'Venta' and cashbox_name = 'Caja Agricola' then 'Venta agricola'
  when category = 'Alimento' then 'Alimento animal'
  when category = 'Sanidad' then 'Sanidad animal'
  when category = 'Agricola' then 'Insumos agricolas'
  when category = 'Combustible' then 'Combustible'
  when category = 'Mantenimiento' then 'Mantenimiento de maquinarias'
  when category = 'Personal' then 'Sueldos y jornales'
  when category = 'Inversion' then 'Inversiones'
  when category = 'Transferencia interna' then 'Transferencias internas'
  else 'Otros'
end
where account_name is null or account_name = '';

update finance_movements
set cost_center_name = case
  when cashbox_name = 'Caja Ganadero Confinamiento' then 'Ganadero Confinamiento'
  when cashbox_name = 'Caja Ganadero a Pasto' then 'Ganadero a Pasto'
  when cashbox_name = 'Caja Agricola' then 'Agricola'
  when cashbox_name = 'Caja Maquinas' then 'Maquinarias'
  when cashbox_name = 'Caja Inversiones' then 'Inversiones'
  when cashbox_name = 'Caja CDE' then 'Administracion CDE'
  else 'General'
end
where cost_center_name is null or cost_center_name = '';

update finance_movements
set source_module = 'manual'
where source_module is null or source_module = '';

update finance_movements
set status = 'activo'
where status is null or status = '';

alter table finance_movements alter column linked_module set default 'General';
alter table finance_movements alter column account_name set default 'Otros';
alter table finance_movements alter column cost_center_name set default 'General';
alter table finance_movements alter column source_module set default 'manual';
alter table finance_movements alter column status set default 'activo';

alter table finance_movements alter column linked_module set not null;
alter table finance_movements alter column account_name set not null;
alter table finance_movements alter column cost_center_name set not null;
alter table finance_movements alter column source_module set not null;
alter table finance_movements alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'finance_movements_linked_module_check'
  ) then
    alter table finance_movements add constraint finance_movements_linked_module_check
      check (
        linked_module in (
          'Ganadero',
          'Agricola',
          'Maquinarias',
          'Recursos Humanos',
          'Financiero',
          'Deposito',
          'General'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'finance_movements_status_check'
  ) then
    alter table finance_movements add constraint finance_movements_status_check
      check (status in ('activo', 'anulado'));
  end if;
end $$;

create index if not exists finance_movements_module_date_idx
  on finance_movements (linked_module, movement_date desc);

create index if not exists finance_movements_account_date_idx
  on finance_movements (account_name, movement_date desc);

create index if not exists finance_movements_cost_center_date_idx
  on finance_movements (cost_center_name, movement_date desc);

alter table finance_accounts enable row level security;
alter table cost_centers enable row level security;

create or replace view finance_cashbox_report as
select
  cashbox_name,
  date_trunc('month', movement_date)::date as month,
  sum(case when movement_type = 'ingreso' then amount else 0 end) as income,
  sum(case when movement_type = 'egreso' then amount else 0 end) as expense,
  sum(case when movement_type = 'transferencia' then amount else 0 end) as transfers,
  sum(case when movement_type = 'ingreso' then amount when movement_type = 'egreso' then -amount else 0 end) as balance
from finance_movements
where status = 'activo'
group by cashbox_name, date_trunc('month', movement_date)::date;
