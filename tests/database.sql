\set ON_ERROR_STOP on
begin;
create function pg_temp.expect_denied(statement text) returns void language plpgsql as $$
begin
 begin
  execute statement;
 exception when insufficient_privilege or foreign_key_violation or check_violation then return;
 end;
 raise exception 'Operação indevida foi permitida: %',statement;
end;
$$;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Falha: %',label; end if; end;
$$;
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','a@example.test'),
 ('10000000-0000-0000-0000-000000000002','b@example.test'),
 ('10000000-0000-0000-0000-000000000003','viewer@example.test');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',true);
select (public.get_or_create_org()).id as org_a \gset
select pg_temp.assert_true((public.get_or_create_org()).id=:'org_a'::uuid,'bootstrap idempotente');
insert into public.leads(id,org_id,name,value,next_action) values
 ('20000000-0000-0000-0000-000000000001',:'org_a','Lead A',150,'Telefonar');
select public.append_message('20000000-0000-0000-0000-000000000001','consultor','Mensagem persistida');
select pg_temp.assert_true((select last_message='Mensagem persistida' from public.leads limit 1),'última mensagem');
select pg_temp.assert_true((select count(*)=1 from public.messages),'mensagem persistida');
select conversation_id as conv_a from public.messages limit 1 \gset
select pg_temp.assert_true((select count(*)=1 from public.lead_events),'evento persistido');
update public.leads set status='Qualificado' where id='20000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*)=2 from public.lead_events),'auditoria de status');
select pg_temp.expect_denied($q$select public.append_message('20000000-0000-0000-0000-000000000001','consultor','')$q$);
select pg_temp.assert_true((select count(*)=1 from public.messages),'rollback mensagem inválida');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002"}',true);
select (public.get_or_create_org()).id as org_b \gset
select pg_temp.assert_true((select count(*)=0 from public.leads),'isolamento de leitura');
select pg_temp.expect_denied(format('insert into public.leads(org_id,name) values(%L,''Invasão'')',:'org_a'));
select pg_temp.expect_denied(format('insert into public.memberships(org_id,user_id,role) values(%L,%L,''owner'')',:'org_a','10000000-0000-0000-0000-000000000002'));
select pg_temp.expect_denied($q$select public.append_message('20000000-0000-0000-0000-000000000001','client','Invasão')$q$);
select pg_temp.expect_denied(format('insert into public.messages(org_id,conversation_id,lead_id,sender,content) values(%L,%L,%L,''client'',''Cruzamento'')',:'org_b',:'conv_a','20000000-0000-0000-0000-000000000001'));
insert into public.leads(id,org_id,name) values('20000000-0000-0000-0000-000000000002',:'org_b','Lead B');
reset role;
insert into public.memberships(org_id,user_id,role) values(:'org_a','10000000-0000-0000-0000-000000000003','viewer');
-- Mesmo membro das duas organizações não pode mover uma linha entre elas.
insert into public.memberships(org_id,user_id,role) values(:'org_a','10000000-0000-0000-0000-000000000002','member');
set local role authenticated;
select pg_temp.expect_denied(format('update public.leads set org_id=%L where id=%L',:'org_a','20000000-0000-0000-0000-000000000002'));
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003"}',true);
select pg_temp.assert_true((select count(*)=1 from public.leads),'viewer lê sua organização');
select pg_temp.expect_denied(format('insert into public.leads(org_id,name) values(%L,''Viewer write'')',:'org_a'));
select pg_temp.expect_denied($q$select public.append_message('20000000-0000-0000-0000-000000000001','client','Viewer write')$q$);
set local role anon;
select pg_temp.expect_denied('select * from public.leads');
select pg_temp.expect_denied('select public.get_or_create_org()');
reset role;
rollback;
\echo 'PASS: bootstrap, persistência, transação, RLS, FK entre organizações e viewer'
