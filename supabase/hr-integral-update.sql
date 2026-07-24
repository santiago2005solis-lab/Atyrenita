create table if not exists public.hr_sectors (
  id text primary key,
  name text not null unique,
  boss text,
  establishment text,
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo')),
  description text,
  created_at timestamptz not null default now()
);

alter table public.hr_employees
  add column if not exists legacy_id text unique,
  add column if not exists employee_code text,
  add column if not exists birth_date date,
  add column if not exists nationality text,
  add column if not exists marital_status text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists email text,
  add column if not exists contract_type text,
  add column if not exists exit_date date,
  add column if not exists contract_start date,
  add column if not exists contract_end date,
  add column if not exists sector_id text references public.hr_sectors(id),
  add column if not exists boss text,
  add column if not exists schedule text,
  add column if not exists salary_type text not null default 'mensual',
  add column if not exists daily_wage numeric(16, 2) not null default 0,
  add column if not exists pay_method text,
  add column if not exists functions text,
  add column if not exists bank text,
  add column if not exists account_type text,
  add column if not exists account_number text,
  add column if not exists account_holder text,
  add column if not exists emergency_name text,
  add column if not exists emergency_relation text,
  add column if not exists emergency_phone text,
  add column if not exists emergency_phone_2 text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hr_employees_salary_type_check'
  ) then
    alter table public.hr_employees
      add constraint hr_employees_salary_type_check
      check (salary_type in ('mensual', 'jornal'));
  end if;
end
$$;

create table if not exists public.hr_transfers (
  id text primary key,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  transfer_date date not null,
  from_sector_id text references public.hr_sectors(id),
  to_sector_id text not null references public.hr_sectors(id),
  from_role text,
  to_role text,
  from_boss text,
  boss text,
  reason text,
  notes text,
  created_by_name text,
  created_at timestamptz not null default now()
);

alter table public.hr_transfers
  add column if not exists from_role text,
  add column if not exists to_role text,
  add column if not exists from_boss text,
  add column if not exists created_by_name text;

create table if not exists public.hr_attendance (
  id text primary key,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  attendance_date date not null,
  status text not null,
  entry_time time,
  lunch_out time,
  lunch_in time,
  exit_time time,
  extra_hours numeric(8, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_events (
  id text primary key,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  event_type text not null,
  status text not null,
  date_from date not null,
  date_to date,
  hours numeric(8, 2) not null default 0,
  extra_rate numeric(16, 2) not null default 0,
  paid text,
  reason text,
  justification text,
  discount numeric(16, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_advances (
  id text primary key,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  advance_date date not null,
  payroll_month text not null,
  amount numeric(16, 2) not null default 0,
  method text,
  approved_by text,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_payroll (
  id text primary key,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  payroll_month text not null,
  salary numeric(16, 2) not null default 0,
  extra_rate numeric(16, 2) not null default 0,
  other_income numeric(16, 2) not null default 0,
  other_discounts numeric(16, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (employee_id, payroll_month)
);

create table if not exists public.hr_documents (
  id text primary key,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  document_type text not null,
  status text not null,
  delivery_date date,
  expiry_date date,
  reference text,
  file_name text,
  file_path text,
  file_size bigint not null default 0,
  mime_type text,
  uploaded_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_consultations (
  id text primary key,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  consultation_date date not null,
  consultation_type text not null,
  subject text not null,
  detail text,
  status text not null,
  response text,
  created_at timestamptz not null default now()
);

create index if not exists hr_attendance_employee_date_idx
  on public.hr_attendance (employee_id, attendance_date desc);
create index if not exists hr_events_employee_date_idx
  on public.hr_events (employee_id, date_from desc);
create index if not exists hr_advances_employee_month_idx
  on public.hr_advances (employee_id, payroll_month);
create index if not exists hr_payroll_employee_month_idx
  on public.hr_payroll (employee_id, payroll_month);
create index if not exists hr_transfers_employee_date_idx
  on public.hr_transfers (employee_id, transfer_date desc);

create or replace function public.hr_record_transfer(
  p_id text,
  p_employee_id uuid,
  p_transfer_date date,
  p_to_sector_id text,
  p_to_role text default '',
  p_to_boss text default '',
  p_reason text default '',
  p_notes text default '',
  p_created_by_name text default ''
)
returns setof public.hr_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.hr_employees%rowtype;
  v_target_sector public.hr_sectors%rowtype;
  v_from_sector_id text;
  v_transfer public.hr_transfers%rowtype;
begin
  if p_transfer_date is null or p_transfer_date > current_date then
    raise exception 'La fecha del cambio no es valida';
  end if;

  select *
    into v_employee
    from public.hr_employees
    where id = p_employee_id
    for update;

  if not found then
    raise exception 'Funcionario no encontrado';
  end if;

  if v_employee.status = 'inactivo' then
    raise exception 'El funcionario esta inactivo';
  end if;

  select *
    into v_target_sector
    from public.hr_sectors
    where id = p_to_sector_id
      and status = 'Activo';

  if not found then
    raise exception 'Sector de destino no encontrado o inactivo';
  end if;

  v_from_sector_id := v_employee.sector_id;
  if v_from_sector_id is null and trim(coalesce(v_employee.department, '')) <> '' then
    select id
      into v_from_sector_id
      from public.hr_sectors
      where lower(trim(name)) = lower(trim(v_employee.department))
      order by created_at
      limit 1;
  end if;

  if coalesce(v_from_sector_id, '') = coalesce(p_to_sector_id, '')
    and lower(trim(coalesce(v_employee.role, ''))) =
      lower(trim(coalesce(p_to_role, '')))
    and lower(trim(coalesce(v_employee.boss, ''))) =
      lower(trim(coalesce(p_to_boss, ''))) then
    raise exception 'El registro no tiene cambios';
  end if;

  insert into public.hr_transfers (
    id,
    employee_id,
    transfer_date,
    from_sector_id,
    to_sector_id,
    from_role,
    to_role,
    from_boss,
    boss,
    reason,
    notes,
    created_by_name
  )
  values (
    p_id,
    p_employee_id,
    p_transfer_date,
    v_from_sector_id,
    p_to_sector_id,
    nullif(trim(coalesce(v_employee.role, '')), ''),
    nullif(trim(coalesce(p_to_role, '')), ''),
    nullif(trim(coalesce(v_employee.boss, '')), ''),
    nullif(trim(coalesce(p_to_boss, '')), ''),
    nullif(trim(coalesce(p_reason, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    nullif(trim(coalesce(p_created_by_name, '')), '')
  )
  returning * into v_transfer;

  update public.hr_employees
    set
      sector_id = p_to_sector_id,
      department = v_target_sector.name,
      role = nullif(trim(coalesce(p_to_role, '')), ''),
      boss = nullif(trim(coalesce(p_to_boss, '')), '')
    where id = p_employee_id;

  return next v_transfer;
end;
$$;

revoke all on function public.hr_record_transfer(
  text,
  uuid,
  date,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.hr_record_transfer(
  text,
  uuid,
  date,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

notify pgrst, 'reload schema';

alter table public.hr_sectors enable row level security;
alter table public.hr_transfers enable row level security;
alter table public.hr_attendance enable row level security;
alter table public.hr_events enable row level security;
alter table public.hr_advances enable row level security;
alter table public.hr_payroll enable row level security;
alter table public.hr_documents enable row level security;
alter table public.hr_consultations enable row level security;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hr-documents',
  'hr-documents',
  false,
  4194304,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
