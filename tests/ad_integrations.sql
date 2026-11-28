\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_ads(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Falha: %', label; end if;
end;
$$;

create function pg_temp.expect_ads_denied(statement text, label text) returns void language plpgsql as $$
declare changed integer;
begin
  begin
    execute statement;
    get diagnostics changed = row_count;
  exception when insufficient_privilege or check_violation or unique_violation then return;
  end;
  if changed > 0 then raise exception 'Aceito indevidamente: %', label; end if;
end;
$$;

insert into auth.users(id,email) values
  ('70000000-0000-0000-0000-000000000001','ads-owner@example.test'),
  ('70000000-0000-0000-0000-000000000002','ads-member@example.test'),
  ('70000000-0000-0000-0000-000000000004','ads-other@example.test');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000004"}',true);
select (public.get_or_create_org()).id as org_b \gset
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000001"}',true);
select (public.get_or_create_org()).id as org_a \gset
reset role;
insert into public.memberships(org_id,user_id,role) values (:'org_a','70000000-0000-0000-0000-000000000002','member');

-- Owner cadastra identificadores válidos; status inicial aguarda credenciais.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000001"}',true);
insert into public.ad_integrations(org_id,provider,external_id,display_name) values
  (:'org_a','meta_ads','act_1234567890','Conta principal'),
  (:'org_a','google_ads','123-456-7890',null),
  (:'org_a','ga4','G-ABC1234XYZ',null),
  (:'org_a','gtm','GTM-AB12CD',null);
select id as meta from public.ad_integrations where org_id = :'org_a' and provider = 'meta_ads' \gset
select pg_temp.assert_ads((select count(*) = 4 and bool_and(status = 'aguardando_credenciais') and bool_and(created_by = '70000000-0000-0000-0000-000000000001')
  from public.ad_integrations where org_id = :'org_a'),'cadastro inicial');

select pg_temp.expect_ads_denied(format($q$insert into public.ad_integrations(org_id,provider,external_id) values (%L,'meta_ads','1234567890')$q$, :'org_a'),'conta Meta sem act_');
select pg_temp.expect_ads_denied(format($q$insert into public.ad_integrations(org_id,provider,external_id) values (%L,'ga4','UA-1234-1')$q$, :'org_a'),'GA4 com ID antigo');
select pg_temp.expect_ads_denied(format($q$insert into public.ad_integrations(org_id,provider,external_id) values (%L,'linkedin','1')$q$, :'org_a'),'plataforma fora da lista');
select pg_temp.expect_ads_denied(format($q$insert into public.ad_integrations(org_id,provider,external_id) values (%L,'meta_ads','act_1234567890')$q$, :'org_a'),'duplicado');
select pg_temp.expect_ads_denied(format($q$insert into public.ad_integrations(org_id,provider,external_id,status) values (%L,'tiktok_ads','7012345678901','conectado')$q$, :'org_a'),'cliente cadastra como conectado');
select pg_temp.expect_ads_denied(format($q$update public.ad_integrations set status = 'conectado' where id = %L$q$, :'meta'),'cliente marca conectado');
select pg_temp.expect_ads_denied(format($q$update public.ad_integrations set external_id = 'act_99999' where id = %L$q$, :'meta'),'trocar identificador');

update public.ad_integrations set settings = '{"events":{"Qualificado":"Lead"}}', status = 'desconectado' where id = :'meta';
select pg_temp.assert_ads((select status = 'desconectado' and settings->'events'->>'Qualificado' = 'Lead' from public.ad_integrations where id = :'meta'),'owner ajusta preferências e desliga');

-- Servidor conecta; cliente não apaga o erro registrado pelo servidor.
reset role;
update public.ad_integrations set status = 'erro', last_error = 'Token expirado' where id = :'meta';
set local role authenticated;
update public.ad_integrations set last_error = null, display_name = 'Conta Meta' where id = :'meta';
select pg_temp.assert_ads((select last_error = 'Token expirado' and display_name = 'Conta Meta' from public.ad_integrations where id = :'meta'),'erro do servidor preservado');

-- Membro lê mas não altera; organização B não vê nem altera A.
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000002"}',true);
select pg_temp.assert_ads((select count(*) = 4 from public.ad_integrations where org_id = :'org_a'),'membro lê');
select pg_temp.expect_ads_denied(format($q$update public.ad_integrations set display_name = 'x' where id = %L$q$, :'meta'),'membro altera');
select pg_temp.expect_ads_denied(format($q$insert into public.ad_integrations(org_id,provider,external_id) values (%L,'gtm','GTM-ZZ99ZZ')$q$, :'org_a'),'membro cadastra');
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000004"}',true);
select pg_temp.assert_ads((select count(*) = 0 from public.ad_integrations where org_id = :'org_a'),'B não lê A');
select pg_temp.expect_ads_denied(format($q$delete from public.ad_integrations where id = %L$q$, :'meta'),'B apaga A');
select pg_temp.expect_ads_denied(format($q$insert into public.ad_integrations(org_id,provider,external_id) values (%L,'gtm','GTM-ZZ99ZZ')$q$, :'org_a'),'B cadastra em A');

rollback;
