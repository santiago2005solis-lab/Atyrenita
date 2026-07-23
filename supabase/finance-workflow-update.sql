begin;

alter table finance_movements
  drop constraint if exists finance_movements_status_check;

update finance_movements
set status = 'confirmado'
where status is null or status = '' or status = 'activo';

alter table finance_movements
  alter column status set default 'borrador';

alter table finance_movements
  alter column status set not null;

alter table finance_movements
  add constraint finance_movements_status_check
  check (status in ('borrador', 'pendiente', 'confirmado', 'anulado'));

create or replace view finance_cashbox_report as
select
  cashbox_name,
  date_trunc('month', movement_date)::date as month,
  sum(case when movement_type = 'ingreso' then amount else 0 end) as income,
  sum(case when movement_type = 'egreso' then amount else 0 end) as expense,
  sum(case when movement_type = 'transferencia' then amount else 0 end) as transfers,
  sum(
    case
      when movement_type = 'ingreso' then amount
      when movement_type = 'egreso' then -amount
      else 0
    end
  ) as balance
from finance_movements
where status = 'confirmado'
group by cashbox_name, date_trunc('month', movement_date)::date;

commit;
