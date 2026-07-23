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
  boss text,
  reason text,
  notes text,
  created_at timestamptz not null default now()
);

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

alter table public.hr_sectors enable row level security;
alter table public.hr_transfers enable row level security;
alter table public.hr_attendance enable row level security;
alter table public.hr_events enable row level security;
alter table public.hr_advances enable row level security;
alter table public.hr_payroll enable row level security;
alter table public.hr_documents enable row level security;
alter table public.hr_consultations enable row level security;
