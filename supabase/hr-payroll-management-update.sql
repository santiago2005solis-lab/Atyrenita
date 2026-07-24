alter table public.hr_advances
  add column if not exists status text not null default 'activo';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hr_advances_status_check'
  ) then
    alter table public.hr_advances
      add constraint hr_advances_status_check
      check (status in ('activo', 'anulado'));
  end if;
end
$$;

create table if not exists public.hr_salary_payments (
  id text primary key,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  payment_date date not null,
  payroll_month text not null,
  amount numeric(16, 2) not null check (amount > 0),
  method text,
  reference text,
  notes text,
  status text not null default 'confirmado'
    check (status in ('confirmado', 'anulado')),
  created_at timestamptz not null default now()
);

create index if not exists hr_salary_payments_employee_month_idx
  on public.hr_salary_payments (employee_id, payroll_month);

alter table public.hr_salary_payments enable row level security;
