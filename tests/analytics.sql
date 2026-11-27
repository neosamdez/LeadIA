\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claims', '{}', true);

insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'analytics-a@example.test'),
  ('a1000000-0000-4000-8000-000000000002', 'analytics-b@example.test');
insert into public.organizations (id, created_by, name) values
  ('a1000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000001', 'QA Analytics A'),
  ('a1000000-0000-4000-8000-000000000012', 'a1000000-0000-4000-8000-000000000002', 'QA Analytics B');
insert into public.memberships (org_id, user_id, role) values
  ('a1000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000001', 'viewer'),
  ('a1000000-0000-4000-8000-000000000012', 'a1000000-0000-4000-8000-000000000002', 'owner');

insert into public.leads (id, org_id, name, created_at) values
  ('a1000000-0000-4000-8000-000000000021', 'a1000000-0000-4000-8000-000000000011', 'Antes do período', '2026-11-27 02:59:59+00'),
  ('a1000000-0000-4000-8000-000000000022', 'a1000000-0000-4000-8000-000000000011', 'No início', '2026-11-27 03:00:00+00'),
  ('a1000000-0000-4000-8000-000000000023', 'a1000000-0000-4000-8000-000000000011', 'No corte', '2026-11-28 03:00:00+00'),
  ('a1000000-0000-4000-8000-000000000024', 'a1000000-0000-4000-8000-000000000012', 'Outra organização', '2026-11-27 03:00:00+00');

insert into public.follow_ups (org_id, lead_id, title, due_at, status)
select 'a1000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000022', title, due_at, status
from (values
  ('Atrasado', '2026-11-28 02:59:59+00'::timestamptz, 'open'),
  ('No corte', '2026-11-28 03:00:00+00', 'open'),
  ('Futuro', '2026-11-28 03:00:01+00', 'open'),
  ('Concluído', '2026-11-28 02:59:59+00', 'done'),
  ('Cancelado', '2026-11-28 02:59:59+00', 'canceled'),
  ('Sem prazo', null, 'open')
) as fixture(title, due_at, status);
insert into public.follow_ups (org_id, lead_id, title, due_at)
values ('a1000000-0000-4000-8000-000000000012', 'a1000000-0000-4000-8000-000000000024', 'Retorno de B', '2026-11-28 02:59:59+00');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001"}',true);
do $$
declare
  org_a constant uuid := 'a1000000-0000-4000-8000-000000000011';
  org_b constant uuid := 'a1000000-0000-4000-8000-000000000012';
begin
  if (select array_agg(name) from public.leads where org_id = org_a
      and created_at >= '2026-11-27 03:00:00+00' and created_at < '2026-11-28 03:00:00+00')
      is distinct from array['No início'] then raise exception 'Período dos novos leads incorreto'; end if;
  if (select array_agg(title) from public.follow_ups where org_id = org_a
      and status = 'open' and due_at < '2026-11-28 03:00:00+00')
      is distinct from array['Atrasado'] then raise exception 'Filtro de atrasos incorreto'; end if;
  if exists (select 1 from public.leads where org_id = org_b)
      or exists (select 1 from public.follow_ups where org_id = org_b)
    then raise exception 'Consulta Analytics expôs outra organização'; end if;
end $$;

rollback;
\echo 'PASS: Analytics respeita período, prazo, status e isolamento por organização'
