alter table public.hr_transfers
  add column if not exists from_role text,
  add column if not exists to_role text,
  add column if not exists from_boss text,
  add column if not exists created_by_name text;

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
