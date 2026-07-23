alter table public.hr_employees
  add column if not exists salary_type text not null default 'mensual',
  add column if not exists daily_wage numeric(16, 2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hr_employees_salary_type_check'
  ) then
    alter table public.hr_employees
      add constraint hr_employees_salary_type_check
      check (salary_type in ('mensual', 'jornal'));
  end if;
end
$$;

update public.hr_employees
set
  salary_type = coalesce(salary_type, 'mensual'),
  daily_wage = coalesce(daily_wage, 0);
