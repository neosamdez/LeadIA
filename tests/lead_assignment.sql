\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_assignment(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Falha: %', label; end if;
end;
$$;

create function pg_temp.expect_assignment_denied(target uuid) returns void language plpgsql as $$
begin
  begin
    update public.leads set owner_id = target where name = 'Lead de teste';
  exception when insufficient_privilege or foreign_key_violation then return;
  end;
  raise exception 'Responsável indevido foi aceito';
end;
$$;

insert into auth.users(id,email) values
  ('30000000-0000-0000-0000-000000000001','owner@example.test'),
  ('30000000-0000-0000-0000-000000000002','colleague@example.test'),
  ('30000000-0000-0000-0000-000000000003','viewer@example.test'),
  ('30000000-0000-0000-0000-000000000004','outside@example.test');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001"}',true);
select (public.get_or_create_org()).id as org_a \gset
insert into public.leads(org_id,name) values(:'org_a','Lead de teste');

reset role;
insert into public.memberships(org_id,user_id,role) values
  (:'org_a','30000000-0000-0000-0000-000000000002','member'),
  (:'org_a','30000000-0000-0000-0000-000000000003','viewer');

set local role authenticated;
select pg_temp.assert_assignment((select count(*) = 3 from public.profiles),'lista limitada aos colegas');
select pg_temp.assert_assignment((select count(*) = 3 from public.list_lead_assignees(:'org_a')),'lista de responsáveis da organização');
select pg_temp.assert_assignment((select count(*) = 0 from public.list_lead_assignees('40000000-0000-0000-0000-000000000001')),'organização desconhecida não retorna membros');
select pg_temp.expect_assignment_denied('30000000-0000-0000-0000-000000000004');
select pg_temp.expect_assignment_denied('30000000-0000-0000-0000-000000000003');

update public.leads set owner_id='30000000-0000-0000-0000-000000000002' where name='Lead de teste';
update public.leads set owner_id='30000000-0000-0000-0000-000000000002' where name='Lead de teste';
select pg_temp.assert_assignment(
  (select owner_id='30000000-0000-0000-0000-000000000002' from public.leads where name='Lead de teste'),
  'responsável da organização salvo');
select pg_temp.assert_assignment(
  (select count(*)=1 from public.lead_events where type='assignment' and meta->>'owner'='30000000-0000-0000-0000-000000000002'),
  'histórico gravado uma vez');

select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000003"}',true);
update public.leads set owner_id=null where name='Lead de teste';
select pg_temp.assert_assignment(
  (select owner_id is not null from public.leads where name='Lead de teste'), 'viewer não pode reatribuir');

reset role;
delete from public.memberships where org_id=:'org_a' and user_id='30000000-0000-0000-0000-000000000002';
select pg_temp.assert_assignment(
  (select owner_id is null from public.leads where name='Lead de teste'), 'remoção do membro libera o lead');
select pg_temp.assert_assignment(
  (select count(*)=2 from public.lead_events where type='assignment'), 'remoção também registrada');
rollback;
\echo 'PASS: atribuição, histórico e isolamento de responsáveis'
